// ──────────────────────────────────────────────
// Caves, crypts, sewers, sunken temples and stations drawn without a tile pack (2026-11-16): each set's
// ground, walls and pools in plain pixel art, and its eight props by their words, so a place reads as
// itself at a glance when the player has no pack for it. Buildings have their own look (building-paint).
// Each cell's pattern comes from its own position, so the same place always looks the same.
// ──────────────────────────────────────────────
import { OVERWORLD_TILE } from "./overworld-paint";

const T = OVERWORLD_TILE;
type Ctx = CanvasRenderingContext2D;
type Noise = (n: number) => number;

const px = (ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
const INK = "#0c0a0a";

type FloorKind = "rock" | "ice" | "sparkle" | "basalt" | "flags" | "brick" | "sandstone" | "plates" | "tiles" | "grate";
type WallKind = "rock" | "ice" | "brick" | "carved" | "bulkhead";
interface Look {
  floor: FloorKind;
  /** Base, a darker and a lighter shade, and a fleck. */
  ground: [string, string, string, string];
  wall: WallKind;
  /** Top, top edge, face, face dark, face line. */
  walls: [string, string, string, string, string];
  /** Pool, its ripple, its depth; lava glows. */
  pool: [string, string, string];
  props: readonly PropDraw[];
}

// ── The props' shapes, each with its colours ──
type PropDraw = (ctx: Ctx, x: number, y: number) => void;

const spike =
  (body: string, light: string, tall = 12): PropDraw =>
  (ctx, x, y) => {
    const top = 15 - tall;
    for (let i = 0; i < tall; i++) {
      const w = Math.max(1, Math.round(1 + (i / tall) * 7));
      px(ctx, INK, x + 8 - Math.ceil(w / 2) - 1, y + top + i, w + 2, 1);
    }
    for (let i = 0; i < tall; i++) {
      const w = Math.max(1, Math.round(1 + (i / tall) * 7));
      px(ctx, body, x + 8 - Math.ceil(w / 2), y + top + i, w, 1);
      px(ctx, light, x + 8 - Math.ceil(w / 2), y + top + i, 1, 1);
    }
  };
const spikes =
  (body: string, light: string): PropDraw =>
  (ctx, x, y) => {
    for (const [dx, h] of [
      [-4, 6],
      [1, 9],
      [5, 5],
    ] as const) {
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round(1 + (i / h) * 3));
        px(ctx, INK, x + 6 + dx - 1, y + 15 - h + i, w + 2, 1);
        px(ctx, body, x + 6 + dx, y + 15 - h + i, w, 1);
        px(ctx, light, x + 6 + dx, y + 15 - h + i, 1, 1);
      }
    }
  };
const hanging =
  (body: string, light: string): PropDraw =>
  (ctx, x, y) => {
    for (const [dx, h] of [
      [2, 8],
      [6, 11],
      [10, 6],
      [13, 9],
    ] as const)
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, Math.round(3 - (i / h) * 3));
        px(ctx, INK, x + dx - 1, y + i, w + 1, 1);
        px(ctx, i < 2 ? light : body, x + dx, y + i, Math.max(1, w - 1), 1);
      }
  };
const boulder =
  (body: string, light: string, dark: string, moss?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 5, 12, 10);
    px(ctx, INK, x + 4, y + 3, 8, 2);
    px(ctx, body, x + 3, y + 5, 10, 9);
    px(ctx, body, x + 5, y + 4, 6, 1);
    px(ctx, light, x + 4, y + 5, 5, 2);
    px(ctx, dark, x + 3, y + 12, 10, 2);
    px(ctx, dark, x + 9, y + 8, 1, 3);
    if (moss) {
      px(ctx, moss, x + 4, y + 4, 6, 2);
      px(ctx, moss, x + 3, y + 6, 2, 1);
    }
  };
/** A rounded stone: its outline with the corners cut, a lit top and a shaded foot. */
const stone = (ctx: Ctx, x: number, y: number, w: number, h: number, body: string, light: string, dark: string) => {
  px(ctx, INK, x + 1, y - 1, w - 2, 1);
  px(ctx, INK, x, y, w, h);
  px(ctx, INK, x - 1, y + 1, w + 2, h - 2);
  px(ctx, INK, x + 1, y + h, w - 2, 1);
  px(ctx, body, x + 1, y, w - 2, h);
  px(ctx, body, x, y + 1, w, h - 2);
  px(ctx, light, x + 1, y, w - 3, 1);
  px(ctx, dark, x + 1, y + h - 1, w - 2, 1);
};
const pile =
  (body: string, light: string, dark: string): PropDraw =>
  (ctx, x, y) => {
    stone(ctx, x + 2, y + 9, 6, 4, body, light, dark);
    stone(ctx, x + 8, y + 10, 6, 4, dark, body, dark);
    stone(ctx, x + 5, y + 6, 5, 4, light, "#d8d2c8", body);
    stone(ctx, x + 11, y + 6, 3, 3, body, light, dark);
  };
const drift: PropDraw = (ctx, x, y) => {
  px(ctx, "#8aa8bc", x + 1, y + 10, 14, 5);
  px(ctx, "#dce8f0", x + 2, y + 8, 12, 5);
  px(ctx, "#f4f8fc", x + 4, y + 7, 7, 3);
  px(ctx, "#b8ccd8", x + 3, y + 12, 10, 1);
};
const mushrooms =
  (cap: string, glow: string): PropDraw =>
  (ctx, x, y) => {
    for (const [dx, dy, w] of [
      [2, 8, 5],
      [8, 5, 6],
      [10, 11, 4],
    ] as const) {
      px(ctx, "#d8d0c0", x + dx + Math.floor(w / 2), y + dy + 2, 1, 4);
      px(ctx, INK, x + dx - 1, y + dy - 1, w + 2, 4);
      px(ctx, cap, x + dx, y + dy, w, 2);
      px(ctx, glow, x + dx + 1, y + dy, w - 2, 1);
    }
  };
