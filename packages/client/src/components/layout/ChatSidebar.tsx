import { insertLibraryItems } from "../../lib/library-order";
import { preloadChatSurface } from "../chat/chat-surface-preload";
import { beginSplitDrag, dropSplitAt, endSplitDrag } from "../overhaul/split-view";
import {
  isOverhaulActive,
  isOverhaulLook,
  isOverhaulMobile,
  useOverhaulActive,
  useOverhaulStore,
  useOverhaulMobile,
  useOverhaulTouchMessages,
} from "../../stores/overhaul.store";
import { useLibraryFolderDrag } from "../../hooks/use-library-folder-drag";
import { useLibraryOrder } from "../../hooks/use-library-order";
// ──────────────────────────────────────────────
// Layout: Chat Sidebar (polished with rich buttons)
// ──────────────────────────────────────────────
import { hasEditorLeaveHandler } from "../../lib/editor-leave";
import {
  MessageCircle,
  MessageSquareText,
  Search,
  Trash2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Check,
  Download,
  GitBranch,
  AlertTriangle,
  X,
  Circle,
  Moon,
  MinusCircle,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckSquare,
  Square as SquareIcon,
  ArrowUpDown,
  Tag,
  Loader2,
  PhoneIncoming,
  CalendarClock,
  TextSearch,
  Activity,
  MoreHorizontal,
} from "lucide-react";
import { openActivityOverview, openGlobalSearch } from "../../lib/chat-insights";
import { normalizeChatTags } from "../../lib/chat-tags";
import {
  useBulkExportChats,
  useChats,
  useCreateChat,
  useDeleteChat,
  useDeleteChatGroup,
  useUpdateChat,
  useUpdateChatMetadata,
} from "../../hooks/use-chats";
import { useChatPresets, useApplyChatPreset } from "../../hooks/use-chat-presets";
import { useConnections } from "../../hooks/use-connections";
import {
  useChatFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useReorderFolders,
  useMoveChat,
} from "../../hooks/use-chat-folders";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useChatStore } from "../../stores/chat.store";
import { confirmNonEmptyFolderDelete, showConfirmDialog, showPromptDialog } from "../../lib/app-dialogs";
import { isMobileShellViewport, selectSidebarShown, useUIStore, type UserStatus } from "../../stores/ui.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { chatBackgroundMetadataToUrl } from "../../lib/backgrounds";
import { formatRelativeContact } from "../../lib/relative-time";
import { isSetupKeptForLater } from "../../hooks/use-setup-drafts";
import { ChatRowPeek } from "./ChatRowPeek";
import { Fragment, lazy, Suspense, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { usePresenceClock } from "../../hooks/use-presence-clock";
import { usePanelKeyboardFocus } from "./use-panel-keyboard-focus";
import { PanelErrorState, PanelListSkeleton } from "../ui/PanelStates";
import { toast } from "sonner";
import {
  BACKGROUND_THUMBNAIL_WIDTH,
  includesTextForMatch,
  normalizeAvatarCrop,
  normalizeTextForMatch,
  type AvatarCrop,
  type Chat,
  type ChatFolder,
  type ChatMode,
  type ConversationPresenceStatus,
} from "@marinara-engine/shared";
import { resolveLiveConversationStatus } from "../../lib/conversation-presence-status";
import { Modal } from "../ui/Modal";
import { Reorder } from "framer-motion";
import { parseChatMetadata, getChatDisplayName, stripChatDateSuffix } from "../../lib/chat-display";
import { buildChatBranchRows, hasChatBranchLineage, type BranchTreeRow } from "../../lib/chat-branch-tree";
import {
  compareChatsByActivityDesc,
  compareChatsByCreatedAtAsc,
  compareChatsByCreatedAtDesc,
  getChatActivityTime,
} from "../../lib/chat-recency";
import { sortPanelFolders } from "../../lib/panel-sort";
import { getCurrentGameGroupRepresentative } from "../../lib/game-session-resolution";
import { api } from "../../lib/api-client";
import { EXPORT_FAILED_TOAST_ID } from "../../lib/file-download";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { HelpTooltip } from "../ui/HelpTooltip";
import { MobileChatsHomeButton, MobileLibraryButton } from "../overhaul/MobileTopBar";
import { SwipeActionsRow, type SwipeAction } from "../overhaul/SwipeActionsRow";
import { RowActionSheet } from "../overhaul/RowActionSheet";
import { TagFilter, countItemTags, matchesPickedTags } from "../overhaul/TagFilter";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { PersonalExtensionContributionSlot } from "../extensions/PersonalExtensionContributionSlot";
import { ChatModeIcon } from "../chat/ChatModeIcon";

// Opened from a menu only, so it loads on first use instead of weighing on the AppShell chunk.
const CharacterScheduleManagerModal = lazy(async () => ({
  default: (await import("../chat/CharacterScheduleManagerModal")).CharacterScheduleManagerModal,
}));

type ChatSortOption = "custom" | "recent" | "newest" | "oldest" | "name-asc" | "name-desc";

/** One row of the list: the chat, plus its branches when the group has recorded lineage. */
type ChatListEntry = {
  chat: Chat;
  branchCount: number;
  branchRows?: BranchTreeRow<Chat>[];
};
const CHAT_LIST_PAGE_SIZE = 100;

const CONVERSATION_STATUS_PRIORITY: Record<ConversationPresenceStatus, number> = {
  online: 0,
  idle: 1,
  offline: 2,
  dnd: 3,
};

const CONVERSATION_STATUS_DOT_CLASS: Record<ConversationPresenceStatus, string> = {
  online: "bg-[var(--mari-status-online)]",
  idle: "bg-[var(--mari-status-idle)]",
  offline: "bg-[var(--mari-status-offline)]",
  dnd: "bg-[var(--mari-status-dnd)]",
};

function asConversationStatus(value: unknown): ConversationPresenceStatus | undefined {
  return value === "online" || value === "idle" || value === "dnd" || value === "offline" ? value : undefined;
}

function conversationStatusDotClass(status?: string) {
  return CONVERSATION_STATUS_DOT_CLASS[asConversationStatus(status) ?? "online"];
}

function getConversationPresenceState(
  chatMode: ChatMode,
  chatMetadata: Chat["metadata"],
  charIds: string[],
  charLookup: Map<string, { name: string; conversationStatus?: string }>,
  presenceNow: Date,
): Map<string, ConversationPresenceStatus> {
  if (chatMode !== "conversation") {
    return new Map<string, ConversationPresenceStatus>();
  }

  const convoMeta = parseChatMetadata(chatMetadata);
  const chatCharStatuses = convoMeta?.conversationCharacterStatuses as Record<string, { status?: unknown }> | undefined;
  const conversationStatuses: Array<{
    id: string;
    status: ConversationPresenceStatus;
  }> = [];

  for (const id of charIds) {
    const base = charLookup.get(id);
    if (!base) continue;

    const live = resolveLiveConversationStatus(convoMeta, id, presenceNow);
    const snapshot = chatCharStatuses?.[id];
    conversationStatuses.push({
      id,
      status:
        live?.status ??
        asConversationStatus(snapshot?.status) ??
        asConversationStatus(base.conversationStatus) ??
        "online",
    });
  }

  return new Map(conversationStatuses.map(({ id, status }) => [id, status] as const));
}

function getChatTags(chat: Pick<Chat, "metadata">): string[] {
  return Array.isArray(chat.metadata?.tags)
    ? chat.metadata.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
}

function toSearchText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeChatCharacterIds(value: unknown): string[] {
  const parsed = (() => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value.trim() ? [value] : [];
    }
  })();

  return Array.isArray(parsed)
    ? parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim())
    : [];
}

function getNextUnnamedFolderName(existingFolders: Array<{ name: string }>): string {
  const names = new Set(existingFolders.map((folder) => folder.name.trim().toLowerCase()).filter(Boolean));
  if (!names.has("unnamed")) return "unnamed";
  let index = 2;
  while (names.has(`unnamed ${index}`)) index += 1;
  return `unnamed ${index}`;
}

const MODE_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    label: string;
    shortLabel: string;
    description: string;
    logoModeClass: string;
    comingSoon?: boolean;
  }
> = {
  conversation: {
    icon: <ChatModeIcon mode="conversation" size="0.875rem" className="mari-rgb-static-icon" />,
    label: "Conversation",
    shortLabel: "CONVO",
    description: "A straightforward AI conversation — no roleplay elements.",
    logoModeClass: "mari-chat-logo-mode--conversation",
  },
  roleplay: {
    icon: <ChatModeIcon mode="roleplay" size="0.875rem" className="mari-rgb-static-icon" />,
    label: "Roleplay",
    shortLabel: "RP",
    description: "Immersive roleplay with characters, game state tracking, and world simulation.",
    logoModeClass: "mari-chat-logo-mode--roleplay",
  },
  game: {
    icon: <ChatModeIcon mode="game" size="0.875rem" className="mari-rgb-static-icon" />,
    label: "Game",
    shortLabel: "GM",
    description: "AI-managed singleplayer RPG with a Game Master, party, dice, maps, and quests.",
    logoModeClass: "mari-chat-logo-mode--game",
  },
};

function ChatSidebarTitleIcon() {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,#4de5dd_0%,#eb8951_52%,#e15c8c_100%)] text-white shadow-sm">
      <MessageSquareText size="0.875rem" strokeWidth={2.35} />
    </div>
  );
}

