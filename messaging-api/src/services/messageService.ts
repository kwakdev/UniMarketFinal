import sql from 'mssql';
import { getDbPool } from '../config/database';
import { Message, CreateMessagePayload, MessageQueryParams, PaginatedResponse } from '../types';
import { encryptMessage, decryptMessage } from '../utils/encryption';
import { keyService } from './keyService';

export class MessageService {
  /**
   * Check if user is authorized to access a conversation
   */
  async isUserAuthorized(conversationId: string, userId: string): Promise<boolean> {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('ConversationId', sql.NVarChar, conversationId)
      .input('UserId', sql.NVarChar, userId)
      .query(`
        SELECT CASE 
          WHEN EXISTS (
            SELECT 1 FROM dbo.ConversationParticipants 
            WHERE ConversationId = @ConversationId 
            AND UserId = @UserId 
            AND LeftAt IS NULL
          ) THEN 1 ELSE 0 END AS IsAuthorized
      `);

    return result.recordset[0]?.IsAuthorized === 1;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    params: MessageQueryParams = {}
  ): Promise<PaginatedResponse<Message>> {
    const pool = await getDbPool();
    const limit = Math.min(params.limit || 50, 100); // Max 100
    const offset = params.offset || 0;

    // Check authorization
    const isAuthorized = await this.isUserAuthorized(conversationId, userId);
    if (!isAuthorized) {
      throw new Error('Not authorized to view this conversation');
    }

    let query = `
      SELECT 
        m.Id,
        m.ConversationId,
        m.SenderId,
        m.Ciphertext,
        m.IV,
        m.CreatedAt,
        m.EditedAt,
        m.DeletedAt,
        m.ReplyToMessageId,
        u.DisplayName AS SenderName,
        u.AvatarUrl AS SenderAvatar
      FROM dbo.Messages m
      INNER JOIN dbo.Users u ON m.SenderId = u.Id
      WHERE m.ConversationId = @ConversationId
        AND m.DeletedAt IS NULL
    `;

    const request = pool.request()
      .input('ConversationId', sql.NVarChar, conversationId);

    // Handle pagination
    if (params.before) {
      // Get messages before a specific message
      const beforeMsg = await pool.request()
        .input('MessageId', sql.NVarChar, params.before)
        .query('SELECT CreatedAt FROM dbo.Messages WHERE Id = @MessageId');

      if (beforeMsg.recordset.length > 0) {
        query += ` AND m.CreatedAt < @BeforeCreatedAt`;
        request.input('BeforeCreatedAt', sql.DateTime2, beforeMsg.recordset[0].CreatedAt);
      }
    } else if (params.after) {
      // Get messages after a specific message
      const afterMsg = await pool.request()
        .input('MessageId', sql.NVarChar, params.after)
        .query('SELECT CreatedAt FROM dbo.Messages WHERE Id = @MessageId');

      if (afterMsg.recordset.length > 0) {
        query += ` AND m.CreatedAt > @AfterCreatedAt`;
        request.input('AfterCreatedAt', sql.DateTime2, afterMsg.recordset[0].CreatedAt);
      }
    }

    query += ` ORDER BY m.CreatedAt ASC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`;

    request
      .input('Offset', sql.Int, offset)
      .input('Limit', sql.Int, limit);

    const result = await request.query(query);

    // Get total count for hasMore calculation
    const countResult = await pool.request()
      .input('ConversationId', sql.NVarChar, conversationId)
      .query(`
        SELECT COUNT(*) AS Total
        FROM dbo.Messages
        WHERE ConversationId = @ConversationId AND DeletedAt IS NULL
      `);

    const total = countResult.recordset[0]?.Total || 0;
    const hasMore = offset + result.recordset.length < total;

    // Get encryption key for this conversation
    const encryptionKey = await keyService.getConversationKey(conversationId);

    // Decrypt messages
    const decryptedMessages: Message[] = await Promise.all(
      result.recordset.map(async (row: any) => {
        let text: string;
        try {
          text = decryptMessage(row.Ciphertext, row.IV, encryptionKey);
        } catch (error) {
          console.error('Error decrypting message:', row.Id, error);
          text = '[Could not decrypt message]';
        }

        return {
          id: row.Id,
          conversationId: row.ConversationId,
          senderId: row.SenderId,
          text,
          createdAt: row.CreatedAt.toISOString(),
          editedAt: row.EditedAt?.toISOString() || null,
          deletedAt: row.DeletedAt?.toISOString() || null,
          replyToMessageId: row.ReplyToMessageId || null,
          senderName: row.SenderName || null,
          senderAvatar: row.SenderAvatar || null,
        };
      })
    );

    return {
      data: decryptedMessages,
      hasMore,
      total,
    };
  }

