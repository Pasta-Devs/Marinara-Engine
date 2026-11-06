// ──────────────────────────────────────────────
// Avatar import: VRM 0.x / 1.0 models and `.vrma` animations (lane: 3D)
// ──────────────────────────────────────────────
// A `.vrm` is a binary glTF (GLB). Validate the GLB header and chunk lengths against the real byte
// length, parse only the JSON chunk, read the VRM or VRMC_vrm extension for the spec version and the
// expression names, and bind them to the AVATAR_EXPRESSION_SLOTS. A `.vrma` attaches to an imported VRM.
// Nothing is decoded beyond the JSON: meshes and textures are only ever read by three-vrm in the browser,
// so every check here mirrors what @pixiv/three-vrm 3.5.5 and three's GLTFLoader need to load the file.
import {
  AVATAR_EMOTIONS,
  AVATAR_EXPRESSION_SLOTS,
  AVATAR_IMPORT_EXTENSIONS,
  AvatarImportError,
  mapSpriteExpressionToAvatarEmotion,
  normalizeSpriteLookupToken,
  type AvatarExpressionBinding,
  type AvatarExpressionMap,
  type AvatarExpressionSlot,
  type AvatarExtractedImport,
  type AvatarFormatImporter,
  type AvatarImportInput,
  type VrmAvatarData,
  type VrmModelMeta,
} from "@marinara-engine/shared";
import { readAvatarConfig } from "../storage.js";

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_HEADER_BYTES = 12;
const GLB_CHUNK_HEADER_BYTES = 8;
const GLB_CHUNK_JSON = 0x4e4f534a; // "JSON"
const GLB_CHUNK_BIN = 0x004e4942; // "BIN\0"
/** Largest JSON chunk parsed. Real VRM models describe themselves in about 0.1 to 2 MiB (meshes and
 *  textures sit in the binary chunk, which is never limited), while parsing takes up to about 40 times the
 *  chunk's size in memory, all at once on the server's only thread. This bounds that, not the file. */
export const VRM_MAX_JSON_CHUNK_BYTES = 16 * 1024 * 1024;

export const VRM_MODEL_FILE = "vrm/model.vrm";
export const VRM_IDLE_ANIMATION_FILE = "vrm/idle.vrma";

/** VRMC_vrm spec versions three-vrm loads; any other version falls back to VRM 0.x or to nothing. */
const VRM1_SPEC_VERSIONS = new Set(["1.0", "1.0-beta"]);
const VRMA_SPEC_VERSIONS = new Set(["1.0", "1.0-draft"]);
/** three-vrm's VRMExpressionPresetName values. */
const VRM1_PRESET_NAMES = new Set([
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
  "blink",
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
  "lookUp",
  "lookDown",
  "lookLeft",
  "lookRight",
  "blinkLeft",
  "blinkRight",
  "neutral",
]);
/** three-vrm's v0v1PresetNameMap: a VRM 0.x preset group is registered under its VRM 1.0 name. */
const VRM0_PRESET_NAMES: ReadonlyMap<string, string> = new Map([
  ["a", "aa"],
  ["e", "ee"],
  ["i", "ih"],
  ["o", "oh"],
  ["u", "ou"],
  ["blink", "blink"],
  ["joy", "happy"],
  ["angry", "angry"],
  ["sorrow", "sad"],
  ["fun", "relaxed"],
  ["lookup", "lookUp"],
  ["lookdown", "lookDown"],
  ["lookleft", "lookLeft"],
  ["lookright", "lookRight"],
  ["blink_l", "blinkLeft"],
  ["blink_r", "blinkRight"],
  ["neutral", "neutral"],
]);
/** three-vrm refuses a model without these bones (VRMRequiredHumanBoneName). */
const REQUIRED_HUMAN_BONES = [
  "hips",
  "spine",
  "head",
  "leftUpperLeg",
  "leftLowerLeg",
  "leftFoot",
  "rightUpperLeg",
  "rightLowerLeg",
  "rightFoot",
  "leftUpperArm",
  "leftLowerArm",
  "leftHand",
  "rightUpperArm",
  "rightLowerArm",
  "rightHand",
] as const;

/** Custom expression names that clearly mean a slot (VRoid, UniVRM, VRChat, Oculus and ARKit conventions,
 *  English and Japanese), compared as sprite lookup tokens. Emotions also fall back to the sprite-label word
 *  stems. GLB and FBX blend shapes are matched with the same names. */
