/**
 * Decisions about a given picture: the picture check, the Illustrator's "already shown"
 * skip, background reuse by looking, lorebook entries read with pictures, and the
 * settings that keep all of it off for decision models that do not read pictures.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-picture-decisions-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { parseLorebookDecisionActivation, createLorebookEntrySchema } =
  await import("../../../packages/shared/dist/index.js");
const pictures = await import("../../../packages/server/src/services/decision/picture-decisions.js");
const { decisionMediaOf, loadDecisionMedia } =
  await import("../../../packages/server/src/services/decision/decision-media.js");
const { createLorebookDecisionResolver } =
  await import("../../../packages/server/src/services/decision/prompt-decisions.js");
const { libraryBackgroundCandidatesForLocation } =
  await import("../../../packages/server/src/services/generation/illustrator-background-reuse.js");

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type Asked = { state: unknown; questions: Array<{ id: string; instructions: string }> };

/** A backend that reads pictures and answers each statement with `answer(statement, call)`. */
function visionBackend(answer: (statement: string, call: number) => number, reads = true) {
  const asked: Asked[] = [];
  const backend = {
    maxStateTokens: 4000,
    calibration: { defaultThreshold: 0.5 },
    deferPreGeneration: false,
    ...(reads ? { mediaTokens: { picture: 180, clip: 460 } } : {}),
    ask: async (state: unknown, questions: Array<{ id: string; instructions: string }>) => {
      asked.push({ state, questions });
      return new Map(questions.map((question) => [question.id, answer(question.instructions, asked.length)]));
    },
  };
  return { backend: backend as never, asked };
}

// ── sniffing and data URLs ────────────────────────────────────────────────────
assert.equal(pictures.pictureDataUrl(PIXEL, ".PNG"), `data:image/png;base64,${PIXEL}`);
assert.equal(pictures.pictureDataUrl(PIXEL, "bmp"), null, "only picture types the models read");
assert.equal(pictures.sniffedPictureDataUrl(PIXEL), `data:image/png;base64,${PIXEL}`, "PNG by its signature");
assert.equal(pictures.sniffedPictureDataUrl("data:image/webp;base64,AAAA"), "data:image/webp;base64,AAAA");
assert.equal(pictures.sniffedPictureDataUrl(Buffer.from("not a picture").toString("base64")), null);
assert.equal(pictures.sniffedPictureDataUrl(null), null);

// ── the user's own lines ──────────────────────────────────────────────────────
assert.deepEqual(pictures.parsePictureCheckLines("Kaelen has red hair\n\n  not: anyone else is there  \n"), [
  { statement: "Kaelen has red hair" },
  { statement: "anyone else is there", expect: false },
]);
assert.equal(pictures.parsePictureCheckLines("a\nb\nc\nd\ne\nf\ng\nh").length, 6, "at most six lines");
assert.deepEqual(pictures.parsePictureCheckLines(42), []);
assert.equal(pictures.normalizePictureCheckMode("best_of_two"), "best_of_two");
assert.equal(pictures.normalizePictureCheckMode("sometimes"), "off");

