# Database Schema Documentation

This directory contains the SQL Server database schema and scripts for the messaging system.

## Files

- **schema.sql** - Main database schema with tables and indexes (required)
- **schema-procedures.sql** - Optional stored procedures and views (only if you prefer stored procedures)
- **seed-data.sql** - Script to seed demo data (users, conversations, participants)
- **API_QUERIES.md** - SQL queries used in the API (for reference)
- **SETUP_DEMO.md** - Guide for setting up demo data

## Quick Start

### 1. Create the Database

```sql
CREATE DATABASE MessagingDB;
GO

USE MessagingDB;
GO
```

### 2. Run the Schema Script

**Required - Run this first:**
```bash
sqlcmd -S localhost -d MessagingDB -i schema.sql
```

**Optional - Only if you want stored procedures:**
```bash
sqlcmd -S localhost -d MessagingDB -i schema-procedures.sql
```

**Note:** The API uses API-level logic (not stored procedures), so `schema-procedures.sql` is optional and only needed if you want to use stored procedures for your own purposes.

### 3. Seed Demo Data (Optional)

```bash
sqlcmd -S localhost -d MessagingDB -i seed-data.sql
```

This creates:
- Demo user (`user-123`)
- Demo conversation (`demo-conversation`)
- Links user to conversation

**To add more users:**
- Uncomment the `user-456` section in `seed-data.sql` for multi-user testing
- Or use the helper section at the bottom of `seed-data.sql` to add any user to any conversation
- Or use the API endpoints: `POST /api/users` and add participants via `POST /api/conversations`

### 4. Verify Installation

```sql
-- Check tables were created
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME;

-- Should show:
-- Conversations
-- ConversationParticipants
-- MessageReads
-- Messages
-- Users

-- Verify demo data
SELECT * FROM dbo.Users WHERE Id = 'user-123';
SELECT * FROM dbo.Conversations WHERE Id = 'demo-conversation';
SELECT * FROM dbo.ConversationParticipants 
WHERE ConversationId = 'demo-conversation' AND UserId = 'user-123';
```

## Schema Overview

### Core Tables

#### Users
Stores user information. Users can be created via the API (`POST /api/users`) or manually.

**Columns:**
- `Id` - Primary key (NVARCHAR(255))
- `Username` - Unique username (NVARCHAR(100))
- `Email` - Optional email address
- `DisplayName` - Optional display name
- `AvatarUrl` - Optional avatar URL
- `CreatedAt`, `UpdatedAt` - Timestamps
- `IsActive` - Soft delete flag

#### Conversations
Stores conversation metadata:
- Direct messages (1-on-1)
- Group chats
- Tracks last message for sorting
- **EncryptionKey**: Stores server-side encryption key for the conversation

**Columns:**
- `Id` - Primary key (NVARCHAR(255))
- `Name` - Optional conversation name (for group chats)
- `Type` - Conversation type (1 = Direct, 2 = Group)
- `LastMessageId`, `LastMessageAt` - For sorting conversations
- `EncryptionKey` - Server-side encryption key (NVARCHAR(MAX))

#### ConversationParticipants
Many-to-many relationship between users and conversations:
- Tracks when users joined/left
- Supports roles (Member, Admin)
- Soft delete via `LeftAt` field

**Columns:**
- `Id` - Primary key (BIGINT IDENTITY)
- `ConversationId` - Foreign key to Conversations
- `UserId` - Foreign key to Users
- `JoinedAt` - When user joined
- `LeftAt` - When user left (NULL = active)
- `Role` - User role (1 = Member, 2 = Admin)

#### Messages
Stores encrypted messages:
- `Ciphertext`: Base64-encoded encrypted message (NVARCHAR(MAX))
- `IV`: Base64-encoded initialization vector
- Supports editing and deletion (soft delete)
- Supports threaded replies

**Note:** Messages are encrypted **server-side** before storage. The server handles all encryption/decryption.

**Columns:**
- `Id` - Primary key (NVARCHAR(255))
- `ConversationId` - Foreign key to Conversations
- `SenderId` - Foreign key to Users
- `Ciphertext` - Encrypted message (NVARCHAR(MAX))
- `IV` - Initialization vector
- `CreatedAt`, `EditedAt`, `DeletedAt` - Timestamps
- `ReplyToMessageId` - For threaded replies

