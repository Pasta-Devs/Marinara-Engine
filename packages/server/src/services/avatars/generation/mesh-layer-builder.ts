// ──────────────────────────────────────────────
// Avatar generation: the mesh-avatar layer builder in JavaScript
// ──────────────────────────────────────────────
// A port of mesh-avatar-studio's tools/build-layers.py (MIT, shinshin86) to plain
// typed-array pixel work, with sharp only decoding and encoding PNGs: no Python, OpenCV or GPU. It cuts
// each eye into its ball, lash, lower-lid and crease layers and fills the hole they leave in the base
// picture. Hands, hanging accessories, buns and hair strands are not built: the rig leaves those optional
// groups out, so the avatar's hair moves with its head. No drawn eye or mouth sprites are written:
// mesh-avatar 0.1.1 treats any sprites.json as the full set (half-closed and smiling eyes, four mouth
// shapes) and turns its own eyelids and mouth off, so a partial set leaves faces without eyes or a mouth.
// The work runs on the server's main thread in short slices, so other requests and Cancel get through.
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { getSharp } from "../../image/sharp-runtime.js";
import type { MeshRig, MeshRigLayout } from "./mesh-rig-layout.js";

type Point = [number, number];
type Mask = Uint8Array;
type Rect = [number, number, number, number];

/** RGBA pixels of a whole picture or of a work area cut from one (origin `x`, `y` in the picture). */
interface Pixels {
  x: number;
  y: number;
  width: number;
  height: number;
  data: Uint8Array;
}

export interface MeshLayerSource {
  png: Buffer;
  width: number;
  height: number;
}

export type MeshAvatarFiles = Map<string, Buffer>;

const LUMA = [0.3, 0.59, 0.11] as const;
/** Room around an eye for the skin samples and the fill around the hole. */
const WORK_MARGIN = 40;
/** Relaxation steps of the skin fill; it starts from the skin colour, so it settles quickly. */
const MEMBRANE_ITERATIONS = 200;
/** Longest stretch of pixel work before other requests get a turn. */
const SLICE_MS = 25;

/** Most pixels one eye's work area may cover. The fill's work grows with the eye's size, so a sprite with
 *  bigger eyes is built smaller (meshWorkScale) and a build stays a few seconds of work, phones included. */
const EYE_WORK_MAX_PIXELS = 120_000;

/** How much to shrink a sprite so each eye region (x0, y0, x1, y1), with the room around it, fits
 *  EYE_WORK_MAX_PIXELS. 1 when it already fits. */
export function meshWorkScale(regions: ReadonlyArray<readonly [number, number, number, number]>): number {
  const largest = Math.max(
    ...regions.map(([x0, y0, x1, y1]) => (x1 - x0 + 2 * WORK_MARGIN) * (y1 - y0 + 2 * WORK_MARGIN)),
  );
  return Math.min(1, Math.sqrt(EYE_WORK_MAX_PIXELS / largest));
}

/** Lets other requests run, then stops if the request was cancelled. */
async function pause(signal: AbortSignal | undefined): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  signal?.throwIfAborted();
}

// ── Pixel helpers ──

async function decodeRgba(png: Buffer): Promise<Pixels> {
  const sharp = await getSharp();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { x: 0, y: 0, width: info.width, height: info.height, data: new Uint8Array(data) };
}

async function encodePng(pixels: Pixels, channels: 1 | 4 = 4): Promise<Buffer> {
  const sharp = await getSharp();
  return sharp(Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.length), {
    raw: { width: pixels.width, height: pixels.height, channels },
  })
    .png()
    .toBuffer();
}

function crop(image: Pixels, x: number, y: number, width: number, height: number): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const from = ((y - image.y + row) * image.width + (x - image.x)) * 4;
    data.set(image.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { x, y, width, height, data };
}

function workArea(image: Pixels, points: readonly Point[], margin: number): Pixels {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - margin);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - margin);
  const x1 = Math.min(image.width, Math.ceil(Math.max(...xs)) + margin + 1);
  const y1 = Math.min(image.height, Math.ceil(Math.max(...ys)) + margin + 1);
  return crop(image, x0, y0, x1 - x0, y1 - y0);
}

