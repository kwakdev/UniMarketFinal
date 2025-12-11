import jwt from 'jsonwebtoken';

/**
 * Generate a JWT token for testing/development
 * In production, this should be part of your authentication service
 */
export function generateTestToken(userId: string, username?: string): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  return jwt.sign(
    { userId, username },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

