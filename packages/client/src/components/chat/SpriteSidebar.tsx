// ──────────────────────────────────────────────
// Sprite Sidebar — character sprites beside the chat
// Shows enabled sprite characters as a vertical strip.
// Expression is detected from recent messages.
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, memo } from "react";
import { useCharacterSprites, type SpriteInfo } from "../../hooks/use-characters";
import { detectExpression } from "./SpriteOverlay";
import { cn } from "../../lib/utils";
import type { CharacterMap } from "./ChatArea";

interface SpriteSidebarProps {
  /** IDs of characters with sprites enabled */
  characterIds: string[];
  /** Messages for expression detection */
  messages: Array<{ role: string; characterId?: string | null; content: string }>;
  /** Character lookup */
  characterMap: CharacterMap;
  /** Whether in roleplay mode */
  isRoleplay?: boolean;
}

export const SpriteSidebar = memo(function SpriteSidebar({
  characterIds,
  messages,
  characterMap,
  isRoleplay,
}: SpriteSidebarProps) {
  // Memoize expression detection — only recompute when messages/characters change
  const expressions = useMemo(() => {
    if (!messages?.length) return {} as Record<string, string>;
    const result: Record<string, string> = {};
    for (const id of characterIds) {
      const lastMsg = [...messages].reverse().find((m) => m.characterId === id && m.role === "assistant");
      result[id] = lastMsg ? detectExpression(lastMsg.content) : "neutral";
    }
    return result;
  }, [messages, characterIds]);

  if (characterIds.length === 0) return null;

  return (
    <div
      className={cn(
        "hidden sm:flex w-48 flex-col items-center justify-end gap-2 overflow-hidden py-2",
        isRoleplay ? "bg-black/40 border-white/5" : "bg-[var(--secondary)]/50 border-[var(--border)]",
      )}
    >
      {characterIds.slice(0, 3).map((charId) => (
        <SidebarSprite
          key={charId}
          characterId={charId}
          expression={expressions[charId] ?? "neutral"}
          name={characterMap.get(charId)?.name}
          isRoleplay={isRoleplay}
        />
      ))}
    </div>
  );
});

function SidebarSprite({
  characterId,
  expression,
  name,
  isRoleplay,
}: {
  characterId: string;
  expression: string;
  name?: string;
  isRoleplay?: boolean;
}) {
  const { data: sprites } = useCharacterSprites(characterId);
  const [isVisible, setIsVisible] = useState(false);

  const spriteUrl = useMemo(() => {
    if (!sprites || !(sprites as SpriteInfo[]).length) return null;
    const spriteList = sprites as SpriteInfo[];
    const exact = spriteList.find((s) => s.expression === expression);
    if (exact) return exact.url;
    const neutral = spriteList.find((s) => s.expression === "neutral" || s.expression === "default");
    if (neutral) return neutral.url;
    return spriteList[0]?.url ?? null;
  }, [sprites, expression]);

  useEffect(() => {
    setIsVisible(!!spriteUrl);
  }, [spriteUrl]);

  if (!spriteUrl) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center transition-all duration-300",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
      )}
    >
      <img
        src={spriteUrl}
        alt={`${name ?? "Character"} — ${expression}`}
        className="max-h-[30vh] w-auto object-contain drop-shadow-lg"
        draggable={false}
      />
      {name && (
        <span
          className={cn(
            "mt-1 truncate text-[0.625rem] font-medium max-w-[10rem] text-center",
            isRoleplay ? "text-white/60" : "text-[var(--muted-foreground)]",
          )}
        >
          {name}
        </span>
      )}
    </div>
  );
}