  /**
   * Create a new message
   */
  async createMessage(
    messageId: string,
    conversationId: string,
    senderId: string,
    payload: CreateMessagePayload
  ): Promise<Message> {
    const pool = await getDbPool();
    
    // Get encryption key for this conversation
    const encryptionKey = await keyService.getConversationKey(conversationId);
    
    // Encrypt the message
    const { ciphertext, iv } = encryptMessage(payload.text, encryptionKey);
    
    // Use a single batch query with explicit transaction
    // This works with both tedious and msnodesqlv8 drivers
    const request = pool.request();
    
    try {
      // Execute everything in a single batch with explicit transaction
      // This ensures all operations use the same connection
      const batchResult = await request
        .input('Id', sql.NVarChar, messageId)
        .input('ConversationId', sql.NVarChar, conversationId)
        .input('SenderId', sql.NVarChar, senderId)
        .input('Ciphertext', sql.NVarChar(sql.MAX), ciphertext)
        .input('IV', sql.NVarChar, iv)
        .input('CreatedAt', sql.DateTime2, new Date(payload.createdAt))
        .query(`
          BEGIN TRANSACTION;
          
          -- Check authorization
          DECLARE @IsAuthorized BIT;
          SELECT @IsAuthorized = CASE 
            WHEN EXISTS (
              SELECT 1 FROM dbo.ConversationParticipants 
              WHERE ConversationId = @ConversationId 
              AND UserId = @SenderId 
              AND LeftAt IS NULL
            ) THEN 1 ELSE 0 END;
          
          IF @IsAuthorized = 0
          BEGIN
            ROLLBACK TRANSACTION;
            THROW 50000, 'Not authorized to send messages to this conversation', 1;
          END
          
          -- Insert message
          INSERT INTO dbo.Messages (Id, ConversationId, SenderId, Ciphertext, IV, CreatedAt)
          VALUES (@Id, @ConversationId, @SenderId, @Ciphertext, @IV, @CreatedAt);
          
          -- Update conversation metadata
          UPDATE dbo.Conversations
          SET 
            LastMessageId = @Id,
            LastMessageAt = @CreatedAt,
            UpdatedAt = GETUTCDATE()
          WHERE Id = @ConversationId;
          
          COMMIT TRANSACTION;
        `);

      // Return the created message (decrypted)
      const result = await pool.request()
        .input('Id', sql.NVarChar, messageId)
        .query(`
          SELECT 
            m.Id,
            m.ConversationId,
            m.SenderId,
            m.CreatedAt,
            u.DisplayName AS SenderName,
            u.AvatarUrl AS SenderAvatar
          FROM dbo.Messages m
          INNER JOIN dbo.Users u ON m.SenderId = u.Id
          WHERE m.Id = @Id
        `);

      const row = result.recordset[0];
      return {
        id: row.Id,
        conversationId: row.ConversationId,
        senderId: row.SenderId,
        text: payload.text, // Return plaintext
        createdAt: row.CreatedAt.toISOString(),
        senderName: row.SenderName || null,
        senderAvatar: row.SenderAvatar || null,
      };
    } catch (error: any) {
      // Error is automatically rolled back by SQL Server
      // Check if it's our custom authorization error
      if (error.message?.includes('Not authorized')) {
        throw new Error('Not authorized to send messages to this conversation');
      }
      throw error;
    }
  }
}

export const messageService = new MessageService();

