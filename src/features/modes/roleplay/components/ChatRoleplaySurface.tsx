import { createPortal } from "react-dom";
import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { SpritePlacement, SpriteSide } from "../../../../engine/contracts/types/chat";
import type { SceneForkMode } from "../../../../engine/contracts/types/scene";
import {
  FolderOpen,
  Image,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  LayoutGrid,
  PenLine,
  ScrollText,
  Settings2,
  Swords,
  ChevronUp,
  ArrowRightLeft,
  GitBranch,
  Globe,
} from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import { TOOLS_PANELS, useTopBarActions } from "../../../../shared/components/mobile-shell-actions";
import { getConnectedChatDisplayName } from "../../../../shared/lib/chat-display";
import { resolveManagedLocalAssetUrl } from "../../../../shared/api/local-file-api";
import { useUIStore } from "../../../../shared/stores/ui.store";
import { useIsMobile } from "../../../../shared/hooks/use-is-mobile";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { useGameStateStore } from "../../../runtime/world-state/index";
import { ChatMessage, getTranscriptRenderWindow, TRANSCRIPT_RENDER_WINDOW_STEP } from "../../shared/chat-ui/index";
import { ChatInput } from "../../shared/chat-ui/index";
import { CyoaChoices } from "./CyoaChoices";
import { ChatBranchSelector, type ChatBranchSelectorHandle } from "../../shared/chat-ui/index";
import { EndSceneBar, SceneBanner } from "../../shared/scene-ui";
import { ChatCommonOverlays } from "../../shared/chat-ui/index";
import { ActiveWorldInfoButton } from "../../../runtime/visuals/index";
import type { SpriteDisplayMode } from "../../../runtime/visuals/sprite-display-modes";
import type {
  CharacterMap,
  ExpressionAvatarResolver,
  MessageSelectionToggle,
  MessageWithSwipes,
  PeekPromptData,
  PeekPromptOptions,
  PersonaInfo,
  RegenerateOptions,
} from "../../shared/chat-ui/types";

type ChatData = ComponentProps<typeof ChatCommonOverlays>["chat"];

const RoleplayHUD = lazy(async () => {
  const module = await import("./RoleplayHUD");
  return { default: module.RoleplayHUD };
});

const WeatherEffects = lazy(async () => {
  const module = await import("../../../runtime/visuals/index");
  return { default: module.WeatherEffects };
});

const SpriteOverlay = lazy(async () => {
  const module = await import("../../../runtime/visuals/index");
  return { default: module.SpriteOverlay };
});

const EchoChamberPanel = lazy(async () => {
  const module = await import("../../shared/chat-ui/index");
  return { default: module.EchoChamberPanel };
});

const EncounterModal = lazy(async () => {
  const module = await import("./EncounterModal");
  return { default: module.EncounterModal };
});

const SummaryPopover = lazy(async () => {
  const module = await import("../../shared/chat-ui/index");
  return { default: module.SummaryPopover };
});

const AuthorNotesPanel = lazy(async () => {
  const module = await import("./ChatRoleplayPanels");
  return { default: module.AuthorNotesPanel };
});

const PANEL_BACKDROP =
  "fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]";
const TRACKER_FOREGROUND_AVOIDANCE_CLASS =
  "pl-[var(--tracker-chat-avoid-left)] pr-[var(--tracker-chat-avoid-right)] transition-[padding] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]";
const TRACKER_SCROLL_AVOIDANCE_CLASS = "transition-[padding] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]";
const PANEL_CONTAINER =
  "relative max-h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in";

