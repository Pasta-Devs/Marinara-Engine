// ──────────────────────────────────────────────
// Avatar generation: blink and talk pictures change only the eyes or the mouth (lane: generation)
// ──────────────────────────────────────────────
// Image models never give a picture back exactly where it went in: they pad it, move it a few pixels or scale
// it a little, add noise, and redraw lines everywhere. Pasting their whole picture back onto a face showed as
// white bars along a bust cut at the canvas bottom and slightly wrong pixels all over. So a blink or talk
// picture is made in two steps, on plain RGBA pixels (no image library, so the regressions can drive it):
//   1. alignAvatarPicture lines the model's picture up with the face it was drawn from, undoing the padding,
//      shift and scale (a search over scale and position on the parts that should not change);
//   2. keepAvatarFaceChange takes only the region that legitimately changed, the eyes for a blink or the mouth
//      for talking, feathered at its edge, and lays it onto the face. Every other pixel, the outline, the
//      clothes and a bust cut at the canvas edge included, stays the face's own, byte for byte, and the
//      face's alpha is kept everywhere. A picture with no clear change, or one that moved or was redrawn too
//      much to line up, is refused with a plain message instead of being saved.
import type { AvatarPngtuberVariant } from "@marinara-engine/shared";

/** Straight (not premultiplied) RGBA pixels, row by row. */
export interface RgbaPixels {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Where the face is expected in the model's picture, in that picture's pixels: the rectangle the whole face
 *  covers. A picture can hold it stretched (another canvas shape) or with uniform scale. */
export interface AvatarPictureFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The part of the face a picture changes. */
export interface AvatarChangeRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The fit search: scale 0.88-1.12 and a shift of up to 12% of the face's size, around each frame. */
const MAX_SCALE_CHANGE = 0.12;
const MAX_SHIFT = 0.12;
/** Luminance differences are capped in the fit, so the eyes or mouth that did change count no more than any
 *  other mismatch. */
const FIT_CAP = 40;
/** A pixel changed when its colour differs this much from every pixel next to it, as a distance in CIE Lab
 *  (CIE76): a change counts as the eye sees it, so a dark mouth on dark skin counts as one on light skin does. */
const CHANGE_THRESHOLD = 10;
/** The strongest group's changes must average this much (Lab) to be a clear change. */
const CLEAR_CHANGE = 12;
/** Changes averaging less than this (Lab) must also be at least MIN_CHANGE_TO_CONTRAST of how much the face
 *  itself varies under them: smaller, they are the picture's compression or redrawing along the face's own lines
 *  and edges, not closed eyes or an open mouth. */
const WEAK_CHANGE = 30;
const MIN_CHANGE_TO_CONTRAST = 0.6;
/** A picture that changed more than this share of the figure outside the eyes or mouth was redrawn. */
const MAX_CHANGED_OUTSIDE = 0.25;
/** A region larger than this share of the figure is not just the eyes or the mouth. */
const MAX_REGION_SHARE = 0.4;

const WHITE = 255;

export class AvatarPictureUnusableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarPictureUnusableError";
  }
}

// ── Luminance and Lab planes ──

