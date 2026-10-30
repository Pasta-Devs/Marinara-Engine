// PMX models and VMD motions stay local: only checked archive resources reach the avatar file route.
import { createHash } from "node:crypto";
import { posix } from "node:path";
import { Parser } from "mmd-parser";
import {
  AVATAR_IMPORT_EXTENSIONS,
  AVATAR_MMD_METADATA_LIMITS,
  AvatarImportError,
  type AvatarExpressionMap,
  type AvatarExtractedFile,
  type AvatarExtractedImport,
  type AvatarFormatImporter,
  type AvatarImportInput,
  type MmdAvatarData,
} from "@marinara-engine/shared";
import { openZipArchive, ZipArchiveError } from "../../../lib/zip-reader.js";
import { validateImageAssetBuffer } from "../../../utils/media-file-security.js";
import { readImageDimensionsFromBuffer } from "../../../utils/image-metadata.js";
import { AVATAR_IMPORT_MAX_BYTES, readAvatarConfig, readAvatarFile } from "../storage.js";

export const MMD_MODEL_FILE = "mmd/model.pmx";
export const MMD_IDLE_ANIMATION_FILE = "mmd/idle.vmd";
const DAMAGED = "This MMD file is damaged or contains unsupported records, so it can't be imported.";
const TOO_LARGE = "This MMD model is too large once unpacked, so it can't be imported.";
/** Runtime work limits, not upload limits: pathological rigs otherwise freeze the chat on every frame. */
export const MMD_MAX_IK_ITERATIONS = 1024;
const MAX_IK_LINKS = 256;
const MAX_IK_WORK = 1_000_000;
const MAX_HIERARCHY_DEPTH = 256;

function refuse(message = DAMAGED): never {
  throw new AvatarImportError("invalid-file", message);
}

/** A cursor checks lengths before loops, with no allocation based on an untrusted count. */
class Cursor {
  offset = 0;
  constructor(readonly bytes: Buffer) {}
  take(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.bytes.length - this.offset) refuse();
    const start = this.offset;
    this.offset += size;
    return start;
  }
  u8() {
    return this.bytes.readUInt8(this.take(1));
  }
  u16() {
    return this.bytes.readUInt16LE(this.take(2));
  }
  u32() {
    return this.bytes.readUInt32LE(this.take(4));
  }
  i32() {
    return this.bytes.readInt32LE(this.take(4));
  }
  count(minimumBytes: number) {
    const count = this.i32();
    if (count < 0 || count > Math.floor((this.bytes.length - this.offset) / minimumBytes)) refuse();
    return count;
  }
  index(size: number, unsigned = false) {
    const offset = this.take(size);
    return size === 1
      ? unsigned
        ? this.bytes.readUInt8(offset)
        : this.bytes.readInt8(offset)
      : size === 2
        ? unsigned
          ? this.bytes.readUInt16LE(offset)
          : this.bytes.readInt16LE(offset)
        : unsigned
          ? this.bytes.readUInt32LE(offset)
          : this.bytes.readInt32LE(offset);
  }
}

const inRange = (value: number, count: number, nullable = false) =>
  Number.isInteger(value) && ((nullable && value === -1) || (value >= 0 && value < count));

/** Walk record boundaries, not geometry: the published parser does the model decoding. Its PMX text
 * decoder only understands UTF-16, so UTF-8 text spans alone are re-encoded before storage and playback. */
