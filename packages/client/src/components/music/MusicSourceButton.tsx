import { useUIStore, type MusicPlayerSource } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { Play } from "lucide-react";

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
  if (source === "spotify") {
    return <SpotifyGlyph className={cn("h-4 w-4 [--music-glyph-stroke:#06110a]", className)} />;
  }
  if (source === "youtube") {
    return <YouTubeGlyph className={cn("h-4 w-4 [--music-glyph-stroke:#f7f3ef]", className)} />;
  }
  return <Play className={cn("h-4 w-4 fill-current", className)} aria-hidden="true" />;
}

export function MusicSourceButton({ source, className }: { source: MusicPlayerSource; className?: string }) {
  const setMusicPlayerSource = useUIStore((s) => s.setMusicPlayerSource);
  const sourceOrder: MusicPlayerSource[] = ["spotify", "youtube", "custom"];
  const nextSource = sourceOrder[(sourceOrder.indexOf(source) + 1) % sourceOrder.length] ?? "spotify";
  const labels: Record<MusicPlayerSource, string> = {
    spotify: "Spotify",
    youtube: "YouTube",
    custom: "Custom",
  };
  const sourceClasses = cn(
    "border-[#f7f3ef]/15 bg-[#f7f3ef]/5 hover:border-[#f7f3ef]/30 hover:bg-[#f7f3ef]/10",
    source === "spotify" && "text-[#1DB954]",
    source === "youtube" && "text-[#FF0000]",
    source === "custom" && "text-[var(--primary)]",
  );

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setMusicPlayerSource(nextSource);
      }}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-95",
        sourceClasses,
        className,
      )}
      title={`Switch to ${labels[nextSource]} player`}
      aria-label={`Switch to ${labels[nextSource]} player`}
    >
      <MusicSourceGlyph source={source} />
    </button>
  );
}
