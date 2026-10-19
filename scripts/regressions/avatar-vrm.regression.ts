/**
 * 3D Avatars (VRM):
 *   - the importer reads only the GLB header and JSON chunk, checks every length against the real bytes, and
 *     names the same expressions three-vrm registers (VRM 1.0 presets and customs, VRM 0.x preset groups under
 *     their VRM 1.0 names);
 *   - expressions bind to the six emotions, five visemes and blink through presets, then clear names, then
 *     emotion word stems, never to an empty expression (one that binds nothing) except the resting face,
 *     and the result fits avatar.json;
 *   - meta is kept as plain bounded text with only http(s) license links;
 *   - compressed models, plain glTF models, broken skeletons, missing scenes, oversized JSON chunks and
 *     dishonest files are refused in plain words;
 *   - a `.vrma` attaches to an existing model, and a new model keeps the idle animation;
 *   - what the importer accepts loads in the stage's own loader (three + three-vrm, run here in Node);
 *   - the renderer's motion maths (expression smoothing, lip sync on faces that hold the mouth, blink timer,
 *     framing, VRM 0.x mirroring) behaves;
 *   - a generated (body-only) model keeps its colour map when the page's connect-src refuses blob: URLs, sways
 *     and nods visibly with no idle animation, and a model with a face moves exactly as before.
 * Models are synthetic: no VRM file is committed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const { avatarConfigSchema, createAvatarConfig } = await import("../../packages/shared/src/index.js");
const { vrmImporter, buildVrmImport, VRM_IDLE_ANIMATION_FILE, VRM_MAX_JSON_CHUNK_BYTES, VRM_MODEL_FILE } =
  await import("../../packages/server/src/services/avatars/formats/vrm.js");
const { findAvatarImporter } = await import("../../packages/server/src/services/avatars/formats/registry.js");

const owner = { ownerType: "character", ownerId: "char_1" } as const;
const REQUIRED_BONES = [
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
];
const nodes = Array.from({ length: REQUIRED_BONES.length }, (_, index) => ({
  name: `node${index}`,
  translation: [0, index / 10, 0],
}));
const scenes = [{ nodes: nodes.map((_, index) => index) }];

function padded(bytes: Uint8Array, fill: number): Uint8Array {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
  out.set(bytes);
  return out;
}

function glb(
  json: unknown,
  options: { bin?: Uint8Array; declaredLength?: (real: number) => number; rawJson?: Uint8Array } = {},
): Uint8Array {
  const jsonBytes = padded(options.rawJson ?? new TextEncoder().encode(JSON.stringify(json)), 0x20);
  const binBytes = options.bin ? padded(options.bin, 0) : null;
  const total = 12 + 8 + jsonBytes.length + (binBytes ? 8 + binBytes.length : 0);
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, options.declaredLength?.(total) ?? total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);
  if (binBytes) {
    const at = 20 + jsonBytes.length;
    view.setUint32(at, binBytes.length, true);
    view.setUint32(at + 4, 0x004e4942, true);
    bytes.set(binBytes, at + 8);
  }
  return bytes;
}

/** An expression that changes something. The material is not in the file, so three-vrm adds no bind for it
 *  and the stage's loader stays quiet; the importer only needs to see that the author bound something. */
const FACE = { materialColorBinds: [{ material: 0, type: "color", targetValue: [1, 1, 1, 1] }] };
/** A VRM 0.x group's morph bind (three-vrm warns about the missing mesh and skips it). */
const GROUP_BINDS = [{ mesh: 0, index: 0, weight: 100 }];

function vrm1(overrides: Record<string, unknown> = {}, vrmOverrides: Record<string, unknown> = {}) {
  return {
    asset: { version: "2.0", generator: "regression" },
    scenes,
    nodes,
    extensionsUsed: ["VRMC_vrm"],
    extensions: {
      VRMC_vrm: {
        specVersion: "1.0",
        meta: {
          name: "  Test\u0000Model  ",
          version: "1.2",
          authors: ["Mari", 42, "x".repeat(300)],
          avatarPermission: "everyone",
          commercialUsage: "personalNonProfit",
          modification: "prohibited",
          licenseUrl: "https://vrm.dev/licenses/1.0/",
        },
        humanoid: { humanBones: Object.fromEntries(REQUIRED_BONES.map((bone, node) => [bone, { node }])) },
        expressions: {
          preset: {
            // The resting face binds nothing in most models.
            neutral: {},
            happy: FACE,
            angry: FACE,
            sad: FACE,
            relaxed: FACE,
            aa: FACE,
            ih: FACE,
            ou: FACE,
            ee: FACE,
            oh: FACE,
            blink: FACE,
            notAPreset: FACE,
          },
          // JSON.parse keeps "__proto__" as an own key, as a hostile file would.
          custom: JSON.parse(
            `{"Surprised":${JSON.stringify(FACE)},"happy":{},"__proto__":{"polluted":true},"Wink":${JSON.stringify(FACE)}}`,
          ),
        },
        ...vrmOverrides,
      },
    },
    ...overrides,
  };
}

function vrm0(groups: unknown[], metaOverrides: Record<string, unknown> = {}) {
  return {
    asset: { version: "2.0" },
    scenes,
    nodes,
    extensionsUsed: ["VRM"],
    extensions: {
      VRM: {
        specVersion: "0.0",
        meta: {
          title: "Old model",
          author: "Someone",
          allowedUserName: "Everyone",
          commercialUssageName: "Allow",
          licenseName: "CC_BY",
          otherLicenseUrl: "javascript:alert(1)",
          ...metaOverrides,
        },
        humanoid: { humanBones: REQUIRED_BONES.map((bone, node) => ({ bone, node })) },
        blendShapeMaster: { blendShapeGroups: groups },
      },
    },
  };
}

/** The server loads the shared package's build, so its AvatarImportError is not this file's class. */
function isImportError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && error.name === "AvatarImportError" && "code" in error;
}

const input = (bytes: Uint8Array, filename = "model.vrm") => ({ owner, filename, bytes });

async function refused(bytes: Uint8Array, code: string, message: RegExp, label: string) {
  await assert.rejects(
    vrmImporter.validate(input(bytes)),
    (error: unknown) => isImportError(error) && error.code === code && message.test(error.message),
    label,
  );
}

