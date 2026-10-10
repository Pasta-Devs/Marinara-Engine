import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { normalizeSemanticSummaryRetrievalSettings } from "@marinara-engine/shared";
import { toast } from "sonner";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { isMessageShadowedByLiveStream } from "../../lib/generation-stream-policy";
import { splitRoleplayParagraphs } from "../../lib/roleplay-vn-paragraphs";
import { ROLEPLAY_TTS_PARAGRAPH_EVENT, type RoleplayTTSParagraphDetail } from "../../lib/roleplay-vn-tts";
import { ttsService } from "../../lib/tts-service";
import { usePageActivity } from "../../hooks/use-page-activity";
import {
  appendContinuationMessageContent,
  isLongTermMemoryChatSummaryPromptAllowed,
  STORYBOARD_AGENT_ID,
  type GameTurnStoryboard,
  type ChatSummaryEntry,
  type AdvancedMemoryJob,
  type MarkerConfig,
  type PromptGroup,
  type PromptSection,
  type SceneForkMode,
  type SpritePlacement,
  type SpriteSide,
} from "@marinara-engine/shared";
import {
  BookOpen,
  FileText,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User,
  Puzzle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useRenderTimer } from "../../lib/perf-diagnostics";
import { getConnectedChatDisplayName } from "../../lib/chat-display";
import { playConfiguredNotificationPing } from "../../lib/notification-sound";
import { rememberBoundedSetValue } from "../../lib/bounded-set";
import { messageHasPendingPostProcessing, parseMessageExtraRecord } from "../../lib/chat-message-extra";
import { normalizeSpriteExpressionMap } from "../../lib/sprite-expression-state";
import { isMessageHiddenFromUser } from "../../lib/chat-message-visibility";
import {
  getTranscriptRenderWindow,
  resolveTranscriptRenderWindowSize,
  TRANSCRIPT_RENDER_WINDOW_STEP,
} from "../../lib/transcript-render-window";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useGameStateStore } from "../../stores/game-state.store";
import { useChatComposerFocused, useChatKeyboardOpen } from "../../hooks/use-visual-viewport-chat-bottom";
import { useActiveLorebookEntries, useLorebooks } from "../../hooks/use-lorebooks";
import { usePresetFull, usePresets } from "../../hooks/use-presets";
import { useInstalledCapabilityPackages } from "../../hooks/use-capability-packages";
import { CapabilityElement } from "../capabilities/CapabilityElement";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CyoaChoices } from "./CyoaChoices";
import { CHAT_CONTROL_WINDOW_IDS, ChatConnectedChatWindow, ChatControlWindow } from "./ChatControlWindow";
import { TrackerPanelBubble } from "./TrackerPanelBubble";
import { PHONE_BUBBLE_SIZE_PX, WINDOW_BUBBLE_SIZE_PX, WINDOW_MARGIN_PX } from "../../lib/floating-window-layout";
import { useMatchMedia } from "../../hooks/use-match-media";
import { CHAT_TOOLBAR_ICON_GAP_CLASS, getChatToolbarButtonClass } from "./ChatToolbarControls";
import { TranscriptWindowControls } from "./TranscriptWindowControls";
import { EndSceneBar } from "./SceneBanner";
import { ChatCommonOverlays, type ChatSettingsTools } from "./ChatCommonOverlays";
import { useProvideChatGalleryActions } from "../../hooks/use-chat-gallery-actions";
import { PinnedImageOverlay } from "./PinnedImageOverlay";
import type { SpriteDisplayMode } from "./sprite-display-modes";
import type {
  CharacterMap,
  ExpressionAvatarResolver,
  MessageSelectionToggle,
  MessageWithSwipes,
  PeekPromptData,
  PersonaInfo,
} from "./chat-area.types";
import type { ChatImage } from "../../hooks/use-gallery";
import {
  gameStoryboardKeys,
  useGameChatStoryboards,
  useGenerateGameTurnStoryboard,
} from "../../hooks/use-game-storyboards";

type ChatData = ComponentProps<typeof ChatCommonOverlays>["chat"];

const RoleplayTrackerWindow = lazy(async () => {
  const module = await import("./RoleplayTrackerWindow");
  return { default: module.RoleplayTrackerWindow };
});
const RoleplayHUD = lazy(async () => {
  const module = await import("./RoleplayHUD");
  return { default: module.RoleplayHUD };
});

const WeatherEffects = lazy(async () => {
  const module = await import("./WeatherEffects");
  return { default: module.WeatherEffects };
});

const SpriteOverlay = lazy(async () => {
  const module = await import("./SpriteOverlay");
  return { default: module.SpriteOverlay };
});

const EchoChamberPanel = lazy(async () => {
  const module = await import("./EchoChamberPanel");
  return { default: module.EchoChamberPanel };
});

const EncounterModal = lazy(async () => {
  const module = await import("./EncounterModal");
  return { default: module.EncounterModal };
});

const ChatSummaryPanel = lazy(async () => {
  const module = await import("./ChatSummaryPanel");
  return { default: module.ChatSummaryPanel };
});

const AuthorNotesPanel = lazy(async () => {
  const module = await import("./ChatRoleplayPanels");
  return { default: module.AuthorNotesPanel };
});

const ActiveLorebookEntriesContent = lazy(async () => {
  const module = await import("./ChatRoleplayPanels");
  return { default: module.ActiveLorebookEntriesContent };
});

const roleplayNotificationSeenKeys = new Set<string>();
const MAX_ROLEPLAY_NOTIFICATION_SEEN_KEYS = 5_000;
const BACKGROUND_CROSSFADE_MS = 700;

function useIsMobileToolbarViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobileViewport;
}

function WeatherEffectsConnected({ paused }: { paused: boolean }) {
  const weather = useGameStateStore((s) => s.current?.weather ?? null);
  const timeOfDay = useGameStateStore((s) => s.current?.time ?? null);
  return (
    <Suspense fallback={null}>
      <WeatherEffects weather={weather} timeOfDay={timeOfDay} paused={paused} />
    </Suspense>
  );
}

function getBackgroundBlurStyle(blurPx: number): Pick<CSSProperties, "filter" | "transform"> {
  if (blurPx <= 0) return {};
  return {
    filter: `blur(${blurPx}px)`,
    transform: `scale(${Math.min(1.08, 1 + blurPx * 0.0025)})`,
  };
}

function CrossfadeBackground({
  url,
  className,
  blurPx = 0,
}: {
  url: string | null;
  className?: string;
  blurPx?: number;
}) {
  const [bgA, setBgA] = useState<string | null>(url);
  const [bgB, setBgB] = useState<string | null>(null);
  const [aActive, setAActive] = useState(true);
  const activeSlot = useRef<"a" | "b">("a");
  const cleanupTimerRef = useRef<number | null>(null);
  const backgroundBlurStyle = getBackgroundBlurStyle(blurPx);

  useEffect(() => {
    const currentUrl = activeSlot.current === "a" ? bgA : bgB;
    if (url === currentUrl) return;

    if (!url) {
      applyUrl(null);
      return;
    }

    let cancelled = false;
    const image = document.createElement("img");
    image.onload = () => {
      if (!cancelled) applyUrl(url);
    };
    image.onerror = () => {
      if (cancelled || useUIStore.getState().chatBackground !== url) return;
      console.warn(`[Background] "${url}" could not be loaded — clearing`);
      useUIStore.getState().setChatBackground(null);
    };
    image.src = url;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };

    function applyUrl(nextUrl: string | null) {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
      if (activeSlot.current === "a") {
        setBgB(nextUrl);
        setAActive(false);
        activeSlot.current = "b";
        cleanupTimerRef.current = window.setTimeout(() => {
          cleanupTimerRef.current = null;
          setBgA(null);
        }, BACKGROUND_CROSSFADE_MS);
      } else {
        setBgA(nextUrl);
        setAActive(true);
        activeSlot.current = "a";
        cleanupTimerRef.current = window.setTimeout(() => {
          cleanupTimerRef.current = null;
          setBgB(null);
        }, BACKGROUND_CROSSFADE_MS);
      }
    }
  }, [bgA, bgB, url]);

  useEffect(
    () => () => {
      if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
    },
    [],
  );

  return (
    <>
      <img
        src={bgA ?? undefined}
        alt=""
        draggable={false}
        className={cn(
          "mari-background pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center",
          className,
        )}
        style={{
          opacity: aActive && bgA ? 1 : 0,
          transition: `opacity ${BACKGROUND_CROSSFADE_MS}ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out`,
          ...backgroundBlurStyle,
        }}
      />
      <img
        src={bgB ?? undefined}
        alt=""
        draggable={false}
        className={cn(
          "mari-background pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center",
          className,
        )}
        style={{
          opacity: !aActive && bgB ? 1 : 0,
          transition: `opacity ${BACKGROUND_CROSSFADE_MS}ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out`,
          ...backgroundBlurStyle,
        }}
      />
    </>
  );
}

const hasVisibleStreamText = (text: string) => /\S/u.test(text);

