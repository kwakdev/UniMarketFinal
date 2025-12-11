"use client";

import { useEffect, useRef, useState } from "react";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string | null;
};

type MessagingPanelProps = {
  currentUserId: string;
  conversationId: string;
  initialMessages?: Message[];
  onSend: (payload: {
    conversationId: string;
    text: string;
    createdAt: string;
  }) => Promise<Message | void> | Message | void;
  onSubscribeNewMessage?: (
    conversationId: string,
    cb: (msg: Message) => void
  ) => () => void;
};

// ---- Component ----

export function MessagingPanel(props: MessagingPanelProps) {
  const {
    currentUserId,
    conversationId,
    initialMessages = [],
    onSend,
    onSubscribeNewMessage,
  } = props;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Sort messages chronologically (oldest first) to ensure proper display order
    const sortedMessages = [...initialMessages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setMessages(sortedMessages);
  }, [initialMessages]);

  // Scroll to bottom when messages change or component mounts
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    const timer = setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + 'px';
    }
  }, [input]);


  // optional real-time hook
  useEffect(() => {
    if (!onSubscribeNewMessage) return;

    const unsub = onSubscribeNewMessage(conversationId, (msg) => {
      setMessages((prev) => {
        // Check if message with same ID already exists
        if (prev.some((m) => m.id === msg.id)) return prev;
        
        // Also check for optimistic messages with same content/timestamp
        // This prevents duplicates when polling picks up a message we just sent
        const isDuplicate = prev.some((m) => 
          m.conversationId === msg.conversationId &&
          m.senderId === msg.senderId &&
          m.text === msg.text &&
          Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 5000 // Within 5 seconds
        );
        
        if (isDuplicate) return prev;
        
        // Add new message and sort chronologically to maintain order
        const updated = [...prev, msg].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return updated;
      });
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [conversationId, onSubscribeNewMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    setInput("");

    // Generate temp ID outside try block so it's available in catch
    const tempId = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

    try {
      const createdAt = new Date().toISOString();

      const local: Message = {
        id: tempId,
        conversationId,
        senderId: currentUserId,
        text,
        createdAt,
      };

      // Add optimistic message immediately (will be sorted chronologically)
      setMessages((prev) => {
        const updated = [...prev, local].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return updated;
      });

      // call parent (API call) - server handles encryption
      const createdMessage = await onSend({
        conversationId,
        text,
        createdAt,
      });

      // If we got the real message back, replace the optimistic one and maintain sort order
      if (createdMessage && createdMessage.id) {
        setMessages((prev) => {
          const updated = prev.map((msg) => msg.id === tempId ? createdMessage : msg);
          return updated.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      }
    } catch (err) {
      console.error("send failed", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowDateSeparator = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  const shouldGroupWithPrevious = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return false;
    if (prevMsg.senderId !== currentMsg.senderId) return false;
    const timeDiff = new Date(currentMsg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
    return timeDiff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-white text-sm shadow-md">
            {conversationId.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-gray-900">Messaging</div>
            <div className="text-xs text-gray-500">
              {conversationId}
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
          {currentUserId}
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 flex flex-col bg-[#F2F2F7]">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-5xl mb-3 opacity-50">💬</div>
              <div className="text-gray-500 text-base font-normal">
                No messages yet
              </div>
              <div className="text-gray-400 text-sm mt-1 font-light">
                Start the conversation by sending a message
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {messages.map((m, index) => {
            const isMine = m.senderId === currentUserId;
            const text = m.text;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
            const showDateSeparator = shouldShowDateSeparator(m, prevMsg);
            const groupWithPrev = shouldGroupWithPrevious(m, prevMsg);
            const groupWithNext = nextMsg ? shouldGroupWithPrevious(nextMsg, m) : false;

            return (
              <div key={m.id} className="relative">
                {showDateSeparator && (
                  <div className="flex items-center justify-center my-5">
                    <div className="px-2 py-1 bg-white/90 rounded-full text-[13px] text-gray-600 font-medium shadow-sm">
                      {new Date(m.createdAt).toLocaleDateString([], { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                )}
                
                <div
                  className={`flex items-end gap-1 ${
                    isMine ? "justify-end" : "justify-start"
                  } ${groupWithPrev ? 'mt-0' : 'mt-3'}`}
                >
                  {!isMine && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
                      groupWithPrev ? 'opacity-0 w-0 h-0 mr-0' : 'opacity-100 bg-gray-300 mr-1'
                    }`}>
                      {!groupWithPrev && (m.senderId.charAt(0).toUpperCase() || '?')}
                    </div>
                  )}
                  
                  <div
                    className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    {!isMine && !groupWithPrev && (
                      <div className="text-xs text-gray-500 font-normal mb-1 px-1">
                        {m.senderId}
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 ${
                        isMine
                          ? `bg-[#007AFF] text-white ${
                              groupWithPrev 
                                ? groupWithNext 
                                  ? 'rounded-[18px]' 
                                  : 'rounded-tl-[18px] rounded-tr-[18px] rounded-bl-[18px] rounded-br-[4px]'
                                : groupWithNext
                                  ? 'rounded-tl-[18px] rounded-tr-[18px] rounded-bl-[4px] rounded-br-[18px]'
                                  : 'rounded-[18px]'
                            }`
                          : `bg-[#E9E9EB] text-black ${
                              groupWithPrev 
                                ? groupWithNext 
                                  ? 'rounded-[18px]' 
                                  : 'rounded-tl-[18px] rounded-tr-[18px] rounded-bl-[4px] rounded-br-[18px]'
                                : groupWithNext
                                  ? 'rounded-tl-[18px] rounded-tr-[18px] rounded-bl-[18px] rounded-br-[4px]'
                                  : 'rounded-[18px]'
                            }`
                      }`}
                      style={{
                        boxShadow: isMine 
                          ? '0 1px 2px rgba(0, 0, 0, 0.1)' 
                          : '0 1px 2px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      <div className="whitespace-pre-wrap break-words text-[17px] leading-[22px] font-normal">
                        {text}
                      </div>
                    </div>
                    {!groupWithNext && (
                      <div className={`text-[11px] text-gray-500 mt-1 px-1 ${
                        isMine ? "text-right" : "text-left"
                      }`}>
                        {formatTime(m.createdAt)}
                      </div>
                    )}
                  </div>

                  {isMine && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ${
                      groupWithPrev ? 'opacity-0 w-0 h-0 ml-0' : 'opacity-100 bg-[#007AFF] ml-1'
                    }`}>
                      {!groupWithPrev && (currentUserId.charAt(0).toUpperCase() || 'Y')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div ref={endRef} />
      </div>

      {/* input */}
      <div className="border-t border-gray-200/50 bg-white px-2 sm:px-4 py-2">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              className="w-full border border-gray-300 rounded-[20px] px-4 py-2.5 pr-3 text-[17px] resize-none focus:outline-none focus:border-gray-400 max-h-32 overflow-y-auto bg-white transition-colors placeholder:text-gray-400"
              placeholder="Text Message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              style={{
                minHeight: '36px',
                height: 'auto',
              }}
            />
          </div>
          <button
            type="button"
            className="px-4 py-2 rounded-full bg-[#007AFF] text-white font-medium text-[17px] hover:bg-[#0051D5] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center min-w-[60px] disabled:bg-gray-300 disabled:text-gray-500"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