#### MessageReads (Optional)
Tracks read receipts - which users have read which messages.

**Columns:**
- `Id` - Primary key (BIGINT IDENTITY)
- `MessageId` - Foreign key to Messages
- `UserId` - Foreign key to Users
- `ReadAt` - When message was read

## Seed Data

The `seed-data.sql` script provides:

1. **Basic Demo Setup:**
   - Creates `user-123` (demo user)
   - Creates `demo-conversation` (demo conversation)
   - Links user to conversation

2. **Multi-User Support:**
   - Commented-out section to add `user-456` for testing
   - Can be uncommented for multi-user scenarios

3. **Helper Function:**
   - Commented-out helper section to add any user to any conversation
   - Just set the `@UserId` and `@ConversationId` variables

**Usage Examples:**

```bash
# Basic seeding
sqlcmd -S localhost -d MessagingDB -i seed-data.sql

# Or use API endpoints instead:
# Register user
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"id": "user-123", "username": "demo-user", "displayName": "Demo User"}'

# Create conversation (auto-creates user if needed)
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{"conversationId": "demo-conversation", "name": "Demo Conversation"}'
```

## Stored Procedures (Optional)

**Note:** The API uses API-level logic, not stored procedures. The stored procedures in `schema-procedures.sql` are optional and only provided if you want to use them for your own purposes.

If you want to use stored procedures, see `schema-procedures.sql` which includes:
- `sp_GetConversationMessages` - Retrieves messages with pagination
- `sp_CreateMessage` - Creates a message and updates conversation metadata
- `sp_GetUserConversations` - Gets all conversations for a user
- `v_ConversationParticipants` - View of active participants

**The API implementation:**
- Uses API-level logic (see `src/services/` for implementation)
- All queries are parameterized to prevent SQL injection
- Business logic is in TypeScript, not T-SQL
- See [API_QUERIES.md](./API_QUERIES.md) for the SQL queries used in the API

## Encryption

**Server-Side Encryption:**
- Messages are encrypted on the server before storage
- Each conversation has an `EncryptionKey` stored in the `Conversations` table
- Keys are derived from `MASTER_ENCRYPTION_KEY` (recommended) or generated deterministically
- The server handles all encryption/decryption - clients send/receive plaintext

**Key Management:**
- Set `MASTER_ENCRYPTION_KEY` in environment variables for production
- Keys are derived per conversation using HMAC-SHA256
- Same conversation always gets the same key (deterministic)
- Supports key rotation by changing `MASTER_ENCRYPTION_KEY`

