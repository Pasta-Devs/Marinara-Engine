// ──────────────────────────────────────────────
// Layout: Chat Sidebar (polished with rich buttons)
// ──────────────────────────────────────────────
import {
  MessageSquare,
  MessageSquareText,
  Search,
  Trash2,
  BookOpen,
  Theater,
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
  GripVertical,
  CheckSquare,
  Square as SquareIcon,
  ArrowUpDown,
  Tag,
} from "lucide-react";
import { useBulkExportChats, useChats, useCreateChat, useDeleteChat, useDeleteChatGroup } from "../../hooks/use-chats";
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
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { useUIStore, type UserStatus } from "../../stores/ui.store";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePresenceClock } from "../../hooks/use-presence-clock";
import { toast } from "sonner";
import {
  includesTextForMatch,
  normalizeTextForMatch,
  type Chat,
  type ChatFolder,
  type ChatMode,
  type ConversationPresenceStatus,
} from "@marinara-engine/shared";
import { resolveLiveConversationStatus } from "../../lib/conversation-presence-status";
import { Modal } from "../ui/Modal";
import { Reorder, useDragControls } from "framer-motion";
import { parseChatMetadata } from "../../lib/chat-display";
import { compareChatsByActivityAsc, compareChatsByActivityDesc } from "../../lib/chat-recency";
import { getCurrentGameGroupRepresentative } from "../../lib/game-session-resolution";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";

type ChatSortOption = "newest" | "oldest" | "name-asc" | "name-desc";
const CHAT_LIST_PAGE_SIZE = 100;

const CONVERSATION_STATUS_PRIORITY: Record<ConversationPresenceStatus, number> = {
  online: 0,
  idle: 1,
  offline: 2,
  dnd: 3,
};

