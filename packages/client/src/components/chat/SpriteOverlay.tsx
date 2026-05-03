// ──────────────────────────────────────────────
// Sprite Overlay — VN-style character sprites in chat
// Supports persisted free placement to avoid group-chat overlap.
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence, type TargetAndTransition } from "framer-motion";
import type { SpritePlacement, SpriteSide } from "@marinara-engine/shared";
import { useCharacterSprites, type SpriteInfo } from "../../hooks/use-characters";
import { useAgentStore } from "../../stores/agent.store";
import { clampSpritePlacement, getDefaultSpritePlacement, type SpritePlacementMap } from "./sprite-placement";

interface SpriteOverlayProps {
  /** IDs of characters with sprites enabled in this chat */
  characterIds: string[];
  /** The last N messages to detect expressions from */
  messages: Array<{ role: string; characterId?: string | null; content: string }>;
  /** Which side the sidebar / default sprite layout prefers */
  side: SpriteSide | "center";
  /** Saved expressions per character (from chat metadata) */
  spriteExpressions?: Record<string, string>;
  /** Saved freeform placements per character (from chat metadata) */
  spritePlacements?: SpritePlacementMap;
  /** Whether the overlay is currently in drag-to-arrange mode */
  editing?: boolean;
  /** Called when expression changes (to persist it) */
  onExpressionChange?: (characterId: string, expression: string) => void;
  /** Called when a sprite is moved (to persist it) */
  onPlacementChange?: (characterId: string, placement: SpritePlacement) => void;
  /** When true, only show full-body sprites (full_ prefix) and hide characters without any */
  fullBodyOnly?: boolean;
  /** Multiplier for sprite size. Game mode passes this for full-body sprites. */
  spriteScale?: number;
}

type Transition = "crossfade" | "bounce" | "shake" | "hop" | "none";

interface CharacterExpressionState {
  expression: string;
  transition: Transition;
}

/** Simple keyword-based expression detection from message text. */
export function detectExpression(text: string): string {
  const lower = text.toLowerCase();
  const patterns: [string, RegExp][] = [
    ["angry", /\b(anger|angry|furious|rage|yells?|shouts?|snarls?|growls?|seeth)/i],
    ["sad", /\b(sad|sorrow|cry|cries|crying|tears|weep|sob|mourn|grief|melanchol)/i],
    ["happy", /\b(happy|joy|laugh|smile|smiles|grin|grins|cheer|delight|beam|beaming|giggl)/i],
    ["surprised", /\b(surpris|shock|astonish|gasp|gasps|wide.?eye|startle|stun)/i],
    ["scared", /\b(scare|fear|afraid|terrif|frighten|tremble|trembling|shiver|panic)/i],
    ["embarrassed", /\b(embarrass|blush|blushes|flustered|sheepish|shy|avert)/i],
    ["love", /\b(love|adore|affection|heart|kiss|embrace|cherish)/i],
    ["thinking", /\b(think|ponder|consider|contemplat|muse|hmm|wonder)/i],
    ["laughing", /\b(laugh|laughing|laughter|haha|LOL|chuckle|cackle|snicker|giggle)/i],
    ["worried", /\b(worr|anxious|nervous|uneasy|fret|concern|dread)/i],
    ["disgusted", /\b(disgust|repuls|revolt|gross|nausea|sicken)/i],
    ["smirk", /\b(smirk|sly|mischiev|devious|wink|tease|teasing)/i],
    ["crying", /\b(crying|cried|weeping|tears stream|sobbing)/i],
    ["determined", /\b(determin|resolv|steadfast|unwaver|resolute|clench)/i],
    ["hurt", /\b(hurt|pain|wound|wince|grimace|ache|suffer)/i],
  ];

  for (const [expression, regex] of patterns) {
    if (regex.test(lower)) return expression;
  }
  return "neutral";
}

