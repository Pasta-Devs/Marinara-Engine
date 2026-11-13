// ──────────────────────────────────────────────
// The overworld's plain tiles (worldgen W8): every look of the ground drawn with a flat colour and a
// small pattern, and plain settlement markers and party, so a setting with no tileset still reads at a
// glance and never borrows another setting's art. Each cell's pattern comes from its own position, so the
// same world always looks the same.
// ──────────────────────────────────────────────
import type { WorldGroundLook } from "@marinara-engine/shared";

/** Pixels per ground cell before the view's scale. */
export const OVERWORLD_TILE = 16;

type Ctx = CanvasRenderingContext2D;
/** A number 0..1 for the cell at (x, y) and the nth thing drawn in it. */
type Noise = (n: number) => number;

const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const dots =
  (color: string, count: number, size = 1) =>
  (ctx: Ctx, x: number, y: number, noise: Noise) => {
    for (let i = 0; i < count; i++) {
      px(
        ctx,
        color,
        x + Math.floor(noise(i * 2) * (16 - size)),
        y + Math.floor(noise(i * 2 + 1) * (16 - size)),
        size,
        size,
      );
    }
  };

const trees =
  (leaf: string, dark: string, count: number, trunk?: string) => (ctx: Ctx, x: number, y: number, noise: Noise) => {
    for (let i = 0; i < count; i++) {
      const tx = x + 1 + Math.floor(noise(i * 2) * 10);
      const ty = y + 1 + Math.floor(noise(i * 2 + 1) * 9);
      if (trunk) px(ctx, trunk, tx + 2, ty + 4, 1, 2);
      px(ctx, leaf, tx + 1, ty, 3, 1);
      px(ctx, leaf, tx, ty + 1, 5, 3);
      px(ctx, dark, tx + 1, ty + 3, 3, 1);
    }
  };

const bare = (wood: string, count: number) => (ctx: Ctx, x: number, y: number, noise: Noise) => {
  for (let i = 0; i < count; i++) {
    const tx = x + 2 + Math.floor(noise(i * 2) * 10);
    const ty = y + 2 + Math.floor(noise(i * 2 + 1) * 8);
    px(ctx, wood, tx + 1, ty, 1, 5);
    px(ctx, wood, tx, ty + 1);
    px(ctx, wood, tx + 2, ty + 2);
  }
};

const peaks = (rock: string, shade: string, cap: string) => (ctx: Ctx, x: number, y: number, noise: Noise) => {
  const offset = Math.floor(noise(0) * 3);
  for (let row = 0; row < 11; row++) {
    const half = Math.floor(row * 0.7);
    px(ctx, rock, x + 7 - half + offset - 1, y + 3 + row, half + 1, 1);
    px(ctx, shade, x + 7 + offset, y + 3 + row, half + 1, 1);
  }
  px(ctx, cap, x + 6 + offset, y + 3, 2, 2);
};

const waves = (crest: string) => (ctx: Ctx, x: number, y: number, noise: Noise) => {
  for (let i = 0; i < 2; i++) {
    const wx = x + 1 + Math.floor(noise(i * 2) * 10);
    const wy = y + 2 + Math.floor(noise(i * 2 + 1) * 11);
    px(ctx, crest, wx, wy, 3, 1);
    px(ctx, crest, wx + 3, wy - 1, 2, 1);
  }
};

const stripes = (color: string, gap: number) => (ctx: Ctx, x: number, y: number) => {
  for (let row = 1; row < 16; row += gap) px(ctx, color, x, y + row, 16, 1);
};

const blocks = (colors: string[], count: number, max: number) => (ctx: Ctx, x: number, y: number, noise: Noise) => {
  for (let i = 0; i < count; i++) {
    const w = 2 + Math.floor(noise(i * 3) * max);
    const h = 2 + Math.floor(noise(i * 3 + 1) * max);
    px(
      ctx,
      colors[i % colors.length]!,
      x + Math.floor(noise(i * 3 + 2) * (15 - w)),
      y + Math.floor(noise(i * 3 + 7) * (15 - h)),
      w,
      h,
    );
  }
};

