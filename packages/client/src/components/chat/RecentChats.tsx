// ──────────────────────────────────────────────
// Chat: Recent Chats — shows 3 most recently
// interacted chats on the homepage (compact row)
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { MessageSquare, BookOpen } from "lucide-react";
import { useChats } from "../../hooks/use-chats";
import { useCharacters } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { cn, getAvatarCropStyle, type AvatarCropValue } from "../../lib/utils";
import type { Chat } from "@marinara-engine/shared";

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
  visual_novel: {
    icon: <BookOpen size="0.375rem" />,
    bg: "linear-gradient(135deg, #e15c8c, #c94776)",
    label: "Game",
  },
};

export function RecentChats() {
  const { data: chats } = useChats();
  const { data: allCharacters } = useCharacters();
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  const charLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCropValue | null }>();
    if (!allCharacters) return map;
    for (const char of allCharacters as Array<{ id: string; data: string; avatarPath: string | null }>) {
      try {
        const parsed = typeof char.data === "string" ? JSON.parse(char.data) : char.data;
        map.set(char.id, {
          name: parsed.name ?? "Unknown",
          avatarUrl: char.avatarPath ?? null,
          avatarCrop: parsed.extensions?.avatarCrop ?? null,
        });
      } catch {
        map.set(char.id, { name: "Unknown", avatarUrl: null });
      }
    }
    return map;
  }, [allCharacters]);

  const recentChats = useMemo(() => {
    if (!chats || chats.length === 0) return [];
    return [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 3);
  }, [chats]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-1.5">
      {recentChats.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)]/45 bg-[var(--card)]/45 px-3 py-1.5 text-xs text-[var(--muted-foreground)]/70">
          No chats yet
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="mx-auto flex w-max items-center justify-center gap-1.5 px-1">
            {recentChats.map((chat) => (
              <RecentChatChip
                key={chat.id}
                chat={chat}
                charLookup={charLookup}
                onClick={() => setActiveChatId(chat.id)}
              />
            ))}
          </div>
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
  charLookup: Map<string, { name: string; avatarUrl: string | null; avatarCrop?: AvatarCropValue | null }>;
  onClick: () => void;
}) {
  const mode = MODE_BADGE[chat.mode] ?? MODE_BADGE.conversation;

  const charIds: string[] = useMemo(() => {
    if (!chat.characterIds) return [];
    return typeof chat.characterIds === "string" ? JSON.parse(chat.characterIds) : chat.characterIds;
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
        "mari-chrome-control mari-chrome-control--small group relative max-w-[8rem] shrink-0 px-2 py-1.5",
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