const SLOT_NAME_ALIASES: Readonly<Record<AvatarExpressionSlot, readonly string[]>> = {
  neutral: ["neutral", "default", "normal", "通常"],
  happy: ["happy", "joy", "smile", "喜び", "笑顔"],
  angry: ["angry", "anger", "怒り"],
  sad: ["sad", "sorrow", "悲しみ"],
  relaxed: ["relaxed", "relax", "fun", "calm", "楽しい", "楽しみ"],
  surprised: ["surprised", "surprise", "shock", "驚き", "びっくり"],
  aa: ["a", "aa", "あ", "vrc.v_aa", "mth_a", "fcl_mth_a", "viseme_aa"],
  ih: ["i", "ih", "い", "vrc.v_ih", "mth_i", "fcl_mth_i", "viseme_i"],
  ou: ["u", "ou", "う", "vrc.v_ou", "mth_u", "fcl_mth_u", "viseme_u"],
  ee: ["e", "ee", "え", "vrc.v_e", "mth_e", "fcl_mth_e", "viseme_e"],
  oh: ["o", "oh", "お", "vrc.v_oh", "mth_o", "fcl_mth_o", "viseme_o"],
  blink: ["blink", "eyeclose", "eyesclosed", "vrc.blink", "fcl_eye_close", "eyeblink", "まばたき", "瞬き"],
};
/** Names that only roughly mean a slot (an open jaw for every vowel, a smiling mouth for happy): used when the
 *  model has nothing that clearly means it. */
const SLOT_LOOSE_ALIASES: Partial<Record<AvatarExpressionSlot, readonly string[]>> = {
  happy: ["mouthsmile"],
  aa: ["mouthopen", "jawopen"],
};
function aliasTokens(aliases: Partial<Record<AvatarExpressionSlot, readonly string[]>>) {
  return new Map(
    AVATAR_EXPRESSION_SLOTS.map((slot) => [slot, new Set((aliases[slot] ?? []).map(normalizeSpriteLookupToken))]),
  ) as ReadonlyMap<AvatarExpressionSlot, ReadonlySet<string>>;
}
const SLOT_ALIAS_TOKENS = aliasTokens(SLOT_NAME_ALIASES);
const SLOT_LOOSE_ALIAS_TOKENS = aliasTokens(SLOT_LOOSE_ALIASES);
const NAME_MATCH_CONFIDENCE = 0.9;
const LOOSE_MATCH_CONFIDENCE = 0.7;
const STEM_MATCH_CONFIDENCE = 0.6;

/** Limits of the stored data (avatarConfigSchema); longer names cannot be bound and are skipped. */
const MAX_EXPRESSION_NAME_LENGTH = 128;
const MAX_EXPRESSION_NAMES = 256;
const MAX_META_TEXT_LENGTH = 256;
const MAX_META_TERM_LENGTH = 64;
const MAX_META_AUTHORS = 16;
const MAX_URL_LENGTH = 2048;

const DAMAGED = "This VRM file is incomplete or damaged.";
const NOT_A_VRM = "This isn't a VRM file. Choose a .vrm model, for example one exported from VRoid Studio.";
const BROKEN_SKELETON = "This model's skeleton points to parts that aren't in the file, so it can't be used.";

/** A GLB refusal in the words of the format being imported (VRM here, plain GLB models in glb-fbx.ts). */
export interface GlbRefusalText {
  damaged: string;
  notGlb: string;
  /** What the oversized-description refusal compares against: "any VRM model". */
  anyModel: string;
  /** How to export a model that points to outside files. */
  singleFile: string;
}
const VRM_GLB_TEXT: GlbRefusalText = {
  damaged: DAMAGED,
  notGlb: NOT_A_VRM,
  anyModel: "any VRM model",
  singleFile: "Export it again as a single .vrm file.",
};

export type ValidatedVrmFile =
  | {
      type: "model";
      specVersion: VrmAvatarData["specVersion"];
      expressionNames: string[];
      presetNames: ReadonlySet<string>;
      /** Expressions that bind nothing, so showing them changes nothing. */
      inertNames: ReadonlySet<string>;
      meta: VrmModelMeta;
      warnings: string[];
    }
  | { type: "animation" };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Reads the JSON chunk of a GLB after checking every chunk length against the bytes actually present. */