export function ChatSidebar() {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const overhaulDesktop = useOverhaulActive();
  const overhaulMobile = useOverhaulMobile();
  // Touch screens in the new layout (phones, and tablets held sideways): swipe a row left for Pin,
  // Rename and Delete, or long-press it for the same actions in a sheet (panel 3, PP2, PT2, PT6).
  const overhaulTouch = useOverhaulTouchMessages();
  const swipeGesturesOn = useUIStore((s) => s.swipeGestures);
  const swipeRows = overhaulTouch && swipeGesturesOn;
  const [swipeOpenChatId, setSwipeOpenChatId] = useState<string | null>(null);
  const rowActionsRef = useRef(new Map<string, { title: string; actions: SwipeAction[] }>());
  const [rowSheet, setRowSheet] = useState<{ title: string; actions: SwipeAction[] } | null>(null);
  const closeRowSheet = useCallback(() => setRowSheet(null), []);
  const updateChatMetadata = useUpdateChatMetadata();
  // The overhaul look (compact rows, previews, mode counts) applies to phones too.
  const overhaulActive = overhaulDesktop || overhaulMobile;
  const { data: chats, isError: chatsError, isLoading, isFetching, refetch: refetchChats } = useChats();
  const { data: connections } = useConnections();
  const createChat = useCreateChat();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();
  const deleteChat = useDeleteChat();
  const renameChat = useUpdateChat();
  const deleteChatGroup = useDeleteChatGroup();
  const bulkExportChats = useBulkExportChats();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const hydrateUnread = useChatStore((s) => s.hydrateUnread);
  // Liveness signals for the rows. All three are already maintained per-chat by the store,
  // so a backgrounded chat can show what it is doing without any extra fetching.
  // `inputDrafts` writes are debounced (ConversationInput handleInput), so subscribing to
  // the whole Map does not re-render the list on every keystroke.
  // Not `streamingChatId` — that one is recomputed for the newly active chat on every
  // switch (chat.store setActiveChatId), so it goes null the moment you navigate away from
  // a generating chat. `abortControllers` is the per-chat truth and is what that same code
  // reads to decide whether a generation is live.
  const abortControllers = useChatStore((s) => s.abortControllers);
  const perChatTyping = useChatStore((s) => s.perChatTyping);
  const inputDrafts = useChatStore((s) => s.inputDrafts);
  const chatNotifications = useChatStore((s) => s.chatNotifications);
  const chatListRef = useRef<HTMLDivElement>(null);
  // One interval for the whole list: a 60s-cadence clock so schedule/override-derived
  // status dots refresh when time alone changes them, without per-row timers.
  const presenceNow = usePresenceClock();
  const chatListBackgrounds = useUIStore((s) => s.chatListBackgrounds);
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const editorDirty = useUIStore((s) => s.editorDirty);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const sidebarIsOpen = useUIStore(selectSidebarShown);
  const sidebarNavRef = useRef<HTMLElement>(null);
  const closeSidebarFromKeyboard = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const sidebarKeyboard = usePanelKeyboardFocus({
    open: sidebarIsOpen,
    containerRef: sidebarNavRef,
    toggleSelector: '[data-component="TopBar"] [data-tour="sidebar-toggle"]',
    onClose: closeSidebarFromKeyboard,
  });
  const chatModeShortcutRequest = useUIStore((s) => s.chatModeShortcutRequest);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);

  // Folder hooks
  const { data: folders } = useChatFolders();
  const createFolderMut = useCreateFolder();
  const updateFolderMut = useUpdateFolder();
  // Stable across renders, unlike the mutation object itself — safe as an effect dep.
  const mutateFolder = updateFolderMut.mutate;
  const deleteFolderMut = useDeleteFolder();
  const reorderFoldersMut = useReorderFolders();
  const moveChatMut = useMoveChat();

  const [searchQuery, setSearchQuery] = useState("");
  const manualOrder = useLibraryOrder("chat");
  const { active: manualOrderActive, orderItems: orderLibraryItems } = manualOrder;
  const [sort, setSort] = useState<ChatSortOption>("recent");
  // Picked tags: the classic layout picks one chip at a time, the new layout's Tags selector several
  // (chats carrying all of them, or "Untagged").
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const activeTag = pickedTags[0] ?? null;
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversation" | "roleplay" | "game">("conversation");
  const [scheduleManagerOpen, setScheduleManagerOpen] = useState(false);
  const [visibleChatLimit, setVisibleChatLimit] = useState(CHAT_LIST_PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<{
    chatId: string;
    chatName: string;
    groupId: string | null;
    branchCount: number;
  } | null>(null);

  // Which branch groups are open. Component-local per the client state rules: a view toggle does not
  // earn a store field or a server round trip. ponytail: it resets on remount; upgrade path is a
  // ui.store field if someone asks for it to stick.
  const [expandedBranchGroups, setExpandedBranchGroups] = useState<Set<string>>(new Set());

  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);
  const chatImportInputRef = useRef<HTMLInputElement>(null);
  const suppressTouchDragClickRef = useRef(false);

  // Multi-select state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  // New layout on phones: sort, select, new folder, import and message search live in one ⋯ menu.
  const [ovmListMenuOpen, setOvmListMenuOpen] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  const [isImportingChat, setIsImportingChat] = useState(false);

  const toggleSelectChat = useCallback((chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }, []);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedChatIds(new Set());
  }, []);

  useEffect(() => {
    if (!chatModeShortcutRequest) return;
    setActiveTab(chatModeShortcutRequest.mode);
    setSearchQuery("");
    setPickedTags([]);
    setTagsExpanded(false);
    exitMultiSelect();
  }, [chatModeShortcutRequest, exitMultiSelect]);

  // Exit multi-select when switching tabs
  useEffect(() => {
    exitMultiSelect();
    setPickedTags([]);
    setTagsExpanded(false);
  }, [activeTab, exitMultiSelect]);

  useEffect(() => {
    setVisibleChatLimit(CHAT_LIST_PAGE_SIZE);
  }, [activeTab, searchQuery, pickedTags, sort]);

  const modeChats = useMemo(
    () =>
      (chats ?? []).filter(
        (chat) => chat.mode === activeTab && !(chat.mode === "conversation" && chat.metadata?.gameId),
      ),
    [chats, activeTab],
  );
  const sidebarCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const chat of chats ?? []) {
      for (const id of normalizeChatCharacterIds((chat as { characterIds?: unknown }).characterIds)) ids.add(id);
    }
    return Array.from(ids);
  }, [chats]);
  const { data: characterSummaries } = useCharacterSummaries(sidebarCharacterIds);

  // Build character lookup: id → { name, avatarUrl, avatarCrop, conversationStatus }
  const charLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        avatarUrl: string | null;
        avatarCrop?: AvatarCrop | null;
        conversationStatus?: string;
      }
    >();
    if (!characterSummaries) return map;
    for (const character of characterSummaries) {
      map.set(character.id, {
        name: character.name,
        avatarUrl: character.avatarUrl,
        avatarCrop: normalizeAvatarCrop(character.avatarCrop),
        conversationStatus: character.conversationStatus,
      });
    }
    return map;
  }, [characterSummaries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const chat of modeChats) {
      for (const tag of getChatTags(chat)) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [modeChats]);

  // Counted per row the list shows: a chat's branches share one row, so they count once.
  const tagCounts = useMemo(() => {
    const threads = new Map<string, Set<string>>();
    for (const chat of modeChats) {
      const key = chat.groupId ?? chat.id;
      const tags = threads.get(key) ?? new Set<string>();
      for (const tag of getChatTags(chat)) tags.add(tag);
      threads.set(key, tags);
    }
    return countItemTags([...threads.values()].map((tags) => ({ tags: [...tags] })));
  }, [modeChats]);

  // Drop picked tags no chat in this mode carries any more ("Untagged" stays while it still matches).
  useEffect(() => {
    if (!pickedTags.length) return;
    const known = new Set(allTags.map((tag) => tag.toLowerCase()));
    const kept = pickedTags.filter((tag) => (tag ? known.has(tag.toLowerCase()) : tagCounts.untagged > 0));
    if (kept.length !== pickedTags.length) setPickedTags(kept);
  }, [pickedTags, allTags, tagCounts.untagged]);

  const filtered = useMemo(() => {
    const query = normalizeTextForMatch(searchQuery);

    return modeChats.filter((chat) => {
      const tags = getChatTags(chat);
      if (!matchesPickedTags(tags, pickedTags)) return false;
      if (!query) return true;

      const characterNames = normalizeChatCharacterIds((chat as { characterIds?: unknown }).characterIds)
        .map((characterId) => charLookup.get(characterId)?.name ?? "")
        .filter(Boolean);

      // A branch is labelled by its own display name, but the thread name is still what someone may
      // remember, so both match.
      const names = [toSearchText(chat.name), toSearchText(getChatDisplayName(chat))];
      return (
        names.some((name) => includesTextForMatch(name, query)) ||
        tags.some((tag) => includesTextForMatch(tag, query)) ||
        characterNames.some((name) => includesTextForMatch(name, query))
      );
    });
  }, [modeChats, searchQuery, pickedTags, charLookup]);

  // ── Branch trees ──
  // A group's branches already know their parents (metadata.branchParentChatId), so this only decides
  // which groups get a tree. A group with no recorded lineage keeps today's single row and count:
  // inventing a parent there would be a lie about the data.
  const branchTreesByGroup = useMemo(() => {
    const members = new Map<string, Chat[]>();
    for (const chat of chats ?? []) {
      if (!chat.groupId) continue;
      const group = members.get(chat.groupId);
      if (group) group.push(chat);
      else members.set(chat.groupId, [chat]);
    }
    const trees = new Map<string, BranchTreeRow<Chat>[]>();
    for (const [groupId, groupChats] of members) {
      // Game groups are numbered sessions, not branches. Their row has to stay the session the mode
      // resolver picks (getCurrentGameGroupRepresentative), which a lineage-rooted tree would demote
      // to the group's eldest, so those groups keep today's single row and count.
      if (groupChats.length < 2 || groupChats.some((member) => member.mode === "game")) continue;
      if (!hasChatBranchLineage(groupChats)) continue;
      // Siblings follow the list's own recency order, so a busy branch floats up inside its level.
      trees.set(groupId, buildChatBranchRows(groupChats, compareChatsByActivityDesc));
    }
    return trees;
  }, [chats]);

  const toggleBranchGroup = useCallback((groupId: string) => {
    setExpandedBranchGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // ── Collapse chats that share a groupId into one entry ──
  const displayChats = useMemo(() => {
    if (!filtered) return [];

    // Total group sizes from unfiltered chats (for accurate branch count)
    const totalGroupSizes = new Map<string, number>();
    if (chats) {
      for (const chat of chats) {
        if (chat.groupId) {
          totalGroupSizes.set(chat.groupId, (totalGroupSizes.get(chat.groupId) ?? 0) + 1);
        }
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return compareChatsByCreatedAtAsc(a, b);
        case "name-asc":
          return toSearchText(a.name).localeCompare(toSearchText(b.name));
        case "name-desc":
          return toSearchText(b.name).localeCompare(toSearchText(a.name));
        case "newest":
          return compareChatsByCreatedAtDesc(a, b);
        case "recent":
        default:
          return compareChatsByActivityDesc(a, b);
      }
    });

    const seenGroups = new Set<string>();
    const result: ChatListEntry[] = [];

    for (const chat of sorted) {
      if (chat.groupId) {
        if (seenGroups.has(chat.groupId)) continue;
        seenGroups.add(chat.groupId);
        // Root the row on the group's lineage root when there is one, so the tree does not re-root
        // itself every time a different branch is the one most recently spoken to.
        const branchRows = branchTreesByGroup.get(chat.groupId);
        result.push({
          chat: branchRows?.[0]?.chat ?? getCurrentGameGroupRepresentative(chat, chats ?? filtered),
          branchCount: totalGroupSizes.get(chat.groupId) ?? 1,
          branchRows,
        });
      } else {
        result.push({ chat, branchCount: 1 });
      }
    }

    const ordered = orderLibraryItems(result, (entry) => entry.chat.groupId ?? entry.chat.id);
    // Pinned chats (phone row swipe > Pin) lead the list, in the list's own order.
    const pinned = ordered.filter((entry) => isChatPinned(entry.chat));
    return pinned.length ? [...pinned, ...ordered.filter((entry) => !isChatPinned(entry.chat))] : ordered;
  }, [chats, filtered, sort, orderLibraryItems, branchTreesByGroup]);

  // Detect if active chat belongs to a group so its group row highlights and stays mounted.
  const activeChat = chats?.find((c) => c.id === activeChatId);
  const activeGroupId = activeChat?.groupId ?? null;

  // A branch that becomes active (branch switch, notification, reload) has to be visible: open its
  // group, or the list highlights a row that is not rendered at all. Once per activation only — a
  // background refetch rebuilds branchTreesByGroup, and re-expanding then would reopen a group the
  // user had just collapsed.
  const autoExpandedBranchChatRef = useRef<string | null>(null);
  useEffect(() => {
    const groupId = activeChat?.groupId;
    if (!activeChatId || !groupId) return;
    if (autoExpandedBranchChatRef.current === activeChatId) return;
    const branchRows = branchTreesByGroup.get(groupId);
    if (!branchRows?.some((row) => row.chat.id === activeChatId && row.depth > 0)) return;
    // Mark only once the branch is known to be nested, so a list that is still loading gets retried.
    autoExpandedBranchChatRef.current = activeChatId;
    setExpandedBranchGroups((previous) => (previous.has(groupId) ? previous : new Set(previous).add(groupId)));
  }, [activeChatId, activeChat?.groupId, branchTreesByGroup]);
  const activeDisplayChatIndex = useMemo(
    () =>
      displayChats.findIndex(
        (entry) => activeChatId === entry.chat.id || (activeGroupId != null && entry.chat.groupId === activeGroupId),
      ),
    [activeChatId, activeGroupId, displayChats],
  );
  const effectiveVisibleChatLimit =
    activeDisplayChatIndex >= 0 ? Math.max(visibleChatLimit, activeDisplayChatIndex + 1) : visibleChatLimit;
  const visibleDisplayChats = useMemo(
    () => displayChats.slice(0, effectiveVisibleChatLimit),
    [displayChats, effectiveVisibleChatLimit],
  );
  const hasMoreDisplayChats = visibleDisplayChats.length < displayChats.length;

  // ── Folder grouping ──
  const modeFolders = useMemo(() => {
    const list = sortPanelFolders(
      (folders ?? []).filter((f) => f.mode === activeTab),
      sort === "recent" ? "name-asc" : sort,
    );
    if (sort !== "recent") return list;
    const activity = new Map(list.map((folder) => [folder.id, getChatActivityTime(folder)]));
    for (const chat of modeChats) {
      if (chat.folderId)
        activity.set(chat.folderId, Math.max(activity.get(chat.folderId) ?? 0, getChatActivityTime(chat)));
    }
    return list.sort((a, b) => activity.get(b.id)! - activity.get(a.id)!);
  }, [folders, activeTab, sort, modeChats]);

  const { unfiledChats, folderChatsMap } = useMemo(() => {
    if (!visibleDisplayChats.length)
      return { unfiledChats: visibleDisplayChats, folderChatsMap: new Map<string, typeof displayChats>() };
    const unfiled: typeof displayChats = [];
    const map = new Map<string, typeof displayChats>();
    for (const entry of visibleDisplayChats) {
      const fid = entry.chat.folderId;
      if (!fid) {
        unfiled.push(entry);
        continue;
      }
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(entry);
    }
    return { unfiledChats: unfiled, folderChatsMap: map };
  }, [visibleDisplayChats]);
  const folderChatCounts = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const chat of modeChats) {
      const folderId = chat.folderId;
      if (!folderId) continue;
      const key = chat.groupId ?? chat.id;
      const ids = map.get(folderId) ?? new Set<string>();
      ids.add(key);
      map.set(folderId, ids);
    }
    return new Map(Array.from(map, ([folderId, ids]) => [folderId, ids.size]));
  }, [modeChats]);
  const chatListFilterActive = searchQuery.trim().length > 0 || pickedTags.length > 0;

  const [localFolderOrder, setLocalFolderOrder] = useState<string[]>([]);
  useEffect(() => {
    setLocalFolderOrder(
      sortPanelFolders(
        (folders ?? []).filter((f) => f.mode === activeTab),
        "custom",
      ).map((f) => f.id),
    );
  }, [folders, activeTab]);
  const folderOrder = sort === "custom" ? localFolderOrder : modeFolders.map((folder) => folder.id);

  useEffect(() => {
    const allChats = chats ?? [];
    const unread = allChats
      .map((chat) => {
        const metadata = parseChatMetadata(chat.metadata);
        const count = typeof metadata.autonomousUnreadCount === "number" ? metadata.autonomousUnreadCount : 0;
        if (count <= 0) return null;
        const characterId =
          (Array.isArray(metadata.autonomousUnreadCharacterIds)
            ? metadata.autonomousUnreadCharacterIds.find((id): id is string => typeof id === "string")
            : null) ?? normalizeChatCharacterIds(chat.characterIds)[0];
        const character = characterId ? charLookup.get(characterId) : null;
        return {
          chatId: chat.id,
          count,
          characterName: character?.name ?? "Someone",
          avatarUrl: character?.avatarUrl ?? null,
          avatarCrop: character?.avatarCrop ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    hydrateUnread(
      unread,
      allChats.map((chat) => chat.id),
    );
  }, [chats, charLookup, hydrateUnread]);

  // ── Sync sidebar tab + folder with the currently active chat ──
  // Covers: recent-chat clicks, page refresh, connected-chat switch,
  // scene navigation, notification bubbles, branch switch, import, etc.
  //
  // Uses a structured ref so each concern (tab, folder, scroll) resolves
  // independently — folder expansion retries when folders load late, and
  // scroll waits until both tab and folder are settled.
  const syncRef = useRef<{
    chatId: string | null;
    tabSynced: boolean;
    folderSynced: boolean;
    /** Folder we already asked to expand — the mutation is in flight, don't ask again. */
    expandRequestedFolderId: string | null;
    /** The active chat's row still has to be scrolled into view. Survives re-runs, which cancel the timer. */
    scrollPending: boolean;
  }>({
    chatId: null,
    tabSynced: false,
    folderSynced: false,
    expandRequestedFolderId: null,
    scrollPending: false,
  });
  // When true the next sync skips clearing the search query — set by
  // the sidebar's own click handler so clicking a search result doesn't
  // wipe the filter the user is actively browsing.
  const internalNavRef = useRef(false);
  useEffect(() => {
    if (!activeChatId || !chats?.length) return;

    const chat = chats.find((c) => c.id === activeChatId);
    if (!chat) return;

    const s = syncRef.current;
    const isNewChat = s.chatId !== activeChatId;

    if (isNewChat) {
      s.chatId = activeChatId;
      s.tabSynced = false;
      s.folderSynced = false;
      s.expandRequestedFolderId = null;
    }

    // 1. Tab sync — once per chat switch
    if (!s.tabSynced) {
      const chatMode = chat.mode;
      if (chatMode === "conversation" || chatMode === "roleplay" || chatMode === "game") {
        setActiveTab(chatMode);
      }
      // Clear search so the active chat isn't hidden by a stale filter.
      // Skip when the navigation originated from a sidebar click (the
      // user is actively browsing search results and shouldn't lose them).
      if (!internalNavRef.current) {
        setSearchQuery("");
        setPickedTags([]);
        setTagsExpanded(false);
      }
      internalNavRef.current = false;
      s.tabSynced = true;
      s.scrollPending = true;
    }

    // 2. Folder expansion — waits for folders data; if the folder is
    //    collapsed we fire a mutation and stay !folderSynced so the effect
    //    re-runs after the query delivers the expanded state.
    if (!s.folderSynced) {
      if (!chat.folderId) {
        s.folderSynced = true;
      } else if (folders) {
        const folder = folders.find((f) => f.id === chat.folderId);
        if (folder?.collapsed) {
          // Once per folder: this effect re-runs on every render (the mutation object
          // identity changes), and mutating re-renders — firing again here is an
          // infinite update loop (React #185) until the folders query comes back.
          if (s.expandRequestedFolderId !== folder.id) {
            s.expandRequestedFolderId = folder.id;
            mutateFolder({ id: folder.id, collapsed: false });
          }
          // folderSynced stays false — re-runs after query invalidation
        } else {
          s.folderSynced = true;
          s.scrollPending = true;
        }
      }
      // else: folders not loaded yet — effect re-runs when they arrive
    }

    // 3. Scroll active chat row into view once both tab + folder are settled.
    //    Chats or folders landing re-run this and cancel the timer; the pending flag schedules it again.
    if (s.scrollPending && s.tabSynced && s.folderSynced) {
      const timer = setTimeout(() => {
        s.scrollPending = false;
        // Look in the list: the chat's composer carries the same data-chat-id and comes first in the page.
        const el = chatListRef.current?.querySelector(`[data-chat-id="${activeChatId}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, chats, folders, mutateFolder]);

  const handleNewChat = useCallback(
    (mode: ChatMode) => {
      if (createChat.isPending) return;
      const connectionRows = ((connections ?? []) as Array<{ id: string }>).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        setPendingNewChatMode(mode, "sidebar");
        if (isMobileShellViewport()) setSidebarOpen(false);
        return;
      }

      // Close any open detail editors so the chat area is visible
      if (hasAnyDetailOpen()) {
        closeAllDetails();
      }
      // Resolve the user's starred default settings profile for this mode.
      const presets = chatPresetsData ?? [];
      const presetMode: ChatMode | null = mode === "conversation" || mode === "roleplay" ? mode : null;
      const starred = presetMode
        ? (presets.find((p) => p.mode === presetMode && p.isActive && !p.isDefault) ?? null)
        : null;
      createChat.mutate(
        {
          name: `New ${MODE_CONFIG[mode]?.label ?? mode}`,
          mode,
          characterIds: [],
          connectionId: starred?.settings.connectionId ?? undefined,
          promptPresetId: starred?.settings.promptPresetId ?? undefined,
          setupPending: true,
        },
        {
          onSuccess: (chat) => {
            setActiveChatId(chat.id);
            if (isMobileShellViewport()) setSidebarOpen(false);
            useChatStore.getState().setShouldOpenSettings(true);
            useChatStore.getState().setShouldOpenWizard(true);
            if (starred) {
              void applyChatPreset
                .mutateAsync({ presetId: starred.id, chatId: chat.id, initialSetupProfile: starred })
                .catch(() => {
                  /* non-fatal — chat still opens with system defaults */
                });
            }
          },
        },
      );
    },
    [
      connections,
      createChat,
      setActiveChatId,
      setPendingNewChatMode,
      setSidebarOpen,
      hasAnyDetailOpen,
      closeAllDetails,
      chatPresetsData,
      applyChatPreset,
    ],
  );

  const handleNewChatFromTab = useCallback(() => {
    handleNewChat(activeTab);
  }, [handleNewChat, activeTab]);

  const handleImportChatFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setIsImportingChat(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", activeTab);
        const data = await api.upload<{
          success?: boolean;
          chatId?: string;
          error?: string;
          messagesImported?: number;
        }>("/import/st-chat", formData);
        if (data.success === false || data.error) {
          toast.error(
            localizeUi("ui.layout.chatsidebar.importFailedValue1", {
              value1: data.error ?? localizeUi("ui.layout.chatsidebar.unknownError"),
            }),
          );
          return;
        }

        toast.success(
          localizeUi("ui.layout.chatsidebar.importedValue1Messages", { value1: data.messagesImported ?? 0 }),
        );
        await refetchChats();
        if (data.chatId) setActiveChatId(data.chatId);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? localizeUi("ui.layout.chatsidebar.importFailedValue1", { value1: error.message })
            : localizeUi("chat.branches.importFailed"),
        );
      } finally {
        setIsImportingChat(false);
      }
    },
    [activeTab, refetchChats, setActiveChatId, localizeUi],
  );

  const activeModeConfig = MODE_CONFIG[activeTab] ?? MODE_CONFIG.conversation;
  const activeModeHasChats = modeChats.length > 0;

  // ── Folder handlers ──
  const handleCreateFolder = useCallback(() => {
    createFolderMut.mutate({ name: getNextUnnamedFolderName(modeFolders), mode: activeTab });
  }, [activeTab, createFolderMut, modeFolders]);

  const handleToggleCollapse = useCallback(
    (folder: ChatFolder) => {
      updateFolderMut.mutate({ id: folder.id, collapsed: !folder.collapsed });
    },
    [updateFolderMut],
  );

  const handleRenameFolder = useCallback(
    (id: string, name: string) => {
      if (!name.trim()) return;
      updateFolderMut.mutate({ id, name: name.trim() });
    },
    [updateFolderMut],
  );

  const handleDeleteFolder = useCallback(
    async (folder: ChatFolder, chatCount: number) => {
      const ok = await confirmNonEmptyFolderDelete(chatCount, {
        title: "Delete Folder",
        message: `Delete "${folder.name}"? Its ${chatCount} chat${chatCount === 1 ? "" : "s"} will move to the top level.`,
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (ok) {
        deleteFolderMut.mutate(folder.id);
      }
    },
    [deleteFolderMut],
  );

  const handleFolderReorder = useCallback(
    (newOrder: string[]) => {
      setSort("custom");
      setLocalFolderOrder(newOrder);
      reorderFoldersMut.mutate(newOrder);
    },
    [reorderFoldersMut],
  );
  const folderDrag = useLibraryFolderDrag("chat", (ids, target, edge) => {
    handleFolderReorder(insertLibraryItems(folderOrder, ids, target, edge));
  });

  const getDragChatIds = useCallback(
    (chatId: string) => (multiSelectMode && selectedChatIds.has(chatId) ? Array.from(selectedChatIds) : [chatId]),
    [multiSelectMode, selectedChatIds],
  );

  const handleDropChatsToFolder = useCallback(
    (chatIds: string[], folderId: string | null) => {
      const uniqueIds = Array.from(new Set(chatIds.filter(Boolean)));
      for (const chatId of uniqueIds) {
        if ((chats?.find((chat) => chat.id === chatId)?.folderId ?? null) === folderId) continue;
        moveChatMut.mutate({ chatId, folderId });
      }
      setDraggedChatId(null);
      setIsRootDropTarget(false);
    },
    [chats, moveChatMut],
  );

  const resetTouchDrag = () => {
    setDraggedChatId(null);
    setIsRootDropTarget(false);
    window.setTimeout(() => {
      suppressTouchDragClickRef.current = false;
    }, 0);
  };

  const { startTouchDrag, startMouseDrag } = useTouchFolderDrag({
    getDragIds: getDragChatIds,
    onReorder: (ids, target, edge, visibleIds) => {
      const key = (id: string) => chats?.find((chat) => chat.id === id)?.groupId ?? id;
      manualOrder.reorder(ids.map(key), key(target), edge, visibleIds.map(key));
    },
    onActivate: (chatId) => {
      setDraggedChatId(chatId);
      suppressTouchDragClickRef.current = true;
      // New layout on a computer: a chat dragged far to a side of the page opens there (split view).
      if (isOverhaulActive()) beginSplitDrag({ kind: "chat", id: chatId });
    },
    onDrop: (_chatId, x, y, dragIds) => {
      if (dropSplitAt(x, y)) {
        resetTouchDrag();
        return;
      }
      const target = document.elementFromPoint(x, y);
      const folderId = target?.closest<HTMLElement>("[data-chat-folder-id]")?.dataset.chatFolderId;
      if (folderId) {
        handleDropChatsToFolder(dragIds, folderId);
      } else if (target?.closest('[data-drag-kind="chat"]')) {
        const row = target.closest<HTMLElement>('[data-drag-kind="chat"]')!;
        handleDropChatsToFolder(dragIds, row.dataset.dragFolder || null);
      } else if (target?.closest("[data-chat-root-drop-zone]")) {
        handleDropChatsToFolder(dragIds, null);
      }
      resetTouchDrag();
    },
    onCancel: () => {
      endSplitDrag();
      resetTouchDrag();
    },
    // New layout: a still long-press opens the row's actions; moving the finger after pickup still drags.
    onHoldRelease: (chatId) => {
      if (!overhaulActive || multiSelectMode) return;
      const entry = rowActionsRef.current.get(chatId);
      if (entry) setRowSheet(entry);
    },
  });

  // ── Batch actions ──
  const handleBatchDelete = useCallback(async () => {
    if (selectedChatIds.size === 0) return;
    if (
      !(await showConfirmDialog({
        title: localizeUi("ui.layout.chatsidebar.deleteChats"),
        message: localizeUi("ui.layout.chatsidebar.deleteValue1ChatValue2", {
          value1: selectedChatIds.size,
          value2: selectedChatIds.size > 1 ? localizeUi("ui.noodle.stageprofileview.s") : "",
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "accent",
      }))
    ) {
      return;
    }
    for (const id of selectedChatIds) {
      deleteChat.mutate({ id, force: true });
    }
    if (activeChatId && selectedChatIds.has(activeChatId)) setActiveChatId(null);
    exitMultiSelect();
  }, [selectedChatIds, deleteChat, activeChatId, setActiveChatId, exitMultiSelect, localizeUi]);

  const handleBatchExport = useCallback(async () => {
    if (selectedChatIds.size === 0) return;
    try {
      await bulkExportChats.mutateAsync({
        chatIds: [...selectedChatIds],
        format: "jsonl",
        scope: "selected",
      });
      exitMultiSelect();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("ui.layout.chatsidebar.exportFailedValue1", { value1: err.message })
          : localizeUi("ui.layout.chatsidebar.exportFailed"),
        { id: EXPORT_FAILED_TOAST_ID },
      );
    }
  }, [selectedChatIds, bulkExportChats, exitMultiSelect, localizeUi]);

  // ── Opening a chat — the row click and the nested branch rows share one path ──
  const openChat = useCallback(
    async (chatId: string) => {
      if (hasAnyDetailOpen()) {
        if (editorDirty && !hasEditorLeaveHandler(useUIStore.getState())) {
          if (
            !(await showConfirmDialog({
              title: localizeUi("ui.layout.chatsidebar.unsavedChanges"),
              message: localizeUi("ui.layout.chatsidebar.youHaveUnsavedChangesDiscardAndContinue"),
              confirmLabel: localizeUi("ui.agents.agenteditor.discard"),
              tone: "destructive",
            }))
          ) {
            return;
          }
        }
        closeAllDetails();
      }
      // New layout: picking a chat (even the open one) leaves any Library, Docs or app page for it.
      if (isOverhaulLook()) {
        const overhaul = useOverhaulStore.getState();
        overhaul.leaveDocs();
        overhaul.setLibraryPage(null);
      }
      internalNavRef.current = true;
      setActiveChatId(chatId);
      if (isMobileShellViewport()) setSidebarOpen(false);
    },
    [hasAnyDetailOpen, editorDirty, closeAllDetails, setActiveChatId, setSidebarOpen, localizeUi],
  );

  // ── Chat row renderer (shared between unfiled + folder sections) ──
  // ── Deleting one chat (a chat without branches, or a single branch row) ──
  const confirmDeleteChat = async (chatId: string, name: string) => {
    if (
      await showConfirmDialog({
        title: localizeUi("ui.layout.chatsidebar.deleteChat"),
        message: localizeUi("dialog.delete.namedPermanent", { name }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      })
    ) {
      deleteChat.mutate({ id: chatId, force: true });
      if (activeChatId === chatId) setActiveChatId(null);
    }
  };

  // ── Branch rows: one compact row per branch, each level hanging from its parent ──
  // Rows arrive pre-order (a parent, then its whole subtree), so a row's subtree is the run of rows
  // after it that sit deeper. Nesting stops adding indent past MAX_BRANCH_NESTING so a long chain
  // still leaves the name readable on a phone.
  const renderBranchLevel = (rows: BranchTreeRow<Chat>[]): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    for (let index = 0; index < rows.length;) {
      const row = rows[index]!;
      let end = index + 1;
      while (end < rows.length && rows[end]!.depth > row.depth) end += 1;
      const subtree = rows.slice(index + 1, end);
      const name = stripChatDateSuffix(getChatDisplayName(row.chat));
      nodes.push(
        <BranchRow
          key={row.chat.id}
          chatId={row.chat.id}
          name={name}
          relativeTime={
            row.chat.lastMessageAt ? formatRelativeContact(row.chat.lastMessageAt, presenceNow.getTime()) : null
          }
          isActive={activeChatId === row.chat.id}
          isSelected={selectedChatIds.has(row.chat.id)}
          multiSelectMode={multiSelectMode}
          unread={unreadCounts.get(row.chat.id) ?? 0}
          isBusy={abortControllers.has(row.chat.id) || perChatTyping.has(row.chat.id)}
          deleteLabel={localizeUi("chat.branches.deleteLabel", { name })}
          onSelect={() => void openChat(row.chat.id)}
          onToggleSelect={() => toggleSelectChat(row.chat.id)}
          onDelete={() => void confirmDeleteChat(row.chat.id, name)}
          showDelete={!overhaulActive}
        />,
      );
      if (subtree.length > 0) {
        nodes.push(
          row.depth < MAX_BRANCH_NESTING ? (
            // The line drops from the parent's name, so every child sits visibly right of its parent.
            <div key={`${row.chat.id}:children`} className={BRANCH_LEVEL_CLASS}>
              {renderBranchLevel(subtree)}
            </div>
          ) : (
            <Fragment key={`${row.chat.id}:children`}>{renderBranchLevel(subtree)}</Fragment>
          ),
        );
      }
      index = end;
    }
    return nodes;
  };

  // ── Renaming a chat in place (desktop new layout: the hover pencil beside the name) ──
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const commitRename = (chatId: string, currentName: string) => {
    if (renamingChatId !== chatId) return;
    setRenamingChatId(null);
    const next = renameDraft.trim();
    if (!next || next === currentName) return;
    renameChat.mutate(
      { id: chatId, name: next.slice(0, 200) },
      {
        onError: () =>
          toast.error(localizeUi("ui.layout.chatsidebar.renameFailed", { defaultValue: "Couldn't rename the chat." })),
      },
    );
  };

  const renameChatWithSheet = async (chatId: string, currentName: string) => {
    const next = (
      await showPromptDialog({
        title: localizeUi("ui.layout.chatsidebar.renameChat"),
        message: "",
        defaultValue: currentName,
        confirmLabel: localizeUi("ui.layout.chatsidebar.renameShort"),
      })
    )?.trim();
    if (!next || next === currentName) return;
    renameChat.mutate(
      { id: chatId, name: next.slice(0, 200) },
      {
        onError: () =>
          toast.error(localizeUi("ui.layout.chatsidebar.renameFailed", { defaultValue: "Couldn't rename the chat." })),
      },
    );
  };

  // "Tags…": comma-separated, used by the tag filter and by themes (data-chat-tags).
  const editChatTagsWithSheet = async (chat: Chat) => {
    const current = getChatTags(chat);
    const next = await showPromptDialog({
      title: localizeUi("theming.tags.editTitle", { defaultValue: "Chat tags" }),
      message: localizeUi("theming.tags.editHelp", {
        defaultValue: "Separate tags with commas. Themes can style a chat by its tags.",
      }),
      defaultValue: current.join(", "),
      confirmLabel: localizeUi("theming.tags.save", { defaultValue: "Save tags" }),
    });
    if (next == null) return;
    updateChatMetadata.mutate(
      { id: chat.id, tags: normalizeChatTags(next.split(",")) },
      {
        onError: () => toast.error(localizeUi("theming.tags.saveFailed", { defaultValue: "Couldn't save the tags." })),
      },
    );
  };

  const renderChatRow = (entry: ChatListEntry) => {
    const { chat, branchCount, branchRows } = entry;
    const cfg = MODE_CONFIG[chat.mode] ?? MODE_CONFIG.conversation;
    const isBranchRoot = Boolean(branchRows && branchRows.length > 1);
    // An imported "Name - 2025-11-25@19h22m33s" reads "Name" in the list, like its tab.
    const displayName = stripChatDateSuffix(chat.name);
    // Searching matches branch display names too, so a hit can be a branch below the fold: open the
    // group while a search is active, the way folder rows force themselves open for a search hit.
    // A tag filter matches the whole thread, so its branches stay folded.
    const isExpanded =
      isBranchRoot &&
      (searchQuery.trim().length > 0 || (chat.groupId != null && expandedBranchGroups.has(chat.groupId)));
    // Collapsed, the group row stands in for whichever branch is active. Expanded, exactly one row
    // may look current — otherwise every sibling lights up at once.
    const isGroupActive = !isExpanded && chat.groupId != null && chat.groupId === activeGroupId;
    const isActive = activeChatId === chat.id || isGroupActive;
    const isSelected = selectedChatIds.has(chat.id);
    const charIds = normalizeChatCharacterIds((chat as { characterIds?: unknown }).characterIds);
    const conversationStatusByCharacter = getConversationPresenceState(
      chat.mode,
      chat.metadata,
      charIds,
      charLookup,
      presenceNow,
    );

    // ── Row liveness ──
    // Exactly one subtitle, so rows never change height as these states come and go.
    // Precedence: typing > generating > notification > draft.
    // Reuses the list's existing 60s clock, so these tick without per-row timers.
    // Conversation chats only — roleplay/game rows are already busy enough.
    const relativeTime =
      (chat.mode === "conversation" || overhaulActive) && chat.lastMessageAt
        ? formatRelativeContact(chat.lastMessageAt, presenceNow.getTime())
        : null;

    // Collapsed, the row speaks for its whole group: the lineage root is not necessarily the branch
    // that is typing, generating or unread.
    const signalRows = !isExpanded && branchRows && branchRows.length > 1 ? branchRows : null;
    const isGenerating = signalRows
      ? signalRows.some((row) => abortControllers.has(row.chat.id))
      : abortControllers.has(chat.id);
    const typingCharacter = signalRows
      ? signalRows.map((row) => perChatTyping.get(row.chat.id)).find(Boolean)
      : perChatTyping.get(chat.id);
    const hasDraft = !isActive && Boolean(inputDrafts.get(chat.id)?.trim());
    // Enrichment only: notifications auto-dismiss on a timer while the unread count badge
    // persists, so the badge stays the durable signal and this just names who/what.
    const notification = isActive ? undefined : chatNotifications.get(chat.id);
    const notificationLabel = !notification
      ? null
      : notification.kind === "call"
        ? notification.reason?.trim() ||
          localizeUi("ui.layout.chatsidebar.incomingCallFromValue1", { value1: notification.characterName })
        : localizeUi("ui.layout.chatsidebar.value1Replied", { value1: notification.characterName });
    const subtitle = typingCharacter
      ? localizeUi("ui.layout.chatsidebar.value1IsTyping", { value1: typingCharacter })
      : isGenerating
        ? localizeUi("ui.layout.chatsidebar.generating")
        : notificationLabel
          ? notificationLabel
          : hasDraft
            ? localizeUi("ui.layout.chatsidebar.unsentDraft")
            : isSetupKeptForLater(chat)
              ? localizeUi("ui.layout.chatsidebar.setupNotFinished", { defaultValue: "Setup not finished" })
              : null;
    // New layout: "Generating…" stands in for the time on the same line, so a row doesn't grow 6px and push
    // the list down and back for every reply (audit H14). Typing and the rest keep their own line.
    const liveInTimeSlot = overhaulActive && isGenerating && !typingCharacter;
    // Same precedence as the subtitle: whatever the line says is what the icon marks.
    const SubtitleIcon =
      typingCharacter || isGenerating
        ? Loader2
        : notificationLabel && notification?.kind === "call"
          ? PhoneIncoming
          : null;

    // Banner: the chat's own background image, bled across the row and heavily muted.
    // Sits at -z-10 inside the row's own stacking context (see `isolate`), so the
    // unpositioned row content keeps painting above it.
    // Asks for a 320px-wide copy: a full-size background decodes to megabytes of bitmap no
    // matter how small it is painted, and on "always" every row pays that at once.
    // Deliberately no fallback to defaultRoleplayBackground (which ChatArea's restore effect
    // applies): that would paint one identical banner across every roleplay chat.
    const bannerUrl =
      chatListBackgrounds === "off"
        ? null
        : chatBackgroundMetadataToUrl(chat.metadata?.background, BACKGROUND_THUMBNAIL_WIDTH);

    const rowActions: SwipeAction[] = [
      {
        key: "pin",
        label: isChatPinned(chat)
          ? localizeUi("ui.layout.chatsidebar.unpinChat")
          : localizeUi("ui.layout.chatsidebar.pinChat"),
        icon: isChatPinned(chat) ? <PinOff size="1rem" /> : <Pin size="1rem" />,
        onSelect: () => updateChatMetadata.mutate({ id: chat.id, pinned: !isChatPinned(chat) }),
      },
      {
        key: "rename",
        label: localizeUi("ui.layout.chatsidebar.renameShort"),
        icon: <Pencil size="1rem" />,
        // A sheet with a proper field, not the small inline box (panel 3, PP10).
        onSelect: () => void renameChatWithSheet(chat.id, chat.name),
      },
      {
        key: "tags",
        label: localizeUi("theming.tags.short", { defaultValue: "Tags" }),
        icon: <Tag size="1rem" />,
        onSelect: () => void editChatTagsWithSheet(chat),
      },
      {
        key: "delete",
        label: localizeUi("lorebook.editor.batch.delete"),
        icon: <Trash2 size="1rem" />,
        tone: "danger",
        onSelect: () => {
          if (branchCount > 1 && chat.groupId) {
            setDeleteTarget({ chatId: chat.id, chatName: displayName, groupId: chat.groupId, branchCount });
          } else {
            void confirmDeleteChat(chat.id, displayName);
          }
        },
      },
    ];
    rowActionsRef.current.set(chat.id, { title: displayName, actions: rowActions });

    return (
      <div key={chat.groupId ?? chat.id} className="flex flex-col">
        <SwipeActionsRow
          enabled={swipeRows && !multiSelectMode && renamingChatId !== chat.id}
          open={swipeOpenChatId === chat.id}
          onOpenChange={(open) => setSwipeOpenChatId(open ? chat.id : null)}
          actions={rowActions}
        >
          <div
            role="button"
            tabIndex={0}
            data-chat-id={chat.id}
            title={displayName}
            data-drag-id={chat.id}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            data-drag-kind="chat"
            data-drag-order-id={chat.groupId ?? chat.id}
            data-drag-folder={chat.folderId ?? ""}
            onTouchStart={(event) => {
              startTouchDrag(event, chat.id, {
                sourceElement: event.currentTarget.closest<HTMLElement>("[data-chat-id]"),
              });
            }}
            onMouseDown={(event) => startMouseDrag(event, chat.id)}
            onPointerEnter={() => preloadChatSurface(chat.mode)}
            draggable={renamingChatId !== chat.id}
            onDragStart={(event) => {
              const chatIds = getDragChatIds(chat.id);
              setDraggedChatId(chat.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-marinara-chat-ids", JSON.stringify(chatIds));
              event.dataTransfer.setData("application/x-marinara-chat-id", chat.id);
              event.dataTransfer.setData("text/plain", chat.id);
              // New layout on a computer: a chat dragged far to a side of the page opens there (split view).
              if (isOverhaulActive()) beginSplitDrag({ kind: "chat", id: chat.id });
            }}
            onDragEnd={() => {
              endSplitDrag();
              setDraggedChatId(null);
              setIsRootDropTarget(false);
            }}
            onClick={async () => {
              if (suppressTouchDragClickRef.current) {
                suppressTouchDragClickRef.current = false;
                return;
              }
              if (multiSelectMode) {
                toggleSelectChat(chat.id);
                return;
              }
              await openChat(chat.id);
            }}
            // Enter/Space go through the click handler, so multi-select and the touch-drag guard
            // apply to the keyboard too.
            onKeyDown={(event) => {
              const row = event.currentTarget;
              activateRowFromKey(event, () => row.click());
            }}
            data-chat-row="true"
            data-selected={isActive && !(multiSelectMode && isSelected) ? "true" : undefined}
            className={cn(
              "group relative isolate flex w-full touch-pan-y cursor-grab active:cursor-grabbing items-center gap-2.5 overflow-hidden rounded-lg px-3 text-left transition-all duration-150",
              overhaulActive ? "py-1.5" : "py-2.5",
              multiSelectMode && isSelected
                ? "mari-chrome-accent-surface mari-accent-animated"
                : isActive
                  ? "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)] shadow-sm"
                  : "hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
              draggedChatId === chat.id && "opacity-50",
            )}
          >
            {/* Multi-select checkbox */}
            {multiSelectMode && (
              <div className="mari-chrome-accent-icon mari-accent-animated shrink-0">
                {isSelected ? (
                  <CheckSquare size="0.875rem" />
                ) : (
                  <SquareIcon size="0.875rem" className="text-[var(--muted-foreground)]" />
                )}
              </div>
            )}

            {/* Chat background banner — active/hovered only, behind everything */}
            {bannerUrl && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-200",
                  // "hover" on a touch device means the active row only — no hover event ever fires.
                  chatListBackgrounds === "always" || isActive ? "opacity-100" : "group-hover:opacity-100",
                )}
              >
                {/* Muted twice over: the image is faint, and a scrim still sits on top. Keeping
                the scrim means text contrast does not depend on how light the image is. */}
                {/* Full-size chat background squeezed into a 40px row: keep the decode off the
                main thread and let offscreen rows skip it entirely. */}
                <img
                  src={bannerUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover opacity-[0.14] saturate-50"
                  data-mari-part="chat-row-art"
                />
                <span className="absolute inset-0 bg-gradient-to-r from-[var(--sidebar-background)]/80 to-[var(--sidebar-background)]/40" />
              </span>
            )}

            {/* Active indicator — generation is shown by the subtitle spinner instead. */}
            {isActive && (
              <span
                // left-0, not -left-0.5: the row now clips (overflow-hidden, for the banner).
                className="mari-chrome-accent-progress mari-accent-animated absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
              />
            )}

            {/* Chat avatar(s) or mode icon fallback — with unread badge overlay */}
            <div className="relative flex-shrink-0">
              {(() => {
                const avatars = charIds
                  .slice(0, 3)
                  .map((id) => {
                    const base = charLookup.get(id);
                    if (!base) return null;
                    const chatStatus = conversationStatusByCharacter.get(id);
                    return chatStatus ? { ...base, conversationStatus: chatStatus } : base;
                  })
                  .filter(Boolean) as {
                  name: string;
                  avatarUrl: string | null;
                  avatarCrop?: AvatarCrop | null;
                  conversationStatus?: string;
                }[];

                const isConvoMode = chat.mode === "conversation";
                const statusDot = (status?: string) => {
                  if (!isConvoMode) return null;
                  return (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-[0.1875rem] ring-[1.5px] ring-[var(--sidebar-background)]",
                        conversationStatusDotClass(status),
                      )}
                    />
                  );
                };
                const multiAvatarStatus = avatars.reduce<ConversationPresenceStatus | undefined>(
                  (worstStatus, avatar) => {
                    const nextStatus = asConversationStatus(avatar.conversationStatus) ?? "online";
                    if (!worstStatus) return nextStatus;
                    return CONVERSATION_STATUS_PRIORITY[nextStatus] > CONVERSATION_STATUS_PRIORITY[worstStatus]
                      ? nextStatus
                      : worstStatus;
                  },
                  undefined,
                );
                if (avatars.length === 0) {
                  return (
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-transform group-active:scale-90",
                        "mari-chat-mode-avatar",
                        cfg.logoModeClass,
                        isActive && "shadow-sm",
                      )}
                    >
                      {cfg.icon}
                    </div>
                  );
                }

                if (avatars.length === 1) {
                  const a = avatars[0]!;
                  return a.avatarUrl ? (
                    <div className="relative h-7 w-7 flex-shrink-0 transition-transform group-active:scale-90">
                      <span className="relative block h-7 w-7 overflow-hidden rounded-lg">
                        <img
                          src={a.avatarUrl}
                          alt={a.name}
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(a.avatarCrop)}
                        />
                      </span>
                      {statusDot(a.conversationStatus)}
                    </div>
                  ) : (
                    <div className="relative h-7 w-7 flex-shrink-0 transition-transform group-active:scale-90">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--secondary)] text-[0.625rem] font-bold text-[var(--muted-foreground)]"
                        data-mari-part="avatar-placeholder"
                        data-role="assistant"
                      >
                        {a.name[0]}
                      </div>
                      {statusDot(a.conversationStatus)}
                    </div>
                  );
                }

                // Multiple characters — stacked avatars
                return (
                  <div className="relative h-7 w-7 flex-shrink-0 transition-transform group-active:scale-90">
                    {avatars.slice(0, 2).map((a, i) =>
                      a.avatarUrl ? (
                        <span
                          key={i}
                          className={cn(
                            "absolute h-5 w-5 overflow-hidden rounded-md ring-2 ring-[var(--sidebar-background)]",
                            i === 0 ? "top-0 left-0 z-10" : "bottom-0 right-0",
                          )}
                        >
                          <img
                            src={a.avatarUrl}
                            alt={a.name}
                            className="h-full w-full object-cover"
                            style={getAvatarCropStyle(a.avatarCrop)}
                          />
                        </span>
                      ) : (
                        <div
                          key={i}
                          className={cn(
                            "absolute flex h-5 w-5 items-center justify-center rounded-md bg-[var(--secondary)] text-[0.5rem] font-bold text-[var(--muted-foreground)] ring-2 ring-[var(--sidebar-background)]",
                            i === 0 ? "top-0 left-0 z-10" : "bottom-0 right-0",
                          )}
                          data-mari-part="avatar-placeholder"
                          data-role="assistant"
                        >
                          {a.name[0]}
                        </div>
                      ),
                    )}
                    {statusDot(multiAvatarStatus)}
                  </div>
                );
              })()}

              {/* Unread count badge */}
              {(() => {
                const count = signalRows
                  ? signalRows.reduce((sum, row) => sum + (unreadCounts.get(row.chat.id) ?? 0), 0)
                  : unreadCounts.get(chat.id) || 0;
                if (count === 0 || isActive) return null;
                return (
                  <span className="absolute -top-1 -right-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500 px-1 text-[0.5625rem] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--sidebar-background)]">
                    {count > 99 ? "99+" : count}
                  </span>
                );
              })()}
            </div>

            {/* Name (desktop: a pencil beside it on hover renames in place) */}
            <div className="min-w-0 flex-1">
              {renamingChatId === chat.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  aria-label={localizeUi("ui.layout.chatsidebar.renameChat", { defaultValue: "Rename chat" })}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRename(chat.id, chat.name);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setRenamingChatId(null);
                    }
                  }}
                  onBlur={() => commitRename(chat.id, chat.name)}
                  onFocus={(event) => event.currentTarget.select()}
                  // Same height as the name it replaces, so the row doesn't grow while you type.
                  style={{ height: "1.25rem", minHeight: 0, paddingTop: 0, paddingBottom: 0 }}
                  className="mari-chrome-field ov-chat-rename block w-full rounded px-1 text-sm"
                />
              ) : (
                <span className="flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      "block min-w-0 truncate text-sm",
                      isActive ? "mari-chrome-text-strong font-medium" : "mari-chrome-text",
                    )}
                  >
                    {displayName}
                  </span>
                  {isChatPinned(chat) ? (
                    <Pin
                      size="0.6875rem"
                      className="shrink-0 text-[var(--muted-foreground)]"
                      aria-label={localizeUi("ui.layout.chatsidebar.pinned")}
                    />
                  ) : null}
                  {overhaulDesktop && !multiSelectMode ? (
                    <button
                      type="button"
                      data-chat-rename=""
                      aria-label={localizeUi("ui.layout.chatsidebar.renameChat", { defaultValue: "Rename chat" })}
                      title={localizeUi("ui.layout.chatsidebar.renameChat", { defaultValue: "Rename chat" })}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setRenameDraft(chat.name);
                        setRenamingChatId(chat.id);
                      }}
                      className="ov-chat-rename-btn shrink-0 rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--foreground)] focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Pencil size="0.6875rem" />
                    </button>
                  ) : null}
                  {overhaulDesktop && !multiSelectMode ? (
                    <button
                      type="button"
                      data-chat-tags-button=""
                      aria-label={localizeUi("theming.tags.editTitle", { defaultValue: "Chat tags" })}
                      title={localizeUi("theming.tags.editTitle", { defaultValue: "Chat tags" })}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        void editChatTagsWithSheet(chat);
                      }}
                      className="ov-chat-rename-btn shrink-0 rounded p-0.5 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--foreground)] focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Tag size="0.6875rem" />
                    </button>
                  ) : null}
                </span>
              )}
              {chat.metadata?.multiplayer && (
                <span className="mari-chrome-accent-text-muted block truncate text-[0.6875rem]">
                  {localizeUi(
                    (chat.metadata.multiplayer as { role?: string; status?: string }).role === "host"
                      ? (chat.metadata.multiplayer as { status?: string }).status === "ended"
                        ? "multiplayer.sidebar.stopped"
                        : "multiplayer.sidebar.hosting"
                      : (chat.metadata.multiplayer as { status?: string }).status === "joined"
                        ? "multiplayer.sidebar.joined"
                        : "multiplayer.sidebar.disconnected",
                  )}
                </span>
              )}
              {subtitle && !liveInTimeSlot && (
                <span className="mari-chrome-accent-text-muted flex items-center gap-1 truncate text-[0.6875rem] leading-tight">
                  {SubtitleIcon && (
                    <SubtitleIcon
                      className={cn(
                        "h-2.5 w-2.5 shrink-0",
                        SubtitleIcon === Loader2 ? "animate-spin" : "animate-pulse",
                      )}
                    />
                  )}
                  <span className="truncate">{subtitle}</span>
                </span>
              )}
            </div>

            {/* Branch count badge. With recorded lineage it is also the toggle for the tree: the badge
              is already the row's "this has branches" signal, so it opens them rather than a separate
              chevron gutter that would cost every row in the list its width. */}
            {isBranchRoot ? (
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={localizeUi(
                  isExpanded ? "ui.layout.chatsidebar.collapseBranches" : "ui.layout.chatsidebar.expandBranches",
                  { name: chat.name },
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  if (chat.groupId) toggleBranchGroup(chat.groupId);
                }}
                // On touch the pseudo-element widens the tap target to ~44px without growing the pill.
                className={cn(
                  "mari-chrome-muted-badge relative flex shrink-0 items-center gap-0.5 px-1.5 py-0.5 text-[0.625rem] transition-colors hover:border-[var(--marinara-chat-chrome-button-border-active)]",
                  "after:absolute after:inset-0 after:content-[''] max-md:after:-inset-x-1 max-md:after:-inset-y-3 [@media(pointer:coarse)]:after:-inset-x-1 [@media(pointer:coarse)]:after:-inset-y-3",
                  isExpanded && "border-[var(--marinara-chat-chrome-button-border-active)]",
                )}
              >
                <GitBranch size="0.625rem" />
                {branchCount}
                <ChevronDown
                  size="0.625rem"
                  className={cn("transition-transform duration-200 ease-out", isExpanded && "rotate-180")}
                />
              </button>
            ) : (
              branchCount > 1 && (
                <span className="mari-chrome-muted-badge flex shrink-0 items-center gap-0.5 px-1.5 py-0.5 text-[0.625rem]">
                  <GitBranch size="0.625rem" />
                  {branchCount}
                </span>
              )
            )}

            {/* Last-activity time, after the branch badge so the dates line up down the list. */}
            {liveInTimeSlot ? (
              <span
                className="mari-chrome-accent-text-muted flex shrink-0 items-center gap-1 text-[0.625rem]"
                title={subtitle ?? undefined}
              >
                <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden="true" />
                {subtitle}
              </span>
            ) : relativeTime ? (
              <span className="mari-chrome-accent-text-muted shrink-0 text-[0.625rem] tabular-nums">
                {relativeTime}
              </span>
            ) : null}

            {/* Delete button (phones with swipe gestures delete from the row swipe instead) */}
            {/* The new layout has no row trash can: one stray click shouldn't delete a chat. Delete
                lives in Select chats, the right-click menu and the phone's swipe/long-press. */}
            {!multiSelectMode && !swipeRows && !overhaulActive && (
              <button
                aria-label={localizeUi("chat.branches.deleteLabel", { name: displayName })}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (branchCount > 1 && chat.groupId) {
                    setDeleteTarget({
                      chatId: chat.id,
                      chatName: displayName,
                      groupId: chat.groupId,
                      branchCount,
                    });
                  } else {
                    await confirmDeleteChat(chat.id, displayName);
                  }
                }}
                data-chat-row-delete
                className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100 max-md:opacity-100"
              >
                <Trash2 size="0.75rem" />
              </button>
            )}
          </div>
        </SwipeActionsRow>

        {isBranchRoot && branchRows && (
          // The guide line hangs from the centre of the chat's avatar (px-3 + half of the 28px
          // avatar = 26px; one more column with the multi-select checkbox), and branch names start
          // under the chat's name. One line per level, like a folder's children — per-row connector
          // elbows were tried and read as noise in a sidebar this narrow.
          <SmoothFolderContent open={isExpanded}>
            <div
              className={cn(
                "flex flex-col gap-0.5 border-l border-[var(--marinara-chat-chrome-accent)]/45 mb-1 pl-4",
                multiSelectMode ? "ml-[3.0625rem]" : "ml-[1.5625rem]",
              )}
            >
              {renderBranchLevel(branchRows.slice(1))}
            </div>
          </SmoothFolderContent>
        )}
      </div>
    );
  };

  return (
    <nav
      ref={sidebarNavRef}
      data-component="ChatSidebar"
      aria-label={localize("Chat navigation")}
      tabIndex={-1}
      onKeyDown={sidebarKeyboard.onKeyDown}
      className="mari-chat-sidebar mari-chrome-token-scope flex h-full flex-col outline-none"
    >
      {/* Header */}
      <div className="mari-sidebar-header relative flex h-12 items-center justify-between px-4">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
        <div className="flex min-w-0 items-center gap-2.5">
          {overhaulMobile ? (
            // Same spot as the top bar's left button, so the same tap closes the list.
            <button
              type="button"
              className="ovm-icon-btn is-on"
              aria-pressed="true"
              aria-label={localize("Hide chat list")}
              title={localize("Chats")}
              onClick={() => setSidebarOpen(false)}
            >
              <MessageCircle size={22} />
            </button>
          ) : (
            <ChatSidebarTitleIcon />
          )}
          <h2 className="mari-chrome-text-strong truncate text-sm font-semibold">{localize("Chats")}</h2>
          {overhaulMobile ? null : (
            <HelpTooltip
              text={t("navigation.sidebarHelp.chats")}
              ariaLabel={t("navigation.sidebarHelp.button", { sidebar: localize("Chats") })}
              side="bottom"
              wide
              className="shrink-0 [@media(pointer:coarse)]:-ml-3"
              buttonClassName="justify-center [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
            />
          )}
        </div>
        {overhaulMobile ? <MobileChatsHomeButton /> : null}
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <PersonalExtensionContributionSlot surface="chats" position="header" className="max-w-28" />
          {overhaulMobile ? <MobileLibraryButton tour={false} /> : null}
          {overhaulDesktop ? (
            <>
              <button
                onClick={() => chatImportInputRef.current?.click()}
                disabled={isImportingChat}
                className="ov-icon-btn ov-icon-btn--sm"
                title={localize(isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL")}
                aria-label={localize(isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL")}
              >
                <Download size="0.8125rem" />
              </button>
              {activeModeHasChats ? (
                <button
                  onClick={handleCreateFolder}
                  className="ov-icon-btn ov-icon-btn--sm"
                  title={localize("New folder")}
                  aria-label={localize("New folder")}
                >
                  <FolderPlus size="0.8125rem" />
                </button>
              ) : null}
              <button
                onClick={() => (multiSelectMode ? exitMultiSelect() : setMultiSelectMode(true))}
                disabled={displayChats.length === 0}
                aria-pressed={multiSelectMode}
                className={cn("ov-icon-btn ov-icon-btn--sm", multiSelectMode && "is-on")}
                title={localize(multiSelectMode ? "Cancel selection" : "Select chats")}
                aria-label={localize(multiSelectMode ? "Cancel selection" : "Select chats")}
              >
                <CheckSquare size="0.8125rem" />
              </button>
              <button
                onClick={handleNewChatFromTab}
                disabled={createChat.isPending}
                className="ov-new-pill"
                title={t(`navigation.chatSidebar.new.${activeTab}`)}
                aria-label={t(`navigation.chatSidebar.new.${activeTab}`)}
              >
                <Plus size="0.8125rem" aria-hidden="true" />
                <span>{localize("New")}</span>
              </button>
            </>
          ) : null}
          {/* New layout on phones: the top bar's left button closes the list, as on desktop. */}
          {overhaulMobile ? null : (
            <button
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "mari-chrome-control mari-chrome-control--small mari-accent-animated p-1.5 active:scale-90 md:hidden max-md:h-9 max-md:w-9 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9",
                overhaulActive && "!hidden",
              )}
              title={localize("Close")}
              aria-label={localize("Close chats")}
            >
              <X size="0.875rem" />
            </button>
          )}
        </div>
      </div>

      <PersonalExtensionContributionSlot
        surface="chats"
        position="before-content"
        className="shrink-0 border-b border-[var(--border)]/40"
      />

      {/* Tabs */}
      <div className="ov-chats-modes px-3 pt-3">
        <div className="mari-chrome-segmented" data-tour="chat-modes">
          {(["conversation", "roleplay", "game"] as const).map((tab) => {
            const cfg = MODE_CONFIG[tab];
            const isActive = activeTab === tab;
            const tabUnread =
              chats?.filter((c) => c.mode === tab).reduce((sum, c) => sum + (unreadCounts.get(c.id) || 0), 0) ?? 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                aria-pressed={isActive}
                data-chat-mode-tab={tab}
                data-tour={`chat-mode-${tab}`}
                className={cn(
                  "mari-chrome-segmented__button gap-1 overflow-visible px-1.5 py-2 text-[0.625rem] leading-normal",
                  isActive && "mari-chrome-segmented__button--selected",
                )}
              >
                <span className="shrink-0 leading-none">{cfg.icon}</span>
                <span className="inline-flex min-h-[1rem] items-center whitespace-nowrap pb-px leading-normal">
                  {localize(overhaulActive ? cfg.label : cfg.shortLabel)}
                </span>
                {overhaulActive ? (
                  <small className="ov-mode-count">{chats?.filter((c) => c.mode === tab).length ?? 0}</small>
                ) : null}
                {tabUnread > 0 && !isActive && (
                  <span className="absolute -top-1 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-md bg-red-500 px-0.5 text-[0.5rem] font-bold leading-none text-white">
                    {tabUnread > 99 ? "99+" : tabUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("flex gap-2 px-3 pt-2", (overhaulDesktop || overhaulMobile) && "hidden")}>
        <input
          ref={chatImportInputRef}
          type="file"
          accept=".jsonl"
          className="hidden"
          onChange={handleImportChatFile}
        />
        <button
          onClick={handleNewChatFromTab}
          disabled={createChat.isPending}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary mari-chat-mode-action flex-1 text-xs",
            activeModeConfig.logoModeClass,
            overhaulMobile && "!hidden",
          )}
          title={t(`navigation.chatSidebar.new.${activeTab}`)}
          aria-label={t(`navigation.chatSidebar.new.${activeTab}`)}
        >
          <Plus size="0.8125rem" className="mari-rgb-static-icon" />
        </button>
        <button
          onClick={() => chatImportInputRef.current?.click()}
          disabled={isImportingChat}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title={localize(isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL")}
          aria-label={localize(isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL")}
        >
          <Download size="0.8125rem" />
        </button>
        {overhaulMobile && activeModeHasChats ? (
          <button
            onClick={handleCreateFolder}
            className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
            title={localize("New folder")}
            aria-label={localize("New folder")}
          >
            <FolderPlus size="0.8125rem" />
          </button>
        ) : null}
        <button
          onClick={() => (multiSelectMode ? exitMultiSelect() : setMultiSelectMode(true))}
          disabled={displayChats.length === 0}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            multiSelectMode && "mari-chrome-control--selected",
          )}
          title={localize(multiSelectMode ? "Cancel selection" : "Select chats")}
          aria-label={localize(multiSelectMode ? "Cancel selection" : "Select chats")}
        >
          <CheckSquare size="0.8125rem" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="ov-chats-tools space-y-1.5 px-3 py-2">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search
              size="0.8125rem"
              className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={t(`navigation.chatSidebar.search.${activeTab}`)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.nativeEvent.isComposing && searchQuery) {
                  event.preventDefault();
                  setSearchQuery("");
                }
              }}
              className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
            />
          </div>
          {/* New layout: one search box, then the same Tags selector as the Library pages, right beside it
              on every screen size (message search stays on Ctrl+Shift+F, the omnibar and the phone's ⋯ menu). */}
          {overhaulActive ? (
            <TagFilter
              tags={tagCounts.tags}
              untagged={tagCounts.untagged}
              picked={pickedTags}
              onChange={setPickedTags}
              compact
              className="mari-chrome-control mari-chrome-control--small h-10 min-w-10 shrink-0 justify-center gap-1 px-2.5 md:h-9 md:min-w-9"
            />
          ) : null}
          <div className={cn("relative", overhaulMobile && "hidden")}>
            <select
              value={manualOrderActive ? "manual" : sort}
              onChange={(e) => {
                manualOrder.setActive(e.target.value === "manual");
                if (e.target.value !== "manual") setSort(e.target.value as ChatSortOption);
              }}
              className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
              title={localize("Sort chats")}
            >
              <option value="custom">{localizeUi("ui.layout.chatsidebar.customOrder")}</option>
              <option value="manual" title={localizeUi("dragDrop.manualOrderHelp")}>
                {localizeUi("dragDrop.manualOrder")}
              </option>
              <option value="recent">{localizeUi("ui.layout.chatsidebar.recent")}</option>
              <option value="newest">{localize("Newest")}</option>
              <option value="oldest">{localize("Oldest")}</option>
              <option value="name-asc">{localize("A to Z")}</option>
              <option value="name-desc">{localize("Z to A")}</option>
            </select>
            <ArrowUpDown
              size="0.625rem"
              className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>
          <button
            type="button"
            onClick={() => openGlobalSearch(searchQuery.trim())}
            className={cn(
              "mari-chrome-control mari-chrome-control--small h-10 w-10 shrink-0 justify-center p-0! md:h-9 md:w-9",
              overhaulActive && "!hidden",
            )}
            title={localizeUi("chatInsights.search.open")}
            aria-label={localizeUi("chatInsights.search.open")}
          >
            <TextSearch size="0.875rem" />
          </button>
          {overhaulMobile ? (
            // "+ New" lives with the list's own tools, as on the Library pages (panel 3, PV7).
            <button
              type="button"
              onClick={handleNewChatFromTab}
              disabled={createChat.isPending}
              className="ov-new-pill ovm-chats-new"
              title={t(`navigation.chatSidebar.new.${activeTab}`)}
              aria-label={t(`navigation.chatSidebar.new.${activeTab}`)}
            >
              <Plus size="1rem" aria-hidden="true" />
              <span>{localize("New")}</span>
            </button>
          ) : null}
          {overhaulMobile ? (
            <div className="ov-menu-wrap ovm-chats-more">
              <button
                type="button"
                className="mari-chrome-control ovm-chats-more__btn"
                aria-label={localize("More chat list options")}
                aria-expanded={ovmListMenuOpen}
                onClick={() => setOvmListMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={20} />
              </button>
              {ovmListMenuOpen ? (
                <div
                  className="ov-menu ovm-chats-menu"
                  role="menu"
                  aria-label={localize("Chat list options")}
                  onClick={(event) => {
                    if (event.target === event.currentTarget) setOvmListMenuOpen(false);
                  }}
                >
                  <p className="ovm-chats-menu__label">{localize("Sort")}</p>
                  {(
                    [
                      ["custom", localizeUi("ui.layout.chatsidebar.customOrder")],
                      ["manual", localizeUi("dragDrop.manualOrder")],
                      ["recent", localizeUi("ui.layout.chatsidebar.recent")],
                      ["newest", localize("Newest")],
                      ["oldest", localize("Oldest")],
                      ["name-asc", localizeUi("ui.panels.backgroundpicker.aZ")],
                      ["name-desc", localizeUi("ui.panels.backgroundpicker.zA")],
                    ] as const
                  ).map(([value, label]) => {
                    const checked = (manualOrderActive ? "manual" : sort) === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={checked}
                        onClick={() => {
                          manualOrder.setActive(value === "manual");
                          if (value !== "manual") setSort(value as ChatSortOption);
                          setOvmListMenuOpen(false);
                        }}
                      >
                        <span className="ovm-chats-menu__text">{label}</span>
                        {checked ? <Check size={18} className="ovm-chats-menu__check" /> : null}
                      </button>
                    );
                  })}
                  <hr className="ovm-chats-menu__rule" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={displayChats.length === 0}
                    onClick={() => {
                      setOvmListMenuOpen(false);
                      if (multiSelectMode) exitMultiSelect();
                      else setMultiSelectMode(true);
                    }}
                  >
                    <CheckSquare size={18} />
                    {localize(multiSelectMode ? "Cancel selection" : "Select chats")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOvmListMenuOpen(false);
                      handleCreateFolder();
                    }}
                  >
                    <FolderPlus size={18} />
                    {localize("New folder")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isImportingChat}
                    onClick={() => {
                      setOvmListMenuOpen(false);
                      chatImportInputRef.current?.click();
                    }}
                  >
                    <Download size={18} />
                    {localize("Import chat")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOvmListMenuOpen(false);
                      openGlobalSearch(searchQuery.trim());
                    }}
                  >
                    <TextSearch size={18} />
                    {localizeUi("chatInsights.search.open")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {!overhaulActive && allTags.length > 0 && (
          <div className="flex max-w-full flex-wrap items-center gap-1">
            <button
              onClick={() => setTagsExpanded((prev) => !prev)}
              className={cn(
                "flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-[0.625rem] transition-colors",
                activeTag
                  ? "mari-chrome-accent-surface mari-accent-animated"
                  : "mari-chrome-text-muted hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
              )}
              title={localize(tagsExpanded ? "Collapse tags" : "Expand tags")}
            >
              <Tag size="0.6875rem" className="shrink-0" />
              <span className="max-w-full truncate">
                {activeTag
                  ? localizeUi("ui.layout.chatsidebar.tagValue1", { value1: activeTag })
                  : localizeUi("ui.layout.chatsidebar.tagsValue1", { value1: allTags.length })}
              </span>
              {tagsExpanded ? (
                <ChevronUp size="0.625rem" className="shrink-0" />
              ) : (
                <ChevronDown size="0.625rem" className="shrink-0" />
              )}
            </button>
            {activeTag && (
              <button
                onClick={() => setPickedTags([])}
                className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
              >
                {localize("Clear")}
              </button>
            )}
            {(tagsExpanded ? allTags : allTags.slice(0, 4)).map((tag) => (
              <button
                key={tag}
                onClick={() => setPickedTags((prev) => (prev[0] === tag ? [] : [tag]))}
                className={cn(
                  "max-w-full truncate rounded-lg px-2 py-1 text-[0.625rem] font-medium transition-all",
                  activeTag === tag
                    ? "mari-chrome-accent-surface mari-accent-animated"
                    : "mari-chrome-muted-badge hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
                )}
                title={tag}
              >
                {tag}
              </button>
            ))}
            {!tagsExpanded && allTags.length > 4 && (
              <button
                onClick={() => setTagsExpanded(true)}
                className="mari-chrome-control mari-chrome-control--compact"
              >
                +{allTags.length - 4} {localizeUi("ui.layout.chatsidebar.more")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat list */}
      <div
        ref={chatListRef}
        data-chat-root-drop-zone
        className={cn(
          "ov-chats-list flex-1 overflow-y-auto px-2 pb-1 pt-0.5 transition-colors",
          isRootDropTarget && "bg-[var(--marinara-chat-chrome-highlight-bg)]",
        )}
        onDragEnter={(event) => {
          if (!draggedChatId) return;
          event.preventDefault();
          setIsRootDropTarget(true);
        }}
        onDragOver={(event) => {
          if (!draggedChatId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsRootDropTarget(false);
          }
        }}
        onDrop={(event) => {
          if (!draggedChatId) return;
          event.preventDefault();
          const target = event.target as Element | null;
          if (target?.closest("[data-chat-folder-id]")) {
            setIsRootDropTarget(false);
            return;
          }
          const chatId =
            event.dataTransfer.getData("application/x-marinara-chat-id") ||
            event.dataTransfer.getData("text/plain") ||
            draggedChatId;
          const chatIdsPayload = event.dataTransfer.getData("application/x-marinara-chat-ids");
          const chatIds = chatIdsPayload ? (JSON.parse(chatIdsPayload) as string[]) : [chatId];
          if (chatIds.length > 0) handleDropChatsToFolder(chatIds, null);
          setIsRootDropTarget(false);
        }}
      >
        <ChatRowPeek containerRef={chatListRef} activeChatId={activeChatId} disabled={multiSelectMode} />
        {isLoading && <PanelListSkeleton />}

        {chatsError && !isLoading && (
          <PanelErrorState
            message={localizeUi("ui.layout.chatsidebar.marinaraIsStillWakingUpChatsShouldAppearIn")}
            onRetry={() => void refetchChats()}
            retrying={isFetching}
          />
        )}

        {displayChats.length === 0 && !isLoading && !chatsError && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <div className="mari-chrome-accent-soft-tile mari-accent-animated animate-float flex h-12 w-12 items-center justify-center rounded-2xl">
              <ChatModeIcon mode={activeTab} size="1.25rem" />
            </div>
            <p className="mari-chrome-text-muted text-xs">
              {t(
                `navigation.chatSidebar.empty.${searchQuery.trim() || pickedTags.length ? "filtered" : "initial"}.${activeTab}`,
              )}
            </p>
            <button
              onClick={handleNewChatFromTab}
              disabled={createChat.isPending}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact mari-chat-mode-action mt-1",
                activeModeConfig.logoModeClass,
              )}
            >
              <span>+</span>
              {t(`navigation.chatSidebar.new.${activeTab}`)}
            </button>
          </div>
        )}

        <div className="ov-chats-rows stagger-children flex flex-col gap-0.5 px-1">
          {activeModeHasChats && !overhaulActive && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCreateFolder}
                className="mari-chrome-control mari-chrome-control--small flex-1 justify-center text-[0.6875rem]"
              >
                <FolderPlus size="0.75rem" />
                {localize("New folder")}
              </button>
            </div>
          )}

          {modeFolders.length > 0 && activeModeHasChats && (
            <p className="mari-folder-helper">
              {localize("Drag and drop chats to folders, double-click or double-tap to rename")}
            </p>
          )}

          {/* Folders (drag-to-reorder) */}
          {folderOrder.length > 0 && (
            <Reorder.Group
              axis="y"
              values={folderDrag.orderItems(folderOrder, (id) => id)}
              onReorder={handleFolderReorder}
              as="div"
              className="flex flex-col gap-0.5 mt-1"
            >
              {folderDrag
                .orderItems(folderOrder, (id) => id)
                .map((folderId) => {
                  const folder = modeFolders.find((f) => f.id === folderId);
                  if (!folder) return null;
                  const folderEntries = folderChatsMap.get(folderId) ?? [];
                  const folderChatCount = folderChatCounts.get(folderId) ?? folderEntries.length;
                  if (chatListFilterActive && folderEntries.length === 0) return null;
                  return (
                    <FolderRow
                      folderDragBindings={folderDrag.bind(folderId)}
                      key={folderId}
                      folder={folder}
                      entries={folderEntries}
                      chatCount={folderChatCount}
                      forceExpanded={chatListFilterActive && folderEntries.length > 0}
                      renderChatRow={renderChatRow}
                      onToggleCollapse={handleToggleCollapse}
                      onRename={handleRenameFolder}
                      onDelete={handleDeleteFolder}
                      draggedChatId={draggedChatId}
                      onDropChat={handleDropChatsToFolder}
                    />
                  );
                })}
            </Reorder.Group>
          )}

          {/* Unfiled chats */}
          {unfiledChats.map(renderChatRow)}

          {hasMoreDisplayChats && (
            <button
              type="button"
              onClick={() => setVisibleChatLimit((limit) => limit + CHAT_LIST_PAGE_SIZE)}
              className="mari-chrome-control mari-chrome-control--primary justify-center text-xs"
            >
              {t("navigation.chatSidebar.loadMore", { count: visibleDisplayChats.length })}
            </button>
          )}
        </div>
      </div>

      {/* ── Multi-select action bar ── */}
      {multiSelectMode && (
        <SelectionActionBar
          selectedCount={selectedChatIds.size}
          onExport={() => void handleBatchExport()}
          onDelete={handleBatchDelete}
          deleteTone="accent"
          exporting={bulkExportChats.isPending}
          className="static mx-0"
        />
      )}

      <PersonalExtensionContributionSlot
        surface="chats"
        position="after-content"
        className="shrink-0 border-t border-[var(--border)]/40"
      />

      {/* ── User Status Selector ── */}
      <UserStatusFooter
        // New layout: always there, so the footer doesn't shift when the mode filter changes (audit D19).
        showScheduleManager={activeTab === "conversation" || isOverhaulLook()}
        onOpenScheduleManager={() => {
          // Overhaul: the schedules are a page with its own tab, not a dialog.
          if (isOverhaulLook()) {
            useUIStore.getState().closeAllDetails();
            useOverhaulStore.getState().openSchedules();
            if (isOverhaulMobile()) setSidebarOpen(false);
          } else setScheduleManagerOpen(true);
        }}
      />

      {scheduleManagerOpen && (
        <Suspense fallback={null}>
          <CharacterScheduleManagerModal open onClose={() => setScheduleManagerOpen(false)} />
        </Suspense>
      )}

      {rowSheet ? <RowActionSheet title={rowSheet.title} actions={rowSheet.actions} onClose={closeRowSheet} /> : null}

      {/* ── Delete Branch Modal ── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={localizeUi("ui.layout.chatsidebar.deleteChat")}
        width="max-w-sm"
        confirm
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/10">
                <AlertTriangle size="1.125rem" className="text-[var(--destructive)]" />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {localizeUi("chat.delete.branchChoice", {
                  name: deleteTarget.chatName,
                  count: deleteTarget.branchCount,
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  deleteChat.mutate({ id: deleteTarget.chatId, force: true });
                  if (activeChatId === deleteTarget.chatId) setActiveChatId(null);
                  setDeleteTarget(null);
                }}
                className="mari-chrome-control mari-chrome-control--primary w-full text-xs"
              >
                <Trash2 size="0.8125rem" />
                {localizeUi("ui.layout.chatsidebar.deleteThisBranchOnly")}
              </button>
              <button
                onClick={() => {
                  if (deleteTarget.groupId) {
                    deleteChatGroup.mutate({ groupId: deleteTarget.groupId, force: true });
                    if (activeGroupId === deleteTarget.groupId) setActiveChatId(null);
                  }
                  setDeleteTarget(null);
                }}
                className="mari-chrome-control mari-chrome-control--primary w-full text-xs"
              >
                <Trash2 size="0.8125rem" />
                {localizeUi("ui.characters.spritestab.deleteAll")} {deleteTarget.branchCount}{" "}
                {localizeUi("ui.layout.chatsidebar.branches_f578227")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </nav>
  );
}

/**
 * Enter/Space activation for a `role="button"` row. Keys aimed at a button inside the row stay
 * that button's, modified keys stay free for shortcuts, and a held key activates once (its
 * repeats are still prevented, so a held Space does not scroll the list).
 */
function activateRowFromKey(event: React.KeyboardEvent<HTMLElement>, activate: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  if (event.repeat) return;
  activate();
}

/** Past this depth a branch still renders, but without another step of indent. */
const MAX_BRANCH_NESTING = 4;
/** A nested level: its line sits under the parent branch's name (the row's px-2). */
const BRANCH_LEVEL_CLASS = "ml-2 flex flex-col gap-0.5 border-l border-[var(--marinara-chat-chrome-accent)]/45 pl-1.5";

// Every branch shares the chat's characters, so a branch row drops the avatar and keeps only what
// tells branches apart: the name, when it was last active, and whether it needs attention. One row
// style at every depth, so the indent alone says who belongs to whom.
function BranchRow({
  chatId,
  name,
  relativeTime,
  isActive,
  isSelected,
  multiSelectMode,
  unread,
  isBusy,
  deleteLabel,
  onSelect,
  onToggleSelect,
  onDelete,
  showDelete = true,
}: {
  chatId: string;
  name: string;
  relativeTime: string | null;
  isActive: boolean;
  isSelected: boolean;
  multiSelectMode: boolean;
  unread: number;
  isBusy: boolean;
  deleteLabel: string;
  onSelect: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
  showDelete?: boolean;
}) {
  // Same click semantics as every other row: multi-select selects, otherwise it opens the chat.
  const handleClick = multiSelectMode ? onToggleSelect : onSelect;
  return (
    <div
      role="button"
      tabIndex={0}
      data-chat-id={chatId}
      aria-pressed={multiSelectMode ? isSelected : undefined}
      title={name}
      onClick={handleClick}
      onKeyDown={(event) => activateRowFromKey(event, handleClick)}
      className={cn(
        "group flex min-w-0 cursor-pointer items-center gap-2 rounded-md py-1.5 pr-3 pl-2 transition-colors max-md:min-h-11 [@media(pointer:coarse)]:min-h-11",
        multiSelectMode && isSelected
          ? "mari-chrome-accent-surface mari-accent-animated"
          : isActive
            ? "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]"
            : "hover:bg-[var(--marinara-chat-chrome-highlight-bg)]",
      )}
    >
      {multiSelectMode && (
        <span className="mari-chrome-accent-icon mari-accent-animated shrink-0">
          {isSelected ? (
            <CheckSquare size="0.75rem" />
          ) : (
            <SquareIcon size="0.75rem" className="text-[var(--muted-foreground)]" />
          )}
        </span>
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[0.8125rem]",
          isActive ? "mari-chrome-text-strong font-medium" : "mari-chrome-text",
        )}
      >
        {name}
      </span>
      {isBusy && <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-[var(--muted-foreground)]" />}
      {!isActive && !multiSelectMode && unread > 0 && (
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-md bg-red-500 px-1 text-[0.5625rem] font-bold leading-none text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {relativeTime && (
        <span className="mari-chrome-accent-text-muted shrink-0 text-[0.625rem] tabular-nums">{relativeTime}</span>
      )}
      {!multiSelectMode && showDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          data-chat-row-delete
          className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        >
          <Trash2 size="0.75rem" />
        </button>
      )}
    </div>
  );
}

// ── FolderRow (self-contained state for menu/rename) ──
function FolderRow({
  folderDragBindings,
  folder,
  entries,
  chatCount,
  forceExpanded = false,
  renderChatRow,
  onToggleCollapse,
  onRename,
  onDelete,
  draggedChatId,
  onDropChat,
}: {
  folderDragBindings: ReturnType<ReturnType<typeof useLibraryFolderDrag>["bind"]>;
  folder: ChatFolder;
  entries: { chat: any; branchCount: number }[];
  chatCount: number;
  forceExpanded?: boolean;
  renderChatRow: (entry: any) => React.ReactNode;
  onToggleCollapse: (folder: ChatFolder) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (folder: ChatFolder, chatCount: number) => void;
  draggedChatId: string | null;
  onDropChat: (chatIds: string[], folderId: string | null) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const handleFolderRenameGesture = useFolderRenameGesture();
  const canToggleCollapse = !forceExpanded;
  const isExpanded = forceExpanded || !folder.collapsed;

  useEffect(() => {
    if (!renaming) setRenameValue(folder.name);
  }, [folder.name, renaming]);

  const beginRename = () => {
    setRenameValue(folder.name);
    setRenaming(true);
  };

  return (
    <Reorder.Item
      {...folderDragBindings}
      value={folder.id}
      layout="position"
      data-chat-folder-id={folder.id}
      dragListener={false}
      as="div"
      onDragEnter={(event) => {
        if (!draggedChatId) return;
        event.preventDefault();
        setIsDropTarget(true);
      }}
      onDragOver={(event) => {
        if (!draggedChatId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(event) => {
        if (!draggedChatId) return;
        event.preventDefault();
        event.stopPropagation();
        const chatId =
          event.dataTransfer.getData("application/x-marinara-chat-id") ||
          event.dataTransfer.getData("text/plain") ||
          draggedChatId;
        const chatIdsPayload = event.dataTransfer.getData("application/x-marinara-chat-ids");
        const chatIds = chatIdsPayload ? (JSON.parse(chatIdsPayload) as string[]) : [chatId];
        if (chatIds.length > 0) onDropChat(chatIds, folder.id);
        setIsDropTarget(false);
      }}
      className={cn(
        "flex flex-col rounded-lg transition-colors",
        isDropTarget &&
          "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
      )}
    >
      {/* Folder header */}
      <div className="group relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-accent)]/40">
        <div
          data-drag-surface
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={localizeUi("ui.layout.folderrow.value1FolderValue2DoubleTapOrPressF2To", {
            value1: isExpanded
              ? localizeUi("ui.panels.ttsconfigcard.collapse")
              : localizeUi("ui.panels.ttsconfigcard.expand"),
            value2: folder.name,
          })}
          title={localizeUi("ui.panels.backgroundpicker.doubleClickDoubleTapOrPressF2ToRename")}
          onClick={(e) =>
            handleFolderRenameGesture(folder.id, e, {
              onSingleClick: () => {
                if (canToggleCollapse) onToggleCollapse(folder);
              },
              onRename: beginRename,
            })
          }
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            handleFolderRenameKeyDown(e, {
              onSingleClick: () => {
                if (canToggleCollapse) onToggleCollapse(folder);
              },
              onRename: beginRename,
            });
          }}
          className="flex flex-1 items-center gap-1.5 min-w-0"
        >
          <ChevronRight
            size="0.75rem"
            className={cn(
              "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
              isExpanded && "rotate-90",
            )}
          />
          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  onRename(folder.id, renameValue);
                  setRenaming(false);
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setRenameValue(folder.name);
                }
              }}
              onBlur={(e) => {
                e.stopPropagation();
                onRename(folder.id, renameValue);
                setRenaming(false);
              }}
              className="flex-1 bg-transparent text-xs font-medium text-[var(--foreground)] outline-none min-w-0"
            />
          ) : (
            <span className="mari-chrome-text flex-1 min-w-0 cursor-pointer truncate text-xs font-medium">
              {folder.name}
            </span>
          )}
        </div>
        {entries.length > 0 && (
          <span className="mari-chrome-text-muted shrink-0 text-[0.5625rem]">{entries.length}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(folder, chatCount);
          }}
          className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100 max-md:opacity-100"
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>
      {/* Folder contents */}
      <SmoothFolderContent
        open={isExpanded && entries.length > 0}
        className="ml-4 border-l border-[var(--border)]/20 pl-1"
        innerClassName="flex flex-col gap-0.5"
      >
        {entries.map(renderChatRow)}
      </SmoothFolderContent>
    </Reorder.Item>
  );
}

// ── Status config ──
const STATUS_OPTIONS: Array<{
  value: UserStatus;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}> = [
  {
    value: "active",
    label: "Active",
    description: "You're online and available",
    color: "bg-[var(--mari-status-online)]",
    icon: <Circle size="0.625rem" className="fill-[var(--mari-status-online)] text-[var(--mari-status-online)]" />,
  },
  {
    value: "idle",
    label: "Idle",
    description: "Automatic when you're away",
    color: "bg-[var(--mari-status-idle)]",
    icon: <Moon size="0.625rem" className="text-[var(--mari-status-idle)]" />,
  },
  {
    value: "dnd",
    label: "Do Not Disturb",
    description: "Suppress auto messages",
    color: "bg-[var(--mari-status-dnd)]",
    icon: <MinusCircle size="0.625rem" className="text-[var(--mari-status-dnd)]" />,
  },
  {
    value: "invisible",
    label: "Invisible",
    description: "Hide your status from models",
    color: "bg-[var(--mari-status-offline)]",
    icon: <Circle size="0.625rem" className="fill-[var(--mari-status-offline)] text-[var(--mari-status-offline)]" />,
  },
];

function UserStatusFooter({
  showScheduleManager,
  onOpenScheduleManager,
}: {
  showScheduleManager: boolean;
  onOpenScheduleManager: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const userStatus = useUIStore((s) => s.userStatus);
  const userActivity = useUIStore((s) => s.userActivity);
  const recentUserActivities = useUIStore((s) => s.recentUserActivities);
  const setUserStatusManual = useUIStore((s) => s.setUserStatusManual);
  const setUserActivity = useUIStore((s) => s.setUserActivity);
  const rememberUserActivity = useUIStore((s) => s.rememberUserActivity);
  const [open, setOpen] = useState(false);
  const [activityFocused, setActivityFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Esc closes it too (audit H5).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = STATUS_OPTIONS.find((s) => s.value === userStatus) ?? STATUS_OPTIONS[0]!;
  const recentActivitySuggestions = useMemo(() => {
    const currentActivity = userActivity.replace(/\s+/g, " ").trim().toLowerCase();
    return recentUserActivities
      .filter((activity) => activity.trim() && activity.trim().toLowerCase() !== currentActivity)
      .slice(0, 3);
  }, [recentUserActivities, userActivity]);

  const commitCurrentActivity = useCallback(() => {
    const normalized = userActivity.replace(/\s+/g, " ").trim().slice(0, 120);
    if (normalized !== userActivity) setUserActivity(normalized);
    if (normalized) rememberUserActivity(normalized);
  }, [rememberUserActivity, setUserActivity, userActivity]);

  const applyRecentActivity = useCallback(
    (activity: string) => {
      setUserActivity(activity);
      rememberUserActivity(activity);
      setActivityFocused(false);
    },
    [rememberUserActivity, setUserActivity],
  );

  return (
    <div ref={ref} className="mari-status-footer relative border-t border-[var(--border)]/30 px-3 py-2">
      {/* Popup */}
      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl bg-[var(--popover)] p-1.5 shadow-xl ring-1 ring-[var(--border)]/40">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setUserStatusManual(opt.value);
                setOpen(false);
              }}
              className={cn(
                "mari-chrome-control w-full justify-start px-2.5 py-2 text-left",
                userStatus === opt.value && "mari-chrome-control--selected",
              )}
            >
              <span className={`h-2 w-2 rounded-full ${opt.color}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--foreground)]">{opt.label}</div>
                <div className="text-[0.625rem] text-[var(--muted-foreground)]">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {activityFocused && !open && recentActivitySuggestions.length > 0 && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl bg-[var(--popover)] p-1.5 shadow-xl ring-1 ring-[var(--border)]/40">
          <div className="px-2 pb-1 pt-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {localizeUi("ui.layout.userstatusfooter.recentStatus")}
          </div>
          {recentActivitySuggestions.map((activity) => (
            <button
              key={activity}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyRecentActivity(activity)}
              className="mari-chrome-control mari-chrome-control--small w-full min-w-0 justify-start text-left text-xs"
            >
              <span className="truncate">{activity}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="mari-chrome-control mari-chrome-control--small min-w-0 shrink-0 px-1.5 py-1 max-md:h-9 max-md:min-h-9"
          title={localizeUi("ui.layout.userstatusfooter.changeActivityStatus")}
          aria-label={localizeUi("ui.layout.userstatusfooter.changeActivityStatus")}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${current.color}`} />
          <span className="mari-chrome-text max-w-20 truncate text-xs">{current.label}</span>
        </button>
        <input
          value={userActivity}
          onChange={(event) => setUserActivity(event.target.value)}
          onFocus={() => setActivityFocused(true)}
          onBlur={() => {
            commitCurrentActivity();
            setActivityFocused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setActivityFocused(false);
              event.currentTarget.blur();
            }
          }}
          maxLength={120}
          placeholder={localizeUi("ui.layout.userstatusfooter.whatAreYouDoing")}
          aria-label={localizeUi("ui.layout.userstatusfooter.customActivity")}
          className="mari-chrome-field mari-chrome-field--compact min-w-0 flex-1 px-2 py-1 text-xs max-md:h-9 max-md:min-h-9"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            openActivityOverview();
          }}
          title={localizeUi("chatInsights.activity.open")}
          aria-label={localizeUi("chatInsights.activity.open")}
          className="mari-chrome-control mari-chrome-control--small ml-1 h-7 w-7 shrink-0 justify-center p-0! max-md:h-9 max-md:min-h-9 max-md:w-9"
        >
          <Activity className="shrink-0" size="1rem" strokeWidth={2.25} />
        </button>
        {showScheduleManager && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenScheduleManager();
            }}
            title={localizeUi("ui.layout.chatsidebar.characterScheduleManager")}
            aria-label={localizeUi("ui.layout.chatsidebar.characterScheduleManager")}
            className="mari-chrome-control mari-chrome-control--small ml-1 h-7 w-7 shrink-0 justify-center p-0! max-md:h-9 max-md:min-h-9 max-md:w-9"
          >
            <CalendarClock className="shrink-0" size="1rem" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Pinned from the phone row swipe; pinned chats lead the chat list. */
function isChatPinned(chat: Chat): boolean {
  return parseChatMetadata(chat.metadata).pinned === true;
}