function RoleplayLiveStreamText({
  chatId,
  emptyLabel,
  renderText,
  completedParagraphOnly = false,
  paragraphIndex,
  onParagraphCount,
}: {
  chatId: string;
  emptyLabel: string;
  renderText: (text: string) => ReactNode;
  completedParagraphOnly?: boolean;
  paragraphIndex?: number;
  onParagraphCount?: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const textRef = useRef("");

  useLayoutEffect(() => {
    let frame: number | null = null;
    const readBuffer = (state: ReturnType<typeof useChatStore.getState>) => {
      const buffer = state.streamBuffers.get(chatId) ?? (state.activeChatId === chatId ? state.streamBuffer : "");
      const continuation = state.continuationStreams.get(chatId);
      return continuation
        ? appendContinuationMessageContent(continuation.content, buffer, continuation.addNewline)
        : buffer;
    };
    const apply = () => {
      frame = null;
      const buffer = readBuffer(useChatStore.getState());
      let next = buffer;
      if (completedParagraphOnly) {
        const paragraphs = splitRoleplayParagraphs(buffer, true);
        if (onParagraphCount) {
          onParagraphCount(Math.max(1, paragraphs.length));
        }
        if (paragraphs.length > 0) {
          const idx =
            paragraphIndex != null
              ? Math.max(0, Math.min(paragraphs.length - 1, paragraphIndex))
              : paragraphs.length - 1;
          next = paragraphs[idx] ?? "";
        } else {
          next = "";
        }
      }
      if (textRef.current !== next) {
        textRef.current = next;
        setText(next);
      }
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(apply);
    };

    apply();
    const unsubscribe = useChatStore.subscribe(readBuffer, schedule);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [chatId, completedParagraphOnly, onParagraphCount, paragraphIndex]);

  return <>{hasVisibleStreamText(text) ? renderText(text) : emptyLabel}</>;
}

function StreamingIndicator({
  activeChatId,
  chatCharIds,
  mergedGroupCharacterIds,
  characterMap,
  personaInfo,
  chatMode,
  groupChatMode,
  expressionAvatarResolver,
  visualNovel = false,
  visualNovelParagraphIndex,
  onVisualNovelParagraphCount,
  visualNovelMediaTarget,
}: {
  activeChatId: string;
  chatCharIds: string[];
  mergedGroupCharacterIds: string[];
  characterMap: CharacterMap;
  personaInfo?: PersonaInfo;
  chatMode: string;
  groupChatMode?: string;
  expressionAvatarResolver?: ExpressionAvatarResolver;
  visualNovel?: boolean;
  visualNovelParagraphIndex?: number;
  onVisualNovelParagraphCount?: (count: number) => void;
  visualNovelMediaTarget?: HTMLElement | null;
}) {
  const { t } = useTranslation();
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  const streamingOutputStarted = useChatStore((s) =>
    hasVisibleStreamText(s.streamBuffers.get(activeChatId) ?? (s.activeChatId === activeChatId ? s.streamBuffer : "")),
  );
  const streamingCharacterId = useChatStore((s) => s.streamingCharacterId);

  return (
    <div className="animate-message-in">
      <ChatMessage
        visualNovel={visualNovel}
        visualNovelParagraphIndex={visualNovelParagraphIndex}
        onVisualNovelParagraphCount={onVisualNovelParagraphCount}
        visualNovelMediaTarget={visualNovelMediaTarget}
        message={{
          id: "__streaming__",
          chatId: activeChatId,
          role: "assistant",
          characterId: streamingCharacterId ?? chatCharIds[0] ?? null,
          content: "",
          activeSwipeIndex: 0,
          extra: {
            displayText: null,
            isGenerated: true,
            tokenCount: 0,
            generationInfo: null,
            thinking: thinkingBuffer || null,
          },
          createdAt: new Date().toISOString(),
        }}
        isStreaming
        streamingOutputStarted={streamingOutputStarted}
        streamingContent={(renderText) => (
          <RoleplayLiveStreamText
            chatId={activeChatId}
            emptyLabel={t("chat.message.thinking")}
            renderText={renderText}
            completedParagraphOnly={visualNovel}
            paragraphIndex={visualNovelParagraphIndex}
            onParagraphCount={onVisualNovelParagraphCount}
          />
        )}
        characterMap={characterMap}
        personaInfo={personaInfo}
        chatMode={chatMode}
        groupChatMode={groupChatMode}
        chatCharacterIds={chatCharIds}
        mergedGroupCharacterIds={mergedGroupCharacterIds}
        expressionAvatarResolver={expressionAvatarResolver}
      />
    </div>
  );
}

function RegeneratingMessageContent({
  msg,
  visualNovelParagraphIndex,
  onVisualNovelParagraphCount,
  ...rest
}: {
  msg: MessageWithSwipes;
  visualNovelParagraphIndex?: number;
  onVisualNovelParagraphCount?: (count: number) => void;
} & Omit<ComponentProps<typeof ChatMessage>, "message" | "isStreaming">) {
  const { t } = useTranslation();
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  const isContinuation = useChatStore((s) => s.continuationStreams.get(msg.chatId)?.messageId === msg.id);
  const streamingOutputStarted = useChatStore((s) =>
    hasVisibleStreamText(s.streamBuffers.get(msg.chatId) ?? (s.activeChatId === msg.chatId ? s.streamBuffer : "")),
  );
  // A new swipe replaces the old media and reasoning; a continuation retains them.
  const parsedExtra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
  const cleanExtra = {
    ...parsedExtra,
    ...(!isContinuation
      ? {
          attachments: null,
          roleplayDocuments: null,
          roleplayCommandActivity: null,
          roleplayPrivateCommands: null,
          diceRollResult: null,
        }
      : {}),
    thinking: thinkingBuffer || (isContinuation ? parsedExtra.thinking : null),
  };
  return (
    <ChatMessage
      message={{ ...msg, extra: cleanExtra, content: "" }}
      isStreaming
      streamingOutputStarted={isContinuation || streamingOutputStarted}
      visualNovelParagraphIndex={visualNovelParagraphIndex}
      onVisualNovelParagraphCount={onVisualNovelParagraphCount}
      streamingContent={(renderText) => (
        <RoleplayLiveStreamText
          chatId={msg.chatId}
          emptyLabel={t("chat.message.thinking")}
          renderText={renderText}
          completedParagraphOnly={rest.visualNovel}
          paragraphIndex={visualNovelParagraphIndex}
          onParagraphCount={onVisualNovelParagraphCount}
        />
      )}
      {...rest}
      storyboard={isContinuation ? rest.storyboard : null}
      storyboardGenerating={isContinuation ? rest.storyboardGenerating : false}
    />
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function promptEnabled(value: unknown): boolean {
  return value !== false && value !== "false";
}

function readMarkerConfig(value: unknown): MarkerConfig | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as MarkerConfig;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as MarkerConfig) : null;
}

function groupPathEnabled(groupId: string | null, groupsById: Map<string, PromptGroup>): boolean {
  let currentId = groupId;
  const seen = new Set<string>();
  while (currentId) {
    if (seen.has(currentId)) return true;
    seen.add(currentId);
    const group = groupsById.get(currentId);
    if (!group) return true;
    if (!promptEnabled(group.enabled)) return false;
    currentId = group.parentGroupId;
  }
  return true;
}

function resolveChatSummaryInjectionHintKey(
  presetFull: { sections: PromptSection[]; groups: PromptGroup[] } | null | undefined,
): string | null {
  if (!presetFull) return null;

  const groupsById = new Map(presetFull.groups.map((group) => [group.id, group]));
  const summarySections = presetFull.sections.filter((section) => {
    const isMarker = (section.isMarker as unknown) === true || (section.isMarker as unknown) === "true";
    return isMarker && readMarkerConfig(section.markerConfig)?.type === "chat_summary";
  });
  const enabledSummarySections = summarySections.filter((section) => promptEnabled(section.enabled));
  const activeSummarySections = enabledSummarySections.filter((section) =>
    groupPathEnabled(section.groupId, groupsById),
  );

  if (summarySections.length === 0) {
    return "chat.summary.injectionHint.missingMarker";
  }
  if (activeSummarySections.length > 0) {
    return "chat.summary.injectionHint.activeMarker";
  }
  if (enabledSummarySections.length === 0) {
    return "chat.summary.injectionHint.disabledMarker";
  }
  return "chat.summary.injectionHint.disabledGroup";
}

/** Roleplay's Active Context: the cards, lorebooks and preset in use (a Chat Settings drawer). */
function ActiveContextLinksPanel({
  chat,
  chatMeta,
  chatCharIds,
  characterMap,
}: {
  chat: ChatData | null | undefined;
  chatMeta: Record<string, any>;
  chatCharIds: string[];
  characterMap: CharacterMap;
}) {
  const { t } = useTranslation();
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: activeLorebookScan, isLoading: activeLorebookScanLoading } = useActiveLorebookEntries(
    chat?.id ?? null,
    !!chat?.id,
  );

  if (!chat) return null;

  const inactiveCharacterIds = readStringArray(chatMeta.inactiveCharacterIds);
  const characterIds = chatCharIds.filter((id) => !inactiveCharacterIds.includes(id));
  const activeLorebookIds = readStringArray(chatMeta.activeLorebookIds);
  const promptPresetId = typeof chat.promptPresetId === "string" ? chat.promptPresetId : null;
  const triggeredEntries = activeLorebookScan?.entries ?? [];
  const skippedLorebookEntries = activeLorebookScan?.budgetSkippedEntries ?? [];
  const visibleLorebookIds = Array.from(
    new Set([
      ...activeLorebookIds,
      ...triggeredEntries.map((entry) => entry.lorebookId),
      ...skippedLorebookEntries.map((entry) => entry.lorebookId),
    ]),
  );
  const triggeredEntriesByLorebook = new Map<string, typeof triggeredEntries>();
  for (const entry of triggeredEntries) {
    const current = triggeredEntriesByLorebook.get(entry.lorebookId) ?? [];
    current.push(entry);
    triggeredEntriesByLorebook.set(entry.lorebookId, current);
  }
  const hasLinks =
    characterIds.length > 0 ||
    visibleLorebookIds.length > 0 ||
    triggeredEntries.length > 0 ||
    skippedLorebookEntries.length > 0 ||
    !!promptPresetId;

  if (!hasLinks) {
    return <p className="px-2 text-xs text-[var(--muted-foreground)]">{t("chat.settings.activeContextEmpty")}</p>;
  }

  const lorebookNameById = new Map((lorebooks ?? []).map((book) => [book.id, book.name]));
  const presetName = promptPresetId ? presets?.find((preset) => preset.id === promptPresetId)?.name : null;

  const openCharacter = (id: string) => useUIStore.getState().openCharacterDetail(id);
  const openLorebook = (id: string) => useUIStore.getState().openLorebookDetail(id);
  const openPreset = (id: string) => useUIStore.getState().openPresetDetail(id);

  const itemClassName =
    "marinara-chat-popover__item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)]";
  const iconClassName = "shrink-0 text-[var(--marinara-chat-chrome-panel-muted)]";
  return (
    <div data-component="RoleplayActiveContextPanel">
      <div className="space-y-1">
        {characterIds.map((id, index) => (
          <button key={id} type="button" className={itemClassName} onClick={() => openCharacter(id)}>
            <User size="0.8125rem" className={iconClassName} />
            <span className="min-w-0 flex-1 truncate">
              {characterMap.get(id)?.name ?? t("chat.toolbar.characterFallback", { number: index + 1 })}
            </span>
            <span className="shrink-0 text-[0.625rem] text-foreground/45">{t("editor.tabs.card")}</span>
          </button>
        ))}
        {visibleLorebookIds.map((id, index) => {
          const entries = triggeredEntriesByLorebook.get(id) ?? [];
          return (
            <button key={id} type="button" className={itemClassName} onClick={() => openLorebook(id)}>
              <BookOpen size="0.8125rem" className={iconClassName} />
              <span className="min-w-0 flex-1 truncate">
                {lorebookNameById.get(id) ?? t("chat.toolbar.lorebookFallback", { number: index + 1 })}
              </span>
              <span className="shrink-0 text-[0.625rem] text-foreground/45">
                {entries.length > 0
                  ? t("chat.toolbar.lorebookHits", { count: entries.length })
                  : t("chat.toolbar.lorebook")}
              </span>
            </button>
          );
        })}
        {(activeLorebookScanLoading || visibleLorebookIds.length > 0) && (
          <div className="mt-2 border-t border-[var(--marinara-chat-chrome-panel-divider)] pt-2">
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
                  <Loader2 size="0.75rem" className="animate-spin" />
                  {t("chat.toolbar.loadingActiveContext")}
                </div>
              }
            >
              <ActiveLorebookEntriesContent chatId={chat.id} />
            </Suspense>
          </div>
        )}
        {promptPresetId && (
          <button type="button" className={itemClassName} onClick={() => openPreset(promptPresetId)}>
            <FileText size="0.8125rem" className={iconClassName} />
            <span className="min-w-0 flex-1 truncate">{presetName ?? t("chat.toolbar.promptPreset")}</span>
            <span className="shrink-0 text-[0.625rem] text-foreground/45">{t("chat.toolbar.preset")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** Roleplay's Chat Summary drawer, with the hint about where the summary goes in the prompt. */
function RoleplaySummaryPanel({
  promptPresetId,
  ...props
}: Omit<ComponentProps<typeof ChatSummaryPanel>, "summaryInjectionHint"> & { promptPresetId?: string | null }) {
  const { t } = useTranslation();
  const { data: presetFull } = usePresetFull(promptPresetId ?? null);
  const summaryInjectionHintKey = useMemo(() => resolveChatSummaryInjectionHintKey(presetFull), [presetFull]);
  return (
    <Suspense fallback={<RoleplayDrawerLoading label={t("chat.settings.toolLoading")} />}>
      <ChatSummaryPanel {...props} summaryInjectionHint={summaryInjectionHintKey ? t(summaryInjectionHintKey) : null} />
    </Suspense>
  );
}

function RoleplayDrawerLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-3 text-xs text-[var(--muted-foreground)]">
      <Loader2 size="0.75rem" className="animate-spin" />
      {label}
    </div>
  );
}

/** Props for the full roleplay surface, including scene lifecycle and fork controls. */
type RoleplaySurfaceProps = {
  activeChatId: string;
  chat: ChatData | null | undefined;
  allChats: Array<{ id: string; name: string; metadata?: string | Record<string, unknown> | null }> | undefined;
  chatMeta: Record<string, any>;
  chatMode: string;
  isRoleplay: boolean;
  centerCompact: boolean;
  chatBackground: string | null;
  weatherEffects: boolean;
  expressionAgentEnabled: boolean;
  combatAgentEnabled: boolean;
  encounterActive: boolean;
  spritePosition: SpriteSide;
  spriteCharacterIds: string[];
  spriteDisplayModes: SpriteDisplayMode[];
  spriteExpressions: Record<string, string>;
  visibleExpressionSpriteIds?: readonly string[];
  expressionAvatarResolver?: ExpressionAvatarResolver;
  spritePlacements: Record<string, SpritePlacement>;
  spriteScale: number;
  expressionSpriteScale: number;
  fullBodySpriteScale: number;
  spriteOpacity: number;
  expressionSpriteOpacity: number;
  fullBodySpriteOpacity: number;
  spriteArrangeMode: boolean;
  enabledAgentTypes: Set<string>;
  manualTrackersActive: boolean;
  chatCharIds: string[];
  characterMap: CharacterMap;
  characterNames: string[];
  personaInfo?: PersonaInfo;
  messages: MessageWithSwipes[] | undefined;
  msgPayload: Array<{ role: string; characterId: string | null; content: string }>;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isStreaming: boolean;
  generationVisualsPaused: boolean;
  agentProcessing: boolean;
  regenerateMessageId: string | null;
  shouldAnimateMessages: boolean;
  summaryContextSize: number;
  totalMessageCount: number;
  lastAssistantMessageId: string | null;
  settingsOpen: boolean;
  settingsAnchor: ComponentProps<typeof ChatCommonOverlays>["settingsAnchor"];
  settingsInitialSection?: ComponentProps<typeof ChatCommonOverlays>["settingsInitialSection"];
  wizardOpen: boolean;
  peekPromptData: PeekPromptData | null;
  deleteDialogMessageId: string | null;
  deleteDialogCanDeleteSwipe: boolean;
  deleteDialogCanDeleteOtherSwipes: boolean;
  deleteDialogActiveSwipeIndex: number;
  deleteDialogSwipeCount: number;
  multiSelectMode: boolean;
  selectedMessageIds: Set<string>;
  groupChatMode?: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onLoadMore: () => void;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  /** N1: the user message whose reply failed, if any — drives the "Failed · Retry" line. */
  failedReplyMessageId?: string | null;
  failedReplyReason?: string;
  onRetryFailedReply?: () => void;
  /** R2: the reply that gets the checkup's quiet line, and the line itself. */
  replyCheckupMessageId?: string | null;
  replyCheckup?: ReactNode;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleConversationStart: (
    messageId: string,
    sharedStart: boolean,
    conversationStartForCharacterIds: string[],
  ) => void;
  onToggleHiddenFromAI: (messageId: string, hiddenFromAll: boolean, hiddenFromAICharacterIds?: string[]) => void;
  onPeekPrompt: (messageId?: string) => void;
  onBranch?: (messageId: string) => void;
  onCloneSceneFromHere?: (messageId: string) => void;
  isCloneSceneFromHereDisabled?: boolean;
  onToggleSelectMessage: (toggle: MessageSelectionToggle) => void;
  onRerunTrackers: () => void;
  onRerunSingleTracker: (agentType: string) => void;
  onStartEncounter: () => void;
  onConcludeScene: () => void;
  onAbandonScene: () => void;
  onForkScene: (sceneChatId: string, mode: SceneForkMode) => void;
  isForkingScene?: boolean;
  onOpenScheduleEditor?: ComponentProps<typeof ChatCommonOverlays>["onOpenScheduleEditor"];
  onCloseSettings: (options?: { force?: boolean }) => void;
  onIllustrate?: (prompt?: string, messageRange?: [string, string]) => void;
  onIllustrateWithAgent?: (agentType: string) => void | Promise<void>;
  onGenerateBackground?: () => void | Promise<void>;
  onGenerateVideo?: () => void | Promise<void>;
  onAnimateImage?: (image: ChatImage) => void | Promise<void>;
  onWizardFinish: () => void;
  onClosePeekPrompt: () => void;
  onResetSpritePlacements: () => void;
  onResetSpriteCharacterVisualSettings: (characterId: string) => void;
  onSpriteSideChange: (side: SpriteSide, characterId?: string) => void;
  onToggleSpriteArrange: () => void;
  spriteVisualSettings?: ComponentProps<typeof ChatCommonOverlays>["sceneSettings"]["spriteVisualSettings"];
  onSpriteVisualSettingsChange?: ComponentProps<
    typeof ChatCommonOverlays
  >["sceneSettings"]["onSpriteVisualSettingsChange"];
  onExpressionChange: (characterId: string, expression: string, options?: { immediate?: boolean }) => void;
  onSpritePlacementChange: (placementKey: string, placement: SpritePlacement) => void;
  onFinishSpritePlacement: () => void;
  onDeleteConfirm: () => void;
  onDeleteSwipe: () => void;
  onDeleteOtherSwipes: () => void;
  onDeleteMore: () => void;
  onCloseDeleteDialog: () => void;
  onBulkDelete: () => void;
  onCancelMultiSelect: () => void;
  onUnselectAllMessages: () => void;
  onSelectAllAboveSelection: () => void;
  onSelectAllBelowSelection: () => void;
  isGrouped: (index: number) => boolean;
};

export function ChatRoleplaySurface({
  activeChatId,
  chat,
  allChats,
  chatMeta,
  chatMode,
  isRoleplay,
  centerCompact,
  chatBackground,
  weatherEffects,
  expressionAgentEnabled,
  combatAgentEnabled,
  encounterActive,
  spritePosition,
  spriteCharacterIds,
  spriteDisplayModes,
  spriteExpressions,
  visibleExpressionSpriteIds,
  expressionAvatarResolver,
  spritePlacements,
  spriteScale,
  expressionSpriteScale,
  fullBodySpriteScale,
  spriteOpacity,
  expressionSpriteOpacity,
  fullBodySpriteOpacity,
  spriteArrangeMode,
  enabledAgentTypes,
  manualTrackersActive,
  chatCharIds,
  characterMap,
  characterNames,
  personaInfo,
  messages,
  msgPayload,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  isStreaming,
  generationVisualsPaused,
  agentProcessing,
  regenerateMessageId,
  shouldAnimateMessages,
  summaryContextSize,
  totalMessageCount,
  lastAssistantMessageId,
  settingsOpen,
  settingsAnchor,
  settingsInitialSection,
  wizardOpen,
  peekPromptData,
  deleteDialogMessageId,
  deleteDialogCanDeleteSwipe,
  deleteDialogCanDeleteOtherSwipes,
  deleteDialogActiveSwipeIndex,
  deleteDialogSwipeCount,
  multiSelectMode,
  selectedMessageIds,
  groupChatMode,
  scrollRef,
  messagesEndRef,
  onLoadMore,
  onDelete,
  onRegenerate,
  onEdit,
  failedReplyMessageId,
  failedReplyReason,
  onRetryFailedReply,
  replyCheckupMessageId,
  replyCheckup,
  onSetActiveSwipe,
  onToggleConversationStart,
  onToggleHiddenFromAI,
  onPeekPrompt,
  onBranch,
  onCloneSceneFromHere,
  isCloneSceneFromHereDisabled,
  onToggleSelectMessage,
  onRerunTrackers,
  onRerunSingleTracker,
  onStartEncounter,
  onConcludeScene,
  onAbandonScene,
  onForkScene,
  isForkingScene,
  onOpenScheduleEditor,
  onCloseSettings,
  onIllustrate,
  onIllustrateWithAgent,
  onGenerateBackground,
  onGenerateVideo,
  onAnimateImage,
  onWizardFinish,
  onClosePeekPrompt,
  onResetSpritePlacements,
  onResetSpriteCharacterVisualSettings,
  onSpriteSideChange,
  onToggleSpriteArrange,
  spriteVisualSettings,
  onSpriteVisualSettingsChange,
  onExpressionChange,
  onSpritePlacementChange,
  onFinishSpritePlacement,
  onDeleteConfirm,
  onDeleteSwipe,
  onDeleteOtherSwipes,
  onDeleteMore,
  onCloseDeleteDialog,
  onBulkDelete,
  onCancelMultiSelect,
  onUnselectAllMessages,
  onSelectAllAboveSelection,
  onSelectAllBelowSelection,
  isGrouped,
}: RoleplaySurfaceProps) {
  const continuationMessageId = useChatStore((s) => s.continuationStreams.get(activeChatId)?.messageId);
  const inlineStreamingMessageId = regenerateMessageId ?? continuationMessageId ?? null;
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const { data: installedCapabilities = [] } = useInstalledCapabilityPackages();
  const memoryContextStarts = useMemo(() => {
    const starts = new Map<string, string[]>();
    if (chatMeta.advancedMemory?.enabled !== true) return starts;
    const entries = (chatMeta.advancedMemoryState as AdvancedMemoryJob | undefined)?.contextStarts;
    if (!Array.isArray(entries)) return starts;
    for (const entry of entries) {
      if (!entry || typeof entry.messageId !== "string" || !Array.isArray(entry.audienceCharacterIds)) continue;
      // Older character-specific automatic windows are no longer active.
      if (entry.audienceCharacterIds.length) continue;
      starts.set(entry.sceneStartMessageId ?? entry.messageId, []);
    }
    return starts;
  }, [chatMeta.advancedMemory?.enabled, chatMeta.advancedMemoryState]);
  const activeAgentIds = chatMeta.activeAgentIds;
  const enabledConversationCapabilities =
    chatMeta.enableAgents === true
      ? installedCapabilities.filter((item) => {
          if (item.status !== "active" || !item.manifest.entrypoints.client) return false;
          if (item.manifest.kind.includes("conversation-calls")) return false;
          const contributedAgentIds = item.manifest.contributions?.agentDetail?.agentIds ?? [];
          return activeAgentIds.includes(item.id) || contributedAgentIds.some((id) => activeAgentIds.includes(id));
        })
      : [];
  const conversationToolbarPackages = enabledConversationCapabilities.filter((item) =>
    item.manifest.contributions?.slots?.includes("conversation-toolbar"),
  );
  const conversationSurfacePackages = enabledConversationCapabilities.filter((item) =>
    item.manifest.contributions?.slots?.includes("conversation-surface"),
  );
  const conversationCapabilityProps = {
    chatId: activeChatId,
    metadata: chatMeta,
    characterMap,
    chatCharIds,
    personaInfo,
  };
  // Panel-enabled chats use the Trackers button to reopen their selected surface.
  const phoneLayout = useMatchMedia("(max-width: 767px)");
  const trackerPanelEnabled = useUIStore((s) => s.trackerPanelEnabled);
  const trackerPanelOpen = useUIStore((s) => s.trackerPanelOpen);
  const showTrackerPanelBubble =
    trackerPanelEnabled &&
    trackerPanelOpen &&
    (chatMeta.enableAgents === true || chatMeta.advancedMemory?.enabled === true);
  const phoneSlotOffset = phoneLayout && showTrackerPanelBubble ? 1 : 0;
  useRenderTimer("rp-surface"); // [#3104 diagnostic]
  const isMobileToolbarViewport = useIsMobileToolbarViewport();
  const streamedMessageId = useChatStore((s) => s.streamedMessageIds.get(activeChatId) ?? null);
  const hasMobileDraftInput = useChatStore((s) => isMobileToolbarViewport && s.hasCurrentInput);
  const hasLiveStream = isStreaming;
  const linkedChatName = chat?.connectedChatId
    ? getConnectedChatDisplayName(allChats?.find((c) => c.id === chat.connectedChatId))
    : undefined;
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const chatBackgroundBlur = useUIStore((s) => s.chatBackgroundBlur);
  const roleplayReducedPaintEffects = useUIStore((s) => s.roleplayReducedPaintEffects);
  const defaultDisplayStyle = useUIStore((s) => s.roleplayDisplayStyle);
  const vnSpriteScale = useUIStore((s) => s.roleplayVnSpriteScale);
  const vnAutoPlay = useUIStore((s) => s.roleplayVnAutoPlay);
  const vnAutoPlayDelay = useUIStore((s) => s.roleplayVnAutoPlayDelay);
  const visualNovel = isRoleplay && (chatMeta.roleplayDisplayStyle ?? defaultDisplayStyle) === "visual-novel";
  const chatPosition = useUIStore((s) => s.roleplayChatPosition);
  const roleplayAvatarStyle = useUIStore((s) => s.roleplayAvatarStyle);
  const roleplayAvatarScale = useUIStore((s) => s.roleplayAvatarScale);
  const trackerPanelSide = useUIStore((s) => s.trackerPanelSide);
  // Left and Right apply on wide screens only (see globals.css); a narrow chat pane keeps the centred column.
  const sideChatPosition = chatPosition === "left" || chatPosition === "right" ? chatPosition : undefined;
  const [vnHistoryOpen, setVnHistoryOpen] = useState(false);
  const [vnHistoryHasDraft, setVnHistoryHasDraft] = useState(false);
  const [vnMediaTarget, setVnMediaTarget] = useState<HTMLDivElement | null>(null);
  const pendingVnHistoryScroll = useRef(false);
  const activeVnSpriteIds = useMemo(
    () =>
      Object.keys(
        normalizeSpriteExpressionMap(
          parseMessageExtraRecord(messages?.find((message) => message.id === lastAssistantMessageId)?.extra)
            .spriteExpressions,
        ),
      ),
    [messages, lastAssistantMessageId],
  );
  const pendingVnEdit = useRef<{ messageId?: string } | null>(null);
  const visibleVnMessages = useMemo(() => {
    return (messages ?? []).filter((message) => message.role !== "system" && !isMessageHiddenFromUser(message));
  }, [messages]);
  const latestVnMessage = visibleVnMessages[visibleVnMessages.length - 1];
  const pendingVnReply = useChatStore((s) => s.pendingVnReplies.get(activeChatId));

  // Visual Novel navigation: track selected message index and paragraph index within that message.
  // By default (or when null), it stays on the latest message.
  const [vnSelectedMessageId, setVnSelectedMessageId] = useState<string | null>(null);
  const [vnParagraphIndex, setVnParagraphIndex] = useState<number | null>(null);
  const [vnParagraphCount, setVnParagraphCount] = useState<number>(1);
  const [vnSpeech, setVnSpeech] = useState<RoleplayTTSParagraphDetail | null>(null);
  const pendingVnPrevious = useRef<string | null>(null);

  // Active message in VN view:
  const activeVnMessage = useMemo(() => {
    if (vnSelectedMessageId) {
      const found = visibleVnMessages.find((m) => m.id === vnSelectedMessageId);
      if (found) return found;
    }
    return latestVnMessage;
  }, [latestVnMessage, visibleVnMessages, vnSelectedMessageId]);

  const activeVnMessageIndex = useMemo(() => {
    return activeVnMessage ? visibleVnMessages.indexOf(activeVnMessage) : -1;
  }, [activeVnMessage, visibleVnMessages]);

  // Reset VN navigation when switching chats or when live stream starts/ends.
  useEffect(() => {
    setVnSelectedMessageId(null);
    setVnParagraphIndex(null);
    setVnSpeech(null);
    pendingVnPrevious.current = null;
  }, [activeChatId, hasLiveStream]);

  useEffect(() => {
    const index = visibleVnMessages.findIndex((message) => message.id === pendingVnPrevious.current);
    if (index > 0) {
      pendingVnPrevious.current = null;
      setVnSelectedMessageId(visibleVnMessages[index - 1]!.id);
      setVnParagraphIndex(null);
    }
  }, [visibleVnMessages]);

  // Consume only a generated reply, once its durable row replaces the stream.
  // Edits, cached swipes, and history navigation never create this marker.
  useEffect(() => {
    if (
      hasLiveStream ||
      !pendingVnReply ||
      latestVnMessage?.id !== pendingVnReply.id ||
      latestVnMessage.activeSwipeIndex !== pendingVnReply.activeSwipeIndex ||
      latestVnMessage.content !== pendingVnReply.content
    )
      return;
    setVnSelectedMessageId(null);
    setVnParagraphIndex(0);
    pendingVnPrevious.current = null;
    useChatStore.getState().setPendingVnReply(activeChatId, null);
  }, [activeChatId, hasLiveStream, latestVnMessage, pendingVnReply]);

  const currentParagraphIndex = vnParagraphIndex ?? Math.max(0, vnParagraphCount - 1);

  const [ttsState, setTtsState] = useState(ttsService.getState());
  useEffect(() => ttsService.subscribe((state) => setTtsState(state)), []);
  useEffect(() => {
    if (!visualNovel) return;
    const followSpeech = (event: Event) => {
      const detail = (event as CustomEvent<RoleplayTTSParagraphDetail>).detail;
      if (detail?.chatId !== activeChatId || !visibleVnMessages.some((message) => message.id === detail.messageId))
        return;
      setVnSelectedMessageId(detail.messageId);
      setVnSpeech(detail);
    };
    window.addEventListener(ROLEPLAY_TTS_PARAGRAPH_EVENT, followSpeech);
    return () => window.removeEventListener(ROLEPLAY_TTS_PARAGRAPH_EVENT, followSpeech);
  }, [activeChatId, visibleVnMessages, visualNovel]);

  // Navigation handlers
  const canGoPreviousParagraph =
    !isFetchingNextPage && (currentParagraphIndex > 0 || ((activeVnMessageIndex > 0 || hasNextPage) && !hasLiveStream));
  const canGoNextParagraph =
    currentParagraphIndex < vnParagraphCount - 1 ||
    (activeVnMessageIndex >= 0 && activeVnMessageIndex < visibleVnMessages.length - 1 && !hasLiveStream);

  const handlePreviousParagraph = useCallback(() => {
    if (currentParagraphIndex > 0) {
      setVnParagraphIndex(currentParagraphIndex - 1);
    } else if (activeVnMessageIndex > 0 && !hasLiveStream) {
      const prevMsg = visibleVnMessages[activeVnMessageIndex - 1];
      if (prevMsg) {
        setVnSelectedMessageId(prevMsg.id);
        setVnParagraphIndex(null); // defaults to last paragraph of previous message
      }
    } else if (!hasLiveStream && hasNextPage && !isFetchingNextPage && activeVnMessage) {
      pendingVnPrevious.current = activeVnMessage.id;
      onLoadMore();
    }
  }, [
    activeVnMessage,
    activeVnMessageIndex,
    currentParagraphIndex,
    hasLiveStream,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    visibleVnMessages,
  ]);

  const handleNextParagraph = useCallback(() => {
    pendingVnPrevious.current = null;
    if (currentParagraphIndex < vnParagraphCount - 1) {
      setVnParagraphIndex(currentParagraphIndex + 1);
    } else if (activeVnMessageIndex >= 0 && activeVnMessageIndex < visibleVnMessages.length - 1 && !hasLiveStream) {
      const nextMsg = visibleVnMessages[activeVnMessageIndex + 1];
      if (nextMsg) {
        setVnSelectedMessageId(nextMsg.id === latestVnMessage?.id ? null : nextMsg.id);
        setVnParagraphIndex(0); // first paragraph of next message
      }
    }
  }, [
    activeVnMessageIndex,
    currentParagraphIndex,
    hasLiveStream,
    latestVnMessage?.id,
    visibleVnMessages,
    vnParagraphCount,
  ]);
  const queryClient = useQueryClient();
  const automaticStoryboardMessageRef = useRef<string | undefined>(undefined);
  const initialLoadSettledRef = useRef(false);
  const prevMessageKeysRef = useRef<Set<string>>(new Set());
  const seenMessageKeysRef = useRef(roleplayNotificationSeenKeys);
  const pendingPostProcessingKeysRef = useRef<Set<string>>(new Set());
  const topChromeRef = useRef<HTMLDivElement>(null);
  const inputChromeRef = useRef<HTMLDivElement>(null);
  const chromeInsetsRef = useRef<{ target: HTMLDivElement | null; top: number; bottom: number }>({
    target: null,
    top: -1,
    bottom: -1,
  });
  const keyboardOpen = useChatKeyboardOpen();
  const composerFocused = useChatComposerFocused();
  const modalOpen = useUIStore((s) => s.modal !== null);
  const pageActive = usePageActivity();
  useEffect(() => {
    if (!visualNovel || !vnAutoPlay || vnHistoryOpen || hasLiveStream || composerFocused || modalOpen || !pageActive)
      return;
    if (ttsState !== "idle" && ttsState !== "error") return;
    if (currentParagraphIndex >= vnParagraphCount - 1) return;
    const timer = window.setInterval(() => {
      if (
        document.hidden ||
        document.querySelector(
          '[data-component="Modal"], [data-component="ExpandedTextarea"], [data-macro-modal], textarea:focus, input:focus',
        )
      )
        return;
      setVnParagraphIndex(currentParagraphIndex + 1);
    }, vnAutoPlayDelay);
    return () => window.clearInterval(timer);
  }, [
    visualNovel,
    vnAutoPlay,
    vnAutoPlayDelay,
    vnHistoryOpen,
    hasLiveStream,
    ttsState,
    currentParagraphIndex,
    vnParagraphCount,
    activeVnMessage?.id,
    composerFocused,
    modalOpen,
    pageActive,
  ]);
  const mobileComposerActive = isMobileToolbarViewport && composerFocused;
  const ambientVisualsPaused =
    generationVisualsPaused || (isMobileToolbarViewport && (keyboardOpen || composerFocused || hasMobileDraftInput));
  const weatherEffectsPaused = isMobileToolbarViewport && (keyboardOpen || composerFocused || hasMobileDraftInput);
  const hideEchoChamberOnMobile = sidebarOpen || rightPanelOpen || settingsOpen || wizardOpen;
  const showSpriteOverlay = expressionAgentEnabled && spriteCharacterIds.length > 0 && spriteDisplayModes.length > 0;

  useLayoutEffect(() => {
    const measure = () => {
      // The Chat Settings button starts in a row at the top of the chat, so text starts below that row.
      const buttonRow = WINDOW_MARGIN_PX + (phoneLayout ? PHONE_BUBBLE_SIZE_PX : WINDOW_BUBBLE_SIZE_PX);
      let top = Math.max(buttonRow, Math.ceil(topChromeRef.current?.getBoundingClientRect().height ?? 0));
      let bottom = Math.ceil(inputChromeRef.current?.getBoundingClientRect().height ?? 0);
      if (vnMediaTarget) {
        vnMediaTarget.style.top = `${top + 8}px`;
        vnMediaTarget.style.bottom = `${bottom}px`;
      }
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;
      const historyBox = scrollElement.parentElement;
      if (historyBox) {
        historyBox.style.top = visualNovel && vnHistoryOpen ? `${top + 8}px` : "";
        historyBox.style.bottom = visualNovel && vnHistoryOpen ? `${bottom}px` : "";
      }
      if (visualNovel && vnHistoryOpen) {
        top = 0;
        bottom = 0;
      }
      const current = chromeInsetsRef.current;
      if (current.target === scrollElement && current.top === top && current.bottom === bottom) return;
      chromeInsetsRef.current = { target: scrollElement, top, bottom };
      scrollElement.style.setProperty("--mari-roleplay-content-padding-top", `${Math.max(16, top + 12)}px`);
      scrollElement.style.setProperty("--mari-roleplay-content-padding-bottom", `${Math.max(16, bottom + 12)}px`);
      scrollElement.style.setProperty("--mari-roleplay-scroll-padding-top", `${Math.max(16, top + 8)}px`);
      scrollElement.style.setProperty("--mari-roleplay-scroll-padding-bottom", `${Math.max(16, bottom + 12)}px`);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (topChromeRef.current) observer.observe(topChromeRef.current);
    if (inputChromeRef.current) observer.observe(inputChromeRef.current);
    return () => observer.disconnect();
  }, [
    activeChatId,
    centerCompact,
    phoneLayout,
    chatMeta.enableAgents,
    chatMeta.sceneStatus,
    combatAgentEnabled,
    scrollRef,
    visualNovel,
    vnHistoryOpen,
    vnMediaTarget,
  ]);

  useEffect(() => {
    initialLoadSettledRef.current = false;
    prevMessageKeysRef.current = new Set();
    pendingPostProcessingKeysRef.current = new Set();
    setVnHistoryOpen(false);
    setVnHistoryHasDraft(false);
    pendingVnEdit.current = null;
    pendingVnHistoryScroll.current = false;
  }, [activeChatId]);

  const [transcriptWindowStart, setTranscriptWindowStart] = useState<number | null>(null);
  useLayoutEffect(() => {
    // /continue targets the latest reply, even when the reader was browsing an older window.
    if (continuationMessageId) setTranscriptWindowStart(null);
  }, [continuationMessageId]);
  const pendingLoadMoreRevealRef = useRef<{
    previousLength: number;
    previousStartIndex: number;
    previousEndIndex: number;
  } | null>(null);

  useLayoutEffect(() => {
    setTranscriptWindowStart(null);
    pendingLoadMoreRevealRef.current = null;
  }, [activeChatId]);

  const messagesLength = messages?.length ?? 0;
  const messagesPerPage = useUIStore((s) => s.messagesPerPage);
  const maxMountedMessages = resolveTranscriptRenderWindowSize(messagesPerPage);
  // The window size follows the "Messages per page" setting, which can change while
  // this chat stays mounted. A pinned start index is relative to the old size, so
  // re-anchor to the latest messages the same way a chat switch does.
  useLayoutEffect(() => {
    setTranscriptWindowStart(null);
    pendingLoadMoreRevealRef.current = null;
  }, [maxMountedMessages]);
  const transcriptWindow = useMemo(
    () => getTranscriptRenderWindow(messages, { maxMountedMessages, startIndex: transcriptWindowStart }),
    [maxMountedMessages, messages, transcriptWindowStart],
  );
  const gotoRequest = useChatStore((state) => state.gotoRequest);
  useLayoutEffect(() => {
    if (!vnHistoryOpen || !pendingVnHistoryScroll.current) return;
    pendingVnHistoryScroll.current = false;
    const element = scrollRef.current;
    if (!element) return;
    let followOpening = true;
    const scrollToLatest = () => {
      if (followOpening) element.scrollTop = element.scrollHeight;
    };
    const stopFollowing = () => {
      followOpening = false;
    };
    const frame = requestAnimationFrame(scrollToLatest);
    // Images mount with the transcript. Keep the opening anchor while they load,
    // but let the reader take over as soon as they interact with history.
    element.addEventListener("load", scrollToLatest, true);
    for (const event of ["wheel", "touchmove", "pointerdown", "keydown"])
      element.addEventListener(event, stopFollowing, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("load", scrollToLatest, true);
      for (const event of ["wheel", "touchmove", "pointerdown", "keydown"])
        element.removeEventListener(event, stopFollowing);
    };
  }, [vnHistoryOpen, scrollRef]);
  useEffect(() => {
    if (!visualNovel || vnHistoryOpen) return;
    const revealEditor = (event: Event) => {
      pendingVnEdit.current = (event as CustomEvent<{ messageId?: string }>).detail;
      setVnHistoryOpen(true);
    };
    window.addEventListener("marinara:start-edit-message", revealEditor);
    return () => window.removeEventListener("marinara:start-edit-message", revealEditor);
  }, [visualNovel, vnHistoryOpen]);
  useEffect(() => {
    if (!vnHistoryOpen || !pendingVnEdit.current) return;
    const detail = pendingVnEdit.current;
    pendingVnEdit.current = null;
    window.dispatchEvent(new CustomEvent("marinara:start-edit-message", { detail }));
  }, [vnHistoryOpen]);
  useLayoutEffect(() => {
    if (multiSelectMode || gotoRequest?.chatId === activeChatId) setVnHistoryOpen(true);
  }, [activeChatId, gotoRequest, multiSelectMode]);
  // ChatArea clears the request after scrolling; only reveal its transcript window once.
  const handledTranscriptGotoRef = useRef<typeof gotoRequest>(null);

  useLayoutEffect(() => {
    handledTranscriptGotoRef.current = null;
  }, [activeChatId]);

  useLayoutEffect(() => {
    if (
      !gotoRequest ||
      gotoRequest.chatId !== activeChatId ||
      !messages ||
      handledTranscriptGotoRef.current === gotoRequest
    ) {
      return;
    }
    const loadedMessageOffset = totalMessageCount - messages.length;
    const localIndex = gotoRequest.messageNumber - 1 - loadedMessageOffset;
    if (localIndex >= 0 && localIndex < messages.length) {
      handledTranscriptGotoRef.current = gotoRequest;
      setTranscriptWindowStart(localIndex);
    }
  }, [activeChatId, gotoRequest, messages, totalMessageCount]);

  const showOlderTranscriptMessages = () => {
    setTranscriptWindowStart((current) => {
      const start = current ?? transcriptWindow.startIndex;
      return Math.max(0, start - TRANSCRIPT_RENDER_WINDOW_STEP);
    });
  };

  const showNewerTranscriptMessages = () => {
    setTranscriptWindowStart((current) => {
      const start = current ?? transcriptWindow.startIndex;
      return Math.min(transcriptWindow.latestStartIndex, start + TRANSCRIPT_RENDER_WINDOW_STEP);
    });
  };

  const jumpToLatestTranscriptMessages = () => {
    setTranscriptWindowStart(null);
  };

  const handleLoadMoreClick = () => {
    if (transcriptWindow.hiddenBeforeCount > 0) {
      showOlderTranscriptMessages();
      return;
    }
    pendingLoadMoreRevealRef.current = {
      previousLength: messagesLength,
      previousStartIndex: transcriptWindow.startIndex,
      previousEndIndex: transcriptWindow.endIndex,
    };
    onLoadMore();
  };

  useLayoutEffect(() => {
    const pending = pendingLoadMoreRevealRef.current;
    if (!pending || isFetchingNextPage) return;
    if (messagesLength <= pending.previousLength) {
      pendingLoadMoreRevealRef.current = null;
      return;
    }

    const addedCount = messagesLength - pending.previousLength;
    const previousVisibleCount = Math.max(1, pending.previousEndIndex - pending.previousStartIndex);
    const previousVisibleStart = pending.previousStartIndex + addedCount;
    setTranscriptWindowStart(Math.max(0, previousVisibleStart - previousVisibleCount));
    pendingLoadMoreRevealRef.current = null;
  }, [isFetchingNextPage, messagesLength]);

  useEffect(() => {
    if (!messages) return;
    const currentKeys = new Set(messages.map((message) => `${activeChatId}:${message.id}`));
    const pendingPostProcessingKeys = new Set(
      messages
        .filter((message) => messageHasPendingPostProcessing(message))
        .map((message) => `${activeChatId}:${message.id}`),
    );

    if (!initialLoadSettledRef.current) {
      if (currentKeys.size > 0) {
        prevMessageKeysRef.current = currentKeys;
        for (const message of messages) {
          const key = `${activeChatId}:${message.id}`;
          if (!pendingPostProcessingKeys.has(key)) {
            rememberBoundedSetValue(seenMessageKeysRef.current, key, MAX_ROLEPLAY_NOTIFICATION_SEEN_KEYS);
          }
        }
        pendingPostProcessingKeysRef.current = pendingPostProcessingKeys;
        initialLoadSettledRef.current = true;
      }
      return;
    }

    const prevKeys = prevMessageKeysRef.current;
    const seenKeys = seenMessageKeysRef.current;
    const now = Date.now();
    const FRESHNESS_MS = 15_000;
    let hasNewAssistantMessage = false;

    for (const message of messages) {
      const key = `${activeChatId}:${message.id}`;
      const isPendingPostProcessing = pendingPostProcessingKeys.has(key);
      if (isPendingPostProcessing) continue;
      const wasPendingPostProcessing = pendingPostProcessingKeysRef.current.has(key);
      if ((prevKeys.has(key) || seenKeys.has(key)) && !wasPendingPostProcessing) continue;

      const createdAt = new Date(message.createdAt).getTime();
      const isFresh = wasPendingPostProcessing || (Number.isFinite(createdAt) && now - createdAt < FRESHNESS_MS);
      if (isFresh && message.role === "assistant") {
        hasNewAssistantMessage = true;
      }
    }

    for (const message of messages) {
      const key = `${activeChatId}:${message.id}`;
      if (!pendingPostProcessingKeys.has(key)) {
        rememberBoundedSetValue(seenKeys, key, MAX_ROLEPLAY_NOTIFICATION_SEEN_KEYS);
      }
    }
    prevMessageKeysRef.current = currentKeys;
    pendingPostProcessingKeysRef.current = pendingPostProcessingKeys;

    if (hasNewAssistantMessage) {
      const uiState = useUIStore.getState();
      playConfiguredNotificationPing(uiState.rpNotificationSound, uiState.notificationSoundsOnlyWhenUnfocused);
    }
  }, [activeChatId, messages]);

  // Keep an unsaved editor alive if its history is temporarily collapsed.
  const showHistory = !visualNovel || vnHistoryOpen;
  const showTranscript = showHistory || vnHistoryHasDraft;
  const visibleMessages = showTranscript ? transcriptWindow.messages : [];
  const activeChatCharacterIds = useMemo(() => {
    const inactiveIds = new Set(readStringArray(chatMeta.inactiveCharacterIds));
    const activeIds = chatCharIds.filter((id) => !inactiveIds.has(id));
    return activeIds.length > 0 ? activeIds : chatCharIds;
  }, [chatCharIds, chatMeta.inactiveCharacterIds]);
  const loadedMessageOffset = totalMessageCount - (messages?.length ?? 0);
  const summaryActiveAgentIds = Array.isArray(chatMeta.activeAgentIds)
    ? chatMeta.activeAgentIds.filter((agentId): agentId is string => typeof agentId === "string")
    : [];
  const longTermMemorySummaryPromptAvailable = isLongTermMemoryChatSummaryPromptAllowed({
    enableAgents: chatMeta.enableAgents,
    activeAgentIds: summaryActiveAgentIds,
  });
  const automaticSummaryEnabled =
    chatMeta.automaticSummaryEnabled === true ||
    (chatMeta.enableAgents === true && summaryActiveAgentIds.includes("chat-summary"));
  const semanticSummaryRetrievalEnabled = chatMeta.semanticSummaryRetrievalEnabled === true;
  const semanticSummaryRetrievalSettings = normalizeSemanticSummaryRetrievalSettings(chatMeta);
  const summaryRunInterval =
    typeof chatMeta.summaryRunInterval === "number" && Number.isFinite(chatMeta.summaryRunInterval)
      ? chatMeta.summaryRunInterval
      : undefined;
  const summaryMaxTokens =
    typeof chatMeta.summaryMaxTokens === "number" && Number.isFinite(chatMeta.summaryMaxTokens)
      ? chatMeta.summaryMaxTokens
      : undefined;
  const hideSummarisedMessages =
    typeof chatMeta.hideSummarisedMessages === "boolean" ? chatMeta.hideSummarisedMessages : undefined;
  const summaryTailMessages =
    typeof chatMeta.summaryTailMessages === "number" && Number.isFinite(chatMeta.summaryTailMessages)
      ? chatMeta.summaryTailMessages
      : undefined;
  const storyboardAgentActive = chatMeta.enableAgents === true && summaryActiveAgentIds.includes(STORYBOARD_AGENT_ID);
  const roleplayStoryboardAutoMode =
    chatMeta.roleplayStoryboardAutoGenerateMode === "manual" ||
    chatMeta.roleplayStoryboardAutoGenerateMode === "illustration" ||
    chatMeta.roleplayStoryboardAutoGenerateMode === "animation"
      ? chatMeta.roleplayStoryboardAutoGenerateMode
      : null;
  const latestStoryboardMessage = useMemo(
    () => messages?.find((message) => message.id === lastAssistantMessageId) ?? null,
    [lastAssistantMessageId, messages],
  );
  const roleplayStoryboardsQuery = useGameChatStoryboards(activeChatId, storyboardAgentActive);
  const generateRoleplayStoryboard = useGenerateGameTurnStoryboard();
  const roleplayStoryboardByTurn = useMemo(() => {
    const byTurn = new Map<string, GameTurnStoryboard>();
    for (const storyboard of roleplayStoryboardsQuery.data ?? []) {
      const key = `${storyboard.messageId}:${storyboard.swipeIndex}`;
      const existing = byTurn.get(key);
      if (!existing || storyboard.createdAt > existing.createdAt) byTurn.set(key, storyboard);
    }
    return byTurn;
  }, [roleplayStoryboardsQuery.data]);
  const storeGeneratedStoryboard = useCallback(
    (storyboard: GameTurnStoryboard) => {
      queryClient.setQueryData<GameTurnStoryboard[]>(gameStoryboardKeys.list(activeChatId), (current) => [
        storyboard,
        ...(current ?? []).filter((row) => row.id !== storyboard.id),
      ]);
      queryClient.setQueryData<GameTurnStoryboard[]>(
        gameStoryboardKeys.turn(activeChatId, storyboard.messageId, storyboard.swipeIndex),
        (current) => [storyboard, ...(current ?? []).filter((row) => row.id !== storyboard.id)],
      );
      void queryClient.invalidateQueries({ queryKey: ["gallery", activeChatId] });
      void queryClient.invalidateQueries({ queryKey: ["gallery", "assets", activeChatId] });
    },
    [activeChatId, queryClient],
  );
  const handleGenerateRoleplayStoryboard = useCallback(async () => {
    if (!latestStoryboardMessage) return;
    try {
      const result = await generateRoleplayStoryboard.mutateAsync({
        chatId: activeChatId,
        messageId: latestStoryboardMessage.id,
        swipeIndex: latestStoryboardMessage.activeSwipeIndex ?? 0,
        automatic: false,
        debugMode: useUIStore.getState().debugMode,
      });
      if ("storyboard" in result) storeGeneratedStoryboard(result.storyboard);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.chat.chatgallery.storyboardGenerationFailed"),
      );
    }
  }, [activeChatId, generateRoleplayStoryboard, latestStoryboardMessage, localizeUi, storeGeneratedStoryboard]);

  useEffect(() => {
    automaticStoryboardMessageRef.current = undefined;
  }, [activeChatId]);

  useEffect(() => {
    const messageId = latestStoryboardMessage?.id;
    if (!messageId) return;
    if (automaticStoryboardMessageRef.current === undefined) {
      automaticStoryboardMessageRef.current = messageId;
      return;
    }
    if (automaticStoryboardMessageRef.current === messageId) return;
    if (!storyboardAgentActive || roleplayStoryboardAutoMode === "manual") {
      automaticStoryboardMessageRef.current = messageId;
      return;
    }
    if (
      isStreaming ||
      agentProcessing ||
      messageHasPendingPostProcessing(latestStoryboardMessage) ||
      generateRoleplayStoryboard.isPending
    ) {
      return;
    }

    automaticStoryboardMessageRef.current = messageId;
    void generateRoleplayStoryboard
      .mutateAsync({
        chatId: activeChatId,
        messageId,
        swipeIndex: latestStoryboardMessage.activeSwipeIndex ?? 0,
        automatic: true,
        ...(roleplayStoryboardAutoMode ? { generateVideos: roleplayStoryboardAutoMode === "animation" } : {}),
        debugMode: useUIStore.getState().debugMode,
      })
      .then((result) => {
        if ("storyboard" in result) storeGeneratedStoryboard(result.storyboard);
      })
      .catch(() => undefined);
  }, [
    activeChatId,
    agentProcessing,
    generateRoleplayStoryboard,
    isStreaming,
    latestStoryboardMessage,
    roleplayStoryboardAutoMode,
    storyboardAgentActive,
    storeGeneratedStoryboard,
  ]);

  const canGenerateRoleplayStoryboard =
    storyboardAgentActive && !!latestStoryboardMessage && !generateRoleplayStoryboard.isPending;
  const galleryActions = useMemo(
    () => ({
      onIllustrate,
      onIllustrateWithAgent,
      onGenerateStoryboard: canGenerateRoleplayStoryboard ? handleGenerateRoleplayStoryboard : undefined,
      onGenerateVideo,
      onAnimateImage,
      onGenerateBackground,
    }),
    [
      canGenerateRoleplayStoryboard,
      handleGenerateRoleplayStoryboard,
      onAnimateImage,
      onGenerateBackground,
      onGenerateVideo,
      onIllustrate,
      onIllustrateWithAgent,
    ],
  );
  useProvideChatGalleryActions(activeChatId, galleryActions);
  const chatTools: ChatSettingsTools = chat
    ? {
        summary: (
          <RoleplaySummaryPanel
            chatId={chat.id}
            summary={chatMeta.summary ?? null}
            summaryEntries={
              Array.isArray(chatMeta.summaryEntries) ? (chatMeta.summaryEntries as ChatSummaryEntry[]) : []
            }
            contextSize={summaryContextSize}
            promptTemplates={Array.isArray(chatMeta.summaryPromptTemplates) ? chatMeta.summaryPromptTemplates : []}
            activePromptTemplateId={
              typeof chatMeta.activeSummaryPromptTemplateId === "string" ? chatMeta.activeSummaryPromptTemplateId : null
            }
            longTermMemorySummaryPromptAvailable={longTermMemorySummaryPromptAvailable}
            summaryConnectionId={typeof chatMeta.summaryConnectionId === "string" ? chatMeta.summaryConnectionId : null}
            summaryMaxTokens={summaryMaxTokens}
            automaticSummaryEnabled={automaticSummaryEnabled}
            semanticSummaryRetrievalEnabled={semanticSummaryRetrievalEnabled}
            semanticSummaryRecentCount={semanticSummaryRetrievalSettings.semanticSummaryRecentCount}
            semanticSummaryOlderCount={semanticSummaryRetrievalSettings.semanticSummaryOlderCount}
            semanticSummaryMinSimilarity={semanticSummaryRetrievalSettings.semanticSummaryMinSimilarity}
            activeAgentIds={summaryActiveAgentIds}
            summaryRunInterval={summaryRunInterval}
            hideSummarisedMessages={hideSummarisedMessages}
            summaryTailMessages={summaryTailMessages}
            automaticSummariesAvailable={chatMode === "roleplay"}
            totalMessageCount={totalMessageCount}
            promptPresetId={typeof chat.promptPresetId === "string" ? chat.promptPresetId : null}
          />
        ),
        activeContext: (
          <ActiveContextLinksPanel
            chat={chat}
            chatMeta={chatMeta}
            chatCharIds={chatCharIds}
            characterMap={characterMap}
          />
        ),
        authorNotes: (
          <Suspense fallback={<RoleplayDrawerLoading label={t("chat.settings.toolLoading")} />}>
            <AuthorNotesPanel key={chat.id} chatId={chat.id} chatMeta={chatMeta} />
          </Suspense>
        ),
      }
    : {};

  return (
    <div
      data-component="ChatArea.Roleplay"
      data-mobile-composer-active={mobileComposerActive || undefined}
      className="flex flex-1 overflow-hidden"
    >
      <div
        className={cn(
          "rpg-chat-area mari-chat-area mari-card-css relative flex flex-1 flex-col overflow-hidden",
          roleplayReducedPaintEffects && "mari-rp-reduced-paint",
          ambientVisualsPaused && "mari-generation-render-paused",
        )}
        data-chat-mode="roleplay"
        data-roleplay-presentation={visualNovel ? "visual-novel" : "classic"}
        data-chat-position={sideChatPosition}
        data-roleplay-avatar-style={sideChatPosition ? roleplayAvatarStyle : undefined}
        style={
          {
            isolation: "isolate",
            // The compact pane keeps the transcript's narrow padding (px-3) at every width.
            ...(centerCompact && { "--mari-roleplay-transcript-gutter": "0.75rem" }),
            ...(sideChatPosition && {
              "--roleplay-avatar-scale": roleplayAvatarScale,
              // A docked Tracker Panel on the same side narrows the chat area the column moves into.
              "--mari-chat-position-clearance":
                trackerPanelSide === sideChatPosition ? "var(--tracker-panel-chat-clearance, 0px)" : "0px",
            }),
          } as CSSProperties
        }
      >
        <CrossfadeBackground url={chatBackground} blurPx={chatBackgroundBlur} />
        <div className="rpg-overlay absolute inset-0" />
        <div className="rpg-vignette pointer-events-none absolute inset-0" />
        {weatherEffects && <WeatherEffectsConnected paused={weatherEffectsPaused} />}
        {visualNovel && !vnHistoryOpen && (
          <div
            ref={setVnMediaTarget}
            data-roleplay-vn-media
            className="pointer-events-none absolute inset-x-3 top-0 bottom-0 z-[4] flex items-end justify-center gap-2 overflow-hidden pb-2"
          />
        )}
        {showSpriteOverlay && (
          <Suspense fallback={null}>
            <SpriteOverlay
              characterIds={spriteCharacterIds}
              visibleCharacterIds={visibleExpressionSpriteIds}
              messages={msgPayload}
              side={visualNovel ? "center" : spritePosition}
              spriteDisplayModes={spriteDisplayModes}
              spriteExpressions={spriteExpressions}
              spritePlacements={spritePlacements}
              characterVisualSettings={spriteVisualSettings?.characterOverrides}
              editing={spriteArrangeMode}
              spriteScale={spriteScale}
              expressionSpriteScale={expressionSpriteScale}
              fullBodySpriteScale={fullBodySpriteScale}
              spriteScaleMultiplier={visualNovel ? vnSpriteScale : 1}
              activeCharacterIds={
                visualNovel && chatMeta.expressionOnlyActiveSprites !== true ? activeVnSpriteIds : undefined
              }
              spriteOpacity={spriteOpacity}
              expressionSpriteOpacity={expressionSpriteOpacity}
              fullBodySpriteOpacity={fullBodySpriteOpacity}
              onPlacementChange={onSpritePlacementChange}
              onFinishPlacement={onFinishSpritePlacement}
            />
          </Suspense>
        )}

        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div ref={topChromeRef} className="pointer-events-none absolute inset-x-0 top-0 z-40">
              {!centerCompact && (
                <div
                  data-tracker-panel-anchor="roleplay-hud"
                  className="pointer-events-none relative z-40 hidden items-center py-2 md:flex"
                  style={{
                    paddingLeft: "calc(1rem + var(--tracker-panel-hud-clear-left, 0px))",
                    paddingRight: "calc(1rem + var(--tracker-panel-hud-clear-right, 0px))",
                  }}
                >
                  {chat && chatMeta.enableAgents && (
                    <div
                      data-chat-help="agents"
                      data-roleplay-agent-window
                      className="pointer-events-auto flex-1 overflow-x-auto"
                    >
                      <Suspense fallback={null}>
                        <RoleplayHUD
                          chatId={chat.id}
                          isStreaming={isStreaming}
                          onRetriggerTrackers={onRerunTrackers}
                          onRerunSingleTracker={onRerunSingleTracker}
                          enabledAgentTypes={enabledAgentTypes}
                          manualTrackers={manualTrackersActive}
                        />
                      </Suspense>
                    </div>
                  )}
                  <div
                    data-roleplay-top-controls="right"
                    className={cn(
                      "pointer-events-auto ml-auto flex shrink-0 items-center",
                      CHAT_TOOLBAR_ICON_GAP_CLASS,
                    )}
                  >
                    {/* Package toolbars and the connected chat are windows that minimize to buttons. */}
                  </div>
                </div>
              )}
              {/* Like the desktop row, the strip lets touches through to the transcript except on its controls. */}
              <div
                data-tracker-panel-anchor={centerCompact ? "roleplay-hud" : undefined}
                className={cn(
                  "pointer-events-none relative z-40 w-full flex-col",
                  centerCompact ? "flex" : "flex md:hidden",
                )}
              >
                {chat && chatMeta.enableAgents && (
                  <div
                    className="flex w-full min-w-0 items-start justify-between gap-1.5 pb-1 pt-2"
                    style={{
                      paddingLeft: "calc(0.5rem + var(--tracker-panel-hud-clear-left, 0px))",
                      paddingRight: "calc(0.5rem + var(--tracker-panel-hud-clear-right, 0px))",
                    }}
                  >
                    <div
                      data-chat-help="agents"
                      data-roleplay-agent-window
                      className="pointer-events-auto min-w-0 flex-1 overflow-x-auto"
                    >
                      <Suspense fallback={null}>
                        <RoleplayHUD
                          chatId={chat.id}
                          isStreaming={isStreaming}
                          onRetriggerTrackers={onRerunTrackers}
                          onRerunSingleTracker={onRerunSingleTracker}
                          enabledAgentTypes={enabledAgentTypes}
                          manualTrackers={manualTrackersActive}
                          mobileCompact
                        />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {encounterActive && (
              <Suspense fallback={null}>
                <EncounterModal />
              </Suspense>
            )}

            <div
              data-chat-resource-drop-surface
              className={cn(
                "absolute z-10 overflow-hidden",
                visualNovel && vnHistoryOpen ? "mari-roleplay-input-column inset-x-0 mx-auto px-3 md:px-0" : "inset-0",
                visualNovel && !vnHistoryOpen && "pointer-events-none",
              )}
            >
              <div
                ref={scrollRef}
                data-chat-scroll
                id="roleplay-chat-history"
                aria-hidden={visualNovel && !vnHistoryOpen ? true : undefined}
                inert={visualNovel && !vnHistoryOpen ? true : undefined}
                className={cn(
                  "rpg-chat-messages-mobile mari-messages-scroll relative h-full overflow-y-auto overflow-x-hidden",
                  "px-3 md:px-[var(--mari-roleplay-transcript-gutter)]",
                  visualNovel && !vnHistoryOpen && "invisible pointer-events-none",
                  visualNovel &&
                    vnHistoryOpen &&
                    "rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-panel-bg)]",
                )}
                style={{
                  paddingTop: "var(--mari-roleplay-content-padding-top, 16px)",
                  paddingBottom:
                    "calc(var(--mari-roleplay-content-padding-bottom, 16px) + var(--mari-message-editor-scroll-space, 0px))",
                  scrollPaddingTop: "var(--mari-roleplay-scroll-padding-top, 16px)",
                  scrollPaddingBottom:
                    "calc(var(--mari-roleplay-scroll-padding-bottom, 16px) + var(--mari-message-editor-scroll-space, 0px))",
                }}
              >
                {hasNextPage && (
                  <div className="mari-chat-load-more mb-3 flex justify-center">
                    <button
                      onClick={handleLoadMoreClick}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] hover:text-foreground/90 disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <ChevronUp size="0.75rem" />
                      )}
                      {localizeUi("ui.chat.chatroleplaysurface.loadMore")}
                    </button>
                  </div>
                )}

                <TranscriptWindowControls
                  hiddenBeforeCount={transcriptWindow.hiddenBeforeCount}
                  hiddenAfterCount={transcriptWindow.hiddenAfterCount}
                  onShowOlder={transcriptWindow.hiddenBeforeCount > 0 ? showOlderTranscriptMessages : undefined}
                  className="pt-0"
                />

                {isLoading && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-white/60" />
                  </div>
                )}

                {visibleMessages?.map((msg, i) => {
                  if (isMessageHiddenFromUser(msg)) return null;
                  if (
                    isMessageShadowedByLiveStream({
                      hasLiveStream,
                      regenerateMessageId: inlineStreamingMessageId,
                      streamedMessageId,
                      messageId: msg.id,
                    })
                  ) {
                    return null;
                  }
                  const sourceIndex = transcriptWindow.startIndex + i;
                  const messageDepth = (messages?.length ?? 0) - 1 - sourceIndex;
                  const messageOrderIndex = loadedMessageOffset + sourceIndex;
                  const isRegenerating = hasLiveStream && inlineStreamingMessageId === msg.id;
                  const inlineStoryboard =
                    roleplayStoryboardByTurn.get(`${msg.id}:${msg.activeSwipeIndex ?? 0}`) ?? null;
                  const inlineStoryboardGenerating =
                    msg.id === generateRoleplayStoryboard.variables?.messageId &&
                    generateRoleplayStoryboard.isPending &&
                    (generateRoleplayStoryboard.variables?.automatic !== true ||
                      roleplayStoryboardAutoMode === "illustration" ||
                      roleplayStoryboardAutoMode === "animation");
                  return (
                    <div
                      key={msg.id}
                      className={shouldAnimateMessages ? "animate-message-in" : undefined}
                      style={
                        shouldAnimateMessages
                          ? { animationDelay: `${Math.min(i * 30, 200)}ms`, animationFillMode: "backwards" }
                          : undefined
                      }
                    >
                      {isRegenerating ? (
                        <RegeneratingMessageContent
                          msg={msg}
                          onDelete={onDelete}
                          onRegenerate={onRegenerate}
                          onEdit={onEdit}
                          onSetActiveSwipe={onSetActiveSwipe}
                          onToggleConversationStart={onToggleConversationStart}
                          onToggleHiddenFromAI={onToggleHiddenFromAI}
                          onPeekPrompt={() => onPeekPrompt(msg.id)}
                          onBranch={onBranch}
                          onCloneSceneFromHere={onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={isGrouped(sourceIndex)}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          mergedGroupCharacterIds={activeChatCharacterIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedMessageIds.has(msg.id)}
                          onToggleSelect={onToggleSelectMessage}
                          storyboard={inlineStoryboard}
                          storyboardGenerating={inlineStoryboardGenerating}
                          memoryStartCharacterIds={memoryContextStarts.get(msg.id)}
                        />
                      ) : (
                        <ChatMessage
                          message={msg}
                          followSpeechParagraphs={visualNovel}
                          isStreaming={false}
                          onDelete={onDelete}
                          onRegenerate={onRegenerate}
                          onEdit={onEdit}
                          failedReply={msg.id === failedReplyMessageId}
                          failedReplyReason={failedReplyReason}
                          onRetryFailedReply={onRetryFailedReply}
                          replyCheckup={msg.id === replyCheckupMessageId ? replyCheckup : undefined}
                          onSetActiveSwipe={onSetActiveSwipe}
                          onToggleConversationStart={onToggleConversationStart}
                          onToggleHiddenFromAI={onToggleHiddenFromAI}
                          onPeekPrompt={() => onPeekPrompt(msg.id)}
                          onBranch={onBranch}
                          onCloneSceneFromHere={onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={isGrouped(sourceIndex)}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          mergedGroupCharacterIds={activeChatCharacterIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedMessageIds.has(msg.id)}
                          onToggleSelect={onToggleSelectMessage}
                          storyboard={inlineStoryboard}
                          storyboardGenerating={inlineStoryboardGenerating}
                          memoryStartCharacterIds={memoryContextStarts.get(msg.id)}
                        />
                      )}
                    </div>
                  );
                })}

                <TranscriptWindowControls
                  hiddenBeforeCount={transcriptWindow.hiddenBeforeCount}
                  hiddenAfterCount={transcriptWindow.hiddenAfterCount}
                  onShowNewer={transcriptWindow.hiddenAfterCount > 0 ? showNewerTranscriptMessages : undefined}
                  onJumpToLatest={transcriptWindow.hiddenAfterCount > 0 ? jumpToLatestTranscriptMessages : undefined}
                  buttonClassName="border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)] hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
                />

                {showHistory && !isStreaming && <CyoaChoices messages={messages} />}

                {showHistory && hasLiveStream && !inlineStreamingMessageId && (
                  <StreamingIndicator
                    activeChatId={activeChatId}
                    chatCharIds={chatCharIds}
                    mergedGroupCharacterIds={activeChatCharacterIds}
                    characterMap={characterMap}
                    personaInfo={personaInfo}
                    chatMode={chatMode}
                    groupChatMode={groupChatMode}
                    expressionAvatarResolver={expressionAvatarResolver}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
            <PinnedImageOverlay activeChatId={activeChatId} includeSceneVideos />

            <div ref={inputChromeRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-30">
              <div
                data-roleplay-chat-column="true"
                className="mari-roleplay-input-column pointer-events-auto relative mx-auto px-3 md:px-0"
              >
                {visualNovel && (
                  <div className="relative mb-2" data-roleplay-vn>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        className={cn(
                          "mari-vn-history-control mari-chat-style-control relative flex h-6 w-10 items-center justify-center border border-[var(--border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-button-text)] before:absolute before:-inset-x-1 before:-inset-y-2.5 hover:text-[var(--marinara-chat-chrome-highlight-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]",
                          vnHistoryOpen ? "-mt-px rounded-b-lg border-t-0" : "rounded-t-lg border-b-0",
                        )}
                        aria-expanded={vnHistoryOpen}
                        aria-controls="roleplay-chat-history"
                        aria-label={localizeUi(
                          vnHistoryOpen ? "chat.roleplayVn.hideHistory" : "chat.roleplayVn.showHistory",
                        )}
                        title={localizeUi(
                          vnHistoryOpen ? "chat.roleplayVn.hideHistory" : "chat.roleplayVn.showHistory",
                        )}
                        onClick={() => {
                          if (!vnHistoryOpen) {
                            setTranscriptWindowStart(null);
                            pendingVnHistoryScroll.current = true;
                          }
                          setVnHistoryHasDraft(
                            vnHistoryOpen && !!scrollRef.current?.querySelector("[data-chat-message-editor]"),
                          );
                          setVnHistoryOpen((open) => !open);
                        }}
                      >
                        {vnHistoryOpen ? <ChevronDown size="0.875rem" /> : <ChevronUp size="0.875rem" />}
                      </button>
                    </div>
                    {!vnHistoryOpen && (
                      <div className="mari-chat-style-surface rounded-xl border border-[var(--border)] bg-[var(--marinara-chat-chrome-panel-bg)] shadow-lg">
                        {hasLiveStream ? (
                          inlineStreamingMessageId &&
                          messages?.find((message) => message.id === inlineStreamingMessageId) ? (
                            <RegeneratingMessageContent
                              msg={messages.find((message) => message.id === inlineStreamingMessageId)!}
                              visualNovel
                              visualNovelMediaTarget={vnMediaTarget}
                              visualNovelParagraphIndex={vnParagraphIndex ?? undefined}
                              onVisualNovelParagraphCount={setVnParagraphCount}
                              chatMode="roleplay"
                              characterMap={characterMap}
                              personaInfo={personaInfo}
                              groupChatMode={groupChatMode}
                              chatCharacterIds={chatCharIds}
                              mergedGroupCharacterIds={activeChatCharacterIds}
                              expressionAvatarResolver={expressionAvatarResolver}
                            />
                          ) : (
                            <StreamingIndicator
                              activeChatId={activeChatId}
                              visualNovel
                              visualNovelMediaTarget={vnMediaTarget}
                              visualNovelParagraphIndex={vnParagraphIndex ?? undefined}
                              onVisualNovelParagraphCount={setVnParagraphCount}
                              chatCharIds={chatCharIds}
                              mergedGroupCharacterIds={activeChatCharacterIds}
                              characterMap={characterMap}
                              personaInfo={personaInfo}
                              chatMode="roleplay"
                              groupChatMode={groupChatMode}
                              expressionAvatarResolver={expressionAvatarResolver}
                            />
                          )
                        ) : activeVnMessage ? (
                          <div>
                            <ChatMessage
                              key={`${activeChatId}:${activeVnMessage.id}:${activeVnMessage.activeSwipeIndex}`}
                              message={activeVnMessage}
                              memoryStartCharacterIds={memoryContextStarts.get(activeVnMessage.id)}
                              failedReply={activeVnMessage.id === failedReplyMessageId}
                              failedReplyReason={failedReplyReason}
                              onRetryFailedReply={onRetryFailedReply}
                              replyCheckup={activeVnMessage.id === replyCheckupMessageId ? replyCheckup : undefined}
                              visualNovel
                              visualNovelSpeech={vnSpeech}
                              onVisualNovelSpeechParagraph={setVnParagraphIndex}
                              visualNovelParagraphIndex={vnParagraphIndex ?? undefined}
                              onVisualNovelParagraphCount={setVnParagraphCount}
                              visualNovelMediaTarget={vnMediaTarget}
                              chatMode="roleplay"
                              characterMap={characterMap}
                              personaInfo={personaInfo}
                              groupChatMode={groupChatMode}
                              chatCharacterIds={chatCharIds}
                              mergedGroupCharacterIds={activeChatCharacterIds}
                              expressionAvatarResolver={expressionAvatarResolver}
                              messageDepth={(messages?.length ?? 1) - 1 - (messages?.indexOf(activeVnMessage) ?? 0)}
                            />
                            {(vnParagraphCount > 1 || visibleVnMessages.length > 1 || hasNextPage) && (
                              <div
                                data-roleplay-vn-navigation
                                className="flex items-center justify-between border-t border-[var(--border)]/50 px-3 py-1.5 text-xs text-[var(--marinara-chat-chrome-accent)]"
                              >
                                <button
                                  type="button"
                                  disabled={!canGoPreviousParagraph}
                                  onClick={handlePreviousParagraph}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:opacity-30 disabled:pointer-events-none"
                                  aria-label={localizeUi("chat.roleplayVn.previousParagraph")}
                                  title={localizeUi("chat.roleplayVn.previousParagraph")}
                                >
                                  <ChevronLeft size="0.875rem" />
                                  <span>{localizeUi("chat.roleplayVn.previousParagraph")}</span>
                                </button>
                                <span className="font-mono text-[0.6875rem] opacity-75">
                                  {localizeUi("chat.roleplayVn.paragraphCounter", {
                                    current: currentParagraphIndex + 1,
                                    total: vnParagraphCount,
                                  })}
                                </span>
                                <button
                                  type="button"
                                  disabled={!canGoNextParagraph}
                                  onClick={handleNextParagraph}
                                  className="inline-flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] disabled:opacity-30 disabled:pointer-events-none"
                                  aria-label={localizeUi("chat.roleplayVn.nextParagraph")}
                                  title={localizeUi("chat.roleplayVn.nextParagraph")}
                                >
                                  <span>{localizeUi("chat.roleplayVn.nextParagraph")}</span>
                                  <ChevronRight size="0.875rem" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="p-4 text-sm text-[var(--marinara-chat-chrome-text)]">
                            {localizeUi("chat.roleplayVn.empty")}
                          </p>
                        )}
                      </div>
                    )}
                    {!vnHistoryOpen && !isStreaming && <CyoaChoices messages={messages} />}
                  </div>
                )}
                {chatMeta.sceneStatus === "active" && (
                  <EndSceneBar
                    sceneChatId={activeChatId}
                    originChatId={chatMeta.sceneOriginChatId}
                    packageOrigin={chatMeta.scenePackageOrigin}
                    onConclude={onConcludeScene}
                    onAbandon={onAbandonScene}
                    onFork={onForkScene}
                    isForking={isForkingScene}
                  />
                )}
                <ChatInput
                  key={activeChatId}
                  mode={isRoleplay ? "roleplay" : "conversation"}
                  combatAgentEnabled={combatAgentEnabled}
                  onStartEncounter={onStartEncounter}
                  characterNames={characterNames}
                  groupResponseOrder={
                    chatCharIds.length > 1 && groupChatMode === "individual"
                      ? (chatMeta.groupResponseOrder ?? "sequential")
                      : undefined
                  }
                  chatCharacters={chatCharIds
                    .filter((id) => characterMap.has(id))
                    .map((id) => {
                      const info = characterMap.get(id)!;
                      return {
                        id,
                        name: info.name,
                        avatarUrl: info.avatarUrl ?? null,
                        avatarCrop: info.avatarCrop ?? null,
                      };
                    })}
                  onExpressionChange={onExpressionChange}
                  onPeekPrompt={onPeekPrompt}
                  onIllustrate={onIllustrate}
                  interactionsLocked={agentProcessing}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Always mount so stagger timer runs even when panel is hidden */}
        <Suspense fallback={null}>
          <EchoChamberPanel hiddenOnMobile={hideEchoChamberOnMobile} />
        </Suspense>
      </div>

      {/* Package toolbars, Beholder and the connected chat are windows that minimize to bubbles. */}
      {showTrackerPanelBubble && <TrackerPanelBubble chatId={activeChatId} />}
      {conversationToolbarPackages.map((item, index) => (
        <ChatControlWindow
          key={`${item.id}-toolbar-window`}
          id={CHAT_CONTROL_WINDOW_IDS.package(item.id)}
          title={item.manifest.name}
          icon={<Puzzle size={14} />}
          slot={index + 1}
          phoneSlot={phoneSlotOffset + index + 1}
          width={280}
          height={140}
          helpTarget="agent-controls"
        >
          <div className={cn("flex flex-wrap items-center p-2", CHAT_TOOLBAR_ICON_GAP_CLASS)}>
            <CapabilityElement
              packageId={item.id}
              view="toolbar"
              capabilityProps={{ ...conversationCapabilityProps, toolbarButtonClass: getChatToolbarButtonClass() }}
              className="contents"
            />
          </div>
        </ChatControlWindow>
      ))}
      {chat?.connectedChatId && (
        <ChatConnectedChatWindow
          name={linkedChatName}
          onSwitch={() => useChatStore.getState().setActiveChatId(chat.connectedChatId!)}
          phoneSlot={phoneSlotOffset}
        />
      )}

      {/* Outside the isolated chat area, so it stacks with Chat Settings and the other chat windows. */}
      {chat && chatMeta.enableAgents && (
        <Suspense fallback={null}>
          <RoleplayTrackerWindow
            beholderSlot={conversationToolbarPackages.length + 1}
            beholderPhoneSlot={phoneSlotOffset + conversationToolbarPackages.length + 1}
            chatId={chat.id}
            enabledAgentTypes={enabledAgentTypes}
            isStreaming={isStreaming}
            manualTrackers={manualTrackersActive}
            onRerunTrackers={onRerunTrackers}
            onRerunSingleTracker={onRerunSingleTracker}
            messages={messages}
          />
        </Suspense>
      )}

      <ChatCommonOverlays
        chat={chat}
        settingsOpen={settingsOpen}
        settingsAnchor={settingsAnchor}
        settingsInitialSection={settingsInitialSection}
        chatTools={chatTools}
        wizardOpen={wizardOpen}
        peekPromptData={peekPromptData}
        deleteDialogMessageId={deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
        deleteDialogCanDeleteOtherSwipes={deleteDialogCanDeleteOtherSwipes}
        deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
        deleteDialogSwipeCount={deleteDialogSwipeCount}
        multiSelectMode={multiSelectMode}
        selectedMessageCount={selectedMessageIds.size}
        sceneSettings={{
          spriteArrangeMode,
          onToggleSpriteArrange,
          onResetSpritePlacements,
          onResetSpriteCharacterVisualSettings,
          onSpriteSideChange,
          spriteVisualSettings,
          onSpriteVisualSettingsChange,
        }}
        onCloseSettings={onCloseSettings}
        onOpenScheduleEditor={onOpenScheduleEditor}
        onWizardFinish={onWizardFinish}
        onClosePeekPrompt={onClosePeekPrompt}
        onDeleteConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
        onDeleteOtherSwipes={onDeleteOtherSwipes}
        onDeleteMore={onDeleteMore}
        onCloseDeleteDialog={onCloseDeleteDialog}
        onBulkDelete={onBulkDelete}
        onCancelMultiSelect={onCancelMultiSelect}
        onUnselectAllMessages={onUnselectAllMessages}
        onSelectAllAboveSelection={onSelectAllAboveSelection}
        onSelectAllBelowSelection={onSelectAllBelowSelection}
      />
      {conversationSurfacePackages.map((item) => (
        <div key={`${item.id}-conversation-surface`} data-roleplay-agent-window className="contents">
          <CapabilityElement
            packageId={item.id}
            view="surface"
            capabilityProps={conversationCapabilityProps}
            className="contents"
          />
        </div>
      ))}
    </div>
  );
}