const both =
  (...painters: Array<(ctx: Ctx, x: number, y: number, noise: Noise) => void>) =>
  (ctx: Ctx, x: number, y: number, noise: Noise) =>
    painters.forEach((paint, index) => paint(ctx, x, y, (n) => noise(n + index * 37)));

const PLAIN: Record<WorldGroundLook, { base: string; paint?: (ctx: Ctx, x: number, y: number, noise: Noise) => void }> =
  {
    grass: { base: "#5f9a43", paint: dots("#77b356", 6) },
    plains: { base: "#9db65a", paint: dots("#c2cf78", 7) },
    farmland: { base: "#b59a52", paint: stripes("#8f7a3c", 3) },
    forest: { base: "#4e8a3a", paint: trees("#2f6b2a", "#1f4d1d", 3, "#5a3b22") },
    hills: { base: "#7aa04c", paint: both(dots("#5d8139", 3, 2), dots("#94b862", 4)) },
    marsh: { base: "#5e7a45", paint: both(dots("#4a7891", 4, 2), dots("#8aa05a", 3)) },
    paddies: { base: "#6fae5a", paint: both(stripes("#7cb7c9", 4), dots("#4f8c3c", 6)) },
    bamboo: { base: "#6f9f4b", paint: blocks(["#3f7a32", "#9fc25d"], 6, 1) },
    scrub: { base: "#b59f6a", paint: dots("#7b8a46", 6, 2) },
    desert: { base: "#dcc183", paint: dots("#c2a465", 7) },
    snow: { base: "#e8eef4", paint: dots("#c4d2df", 6) },
    suburb: { base: "#78a65a", paint: blocks(["#d9d2c3", "#a55a46"], 3, 3) },
    city: { base: "#7d7f86", paint: blocks(["#a5a8b0", "#5e6068", "#c7c3b8"], 5, 4) },
    industry: { base: "#6a655e", paint: blocks(["#8b847a", "#4a463f", "#a46c3f"], 4, 4) },
    slums: { base: "#857158", paint: blocks(["#a68a63", "#5f4f3d", "#7b8a8f"], 7, 2) },
    wasteland: { base: "#a08b68", paint: both(dots("#7f6c4f", 5), dots("#bba57d", 4)) },
    ruins: { base: "#8a8478", paint: blocks(["#b0a99b", "#615c53"], 4, 3) },
    dead_forest: { base: "#8a7b5c", paint: bare("#4f4130", 3) },
    space: { base: "#0b0d1a", paint: dots("#e8ecff", 3) },
    nebula: { base: "#241a3f", paint: both(dots("#7b4fb0", 5, 2), dots("#e8ecff", 2)) },
    asteroids: { base: "#0d0f1c", paint: both(dots("#7d7a75", 3, 3), dots("#e8ecff", 1)) },
    sea: { base: "#2f5f9e", paint: waves("#5b89c4") },
    lake: { base: "#3f7cb8", paint: waves("#77a7d8") },
    toxic_water: { base: "#5f8a2f", paint: both(waves("#a6d44a"), dots("#3e5c1f", 3, 2)) },
    mountains: { base: "#7d7466", paint: peaks("#9b917f", "#6b6255", "#f2f2f2") },
    craters: { base: "#7a6a55", paint: both(dots("#4f4334", 2, 4), dots("#9a8a70", 4)) },
    conifer_forest: { base: "#3f6e44", paint: trees("#24502f", "#173a22", 3, "#4a3322") },
    autumn_forest: { base: "#8a7a3a", paint: trees("#b5652a", "#7d3f1c", 3, "#5a3b22") },
    jungle: { base: "#3d7a35", paint: trees("#2a6a2a", "#174a1d", 4, "#4a3322") },
    gravity_well: {
      base: "#07070d",
      paint: (ctx, x, y) => {
        ctx.strokeStyle = "#6f5bd6";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + 8, y + 8, 5.5, 0, Math.PI * 2);
        ctx.stroke();
        px(ctx, "#000000", x + 6, y + 6, 4, 4);
      },
    },
  };

