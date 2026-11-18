// ──────────────────────────────────────────────
// Avatar import: PNGTuber Plus `.save` files (lane: 2D)
// ──────────────────────────────────────────────
// PNGTuber Plus (https://github.com/kaiakairos/PNGTuber-Plus, Unlicense) saves an avatar as one JSON object
// of sprites, each with a base64 PNG (`imageData`), a parent link, a position and offset, a z-index, the
// ten costume switches and talk/blink visibility. The loader and saver are main_scenes/main.gd:301-365 and
// :376-415; visibility comes from ui_scenes/selectedSprite/spriteObject.gd (talkBlink, setClip).
//
// The file is untrusted: every field is type-checked, sprites and costumes are bounded, PNGs are checked by
// signature and header before sharp decodes them, and the flattened canvas is scaled to fit a fixed side.
// Each distinct costume becomes one layer set (`costume_<n>`) flattened at rest (no wobble, drag or
// stretch) into a base picture plus mouth-open, eyes-closed and both variants when the save has them.
import { createHash } from "node:crypto";
import {
  AVATAR_EMOTIONS,
  AVATAR_IMPORT_EXTENSIONS,
  AvatarImportError,
  PNGTUBER_DEFAULT_MOTION,
  detectSpriteFeelingBindings,
  mapSpriteExpressionToAvatarEmotion,
  type AvatarEmotionWeight,
  type AvatarExpressionMap,
  type AvatarExtractedFile,
  type AvatarExtraFeeling,
  type AvatarFeelingMap,
  type AvatarFormatImporter,
  type PngtuberAvatarData,
  type PngtuberLayerSet,
} from "@marinara-engine/shared";
import { readImageDimensionsFromBuffer } from "../../../utils/image-metadata.js";
import { getSharp } from "../../../utils/sharp.js";
import { isRecord } from "../../../utils/large-json.js";

/** PNGTuber Plus avatars have tens of sprites; this only stops a hostile file from asking for thousands. */
const MAX_SPRITES = 512;
/** PNGTuber Plus has ten costume keys (1-9, 0). */
const COSTUME_COUNT = 10;
const MAX_ANIMATION_FRAMES = 256;
/** sharp's own default decode bound (16383 x 16383), checked from the PNG header before decoding. */
const MAX_IMAGE_SIDE = 16_383;
/** Flattened pictures fit this side; larger avatars are scaled down so phones can hold every variant. */
export const PNGTUBER_MAX_OUTPUT_SIDE = 2048;
/** Godot clamps canvas z-index to this range. */
const MAX_Z = 4096;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NUMBER_SOURCE = String.raw`[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?`;
const GODOT_VECTOR2 = new RegExp(String.raw`^Vector2i?\(\s*(${NUMBER_SOURCE})\s*,\s*(${NUMBER_SOURCE})\s*\)$`, "u");
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/u;

/** Talk and blink rules of one sprite: 0 always shows, 1 shows only when quiet / eyes open, 2 only when
 *  talking / blinking (spriteObject.gd talkBlink). */
type ShowRule = 0 | 1 | 2;

interface PlusSprite {
  id: number;
  parentId: number | null;
  /** File name the sprite was made from, without folders or extension (used to name costumes). */
  name: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  z: number;
  showTalk: ShowRule;
  showBlink: ShowRule;
  /** Visible in costume 1..10. */
  costumes: boolean[];
  frames: number;
  clipped: boolean;
  png: Buffer;
  width: number;
  height: number;
}

export interface ValidatedPngtuberSave {
  /** In load order: PNGTuber Plus writes keys sorted as strings and loads them in that order. */
  sprites: PlusSprite[];
  skippedWithoutImage: number;
  /** Short hash of the file, so a re-import gets new file names. */
  hash: string;
}

const NOT_A_SAVE = "This file isn't a PNGTuber Plus avatar save.";
const DAMAGED = "This PNGTuber Plus save is damaged, so it can't be imported.";

function refuse(message: string): never {
  throw new AvatarImportError("invalid-file", message);
}

function own(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number): number {
  const value = own(record, key);
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) refuse(DAMAGED);
  return value;
}