export function readGlbJson(bytes: Uint8Array, text: GlbRefusalText = VRM_GLB_TEXT): JsonRecord {
  if (bytes.byteLength < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES) {
    throw new AvatarImportError("invalid-file", text.damaged);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new AvatarImportError("unsupported-format", text.notGlb);
  if (view.getUint32(4, true) !== 2) {
    throw new AvatarImportError("unsupported-format", "This model uses an old glTF version that avatars can't load.");
  }
  if (view.getUint32(8, true) !== bytes.byteLength) throw new AvatarImportError("invalid-file", text.damaged);

  let json: unknown;
  let offset = GLB_HEADER_BYTES;
  for (let index = 0; offset < bytes.byteLength; index += 1) {
    if (bytes.byteLength - offset < GLB_CHUNK_HEADER_BYTES) throw new AvatarImportError("invalid-file", text.damaged);
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    offset += GLB_CHUNK_HEADER_BYTES;
    if (length > bytes.byteLength - offset) throw new AvatarImportError("invalid-file", text.damaged);
    if (index === 0) {
      if (type !== GLB_CHUNK_JSON || length === 0) throw new AvatarImportError("invalid-file", text.damaged);
      if (length > VRM_MAX_JSON_CHUNK_BYTES) {
        throw new AvatarImportError(
          "invalid-file",
          `This file's model description is far larger than ${text.anyModel} needs, so it can't be read safely.`,
        );
      }
      try {
        json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset, offset + length)));
      } catch {
        throw new AvatarImportError("invalid-file", text.damaged);
      }
    } else if (type === GLB_CHUNK_JSON || (type === GLB_CHUNK_BIN && index !== 1)) {
      throw new AvatarImportError("invalid-file", text.damaged);
    }
    offset += length;
  }
  const version = isRecord(json) && isRecord(json.asset) ? json.asset.version : undefined;
  if (!isRecord(json) || typeof version !== "string" || !version.startsWith("2")) {
    throw new AvatarImportError("invalid-file", text.damaged);
  }
  return json;
}

/** three's GLTFLoader cannot decode these without decoders the Engine does not ship. Draco throws even
 *  when optional; meshopt and Basis textures fall back to plain data unless the file requires them. */
export function refuseCompression(json: JsonRecord): void {
  const used = stringList(json.extensionsUsed);
  const required = stringList(json.extensionsRequired);
  const refused = [
    ...(used.includes("KHR_draco_mesh_compression") || required.includes("KHR_draco_mesh_compression")
      ? ["Draco"]
      : []),
    ...(required.includes("EXT_meshopt_compression") || required.includes("KHR_meshopt_compression")
      ? ["meshopt"]
      : []),
    ...(required.includes("KHR_texture_basisu") ? ["KTX2 textures"] : []),
  ];
  if (refused.length > 0) {
    throw new AvatarImportError(
      "unsupported-format",
      `This model is saved with compression avatars can't load (${refused.join(", ")}). Export it again with compression turned off.`,
    );
  }
}

/** A stored model must carry all of its data: a buffer or image that points to an address outside the file
 *  would make the browser fetch it while loading the avatar. */
export function refuseExternalFiles(json: JsonRecord, text: GlbRefusalText = VRM_GLB_TEXT): void {
  const external = [json.buffers, json.images].some(
    (list) =>
      Array.isArray(list) &&
      list.some((entry) => isRecord(entry) && entry.uri !== undefined && !/^data:/iu.test(String(entry.uri))),
  );
  if (external) {
    throw new AvatarImportError("unsupported-format", `This model points to files outside itself. ${text.singleFile}`);
  }
}

/** three's GLTFLoader shows the file's default scene; three-vrm and the VRM animation loader fail without one. */
export function requireScene(json: JsonRecord, text: GlbRefusalText = VRM_GLB_TEXT): void {
  const index = json.scene ?? 0;
  const scenes = Array.isArray(json.scenes) ? json.scenes : [];
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || !isRecord(scenes[index])) {
    throw new AvatarImportError("invalid-file", text.damaged);
  }
}

function boneNodeIsValid(node: unknown, nodeCount: number): boolean {
  return typeof node === "number" && Number.isInteger(node) && node >= 0 && node < nodeCount;
}

