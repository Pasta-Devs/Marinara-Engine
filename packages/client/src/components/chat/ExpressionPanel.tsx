// ──────────────────────────────────────────────
// Expression Panel — Character portrait sidebar
// Shows the active character's expression sprite
// on the right side of the chat area.
// Automatically updates based on detected emotion
// from the latest messages.
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo } from "react";
import { useCharacterSprites, type SpriteInfo } from "../../hooks/use-characters";
import { detectExpression } from "./SpriteOverlay";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CharacterMap } from "./ChatArea";

interface ExpressionPanelProps {
  /** Character IDs in this chat */
  characterIds: string[];
  /** All messages for expression detection */
  messages: Array<{ role: string; characterId?: string | null; content: string }>;
  /** Character lookup for names/avatars */
  characterMap: CharacterMap;
  /** Whether the chat is in roleplay mode (affects styling) */
  isRoleplay?: boolean;
}

export function ExpressionPanel({ characterIds, messages, characterMap, isRoleplay }: ExpressionPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Detect expressions for all characters
  const expressions = useMemo(() => {
    const result: Record<string, string> = {};
    if (!messages?.length) {
      for (const id of characterIds) result[id] = "neutral";
      return result;
    }
    for (const id of characterIds) {
      const lastMsg = [...messages].reverse().find((m) => m.characterId === id && m.role === "assistant");
      result[id] = lastMsg ? detectExpression(lastMsg.content) : "neutral";
    }
    return result;
  }, [messages, characterIds]);

  // Auto-switch to the character that spoke most recently
  useEffect(() => {
    if (!messages?.length || characterIds.length === 0) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.characterId);
    if (lastAssistant?.characterId) {
      const idx = characterIds.indexOf(lastAssistant.characterId);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [messages, characterIds]);

  // Clamp active index
  const safeIndex = Math.min(activeIndex, Math.max(0, characterIds.length - 1));
  const activeCharId = characterIds[safeIndex];

  // Don't render if no characters have sprites
  if (characterIds.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={cn(
          "flex h-full w-8 flex-shrink-0 items-center justify-center border-l transition-colors",
          isRoleplay
            ? "border-white/5 bg-black/30 text-white/40 hover:bg-black/50 hover:text-white/70"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        )}
        title="Show expressions"
      >
        <ChevronLeft size="0.875rem" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full w-64 flex-shrink-0 flex-col border-l transition-all lg:w-72",
        isRoleplay ? "border-white/5 bg-black/40 backdrop-blur-md" : "border-[var(--border)] bg-[var(--card)]",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          isRoleplay ? "border-b border-white/5" : "border-b border-[var(--border)]",
        )}
      >
        <span
          className={cn(
            "text-[0.6875rem] font-semibold uppercase tracking-wider",
            isRoleplay ? "text-white/50" : "text-[var(--muted-foreground)]",
          )}
        >
          Expressions
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className={cn(
            "rounded-md p-1 transition-colors",
            isRoleplay
              ? "text-white/40 hover:bg-white/10 hover:text-white/70"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
          )}
          title="Collapse panel"
        >
          <ChevronRight size="0.875rem" />
        </button>
      </div>

      {/* Character tabs (if multiple) */}
      {characterIds.length > 1 && (
        <div
          className={cn(
            "flex gap-1 overflow-x-auto px-2 py-1.5",
            isRoleplay ? "border-b border-white/5" : "border-b border-[var(--border)]",
          )}
        >
          {characterIds.map((cid, i) => {
            const info = characterMap.get(cid);
            const isActive = i === safeIndex;
            return (
              <button
                key={cid}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.6875rem] font-medium transition-all whitespace-nowrap",
                  isActive
                    ? isRoleplay
                      ? "bg-white/10 text-white"
                      : "bg-[var(--accent)] text-[var(--foreground)]"
                    : isRoleplay
                      ? "text-white/40 hover:bg-white/5 hover:text-white/60"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]",
                )}
              >
                {info?.avatarUrl ? (
                  <img src={info.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[0.5rem] font-bold">
                    {(info?.name ?? "?")[0]}
                  </div>
                )}
                {info?.name ?? "Character"}
              </button>
            );
          })}
        </div>
      )}

      {/* Sprite display */}
      {activeCharId && (
        <ExpressionSprite
          characterId={activeCharId}
          expression={expressions[activeCharId] ?? "neutral"}
          characterMap={characterMap}
          isRoleplay={isRoleplay}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Single character sprite display
// ─────────────────────────────────────────────
function ExpressionSprite({
  characterId,
  expression,
  characterMap,
  isRoleplay,
}: {
  characterId: string;
  expression: string;
  characterMap: CharacterMap;
  isRoleplay?: boolean;
}) {
  const { data: sprites } = useCharacterSprites(characterId);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const info = characterMap.get(characterId);

  const spriteList = useMemo(() => (sprites as SpriteInfo[] | undefined) ?? [], [sprites]);
  const hasSprites = spriteList.length > 0;

  // Find the best sprite for the current expression
  const spriteUrl = useMemo(() => {
    if (!hasSprites) return null;
    const exact = spriteList.find((s) => s.expression === expression);
    if (exact) return exact.url;
    const neutral = spriteList.find((s) => s.expression === "neutral" || s.expression === "default");
    if (neutral) return neutral.url;
    return spriteList[0]?.url ?? null;
  }, [spriteList, expression, hasSprites]);

  // Smooth transition between sprites
  useEffect(() => {
    if (spriteUrl && spriteUrl !== prevUrl) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setPrevUrl(spriteUrl);
        setIsTransitioning(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [spriteUrl, prevUrl]);

  const displayUrl = isTransitioning ? prevUrl : spriteUrl;

  // No sprites uploaded — show avatar fallback
  if (!hasSprites) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        {info?.avatarUrl ? (
          <div
            className={cn(
              "h-32 w-32 overflow-hidden rounded-2xl shadow-lg",
              isRoleplay ? "ring-2 ring-white/10" : "ring-2 ring-[var(--border)]",
            )}
          >
            <img
              src={info.avatarUrl}
              alt={info.name}
              className="h-full w-full object-cover"
              style={getAvatarCropStyle(info.avatarCrop)}
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-2xl text-3xl font-bold",
              isRoleplay ? "bg-white/5 text-white/30" : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
            )}
          >
            {(info?.name ?? "?")[0]}
          </div>
        )}
        <div className="text-center">
          <p className={cn("text-sm font-semibold", isRoleplay ? "text-white/80" : "text-[var(--foreground)]")}>
            {info?.name ?? "Character"}
          </p>
          <p
            className={cn("mt-0.5 text-[0.625rem]", isRoleplay ? "text-white/30" : "text-[var(--muted-foreground)]/50")}
          >
            No expression sprites uploaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sprite image */}
      <div className="relative flex flex-1 items-end justify-center overflow-hidden p-2">
        {displayUrl && (
          <img
            src={displayUrl}
            alt={`${expression} expression`}
            className={cn(
              "max-h-full w-auto object-contain transition-all duration-300",
              isTransitioning ? "scale-[0.98] opacity-70" : "scale-100 opacity-100",
              isRoleplay ? "drop-shadow-[0_0_20px_rgba(0,0,0,0.6)]" : "drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]",
            )}
            draggable={false}
          />
        )}
      </div>

      {/* Character name + expression label */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          isRoleplay ? "border-t border-white/5" : "border-t border-[var(--border)]",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn("truncate text-xs font-semibold", isRoleplay ? "text-white/80" : "text-[var(--foreground)]")}
            style={info?.nameColor ? { color: info.nameColor } : undefined}
          >
            {info?.name ?? "Character"}
          </p>
        </div>
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-medium capitalize",
            isRoleplay ? "bg-white/10 text-white/50" : "bg-[var(--secondary)] text-[var(--muted-foreground)]",
          )}
        >
          {expression}
        </span>
      </div>
    </div>
  );
}