const box =
  (body: string, lid: string, band: string, lock?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 4, 12, 11);
    px(ctx, body, x + 3, y + 7, 10, 7);
    px(ctx, lid, x + 3, y + 5, 10, 3);
    px(ctx, band, x + 3, y + 8, 10, 1);
    px(ctx, band, x + 5, y + 5, 1, 9);
    px(ctx, band, x + 10, y + 5, 1, 9);
    if (lock) px(ctx, lock, x + 7, y + 8, 2, 2);
  };
const crate =
  (body: string, light: string, dark: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 3, 12, 12);
    px(ctx, body, x + 3, y + 4, 10, 10);
    px(ctx, light, x + 3, y + 4, 10, 1);
    px(ctx, dark, x + 3, y + 8, 10, 1);
    px(ctx, dark, x + 3, y + 13, 10, 1);
    for (let i = 0; i < 8; i++) px(ctx, dark, x + 4 + i, y + 5 + Math.floor(i / 2.7), 1, 1);
  };
const bones =
  (bone: string, shade: string, skull = true): PropDraw =>
  (ctx, x, y) => {
    px(ctx, shade, x + 2, y + 11, 9, 1);
    px(ctx, bone, x + 2, y + 10, 9, 1);
    px(ctx, bone, x + 1, y + 9, 2, 3);
    px(ctx, bone, x + 10, y + 9, 2, 3);
    px(ctx, bone, x + 5, y + 13, 7, 1);
    if (skull) {
      px(ctx, INK, x + 8, y + 4, 7, 6);
      px(ctx, bone, x + 9, y + 4, 5, 5);
      px(ctx, INK, x + 10, y + 6, 1, 1);
      px(ctx, INK, x + 12, y + 6, 1, 1);
      px(ctx, shade, x + 9, y + 8, 5, 1);
    }
  };
const skeleton =
  (bone: string, shade: string, ice?: string): PropDraw =>
  (ctx, x, y) => {
    if (ice) px(ctx, ice, x + 1, y + 1, 14, 14);
    px(ctx, INK, x + 6, y + 1, 5, 5);
    px(ctx, bone, x + 7, y + 2, 3, 3);
    px(ctx, INK, x + 7, y + 3, 1, 1);
    px(ctx, bone, x + 8, y + 5, 1, 6);
    for (let r = 6; r < 10; r += 2) px(ctx, bone, x + 6, y + r, 5, 1);
    px(ctx, bone, x + 4, y + 6, 2, 1);
    px(ctx, bone, x + 11, y + 6, 2, 1);
    px(ctx, bone, x + 7, y + 11, 1, 4);
    px(ctx, bone, x + 9, y + 11, 1, 4);
    px(ctx, shade, x + 6, y + 10, 5, 1);
  };
const flame =
  (stand: string, standLight: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 7, y + 6, 3, 10);
    px(ctx, stand, x + 8, y + 7, 1, 8);
    px(ctx, INK, x + 4, y + 13, 9, 3);
    px(ctx, stand, x + 5, y + 14, 7, 1);
    px(ctx, INK, x + 5, y + 4, 7, 4);
    px(ctx, standLight, x + 6, y + 5, 5, 2);
    px(ctx, "#c84a20", x + 6, y + 3, 5, 2);
    px(ctx, "#f0a030", x + 7, y + 1, 3, 3);
    px(ctx, "#f8e070", x + 8, y, 1, 2);
  };
const lantern: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 4, y + 4, 8, 11);
  px(ctx, "#5a4a30", x + 5, y + 5, 6, 9);
  px(ctx, "#f8d070", x + 6, y + 7, 4, 5);
  px(ctx, "#fff0b0", x + 7, y + 8, 2, 2);
  px(ctx, "#3a3028", x + 7, y + 2, 2, 3);
  px(ctx, "#5a4a30", x + 5, y + 13, 6, 1);
};
const column =
  (body: string, light: string, dark: string, fallen = false): PropDraw =>
  (ctx, x, y) => {
    if (fallen) {
      px(ctx, INK, x, y + 6, T, 8);
      px(ctx, body, x + 1, y + 7, 14, 6);
      px(ctx, light, x + 1, y + 7, 14, 2);
      px(ctx, dark, x + 1, y + 12, 14, 1);
      px(ctx, dark, x + 5, y + 7, 1, 6);
      px(ctx, dark, x + 10, y + 7, 1, 6);
      return;
    }
    px(ctx, INK, x + 3, y, 10, T);
    px(ctx, body, x + 4, y + 2, 8, 12);
    px(ctx, light, x + 5, y + 2, 2, 12);
    px(ctx, dark, x + 10, y + 2, 2, 12);
    px(ctx, light, x + 3, y + 1, 10, 2);
    px(ctx, dark, x + 3, y + 13, 10, 2);
  };
const sarcophagus: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 2, y, 12, T);
  px(ctx, "#7a756c", x + 3, y + 1, 10, 14);
  px(ctx, "#9a948a", x + 3, y + 1, 10, 2);
  px(ctx, "#8a847a", x + 5, y + 4, 6, 9);
  px(ctx, "#5e5a52", x + 7, y + 4, 2, 9);
  px(ctx, "#5e5a52", x + 5, y + 7, 6, 1);
  px(ctx, "#5e5a52", x + 3, y + 14, 10, 1);
};
const spikePlate: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 1, 14, 14);
  px(ctx, "#3a3632", x + 2, y + 2, 12, 12);
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) {
      px(ctx, "#b8b8c0", x + 4 + sx * 4, y + 3 + sy * 4, 1, 2);
      px(ctx, "#6a6a72", x + 4 + sx * 4, y + 5 + sy * 4, 1, 1);
    }
};
const portcullis =
  (bar: string, light: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, "#0a0806", x + 1, y, 14, T);
    for (let i = 0; i < 4; i++) {
      px(ctx, bar, x + 2 + i * 4, y, 2, T);
      px(ctx, light, x + 2 + i * 4, y, 1, T);
    }
    px(ctx, bar, x + 1, y + 4, 14, 1);
    px(ctx, bar, x + 1, y + 10, 14, 1);
  };
