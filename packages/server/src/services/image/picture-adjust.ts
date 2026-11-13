// ──────────────────────────────────────────────
// Small picture fixes Professor Mari can make on a preview (`mari images adjust`): crop, trim empty
// edges, turn a flat background see-through, resize, flip, rotate and tint. Runs in the server with
// sharp, so it works the same on every computer (Mari's shell is off on Windows). The result is a
// PNG, which keeps transparency; saving into a theme turns it into WebP as usual.
// ──────────────────────────────────────────────
import { isAllowedImageBuffer } from "../../utils/security.js";
import { getSharp } from "./sharp-runtime.js";
import { THEME_IMAGE_DECODE_MAX_PIXELS, THEME_IMAGE_DECODE_MAX_SIDE } from "./theme-package-image.js";

export type PictureAdjustments = {
  /** Pixels or percentages of the picture: left, top, width, height. */
  crop?: { left: string; top: string; width: string; height: string };
  /** Cut away edges that match the corner colour (or are already see-through). */
  trim?: boolean;
  /** "auto" takes the colour in the corners. */
  transparent?: string;
  /** 0-255: how far from that colour still counts as background. */
  tolerance?: number;
  /** Clear that colour everywhere, not only where it touches the edge. */
  everywhere?: boolean;
  resize?: { width?: number; height?: number; fit: "inside" | "cover" | "fill" };
  flip?: "horizontal" | "vertical" | "both";
  rotate?: 90 | 180 | 270;
  tint?: string;
};

export type AdjustedPicture = { buffer: Buffer; width: number; height: number; steps: string[] };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_OUTPUT_SIDE = 4096;

