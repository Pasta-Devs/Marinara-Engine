/**
 * The rules the 2D avatar renderers follow, frame by frame:
 *   - an owner's expression sprites become a PNGTuber setup with no setup step: one face per sprite, with
 *     `_talk` and `_blink` sprites as its mouth-open and eyes-closed pictures, portraits before full-body;
 *   - sprites named after one of the 23 extra feelings (or a word for it) become that feeling's face, and are never
 *     cut by the 64-face cap;
 *   - a frame picks the exact sprite label first, then the face of its feeling when that belongs to its emotion,
 *     then the emotion's face, then the resting face;
 *   - the mouth opens on vowels and closes on consonants (it flaps with the syllables of streamed text),
 *     blinks come every 3 to 6 seconds, and a hop lasts one short arc;
 *   - a mesh avatar frame turns into the runtime's emotion tag or live expression, a held vowel or a voice
 *     level, and parameter overrides for reduced motion, director blinks and gaze that keep each feeling's
 *     eye shape; a drawing at the shared canvas's size maps onto each avatar's own canvas;
 *   - every 2D setup label the panels look up exists in the English catalog.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const layers = await import("../../packages/client/src/features/avatars/renderers/pngtuber/pngtuber-layers.ts");
const face = await import("../../packages/client/src/features/avatars/renderers/mesh-avatar/mesh-avatar-face.ts");
const { resolveAvatarImage } = await import("../../packages/client/src/features/avatars/stage/avatar-stage-logic.ts");

// ── Sprites → PNGTuber setup ──
const sprite = (expression: string) => ({ expression, url: `/api/sprites/c/file/${expression}.png` });
const data = layers.buildPngtuberLayersFromSprites(
  [
    "Smirk-2",
    "happy",
    "happy_talk",
    "Happy Blink",
    "happy_blink_talk",
    "full_angry",
    "neutral",
    "sad",
    "sad_mouth_open",
  ].map(sprite),
);
assert.ok(data);
assert.deepEqual(Object.keys(data.layers), ["neutral", "happy", "sad", "smirk_2"], "suggested labels first");
assert.deepEqual(data.layers.happy, {
  base: { source: "sprite", label: "happy" },
  mouthOpen: { source: "sprite", label: "happy_talk" },
  eyesClosed: { source: "sprite", label: "happy_blink" },
  eyesClosedMouthOpen: { source: "sprite", label: "happy_blink_talk" },
});
assert.deepEqual(data.layers.sad, {
  base: { source: "sprite", label: "sad" },
  mouthOpen: { source: "sprite", label: "sad_mouth_open" },
});
assert.equal(data.layers.angry, undefined, "a full-body sprite is not mixed in with portraits");
assert.deepEqual(data.expressionMap.happy, { target: "happy", source: "sprite-label", confidence: 1 });
assert.deepEqual(data.expressionMap.angry, { target: null, source: "missing", confidence: 0 });
assert.equal(data.source, "sprites");
assert.deepEqual(data.motion, { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 });

const fullBodyOnly = layers.buildPngtuberLayersFromSprites(["full_happy", "full_sad"].map(sprite));
assert.deepEqual(
  Object.keys(fullBodyOnly!.layers),
  ["happy", "sad"],
  "full-body sprites serve when there is nothing else",
);
assert.equal(layers.buildPngtuberLayersFromSprites([]), null, "no sprites, no setup");
assert.equal(layers.buildPngtuberLayersFromSprites([sprite("happy_talk")]), null, "a lone variant is not a face");
const many = layers.buildPngtuberLayersFromSprites(Array.from({ length: 80 }, (_, index) => sprite(`pose${index}`)));
assert.equal(Object.keys(many!.layers).length, 64, "a setup holds at most 64 faces, like the schema");
const manyFeelings = layers.buildPngtuberLayersFromSprites(
  [...Array.from({ length: 80 }, (_, index) => `pose${index}`), "remorse", "Scared"].map(sprite),
);
assert.deepEqual(
  Object.keys(manyFeelings!.layers).slice(0, 2),
  ["scared", "remorse"],
  "the suggested labels, then the feelings' names, come before other faces",
);
assert.deepEqual(manyFeelings!.feelingMap, {
  remorse: { target: "remorse", source: "sprite-label", confidence: 1 },
  fear: { target: "scared", source: "sprite-label", confidence: 0.8 },
});
assert.deepEqual(data.feelingMap, { amusement: { target: "smirk_2", source: "sprite-label", confidence: 0.8 } });
assert.deepEqual(
  Object.keys(layers.AVATAR_FEELING_LABEL_KEYS).sort(),
  ["admiration", "amusement", "annoyance", "approval", "caring", "confusion", "curiosity", "desire"]
    .concat(["disappointment", "disapproval", "disgust", "embarrassment", "excitement", "fear", "gratitude"])
    .concat(["grief", "love", "nervousness", "optimism", "pride", "realization", "relief", "remorse"]),
  "every extra feeling has a name",
);

assert.deepEqual(layers.splitSpriteVariant("happy_mouth_open_eyes_closed"), {
  base: "happy",
  mouthOpen: true,
  eyesClosed: true,
});
assert.deepEqual(layers.splitSpriteVariant("talk"), { base: "talk", mouthOpen: false, eyesClosed: false });
assert.deepEqual(
  ["happy", "happy_talk", "Happy Blink", "full_sad_mouth_open", "talk"].filter(
    (expression) => !layers.isSpriteVariant(expression),
  ),
  ["happy", "talk"],
  "a talk or blink picture belongs to another face, so generation never offers it as a source",
);

// Pictures resolve through the stage's resolveAvatarImage, the one resolver the renderer and the panel use.
const owner = { ownerType: "character", ownerId: "c" } as const;
const saved = { updatedAt: "2026-10-13T12:00:00.000Z" };
assert.equal(
  resolveAvatarImage(owner, saved, [], { source: "file", path: "pngtuber/a.png" }),
  "/api/avatar-models/character/c/files/pngtuber/a.png?v=2026-10-13T12%3A00%3A00.000Z",
);
// A sprite face is shown as the sprite itself, never a cut-out of it.
assert.equal(
  resolveAvatarImage(owner, saved, [sprite("full_happy"), sprite("happy")], { source: "sprite", label: "happy" }),
  "/api/sprites/c/file/happy.png",
  "the portrait wins over the full-body sprite with the same face",
);
assert.equal(
  resolveAvatarImage(owner, saved, [sprite("full_happy")], { source: "sprite", label: "happy" }),
  "/api/sprites/c/file/full_happy.png",
  "a full-body face resolves when there is no portrait",
);
assert.equal(resolveAvatarImage(owner, saved, [sprite("happy")], { source: "sprite", label: "gone" }), null);

// ── Which face a frame shows ──
assert.equal(layers.pickPngtuberLayerKey(data, { emotion: "sad", label: "full_Happy" }), "happy", "the exact label");
assert.equal(layers.pickPngtuberLayerKey(data, { emotion: "sad", label: "glare" }), "sad", "else the emotion");
assert.equal(layers.pickPngtuberLayerKey(data, { emotion: "angry" }), "neutral", "else the resting face");
assert.equal(
  layers.pickPngtuberLayerKey(
    { layers: { b: data.layers.sad!, a: data.layers.happy! }, expressionMap: {} },
    { emotion: "angry" },
  ),
  "b",
  "else the first face",
);
{
  const feelingData = layers.buildPngtuberLayersFromSprites(["neutral", "happy", "embarrassed", "sad"].map(sprite))!;
  const pick = (frame: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    layers.pickPngtuberLayerKey({ ...feelingData, ...extra }, frame as never);
  assert.equal(pick({ emotion: "happy", feeling: "embarrassment" }), "embarrassed", "the feeling's face");
  assert.equal(
    pick({ emotion: "happy", feeling: "embarrassment", label: "Sad" }),
    "sad",
    "an exact label still comes first",
  );
  assert.equal(pick({ emotion: "sad", feeling: "embarrassment" }), "sad", "a feeling of another emotion is ignored");
  assert.equal(
    pick({ emotion: "happy", feeling: "gratitude" }),
    "happy",
    "a feeling without a face shows its emotion's",
  );
  assert.equal(
    pick(
      { emotion: "happy", feeling: "embarrassment" },
      { feelingMap: { embarrassment: { target: null, source: "user", confidence: 1 } } },
    ),
    "happy",
    "the user chose the main face for it",
  );
  assert.equal(
    pick({ emotion: "happy", feeling: "embarrassment" }, { feelingMap: undefined }),
    "happy",
    "an older setup",
  );
}
// ── The talking head's faces on the generation panel ──
// One row per face the six feelings show, in feeling order, with every feeling that shows it.
{
  const set = (label: string) => ({ base: { source: "sprite" as const, label } });
  const bind = (target: string | null, source: "sprite-label" | "user" = "sprite-label") => ({
    target,
    source,
    confidence: 1,
  });
  const labelFor = (key: string) => (key === "imported" ? null : `${key}_sprite`);
  const saved = {
    layers: {
      neutral: set("neutral"),
      smile: set("smile"),
      glare: set("glare"),
      imported: set("imported"),
    },
    expressionMap: {
      neutral: bind("neutral"),
      happy: bind("smile"),
      angry: bind(null, "user"),
      sad: bind("gone"),
      relaxed: bind("smile"),
      surprised: bind("imported"),
    },
    motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 },
    source: "generated" as const,
  };
  // Sprites made after the setup was saved: a sad face, and an angry one the user chose not to use.
  const fresh = layers.buildPngtuberLayersFromSprites(["neutral", "sad", "angry"].map(sprite));
  const faces = layers.talkingHeadFaces(saved, fresh, labelFor);
  assert.deepEqual(
    faces.map((entry) => [entry.key, entry.emotions, entry.label]),
    [
      ["neutral", ["neutral", "angry"], "neutral_sprite"],
      ["smile", ["happy", "relaxed"], "smile_sprite"],
      ["sad", ["sad"], "sad_sprite"],
      ["imported", ["surprised"], null],
    ],
    "two feelings on one face share a row; the user's resting choice stays; unbound faces (glare) are left out",
  );
  assert.equal(faces[0]!.set, saved.layers.neutral, "a saved face shows its saved pictures");
  assert.deepEqual(faces[2]!.set, fresh!.layers.sad, "a face made for a feeling the setup lacks is offered");
  assert.deepEqual(
    layers.talkingHeadFaces(fresh, fresh, labelFor).map((entry) => [entry.key, entry.emotions]),
    [
      ["neutral", ["neutral", "happy", "relaxed", "surprised"]],
      ["angry", ["angry"]],
      ["sad", ["sad"]],
    ],
    "without a saved setup the sprites are the talking head, feelings without a face on the resting face",
  );
  assert.deepEqual(
    layers
      .talkingHeadFaces({ ...saved, source: "pngtuber-plus" }, fresh, labelFor)
      .map((entry) => [entry.key, entry.emotions]),
    [
      ["neutral", ["neutral", "angry", "sad"]],
      ["smile", ["happy", "relaxed"]],
      ["imported", ["surprised"]],
    ],
    "a PNGTuber Plus import keeps its own faces: no sprite face joins it",
  );
  assert.deepEqual(layers.talkingHeadFaces(null, null, labelFor), [], "no setup and no sprites, no faces");

  // Extra feelings list the faces they have of their own, after the six; the others ride on their emotion's row.
  const withFeelings = {
    ...saved,
    layers: { ...saved.layers, fear_face: set("fear_face") },
    feelingMap: {
      fear: bind("fear_face", "user"),
      amusement: bind("smile"),
      gratitude: bind(null, "user"),
      pride: bind("gone"),
    },
  };
  // Sprites made since: a pride face, and a gratitude face the user chose not to use.
  const freshFeelings = layers.buildPngtuberLayersFromSprites(["neutral", "pride", "gratitude"].map(sprite));
  const listed = (shown: typeof withFeelings) =>
    layers.talkingHeadFaces(shown, freshFeelings, labelFor).map((entry) => [entry.key, entry.emotions, entry.feelings]);
  assert.deepEqual(
    listed(withFeelings),
    [
      ["neutral", ["neutral", "angry", "sad"], []],
      ["smile", ["happy", "relaxed"], ["amusement"]],
      ["imported", ["surprised"], []],
      ["pride", [], ["pride"]],
      ["fear_face", [], ["fear"]],
    ],
    "own faces and new sprite faces for extra feelings join the list; the user's main-face choice adds no row",
  );
  assert.deepEqual(
    listed({ ...withFeelings, source: "pngtuber-plus" }).map(([key]) => key),
    ["neutral", "smile", "imported", "fear_face"],
    "no sprite face joins a PNGTuber Plus import for a feeling either",
  );
}

const happy = data.layers.happy!;
assert.equal(layers.pickPngtuberPicture(happy, true, true), happy.eyesClosedMouthOpen);
assert.equal(layers.pickPngtuberPicture(data.layers.sad!, true, true), data.layers.sad!.mouthOpen, "talking wins");
assert.equal(layers.pickPngtuberPicture(data.layers.sad!, false, true), data.layers.sad!.base, "no blink picture");

// ── Mouth, blink, hop ──
assert.equal(layers.nextPngtuberMouthOpen(false, 0.35), false, "a consonant-sized level does not open the mouth");
assert.equal(layers.nextPngtuberMouthOpen(false, 0.5), true, "a vowel opens it");
assert.equal(layers.nextPngtuberMouthOpen(true, 0.32), true, "stays open until the level really drops");
assert.equal(layers.nextPngtuberMouthOpen(true, 0.2), false, "a consonant closes it");

// Text lip sync: per character, vowels open 0.5-1, other letters 0.2, labials 0 and a word gap 0.1, each for
// 1/14 s, eased with a 50 ms attack and an 80 ms release (the director lane's speech clock). The talk picture
// has to flap with the syllables, not hang open for whole sentences.
{
  const sentence = "Well, I really think we should go to the market before it closes tonight.";
  const unitMs = 1000 / 14;
  const target = (char: string) =>
    /[aeiouy]/iu.test(char)
      ? (({ a: 1, o: 0.8, e: 0.65, u: 0.55 } as Record<string, number>)[char.toLowerCase()] ?? 0.5)
      : /[mbp]/iu.test(char)
        ? 0
        : /\p{L}/u.test(char)
          ? 0.2
          : char === " "
            ? 0.1
            : 0;
  const frameMs = 1000 / 30;
  let level = 0;
  let open = false;
  let openFrames = 0;
  let flaps = 0;
  let run = 0;
  let longestOpenMs = 0;
  const frames = Math.round((sentence.length * unitMs) / frameMs);
  for (let index = 0; index < frames; index += 1) {
    const goal = target(sentence[Math.min(sentence.length - 1, Math.floor((index * frameMs) / unitMs))]!);
    level += (goal - level) * (1 - Math.exp(-frameMs / (goal > level ? 50 : 80)));
    const next = layers.nextPngtuberMouthOpen(open, level);
    if (next && !open) flaps += 1;
    open = next;
    openFrames += open ? 1 : 0;
    run = open ? run + frameMs : 0;
    longestOpenMs = Math.max(longestOpenMs, run);
  }
  const seconds = (frames * frameMs) / 1000;
  assert.ok(flaps / seconds >= 1.5, `the mouth flaps with the syllables (${(flaps / seconds).toFixed(2)} per second)`);
  assert.ok(
    openFrames / frames <= 0.7,
    `and is not open most of the time (${((openFrames / frames) * 100).toFixed(0)}%)`,
  );
  assert.ok(longestOpenMs <= 800, `and never hangs open for long (${longestOpenMs.toFixed(0)} ms)`);
}

const clock = { waitMs: layers.pngtuberBlinkWaitMs(4.5, () => 0), closedMs: 0 };
assert.equal(clock.waitMs, 3000, "the shortest wait is two thirds of the average");
assert.equal(
  layers.pngtuberBlinkWaitMs(4.5, () => 1),
  6000,
  "the longest is four thirds",
);
assert.equal(
  layers.advancePngtuberBlink(clock, 2999, 4.5, () => 1),
  false,
);
assert.equal(
  layers.advancePngtuberBlink(clock, 1, 4.5, () => 1),
  true,
  "the eyes shut on time",
);
assert.equal(
  layers.advancePngtuberBlink(clock, layers.PNGTUBER_BLINK_MS - 1, 4.5, () => 1),
  true,
);
assert.equal(
  layers.advancePngtuberBlink(clock, 1, 4.5, () => 1),
  false,
  "and open again after one blink",
);
assert.equal(clock.waitMs, 6000, "the next wait is drawn afresh");

assert.equal(layers.pngtuberHop(0), 0);
assert.equal(layers.pngtuberHop(layers.PNGTUBER_HOP_MS / 2), 1);
assert.equal(layers.pngtuberHop(layers.PNGTUBER_HOP_MS), 0);
assert.deepEqual(layers.fitPngtuberPicture(200, 400, 100, 100, 0.1), { x: 0, y: 200, width: 200, height: 200 });
assert.deepEqual(layers.fitPngtuberPicture(400, 200, 100, 100, 0.1), { x: 110, y: 20, width: 180, height: 180 });

// ── Mesh avatar frames ──
const presets = Object.fromEntries(
  ["neutral", "happy", "angry", "sad", "relaxed", "surprised"].map((emotion) => [
    emotion,
    { target: emotion, source: "preset", confidence: 1 },
  ]),
);
assert.deepEqual(face.meshAvatarFace(presets, { emotion: "happy", emotionWeight: 0.8 }), {
  emotion: "happy",
  expression: "neutral",
});
assert.deepEqual(face.meshAvatarFace(presets, { emotion: "happy", emotionWeight: 0.1 }), {
  emotion: "neutral",
  expression: "neutral",
});
assert.deepEqual(
  face.meshAvatarFace(
    { ...presets, relaxed: { target: "shy", source: "user", confidence: 1 } },
    { emotion: "relaxed", emotionWeight: 1 },
  ),
  { emotion: "neutral", expression: "shy" },
  "a user can pick a live expression",
);
assert.deepEqual(face.meshAvatarFace({}, { emotion: "sad", emotionWeight: 1 }), {
  emotion: "sad",
  expression: "neutral",
});
assert.deepEqual(face.meshAvatarMouth({}, { viseme: "oh", mouthOpen: 0.6 }, true), { mode: "hold", vowel: "o" });
assert.deepEqual(face.meshAvatarMouth({}, { viseme: "oh", mouthOpen: 0.02 }, true), { mode: "hold", vowel: "n" });
assert.deepEqual(face.meshAvatarMouth({}, { viseme: null, mouthOpen: 1.4 }, true), { mode: "voice", level: 1 });
assert.deepEqual(face.meshAvatarMouth({}, { viseme: "aa", mouthOpen: 1 }, false), { mode: "off" });
// A text viseme keeps its vowel, but the director sets how far that vowel opens.
for (const [viseme, mouthOpen, vowel] of [
  ["aa", 0.2, "a"],
  ["oh", 0.6, "o"],
] as const) {
  assert.deepEqual(face.meshAvatarMouth({}, { viseme, mouthOpen }, true), { mode: "hold", vowel });
  assert.deepEqual(
    face.meshAvatarOverrides({}, { still: false, blink: true, eyeOpen: 1, mouthOpen }),
    { mouthOpen },
    `${viseme} keeps the director's ${mouthOpen} opening`,
  );
}
for (const [mouthOpen, expected] of [
  [-0.2, 0],
  [1.4, 1],
] as const) {
  assert.deepEqual(face.meshAvatarOverrides({}, { still: false, blink: true, eyeOpen: 1, mouthOpen }), {
    mouthOpen: expected,
  });
}
assert.deepEqual(
  face.meshAvatarOverrides({}, { still: false, blink: true, eyeOpen: 1 }),
  {},
  "voice and idle frames leave the runtime's own mouth opening alone",
);
assert.deepEqual(
  face.meshAvatarOverrides({ blink: 0.75, lookAt: { x: 2, y: -0.5 } }, { still: false, blink: true, eyeOpen: 1 }),
  { eyeLOpen: 0.25, eyeROpen: 0.25, gazeX: 1, gazeY: -0.5 },
);
assert.deepEqual(face.meshAvatarOverrides({}, { still: true, blink: false, eyeOpen: 1 }), {
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  bodyAngleX: 0,
  bodyAngleZ: 0,
  breath: 0,
  eyeLOpen: 1,
  eyeROpen: 1,
});
// With blinking off (or a director blink), the eyelid override keeps each feeling's own eye shape, the
// openness mesh-avatar 0.1.1's emotion presets hold: wide for surprised, narrowed for the others.
for (const [emotion, eyes] of Object.entries({ happy: 0.8, angry: 0.72, sad: 0.78, relaxed: 0.82, surprised: 1.18 })) {
  let eyeOpen = 1;
  for (let index = 0; index < 60; index += 1) eyeOpen = face.easeMeshAvatarEyes(eyeOpen, emotion as never, 1 / 30);
  assert.deepEqual(
    face.meshAvatarOverrides({}, { still: false, blink: false, eyeOpen }),
    { eyeLOpen: eyes, eyeROpen: eyes },
    `${emotion} keeps its eyes with blinking off`,
  );
}
assert.ok(face.easeMeshAvatarEyes(1, "surprised", 1 / 30) < 1.18, "the eyes ease toward a new face");
assert.deepEqual(face.meshAvatarOverrides({ blink: 0.5 }, { still: false, blink: true, eyeOpen: 0.8 }), {
  eyeLOpen: 0.4,
  eyeROpen: 0.4,
});

// Evaluate the installed, pinned runtime's real composition step, including its lip-sync precedence.
// The identity overlay isolates parameter composition; WebGL and image loading are not needed here.
const meshRuntime = readFileSync(
  new URL("../../packages/client/node_modules/mesh-avatar/dist/index.js", import.meta.url),
  "utf8",
);
const composeBody = meshRuntime.match(/  function w\(M\) \{\n([\s\S]*?)\n  \}\n  function T\(M\)/u)?.[1];
assert.ok(composeBody, "the pinned runtime's parameter composition exists");
const compose = new Function("j", "P", "W", "J", "e", `let q; return function(M) {${composeBody}}`);
function runtimeParameters(
  overrides: Record<string, number>,
  open: number,
  held: number | null = open,
  preserve = false,
) {
  return compose(
    { update: () => ({ mouthOpen: open, mouthForm: -0.2 }), lipOpen: held, P: { mouthOpen: open, mouthForm: 0.4 } },
    overrides,
    1,
    { apply: (value: Record<string, number>) => value },
    { preserveMouthForm: preserve },
  )(1 / 60) as Record<string, number>;
}
for (const [viseme, mouthOpen, runtimeOpen] of [
  ["aa", 0.2, 0.9],
  ["oh", 0.6, 0.75],
  ["aa", -0.2, 0.9],
  ["oh", 1.4, 0.75],
] as const) {
  const overrides = face.meshAvatarOverrides({}, { still: false, blink: true, eyeOpen: 1, mouthOpen });
  assert.deepEqual(
    runtimeParameters(overrides, runtimeOpen),
    { mouthOpen: Math.max(0, Math.min(1, mouthOpen)), mouthForm: 0.4 },
    `${viseme} uses clock openness and retains the held vowel form`,
  );
}
assert.deepEqual(
  runtimeParameters({}, 0.58),
  { mouthOpen: 0.58, mouthForm: 0.4 },
  "voice without an override is unchanged",
);
assert.deepEqual(
  runtimeParameters({}, 0.06, null),
  { mouthOpen: 0.06, mouthForm: -0.2 },
  "idle without lip sync is unchanged",
);
assert.deepEqual(
  runtimeParameters({ mouthForm: -0.7 }, 0.58),
  { mouthOpen: 0.58, mouthForm: 0.4 },
  "default held form precedence is unchanged",
);
assert.deepEqual(
  runtimeParameters({ mouthForm: -0.7 }, 0.58, 0.58, true),
  { mouthOpen: 0.58, mouthForm: -0.7 },
  "preserved held form precedence is unchanged",
);
// The painted mouth opens over |s| < wf of the rig's halfLen (centre to lip corner): every vowel and motion
// opens across the whole drawn line, not only its middle.
const mouthWidth = meshRuntime.match(/float wf = ([^;]+);\n\s*float k = 1\.0 - \(s \/ wf\) \* \(s \/ wf\);/u)?.[1];
assert.ok(mouthWidth, "the pinned runtime's painted mouth width exists");
const paintedWidth = new Function("form", "mix", "clamp", `return ${mouthWidth};`) as (
  form: number,
  mix: unknown,
  clamp: unknown,
) => number;
for (const form of [-1, -0.85, -0.4, 0, 0.6, 0.9, 1]) {
  assert.equal(
    paintedWidth(
      form,
      (a: number, b: number, t: number) => a + (b - a) * t,
      (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)),
    ),
    1,
    `mouth form ${form} opens to the lip corners`,
  );
}

// Every mesh avatar draws at the shared canvas's size and is scaled onto its own canvas as if drawn there:
// mesh-avatar fits the picture plus margins, centred and standing on the bottom edge.
const rig = { image: { width: 100, height: 200 }, view: { padTop: 0.1, padSide: 0.05 } };
assert.deepEqual(face.meshAvatarCopyRect(rig, { width: 200, height: 400 }, { width: 200, height: 400 }), {
  x: 0,
  y: 0,
  width: 200,
  height: 400,
});
assert.deepEqual(
  face.meshAvatarCopyRect(rig, { width: 240, height: 480 }, { width: 120, height: 240 }),
  { x: 0, y: 0, width: 120, height: 240 },
  "the same shape scales straight down",
);
{
  // A wider slot than the shared canvas: the avatar keeps the height it would have, centred, on the ground.
  const drawn = { width: 200, height: 400 };
  const target = { width: 300, height: 300 };
  const box = (size: { width: number; height: number }) =>
    Math.min(size.width / (100 * 1.1), size.height / (200 * 1.1));
  const rect = face.meshAvatarCopyRect(rig, drawn, target);
  const scale = box(target) / box(drawn);
  assert.equal(rect.width, drawn.width * scale);
  assert.equal(rect.y + rect.height, target.height, "standing on the bottom edge");
  assert.equal(rect.x * 2 + rect.width, target.width, "centred");
  // The picture's height inside the slot is what the runtime would draw at the slot's own size.
  assert.equal(Math.round(200 * box(drawn) * scale * 1000), Math.round(200 * box(target) * 1000));
}

// ── Every 2D setup label exists in English ──
const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const english = JSON.parse(readFileSync(join(root, "packages/client/src/localization/locales/en.json"), "utf8"));
const known = new Set(Object.keys(english).map((key) => key.replace(/_(?:one|other)$/u, "")));
const rendererRoot = join(root, "packages/client/src/features/avatars/renderers");
assert.match(
  readFileSync(join(rendererRoot, "mesh-avatar/mesh-avatar-renderer.ts"), "utf8"),
  /meshAvatarOverrides\(frame,\s*\{[^}]*mouthOpen: mouth\.mode === "hold" \? frame\.mouthOpen : undefined/u,
  "only held text visemes supply the runtime openness override",
);
for (const folder of ["pngtuber", "mesh-avatar"]) {
  for (const file of readdirSync(join(rendererRoot, folder))) {
    const source = readFileSync(join(rendererRoot, folder, file), "utf8");
    for (const [key] of source.matchAll(/avatars\.(?:pngtuber|meshAvatar)\.[A-Za-z]+/gu)) {
      assert.ok(known.has(key), `${folder}/${file} uses ${key}, which en.json lacks`);
    }
  }
}

console.log("avatar 2D renderers regression passed");
