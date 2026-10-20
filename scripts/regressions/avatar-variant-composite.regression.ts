/**
 * Blink and talk pictures change only the eyes or the mouth (maintainer report, 2026-10-19: generated "Eyes
 * closed" and "Mouth open" pictures of a bust cut flat at the canvas bottom showed white bars along the bottom
 * and slightly wrong pixels everywhere else, because the model's whole picture was pasted back although models
 * pad, move and scale what they return):
 *   - for every simulated model output (in place, shifted with white fill, zoomed out, zoomed in, a square
 *     canvas, a letterboxed portrait canvas, a larger canvas with JPEG noise), the saved picture equals the face
 *     outside the eyes or mouth, pixel for pixel, has no white rows at the bottom, keeps the face's alpha
 *     everywhere, and shows the change inside;
 *   - a picture with no change, or one turned too far to line up, is refused with a plain message;
 *   - the capability decision: a connection whose model takes a reference picture edits the sprite, one that
 *     drops it (DALL-E, Pollinations) draws a set instead, never an edit request;
 *   - the set: one sheet with the face, eyes closed and mouth open, each cell cleaned of the chroma matte; each
 *     variant cell lined up with the face cell, so a variant equals the new face outside its eyes or mouth;
 *     its prompt in the prompt review carries the set contract; keeping it stores the new face as the base and
 *     leaves the sprite file as it is, and a picture of the old face never mixes into the new set.
 * The face is drawn from SVG with the reported sprite's shape: 512x484, the bust cut flat across the bottom
 * rows, an AI remover's 253 alpha inside. MARINARA_AVATAR_VARIANT_SOURCE runs the same edit checks on a real
 * face PNG with its eyes and mouth at the same places; MARINARA_AVATAR_VARIANT_OUT saves the pictures there.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-avatar-variant-composite-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";
// The built-in matte cleanup, no AI remover.
process.env.BACKGROUNDREMOVER_DISABLED = "true";

const { getDB } = await import("../../packages/server/src/db/connection.js");
const { characterDataSchema } = await import("../../packages/shared/src/index.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { selectSpriteChromaMatte } =
  await import("../../packages/server/src/services/image/sprite-background.service.js");
const { avatarOwnerDir, readAvatarConfig } = await import("../../packages/server/src/services/avatars/storage.js");
const { avatarCanvasPlacement, avatarImageRequestSize, resolveAvatarImageConnection } =
  await import("../../packages/server/src/services/avatars/generation/generation-context.js");
const { generatePngtuberVariants, previewPngtuberVariantPrompts, savePngtuberVariants, setPromptId, variantPromptId } =
  await import("../../packages/server/src/services/avatars/generation/pngtuber-variants.js");
const sharp = await getSharp();

// ── The face: the reported sprite's shape ──
const WIDTH = 512;
const HEIGHT = 484;
const SKIN = "rgb(244,214,196)";
const EYES = [
  { cx: 205, cy: 218 },
  { cx: 300, cy: 211 },
];
const MOUTH = { cx: 255, cy: 298 };
/** Where the eyes or the mouth may change, generously; everything outside must stay the face's own. */
const REGIONS = {
  "eyes-closed": { left: 140, top: 170, right: 365, bottom: 265 },
  "mouth-open": { left: 200, top: 255, right: 310, bottom: 345 },
} as const;
type Variant = keyof typeof REGIONS;

