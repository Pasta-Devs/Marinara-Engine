import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronRight,
  History,
  Loader2,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  DirectionCommand,
  GameStoryboardViewerDisplayMode,
  GameTurnStoryboard,
  GameTurnStoryboardKeyframe,
  Message,
} from "@marinara-engine/shared";
import type { SpriteInfo } from "../../hooks/use-characters";
import { useGameSessions } from "../../hooks/use-game";
import { useGameTurnStoryboards } from "../../hooks/use-game-storyboards";
import { api } from "../../lib/api-client";
import { audioManager } from "../../lib/game-audio";
import { resolveAssetTag } from "../../lib/asset-fuzzy-match";
import { parseChatMetadata } from "../../lib/chat-display";
import { findReplayableGameSessionChat } from "../../lib/game-session-resolution";
import { findReplayStoryboardKeyframe } from "../../lib/game-storyboard-keyframes";
import type { AvatarCrop } from "@marinara-engine/shared";
import type { CharacterMap, PersonaInfo } from "../chat/chat-area.types";
import { buildGameSessionReplayTurns, type GameReplayPresentationCue } from "../../lib/game-session-replay";
import { useGameAssetStore } from "../../stores/game-asset.store";
import { useChatStore } from "../../stores/chat.store";
import { ttsService } from "../../lib/tts-service";
import { GameChoiceCards } from "./GameChoiceCards";
import { GameNarration } from "./GameNarration";
import { StoryboardBackgroundControls } from "./StoryboardBackgroundControls";
import { useTranslation as useUiTranslation } from "react-i18next";

interface SpeakerAvatarInfo {
  url: string;
  crop?: AvatarCrop | null;
  nameColor?: string;
  dialogueColor?: string;
}

const EMPTY_REPLAY_MESSAGES: Message[] = [];
const REPLAY_STORYBOARD_DEFAULT_WIDTH = 368;
type ReplayStoryboardViewerSize = "small" | "medium" | "large";
const REPLAY_STORYBOARD_PRESET_WIDTH: Record<ReplayStoryboardViewerSize, number> = {
  small: 288,
  medium: REPLAY_STORYBOARD_DEFAULT_WIDTH,
  large: 544,
};
const REPLAY_STORYBOARD_CONTROL_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/10";

function clampReplayStoryboardWidth(width: number): number {
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const minWidth = viewportWidth < 640 ? 180 : 240;
  return Math.max(minWidth, Math.min(width, Math.max(minWidth, viewportWidth - 24)));
}

function nextReplayStoryboardViewerSize(size: ReplayStoryboardViewerSize): ReplayStoryboardViewerSize {
  if (size === "small") return "medium";
  if (size === "medium") return "large";
  return "small";
}

function formatReplayStoryboardSectionLabel(frame: GameTurnStoryboardKeyframe): string {
  const start = frame.sectionStartIndex ?? frame.sectionEndIndex;
  const end = frame.sectionEndIndex ?? frame.sectionStartIndex;
  if (start == null || end == null) return `Keyframe ${frame.index + 1}`;
  if (start === end) return `Section ${start + 1}`;
  return `Sections ${Math.min(start, end) + 1}-${Math.max(start, end) + 1}`;
}