export function parseHexColour(value: string): { r: number; g: number; b: number } {
  const match = value.trim().match(HEX);
  if (!match) throw new Error(`Colours are hex like #1a2b3c, got "${value}"`);
  let hex = match[1]!;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function measure(value: string, whole: number, label: string): number {
  const raw = value.trim();
  const percent = raw.endsWith("%");
  const number = Number(percent ? raw.slice(0, -1) : raw.replace(/px$/i, ""));
  if (!Number.isFinite(number) || number < 0) throw new Error(`--crop ${label} must be pixels or a percentage`);
  return Math.round(percent ? (number / 100) * whole : number);
}

/** Makes background pixels see-through: those within `tolerance` of `colour`, fading over a soft edge. */
function clearColour(
  pixels: Buffer,
  width: number,
  height: number,
  colour: { r: number; g: number; b: number },
  tolerance: number,
  everywhere: boolean,
): number {
  const soft = Math.max(8, Math.round(tolerance / 2));
  const distance = (index: number) => {
    const o = index * 4;
    return Math.max(
      Math.abs(pixels[o]! - colour.r),
      Math.abs(pixels[o + 1]! - colour.g),
      Math.abs(pixels[o + 2]! - colour.b),
    );
  };
  const total = width * height;
  const background = new Uint8Array(total);
  if (everywhere) {
    for (let i = 0; i < total; i += 1) if (distance(i) <= tolerance + soft) background[i] = 1;
  } else {
    // Only what touches the edge, so a subject with the same colour inside keeps it.
    const stack: number[] = [];
    const push = (i: number) => {
      if (!background[i] && distance(i) <= tolerance + soft) {
        background[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < width; x += 1) {
      push(x);
      push((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      push(y * width);
      push(y * width + width - 1);
    }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (i >= width) push(i - width);
      if (i < total - width) push(i + width);
    }
  }
  let cleared = 0;
  for (let i = 0; i < total; i += 1) {
    if (!background[i]) continue;
    const d = distance(i);
    const keep = d <= tolerance ? 0 : (d - tolerance) / soft;
    const o = i * 4 + 3;
    pixels[o] = Math.round(pixels[o]! * Math.min(1, keep));
    cleared += 1;
  }
  return cleared;
}

export async function adjustPicture(input: Buffer, adjust: PictureAdjustments): Promise<AdjustedPicture> {
  if (!isAllowedImageBuffer(input)) throw new Error("Only PNG, JPEG, WebP, GIF or AVIF pictures can be adjusted.");
  const sharp = await getSharp();
  const options = { limitInputPixels: THEME_IMAGE_DECODE_MAX_PIXELS };
  const meta = await sharp(input, { ...options, animated: true }).metadata();
  if (Number(meta.pages ?? 1) > 1) throw new Error("Animated pictures can't be adjusted; use a still one.");
  let width = Number(meta.width ?? 0);
  let height = Number(meta.height ?? 0);
  if (!width || !height) throw new Error("The picture could not be read.");
  if (width > THEME_IMAGE_DECODE_MAX_SIDE || height > THEME_IMAGE_DECODE_MAX_SIDE) {
    throw new Error(`Pictures can be at most ${THEME_IMAGE_DECODE_MAX_SIDE} px on a side.`);
  }
  const steps: string[] = [];
  // Each step decodes the last one's PNG, so the order below is the order they happen in.
  let current = await sharp(input, options).rotate().ensureAlpha().png().toBuffer();
  const step = async (run: (image: ReturnType<typeof sharp>) => ReturnType<typeof sharp>, note: string) => {
    const out = await run(sharp(current, options)).png().toBuffer({ resolveWithObject: true });
    current = out.data;
    width = out.info.width;
    height = out.info.height;
    steps.push(`${note} → ${width}×${height}`);
  };

  if (adjust.crop) {
    const left = measure(adjust.crop.left, width, "left");
    const top = measure(adjust.crop.top, height, "top");
    const cropWidth = Math.min(measure(adjust.crop.width, width, "width"), width - left);
    const cropHeight = Math.min(measure(adjust.crop.height, height, "height"), height - top);
    if (left >= width || top >= height || cropWidth < 1 || cropHeight < 1) {
      throw new Error(`--crop falls outside the ${width}×${height} picture`);
    }
    await step((image) => image.extract({ left, top, width: cropWidth, height: cropHeight }), "cropped");
  }
  if (adjust.trim) {
    const before = `${width}×${height}`;
    try {
      await step((image) => image.trim({ threshold: 12 }), "trimmed empty edges");
    } catch {
      steps.push(`trimmed nothing (no plain edge) → ${before}`);
    }
  }
  if (adjust.transparent) {
    const tolerance = Math.max(0, Math.min(255, Math.round(adjust.tolerance ?? 24)));
    const raw = await sharp(current, options).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = raw.data;
    const colour =
      adjust.transparent.trim().toLowerCase() === "auto"
        ? { r: pixels[0]!, g: pixels[1]!, b: pixels[2]! }
        : parseHexColour(adjust.transparent);
    const cleared = clearColour(pixels, raw.info.width, raw.info.height, colour, tolerance, adjust.everywhere === true);
    current = await sharp(pixels, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } })
      .png()
      .toBuffer();
    const hex = `#${[colour.r, colour.g, colour.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    const share = Math.round((cleared / (raw.info.width * raw.info.height)) * 100);
    steps.push(
      `made ${hex} see-through (${share}% of the picture${adjust.everywhere ? ", everywhere" : ", from the edges"})`,
    );
  }
  if (adjust.resize) {
    const { width: w, height: h, fit } = adjust.resize;
    for (const side of [w, h]) {
      if (side !== undefined && (!Number.isInteger(side) || side < 1 || side > MAX_OUTPUT_SIDE)) {
        throw new Error(`Resize sides are whole pixels from 1 to ${MAX_OUTPUT_SIDE}`);
      }
    }
    await step(
      (image) =>
        image.resize({
          width: w,
          height: h,
          fit,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        }),
      `resized (${fit})`,
    );
  }
  if (adjust.flip) {
    const flip = adjust.flip;
    await step((image) => {
      let next = image;
      if (flip === "horizontal" || flip === "both") next = next.flop();
      if (flip === "vertical" || flip === "both") next = next.flip();
      return next;
    }, `flipped ${flip}`);
  }
  if (adjust.rotate) {
    const angle = adjust.rotate;
    await step((image) => image.rotate(angle), `rotated ${angle}°`);
  }
  if (adjust.tint) {
    const colour = parseHexColour(adjust.tint);
    await step((image) => image.tint(colour), `tinted ${adjust.tint}`);
  }
  if (steps.length === 0) {
    throw new Error("Say what to change: --crop, --trim, --transparent, --resize, --flip, --rotate or --tint");
  }
  return { buffer: current, width, height, steps };
}