function faceSvg({ eyes = "open", mouth = "closed" }: { eyes?: "open" | "closed"; mouth?: "open" | "closed" } = {}) {
  const eye = ({ cx, cy }: { cx: number; cy: number }) =>
    eyes === "open"
      ? `<ellipse cx="${cx}" cy="${cy}" rx="21" ry="10" fill="#fbf7f2"/><circle cx="${cx}" cy="${cy}" r="8" fill="#b3202a"/>` +
        `<circle cx="${cx}" cy="${cy}" r="3" fill="#1a0a0a"/><path d="M${cx - 24} ${cy - 3} Q${cx} ${cy - 16} ${cx + 24} ${cy - 3}" stroke="#1d120c" stroke-width="4" fill="none"/>`
      : `<path d="M${cx - 22} ${cy + 1} Q${cx} ${cy + 9} ${cx + 22} ${cy + 1}" stroke="#1d120c" stroke-width="4" fill="none"/>`;
  const mouthShape =
    mouth === "open"
      ? `<ellipse cx="${MOUTH.cx}" cy="${MOUTH.cy + 3}" rx="13" ry="10" fill="#6a1d24"/><ellipse cx="${MOUTH.cx}" cy="${MOUTH.cy + 8}" rx="8" ry="4" fill="#d7737a"/>`
      : `<path d="M${MOUTH.cx - 13} ${MOUTH.cy} L${MOUTH.cx + 13} ${MOUTH.cy}" stroke="#8a5450" stroke-width="2"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <ellipse cx="256" cy="175" rx="170" ry="160" fill="#3b2418"/>
    <path d="M10 ${HEIGHT} L34 404 Q256 330 478 404 L502 ${HEIGHT} Z" fill="#6b1f24"/>
    <path d="M150 ${HEIGHT} L205 372 L240 ${HEIGHT} Z M362 ${HEIGHT} L307 372 L272 ${HEIGHT} Z" fill="#141010"/>
    <path d="M150 ${HEIGHT} L205 372 M362 ${HEIGHT} L307 372" stroke="#c8a96a" stroke-width="5"/>
    <rect x="226" y="290" width="60" height="90" fill="${SKIN}"/>
    <ellipse cx="256" cy="232" rx="96" ry="112" fill="${SKIN}"/>
    <path d="M222 388 L256 398 L290 388 L290 412 L256 402 L222 412 Z" fill="#f4f1ec"/>
    <rect x="170" y="186" width="56" height="7" rx="3" fill="#2a180f"/><rect x="276" y="179" width="56" height="7" rx="3" fill="#2a180f"/>
    ${eye(EYES[0]!)}${eye(EYES[1]!)}
    <path d="M252 250 L246 276 L256 278" stroke="#c99a84" stroke-width="2" fill="none"/>
    ${mouthShape}
    <path d="M150 90 Q205 150 182 205 M215 70 Q262 140 238 196 M300 72 Q330 128 352 196 M168 120 Q140 220 160 300 M345 120 Q372 220 352 300" stroke="#24150d" stroke-width="9" fill="none"/>
    <path d="M180 98 Q228 150 212 190 M330 96 Q300 150 318 188" stroke="#5a3a26" stroke-width="3" fill="none"/>
  </svg>`);
}

/** A face as an AI background remover leaves it: solid pixels at alpha 253. */
async function cutOut(svg: Buffer) {
  const { data, info } = await sharp(svg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 3; index < data.length; index += 4) if (data[index] === 255) data[index] = 253;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

const realSource = process.env.MARINARA_AVATAR_VARIANT_SOURCE;
const sourcePng = realSource ? await sharp(readFileSync(realSource)).png().toBuffer() : await cutOut(faceSvg());
const outDir = process.env.MARINARA_AVATAR_VARIANT_OUT;
if (outDir) mkdirSync(outDir, { recursive: true });
const keepPicture = (name: string, png: Buffer) => {
  if (outDir) writeFileSync(join(outDir, `${name}.png`), png);
};

async function rgba(png: Buffer) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const dataUrlPng = (url: string) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");

/** The picture equals `face` outside the eyes or mouth (`dy` lower for a face drawn lower), byte for byte, its
 *  alpha everywhere, and differs inside. */
async function assertOnlyRegionChanged(png: Buffer, face: Buffer, variant: Variant, what: string, dy = 0) {
  const [picture, source] = [await rgba(png), await rgba(face)];
  assert.deepEqual([picture.width, picture.height], [source.width, source.height], `${what}: the face's size`);
  const region = { ...REGIONS[variant], top: REGIONS[variant].top + dy, bottom: REGIONS[variant].bottom + dy };
  let outside = 0;
  let alpha = 0;
  let inside = 0;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      if (picture.data[index + 3] !== source.data[index + 3]) alpha += 1;
      const same = picture.data.readUInt32LE(index) === source.data.readUInt32LE(index);
      const inRegion = x >= region.left && x <= region.right && y >= region.top && y <= region.bottom;
      if (!inRegion && !same) outside += 1;
      if (inRegion && !same) inside += 1;
    }
  }
  assert.equal(
    outside,
    0,
    `${what}: every pixel outside the ${variant === "eyes-closed" ? "eyes" : "mouth"} is the face's own`,
  );
  assert.equal(alpha, 0, `${what}: the face's alpha is kept everywhere`);
  assert.ok(inside > 100, `${what}: the ${variant === "eyes-closed" ? "eyes" : "mouth"} changed (${inside} pixels)`);
  // No white rows along the bottom: the bust is cut flat there.
  for (let y = source.height - 30; y < source.height; y += 1) {
    let white = 0;
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4;
      const isWhite = (data: Buffer) => data[index]! > 235 && data[index + 1]! > 235 && data[index + 2]! > 235;
      if (picture.data[index + 3]! >= 128 && isWhite(picture.data) && !isWhite(source.data)) white += 1;
    }
    assert.equal(white, 0, `${what}: no white pixels added in row ${y}`);
  }
}