function ReplayStoryboardMedia({
  storyboard,
  segmentIndex,
  displayMode,
}: {
  storyboard: GameTurnStoryboard | null;
  segmentIndex: number | null;
  displayMode: GameStoryboardViewerDisplayMode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const frame = useMemo(
    () => findReplayStoryboardKeyframe(storyboard?.keyframes ?? [], segmentIndex),
    [segmentIndex, storyboard?.keyframes],
  );
  const [viewerWidth, setViewerWidth] = useState(() => clampReplayStoryboardWidth(REPLAY_STORYBOARD_DEFAULT_WIDTH));
  const [viewerSize, setViewerSize] = useState<ReplayStoryboardViewerSize>("medium");
  const [muted, setMuted] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const playing = !!frame?.video?.id && playingVideoId === frame.video.id;

  useEffect(() => {
    const handleResize = () => setViewerWidth((width) => clampReplayStoryboardWidth(width));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      resizeRef.current = { startX: event.clientX, startWidth: viewerWidth };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [viewerWidth],
  );

  const handleResizeMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setViewerWidth(clampReplayStoryboardWidth(resizeRef.current.startWidth + resizeRef.current.startX - event.clientX));
  }, []);

  const handleResizeEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setViewerWidth((width) => clampReplayStoryboardWidth(width + (event.key === "ArrowLeft" ? 24 : -24)));
  }, []);

  useEffect(() => {
    if (!frame?.video?.id) {
      setPlayingVideoId(null);
      return;
    }
    setPlayingVideoId(frame.video.id);
  }, [frame?.video?.id]);

  useEffect(() => {
    if (displayMode === "background") setMuted(false);
  }, [displayMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;
    if (playing) {
      if (video.ended) video.currentTime = 0;
      void video.play().catch(() => setPlayingVideoId(null));
    } else {
      video.pause();
    }
  }, [frame?.video?.id, muted, playing]);

  const handlePlaybackToggle = useCallback(() => {
    const video = videoRef.current;
    const videoId = frame?.video?.id;
    if (!video || !videoId) return;
    if (!video.paused && !video.ended) {
      setPlayingVideoId(null);
      video.pause();
      return;
    }
    if (video.ended || video.currentTime >= video.duration - 0.05) video.currentTime = 0;
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;
    setPlayingVideoId(videoId);
    void video.play().catch(() => setPlayingVideoId(null));
  }, [frame?.video?.id]);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    const videoId = frame?.video?.id;
    if (!video || !videoId) return;
    video.currentTime = 0;
    video.defaultPlaybackRate = 1;
    video.playbackRate = 1;
    setPlayingVideoId(videoId);
    void video.play().catch(() => setPlayingVideoId(null));
  }, [frame?.video?.id]);

  if (!frame?.video && !frame?.image) return null;

  const media = frame.video ? (
    <video
      ref={videoRef}
      key={frame.video.id}
      src={frame.video.url}
      poster={frame.image?.url}
      autoPlay={playing}
      muted={muted}
      playsInline
      onPlay={() => setPlayingVideoId(frame.video!.id)}
      onPause={() => setPlayingVideoId((current) => (current === frame.video!.id ? null : current))}
      onEnded={() => setPlayingVideoId((current) => (current === frame.video!.id ? null : current))}
      className={displayMode === "background" ? "h-full w-full object-contain" : "aspect-video w-full object-cover"}
    />
  ) : (
    <img
      src={frame.image!.url}
      alt={displayMode === "background" ? "" : frame.title || `Storyboard keyframe ${frame.index + 1}`}
      className={displayMode === "background" ? "h-full w-full object-contain" : "aspect-video w-full object-cover"}
      draggable={false}
    />
  );

  if (displayMode === "background") {
    return (
      <>
        <div
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-black"
          aria-label={localizeUi("ui.game.replaystoryboardmedia.replayStoryboardBackground")}
        >
          {media}
        </div>
        {frame.video ? (
          <div className="pointer-events-auto absolute right-3 top-16 z-40 md:right-4">
            <StoryboardBackgroundControls
              playing={playing}
              muted={muted}
              onReplay={handleReplay}
              onTogglePlayback={handlePlaybackToggle}
              onToggleMute={() => setMuted((current) => !current)}
            />
          </div>
        ) : null}
      </>
    );
  }

  const framePosition = Math.max(0, storyboard?.keyframes.findIndex((candidate) => candidate.id === frame.id) ?? 0);

  return (
    <div
      className="pointer-events-auto absolute right-3 top-20 z-30 max-w-[calc(100%-1.5rem)] md:right-4"
      style={{ width: viewerWidth }}
    >
      <aside className="overflow-hidden rounded-xl border border-white/15 bg-black/80 text-white shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-white/75">{localizeUi("ui.game.gamesurfacecomponent.storyboard")}</span>
          <span className="shrink-0 text-[0.625rem] text-white/45">{formatReplayStoryboardSectionLabel(frame)}</span>
        </div>
        <div className="bg-black">{media}</div>
        <div className="space-y-1.5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-white/90">
              {frame.title || storyboard?.title || "Storyboard turn"}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {frame.video ? (
                <>
                  <button
                    type="button"
                    onClick={handleReplay}
                    className={REPLAY_STORYBOARD_CONTROL_BUTTON}
                    title={localizeUi("ui.game.gamesurfacecomponent.replayStoryboardVideo")}
                    aria-label={localizeUi("ui.game.gamesurfacecomponent.replayStoryboardVideo")}
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaybackToggle}
                    className={REPLAY_STORYBOARD_CONTROL_BUTTON}
                    title={playing ?localizeUi("ui.game.gamesurfacecomponent.pauseStoryboardVideo") :localizeUi("ui.game.gamesurfacecomponent.playStoryboardVideo")}
                    aria-label={playing ?localizeUi("ui.game.gamesurfacecomponent.pauseStoryboardVideo") :localizeUi("ui.game.gamesurfacecomponent.playStoryboardVideo")}
                  >
                    {playing ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMuted((current) => !current)}
                    className={REPLAY_STORYBOARD_CONTROL_BUTTON}
                    title={muted ?localizeUi("ui.game.gamesurfacecomponent.unmuteStoryboardVideo") :localizeUi("ui.game.gamesurfacecomponent.muteStoryboardVideo")}
                    aria-label={muted ?localizeUi("ui.game.gamesurfacecomponent.unmuteStoryboardVideo") :localizeUi("ui.game.gamesurfacecomponent.muteStoryboardVideo")}
                  >
                    {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setViewerSize((current) => {
                    const next = nextReplayStoryboardViewerSize(current);
                    setViewerWidth(clampReplayStoryboardWidth(REPLAY_STORYBOARD_PRESET_WIDTH[next]));
                    return next;
                  })
                }
                className={REPLAY_STORYBOARD_CONTROL_BUTTON}
                title={localizeUi("ui.game.replaystoryboardmedia.changeStoryboardViewerSizeCurrentValue1", { value1: viewerSize })}
                aria-label={localizeUi("ui.game.replaystoryboardmedia.changeStoryboardViewerSizeCurrentValue1", { value1: viewerSize })}
              >
                <Maximize2 size={13} />
              </button>
              {storyboard?.keyframes.length ? (
                <span className="ml-1 shrink-0 text-[0.625rem] text-white/45">
                  {framePosition + 1}/{storyboard.keyframes.length}
                </span>
              ) : null}
            </div>
          </div>
          {frame.anchorQuote || frame.narrationBeat ? (
            <p className="line-clamp-2 text-[0.6875rem] leading-4 text-white/60">
              {frame.anchorQuote || frame.narrationBeat}
            </p>
          ) : null}
          {storyboard?.keyframes.length ? (
            <div className="flex gap-1" aria-hidden="true">
              {storyboard.keyframes.map((candidate) => (
                <span
                  key={candidate.id}
                  className={
                    candidate.id === frame.id
                      ? "h-1 flex-1 rounded-full bg-[var(--primary)]"
                      : "h-1 flex-1 rounded-full bg-white/15"
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </aside>
      <button
        type="button"
        className="absolute -bottom-2 -left-2 z-20 flex h-7 w-7 cursor-nesw-resize items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] shadow-lg transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] active:scale-95"
        aria-label={localizeUi("ui.game.replaystoryboardmedia.resizeReplayStoryboardViewer")}
        title={localizeUi("ui.game.replaystoryboardmedia.resizeReplayStoryboardViewer")}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
      >
        <span className="h-2.5 w-2.5 rounded-bl-sm border-b-2 border-l-2 border-current" />
      </button>
    </div>
  );
}

interface GameSessionReplayProps {
  gameId: string;
  sessionNumber: number;
  characterMap: CharacterMap;
  activeCharacterIds: string[];
  personaInfo?: PersonaInfo;
  spriteMap: Map<string, SpriteInfo[]>;
  speakerAvatarMap: Map<string, SpeakerAvatarInfo>;
  gameVoiceVolume: number;
  directionsActive: boolean;
  assetMap: Parameters<typeof resolveAssetTag>[2];
  useMusicDjPlayerMusic: boolean;
  onActiveSpeakerChange: (speaker: { name: string; avatarUrl: string; expression?: string } | null) => void;
  onBackgroundChange: (background: string | null) => void;
  onPlayDirections: (directions: DirectionCommand[]) => void;
  onMessagesLoaded: (messages: Message[]) => void;
  onExit: () => void;
}

export function GameSessionReplay({
  gameId,
  sessionNumber,
  characterMap,
  activeCharacterIds,
  personaInfo,
  spriteMap,
  speakerAvatarMap,
  gameVoiceVolume,
  directionsActive,
  assetMap,
  useMusicDjPlayerMusic,
  onActiveSpeakerChange,
  onBackgroundChange,
  onPlayDirections,
  onMessagesLoaded,
  onExit,
}: GameSessionReplayProps) {
  const { t: localizeUi } = useUiTranslation();
  const activeChatMetadata = useChatStore((state) => state.activeChat?.metadata);
  const storyboardDisplayMode: GameStoryboardViewerDisplayMode =
    parseChatMetadata(activeChatMetadata).gameStoryboardViewerDisplayMode === "background" ? "background" : "floating";
  const gameSessionsQuery = useGameSessions(gameId || null);
  const sessionChat = useMemo(
    () => findReplayableGameSessionChat(gameSessionsQuery.data, sessionNumber),
    [gameSessionsQuery.data, sessionNumber],
  );
  const replayMessagesQuery = useQuery({
    queryKey: ["game", "session-replay", sessionChat?.id ?? ""],
    queryFn: () => api.get<Message[]>(`/chats/${sessionChat!.id}/messages`),
    enabled: !!sessionChat?.id,
    staleTime: 60_000,
  });
  const messages = replayMessagesQuery.data ?? EMPTY_REPLAY_MESSAGES;
  const turns = useMemo(() => buildGameSessionReplayTurns(messages), [messages]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [turnComplete, setTurnComplete] = useState(false);
  const [replayComplete, setReplayComplete] = useState(false);
  const [activeStoryboardSegmentIndex, setActiveStoryboardSegmentIndex] = useState<number | null>(null);
  const turn = turns[turnIndex] ?? null;
  const presentedTurnIdRef = useRef<string | null>(null);
  const turnStoryboardsQuery = useGameTurnStoryboards(
    sessionChat?.id,
    turn?.message.id,
    turn?.message.activeSwipeIndex ?? 0,
    !!sessionChat?.id && !!turn?.message.id,
  );
  const replayStoryboard = turnStoryboardsQuery.data?.[0] ?? null;

  useEffect(() => {
    setTurnIndex(0);
    setTurnComplete(false);
    setReplayComplete(false);
    setActiveStoryboardSegmentIndex(null);
    presentedTurnIdRef.current = null;
  }, [sessionNumber]);

  useEffect(() => {
    setActiveStoryboardSegmentIndex(null);
  }, [turn?.message.id]);

  useEffect(() => {
    onMessagesLoaded(messages);
    return () => onMessagesLoaded([]);
  }, [messages, onMessagesLoaded]);

  const handlePresentationCue = useCallback(
    (cue: GameReplayPresentationCue, segmentIndex: number | null) => {
      const effects =
        segmentIndex == null ? [cue] : cue.segmentEffects.filter((effect) => effect.segment === segmentIndex);
      for (const effect of effects) {
        if (effect.background) {
          onBackgroundChange(resolveAssetTag(effect.background, "backgrounds", assetMap));
        }
        if (effect.music && !useMusicDjPlayerMusic) {
          audioManager.playMusic(resolveAssetTag(effect.music, "music", assetMap), assetMap);
        }
        if (effect.ambient) {
          audioManager.playAmbient(resolveAssetTag(effect.ambient, "ambient", assetMap), assetMap);
        }
        for (const sfx of effect.sfx ?? []) {
          audioManager.playSfx(resolveAssetTag(sfx, "sfx", assetMap), assetMap);
        }
        if (effect.directions?.length) {
          onPlayDirections(effect.directions);
        }
      }
    },
    [assetMap, onBackgroundChange, onPlayDirections, useMusicDjPlayerMusic],
  );

  const exitReplay = useCallback(() => {
    ttsService.stop();
    const { currentMusic, currentAmbient } = useGameAssetStore.getState();
    if (currentMusic && !useMusicDjPlayerMusic) audioManager.playMusic(currentMusic, assetMap);
    else if (!useMusicDjPlayerMusic) audioManager.stopMusic();
    if (currentAmbient) audioManager.playAmbient(currentAmbient, assetMap);
    else audioManager.stopAmbient();
    onExit();
  }, [assetMap, onExit, useMusicDjPlayerMusic]);

  const advance = useCallback(() => {
    if (turnIndex >= turns.length - 1) {
      setReplayComplete(true);
      return;
    }
    setTurnIndex((current) => current + 1);
    setTurnComplete(false);
    setActiveStoryboardSegmentIndex(null);
  }, [turnIndex, turns.length]);

  const restart = useCallback(() => {
    presentedTurnIdRef.current = null;
    setTurnIndex(0);
    setTurnComplete(false);
    setReplayComplete(false);
    setActiveStoryboardSegmentIndex(null);
  }, []);

  if (gameSessionsQuery.isLoading || (sessionChat && replayMessagesQuery.isLoading)) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-sm text-white/80 shadow-lg">
          <Loader2 size={15} className="animate-spin" />{localizeUi("ui.game.gamesessionreplay.loadingSession")} {sessionNumber} {localizeUi("ui.game.gamesessionreplay.replay")}</div>
      </div>
    );
  }

  const replayError =
    gameSessionsQuery.error instanceof Error
      ? gameSessionsQuery.error
      : replayMessagesQuery.error instanceof Error
        ? replayMessagesQuery.error
        : null;

  if (replayError || !sessionChat || !turn) {
    return (
      <div className="flex h-full flex-1 items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-white/15 bg-black/75 px-5 py-4 text-center shadow-lg">
          <History size={22} className="mx-auto text-white/55" />
          <h2 className="mt-3 text-sm font-semibold text-white">{localizeUi("ui.game.gamesessionreplay.replayUnavailable")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            {replayError?.message || "This session does not contain any replayable GM turns."}
          </p>
          <button
            type="button"
            onClick={exitReplay}
            className="mari-chrome-control mari-chrome-control--primary mt-4 px-4 py-2 text-xs"
          >{localizeUi("ui.game.gamesessionreplay.returnToCurrentSession")}</button>
        </div>
      </div>
    );
  }

  const turnMessages = [turn.playerMessage, turn.message].filter((message): message is Message => !!message);
  const choiceLabels = turn.choices.map((choice) => choice.label);
  const recordedChoiceLabel = turn.recordedChoice?.label ?? null;
  const hasChoices = choiceLabels.length > 0;

  const choicesSlot =
    turnComplete && hasChoices && !replayComplete ? (
      <div className="pointer-events-auto mb-2 flex max-h-[clamp(8rem,30svh,14rem)] min-h-0 w-full shrink justify-center overflow-hidden sm:max-h-[clamp(9rem,36svh,20rem)] md:max-h-[min(52dvh,32rem)]">
        <GameChoiceCards
          key={turn.message.id}
          choices={choiceLabels}
          replayChoice={recordedChoiceLabel}
          disabled={!recordedChoiceLabel}
          onSelect={advance}
        />
      </div>
    ) : undefined;

  const inputSlot = turnComplete ? (
    replayComplete ? (
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--foreground)]/75 dark:text-white/75">
          <Check size={13} className="text-emerald-400" />{localizeUi("ui.game.gamesessionreplay.sessionReplayComplete")}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={restart} className="mari-chrome-control px-3 py-1.5 text-xs">
            <RotateCcw size={12} />{localizeUi("ui.game.gamesessionreplay.watchAgain")}</button>
          <button
            type="button"
            onClick={exitReplay}
            className="mari-chrome-control mari-chrome-control--primary px-3 py-1.5 text-xs"
          >{localizeUi("ui.game.gamesessionreplay.returnToCurrentSession")}</button>
        </div>
      </div>
    ) : hasChoices ? (
      !recordedChoiceLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <span className="text-xs text-amber-300/80">{localizeUi("ui.game.gamesessionreplay.theOriginalChoiceWasNotRecordedForThisTurn")}</span>
          <button type="button" onClick={advance} className="mari-chrome-control px-3 py-1.5 text-xs">{localizeUi("ui.game.gamesessionreplay.continueReplay")}<ChevronRight size={12} />
          </button>
        </div>
      ) : undefined
    ) : (
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={advance}
          className="mari-chrome-control mari-chrome-control--primary px-3 py-1.5 text-xs"
        >
          {turnIndex >= turns.length - 1 ?localizeUi("ui.game.gamesessionreplay.finishReplay") :localizeUi("ui.game.gamesessionreplay.nextTurn")}
          <ChevronRight size={12} />
        </button>
      </div>
    )
  ) : undefined;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <ReplayStoryboardMedia
        storyboard={replayStoryboard}
        segmentIndex={activeStoryboardSegmentIndex}
        displayMode={storyboardDisplayMode}
      />

      <div className="pointer-events-auto absolute left-3 right-3 top-3 z-40 flex items-center justify-between gap-3 md:left-4 md:right-4">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white shadow-lg backdrop-blur-md">
          <History size={14} className="shrink-0 text-[var(--primary)]" />
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{localizeUi("game.toolbar.session")} {sessionNumber} {localizeUi("ui.game.gamesessionreplay.replay")}</div>
            <div className="text-[0.625rem] text-white/55">{localizeUi("ui.game.gamesurfacecomponent.turn")} {turnIndex + 1} {localizeUi("ui.noodle.noodlehome.of")} {turns.length} {localizeUi("ui.game.gamesessionreplay.readOnly")}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={exitReplay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/70 text-white/70 shadow-lg backdrop-blur-md transition-colors hover:bg-black/85 hover:text-white"
          title={localizeUi("ui.game.gamesessionreplay.returnToCurrentSession")}
          aria-label={localizeUi("ui.game.gamesessionreplay.returnToCurrentSession")}
        >
          <X size={15} />
        </button>
      </div>

      <GameNarration
        key={turn.message.id}
        messages={turnMessages}
        isStreaming={false}
        characterMap={characterMap}
        activeCharacterIds={activeCharacterIds}
        personaInfo={personaInfo}
        spriteMap={spriteMap}
        speakerAvatarMap={speakerAvatarMap}
        onActiveSpeakerChange={onActiveSpeakerChange}
        onSegmentEnter={(segmentIndex) => {
          setActiveStoryboardSegmentIndex(segmentIndex);
          if (presentedTurnIdRef.current !== turn.message.id) {
            presentedTurnIdRef.current = turn.message.id;
            handlePresentationCue(turn.presentation, null);
          }
          handlePresentationCue(turn.presentation, segmentIndex);
        }}
        showUserMessages
        partyDialogue={turn.partyDialogue}
        partyChatMessageId={turn.partyChatMessageId}
        hasStoredNarrationPosition={false}
        restoredSegmentIndex={0}
        onNarrationComplete={(complete, messageId) => {
          if (messageId === turn.message.id || messageId === turn.partyChatMessageId) setTurnComplete(complete);
        }}
        directionsActive={directionsActive}
        gameVoiceVolume={gameVoiceVolume}
        disableVoiceGeneration
        choicesSlot={choicesSlot}
        inputSlot={inputSlot}
      />
    </div>
  );
}
