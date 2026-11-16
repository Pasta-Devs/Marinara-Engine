// ──────────────────────────────────────────────
// Sticker and emoji sheets from the gallery's "Create with AI": cut a generated
// grid into one picture per cell, trimmed to what was drawn and sized for its
// kind (emoji 256px, sticker 512px), so each saves as its own gallery item.
// ──────────────────────────────────────────────

export type GallerySheetKind = "sticker" | "emoji";

/** Longest side a saved emoji / sticker may have (the gallery label refuses bigger ones). */
export const GALLERY_SHEET_MAX_SIDE: Record<GallerySheetKind, number> = { emoji: 256, sticker: 512 };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded"));
    image.src = src;
  });
}

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  return { canvas, ctx };
}

type Bounds = { left: number; top: number; right: number; bottom: number };

/**
 * What was drawn on a cell: the box around every pixel that is not see-through and does not match the
 * cell's background, read from its four corners (so a flat white or green backdrop is skipped too).
 */
function drawnBounds(image: HTMLImageElement): Bounds {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const { ctx } = canvas2d(width, height);
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const opaqueCorners = corners.filter((offset) => pixels[offset + 3]! > 24);
  const background =
    opaqueCorners.length >= 2
      ? [0, 1, 2].map((channel) => {
          const values = opaqueCorners.map((offset) => pixels[offset + channel]!).sort((a, b) => a - b);
          return values[Math.floor(values.length / 2)]!;
        })
      : null;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = at(x, y);
      if (pixels[offset + 3]! <= 24) continue;
      if (background) {
        const distance =
          Math.abs(pixels[offset]! - background[0]!) +
          Math.abs(pixels[offset + 1]! - background[1]!) +
          Math.abs(pixels[offset + 2]! - background[2]!);
        if (distance < 48) continue;
      }
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return { left: 0, top: 0, right: width, bottom: height };
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

/** Draw the trimmed art on a square `side` source pixels wide, scaled down to the kind's size. */
function drawOnSquare(
  image: HTMLImageElement,
  bounds: Bounds,
  side: number,
  kind: GallerySheetKind,
  place: "centre" | "baseline",
): string {
  const contentWidth = bounds.right - bounds.left;
  const contentHeight = bounds.bottom - bounds.top;
  const outSide = Math.min(GALLERY_SHEET_MAX_SIDE[kind], side);
  const scale = outSide / side;
  const { canvas, ctx } = canvas2d(outSide, outSide);
  ctx.imageSmoothingQuality = "high";
  const drawWidth = contentWidth * scale;
  const drawHeight = contentHeight * scale;
  // The baseline sits as far above the bottom as the margin around the set's biggest piece.
  // Whole-pixel placement: at full size the art is copied pixel for pixel, so fitting a piece that was
  // fitted before gives back the same picture instead of softening it a little more each time.
  const top = Math.round(place === "baseline" ? outSide * (1 - 0.04 / 1.08) - drawHeight : (outSide - drawHeight) / 2);
  const left = Math.round((outSide - drawWidth) / 2);
  ctx.drawImage(image, bounds.left, bounds.top, contentWidth, contentHeight, left, top, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
}

/**
 * Trim a cell to what was drawn on it, then centre it on a square with a small margin and scale it
 * down to the kind's size.
 */
export async function fitGallerySheetCell(
  dataUrl: string,
  kind: GallerySheetKind,
  options: { trim?: boolean } = {},
): Promise<string> {
  const image = await loadImage(dataUrl);
  const bounds =
    options.trim === false
      ? { left: 0, top: 0, right: image.naturalWidth, bottom: image.naturalHeight }
      : drawnBounds(image);
  const side = Math.ceil(Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) * 1.08);
  return drawOnSquare(image, bounds, side, kind, "centre");
}

/**
 * Fit every piece of one sheet. Emoji each fill their own square. Stickers share one scale and stand on
 * one baseline, centred side to side: a short sticker stays short, and a set lines up in a row and in
 * chat instead of each floating at whatever height its own shape gives it.
 */
export async function fitGallerySheetSet(dataUrls: string[], kind: GallerySheetKind): Promise<string[]> {
  if (kind !== "sticker") return Promise.all(dataUrls.map((dataUrl) => fitGallerySheetCell(dataUrl, kind)));
  const images = await Promise.all(dataUrls.map(loadImage));
  const bounds = images.map(drawnBounds);
  const sizes = bounds.map((b) => Math.max(b.right - b.left, b.bottom - b.top));
  const sorted = [...sizes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1;
  // One oversized piece (two stickers cut as one) shouldn't shrink the whole set: the shared square fits
  // the set up to a third over its typical size, and anything bigger is scaled down on its own to fit.
  const shared = Math.max(1, Math.min(Math.max(...sizes), median * 1.35));
  return images.map((image, index) =>
    drawOnSquare(image, bounds[index]!, Math.ceil(Math.max(shared, sizes[index]!) * 1.08), kind, "baseline"),
  );
}

/**
 * The outline pass after keying: within a thin band inside every cut edge (where a sticker's white outline
 * sits), green-screen spill and stray specks are painted over with the colour around them, see-through
 * pinholes are filled, and the soft edge loses its green tint. The art further in is left alone, so a green
 * sticker keeps its own green.
 */
function cleanGallerySheetOutlines(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  background: number[],
): void {
  const total = width * height;
  const band = Math.max(4, Math.round(Math.max(width, height) * 0.02));
  // Distance (in steps) from the nearest see-through pixel, up to the band.
  const distance = new Uint16Array(total).fill(65535);
  let frontier: number[] = [];
  for (let i = 0; i < total; i++) {
    if (pixels[i * 4 + 3]! <= 24) {
      distance[i] = 0;
      frontier.push(i);
    }
  }
  for (let step = 1; step <= band && frontier.length; step++) {
    const next: number[] = [];
    for (const index of frontier) {
      const x = index % width;
      for (const n of [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index >= width ? index - width : -1,
        index < total - width ? index + width : -1,
      ]) {
        if (n >= 0 && distance[n] === 65535) {
          distance[n] = step;
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  // Spill toward the key colour: how far its strongest channel stands above the other two.
  const keyChannel = background.indexOf(Math.max(...background));
  const others = [0, 1, 2].filter((channel) => channel !== keyChannel);
  const keySaturated = background[keyChannel]! - Math.max(...others.map((channel) => background[channel]!)) > 80;
  const spill = (offset: number) =>
    keySaturated
      ? pixels[offset + keyChannel]! - Math.max(pixels[offset + others[0]!]!, pixels[offset + others[1]!]!)
      : 0;

  // Small green bits in the band (a tinted hair tip, a fleck on a dark outline) are spill, however dark;
  // a big green area there is the sticker's own green and stays.
  const greenish = new Uint8Array(total);
  if (keySaturated) {
    for (let i = 0; i < total; i++) {
      const d = distance[i]!;
      if (d > 0 && d <= band && spill(i * 4) > 50) greenish[i] = 1;
    }
  }
  const greenBits = labelMask(greenish, width, height);
  const smallBit = new Uint8Array(greenBits.regions.length + 1);
  for (const region of greenBits.regions) smallBit[region.id] = region.area < total * 0.0005 ? 1 : 0;

  const source = new Uint8ClampedArray(pixels);
  const radius = 2;
  const sample: number[][] = [[], [], [], []];
  for (let index = 0; index < total; index++) {
    const d = distance[index]!;
    if (d === 0 || d > band) continue;
    const offset = index * 4;
    const x = index % width;
    const y = (index - x) / width;
    // The neighbourhood's median, from opaque pixels that aren't spill themselves. The middle of a green
    // bit has too few clean neighbours close by, so it looks further out (else it would only be despilled,
    // which leaves a dark dot on a white outline).
    let opaque = 0;
    let count = 0;
    const isSmallBit = smallBit[greenBits.labels[index]!] === 1;
    for (const reach of isSmallBit ? [radius, radius * 2, radius * 4] : [radius]) {
      for (const channel of sample) channel.length = 0;
      opaque = 0;
      for (let dy = -reach; dy <= reach; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || (dx === 0 && dy === 0)) continue;
          const o = (yy * width + xx) * 4;
          if (source[o + 3]! < 200) continue;
          opaque++;
          if (keySaturated && source[o + keyChannel]! - Math.max(source[o + others[0]!]!, source[o + others[1]!]!) > 40)
            continue;
          for (let channel = 0; channel < 4; channel++) sample[channel]!.push(source[o + channel]!);
        }
      }
      count = sample[0]!.length;
      if (count >= 5) break;
    }
    const median = count >= 5 ? sample.map((values) => values.sort((a, b) => a - b)[values.length >> 1]!) : null;
    const green = spill(offset);
    if (median) {
      let alike = 0;
      for (let k = 0; k < count; k++) {
        const diff =
          Math.abs(sample[0]![k]! - median[0]!) +
          Math.abs(sample[1]![k]! - median[1]!) +
          Math.abs(sample[2]![k]! - median[2]!);
        if (diff < 60) alike++;
      }
      const differs =
        Math.abs(pixels[offset]! - median[0]!) +
          Math.abs(pixels[offset + 1]! - median[1]!) +
          Math.abs(pixels[offset + 2]! - median[2]!) >
        90;
      const pinhole = d > 1 && pixels[offset + 3]! < 200;
      // Specks are only painted over on the white outline, never on the art, whose fine lines look alike.
      const onOutline = median[0]! > 200 && median[1]! > 200 && median[2]! > 200;
      // A speck on the flat white outline, a green fleck, or a see-through pinhole.
      // A fleck is green among mostly not-green neighbours, so the edge of a sticker's own green fill stays.
      const fleck = (green > 40 && count >= opaque * 0.75) || isSmallBit;
      if (fleck || pinhole || (onOutline && differs && alike >= count * 0.5)) {
        pixels[offset] = median[0]!;
        pixels[offset + 1] = median[1]!;
        pixels[offset + 2] = median[2]!;
        if (pinhole) pixels[offset + 3] = Math.max(pixels[offset + 3]!, median[3]!);
        continue;
      }
    }
    // Whatever stays: take the green tint off the soft edge and off small green bits.
    if (green > 0 && (d <= 3 || isSmallBit))
      pixels[offset + keyChannel] = Math.max(pixels[offset + others[0]!]!, pixels[offset + others[1]!]!);
  }
}

/** Green-screen colour, however dark: green standing well above red and blue. */
function isKeyGreen(pixels: Uint8ClampedArray, offset: number): boolean {
  const others = Math.max(pixels[offset]!, pixels[offset + 2]!);
  const green = pixels[offset + 1]!;
  return green - others > 50 || (green - others > 14 && green > others * 1.3);
}

/**
 * Green-screen bits the edge pass doesn't reach, on a piece whose backdrop is already see-through: a dark
 * green fleck caught between hair strands, a pocket of backdrop in shadow, a green dot near the edge. Small
 * green bits near the edge take the colour of the art around them (or go see-through when there is no
 * art around them), and tiny loose specks off the drawing are dropped. Big green areas and anything deep
 * inside the drawing are the art's own green and stay. Returns whether anything changed.
 */
function removeGreenBits(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  /** The backdrop the piece was keyed against; null when it is not known (a piece saved see-through). */
  backdrop: number[] | null,
): boolean {
  const total = width * height;
  const reach = Math.max(8, Math.round(Math.max(width, height) * 0.15));
  const distance = new Uint16Array(total).fill(65535);
  let frontier: number[] = [];
  for (let i = 0; i < total; i++) {
    if (pixels[i * 4 + 3]! <= 24) {
      distance[i] = 0;
      frontier.push(i);
    }
  }
  for (let step = 1; step <= reach && frontier.length; step++) {
    const next: number[] = [];
    for (const index of frontier) {
      const x = index % width;
      for (const n of [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index >= width ? index - width : -1,
        index < total - width ? index + width : -1,
      ]) {
        if (n >= 0 && distance[n] === 65535) {
          distance[n] = step;
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  let changed = false;

  const green = new Uint8Array(total);
  for (let i = 0; i < total; i++)
    if (distance[i]! > 0 && distance[i]! <= reach && isKeyGreen(pixels, i * 4)) green[i] = 1;
  const bits = labelMask(green, width, height);
  const small = new Uint8Array(bits.regions.length + 1);
  for (const region of bits.regions) small[region.id] = region.area <= Math.max(12, total * 0.002) ? 1 : 0;
  // Each small bit plus its soft rim: the pixels just around it where the green blends into the art.
  const remove = new Uint8Array(total);
  for (let index = 0; index < total; index++) {
    if (!green[index] || !small[bits.labels[index]!]) continue;
    const x = index % width;
    const y = (index - x) / width;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const n = yy * width + xx;
        const o = n * 4;
        if (n === index || (pixels[o + 3]! > 24 && pixels[o + 1]! > Math.max(pixels[o]!, pixels[o + 2]!)))
          remove[n] = 1;
      }
    }
  }
  const source = new Uint8ClampedArray(pixels);
  const sample: number[][] = [[], [], []];
  for (let index = 0; index < total; index++) {
    if (!remove[index]) continue;
    const x = index % width;
    const y = (index - x) / width;
    let median: number[] | null = null;
    for (const r of [2, 4, 8, 16]) {
      for (const channel of sample) channel.length = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          const o = (yy * width + xx) * 4;
          if (source[o + 3]! < 200 || remove[yy * width + xx] || isKeyGreen(source, o)) continue;
          for (let channel = 0; channel < 3; channel++) sample[channel]!.push(source[o + channel]!);
        }
      }
      if (sample[0]!.length >= 5) {
        median = sample.map((values) => values.sort((a, b) => a - b)[values.length >> 1]!);
        break;
      }
    }
    const offset = index * 4;
    if (median) {
      pixels[offset] = median[0]!;
      pixels[offset + 1] = median[1]!;
      pixels[offset + 2] = median[2]!;
    } else pixels[offset + 3] = 0;
    changed = true;
  }

  if (!backdrop) return changed;
  // Loose specks: a few pixels on their own in the backdrop's own colour, left behind by the key. (Green
  // specks of other shades were already handled as green bits above.) A small detached part of the drawing
  // (the dot of a "!", a sparkle, a soft glow) has its own colour and stays.
  const opaque = new Uint8Array(total);
  for (let i = 0; i < total; i++) if (pixels[i * 4 + 3]! > 24) opaque[i] = 1;
  const islands = labelMask(opaque, width, height);
  const speck = Math.max(4, total * 0.0004);
  const residue = new Uint32Array(islands.regions.length + 1);
  for (let i = 0; i < total; i++) {
    if (!opaque[i]) continue;
    const offset = i * 4;
    const fromBackdrop =
      Math.abs(pixels[offset]! - backdrop[0]!) +
      Math.abs(pixels[offset + 1]! - backdrop[1]!) +
      Math.abs(pixels[offset + 2]! - backdrop[2]!);
    if (fromBackdrop < 90) residue[islands.labels[i]!]!++;
  }
  const loose = new Uint8Array(islands.regions.length + 1);
  for (const region of islands.regions)
    loose[region.id] = region.area <= speck && residue[region.id]! >= region.area * 0.5 ? 1 : 0;
  for (let i = 0; i < total; i++) {
    if (opaque[i] && loose[islands.labels[i]!]) {
      pixels[i * 4 + 3] = 0;
      changed = true;
    }
  }
  return changed;
}

/**
 * The green-bit pass (on a green screen), then the outline pass. Each can uncover a little more edge for
 * the other, so they repeat until nothing changes: running Clean up again on the result finds nothing
 * left to do and gives back the same picture.
 */
function cleanEdgesUntilSettled(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  background: number[],
  /** Whether `background` was measured from the picture (else it is the usual green screen, assumed). */
  measured = true,
) {
  const greenScreen = background[1]! - Math.max(background[0]!, background[2]!) > 80;
  for (let round = 0; round < 4; round++) {
    const before = new Uint8ClampedArray(pixels);
    if (greenScreen) removeGreenBits(pixels, width, height, measured ? background : null);
    cleanGallerySheetOutlines(pixels, width, height, background);
    if (pixels.every((value, index) => value === before[index])) break;
  }
}

/**
 * The outline passes for a sticker or emoji that was saved before. One still on the sheets' green screen
 * is keyed out like a fresh sheet; one already see-through gets the outline clean-up (specks, green flecks
 * and tint along its edge) against that green screen. Only the edge band is touched, so the art inside
 * keeps its own colours. Returns null, leaving the picture as it is, when the backdrop isn't a green
 * screen, when it doesn't key out cleanly, or when keying would take more than a fifth of the drawing.
 */
export async function cleanUpSavedGalleryPiece(dataUrl: string): Promise<string | null> {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const { canvas, ctx } = canvas2d(width, height);
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)].filter(
    (offset) => pixels[offset + 3]! > 24,
  );
  if (corners.length >= 2) {
    // Only a piece still on the sheets' green screen is keyed. Any other backdrop (white, a photo, a
    // gradient) may share colours with the drawing, and keying it would punch holes in the art: leave it.
    const backdrop = [0, 1, 2].map((channel) => {
      const values = corners.map((offset) => pixels[offset + channel]!).sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)]!;
    });
    if (backdrop[1]! - Math.max(backdrop[0]!, backdrop[2]!) <= 80) return null;
    const keyed = await keyOutGallerySheetBackground(dataUrl);
    if (!keyed.clean) return null;
    // The key must keep the drawing: compare what was drawn (not near the backdrop) with what stays opaque.
    const near = (data: Uint8ClampedArray, offset: number) =>
      Math.abs(data[offset]! - backdrop[0]!) +
        Math.abs(data[offset + 1]! - backdrop[1]!) +
        Math.abs(data[offset + 2]! - backdrop[2]!) <
      90;
    let drawn = 0;
    for (let offset = 0; offset < pixels.length; offset += 4)
      if (pixels[offset + 3]! > 24 && !near(pixels, offset)) drawn++;
    const after = await loadImage(keyed.dataUrl);
    const check = canvas2d(width, height);
    check.ctx.drawImage(after, 0, 0);
    const kept = check.ctx.getImageData(0, 0, width, height).data;
    let opaque = 0;
    for (let offset = 3; offset < kept.length; offset += 4) if (kept[offset]! > 24) opaque++;
    return drawn > 0 && opaque >= drawn * 0.8 ? keyed.dataUrl : null;
  }
  cleanEdgesUntilSettled(pixels, width, height, [0, 255, 0], false);
  ctx.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Make a cell's flat backdrop see-through: flood-fill from the edges through every pixel close to the
 * backdrop colour (read from the corners), so the same colour inside the drawing is left alone (a
 * green sticker on a green screen keeps its green). `clean` is false when the edges still hold much
 * that isn't see-through, i.e. the backdrop wasn't flat and needs the server's remover.
 */
export async function keyOutGallerySheetBackground(dataUrl: string): Promise<{ dataUrl: string; clean: boolean }> {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const { canvas, ctx } = canvas2d(width, height);
  ctx.drawImage(image, 0, 0);
  const frame = ctx.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)].filter(
    (offset) => pixels[offset + 3]! > 24,
  );
  if (corners.length < 2) return { dataUrl, clean: true }; // already see-through
  const background = [0, 1, 2].map((channel) => {
    const values = corners.map((offset) => pixels[offset + channel]!).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)]!;
  });
  const near = (offset: number) =>
    pixels[offset + 3]! > 24 &&
    Math.abs(pixels[offset]! - background[0]!) +
      Math.abs(pixels[offset + 1]! - background[1]!) +
      Math.abs(pixels[offset + 2]! - background[2]!) <
      90;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const index = y * width + x;
    if (seen[index]) return;
    seen[index] = 1;
    if (near(index * 4)) stack.push(index);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const index = stack.pop()!;
    pixels[index * 4 + 3] = 0;
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  // Pockets of backdrop the fill couldn't reach (between hair strands, inside a bent arm): anything as close
  // to the key colour as the fill itself allows is backdrop. Same tolerance as the fill, so a light green
  // the art uses keeps its colour; shaded green bits near the edge are left to the green-bit pass.
  const pocket = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) if (near(i * 4)) pocket[i] = 1;
  for (let i = 0; i < width * height; i++) if (pocket[i]) pixels[i * 4 + 3] = 0;
  cleanEdgesUntilSettled(pixels, width, height, background);
  ctx.putImageData(frame, 0, 0);
  let edge = 0;
  let opaqueEdge = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      edge++;
      if (pixels[at(x, y) + 3]! > 24) opaqueEdge++;
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      edge++;
      if (pixels[at(x, y) + 3]! > 24) opaqueEdge++;
    }
  }
  return { dataUrl: canvas.toDataURL("image/png"), clean: opaqueEdge / edge < 0.1 };
}

