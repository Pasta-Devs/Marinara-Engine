import type { GameTurnStoryboard, GameTurnStoryboardKeyframe } from "@marinara-engine/shared";
import { ChevronLeft, ChevronRight, PanelsTopLeft, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { isGameTurnStoryboardRendering } from "../../hooks/use-game-storyboards";
import { Spinner } from "../ui/Spinner";

const EMPTY_STORYBOARD_FRAMES: GameTurnStoryboardKeyframe[] = [];

export function RoleplayStoryboardMessageMedia({
  storyboard,
  generating = false,
  onOpenImage,
}: {
  storyboard: GameTurnStoryboard | null;
  generating?: boolean;
  onOpenImage: (frame: GameTurnStoryboardKeyframe) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const storyboardIdRef = useRef(storyboard?.id);
  const frames = storyboard?.keyframes ?? EMPTY_STORYBOARD_FRAMES;
  const firstVisibleFrame = useMemo(
    () => frames.find((frame) => frame.video || frame.image) ?? frames[0] ?? null,
    [frames],
  );
  const activeFrame = frames.find((frame) => frame.id === activeFrameId) ?? firstVisibleFrame;
  const activeIndex = activeFrame
    ? Math.max(
        0,
        frames.findIndex((frame) => frame.id === activeFrame.id),
      )
    : 0;
  const rendering = generating || isGameTurnStoryboardRendering(storyboard);

  useEffect(() => {
    const storyboardChanged = storyboardIdRef.current !== storyboard?.id;
    storyboardIdRef.current = storyboard?.id;
    setActiveFrameId((currentFrameId) => {
      if (storyboardChanged || !currentFrameId || !frames.some((frame) => frame.id === currentFrameId)) {
        return firstVisibleFrame?.id ?? null;
      }
      return currentFrameId;
    });
  }, [firstVisibleFrame?.id, frames, storyboard?.id]);

  if (!storyboard && !rendering) return null;

  const selectRelativeFrame = (offset: number) => {
    if (frames.length < 2) return;
    const nextIndex = (activeIndex + offset + frames.length) % frames.length;
    setActiveFrameId(frames[nextIndex]?.id ?? null);
  };

  return (
    <section
      className="mt-1.5 w-full overflow-hidden rounded-xl border border-white/12 bg-black/45 text-white shadow-lg shadow-black/20"
      aria-label={localizeUi("ui.game.gamesurfacecomponent.storyboard")}
      aria-live="polite"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="flex h-8 items-center justify-between gap-2 border-b border-white/10 px-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/65">
          <PanelsTopLeft size={12} className="shrink-0 text-[var(--primary)]" />
          <span className="truncate">{localizeUi("ui.game.gamesurfacecomponent.storyboard")}</span>
        </span>
        {frames.length > 1 ? (
          <span className="shrink-0 text-[0.5625rem] tabular-nums text-white/40">
            {activeIndex + 1}/{frames.length}
          </span>
        ) : null}
      </div>

      {storyboard?.error ? (
        <div
          className="flex items-start gap-2 border-b border-amber-200/20 bg-amber-300/12 px-3 py-2 text-amber-50"
          role="status"
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-200" />
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold">
              {localizeUi("ui.game.gamesurfacecomponent.storyboardDegradedResult")}
            </p>
            <p className="line-clamp-3 text-[0.625rem] leading-4 text-amber-50/75">{storyboard.error}</p>
          </div>
        </div>
      ) : null}

      {activeFrame?.video ? (
        <video
          key={activeFrame.video.id}
          src={activeFrame.video.url}
          poster={activeFrame.image?.url}
          controls
          preload="metadata"
          playsInline
          className="aspect-video max-h-[min(56vh,28rem)] w-full bg-black object-contain"
        />
      ) : activeFrame?.image ? (
        <button
          type="button"
          onClick={() => onOpenImage(activeFrame)}
          className="block w-full cursor-zoom-in bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
          title={localizeUi("ui.noodle.noodlepostcard.openImage")}
        >
          <img
            src={activeFrame.image.url}
            alt={
              activeFrame.title ||
              localizeUi("game.storyboard.keyframeAlt", {
                index: activeFrame.index + 1,
              })
            }
            loading="lazy"
            decoding="async"
            className="aspect-video max-h-[min(56vh,28rem)] w-full object-contain"
          />
        </button>
      ) : (
        <div className="flex min-h-20 items-center justify-center gap-2 px-4 py-5 text-xs text-white/55">
          {rendering ? <Spinner size="sm" /> : null}
          <span className="line-clamp-2 text-center">
            {rendering
              ? localizeUi("ui.game.gamesurfacecomponent.creatingStoryboard")
              : localizeUi("game.storyboard.status.failed")}
          </span>
        </div>
      )}

      {activeFrame || frames.length > 1 ? (
        <div className="flex min-h-9 items-center gap-2 border-t border-white/10 px-2 py-1.5">
          <p className="min-w-0 flex-1 truncate text-[0.6875rem] text-white/65">
            {activeFrame?.title || storyboard?.title || localizeUi("ui.game.gamesurfacecomponent.storyboardTurn")}
          </p>
          {frames.length > 1 ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => selectRelativeFrame(-1)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/8 text-white/60",
                  "transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                )}
                aria-label={localizeUi("ui.agents.storyboard.previousFrame")}
                title={localizeUi("ui.agents.storyboard.previousFrame")}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => selectRelativeFrame(1)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/8 text-white/60",
                  "transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
                )}
                aria-label={localizeUi("ui.agents.storyboard.nextFrame")}
                title={localizeUi("ui.agents.storyboard.nextFrame")}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