/** A deterministic noise for a cell: the same cell always draws the same pattern. */
export function cellNoise(x: number, y: number): Noise {
  return (n) => {
    let h = Math.imul(x * 374761393 + y * 668265263 + n * 2246822519, 3266489917) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };
}

/** Paints one ground cell of a look, at pixel (x, y). */
export function paintGround(ctx: Ctx, look: WorldGroundLook, x: number, y: number, noise: Noise) {
  const plain = PLAIN[look];
  px(ctx, plain.base, x, y, OVERWORLD_TILE, OVERWORLD_TILE);
  plain.paint?.(ctx, x, y, noise);
}

/** A lighter line along a water cell's sides that meet land, so coasts read. */
export function paintShore(ctx: Ctx, x: number, y: number, sides: { n: boolean; s: boolean; w: boolean; e: boolean }) {
  const foam = "rgba(230, 244, 255, 0.75)";
  if (sides.n) px(ctx, foam, x, y, 16, 1);
  if (sides.s) px(ctx, foam, x, y + 15, 16, 1);
  if (sides.w) px(ctx, foam, x, y, 1, 16);
  if (sides.e) px(ctx, foam, x + 15, y, 1, 16);
}

/** A way between two cell centres: a road over open ground, a dotted lane over water, a dashed one for a
 *  way that crosses anything. */
export function paintWay(
  ctx: Ctx,
  from: { x: number; y: number },
  to: { x: number; y: number },
  crosses: "open" | "water" | "any",
) {
  const [ax, ay, bx, by] = [from.x * 16 + 8, from.y * 16 + 8, to.x * 16 + 8, to.y * 16 + 8];
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(ax + ((bx - ax) * step) / steps);
    const y = Math.round(ay + ((by - ay) * step) / steps);
    if (crosses === "open") {
      px(ctx, "#6b4f2c", x - 1, y - 1, 2, 2);
      if (step % 2 === 0) px(ctx, "#b8955c", x, y);
    } else if (crosses === "water") {
      if (step % 4 === 0) px(ctx, "#e6f4ff", x, y, 2, 2);
    } else if (step % 6 < 3) {
      px(ctx, "#f5e6a0", x, y, 2, 2);
    }
  }
}

/** A settlement's marker by its size tier (0 a hamlet .. 3 a city), whole or in ruins, with lit windows
 *  after dark. */
export function paintSettlement(ctx: Ctx, cx: number, cy: number, tier: number, ruined: boolean, lit: boolean) {
  const wall = ruined ? "#8d8a84" : "#efe2bf";
  const roof = ruined ? "#5b5853" : "#b0483a";
  const dark = "#2b2520";
  const hut = (x: number, y: number) => {
    px(ctx, dark, x - 1, y + 2, 8, 5);
    px(ctx, wall, x, y + 3, 6, 3);
    if (ruined) {
      px(ctx, roof, x, y + 2, 3, 1);
      px(ctx, roof, x + 4, y + 1, 1, 2);
    } else {
      px(ctx, roof, x + 1, y, 4, 1);
      px(ctx, roof, x, y + 1, 6, 2);
    }
    px(ctx, lit ? "#ffd86b" : dark, x + 2, y + 4, 1, 1);
  };
  const x = cx * 16;
  const y = cy * 16;
  if (tier >= 3) {
    px(ctx, dark, x, y + 2, 16, 13);
    px(ctx, wall, x + 1, y + 6, 14, 8);
    for (const tx of [1, 6, 11]) {
      px(ctx, wall, x + tx, y + 3, 4, 3);
      px(ctx, ruined ? roof : "#b0483a", x + tx, y + 2, 4, 1);
    }
    px(ctx, dark, x + 6, y + 10, 4, 4);
    if (lit) for (const wx of [3, 12]) px(ctx, "#ffd86b", x + wx, y + 8);
    return;
  }
  if (tier === 2) {
    px(ctx, dark, x, y + 4, 16, 1);
    px(ctx, dark, x, y + 4, 1, 11);
    px(ctx, dark, x + 15, y + 4, 1, 11);
    px(ctx, dark, x, y + 14, 16, 1);
    hut(x + 2, y + 6);
    hut(x + 8, y + 5);
    return;
  }
  if (tier === 1) {
    hut(x + 1, y + 6);
    hut(x + 8, y + 4);
    return;
  }
  hut(x + 5, y + 5);
}