function requireHumanoid(bones: ReadonlySet<string>): void {
  const missing = REQUIRED_HUMAN_BONES.filter((bone) => !bones.has(bone));
  if (missing.length === REQUIRED_HUMAN_BONES.length) {
    throw new AvatarImportError(
      "invalid-file",
      "This model has no humanoid skeleton, so it can't be used as a VRM avatar.",
    );
  }
  if (missing.length > 0) {
    throw new AvatarImportError(
      "invalid-file",
      `This model's skeleton is missing parts VRM needs: ${missing.join(", ")}.`,
    );
  }
}

/** The listed bone names. three-vrm loads the node of every listed bone, optional ones included, and fails
 *  on an entry that is not an object or whose node is not in the file, so such a file is refused. */
function vrm1HumanBones(humanoid: unknown, nodeCount: number, broken: string): Set<string> {
  const bones = isRecord(humanoid) && isRecord(humanoid.humanBones) ? humanoid.humanBones : null;
  if (!bones) return new Set();
  for (const bone of Object.values(bones)) {
    if (!isRecord(bone) || !boneNodeIsValid(bone.node, nodeCount)) throw new AvatarImportError("invalid-file", broken);
  }
  return new Set(Object.keys(bones));
}

/** VRM 0.x: three-vrm skips an entry without a bone name or node, and fails on an entry that is not an
 *  object or whose node is not in the file. */
function vrm0HumanBones(humanoid: unknown, nodeCount: number): Set<string> {
  const bones = isRecord(humanoid) && Array.isArray(humanoid.humanBones) ? humanoid.humanBones : [];
  const names = new Set<string>();
  for (const bone of bones) {
    if (!isRecord(bone)) throw new AvatarImportError("invalid-file", BROKEN_SKELETON);
    if (bone.bone == null || bone.node == null) continue;
    if (!boneNodeIsValid(bone.node, nodeCount)) throw new AvatarImportError("invalid-file", BROKEN_SKELETON);
    if (typeof bone.bone === "string") names.add(bone.bone);
  }
  return names;
}

/** Control characters out, trimmed, cut to `max` UTF-16 units without splitting a surrogate pair. */
function metaText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  let text = value.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim();
  if (text.length > max) text = text.slice(0, /[\ud800-\udbff]/u.test(text[max - 1] ?? "") ? max - 1 : max).trim();
  return text || null;
}

function metaTerm(value: unknown): string | null {
  const text = metaText(value, MAX_META_TERM_LENGTH + 1);
  return text && text.length <= MAX_META_TERM_LENGTH ? text : null;
}

function metaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (url.length > MAX_URL_LENGTH || !/^https?:\/\/\S+$/iu.test(url)) return null;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

/** A VRM 1.0 yes/no term, or a VRM 0.x "Allow"/"Disallow" one; anything else is not stated. */
function metaFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return value === "Allow" ? true : value === "Disallow" ? false : null;
}

function vrm1Meta(meta: JsonRecord): VrmModelMeta {
  return {
    title: metaText(meta.name, MAX_META_TEXT_LENGTH),
    authors: stringList(meta.authors)
      .map((author) => metaText(author, MAX_META_TEXT_LENGTH))
      .filter((author): author is string => author !== null)
      .slice(0, MAX_META_AUTHORS),
    version: metaText(meta.version, MAX_META_TEXT_LENGTH),
    avatarPermission: metaTerm(meta.avatarPermission),
    commercialUsage: metaTerm(meta.commercialUsage),
    modification: metaTerm(meta.modification),
    licenseName: null,
    licenseUrl: metaUrl(meta.licenseUrl),
    termsUrl: metaUrl(meta.otherLicenseUrl),
    creditNotation: metaTerm(meta.creditNotation),
    allowRedistribution: metaFlag(meta.allowRedistribution),
    allowSexualUse: metaFlag(meta.allowExcessivelySexualUsage),
    allowViolentUse: metaFlag(meta.allowExcessivelyViolentUsage),
    allowPoliticalOrReligiousUse: metaFlag(meta.allowPoliticalOrReligiousUsage),
    allowAntisocialOrHateUse: metaFlag(meta.allowAntisocialOrHateUsage),
  };
}

