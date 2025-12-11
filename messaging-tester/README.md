# MessagingPanel Component - Tester App

This is a test/demo application for the `MessagingPanel` component with server-side encryption.

## Quick Start

1. **Start the API server:**
```bash
cd ../messaging-api
npm install
npm run dev
```

2. **Start this tester app:**
```bash
npm install
npm run dev
```

3. **Setup demo data:**
Run the SQL script: `database/setup-demo-data.sql`

4. **Open in browser:**
- Single user: `http://localhost:5173`
- Multiple users: `http://localhost:5173?userId=user-456`

## Features

- ✅ Real-time messaging (via polling)
- ✅ Server-side encryption (no client-side crypto needed)
- ✅ Multi-user support via URL parameters
- ✅ Modern, responsive UI
- ✅ Message grouping and date separators

## Architecture

### Encryption

**Messages are encrypted on the server**, not the client:
- Client sends/receives plaintext messages
- Server handles all encryption/decryption
- No encryption keys needed in the browser
- Simpler implementation and better for server-side features

See [../messaging-api/ENCRYPTION_ARCHITECTURE.md](../messaging-api/ENCRYPTION_ARCHITECTURE.md) for details.

## Multi-User Testing

### Quick Method: URL Parameters

1. **User 1:** Open `http://localhost:5173` (defaults to `user-123`)
2. **User 2:** Open `http://localhost:5173?userId=user-456` in a new window
3. **Add user to conversation:** Run `database/add-user-to-conversation.sql`

See [MULTI_USER_SETUP.md](./MULTI_USER_SETUP.md) for detailed instructions.

## Component Location

The main component is located at:
- `src/MessagingPanel.tsx`

## Integration

If you're looking to integrate the MessagingPanel component into your application:

- 📖 **[Quick Start Guide](./QUICK_START.md)** - Get up and running in 5 minutes
- 📚 **[Full Integration Documentation](./INTEGRATION.md)** - Comprehensive integration guide
- 🔌 **[API Specification](./API_SPECIFICATION.md)** - Complete backend API requirements
- 💻 **[API Examples](./API_EXAMPLE_README.md)** - Example backend implementations
- 🗄️ **[Database Schema](./database/schema.sql)** - SQL Server database schema

## API Configuration

The app connects to the API via proxy (development) or environment variable (production).

**Development:** Uses Vite proxy configured in `vite.config.ts`

**Production:** Set `VITE_API_URL` environment variable:
```env
VITE_API_URL=https://api.example.com/api
```

## Project Structure

```
src/
├── App.tsx                 # Main app component with polling
├── MessagingPanel.tsx      # Messaging UI component
├── config/
│   └── api.ts             # API client
├── index.css              # Global styles
└── main.tsx               # Entry point
```

## Development

### Running
```bash
npm run dev
```

### Building
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Key Differences from Client-Side Encryption

This version uses **server-side encryption**, which means:

1. **No encryption code in the frontend** - All crypto happens on the server
2. **Simpler implementation** - Just send/receive plaintext
3. **No key management** - Server handles all keys
4. **Enables server features** - Search, moderation, analytics possible

The component API remains the same, but the backend handles encryption.

## License

ISC
