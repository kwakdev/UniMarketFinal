import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import messagesRouter from './routes/messages';
import conversationsRouter from './routes/conversations';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import { closeDbPool } from './config/database';

// Load .env file from project root (explicit path)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Message-specific rate limiting (stricter)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Increased for development/testing
  message: 'Too many messages, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/messages', messageLimiter, messagesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server with keep-alive settings to reuse connections
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DB_DATABASE || 'MessagingDB'}`);
});

// Configure server to reuse connections and close them properly
server.keepAliveTimeout = 65000; // Slightly longer than default to allow time for responses
server.headersTimeout = 66000; // Should be slightly longer than keepAliveTimeout
server.maxConnections = 100; // Limit concurrent connections

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  console.log(`${signal} signal received: closing HTTP server`);
  
  // Close the HTTP server first
  return new Promise<void>((resolve) => {
    server.close(() => {
      console.log('HTTP server closed');
      resolve();
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.log('Forcing server close after timeout');
      resolve();
    }, 10000);
  }).then(async () => {
    // Close database pool
    await closeDbPool();
    console.log('Database pool closed');
    process.exit(0);
  });
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;