// ── Finding stickers by their outline (image models rarely keep to an even grid) ──

/** A rectangle on the sheet, in sheet pixels. */
export type GallerySheetBox = { x: number; y: number; width: number; height: number };

export type GallerySheetPiece = { box: GallerySheetBox; dataUrl: string };

/** Crop a box out of a (background-free) sheet, everything inside it. */
export async function cropGallerySheetBox(sheetDataUrl: string, box: GallerySheetBox): Promise<string> {
  const image = await loadImage(sheetDataUrl);
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const width = Math.max(1, Math.min(image.naturalWidth - x, Math.round(box.width)));
  const height = Math.max(1, Math.min(image.naturalHeight - y, Math.round(box.height)));
  const { canvas, ctx } = canvas2d(width, height);
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

type MaskRegion = { id: number; area: number; minX: number; minY: number; maxX: number; maxY: number };

/** Label the 4-connected areas of a mask; `labels` holds 1-based region ids, 0 for empty. */
function labelMask(mask: Uint8Array, w: number, h: number): { labels: Int32Array; regions: MaskRegion[] } {
  const labels = new Int32Array(w * h);
  const regions: MaskRegion[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start]) continue;
    const region = { id: regions.length + 1, area: 0, minX: w, minY: h, maxX: 0, maxY: 0 };
    const visit = (index: number) => {
      labels[index] = region.id;
      stack.push(index);
    };
    visit(start);
    while (stack.length) {
      const index = stack.pop()!;
      const x = index % w;
      const y = (index - x) / w;
      region.area++;
      if (x < region.minX) region.minX = x;
      if (x > region.maxX) region.maxX = x;
      if (y < region.minY) region.minY = y;
      if (y > region.maxY) region.maxY = y;
      if (x > 0 && mask[index - 1] && !labels[index - 1]) visit(index - 1);
      if (x < w - 1 && mask[index + 1] && !labels[index + 1]) visit(index + 1);
      if (y > 0 && mask[index - w] && !labels[index - w]) visit(index - w);
      if (y < h - 1 && mask[index + w] && !labels[index + w]) visit(index + w);
    }
    regions.push(region);
  }
  return { labels, regions };
}

