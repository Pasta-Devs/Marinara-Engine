/**
 * The avatar emotion classifier and the shared expression keyword list:
 *   - one keyword list serves the Roleplay sprite fallback, the Expression Engine's fallback pick and the
 *     classifier's instant tier; it matches whole words across accents and scripts without the old prefix
 *     false positives;
 *   - the classifier answers with keywords until the local model is ready, then averages the model with the
 *     keywords, caches per text, falls back per text (uncached), and stays on keywords in Lite mode;
 *   - each result names the more specific feeling inside its emotion when one stands out: a keyword's, else the
 *     model's strongest label of that emotion when it reaches its threshold;
 *   - only a prepare request for a Roleplay chat with an avatar agent on downloads or loads the model; classifying
 *     never does; the status the agents' pages show follows the download; an interrupted file is replaced;
 *   - the route validates the request, sits in its own rate-limit bucket, and never logs user text above debug.
 * The local model is a stub here: no network, no ONNX.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const {
  AVATAR_EMOTIONS,
  AVATAR_FEELINGS,
  EXPRESSION_KEYWORD_NEUTRAL_CANDIDATES,
  classifyExpressionKeywords,
  detectExpressionKeyword,
  inferExpressionCandidates,
} = await import("../../../packages/shared/src/index.js");

// ── One keyword list, whole words, any accent ──
const cases: Array<[string, string]> = [
  ["She smiles warmly.", "happy"],
  ["He grinned at her.", "happy"],
  ["She laughs at the joke.", "happy"],
  ["Haha, nice one.", "laughing"],
  ["Tears roll down her cheeks.", "sad"],
  ["She is crying.", "sad"],
  ["He yells at the guard.", "angry"],
  ["Her eyes narrow into a glare.", "angry"],
  ["Her eyes widened.", "surprised"],
  ["She blushes.", "embarrassed"],
  ["I love you.", "love"],
  ["He winks.", "smirk"],
  ["She winces in pain.", "hurt"],
  ["Hmm, let me think.", "thinking"],
  ["The door opens.", "neutral"],
  // Prefix matches the old regexes made: a colour, a compliment, a tomb, a building, a mood word inside a word.
  ["The yellow flower.", "neutral"],
  ["What a terrific idea.", "neutral"],
  ["They entered the crypt.", "neutral"],
  ["The museum opens at nine.", "neutral"],
  ["He is unhappy.", "sad"],
  ["She looks sadder than ever.", "sad"],
  // Accents fold; letters without a decomposition (Polish ł) stay themselves.
  ["Er ist WÜTEND.", "angry"],
  ["Er ist wutend.", "angry"],
  ["Łzy spływają jej po policzkach.", "sad"],
  ["Uśmiecha się szeroko.", "happy"],
  ["Ella sonríe.", "happy"],
  ["Elle pleure.", "sad"],
  ["Она улыбнулась.", "happy"],
  // Chinese, Japanese and Korean match inside words; Japanese voicing marks are kept.
  ["彼女は泣いた。", "sad"],
  ["びっくりした！", "surprised"],
  ["テーブルをひっくり返した。", "neutral"],
  ["她哭了。", "sad"],
  ["그녀는 눈물을 흘렸다.", "sad"],
  // A Korean syllable stays whole: 무서 (scary) is not inside 무성한 (overgrown) or 무선 (wireless).
  ["무성한 숲을 지나갔다.", "neutral"],
  ["무선 이어폰을 꼈다.", "neutral"],
  ["너무 무서워.", "scared"],
  // Phrases the old Roleplay sprite fallback caught, kept as whole words.
  ["He looks at her with wide eyes.", "surprised"],
  ["She beams at him.", "happy"],
  ["Her shyness gets the better of her.", "embarrassed"],
  ["His head ached.", "hurt"],
  ["She looks at him, her heart racing.", "love"],
  // Broad stems the shared list no longer has.
  ["Concerning the treaty, nothing changed.", "neutral"],
  ["A considerable amount of gold.", "neutral"],
];
for (const [text, expected] of cases) {
  assert.equal(detectExpressionKeyword(text), expected, `${JSON.stringify(text)} reads as ${expected}`);
}

const blushCandidates = inferExpressionCandidates("She blushes and looks away.");
assert.deepEqual(blushCandidates.slice(0, 2), ["embarrassed", "blush"], "a group's label comes before its aliases");
assert.deepEqual(
  blushCandidates.slice(-EXPRESSION_KEYWORD_NEUTRAL_CANDIDATES.length),
  [...EXPRESSION_KEYWORD_NEUTRAL_CANDIDATES],
  "calm faces always end the list",
);
assert.deepEqual(inferExpressionCandidates(""), [...EXPRESSION_KEYWORD_NEUTRAL_CANDIDATES]);
assert.ok(
  inferExpressionCandidates("He is nervous.").includes("scared"),
  "nervous still reaches a scared sprite when there is no worried one",
);

// The Expression Engine's fill-in for a character the model skipped picks from the same list.
const { completeRequiredSpriteExpressionEntries } =
  await import("../../../packages/server/src/routes/generate/expression-agent-utils.js");
const fillIn = (expressions: string[], text: string) =>
  completeRequiredSpriteExpressionEntries([], [{ characterId: "c1", characterName: "Mia", expressions }], ["c1"], {
    defaultSourceText: text,
  }).expressions[0]?.expression;
assert.equal(fillIn(["blush", "neutral"], "She blushes and looks away."), "blush", "an alias fills a missing label");
assert.equal(
  fillIn(["happy", "blush", "neutral"], "She blushes and smiles."),
  "happy",
  "a general mood comes before a blush",
);
assert.equal(fillIn(["scared", "neutral"], "He is nervous."), "scared", "nervous reaches a scared sprite");
assert.equal(fillIn(["sad", "neutral"], "Łzy spływają jej po policzkach."), "sad", "other languages fill in too");
assert.equal(fillIn(["angry", "neutral"], "The yellow lantern sways."), "neutral", "no mood word, a calm face");

const sumOf = (scores: Record<string, number>) => Object.values(scores).reduce((sum, value) => sum + value, 0);
const strong = classifyExpressionKeywords("She smiles.");
assert.equal(strong.emotion, "happy");
assert.equal(strong.weight, 1, "one strong word is confident");
const mild = classifyExpressionKeywords("She smirks.");
assert.equal(mild.emotion, "neutral", "one mild word stays below neutral");
assert.ok(Math.abs(mild.scores.happy - 0.4) < 1e-9);
const mixed = classifyExpressionKeywords("She smiles through her tears.");
assert.deepEqual([mixed.scores.happy, mixed.scores.sad], [0.5, 0.5], "two emotions share the score");
for (const result of [strong, mild, mixed, classifyExpressionKeywords("The door opens.")]) {
  assert.ok(Math.abs(sumOf(result.scores) - 1) < 1e-9, "scores sum to 1");
  assert.deepEqual(Object.keys(result.scores).sort(), [...AVATAR_EMOTIONS].sort());
}
// The feeling is the first matching word group's that belongs to the winning emotion.
const keywordFeelings: Array<[string, string, string | null]> = [
  ["She laughs.", "happy", "amusement"],
  ["She blushes and smiles.", "happy", "embarrassment"],
  ["She smiles.", "happy", null],
  ["She blushes.", "neutral", null],
  ["She is scared.", "surprised", "fear"],
  ["I love you.", "relaxed", "love"],
  ["She is crying.", "sad", "grief"],
  ["He is nervous.", "neutral", null],
  // "I think" is too common to name curiosity; the model tier reads that feeling instead.
  ["I think you're right.", "neutral", null],
];
for (const [text, emotion, feeling] of keywordFeelings) {
  const result = classifyExpressionKeywords(text);
  assert.deepEqual([result.emotion, result.feeling], [emotion, feeling], `${JSON.stringify(text)} reads as ${feeling}`);
}

// ── Lite mode keeps the keyword tier ──
process.env.MARINARA_LITE = "true";
const classifier = await import("../../../packages/server/src/services/avatars/emotion-classifier.js");
const { logger } = await import("../../../packages/server/src/lib/logger.js");
assert.equal(classifier.isAvatarEmotionModelSupported(), false, "Lite mode never loads the local model");
const lite = await classifier.classifyAvatarEmotions({ texts: ["She laughs."], tier: "local-model" });
assert.equal(lite.tier, "keywords");
assert.equal(lite.model, null);
assert.equal(lite.results[0]?.emotion, "happy");
delete process.env.MARINARA_LITE;

// ── The local model, stubbed ──
const modelCalls: string[] = [];
let loads = 0;
let failNext = false;
const fakeModel = {
  async classify(text: string) {
    modelCalls.push(text);
    if (failNext) {
      failNext = false;
      throw new Error("model crashed");
    }
    if (text.includes("prince")) return { surprise: 0.9, curiosity: 0.3, neutral: 0.2 };
    if (text.includes("proud")) return { pride: 0.99, admiration: 0.35, neutral: 0.1 };
    if (text.includes("zeta")) return { embarrassment: 0.5, neutral: 0.3 };
    if (text.includes("miss him")) return { sadness: 0.7, grief: 0.2, neutral: 0.3 };
    return { neutral: 0.95, joy: 0.05 };
  },
  async dispose() {},
};
const countingLoader = async () => {
  loads += 1;
  return fakeModel;
};
await classifier.setAvatarEmotionModelLoaderForTests(countingLoader);
assert.equal(classifier.isAvatarEmotionModelSupported(), true);

const first = await classifier.classifyAvatarEmotions({ texts: ["Wait, you're the prince?"], tier: "local-model" });
assert.equal(first.tier, "keywords", "callers get keywords until the model is ready");
assert.equal(loads, 0, "a classify request never downloads or loads the model");
assert.equal(classifier.avatarEmotionModelStatus().state, "not-downloaded");
assert.equal(await classifier.prepareAvatarEmotionModel(), fakeModel);
assert.equal(loads, 1);
assert.equal(classifier.avatarEmotionModelStatus().state, "downloaded");

const texts = ["Wait, you're the prince?", "She laughs.", "He opens the door.", "I miss him so much."];
const ready = await classifier.classifyAvatarEmotions({ texts, tier: "local-model" });
assert.equal(ready.tier, "local-model");
assert.equal(ready.model, classifier.AVATAR_EMOTION_MODEL_ID);
assert.deepEqual(
  ready.results.map((result) => result.emotion),
  ["surprised", "happy", "neutral", "sad"],
  "results stay in request order; a keyword lifts narration the model calls neutral",
);
assert.ok(ready.results[1]!.weight >= 0.45, "the averaged keyword emotion is strong enough to change a face");
for (const result of ready.results) assert.ok(Math.abs(sumOf(result.scores) - 1) < 1e-9);

const callsBefore = modelCalls.length;
const again = await classifier.classifyAvatarEmotions({ texts: [texts[0]!], tier: "local-model" });
assert.equal(modelCalls.length, callsBefore, "a classified text is answered from the cache");
assert.deepEqual(again.results[0], ready.results[0]);

const keywordsOnly = await classifier.classifyAvatarEmotions({ texts: ["Something new."], tier: "keywords" });
assert.equal(keywordsOnly.tier, "keywords", "a caller can ask for the instant tier only");
assert.equal(modelCalls.length, callsBefore);

assert.deepEqual(
  ready.results.map((result) => result.feeling),
  [null, "amusement", null, null],
  "a plain label (surprise, sadness) tops its emotion: no specific feeling",
);
const proud = await classifier.classifyAvatarEmotions({
  texts: ["I'm so proud of you.", "She laughs. I'm so proud of you."],
  tier: "local-model",
});
assert.deepEqual(
  proud.results.map((result) => [result.emotion, result.feeling]),
  [
    ["happy", "pride"],
    ["happy", "amusement"],
  ],
  "the model's strongest feeling of the emotion, unless a keyword names one of the same emotion",
);
const proudCalls = modelCalls.length;
const proudAgain = await classifier.classifyAvatarEmotions({ texts: ["I'm so proud of you."], tier: "local-model" });
assert.equal(modelCalls.length, proudCalls);
assert.deepEqual(proudAgain.results[0], proud.results[0], "the cached answer keeps its feeling");

assert.deepEqual(Object.keys(classifier.GO_EMOTION_THRESHOLDS).sort(), [...AVATAR_FEELINGS].sort(), "every label");
const feelingCases: Array<[Record<string, number>, string, string | null]> = [
  [{ pride: 0.99, admiration: 0.35 }, "happy", "pride"],
  [{ joy: 0.6, amusement: 0.1 }, "happy", null],
  [{ embarrassment: 0.5, neutral: 0.3 }, "neutral", null],
  [{ embarrassment: 0.5, neutral: 0.3 }, "happy", "embarrassment"],
  [{ pride: 0.2, joy: 0.1 }, "happy", null],
  [{ fear: 0.9, toString: 5 }, "surprised", "fear"],
];
for (const [scores, emotion, feeling] of feelingCases) {
  assert.equal(
    classifier.avatarFeelingFromModel(scores, emotion),
    feeling,
    `${JSON.stringify(scores)} inside ${emotion} is ${feeling}`,
  );
}
const shy = await classifier.classifyAvatarEmotions({ texts: ["The zeta line."], tier: "local-model" });
assert.deepEqual(
  [shy.results[0]?.emotion, shy.results[0]?.feeling],
  ["neutral", null],
  "a feeling whose emotion loses to neutral is not shown",
);

failNext = true;
const fallback = await classifier.classifyAvatarEmotions({ texts: ["Tears fall. A brand new line."] });
assert.equal(fallback.tier, "local-model");
assert.equal(fallback.results[0]?.emotion, "sad", "a model failure on one text falls back to its keywords");
const callsAfterFailure = modelCalls.length;
await classifier.classifyAvatarEmotions({ texts: ["Tears fall. A brand new line."] });
assert.equal(modelCalls.length, callsAfterFailure + 1, "a keyword fallback is not cached as the model's answer");

assert.deepEqual(
  classifier.avatarEmotionScoresFromModel({}),
  { neutral: 1, happy: 0, angry: 0, sad: 0, relaxed: 0, surprised: 0 },
  "no label scores read as neutral",
);
const folded = classifier.avatarEmotionScoresFromModel({ love: 0.9, caring: 0.4, neutral: 0.1 });
assert.ok(folded.relaxed > 0.8, "love and caring fold into relaxed");

let failedLoads = 0;
await classifier.setAvatarEmotionModelLoaderForTests(async () => {
  failedLoads += 1;
  throw new Error("offline");
});
assert.equal(await classifier.prepareAvatarEmotionModel(), null, "a failed download reports no model");
assert.equal(classifier.avatarEmotionModelStatus().state, "failed");
assert.equal(await classifier.prepareAvatarEmotionModel(), null);
assert.equal(failedLoads, 1, "a failed download waits before retrying");
const offline = await classifier.classifyAvatarEmotions({ texts: ["She smiles."] });
assert.equal(offline.tier, "keywords");
assert.equal(offline.results[0]?.emotion, "happy");

// A load still running when the state is reset never becomes the model.
let finishSlowLoad: () => void = () => {};
let slowDisposed = false;
const slowModel = { ...fakeModel, dispose: async () => void (slowDisposed = true) };
await classifier.setAvatarEmotionModelLoaderForTests(
  () => new Promise((resolve) => (finishSlowLoad = () => resolve(slowModel))),
);
const slowLoad = classifier.prepareAvatarEmotionModel();
await classifier.setAvatarEmotionModelLoaderForTests(async () => fakeModel);
finishSlowLoad();
assert.equal(await slowLoad, null, "the stale load reports nothing");
assert.ok(slowDisposed, "and frees its model");

// ── The route ──
assert.equal(await classifier.prepareAvatarEmotionModel(), fakeModel, "the current loader's model is used");
const serverRequire = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const fastify = serverRequire("fastify") as typeof import("fastify").default;
const { avatarClassifyRoutes } = await import("../../../packages/server/src/routes/avatar-classify.routes.js");
const { rateLimitHook, resetRateLimitBucketsForTests } =
  await import("../../../packages/server/src/middleware/rate-limit.js");
resetRateLimitBucketsForTests();
const app = fastify({ logger: false });
app.addHook("onRequest", rateLimitHook);
await app.register(avatarClassifyRoutes, {
  prefix: "/api/avatar-classify",
  avatarAgentOnInChat: async (chatId: string) => chatId === "rp-on",
});
await app.ready();

const secret = "Zanzibar-7319 whispers she is so happy";
const logged: string[] = [];
const levels = ["fatal", "error", "warn", "info"] as const;
const originals = levels.map((level) => logger[level]);
for (const level of levels) {
  (logger as unknown as Record<string, (...args: unknown[]) => void>)[level] = (...args: unknown[]) => {
    logged.push(JSON.stringify(args));
  };
}
const ok = await app.inject({
  method: "POST",
  url: "/api/avatar-classify",
  payload: { texts: [secret, "Wait, you're the prince?"], tier: "local-model", debugMode: true },
});
levels.forEach((level, index) => {
  (logger as unknown as Record<string, unknown>)[level] = originals[index];
});
assert.equal(ok.statusCode, 200);
const body = ok.json() as { results: Array<{ emotion: string }>; tier: string };
assert.deepEqual(
  body.results.map((result) => result.emotion),
  ["happy", "surprised"],
);
assert.equal(body.tier, "local-model");
assert.equal(ok.headers["ratelimit-limit"], "120", "the classifier has its own rate-limit bucket");
if (!logger.isLevelEnabled("debug")) assert.ok(logged.length > 0, "debug mode reports the classification");
assert.ok(
  logged.every((line) => !line.includes("Zanzibar-7319")),
  "user text is never logged above debug level, even in debug mode",
);

for (const payload of [
  { texts: [] },
  { texts: Array.from({ length: 17 }, () => "a") },
  { texts: ["x".repeat(2001)] },
  { texts: ["ok"], tier: "llm" },
  { texts: ["ok"], extra: true },
]) {
  const refused = await app.inject({ method: "POST", url: "/api/avatar-classify", payload });
  assert.equal(refused.statusCode, 400, `refuses ${JSON.stringify(payload).slice(0, 60)}`);
}

// ── The download starts only for a Roleplay chat with an avatar agent on, and the agents' pages follow it ──
let downloads = 0;
let finishDownload: () => void = () => {};
await classifier.setAvatarEmotionModelLoaderForTests((onProgress) => {
  downloads += 1;
  onProgress(1_000);
  return new Promise((resolve) => (finishDownload = () => resolve(fakeModel)));
});
const modelUrl = "/api/avatar-classify/model";
const notOn = await app.inject({ method: "POST", url: modelUrl, payload: { chatId: "rp-off" } });
assert.equal(notOn.statusCode, 409, "a chat without an avatar agent on gets no download");
await app.inject({
  method: "POST",
  url: "/api/avatar-classify",
  payload: { texts: ["She laughs."], tier: "local-model" },
});
assert.equal(downloads, 0, "classifying never starts a download");
for (const payload of [{}, { chatId: "../x" }, { chatId: "rp-on", extra: true }]) {
  const refused = await app.inject({ method: "POST", url: modelUrl, payload });
  assert.equal(refused.statusCode, 400, `refuses ${JSON.stringify(payload)}`);
}
assert.equal(downloads, 0);
const on = await app.inject({ method: "POST", url: modelUrl, payload: { chatId: "rp-on" } });
assert.equal(on.statusCode, 200);
assert.equal(downloads, 1, "turning an avatar agent on in a Roleplay chat starts the download");
const progress = (await app.inject({ method: "GET", url: modelUrl })).json() as {
  unsupported: string | null;
  state: string;
  downloadedBytes: number;
  totalBytes: number;
};
assert.deepEqual([progress.unsupported, progress.state, progress.downloadedBytes], [null, "downloading", 1_000]);
assert.ok(progress.totalBytes > 300_000_000, "the pinned files are about 300 MB");
await app.inject({ method: "POST", url: modelUrl, payload: { chatId: "rp-on" } });
assert.equal(downloads, 1, "one download at a time");
await assert.rejects(classifier.removeAvatarEmotionModel(), "Remove waits until the download has finished");
assert.equal((await app.inject({ method: "GET", url: modelUrl })).json().state, "downloading");
finishDownload();
await new Promise((resolve) => setImmediate(resolve));
assert.equal((await app.inject({ method: "GET", url: modelUrl })).json().state, "downloaded");
await app.close();
await classifier.setAvatarEmotionModelLoaderForTests(null);

// ── The real download: an interrupted file is replaced, never piled up ──
const { join } = await import("node:path");
const { existsSync, mkdirSync, truncateSync, writeFileSync } = await import("node:fs");
const { DATA_DIR } = await import("../../../packages/server/src/utils/data-dir.js");
const localModel = await import("../../../packages/server/src/services/avatars/classifier/local-emotion-model.js");
const modelDir = join(DATA_DIR, "models", "avatar-emotion", localModel.AVATAR_EMOTION_MODEL_REVISION);
mkdirSync(join(modelDir, "onnx"), { recursive: true });
for (const [path, size] of [
  ["config.json", 3_155],
  ["tokenizer_config.json", 46_440],
  ["tokenizer.json", 34_363_286],
] as const) {
  writeFileSync(join(modelDir, path), "");
  truncateSync(join(modelDir, path), size);
}
const stale = join(modelDir, "onnx", "model_quantized.onnx.download");
writeFileSync(stale, "half a model from a download that was stopped");
assert.equal(localModel.isLocalEmotionModelDownloaded(), false);
const realFetch = globalThis.fetch;
const fetched: string[] = [];
globalThis.fetch = (async (url: string | URL | Request) => {
  fetched.push(String(url));
  throw new DOMException("The operation was aborted.", "AbortError");
}) as typeof fetch;
await assert.rejects(localModel.downloadLocalEmotionModel(() => {}));
globalThis.fetch = realFetch;
assert.deepEqual(
  fetched,
  [
    `https://huggingface.co/${classifier.AVATAR_EMOTION_MODEL_ID}/resolve/${localModel.AVATAR_EMOTION_MODEL_REVISION}/onnx/model_quantized.onnx`,
  ],
  "only the missing file is fetched, at the pinned commit",
);
assert.equal(existsSync(stale), false, "the stopped download's leftover is removed before the next try");

console.log("avatar classifier regression passed");
