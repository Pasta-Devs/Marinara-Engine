// ──────────────────────────────────────────────
// Sprite Overlay — VN-style character sprites in chat
// Supports persisted free placement to avoid group-chat overlap.
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react";
import { motion, AnimatePresence, type TargetAndTransition } from "framer-motion";
import { Check } from "lucide-react";
import type { SpritePlacement, SpriteSide } from "@marinara-engine/shared";
import { useCharacterSprites, type SpriteInfo } from "../../hooks/use-characters";
import { normalizeSpriteExpressionKey, resolveSpriteExpression } from "../../lib/sprite-expression-match";
import { useAgentStore } from "../../stores/agent.store";
import {
  SPRITE_DISPLAY_OPACITY_MAX,
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_SCALE_MAX,
  SPRITE_DISPLAY_SCALE_MIN,
  isFullBodySpriteExpression,
  normalizeSpriteDisplayModes,
  type SpriteDisplayMode,
} from "./sprite-display-modes";
import { clampSpritePlacement, getDefaultSpritePlacement, type SpritePlacementMap } from "./sprite-placement";

interface SpriteOverlayProps {
  /** IDs of characters with sprites enabled in this chat */
  characterIds: string[];
  /** The last N messages to detect expressions from */
  messages: Array<{ role: string; characterId?: string | null; content: string }>;
  /** Which side the sidebar / default sprite layout prefers */
  side: SpriteSide | "center";
  /** Which sprite file families roleplay mode should resolve against. */
  spriteDisplayModes?: SpriteDisplayMode[];
  /** Saved expressions per character (from chat metadata) */
  spriteExpressions?: Record<string, string>;
  /** Saved freeform placements per character (from chat metadata) */
  spritePlacements?: SpritePlacementMap;
  /** Whether the overlay is currently in drag-to-arrange mode */
  editing?: boolean;
  /** Called when a sprite is moved (to persist it) */
  onPlacementChange?: (placementKey: string, placement: SpritePlacement) => void;
  /** Called when the user confirms placement from an individual sprite control. */
  onFinishPlacement?: () => void;
  /** When true, only show full-body sprites (full_ prefix) and hide characters without any */
  fullBodyOnly?: boolean;
  /** Multiplier for sprite size. Game mode passes this for full-body sprites. */
  spriteScale?: number;
  /** Multiplier for roleplay expression sprite size. Falls back to spriteScale. */
  expressionSpriteScale?: number;
  /** Multiplier for roleplay full-body sprite size. Falls back to spriteScale. */
  fullBodySpriteScale?: number;
  /** Opacity multiplier for visible sprites. */
  spriteOpacity?: number;
  /** Opacity multiplier for roleplay expression sprites. Falls back to spriteOpacity. */
  expressionSpriteOpacity?: number;
  /** Opacity multiplier for roleplay full-body sprites. Falls back to spriteOpacity. */
  fullBodySpriteOpacity?: number;
}

type Transition = "crossfade" | "bounce" | "shake" | "hop" | "none";

interface CharacterExpressionState {
  expression: string;
  transition: Transition;
}

type SpriteRenderMode = "expressions" | "full-body";

interface VisibleSpriteEntry {
  characterId: string;
  placementKey: string;
  renderMode: SpriteRenderMode;
  placement: SpritePlacement;
  zIndex: number;
}

function getSpritePlacementKey(characterId: string, renderMode: SpriteRenderMode) {
  return `${characterId}:${renderMode}`;
}

function hasTokenContainmentMatch(requested: string, candidate: string): boolean {
  if (requested.length < 3 || candidate.length < 3) return false;
  const requestedTokens = requested.split("_").filter(Boolean);
  const candidateTokens = candidate.split("_").filter(Boolean);
  return requestedTokens.includes(candidate) || candidateTokens.includes(requested);
}

