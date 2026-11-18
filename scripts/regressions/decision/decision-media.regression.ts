/**
 * Pictures and clips for the built-in decision models that read them.
 *
 * Media ride beside a decision state, never inside it, so a hosted backend cannot be
 * sent them; each runtime gets them in the shape its own server documents; a model with
 * a vision projector launches with it; and every curated model that reads pictures
 * downloads the projector that lets it.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SIDECAR_DECISION_MODELS, sanitizeCustomDecisionModel } from "../../../packages/shared/src/index.js";
import { collectDecisionQuestions } from "../../../packages/shared/src/utils/macro-engine.js";
import { buildDecisionState } from "../../../packages/server/src/services/generation/agent-activation-questions.js";
import {
  decisionMediaOf,
  decisionMediaTokens,
  decisionRequestWithMedia,
  decisionSpeedEstimate,
  hasRecentDecisionMedia,
  loadDecisionMedia,
  type DecisionMediaRef,
} from "../../../packages/server/src/services/decision/decision-media.js";
import {
  answerPromptDecisions,
  cachedPromptDecisionAnswers,
  PromptDecisionTurnCache,
} from "../../../packages/server/src/services/decision/prompt-decisions.js";
import { askNoulQuestions } from "../../../packages/server/src/services/decision/system-one.client.js";
import { pickProjectorFile } from "../../../packages/server/src/services/sidecar/decision-gguf.js";
import { ggufLaunch } from "../../../packages/server/src/services/sidecar/decision-process.service.js";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const image = (label: string): DecisionMediaRef => ({ kind: "image", load: async () => `${PIXEL}#${label}` });
const clip: DecisionMediaRef = { kind: "video", load: async () => "data:video/mp4;base64,AAAA" };

const chat = [
  { role: "user", content: "old ".repeat(400), media: [image("old")] },
  { role: "assistant", content: "Here you go.", media: [clip] },
  { role: "user", content: "Look!", media: [image("new")] },
];
// Nothing rides along unless the decision asks for it.
assert.equal(decisionMediaOf(buildDecisionState(chat, 3, 60)).length, 0, "no media by default");
// Only the messages that fit the scene bring their media, in the chat's order.
const state = buildDecisionState(chat, 3, 60, { want: { pictures: 3, clips: 1 } });
assert.equal((state as { recent_messages: unknown[] }).recent_messages.length, 2, "the long old message is cut");
assert.deepEqual(
  decisionMediaOf(state).map((ref) => ref.kind),
  ["video", "image"],
  "the cut message's picture goes with it",
);
// A spread keeps them (scene presence adds fields that way); JSON never carries them.
assert.equal(decisionMediaOf({ ...state, extra: 1 }).length, 2);
assert.ok(!JSON.stringify(state).includes("data:"), "a serialized state carries no media");

// A model that reads text gets nothing loaded; one that reads pictures, only pictures.
let loads = 0;
const counted: DecisionMediaRef = {
  kind: "image",
  load: async () => {
    loads++;
    return PIXEL;
  },
};
const textOnly = buildDecisionState([{ role: "user", content: "hi", media: [counted] }], 1, 500, {
  want: { pictures: 1, clips: 0 },
});
assert.deepEqual(await loadDecisionMedia(textOnly, ["text"]), { images: [], videos: [] });
assert.equal(loads, 0, "nothing is read for a model that cannot see it");
const loaded = await loadDecisionMedia(state, ["text", "image"]);
assert.equal(loaded.videos.length, 0);
// Only as many as asked for, newest first.
const onePicture = buildDecisionState(chat, 3, 500, { want: { pictures: 1, clips: 0 } });
assert.deepEqual(
  decisionMediaOf(onePicture).map((ref) => ref.kind),
  ["image", "image"],
  "clips are not attached when none are asked for",
);
assert.ok((await loadDecisionMedia(onePicture, ["text", "image", "video"])).images.length <= 1);
// Leaves room for the pictures it carries.
const roomy = buildDecisionState([{ role: "user", content: "word ".repeat(2000) }], 1, 1500);
const tight = buildDecisionState([{ role: "user", content: "word ".repeat(2000) }], 1, 1500, {
  want: { pictures: 1, clips: 0 },
  tokens: { picture: 650, clip: 0 },
});
assert.ok(JSON.stringify(tight).length < JSON.stringify(roomy).length, "a picture's room comes out of the scene");

// media_within: asked only when a recent message has the kind of media it looks at.
assert.equal(hasRecentDecisionMedia(chat, 1, { pictures: 1 }), true);
assert.equal(hasRecentDecisionMedia(chat, 1, { clips: 1 }), false, "the newest message has no clip");
assert.equal(hasRecentDecisionMedia(chat, 2, { clips: 1 }), true);
assert.equal(hasRecentDecisionMedia([{ media: [] }, {}], 5, undefined), false);
const [statement] = collectDecisionQuestions(
  '{{#if decision:"The picture shows the sea" pictures:2 clips:1 media_within:3}}x{{/if}}',
);
assert.equal(statement?.pictures, 2);
assert.equal(statement?.clips, 1);
assert.equal(statement?.mediaWithin, 3);
assert.equal(
  collectDecisionQuestions('{{#if decision:"q" pictures:9 clips:4}}x{{/if}}')[0]?.pictures,
  3,
  "capped at the most one request carries",
);

// Speed is quoted only from a speed timed on this computer.
assert.equal(decisionSpeedEstimate({ runtime: "valen_onnx", inputs: ["text", "image", "video"] }, null), null);
const speed = decisionSpeedEstimate({ runtime: "llama_systemone", inputs: ["text", "image"] }, 10);
assert.equal(speed?.sceneSeconds, 20);
assert.equal(speed?.pictureSeconds, 8.3);
assert.equal(speed?.clipSeconds, undefined);
// Scaled through sharp where it loads; where it cannot, the picture is left out, never sent raw.
assert.ok(loaded.images.every((url) => url.startsWith("data:image/jpeg;base64,")));

// Each runtime's own request shape.
const media = { images: [PIXEL], videos: ["data:video/mp4;base64,AAAA"] };
const plain = { recent_messages: [{ role: "user", content: "Look!" }] };
assert.deepEqual(decisionRequestWithMedia("llama_systemone", plain, media), {
  state: plain,
  extraBody: { images: [PIXEL] },
});
assert.deepEqual(decisionRequestWithMedia("winnow_cuda", plain, media), {
  state: plain,
  extraBody: { winnow: { images: [PIXEL] } },
});
const valen = decisionRequestWithMedia("valen_onnx", plain, media).state as {
  messages: Array<{ role: string; content: Array<{ type: string }> }>;
};
assert.deepEqual(
  valen.messages[0]!.content.map((part) => part.type),
  ["text", "image_url", "video_url"],
  "Valen reads the state as text, then each picture and clip",
);
assert.deepEqual(decisionRequestWithMedia("llama_letters", plain, media), { state: plain }, "JevK5 reads text only");
assert.deepEqual(decisionRequestWithMedia("valen_gguf", plain, { images: [], videos: [] }), { state: plain });
assert.ok(decisionMediaTokens("valen_onnx", ["text", "image", "video"]).clip > 0);
assert.deepEqual(
  decisionMediaTokens("llama_letters", ["text"]),
  { picture: 0, clip: 0 },
  "a text model keeps its whole input",
);

// The pictures reach the server beside the state, and the inspector shows their size, not their bytes.
let received: Record<string, unknown> | null = null;
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    received = JSON.parse(body) as Record<string, unknown>;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ answers: { q: { type: "noul", noul: 0.9 } } }));
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;
const big = `data:image/jpeg;base64,${"A".repeat(4000)}`;
const inspection = { mode: "run" as const, requests: [] as Array<{ body: Record<string, unknown> }> };
const answered = await askNoulQuestions({
  connection: {
    protocol: "system_one",
    endpoint: `http://127.0.0.1:${port}/v1/systemone`,
    apiKey: "",
    model: "jev-latest",
    maxStateTokens: 1000,
  },
  state: plain,
  extraBody: { images: [big] },
  questions: [{ id: "q", instructions: "It shows the sea." }],
  timeoutMs: 5000,
  inspection: inspection as never,
});
server.close();
assert.equal(answered.answers.get("q"), 0.9);
assert.deepEqual((received as { images?: string[] } | null)?.images, [big], "the server gets the picture itself");
assert.ok(!JSON.stringify(inspection.requests[0]!.body).includes("AAAAAAAAAA"), "the inspector gets its size only");

// A model with a projector launches with it; Winnow switches from its text preset.
const d1 = SIDECAR_DECISION_MODELS.find((model) => model.id === "liquid-d1-3b")!;
const winnow = SIDECAR_DECISION_MODELS.find((model) => model.id === "winnow-e4b")!;
const valenGguf = SIDECAR_DECISION_MODELS.find((model) => model.id === "valen-decision-1.5-4b")!;
const install = { variant: "linux-x64-cpu", directory: "/srv" };
assert.deepEqual(ggufLaunch(d1, "/m/d1.gguf", install, 1, false, "/m/mmproj.gguf").args.slice(0, 4), [
  "-m",
  "/m/d1.gguf",
  "--mmproj",
  "/m/mmproj.gguf",
]);
assert.ok(!ggufLaunch(d1, "/m/d1.gguf", install, 1, false).args.includes("--mmproj"), "no projector, no flag");
const winnowArgs = ggufLaunch(winnow, "/m/w.gguf", install, 1, true, "/m/p.gguf").args;
assert.ok(winnowArgs.includes("--mmproj") && !winnowArgs.includes("--no-mmproj"));
assert.ok(ggufLaunch(winnow, "/m/w.gguf", install, 1, true).args.includes("--no-mmproj"));
assert.ok(ggufLaunch(valenGguf, "/m/v.gguf", install, 1, false, "/m/vision.gguf").args.includes("--mmproj"));

// Valen's full release runs its script on Marinara's Node with the FFmpeg pair.
const full = SIDECAR_DECISION_MODELS.find((model) => model.id === "valen-decision-1.5-2b-full")!;
const fullLaunch = ggufLaunch(
  full,
  "/hub/valen/valen_onnx.json",
  { ...install, script: "/app/valen-onnx-server.mjs", ffmpeg: "/bin/ffmpeg", ffprobe: "/bin/ffprobe" },
  4321,
  false,
);
assert.equal(fullLaunch.args[0], "/app/valen-onnx-server.mjs");
assert.deepEqual(fullLaunch.args.slice(1, 5), ["--model", "/hub/valen", "--port", "4321"]);
assert.ok(fullLaunch.args.includes("q8-mlp") && fullLaunch.args.includes("/bin/ffprobe"));
assert.equal(fullLaunch.shim, null);

// A pasted GGUF reads pictures only with a projector, and only a safe one is kept.
const pasted = {
  id: "byo:a/b@x:m.gguf",
  label: "a/b",
  description: "",
  runtime: "llama_systemone" as const,
  artifacts: [{ repoId: "a/b", revision: "0".repeat(40), paths: ["m.gguf", "mmproj-m-Q8_0.gguf"] }],
  modelFile: "m.gguf",
  downloadSizeBytes: 1,
  diskBytes: 2,
  vramBytes: 3,
  licenses: [],
};
assert.deepEqual(sanitizeCustomDecisionModel(pasted)?.inputs, ["text"]);
assert.deepEqual(sanitizeCustomDecisionModel({ ...pasted, projectorFile: "mmproj-m-Q8_0.gguf" })?.inputs, [
  "text",
  "image",
]);
assert.equal(sanitizeCustomDecisionModel({ ...pasted, projectorFile: "../x.gguf" }), null);
assert.deepEqual(
  pickProjectorFile([
    { path: "m-Q4_K_M.gguf", size: 10 },
    { path: "mmproj-m-F16.gguf", size: 4 },
    { path: "mmproj-m-Q8_0.gguf", size: 2 },
  ]),
  { path: "mmproj-m-Q8_0.gguf", size: 2 },
);
assert.equal(pickProjectorFile([{ path: "m-Q4_K_M.gguf", size: 10 }]), null);

// A statement asked on text alone does not answer the same words asked with a picture:
// the turn's cache keeps the two apart, and Peek Prompt reads back the same keys.
const sent: number[] = [];
const seeing = {
  maxStateTokens: 3500,
  mediaTokens: { picture: 10, clip: 10 },
  calibration: { defaultThreshold: 0.5, questionShape: "text" as const },
  deferPreGeneration: false,
  ask: async () => null,
  askMixed: async (askedState: Record<string, unknown>, questions: Array<{ id: string }>) => {
    sent.push(Math.min(1, decisionMediaOf(askedState).filter((ref) => ref.kind === "image").length));
    return { answers: new Map(questions.map((q) => [q.id, sent.length === 1 ? 0.1 : 0.9])), choices: new Map() };
  },
};
const turnCache = new PromptDecisionTurnCache();
const sea = { kind: "noul" as const, key: "The picture shows the sea", options: [] };
const textPlan = { decisions: [{ ...sea }], dropped: [] };
const picturePlan = { decisions: [{ ...sea, pictures: 1 }], dropped: [] };
const first = await answerPromptDecisions({
  plan: textPlan,
  backend: seeing as never,
  messages: chat,
  cacheKey: "m",
  cache: turnCache,
});
const second = await answerPromptDecisions({
  plan: picturePlan,
  backend: seeing as never,
  messages: chat,
  cacheKey: "m",
  cache: turnCache,
});
assert.deepEqual(sent, [0, 1], "the occurrence that wants a picture is asked again, with the picture");
assert.equal(first.answers?.get(sea.key), false);
assert.equal(second.answers?.get(sea.key), true);
assert.equal(cachedPromptDecisionAnswers(textPlan, "m", turnCache).answers?.get(sea.key), false);
assert.equal(cachedPromptDecisionAnswers(picturePlan, "m", turnCache).answers?.get(sea.key), true);
await answerPromptDecisions({
  plan: picturePlan,
  backend: seeing as never,
  messages: chat,
  cacheKey: "m",
  cache: turnCache,
});
assert.equal(sent.length, 2, "the same want is not asked twice in a turn");

// An until: condition that asks for a picture is read back under the key it was stored under.
const rain = { kind: "noul" as const, key: "It rains", options: [] };
const stops = { kind: "noul" as const, key: "The rain stops", options: [], pictures: 1 };
const lastsPlan = {
  decisions: [
    { ...rain, held: { yes: true, lasts: { key: stops.key, kind: "until" as const, mode: "or" as const } } },
    stops,
  ],
  dropped: [],
};
const stopped = await answerPromptDecisions({
  plan: lastsPlan as never,
  backend: {
    ...seeing,
    askMixed: async (_s: unknown, qs: Array<{ id: string }>) => ({
      answers: new Map(qs.map((q) => [q.id, 0.9])),
      choices: new Map(),
    }),
  } as never,
  messages: chat,
  cacheKey: "lasts",
  cache: new PromptDecisionTurnCache(),
});
assert.equal(stopped.answers?.get(rain.key), false, "the block turns off when its picture condition comes true");

console.log("decision media regression passed");