/** Shrink a mask by `radius` (square), which breaks thin joins such as two outlines that touch. */
function erodeMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  // Separable: a pixel survives when its whole row span, then its whole column span, is solid.
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    const line = new Int32Array(w);
    for (let x = 0; x < w; x++) line[x] = run = mask[y * w + x] ? run + 1 : 0;
    for (let x = 0; x < w; x++) {
      const right = Math.min(w - 1, x + radius);
      rows[y * w + x] = x - radius >= 0 && line[right]! >= right - (x - radius) + 1 ? 1 : 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let run = 0;
    const line = new Int32Array(h);
    for (let y = 0; y < h; y++) line[y] = run = rows[y * w + x] ? run + 1 : 0;
    for (let y = 0; y < h; y++) {
      const bottom = Math.min(h - 1, y + radius);
      out[y * w + x] = y - radius >= 0 && line[bottom]! >= bottom - (y - radius) + 1 ? 1 : 0;
    }
  }
  return out;
}

/** The regions big enough to be a sticker rather than a speck, judged against the `expected`-th largest. */
function bigRegions(regions: MaskRegion[], expected: number, total: number): MaskRegion[] {
  if (regions.length === 0) return [];
  const byArea = [...regions].sort((a, b) => b.area - a.area);
  const typical = byArea[Math.min(byArea.length, Math.max(1, expected)) - 1]!.area;
  // Against the biggest too, so a sheet with fewer stickers than asked doesn't promote its sparkles.
  const floor = Math.max(typical * 0.25, byArea[0]!.area * 0.08, total * 0.002);
  return regions.filter((region) => region.area >= floor);
}