For encryption implementation details, see the API README: [../README.md](../README.md#encryption-configuration)

## Integration with Backend

The API uses API-level logic (not stored procedures). See the service files:
- `src/services/messageService.ts` - Message operations (encrypt/decrypt)
- `src/services/conversationService.ts` - Conversation operations
- `src/services/userService.ts` - User operations (create, get, update, search)
- `src/services/keyService.ts` - Encryption key management

All services use parameterized queries via the `mssql` library to prevent SQL injection.

## Indexes

The schema includes optimized indexes for common queries:

1. **Messages by Conversation** - `IX_Messages_ConversationId_CreatedAt`
   - Optimized for retrieving messages in chronological order

2. **Active Participants** - `IX_ConversationParticipants_Active`
   - Filtered index for active participants only (WHERE LeftAt IS NULL)

3. **Conversation Updates** - `IX_Conversations_UpdatedAt`
   - For sorting conversations by most recent activity

4. **User Lookups** - `IX_Users_Username`, `IX_Users_Email`
   - For user search and authentication

5. **Message Filtering** - `IX_Messages_NotDeleted`
   - Filtered index for non-deleted messages only

## Performance Considerations

### For Large Datasets

1. **Partitioning**: Consider partitioning the Messages table by ConversationId
2. **Archiving**: Archive old messages to a separate table
3. **Read Replicas**: Use read replicas for message retrieval queries
4. **Caching**: Cache frequently accessed conversations and user data

### Monitoring

Monitor these queries:
- Message retrieval performance
- Conversation list loading
- Participant checks
- User search operations

Use SQL Server's Query Store or Extended Events to identify slow queries.

## Security

1. **Authorization**: All API endpoints verify user authorization before data access
2. **Parameterized Queries**: Always use parameterized queries (API uses mssql with parameterized queries)
3. **Row-Level Security**: Consider implementing RLS for multi-tenant scenarios
4. **Encryption at Rest**: Enable TDE (Transparent Data Encryption) for sensitive data
5. **Encryption in Transit**: Use TLS/SSL for database connections
6. **Key Management**: Store `MASTER_ENCRYPTION_KEY` securely (use Azure Key Vault, AWS KMS, etc.)

## Migration Strategy

### If you already have a Users table:

1. Remove the Users table creation from `schema.sql`
2. Update foreign key references to point to your existing Users table
3. Adjust column names/types to match your existing schema
4. Ensure your Users table has compatible columns (Id, Username, etc.)

### Adding to existing database:

1. Run only the table creation statements you need
2. Adjust foreign key constraints if needed
3. Update indexes based on your query patterns

## Backup and Recovery

- **Regular full backups** - Daily or weekly depending on data volume
- **Transaction log backups** - For point-in-time recovery (every 15 minutes recommended)
- **Test restore procedures** - Regularly test your backup/restore process
- **Backup encryption** - Encrypt backups for sensitive data

## Maintenance

### Regular Tasks

1. **Index Maintenance**: Rebuild/reorganize indexes weekly
   ```sql
   ALTER INDEX ALL ON dbo.Messages REBUILD;
   ALTER INDEX ALL ON dbo.Conversations REBUILD;
   ```

2. **Statistics Update**: Update statistics regularly
   ```sql
   UPDATE STATISTICS dbo.Messages;
   UPDATE STATISTICS dbo.Conversations;
   ```

3. **Cleanup**: Archive or delete old soft-deleted messages
   ```sql
   -- Archive messages deleted more than 90 days ago
   -- (Implement based on your retention policy)
   ```

4. **Monitor Growth**: Track table sizes and plan for growth
   ```sql
   SELECT 
       t.name AS TableName,
       s.name AS SchemaName,
       p.rows AS RowCounts,
       SUM(a.total_pages) * 8 AS TotalSpaceKB
   FROM sys.tables t
   INNER JOIN sys.indexes i ON t.object_id = i.object_id
   INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
   INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
   LEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id
   WHERE t.name IN ('Users', 'Conversations', 'Messages', 'ConversationParticipants')
   GROUP BY t.name, s.name, p.rows
   ORDER BY TotalSpaceKB DESC;
   ```

## Troubleshooting

### Common Issues

1. **Slow Message Retrieval**
   - Check index usage: `sys.dm_db_index_usage_stats`
   - Consider adding covering indexes
   - Review query plans
   - Check for missing indexes on frequently queried columns

2. **Authorization Errors**
   - Verify ConversationParticipants records exist
   - Check that `LeftAt IS NULL` for active participants
   - Verify user ID matches exactly (case-sensitive)
   - Check foreign key constraints

3. **Large Ciphertext**
   - NVARCHAR(MAX) supports up to 2GB
   - Monitor message sizes
   - Consider compression if needed
   - Set message size limits in API

4. **Connection Issues**
   - Verify SQL Server is running
   - Check firewall rules
   - Verify connection string/credentials
   - Check connection pool settings

5. **Encryption Errors**
   - Verify `MASTER_ENCRYPTION_KEY` is set (if using key derivation)
   - Check that conversation keys are being generated/stored
   - Verify encryption/decryption functions are working

## Related Documentation

- [API README](../README.md) - API documentation and usage
- [API README](../README.md) - API documentation including encryption configuration
- [API Queries](./API_QUERIES.md) - SQL queries used in the API
- [Setup Demo](./SETUP_DEMO.md) - Detailed demo data setup guide

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review the API service implementations in `src/services/`
3. Check the API logs for error messages
4. Verify database connectivity and permissions
