import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/guest', async (req: Request, res: Response) => {
  try {
    const { displayName } = req.body || {};
    const result = await authService.createGuest(displayName);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, username, displayName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await authService.registerEmail({ email, password, username, displayName });
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message && (err.message.includes('Email') || err.message.includes('Username'))) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await authService.loginEmail({ email, password });
    res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/session', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await authService.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

export default router;
