export default function VoiceInput({ isRecording, isTranscribing, onToggle, disabled }) {
  const label = isTranscribing ? "Transcribing…" : isRecording ? "Stop Recording" : "Start Voice Input";

  return (
    <button
      className={`voice-btn ${isRecording ? "recording" : ""} ${isTranscribing ? "transcribing" : ""}`}
      onClick={onToggle}
      disabled={disabled || isTranscribing}
      title={label}
      aria-label={label}
    >
      {isTranscribing ? (
        <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-7 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5zm7 9v-2a7 7 0 0 0 7-7h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 7 7v2z" />
        </svg>
      )}
    </button>
  );
}
