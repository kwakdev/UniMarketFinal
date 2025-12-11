import { useState, useEffect } from "react";
import { apiClient } from "./config/api";

export interface User {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Conversation {
  id: string;
  name?: string | null;
  type: number;
  createdAt: string;
  updatedAt: string;
  lastMessageId?: string | null;
  lastMessageAt?: string | null;
  otherParticipant?: {
    id: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

type StartPageProps = {
  currentUserId: string;
  onUserChange: (userId: string) => void;
  onStartConversation: (conversationId: string) => void;
};

export function StartPage({ currentUserId, onUserChange, onStartConversation }: StartPageProps) {
  const [showAddUser, setShowAddUser] = useState(false);
  const [showStartConversation, setShowStartConversation] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [allUsersForDropdown, setAllUsersForDropdown] = useState<User[]>([]);
  const [loadingUsersForDropdown, setLoadingUsersForDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add user form state
  const [newUser, setNewUser] = useState({
    id: "",
    username: "",
    email: "",
    displayName: "",
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAddingUser(true);

    try {
      if (!newUser.id || !newUser.username) {
        throw new Error("ID and username are required");
      }

      // Validate username format (alphanumeric, underscore, hyphen, 3-50 chars)
      const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
      if (!usernameRegex.test(newUser.username)) {
        throw new Error("Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens");
      }

      await apiClient.registerUser({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email || undefined,
        displayName: newUser.displayName || undefined,
      });

      // Reset form
      setNewUser({ id: "", username: "", email: "", displayName: "" });
      setShowAddUser(false);
      // Refresh users list if conversation section is open
      if (showStartConversation) {
        loadAllUsers();
      }
      alert("User registered successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to register user");
    } finally {
      setAddingUser(false);
    }
  };

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    setError(null);

    try {
      // Get all users using the new endpoint
      const response = await apiClient.getAllUsers(100);
      // Filter out the current user from the list
      const otherUsers = (response.users || []).filter(user => user.id !== currentUserId);
      setAllUsers(otherUsers);
      
      if (otherUsers.length === 0) {
        setError("No other users found. Add users using the 'Add User' button.");
      }
    } catch (err: any) {
      console.error("Error loading users:", err);
      setError("Failed to load users. Please try again.");
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartConversation = async () => {
    if (!selectedUserId) {
      setError("Please select a user to start a conversation with");
      return;
    }

    if (selectedUserId === currentUserId) {
      setError("Cannot start a conversation with yourself");
      return;
    }

    setError(null);

    try {
      // Create a conversation ID (combine user IDs in sorted order for consistency)
      const userIds = [currentUserId, selectedUserId].sort();
      const conversationId = `conv-${userIds[0]}-${userIds[1]}`;

      // Create conversation with both users as participants
      await apiClient.createConversation({
        conversationId,
        type: 1, // Direct message
        participantIds: [selectedUserId],
      });

      // Navigate to conversation
      onStartConversation(conversationId);
      // Refresh conversations list
      loadConversations();
    } catch (err: any) {
      setError(err.message || "Failed to start conversation");
    }
  };

  // Load conversations and users when component mounts or user changes
  useEffect(() => {
    loadConversations();
    loadUsersForDropdown();
  }, [currentUserId]);

  // Load users when "Start Conversation" is opened
  useEffect(() => {
    if (showStartConversation) {
      loadAllUsers();
    } else {
      setSelectedUserId("");
      setAllUsers([]);
    }
  }, [showStartConversation, currentUserId]);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const loadUsersForDropdown = async () => {
    setLoadingUsersForDropdown(true);
    try {
      const response = await apiClient.getAllUsers(200);
      setAllUsersForDropdown(response.users || []);
    } catch (err: any) {
      console.error("Error loading users for dropdown:", err);
      setAllUsersForDropdown([]);
    } finally {
      setLoadingUsersForDropdown(false);
    }
  };

  const loadConversations = async () => {
    setLoadingConversations(true);
    setError(null);

    try {
      const response = await apiClient.getConversations({ limit: 50 });
      setConversations(response.conversations || []);
    } catch (err: any) {
      console.error("Error loading conversations:", err);
      // Don't show error for conversations - just log it
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-2xl px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-2">💬 Messaging App</h1>
          <p className="text-gray-600">Connect and chat with others</p>
        </div>

        {/* Current User Info */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-2">Current User</div>
              <select
                value={currentUserId}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== currentUserId) {
                    onUserChange(e.target.value);
                  }
                }}
                disabled={loadingUsersForDropdown}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingUsersForDropdown ? (
                  <option value={currentUserId}>Loading users...</option>
                ) : allUsersForDropdown.length === 0 ? (
                  <option value={currentUserId}>{currentUserId}</option>
                ) : (
                  <>
                    {allUsersForDropdown.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName || user.username} ({user.id})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {!loadingUsersForDropdown && allUsersForDropdown.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  Select a user from the dropdown above
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => {
              setShowAddUser(true);
              setShowStartConversation(false);
              setError(null);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <span className="text-2xl">➕</span>
            <span>Add User</span>
          </button>

          <button
            onClick={() => {
              setShowStartConversation(true);
              setShowAddUser(false);
              setError(null);
              setSelectedUserId("");
            }}
            className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <span className="text-2xl">💬</span>
            <span>Start Conversation</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Add User Form */}
        {showAddUser && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 mb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Register New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.id}
                  onChange={(e) => setNewUser({ ...newUser, id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user-123"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="johndoe"
                  required
                  pattern="[a-zA-Z0-9_-]{3,50}"
                />
                <p className="text-xs text-gray-500 mt-1">
                  3-50 characters, letters, numbers, underscores, and hyphens only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingUser}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingUser ? "Registering..." : "Register User"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUser(false);
                    setNewUser({ id: "", username: "", email: "", displayName: "" });
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Start Conversation - User Selection */}
        {showStartConversation && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select User to Chat With</h2>

            {loadingUsers ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2 animate-pulse">⏳</div>
                <div>Loading users...</div>
              </div>
            ) : allUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👥</div>
                <div className="mb-4">No other users found</div>
                <div className="text-sm text-gray-400">
                  Add more users using the "Add User" button above
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select a user
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 font-medium cursor-pointer transition-colors"
                  >
                    <option value="">-- Choose a user --</option>
                    {allUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName || user.username} (@{user.username})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedUserId && (
                  <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {allUsers.find(u => u.id === selectedUserId)?.displayName?.[0] || 
                         allUsers.find(u => u.id === selectedUserId)?.username[0] || "?"}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {allUsers.find(u => u.id === selectedUserId)?.displayName || 
                           allUsers.find(u => u.id === selectedUserId)?.username}
                        </div>
                        <div className="text-sm text-gray-600">
                          @{allUsers.find(u => u.id === selectedUserId)?.username}
                        </div>
                        {allUsers.find(u => u.id === selectedUserId)?.email && (
                          <div className="text-xs text-gray-500 mt-1">
                            {allUsers.find(u => u.id === selectedUserId)?.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleStartConversation}
                    disabled={!selectedUserId}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-500"
                  >
                    Start Conversation
                  </button>
                  <button
                    onClick={() => {
                      setShowStartConversation(false);
                      setSelectedUserId("");
                      setError(null);
                    }}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Existing Conversations */}
        {!showAddUser && !showStartConversation && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Conversations</h2>

            {loadingConversations ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2 animate-pulse">⏳</div>
                <div>Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💬</div>
                <div className="mb-4">No conversations yet</div>
                <div className="text-sm text-gray-400">
                  Start a new conversation using the button above
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {conversations.map((conv) => {
                  const otherUser = conv.otherParticipant;
                  const displayName = otherUser?.displayName || otherUser?.id || "Unknown User";
                  const avatarInitial = displayName[0]?.toUpperCase() || "?";

                  return (
                    <button
                      key={conv.id}
                      onClick={() => onStartConversation(conv.id)}
                      className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                          {avatarInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {displayName}
                          </div>
                          {otherUser?.id && (
                            <div className="text-sm text-gray-500 truncate">
                              @{otherUser.id}
                            </div>
                          )}
                          {conv.lastMessageAt && (
                            <div className="text-xs text-gray-400 mt-1">
                              {formatRelativeTime(conv.lastMessageAt)}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {conversations.length > 0 && (
              <button
                onClick={loadConversations}
                className="mt-4 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
              >
                Refresh Conversations
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

