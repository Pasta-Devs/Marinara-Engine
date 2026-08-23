// ──────────────────────────────────────────────
// Sprite background contracts and matte cleanup
// ──────────────────────────────────────────────
import { clampByte, clampUnit, getSharp, type RgbColor } from "./sharp-runtime.js";

export type SpriteChromaMatte = {
  id: "green" | "magenta" | "cyan";
  label: string;
  hex: string;
  rgb: RgbColor;
};

const SPRITE_CHROMA_MATTES: Array<SpriteChromaMatte & { conflictingColors: RegExp }> = [
  {
    id: "green",
    label: "chroma green",
    hex: "#00FF00",
    rgb: { red: 0, green: 255, blue: 0 },
    conflictingColors: /\b(?:green|lime|emerald|olive|mint|chartreuse|teal|turquoise)\b/giu,
  },
  {
    id: "magenta",
    label: "chroma magenta",
    hex: "#FF00FF",
    rgb: { red: 255, green: 0, blue: 255 },
    conflictingColors: /\b(?:pink|magenta|fuchsia|purple|violet|lavender|rose|mauve)\b/giu,
  },
  {
    id: "cyan",
    label: "chroma cyan",
    hex: "#00FFFF",
    rgb: { red: 0, green: 255, blue: 255 },
    conflictingColors: /\b(?:blue|cyan|aqua|turquoise|teal|navy|azure|cobalt|indigo)\b/giu,
  },
];

function countColorConflicts(input: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return Array.from(input.matchAll(pattern)).length;
}

/** Pick a saturated matte that is least likely to overlap the described subject. */
export function selectSpriteChromaMatte(appearance: string): SpriteChromaMatte {
  const normalized = appearance.toLowerCase();
  let selected = SPRITE_CHROMA_MATTES[0]!;
  let selectedConflicts = countColorConflicts(normalized, selected.conflictingColors);

  for (const candidate of SPRITE_CHROMA_MATTES.slice(1)) {
    const conflicts = countColorConflicts(normalized, candidate.conflictingColors);
    if (conflicts < selectedConflicts) {
      selected = candidate;
      selectedConflicts = conflicts;
    }
  }

  const { conflictingColors: _conflictingColors, ...matte } = selected;
  return matte;
}

export function spriteChromaMatteInstruction(matte: SpriteChromaMatte): string {
  return [
    `use one perfectly flat, uniform ${matte.label} ${matte.hex} background across the entire canvas and every sheet gutter`,
    `this must be a real solid-color backdrop, never a painted transparency checkerboard or fake alpha preview`,
    `no white background, off-white background, gray background, checkerboard pattern, transparency grid, scenery, floor line, texture, gradient, glow, lighting variation, cast shadow, contact shadow, grid border, panel border, or separator line`,
    `keep the character fully separated from the canvas edges and do not reflect or spill the background color onto the character`,
  ].join(", ");
}

export function applySpriteBackgroundInstruction(
  prompt: string,
  options: { matte: SpriteChromaMatte; nativeTransparentPng: boolean; removeBackground: boolean },
): string {
  if (!options.nativeTransparentPng && !options.removeBackground) return prompt;

  const chromaFallback = spriteChromaMatteInstruction(options.matte);
  const replacement = options.nativeTransparentPng
    ? `no background, transparent PNG format. If native transparency is unsupported, ${chromaFallback}`
    : chromaFallback;
  const updated = prompt.replace(
    /\b(?:(?:solid|plain) white(?: studio)? background|white studio background|white background)\b/giu,
    () => replacement,
  );

  if (updated !== prompt) return updated;
  return `${updated}, ${replacement}`;
}

export function spriteBackgroundContract(options: {
  matte: SpriteChromaMatte;
  nativeTransparentPng: boolean;
  removeBackground: boolean;
}): string {
  if (!options.nativeTransparentPng && !options.removeBackground) return "";
  const matteInstruction = spriteChromaMatteInstruction(options.matte);
  return options.nativeTransparentPng
    ? `MANDATORY BACKGROUND CONTRACT: output native transparency with no backdrop. If the provider cannot return alpha transparency, ${matteInstruction}.`
    : `MANDATORY BACKGROUND CONTRACT: ${matteInstruction}.`;
}

