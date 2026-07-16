// ──────────────────────────────────────────────
// Chat: Main chat area — mode-aware rendering
// ──────────────────────────────────────────────
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useQueries, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  useChatMessages,
  useChatMessageCount,
  useChat,
  useDeleteMessage,
  useDeleteMessages,
  useDeleteSwipe,
  useUpdateMessage,
  useUpdateMessageExtra,
  usePeekPrompt,
  useSetActiveSwipe,
  useUpdateChatMetadata,
  useBranchChat,
  useChats,
  chatKeys,
} from "../../hooks/use-chats";

import { useChatStore } from "../../stores/chat.store";
import { useGenerate } from "../../hooks/use-generate";
import { useGenerateGallerySelfie } from "../../hooks/use-gallery";
import {
  characterKeys,
  spriteKeys,
  useActivePersona,
  useCharacters,
  usePersona,
  type SpriteInfo,
} from "../../hooks/use-characters";
import { usePageActivity } from "../../hooks/use-page-activity";
import { useRenderTimer, useWhyRender } from "../../lib/perf-diagnostics";
import { usePresenceClock } from "../../hooks/use-presence-clock";
import { api, ApiError } from "../../lib/api-client";
import { getChatDisplayName, getConnectedChatDisplayName, parseChatMetadata } from "../../lib/chat-display";
import { getChatCharacterIds } from "../../lib/chat-macros";
import { resolveSpriteExpression } from "../../lib/sprite-expression-match";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { parseMessageExtraRecord } from "../../lib/chat-message-extra";
import { chatBackgroundMetadataToUrl, chatBackgroundUrlToMetadata } from "../../lib/backgrounds";
import { useGameStateStore } from "../../stores/game-state.store";
import { useGalleryStore } from "../../stores/gallery.store";
import { toast } from "sonner";
import { BookOpen, Check, HelpCircle, List, X } from "lucide-react";
import {
  APP_VERSION,
  BUILT_IN_AGENTS,
  PROFESSOR_MARI_ID,
  buildGuidedGenerationInstructionMessage,
  normalizeManualTrackerAgentTypes,
  type AchievementEvent,
  type GeneratedSceneVideo,
  type SpritePlacement,
  type SpriteSide,
  type WeekSchedule,
} from "@marinara-engine/shared";
import { resolveLiveConversationStatus } from "../../lib/conversation-presence-status";
import { useUIStore } from "../../stores/ui.store";
import { useAgentStore } from "../../stores/agent.store";
import { cn, parseAvatarCropJson } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { useEncounter } from "../../hooks/use-encounter";
import { useScene } from "../../hooks/use-scene";
import { useEncounterStore } from "../../stores/encounter.store";
import { useTranslationStore } from "../../stores/translation.store";
import { ttsService } from "../../lib/tts-service";
import { useTTSConfig } from "../../hooks/use-tts";
import { achievementKeys, trackAchievementEvent } from "../../hooks/use-achievements";
import { buildTTSVoiceRequests, normalizeTTSCharacterName, withTTSVoiceRequestCacheKeys } from "../../lib/tts-dialogue";
import {
  findLatestTTSAutoplayMessage,
  getTTSAutoplayRevision,
  shouldAutoplayGeneratedTTS,
} from "../../lib/tts-autoplay";
import { CHAT_SCROLL_TO_BOTTOM_EVENT, type ChatScrollToBottomDetail } from "../../lib/chat-scroll-events";
import { CHAT_FLOATING_UI_DISMISS_EVENT } from "../../lib/chat-floating-ui-events";
import { CHAT_TOOLBAR_ACTION_EVENT, readChatToolbarFloatingPanelAnchor } from "./ChatToolbarControls";
import { mirrorSpritePlacements, normalizeSpritePlacements } from "./sprite-placement";
import {
  loadLocalSpriteVisualSettings,
  saveLocalSpriteVisualSettings,
  type LocalSpriteVisualSettings,
} from "./local-sprite-visual-settings";
import {
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
  normalizeSpriteDisplayModes,
} from "./sprite-display-modes";
import type {
  CharacterMap,
  ExpressionAvatarResolver,
  MessageSelectionToggle,
  MessageWithSwipes,
  PeekPromptData,
} from "./chat-area.types";
import { RecentChats } from "./RecentChats";
import { HomeCreditsModal } from "./HomeCreditsModal";
import { HomeProfessorMariChat } from "./HomeProfessorMariChat";
import { HomeAchievements } from "./HomeAchievements";
import { NewChatConnectionGate } from "./NewChatConnectionGate";
import { ChatCommonOverlays, preloadChatSettingsDrawer, type ChatSettingsInitialSection } from "./ChatCommonOverlays";
import { CreatorNotesCssInjector, type CardCssMode, type PersonaCssRow } from "./CreatorNotesCssInjector";
import type { ChatModeFilter } from "../../lib/card-css";
import {
  ImagePromptReviewModal,
  type ImagePromptOverride,
  type ImagePromptReviewItem,
} from "../ui/ImagePromptReviewModal";

export type { CharacterMap };

const isBuiltInAgentType = (agentType: string) => BUILT_IN_AGENTS.some((agent) => agent.id === agentType);
const isBuiltInTrackerAgentType = (agentType: string) =>
  BUILT_IN_AGENTS.some((agent) => agent.id === agentType && agent.category === "tracker" && !agent.libraryHidden);

function compareMessagesByCursor(left: MessageWithSwipes, right: MessageWithSwipes): number {
  const createdAtCompare = left.createdAt.localeCompare(right.createdAt);
  if (createdAtCompare !== 0) return createdAtCompare;
  const leftRowid = typeof left.rowid === "number" ? left.rowid : 0;
  const rightRowid = typeof right.rowid === "number" ? right.rowid : 0;
  if (leftRowid !== rightRowid) return leftRowid - rightRowid;
  return left.id.localeCompare(right.id);
}

function getPageNewestMessage(page: MessageWithSwipes[]): MessageWithSwipes | null {
  return page[page.length - 1] ?? null;
}

function getNewestLoadedMessagePageIndex(pages: MessageWithSwipes[][] | undefined): number {
  if (!pages?.length) return -1;
  let newestIndex = 0;
  for (let index = 1; index < pages.length; index += 1) {
    const newest = getPageNewestMessage(pages[newestIndex] ?? []);
    const candidate = getPageNewestMessage(pages[index] ?? []);
    if (!newest || (candidate && compareMessagesByCursor(candidate, newest) > 0)) {
      newestIndex = index;
    }
  }
  return newestIndex;
}

type GeneratedSceneBackgroundResponse = {
  success: boolean;
  filename: string;
  url: string;
  tag: string;
};

type GenerateSceneBackgroundPayload = {
  chatId: string;
  sceneDescription: string;
  locationSlug: string;
  reason: string;
  force: boolean;
  debugMode: boolean;
  promptOverrides?: ImagePromptOverride[];
};

type GenerateRoleplaySceneVideoPayload = {
  chatId: string;
  galleryImageId?: string;
  queueMediaGenerationRequests: boolean;
  debugMode: boolean;
  promptOverride?: string;
};

type RoleplaySceneVideoPromptPreview = {
  prompt: string;
  galleryImageId: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution: string | null;
  maxPromptLength: number | null;
};

type GenerateConversationSelfiePayload = {
  characterId: string;
  promptOverride?: string;
  negativePromptOverride?: string;
  previewOnly?: boolean;
  queueImageGenerationRequests: boolean;
  debugMode: boolean;
};

