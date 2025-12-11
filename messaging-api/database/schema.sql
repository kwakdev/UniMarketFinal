-- =============================================
-- Messaging System Database Schema
-- SQL Server Database Schema
-- =============================================

-- =============================================
-- Table: Users
-- Stores user information
-- =============================================
CREATE TABLE dbo.Users (
    Id NVARCHAR(255) NOT NULL PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NULL,
    DisplayName NVARCHAR(255) NULL,
    AvatarUrl NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    IsActive BIT NOT NULL DEFAULT 1,
    
    INDEX IX_Users_Username (Username),
    INDEX IX_Users_Email (Email) WHERE Email IS NOT NULL
);

-- =============================================
-- Table: Conversations
-- Stores conversation metadata
-- =============================================
CREATE TABLE dbo.Conversations (
    Id NVARCHAR(255) NOT NULL PRIMARY KEY,
    Name NVARCHAR(255) NULL, -- Optional: for group chats
    Type TINYINT NOT NULL DEFAULT 1, -- 1 = Direct, 2 = Group
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastMessageId NVARCHAR(255) NULL,
    LastMessageAt DATETIME2 NULL,
    EncryptionKey NVARCHAR(MAX) NULL, -- Server-side encryption key for this conversation
    
    INDEX IX_Conversations_UpdatedAt (UpdatedAt DESC),
    INDEX IX_Conversations_LastMessageAt (LastMessageAt DESC)
);

-- =============================================
-- Table: ConversationParticipants
-- Many-to-many relationship between Users and Conversations
-- =============================================
CREATE TABLE dbo.ConversationParticipants (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ConversationId NVARCHAR(255) NOT NULL,
    UserId NVARCHAR(255) NOT NULL,
    JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LeftAt DATETIME2 NULL, -- NULL if still active participant
    Role TINYINT NOT NULL DEFAULT 1, -- 1 = Member, 2 = Admin
    
    CONSTRAINT FK_ConversationParticipants_Conversation 
        FOREIGN KEY (ConversationId) REFERENCES dbo.Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ConversationParticipants_User 
        FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    
    CONSTRAINT UQ_ConversationParticipants_ConversationUser 
        UNIQUE (ConversationId, UserId),
    
    INDEX IX_ConversationParticipants_ConversationId (ConversationId),
    INDEX IX_ConversationParticipants_UserId (UserId),
    INDEX IX_ConversationParticipants_Active (ConversationId, UserId, LeftAt) 
        WHERE LeftAt IS NULL
);

-- =============================================
-- Table: Messages
-- Stores encrypted messages
-- =============================================
CREATE TABLE dbo.Messages (
    Id NVARCHAR(255) NOT NULL PRIMARY KEY,
    ConversationId NVARCHAR(255) NOT NULL,
    SenderId NVARCHAR(255) NOT NULL,
    Ciphertext NVARCHAR(MAX) NOT NULL, -- Base64-encoded encrypted message
    IV NVARCHAR(255) NOT NULL, -- Base64-encoded initialization vector
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    -- Optional: for message editing/deletion
    EditedAt DATETIME2 NULL,
    DeletedAt DATETIME2 NULL,
    ReplyToMessageId NVARCHAR(255) NULL, -- For threaded replies
    
    CONSTRAINT FK_Messages_Conversation 
        FOREIGN KEY (ConversationId) REFERENCES dbo.Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Messages_Sender 
        FOREIGN KEY (SenderId) REFERENCES dbo.Users(Id) ON DELETE NO ACTION,
    CONSTRAINT FK_Messages_ReplyTo 
        FOREIGN KEY (ReplyToMessageId) REFERENCES dbo.Messages(Id) ON DELETE NO ACTION,
    
    INDEX IX_Messages_ConversationId_CreatedAt (ConversationId, CreatedAt DESC),
    INDEX IX_Messages_SenderId (SenderId),
    INDEX IX_Messages_CreatedAt (CreatedAt DESC),
    INDEX IX_Messages_NotDeleted (ConversationId, CreatedAt DESC) 
        WHERE DeletedAt IS NULL
);

-- =============================================
-- Table: MessageReads (Optional)
-- Tracks which users have read which messages
-- =============================================
CREATE TABLE dbo.MessageReads (
    Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    MessageId NVARCHAR(255) NOT NULL,
    UserId NVARCHAR(255) NOT NULL,
    ReadAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_MessageReads_Message 
        FOREIGN KEY (MessageId) REFERENCES dbo.Messages(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MessageReads_User 
        FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    
    CONSTRAINT UQ_MessageReads_MessageUser 
        UNIQUE (MessageId, UserId),
    
    INDEX IX_MessageReads_MessageId (MessageId),
    INDEX IX_MessageReads_UserId (UserId)
);

-- =============================================
-- Notes
-- =============================================
/*
IMPORTANT NOTES:

1. ENCRYPTION:
   - Messages are encrypted SERVER-SIDE before being stored
   - The server encrypts plaintext messages using conversation-specific keys
   - Ciphertext and IV are Base64-encoded strings
   - EncryptionKey column stores the conversation encryption key

2. INDEXES:
   - Indexes are optimized for common queries:
     * Getting messages for a conversation (ordered by time)
     * Finding conversations for a user
     * Checking if user is a participant

3. PERFORMANCE:
   - Consider partitioning Messages table by ConversationId for large datasets
   - Consider archiving old messages to a separate table
   - Monitor index usage and adjust as needed

4. SECURITY:
   - Always verify user authorization in API code
   - Use parameterized queries to prevent SQL injection
   - Consider row-level security for multi-tenant scenarios

5. SCALING:
   - For high-volume systems, consider:
     * Message sharding by conversation ID
     * Read replicas for message retrieval
     * Caching frequently accessed conversations

6. DATA TYPES:
   - NVARCHAR(255) for IDs to support UUIDs and custom IDs
   - NVARCHAR(MAX) for ciphertext to handle large encrypted messages
   - DATETIME2 for precise timestamps with timezone support

7. SOFT DELETES:
   - Messages use DeletedAt for soft deletes
   - Consider purging old deleted messages periodically

8. STORED PROCEDURES:
   - This API uses API-level logic (not stored procedures)
   - If you want stored procedures, see schema-procedures.sql (optional)
   - See API_QUERIES.md for example SQL queries used in the API
*/