/** An sRGB channel value in linear light. */
const LINEAR = Float32Array.from({ length: 256 }, (_, value) => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
/** Lab's cube-root curve, straight near black. */
const labCurve = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

/** CIE Lab (D65) of an RGB plane, three values a pixel. */
function labPlane(rgb: Uint8Array): Float32Array {
  const out = new Float32Array(rgb.length);
  for (let index = 0; index < rgb.length; index += 3) {
    const red = LINEAR[rgb[index]!]!;
    const green = LINEAR[rgb[index + 1]!]!;
    const blue = LINEAR[rgb[index + 2]!]!;
    const fx = labCurve((0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047);
    const fy = labCurve(0.2126 * red + 0.7152 * green + 0.0722 * blue);
    const fz = labCurve((0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883);
    out[index] = 116 * fy - 16;
    out[index + 1] = 500 * (fx - fy);
    out[index + 2] = 200 * (fy - fz);
  }
  return out;
}

/** Luminance of a picture laid on white. A face counts as see-through below half alpha, as the model was
 *  shown it; a model's picture is blended with white by its alpha. */
function lumaOnWhite(image: RgbaPixels, cutAtHalf: boolean): Float32Array {
  const { data, width, height } = image;
  const out = new Float32Array(width * height);
  for (let pixel = 0, index = 0; pixel < out.length; pixel += 1, index += 4) {
    const alpha = data[index + 3]!;
    const luma = 0.299 * data[index]! + 0.587 * data[index + 1]! + 0.114 * data[index + 2]!;
    out[pixel] = cutAtHalf ? (alpha >= 128 ? luma : WHITE) : WHITE + ((luma - WHITE) * alpha) / 255;
  }
  return out;
}

interface Plane {
  values: Float32Array;
  width: number;
  height: number;
  /** One pixel of this plane covers `factor` pixels of the full picture in each direction. */
  factor: number;
}

/** Averages `factor` x `factor` blocks (the last partial row and column are dropped). */
function shrinkPlane(values: Float32Array, width: number, height: number, factor: number): Plane {
  if (factor <= 1) return { values, width, height, factor: 1 };
  const w = Math.max(1, Math.floor(width / factor));
  const h = Math.max(1, Math.floor(height / factor));
  const out = new Float32Array(w * h);
  const area = factor * factor;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        const row = (y * factor + dy) * width + x * factor;
        for (let dx = 0; dx < factor; dx += 1) sum += values[row + dx]!;
      }
      out[y * w + x] = sum / area;
    }
  }
  return { values: out, width: w, height: h, factor };
}

// ── Fitting the model's picture onto the face ──

/** Face pixel (continuous coordinates) to model picture coordinates: the frame, scaled by `scale` around its
 *  middle and moved by `shiftX`, `shiftY` (model picture pixels). */
interface Fit {
  frame: AvatarPictureFrame;
  scale: number;
  shiftX: number;
  shiftY: number;
}

function fitCost(face: Plane, drawn: Plane, faceWidth: number, faceHeight: number, fit: Fit, stride: number): number {
  const { frame, scale } = fit;
  const kx = (frame.width / faceWidth) * scale;
  const ky = (frame.height / faceHeight) * scale;
  const mx = frame.left + frame.width / 2;
  const my = frame.top + frame.height / 2;
  // X = mx + scale * (frame.left + x * frame.width / faceWidth - mx) + shiftX, in drawn-plane pixel centres.
  const bx = (mx + scale * (frame.left - mx) + fit.shiftX) / drawn.factor - 0.5;
  const by = (my + scale * (frame.top - my) + fit.shiftY) / drawn.factor - 0.5;
  const sx = kx / drawn.factor;
  const sy = ky / drawn.factor;
  const { values: dv, width: dw, height: dh } = drawn;
  const fv = face.values;
  let sum = 0;
  let count = 0;
  for (let v = 0; v < face.height; v += stride) {
    const Y = by + (v + 0.5) * face.factor * sy;
    const y0 = Math.floor(Y);
    const fy = Y - y0;
    const rowInside = y0 >= 0 && y0 + 1 < dh;
    for (let u = 0; u < face.width; u += stride) {
      count += 1;
      const X = bx + (u + 0.5) * face.factor * sx;
      const x0 = Math.floor(X);
      if (!rowInside || x0 < 0 || x0 + 1 >= dw) {
        // Past the model's picture counts as white, the padding models add, so a see-through margin costs nothing.
        const uncovered = WHITE - fv[v * face.width + u]!;
        sum += uncovered < FIT_CAP ? uncovered : FIT_CAP;
        continue;
      }
      const fx = X - x0;
      const i = y0 * dw + x0;
      const top = dv[i]! + (dv[i + 1]! - dv[i]!) * fx;
      const bottom = dv[i + dw]! + (dv[i + dw + 1]! - dv[i + dw]!) * fx;
      const difference = Math.abs(top + (bottom - top) * fy - fv[v * face.width + u]!);
      sum += difference < FIT_CAP ? difference : FIT_CAP;
    }
  }
  // A whisker toward no change at all, so a flat picture (every fit alike) stays where it is.
  return (
    sum / Math.max(1, count) +
    0.002 *
      (Math.abs(fit.scale - 1) * 100 + (Math.abs(fit.shiftX) / frame.width + Math.abs(fit.shiftY) / frame.height) * 100)
  );
}

