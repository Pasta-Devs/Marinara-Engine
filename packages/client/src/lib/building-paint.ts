// ──────────────────────────────────────────────
// Buildings gone bad (building plans, 2026-11-14) drawn without a tile pack: a manor, a keep or a temple
// in plain pixel art, so a haunted house reads as a house at a glance. Walls show their face where a
// floor lies below them; the hall is set apart from the rooms; furniture follows the set's prop slots
// (0 table, 1 bed, 2 shelves, 3 hearth, 4 chest, 5 the door out, 6 a locked door, 7 rubble). Each cell's
// pattern comes from its own position, so the same building always looks the same.
// ──────────────────────────────────────────────
import { OVERWORLD_TILE } from "./overworld-paint";

const T = OVERWORLD_TILE;
type Ctx = CanvasRenderingContext2D;
type Noise = (n: number) => number;

const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export type BuildingStyle = "manor" | "keep" | "temple";

/** The building look of a dungeon set, or null for a set that is not a building. */
export function buildingStyleOf(set: string | undefined): BuildingStyle | null {
  if (set === "building_manor") return "manor";
  if (set === "building_keep") return "keep";
  if (set === "building_temple") return "temple";
  return null;
}

const LOOK: Record<
  BuildingStyle,
  { top: string; topEdge: string; face: string; faceDark: string; faceLine: string; trim: string }
> = {
  manor: {
    top: "#2e2320",
    topEdge: "#4a3a33",
    face: "#a38d74",
    faceDark: "#5e3f2a",
    faceLine: "#3a2618",
    trim: "#8a6a48",
  },
  keep: {
    top: "#2c2c32",
    topEdge: "#4a4a52",
    face: "#6f6b66",
    faceDark: "#57534e",
    faceLine: "#423f3b",
    trim: "#7d7973",
  },
  temple: {
    top: "#3a3128",
    topEdge: "#5a4c3c",
    face: "#a8956e",
    faceDark: "#8a7856",
    faceLine: "#6a5a3e",
    trim: "#c4b088",
  },
};

/** A wall cell: its top, and its face when a floor lies below it. */
export function paintBuildingWall(
  ctx: Ctx,
  style: BuildingStyle,
  x: number,
  y: number,
  faceBelow: boolean,
  noise: Noise,
) {
  const look = LOOK[style];
  if (!faceBelow) {
    px(ctx, look.top, x, y, T, T);
    px(ctx, look.topEdge, x, y, T, 1);
    return;
  }
  px(ctx, look.top, x, y, T, 5);
  px(ctx, look.topEdge, x, y + 4, T, 1);
  if (style === "manor") {
    // Plaster above, a dado rail, panelled wainscot below.
    px(ctx, look.face, x, y + 5, T, 5);
    px(ctx, "#b8a286", x, y + 5, T, 1);
    px(ctx, look.trim, x, y + 10, T, 1);
    px(ctx, look.faceDark, x, y + 11, T, 5);
    px(ctx, look.faceLine, x + ((x / T) % 2 ? 7 : 3), y + 11, 1, 5);
    px(ctx, look.faceLine, x, y + 15, T, 1);
  } else if (style === "keep") {
    // Rough-cut blocks, two courses, offset.
    px(ctx, look.face, x, y + 5, T, 11);
    px(ctx, look.faceLine, x, y + 10, T, 1);
    px(ctx, look.faceLine, x, y + 15, T, 1);
    const off = Math.floor(noise(3) * 6);
    px(ctx, look.faceLine, x + 3 + off, y + 5, 1, 5);
    px(ctx, look.faceLine, x + 9 - Math.floor(off / 2), y + 11, 1, 4);
    px(ctx, look.faceDark, x + 1, y + 6, 2, 1);
    px(ctx, "#827d77", x + 10, y + 12, 3, 1);
  } else {
    // Dressed sandstone with a carved band.
    px(ctx, look.face, x, y + 5, T, 11);
    px(ctx, look.trim, x, y + 5, T, 1);
    px(ctx, look.faceDark, x, y + 8, T, 3);
    for (let i = 1; i < T; i += 4) px(ctx, look.faceLine, x + i, y + 9, 2, 1);
    px(ctx, look.faceLine, x, y + 15, T, 1);
  }
}

