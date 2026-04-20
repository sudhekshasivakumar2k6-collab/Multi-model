import { useState } from "react";

export default function ImageDisplay({ url, prompt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!url) return null;

  return (
    <div className="image-display">
      {!loaded && !error && <div className="image-skeleton" />}
      {error ? (
        <div className="image-error">⚠ Image failed to load</div>
      ) : (
        <img
          src={url}
          alt={prompt || "Generated image"}
          className={`generated-image ${loaded ? "loaded" : "hidden"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
        />
      )}
      {loaded && prompt && (
        <p className="image-prompt-label">🖼 {prompt.length > 80 ? prompt.slice(0, 80) + "…" : prompt}</p>
      )}
    </div>
  );
}