function offsetPairedSpritePlacement(
  placement: SpritePlacement,
  renderMode: SpriteRenderMode,
  side: SpriteSide | "center",
): SpritePlacement {
  const fullBodyOffset = side === "right" ? 10 : -10;
  const expressionOffset = side === "right" ? -12 : 12;
  return clampSpritePlacement({
    x: placement.x + (renderMode === "full-body" ? fullBodyOffset : expressionOffset),
    y: placement.y,
  });
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
  spriteDisplayModes,
  spriteExpressions,
  spritePlacements,
  editing = false,
  onPlacementChange,
  onFinishPlacement,
  fullBodyOnly = false,
  spriteScale = 1,
  expressionSpriteScale,
  fullBodySpriteScale,
  spriteOpacity = 1,
  expressionSpriteOpacity,
  fullBodySpriteOpacity,
}: SpriteOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const resolvedSpriteDisplayModes = useMemo(
    () => normalizeSpriteDisplayModes(spriteDisplayModes),
    [spriteDisplayModes],
  );

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

  // When agent result arrives, prefer it over keyword detection.
  // Persistence happens server-side after validation; this layer only reflects the live result.
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
        return;
      }
    }
  }, [expressionResult, fullBodyOnly]);

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

  const visibleChars = useMemo(() => characterIds.slice(0, 3), [characterIds]);
  const renderModes = useMemo<SpriteRenderMode[]>(() => {
    if (fullBodyOnly) return ["full-body"];
    const modes: SpriteRenderMode[] = [];
    if (resolvedSpriteDisplayModes.includes("full-body")) modes.push("full-body");
    if (resolvedSpriteDisplayModes.includes("expressions")) modes.push("expressions");
    return modes;
  }, [fullBodyOnly, resolvedSpriteDisplayModes]);
  const visibleSpriteEntries = useMemo<VisibleSpriteEntry[]>(() => {
    const entries: VisibleSpriteEntry[] = [];
    const hasPairedSprites = renderModes.length > 1;

    for (const [index, charId] of visibleChars.entries()) {
      const basePlacement = clampSpritePlacement(
        spritePlacements?.[charId] ?? getDefaultSpritePlacement(index, visibleChars.length, side),
      );

      for (const [modeIndex, renderMode] of renderModes.entries()) {
        const placementKey = getSpritePlacementKey(charId, renderMode);
        const fallbackPlacement = hasPairedSprites
          ? offsetPairedSpritePlacement(basePlacement, renderMode, side)
          : basePlacement;
        entries.push({
          characterId: charId,
          placementKey,
          renderMode,
          placement: clampSpritePlacement(spritePlacements?.[placementKey] ?? fallbackPlacement),
          zIndex: 10 + index * 3 + modeIndex,
        });
      }
    }

    return entries;
  }, [renderModes, side, spritePlacements, visibleChars]);

  if (visibleSpriteEntries.length === 0) return null;

  const stageZIndexClass = editing ? "z-[35]" : fullBodyOnly ? "z-[5]" : "z-[5] md:z-[15]";
  const resolvedExpressionSpriteScale = expressionSpriteScale ?? spriteScale;
  const resolvedFullBodySpriteScale = fullBodySpriteScale ?? spriteScale;
  const resolvedExpressionSpriteOpacity = expressionSpriteOpacity ?? spriteOpacity;
  const resolvedFullBodySpriteOpacity = fullBodySpriteOpacity ?? spriteOpacity;

  return (
    <div ref={stageRef} className={`pointer-events-none absolute inset-0 overflow-hidden ${stageZIndexClass}`}>
      {visibleSpriteEntries.map((entry) => (
        <CharacterSprite
          key={entry.placementKey}
          characterId={entry.characterId}
          placementKey={entry.placementKey}
          renderMode={entry.renderMode}
          expression={states[entry.characterId]?.expression ?? "neutral"}
          transition={states[entry.characterId]?.transition ?? "crossfade"}
          placement={entry.placement}
          spriteCount={visibleChars.length}
          editing={editing}
          zIndex={entry.zIndex}
          stageRef={stageRef}
          onPlacementChange={onPlacementChange}
          onFinishPlacement={onFinishPlacement}
          fullBodyOnly={fullBodyOnly}
          spriteDisplayModes={[entry.renderMode]}
          spriteScale={entry.renderMode === "full-body" ? resolvedFullBodySpriteScale : resolvedExpressionSpriteScale}
          spriteOpacity={
            entry.renderMode === "full-body" ? resolvedFullBodySpriteOpacity : resolvedExpressionSpriteOpacity
          }
        />
      ))}

      {editing && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[30] -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[0.625rem] font-medium text-white/80 shadow-lg backdrop-blur-md">
          Drag sprites to reposition them. Use the check above a sprite to finish.
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
  placementKey,
  renderMode,
  expression,
  transition,
  placement,
  spriteCount,
  editing,
  zIndex,
  stageRef,
  onPlacementChange,
  onFinishPlacement,
  fullBodyOnly = false,
  spriteDisplayModes,
  spriteScale = 1,
  spriteOpacity = 1,
}: {
  characterId: string;
  placementKey: string;
  renderMode: SpriteRenderMode;
  expression: string;
  transition: Transition;
  placement: SpritePlacement;
  spriteCount: number;
  editing: boolean;
  zIndex: number;
  stageRef: RefObject<HTMLDivElement | null>;
  onPlacementChange?: (placementKey: string, placement: SpritePlacement) => void;
  onFinishPlacement?: () => void;
  fullBodyOnly?: boolean;
  spriteDisplayModes: SpriteDisplayMode[];
  spriteScale?: number;
  spriteOpacity?: number;
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
    const exprLower = expression.toLowerCase();
    const exprKey = normalizeSpriteExpressionKey(expression);
    const allSprites = sprites as SpriteInfo[];
    const allowExpressions = !fullBodyOnly && spriteDisplayModes.includes("expressions");
    const allowFullBody = fullBodyOnly || spriteDisplayModes.includes("full-body");
    const expressionSprites = allowExpressions
      ? allSprites.filter((sprite) => !isFullBodySpriteExpression(sprite.expression))
      : [];
    const fullBodySprites = allowFullBody
      ? allSprites.filter((sprite) => isFullBodySpriteExpression(sprite.expression))
      : [];
    const spritePools = [fullBodySprites, expressionSprites];

    const fullBodyBaseExpression = (value: string) => (value.startsWith("full_") ? value.slice(5) : value);
    const findMatchingSprite = (predicate: (spriteExpression: string) => boolean) => {
      for (const spriteList of spritePools) {
        const match = spriteList.find((sprite) => predicate(sprite.expression.toLowerCase()));
        if (match) return match.url;
      }
      return null;
    };

    const exact = findMatchingSprite((spriteExpression) => {
      return spriteExpression === exprLower || fullBodyBaseExpression(spriteExpression) === exprLower;
    });
    if (exact) return exact;

    const partial = findMatchingSprite((spriteExpression) => {
      const spriteKey = normalizeSpriteExpressionKey(spriteExpression);
      const baseExpression = fullBodyBaseExpression(spriteKey);
      return hasTokenContainmentMatch(exprKey, spriteKey) || hasTokenContainmentMatch(exprKey, baseExpression);
    });
    if (partial) return partial;

    for (const spriteList of spritePools) {
      const semantic = resolveSpriteExpression(spriteList, expression);
      if (semantic) return semantic.url;
    }

    for (const spriteList of spritePools) {
      const first = spriteList[0];
      if (first) return first.url;
    }

    return null;
  }, [sprites, expression, fullBodyOnly, spriteDisplayModes]);

  const standardSizeClass =
    spriteCount >= 3
      ? "h-[calc(50vh*var(--game-sprite-scale))] max-w-[calc(55vw*var(--game-sprite-scale))] md:h-[calc(44vh*var(--game-sprite-scale))] md:max-w-[calc(26vw*var(--game-sprite-scale))]"
      : spriteCount === 2
        ? "h-[calc(55vh*var(--game-sprite-scale))] max-w-[calc(60vw*var(--game-sprite-scale))] md:h-[calc(52vh*var(--game-sprite-scale))] md:max-w-[calc(32vw*var(--game-sprite-scale))]"
        : "h-[calc(65vh*var(--game-sprite-scale))] max-w-[calc(80vw*var(--game-sprite-scale))] md:h-[calc(60vh*var(--game-sprite-scale))] md:max-w-[calc(38vw*var(--game-sprite-scale))]";
  const fullBodySizeClass =
    spriteCount >= 3
      ? "h-[calc(54vh*var(--game-sprite-scale))] max-w-[calc(58vw*var(--game-sprite-scale))] md:h-[calc(50vh*var(--game-sprite-scale))] md:max-w-[calc(28vw*var(--game-sprite-scale))]"
      : spriteCount === 2
        ? "h-[calc(60vh*var(--game-sprite-scale))] max-w-[calc(64vw*var(--game-sprite-scale))] md:h-[calc(56vh*var(--game-sprite-scale))] md:max-w-[calc(34vw*var(--game-sprite-scale))]"
        : "h-[calc(64vh*var(--game-sprite-scale))] max-w-[calc(86vw*var(--game-sprite-scale))] md:h-[calc(62vh*var(--game-sprite-scale))] md:max-w-[calc(44vw*var(--game-sprite-scale))]";
  const fullBodyLayout =
    fullBodyOnly || (spriteDisplayModes.includes("full-body") && !spriteDisplayModes.includes("expressions"));
  const sizeClass = fullBodyLayout ? fullBodySizeClass : standardSizeClass;
  const spriteScaleStyle = useMemo<CSSProperties>(
    () =>
      ({
        "--game-sprite-scale": Math.max(SPRITE_DISPLAY_SCALE_MIN, Math.min(SPRITE_DISPLAY_SCALE_MAX, spriteScale)),
      }) as CSSProperties,
    [spriteScale],
  );
  const resolvedSpriteOpacity = Math.max(
    SPRITE_DISPLAY_OPACITY_MIN,
    Math.min(SPRITE_DISPLAY_OPACITY_MAX, spriteOpacity),
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
      onPlacementChange?.(placementKey, currentPlacementRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [isDragging, onPlacementChange, placementKey, stageRef]);

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
        <div className="absolute left-1/2 top-0 z-[2] flex -translate-x-1/2 -translate-y-[calc(100%+0.35rem)] items-center gap-1">
          <button
            type="button"
            title="Finish placing sprite"
            aria-label="Finish placing sprite"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onPlacementChange?.(placementKey, currentPlacementRef.current);
              onFinishPlacement?.();
            }}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text-hover)] shadow-lg backdrop-blur-md transition-colors hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
          >
            <Check size="0.75rem" strokeWidth={2.4} />
          </button>
          <div className="pointer-events-none rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[0.5625rem] font-semibold uppercase tracking-wide text-white/75 shadow-md">
            {isDragging ? "Release to Save" : "Drag to Move"}
          </div>
        </div>
      )}

      <div style={{ opacity: resolvedSpriteOpacity }}>
        <AnimatePresence mode="wait">
          <motion.img
            key={`${placementKey}-${expression}`}
            src={spriteUrl}
            alt={`${renderMode === "full-body" ? "full-body" : "expression"} ${expression} sprite`}
            className={`${sizeClass} w-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)] ${editing ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={spriteScaleStyle}
            draggable={false}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
