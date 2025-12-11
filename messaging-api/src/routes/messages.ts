import { Router, Request, Response } from 'express';
import { messageService } from '../services/messageService';
import { CreateMessagePayload, MessageQueryParams } from '../types';
import { randomUUID } from 'crypto';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Enable optional auth to populate req.user when JWT is provided
router.use(optionalAuth);

/**
 * POST /api/messages
 * Send a new message (plaintext - server encrypts it)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Prefer authenticated user id, fallback to provided headers/body for dev
    const authReq = req as AuthRequest;
    const hUserIdRaw = req.headers['x-user-id'];
    const hUserId = Array.isArray(hUserIdRaw) ? hUserIdRaw[0] : hUserIdRaw;
    const senderId = authReq.user?.id ?? req.body.senderId ?? hUserId ?? 'user-123';
    const payload: CreateMessagePayload = req.body;

    // Validate payload - now expects plaintext
    if (!payload.conversationId || !payload.text) {
      return res.status(400).json({
        error: 'Invalid message format',
        required: ['conversationId', 'text'],
      });
    }

    // Generate message ID
    const messageId = randomUUID();

    // Create message (server encrypts it)
    const message = await messageService.createMessage(
      messageId,
      payload.conversationId,
      senderId,
      payload
    );

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error creating message:', error);
    
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/conversations/:conversationId/messages
 * Get messages for a conversation
 */
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    // Prefer authenticated user id, fallback to query/header for dev
    const authReq = req as AuthRequest;
    const qUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const hUserIdRaw = req.headers['x-user-id'];
    const hUserId = Array.isArray(hUserIdRaw) ? hUserIdRaw[0] : hUserIdRaw;
    const userId = authReq.user?.id ?? qUserId ?? hUserId ?? 'user-123';
    const { conversationId } = req.params;
    const queryParams: MessageQueryParams = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      before: req.query.before as string | undefined,
      after: req.query.after as string | undefined,
    };

    const result = await messageService.getMessages(conversationId, userId, queryParams);

    res.json({
      messages: result.data,
      hasMore: result.hasMore,
      total: result.total,
    });
  } catch (error: any) {
    console.error('Error getting messages:', error);
    
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

