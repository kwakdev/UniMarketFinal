# SQL Queries for API Implementation

This document provides SQL queries you can use directly in your API instead of stored procedures.

**Note:** The API currently uses API-level logic (not stored procedures). These queries are already implemented in the service files.

## Table of Contents

- [Get Messages](#get-messages)
- [Create Message](#create-message)
- [Get User Conversations](#get-user-conversations)
- [Check Authorization](#check-authorization)
- [Update Conversation Metadata](#update-conversation-metadata)

## Get Messages

### Basic Query

```sql
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
ORDER BY m.CreatedAt DESC
OFFSET @Offset ROWS
FETCH NEXT @Limit ROWS ONLY;
```

**Note:** The server decrypts messages before returning them to clients. The API returns plaintext, not ciphertext.

### With Authorization Check

```sql
-- First check if user is a participant
IF EXISTS (
    SELECT 1 FROM dbo.ConversationParticipants 
    WHERE ConversationId = @ConversationId 
    AND UserId = @UserId 
    AND LeftAt IS NULL
)
BEGIN
    -- User is authorized, get messages
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
    WHERE m.ConversationId = @ConversationId
        AND m.DeletedAt IS NULL
    ORDER BY m.CreatedAt DESC
    OFFSET @Offset ROWS
    FETCH NEXT @Limit ROWS ONLY;
END
ELSE
BEGIN
    -- User not authorized
    SELECT NULL AS Id;
END
```

### Pagination: Get Messages Before a Message ID

```sql
SELECT 
    m.Id,
    m.ConversationId,
    m.SenderId,
    m.Ciphertext,
    m.IV,
    m.CreatedAt
FROM dbo.Messages m
WHERE m.ConversationId = @ConversationId
    AND m.DeletedAt IS NULL
    AND m.CreatedAt < (
        SELECT CreatedAt FROM dbo.Messages WHERE Id = @BeforeMessageId
    )
ORDER BY m.CreatedAt DESC
FETCH NEXT @Limit ROWS ONLY;
```

### Pagination: Get Messages After a Message ID

```sql
SELECT 
    m.Id,
    m.ConversationId,
    m.SenderId,
    m.Ciphertext,
    m.IV,
    m.CreatedAt
FROM dbo.Messages m
WHERE m.ConversationId = @ConversationId
    AND m.DeletedAt IS NULL
    AND m.CreatedAt > (
        SELECT CreatedAt FROM dbo.Messages WHERE Id = @AfterMessageId
    )
ORDER BY m.CreatedAt ASC
FETCH NEXT @Limit ROWS ONLY;
```

## Create Message

**Note:** The API receives plaintext messages and encrypts them server-side before storage.

### Simple Insert

```sql
INSERT INTO dbo.Messages (Id, ConversationId, SenderId, Ciphertext, IV, CreatedAt)
VALUES (@Id, @ConversationId, @SenderId, @Ciphertext, @IV, @CreatedAt);
```

### Insert with Transaction and Authorization

```sql
BEGIN TRANSACTION;

BEGIN TRY
    -- Check authorization
    IF NOT EXISTS (
        SELECT 1 FROM dbo.ConversationParticipants 
        WHERE ConversationId = @ConversationId 
        AND UserId = @SenderId 
        AND LeftAt IS NULL
    )
    BEGIN
        RAISERROR('User is not authorized to send messages', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
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
```

## Get User Conversations

### Basic Query

```sql
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
FETCH NEXT @Limit ROWS ONLY;
```

### With Other Participant Info (for Direct Messages)

```sql
SELECT 
    c.Id,
    c.Name,
    c.Type,
    c.CreatedAt,
    c.UpdatedAt,
    c.LastMessageId,
    c.LastMessageAt,
    -- Get other participant for direct messages
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
        FOR JSON PATH
    ) AS OtherParticipant
FROM dbo.Conversations c
INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
WHERE cp.UserId = @UserId
    AND cp.LeftAt IS NULL
ORDER BY c.LastMessageAt DESC, c.UpdatedAt DESC
OFFSET @Offset ROWS
FETCH NEXT @Limit ROWS ONLY;
```

### Get Total Count

```sql
SELECT COUNT(*) AS Total
FROM dbo.Conversations c
INNER JOIN dbo.ConversationParticipants cp ON c.Id = cp.ConversationId
WHERE cp.UserId = @UserId
    AND cp.LeftAt IS NULL;
```

## Check Authorization

### Check if User is Participant

```sql
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM dbo.ConversationParticipants 
            WHERE ConversationId = @ConversationId 
            AND UserId = @UserId 
            AND LeftAt IS NULL
        ) THEN 1 
        ELSE 0 
    END AS IsAuthorized;
```

### Get Participant Info

```sql
SELECT 
    cp.UserId,
    cp.Role,
    cp.JoinedAt,
    u.DisplayName,
    u.AvatarUrl
FROM dbo.ConversationParticipants cp
INNER JOIN dbo.Users u ON cp.UserId = u.Id
WHERE cp.ConversationId = @ConversationId
    AND cp.LeftAt IS NULL;
```

## Update Conversation Metadata

### Update Last Message

```sql
UPDATE dbo.Conversations
SET 
    LastMessageId = @MessageId,
    LastMessageAt = @MessageCreatedAt,
    UpdatedAt = GETUTCDATE()
WHERE Id = @ConversationId;
```

## Best Practices

1. **Always Use Parameterized Queries** - Prevents SQL injection
2. **Check Authorization First** - Verify user permissions before data access
3. **Use Transactions** - For operations that modify multiple tables
4. **Handle Errors Gracefully** - Rollback transactions on errors
5. **Use Indexes** - The schema includes indexes, make sure your queries use them
6. **Limit Results** - Always use LIMIT/OFFSET or FETCH NEXT to prevent large result sets

## Performance Tips

1. **Use OFFSET/FETCH** - For pagination (SQL Server 2012+)
2. **Filter Early** - Use WHERE clauses to filter before JOINs
3. **Select Only Needed Columns** - Don't use SELECT *
4. **Monitor Query Plans** - Use SQL Server Management Studio to analyze performance

## Implementation

The API already implements these patterns in:
- `src/services/messageService.ts` - Message operations
- `src/services/conversationService.ts` - Conversation operations
- `src/services/userService.ts` - User operations

All queries use parameterized inputs via the `mssql` library to prevent SQL injection.

