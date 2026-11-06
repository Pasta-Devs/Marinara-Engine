// ──────────────────────────────────────────────
// Avatar import: plain GLB and FBX models (lane: 3D)
// ──────────────────────────────────────────────
// A rigged character that is not a VRM. It has no humanoid table, so its bones are matched to the humanoid by
// name (matchAvatarHumanoidBones: Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max and more), and its blend
// shapes (morph targets) stand in for the faces, mouth shapes and blink. Only names are read here, as the VRM
// importer reads only the JSON chunk: a GLB's JSON chunk, or an FBX's object names. The browser loads the model
// with three's GLTFLoader or FBXLoader and finds the bones by the names stored here.
import { extname } from "node:path";
import {
  AVATAR_IMPORT_EXTENSIONS,
  AvatarImportError,
  matchAvatarHumanoidBones,
  pairedAvatarMorphNames,
  type AvatarExtractedImport,
  type AvatarFormatImporter,
  type AvatarHumanoidBone,
  type AvatarImportInput,
  type GlbFbxAvatarData,
} from "@marinara-engine/shared";
import {
  bindVrmExpressions,
  readGlbJson,
  refuseCompression,
  refuseExternalFiles,
  requireScene,
  type GlbRefusalText,
} from "./vrm.js";

export const GLB_MODEL_FILE = "glb-fbx/model.glb";
export const FBX_MODEL_FILE = "glb-fbx/model.fbx";

const GLB_MAGIC = "glTF";
/** "Kaydara FBX Binary", two spaces and a NUL, then 0x1A 0x00 and the version as a uint32 at byte 23. */
const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0";
const FBX_ASCII_START = "; FBX ";
/** three's FBXLoader reads FBX 7.0 (2011) and later. */
const FBX_MIN_VERSION = 7000;
/** Most objects of one class read from an FBX, far above any character's bones and blend shapes. The scan
 *  steps back at most MAX_FBX_NAME_BYTES per object, so this bounds its work on a hostile file. */
const MAX_FBX_OBJECTS = 20_000;
const MAX_FBX_NAME_BYTES = 1024;
/** Limits of the stored data (avatarConfigSchema); longer names cannot be bound and are skipped. */
const MAX_EXPRESSION_NAME_LENGTH = 128;
const MAX_EXPRESSION_NAMES = 256;

const GLB_TEXT: GlbRefusalText = {
  damaged: "This GLB file is incomplete or damaged.",
  notGlb: "This isn't a GLB or FBX file. Choose a rigged .glb or .fbx character.",
  anyModel: "any 3D avatar",
  singleFile: "Export it again as a single .glb file with its textures embedded.",
};
const FBX_DAMAGED = "This FBX file is incomplete or damaged.";

