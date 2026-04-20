import { useCallback, useEffect, useRef, useState } from "react";
import { sendChat, checkHealth } from "../api/assistant";

// ── Constants ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mma_sessions_v2";
const MAX_SESSIONS = 30;

const WELCOME_MSG = () => ({
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your **AI assistant** — powered by Amazon Nova-Lite.\n\nI can help you:\n• 💬 Answer questions & write code\n• 🖼 Generate images — just say *\"generate image of…\"*\n• 🎙 Understand voice input\n• 📎 Analyze images you attach\n\nHow can I help you today?",
  timestamp: new Date().toISOString(),
});

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ── Session persistence ────────────────────────────────────────────────────────
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

function sessionTitle(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New Chat";
  const text = Array.isArray(first.content)
    ? (first.content.find((b) => b.text)?.text ?? "Image message")
    : first.content;
  return text.length > 50 ? text.slice(0, 50) + "…" : text;
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useAssistant() {
  const [messages, setMessages] = useState([WELCOME_MSG()]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState(loadSessions);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState("unknown"); // "ok" | "error" | "unknown"

  // Refs
  const recognizerRef = useRef(null);
  const interimRef = useRef("");       // accumulates interim voice transcript
  const abortRef = useRef(null);       // AbortController for the current request
  const sendingRef = useRef(false);    // prevents duplicate sends
  const lastSentRef = useRef({ text: "", time: 0 });
  const sendMessageRef = useRef(null); // stable ref to sendMessage

  // ── Persist sessions ──────────────────────────────────────────────────────────
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  // ── Backend health check on mount ─────────────────────────────────────────────
  useEffect(() => {
    checkHealth().then((data) => {
      setBackendStatus(data?.status === "ok" ? "ok" : "error");
    });
  }, []);

  // ── Session helpers ────────────────────────────────────────────────────────────
  const _saveCurrentSession = useCallback(
    (msgs) => {
      const real = msgs.filter((m) => m.id !== "welcome");
      if (!real.length) return;
      const title = sessionTitle(real);
      const sessionId = currentSessionId || newId();
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        return [
          { id: sessionId, title, messages: msgs, updatedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, MAX_SESSIONS);
      });
      if (!currentSessionId) setCurrentSessionId(sessionId);
    },
    [currentSessionId]
  );

  const startNewChat = useCallback(() => {
    _saveCurrentSession(messages);
    setCurrentSessionId(newId());
    setMessages([WELCOME_MSG()]);
    setInput("");
    setAttachment(null);
    setAttachmentPreview(null);
    setError(null);
  }, [messages, _saveCurrentSession]);

  const loadSession = useCallback((id) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === id);
      if (!session) return prev;
      setCurrentSessionId(id);
      setMessages(session.messages);
      setInput("");
      setAttachment(null);
      setAttachmentPreview(null);
      setError(null);
      return prev;
    });
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);

  // ── Send Message ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (overrideText) => {
      const text = (overrideText ?? input).trim();
      if (!text && !attachment) return;
      if (sendingRef.current) return;

      // Debounce: ignore if same text sent within 800ms
      const now = Date.now();
      if (
        lastSentRef.current.text === text &&
        now - lastSentRef.current.time < 800
      ) {
        return;
      }
      lastSentRef.current = { text, time: now };
      sendingRef.current = true;

      setError(null);
      setInput("");
      setIsLoading(true);

      // Build content (text or multimodal with image)
      const finalContent = attachment
        ? [
            { image: { format: attachment.format, source: { bytes: attachment.bytes } } },
            { text: text || "Analyze this image." },
          ]
        : text;

      const userMsg = {
        id: newId(),
        role: "user",
        content: finalContent,
        timestamp: new Date().toISOString(),
      };

      setAttachment(null);
      setAttachmentPreview(null);

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);

      // Strip heavy image bytes from history (keep only text for prior turns)
      const history = updatedMessages
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => {
          if (Array.isArray(content)) {
            const textBlocks = content.filter((b) => b.text);
            return { role, content: textBlocks.length ? textBlocks : [{ text: "[image]" }] };
          }
          return { role, content };
        });

      // Re-inject full image bytes for the current message only
      if (Array.isArray(finalContent)) {
        history[history.length - 1] = { role: "user", content: finalContent };
      }

      // Create abort controller for this request
      abortRef.current = new AbortController();

      try {
        const data = await sendChat(history, voiceEnabled, abortRef.current.signal);

        const assistantMsg = {
          id: newId(),
          role: "assistant",
          timestamp: new Date().toISOString(),
          content: data.response,
          audio_url: data.audio_url || null,
          image_url: data.image_url || null,
          tokens_used: data.tokens_used || null,
          model_id: data.model_id || null,
        };

        const withAssistant = [...updatedMessages, assistantMsg];
        setMessages(withAssistant);
        _saveCurrentSession(withAssistant);
      } catch (err) {
        if (err.name !== "CanceledError" && err.message !== "canceled") {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
        sendingRef.current = false;
        abortRef.current = null;
      }
    },
    [input, voiceEnabled, attachment, messages, _saveCurrentSession]
  );

  sendMessageRef.current = sendMessage;

  // ── Cancel in-flight request ──────────────────────────────────────────────────
  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, []);

  // ── Voice Input (Web Speech API) ──────────────────────────────────────────────
  const startRecording = useCallback(() => {
    setError(null);
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Your browser does not support Speech Recognition. Try Chrome.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsRecording(true);
        interimRef.current = "";
      };

      rec.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        // Show interim in the input field for feedback
        const display = final || interim;
        setInput(display);
        interimRef.current = display;
      };

      rec.onend = () => {
        setIsRecording(false);
        const transcript = interimRef.current.trim();
        interimRef.current = "";
        if (transcript) {
          sendMessageRef.current(transcript);
        }
      };

      rec.onerror = (event) => {
        if (event.error !== "no-speech") {
          setError(`Voice error: ${event.error}`);
        }
        setIsRecording(false);
        interimRef.current = "";
      };

      recognizerRef.current = rec;
      rec.start();
    } catch (err) {
      setError(`Speech recognition failed: ${err.message}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recognizerRef.current && isRecording) {
      recognizerRef.current.stop();
    }
  }, [isRecording]);

  // ── File Attachment ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((file) => {
    if (!file) {
      setAttachment(null);
      setAttachmentPreview(null);
      return;
    }
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please attach a valid image file (JPEG, PNG, or WebP).");
      return;
    }

    const ext = file.type.split("/")[1];
    const format =
      ext === "jpeg" || ext === "jpg" ? "jpeg"
      : ext === "png" ? "png"
      : ext === "webp" ? "webp"
      : "jpeg";

    // Single FileReader for both preview and base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setAttachmentPreview(dataUrl);
      const b64 = dataUrl.split(",")[1];
      setAttachment({ bytes: b64, format });
    };
    reader.readAsDataURL(file);
  }, []);

  return {
    // State
    messages,
    input,
    setInput,
    isLoading,
    isRecording,
    isTranscribing: false,
    voiceEnabled,
    setVoiceEnabled,
    error,
    clearError: () => setError(null),
    backendStatus,
    // Session
    sessions,
    currentSessionId,
    startNewChat,
    loadSession,
    deleteSession,
    // Actions
    sendMessage,
    cancelRequest,
    toggleRecording: () => (isRecording ? stopRecording() : startRecording()),
    // Attachment
    attachmentPreview,
    handleFileChange,
    clearAttachment: () => {
      setAttachment(null);
      setAttachmentPreview(null);
    },
  };
}