/** A floor cell: a room's, or the hall's (set apart from the rooms). */
export function paintBuildingFloor(
  ctx: Ctx,
  style: BuildingStyle,
  x: number,
  y: number,
  hall: boolean,
  noise: Noise,
  /** Whether the hall goes on above and below this cell, so a runner's borders mark only its edges. */
  hallGoesOn: { up: boolean; down: boolean } = { up: false, down: false },
) {
  if (style === "manor") {
    if (hall) {
      // A worn runner the length of the hall, bordered only where the hall ends.
      px(ctx, "#5e2329", x, y, T, T);
      if (!hallGoesOn.up) {
        px(ctx, "#3a1418", x, y, T, 1);
        px(ctx, "#8a6a3a", x, y + 1, T, 1);
        px(ctx, "#4a1a20", x, y + 2, T, 1);
      }
      if (!hallGoesOn.down) {
        px(ctx, "#4a1a20", x, y + 13, T, 1);
        px(ctx, "#8a6a3a", x, y + 14, T, 1);
        px(ctx, "#3a1418", x, y + 15, T, 1);
      }
      // A small lozenge every other cell, along the runner's middle.
      // (A runner two cells wide has its lozenge across the seam between them.)
      if ((x / T) % 2 === 0) {
        const top = hallGoesOn.down && !hallGoesOn.up ? 13 : hallGoesOn.up && !hallGoesOn.down ? -3 : 5;
        if (!(hallGoesOn.up && hallGoesOn.down))
          [2, 4, 6, 6, 4, 2].forEach((w, i) => {
            const row = top + i;
            if (row >= 0 && row < T) px(ctx, i === 0 || i === 5 ? "#8a6a3a" : "#7a3a40", x + 8 - w / 2, y + row, w, 1);
          });
      }
      if (noise(4) < 0.3) px(ctx, "#4f1d22", x + Math.floor(noise(5) * 12), y + 4 + Math.floor(noise(6) * 8), 3, 1);
      return;
    }
    // Floorboards: four long planks to a cell, a rare joint, a little grain.
    for (let row = 0; row < 4; row++) {
      const shade = noise(row + 20);
      px(ctx, shade < 0.33 ? "#674730" : shade < 0.66 ? "#6c4b32" : "#715035", x, y + row * 4, T, 3);
      px(ctx, "#56392a", x, y + row * 4 + 3, T, 1);
      if (noise(row) < 0.3) px(ctx, "#56392a", x + 2 + Math.floor(noise(row + 4) * 12), y + row * 4, 1, 3);
      if (noise(row + 8) < 0.5) px(ctx, "#5f412c", x + Math.floor(noise(row + 12) * 11), y + row * 4 + 1, 4, 1);
    }
    return;
  }
  if (style === "keep") {
    // Flagstones, the hall's darker and strewn with rushes.
    px(ctx, hall ? "#4d4943" : "#5c5750", x, y, T, T);
    const line = hall ? "#3a3733" : "#47433d";
    const split = 5 + Math.floor(noise(1) * 6);
    px(ctx, line, x, y + split, T, 1);
    px(ctx, line, x + 4 + Math.floor(noise(2) * 8), y, 1, split);
    px(ctx, line, x + 2 + Math.floor(noise(3) * 10), y + split, 1, T - split);
    px(ctx, line, x, y + 15, T, 1);
    px(ctx, line, x + 15, y, 1, T);
    if (hall)
      for (let i = 0; i < 3; i++)
        px(ctx, "#7a6a3a", x + Math.floor(noise(4 + i) * 13), y + Math.floor(noise(8 + i) * 15), 3, 1);
    return;
  }
  // Temple tiles: a checker in the rooms, larger slabs down the hall.
  if (hall) {
    px(ctx, "#6e6552", x, y, T, T);
    px(ctx, "#5c5444", x, y + 15, T, 1);
    px(ctx, "#5c5444", x + 15, y, 1, T);
    px(ctx, "#7c725d", x + 1, y + 1, 14, 1);
    return;
  }
  for (let cy = 0; cy < 2; cy++)
    for (let cx = 0; cx < 2; cx++)
      px(ctx, (cx + cy + x / T + y / T) % 2 ? "#7a6f59" : "#8c8068", x + cx * 8, y + cy * 8, 8, 8);
  if (noise(1) < 0.25) px(ctx, "#5e5644", x + Math.floor(noise(2) * 12), y + Math.floor(noise(3) * 12), 4, 1);
}