const carvedDoor: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y, 14, T);
  px(ctx, "#8a7a5a", x + 2, y + 1, 12, 15);
  px(ctx, "#a8986e", x + 2, y + 1, 12, 1);
  px(ctx, "#6a5a3e", x + 7, y + 2, 2, 14);
  px(ctx, "#c4a040", x + 4, y + 5, 2, 2);
  px(ctx, "#c4a040", x + 10, y + 5, 2, 2);
  px(ctx, "#6a5a3e", x + 3, y + 10, 4, 1);
  px(ctx, "#6a5a3e", x + 9, y + 10, 4, 1);
};
const airlock: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y, 14, T);
  px(ctx, "#6a7078", x + 2, y + 1, 12, 15);
  px(ctx, "#3e444c", x + 7, y + 1, 2, 15);
  px(ctx, "#d8a020", x + 2, y + 13, 12, 2);
  for (let i = 0; i < 6; i++) px(ctx, INK, x + 2 + i * 2, y + 13 + (i % 2), 1, 1);
  px(ctx, "#40d070", x + 11, y + 4, 2, 2);
};
const grate =
  (frame: string, hole: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 2, 12, 12);
    px(ctx, frame, x + 3, y + 3, 10, 10);
    for (let i = 0; i < 4; i++) px(ctx, hole, x + 4 + i * 2 + i, y + 4, 2, 8);
  };
const pipeOutlet =
  (pipe: string, light: string, drip: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 3, y, 10, 9);
    px(ctx, pipe, x + 4, y, 8, 8);
    px(ctx, light, x + 4, y, 8, 1);
    px(ctx, "#141210", x + 6, y + 3, 4, 4);
    px(ctx, drip, x + 7, y + 8, 2, 5);
    px(ctx, drip, x + 5, y + 13, 6, 2);
  };
const pipes =
  (pipe: string, light: string, joint: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x, y + 5, T, 6);
    px(ctx, INK, x + 5, y, 6, T);
    px(ctx, pipe, x, y + 6, T, 4);
    px(ctx, pipe, x + 6, y, 4, T);
    px(ctx, light, x, y + 6, T, 1);
    px(ctx, light, x + 6, y, 1, T);
    px(ctx, INK, x + 4, y + 4, 8, 8);
    px(ctx, joint, x + 5, y + 5, 6, 6);
    px(ctx, "#e04030", x + 7, y + 7, 2, 2);
  };
const ratNest: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 7, 14, 8);
  px(ctx, "#8a7040", x + 2, y + 8, 12, 6);
  px(ctx, "#a88850", x + 3, y + 8, 4, 1);
  px(ctx, "#a88850", x + 9, y + 10, 4, 1);
  px(ctx, "#5a4628", x + 5, y + 10, 6, 3);
  px(ctx, "#6a6062", x + 6, y + 9, 3, 2);
  px(ctx, "#e05050", x + 6, y + 9, 1, 1);
  px(ctx, "#c09090", x + 9, y + 11, 3, 1);
};
const valve: PropDraw = (ctx, x, y) => {
  // A wheel on its pipe: a ring, four spokes, a hub.
  px(ctx, INK, x + 6, y + 9, 4, 7);
  px(ctx, "#5a5e58", x + 7, y + 10, 2, 6);
  const ring = [
    [5, 2, 6],
    [3, 3, 2],
    [11, 3, 2],
    [2, 5, 1],
    [13, 5, 1],
    [2, 6, 1],
    [13, 6, 1],
    [2, 7, 1],
    [13, 7, 1],
    [2, 8, 1],
    [13, 8, 1],
    [3, 10, 2],
    [11, 10, 2],
    [5, 11, 6],
  ] as const;
  for (const [rx, ry, w] of ring) px(ctx, INK, x + rx - 1, y + ry - 1, w + 2, 3);
  for (const [rx, ry, w] of ring) px(ctx, "#b03a2c", x + rx, y + ry, w, 1);
  px(ctx, "#b03a2c", x + 7, y + 3, 2, 8);
  px(ctx, "#b03a2c", x + 3, y + 6, 10, 2);
  px(ctx, INK, x + 6, y + 5, 4, 4);
  px(ctx, "#d8d0c0", x + 7, y + 6, 2, 2);
  px(ctx, "#e05a4a", x + 6, y + 2, 3, 1);
};
const cylinder =
  (body: string, light: string, dark: string, band?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 3, y + 2, 10, 13);
    px(ctx, body, x + 4, y + 3, 8, 11);
    px(ctx, light, x + 5, y + 3, 2, 11);
    px(ctx, dark, x + 10, y + 3, 2, 11);
    px(ctx, light, x + 4, y + 3, 8, 1);
    if (band) {
      px(ctx, band, x + 4, y + 6, 8, 1);
      px(ctx, band, x + 4, y + 11, 8, 1);
    }
  };
const urn: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 4, y + 2, 8, 13);
  px(ctx, INK, x + 3, y + 6, 10, 7);
  px(ctx, "#a85a30", x + 4, y + 7, 8, 5);
  px(ctx, "#a85a30", x + 5, y + 3, 6, 11);
  px(ctx, "#c87a48", x + 5, y + 7, 2, 4);
  px(ctx, "#1c1410", x + 6, y + 2, 4, 1);
  px(ctx, "#2a1a10", x + 4, y + 9, 8, 1);
};
const statue =
  (stone: string, light: string, dark: string, broken = false): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 3, y + 12, 10, 4);
    px(ctx, dark, x + 4, y + 13, 8, 2);
    px(ctx, INK, x + 5, y + (broken ? 5 : 1), 6, broken ? 8 : 12);
    px(ctx, stone, x + 6, y + (broken ? 6 : 2), 4, broken ? 7 : 11);
    px(ctx, light, x + 6, y + (broken ? 6 : 2), 1, broken ? 7 : 11);
    if (!broken) px(ctx, INK, x + 7, y + 4, 2, 1);
    else px(ctx, stone, x + 11, y + 13, 3, 2);
  };
