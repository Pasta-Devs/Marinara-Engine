// ──────────────────────────────────────────────
// Chat: Recent Chats — shows 3 most recently
// interacted chats on the homepage (compact row)
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { MessageSquare, BookOpen, Theater } from "lucide-react";
import { useChats } from "../../hooks/use-chats";
import { useCharacterSummaries } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { compareChatsByActivityDesc } from "../../lib/chat-recency";
import { normalizeAvatarCrop, type AvatarCrop, type Chat } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";

const MODE_BADGE: Record<string, { icon: React.ReactNode; label: string; logoModeClass: string }> = {
  conversation: {
    icon: <MessageSquare size="0.375rem" />,
    label: "Conversation",
    logoModeClass: "mari-chat-logo-mode--conversation",
  },
  roleplay: {
    icon: <BookOpen size="0.375rem" />,
    label: "Roleplay",
    logoModeClass: "mari-chat-logo-mode--roleplay",
  },
  game: {
    icon: <Theater size="0.375rem" />,
    label: "Game",
    logoModeClass: "mari-chat-logo-mode--game",
  },
};

function parseRecentChatCharacterIds(value: Chat["characterIds"]): string[] {
  let rawIds: unknown = [];
  try {
    rawIds = value ? (typeof value === "string" ? (JSON.parse(value) as unknown) : value) : [];
  } catch {
    rawIds = [];
  }
  return Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === "string") : [];
}

export function RecentChats() {
  const localize = useLocalizedUiText();
  const { data: chats } = useChats();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  const recentChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    return [...chats].sort(compareChatsByActivityDesc).slice(0, 3);
  }, [chats]);
  const recentCharacterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const chat of recentChats) {
      for (const id of parseRecentChatCharacterIds(chat.characterIds)) ids.add(id);
    }
    return Array.from(ids);
  }, [recentChats]);
  const { data: characterSummaries } = useCharacterSummaries(recentCharacterIds);
  const charLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCrop | null }>();
    if (!characterSummaries) return map;
    for (const character of characterSummaries) {
      map.set(character.id, {
        name: character.name,
        avatarUrl: character.avatarUrl,
        avatarCrop: normalizeAvatarCrop(character.avatarCrop),
      });
    }
    return map;
  }, [characterSummaries]);

  return (
    <div
      className="mari-chrome-token-scope flex w-full max-w-md flex-col items-center gap-1.5"
      data-component="RecentChats"
    >
      {recentChats.length === 0 ? (
        <p className="rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] px-3 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-muted)]">
          {localize("No chats yet")}
        </p>
      ) : (
        <div className="mx-auto flex w-full flex-nowrap items-center justify-center gap-1.5 px-1">
          {recentChats.map((chat) => (
            <RecentChatChip
              key={chat.id}
              chat={chat}
              charLookup={charLookup}
              onClick={() => setActiveChatId(chat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecentChatChip({
  chat,
  charLookup,
  onClick,
}: {
  chat: Chat;
  charLookup: Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCrop | null }>;
  onClick: () => void;
}) {
  const localize = useLocalizedUiText();
  const mode = MODE_BADGE[chat.mode] ?? MODE_BADGE.conversation;

  const charIds = useMemo(() => parseRecentChatCharacterIds(chat.characterIds), [chat.characterIds]);

  const firstAvatar = useMemo(() => {
    for (const id of charIds) {
      const c = charLookup.get(id);
      if (c) return c;
    }
    return null;
  }, [charIds, charLookup]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "mari-chrome-control mari-chrome-control--small group relative h-8 w-0 min-w-0 max-w-[8rem] flex-1 basis-0 border-[var(--marinara-chat-chrome-button-border-active)] px-2 py-0 text-[var(--marinara-chat-chrome-button-text-active)] hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)]",
        "cursor-pointer",
      )}
      title={chat.name}
    >
      {/* Small avatar with mode dot */}
      <div className="relative flex-shrink-0">
        {firstAvatar?.avatarUrl ? (
          <span className="relative block h-5 w-5 overflow-hidden rounded-md">
            <img
              src={firstAvatar.avatarUrl}
              alt={firstAvatar.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(firstAvatar.avatarCrop)}
            />
          </span>
        ) : firstAvatar ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--secondary)] text-[0.5rem] font-bold text-[var(--muted-foreground)]">
            {firstAvatar.name[0]}
          </div>
        ) : (
          <div
            className={cn(
              "mari-chat-mode-avatar flex h-5 w-5 items-center justify-center rounded-md",
              mode.logoModeClass,
            )}
          >
            {mode.icon}
          </div>
        )}

        {/* Tiny mode dot */}
        <div
          className={cn(
            "mari-chat-mode-badge absolute -top-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-1 ring-[var(--card)]",
            mode.logoModeClass,
          )}
          title={localize(mode.label)}
        >
          {mode.icon}
        </div>
      </div>

      {/* Chat name only */}
      <span className="mari-chrome-text min-w-0 flex-1 truncate text-[0.625rem] font-medium">{chat.name}</span>
    </button>
  );
}