/** Pixels whose centre lies inside the polygon (given in picture coordinates). */
function polygonMask(area: Pixels, polygon: readonly Point[]): Mask {
  const mask = new Uint8Array(area.width * area.height);
  for (let row = 0; row < area.height; row += 1) {
    const y = area.y + row + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const [ax, ay] = polygon[i]!;
      const [bx, by] = polygon[(i + 1) % polygon.length]!;
      if ((ay <= y && y < by) || (by <= y && y < ay)) crossings.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil(crossings[i]! - 0.5 - area.x));
      const to = Math.min(area.width - 1, Math.floor(crossings[i + 1]! - 0.5 - area.x));
      for (let col = from; col <= to; col += 1) mask[row * area.width + col] = 1;
    }
  }
  return mask;
}

/** Square max filter of the given radius (OpenCV dilate with a (2r+1)² kernel). */
function dilate(mask: Mask, width: number, height: number, radius: number): Mask {
  if (radius <= 0) return mask.slice();
  const horizontal = new Uint8Array(mask.length);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      let on = 0;
      for (let k = Math.max(0, col - radius); k <= Math.min(width - 1, col + radius) && !on; k += 1) {
        on = mask[row * width + k]!;
      }
      horizontal[row * width + col] = on;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      let on = 0;
      for (let k = Math.max(0, row - radius); k <= Math.min(height - 1, row + radius) && !on; k += 1) {
        on = horizontal[k * width + col]!;
      }
      out[row * width + col] = on;
    }
  }
  return out;
}

function erode(mask: Mask, width: number, height: number, radius: number): Mask {
  return not(dilate(not(mask), width, height, radius));
}

function not(mask: Mask): Mask {
  return mask.map((value) => (value ? 0 : 1));
}

function and(...masks: Mask[]): Mask {
  return masks[0]!.map((value, i) => (value && masks.every((mask) => mask[i]) ? 1 : 0));
}

function or(...masks: Mask[]): Mask {
  return masks[0]!.map((_, i) => (masks.some((mask) => mask[i]) ? 1 : 0));
}

function luma(data: ArrayLike<number>, offset: number): number {
  return data[offset]! * LUMA[0] + data[offset + 1]! * LUMA[1] + data[offset + 2]! * LUMA[2];
}

