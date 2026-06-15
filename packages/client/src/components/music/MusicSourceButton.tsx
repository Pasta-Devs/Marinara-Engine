import { useUIStore, type MusicPlayerSource } from "../../stores/ui.store";
import { cn } from "../../lib/utils";

function SpotifyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.1 9.2c3.4-1 7.2-.7 10.1.8M7.7 12.1c2.8-.8 6-.6 8.5.6M8.4 14.8c2.1-.5 4.6-.4 6.4.5"
        fill="none"
        stroke="var(--music-glyph-stroke, #06110a)"
        strokeLinecap="round"
        strokeWidth="1.45"
      />
    </svg>
  );
}

function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="3" y="6.5" width="18" height="11" rx="3" fill="currentColor" />
      <path d="M10.5 9.4v5.2l4.6-2.6-4.6-2.6Z" fill="var(--music-glyph-stroke, #f7f3ef)" />
    </svg>
  );
}

export function MusicSourceGlyph({ source, className }: { source: MusicPlayerSource; className?: string }) {
  return source === "spotify" ? (
    <SpotifyGlyph className={cn("h-4 w-4 [--music-glyph-stroke:#06110a]", className)} />
  ) : (
    <YouTubeGlyph className={cn("h-4 w-4 [--music-glyph-stroke:#f7f3ef]", className)} />
  );
}

export function MusicSourceButton({ source, className }: { source: MusicPlayerSource; className?: string }) {
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  const nextSource: MusicPlayerSource = source === "spotify" ? "youtube" : "spotify";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setMusicPlayerSource(nextSource);
      }}
      className={cn(
        "marinara-chat-toolbar-button inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] active:scale-95",
        className,
        source === "spotify" ? "text-[#1DB954]" : "text-[oklch(0.62_0.16_25)]",
      )}
      title={`Switch to ${nextSource === "spotify" ? "Spotify" : "YouTube"} player`}
      aria-label={`Switch to ${nextSource === "spotify" ? "Spotify" : "YouTube"} player`}
    >
      <MusicSourceGlyph source={source} />
    </button>
  );
}