/** The change itself: closed eyes are skin where the irises were, an open mouth is dark where the lips met. */
async function assertChange(png: Buffer, variant: Variant, what: string, offset = { x: 0, y: 0 }) {
  const { data, width } = await rgba(png);
  const at = (x: number, y: number) => [...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 3)];
  if (variant === "eyes-closed") {
    for (const eye of EYES) {
      const [red, green, blue] = at(eye.cx + offset.x, eye.cy + offset.y - 3);
      assert.ok(
        red! > 200 && green! > 170 && blue! > 150,
        `${what}: the eye at ${eye.cx} is closed: ${[red, green, blue]}`,
      );
    }
  } else {
    const [red, green, blue] = at(MOUTH.cx + offset.x, MOUTH.cy + offset.y);
    assert.ok(red! < 150 && green! < 90 && blue! < 100, `${what}: the mouth is open: ${[red, green, blue]}`);
  }
}

// ── The image model: edits on the canvas it is sent, then moves, scales or resizes it like real models ──
type EditMode =
  | "in-place"
  | "shifted"
  | "zoomed-out"
  | "zoomed-in"
  | "square"
  | "letterboxed"
  | "bigger-jpeg"
  | "no-change"
  | "turned";
let editMode: EditMode = "in-place";
const requests: string[] = [];
let sheetPng: Buffer | null = null;
const canvasSize = avatarImageRequestSize(WIDTH, HEIGHT, "gpt-image-2");
const place = avatarCanvasPlacement({ width: WIDTH, height: HEIGHT }, canvasSize);
const toCanvas = (x: number, y: number) => ({
  x: place.left + (x * place.width) / WIDTH,
  y: place.top + (y * place.height) / HEIGHT,
});
const canvasScale = place.width / WIDTH;

/** What the model draws for a blink or a talk picture, on the canvas. */
function changeOverlay(variant: Variant) {
  const shapes =
    variant === "eyes-closed"
      ? EYES.map((eye) => {
          const { x, y } = toCanvas(eye.cx, eye.cy);
          const s = canvasScale;
          return `<ellipse cx="${x}" cy="${y - 2 * s}" rx="${27 * s}" ry="${15 * s}" fill="${SKIN}"/><path d="M${x - 22 * s} ${y + s} Q${x} ${y + 9 * s} ${x + 22 * s} ${y + s}" stroke="#1d120c" stroke-width="${4 * s}" fill="none"/>`;
        }).join("")
      : (() => {
          const { x, y } = toCanvas(MOUTH.cx, MOUTH.cy);
          const s = canvasScale;
          return `<ellipse cx="${x}" cy="${y + 3 * s}" rx="${13 * s}" ry="${10 * s}" fill="#6a1d24"/><ellipse cx="${x}" cy="${y + 8 * s}" rx="${8 * s}" ry="${4 * s}" fill="#d7737a"/>`;
        })();
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize.width}" height="${canvasSize.height}">${shapes}</svg>`,
  );
}