const idol: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 3, y + 11, 10, 5);
  px(ctx, "#5a5040", x + 4, y + 12, 8, 3);
  px(ctx, INK, x + 5, y + 2, 6, 10);
  px(ctx, "#d8a830", x + 6, y + 3, 4, 8);
  px(ctx, "#f4d060", x + 6, y + 3, 1, 8);
  px(ctx, "#2a1a08", x + 7, y + 5, 1, 1);
  px(ctx, "#2a1a08", x + 9, y + 5, 1, 1);
  px(ctx, "#f8f0a0", x + 4, y + 1, 1, 1);
  px(ctx, "#f8f0a0", x + 12, y + 3, 1, 1);
};
const altar: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 5, 14, 10);
  px(ctx, "#9a8a68", x + 2, y + 6, 12, 8);
  px(ctx, "#b8a884", x + 2, y + 6, 12, 2);
  px(ctx, "#6a2028", x + 6, y + 8, 4, 5);
  px(ctx, "#c4a040", x + 7, y + 4, 2, 2);
};
const robot =
  (body: string, light: string, eye: string, broken = false): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 3, y + 3, 10, 12);
    px(ctx, body, x + 4, y + 4, 8, 6);
    px(ctx, light, x + 4, y + 4, 8, 1);
    px(ctx, "#202428", x + 5, y + 6, 6, 2);
    px(ctx, eye, x + 6, y + 6, 1, 1);
    px(ctx, broken ? "#202428" : eye, x + 9, y + 6, 1, 1);
    px(ctx, body, x + 5, y + 10, 6, 3);
    px(ctx, "#2a2e34", x + 4, y + 13, 3, 2);
    px(ctx, "#2a2e34", x + 9, y + 13, 3, 2);
    if (broken) {
      px(ctx, "#f0c040", x + 12, y + 2, 1, 1);
      px(ctx, "#f0c040", x + 13, y + 4, 1, 1);
    }
  };
const machine =
  (body: string, screen: string, glow: string, rack = false): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 1, 12, 14);
    px(ctx, body, x + 3, y + 2, 10, 12);
    if (rack) {
      for (let r = 0; r < 5; r++) {
        px(ctx, "#1a1e24", x + 4, y + 3 + r * 2, 8, 1);
        px(ctx, r % 2 ? glow : screen, x + 10, y + 3 + r * 2, 1, 1);
      }
      return;
    }
    px(ctx, "#101418", x + 4, y + 3, 8, 6);
    px(ctx, screen, x + 5, y + 4, 6, 4);
    px(ctx, glow, x + 5, y + 4, 3, 1);
    px(ctx, glow, x + 5, y + 6, 5, 1);
    px(ctx, "#2a2e34", x + 4, y + 10, 8, 2);
    px(ctx, "#e04030", x + 5, y + 10, 1, 1);
    px(ctx, "#40c060", x + 7, y + 10, 1, 1);
  };
const holo: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 4, y + 12, 8, 4);
  px(ctx, "#4a5058", x + 5, y + 13, 6, 2);
  px(ctx, "rgba(90,220,255,0.35)", x + 3, y + 2, 10, 10);
  px(ctx, "#7ae8ff", x + 3, y + 2, 10, 1);
  px(ctx, "#7ae8ff", x + 5, y + 5, 6, 1);
  px(ctx, "#7ae8ff", x + 5, y + 8, 4, 1);
};
const bench =
  (top: string, light: string, leg: string, items?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x, y + 4, T, 9);
    px(ctx, top, x + 1, y + 5, 14, 5);
    px(ctx, light, x + 1, y + 5, 14, 1);
    px(ctx, leg, x + 2, y + 10, 2, 3);
    px(ctx, leg, x + 12, y + 10, 2, 3);
    if (items) {
      px(ctx, items, x + 3, y + 3, 2, 3);
      px(ctx, "#e0e8f0", x + 8, y + 3, 3, 2);
    }
  };
const bed =
  (frame: string, sheet: string, pillow: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 2, y + 1, 12, 14);
    px(ctx, frame, x + 3, y + 2, 10, 12);
    px(ctx, pillow, x + 4, y + 3, 8, 3);
    px(ctx, sheet, x + 3, y + 7, 10, 7);
    px(ctx, "#ffffff", x + 3, y + 7, 10, 1);
  };
const tube: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 3, y, 10, T);
  px(ctx, "#3a4048", x + 4, y + 13, 8, 2);
  px(ctx, "#3a4048", x + 4, y + 1, 8, 1);
  px(ctx, "#2a7a68", x + 4, y + 2, 8, 11);
  px(ctx, "#5ad0b0", x + 5, y + 2, 1, 11);
  px(ctx, "#1a3a34", x + 7, y + 5, 3, 5);
  px(ctx, "#9af0d8", x + 9, y + 3, 1, 1);
};
const planter =
  (pot: string, leaf: string, leafLight: string, fruit?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 1, y + 9, 14, 6);
    px(ctx, pot, x + 2, y + 10, 12, 4);
    px(ctx, INK, x + 2, y + 2, 12, 9);
    px(ctx, leaf, x + 3, y + 3, 10, 7);
    px(ctx, leafLight, x + 4, y + 3, 3, 2);
    px(ctx, leafLight, x + 9, y + 5, 3, 2);
    if (fruit) {
      px(ctx, fruit, x + 5, y + 6, 2, 2);
      px(ctx, fruit, x + 10, y + 3, 2, 2);
    }
  };
