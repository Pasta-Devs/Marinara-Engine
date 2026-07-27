// ──────────────────────────────────────────────
// Game: Tactical (grid) Combat UI
//
// A Fire Emblem / Final Fantasy Tactics style grid battle that runs entirely
// off the shared pure engine (`packages/shared/src/features/tactical-combat`).
// The client renders + animates; the SERVER resolves actions (start + action
// endpoints) so the seeded RNG stays authoritative. Client-side we only use the
// engine's PURE read helpers (movement/target/forecast/summary) for highlights
// and previews — never to mutate battle state.
//
// Visual language mirrors GameCombatUI where practical: HP/MP bars, floating
// damage numbers, crit flashes, sprite/emoji/initial tokens, SFX hooks, and the
// same `onCombatEnd(outcome, CombatSummary)` contract that drives GM narration.
//
// The root is TRANSLUCENT over GameSurface's crossfaded scene background (like
// classic GameCombatUI): a dark scrim + radial vignette let the scene art show
// through while the grid stays readable. Terrain palettes are themed by the
// authoritative `state.environment` so restored snapshots keep their look.
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import {
  Sword,
  Sparkles,
  Shield,
  Backpack,
  Hourglass,
  Wind,
  Footprints,
  ScrollText,
  Crown,
  Skull,
  X,
  Trophy,
  SkullIcon,
  Flag,
  Eye,
  EyeOff,
  Heart,
  Droplets,
  Crosshair,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn, generateClientId } from "../../lib/utils";