function readShowRule(record: Record<string, unknown>, key: string): ShowRule {
  const value = readNumber(record, key, 0);
  if (value !== 0 && value !== 1 && value !== 2) refuse(DAMAGED);
  return value;
}

/** Godot's var_to_str of a Vector2: `Vector2(72, -89)`. */
function readVector(record: Record<string, unknown>, key: string): [number, number] {
  const value = own(record, key);
  if (value === undefined || value === null) return [0, 0];
  const match = typeof value === "string" ? GODOT_VECTOR2.exec(value.trim()) : null;
  const x = Number(match?.[1]);
  const y = Number(match?.[2]);
  if (!match || !Number.isFinite(x) || !Number.isFinite(y)) refuse(DAMAGED);
  return [x, y];
}

/** Godot's var_to_str of the costume switches, `[1, 1, 0, ...]`; 1 shows the sprite in that costume. Older
 *  saves with fewer than eight entries get five more shown costumes, as PNGTuber Plus's loader does. */
function readCostumes(record: Record<string, unknown>): boolean[] {
  const value = own(record, "costumeLayers");
  if (value === undefined || value === null) return Array.from({ length: COSTUME_COUNT }, () => true);
  let entries: unknown[];
  if (Array.isArray(value)) {
    entries = value;
  } else if (typeof value === "string") {
    const inner = /^\[([^[\]]*)\]$/u.exec(value.trim())?.[1];
    if (inner === undefined) refuse(DAMAGED);
    entries = inner.trim()
      ? inner.split(",").map((part) => (/^\s*[-+]?\d+(?:\.\d+)?\s*$/u.test(part) ? Number(part) : NaN))
      : [];
  } else {
    refuse(DAMAGED);
  }
  if (entries.length > 64 || entries.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))) {
    refuse(DAMAGED);
  }
  const switches = entries as number[];
  if (switches.length < 8) switches.push(1, 1, 1, 1, 1);
  // A costume the list does not reach keeps the sprite visible, as it is when PNGTuber Plus first loads it.
  return Array.from({ length: COSTUME_COUNT }, (_, index) =>
    switches[index] === undefined ? true : switches[index] === 1,
  );
}

function readSpriteName(record: Record<string, unknown>): string {
  const path = own(record, "path");
  if (path === undefined || path === null) return "";
  if (typeof path !== "string") refuse(DAMAGED);
  const file = path.split(/[\\/]/u).pop() ?? "";
  return file.replace(/\.[^.]*$/u, "").slice(0, 128);
}

function decodeImage(value: unknown): { png: Buffer; width: number; height: number } | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") refuse(DAMAGED);
  const text = value.replace(/\s+/gu, "");
  if (!text || text.length % 4 === 1 || !BASE64.test(text))
    refuse("A picture inside this PNGTuber Plus save is damaged.");
  const png = Buffer.from(text, "base64");
  const size = png.subarray(0, 8).equals(PNG_SIGNATURE) ? readImageDimensionsFromBuffer(png) : null;
  if (!size) refuse("A picture inside this PNGTuber Plus save is damaged.");
  if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) {
    refuse("A picture inside this PNGTuber Plus save is too large to open.");
  }
  return { png, width: size.width, height: size.height };
}