// ── detect: a GLB 2.0 header, nothing else ──
const header = glb(vrm1()).subarray(0, 12);
assert.equal(vrmImporter.detect({ filename: "model.vrm", head: header }), true);
assert.equal(vrmImporter.detect({ filename: "anything.bin", head: header }), true, "content decides, not the name");
assert.equal(vrmImporter.detect({ filename: "model.vrm", head: new TextEncoder().encode("glTF") }), false);
const v1Header = header.slice();
new DataView(v1Header.buffer).setUint32(4, 1, true);
assert.equal(vrmImporter.detect({ filename: "model.vrm", head: v1Header }), false, "glTF 1.0 is not claimed");
assert.equal(
  vrmImporter.detect({ filename: "model.vrm", head: new TextEncoder().encode("PK\u0003\u0004........") }),
  false,
);
assert.equal(findAvatarImporter({ filename: "model.vrm", head: header }), vrmImporter, "the registry finds it");
assert.equal(findAvatarImporter({ filename: "model.vrm", head: header }, "pngtuber"), null);

// ── VRM 1.0 ──
const modern = await vrmImporter.validate(input(glb(vrm1(), { bin: new Uint8Array([1, 2, 3]) })));
assert.equal(modern.type, "model");
assert.ok(modern.type === "model");
assert.equal(modern.specVersion, "1.0");
assert.deepEqual(
  modern.expressionNames,
  [
    "neutral",
    "happy",
    "angry",
    "sad",
    "relaxed",
    "aa",
    "ih",
    "ou",
    "ee",
    "oh",
    "blink",
    "Surprised",
    "__proto__",
    "Wink",
  ],
  "known presets, then customs that are not preset names (three-vrm drops unknown presets and colliding customs)",
);
assert.equal(({} as Record<string, unknown>).polluted, undefined);
assert.deepEqual(modern.meta, {
  title: "Test Model",
  authors: ["Mari", "x".repeat(256)],
  version: "1.2",
  avatarPermission: "everyone",
  commercialUsage: "personalNonProfit",
  modification: "prohibited",
  licenseName: null,
  licenseUrl: "https://vrm.dev/licenses/1.0/",
  termsUrl: null,
  creditNotation: null,
  allowRedistribution: null,
  allowSexualUse: null,
  allowViolentUse: null,
  allowPoliticalOrReligiousUse: null,
  allowAntisocialOrHateUse: null,
});
// The author's own terms link, credit, sharing and content rules are kept too.
const authorTerms = await vrmImporter.validate(
  input(
    glb(
      vrm1(
        {},
        {
          meta: {
            name: "Booth model",
            authors: ["Author"],
            licenseUrl: "https://vrm.dev/licenses/1.0/",
            otherLicenseUrl: "https://author.example/terms-of-use",
            creditNotation: "required",
            allowRedistribution: false,
            allowExcessivelySexualUsage: false,
            allowExcessivelyViolentUsage: true,
            allowPoliticalOrReligiousUsage: false,
            allowAntisocialOrHateUsage: "no",
          },
        },
      ),
    ),
  ),
);
assert.ok(authorTerms.type === "model");
assert.equal(authorTerms.meta.termsUrl, "https://author.example/terms-of-use");
assert.equal(authorTerms.meta.creditNotation, "required");
assert.equal(authorTerms.meta.allowRedistribution, false);
assert.equal(authorTerms.meta.allowSexualUse, false);
assert.equal(authorTerms.meta.allowViolentUse, true);
assert.equal(authorTerms.meta.allowPoliticalOrReligiousUse, false);
assert.equal(authorTerms.meta.allowAntisocialOrHateUse, null, "a value that is not yes or no is not stated");
const legacyTerms = await vrmImporter.validate(
  input(
    glb(
      vrm0([], {
        otherPermissionUrl: "https://author.example/permissions",
        sexualUssageName: "Disallow",
        violentUssageName: "Allow",
      }),
    ),
  ),
);
assert.ok(legacyTerms.type === "model");
assert.equal(legacyTerms.meta.termsUrl, "https://author.example/permissions");
assert.equal(legacyTerms.meta.allowSexualUse, false, "VRM 0.x Disallow");
assert.equal(legacyTerms.meta.allowViolentUse, true, "VRM 0.x Allow");
const modernImport = buildVrmImport(modern, input(new Uint8Array([9])), null);
assert.equal(modernImport.kind, "vrm");
assert.deepEqual(
  modernImport.files.map((file) => file.path),
  [VRM_MODEL_FILE],
);
assert.deepEqual(modernImport.data.expressionMap.happy, { target: "happy", source: "preset", confidence: 1 });
assert.deepEqual(
  modernImport.data.expressionMap.surprised,
  { target: "Surprised", source: "name-match", confidence: 0.9 },
  "a custom name that clearly means the slot",
);
assert.deepEqual(modernImport.data.expressionMap.blink, { target: "blink", source: "preset", confidence: 1 });
assert.equal(modernImport.data.idleAnimation, null);
assert.deepEqual(modernImport.warnings, [], "nothing missing, nothing to warn about");
const config = createAvatarConfig(owner, "2026-10-13T12:00:00.000Z");
const stored = { ...config, activeKind: "vrm", kinds: { vrm: modernImport.data } };
assert.ok(avatarConfigSchema.safeParse(stored).success, "an imported VRM 1.0 fits avatar.json");
assert.equal(
  avatarConfigSchema.safeParse({
    ...stored,
    kinds: { vrm: { ...modernImport.data, meta: { ...modernImport.data.meta, licenseUrl: "javascript:alert(1)" } } },
  }).success,
  false,
  "avatar.json refuses a license link that is not http(s)",
);
assert.ok(
  avatarConfigSchema.safeParse({
    ...config,
    activeKind: "vrm",
    kinds: { vrm: buildVrmImport(authorTerms, input(new Uint8Array([1])), null).data },
  }).success,
  "the author's terms link, credit and sharing rules fit avatar.json",
);