const growRack: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 1, 14, 14);
  px(ctx, "#4a5058", x + 2, y + 2, 12, 12);
  px(ctx, "#e080f0", x + 2, y + 2, 12, 1);
  for (const r of [4, 9]) {
    px(ctx, "#3a8a3a", x + 3, y + r, 10, 3);
    px(ctx, "#5ab04a", x + 3, y + r, 10, 1);
  }
};
const reactor: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 1, 14, 14);
  px(ctx, "#4a5058", x + 2, y + 2, 12, 12);
  px(ctx, INK, x + 4, y + 4, 8, 8);
  px(ctx, "#40b0ff", x + 5, y + 5, 6, 6);
  px(ctx, "#b0f0ff", x + 7, y + 7, 2, 2);
  px(ctx, "#6a7078", x + 2, y + 2, 12, 1);
};
const generator: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 3, 14, 12);
  px(ctx, "#5a6048", x + 2, y + 4, 12, 10);
  px(ctx, "#7a8060", x + 2, y + 4, 12, 1);
  for (let i = 0; i < 4; i++) px(ctx, "#3a4030", x + 3 + i * 3, y + 6, 2, 6);
  px(ctx, "#f0c040", x + 12, y + 12, 1, 1);
};
const cableBox: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 3, y + 3, 10, 12);
  px(ctx, "#5a5e64", x + 4, y + 4, 8, 10);
  px(ctx, "#d8a020", x + 6, y + 6, 4, 4);
  px(ctx, INK, x + 7, y + 7, 2, 1);
  px(ctx, INK, x + 8, y + 8, 1, 1);
  px(ctx, "#f8f080", x + 13, y + 3, 1, 1);
  px(ctx, "#f8f080", x + 2, y + 6, 1, 1);
  px(ctx, "#202428", x + 1, y + 13, 3, 1);
};
const canisters: PropDraw = (ctx, x, y) => {
  for (const [dx, c] of [
    [1, "#c84a2a"],
    [6, "#d8a020"],
    [11, "#c84a2a"],
  ] as const) {
    px(ctx, INK, x + dx, y + 5, 5, 10);
    px(ctx, c, x + dx + 1, y + 6, 3, 8);
    px(ctx, "#f0e0c0", x + dx + 1, y + 6, 1, 8);
  }
};
const cart =
  (body: string, load?: string): PropDraw =>
  (ctx, x, y) => {
    px(ctx, INK, x + 1, y + 5, 14, 8);
    px(ctx, body, x + 2, y + 6, 12, 6);
    px(ctx, "#8a8a92", x + 2, y + 6, 12, 1);
    if (load) {
      px(ctx, load, x + 3, y + 4, 4, 3);
      px(ctx, load, x + 8, y + 3, 5, 4);
    }
    px(ctx, INK, x + 3, y + 12, 3, 3);
    px(ctx, INK, x + 10, y + 12, 3, 3);
  };
const containers: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x, y + 3, T, 12);
  px(ctx, "#3a6a8a", x + 1, y + 4, 7, 10);
  px(ctx, "#a85a2a", x + 8, y + 4, 7, 10);
  for (let i = 0; i < 3; i++) {
    px(ctx, "#2a4a62", x + 2 + i * 2, y + 5, 1, 8);
    px(ctx, "#7a3a1a", x + 9 + i * 2, y + 5, 1, 8);
  }
};
const geode: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 2, y + 4, 12, 11);
  px(ctx, "#6a6058", x + 3, y + 5, 10, 9);
  px(ctx, "#2a1a3a", x + 5, y + 7, 6, 5);
  px(ctx, "#c080f0", x + 6, y + 8, 2, 2);
  px(ctx, "#e0b0ff", x + 8, y + 9, 2, 2);
  px(ctx, "#a060d0", x + 6, y + 10, 4, 1);
};
const vent: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 3, y + 8, 10, 7);
  px(ctx, "#2a2420", x + 4, y + 9, 8, 5);
  px(ctx, "#e05010", x + 6, y + 10, 4, 2);
  px(ctx, "rgba(170,170,170,0.55)", x + 5, y + 4, 4, 4);
  px(ctx, "rgba(170,170,170,0.35)", x + 7, y + 1, 4, 3);
};
const dragonSkull: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x, y + 4, T, 10);
  px(ctx, "#d8d0bc", x + 1, y + 5, 10, 7);
  px(ctx, "#d8d0bc", x + 11, y + 8, 4, 3);
  px(ctx, INK, x + 4, y + 7, 2, 2);
  px(ctx, "#a8a08c", x + 1, y + 11, 14, 1);
  px(ctx, "#f0ead8", x + 3, y + 3, 1, 3);
  px(ctx, "#f0ead8", x + 7, y + 2, 1, 4);
  for (let i = 0; i < 4; i++) px(ctx, "#f0ead8", x + 9 + i * 2, y + 12, 1, 2);
};
const ropeBucket: PropDraw = (ctx, x, y) => {
  px(ctx, "#a88850", x + 8, y, 1, 8);
  px(ctx, INK, x + 4, y + 7, 9, 8);
  px(ctx, "#6a4a2a", x + 5, y + 8, 7, 6);
  px(ctx, "#8a6a3a", x + 5, y + 8, 7, 1);
  px(ctx, "#5e5e66", x + 5, y + 10, 7, 1);
};
const freezer: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 1, y + 3, 14, 12);
  px(ctx, "#d0d8e0", x + 2, y + 4, 12, 10);
  px(ctx, "#a0b0c0", x + 2, y + 8, 12, 1);
  px(ctx, "#60a0e0", x + 11, y + 5, 2, 2);
  px(ctx, "#f0f8ff", x + 3, y + 4, 8, 1);
};
const compost: PropDraw = (ctx, x, y) => {
  px(ctx, INK, x + 2, y + 3, 12, 12);
  px(ctx, "#3a5a3a", x + 3, y + 4, 10, 10);
  px(ctx, "#5a4028", x + 4, y + 5, 8, 3);
  px(ctx, "#6a8a3a", x + 5, y + 5, 2, 1);
  px(ctx, "#2a4a2a", x + 3, y + 9, 10, 1);
};

/** The way out or the way between floors, by the set's own way. */
export type DungeonWay = "ladder" | "stairs" | "hatch";

