/**
 * Faces made from the avatar for a talking head that is already saved (a staging report: after "All faces", the
 * six main feelings kept showing the old sprites, and the new faces could not be chosen anywhere):
 *   - the face maker's new faces become their feelings' faces, over earlier picks, the user's own too; only the
 *     feelings it made change, every old sprite face stays as it was, and a face renamed in the last step
 *     (`happy_2`) is the face it was drawn as;
 *   - a new face starts from its sprite alone: talk and blink pictures made for an older picture are dropped from
 *     it (their files stay on disk);
 *   - a PNGTuber Plus import keeps its own faces, and a full setup gains no face past the 64-face cap, nor offers one;
 *   - the face lists offer every sprite face, sprites named after a feeling too, never talk, blink or full-body
 *     sprites, and nothing from sprites for a PNGTuber Plus import;
 *   - the result is a valid setup that saving blink and talk pictures keeps;
 *   - after a run that stopped early (#9653), Missing faces is the faces with no sprite of their name, in any folder
 *     or spelling, never one a feeling falls back to; blink and talk pictures count saved, still to make and waiting
 *     for a missing face out of all 58, and a face saved later frees its two without dropping the pictures made.
 * The setup and sprite list are the reporter's (GET /api/avatar-models and /api/sprites), with the owner renamed.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-avatar-main-faces-"));
process.env.DATA_DIR = dataDir;

const layers = await import("../../../packages/client/src/features/avatars/renderers/pngtuber/pngtuber-layers.ts");
const { AVATAR_EMOTIONS, AVATAR_EXTRA_FEELINGS, avatarKindDataSchema } =
  await import("../../../packages/shared/src/index.js");
const { mergePngtuberVariants } =
  await import("../../../packages/server/src/services/avatars/generation/pngtuber-variants.js");

try {
  const OLD_FACES = [
    "embarrassed",
    "thinking",
    "laughing",
    "scared",
    "disgusted",
    "smirk",
    "crying",
    "determined",
    "confused",
    "sleepy",
  ];
  const sprite = (label: string) => ({ base: { source: "sprite" as const, label } });
  const user = (target: string) => ({ target, source: "user" as const, confidence: 1 });
  const stored = {
    layers: Object.fromEntries(OLD_FACES.map((label) => [label, sprite(label)])),
    expressionMap: {
      neutral: { target: "smirk", source: "user" as const, confidence: 1 },
      happy: { target: "laughing", source: "sprite-label" as const, confidence: 1 },
      angry: { target: "disgusted", source: "sprite-label" as const, confidence: 0.5 },
      sad: { target: "crying", source: "sprite-label" as const, confidence: 1 },
      relaxed: { target: "sleepy", source: "sprite-label" as const, confidence: 0.6 },
      surprised: { target: "scared", source: "sprite-label" as const, confidence: 0.7 },
    },
    motion: { bounceOnTalk: true, bounceHeight: 0.06, blinkIntervalSeconds: 4.5 },
    source: "sprites" as const,
  };
  const before = structuredClone(stored);
  // The owner's sprites after "All faces": the 29 new faces beside the old portrait and full-body sprites.
  const sprites = [
    ...[...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS, ...OLD_FACES],
    ...["angry", "blushing", "confused", "crying", "determined", "disgusted", "embarrassed", "happy", "laughing"].map(
      (label) => `full_${label}`,
    ),
    ...["neutral", "sad", "scared", "sleepy", "smirk", "surprised", "thinking"].map((label) => `full_${label}`),
  ].map((expression) => ({ expression, url: `/api/sprites/maukie/file/${expression}.png?v=1` }));
  const fromSprites = layers.buildPngtuberLayersFromSprites(sprites);
  assert.ok(fromSprites);
  const labelFor = (key: string) => key;
  const shownFaces = (data: typeof stored) =>
    Object.fromEntries(AVATAR_EMOTIONS.map((emotion) => [emotion, layers.pickPngtuberLayerKey(data, { emotion })]));

  // ── The report: the saved setup still shows the old sprites for the six feelings ──
  assert.deepEqual(shownFaces(stored), {
    neutral: "smirk",
    happy: "laughing",
    angry: "disgusted",
    sad: "crying",
    relaxed: "sleepy",
    surprised: "scared",
  });

  // ── Every face list offers every sprite face, new ones named after a feeling too ──
  const choices = layers.pngtuberFaceChoices(stored, fromSprites);
  const offered = Object.keys(choices);
  assert.deepEqual(offered.slice(0, OLD_FACES.length), OLD_FACES, "the setup's own faces come first");
  for (const face of [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS, ...OLD_FACES]) {
    assert.ok(offered.includes(face), `${face} can be chosen`);
  }
  assert.equal(offered.length, 39, "29 new faces and the 10 old ones");
  assert.ok(!offered.some((key) => key.startsWith("full_")), "no full-body sprite joins a portrait setup");
  assert.deepEqual(choices.happy, sprite("happy"), "a new face is offered with its sprite");
  assert.equal(choices.smirk, stored.layers.smirk, "an old face keeps its saved pictures");
  const withTalk = layers.buildPngtuberLayersFromSprites(
    ["neutral", "happy", "happy_talk", "happy_blink"].map((expression) => ({ expression })),
  );
  assert.deepEqual(
    Object.keys(layers.pngtuberFaceChoices({ ...stored, layers: { neutral: sprite("neutral") } }, withTalk)),
    ["neutral", "happy"],
    "talk and blink sprites are a face's pictures, not faces",
  );
  assert.equal(
    layers.pngtuberFaceChoices({ ...stored, source: "pngtuber-plus" }, fromSprites),
    stored.layers,
    "a PNGTuber Plus import offers its own faces only",
  );
  assert.equal(layers.pngtuberFaceChoices(fromSprites, fromSprites), fromSprites.layers, "unsaved: the sprites");
  assert.deepEqual(layers.pngtuberFaceChoices(null, null), {}, "nothing to choose from");

  // ── Making the six main faces wires them in ──
  const mainRun = AVATAR_EMOTIONS.map((emotion) => ({ label: emotion, drawnAs: emotion }));
  const afterMain = layers.withGeneratedFaces(stored, mainRun);
  assert.deepEqual(stored, before, "the saved setup is not changed in place");
  for (const emotion of AVATAR_EMOTIONS) {
    assert.deepEqual(afterMain.expressionMap[emotion], user(emotion), `${emotion} shows its new face`);
    assert.deepEqual(afterMain.layers[emotion], sprite(emotion), `${emotion} has a face set of its own`);
  }
  assert.deepEqual(shownFaces(afterMain), Object.fromEntries(AVATAR_EMOTIONS.map((emotion) => [emotion, emotion])));
  for (const face of OLD_FACES) assert.deepEqual(afterMain.layers[face], before.layers[face], `${face} stays`);
  assert.deepEqual(afterMain.feelingMap, {}, "no extra feeling changes when none was made");
  assert.deepEqual(
    { motion: afterMain.motion, source: afterMain.source },
    { motion: before.motion, source: before.source },
  );
  assert.deepEqual(
    layers
      .talkingHeadFaces(afterMain, fromSprites, labelFor)
      .slice(0, 6)
      .map((face) => [face.key, face.emotions]),
    AVATAR_EMOTIONS.map((emotion) => [emotion, [emotion]]),
    "Blink and talk lists the new faces",
  );
  assert.ok(avatarKindDataSchema.safeParse({ pngtuber: afterMain }).success, "the PUT body is valid");

  // Only the feelings made in the run change.
  const happyOnly = layers.withGeneratedFaces(stored, [{ label: "happy", drawnAs: "happy" }]);
  assert.deepEqual(happyOnly.expressionMap, { ...before.expressionMap, happy: user("happy") });
  assert.deepEqual(Object.keys(happyOnly.layers), [...OLD_FACES, "happy"]);

  // ── All 29 faces: the extra feelings get their own faces too ──
  const allRun = [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS].map((face) => ({ label: face, drawnAs: face }));
  const afterAll = layers.withGeneratedFaces(stored, allRun);
  for (const feeling of AVATAR_EXTRA_FEELINGS) {
    assert.deepEqual(afterAll.feelingMap?.[feeling], user(feeling), `${feeling} shows its new face`);
  }
  assert.equal(
    layers.pickPngtuberLayerKey(afterAll, { emotion: "surprised", feeling: "fear" }),
    "fear",
    "a fearful line shows the new fear face, not the old scared sprite",
  );
  assert.equal(Object.keys(afterAll.layers).length, 39);
  assert.ok(avatarKindDataSchema.safeParse({ pngtuber: afterAll }).success);

  // ── Renamed and reassigned faces ──
  assert.deepEqual(
    layers.withGeneratedFaces(stored, [{ label: "happy_2", drawnAs: "happy" }]).expressionMap.happy,
    user("happy_2"),
    "a face renamed to keep the old sprite is the face it was drawn as",
  );
  const reassigned = layers.withGeneratedFaces(stored, [{ label: "sad", drawnAs: "happy" }]);
  assert.deepEqual(reassigned.expressionMap.sad, user("sad"), "a face saved under a feeling's name is that feeling's");
  assert.deepEqual(reassigned.expressionMap.happy, before.expressionMap.happy, "and not the one it was drawn as");
  assert.deepEqual(
    layers.withGeneratedFaces(stored, [
      { label: "happy", drawnAs: "sad" },
      { label: "happy_2", drawnAs: "happy" },
    ]).expressionMap.happy,
    user("happy"),
    "a face named after the feeling wins over one renamed away from it",
  );
  assert.deepEqual(
    layers.withGeneratedFaces(stored, [{ label: "Neutral Face", drawnAs: "neutral" }]).layers.neutral_face,
    sprite("neutral_face"),
    "a face set is keyed by the normalized label",
  );
  const plain = layers.withGeneratedFaces(stored, [{ label: "smile" }, { label: "smirk_2", drawnAs: "smirk" }]);
  assert.equal(plain, stored, "faces that are no feeling's leave the setup alone");
  assert.equal(layers.withGeneratedFaces(stored, []), stored);

  // ── A face made again starts from its sprite ──
  const withPictures = {
    ...stored,
    layers: {
      ...stored.layers,
      happy: {
        base: { source: "file" as const, path: "pngtuber/happy-base.png" },
        eyesClosed: { source: "file" as const, path: "pngtuber/happy-eyes-closed.png" },
        mouthOpen: { source: "sprite" as const, label: "happy_talk" },
      },
    },
    expressionMap: { ...stored.expressionMap, happy: user("happy") },
    source: "generated" as const,
  };
  const remade = layers.withGeneratedFaces(withPictures, [{ label: "happy", drawnAs: "happy" }]);
  assert.deepEqual(remade.layers.happy, sprite("happy"), "pictures made for the old happy face are not kept");
  assert.equal(remade.source, "generated");

  // ── Imports and the cap ──
  const imported = { ...stored, source: "pngtuber-plus" as const };
  assert.equal(layers.withGeneratedFaces(imported, mainRun), imported, "a PNGTuber Plus import keeps its faces");
  const full = {
    ...stored,
    layers: Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`face_${index}`, sprite(`face_${index}`)])),
  };
  const capped = layers.withGeneratedFaces(full, [{ label: "happy" }, { label: "face_3", drawnAs: "sad" }]);
  assert.equal(Object.keys(capped.layers).length, 64, "a full setup gains no face");
  assert.deepEqual(capped.expressionMap.happy, before.expressionMap.happy, "so happy keeps its face");
  assert.deepEqual(capped.expressionMap.sad, user("face_3"), "a face it already has can still be used");
  assert.equal(layers.pngtuberFaceChoices(full, fromSprites), full.layers, "a full setup offers no sprite face");
  const roomForOne = { ...full, layers: Object.fromEntries(Object.entries(full.layers).slice(0, 63)) };
  const nearlyFull = layers.pngtuberFaceChoices(roomForOne, fromSprites);
  assert.equal(Object.keys(nearlyFull).length, 63 + 39, "with room for one, every sprite face is offered");
  for (const key of Object.keys(nearlyFull).slice(63)) {
    const chosen = { ...roomForOne, layers: { ...roomForOne.layers, [key]: nearlyFull[key]! } };
    assert.ok(avatarKindDataSchema.safeParse({ pngtuber: chosen }).success, `choosing ${key} keeps the PUT body valid`);
  }
  const manySprites = Array.from({ length: 70 }, (_, index) => ({ expression: `pose_${index + 10}` }));
  assert.equal(Object.keys(layers.buildPngtuberLayersFromSprites(manySprites)!.layers).length, 64);
  assert.ok(
    Object.hasOwn(
      layers.pngtuberFaceChoices(stored, layers.buildPngtuberLayersFromSprites(manySprites, Infinity)),
      "pose_79",
    ),
    "a sprite past the first 64 can be chosen while the setup has room",
  );

  // ── Saving blink and talk pictures afterwards keeps the new faces ──
  const kept = mergePngtuberVariants(afterAll as never, [{ key: "happy", variants: ["mouth-open"], keepOthers: true }]);
  assert.deepEqual(kept.expressionMap.happy, user("happy"));
  assert.deepEqual(kept.expressionMap.neutral, user("neutral"));
  assert.deepEqual(kept.feelingMap?.fear, user("fear"));
  assert.equal(kept.layers.smirk?.base.source, "sprite", "old faces stay");

  // ── Missing faces after a run that stopped early (#9653) ──
  const FACE_KEYS = layers.TALKING_HEAD_FACE_KEYS;
  assert.deepEqual(FACE_KEYS, [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS], "29 faces, the main six first");
  const spelled = [
    { expression: "neutral" },
    { expression: "happy", label: "Happy", folderId: "outfit", folderName: "Outfit" },
    { expression: "angry_2" }, // renamed in the last step to keep an older angry face
    { expression: "sad_sprite_0123456789ab", label: "sad" }, // a second file of that name
    { expression: "old_face", label: "relaxed" }, // renamed to the face
    { expression: "surprised", label: "shocked" }, // renamed away from it: never drawn again unasked
    // Not a face of its own: another face's talk or blink picture, a full-body sprite, a face under another name.
    { expression: "curiosity_blink" },
    { expression: "admiration_mouth_open" },
    { expression: "full_amusement" },
    { expression: "excited" },
  ];
  assert.deepEqual(
    layers.missingTalkingHeadFaces(spelled),
    AVATAR_EXTRA_FEELINGS,
    "only the extra feelings are missing",
  );
  assert.deepEqual(layers.missingTalkingHeadFaces([]), FACE_KEYS, "no sprites, every face missing");

  // The run stopped after 24 faces, and blink and talk pictures were saved for 20 of them.
  const LEFT_OUT = ["love", "relief", "confusion", "fear", "realization"];
  const made = FACE_KEYS.filter((face) => !LEFT_OUT.includes(face));
  const cutShort = [...made, ...made.slice(0, 20).flatMap((face) => [`${face}_blink`, `${face}_talk`])].map(
    (expression) => ({ expression }),
  );
  const missingNow = layers.missingTalkingHeadFaces(cutShort);
  assert.deepEqual(missingNow, LEFT_OUT, "exactly the five faces not made, so Missing faces queues only those");
  const cutShortSetup = layers.buildPngtuberLayersFromSprites(cutShort)!;
  const hasPicture = (ref: unknown) => !!ref;
  const coverage = (shown: typeof cutShortSetup, fromSprites: typeof cutShortSetup, missing: readonly string[]) =>
    layers.talkingHeadPictureCoverage(
      shown,
      layers.talkingHeadFaces(shown, fromSprites, labelFor),
      missing,
      hasPicture,
    );
  assert.deepEqual(
    coverage(cutShortSetup, cutShortSetup, missingNow),
    { saved: 40, missing: 8, blockedFaces: LEFT_OUT, total: 58 },
    "40 of 58 saved, 8 to make, 10 waiting for the 5 missing faces",
  );
  assert.deepEqual(
    layers.talkingHeadPictureCoverage({ source: "pngtuber-plus" }, [], missingNow, hasPicture).blockedFaces,
    [],
    "nothing waits in a PNGTuber Plus import: sprite faces never join it",
  );

  // Saving the five faces into the saved setup frees their ten pictures and keeps the 40 made.
  const filled = [...cutShort, ...LEFT_OUT.map((expression) => ({ expression }))];
  const afterMissing = layers.withGeneratedFaces(
    cutShortSetup,
    LEFT_OUT.map((label) => ({ label, drawnAs: label })),
  );
  assert.deepEqual(layers.missingTalkingHeadFaces(filled), [], "worked out again from the saved sprites");
  assert.deepEqual(coverage(afterMissing, layers.buildPngtuberLayersFromSprites(filled)!, []), {
    saved: 40,
    missing: 18,
    blockedFaces: [],
    total: 58,
  });
  // A face kept in the setup after its sprite was deleted is listed already, so it isn't counted twice.
  const fearKept = layers.withGeneratedFaces(cutShortSetup, [{ label: "fear", drawnAs: "fear" }]);
  assert.deepEqual(coverage(fearKept, cutShortSetup, missingNow), {
    saved: 40,
    missing: 10,
    blockedFaces: ["love", "relief", "confusion", "realization"],
    total: 58,
  });

  // A feeling shown with another face for now (happy with one of the others, confusion with confused) still waits
  // for its own.
  const noHappy = [...FACE_KEYS.filter((face) => face !== "happy" && face !== "confusion"), "confused"].map(
    (expression) => ({ expression }),
  );
  const noHappySetup = layers.buildPngtuberLayersFromSprites(noHappy)!;
  assert.deepEqual(layers.missingTalkingHeadFaces(noHappy), ["happy", "confusion"]);
  assert.deepEqual(coverage(noHappySetup, noHappySetup, ["happy", "confusion"]).blockedFaces, ["happy", "confusion"]);

  console.log("avatar 2D main faces regression passed");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
