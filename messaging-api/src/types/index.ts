// Message with plaintext (for API requests/responses)
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string; // Plaintext message
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  senderName?: string;
  senderAvatar?: string | null;
}

// Encrypted message (internal - stored in database)
// This is not used in API responses, only for internal database operations
export interface EncryptedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToMessageId?: string | null;
  senderName?: string;
  senderAvatar?: string | null;
}

export interface Conversation {
  id: string;
  name?: string | null;
  type: number;
  createdAt: string;
  updatedAt: string;
  lastMessageId?: string | null;
  lastMessageAt?: string | null;
  participants?: Participant[];
  otherParticipant?: Participant;
}

export interface Participant {
  id: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: number;
  joinedAt?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isGuest?: boolean;
}

export interface CreateUserPayload {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

// Create message payload - now accepts plaintext
export interface CreateMessagePayload {
  conversationId: string;
  text: string; // Plaintext message
  createdAt: string;
}

export interface MessageQueryParams {
  limit?: number;
  offset?: number;
  before?: string;
  after?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