/** Pattern search from `start`: try one step either way on scale and position, keep what's better, halve the
 *  steps when nothing is, until they are small. */
function refineFit(
  cost: (fit: Fit) => number,
  start: Fit,
  scaleStep: number,
  shiftStep: number,
  minScaleStep: number,
  minShiftStep: number,
): { fit: Fit; cost: number } {
  let best = start;
  let bestCost = cost(start);
  const frame = start.frame;
  const clampFit = (fit: Fit): Fit => ({
    frame,
    scale: Math.min(1 + MAX_SCALE_CHANGE, Math.max(1 - MAX_SCALE_CHANGE, fit.scale)),
    shiftX: Math.min(MAX_SHIFT * frame.width, Math.max(-MAX_SHIFT * frame.width, fit.shiftX)),
    shiftY: Math.min(MAX_SHIFT * frame.height, Math.max(-MAX_SHIFT * frame.height, fit.shiftY)),
  });
  for (let round = 0; round < 60 && (scaleStep >= minScaleStep || shiftStep >= minShiftStep); round += 1) {
    let improved = false;
    for (const [ds, dx, dy] of [
      [scaleStep, 0, 0],
      [-scaleStep, 0, 0],
      [0, shiftStep, 0],
      [0, -shiftStep, 0],
      [0, 0, shiftStep],
      [0, 0, -shiftStep],
    ] as const) {
      const candidate = clampFit({ frame, scale: best.scale + ds, shiftX: best.shiftX + dx, shiftY: best.shiftY + dy });
      const candidateCost = cost(candidate);
      if (candidateCost < bestCost - 1e-4) {
        best = candidate;
        bestCost = candidateCost;
        improved = true;
      }
    }
    if (!improved) {
      scaleStep /= 2;
      shiftStep /= 2;
    }
  }
  return { fit: best, cost: bestCost };
}

/**
 * The model's picture lined up with the face, at the face's exact size: each face pixel takes the model's
 * colour at the matching place (laid on white where the model left it see-through) and the face's own alpha.
 * Where the model's picture doesn't reach, the face's own pixel stays. `frames` are where the face may sit in
 * the model's picture (the first is the expected one); the best one is refined by scale and position on the
 * pixels that match, which the eyes or mouth that changed barely affect.
 */
