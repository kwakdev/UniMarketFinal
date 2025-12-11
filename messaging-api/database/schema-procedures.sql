-- =============================================
-- Optional Stored Procedures and Views
-- 
-- NOTE: The API uses API-level logic, not stored procedures.
-- This file is optional - only use if you prefer stored procedures.
-- 
-- Run this AFTER running schema.sql
-- =============================================

-- =============================================
-- Procedure: sp_GetConversationMessages
-- Retrieves messages for a conversation with pagination
-- =============================================
GO
CREATE PROCEDURE dbo.sp_GetConversationMessages
    @ConversationId NVARCHAR(255),
    @UserId NVARCHAR(255), -- For authorization check
    @Limit INT = 50,
    @BeforeMessageId NVARCHAR(255) = NULL, -- For pagination: get messages before this ID
    @AfterMessageId NVARCHAR(255) = NULL   -- For pagination: get messages after this ID
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Verify user is a participant
    IF NOT EXISTS (
        SELECT 1 FROM dbo.ConversationParticipants 
        WHERE ConversationId = @ConversationId 
        AND UserId = @UserId 
        AND LeftAt IS NULL
    )
    BEGIN
        RAISERROR('User is not authorized to view this conversation', 16, 1);
        RETURN;
    END
    
    -- Get messages
    SELECT TOP (@Limit)
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
        AND (@BeforeMessageId IS NULL OR m.CreatedAt < (
            SELECT CreatedAt FROM dbo.Messages WHERE Id = @BeforeMessageId
        ))
        AND (@AfterMessageId IS NULL OR m.CreatedAt > (
            SELECT CreatedAt FROM dbo.Messages WHERE Id = @AfterMessageId
        ))
    ORDER BY m.CreatedAt DESC;
END
GO

-- =============================================
-- Procedure: sp_CreateMessage
-- Creates a new message and updates conversation metadata
-- =============================================
GO
CREATE PROCEDURE dbo.sp_CreateMessage
    @Id NVARCHAR(255),
    @ConversationId NVARCHAR(255),
    @SenderId NVARCHAR(255),
    @Ciphertext NVARCHAR(MAX),
    @IV NVARCHAR(255),
    @CreatedAt DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Verify user is a participant
        IF NOT EXISTS (
            SELECT 1 FROM dbo.ConversationParticipants 
            WHERE ConversationId = @ConversationId 
            AND UserId = @SenderId 
            AND LeftAt IS NULL
        )
        BEGIN
            RAISERROR('User is not authorized to send messages to this conversation', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END
        
        -- Insert message
        INSERT INTO dbo.Messages (Id, ConversationId, SenderId, Ciphertext, IV, CreatedAt)
        VALUES (
            @Id,
            @ConversationId,
            @SenderId,
            @Ciphertext,
            @IV,
            ISNULL(@CreatedAt, GETUTCDATE())
        );
        
        -- Update conversation metadata
        UPDATE dbo.Conversations
        SET 
            LastMessageId = @Id,
            LastMessageAt = ISNULL(@CreatedAt, GETUTCDATE()),
            UpdatedAt = GETUTCDATE()
        WHERE Id = @ConversationId;
        
        -- Return the created message
        SELECT 
            m.Id,
            m.ConversationId,
            m.SenderId,
            m.Ciphertext,
            m.IV,
            m.CreatedAt,
            u.DisplayName AS SenderName,
            u.AvatarUrl AS SenderAvatar
        FROM dbo.Messages m
        INNER JOIN dbo.Users u ON m.SenderId = u.Id
        WHERE m.Id = @Id;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- =============================================
-- Procedure: sp_GetUserConversations
-- Gets all conversations for a user
-- =============================================
GO
CREATE PROCEDURE dbo.sp_GetUserConversations
    @UserId NVARCHAR(255),
    @Limit INT = 20,
    @Offset INT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        c.Id,
        c.Name,
        c.Type,
        c.CreatedAt,
        c.UpdatedAt,
        c.LastMessageId,
        c.LastMessageAt,
        -- Get other participants (for direct messages)
        (
            SELECT TOP 1 
                u2.Id,
                u2.DisplayName,
                u2.AvatarUrl
            FROM dbo.ConversationParticipants cp2
            INNER JOIN dbo.Users u2 ON cp2.UserId = u2.Id
            WHERE cp2.ConversationId = c.Id
                AND cp2.UserId != @UserId
                AND cp2.LeftAt IS NULL
            ORDER BY cp2.JoinedAt
        ) AS OtherParticipant,
        -- Get last message preview (optional - you might want to decrypt this)
        m.CreatedAt AS LastMessageCreatedAt
    FROM dbo.Conversations c
    INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
    LEFT JOIN dbo.Messages m ON c.LastMessageId = m.Id
    WHERE cp.UserId = @UserId
        AND cp.LeftAt IS NULL
    ORDER BY c.LastMessageAt DESC, c.UpdatedAt DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limit ROWS ONLY;
    
    -- Get total count
    SELECT COUNT(*) AS Total
    FROM dbo.Conversations c
    INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
    WHERE cp.UserId = @UserId
        AND cp.LeftAt IS NULL;
END
GO

-- =============================================
-- View: v_ConversationParticipants
-- Shows active participants for each conversation
-- =============================================
GO
CREATE VIEW dbo.v_ConversationParticipants
AS
SELECT 
    cp.ConversationId,
    cp.UserId,
    u.DisplayName,
    u.AvatarUrl,
    cp.JoinedAt,
    cp.Role
FROM dbo.ConversationParticipants cp
INNER JOIN dbo.Users u ON cp.UserId = u.Id
WHERE cp.LeftAt IS NULL;
GO

