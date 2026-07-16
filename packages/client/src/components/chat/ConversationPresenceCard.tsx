import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronDown, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ConversationPresenceStatus, ConversationStatusOverride, WeekSchedule } from "@marinara-engine/shared";
import type { Message } from "@marinara-engine/shared";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { characterKeys } from "../../hooks/use-characters";
import { useGenerate } from "../../hooks/use-generate";
import { api } from "../../lib/api-client";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { isDesktopShellNavigationTarget } from "../../lib/chat-floating-ui-events";
import type { CharacterMap } from "./chat-area.types";
import {
  CHAT_TOOLBAR_IDENTITY_PILL_SIZE_CLASS,
  announceChatToolbarAction,
  getChatToolbarButtonClass,
} from "./ChatToolbarControls";
import {
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_SUBTITLE,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import { ConversationPresenceScheduleSection } from "./ConversationPresenceScheduleSection";

type StatusEntry = {
  status: ConversationPresenceStatus;
  activity: string;
  schedule?: WeekSchedule;
  override?: ConversationStatusOverride;
  lastContact?: string;
};

type StatusResponse = {
  statuses: Record<string, StatusEntry>;
  needsRefresh?: boolean;
};

type OpenSettingsOptions = { initialSection?: "autonomous" | null };

type ConversationPresenceCardProps = {
  chatId: string;
  chatMeta: Record<string, any>;
  chatCharIds: string[];
  characterMap: CharacterMap;
  messages?: Message[];
  onOpenSettings: (event?: ReactMouseEvent<HTMLElement>, options?: OpenSettingsOptions) => void;
  onOpenScheduleEditor?: (characterId: string, options?: { initialDay?: string | null }) => void;
};

const STATUS_OPTIONS: Array<{ status: ConversationPresenceStatus; label: string }> = [
  { status: "online", label: "Online" },
  { status: "idle", label: "Away" },
  { status: "dnd", label: "Busy" },
  { status: "offline", label: "Offline" },
];

function statusDotClass(status?: string) {
  return status === "offline"
    ? "bg-gray-400"
    : status === "dnd"
      ? "bg-red-500"
      : status === "idle"
        ? "bg-yellow-500"
        : "bg-green-500";
}

function statusLabel(status?: string) {
  return status === "offline" ? "Offline" : status === "dnd" ? "Busy" : status === "idle" ? "Away" : "Online";
}

function asStatus(value: unknown): ConversationPresenceStatus {
  return value === "idle" || value === "dnd" || value === "offline" ? value : "online";
}

function asOverride(value: unknown): ConversationStatusOverride | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const status = asStatus(raw.status);
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();
  const expiresAt = typeof raw.expiresAt === "string" || raw.expiresAt === null ? raw.expiresAt : null;
  const activity = typeof raw.activity === "string" || raw.activity === null ? raw.activity : undefined;
  return { status, activity, createdAt, expiresAt };
}

function parseOverrides(raw: unknown): Record<string, ConversationStatusOverride> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const overrides: Record<string, ConversationStatusOverride> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const override = asOverride(value);
    if (override) overrides[id] = override;
  }
  return overrides;
}

function parseSchedules(raw: unknown): Record<string, WeekSchedule> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const schedules: Record<string, WeekSchedule> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value)) schedules[id] = value as WeekSchedule;
  }
  return schedules;
}

function buildOverrides(
  existing: Record<string, ConversationStatusOverride>,
  characterId: string,
  override: ConversationStatusOverride | null,
): Record<string, ConversationStatusOverride | null> {
  const next: Record<string, ConversationStatusOverride | null> = { ...existing };
  // Null signals deletion to the server merge; the server strips these tombstones.
  next[characterId] = override;
  return next;
}

