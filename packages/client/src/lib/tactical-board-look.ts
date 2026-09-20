// How a battlefield LOOKS: the terrain palettes, the painted tile textures, the flavour icons and
// the token's own shapes.
//
// Moved here out of `TacticalCombatUI.tsx` unchanged, so the ruleset board and the tactical board
// draw the same product rather than two boards that drifted apart the first time a terrain theme
// was added. Nothing in this file decides anything: it holds colours, image paths and two tiny
// string helpers, and it knows nothing about either fight's rules.
import type { TacticalTerrain } from "@marinara-engine/shared";

// ── Environment terrain palettes ──
//
// Keyed by plain string so the file compiles regardless of whether the shared
// `TacticalEnvironment` union has landed yet. Every entry is a full terrain map;
// unknown environments fall back to "default" (the original colours). The
// resolved palette comes from the AUTHORITATIVE `state.environment` first, then
// the `environment` prop, then "default".

export const TERRAIN_PALETTES: Record<string, Record<TacticalTerrain, string>> = {
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
export const TERRAIN_ICON_OVERRIDES: Record<string, Partial<Record<TacticalTerrain, string>>> = {
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

export function resolveTerrainIcon(env: string | undefined, terrain: TacticalTerrain): string {
  return (env ? TERRAIN_ICON_OVERRIDES[env]?.[terrain] : undefined) ?? "";
}

// Per-tile depth: raised terrain (mountain/wall) reads embossed; the rest recessed.
export function tileShadow(terrain: TacticalTerrain): string {
  if (terrain === "mountain" || terrain === "wall") {
    return "inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.45)";
  }
  return "inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -3px 5px rgba(0,0,0,0.35)";
}

// ~0.88 alpha suffix so terrain colours stay readable but the scene shows through.
export const TILE_ALPHA = "e0";

// Painted top-down tile textures (packages/client/public/tactical/). The palette
// colour is layered over them as a tint so environment themes still recolour the field.
export const TILE_TEXTURES: Record<TacticalTerrain, string> = {
  plains: "/tactical/plains.webp",
  forest: "/tactical/forest.webp",
  mountain: "/tactical/mountain.webp",
  ruin: "/tactical/ruin.webp",
  water: "/tactical/water.webp",
  wall: "/tactical/wall.webp",
};

// Tint strength over the texture: a light wash for the default look, stronger
// when an environment theme needs to recolour the painted art (e.g. snow, volcanic).
export const TILE_TINT_ALPHA = "3d";
export const TILE_TINT_ALPHA_THEMED = "73";

/** The keyframes both boards animate with, rendered into a `<style>` by whichever one is mounted.
 *  They are never mounted at the same time, so one copy of the names is enough. */
export const TACTICAL_BOARD_KEYFRAMES = `
        @keyframes tc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes tc-move-range { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.55; } }
        @keyframes tc-ready-glow { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 9px 2px color-mix(in srgb, var(--primary) 55%, transparent); } }
      `;

// ── The token's own look ──

export type SpriteKind = { kind: "url"; value: string } | { kind: "emoji"; value: string } | { kind: "none" };

/** What a combatant's `sprite` string is: a picture, an emoji, or nothing to draw. */
export function resolveSprite(sprite: string | null | undefined): SpriteKind {
  if (!sprite) return { kind: "none" };
  const trimmed = sprite.trim();
  if (!trimmed) return { kind: "none" };
  if (/^(https?:|\/|data:|blob:)/i.test(trimmed)) return { kind: "url", value: trimmed };
  if (trimmed.length <= 12 && /\p{Extended_Pictographic}/u.test(trimmed)) return { kind: "emoji", value: trimmed };
  return { kind: "none" };
}

/** What a token shows when there is no picture: one or two letters of the name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic color ring from a unit id, so companions stay visually distinct.
export function ringColorFor(id: string, side: "party" | "enemy"): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = side === "party" ? 200 + (hash % 60) : 350 + (hash % 40);
  return `hsl(${hue % 360} 70% 55%)`;
}
