import { useEffect, useMemo, useState } from "react";
import { MessageSquare, BookOpen, Theater } from "lucide-react";
import { useRecentChatSummaries, type ChatListItem } from "../../../catalog/chats/index";
import { CharacterAvatarImage, characterAvatarUrl, useCharacterSummariesByIds } from "../../../catalog/characters/index";
import { useChatStore } from "../../../../shared/stores/chat.store";
import { parseAvatarCropJson, type AvatarCropValue } from "../../../../shared/lib/utils";

const MODE_BADGE: Record<string, { icon: React.ReactNode; bg: string; label: string }> = {
  conversation: { icon: <MessageSquare size="0.75rem" />, bg: "linear-gradient(135deg, #4de5dd, #3ab8b1)", label: "Conversation" },
  roleplay: { icon: <BookOpen size="0.75rem" />, bg: "linear-gradient(135deg, #eb8951, #d97530)", label: "Roleplay" },
  game: { icon: <Theater size="0.75rem" />, bg: "linear-gradient(135deg, #e15c8c, #c94776)", label: "Game" },
};

function readAvatarCrop(value: unknown): AvatarCropValue | null {
  if (!value) return null;
  if (typeof value === "string") return parseAvatarCropJson(value);
  if (typeof value !== "object" || Array.isArray(value)) return null;
  try { return parseAvatarCropJson(JSON.stringify(value)); } catch { return null; }
}

export function RecentChats() {
  const { data: recentChats } = useRecentChatSummaries(3);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);

  const recentCharacterIds = useMemo(
    () => Array.from(new Set((recentChats ?? []).flatMap((c) => Array.isArray(c.characterIds) ? c.characterIds : []))),
    [recentChats],
  );
  const { data: recentCharacters } = useCharacterSummariesByIds(recentCharacterIds, recentCharacterIds.length > 0);

  const charLookup = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl: string | null; avatarFilePath?: string | null; avatarFilename?: string | null; avatarCrop?: AvatarCropValue | null }>();
    if (!recentCharacters) return map;
    for (const char of recentCharacters as Array<{ id: string; data: Record<string, unknown>; avatarPath?: string | null; avatarFilePath?: string | null; avatarFilename?: string | null }>) {
      const extensions = (char.data?.extensions && typeof char.data.extensions === "object" && !Array.isArray(char.data.extensions))
        ? (char.data.extensions as Record<string, unknown>)
        : {};
      map.set(char.id, {
        name: typeof char.data?.name === "string" ? char.data.name : "Unknown",
        avatarUrl: characterAvatarUrl(char),
        avatarFilePath: char.avatarFilePath,
        avatarFilename: char.avatarFilename,
        avatarCrop: readAvatarCrop(extensions.avatarCrop),
      });
    }
    return map;
  }, [recentCharacters]);

  if (!recentChats || recentChats.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-1.5 px-3 pt-3">
      <p className="text-center text-[0.625rem] font-medium uppercase tracking-wide text-[var(--muted-foreground)]/50">
        Recent
      </p>
      <div className="flex w-full flex-col gap-1.5 sm:flex-row">
        {recentChats.map((chat) => (
          <RecentChatCard key={chat.id} chat={chat} charLookup={charLookup} onClick={() => setActiveChatId(chat.id)} />
        ))}
      </div>
    </div>
  );
}

function RecentChatCard({
  chat,
  charLookup,
  onClick,
}: {
  chat: ChatListItem;
  charLookup: Map<string, { name: string; avatarUrl: string | null; avatarFilePath?: string | null; avatarFilename?: string | null; avatarCrop?: AvatarCropValue | null }>;
  onClick: () => void;
}) {
  const mode = MODE_BADGE[chat.mode] ?? MODE_BADGE.conversation;

  const characterIds = Array.isArray(chat.characterIds) ? chat.characterIds : [];
  const firstAvatar = characterIds.map((id) => charLookup.get(id)).find(Boolean) ?? null;

  return (
    <button
      onClick={onClick}
      className="group flex flex-1 min-w-0 items-center gap-3 rounded-xl border border-[var(--border)]/50 bg-[var(--card)]/50 px-3 py-2.5 text-left transition-all duration-150 hover:border-[var(--primary)]/40 hover:bg-[var(--card)] hover:shadow-sm"
    >
      <div className="relative flex-shrink-0">
        <RecentChatAvatar avatar={firstAvatar} mode={mode} />
        <div
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-white ring-1 ring-[var(--card)]"
          style={{ background: mode.bg }}
          title={mode.label}
        >
          {mode.icon}
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{chat.name}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{mode.label}</p>
      </div>
    </button>
  );
}

function RecentChatAvatar({
  avatar,
  mode,
}: {
  avatar: { name: string; avatarUrl: string | null; avatarFilePath?: string | null; avatarFilename?: string | null; avatarCrop?: AvatarCropValue | null } | null;
  mode: { bg: string; icon: React.ReactNode; label: string };
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => { setImageFailed(false); }, [avatar?.avatarUrl]);

  if (!avatar) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: mode.bg }}>
        {mode.icon}
      </div>
    );
  }

  if (!avatar.avatarUrl || imageFailed) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary)] text-sm font-bold text-[var(--muted-foreground)]">
        {avatar.name[0]}
      </div>
    );
  }

  return (
    <span className="relative block h-10 w-10 overflow-hidden rounded-xl">
      <CharacterAvatarImage
        src={avatar.avatarUrl}
        avatarFilePath={avatar.avatarFilePath}
        avatarFilename={avatar.avatarFilename}
        alt={avatar.name}
        className="h-full w-full object-cover"
        crop={avatar.avatarCrop}
        thumbnailSize={96}
        onError={() => setImageFailed(true)}
      />
    </span>
  );
}
