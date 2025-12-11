import sql from 'mssql';
import { getDbPool } from '../config/database';
import { Conversation, Participant } from '../types';

export class ConversationService {
  /**
   * Get all conversations for a user
   */
  async getUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ conversations: Conversation[]; total: number }> {
    const pool = await getDbPool();

    const result = await pool.request()
      .input('UserId', sql.NVarChar, userId)
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset)
      .query(`
        SELECT 
          c.Id,
          c.Name,
          c.Type,
          c.CreatedAt,
          c.UpdatedAt,
          c.LastMessageId,
          c.LastMessageAt
        FROM dbo.Conversations c
        INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
        WHERE cp.UserId = @UserId
          AND cp.LeftAt IS NULL
        ORDER BY c.LastMessageAt DESC, c.UpdatedAt DESC
        OFFSET @Offset ROWS
        FETCH NEXT @Limit ROWS ONLY
      `);

    // Get total count
    const countResult = await pool.request()
      .input('UserId', sql.NVarChar, userId)
      .query(`
        SELECT COUNT(*) AS Total
        FROM dbo.Conversations c
        INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
        WHERE cp.UserId = @UserId
          AND cp.LeftAt IS NULL
      `);

    const total = countResult.recordset[0]?.Total || 0;

    // Get other participant info for each conversation
    const conversations: Conversation[] = await Promise.all(
      result.recordset.map(async (row: any) => {
        // Get other participant for direct messages
        const participantResult = await pool.request()
          .input('ConversationId', sql.NVarChar, row.Id)
          .input('UserId', sql.NVarChar, userId)
          .query(`
            SELECT TOP 1
              u.Id,
              u.DisplayName,
              u.AvatarUrl
            FROM dbo.ConversationParticipants cp
            INNER JOIN dbo.Users u ON cp.UserId = u.Id
            WHERE cp.ConversationId = @ConversationId
              AND cp.UserId != @UserId
              AND cp.LeftAt IS NULL
            ORDER BY cp.JoinedAt
          `);

        const otherParticipant: Participant | undefined = participantResult.recordset[0]
          ? {
              id: participantResult.recordset[0].Id,
              displayName: participantResult.recordset[0].DisplayName || null,
              avatarUrl: participantResult.recordset[0].AvatarUrl || null,
            }
          : undefined;

        return {
          id: row.Id,
          name: row.Name || null,
          type: row.Type,
          createdAt: row.CreatedAt.toISOString(),
          updatedAt: row.UpdatedAt.toISOString(),
          lastMessageId: row.LastMessageId || null,
          lastMessageAt: row.LastMessageAt?.toISOString() || null,
          otherParticipant,
        };
      })
    );

    return { conversations, total };
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    conversationId: string,
    creatorId: string,
    name?: string,
    type: number = 1,
    participantIds: string[] = []
  ): Promise<Conversation> {
    const pool = await getDbPool();
    const request = pool.request();

    try {
      // Use a single batch query with explicit transaction
      // This works with both tedious and msnodesqlv8 drivers
      const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId)];
      
      // Build the SQL batch for all operations
      let sqlBatch = `
        BEGIN TRANSACTION;
        
        -- Create/ensure creator user exists
        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @CreatorId)
        BEGIN
          INSERT INTO dbo.Users (Id, Username, DisplayName)
          VALUES (@CreatorId, @CreatorId, @CreatorId);
        END
      `;

      // Add participants that need to be created
      for (let i = 0; i < allParticipants.length; i++) {
        const pid = allParticipants[i];
        if (pid !== creatorId) {
          sqlBatch += `
            IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @ParticipantId${i})
            BEGIN
              INSERT INTO dbo.Users (Id, Username, DisplayName)
              VALUES (@ParticipantId${i}, @ParticipantId${i}, @ParticipantId${i});
            END
          `;
        }
      }

      // Create conversation
      sqlBatch += `
        INSERT INTO dbo.Conversations (Id, Name, Type)
        VALUES (@ConversationId, @Name, @Type);
      `;

      // Add all participants
      for (let i = 0; i < allParticipants.length; i++) {
        sqlBatch += `
          INSERT INTO dbo.ConversationParticipants (ConversationId, UserId, Role)
          VALUES (@ConversationId, @ParticipantId${i}, 1);
        `;
      }

      sqlBatch += `COMMIT TRANSACTION;`;

      // Set up all inputs
      request.input('ConversationId', sql.NVarChar, conversationId);
      request.input('CreatorId', sql.NVarChar, creatorId);
      request.input('Name', sql.NVarChar, name || null);
      request.input('Type', sql.TinyInt, type);
      
      for (let i = 0; i < allParticipants.length; i++) {
        request.input(`ParticipantId${i}`, sql.NVarChar, allParticipants[i]);
      }

      await request.query(sqlBatch);

      // Return the created conversation
      return await this.getConversation(conversationId, creatorId);
    } catch (error: any) {
      // Error is automatically rolled back by SQL Server
      // Check for duplicate key errors
      if (error.message?.includes('PRIMARY KEY') || error.message?.includes('UNIQUE')) {
        throw new Error('Conversation already exists');
      }
      throw error;
    }
  }

  /**
   * Get conversation details
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation> {
    const pool = await getDbPool();

    // Check authorization
    const authCheck = await pool.request()
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

    if (authCheck.recordset[0]?.IsAuthorized !== 1) {
      throw new Error('Not authorized to view this conversation');
    }

    // Get conversation
    const result = await pool.request()
      .input('ConversationId', sql.NVarChar, conversationId)
      .query(`
        SELECT 
          Id,
          Name,
          Type,
          CreatedAt,
          UpdatedAt,
          LastMessageId,
          LastMessageAt
        FROM dbo.Conversations
        WHERE Id = @ConversationId
      `);

    if (result.recordset.length === 0) {
      throw new Error('Conversation not found');
    }

    const row = result.recordset[0];

    // Get participants
    const participantsResult = await pool.request()
      .input('ConversationId', sql.NVarChar, conversationId)
      .query(`
        SELECT 
          u.Id,
          u.DisplayName,
          u.AvatarUrl,
          cp.Role,
          cp.JoinedAt
        FROM dbo.ConversationParticipants cp
        INNER JOIN dbo.Users u ON cp.UserId = u.Id
        WHERE cp.ConversationId = @ConversationId
          AND cp.LeftAt IS NULL
      `);

    const participants: Participant[] = participantsResult.recordset.map((p: any) => ({
      id: p.Id,
      displayName: p.DisplayName || null,
      avatarUrl: p.AvatarUrl || null,
      role: p.Role,
      joinedAt: p.JoinedAt.toISOString(),
    }));

    return {
      id: row.Id,
      name: row.Name || null,
      type: row.Type,
      createdAt: row.CreatedAt.toISOString(),
      updatedAt: row.UpdatedAt.toISOString(),
      lastMessageId: row.LastMessageId || null,
      lastMessageAt: row.LastMessageAt?.toISOString() || null,
      participants,
    };
  }
}

export const conversationService = new ConversationService();