async function modelEdit(sent: Buffer, variant: Variant): Promise<Buffer> {
  const { width, height } = canvasSize;
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  const edited =
    editMode === "no-change"
      ? sent
      : await sharp(sent)
          .composite([{ input: changeOverlay(variant) }])
          .png()
          .toBuffer();
  switch (editMode) {
    case "shifted":
      // Up 24 and left 6 pixels, the edge it uncovers painted white.
      return sharp(await sharp(edited).extend({ bottom: 24, right: 6, background: white }).png().toBuffer())
        .extract({ left: 6, top: 24, width, height })
        .png()
        .toBuffer();
    case "zoomed-out": {
      // The white line in the report: the bust ends above the canvas bottom.
      const w = Math.round(width * 0.93);
      const h = Math.round(height * 0.93);
      return sharp(await sharp(edited).resize(w, h).png().toBuffer())
        .extend({
          left: Math.floor((width - w) / 2),
          right: Math.ceil((width - w) / 2),
          top: Math.floor((height - h) / 2),
          bottom: Math.ceil((height - h) / 2),
          background: white,
        })
        .png()
        .toBuffer();
    }
    case "zoomed-in": {
      const w = Math.round(width * 1.03);
      const h = Math.round(height * 1.03);
      return sharp(await sharp(edited).resize(w, h).png().toBuffer())
        .extract({ left: Math.floor((w - width) / 2), top: Math.floor((h - height) / 2), width, height })
        .png()
        .toBuffer();
    }
    case "square":
      return sharp(edited).resize(1024, 1024, { fit: "fill" }).png().toBuffer();
    case "letterboxed":
      return sharp(edited).resize(1024, 1536, { fit: "contain", background: white }).png().toBuffer();
    case "bigger-jpeg":
      return sharp(edited).resize(1274, 1235, { fit: "fill" }).jpeg({ quality: 60 }).toBuffer();
    case "turned":
      return sharp(await sharp(edited).rotate(14, { background: white }).png().toBuffer())
        .resize(width, height, { fit: "fill" })
        .png()
        .toBuffer();
    default:
      return edited;
  }
}

const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const url = request.url ?? "";
  requests.push(url);
  response.setHeader("content-type", "application/json");
  if (url.endsWith("/images/edits")) {
    const start = body.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const sent = body.subarray(start, body.indexOf(Buffer.from("IEND"), start) + 8);
    const variant: Variant = body.includes(Buffer.from("MAKE-BLINK")) ? "eyes-closed" : "mouth-open";
    const drawn = await modelEdit(Buffer.from(sent), variant);
    if (outDir) keepPicture(`model-${variant}-${editMode}`, await sharp(drawn).png().toBuffer());
    response.end(JSON.stringify({ data: [{ b64_json: drawn.toString("base64") }] }));
    return;
  }
  if (url.endsWith("/images/generations") && sheetPng) {
    response.end(JSON.stringify({ data: [{ b64_json: sheetPng.toString("base64") }] }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: { message: "not here" } }));
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerUrl = `http://127.0.0.1:${(provider.address() as { port: number }).port}/v1`;

const db = await getDB();
const APPEARANCE =
  "a young man with shoulder-length dark brown hair, red eyes, a dark red tailcoat and a white bow tie";
const character = await createCharactersStorage(db).create(
  characterDataSchema.parse({ name: "Mau", description: APPEARANCE }),
);
const owner = { ownerType: "character" as const, ownerId: character!.id };
const connections = createConnectionsStorage(db);
const editing = await connections.create({
  name: "GPT Image 2",
  provider: "image_generation",
  baseUrl: providerUrl,
  model: "gpt-image-2",
  imageService: "openai",
  imageGenerationSource: "openai",
  apiKey: "fixture",
});
const drawing = await connections.create({
  name: "DALL-E 3",
  provider: "image_generation",
  baseUrl: providerUrl,
  model: "dall-e-3",
  imageService: "openai",
  imageGenerationSource: "openai",
  apiKey: "fixture",
});
const pollinations = await connections.create({
  name: "Pollinations",
  provider: "image_generation",
  imageService: "pollinations",
  model: "",
} as never);
const spriteDir = join(dataDir, "sprites", owner.ownerId);
mkdirSync(spriteDir, { recursive: true });
writeFileSync(join(spriteDir, "neutral.png"), sourcePng);
keepPicture("face", sourcePng);
const promptOverrides = (["eyes-closed", "mouth-open"] as const).map((variant) => ({
  id: variantPromptId("neutral", variant),
  prompt:
    variant === "eyes-closed" ? "MAKE-BLINK: close both eyes, change nothing else." : "MAKE-TALK: open the mouth.",
}));

