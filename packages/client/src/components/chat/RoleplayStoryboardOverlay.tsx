import { useQueryClient } from "@tanstack/react-query";
import {
  mergeBuiltInAgentSettings,
  normalizeStoryboardAgentSettings,
  STORYBOARD_AGENT_ID,
  type GameTurnStoryboard,
} from "@marinara-engine/shared";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAgentConfigs } from "../../hooks/use-agents";
import {
  gameStoryboardKeys,
  isGameTurnStoryboardRendering,
  useGameTurnStoryboards,
  useGenerateGameTurnStoryboard,
} from "../../hooks/use-game-storyboards";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { GameStoryboardBackgroundVisual, GameStoryboardInlineViewer } from "../game/GameStoryboardViewer";
import {
  advanceRoleplayStoryboardAutomaticTrigger,
  resolveRoleplayStoryboardDisplayMode,
  type RoleplayStoryboardAutomaticTriggerState,
} from "./roleplay-storyboard-display";

type RoleplayStoryboardMessage = {
  id: string;
  role: string;
  activeSwipeIndex?: number;
};

const noopPointerHandler = (_event: ReactPointerEvent<HTMLDivElement>) => {};

function roleplayStoryboardViewerPosition() {
  if (typeof window === "undefined") return { x: 24, y: 72 };
  return { x: Math.max(12, window.innerWidth - 452), y: 72 };
}

