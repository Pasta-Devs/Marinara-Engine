import { createPortal } from "react-dom";
import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import {
  type ChatSummaryEntry,
  type SceneForkMode,
  type SpritePlacement,
  type SpriteSide,
} from "@marinara-engine/shared";
import {
  BookOpen,
  FileText,
  Image,
  Loader2,
  PenLine,
  ScrollText,
  Settings2,
  Swords,
  ChevronUp,
  ArrowRightLeft,
  User,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { getConnectedChatDisplayName } from "../../lib/chat-display";
import { playNotificationPing } from "../../lib/notification-sound";
import { getTranscriptRenderWindow, TRANSCRIPT_RENDER_WINDOW_STEP } from "../../lib/transcript-render-window";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useGameStateStore } from "../../stores/game-state.store";
import { useActiveLorebookEntries, useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { CyoaChoices } from "./CyoaChoices";
import { ChatBranchSelector } from "./ChatBranchSelector";
import { ChatToolbarButton, ChatToolbarMenu, getChatToolbarButtonClass } from "./ChatToolbarControls";
import { TranscriptWindowControls } from "./TranscriptWindowControls";
import { EndSceneBar } from "./SceneBanner";
import { ChatCommonOverlays } from "./ChatCommonOverlays";
import {
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import type { SpriteDisplayMode } from "./sprite-display-modes";
import type {
  CharacterMap,
  ExpressionAvatarResolver,
  MessageSelectionToggle,
  MessageWithSwipes,
  PeekPromptData,
  PersonaInfo,
} from "./chat-area.types";

type ChatData = ComponentProps<typeof ChatCommonOverlays>["chat"];

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

const SummaryPopover = lazy(async () => {
  const module = await import("./SummaryPopover");
  return { default: module.SummaryPopover };
});

const AuthorNotesPanel = lazy(async () => {
  const module = await import("./ChatRoleplayPanels");
  return { default: module.AuthorNotesPanel };
});

const PANEL_BACKDROP =
  "fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]";
const TRACKER_FOREGROUND_AVOIDANCE_CLASS =
  "md:pl-[var(--tracker-chat-avoid-left)] md:pr-[var(--tracker-chat-avoid-right)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.16,1,0.3,1)]";
const PANEL_CONTAINER = cn(
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  "relative max-h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto p-3",
);
const roleplayNotificationSeenKeys = new Set<string>();

function WeatherEffectsConnected() {
  const gs = useGameStateStore((s) => s.current);
  return (
    <Suspense fallback={null}>
      <WeatherEffects weather={gs?.weather ?? null} timeOfDay={gs?.time ?? null} />
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
  const backgroundBlurStyle = getBackgroundBlurStyle(blurPx);

  useEffect(() => {
    const currentUrl = activeSlot.current === "a" ? bgA : bgB;
    if (url === currentUrl) return;

    if (url && (url.startsWith("/api/backgrounds/") || url.startsWith("/api/game-assets/"))) {
      fetch(url, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            applyUrl(url);
          } else {
            console.warn(`[Background] "${url}" not found — clearing`);
            useUIStore.getState().setChatBackground(null);
          }
        })
        .catch(() => {
          applyUrl(url);
        });
      return;
    }

    applyUrl(url);

    function applyUrl(nextUrl: string | null) {
      if (activeSlot.current === "a") {
        setBgB(nextUrl);
        setAActive(false);
        activeSlot.current = "b";
      } else {
        setBgA(nextUrl);
        setAActive(true);
        activeSlot.current = "a";
      }
    }
  }, [bgA, bgB, url]);

  return (
    <>
      <div
        className={cn(
          "mari-background absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{
          backgroundImage: bgA ? `url(${bgA})` : "none",
          opacity: aActive ? 1 : 0,
          transition: "opacity 700ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out",
          ...backgroundBlurStyle,
        }}
      />
      <div
        className={cn(
          "mari-background absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{
          backgroundImage: bgB ? `url(${bgB})` : "none",
          opacity: aActive ? 0 : 1,
          transition: "opacity 700ms ease-in-out, filter 180ms ease-out, transform 180ms ease-out",
          ...backgroundBlurStyle,
        }}
      />
    </>
  );
}

function StreamingIndicator({
  activeChatId,
  chatCharIds,
  characterMap,
  personaInfo,
  chatMode,
  groupChatMode,
  expressionAvatarResolver,
}: {
  activeChatId: string;
  chatCharIds: string[];
  characterMap: CharacterMap;
  personaInfo?: PersonaInfo;
  chatMode: string;
  groupChatMode?: string;
  expressionAvatarResolver?: ExpressionAvatarResolver;
}) {
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  const streamingCharacterId = useChatStore((s) => s.streamingCharacterId);

  return (
    <div className="animate-message-in">
      <ChatMessage
        message={{
          id: "__streaming__",
          chatId: activeChatId,
          role: "assistant",
          characterId: streamingCharacterId ?? chatCharIds[0] ?? null,
          content: streamBuffer || (thinkingBuffer ? "Thinking..." : ""),
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
        characterMap={characterMap}
        personaInfo={personaInfo}
        chatMode={chatMode}
        groupChatMode={groupChatMode}
        chatCharacterIds={chatCharIds}
        expressionAvatarResolver={expressionAvatarResolver}
      />
    </div>
  );
}

function RegeneratingMessageContent({
  msg,
  ...rest
}: {
  msg: MessageWithSwipes;
} & Omit<ComponentProps<typeof ChatMessage>, "message" | "isStreaming">) {
  const streamBuffer = useChatStore((s) => s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffer);
  // Strip old-swipe attachments so a previous illustration doesn't linger
  // while the new swipe's text is streaming in.
  const parsedExtra = typeof msg.extra === "string" ? JSON.parse(msg.extra) : (msg.extra ?? {});
  const cleanExtra = { ...parsedExtra, attachments: null, thinking: thinkingBuffer || parsedExtra.thinking };
  return (
    <ChatMessage
      message={{ ...msg, extra: cleanExtra, content: streamBuffer || (thinkingBuffer ? "Thinking..." : "") }}
      isStreaming
      {...rest}
    />
  );
}

/** True for stored context messages that should feed generation but not render in the transcript. */
function isHiddenFromUser(message: MessageWithSwipes) {
  const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
  return extra.hiddenFromUser === true;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function ActiveContextLinksButton({
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const compact = useUIStore((s) => s.centerCompact);
  const { data: lorebooks } = useLorebooks();
  const { data: presets } = usePresets();
  const { data: activeLorebookScan, isLoading: activeLorebookScanLoading } = useActiveLorebookEntries(
    chat?.id ?? null,
    open && !!chat?.id,
  );

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

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
  const skippedEntriesByLorebook = new Map<string, typeof skippedLorebookEntries>();
  for (const entry of skippedLorebookEntries) {
    const current = skippedEntriesByLorebook.get(entry.lorebookId) ?? [];
    current.push(entry);
    skippedEntriesByLorebook.set(entry.lorebookId, current);
  }
  const hasLinks =
    characterIds.length > 0 ||
    visibleLorebookIds.length > 0 ||
    triggeredEntries.length > 0 ||
    skippedLorebookEntries.length > 0 ||
    !!promptPresetId;

  if (!hasLinks) return null;

  const lorebookNameById = new Map((lorebooks ?? []).map((book) => [book.id, book.name]));
  const presetName = promptPresetId ? presets?.find((preset) => preset.id === promptPresetId)?.name : null;

  const openCharacter = (id: string) => {
    useUIStore.getState().openCharacterDetail(id);
    setOpen(false);
  };
  const openLorebook = (id: string) => {
    useUIStore.getState().openLorebookDetail(id);
    setOpen(false);
  };
  const openPreset = (id: string) => {
    useUIStore.getState().openPresetDetail(id);
    setOpen(false);
  };

  const itemClassName =
    "marinara-chat-popover__item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--marinara-chat-chrome-panel-text)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] hover:text-[var(--marinara-chat-chrome-highlight-text)]";
  const iconClassName = "shrink-0 text-[var(--marinara-chat-chrome-panel-muted)]";
  const entryClassName =
    "flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1 text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)] ring-1 ring-[var(--marinara-chat-chrome-panel-divider)]";

  return (
    <div className="relative" ref={ref} onClick={(event) => event.stopPropagation()}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={getChatToolbarButtonClass({ compact, open })}
        title="Active Context"
        aria-label="Active Context"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BookOpen size="0.875rem" />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            ROLEPLAY_POPOVER_SHELL,
            ROLEPLAY_POPOVER_SCROLL_AREA,
            "absolute right-0 top-full z-50 mt-2 max-h-[min(32rem,calc(100vh-6rem))] w-72 overflow-y-auto p-2",
          )}
        >
          <div className={cn(ROLEPLAY_POPOVER_TITLE, "px-2 pb-1")}>
            <BookOpen size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
            Active Context
          </div>
          <div className="space-y-1">
            {characterIds.map((id, index) => (
              <button
                key={id}
                type="button"
                role="menuitem"
                className={itemClassName}
                onClick={() => openCharacter(id)}
              >
                <User size="0.8125rem" className={iconClassName} />
                <span className="min-w-0 flex-1 truncate">
                  {characterMap.get(id)?.name ?? `Character ${index + 1}`}
                </span>
                <span className="shrink-0 text-[0.625rem] text-foreground/45">Card</span>
              </button>
            ))}
            {visibleLorebookIds.map((id, index) => {
              const entries = triggeredEntriesByLorebook.get(id) ?? [];
              const skippedEntries = skippedEntriesByLorebook.get(id) ?? [];
              return (
                <div key={id} className="space-y-1">
                  <button type="button" role="menuitem" className={itemClassName} onClick={() => openLorebook(id)}>
                    <BookOpen size="0.8125rem" className={iconClassName} />
                    <span className="min-w-0 flex-1 truncate">
                      {lorebookNameById.get(id) ?? `Lorebook ${index + 1}`}
                    </span>
                    <span className="shrink-0 text-[0.625rem] text-foreground/45">
                      {entries.length > 0 ? `${entries.length} hit${entries.length === 1 ? "" : "s"}` : "Lorebook"}
                    </span>
                  </button>
                  {entries.length > 0 && (
                    <div className="ml-6 space-y-1 border-l border-foreground/10 pl-2">
                      {entries.map((entry) => (
                        <div key={entry.id} className={entryClassName} title={entry.content || entry.name}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                          {entry.constant && (
                            <span className="shrink-0 rounded bg-amber-400/15 px-1 py-0.5 text-[0.5rem] font-semibold text-amber-300">
                              CONST
                            </span>
                          )}
                          <span className="shrink-0 text-foreground/40">#{entry.order}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {skippedEntries.length > 0 && (
                    <div className="ml-6 rounded-md bg-amber-500/10 px-2 py-1 text-[0.625rem] leading-relaxed text-amber-100/80 ring-1 ring-amber-500/20">
                      {skippedEntries.length} matching {skippedEntries.length === 1 ? "entry was" : "entries were"}{" "}
                      skipped by token budget.
                    </div>
                  )}
                </div>
              );
            })}
            {activeLorebookScanLoading && visibleLorebookIds.length > 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-[0.625rem] text-foreground/50">
                <Loader2 size="0.6875rem" className="animate-spin" />
                Scanning active lorebook entries...
              </div>
            )}
            {promptPresetId && (
              <button
                type="button"
                role="menuitem"
                className={itemClassName}
                onClick={() => openPreset(promptPresetId)}
              >
                <FileText size="0.8125rem" className={iconClassName} />
                <span className="min-w-0 flex-1 truncate">{presetName ?? "Prompt preset"}</span>
                <span className="shrink-0 text-[0.625rem] text-foreground/45">Preset</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryButton({
  chatId,
  summary,
  summaryEntries,
  summaryContextSize,
  summaryPromptTemplates,
  activeSummaryPromptTemplateId,
  totalMessageCount,
}: {
  chatId: string | null;
  summary: string | null;
  summaryEntries?: ChatSummaryEntry[];
  summaryContextSize: number;
  summaryPromptTemplates?: ComponentProps<typeof SummaryPopover>["promptTemplates"];
  activeSummaryPromptTemplateId?: string | null;
  totalMessageCount: number;
}) {
  const [open, setOpen] = useState(false);
  const compact = useUIStore((s) => s.centerCompact);

  if (!chatId) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={getChatToolbarButtonClass({ active: !!summary, compact, open })}
        title="Chat Summary"
      >
        <ScrollText size="0.875rem" />
      </button>
      {open && (
        <Suspense fallback={null}>
          <SummaryPopover
            chatId={chatId}
            summary={summary}
            summaryEntries={summaryEntries}
            contextSize={summaryContextSize}
            promptTemplates={summaryPromptTemplates}
            activePromptTemplateId={activeSummaryPromptTemplateId}
            totalMessageCount={totalMessageCount}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function AuthorNotesButton({ chatId, chatMeta }: { chatId: string | null; chatMeta: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const compact = useUIStore((s) => s.centerCompact);

  useEffect(() => {
    if (!open || isMobile) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!chatId) return null;

  const hasNotes = !!String(chatMeta.authorNotes ?? "").trim();

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className={getChatToolbarButtonClass({ active: hasNotes, compact, open })}
        title="Author's Notes"
      >
        <PenLine size="0.875rem" />
      </button>
      {open &&
        (isMobile ? (
          createPortal(
            <div
              className={PANEL_BACKDROP}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
              <div className={PANEL_CONTAINER} onClick={(e) => e.stopPropagation()}>
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
                      <Loader2 size="0.75rem" className="animate-spin" />
                      Loading author's notes...
                    </div>
                  }
                >
                  <AuthorNotesPanel
                    chatId={chatId}
                    chatMeta={chatMeta}
                    isMobile={isMobile}
                    onClose={() => setOpen(false)}
                  />
                </Suspense>
              </div>
            </div>,
            document.body,
          )
        ) : (
          <div className={cn(ROLEPLAY_POPOVER_SHELL, "absolute right-0 top-full z-50 mt-2 w-72 p-3")}>
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted-foreground)]">
                  <Loader2 size="0.75rem" className="animate-spin" />
                  Loading author's notes...
                </div>
              }
            >
              <AuthorNotesPanel
                chatId={chatId}
                chatMeta={chatMeta}
                isMobile={isMobile}
                onClose={() => setOpen(false)}
              />
            </Suspense>
          </div>
        ))}
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
  expressionAvatarsEnabled: boolean;
  expressionAvatarResolver?: ExpressionAvatarResolver;
  spritePlacements: Record<string, SpritePlacement>;
  spriteScale: number;
  spriteOpacity: number;
  spriteArrangeMode: boolean;
  enabledAgentTypes: Set<string>;
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
  regenerateMessageId: string | null;
  shouldAnimateMessages: boolean;
  summaryContextSize: number;
  totalMessageCount: number;
  lastAssistantMessageId: string | null;
  settingsOpen: boolean;
  settingsAnchor: ComponentProps<typeof ChatCommonOverlays>["settingsAnchor"];
  filesOpen: boolean;
  galleryOpen: boolean;
  galleryAnchor: ComponentProps<typeof ChatCommonOverlays>["galleryAnchor"];
  wizardOpen: boolean;
  peekPromptData: PeekPromptData | null;
  deleteDialogMessageId: string | null;
  deleteDialogCanDeleteSwipe: boolean;
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
  onEdit: (messageId: string, content: string) => void;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleConversationStart: (messageId: string, current: boolean) => void;
  onToggleHiddenFromAI: (messageId: string, current: boolean) => void;
  onPeekPrompt: () => void;
  onBranch?: (messageId: string) => void;
  onCloneSceneFromHere?: (messageId: string) => void;
  isCloneSceneFromHereDisabled?: boolean;
  onToggleSelectMessage: (toggle: MessageSelectionToggle) => void;
  onRerunTrackers: () => void;
  onRerunSingleTracker: (agentType: string) => void;
  onRetryFailedAgents?: () => void;
  onStartEncounter: () => void;
  onConcludeScene: () => void;
  onAbandonScene: () => void;
  onForkScene: (sceneChatId: string, mode: SceneForkMode) => void;
  isForkingScene?: boolean;
  onOpenSettings: (event?: ReactMouseEvent<HTMLElement>) => void;
  onOpenGallery: (event?: ReactMouseEvent<HTMLElement>) => void;
  onCloseSettings: () => void;
  onCloseFiles: () => void;
  onCloseGallery: () => void;
  onIllustrate?: () => void;
  onWizardFinish: () => void;
  onClosePeekPrompt: () => void;
  onResetSpritePlacements: () => void;
  onSpriteSideChange: (side: SpriteSide) => void;
  onToggleSpriteArrange: () => void;
  onExpressionChange: (characterId: string, expression: string, options?: { immediate?: boolean }) => void;
  onSpritePlacementChange: (characterId: string, placement: SpritePlacement) => void;
  onDeleteConfirm: () => void;
  onDeleteSwipe: () => void;
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
  expressionAvatarsEnabled,
  expressionAvatarResolver,
  spritePlacements,
  spriteScale,
  spriteOpacity,
  spriteArrangeMode,
  enabledAgentTypes,
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
  regenerateMessageId,
  shouldAnimateMessages,
  summaryContextSize,
  totalMessageCount,
  lastAssistantMessageId,
  settingsOpen,
  settingsAnchor,
  filesOpen,
  galleryOpen,
  galleryAnchor,
  wizardOpen,
  peekPromptData,
  deleteDialogMessageId,
  deleteDialogCanDeleteSwipe,
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
  onRetryFailedAgents,
  onStartEncounter,
  onConcludeScene,
  onAbandonScene,
  onForkScene,
  isForkingScene,
  onOpenSettings,
  onOpenGallery,
  onCloseSettings,
  onCloseFiles,
  onCloseGallery,
  onIllustrate,
  onWizardFinish,
  onClosePeekPrompt,
  onResetSpritePlacements,
  onSpriteSideChange,
  onToggleSpriteArrange,
  onExpressionChange,
  onSpritePlacementChange,
  onDeleteConfirm,
  onDeleteSwipe,
  onDeleteMore,
  onCloseDeleteDialog,
  onBulkDelete,
  onCancelMultiSelect,
  onUnselectAllMessages,
  onSelectAllAboveSelection,
  onSelectAllBelowSelection,
  isGrouped,
}: RoleplaySurfaceProps) {
  const isStreamCommitted = useChatStore((s) => s.committedStreamChatIds.has(activeChatId));
  const hasDraftInput = useChatStore((s) => s.currentInput.trim().length > 0);
  const hasLiveStream = isStreaming && !isStreamCommitted;
  const linkedChatName = chat?.connectedChatId
    ? getConnectedChatDisplayName(allChats?.find((c) => c.id === chat.connectedChatId))
    : undefined;
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const chatBackgroundBlur = useUIStore((s) => s.chatBackgroundBlur);
  const initialLoadSettledRef = useRef(false);
  const prevMessageKeysRef = useRef<Set<string>>(new Set());
  const seenMessageKeysRef = useRef(roleplayNotificationSeenKeys);
  const topChromeRef = useRef<HTMLDivElement>(null);
  const inputChromeRef = useRef<HTMLDivElement>(null);
  const [chromeHeights, setChromeHeights] = useState({ top: 0, bottom: 0 });
  const hideEchoChamberOnMobile =
    sidebarOpen || rightPanelOpen || settingsOpen || filesOpen || galleryOpen || wizardOpen;
  const overlaySpriteDisplayModes = expressionAvatarsEnabled
    ? spriteDisplayModes.filter((mode) => mode !== "expressions")
    : spriteDisplayModes;
  const showSpriteOverlay =
    expressionAgentEnabled && spriteCharacterIds.length > 0 && overlaySpriteDisplayModes.length > 0;

  useLayoutEffect(() => {
    const measure = () => {
      const top = Math.ceil(topChromeRef.current?.getBoundingClientRect().height ?? 0);
      const bottom = Math.ceil(inputChromeRef.current?.getBoundingClientRect().height ?? 0);
      setChromeHeights((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (topChromeRef.current) observer.observe(topChromeRef.current);
    if (inputChromeRef.current) observer.observe(inputChromeRef.current);
    return () => observer.disconnect();
  }, [activeChatId, centerCompact, chatMeta.enableAgents, chatMeta.sceneStatus, combatAgentEnabled]);

  useEffect(() => {
    initialLoadSettledRef.current = false;
    prevMessageKeysRef.current = new Set();
  }, [activeChatId]);

  const [transcriptWindowStart, setTranscriptWindowStart] = useState<number | null>(null);
  const pendingLoadMoreRevealRef = useRef<{
    previousLength: number;
    previousStartIndex: number;
    previousEndIndex: number;
  } | null>(null);

  useEffect(() => {
    setTranscriptWindowStart(null);
    pendingLoadMoreRevealRef.current = null;
  }, [activeChatId]);

  const messagesLength = messages?.length ?? 0;
  const transcriptWindow = useMemo(
    () => getTranscriptRenderWindow(messages, { startIndex: transcriptWindowStart }),
    [messages, transcriptWindowStart],
  );

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

    if (!initialLoadSettledRef.current) {
      if (currentKeys.size > 0) {
        prevMessageKeysRef.current = currentKeys;
        for (const key of currentKeys) seenMessageKeysRef.current.add(key);
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
      if (prevKeys.has(key) || seenKeys.has(key)) continue;

      const createdAt = new Date(message.createdAt).getTime();
      const isFresh = Number.isFinite(createdAt) && now - createdAt < FRESHNESS_MS;
      if (isFresh && message.role === "assistant") {
        hasNewAssistantMessage = true;
      }
    }

    for (const key of currentKeys) seenKeys.add(key);
    prevMessageKeysRef.current = currentKeys;

    if (hasNewAssistantMessage && useUIStore.getState().rpNotificationSound) {
      playNotificationPing();
    }
  }, [activeChatId, messages]);

  const visibleMessages = transcriptWindow.messages;
  const loadedMessageOffset = totalMessageCount - (messages?.length ?? 0);

  return (
    <div data-component="ChatArea.Roleplay" className="flex flex-1 overflow-hidden">
      <div className="rpg-chat-area mari-chat-area relative flex flex-1 flex-col overflow-hidden">
        <CrossfadeBackground url={chatBackground} blurPx={chatBackgroundBlur} />
        <div className="rpg-overlay absolute inset-0" />
        <div className="rpg-vignette pointer-events-none absolute inset-0" />
        {weatherEffects && <WeatherEffectsConnected />}
        {showSpriteOverlay && (
          <Suspense fallback={null}>
            <SpriteOverlay
              characterIds={spriteCharacterIds}
              messages={msgPayload}
              side={spritePosition}
              spriteDisplayModes={overlaySpriteDisplayModes}
              spriteExpressions={spriteExpressions}
              spritePlacements={spritePlacements}
              editing={spriteArrangeMode}
              spriteScale={spriteScale}
              spriteOpacity={spriteOpacity}
              onPlacementChange={onSpritePlacementChange}
            />
          </Suspense>
        )}

        <div className="relative flex flex-1 overflow-hidden">
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div ref={topChromeRef} className="pointer-events-none absolute inset-x-0 top-0 z-40">
              <div
                data-tracker-panel-anchor="roleplay-hud"
                className={cn(
                  "pointer-events-none relative z-40 items-center py-2 max-md:hidden",
                  centerCompact ? "hidden" : "flex",
                )}
                style={{
                  paddingLeft: "calc(1rem + var(--tracker-panel-hud-clear-left, 0px))",
                  paddingRight: "calc(1rem + var(--tracker-panel-hud-clear-right, 0px))",
                }}
              >
                {chat && chatMeta.enableAgents && (
                  <div className="pointer-events-auto flex-1 overflow-x-auto">
                    <Suspense fallback={null}>
                      <RoleplayHUD
                        chatId={chat.id}
                        characterCount={chatCharIds.length}
                        layout="top"
                        isStreaming={isStreaming}
                        onRetriggerTrackers={onRerunTrackers}
                        onRetryFailedAgents={onRetryFailedAgents}
                        onRerunSingleTracker={onRerunSingleTracker}
                        enabledAgentTypes={enabledAgentTypes}
                        manualTrackers={!!chatMeta.manualTrackers}
                        injectionSourceMessages={messages}
                      />
                    </Suspense>
                  </div>
                )}
                <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5">
                  <ChatBranchSelector
                    activeChatId={activeChatId}
                    activeChatName={chat?.name}
                    groupId={chat?.groupId ?? null}
                    variant="roleplay"
                  />
                  <ChatToolbarMenu>
                    <SummaryButton
                      chatId={chat?.id ?? null}
                      summary={chatMeta.summary ?? null}
                      summaryEntries={
                        Array.isArray(chatMeta.summaryEntries) ? (chatMeta.summaryEntries as ChatSummaryEntry[]) : []
                      }
                      summaryContextSize={summaryContextSize}
                      summaryPromptTemplates={
                        Array.isArray(chatMeta.summaryPromptTemplates) ? chatMeta.summaryPromptTemplates : []
                      }
                      activeSummaryPromptTemplateId={
                        typeof chatMeta.activeSummaryPromptTemplateId === "string"
                          ? chatMeta.activeSummaryPromptTemplateId
                          : null
                      }
                      totalMessageCount={totalMessageCount}
                    />
                    <ActiveContextLinksButton
                      chat={chat}
                      chatMeta={chatMeta}
                      chatCharIds={chatCharIds}
                      characterMap={characterMap}
                    />
                    <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                    <ChatToolbarButton icon={<Image size="0.875rem" />} title="Gallery" onClick={onOpenGallery} />
                    {chat?.connectedChatId && (
                      <ChatToolbarButton
                        icon={<ArrowRightLeft size="0.875rem" />}
                        title={linkedChatName ? `Switch to ${linkedChatName}` : "Connected chat"}
                        onClick={() => useChatStore.getState().setActiveChatId(chat.connectedChatId!)}
                      />
                    )}
                    <ChatToolbarButton
                      icon={<Settings2 size="0.875rem" />}
                      title="Chat Settings"
                      onClick={onOpenSettings}
                    />
                  </ChatToolbarMenu>
                </div>
              </div>
              <div
                data-tracker-panel-anchor={centerCompact ? "roleplay-hud" : undefined}
                className={cn(
                  "pointer-events-auto relative z-40 w-full flex-col",
                  centerCompact ? "flex" : "flex md:hidden",
                )}
              >
                {chat && chatMeta.enableAgents && (
                  <div
                    className="flex min-w-0 w-full items-center gap-1.5 overflow-x-auto pb-1 pt-2"
                    style={{
                      paddingLeft: "calc(0.5rem + var(--tracker-panel-hud-clear-left, 0px))",
                      paddingRight: "calc(0.5rem + var(--tracker-panel-hud-clear-right, 0px))",
                    }}
                  >
                    <Suspense fallback={null}>
                      <RoleplayHUD
                        chatId={chat.id}
                        characterCount={chatCharIds.length}
                        layout="top"
                        isStreaming={isStreaming}
                        onRetriggerTrackers={onRerunTrackers}
                        onRetryFailedAgents={onRetryFailedAgents}
                        onRerunSingleTracker={onRerunSingleTracker}
                        enabledAgentTypes={enabledAgentTypes}
                        manualTrackers={!!chatMeta.manualTrackers}
                        mobileCompact
                        injectionSourceMessages={messages}
                      />
                    </Suspense>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ChatToolbarMenu>
                        <ChatBranchSelector
                          activeChatId={activeChatId}
                          activeChatName={chat?.name}
                          groupId={chat?.groupId ?? null}
                          variant="roleplay"
                          compact
                        />
                        <SummaryButton
                          chatId={chat?.id ?? null}
                          summary={chatMeta.summary ?? null}
                          summaryEntries={
                            Array.isArray(chatMeta.summaryEntries)
                              ? (chatMeta.summaryEntries as ChatSummaryEntry[])
                              : []
                          }
                          summaryContextSize={summaryContextSize}
                          summaryPromptTemplates={
                            Array.isArray(chatMeta.summaryPromptTemplates) ? chatMeta.summaryPromptTemplates : []
                          }
                          activeSummaryPromptTemplateId={
                            typeof chatMeta.activeSummaryPromptTemplateId === "string"
                              ? chatMeta.activeSummaryPromptTemplateId
                              : null
                          }
                          totalMessageCount={totalMessageCount}
                        />
                        <ActiveContextLinksButton
                          chat={chat}
                          chatMeta={chatMeta}
                          chatCharIds={chatCharIds}
                          characterMap={characterMap}
                        />
                        <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                        <ChatToolbarButton icon={<Image size="0.875rem" />} title="Gallery" onClick={onOpenGallery} />
                        {chat?.connectedChatId && (
                          <ChatToolbarButton
                            icon={<ArrowRightLeft size="0.875rem" />}
                            title={linkedChatName ? `Switch to ${linkedChatName}` : "Connected chat"}
                            onClick={() => useChatStore.getState().setActiveChatId(chat.connectedChatId!)}
                          />
                        )}
                        <ChatToolbarButton
                          icon={<Settings2 size="0.875rem" />}
                          title="Chat Settings"
                          onClick={onOpenSettings}
                        />
                      </ChatToolbarMenu>
                    </div>
                  </div>
                )}
                {chat && !chatMeta.enableAgents && (
                  <div className="flex w-full items-center justify-end gap-1.5 px-2 pb-1 pt-2">
                    <ChatToolbarMenu>
                      <ChatBranchSelector
                        activeChatId={activeChatId}
                        activeChatName={chat?.name}
                        groupId={chat?.groupId ?? null}
                        variant="roleplay"
                        compact
                      />
                      <SummaryButton
                        chatId={chat?.id ?? null}
                        summary={chatMeta.summary ?? null}
                        summaryEntries={
                          Array.isArray(chatMeta.summaryEntries) ? (chatMeta.summaryEntries as ChatSummaryEntry[]) : []
                        }
                        summaryContextSize={summaryContextSize}
                        summaryPromptTemplates={
                          Array.isArray(chatMeta.summaryPromptTemplates) ? chatMeta.summaryPromptTemplates : []
                        }
                        activeSummaryPromptTemplateId={
                          typeof chatMeta.activeSummaryPromptTemplateId === "string"
                            ? chatMeta.activeSummaryPromptTemplateId
                            : null
                        }
                        totalMessageCount={totalMessageCount}
                      />
                      <ActiveContextLinksButton
                        chat={chat}
                        chatMeta={chatMeta}
                        chatCharIds={chatCharIds}
                        characterMap={characterMap}
                      />
                      <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                      <ChatToolbarButton icon={<Image size="0.875rem" />} title="Gallery" onClick={onOpenGallery} />
                      {chat?.connectedChatId && (
                        <ChatToolbarButton
                          icon={<ArrowRightLeft size="0.875rem" />}
                          title={linkedChatName ? `Switch to ${linkedChatName}` : "Connected chat"}
                          onClick={() => useChatStore.getState().setActiveChatId(chat.connectedChatId!)}
                        />
                      )}
                      <ChatToolbarButton
                        icon={<Settings2 size="0.875rem" />}
                        title="Chat Settings"
                        onClick={onOpenSettings}
                      />
                    </ChatToolbarMenu>
                  </div>
                )}
              </div>
            </div>

            {encounterActive && (
              <Suspense fallback={null}>
                <EncounterModal />
              </Suspense>
            )}

            <div className={cn("absolute inset-0 z-10 overflow-hidden", TRACKER_FOREGROUND_AVOIDANCE_CLASS)}>
              <div
                ref={scrollRef}
                data-chat-scroll
                className={cn(
                  "rpg-chat-messages-mobile mari-messages-scroll relative h-full overflow-y-auto overflow-x-hidden",
                  centerCompact ? "px-3" : "px-3 md:px-[15%]",
                )}
                style={{
                  paddingTop: Math.max(16, chromeHeights.top + 12),
                  paddingBottom: Math.max(16, chromeHeights.bottom + 12),
                  scrollPaddingTop: Math.max(16, chromeHeights.top + 8),
                  scrollPaddingBottom: Math.max(16, chromeHeights.bottom + 12),
                }}
              >
                {hasNextPage && (
                  <div className="mb-3 flex justify-center">
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
                      Load More
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
                  if (isHiddenFromUser(msg)) return null;
                  const sourceIndex = transcriptWindow.startIndex + i;
                  const messageDepth = (messages?.length ?? 0) - 1 - sourceIndex;
                  const messageOrderIndex = loadedMessageOffset + sourceIndex;
                  const isRegenerating = hasLiveStream && regenerateMessageId === msg.id;
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
                          onPeekPrompt={onPeekPrompt}
                          onBranch={onBranch}
                          onCloneSceneFromHere={onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          hasDraftInput={hasDraftInput}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={isGrouped(sourceIndex)}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedMessageIds.has(msg.id)}
                          onToggleSelect={onToggleSelectMessage}
                        />
                      ) : (
                        <ChatMessage
                          message={msg}
                          isStreaming={false}
                          onDelete={onDelete}
                          onRegenerate={onRegenerate}
                          onEdit={onEdit}
                          onSetActiveSwipe={onSetActiveSwipe}
                          onToggleConversationStart={onToggleConversationStart}
                          onToggleHiddenFromAI={onToggleHiddenFromAI}
                          onPeekPrompt={onPeekPrompt}
                          onBranch={onBranch}
                          onCloneSceneFromHere={onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          hasDraftInput={hasDraftInput}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={isGrouped(sourceIndex)}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={multiSelectMode}
                          isSelected={selectedMessageIds.has(msg.id)}
                          onToggleSelect={onToggleSelectMessage}
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
                />

                {!isStreaming && <CyoaChoices messages={visibleMessages} />}

                {hasLiveStream && !regenerateMessageId && (
                  <StreamingIndicator
                    activeChatId={activeChatId}
                    chatCharIds={chatCharIds}
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

            <div
              ref={inputChromeRef}
              className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-30", TRACKER_FOREGROUND_AVOIDANCE_CLASS)}
            >
              <div className={cn("pointer-events-auto relative", centerCompact ? "px-3" : "px-3 md:px-[12%]")}>
                {chatMeta.sceneStatus === "active" && (
                  <EndSceneBar
                    sceneChatId={activeChatId}
                    originChatId={chatMeta.sceneOriginChatId}
                    onConclude={onConcludeScene}
                    onAbandon={onAbandonScene}
                    onFork={onForkScene}
                    isForking={isForkingScene}
                  />
                )}
                {combatAgentEnabled && (
                  <div className="flex justify-center py-1">
                    <button
                      onClick={onStartEncounter}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs text-foreground/50 transition-all hover:bg-foreground/10 hover:text-orange-300"
                      title="Start Combat Encounter"
                    >
                      <Swords size="0.875rem" />
                      <span>Encounter</span>
                    </button>
                  </div>
                )}
                <ChatInput
                  key={activeChatId}
                  mode={isRoleplay ? "roleplay" : "conversation"}
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

      <ChatCommonOverlays
        chat={chat}
        activeChatId={activeChatId}
        settingsOpen={settingsOpen}
        settingsAnchor={settingsAnchor}
        filesOpen={filesOpen}
        galleryOpen={galleryOpen}
        galleryAnchor={galleryAnchor}
        wizardOpen={wizardOpen}
        peekPromptData={peekPromptData}
        deleteDialogMessageId={deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
        deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
        deleteDialogSwipeCount={deleteDialogSwipeCount}
        multiSelectMode={multiSelectMode}
        selectedMessageCount={selectedMessageIds.size}
        sceneSettings={{
          spriteArrangeMode,
          onToggleSpriteArrange,
          onResetSpritePlacements,
          onSpriteSideChange,
        }}
        onCloseSettings={onCloseSettings}
        onCloseFiles={onCloseFiles}
        onCloseGallery={onCloseGallery}
        onIllustrate={onIllustrate}
        onWizardFinish={onWizardFinish}
        onClosePeekPrompt={onClosePeekPrompt}
        onDeleteConfirm={onDeleteConfirm}
        onDeleteSwipe={onDeleteSwipe}
        onDeleteMore={onDeleteMore}
        onCloseDeleteDialog={onCloseDeleteDialog}
        onBulkDelete={onBulkDelete}
        onCancelMultiSelect={onCancelMultiSelect}
        onUnselectAllMessages={onUnselectAllMessages}
        onSelectAllAboveSelection={onSelectAllAboveSelection}
        onSelectAllBelowSelection={onSelectAllBelowSelection}
      />
    </div>
  );
}
