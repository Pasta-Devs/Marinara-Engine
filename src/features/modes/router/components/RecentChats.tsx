// ──────────────────────────────────────────────
// Chat: Recent Chats — shows 3 most recently
// interacted chats on the homepage (compact row)
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { MessageSquare, BookOpen } from "lucide-react";
import { useRecentChatSummaries, type ChatListItem } from "../../../catalog/chats/index";
import { characterAvatarUrl, useCharacterSummariesByIds } from "../../../catalog/characters/index";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../../../shared/lib/utils";

const MODE_BADGE: Record<string, { icon: React.ReactNode; bg: string; label: string }> = {
  conversation: {
    icon: <MessageSquare size="0.375rem" />,
    bg: "linear-gradient(135deg, #4de5dd, #3ab8b1)",
    label: "Conversation",
  },
  roleplay: {
    icon: <BookOpen size="0.375rem" />,
    bg: "linear-gradient(135deg, #eb8951, #d97530)",
    label: "Roleplay",
  },
};

export function RecentChats() {
  const { data: recentChats } = useRecentChatSummaries(3);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const recentCharacterIds = useMemo(
    () =>
      Array.from(
        new Set((recentChats ?? []).flatMap((chat) => (Array.isArray(chat.characterIds) ? chat.characterIds : []))),
      ),
    [recentChats],
  );
  const { data: recentCharacters } = useCharacterSummariesByIds(recentCharacterIds, recentCharacterIds.length > 0);

  const charLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCropValue | null }>();
    if (!recentCharacters) return map;
    for (const char of recentCharacters as Array<{
      id: string;
      data: Record<string, any>;
      avatarPath?: string | null;
      avatarFilePath?: string | null;
      avatarFilename?: string | null;
    }>) {
      const parsed = char.data ?? {};
      map.set(char.id, {
        name: parsed.name ?? "Unknown",
        avatarUrl: characterAvatarUrl(char),
        avatarCrop: parsed.extensions?.avatarCrop ?? null,
      });
    }
    return map;
  }, [recentCharacters]);

  if (!recentChats || recentChats.length === 0) return null;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-1.5">
      <p className="text-[0.625rem] font-medium text-[var(--muted-foreground)]/50 tracking-wide uppercase">
        Recent Chats
      </p>
      <div className="flex w-full items-center justify-center gap-1.5">
        {recentChats.map((chat) => (
          <RecentChatChip key={chat.id} chat={chat} charLookup={charLookup} onClick={() => setActiveChatId(chat.id)} />
        ))}
      </div>
    </div>
  );
}

function RecentChatChip({
  chat,
  charLookup,
  onClick,
}: {
  chat: ChatListItem;
  charLookup: Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCropValue | null }>;
  onClick: () => void;
}) {
  const mode = MODE_BADGE[chat.mode] ?? MODE_BADGE.conversation;

  const charIds: string[] = useMemo(() => {
    if (!chat.characterIds) return [];
    return chat.characterIds;
  }, [chat.characterIds]);

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
        "group relative flex max-w-[8rem] items-center gap-1.5 rounded-lg border border-[var(--border)]/50 bg-[var(--card)]/50 px-2 py-1.5",
        "transition-all duration-150 hover:border-[var(--primary)]/40 hover:bg-[var(--card)] hover:shadow-sm",
        "cursor-pointer",
      )}
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
            className="flex h-5 w-5 items-center justify-center rounded-md text-white"
            style={{ background: mode.bg }}
          >
            {mode.icon}
          </div>
        )}

        {/* Tiny mode dot */}
        <div
          className="absolute -top-0.5 -left-0.5 flex h-3 w-3 items-center justify-center rounded-full text-white ring-1 ring-[var(--card)]"
          style={{ background: mode.bg }}
          title={mode.label}
        >
          {mode.icon}
        </div>
      </div>

      {/* Chat name only */}
      <span className="truncate text-[0.625rem] font-medium text-[var(--foreground)]">{chat.name}</span>
    </button>
  );
}
