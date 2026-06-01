// ──────────────────────────────────────────────
// Chat: Recent Chats — shows 3 most recently
// interacted chats on the homepage (compact row)
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, BookOpen, Theater } from "lucide-react";
import { useRecentChatSummaries, type ChatListItem } from "../../../catalog/chats/index";
import { characterAvatarUrl, useCharacterSummariesByIds } from "../../../catalog/characters/index";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { cn, getAvatarCropStyle, parseAvatarCropJson, type AvatarCropValue } from "../../../../shared/lib/utils";

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
  game: {
    icon: <Theater size="0.375rem" />,
    bg: "linear-gradient(135deg, #e15c8c, #c94776)",
    label: "Game",
  },
};

function readAvatarCrop(value: unknown): AvatarCropValue | null {
  if (!value) return null;
  if (typeof value === "string") return parseAvatarCropJson(value);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return parseAvatarCropJson(JSON.stringify(value));
  } catch {
    return null;
  }
}

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
      data: Record<string, unknown>;
      avatarPath?: string | null;
      avatarFilePath?: string | null;
      avatarFilename?: string | null;
    }>) {
      const parsed = char.data ?? {};
      const extensions =
        parsed.extensions && typeof parsed.extensions === "object" && !Array.isArray(parsed.extensions)
          ? (parsed.extensions as Record<string, unknown>)
          : {};
      map.set(char.id, {
        name: typeof parsed.name === "string" ? parsed.name : "Unknown",
        avatarUrl: characterAvatarUrl(char),
        avatarCrop: readAvatarCrop(extensions.avatarCrop),
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
        {firstAvatar ? (
          <RecentChatAvatar avatar={firstAvatar} />
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

function RecentChatAvatar({
  avatar,
}: {
  avatar: { name: string; avatarUrl: string | null; avatarCrop?: AvatarCropValue | null };
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatar.avatarUrl]);

  if (!avatar.avatarUrl || imageFailed) {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--secondary)] text-[0.5rem] font-bold text-[var(--muted-foreground)]">
        {avatar.name[0]}
      </div>
    );
  }

  return (
    <span className="relative block h-5 w-5 overflow-hidden rounded-md">
      <img
        src={avatar.avatarUrl}
        alt={avatar.name}
        className="h-full w-full object-cover"
        style={getAvatarCropStyle(avatar.avatarCrop)}
        onError={() => setImageFailed(true)}
      />
    </span>
  );
}
