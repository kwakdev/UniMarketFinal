import { deriveConversationKey } from '../utils/encryption';

/**
 * Service for managing conversation encryption keys
 * Keys are stored per conversation in the database
 */
export class KeyService {
  /**
   * Get encryption key for a conversation
   * Uses master key derivation (recommended) or generates per-conversation keys
   * 
   * For production, set MASTER_ENCRYPTION_KEY in environment variables.
   * This allows key rotation without database changes.
   */
  async getConversationKey(conversationId: string): Promise<string> {
    // Check if we have a master key (for key derivation) - RECOMMENDED
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    
    if (masterKey) {
      // Use key derivation for better key management
      // Same conversation always gets the same key, but keys are derived from master
      return deriveConversationKey(masterKey, conversationId);
    }
    
    // Fallback: Generate a deterministic key per conversation
    // This is less secure but works without environment setup
    // In production, always use MASTER_ENCRYPTION_KEY
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(`conversation-key-${conversationId}`);
    return hash.digest('base64').substring(0, 44); // 32 bytes = 256 bits when base64 decoded
  }
  
}

export const keyService = new KeyService();