const LOOKS: Record<string, Look> = {
  cave_rock: {
    floor: "rock",
    ground: ["#4c4640", "#403b36", "#57514a", "#36322e"],
    wall: "rock",
    walls: ["#24201c", "#3a342e", "#6a6158", "#544c44", "#3e3832"],
    pool: ["#1e3a48", "#3a6274", "#16303c"],
    props: [
      spike("#7a7066", "#9a9086"),
      spikes("#6e665c", "#8e867c"),
      boulder("#6e665c", "#8a8278", "#4e4840"),
      pile("#6a6258", "#8a8278", "#4e4840"),
      mushrooms("#3aa0a0", "#9af0e0"),
      () => undefined,
      ropeBucket,
      bones("#d8d0bc", "#8a8270"),
    ],
  },
  cave_ice: {
    floor: "ice",
    ground: ["#8eb4c8", "#7aa2b8", "#b4d4e4", "#d8ecf6"],
    wall: "ice",
    walls: ["#3a5a70", "#5a84a0", "#a8d0e4", "#7aaac4", "#5a8aa8"],
    pool: ["#2a5a7a", "#6aa8cc", "#1e4660"],
    props: [
      spike("#c4e4f4", "#ffffff", 14),
      hanging("#b4d8ec", "#ffffff"),
      boulder("#9ac0d4", "#d8eef8", "#6a90a8"),
      drift,
      box("#6a8aa0", "#a8c8dc", "#d8eef8"),
      () => undefined,
      spike("#8ae0ff", "#e8fbff", 9),
      skeleton("#e8e4d8", "#9a9688", "rgba(170,220,245,0.45)"),
    ],
  },
  cave_crystal: {
    floor: "sparkle",
    ground: ["#3c3646", "#332e3c", "#4a4356", "#c8a0ff"],
    wall: "rock",
    walls: ["#1c1824", "#342c40", "#5a4e68", "#463c54", "#30283c"],
    pool: ["#2a4a6a", "#60c8e8", "#1e3650"],
    props: [
      spike("#a060e0", "#e0b0ff"),
      spike("#30b0a8", "#a0f0e8"),
      spikes("#9070d0", "#d0b8ff"),
      geode,
      boulder("#5a5660", "#76727c", "#3e3a44", "#4a8a4a"),
      () => undefined,
      lantern,
      cart("#5a4a3a", "#a080d0"),
    ],
  },
  cave_lava: {
    floor: "basalt",
    ground: ["#2a2624", "#221e1c", "#363230", "#e0501a"],
    wall: "rock",
    walls: ["#141110", "#2a2422", "#4a3e38", "#382e2a", "#241e1c"],
    pool: ["#d04a10", "#f8b030", "#a02a08"],
    props: [
      column("#3a3634", "#544e4a", "#262220"),
      vent,
      spikes("#1a1424", "#5a4a6a"),
      boulder("#3a3230", "#544a44", "#221c1a"),
      box("#3a2a20", "#4e3828", "#5a5a60", "#d8a040"),
      () => undefined,
      flame("#3a3634", "#544e4a"),
      dragonSkull,
    ],
  },
  dungeon_crypt: {
    floor: "flags",
    ground: ["#55514b", "#48443f", "#625e57", "#3e3a36"],
    wall: "brick",
    walls: ["#22201e", "#3a3734", "#6e6a64", "#57534e", "#423f3b"],
    pool: ["#2a3a34", "#4a5e54", "#1e2c26"],
    props: [
      sarcophagus,
      skeleton("#d8d0bc", "#8a8270"),
      flame("#4a4440", "#6a645e"),
      box("#5e3a1e", "#7a4e28", "#7a7a82", "#d8b040"),
      spikePlate,
      () => undefined,
      portcullis("#3a3a40", "#6a6a72"),
      column("#6e6a64", "#8a8680", "#4e4a44"),
    ],
  },
  dungeon_sewer: {
    floor: "brick",
    ground: ["#4a4c42", "#3e4038", "#57594e", "#5a7a3a"],
    wall: "brick",
    walls: ["#1c1e1a", "#33362e", "#5a5a4a", "#48493c", "#363828"],
    pool: ["#3a4a2a", "#5a6e3e", "#2a3620"],
    props: [
      grate("#4a4e48", "#141614"),
      pipeOutlet("#5a5e58", "#7a7e78", "#6a8a3a"),
      pile("#5a5040", "#7a6a50", "#3e3628"),
      ratNest,
      crate("#7a5a34", "#9a7444", "#4e3a20"),
      () => undefined,
      valve,
      cylinder("#6a4a2a", "#8a6a3a", "#4a3218", "#3a3a40"),
    ],
  },
  dungeon_temple: {
    floor: "sandstone",
    ground: ["#8a7a5a", "#7a6a4c", "#9a8a68", "#5e5040"],
    wall: "carved",
    walls: ["#3a3024", "#5a4c3a", "#a8946c", "#8a7856", "#6a5a3e"],
    pool: ["#2a5a5a", "#5a9a8a", "#1e4444"],
    props: [
      statue("#a89c80", "#c8bc9e", "#6a604c", true),
      altar,
      column("#a8946c", "#c4b08a", "#7a6a4c", true),
      urn,
      idol,
      () => undefined,
      carvedDoor,
      flame("#5a4a30", "#7a6a48"),
    ],
  },
  station_corridor: {
    floor: "plates",
    ground: ["#525860", "#464c54", "#626870", "#383c42"],
    wall: "bulkhead",
    walls: ["#1a1e24", "#30363e", "#6a7280", "#545c68", "#3e4650"],
    pool: ["#2a6a7a", "#5ac0d0", "#1e4e5a"],
    props: [
      crate("#6a6a5a", "#8a8a76", "#44443a"),
      machine("#4a5058", "#1a4a6a", "#5ad0ff"),
      airlock,
      robot("#7a808a", "#9aa0aa", "#40e0ff"),
      cylinder("#5a8aa8", "#8ab8d4", "#3a6a88", "#d8d8e0"),
      () => undefined,
      grate("#5a6068", "#1a1e22"),
      containers,
    ],
  },
  station_lab: {
    floor: "tiles",
    ground: ["#c4c8cc", "#b4b8bc", "#d8dce0", "#9aa0a6"],
    wall: "bulkhead",
    walls: ["#2a2e34", "#4a5058", "#d8dce0", "#b8bec4", "#9aa0a8"],
    pool: ["#6ac04a", "#a8f070", "#4a9030"],
    props: [
      tube,
      bench("#d8dce0", "#ffffff", "#6a7078", "#50c0e0"),
      holo,
      bed("#6a7078", "#a8d8f0", "#ffffff"),
      freezer,
      () => undefined,
      machine("#3a3e44", "#1a2a3a", "#40e070", true),
      robot("#8a8a90", "#aaaab0", "#e04030", true),
    ],
  },
  station_engine: {
    floor: "grate",
    ground: ["#3e4248", "#30343a", "#50555c", "#1a1c20"],
    wall: "bulkhead",
    walls: ["#141618", "#2a2e32", "#5a5048", "#4a423a", "#3a342e"],
    pool: ["#3a90d0", "#90e0ff", "#2a6aa0"],
    props: [
      reactor,
      generator,
      pipes("#7a6a5a", "#9a8a78", "#5a5048"),
      machine("#4a4e54", "#2a1a0a", "#f0a030"),
      canisters,
      () => undefined,
      cableBox,
      cart("#a83a2a", "#8a8a92"),
    ],
  },
  station_hydro: {
    floor: "plates",
    ground: ["#4c5a50", "#404c44", "#5c6a60", "#6a8a4a"],
    wall: "bulkhead",
    walls: ["#1a2420", "#304038", "#7a9a88", "#5a7a68", "#3e5a4a"],
    pool: ["#3a6a3a", "#7ab05a", "#2a4e2a"],
    props: [
      planter("#6a4a2a", "#3a8a3a", "#6ac04a"),
      planter("#4a5058", "#2a7a3a", "#5ab04a", "#e8a030"),
      cylinder("#5a8aa8", "#8ab8d4", "#3a6a88", "#d8d8e0"),
      growRack,
      crate("#5a6a5a", "#7a8a76", "#3a4a3a"),
      () => undefined,
      robot("#6a8a6a", "#8aaa8a", "#f0e040"),
      compost,
    ],
  },
};