function maxChannelDifference(data: ArrayLike<number>, offset: number, colour: ArrayLike<number>, colourOffset = 0) {
  return Math.max(
    Math.abs(data[offset]! - colour[colourOffset]!),
    Math.abs(data[offset + 1]! - colour[colourOffset + 1]!),
    Math.abs(data[offset + 2]! - colour[colourOffset + 2]!),
  );
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * (p / 100);
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

/** How much darker than the skin just above and below it a faded lip end still counts as line. */
const FADED_LINE_CONTRAST = 12;

/** The line's columns past `end` in direction `step`, at most `limit` of them, while each column's darkest
 *  pixel near the line is visibly darker than the skin above and below it. Comparing within the column keeps
 *  smooth shading from passing as line. */
function followFadedLine(image: Pixels, end: Point, step: 1 | -1, reach: number, limit: number): Point[] {
  const found: Point[] = [];
  let y = end[1];
  for (let x = Math.floor(end[0]) + step; found.length < limit && x >= 0 && x < image.width; x += step) {
    let row = -1;
    let darkest = Infinity;
    for (let r = Math.floor(y) - reach; r <= Math.floor(y) + reach; r += 1) {
      const at = (r * image.width + x) * 4;
      if (r < 0 || r >= image.height || image.data[at + 3]! <= 200 || luma(image.data, at) >= darkest) continue;
      darkest = luma(image.data, at);
      row = r;
    }
    const above = row - reach - 2;
    const below = row + reach + 2;
    if (row < 0 || above < 0 || below >= image.height) break;
    const skin = Math.min(
      luma(image.data, (above * image.width + x) * 4),
      luma(image.data, (below * image.width + x) * 4),
    );
    if (skin - darkest < FADED_LINE_CONTRAST) break;
    y = row + 0.5;
    found.push([x + 0.5, y]);
  }
  return found;
}

/** Refines a closed drawn lip line, allowing short highlights; absent or open ink keeps the fallback. */
export async function fitDrawnMouth(
  source: MeshLayerSource,
  mouth: MeshRigLayout["mouth"],
  signal?: AbortSignal,
): Promise<MeshRigLayout["mouth"]> {
  signal?.throwIfAborted();
  const image = await decodeRgba(source.png);
  const span = mouth.right[0] - mouth.left[0];
  const margin = Math.max(4, Math.ceil(span * 0.15));
  const area = workArea(
    image,
    [
      [Math.min(mouth.left[0], mouth.box[0]) - margin, Math.min(mouth.left[1], mouth.right[1], mouth.box[1])],
      [Math.max(mouth.right[0], mouth.box[2]) + margin, Math.max(mouth.left[1], mouth.right[1], mouth.box[3])],
    ],
    4,
  );
  const lumas: number[] = [];
  for (let i = 0; i < area.width * area.height; i += 1)
    if (area.data[i * 4 + 3]! > 200) lumas.push(luma(area.data, i * 4));
  const skin = percentile(lumas, 50);
  const points: Point[] = [];
  const thicknesses: number[] = [];
  for (let x = 0; x < area.width; x += 1) {
    let weight = 0;
    let weightedY = 0;
    let first = -1;
    let last = -1;
    for (let y = 0; y < area.height; y += 1) {
      const at = (y * area.width + x) * 4;
      const darkness = skin - luma(area.data, at);
      if (area.data[at + 3]! <= 200 || darkness < 35) continue;
      if (first < 0) first = y;
      last = y;
      weight += darkness;
      weightedY += (area.y + y + 0.5) * darkness;
    }
    if (weight) {
      points.push([area.x + x + 0.5, weightedY / weight]);
      thicknesses.push(last - first + 1);
    }
  }
  await pause(signal);
  if (
    points.length < Math.max(8, span * 0.55) ||
    percentile(thicknesses, 75) > Math.max(3, span * 0.12) ||
    points.some((p, i) => i > 0 && p[0] - points[i - 1]![0] > Math.max(2, span * 0.15))
  )
    return mouth;
  const left = points[0]!;
  const right = points.at(-1)!;
  const length = Math.hypot(right[0] - left[0], right[1] - left[1]);
  if (length < span * 0.55 || length > span + 2 * margin) return mouth;
  const cosine = (right[0] - left[0]) / length;
  const sine = (right[1] - left[1]) / length;
  const samples = points.map(([x, y]) => {
    const along = (x - left[0]) * cosine + (y - left[1]) * sine;
    return { curve: 4 * (along / length) * (1 - along / length), depth: (y - left[1]) * cosine - (x - left[0]) * sine };
  });
  const bow =
    samples.reduce((sum, p) => sum + p.curve * p.depth, 0) / samples.reduce((sum, p) => sum + p.curve ** 2, 0);
  const error = Math.sqrt(samples.reduce((sum, p) => sum + (p.depth - bow * p.curve) ** 2, 0) / samples.length);
  if (Math.abs(bow) > length * 0.3 || error > Math.max(1.5, percentile(thicknesses, 50) * 0.6)) return mouth;
  // Lip lines often taper to ends lighter than the ink threshold, or run past corners the vision model put
  // too far in. The painted mouth opens across the whole line, so the fitted curve is carried out to where
  // the line visibly ends; the fit itself stays on the solid ink.
  const reach = Math.max(2, Math.ceil(percentile(thicknesses, 50)));
  const limit = Math.ceil(span * 0.3);
  // Each faded end is projected onto the fitted line in both axes, so a tilted mouth whose tail runs flat
  // isn't carried past where that tail ends. Fading only ever lengthens the line.
  const along = ([x, y]: Point) => (x - left[0]) * cosine + (y - left[1]) * sine;
  const from = Math.min(0, along(followFadedLine(image, left, -1, reach, limit).at(-1) ?? left));
  const to = Math.max(length, along(followFadedLine(image, right, 1, reach, limit).at(-1) ?? right));
  const onCurve = (along: number): Point => {
    const depth = bow * 4 * (along / length) * (1 - along / length);
    return [left[0] + along * cosine - depth * sine, left[1] + along * sine + depth * cosine];
  };
  // A parabola's sag over any chord grows with the chord's length squared.
  return { ...mouth, left: onCurve(from), right: onCurve(to), bow: bow * ((to - from) / length) ** 2 };
}

/** Per-channel median colour of the selected pixels. */
function medianColour(image: Pixels, select: (index: number) => boolean): [number, number, number] | null {
  const channels: [number[], number[], number[]] = [[], [], []];
  for (let i = 0; i < image.width * image.height; i += 1) {
    if (!select(i)) continue;
    for (let c = 0; c < 3; c += 1) channels[c]!.push(image.data[i * 4 + c]!);
  }
  if (!channels[0].length) return null;
  return channels.map((values) => percentile(values, 50)) as [number, number, number];
}

/** Local skin colour from the brighter half of the opaque ring around a region, and how far a pixel
 *  may differ from it and still count as skin (build-layers.py skin_samples). */
function skinSamples(area: Pixels, region: Mask): { colour: [number, number, number]; tolerance: number } {
  const ring = and(dilate(region, area.width, area.height, 12), not(region));
  const lumas: number[] = [];
  for (let i = 0; i < ring.length; i += 1)
    if (ring[i] && area.data[i * 4 + 3]! > 200) lumas.push(luma(area.data, i * 4));
  if (!lumas.length) throw new MeshLayerError("There's no skin around an eye to fill the eye with.");
  const threshold = percentile(lumas, 55);
  const isLight = (i: number) => !!ring[i] && area.data[i * 4 + 3]! > 200 && luma(area.data, i * 4) >= threshold;
  const colour = medianColour(area, isLight)!;
  const spreads: number[] = [];
  for (let i = 0; i < ring.length; i += 1) if (isLight(i)) spreads.push(maxChannelDifference(area.data, i * 4, colour));
  return { colour, tolerance: Math.max(22, Math.min(60, percentile(spreads, 50) * 3)) };
}

interface Membrane {
  rgb: Float32Array;
  pixels: number[];
  neighbours: number[];
  starts: number[];
}

/** The skin fill's starting colours, and each pixel it solves with its neighbours (3x3, clipped at the
 *  edge), listed once so each pass only adds. */
function membrane(area: Pixels, hole: Mask): Membrane {
  const { width, height, data } = area;
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) for (let c = 0; c < 3; c += 1) rgb[i * 3 + c] = data[i * 4 + c]!;
  const pixels: number[] = [];
  const neighbours: number[] = [];
  const starts: number[] = [0];
  if (!hole.some(Boolean)) return { rgb, pixels, neighbours, starts };
  const { colour, tolerance } = skinSamples(area, hole);
  const skin = new Uint8Array(width * height);
  for (let i = 0; i < skin.length; i += 1) {
    skin[i] = !hole[i] && data[i * 4 + 3]! > 200 && maxChannelDifference(data, i * 4, colour) < tolerance ? 1 : 0;
  }
  const solve = or(hole, and(dilate(hole, width, height, 8), not(skin)));
  for (let i = 0; i < solve.length; i += 1) {
    if (!solve[i]) continue;
    for (let c = 0; c < 3; c += 1) rgb[i * 3 + c] = colour[c]!;
    const col = i % width;
    const row = (i - col) / width;
    for (let r = Math.max(0, row - 1); r <= Math.min(height - 1, row + 1); r += 1) {
      for (let k = Math.max(0, col - 1); k <= Math.min(width - 1, col + 1); k += 1) neighbours.push(r * width + k);
    }
    pixels.push(i);
    starts.push(neighbours.length);
  }
  return { rgb, pixels, neighbours, starts };
}

