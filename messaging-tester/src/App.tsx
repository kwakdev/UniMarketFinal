import { useState, useEffect, useRef } from "react";
import { MessagingPanel, type Message } from "./MessagingPanel";
import { StartPage } from "./StartPage";
import { apiClient } from "./config/api";

function App() {
  // Get user ID from URL parameter or default to user-123
  // Usage: http://localhost:5173?userId=user-456
  const urlParams = new URLSearchParams(window.location.search);
  const initialTargetUserId =
    urlParams.get('posterId') ||
    urlParams.get('targetUserId') ||
    urlParams.get('recipientId') ||
    null;
  const [currentUserId, setCurrentUserId] = useState(
    urlParams.get('userId') || localStorage.getItem('currentUserId') || "user-123"
  );
  const [conversationId, setConversationId] = useState<string | null>(
    urlParams.get('conversationId') || null
  );
  
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messageSubscribersRef = useRef<Array<(msg: Message) => void>>([]);
  const lastMessageIdRef = useRef<string | null>(null);

  // Update API client userId when it changes
  useEffect(() => {
    apiClient.setUserId(currentUserId);
    localStorage.setItem('currentUserId', currentUserId);
  }, [currentUserId]);

  // Load initial messages (only if conversation is selected)
  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      setInitialMessages([]);
      return;
    }

    async function loadMessages() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getMessages(conversationId!, { limit: 50 });
        setInitialMessages(response.messages || []);
        
        // Track the last message ID for polling
        if (response.messages && response.messages.length > 0) {
          lastMessageIdRef.current = response.messages[response.messages.length - 1].id;
        }
      } catch (err: any) {
        console.error("Error loading messages:", err);
        setError(err.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [conversationId, currentUserId]);

  // Polling for new messages (since WebSocket isn't implemented yet)
  useEffect(() => {
    if (!conversationId) {
      // Clear polling if no conversation
      return;
    }

    let isPolling = true;
    let pollTimeout: number | null = null;

    const pollForNewMessages = async () => {
      if (!isPolling) return;

      try {
        const response = await apiClient.getMessages(conversationId, {
          limit: 10,
          after: lastMessageIdRef.current || undefined,
        });

        if (response.messages && response.messages.length > 0) {
          // Notify subscribers of new messages
          response.messages.forEach((msg: Message) => {
            messageSubscribersRef.current.forEach(cb => cb(msg));
            lastMessageIdRef.current = msg.id;
          });
        }

        // Poll again after 5 seconds (reduced frequency to avoid rate limits)
        pollTimeout = setTimeout(pollForNewMessages, 5000) as unknown as number;
      } catch (err: any) {
        console.error("Error polling for messages:", err);
        
        // If rate limited, wait longer before retrying
        if (err.message?.includes('429') || err.message?.includes('Too Many Requests')) {
          console.log("Rate limited - waiting 30 seconds before retry");
          pollTimeout = setTimeout(pollForNewMessages, 30000) as unknown as number;
        } else {
          // For other errors, retry after 10 seconds
          pollTimeout = setTimeout(pollForNewMessages, 10000) as unknown as number;
        }
      }
    };

    // Start polling after initial delay
    pollTimeout = setTimeout(pollForNewMessages, 5000) as unknown as number;

    return () => {
      isPolling = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [conversationId]);

  // Show start page if no conversation is selected
  if (!conversationId) {
    return (
      <StartPage
        key={`start-${currentUserId}`}
        currentUserId={currentUserId}
        initialTargetUserId={initialTargetUserId}
        onUserChange={(userId) => {
          setCurrentUserId(userId);
          // Update URL without reload
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('userId', userId);
          window.history.pushState({}, '', newUrl);
        }}
        onStartConversation={(convId) => {
          setConversationId(convId);
          // Update URL without reload
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('conversationId', convId);
          newUrl.searchParams.set('userId', currentUserId);
          newUrl.searchParams.delete('posterId');
          newUrl.searchParams.delete('targetUserId');
          newUrl.searchParams.delete('recipientId');
          window.history.pushState({}, '', newUrl);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-2xl mb-4">📨</div>
          <div className="text-gray-600">Loading messages...</div>
        </div>
      </div>
    );
  }

  if (error) {
    const isRateLimit = error.includes('429') || error.includes('Too Many Requests');
    
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="text-red-600 mb-2 font-semibold">Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          {isRateLimit && (
            <div className="text-sm text-gray-500 mb-4">
              The API is rate limiting requests. Polling will automatically retry in 30 seconds.
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setConversationId(null);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Back to Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-100">
      <div className="flex-1 overflow-hidden">
        <MessagingPanel
          currentUserId={currentUserId}
          conversationId={conversationId}
          initialMessages={initialMessages}
          onSend={async (payload) => {
            try {
              const response = await apiClient.sendMessage(payload) as Message;
              console.log("Message sent successfully:", response);
              // Return the created message so the component can replace the optimistic one
              return response;
            } catch (err: any) {
              console.error("Error sending message:", err);
              throw err;
            }
          }}
          onSubscribeNewMessage={(_convId, callback) => {
            // Store the callback for polling
            messageSubscribersRef.current.push(callback);
            
            // Return unsubscribe function
            return () => {
              messageSubscribersRef.current = messageSubscribersRef.current.filter(
                cb => cb !== callback
              );
            };
          }}
        />
      </div>
      
      {/* Status bar */}
      <div className="bg-gray-800 text-white px-4 py-2 text-xs flex items-center gap-4 border-t border-gray-700">
        <span className="font-semibold">Connected to API:</span>
        <span className="text-green-400">●</span>
        <span className="text-gray-400">
          {import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}
        </span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-400">User: {currentUserId}</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-400">Conversation: {conversationId}</span>
        <button
          onClick={() => {
            setConversationId(null);
            // Update URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('conversationId');
            window.history.pushState({}, '', newUrl);
          }}
          className="ml-auto px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
        >
          Back to Start
        </button>
      </div>
    </div>
  );
}

export default App;