/** Whether a dungeon set has a look drawn in code. */
export function dungeonPaintsSet(set: string | undefined): boolean {
  return Boolean(set && LOOKS[set]);
}

/** A floor cell; a planned crypt's hall is set darker than its rooms. */
export function paintDungeonFloor(ctx: Ctx, set: string, x: number, y: number, noise: Noise, hall = false) {
  const look = LOOKS[set]!;
  const [base, dark, light, fleck] = look.ground;
  px(ctx, hall ? dark : base, x, y, T, T);
  switch (look.floor) {
    case "rock":
    case "basalt": {
      for (let i = 0; i < 4; i++)
        px(ctx, i % 2 ? dark : light, x + Math.floor(noise(i) * 13), y + Math.floor(noise(i + 9) * 13), 3, 2);
      if (noise(20) < (look.floor === "basalt" ? 0.18 : 0.4)) {
        const cx = x + 2 + Math.floor(noise(21) * 10);
        const cy = y + 2 + Math.floor(noise(22) * 10);
        const crack = look.floor === "basalt" ? fleck : dark;
        px(ctx, crack, cx, cy, 3, 1);
        px(ctx, crack, cx + 2, cy + 1, 1, 2);
        px(ctx, crack, cx + 3, cy + 3, 2, 1);
      }
      return;
    }
    case "ice":
      // Smooth ice: a rare long glint, a rare crack.
      if (noise(1) < 0.35) px(ctx, light, x + Math.floor(noise(2) * 6), y + Math.floor(noise(3) * 12), 7, 1);
      if (noise(4) < 0.12) px(ctx, fleck, x + 2 + Math.floor(noise(5) * 10), y + 2 + Math.floor(noise(6) * 10), 2, 1);
      if (noise(7) < 0.2) {
        const cx = x + 2 + Math.floor(noise(8) * 10);
        const cy = y + 2 + Math.floor(noise(9) * 10);
        px(ctx, dark, cx, cy, 2, 1);
        px(ctx, dark, cx + 2, cy + 1, 2, 1);
      }
      return;
    case "sparkle":
      for (let i = 0; i < 3; i++)
        px(ctx, i ? dark : light, x + Math.floor(noise(i) * 13), y + Math.floor(noise(i + 9) * 13), 3, 2);
      if (noise(30) < 0.45) px(ctx, fleck, x + Math.floor(noise(31) * 15), y + Math.floor(noise(32) * 15), 1, 1);
      if (noise(33) < 0.25) px(ctx, "#70e0e0", x + Math.floor(noise(34) * 15), y + Math.floor(noise(35) * 15), 1, 1);
      return;
    case "flags":
    case "sandstone": {
      const split = 5 + Math.floor(noise(1) * 6);
      px(ctx, fleck, x, y + split, T, 1);
      px(ctx, fleck, x + 3 + Math.floor(noise(2) * 9), y, 1, split);
      px(ctx, fleck, x + 2 + Math.floor(noise(3) * 11), y + split, 1, T - split);
      px(ctx, fleck, x, y + 15, T, 1);
      px(ctx, fleck, x + 15, y, 1, T);
      px(ctx, light, x + 1, y + 1, 4, 1);
      if (look.floor === "sandstone" && noise(4) < 0.4) {
        const cx = x + 3 + Math.floor(noise(5) * 8);
        px(ctx, dark, cx, y + 3, 1, 3);
        px(ctx, dark, cx + 1, y + 6, 1, 3);
      }
      return;
    }
    case "brick":
      for (let row = 0; row < 4; row++) {
        px(ctx, dark, x, y + row * 4 + 3, T, 1);
        const off = row % 2 ? 4 : 0;
        px(ctx, dark, x + off, y + row * 4, 1, 3);
        px(ctx, dark, x + off + 8, y + row * 4, 1, 3);
      }
      if (noise(1) < 0.3) px(ctx, fleck, x + Math.floor(noise(2) * 13), y + Math.floor(noise(3) * 13), 2, 1);
      return;
    case "plates":
      px(ctx, fleck, x, y + 15, T, 1);
      px(ctx, fleck, x + 15, y, 1, T);
      px(ctx, light, x, y, T, 1);
      px(ctx, light, x, y, 1, T);
      px(ctx, dark, x + 2, y + 2, 1, 1);
      px(ctx, dark, x + 13, y + 2, 1, 1);
      px(ctx, dark, x + 2, y + 13, 1, 1);
      px(ctx, dark, x + 13, y + 13, 1, 1);
      if (noise(1) < 0.25) px(ctx, dark, x + 4, y + 7, 8, 2);
      return;
    case "tiles":
      px(ctx, dark, x + 7, y, 1, T);
      px(ctx, dark, x, y + 7, T, 1);
      px(ctx, dark, x + 15, y, 1, T);
      px(ctx, dark, x, y + 15, T, 1);
      px(ctx, light, x + 1, y + 1, 5, 1);
      px(ctx, light, x + 9, y + 9, 5, 1);
      return;
    case "grate":
      for (let gy = 0; gy < 4; gy++)
        for (let gx = 0; gx < 4; gx++) px(ctx, fleck, x + 1 + gx * 4, y + 1 + gy * 4, 2, 2);
      px(ctx, light, x, y, T, 1);
      return;
  }
}

