// ──────────────────────────────────────────────
// A story clock (Capability API 1.342): a number flag drawn as a circle of segments, one filled per point.
// ──────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import type { StoryClock, WorldJournal } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

/** The circle: `segments` wedges with a small gap between them, the first `filled` lit. */
export function StoryClockDial({ clock, size = 28 }: { clock: StoryClock; size?: number }) {
  const { t: localizeUi } = useUiTranslation();
  const r = size / 2;
  const inner = r * 0.38;
  const gap = clock.segments > 1 ? Math.min(0.12, Math.PI / clock.segments / 3) : 0;
  const wedges = Array.from({ length: clock.segments }, (_, index) => {
    const from = (index / clock.segments) * Math.PI * 2 - Math.PI / 2 + gap / 2;
    const to = ((index + 1) / clock.segments) * Math.PI * 2 - Math.PI / 2 - gap / 2;
    const point = (radius: number, angle: number) =>
      `${(r + radius * Math.cos(angle)).toFixed(2)} ${(r + radius * Math.sin(angle)).toFixed(2)}`;
    const large = to - from > Math.PI ? 1 : 0;
    const d = `M ${point(inner, from)} L ${point(r - 1, from)} A ${r - 1} ${r - 1} 0 ${large} 1 ${point(r - 1, to)} L ${point(inner, to)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, from)} Z`;
    return <path key={index} d={d} className={index < clock.filled ? "fill-amber-300" : "fill-white/12"} />;
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={localizeUi("ui.game.storyClock.label", {
        title: clock.title,
        filled: clock.filled,
        segments: clock.segments,
      })}
      className={cn("shrink-0", clock.full && "drop-shadow-[0_0_4px_rgba(252,211,77,0.7)]")}
    >
      {wedges}
    </svg>
  );
}

/** The story's clocks and ending the player can see, read with the World tab's journal after each turn. */
export function useStoryJournal(chatId: string | null, turnKey: string | null) {
  return useQuery({
    // Under the world journal's key (so its refreshes reach it) but never the same entry: this one keeps
    // only the story's part, which the World tab's query must not read as its journal.
    queryKey: ["game", "world-journal", chatId, turnKey, "story"],
    queryFn: async () => {
      const journal = (await api.get<{ journal: WorldJournal | null }>(`/game/${chatId}/world-journal`)).journal;
      return { clocks: journal?.clocks ?? [], ending: journal?.ending ?? null, music: journal?.music ?? null };
    },
    enabled: Boolean(chatId),
    staleTime: 30_000,
    retry: false,
  });
}

/** The clocks as a small strip on the game's screen: each dial with its title, its line on hover. */
export function StoryClockStrip({ clocks }: { clocks: readonly StoryClock[] }) {
  if (!clocks.length) return null;
  return (
    <div className="pointer-events-auto flex flex-wrap gap-1.5" data-story-clocks="">
      {clocks.map((clock) => (
        <div
          key={clock.flag}
          title={clock.text}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[0.6875rem] text-white/80 backdrop-blur-sm"
        >
          <StoryClockDial clock={clock} size={20} />
          <span className="max-w-28 truncate">{clock.title}</span>
        </div>
      ))}
    </div>
  );
}
