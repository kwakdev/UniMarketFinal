import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username?: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized - No token provided' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as { userId: string; username?: string };
    
    req.user = {
      id: decoded.userId,
      username: decoded.username,
    };
    
    next();
  } catch (error) {
    res.status(403).json({ error: 'Unauthorized - Invalid token' });
  }
}

// For development/testing - allows bypassing auth
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret) as { userId: string; username?: string };
      req.user = {
        id: decoded.userId,
        username: decoded.username,
      };
    } catch (error) {
      // Ignore invalid token in optional auth
    }
  }

  // Default user for testing if no token
  if (!req.user && process.env.NODE_ENV === 'development') {
    req.user = { id: 'user-123' };
  }

  next();
}