try {
  // ── Which connections edit, and which draw a set ──
  {
    assert.equal((await resolveAvatarImageConnection(db, editing.id)).canEdit, true, "GPT Image takes the sprite");
    assert.equal((await resolveAvatarImageConnection(db, drawing.id)).canEdit, false, "DALL-E 3 can't edit");
    assert.equal((await resolveAvatarImageConnection(db, pollinations.id)).canEdit, false, "nor can Pollinations");
    const editPreview = await previewPngtuberVariantPrompts(db, {
      owner,
      labels: ["neutral"],
      variants: ["eyes-closed", "mouth-open"],
      connectionId: editing.id,
    });
    assert.deepEqual(
      editPreview.map((item) => item.id),
      [variantPromptId("neutral", "eyes-closed"), variantPromptId("neutral", "mouth-open")],
      "an editing connection reviews one edit prompt per picture",
    );
    const setPreview = await previewPngtuberVariantPrompts(db, {
      owner,
      labels: ["neutral"],
      variants: ["eyes-closed"],
      connectionId: drawing.id,
    });
    assert.deepEqual(
      setPreview.map((item) => item.id),
      [setPromptId("neutral")],
      "one set prompt per face",
    );
    assert.match(setPreview[0]!.prompt, /MANDATORY TALKING-HEAD SET/u);
    assert.match(setPreview[0]!.prompt, /Cell 2: exactly cell 1 with both eyes closed/u);
    assert.match(setPreview[0]!.prompt, /dark brown hair/u, "drawn from the appearance");
    assert.deepEqual([setPreview[0]!.width, setPreview[0]!.height], [1536, 512], "three cells side by side");
  }

  // ── Edits: whatever the model did to the canvas, only the eyes or mouth change ──
  for (const mode of [
    "in-place",
    "shifted",
    "zoomed-out",
    "zoomed-in",
    "square",
    "letterboxed",
    "bigger-jpeg",
  ] as const) {
    editMode = mode;
    const response = await generatePngtuberVariants(db, {
      owner,
      labels: ["neutral"],
      variants: ["eyes-closed", "mouth-open"],
      connectionId: editing.id,
      promptOverrides,
    });
    assert.deepEqual(response.failed, [], `${mode}: both pictures are made`);
    for (const draft of response.drafts) {
      const png = dataUrlPng(draft.image);
      keepPicture(`${draft.variant}-${mode}`, png);
      assert.equal(draft.face, undefined, `${mode}: an edit keeps the sprite as the face`);
      await assertOnlyRegionChanged(png, sourcePng, draft.variant, `${mode} ${draft.variant}`);
      if (!realSource) await assertChange(png, draft.variant, `${mode} ${draft.variant}`);
    }
  }
  assert.equal(requests.filter((url) => url.endsWith("/images/generations")).length, 0, "an edit never draws anew");

  // ── Saving keeps the picture as it is, next to the sprite ──
  {
    editMode = "shifted";
    const response = await generatePngtuberVariants(db, {
      owner,
      labels: ["neutral"],
      variants: ["mouth-open"],
      connectionId: editing.id,
      promptOverrides,
    });
    const draft = response.drafts[0]!;
    const saved = await savePngtuberVariants({ owner, images: [{ ...draft }] });
    const layers = saved.config.kinds.pngtuber!.layers.neutral!;
    const file = (ref: unknown) => readFileSync(join(avatarOwnerDir(owner), (ref as { path: string }).path));
    assert.deepEqual(file(layers.base), sourcePng, "the base is the sprite itself");
    await assertOnlyRegionChanged(file(layers.mouthOpen), sourcePng, "mouth-open", "the saved talk picture");
  }

  // ── Pictures that can't be used are refused, not saved ──
  for (const [mode, message] of [
    ["no-change", /didn't close the eyes/u],
    ["turned", /Try again/u],
  ] as const) {
    editMode = mode;
    const response = await generatePngtuberVariants(db, {
      owner,
      labels: ["neutral"],
      variants: ["eyes-closed"],
      connectionId: editing.id,
      promptOverrides,
    }).catch((error: unknown) => ({ drafts: [], failed: [{ error: (error as Error).message }] }));
    assert.equal(response.drafts.length, 0, `${mode}: nothing to keep`);
    assert.match(response.failed[0]?.error ?? "", message, `${mode}: says why, plainly`);
  }

  // ── A connection that can't edit draws a set: the face, eyes closed and mouth open in one sheet ──
  if (!realSource) {
    const matte = selectSpriteChromaMatte(APPEARANCE);
    const background = { r: matte.rgb.red, g: matte.rgb.green, b: matte.rgb.blue, alpha: 1 };
    const cell = async (svg: Buffer, dx: number, dy: number, scale = 1) => {
      const w = Math.round(WIDTH * scale);
      const h = Math.round(HEIGHT * scale);
      const face = await sharp(svg).resize(w, h).png().toBuffer();
      return sharp({ create: { width: 512, height: 512, channels: 4, background } })
        .composite([{ input: face, left: Math.round((512 - w) / 2) + dx, top: 14 + dy }])
        .flatten({ background })
        .png()
        .toBuffer();
    };
    // Drawn separately, each cell sits a little differently, as generated sheets do.
    const cells = [
      await cell(faceSvg(), 0, 0),
      await cell(faceSvg({ eyes: "closed" }), 7, 3),
      await cell(faceSvg({ mouth: "open" }), -4, -2, 0.98),
    ];
    sheetPng = await sharp({ create: { width: 1536, height: 512, channels: 4, background } })
      .composite(cells.map((input, index) => ({ input, left: index * 512, top: 0 })))
      .png()
      .toBuffer();
    // An old talk sprite, drawn for the old face.
    writeFileSync(join(spriteDir, "neutral_talk.png"), sourcePng);
    requests.length = 0;
    const response = await generatePngtuberVariants(db, {
      owner,
      labels: ["neutral"],
      variants: ["eyes-closed"],
      connectionId: drawing.id,
    });
    assert.deepEqual(
      requests.map((url) => url.replace(/^\/v1/u, "")),
      ["/images/generations"],
      "one picture is drawn, and the connection is never asked to edit",
    );
    assert.deepEqual(
      response.drafts.map((draft) => draft.variant),
      ["eyes-closed", "mouth-open"],
      "the set brings both pictures, whichever was asked for",
    );
    const face = dataUrlPng(response.drafts[0]!.face!);
    keepPicture("set-face", face);
    assert.equal(response.drafts[1]!.face, response.drafts[0]!.face, "both pictures share the new face");
    const faceRgba = await rgba(face);
    assert.deepEqual([faceRgba.width, faceRgba.height], [512, 512], "the face is one cell");
    assert.equal(faceRgba.data[3], 0, "the chroma matte is removed");
    assert.equal(faceRgba.data[(300 * 512 + 256) * 4 + 3], 255, "the face itself stays");
    for (const draft of response.drafts) {
      const png = dataUrlPng(draft.image);
      keepPicture(`set-${draft.variant}`, png);
      // The face sits 14 pixels down in its cell.
      await assertOnlyRegionChanged(png, face, draft.variant, `the set's ${draft.variant} picture`, 14);
      await assertChange(png, draft.variant, `the set's ${draft.variant} picture`, { x: 0, y: 14 });
    }

    // A picture of the old face can't be kept with the new one.
    await assert.rejects(
      savePngtuberVariants({
        owner,
        images: [{ ...response.drafts[0]! }, { ...response.drafts[1]!, face: undefined }],
      }),
      /together with its own blink and talk pictures/u,
    );
    // Keeping the set (here only its blink) makes the new face the expression's face; the old talk sprite,
    // drawn for the old face, goes with it. The sprite file is never changed.
    const saved = await savePngtuberVariants({ owner, images: [{ ...response.drafts[0]! }] });
    const layers = saved.config.kinds.pngtuber!.layers.neutral!;
    const file = (ref: unknown) => readFileSync(join(avatarOwnerDir(owner), (ref as { path: string }).path));
    assert.deepEqual((await rgba(file(layers.base))).data, faceRgba.data, "the new face is the base");
    assert.deepEqual(
      (await rgba(file(layers.eyesClosed))).data,
      (await rgba(dataUrlPng(response.drafts[0]!.image))).data,
      "the blink is the kept picture",
    );
    assert.equal(layers.mouthOpen, undefined, "a talk picture of the old face doesn't stay");
    assert.deepEqual(readFileSync(join(spriteDir, "neutral.png")), sourcePng, "the sprite file is untouched");
    assert.deepEqual((await readAvatarConfig(owner))?.kinds.pngtuber?.layers.neutral?.base, layers.base);

    // Without an appearance there is nothing to draw a set from.
    const blank = await createCharactersStorage(db).create(
      characterDataSchema.parse({ name: "Blank", description: "" }),
    );
    const blankOwner = { ownerType: "character" as const, ownerId: blank!.id };
    mkdirSync(join(dataDir, "sprites", blankOwner.ownerId), { recursive: true });
    writeFileSync(join(dataDir, "sprites", blankOwner.ownerId, "neutral.png"), sourcePng);
    await assert.rejects(
      generatePngtuberVariants(db, {
        owner: blankOwner,
        labels: ["neutral"],
        variants: ["mouth-open"],
        connectionId: drawing.id,
      }),
      /Add an appearance/u,
    );
  }
} finally {
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}