function WeatherEffectsConnected({ chatId }: { chatId: string | null }) {
  const gs = useGameStateStore((s) => (chatId && s.current?.chatId === chatId ? s.current : null));
  return (
    <Suspense fallback={null}>
      <WeatherEffects weather={gs?.weather ?? null} timeOfDay={gs?.time ?? null} />
    </Suspense>
  );
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
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [bgA, setBgA] = useState<string | null>(null);
  const [bgB, setBgB] = useState<string | null>(null);
  const [aActive, setAActive] = useState(true);
  const activeSlot = useRef<"a" | "b">("a");
  const safeBlurPx = Math.max(0, Math.min(24, Number.isFinite(blurPx) ? blurPx : 0));
  const blurStyle: CSSProperties =
    safeBlurPx > 0
      ? {
          filter: `blur(${safeBlurPx}px)`,
          transform: `scale(${1 + safeBlurPx / 120})`,
        }
      : {};

  useEffect(() => {
    let cancelled = false;
    setResolvedUrl(null);
    resolveManagedLocalAssetUrl(url)
      .then((nextUrl) => {
        if (!cancelled) setResolvedUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const currentUrl = activeSlot.current === "a" ? bgA : bgB;
    if (resolvedUrl === currentUrl) return;

    applyUrl(resolvedUrl);

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
  }, [bgA, bgB, resolvedUrl]);

  return (
    <>
      <div
        className={cn(
          "mari-background pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{ ...blurStyle, backgroundImage: bgA ? `url(${bgA})` : "none", opacity: aActive ? 1 : 0 }}
      />
      <div
        className={cn(
          "mari-background pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ease-in-out",
          className,
        )}
        style={{ ...blurStyle, backgroundImage: bgB ? `url(${bgB})` : "none", opacity: aActive ? 0 : 1 }}
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
  const streamBuffer = useChatStore((s) => s.streamBuffers.get(activeChatId) ?? s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffers.get(activeChatId) ?? s.thinkingBuffer);
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
  const streamBuffer = useChatStore((s) => s.streamBuffers.get(msg.chatId) ?? s.streamBuffer);
  const thinkingBuffer = useChatStore((s) => s.thinkingBuffers.get(msg.chatId) ?? s.thinkingBuffer);
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

function RpToolbarButton({
  icon,
  title,
  onClick,
  size,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  size?: "sm";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-full border bg-foreground/5 text-foreground/60 backdrop-blur-md transition-all hover:bg-foreground/10 hover:text-foreground",
        size === "sm" ? "p-1" : "p-1.5",
        "border-foreground/10",
      )}
      title={title}
    >
      {icon}
    </button>
  );
}

function ToolbarMenu({ children, mobilePortal = true, variant = "inline" }: { children: ReactNode; mobilePortal?: boolean; variant?: "inline" | "fab" }) {
  const compact = useUIStore((s) => s.centerCompact);
  const mobileChatToolsOpen = useUIStore((s) => s.mobileChatToolsOpen);
  const setMobileChatToolsOpen = useUIStore((s) => s.setMobileChatToolsOpen);
  const btnRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const isMobileViewport = useIsMobile();

  // On mobile the store flag is the single source of truth; desktop uses its own local toggle.
  const [desktopOpen, setDesktopOpen] = useState(false);
  const open = isMobileViewport && mobilePortal ? mobileChatToolsOpen : desktopOpen;

  const handleClose = () => {
    if (isMobileViewport && mobilePortal) setMobileChatToolsOpen(false);
    else setDesktopOpen(false);
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current || isMobileViewport) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open, isMobileViewport]);

  const triggerBtn = (
    <button
      type="button"
      onClick={() => {
        if (open) {
          handleClose();
        } else if (isMobileViewport && mobilePortal) {
          setMobileChatToolsOpen(true);
        } else {
          setDesktopOpen(true);
        }
      }}
      className={cn(
        variant === "fab"
          ? "flex h-9 w-9 items-center justify-center rounded-full bg-transparent p-1.5 text-foreground/60 transition-all hover:bg-[var(--accent)]/30 hover:text-foreground"
          : "flex w-9 items-center justify-center rounded-xl border bg-[var(--card)] p-1.5 text-foreground/60 backdrop-blur-md transition-all hover:bg-[var(--accent)] hover:text-foreground",
        variant !== "fab" && "border-foreground/10",
        open && "bg-[var(--accent)] border-foreground/20 text-foreground",
      )}
      title="More options"
    >
      <MoreHorizontal size={variant === "fab" ? "1rem" : "0.9375rem"} />
    </button>
  );

  return (
    <>
      <div className={cn("items-center gap-1.5 max-md:hidden", compact ? "hidden" : "flex")}>{children}</div>
      {variant === "fab" ? (
        <div className="md:hidden" ref={fabRef}>
          {triggerBtn}
        </div>
      ) : (
        <div className={cn("relative shrink-0 max-md:hidden", compact ? "block" : "block md:hidden")} ref={btnRef}>
          {triggerBtn}
        </div>
      )}
      {open &&
        createPortal(
          isMobileViewport && mobilePortal ? (
            <>
              <div
                className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
              />
              <div
                ref={popRef}
                className="fixed bottom-0 left-0 right-0 z-[9999] flex flex-wrap items-center justify-center gap-2 rounded-t-2xl border-t border-foreground/10 bg-[var(--card)] p-4 shadow-xl backdrop-blur-xl"
                style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                onClick={handleClose}
              >
                {children}
              </div>
            </>
          ) : (
            <>
              <div className="fixed inset-0 z-[9997]" onClick={handleClose} />
              <div
                ref={popRef}
                className="fixed z-[9999] flex w-9 flex-col items-center gap-0.5 rounded-xl border border-foreground/10 bg-[var(--card)] p-1 shadow-xl backdrop-blur-xl animate-message-in"
                style={{ top: pos.top, right: pos.right }}
                onClick={handleClose}
              >
                {children}
              </div>
            </>
          ),
          document.body,
        )}
    </>
  );
}

function SummaryButton({
  chatId,
  summary,
  summaryContextSize,
  totalMessageCount,
  onContextSizeChange,
  buttonClassName,
  children,
}: {
  chatId: string | null;
  summary: string | null;
  summaryContextSize: number;
  totalMessageCount: number;
  onContextSizeChange: (size: number) => void;
  buttonClassName?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const compact = useUIStore((s) => s.centerCompact);

  if (!chatId) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={
          buttonClassName ??
          cn(
            "flex items-center justify-center rounded-full border backdrop-blur-md transition-all",
            compact ? "p-1" : "p-1.5",
            open
              ? "bg-foreground/15 border-foreground/20 text-foreground/90"
              : summary
                ? "bg-foreground/10 border-foreground/25 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
                : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
          )
        }
        title="Chat Summary"
      >
        {children ?? <ScrollText size="0.875rem" />}
      </button>
      {open && (
        <Suspense fallback={null}>
          <SummaryPopover
            chatId={chatId}
            summary={summary}
            contextSize={summaryContextSize}
            totalMessageCount={totalMessageCount}
            onContextSizeChange={onContextSizeChange}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function metadataString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function metadataStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is string => item.length > 0)
    : [];
}

function AuthorNotesButton({ chatId, chatMeta }: { chatId: string | null; chatMeta: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
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
        className={cn(
          "flex items-center justify-center rounded-full border backdrop-blur-md transition-all",
          compact ? "p-1" : "p-1.5",
          open
            ? "bg-foreground/15 border-foreground/20 text-foreground/90"
            : hasNotes
              ? "bg-foreground/10 border-foreground/25 text-foreground/80 hover:bg-foreground/15 hover:text-foreground"
              : "bg-foreground/5 border-foreground/10 text-foreground/60 hover:bg-foreground/10 hover:text-foreground",
        )}
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
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl shadow-black/40 animate-message-in">
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
  chatMeta: Record<string, unknown>;
  chatMode: string;
  isRoleplay: boolean;
  centerCompact: boolean;
  chatBackground: string | null;
  weatherEffects: boolean;
  agentsUiEnabled: boolean;
  expressionAgentEnabled: boolean;
  expressionAvatarsEnabled: boolean;
  expressionAvatarResolver?: ExpressionAvatarResolver;
  combatAgentEnabled: boolean;
  encounterActive: boolean;
  spritePosition: SpriteSide;
  spriteCharacterIds: string[];
  spriteDisplayModes: SpriteDisplayMode[];
  spriteExpressions: Record<string, string>;
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
  filesOpen: boolean;
  galleryOpen: boolean;
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
  onRegenerate: (messageId: string, options?: RegenerateOptions) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onSetActiveSwipe: (messageId: string, index: number) => void;
  onToggleConversationStart: (messageId: string, current: boolean) => void;
  onToggleHiddenFromAI: (messageId: string, current: boolean) => void;
  onPeekPrompt: (options?: PeekPromptOptions) => void;
  onBranch?: (messageId: string) => void;
  onCloneSceneFromHere?: (messageId: string) => void;
  isCloneSceneFromHereDisabled?: boolean;
  onToggleSelectMessage: (toggle: MessageSelectionToggle) => void;
  onSummaryContextSizeChange: (size: number) => void;
  onRerunTrackers: () => void;
  onRerunSingleTracker: (agentType: string) => void;
  onRetryFailedAgents?: () => void;
  onRetryAgent?: (agentType: string) => void;
  onStartEncounter: () => void;
  onConcludeScene: () => void;
  onAbandonScene: () => void;
  onForkScene: (sceneChatId: string, mode: SceneForkMode) => void;
  isForkingScene?: boolean;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
  onOpenGallery: () => void;
  onCloseSettings: () => void;
  onCloseFiles: () => void;
  onCloseGallery: () => void;
  onIllustrate?: () => void | Promise<void>;
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
  agentsUiEnabled,
  expressionAgentEnabled,
  expressionAvatarsEnabled,
  expressionAvatarResolver,
  combatAgentEnabled,
  encounterActive,
  spritePosition,
  spriteCharacterIds,
  spriteDisplayModes,
  spriteExpressions,
  spritePlacements,
  spriteScale,
  spriteOpacity,
  spriteArrangeMode,
  enabledAgentTypes,
  chatCharIds,
  characterMap,
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
  filesOpen,
  galleryOpen,
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
  onSummaryContextSizeChange,
  onRerunTrackers,
  onRerunSingleTracker,
  onRetryFailedAgents,
  onRetryAgent,
  onStartEncounter,
  onConcludeScene,
  onAbandonScene,
  onForkScene,
  isForkingScene,
  onOpenSettings,
  onOpenFiles,
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
  const linkedChatName = chat?.connectedChatId
    ? getConnectedChatDisplayName(allChats?.find((c) => c.id === chat.connectedChatId))
    : undefined;
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const chatBackgroundBlur = useUIStore((s) => s.chatBackgroundBlur);
  const isConcludedScene = chatMeta.sceneStatus === "concluded";
  const [addonsReady, setAddonsReady] = useState(false);
  const messageActions = isConcludedScene
    ? {
        onDelete: undefined,
        onRegenerate: undefined,
        onEdit: undefined,
        onSetActiveSwipe: undefined,
        onToggleConversationStart: undefined,
        onToggleHiddenFromAI: undefined,
        onBranch: undefined,
        onCloneSceneFromHere: undefined,
        multiSelectMode: false,
        isSelected: false,
        onToggleSelect: undefined,
      }
    : {
        onDelete,
        onRegenerate,
        onEdit,
        onSetActiveSwipe,
        onToggleConversationStart,
        onToggleHiddenFromAI,
        onBranch,
        onCloneSceneFromHere,
        multiSelectMode,
        isSelected: undefined,
        onToggleSelect: onToggleSelectMessage,
      };
  const hideEchoChamberOnMobile =
    sidebarOpen || rightPanelOpen || settingsOpen || filesOpen || galleryOpen || wizardOpen;
  const { setRightSlot } = useTopBarActions();
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const branchSelectorRef = useRef<ChatBranchSelectorHandle | null>(null);
  const [transcriptWindowStart, setTranscriptWindowStart] = useState<number | null>(null);
  const previousTailRef = useRef<{ messageId: string | undefined; isStreaming: boolean }>({
    messageId: undefined,
    isStreaming: false,
  });
  const inactiveCharacterIdSet = useMemo(
    () => new Set(metadataStringArray(chatMeta.inactiveCharacterIds)),
    [chatMeta.inactiveCharacterIds],
  );
  const activeChatCharIds = useMemo(
    () => chatCharIds.filter((id) => !inactiveCharacterIdSet.has(id)),
    [chatCharIds, inactiveCharacterIdSet],
  );
  const activeCharacterNames = useMemo(
    () => activeChatCharIds.map((id) => characterMap.get(id)?.name).filter((name): name is string => !!name),
    [activeChatCharIds, characterMap],
  );
  const transcriptWindow = useMemo(
    () => getTranscriptRenderWindow(messages, { startIndex: transcriptWindowStart }),
    [messages, transcriptWindowStart],
  );
  const newestMsgId = messages?.[messages.length - 1]?.id;
  useEffect(() => {
    const previousTail = previousTailRef.current;
    const tailMessageChanged =
      !!newestMsgId && !!previousTail.messageId && previousTail.messageId !== newestMsgId;
    const streamingStarted = isStreaming && !previousTail.isStreaming;
    if (transcriptWindowStart !== null && (tailMessageChanged || streamingStarted)) {
      setTranscriptWindowStart(null);
    }
    previousTailRef.current = { messageId: newestMsgId, isStreaming };
  }, [isStreaming, newestMsgId, transcriptWindowStart]);

  const handleShowOlderMessages = () => {
    if (transcriptWindow.hiddenBeforeCount > 0) {
      setTranscriptWindowStart(Math.max(0, transcriptWindow.startIndex - TRANSCRIPT_RENDER_WINDOW_STEP));
      return;
    }
    if (!hasNextPage || isFetchingNextPage) return;
    setTranscriptWindowStart(0);
    onLoadMore();
  };
  const handleShowNewerMessages = () => {
    setTranscriptWindowStart((currentStart) => {
      const current = currentStart ?? transcriptWindow.startIndex;
      const next = Math.min(transcriptWindow.latestStartIndex, current + TRANSCRIPT_RENDER_WINDOW_STEP);
      return next >= transcriptWindow.latestStartIndex ? null : next;
    });
  };
  useEffect(() => {
    if (!toolsSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsSheetOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const path = e.composedPath();
      const insideMoreMenu = path.some((entry) => {
        if (!(entry instanceof HTMLElement)) return false;
        return (
          entry === moreMenuBtnRef.current ||
          entry === moreMenuRef.current ||
          moreMenuBtnRef.current?.contains(entry) ||
          moreMenuRef.current?.contains(entry) ||
          entry.dataset.chatBranchPopover !== undefined
        );
      });
      if (insideMoreMenu) return;
      setMoreMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!chat) { setRightSlot(null); return; }
    setRightSlot(
      <>
        <button
          ref={moreMenuBtnRef}
          type="button"
          onClick={() => {
            setToolsSheetOpen(false);
            setMoreMenuOpen((v) => !v);
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-all active:scale-90 hover:bg-[var(--accent)]/30 hover:text-[var(--foreground)]",
            moreMenuOpen && "bg-[var(--accent)]/30 text-[var(--foreground)]",
          )}
          title="More options"
        >
          <MoreVertical size="1.15rem" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMoreMenuOpen(false);
            setToolsSheetOpen((v) => !v);
          }}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-all active:scale-90 hover:bg-[var(--accent)]/30 hover:text-[var(--foreground)]",
            toolsSheetOpen && "bg-[var(--accent)]/30 text-[var(--foreground)]",
          )}
          title="Tools"
        >
          <LayoutGrid size="1.15rem" />
        </button>
      </>,
    );
    return () => { setRightSlot(null); };
  }, [chat, moreMenuOpen, toolsSheetOpen, setRightSlot]);

  const overlaySpriteDisplayModes = useMemo(
    () => (expressionAvatarsEnabled ? spriteDisplayModes.filter((mode) => mode !== "expressions") : spriteDisplayModes),
    [expressionAvatarsEnabled, spriteDisplayModes],
  );
  const showSpriteOverlay =
    expressionAgentEnabled && spriteCharacterIds.length > 0 && overlaySpriteDisplayModes.length > 0;

  useEffect(() => {
    setAddonsReady(false);
    setTranscriptWindowStart(null);
    setToolsSheetOpen(false);
    setMoreMenuOpen(false);
    const id = window.setTimeout(() => setAddonsReady(true), 180);
    return () => window.clearTimeout(id);
  }, [activeChatId]);

  return (
    <div data-component="ChatArea.Roleplay" className="flex h-full min-h-0 flex-1 basis-0 overflow-clip">
      <div
        className="rpg-chat-area mari-chat-area mari-card-css relative isolate flex h-full min-h-0 flex-1 basis-0 flex-col overflow-clip min-w-0"
        data-chat-mode="roleplay"
      >
        <CrossfadeBackground url={chatBackground} blurPx={chatBackgroundBlur} />
        <div className="rpg-overlay pointer-events-none absolute inset-0 z-0" />
        <div className="rpg-vignette pointer-events-none absolute inset-0 z-0" />
        {weatherEffects && addonsReady && <WeatherEffectsConnected chatId={activeChatId} />}
        {showSpriteOverlay && addonsReady && (
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
              onExpressionChange={onExpressionChange}
              onPlacementChange={onSpritePlacementChange}
            />
          </Suspense>
        )}

        <div className="relative z-20 flex h-full min-h-0 flex-1 basis-0 overflow-clip min-w-0">
          <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-clip min-w-0">
            <>
              <div
                data-tracker-panel-anchor="roleplay-hud"
                className={cn(
                  "pointer-events-none relative z-30 items-center py-2 max-md:hidden",
                  centerCompact ? "hidden" : "flex",
                )}
                style={{
                  paddingLeft: "calc(1rem + var(--tracker-panel-hud-clear-left, 0px))",
                  paddingRight: "calc(1rem + var(--tracker-panel-hud-clear-right, 0px))",
                }}
              >
                {chat && agentsUiEnabled && addonsReady && (
                  <div className="pointer-events-auto flex-1 overflow-x-auto">
                    <Suspense fallback={null}>
                      <RoleplayHUD
                        chatId={chat.id}
                        characterCount={chatCharIds.length}
                        layout="top"
                        isStreaming={isStreaming}
                        onRetriggerTrackers={onRerunTrackers}
                        onRetryFailedAgents={onRetryFailedAgents}
                        onRetryAgent={onRetryAgent}
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
                  <ToolbarMenu mobilePortal={false}>
                    <SummaryButton
                      chatId={chat?.id ?? null}
                      summary={metadataString(chatMeta.summary) || null}
                      summaryContextSize={summaryContextSize}
                      totalMessageCount={totalMessageCount}
                      onContextSizeChange={onSummaryContextSizeChange}
                    />
                    <ActiveWorldInfoButton chatId={chat?.id ?? null} />
                    <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                    <RpToolbarButton
                      icon={<FolderOpen size="0.875rem" />}
                      title="Manage Chat Files"
                      onClick={onOpenFiles}
                    />
                    <RpToolbarButton icon={<Image size="0.875rem" />} title="Gallery" onClick={onOpenGallery} />
                    {chat?.connectedChatId && (
                      <RpToolbarButton
                        icon={<ArrowRightLeft size="0.875rem" />}
                        title={linkedChatName ? `Switch to ${linkedChatName}` : "Connected chat"}
                        onClick={() => useChatStore.getState().setActiveChatId(chat.connectedChatId!)}
                      />
                    )}
                    <RpToolbarButton
                      icon={<Settings2 size="0.875rem" />}
                      title="Chat Settings"
                      onClick={onOpenSettings}
                    />
                  </ToolbarMenu>
                </div>
              </div>
              <div
                data-tracker-panel-anchor={centerCompact ? "roleplay-hud" : undefined}
                className={cn(
                  "pointer-events-auto relative z-30 w-full flex-col min-w-0",
                  centerCompact ? "flex" : "flex md:hidden",
                )}
              >
                {chat && agentsUiEnabled && addonsReady && (
                  <div
                    className="flex min-w-0 w-full overflow-x-auto items-center gap-1.5 pb-1 pt-2"
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
                        onRetryAgent={onRetryAgent}
                        onRerunSingleTracker={onRerunSingleTracker}
                        enabledAgentTypes={enabledAgentTypes}
                        manualTrackers={!!chatMeta.manualTrackers}
                        mobileCompact
                        injectionSourceMessages={messages}
                      />
                    </Suspense>

                  </div>
                )}

              </div>
            </>

            {encounterActive && (
              <Suspense fallback={null}>
                <EncounterModal />
              </Suspense>
            )}

            <div
              className={cn("relative z-10 min-h-0 flex-1 basis-0 overflow-clip min-w-0", TRACKER_SCROLL_AVOIDANCE_CLASS)}
              style={{
                paddingLeft: "var(--tracker-chat-scroll-avoid-left)",
                paddingRight: "var(--tracker-chat-scroll-avoid-right)",
              }}
            >
              <div
                ref={scrollRef}
                data-chat-scroll
                className={cn(
                  "rpg-chat-messages-mobile mari-messages-scroll relative h-full overflow-y-auto overflow-x-hidden pb-1 pt-4",
                  centerCompact ? "px-3" : "px-3 md:px-[15%]",
                )}
              >
                {(hasNextPage || transcriptWindow.hiddenBeforeCount > 0) && (
                  <div className="mb-3 flex justify-center">
                    <button
                      onClick={handleShowOlderMessages}
                      disabled={isFetchingNextPage}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] hover:text-foreground/90 disabled:opacity-50"
                    >
                      {isFetchingNextPage ? (
                        <Loader2 size="0.75rem" className="animate-spin" />
                      ) : (
                        <ChevronUp size="0.75rem" />
                      )}
                      {transcriptWindow.hiddenBeforeCount > 0 ? "Older Messages" : "Load More"}
                    </button>
                  </div>
                )}

                {isLoading && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-white/60" />
                  </div>
                )}

                {transcriptWindow.messages?.map((msg, i) => {
                  if (isHiddenFromUser(msg)) return null;
                  const isRegenerating = isStreaming && regenerateMessageId === msg.id;
                  const originalIndex = transcriptWindow.startIndex + i;
                  const messageOrderIndex = totalMessageCount - transcriptWindow.totalLoadedCount + originalIndex;
                  const messageDepth = transcriptWindow.totalLoadedCount - 1 - originalIndex;
                  const grouped = i > 0 && isGrouped(originalIndex);
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
                          onDelete={messageActions.onDelete}
                          onRegenerate={messageActions.onRegenerate}
                          onEdit={messageActions.onEdit}
                          onSetActiveSwipe={messageActions.onSetActiveSwipe}
                          onToggleConversationStart={messageActions.onToggleConversationStart}
                          onToggleHiddenFromAI={messageActions.onToggleHiddenFromAI}
                          onPeekPrompt={onPeekPrompt}
                          onBranch={messageActions.onBranch}
                          onCloneSceneFromHere={messageActions.onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={grouped}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={messageActions.multiSelectMode}
                          isSelected={messageActions.isSelected ?? selectedMessageIds.has(msg.id)}
                          onToggleSelect={messageActions.onToggleSelect}
                        />
                      ) : (
                        <ChatMessage
                          message={msg}
                          isStreaming={false}
                          onDelete={messageActions.onDelete}
                          onRegenerate={messageActions.onRegenerate}
                          onEdit={messageActions.onEdit}
                          onSetActiveSwipe={messageActions.onSetActiveSwipe}
                          onToggleConversationStart={messageActions.onToggleConversationStart}
                          onToggleHiddenFromAI={messageActions.onToggleHiddenFromAI}
                          onPeekPrompt={onPeekPrompt}
                          onBranch={messageActions.onBranch}
                          onCloneSceneFromHere={messageActions.onCloneSceneFromHere}
                          isCloneSceneFromHereDisabled={isCloneSceneFromHereDisabled}
                          isLastAssistantMessage={msg.id === lastAssistantMessageId}
                          characterMap={characterMap}
                          personaInfo={personaInfo}
                          chatMode={chatMode}
                          messageDepth={messageDepth}
                          messageIndex={messageOrderIndex + 1}
                          messageOrderIndex={messageOrderIndex}
                          isGrouped={grouped}
                          groupChatMode={groupChatMode}
                          chatCharacterIds={chatCharIds}
                          expressionAvatarResolver={expressionAvatarResolver}
                          multiSelectMode={messageActions.multiSelectMode}
                          isSelected={messageActions.isSelected ?? selectedMessageIds.has(msg.id)}
                          onToggleSelect={messageActions.onToggleSelect}
                        />
                      )}
                    </div>
                  );
                })}

                {!isConcludedScene && !isStreaming && <CyoaChoices messages={messages} />}

                {transcriptWindow.hiddenAfterCount > 0 && (
                  <div className="flex justify-center py-3">
                    <button
                      onClick={handleShowNewerMessages}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] hover:text-foreground/90"
                    >
                      Newer Messages
                    </button>
                  </div>
                )}

                {isStreaming && !regenerateMessageId && (
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

            <div className={cn("relative z-30 shrink-0 min-w-0", TRACKER_FOREGROUND_AVOIDANCE_CLASS)}>
              <div className={cn("relative", centerCompact ? "px-3" : "px-3 md:px-[12%]")}>
                {chatMeta.sceneStatus === "active" && (
                  <EndSceneBar
                    sceneChatId={activeChatId}
                    originChatId={metadataString(chatMeta.sceneOriginChatId) || undefined}
                    onConclude={onConcludeScene}
                    onAbandon={onAbandonScene}
                    onFork={onForkScene}
                    isForking={isForkingScene}
                  />
                )}
                {isConcludedScene && (
                  <SceneBanner
                    variant="scene"
                    originChatId={metadataString(chatMeta.sceneOriginChatId) || undefined}
                    description={metadataString(chatMeta.sceneDescription) || undefined}
                  />
                )}
                {!isConcludedScene && combatAgentEnabled && (
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
                {!isConcludedScene && (
                  <ChatInput
                    key={activeChatId}
                    mode={isRoleplay ? "roleplay" : "conversation"}
                    characterNames={activeCharacterNames}
                    groupResponseOrder={
                      activeChatCharIds.length > 1 && groupChatMode === "individual"
                        ? metadataString(chatMeta.groupResponseOrder, "sequential")
                        : undefined
                    }
                    chatCharacters={activeChatCharIds
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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tools top sheet */}
        {toolsSheetOpen && (
          <>
            <div
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm md:hidden"
              style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
              onClick={() => setToolsSheetOpen(false)}
            />
            <div
              className="fixed left-0 right-0 z-[9999] max-h-[70dvh] overflow-y-auto rounded-b-3xl border-b border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl animate-fade-in-down md:hidden"
              style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
            >
              <p className="px-5 pt-4 pb-3 text-[0.7rem] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
                Panels
              </p>
              <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 overflow-hidden">
                {TOOLS_PANELS.map(({ panel, icon: Icon, label, gradient }) => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => {
                      setToolsSheetOpen(false);
                      setSidebarOpen(false);
                      closeAllDetails();
                      openRightPanel(panel);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--border)]/50 bg-[var(--secondary)]/50 p-4 text-left transition-all active:scale-95 hover:border-[var(--border)]"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                        gradient,
                      )}
                    >
                      <Icon size="1rem" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--foreground)]">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* More options top sheet */}
        {moreMenuOpen &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm md:hidden"
                style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
                onPointerDown={() => setMoreMenuOpen(false)}
                onClick={(event) => event.stopPropagation()}
              />
              <div
                ref={moreMenuRef}
                className="fixed left-0 right-0 z-[9999] max-h-[70dvh] overflow-y-auto rounded-b-3xl border-b border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl animate-fade-in-down md:hidden"
                style={{ top: "calc(3.25rem + env(safe-area-inset-top))" }}
              >
              <p className="px-5 pt-4 pb-3 text-[0.7rem] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
                Chat Options
              </p>

              <div className="flex flex-col pb-3">
                {/* Branches */}
                {chat?.groupId && (
                  <div
                    className="relative flex w-full items-center gap-3 px-5 py-3 transition-all active:bg-[var(--accent)]/30 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); branchSelectorRef.current?.toggle(); }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm">
                      <GitBranch size="0.9rem" />
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">Branches</span>
                    <div className="absolute inset-0 opacity-0 pointer-events-auto">
                      <ChatBranchSelector
                        ref={branchSelectorRef}
                        activeChatId={activeChatId}
                        activeChatName={chat?.name}
                        groupId={chat?.groupId ?? null}
                        variant="roleplay"
                        compact
                      />
                    </div>
                  </div>
                )}

                {/* Connected Chat */}
                {chat?.connectedChatId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!chat.connectedChatId) return;
                      setMoreMenuOpen(false);
                      useChatStore.getState().setActiveChatId(chat.connectedChatId);
                    }}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm">
                      <ArrowRightLeft size="0.9rem" />
                    </div>
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {linkedChatName ? `Switch to ${linkedChatName}` : "Connected chat"}
                    </span>
                  </button>
                )}

                {/* Summary */}
                <SummaryButton
                  chatId={chat?.id ?? null}
                  summary={metadataString(chatMeta.summary) || null}
                  summaryContextSize={summaryContextSize}
                  totalMessageCount={totalMessageCount}
                  onContextSizeChange={onSummaryContextSizeChange}
                  buttonClassName="relative flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <ScrollText size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">Summary</span>
                </SummaryButton>

                {/* World Info */}
                <div
                  className="relative flex w-full items-center gap-3 px-5 py-3 transition-all active:bg-[var(--accent)]/30 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); e.currentTarget.querySelector('button')?.click(); }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 text-white shadow-sm">
                    <Globe size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">World Info</span>
                  <div className="absolute inset-0 opacity-0 pointer-events-auto">
                    <ActiveWorldInfoButton chatId={chat?.id ?? null} />
                  </div>
                </div>

                {/* Author Notes */}
                <div
                  className="relative flex w-full items-center gap-3 px-5 py-3 transition-all active:bg-[var(--accent)]/30 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); e.currentTarget.querySelector('button')?.click(); }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                    <PenLine size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">Author Notes</span>
                  <div className="absolute inset-0 opacity-0 pointer-events-auto">
                    <AuthorNotesButton chatId={chat?.id ?? null} chatMeta={chatMeta} />
                  </div>
                </div>

                {/* Gallery */}
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(false); onOpenGallery(); }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-sm">
                    <Image size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">Gallery</span>
                </button>

                {/* Chat Files */}
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(false); onOpenFiles(); }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-sm">
                    <FolderOpen size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">Chat Files</span>
                </button>

                <div className="mx-5 my-1 h-px bg-[var(--border)]/30" />

                {/* Chat Settings */}
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(false); onOpenSettings(); }}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-all active:bg-[var(--accent)]/30 hover:bg-[var(--accent)]/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-sm">
                    <Settings2 size="0.9rem" />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]">Chat Settings</span>
                </button>
              </div>
              </div>
            </>,
            document.body,
          )}

        {addonsReady && (
          <Suspense fallback={null}>
            <EchoChamberPanel hiddenOnMobile={hideEchoChamberOnMobile} />
          </Suspense>
        )}
      </div>

      <ChatCommonOverlays
        chat={chat}
        activeChatId={activeChatId}
        settingsOpen={settingsOpen}
        filesOpen={filesOpen}
        galleryOpen={galleryOpen}
        wizardOpen={wizardOpen}
        peekPromptData={peekPromptData}
        deleteDialogMessageId={isConcludedScene ? null : deleteDialogMessageId}
        deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
        deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
        deleteDialogSwipeCount={deleteDialogSwipeCount}
        multiSelectMode={!isConcludedScene && multiSelectMode}
        selectedMessageCount={isConcludedScene ? 0 : selectedMessageIds.size}
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
        onBulkDelete={isConcludedScene ? onCancelMultiSelect : onBulkDelete}
        onCancelMultiSelect={onCancelMultiSelect}
        onUnselectAllMessages={onUnselectAllMessages}
        onSelectAllAboveSelection={onSelectAllAboveSelection}
        onSelectAllBelowSelection={onSelectAllBelowSelection}
      />
    </div>
  );
}
