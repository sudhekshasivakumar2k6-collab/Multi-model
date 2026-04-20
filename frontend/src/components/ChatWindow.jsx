import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";

function TypingIndicator() {
  return (
    <div className="message-row assistant-row" aria-label="Assistant is thinking">
      <div className="avatar assistant-avatar">
        <svg viewBox="0 0 40 40" fill="none" width="18" height="18">
          <circle cx="20" cy="20" r="18" fill="url(#tiGrad)" />
          <defs>
            <radialGradient id="tiGrad" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#6d28d9" />
            </radialGradient>
          </defs>
          <path d="M13 20a7 7 0 0 1 14 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="20" cy="20" r="3" fill="#fff" />
        </svg>
      </div>
      <div className="bubble assistant-bubble typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <svg viewBox="0 0 80 80" fill="none" width="64" height="64">
          <circle cx="40" cy="40" r="36" fill="url(#esGrad)" opacity="0.15" />
          <defs>
            <radialGradient id="esGrad" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#6d28d9" />
            </radialGradient>
          </defs>
          <path d="M26 40a14 14 0 0 1 28 0" stroke="#6d28d9" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <circle cx="40" cy="40" r="5" fill="#6d28d9" opacity="0.6" />
        </svg>
      </div>
      <p className="empty-state-text">Start a conversation above</p>
    </div>
  );
}

export default function ChatWindow({ messages, isLoading }) {
  const bottomRef = useRef(null);
  const windowRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Detect if user has scrolled up (disable auto-scroll)
  const handleScroll = () => {
    const el = windowRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, autoScroll]);

  const realMessages = messages.filter((m) => m.id !== "welcome");

  return (
    <div
      className="chat-window"
      role="log"
      aria-live="polite"
      ref={windowRef}
      onScroll={handleScroll}
    >
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isLoading && <TypingIndicator />}
      {!isLoading && realMessages.length === 0 && messages.length <= 1 && (
        <EmptyState />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
