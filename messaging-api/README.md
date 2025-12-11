# Messaging API

Backend API for the MessagingPanel component. Built with Node.js, Express, TypeScript, and SQL Server.

A complete messaging system with server-side encryption, user management, and conversation handling.

## Features

- ✅ RESTful API endpoints (Messages, Conversations, Users)
- ✅ SQL Server database integration with connection pooling
- ✅ **Server-side message encryption** (AES-256-GCM)
- ✅ User registration and search
- ✅ Rate limiting
- ✅ Comprehensive error handling
- ✅ TypeScript support
- ✅ CORS enabled
- ✅ Graceful shutdown

## Architecture

### Server-Side Encryption

Messages are **encrypted on the server** before being stored in the database:
- **Client sends plaintext** - No encryption code needed in the frontend
- **Server encrypts** - Uses AES-256-GCM encryption with conversation-specific keys
- **Server decrypts** - Messages are decrypted before being sent to clients
- **Key Management** - Keys are derived from `MASTER_ENCRYPTION_KEY` (recommended) or generated deterministically

**Benefits:**
- Simpler client implementation
- Enables server-side features (search, moderation, analytics)
- Centralized key management
- Easier to maintain and update

See the [Encryption Configuration](#encryption-configuration) section below for setup details.

## Prerequisites

- Node.js 18+
- SQL Server (with MessagingDB database created)
- npm or yarn

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
Create a `.env` file in the project root:

```env
# Database Configuration
DB_SERVER=localhost
DB_DATABASE=MessagingApp
DB_INSTANCE=MSSQLLocalDB
DB_TRUSTED_CONNECTION=true

# Optional: Master encryption key (recommended for production)
# If not set, keys are derived deterministically per conversation
MASTER_ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

**For LocalDB**, use individual parameters (as shown above). Connection strings with `(localdb)\` format don't work well with the mssql driver.

**Environment Variable Reference:**
- `DB_SERVER` - SQL Server hostname (default: localhost)
- `DB_DATABASE` - Database name (default: MessagingDB)
- `DB_INSTANCE` - SQL Server instance name (for LocalDB: MSSQLLocalDB)
- `DB_TRUSTED_CONNECTION` - Use Windows Authentication (true/false)
- `DB_USER` - SQL Server username (if not using Windows Auth)
- `DB_PASSWORD` - SQL Server password (if not using Windows Auth)
- `DB_PORT` - SQL Server port (default: 1433)
- `DB_CONNECTION_STRING` - Full connection string (overrides individual parameters)

3. **Run database schema:**
Run the database schema script:
```bash
sqlcmd -S localhost -d MessagingDB -i database/schema.sql
```

See [database/README.md](./database/README.md) for detailed instructions.

4. **Seed demo data (optional):**
Run `database/seed-data.sql` to create demo user and conversation, or use the API endpoints (see [database/SETUP_DEMO.md](./database/SETUP_DEMO.md)).

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

The API will be available at `http://localhost:3001`

**Startup Output:**
```
🚀 Server running on http://localhost:3001
📝 Environment: development
💾 Database: MessagingDB
```

## API Endpoints

### Health Check
```
GET /health
```

### Messages

#### Send Message
```
POST /api/messages
Content-Type: application/json
X-User-Id: user-123

{
  "conversationId": "demo-conversation",
  "text": "Hello, world!",
  "createdAt": "2025-12-03T10:00:00.000Z"
}
```

**Note:** Messages are sent as **plaintext**. The server encrypts them before storage.

#### Get Messages
```
GET /api/messages/conversations/:conversationId/messages?userId=user-123&limit=50&offset=0&before=msg-id&after=msg-id
```

Or use header:
```
GET /api/messages/conversations/:conversationId/messages
X-User-Id: user-123
```

**Query Parameters:**
- `userId` - User ID (required for authorization)
- `limit` - Maximum messages to return (default: 50, max: 100)
- `offset` - Number of messages to skip (for pagination)
- `before` - Message ID to fetch messages before (for pagination)
- `after` - Message ID to fetch messages after (for pagination)

**Response:**
```json
{
  "messages": [
    {
      "id": "msg-123",
      "conversationId": "demo-conversation",
      "senderId": "user-123",
      "text": "Hello, world!",
      "createdAt": "2025-12-03T10:00:00.000Z",
      "senderName": "User 123",
      "senderAvatar": null
    }
  ],
  "hasMore": false,
  "total": 1
}
```

**Note:** Messages are returned as **plaintext** (server decrypts them).

### Users

#### Register User
```
POST /api/users
Content-Type: application/json

{
  "id": "user-123",
  "username": "johndoe",
  "email": "john@example.com",
  "displayName": "John Doe",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "id": "user-123",
  "username": "johndoe",
  "email": "john@example.com",
  "displayName": "John Doe",
  "avatarUrl": "https://example.com/avatar.jpg",
  "createdAt": "2025-12-03T10:00:00.000Z",
  "updatedAt": "2025-12-03T10:00:00.000Z",
  "isActive": true
}
```

#### Get User
```
GET /api/users/:id
```

#### Update User
```
PUT /api/users/:id
Content-Type: application/json

{
  "displayName": "John Updated",
  "avatarUrl": "https://example.com/new-avatar.jpg"
}
```

#### Search Users
```
GET /api/users/search?q=john&limit=20
```

**Query Parameters:**
- `q` - Search query (minimum 2 characters, searches username and display name)
- `limit` - Maximum results (default: 20, max: 100)

**Response:**
```json
{
  "users": [
    {
      "id": "user-123",
      "username": "johndoe",
      "displayName": "John Doe",
      "email": "john@example.com",
      "avatarUrl": null,
      "createdAt": "2025-12-03T10:00:00.000Z",
      "updatedAt": "2025-12-03T10:00:00.000Z",
      "isActive": true
    }
  ],
  "count": 1
}
```

### Conversations

#### Get User Conversations
```
GET /api/conversations?userId=user-123&limit=20&offset=0
```

Or use header:
```
GET /api/conversations
X-User-Id: user-123
```

#### Create Conversation
```
POST /api/conversations
Content-Type: application/json
X-User-Id: user-123

{
  "conversationId": "new-conversation",
  "name": "My Conversation",
  "type": 1,
  "participantIds": ["user-456"]
}
```

**Note:** The creator is automatically added as a participant. Users in `participantIds` are also added. If users don't exist, they are created automatically (with basic info).

#### Get Conversation Details
```
GET /api/conversations/:id?userId=user-123
```

Or use header:
```
GET /api/conversations/:id
X-User-Id: user-123
```

## Authentication

**JWT authentication is currently disabled for development/testing.**

### User Identification

Instead of JWT tokens, you can specify the user ID in one of these ways:

1. **Request Body** (for POST requests):
```json
{
  "senderId": "user-123",
  "conversationId": "...",
  ...
}
```

2. **Query Parameter** (for GET requests):
```
GET /api/conversations?userId=user-123
```

3. **Header** (for any request):
```
X-User-Id: user-123
```

4. **Default**: If no user ID is provided, it defaults to `user-123` for testing.

### Re-enabling JWT (Optional)

To re-enable JWT authentication for production:

1. Uncomment the `authenticateToken` middleware in:
   - `src/routes/messages.ts`
   - `src/routes/conversations.ts`
   - `src/routes/users.ts`

2. Set `JWT_SECRET` in your `.env` file:
   ```env
   JWT_SECRET=your-strong-random-secret-key-here
   ```

3. Generate tokens using `src/utils/generateToken.ts` or your authentication service

4. Clients should send tokens in the `Authorization` header:
   ```
   Authorization: Bearer <token>
   ```

## Encryption Configuration

### Master Key (Recommended)

Set `MASTER_ENCRYPTION_KEY` in your `.env` file:
```env
MASTER_ENCRYPTION_KEY=base64-encoded-32-byte-key
```

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Without Master Key

If `MASTER_ENCRYPTION_KEY` is not set, keys are derived deterministically from conversation IDs using SHA-256. This works for development but is **not recommended for production** because:
- Less secure (predictable key derivation)
- No support for key rotation
- Keys cannot be changed without breaking existing messages

**For production, always set `MASTER_ENCRYPTION_KEY`.**

## Database Connection

The API connects to SQL Server using the `mssql` package with support for both `tedious` and `msnodesqlv8` drivers.

### Configuration Options

**Option 1: Individual Parameters (Recommended for LocalDB)**
```env
DB_SERVER=localhost
DB_DATABASE=MessagingApp
DB_INSTANCE=MSSQLLocalDB
DB_TRUSTED_CONNECTION=true
```

**Option 2: Connection String**
```env
DB_CONNECTION_STRING=Server=localhost;Database=MessagingDB;User Id=sa;Password=YourPassword123;
```

**Note:** If `DB_CONNECTION_STRING` is set, individual parameters are ignored.

## Rate Limiting

- General API: 200 requests per 15 minutes per IP
- Messages: 30 requests per minute per IP

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message"
}
```

Common status codes:
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (not authorized for resource)
- `404` - Not Found
- `409` - Conflict (e.g., conversation already exists)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Project Structure

```
messaging-api/
├── database/                 # Database scripts and documentation
│   ├── schema.sql           # Main database schema (required)
│   ├── schema-procedures.sql # Optional stored procedures
│   ├── seed-data.sql        # Demo data seeding script
│   ├── README.md            # Database documentation
│   ├── API_QUERIES.md       # SQL queries reference
│   └── SETUP_DEMO.md        # Demo setup guide
├── src/
│   ├── config/
│   │   └── database.ts      # Database connection and pooling
│   ├── middleware/
│   │   └── auth.ts          # Authentication middleware (optional)
│   ├── routes/
│   │   ├── messages.ts      # Message routes
│   │   ├── conversations.ts # Conversation routes
│   │   └── users.ts         # User routes (registration, search)
│   ├── services/
│   │   ├── messageService.ts      # Message business logic (encrypt/decrypt)
│   │   ├── conversationService.ts # Conversation business logic
│   │   ├── userService.ts         # User business logic (CRUD, search)
│   │   └── keyService.ts          # Encryption key management
│   ├── types/
│   │   └── index.ts         # TypeScript type definitions
│   ├── utils/
│   │   ├── encryption.ts   # Server-side encryption utilities (AES-256-GCM)
│   │   └── generateToken.ts # JWT token generation (optional)
│   └── server.ts            # Express app setup and configuration
├── README.md                 # This file
└── package.json              # Dependencies and scripts
```

## Development

### TypeScript
The project uses TypeScript. Source files are in `src/` and compiled to `dist/`.

### Hot Reload
Development mode uses `tsx watch` for automatic reloading on file changes. The server will restart automatically when you modify files in `src/`.

### Linting
```bash
npm run lint
```

### Kill Port (Windows)
If port 3001 is in use:
```bash
npm run kill-port
```

Or manually:
```powershell
# PowerShell
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Or use the provided scripts
.\kill-port.ps1
# or
.\kill-port.bat
```

## Testing

Example using curl:

```bash
# Health check
curl http://localhost:3001/health

