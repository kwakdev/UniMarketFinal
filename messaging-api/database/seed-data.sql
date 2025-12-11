-- =============================================
-- Seed Data for Messaging System
-- This script sets up demo data for testing
-- =============================================

-- =============================================
-- Demo User: user-123
-- =============================================
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = 'user-123')
BEGIN
    INSERT INTO dbo.Users (Id, Username, DisplayName, Email)
    VALUES ('user-123', 'demo-user', 'Demo User', 'demo@example.com');
    PRINT 'Created user: user-123';
END
ELSE
BEGIN
    PRINT 'User user-123 already exists';
END

-- =============================================
-- Demo Conversation: demo-conversation
-- =============================================
IF NOT EXISTS (SELECT 1 FROM dbo.Conversations WHERE Id = 'demo-conversation')
BEGIN
    INSERT INTO dbo.Conversations (Id, Type, Name)
    VALUES ('demo-conversation', 1, 'Demo Conversation');
    PRINT 'Created conversation: demo-conversation';
END
ELSE
BEGIN
    PRINT 'Conversation demo-conversation already exists';
END

-- =============================================
-- Add user-123 to demo-conversation
-- =============================================
IF NOT EXISTS (
    SELECT 1 FROM dbo.ConversationParticipants 
    WHERE ConversationId = 'demo-conversation' 
    AND UserId = 'user-123'
)
BEGIN
    INSERT INTO dbo.ConversationParticipants (ConversationId, UserId, Role)
    VALUES ('demo-conversation', 'user-123', 1);
    PRINT 'Added user-123 as participant in demo-conversation';
END
ELSE
BEGIN
    -- If participant exists but has left, reactivate them
    UPDATE dbo.ConversationParticipants
    SET LeftAt = NULL
    WHERE ConversationId = 'demo-conversation' 
    AND UserId = 'user-123'
    AND LeftAt IS NOT NULL;
    
    IF @@ROWCOUNT > 0
    BEGIN
        PRINT 'Reactivated user-123 as participant in demo-conversation';
    END
    ELSE
    BEGIN
        PRINT 'User user-123 is already an active participant in demo-conversation';
    END
END

-- =============================================
-- Additional Demo Users (Optional)
-- Uncomment and modify as needed for multi-user testing
-- =============================================

/*
-- Demo User: user-456
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = 'user-456')
BEGIN
    INSERT INTO dbo.Users (Id, Username, DisplayName, Email)
    VALUES ('user-456', 'user-456', 'User 456', 'user456@example.com');
    PRINT 'Created user: user-456';
END

-- Add user-456 to demo-conversation
IF NOT EXISTS (
    SELECT 1 FROM dbo.ConversationParticipants 
    WHERE ConversationId = 'demo-conversation' 
    AND UserId = 'user-456'
)
BEGIN
    INSERT INTO dbo.ConversationParticipants (ConversationId, UserId, Role)
    VALUES ('demo-conversation', 'user-456', 1);
    PRINT 'Added user-456 to demo-conversation';
END
ELSE
BEGIN
    UPDATE dbo.ConversationParticipants
    SET LeftAt = NULL
    WHERE ConversationId = 'demo-conversation' 
    AND UserId = 'user-456'
    AND LeftAt IS NOT NULL;
    
    IF @@ROWCOUNT > 0
        PRINT 'Reactivated user-456 in demo-conversation';
    ELSE
        PRINT 'User user-456 is already an active participant';
END
*/

-- =============================================
-- Helper: Add Any User to Conversation
-- Usage: Set @UserId and @ConversationId variables below
-- =============================================

/*
DECLARE @UserId NVARCHAR(255) = 'user-456'; -- Change this to the user ID you want to add
DECLARE @ConversationId NVARCHAR(255) = 'demo-conversation'; -- Change this to the conversation ID

-- Create user if doesn't exist
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Id = @UserId)
BEGIN
    INSERT INTO dbo.Users (Id, Username, DisplayName)
    VALUES (@UserId, @UserId, @UserId);
    PRINT 'Created user: ' + @UserId;
END
ELSE
BEGIN
    PRINT 'User ' + @UserId + ' already exists';
END

-- Add user to conversation
IF NOT EXISTS (
    SELECT 1 FROM dbo.ConversationParticipants 
    WHERE ConversationId = @ConversationId 
    AND UserId = @UserId
)
BEGIN
    INSERT INTO dbo.ConversationParticipants (ConversationId, UserId, Role)
    VALUES (@ConversationId, @UserId, 1);
    PRINT 'Added ' + @UserId + ' to ' + @ConversationId;
END
ELSE
BEGIN
    -- Reactivate if they left
    UPDATE dbo.ConversationParticipants
    SET LeftAt = NULL
    WHERE ConversationId = @ConversationId 
    AND UserId = @UserId
    AND LeftAt IS NOT NULL;
    
    IF @@ROWCOUNT > 0
        PRINT 'Reactivated ' + @UserId + ' in ' + @ConversationId;
    ELSE
        PRINT @UserId + ' is already an active participant in ' + @ConversationId;
END
*/

PRINT 'Seed data setup complete!';