/**
 * Find each sticker on a sheet whose background is already see-through, and cut each out with only its own
 * pixels, so a neighbour reaching into its box stays out. Stickers whose outlines touch are told apart by
 * shrinking the drawing until they come loose; small loose bits (sparkles, "zzz", sweat drops) join the
 * nearest sticker. Pieces come in reading order. Returns null when nothing usable is found.
 */
export async function detectGallerySheetPieces(
  sheetDataUrl: string,
  expected: number,
): Promise<GallerySheetPiece[] | null> {
  const image = await loadImage(sheetDataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(1, 256 / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const total = sw * sh;
  const small = canvas2d(sw, sh);
  small.ctx.drawImage(image, 0, 0, sw, sh);
  const alpha = small.ctx.getImageData(0, 0, sw, sh).data;
  const solid = new Uint8Array(total);
  for (let i = 0; i < total; i++) solid[i] = alpha[i * 4 + 3]! > 40 ? 1 : 0;

  // Seeds: one solid core per sticker. Shrink step by step until the expected number come apart (up to about
  // 2.5% of the sheet, beyond which real stickers would start splitting), keeping the step that found the most.
  const maxRadius = Math.max(1, Math.round(Math.max(sw, sh) * 0.025));
  let seeds: { labels: Int32Array; regions: MaskRegion[] } | null = null;
  for (let radius = 0; radius <= maxRadius; radius++) {
    const mask = radius === 0 ? solid : erodeMask(solid, sw, sh, radius);
    const labelled = labelMask(mask, sw, sh);
    const big = bigRegions(labelled.regions, expected, total);
    if (!seeds || big.length > seeds.regions.length) seeds = { labels: labelled.labels, regions: big };
    if (big.length >= expected) break;
  }
  if (!seeds || seeds.regions.length === 0) return null;

  // Grow every seed back over the drawing (breadth first, so touching stickers split along the middle).
  const owner = new Int32Array(total);
  const seedIndex = new Map(seeds.regions.map((region, index) => [region.id, index + 1]));
  let frontier: number[] = [];
  for (let i = 0; i < total; i++) {
    const id = seedIndex.get(seeds.labels[i]!);
    if (id) {
      owner[i] = id;
      frontier.push(i);
    }
  }
  const spread = (allow: (index: number) => boolean, steps = Infinity) => {
    for (let step = 0; step < steps && frontier.length; step++) {
      const next: number[] = [];
      for (const index of frontier) {
        const x = index % sw;
        const neighbours = [
          x > 0 ? index - 1 : -1,
          x < sw - 1 ? index + 1 : -1,
          index >= sw ? index - sw : -1,
          index < total - sw ? index + sw : -1,
        ];
        for (const n of neighbours) {
          if (n < 0 || owner[n] || !allow(n)) continue;
          owner[n] = owner[index]!;
          next.push(n);
        }
      }
      frontier = next;
    }
  };
  spread((index) => solid[index] === 1);

  // Loose bits nobody reached join the nearest sticker when close enough; farther ones are dropped.
  const loose = labelMask(
    solid.map((value, index) => (value && !owner[index] ? 1 : 0)),
    sw,
    sh,
  );
  const reach = Math.max(sw, sh) * 0.06;
  const boxes = seeds.regions.map(() => ({ minX: sw, minY: sh, maxX: -1, maxY: -1 }));
  for (let i = 0; i < total; i++) {
    const id = owner[i];
    if (!id) continue;
    const box = boxes[id - 1]!;
    const x = i % sw;
    const y = (i - x) / sw;
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;
  }
  const looseOwner = new Map<number, number>();
  for (const bit of loose.regions) {
    let best = 0;
    let bestDistance = reach;
    boxes.forEach((box, index) => {
      const dx = Math.max(box.minX - bit.maxX, bit.minX - box.maxX, 0);
      const dy = Math.max(box.minY - bit.maxY, bit.minY - box.maxY, 0);
      const distance = Math.hypot(dx, dy);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = index + 1;
      }
    });
    if (best) looseOwner.set(bit.id, best);
  }
  for (let i = 0; i < total; i++) {
    const bit = loose.labels[i];
    if (!bit) continue;
    const id = looseOwner.get(bit);
    if (!id) continue;
    owner[i] = id;
    const box = boxes[id - 1]!;
    const x = i % sw;
    const y = (i - x) / sw;
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;
  }
  // Reach a little past every edge, so the soft outer pixels lost in the small copy come along at full size.
  frontier = [];
  for (let i = 0; i < total; i++) if (owner[i]) frontier.push(i);
  spread(() => true, 2);

  // Reading order: group into rows by vertical centre, then left to right.
  const found = boxes
    .map((box, index) => ({ ...box, id: index + 1 }))
    .filter((box) => box.maxX >= box.minX && box.maxY >= box.minY);
  if (found.length === 0) return null;
  const centreY = (r: (typeof found)[number]) => (r.minY + r.maxY) / 2;
  const medianHeight = found.map((r) => r.maxY - r.minY + 1).sort((a, b) => a - b)[Math.floor(found.length / 2)]!;
  const rows: Array<typeof found> = [];
  for (const region of [...found].sort((a, b) => centreY(a) - centreY(b))) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(centreY(region) - centreY(row[0]!)) < medianHeight * 0.5) row.push(region);
    else rows.push([region]);
  }
  const ordered = rows.flatMap((row) => row.sort((a, b) => a.minX - b.minX));

  // Cut each piece at full size, keeping only the pixels this piece owns.
  const full = canvas2d(width, height);
  full.ctx.drawImage(image, 0, 0);
  const pixels = full.ctx.getImageData(0, 0, width, height).data;
  const pad = 2;
  return ordered.map((region) => {
    const x0 = Math.max(0, Math.floor((region.minX - pad) / scale));
    const y0 = Math.max(0, Math.floor((region.minY - pad) / scale));
    const x1 = Math.min(width, Math.ceil((region.maxX + 1 + pad) / scale));
    const y1 = Math.min(height, Math.ceil((region.maxY + 1 + pad) / scale));
    const box = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    const { canvas, ctx } = canvas2d(box.width, box.height);
    const out = ctx.createImageData(box.width, box.height);
    for (let y = y0; y < y1; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * scale));
      for (let x = x0; x < x1; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * scale));
        if (owner[sy * sw + sx] !== region.id) continue;
        const from = (y * width + x) * 4;
        const to = ((y - y0) * box.width + (x - x0)) * 4;
        out.data[to] = pixels[from]!;
        out.data[to + 1] = pixels[from + 1]!;
        out.data[to + 2] = pixels[from + 2]!;
        out.data[to + 3] = pixels[from + 3]!;
      }
    }
    ctx.putImageData(out, 0, 0);
    return { box, dataUrl: canvas.toDataURL("image/png") };
  });
}

