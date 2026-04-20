import { useRef } from "react";
import AudioPlayer from "./AudioPlayer";
import ImageDisplay from "./ImageDisplay";

// ── Markdown renderer ──────────────────────────────────────────────────────────
// Hand-rolled, no deps. Handles: code blocks, inline code, bold, italic,
// ordered lists (1. 2. 3.), unordered lists (• -), headers h1-h3, line breaks.
function renderMarkdown(text) {
  if (!text) return "";

  // Step 1: protect block-level HTML by converting blocks first,
  // then ONLY apply <br> to lines that are plain text (not block tags).
  return (
    text
      // ── Code blocks (```lang\n...\n```) ────────────────────────────────────
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="md-pre"><code class="md-code">${escapeHtml(code.trimEnd())}</code></pre>`
      )
      // ── Inline code ──────────────────────────────────────────────────────────
      .replace(/`([^`\n]+)`/g, (_, c) => `<code class="md-inline">${escapeHtml(c)}</code>`)
      // ── Bold **text** ────────────────────────────────────────────────────────
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      // ── Italic *text* ────────────────────────────────────────────────────────
      .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
      // ── Ordered list items (1. item) ─────────────────────────────────────────
      .replace(/^\d+\.\s+(.+)$/gm, '<li class="md-oli">$1</li>')
      // ── Wrap consecutive ordered <li class="md-oli"> in <ol> ─────────────────
      .replace(/(<li class="md-oli">.*<\/li>(\n|$))+/g, (m) =>
        `<ol class="md-ol">${m.replace(/ class="md-oli"/g, "")}</ol>`
      )
      // ── Unordered list items (• or -) ────────────────────────────────────────
      .replace(/^[•\-]\s+(.+)$/gm, "<li>$1</li>")
      // ── Wrap consecutive <li> in <ul> ────────────────────────────────────────
      .replace(/(<li>.*<\/li>(\n|$))+/g, (m) => `<ul class="md-ul">${m}</ul>`)
      // ── Headers (### ## #) ────────────────────────────────────────────────────
      .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
      // ── Newlines → <br> ──────────────────────────────────────────────────────
      // Only apply to lines that are NOT already block-level HTML to prevent
      // double line-breaks after code blocks, lists, and headers.
      .replace(/\n(?!<\/(ul|ol|pre|h[123])|<(ul|ol|pre|h[123]))/g, "<br />")
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ── Icons ──────────────────────────────────────────────────────────────────────
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" width="18" height="18">
    <circle cx="20" cy="20" r="18" fill="url(#botGrad)" />
    <defs>
      <radialGradient id="botGrad" cx="30%" cy="30%">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#6d28d9" />
      </radialGradient>
    </defs>
    <path d="M13 20a7 7 0 0 1 14 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="20" cy="20" r="3" fill="#fff" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────────────
export default function MessageBubble({ message }) {
  const { role, content, audio_url, image_url, timestamp, tokens_used, model_id } = message;
  const isUser = role === "user";
  const copyBtnRef = useRef(null);
  const copyTimerRef = useRef(null);

  // Parse content — handles string or multimodal array
  let textContent = content;
  let attachedImage = null;
  if (Array.isArray(content)) {
    const textBlock = content.find((c) => c.text);
    const imgBlock = content.find((c) => c.image);
    textContent = textBlock ? textBlock.text : "";
    if (imgBlock?.image?.source?.bytes) {
      attachedImage = `data:image/${imgBlock.image.format};base64,${imgBlock.image.source.bytes}`;
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent).then(() => {
      if (copyBtnRef.current) {
        copyBtnRef.current.dataset.copied = "true";
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => {
          if (copyBtnRef.current) delete copyBtnRef.current.dataset.copied;
        }, 2000);
      }
    });
  };

  return (
    <div className={`message-row ${isUser ? "user-row" : "assistant-row"}`}>
      {!isUser && (
        <div className="avatar assistant-avatar" aria-hidden="true">
          <BotIcon />
        </div>
      )}

      <div className={`bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
        {/* Attached image from user */}
        {attachedImage && (
          <img
            src={attachedImage}
            alt="User attachment"
            className="attached-image"
          />
        )}

        {/* Copy button (assistant only) */}
        {!isUser && (
          <button
            ref={copyBtnRef}
            className="copy-btn"
            onClick={handleCopy}
            title="Copy response"
            aria-label="Copy response to clipboard"
          >
            <span className="copy-icon"><CopyIcon /></span>
            <span className="check-icon"><CheckIcon /></span>
          </button>
        )}

        {/* Message text — markdown for assistant, plain for user */}
        {isUser ? (
          <p className="bubble-text">{textContent}</p>
        ) : (
          <div
            className="bubble-text md-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(textContent) }}
          />
        )}

        {/* Generated image */}
        {image_url && <ImageDisplay url={image_url} prompt={typeof content === "string" ? content : textContent} />}

        {/* Audio player */}
        {audio_url && <AudioPlayer url={audio_url} />}

        {/* Footer: timestamp */}
        <div className="bubble-footer">
          <span className="bubble-timestamp">
            {timestamp ? formatTime(timestamp) : ""}
          </span>
        </div>
      </div>

      {isUser && (
        <div className="avatar user-avatar" aria-hidden="true">
          <UserIcon />
        </div>
      )}
    </div>
  );
}