/** One relaxation pass: every solved pixel becomes the average of its neighbours. */
function relax(current: Float32Array, next: Float32Array, { pixels, neighbours, starts }: Membrane): void {
  for (let p = 0; p < pixels.length; p += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let n = starts[p]!; n < starts[p + 1]!; n += 1) {
      const at = neighbours[n]! * 3;
      red += current[at]!;
      green += current[at + 1]!;
      blue += current[at + 2]!;
    }
    const count = starts[p + 1]! - starts[p]!;
    const at = pixels[p]! * 3;
    next[at] = red / count;
    next[at + 1] = green / count;
    next[at + 2] = blue / count;
  }
}

/** Continues the surrounding skin shading into a hole by relaxing it towards the average of its
 *  neighbours (build-layers.py fill_skin's membrane solve). Returns RGB for the whole work area. The
 *  passes run in slices so other requests get through; the pixel loops stay in plain functions, where
 *  they run several times faster than inside this async one.
 *  ponytail: a smooth fill, so a lid painted over the filled hole shows flat shading with no texture;
 *  fine for anime-style skin. Upgrade: masked inpainting once the image path accepts an edit mask. */
async function fillSkin(area: Pixels, hole: Mask, signal: AbortSignal | undefined): Promise<Float32Array> {
  let sliceStart = performance.now();
  const solve = membrane(area, hole);
  let current = solve.rgb;
  if (!solve.pixels.length) return current;
  let next: Float32Array = current.slice();
  for (let iteration = 0; iteration < MEMBRANE_ITERATIONS; iteration += 1) {
    if (performance.now() - sliceStart > SLICE_MS) {
      await pause(signal);
      sliceStart = performance.now();
    }
    relax(current, next, solve);
    [current, next] = [next, current];
  }
  return current;
}