# Register a new user
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user-123",
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe"
  }'

# Get user
curl http://localhost:3001/api/users/user-123

# Search users
curl "http://localhost:3001/api/users/search?q=john"

# Get conversations
curl "http://localhost:3001/api/conversations?userId=user-123"

# Or using header
curl -H "X-User-Id: user-123" http://localhost:3001/api/conversations

# Send a message (plaintext)
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "conversationId": "demo-conversation",
    "text": "Hello, world!",
    "createdAt": "2025-12-03T10:00:00.000Z"
  }'

# Get messages
curl "http://localhost:3001/api/messages/conversations/demo-conversation/messages?userId=user-123"

# Create conversation
curl -X POST http://localhost:3001/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-123" \
  -d '{
    "conversationId": "demo-conversation",
    "name": "Demo Conversation",
    "type": 1
  }'
```

## Production Considerations

1. **Environment Variables**: Never commit `.env` file to version control
2. **Master Encryption Key**: 
   - Use a strong, randomly generated 32-byte key (base64-encoded)
   - Store securely (Azure Key Vault, AWS KMS, HashiCorp Vault, etc.)
   - Never hardcode in source code
3. **Database**: 
   - Connection pooling is already configured
   - Use read replicas for scaling read operations
   - Enable TDE (Transparent Data Encryption) for encryption at rest
4. **HTTPS**: Always use HTTPS in production (TLS 1.2+)
5. **Rate Limiting**: Adjust limits based on your needs and traffic patterns
6. **Logging**: Add proper logging (Winston, Pino, etc.) with log levels
7. **Monitoring**: 
   - Add health checks (`/health` endpoint exists)
   - Monitor database connection pool usage
   - Track API response times and error rates
8. **Key Rotation**: Plan for encryption key rotation - changing `MASTER_ENCRYPTION_KEY` will break existing messages unless you migrate
9. **Authentication**: Re-enable JWT authentication for production (currently disabled for development)
10. **CORS**: Configure CORS properly for your frontend domain(s)
11. **Error Handling**: Don't expose internal error details to clients in production

## Troubleshooting

### Database Connection Issues

1. **SQL Server Not Running**: Check that SQL Server service is running
2. **Invalid Credentials**: Verify database credentials in `.env` file
3. **Firewall Rules**: Check that port 1433 (or your custom port) is open
4. **Database Doesn't Exist**: Verify database exists:
   ```sql
   SELECT name FROM sys.databases WHERE name = 'MessagingDB';
   ```
5. **LocalDB Issues**: 
   - Ensure LocalDB instance is running: `sqllocaldb info MSSQLLocalDB`
   - Start if needed: `sqllocaldb start MSSQLLocalDB`
   - Use individual parameters (not connection string) for LocalDB
6. **Connection String Format**: For LocalDB, use individual parameters instead of connection string

### Port Already in Use

If you get `EADDRINUSE: address already in use :::3001` error:

**Quick Fix:**
```bash
npm run kill-port
```

**Manual Fix:**
```powershell
# Find the process
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