export function alignAvatarPicture(
  face: RgbaPixels,
  drawn: RgbaPixels,
  frames: readonly AvatarPictureFrame[],
): RgbaPixels {
  const { width, height } = face;
  const faceLuma = lumaOnWhite(face, true);
  const drawnLuma = lumaOnWhite(drawn, false);
  const longSide = Math.max(width, height);
  const drawnFactor = (frame: AvatarPictureFrame, faceFactor: number) =>
    Math.max(1, Math.round((faceFactor * frame.width) / width));
  const planes = new Map<number, Plane>();
  const drawnPlane = (factor: number) => {
    let plane = planes.get(factor);
    if (!plane) {
      plane = shrinkPlane(drawnLuma, drawn.width, drawn.height, factor);
      planes.set(factor, plane);
    }
    return plane;
  };

  // Coarse: every frame on a grid of scales and shifts, about 64 pixels across.
  const coarseFactor = Math.max(1, Math.round(longSide / 64));
  const coarseFace = shrinkPlane(faceLuma, width, height, coarseFactor);
  let best: { fit: Fit; cost: number } | null = null;
  for (const frame of frames) {
    const plane = drawnPlane(drawnFactor(frame, coarseFactor));
    const stepX = (coarseFactor * frame.width) / width;
    const stepY = (coarseFactor * frame.height) / height;
    const reachX = Math.floor((MAX_SHIFT * frame.width) / stepX);
    const reachY = Math.floor((MAX_SHIFT * frame.height) / stepY);
    for (let scale = 1 - MAX_SCALE_CHANGE; scale <= 1 + MAX_SCALE_CHANGE + 1e-9; scale += 0.02) {
      for (let ix = -reachX; ix <= reachX; ix += 1) {
        for (let iy = -reachY; iy <= reachY; iy += 1) {
          const fit = { frame, scale, shiftX: ix * stepX, shiftY: iy * stepY };
          const cost = fitCost(coarseFace, plane, width, height, fit, 1);
          if (!best || cost < best.cost) best = { fit, cost };
        }
      }
    }
  }
  if (!best) return { data: new Uint8Array(face.data), width, height };
  const frame = best.fit.frame;

  // Middle (about 192 pixels across), then full size (every second pixel past 256).
  for (const [faceFactor, stride, scaleStep, minScaleStep] of [
    [Math.max(1, Math.round(longSide / 192)), 1, 0.01, 0.002],
    [1, longSide > 256 ? 2 : 1, 0.002, 0.0005],
  ] as const) {
    const facePlane = shrinkPlane(faceLuma, width, height, faceFactor);
    const plane = drawnPlane(drawnFactor(frame, faceFactor));
    const pixel = (faceFactor * frame.width) / width;
    best = refineFit(
      (fit) => fitCost(facePlane, plane, width, height, fit, stride),
      best.fit,
      scaleStep,
      pixel,
      minScaleStep,
      pixel / 4,
    );
  }

  // Draw the face's pixels from the model's picture.
  const { scale, shiftX, shiftY } = best.fit;
  const mx = frame.left + frame.width / 2;
  const my = frame.top + frame.height / 2;
  const kx = (frame.width / width) * scale;
  const ky = (frame.height / height) * scale;
  const bx = mx + scale * (frame.left - mx) + shiftX - 0.5;
  const by = my + scale * (frame.top - my) + shiftY - 0.5;
  const out = new Uint8Array(face.data);
  const dd = drawn.data;
  const dw = drawn.width;
  for (let y = 0; y < height; y += 1) {
    const Y = by + (y + 0.5) * ky;
    const y0 = Math.floor(Y);
    if (y0 < 0 || y0 + 1 >= drawn.height) continue;
    const fy = Y - y0;
    for (let x = 0; x < width; x += 1) {
      const X = bx + (x + 0.5) * kx;
      const x0 = Math.floor(X);
      if (x0 < 0 || x0 + 1 >= dw) continue;
      const fx = X - x0;
      const a = (y0 * dw + x0) * 4;
      const b = a + 4;
      const c = a + dw * 4;
      const d = c + 4;
      const wa = (1 - fx) * (1 - fy);
      const wb = fx * (1 - fy);
      const wc = (1 - fx) * fy;
      const wd = fx * fy;
      // Each corner laid on white by its alpha.
      const aa = dd[a + 3]! / 255;
      const ab = dd[b + 3]! / 255;
      const ac = dd[c + 3]! / 255;
      const ad = dd[d + 3]! / 255;
      const white = WHITE * (wa * (1 - aa) + wb * (1 - ab) + wc * (1 - ac) + wd * (1 - ad));
      const target = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        out[target + channel] = Math.round(
          white +
            wa * aa * dd[a + channel]! +
            wb * ab * dd[b + channel]! +
            wc * ac * dd[c + channel]! +
            wd * ad * dd[d + channel]!,
        );
      }
    }
  }
  return { data: out, width, height };
}

// ── Keeping only the eyes or the mouth ──

