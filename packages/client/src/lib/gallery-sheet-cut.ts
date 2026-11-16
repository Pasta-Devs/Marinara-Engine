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

/** Cut a sheet into its grid cells, left to right, top to bottom, untrimmed. */
export async function sliceGallerySheet(dataUrl: string, cols: number, rows: number, count: number): Promise<string[]> {
  const image = await loadImage(dataUrl);
  const cellWidth = image.naturalWidth / cols;
  const cellHeight = image.naturalHeight / rows;
  const cells: string[] = [];
  for (let index = 0; index < Math.min(count, cols * rows); index++) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const left = Math.round(col * cellWidth);
    const top = Math.round(row * cellHeight);
    const width = Math.round((col + 1) * cellWidth) - left;
    const height = Math.round((row + 1) * cellHeight) - top;
    const { canvas, ctx } = canvas2d(width, height);
    ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
    cells.push(canvas.toDataURL("image/png"));
  }
  return cells;
}

/**
 * Trim a cell to what was drawn on it, then centre it on a square with a small margin and scale it
 * down to the kind's size. A pixel counts as drawn when it is not see-through and does not match the
 * cell's background, read from its four corners (so a flat white or green backdrop is skipped too).
 */
export async function fitGallerySheetCell(
  dataUrl: string,
  kind: GallerySheetKind,
  options: { trim?: boolean } = {},
): Promise<string> {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  let bounds = { left: 0, top: 0, right: width, bottom: height };

  if (options.trim !== false) {
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
    if (right >= left && bottom >= top) bounds = { left, top, right: right + 1, bottom: bottom + 1 };
  }

  const contentWidth = bounds.right - bounds.left;
  const contentHeight = bounds.bottom - bounds.top;
  const side = Math.ceil(Math.max(contentWidth, contentHeight) * 1.08);
  const outSide = Math.min(GALLERY_SHEET_MAX_SIDE[kind], side);
  const scale = outSide / side;
  const { canvas, ctx } = canvas2d(outSide, outSide);
  ctx.imageSmoothingQuality = "high";
  const drawWidth = contentWidth * scale;
  const drawHeight = contentHeight * scale;
  ctx.drawImage(
    image,
    bounds.left,
    bounds.top,
    contentWidth,
    contentHeight,
    (outSide - drawWidth) / 2,
    (outSide - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
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