function vrm0Meta(meta: JsonRecord): VrmModelMeta {
  const author = metaText(meta.author, MAX_META_TEXT_LENGTH);
  return {
    title: metaText(meta.title, MAX_META_TEXT_LENGTH),
    authors: author ? [author] : [],
    version: metaText(meta.version, MAX_META_TEXT_LENGTH),
    avatarPermission: metaTerm(meta.allowedUserName),
    commercialUsage: metaTerm(meta.commercialUssageName),
    modification: null,
    licenseName: metaTerm(meta.licenseName),
    licenseUrl: metaUrl(meta.otherLicenseUrl),
    termsUrl: metaUrl(meta.otherPermissionUrl),
    creditNotation: null,
    allowRedistribution: null,
    allowSexualUse: metaFlag(meta.sexualUssageName),
    allowViolentUse: metaFlag(meta.violentUssageName),
    allowPoliticalOrReligiousUse: null,
    allowAntisocialOrHateUse: null,
  };
}

interface ExpressionNames {
  names: string[];
  /** Every distinct usable name seen, so duplicates cost O(1) however many entries a file holds. */
  seen: Set<string>;
  presets: Set<string>;
  inert: Set<string>;
  skippedLongNames: boolean;
  tooMany: boolean;
}

function emptyExpressionNames(): ExpressionNames {
  return { names: [], seen: new Set(), presets: new Set(), inert: new Set(), skippedLongNames: false, tooMany: false };
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function addExpressionName(result: ExpressionNames, name: string, preset: boolean, inert: boolean): void {
  if (name.length > MAX_EXPRESSION_NAME_LENGTH) {
    result.skippedLongNames = true;
    return;
  }
  if (result.seen.has(name)) return;
  result.seen.add(name);
  // A preset still binds past the cap: the model has it even when the list cannot show it.
  if (preset) result.presets.add(name);
  // Exporters often write every preset whether or not it was set up (the VRM add-on for Blender does for a
  // VRM 0.x export of a VRM 1.0 model); such an expression moves no shape or material.
  if (inert) result.inert.add(name);
  if (result.names.length >= MAX_EXPRESSION_NAMES) {
    result.tooMany = true;
    return;
  }
  result.names.push(name);
}

/** A VRM 1.0 expression with no morph target, material colour or texture binds. */
function isInertVrm1Expression(definition: unknown): boolean {
  return (
    !isRecord(definition) ||
    !(
      hasEntries(definition.morphTargetBinds) ||
      hasEntries(definition.materialColorBinds) ||
      hasEntries(definition.textureTransformBinds)
    )
  );
}

/** The names three-vrm registers for a VRM 1.0 model: known presets, then customs that are not presets. */
function vrm1ExpressionNames(expressions: unknown): ExpressionNames {
  const result = emptyExpressionNames();
  if (!isRecord(expressions)) return result;
  if (isRecord(expressions.preset)) {
    for (const [name, definition] of Object.entries(expressions.preset)) {
      if (definition != null && VRM1_PRESET_NAMES.has(name)) {
        addExpressionName(result, name, true, isInertVrm1Expression(definition));
      }
    }
  }
  if (isRecord(expressions.custom)) {
    for (const [name, definition] of Object.entries(expressions.custom)) {
      if (VRM1_PRESET_NAMES.has(name)) continue;
      // three-vrm reads every custom definition and fails on one that is not an object.
      if (!isRecord(definition)) throw new AvatarImportError("invalid-file", DAMAGED);
      if (name) addExpressionName(result, name, false, isInertVrm1Expression(definition));
    }
  }
  return result;
}

/** The names three-vrm registers for a VRM 0.x model: a preset group's VRM 1.0 name, else the group name. */
function vrm0ExpressionNames(blendShapeMaster: unknown): ExpressionNames {
  const result = emptyExpressionNames();
  const groups = isRecord(blendShapeMaster) ? blendShapeMaster.blendShapeGroups : undefined;
  if (groups === undefined || groups === null) return result;
  if (!Array.isArray(groups)) throw new AvatarImportError("invalid-file", DAMAGED);
  for (const group of groups) {
    if (!isRecord(group)) throw new AvatarImportError("invalid-file", DAMAGED);
    const preset = typeof group.presetName === "string" ? VRM0_PRESET_NAMES.get(group.presetName) : undefined;
    const name = preset ?? (typeof group.name === "string" ? group.name : "");
    const inert = !hasEntries(group.binds) && !hasEntries(group.materialValues);
    if (name) addExpressionName(result, name, preset !== undefined, inert);
  }
  return result;
}

/** Binds each slot to the model's own preset, else to a custom name that clearly means it, else to a
 *  custom name whose words carry the emotion; a slot with none of these is `missing`. An inert expression
 *  never binds, except as the resting face: neutral is the model at rest. */
export function bindVrmExpressions(
  names: readonly string[],
  presets: ReadonlySet<string>,
  inert: ReadonlySet<string> = new Set(),
): AvatarExpressionMap {
  const map: AvatarExpressionMap = {};
  const emotions: readonly string[] = AVATAR_EMOTIONS;
  for (const slot of AVATAR_EXPRESSION_SLOTS) {
    let best: AvatarExpressionBinding = { target: null, source: "missing", confidence: 0 };
    const usable = (name: string) => slot === "neutral" || !inert.has(name);
    if (presets.has(slot) && usable(slot)) {
      map[slot] = { target: slot, source: "preset", confidence: 1 };
      continue;
    }
    const aliases = SLOT_ALIAS_TOKENS.get(slot);
    const looseAliases = SLOT_LOOSE_ALIAS_TOKENS.get(slot);
    for (const name of names) {
      if (presets.has(name) || !usable(name)) continue;
      const token = normalizeSpriteLookupToken(name);
      let confidence = aliases?.has(token)
        ? NAME_MATCH_CONFIDENCE
        : looseAliases?.has(token)
          ? LOOSE_MATCH_CONFIDENCE
          : 0;
      if (!confidence && emotions.includes(slot)) {
        const mapped = mapSpriteExpressionToAvatarEmotion(name);
        if (mapped?.emotion === slot) confidence = STEM_MATCH_CONFIDENCE * mapped.weight;
      }
      if (confidence > best.confidence) best = { target: name, source: "name-match", confidence };
    }
    map[slot] = best;
  }
  return map;
}

function inspectModel(json: JsonRecord): ValidatedVrmFile | null {
  const extensions = isRecord(json.extensions) ? json.extensions : {};
  const nodeCount = Array.isArray(json.nodes) ? json.nodes.length : 0;
  // Like three-vrm, a VRM 1.0 extension counts only when the file lists it as used.
  const vrm1Listed = stringList(json.extensionsUsed).includes("VRMC_vrm");
  const vrm1 = vrm1Listed ? extensions.VRMC_vrm : undefined;
  const vrm0 = extensions.VRM;
  if (!vrm1Listed && isRecord(extensions.VRMC_vrm) && !isRecord(vrm0)) {
    throw new AvatarImportError("invalid-file", DAMAGED);
  }
  let specVersion: VrmAvatarData["specVersion"];
  let meta: VrmModelMeta;
  let expressions: ExpressionNames;

  if (isRecord(vrm1) && typeof vrm1.specVersion === "string" && VRM1_SPEC_VERSIONS.has(vrm1.specVersion)) {
    if (!isRecord(vrm1.meta))
      throw new AvatarImportError("invalid-file", "This VRM file is missing its model details.");
    requireHumanoid(vrm1HumanBones(vrm1.humanoid, nodeCount, BROKEN_SKELETON));
    specVersion = "1.0";
    meta = vrm1Meta(vrm1.meta);
    expressions = vrm1ExpressionNames(vrm1.expressions);
  } else if (isRecord(vrm0)) {
    if (!isRecord(vrm0.meta))
      throw new AvatarImportError("invalid-file", "This VRM file is missing its model details.");
    requireHumanoid(vrm0HumanBones(vrm0.humanoid, nodeCount));
    specVersion = "0.x";
    meta = vrm0Meta(vrm0.meta);
    expressions = vrm0ExpressionNames(vrm0.blendShapeMaster);
  } else if (isRecord(vrm1)) {
    throw new AvatarImportError(
      "unsupported-format",
      "This VRM version isn't supported yet. Export the model as VRM 1.0 or VRM 0.x.",
    );
  } else {
    return null;
  }

  const warnings: string[] = [];
  if (expressions.skippedLongNames) warnings.push("Some expressions have names too long to use and were skipped.");
  if (expressions.tooMany) {
    warnings.push(`This model has more than ${MAX_EXPRESSION_NAMES} expressions; only the first ones can be picked.`);
  }
  return {
    type: "model",
    specVersion,
    expressionNames: expressions.names,
    presetNames: expressions.presets,
    inertNames: expressions.inert,
    meta,
    warnings,
  };
}

function inspectAnimation(json: JsonRecord): ValidatedVrmFile | null {
  const extension = isRecord(json.extensions) ? json.extensions.VRMC_vrm_animation : undefined;
  if (!stringList(json.extensionsUsed).includes("VRMC_vrm_animation") || !isRecord(extension)) return null;
  const nodeCount = Array.isArray(json.nodes) ? json.nodes.length : 0;
  const broken = "This animation file is damaged or isn't a VRM animation.";
  const hips = vrm1HumanBones(extension.humanoid, nodeCount, broken).has("hips");
  const specVersion = extension.specVersion;
  const knownVersion =
    specVersion === undefined || (typeof specVersion === "string" && VRMA_SPEC_VERSIONS.has(specVersion));
  if (!hips || !knownVersion || !Array.isArray(json.animations) || json.animations.length === 0) {
    throw new AvatarImportError("invalid-file", broken);
  }
  return { type: "animation" };
}

/** Turns a validated file into stored files and VRM data. A model keeps the idle animation already set
 *  up (VRM animations play on any humanoid); an animation needs a model and keeps everything else. */
export function buildVrmImport(
  validated: ValidatedVrmFile,
  input: AvatarImportInput,
  current: VrmAvatarData | null,
): AvatarExtractedImport<"vrm"> {
  if (validated.type === "animation") {
    if (!current) {
      throw new AvatarImportError("invalid-file", "Import a VRM model before adding an idle animation.");
    }
    return {
      kind: "vrm",
      files: [{ path: VRM_IDLE_ANIMATION_FILE, bytes: input.bytes }],
      data: { ...current, idleAnimation: VRM_IDLE_ANIMATION_FILE },
      detected: {},
      warnings: [],
    };
  }
  const expressionMap = bindVrmExpressions(validated.expressionNames, validated.presetNames, validated.inertNames);
  const warnings = [...validated.warnings];
  // Said only when an empty expression would have taken a slot: models often carry empty look-at or spare
  // expressions that nobody would bind anyway.
  const unfiltered = bindVrmExpressions(validated.expressionNames, validated.presetNames);
  if (
    AVATAR_EXPRESSION_SLOTS.some((slot) => {
      const target = unfiltered[slot]?.target;
      return slot !== "neutral" && target != null && validated.inertNames.has(target);
    })
  ) {
    warnings.push("Some of this model's expressions are empty and change nothing, so they weren't used.");
  }
  if (validated.expressionNames.length === 0) {
    // Nothing to pick in setup: a body-only model (one made with Tripo, for example).
    warnings.push("This model has no face expressions, so its face doesn't move.");
  } else if ((["happy", "angry", "sad", "surprised", "aa"] as const).some((slot) => !expressionMap[slot]?.target)) {
    warnings.push("Some faces or mouth shapes have no matching expression. You can pick them in setup.");
  }
  return {
    kind: "vrm",
    files: [{ path: VRM_MODEL_FILE, bytes: input.bytes }],
    data: {
      file: VRM_MODEL_FILE,
      specVersion: validated.specVersion,
      expressionMap,
      idleAnimation: current?.idleAnimation ?? null,
      meta: validated.meta,
      expressionNames: validated.expressionNames,
    },
    detected: expressionMap,
    warnings,
  };
}

export const vrmImporter: AvatarFormatImporter<"vrm", ValidatedVrmFile> = {
  kind: "vrm",
  extensions: AVATAR_IMPORT_EXTENSIONS.vrm,
  /** A GLB 2.0 header; whether it holds a VRM model, an animation or neither is for validate() to say. */
  detect({ head }) {
    if (head.byteLength < GLB_HEADER_BYTES) return false;
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    return view.getUint32(0, true) === GLB_MAGIC && view.getUint32(4, true) === 2;
  },
  async validate(input) {
    const json = readGlbJson(input.bytes);
    refuseCompression(json);
    refuseExternalFiles(json);
    const validated = inspectModel(json) ?? inspectAnimation(json);
    if (!validated) {
      throw new AvatarImportError(
        "unsupported-format",
        "This is a plain 3D model, not a VRM. Import it as a GLB or FBX model instead, or convert it to VRM, for example with the VRM add-on for Blender.",
      );
    }
    requireScene(json);
    return validated;
  },
  async extract(validated, input) {
    const current = (await readAvatarConfig(input.owner))?.kinds.vrm ?? null;
    return buildVrmImport(validated, input, current);
  },
};