// ── a backend that does not read pictures is never asked ──────────────────────
{
  const { backend, asked } = visionBackend(() => 1, false);
  assert.equal(pictures.backendReadsPictures(backend), false);
  const result = await pictures.checkPicture({
    backend,
    picture: `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A cat" }],
  });
  assert.equal(result, null, "a check that cannot run returns null, which callers treat as a pass");
  assert.equal(asked.length, 0);
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "best_of_two",
    backend,
    generate: async () => ++made,
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A cat" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.attempts, made], [1, 1, 1], "no second picture without a model that reads them");
}

// ── checkPicture: expected and negated lines, the reference goes first ────────
{
  const { backend, asked } = visionBackend((statement) => (statement.includes("red hair") ? 0.9 : 0.7));
  const result = await pictures.checkPicture({
    backend,
    picture: "data:image/png;base64,CHECKED",
    reference: "data:image/png;base64,AVATAR",
    lines: [{ statement: "Kaelen has red hair" }, { statement: "Anyone else is there", expect: false }],
  });
  assert.ok(result);
  assert.equal(result.passed, false);
  assert.deepEqual(result.failed, ["Anyone else is there"]);
  assert.ok(Math.abs(result.score - (0.9 + 0.3) / 2) < 1e-9, "score is the mean agreement");
  const attached = (asked[0]!.state as Record<symbol, { subjects?: string[] }>)[Symbol.for("marinara.decision.media")];
  assert.deepEqual(
    attached?.subjects,
    ["data:image/png;base64,AVATAR", "data:image/png;base64,CHECKED"],
    "the reference is sent first, the checked picture second",
  );
  assert.deepEqual(decisionMediaOf(asked[0]!.state), [], "given pictures are not chat media");
  assert.equal(JSON.stringify(asked[0]!.state).includes("CHECKED"), false, "pictures ride beside the state");
}

// ── given pictures load first, only for a model that reads them ──────────────
{
  const { backend, asked } = visionBackend(() => 0.9);
  await pictures.checkPicture({ backend, picture: `data:image/png;base64,${PIXEL}`, lines: [{ statement: "A dot" }] });
  const reads = await loadDecisionMedia(asked[0]!.state, ["text", "image"]);
  assert.equal(reads.images.length, 1);
  assert.ok(reads.images[0]!.startsWith("data:image/jpeg;base64,"), "scaled like chat pictures");
  const textOnly = await loadDecisionMedia(asked[0]!.state, ["text"]);
  assert.equal(textOnly.images.length, 0);
}

// ── generateCheckedPicture: retry and best of two ─────────────────────────────
{
  // First fails, second passes: the second is kept.
  const { backend } = visionBackend((_statement, call) => (call === 1 ? 0.1 : 0.9));
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "retry",
    backend,
    generate: async () => ++made,
    toDataUrl: (n: number) => `data:image/png;base64,${n}`,
    lines: [{ statement: "A lighthouse" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.attempts, kept.check?.passed], [2, 2, true]);
}
{
  // First passes: retry stops there.
  const { backend, asked } = visionBackend(() => 0.9);
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "retry",
    backend,
    generate: async () => ++made,
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A lighthouse" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.attempts, made, asked.length], [1, 1, 1, 1]);
}
{
  // Best of two always makes two; a worse second keeps the first.
  const { backend } = visionBackend((_statement, call) => (call === 1 ? 0.8 : 0.6));
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "best_of_two",
    backend,
    generate: async () => ++made,
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A lighthouse" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.attempts, made], [1, 2, 2]);
}
for (const mode of ["retry", "best_of_two"] as const) {
  // Two lines: the first picture misses one by a hair yet scores higher; the second
  // passes both. Passing every line wins over the score.
  const answers: Record<string, [number, number]> = { "A lighthouse": [0.45, 0.62], "A red door": [0.99, 0.68] };
  const { backend } = visionBackend((statement, call) => answers[statement]![call === 1 ? 0 : 1]);
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode,
    backend,
    generate: async () => ++made,
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A lighthouse" }, { statement: "A red door" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.check?.passed], [2, true], `${mode}: the picture that passes every line is kept`);
}
{
  // Both miss the same number of lines: the higher score wins.
  const answers: Record<string, [number, number]> = { "A lighthouse": [0.1, 0.4], "A red door": [0.9, 0.9] };
  const { backend } = visionBackend((statement, call) => answers[statement]![call === 1 ? 0 : 1]);
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "best_of_two",
    backend,
    generate: async () => ++made,
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A lighthouse" }, { statement: "A red door" }],
    label: "test",
  });
  assert.equal(kept.result, 2);
}
{
  // A second attempt that fails to generate keeps the first.
  const { backend } = visionBackend(() => 0.1);
  let made = 0;
  const kept = await pictures.generateCheckedPicture({
    mode: "retry",
    backend,
    generate: async () => {
      made += 1;
      if (made === 2) throw new Error("provider down");
      return made;
    },
    toDataUrl: () => `data:image/png;base64,${PIXEL}`,
    lines: [{ statement: "A lighthouse" }],
    label: "test",
  });
  assert.deepEqual([kept.result, kept.attempts], [1, 2]);
}

// ── "already shown" is strict ─────────────────────────────────────────────────
{
  const at = (p: number) => visionBackend(() => p).backend;
  const args = { picture: `data:image/png;base64,${PIXEL}`, description: "Mira at the harbor" };
  assert.equal(await pictures.newestPictureAlreadyShows({ backend: at(0.7), ...args }), false, "0.7 is not enough");
  assert.equal(await pictures.newestPictureAlreadyShows({ backend: at(0.8), ...args }), true);
}

// ── background reuse by looking ───────────────────────────────────────────────
{
  const library = [
    { filename: "harbor-docks.png", tags: [] },
    { filename: "generated-old-harbor-tavern-2.png", tags: ["tavern"] },
    { filename: "forest.png", tags: ["pine forest"] },
  ];
  assert.deepEqual(
    libraryBackgroundCandidatesForLocation("The Old Harbor tavern", library, 4),
    ["generated-old-harbor-tavern-2.png", "harbor-docks.png"],
    "most shared words first; unrelated pictures are left out",
  );
  assert.deepEqual(libraryBackgroundCandidatesForLocation("A room", library), [], "no shared word, nothing looked at");
  assert.equal(libraryBackgroundCandidatesForLocation("harbor", library, 1).length, 1, "capped");

  const picked = await pictures.pickPictureShowingPlace({
    backend: visionBackend((_statement, call) => [0.85, 0.95, 0.6][call - 1]!).backend,
    place: "The Old Harbor tavern",
    candidates: [
      { id: "a.png", picture: "data:image/png;base64,A" },
      { id: "b.png", picture: "data:image/png;base64,B" },
      { id: "c.png", picture: "data:image/png;base64,C" },
    ],
  });
  assert.equal(picked, "b.png", "the clearest match");
  const none = await pictures.pickPictureShowingPlace({
    backend: visionBackend(() => 0.75).backend,
    place: "The Old Harbor tavern",
    candidates: [{ id: "a.png", picture: "data:image/png;base64,A" }],
  });
  assert.equal(none, null, "below 0.8 paints a new picture instead");
}

// ── lorebook entries read with pictures ───────────────────────────────────────
{
  assert.deepEqual(
    parseLorebookDecisionActivation({ decisionStatement: "x", decisionMode: "trigger" }),
    { decisionStatement: "x", decisionMode: "trigger", decisionPictures: 0, decisionMediaWithin: null },
    "off by default",
  );
  const clamped = parseLorebookDecisionActivation({ decisionPictures: 9, decisionMediaWithin: 500 });
  assert.deepEqual([clamped.decisionPictures, clamped.decisionMediaWithin], [3, 50]);
  const cleared = parseLorebookDecisionActivation({ decisionPictures: "nope", decisionMediaWithin: 0 });
  assert.deepEqual([cleared.decisionPictures, cleared.decisionMediaWithin], [0, null]);
  assert.throws(() => createLorebookEntrySchema.parse({ lorebookId: "l", name: "e", decisionPictures: 4 }));

  const planned: Array<{ key: string; pictures?: number; mediaWithin?: number }> = [];
  const resolver = createLorebookDecisionResolver({
    macroContext: { user: "User", char: "Mira", characters: ["Mira"], variables: {} } as never,
    limit: 10,
    answer: async (plan: { decisions: Array<{ key: string; pictures?: number; mediaWithin?: number }> }) => {
      planned.push(...plan.decisions);
      return { answers: new Map(plan.decisions.map((decision) => [decision.key, true])), choices: new Map() };
    },
  });
  await resolver([
    { entryId: "a", statement: "Mira wears the red coat", pictures: 1, mediaWithin: 3 },
    { entryId: "b", statement: "Mira wears the red coat", pictures: 2, mediaWithin: 5 },
    { entryId: "c", statement: "It is raining", pictures: 1 },
    { entryId: "d", statement: "It is raining", pictures: 0, mediaWithin: 2 },
    { entryId: "e", statement: "Text only" },
  ]);
  const by = new Map(planned.map((decision) => [decision.key, decision]));
  assert.deepEqual(
    [by.get("Mira wears the red coat")?.pictures, by.get("Mira wears the red coat")?.mediaWithin],
    [2, 5],
    "the most pictures, and the widest window when every entry waits for one",
  );
  assert.deepEqual(
    [by.get("It is raining")?.pictures, by.get("It is raining")?.mediaWithin],
    [1, undefined],
    "an entry that asks every turn keeps the statement asked every turn",
  );
  assert.deepEqual([by.get("Text only")?.pictures, by.get("Text only")?.mediaWithin], [undefined, undefined]);
}

rmSync(dir, { recursive: true, force: true });
console.log("picture-decisions regression passed");
