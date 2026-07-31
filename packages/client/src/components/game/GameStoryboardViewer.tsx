import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import {
  GripHorizontal,
  Loader2,
  Maximize2,
  PanelsTopLeft,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { GameTurnStoryboard, GameTurnStoryboardKeyframe } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { getChatToolbarButtonClass } from "../chat/ChatToolbarControls";
import { getStoryboardViewerWidthBounds } from "./game-storyboard-ui";

const STORYBOARD_VIEWER_CONTROL_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/10";

const STORYBOARD_KEYFRAME_STATUS_KEYS = {
  planned: "game.storyboard.status.planned",
  rendering_image: "game.storyboard.status.renderingImage",
  image_complete: "game.storyboard.status.imageComplete",
  rendering_video: "game.storyboard.status.renderingVideo",
  complete: "game.storyboard.status.complete",
  failed: "game.storyboard.status.failed",
} as const satisfies Record<GameTurnStoryboardKeyframe["status"], string>;

interface StoryboardPointerHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function GameStoryboardInlineViewer({
  storyboard,
  frame,
  frameSectionLabel,
  generating,
  position,
  width,
  size,
  playing,
  muted,
  videoRef,
  dragHandlers,
  resizeHandlers,
  onClose,
  onReplay,
  onTogglePlayback,
  onToggleMute,
  onChangeSize,
  onResizeByKeyboard,
  onVideoPlayingChange,
}: {
  storyboard: GameTurnStoryboard | null;
  frame: GameTurnStoryboardKeyframe | null;
  frameSectionLabel: string | null;
  generating: boolean;
  position: { x: number; y: number };
  width: number;
  size: "small" | "medium" | "large";
  playing: boolean;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  dragHandlers: StoryboardPointerHandlers;
  resizeHandlers: StoryboardPointerHandlers;
  onClose: () => void;
  onReplay: () => void;
  onTogglePlayback: () => void;
  onToggleMute: () => void;
  onChangeSize: () => void;
  onResizeByKeyboard: (delta: number) => void;
  onVideoPlayingChange: (videoId: string, playing: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { minWidth, maxWidth } = getStoryboardViewerWidthBounds();
  const framePosition =
    storyboard && frame
      ? Math.max(
          0,
          storyboard.keyframes.findIndex((item) => item.id === frame.id),
        )
      : 0;
  const hasVideo = !!frame?.video;

  return (
    <div
      data-game-skip-bg-nav="true"
      className="group pointer-events-auto fixed z-[60] cursor-grab select-none touch-none active:cursor-grabbing"
      style={{ left: position.x, top: position.y, width, maxWidth: "calc(100vw - 1.5rem)" }}
      onClick={(event) => event.stopPropagation()}
      {...dragHandlers}
      aria-label={localizeUi("ui.game.gamesurfacecomponent.storyboardViewerDragToMove")}
    >
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          className={getChatToolbarButtonClass({
            compact: true,
            sizeClassName: "h-7 w-7",
            className: "absolute -right-2 -top-2 z-20 shadow-lg",
          })}
          aria-label={localizeUi("ui.game.gamesurfacecomponent.closeStoryboardViewer")}
          title={localizeUi("ui.game.gamesurfacecomponent.closeStoryboardViewer")}
        >
          <X size={14} />
        </button>
        <div className="overflow-hidden rounded-xl border border-white/15 bg-black/75 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex min-w-0 cursor-grab items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/75 active:cursor-grabbing">
              <GripHorizontal size={13} className="shrink-0 text-white/45" />
              <PanelsTopLeft size={13} className="shrink-0 text-[var(--primary)]" />
              <span className="truncate">{localizeUi("ui.game.gamesurfacecomponent.storyboard")}</span>
            </div>
            <span className="shrink-0 text-[0.625rem] text-white/45">
              {frame ? frameSectionLabel : localizeUi("ui.game.gamesurfacecomponent.rendering")}
            </span>
          </div>

          {frame?.video ? (
            <video
              ref={videoRef}
              key={frame.video.id}
              src={frame.video.url}
              autoPlay={playing}
              controls
              muted={muted}
              playsInline
              onPlay={() => onVideoPlayingChange(frame.video!.id, true)}
              onPause={() => onVideoPlayingChange(frame.video!.id, false)}
              onEnded={() => onVideoPlayingChange(frame.video!.id, false)}
              className="aspect-video w-full cursor-auto touch-auto bg-black object-cover"
              data-storyboard-viewer-no-drag
            />
          ) : frame?.image ? (
            <img
              src={frame.image.url}
              alt={
                frame.title ||
                localizeUi("game.storyboard.keyframeAlt", {
                  index: frame.index + 1,
                })
              }
              className="aspect-video w-full bg-black object-cover"
              draggable={false}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center gap-2 bg-black/45 text-xs text-white/55">
              {generating ? <Loader2 size={14} className="animate-spin" /> : null}
              {frame
                ? localizeUi(STORYBOARD_KEYFRAME_STATUS_KEYS[frame.status])
                : localizeUi("ui.game.gamesurfacecomponent.creatingStoryboard")}
            </div>
          )}

          <div className="space-y-2 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold text-white/90">
                {frame?.title || storyboard?.title || localizeUi("ui.game.gamesurfacecomponent.storyboardTurn")}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {hasVideo ? (
                  <>
                    <button
                      type="button"
                      onClick={onReplay}
                      className={STORYBOARD_VIEWER_CONTROL_BUTTON}
                      title={localizeUi("ui.game.gamesurfacecomponent.replayStoryboardVideo")}
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={onTogglePlayback}
                      className={STORYBOARD_VIEWER_CONTROL_BUTTON}
                      title={
                        playing
                          ? localizeUi("ui.game.gamesurfacecomponent.pauseStoryboardVideo")
                          : localizeUi("ui.game.gamesurfacecomponent.playStoryboardVideo")
                      }
                    >
                      {playing ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className={STORYBOARD_VIEWER_CONTROL_BUTTON}
                      title={
                        muted
                          ? localizeUi("ui.game.gamesurfacecomponent.unmuteStoryboardVideo")
                          : localizeUi("ui.game.gamesurfacecomponent.muteStoryboardVideo")
                      }
                    >
                      {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={onChangeSize}
                  className={STORYBOARD_VIEWER_CONTROL_BUTTON}
                  title={localizeUi("ui.game.replaystoryboardmedia.changeStoryboardViewerSizeCurrentValue1", {
                    value1: size,
                  })}
                >
                  <Maximize2 size={13} />
                </button>
                {storyboard?.keyframes.length ? (
                  <span className="ml-1 text-[0.625rem] text-white/45">
                    {framePosition + 1}/{storyboard.keyframes.length}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="line-clamp-2 text-[0.6875rem] leading-4 text-white/58">
              {frame?.anchorQuote ||
                frame?.narrationBeat ||
                storyboard?.error ||
                localizeUi("game.storyboard.generatingKeyframes")}
            </p>
            {storyboard?.keyframes.length ? (
              <div className="flex gap-1">
                {storyboard.keyframes.map((item) => (
                  <span
                    key={item.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      frame?.id === item.id ? "bg-[var(--primary)]" : "bg-white/15",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="absolute -bottom-2 -right-2 z-20 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] shadow-lg transition-all duration-150 hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-95"
          aria-label={localizeUi("ui.game.gamesurfacecomponent.resizeStoryboardViewer")}
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={minWidth}
          aria-valuemax={maxWidth}
          aria-valuenow={width}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            onResizeByKeyboard(event.key === "ArrowRight" ? 32 : -32);
          }}
          tabIndex={0}
          {...resizeHandlers}
        >
          <span className="h-2.5 w-2.5 rounded-br-sm border-b-2 border-r-2 border-current" />
        </div>
      </div>
    </div>
  );
}

export function GameStoryboardBackgroundVisual({
  frame,
  playing,
  muted,
  videoRef,
  onVideoPlayingChange,
}: {
  frame: GameTurnStoryboardKeyframe;
  playing: boolean;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onVideoPlayingChange: (videoId: string, playing: boolean) => void;
}) {
  return (
    <div
      data-game-skip-bg-nav="true"
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-black"
      aria-hidden="true"
    >
      {frame.video ? (
        <video
          ref={videoRef}
          key={frame.video.id}
          src={frame.video.url}
          poster={frame.image?.url}
          autoPlay={playing}
          muted={muted}
          playsInline
          onPlay={() => onVideoPlayingChange(frame.video!.id, true)}
          onPause={() => onVideoPlayingChange(frame.video!.id, false)}
          onEnded={() => onVideoPlayingChange(frame.video!.id, false)}
          className="h-full w-full bg-black object-contain transition-opacity duration-500"
        />
      ) : frame.image ? (
        <img
          src={frame.image.url}
          alt=""
          className="h-full w-full bg-black object-contain transition-opacity duration-500"
          draggable={false}
        />
      ) : null}
    </div>
  );
}