// ── VRM 0.x ──
const legacy = await vrmImporter.validate(
  input(
    glb(
      vrm0([
        { name: "Joy", presetName: "joy", binds: GROUP_BINDS },
        { name: "A", presetName: "a", binds: GROUP_BINDS },
        { name: "Blink", presetName: "blink", binds: GROUP_BINDS },
        { name: "Surprised", presetName: "unknown", binds: GROUP_BINDS },
        { name: "Smile_Big", presetName: "unknown", binds: GROUP_BINDS },
        { name: "Joy again", presetName: "joy", binds: GROUP_BINDS },
        { name: "Fun", presetName: "fun", materialValues: [{ materialName: "Face", propertyName: "_Color" }] },
        { name: "", presetName: "unknown" },
        { name: "y".repeat(129), presetName: "unknown" },
      ]),
    ),
  ),
);
assert.ok(legacy.type === "model");
assert.equal(legacy.specVersion, "0.x");
assert.deepEqual(
  legacy.expressionNames,
  ["happy", "aa", "blink", "Surprised", "Smile_Big", "relaxed"],
  "preset groups take their VRM 1.0 names, duplicates and empty names are dropped",
);
assert.deepEqual(legacy.meta, {
  title: "Old model",
  authors: ["Someone"],
  version: null,
  avatarPermission: "Everyone",
  commercialUsage: "Allow",
  modification: null,
  licenseName: "CC_BY",
  licenseUrl: null,
  termsUrl: null,
  creditNotation: null,
  allowRedistribution: null,
  allowSexualUse: null,
  allowViolentUse: null,
  allowPoliticalOrReligiousUse: null,
  allowAntisocialOrHateUse: null,
});
assert.ok(
  legacy.warnings.some((warning) => /too long/u.test(warning)),
  "a name too long to bind is reported",
);
const legacyImport = buildVrmImport(legacy, input(new Uint8Array([1])), {
  file: VRM_MODEL_FILE,
  specVersion: "1.0",
  expressionMap: {},
  idleAnimation: VRM_IDLE_ANIMATION_FILE,
});
assert.equal(legacyImport.data.idleAnimation, VRM_IDLE_ANIMATION_FILE, "a new model keeps the idle animation");
assert.deepEqual(legacyImport.data.expressionMap.happy, { target: "happy", source: "preset", confidence: 1 });
assert.deepEqual(legacyImport.data.expressionMap.relaxed, { target: "relaxed", source: "preset", confidence: 1 });
assert.equal(legacyImport.data.expressionMap.surprised?.target, "Surprised");
assert.deepEqual(legacyImport.data.expressionMap.angry, { target: null, source: "missing", confidence: 0 });
assert.deepEqual(legacyImport.data.expressionMap.ih, { target: null, source: "missing", confidence: 0 });
assert.ok(
  legacyImport.warnings.some((warning) => /pick them in setup/u.test(warning)),
  "missing faces are pointed out",
);
assert.ok(
  avatarConfigSchema.safeParse({ ...config, activeKind: "vrm", kinds: { vrm: legacyImport.data } }).success,
  "an imported VRM 0.x fits avatar.json",
);

// Custom names and word stems bind when the model has no preset.
const customs = await vrmImporter.validate(
  input(
    glb(
      vrm0([
        { name: "Smile", presetName: "unknown", binds: GROUP_BINDS },
        { name: "Grumpy_Glare", presetName: "unknown", binds: GROUP_BINDS },
        { name: "びっくり", presetName: "unknown", binds: GROUP_BINDS },
        { name: "vrc.v_aa", presetName: "unknown", binds: GROUP_BINDS },
        { name: "まばたき", presetName: "unknown", binds: GROUP_BINDS },
      ]),
    ),
  ),
);
assert.ok(customs.type === "model");
const customMap = buildVrmImport(customs, input(new Uint8Array([1])), null).data.expressionMap;
assert.deepEqual(customMap.happy, { target: "Smile", source: "name-match", confidence: 0.9 });
assert.equal(customMap.angry?.target, "Grumpy_Glare", "an emotion word stem binds with lower confidence");
assert.ok((customMap.angry?.confidence ?? 1) < 0.9);
assert.equal(customMap.surprised?.target, "びっくり", "Japanese names bind too");
assert.equal(customMap.aa?.target, "vrc.v_aa");
assert.equal(customMap.blink?.target, "まばたき");

// Empty expressions: exporters write presets nobody set up (the VRM add-on for Blender writes every VRM 0.x
// preset group, all empty, when it exports a VRM 1.0 model as 0.x). Such a face moves nothing, so it is not
// bound and the import says so, instead of "Set by the model" on a face that never changes.
const emptyGroups = await vrmImporter.validate(
  input(
    glb(
      vrm0([
        { name: "Neutral", presetName: "neutral" },
        { name: "A", presetName: "a", binds: [] },
        { name: "Blink", presetName: "blink", materialValues: [] },
        { name: "Joy", presetName: "joy" },
        { name: "Sorrow", presetName: "sorrow", binds: GROUP_BINDS },
        { name: "Smile", presetName: "unknown", binds: GROUP_BINDS },
        { name: "Shock", presetName: "unknown" },
      ]),
    ),
  ),
);
assert.ok(emptyGroups.type === "model");
assert.deepEqual(
  emptyGroups.expressionNames,
  ["neutral", "aa", "blink", "happy", "sad", "Smile", "Shock"],
  "empty expressions can still be picked by hand",
);
const emptyImport = buildVrmImport(emptyGroups, input(new Uint8Array([1])), null);
const emptyMap = emptyImport.data.expressionMap;
assert.deepEqual(
  emptyMap.neutral,
  { target: "neutral", source: "preset", confidence: 1 },
  "an empty neutral is the model at rest",
);
assert.deepEqual(emptyMap.aa, { target: null, source: "missing", confidence: 0 }, "an empty mouth shape is not bound");
assert.deepEqual(emptyMap.blink, { target: null, source: "missing", confidence: 0 }, "an empty blink is not bound");
assert.deepEqual(
  emptyMap.happy,
  { target: "Smile", source: "name-match", confidence: 0.9 },
  "an empty preset gives way to a custom face that moves",
);
assert.deepEqual(emptyMap.sad, { target: "sad", source: "preset", confidence: 1 });
assert.deepEqual(
  emptyMap.surprised,
  { target: null, source: "missing", confidence: 0 },
  "an empty custom face is not guessed either",
);
assert.ok(
  emptyImport.warnings.some((warning) => /empty and change nothing/u.test(warning)),
  "empty presets are pointed out",
);
assert.ok(emptyImport.warnings.some((warning) => /pick them in setup/u.test(warning)));
const emptyExpressions = await vrmImporter.validate(
  input(
    glb(
      vrm1(
        {},
        {
          expressions: {
            preset: {
              neutral: {},
              happy: { morphTargetBinds: [], overrideBlink: "block" },
              angry: FACE,
              aa: { textureTransformBinds: [{ material: 0, offset: [0, 0.5] }] },
            },
          },
        },
      ),
    ),
  ),
);
assert.ok(emptyExpressions.type === "model");
const emptyModernMap = buildVrmImport(emptyExpressions, input(new Uint8Array([1])), null).data.expressionMap;
assert.equal(emptyModernMap.happy?.source, "missing", "VRM 1.0: no morph target, colour or texture bind");
assert.equal(emptyModernMap.angry?.source, "preset");
assert.equal(emptyModernMap.aa?.source, "preset", "a texture transform is a change");
// Only an empty expression that would have taken a slot is pointed out: an empty custom face is, an empty
// look-at preset (common where the eyes turn by bone) is not.
const emptyCustom = await vrmImporter.validate(
  input(
    glb(
      vrm0([
        { name: "Joy", presetName: "joy", binds: GROUP_BINDS },
        { name: "Shock", presetName: "unknown" },
      ]),
    ),
  ),
);
assert.ok(
  buildVrmImport(emptyCustom, input(new Uint8Array([1])), null).warnings.some((warning) =>
    /empty and change nothing/u.test(warning),
  ),
  "an empty custom face is pointed out",
);
const emptyLookAt = await vrmImporter.validate(
  input(
    glb(
      vrm1(
        {},
        {
          expressions: {
            ...vrm1().extensions.VRMC_vrm.expressions,
            preset: { ...vrm1().extensions.VRMC_vrm.expressions.preset, lookUp: {} },
          },
        },
      ),
    ),
  ),
);
assert.deepEqual(
  buildVrmImport(emptyLookAt, input(new Uint8Array([1])), null).warnings,
  [],
  "an empty expression no slot uses is not worth a warning",
);