function formatRelativeContact(isoTimestamp: string, now = Date.now()) {
  const timestamp = new Date(isoTimestamp).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const diffMs = now - timestamp;
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function resizeActivityField(field: HTMLTextAreaElement | null) {
  if (!field) return;
  field.style.height = "0px";
  field.style.height = `${Math.min(field.scrollHeight, 112)}px`;
}

export function ConversationPresenceCard({
  chatId,
  chatMeta,
  chatCharIds,
  characterMap,
  messages,
  onOpenSettings,
  onOpenScheduleEditor,
}: ConversationPresenceCardProps) {
  const [open, setOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [statusMenuCharacterId, setStatusMenuCharacterId] = useState<string | null>(null);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, ConversationPresenceStatus>>({});
  const [replyNowCharacterId, setReplyNowCharacterId] = useState<string | null>(null);
  const [draftActivity, setDraftActivity] = useState("");
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const statusButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activityFieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const statusMenuRef = useRef<HTMLDivElement | null>(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 180,
  });
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });
  const queryClient = useQueryClient();
  const updateMeta = useUpdateChatMetadata();
  const { generate } = useGenerate();
  const activeAbortController = useChatStore((s) => s.abortControllers.get(chatId) ?? null);
  const delayedInfo = useChatStore((s) => s.perChatDelayed.get(chatId) ?? null);
  const openCharacterDetail = useUIStore((s) => s.openCharacterDetail);
  const setAbortController = useChatStore((s) => s.setAbortController);
  const setDelayedCharacterInfo = useChatStore((s) => s.setDelayedCharacterInfo);
  const setPerChatDelayed = useChatStore((s) => s.setPerChatDelayed);
  const overrides = useMemo(
    () => parseOverrides(chatMeta.conversationStatusOverrides),
    [chatMeta.conversationStatusOverrides],
  );
  const schedules = useMemo(() => parseSchedules(chatMeta.characterSchedules), [chatMeta.characterSchedules]);
  const schedulesEnabled =
    chatMeta.conversationSchedulesEnabled === true ||
    (chatMeta.conversationSchedulesEnabled == null && Object.keys(schedules).length > 0);
  const statusesQuery = useQuery({
    queryKey: ["conversation-status", chatId],
    queryFn: async ({ signal }) => api.get<StatusResponse>(`/conversation/status/${chatId}`, { signal }),
    enabled: !!chatId && chatCharIds.length > 0,
    refetchInterval: () => (document.hidden ? false : 60_000),
  });
  const statusInvalidationSignature = useMemo(() => {
    const statuses = statusesQuery.data?.statuses;
    if (!statuses) return null;
    return Object.keys(statuses)
      .sort()
      .map((id) => {
        const entry = statuses[id];
        return `${id}:${entry?.status ?? ""}:${entry?.activity ?? ""}`;
      })
      .join("|");
  }, [statusesQuery.data?.statuses]);
  const lastStatusInvalidationSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!statusInvalidationSignature) {
      lastStatusInvalidationSignatureRef.current = null;
      return;
    }
    if (lastStatusInvalidationSignatureRef.current === statusInvalidationSignature) return;
    lastStatusInvalidationSignatureRef.current = statusInvalidationSignature;
    queryClient.invalidateQueries({ queryKey: characterKeys.list() });
  }, [queryClient, statusInvalidationSignature]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const isMobile = window.innerWidth < 768;
    const width = isMobile ? Math.min(360, window.innerWidth - viewportPadding * 2) : 360;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    setPosition({
      top: rect.bottom + (isMobile ? 0 : 8),
      left: Math.max(viewportPadding, Math.min(rect.left, maxLeft)),
      width,
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!statusMenuCharacterId) return;

    const updateMenuPosition = () => {
      const button = statusButtonRefs.current[statusMenuCharacterId];
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(180, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
      );
      const top = rect.bottom + 6;
      setStatusMenuPosition({ top, left, width });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [statusMenuCharacterId]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (isDesktopShellNavigationTarget(event.target)) return;
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target) ||
        statusMenuRef.current?.contains(target) ||
        (target instanceof HTMLElement && target.closest('[data-component="Modal"]'))
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (statusMenuCharacterId) {
        setStatusMenuCharacterId(null);
        return;
      }
      if (editingCharacterId) {
        setEditingCharacterId(null);
        setDraftActivity("");
        return;
      }
      setOpen(false);
    };
    const handleResize = () => setOpen(false);
    const handleScroll = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [draftActivity, editingCharacterId, open, statusMenuCharacterId]);

  useEffect(() => {
    if (!statusMenuCharacterId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (statusButtonRefs.current[statusMenuCharacterId]?.contains(target) || statusMenuRef.current?.contains(target))
        return;
      setStatusMenuCharacterId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [statusMenuCharacterId]);

  useLayoutEffect(() => {
    for (const field of Object.values(activityFieldRefs.current)) resizeActivityField(field);
  }, [draftActivity, editingCharacterId, open]);

  const characters = useMemo(
    () =>
      chatCharIds
        .map((id) => {
          const character = characterMap.get(id);
          if (!character) return null;
          const statusEntry = statusesQuery.data?.statuses[id];
          const status = pendingStatuses[id] ?? statusEntry?.status ?? character.conversationStatus ?? "online";
          const activity = statusEntry?.activity ?? character.conversationActivity ?? "";
          return {
            id,
            ...character,
            status,
            activity,
            schedule: statusEntry?.schedule ?? schedules[id],
            override: overrides[id],
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null),
    [characterMap, chatCharIds, overrides, pendingStatuses, schedules, statusesQuery.data?.statuses],
  );
  const hasGeneratedSchedules = characters.some((character) => !!character.schedule);
  const lastContactByCharacterId = useMemo(() => {
    const latestByCharacterId: Record<string, string> = {};

    for (const message of messages ?? []) {
      if (!message.characterId) continue;
      const currentLatest = latestByCharacterId[message.characterId];
      if (!currentLatest || new Date(message.createdAt).getTime() > new Date(currentLatest).getTime()) {
        latestByCharacterId[message.characterId] = message.createdAt;
      }
    }

    return latestByCharacterId;
  }, [messages]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshStatuses = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (statusesQuery.data?.needsRefresh) {
        await api.post("/conversation/schedule/generate", {
          chatId,
          characterIds: chatCharIds,
          scheduleGenerationPreferences: useUIStore.getState().scheduleGenerationPreferences,
          timeZone: useUIStore.getState().conversationTimeZone,
        });
        await queryClient.refetchQueries({ queryKey: ["chat", chatId] });
      }
      await statusesQuery.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (characters.length === 0) return <div />;

  const identityPillClass = getChatToolbarButtonClass({
    compact: true,
    open,
    sizeClassName: CHAT_TOOLBAR_IDENTITY_PILL_SIZE_CLASS,
    className:
      "min-w-[8.5rem] max-w-[min(20rem,calc(100vw-8rem))] justify-start gap-2 px-2.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]/90 max-md:min-w-[7.5rem] max-md:max-w-[calc(100vw-5.75rem)]",
  });
  const avatarShellClass =
    "relative block h-5 w-5 overflow-hidden rounded-full ring-1 ring-[var(--border)]/80 max-md:h-6 max-md:w-6";
  const avatarFallbackClass =
    "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)]/10 text-[0.5rem] font-bold text-[var(--foreground)]/70 ring-1 ring-[var(--border)]/80 max-md:h-6 max-md:w-6 max-md:text-[0.5625rem]";
  const title = characters.map((c) => `${c.name}: ${c.activity || statusLabel(c.status)}`).join(", ");

  const saveOverride = async (
    characterId: string,
    status: ConversationPresenceStatus,
    activity?: string | null,
  ): Promise<boolean> => {
    setPendingStatuses((current) => ({ ...current, [characterId]: status }));
    try {
      await updateMeta.mutateAsync({
        id: chatId,
        conversationStatusOverrides: buildOverrides(overrides, characterId, {
          status,
          activity: typeof activity === "string" ? activity : null,
          createdAt: new Date().toISOString(),
          expiresAt: null,
        }),
      });
      await statusesQuery.refetch();
      setPendingStatuses((current) => {
        const next = { ...current };
        delete next[characterId];
        return next;
      });
      return true;
    } catch (error) {
      setPendingStatuses((current) => {
        const next = { ...current };
        delete next[characterId];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "Failed to save presence override");
      return false;
    }
  };

  const clearOverride = async (characterId: string) => {
    setPendingStatuses((current) => {
      const next = { ...current };
      delete next[characterId];
      return next;
    });
    try {
      await updateMeta.mutateAsync({
        id: chatId,
        conversationStatusOverrides: buildOverrides(overrides, characterId, null),
      });
      void statusesQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear presence override");
    }
  };

  const replyNow = async (characterId: string) => {
    if (replyNowCharacterId || !delayedInfo?.characterIds?.includes(characterId)) return;
    setReplyNowCharacterId(characterId);
    try {
      activeAbortController?.abort();
      setAbortController(chatId, null);
      setPerChatDelayed(chatId, null);
      setDelayedCharacterInfo(null);
      await api.post("/generate/abort", { chatId }).catch(() => undefined);
      const produced = await generate({
        chatId,
        connectionId: null,
        forCharacterId: characterId,
        skipPresenceDelay: true,
      });
      if (!produced) toast.info("No reply was generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reply now");
    } finally {
      setReplyNowCharacterId(null);
    }
  };

  const beginEditing = (character: (typeof characters)[number]) => {
    setEditingCharacterId(character.id);
    setDraftActivity(character.override?.activity ?? character.activity ?? "");
  };

  const cancelEditing = () => {
    setEditingCharacterId(null);
    setDraftActivity("");
  };

  const saveActivityOverride = async (character: (typeof characters)[number]) => {
    const nextActivity = draftActivity.trim() || null;
    const currentActivity = character.override?.activity?.trim() || character.activity?.trim() || null;

    if (nextActivity === currentActivity) {
      setEditingCharacterId(null);
      setDraftActivity("");
      return;
    }

    if (await saveOverride(character.id, character.status, nextActivity)) {
      setEditingCharacterId(null);
      setDraftActivity("");
    }
  };

  const selectStatus = async (character: (typeof characters)[number], status: ConversationPresenceStatus) => {
    const nextActivity =
      editingCharacterId === character.id
        ? draftActivity.trim() || null
        : (character.override?.activity ?? character.activity ?? null);
    const currentActivity = character.override?.activity?.trim() || character.activity?.trim() || null;

    if (status === character.status && nextActivity === currentActivity) {
      setStatusMenuCharacterId(null);
      return;
    }

    if (await saveOverride(character.id, status, nextActivity)) {
      setStatusMenuCharacterId(null);
    }
  };

  const restoreSchedule = async (characterId: string) => {
    await clearOverride(characterId);
    if (editingCharacterId === characterId) cancelEditing();
    if (statusMenuCharacterId === characterId) setStatusMenuCharacterId(null);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={identityPillClass}
        title={title}
        onClick={() => {
          announceChatToolbarAction();
          setOpen((value) => !value);
        }}
      >
        {characters.length === 1 ? (
          <>
            <div className="relative flex-shrink-0">
              {characters[0].avatarUrl ? (
                <span className={avatarShellClass}>
                  <img
                    src={characters[0].avatarUrl}
                    alt={characters[0].name}
                    className="h-full w-full object-cover"
                    style={getAvatarCropStyle(characters[0].avatarCrop)}
                  />
                </span>
              ) : (
                <div className={avatarFallbackClass}>{characters[0].name[0]}</div>
              )}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-[1.5px] ring-[var(--card)]",
                  statusDotClass(characters[0].status),
                )}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight">
              <span className="truncate text-[0.75rem] font-semibold text-[var(--foreground)]/90">
                {characters[0].name}
              </span>
              <span className="block w-full truncate text-[0.5625rem] text-[var(--foreground)]/50">
                {characters[0].activity || statusLabel(characters[0].status)}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              className="relative flex-shrink-0"
              style={{ width: `${Math.min(characters.length, 3) * 12 + 8}px`, height: 20 }}
            >
              {characters.slice(0, 3).map((character, index) => (
                <div key={character.id} className="absolute top-0" style={{ left: index * 12 }}>
                  {character.avatarUrl ? (
                    <span className={avatarShellClass}>
                      <img
                        src={character.avatarUrl}
                        alt={character.name}
                        className="h-full w-full object-cover"
                        style={getAvatarCropStyle(character.avatarCrop)}
                      />
                    </span>
                  ) : (
                    <div className={avatarFallbackClass}>{character.name[0]}</div>
                  )}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-[1px] ring-[var(--card)]",
                      statusDotClass(character.status),
                    )}
                  />
                </div>
              ))}
            </div>
            <span className="min-w-0 truncate text-[0.75rem] font-semibold text-[var(--foreground)]/90">
              {characters.length <= 2
                ? characters.map((character) => character.name).join(" & ")
                : `${characters[0].name} + ${characters.length - 1}`}
            </span>
          </>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={cn(ROLEPLAY_POPOVER_SHELL, "fixed z-[9999] overflow-hidden")}
            style={{
              top: position.top,
              left: `max(calc(var(--mari-chat-ui-inset-left, 0px) + 0.75rem), min(${position.left}px, calc(100vw - var(--mari-chat-ui-inset-right, 0px) - ${position.width}px - 0.75rem)))`,
              width: position.width,
            }}
          >
            <div className={ROLEPLAY_POPOVER_HEADER}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={ROLEPLAY_POPOVER_TITLE}>
                    <CalendarClock size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                    Conversation Presence
                  </div>
                  <div className={ROLEPLAY_POPOVER_SUBTITLE}>
                    See who is following schedule and step in manually only when needed.
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Open autonomous settings"
                    onClick={() => {
                      setOpen(false);
                      onOpenSettings(undefined, { initialSection: "autonomous" });
                    }}
                  >
                    <Settings2 size="0.8125rem" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title="Refresh status"
                    onClick={() => void refreshStatuses()}
                  >
                    <RefreshCw
                      size="0.8125rem"
                      className={cn((statusesQuery.isFetching || isRefreshing) && "animate-spin")}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={cn(
                ROLEPLAY_POPOVER_SCROLL_AREA,
                "max-h-[min(28rem,calc(100vh-12rem))] space-y-2 overflow-y-auto p-2",
              )}
            >
              {characters.map((character) => {
                const activity = character.override?.activity ?? character.activity;
                const isManual = !!character.override;
                const isEditing = editingCharacterId === character.id;
                const primaryText = activity || statusLabel(character.status);
                const isStatusMenuOpen = statusMenuCharacterId === character.id;
                const lastContact =
                  statusesQuery.data?.statuses[character.id]?.lastContact ?? lastContactByCharacterId[character.id];
                const lastContactLabel = lastContact ? formatRelativeContact(lastContact) : null;
                const canReplyNow = !!activeAbortController && !!delayedInfo?.characterIds?.includes(character.id);
                const isReplyNowPending = replyNowCharacterId === character.id;

                return (
                  <div
                    key={character.id}
                    className={cn(
                      "rounded-xl bg-[var(--secondary)]/70 px-3 py-3 ring-1 ring-[var(--border)] transition-colors",
                      isEditing && "bg-[var(--accent)]/18",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-3">
                        {character.avatarUrl ? (
                          <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-[var(--border)]/80">
                            <img
                              src={character.avatarUrl}
                              alt={character.name}
                              className="h-full w-full object-cover"
                              style={getAvatarCropStyle(character.avatarCrop)}
                            />
                          </span>
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)] text-xs font-bold text-[var(--foreground)]/70 ring-1 ring-[var(--border)]/80">
                            {character.name[0]}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[var(--foreground)] transition-colors hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                              title={`Open ${character.name} profile`}
                              onClick={() => openCharacterDetail(character.id)}
                            >
                              {character.name}
                            </button>
                            {isManual && (
                              <span className="shrink-0 rounded-full bg-[var(--foreground)]/10 px-2 py-0.5 text-[0.625rem] font-medium text-[var(--foreground)]/75 ring-1 ring-[var(--border)]/70">
                                Override
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-[0.625rem] text-[var(--muted-foreground)]">
                              {isManual ? "Manual override" : "Following schedule"}
                            </span>
                            {lastContactLabel && (
                              <span className="text-[0.625rem] text-[var(--muted-foreground)]/90">
                                Last contact {lastContactLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs">
                        <div className="flex w-full min-w-0 items-stretch overflow-hidden rounded-md bg-[var(--background)] ring-1 ring-[var(--border)] transition-colors hover:ring-[var(--border)]/80 focus-within:ring-[var(--primary)]/50">
                          <div className="flex shrink-0 flex-col border-r border-[var(--border)]">
                            <button
                              ref={(node) => {
                                statusButtonRefs.current[character.id] = node;
                              }}
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={isStatusMenuOpen}
                              className={cn(
                                "inline-flex min-h-[2rem] items-center justify-center gap-1 px-2 text-[0.6875rem] font-medium transition-colors hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                                isStatusMenuOpen && "bg-[var(--accent)]",
                              )}
                              onClick={() =>
                                setStatusMenuCharacterId((current) => (current === character.id ? null : character.id))
                              }
                            >
                              <span className={cn("h-2 w-2 rounded-full", statusDotClass(character.status))} />
                              <ChevronDown size="0.625rem" className="shrink-0 opacity-60" />
                            </button>
                          </div>

                          <textarea
                            ref={(node) => {
                              activityFieldRefs.current[character.id] = node;
                            }}
                            value={isEditing ? draftActivity : primaryText}
                            disabled={updateMeta.isPending}
                            rows={1}
                            className="min-h-[2rem] max-h-28 w-full min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-2.5 py-1.5 text-[0.75rem] leading-5 text-[var(--foreground)]/88 outline-none placeholder:text-[var(--muted-foreground)]/55 disabled:opacity-60"
                            placeholder="Manual activity"
                            onFocus={() => {
                              beginEditing(character);
                              resizeActivityField(activityFieldRefs.current[character.id]);
                            }}
                            onChange={(event) => {
                              if (!isEditing) setEditingCharacterId(character.id);
                              setDraftActivity(event.currentTarget.value);
                              resizeActivityField(event.currentTarget);
                            }}
                            onBlur={() => void saveActivityOverride(character)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void saveActivityOverride(character);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelEditing();
                              }
                            }}
                          />

                          {isManual && (
                            <button
                              type="button"
                              disabled={updateMeta.isPending}
                              className="shrink-0 border-l border-[var(--border)] px-2.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]/20 hover:text-[var(--foreground)] disabled:opacity-60"
                              title="Clear manual override"
                              onClick={() => void restoreSchedule(character.id)}
                            >
                              <Trash2 size="0.75rem" />
                            </button>
                          )}
                        </div>
                      </div>

                      <ConversationPresenceScheduleSection
                        characterId={character.id}
                        schedule={character.schedule}
                        schedulesEnabled={schedulesEnabled}
                        hasGeneratedSchedules={hasGeneratedSchedules}
                        onOpenScheduleEditor={onOpenScheduleEditor}
                      />

                      {canReplyNow && (
                        <button
                          type="button"
                          disabled={!!replyNowCharacterId}
                          className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-[var(--foreground)]/8 px-2.5 py-1.5 text-[0.6875rem] font-medium text-[var(--foreground)]/78 ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--foreground)]/12 hover:text-[var(--foreground)] disabled:cursor-wait disabled:opacity-60"
                          onClick={() => void replyNow(character.id)}
                        >
                          {isReplyNowPending ? "Replying now..." : "Reply now"}
                        </button>
                      )}
                    </div>

                    {isStatusMenuOpen &&
                      createPortal(
                        <div
                          ref={statusMenuRef}
                          role="menu"
                          aria-label="Choose conversation status"
                          className="fixed z-[10000] rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1 text-[var(--popover-foreground)] shadow-xl ring-1 ring-[var(--border)]"
                          style={{
                            left: statusMenuPosition.left,
                            top: statusMenuPosition.top,
                            width: statusMenuPosition.width,
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          {STATUS_OPTIONS.map((option) => {
                            const selected = (pendingStatuses[character.id] ?? character.status) === option.status;
                            return (
                              <button
                                key={option.status}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                disabled={updateMeta.isPending}
                                onClick={() => void selectStatus(character, option.status)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.6875rem] transition-colors disabled:opacity-60",
                                  selected
                                    ? "bg-[var(--accent)] text-[var(--foreground)]"
                                    : "text-[var(--popover-foreground)] hover:bg-[var(--accent)]",
                                )}
                              >
                                <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass(option.status))} />
                                <span>{option.label}</span>
                              </button>
                            );
                          })}
                        </div>,
                        document.body,
                      )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