function rgbDistance(a: RgbColor, b: RgbColor): number {
  return Math.hypot(a.red - b.red, a.green - b.green, a.blue - b.blue);
}

function medianNumber(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? fallback;
}

function percentile(values: number[], ratio: number, fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index] ?? fallback;
}

type MatteAnalysis = {
  color: RgbColor;
  confidence: number;
  variation: number;
  alreadyTransparent: boolean;
};

function analyzeBorderMatte(rgba: Buffer, width: number, height: number, channels: number): MatteAnalysis {
  const pixelCount = width * height;
  let transparentPixels = 0;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if ((rgba[pixelIndex * channels + 3] ?? 255) < 245) transparentPixels += 1;
  }
  let transparentBorderPixels = 0;
  let borderPixels = 0;
  const countBorderAlpha = (pixelIndex: number) => {
    borderPixels += 1;
    if ((rgba[pixelIndex * channels + 3] ?? 255) < 245) transparentBorderPixels += 1;
  };
  for (let xPos = 0; xPos < width; xPos++) {
    countBorderAlpha(xPos);
    if (height > 1) countBorderAlpha((height - 1) * width + xPos);
  }
  for (let yPos = 1; yPos < height - 1; yPos++) {
    countBorderAlpha(yPos * width);
    if (width > 1) countBorderAlpha(yPos * width + width - 1);
  }
  const transparentRatio = transparentPixels / Math.max(1, pixelCount);
  const transparentBorderRatio = transparentBorderPixels / Math.max(1, borderPixels);
  const alreadyTransparent =
    transparentRatio >= 0.1 ||
    (transparentPixels >= Math.max(8, pixelCount * 0.0025) && transparentBorderRatio >= 0.02);

  const samples: RgbColor[] = [];
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 256));
  const samplePixel = (pixelIndex: number) => {
    const offset = pixelIndex * channels;
    if ((rgba[offset + 3] ?? 255) <= 32) return;
    samples.push({
      red: rgba[offset] ?? 0,
      green: rgba[offset + 1] ?? 0,
      blue: rgba[offset + 2] ?? 0,
    });
  };

  for (let xPos = 0; xPos < width; xPos += sampleStep) {
    samplePixel(xPos);
    samplePixel((height - 1) * width + xPos);
  }
  for (let yPos = sampleStep; yPos < height - sampleStep; yPos += sampleStep) {
    samplePixel(yPos * width);
    samplePixel(yPos * width + width - 1);
  }

  if (samples.length === 0) {
    return {
      color: { red: 255, green: 255, blue: 255 },
      confidence: alreadyTransparent ? 1 : 0,
      variation: 0,
      alreadyTransparent,
    };
  }

  const buckets = new Map<string, RgbColor[]>();
  const bucketSize = 24;
  for (const sample of samples) {
    const key = `${Math.floor(sample.red / bucketSize)}:${Math.floor(sample.green / bucketSize)}:${Math.floor(sample.blue / bucketSize)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(sample);
    else buckets.set(key, [sample]);
  }

  const dominant = [...buckets.values()].sort((left, right) => right.length - left.length)[0] ?? samples;
  const seed = {
    red: medianNumber(
      dominant.map((sample) => sample.red),
      255,
    ),
    green: medianNumber(
      dominant.map((sample) => sample.green),
      255,
    ),
    blue: medianNumber(
      dominant.map((sample) => sample.blue),
      255,
    ),
  };
  const seedNeighbors = samples.filter((sample) => rgbDistance(sample, seed) <= 56);
  const color = {
    red: medianNumber(
      seedNeighbors.map((sample) => sample.red),
      seed.red,
    ),
    green: medianNumber(
      seedNeighbors.map((sample) => sample.green),
      seed.green,
    ),
    blue: medianNumber(
      seedNeighbors.map((sample) => sample.blue),
      seed.blue,
    ),
  };
  const distances = samples.map((sample) => rgbDistance(sample, color));
  const variation = percentile(
    seedNeighbors.map((sample) => rgbDistance(sample, color)),
    0.9,
    0,
  );
  const coverageCutoff = Math.max(28, variation * 1.8 + 12);
  const coverage = distances.filter((distance) => distance <= coverageCutoff).length / samples.length;
  const confidence = clampUnit((coverage - 0.18) / 0.7);

  return { color, confidence, variation, alreadyTransparent };
}

export type SpriteMatteCleanupResult = {
  buffer: Buffer;
  confidence: number;
  matteColor: RgbColor;
  alreadyTransparent: boolean;
};

/**
 * Remove a flat border-connected matte of any color, including old white
 * sprites. A soft alpha transition and foreground-neighbor despill keep the
 * original matte from surviving as a pale or colored fringe.
 */
export async function removeUniformSpriteBackgroundPng(
  input: Buffer,
  cleanupStrength = 35,
): Promise<SpriteMatteCleanupResult> {
  const sharp = await getSharp();
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    return {
      buffer: await sharp(input).png().toBuffer(),
      confidence: 0,
      matteColor: { red: 255, green: 255, blue: 255 },
      alreadyTransparent: false,
    };
  }

  const rgba = Buffer.from(data);
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const pixelCount = width * height;
  const analysis = analyzeBorderMatte(rgba, width, height, channels);
  if (analysis.alreadyTransparent) {
    return {
      buffer: await sharp(rgba, { raw: { width, height, channels } }).png().toBuffer(),
      confidence: 1,
      matteColor: analysis.color,
      alreadyTransparent: true,
    };
  }

  const strength = Math.max(0, Math.min(100, cleanupStrength));
  const hardCutoff = Math.max(12, Math.min(48, 12 + analysis.variation * 1.4 + strength * 0.12));
  const softCutoff = hardCutoff + 30 + strength * 0.28;
  const haloCutoff = softCutoff + 24 + strength * 0.12;
  const matteMask = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const pixelOffset = (pixelIndex: number) => pixelIndex * channels;
  const readPixel = (pixelIndex: number): RgbColor => {
    const offset = pixelOffset(pixelIndex);
    return {
      red: rgba[offset] ?? 0,
      green: rgba[offset + 1] ?? 0,
      blue: rgba[offset + 2] ?? 0,
    };
  };
  const matteDistance = (pixelIndex: number) => rgbDistance(readPixel(pixelIndex), analysis.color);
  const isMatteCandidate = (pixelIndex: number, cutoff = softCutoff) => {
    const offset = pixelOffset(pixelIndex);
    if ((rgba[offset + 3] ?? 255) <= 4) return true;
    return matteDistance(pixelIndex) <= cutoff;
  };
  const enqueueMatte = (pixelIndex: number) => {
    if (matteMask[pixelIndex] || !isMatteCandidate(pixelIndex)) return;
    matteMask[pixelIndex] = 1;
    queue[queueEnd++] = pixelIndex;
  };

  for (let xPos = 0; xPos < width; xPos++) {
    enqueueMatte(xPos);
    enqueueMatte((height - 1) * width + xPos);
  }
  for (let yPos = 0; yPos < height; yPos++) {
    enqueueMatte(yPos * width);
    enqueueMatte(yPos * width + width - 1);
  }

  // A chroma backdrop can be completely enclosed by the subject — for
  // example, the negative space between an arm and the torso. Border-only
  // flood filling leaves those pockets behind. The selected matte is a
  // saturated color chosen to avoid the character, so exact interior chroma
  // pixels are safe additional flood-fill seeds. Keep neutral/white legacy
  // mattes border-connected so pale costume details remain intact.
  const matteChannels = [analysis.color.red, analysis.color.green, analysis.color.blue];
  const matteSaturation = Math.max(...matteChannels) - Math.min(...matteChannels);
  const matteHighChannels = matteChannels
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => channel >= Math.max(...matteChannels) - 48)
    .map(({ index }) => index);
  const matteLowChannels = matteChannels
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => channel <= Math.min(...matteChannels) + 48)
    .map(({ index }) => index);
  const chromaDominance = (color: RgbColor) => {
    const channels = [color.red, color.green, color.blue];
    const high = Math.min(...matteHighChannels.map((index) => channels[index] ?? 0));
    const low =
      matteLowChannels.reduce((sum, index) => sum + (channels[index] ?? 0), 0) / Math.max(1, matteLowChannels.length);
    return high - low;
  };
  const matteChromaDominance = chromaDominance(analysis.color);
  if (matteSaturation >= 120) {
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
      if (matteMask[pixelIndex] || matteDistance(pixelIndex) > hardCutoff) continue;
      matteMask[pixelIndex] = 1;
      queue[queueEnd++] = pixelIndex;
    }
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart++]!;
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    if (xPos > 0) enqueueMatte(pixelIndex - 1);
    if (xPos < width - 1) enqueueMatte(pixelIndex + 1);
    if (yPos > 0) enqueueMatte(pixelIndex - width);
    if (yPos < height - 1) enqueueMatte(pixelIndex + width);
  }

  const chromaCleanupRadius = matteSaturation >= 120 ? 16 : 0;
  const matteProximity = new Uint8Array(pixelCount);
  if (chromaCleanupRadius > 0) {
    const proximityQueue = new Int32Array(pixelCount);
    let proximityStart = 0;
    let proximityEnd = 0;
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
      if (!matteMask[pixelIndex]) continue;
      matteProximity[pixelIndex] = 1;
      proximityQueue[proximityEnd++] = pixelIndex;
    }

    while (proximityStart < proximityEnd) {
      const pixelIndex = proximityQueue[proximityStart++]!;
      const distance = matteProximity[pixelIndex] ?? 0;
      if (distance > chromaCleanupRadius) continue;
      const xPos = pixelIndex % width;
      const yPos = Math.floor(pixelIndex / width);
      for (let yOffset = -1; yOffset <= 1; yOffset++) {
        const sampleY = yPos + yOffset;
        if (sampleY < 0 || sampleY >= height) continue;
        for (let xOffset = -1; xOffset <= 1; xOffset++) {
          if (xOffset === 0 && yOffset === 0) continue;
          const sampleX = xPos + xOffset;
          if (sampleX < 0 || sampleX >= width) continue;
          const sampleIndex = sampleY * width + sampleX;
          if (matteProximity[sampleIndex]) continue;
          matteProximity[sampleIndex] = distance + 1;
          proximityQueue[proximityEnd++] = sampleIndex;
        }
      }
    }
  }

  const findForegroundNeighborColor = (pixelIndex: number) => {
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    const samples: Array<RgbColor & { distance: number; weight: number }> = [];

    for (let radius = 1; radius <= 6; radius++) {
      for (let yOffset = -radius; yOffset <= radius; yOffset++) {
        const sampleY = yPos + yOffset;
        if (sampleY < 0 || sampleY >= height) continue;
        for (let xOffset = -radius; xOffset <= radius; xOffset++) {
          if (Math.max(Math.abs(xOffset), Math.abs(yOffset)) !== radius) continue;
          const sampleX = xPos + xOffset;
          if (sampleX < 0 || sampleX >= width) continue;
          const sampleIndex = sampleY * width + sampleX;
          if (matteMask[sampleIndex]) continue;
          const sampleOffset = pixelOffset(sampleIndex);
          const alpha = rgba[sampleOffset + 3] ?? 255;
          if (alpha <= 32) continue;
          const weight = alpha / 255 / Math.max(1, Math.hypot(xOffset, yOffset));
          samples.push({
            red: rgba[sampleOffset] ?? 0,
            green: rgba[sampleOffset + 1] ?? 0,
            blue: rgba[sampleOffset + 2] ?? 0,
            distance: matteDistance(sampleIndex),
            weight,
          });
        }
      }
    }

    const maxDistance = samples.reduce((maximum, sample) => Math.max(maximum, sample.distance), 0);
    const foregroundSamples = samples.filter((sample) => sample.distance >= maxDistance - 28);
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let weightTotal = 0;
    for (const sample of foregroundSamples) {
      redTotal += sample.red * sample.weight;
      greenTotal += sample.green * sample.weight;
      blueTotal += sample.blue * sample.weight;
      weightTotal += sample.weight;
    }
    if (weightTotal === 0) return null;
    return {
      red: redTotal / weightTotal,
      green: greenTotal / weightTotal,
      blue: blueTotal / weightTotal,
    };
  };

  const findNearestForegroundDistance = (pixelIndex: number) => {
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    for (let radius = 1; radius <= 6; radius++) {
      for (let yOffset = -radius; yOffset <= radius; yOffset++) {
        const sampleY = yPos + yOffset;
        if (sampleY < 0 || sampleY >= height) continue;
        for (let xOffset = -radius; xOffset <= radius; xOffset++) {
          if (Math.max(Math.abs(xOffset), Math.abs(yOffset)) !== radius) continue;
          const sampleX = xPos + xOffset;
          if (sampleX < 0 || sampleX >= width) continue;
          const sampleIndex = sampleY * width + sampleX;
          if (matteMask[sampleIndex]) continue;
          const sampleOffset = pixelOffset(sampleIndex);
          if ((rgba[sampleOffset + 3] ?? 255) <= 32) continue;
          const sampleColor = readPixel(sampleIndex);
          if (matteDistance(sampleIndex) <= haloCutoff || chromaDominance(sampleColor) > 8) continue;
          return radius;
        }
      }
    }
    return null;
  };

  const despillPixel = (pixelIndex: number, matteWeight: number) => {
    if (matteWeight <= 0) return;
    const offset = pixelOffset(pixelIndex);
    const neighbor = findForegroundNeighborColor(pixelIndex);
    if (neighbor) {
      const blend = clampUnit(matteWeight * (0.72 + strength / 500));
      rgba[offset] = clampByte((rgba[offset] ?? 0) * (1 - blend) + neighbor.red * blend);
      rgba[offset + 1] = clampByte((rgba[offset + 1] ?? 0) * (1 - blend) + neighbor.green * blend);
      rgba[offset + 2] = clampByte((rgba[offset + 2] ?? 0) * (1 - blend) + neighbor.blue * blend);
      return;
    }

    const foregroundWeight = Math.max(0.14, 1 - matteWeight);
    const removableMatte = Math.min(0.86, matteWeight);
    rgba[offset] = clampByte(((rgba[offset] ?? 0) - analysis.color.red * removableMatte) / foregroundWeight);
    rgba[offset + 1] = clampByte(((rgba[offset + 1] ?? 0) - analysis.color.green * removableMatte) / foregroundWeight);
    rgba[offset + 2] = clampByte(((rgba[offset + 2] ?? 0) - analysis.color.blue * removableMatte) / foregroundWeight);
  };

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (!matteMask[pixelIndex]) continue;
    const offset = pixelOffset(pixelIndex);
    const originalAlpha = rgba[offset + 3] ?? 255;
    const distance = matteDistance(pixelIndex);
    const edgeCoverage = clampUnit((distance - hardCutoff) / Math.max(1, softCutoff - hardCutoff));
    const softenedCoverage = edgeCoverage * edgeCoverage * (3 - 2 * edgeCoverage);
    const outputAlpha = clampByte(originalAlpha * softenedCoverage);
    rgba[offset + 3] = outputAlpha;
    if (outputAlpha > 4) despillPixel(pixelIndex, 1 - softenedCoverage);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
    if (matteMask[pixelIndex]) continue;
    if (matteSaturation >= 120 && !matteProximity[pixelIndex]) continue;
    const xPos = pixelIndex % width;
    const yPos = Math.floor(pixelIndex / width);
    let matteNeighbors = 0;
    const matteNeighborRadius = 3;
    for (let yOffset = -matteNeighborRadius; yOffset <= matteNeighborRadius; yOffset++) {
      const sampleY = yPos + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;
      for (let xOffset = -matteNeighborRadius; xOffset <= matteNeighborRadius; xOffset++) {
        if (xOffset === 0 && yOffset === 0) continue;
        const sampleX = xPos + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;
        if (matteMask[sampleY * width + sampleX]) matteNeighbors += 1;
      }
    }

    const distance = matteDistance(pixelIndex);
    const offset = pixelOffset(pixelIndex);
    const originalAlpha = rgba[offset + 3] ?? 255;
    let foreground: RgbColor | null = null;
    if (matteSaturation >= 120) {
      const observed = readPixel(pixelIndex);
      const observedDominance = chromaDominance(observed);
      const nearestForegroundDistance = observedDominance > 8 ? findNearestForegroundDistance(pixelIndex) : null;
      if (nearestForegroundDistance !== null) foreground = findForegroundNeighborColor(pixelIndex);
      const foregroundDominance = foreground ? chromaDominance(foreground) : 0;
      const hasChromaSpill = observedDominance > Math.max(8, foregroundDominance + 6);

      if (hasChromaSpill) {
        if (matteNeighbors === 0 && (nearestForegroundDistance === null || nearestForegroundDistance > 2)) {
          rgba[offset + 3] = 0;
          continue;
        }
        const foregroundCoverage = clampUnit(
          (matteChromaDominance - observedDominance) / Math.max(1, matteChromaDominance - foregroundDominance),
        );
        const matteContact = clampUnit(matteNeighbors / 40);

        if (matteContact >= 0.85) {
          rgba[offset + 3] = 0;
        } else if (foreground && foregroundDominance < observedDominance - 6) {
          if (foregroundCoverage <= 0.02) {
            rgba[offset + 3] = 0;
          } else {
            const matteWeight = 1 - foregroundCoverage;
            rgba[offset] = clampByte((observed.red - analysis.color.red * matteWeight) / foregroundCoverage);
            rgba[offset + 1] = clampByte((observed.green - analysis.color.green * matteWeight) / foregroundCoverage);
            rgba[offset + 2] = clampByte((observed.blue - analysis.color.blue * matteWeight) / foregroundCoverage);
            rgba[offset + 3] = clampByte(originalAlpha * foregroundCoverage);
          }
        } else {
          rgba[offset + 3] = 0;
        }
        continue;
      }
    }

    if (matteNeighbors === 0) continue;
    foreground ??= findForegroundNeighborColor(pixelIndex);
    if (foreground) {
      const observed = readPixel(pixelIndex);
      const foregroundVector = {
        red: foreground.red - analysis.color.red,
        green: foreground.green - analysis.color.green,
        blue: foreground.blue - analysis.color.blue,
      };
      const observedVector = {
        red: observed.red - analysis.color.red,
        green: observed.green - analysis.color.green,
        blue: observed.blue - analysis.color.blue,
      };
      const denominator = foregroundVector.red ** 2 + foregroundVector.green ** 2 + foregroundVector.blue ** 2;
      if (denominator > 256) {
        const foregroundCoverage = clampUnit(
          (observedVector.red * foregroundVector.red +
            observedVector.green * foregroundVector.green +
            observedVector.blue * foregroundVector.blue) /
            denominator,
        );
        const reconstructed = {
          red: analysis.color.red + foregroundVector.red * foregroundCoverage,
          green: analysis.color.green + foregroundVector.green * foregroundCoverage,
          blue: analysis.color.blue + foregroundVector.blue * foregroundCoverage,
        };
        const residual = rgbDistance(observed, reconstructed);
        if (foregroundCoverage < 0.995 && residual <= 38 + strength * 0.18) {
          rgba[offset] = clampByte(foreground.red);
          rgba[offset + 1] = clampByte(foreground.green);
          rgba[offset + 2] = clampByte(foreground.blue);
          rgba[offset + 3] = clampByte(originalAlpha * foregroundCoverage);
          continue;
        }
      }
    }

    if (distance > haloCutoff) continue;
    const similarity = 1 - clampUnit((distance - softCutoff) / Math.max(1, haloCutoff - softCutoff));
    const cleanupWeight = similarity * clampUnit(matteNeighbors / 5) * (0.28 + strength / 260);
    despillPixel(pixelIndex, cleanupWeight);
    rgba[offset + 3] = clampByte(originalAlpha * (1 - cleanupWeight * 0.28));
  }

  if (matteSaturation >= 120) {
    const residualDominanceFloor = 2;
    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
      if (!matteProximity[pixelIndex]) continue;
      const offset = pixelOffset(pixelIndex);
      const originalAlpha = rgba[offset + 3] ?? 255;
      if (originalAlpha <= 4) continue;

      const color = readPixel(pixelIndex);
      const residualDominance = chromaDominance(color);
      if (residualDominance <= residualDominanceFloor) continue;

      const spillAmount = residualDominance - residualDominanceFloor;
      const channels = [color.red, color.green, color.blue];
      for (const channelIndex of matteHighChannels) {
        channels[channelIndex] = clampByte((channels[channelIndex] ?? 0) - spillAmount);
      }
      rgba[offset] = channels[0] ?? 0;
      rgba[offset + 1] = channels[1] ?? 0;
      rgba[offset + 2] = channels[2] ?? 0;

      const matteFraction = clampUnit(spillAmount / Math.max(1, matteChromaDominance - residualDominanceFloor));
      rgba[offset + 3] = clampByte(originalAlpha * (1 - matteFraction));
    }
  }

  return {
    buffer: await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
    confidence: analysis.confidence,
    matteColor: analysis.color,
    alreadyTransparent: false,
  };
}
