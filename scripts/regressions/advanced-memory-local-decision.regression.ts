/**
 * Advanced Memory with a local model as its Decision model (#7326).
 *
 * The Primary local model already answered lorebook decisions through the global Decision
 * model, but Advanced Memory only accepted saved Decision connections. Choosing the local
 * model must route scene checks and recall to that model, refuse it while no model is
 * downloaded, and fall back to ordinary recall when it cannot start, as other decisions do.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-memory-local-decision-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.MARINARA_LITE = "true";

const requests: Array<{ kind: "local" | "classify" | "summary" | "other"; body: any }> = [];
const yes = (probability: number) => ({
  choices: [
    {
      message: { role: "assistant", content: probability > 0.5 ? "Yes" : "No" },
      logprobs: {
        content: [
          {
            token: probability > 0.5 ? "Yes" : "No",
            logprob: Math.log(Math.max(probability, 1 - probability)),
            top_logprobs: [
              { token: "Yes", logprob: Math.log(probability) },
              { token: "No", logprob: Math.log(1 - probability) },
            ],
          },
        ],
      },
      finish_reason: "length",
    },
  ],
});
// One server stands in for both the local model (one-token log-probability questions) and the summary helper.
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    requests.push({ kind: "other", body: null });
    response.statusCode = 404;
    response.end("{}");
    return;
  }
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const [system, user] = body.messages;
  if (body.logprobs === true) {
    requests.push({ kind: "local", body });
    const content = String(user.content);
    const question = content.slice(content.lastIndexOf("\n\nQuestion: "));
    const state = JSON.parse(content.slice("Conversation:\n".length, content.lastIndexOf("\n\nQuestion: ")));
    const id = /(?:message|memory) "([^"]+)"/.exec(question)?.[1];
    const message = state.transcript?.find((item: { messageId: string }) => item.messageId === id);
    const memory = state.memories?.find((item: { id: string }) => item.id === id);
    const answer = memory
      ? /TARGET_SCENE|Cobalt refuge/.test(memory.text)
      : question.includes("clearly START") && !!message?.content.startsWith("SCENE_CHANGE");
    response.end(JSON.stringify(yes(answer ? 0.95 : 0.05)));
    return;
  }
  const classify = system.content.startsWith("Identify scene transitions");
  requests.push({ kind: classify ? "classify" : "summary", body });
  const result = classify
    ? { starts: [], ends: [] }
    : {
        audience: "all",
        summary: user.content.includes("TARGET_SCENE")
          ? "TARGET_SCENE: The old oath concerned Cobalt refuge."
          : "Lantern soup was served.",
      };
  response.end(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content: JSON.stringify(result) }, finish_reason: "stop" }],
    }),
  );
});

const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { sidecarModelService } = await import("../../packages/server/src/services/sidecar/sidecar-model.service.js");
const { sidecarProcessService } = await import("../../packages/server/src/services/sidecar/sidecar-process.service.js");
const { resolveDecisionSlot } = await import("../../packages/server/src/services/decision/decision-slots.js");
const { SIDECAR_CONNECTION_ID } = await import("../../packages/shared/dist/index.js");
const db = await createFileNativeDB();
const chats = createChatsStorage(db);
const connections = createConnectionsStorage(db);
const memory = createAdvancedMemoryService(db);
const originalStatus = sidecarModelService.getStatus;
const originalEnsureReady = sidecarProcessService.ensureReady;

try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const helper = await connections.create({
    name: "Summary helper",
    provider: "custom",
    baseUrl: `${base}/v1`,
    model: "summary",
    apiKey: "fixture",
    maxContext: 65000,
  });
  const chat = await chats.create({
    name: "Local decision recall",
    mode: "roleplay",
    characterIds: ["reader"],
    connectionId: helper.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, { summaryMaxTokens: 512 });
  const settings = {
    enabled: true,
    decisionEnabled: true,
    decisionConnectionId: SIDECAR_CONNECTION_ID,
    knowledgeStarts: { reader: null },
    knowledgeConfirmed: true,
    retrieveMinMessages: 1,
    retrieveMaxMessages: 1,
  };

  // No model downloaded: refused, as the global Decision model refuses it.
  sidecarModelService.getStatus = () => ({ ...originalStatus.call(sidecarModelService), modelDownloaded: false });
  await assert.rejects(memory.updateSettings(chat.id, settings), /local model cannot answer/);

  // A downloaded model is accepted, even while stopped: it is started when asked.
  sidecarModelService.getStatus = () => ({
    ...originalStatus.call(sidecarModelService),
    modelDownloaded: true,
    modelDisplayName: "Fixture GGUF",
  });
  const starts: Array<boolean | undefined> = [];
  let startFails = false;
  sidecarProcessService.ensureReady = async (options = {}) => {
    starts.push(options.forceStart);
    if (startFails) throw new Error("The fixture model failed to load");
    return base;
  };
  const saved = await memory.updateSettings(chat.id, settings);
  assert.equal(saved.settings.decisionConnectionId, SIDECAR_CONNECTION_ID);
  assert(!saved.warnings.includes("decision-connection-unavailable"), "a usable local model is no warning");

  await chats.createMessagesBatch(chat.id, [
    { role: "user", content: "SCENE_CHANGE TARGET_SCENE They make an oath." },
    { role: "assistant", characterId: "reader", content: "Cobalt refuge is our exact promise." },
    { role: "user", content: "They depart." },
    { role: "user", content: "SCENE_CHANGE They eat lantern soup." },
    { role: "assistant", characterId: "reader", content: "More lantern soup." },
    { role: "user", content: "The lantern soup is cold." },
    { role: "user", content: "SCENE_CHANGE You remember, don't you?", extra: { isConversationStart: true } },
  ]);
  await memory.initialize(chat.id);
  assert(
    requests.some((request) => request.kind === "local"),
    "the local model checks scene boundaries",
  );
  assert(!requests.some((request) => request.kind === "classify"), "the helper is not asked for boundaries");
  assert(
    requests.some((request) => request.kind === "summary"),
    "the helper still writes summaries",
  );
  assert(starts.length > 0 && starts.every((forceStart) => forceStart === true), "asking starts the local model");

  const source = await chats.listMessages(chat.id);
  const input = { chatId: chat.id, messages: source, audienceCharacterIds: ["reader"], budgetTokens: 50000 };
  const beforeRecall = requests.length;
  const prepared = await memory.prepare(input);
  assert.match(prepared.recalledScenes!, /TARGET_SCENE/);
  assert(prepared.receipt.reasons.includes("decision-recall"), prepared.receipt.reasons.join(", "));
  assert.equal(prepared.receipt.decisionRecall?.fallback, false);
  const recallRequests = requests.slice(beforeRecall);
  assert(recallRequests.length > 0);
  assert(
    recallRequests.every((request) => request.kind === "local" && request.body.max_tokens === 1),
    "recall asks the local model one-token questions",
  );

  // The local model cannot start: recall falls back to ordinary recall rather than failing.
  startFails = true;
  const beforeFailure = requests.length;
  const fallback = await memory.prepare(input);
  assert(fallback.receipt.reasons.includes("decision-recall-fallback"), fallback.receipt.reasons.join(", "));
  assert.match(fallback.recalledScenes!, /TARGET_SCENE/, "ordinary recall still finds the scene");
  assert.equal(requests.length, beforeFailure, "nothing is asked of a model that did not start");
  startFails = false;

  // A model still loading does not hold a caller past its own time limit, such as a recall pass's.
  sidecarProcessService.ensureReady = () => new Promise<string>(() => {});
  let stillWaiting: NodeJS.Timeout | undefined;
  const loading = await Promise.race([
    resolveDecisionSlot("primary", AbortSignal.timeout(50)),
    new Promise<null>((resolve) => (stillWaiting = setTimeout(resolve, 5000, null))),
  ]);
  clearTimeout(stillWaiting);
  assert.equal(loading?.failure?.reason, "stopped", "the caller stops waiting when its time limit passes");

  // The model is removed after it was chosen: the choice stays, flagged, and recall falls back.
  sidecarModelService.getStatus = () => ({ ...originalStatus.call(sidecarModelService), modelDownloaded: false });
  const removed = await memory.status(chat.id);
  assert.equal(removed.settings.decisionConnectionId, SIDECAR_CONNECTION_ID);
  assert(removed.warnings.includes("decision-connection-unavailable"));
  assert((await memory.prepare(input)).receipt.reasons.includes("decision-recall-fallback"));

  // Saved Decision connections are still checked as before.
  await assert.rejects(memory.updateSettings(chat.id, { decisionConnectionId: helper.id }), /Decision connection/);
} finally {
  sidecarModelService.getStatus = originalStatus;
  sidecarProcessService.ensureReady = originalEnsureReady;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
}

console.log("Advanced Memory local Decision model regression passed");
