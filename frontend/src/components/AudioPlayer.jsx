import { useEffect, useRef, useState } from "react";

export default function AudioPlayer({ url }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (url && audioRef.current) {
      audioRef.current.load();
      setProgress(0);
      setIsPlaying(false);
      setError(false);
    }
  }, [url]);

  if (!url) return null;

  const toggle = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {});
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration: d } = audioRef.current;
    if (d) setProgress((currentTime / d) * 100);
  };

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return "";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-player">
      <button
        className={`audio-btn ${isPlaying ? "playing" : ""}`}
        onClick={toggle}
        title={isPlaying ? "Pause" : "Play Voice Response"}
        aria-label={isPlaying ? "Pause audio" : "Play voice response"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        <span className="audio-label">{isPlaying ? "Pause" : "Voice"}</span>
      </button>

      {duration > 0 && (
        <div className="audio-progress-track" title={formatDuration(duration)}>
          <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && <span className="audio-error">Audio unavailable</span>}

      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); setProgress(0); }}
        onError={() => setError(true)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        style={{ display: "none" }}
      />
    </div>
  );
}
