import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Enable optional auth
router.use(optionalAuth);

/**
 * GET /api/conversations
 * Get all conversations for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const qUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const hUserIdRaw = req.headers['x-user-id'];
    const hUserId = Array.isArray(hUserIdRaw) ? hUserIdRaw[0] : hUserIdRaw;
    const userId = authReq.user?.id ?? qUserId ?? hUserId ?? 'user-123';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const result = await conversationService.getUserConversations(userId, limit, offset);

    res.json({
      conversations: result.conversations,
      total: result.total,
      hasMore: offset + result.conversations.length < result.total,
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const hUserIdRaw = req.headers['x-user-id'];
    const hUserId = Array.isArray(hUserIdRaw) ? hUserIdRaw[0] : hUserIdRaw;
    const creatorId = authReq.user?.id ?? req.body.creatorId ?? hUserId ?? 'user-123';
    const { conversationId, name, type, participantIds } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const conversation = await conversationService.createConversation(
      conversationId,
      creatorId,
      name,
      type || 1,
      participantIds || []
    );

    res.status(201).json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    
    if (error.message?.includes('PRIMARY KEY') || error.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Conversation already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/conversations/:id
 * Get conversation details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const qUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const hUserIdRaw = req.headers['x-user-id'];
    const hUserId = Array.isArray(hUserIdRaw) ? hUserIdRaw[0] : hUserIdRaw;
    const userId = authReq.user?.id ?? qUserId ?? hUserId ?? 'user-123';
    const { id } = req.params;

    const conversation = await conversationService.getConversation(id, userId);

    res.json(conversation);
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

