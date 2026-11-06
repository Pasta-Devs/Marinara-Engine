/**
 * The shared contract of the 2D and 3D avatar agents:
 *   - every sprite label the Engine suggests maps to one of the six VRM emotions, and free-form labels
 *     (Game Master lines, custom sprite names) map through word stems, a feeling's name, or not at all;
 *   - sprite labels bind to emotions with a source and a confidence, and to the 23 extra feelings by whole words;
 *   - avatar.json and its stored paths stay inside the owner's folder;
 *   - the 2D agent's generation prompts merge like other built-in template collections;
 *   - the contract stubs are inert: no importer claims a file and no avatar route is registered;
 *   - three, @pixiv/three-vrm and mesh-avatar are imported only by the lazy renderer modules.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const Fastify = createRequire(new URL("../../packages/server/package.json", import.meta.url))("fastify");

const {
  AVATAR_2D_AGENT_ID,
  AVATAR_EMOTIONS,
  AVATAR_EXTRA_FEELINGS,
  AVATAR_FACE_GROUPS,
  AVATAR_FEELINGS,
  AVATAR_FEELING_EMOTIONS,
  AVATAR_PROMPT_TEMPLATE_IDS,
  AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY,
  SPRITE_EXPRESSION_AVATAR_EMOTIONS,
  SPRITE_EXPRESSION_LABELS,
  avatarConfigSchema,
  avatarConfigUpdateSchema,
  avatarModelFileUrl,
  createAvatarConfig,
  detectSpriteEmotionBindings,
  detectSpriteFeelingBindings,
  isAvatarExtraFeeling,
  isAvatarFilePath,
  mapSpriteExpressionToAvatarEmotion,
  mapSpriteExpressionToAvatarFeeling,
  mergeBuiltInAgentSettings,
  replaceBuiltInAgentDefinitions,
} = await import("../../packages/shared/src/index.js");
const { findAvatarImporter } = await import("../../packages/server/src/services/avatars/formats/registry.js");
const { avatarModelsRoutes } = await import("../../packages/server/src/routes/avatar-models.routes.js");
const { avatarClassifyRoutes } = await import("../../packages/server/src/routes/avatar-classify.routes.js");
const { avatarGenerationRoutes } = await import("../../packages/server/src/routes/avatar-generation.routes.js");

// ── Sprite labels → emotions ──
for (const label of SPRITE_EXPRESSION_LABELS) {
  const mapped = mapSpriteExpressionToAvatarEmotion(label);
  assert.ok(mapped, `the suggested sprite label ${label} maps to an emotion`);
  assert.ok(AVATAR_EMOTIONS.includes(mapped.emotion));
  assert.ok(mapped.weight > 0 && mapped.weight <= 1, `${label} carries a weight in (0, 1]`);
}
assert.deepEqual(mapSpriteExpressionToAvatarEmotion("full_Happy-2"), { emotion: "happy", weight: 1 });
assert.deepEqual(mapSpriteExpressionToAvatarEmotion("love"), { emotion: "relaxed", weight: 1 });
assert.deepEqual(mapSpriteExpressionToAvatarEmotion("sorrow"), { emotion: "sad", weight: 1 }, "VRM 0.x name");
assert.equal(mapSpriteExpressionToAvatarEmotion("unhappy")?.emotion, "sad", "a negated stem wins over the stem");
assert.equal(mapSpriteExpressionToAvatarEmotion("courageous")?.emotion, "happy", "courage is not rage");
assert.equal(mapSpriteExpressionToAvatarEmotion("terrified")?.emotion, "surprised");
assert.equal(mapSpriteExpressionToAvatarEmotion("furious glare")?.emotion, "angry");
assert.equal(mapSpriteExpressionToAvatarEmotion("xyzzy"), null, "an unknown label maps to nothing");
assert.equal(mapSpriteExpressionToAvatarEmotion(""), null);
assert.equal(mapSpriteExpressionToAvatarEmotion(undefined), null);

const bindings = detectSpriteEmotionBindings(["smirk", "happy", "crying", "worried"]);
assert.deepEqual(
  bindings.happy,
  { target: "happy", source: "sprite-label", confidence: 1 },
  "the strongest label wins",
);
assert.deepEqual(bindings.sad, { target: "crying", source: "sprite-label", confidence: 1 });
assert.deepEqual(bindings.angry, { target: null, source: "missing", confidence: 0 });
assert.deepEqual(Object.keys(bindings).sort(), [...AVATAR_EMOTIONS].sort(), "every emotion gets a binding");
assert.deepEqual(
  detectSpriteEmotionBindings(["love", "relaxed", "Happy", "smile"]).relaxed,
  { target: "relaxed", source: "sprite-label", confidence: 1 },
  "a face named after the feeling wins over an earlier label of the same strength",
);
assert.equal(
  detectSpriteEmotionBindings(["smile", "Happy"]).happy?.target,
  "Happy",
  "the named face keeps its spelling",
);

// ── avatar.json ──
const owner = { ownerType: "character", ownerId: "V1StGXR8_Z5jdHi6B-myT" } as const;
const config = createAvatarConfig(owner, "2026-10-13T12:00:00.000Z");
assert.ok(avatarConfigSchema.safeParse(config).success, "a fresh config is valid");
const withVrm = {
  ...config,
  activeKind: "vrm",
  kinds: { vrm: { file: "vrm/model.vrm", specVersion: "1.0", expressionMap: bindings, idleAnimation: null } },
};
assert.ok(avatarConfigSchema.safeParse(withVrm).success, "a VRM setup is valid");
assert.equal(avatarConfigSchema.safeParse({ ...config, activeKind: "vrm" }).success, false, "active kind must exist");
assert.equal(
  avatarConfigSchema.safeParse({ ...withVrm, kinds: { vrm: { ...withVrm.kinds.vrm, file: "vrm/../../secret" } } })
    .success,
  false,
  "a stored path cannot leave the owner's folder",
);
assert.equal(
  avatarConfigSchema.safeParse({ ...withVrm, kinds: { vrm: { ...withVrm.kinds.vrm, file: "pngtuber/model.vrm" } } })
    .success,
  false,
  "a VRM file lives in vrm/",
);
assert.equal(
  avatarConfigSchema.safeParse({ ...config, owner: { ownerType: "character", ownerId: "../x" } }).success,
  false,
  "an owner id is one safe folder name",
);
assert.equal(avatarConfigSchema.safeParse({ ...config, extra: true }).success, false, "unknown keys are refused");
assert.equal(avatarConfigUpdateSchema.safeParse({ features: { lipSync: false } }).success, true);
for (const path of ["vrm/model.vrm", "pngtuber/happy_eyes-closed.png", "mesh-avatar/model.mavatar"]) {
  assert.ok(isAvatarFilePath(path), `${path} is a stored path`);
}
for (const path of [
  "/vrm/model.vrm",
  "vrm/../x",
  "vrm/a/b.vrm",
  "vrm/.hidden",
  "vrm/model.",
  "sprites/a.png",
  "vrm\\a",
  "vrm/NUL.vrm",
  "pngtuber/con.png",
  "mesh-avatar/Com1",
  "vrm/lpt9.vrma",
]) {
  assert.equal(isAvatarFilePath(path), false, `${path} is refused`);
}
assert.ok(isAvatarFilePath("vrm/console.vrm"), "a name that only starts like a device name is fine");
assert.equal(
  avatarConfigSchema.safeParse({ ...withVrm, kinds: { vrm: { ...withVrm.kinds.vrm, file: "vrm/aux.vrm" } } }).success,
  false,
  "the schema refuses Windows device names too",
);
assert.equal(
  avatarModelFileUrl({ ownerType: "persona", ownerId: "abc" }, "pngtuber/a.png"),
  "/api/avatar-models/persona/abc/files/pngtuber/a.png",
);

// ── The 2D agent's generation prompts merge like other template collections ──
replaceBuiltInAgentDefinitions([
  {
    id: AVATAR_2D_AGENT_ID,
    name: "2D Avatars",
    description: "",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    execution: "host",
    defaultSettings: {
      [AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY]: [
        { id: AVATAR_PROMPT_TEMPLATE_IDS.pngtuberEyesClosed, name: "Eyes closed", promptTemplate: "default A" },
        { id: AVATAR_PROMPT_TEMPLATE_IDS.pngtuberMouthOpen, name: "Mouth open", promptTemplate: "default B" },
      ],
    },
  },
]);
const merged = mergeBuiltInAgentSettings(AVATAR_2D_AGENT_ID, {
  [AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY]: [
    { id: AVATAR_PROMPT_TEMPLATE_IDS.pngtuberEyesClosed, name: "Eyes closed", promptTemplate: "edited A" },
  ],
});
assert.deepEqual(
  (merged[AVATAR_PROMPT_TEMPLATE_SETTINGS_KEY] as { id: string; promptTemplate: string }[]).map((entry) => [
    entry.id,
    entry.promptTemplate,
  ]),
  [
    [AVATAR_PROMPT_TEMPLATE_IDS.pngtuberEyesClosed, "edited A"],
    [AVATAR_PROMPT_TEMPLATE_IDS.pngtuberMouthOpen, "default B"],
  ],
  "a user edit is kept and a new default template still arrives",
);
replaceBuiltInAgentDefinitions([]);

// ── Stubs are inert ──
assert.equal(
  findAvatarImporter({ filename: "model.vrm", head: new TextEncoder().encode("glTF") }),
  null,
  "no importer claims a file until a lane fills it in",
);
const app = Fastify();
await app.register(avatarModelsRoutes, { prefix: "/api/avatar-models" });
await app.register(avatarClassifyRoutes, { prefix: "/api/avatar-classify" });
await app.register(avatarGenerationRoutes, { prefix: "/api/avatar-generation" });
await app.ready();
for (const url of ["/api/avatar-classify", "/api/avatar-generation/mesh-rig"]) {
  assert.equal((await app.inject({ method: "GET", url })).statusCode, 404, `${url} is not served yet`);
}
// The base lane serves avatar models (scripts/regressions/avatar-models.regression.ts covers the routes).
assert.equal((await app.inject({ method: "GET", url: "/api/avatar-models" })).statusCode, 200);
await app.close();

// ── Renderer libraries only in the lazy renderer modules ──
const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const clientSrc = join(repoRoot, "packages", "client", "src");
const rendererRoot = join(clientSrc, "features", "avatars", "renderers") + sep;
const heavyImport =
  /(?:from\s+|import\s*\(\s*|import\s+)["'](?:three(?:\/[^"']*)?|@pixiv\/[^"']+|@takahirox\/three-mmd(?:\/[^"']*)?|mmd-parser|mesh-avatar)["']/u;
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(?:ts|tsx)$/u.test(name) ? [path] : [];
  });
}
for (const file of walk(clientSrc)) {
  if (file.startsWith(rendererRoot)) continue;
  assert.equal(
    heavyImport.test(readFileSync(file, "utf8")),
    false,
    `${relative(repoRoot, file)} imports a renderer library outside features/avatars/renderers`,
  );
}
const contractSource = readFileSync(join(clientSrc, "features", "avatars", "contract.ts"), "utf8");
assert.equal(/^import[^;]*["']\.\/renderers\//mu.test(contractSource), false, "renderers load only by import()");

// ── The 28 detected feelings ──
assert.equal(AVATAR_FEELINGS.length, 28);
assert.deepEqual(
  Object.keys(AVATAR_FEELING_EMOTIONS).sort(),
  [...AVATAR_FEELINGS].sort(),
  "every feeling has an emotion",
);
const folded = ["neutral", "joy", "anger", "sadness", "surprise"];
assert.equal(AVATAR_EXTRA_FEELINGS.length, 23);
assert.deepEqual(
  [...AVATAR_EXTRA_FEELINGS, ...folded].sort(),
  [...AVATAR_FEELINGS].sort(),
  "the extra feelings are the 28 less the five main faces",
);
assert.deepEqual(
  folded.map((feeling) => AVATAR_FEELING_EMOTIONS[feeling as keyof typeof AVATAR_FEELING_EMOTIONS].emotion),
  ["neutral", "happy", "angry", "sad", "surprised"],
);
assert.deepEqual(
  AVATAR_FACE_GROUPS.map((group) => group[0]),
  [...AVATAR_EMOTIONS],
  "faces group under the six in their order",
);
assert.deepEqual(
  AVATAR_FACE_GROUPS.flatMap((group) => group.slice(1)),
  [...AVATAR_EXTRA_FEELINGS],
  "extra feelings are listed by group",
);
for (const [emotion, ...feelings] of AVATAR_FACE_GROUPS) {
  for (const feeling of feelings) assert.equal(AVATAR_FEELING_EMOTIONS[feeling].emotion, emotion);
}
assert.equal(isAvatarExtraFeeling("fear"), true);
assert.equal(isAvatarExtraFeeling("joy"), false, "a main face is not an extra feeling");
assert.equal(isAvatarExtraFeeling("toString"), false);

// ── Sprite labels → feelings ──
for (const label of SPRITE_EXPRESSION_LABELS) {
  assert.deepEqual(
    mapSpriteExpressionToAvatarEmotion(label),
    SPRITE_EXPRESSION_AVATAR_EMOTIONS[label],
    `the suggested label ${label} keeps its emotion`,
  );
}
for (const feeling of AVATAR_FEELINGS) {
  assert.equal(
    mapSpriteExpressionToAvatarEmotion(feeling)?.emotion,
    AVATAR_FEELING_EMOTIONS[feeling].emotion,
    `a sprite named ${feeling} shows its feeling's emotion, never neutral by default`,
  );
}
assert.deepEqual(mapSpriteExpressionToAvatarEmotion("gratitude"), { emotion: "happy", weight: 0.7 });
assert.deepEqual(mapSpriteExpressionToAvatarEmotion("smug"), { emotion: "happy", weight: 0.6 }, "a feeling's word");
for (const feeling of AVATAR_EXTRA_FEELINGS) assert.equal(mapSpriteExpressionToAvatarFeeling(feeling), feeling);
const feelingCases: Array<[string, string | null]> = [
  ["Fear_2", "fear"],
  ["full_Scared", "fear"],
  ["grossed out-2", "disgust"],
  ["Thumbs Up", "approval"],
  ["disapproving", "disapproval"],
  ["approving", "approval"],
  ["fear eyes", "fear"],
  ["in_love", "love"],
  // Judgement calls adopted for #7691: close words for a feeling.
  ["thinking", "curiosity"],
  ["crying", "grief"],
  ["smirk", "amusement"],
  ["smug", "pride"],
  ["ashamed", "remorse"],
  ["concerned", "nervousness"],
  // Whole words only: a feeling inside another word is not that feeling.
  ["scarecrow", null],
  ["careful", null],
  ["glove", null],
  ["fearless", null],
  ["hopeless", null],
  // The six main faces and labels with no feeling of their own.
  ["happy", null],
  ["joy", null],
  ["determined", null],
  ["hurt", null],
  ["", null],
];
for (const [label, feeling] of feelingCases) {
  assert.equal(mapSpriteExpressionToAvatarFeeling(label), feeling, `${JSON.stringify(label)} names ${feeling}`);
}
assert.equal(mapSpriteExpressionToAvatarFeeling(undefined), null);
assert.deepEqual(
  detectSpriteFeelingBindings(["scared", "happy", "fear", "blush", "embarrassed", "smile"]),
  {
    fear: { target: "fear", source: "sprite-label", confidence: 1 },
    embarrassment: { target: "blush", source: "sprite-label", confidence: 0.8 },
  },
  "a feeling's own name beats another word for it; a tie keeps the first; only feelings found are written",
);
assert.deepEqual(detectSpriteFeelingBindings(["neutral", "happy"]), {}, "no feeling, no binding");
assert.deepEqual(
  mapSpriteExpressionToAvatarEmotion("concerned"),
  { emotion: "sad", weight: 0.5 },
  "concerned is a worried face, like the Expression Engine reads it",
);
// A label whose own emotion is another one never becomes the feeling's face.
assert.deepEqual(
  detectSpriteFeelingBindings(["neutral", "sad", "crying_laughing", "sobbing"]),
  { grief: { target: "sobbing", source: "sprite-label", confidence: 0.8 } },
  "crying_laughing is happy, so sobbing is the grief face",
);
for (const label of [
  "crying_laughing",
  "happy_crying",
  "kind_of_happy",
  "sad_love",
  "scared_angry",
  "angry_flustered",
]) {
  assert.deepEqual(detectSpriteFeelingBindings(["neutral", "sad", label]), {}, `${label} is no feeling's face`);
}

// avatar.json with faces for extra feelings: no other key and no unknown feeling is accepted.
const withFeelings = {
  ...config,
  activeKind: "pngtuber",
  kinds: {
    pngtuber: {
      layers: {
        happy: { base: { source: "sprite", label: "happy" } },
        fear: { base: { source: "sprite", label: "fear" } },
      },
      expressionMap: { happy: { target: "happy", source: "sprite-label", confidence: 1 } },
      feelingMap: {
        fear: { target: "fear", source: "sprite-label", confidence: 1 },
        amusement: { target: null, source: "user", confidence: 1 },
      },
      motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 },
      source: "sprites",
    },
  },
};
assert.ok(
  avatarConfigSchema.safeParse(withFeelings).success,
  "a PNGTuber setup with faces for extra feelings is valid",
);
const withFeelingMap = (feelingMap: unknown) => ({
  ...withFeelings,
  kinds: { pngtuber: { ...withFeelings.kinds.pngtuber, feelingMap } },
});
for (const key of ["joy", "happy", "terror"]) {
  assert.equal(
    avatarConfigSchema.safeParse(withFeelingMap({ [key]: { target: "fear", source: "user", confidence: 1 } })).success,
    false,
    `${key} is not an extra feeling`,
  );
}
assert.equal(
  avatarConfigUpdateSchema.safeParse({ kinds: { pngtuber: withFeelings.kinds.pngtuber } }).success,
  true,
  "a save may carry the faces for extra feelings",
);

console.log("avatar contract regression passed");
