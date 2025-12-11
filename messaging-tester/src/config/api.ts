// API configuration and utilities
// Use proxy in development, or full URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiError {
  error: string;
}

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string = API_BASE_URL, userId?: string) {
    this.baseUrl = baseUrl;
    // Get userId from parameter, or try to get from URL, or default
    this.userId = userId || this.getUserIdFromUrl() || 'user-123';
  }

  private getUserIdFromUrl(): string | null {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('userId');
    }
    return null;
  }

  // Method to update userId (useful if user changes)
  setUserId(userId: string) {
    this.userId = userId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-User-Id': this.userId,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async sendMessage(payload: {
    conversationId: string;
    text: string; // Plaintext message
    createdAt: string;
  }) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMessages(
    conversationId: string,
    params?: {
      limit?: number;
      offset?: number;
      before?: string;
      after?: string;
    }
  ) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.before) queryParams.set('before', params.before);
    if (params?.after) queryParams.set('after', params.after);
    // Note: userId is sent via X-User-Id header, not query param

    const query = queryParams.toString();
    // Route is /api/messages/conversations/:conversationId/messages
    return this.request<{
      messages: any[];
      hasMore: boolean;
      total?: number;
    }>(`/messages/conversations/${conversationId}/messages${query ? `?${query}` : ''}`);
  }

  async getConversations(params?: { limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    queryParams.set('userId', this.userId);

    const query = queryParams.toString();
    return this.request<{
      conversations: any[];
      total: number;
      hasMore: boolean;
    }>(`/conversations?${query}`);
  }

  async getConversation(conversationId: string) {
    return this.request(`/conversations/${conversationId}?userId=${this.userId}`);
  }

  async createConversation(payload: {
    conversationId: string;
    name?: string;
    type?: number;
    participantIds?: string[];
  }) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async registerUser(payload: {
    id: string;
    username: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getUser(userId: string) {
    return this.request(`/users/${userId}`);
  }

  async searchUsers(query: string, limit: number = 20) {
    return this.request<{
      users: any[];
      count: number;
    }>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  async getAllUsers(limit: number = 100) {
    return this.request<{
      users: any[];
      count: number;
    }>(`/users?limit=${limit}`);
  }
}

// Create API client with userId from URL or default
const getUserIdFromUrl = (): string | null => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('userId');
  }
  return null;
};

export const apiClient = new ApiClient(API_BASE_URL, getUserIdFromUrl() || undefined);