/** A wall cell: its top, and its face where a floor lies below. */
export function paintDungeonWall(ctx: Ctx, set: string, x: number, y: number, faceBelow: boolean, noise: Noise) {
  const look = LOOKS[set]!;
  const [top, edge, face, faceDark, line] = look.walls;
  px(ctx, top, x, y, T, T);
  if (!faceBelow) {
    px(ctx, edge, x, y, T, 1);
    if (look.wall === "rock" || look.wall === "ice") px(ctx, edge, x + Math.floor(noise(1) * 10), y + 5, 4, 1);
    return;
  }
  px(ctx, edge, x, y + 4, T, 1);
  px(ctx, face, x, y + 5, T, 11);
  switch (look.wall) {
    case "rock":
    case "ice": {
      // Rough rock: lumps and shadows, never a straight course.
      for (let i = 0; i < 3; i++)
        px(ctx, faceDark, x + Math.floor(noise(i) * 12), y + 6 + Math.floor(noise(i + 5) * 8), 4, 2);
      px(ctx, look.wall === "ice" ? "#ffffff" : edge, x + 1 + Math.floor(noise(9) * 8), y + 6, 5, 1);
      px(ctx, line, x, y + 15, T, 1);
      if (look.wall === "ice") px(ctx, "#e8f8ff", x + 3 + Math.floor(noise(11) * 8), y + 8, 1, 4);
      return;
    }
    case "brick":
      for (const [row, off] of [
        [5, 0],
        [10, 4],
      ] as const) {
        px(ctx, line, x, y + row + 4, T, 1);
        px(ctx, line, x + off + 3, y + row, 1, 4);
        px(ctx, line, x + off + 11, y + row, 1, 4);
      }
      px(ctx, line, x, y + 15, T, 1);
      if (set === "dungeon_sewer" && noise(3) < 0.6) px(ctx, "#4a6a2a", x + Math.floor(noise(4) * 10), y + 13, 5, 2);
      return;
    case "carved":
      px(ctx, faceDark, x, y + 8, T, 3);
      for (let i = 1; i < T; i += 4) px(ctx, line, x + i, y + 9, 2, 1);
      px(ctx, line, x, y + 15, T, 1);
      return;
    case "bulkhead":
      px(ctx, faceDark, x, y + 11, T, 4);
      px(ctx, line, x, y + 10, T, 1);
      px(ctx, line, x + 7, y + 5, 1, 5);
      px(ctx, edge, x + 2, y + 6, 3, 1);
      if (noise(2) < 0.3) px(ctx, "#d8a020", x + 10, y + 12, 3, 1);
      px(ctx, line, x, y + 15, T, 1);
      return;
  }
}

/** A pool's lip where it meets dry ground: a shadow under its near bank, a wet rim on the others. */
export function paintPoolRim(
  ctx: Ctx,
  x: number,
  y: number,
  dry: { n: boolean; s: boolean; w: boolean; e: boolean },
  rim = "rgba(255,255,255,0.22)",
) {
  if (dry.n) px(ctx, "rgba(0,0,0,0.38)", x, y, T, 3);
  if (dry.s) px(ctx, rim, x, y + 15, T, 1);
  if (dry.w) px(ctx, rim, x, y, 1, T);
  if (dry.e) px(ctx, rim, x + 15, y, 1, T);
}

/** A pool cell: the set's water, coolant or lava. */
export function paintDungeonPool(ctx: Ctx, set: string, x: number, y: number, noise: Noise) {
  const [pool, ripple, depth] = LOOKS[set]!.pool;
  px(ctx, pool, x, y, T, T);
  for (let i = 0; i < 2; i++) {
    const rx = x + Math.floor(noise(i * 2) * 10);
    const ry = y + 3 + Math.floor(noise(i * 2 + 1) * 10);
    px(ctx, ripple, rx, ry, 5, 1);
    px(ctx, depth, rx + 1, ry + 1, 4, 1);
  }
}

/** One of the set's props (slot 5, the way, is drawn by `paintDungeonWay`). */
export function paintDungeonProp(ctx: Ctx, set: string, prop: number, x: number, y: number) {
  LOOKS[set]?.props[prop]?.(ctx, x, y);
}

/** The way: out to the surface (lit), down to the next floor, or up to the one above. */
export function paintDungeonWay(ctx: Ctx, way: DungeonWay, to: "out" | "down" | "up", x: number, y: number) {
  if (way === "hatch") {
    px(ctx, INK, x + 1, y + 1, 14, 14);
    px(ctx, "#5a6068", x + 2, y + 2, 12, 12);
    px(ctx, to === "out" ? "#e8e0b0" : "#0e1014", x + 4, y + 4, 8, 8);
    px(ctx, "#d8a020", x + 2, y + 2, 12, 1);
    px(ctx, "#d8a020", x + 2, y + 13, 12, 1);
    for (let r = 5; r < 12; r += 3) px(ctx, "#8a9098", x + 5, y + r, 6, 1);
    return;
  }
  if (way === "ladder") {
    px(ctx, INK, x + 2, y + 1, 12, 14);
    px(ctx, to === "out" ? "#d8cca0" : "#08060a", x + 3, y + 2, 10, 12);
    px(ctx, "#7a5a34", x + 4, y, 2, T);
    px(ctx, "#7a5a34", x + 10, y, 2, T);
    for (let r = 2; r < T; r += 4) px(ctx, "#9a7444", x + 4, y + r, 8, 1);
    return;
  }
  // Stairs: going up (and out) the steps lighten, going down they darken.
  px(ctx, INK, x + 1, y, 14, T);
  const shades =
    to === "down" ? ["#8a8070", "#6a6256", "#4a443c", "#2a2620"] : ["#3a3530", "#5a544a", "#7a7266", "#9a9282"];
  for (let i = 0; i < 4; i++) {
    px(ctx, shades[i]!, x + 2, y + i * 4, 12, 3);
    px(ctx, INK, x + 2, y + i * 4 + 3, 12, 1);
  }
  if (to === "out") px(ctx, "#f0e6c0", x + 2, y, 12, 2);
}
