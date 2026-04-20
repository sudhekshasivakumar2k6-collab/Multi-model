import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000,
  headers: { "Content-Type": "application/json" },
});

// ── Response interceptor: normalize errors ────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Don't transform abort/cancel errors — let callers handle them
    if (err.name === "AbortError" || err.name === "CanceledError" || err.message === "canceled") {
      return Promise.reject(err);
    }
    if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
      return Promise.reject(new Error("Request timed out. The AI is taking too long — please try again."));
    }
    if (!err.response) {
      return Promise.reject(new Error("Cannot reach the server. Is the backend running?"));
    }
    const detail = err.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || d).join(", ")
      : detail || err.message || "Unexpected error.";
    return Promise.reject(new Error(message));
  }
);

// ── Retry helper (1 retry on network/timeout errors only) ─────────────────────
// Never retries on AbortError (user cancelled) or client-side 4xx errors.
async function withRetry(fn, retries = 1) {
  try {
    return await fn();
  } catch (err) {
    const isAbort = err.name === "AbortError" || err.name === "CanceledError" || err.message === "canceled";
    const isClientError = err.response && err.response.status < 500;
    if (!isAbort && !isClientError && retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

// ── API calls ─────────────────────────────────────────────────────────────────
export async function sendChat(messages, voiceResponse = false, signal = null) {
  return withRetry(async () => {
    const { data } = await api.post(
      "/api/chat",
      { messages, voice_response: voiceResponse },
      { signal }
    );
    return data;
  });
}

export async function transcribeAudio(audioBlob, mediaFormat = "webm") {
  const form = new FormData();
  form.append("audio", audioBlob, `recording.${mediaFormat}`);
  const { data } = await api.post(`/api/transcribe?media_format=${mediaFormat}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 180_000, // Transcribe jobs take longer
  });
  return data.transcript;
}

export async function generateImage(prompt) {
  return withRetry(async () => {
    const { data } = await api.post("/api/image", { prompt });
    return data;
  });
}

export async function synthesizeSpeech(text) {
  const { data } = await api.post("/api/tts", { text });
  return data.audio_url;
}

export async function checkHealth() {
  try {
    const { data } = await api.get("/health", { timeout: 5000 });
    return data;
  } catch {
    return null;
  }
}