**Prevention:** The server includes graceful shutdown handling. Use `Ctrl+C` to stop the server properly.

### User ID Issues

1. **Missing User ID**: Make sure to provide `userId` in query params, headers, or request body
2. **Default User**: Default user ID is `user-123` if none provided (for testing only)
3. **Production**: In production, you should always specify the user ID - don't rely on defaults
4. **User Not Found**: If you get 404 errors, ensure users are registered via `POST /api/users`
5. **Authorization Errors**: Verify user is a participant in the conversation (check `ConversationParticipants` table)

### Encryption Issues

1. **Master Key Not Set**: If `MASTER_ENCRYPTION_KEY` is not set, keys are derived deterministically (less secure)
2. **Key Consistency**: Keys are derived per conversation - same conversation always uses same key
3. **Decryption Failures**: If messages can't be decrypted:
   - Check that the master key hasn't changed
   - Verify conversation keys are being generated correctly
   - Check encryption/decryption functions in `src/utils/encryption.ts`
4. **Key Rotation**: Changing `MASTER_ENCRYPTION_KEY` will break decryption of existing messages unless you migrate keys

## Related Documentation

- [Database Schema](./database/README.md) - Complete database documentation
- [Database Setup Guide](./database/SETUP_DEMO.md) - Setting up demo data
- [API Queries Reference](./database/API_QUERIES.md) - SQL queries used in the API

## License

ISC