export function SpriteOverlay({
  characterIds,
  messages,
  side,
  spriteExpressions,
  spritePlacements,
  editing = false,
  onExpressionChange,
  onPlacementChange,
  fullBodyOnly = false,
  spriteScale = 1,
}: SpriteOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  // Subscribe to agent expression results
  const expressionResult = useAgentStore((s) => s.lastResults.get("expression"));
  // Track which agent result we already applied so we don't re-fire for stale results
  const appliedResultRef = useRef<unknown>(null);

  // Track current expression + transition per character
  const [states, setStates] = useState<Record<string, CharacterExpressionState>>(() => {
    const initial: Record<string, CharacterExpressionState> = {};
    if (spriteExpressions) {
      for (const [id, expr] of Object.entries(spriteExpressions)) {
        initial[id] = { expression: expr, transition: "none" };
      }
    }
    return initial;
  });

  // When agent result arrives, prefer it over keyword detection
  useEffect(() => {
    // Full-body sprites use poses from spriteExpressions (game mode); the facial-expression agent would overwrite them with values like "happy" that don't match any full_* sprite.
    if (fullBodyOnly) return;
    if (expressionResult?.success && expressionResult.data && expressionResult !== appliedResultRef.current) {
      const data = expressionResult.data as {
        expressions?: Array<{ characterId: string; expression: string; transition?: string }>;
      };
      if (data.expressions?.length) {
        appliedResultRef.current = expressionResult;
        const updates: Array<{ characterId: string; expression: string; transition: Transition }> = [];
        for (const e of data.expressions) {
          const t = (["crossfade", "bounce", "shake", "hop", "none"] as Transition[]).includes(
            e.transition as Transition,
          )
            ? (e.transition as Transition)
            : "crossfade";
          updates.push({ characterId: e.characterId, expression: e.expression, transition: t });
        }
        setStates((prev) => {
          const next = { ...prev };
          for (const u of updates) {
            next[u.characterId] = { expression: u.expression, transition: u.transition };
          }
          return next;
        });
        // Persist expression changes outside setState to avoid side-effects in updater
        for (const u of updates) {
          onExpressionChange?.(u.characterId, u.expression);
        }
        return;
      }
    }
  }, [expressionResult, onExpressionChange, fullBodyOnly]);

  // Apply saved per-swipe expressions whenever the prop changes (e.g. user swipes).
  // This runs independently of the agent store so swiping always updates the sprite.
  const prevSpriteExpressionsRef = useRef(spriteExpressions);
  useEffect(() => {
    if (spriteExpressions === prevSpriteExpressionsRef.current) return;
    prevSpriteExpressionsRef.current = spriteExpressions;
    if (!spriteExpressions || Object.keys(spriteExpressions).length === 0) return;
    setStates((prev) => {
      const next = { ...prev };
      for (const [id, expr] of Object.entries(spriteExpressions)) {
        // Only update if the expression actually changed to avoid unnecessary re-renders
        if (next[id]?.expression !== expr) {
          next[id] = { expression: expr, transition: "crossfade" };
        }
      }
      return next;
    });
  }, [spriteExpressions]);

  // Fallback: keyword-based detection when no agent result.
  useEffect(() => {
    // Same reason as the agent effect: keyword detection produces facial expressions, not full-body poses.
    if (fullBodyOnly) return;
    if (!messages?.length) return;
    // Only skip fallback when the current agent result has already been applied
    if (expressionResult?.success && expressionResult === appliedResultRef.current) return;

    const newStates: Record<string, CharacterExpressionState> = {};

    for (const id of characterIds) {
      const saved = spriteExpressions?.[id];
      if (saved) {
        newStates[id] = { expression: saved, transition: "none" };
      }
    }

    const recentAssistant = messages.filter((m) => m.role === "assistant").slice(-5);
    for (const msg of recentAssistant) {
      if (msg.characterId && !newStates[msg.characterId]) {
        const expr = detectExpression(msg.content);
        newStates[msg.characterId] = { expression: expr, transition: "crossfade" };
      }
    }

    for (const id of characterIds) {
      if (!newStates[id]) {
        const lastMsg = [...messages].reverse().find((m) => m.characterId === id && m.role === "assistant");
        const expr = lastMsg ? detectExpression(lastMsg.content) : "neutral";
        newStates[id] = { expression: expr, transition: "crossfade" };
      }
    }

    setStates(newStates);
  }, [messages, characterIds, expressionResult, spriteExpressions, fullBodyOnly]);

  const visibleChars = characterIds.slice(0, 3);
  const resolvedPlacements = useMemo(() => {
    const placements: Record<string, SpritePlacement> = {};
    for (const [index, charId] of visibleChars.entries()) {
      placements[charId] = clampSpritePlacement(
        spritePlacements?.[charId] ?? getDefaultSpritePlacement(index, visibleChars.length, side),
      );
    }
    return placements;
  }, [side, spritePlacements, visibleChars]);

  if (visibleChars.length === 0) return null;

  return (
    <div
      ref={stageRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${fullBodyOnly ? "z-[5]" : "z-[15]"}`}
    >
      {visibleChars.map((charId, index) => (
        <CharacterSprite
          key={charId}
          characterId={charId}
          expression={states[charId]?.expression ?? "neutral"}
          transition={states[charId]?.transition ?? "crossfade"}
          placement={resolvedPlacements[charId]!}
          spriteCount={visibleChars.length}
          editing={editing}
          zIndex={10 + index}
          stageRef={stageRef}
          onPlacementChange={onPlacementChange}
          fullBodyOnly={fullBodyOnly}
          spriteScale={spriteScale}
        />
      ))}

      {editing && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[30] -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[0.625rem] font-medium text-white/80 shadow-lg backdrop-blur-md">
          Drag sprites to reposition them. Changes save automatically.
        </div>
      )}
    </div>
  );
}

// ── Transition animation variants ──────────────────────────

interface SpriteVariant {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

const CROSSFADE: SpriteVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.4, ease: "easeInOut" } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

const BOUNCE: SpriteVariant = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: [0.85, 1.08, 0.97, 1], transition: { duration: 0.5, times: [0, 0.4, 0.7, 1] } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.25 } },
};

const SHAKE: SpriteVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1, x: [0, -6, 6, -4, 4, -2, 2, 0], transition: { duration: 0.45, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const HOP: SpriteVariant = {
  initial: { opacity: 0, y: 0 },
  animate: { opacity: 1, y: [0, -18, 0, -8, 0], transition: { duration: 0.5, times: [0, 0.3, 0.55, 0.75, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const NONE_VARIANT: SpriteVariant = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

const TRANSITION_VARIANTS: Record<Transition, SpriteVariant> = {
  crossfade: CROSSFADE,
  bounce: BOUNCE,
  shake: SHAKE,
  hop: HOP,
  none: NONE_VARIANT,
};

// ── Character Sprite ───────────────────────────────────────

function CharacterSprite({
  characterId,
  expression,
  transition,
  placement,
  spriteCount,
  editing,
  zIndex,
  stageRef,
  onPlacementChange,
  fullBodyOnly = false,
  spriteScale = 1,
}: {
  characterId: string;
  expression: string;
  transition: Transition;
  placement: SpritePlacement;
  spriteCount: number;
  editing: boolean;
  zIndex: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onPlacementChange?: (characterId: string, placement: SpritePlacement) => void;
  fullBodyOnly?: boolean;
  spriteScale?: number;
}) {
  const { data: sprites } = useCharacterSprites(characterId);
  const prevExpressionRef = useRef(expression);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: SpritePlacement;
  } | null>(null);
  const [activeTransition, setActiveTransition] = useState<Transition>(transition);
  const [currentPlacement, setCurrentPlacement] = useState<SpritePlacement>(() => clampSpritePlacement(placement));
  const currentPlacementRef = useRef(currentPlacement);
  const [isDragging, setIsDragging] = useState(false);

  const spriteUrl = useMemo(() => {
    if (!sprites || !(sprites as SpriteInfo[]).length) return null;
    let spriteList = sprites as SpriteInfo[];

    // When fullBodyOnly is set, restrict to full-body sprites (full_ prefix)
    if (fullBodyOnly) {
      spriteList = spriteList.filter((s) => s.expression.toLowerCase().startsWith("full_"));
      if (spriteList.length === 0) return null;
    }

    const exprLower = expression.toLowerCase();
    const exact = spriteList.find((s) => s.expression.toLowerCase() === exprLower);
    if (exact) return exact.url;
    // Substring / contains fallback (case-insensitive)
    const partial = spriteList.find(
      (s) => s.expression.toLowerCase().includes(exprLower) || exprLower.includes(s.expression.toLowerCase()),
    );
    if (partial) return partial.url;
    const neutral = spriteList.find((s) => {
      const lower = s.expression.toLowerCase();
      return lower === "neutral" || lower === "default" || lower === "full_idle" || lower === "idle";
    });
    if (neutral) return neutral.url;
    return spriteList[0]?.url ?? null;
  }, [sprites, expression, fullBodyOnly]);

  const sizeClass =
    spriteCount >= 3
      ? "max-h-[min(68vh,calc(50vh*var(--game-sprite-scale)))] max-w-[min(82vw,calc(55vw*var(--game-sprite-scale)))] md:max-h-[min(70vh,calc(44vh*var(--game-sprite-scale)))] md:max-w-[min(38vw,calc(26vw*var(--game-sprite-scale)))]"
      : spriteCount === 2
        ? "max-h-[min(74vh,calc(55vh*var(--game-sprite-scale)))] max-w-[min(86vw,calc(60vw*var(--game-sprite-scale)))] md:max-h-[min(76vh,calc(52vh*var(--game-sprite-scale)))] md:max-w-[min(46vw,calc(32vw*var(--game-sprite-scale)))]"
        : "max-h-[min(82vh,calc(65vh*var(--game-sprite-scale)))] max-w-[min(92vw,calc(80vw*var(--game-sprite-scale)))] md:max-h-[min(78vh,calc(60vh*var(--game-sprite-scale)))] md:max-w-[min(58vw,calc(38vw*var(--game-sprite-scale)))]";
  const spriteScaleStyle = useMemo<CSSProperties>(
    () => ({ "--game-sprite-scale": Math.max(0.75, Math.min(1.75, spriteScale)) }) as CSSProperties,
    [spriteScale],
  );

  useEffect(() => {
    currentPlacementRef.current = currentPlacement;
  }, [currentPlacement]);

  useEffect(() => {
    if (!isDragging) {
      setCurrentPlacement(clampSpritePlacement(placement));
    }
  }, [isDragging, placement]);

  useEffect(() => {
    if (prevExpressionRef.current !== expression) {
      setActiveTransition(transition);
      prevExpressionRef.current = expression;
    }
  }, [expression, transition]);

  useEffect(() => {
    if (!editing && dragRef.current) {
      dragRef.current = null;
      setIsDragging(false);
    }
  }, [editing]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragRef.current;
      const stage = stageRef.current;
      if (!dragState || !stage || event.pointerId !== dragState.pointerId) return;

      const dx = ((event.clientX - dragState.startX) / Math.max(stage.clientWidth, 1)) * 100;
      const dy = ((event.clientY - dragState.startY) / Math.max(stage.clientHeight, 1)) * 100;
      setCurrentPlacement(clampSpritePlacement({ x: dragState.origin.x + dx, y: dragState.origin.y + dy }));
    };

    const finishDrag = (event: PointerEvent) => {
      const dragState = dragRef.current;
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      onPlacementChange?.(characterId, currentPlacementRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [characterId, isDragging, onPlacementChange, stageRef]);

  if (!spriteUrl) return null;

  const variant = TRANSITION_VARIANTS[activeTransition];

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-full select-none ${editing ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{
        left: `${currentPlacement.x}%`,
        top: `${currentPlacement.y}%`,
        zIndex: isDragging ? 40 : zIndex,
        touchAction: editing ? "none" : "auto",
      }}
      onPointerDown={(event) => {
        if (!editing) return;
        if (event.button !== 0 && event.pointerType !== "touch") return;
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          origin: currentPlacementRef.current,
        };
        setIsDragging(true);
      }}
    >
      {editing && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-[2] -translate-x-1/2 -translate-y-full rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-wide text-white/75 shadow-md">
          {isDragging ? "Release to Save" : "Drag to Move"}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.img
          key={`${characterId}-${expression}`}
          src={spriteUrl}
          alt={`${expression} sprite`}
          className={`${sizeClass} w-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)] ${editing ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={spriteScaleStyle}
          draggable={false}
          initial={variant.initial}
          animate={variant.animate}
          exit={variant.exit}
        />
      </AnimatePresence>
    </div>
  );
}