export function parsePngtuberPlusSave(bytes: Uint8Array): ValidatedPngtuberSave {
  let data: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/u, "");
    data = JSON.parse(text);
  } catch {
    refuse(NOT_A_SAVE);
  }
  if (!isRecord(data)) refuse(NOT_A_SAVE);
  const keys = Object.keys(data).sort();
  if (keys.length === 0) refuse(NOT_A_SAVE);
  if (keys.length > MAX_SPRITES) refuse(`This PNGTuber Plus save has more than ${MAX_SPRITES} layers.`);

  const sprites: PlusSprite[] = [];
  const ids = new Set<number>();
  let skippedWithoutImage = 0;
  for (const key of keys) {
    const record = data[key];
    if (!isRecord(record)) refuse(NOT_A_SAVE);
    const type = own(record, "type");
    if (type !== undefined && type !== "sprite") continue;
    const id = own(record, "identification");
    if (typeof id !== "number" || !Number.isFinite(id)) refuse(NOT_A_SAVE);
    if (ids.has(id)) refuse(DAMAGED);
    ids.add(id);
    const parent = own(record, "parentId");
    if (parent !== undefined && parent !== null && (typeof parent !== "number" || !Number.isFinite(parent))) {
      refuse(DAMAGED);
    }
    const frames = readNumber(record, "frames", 1);
    if (!Number.isInteger(frames) || frames < 1 || frames > MAX_ANIMATION_FRAMES) refuse(DAMAGED);
    const clipped = own(record, "clipped") ?? false;
    if (typeof clipped !== "boolean") refuse(DAMAGED);
    const [x, y] = readVector(record, "pos");
    const [offsetX, offsetY] = readVector(record, "offset");
    const sprite = {
      id,
      parentId: typeof parent === "number" ? parent : null,
      name: readSpriteName(record),
      x,
      y,
      offsetX,
      offsetY,
      z: readNumber(record, "zindex", 0),
      showTalk: readShowRule(record, "showTalk"),
      showBlink: readShowRule(record, "showBlink"),
      costumes: readCostumes(record),
      frames,
      clipped,
    };
    const image = decodeImage(own(record, "imageData"));
    if (!image) {
      // Older saves keep only a path on the author's disk, which the file cannot carry.
      skippedWithoutImage += 1;
      continue;
    }
    sprites.push({ ...sprite, ...image });
  }
  if (sprites.length === 0) {
    refuse(
      skippedWithoutImage > 0
        ? "This PNGTuber Plus save has no pictures inside it. Save it again with a newer PNGTuber Plus and try once more."
        : NOT_A_SAVE,
    );
  }
  return { sprites, skippedWithoutImage, hash: createHash("sha256").update(bytes).digest("hex").slice(0, 10) };
}

// ── Flattening ──

interface PlacedSprite {
  sprite: PlusSprite;
  parent: PlacedSprite | null;
  children: PlacedSprite[];
  /** Pre-order position in the scene tree; breaks z ties as Godot's draw order does. */
  order: number;
  /** Absolute z after Godot's relative z-index. */
  z: number;
  /** Top-left of the drawn frame, in scene pixels. */
  left: number;
  top: number;
  frameWidth: number;
}

interface SceneTree {
  placed: PlacedSprite[];
  brokenLinks: number;
}

