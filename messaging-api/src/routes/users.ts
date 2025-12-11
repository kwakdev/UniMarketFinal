import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';
import { CreateUserPayload, UpdateUserPayload } from '../types';

const router = Router();

/**
 * POST /api/users
 * Register/create a new user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload: CreateUserPayload = req.body;

    // Validate required fields
    if (!payload.id || !payload.username) {
      return res.status(400).json({
        error: 'Invalid user data',
        required: ['id', 'username'],
      });
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-50 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!usernameRegex.test(payload.username)) {
      return res.status(400).json({
        error: 'Invalid username format',
        message: 'Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens',
      });
    }

    const user = await userService.createUser(payload);
    res.status(201).json(user);
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    if (error.message.includes('already exists') || error.message.includes('already taken')) {
      return res.status(409).json({ error: error.message });
    }
    
    // Return the actual error message to help with debugging
    const errorMessage = error.message || 'Internal server error';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/users
 * Get all active users (for dropdowns/lists)
 * Must come before /:id route
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const users = await userService.getAllUsers(Math.min(limit, 200));
    res.json({ users, count: users.length });
  } catch (error: any) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/search?q=query
 * Search users by username or display name
 * Must come before /:id route
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const users = await userService.searchUsers(query.trim(), Math.min(limit, 100));
    res.json({ users, count: users.length });
  } catch (error: any) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUser(id);
    res.json(user);
  } catch (error: any) {
    console.error('Error getting user:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payload: UpdateUserPayload = req.body;

    // Validate username format if provided
    if (payload.username) {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
      if (!usernameRegex.test(payload.username)) {
        return res.status(400).json({
          error: 'Invalid username format',
          message: 'Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens',
        });
      }
    }

    const user = await userService.updateUser(id, payload);
    res.json(user);
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('already taken')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