// Many expressions: capped at what avatar.json stores, with a warning; a preset past the cap still binds.
const many = await vrmImporter.validate(
  input(
    glb(
      vrm0([
        ...Array.from({ length: 300 }, (_, index) => ({ name: `Custom${index}`, presetName: "unknown" })),
        { name: "Joy", presetName: "joy", binds: GROUP_BINDS },
      ]),
    ),
  ),
);
assert.ok(many.type === "model");
assert.equal(many.expressionNames.length, 256);
assert.ok(many.warnings.some((warning) => /more than 256/u.test(warning)));
const manyData = buildVrmImport(many, input(new Uint8Array([1])), null).data;
assert.deepEqual(manyData.expressionMap.happy, { target: "happy", source: "preset", confidence: 1 });
assert.ok(avatarConfigSchema.safeParse({ ...config, activeKind: "vrm", kinds: { vrm: manyData } }).success);

// A hostile file with a huge number of expressions is read in linear time.
// (Deduplicating with an array scan took minutes here.)
const hostileBytes = glb(
  vrm0(Array.from({ length: 200_000 }, (_, index) => ({ name: `X${index % 100_000}`, presetName: "unknown" }))),
);
const hostileStarted = performance.now();
const hostile = await vrmImporter.validate(input(hostileBytes));
const hostileMs = performance.now() - hostileStarted;
assert.ok(hostile.type === "model" && hostile.expressionNames.length === 256);
assert.ok(hostileMs < 5_000, `200,000 expression entries validate quickly (${Math.round(hostileMs)} ms)`);

// ── .vrma idle animations ──
const animationJson = {
  asset: { version: "2.0" },
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "hips" }],
  extensionsUsed: ["VRMC_vrm_animation"],
  extensions: { VRMC_vrm_animation: { specVersion: "1.0", humanoid: { humanBones: { hips: { node: 0 } } } } },
  animations: [{ channels: [], samplers: [] }],
};
const animation = await vrmImporter.validate(input(glb(animationJson), "idle.vrma"));
assert.deepEqual(animation, { type: "animation" });
assert.throws(
  () => buildVrmImport(animation, input(new Uint8Array([1]), "idle.vrma"), null),
  (error: unknown) => isImportError(error) && /model before/u.test(error.message),
  "an animation needs a model first",
);
const attached = buildVrmImport(animation, input(new Uint8Array([1]), "idle.vrma"), legacyImport.data);
assert.deepEqual(
  attached.files.map((file) => file.path),
  [VRM_IDLE_ANIMATION_FILE],
);
assert.deepEqual(attached.data, { ...legacyImport.data, idleAnimation: VRM_IDLE_ANIMATION_FILE });
await refused(
  glb({ ...animationJson, animations: [] }),
  "invalid-file",
  /isn't a VRM animation/u,
  "an animation without animations",
);
await refused(
  glb({
    ...animationJson,
    extensions: { VRMC_vrm_animation: { specVersion: "1.0", humanoid: { humanBones: { hips: { node: 5 } } } } },
  }),
  "invalid-file",
  /isn't a VRM animation/u,
  "an animation whose hips point nowhere",
);