export function checkedPmx(bytes: Uint8Array): { bytes: Buffer; textures: string[]; normalized: boolean } {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const c = new Cursor(buffer);
  if (buffer.length < 17 || buffer.subarray(0, 4).toString() !== "PMX ") refuse();
  const version = buffer.readFloatLE(4);
  if (version !== 2 && version !== Math.fround(2.1)) refuse();
  c.take(8);
  if (c.u8() !== 8) refuse();
  const encoding = c.u8();
  const additionalUv = c.u8();
  if ((encoding !== 0 && encoding !== 1) || additionalUv > 4) refuse();
  const sizes = Array.from({ length: 6 }, () => c.u8());
  if (sizes.some((size) => size !== 1 && size !== 2 && size !== 4)) refuse();
  const [vertexSize, textureSize, materialSize, boneSize, morphSize, rigidSize] = sizes as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const texts: { start: number; end: number; value: string }[] = [];
  const decoder = new TextDecoder(encoding === 1 ? "utf-8" : "utf-16le", { fatal: true });
  const text = () => {
    const start = c.offset;
    const length = c.u32();
    if (encoding === 0 && length % 2 !== 0) refuse();
    const from = c.take(length);
    let value: string;
    try {
      value = decoder.decode(buffer.subarray(from, c.offset));
    } catch {
      refuse();
    }
    if (value.includes("\0")) refuse();
    texts.push({ start, end: c.offset, value });
    return value;
  };
  const repeat = (minimumBytes: number, read: () => void) => {
    const count = c.count(minimumBytes);
    for (let i = 0; i < count; i += 1) read();
    return count;
  };
  for (let i = 0; i < 4; i += 1) text();
  let largestSkinBone = -1;
  const vertices = repeat(38 + 16 * additionalUv, () => {
    c.take(32 + 16 * additionalUv);
    const type = c.u8();
    // ponytail: the pinned MMD parser supports BDEF1/2/4 and SDEF, not PMX2.1 QDEF.
    if (type > 3) refuse("This PMX uses QDEF skinning, which the MMD player doesn't support yet.");
    const bones = type === 0 ? 1 : type === 2 ? 4 : 2;
    for (let i = 0; i < bones; i += 1) {
      const index = c.index(boneSize);
      if (index < -1) refuse();
      largestSkinBone = Math.max(largestSkinBone, index);
    }
    c.take(type === 0 ? 0 : type === 2 ? 16 : type === 3 ? 40 : 4);
    c.take(4);
  });
  const indices = c.count(vertexSize);
  if (indices % 3 !== 0) refuse();
  for (let i = 0; i < indices; i += 1) if (!inRange(c.index(vertexSize, true), vertices)) refuse();
  const textures: string[] = [];
  repeat(4, () => {
    textures.push(text());
  });
  let materialIndices = 0;
  const materials = repeat(84 + 2 * textureSize, () => {
    text();
    text();
    c.take(65);
    if (!inRange(c.index(textureSize), textures.length, true)) refuse();
    if (!inRange(c.index(textureSize), textures.length, true)) refuse();
    if (c.u8() > 3) refuse();
    const toon = c.u8();
    if (toon === 0) {
      if (!inRange(c.index(textureSize), textures.length, true)) refuse();
    } else if (toon === 1) {
      if (c.u8() > 9) refuse();
    } else refuse();
    text();
    const count = c.i32();
    if (count < 0 || count % 3 !== 0) refuse();
    materialIndices += count;
  });
  if (materialIndices !== indices || vertices === 0 || indices === 0 || materials === 0) refuse();
  const boneCount = c.count(27 + boneSize);
  if (boneCount === 0 || largestSkinBone >= boneCount) refuse();
  const boneParents: number[] = [];
  let ikWork = 0;
  for (let i = 0; i < boneCount; i += 1) {
    text();
    text();
    c.take(12);
    const parent = c.index(boneSize);
    if (!inRange(parent, boneCount, true) || parent === i) refuse();
    boneParents.push(parent);
    c.take(4);
    const flags = c.u16();
    if (flags & 1) {
      if (!inRange(c.index(boneSize), boneCount, true)) refuse();
    } else c.take(12);
    if (flags & 0x300) {
      if (!inRange(c.index(boneSize), boneCount, true)) refuse();
      c.take(4);
    }
    if (flags & 0x400) c.take(12);
    if (flags & 0x800) c.take(24);
    if (flags & 0x2000) c.take(4);
    if (flags & 0x20) {
      if (!inRange(c.index(boneSize), boneCount)) refuse();
      const iterations = c.u32();
      if (iterations > MMD_MAX_IK_ITERATIONS) refuse("This MMD model requests too many IK iterations to play safely.");
      c.take(4);
      const links = c.count(boneSize + 1);
      ikWork += iterations * links;
      if (links > MAX_IK_LINKS || ikWork > MAX_IK_WORK)
        refuse("This MMD model's IK rig is too detailed to play safely.");
      for (let link = 0; link < links; link += 1) {
        if (!inRange(c.index(boneSize), boneCount)) refuse();
        const limited = c.u8();
        if (limited > 1) refuse();
        if (limited) c.take(24);
      }
    }
  }
  // Three builds a parent hierarchy recursively. Reject cycles before they reach the renderer.
  const boneDepths = new Map<number, number>();
  for (let i = 0; i < boneCount; i += 1) {
    const path = new Set<number>();
    let bone = i;
    for (; bone !== -1 && !boneDepths.has(bone); bone = boneParents[bone]!) {
      if (path.has(bone)) refuse();
      path.add(bone);
      if (path.size > MAX_HIERARCHY_DEPTH) refuse("This MMD model's bone hierarchy is too deep to play safely.");
    }
    let depth = boneDepths.get(bone) ?? 0;
    for (const parent of [...path].reverse()) {
      depth += 1;
      if (depth > MAX_HIERARCHY_DEPTH) refuse("This MMD model's bone hierarchy is too deep to play safely.");
      boneDepths.set(parent, depth);
    }
  }
  const morphCount = c.count(14);
  // The runtime allocates one full XYZ Float32 target per morph, even for a sparse/empty morph.
  // Bound that mandatory decoded allocation by the existing upload budget, not a smaller file cap.
  const morphBytes = vertices * morphCount * 3 * Float32Array.BYTES_PER_ELEMENT;
  if (!Number.isSafeInteger(morphBytes) || morphBytes > AVATAR_IMPORT_MAX_BYTES) {
    refuse("This MMD model's decoded morph targets need too much memory to play safely.");
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < morphCount; i += 1) {
    text();
    text();
    if (c.u8() > 4) refuse();
    const type = c.u8();
    if (type > 8) refuse("This PMX uses flip or impulse morphs, which the MMD player doesn't support yet.");
    const size =
      type === 0
        ? morphSize + 4
        : type === 1
          ? vertexSize + 12
          : type === 2
            ? boneSize + 28
            : type === 8
              ? materialSize + 113
              : vertexSize + 16;
    repeat(size, () => {
      const index = c.index(
        type === 0 ? morphSize : type === 2 ? boneSize : type === 8 ? materialSize : vertexSize,
        type !== 0 && type !== 2 && type !== 8,
      );
      if (
        !inRange(
          index,
          type === 0 ? morphCount : type === 2 ? boneCount : type === 8 ? materials : vertices,
          type === 8,
        )
      )
        refuse();
      if (type === 0) {
        if (index === i) refuse();
        const links = groups.get(i) ?? [];
        links.push(index);
        groups.set(i, links);
      }
      c.take(size - (type === 0 ? morphSize : type === 2 ? boneSize : type === 8 ? materialSize : vertexSize));
    });
  }
  // Group morph nesting is recursively expanded by the loader; a cycle has no playable meaning.
  const groupDepths = new Map<number, number>();
  const active = new Set<number>();
  for (const index of groups.keys()) {
    const stack = [{ index, leave: false }];
    while (stack.length) {
      const frame = stack.pop()!;
      if (frame.leave) {
        let depth = 1;
        for (const next of groups.get(frame.index) ?? []) depth = Math.max(depth, 1 + (groupDepths.get(next) ?? 0));
        if (depth > MAX_HIERARCHY_DEPTH) refuse("This MMD model's group morph hierarchy is too deep to play safely.");
        active.delete(frame.index);
        groupDepths.set(frame.index, depth);
        continue;
      }
      if (active.has(frame.index)) refuse();
      if (groupDepths.has(frame.index)) continue;
      active.add(frame.index);
      stack.push({ index: frame.index, leave: true });
      if (active.size > MAX_HIERARCHY_DEPTH)
        refuse("This MMD model's group morph hierarchy is too deep to play safely.");
      for (const next of groups.get(frame.index) ?? []) stack.push({ index: next, leave: false });
    }
  }
  repeat(13, () => {
    text();
    text();
    if (c.u8() > 1) refuse();
    repeat(2, () => {
      const type = c.u8();
      if (type > 1 || !inRange(c.index(type === 0 ? boneSize : morphSize), type === 0 ? boneCount : morphCount))
        refuse();
    });
  });
  const rigidBodies = repeat(69 + boneSize, () => {
    text();
    text();
    if (!inRange(c.index(boneSize), boneCount, true)) refuse();
    c.take(3);
    if (c.u8() > 2) refuse();
    c.take(56);
    if (c.u8() > 2) refuse();
  });
  repeat(105 + 2 * rigidSize, () => {
    text();
    text();
    if (c.u8() !== 0) refuse();
    if (!inRange(c.index(rigidSize), rigidBodies, true) || !inRange(c.index(rigidSize), rigidBodies, true)) refuse();
    c.take(96);
  });
  const recordsEnd = c.offset;
  if (c.offset < buffer.length && version > 2) {
    if (c.u32() !== 0) refuse("PMX soft bodies aren't supported by the MMD player yet.");
  }
  if (c.offset !== buffer.length) refuse();
  if (encoding === 0 && version === 2) return { bytes: buffer, textures, normalized: false };
  const parts: Buffer[] = [];
  const header = Buffer.from(buffer.subarray(0, 17));
  header[9] = 0;
  // The pinned parser compares binary float2.1 with the decimal2.1 exactly. Only2.0-compatible
  // records got this far, so emit2.0 (and omit an empty2.1 softbody section) without changing geometry.
  header.writeFloatLE(2, 4);
  parts.push(header);
  let end = 17;
  let total = 17;
  for (const span of texts) {
    const data = Buffer.from(span.value, "utf16le");
    const length = Buffer.alloc(4);
    length.writeUInt32LE(data.length);
    total += span.start - end + 4 + data.length;
    if (total > AVATAR_IMPORT_MAX_BYTES) refuse(TOO_LARGE);
    parts.push(buffer.subarray(end, span.start), length, data);
    end = span.end;
  }
  total += recordsEnd - end;
  if (total > AVATAR_IMPORT_MAX_BYTES) refuse(TOO_LARGE);
  parts.push(buffer.subarray(end, recordsEnd));
  return { bytes: Buffer.concat(parts), textures, normalized: true };
}

function finiteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteNumbers);
  return value === null || typeof value !== "object" || Object.values(value).every(finiteNumbers);
}

function parseModel(bytes: Uint8Array) {
  const checked = checkedPmx(bytes);
  try {
    const model = new Parser().parsePmx(
      checked.bytes.buffer.slice(
        checked.bytes.byteOffset,
        checked.bytes.byteOffset + checked.bytes.byteLength,
      ) as ArrayBuffer,
    );
    if (!finiteNumbers(model)) refuse();
    const boneNames = model.bones.map((bone) => bone.name);
    const morphNames = model.morphs.map((morph) => morph.name);
    if (
      boneNames.some((name) => !name) ||
      new Set(boneNames).size !== boneNames.length ||
      morphNames.some((name) => !name) ||
      new Set(morphNames).size !== morphNames.length
    ) {
      refuse("This PMX has empty or duplicate bone/morph names, so animation bindings would be ambiguous.");
    }
    return { ...checked, model };
  } catch (error) {
    if (error instanceof AvatarImportError) throw error;
    refuse();
  }
}

function parseMotion(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const c = new Cursor(buffer);
  if (
    buffer.length < 62 ||
    buffer.subarray(0, 30).toString("ascii").replace(/\0.*$/u, "") !== "Vocaloid Motion Data 0002"
  )
    refuse();
  c.take(50);
  for (const size of [111, 23, 61, 28, 9]) {
    if (c.offset === buffer.length && size !== 111 && size !== 23 && size !== 61) break;
    const count = c.count(size);
    c.take(count * size);
  }
  if (c.offset < buffer.length) {
    const count = c.count(9);
    for (let i = 0; i < count; i += 1) {
      c.take(5);
      const names = c.count(21);
      c.take(names * 21);
    }
  }
  if (c.offset !== buffer.length) refuse();
  try {
    const motion = new Parser().parseVmd(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    if (!finiteNumbers(motion) || motion.motions.length + motion.morphs.length === 0)
      refuse("This VMD has no model motion or face animation.");
    return motion;
  } catch (error) {
    if (error instanceof AvatarImportError) throw error;
    refuse();
  }
}

/** Raster-only MMD textures. BMP/TGA are normal MMD assets, but never grant script/SVG serving. */
export function mmdTextureMime(bytes: Buffer, filename: string, fileSize = bytes.length): string | null {
  const extension = posix.extname(filename).toLowerCase();
  const standard = validateImageAssetBuffer(bytes, [".sph", ".spa"].includes(extension) ? "texture.png" : filename);
  if (standard && !standard.isSvg) {
    const size = readImageDimensionsFromBuffer(bytes);
    // Serving sniffs a short header; JPEG/WebP dimensions can follow large metadata blocks. Imports
    // always pass complete bytes, so unknown dimensions still fail before anything is stored.
    if (!size && fileSize > bytes.length) return standard.mimeType;
    if (
      !size ||
      !Number.isSafeInteger(size.width * size.height * 4) ||
      size.width * size.height * 4 > AVATAR_IMPORT_MAX_BYTES
    )
      return null;
    return standard.mimeType;
  }
  if ([".bmp", ".sph", ".spa"].includes(extension) && bytes.length >= 54 && bytes.toString("ascii", 0, 2) === "BM") {
    const width = bytes.readInt32LE(18),
      height = Math.abs(bytes.readInt32LE(22));
    const offset = bytes.readUInt32LE(10),
      header = bytes.readUInt32LE(14);
    const depth = bytes.readUInt16LE(28),
      compression = bytes.readUInt32LE(30);
    if (
      width > 0 &&
      height > 0 &&
      width * height * 4 <= AVATAR_IMPORT_MAX_BYTES &&
      header >= 40 &&
      offset >= 14 + header &&
      offset <= fileSize &&
      bytes.readUInt16LE(26) === 1 &&
      [1, 4, 8, 16, 24, 32].includes(depth) &&
      [0, 3].includes(compression) &&
      (compression !== 0 || offset + Math.ceil((width * depth) / 32) * 4 * height <= fileSize)
    )
      return "image/bmp";
  }
  if (extension === ".tga" && bytes.length >= 18) {
    const type = bytes[2]!,
      depth = bytes[16]!,
      width = bytes.readUInt16LE(12),
      height = bytes.readUInt16LE(14);
    const palette = bytes[1] === 1 ? bytes.readUInt16LE(5) * Math.ceil(bytes[7]! / 8) : 0;
    const offset = 18 + bytes[0]! + palette;
    if (
      bytes[1]! <= 1 &&
      [1, 2, 3, 9, 10, 11].includes(type) &&
      [8, 16, 24, 32].includes(depth) &&
      width > 0 &&
      height > 0 &&
      width * height * 4 <= AVATAR_IMPORT_MAX_BYTES &&
      offset < fileSize &&
      (type >= 9 || offset + (width * height * depth) / 8 <= fileSize)
    ) {
      if ((type === 1 || type === 9) && bytes[1] !== 1) return null;
      if (bytes.length === fileSize && type >= 9) {
        let cursor = offset,
          pixels = 0;
        while (pixels < width * height) {
          if (cursor >= bytes.length) return null;
          const packet = bytes[cursor++]!,
            count = (packet & 0x7f) + 1;
          pixels += count;
          cursor += ((packet & 0x80 ? 1 : count) * depth) / 8;
          if (pixels > width * height || cursor > bytes.length) return null;
        }
      }
      return "image/x-tga";
    }
  }
  return null;
}

function archivePath(value: string, base = ""): string {
  const path = value.replaceAll("\\", "/");
  if (!path || /[\0-\x1f]/u.test(path) || path.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(path))
    refuse("MMD textures must be local files inside the model archive.");
  const normalized = posix.normalize(posix.join(base, path));
  if (normalized === ".." || normalized.startsWith("../")) refuse("An MMD texture points outside the model archive.");
  return normalized;
}

type ModelImport = ReturnType<typeof parseModel> & {
  kind: "model";
  files: AvatarExtractedFile[];
  texturePaths: Record<string, string>;
  idle?: Buffer;
};
type MotionImport = { kind: "motion"; bytes: Buffer };
type ValidatedMmd = ModelImport | MotionImport;

function modelImport(bytes: Uint8Array, source: string, entries?: Map<string, Buffer>): ModelImport {
  const parsed = parseModel(bytes);
  const files: AvatarExtractedFile[] = [{ path: MMD_MODEL_FILE, bytes: parsed.bytes }];
  const texturePaths: Record<string, string> = Object.create(null) as Record<string, string>;
  const aliases = new Map<string, string>();
  const assets = new Map<string, string>();
  let total = parsed.bytes.length;
  let decodedTextures = 0;
  const references = new Set<string>();
  for (const texture of parsed.textures) {
    references.add(texture);
    if (
      texture.length > AVATAR_MMD_METADATA_LIMITS.textureReferenceChars ||
      references.size > AVATAR_MMD_METADATA_LIMITS.textures
    )
      refuse("This MMD model has too many textures or a texture path is too long.");
    const name = archivePath(texture, posix.dirname(source));
    const raw = entries?.get(name);
    if (!raw)
      refuse(
        `The model's texture ${JSON.stringify(texture.slice(0, 100))} is missing. Import a ZIP with its textures.`,
      );
    const mime = mmdTextureMime(raw, name);
    if (!mime) refuse(`The MMD texture ${JSON.stringify(texture.slice(0, 100))} isn't a supported raster image.`);
    const alias = texture.replaceAll("\\", "/");
    if (aliases.has(alias) && aliases.get(alias) !== name) refuse("This model has ambiguous texture references.");
    aliases.set(alias, name);
    let stored = assets.get(name);
    if (!stored) {
      const size =
        readImageDimensionsFromBuffer(raw) ??
        (mime === "image/bmp"
          ? { width: raw.readInt32LE(18), height: Math.abs(raw.readInt32LE(22)) }
          : { width: raw.readUInt16LE(12), height: raw.readUInt16LE(14) });
      decodedTextures += size.width * size.height * 4;
      if (!Number.isSafeInteger(decodedTextures) || decodedTextures > AVATAR_IMPORT_MAX_BYTES)
        refuse("This MMD model's pictures need too much memory to play safely.");
      const extension =
        mime === "image/x-tga"
          ? ".tga"
          : mime === "image/bmp"
            ? ".bmp"
            : mime === "image/jpeg"
              ? ".jpg"
              : mime === "image/webp"
                ? ".webp"
                : mime === "image/gif"
                  ? ".gif"
                  : mime === "image/avif"
                    ? ".avif"
                    : ".png";
      stored = `mmd/texture-${createHash("sha256").update(name).digest("hex").slice(0, 24)}${extension}`;
      assets.set(name, stored);
      files.push({ path: stored, bytes: raw });
      total += raw.length;
      if (total > AVATAR_IMPORT_MAX_BYTES) refuse(TOO_LARGE);
    }
    texturePaths[texture] = stored;
  }
  return { ...parsed, kind: "model", files, texturePaths };
}

function readMmd(input: AvatarImportInput): ValidatedMmd {
  const bytes = Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
  if (bytes.subarray(0, 4).toString() === "PMX ") return modelImport(bytes, "model.pmx");
  if (bytes.subarray(0, 4).toString() === "Voca") {
    parseMotion(bytes);
    return { kind: "motion", bytes };
  }
  try {
    const archive = openZipArchive(bytes);
    const entries = new Map<string, Buffer>();
    const paths = new Set<string>();
    let total = 0;
    for (const entry of archive.getEntries()) {
      const raw = entry.entryName;
      if (raw.includes("\\") || raw.split("/").includes("..")) refuse("The MMD archive contains an unsafe file path.");
      const name = archivePath(raw);
      const mode = entry.attr >>> 16;
      if ((mode & 0xf000) === 0xa000) refuse("MMD archives cannot contain symbolic links.");
      if (paths.has(name)) refuse("The MMD archive contains duplicate file paths.");
      paths.add(name);
      if (entry.isDirectory || name.split("/").includes("__MACOSX") || posix.basename(name).startsWith("._")) continue;
      total += entry.size;
      if (total > AVATAR_IMPORT_MAX_BYTES) refuse(TOO_LARGE);
      entries.set(name, entry.read(AVATAR_IMPORT_MAX_BYTES));
    }
    const models = [...entries.keys()].filter((name) => name.toLowerCase().endsWith(".pmx"));
    const motions = [...entries.keys()].filter((name) => name.toLowerCase().endsWith(".vmd"));
    if (models.length !== 1 || motions.length > 1)
      refuse("Import one PMX model and at most one VMD motion in an MMD ZIP.");
    const result = modelImport(entries.get(models[0]!)!, models[0]!, entries);
    if (motions[0]) {
      result.idle = entries.get(motions[0])!;
      parseMotion(result.idle);
    }
    return result;
  } catch (error) {
    if (error instanceof ZipArchiveError) refuse(`This MMD ZIP can't be read: ${error.message}.`);
    throw error;
  }
}

const EXPRESSION_ALIASES: Readonly<Record<string, readonly string[]>> = {
  neutral: ["neutral", "通常", "真面目"],
  happy: ["happy", "smile", "笑い", "笑顔", "にこり"],
  angry: ["angry", "怒り"],
  sad: ["sad", "悲しい", "困る"],
  relaxed: ["relaxed", "なごみ"],
  surprised: ["surprised", "surprise", "びっくり", "驚き"],
  blink: ["blink", "まばたき"],
  aa: ["aa", "a", "あ"],
  ih: ["ih", "i", "い"],
  ou: ["ou", "u", "う"],
  ee: ["ee", "e", "え"],
  oh: ["oh", "o", "お"],
};

function detectedExpressions(model: ReturnType<typeof parseModel>["model"]): AvatarExpressionMap {
  const map: AvatarExpressionMap = {};
  for (const [slot, aliases] of Object.entries(EXPRESSION_ALIASES)) {
    const matches = model.morphs.filter(
      (morph) =>
        morph.elementCount > 0 &&
        (aliases.includes(morph.name.toLowerCase()) || aliases.includes(morph.englishName.toLowerCase())),
    );
    if (matches.length === 1 && matches[0]!.name.length <= 128) {
      map[slot as keyof AvatarExpressionMap] = { target: matches[0]!.name, source: "name-match", confidence: 1 };
    }
  }
  return map;
}

function requireMatchingMotion(bytes: Uint8Array, model: ReturnType<typeof parseModel>["model"]) {
  const motion = parseMotion(bytes);
  const bones = new Set(model.bones.map((bone) => bone.name));
  const morphs = new Set(model.morphs.map((morph) => morph.name));
  if (
    !motion.motions.some((frame) => bones.has(frame.boneName)) &&
    !motion.morphs.some((frame) => morphs.has(frame.morphName))
  ) {
    refuse("This VMD has no bone or morph names matching the imported PMX model.");
  }
}

export async function buildMmdImport(
  validated: ValidatedMmd,
  input: AvatarImportInput,
  current: MmdAvatarData | null,
): Promise<AvatarExtractedImport<"mmd">> {
  if (validated.kind === "motion") {
    if (!current) refuse("Import an MMD model before adding a VMD motion.");
    const model = await readAvatarFile(input.owner, current.file);
    if (!model) refuse("The stored MMD model is missing. Import it again before adding a motion.");
    requireMatchingMotion(validated.bytes, parseModel(model).model);
    return {
      kind: "mmd",
      files: [{ path: MMD_IDLE_ANIMATION_FILE, bytes: validated.bytes }],
      data: { ...current, idleAnimation: MMD_IDLE_ANIMATION_FILE },
      detected: {},
      warnings: [],
    };
  }
  const detected = detectedExpressions(validated.model);
  const warnings: string[] = [];
  if (validated.normalized)
    warnings.push("PMX text/version records were normalized for the MMD player; geometry is unchanged.");
  if (Object.keys(detected).length === 0)
    warnings.push("No standard face names matched. You can pick morphs in setup.");
  const allNames = [
    ...new Set(validated.model.morphs.filter((morph) => morph.elementCount > 0).map((morph) => morph.name)),
  ].filter((name) => name.length > 0 && name.length <= 128);
  const expressionNames = allNames.slice(0, AVATAR_MMD_METADATA_LIMITS.expressionNames);
  if (allNames.length > expressionNames.length)
    warnings.push(
      `Setup lists the first ${AVATAR_MMD_METADATA_LIMITS.expressionNames} named morphs. Other morphs and face bindings stay in the model.`,
    );
  let idleAnimation: string | null = null;
  if (validated.idle) {
    requireMatchingMotion(validated.idle, validated.model);
    validated.files.push({ path: MMD_IDLE_ANIMATION_FILE, bytes: validated.idle });
    idleAnimation = MMD_IDLE_ANIMATION_FILE;
  }
  // A new model must not inherit a motion whose bone names belonged to the previous model.
  return {
    kind: "mmd",
    files: validated.files,
    data: {
      file: MMD_MODEL_FILE,
      texturePaths: validated.texturePaths,
      expressionMap: detected,
      expressionNames,
      idleAnimation,
    },
    detected,
    warnings,
  };
}

export const mmdImporter: AvatarFormatImporter<"mmd", ValidatedMmd> = {
  kind: "mmd",
  extensions: AVATAR_IMPORT_EXTENSIONS.mmd,
  detect({ head, filename }) {
    const magic = Buffer.from(head.buffer, head.byteOffset, Math.min(head.byteLength, 4)).toString();
    return (
      magic === "PMX " || magic === "Voca" || (filename.toLowerCase().endsWith(".zip") && magic === "PK\u0003\u0004")
    );
  },
  async validate(input) {
    return readMmd(input);
  },
  async extract(validated, input) {
    return buildMmdImport(validated, input, (await readAvatarConfig(input.owner))?.kinds.mmd ?? null);
  },
};