const CONVERSATION_STATUS_DOT_CLASS: Record<ConversationPresenceStatus, string> = {
  online: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-400",
  dnd: "bg-red-500",
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
  const chatCharStatuses = convoMeta?.conversationCharacterStatuses as
    | Record<string, { status?: unknown }>
    | undefined;
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
        live?.status ?? asConversationStatus(snapshot?.status) ?? asConversationStatus(base.conversationStatus) ?? "online",
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
    icon: <MessageSquare size="0.875rem" />,
    label: "Conversation",
    shortLabel: "CONVO",
    description: "A straightforward AI conversation — no roleplay elements.",
    logoModeClass: "mari-chat-logo-mode--conversation",
  },
  roleplay: {
    icon: <BookOpen size="0.875rem" />,
    label: "Roleplay",
    shortLabel: "RP",
    description: "Immersive roleplay with characters, game state tracking, and world simulation.",
    logoModeClass: "mari-chat-logo-mode--roleplay",
  },
  visual_novel: {
    icon: <Theater size="0.875rem" />,
    label: "Visual Novel",
    shortLabel: "VN",
    description: "A full game experience with backgrounds, sprites, text boxes, and choices.",
    logoModeClass: "mari-chat-logo-mode--game",
    comingSoon: true,
  },
  game: {
    icon: <Theater size="0.875rem" />,
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
  const { data: chats, isError: chatsError, isLoading, isFetching, refetch: refetchChats } = useChats();
  const { data: connections } = useConnections();
  const createChat = useCreateChat();
  const { data: chatPresetsData } = useChatPresets();
  const applyChatPreset = useApplyChatPreset();
  const deleteChat = useDeleteChat();
  const deleteChatGroup = useDeleteChatGroup();
  const bulkExportChats = useBulkExportChats();
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const hydrateUnread = useChatStore((s) => s.hydrateUnread);
  // One interval for the whole list: a 60s-cadence clock so schedule/override-derived
  // status dots refresh when time alone changes them, without per-row timers.
  const presenceNow = usePresenceClock();
  const hasAnyDetailOpen = useUIStore((s) => s.hasAnyDetailOpen);
  const editorDirty = useUIStore((s) => s.editorDirty);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const chatModeShortcutRequest = useUIStore((s) => s.chatModeShortcutRequest);
  const setPendingNewChatMode = useChatStore((s) => s.setPendingNewChatMode);

  // Folder hooks
  const { data: folders } = useChatFolders();
  const createFolderMut = useCreateFolder();
  const updateFolderMut = useUpdateFolder();
  const deleteFolderMut = useDeleteFolder();
  const reorderFoldersMut = useReorderFolders();
  const moveChatMut = useMoveChat();

  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<ChatSortOption>("newest");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"conversation" | "roleplay" | "game">("conversation");
  const [visibleChatLimit, setVisibleChatLimit] = useState(CHAT_LIST_PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<{
    chatId: string;
    groupId: string | null;
    branchCount: number;
  } | null>(null);

  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [isRootDropTarget, setIsRootDropTarget] = useState(false);
  const chatImportInputRef = useRef<HTMLInputElement>(null);
  const touchDragRef = useRef<{
    chatId: string;
    timer: number | null;
    active: boolean;
    lastX: number;
    lastY: number;
  } | null>(null);
  const suppressTouchDragClickRef = useRef(false);

  // Multi-select state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
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
    setActiveTag(null);
    setTagsExpanded(false);
    exitMultiSelect();
  }, [chatModeShortcutRequest, exitMultiSelect]);

  // Exit multi-select when switching tabs
  useEffect(() => {
    exitMultiSelect();
    setActiveTag(null);
    setTagsExpanded(false);
  }, [activeTab, exitMultiSelect]);

  useEffect(() => {
    setVisibleChatLimit(CHAT_LIST_PAGE_SIZE);
  }, [activeTab, searchQuery, activeTag, sort]);

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
        avatarCrop?: AvatarCropValue | null;
        conversationStatus?: string;
      }
    >();
    if (!characterSummaries) return map;
    for (const character of characterSummaries) {
      map.set(character.id, {
        name: character.name,
        avatarUrl: character.avatarUrl,
        avatarCrop: (character.avatarCrop as AvatarCropValue | undefined) ?? null,
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

  useEffect(() => {
    if (activeTag && !allTags.includes(activeTag)) {
      setActiveTag(null);
    }
  }, [activeTag, allTags]);

  const filtered = useMemo(() => {
    const query = normalizeTextForMatch(searchQuery);

    return modeChats.filter((chat) => {
      const tags = getChatTags(chat);
      if (activeTag && !tags.includes(activeTag)) return false;
      if (!query) return true;

      const characterNames = normalizeChatCharacterIds((chat as { characterIds?: unknown }).characterIds)
        .map((characterId) => charLookup.get(characterId)?.name ?? "")
        .filter(Boolean);

      return (
        includesTextForMatch(toSearchText(chat.name), query) ||
        tags.some((tag) => includesTextForMatch(tag, query)) ||
        characterNames.some((name) => includesTextForMatch(name, query))
      );
    });
  }, [modeChats, searchQuery, activeTag, charLookup]);

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
          return compareChatsByActivityAsc(a, b);
        case "name-asc":
          return toSearchText(a.name).localeCompare(toSearchText(b.name));
        case "name-desc":
          return toSearchText(b.name).localeCompare(toSearchText(a.name));
        case "newest":
        default:
          return compareChatsByActivityDesc(a, b);
      }
    });

    const seenGroups = new Set<string>();
    const result: { chat: (typeof sorted)[number]; branchCount: number }[] = [];

    for (const chat of sorted) {
      if (chat.groupId) {
        if (seenGroups.has(chat.groupId)) continue;
        seenGroups.add(chat.groupId);
        result.push({
          chat: getCurrentGameGroupRepresentative(chat, chats ?? filtered),
          branchCount: totalGroupSizes.get(chat.groupId) ?? 1,
        });
      } else {
        result.push({ chat, branchCount: 1 });
      }
    }

    return result;
  }, [chats, filtered, sort]);

  // Detect if active chat belongs to a group so its group row highlights and stays mounted.
  const activeChat = chats?.find((c) => c.id === activeChatId);
  const activeGroupId = activeChat?.groupId ?? null;
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
    if (!folders) return [] as ChatFolder[];
    return folders.filter((f) => f.mode === activeTab).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders, activeTab]);

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
  const chatListFilterActive = searchQuery.trim().length > 0 || activeTag !== null;

  const [localFolderOrder, setLocalFolderOrder] = useState<string[]>([]);
  useEffect(() => {
    if (!folders) return;
    setLocalFolderOrder(modeFolders.map((f) => f.id));
  }, [folders, modeFolders]);

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
  const syncRef = useRef<{ chatId: string | null; tabSynced: boolean; folderSynced: boolean }>({
    chatId: null,
    tabSynced: false,
    folderSynced: false,
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
    let needsScroll = false;

    if (isNewChat) {
      s.chatId = activeChatId;
      s.tabSynced = false;
      s.folderSynced = false;
    }

    // 1. Tab sync — once per chat switch
    if (!s.tabSynced) {
      const chatMode = chat.mode as "conversation" | "roleplay" | "game";
      if (chatMode === "conversation" || chatMode === "roleplay" || chatMode === "game") {
        setActiveTab(chatMode);
      }
      // Clear search so the active chat isn't hidden by a stale filter.
      // Skip when the navigation originated from a sidebar click (the
      // user is actively browsing search results and shouldn't lose them).
      if (!internalNavRef.current) {
        setSearchQuery("");
        setActiveTag(null);
        setTagsExpanded(false);
      }
      internalNavRef.current = false;
      s.tabSynced = true;
      needsScroll = true;
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
          updateFolderMut.mutate({ id: folder.id, collapsed: false });
          // folderSynced stays false — re-runs after query invalidation
        } else {
          s.folderSynced = true;
          needsScroll = true;
        }
      }
      // else: folders not loaded yet — effect re-runs when they arrive
    }

    // 3. Scroll active chat row into view once both tab + folder are settled
    if (needsScroll && s.tabSynced && s.folderSynced) {
      const timer = setTimeout(() => {
        const el = document.querySelector(`[data-chat-id="${activeChatId}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeChatId, chats, folders, updateFolderMut]);

  const handleNewChat = useCallback(
    (mode: ChatMode) => {
      if (createChat.isPending) return;
      const connectionRows = ((connections ?? []) as Array<{ id: string }>).filter((connection) => !!connection.id);
      if (connectionRows.length === 0) {
        if (mode !== "visual_novel") {
          setPendingNewChatMode(mode);
        }
        if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
        return;
      }

      // Close any open detail editors so the chat area is visible
      if (hasAnyDetailOpen()) {
        closeAllDetails();
      }
      // Resolve the user's starred default preset for this mode (only modes with presets).
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
        },
        {
          onSuccess: (chat) => {
            setActiveChatId(chat.id);
            if (typeof window !== "undefined" && window.innerWidth < 768) setSidebarOpen(false);
            useChatStore.getState().setShouldOpenSettings(true);
            useChatStore.getState().setShouldOpenWizard(true);
            if (starred) {
              void applyChatPreset.mutateAsync({ presetId: starred.id, chatId: chat.id }).catch(() => {
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
        const res = await fetch("/api/import/st-chat", { method: "POST", body: formData });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          chatId?: string;
          error?: string;
          messagesImported?: number;
        };
        if (!res.ok || data.success === false || data.error) {
          toast.error(`Import failed: ${data.error ?? res.statusText ?? "Unknown error"}`);
          return;
        }

        toast.success(`Imported ${data.messagesImported ?? 0} messages`);
        await refetchChats();
        if (data.chatId) setActiveChatId(data.chatId);
      } catch (error) {
        toast.error(error instanceof Error ? `Import failed: ${error.message}` : "Import failed.");
      } finally {
        setIsImportingChat(false);
      }
    },
    [activeTab, refetchChats, setActiveChatId],
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
      setLocalFolderOrder(newOrder);
      reorderFoldersMut.mutate(newOrder);
    },
    [reorderFoldersMut],
  );

  const getDragChatIds = useCallback(
    (chatId: string) => (multiSelectMode && selectedChatIds.has(chatId) ? Array.from(selectedChatIds) : [chatId]),
    [multiSelectMode, selectedChatIds],
  );

  const handleDropChatsToFolder = useCallback(
    (chatIds: string[], folderId: string | null) => {
      const uniqueIds = Array.from(new Set(chatIds.filter(Boolean)));
      for (const chatId of uniqueIds) {
        moveChatMut.mutate({ chatId, folderId });
      }
      setDraggedChatId(null);
      setIsRootDropTarget(false);
    },
    [moveChatMut],
  );

  const startTouchDrag = useCallback((chatId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    const drag = {
      chatId,
      timer: null as number | null,
      active: false,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    drag.timer = window.setTimeout(() => {
      drag.active = true;
      setDraggedChatId(chatId);
    }, 420);
    touchDragRef.current = drag;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const updateTouchDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = touchDragRef.current;
    if (!drag) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (drag.active) event.preventDefault();
  }, []);

  const finishTouchDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = touchDragRef.current;
      if (!drag) return;
      if (drag.timer !== null) {
        window.clearTimeout(drag.timer);
      }
      touchDragRef.current = null;

      if (drag.active) {
        const target = document.elementFromPoint(drag.lastX, drag.lastY);
        const folderEl = target?.closest<HTMLElement>("[data-chat-folder-id]");
        const rootEl = target?.closest<HTMLElement>("[data-chat-root-drop-zone]");
        const folderId = folderEl?.dataset.chatFolderId ?? null;
        if (folderId) {
          handleDropChatsToFolder(getDragChatIds(drag.chatId), folderId);
        } else if (rootEl) {
          handleDropChatsToFolder(getDragChatIds(drag.chatId), null);
        }
        setDraggedChatId(null);
        setIsRootDropTarget(false);
        suppressTouchDragClickRef.current = true;
        event.preventDefault();
      }
    },
    [getDragChatIds, handleDropChatsToFolder],
  );

  // ── Batch actions ──
  const handleBatchDelete = useCallback(async () => {
    if (selectedChatIds.size === 0) return;
    if (
      !(await showConfirmDialog({
        title: "Delete Chats",
        message: `Delete ${selectedChatIds.size} chat${selectedChatIds.size > 1 ? "s" : ""}?`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }
    for (const id of selectedChatIds) {
      deleteChat.mutate({ id, force: true });
    }
    if (activeChatId && selectedChatIds.has(activeChatId)) setActiveChatId(null);
    exitMultiSelect();
  }, [selectedChatIds, deleteChat, activeChatId, setActiveChatId, exitMultiSelect]);

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
      toast.error(err instanceof Error ? `Export failed: ${err.message}` : "Export failed");
    }
  }, [selectedChatIds, bulkExportChats, exitMultiSelect]);

  // ── Chat row renderer (shared between unfiled + folder sections) ──
  const renderChatRow = ({ chat, branchCount }: (typeof displayChats)[number]) => {
    const cfg = MODE_CONFIG[chat.mode] ?? MODE_CONFIG.conversation;
    const isActive = activeChatId === chat.id || (chat.groupId != null && chat.groupId === activeGroupId);
    const isSelected = selectedChatIds.has(chat.id);
    const charIds = normalizeChatCharacterIds((chat as { characterIds?: unknown }).characterIds);
    const conversationStatusByCharacter = getConversationPresenceState(
      chat.mode,
      chat.metadata,
      charIds,
      charLookup,
      presenceNow,
    );
    return (
      <div
        role="button"
        tabIndex={0}
        key={chat.groupId ?? chat.id}
        data-chat-id={chat.id}
        draggable
        onDragStart={(event) => {
          const chatIds = getDragChatIds(chat.id);
          setDraggedChatId(chat.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-marinara-chat-ids", JSON.stringify(chatIds));
          event.dataTransfer.setData("application/x-marinara-chat-id", chat.id);
          event.dataTransfer.setData("text/plain", chat.id);
        }}
        onDragEnd={() => {
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
          if (hasAnyDetailOpen()) {
            if (editorDirty) {
              if (
                !(await showConfirmDialog({
                  title: "Unsaved Changes",
                  message: "You have unsaved changes. Discard and continue?",
                  confirmLabel: "Discard",
                  tone: "destructive",
                }))
              ) {
                return;
              }
            }
            closeAllDetails();
          }
          internalNavRef.current = true;
          setActiveChatId(chat.id);
          if (window.innerWidth < 768) setSidebarOpen(false);
        }}
        className={cn(
          "group relative flex w-full touch-pan-y items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
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
        <button
          type="button"
          aria-label="Drag chat"
          title="Drag chat"
          className="mari-chrome-accent-text-muted mari-accent-animated flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing active:scale-95 md:h-7 md:w-5 md:opacity-0 md:group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            event.stopPropagation();
            startTouchDrag(chat.id, event);
          }}
          onPointerMove={updateTouchDrag}
          onPointerUp={finishTouchDrag}
          onPointerCancel={finishTouchDrag}
        >
          <GripVertical size="0.8125rem" />
        </button>

        {/* Active indicator */}
        {isActive && (
          <span className="mari-chrome-accent-progress mari-accent-animated absolute -left-0.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full" />
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
              avatarCrop?: AvatarCropValue | null;
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
            const multiAvatarStatus = avatars.reduce<ConversationPresenceStatus | undefined>((worstStatus, avatar) => {
              const nextStatus = asConversationStatus(avatar.conversationStatus) ?? "online";
              if (!worstStatus) return nextStatus;
              return CONVERSATION_STATUS_PRIORITY[nextStatus] > CONVERSATION_STATUS_PRIORITY[worstStatus]
                ? nextStatus
                : worstStatus;
            }, undefined);
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--secondary)] text-[0.625rem] font-bold text-[var(--muted-foreground)]">
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
            const count = unreadCounts.get(chat.id) || 0;
            if (count === 0 || isActive) return null;
            return (
              <span className="absolute -top-1 -right-1 z-20 flex h-4 min-w-4 items-center justify-center rounded-md bg-red-500 px-1 text-[0.5625rem] font-bold leading-none text-white shadow-sm ring-2 ring-[var(--sidebar-background)]">
                {count > 99 ? "99+" : count}
              </span>
            );
          })()}
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              isActive ? "mari-chrome-text-strong font-medium" : "mari-chrome-text",
            )}
          >
            {chat.name}
          </span>
        </div>

        {/* Branch count badge */}
        {branchCount > 1 && (
          <span className="mari-chrome-muted-badge flex shrink-0 items-center gap-0.5 px-1.5 py-0.5 text-[0.625rem]">
            <GitBranch size="0.625rem" />
            {branchCount}
          </span>
        )}

        {/* Delete button */}
        {!multiSelectMode && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (branchCount > 1 && chat.groupId) {
                setDeleteTarget({ chatId: chat.id, groupId: chat.groupId, branchCount });
              } else {
                if (
                  await showConfirmDialog({
                    title: "Delete Chat",
                    message: "Delete this chat?",
                    confirmLabel: "Delete",
                    tone: "destructive",
                  })
                ) {
                  deleteChat.mutate({ id: chat.id, force: true });
                  if (activeChatId === chat.id) setActiveChatId(null);
                }
              }
            }}
            className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-0 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] group-hover:opacity-100 max-md:opacity-100"
          >
            <Trash2 size="0.75rem" />
          </button>
        )}
      </div>
    );
  };

  return (
    <nav
      data-component="ChatSidebar"
      aria-label="Chat navigation"
      className="mari-chat-sidebar mari-chrome-token-scope flex h-full flex-col"
    >
      {/* Header */}
      <div className="mari-sidebar-header relative flex h-12 items-center justify-between bg-[var(--card)]/80 px-4 backdrop-blur-sm">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
        <div className="flex items-center gap-2.5">
          <ChatSidebarTitleIcon />
          <h2 className="mari-chrome-text-strong text-sm font-semibold">Chats</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarOpen(false)}
            className="mari-chrome-control mari-chrome-control--small mari-accent-animated p-1.5 active:scale-90 md:hidden"
            title="Close"
            aria-label="Close chats"
          >
            <X size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 pt-3">
        <div className="mari-chrome-segmented">
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
                  {cfg.shortLabel}
                </span>
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

      <div className="flex gap-2 px-3 pt-2">
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
          )}
          title={`New ${activeModeConfig.label}`}
          aria-label={`New ${activeModeConfig.label}`}
        >
          <Plus size="0.8125rem" className="mari-chrome-accent-icon mari-accent-animated" />
        </button>
        <button
          onClick={() => chatImportInputRef.current?.click()}
          disabled={isImportingChat}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          title={isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL"}
          aria-label={isImportingChat ? "Importing chat" : "Import SillyTavern or Marinara chat JSONL"}
        >
          <Download size="0.8125rem" />
        </button>
        <button
          onClick={() => (multiSelectMode ? exitMultiSelect() : setMultiSelectMode(true))}
          disabled={displayChats.length === 0}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            multiSelectMode && "mari-chrome-control--selected",
          )}
          title={multiSelectMode ? "Cancel selection" : "Select chats"}
          aria-label={multiSelectMode ? "Cancel selection" : "Select chats"}
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="space-y-1.5 px-3 py-2">
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search
              size="0.8125rem"
              className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={`Search ${activeTab === "conversation" ? "conversations" : activeTab === "game" ? "games" : "roleplays"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ChatSortOption)}
              className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 w-[6.5rem] appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
              title="Sort chats"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
            </select>
            <ArrowUpDown
              size="0.625rem"
              className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex max-w-full flex-wrap items-center gap-1">
            <button
              onClick={() => setTagsExpanded((prev) => !prev)}
              className={cn(
                "flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-[0.625rem] transition-colors",
                activeTag
                  ? "mari-chrome-accent-surface mari-accent-animated"
                  : "mari-chrome-text-muted hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
              )}
              title={tagsExpanded ? "Collapse tags" : "Expand tags"}
            >
              <Tag size="0.6875rem" className="shrink-0" />
              <span className="max-w-full truncate">
                {activeTag ? `Tag: ${activeTag}` : `Tags (${allTags.length})`}
              </span>
              {tagsExpanded ? (
                <ChevronUp size="0.625rem" className="shrink-0" />
              ) : (
                <ChevronDown size="0.625rem" className="shrink-0" />
              )}
            </button>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="mari-chrome-control mari-chrome-control--compact mari-chrome-control--danger"
              >
                Clear
              </button>
            )}
            {(tagsExpanded ? allTags : allTags.slice(0, 4)).map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
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
                +{allTags.length - 4} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat list */}
      <div
        data-chat-root-drop-zone
        className={cn(
          "flex-1 overflow-y-auto px-2 pb-1 pt-0 transition-colors",
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
        {isLoading && (
          <div className="flex flex-col gap-2 px-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-10 rounded-lg" />
            ))}
          </div>
        )}

        {chatsError && !isLoading && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--destructive)]/10">
              <AlertTriangle size="1.25rem" className="text-[var(--destructive)]" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Marinara is still waking up. Chats should appear in a moment.
            </p>
            <button
              onClick={() => void refetchChats()}
              disabled={isFetching}
              className="mari-chrome-control mari-chrome-control--compact mt-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isFetching ? "Checking..." : "Try Again"}
            </button>
          </div>
        )}

        {displayChats.length === 0 && !isLoading && !chatsError && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <div className="mari-chrome-accent-soft-tile mari-accent-animated animate-float flex h-12 w-12 items-center justify-center rounded-2xl">
              {activeTab === "conversation" ? (
                <MessageSquare size="1.25rem" />
              ) : activeTab === "game" ? (
                <Theater size="1.25rem" />
              ) : (
                <BookOpen size="1.25rem" />
              )}
            </div>
            <p className="mari-chrome-text-muted text-xs">
              {searchQuery.trim() || activeTag
                ? `No ${activeTab === "conversation" ? "conversations" : activeTab === "game" ? "games" : "roleplays"} match the current filters`
                : `No ${activeTab === "conversation" ? "conversations" : activeTab === "game" ? "games" : "roleplays"} yet`}
            </p>
            <button
              onClick={handleNewChatFromTab}
              disabled={createChat.isPending}
              className={cn(
                "mari-chrome-control mari-chrome-control--compact mari-chat-mode-action mt-1",
                activeModeConfig.logoModeClass,
              )}
            >
              <span className="mari-chrome-accent-icon mari-accent-animated">+</span>
              New {activeTab === "conversation" ? "Conversation" : activeTab === "game" ? "Game" : "Roleplay"}
            </button>
          </div>
        )}

        <div className="stagger-children flex flex-col gap-0.5 px-1">
          {activeModeHasChats && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCreateFolder}
                className="mari-chrome-control mari-chrome-control--small flex-1 justify-center text-[0.6875rem]"
              >
                <FolderPlus size="0.75rem" />
                New Folder
              </button>
            </div>
          )}

          {modeFolders.length > 0 && activeModeHasChats && (
            <p className="mari-folder-helper">Drag and drop chats to folders, double-click or double-tap to rename</p>
          )}

          {/* Folders (drag-to-reorder) */}
          {localFolderOrder.length > 0 && (
            <Reorder.Group
              axis="y"
              values={localFolderOrder}
              onReorder={handleFolderReorder}
              as="div"
              className="flex flex-col gap-0.5 mt-1"
            >
              {localFolderOrder.map((folderId) => {
                const folder = modeFolders.find((f) => f.id === folderId);
                if (!folder) return null;
                const folderEntries = folderChatsMap.get(folderId) ?? [];
                const folderChatCount = folderChatCounts.get(folderId) ?? folderEntries.length;
                if (chatListFilterActive && folderEntries.length === 0) return null;
                return (
                  <FolderRow
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
              Load more ({visibleDisplayChats.length} loaded)
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
          exporting={bulkExportChats.isPending}
          className="static mx-0"
        />
      )}

      {/* ── User Status Selector ── */}
      <UserStatusFooter />

      {/* ── Delete Branch Modal ── */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete Chat" width="max-w-sm">
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--destructive)]/10">
                <AlertTriangle size="1.125rem" className="text-[var(--destructive)]" />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                This conversation has{" "}
                <strong className="text-[var(--foreground)]">{deleteTarget.branchCount} branches</strong>. What would
                you like to delete?
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
                Delete This Branch Only
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
                Delete All {deleteTarget.branchCount} Branches
              </button>
            </div>
          </div>
        )}
      </Modal>
    </nav>
  );
}