/** Grows a mask by `radius` pixels (square neighbourhood), in two separable passes. */
function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const rows = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    let last = -Infinity;
    // Left to right then right to left, tracking the nearest set pixel.
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) last = x;
      if (x - last <= radius) rows[y * width + x] = 1;
    }
    last = Infinity;
    for (let x = width - 1; x >= 0; x -= 1) {
      if (mask[y * width + x]) last = x;
      if (last - x <= radius) rows[y * width + x] = 1;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x += 1) {
    let last = -Infinity;
    for (let y = 0; y < height; y += 1) {
      if (rows[y * width + x]) last = y;
      if (y - last <= radius) out[y * width + x] = 1;
    }
    last = Infinity;
    for (let y = height - 1; y >= 0; y -= 1) {
      if (rows[y * width + x]) last = y;
      if (last - y <= radius) out[y * width + x] = 1;
    }
  }
  return out;
}

/** A mask's complement (0 and 1 swapped). */
function invert(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let pixel = 0; pixel < mask.length; pixel += 1) out[pixel] = mask[pixel] ? 0 : 1;
  return out;
}

/** Shrinks a mask by `radius` pixels: the complement grown. */
function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return invert(dilate(invert(mask), width, height, radius));
}

/** Box blur of a 0/1 mask into weights from 0 to 1, in two separable passes. */
function feather(mask: Uint8Array, width: number, height: number, radius: number): Float32Array {
  const rows = new Float32Array(mask.length);
  const span = 2 * radius + 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sx = Math.min(width - 1, Math.max(0, x + dx));
        sum += mask[y * width + sx]!;
      }
      rows[y * width + x] = sum / span;
    }
  }
  const out = new Float32Array(mask.length);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sy = Math.min(height - 1, Math.max(0, y + dy));
        sum += rows[sy * width + x]!;
      }
      out[y * width + x] = sum / span;
    }
  }
  return out;
}

/** The figure's pixels within `reach` of its outline or of the canvas edge (chessboard distance, two passes). */
function outlineBand(figure: Uint8Array, width: number, height: number, reach: number): Uint8Array {
  const far = reach + 1;
  const distance = new Uint16Array(width * height);
  for (let pixel = 0; pixel < distance.length; pixel += 1) distance[pixel] = figure[pixel] ? far : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : distance[y * width + x]!);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const before = Math.min(at(x - 1, y), at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1));
      if (before + 1 < distance[pixel]!) distance[pixel] = before + 1;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const pixel = y * width + x;
      const after = Math.min(at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1));
      if (after + 1 < distance[pixel]!) distance[pixel] = after + 1;
    }
  }
  const band = new Uint8Array(distance.length);
  for (let pixel = 0; pixel < distance.length; pixel += 1)
    band[pixel] = figure[pixel] && distance[pixel]! <= reach ? 1 : 0;
  return band;
}

interface ChangeCluster {
  count: number;
  strength: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  touchesEdge: boolean;
  /** Sum of (face luminance - picture luminance): above zero where the picture got darker. */
  darkening: number;
  /** Sum of (face detail - picture detail): above zero where the picture lost detail. */
  detailLoss: number;
  /** Sum of how much the face itself varies (Lab) under the changes. */
  contrast: number;
  score: number;
}

const centreX = (cluster: ChangeCluster) => (cluster.left + cluster.right) / 2;
const centreY = (cluster: ChangeCluster) => (cluster.top + cluster.bottom) / 2;
const clusterSize = (cluster: ChangeCluster) =>
  Math.max(cluster.right - cluster.left + 1, cluster.bottom - cluster.top + 1);

function unusable(variant: AvatarPngtuberVariant, what: "nothing" | "moved" | "too-much"): AvatarPictureUnusableError {
  if (what === "nothing") {
    return new AvatarPictureUnusableError(
      variant === "eyes-closed"
        ? "The image model didn't close the eyes in this picture. Try again."
        : "The image model didn't open the mouth in this picture. Try again.",
    );
  }
  return new AvatarPictureUnusableError(
    what === "moved"
      ? "The image model moved or redrew the picture too much to line it up with the face. Try again."
      : `The image model changed more than the ${variant === "eyes-closed" ? "eyes" : "mouth"} in this picture. Try again.`,
  );
}