/** Standing water over a flooded floor. */
export function paintBuildingWater(ctx: Ctx, x: number, y: number, noise: Noise) {
  px(ctx, "#25404c", x, y, T, T);
  for (let i = 0; i < 2; i++) {
    const rx = x + Math.floor(noise(i * 2) * 10);
    const ry = y + 3 + Math.floor(noise(i * 2 + 1) * 10);
    px(ctx, "#3d6474", rx, ry, 5, 1);
    px(ctx, "#1c323c", rx + 1, ry + 1, 4, 1);
  }
}

/** One piece of furniture, by the set's prop slot. */
export function paintBuildingProp(ctx: Ctx, style: BuildingStyle, prop: number, x: number, y: number) {
  const ink = "#140d08";
  switch (prop) {
    case 0: {
      if (style === "temple") {
        // A pew: a bench and its back.
        px(ctx, ink, x + 1, y + 3, 14, 10);
        px(ctx, "#5e3d22", x + 2, y + 4, 12, 4);
        px(ctx, "#7a5230", x + 2, y + 4, 12, 1);
        px(ctx, "#6e4828", x + 2, y + 8, 12, 3);
        px(ctx, "#8a6038", x + 2, y + 8, 12, 1);
        px(ctx, "#3e2614", x + 3, y + 11, 1, 2);
        px(ctx, "#3e2614", x + 12, y + 11, 1, 2);
        return;
      }
      const [topCol, light, leg] =
        style === "keep" ? ["#7a6040", "#94784f", "#4e3c26"] : ["#7e4f2c", "#a06a3c", "#4a2e1a"];
      px(ctx, ink, x + 1, y + 3, 14, 10);
      px(ctx, topCol, x + 2, y + 4, 12, 6);
      px(ctx, light, x + 2, y + 4, 12, 1);
      px(ctx, "#3a2414", x + 2, y + 10, 12, 1);
      px(ctx, leg, x + 3, y + 11, 2, 2);
      px(ctx, leg, x + 11, y + 11, 2, 2);
      if (style === "manor") {
        px(ctx, "#d8d0c0", x + 5, y + 5, 2, 2);
        px(ctx, "#c8a040", x + 10, y + 5, 1, 3);
      }
      return;
    }
    case 1: {
      if (style === "temple") {
        // The altar: a stone block, its cloth and two candles.
        px(ctx, ink, x + 1, y + 4, 14, 11);
        px(ctx, "#b0a890", x + 2, y + 5, 12, 9);
        px(ctx, "#d2caae", x + 2, y + 5, 12, 2);
        px(ctx, "#8a2a36", x + 6, y + 6, 4, 6);
        px(ctx, "#c8a040", x + 6, y + 11, 4, 1);
        px(ctx, "#e8e0c8", x + 3, y + 3, 1, 3);
        px(ctx, "#e8e0c8", x + 12, y + 3, 1, 3);
        px(ctx, "#f4c050", x + 3, y + 2, 1, 1);
        px(ctx, "#f4c050", x + 12, y + 2, 1, 1);
        return;
      }
      const blanket = style === "keep" ? ["#6a6450", "#7e7860"] : ["#7e2632", "#9e3a46"];
      px(ctx, ink, x + 2, y + 1, 12, 14);
      px(ctx, style === "keep" ? "#5a4630" : "#4a2e1a", x + 3, y + 2, 10, 12);
      px(ctx, "#e4dccb", x + 4, y + 3, 8, 3);
      px(ctx, "#bdb3a0", x + 4, y + 5, 8, 1);
      px(ctx, blanket[0]!, x + 3, y + 7, 10, 7);
      px(ctx, blanket[1]!, x + 3, y + 7, 10, 1);
      px(ctx, blanket[1]!, x + 4, y + 10, 8, 1);
      return;
    }
    case 2: {
      px(ctx, ink, x + 1, y + 1, 14, 14);
      if (style === "keep") {
        // A weapon rack: two posts, swords and a spear.
        px(ctx, "#4e3c26", x + 2, y + 2, 12, 12);
        px(ctx, "#2e2216", x + 3, y + 3, 10, 10);
        for (const [bx, len] of [
          [4, 9],
          [7, 8],
          [10, 10],
        ] as const) {
          px(ctx, "#c4c4cc", x + bx, y + 3, 1, len);
          px(ctx, "#8a6a3a", x + bx - 1, y + 3 + len, 3, 1);
        }
        return;
      }
      // Shelves: of books in a manor, of scrolls in a temple.
      px(ctx, "#3e2616", x + 2, y + 2, 12, 12);
      px(ctx, "#5a3a22", x + 2, y + 6, 12, 1);
      px(ctx, "#5a3a22", x + 2, y + 10, 12, 1);
      const books =
        style === "temple" ? ["#e0d4b0", "#cfc29c", "#e8dcbc"] : ["#8a2a36", "#2a4a6a", "#4a6a2a", "#a07a2a"];
      for (const row of [3, 7, 11])
        for (let i = 0; i < 5; i++) {
          const colour = books[(i + row) % books.length]!;
          if (style === "temple") px(ctx, colour, x + 3 + i * 2, y + row + 1, 2, 2);
          else px(ctx, colour, x + 3 + i * 2, y + row, 1 + ((i + row) % 2), 3);
        }
      return;
    }
    case 3: {
      if (style !== "manor") {
        // A brazier: a bowl of coals on three legs.
        px(ctx, "#2a2424", x + 4, y + 11, 1, 4);
        px(ctx, "#2a2424", x + 11, y + 11, 1, 4);
        px(ctx, "#2a2424", x + 7, y + 12, 2, 3);
        px(ctx, ink, x + 2, y + 7, 12, 5);
        px(ctx, "#5a4a3a", x + 3, y + 8, 10, 3);
        px(ctx, "#c84a20", x + 4, y + 6, 8, 2);
        px(ctx, "#f0a030", x + 5, y + 3, 6, 4);
        px(ctx, "#f8e070", x + 7, y + 2, 2, 3);
        return;
      }
      // A fireplace in its stone surround.
      px(ctx, ink, x, y + 1, T, 15);
      px(ctx, "#6b6560", x + 1, y + 2, 14, 14);
      px(ctx, "#8a837c", x + 1, y + 2, 14, 2);
      px(ctx, "#140c08", x + 4, y + 6, 8, 10);
      px(ctx, "#c84a20", x + 5, y + 12, 6, 3);
      px(ctx, "#f0a030", x + 6, y + 10, 4, 3);
      px(ctx, "#f8e070", x + 7, y + 9, 2, 2);
      return;
    }
    case 4: {
      // A chest: lid, iron bands, a lock.
      px(ctx, ink, x + 2, y + 4, 12, 10);
      px(ctx, "#6a4020", x + 3, y + 7, 10, 6);
      px(ctx, "#86522a", x + 3, y + 5, 10, 3);
      px(ctx, "#a06a3a", x + 3, y + 5, 10, 1);
      px(ctx, "#3a2412", x + 3, y + 8, 10, 1);
      px(ctx, "#8a8a92", x + 5, y + 5, 1, 8);
      px(ctx, "#8a8a92", x + 10, y + 5, 1, 8);
      px(ctx, "#d8b040", x + 7, y + 8, 2, 2);
      return;
    }
    case 5: {
      // The door out: an open door with daylight beyond.
      px(ctx, ink, x + 1, y, 14, T);
      px(ctx, "#3a2414", x + 2, y + 1, 12, 15);
      px(ctx, "#e8d8a0", x + 4, y + 2, 8, 14);
      px(ctx, "#f4ecc8", x + 5, y + 3, 6, 12);
      px(ctx, "#7a4e2a", x + 2, y + 2, 3, 14);
      px(ctx, "#5e3a1e", x + 4, y + 2, 1, 14);
      px(ctx, "#d8b040", x + 3, y + 9, 1, 1);
      return;
    }
    case 6: {
      // A locked door: iron-banded, a padlock.
      px(ctx, ink, x + 1, y, 14, T);
      px(ctx, "#5a3a22", x + 2, y + 1, 12, 15);
      px(ctx, "#4a2e1a", x + 6, y + 1, 1, 15);
      px(ctx, "#4a2e1a", x + 10, y + 1, 1, 15);
      px(ctx, "#5e5e68", x + 2, y + 3, 12, 2);
      px(ctx, "#5e5e68", x + 2, y + 12, 12, 2);
      px(ctx, "#7c7c86", x + 2, y + 3, 12, 1);
      px(ctx, ink, x + 6, y + 6, 5, 6);
      px(ctx, "#d8b040", x + 7, y + 8, 3, 3);
      px(ctx, "#a08020", x + 7, y + 6, 1, 2);
      px(ctx, "#a08020", x + 9, y + 6, 1, 2);
      px(ctx, ink, x + 8, y + 9, 1, 1);
      return;
    }
    case 7: {
      // Rubble: broken stone and a charred beam.
      px(ctx, "#2e1e12", x + 1, y + 9, 13, 2);
      px(ctx, "#4a3020", x + 1, y + 9, 13, 1);
      for (const [rx, ry, w, h, c] of [
        [2, 5, 5, 4, "#7a746c"],
        [7, 8, 6, 5, "#5e5952"],
        [3, 11, 4, 3, "#9a948a"],
        [10, 3, 4, 4, "#8a847c"],
        [12, 11, 3, 3, "#6a655e"],
      ] as const) {
        px(ctx, ink, x + rx - 1, y + ry - 1, w + 2, h + 2);
        px(ctx, c, x + rx, y + ry, w, h);
        px(ctx, "#b0aaa0", x + rx, y + ry, w - 1, 1);
      }
      return;
    }
  }
}