// ── Refusals ──
await refused(glb(vrm1(), { declaredLength: (real) => real + 4 }), "invalid-file", /damaged/u, "header length lies");
const truncated = glb(vrm1(), { bin: new Uint8Array(64) }).slice(0, -16);
new DataView(truncated.buffer).setUint32(8, truncated.length, true);
await refused(truncated, "invalid-file", /damaged/u, "a chunk longer than the file");
await refused(glb(null, { rawJson: new Uint8Array([0xff, 0xfe, 0x7b]) }), "invalid-file", /damaged/u, "bad UTF-8");
await refused(glb([1, 2]), "invalid-file", /damaged/u, "a JSON root that is not an object");
await refused(glb({ ...vrm1(), asset: { version: "1.0" } }), "invalid-file", /damaged/u, "glTF 1.0 JSON");
const binFirst = glb(vrm1());
new DataView(binFirst.buffer).setUint32(16, 0x004e4942, true);
await refused(binFirst, "invalid-file", /damaged/u, "the first chunk must be JSON");
const notGlb = new TextEncoder().encode('{"asset":{"version":"2.0"}}      ');
await refused(notGlb, "unsupported-format", /isn't a VRM file/u, "a JSON glTF is not a VRM");
await refused(
  glb({ ...vrm1(), extensionsUsed: ["VRMC_vrm", "KHR_draco_mesh_compression"] }),
  "unsupported-format",
  /compression avatars can't load \(Draco\)/u,
  "Draco is refused even when optional (three throws without a decoder)",
);
await refused(
  glb({ ...vrm1(), extensionsRequired: ["EXT_meshopt_compression", "KHR_texture_basisu"] }),
  "unsupported-format",
  /\(meshopt, KTX2 textures\)/u,
  "required meshopt and KTX2 are refused",
);
await refused(
  glb({ ...vrm1(), extensionsRequired: ["KHR_meshopt_compression"] }),
  "unsupported-format",
  /\(meshopt\)/u,
  "the ratified KHR meshopt name is refused too (three 0.186 needs a decoder for it)",
);
assert.equal(
  (await vrmImporter.validate(input(glb({ ...vrm1(), extensionsUsed: ["VRMC_vrm", "EXT_meshopt_compression"] })))).type,
  "model",
  "optional meshopt has plain fallback data and loads",
);
await refused(
  glb({ ...vrm1(), images: [{ uri: "https://example.com/tracker.png" }] }),
  "unsupported-format",
  /points to files outside itself/u,
  "an image the browser would fetch from elsewhere",
);
await refused(
  glb({ ...vrm1(), buffers: [{ byteLength: 4, uri: "../../secret.bin" }] }),
  "unsupported-format",
  /points to files outside itself/u,
  "a buffer outside the file",
);
assert.equal(
  (
    await vrmImporter.validate(
      input(glb({ ...vrm1(), buffers: [{ byteLength: 4 }], images: [{ uri: "data:image/png;base64,AA==" }] })),
    )
  ).type,
  "model",
  "the GLB's own buffer and data: images load",
);
await refused(
  glb({ asset: { version: "2.0" }, nodes }),
  "unsupported-format",
  /plain 3D model, not a VRM/u,
  "a plain glTF model",
);
await refused(
  glb(vrm1({}, { specVersion: "2.0" })),
  "unsupported-format",
  /version isn't supported/u,
  "an unknown VRM version",
);
await refused(
  glb({ ...vrm1(), extensionsUsed: [] }),
  "invalid-file",
  /damaged/u,
  "a VRM 1.0 extension the file does not list as used",
);
await refused(glb(vrm1({}, { humanoid: undefined })), "invalid-file", /no humanoid skeleton/u, "no humanoid");
await refused(
  glb(
    vrm1(
      {},
      {
        humanoid: {
          humanBones: Object.fromEntries(
            REQUIRED_BONES.filter((bone) => bone !== "head").map((bone, node) => [bone, { node }]),
          ),
        },
      },
    ),
  ),
  "invalid-file",
  /missing parts VRM needs: head\./u,
  "a missing required bone is named",
);
const brokenSkeleton = /skeleton points to parts that aren't in the file/u;
const withBones = (extra: Record<string, unknown>) =>
  glb(
    vrm1(
      {},
      {
        humanoid: {
          humanBones: { ...Object.fromEntries(REQUIRED_BONES.map((bone, node) => [bone, { node }])), ...extra },
        },
      },
    ),
  );
await refused(withBones({ rightHand: { node: 15 } }), "invalid-file", brokenSkeleton, "a bone past the last node");
// three-vrm loads the node of every listed bone, optional ones included, and fails on these.
await refused(withBones({ leftEye: { node: 999 } }), "invalid-file", brokenSkeleton, "an optional bone past the nodes");
await refused(withBones({ leftEye: null }), "invalid-file", brokenSkeleton, "a bone entry that is not an object");
await refused(withBones({ leftEye: {} }), "invalid-file", brokenSkeleton, "a bone entry without a node");
const legacyBones = (extra: unknown[]) => {
  const json = vrm0([]);
  const humanBones = [...REQUIRED_BONES.map((bone, node) => ({ bone, node })), ...extra];
  return glb({ ...json, extensions: { VRM: { ...json.extensions.VRM, humanoid: { humanBones } } } });
};
await refused(legacyBones([null]), "invalid-file", brokenSkeleton, "VRM 0.x: a bone entry that is not an object");
await refused(
  legacyBones([{ bone: "leftEye", node: 99 }]),
  "invalid-file",
  brokenSkeleton,
  "VRM 0.x: a bone past the nodes",
);
assert.equal(
  (await vrmImporter.validate(input(legacyBones([{ bone: "leftEye" }, { node: 3 }])))).type,
  "model",
  "VRM 0.x: three-vrm skips an entry without a bone name or node, so it is not refused",
);
await refused(glb({ ...vrm1(), scenes: undefined }), "invalid-file", /damaged/u, "a model without a scene to show");
await refused(glb({ ...vrm1(), scene: 1 }), "invalid-file", /damaged/u, "a default scene that does not exist");
{
  // A JSON chunk past the bound is refused before it is decoded; the binary chunk is never limited.
  const prefix = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
  const rawJson = new Uint8Array(VRM_MAX_JSON_CHUNK_BYTES + 4).fill(0x20);
  rawJson.set(prefix);
  const started = performance.now();
  await refused(glb(null, { rawJson }), "invalid-file", /far larger than any VRM model needs/u, "a huge JSON chunk");
  assert.ok(performance.now() - started < 2_000, "the huge JSON chunk is refused without parsing it");
}
await refused(glb(vrm1({}, { meta: undefined })), "invalid-file", /model details/u, "VRM 1.0 without meta");
const noMeta = vrm0([]);
await refused(
  glb({ ...noMeta, extensions: { VRM: { ...noMeta.extensions.VRM, meta: null } } }),
  "invalid-file",
  /model details/u,
  "VRM 0.x without meta",
);
await refused(
  glb(vrm1({}, { expressions: { custom: { Broken: null } } })),
  "invalid-file",
  /damaged/u,
  "a custom expression three-vrm cannot read",
);

// ── Renderer motion maths ──
const motion = await import("../../packages/client/src/features/avatars/renderers/vrm/vrm-motion.js");
{
  const weights = motion.createExpressionWeights();
  const map = modernImport.data.expressionMap;
  const frame = { emotion: "happy", emotionWeight: 1, viseme: "oh", mouthOpen: 0.8, state: "talking" } as const;
  for (let step = 0; step < 30; step += 1) motion.stepExpressionWeights(weights, map, frame, { lipSync: true }, 1 / 30);
  assert.ok((weights.get("happy") ?? 0) > 0.95, "the emotion eases in within a second");
  assert.ok((weights.get("oh") ?? 0) > 0.75, "the mouth follows the viseme quickly");
  assert.equal(weights.get("aa") ?? 0, 0);
  motion.stepExpressionWeights(weights, map, { ...frame, emotion: "sad", mouthOpen: 0 }, { lipSync: true }, 1 / 30);
  assert.ok((weights.get("happy") ?? 0) > 0.5, "one frame later the old face is still fading, not snapped off");
  for (let step = 0; step < 30; step += 1) {
    motion.stepExpressionWeights(weights, map, { ...frame, mouthOpen: 1 }, { lipSync: false }, 1 / 30);
  }
  assert.ok((weights.get("oh") ?? 1) < 0.01, "lip sync off keeps the mouth closed");
  const fallback = motion.createExpressionWeights();
  motion.stepExpressionWeights(fallback, map, { ...frame, viseme: null, mouthOpen: 1 }, { lipSync: true }, 1);
  assert.ok((fallback.get("aa") ?? 0) > 0.9, "an open mouth without a viseme uses aa");
  const unbound = motion.createExpressionWeights();
  motion.stepExpressionWeights(
    unbound,
    legacyImport.data.expressionMap,
    { ...frame, viseme: "ih" },
    { lipSync: true },
    1,
  );
  assert.ok((unbound.get("aa") ?? 0) > 0.7, "a viseme the model lacks falls back to aa");
}
{
  const blink = motion.createBlinkTimer(() => 0.5);
  let closedAt = -1;
  for (let ms = 0; ms < 8000; ms += 33) {
    if (motion.stepBlink(blink, 0.033, { enabled: true }) > 0.9 && closedAt < 0) closedAt = ms;
  }
  assert.ok(closedAt > 1000 && closedAt < 7000, `the eyes blink on their own (closed at ${closedAt} ms)`);
  assert.deepEqual(
    [0, 0.5, 1].map((random) => Math.round(motion.createBlinkTimer(() => random).wait * 1000) / 1000),
    [3, 4.5, 6],
    "a VRM blinks at the PNGTuber default rate: every 4.5 seconds on average, 3 to 6 seconds apart",
  );
  const off = motion.createBlinkTimer(() => 0.5);
  let max = 0;
  for (let ms = 0; ms < 8000; ms += 33) max = Math.max(max, motion.stepBlink(off, 0.033, { enabled: false }));
  assert.equal(max, 0, "blink off never closes the eyes");
}
{
  // A face that falls back to neutral lands on exactly 0: three-vrm counts any weight above 0 of a "block"
  // expression as fully on, so easing alone would keep blinks blocked for minutes.
  const weights = motion.createExpressionWeights();
  const map = modernImport.data.expressionMap;
  const frame = { emotion: "happy", emotionWeight: 1, viseme: null, mouthOpen: 0, state: "idle" } as const;
  for (let step = 0; step < 30; step += 1) motion.stepExpressionWeights(weights, map, frame, { lipSync: true }, 1 / 30);
  for (let step = 0; step < 60; step += 1) {
    motion.stepExpressionWeights(weights, map, { ...frame, emotion: "neutral" }, { lipSync: true }, 1 / 30);
  }
  assert.equal(weights.get("happy"), 0, "a faded face settles on 0");
}
{
  // While speaking, a face that holds the mouth is kept down; it returns to full strength afterwards.
  const map = modernImport.data.expressionMap;
  const holders = new Set(["happy"]);
  const weights = motion.createExpressionWeights();
  const talking = { emotion: "happy", emotionWeight: 1, viseme: "aa", mouthOpen: 1, state: "talking" } as const;
  for (let step = 0; step < 30; step += 1) {
    motion.stepExpressionWeights(weights, map, talking, { lipSync: true }, 1 / 30, holders);
  }
  assert.ok((weights.get("happy") ?? 1) <= 0.41, "the held face stays partial while the avatar speaks");
  const quiet = { ...talking, mouthOpen: 0, viseme: null, state: "idle" } as const;
  for (let step = 0; step < 30; step += 1)
    motion.stepExpressionWeights(weights, map, quiet, { lipSync: true }, 1 / 30, holders);
  assert.ok((weights.get("happy") ?? 0) > 0.95, "the face comes back in full once the avatar stops speaking");
  const noLipSync = motion.createExpressionWeights();
  for (let step = 0; step < 30; step += 1) {
    motion.stepExpressionWeights(noLipSync, map, talking, { lipSync: false }, 1 / 30, holders);
  }
  assert.ok((noLipSync.get("happy") ?? 0) > 0.95, "with lip sync off the mouth never moves, so the face stays full");
}
{
  // The head stays near the top, and a narrower canvas shows more of the body, smoothly: the stage's shapes
  // (about 0.5 to 0.75 wide per unit of height) never flip between two framings.
  const body = { headY: 1.45, hipsY: 0.95, footY: 0.05 };
  const tanHalf = Math.tan((25 * Math.PI) / 360);
  const view = (aspect: number) => {
    const framing = motion.frameCamera(body, aspect, 25);
    const half = framing.distance * tanHalf;
    return { top: framing.targetY + half, bottom: framing.targetY - half, ...framing };
  };
  const headTop = body.headY + 0.42 * (body.headY - body.hipsY);
  let previous = view(1.2);
  for (let aspect = 1.19; aspect >= 0.3; aspect -= 0.01) {
    const current = view(aspect);
    assert.ok(current.top >= headTop, `the head stays in view at aspect ${aspect.toFixed(2)}`);
    assert.ok(current.bottom <= previous.bottom + 1e-9, "a narrower canvas never shows less of the body");
    assert.ok(previous.bottom - current.bottom < 0.1, `no jump at aspect ${aspect.toFixed(2)}`);
    previous = current;
  }
  assert.ok(view(0.75).bottom < body.hipsY + 0.05, "a 3:4 spot reaches down to the hips");
  assert.ok(view(0.75).top - headTop < 0.1, "with the head near the top, not centred in empty space");
  assert.ok(view(0.3).bottom <= body.footY, "a very narrow spot shows the whole body");
  const square = motion.frameCamera(body, 1, 25);
  assert.ok(
    motion.frameCamera(body, 4, 25).distance <= square.distance * 1.01,
    "a wide canvas never zooms out the bust",
  );
  assert.ok(view(4).bottom > body.hipsY, "a wide canvas shows the head and shoulders");
}
{
  // The top of the model: hair or ears above the head estimate stay in view (a Tripo model's reach 0.3 m and
  // more above its head bone), a model whose top is lower frames exactly as before, and a part far above the
  // head can't shrink the face more than one head-to-hips length allows.
  const body = { headY: 1.45, hipsY: 0.95, footY: 0.05 };
  const tanHalf = Math.tan((25 * Math.PI) / 360);
  const viewTop = (heights: typeof body & { topY?: number }, aspect: number) => {
    const framing = motion.frameCamera(heights, aspect, 25);
    return framing.targetY + framing.distance * tanHalf;
  };
  for (const aspect of [0.4, 0.6, 0.75, 1, 1.5, 4]) {
    assert.deepEqual(
      motion.frameCamera({ ...body, topY: 1.6 }, aspect, 25),
      motion.frameCamera(body, aspect, 25),
      `a top under the head estimate changes nothing at aspect ${aspect}`,
    );
    assert.ok(viewTop({ ...body, topY: 1.84 }, aspect) >= 1.84, `tall hair stays in view at aspect ${aspect}`);
    assert.deepEqual(
      motion.frameCamera({ ...body, topY: 9 }, aspect, 25),
      motion.frameCamera({ ...body, topY: body.headY + (body.headY - body.hipsY) }, aspect, 25),
      "a part far above the head counts only up to one head-to-hips length",
    );
  }
  assert.deepEqual(motion.frameCamera({ ...body, topY: Number.NaN }, 1, 25), motion.frameCamera(body, 1, 25));
}
assert.deepEqual(motion.canvasPixels(300, 300, 3, 2), { width: 600, height: 600 }, "the pixel ratio is capped");
assert.deepEqual(
  motion.canvasPixels(400, 1200, 2, 2),
  { width: 683, height: 2048 },
  "the size cap scales both sides alike, so a tall avatar keeps its shape",
);
assert.deepEqual(motion.canvasPixels(0, 0, 1, 2), { width: 0, height: 0 });
assert.equal(motion.vrm0Mirror("0"), -1, "VRM 0.x normalised bones mirror x and z rotations");
assert.equal(motion.vrm0Mirror("1"), 1);

// ── The renderer runs no loop of its own and loads bytes through api.raw ──
const rendererSource = readFileSync(
  join(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../packages/client/src/features/avatars/renderers/vrm/vrm-renderer.ts",
  ),
  "utf8",
);
assert.equal(/requestAnimationFrame|setInterval/u.test(rendererSource), false, "the stage drives every frame");
assert.ok(/api\.raw\(avatarModelFilePath\(/u.test(rendererSource), "model bytes load through api.raw");
assert.equal(/\bfetch\(/u.test(rendererSource), false);
assert.ok(/VRMUtils\.deepDispose/u.test(rendererSource), "dispose releases the model's GPU resources");
assert.ok(
  /springBoneManager\?\.reset\(\)/u.test(rendererSource),
  "hair and clothes restart from the posed model instead of whipping from the loader's T-pose",
);

// ── What the importer accepts, the stage's own loader loads ──
// The renderer's loader (three's GLTFLoader + three-vrm, as the stage configures them) runs here in Node on
// the same synthetic files; api.raw is served from memory, so no request leaves the process.
{
  const { loadStoredVrm } = await import("../../packages/client/src/features/avatars/renderers/vrm/vrm-renderer.js");
  const realFetch = globalThis.fetch;
  const realWarn = console.warn;
  // three-vrm warns about the fixture's deliberately odd expression names; only those warnings are dropped.
  console.warn = (...args: unknown[]) => {
    if (!/^VRMExpressionLoaderPlugin:/u.test(String(args[0]))) realWarn(...args);
  };
  let served = new Uint8Array();
  globalThis.fetch = (async () => new Response(served)) as typeof fetch;
  const loadInStage = async (bytes: Uint8Array) => {
    served = bytes;
    const gltf = await loadStoredVrm(owner, VRM_MODEL_FILE, new AbortController().signal);
    const vrm = gltf.userData.vrm;
    assert.ok(vrm, "the loader returns a VRM");
    return vrm as {
      expressionManager?: {
        getExpression(name: string): {
          overrideMouth: string;
          addBind(bind: { applyWeight(weight: number): void; clearAppliedWeight(): void }): void;
        } | null;
        setValue(name: string, weight: number): void;
        update(): void;
      };
    };
  };
  const accepted = async (bytes: Uint8Array, label: string) => {
    await vrmImporter.validate(input(bytes));
    await loadInStage(bytes);
    assert.ok(true, label);
  };
  await accepted(glb(vrm1()), "VRM 1.0");
  await accepted(
    glb(
      vrm0([
        { name: "Joy", presetName: "joy" },
        { name: "Surprised", presetName: "unknown" },
      ]),
    ),
    "VRM 0.x",
  );
  const metaWithout = (patch: Record<string, unknown>) =>
    glb(vrm1({}, { meta: { ...vrm1().extensions.VRMC_vrm.meta, ...patch } }));
  await accepted(metaWithout({ licenseUrl: undefined }), "VRM 1.0 without a licence URL");
  await accepted(metaWithout({ licenseUrl: 42 }), "VRM 1.0 with a licence URL that is not text");
  // The refusals above are needed: the loader fails on each of these too.
  for (const [bytes, label] of [
    [withBones({ leftEye: { node: 999 } }), "an optional bone past the nodes"],
    [withBones({ leftEye: null }), "a bone entry that is not an object"],
    [withBones({ leftEye: {} }), "a bone entry without a node"],
    [glb({ ...vrm1(), scenes: undefined }), "a model without a scene"],
  ] as const) {
    await assert.rejects(loadInStage(bytes), Error, `the stage cannot load ${label} either`);
  }

  // Faces that hold the mouth (VRM 1.0 overrideMouth): lip sync still moves the mouth, and a faded face
  // that blocked blinking lets the eyes blink again.
  const faces = glb(
    vrm1(
      {},
      {
        expressions: {
          preset: {
            happy: { ...FACE, overrideMouth: "blend", overrideBlink: "block" },
            sad: { ...FACE, overrideMouth: "block" },
            aa: FACE,
            blink: FACE,
          },
        },
      },
    ),
  );
  const facesValidated = await vrmImporter.validate(input(faces));
  const map = buildVrmImport(facesValidated, input(faces), null).data.expressionMap;
  const drive = async (soften: boolean) => {
    const vrm = await loadInStage(faces);
    const expressions = vrm.expressionManager;
    assert.ok(expressions);
    const applied = { aa: 0, blink: 0 };
    for (const name of ["aa", "blink"] as const) {
      expressions.getExpression(name)?.addBind({
        applyWeight: (weight) => {
          applied[name] = weight;
        },
        clearAppliedWeight: () => {
          applied[name] = 0;
        },
      });
    }
    const holders = soften
      ? motion.softenMouthOverrides(map, (name) => expressions.getExpression(name))
      : new Set<string>();
    const weights = motion.createExpressionWeights();
    const run = (frame: Record<string, unknown>, frames: number) => {
      for (let step = 0; step < frames; step += 1) {
        motion.stepExpressionWeights(weights, map, frame as never, { lipSync: true }, 1 / 30, holders);
        for (const [name, weight] of weights) expressions.setValue(name, weight);
        expressions.update();
      }
    };
    const mouth: Record<string, number> = {};
    for (const emotion of ["happy", "sad"]) {
      run({ emotion, emotionWeight: 1, viseme: "aa", mouthOpen: 1, state: "talking" }, 30);
      mouth[emotion] = applied.aa;
    }
    run({ emotion: "neutral", emotionWeight: 1, viseme: null, mouthOpen: 0, state: "idle" }, 60);
    expressions.setValue("blink", 1);
    expressions.update();
    return { holders, mouth, blink: applied.blink };
  };
  const unsoftened = await drive(false);
  assert.ok(unsoftened.mouth.happy < 0.05 && unsoftened.mouth.sad < 0.05, "three-vrm alone freezes the mouth");
  const softened = await drive(true);
  assert.deepEqual([...softened.holders].sort(), ["happy", "sad"], "both faces that hold the mouth are found");
  assert.ok(softened.mouth.happy > 0.5, `the mouth moves while happy (aa ${softened.mouth.happy.toFixed(2)})`);
  assert.ok(
    softened.mouth.sad > 0.5,
    `the mouth moves while sad, a "block" face (aa ${softened.mouth.sad.toFixed(2)})`,
  );
  assert.equal(softened.blink, 1, "once happy has faded, its blink block no longer holds the eyes open");
  globalThis.fetch = realFetch;
  console.warn = realWarn;
}

// ── Generated models: colours under the Engine's CSP, and a body that visibly moves ──
// A model with no mouth shapes shows life and speech with its body: it sways clearly more than a model with a
// face, and nods with each phrase instead of averaging speech out. A model with a face moves as it always did.
{
  const idle = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" } as const;
  const swing = (bodyOnly: boolean) => {
    const state = motion.createIdleMotionState();
    let min = Infinity;
    let max = -Infinity;
    for (let step = 0; step < 300; step += 1) {
      const pose = motion.computeBodyPose(state, step / 30, idle, true, 1 / 30, bodyOnly);
      const yaw = pose.hips[1] + pose.neck[1] + pose.head[1];
      min = Math.min(min, yaw);
      max = Math.max(max, yaw);
    }
    return max - min;
  };
  assert.ok(swing(true) > 2 * swing(false), "a body-only model sways visibly more");
  assert.ok(swing(true) > 0.15, `the head turns several degrees over ten seconds (${swing(true).toFixed(3)} rad)`);
  /** Talks for `frames` 30 fps frames at each loudness in turn, and returns where the head ends up. */
  const nodAfter = (bodyOnly: boolean, phrases: Array<{ mouthOpen: number; frames: number }>) => {
    const state = motion.createIdleMotionState();
    let pose = motion.computeBodyPose(state, 0, idle, true, 0, bodyOnly);
    for (const { mouthOpen, frames } of phrases) {
      for (let step = 0; step < frames; step += 1) {
        pose = motion.computeBodyPose(state, 0, { ...idle, mouthOpen, state: "talking" }, true, 1 / 30, bodyOnly);
      }
    }
    return { nod: pose.head[0] + pose.neck[0], tilt: pose.head[2] };
  };
  const phrase = nodAfter(true, [{ mouthOpen: 1, frames: 6 }]).nod;
  const pause = nodAfter(true, [
    { mouthOpen: 1, frames: 6 },
    { mouthOpen: 0, frames: 6 },
  ]).nod;
  assert.ok(phrase > 0.07, `a phrase nods the head within 0.2 s (${phrase.toFixed(3)} rad)`);
  assert.ok(pause < 0.02, `a pause lifts it again within 0.2 s (${pause.toFixed(3)} rad)`);
  const face = nodAfter(false, [{ mouthOpen: 1, frames: 6 }]);
  // The nod a model with a face has always had: 0.04 rad at full voice, eased over 0.35 s.
  assert.ok(Math.abs(face.nod - 0.04 * (1 - Math.exp(-0.2 / 0.35))) < 1e-12, "a model with a face nods as before");
  assert.equal(face.tilt, 0, "and does not tilt its head while talking");
  const off = motion.createIdleMotionState();
  const still = motion.computeBodyPose(off, 3, { ...idle, mouthOpen: 1, state: "talking" }, false, 1 / 30, true);
  assert.deepEqual(still.head, [0, 0, 0], "reduced motion keeps the body still");
}
// The browser loads a model's pictures through GLTFLoader. Here Node plays a browser whose connect-src refuses
// blob: URLs, as the Engine's does: fetch() refuses them, and pictures load as images (img-src allows blob:).
{
  const { loadStoredVrm } = await import("../../packages/client/src/features/avatars/renderers/vrm/vrm-renderer.js");
  const { generatedVrm } = await import("./fixtures/avatar-3d-fixtures.js");
  const served = await generatedVrm([200, 60, 40]);
  const pictures: string[] = [];
  class PageImage extends EventTarget {
    crossOrigin: string | null = null;
    set src(url: string) {
      pictures.push(url);
      setTimeout(() => this.dispatchEvent(new Event("load")));
    }
  }
  const page: Record<string, unknown> = {
    self: globalThis,
    document: { createElementNS: () => new PageImage() },
    createImageBitmap: () => Promise.reject(new Error("Pictures never reach createImageBitmap here.")),
  };
  const realFetch = globalThis.fetch;
  Object.assign(globalThis, page);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input instanceof Request ? input.url : input).startsWith("blob:")) {
      throw new TypeError("Refused to connect because it violates the document's Content Security Policy.");
    }
    return new Response(served);
  }) as typeof fetch;
  try {
    const gltf = await loadStoredVrm(owner, VRM_MODEL_FILE, new AbortController().signal);
    const materials: Array<Record<string, { image?: unknown } | null>> = [];
    gltf.scene.traverse((object) => {
      const material = (object as { material?: Record<string, { image?: unknown } | null> }).material;
      if (material) materials.push(material);
    });
    assert.equal(materials.length, 1, "the generated model has one material");
    const [material] = materials;
    assert.ok(material!.map?.image instanceof PageImage, "the colour map loads, as an image");
    assert.ok(material!.normalMap && material!.roughnessMap, "so do the normal and roughness maps");
    assert.equal(pictures.length, 3);
    assert.ok(
      pictures.every((url) => url.startsWith("blob:")),
      "from the model's own bytes",
    );

    // No idle animation: the built-in idle pose turns the Mixamo head, through three-vrm's normalized bones.
    const vrm = gltf.userData.vrm as {
      humanoid: {
        getNormalizedBoneNode(bone: string): { rotation: { set(x: number, y: number, z: number): void } } | null;
        getRawBoneNode(bone: string): {
          name: string;
          getWorldQuaternion<T>(target: T): T;
          quaternion: { clone(): { angleTo(other: unknown): number } };
        } | null;
      };
      update(dt: number): void;
    };
    const head = vrm.humanoid.getRawBoneNode("head")!;
    // three drops the colon from node names.
    assert.equal(head.name, "mixamorigHead", "the head is the Mixamo joint itself");
    const idle = { emotion: "neutral", emotionWeight: 0, viseme: null, mouthOpen: 0, state: "idle" } as const;
    const state = motion.createIdleMotionState();
    const turn = (step: number) => {
      const pose = motion.computeBodyPose(state, step / 30, idle, true, 1 / 30, true);
      for (const bone of motion.POSE_BONES) vrm.humanoid.getNormalizedBoneNode(bone)?.rotation.set(...pose[bone]);
      vrm.update(1 / 30);
      return head.getWorldQuaternion(head.quaternion.clone());
    };
    const start = turn(0);
    let end = start;
    for (let step = 1; step <= 60; step += 1) end = turn(step);
    const turned = start.angleTo(end);
    assert.ok(turned > 0.12, `the head visibly turns on its own within two seconds (${turned.toFixed(3)} rad)`);
  } finally {
    globalThis.fetch = realFetch;
    for (const name of Object.keys(page)) delete (globalThis as Record<string, unknown>)[name];
  }
}

console.log("avatar VRM regression passed");