// ── FolderRow (self-contained state for menu/rename) ──
function FolderRow({
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
  const dragControls = useDragControls();
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
      value={folder.id}
      layout="position"
      data-chat-folder-id={folder.id}
      dragListener={false}
      dragControls={dragControls}
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
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="cursor-grab touch-none opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 max-md:opacity-100"
        >
          <GripVertical size="0.625rem" className="mari-chrome-accent-icon mari-accent-animated" />
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}. Double-tap or press F2 to rename.`}
          title="Double-click, double-tap, or press F2 to rename."
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
    color: "bg-green-500",
    icon: <Circle size="0.625rem" className="fill-green-500 text-green-500" />,
  },
  {
    value: "idle",
    label: "Idle",
    description: "Automatic when you're away",
    color: "bg-yellow-500",
    icon: <Moon size="0.625rem" className="text-yellow-500" />,
  },
  {
    value: "dnd",
    label: "Do Not Disturb",
    description: "Suppress auto messages",
    color: "bg-red-500",
    icon: <MinusCircle size="0.625rem" className="text-red-500" />,
  },
  {
    value: "invisible",
    label: "Invisible",
    description: "Hide your status from models",
    color: "bg-gray-400",
    icon: <Circle size="0.625rem" className="fill-gray-400 text-gray-400" />,
  },
];

function UserStatusFooter() {
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
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    <div ref={ref} className="relative border-t border-[var(--border)]/30 px-3 py-2">
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
            Recent status
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
          className="mari-chrome-control mari-chrome-control--small min-w-0 shrink-0 px-2 py-1.5 max-md:h-9 max-md:min-h-9"
          title="Change activity status"
          aria-label="Change activity status"
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
              setActivityFocused(false);
              event.currentTarget.blur();
            }
          }}
          maxLength={120}
          placeholder="What are you doing?"
          aria-label="Custom activity"
          className="mari-chrome-field mari-chrome-field--compact min-w-0 flex-1 px-2 py-1.5 text-xs max-md:h-9 max-md:min-h-9"
        />
      </div>
    </div>
  );
}