import { ApiError } from "../../lib/api-client";
import { audioManager } from "../../lib/game-audio";
import { useGameAssetManifest } from "../../hooks/use-game-assets";
import { useActiveCombatSession, useTacticalCombatStart, useTacticalCombatAction } from "../../hooks/use-game";
import { useUpdateChatMetadata } from "../../hooks/use-chats";
import {
  TERRAIN_DATA,
  CLASS_PROFILES,
  getMovementRange,
  getTargetsInRange,
  forecastAttack,
  forecastSkill,
  hasLineOfSight,
  buildTacticalSummary,
  type Combatant,
  type CombatSummary,
  type CombatSkill,
  type CombatItemEffect,
  type CombatObjectiveState,
  type TacticalCombatState,
  type TacticalUnit,
  type TacticalAction,
  type TacticalEvent,
  type TacticalCoord,
  type TacticalTerrain,
  type TacticalClass,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";

// ── Props ──

interface TacticalCombatUIProps {
  chatId: string;
  /** Player party combatants (same array classic GameCombatUI receives). */
  party: Combatant[];
  /** Enemy combatants. */
  enemies: Combatant[];
  /** Difficulty label from the game setup (engine normalizes unknowns to "normal"). */
  difficulty?: string;
  /**
   * Scene-derived battlefield environment (e.g. "forest", "snow", "spaceship").
   * Drives the initial terrain theming; the authoritative palette source once
   * the battle starts is `state.environment` (so restored snapshots keep theme).
   */
  environment?: string | null;
  /** Scene-derived starting formation (e.g. "ambush", "surrounded"). Passed to the start endpoint. */
  formation?: string | null;
  /** Restore an in-progress battle after a refresh (from chat metadata snapshot). */
  initialState?: TacticalCombatState | null;
  inventoryItems?: Array<{ name: string; quantity: number }>;
  combatItemEffects?: CombatItemEffect[];
  combatObjectives?: CombatObjectiveState[];
  combatMechanics?: import("@marinara-engine/shared").CombatMechanic[];
  onInventoryItemUsed?: (itemName: string) => void | Promise<void>;
  onInventoryChange?: (items: Array<{ name: string; quantity: number }>) => void;
  /** The party combatant that is the player's own persona (gets the crown marker). */
  playerCombatantId?: string | null;
  /** Called when combat ends. Same contract as classic GameCombatUI → drives GM narration. */
  onCombatEnd: (outcome: "victory" | "defeat" | "flee", summary: CombatSummary) => void;
  /** Lets the GM adjudicate a freeform maneuver (parity with classic, currently unused UI-side). */
  onCustomInstruction?: (instruction: string) => void;
}

// ── SFX (reuse classic combat sound tags) ──

const SFX = {
  start: "sfx:combat:sword-unsheathe",
  select: "sfx:ui:menu-confirm",
  hover: "sfx:ui:menu-hover",
  attack: "sfx:combat:sword-swing",
  crit: "sfx:combat:sword-swing-2",
  miss: "sfx:combat:sword-swing-3",
  hit: "sfx:combat:spell-hit",
  magic: "sfx:combat:magic-cast",
  defend: "sfx:combat:chainmail",
  item: "sfx:ui:potion",
  victory: "sfx:ui:coin-pickup",
  defeat: "sfx:ui:menu-cancel",
} as const;

// ── Environment terrain palettes ──
//
// Keyed by plain string so the file compiles regardless of whether the shared
// `TacticalEnvironment` union has landed yet. Every entry is a full terrain map;
// unknown environments fall back to "default" (the original colours). The
// resolved palette comes from the AUTHORITATIVE `state.environment` first, then
// the `environment` prop, then "default".

const TERRAIN_PALETTES: Record<string, Record<TacticalTerrain, string>> = {
  default: {
    plains: "#40714a",
    forest: "#274a30",
    mountain: "#5c5142",
    ruin: "#4a4f5c",
    water: "#1f4f78",
    wall: "#23232b",
  },
  forest: {
    plains: "#3a6b3f",
    forest: "#1f3f26",
    mountain: "#4f4a3a",
    ruin: "#454b45",
    water: "#215a6b",
    wall: "#26241c",
  },
  plains: {
    plains: "#4e8a4f",
    forest: "#2f5c34",
    mountain: "#6a5c44",
    ruin: "#565b5f",
    water: "#2a6187",
    wall: "#2a2a2a",
  },
  mountains: {
    plains: "#5a6650",
    forest: "#37472f",
    mountain: "#6b5f4c",
    ruin: "#575a5f",
    water: "#2b5570",
    wall: "#312e28",
  },
  snow: {
    plains: "#cdd8e3",
    forest: "#8fa8a0",
    mountain: "#aeb9c6",
    ruin: "#9aa4b2",
    water: "#7fb8d6",
    wall: "#7d8794",
  },
  desert: {
    plains: "#c9a55f",
    forest: "#8a7a3e",
    mountain: "#a8894f",
    ruin: "#b09a6a",
    water: "#3f8fa0",
    wall: "#6e5a38",
  },
  wasteland: {
    plains: "#8a7a53",
    forest: "#6a6136",
    mountain: "#7d6b4a",
    ruin: "#7a6f5c",
    water: "#4a6b63",
    wall: "#4d4436",
  },
  volcanic: {
    plains: "#5a3a34",
    forest: "#4a3128",
    mountain: "#6e3d2c",
    ruin: "#5c453e",
    water: "#b1441f",
    wall: "#2a1c18",
  },
  water: {
    plains: "#3d7a6a",
    forest: "#245c4c",
    mountain: "#4a6157",
    ruin: "#456058",
    water: "#1c6f8f",
    wall: "#213a3c",
  },
  swamp: {
    plains: "#4a5f3a",
    forest: "#2f4529",
    mountain: "#4e5240",
    ruin: "#495046",
    water: "#3a5f4a",
    wall: "#25302a",
  },
  cave: {
    plains: "#3e3a44",
    forest: "#33403a",
    mountain: "#4a4148",
    ruin: "#454049",
    water: "#2a4a5c",
    wall: "#1b1920",
  },
  dungeon: {
    plains: "#3d3a42",
    forest: "#34413a",
    mountain: "#4a4550",
    ruin: "#4c4652",
    water: "#274a5c",
    wall: "#1a1820",
  },
  ruins: {
    plains: "#5a5648",
    forest: "#3f4a36",
    mountain: "#5e564a",
    ruin: "#63615a",
    water: "#3a5a68",
    wall: "#332f28",
  },
  city: {
    plains: "#5c5f66",
    forest: "#3f5240",
    mountain: "#5e5a54",
    ruin: "#6a6a72",
    water: "#3a5c7a",
    wall: "#33343c",
  },
  castle: {
    plains: "#5a5850",
    forest: "#3c4a38",
    mountain: "#615a4c",
    ruin: "#66625a",
    water: "#385a72",
    wall: "#302d2a",
  },
  mansion: {
    plains: "#5b504a",
    forest: "#3f4a3a",
    mountain: "#5e544a",
    ruin: "#665c52",
    water: "#3f5a6a",
    wall: "#332b26",
  },
  spaceship: {
    plains: "#3a4550",
    forest: "#31424c",
    mountain: "#465562",
    ruin: "#4a5763",
    water: "#2f6a86",
    wall: "#1e262e",
  },
};

// ── Terrain icons ──
// The painted tile textures carry the base terrain look, so only
// environment-specific flavour overrides render as icons.
const TERRAIN_ICON_OVERRIDES: Record<string, Partial<Record<TacticalTerrain, string>>> = {
  desert: { forest: "🌵", mountain: "🏜️" },
  wasteland: { forest: "🌵" },
  volcanic: { mountain: "🌋", water: "🌋" },
  snow: { forest: "🌲", mountain: "🏔️" },
  swamp: { forest: "🌿", water: "💧" },
  cave: { forest: "", mountain: "🪨" },
  dungeon: { forest: "", mountain: "🪨" },
  spaceship: { forest: "", mountain: "", ruin: "🛰️", water: "⚡" },
  city: { forest: "🌳", ruin: "🏚️" },
  castle: { ruin: "🏰" },
  mansion: { ruin: "🏛️" },
};

function resolveTerrainIcon(env: string | undefined, terrain: TacticalTerrain): string {
  return (env ? TERRAIN_ICON_OVERRIDES[env]?.[terrain] : undefined) ?? "";
}

// Per-tile depth: raised terrain (mountain/wall) reads embossed; the rest recessed.
function tileShadow(terrain: TacticalTerrain): string {
  if (terrain === "mountain" || terrain === "wall") {
    return "inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.45)";
  }
  return "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -3px 5px rgba(0,0,0,0.35)";
}

// ~0.88 alpha suffix so terrain colours stay readable but the scene shows through.
const TILE_ALPHA = "e0";

// Painted top-down tile textures (packages/client/public/tactical/). The palette
// colour is layered over them as a tint so environment themes still recolour the field.
const TILE_TEXTURES: Record<TacticalTerrain, string> = {
  plains: "/tactical/plains.webp",
  forest: "/tactical/forest.webp",
  mountain: "/tactical/mountain.webp",
  ruin: "/tactical/ruin.webp",
  water: "/tactical/water.webp",
  wall: "/tactical/wall.webp",
};

// Tint strength over the texture: a light wash for the default look, stronger
// when an environment theme needs to recolour the painted art (e.g. snow, volcanic).
const TILE_TINT_ALPHA = "3d";
const TILE_TINT_ALPHA_THEMED = "73";

// ── Animation timing (per event kind) ──

const EVENT_DELAY: Record<string, number> = {
  move: 340,
  phase: 950,
  damage: 640,
  crit: 820,
  counter: 640,
  heal: 640,
  miss: 560,
  skill: 500,
  item: 560,
  status: 480,
  terrain: 400,
  defeat: 620,
  victory: 700,
  "defeat-end": 700,
  flee: 700,
};

// ── Sprite shape detection (mirrors GameCombatUI.resolveSpriteKind) ──

type SpriteKind = { kind: "url"; value: string } | { kind: "emoji"; value: string } | { kind: "none" };

function resolveSprite(sprite: string | null | undefined): SpriteKind {
  if (!sprite) return { kind: "none" };
  const trimmed = sprite.trim();
  if (!trimmed) return { kind: "none" };
  if (/^(https?:|\/|data:|blob:)/i.test(trimmed)) return { kind: "url", value: trimmed };
  if (trimmed.length <= 12 && /\p{Extended_Pictographic}/u.test(trimmed)) return { kind: "emoji", value: trimmed };
  return { kind: "none" };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic color ring from a unit id, so companions stay visually distinct.
function ringColorFor(id: string, side: "party" | "enemy"): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = side === "party" ? 200 + (hash % 60) : 350 + (hash % 40);
  return `hsl(${hue % 360} 70% 55%)`;
}

// Read the authoritative environment off state without depending on the shared
// type having the field yet (the engine agent adds `environment?: TacticalEnvironment`).
function environmentOf(state: TacticalCombatState | null): string | undefined {
  return (state as { environment?: string } | null)?.environment ?? undefined;
}

// ── Class helpers ──
//
// R3-A adds `TacticalClass`, `CLASS_PROFILES`, and `TacticalUnit.unitClass?`. Old
// snapshots predate `unitClass`, so every read goes through `unitClassOf`, which
// falls back to "fighter" for absent/invalid values.

const CLASS_ICONS: Record<TacticalClass, typeof Sword> = {
  fighter: Sword,
  knight: Shield,
  rogue: Wind,
  archer: Crosshair,
  mage: Sparkles,
  healer: Heart,
};

function unitClassOf(unit: TacticalUnit): TacticalClass {
  const uc = (unit as { unitClass?: string }).unitClass;
  return uc && Object.prototype.hasOwnProperty.call(CLASS_PROFILES, uc) ? (uc as TacticalClass) : "fighter";
}

// "Rng 1" for melee, "Rng 2-3" for spread ranges (min===max collapses to one number).
function rangeText(range: { min: number; max: number }): string {
  return range.min === range.max ? `Rng ${range.min}` : `Rng ${range.min}-${range.max}`;
}

// ── Transient render state (positions + hp during animation) ──

interface RenderUnit {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

function renderMapFromState(state: TacticalCombatState): Map<string, RenderUnit> {
  const m = new Map<string, RenderUnit>();
  for (const u of state.units) m.set(u.id, { id: u.id, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp });
  return m;
}

interface FloatingPopup {
  id: number;
  // Grid coords captured at spawn time — a killing blow removes the target's
  // token from the board mid-playback, so popups must not depend on it.
  x: number;
  y: number;
  text: string;
  tone: "damage" | "crit" | "heal" | "miss" | "status";
}

interface PhaseBanner {
  text: string;
  tone: "player" | "enemy";
}

// A staged clone: the selected unit teleported to `to` so pure helpers
// (forecast/targets) reflect the post-move position without mutating real state.
function withStagedMove(state: TacticalCombatState, unitId: string, to: TacticalCoord | null): TacticalCombatState {
  if (!to) return state;
  const units = state.units.map((u) => (u.id === unitId ? { ...u, x: to.x, y: to.y } : u));
  return { ...state, units };
}

type UiMode =
  | { kind: "idle" }
  | { kind: "unit"; unitId: string }
  | { kind: "skills"; unitId: string }
  | { kind: "items"; unitId: string }
  | { kind: "maneuver"; unitId: string }
  | { kind: "target"; unitId: string; action: "attack" | "skill" | "item"; skill?: CombatSkill; itemName?: string };

const GAMEPAD_AXIS_THRESHOLD = 0.55;
const GAMEPAD_REPEAT_DELAY_MS = 260;
const GAMEPAD_REPEAT_INTERVAL_MS = 90;

function isTextEntryFocused(): boolean {
  const activeElement = document.activeElement as HTMLElement | null;
  return (
    activeElement?.tagName === "INPUT" ||
    activeElement?.tagName === "TEXTAREA" ||
    activeElement?.tagName === "SELECT" ||
    activeElement?.isContentEditable === true
  );
}

export function TacticalCombatUI({
  chatId,
  party,
  enemies,
  environment,
  formation,
  initialState,
  inventoryItems = [],
  combatItemEffects = [],
  combatObjectives: initialObjectives = [],
  combatMechanics = [],
  onInventoryItemUsed,
  onInventoryChange,
  playerCombatantId,
  onCombatEnd,
  onCustomInstruction,
}: TacticalCombatUIProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: manifest } = useGameAssetManifest();
  const assets = manifest?.assets ?? null;
  const startMut = useTacticalCombatStart();
  const actionMut = useTacticalCombatAction();
  const { mutate: updateMetadata } = useUpdateChatMetadata();

  const [state, setState] = useState<TacticalCombatState | null>(initialState ?? null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [objectives, setObjectives] = useState<CombatObjectiveState[]>(initialObjectives);
  const activeSessionQuery = useActiveCombatSession(chatId, "tactical", !sessionId);
  const [starting, setStarting] = useState(!initialState);
  const [startError, setStartError] = useState<string | null>(null);
  const launchRequestedForChatRef = useRef<string | null>(null);
  const hydratedSessionRevisionRef = useRef<string | null>(null);

  const [ui, setUi] = useState<UiMode>({ kind: "idle" });
  const [stagedMove, setStagedMove] = useState<TacticalCoord | null>(null);
  const [maneuverText, setManeuverText] = useState("");
  const [maneuverTargetId, setManeuverTargetId] = useState<string | null>(null);
  const [maneuverObjectiveId, setManeuverObjectiveId] = useState<string | null>(null);
  // Optimistic move: keeps the mover's token at its committed destination through
  // network flight + event playback (sendAction clears stagedMove immediately, and
  // playEvents' baseline is the pre-action state — without this the token snaps
  // back to its origin and re-walks the move). State drives rendering; the ref
  // mirrors it so playEvents reads the current value without stale closures.
  const [optimisticMove, setOptimisticMove] = useState<{ unitId: string; to: TacticalCoord } | null>(null);
  const optimisticMoveRef = useRef<{ unitId: string; to: TacticalCoord } | null>(null);
  const [inspectTile, setInspectTile] = useState<TacticalCoord | null>(null);
  const [showThreat, setShowThreat] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [fleeConfirm, setFleeConfirm] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 4 : 1,
  );

  // Root element — the drag constraints boundary for the draggable inspect card.
  const rootRef = useRef<HTMLDivElement>(null);

  // Action-menu drag offset lives at component level so the card keeps its
  // position across unit selections (the card unmounts on deselect).
  const actionMenuX = useMotionValue(0);
  const actionMenuY = useMotionValue(0);

  // Animation state.
  const [animUnits, setAnimUnits] = useState<Map<string, RenderUnit> | null>(null);
  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [banner, setBanner] = useState<PhaseBanner | null>(null);
  const [critFlash, setCritFlash] = useState(false);
  const animatingRef = useRef(false);
  const [animating, setAnimating] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const popupIdRef = useRef(0);
  const endedRef = useRef(false);
  const terminalSummaryRef = useRef<CombatSummary | null>(null);

  const playSfx = useCallback((tag: string) => audioManager.playSfx(tag, assets), [assets]);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  // ── Persist snapshot to chat metadata after every authoritative state change ──
  const persistSnapshot = useCallback(
    (snap: TacticalCombatState | null) => {
      updateMetadata({ id: chatId, gameTacticalCombatSnapshot: snap });
    },
    [chatId, updateMetadata],
  );

  useEffect(() => {
    const session = activeSessionQuery.data?.session;
    if (!session || session.style !== "tactical") return;
    const hydrationKey = `${session.sessionId}:${session.revision}`;
    if (hydratedSessionRevisionRef.current === hydrationKey) return;
    hydratedSessionRevisionRef.current = hydrationKey;
    const playerId = playerCombatantId ?? party[0]?.id ?? null;
    const canonicalState: TacticalCombatState = {
      ...session.canonicalState,
      units: session.canonicalState.units.map((unit) =>
        unit.side === "party" && playerId ? { ...unit, isPlayer: unit.id === playerId } : unit,
      ),
    };
    setSessionId(session.sessionId);
    setRevision(session.revision);
    setObjectives(session.objectives);
    if (session.result) terminalSummaryRef.current = session.result;
    setState(canonicalState);
    setStarting(false);
    persistSnapshot(canonicalState);
  }, [activeSessionQuery.data?.session, party, persistSnapshot, playerCombatantId]);

  // ── Launch a fresh battle (payload build + player marking + setState/persist/SFX) ──
  // Shared by the mount effect and the restart flow. `isCancelled` lets the mount
  // effect drop a stale response after unmount; restart passes nothing.
  const launchBattle = useCallback(
    (isCancelled?: () => boolean, objectiveOverride: CombatObjectiveState[] = objectives) => {
      setStarting(true);
      setStartError(null);
      // Typed intermediate (not a fresh literal) so environment/formation reach the
      // POST body even though the hook's mutationFn type predates these fields.
      const startPayload: {
        chatId: string;
        party: Combatant[];
        enemies: Combatant[];
        environment?: string;
        formation?: string;
        inventory?: Array<{ name: string; quantity: number }>;
        itemEffects?: CombatItemEffect[];
        mechanics?: import("@marinara-engine/shared").CombatMechanic[];
        objectives?: CombatObjectiveState[];
      } = {
        chatId,
        party,
        enemies,
        inventory: inventoryItems,
        itemEffects: combatItemEffects,
        objectives: objectiveOverride,
      };
      if (combatMechanics.length > 0) startPayload.mechanics = combatMechanics;
      if (environment) startPayload.environment = environment;
      if (formation) startPayload.formation = formation;
      startMut
        .mutateAsync(startPayload)
        .then((res) => {
          if (isCancelled?.()) return;
          // Engine does NOT set isPlayer — the client marks the persona's combatant.
          const playerId = playerCombatantId ?? party[0]?.id ?? null;
          const marked: TacticalCombatState = {
            ...res.state,
            units: res.state.units.map((u) =>
              u.side === "party" && (playerId ? u.id === playerId : false) ? { ...u, isPlayer: true } : u,
            ),
          };
          setSessionId(res.sessionId);
          setRevision(res.revision);
          setObjectives(res.objectives);
          setState(marked);
          setStarting(false);
          persistSnapshot(marked);
          playSfx(SFX.start);
        })
        .catch((err: unknown) => {
          if (isCancelled?.()) return;
          setStarting(false);
          setStartError(err instanceof Error ? err.message : "Failed to start the tactical battle.");
        });
    },
    [
      chatId,
      party,
      enemies,
      environment,
      formation,
      inventoryItems,
      combatItemEffects,
      objectives,
      combatMechanics,
      playerCombatantId,
      startMut,
      persistSnapshot,
      playSfx,
    ],
  );

  // ── Start a fresh battle (unless restoring) ──
  useEffect(() => {
    if (initialState) return; // restored — do not re-create
    if (
      sessionId ||
      activeSessionQuery.isPending ||
      activeSessionQuery.isFetching ||
      activeSessionQuery.data?.session ||
      launchRequestedForChatRef.current === chatId
    ) {
      return;
    }
    launchRequestedForChatRef.current = chatId;
    let cancelled = false;
    launchBattle(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [
    activeSessionQuery.data?.session,
    activeSessionQuery.isFetching,
    activeSessionQuery.isPending,
    chatId,
    initialState,
    launchBattle,
    sessionId,
  ]);

  // ── Derived: units currently rendered (anim positions during playback) ──
  const liveState = state;
  const availableItems = useMemo(
    () => (liveState?.inventory ?? inventoryItems).filter((item) => item.quantity > 0),
    [liveState?.inventory, inventoryItems],
  );
  const itemEffectFor = useCallback(
    (itemName: string | undefined) =>
      itemName
        ? (liveState?.itemEffects ?? combatItemEffects).find(
            (effect) => effect.name.trim().toLowerCase() === itemName.trim().toLowerCase(),
          )
        : undefined,
    [liveState?.itemEffects, combatItemEffects],
  );

  // Authoritative environment → terrain palette (restored snapshots keep theme).
  const activeEnvironment = useMemo(
    () => environmentOf(liveState) ?? environment ?? undefined,
    [liveState, environment],
  );
  const palette = useMemo(
    () => TERRAIN_PALETTES[activeEnvironment ?? "default"] ?? TERRAIN_PALETTES.default,
    [activeEnvironment],
  );
  // Stronger palette tint over the painted textures when a themed environment applies.
  const tileTintAlpha =
    activeEnvironment && TERRAIN_PALETTES[activeEnvironment] ? TILE_TINT_ALPHA_THEMED : TILE_TINT_ALPHA;

  const selectedUnitId = ui.kind === "idle" ? null : ui.unitId;
  const selectedUnit = useMemo(
    () => (liveState && selectedUnitId ? (liveState.units.find((u) => u.id === selectedUnitId) ?? null) : null),
    [liveState, selectedUnitId],
  );

  // Movement range for the selected (un-acted, un-moved) party unit.
  const movementTiles = useMemo(() => {
    if (!liveState || !selectedUnit || animating) return [];
    if (selectedUnit.hasMoved || selectedUnit.hasActed) return [];
    return getMovementRange(liveState, selectedUnit.id);
  }, [liveState, selectedUnit, animating]);

  const movementKeys = useMemo(() => new Set(movementTiles.map((t) => `${t.x},${t.y}`)), [movementTiles]);

  // Threat overlay: union of tiles any living enemy can attack (reachable + attack range).
  const threatKeys = useMemo(() => {
    if (!liveState || !showThreat) return new Set<string>();
    const keys = new Set<string>();
    for (const e of liveState.units) {
      if (e.side !== "enemy" || e.hp <= 0) continue;
      const reach = [{ x: e.x, y: e.y }, ...getMovementRange(liveState, e.id)];
      const hasAttackSkill = e.skills.some(
        (skill) => skill.type === "attack" && (e.skillCooldowns[skill.name] ?? 0) <= 0 && e.mp >= skill.mpCost,
      );
      const threatMin = hasAttackSkill ? 1 : e.attackRange.min;
      const threatMax = hasAttackSkill ? Math.max(2, e.attackRange.max) : e.attackRange.max;
      for (const tile of reach) {
        for (let dy = -threatMax; dy <= threatMax; dy++) {
          for (let dx = -threatMax; dx <= threatMax; dx++) {
            const d = Math.abs(dx) + Math.abs(dy);
            if (d < threatMin || d > threatMax) continue;
            const tx = tile.x + dx;
            const ty = tile.y + dy;
            if (tx < 0 || ty < 0 || tx >= liveState.grid.width || ty >= liveState.grid.height) continue;
            if (d > 1 && !hasLineOfSight(liveState.grid, tile, { x: tx, y: ty })) continue;
            keys.add(`${tx},${ty}`);
          }
        }
      }
    }
    return keys;
  }, [liveState, showThreat]);

  // Staged post-move state, used for target highlighting + forecast.
  const stagedState = useMemo(
    () => (liveState && selectedUnit ? withStagedMove(liveState, selectedUnit.id, stagedMove) : liveState),
    [liveState, selectedUnit, stagedMove],
  );

  // Valid targets for the current target-selection mode.
  const targetIds = useMemo(() => {
    if (!stagedState || ui.kind !== "target" || !selectedUnit) return new Set<string>();
    const from = stagedMove ?? { x: selectedUnit.x, y: selectedUnit.y };
    if (ui.action === "attack") {
      return new Set(getTargetsInRange(stagedState, selectedUnit.id, from));
    }
    if (ui.action === "skill" && ui.skill) {
      const skill = ui.skill;
      if (skill.type === "attack") {
        // Attack skills reach at least range 2.
        const ids: string[] = [];
        for (const u of stagedState.units) {
          if (u.side === selectedUnit.side || u.hp <= 0) continue;
          const d = Math.abs(u.x - from.x) + Math.abs(u.y - from.y);
          const max = Math.max(selectedUnit.attackRange.max, 2);
          if (d >= 1 && d <= max) ids.push(u.id);
        }
        return new Set(ids);
      }
      // heal/buff → allies within support range 2; debuff → enemies within 2.
      const wantAlly = skill.type !== "debuff";
      const ids: string[] = [];
      for (const u of stagedState.units) {
        if (u.hp <= 0) continue;
        const isAlly = u.side === selectedUnit.side;
        if (wantAlly !== isAlly) continue;
        const d = Math.abs(u.x - from.x) + Math.abs(u.y - from.y);
        if (d <= 2) ids.push(u.id);
      }
      return new Set(ids);
    }
    if (ui.action === "item") {
      const effect = itemEffectFor(ui.itemName);
      // Item (heal) → allies within range 2.
      const ids: string[] = [];
      for (const u of stagedState.units) {
        if (u.hp <= 0) continue;
        if (effect?.target === "self" && u.id !== selectedUnit.id) continue;
        if (effect?.target === "ally" && u.side !== selectedUnit.side) continue;
        if (effect?.target === "enemy" && u.side === selectedUnit.side) continue;
        const d = Math.abs(u.x - from.x) + Math.abs(u.y - from.y);
        if (d <= 2) ids.push(u.id);
      }
      return new Set(ids);
    }
    return new Set<string>();
  }, [stagedState, ui, selectedUnit, stagedMove, itemEffectFor]);

  // Forecast for a hovered/selected target (attack + attack-skills only).
  const [forecastTargetId, setForecastTargetId] = useState<string | null>(null);
  const forecast = useMemo(() => {
    if (!stagedState || !selectedUnit || !forecastTargetId) return null;
    if (ui.kind !== "target") return null;
    if (ui.action === "item") return null;
    if (ui.action === "skill" && ui.skill && ui.skill.type !== "attack") return null;
    if (ui.action === "skill" && ui.skill) {
      return forecastSkill(stagedState, selectedUnit.id, forecastTargetId, ui.skill.name);
    }
    return forecastAttack(stagedState, selectedUnit.id, forecastTargetId);
  }, [stagedState, selectedUnit, forecastTargetId, ui]);

  const spawnPopup = useCallback(
    (at: { x: number; y: number } | undefined, text: string, tone: FloatingPopup["tone"]) => {
      if (!at) return;
      const id = ++popupIdRef.current;
      setPopups((prev) => [...prev, { id, x: at.x, y: at.y, text, tone }]);
      const t = setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 1200);
      timersRef.current.push(t);
    },
    [],
  );

  // Applies one event's visual effect to the working render map + fires popups/sfx/banner.
  const applyEventVisual = useCallback(
    (ev: TacticalEvent, working: Map<string, RenderUnit>) => {
      switch (ev.kind) {
        case "move": {
          const movedUnitId = ev.targetId ?? ev.actorId;
          if (movedUnitId && ev.to) {
            const u = working.get(movedUnitId);
            if (u) {
              u.x = ev.to.x;
              u.y = ev.to.y;
            }
          }
          break;
        }
        case "phase": {
          const tone: PhaseBanner["tone"] = ev.phase === "enemy" || /enemy/i.test(ev.text) ? "enemy" : "player";
          setBanner({ text: ev.text, tone });
          break;
        }
        case "damage":
        case "counter": {
          if (ev.targetId && typeof ev.amount === "number") {
            const u = working.get(ev.targetId);
            if (u) u.hp = Math.max(0, u.hp - ev.amount);
            spawnPopup(u, `-${ev.amount}`, "damage");
          }
          playSfx(SFX.hit);
          break;
        }
        case "crit": {
          if (ev.targetId && typeof ev.amount === "number") {
            const u = working.get(ev.targetId);
            if (u) u.hp = Math.max(0, u.hp - ev.amount);
            spawnPopup(u, `-${ev.amount}!`, "crit");
          }
          setCritFlash(true);
          const t = setTimeout(() => setCritFlash(false), 220);
          timersRef.current.push(t);
          playSfx(SFX.crit);
          break;
        }
        case "heal": {
          if (ev.targetId && typeof ev.amount === "number") {
            const u = working.get(ev.targetId);
            if (u) u.hp = Math.min(u.maxHp, u.hp + ev.amount);
            spawnPopup(u, `+${ev.amount}`, "heal");
          }
          playSfx(SFX.item);
          break;
        }
        case "miss": {
          if (ev.targetId) spawnPopup(working.get(ev.targetId), "Miss", "miss");
          playSfx(SFX.miss);
          break;
        }
        case "status": {
          if (ev.targetId && ev.statusName) spawnPopup(working.get(ev.targetId), ev.statusName, "status");
          break;
        }
        case "skill": {
          playSfx(SFX.magic);
          break;
        }
        case "defeat": {
          if (ev.targetId) {
            const u = working.get(ev.targetId);
            if (u) u.hp = 0;
          }
          break;
        }
        case "victory":
          playSfx(SFX.victory);
          break;
        case "defeat-end":
          playSfx(SFX.defeat);
          break;
        default:
          break;
      }
    },
    [playSfx, spawnPopup],
  );

  // ── End-of-battle handoff ──
  const maybeEnd = useCallback(
    (s: TacticalCombatState) => {
      if (!s.outcome || endedRef.current || (!sessionId && !activeSessionQuery.isFetched)) return;
      endedRef.current = true;
      // Terminal snapshots stay persisted (not cleared here) so a refresh mid-flight
      // restores the outcome screen instead of soft-locking or re-launching a fresh
      // battle. The snapshot is only cleared atomically with the handoff moment
      // (inside the setTimeout below, or on the defeat screen's Continue button).
      // Defeat: do NOT auto-hand off. The defeat outcome screen offers Retry / Continue
      // so the player can restart the fight instead of being dropped back to the story.
      if (s.outcome === "defeat") return;
      const summary = terminalSummaryRef.current ?? {
        ...buildTacticalSummary(s),
        ...(sessionId ? { sessionId } : {}),
        objectives,
        inventory: (s.inventory ?? []).map((item) => ({ ...item })),
      };
      // buildTacticalSummary already maps to classic outcome values ("victory"|"defeat"|"flee").
      const t = setTimeout(() => {
        onCombatEnd(summary.outcome, summary);
      }, 1400);
      timersRef.current.push(t);
    },
    [activeSessionQuery.isFetched, objectives, onCombatEnd, sessionId],
  );

  // ── Restored-terminal-mount handoff ──
  // Canonical restoration can arrive after mount, so terminal handoff follows
  // live authoritative state instead of only the metadata snapshot prop.
  useEffect(() => {
    if (state?.outcome) maybeEnd(state);
  }, [maybeEnd, state]);

  // ── Event animation player ──
  // Plays the server-returned events sequentially over a working copy of the
  // pre-action render map, then reconciles to the authoritative final state.
  // `onSettled` fires once, after the final state is committed (used to re-select
  // a unit that only moved so the player can immediately pick its action).
  const playEvents = useCallback(
    (
      events: TacticalEvent[],
      finalState: TacticalCombatState,
      preState: TacticalCombatState,
      onSettled?: (final: TacticalCombatState, events: TacticalEvent[]) => void,
    ) => {
      clearTimers();
      if (events.length === 0) {
        // No events to animate — release the lock sendAction set before flight.
        animatingRef.current = false;
        setAnimating(false);
        optimisticMoveRef.current = null;
        setOptimisticMove(null);
        setState(finalState);
        persistSnapshot(finalState);
        maybeEnd(finalState);
        onSettled?.(finalState, events);
        return;
      }
      // Already locked by sendAction; keep it set through the animation + finalize.
      animatingRef.current = true;
      setAnimating(true);
      const working = renderMapFromState(preState);
      // Pre-apply the optimistic move so the animation baseline already has the
      // mover at its destination; the server's "move" event then re-sets the same
      // coords, which is a visual no-op.
      const opt = optimisticMoveRef.current;
      if (opt) {
        const mover = working.get(opt.unitId);
        if (mover) {
          mover.x = opt.to.x;
          mover.y = opt.to.y;
        }
      }
      setAnimUnits(new Map(working));

      let elapsed = 0;
      events.forEach((ev, i) => {
        elapsed += i === 0 ? 0 : (EVENT_DELAY[events[i - 1].kind] ?? 500) / animationSpeed;
        const t = setTimeout(() => {
          applyEventVisual(ev, working);
          setAnimUnits(new Map(working));
        }, elapsed);
        timersRef.current.push(t);
      });

      // Finalize after the last event's dwell time.
      const finishAt = elapsed + (EVENT_DELAY[events[events.length - 1].kind] ?? 500) / animationSpeed;
      const done = setTimeout(() => {
        animatingRef.current = false;
        setAnimating(false);
        optimisticMoveRef.current = null;
        setOptimisticMove(null);
        setAnimUnits(null);
        setBanner(null);
        setState(finalState);
        persistSnapshot(finalState);
        maybeEnd(finalState);
        onSettled?.(finalState, events);
      }, finishAt);
      timersRef.current.push(done);
    },
    [clearTimers, persistSnapshot, applyEventVisual, maybeEnd, animationSpeed],
  );

  // ── Reset transient UI selection ──
  const resetSelection = useCallback(() => {
    setUi({ kind: "idle" });
    setStagedMove(null);
    setForecastTargetId(null);
    setManeuverText("");
    setManeuverTargetId(null);
    setManeuverObjectiveId(null);
  }, []);

  // ── Restart the whole battle (fresh seed/terrain from the server) ──
  // Tears down all transient animation/selection/dialog state, clears the current
  // battle, then re-launches with the same props. Works for snapshot-restored
  // battles too (it drives launchBattle directly, independent of `initialState`).
  const restartBattle = useCallback(() => {
    const resetObjectives = initialObjectives.map((objective) => ({
      ...objective,
      progress: 0,
      status: "active" as const,
    }));
    clearTimers();
    animatingRef.current = false;
    setAnimating(false);
    optimisticMoveRef.current = null;
    setOptimisticMove(null);
    setAnimUnits(null);
    setPopups([]);
    setBanner(null);
    setCritFlash(false);
    resetSelection();
    setInspectTile(null);
    setFleeConfirm(false);
    actionMenuX.set(0);
    actionMenuY.set(0);
    endedRef.current = false;
    terminalSummaryRef.current = null;
    setSessionId(null);
    setRevision(0);
    setObjectives(resetObjectives);
    setState(null);
    launchBattle(undefined, resetObjectives);
  }, [clearTimers, resetSelection, initialObjectives, launchBattle, actionMenuX, actionMenuY]);

  // ── Send one action to the server ──
  const sendAction = useCallback(
    (action: TacticalAction, onSettled?: (final: TacticalCombatState, events: TacticalEvent[]) => void) => {
      if (!liveState || animatingRef.current) return;
      const preState = liveState;
      // Lock SYNCHRONOUSLY — before the request leaves — so the network-flight
      // window is guarded too. Without this, a second click during flight posts
      // the STALE pre-action state, whose response cancels this animation and
      // commits a pre-kill state (enemy revived, unit teleported back). The lock
      // now covers request flight + animation + commit; playEvents / the catch
      // below own its release.
      animatingRef.current = true;
      setAnimating(true);
      // Derive the optimistic move (if any) from the action before resetSelection
      // clears stagedMove, so the mover's token holds at its destination through
      // network flight instead of snapping back to its origin.
      const dest = action.type === "move" ? action.to : "to" in action ? action.to : undefined;
      const moverId = "unitId" in action ? action.unitId : undefined;
      const opt = dest && moverId ? { unitId: moverId, to: dest } : null;
      optimisticMoveRef.current = opt;
      setOptimisticMove(opt);
      resetSelection();
      const actionId = generateClientId();
      actionMut
        .mutateAsync({
          chatId,
          state: preState,
          ...(sessionId ? { sessionId } : {}),
          expectedRevision: revision,
          actionId,
          action,
        })
        .then((res) => {
          setSessionId(res.sessionId);
          setRevision(res.revision);
          setObjectives(res.objectives);
          terminalSummaryRef.current = res.summary ?? null;
          if (res.inventory) {
            onInventoryChange?.(res.inventory);
          } else if (action.type === "item") {
            const effect = combatItemEffects.find(
              (candidate) => candidate.name.trim().toLowerCase() === action.itemName.trim().toLowerCase(),
            );
            if (effect?.consumes !== false) void onInventoryItemUsed?.(action.itemName);
          }
          playEvents(res.events, res.state, preState, onSettled);
        })
        .catch((err: unknown) => {
          // Release the lock so a rejected action doesn't wedge the grid. The move
          // never happened, so the token must return home.
          animatingRef.current = false;
          setAnimating(false);
          optimisticMoveRef.current = null;
          setOptimisticMove(null);
          if (err instanceof ApiError && err.payload && typeof err.payload === "object") {
            const payload = err.payload as {
              code?: string;
              currentRevision?: number;
              state?: {
                revision?: number;
                canonicalState?: TacticalCombatState;
                objectives?: CombatObjectiveState[];
              };
            };
            if (payload.code === "STALE_REVISION" && payload.state?.canonicalState) {
              setRevision(payload.currentRevision ?? payload.state.revision ?? revision);
              setState(payload.state.canonicalState);
              setObjectives(payload.state.objectives ?? []);
              persistSnapshot(payload.state.canonicalState);
            }
          }
          const msg = err instanceof Error ? err.message : "That action was rejected.";
          toast.error(msg);
        });
    },
    [
      liveState,
      chatId,
      sessionId,
      revision,
      combatItemEffects,
      onInventoryItemUsed,
      onInventoryChange,
      actionMut,
      playEvents,
      persistSnapshot,
      resetSelection,
    ],
  );

  // ── Interaction handlers ──

  const onTileClick = useCallback(
    (x: number, y: number) => {
      if (!liveState || animating) return;
      setInspectTile({ x, y });
      const key = `${x},${y}`;

      // Target selection: tap a valid target token handled by onTokenClick; tapping a
      // tile in target mode is a no-op except to inspect.
      if (ui.kind === "target") return;

      // If a party unit is selected and this tile is in movement range → stage move.
      if ((ui.kind === "unit" || ui.kind === "skills") && selectedUnit && movementKeys.has(key)) {
        if (selectedUnit.hasMoved) return;
        playSfx(SFX.hover);
        setStagedMove(x === selectedUnit.x && y === selectedUnit.y ? null : { x, y });
        setUi({ kind: "unit", unitId: selectedUnit.id });
        return;
      }
    },
    [liveState, animating, ui, selectedUnit, movementKeys, playSfx],
  );

  const onTokenClick = useCallback(
    (unit: TacticalUnit) => {
      if (!liveState || animating) return;
      setInspectTile({ x: unit.x, y: unit.y });

      // Target selection mode — confirm target if valid.
      if (ui.kind === "target") {
        if (!targetIds.has(unit.id)) return;
        setForecastTargetId(unit.id);
        return;
      }

      if (ui.kind === "maneuver") {
        setManeuverTargetId(unit.id);
        return;
      }

      // Select a controllable party unit (alive, un-acted).
      if (unit.side === "party" && unit.hp > 0 && !unit.hasActed && liveState.phase === "player") {
        playSfx(SFX.select);
        setStagedMove(null);
        setForecastTargetId(null);
        setUi({ kind: "unit", unitId: unit.id });
        return;
      }

      // Otherwise just inspect (enemy or acted unit).
      resetSelection();
    },
    [liveState, animating, ui, targetIds, playSfx, resetSelection],
  );

  // ── Commit a pure move, then re-select the same unit so it can still act. ──
  const commitMove = useCallback(() => {
    if (!selectedUnit || !stagedMove || selectedUnit.hasMoved) return;
    const unitId = selectedUnit.id;
    playSfx(SFX.select);
    sendAction({ type: "move", unitId, to: stagedMove }, (final) => {
      // Only re-open the action menu if the battle continues and the mover can still act.
      if (final.outcome || final.phase !== "player") return;
      const u = final.units.find((x) => x.id === unitId);
      if (!u || u.hp <= 0 || u.hasActed) return;
      setUi({ kind: "unit", unitId });
    });
  }, [selectedUnit, stagedMove, playSfx, sendAction]);

  const chooseAction = useCallback(
    (actionId: "attack" | "skills" | "item" | "maneuver" | "defend" | "overwatch" | "wait") => {
      if (!selectedUnit || !liveState) return;
      playSfx(SFX.select);
      const to = stagedMove ?? undefined;
      switch (actionId) {
        case "attack":
          setUi({ kind: "target", unitId: selectedUnit.id, action: "attack" });
          setForecastTargetId(null);
          break;
        case "skills":
          setUi({ kind: "skills", unitId: selectedUnit.id });
          break;
        case "item":
          if (availableItems.length === 0) return;
          setUi({ kind: "items", unitId: selectedUnit.id });
          break;
        case "maneuver":
          setManeuverTargetId(null);
          setManeuverObjectiveId(null);
          setManeuverText("");
          setUi({ kind: "maneuver", unitId: selectedUnit.id });
          break;
        case "defend":
          sendAction({ type: "defend", unitId: selectedUnit.id, to });
          break;
        case "overwatch":
          sendAction({ type: "overwatch", unitId: selectedUnit.id, to });
          break;
        case "wait":
          sendAction({ type: "wait", unitId: selectedUnit.id, to });
          break;
      }
    },
    [selectedUnit, liveState, stagedMove, availableItems.length, playSfx, sendAction],
  );

  const chooseItem = useCallback(
    (itemName: string) => {
      if (!selectedUnit || !availableItems.some((item) => item.name === itemName)) return;
      playSfx(SFX.select);
      setUi({ kind: "target", unitId: selectedUnit.id, action: "item", itemName });
      setForecastTargetId(null);
    },
    [selectedUnit, availableItems, playSfx],
  );

  const submitManeuver = useCallback(() => {
    if (!selectedUnit || ui.kind !== "maneuver" || maneuverText.trim().length < 3) return;
    const instruction = maneuverText.trim();
    const targetId = maneuverTargetId ?? undefined;
    const tile = inspectTile ?? undefined;
    sendAction(
      {
        type: "maneuver",
        unitId: selectedUnit.id,
        instruction,
        ...(targetId ? { targetId } : {}),
        ...(tile ? { tile } : {}),
        ...(maneuverObjectiveId ? { objectiveId: maneuverObjectiveId } : {}),
        ...(stagedMove ? { to: stagedMove } : {}),
      },
      (final, events) => {
        if (final.outcome) return;
        const maneuverResult = events
          .filter((event) => event.kind === "maneuver" || event.actorId === selectedUnit.id)
          .map((event) => event.text)
          .join(" ");
        onCustomInstruction?.(`Tactical maneuver resolved: ${maneuverResult || instruction}`);
      },
    );
  }, [
    selectedUnit,
    ui,
    maneuverText,
    maneuverTargetId,
    maneuverObjectiveId,
    inspectTile,
    stagedMove,
    sendAction,
    onCustomInstruction,
  ]);

  const chooseSkill = useCallback(
    (skill: CombatSkill) => {
      if (!selectedUnit) return;
      playSfx(SFX.select);
      setUi({ kind: "target", unitId: selectedUnit.id, action: "skill", skill });
      setForecastTargetId(null);
    },
    [selectedUnit, playSfx],
  );

  const confirmTarget = useCallback(() => {
    if (!selectedUnit || ui.kind !== "target" || !forecastTargetId) return;
    const to = stagedMove ?? undefined;
    if (ui.action === "attack") {
      sendAction({ type: "attack", unitId: selectedUnit.id, targetId: forecastTargetId, to });
    } else if (ui.action === "skill" && ui.skill) {
      sendAction({ type: "skill", unitId: selectedUnit.id, skillName: ui.skill.name, targetId: forecastTargetId, to });
    } else if (ui.action === "item" && ui.itemName) {
      sendAction({
        type: "item",
        unitId: selectedUnit.id,
        itemName: ui.itemName,
        targetId: forecastTargetId,
        to,
      });
    }
  }, [selectedUnit, ui, forecastTargetId, stagedMove, sendAction]);

  // Support-skill (heal/buff/debuff) targets have no forecast — tapping confirms directly.
  const onSupportTarget = useCallback(
    (targetId: string) => {
      if (!selectedUnit || ui.kind !== "target") return;
      const to = stagedMove ?? undefined;
      if (ui.action === "skill" && ui.skill) {
        sendAction({ type: "skill", unitId: selectedUnit.id, skillName: ui.skill.name, targetId, to });
      } else if (ui.action === "item" && ui.itemName) {
        sendAction({ type: "item", unitId: selectedUnit.id, itemName: ui.itemName, targetId, to });
      }
    },
    [selectedUnit, ui, stagedMove, sendAction],
  );

  const endTurn = useCallback(() => {
    resetSelection();
    sendAction({ type: "endTurn" });
  }, [resetSelection, sendAction]);

  const confirmFlee = useCallback(() => {
    setFleeConfirm(false);
    resetSelection();
    sendAction({ type: "flee" });
  }, [resetSelection, sendAction]);

  const handleCombatKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (event.key === "Escape") {
        resetSelection();
        return;
      }
      if (!selectedUnit || ui.kind !== "unit" || animating) return;
      const shortcut = event.key.toLowerCase();
      if (shortcut === "a") chooseAction("attack");
      else if (shortcut === "s") chooseAction("skills");
      else if (shortcut === "i") chooseAction("item");
      else if (shortcut === "m") chooseAction("maneuver");
      else if (shortcut === "d") chooseAction("defend");
      else if (shortcut === "o") chooseAction("overwatch");
      else if (shortcut === "w") chooseAction("wait");
      else return;
      event.preventDefault();
    },
    [resetSelection, selectedUnit, ui.kind, animating, chooseAction],
  );

  const moveControllerCursor = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!liveState || liveState.outcome || animating) return;
      setInspectTile((current) => {
        const fallbackUnit = selectedUnit ?? liveState.units.find((unit) => unit.side === "party" && unit.hp > 0);
        const origin =
          current ?? stagedMove ?? (fallbackUnit ? { x: fallbackUnit.x, y: fallbackUnit.y } : { x: 0, y: 0 });
        return {
          x: Math.max(0, Math.min(liveState.grid.width - 1, origin.x + deltaX)),
          y: Math.max(0, Math.min(liveState.grid.height - 1, origin.y + deltaY)),
        };
      });
    },
    [liveState, selectedUnit, stagedMove, animating],
  );

  const confirmControllerSelection = useCallback(() => {
    if (!liveState || liveState.outcome || liveState.phase !== "player" || animating) return;
    if (fleeConfirm || restartConfirm || logOpen) return;

    const fallbackUnit = selectedUnit ?? liveState.units.find((unit) => unit.side === "party" && unit.hp > 0);
    const cursor = inspectTile ?? stagedMove ?? (fallbackUnit ? { x: fallbackUnit.x, y: fallbackUnit.y } : null);
    if (!cursor) return;
    setInspectTile(cursor);

    if (ui.kind === "unit" && stagedMove?.x === cursor.x && stagedMove?.y === cursor.y && !selectedUnit?.hasMoved) {
      commitMove();
      return;
    }

    const unitAtCursor = liveState.units.find((unit) => unit.hp > 0 && unit.x === cursor.x && unit.y === cursor.y);
    if (ui.kind === "target") {
      if (!unitAtCursor || !targetIds.has(unitAtCursor.id)) return;
      const isSupport = ui.action === "item" || (ui.action === "skill" && ui.skill?.type !== "attack");
      if (isSupport) {
        onSupportTarget(unitAtCursor.id);
      } else if (forecastTargetId === unitAtCursor.id && forecast) {
        confirmTarget();
      } else {
        onTokenClick(unitAtCursor);
      }
      return;
    }

    if (unitAtCursor) onTokenClick(unitAtCursor);
    else onTileClick(cursor.x, cursor.y);
  }, [
    liveState,
    animating,
    fleeConfirm,
    restartConfirm,
    logOpen,
    selectedUnit,
    inspectTile,
    stagedMove,
    ui,
    commitMove,
    targetIds,
    onSupportTarget,
    forecastTargetId,
    forecast,
    confirmTarget,
    onTokenClick,
    onTileClick,
  ]);

  const cancelControllerSelection = useCallback(() => {
    if (fleeConfirm) {
      setFleeConfirm(false);
      return;
    }
    if (restartConfirm) {
      setRestartConfirm(false);
      return;
    }
    if (logOpen) {
      setLogOpen(false);
      return;
    }
    if (ui.kind === "target") setForecastTargetId(null);
    if (ui.kind === "maneuver") setManeuverTargetId(null);
    if (ui.kind === "maneuver") setManeuverObjectiveId(null);
    if (ui.kind === "unit") {
      resetSelection();
      return;
    }
    if (ui.kind !== "idle" && selectedUnit) {
      setUi({ kind: "unit", unitId: selectedUnit.id });
      return;
    }
    setInspectTile(null);
  }, [fleeConfirm, restartConfirm, logOpen, ui.kind, selectedUnit, resetSelection]);

  const controllerHandlersRef = useRef({
    move: moveControllerCursor,
    confirm: confirmControllerSelection,
    cancel: cancelControllerSelection,
  });

  useEffect(() => {
    controllerHandlersRef.current = {
      move: moveControllerCursor,
      confirm: confirmControllerSelection,
      cancel: cancelControllerSelection,
    };
  }, [moveControllerCursor, confirmControllerSelection, cancelControllerSelection]);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;

    let animationFrame = 0;
    let previousConfirm = false;
    let previousCancel = false;
    let heldDirection: "up" | "down" | "left" | "right" | null = null;
    let nextDirectionRepeatAt = 0;

    const pollGamepad = (now: number) => {
      const gamepad = Array.from(navigator.getGamepads()).find((candidate) => candidate?.connected) ?? null;
      if (!gamepad || document.hidden || isTextEntryFocused()) {
        previousConfirm = gamepad?.buttons[0]?.pressed ?? false;
        previousCancel = gamepad?.buttons[1]?.pressed ?? false;
        heldDirection = null;
        animationFrame = requestAnimationFrame(pollGamepad);
        return;
      }

      const horizontalAxis = gamepad.axes[0] ?? 0;
      const verticalAxis = gamepad.axes[1] ?? 0;
      let direction: typeof heldDirection = null;
      if (gamepad.buttons[12]?.pressed || verticalAxis <= -GAMEPAD_AXIS_THRESHOLD) direction = "up";
      else if (gamepad.buttons[13]?.pressed || verticalAxis >= GAMEPAD_AXIS_THRESHOLD) direction = "down";
      else if (gamepad.buttons[14]?.pressed || horizontalAxis <= -GAMEPAD_AXIS_THRESHOLD) direction = "left";
      else if (gamepad.buttons[15]?.pressed || horizontalAxis >= GAMEPAD_AXIS_THRESHOLD) direction = "right";

      if (direction && (direction !== heldDirection || now >= nextDirectionRepeatAt)) {
        const delta =
          direction === "up"
            ? { x: 0, y: -1 }
            : direction === "down"
              ? { x: 0, y: 1 }
              : direction === "left"
                ? { x: -1, y: 0 }
                : { x: 1, y: 0 };
        controllerHandlersRef.current.move(delta.x, delta.y);
        nextDirectionRepeatAt =
          now + (direction === heldDirection ? GAMEPAD_REPEAT_INTERVAL_MS : GAMEPAD_REPEAT_DELAY_MS);
      }
      heldDirection = direction;

      const confirmPressed = gamepad.buttons[0]?.pressed ?? false;
      const cancelPressed = gamepad.buttons[1]?.pressed ?? false;
      if (confirmPressed && !previousConfirm) controllerHandlersRef.current.confirm();
      if (cancelPressed && !previousCancel) controllerHandlersRef.current.cancel();
      previousConfirm = confirmPressed;
      previousCancel = cancelPressed;
      animationFrame = requestAnimationFrame(pollGamepad);
    };

    animationFrame = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // ── Render helpers ──

  const gridW = liveState?.grid.width ?? 0;
  const gridH = liveState?.grid.height ?? 0;
  const isPlayerPhaseNow = liveState?.phase === "player" && !animating;

  const renderUnits = useMemo(() => {
    if (!liveState) return [];
    return (
      liveState.units
        .map((u) => {
          const anim = animUnits?.get(u.id);
          let x = anim?.x ?? u.x;
          let y = anim?.y ?? u.y;
          // Staged-move preview: while nothing is animating, render the selected unit's
          // token at its staged destination so the move reads as INSTANT feedback. The
          // token tweens there via UnitToken's framer-motion animate on left/top.
          if (!animUnits && stagedMove && selectedUnitId === u.id) {
            x = stagedMove.x;
            y = stagedMove.y;
          }
          // Committed move in flight: hold the mover at its destination until playEvents
          // takes over (its baseline is pre-applied with this same position).
          if (!animUnits && optimisticMove && optimisticMove.unitId === u.id) {
            x = optimisticMove.to.x;
            y = optimisticMove.to.y;
          }
          return {
            unit: u,
            x,
            y,
            hp: anim?.hp ?? u.hp,
            // Uncommitted move preview — the token needs distinct "not real yet" styling.
            staged: !animUnits && !!stagedMove && selectedUnitId === u.id,
          };
        })
        // KO'd units leave the battlefield (FE-style). The defeat event zeroes hp
        // in the anim map, so the token exits mid-playback via AnimatePresence;
        // they stay in `state.units` for the summary/outcome screens.
        .filter((r) => r.hp > 0)
    );
  }, [liveState, animUnits, stagedMove, selectedUnitId, optimisticMove]);

  // ── Loading / error states (translucent so the scene shows through) ──
  if (starting) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950/60 text-white/80 backdrop-blur-sm">
        <Sword className="h-8 w-8 animate-pulse text-amber-300" />
        <p className="text-sm">{localizeUi("ui.game.tacticalcombatui.deployingTheTacticalBattlefield")}</p>
      </div>
    );
  }

  if (startError || !liveState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950/70 p-6 text-center text-white/80 backdrop-blur-sm">
        <SkullIcon className="h-8 w-8 text-red-400" />
        <p className="text-sm">{startError ?? "The battlefield failed to load."}</p>
        <button
          type="button"
          onClick={() => {
            // Clear any stale snapshot (e.g. the old terminal state after a failed
            // restart) so the next battle can't restore — and auto-hand-off — it.
            onCombatEnd("flee", { outcome: "flee", rounds: 0, party: [], enemies: [] });
          }}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          {localizeUi("ui.game.tacticalcombatui.retreatToStory")}
        </button>
      </div>
    );
  }

  const outcome = liveState.outcome;
  const isPlayerPhase = isPlayerPhaseNow;
  // Raw player-phase flag (ignores `animating`) so the End Turn / Flee controls
  // stay visible-but-disabled during resolution instead of vanishing — dropped
  // clicks then read as "greyed out", not "the button disappeared".
  const playerPhase = liveState.phase === "player";

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleCombatKeyDown}
      aria-label={localizeUi("ui.game.tacticalcombatui.tacticalCombat")}
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950/60 text-white select-none"
    >
      {/* One-off keyframes for shimmer / range pulse / ready glow (self-contained).
          Ready glow uses the app's --primary accent (theme-aware) via color-mix. */}
      <style>{`
        @keyframes tc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes tc-move-range { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.55; } }
        @keyframes tc-ready-glow { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 9px 2px color-mix(in srgb, var(--primary) 55%, transparent); } }
      `}</style>

      {/* Radial vignette so the grid reads against the scene art without an opaque fill. */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.45) 60%, rgba(2,6,23,0.78) 100%)",
        }}
      />

      {/* Crit flash overlay */}
      {critFlash && <div className="pointer-events-none absolute inset-0 z-30 animate-pulse bg-white/25" />}

      {/* Top bar: round/phase + controls */}
      <div className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-black/40 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
              liveState.phase === "player"
                ? "bg-[var(--primary)]/25 text-[var(--primary)]"
                : "bg-[var(--destructive)]/25 text-[var(--destructive)]",
            )}
          >
            {liveState.phase === "player"
              ? localizeUi("ui.game.tacticalcombatui.playerPhase")
              : localizeUi("ui.game.tacticalcombatui.enemyPhase")}
          </span>
          <span className="text-xs font-semibold text-white/60">
            {localizeUi("ui.game.gamecombatui.round")} {liveState.round}
          </span>
          <span className="hidden text-[0.65rem] font-medium uppercase tracking-wider text-white/40 sm:inline">
            {liveState.difficulty}
          </span>
          {objectives[0] && (
            <span className="hidden max-w-56 truncate rounded-md border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[0.65rem] text-amber-100 md:inline">
              {objectives[0].label}: {objectives[0].status}
            </span>
          )}
          {animating && (
            <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[0.65rem] font-semibold text-white/70">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 shadow-[0_0_6px_1px_rgba(252,211,77,0.7)]" />
              {localizeUi("ui.game.tacticalcombatui.resolving")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAnimationSpeed((speed) => (speed >= 4 ? 1 : speed * 2))}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            title={localizeUi("ui.game.tacticalcombatui.animationSpeed")}
          >
            {animationSpeed}×
          </button>
          <button
            type="button"
            onClick={() => setShowThreat((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
              showThreat
                ? "border-[var(--destructive)]/40 bg-[var(--destructive)]/20 text-[var(--destructive)]"
                : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10",
            )}
            title={localizeUi("ui.game.tacticalcombatui.toggleEnemyThreatRange")}
          >
            {showThreat ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="hidden sm:inline">{localizeUi("ui.game.tacticalcombatui.threat")}</span>
          </button>
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10"
            title={localizeUi("ui.game.tacticalcombatui.combatLog")}
          >
            <ScrollText size={13} />
            <span className="hidden sm:inline">{localizeUi("ui.game.gamecombatui.log")}</span>
          </button>
          {/* Restart is available in BOTH phases (greyed while resolving, like End Turn). */}
          <button
            type="button"
            onClick={() => setRestartConfirm(true)}
            disabled={animating}
            className={cn(
              "flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10",
              animating && "cursor-not-allowed opacity-40 hover:bg-white/5",
            )}
            title={localizeUi("ui.game.tacticalcombatui.restartTheBattle")}
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">{localizeUi("ui.game.tacticalcombatui.restart")}</span>
          </button>
          {playerPhase && (
            <>
              <button
                type="button"
                onClick={endTurn}
                disabled={animating}
                className={cn(
                  "rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/30",
                  animating && "cursor-not-allowed opacity-40 hover:bg-[var(--primary)]/20",
                )}
              >
                {localizeUi("ui.game.tacticalcombatui.endTurn")}
              </button>
              <button
                type="button"
                onClick={() => setFleeConfirm(true)}
                disabled={animating}
                className={cn(
                  "flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10",
                  animating && "cursor-not-allowed opacity-40 hover:bg-white/5",
                )}
                title={localizeUi("ui.game.tacticalcombatui.fleeTheBattle")}
              >
                <Flag size={13} />
                <span className="hidden sm:inline">{localizeUi("ui.game.tacticalcombatui.flee")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Battlefield */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-4">
        <div
          className="relative"
          style={{
            aspectRatio: `${gridW} / ${gridH}`,
            width: "min(100%, calc((100vh - 14rem) * " + gridW + " / " + gridH + "))",
            maxWidth: "100%",
          }}
        >
          {/* Tile grid */}
          <div
            className="absolute inset-0 grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${gridW}, 1fr)`,
              gridTemplateRows: `repeat(${gridH}, 1fr)`,
            }}
          >
            {liveState.grid.tiles.flatMap((row, y) =>
              row.map((terrain, x) => {
                const key = `${x},${y}`;
                const inMove = movementKeys.has(key);
                const inThreat = threatKeys.has(key);
                const isStaged = stagedMove?.x === x && stagedMove?.y === y;
                // While a move is staged, mark the unit's REAL tile so the preview
                // reads as "came from here, not committed yet".
                const isMoveOrigin = !!stagedMove && !!selectedUnit && selectedUnit.x === x && selectedUnit.y === y;
                const isInspected = inspectTile?.x === x && inspectTile?.y === y;
                const hazard = liveState.hazards?.find((candidate) => candidate.x === x && candidate.y === y);
                const icon = resolveTerrainIcon(activeEnvironment, terrain);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onTileClick(x, y)}
                    className={cn(
                      "group relative overflow-hidden rounded-[3px] transition-all duration-150",
                      isInspected && "ring-1 ring-white/70",
                    )}
                    style={{ backgroundColor: palette[terrain] + TILE_ALPHA, boxShadow: tileShadow(terrain) }}
                    title={TERRAIN_DATA[terrain].label}
                  >
                    {/* Painted terrain texture (rotated per-tile for variety) */}
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundImage: `url(${TILE_TEXTURES[terrain]})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        transform: `rotate(${((x * 7 + y * 13) % 4) * 90}deg) scale(1.03)`,
                      }}
                    />
                    {/* Environment palette tint over the texture */}
                    <span
                      className="pointer-events-none absolute inset-0"
                      style={{ backgroundColor: palette[terrain] + tileTintAlpha }}
                    />
                    {/* Top-light depth gradient */}
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25" />
                    {/* Water shimmer (CSS only) */}
                    {terrain === "water" && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(115deg, transparent 30%, rgba(125,211,252,0.35) 50%, transparent 70%)",
                          backgroundSize: "200% 200%",
                          animation: "tc-shimmer 3.5s linear infinite",
                        }}
                      />
                    )}
                    {icon && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.7em] opacity-45">
                        {icon}
                      </span>
                    )}
                    {hazard && (
                      <span
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center animate-pulse text-[0.8em]"
                        title={hazard.name}
                      >
                        {hazard.element === "poison" ? "☠" : hazard.element === "lightning" ? "⚡" : "🔥"}
                      </span>
                    )}
                    {inMove && !isStaged && (
                      <span
                        className="pointer-events-none absolute inset-0 bg-[var(--primary)]/40 ring-1 ring-inset ring-[var(--primary)]/60"
                        style={{ animation: "tc-move-range 1.5s ease-in-out infinite" }}
                      />
                    )}
                    {inThreat && (
                      <span className="pointer-events-none absolute inset-0 bg-[var(--destructive)]/20 ring-1 ring-inset ring-[var(--destructive)]/30" />
                    )}
                    {isStaged && (
                      <span className="pointer-events-none absolute inset-0 animate-pulse bg-[var(--primary)]/50 ring-2 ring-inset ring-[var(--primary)]" />
                    )}
                    {isMoveOrigin && (
                      <span className="pointer-events-none absolute inset-0 rounded-[3px] border-2 border-dashed border-[var(--primary)]/80" />
                    )}
                  </button>
                );
              }),
            )}
          </div>

          {/* Unit tokens (KO'd units exit-fade off the board) */}
          <AnimatePresence>
            {renderUnits.map(({ unit, x, y, hp, staged }) => {
              const isSel = selectedUnitId === unit.id;
              const isTarget = ui.kind === "target" && targetIds.has(unit.id);
              const isForecastTarget = forecastTargetId === unit.id;
              const ready = !isSel && isPlayerPhase && unit.side === "party" && !unit.hasActed && !unit.hasMoved;
              return (
                <UnitToken
                  key={unit.id}
                  unit={unit}
                  hp={hp}
                  gridW={gridW}
                  gridH={gridH}
                  x={x}
                  y={y}
                  selected={isSel}
                  targetable={isTarget}
                  forecastTarget={isForecastTarget}
                  preview={staged}
                  ready={ready}
                  onClick={() => {
                    if (isTarget && ui.kind === "target" && ui.action !== "attack") {
                      const isSupport = ui.action === "item" || (ui.action === "skill" && ui.skill?.type !== "attack");
                      if (isSupport) {
                        onSupportTarget(unit.id);
                        return;
                      }
                    }
                    onTokenClick(unit);
                  }}
                />
              );
            })}
          </AnimatePresence>

          {/* Floating damage popups */}
          <AnimatePresence>
            {popups.map((p) => {
              const left = ((p.x + 0.5) / gridW) * 100;
              const top = ((p.y + 0.5) / gridH) * 100;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 0, scale: 0.7 }}
                  animate={{ opacity: 1, y: -24, scale: p.tone === "crit" ? 1.35 : 1 }}
                  exit={{ opacity: 0, y: -38 }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
                    p.tone === "damage" && "text-red-300",
                    p.tone === "crit" && "text-amber-300",
                    p.tone === "heal" && "text-emerald-300",
                    p.tone === "miss" && "text-white/70 italic",
                    p.tone === "status" && "text-violet-300 text-xs",
                  )}
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {p.text}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Phase banner sweep (FE-style, tinted by side) */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={banner.text}
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.45 }}
              className={cn(
                "pointer-events-none absolute left-0 right-0 top-1/2 z-30 -translate-y-1/2 py-4 text-center text-2xl font-black uppercase tracking-widest text-white drop-shadow-lg",
                banner.tone === "enemy"
                  ? "bg-gradient-to-r from-[var(--destructive)]/0 via-[var(--destructive)]/70 to-[var(--destructive)]/0"
                  : "bg-gradient-to-r from-[var(--primary)]/0 via-[var(--primary)]/70 to-[var(--primary)]/0",
              )}
            >
              {banner.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inspect card (terrain + unit) — draggable within the battle surface. */}
      {inspectTile && !outcome && (
        <TileInspect
          state={liveState}
          tile={inspectTile}
          onClose={() => setInspectTile(null)}
          constraintsRef={rootRef}
        />
      )}

      {/* Action menu / target forecast (bottom sheet on mobile, side card on desktop) */}
      {isPlayerPhase && selectedUnit && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-2 sm:justify-end sm:p-4">
          <motion.div
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={rootRef}
            style={{ x: actionMenuX, y: actionMenuY }}
            className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-slate-900/85 p-3 shadow-2xl backdrop-blur-md sm:w-72"
          >
            <div className="mb-2 flex cursor-grab items-center justify-between active:cursor-grabbing">
              <span className="flex min-w-0 items-center text-sm font-bold text-white">
                <GripVertical className="mr-1 h-3 w-3 shrink-0 text-white/40" />
                {selectedUnit.isPlayer && <Crown className="mr-1 inline h-3.5 w-3.5 shrink-0 text-amber-300" />}
                <span className="truncate">{selectedUnit.name}</span>
              </span>
              <button type="button" onClick={resetSelection} className="text-white/50 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Action menu */}
            {ui.kind === "unit" && (
              <>
                {selectedUnit.hasMoved && !selectedUnit.hasActed && (
                  <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5 text-[0.7rem] italic text-white/60">
                    <Footprints className="h-3.5 w-3.5 text-[var(--primary)]" />
                    {localizeUi("ui.game.tacticalcombatui.alreadyMovedChooseAnAction")}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {stagedMove && !selectedUnit.hasMoved && (
                    <ActionButton
                      icon={Footprints}
                      label={localizeUi("ui.game.tacticalcombatui.confirmMove")}
                      color="text-[var(--primary)]"
                      onClick={commitMove}
                      disabled={animating}
                    />
                  )}
                  {getTargetsInRange(stagedState ?? liveState, selectedUnit.id, stagedMove ?? undefined).length > 0 && (
                    <ActionButton
                      icon={Sword}
                      label={localizeUi("ui.game.tacticalcombatui.attack")}
                      color="text-[var(--destructive)]"
                      onClick={() => chooseAction("attack")}
                      disabled={animating}
                    />
                  )}
                  {selectedUnit.skills.length > 0 && (
                    <ActionButton
                      icon={Sparkles}
                      label={localizeUi("ui.game.gamecharactersheet.skills")}
                      color="text-[var(--primary)]"
                      onClick={() => chooseAction("skills")}
                      disabled={animating}
                    />
                  )}
                  {availableItems.length > 0 && (
                    <ActionButton
                      icon={Backpack}
                      label={localizeUi("ui.game.tacticalcombatui.item")}
                      color="text-emerald-300"
                      onClick={() => chooseAction("item")}
                      disabled={animating}
                    />
                  )}
                  <ActionButton
                    icon={Sparkles}
                    label={localizeUi("ui.game.tacticalcombatui.maneuver")}
                    color="text-fuchsia-300"
                    onClick={() => chooseAction("maneuver")}
                    disabled={animating}
                  />
                  <ActionButton
                    icon={Shield}
                    label={localizeUi("ui.game.tacticalcombatui.defend")}
                    color="text-amber-300"
                    onClick={() => chooseAction("defend")}
                    disabled={animating}
                  />
                  {selectedUnit.attackRange.max > 1 && (
                    <ActionButton
                      icon={Crosshair}
                      label={localizeUi("ui.game.tacticalcombatui.overwatch")}
                      color="text-cyan-300"
                      onClick={() => chooseAction("overwatch")}
                      disabled={animating}
                    />
                  )}
                  <ActionButton
                    icon={Hourglass}
                    label={localizeUi("ui.game.tacticalcombatui.wait")}
                    color="text-white/70"
                    onClick={() => chooseAction("wait")}
                    disabled={animating}
                  />
                  {stagedMove && (
                    <ActionButton
                      icon={Wind}
                      label={localizeUi("ui.game.tacticalcombatui.resetMove")}
                      color="text-white/60"
                      onClick={() => setStagedMove(null)}
                      disabled={animating}
                    />
                  )}
                </div>
              </>
            )}

            {/* Skill list */}
            {ui.kind === "skills" && (
              <div className="flex flex-col gap-1.5">
                {selectedUnit.skills.map((skill) => {
                  const cd = selectedUnit.skillCooldowns[skill.name] ?? 0;
                  const ready = cd <= 0 && selectedUnit.mp >= skill.mpCost && !animating;
                  return (
                    <button
                      type="button"
                      key={skill.id ?? skill.name}
                      disabled={!ready}
                      onClick={() => chooseSkill(skill)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                        ready
                          ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-white hover:bg-[var(--primary)]/20"
                          : "border-white/10 bg-white/5 text-white/40",
                      )}
                    >
                      <span className="font-semibold">{skill.name}</span>
                      <span className="flex items-center gap-1.5 text-[0.65rem] text-white/60">
                        <span className="uppercase">{skill.type}</span>
                        {skill.mpCost > 0 && (
                          <span className="text-sky-300">
                            {skill.mpCost} {localizeUi("ui.game.gamecombatui.mp")}
                          </span>
                        )}
                        {cd > 0 && (
                          <span className="text-amber-300">
                            {localizeUi("ui.game.tacticalcombatui.cd")} {cd}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setUi({ kind: "unit", unitId: selectedUnit.id })}
                  className="mt-1 text-center text-xs text-white/50 hover:text-white"
                >
                  {localizeUi("ui.game.tacticalcombatui.back")}
                </button>
              </div>
            )}

            {ui.kind === "maneuver" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-white/65">{localizeUi("ui.game.tacticalcombatui.maneuverHelp")}</p>
                <textarea
                  value={maneuverText}
                  onChange={(event) => setManeuverText(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={localizeUi("ui.game.tacticalcombatui.maneuverPlaceholder")}
                  className="resize-none rounded-lg border border-white/15 bg-black/25 px-2.5 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-fuchsia-300/50"
                />
                {maneuverTargetId && (
                  <p className="text-[0.7rem] text-fuchsia-200">
                    {localizeUi("ui.game.tacticalcombatui.maneuverTarget")}:{" "}
                    {liveState.units.find((unit) => unit.id === maneuverTargetId)?.name}
                  </p>
                )}
                {objectives.some((objective) => objective.status === "active") && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[0.65rem] font-semibold uppercase text-white/45">
                      {localizeUi("ui.game.tacticalcombatui.objective")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {objectives
                        .filter((objective) => objective.status === "active")
                        .map((objective) => (
                          <button
                            key={objective.id}
                            type="button"
                            onClick={() =>
                              setManeuverObjectiveId((current) => (current === objective.id ? null : objective.id))
                            }
                            className={cn(
                              "rounded border px-2 py-1 text-[0.65rem] transition-colors",
                              maneuverObjectiveId === objective.id
                                ? "border-amber-300/50 bg-amber-400/20 text-amber-100"
                                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            {objective.label}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitManeuver}
                    disabled={maneuverText.trim().length < 3 || animating}
                    className="flex-1 rounded-lg border border-fuchsia-300/35 bg-fuchsia-500/15 px-3 py-2 text-xs font-bold text-fuchsia-100 hover:bg-fuchsia-500/25 disabled:opacity-40"
                  >
                    {localizeUi("ui.game.tacticalcombatui.resolveManeuver")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setUi({ kind: "unit", unitId: selectedUnit.id })}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/65 hover:bg-white/10"
                  >
                    {localizeUi("ui.game.tacticalcombatui.back")}
                  </button>
                </div>
              </div>
            )}

            {ui.kind === "items" && (
              <div className="flex flex-col gap-1.5">
                {availableItems.map((item) => {
                  const effect = itemEffectFor(item.name);
                  return (
                    <button
                      type="button"
                      key={item.name}
                      disabled={!effect || animating}
                      onClick={() => chooseItem(item.name)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                        effect
                          ? "border-emerald-300/30 bg-emerald-500/10 text-white hover:bg-emerald-500/20"
                          : "border-white/10 bg-white/5 text-white/40",
                      )}
                    >
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-[0.65rem] text-white/60">×{item.quantity}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setUi({ kind: "unit", unitId: selectedUnit.id })}
                  className="mt-1 text-center text-xs text-white/50 hover:text-white"
                >
                  {localizeUi("ui.game.tacticalcombatui.back")}
                </button>
              </div>
            )}

            {/* Target / forecast */}
            {ui.kind === "target" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-white/70">
                  {ui.action === "attack"
                    ? localizeUi("ui.game.tacticalcombatui.selectATarget")
                    : ui.action === "item"
                      ? itemEffectFor(ui.itemName)?.target === "enemy"
                        ? localizeUi("ui.game.tacticalcombatui.selectAnEnemy")
                        : localizeUi("ui.game.tacticalcombatui.selectAnAlly")
                      : ui.skill?.type === "attack"
                        ? localizeUi("ui.game.tacticalcombatui.selectATarget")
                        : ui.skill?.type === "debuff"
                          ? localizeUi("ui.game.tacticalcombatui.selectAnEnemy")
                          : localizeUi("ui.game.tacticalcombatui.selectAnAlly")}
                </p>
                {targetIds.size === 0 && (
                  <p className="text-xs italic text-white/50">
                    {(() => {
                      const isAttack = ui.action === "attack" || (ui.action === "skill" && ui.skill?.type === "attack");
                      if (isAttack) {
                        const range = selectedUnit.attackRange;
                        const rng = range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
                        if (range.min > 1) {
                          const cls = unitClassOf(selectedUnit);
                          const plural = `${CLASS_PROFILES[cls].label.toLowerCase()}s`;
                          return `No targets in range ${rng} — ${plural} can't strike adjacent foes.`;
                        }
                        return `No targets in range ${rng}.`;
                      }
                      if (ui.action === "skill" && ui.skill?.type === "debuff") return "No enemies in range.";
                      return "No allies in range.";
                    })()}
                  </p>
                )}

                {forecast && forecastTargetId && (
                  <ForecastPanel
                    forecast={forecast}
                    attacker={selectedUnit}
                    defender={liveState.units.find((u) => u.id === forecastTargetId) ?? null}
                  />
                )}

                <div className="flex gap-2">
                  {forecast && forecastTargetId && (
                    <button
                      type="button"
                      onClick={confirmTarget}
                      disabled={animating}
                      className={cn(
                        "flex-1 rounded-lg border border-[var(--destructive)]/50 bg-[var(--destructive)]/80 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--destructive)]",
                        animating && "cursor-not-allowed opacity-40 hover:bg-[var(--destructive)]/80",
                      )}
                    >
                      {localizeUi("ui.game.tacticalcombatui.confirm")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setForecastTargetId(null);
                      setUi({ kind: "unit", unitId: selectedUnit.id });
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
                  >
                    {localizeUi("ui.noodle.noodlerframe.back")}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Combat log drawer */}
      {logOpen && (
        <div className="absolute inset-0 z-40 flex" onClick={() => setLogOpen(false)}>
          <div
            className="ml-auto h-full w-full max-w-sm border-l border-[var(--border)] bg-slate-950/95 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-bold">{localizeUi("ui.game.gamecombatui.combatLog")}</span>
              <button type="button" onClick={() => setLogOpen(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(100%-3.25rem)] overflow-y-auto px-4 py-3 text-xs leading-relaxed">
              {liveState.log.map((ev, i) => (
                <p
                  key={i}
                  className={cn(
                    "border-b border-white/5 py-1",
                    ev.kind === "phase" && "font-bold text-amber-200",
                    ev.kind === "crit" && "font-semibold text-amber-300",
                    ev.kind === "defeat" && "text-red-300",
                    ev.kind === "heal" && "text-emerald-300",
                    ev.kind === "miss" && "italic text-white/50",
                  )}
                >
                  {ev.text}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Flee confirm */}
      {fleeConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-slate-900 p-5 text-center">
            <Flag className="mx-auto mb-2 h-6 w-6 text-amber-300" />
            <p className="mb-4 text-sm text-white/90">
              {localizeUi("ui.game.tacticalcombatui.retreatFromThisBattleTheGmWillNarrateYour")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmFlee}
                className="flex-1 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/20 px-3 py-2 text-sm font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/30"
              >
                {localizeUi("ui.game.tacticalcombatui.flee")}
              </button>
              <button
                type="button"
                onClick={() => setFleeConfirm(false)}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
              >
                {localizeUi("ui.game.tacticalcombatui.stay")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart confirm (patterned after the flee confirm) */}
      {restartConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-slate-900 p-5 text-center">
            <RotateCcw className="mx-auto mb-2 h-6 w-6 text-[var(--primary)]" />
            <p className="mb-4 text-sm text-white/90">
              {localizeUi("ui.game.tacticalcombatui.restartThisBattleFromTheBeginningAFreshBattlefield")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestartConfirm(false);
                  restartBattle();
                }}
                className="flex-1 rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/20 px-3 py-2 text-sm font-bold text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/30"
              >
                {localizeUi("ui.game.tacticalcombatui.restart")}
              </button>
              <button
                type="button"
                onClick={() => setRestartConfirm(false)}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
              >
                {localizeUi("ui.game.tacticalcombatui.keepFighting")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome screen */}
      {outcome && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center backdrop-blur">
          {outcome === "victory" && <Trophy className="h-14 w-14 text-amber-300" />}
          {outcome === "defeat" && <SkullIcon className="h-14 w-14 text-[var(--destructive)]" />}
          {outcome === "fled" && <Wind className="h-14 w-14 text-[var(--primary)]" />}
          <h2
            className={cn(
              "text-3xl font-black uppercase tracking-widest",
              outcome === "victory" && "text-amber-300",
              outcome === "defeat" && "text-[var(--destructive)]",
              outcome === "fled" && "text-[var(--primary)]",
            )}
          >
            {outcome === "victory"
              ? localizeUi("ui.game.tacticalcombatui.victory")
              : outcome === "defeat"
                ? localizeUi("ui.game.tacticalcombatui.defeat")
                : localizeUi("ui.game.tacticalcombatui.retreated")}
          </h2>
          {outcome === "defeat" ? (
            // Defeat doesn't auto-hand off (see maybeEnd) — let the player retry or bow out.
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restartBattle}
                className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/20 px-4 py-2 text-sm font-bold text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/30"
              >
                {localizeUi("ui.game.tacticalcombatui.retryBattle")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const summary = terminalSummaryRef.current ?? {
                    ...buildTacticalSummary(liveState),
                    ...(sessionId ? { sessionId } : {}),
                    objectives,
                    inventory: (liveState.inventory ?? []).map((item) => ({ ...item })),
                  };
                  onCombatEnd(summary.outcome, summary);
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
              >
                {localizeUi("ui.noodle.wizardfooter.continue")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-white/60">{localizeUi("ui.game.tacticalcombatui.returningToTheStory")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

interface UnitTokenProps {
  unit: TacticalUnit;
  hp: number;
  gridW: number;
  gridH: number;
  x: number;
  y: number;
  selected: boolean;
  targetable: boolean;
  forecastTarget: boolean;
  /** Uncommitted staged-move position — rendered translucent + dashed. */
  preview: boolean;
  ready: boolean;
  onClick: () => void;
}

function UnitToken({
  unit,
  hp,
  gridW,
  gridH,
  x,
  y,
  selected,
  targetable,
  forecastTarget,
  preview,
  ready,
  onClick,
}: UnitTokenProps) {
  const left = ((x + 0.5) / gridW) * 100;
  const top = ((y + 0.5) / gridH) * 100;
  const cellW = 100 / gridW;
  const sprite = resolveSprite(unit.sprite);
  const ring = ringColorFor(unit.id, unit.side);
  const ClassIcon = CLASS_ICONS[unitClassOf(unit)];
  const hpPct = unit.maxHp > 0 ? Math.max(0, (hp / unit.maxHp) * 100) : 0;
  const hpColor = hpPct > 60 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-red-500";
  const mpPct = unit.maxMp > 0 ? Math.max(0, (unit.mp / unit.maxMp) * 100) : 0;

  const style: CSSProperties = {
    left: `${left}%`,
    top: `${top}%`,
    width: `${cellW * 0.9}%`,
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={false}
      // Opacity lives HERE (inline) — framer would override a Tailwind opacity
      // class anyway. Exit is opacity-only: a scale would drop the centering
      // translate the className provides.
      animate={{
        left: `${left}%`,
        top: `${top}%`,
        opacity: preview ? 0.75 : unit.hasActed && unit.side === "party" ? 0.6 : 1,
      }}
      exit={{ opacity: 0 }}
      whileHover={{ scale: 1.09 }}
      transition={{ type: "tween", duration: 0.25 }}
      style={style}
      className={cn(
        "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
        unit.hasActed && unit.side === "party" && "grayscale",
      )}
    >
      <div
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-full border-2 shadow-lg drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]",
          selected && "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-slate-900",
          targetable && "ring-2 ring-[var(--destructive)] animate-pulse",
          forecastTarget && "ring-2 ring-[var(--destructive)] ring-offset-1 ring-offset-slate-900",
          preview && "outline-dashed outline-2 outline-offset-2 outline-[var(--primary)]",
        )}
        style={{
          borderColor: ring,
          backgroundColor: unit.side === "party" ? "rgba(30,58,90,0.9)" : "rgba(90,30,40,0.9)",
          animation: ready ? "tc-ready-glow 1.8s ease-in-out infinite" : undefined,
        }}
      >
        {sprite.kind === "url" ? (
          <img src={sprite.value} alt={unit.name} className="h-full w-full rounded-full object-cover" />
        ) : sprite.kind === "emoji" ? (
          <span className="text-[min(4vw,1.5rem)] leading-none">{sprite.value}</span>
        ) : (
          <span className="text-[min(3vw,0.9rem)] font-black text-white/90">{initialsOf(unit.name)}</span>
        )}
        {unit.isPlayer && (
          <Crown className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 text-amber-300 drop-shadow" />
        )}
        {unit.isBoss && (
          <Skull className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 text-[var(--destructive)] drop-shadow" />
        )}
        {/* Class badge (corner, side-tinted) */}
        <span
          className="absolute -bottom-0.5 -right-0.5 flex h-[13px] w-[13px] items-center justify-center rounded-full border shadow-sm"
          style={{
            backgroundColor: unit.side === "party" ? "rgba(30,58,90,0.95)" : "rgba(90,30,40,0.95)",
            borderColor: ring,
          }}
        >
          <ClassIcon className="h-2 w-2 text-white/90" />
        </span>
      </div>
      {/* HP bar */}
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-black/60">
        <div className={cn("h-full transition-all duration-300", hpColor)} style={{ width: `${hpPct}%` }} />
      </div>
      {unit.maxMp > 0 && (
        <div className="mt-[1px] h-[2px] w-full overflow-hidden rounded-full bg-black/60">
          <div className="h-full bg-sky-400 transition-all duration-300" style={{ width: `${mpPct}%` }} />
        </div>
      )}
    </motion.button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: typeof Sword;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-2.5 text-[0.68rem] font-semibold text-white/85 transition-colors hover:bg-white/15 active:scale-95",
        disabled && "cursor-not-allowed opacity-40 hover:bg-white/5 active:scale-100",
      )}
    >
      <Icon className={cn("h-5 w-5", color)} />
      {label}
    </button>
  );
}

function ForecastPanel({
  forecast,
  attacker,
  defender,
}: {
  forecast: ReturnType<typeof forecastAttack>;
  attacker: TacticalUnit;
  defender: TacticalUnit | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/40 p-2 text-xs"
    >
      <ForecastSide
        unit={attacker}
        tone="text-[var(--primary)]"
        headerBg="bg-[var(--primary)]/20"
        damage={forecast.damage}
        hit={forecast.hitChance}
        crit={forecast.critChance}
      />
      {forecast.counter && defender ? (
        <ForecastSide
          unit={defender}
          tone="text-[var(--destructive)]"
          headerBg="bg-[var(--destructive)]/20"
          label={localizeUi("ui.game.forecastpanel.counters")}
          damage={forecast.counter.damage}
          hit={forecast.counter.hitChance}
          crit={forecast.counter.critChance}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-white/5 text-center text-[0.65rem] text-white/40">
          <span className="font-semibold">{defender?.name ?? "Target"}</span>
          {defender && <ClassChip unit={defender} muted />}
          <span>{localizeUi("ui.game.forecastpanel.noCounter")}</span>
        </div>
      )}
    </motion.div>
  );
}

function ForecastSide({
  unit,
  tone,
  headerBg,
  label,
  damage,
  hit,
  crit,
}: {
  unit: TacticalUnit;
  tone: string;
  headerBg: string;
  label?: string;
  damage: number;
  hit: number;
  crit: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="overflow-hidden rounded-lg bg-white/5">
      <div className={cn("truncate px-1.5 py-1 text-[0.65rem] font-bold", headerBg, tone)}>
        {unit.name}
        {label && <span className="font-normal text-white/50"> {label}</span>}
      </div>
      <div className="px-1.5 pb-1.5 pt-1">
        <div className="mb-1">
          <ClassChip unit={unit} />
        </div>
        <div className="flex items-baseline gap-1">
          <Sword className="h-3 w-3 text-white/50" />
          <span className="text-base font-black text-white">{damage}</span>
        </div>
        <div className="flex justify-between text-[0.6rem] text-white/60">
          <span>
            {localizeUi("ui.game.forecastside.hit")} {Math.round(hit)}%
          </span>
          <span className="text-amber-300/80">
            {localizeUi("ui.game.forecastside.crit")} {Math.round(crit)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Class chip: lucide icon + label + attack-range text ──
function ClassChip({ unit, muted }: { unit: TacticalUnit; muted?: boolean }) {
  const cls = unitClassOf(unit);
  const profile = CLASS_PROFILES[cls];
  const Icon = CLASS_ICONS[cls];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-semibold",
        muted ? "text-white/50" : "text-white/80",
      )}
    >
      <Icon className={cn("h-3 w-3", muted ? "text-white/50" : "text-[var(--primary)]")} />
      <span>{profile.label}</span>
      <span className="text-white/45">· {rangeText(unit.attackRange)}</span>
    </span>
  );
}

function TileInspect({
  state,
  tile,
  onClose,
  constraintsRef,
}: {
  state: TacticalCombatState;
  tile: TacticalCoord;
  onClose: () => void;
  /** Battle-surface root — bounds the card so it can't be dragged off-screen. */
  constraintsRef: RefObject<HTMLDivElement | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const terrain = state.grid.tiles[tile.y]?.[tile.x];
  if (!terrain) return null;
  const info = TERRAIN_DATA[terrain];
  const unit = state.units.find((u) => u.x === tile.x && u.y === tile.y && u.hp > 0);
  return (
    // Draggable within the battle surface. framer-motion distinguishes a click from
    // a drag, so the X close button keeps working. The card is NOT re-keyed when the
    // inspected tile changes, so its dragged position persists while mounted.
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={constraintsRef}
      className="pointer-events-auto absolute left-2 top-2 z-20 w-44 rounded-xl border border-[var(--border)] bg-slate-900/95 p-2.5 text-xs shadow-xl backdrop-blur sm:left-4 sm:top-16"
    >
      <div className="mb-1 flex cursor-grab items-center justify-between active:cursor-grabbing">
        <span className="flex items-center gap-1 font-bold text-white">
          <GripVertical className="h-3 w-3 text-white/40" />
          {info.label}
        </span>
        <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
          <X size={13} />
        </button>
      </div>
      <div className="flex gap-2 text-[0.65rem] text-white/60">
        {info.impassable ? (
          <span className="font-semibold text-red-300/80">{localizeUi("ui.game.tileinspect.impassable")}</span>
        ) : (
          <>
            <span>
              {localizeUi("ui.game.tileinspect.def")}
              {info.defenseBonus}
            </span>
            <span>
              {localizeUi("ui.game.tileinspect.avoid")}
              {info.avoidBonus}%
            </span>
          </>
        )}
      </div>
      {unit && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="flex items-center gap-1 font-semibold text-white">
            {unit.isPlayer && <Crown className="h-3 w-3 text-amber-300" />}
            {unit.isBoss && <Skull className="h-3 w-3 text-[var(--destructive)]" />}
            <span className="truncate">{unit.name}</span>
            <span className="ml-auto text-[0.6rem] text-white/40">
              {localizeUi("ui.game.tileinspect.lv")} {unit.level}
            </span>
          </div>
          <div className="mt-1">
            <ClassChip unit={unit} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-[0.65rem] text-white/70">
            <Heart className="h-3 w-3 text-red-400" />
            {unit.hp}/{unit.maxHp}
            {unit.maxMp > 0 && (
              <>
                <Droplets className="ml-1 h-3 w-3 text-sky-400" />
                {unit.mp}/{unit.maxMp}
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[0.6rem] text-white/50">
            <span>
              {localizeUi("ui.game.tileinspect.atk")} {unit.attack}
            </span>
            <span>
              {localizeUi("ui.game.tileinspect.def_6dae29c")} {unit.defense}
            </span>
            <span>
              {localizeUi("ui.game.tileinspect.spd")} {unit.speed}
            </span>
            <span>
              {localizeUi("ui.game.tileinspect.mov")} {unit.movement}
            </span>
          </div>
          {unit.statusEffects.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {unit.statusEffects.map((e, i) => (
                <span key={i} className="rounded bg-violet-500/20 px-1 text-[0.55rem] text-violet-200">
                  {e.name} ({e.turnsLeft})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default TacticalCombatUI;