export interface ValidatedGlbFbxFile {
  format: GlbFbxAvatarData["format"];
  bones: Partial<Record<AvatarHumanoidBone, string>>;
  /** Blend shape names, each once, in file order. */
  morphNames: string[];
  warnings: string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function boneWords(bone: string): string {
  return bone.replace(/([a-z])([A-Z])/gu, "$1 $2").toLowerCase();
}

function listInWords(items: readonly string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

/** The humanoid bones a rig's names give, or a plain refusal naming what is missing. */
export function requireHumanoidRig(boneNames: readonly string[]): Partial<Record<AvatarHumanoidBone, string>> {
  if (boneNames.length === 0) {
    throw new AvatarImportError(
      "invalid-file",
      "This model has no skeleton, so it can't move. Rig it first, for example with Mixamo, then import it again.",
    );
  }
  const { bones, missing } = matchAvatarHumanoidBones(boneNames);
  if (missing.length > 0) {
    throw new AvatarImportError(
      "invalid-file",
      `This model's skeleton can't be matched to a human body: it has no ${listInWords(missing.map(boneWords))} bone that avatars recognise. Avatars read bone names from Mixamo, Unity, VRoid, Unreal, Blender and 3ds Max rigs; rename those bones or rig the model with Mixamo.`,
    );
  }
  return bones;
}

// ── GLB ──

function inspectGlb(bytes: Uint8Array): ValidatedGlbFbxFile {
  const json = readGlbJson(bytes, GLB_TEXT);
  const extensions = isRecord(json.extensions) ? json.extensions : {};
  if (isRecord(extensions.VRM) || isRecord(extensions.VRMC_vrm)) {
    throw new AvatarImportError(
      "unsupported-format",
      "This is a VRM model. Import it as a VRM model instead, so its faces and author's terms come with it.",
    );
  }
  refuseCompression(json);
  refuseExternalFiles(json, GLB_TEXT);
  requireScene(json, GLB_TEXT);
  const nodes = Array.isArray(json.nodes) ? json.nodes : [];
  const nodeName = (index: unknown) => {
    const node = typeof index === "number" ? nodes[index] : undefined;
    return isRecord(node) && typeof node.name === "string" && node.name ? node.name : null;
  };
  // A skinned model's bones are its skins' joints; a rigid one moves its nodes.
  const joints = (Array.isArray(json.skins) ? json.skins : []).flatMap((skin) =>
    isRecord(skin) && Array.isArray(skin.joints) ? skin.joints : [],
  );
  const boneNames = (joints.length > 0 ? joints : nodes.map((_, index) => index))
    .map(nodeName)
    .filter((name): name is string => name !== null);
  // three's GLTFLoader names a mesh's morph targets from the mesh's extras.targetNames.
  const morphNames = (Array.isArray(json.meshes) ? json.meshes : []).flatMap((mesh) => {
    if (!isRecord(mesh) || !Array.isArray(mesh.primitives)) return [];
    const targeted = mesh.primitives.some((primitive) => isRecord(primitive) && Array.isArray(primitive.targets));
    return targeted && isRecord(mesh.extras) ? strings(mesh.extras.targetNames) : [];
  });
  return { format: "glb", bones: requireHumanoidRig([...new Set(boneNames)]), morphNames, warnings: [] };
}

// ── FBX ──

interface FbxObject {
  name: string;
  type: string;
}

/** FBX 7 binary writes an object's name as one string property, `<name>\0\x01<Class>`, followed by its type
 *  (`LimbNode`, `BlendShapeChannel`). Strings are never compressed, so the names are found without parsing
 *  the file: from each `\0\x01<Class>`, step back to the string's length prefix. */
function binaryFbxObjects(bytes: Buffer, className: string): FbxObject[] {
  const needle = Buffer.from(`\0\x01${className}`, "latin1");
  const decoder = new TextDecoder();
  const found: FbxObject[] = [];
  // Every match counts, named or not, so a file of bare `\0\x01<Class>` runs can't make the scan step back
  // MAX_FBX_NAME_BYTES at each one.
  let matches = 0;
  for (let at = bytes.indexOf(needle); at >= 0; at = bytes.indexOf(needle, at + needle.length)) {
    if (++matches > MAX_FBX_OBJECTS) {
      throw new AvatarImportError("invalid-file", "This FBX file has far more parts than any avatar needs.");
    }
    const end = at + needle.length;
    let start = -1;
    for (let candidate = at; candidate >= Math.max(5, at - MAX_FBX_NAME_BYTES); candidate -= 1) {
      if (bytes[candidate - 5] === 0x53 && bytes.readUInt32LE(candidate - 4) === end - candidate) {
        start = candidate;
        break;
      }
    }
    if (start < 0) continue;
    let type = "";
    if (bytes[end] === 0x53 && end + 5 <= bytes.length) {
      const length = bytes.readUInt32LE(end + 1);
      if (length <= 64 && end + 5 + length <= bytes.length) type = bytes.toString("latin1", end + 5, end + 5 + length);
    }
    found.push({ name: decoder.decode(bytes.subarray(start, at)), type });
  }
  return found;
}

/** An embedded picture is a Video's `Content` node holding raw bytes: 'R' and a length above 0. */
function hasBinaryFbxContent(bytes: Buffer): boolean {
  const content = Buffer.from("\x07ContentR", "latin1");
  for (let at = bytes.indexOf(content); at >= 0; at = bytes.indexOf(content, at + content.length)) {
    if (at + content.length + 4 <= bytes.length && bytes.readUInt32LE(at + content.length) > 0) return true;
  }
  return false;
}

/** FBX 7 ASCII: `Model: 123, "Model::<name>", "<type>" {`. Indentation is matched as spaces and tabs only: `\s`
 *  would also cross line ends, so every line of a run of blank lines would rescan the rest of the run. */
function asciiFbxObjects(text: string, nodeName: string, className: string): FbxObject[] {
  const pattern = new RegExp(`^[ \\t]*${nodeName}:\\s*-?\\d+\\s*,\\s*"${className}::([^"]*)"\\s*,\\s*"([^"]*)"`, "gmu");
  const found: FbxObject[] = [];
  for (const match of text.matchAll(pattern)) {
    if (found.length >= MAX_FBX_OBJECTS) {
      throw new AvatarImportError("invalid-file", "This FBX file has far more parts than any avatar needs.");
    }
    found.push({ name: match[1]!, type: match[2]! });
  }
  return found;
}

function isFbx(bytes: Buffer): boolean {
  return (
    bytes.toString("latin1", 0, FBX_BINARY_MAGIC.length) === FBX_BINARY_MAGIC ||
    bytes.toString("latin1", 0, FBX_ASCII_START.length) === FBX_ASCII_START
  );
}

function inspectFbx(bytes: Buffer): ValidatedGlbFbxFile {
  const binary = bytes.toString("latin1", 0, FBX_BINARY_MAGIC.length) === FBX_BINARY_MAGIC;
  let models: FbxObject[];
  let deformers: FbxObject[];
  let textures: number;
  let embedded: boolean;
  let version: number;
  if (binary) {
    if (bytes.length < 27) throw new AvatarImportError("invalid-file", FBX_DAMAGED);
    version = bytes.readUInt32LE(23);
    if (version < FBX_MIN_VERSION) throw tooOld(version);
    models = binaryFbxObjects(bytes, "Model");
    deformers = binaryFbxObjects(bytes, "SubDeformer");
    textures = binaryFbxObjects(bytes, "Texture").length;
    embedded = hasBinaryFbxContent(bytes);
  } else {
    const text = new TextDecoder().decode(bytes);
    version = Number(/FBXVersion:\s*(\d+)/u.exec(text)?.[1] ?? 0);
    if (!version) throw new AvatarImportError("invalid-file", FBX_DAMAGED);
    if (version < FBX_MIN_VERSION) throw tooOld(version);
    models = asciiFbxObjects(text, "Model", "Model");
    deformers = asciiFbxObjects(text, "Deformer", "SubDeformer");
    textures = asciiFbxObjects(text, "Texture", "Texture").length;
    embedded = /^[ \t]*Content:\s*,?\s*"/mu.test(text);
  }
  // Bones are LimbNode (or Root) models; a rig without them may still name plain nodes like bones.
  const limbs = models.filter((model) => model.type === "LimbNode" || model.type === "Root");
  const boneNames = (limbs.length > 0 ? limbs : models).map((model) => model.name).filter(Boolean);
  const morphNames = deformers
    .filter((deformer) => deformer.type === "BlendShapeChannel")
    .map((deformer) => deformer.name)
    .filter(Boolean);
  const warnings =
    textures > 0 && !embedded
      ? [
          "This model's textures aren't inside the FBX file, so it shows without them. Export it again with Embed Media (or Embed Textures) turned on.",
        ]
      : [];
  return { format: "fbx", bones: requireHumanoidRig([...new Set(boneNames)]), morphNames, warnings };
}

function tooOld(version: number): AvatarImportError {
  return new AvatarImportError(
    "unsupported-format",
    `This FBX file is too old (version ${version}). Export it again as FBX 2014 (7.4) or newer.`,
  );
}

// ── Import ──

/** Turns a validated file into stored files and GLB/FBX data. Faces and mouth shapes bind to blend shapes by
 *  the same names as VRM expressions (aa, A, あ, viseme_aa, mouthOpen; happy, Joy; blink, eyeBlink...). */
export function buildGlbFbxImport(
  validated: ValidatedGlbFbxFile,
  input: AvatarImportInput,
): AvatarExtractedImport<"glb-fbx"> {
  const warnings = [...validated.warnings];
  const unique = [...new Set(validated.morphNames)];
  const usable = unique.filter((name) => name.length <= MAX_EXPRESSION_NAME_LENGTH);
  if (usable.length < unique.length) warnings.push("Some blend shapes have names too long to use and were skipped.");
  const names = [...usable, ...pairedAvatarMorphNames(usable)];
  if (names.length > MAX_EXPRESSION_NAMES) {
    warnings.push(`This model has more than ${MAX_EXPRESSION_NAMES} blend shapes; only the first ones can be picked.`);
  }
  const expressionNames = names.slice(0, MAX_EXPRESSION_NAMES);
  const expressionMap = bindVrmExpressions(expressionNames, new Set());
  if (expressionNames.length === 0) {
    warnings.push("This model has no blend shapes, so its face doesn't move.");
  } else if ((["happy", "angry", "sad", "surprised", "aa"] as const).some((slot) => !expressionMap[slot]?.target)) {
    warnings.push("Some faces or mouth shapes have no matching blend shape. You can pick them in setup.");
  }
  const file = validated.format === "glb" ? GLB_MODEL_FILE : FBX_MODEL_FILE;
  return {
    kind: "glb-fbx",
    files: [{ path: file, bytes: input.bytes }],
    data: { file, format: validated.format, bones: validated.bones, expressionMap, expressionNames },
    detected: expressionMap,
    warnings,
  };
}

/** The content type to serve a stored model with, when its first bytes match its extension. */
export function glbFbxFileMime(head: Uint8Array, filePath: string): string | null {
  const bytes = Buffer.from(head.buffer, head.byteOffset, head.byteLength);
  const extension = extname(filePath).toLowerCase();
  if (extension === ".glb") return bytes.toString("latin1", 0, 4) === GLB_MAGIC ? "model/gltf-binary" : null;
  return extension === ".fbx" && isFbx(bytes) ? "application/octet-stream" : null;
}

export const glbFbxImporter: AvatarFormatImporter<"glb-fbx", ValidatedGlbFbxFile> = {
  kind: "glb-fbx",
  extensions: AVATAR_IMPORT_EXTENSIONS["glb-fbx"],
  /** An FBX header, or a GLB header on a `.glb` (a `.vrm` is the VRM importer's, and so is a `.glb` sent
   *  without a kind: the GLB/FBX setup always names its kind). */
  detect({ filename, head }) {
    const bytes = Buffer.from(head.buffer, head.byteOffset, head.byteLength);
    return isFbx(bytes) || (extname(filename).toLowerCase() === ".glb" && bytes.toString("latin1", 0, 4) === GLB_MAGIC);
  },
  async validate(input) {
    const bytes = Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
    if (isFbx(bytes)) return inspectFbx(bytes);
    if (extname(input.filename).toLowerCase() === ".fbx") {
      throw new AvatarImportError(
        "unsupported-format",
        "This file isn't an FBX model avatars can read. Export it again as a binary FBX.",
      );
    }
    return inspectGlb(bytes);
  },
  async extract(validated, input) {
    return buildGlbFbxImport(validated, input);
  },
};
