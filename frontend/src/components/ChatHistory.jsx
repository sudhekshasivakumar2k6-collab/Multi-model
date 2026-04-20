import { useEffect, useRef } from "react";

const formatDate = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" width="16" height="16">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChatBubbleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export default function ChatHistory({
  sessions,
  currentSessionId,
  isOpen,
  onClose,
  onNewChat,
  onLoadSession,
  onDeleteSession,
}) {
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className={`history-overlay ${isOpen ? "visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside
        ref={panelRef}
        className={`history-panel ${isOpen ? "open" : ""}`}
        aria-label="Chat history"
      >
        {/* Panel header */}
        <div className="history-header">
          <span className="history-title">💬 Chat History</span>
          <button
            className="history-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close history"
          >
            <CloseIcon />
          </button>
        </div>

        {/* New Chat button */}
        <button className="new-chat-btn" onClick={() => { onNewChat(); onClose(); }} id="btn-new-chat">
          <PlusIcon />
          <span>New Chat</span>
        </button>

        {/* Session list */}
        <div className="history-list" role="list">
          {sessions.length === 0 ? (
            <div className="history-empty">
              <span style={{ fontSize: "2rem" }}>🗂️</span>
              <p>No chat history yet.</p>
              <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                Your conversations are saved automatically.
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                role="listitem"
                className={`history-item ${session.id === currentSessionId ? "active" : ""}`}
              >
                <button
                  className="history-item-btn"
                  onClick={() => { onLoadSession(session.id); onClose(); }}
                  title={session.title}
                  aria-label={`Load chat: ${session.title}`}
                >
                  <span className="history-item-icon">
                    <ChatBubbleIcon />
                  </span>
                  <div className="history-item-body">
                    <span className="history-item-title">{session.title}</span>
                    <span className="history-item-meta">
                      {formatDate(session.updatedAt)}
                      {" · "}
                      {session.messages.filter((m) => m.id !== "welcome").length} msgs
                    </span>
                  </div>
                </button>

                <button
                  className="history-delete-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  title="Delete this chat"
                  aria-label={`Delete chat: ${session.title}`}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="history-footer">
            <span>{sessions.length} conversation{sessions.length !== 1 ? "s" : ""} saved</span>
          </div>
        )}
      </aside>
    </>
  );
}
