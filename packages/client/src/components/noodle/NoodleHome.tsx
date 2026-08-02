// ──────────────────────────────────────────────
// Noodle: fake social media timeline
// ──────────────────────────────────────────────
import {
  AtSign,
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Crop,
  Dices,
  FileText,
  FolderOpen,
  Heart,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Smile,
  Trash2,
  X,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type RefObject,
} from "react";
import { toast } from "sonner";
import {
  noodleTextMentionsHandle as textMentionsHandle,
  noodlePollInputSchema,
  parseConnectionImageCaptioningDefaults,
  PROFESSOR_MARI_ID,
  readNoodlePollFromMetadata,
  type NoodleTextMention,
  type APIConnection,
  type NoodleAccount,
  type NoodleCarryoverTarget,
  type NoodleInteraction,
  type NoodleInteractionType,
  type NoodlePost,
  type NoodlePostImageCrop,
  type NoodlePollInput,
  type NoodleRefreshSchedulerStatus,
  type NoodleSettingsUpdateInput,
} from "@marinara-engine/shared";
import { ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { cn, parseAvatarCropJson, type AvatarCropValue } from "../../lib/utils";
import { useActivePersona, useCharacterGroups, useCharacters, usePersonas } from "../../hooks/use-characters";
import { useConnections } from "../../hooks/use-connections";
import { useNoodleCustomEmojiMap } from "../../hooks/use-noodle-custom-emojis";
import {
  usePromptOverride,
  usePromptOverrideDefault,
  useResetPromptOverride,
  useSavePromptOverride,
} from "../../hooks/use-prompt-overrides";
import { useUploadGlobalGalleryImages } from "../../hooks/use-global-gallery";
import type { ChatImage } from "../../hooks/use-gallery";
import { HelpTooltip } from "../ui/HelpTooltip";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTab,
  type ConversationMediaPickerTabId,
} from "../chat/ConversationMediaPickerPanel";
import { ChatImageLightbox } from "../chat/ChatImageLightbox";
import { ExpandedTextarea } from "../ui/ExpandedTextarea";
import { Modal } from "../ui/Modal";
import {
  ImagePromptReviewModal,
  type ImagePromptOverride,
  type ImagePromptReviewItem,
} from "../ui/ImagePromptReviewModal";
import {
  useConfirmNoodleImagePrompts,
  useClearNoodleInvites,
  useCreateNoodleInteraction,
  useCreateNoodlePost,
  useDeleteNoodleInteraction,
  useDeleteNoodlePost,
  useInviteNoodleCharacter,
  useInviteNoodleCharacters,
  useNoodle,
  useNoodlerAccounts,
  usePatchNoodleAccountSettings,
  useRefreshNoodle,
  useRemoveNoodleCharacter,
  useRemoveNoodleInteraction,
  useRescheduleNoodleRefresh,
  useResetNoodleTimeline,
  useUpdateNoodleAccountFollow,
  useUpdateNoodleAccountProfile,
  useUpdateNoodleInteraction,
  useUpdateNoodlePost,
  useUpdateNoodleSettings,
} from "../../hooks/use-noodle";
import { useUIStore } from "../../stores/ui.store";
import {
  Avatar,
  getNoodleAccentStyle,
  NoodleLogo,
  NoodleShell,
  NOODLE_BLUE,
  NOODLE_PINK,
  NOODLE_ICON_SCOPE_CLASS,
  NOODLE_PERSONA_SWITCHER_PAGE_SIZE,
} from "./NoodleShell";
import type { NoodleNavigationState, NoodleProfileConnection } from "./noodle-navigation.types";
import { NoodleProfileSurface } from "./NoodleProfileSurface";
import { NoodlerBulkCreateButton } from "./NoodlerBulkCreatePanel";
import { NoodlerScheduleManagerModal } from "./NoodlerScheduleManagerModal";
import { BrowserChrome, formatTime } from "./NoodleBrowserChrome";
import { NoodleImageComposer } from "./NoodleImageComposer";
import { NoodlePollComposer } from "./NoodlePollComposer";
import {
  insertAtSelection,
  NoodleAnchoredPopover,
  NoodleComposerShell,
  NoodleComposerToolRow,
  NoodleCustomEmojiText,
  NoodleMentionSuggestions,
  NoodlePostCard,
  type NoodlePostCardModel,
  type NoodlePostImageUpdate,
  noodleIconButtonClass,
  NoodleToolButton,
  useNoodlePostImageEditor,
} from "./NoodlePostCard";
import { PostImageCropEditor, PostImageFrame } from "./PostImageCropEditor";
import { useTranslation as useUiTranslation } from "react-i18next";