/**
 * A blink (`eyes-closed`) or talk (`mouth-open`) picture: the face, with only the region where `aligned` (the
 * model's picture lined up by alignAvatarPicture) legitimately changed laid onto it. That region is found
 * from the changes themselves: colour changes that a pixel or two of drift can't explain, grouped, the
 * strongest group chosen, with the other eye next to it for a blink, and a generous ellipse drawn around them.
 * A group touching the canvas edge (padding, bars) is never chosen, and changes along the figure's outline
 * (fringes, halos) neither count nor come through. Inside the ellipse, the changed pixels, and every pixel
 * within each chosen group's own ellipse (so an iris or eye white barely unlike the lid can't show through),
 * are taken from the picture, feathered into the face; everything else is the face's own pixel, byte for byte,
 * and the alpha is the face's everywhere. Throws AvatarPictureUnusableError when there is no clear change, or
 * when the picture changed too much to be an edit of the eyes or mouth.
 */
export function keepAvatarFaceChange(
  face: RgbaPixels,
  aligned: RgbaPixels,
  variant: AvatarPngtuberVariant,
): { picture: RgbaPixels; region: AvatarChangeRegion } {
  const { width, height } = face;
  if (aligned.width !== width || aligned.height !== height) {
    throw new Error("The picture to compare isn't the face's size.");
  }
  const total = width * height;
  const longSide = Math.max(width, height);
  const fd = face.data;
  const ad = aligned.data;
  // Colours on white, as the model saw the face.
  const faceRgb = new Uint8Array(total * 3);
  const drawnRgb = new Uint8Array(total * 3);
  const figure = new Uint8Array(total);
  let figureCount = 0;
  for (let pixel = 0; pixel < total; pixel += 1) {
    const inside = fd[pixel * 4 + 3]! >= 128;
    if (inside) {
      figure[pixel] = 1;
      figureCount += 1;
    }
    for (let channel = 0; channel < 3; channel += 1) {
      faceRgb[pixel * 3 + channel] = inside ? fd[pixel * 4 + channel]! : WHITE;
      drawnRgb[pixel * 3 + channel] = ad[pixel * 4 + channel]!;
    }
  }
  if (!figureCount) throw unusable(variant, "nothing");

  // A change no small drift explains: the face's colour is found nowhere within `reach` of the same place in
  // the picture. A closed eye (the eye is gone) and an open mouth (skin became mouth) both count; a line the
  // model drew a pixel or two to the side does not. How much the face itself varies there (its largest step to
  // a pixel within `reach`) is kept too.
  const reach = Math.max(1, Math.round(longSide / 512));
  const faceLab = labPlane(faceRgb);
  const drawnLab = labPlane(drawnRgb);
  const difference = new Float32Array(total);
  const contrast = new Float32Array(total);
  const squaredDistance = (from: Float32Array, own: number, to: Float32Array, other: number) => {
    const lightness = from[own]! - to[other]!;
    const greenRed = from[own + 1]! - to[other + 1]!;
    const blueYellow = from[own + 2]! - to[other + 2]!;
    return lightness * lightness + greenRed * greenRed + blueYellow * blueYellow;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!figure[pixel]) continue;
      const own = pixel * 3;
      let least = Infinity;
      let most = 0;
      for (let dy = -reach; dy <= reach; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        for (let dx = -reach; dx <= reach; dx += 1) {
          const sx = x + dx;
          if (sx < 0 || sx >= width) continue;
          const other = (sy * width + sx) * 3;
          least = Math.min(least, squaredDistance(faceLab, own, drawnLab, other));
          most = Math.max(most, squaredDistance(faceLab, own, faceLab, other));
        }
      }
      difference[pixel] = Math.sqrt(least);
      contrast[pixel] = Math.sqrt(most);
    }
  }
  // Single pixels and one-pixel lines are noise; what is left are changes.
  const strong = new Uint8Array(total);
  for (let pixel = 0; pixel < total; pixel += 1) strong[pixel] = difference[pixel]! >= CHANGE_THRESHOLD ? 1 : 0;
  const changed = dilate(erode(strong, width, height, 1), width, height, 1);
  for (let pixel = 0; pixel < total; pixel += 1) if (!strong[pixel]) changed[pixel] = 0;

  // Changes close together form one group (an eye, the mouth).
  const join = Math.max(2, Math.round(longSide / 64));
  const grouped = dilate(changed, width, height, join);
  const label = new Int32Array(total).fill(-1);
  const clusters: ChangeCluster[] = [];
  const edge = Math.max(2, Math.round(longSide / 96));
  const outline = outlineBand(figure, width, height, Math.max(4, Math.ceil(longSide / 40)));
  const luma = (rgb: Uint8Array, pixel: number) =>
    0.299 * rgb[pixel * 3]! + 0.587 * rgb[pixel * 3 + 1]! + 0.114 * rgb[pixel * 3 + 2]!;
  const detail = (rgb: Uint8Array, x: number, y: number) => {
    const here = luma(rgb, y * width + x);
    return (
      Math.abs(here - luma(rgb, y * width + Math.min(width - 1, x + 1))) +
      Math.abs(here - luma(rgb, Math.min(height - 1, y + 1) * width + x))
    );
  };
  const stack: number[] = [];
  for (let seed = 0; seed < total; seed += 1) {
    if (!grouped[seed] || label[seed] !== -1) continue;
    const cluster: ChangeCluster = {
      count: 0,
      strength: 0,
      left: width,
      top: height,
      right: -1,
      bottom: -1,
      touchesEdge: false,
      darkening: 0,
      detailLoss: 0,
      contrast: 0,
      score: 0,
    };
    const id = clusters.length;
    label[seed] = id;
    stack.push(seed);
    while (stack.length) {
      const pixel = stack.pop()!;
      const x = pixel % width;
      const y = (pixel - x) / width;
      if (changed[pixel] && (x < edge || y < edge || x >= width - edge || y >= height - edge)) {
        cluster.touchesEdge = true;
      }
      // Changes along the outline (fringes, halos) are no evidence of the eyes or mouth.
      if (changed[pixel] && !outline[pixel]) {
        cluster.count += 1;
        cluster.strength += difference[pixel]!;
        cluster.left = Math.min(cluster.left, x);
        cluster.right = Math.max(cluster.right, x);
        cluster.top = Math.min(cluster.top, y);
        cluster.bottom = Math.max(cluster.bottom, y);
        cluster.darkening += luma(faceRgb, pixel) - luma(drawnRgb, pixel);
        cluster.detailLoss += detail(faceRgb, x, y) - detail(drawnRgb, x, y);
        cluster.contrast += contrast[pixel]!;
      }
      for (let dy = -1; dy <= 1; dy += 1) {
        const sy = y + dy;
        if (sy < 0 || sy >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          const sx = x + dx;
          if (sx < 0 || sx >= width) continue;
          const next = sy * width + sx;
          if (grouped[next] && label[next] === -1) {
            label[next] = id;
            stack.push(next);
          }
        }
      }
    }
    if (cluster.count) clusters.push(cluster);
    else clusters.push({ ...cluster, touchesEdge: true });
  }

  // The eyes lose detail when they close; an open mouth is darker than closed lips. A group that changes the
  // other way still counts, at half weight, since art styles vary. A smaller group (26 pixels on a 512-pixel
  // face) is a scrap of a line the model redrew, not an eye or a mouth.
  const minimumCount = Math.max(10, Math.round((longSide * longSide) / 10_000));
  const candidates = clusters.filter((cluster) => !cluster.touchesEdge && cluster.count >= minimumCount);
  for (const cluster of candidates) {
    const agrees = variant === "eyes-closed" ? cluster.detailLoss > 0 : cluster.darkening > 0;
    cluster.score = cluster.strength * (agrees ? 1 : 0.5);
  }
  candidates.sort((left, right) => right.score - left.score);
  const main = candidates[0];
  if (!main || main.strength / main.count < CLEAR_CHANGE) throw unusable(variant, "nothing");
  if (main.strength / main.count < WEAK_CHANGE && main.strength < MIN_CHANGE_TO_CONTRAST * main.contrast) {
    throw unusable(variant, "nothing");
  }
  const size = clusterSize(main);
  const chosen = [main];
  for (const other of candidates.slice(1)) {
    if (other.score < main.score * 0.3) continue;
    const dx = Math.abs(centreX(other) - centreX(main));
    const dy = Math.abs(centreY(other) - centreY(main));
    // The other eye sits beside the first and is about as big; a mouth can come in pieces right next to each
    // other.
    const beside =
      variant === "eyes-closed"
        ? dx <= 4 * size &&
          dy <= Math.max(main.bottom - main.top + 1, size / 2) &&
          other.count >= main.count * 0.4 &&
          other.count <= main.count * 2.5
        : dx <= size && dy <= size;
    if (beside) chosen.push(other);
  }
  const box = {
    left: Math.min(...chosen.map((cluster) => cluster.left)),
    top: Math.min(...chosen.map((cluster) => cluster.top)),
    right: Math.max(...chosen.map((cluster) => cluster.right)),
    bottom: Math.max(...chosen.map((cluster) => cluster.bottom)),
  };

  // A generous ellipse around the chosen changes: it reaches past the corners of their box, plus a margin.
  const boxWidth = box.right - box.left + 1;
  const boxHeight = box.bottom - box.top + 1;
  const margin = Math.max(join, Math.round(0.2 * Math.max(boxWidth, boxHeight)));
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const radiusX = (boxWidth / 2) * Math.SQRT2 + margin;
  const radiusY = (boxHeight / 2) * Math.SQRT2 + margin;
  if (Math.PI * radiusX * radiusY > MAX_REGION_SHARE * figureCount) throw unusable(variant, "too-much");
  const soft = Math.max(2, Math.round(longSide / 128));
  const ellipse = (x: number, y: number) => Math.hypot((x - cx) / radiusX, (y - cy) / radiusY);

  let changedOutside = 0;
  const kept = new Uint8Array(total);
  const nearChosen = (x: number, y: number) =>
    x >= box.left - join && x <= box.right + join && y >= box.top - join && y <= box.bottom + join;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!changed[pixel]) continue;
      if (ellipse(x, y) > 1) changedOutside += 1;
      else if (!outline[pixel] || nearChosen(x, y)) kept[pixel] = 1;
    }
  }
  if (changedOutside > MAX_CHANGED_OUTSIDE * figureCount) throw unusable(variant, "moved");
  // Each chosen group's own ellipse, through the corners of its box: everything in it comes from the picture
  // too, so what changed only a little inside an eye or the mouth (an iris, eye whites, teeth) can't show the
  // face's own through.
  const inOwnEllipse = (cluster: ChangeCluster, x: number, y: number) =>
    Math.hypot(
      (x - centreX(cluster)) / ((cluster.right - cluster.left + 1) / Math.SQRT2 + soft),
      (y - centreY(cluster)) / ((cluster.bottom - cluster.top + 1) / Math.SQRT2 + soft),
    ) <= 1;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (!figure[pixel] || outline[pixel] || kept[pixel]) continue;
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (chosen.some((cluster) => inOwnEllipse(cluster, x, y))) kept[pixel] = 1;
  }

  // The kept pixels inside the ellipse, grown and feathered, fading out at the ellipse's edge.
  const weights = feather(dilate(kept, width, height, soft), width, height, soft);
  const fade = (2 * soft) / Math.min(radiusX, radiusY);
  const out = new Uint8Array(fd);
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const inEllipse = ellipse(x, y);
      if (inEllipse >= 1 + fade || fd[pixel * 4 + 3] === 0) continue;
      const weight = Math.min(1, weights[pixel]!) * Math.min(1, Math.max(0, (1 + fade - inEllipse) / fade));
      if (weight <= 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        const index = pixel * 4 + channel;
        out[index] = Math.round(fd[index]! + (ad[index]! - fd[index]!) * weight);
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    picture: { data: out, width, height },
    region:
      right < 0
        ? { left: 0, top: 0, width: 0, height: 0 }
        : { left, top, width: right - left + 1, height: bottom - top + 1 },
  };
}