/** A way to another level: stairs down or up, a ladder, a hole in the floor. */
export function paintSiteLink(ctx: Ctx, kind: string, down: boolean, x: number, y: number) {
  const ink = "#0c0806";
  if (kind === "hole") {
    px(ctx, "#3a2414", x + 1, y + 2, 14, 12);
    px(ctx, ink, x + 2, y + 3, 12, 10);
    px(ctx, "#050302", x + 4, y + 5, 8, 6);
    for (const [bx, by, w] of [
      [1, 2, 3],
      [10, 2, 5],
      [1, 12, 5],
      [12, 11, 3],
    ] as const)
      px(ctx, "#6a4a30", x + bx, y + by, w, 2);
    return;
  }
  if (kind === "ladder") {
    if (down) px(ctx, ink, x + 2, y + 1, 12, 14);
    px(ctx, "#7a5a34", x + 4, y, 2, T);
    px(ctx, "#7a5a34", x + 10, y, 2, T);
    for (let r = 2; r < T; r += 4) px(ctx, "#9a7444", x + 4, y + r, 8, 1);
    return;
  }
  // Stairs: steps that darken going down, or lighten going up; a servants' stair is narrower.
  const [l, r] = kind === "servants" ? [4, 12] : [2, 14];
  px(ctx, ink, x + l - 1, y, r - l + 2, T);
  const shades = down ? ["#8a8070", "#6a6256", "#4a443c", "#2a2620"] : ["#3a3530", "#5a544a", "#7a7266", "#9a9282"];
  for (let i = 0; i < 4; i++) {
    px(ctx, shades[i]!, x + l, y + i * 4, r - l, 3);
    px(ctx, ink, x + l, y + i * 4 + 3, r - l, 1);
  }
  // Its way: a solid arrowhead, outlined, over the steps.
  const pale = "#f4ead0";
  const rows = [8, 6, 4, 2].map((w, i) => ({ w, i, row: down ? y + 6 + i : y + 9 - i }));
  for (const { w, i, row } of rows) px(ctx, ink, x + 3 + i, row - 1, w + 2, 3);
  for (const { w, i, row } of rows) px(ctx, pale, x + 4 + i, row, w, 1);
}

/** A trap the party has found: its plate, marked. */
export function paintFoundTrap(ctx: Ctx, x: number, y: number) {
  px(ctx, "#140d08", x + 2, y + 2, 12, 12);
  px(ctx, "#5a5040", x + 3, y + 3, 10, 10);
  px(ctx, "#6e6450", x + 3, y + 3, 10, 1);
  for (let i = 0; i < 8; i++) {
    px(ctx, "#d84030", x + 4 + i, y + 4 + i, 1, 1);
    px(ctx, "#d84030", x + 11 - i, y + 4 + i, 1, 1);
  }
}