/** Fraction (0..1) of each pixel's 3x3 neighbourhood that is in the mask: a one-pixel soft edge. */
function softEdge(mask: Mask, width: number, height: number): Float32Array {
  const out = new Float32Array(mask.length);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const r = Math.min(height - 1, Math.max(0, row + dy));
          const k = Math.min(width - 1, Math.max(0, col + dx));
          sum += mask[r * width + k]!;
        }
      }
      out[row * width + col] = sum / 9;
    }
  }
  return out;
}

/** The pixels of `area` with alpha scaled by `alpha` (0..1), cut to what is visible plus `pad`. An empty
 *  result is one transparent pixel at the picture's corner, like build-layers.py crop_layer. */
function cropLayer(area: Pixels, alpha: (index: number) => number, pad: number): { pixels: Pixels; rect: Rect } {
  const layer: Pixels = { ...area, data: area.data.slice() };
  let x0 = area.width;
  let y0 = area.height;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < area.width * area.height; i += 1) {
    const value = Math.round(layer.data[i * 4 + 3]! * Math.max(0, Math.min(1, alpha(i))));
    layer.data[i * 4 + 3] = value;
    if (!value) continue;
    const col = i % area.width;
    const row = (i - col) / area.width;
    x0 = Math.min(x0, col);
    x1 = Math.max(x1, col);
    y0 = Math.min(y0, row);
    y1 = Math.max(y1, row);
  }
  if (x1 < 0) return { pixels: { x: 0, y: 0, width: 1, height: 1, data: new Uint8Array(4) }, rect: [0, 0, 1, 1] };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(area.width - 1, x1 + pad);
  y1 = Math.min(area.height - 1, y1 + pad);
  const pixels = crop(layer, area.x + x0, area.y + y0, x1 - x0 + 1, y1 - y0 + 1);
  return { pixels, rect: [pixels.x, pixels.y, pixels.width, pixels.height] };
}

export class MeshLayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MeshLayerError";
  }
}

// ── Eyes ──

function interpolate(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]!) return ys[0]!;
  for (let i = 1; i < xs.length; i += 1) {
    if (x <= xs[i]!) return ys[i - 1]! + ((ys[i]! - ys[i - 1]!) * (x - xs[i - 1]!)) / (xs[i]! - xs[i - 1]!);
  }
  return ys[ys.length - 1]!;
}

interface EyeLayers {
  hole: Mask;
  area: Pixels;
  ball: Mask;
  lines: Record<"lash" | "low" | "crease", { mask: Mask; ink: [number, number, number] }>;
}

interface EyeWork {
  area: Pixels;
  /** The eye opening, the eye with its lashes, and the drawn pixels of the work area. */
  core: Mask;
  region: Mask;
  opaque: Mask;
}

/** An eye's work area and masks. Refuses an eye on an empty part of the picture. */
function eyeWork(image: Pixels, eye: MeshRig["eyes"][number], index: number): EyeWork {
  const area = workArea(image, eye.roi, WORK_MARGIN);
  const core = polygonMask(area, eye.opening);
  const region = polygonMask(area, eye.roi);
  const opaque = area.data.filter((_, i) => i % 4 === 3).map((value) => (value > 0 ? 1 : 0));
  if (!and(core, opaque).some(Boolean))
    throw new MeshLayerError(`Eye ${index + 1} is on an empty part of the picture.`);
  return { area, core, region, opaque };
}

/** Sorts an eye's pixels into eye ball, lash, lower lid and crease (build-layers.py eye_classes).
 *  `estimate` is the skin the region would show without the eye (fillSkin over the region). */
