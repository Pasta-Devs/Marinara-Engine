import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronDown, RotateCcw } from "lucide-react";
import type {
  ConversationManualPresenceStatus,
  ConversationPresenceStatus,
  ConversationStatusOverride,
  Message,
} from "@marinara-engine/shared";
import type { CharacterMap } from "./chat-area.types";
import { getChatToolbarButtonClass } from "./ChatToolbarControls";
import {
  ROLEPLAY_POPOVER_HEADER,
  ROLEPLAY_POPOVER_SCROLL_AREA,
  ROLEPLAY_POPOVER_SHELL,
  ROLEPLAY_POPOVER_SUBTITLE,
  ROLEPLAY_POPOVER_TITLE,
} from "./roleplay-popover-styles";
import { characterKeys } from "../../hooks/use-characters";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import { api } from "../../lib/api-client";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import { useChatStore, type DelayedCharacterInfo } from "../../stores/chat.store";

type ScheduleBlockLike = {
  time?: string;
  activity?: string;
  status?: ConversationPresenceStatus;
};

type WeekScheduleLike = {
  weekStart?: string;
  days?: Record<string, ScheduleBlockLike[]>;
};

type PresenceCharacter = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarCrop?: AvatarCropValue | null;
  status: ConversationPresenceStatus;
  activity: string;
  scheduledStatus: ConversationPresenceStatus;
  scheduledActivity: string;
  override?: ConversationStatusOverride;
  nextBlock: ScheduleBlockLike | null;
  lastContact: string;
};

interface ConversationPresenceCardProps {
  chatId: string;
  chatMeta: Record<string, any>;
  chatCharIds: string[];
  characterMap: CharacterMap;
  messages: Message[] | undefined;
  onOpenSettings: (event?: ReactMouseEvent<HTMLElement>, options?: { initialSection?: "autonomous" | null }) => void;
}

const PRESENCE_OPTIONS: Array<{
  status: ConversationManualPresenceStatus;
  label: string;
}> = [
  { status: "online", label: "Available" },
  { status: "idle", label: "Away" },
  { status: "dnd", label: "Busy" },
  { status: "offline", label: "Offline" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function statusColor(status?: ConversationPresenceStatus | string) {
  const resolved = status ?? "online";
  return resolved === "online"
    ? "bg-green-500"
    : resolved === "idle"
      ? "bg-yellow-500"
      : resolved === "dnd"
        ? "bg-red-500"
        : "bg-gray-400";
}

function statusLabel(status?: ConversationPresenceStatus | string) {
  return status === "idle" ? "Away" : status === "dnd" ? "Busy" : status === "offline" ? "Offline" : "Available";
}

function toManualPresenceStatus(status: ConversationPresenceStatus): ConversationManualPresenceStatus {
  return status;
}

function parseConversationStatusOverrides(value: unknown): Record<string, ConversationStatusOverride> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, override]) => {
      if (!override || typeof override !== "object" || Array.isArray(override)) return false;
      const status = (override as Record<string, unknown>).status;
      return status === "online" || status === "idle" || status === "dnd" || status === "offline";
    }),
  ) as Record<string, ConversationStatusOverride>;
}

function parseCharacterSchedules(value: unknown): Record<string, WeekScheduleLike> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, WeekScheduleLike>;
}

function getActiveOverride(override: ConversationStatusOverride | undefined, now = new Date()) {
  if (!override) return undefined;
  if (override.expiresAt) {
    const expiresAt = new Date(override.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return undefined;
  }
  return override;
}

function getCurrentScheduleBlock(schedule: WeekScheduleLike | undefined, now = new Date()) {
  const daySchedule = schedule?.days?.[DAY_NAMES[(now.getDay() + 6) % 7]!];
  if (!daySchedule?.length) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const block of daySchedule) {
    const [startStr, endStr] = (block.time ?? "").split("-");
    if (!startStr || !endStr) continue;
    const [startHour, startMinute] = startStr.split(":").map(Number);
    const [endHour, endMinute] = endStr.split(":").map(Number);
    const start = (startHour ?? 0) * 60 + (startMinute ?? 0);
    const end = (endHour ?? 0) * 60 + (endMinute ?? 0);
    if (start <= currentMinutes && currentMinutes < end) return block;
    if (start > end && (currentMinutes >= start || currentMinutes < end)) return block;
  }
  return null;
}

