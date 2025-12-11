# Setting Up Demo Data

This guide explains how to set up the demo data needed for the messaging application to work.

## Problem

The application requires:
1. A user with ID `user-123` in the `Users` table
2. A conversation with ID `demo-conversation` in the `Conversations` table
3. A participant record linking `user-123` to `demo-conversation` in the `ConversationParticipants` table

Without these, you'll get a `403 Forbidden` error: "Not authorized to view this conversation".

## Solution 1: SQL Script (Recommended)

Run the SQL script to set up the demo data:

```bash
# Using sqlcmd (Windows)
sqlcmd -S your-server -d your-database -i seed-data.sql

# Or using Azure Data Studio / SQL Server Management Studio
# Open seed-data.sql and execute it
```

The script will:
- Create the user `user-123` if it doesn't exist
- Create the conversation `demo-conversation` if it doesn't exist
- Add `user-123` as a participant in `demo-conversation`

**To add more users:** Uncomment the sections in `seed-data.sql` or use the helper section at the bottom to add any user to any conversation.

## Solution 2: API Endpoints (Recommended)

You can also create users and conversations programmatically using the API:

### 1. Register User

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "username": "demo-user",
    "displayName": "Demo User",
    "email": "demo@example.com"
  }'
```

### 2. Create Conversation

```bash
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "conversationId": "demo-conversation",
    "name": "Demo Conversation",
    "type": 1,
    "participantIds": []
  }'
```

This will automatically:
- Create the user if it doesn't exist (via conversation creation)
- Create the conversation
- Add the creator as a participant

## Verification

After running either solution, verify the setup:

```sql
-- Check user exists
SELECT * FROM dbo.Users WHERE Id = 'user-123';

-- Check conversation exists
SELECT * FROM dbo.Conversations WHERE Id = 'demo-conversation';

-- Check participant record
SELECT * FROM dbo.ConversationParticipants 
WHERE ConversationId = 'demo-conversation' 
AND UserId = 'user-123'
AND LeftAt IS NULL;
```

Or use the API:

```bash
# Get user
curl http://localhost:3001/api/users/user-123

# Get conversation
curl "http://localhost:3001/api/conversations/demo-conversation?userId=user-123"
```

If all queries return results, you're good to go!

## Troubleshooting

### Error: "Not authorized to view this conversation"
- Make sure the participant record exists and `LeftAt IS NULL`
- Verify the user ID matches exactly (case-sensitive)
- Verify the conversation ID matches exactly (case-sensitive)

### Error: "Conversation not found"
- Run the setup script to create the conversation
- Check that the conversation ID in your code matches the database

### Error: Foreign key constraint violation
- Make sure the user exists before creating the participant record
- The setup script handles this automatically

### Error: "User already exists" (409 Conflict)
- The user already exists in the database
- You can either use the existing user or update it via `PUT /api/users/:id`