function classifyEye(eye: MeshRig["eyes"][number], work: EyeWork, estimate: Float32Array): EyeLayers {
  const { area, core, region, opaque } = work;
  const { width, height, data } = area;
  const skin = new Uint8Array(width * height);
  for (let i = 0; i < skin.length; i += 1) skin[i] = maxChannelDifference(data, i * 4, estimate, i * 3) < 22 ? 1 : 0;
  const ink = and(region, not(skin), not(core), opaque);

  const samples = Array.from(
    { length: eye.top.length },
    (_, i) => eye.x0 + ((eye.x1 - eye.x0) * i) / (eye.top.length - 1),
  );
  const corePixels: number[] = [];
  for (let i = 0; i < core.length; i += 1) if (core[i] && opaque[i]) corePixels.push(luma(data, i * 4));
  const whiteThreshold = percentile(corePixels, 85);
  const whiteColour = medianColour(area, (i) => !!core[i] && !!opaque[i] && luma(data, i * 4) >= whiteThreshold)!;
  const regionLumas: number[] = [];
  const estimateLumas: number[] = [];
  for (let i = 0; i < region.length; i += 1) {
    if (!region[i]) continue;
    estimateLumas.push(luma(estimate, i * 3));
    if (opaque[i]) regionLumas.push(luma(data, i * 4));
  }
  const dark = percentile(regionLumas, 10);
  const light = percentile(estimateLumas, 50);

  const white = new Uint8Array(width * height);
  const lash = new Uint8Array(width * height);
  const low = new Uint8Array(width * height);
  const crease = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const y = area.y + row;
    for (let col = 0; col < width; col += 1) {
      const i = row * width + col;
      const x = area.x + col;
      const pixelLuma = luma(data, i * 4);
      white[i] = maxChannelDifference(data, i * 4, whiteColour) < 20 && pixelLuma > luma(estimate, i * 3) ? 1 : 0;
      if (!ink[i] || white[i]) continue;
      const insideX = x >= eye.x0 && x <= eye.x1;
      const top = interpolate(x, samples, eye.top);
      const cornerLine = interpolate(x, [eye.x0, eye.x1], [eye.top[0]!, eye.top[eye.top.length - 1]!]);
      const upper = insideX ? y <= top + 3 : y <= cornerLine + 2;
      if (insideX && y < top - 9 && pixelLuma > (light + dark) / 2) crease[i] = 1;
      else if (upper) lash[i] = 1;
      else low[i] = 1;
    }
  }

  let taken = erode(core, width, height, 1);
  const grownRegion = dilate(region, width, height, 2);
  const skinColour = skinSamples(area, region).colour;
  const lines = {} as EyeLayers["lines"];
  for (const [part, mask] of [
    ["lash", lash],
    ["low", low],
    ["crease", crease],
  ] as const) {
    const lumas: number[] = [];
    for (let i = 0; i < mask.length; i += 1) if (mask[i] && data[i * 4 + 3]! > 200) lumas.push(luma(data, i * 4));
    const darkest = percentile(lumas, 10);
    const inkColour =
      medianColour(area, (i) => !!mask[i] && data[i * 4 + 3]! > 200 && luma(data, i * 4) <= darkest) ?? skinColour;
    const grown = and(dilate(mask, width, height, 2), not(taken), grownRegion);
    lines[part] = { mask: grown, ink: inkColour };
    taken = or(taken, grown);
  }
  const ball = dilate(core, width, height, 1);
  const stray = and(ink, white, not(ball));
  const near = and(dilate(core, width, height, 7), not(core));
  return { area, ball, lines, hole: or(taken, core, stray, and(white, near)) };
}

/** The lid layer that reproduces the picture where it lies over the filled skin, so soft line edges
 *  keep their anti-aliasing without a halo of the old eye (build-layers.py unblend). */
function unblendLine(area: Pixels, under: Float32Array, mask: Mask, ink: readonly number[]): Pixels {
  const out: Pixels = { ...area, data: new Uint8Array(area.data.length) };
  const edge = softEdge(mask, area.width, area.height);
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    let a = 0;
    for (let c = 0; c < 3; c += 1) {
      const skin = under[i * 3 + c]!;
      a = Math.max(a, (skin - area.data[i * 4 + c]!) / Math.max(skin - ink[c]!, 1));
    }
    a = Math.max(0, Math.min(1, a));
    for (let c = 0; c < 3; c += 1) {
      const skin = under[i * 3 + c]!;
      out.data[i * 4 + c] = Math.max(0, Math.min(255, (area.data[i * 4 + c]! - skin * (1 - a)) / Math.max(a, 1e-3)));
    }
    out.data[i * 4 + 3] = Math.round(a * 255 * Math.min(1, edge[i]! * 1.6));
  }
  return out;
}