/** The party: a small figure in a blue cloak, a step apart on alternate frames. */
export function paintParty(ctx: Ctx, x: number, y: number, step: boolean) {
  const outline = "#101018";
  px(ctx, outline, x + 4, y, 6, 14);
  px(ctx, outline, x + 3, y + 5, 8, 7);
  px(ctx, "#f1c9a5", x + 5, y + 1, 4, 3);
  px(ctx, "#3a6fd8", x + 4, y + 5, 6, 6);
  px(ctx, "#2a4fa0", x + 4, y + 10, 6, 1);
  px(ctx, "#ffffff", x + 6, y + 6, 2, 1);
  px(ctx, "#5a3b22", x + (step ? 4 : 5), y + 11, 2, 3);
  px(ctx, "#5a3b22", x + (step ? 8 : 7), y + 11, 2, 3);
}

/** A post the holders keep on a dungeon map (dungeon spawns): a figure in red standing guard, crowned in
 *  gold at the heart, in the party's own size and outline so it reads as people, not as a prop. */
export function paintGuard(ctx: Ctx, x: number, y: number, heart: boolean) {
  const outline = "#101018";
  px(ctx, outline, x + 4, y, 6, 14);
  px(ctx, outline, x + 3, y + 5, 8, 7);
  px(ctx, "#3a2a2a", x + 5, y + 1, 4, 3);
  px(ctx, "#e8b48a", x + 6, y + 2, 2, 1);
  px(ctx, "#a8322a", x + 4, y + 5, 6, 6);
  px(ctx, "#6e1d18", x + 4, y + 10, 6, 1);
  px(ctx, "#cfcfd6", x + 11, y + 3, 1, 8);
  px(ctx, outline, x + 11, y + 11, 1, 1);
  px(ctx, "#2b1d14", x + 5, y + 11, 2, 3);
  px(ctx, "#2b1d14", x + 7, y + 11, 2, 3);
  if (heart) {
    px(ctx, outline, x + 4, y - 3, 6, 3);
    px(ctx, "#e0b23a", x + 5, y - 2, 4, 1);
    px(ctx, "#e0b23a", x + 5, y - 3, 1, 1);
    px(ctx, "#e0b23a", x + 8, y - 3, 1, 1);
  }
}

/** How dark it is at an hour, 0 to 0.55, as Pixelforge's world darkens: night 21-05, dawn 05-07, dusk
 *  18-21. */
export function overworldDarkness(hour: number, minute = 0): number {
  const at = hour + minute / 60;
  if (at < 5 || at >= 21) return 0.55;
  if (at < 7) return 0.55 * (1 - (at - 5) / 2);
  if (at < 18) return 0;
  return 0.55 * ((at - 18) / 3);
}

/** A site's marker (a cave, a mine, a ruin out in the world): a dark mouth in a mound of rock. */
export function paintSite(ctx: Ctx, cx: number, cy: number) {
  const x = cx * 16;
  const y = cy * 16;
  px(ctx, "#2b2520", x + 2, y + 5, 12, 10);
  px(ctx, "#8a8172", x + 3, y + 6, 10, 8);
  px(ctx, "#a69c8b", x + 5, y + 5, 6, 2);
  px(ctx, "#111014", x + 6, y + 9, 4, 5);
  px(ctx, "#111014", x + 7, y + 8, 2, 1);
}