function getNextScheduleBlock(schedule: WeekScheduleLike | undefined, now = new Date()) {
  const daySchedule = schedule?.days?.[DAY_NAMES[(now.getDay() + 6) % 7]!];
  if (!daySchedule?.length) return null;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return daySchedule.find((block) => {
    const startStr = (block.time ?? "").split("-")[0];
    if (!startStr) return false;
    const [startHour, startMinute] = startStr.split(":").map(Number);
    return (startHour ?? 0) * 60 + (startMinute ?? 0) > currentMinutes;
  }) ?? null;
}

function getRelativeTimeLabel(value: string | undefined) {
  if (!value) return "No contact yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No contact yet";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getManualOverrideDurationLabel(override: ConversationStatusOverride | undefined, now = new Date()) {
  if (!override?.expiresAt) return "until reset";
  const expiresAt = new Date(override.expiresAt);
  const timestamp = expiresAt.getTime();
  if (!Number.isFinite(timestamp)) return "until reset";
  const timeLabel = expiresAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (expiresAt.toDateString() === now.toDateString()) return `until ${timeLabel}`;
  const dateLabel = expiresAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `until ${dateLabel} ${timeLabel}`;
}

function describeScheduleBlock(block: ScheduleBlockLike | null) {
  if (!block) return "No later block today";
  const parts = [block.time, block.activity].filter((part): part is string => !!part?.trim());
  return parts.length > 0 ? parts.join(" - ") : statusLabel(block.status);
}

function removeCharacterFromDelayedInfo(info: DelayedCharacterInfo | null, characterId: string) {
  if (!info) return null;
  if (!info.characterIds && !info.characters) return info;
  const nextCharacterIds = info.characterIds?.filter((id) => id !== characterId);
  const nextCharacters = info.characters?.filter((character) => character.id !== characterId);
  if (info.characters && (nextCharacters?.length ?? 0) === 0) return null;
  if ((nextCharacterIds?.length ?? 0) === 0 && (nextCharacters?.length ?? 0) === 0) return null;
  const nextName = nextCharacters?.length
    ? nextCharacters.length === 1
      ? nextCharacters[0]!.name
      : nextCharacters.map((character) => character.name).join(", ")
    : info.name;
  const nextStatus =
    nextCharacters?.length && nextCharacters.some((character) => character.status === "dnd")
      ? "dnd"
      : nextCharacters?.length && nextCharacters.some((character) => character.status === "idle")
        ? "idle"
        : (nextCharacters?.[0]?.status ?? info.status);
  return {
    ...info,
    name: nextName,
    status: nextStatus,
    ...(nextCharacterIds ? { characterIds: nextCharacterIds } : {}),
    ...(nextCharacters ? { characters: nextCharacters } : {}),
  };
}

export function ConversationPresenceCard({
  chatId,
  chatMeta,
  chatCharIds,
  characterMap,
  messages,
  onOpenSettings,
}: ConversationPresenceCardProps) {
  const qc = useQueryClient();
  const updateChatMetadata = useUpdateChatMetadata();
  const [presenceCardOpen, setPresenceCardOpen] = useState(false);
  const [presenceStatusMenu, setPresenceStatusMenu] = useState<{ characterId: string; left: number; top: number } | null>(null);
  const presenceCardRef = useRef<HTMLDivElement>(null);
  const presenceStatusMenuRef = useRef<HTMLDivElement>(null);
  const metadataStatusOverrides = useMemo(
    () => parseConversationStatusOverrides(chatMeta.conversationStatusOverrides),
    [chatMeta.conversationStatusOverrides],
  );
  const [optimisticStatusOverrides, setOptimisticStatusOverrides] = useState<Record<
    string,
    ConversationStatusOverride
  > | null>(null);
  const [draftPresenceActivities, setDraftPresenceActivities] = useState<Record<string, string>>({});
  const statusOverrides = optimisticStatusOverrides ?? metadataStatusOverrides;
  const characterSchedules = useMemo(() => parseCharacterSchedules(chatMeta.characterSchedules), [chatMeta.characterSchedules]);
  const presenceCharacters = useMemo(() => {
    return chatCharIds
      .map((id) => {
        const character = characterMap.get(id);
        if (!character) return null;
        const schedule = characterSchedules[id];
        const scheduledBlock = getCurrentScheduleBlock(schedule);
        const nextBlock = getNextScheduleBlock(schedule);
        const activeOverride = getActiveOverride(statusOverrides[id]);
        const scheduledStatus = scheduledBlock?.status ?? character.conversationStatus ?? "online";
        const scheduledActivity = scheduledBlock?.activity ?? character.conversationActivity ?? (schedule ? "free time" : "");
        const effectiveStatus = activeOverride?.status ?? scheduledStatus;
        const effectiveActivity = activeOverride && typeof activeOverride.activity === "string"
          ? activeOverride.activity.trim()
          : scheduledActivity;
        const lastContactMessage = [...(messages ?? [])]
          .reverse()
          .find((msg) => msg.role === "assistant" && (msg.characterId === id || chatCharIds.length === 1));
        return {
          id,
          name: character.name,
          avatarUrl: character.avatarUrl,
          avatarCrop: character.avatarCrop,
          status: effectiveStatus,
          activity: effectiveActivity,
          scheduledStatus,
          scheduledActivity,
          override: activeOverride,
          nextBlock,
          lastContact: getRelativeTimeLabel(lastContactMessage?.createdAt),
        };
      })
      .filter(Boolean) as PresenceCharacter[];
  }, [characterMap, characterSchedules, chatCharIds, messages, statusOverrides]);

  const hasManualPresenceState = presenceCharacters.some((character) => {
    const draftActivity = draftPresenceActivities[character.id];
    return !!character.override || (typeof draftActivity === "string" && draftActivity.trim() !== (character.activity ?? "").trim());
  });

  const syncConversationStatus = useCallback(async () => {
    try {
      await api.get(`/conversation/status/${chatId}`);
      qc.invalidateQueries({ queryKey: characterKeys.list() });
    } catch {
      /* non-critical */
    }
  }, [chatId, qc]);

  const clearDelayedPresenceForCharacter = useCallback((characterId: string) => {
    const chatState = useChatStore.getState();
    // An online manual override only clears the matching character from any pending busy/away banner.
    const currentDelayed = chatState.perChatDelayed.get(chatId) ?? null;
    const nextDelayed = removeCharacterFromDelayedInfo(currentDelayed, characterId);
    chatState.setPerChatDelayed(chatId, nextDelayed);
    if (chatState.activeChatId === chatId) {
      const nextActiveDelayed = removeCharacterFromDelayedInfo(chatState.delayedCharacterInfo, characterId);
      chatState.setDelayedCharacterInfo(nextActiveDelayed);
    }
  }, [chatId]);

  const updatePresenceOverride = useCallback(
    async (
      characterId: string,
      status: ConversationManualPresenceStatus | null,
      activity?: string,
      statusAfterClear?: ConversationPresenceStatus,
    ) => {
      const previousOverrides = statusOverrides;
      const nextOverrides = { ...statusOverrides };
      if (status) {
        const previousActivity = nextOverrides[characterId]?.activity ?? activity ?? "";
        nextOverrides[characterId] = {
          status,
          activity: typeof activity === "string" ? activity.trim() : previousActivity,
          createdAt: new Date().toISOString(),
        };
      } else {
        delete nextOverrides[characterId];
        setDraftPresenceActivities((current) => {
          const next = { ...current };
          delete next[characterId];
          return next;
        });
      }
      setOptimisticStatusOverrides(nextOverrides);
      try {
        await updateChatMetadata.mutateAsync({
          id: chatId,
          conversationStatusOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : null,
        });
        await syncConversationStatus();
        if (status === "online" || (!status && statusAfterClear === "online")) {
          clearDelayedPresenceForCharacter(characterId);
        }
      } catch {
        setOptimisticStatusOverrides(previousOverrides);
      }
    },
    [chatId, clearDelayedPresenceForCharacter, statusOverrides, syncConversationStatus, updateChatMetadata],
  );

  const updatePresenceActivity = useCallback(
    async (
      characterId: string,
      activity: string,
      currentStatus: ConversationPresenceStatus,
      currentActivity: string,
    ) => {
      const currentOverride = statusOverrides[characterId];
      if (!currentOverride && currentActivity.trim() === activity.trim()) return;
      if (currentOverride && (currentOverride.activity ?? "") === activity.trim()) return;
      const previousOverrides = statusOverrides;
      const nextOverrides = {
        ...statusOverrides,
        [characterId]: {
          ...currentOverride,
          status: currentOverride?.status ?? toManualPresenceStatus(currentStatus),
          activity: activity.trim(),
          createdAt: currentOverride?.createdAt ?? new Date().toISOString(),
        },
      };
      setOptimisticStatusOverrides(nextOverrides);
      try {
        await updateChatMetadata.mutateAsync({
          id: chatId,
          conversationStatusOverrides: nextOverrides,
        });
        await syncConversationStatus();
      } catch {
        setOptimisticStatusOverrides(previousOverrides);
      }
    },
    [chatId, statusOverrides, syncConversationStatus, updateChatMetadata],
  );

  useEffect(() => {
    if (!chatId) return;
    const refreshStatus = async () => {
      if (document.hidden) return;
      try {
        await api.get(`/conversation/status/${chatId}`);
        qc.invalidateQueries({ queryKey: characterKeys.list() });
      } catch {
        /* non-critical */
      }
    };
    void refreshStatus();
    const timer = setInterval(refreshStatus, 60_000);
    return () => clearInterval(timer);
  }, [chatId, qc]);

  useEffect(() => {
    setPresenceCardOpen(false);
    setPresenceStatusMenu(null);
    setOptimisticStatusOverrides(null);
    setDraftPresenceActivities({});
  }, [chatId]);

  useEffect(() => {
    setOptimisticStatusOverrides(null);
  }, [chatMeta.conversationStatusOverrides]);

  useEffect(() => {
    if (!presenceCardOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!presenceCardRef.current?.contains(target) && !presenceStatusMenuRef.current?.contains(target)) {
        setPresenceCardOpen(false);
        setPresenceStatusMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPresenceStatusMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [presenceCardOpen]);

  if (presenceCharacters.length === 0) return <div />;

  const identityPillClass = getChatToolbarButtonClass({
    compact: true,
    className:
      "w-auto min-w-0 max-w-[min(20rem,calc(100vw-8rem))] justify-start gap-2 px-2.5 text-[var(--foreground)]/80 hover:text-[var(--foreground)]/90",
  });
  const avatarShellClass = "relative block h-5 w-5 overflow-hidden rounded-full ring-1 ring-[var(--border)]/80";
  const avatarFallbackClass =
    "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)]/10 text-[0.5rem] font-bold text-[var(--foreground)]/70 ring-1 ring-[var(--border)]/80";
  const renderAvatar = (character: PresenceCharacter, dotSize = "h-2 w-2", showDot = true) => (
    <div className="relative flex-shrink-0">
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
        <div className={avatarFallbackClass}>{character.name[0] ?? "?"}</div>
      )}
      {showDot && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${dotSize} rounded-full ring-[1.5px] ring-[var(--card)] ${statusColor(character.status)}`}
        />
      )}
    </div>
  );
  const primaryCharacter = presenceCharacters[0]!;
  const title = presenceCharacters
    .map((character) => [character.name, statusLabel(character.status), character.activity].filter(Boolean).join(": "))
    .join(", ");

  return (
    <div ref={presenceCardRef} className="relative min-w-0">
      <button
        type="button"
        className={identityPillClass}
        title={title}
        aria-expanded={presenceCardOpen}
        onClick={() => {
          const nextOpen = !presenceCardOpen;
          setPresenceCardOpen(nextOpen);
          if (!nextOpen) setPresenceStatusMenu(null);
        }}
      >
        {presenceCharacters.length === 1 ? (
          renderAvatar(primaryCharacter)
        ) : (
          <div
            className="relative flex-shrink-0"
            style={{ width: `${Math.min(presenceCharacters.length, 3) * 12 + 8}px`, height: 20 }}
          >
            {presenceCharacters.slice(0, 3).map((character, index) => (
              <div key={character.id} className="absolute top-0" style={{ left: index * 12 }}>
                {renderAvatar(character, "h-1.5 w-1.5")}
              </div>
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col text-left leading-tight">
          <span className="truncate text-[0.75rem] font-semibold text-[var(--foreground)]/90">
            {presenceCharacters.length <= 2
              ? presenceCharacters.map((character) => character.name).join(" & ")
              : `${primaryCharacter.name} + ${presenceCharacters.length - 1}`}
          </span>
          <span className="truncate text-[0.5625rem] text-[var(--foreground)]/50">
            {hasManualPresenceState ? "Manual" : primaryCharacter.activity}
          </span>
        </div>
        <ChevronDown
          size="0.75rem"
          className={`ml-0.5 flex-shrink-0 text-[var(--foreground)]/45 transition-transform ${presenceCardOpen ? "rotate-180" : ""}`}
        />
      </button>

      {presenceCardOpen && (
        <div
          className={`${ROLEPLAY_POPOVER_SHELL} absolute left-0 top-full z-30 mt-2 w-[min(28rem,calc(100vw-1rem))] overflow-hidden max-sm:fixed max-sm:left-2 max-sm:right-2 max-sm:top-14 max-sm:w-auto`}
        >
          <div className={`${ROLEPLAY_POPOVER_HEADER} flex items-center justify-between gap-2`}>
            <div className="min-w-0">
              <div className={ROLEPLAY_POPOVER_TITLE}>
                <Activity size="0.75rem" className="shrink-0 text-[var(--muted-foreground)]" />
                Presence
              </div>
              <div className={ROLEPLAY_POPOVER_SUBTITLE}>Adjust manual status here, schedule edits live in Chat Settings.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPresenceCardOpen(false);
                setPresenceStatusMenu(null);
                onOpenSettings(undefined, { initialSection: "autonomous" });
              }}
              className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              Edit schedules
            </button>
          </div>
          <div className={cn(ROLEPLAY_POPOVER_SCROLL_AREA, "max-h-[min(22rem,70vh)] overflow-y-auto p-1.5")}>
            {presenceCharacters.map((character) => {
              const displayStatus = character.status;
              const draftActivity = draftPresenceActivities[character.id];
              const inputValue = draftActivity ?? character.activity ?? "";
              const hasDraftActivity = typeof draftActivity === "string" && draftActivity.trim() !== (character.activity ?? "").trim();
              const isManualPresence = !!character.override || hasDraftActivity;
              const manualDuration = character.override ? getManualOverrideDurationLabel(character.override) : "editing";
              return (
                <div key={character.id} className="rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--accent)]/20">
                  <div className="flex min-w-0 items-start gap-2">
                    {renderAvatar(character, "h-2 w-2", false)}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[0.75rem] font-semibold">{character.name}</span>
                        {isManualPresence && (
                          <span
                            className="shrink-0 rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-[var(--primary)]"
                            title={character.override ? `Manual override ${manualDuration}` : "Manual edit saves on blur"}
                          >
                            Manual {manualDuration}
                          </span>
                        )}
                        {isManualPresence && (
                          <button
                            type="button"
                            aria-label={`Reset manual presence for ${character.name}`}
                            title="Reset manual presence"
                            disabled={updateChatMetadata.isPending}
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                            // Keep reset from triggering the input blur-save before the override clears.
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              if (character.override) {
                                void updatePresenceOverride(character.id, null, undefined, character.scheduledStatus);
                                return;
                              }
                              setDraftPresenceActivities((current) => {
                                const next = { ...current };
                                delete next[character.id];
                                return next;
                              });
                            }}
                          >
                            <RotateCcw size="0.7rem" aria-hidden="true" />
                          </button>
                        )}
                        <span className="ml-auto shrink-0 text-[0.625rem] text-[var(--muted-foreground)]/80">
                          Last contact {character.lastContact}
                        </span>
                      </div>
                      <div className="mt-1 grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                        <button
                          type="button"
                          disabled={updateChatMetadata.isPending}
                          aria-label={`Set ${character.name} presence status`}
                          aria-expanded={presenceStatusMenu?.characterId === character.id}
                          aria-haspopup="menu"
                          title={statusLabel(displayStatus)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-md border border-[var(--border)] bg-[var(--secondary)]/70 transition-colors hover:bg-[var(--accent)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                          onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setPresenceStatusMenu((current) =>
                              current?.characterId === character.id
                                ? null
                                : {
                                    characterId: character.id,
                                    left: Math.max(4, Math.min(rect.left, window.innerWidth - 132)),
                                    top: Math.max(4, Math.min(rect.bottom + 4, window.innerHeight - 116)),
                                  },
                            );
                          }}
                        >
                          <span className={`h-2 w-2 rounded-full ${statusColor(displayStatus)}`} />
                        </button>
                        <div className="flex min-w-0 items-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--secondary)]/70 transition-colors focus-within:border-[var(--primary)]/50">
                          <input
                            aria-label={`Current status text for ${character.name}`}
                            value={inputValue}
                            disabled={updateChatMetadata.isPending}
                            onChange={(event) =>
                              setDraftPresenceActivities((current) => ({
                                ...current,
                                [character.id]: event.target.value,
                              }))
                            }
                            onBlur={(event) =>
                              void updatePresenceActivity(character.id, event.target.value, character.status, character.activity)
                            }
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              event.currentTarget.blur();
                            }}
                            placeholder="Current status"
                            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-[0.6875rem] leading-tight text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]/45 disabled:opacity-60"
                          />
                        </div>
                        <span className="pt-0.5 font-semibold text-[var(--foreground)]/75">Next</span>
                        <span className="min-w-0 break-words pt-0.5">{describeScheduleBlock(character.nextBlock)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {presenceCardOpen &&
        presenceStatusMenu &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={presenceStatusMenuRef}
            role="menu"
            className="fixed z-[9999] min-w-32 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
            style={{ left: presenceStatusMenu.left, top: presenceStatusMenu.top }}
          >
            {PRESENCE_OPTIONS.map((option) => {
              const character = presenceCharacters.find((item) => item.id === presenceStatusMenu.characterId);
              const currentValue = character ? draftPresenceActivities[character.id] ?? character.activity ?? "" : "";
              const selectedStatus = character?.override?.status ?? character?.status ?? "online";
              return (
                <button
                  key={option.status}
                  type="button"
                  role="menuitem"
                  disabled={updateChatMetadata.isPending || !character}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.6875rem] font-medium transition-colors disabled:opacity-60 ${
                    selectedStatus === option.status
                      ? "bg-[var(--primary)]/12 text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  }`}
                  onClick={() => {
                    if (!character) return;
                    setPresenceStatusMenu(null);
                    void updatePresenceOverride(character.id, option.status, currentValue);
                  }}
                >
                  <span className={`h-2 w-2 rounded-full ${statusColor(option.status)}`} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