function buildRoleplayBackgroundSceneDescription(args: {
  chatName?: string | null;
  characterNames: string[];
  messages?: MessageWithSwipes[];
}): string {
  const recentMessages = (args.messages ?? [])
    .filter((message) => message.role !== "system" && message.content.trim())
    .slice(-8)
    .map((message) => {
      const label = message.role === "user" ? "User" : message.role === "assistant" ? "Character" : "Narrator";
      return `${label}: ${message.content.replace(/\s+/g, " ").trim().slice(0, 260)}`;
    });

  return [
    args.chatName ? `Chat: ${args.chatName}` : null,
    args.characterNames.length ? `Characters in scene: ${args.characterNames.slice(0, 8).join(", ")}` : null,
    recentMessages.length ? `Recent scene:\n${recentMessages.join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1200);
}

function sortLoadedMessagePagesChronologically(pages: MessageWithSwipes[][]): MessageWithSwipes[][] {
  return [...pages].sort((left, right) => {
    const leftNewest = getPageNewestMessage(left);
    const rightNewest = getPageNewestMessage(right);
    if (!leftNewest && !rightNewest) return 0;
    if (!leftNewest) return -1;
    if (!rightNewest) return 1;
    return compareMessagesByCursor(leftNewest, rightNewest);
  });
}

function flattenLoadedMessagePages(
  pages: MessageWithSwipes[][] | undefined,
  pageSize: number,
): MessageWithSwipes[] | undefined {
  if (!pages) return undefined;
  const newestPageIndex = getNewestLoadedMessagePageIndex(pages);
  const newestPage = newestPageIndex >= 0 ? pages[newestPageIndex] : undefined;
  if (pageSize > 0 && pages.length === 1 && newestPage && newestPage.length > pageSize) {
    return newestPage.slice(-pageSize);
  }
  return sortLoadedMessagePagesChronologically(pages).flat();
}

function getNewestLoadedMessagePageLength(pages: MessageWithSwipes[][] | undefined): number {
  const newestPageIndex = getNewestLoadedMessagePageIndex(pages);
  return newestPageIndex >= 0 ? (pages?.[newestPageIndex]?.length ?? 0) : 0;
}

function trimNewestLoadedMessagePage(
  data: InfiniteData<MessageWithSwipes[]> | undefined,
  pageSize: number,
): InfiniteData<MessageWithSwipes[]> | undefined {
  const newestPageIndex = getNewestLoadedMessagePageIndex(data?.pages);
  const newestPage = newestPageIndex >= 0 ? data?.pages[newestPageIndex] : undefined;
  if (!data || !newestPage || newestPage.length <= pageSize) return data;
  const pages = [...data.pages];
  pages[newestPageIndex] = newestPage.slice(-pageSize);
  return { ...data, pages };
}

const normalizeSpriteDisplayValue = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

function startsNewAssistantBubble(message: { extra?: unknown } | null | undefined): boolean {
  return parseMessageExtraRecord(message?.extra).startsNewAssistantBubble === true;
}

function normalizeMessageSpriteExpressions(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const expressions: Record<string, string> = {};
  for (const [key, expression] of Object.entries(value as Record<string, unknown>)) {
    if (typeof expression !== "string") continue;
    const trimmed = expression.trim();
    if (key && trimmed) expressions[key] = trimmed;
  }
  return expressions;
}

function getPersonaSnapshotName(extra: Record<string, unknown>): string | null {
  const snapshot = extra.personaSnapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const name = (snapshot as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function resolveExpressionAvatarSpriteUrl(sprites: SpriteInfo[] | undefined, expression: string): string | null {
  const expressionSprites = (sprites ?? []).filter((sprite) => !sprite.expression.toLowerCase().startsWith("full_"));
  return resolveSpriteExpression(expressionSprites, expression)?.url ?? null;
}

function suppressBuiltInProfessorMariForMode(mode: string | undefined): boolean {
  return mode === "game" || mode === "roleplay" || mode === "visual_novel";
}

const INTUITIVE_SWIPE_MIN_DISTANCE = 56;
const INTUITIVE_SWIPE_MAX_VERTICAL_DRIFT = 44;
const MEDIA_PROMPT_PREVIEW_TIMEOUT_MS = 180_000;
const SCENE_VIDEO_GENERATION_TIMEOUT_MS = 1_800_000;

function isMediaPromptPreviewTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

const shouldIgnoreIntuitiveSwipeTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "a",
        '[contenteditable="true"]',
        '[role="button"]',
        "[data-radix-popper-content-wrapper]",
        "[data-no-intuitive-swipe]",
      ].join(", "),
    ),
  );
};

type AgentInjectionReviewItem = {
  agentType: string;
  agentName: string;
  text: string;
};

type AgentInjectionReviewRequest = {
  chatId: string;
  injections: AgentInjectionReviewItem[];
};

type IllustratorPromptReviewRequest = {
  chatId: string;
  item: ImagePromptReviewItem;
  resultData: Record<string, unknown>;
};

type CharacterRow = { id: string; data: unknown; avatarPath: string | null; comment?: string | null };
type CharacterMapValue = NonNullable<ReturnType<CharacterMap["get"]>>;

function isCharacterRow(value: unknown): value is CharacterRow {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { data?: unknown }).data !== "undefined"
  );
}

function resolveChatPersonaId(chat: unknown): string | null {
  const rawPersonaId = (chat as { personaId?: unknown } | null | undefined)?.personaId;
  if (typeof rawPersonaId === "string" && rawPersonaId.trim()) return rawPersonaId.trim();

  const metadata = parseChatMetadata((chat as { metadata?: unknown } | null | undefined)?.metadata);
  const setupConfig = metadata.gameSetupConfig;
  const rawSetupPersonaId =
    setupConfig && typeof setupConfig === "object" && !Array.isArray(setupConfig)
      ? (setupConfig as { personaId?: unknown }).personaId
      : null;
  return typeof rawSetupPersonaId === "string" && rawSetupPersonaId.trim() ? rawSetupPersonaId.trim() : null;
}

function toCharacterMapValue(char: CharacterRow): CharacterMapValue {
  try {
    const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
    const data = parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {};
    const extensions = data.extensions && typeof data.extensions === "object" ? data.extensions : {};
    return {
      name: data.name ?? "Unknown",
      convoDisplayName: extensions.convoDisplayName || undefined,
      phoneticName: extensions.phoneticName || undefined,
      description: data.description ?? "",
      personality: data.personality ?? "",
      backstory: extensions.backstory ?? "",
      appearance: extensions.appearance ?? "",
      scenario: data.scenario ?? "",
      example: data.mes_example ?? "",
      avatarUrl: char.avatarPath ?? null,
      nameColor: extensions.nameColor || undefined,
      dialogueColor: extensions.dialogueColor || undefined,
      boxColor: extensions.boxColor || undefined,
      avatarCrop: extensions.avatarCrop || null,
      conversationStatus: extensions.conversationStatus || undefined,
      conversationActivity: extensions.conversationActivity || undefined,
    };
  } catch {
    return { name: "Unknown", avatarUrl: char.avatarPath ?? null };
  }
}

// [#3164] Value comparators so the characterMap memo can keep its previous
// identity when a rebuild produced equal contents. A new map identity re-runs
// the regex+macro display pipeline for every mounted message, so renders
// triggered by the presence clock or unrelated metadata writes must not renew
// it. The field list must cover every field of the CharacterMap value type —
// a missed field would make a real change invisible to consumers.
function areCharacterMapValuesEqual(a: CharacterMapValue, b: CharacterMapValue): boolean {
  return (
    a.name === b.name &&
    a.convoDisplayName === b.convoDisplayName &&
    a.phoneticName === b.phoneticName &&
    a.description === b.description &&
    a.personality === b.personality &&
    a.backstory === b.backstory &&
    a.appearance === b.appearance &&
    a.scenario === b.scenario &&
    a.example === b.example &&
    a.avatarUrl === b.avatarUrl &&
    a.nameColor === b.nameColor &&
    a.dialogueColor === b.dialogueColor &&
    a.boxColor === b.boxColor &&
    a.conversationStatus === b.conversationStatus &&
    a.conversationActivity === b.conversationActivity &&
    // avatarCrop is a small plain object — compare by value, not reference.
    (a.avatarCrop === b.avatarCrop || JSON.stringify(a.avatarCrop ?? null) === JSON.stringify(b.avatarCrop ?? null))
  );
}

function areCharacterMapsEqual(a: CharacterMap, b: CharacterMap): boolean {
  if (a.size !== b.size) return false;
  for (const [id, value] of b) {
    const previous = a.get(id);
    if (!previous || !areCharacterMapValuesEqual(previous, value)) return false;
  }
  return true;
}

const ChatConversationSurface = lazy(async () => {
  const module = await import("./ChatConversationSurface");
  return { default: module.ChatConversationSurface };
});

const ChatRoleplaySurface = lazy(async () => {
  const module = await import("./ChatRoleplaySurface");
  return { default: module.ChatRoleplaySurface };
});

const GameSurface = lazy(async () => {
  const module = await import("../game/GameSurface");
  return { default: module.GameSurface };
});

const loadCharacterScheduleEditorModal = async () => {
  const module = await import("./CharacterScheduleEditorModal");
  return { default: module.CharacterScheduleEditorModal };
};

let characterScheduleEditorModalLoadPromise: ReturnType<typeof loadCharacterScheduleEditorModal> | null = null;

function preloadCharacterScheduleEditorModal() {
  characterScheduleEditorModalLoadPromise ??= loadCharacterScheduleEditorModal();
  return characterScheduleEditorModalLoadPromise;
}

const CharacterScheduleEditorModal = lazy(preloadCharacterScheduleEditorModal);

type FloatingPanelAnchor = { right: number; top: number } | null;
type OpenSettingsOptions = { initialSection?: ChatSettingsInitialSection };

type HomeGlistenStar = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
};

function HomeStarfield() {
  const [stars, setStars] = useState<HomeGlistenStar[]>([]);
  const nextStarIdRef = useRef(0);

  useEffect(() => {
    let spawnTimer: number | null = null;
    const removalTimers = new Set<number>();

    const spawnStar = () => {
      const duration = 4_200 + Math.random() * 2_400;
      const star: HomeGlistenStar = {
        id: nextStarIdRef.current,
        x: 5 + Math.random() * 90,
        y: 6 + Math.random() * 86,
        size: 2 + Math.random() * 5.5,
        duration,
      };
      nextStarIdRef.current += 1;

      setStars((current) => [...current.slice(-9), star]);

      const removalTimer = window.setTimeout(() => {
        setStars((current) => current.filter((item) => item.id !== star.id));
        removalTimers.delete(removalTimer);
      }, duration + 250);
      removalTimers.add(removalTimer);

      spawnTimer = window.setTimeout(spawnStar, 700 + Math.random() * 1_600);
    };

    spawnTimer = window.setTimeout(spawnStar, 180);

    return () => {
      if (spawnTimer !== null) window.clearTimeout(spawnTimer);
      removalTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return (
    <div className="mari-home-starfield" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="mari-home-starfield__star"
          style={
            {
              "--mari-home-star-x": `${star.x}%`,
              "--mari-home-star-y": `${star.y}%`,
              "--mari-home-star-size": `${star.size}px`,
              "--mari-home-star-duration": `${star.duration}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function ChatArea() {
  useRenderTimer("chat-area"); // [#3104 diagnostic]
  const activeChatId = useChatStore((s) => s.activeChatId);
  const streamingChatId = useChatStore((s) => s.streamingChatId);
  const isStreamingGlobal = useChatStore((s) => s.isStreaming);
  const isStreaming = isStreamingGlobal && streamingChatId === activeChatId;
  const isPageActive = usePageActivity();
  const regenerateMessageId = useChatStore((s) => s.regenerateMessageId);
  const chatBackground = useUIStore((s) => s.chatBackground);
  const weatherEffects = useUIStore((s) => s.weatherEffects);
  const messagesPerPage = useUIStore((s) => s.messagesPerPage);
  const centerCompact = useUIStore((s) => s.centerCompact);
  const guideGenerations = useUIStore((s) => s.guideGenerations);
  const intuitiveSwipeNavigation = useUIStore((s) => s.intuitiveSwipeNavigation);
  const intuitiveSwipeRerollLatest = useUIStore((s) => s.intuitiveSwipeRerollLatest);
  const editLastMessageOnArrowUp = useUIStore((s) => s.editLastMessageOnArrowUp);
  const ttsLineVolume = useUIStore((s) => s.ttsLineVolume);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const intuitiveTouchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const swipeActionSeq = useRef(0);
  const pendingSwipeMutationsRef = useRef(new Map<string, Promise<void>>());
  // Tracks whether the initial load stagger animation has played.
  // After the first render with messages, new/re-mounted messages
  // skip the entry animation to avoid a visible flash on refetch.
  const hasAnimatedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<ChatSettingsInitialSection>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<FloatingPanelAnchor>(null);
  const [galleryAnchor, setGalleryAnchor] = useState<FloatingPanelAnchor>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [spriteArrangeMode, setSpriteArrangeMode] = useState(false);
  const [agentInjectionReview, setAgentInjectionReview] = useState<AgentInjectionReviewRequest | null>(null);
  const [agentInjectionDrafts, setAgentInjectionDrafts] = useState<Record<string, string>>({});
  const [illustratorPromptReview, setIllustratorPromptReview] = useState<IllustratorPromptReviewRequest | null>(null);
  const [illustratorPromptReviewSubmitting, setIllustratorPromptReviewSubmitting] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [homeProfessorChatOpen, setHomeProfessorChatOpen] = useState(false);
  const [homeProfessorChatActive, setHomeProfessorChatActive] = useState(false);
  const homeProfessorChatOpenRef = useRef(false);
  const homeViewportRef = useRef<HTMLDivElement>(null);
  const homeContentRef = useRef<HTMLDivElement>(null);
  const [homeFitScale, setHomeFitScale] = useState(1);
  const queryClient = useQueryClient();
  useEffect(() => {
    homeProfessorChatOpenRef.current = homeProfessorChatOpen;
  }, [homeProfessorChatOpen]);
  const handleHomeProfessorChatOpenChange = useCallback((open: boolean) => {
    if (open) setHomeProfessorChatActive(true);
    setHomeProfessorChatOpen(open);
  }, []);
  const handleHomeProfessorChatExitComplete = useCallback(() => {
    if (!homeProfessorChatOpenRef.current) setHomeProfessorChatActive(false);
  }, []);
  useLayoutEffect(() => {
    if (activeChatId || homeProfessorChatActive) {
      setHomeFitScale(1);
      return;
    }

    const viewport = homeViewportRef.current;
    const content = homeContentRef.current;
    if (!viewport || !content) return;

    let frame: number | null = null;
    let disposed = false;
    const updateScale = () => {
      frame = null;
      if (disposed) return;

      const viewportStyle = getComputedStyle(viewport);
      const availableHeight =
        viewport.clientHeight -
        Number.parseFloat(viewportStyle.paddingTop || "0") -
        Number.parseFloat(viewportStyle.paddingBottom || "0");
      const availableWidth =
        viewport.clientWidth -
        Number.parseFloat(viewportStyle.paddingLeft || "0") -
        Number.parseFloat(viewportStyle.paddingRight || "0");
      const naturalHeight = content.scrollHeight;
      const naturalWidth = content.scrollWidth;

      if (availableHeight <= 0 || availableWidth <= 0 || naturalHeight <= 0 || naturalWidth <= 0) return;

      const nextScale = Math.min(1, availableHeight / naturalHeight, availableWidth / naturalWidth);
      const fittedScale = Math.max(0, Math.floor(nextScale * 1000) / 1000);
      setHomeFitScale((current) => (Math.abs(current - fittedScale) < 0.001 ? current : fittedScale));
    };
    const scheduleScaleUpdate = () => {
      if (disposed) return;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScale);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => scheduleScaleUpdate());
    resizeObserver?.observe(viewport);
    resizeObserver?.observe(content);
    window.addEventListener("resize", scheduleScaleUpdate);
    void document.fonts?.ready.then(scheduleScaleUpdate);
    updateScale();

    return () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleScaleUpdate);
    };
  }, [activeChatId, homeProfessorChatActive]);
  const trackHomeFooterAchievement = useCallback(
    (event: AchievementEvent) => {
      void trackAchievementEvent(event, { keepalive: true })
        .catch(() => undefined)
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: achievementKeys.all });
        });
    },
    [queryClient],
  );

  // Delete dialog & multi-select state
  const [deleteDialogMessageId, setDeleteDialogMessageId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState<number | null>(null);

  const { data: chatDetail, error: chatError, isFetched: chatDetailFetched } = useChat(activeChatId);
  const { data: allChats } = useChats();
  const listedActiveChat = useMemo(
    () => (activeChatId ? (allChats?.find((candidate) => candidate.id === activeChatId) ?? null) : null),
    [activeChatId, allChats],
  );
  const readFloatingPanelAnchor = useCallback((event?: ReactMouseEvent<HTMLElement>): FloatingPanelAnchor => {
    return readChatToolbarFloatingPanelAnchor(event?.currentTarget ?? null);
  }, []);
  const handleOpenSettingsPanel = useCallback(
    (event?: ReactMouseEvent<HTMLElement>, options?: OpenSettingsOptions) => {
      void preloadChatSettingsDrawer();
      setGalleryOpen(false);
      setGalleryAnchor(null);
      setSettingsAnchor(readFloatingPanelAnchor(event));
      setSettingsInitialSection(options?.initialSection ?? null);
      setSettingsOpen(true);
    },
    [readFloatingPanelAnchor],
  );
  const handleOpenGalleryPanel = useCallback(
    (event?: ReactMouseEvent<HTMLElement>) => {
      setSettingsOpen(false);
      setSettingsAnchor(null);
      setSettingsInitialSection(null);
      setGalleryAnchor(readFloatingPanelAnchor(event));
      setGalleryOpen(true);
    },
    [readFloatingPanelAnchor],
  );
  const handleCloseSettingsPanel = useCallback(() => {
    setSettingsOpen(false);
    setSettingsAnchor(null);
    setSettingsInitialSection(null);
  }, []);
  const handleCloseGalleryPanel = useCallback(() => {
    setGalleryOpen(false);
    setGalleryAnchor(null);
  }, []);

  useEffect(() => {
    if (!activeChatId) return;
    setHomeProfessorChatOpen(false);
    setHomeProfessorChatActive(false);
  }, [activeChatId]);
  const closeFloatingChatDrawers = useCallback(() => {
    setSettingsOpen(false);
    setSettingsAnchor(null);
    setSettingsInitialSection(null);
    setGalleryOpen(false);
    setGalleryAnchor(null);
    setPeekPromptData(null);
    setDeleteDialogMessageId(null);
  }, []);
  useEffect(() => {
    window.addEventListener(CHAT_TOOLBAR_ACTION_EVENT, closeFloatingChatDrawers);
    window.addEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, closeFloatingChatDrawers);
    return () => {
      window.removeEventListener(CHAT_TOOLBAR_ACTION_EVENT, closeFloatingChatDrawers);
      window.removeEventListener(CHAT_FLOATING_UI_DISMISS_EVENT, closeFloatingChatDrawers);
    };
  }, [closeFloatingChatDrawers]);
  const chat = chatDetail ?? null;
  const rawMode = (chat as unknown as { mode?: string })?.mode;
  // Remember the last known chat mode so that a transient `undefined` from
  // React Query (cache invalidation, Suspense remount, concurrent batching)
  // doesn't reset the layout from roleplay to conversation mid-session.
  const lastModeRef = useRef<string>("conversation");
  if (rawMode) lastModeRef.current = rawMode;
  const chatMode = rawMode ?? lastModeRef.current;
  const isRoleplay = chatMode === "roleplay" || chatMode === "visual_novel";
  const suppressBuiltInProfessorMari = suppressBuiltInProfessorMariForMode(chatMode);
  const isGameChat = chatMode === "game";
  const messagePageSize = messagesPerPage;
  const {
    data: msgData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatMessages(activeChatId, messagePageSize, !!chat);
  const messages = useMemo<MessageWithSwipes[] | undefined>(
    () => flattenLoadedMessagePages(msgData?.pages, messagePageSize),
    [messagePageSize, msgData?.pages],
  );
  const newestMessagePageLength = getNewestLoadedMessagePageLength(msgData?.pages);
  useEffect(() => {
    if (!activeChatId || messagePageSize <= 0 || newestMessagePageLength <= messagePageSize) return;
    queryClient.setQueryData<InfiniteData<MessageWithSwipes[]>>(chatKeys.messages(activeChatId), (old) => {
      return trimNewestLoadedMessagePage(old, messagePageSize);
    });
  }, [activeChatId, messagePageSize, newestMessagePageLength, queryClient]);
  const { data: messageCountData } = useChatMessageCount(activeChatId);
  const totalMessageCount = messageCountData?.count ?? messages?.length ?? 0;
  const loadedMessageCount = messages?.length ?? 0;
  const messageOffset = messages ? totalMessageCount - messages.length : 0;
  const messageIdByOrderIndex = useMemo(() => {
    const map = new Map<number, string>();
    if (!messages) return map;
    messages.forEach((message, index) => {
      map.set(messageOffset + index, message.id);
    });
    return map;
  }, [messageOffset, messages]);
  const { data: gameLibraryCharacters } = useCharacters({
    enabled: !!chat?.id && chat.id === activeChatId && isGameChat,
    includeBuiltIn: true,
  });
  const deleteMessage = useDeleteMessage(activeChatId);
  const deleteMessages = useDeleteMessages(activeChatId);
  const deleteSwipe = useDeleteSwipe(activeChatId);
  const updateMessage = useUpdateMessage(activeChatId);
  const updateMessageExtra = useUpdateMessageExtra(activeChatId);
  const peekPrompt = usePeekPrompt();
  const branchChat = useBranchChat();
  const branchPendingRef = useRef(false);
  const { generate, retryAgents } = useGenerate();
  const generateGallerySelfie = useGenerateGallerySelfie(activeChatId ?? "");
  const setActiveSwipe = useSetActiveSwipe(activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const pendingNewChatMode = useChatStore((s) => s.pendingNewChatMode);
  const failedAgentTypes = useAgentStore((s) =>
    activeChatId && s.failedAgentChatId && s.failedAgentChatId !== activeChatId ? [] : s.failedAgentTypes,
  );
  const agentProcessing = useAgentStore((s) =>
    activeChatId ? s.processingChatIds.includes(activeChatId) : s.isProcessing,
  );

  useEffect(() => {
    if (!activeChatId || !(chatError instanceof ApiError) || chatError.status !== 404) return;
    setActiveChatId(null);
  }, [activeChatId, chatError, setActiveChatId]);

  useEffect(() => {
    if (!activeChatId || !allChats) return;
    if (listedActiveChat) return;
    if (chatDetail || !chatDetailFetched) return;
    if (chatError) return;
    setActiveChatId(null);
  }, [activeChatId, allChats, chatDetail, chatDetailFetched, chatError, listedActiveChat, setActiveChatId]);

  useEffect(() => {
    const handleReviewRequest = (event: Event) => {
      const detail = (event as CustomEvent<AgentInjectionReviewRequest>).detail;
      if (!detail?.chatId || !Array.isArray(detail.injections)) return;
      if (detail.chatId !== useChatStore.getState().activeChatId) return;
      setAgentInjectionReview(detail);
      setAgentInjectionDrafts(
        Object.fromEntries(detail.injections.map((injection) => [injection.agentType, injection.text])),
      );
    };
    window.addEventListener("marinara:agent-injection-review", handleReviewRequest);
    return () => window.removeEventListener("marinara:agent-injection-review", handleReviewRequest);
  }, []);

  useEffect(() => {
    const handleIllustratorPromptReview = (event: Event) => {
      const detail = (event as CustomEvent<IllustratorPromptReviewRequest>).detail;
      if (!detail?.chatId || !detail.item || !detail.resultData) return;
      if (detail.chatId !== useChatStore.getState().activeChatId) return;
      setIllustratorPromptReviewSubmitting(false);
      setIllustratorPromptReview(detail);
    };
    window.addEventListener("marinara:image-prompt-review", handleIllustratorPromptReview);
    return () => window.removeEventListener("marinara:image-prompt-review", handleIllustratorPromptReview);
  }, []);

  const handleContinueAgentInjectionReview = useCallback(() => {
    if (!agentInjectionReview) return;
    const overrides = agentInjectionReview.injections.map((injection) => ({
      agentType: injection.agentType,
      agentName: injection.agentName,
      text: agentInjectionDrafts[injection.agentType] ?? injection.text,
    }));
    const chatId = agentInjectionReview.chatId;
    setAgentInjectionReview(null);
    setAgentInjectionDrafts({});
    void generate({ chatId, connectionId: null, agentInjectionOverrides: overrides });
  }, [agentInjectionDrafts, agentInjectionReview, generate]);

  const handleCloseAgentInjectionReview = useCallback(() => {
    setAgentInjectionReview(null);
    setAgentInjectionDrafts({});
  }, []);

  const handleContinueIllustratorPromptReview = useCallback(
    async (overrides: ImagePromptOverride[]) => {
      if (!illustratorPromptReview || illustratorPromptReviewSubmitting) return;
      const override = overrides.find((entry) => entry.id === illustratorPromptReview.item.id);
      if (!override?.prompt.trim()) return;
      setIllustratorPromptReviewSubmitting(true);
      const success = await retryAgents(illustratorPromptReview.chatId, ["illustrator"], {
        illustratorPromptReviewOverride: {
          resultData: illustratorPromptReview.resultData,
          prompt: override.prompt,
          ...(override.negativePrompt ? { negativePrompt: override.negativePrompt } : {}),
        },
      });
      setIllustratorPromptReviewSubmitting(false);
      if (success) setIllustratorPromptReview(null);
    },
    [illustratorPromptReview, illustratorPromptReviewSubmitting, retryAgents],
  );

  const handleCloseIllustratorPromptReview = useCallback(() => {
    if (illustratorPromptReviewSubmitting) return;
    setIllustratorPromptReview(null);
  }, [illustratorPromptReviewSubmitting]);

  // Character IDs in the active chat. Keyed on the raw characterIds field
  // (all getChatCharacterIds reads) so chat-detail refetches that only bump
  // other fields don't renew the array identity. [#3164]
  const chatCharacterIdsRaw = chat?.characterIds;
  const chatCharIds = useMemo(() => getChatCharacterIds({ characterIds: chatCharacterIdsRaw }), [chatCharacterIdsRaw]);
  const chatPersonaId = useMemo(() => resolveChatPersonaId(chat), [chat]);
  const { data: chatPersona } = usePersona(chatPersonaId);
  const { data: activePersonaFallback } = useActivePersona(!!chat?.id && !chatPersonaId && !isGameChat);

  const activeCharacterQueries = useQueries({
    queries: chatCharIds.map((id) => ({
      queryKey: characterKeys.detail(id),
      queryFn: () => api.get<CharacterRow>(`/characters/${id}`),
      enabled: !!chat?.id,
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });
  // [#3164] useQueries returns a fresh result array every render while the
  // underlying row objects are cache-stable — reuse the previous array when
  // every element is unchanged so the characterMap memo below (and everything
  // downstream of it) keeps its identity across unrelated re-renders.
  const chatCharacterRowsRef = useRef<CharacterRow[]>([]);
  const chatCharacterRows = useMemo(() => {
    const next = activeCharacterQueries.map((query) => query.data).filter(isCharacterRow);
    const previous = chatCharacterRowsRef.current;
    if (previous.length === next.length && next.every((row, index) => row === previous[index])) {
      return previous;
    }
    chatCharacterRowsRef.current = next;
    return next;
  }, [activeCharacterQueries]);

  // A 60s-cadence clock so schedule/override-derived presence refreshes when time
  // alone changes the effective status (mirrors the presence pill's refetch).
  const presenceNow = usePresenceClock();

  // Build character lookup map from the active chat's characters only. Library
  // panels can load the whole catalog; the chat surface should not.
  const characterMapRef = useRef<CharacterMap>(new Map());
  const characterMap: CharacterMap = useMemo(() => {
    const map: CharacterMap = new Map();
    for (const char of chatCharacterRows) {
      map.set(char.id, toCharacterMapValue(char));
    }
    const convoMeta = parseChatMetadata(chat?.metadata);
    const archivedSnapshots = convoMeta.archivedCharacterSnapshots as Record<string, unknown> | undefined;
    if (archivedSnapshots && typeof archivedSnapshots === "object" && !Array.isArray(archivedSnapshots)) {
      for (const [id, value] of Object.entries(archivedSnapshots)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if (map.has(id)) continue;
        const snapshot = value as CharacterMapValue;
        if (typeof snapshot.name !== "string") continue;
        map.set(id, {
          name: snapshot.name,
          convoDisplayName: snapshot.convoDisplayName,
          description: snapshot.description ?? "",
          personality: snapshot.personality ?? "",
          backstory: snapshot.backstory ?? "",
          appearance: snapshot.appearance ?? "",
          scenario: snapshot.scenario ?? "",
          example: snapshot.example ?? "",
          avatarUrl: snapshot.avatarUrl ?? null,
          avatarCrop: snapshot.avatarCrop ?? null,
          nameColor: snapshot.nameColor,
          dialogueColor: snapshot.dialogueColor,
          boxColor: snapshot.boxColor,
        });
      }
    }
    // Overlay per-chat presence status so status dots reflect this chat, not the last chat to
    // generate. Prefer the live override/schedule-derived status (matching the presence pill, via
    // the shared resolver) over the generation-time snapshot, which only refreshes on generation.
    const chatStatuses = convoMeta.conversationCharacterStatuses as
      | Record<string, { status?: string; activity?: string }>
      | undefined;
    const presenceIds = new Set<string>([
      ...Object.keys(chatStatuses ?? {}),
      ...Object.keys((convoMeta.conversationStatusOverrides as Record<string, unknown> | undefined) ?? {}),
      ...Object.keys((convoMeta.characterSchedules as Record<string, unknown> | undefined) ?? {}),
    ]);
    for (const id of presenceIds) {
      const existing = map.get(id);
      if (!existing) continue;
      const live = resolveLiveConversationStatus(convoMeta, id, presenceNow);
      if (live) {
        map.set(id, { ...existing, conversationStatus: live.status, conversationActivity: live.activity });
        continue;
      }
      const info = chatStatuses?.[id];
      if (info?.status) {
        map.set(id, {
          ...existing,
          conversationStatus: info.status as any,
          conversationActivity: info.activity ?? existing.conversationActivity,
        });
      }
    }
    // [#3164] Presence-clock ticks and metadata writes that didn't change any
    // displayed character field must not renew the map identity — a new
    // identity re-runs the regex+macro display pipeline for every mounted
    // message across all three chat surfaces.
    if (areCharacterMapsEqual(characterMapRef.current, map)) return characterMapRef.current;
    characterMapRef.current = map;
    return map;
  }, [chatCharacterRows, chat?.metadata, presenceNow]);

  const characterNames = useMemo(
    () => chatCharIds.map((id) => characterMap.get(id)?.name).filter((n): n is string => !!n),
    [characterMap, chatCharIds],
  );

  // [#3104 diagnostic] Re-render driver probe: names which source input changed
  // on each ChatArea render (and flags IDLE re-renders = a loop). Inert unless
  // localStorage.mariPerfVerbose = "1".
  useWhyRender("chat-area", () => ({
    activeChatId,
    chatMode,
    isStreaming,
    isLoading,
    chatDetail,
    allChats,
    msgPages: msgData?.pages,
    messages,
    messageCountData,
    characterMap,
    presenceNow,
    agentProcessing,
    failedAgentTypes,
    chatBackground,
    weatherEffects,
    messagesPerPage,
    regenerateMessageId,
    streamingChatId,
    isPageActive,
    pendingNewChatMode,
  }));

  const gameCharacters = useMemo(() => {
    if (!isGameChat || !gameLibraryCharacters) return [];
    return (
      gameLibraryCharacters as Array<{ id: string; data: string; comment?: string | null; avatarPath: string | null }>
    ).flatMap((c) => {
      if (c.id === PROFESSOR_MARI_ID) return [];
      try {
        const parsed = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
        const display = parseCharacterDisplayData(c);
        return [
          {
            id: c.id,
            name: display.name,
            comment: display.comment,
            avatarUrl: c.avatarPath ?? undefined,
            avatarCrop: parsed.extensions?.avatarCrop || null,
            nameColor: parsed.extensions?.nameColor || undefined,
            dialogueColor: parsed.extensions?.dialogueColor || undefined,
            description: parsed.description ?? "",
            personality: parsed.personality ?? "",
            backstory: parsed.extensions?.backstory ?? "",
            appearance: parsed.extensions?.appearance ?? "",
            tags: parsed.tags ?? [],
          },
        ];
      } catch {
        return [{ id: c.id, name: "Unknown" }];
      }
    });
  }, [gameLibraryCharacters, isGameChat]);

  // Active persona info (for user message styling: name, avatar, colors)
  const personaInfo = useMemo(() => {
    // Prefer per-chat personaId, fall back to the globally active persona outside Game mode.
    const persona = chatPersona ?? (!isGameChat ? activePersonaFallback : null);
    if (!persona) return undefined;
    const avatarCrop =
      typeof persona.avatarCrop === "string" ? parseAvatarCropJson(persona.avatarCrop) : (persona.avatarCrop ?? null);
    return {
      id: persona.id,
      name: persona.name,
      convoDisplayName: persona.convoDisplayName || undefined,
      phoneticName: persona.phoneticName || undefined,
      description: persona.description ?? "",
      personality: persona.personality || undefined,
      scenario: persona.scenario || undefined,
      backstory: persona.backstory || undefined,
      appearance: persona.appearance || undefined,
      avatarUrl: persona.avatarPath || undefined,
      avatarCrop,
      nameColor: persona.nameColor || undefined,
      dialogueColor: persona.dialogueColor || undefined,
      boxColor: persona.boxColor || undefined,
    };
  }, [activePersonaFallback, chatPersona, isGameChat]);

  const { startEncounter } = useEncounter();
  const { concludeScene, abandonScene, forkScene, isForking } = useScene();
  const encounterActive = useEncounterStore((s) => s.active || s.showConfigModal);
  const roleplaySpriteScale = useUIStore((s) => s.roleplaySpriteScale);
  const [localSpriteVisualSettings, setLocalSpriteVisualSettings] = useState<LocalSpriteVisualSettings>(() =>
    loadLocalSpriteVisualSettings(chat?.id),
  );

  // Sprite sidebar settings from chat metadata
  const chatMeta = useMemo(() => {
    if (!chat) return {};
    const raw = (chat as unknown as { metadata?: string | Record<string, unknown> }).metadata;
    return parseChatMetadata(raw);
  }, [chat]);

  useEffect(() => {
    setLocalSpriteVisualSettings(loadLocalSpriteVisualSettings(chat?.id));
  }, [chat?.id]);

  const patchLocalSpriteVisualSettings = useCallback(
    (patch: Partial<LocalSpriteVisualSettings>) => {
      if (!chat?.id) return;
      setLocalSpriteVisualSettings((previous) => saveLocalSpriteVisualSettings(chat.id, patch, previous));
    },
    [chat?.id],
  );
  const spriteCharacterIds = useMemo<string[]>(
    () =>
      Array.isArray(chatMeta.spriteCharacterIds)
        ? chatMeta.spriteCharacterIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        : [],
    [chatMeta.spriteCharacterIds],
  );
  const spriteDisplayModes = useMemo(
    () => normalizeSpriteDisplayModes(chatMeta.spriteDisplayModes),
    [chatMeta.spriteDisplayModes],
  );
  const metadataSpritePosition: SpriteSide = chatMeta.spritePosition === "right" ? "right" : "left";
  const spritePosition: SpriteSide = localSpriteVisualSettings.spritePosition ?? metadataSpritePosition;
  const spriteScale = normalizeSpriteDisplayValue(
    chatMeta.spriteScale,
    roleplaySpriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const expressionSpriteScale = normalizeSpriteDisplayValue(
    localSpriteVisualSettings.expressionSpriteScale ?? chatMeta.expressionSpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const fullBodySpriteScale = normalizeSpriteDisplayValue(
    localSpriteVisualSettings.fullBodySpriteScale ?? chatMeta.fullBodySpriteScale,
    spriteScale,
    SPRITE_DISPLAY_SCALE_MIN,
    SPRITE_DISPLAY_SCALE_MAX,
  );
  const spriteOpacity = normalizeSpriteDisplayValue(
    chatMeta.spriteOpacity,
    1,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const expressionSpriteOpacity = normalizeSpriteDisplayValue(
    localSpriteVisualSettings.expressionSpriteOpacity ?? chatMeta.expressionSpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const fullBodySpriteOpacity = normalizeSpriteDisplayValue(
    localSpriteVisualSettings.fullBodySpriteOpacity ?? chatMeta.fullBodySpriteOpacity,
    spriteOpacity,
    SPRITE_DISPLAY_OPACITY_MIN,
    SPRITE_DISPLAY_OPACITY_MAX,
  );
  const hasLocalSpritePlacements = Object.prototype.hasOwnProperty.call(localSpriteVisualSettings, "spritePlacements");
  const spritePlacementsSource = hasLocalSpritePlacements
    ? localSpriteVisualSettings.spritePlacements
    : chatMeta.spritePlacements;
  const spritePlacements = useMemo(() => normalizeSpritePlacements(spritePlacementsSource), [spritePlacementsSource]);
  const hasCustomSpritePlacements = Object.keys(spritePlacements).length > 0;
  // Prefer per-swipe expressions from the last assistant message's extra (survives swipe switching),
  // falling back to chat-level metadata for backward compatibility.
  const spriteExpressions: Record<string, string> = useMemo(() => {
    if (messages?.length) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (m.role === "assistant") {
          const extra = typeof m.extra === "string" ? JSON.parse(m.extra) : (m.extra ?? {});
          if (extra.spriteExpressions && Object.keys(extra.spriteExpressions).length > 0) {
            return extra.spriteExpressions as Record<string, string>;
          }
          break; // only check the last assistant message
        }
      }
    }
    return chatMeta.spriteExpressions ?? {};
  }, [messages, chatMeta.spriteExpressions]);
  const groupChatMode: string | undefined = chatCharIds.length > 1 ? (chatMeta.groupChatMode ?? "merged") : undefined;

  const updateMeta = useUpdateChatMetadata();
  const [scheduleModalCharacterId, setScheduleModalCharacterId] = useState<string | null>(null);
  const [scheduleModalInitialDay, setScheduleModalInitialDay] = useState<string | null>(null);
  const handleOpenScheduleEditor = useCallback((characterId: string, options?: { initialDay?: string | null }) => {
    void preloadCharacterScheduleEditorModal();
    setScheduleModalInitialDay(options?.initialDay ?? null);
    setScheduleModalCharacterId(characterId);
  }, []);
  const handleCloseScheduleEditor = useCallback(() => {
    setScheduleModalCharacterId(null);
    setScheduleModalInitialDay(null);
  }, []);
  const handleSaveCharacterSchedule = useCallback(
    (savedCharacterId: string, updated: WeekSchedule) => {
      if (!chat?.id) return;
      updateMeta.mutate({
        id: chat.id,
        characterSchedules: {
          ...((chatMeta.characterSchedules as Record<string, WeekSchedule> | undefined) ?? {}),
          [savedCharacterId]: updated,
        },
      });
    },
    [chat?.id, chatMeta.characterSchedules, updateMeta],
  );
  const summaryContextSize: number = (chatMeta.summaryContextSize as number) ?? 50;
  const [roleplayBackgroundReviewItems, setRoleplayBackgroundReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [roleplayBackgroundReviewSubmitting, setRoleplayBackgroundReviewSubmitting] = useState(false);
  const [roleplayVideoReviewItems, setRoleplayVideoReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [roleplayVideoReviewSubmitting, setRoleplayVideoReviewSubmitting] = useState(false);
  const [conversationSelfieReviewItems, setConversationSelfieReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [conversationSelfieReviewSubmitting, setConversationSelfieReviewSubmitting] = useState(false);
  const roleplaySceneVideoGeneratingRef = useRef(false);
  const roleplayBackgroundReviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);
  const roleplayVideoReviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);
  const conversationSelfieReviewResolveRef = useRef<((overrides: ImagePromptOverride[] | null) => void) | null>(null);

  const openRoleplayBackgroundPromptReview = useCallback((items: ImagePromptReviewItem[]) => {
    if (roleplayBackgroundReviewResolveRef.current) {
      toast.error("Finish or cancel the current background prompt review first.");
      return Promise.resolve(null);
    }
    return new Promise<ImagePromptOverride[] | null>((resolve) => {
      roleplayBackgroundReviewResolveRef.current = resolve;
      setRoleplayBackgroundReviewSubmitting(false);
      setRoleplayBackgroundReviewItems(items);
    });
  }, []);

  const closeRoleplayBackgroundPromptReview = useCallback((overrides: ImagePromptOverride[] | null) => {
    const resolve = roleplayBackgroundReviewResolveRef.current;
    roleplayBackgroundReviewResolveRef.current = null;
    setRoleplayBackgroundReviewSubmitting(false);
    setRoleplayBackgroundReviewItems([]);
    resolve?.(overrides);
  }, []);

  const confirmRoleplayBackgroundPromptReview = useCallback((overrides: ImagePromptOverride[]) => {
    const resolve = roleplayBackgroundReviewResolveRef.current;
    if (!resolve) return;
    roleplayBackgroundReviewResolveRef.current = null;
    setRoleplayBackgroundReviewSubmitting(true);
    resolve(overrides);
  }, []);

  const openRoleplayVideoPromptReview = useCallback((items: ImagePromptReviewItem[]) => {
    if (roleplayVideoReviewResolveRef.current) {
      toast.error("Finish or cancel the current video prompt review first.");
      return Promise.resolve(null);
    }
    return new Promise<ImagePromptOverride[] | null>((resolve) => {
      roleplayVideoReviewResolveRef.current = resolve;
      setRoleplayVideoReviewSubmitting(false);
      setRoleplayVideoReviewItems(items);
    });
  }, []);

  const closeRoleplayVideoPromptReview = useCallback((overrides: ImagePromptOverride[] | null) => {
    const resolve = roleplayVideoReviewResolveRef.current;
    roleplayVideoReviewResolveRef.current = null;
    setRoleplayVideoReviewSubmitting(false);
    setRoleplayVideoReviewItems([]);
    resolve?.(overrides);
  }, []);

  const confirmRoleplayVideoPromptReview = useCallback((overrides: ImagePromptOverride[]) => {
    const resolve = roleplayVideoReviewResolveRef.current;
    if (!resolve) return;
    roleplayVideoReviewResolveRef.current = null;
    setRoleplayVideoReviewSubmitting(true);
    resolve(overrides);
  }, []);

  const openConversationSelfiePromptReview = useCallback((items: ImagePromptReviewItem[]) => {
    if (conversationSelfieReviewResolveRef.current) {
      toast.error("Finish or cancel the current selfie prompt review first.");
      return Promise.resolve(null);
    }
    return new Promise<ImagePromptOverride[] | null>((resolve) => {
      conversationSelfieReviewResolveRef.current = resolve;
      setConversationSelfieReviewSubmitting(false);
      setConversationSelfieReviewItems(items);
    });
  }, []);

  const closeConversationSelfiePromptReview = useCallback((overrides: ImagePromptOverride[] | null) => {
    const resolve = conversationSelfieReviewResolveRef.current;
    conversationSelfieReviewResolveRef.current = null;
    setConversationSelfieReviewSubmitting(false);
    setConversationSelfieReviewItems([]);
    resolve?.(overrides);
  }, []);

  const confirmConversationSelfiePromptReview = useCallback((overrides: ImagePromptOverride[]) => {
    const resolve = conversationSelfieReviewResolveRef.current;
    if (!resolve) return;
    conversationSelfieReviewResolveRef.current = null;
    setConversationSelfieReviewSubmitting(true);
    resolve(overrides);
  }, []);

  useEffect(() => {
    return () => {
      const resolve = roleplayBackgroundReviewResolveRef.current;
      roleplayBackgroundReviewResolveRef.current = null;
      resolve?.(null);
      const resolveVideo = roleplayVideoReviewResolveRef.current;
      roleplayVideoReviewResolveRef.current = null;
      resolveVideo?.(null);
      const resolveSelfie = conversationSelfieReviewResolveRef.current;
      conversationSelfieReviewResolveRef.current = null;
      resolveSelfie?.(null);
    };
  }, []);

  const handleGenerateRoleplayBackground = useCallback(async () => {
    if (!activeChatId || !chat || (chatMode !== "roleplay" && chatMode !== "visual_novel")) return;
    const sceneDescription = buildRoleplayBackgroundSceneDescription({
      chatName: chat.name,
      characterNames,
      messages,
    }).trim();
    if (!sceneDescription) {
      toast.error("Send a scene message before generating a background.");
      return;
    }

    const locationSlug = [chat.name, messages?.[messages.length - 1]?.id, Date.now().toString(36)]
      .filter(Boolean)
      .join("-");
    const payload: GenerateSceneBackgroundPayload = {
      chatId: activeChatId,
      sceneDescription,
      locationSlug,
      reason: "Manual Gallery background request",
      force: true,
      debugMode: useUIStore.getState().debugMode,
    };

    try {
      if (useUIStore.getState().reviewImagePromptsBeforeSend) {
        let preview: { items: ImagePromptReviewItem[] } | undefined;
        try {
          preview = await api.post<{ items: ImagePromptReviewItem[] }>(
            "/backgrounds/generate-scene/preview",
            payload,
            { signal: AbortSignal.timeout(MEDIA_PROMPT_PREVIEW_TIMEOUT_MS) },
          );
        } catch (error) {
          if (!isMediaPromptPreviewTimeout(error)) throw error;
          toast.error("Background prompt preview timed out. Continuing with the default prompt.");
        }
        if (preview?.items.length) {
          const overrides = await openRoleplayBackgroundPromptReview(preview.items);
          if (!overrides) return;
          payload.promptOverrides = overrides;
        }
      }

      const result = await api.post<GeneratedSceneBackgroundResponse>("/backgrounds/generate-scene", payload);
      useUIStore.getState().setChatBackground(result.url);
      updateMeta.mutate({ id: activeChatId, background: result.filename });
      queryClient.invalidateQueries({ queryKey: ["backgrounds"] });
      toast.success("Background generated.", { duration: 1800 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Background generation failed.");
    } finally {
      closeRoleplayBackgroundPromptReview(null);
    }
  }, [
    activeChatId,
    characterNames,
    chat,
    chatMode,
    closeRoleplayBackgroundPromptReview,
    messages,
    openRoleplayBackgroundPromptReview,
    queryClient,
    updateMeta,
  ]);

  const handleGenerateRoleplaySceneVideo = useCallback(
    async (source?: { galleryImageId?: string }) => {
      if (!activeChatId || !chat || (chatMode !== "roleplay" && chatMode !== "visual_novel")) return;
      if (roleplaySceneVideoGeneratingRef.current) return;
      const sceneVideoConnectionId =
        typeof chatMeta.sceneVideoConnectionId === "string" ? chatMeta.sceneVideoConnectionId.trim() : "";
      if (!sceneVideoConnectionId) {
        toast.error("Choose a Scene Video connection in Chat Settings first.");
        return;
      }

      const galleryImageId = source?.galleryImageId?.trim();
      const payload: GenerateRoleplaySceneVideoPayload = {
        chatId: activeChatId,
        ...(galleryImageId ? { galleryImageId } : {}),
        queueMediaGenerationRequests: useUIStore.getState().queueImageGenerationRequests,
        debugMode: useUIStore.getState().debugMode,
      };
      roleplaySceneVideoGeneratingRef.current = true;
      try {
        if (useUIStore.getState().reviewImagePromptsBeforeSend) {
          let preview: RoleplaySceneVideoPromptPreview | undefined;
          try {
            preview = await api.post<RoleplaySceneVideoPromptPreview>(
              "/gallery/generate-scene-video/preview",
              payload,
              { signal: AbortSignal.timeout(MEDIA_PROMPT_PREVIEW_TIMEOUT_MS) },
            );
          } catch (error) {
            if (!isMediaPromptPreviewTimeout(error)) throw error;
            toast.error("Video prompt preview timed out. Continuing with the default prompt.");
          }
          if (preview) {
            const details = [`${preview.durationSeconds}s`, preview.aspectRatio, preview.resolution].filter(
              (value): value is string => Boolean(value),
            );
            const overrides = await openRoleplayVideoPromptReview([
              {
                id: "gallery-scene-video",
                kind: "video",
                title: galleryImageId ? "Animate selected illustration" : "Animate latest illustration",
                prompt: preview.prompt,
                details: details.join(" | "),
                maxLength: preview.maxPromptLength ?? undefined,
              },
            ]);
            if (!overrides) return;
            const reviewedPrompt = overrides[0]?.prompt.trim();
            if (!reviewedPrompt) return;
            payload.promptOverride = reviewedPrompt;
          }
        }

        const result = await api.post<{ video: GeneratedSceneVideo }>("/gallery/generate-scene-video", payload, {
          signal: AbortSignal.timeout(SCENE_VIDEO_GENERATION_TIMEOUT_MS),
        });
        const galleryStore = useGalleryStore.getState();
        galleryStore.pinVideo(result.video);
        galleryStore.syncLatestViewer({ ...result.video, kind: "video" as const });
        void queryClient.invalidateQueries({ queryKey: ["gallery", "scene-videos", activeChatId] });
        toast.success("Scene video generated.", { duration: 1800 });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Scene video generation failed.");
      } finally {
        closeRoleplayVideoPromptReview(null);
        roleplaySceneVideoGeneratingRef.current = false;
      }
    },
    [
      activeChatId,
      chat,
      chatMeta.sceneVideoConnectionId,
      chatMode,
      closeRoleplayVideoPromptReview,
      openRoleplayVideoPromptReview,
      queryClient,
    ],
  );

  const handleGenerateConversationSelfie = useCallback(
    async (characterId?: string) => {
      if (!activeChatId || chatMode !== "conversation") return;
      const targetCharacterId =
        characterId && chatCharIds.includes(characterId)
          ? characterId
          : (chatCharIds.find((id) => characterMap.has(id)) ?? chatCharIds[0]);
      if (!targetCharacterId) {
        throw new Error("Add a character to this conversation before generating a selfie.");
      }
      const payload: GenerateConversationSelfiePayload = {
        characterId: targetCharacterId,
        queueImageGenerationRequests: useUIStore.getState().queueImageGenerationRequests,
        debugMode: useUIStore.getState().debugMode,
      };
      try {
        if (useUIStore.getState().reviewImagePromptsBeforeSend) {
          let preview: { items: ImagePromptReviewItem[] } | undefined;
          try {
            preview = await api.post<{ items: ImagePromptReviewItem[] }>(
              `/gallery/${activeChatId}/selfie`,
              {
                ...payload,
                previewOnly: true,
              },
              { signal: AbortSignal.timeout(MEDIA_PROMPT_PREVIEW_TIMEOUT_MS) },
            );
          } catch (error) {
            if (!isMediaPromptPreviewTimeout(error)) throw error;
            toast.error("Selfie prompt preview timed out. Continuing with the default prompt.");
          }
          if (preview?.items.length) {
            const overrides = await openConversationSelfiePromptReview(preview.items);
            if (!overrides) return;
            const override = overrides[0];
            if (!override?.prompt.trim()) return;
            payload.promptOverride = override.prompt;
            if (override.negativePrompt !== undefined) payload.negativePromptOverride = override.negativePrompt;
          }
        }
        await generateGallerySelfie.mutateAsync(payload);
      } finally {
        closeConversationSelfiePromptReview(null);
      }
    },
    [
      activeChatId,
      characterMap,
      chatCharIds,
      chatMode,
      closeConversationSelfiePromptReview,
      generateGallerySelfie,
      openConversationSelfiePromptReview,
    ],
  );

  // Creator-notes card CSS: resolve the per-chat mode (default "chat") and map
  // the chat mode onto the @chat-mode filter surface (visual novel shares the
  // roleplay surface). One injector element, reused across every render path.
  const cardCssMode: CardCssMode =
    chatMeta.cardCssMode === "exclusive" || chatMeta.cardCssMode === "chat" ? chatMeta.cardCssMode : "disabled";
  const cardCssChatMode: ChatModeFilter =
    chatMode === "conversation" ? "conversation" : chatMode === "game" ? "game" : "roleplay";
  // Persona creator-notes CSS only reaches the Conversation about-me popout
  // (personas have no other data-card-css hook), so only feed it in Convo mode.
  const cardCssPersonas = useMemo<PersonaCssRow[] | undefined>(() => {
    if (chatMode !== "conversation") return undefined;
    const persona = (chatPersona ?? (!isGameChat ? activePersonaFallback : null)) as
      | { id?: string; creatorNotes?: string | null }
      | null
      | undefined;
    return persona?.id
      ? [{ id: persona.id, creatorNotes: typeof persona.creatorNotes === "string" ? persona.creatorNotes : null }]
      : undefined;
  }, [chatMode, chatPersona, activePersonaFallback, isGameChat]);
  const cardCssInjector = (
    <CreatorNotesCssInjector
      characterIds={chatCharIds}
      allCharacters={chatCharacterRows}
      personas={cardCssPersonas}
      mode={cardCssMode}
      chatMode={cardCssChatMode}
    />
  );

  // Sync translation config from chat metadata to the translation store
  useEffect(() => {
    if (!chat?.id) return;
    useTranslationStore.getState().setConfig({
      provider: chatMeta.translationProvider ?? "google",
      targetLanguage: chatMeta.translationTargetLang ?? "en",
      connectionId: chatMeta.translationConnectionId,
      systemPrompt: typeof chatMeta.translationPrompt === "string" ? chatMeta.translationPrompt : undefined,
      deeplApiKey: chatMeta.translationDeeplApiKey,
      deeplxUrl: chatMeta.translationDeeplxUrl,
    });
  }, [
    chat?.id,
    chatMeta.translationProvider,
    chatMeta.translationTargetLang,
    chatMeta.translationConnectionId,
    chatMeta.translationPrompt,
    chatMeta.translationDeeplApiKey,
    chatMeta.translationDeeplxUrl,
  ]);

  // On chat switch, clear in-memory translations and seed from persisted extras.
  // Also re-seed when new pages are fetched (pagination) so older persisted
  // translations become visible.
  const msgPageCount = msgData?.pages.length ?? 0;
  const prevChatIdRef = useRef(chat?.id);
  useEffect(() => {
    if (!messages) return;
    // Clear on actual chat switch
    if (prevChatIdRef.current !== chat?.id) {
      useTranslationStore.getState().clearAll();
      prevChatIdRef.current = chat?.id;
    }
    useTranslationStore
      .getState()
      .seedFromMessages(messages as unknown as Array<{ id: string; extra?: string | Record<string, unknown> | null }>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, msgPageCount]);

  // Sync chat background from metadata when switching chats. Set the UI store
  // to whatever the chat's metadata says — including null. The previous version
  // only set on truthy values, leaving the global chatBackground stale when
  // switching to a chat whose metadata has been cleared, which made a removed
  // background re-appear after a chat switch round-trip.
  const restoredChatBackgroundRef = useRef<{ chatId: string | null; url: string | null; isSyncing: boolean }>({
    chatId: null,
    url: null,
    isSyncing: false,
  });
  useEffect(() => {
    if (!chat?.id) return;
    const savedUrl = chatBackgroundMetadataToUrl(chatMeta.background);
    const restoredUrl =
      savedUrl ??
      (chat.mode === "roleplay" || chat.mode === "visual_novel"
        ? useUIStore.getState().defaultRoleplayBackground
        : null);
    restoredChatBackgroundRef.current = { chatId: chat.id, url: restoredUrl, isSyncing: true };
    useUIStore.getState().setChatBackground(restoredUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // Persist background choice to chat metadata so it survives page refresh.
  // Catches all sources: manual picker, background agent, scene commands, slash commands.
  // When the user clears the background, we must persist null so the removal
  // sticks across chat switches; otherwise the restore effect re-applies the
  // stale saved background. We only write null when metadata already had a
  // background — that way a global UI background carried over from a previous
  // chat doesn't pollute a fresh chat's metadata on switch.
  const bgPersistTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    if (!chat?.id) return;
    const savedBackground = chatBackgroundUrlToMetadata(chatBackgroundMetadataToUrl(chatMeta.background));
    const restoredBackground = restoredChatBackgroundRef.current;

    if (
      restoredBackground.isSyncing &&
      (restoredBackground.chatId !== chat.id || chatBackground !== restoredBackground.url)
    ) {
      return;
    }
    if (restoredBackground.isSyncing) {
      restoredBackground.isSyncing = false;
    }

    if (!chatBackground) {
      if (savedBackground === null) return;
      if (bgPersistTimer.current) clearTimeout(bgPersistTimer.current);
      bgPersistTimer.current = setTimeout(() => {
        updateMeta.mutate({ id: chat!.id, background: null });
      }, 500);
      return;
    }

    const nextBackground = chatBackgroundUrlToMetadata(chatBackground);
    if (nextBackground === savedBackground) return;
    if (bgPersistTimer.current) clearTimeout(bgPersistTimer.current);
    bgPersistTimer.current = setTimeout(() => {
      updateMeta.mutate({ id: chat!.id, background: nextBackground });
    }, 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatBackground, chat?.id]);
  useEffect(() => {
    return () => {
      if (bgPersistTimer.current) clearTimeout(bgPersistTimer.current);
    };
  }, []);

  const expressionSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const spritePlacementSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingExpressions = useRef<Record<string, string>>(spriteExpressions);
  const pendingSpritePlacements = useRef<Record<string, SpritePlacement>>(spritePlacements);

  useEffect(() => {
    pendingExpressions.current = spriteExpressions;
  }, [spriteExpressions]);

  useEffect(() => {
    pendingSpritePlacements.current = spritePlacements;
  }, [spritePlacements]);

  useEffect(() => {
    setSpriteArrangeMode(false);
  }, [chat?.id]);

  // Clean up expression save timer on unmount
  useEffect(() => {
    return () => {
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
    };
  }, []);

  const persistSpriteExpressions = useCallback(
    (expressions: Record<string, string>) => {
      if (!chat?.id) return;
      updateMeta.mutate({ id: chat.id, spriteExpressions: expressions });
      // Also persist to the last assistant message's extra so it's per-swipe
      if (messages?.length) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i]!;
          if (m.role === "assistant") {
            updateMessageExtra.mutate({
              messageId: m.id,
              extra: { spriteExpressions: expressions },
            });
            break;
          }
        }
      }
    },
    [chat?.id, updateMeta, messages, updateMessageExtra],
  );

  const handleExpressionChange = useCallback(
    (characterId: string, expression: string, options?: { immediate?: boolean }) => {
      if (!chat?.id) return;
      pendingExpressions.current = { ...pendingExpressions.current, [characterId]: expression };
      if (expressionSaveTimer.current) clearTimeout(expressionSaveTimer.current);
      if (options?.immediate) {
        persistSpriteExpressions(pendingExpressions.current);
        return;
      }
      expressionSaveTimer.current = setTimeout(() => {
        persistSpriteExpressions(pendingExpressions.current);
      }, 1000);
    },
    [chat?.id, persistSpriteExpressions],
  );

  const handleSpritePlacementChange = useCallback(
    (placementKey: string, placement: SpritePlacement) => {
      if (!chat?.id) return;
      pendingSpritePlacements.current = { ...pendingSpritePlacements.current, [placementKey]: placement };
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
      spritePlacementSaveTimer.current = setTimeout(() => {
        patchLocalSpriteVisualSettings({ spritePlacements: pendingSpritePlacements.current });
      }, 250);
    },
    [chat?.id, patchLocalSpriteVisualSettings],
  );

  const handleResetSpritePlacements = useCallback(() => {
    if (!chat?.id) return;
    pendingSpritePlacements.current = {};
    if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
    patchLocalSpriteVisualSettings({ spritePlacements: {} });
  }, [chat?.id, patchLocalSpriteVisualSettings]);

  const handleSetSpritePosition = useCallback(
    (nextSide: SpriteSide) => {
      if (!chat?.id || nextSide === spritePosition) return;
      const nextPlacements = hasCustomSpritePlacements ? mirrorSpritePlacements(spritePlacements) : spritePlacements;
      pendingSpritePlacements.current = nextPlacements;
      if (spritePlacementSaveTimer.current) clearTimeout(spritePlacementSaveTimer.current);
      patchLocalSpriteVisualSettings({
        spritePosition: nextSide,
        spritePlacements: nextPlacements,
      });
    },
    [chat?.id, hasCustomSpritePlacements, patchLocalSpriteVisualSettings, spritePlacements, spritePosition],
  );

  // Set of active agent type IDs for this chat.
  const enabledAgentTypes = useMemo(() => {
    const set = new Set<string>();
    if (!chatMeta.enableAgents) return set;
    const activeAgentIds: string[] = Array.isArray(chatMeta.activeAgentIds) ? chatMeta.activeAgentIds : [];
    // Only show widgets for agents explicitly added to this chat
    for (const id of activeAgentIds) set.add(id);
    return set;
  }, [chatMeta.enableAgents, chatMeta.activeAgentIds]);
  const manualTrackerAgentTypes = useMemo(
    () => normalizeManualTrackerAgentTypes(chatMeta.manualTrackerAgentTypes),
    [chatMeta.manualTrackerAgentTypes],
  );
  const manualTrackerTypes = useMemo(() => {
    const set = new Set<string>();
    for (const type of enabledAgentTypes) {
      if (!isBuiltInTrackerAgentType(type)) continue;
      if (chatMeta.manualTrackers === true || manualTrackerAgentTypes[type] === true) set.add(type);
    }
    return set;
  }, [chatMeta.manualTrackers, enabledAgentTypes, manualTrackerAgentTypes]);
  const hasManualTrackerAgents = manualTrackerTypes.size > 0;

  const combatAgentEnabled = enabledAgentTypes.has("combat");
  const expressionAgentEnabled = enabledAgentTypes.has("expression");
  const expressionAvatarsPreferenceEnabled =
    (localSpriteVisualSettings.expressionAvatarsEnabled ?? chatMeta.expressionAvatarsEnabled) === true;
  const expressionAvatarsEnabled =
    isRoleplay &&
    expressionAvatarsPreferenceEnabled &&
    expressionAgentEnabled &&
    (chatCharIds.length > 0 || !!personaInfo?.id);
  const effectiveSpriteVisualSettings = useMemo<LocalSpriteVisualSettings>(
    () => ({
      spritePosition,
      spritePlacements,
      expressionSpriteScale,
      fullBodySpriteScale,
      expressionSpriteOpacity,
      fullBodySpriteOpacity,
      expressionAvatarsEnabled: expressionAvatarsPreferenceEnabled,
    }),
    [
      expressionAvatarsPreferenceEnabled,
      expressionSpriteOpacity,
      expressionSpriteScale,
      fullBodySpriteOpacity,
      fullBodySpriteScale,
      spritePlacements,
      spritePosition,
    ],
  );
  // Expression Avatars reuse expression sprites as message portraits, so suppress the duplicate overlay layer.
  const visibleSpriteDisplayModes = useMemo(
    () => (expressionAvatarsEnabled ? spriteDisplayModes.filter((mode) => mode !== "expressions") : spriteDisplayModes),
    [expressionAvatarsEnabled, spriteDisplayModes],
  );
  const expressionAvatarCharacterIds = useMemo(() => {
    const allowedIds = new Set(chatCharIds.filter((id) => !(suppressBuiltInProfessorMari && id === PROFESSOR_MARI_ID)));
    if (personaInfo?.id) allowedIds.add(personaInfo.id);
    const configuredIds =
      spriteCharacterIds.length > 0 ? spriteCharacterIds.filter((id) => allowedIds.has(id)) : Array.from(allowedIds);
    if (personaInfo?.id) configuredIds.push(personaInfo.id);
    return Array.from(new Set(configuredIds.filter((id) => typeof id === "string" && id.trim())));
  }, [chatCharIds, personaInfo?.id, spriteCharacterIds, suppressBuiltInProfessorMari]);
  const expressionAvatarSpriteQueries = useQueries({
    queries: expressionAvatarCharacterIds.map((characterId) => ({
      queryKey: spriteKeys.list(characterId),
      queryFn: () => api.get<SpriteInfo[]>(`/sprites/${characterId}`),
      enabled: expressionAvatarsEnabled,
      staleTime: 5 * 60_000,
    })),
  });
  const expressionAvatarSpriteMap = useMemo(() => {
    const map = new Map<string, SpriteInfo[]>();
    expressionAvatarCharacterIds.forEach((characterId, index) => {
      const sprites = expressionAvatarSpriteQueries[index]?.data;
      if (Array.isArray(sprites) && sprites.length > 0) map.set(characterId, sprites);
    });
    return map;
  }, [expressionAvatarCharacterIds, expressionAvatarSpriteQueries]);
  const expressionAvatarResolver = useMemo<ExpressionAvatarResolver | undefined>(() => {
    if (!expressionAvatarsEnabled) return undefined;
    return (message, characterId) => {
      const extra = parseMessageExtraRecord(message.extra);
      const expressions = normalizeMessageSpriteExpressions(extra.spriteExpressions);
      const characterName = characterMap.get(characterId)?.name;
      const personaName =
        characterId === personaInfo?.id ? (getPersonaSnapshotName(extra) ?? personaInfo.name) : undefined;
      const expression =
        expressions[characterId] ??
        (characterName ? expressions[characterName] : undefined) ??
        (personaName ? expressions[personaName] : undefined);
      if (!expression) return null;
      return resolveExpressionAvatarSpriteUrl(expressionAvatarSpriteMap.get(characterId), expression);
    };
  }, [characterMap, expressionAvatarSpriteMap, expressionAvatarsEnabled, personaInfo?.id, personaInfo?.name]);
  const shouldRefreshGameStateOnSwipe = isGameChat || Boolean(chatMeta.enableAgents);

  const refreshVisibleGameState = useCallback(async () => {
    if (!shouldRefreshGameStateOnSwipe || !activeChatId) return;
    try {
      const gs = await api.get<import("@marinara-engine/shared").GameState | null>(`/chats/${activeChatId}/game-state`);
      if (useChatStore.getState().activeChatId !== activeChatId) return;
      useGameStateStore.getState().setGameState(gs ?? null);
    } catch {
      // Non-critical refresh failure; the next tracker load will fetch again.
    }
  }, [activeChatId, shouldRefreshGameStateOnSwipe]);

  const handleDelete = useCallback((messageId: string) => {
    setDeleteDialogMessageId(messageId);
  }, []);

  const deleteDialogMessage = useMemo(
    () => messages?.find((message) => message.id === deleteDialogMessageId) ?? null,
    [deleteDialogMessageId, messages],
  );
  const deleteDialogCanDeleteSwipe = (deleteDialogMessage?.swipeCount ?? 0) > 1;
  const deleteDialogActiveSwipeIndex = deleteDialogMessage?.activeSwipeIndex ?? 0;
  const deleteDialogSwipeCount = deleteDialogMessage?.swipeCount ?? 0;

  const handleDeleteConfirm = useCallback(() => {
    if (deleteDialogMessageId) {
      deleteMessage.mutate(deleteDialogMessageId);
    }
    setDeleteDialogMessageId(null);
  }, [deleteDialogMessageId, deleteMessage]);

  const handleDeleteSwipe = useCallback(() => {
    const messageId = deleteDialogMessageId;
    const index = deleteDialogActiveSwipeIndex;
    setDeleteDialogMessageId(null);
    if (!messageId || !deleteDialogCanDeleteSwipe) return;
    const actionId = ++swipeActionSeq.current;
    const refreshChatId = activeChatId;
    void (async () => {
      const gameStateStore = useGameStateStore.getState();
      if (shouldRefreshGameStateOnSwipe && refreshChatId) gameStateStore.setRefreshingChat(refreshChatId);
      try {
        const flushPatch = useGameStateStore.getState().flushPatch;
        if (flushPatch) {
          try {
            await flushPatch();
          } catch {
            if (swipeActionSeq.current === actionId) {
              toast.error("Could not save tracker changes before deleting the swipe.");
            }
            return;
          }
        }
        if (swipeActionSeq.current !== actionId) return;
        await deleteSwipe.mutateAsync({ messageId, index });
        if (swipeActionSeq.current !== actionId) return;
        await refreshVisibleGameState();
      } catch {
        if (swipeActionSeq.current !== actionId) return;
        toast.error("Could not delete the swipe.");
      } finally {
        if (swipeActionSeq.current === actionId) {
          useGameStateStore.getState().clearRefreshingChat(refreshChatId);
        }
      }
    })();
  }, [
    activeChatId,
    deleteDialogActiveSwipeIndex,
    deleteDialogCanDeleteSwipe,
    deleteDialogMessageId,
    deleteSwipe,
    refreshVisibleGameState,
    shouldRefreshGameStateOnSwipe,
  ]);

  const handleDeleteMore = useCallback(() => {
    if (deleteDialogMessageId) {
      const startIdx = messages?.findIndex((m) => m.id === deleteDialogMessageId) ?? -1;
      if (messages && startIdx >= 0) {
        const ids = new Set<string>();
        for (let i = startIdx; i < messages.length; i++) ids.add(messages[i]!.id);
        setSelectedMessageIds(ids);
      } else {
        setSelectedMessageIds(new Set([deleteDialogMessageId]));
      }
    }
    setDeleteDialogMessageId(null);
    setMultiSelectMode(true);
  }, [deleteDialogMessageId, messages]);

  const handleToggleSelectMessage = useCallback(
    (toggle: MessageSelectionToggle) => {
      const { messageId, orderIndex, checked, shiftKey } = toggle;
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && selectionAnchorIndex != null) {
          const start = Math.min(selectionAnchorIndex, orderIndex);
          const end = Math.max(selectionAnchorIndex, orderIndex);
          for (let current = start; current <= end; current++) {
            const rangeMessageId = messageIdByOrderIndex.get(current);
            if (!rangeMessageId) continue;
            if (checked) next.add(rangeMessageId);
            else next.delete(rangeMessageId);
          }
        } else {
          if (checked) next.add(messageId);
          else next.delete(messageId);
        }
        return next;
      });
      if (!shiftKey || selectionAnchorIndex == null) {
        setSelectionAnchorIndex(orderIndex);
      }
    },
    [messageIdByOrderIndex, selectionAnchorIndex],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedMessageIds.size > 0) {
      deleteMessages.mutate([...selectedMessageIds]);
    }
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setSelectionAnchorIndex(null);
  }, [selectedMessageIds, deleteMessages]);

  const handleCancelMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setSelectionAnchorIndex(null);
  }, []);

  useEffect(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds(new Set());
    setSelectionAnchorIndex(null);
    setScheduleModalCharacterId(null);
    setScheduleModalInitialDay(null);
  }, [activeChatId]);

  const handleUnselectAllMessages = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const handleSelectAllAboveSelection = useCallback(() => {
    if (!messages || messages.length === 0) return;
    setSelectedMessageIds((prev) => {
      if (prev.size === 0) return prev;
      let firstIdx = -1;
      for (let i = 0; i < messages.length; i++) {
        if (prev.has(messages[i]!.id)) {
          firstIdx = i;
          break;
        }
      }
      if (firstIdx <= 0) return prev;
      const next = new Set(prev);
      for (let i = 0; i < firstIdx; i++) next.add(messages[i]!.id);
      return next;
    });
  }, [messages]);

  const handleSelectAllBelowSelection = useCallback(() => {
    if (!messages || messages.length === 0) return;
    setSelectedMessageIds((prev) => {
      if (prev.size === 0) return prev;
      let lastIdx = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (prev.has(messages[i]!.id)) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx < 0 || lastIdx >= messages.length - 1) return prev;
      const next = new Set(prev);
      for (let i = lastIdx + 1; i < messages.length; i++) next.add(messages[i]!.id);
      return next;
    });
  }, [messages]);

  const handleRegenerate = useCallback(
    async (messageId: string, options?: { skipTouchConfirm?: boolean }) => {
      if (!activeChatId || isStreaming) return;
      // On touch devices, confirm to prevent accidental taps
      if (
        !options?.skipTouchConfirm &&
        window.matchMedia("(pointer: coarse)").matches &&
        !(await showConfirmDialog({
          title: "Regenerate Message",
          message: "Regenerate this message as a new swipe?",
          confirmLabel: "Regenerate",
        }))
      ) {
        return;
      }
      try {
        // Regenerate as a new swipe on the existing message
        const currentInput = useChatStore.getState().currentInput;
        const hasInput = currentInput ? currentInput.trim().length > 0 : false;
        await generate(
          guideGenerations && hasInput
            ? {
                chatId: activeChatId,
                connectionId: null,
                regenerateMessageId: messageId,
                generationGuide: buildGuidedGenerationInstructionMessage(currentInput.toString()),
                generationGuideSource: "guide",
              }
            : { chatId: activeChatId, connectionId: null, regenerateMessageId: messageId },
        );
      } catch {
        // Error toast is shown by the generate hook
      }
    },
    [activeChatId, isStreaming, generate, guideGenerations],
  );

  const handleRetryAgents = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing || failedAgentTypes.length === 0) return;
    await retryAgents(activeChatId, failedAgentTypes);
  }, [activeChatId, isStreaming, agentProcessing, failedAgentTypes, retryAgents]);

  const handleRerunTrackers = useCallback(async () => {
    if (!activeChatId || isStreaming || agentProcessing) return;
    const manualTypes = Array.from(manualTrackerTypes);
    const types =
      manualTypes.length > 0
        ? manualTypes
        : Array.from(enabledAgentTypes).filter(
            (type) => isBuiltInTrackerAgentType(type) || !isBuiltInAgentType(type),
          );
    if (types.length === 0) return;
    await retryAgents(activeChatId, types);
  }, [activeChatId, isStreaming, agentProcessing, enabledAgentTypes, manualTrackerTypes, retryAgents]);

  const handleRerunSingleTracker = useCallback(
    async (agentType: string) => {
      if (!activeChatId || isStreaming || agentProcessing) return;
      if (!isBuiltInTrackerAgentType(agentType) || !enabledAgentTypes.has(agentType)) return;
      await retryAgents(activeChatId, [agentType]);
    },
    [activeChatId, isStreaming, agentProcessing, enabledAgentTypes, retryAgents],
  );

  const handleSetActiveSwipe = useCallback(
    (messageId: string, index: number) => {
      const actionId = ++swipeActionSeq.current;
      const refreshChatId = activeChatId;
      void (async () => {
        const gameStateStore = useGameStateStore.getState();
        if (shouldRefreshGameStateOnSwipe && refreshChatId) gameStateStore.setRefreshingChat(refreshChatId);
        try {
          const flushPatch = useGameStateStore.getState().flushPatch;
          if (flushPatch) {
            try {
              await flushPatch();
            } catch {
              if (swipeActionSeq.current === actionId) {
                toast.error("Could not save tracker changes before switching swipes.");
              }
              return;
            }
          }
          if (swipeActionSeq.current !== actionId) return;
          const previousMutation = pendingSwipeMutationsRef.current.get(messageId);
          if (previousMutation) {
            try {
              await previousMutation;
            } catch {
              // The active action below will report its own failure if needed.
            }
          }
          if (swipeActionSeq.current !== actionId) return;
          const mutation = setActiveSwipe.mutateAsync({ messageId, index });
          const trackedMutation = mutation.then(
            () => undefined,
            () => undefined,
          );
          pendingSwipeMutationsRef.current.set(messageId, trackedMutation);
          try {
            await mutation;
          } finally {
            if (pendingSwipeMutationsRef.current.get(messageId) === trackedMutation) {
              pendingSwipeMutationsRef.current.delete(messageId);
            }
          }
          if (swipeActionSeq.current !== actionId) return;
          await refreshVisibleGameState();
        } catch {
          if (swipeActionSeq.current !== actionId) return;
          toast.error("Could not switch swipes.");
        } finally {
          if (swipeActionSeq.current === actionId) {
            useGameStateStore.getState().clearRefreshingChat(refreshChatId);
          }
        }
      })();
    },
    [activeChatId, setActiveSwipe, refreshVisibleGameState, shouldRefreshGameStateOnSwipe],
  );

  const handleEdit = useCallback(
    (messageId: string, content: string) => {
      updateMessage.mutate({ messageId, content });
    },
    [updateMessage],
  );

  const handleToggleConversationStart = useCallback(
    (messageId: string, current: boolean) => {
      updateMessageExtra.mutate({ messageId, extra: { isConversationStart: !current } });
    },
    [updateMessageExtra],
  );

  const handleToggleHiddenFromAI = useCallback(
    (messageId: string, current: boolean) => {
      updateMessageExtra.mutate({ messageId, extra: { hiddenFromAI: !current } });
    },
    [updateMessageExtra],
  );

  const handleBranch = useCallback(
    async (messageId: string) => {
      const chatId = activeChatId;
      if (!chatId || branchChat.isPending || branchPendingRef.current) return;
      branchPendingRef.current = true;
      const confirmed = await showConfirmDialog({
        title: "Create a new branch?",
        message: "This will copy the chat through this message and open the new branch.",
        confirmLabel: "Create branch",
      });
      if (!confirmed || useChatStore.getState().activeChatId !== chatId) {
        branchPendingRef.current = false;
        return;
      }
      const branchToastId = toast.loading("Creating branch...");
      branchChat.mutate(
        { chatId, upToMessageId: messageId },
        {
          onSuccess: (newChat) => {
            if (newChat) useChatStore.getState().setActiveChatId(newChat.id);
            toast.success("Branch created.");
          },
          onError: (error) => {
            toast.error(error instanceof Error ? `Branch failed: ${error.message}` : "Branch failed.");
          },
          onSettled: () => {
            branchPendingRef.current = false;
            toast.dismiss(branchToastId);
          },
        },
      );
    },
    [activeChatId, branchChat],
  );

  const handleCloneSceneFromHere = useCallback(
    (messageId: string) => {
      if (!activeChatId || isForking || isStreaming) return;
      forkScene(activeChatId, "clone", { upToMessageId: messageId });
    },
    [activeChatId, forkScene, isForking, isStreaming],
  );

  // Peek prompt state
  const [peekPromptData, setPeekPromptData] = useState<PeekPromptData | null>(null);

  const handlePeekPrompt = useCallback(
    (messageId?: string) => {
      if (!activeChatId) return;
      peekPrompt.mutate(messageId ? { chatId: activeChatId, messageId } : activeChatId, {
        onSuccess: (data) => setPeekPromptData(data),
        onError: (error) => {
          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Could not assemble the prompt preview.";
          toast.error(message);
        },
      });
    },
    [activeChatId, peekPrompt],
  );

  // Find the last assistant message for peek-prompt eligibility
  const lastAssistantMessageId = useMemo(() => {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === "assistant") return messages[i]!.id;
    }
    return null;
  }, [messages]);

  const latestAssistantMessageForSwipes = useMemo(() => {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i]!;
      if (candidate.role === "assistant") return candidate;
    }
    return null;
  }, [messages]);

  const latestMessageForEdit = useMemo(() => {
    if (!messages) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidate = messages[i]!;
      if (candidate.role !== "user" && candidate.role !== "assistant") continue;
      const extra =
        typeof candidate.extra === "string"
          ? (() => {
              try {
                return JSON.parse(candidate.extra as unknown as string);
              } catch {
                return {};
              }
            })()
          : (candidate.extra ?? {});
      if (extra?.hiddenFromUser === true) continue;
      return candidate;
    }
    return null;
  }, [messages]);

  const intuitiveSwipeBlocked =
    settingsOpen ||
    galleryOpen ||
    wizardOpen ||
    spriteArrangeMode ||
    multiSelectMode ||
    Boolean(deleteDialogMessageId) ||
    Boolean(peekPromptData) ||
    encounterActive;

  const navigateLatestSwipe = useCallback(
    (direction: -1 | 1) => {
      const supportsMode = chatMode === "conversation" || isRoleplay;
      if (!supportsMode || !intuitiveSwipeNavigation || intuitiveSwipeBlocked) return false;
      if (!activeChatId || isStreaming || agentProcessing || !latestAssistantMessageForSwipes) return false;

      const swipeCount = latestAssistantMessageForSwipes.swipeCount ?? 1;
      const activeIndex = latestAssistantMessageForSwipes.activeSwipeIndex ?? 0;

      if (direction < 0) {
        if (activeIndex <= 0) return false;
        handleSetActiveSwipe(latestAssistantMessageForSwipes.id, activeIndex - 1);
        return true;
      }

      if (activeIndex < swipeCount - 1) {
        handleSetActiveSwipe(latestAssistantMessageForSwipes.id, activeIndex + 1);
        return true;
      }

      if (!intuitiveSwipeRerollLatest) return false;
      void handleRegenerate(latestAssistantMessageForSwipes.id, { skipTouchConfirm: true });
      return true;
    },
    [
      activeChatId,
      agentProcessing,
      chatMode,
      handleRegenerate,
      handleSetActiveSwipe,
      intuitiveSwipeBlocked,
      intuitiveSwipeNavigation,
      intuitiveSwipeRerollLatest,
      isRoleplay,
      isStreaming,
      latestAssistantMessageForSwipes,
    ],
  );

  useEffect(() => {
    if (!intuitiveSwipeNavigation || intuitiveSwipeBlocked) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (shouldIgnoreIntuitiveSwipeTarget(event.target)) return;

      if (event.repeat && event.key === "ArrowRight" && latestAssistantMessageForSwipes) {
        const swipeCount = latestAssistantMessageForSwipes.swipeCount ?? 1;
        const activeIndex = latestAssistantMessageForSwipes.activeSwipeIndex ?? 0;
        if (activeIndex >= swipeCount - 1) return;
      }

      const handled = navigateLatestSwipe(event.key === "ArrowLeft" ? -1 : 1);
      if (handled) event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [intuitiveSwipeBlocked, intuitiveSwipeNavigation, latestAssistantMessageForSwipes, navigateLatestSwipe]);

  // Up-Arrow recall of the most recent message (user OR assistant) — runs
  // independently of swipe nav so the shortcut works with that toggle off.
  useEffect(() => {
    if (!editLastMessageOnArrowUp || intuitiveSwipeBlocked) return;
    const supportsMode = chatMode === "conversation" || isRoleplay;
    if (!supportsMode) return;

    const handleArrowUp = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowUp") return;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!latestMessageForEdit) return;
      // Don't try to edit a message that's currently streaming/regenerating.
      if (isStreaming || agentProcessing) return;

      const target = event.target;
      if (target instanceof Element) {
        // Allow recall when the chat input textarea is focused but empty
        // (shell-style). Otherwise leave typing/editing alone.
        if (target.tagName === "TEXTAREA") {
          const ta = target as HTMLTextAreaElement;
          if (ta.value.length > 0) return;
        } else if (
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.getAttribute("contenteditable") === "true"
        ) {
          return;
        }
      }

      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("marinara:start-edit-message", {
          detail: { messageId: latestMessageForEdit.id },
        }),
      );
    };

    window.addEventListener("keydown", handleArrowUp);
    return () => window.removeEventListener("keydown", handleArrowUp);
  }, [
    agentProcessing,
    chatMode,
    editLastMessageOnArrowUp,
    intuitiveSwipeBlocked,
    isRoleplay,
    isStreaming,
    latestMessageForEdit,
  ]);

  useEffect(() => {
    if (!intuitiveSwipeNavigation || intuitiveSwipeBlocked) return;

    const handleTouchStart = (event: TouchEvent) => {
      const surface = scrollRef.current;
      const target = event.target;
      if (
        event.touches.length !== 1 ||
        !surface ||
        !(target instanceof Node) ||
        !surface.contains(target) ||
        shouldIgnoreIntuitiveSwipeTarget(target)
      ) {
        intuitiveTouchStartRef.current = null;
        return;
      }
      const touch = event.touches.item(0);
      if (!touch) return;
      intuitiveTouchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: event.target,
      };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = intuitiveTouchStartRef.current;
      intuitiveTouchStartRef.current = null;
      const touch = event.changedTouches.item(0);
      if (!start || !touch || shouldIgnoreIntuitiveSwipeTarget(start.target)) return;

      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX < INTUITIVE_SWIPE_MIN_DISTANCE || absY > INTUITIVE_SWIPE_MAX_VERTICAL_DRIFT || absX < absY * 1.35) {
        return;
      }

      const handled = navigateLatestSwipe(deltaX < 0 ? 1 : -1);
      if (handled) event.preventDefault();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [intuitiveSwipeBlocked, intuitiveSwipeNavigation, navigateLatestSwipe]);

  useEffect(() => {
    if (chat) useChatStore.getState().setActiveChat(chat);
  }, [chat]);

  // Reset stagger animation flag when switching chats
  useEffect(() => {
    hasAnimatedRef.current = false;
  }, [activeChatId]);

  // Auto-open settings drawer for newly created chats
  const shouldOpenSettings = useChatStore((s) => s.shouldOpenSettings);
  const shouldOpenWizard = useChatStore((s) => s.shouldOpenWizard);
  useEffect(() => {
    if (shouldOpenSettings && activeChatId) {
      if (shouldOpenWizard) {
        setWizardOpen(true);
        useChatStore.getState().setShouldOpenWizard(false);
      } else {
        handleOpenSettingsPanel();
      }
      useChatStore.getState().setShouldOpenSettings(false);
    }
  }, [shouldOpenSettings, shouldOpenWizard, activeChatId, handleOpenSettingsPanel]);

  // Auto-scroll on new messages / streaming (but not on "load more")
  // Only scroll if user is already near the bottom (within 150px).
  // During streaming, if the user scrolls (wheel, touch, or upward scroll),
  // stop auto-scrolling until they manually scroll back to the bottom.
  const isNearBottomRef = useRef(true);
  const userScrolledAwayRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const userScrolledAtRef = useRef(0);
  const forcedBottomScrollRef = useRef<{ requestedAt: number; behavior: ScrollBehavior } | null>(null);
  const openedAtBottomChatIdRef = useRef<string | null>(null);
  const streamScrollFrameRef = useRef(0);
  const scrollToMessagesBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);
  const scheduleStreamScrollToBottom = useCallback(() => {
    if (streamScrollFrameRef.current) return;
    streamScrollFrameRef.current = requestAnimationFrame(() => {
      streamScrollFrameRef.current = 0;
      if (isLoadingMoreRef.current || !isNearBottomRef.current || userScrolledAwayRef.current) return;
      // Streaming already animates the text every frame. Starting a new smooth
      // scroll for every character queues competing animations and makes both
      // the typewriter and bottom-follow motion stutter.
      scrollToMessagesBottom("auto");
    });
  }, [scrollToMessagesBottom]);
  useEffect(
    () => () => {
      if (streamScrollFrameRef.current) cancelAnimationFrame(streamScrollFrameRef.current);
    },
    [],
  );
  const scheduleScrollToMessagesBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      scrollToMessagesBottom(behavior);
      requestAnimationFrame(() => {
        scrollToMessagesBottom(behavior);
        requestAnimationFrame(() => scrollToMessagesBottom(behavior));
      });
    },
    [scrollToMessagesBottom],
  );
  useEffect(() => {
    const handleScrollRequest = (event: Event) => {
      const detail = (event as CustomEvent<ChatScrollToBottomDetail>).detail;
      if (!detail?.chatId || detail.chatId !== activeChatId) return;

      const behavior = detail.behavior ?? "auto";
      forcedBottomScrollRef.current = { requestedAt: Date.now(), behavior };
      userScrolledAwayRef.current = false;
      isNearBottomRef.current = true;
      scheduleScrollToMessagesBottom(behavior);
    };

    window.addEventListener(CHAT_SCROLL_TO_BOTTOM_EVENT, handleScrollRequest);
    return () => window.removeEventListener(CHAT_SCROLL_TO_BOTTOM_EVENT, handleScrollRequest);
  }, [activeChatId, scheduleScrollToMessagesBottom]);

  useEffect(() => {
    if (!activeChatId || isFetchingNextPage || isLoadingMoreRef.current) return;
    if (openedAtBottomChatIdRef.current === activeChatId) return;
    if (isLoading && loadedMessageCount === 0) return;

    let frame = 0;
    const scrollWhenSurfaceIsReady = () => {
      if (!scrollRef.current && !messagesEndRef.current) {
        frame = requestAnimationFrame(scrollWhenSurfaceIsReady);
        return;
      }

      openedAtBottomChatIdRef.current = activeChatId;
      userScrolledAwayRef.current = false;
      isNearBottomRef.current = true;
      scheduleScrollToMessagesBottom("auto");
    };

    scrollWhenSurfaceIsReady();
    return () => cancelAnimationFrame(frame);
  }, [activeChatId, isFetchingNextPage, isLoading, loadedMessageCount, scheduleScrollToMessagesBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distFromBottom < 150;

      // Detect intentional upward scroll during streaming
      if (isStreaming && el.scrollTop < lastScrollTopRef.current - 10) {
        userScrolledAwayRef.current = true;
      }
      // Re-engage auto-scroll when the user returns to the bottom,
      // but only if enough time has passed since their last wheel/touch
      // input. Without this cooldown, in-flight smooth-scroll animations
      // fire scroll events that immediately re-engage auto-scroll.
      if (nearBottom && Date.now() - userScrolledAtRef.current > 300) {
        userScrolledAwayRef.current = false;
      }

      lastScrollTopRef.current = el.scrollTop;
      isNearBottomRef.current = nearBottom;
    };

    // Wheel / touch: immediately disengage auto-scroll during streaming
    // so the user can read without being dragged to the bottom.
    const onUserScroll = () => {
      if (isStreaming) {
        userScrolledAwayRef.current = true;
        userScrolledAtRef.current = Date.now();
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, [isStreaming]);

  // Reset scroll-away flag when streaming ends
  useEffect(() => {
    if (!isStreaming) userScrolledAwayRef.current = false;
  }, [isStreaming]);

  // TTS autoplay — speak the last assistant message when streaming ends
  const { data: ttsConfig } = useTTSConfig();
  const ttsConfigRef = useRef(ttsConfig);
  ttsConfigRef.current = ttsConfig;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const chatModeRef = useRef(chatMode);
  chatModeRef.current = chatMode;
  const prevIsStreamingRef = useRef(false);
  const ttsGenerationRef = useRef<{
    chatId: string;
    beforeRevision: string | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    const handleGenerationError = (event: Event) => {
      const chatId = (event as CustomEvent<{ chatId?: string }>).detail?.chatId;
      const generation = ttsGenerationRef.current;
      if (chatId && generation?.chatId === chatId) generation.failed = true;
    };
    window.addEventListener("marinara:generation-error", handleGenerationError);
    return () => window.removeEventListener("marinara:generation-error", handleGenerationError);
  }, []);
  const resolveTTSCharacterId = useCallback(
    (speaker?: string | null) => {
      const normalizedSpeaker = normalizeTTSCharacterName(speaker);
      if (!normalizedSpeaker) return null;
      for (const [characterId, character] of characterMap) {
        if (normalizeTTSCharacterName(character.name) === normalizedSpeaker) return characterId;
      }
      return null;
    },
    [characterMap],
  );
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;
    if (!wasStreaming && isStreaming) {
      const msgs = messagesRef.current ?? [];
      ttsGenerationRef.current = activeChatId
        ? {
            chatId: activeChatId,
            beforeRevision: getTTSAutoplayRevision(findLatestTTSAutoplayMessage(msgs)),
            failed: false,
          }
        : null;
      return;
    }
    if (!wasStreaming || isStreaming) return; // only fire on true → false transition

    const generation = ttsGenerationRef.current;
    ttsGenerationRef.current = null;
    if (!activeChatId || generation?.chatId !== activeChatId) return;

    const cfg = ttsConfigRef.current;
    if (!cfg?.enabled) return;

    const mode = chatModeRef.current;
    const shouldAutoplay =
      mode === "roleplay" || mode === "visual_novel" ? cfg.autoplayRP : mode === "game" ? false : cfg.autoplayConvo;
    if (!shouldAutoplay) return;

    const msgs = messagesRef.current ?? [];
    const lastMsg = findLatestTTSAutoplayMessage(msgs);
    if (
      !lastMsg ||
      !shouldAutoplayGeneratedTTS({
        beforeRevision: generation.beforeRevision,
        message: lastMsg,
        generationFailed: generation.failed,
      })
    )
      return;

    const fallbackSpeaker =
      lastMsg.role === "narrator"
        ? "Narrator"
        : lastMsg.characterId
          ? characterMap.get(lastMsg.characterId)?.name
          : undefined;
    const ttsRequests = buildTTSVoiceRequests(
      lastMsg.content,
      cfg,
      fallbackSpeaker,
      lastMsg.characterId,
      resolveTTSCharacterId,
    );
    if (ttsRequests.length === 0) return;

    void ttsService.speakSequence(withTTSVoiceRequestCacheKeys(ttsRequests, cfg, lastMsg.id), lastMsg.id, {
      progressive: cfg.progressivePlayback,
      volume: ttsLineVolume / 100,
    });
  }, [activeChatId, characterMap, isStreaming, resolveTTSCharacterId, ttsLineVolume]);

  const newestMsgId = msgData?.pages[0]?.[msgData.pages[0].length - 1]?.id;
  const newestMsgSwipeIndex = msgData?.pages[0]?.[msgData.pages[0].length - 1]?.activeSwipeIndex;
  const isOptimistic = newestMsgId?.startsWith("__optimistic_");
  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    const forcedBottomScroll = forcedBottomScrollRef.current;
    const hasFreshForcedBottomScroll = !!forcedBottomScroll && Date.now() - forcedBottomScroll.requestedAt < 5000;
    if (forcedBottomScroll && !hasFreshForcedBottomScroll) {
      forcedBottomScrollRef.current = null;
    }

    // Always scroll when the user just sent a message (optimistic msg)
    if (isOptimistic || hasFreshForcedBottomScroll) {
      const behavior = forcedBottomScroll?.behavior ?? "auto";
      forcedBottomScrollRef.current = null;
      userScrolledAwayRef.current = false;
      isNearBottomRef.current = true;
      scheduleScrollToMessagesBottom(behavior);
      return;
    }
    if (isNearBottomRef.current && !userScrolledAwayRef.current) {
      scheduleScrollToMessagesBottom("smooth");
    }
  }, [isOptimistic, isStreaming, newestMsgId, newestMsgSwipeIndex, scheduleScrollToMessagesBottom]);

  // Auto-scroll on streamBuffer changes without causing ChatArea re-render.
  // Uses a store subscription so the hot per-token updates bypass React.
  useEffect(() => {
    let prev = useChatStore.getState().streamBuffer;
    const unsub = useChatStore.subscribe((state) => {
      if (state.streamBuffer !== prev) {
        prev = state.streamBuffer;
        scheduleStreamScrollToBottom();
      }
    });
    return unsub;
  }, [scheduleStreamScrollToBottom]);

  // The stream-buffer subscription runs before React necessarily commits the
  // corresponding text. Observe the rendered transcript as well so long
  // typewriter rewrites follow the actual growing DOM instead of scrolling to
  // the previous frame's height. The normal near-bottom/user-scroll guards in
  // scheduleStreamScrollToBottom still let readers disengage auto-follow.
  useEffect(() => {
    const el = scrollRef.current;
    if (!isStreaming || !el || typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver(() => scheduleStreamScrollToBottom());
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [isStreaming, scheduleStreamScrollToBottom]);

  // Preserve scroll position when older messages are prepended
  const pageCount = msgData?.pages.length ?? 0;
  useLayoutEffect(() => {
    if (isLoadingMoreRef.current && scrollRef.current && !isFetchingNextPage) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += newScrollHeight - prevScrollHeightRef.current;
      isLoadingMoreRef.current = false;
    }
  }, [pageCount, isFetchingNextPage]);

  const handleLoadMore = useCallback(() => {
    if (!scrollRef.current || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    isLoadingMoreRef.current = true;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // ── /goto command: paginate older pages until target message is loaded, then scroll to it
  const gotoRequest = useChatStore((s) => s.gotoRequest);
  useEffect(() => {
    if (!gotoRequest || gotoRequest.chatId !== activeChatId) return;
    if (!messages) return;

    const targetNumber = gotoRequest.messageNumber;
    if (totalMessageCount > 0 && targetNumber > totalMessageCount) {
      toast.error(`Message #${targetNumber} doesn't exist — this chat has ${totalMessageCount} messages.`);
      useChatStore.getState().clearGotoRequest();
      return;
    }

    const targetIndex = targetNumber - 1; // 0-based global index
    if (targetIndex >= messageOffset) {
      const targetId = messageIdByOrderIndex.get(targetIndex);
      if (!targetId) {
        useChatStore.getState().clearGotoRequest();
        return;
      }
      // Wait one frame so newly-loaded messages are painted before scrolling.
      const raf = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-message-id="${CSS.escape(targetId)}"]`);
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          userScrolledAwayRef.current = true; // suppress auto-scroll-to-bottom hijacking the jump
        }
        useChatStore.getState().clearGotoRequest();
      });
      return () => cancelAnimationFrame(raf);
    }

    // Target is older than the loaded window — fetch the next (older) page.
    if (hasNextPage && !isFetchingNextPage) {
      // Only engage the roleplay-surface scroll-preservation handshake when that
      // surface is actually mounted; otherwise the flag would be set forever.
      if (scrollRef.current) {
        prevScrollHeightRef.current = scrollRef.current.scrollHeight;
        isLoadingMoreRef.current = true;
      }
      fetchNextPage();
    } else if (!hasNextPage) {
      // Nothing more to load but we still didn't reach the target — give up.
      useChatStore.getState().clearGotoRequest();
    }
  }, [
    gotoRequest,
    activeChatId,
    messages,
    messageOffset,
    messageIdByOrderIndex,
    totalMessageCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  // ═══════════════════════════════════════════════
  // Restoring persisted active chat
  // ═══════════════════════════════════════════════
  if (activeChatId && !chat) {
    const errorMessage =
      chatError instanceof ApiError
        ? chatError.message
        : chatError instanceof Error
          ? chatError.message
          : "Opening chat...";
    const hasOpenError = !!chatError;

    return (
      <div
        data-component="ChatArea.RestoringChat"
        className="mari-app-background-paint flex flex-1 items-center justify-center overflow-hidden p-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          {!hasOpenError && (
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {hasOpenError ? "Could not open this chat" : "Opening chat..."}
            </p>
            {hasOpenError && <p className="max-w-sm text-xs text-[var(--muted-foreground)]">{errorMessage}</p>}
          </div>
          {hasOpenError && (
            <button
              type="button"
              onClick={() => setActiveChatId(null)}
              className="mari-chrome-control mari-chrome-control--small text-xs"
            >
              Back to chats
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // Empty state (no active chat)
  // ═══════════════════════════════════════════════
  if (!activeChatId) {
    const showEmptyStateEffects = isPageActive;

    return (
      <>
        <HomeCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
        <div
          ref={homeViewportRef}
          data-component="ChatArea.EmptyState"
          className={cn(
            "mari-app-background-paint mari-chrome-token-scope relative isolate flex flex-1 flex-col items-center",
            homeProfessorChatActive ? "overflow-hidden p-0 sm:p-3 lg:p-3" : "overflow-hidden p-1.5 sm:p-3 lg:p-3",
          )}
        >
          {showEmptyStateEffects && !homeProfessorChatActive && <HomeStarfield />}
          <div
            ref={homeContentRef}
            data-component="ChatArea.HomeContent"
            className={cn(
              "relative z-[1] flex w-full flex-col items-center",
              homeProfessorChatActive
                ? "min-h-0 flex-1 max-w-none gap-0 py-0"
                : "home-viewport-fit-content max-w-5xl shrink-0 gap-1.5 py-0 sm:gap-2 lg:pt-0 lg:pb-2",
            )}
            style={
              homeProfessorChatActive ? undefined : ({ "--mari-home-fit-scale": String(homeFitScale) } as CSSProperties)
            }
          >
            {!homeProfessorChatActive && (
              <>
                {/* Central hero */}
                <div className="relative">
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl shadow-xl shadow-orange-500/20 sm:h-16 sm:w-16",
                      showEmptyStateEffects && "animate-pulse-ring bunny-glow",
                    )}
                  >
                    <img
                      src={showEmptyStateEffects ? "/logo-splash.gif" : "/logo.png"}
                      alt="Marinara Engine"
                      width={80}
                      height={80}
                      decoding="async"
                      className={cn(
                        "h-full w-full",
                        showEmptyStateEffects ? "object-cover" : "object-contain p-1.5 sm:p-2",
                      )}
                    />
                  </div>
                </div>

                <div className="text-center">
                  <h3
                    className={cn(
                      "mari-logo-gradient-text text-base font-bold sm:text-xl",
                      isPageActive && "mari-logo-gradient-text--active",
                    )}
                  >
                    Marinara Engine
                  </h3>
                  <p className="mari-chrome-text-muted mt-0.5 text-[0.625rem] tracking-wide opacity-65">
                    v{APP_VERSION}
                  </p>
                </div>

                {/* Recent Chats */}
                <RecentChats />
              </>
            )}

            <div
              className={cn(
                "flex w-full flex-col",
                homeProfessorChatActive ? "min-h-0 flex-1 max-w-none" : "max-w-5xl",
              )}
            >
              <HomeProfessorMariChat
                pageActive={isPageActive}
                attachedFooter={!homeProfessorChatActive}
                chatWindowOpen={homeProfessorChatOpen}
                launchHidden={homeProfessorChatActive}
                onChatWindowOpenChange={handleHomeProfessorChatOpenChange}
                onChatWindowExitComplete={handleHomeProfessorChatExitComplete}
              />
              {!homeProfessorChatActive && <HomeAchievements attached />}
            </div>

            {!homeProfessorChatActive && (
              <>
                <div
                  className={cn(
                    "w-48 [--retro-divider-margin:0]",
                    showEmptyStateEffects ? "retro-divider" : "h-px rounded-[1px] bg-[var(--border)]/40",
                  )}
                />

                {/* Footer */}
                <div className="flex w-full max-w-2xl flex-col items-center gap-1">
                  <div className="mari-chrome-text-muted flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center text-[0.625rem] leading-tight sm:text-xs">
                    <span>
                      Created by{" "}
                      <a
                        href="https://spicymarinara.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mari-chrome-text underline decoration-[var(--marinara-chat-chrome-panel-muted)]/30 transition-colors hover:text-[var(--marinara-chat-chrome-button-text-hover)] hover:decoration-[var(--marinara-chat-chrome-button-border-hover)]"
                      >
                        Marinara
                      </a>
                    </span>
                    <span>
                      Partnered with{" "}
                      <a
                        href="https://linkapi.ai/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mari-chrome-text underline decoration-[var(--marinara-chat-chrome-panel-muted)]/30 transition-colors hover:text-[var(--marinara-chat-chrome-button-text-hover)] hover:decoration-[var(--marinara-chat-chrome-button-border-hover)]"
                      >
                        LinkAPI
                      </a>
                    </span>
                    <span>
                      Art and logo by{" "}
                      <a
                        href="https://huntercolliex.carrd.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mari-chrome-text underline decoration-[var(--marinara-chat-chrome-panel-muted)]/30 transition-colors hover:text-[var(--marinara-chat-chrome-button-text-hover)] hover:decoration-[var(--marinara-chat-chrome-button-border-hover)]"
                      >
                        HunterCollieX
                      </a>
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <a
                      href="https://discord.com/invite/KdAkTg94ME"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackHomeFooterAchievement("discord_clicked")}
                      className="mari-chrome-control mari-chrome-control--small text-xs"
                    >
                      <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                      </svg>
                      Discord
                    </a>
                    <a
                      href="https://ko-fi.com/marinara_spaghetti"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackHomeFooterAchievement("kofi_clicked")}
                      className="mari-chrome-control mari-chrome-control--small text-xs"
                    >
                      <svg width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      Support
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setCreditsOpen(true);
                        trackHomeFooterAchievement("credits_viewed");
                      }}
                      className="mari-chrome-control mari-chrome-control--small text-xs"
                    >
                      <List size="0.875rem" />
                      Credits
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {/* In-app documentation */}
                    <button
                      type="button"
                      onClick={() => useUIStore.getState().openModal("docs-viewer")}
                      className="mari-chrome-control mari-chrome-control--small text-xs"
                      title="Browse the documentation"
                    >
                      <BookOpen size="0.875rem" />
                      Documentation
                    </button>

                    {/* Restart tutorial */}
                    <button
                      type="button"
                      onClick={() => useUIStore.getState().setHasCompletedOnboarding(false)}
                      className="mari-chrome-control mari-chrome-control--small text-xs"
                      title="Replay tutorial"
                    >
                      <HelpCircle size="0.875rem" />
                      Replay Tutorial
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {pendingNewChatMode && (
          <NewChatConnectionGate
            mode={pendingNewChatMode}
            onClose={() => useChatStore.getState().setPendingNewChatMode(null)}
          />
        )}
      </>
    );
  }

  // Helper: is this message grouped with the previous one?
  const isGrouped = (i: number) => {
    if (i === 0 || !messages) return false;
    const prev = messages[i - 1];
    const curr = messages[i];
    if (startsNewAssistantBubble(curr)) return false;
    if (prev.role !== curr.role || prev.characterId !== curr.characterId) return false;
    // Break grouping when persona changes between consecutive user messages
    if (prev.role === "user" && curr.role === "user") {
      const prevExtra = typeof prev.extra === "string" ? JSON.parse(prev.extra) : (prev.extra ?? {});
      const currExtra = typeof curr.extra === "string" ? JSON.parse(curr.extra) : (curr.extra ?? {});
      const prevId = prevExtra.personaSnapshot?.personaId;
      const currId = currExtra.personaSnapshot?.personaId;
      if (prevId && currId && prevId !== currId) return false;
    }
    return true;
  };

  // ═══════════════════════════════════════════════
  // Unified layout — mode-aware rendering
  // ═══════════════════════════════════════════════
  const msgPayload = (messages ?? []).map((m) => ({ role: m.role, characterId: m.characterId, content: m.content }));
  const chatList =
    (allChats as Array<{ id: string; name: string; metadata?: string | Record<string, unknown> }> | undefined) ?? [];
  const connectedChatName = chat?.connectedChatId
    ? getConnectedChatDisplayName(chatList.find((item) => item.id === chat.connectedChatId))
    : undefined;
  const activeSceneChat = chatMeta.activeSceneChatId
    ? chatList.find((item) => item.id === chatMeta.activeSceneChatId)
    : undefined;
  const activeSceneMeta = parseChatMetadata(activeSceneChat?.metadata);
  const hasActiveLinkedScene = activeSceneChat && activeSceneMeta.sceneStatus === "active";
  const isSceneChat = chatMeta.sceneStatus === "active" || Boolean(chatMeta.sceneOriginChatId);
  const conversationSceneInfo =
    chatMeta.activeSceneChatId && hasActiveLinkedScene
      ? {
          variant: "origin" as const,
          sceneChatId: chatMeta.activeSceneChatId,
          sceneChatName: getChatDisplayName(activeSceneChat),
        }
      : chatMeta.sceneStatus === "active"
        ? {
            variant: "scene" as const,
            sceneChatId: activeChatId,
            originChatId: chatMeta.sceneOriginChatId,
            description: chatMeta.sceneDescription,
          }
        : undefined;
  const surfaceFallback = <div className="flex flex-1 overflow-hidden" />;
  const scheduleModal = scheduleModalCharacterId ? (
    <Suspense fallback={null}>
      <CharacterScheduleEditorModal
        open
        chatId={activeChatId}
        characterId={scheduleModalCharacterId}
        characterName={characterMap.get(scheduleModalCharacterId)?.name ?? "Character"}
        characterAvatarUrl={characterMap.get(scheduleModalCharacterId)?.avatarUrl ?? null}
        characterAvatarCrop={characterMap.get(scheduleModalCharacterId)?.avatarCrop ?? null}
        schedule={(chatMeta.characterSchedules as Record<string, WeekSchedule> | undefined)?.[scheduleModalCharacterId]}
        initialDay={scheduleModalInitialDay}
        onClose={handleCloseScheduleEditor}
        onSave={handleSaveCharacterSchedule}
      />
    </Suspense>
  ) : null;

  // ═══════════════════════════════════════════════
  // Game mode — RPG surface with GM narration, map, party chat
  // ═══════════════════════════════════════════════
  if (chatMode === "game") {
    if (!chat) return surfaceFallback;

    return (
      <Suspense fallback={surfaceFallback}>
        <>
          {cardCssInjector}
          {scheduleModal}
          <GameSurface
            activeChatId={activeChatId}
            chat={chat!}
            chatMeta={chatMeta}
            messages={messages ?? []}
            isStreaming={isStreaming}
            isMessagesLoading={isLoading}
            characterMap={characterMap}
            characters={gameCharacters}
            personaInfo={personaInfo}
            chatBackground={chatBackground}
            connectedChatName={connectedChatName}
            onOpenSettings={handleOpenSettingsPanel}
            onCloseSettings={handleCloseSettingsPanel}
            onSwitchChat={chat.connectedChatId ? () => setActiveChatId(chat.connectedChatId!) : undefined}
            onDeleteMessage={handleDelete}
            onPeekPrompt={handlePeekPrompt}
            multiSelectMode={multiSelectMode}
            selectedMessageIds={selectedMessageIds}
          />

          <ChatCommonOverlays
            chat={chat}
            settingsOpen={settingsOpen}
            settingsAnchor={settingsAnchor}
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
              onToggleSpriteArrange: () => setSpriteArrangeMode((prev) => !prev),
              onResetSpritePlacements: handleResetSpritePlacements,
              onSpriteSideChange: handleSetSpritePosition,
              spriteVisualSettings: effectiveSpriteVisualSettings,
              onSpriteVisualSettingsChange: patchLocalSpriteVisualSettings,
            }}
            onCloseSettings={handleCloseSettingsPanel}
            onCloseGallery={handleCloseGalleryPanel}
            onOpenScheduleEditor={handleOpenScheduleEditor}
            onIllustrate={() => retryAgents(activeChatId, ["illustrator"])}
            onWizardFinish={() => {
              setWizardOpen(false);
              handleOpenSettingsPanel();
            }}
            onClosePeekPrompt={() => setPeekPromptData(null)}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteSwipe={handleDeleteSwipe}
            onDeleteMore={handleDeleteMore}
            onCloseDeleteDialog={() => setDeleteDialogMessageId(null)}
            onBulkDelete={handleBulkDelete}
            onCancelMultiSelect={handleCancelMultiSelect}
            onUnselectAllMessages={handleUnselectAllMessages}
            onSelectAllAboveSelection={handleSelectAllAboveSelection}
            onSelectAllBelowSelection={handleSelectAllBelowSelection}
          />
        </>
      </Suspense>
    );
  }

  // ═══════════════════════════════════════════════
  // Conversation mode — Discord-style layout
  // ═══════════════════════════════════════════════
  if (chatMode === "conversation") {
    return (
      <>
        {cardCssInjector}
        {scheduleModal}
        <Suspense fallback={surfaceFallback}>
          <ChatConversationSurface
            activeChatId={activeChatId}
            chat={chat}
            messages={messages}
            isLoading={isLoading}
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            pageCount={pageCount}
            totalMessageCount={totalMessageCount}
            characterMap={characterMap}
            characterNames={characterNames}
            personaInfo={personaInfo}
            chatMeta={chatMeta}
            chatCharIds={chatCharIds}
            connectedChatName={connectedChatName}
            sceneInfo={conversationSceneInfo}
            settingsOpen={settingsOpen}
            settingsAnchor={settingsAnchor}
            settingsInitialSection={settingsInitialSection}
            galleryOpen={galleryOpen}
            galleryAnchor={galleryAnchor}
            wizardOpen={wizardOpen}
            peekPromptData={peekPromptData}
            deleteDialogMessageId={deleteDialogMessageId}
            deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
            deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
            deleteDialogSwipeCount={deleteDialogSwipeCount}
            multiSelectMode={multiSelectMode}
            selectedMessageIds={selectedMessageIds}
            spriteArrangeMode={spriteArrangeMode}
            onDelete={handleDelete}
            onRegenerate={handleRegenerate}
            onEdit={handleEdit}
            onSetActiveSwipe={handleSetActiveSwipe}
            onToggleHiddenFromAI={handleToggleHiddenFromAI}
            onPeekPrompt={handlePeekPrompt}
            onBranch={isSceneChat ? undefined : handleBranch}
            onToggleSelectMessage={handleToggleSelectMessage}
            onSwitchChat={chat?.connectedChatId ? () => setActiveChatId(chat.connectedChatId!) : undefined}
            onConcludeScene={chatMeta.sceneStatus === "active" ? () => concludeScene(activeChatId) : undefined}
            onAbandonScene={chatMeta.sceneStatus === "active" ? () => abandonScene(activeChatId) : undefined}
            onOpenSettings={handleOpenSettingsPanel}
            onOpenGallery={handleOpenGalleryPanel}
            onOpenScheduleEditor={handleOpenScheduleEditor}
            onCloseSettings={handleCloseSettingsPanel}
            onCloseGallery={handleCloseGalleryPanel}
            onGenerateSelfie={handleGenerateConversationSelfie}
            onWizardFinish={() => {
              setWizardOpen(false);
              handleOpenSettingsPanel();
            }}
            onClosePeekPrompt={() => setPeekPromptData(null)}
            onResetSpritePlacements={handleResetSpritePlacements}
            onSpriteSideChange={handleSetSpritePosition}
            onToggleSpriteArrange={() => setSpriteArrangeMode((prev) => !prev)}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteSwipe={handleDeleteSwipe}
            onDeleteMore={handleDeleteMore}
            onCloseDeleteDialog={() => setDeleteDialogMessageId(null)}
            onBulkDelete={handleBulkDelete}
            onCancelMultiSelect={handleCancelMultiSelect}
            onUnselectAllMessages={handleUnselectAllMessages}
            onSelectAllAboveSelection={handleSelectAllAboveSelection}
            onSelectAllBelowSelection={handleSelectAllBelowSelection}
            lastAssistantMessageId={lastAssistantMessageId}
          />
        </Suspense>
        <ImagePromptReviewModal
          open={conversationSelfieReviewItems.length > 0}
          items={conversationSelfieReviewItems}
          isSubmitting={conversationSelfieReviewSubmitting}
          onCancel={() => closeConversationSelfiePromptReview(null)}
          onConfirm={confirmConversationSelfiePromptReview}
        />
        {pendingNewChatMode && (
          <NewChatConnectionGate
            mode={pendingNewChatMode}
            onClose={() => useChatStore.getState().setPendingNewChatMode(null)}
          />
        )}
      </>
    );
  }

  // ═══════════════════════════════════════════════
  // Roleplay / Visual Novel mode — existing layout
  // ═══════════════════════════════════════════════
  const shouldAnimateMessages = !hasAnimatedRef.current;
  if (messages?.length) hasAnimatedRef.current = true;

  return (
    <>
      {cardCssInjector}
      {scheduleModal}
      <Suspense fallback={surfaceFallback}>
        <ChatRoleplaySurface
          activeChatId={activeChatId}
          chat={chat}
          allChats={chatList}
          chatMeta={chatMeta}
          chatMode={chatMode}
          isRoleplay={isRoleplay}
          centerCompact={centerCompact}
          chatBackground={chatBackground}
          weatherEffects={weatherEffects}
          expressionAgentEnabled={expressionAgentEnabled}
          combatAgentEnabled={combatAgentEnabled}
          encounterActive={encounterActive}
          spritePosition={spritePosition}
          spriteCharacterIds={spriteCharacterIds}
          spriteDisplayModes={visibleSpriteDisplayModes}
          spriteExpressions={spriteExpressions}
          expressionAvatarResolver={expressionAvatarResolver}
          spritePlacements={spritePlacements}
          spriteScale={spriteScale}
          expressionSpriteScale={expressionSpriteScale}
          fullBodySpriteScale={fullBodySpriteScale}
          spriteOpacity={spriteOpacity}
          expressionSpriteOpacity={expressionSpriteOpacity}
          fullBodySpriteOpacity={fullBodySpriteOpacity}
          spriteArrangeMode={spriteArrangeMode}
          enabledAgentTypes={enabledAgentTypes}
          manualTrackersActive={hasManualTrackerAgents}
          chatCharIds={chatCharIds}
          characterMap={characterMap}
          characterNames={characterNames}
          personaInfo={personaInfo}
          messages={messages}
          msgPayload={msgPayload}
          isLoading={isLoading}
          hasNextPage={!!hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isStreaming={isStreaming}
          agentProcessing={agentProcessing}
          regenerateMessageId={regenerateMessageId}
          shouldAnimateMessages={shouldAnimateMessages}
          summaryContextSize={summaryContextSize}
          totalMessageCount={totalMessageCount}
          lastAssistantMessageId={lastAssistantMessageId}
          settingsOpen={settingsOpen}
          settingsAnchor={settingsAnchor}
          settingsInitialSection={settingsInitialSection}
          galleryOpen={galleryOpen}
          galleryAnchor={galleryAnchor}
          wizardOpen={wizardOpen}
          peekPromptData={peekPromptData}
          deleteDialogMessageId={deleteDialogMessageId}
          deleteDialogCanDeleteSwipe={deleteDialogCanDeleteSwipe}
          deleteDialogActiveSwipeIndex={deleteDialogActiveSwipeIndex}
          deleteDialogSwipeCount={deleteDialogSwipeCount}
          multiSelectMode={multiSelectMode}
          selectedMessageIds={selectedMessageIds}
          groupChatMode={groupChatMode}
          scrollRef={scrollRef}
          messagesEndRef={messagesEndRef}
          onLoadMore={handleLoadMore}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          onSetActiveSwipe={handleSetActiveSwipe}
          onToggleConversationStart={handleToggleConversationStart}
          onToggleHiddenFromAI={handleToggleHiddenFromAI}
          onPeekPrompt={handlePeekPrompt}
          onBranch={isSceneChat ? undefined : handleBranch}
          onCloneSceneFromHere={isSceneChat ? handleCloneSceneFromHere : undefined}
          isCloneSceneFromHereDisabled={isForking || isStreaming}
          onToggleSelectMessage={handleToggleSelectMessage}
          onRerunTrackers={handleRerunTrackers}
          onRerunSingleTracker={handleRerunSingleTracker}
          onRetryFailedAgents={handleRetryAgents}
          onStartEncounter={() => startEncounter()}
          onConcludeScene={() => concludeScene(activeChatId)}
          onAbandonScene={() => abandonScene(activeChatId)}
          onForkScene={forkScene}
          isForkingScene={isForking || isStreaming}
          onOpenSettings={handleOpenSettingsPanel}
          onOpenGallery={handleOpenGalleryPanel}
          onCloseSettings={handleCloseSettingsPanel}
          onCloseGallery={handleCloseGalleryPanel}
          onOpenScheduleEditor={handleOpenScheduleEditor}
          onIllustrate={() => retryAgents(activeChatId, ["illustrator"])}
          onGenerateBackground={handleGenerateRoleplayBackground}
          onGenerateVideo={() => handleGenerateRoleplaySceneVideo()}
          onAnimateImage={(image) => handleGenerateRoleplaySceneVideo({ galleryImageId: image.id })}
          onWizardFinish={() => {
            setWizardOpen(false);
            handleOpenSettingsPanel();
          }}
          onClosePeekPrompt={() => setPeekPromptData(null)}
          onResetSpritePlacements={handleResetSpritePlacements}
          onSpriteSideChange={handleSetSpritePosition}
          onToggleSpriteArrange={() => setSpriteArrangeMode((prev) => !prev)}
          spriteVisualSettings={effectiveSpriteVisualSettings}
          onSpriteVisualSettingsChange={patchLocalSpriteVisualSettings}
          onExpressionChange={handleExpressionChange}
          onSpritePlacementChange={handleSpritePlacementChange}
          onFinishSpritePlacement={() => setSpriteArrangeMode(false)}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteSwipe={handleDeleteSwipe}
          onDeleteMore={handleDeleteMore}
          onCloseDeleteDialog={() => setDeleteDialogMessageId(null)}
          onBulkDelete={handleBulkDelete}
          onCancelMultiSelect={handleCancelMultiSelect}
          onUnselectAllMessages={handleUnselectAllMessages}
          onSelectAllAboveSelection={handleSelectAllAboveSelection}
          onSelectAllBelowSelection={handleSelectAllBelowSelection}
          isGrouped={isGrouped}
        />
      </Suspense>
      {agentInjectionReview && (
        <AgentInjectionReviewModal
          request={agentInjectionReview}
          drafts={agentInjectionDrafts}
          onDraftChange={(agentType, text) => setAgentInjectionDrafts((current) => ({ ...current, [agentType]: text }))}
          onContinue={handleContinueAgentInjectionReview}
          onClose={handleCloseAgentInjectionReview}
        />
      )}
      <ImagePromptReviewModal
        open={!!illustratorPromptReview}
        items={illustratorPromptReview ? [illustratorPromptReview.item] : []}
        isSubmitting={illustratorPromptReviewSubmitting}
        onCancel={handleCloseIllustratorPromptReview}
        onConfirm={(overrides) => void handleContinueIllustratorPromptReview(overrides)}
      />
      <ImagePromptReviewModal
        open={roleplayBackgroundReviewItems.length > 0}
        items={roleplayBackgroundReviewItems}
        isSubmitting={roleplayBackgroundReviewSubmitting}
        onCancel={() => closeRoleplayBackgroundPromptReview(null)}
        onConfirm={confirmRoleplayBackgroundPromptReview}
      />
      <ImagePromptReviewModal
        open={roleplayVideoReviewItems.length > 0}
        items={roleplayVideoReviewItems}
        isSubmitting={roleplayVideoReviewSubmitting}
        mediaType="video"
        onCancel={() => closeRoleplayVideoPromptReview(null)}
        onConfirm={confirmRoleplayVideoPromptReview}
      />
      {pendingNewChatMode && (
        <NewChatConnectionGate
          mode={pendingNewChatMode}
          onClose={() => useChatStore.getState().setPendingNewChatMode(null)}
        />
      )}
    </>
  );
}

function AgentInjectionReviewModal({
  request,
  drafts,
  onDraftChange,
  onContinue,
  onClose,
}: {
  request: AgentInjectionReviewRequest;
  drafts: Record<string, string>;
  onDraftChange: (agentType: string, text: string) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Writer Agent Review" width="max-w-3xl">
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          Edit the writer guidance before the main reply starts.
        </p>
        <div className="flex max-h-[55dvh] flex-col gap-2 overflow-y-auto pr-1">
          {request.injections.map((injection) => (
            <div key={injection.agentType} className="rounded-lg border border-[var(--border)] bg-[var(--card)]/60">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-[var(--foreground)]">{injection.agentName}</div>
                  <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{injection.agentType}</div>
                </div>
              </div>
              <textarea
                value={drafts[injection.agentType] ?? injection.text}
                onChange={(event) => onDraftChange(injection.agentType, event.target.value)}
                rows={6}
                className="min-h-32 w-full resize-y rounded-b-lg border-0 bg-[var(--secondary)]/35 px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
                spellCheck={false}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            <X size="0.875rem" />
            Close
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
          >
            <Check size="0.875rem" />
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