export function buildPngtuberScene(sprites: readonly PlusSprite[]): SceneTree {
  const byId = new Map(sprites.map((sprite) => [sprite.id, sprite]));
  let brokenLinks = 0;
  const parentOf = new Map<PlusSprite, PlusSprite | null>();
  for (const sprite of sprites) {
    const parent = sprite.parentId === null ? null : (byId.get(sprite.parentId) ?? null);
    if (sprite.parentId !== null && !parent) brokenLinks += 1;
    parentOf.set(sprite, parent);
  }
  // A loop of parent links has no root: the first sprite found on it is placed on its own.
  for (const sprite of sprites) {
    const seen = new Set<PlusSprite>();
    for (let cursor = parentOf.get(sprite) ?? null; cursor; cursor = parentOf.get(cursor) ?? null) {
      if (cursor === sprite) {
        parentOf.set(sprite, null);
        brokenLinks += 1;
        break;
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
    }
  }

  const nodes = new Map<PlusSprite, PlacedSprite>();
  const nodeFor = (sprite: PlusSprite): PlacedSprite => {
    let node = nodes.get(sprite);
    if (!node) {
      node = {
        sprite,
        parent: null,
        children: [],
        order: 0,
        z: 0,
        left: 0,
        top: 0,
        frameWidth: Math.floor(sprite.width / sprite.frames),
      };
      nodes.set(sprite, node);
    }
    return node;
  };
  const roots: PlacedSprite[] = [];
  for (const sprite of sprites) {
    const node = nodeFor(sprite);
    const parent = parentOf.get(sprite) ?? null;
    if (parent) {
      node.parent = nodeFor(parent);
      node.parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const placed: PlacedSprite[] = [];
  const visit = (node: PlacedSprite, originX: number, originY: number, parentZ: number) => {
    const x = originX + node.sprite.x;
    const y = originY + node.sprite.y;
    node.z = Math.max(-MAX_Z, Math.min(MAX_Z, parentZ + node.sprite.z));
    node.order = placed.length;
    node.left = Math.round(x + node.sprite.offsetX - node.frameWidth / 2);
    node.top = Math.round(y + node.sprite.offsetY - node.sprite.height / 2);
    placed.push(node);
    for (const child of node.children) visit(child, x, y, node.z);
  };
  for (const root of roots) visit(root, 0, 0, 0);
  return { placed, brokenLinks };
}

/** Shown in a costume: its own switch and every parent's (a hidden Godot node hides its children). */
function inCostume(node: PlacedSprite, costume: number): boolean {
  for (let cursor: PlacedSprite | null = node; cursor; cursor = cursor.parent) {
    if (!cursor.sprite.costumes[costume]) return false;
  }
  return true;
}

function passesRule(rule: ShowRule, active: boolean): boolean {
  return rule === 0 || (rule === 1 && !active) || (rule === 2 && active);
}

/** Drawn in a state: talk/blink rules hide only the sprite itself (self_modulate), never its children. */
export function isPngtuberSpriteDrawn(
  sprite: Pick<PlusSprite, "showTalk" | "showBlink">,
  talking: boolean,
  blinking: boolean,
): boolean {
  return passesRule(sprite.showTalk, talking) && passesRule(sprite.showBlink, blinking);
}

interface FlattenState {
  talking: boolean;
  blinking: boolean;
}

export interface PngtuberCostume {
  /** 1-based costume number, as PNGTuber Plus shows it. */
  number: number;
  members: PlacedSprite[];
  hasTalk: boolean;
  hasBlink: boolean;
}

/** The costumes that show something, with costumes identical to an earlier one dropped. */
export function distinctPngtuberCostumes(placed: readonly PlacedSprite[]): PngtuberCostume[] {
  const seen = new Set<string>();
  const costumes: PngtuberCostume[] = [];
  for (let costume = 0; costume < COSTUME_COUNT; costume += 1) {
    const members = placed.filter((node) => node.frameWidth > 0 && inCostume(node, costume));
    const signature = members.map((node) => node.order).join(",");
    if (members.length === 0 || seen.has(signature)) continue;
    seen.add(signature);
    costumes.push({
      number: costume + 1,
      members,
      hasTalk: members.some((node) => node.sprite.showTalk !== 0),
      hasBlink: members.some((node) => node.sprite.showBlink !== 0),
    });
  }
  return costumes;
}

/** Names of the sprites a costume shows that not every costume shows (`happy_eyes.png` in costume 2, say). */
function ownSpriteNames(costume: PngtuberCostume, all: readonly PngtuberCostume[]): string[] {
  return costume.members
    .filter((node) => !all.every((other) => other.members.includes(node)))
    .map((node) => node.sprite.name);
}

/** The emotion a costume's own sprites name most strongly. */
function costumeEmotion(costume: PngtuberCostume, all: readonly PngtuberCostume[]): AvatarEmotionWeight | null {
  let best: AvatarEmotionWeight | null = null;
  for (const name of ownSpriteNames(costume, all)) {
    const mapped = mapSpriteExpressionToAvatarEmotion(name);
    if (mapped && (!best || mapped.weight > best.weight)) best = mapped;
  }
  return best;
}

export function bindPngtuberCostumes(costumes: readonly PngtuberCostume[]): {
  expressionMap: AvatarExpressionMap;
  feelingMap: AvatarFeelingMap;
  unbound: number;
} {
  const expressionMap: AvatarExpressionMap = {};
  const emotions = costumes.map((costume) => costumeEmotion(costume, costumes));
  for (const emotion of AVATAR_EMOTIONS) {
    let bestIndex = -1;
    emotions.forEach((mapped, index) => {
      if (mapped?.emotion === emotion && (bestIndex < 0 || mapped.weight > emotions[bestIndex]!.weight))
        bestIndex = index;
    });
    expressionMap[emotion] =
      bestIndex >= 0
        ? { target: costumeKey(costumes[bestIndex]!), source: "name-match", confidence: emotions[bestIndex]!.weight }
        : emotion === "neutral" && costumes[0]
          ? // PNGTuber Plus opens on the first costume, so it stands in for the resting face.
            { target: costumeKey(costumes[0]), source: "preset", confidence: 1 }
          : { target: null, source: "missing", confidence: 0 };
  }
  // Extra feelings: the costume whose own sprites name the feeling best (`scared eyes.png` → fear).
  const feelingMap: AvatarFeelingMap = {};
  for (const costume of costumes) {
    for (const [feeling, found] of Object.entries(detectSpriteFeelingBindings(ownSpriteNames(costume, costumes)))) {
      const current = feelingMap[feeling as AvatarExtraFeeling];
      if (found && (!current || found.confidence > current.confidence)) {
        feelingMap[feeling as AvatarExtraFeeling] = {
          target: costumeKey(costume),
          source: "name-match",
          confidence: found.confidence,
        };
      }
    }
  }
  const targets = new Set([...Object.values(expressionMap), ...Object.values(feelingMap)].map((b) => b?.target));
  return {
    expressionMap,
    feelingMap,
    unbound: costumes.filter((costume) => !targets.has(costumeKey(costume))).length,
  };
}

function costumeKey(costume: PngtuberCostume): string {
  return `costume_${costume.number}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sharp = any;

interface Canvas {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

interface Area {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A picture placed on the output canvas, `width` x `height` pixels at `left`, `top`. */
interface CompositeInput extends Area {
  input: Buffer;
  raw?: { width: number; height: number; channels: 4 };
}

/** One sprite's first animation frame, scaled for the output canvas, cached per sprite. */
async function framePicture(
  sharp: Sharp,
  node: PlacedSprite,
  canvas: Canvas,
  cache: Map<PlacedSprite, CompositeInput | null>,
): Promise<CompositeInput | null> {
  if (cache.has(node)) return cache.get(node)!;
  const left = Math.round((node.left - canvas.left) * canvas.scale);
  const top = Math.round((node.top - canvas.top) * canvas.scale);
  const width = Math.min(canvas.width - left, Math.max(0, Math.round(node.frameWidth * canvas.scale)));
  const height = Math.min(canvas.height - top, Math.max(0, Math.round(node.sprite.height * canvas.scale)));
  let picture: CompositeInput | null = null;
  if (width > 0 && height > 0) {
    let pipeline = sharp(node.sprite.png, { limitInputPixels: MAX_IMAGE_SIDE * MAX_IMAGE_SIDE });
    if (node.sprite.frames > 1) {
      pipeline = pipeline.extract({ left: 0, top: 0, width: node.frameWidth, height: node.sprite.height });
    }
    if (width !== node.frameWidth || height !== node.sprite.height) {
      pipeline = pipeline.resize(width, height, { fit: "fill" });
    }
    picture = { input: await pipeline.ensureAlpha().png().toBuffer(), left, top, width, height };
  }
  cache.set(node, picture);
  return picture;
}

interface Overlay {
  input: Buffer;
  left: number;
  top: number;
  raw?: CompositeInput["raw"];
  blend?: string;
}

/** A transparent picture the size of an area, to draw overlays on (in order, in one pass). */
function blankArea(sharp: Sharp, area: Area) {
  return sharp({
    create: { width: area.width, height: area.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });
}

/** Pictures as overlays of one area of the output canvas. Each is cut to the area first, since sharp refuses a
 *  picture larger than what it is drawn on, so the work never exceeds the area and the pictures' own size. */
async function overlaysIn(sharp: Sharp, area: Area, inputs: readonly CompositeInput[]): Promise<Overlay[]> {
  const placed: Overlay[] = [];
  for (const item of inputs) {
    const left = Math.max(item.left, area.left);
    const top = Math.max(item.top, area.top);
    const width = Math.min(item.left + item.width, area.left + area.width) - left;
    const height = Math.min(item.top + item.height, area.top + area.height) - top;
    if (width <= 0 || height <= 0) continue;
    let { input, raw } = item;
    if (width !== item.width || height !== item.height) {
      input = await sharp(item.input, raw ? { raw } : {})
        .extract({ left: left - item.left, top: top - item.top, width, height })
        .raw()
        .toBuffer();
      raw = { width, height, channels: 4 };
    }
    placed.push({ input, raw, left: left - area.left, top: top - area.top });
  }
  return placed;
}

/** Draws one group in Godot's order: by absolute z, then tree order. A sprite with `clipped` set draws its
 *  descendants only inside its own picture (CLIP_CHILDREN_AND_DRAW), as one item at its own place. */
async function drawGroup(
  sharp: Sharp,
  canvas: Canvas,
  state: FlattenState,
  members: ReadonlySet<PlacedSprite>,
  nodes: readonly PlacedSprite[],
  cache: Map<PlacedSprite, CompositeInput | null>,
): Promise<CompositeInput[]> {
  const items = [...nodes].sort((a, b) => a.z - b.z || a.order - b.order);
  const inputs: CompositeInput[] = [];
  for (const node of items) {
    const drawn = isPngtuberSpriteDrawn(node.sprite, state.talking, state.blinking);
    const picture = drawn ? await framePicture(sharp, node, canvas, cache) : null;
    if (!node.sprite.clipped) {
      if (picture) inputs.push(picture);
      continue;
    }
    // A clipping sprite that is hidden in this state leaves nothing for its descendants to show through.
    if (!picture) continue;
    inputs.push(picture);
    const descendants = clippedDescendants(node, members);
    if (descendants.length === 0) continue;
    const inner = await drawGroup(sharp, canvas, state, members, descendants, cache);
    if (inner.length === 0) continue;
    // Nothing shows outside the clipping picture, so its descendants are drawn only inside its rectangle and
    // cut to its shape there, in one pass: the cost follows the picture's size, not the canvas's.
    const masked = await blankArea(sharp, picture)
      .composite([
        ...(await overlaysIn(sharp, picture, inner)),
        { input: picture.input, left: 0, top: 0, blend: "dest-in" },
      ])
      .raw()
      .toBuffer();
    const raw = { width: picture.width, height: picture.height, channels: 4 as const };
    inputs.push({
      input: masked,
      raw,
      left: picture.left,
      top: picture.top,
      width: picture.width,
      height: picture.height,
    });
  }
  return inputs;
}

/** Descendants drawn by a clipping sprite's group: every descendant in the costume, except those inside a
 *  nested clipping sprite, which that sprite's own group draws. */
function clippedDescendants(node: PlacedSprite, members: ReadonlySet<PlacedSprite>): PlacedSprite[] {
  const result: PlacedSprite[] = [];
  const walk = (parent: PlacedSprite) => {
    for (const child of parent.children) {
      if (!members.has(child)) continue;
      result.push(child);
      if (!child.sprite.clipped) walk(child);
    }
  };
  walk(node);
  return result;
}

/** Top-level items: sprites without a clipping ancestor (clipping sprites draw their own descendants). */
function topLevel(members: readonly PlacedSprite[]): PlacedSprite[] {
  return members.filter((node) => {
    for (let cursor = node.parent; cursor; cursor = cursor.parent) if (cursor.sprite.clipped) return false;
    return true;
  });
}

export async function flattenPngtuberState(
  sharp: Sharp,
  canvas: Canvas,
  costume: PngtuberCostume,
  talking: boolean,
  blinking: boolean,
  cache: Map<PlacedSprite, CompositeInput | null>,
): Promise<Buffer> {
  const members = new Set(costume.members);
  const state = { talking, blinking };
  const inputs = await drawGroup(sharp, canvas, state, members, topLevel(costume.members), cache);
  const area = { left: 0, top: 0, width: canvas.width, height: canvas.height };
  return blankArea(sharp, area)
    .composite(await overlaysIn(sharp, area, inputs))
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function pngtuberCanvas(costumes: readonly PngtuberCostume[]): Canvas {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const costume of costumes) {
    for (const node of costume.members) {
      left = Math.min(left, node.left);
      top = Math.min(top, node.top);
      right = Math.max(right, node.left + node.frameWidth);
      bottom = Math.max(bottom, node.top + node.sprite.height);
    }
  }
  const sourceWidth = right - left;
  const sourceHeight = bottom - top;
  const scale = Math.min(1, PNGTUBER_MAX_OUTPUT_SIDE / sourceWidth, PNGTUBER_MAX_OUTPUT_SIDE / sourceHeight);
  return {
    left,
    top,
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    scale,
  };
}

export const pngtuberImporter: AvatarFormatImporter<"pngtuber", ValidatedPngtuberSave> = {
  kind: "pngtuber",
  extensions: AVATAR_IMPORT_EXTENSIONS.pngtuber,
  detect({ filename, head }) {
    if (!filename.toLowerCase().endsWith(".save")) return false;
    let index = head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf ? 3 : 0;
    while (
      index < head.length &&
      (head[index] === 0x20 || head[index] === 0x09 || head[index] === 0x0a || head[index] === 0x0d)
    ) {
      index += 1;
    }
    return head[index] === 0x7b; // "{"
  },
  async validate(input) {
    return parsePngtuberPlusSave(input.bytes);
  },
  async extract(validated) {
    const sharp = await getSharp();
    if (!sharp) {
      throw new AvatarImportError(
        "unsupported-format",
        "Image processing isn't available on this device, so PNGTuber Plus saves can't be imported here.",
      );
    }
    const scene = buildPngtuberScene(validated.sprites);
    const costumes = distinctPngtuberCostumes(scene.placed);
    if (costumes.length === 0) refuse("This PNGTuber Plus save has no costume that shows a picture.");
    const canvas = pngtuberCanvas(costumes);
    const cache = new Map<PlacedSprite, CompositeInput | null>();
    const files: AvatarExtractedFile[] = [];
    const layers: Record<string, PngtuberLayerSet> = {};
    const write = async (costume: PngtuberCostume, suffix: string, talking: boolean, blinking: boolean) => {
      const path = `pngtuber/plus-${validated.hash}-${costume.number}${suffix}.png`;
      files.push({ path, bytes: await flattenPngtuberState(sharp, canvas, costume, talking, blinking, cache) });
      return { source: "file" as const, path };
    };
    try {
      for (const costume of costumes) {
        const set: PngtuberLayerSet = { base: await write(costume, "", false, false) };
        if (costume.hasTalk) set.mouthOpen = await write(costume, "-talk", true, false);
        if (costume.hasBlink) set.eyesClosed = await write(costume, "-blink", false, true);
        if (costume.hasTalk && costume.hasBlink)
          set.eyesClosedMouthOpen = await write(costume, "-blink-talk", true, true);
        layers[costumeKey(costume)] = set;
      }
    } catch (error) {
      if (error instanceof AvatarImportError) throw error;
      refuse("A picture inside this PNGTuber Plus save is damaged.");
    }

    const { expressionMap, feelingMap, unbound } = bindPngtuberCostumes(costumes);
    const warnings: string[] = [];
    if (validated.skippedWithoutImage > 0) {
      warnings.push("Some layers had no picture saved in the file, so they were left out.");
    }
    if (scene.brokenLinks > 0) {
      warnings.push("Some layers were linked to a layer that isn't in the file, so they were placed on their own.");
    }
    if (validated.sprites.some((sprite) => sprite.frames > 1)) {
      warnings.push("Animated layers show only their first frame.");
    }
    if (canvas.scale < 1) warnings.push("The avatar was scaled down so it loads quickly.");
    if (unbound > 0) {
      warnings.push("Some costumes didn't match a feeling by name. You can choose a costume for each feeling.");
    }
    const data: PngtuberAvatarData = {
      layers,
      expressionMap,
      feelingMap,
      motion: { ...PNGTUBER_DEFAULT_MOTION },
      source: "pngtuber-plus",
    };
    return { kind: "pngtuber", files, data, detected: expressionMap, warnings };
  },
};