/** The even-grid boxes, for sheets where no outlines could be found. */
export function gallerySheetGridBoxes(
  width: number,
  height: number,
  cols: number,
  rows: number,
  count: number,
): GallerySheetBox[] {
  const cellWidth = width / cols;
  const cellHeight = height / rows;
  return Array.from({ length: Math.min(count, cols * rows) }, (_, index) => ({
    x: (index % cols) * cellWidth,
    y: Math.floor(index / cols) * cellHeight,
    width: cellWidth,
    height: cellHeight,
  }));
}

/** True when a picture has nothing visible in it (a box placed on empty sheet). */
export async function isBlankGallerySheetImage(dataUrl: string): Promise<boolean> {
  const image = await loadImage(dataUrl);
  const w = Math.max(1, Math.min(64, image.naturalWidth));
  const h = Math.max(1, Math.min(64, image.naturalHeight));
  const { ctx } = canvas2d(w, h);
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 24) return false;
  return true;
}

export async function readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const image = await loadImage(dataUrl);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/**
 * Whether two pictures have the same size and the same pixels, so saving one over the other changes
 * nothing. Colours are compared as they show (weighted by opacity) with a little leeway: Safari shifts the
 * colour of half see-through edge pixels slightly every time a picture goes through a canvas, and that
 * alone must not count as a change (else each Clean up would save the picture again, a shade darker).
 */
export async function sameGalleryPicture(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([loadImage(a), loadImage(b)]);
  const width = first.naturalWidth;
  const height = first.naturalHeight;
  if (width !== second.naturalWidth || height !== second.naturalHeight) return false;
  const read = (image: HTMLImageElement) => {
    const { ctx } = canvas2d(width, height);
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const left = read(first);
  const right = read(second);
  for (let offset = 0; offset < left.length; offset += 4) {
    const alpha = left[offset + 3]!;
    if (Math.abs(alpha - right[offset + 3]!) > 1) return false;
    for (let channel = 0; channel < 3; channel++) {
      const shown = (data: Uint8ClampedArray) => (data[offset + channel]! * data[offset + 3]!) / 255;
      if (Math.abs(shown(left) - shown(right)) > 3) return false;
    }
  }
  return true;
}