export interface BuiltMeshLayers {
  files: MeshAvatarFiles;
  rects: Record<string, Rect>;
  build: string;
}

/** Makes nearly opaque pixels fully opaque (build-layers.py does the same before cutting). */
function solidifyAlpha(data: Uint8Array): void {
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 240) data[i] = 255;
}

/** Blends the filled skin into the base picture along the hole's soft edge. */
function paintHole(base: Pixels, area: Pixels, hole: Mask, under: Float32Array): void {
  const edge = softEdge(hole, area.width, area.height);
  for (let i = 0; i < hole.length; i += 1) {
    if (!edge[i]) continue;
    const col = i % area.width;
    const row = (i - col) / area.width;
    const at = ((area.y + row) * base.width + area.x + col) * 4;
    for (let c = 0; c < 3; c += 1) {
      base.data[at + c] = Math.round(area.data[i * 4 + c]! * (1 - edge[i]!) + under[i * 3 + c]! * edge[i]!);
    }
  }
}

/** Builds `built/` for a rig whose eyes carry their sampled curves: base.png with the eyes taken out and
 *  the holes filled, an empty hairmask.png, the four layers of each eye and layers.json. Cancelled
 *  through `signal` between slices of work. */
export async function buildMeshAvatarLayers(
  source: MeshLayerSource,
  rig: MeshRig,
  signal?: AbortSignal,
): Promise<BuiltMeshLayers> {
  const image = await decodeRgba(source.png);
  if (image.width !== rig.image.width || image.height !== rig.image.height) {
    throw new MeshLayerError("The rig and the picture are different sizes.");
  }
  solidifyAlpha(image.data);
  const base: Pixels = { ...image, data: image.data.slice() };
  const files: MeshAvatarFiles = new Map();
  const rects: Record<string, Rect> = {};

  for (const [index, eye] of rig.eyes.entries()) {
    const work = eyeWork(image, eye, index);
    const estimate = await fillSkin(work.area, work.region, signal);
    await pause(signal);
    const layers = classifyEye(eye, work, estimate);
    await pause(signal);
    const area = layers.area;
    const under = await fillSkin(area, layers.hole, signal);
    await pause(signal);
    paintHole(base, area, layers.hole, under);
    const ball = cropLayer(area, (i) => layers.ball[i]!, 3);
    files.set(`built/eye${index}_ball.png`, await encodePng(ball.pixels));
    rects[`eye${index}_ball`] = ball.rect;
    for (const part of ["lash", "low", "crease"] as const) {
      const line = unblendLine(area, under, layers.lines[part].mask, layers.lines[part].ink);
      const cut = cropLayer(line, () => 1, 2);
      files.set(`built/eye${index}_${part}.png`, await encodePng(cut.pixels));
      rects[`eye${index}_${part}`] = cut.rect;
    }
  }

  files.set("built/base.png", await encodePng(base));
  files.set(
    "built/hairmask.png",
    await encodePng(
      { x: 0, y: 0, width: image.width, height: image.height, data: new Uint8Array(image.width * image.height) },
      1,
    ),
  );
  const build = createHash("sha256").update(source.png).update(JSON.stringify(rig)).digest("hex").slice(0, 12);
  const layersJson = {
    version: 1,
    size: [image.width, image.height],
    build,
    layers: rects,
    eyes: rig.eyes.map(({ x0, x1, top, bot }) => ({ x0, x1, top, bot })),
  };
  files.set("built/layers.json", Buffer.from(`${JSON.stringify(layersJson, null, 2)}\n`));
  return { files, rects, build };
}

// ── The archive ──

/** A `.mavatar`: a ZIP with stored (uncompressed) entries, the manifest first. */
export function packMeshAvatar(files: MeshAvatarFiles): Buffer {
  const zip = new AdmZip();
  const names = [...files.keys()].sort((a, b) =>
    a === "avatar.json" ? -1 : b === "avatar.json" ? 1 : a.localeCompare(b),
  );
  for (const name of names) zip.addFile(name, files.get(name)!);
  for (const entry of zip.getEntries()) entry.header.method = 0;
  return zip.toBuffer();
}
