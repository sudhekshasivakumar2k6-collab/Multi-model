import { useCallback, useEffect, useRef, useState } from "react";
import ChatWindow from "./components/ChatWindow";
import ChatHistory from "./components/ChatHistory";
import VoiceInput from "./components/VoiceInput";
import { useAssistant } from "./hooks/useAssistant";

// ── Icons ─────────────────────────────────────────────────────────────────────
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M2 21 23 12 2 3v7l15 2-15 2v7z" />
  </svg>
);

const PaperclipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    width="18" height="18" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

// ── Backend status dot ─────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const labels = {
    ok: "Backend online",
    error: "Backend offline — using cached or no responses",
    unknown: "Checking backend…",
  };
  return (
    <span
      className={`status-dot status-${status}`}
      title={labels[status] || ""}
      aria-label={labels[status] || ""}
    />
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [historyOpen, setHistoryOpen] = useState(false);

  const {
    messages, input, setInput, isLoading,
    isRecording, isTranscribing, voiceEnabled, setVoiceEnabled,
    error, clearError, sendMessage, cancelRequest, toggleRecording,
    attachmentPreview, handleFileChange, clearAttachment,
    sessions, currentSessionId, backendStatus,
    startNewChat, loadSession, deleteSession,
  } = useAssistant();

  const textareaRef = useRef(null);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  // Keyboard handlers
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape") {
      clearAttachment();
    }
  };

  const canSend = (input.trim().length > 0 || !!attachmentPreview) && !isLoading;

  return (
    <div className="app">
      {/* Chat History Sidebar */}
      <ChatHistory
        sessions={sessions}
        currentSessionId={currentSessionId}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onNewChat={startNewChat}
        onLoadSession={loadSession}
        onDeleteSession={deleteSession}
      />

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button
            className="history-toggle-btn"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Chat history"
            aria-label="Toggle chat history"
            id="btn-history-toggle"
          >
            <HistoryIcon />
            {sessions.length > 0 && (
              <span className="history-badge">
                {sessions.length > 99 ? "99+" : sessions.length}
              </span>
            )}
          </button>

          <div className="logo-icon" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" width="32" height="32">
              <circle cx="20" cy="20" r="18" fill="url(#logoGrad)" />
              <defs>
                <radialGradient id="logoGrad" cx="30%" cy="30%">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </radialGradient>
              </defs>
              <path d="M13 20a7 7 0 0 1 14 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="20" r="3" fill="#fff" />
            </svg>
          </div>

          <div>
            <h1 className="app-title">
              Multi-Modal Assistant
              <StatusDot status={backendStatus} />
            </h1>
            <p className="app-subtitle">Amazon Nova-Lite · Polly · Bedrock</p>
          </div>
        </div>

        <div className="header-right">
          <label className="voice-toggle" title="Enable voice responses after each reply">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              aria-label="Enable voice response"
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-label">🔊 Voice</span>
          </label>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠ {error}</span>
          <button onClick={clearError} aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* Chat Area */}
      <main className="app-main">
        <ChatWindow messages={messages} isLoading={isLoading} />
      </main>

      {/* Input Footer */}
      <footer className="input-bar-container">
        {attachmentPreview && (
          <div className="attachment-preview-bar">
            <img src={attachmentPreview} alt="Attached image preview" className="attachment-thumb" />
            <div className="attachment-info">
              <span className="attachment-label">Image attached</span>
              <button
                className="remove-attachment-btn"
                onClick={clearAttachment}
                title="Remove image (Esc)"
                aria-label="Remove attached image"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="input-bar">
          {/* Attach image */}
          <label className="attach-btn" title="Attach image (JPEG, PNG, WebP)">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                handleFileChange(e.target.files[0]);
                e.target.value = ""; // allow re-selecting same file
              }}
              disabled={isLoading || isTranscribing}
              aria-label="Attach image"
            />
            <PaperclipIcon />
          </label>

          {/* Voice */}
          <VoiceInput
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            onToggle={toggleRecording}
            disabled={isLoading}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording      ? "🎙 Listening… click mic to stop"
              : isTranscribing ? "Transcribing audio…"
              : 'Ask anything, or "generate image of…"'
            }
            rows={1}
            disabled={isLoading || isTranscribing}
            aria-label="Message input"
          />

          {/* Send / Cancel */}
          {isLoading ? (
            <button
              className="send-btn stop-btn"
              onClick={cancelRequest}
              title="Cancel response"
              aria-label="Cancel response"
              id="btn-stop"
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!canSend}
              aria-label="Send message"
              id="btn-send"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