export function RoleplayStoryboardOverlay({
  chatId,
  metadata,
  latestMessage,
  generationBusy,
  postProcessingPending,
  reopenToken = 0,
  onGenerationStateChange,
}: {
  chatId: string;
  metadata: Record<string, unknown>;
  latestMessage: RoleplayStoryboardMessage | null;
  generationBusy: boolean;
  postProcessingPending: boolean;
  reopenToken?: number;
  onGenerationStateChange?: (generating: boolean) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const queryClient = useQueryClient();
  const active =
    metadata.enableAgents === true &&
    Array.isArray(metadata.activeAgentIds) &&
    metadata.activeAgentIds.includes(STORYBOARD_AGENT_ID);
  const { data: agentConfigs } = useAgentConfigs(active);
  const storyboardConfig = useMemo(
    () => agentConfigs?.find((config) => config.type === STORYBOARD_AGENT_ID) ?? null,
    [agentConfigs],
  );
  const settings = useMemo(
    () => normalizeStoryboardAgentSettings(mergeBuiltInAgentSettings(STORYBOARD_AGENT_ID, storyboardConfig?.settings)),
    [storyboardConfig?.settings],
  );
  const viewerDisplayMode = resolveRoleplayStoryboardDisplayMode(metadata);
  const autoAnimationsEnabled =
    typeof metadata.gameStoryboardAutoGenerationEnabled === "boolean"
      ? metadata.gameStoryboardAutoGenerationEnabled
      : settings.autoGenerateMode === "animation";
  const autoIllustrationsEnabled =
    autoAnimationsEnabled ||
    (typeof metadata.gameStoryboardAutoIllustrationsEnabled === "boolean"
      ? metadata.gameStoryboardAutoIllustrationsEnabled
      : settings.autoGenerateMode !== "manual");
  const automaticMode = autoAnimationsEnabled ? "animation" : autoIllustrationsEnabled ? "illustration" : "manual";
  const swipeIndex = latestMessage?.activeSwipeIndex ?? 0;
  const storyboardTargetKey = latestMessage ? `${chatId}:${latestMessage.id}:${swipeIndex}` : null;
  const storyboardsQuery = useGameTurnStoryboards(chatId, latestMessage?.id, swipeIndex, active);
  const generateStoryboard = useGenerateGameTurnStoryboard();
  const attemptedKeyRef = useRef<string | null>(null);
  const automaticTriggerChatIdRef = useRef(chatId);
  const automaticTriggerRef = useRef<RoleplayStoryboardAutomaticTriggerState>({
    generationWasBusy: generationBusy,
    completedTargetKey: null,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [dismissedMessageId, setDismissedMessageId] = useState<string | null>(null);
  const [viewerPosition, setViewerPosition] = useState(roleplayStoryboardViewerPosition);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);

  const storyboard = storyboardsQuery.data?.[0] ?? null;
  const frames = storyboard?.keyframes ?? [];
  const firstVisibleFrame = frames.find((keyframe) => keyframe.video || keyframe.image) ?? frames[0] ?? null;
  const frame = frames.find((keyframe) => keyframe.id === activeFrameId) ?? firstVisibleFrame;
  const activeFrameIndex = frame
    ? Math.max(
        0,
        frames.findIndex((keyframe) => keyframe.id === frame.id),
      )
    : 0;
  const rendering = generateStoryboard.isPending || isGameTurnStoryboardRendering(storyboard);

  useEffect(() => {
    setActiveFrameId(firstVisibleFrame?.id ?? null);
  }, [firstVisibleFrame?.id, storyboard?.id]);

  useEffect(() => {
    onGenerationStateChange?.(rendering);
  }, [onGenerationStateChange, rendering]);

  useEffect(
    () => () => {
      onGenerationStateChange?.(false);
    },
    [onGenerationStateChange],
  );

  useEffect(() => {
    const updatePosition = () => setViewerPosition(roleplayStoryboardViewerPosition());
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  useEffect(() => {
    setDismissedMessageId(null);
  }, [reopenToken]);

  useEffect(() => {
    if (viewerDisplayMode === "background" && frame?.video?.id) {
      setPlayingVideoId(frame.video.id);
    }
  }, [frame?.video?.id, viewerDisplayMode]);

  useEffect(() => {
    if (automaticTriggerChatIdRef.current !== chatId) {
      automaticTriggerChatIdRef.current = chatId;
      automaticTriggerRef.current = { generationWasBusy: generationBusy, completedTargetKey: null };
      attemptedKeyRef.current = null;
      return;
    }
    if (generationBusy && !automaticTriggerRef.current.generationWasBusy) {
      attemptedKeyRef.current = null;
    }
    automaticTriggerRef.current = advanceRoleplayStoryboardAutomaticTrigger(
      automaticTriggerRef.current,
      generationBusy,
      storyboardTargetKey,
    );
  }, [chatId, generationBusy, storyboardTargetKey]);

  useEffect(() => {
    if (!active) {
      automaticTriggerRef.current.completedTargetKey = null;
      return;
    }
    if (!latestMessage || !storyboardTargetKey || agentConfigs === undefined || !storyboardsQuery.isFetched) return;
    if (automaticMode === "manual") {
      automaticTriggerRef.current.completedTargetKey = null;
      return;
    }
    if (generationBusy || postProcessingPending) return;
    const attemptKey = storyboardTargetKey;
    if (automaticTriggerRef.current.completedTargetKey !== attemptKey) {
      automaticTriggerRef.current.completedTargetKey = null;
      return;
    }
    if (storyboardsQuery.data?.length || storyboardsQuery.isError) {
      automaticTriggerRef.current.completedTargetKey = null;
      return;
    }
    if (attemptedKeyRef.current === attemptKey) return;
    attemptedKeyRef.current = attemptKey;
    automaticTriggerRef.current.completedTargetKey = null;
    void generateStoryboard
      .mutateAsync({
        chatId,
        messageId: latestMessage.id,
        swipeIndex,
        generateVideos: automaticMode === "animation",
        automatic: true,
      })
      .then((result) => {
        if (!("storyboard" in result)) return;
        queryClient.setQueryData<GameTurnStoryboard[]>(
          gameStoryboardKeys.turn(chatId, latestMessage.id, swipeIndex),
          (current) => [result.storyboard, ...(current ?? []).filter((row) => row.id !== result.storyboard.id)],
        );
        queryClient.setQueryData<GameTurnStoryboard[]>(gameStoryboardKeys.list(chatId), (current) => [
          result.storyboard,
          ...(current ?? []).filter((row) => row.id !== result.storyboard.id),
        ]);
      })
      .catch((error) => {
        console.warn("[storyboard/roleplay] Automatic storyboard generation failed", error);
      });
  }, [
    active,
    agentConfigs,
    chatId,
    generationBusy,
    latestMessage,
    postProcessingPending,
    queryClient,
    automaticMode,
    storyboardsQuery.data,
    storyboardsQuery.isError,
    storyboardsQuery.isFetched,
    swipeIndex,
    storyboardTargetKey,
    generateStoryboard,
  ]);

  if (!active || !latestMessage || dismissedMessageId === latestMessage.id || (!storyboard && !rendering)) return null;

  if (viewerDisplayMode === "inline") return null;

  const playing = !!frame?.video?.id && playingVideoId === frame.video.id;
  const onVideoPlayingChange = (videoId: string, isPlaying: boolean) => {
    setPlayingVideoId((current) => (isPlaying ? videoId : current === videoId ? null : current));
  };
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video || !frame?.video?.id) return;
    if (playing) {
      video.pause();
      setPlayingVideoId(null);
    } else {
      setPlayingVideoId(frame.video.id);
      void video.play().catch(() => setPlayingVideoId(null));
    }
  };
  const replay = () => {
    const video = videoRef.current;
    if (!video || !frame?.video?.id) return;
    video.currentTime = 0;
    setPlayingVideoId(frame.video.id);
    void video.play().catch(() => setPlayingVideoId(null));
  };
  const selectRelativeFrame = (offset: number) => {
    if (frames.length < 2) return;
    const nextIndex = (activeFrameIndex + offset + frames.length) % frames.length;
    setPlayingVideoId(null);
    setActiveFrameId(frames[nextIndex]?.id ?? null);
  };

  if (viewerDisplayMode === "background" && frame) {
    return (
      <>
        <GameStoryboardBackgroundVisual
          frame={frame}
          playing={playing}
          muted={muted}
          videoRef={videoRef}
          onVideoPlayingChange={onVideoPlayingChange}
        />
        {frames.length > 1 ? (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[5] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/15 bg-black/60 p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => selectRelativeFrame(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              aria-label={localizeUi("ui.agents.storyboard.previousFrame")}
              title={localizeUi("ui.agents.storyboard.previousFrame")}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-9 text-center text-[0.625rem] tabular-nums text-white/60">
              {activeFrameIndex + 1}/{frames.length}
            </span>
            <button
              type="button"
              onClick={() => selectRelativeFrame(1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              aria-label={localizeUi("ui.agents.storyboard.nextFrame")}
              title={localizeUi("ui.agents.storyboard.nextFrame")}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <GameStoryboardInlineViewer
      storyboard={storyboard}
      frame={frame}
      frameSectionLabel={frame ? `${frame.index + 1}/${storyboard?.keyframes.length ?? 1}` : null}
      generating={rendering}
      position={viewerPosition}
      width={440}
      size="medium"
      playing={playing}
      muted={muted}
      videoRef={videoRef}
      dragHandlers={{
        onPointerDown: noopPointerHandler,
        onPointerMove: noopPointerHandler,
        onPointerUp: noopPointerHandler,
        onPointerCancel: noopPointerHandler,
      }}
      resizeHandlers={{
        onPointerDown: noopPointerHandler,
        onPointerMove: noopPointerHandler,
        onPointerUp: noopPointerHandler,
        onPointerCancel: noopPointerHandler,
      }}
      onClose={() => setDismissedMessageId(latestMessage.id)}
      onReplay={replay}
      onTogglePlayback={togglePlayback}
      onToggleMute={() => setMuted((current) => !current)}
      onChangeSize={() => {}}
      onResizeByKeyboard={() => {}}
      onVideoPlayingChange={onVideoPlayingChange}
      onPreviousFrame={() => selectRelativeFrame(-1)}
      onNextFrame={() => selectRelativeFrame(1)}
      interactiveLayout={false}
    />
  );
}