type RawCharacter = { id?: unknown; data?: unknown; avatarPath?: unknown };
type RawCharacterGroup = { id?: unknown; name?: unknown; description?: unknown; characterIds?: unknown };
type RawPersona = { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
type NoodleComposerImage = { url: string; crop: NoodlePostImageCrop | null };
type NoodlePendingComposerImage = { source: File | string; crop: NoodlePostImageCrop | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRawCharacter(value: unknown): value is RawCharacter {
  return isRecord(value);
}

function isRawCharacterGroup(value: unknown): value is RawCharacterGroup {
  return isRecord(value);
}

function isRawPersona(value: unknown): value is RawPersona {
  return isRecord(value);
}

function isConnection(value: unknown): value is Partial<APIConnection> {
  return isRecord(value);
}

const fieldClass =
  "mari-chrome-field h-9 w-full min-w-0 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const textareaClass =
  "mari-chrome-field min-h-24 w-full min-w-0 resize-y rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--noodle-accent)]";
const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";
const NOODLE_INVITE_PAGE_SIZE = 50;
const NOODLE_MENTION_SUGGESTION_LIMIT = 8;
const NOODLE_CARRYOVER_TARGETS: NoodleCarryoverTarget[] = ["conversation", "roleplay", "game"];
const NOODLE_TIMELINE_BASE_PROMPT_KEY = "noodle.timelineBase";
const NOODLE_MEDIA_PICKER_TABS: ConversationMediaPickerTab[] = [
  { id: "emoji", label: "Emoji" },
  { id: "gifs", label: "GIFs" },
  { id: "stickers", label: "Stickers" },
];

type ComposerTool = "image" | "poll" | "media";
type ReplyComposerTool = "image" | "media";
type ProfileTab = "posts" | "likes" | "media";
type ProfileConnectionTab = NoodleProfileConnection;
type NotificationTab = "likes" | "follows" | "replies";
type TimelineTab = "main" | "following";
type NoodleNotificationFocusTarget = {
  postId: string;
  interactionId: string | null;
};
type ActiveComposerMention = NoodleTextMention & { query: string };
type NoodleConfirmAction =
  | {
      kind: "delete-post";
      postId: string;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "reset-timeline";
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "uninvite-everybody";
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "delete-reply";
      postId: string;
      interactionId: string;
      title: string;
      message: string;
      confirmLabel: string;
    };

const TIMELINE_TABS: Array<{ id: TimelineTab; label: string }> = [
  { id: "main", label: "Main" },
  { id: "following", label: "Following" },
];

const PROFILE_CONNECTION_TABS: Array<{ id: ProfileConnectionTab; label: string }> = [
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const NOTIFICATION_TABS: Array<{ id: NotificationTab; label: string }> = [
  { id: "likes", label: "Likes" },
  { id: "follows", label: "Follows" },
  { id: "replies", label: "Replies" },
];

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? value : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

function carryoverTargetsFromLegacy(mode: string | undefined): NoodleCarryoverTarget[] {
  if (mode === "all") return [...NOODLE_CARRYOVER_TARGETS];
  if (mode === "conversation" || mode === "roleplay" || mode === "game") return [mode];
  return [];
}

function legacyCarryoverModeFromTargets(targets: NoodleCarryoverTarget[]): NoodleSettingsUpdateInput["carryoverMode"] {
  const selected = new Set(targets);
  if (NOODLE_CARRYOVER_TARGETS.every((target) => selected.has(target))) return "all";
  if (targets.length === 1) return targets[0]!;
  return "off";
}

function readAccountSetting(account: NoodleAccount | null, key: keyof NoodleAccount["settings"]["profile"]) {
  return readString(account?.settings.profile[key]).trim();
}

function readAccountSettingBoolean(account: NoodleAccount | null, key: keyof NoodleAccount["settings"]["profile"]) {
  const value = account?.settings.profile[key];
  return value === true || value === "true";
}

function hasGeneratedProfile(account: NoodleAccount | null) {
  return readAccountSettingBoolean(account, "profileGenerated");
}

function sortAccountsByDisplayName(left: NoodleAccount, right: NoodleAccount) {
  return left.displayName.localeCompare(right.displayName) || left.handle.localeCompare(right.handle);
}

function accountTimestamp(account: NoodleAccount) {
  return Date.parse(account.updatedAt || account.createdAt) || 0;
}

function uniqueAccountsById(accounts: Array<NoodleAccount | null | undefined>) {
  const seen = new Set<string>();
  const result: NoodleAccount[] = [];
  for (const account of accounts) {
    if (!account || seen.has(account.id)) continue;
    seen.add(account.id);
    result.push(account);
  }
  return result;
}

function extractAccountSearchTerm(query: string) {
  const match = query.match(/@([a-zA-Z0-9_.-]*)/);
  return match ? match[1]!.toLowerCase() : "";
}

/** Uninvited characters and ambient users keep their profile row but stay out of search until re-invited. */
function accountIsDiscoverable(account: NoodleAccount, folderInvitedCharacterIds: Set<string>, allowRandomUsers: boolean) {
  if (account.kind === "character") return account.invited || folderInvitedCharacterIds.has(account.entityId);
  if (account.kind === "random_user") return allowRandomUsers;
  return true;
}

function accountMatchesSearch(account: NoodleAccount, term: string) {
  if (!term) return true;
  return [account.handle, account.displayName, account.bio].some((value) => value.toLowerCase().includes(term));
}

function activeComposerMention(value: string, caret: number): ActiveComposerMention | null {
  const beforeCaret = value.slice(0, caret);
  const match = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]*)$/u.exec(beforeCaret);
  if (!match) return null;
  const query = match[2] ?? "";
  const start = caret - query.length - 1;
  return { handle: query.toLowerCase(), query: query.toLowerCase(), start, end: caret };
}

function matchingMentionAccounts(accounts: NoodleAccount[], activeMention: ActiveComposerMention | null) {
  if (!activeMention) return [];
  return accounts
    .filter((account) => account.handle.toLowerCase().startsWith(activeMention.query))
    .sort((left, right) => left.handle.localeCompare(right.handle))
    .slice(0, NOODLE_MENTION_SUGGESTION_LIMIT);
}

function characterName(character: RawCharacter) {
  const data = parseRecord(character.data);
  return readString(data.name).trim() || "Character";
}

function rawCharacterAvatarCrop(character: RawCharacter): AvatarCropValue | null {
  const raw = parseRecord(parseRecord(character.data).extensions).avatarCrop;
  if (typeof raw === "string") return parseAvatarCropJson(raw);
  try {
    return raw ? parseAvatarCropJson(JSON.stringify(raw)) : null;
  } catch {
    return null;
  }
}

function characterGroupName(group: RawCharacterGroup) {
  return readString(group.name).trim() || "Character folder";
}

function formatNoodleRefreshTime(value: string | null, timezone?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      ...(timezone && timezone !== "local" ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
}

function formatNoodleRefreshTimeInput(value: string, timezone?: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      ...(timezone && timezone !== "local" ? { timeZone: timezone } : {}),
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    return hour && minute ? `${hour}:${minute}` : "";
  } catch {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
}

function noodleSchedulerSummary(scheduler: NoodleRefreshSchedulerStatus) {
  if (scheduler.state === "disabled") return "Automatic refreshes are off.";
  if (scheduler.state === "completed") return "Today's automatic refreshes are complete.";
  if (scheduler.state === "retrying") {
    const retryTime = formatNoodleRefreshTime(scheduler.nextAttemptAt, scheduler.timezone);
    return retryTime ? `Waiting to retry at ${retryTime}.` : "Waiting to retry.";
  }
  if (scheduler.state === "due") return "An automatic refresh is due now.";
  const nextTime = formatNoodleRefreshTime(scheduler.nextRefreshAt, scheduler.timezone);
  return nextTime ? `Next automatic refresh at ${nextTime}.` : "Automatic refresh is scheduled.";
}

function MobileTimelineBackButton({ onClick }: { onClick: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 @min-[1024px]:hidden"
      title={localizeUi("ui.noodle.mobiletimelinebackbutton.backToTimeline")}
      aria-label={localizeUi("ui.noodle.mobiletimelinebackbutton.backToNoodleTimeline")}
    >
      <ChevronLeft size={22} />
    </button>
  );
}

function FieldLabel({ children, help }: { children: React.ReactNode; help?: React.ReactNode }) {
  return (
    <span className={cn(labelClass, "inline-flex items-center gap-1")}>
      {children}
      {help && <HelpTooltip text={help} side="top" wide />}
    </span>
  );
}

function Section({
  title,
  help,
  children,
  accent,
}: {
  title: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  /** Overrides `--noodle-accent` for this section, e.g. NoodleR's pink brand accent. */
  accent?: string;
}) {
  return (
    <section
      className="border-b border-[var(--noodle-divider)] p-4 last:border-b-0"
      style={accent ? ({ "--noodle-accent": accent } as CSSProperties) : undefined}
    >
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
        <Settings2 size={13} className="text-[var(--noodle-accent)]" />
        {title}
        {help && <HelpTooltip text={help} side="bottom" wide />}
      </h3>
      {children}
    </section>
  );
}

function ToggleSetting({
  label,
  help,
  checked,
  disabled,
  compact = false,
  onChange,
}: {
  label: string;
  help?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] py-2 text-xs",
        compact ? "gap-2 px-1.5" : "gap-3 px-3",
      )}
    >
      <span className={cn("inline-flex min-w-0 items-center gap-1 font-semibold", compact && "flex-1")}>
        <span className={cn(compact && "min-w-0 truncate text-[10px] leading-none")}>{label}</span>
        {help && <HelpTooltip text={help} side="top" wide />}
      </span>
      <input
        className="shrink-0"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

type NoodleHomeNavigation = Extract<NoodleNavigationState, { mode: "public" | "settings" }>;

interface NoodleHomeProps {
  navigation: NoodleHomeNavigation;
  onNavigate: (destination: NoodleNavigationState) => void;
}

export function NoodleHome({ navigation, onNavigate }: NoodleHomeProps) {
  const { t: localizeUi } = useUiTranslation();
  const selectedPersonaId = useUIStore((state) => state.noodleSelectedPersonaId) ?? "";
  const setSelectedPersonaId = useUIStore((state) => state.setNoodleSelectedPersonaId);
  const { data, isLoading, isError } = useNoodle();
  const noodlerAccountsQuery = useNoodlerAccounts(data?.settings.enableNoodler === true);
  const noodlerCreators = noodlerAccountsQuery.data ?? [];
  const noodlerCreatorCount = noodlerCreators.length;
  const noodlerAutomatingCount = noodlerCreators.filter((profile) => profile.autoPosting.enabled).length;
  const noodlerScheduleSummary =
    noodlerCreatorCount === 0
      ? "No managed creators yet. Create a stage profile to schedule automatic posts."
      : `${noodlerCreatorCount} creator${noodlerCreatorCount === 1 ? "" : "s"} · ${noodlerAutomatingCount} automating`;
  const { data: activePersona } = useActivePersona();
  const { data: personasRaw } = usePersonas();
  const { data: charactersRaw } = useCharacters();
  const { data: characterGroupsRaw } = useCharacterGroups();
  const { data: connectionsRaw } = useConnections();
  const updateSettings = useUpdateNoodleSettings();
  const updateAccountFollow = useUpdateNoodleAccountFollow();
  const updateAccountProfile = useUpdateNoodleAccountProfile();
  const patchAccountSettings = usePatchNoodleAccountSettings();
  const inviteCharacter = useInviteNoodleCharacter();
  const inviteCharacters = useInviteNoodleCharacters();
  const clearInvites = useClearNoodleInvites();
  const removeCharacter = useRemoveNoodleCharacter();
  const createPost = useCreateNoodlePost();
  const updatePost = useUpdateNoodlePost();
  const deletePost = useDeleteNoodlePost();
  const createInteraction = useCreateNoodleInteraction();
  const removeInteraction = useRemoveNoodleInteraction();
  const updateInteraction = useUpdateNoodleInteraction();
  const deleteInteraction = useDeleteNoodleInteraction();
  const rescheduleRefresh = useRescheduleNoodleRefresh();
  const refreshNoodle = useRefreshNoodle();
  const confirmNoodleImagePrompts = useConfirmNoodleImagePrompts();
  const resetNoodleTimeline = useResetNoodleTimeline();
  const noodlePromptDetail = usePromptOverride(NOODLE_TIMELINE_BASE_PROMPT_KEY);
  const noodlePromptDefault = usePromptOverrideDefault(NOODLE_TIMELINE_BASE_PROMPT_KEY);
  const saveNoodlePrompt = useSavePromptOverride();
  const resetNoodlePrompt = useResetPromptOverride();
  const uploadGlobalImages = useUploadGlobalGalleryImages();
  const prefersReducedMotion = useReducedMotion();
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const inlineComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const modalComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const replyComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerValueRef = useRef("");
  const composerHasTextRef = useRef(false);
  const replyValueRef = useRef("");
  const replyHasTextRef = useRef(false);
  const replyImageFileRef = useRef<HTMLInputElement | null>(null);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const bannerFileRef = useRef<HTMLInputElement | null>(null);
  const imageToolRef = useRef<HTMLDivElement | null>(null);
  const pollToolRef = useRef<HTMLDivElement | null>(null);
  const mediaToolRef = useRef<HTMLDivElement | null>(null);
  const modalImageToolRef = useRef<HTMLDivElement | null>(null);
  const modalPollToolRef = useRef<HTMLDivElement | null>(null);
  const modalMediaToolRef = useRef<HTMLDivElement | null>(null);
  const replyImageToolRef = useRef<HTMLDivElement | null>(null);
  const replyMediaToolRef = useRef<HTMLDivElement | null>(null);
  const accountSwitcherRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const composerRestoreFocusRef = useRef<HTMLElement | null>(null);
  const profileDraftAccountIdRef = useRef<string | null>(null);
  const notificationReadEntryRef = useRef<string | null>(null);

  const characters = useMemo(
    () => (Array.isArray(charactersRaw) ? charactersRaw.filter(isRawCharacter) : []),
    [charactersRaw],
  );
  const personas = useMemo(() => (Array.isArray(personasRaw) ? personasRaw.filter(isRawPersona) : null), [personasRaw]);
  const characterGroups = useMemo(
    () => (Array.isArray(characterGroupsRaw) ? characterGroupsRaw.filter(isRawCharacterGroup) : []),
    [characterGroupsRaw],
  );
  const allConnections = useMemo(
    () => (Array.isArray(connectionsRaw) ? connectionsRaw.filter(isConnection) : []),
    [connectionsRaw],
  );
  const connections = useMemo(
    () =>
      allConnections.filter(
        (connection) => connection.provider !== "image_generation" && connection.provider !== "video_generation",
      ),
    [allConnections],
  );
  const imageConnections = useMemo(
    () => allConnections.filter((connection) => connection.provider === "image_generation"),
    [allConnections],
  );

  const [composer, setComposer] = useState("");
  const [composerHasText, setComposerHasText] = useState(false);
  const [activeMention, setActiveMention] = useState<ActiveComposerMention | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [postSearch, setPostSearch] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileBannerUrl, setProfileBannerUrl] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileUploadTarget, setProfileUploadTarget] = useState<"avatar" | "banner" | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("posts");
  const [notificationTab, setNotificationTab] = useState<NotificationTab>("likes");
  const [timelineTab, setTimelineTab] = useState<TimelineTab>("main");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteFoldersOpen, setInviteFoldersOpen] = useState(false);
  const [inviteCharacterLimit, setInviteCharacterLimit] = useState(NOODLE_INVITE_PAGE_SIZE);
  const [replyPostId, setReplyPostId] = useState<string | null>(null);
  const [replyParentInteractionId, setReplyParentInteractionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyHasText, setReplyHasText] = useState(false);
  const [activeReplyMention, setActiveReplyMention] = useState<ActiveComposerMention | null>(null);
  const [activeReplyMentionIndex, setActiveReplyMentionIndex] = useState(0);
  const [replyImageUrl, setReplyImageUrl] = useState("");
  const [replyImageUrlDraft, setReplyImageUrlDraft] = useState("");
  const [activeReplyComposerTool, setActiveReplyComposerTool] = useState<ReplyComposerTool | null>(null);
  const [imageLightbox, setImageLightbox] = useState<ChatImage | null>(null);
  const [notificationFocusTarget, setNotificationFocusTarget] = useState<NoodleNotificationFocusTarget | null>(null);
  const [highlightedInteractionId, setHighlightedInteractionId] = useState<string | null>(null);
  const [notificationReadOverrides, setNotificationReadOverrides] = useState<Record<string, string>>({});
  const [editingRefreshTime, setEditingRefreshTime] = useState<string | null>(null);
  const [refreshTimeDraft, setRefreshTimeDraft] = useState("");
  const [imagePromptReviewItems, setImagePromptReviewItems] = useState<ImagePromptReviewItem[]>([]);
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [editingPostPoll, setEditingPostPoll] = useState<NoodlePollInput | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyContent, setEditingReplyContent] = useState("");
  const [confirmAction, setConfirmAction] = useState<NoodleConfirmAction | null>(null);
  const [noodlePromptEditorOpen, setNoodlePromptEditorOpen] = useState(false);
  const [noodlePromptDraft, setNoodlePromptDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileAccountSwitcherOpen, setMobileAccountSwitcherOpen] = useState(false);
  const [personaAccountLimit, setPersonaAccountLimit] = useState(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  const [activeComposerTool, setActiveComposerTool] = useState<ComposerTool | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<ConversationMediaPickerTabId>("emoji");
  const [attachedImage, setAttachedImage] = useState<NoodleComposerImage | null>(null);
  const [pendingImage, setPendingImage] = useState<NoodlePendingComposerImage | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [imageGenerationPromptDraft, setImageGenerationPromptDraft] = useState("");
  const [pollEditorValue, setPollEditorValue] = useState<NoodlePollInput | null>(null);
  const [noodlerGenerationGuidanceDraft, setNoodlerGenerationGuidanceDraft] = useState("");
  const [scheduleManagerOpen, setScheduleManagerOpen] = useState(false);
  const [draftPoll, setDraftPoll] = useState<NoodlePollInput | null>(null);
  const postImageEditor = useNoodlePostImageEditor(async (post) => {
    if (!post.imageUrl) throw new Error("This post does not have an image.");
    return post.imageUrl;
  });

  const activeNoodleView = navigation.mode === "public" ? navigation.view : navigation.mode;
  const viewedProfileAccountId =
    navigation.mode === "public" && navigation.view === "profile" ? navigation.accountId : null;
  const profileConnectionTab =
    navigation.mode === "public" && navigation.view === "profile" ? navigation.connection : null;

  const noodlePromptOverride = noodlePromptDetail.data?.override ?? null;
  const noodleDefaultPromptText = noodlePromptDefault.data?.template ?? "";
  const noodlePromptText =
    noodlePromptOverride?.enabled === true ? noodlePromptOverride.template : noodleDefaultPromptText;
  const noodlePromptHasOverride = noodlePromptOverride?.enabled === true;
  const noodlePromptLoading = noodlePromptDetail.isLoading || noodlePromptDefault.isLoading;
  const noodlePromptDirty = noodlePromptDraft !== noodlePromptText;
  const settings = data?.settings;
  const noodleGenerationConnection = settings?.generationConnectionId
    ? connections.find((connection) => connection.id === settings.generationConnectionId)
    : null;
  const noodleImageCaptioningDefaults = parseConnectionImageCaptioningDefaults(
    noodleGenerationConnection?.defaultParameters,
  );
  const effectiveImageCaptioningEnabled =
    settings?.imageCaptioningUseConnectionDefault === false
      ? settings.imageCaptioningEnabled
      : noodleImageCaptioningDefaults.imageCaptioningEnabled === true;
  const effectiveImageCaptioningConnectionId =
    settings?.imageCaptioningUseConnectionDefault === false
      ? settings.imageCaptioningConnectionId
      : (noodleImageCaptioningDefaults.imageCaptioningConnectionId ?? null);
  const accounts = useMemo(
    () =>
      (data?.accounts ?? []).filter(
        (account) =>
          (settings?.allowProfessorMari ?? true) ||
          account.kind !== "character" ||
          account.entityId !== PROFESSOR_MARI_ID,
      ),
    [data?.accounts, settings?.allowProfessorMari],
  );
  const livePersonaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const persona of personas ?? []) {
      const id = readString(persona.id);
      if (id) ids.add(id);
    }
    return ids;
  }, [personas]);
  const personaRecencyById = useMemo(() => {
    const recency = new Map<string, number>();
    for (const persona of personas ?? []) {
      const id = readString(persona.id);
      if (!id) continue;
      recency.set(id, Date.parse(readString(persona.updatedAt) || readString(persona.createdAt)) || 0);
    }
    return recency;
  }, [personas]);
  const personaAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.kind === "persona" && (personas === null || livePersonaIds.has(account.entityId)),
      ),
    [accounts, livePersonaIds, personas],
  );
  const sortedPersonaAccounts = useMemo(
    () =>
      personaAccounts.slice().sort((left, right) => {
        const leftRecency = personaRecencyById.get(left.entityId) ?? accountTimestamp(left);
        const rightRecency = personaRecencyById.get(right.entityId) ?? accountTimestamp(right);
        return rightRecency - leftRecency || sortAccountsByDisplayName(left, right);
      }),
    [personaAccounts, personaRecencyById],
  );
  const visiblePersonaAccounts = useMemo(
    () => sortedPersonaAccounts.slice(0, personaAccountLimit),
    [personaAccountLimit, sortedPersonaAccounts],
  );
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const interactions = useMemo(() => data?.interactions ?? [], [data?.interactions]);
  const interactionsByPostId = useMemo(() => {
    const grouped = new Map<string, NoodleInteraction[]>();
    for (const interaction of interactions) {
      const postInteractions = grouped.get(interaction.postId) ?? [];
      postInteractions.push(interaction);
      grouped.set(interaction.postId, postInteractions);
    }
    return grouped;
  }, [interactions]);
  const scheduler = data?.scheduler;
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const accountByHandle = useMemo(
    () => new Map(accounts.map((account) => [account.handle.toLowerCase(), account])),
    [accounts],
  );
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const interactionById = useMemo(
    () => new Map(interactions.map((interaction) => [interaction.id, interaction])),
    [interactions],
  );
  const characterAccountByEntity = useMemo(
    () =>
      new Map(accounts.filter((account) => account.kind === "character").map((account) => [account.entityId, account])),
    [accounts],
  );
  const directlyInvitedCharacterIds = useMemo(
    () =>
      (data?.accounts ?? [])
        .filter((account) => account.kind === "character" && account.invited)
        .map((account) => account.entityId),
    [data?.accounts],
  );
  const personaAccount = useMemo(
    () => personaAccounts.find((account) => account.entityId === selectedPersonaId) ?? sortedPersonaAccounts[0] ?? null,
    [personaAccounts, selectedPersonaId, sortedPersonaAccounts],
  );
  const viewedProfileAccount = useMemo(
    () => (viewedProfileAccountId ? (accountById.get(viewedProfileAccountId) ?? null) : personaAccount),
    [accountById, personaAccount, viewedProfileAccountId],
  );
  const noodleCustomEmojiMap = useNoodleCustomEmojiMap(viewedProfileAccount);
  const viewingOwnProfile = Boolean(personaAccount && viewedProfileAccount?.id === personaAccount.id);
  const linkedNoodleAccountIds = useMemo(
    () => new Set((noodlerAccountsQuery.data ?? []).flatMap((profile) => profile.noodleAccountId ?? [])),
    [noodlerAccountsQuery.data],
  );
  const canCreateStageProfileFromViewed = Boolean(
    settings?.enableNoodler &&
      viewedProfileAccount &&
      (viewedProfileAccount.kind === "persona" || viewedProfileAccount.kind === "character") &&
      noodlerAccountsQuery.isSuccess &&
      !linkedNoodleAccountIds.has(viewedProfileAccount.id),
  );
  const canEditViewedProfile = Boolean(
    viewingOwnProfile || (viewedProfileAccount?.kind === "character" && viewedProfileAccount.invited),
  );

  useEffect(() => {
    if (activeNoodleView !== "notifications" || !personaAccount) {
      notificationReadEntryRef.current = null;
      return;
    }

    const accountId = personaAccount.id;
    if (notificationReadEntryRef.current === accountId) return;
    notificationReadEntryRef.current = accountId;

    const previousOverride = notificationReadOverrides[accountId];
    const readAt = new Date().toISOString();
    setNotificationReadOverrides((current) => ({ ...current, [accountId]: readAt }));
    void patchAccountSettings
      .mutateAsync({
        id: accountId,
        subtree: "social",
        patch: { notificationsReadAt: readAt },
      })
      .then(() => {
        setNotificationReadOverrides((current) => {
          if (current[accountId] !== readAt) return current;
          const next = { ...current };
          delete next[accountId];
          return next;
        });
      })
      .catch((error: unknown) => {
        setNotificationReadOverrides((current) => {
          if (current[accountId] !== readAt) return current;
          const next = { ...current };
          if (previousOverride) next[accountId] = previousOverride;
          else delete next[accountId];
          return next;
        });
        toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotMarkNoodleNotificationsAsRead"));
      });
  }, [activeNoodleView, localizeUi, notificationReadOverrides, patchAccountSettings, personaAccount]);

  useEffect(() => {
    if (navigation.mode !== "public" || navigation.view !== "profile" || !viewedProfileAccountId) return;
    if (isLoading || !data || isError || accountById.has(viewedProfileAccountId)) return;
    onNavigate({ mode: "public", view: "home" });
  }, [accountById, data, isError, isLoading, navigation, onNavigate, viewedProfileAccountId]);

  useEffect(() => {
    // Do not erase the persisted choice while the account/persona queries are
    // still empty during initial hydration.
    if (!data || personas === null) return;
    if (selectedPersonaId && personaAccounts.some((account) => account.entityId === selectedPersonaId)) return;
    const activeId = readString(activePersona?.id);
    const activeAccount = personaAccounts.find((account) => account.entityId === activeId);
    const nextPersonaId = activeAccount?.entityId ?? sortedPersonaAccounts[0]?.entityId ?? "";
    if (selectedPersonaId !== nextPersonaId) setSelectedPersonaId(nextPersonaId);
  }, [activePersona, data, personaAccounts, personas, selectedPersonaId, setSelectedPersonaId, sortedPersonaAccounts]);

  useEffect(() => {
    if (accountSwitcherOpen) setPersonaAccountLimit(NOODLE_PERSONA_SWITCHER_PAGE_SIZE);
  }, [accountSwitcherOpen]);

  useEffect(() => {
    if (!mobileDrawerOpen) {
      setMobileAccountSwitcherOpen(false);
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileDrawerOpen]);

  useEffect(() => {
    setImageGenerationPromptDraft(settings?.imageGenerationPrompt ?? "");
  }, [settings?.imageGenerationPrompt]);

  useEffect(() => {
    setNoodlerGenerationGuidanceDraft(settings?.noodlerGenerationGuidance ?? "");
  }, [settings?.noodlerGenerationGuidance]);

  useEffect(() => {
    if (!noodlePromptEditorOpen) setNoodlePromptDraft(noodlePromptText);
  }, [noodlePromptEditorOpen, noodlePromptText]);

  useEffect(() => {
    const accountId = viewedProfileAccount?.id ?? null;
    const identityChanged = profileDraftAccountIdRef.current !== accountId;
    profileDraftAccountIdRef.current = accountId;
    if (!viewedProfileAccount) return;

    if (identityChanged || !profileEditing) {
      setProfileHandle(viewedProfileAccount.handle);
      setProfileName(viewedProfileAccount.displayName);
      setProfileBio(viewedProfileAccount.bio);
      setProfileLocation(readAccountSetting(viewedProfileAccount, "location"));
      setProfileEditing(false);
    }
    setProfileAvatarUrl(viewedProfileAccount.avatarUrl ?? "");
    setProfileBannerUrl(readAccountSetting(viewedProfileAccount, "bannerUrl"));
  }, [profileEditing, viewedProfileAccount]);

  useEffect(() => {
    setInviteCharacterLimit(NOODLE_INVITE_PAGE_SIZE);
  }, [inviteSearch]);

  useEffect(() => {
    if (!editingRefreshTime || scheduler?.scheduledTimes.includes(editingRefreshTime)) return;
    setEditingRefreshTime(null);
    setRefreshTimeDraft("");
  }, [editingRefreshTime, scheduler?.scheduledTimes]);

  const saveSettings = (patch: NoodleSettingsUpdateInput) => {
    updateSettings.mutate(patch, {
      onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodleSettings")),
    });
  };

  const openNoodlePromptEditor = () => {
    if (!noodlePromptText) {
      toast.error(localizeUi("ui.noodle.noodlehome.theDefaultNoodlePromptIsStillLoading"));
      return;
    }
    setNoodlePromptDraft(noodlePromptText);
    setNoodlePromptEditorOpen(true);
  };

  const closeNoodlePromptEditor = () => {
    setNoodlePromptDraft(noodlePromptText);
    setNoodlePromptEditorOpen(false);
  };

  const saveNoodlePromptDraft = async () => {
    if (!noodlePromptDraft.trim()) {
      toast.error(localizeUi("ui.noodle.noodlehome.theNoodlePromptCannotBeEmpty"));
      return;
    }
    try {
      await saveNoodlePrompt.mutateAsync({
        key: NOODLE_TIMELINE_BASE_PROMPT_KEY,
        template: noodlePromptDraft,
        enabled: true,
      });
      setNoodlePromptEditorOpen(false);
      toast.success(localizeUi("ui.noodle.noodlehome.noodlePromptSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotSaveTheNoodlePrompt"));
    }
  };

  const restoreDefaultNoodlePrompt = async () => {
    if (!noodlePromptHasOverride) {
      setNoodlePromptDraft(noodleDefaultPromptText);
      return;
    }
    try {
      await resetNoodlePrompt.mutateAsync(NOODLE_TIMELINE_BASE_PROMPT_KEY);
      setNoodlePromptDraft(noodleDefaultPromptText);
      toast.success(localizeUi("ui.noodle.noodlehome.defaultNoodlePromptRestored"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotRestoreTheDefaultNoodlePrompt"));
    }
  };

  const beginRefreshTimeEdit = (scheduledTime: string) => {
    setEditingRefreshTime(scheduledTime);
    setRefreshTimeDraft(formatNoodleRefreshTimeInput(scheduledTime, scheduler?.timezone));
  };

  const cancelRefreshTimeEdit = () => {
    setEditingRefreshTime(null);
    setRefreshTimeDraft("");
  };

  const saveRefreshTimeEdit = () => {
    if (!editingRefreshTime || !refreshTimeDraft) return;
    rescheduleRefresh.mutate(
      { scheduledTime: editingRefreshTime, time: refreshTimeDraft },
      {
        onSuccess: () => {
          cancelRefreshTimeEdit();
          toast.success(localizeUi("ui.noodle.noodlehome.automaticRefreshRescheduled"));
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotRescheduleRefresh")),
      },
    );
  };

  const saveProfile = () => {
    if (!viewedProfileAccount || !canEditViewedProfile) return;
    const normalizedHandle = profileHandle.trim().replace(/^@+/, "");
    const nextAvatarUrl = profileAvatarUrl.trim() || null;
    updateAccountProfile.mutate(
      {
        id: viewedProfileAccount.id,
        handle: normalizedHandle,
        displayName: profileName.trim(),
        bio: profileBio,
        ...(nextAvatarUrl !== viewedProfileAccount.avatarUrl ? { avatarUrl: nextAvatarUrl } : {}),
        profile: { bannerUrl: profileBannerUrl.trim(), location: profileLocation.trim() },
      },
      {
        onSuccess: () => {
          setProfileEditing(false);
          toast.success(localizeUi("ui.noodle.noodlehome.noodleProfileUpdated"));
        },
        onError: (error) => {
          const payload =
            error instanceof ApiError && error.payload && typeof error.payload === "object"
              ? (error.payload as { code?: unknown })
              : null;
          toast.error(
            payload?.code === "NOODLE_HANDLE_TAKEN"
              ? localizeUi("ui.noodle.noodlehome.handleAlreadyInUse")
              : error instanceof Error
                ? error.message
                : localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodleProfile"),
          );
        },
      },
    );
  };

  const handleProfileImageFile = (target: "avatar" | "banner", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProfileUploadTarget(target);
    uploadGlobalImages.mutate(
      { files: [file] },
      {
        onSuccess: (images) => {
          const image = images[0];
          if (!image?.url) {
            toast.error(localizeUi("ui.noodle.noodlehome.imageUploadedButNoUrlWasReturned"));
            return;
          }
          if (target === "avatar") setProfileAvatarUrl(image.url);
          else setProfileBannerUrl(image.url);

          if (!viewedProfileAccount || !canEditViewedProfile) return;
          const callbacks = {
            onSuccess: () => toast.success(target === "avatar" ?localizeUi("ui.noodle.noodlehome.noodleAvatarUpdated") :localizeUi("ui.noodle.noodlehome.noodleBannerUpdated")),
            onError: (error: Error) => toast.error(error.message ||localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodleProfileImage")),
          };
          if (target === "avatar") {
            updateAccountProfile.mutate({ id: viewedProfileAccount.id, avatarUrl: image.url, profile: {} }, callbacks);
          } else {
            updateAccountProfile.mutate({ id: viewedProfileAccount.id, profile: { bannerUrl: image.url } }, callbacks);
          }
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUploadProfileImage")),
        onSettled: () => setProfileUploadTarget(null),
      },
    );
  };

  const appendToComposer = (text: string) => {
    const textarea = composeOpen ? modalComposerRef.current : inlineComposerRef.current;
    const source = textarea?.value ?? composerValueRef.current;
    const inserted = insertAtSelection(
      source,
      text,
      textarea?.selectionStart ?? source.length,
      textarea?.selectionEnd ?? textarea?.selectionStart ?? source.length,
    );
    composerValueRef.current = inserted.value;
    const hasText = Boolean(inserted.value.trim());
    composerHasTextRef.current = hasText;
    setComposerHasText(hasText);
    setComposer(inserted.value);
    if (textarea) textarea.value = inserted.value;
    setActiveMention(null);
    setActiveMentionIndex(0);
    window.requestAnimationFrame(() => {
      const activeTextarea = composeOpen ? modalComposerRef.current : inlineComposerRef.current;
      activeTextarea?.focus();
      activeTextarea?.setSelectionRange(inserted.caret, inserted.caret);
    });
  };

  const applyImageUrl = () => {
    const url = imageUrlDraft.trim();
    if (!url) {
      toast.error(localizeUi("ui.noodle.noodlehome.pasteAnImageUrlFirst"));
      return;
    }
    setImageUrlDraft("");
    setActiveComposerTool(null);
    setPendingImage({ source: url, crop: null });
  };

  const handleImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(localizeUi("ui.noodle.noodlehome.chooseAnImageFile"));
            return;
          }
          setActiveComposerTool(null);
    setPendingImage({ source: file, crop: null });
  };

  const applyComposerImageCrop = async (crop: NoodlePostImageCrop) => {
    if (!pendingImage) return;
    let imageUrl: string;
    if (pendingImage.source instanceof File) {
      const images = await uploadGlobalImages.mutateAsync({ files: [pendingImage.source] });
      const uploaded = images[0];
      if (!uploaded?.url) throw new Error("Image uploaded, but no URL was returned.");
      imageUrl = uploaded.url;
    } else {
      imageUrl = pendingImage.source;
    }
    setAttachedImage({ url: imageUrl, crop });
    setPendingImage(null);
  };

  const removeComposerImage = () => {
    setPendingImage(null);
    setAttachedImage(null);
  };

  const appendToReply = (text: string) => {
    const textarea = replyComposerRef.current;
    const source = textarea?.value ?? replyValueRef.current;
    const inserted = insertAtSelection(
      source,
      text,
      textarea?.selectionStart ?? source.length,
      textarea?.selectionEnd ?? textarea?.selectionStart ?? source.length,
    );
    replyValueRef.current = inserted.value;
    const hasText = Boolean(inserted.value.trim());
    replyHasTextRef.current = hasText;
    setReplyHasText(hasText);
    setReplyText(inserted.value);
    if (textarea) textarea.value = inserted.value;
    setActiveReplyMention(null);
    setActiveReplyMentionIndex(0);
    window.requestAnimationFrame(() => {
      replyComposerRef.current?.focus();
      replyComposerRef.current?.setSelectionRange(inserted.caret, inserted.caret);
    });
  };

  const applyReplyImageUrl = () => {
    const url = replyImageUrlDraft.trim();
    if (!url) {
      toast.error(localizeUi("ui.noodle.noodlehome.pasteAnImageUrlFirst"));
      return;
    }
    setReplyImageUrl(url);
    setReplyImageUrlDraft("");
    setActiveReplyComposerTool(null);
  };

  const handleReplyImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    uploadGlobalImages.mutate(
      { files: [file] },
      {
        onSuccess: (images) => {
          const image = images[0];
          if (!image?.url) {
            toast.error(localizeUi("ui.noodle.noodlehome.imageUploadedButNoUrlWasReturned"));
            return;
          }
          setReplyImageUrl(image.url);
          setActiveReplyComposerTool(null);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotAttachImage")),
      },
    );
  };

  const clearReplyComposer = () => {
    setReplyPostId(null);
    setReplyParentInteractionId(null);
    setReplyText("");
    replyValueRef.current = "";
    replyHasTextRef.current = false;
    setReplyHasText(false);
    if (replyComposerRef.current) replyComposerRef.current.value = "";
    setActiveReplyMention(null);
    setActiveReplyMentionIndex(0);
    setReplyImageUrl("");
    setReplyImageUrlDraft("");
    setActiveReplyComposerTool(null);
  };

  const switchPersona = (account: NoodleAccount, mobile: boolean) => {
    composerValueRef.current = "";
    composerHasTextRef.current = false;
    setComposer("");
    if (inlineComposerRef.current) inlineComposerRef.current.value = "";
    if (modalComposerRef.current) modalComposerRef.current.value = "";
    setComposerHasText(false);
    setActiveMention(null);
    setActiveMentionIndex(0);
    setAttachedImage(null);
    setPendingImage(null);
    setImageUrlDraft("");
    setDraftPoll(null);
    setPollEditorValue(null);
    setActiveComposerTool(null);
    setComposeOpen(false);
    clearReplyComposer();
    setSelectedPersonaId(account.entityId);
    setProfileEditing(false);
    setProfileTab("posts");
    onNavigate({ mode: "public", view: "home" });
    setAccountSwitcherOpen(false);
    if (mobile) {
      setMobileAccountSwitcherOpen(false);
      setMobileDrawerOpen(false);
    }
  };

  const openReplyComposer = (postId: string, parentInteractionId: string | null = null) => {
    if (replyPostId === postId && replyParentInteractionId === parentInteractionId) {
      clearReplyComposer();
      return;
    }
    setReplyPostId(postId);
    setReplyParentInteractionId(parentInteractionId);
    setReplyText("");
    replyValueRef.current = "";
    replyHasTextRef.current = false;
    setReplyHasText(false);
    setActiveReplyMention(null);
    setActiveReplyMentionIndex(0);
    setReplyImageUrl("");
    setReplyImageUrlDraft("");
    setActiveReplyComposerTool(null);
    setActiveComposerTool(null);
  };

  const applyPoll = () => {
    const parsed = noodlePollInputSchema.safeParse(pollEditorValue);
    if (!parsed.success) {
      toast.error(localizeUi("ui.noodle.noodlehome.pollsNeedAQuestionAndTwoUniqueAnswers"));
      return;
    }
    setDraftPoll(parsed.data);
    setPollEditorValue(null);
    setActiveComposerTool(null);
  };

  const togglePollComposer = () => {
    if (activeComposerTool === "poll") {
      setPollEditorValue(null);
      setActiveComposerTool(null);
      return;
    }
    setPollEditorValue(draftPoll ?? { question: "", options: ["", ""] });
    setActiveComposerTool("poll");
  };

  const renderDraftPoll = () =>
    draftPoll ? (
      <section
        className="mb-3 rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/5 p-3"
        aria-label={localizeUi("ui.noodle.noodlehome.draftPollValue1", { value1: draftPoll.question })}
        data-component="NoodleView.DraftPoll"
      >
        <div className="flex items-start gap-2">
          <ListChecks size={16} className="mt-0.5 shrink-0 text-[var(--noodle-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-5">{draftPoll.question}</p>
            <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted-foreground)]">
              {draftPoll.options.map((option) => (
                <li key={option} className="truncate">
                  {option}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={togglePollComposer}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
            title={localizeUi("ui.noodle.noodlehome.editPoll")}
            aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => setDraftPoll(null)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
            title={localizeUi("ui.noodle.noodlehome.removePoll")}
            aria-label={localizeUi("ui.noodle.noodlehome.removeDraftPoll")}
          >
            <X size={14} />
          </button>
        </div>
      </section>
    ) : null;

  const renderDraftImage = (maxHeight: number) =>
    pendingImage ? (
      <PostImageCropEditor
        source={pendingImage.source}
        crop={pendingImage.crop}
        disabled={uploadGlobalImages.isPending}
        onCancel={() => setPendingImage(null)}
        onApply={applyComposerImageCrop}
      />
    ) : attachedImage ? (
      <section className="relative mb-3 overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 p-2">
        <PostImageFrame
          src={attachedImage.url}
          crop={attachedImage.crop}
          alt={localizeUi("ui.noodle.noodlehome.attachedPostImage")}
          maxHeight={maxHeight}
        />
        <div className="absolute right-4 top-4 flex items-center gap-0.5 rounded-full bg-[var(--background)] p-1 shadow-lg ring-1 ring-[var(--noodle-divider)]">
          <button
            type="button"
            onClick={() => setPendingImage({ source: attachedImage.url, crop: attachedImage.crop })}
            title={localizeUi("ui.noodle.noodlehome.adjustCrop")}
            aria-label={localizeUi("ui.noodle.noodlehome.adjustImageCrop")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
          >
            <Crop size={15} />
          </button>
          <button
            type="button"
            onClick={removeComposerImage}
            title={localizeUi("ui.noodle.noodlehome.removeImage")}
            aria-label={localizeUi("ui.noodle.noodlehome.removeAttachedImage")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </section>
    ) : null;

  const canSubmitPost = Boolean(
    personaAccount &&
    !pendingImage &&
    !uploadGlobalImages.isPending &&
    (composerHasText || attachedImage || draftPoll),
  );
  const confirmActionPending =
    confirmAction?.kind === "delete-post"
      ? deletePost.isPending
      : confirmAction?.kind === "delete-reply"
        ? deleteInteraction.isPending
        : confirmAction?.kind === "reset-timeline"
          ? resetNoodleTimeline.isPending
          : confirmAction?.kind === "uninvite-everybody"
            ? clearInvites.isPending
          : false;
  const normalizedProfileHandle = profileHandle.trim().replace(/^@+/, "");
  const isEditingProfile = canEditViewedProfile && profileEditing;
  const profileDisplayName = canEditViewedProfile
    ? profileName.trim() || viewedProfileAccount?.displayName || "Noodle Account"
    : viewedProfileAccount?.displayName || "Noodle Account";
  const profileDisplayHandle = canEditViewedProfile
    ? normalizedProfileHandle
    : (viewedProfileAccount?.handle ?? "noodle");
  const profileBioPreview = canEditViewedProfile ? profileBio.trim() : (viewedProfileAccount?.bio.trim() ?? "");
  const profileAvatarPreview = canEditViewedProfile
    ? profileAvatarUrl.trim() || null
    : (viewedProfileAccount?.avatarUrl ?? null);
  const profileAvatarCropPreview =
    viewedProfileAccount && profileAvatarPreview === viewedProfileAccount.avatarUrl
      ? viewedProfileAccount.avatarCrop
      : null;
  const profilePreviewAccount = {
    displayName: profileDisplayName,
    avatarUrl: profileAvatarPreview,
    avatarCrop: profileAvatarCropPreview,
  };
  const profileBannerPreview = canEditViewedProfile
    ? profileBannerUrl.trim()
    : readAccountSetting(viewedProfileAccount, "bannerUrl");
  const profileLocationPreview = canEditViewedProfile
    ? profileLocation.trim()
    : readAccountSetting(viewedProfileAccount, "location");
  const canSaveProfile = Boolean(canEditViewedProfile && profileName.trim() && normalizedProfileHandle);
  const rawPostSearch = postSearch.trim();
  const normalizedPostSearch = rawPostSearch.toLowerCase();
  const isAccountSearch = rawPostSearch.includes("@");
  const accountSearchTerm = extractAccountSearchTerm(rawPostSearch);
  const selectedCharacterGroupIds = useMemo(
    () => new Set(settings?.invitedCharacterGroupIds ?? []),
    [settings?.invitedCharacterGroupIds],
  );
  const folderInvitedCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of characterGroups) {
      const groupId = readString(group.id);
      if (!groupId || !selectedCharacterGroupIds.has(groupId)) continue;
      for (const characterId of readStringArray(group.characterIds)) ids.add(characterId);
    }
    return ids;
  }, [characterGroups, selectedCharacterGroupIds]);
  const mentionableCharacterAccounts = useMemo(
    () =>
      accounts
        .filter(
          (account) =>
            account.kind === "character" && (account.invited || folderInvitedCharacterIds.has(account.entityId)),
        )
        .sort(sortAccountsByDisplayName),
    [accounts, folderInvitedCharacterIds],
  );
  const mentionSuggestions = useMemo(() => {
    return matchingMentionAccounts(mentionableCharacterAccounts, activeMention);
  }, [activeMention, mentionableCharacterAccounts]);
  const replyMentionSuggestions = useMemo(
    () => matchingMentionAccounts(mentionableCharacterAccounts, activeReplyMention),
    [activeReplyMention, mentionableCharacterAccounts],
  );
  const selectedFolderCharacterIds = useMemo(() => Array.from(folderInvitedCharacterIds), [folderInvitedCharacterIds]);
  const uninvitedSelectedFolderCharacterIds = useMemo(
    () => selectedFolderCharacterIds.filter((id) => characterAccountByEntity.get(id)?.invited !== true),
    [characterAccountByEntity, selectedFolderCharacterIds],
  );
  const folderInviteButtonLabel =
    selectedCharacterGroupIds.size === 0
      ? "Select folders to invite"
      : uninvitedSelectedFolderCharacterIds.length === 0
        ? "Selected folder characters are invited"
        : `Invite ${uninvitedSelectedFolderCharacterIds.length} ${
            uninvitedSelectedFolderCharacterIds.length === 1 ? "character" : "characters"
          }`;
  const hasActiveInvites = Boolean(
    directlyInvitedCharacterIds.length > 0 || selectedCharacterGroupIds.size > 0 || settings?.allowRandomUsers,
  );
  const followedAccountIds = useMemo(
    () => new Set(personaAccount?.settings.social.followingAccountIds ?? []),
    [personaAccount?.settings],
  );
  const canFollowViewedProfile = Boolean(
    viewedProfileAccount &&
    viewedProfileAccount.kind === "character" &&
    hasGeneratedProfile(viewedProfileAccount) &&
    (viewedProfileAccount.invited || folderInvitedCharacterIds.has(viewedProfileAccount.entityId)),
  );
  const canFollowAccount = useCallback(
    (account: NoodleAccount | null) =>
      Boolean(
        account &&
        account.kind === "character" &&
        hasGeneratedProfile(account) &&
        (account.invited || folderInvitedCharacterIds.has(account.entityId)),
      ),
    [folderInvitedCharacterIds],
  );
  const viewedProfileFollowed = Boolean(viewedProfileAccount && followedAccountIds.has(viewedProfileAccount.id));
  const followedCharacterAccountIds = useMemo(
    () =>
      new Set(
        accounts
          .filter(
            (account) =>
              account.kind === "character" &&
              followedAccountIds.has(account.id) &&
              (account.invited || folderInvitedCharacterIds.has(account.entityId)),
          )
          .map((account) => account.id),
      ),
    [accounts, folderInvitedCharacterIds, followedAccountIds],
  );
  const latestExternalReplyToPersonaCommentAtByPostId = useMemo(() => {
    const latest = new Map<string, number>();
    if (!personaAccount) return latest;
    for (const interaction of interactions) {
      if (
        interaction.type !== "reply" ||
        interaction.actorAccountId === personaAccount.id ||
        !interaction.parentInteractionId
      ) {
        continue;
      }
      const parentComment = interactionById.get(interaction.parentInteractionId);
      if (parentComment?.type !== "reply" || parentComment.actorAccountId !== personaAccount.id) continue;
      const createdAt = new Date(interaction.createdAt).getTime();
      if (!Number.isFinite(createdAt)) continue;
      latest.set(interaction.postId, Math.max(latest.get(interaction.postId) ?? 0, createdAt));
    }
    return latest;
  }, [interactionById, interactions, personaAccount]);
  const baseTimelinePosts = useMemo(() => {
    const visiblePosts =
      timelineTab === "following"
        ? posts.filter((post) => followedCharacterAccountIds.has(post.authorAccountId))
        : posts;
    return visiblePosts.slice().sort((left, right) => {
      const leftActivityAt = Math.max(
        new Date(left.createdAt).getTime() || 0,
        latestExternalReplyToPersonaCommentAtByPostId.get(left.id) ?? 0,
      );
      const rightActivityAt = Math.max(
        new Date(right.createdAt).getTime() || 0,
        latestExternalReplyToPersonaCommentAtByPostId.get(right.id) ?? 0,
      );
      return rightActivityAt - leftActivityAt;
    });
  }, [followedCharacterAccountIds, latestExternalReplyToPersonaCommentAtByPostId, posts, timelineTab]);
  const timelinePosts = useMemo(() => {
    if (!normalizedPostSearch || isAccountSearch) return baseTimelinePosts;
    return baseTimelinePosts.filter((post) => {
      const author = accountById.get(post.authorAccountId) ?? post.authorSnapshot;
      return [post.content, post.imagePrompt, author?.displayName, author?.handle].some((value) =>
        readString(value).toLowerCase().includes(normalizedPostSearch),
      );
    });
  }, [accountById, baseTimelinePosts, isAccountSearch, normalizedPostSearch]);
  const accountSearchResults = useMemo(() => {
    if (!isAccountSearch) return [];
    const exactHandle = accountSearchTerm;
    return accounts
      .filter(
        (account) =>
          accountIsDiscoverable(account, folderInvitedCharacterIds, settings?.allowRandomUsers === true) &&
          accountMatchesSearch(account, exactHandle),
      )
      .sort((left, right) => {
        const leftExact = left.handle.toLowerCase() === exactHandle;
        const rightExact = right.handle.toLowerCase() === exactHandle;
        if (leftExact !== rightExact) return leftExact ? -1 : 1;
        const leftStarts = left.handle.toLowerCase().startsWith(exactHandle);
        const rightStarts = right.handle.toLowerCase().startsWith(exactHandle);
        if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
        return sortAccountsByDisplayName(left, right);
      })
      .slice(0, 50);
  }, [accountSearchTerm, accounts, folderInvitedCharacterIds, isAccountSearch, settings?.allowRandomUsers]);
  const profilePosts = useMemo(
    () => (viewedProfileAccount ? posts.filter((post) => post.authorAccountId === viewedProfileAccount.id) : []),
    [posts, viewedProfileAccount],
  );
  const profileLikedPosts = useMemo(() => {
    if (!viewedProfileAccount) return [];
    const likedAtByPostId = new Map<string, string>();
    for (const interaction of interactions) {
      if (
        interaction.actorAccountId === viewedProfileAccount.id &&
        interaction.type === "like" &&
        !interaction.parentInteractionId
      ) {
        likedAtByPostId.set(interaction.postId, interaction.createdAt);
      }
    }
    return posts
      .filter((post) => likedAtByPostId.has(post.id))
      .sort((a, b) => {
        const aTime = new Date(likedAtByPostId.get(a.id) ?? a.createdAt).getTime();
        const bTime = new Date(likedAtByPostId.get(b.id) ?? b.createdAt).getTime();
        return bTime - aTime;
      });
  }, [interactions, posts, viewedProfileAccount]);
  const profileMediaPosts = useMemo(() => profilePosts.filter((post) => Boolean(post.imageUrl)), [profilePosts]);
  const profileVisiblePosts =
    profileTab === "likes" ? profileLikedPosts : profileTab === "media" ? profileMediaPosts : profilePosts;
  const profileFollowerAccounts = useMemo(() => {
    if (!viewedProfileAccount) return [];
    const explicitFollowers = accounts.filter((account) => {
      if (account.id === viewedProfileAccount.id) return false;
      const followingAccountIds = account.settings.social.followingAccountIds ?? [];
      return followingAccountIds.includes(viewedProfileAccount.id);
    });
    const personaFollowsViewedProfile =
      !viewingOwnProfile &&
      personaAccount &&
      viewedProfileAccount.kind === "character" &&
      followedAccountIds.has(viewedProfileAccount.id)
        ? [personaAccount]
        : [];
    return uniqueAccountsById([...explicitFollowers, ...personaFollowsViewedProfile]).sort(sortAccountsByDisplayName);
  }, [accounts, followedAccountIds, personaAccount, viewedProfileAccount, viewingOwnProfile]);
  const profileFollowingAccounts = useMemo(() => {
    if (viewingOwnProfile) {
      const explicitFollowing = (personaAccount?.settings.social.followingAccountIds ?? []).map((id) =>
        accountById.get(id),
      );
      return uniqueAccountsById(explicitFollowing).sort(sortAccountsByDisplayName);
    }
    if (!viewedProfileAccount) return [];
    const followingIds = new Set(viewedProfileAccount.settings.social.followingAccountIds ?? []);
    return uniqueAccountsById([...followingIds].map((id) => accountById.get(id))).sort(sortAccountsByDisplayName);
  }, [accountById, personaAccount, viewedProfileAccount, viewingOwnProfile]);
  const profileFollowerCount = profileFollowerAccounts.length;
  const profileFollowingCount = profileFollowingAccounts.length;
  const profileConnectionAccounts =
    profileConnectionTab === "following" ? profileFollowingAccounts : profileFollowerAccounts;
  const notificationLikes = useMemo(() => {
    if (!personaAccount) return [];
    const personaPostIds = new Set(
      posts.filter((post) => post.authorAccountId === personaAccount.id).map((post) => post.id),
    );
    return interactions
      .filter((interaction) => interaction.type === "like" && interaction.actorAccountId !== personaAccount.id)
      .map((interaction) => {
        const targetReply = interaction.parentInteractionId
          ? (interactionById.get(interaction.parentInteractionId) ?? null)
          : null;
        const targetsPersona = targetReply
          ? targetReply.actorAccountId === personaAccount.id
          : personaPostIds.has(interaction.postId);
        return {
          interaction,
          targetReply,
          targetsPersona,
          post: postById.get(interaction.postId) ?? null,
          actorAccount: accountById.get(interaction.actorAccountId) ?? null,
          actorSnapshot: interaction.actorSnapshot,
        };
      })
      .filter((item) => item.targetsPersona)
      .filter((item): item is typeof item & { post: NoodlePost } => Boolean(item.post))
      .sort(
        (left, right) =>
          new Date(right.interaction.createdAt).getTime() - new Date(left.interaction.createdAt).getTime(),
      );
  }, [accountById, interactionById, interactions, personaAccount, postById, posts]);
  const notificationFollowAccounts = useMemo(() => {
    if (!personaAccount) return [];
    return accounts
      .flatMap((account) => {
        if (account.id === personaAccount.id) return [];
        const followingAccountIds = account.settings.social.followingAccountIds ?? [];
        if (!followingAccountIds.includes(personaAccount.id)) return [];
        const followedAtByAccount = account.settings.social.followingAccountTimestamps ?? {};
        return [{ account, followedAt: followedAtByAccount[personaAccount.id] }];
      })
      .sort((left, right) => (Date.parse(right.followedAt) || 0) - (Date.parse(left.followedAt) || 0));
  }, [accounts, personaAccount]);
  const notificationReplyItems = useMemo(() => {
    if (!personaAccount) return [];
    const items: Array<{
      id: string;
      kind: "reply" | "mention";
      createdAt: string;
      actorAccount: NoodleAccount | null;
      actorSnapshot: NoodlePost["authorSnapshot"];
      post: NoodlePost;
      content: string;
      replyTarget: "post" | "comment" | null;
      interactionId: string | null;
    }> = [];
    const seen = new Set<string>();
    for (const interaction of interactions) {
      if (interaction.type !== "reply" || interaction.actorAccountId === personaAccount.id) continue;
      const post = postById.get(interaction.postId);
      if (!post) continue;
      const parentReply = interaction.parentInteractionId
        ? (interactionById.get(interaction.parentInteractionId) ?? null)
        : null;
      const repliesToPersonaComment = parentReply?.actorAccountId === personaAccount.id;
      const repliesToPersona = repliesToPersonaComment || post.authorAccountId === personaAccount.id;
      const mentionsPersona = textMentionsHandle(interaction.content, personaAccount.handle);
      if (!repliesToPersona && !mentionsPersona) continue;
      const id = `reply:${interaction.id}`;
      seen.add(id);
      items.push({
        id,
        kind: repliesToPersona ? "reply" : "mention",
        createdAt: interaction.createdAt,
        actorAccount: accountById.get(interaction.actorAccountId) ?? null,
        actorSnapshot: interaction.actorSnapshot,
        post,
        content: interaction.content ?? "",
        replyTarget: repliesToPersonaComment ? "comment" : repliesToPersona ? "post" : null,
        interactionId: interaction.id,
      });
    }
    for (const post of posts) {
      if (post.authorAccountId === personaAccount.id || !textMentionsHandle(post.content, personaAccount.handle)) {
        continue;
      }
      const id = `post:${post.id}`;
      if (seen.has(id)) continue;
      items.push({
        id,
        kind: "mention",
        createdAt: post.createdAt,
        actorAccount: accountById.get(post.authorAccountId) ?? null,
        actorSnapshot: post.authorSnapshot,
        post,
        content: post.content,
        replyTarget: null,
        interactionId: null,
      });
    }
    return items.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [accountById, interactionById, interactions, personaAccount, postById, posts]);

  useEffect(() => {
    if (activeNoodleView !== "home" || !notificationFocusTarget) return;
    const frame = window.requestAnimationFrame(() => {
      const timeline = timelineScrollRef.current;
      if (!timeline) return;
      const postElement = Array.from(timeline.querySelectorAll<HTMLElement>("[data-noodle-post-id]")).find(
        (element) => element.dataset.noodlePostId === notificationFocusTarget.postId,
      );
      const interactionElement = notificationFocusTarget.interactionId
        ? Array.from(timeline.querySelectorAll<HTMLElement>("[data-noodle-interaction-id]")).find(
            (element) => element.dataset.noodleInteractionId === notificationFocusTarget.interactionId,
          )
        : null;
      const targetElement = interactionElement ?? postElement;
      if (!targetElement) {
        setNotificationFocusTarget(null);
        return;
      }
      targetElement.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      targetElement.focus({ preventScroll: true });
      setHighlightedInteractionId(interactionElement ? notificationFocusTarget.interactionId : null);
      setNotificationFocusTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeNoodleView, notificationFocusTarget, prefersReducedMotion]);

  useEffect(() => {
    if (!highlightedInteractionId) return;
    const timeout = window.setTimeout(() => setHighlightedInteractionId(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [highlightedInteractionId]);

  const notificationReadAt = personaAccount
    ? (notificationReadOverrides[personaAccount.id] ?? personaAccount.settings.social.notificationsReadAt ?? "")
    : "";
  const notificationReadTime = Date.parse(notificationReadAt) || 0;
  const notificationCount =
    notificationLikes.filter((item) => new Date(item.interaction.createdAt).getTime() > notificationReadTime).length +
    notificationFollowAccounts.filter((item) => (Date.parse(item.followedAt) || 0) > notificationReadTime).length +
    notificationReplyItems.filter((item) => new Date(item.createdAt).getTime() > notificationReadTime).length;
  const followableCharacterAccounts = useMemo(
    () =>
      accounts
        .filter(
          (account) =>
            account.kind === "character" &&
            hasGeneratedProfile(account) &&
            (account.invited || folderInvitedCharacterIds.has(account.entityId)),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [accounts, folderInvitedCharacterIds],
  );
  const suggestedCharacters = useMemo(
    () =>
      followableCharacterAccounts
        .filter((account) => !followedAccountIds.has(account.id))
        .map((account) => ({
          account,
          accountId: account.id,
          name: account.displayName,
          handle: account.handle,
          avatarUrl: account.avatarUrl,
        }))
        .slice(0, 5),
    [followableCharacterAccounts, followedAccountIds],
  );

  const openProfile = (account: NoodleAccount | null) => {
    if (!account) return;
    setProfileEditing(false);
    setProfileTab("posts");
    onNavigate({
      mode: "public",
      view: "profile",
      accountId: account.id === personaAccount?.id ? null : account.id,
      connection: null,
    });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
  };

  const openOwnProfile = () => {
    setProfileEditing(false);
    setProfileTab("posts");
    onNavigate({ mode: "public", view: "profile", accountId: null, connection: null });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setPostSearch(value);
    if (!value.trim()) return;
    onNavigate({ mode: "public", view: "home" });
    setAccountSwitcherOpen(false);
  };

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    composerValueRef.current = value;
    const hasText = Boolean(value.trim());
    if (hasText !== composerHasTextRef.current) {
      composerHasTextRef.current = hasText;
      setComposerHasText(hasText);
    }
    const nextMention = activeComposerMention(value, event.target.selectionStart ?? value.length);
    if (nextMention || activeMention) setActiveMention(nextMention);
    if (activeMentionIndex !== 0) setActiveMentionIndex(0);
  };

  const selectComposerMention = (account: NoodleAccount) => {
    if (!activeMention) return;
    const insertedMention = `@${account.handle} `;
    const source = composerValueRef.current;
    const nextComposer = source.slice(0, activeMention.start) + insertedMention + source.slice(activeMention.end);
    const nextCaret = activeMention.start + insertedMention.length;
    composerValueRef.current = nextComposer;
    composerHasTextRef.current = Boolean(nextComposer.trim());
    setComposerHasText(composerHasTextRef.current);
    setComposer(nextComposer);
    setActiveMention(null);
    setActiveMentionIndex(0);
    window.requestAnimationFrame(() => {
      const textarea = composeOpen ? modalComposerRef.current : inlineComposerRef.current;
      if (textarea) textarea.value = nextComposer;
      textarea?.focus();
      textarea?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!activeMention) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setActiveMention(null);
      return;
    }
    if (mentionSuggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveMentionIndex((current) => (current + direction + mentionSuggestions.length) % mentionSuggestions.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const account = mentionSuggestions[Math.min(activeMentionIndex, mentionSuggestions.length - 1)];
      if (account) selectComposerMention(account);
    }
  };

  const renderComposerMentionSuggestions = (listboxId: string) => {
    return (
      <NoodleMentionSuggestions
        activeMention={activeMention}
        activeIndex={activeMentionIndex}
        accounts={mentionSuggestions}
        listboxId={listboxId}
        onSelect={selectComposerMention}
      />
    );
  };

  const handleReplyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    replyValueRef.current = value;
    const hasText = Boolean(value.trim());
    if (hasText !== replyHasTextRef.current) {
      replyHasTextRef.current = hasText;
      setReplyHasText(hasText);
    }
    const nextMention = activeComposerMention(value, event.target.selectionStart ?? value.length);
    if (nextMention || activeReplyMention) setActiveReplyMention(nextMention);
    if (activeReplyMentionIndex !== 0) setActiveReplyMentionIndex(0);
  };

  const selectReplyMention = (account: NoodleAccount) => {
    if (!activeReplyMention) return;
    const insertedMention = `@${account.handle} `;
    const source = replyValueRef.current;
    const nextReply =
      source.slice(0, activeReplyMention.start) + insertedMention + source.slice(activeReplyMention.end);
    const nextCaret = activeReplyMention.start + insertedMention.length;
    replyValueRef.current = nextReply;
    replyHasTextRef.current = Boolean(nextReply.trim());
    setReplyHasText(replyHasTextRef.current);
    setReplyText(nextReply);
    setActiveReplyMention(null);
    setActiveReplyMentionIndex(0);
    window.requestAnimationFrame(() => {
      if (replyComposerRef.current) replyComposerRef.current.value = nextReply;
      replyComposerRef.current?.focus();
      replyComposerRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleReplyKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!activeReplyMention) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setActiveReplyMention(null);
      return;
    }
    if (replyMentionSuggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveReplyMentionIndex(
        (current) => (current + direction + replyMentionSuggestions.length) % replyMentionSuggestions.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const account = replyMentionSuggestions[Math.min(activeReplyMentionIndex, replyMentionSuggestions.length - 1)];
      if (account) selectReplyMention(account);
    }
  };

  const updateFollowedAccount = (account: NoodleAccount, followed: boolean) => {
    if (!personaAccount || account.id === personaAccount.id) return;
    updateAccountFollow.mutate(
      {
        id: personaAccount.id,
        targetAccountId: account.id,
        followed,
      },
      {
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateFollowedAccounts")),
      },
    );
  };

  const submitPost = () => {
    if (!personaAccount || !canSubmitPost) return;
    const content = composerValueRef.current.trim() || draftPoll?.question || "Shared an image.";
    createPost.mutate(
      {
        authorKind: "persona",
        authorEntityId: personaAccount.entityId,
        content,
        imageUrl: attachedImage?.url ?? null,
        ...(attachedImage?.crop ? { imageCrop: attachedImage.crop } : {}),
        poll: draftPoll,
      },
      {
        onSuccess: () => {
          composerValueRef.current = "";
          composerHasTextRef.current = false;
          if (inlineComposerRef.current) inlineComposerRef.current.value = "";
          if (modalComposerRef.current) modalComposerRef.current.value = "";
          setComposer("");
          setComposerHasText(false);
          setActiveMention(null);
          setAttachedImage(null);
          setPendingImage(null);
          setDraftPoll(null);
          setPollEditorValue(null);
          setActiveComposerTool(null);
          setComposeOpen(false);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotPostToNoodle")),
      },
    );
  };

  const reactToPost = (post: NoodlePostCardModel, type: "like" | "repost", active = false) => {
    if (!personaAccount) return;
    if (active) {
      removeInteraction.mutate(
        {
          postId: post.id,
          actorKind: "persona",
          actorEntityId: personaAccount.entityId,
          type,
        },
        {
          onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodlePost")),
        },
      );
      return;
    }
    createInteraction.mutate(
      {
        postId: post.id,
        actorKind: "persona",
        actorEntityId: personaAccount.entityId,
        type,
        content: null,
      },
      {
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateNoodlePost")),
      },
    );
  };

  const voteInPoll = (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => {
    if (!personaAccount || optionId === selectedOptionId) return;
    createInteraction.mutate(
      {
        postId: post.id,
        actorKind: "persona",
        actorEntityId: personaAccount.entityId,
        type: "vote",
        content: optionId,
      },
      {
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotSaveYourPollVote")),
      },
    );
  };

  const submitReply = (post: NoodlePostCardModel) => {
    const replyContent = replyValueRef.current.trim();
    if (!personaAccount || (!replyContent && !replyImageUrl.trim())) return;
    createInteraction.mutate(
      {
        postId: post.id,
        actorKind: "persona",
        actorEntityId: personaAccount.entityId,
        type: "reply",
        content: replyContent || null,
        imageUrl: replyImageUrl.trim() || null,
        parentInteractionId: replyParentInteractionId,
      },
      {
        onSuccess: clearReplyComposer,
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotReplyOnNoodle")),
      },
    );
  };

  const createInteractionPendingFor = (
    postId: string,
    type: NoodleInteractionType,
    parentInteractionId: string | null = null,
  ) =>
    createInteraction.isPending &&
    createInteraction.variables?.postId === postId &&
    createInteraction.variables.type === type &&
    (createInteraction.variables.parentInteractionId ?? null) === parentInteractionId;

  const removeInteractionPendingFor = (
    postId: string,
    type: "like" | "repost",
    parentInteractionId: string | null = null,
  ) =>
    removeInteraction.isPending &&
    removeInteraction.variables?.postId === postId &&
    removeInteraction.variables.type === type &&
    (removeInteraction.variables.parentInteractionId ?? null) === parentInteractionId;

  const reactionPendingFor = (postId: string, type: "like" | "repost", parentInteractionId: string | null = null) =>
    createInteractionPendingFor(postId, type, parentInteractionId) ||
    removeInteractionPendingFor(postId, type, parentInteractionId);

  const reactToReply = (post: NoodlePostCardModel, target: NoodleInteraction, active: boolean) => {
    if (!personaAccount) return;
    const input = {
      postId: post.id,
      actorKind: "persona" as const,
      actorEntityId: personaAccount.entityId,
      type: "like" as const,
      parentInteractionId: target.id,
    };
    if (active) {
      removeInteraction.mutate(input, {
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateCommentLike")),
      });
      return;
    }
    createInteraction.mutate(
      { ...input, content: null },
      {
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotUpdateCommentLike")),
      },
    );
  };

  const startEditingPost = (post: NoodlePostCardModel) => {
    postImageEditor.reset();
    setEditingPostId(post.id);
    const poll = readNoodlePollFromMetadata(post.metadata);
    setEditingPostContent(poll && post.content.trim() === poll.question ? "" : post.content);
    setEditingPostPoll(poll ? { question: poll.question, options: poll.options.map((option) => option.label) } : null);
    setPostMenuId(null);
  };

  const cancelEditingPost = () => {
    postImageEditor.reset();
    setEditingPostId(null);
    setEditingPostContent("");
    setEditingPostPoll(null);
  };

  const saveEditedPost = async (post: NoodlePostCardModel) => {
    const content = editingPostContent.trim();
    const existingPoll = readNoodlePollFromMetadata(post.metadata);
    const validPoll = existingPoll ? noodlePollInputSchema.safeParse(editingPostPoll).success : false;
    if (!content && !validPoll) {
      toast.error(localizeUi("ui.noodle.noodlehome.postsNeedABodyOrPoll"));
      return;
    }
    try {
      let replacementUrl: string | null = null;
      const imageUpdate: NoodlePostImageUpdate | null = postImageEditor.update;
      if (imageUpdate?.kind === "replace") {
        const images = await uploadGlobalImages.mutateAsync({ files: [imageUpdate.file] });
        const uploaded = images[0];
        if (!uploaded?.url) throw new Error("Image uploaded, but no URL was returned.");
        replacementUrl = uploaded.url;
      }
      await updatePost.mutateAsync({
        id: post.id,
        content,
        ...(existingPoll && { poll: editingPostPoll }),
        ...(imageUpdate?.kind === "replace" && {
          imageUrl: replacementUrl,
          imagePrompt: null,
          imageCrop: imageUpdate.crop,
        }),
        ...(imageUpdate?.kind === "crop" && { imageCrop: imageUpdate.crop }),
        ...(imageUpdate?.kind === "remove" && {
          imageUrl: null,
          imagePrompt: null,
          imageCrop: null,
        }),
      });
      cancelEditingPost();
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotEditNoodlePost"));
    }
  };

  const startEditingReply = (reply: NoodleInteraction) => {
    setEditingReplyId(reply.id);
    setEditingReplyContent(reply.content ?? "");
  };

  const cancelEditingReply = () => {
    setEditingReplyId(null);
    setEditingReplyContent("");
  };

  const saveEditedReply = (post: NoodlePostCardModel, reply: NoodleInteraction) => {
    if (!personaAccount) return;
    const content = editingReplyContent.trim();
    if (!content && !reply.imageUrl) {
      toast.error(localizeUi("ui.noodle.noodlehome.commentsNeedTextOrAnImage"));
      return;
    }
    updateInteraction.mutate(
      {
        postId: post.id,
        interactionId: reply.id,
        personaId: personaAccount.entityId,
        content,
      },
      {
        onSuccess: cancelEditingReply,
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotEditNoodleComment")),
      },
    );
  };

  const deleteNoodleReply = (post: NoodlePostCardModel, reply: NoodleInteraction) => {
    setConfirmAction({
      kind: "delete-reply",
      postId: post.id,
      interactionId: reply.id,
      title:localizeUi("ui.noodle.noodlehome.deleteNoodleComment"),
      message:localizeUi("ui.noodle.noodlehome.thisRemovesTheCommentAndAnyRepliesOrLikes"),
      confirmLabel:localizeUi("ui.noodle.noodlepostcard.deleteComment"),
    });
  };

  const deleteNoodlePost = (post: NoodlePostCardModel) => {
    setPostMenuId(null);
    setConfirmAction({
      kind: "delete-post",
      postId: post.id,
      title:localizeUi("ui.noodle.noodlehome.deleteNoodlePost"),
      message:localizeUi("ui.noodle.noodlehome.thisRemovesThePostAndItsLikesRepostsReplies"),
      confirmLabel:localizeUi("ui.noodle.noodlehome.deletePost"),
    });
  };

  const resetTimeline = () => {
    setConfirmAction({
      kind: "reset-timeline",
      title:localizeUi("ui.noodle.noodlehome.resetNoodleTimeline"),
      message:localizeUi("ui.noodle.noodlehome.thisRemovesAllPostsRepliesLikesRepostsActivityDigests"),
      confirmLabel:localizeUi("ui.noodle.noodlehome.resetTimeline"),
    });
  };

  const confirmNoodleAction = () => {
    if (!confirmAction) return;
    if (confirmAction.kind === "delete-post") {
      const postId = confirmAction.postId;
      deletePost.mutate(postId, {
        onSuccess: () => {
          if (replyPostId === postId) {
            clearReplyComposer();
          }
          if (editingPostId === postId) cancelEditingPost();
          setConfirmAction(null);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotDeleteNoodlePost")),
      });
      return;
    }
    if (confirmAction.kind === "delete-reply") {
      if (!personaAccount) return;
      const { postId, interactionId } = confirmAction;
      deleteInteraction.mutate(
        { postId, interactionId, personaId: personaAccount.entityId },
        {
          onSuccess: () => {
            if (editingReplyId === interactionId) cancelEditingReply();
            if (replyParentInteractionId === interactionId) clearReplyComposer();
            setConfirmAction(null);
          },
          onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotDeleteNoodleComment")),
        },
      );
      return;
    }
    if (confirmAction.kind === "uninvite-everybody") {
      clearInvites.mutate(undefined, {
        onSuccess: () => {
          setConfirmAction(null);
          toast.success(localizeUi("ui.noodle.noodlehome.noodleInvitesCleared"));
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotClearNoodleInvites")),
      });
      return;
    }
    resetNoodleTimeline.mutate(undefined, {
      onSuccess: () => {
        clearReplyComposer();
        setPostMenuId(null);
        cancelEditingPost();
        cancelEditingReply();
        setConfirmAction(null);
        toast.success(localizeUi("ui.noodle.noodlehome.noodleTimelineReset"));
      },
      onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotResetNoodleTimeline")),
    });
  };

  const triggerRefresh = () => {
    if (imagePromptReviewItems.length > 0) return;
    if (!settings?.generationConnectionId) {
      toast.error(localizeUi("ui.noodle.noodlehome.chooseAGenerationConnectionForNoodleFirst"));
      return;
    }
    const defaultImageConnectionId = readString(imageConnections.find((connection) => connection.defaultForAgents)?.id);
    if (settings.enableImagePrompts && !settings.imageGenerationConnectionId && !defaultImageConnectionId) {
      toast.error(localizeUi("ui.noodle.noodlehome.chooseAnImageGenerationConnectionForNoodleFirst"));
      return;
    }
    refreshNoodle.mutate(
      { personaId: personaAccount?.entityId, connectionId: settings.generationConnectionId },
      {
        onSuccess: (result) => {
          if (result.imagePromptReviewItems.length > 0) {
            setImagePromptReviewItems(result.imagePromptReviewItems);
            return;
          }
          toast.success(localizeUi("ui.noodle.noodlehome.noodleTimelineRefreshed"));
        },
        onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotRefreshNoodle")),
      },
    );
  };

  const confirmReviewedNoodleImagePrompts = (overrides: ImagePromptOverride[]) => {
    confirmNoodleImagePrompts.mutate(overrides, {
      onSuccess: () => {
        setImagePromptReviewItems([]);
        toast.success(localizeUi("ui.noodle.noodlehome.noodleTimelineRefreshed"));
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotGenerateTheReviewedNoodleImages")),
    });
  };

  const closeComposeModal = useCallback(() => {
    setComposer(composerValueRef.current);
    setComposeOpen(false);
    setActiveMention(null);
    setActiveComposerTool(null);
  }, []);

  const openComposeModal = (opener: HTMLElement) => {
    composerRestoreFocusRef.current = mobileDrawerOpen ? mobileDrawerTriggerRef.current : opener;
    setComposer(composerValueRef.current);
    setComposeOpen(true);
    setActiveComposerTool(null);
    setActiveReplyComposerTool(null);
    setMobileDrawerOpen(false);
  };

  const scrollTimelineToTop = useCallback(() => {
    window.requestAnimationFrame(() => {
      timelineScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const openHomeTimeline = useCallback(() => {
    onNavigate({ mode: "public", view: "home" });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
    scrollTimelineToTop();
  }, [onNavigate, scrollTimelineToTop]);

  const openMobileHomeTimeline = () => {
    setPostSearch("");
    openHomeTimeline();
  };

  const openNotificationTarget = (postId: string, interactionId: string | null) => {
    clearReplyComposer();
    setPostSearch("");
    setTimelineTab("main");
    onNavigate({ mode: "public", view: "home" });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
    setNotificationFocusTarget({ postId, interactionId });
  };

  const openSearch = () => {
    onNavigate({ mode: "public", view: "search" });
    setTimelineTab("main");
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
    scrollTimelineToTop();
  };

  const openNotifications = () => {
    onNavigate({ mode: "public", view: "notifications" });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
  };

  const openSettings = () => {
    onNavigate({ mode: "settings" });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
  };

  const openNoodler = () => {
    onNavigate(settings?.enableNoodler ? { mode: "noodler", view: "hub" } : { mode: "verification" });
    setAccountSwitcherOpen(false);
    setMobileDrawerOpen(false);
    setActiveComposerTool(null);
  };

  const openNoodlerVerification = async () => {
    const hasUnsavedDraft =
      composerHasText ||
      Boolean(attachedImage) ||
      Boolean(pendingImage) ||
      Boolean(draftPoll) ||
      replyHasText ||
      Boolean(replyImageUrl);
    if (
      hasUnsavedDraft &&
      !(await showConfirmDialog({
        title:localizeUi("ui.noodle.noodlehome.discardYourNoodleDraft"),
        message:localizeUi("ui.noodle.noodlehome.yourUnsentPostOrReplyWillBeLostWhen"),
        confirmLabel:localizeUi("ui.noodle.noodlehome.discardDraft"),
        tone: "destructive",
      }))
    ) {
      return;
    }
    onNavigate({ mode: "verification" });
  };

  const openProfileConnection = (connection: ProfileConnectionTab | null) => {
    if (navigation.mode !== "public" || navigation.view !== "profile") return;
    onNavigate({ ...navigation, connection });
  };

  const normalizedInviteSearch = inviteSearch.trim().toLowerCase();
  const filteredCharacters = useMemo(
    () =>
      characters
        .filter((character) => readString(character.id))
        .filter((character) => (settings?.allowProfessorMari ?? true) || readString(character.id) !== PROFESSOR_MARI_ID)
        .filter((character) => characterName(character).toLowerCase().includes(normalizedInviteSearch))
        .sort((left, right) => characterName(left).localeCompare(characterName(right))),
    [characters, normalizedInviteSearch, settings?.allowProfessorMari],
  );
  const visibleInviteCharacters = filteredCharacters.slice(0, inviteCharacterLimit);
  const hasMoreInviteCharacters = filteredCharacters.length > visibleInviteCharacters.length;
  const filteredCharacterGroups = useMemo(
    () =>
      characterGroups
        .filter((group) => readString(group.id))
        .filter((group) => characterGroupName(group).toLowerCase().includes(normalizedInviteSearch))
        .sort((left, right) => characterGroupName(left).localeCompare(characterGroupName(right)))
        .slice(0, 24),
    [characterGroups, normalizedInviteSearch],
  );
  const carryoverTargets = useMemo(
    () => new Set(settings?.carryoverModes ?? carryoverTargetsFromLegacy(settings?.carryoverMode)),
    [settings?.carryoverMode, settings?.carryoverModes],
  );

  const toggleCharacterGroupInvite = (groupId: string) => {
    if (!settings) return;
    const current = settings.invitedCharacterGroupIds ?? [];
    const next = current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId];
    saveSettings({ invitedCharacterGroupIds: next });
  };

  const inviteSelectedFolderCharacters = () => {
    if (uninvitedSelectedFolderCharacterIds.length === 0) {
      toast.info(localizeUi("ui.noodle.noodlehome.selectedFolderCharactersAreAlreadyInvited"));
      return;
    }
    inviteCharacters.mutate(uninvitedSelectedFolderCharacterIds, {
      onSuccess: (accounts) => {
        toast.success(localizeUi("ui.noodle.noodlehome.invitedValue1Value2FromSelectedFolders", { value1: accounts.length, value2: accounts.length === 1 ?localizeUi("ui.noodle.noodlehome.character") :localizeUi("ui.noodle.noodlehome.characters") }),
        );
      },
      onError: (error) => toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotInviteFolderCharacters")),
    });
  };

  const uninviteEverybody = () => {
    setConfirmAction({
      kind: "uninvite-everybody",
      title:localizeUi("ui.noodle.noodlehome.uninviteEverybody_29aa147"),
      message:localizeUi("ui.noodle.noodlehome.thisRemovesAllDirectNoodleCharacterInvitesClearsSelected"),
      confirmLabel:localizeUi("ui.noodle.noodlehome.uninviteEverybody"),
    });
  };

  const toggleCarryoverTarget = (target: NoodleCarryoverTarget, checked: boolean) => {
    if (!settings) return;
    const current = new Set(settings.carryoverModes ?? carryoverTargetsFromLegacy(settings.carryoverMode));
    if (checked) current.add(target);
    else current.delete(target);
    const next = NOODLE_CARRYOVER_TARGETS.filter((mode) => current.has(mode));
    saveSettings({
      carryoverModes: next,
      carryoverMode: legacyCarryoverModeFromTargets(next),
    });
  };

  useEffect(() => {
    if (!composeOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeComposeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composeOpen, closeComposeModal]);

  useEffect(() => {
    if (!accountSwitcherOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountSwitcherOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (accountSwitcherRef.current?.contains(event.target)) return;
      setAccountSwitcherOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [accountSwitcherOpen]);

  const settingsContent = (
    <>
      <Section
        title={localizeUi("ui.noodle.noodlehome.noodlePrompt")}
        help={localizeUi("ui.noodle.noodlehome.controlsTheEditableBaseInstructionsUsedToWriteNoodle")}
      >
        <div data-component="NoodleView.PromptSetting" className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
              {noodlePromptLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[var(--foreground)]">{localizeUi("ui.noodle.noodlehome.timelineBasePrompt")}</p>
                <span className="rounded-full border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--noodle-accent)]">
                  {noodlePromptOverride?.enabled === true ?localizeUi("settings.notifications.customSound.status.custom") :localizeUi("ui.noodle.noodlehome.default")}
                </span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-[0.68rem] leading-5 text-[var(--muted-foreground)]">
                {noodlePromptDetail.isError || noodlePromptDefault.isError
                  ?localizeUi("ui.noodle.noodlehome.theNoodlePromptCouldNotBeLoaded")
                  : noodlePromptText || "Loading the default Noodle prompt…"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void restoreDefaultNoodlePrompt()}
              disabled={!noodlePromptHasOverride || resetNoodlePrompt.isPending}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {resetNoodlePrompt.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}{localizeUi("ui.noodle.noodlehome.restoreDefault")}</button>
            <button
              type="button"
              onClick={openNoodlePromptEditor}
              disabled={
                noodlePromptLoading || noodlePromptDetail.isError || noodlePromptDefault.isError || !noodlePromptText
              }
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--noodle-accent)]/60 hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Pencil size={14} aria-hidden="true" className="shrink-0 text-[var(--noodle-accent)]" />
              <span>{localizeUi("ui.noodle.noodlehome.editPrompt")}</span>
            </button>
          </div>
        </div>
      </Section>

      <Section
        title={localizeUi("ui.noodle.noodlehome.invites")}
        help={localizeUi("ui.noodle.noodlehome.chooseWhoCanParticipateInNoodleRefreshesDirectCharacter")}
      >
        <div className="space-y-4">
          <ToggleSetting
            label={localizeUi("ui.noodle.noodlehome.professorMariParticipates")}
            help={localizeUi("ui.noodle.noodlehome.whenOffProfessorMariIsHiddenFromNoodleAccount")}
            checked={settings?.allowProfessorMari ?? true}
            disabled={!settings || updateSettings.isPending}
            onChange={(checked) => saveSettings({ allowProfessorMari: checked })}
          />

          <label className="block space-y-1.5">
            <FieldLabel help={localizeUi("ui.noodle.noodlehome.filtersBothCharacterFoldersAndIndividualCharactersInThis")}>{localizeUi("ui.noodle.noodlehome.charactersToInvite")}</FieldLabel>
            <input
              value={inviteSearch}
              onChange={(event) => setInviteSearch(event.target.value)}
              className={fieldClass}
              placeholder={localizeUi("ui.noodle.noodlehome.searchCharactersOrFolders")}
            />
          </label>

          {characterGroups.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setInviteFoldersOpen((open) => !open)}
                className="flex w-full items-center gap-2 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-left text-xs transition-colors hover:border-[var(--noodle-accent)]/60"
                aria-expanded={inviteFoldersOpen}
              >
                <FolderOpen size={15} className="shrink-0 text-[var(--noodle-accent)]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{localizeUi("ui.noodle.noodlehome.addFromFolder")}</span>
                  <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.inviteEveryCharacterInSelectedFolders")}</span>
                </span>
                <ChevronRight
                  size={15}
                  className={cn(
                    "shrink-0 text-[var(--muted-foreground)] transition-transform",
                    inviteFoldersOpen && "rotate-90",
                  )}
                />
              </button>
              {inviteFoldersOpen && (
                <div className="overflow-hidden rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)]">
                  <div className="max-h-44 space-y-2 overflow-y-auto p-2 [scrollbar-gutter:stable]">
                    {filteredCharacterGroups.length > 0 ? (
                      filteredCharacterGroups.map((group) => {
                        const id = readString(group.id);
                        const name = characterGroupName(group);
                        const memberCount = readStringArray(group.characterIds).length;
                        const selected = selectedCharacterGroupIds.has(id);
                        const description = readString(group.description).trim();
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-3 rounded-md p-2 text-xs hover:bg-foreground/5"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!settings || updateSettings.isPending}
                              onChange={() => toggleCharacterGroupInvite(id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{name}</span>
                              <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                                {memberCount} {memberCount === 1 ?localizeUi("ui.noodle.noodlehome.character") :localizeUi("ui.noodle.noodlehome.characters")}
                                {description ?localizeUi("ui.noodle.noodlehome.value1", { value1: description }) : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.noMatchingFolders")}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={inviteSelectedFolderCharacters}
                    disabled={
                      !settings ||
                      updateSettings.isPending ||
                      inviteCharacters.isPending ||
                      uninvitedSelectedFolderCharacterIds.length === 0
                    }
                    className="flex min-h-10 w-full items-center justify-center gap-2 border-t border-[var(--marinara-chat-chrome-panel-border)] px-3 py-2 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inviteCharacters.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    {folderInviteButtonLabel}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <FieldLabel help={localizeUi("ui.noodle.noodlehome.directlyInvitedCharactersAreEligibleRegardlessOfFolderSelection")}>{localizeUi("navigation.topbar.characters")}</FieldLabel>
              <button
                type="button"
                onClick={uninviteEverybody}
                disabled={
                  !settings ||
                  updateSettings.isPending ||
                  inviteCharacter.isPending ||
                  inviteCharacters.isPending ||
                  removeCharacter.isPending ||
                  clearInvites.isPending ||
                  !hasActiveInvites
                }
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--noodle-accent)]/35 px-3 text-[0.68rem] font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {clearInvites.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}{localizeUi("ui.noodle.noodlehome.uninviteEverybody")}</button>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] [scrollbar-gutter:stable]">
              <button
                type="button"
                className="flex w-full items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-border)] p-2 text-left transition-colors hover:bg-foreground/5"
                disabled={!settings || updateSettings.isPending}
                onClick={() => saveSettings({ allowRandomUsers: !(settings?.allowRandomUsers ?? false) })}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--noodle-accent)]/10 text-[var(--noodle-accent)]">
                  <Dices size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{localizeUi("ui.noodle.noodlehome.randomUsers")}</span>
                  <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                    {(settings?.allowRandomUsers ?? false) ?localizeUi("ui.noodle.noodlehome.enabled") :localizeUi("ui.noodle.noodlehome.ambientFakeProfiles")}
                  </span>
                </span>
                <span className={noodleIconButtonClass}>
                  {(settings?.allowRandomUsers ?? false) ? <UserMinus size={15} /> : <UserPlus size={15} />}
                </span>
              </button>
              {visibleInviteCharacters.map((character) => {
                const id = readString(character.id);
                const name = characterName(character);
                const account = characterAccountByEntity.get(id);
                const invited = account?.invited === true;
                const includedByFolder = folderInvitedCharacterIds.has(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 border-b border-[var(--marinara-chat-chrome-panel-border)] p-2 last:border-b-0"
                  >
                    <Avatar
                      account={{
                        displayName: name,
                        avatarUrl: readString(character.avatarPath) || null,
                        avatarCrop: rawCharacterAvatarCrop(character),
                      }}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{name}</p>
                      <p className="text-[0.68rem] text-[var(--muted-foreground)]">
                        {invited ?localizeUi("ui.noodle.noodlehome.invited") : includedByFolder ?localizeUi("ui.noodle.noodlehome.includedByFolder") :localizeUi("ui.noodle.noodlehome.notInvited")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={noodleIconButtonClass}
                      disabled={inviteCharacter.isPending || removeCharacter.isPending}
                      onClick={() =>
                        invited
                          ? removeCharacter.mutate(id, {
                              onError: (error) =>
                                toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotRemoveInvite")),
                            })
                          : inviteCharacter.mutate(id, {
                              onError: (error) =>
                                toast.error(error instanceof Error ? error.message :localizeUi("ui.noodle.noodlehome.couldNotInviteCharacter")),
                            })
                      }
                      title={invited ?localizeUi("ui.noodle.noodlehome.removeDirectInvite") :localizeUi("ui.noodle.noodlehome.inviteDirectly")}
                    >
                      {invited ? <UserMinus size={15} /> : <UserPlus size={15} />}
                    </button>
                  </div>
                );
              })}
              {filteredCharacters.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.noMatchingCharacters")}</p>
              )}
              {hasMoreInviteCharacters && (
                <button
                  type="button"
                  onClick={() => setInviteCharacterLimit((limit) => limit + NOODLE_INVITE_PAGE_SIZE)}
                  className="w-full px-3 py-2 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                >{localizeUi("ui.noodle.noodlehome.loadMore")}{visibleInviteCharacters.length} {localizeUi("ui.noodle.noodlehome.of")} {filteredCharacters.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {settings && (
        <>
          <Section
            title={localizeUi("ui.noodle.noodlehome.refresh")}
            help={localizeUi("ui.noodle.noodlehome.controlsTheModelConnectionAndHowOftenNoodleCan")}
          >
            <div className="space-y-3">
              <div
                className="flex items-start gap-2 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2.5 text-xs leading-5 text-[var(--muted-foreground)]"
                role="note"
              >
                <AlertTriangle className="mt-0.5 shrink-0 text-[var(--warning)]" size={14} />
                <p>{localizeUi("ui.noodle.noodlehome.contextWindowWarning")}</p>
              </div>
              <label className="block space-y-1.5">
                <FieldLabel help={localizeUi("ui.noodle.noodlehome.theTextGenerationConnectionUsedToWriteNewNoodle")}>{localizeUi("ui.noodle.noodlehome.generationConnection")}</FieldLabel>
                <select
                  value={settings.generationConnectionId ?? ""}
                  onChange={(event) => saveSettings({ generationConnectionId: event.target.value || null })}
                  className={fieldClass}
                >
                  <option value="">{localizeUi("ui.noodle.noodlehome.chooseConnection")}</option>
                  {connections.map((connection) => (
                    <option key={String(connection.id)} value={String(connection.id)}>
                      {String(connection.name ?? connection.model ?? "Connection")}
                    </option>
                  ))}
                </select>
              </label>
              <NumberSetting
                label={localizeUi("ui.noodle.noodlehome.refreshesDay")}
                help={localizeUi("ui.noodle.noodlehome.howManyAutomaticTimelineRefreshesNoodleSchedulesPerLocal")}
                value={settings.refreshesPerDay}
                min={0}
                max={24}
                onCommit={(value) => saveSettings({ refreshesPerDay: value })}
              />
              {scheduler && (
                <div
                  className="rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--noodle-accent)]/5 px-3 py-2.5 text-xs"
                  data-component="NoodleView.RefreshSchedule"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-semibold text-[var(--foreground)]">
                      <RefreshCw size={14} />{localizeUi("ui.noodle.noodlehome.automaticSchedule")}</span>
                    {scheduler.refreshesPerDay > 0 && (
                      <span className="shrink-0 text-[var(--muted-foreground)]">
                        {scheduler.completedSlots}/{scheduler.refreshesPerDay} {localizeUi("ui.noodle.noodlehome.slots")}</span>
                    )}
                  </div>
                  <p className="mt-1.5 leading-5 text-[var(--muted-foreground)]">{noodleSchedulerSummary(scheduler)}</p>
                  {(scheduler.timezone === "Etc/Unknown" || scheduler.timezone === "local") && (
                    <div
                      className="mt-2 flex gap-2 rounded-md bg-[var(--destructive)]/10 px-2.5 py-2 leading-5 text-[var(--foreground)]"
                      role="alert"
                    >
                      <AlertTriangle className="mt-0.5 shrink-0 text-[var(--destructive)]" size={14} />
                      <p>{localizeUi("ui.noodle.noodlehome.theServerTimezoneCouldNotBeDetectedRemoveA")} <code>TZ=</code> {localizeUi("ui.noodle.noodlehome.fromYour")}{" "}
                        <code>.env</code>{localizeUi("ui.noodle.noodlehome.orSetAnIanaTimezoneSuchAs")} <code>TZ=Europe/Warsaw</code>{localizeUi("ui.noodle.noodlehome.thenRestartMarinara")}</p>
                    </div>
                  )}
                  {scheduler.scheduledTimes.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[0.68rem] font-semibold text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.plannedTimes")}{scheduler.timezone})
                      </p>
                      <div className="mt-1 max-h-52 divide-y divide-[var(--noodle-divider)] overflow-y-auto border-y border-[var(--noodle-divider)]">
                        {scheduler.scheduledTimes.map((time, index) => {
                          const completed = (scheduler.completedTimes ?? []).includes(time);
                          const editing = editingRefreshTime === time;
                          const originalClockTime = formatNoodleRefreshTimeInput(time, scheduler.timezone);
                          return (
                            <div
                              key={time}
                              className="flex min-h-10 items-center gap-2 py-1.5"
                              data-noodle-schedule-slot={time}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="mr-2 text-[var(--muted-foreground)]">{index + 1}.</span>
                                <span className="font-semibold text-[var(--foreground)]">
                                  {formatNoodleRefreshTime(time, scheduler.timezone)}
                                </span>
                              </span>
                              {completed ? (
                                <span className="shrink-0 text-[0.65rem] font-semibold text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.completed")}</span>
                              ) : editing ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <input
                                    type="time"
                                    value={refreshTimeDraft}
                                    onChange={(event) => setRefreshTimeDraft(event.target.value)}
                                    aria-label={localizeUi("ui.noodle.noodlehome.newTimeForRefreshValue1", { value1: index + 1 })}
                                    className="mari-chrome-field h-8 w-[6.5rem] rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--noodle-accent)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={cancelRefreshTimeEdit}
                                    disabled={rescheduleRefresh.isPending}
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
                                    title={localizeUi("chat.delete.dialog.cancel")}
                                    aria-label={localizeUi("ui.noodle.noodlehome.cancelReschedule")}
                                  >
                                    <X size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveRefreshTimeEdit}
                                    disabled={
                                      rescheduleRefresh.isPending ||
                                      !refreshTimeDraft ||
                                      refreshTimeDraft === originalClockTime
                                    }
                                    className="h-8 rounded-full bg-[var(--noodle-accent)] px-3 text-[0.68rem] font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {rescheduleRefresh.isPending ?localizeUi("ui.noodle.noodlehome.saving") :localizeUi("ui.noodle.noodlehome.save")}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => beginRefreshTimeEdit(time)}
                                  disabled={rescheduleRefresh.isPending}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
                                  title={localizeUi("ui.noodle.noodlehome.rescheduleValue1", { value1: formatNoodleRefreshTime(time, scheduler.timezone) })}
                                  aria-label={localizeUi("ui.noodle.noodlehome.rescheduleRefreshValue1", { value1: index + 1 })}
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {scheduler.lastError && (
                    <div
                      className="mt-2 flex gap-2 rounded-md bg-[var(--destructive)]/10 px-2.5 py-2 leading-5 text-[var(--foreground)]"
                      role="alert"
                    >
                      <AlertTriangle className="mt-0.5 shrink-0 text-[var(--destructive)]" size={14} />
                      <div className="min-w-0">
                        <p className="line-clamp-3">{scheduler.lastError}</p>
                        {scheduler.nextAttemptAt && (
                          <p className="mt-1 text-[var(--muted-foreground)]">
                            {localizeUi("ui.noodle.scheduler.retryAt", {
                              time: formatNoodleRefreshTime(scheduler.nextAttemptAt, scheduler.timezone),
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.activeAccounts")}
            help={localizeUi("ui.noodle.noodlehome.controlsHowManyEligibleCharactersOrRandomUsersAre")}
          >
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <FieldLabel help={localizeUi("ui.noodle.noodlehome.selectsHowManyInvitedCharactersOrRandomUsersAre")}>{localizeUi("ui.noodle.noodlehome.activeSelection")}</FieldLabel>
                <select
                  value={settings.participantSelectionMode}
                  onChange={(event) =>
                    saveSettings({
                      participantSelectionMode: event.target
                        .value as NoodleSettingsUpdateInput["participantSelectionMode"],
                    })
                  }
                  className={fieldClass}
                >
                  <option value="random_range">{localizeUi("ui.noodle.noodlehome.randomRange")}</option>
                  <option value="exact">{localizeUi("ui.noodle.noodlehome.exactCount")}</option>
                  <option value="all">{localizeUi("ui.noodle.noodlehome.allInvited")}</option>
                </select>
              </label>
              {settings.participantSelectionMode === "random_range" && (
                <div className="grid grid-cols-2 gap-2">
                  <NumberSetting
                    label={localizeUi("ui.noodle.noodlehome.minActive")}
                    help={localizeUi("ui.noodle.noodlehome.lowestNumberOfEligibleCharacterOrRandomUserAccounts")}
                    value={settings.participantMin}
                    min={1}
                    max={100}
                    onCommit={(value) => saveSettings({ participantMin: value })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.noodle.noodlehome.maxActive")}
                    help={localizeUi("ui.noodle.noodlehome.highestNumberOfEligibleCharacterOrRandomUserAccounts")}
                    value={settings.participantMax}
                    min={1}
                    max={100}
                    onCommit={(value) => saveSettings({ participantMax: value })}
                  />
                </div>
              )}
              {settings.participantSelectionMode === "exact" && (
                <NumberSetting
                  label={localizeUi("ui.noodle.noodlehome.activeCount")}
                  help={localizeUi("ui.noodle.noodlehome.exactNumberOfEligibleCharacterOrRandomUserAccounts")}
                  value={settings.participantMax}
                  min={1}
                  max={100}
                  onCommit={(value) => saveSettings({ participantMin: value, participantMax: value })}
                />
              )}
            </div>
          </Section>

          <Section title={localizeUi("ui.noodle.noodlehome.activity")} help={localizeUi("ui.noodle.noodlehome.limitsHowMuchGeneratedNoodleActivityOneRefreshMay")}>
            <div className="grid grid-cols-2 gap-2">
              <NumberSetting
                label={localizeUi("ui.noodle.noodlehome.posts")}
                help={localizeUi("ui.noodle.noodlehome.maximumNewTopLevelPostsTheModelMayCreate")}
                value={settings.maxGeneratedPostsPerRefresh}
                min={0}
                max={100}
                onCommit={(value) => saveSettings({ maxGeneratedPostsPerRefresh: value })}
              />
              <NumberSetting
                label={localizeUi("ui.noodle.noodlehome.replies")}
                help={localizeUi("ui.noodle.noodlehome.maximumReplyInteractionsTheModelMayAddInOne")}
                value={settings.maxRepliesPerRefresh}
                min={0}
                max={200}
                onCommit={(value) => saveSettings({ maxRepliesPerRefresh: value })}
              />
              <NumberSetting
                label={localizeUi("ui.noodle.noodlehome.reposts")}
                help={localizeUi("ui.noodle.noodlehome.maximumRepostInteractionsTheModelMayAddInOne")}
                value={settings.maxRepostsPerRefresh}
                min={0}
                max={100}
                onCommit={(value) => saveSettings({ maxRepostsPerRefresh: value })}
              />
              <NumberSetting
                label={localizeUi("ui.noodle.noodlehome.likes")}
                help={localizeUi("ui.noodle.noodlehome.maximumLikeInteractionsTheModelMayAddInOne")}
                value={settings.maxLikesPerRefresh}
                min={0}
                max={500}
                onCommit={(value) => saveSettings({ maxLikesPerRefresh: value })}
              />
            </div>
          </Section>

          <Section
            title={localizeUi("settings.sections.imageGeneration.title")}
            help={localizeUi("ui.noodle.noodlehome.controlsGeneratedPostImagesAndWhetherCharactersCanReuse")}
          >
            <div className="space-y-3">
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.imageGeneration")}
                help={localizeUi("ui.noodle.noodlehome.generatesActualPostImagesFromNoodleVisualRequestsUsing")}
                checked={settings.enableImagePrompts}
                disabled={updateSettings.isPending}
                onChange={(checked) => saveSettings({ enableImagePrompts: checked })}
              />
              {settings.enableImagePrompts && (
                <>
                  <label className="block space-y-1.5">
                    <FieldLabel help={localizeUi("ui.noodle.noodlehome.theImageGenerationConnectionUsedToCreateNoodlePost")}>{localizeUi("ui.noodle.noodlehome.imageGenerationConnection")}</FieldLabel>
                    <select
                      value={settings.imageGenerationConnectionId ?? ""}
                      onChange={(event) => saveSettings({ imageGenerationConnectionId: event.target.value || null })}
                      className={fieldClass}
                    >
                      <option value="">{localizeUi("ui.noodle.noodlehome.defaultImageGenerationConnection")}</option>
                      {imageConnections.map((connection) => (
                        <option key={String(connection.id)} value={String(connection.id)}>
                          {String(connection.name ?? connection.model ?? "Image connection")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <FieldLabel help={localizeUi("ui.noodle.noodlehome.extraInstructionsPassedIntoTheNoodlePostImagePrompt")}>{localizeUi("ui.noodle.noodlehome.promptInstructions")}</FieldLabel>
                    <textarea
                      value={imageGenerationPromptDraft}
                      onChange={(event) => setImageGenerationPromptDraft(event.target.value)}
                      onBlur={() => {
                        if (imageGenerationPromptDraft !== settings.imageGenerationPrompt) {
                          saveSettings({ imageGenerationPrompt: imageGenerationPromptDraft });
                        }
                      }}
                      className={textareaClass}
                    />
                  </label>
                  <ToggleSetting
                    label={localizeUi("ui.noodle.noodlehome.useAvatarReferences")}
                    help={localizeUi("ui.noodle.noodlehome.sendsCharacterAvatarsOrPreferredFullBodyReferencesTo")}
                    checked={settings.imageGenerationUseAvatarReferences}
                    disabled={updateSettings.isPending}
                    onChange={(checked) => saveSettings({ imageGenerationUseAvatarReferences: checked })}
                  />
                  <ToggleSetting
                    label={localizeUi("ui.noodle.noodlehome.includeDescriptions")}
                    help={localizeUi("ui.noodle.noodlehome.addsCharacterAppearanceAndDescriptionNotesToTheFinal")}
                    checked={settings.imageGenerationIncludeDescriptions}
                    disabled={updateSettings.isPending}
                    onChange={(checked) => saveSettings({ imageGenerationIncludeDescriptions: checked })}
                  />
                  <NumberSetting
                    label={localizeUi("ui.noodle.noodlehome.imagesRefresh")}
                    help={localizeUi("ui.noodle.noodlehome.maximumNumberOfGeneratedPostImagesNoodleMayCreate")}
                    value={settings.maxImagesPerRefresh}
                    min={0}
                    max={50}
                    onCommit={(value) => saveSettings({ maxImagesPerRefresh: value })}
                  />
                </>
              )}
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.attachGalleryImages")}
                help={localizeUi("ui.noodle.noodlehome.letsCharactersAttachExistingImagesFromTheirOwnGalleries")}
                checked={settings.allowGalleryImageAttachments}
                disabled={updateSettings.isPending}
                onChange={(checked) => saveSettings({ allowGalleryImageAttachments: checked })}
              />
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.imageUnderstanding")}
            help={localizeUi("ui.noodle.noodlehome.letsAVisionCapableConnectionDescribeTimelineImagesFor")}
          >
            <div className="space-y-3">
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.imageCaptioning")}
                help={localizeUi("ui.noodle.noodlehome.convertsTimelineImagesIntoConciseDescriptionsBeforeRefreshGeneration")}
                checked={effectiveImageCaptioningEnabled}
                disabled={updateSettings.isPending || connections.length === 0}
                onChange={(checked) =>
                  saveSettings({
                    imageCaptioningEnabled: checked,
                    imageCaptioningConnectionId: checked ? effectiveImageCaptioningConnectionId : null,
                    imageCaptioningUseConnectionDefault: false,
                  })
                }
              />
              {effectiveImageCaptioningEnabled && (
                <label className="block space-y-1.5">
                  <FieldLabel help={localizeUi("ui.noodle.noodlehome.chooseAVisionCapableTextConnectionDefaultUsesThe")}>{localizeUi("ui.noodle.noodlehome.captioningConnection")}</FieldLabel>
                  <select
                    value={effectiveImageCaptioningConnectionId ?? ""}
                    onChange={(event) =>
                      saveSettings({
                        imageCaptioningEnabled: true,
                        imageCaptioningConnectionId: event.target.value || null,
                        imageCaptioningUseConnectionDefault: false,
                      })
                    }
                    className={fieldClass}
                  >
                    <option value="">{localizeUi("ui.noodle.noodlehome.useNoodleGenerationConnection")}</option>
                    {connections.map((connection) => (
                      <option key={String(connection.id)} value={String(connection.id)}>
                        {String(connection.name ?? connection.model ?? "Connection")}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!settings.imageCaptioningUseConnectionDefault && (
                <button
                  type="button"
                  onClick={() =>
                    saveSettings({
                      imageCaptioningEnabled: false,
                      imageCaptioningConnectionId: null,
                      imageCaptioningUseConnectionDefault: true,
                    })
                  }
                  disabled={updateSettings.isPending}
                  className="w-full rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                >
                  {localizeUi("ui.noodle.noodlehome.useConnectionDefault")}
                </button>
              )}
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.timelineWriting")}
            help={localizeUi("ui.noodle.noodlehome.tunesHowTheRefreshWriterApproachesToneAndLong")}
          >
            <div className="space-y-3">
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.enhancedToneContinuity")}
                help={localizeUi("ui.noodle.noodlehome.whenOnEachAccountSVoiceIsGroundedMore")}
                checked={settings.enableEnhancedTimelineWriting}
                disabled={updateSettings.isPending}
                onChange={(checked) => saveSettings({ enableEnhancedTimelineWriting: checked })}
              />
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.useGeneratedCharacterSchedules")}
                help={localizeUi("ui.noodle.noodlehome.includesEachParticipatingCharacterSAlreadyGeneratedConversationSchedule")}
                checked={settings.includeCharacterSchedules}
                disabled={updateSettings.isPending}
                onChange={(checked) => saveSettings({ includeCharacterSchedules: checked })}
              />
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.worldLore")}
            help={localizeUi("ui.noodle.noodlehome.letsNoodleRefreshesPullMatchingLorebookEntriesIntoThe")}
          >
            <div className="space-y-3">
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.lorebookContext")}
                help={localizeUi("ui.noodle.noodlehome.scansRecentNoodleActivityAndCharacterProfilesForLorebook")}
                checked={settings.enableLorebookContext}
                disabled={updateSettings.isPending}
                onChange={(checked) => saveSettings({ enableLorebookContext: checked })}
              />
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.carryover")}
            help={localizeUi("ui.noodle.noodlehome.controlsWhetherRecentNoodleActivityIsAppendedToChat")}
          >
            <div className="space-y-3">
              <div className="space-y-2">
                <FieldLabel help={localizeUi("ui.noodle.noodlehome.toggleEachModeThatShouldReceiveRecentNoodleActivity")}>{localizeUi("ui.noodle.noodlehome.carryoverToChats")}</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-3">
                  <ToggleSetting
                    label={localizeUi("settings.modes.conversations")}
                    compact
                    checked={carryoverTargets.has("conversation")}
                    disabled={updateSettings.isPending}
                    onChange={(checked) => toggleCarryoverTarget("conversation", checked)}
                  />
                  <ToggleSetting
                    label={localizeUi("ui.noodle.noodlehome.roleplays")}
                    compact
                    checked={carryoverTargets.has("roleplay")}
                    disabled={updateSettings.isPending}
                    onChange={(checked) => toggleCarryoverTarget("roleplay", checked)}
                  />
                  <ToggleSetting
                    label={localizeUi("ui.noodle.noodlehome.games")}
                    compact
                    checked={carryoverTargets.has("game")}
                    disabled={updateSettings.isPending}
                    onChange={(checked) => toggleCarryoverTarget("game", checked)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberSetting
                  label={localizeUi("ui.noodle.noodlehome.carryHours")}
                  help={localizeUi("ui.noodle.noodlehome.howFarBackNoodleLooksForActivityDigestsWhen")}
                  value={settings.carryoverHours}
                  min={1}
                  max={720}
                  onCommit={(value) => saveSettings({ carryoverHours: value })}
                />
                <NumberSetting
                  label={localizeUi("ui.noodle.noodlehome.carryItems")}
                  help={localizeUi("ui.noodle.noodlehome.maximumNumberOfRecentNoodleActivitySummariesAppendedTo")}
                  value={settings.carryoverMaxItems}
                  min={1}
                  max={50}
                  onCommit={(value) => saveSettings({ carryoverMaxItems: value })}
                />
              </div>
            </div>
          </Section>

          <Section
            title={localizeUi("ui.noodle.noodlehome.noodlerAccess")}
            help={localizeUi("ui.noodle.noodlehome.keepsNoodlerCreatorAccountsIsolatedFromThePublicNoodle")}
          >
            <div className="space-y-3">
              <ToggleSetting
                label={localizeUi("ui.noodle.noodlehome.enableNoodler")}
                help={localizeUi("ui.noodle.noodlehome.optInToNoodlerCreatorAccountsTurningThisOff")}
                checked={settings.enableNoodler}
                disabled={updateSettings.isPending}
                onChange={(checked) => {
                  if (checked) void openNoodlerVerification();
                  else saveSettings({ enableNoodler: false });
                }}
              />
              <p className="rounded-lg border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/10 px-3 py-2 text-xs leading-5 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.noodlerIsStillBeingImplementedAndIsNotUsable")}</p>
              {settings.enableNoodler && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={openNoodler}
                    className="flex min-h-10 w-full items-center justify-center rounded-md border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 px-3 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/15"
                  >{localizeUi("ui.noodle.noodlehome.openNoodler")}</button>
                  <button
                    type="button"
                    onClick={() => onNavigate({ mode: "noodler", view: "profiles" })}
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 px-3 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/15"
                  >
                    <Settings2 size={15} />{localizeUi("ui.noodle.noodlehome.manageStageProfiles")}</button>
                </div>
              )}
            </div>
          </Section>

          {settings.enableNoodler && (
            <Section
              accent={NOODLE_PINK}
              title={localizeUi("ui.noodle.noodlehome.noodlerAutomation")}
              help={localizeUi("ui.noodle.noodlehome.sharedCreativeGuidanceForEveryGeneratedNoodlerPostPlus")}
            >
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <FieldLabel help={localizeUi("ui.noodle.noodlehome.prependedToEveryNoodlerPostGenerationUseIt")}>{localizeUi("ui.noodle.noodlehome.generationGuidance")}</FieldLabel>
                  <textarea
                    value={noodlerGenerationGuidanceDraft}
                    onChange={(event) => setNoodlerGenerationGuidanceDraft(event.target.value)}
                    onBlur={() => {
                      if (noodlerGenerationGuidanceDraft !== settings.noodlerGenerationGuidance) {
                        saveSettings({ noodlerGenerationGuidance: noodlerGenerationGuidanceDraft });
                      }
                    }}
                    className={textareaClass}
                  />
                </label>

                <div className="space-y-1.5">
                  <FieldLabel help={localizeUi("ui.noodle.noodlehome.seeEveryManagedCreatorSAutomaticPostingStateAt")}>{localizeUi("ui.noodle.noodlehome.creatorSchedules")}</FieldLabel>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {noodlerScheduleSummary}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={noodlerCreatorCount === 0}
                      onClick={() => setScheduleManagerOpen(true)}
                      className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--noodle-accent)]/40 bg-[var(--noodle-accent)]/10 px-3 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CalendarClock size={15} />
                      {noodlerCreatorCount === 0 ?localizeUi("ui.noodle.noodlehome.noCreatorsToScheduleYet") :localizeUi("ui.noodle.noodlehome.manageSchedules")}
                    </button>
                    <NoodlerBulkCreateButton label={localizeUi("ui.noodle.noodlehome.addCreators")} />
                  </div>
                </div>
              </div>
            </Section>
          )}

          <Section
            title={localizeUi("ui.noodle.noodlehome.resetNoodle")}
            help={localizeUi("ui.noodle.noodlehome.clearsTimelineContentWhileKeepingProfilesFollowsInvitesAnd")}
          >
            <button
              type="button"
              onClick={resetTimeline}
              disabled={resetNoodleTimeline.isPending}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--noodle-accent)]/60 hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resetNoodleTimeline.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} className="text-[var(--noodle-accent)]" />
              )}
              {resetNoodleTimeline.isPending ?localizeUi("ui.noodle.noodlehome.resettingNoodle") :localizeUi("ui.noodle.noodlehome.resetNoodleTimeline")}
            </button>
          </Section>
        </>
      )}

      <NoodlerScheduleManagerModal open={scheduleManagerOpen} onClose={() => setScheduleManagerOpen(false)} />
    </>
  );

  const renderPostArticle = (post: NoodlePost) => (
    <NoodlePostCard
      key={post.id}
      post={{ ...post, title: null, interactions: interactionsByPostId.get(post.id) ?? [] }}
      ctx={{
        postManagement: true,
        accountById,
        accountByHandle,
        personaAccount,
        postMenuId,
        setPostMenuId,
        editingPostId,
        editingPostContent,
        setEditingPostContent,
        pollEditing: {
          value: editingPostPoll,
          setValue: setEditingPostPoll,
        },
        allowPollOnlyEdits: true,
        replyPostId,
        replyParentInteractionId,
        replyText,
        replyHasText,
        setReplyText,
        activeReplyComposerTool,
        setActiveReplyComposerTool,
        highlightedInteractionId,
        mediaPickerTab,
        setMediaPickerTab,
        replyComposerRef,
        replyValueRef,
        replyMediaToolRef,
        openProfile,
        startEditingPost,
        deleteNoodlePost,
        cancelEditingPost,
        saveEditedPost,
        reactToPost,
        reactToReply,
        voteInPoll,
        openReplyComposer,
        handleReplyChange,
        handleReplyKeyDown,
        clearReplyComposer,
        submitReply,
        appendToReply,
        reactionPendingFor,
        createInteractionPendingFor,
        updatePostPending: updatePost.isPending || uploadGlobalImages.isPending,
        imageEditing: postImageEditor.cap,
        media: {
          setImageLightbox,
          replyImageUrl,
          setReplyImageUrl,
          replyImageUrlDraft,
          setReplyImageUrlDraft,
          replyImageToolRef,
          replyImageFileRef,
          applyReplyImageUrl,
          uploadGlobalImages,
        },
        replyManagement: {
          editingReplyId,
          editingReplyContent,
          setEditingReplyContent,
          startEditingReply,
          cancelEditingReply,
          saveEditedReply,
          deleteNoodleReply,
          updateInteraction,
          deleteInteraction,
        },
        mentions: {
          activeReplyMention,
          activeReplyMentionIndex,
          replyMentionSuggestions,
          selectReplyMention,
        },
      }}
    />
  );

  const renderAccountRow = (account: NoodleAccount, options?: { showFollowButton?: boolean }) => {
    const followable = canFollowAccount(account);
    const followed = followedAccountIds.has(account.id);
    return (
      <div
        key={account.id}
        className="flex items-start gap-3 border-b border-[var(--noodle-divider)] px-4 py-3 last:border-b-0"
      >
        <button
          type="button"
          onClick={() => openProfile(account)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left transition-colors hover:text-[var(--noodle-accent)]"
        >
          <Avatar account={account} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{account.displayName}</span>
            <span className="block truncate text-sm text-[var(--muted-foreground)]">@{account.handle}</span>
            {account.bio.trim() && (
              <span className="mt-1 line-clamp-2 block text-sm leading-5 text-[var(--foreground)]">{account.bio}</span>
            )}
          </span>
        </button>
        {options?.showFollowButton && followable ? (
          <button
            type="button"
            onClick={() => updateFollowedAccount(account, !followed)}
            disabled={updateAccountFollow.isPending}
            className={cn(
              "mt-1 h-8 shrink-0 rounded-full px-4 text-xs font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
              followed
                ? "border border-[var(--noodle-divider)] text-[var(--foreground)]"
                : "bg-[var(--foreground)] text-[var(--background)]",
            )}
          >
            {followed ?localizeUi("ui.noodle.connections.tabs.following") :localizeUi("ui.noodle.noodlehome.follow")}
          </button>
        ) : null}
      </div>
    );
  };

  const renderFollowNotification = (item: (typeof notificationFollowAccounts)[number]) => (
    <div key={item.account.id} className="flex items-start gap-3 border-b border-[var(--noodle-divider)] px-4 py-4">
      <button
        type="button"
        onClick={() => openProfile(item.account)}
        className="rounded-full transition-opacity hover:opacity-80"
        title={localizeUi("ui.noodle.noodlehome.viewValue1", { value1: item.account.handle })}
      >
        <Avatar account={item.account} />
      </button>
      <button
        type="button"
        onClick={() => openProfile(item.account)}
        className="min-w-0 flex-1 text-left transition-colors hover:text-[var(--noodle-accent)]"
      >
        <span className="block truncate text-sm font-bold">{item.account.displayName}</span>
        <span className="block truncate text-sm text-[var(--muted-foreground)]">@{item.account.handle}</span>
        <span className="mt-1 block text-sm leading-5">{localizeUi("ui.noodle.noodlehome.followedYou")}</span>
      </button>
    </div>
  );

  const renderLikeNotification = (item: (typeof notificationLikes)[number]) => {
    const actor = item.actorAccount ?? item.actorSnapshot;
    return (
      <div
        key={item.interaction.id}
        className="flex items-start gap-3 border-b border-[var(--noodle-divider)] px-4 py-4"
      >
        {actor ? (
          <button
            type="button"
            onClick={() => openProfile(item.actorAccount)}
            disabled={!item.actorAccount}
            className="rounded-full transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={item.actorAccount ?localizeUi("ui.noodle.noodlehome.viewValue1", { value1: item.actorAccount.handle }) : undefined}
          >
            <Avatar account={actor} />
          </button>
        ) : (
          <Heart size={28} className="text-[var(--noodle-accent)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => openProfile(item.actorAccount)}
              disabled={!item.actorAccount}
              className="font-bold transition-colors enabled:hover:text-[var(--noodle-accent)] disabled:cursor-default"
            >
              {actor?.displayName ?? "Noodle User"}
            </button>
            <span className="text-xs text-[var(--muted-foreground)]">@{actor?.handle ?? "noodle"}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{formatTime(item.interaction.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm">{localizeUi("ui.noodle.noodlehome.likedYour")} {item.targetReply ?localizeUi("ui.noodle.noodlehome.comment") :localizeUi("ui.noodle.noodlehome.post_9b46609")}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--muted-foreground)]">
            {item.targetReply?.content || (item.targetReply?.imageUrl ? "Shared an image." : item.post.content)}
          </p>
        </div>
      </div>
    );
  };

  const renderReplyNotification = (item: (typeof notificationReplyItems)[number]) => {
    const actor = item.actorAccount ?? item.actorSnapshot;
    return (
      <div key={item.id} className="flex items-start gap-3 border-b border-[var(--noodle-divider)] px-4 py-4">
        {actor ? (
          <button
            type="button"
            onClick={() => openProfile(item.actorAccount)}
            disabled={!item.actorAccount}
            className="rounded-full transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
            title={item.actorAccount ?localizeUi("ui.noodle.noodlehome.viewValue1", { value1: item.actorAccount.handle }) : undefined}
          >
            <Avatar account={actor} />
          </button>
        ) : (
          <MessageCircle size={28} className="text-[var(--noodle-accent)]" />
        )}
        <button
          type="button"
          onClick={() => openNotificationTarget(item.post.id, item.interactionId)}
          data-noodle-notification-target={item.interactionId ?? item.post.id}
          data-noodle-notification-kind={item.kind}
          className="-m-2 min-w-0 flex-1 rounded-lg p-2 text-left outline-none transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
          title={item.kind === "reply" ?localizeUi("ui.noodle.noodlehome.openReplyInTimeline") :localizeUi("ui.noodle.noodlehome.openPostInTimeline")}
          aria-label={
            item.kind === "reply"
              ?localizeUi("ui.noodle.noodlehome.openReplyFromValue1InTimeline", { value1: actor?.displayName ??localizeUi("ui.noodle.noodlepostcard.noodleUser") })
              :localizeUi("ui.noodle.noodlehome.openMentionFromValue1InTimeline", { value1: actor?.displayName ??localizeUi("ui.noodle.noodlepostcard.noodleUser") })
          }
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold">{actor?.displayName ?? "Noodle User"}</span>
            <span className="text-xs text-[var(--muted-foreground)]">@{actor?.handle ?? "noodle"}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{formatTime(item.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm">
            {item.kind === "reply" ?localizeUi("ui.noodle.noodlehome.repliedToYourValue1", { value1: item.replyTarget ??localizeUi("ui.noodle.noodlehome.post_9b46609") }) :localizeUi("ui.noodle.noodlehome.mentionedYou")}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{item.content}</p>
          {item.kind === "reply" && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">{item.post.content}</p>
          )}
        </button>
      </div>
    );
  };

  const renderComposerToolPopovers = ({
    imageRef,
    pollRef,
    mediaRef,
  }: {
    imageRef: RefObject<HTMLDivElement | null>;
    pollRef: RefObject<HTMLDivElement | null>;
    mediaRef: RefObject<HTMLDivElement | null>;
  }) => (
    <>
      {activeComposerTool === "image" && (
        <NoodleAnchoredPopover anchorRef={imageRef} modalOwned={composeOpen} wide>
          <NoodleImageComposer
            imageUrl={imageUrlDraft}
            onImageUrlChange={setImageUrlDraft}
            onChooseFile={() => imageFileRef.current?.click()}
            onUseImageUrl={applyImageUrl}
          onClose={() => setActiveComposerTool(null)}
              disabled={uploadGlobalImages.isPending}
            hasImage={Boolean(attachedImage || pendingImage)}
            fileActionLabel={uploadGlobalImages.isPending ? "Uploading…" : "Upload from device"}
              />
        </NoodleAnchoredPopover>
      )}
      {activeComposerTool === "poll" && (
        <NoodleAnchoredPopover anchorRef={pollRef} modalOwned={composeOpen} wide>
          <NoodlePollComposer
            value={pollEditorValue}
            onChange={setPollEditorValue}
          onClose={() => setActiveComposerTool(null)}
            onSubmit={applyPoll}
            submitLabel={draftPoll ? "Update poll" : "Add poll"}
          modalOwned={composeOpen}
                />
        </NoodleAnchoredPopover>
      )}
      {activeComposerTool === "media" && (
        <NoodleAnchoredPopover anchorRef={mediaRef} modalOwned={composeOpen} wide>
          <ConversationMediaPickerPanel
            tabs={NOODLE_MEDIA_PICKER_TABS}
            activeTab={mediaPickerTab}
            onActiveTabChange={setMediaPickerTab}
            onClose={() => setActiveComposerTool(null)}
            onEmojiSelect={appendToComposer}
            onGifSelect={(gifUrl) => {
              setPendingImage(null);
              setAttachedImage({ url: gifUrl, crop: null });
              setActiveComposerTool(null);
            }}
            onStickerSelect={(name) => {
              appendToComposer(`sticker:${name}:`);
              setActiveComposerTool(null);
            }}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </NoodleAnchoredPopover>
      )}
    </>
  );

  const mobileSearchContent = (
    <div className="min-h-full" data-component="NoodleView.MobileSearch">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-2 py-3 backdrop-blur">
        <MobileTimelineBackButton onClick={openMobileHomeTimeline} />
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors focus-within:ring-[var(--noodle-accent)]">
          <Search size={18} className="shrink-0 !text-[var(--noodle-accent)]" />
          <input
            type="search"
            value={postSearch}
            onChange={(event) => setPostSearch(event.target.value)}
            placeholder={localizeUi("ui.noodle.noodlehome.searchPostsOrUsers")}
            aria-label={localizeUi("ui.noodle.noodlehome.searchNoodle")}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          {postSearch.trim() && (
            <button
              type="button"
              onClick={() => setPostSearch("")}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
              title={localizeUi("ui.noodle.noodlehome.clearSearch")}
              aria-label={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={14} />
            </button>
          )}
        </label>
      </div>

      {rawPostSearch && (
        <section className="border-b border-[var(--noodle-divider)]" aria-labelledby="noodle-mobile-search-results">
          <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
            <h2 id="noodle-mobile-search-results" className="text-lg font-bold">{localizeUi("ui.noodle.noodlehome.searchResults")}</h2>
          </div>
          {isAccountSearch ? (
            accountSearchResults.length > 0 ? (
              <div>{accountSearchResults.map((account) => renderAccountRow(account, { showFollowButton: true }))}</div>
            ) : (
              <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.noAccountsFound")}</p>
            )
          ) : timelinePosts.length > 0 ? (
            <div>{timelinePosts.map(renderPostArticle)}</div>
          ) : (
            <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.noPostsFound")}</p>
          )}
        </section>
      )}

      <section aria-labelledby="noodle-mobile-who-to-follow">
        <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
          <h2 id="noodle-mobile-who-to-follow" className="text-lg font-bold">{localizeUi("ui.noodle.noodlehome.whoToFollow")}</h2>
        </div>
        {suggestedCharacters.length > 0 ? (
          <div className="divide-y divide-[var(--noodle-divider)]">
            {suggestedCharacters.map((character) => (
              <div key={character.accountId} className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => openProfile(character.account)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:text-[var(--noodle-accent)]"
                >
                  <Avatar account={character.account} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{character.name}</span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">@{character.handle}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => updateFollowedAccount(character.account, true)}
                  disabled={updateAccountFollow.isPending}
                  className="h-8 rounded-full bg-[var(--foreground)] px-4 text-xs font-bold text-[var(--background)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >{localizeUi("ui.noodle.noodlehome.follow")}</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-[var(--muted-foreground)]">
            {followableCharacterAccounts.length > 0 ?localizeUi("ui.noodle.noodlehome.youReFollowingEveryone") :localizeUi("ui.noodle.noodlehome.noOneSCookingYet")}
          </p>
        )}
      </section>
    </div>
  );

  const rightRailContent = (
    <aside className="hidden w-[22rem] shrink-0 px-4 py-3 @min-[1280px]:block">
      <div className="sticky top-3 space-y-4">
        <label className="flex h-11 items-center gap-2 rounded-full border border-[var(--noodle-divider)] bg-[var(--background)] px-4 text-sm transition-colors focus-within:border-[var(--noodle-accent)]">
          <Search size={17} className="shrink-0 !text-[var(--noodle-accent)]" />
          <input
            value={postSearch}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={localizeUi("ui.noodle.noodlehome.searchPostsOrUsers")}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
          {postSearch.trim() && (
            <button
              type="button"
              onClick={() => setPostSearch("")}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
              title={localizeUi("ui.noodle.noodlehome.clearSearch")}
            >
              <X size={13} />
            </button>
          )}
        </label>

        <section className="overflow-hidden rounded-2xl border border-[var(--noodle-divider)] bg-[var(--background)]">
          <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
            <h3 className="text-lg font-bold">{localizeUi("ui.noodle.noodlehome.whoToFollow")}</h3>
          </div>
          {suggestedCharacters.length > 0 ? (
            <div className="divide-y divide-[var(--noodle-divider)]">
              {suggestedCharacters.map((character) => (
                <div key={character.accountId} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openProfile(character.account)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:text-[var(--noodle-accent)]"
                  >
                    <Avatar account={character.account} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{character.name}</span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">@{character.handle}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFollowedAccount(character.account, true)}
                    disabled={updateAccountFollow.isPending}
                    className="h-8 rounded-full bg-[var(--foreground)] px-4 text-xs font-bold text-[var(--background)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >{localizeUi("ui.noodle.noodlehome.follow")}</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[var(--muted-foreground)]">
              {followableCharacterAccounts.length > 0 ?localizeUi("ui.noodle.noodlehome.youReFollowingEveryone") :localizeUi("ui.noodle.noodlehome.noOneSCookingYet")}
            </p>
          )}
        </section>
      </div>
    </aside>
  );

  const rightRail =
    activeNoodleView === "settings" ? (
      <aside className="hidden w-[22rem] shrink-0 px-4 py-3 @min-[1280px]:block" aria-hidden="true" />
    ) : (
      rightRailContent
    );

  return (
    <NoodleShell
      appMode="noodle"
      activeView={
        activeNoodleView === "home" ||
        activeNoodleView === "search" ||
        activeNoodleView === "notifications" ||
        activeNoodleView === "profile" ||
        activeNoodleView === "settings"
          ? activeNoodleView
          : null
      }
      personaAccount={personaAccount}
      sortedPersonaAccounts={sortedPersonaAccounts}
      visiblePersonaAccounts={visiblePersonaAccounts}
      linkedNoodleAccountIds={linkedNoodleAccountIds}
      onLoadMorePersonaAccounts={() => setPersonaAccountLimit((current) => current + NOODLE_PERSONA_SWITCHER_PAGE_SIZE)}
      onSwitchPersona={switchPersona}
      accountSwitcherOpen={accountSwitcherOpen}
      onAccountSwitcherOpenChange={setAccountSwitcherOpen}
      accountSwitcherRef={accountSwitcherRef}
      mobileDrawerOpen={mobileDrawerOpen}
      onMobileDrawerOpenChange={setMobileDrawerOpen}
      mobileAccountSwitcherOpen={mobileAccountSwitcherOpen}
      onMobileAccountSwitcherOpenChange={setMobileAccountSwitcherOpen}
      notificationCount={notificationCount}
      enableNoodler={settings?.enableNoodler ?? false}
      onOpenHome={openHomeTimeline}
      onOpenMobileHome={openMobileHomeTimeline}
      onOpenNoodler={openNoodler}
      onOpenSearch={openSearch}
      onOpenNotifications={openNotifications}
      onOpenProfile={openOwnProfile}
      onOpenSettings={openSettings}
      onCompose={openComposeModal}
      rightRail={rightRail}
      overlays={
        <>
          <BrowserChrome />
          <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          <input
            ref={replyImageFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleReplyImageFile}
          />
          {imageLightbox && (
            <ChatImageLightbox
              image={imageLightbox}
              alt={imageLightbox.prompt || "Noodle image"}
              pinEnabled={false}
              onClose={() => setImageLightbox(null)}
            />
          )}
        </>
      }
    >
      <div
        ref={timelineScrollRef}
        data-component="NoodleView.TimelineScroller"
        className="min-h-0 flex-1 overflow-y-auto"
      >
            <div className="min-h-full w-full border-x border-[var(--noodle-divider)] bg-[var(--background)]">
              {activeNoodleView === "home" && (
                <div
                  className="sticky top-0 z-30 grid h-14 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-3 backdrop-blur @min-[1024px]:hidden"
                  data-component="NoodleView.MobileHeader"
                >
                  <button
                    ref={mobileDrawerTriggerRef}
                    type="button"
                    onClick={() => setMobileDrawerOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent)]"
                    title={localizeUi("ui.noodle.noodlehome.openAccountMenu")}
                    aria-label={localizeUi("ui.noodle.noodlehome.openNoodleAccountMenu")}
                  >
                    {personaAccount ? (
                      <Avatar account={personaAccount} size="sm" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25">
                        <AtSign size={18} />
                      </span>
                    )}
                  </button>
                  <NoodleLogo className="mx-auto h-9 w-14" />
                  <span aria-hidden="true" />
                </div>
              )}
              {activeNoodleView === "home" &&
                (isAccountSearch ? (
                  <div className="sticky top-14 z-20 flex h-12 items-center gap-3 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-4 backdrop-blur @min-[1024px]:top-0">
                    <AtSign size={19} className="text-[var(--noodle-accent)]" />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold">{localizeUi("ui.noodle.noodlehome.accounts")}</h2>
                      <p className="truncate text-[0.68rem] text-[var(--muted-foreground)]">
                        {accountSearchTerm ?localizeUi("ui.noodle.noodlehome.value1_0a5edda", { value1: accountSearchTerm }) :localizeUi("ui.noodle.noodlehome.typeAHandleAfter")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="sticky top-14 z-20 grid grid-cols-2 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 backdrop-blur @min-[1024px]:top-0">
                    {TIMELINE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTimelineTab(tab.id)}
                        className={cn(
                          "relative flex h-12 items-center justify-center text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                          timelineTab === tab.id && "text-[var(--foreground)]",
                        )}
                        aria-pressed={timelineTab === tab.id}
                      >
                        {tab.label}
                        {timelineTab === tab.id && (
                          <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}

              {activeNoodleView === "home" && !isAccountSearch && !composeOpen && (
                <NoodleComposerShell
                  dataComponent="NoodleView.InlineComposer"
                  avatar={
                    personaAccount ? (
                      <Avatar account={personaAccount} />
                    ) : (
                      <AtSign size={28} className="text-[var(--noodle-accent)]" />
                    )
                  }
                  tools={
                    <NoodleComposerToolRow
                      image={{
                        ref: imageToolRef,
                        active: activeComposerTool === "image",
                        onClick: () => setActiveComposerTool((current) => (current === "image" ? null : "image")),
                      }}
                      poll={{
                        ref: pollToolRef,
                        active: activeComposerTool === "poll" || Boolean(draftPoll),
                        onClick: togglePollComposer,
                      }}
                      media={{
                        ref: mediaToolRef,
                        active: activeComposerTool === "media",
                        onClick: () => setActiveComposerTool((current) => (current === "media" ? null : "media")),
                      }}
                    />
                  }
                  action={
                    <button
                      type="button"
                      onClick={submitPost}
                      disabled={!canSubmitPost || createPost.isPending}
                      className="h-8 rounded-full bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >{localizeUi("ui.noodle.noodlehome.post")}</button>
                  }
                  popovers={
                    !composeOpen &&
                    renderComposerToolPopovers({
                      imageRef: imageToolRef,
                      pollRef: pollToolRef,
                      mediaRef: mediaToolRef,
                    })
                  }
                >
                  <textarea
                    ref={inlineComposerRef}
                    defaultValue={composer}
                    onChange={handleComposerChange}
                    onBlur={() => setComposer(composerValueRef.current)}
                    onKeyDown={handleComposerKeyDown}
                    disabled={!personaAccount}
                    placeholder={localizeUi("ui.noodle.noodlehome.whatSSimmering")}
                    aria-autocomplete="list"
                    aria-controls={activeMention && !composeOpen ? "noodle-inline-mention-list" : undefined}
                    aria-expanded={Boolean(activeMention && !composeOpen)}
                    aria-activedescendant={
                      activeMention && !composeOpen && mentionSuggestions.length > 0
                    ? `noodle-inline-mention-list-option-${Math.min(activeMentionIndex, mentionSuggestions.length - 1)}`
                        : undefined
                    }
                    className="min-h-20 w-full resize-none border-0 bg-transparent py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-60"
                  />
                  {!composeOpen && renderComposerMentionSuggestions("noodle-inline-mention-list")}
                  {renderDraftPoll()}
              {renderDraftImage(208)}
                </NoodleComposerShell>
              )}

              {activeNoodleView === "home" && !isAccountSearch && (
                <div className="border-b border-[var(--noodle-divider)] px-4 py-2">
                  <button
                    type="button"
                    onClick={triggerRefresh}
                    disabled={refreshNoodle.isPending || !settings || imagePromptReviewItems.length > 0}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    title={scheduler?.lastError ?? localizeUi("ui.noodle.noodlehome.refreshTimeline")}
                    aria-label={localizeUi("ui.noodle.noodlehome.refreshTimeline")}
                  >
                    <span className="relative inline-flex">
                      {refreshNoodle.isPending ? (
                        <Loader2 size={17} className="!text-[var(--noodle-accent)] animate-spin" />
                      ) : (
                        <RefreshCw size={17} className="!text-[var(--noodle-accent)]" />
                      )}
                      {scheduler?.lastError && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--destructive)]" />
                      )}
                    </span>
                    {refreshNoodle.isPending ?localizeUi("ui.noodle.noodlehome.refreshing") :localizeUi("ui.noodle.noodlehome.refreshTimeline")}
                  </button>
                </div>
              )}

              {activeNoodleView === "search" ? (
                mobileSearchContent
              ) : activeNoodleView === "notifications" ? (
                <div className="min-h-full">
                  <div className="sticky top-0 z-20 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 backdrop-blur">
                    <div className="flex min-h-14 items-center gap-3 px-2 py-2 @min-[1024px]:px-4">
                      <MobileTimelineBackButton onClick={openMobileHomeTimeline} />
                      <Bell size={22} className="hidden text-[var(--noodle-accent)] @min-[1024px]:block" />
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold">{localizeUi("settings.sections.notifications.title")}</h2>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          {personaAccount ?localizeUi("ui.noodle.noodlehome.value1_0a5edda", { value1: personaAccount.handle }) :localizeUi("ui.noodle.noodlehome.chooseAPersonaAccount")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3">
                      {NOTIFICATION_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setNotificationTab(tab.id)}
                          className={cn(
                            "relative flex h-12 items-center justify-center text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            notificationTab === tab.id && "text-[var(--foreground)]",
                          )}
                        >
                          {tab.label}
                          {notificationTab === tab.id && (
                            <span className="absolute bottom-0 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {notificationTab === "likes" ? (
                    notificationLikes.length > 0 ? (
                      <div>{notificationLikes.map(renderLikeNotification)}</div>
                    ) : (
                      <div className="px-8 py-14 text-center">
                        <Heart size={38} className="mx-auto mb-4 text-[var(--noodle-accent)]" />
                        <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.noLikesYet")}</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.likesOnYourNoodlePostsWillShowHere")}</p>
                      </div>
                    )
                  ) : notificationTab === "follows" ? (
                    notificationFollowAccounts.length > 0 ? (
                      <div>{notificationFollowAccounts.map(renderFollowNotification)}</div>
                    ) : (
                      <div className="px-8 py-14 text-center">
                        <Bell size={38} className="mx-auto mb-4 text-[var(--noodle-accent)]" />
                        <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.noFollowsYet")}</p>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.accountsFollowingYouWillShowHere")}</p>
                      </div>
                    )
                  ) : notificationReplyItems.length > 0 ? (
                    <div>{notificationReplyItems.map(renderReplyNotification)}</div>
                  ) : (
                    <div className="px-8 py-14 text-center">
                      <MessageCircle size={38} className="mx-auto mb-4 text-[var(--noodle-accent)]" />
                      <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.noRepliesOrMentionsYet")}</p>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.repliesToYourPostsAnd")}{personaAccount?.handle ?? "mentions"} {localizeUi("ui.noodle.noodlehome.willShowHere")}</p>
                    </div>
                  )}
                </div>
              ) : activeNoodleView === "settings" ? (
                <div className="min-h-full">
                  <div className="border-b border-[var(--noodle-divider)] px-2 py-3 @min-[1024px]:px-4 @min-[1024px]:py-5">
                    <div className="flex items-center gap-3">
                      <MobileTimelineBackButton onClick={openMobileHomeTimeline} />
                      <Settings2 size={22} className="hidden text-[var(--noodle-accent)] @min-[1024px]:block" />
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold">{localizeUi("ui.noodle.noodlehome.noodleSettings")}</h2>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          {personaAccount ?localizeUi("ui.noodle.noodlehome.value1_0a5edda", { value1: personaAccount.handle }) :localizeUi("ui.noodle.noodlehome.chooseAPersonaAccount")}
                        </p>
                      </div>
                    </div>
                  </div>
                  {settingsContent}
                </div>
              ) : activeNoodleView === "profile" && profileConnectionTab ? (
                <div className="min-h-full">
                  <div className="sticky top-0 z-20 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 backdrop-blur">
                    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                      <MobileTimelineBackButton onClick={openMobileHomeTimeline} />
                      <button
                        type="button"
                        onClick={() => openProfileConnection(null)}
                        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 @min-[1024px]:flex"
                        title={localizeUi("ui.noodle.noodlehome.backToProfile")}
                        aria-label={localizeUi("ui.noodle.noodlehome.backToProfile")}
                      >
                        <ChevronLeft size={22} />
                      </button>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold">{profilePreviewAccount.displayName}</h2>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          @{profileDisplayHandle || "noodle"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2">
                      {PROFILE_CONNECTION_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => openProfileConnection(tab.id)}
                          className={cn(
                            "relative flex h-12 items-center justify-center text-sm font-bold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                            profileConnectionTab === tab.id && "text-[var(--foreground)]",
                          )}
                        >
                          {tab.label}
                          {profileConnectionTab === tab.id && (
                            <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-[var(--noodle-accent)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {profileConnectionAccounts.length > 0 ? (
                    <div>
                  {profileConnectionAccounts.map((account) => renderAccountRow(account, { showFollowButton: true }))}
                    </div>
                  ) : (
                    <div className="px-8 py-14 text-center">
                      <p className="text-base font-bold">
                        {profileConnectionTab === "following" ?localizeUi("ui.noodle.noodlehome.notFollowingAnyoneYet") :localizeUi("ui.noodle.noodlehome.noFollowersYet")}
                      </p>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.nothingBoilingHereYet")}</p>
                    </div>
                  )}
                </div>
              ) : activeNoodleView === "profile" ? (
                <NoodleProfileSurface
                  mobileHeader={
                    <div className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-2 py-2 backdrop-blur @min-[1024px]:hidden">
                      <MobileTimelineBackButton onClick={openMobileHomeTimeline} />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold">{localizeUi("ui.noodle.noodlehome.profile")}</h2>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      @{profileDisplayHandle || "noodle"}
                    </p>
                      </div>
                    </div>
                  }
                  account={profilePreviewAccount}
                  displayHandle={profileDisplayHandle}
                  banner={{
                    url: profileBannerPreview,
                    canEdit: canEditViewedProfile,
                    uploadTarget: profileUploadTarget,
                    fileRef: bannerFileRef,
                    onFileChange: (event) => handleProfileImageFile("banner", event),
                  }}
                  avatarUpload={{
                    canEdit: canEditViewedProfile,
                    uploadTarget: profileUploadTarget,
                    fileRef: avatarFileRef,
                    onFileChange: (event) => handleProfileImageFile("avatar", event),
                  }}
                  editor={
                    canEditViewedProfile
                      ? {
                          isEditing: isEditingProfile,
                          onStartEditing: () => setProfileEditing(true),
                          onSave: saveProfile,
                          canSave: canSaveProfile && Boolean(viewedProfileAccount),
                          isSaving: updateAccountProfile.isPending,
                          name: profileName,
                          onNameChange: setProfileName,
                          handle: profileHandle,
                          onHandleChange: setProfileHandle,
                          bio: profileBio,
                          onBioChange: setProfileBio,
                          location: profileLocation,
                          onLocationChange: setProfileLocation,
                        }
                      : undefined
                  }
                  followAction={
                    canFollowViewedProfile && viewedProfileAccount
                      ? {
                          followed: viewedProfileFollowed,
                          pending: updateAccountFollow.isPending,
                          onToggle: () => updateFollowedAccount(viewedProfileAccount, !viewedProfileFollowed),
                        }
                      : undefined
                  }
                  secondaryActions={
                    canCreateStageProfileFromViewed && viewedProfileAccount ? (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({
                            mode: "noodler",
                            view: "create-profile",
                            noodleAccountId: viewedProfileAccount.id,
                          })
                        }
                        className="h-9 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                      >{localizeUi("ui.noodle.noodlehome.createStageProfile")}</button>
                    ) : undefined
                  }
                  bioContent={
                    profileBioPreview ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                        <NoodleCustomEmojiText
                          text={profileBioPreview}
                          emojiMap={noodleCustomEmojiMap}
                          keyPrefix={`noodle-profile-bio-${viewedProfileAccount?.id ?? "preview"}`}
                        />
                      </p>
                    ) : null
                  }
                  location={profileLocationPreview}
                  connections={{
                    followingCount: profileFollowingCount,
                    followerCount: profileFollowerCount,
                    onOpenFollowing: () => openProfileConnection("following"),
                    onOpenFollowers: () => openProfileConnection("followers"),
                  }}
                  activeTab={profileTab}
                  onTabChange={setProfileTab}
                  postList={
                    profileVisiblePosts.length > 0 ? (
                      profileVisiblePosts.map(renderPostArticle)
                    ) : (
                      <div className="px-8 py-14 text-center">
                    <p className="text-sm font-semibold text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.nothingBoilingHereYet")}</p>
                      </div>
                    )
                  }
                />
              ) : isLoading ? (
                <div className="space-y-0">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex gap-3 border-b border-[var(--noodle-divider)] px-4 py-4">
                      <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--muted)]" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="h-3 w-40 rounded bg-[var(--muted)]" />
                        <div className="h-3 w-full rounded bg-[var(--muted)]" />
                        <div className="h-3 w-2/3 rounded bg-[var(--muted)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isAccountSearch ? (
                accountSearchResults.length > 0 ? (
              <div>{accountSearchResults.map((account) => renderAccountRow(account, { showFollowButton: true }))}</div>
                ) : (
                  <div className="px-8 py-14 text-center">
                    <AtSign size={38} className="mx-auto mb-4 text-[var(--noodle-accent)]" />
                    <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.noAccountsFound")}</p>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.trySearchingByHandleLikeMari")}</p>
                  </div>
                )
              ) : normalizedPostSearch && timelinePosts.length === 0 ? (
                <div className="px-8 py-14 text-center">
                  <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.noPostsFound")}</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.tryADifferentSearch")}</p>
                </div>
              ) : timelineTab === "following" && baseTimelinePosts.length === 0 ? (
                <div className="px-8 py-14 text-center">
                  <AtSign size={38} className="mx-auto mb-4 text-[var(--noodle-accent)]" />
                  <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.nothingFromFollowedCharactersYet")}</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.followCharactersFromTheSuggestionsPanelThenRefreshNoodle")}</p>
                </div>
              ) : posts.length === 0 ? (
                <div className="px-8 py-14 text-center">
                  <NoodleLogo className="mx-auto mb-5 h-16 w-24 opacity-95" />
                  <p className="text-base font-bold">{localizeUi("ui.noodle.noodlehome.thePlateIsEmpty")}</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">{localizeUi("ui.noodle.noodlehome.goToTheSettingsOnTheLeftFirstInvite")}</p>
                </div>
              ) : (
                timelinePosts.map(renderPostArticle)
              )}
            </div>
      </div>
      <Modal
        open={composeOpen}
        onClose={closeComposeModal}
        title={localizeUi("ui.noodle.noodlehome.newPost")}
        width="max-w-[36rem]"
        initialFocusRef={modalComposerRef}
        restoreFocusRef={composerRestoreFocusRef}
        focusScopePortalSelector="[data-noodle-compose-focus-portal='true']"
        panelClassName={cn("marinara-chat-popover", NOODLE_ICON_SCOPE_CLASS)}
        panelStyle={getNoodleAccentStyle(NOODLE_BLUE)}
      >
        <div data-component="NoodleView.ModalComposer">
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
                {personaAccount ? (
                  <Avatar account={personaAccount} />
                ) : (
                  <AtSign size={28} className="text-[var(--noodle-accent)]" />
                )}
                <div className="min-w-0">
                  <textarea
                    ref={modalComposerRef}
                    defaultValue={composer}
                    onChange={handleComposerChange}
                    onBlur={() => setComposer(composerValueRef.current)}
                    onKeyDown={handleComposerKeyDown}
                    disabled={!personaAccount}
                    placeholder={localizeUi("ui.noodle.noodlehome.whatSSimmering")}
                    aria-autocomplete="list"
                    aria-controls={activeMention ? "noodle-modal-mention-list" : undefined}
                    aria-expanded={Boolean(activeMention)}
                    aria-activedescendant={
                      activeMention && mentionSuggestions.length > 0
                    ? `noodle-modal-mention-list-option-${Math.min(activeMentionIndex, mentionSuggestions.length - 1)}`
                        : undefined
                    }
                    className="min-h-36 w-full resize-none border-0 bg-transparent py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] disabled:opacity-60"
                  />
                  {renderComposerMentionSuggestions("noodle-modal-mention-list")}
                  {renderDraftPoll()}
              {renderDraftImage(240)}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--noodle-divider)] pt-3 pl-14">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <div ref={modalImageToolRef} className="relative">
                    <NoodleToolButton
                      title={localizeUi("ui.noodle.noodlehome.attachImage")}
                      active={activeComposerTool === "image"}
                      onClick={() => setActiveComposerTool((current) => (current === "image" ? null : "image"))}
                    >
                      <ImageIcon size={18} />
                    </NoodleToolButton>
                  </div>
                  <div ref={modalPollToolRef} className="relative">
                    <NoodleToolButton
                      title={draftPoll ?localizeUi("ui.noodle.noodlehome.editPoll") :localizeUi("ui.noodle.noodlehome.createPoll")}
                      active={activeComposerTool === "poll" || Boolean(draftPoll)}
                      onClick={togglePollComposer}
                    >
                      <ListChecks size={18} />
                    </NoodleToolButton>
                  </div>
                  <div ref={modalMediaToolRef} className="relative">
                    <NoodleToolButton
                      title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
                      active={activeComposerTool === "media"}
                      onClick={() => setActiveComposerTool((current) => (current === "media" ? null : "media"))}
                    >
                      <Smile size={18} />
                    </NoodleToolButton>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={submitPost}
                  disabled={!canSubmitPost || createPost.isPending}
                  className="h-9 rounded-full bg-[var(--noodle-accent)] px-6 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createPost.isPending ?localizeUi("ui.noodle.noodlehome.posting") :localizeUi("ui.noodle.noodlehome.post")}
                </button>
                {composeOpen &&
                  renderComposerToolPopovers({
                    imageRef: modalImageToolRef,
                    pollRef: modalPollToolRef,
                    mediaRef: modalMediaToolRef,
                  })}
              </div>
        </div>
      </Modal>
      <ExpandedTextarea
        open={noodlePromptEditorOpen}
        onClose={closeNoodlePromptEditor}
        title={localizeUi("ui.noodle.noodlehome.editNoodlePrompt")}
        value={noodlePromptDraft}
        onChange={setNoodlePromptDraft}
        placeholder={localizeUi("ui.noodle.noodlehome.writeTheBaseInstructionsForNoodleTimelineGeneration")}
        closeLabel="Cancel"
        overlayStyle={getNoodleAccentStyle(NOODLE_BLUE)}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void restoreDefaultNoodlePrompt()}
              disabled={
                resetNoodlePrompt.isPending ||
                (!noodlePromptHasOverride && noodlePromptDraft === noodleDefaultPromptText)
              }
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[var(--noodle-accent)]/35 px-3 text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {resetNoodlePrompt.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}{localizeUi("ui.noodle.noodlehome.restoreDefault")}</button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeNoodlePromptEditor}
                disabled={saveNoodlePrompt.isPending || resetNoodlePrompt.isPending}
                className="min-h-10 flex-1 rounded-md border border-[var(--border)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              >{localizeUi("chat.delete.dialog.cancel")}</button>
              <button
                type="button"
                onClick={() => void saveNoodlePromptDraft()}
                disabled={
                  !noodlePromptDraft.trim() ||
                  !noodlePromptDirty ||
                  saveNoodlePrompt.isPending ||
                  resetNoodlePrompt.isPending
                }
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
              >
                {saveNoodlePrompt.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}{localizeUi("ui.noodle.noodlehome.savePrompt")}</button>
            </div>
          </div>
        }
      />
      {confirmAction && (
        <Modal
          open={Boolean(confirmAction)}
          onClose={() => {
            if (!confirmActionPending) setConfirmAction(null);
          }}
          title={confirmAction.title}
          width="max-w-sm"
          panelClassName={NOODLE_ICON_SCOPE_CLASS}
          panelStyle={getNoodleAccentStyle(NOODLE_BLUE)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--foreground)]">{confirmAction.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={confirmActionPending}
                className="h-9 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] px-4 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >{localizeUi("chat.delete.dialog.cancel")}</button>
              <button
                type="button"
                onClick={confirmNoodleAction}
                disabled={confirmActionPending}
                className={cn(
                  "flex h-9 items-center justify-center gap-2 rounded-md px-4 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  confirmAction.kind === "delete-post" ||
                  confirmAction.kind === "delete-reply" ||
                  confirmAction.kind === "reset-timeline"
                    ? "bg-[var(--destructive)] text-[var(--destructive-foreground)] [&_svg]:!text-[var(--destructive-foreground)] hover:opacity-90"
                    : "border border-[var(--noodle-accent)]/45 bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 hover:bg-[var(--noodle-accent)]/85",
                )}
              >
                {confirmActionPending && <Loader2 size={14} className="animate-spin" />}
                {confirmActionPending ?localizeUi("ui.noodle.noodlehome.working") : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <ImagePromptReviewModal
        open={imagePromptReviewItems.length > 0}
        items={imagePromptReviewItems}
        isSubmitting={confirmNoodleImagePrompts.isPending}
        onCancel={() => setImagePromptReviewItems([])}
        onConfirm={confirmReviewedNoodleImagePrompts}
      />
    </NoodleShell>
  );
}

function NumberSetting({
  label,
  help,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  help?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const draftRef = useRef(String(value));
  const savedValueRef = useRef(value);
  const dirtyRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  const boundsRef = useRef({ min, max });

  onCommitRef.current = onCommit;
  boundsRef.current = { min, max };

  useEffect(() => {
    savedValueRef.current = value;
    if (dirtyRef.current) return;
    const nextDraft = String(value);
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, [value]);

  useEffect(
    () => () => {
      if (!dirtyRef.current) return;
      const parsed = Number(draftRef.current);
      if (!Number.isFinite(parsed)) return;
      const bounds = boundsRef.current;
      const normalized = Math.max(bounds.min, Math.min(bounds.max, Math.round(parsed)));
      if (normalized !== savedValueRef.current) onCommitRef.current(normalized);
    },
    [],
  );

  const commitDraft = (rawDraft: string) => {
    const parsed = Number(rawDraft);
    if (!Number.isFinite(parsed)) {
      const savedDraft = String(savedValueRef.current);
      draftRef.current = savedDraft;
      dirtyRef.current = false;
      setDraft(savedDraft);
      return;
    }
    const normalized = Math.max(min, Math.min(max, Math.round(parsed)));
    const normalizedDraft = String(normalized);
    draftRef.current = normalizedDraft;
    dirtyRef.current = false;
    setDraft(normalizedDraft);
    if (normalized === savedValueRef.current) return;
    savedValueRef.current = normalized;
    onCommitRef.current(normalized);
  };

  return (
    <label className="block space-y-1.5">
      <FieldLabel help={help}>{label}</FieldLabel>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => {
          draftRef.current = event.target.value;
          dirtyRef.current = true;
          setDraft(event.target.value);
        }}
        onBlur={(event) => commitDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={fieldClass}
      />
    </label>
  );
}
