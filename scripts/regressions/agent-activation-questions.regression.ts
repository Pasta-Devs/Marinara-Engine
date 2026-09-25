import assert from "node:assert/strict";
import { createServer } from "node:http";
import { promises as dns } from "node:dns";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createConnectionSchema,
  customAgentActivationSettingsSchema,
  estimateTextTokens,
} from "../../packages/shared/src/index.js";
import { resolveDecisionConnection } from "../../packages/server/src/services/decision/decision-connection.js";
import { askNoulQuestions } from "../../packages/server/src/services/decision/system-one.client.js";
import {
  activationQuestionSettings,
  buildDecisionState,
  bypassActivationQuestion,
  evaluateActivationQuestions,
} from "../../packages/server/src/services/generation/agent-activation-questions.js";
import { shouldSkipAgentByMessageInterval } from "../../packages/server/src/services/generation/agent-cadence.js";
import { filterLanguageGenerationConnections } from "../../packages/client/src/lib/connection-filters.js";
import {
  normalizeImportedConnectionEntry,
  createConnectionExportEnvelope,
} from "../../packages/client/src/lib/connection-transfer.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { quarantineProfileApiConnectionRow } from "../../packages/server/src/routes/backup.routes.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const settings = {
  activationQuestion: "Did the scene change?",
  activationThreshold: 0.5,
  activationMaxSkip: 4,
  activationScanDepth: 3,
};
assert.deepEqual(customAgentActivationSettingsSchema.parse(JSON.parse(JSON.stringify(settings))), settings);
assert.equal(activationQuestionSettings({ activationQuestion: "" }), null);
assert.equal(activationQuestionSettings({ activationQuestion: "yes", activationThreshold: NaN }), null);
const messages = [
  { id: "old", role: "assistant", content: "Old scene" },
  { id: "system", role: "system", content: "Note" },
  { id: "new", role: "user", name: "Alyssa", content: "We enter the garden." },
];
assert.equal(bypassActivationQuestion(2, "old", messages, true), true);
assert.equal(bypassActivationQuestion(2, "old", messages, false), false);
assert.equal(bypassActivationQuestion(4, null, messages), true);
assert.equal(bypassActivationQuestion(4, "deleted", messages), true);
assert.equal(bypassActivationQuestion(undefined, null, messages), false);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    agentsStore: { getLastSuccessfulRunByType: async () => ({ messageId: "old" }) },
    chatId: "chat",
    agentType: "custom",
    settings: { runInterval: 4 },
    fallbackInterval: 1,
    messages,
  }),
  true,
);
const calls: Array<{ state: unknown; ids: string[] }> = [];
const candidates = [
  { agentId: "a", question: "A?", threshold: 0.5, scanDepth: 3 },
  { agentId: "b", question: "B?", threshold: 0.5, scanDepth: 3 },
  { agentId: "missing", question: "Missing?", threshold: 0.5, scanDepth: 3 },
  { agentId: "c", question: "C?", threshold: 0.5, scanDepth: 1 },
];
const evaluated = await evaluateActivationQuestions({
  candidates,
  messages,
  maxStateTokens: 1000,
  ask: async (state, questions) => {
    calls.push({ state, ids: questions.map((q) => q.id) });
    return new Map([
      ["a", 0.1],
      ["b", 0.5],
      ["c", 0.9],
    ]);
  },
});
assert.equal(calls.length, 2);
assert.deepEqual([...evaluated.skip], ["a"]);
assert.equal(evaluated.results.get("missing"), "failed");
assert.deepEqual(calls[1]!.state, {
  recent_messages: [{ role: "user", name: "Alyssa", content: "We enter the garden." }],
});
assert.equal(
  (
    await evaluateActivationQuestions({
      candidates,
      messages,
      maxStateTokens: 1000,
      ask: async () => {
        throw new Error("offline");
      },
    })
  ).skip.size,
  0,
);
assert.equal(
  (
    await evaluateActivationQuestions({
      candidates,
      messages,
      maxStateTokens: 1000,
      ask: async () =>
        new Map([
          ["a", NaN],
          ["b", -1],
          ["c", Infinity],
        ]),
    })
  ).skip.size,
  0,
);
let emptyCalls = 0;
await evaluateActivationQuestions({
  candidates: [],
  messages,
  maxStateTokens: 1000,
  ask: async () => {
    emptyCalls++;
    return new Map();
  },
});
assert.equal(emptyCalls, 0);
const tooSmall = await evaluateActivationQuestions({
  candidates,
  messages,
  maxStateTokens: 1,
  ask: async () => {
    emptyCalls++;
    return new Map();
  },
});
assert.equal(emptyCalls, 0);
assert.equal(tooSmall.skip.size, 0);
assert.ok([...tooSmall.results.values()].every((result) => result === "failed"));
const state = buildDecisionState(
  [...messages, { role: "assistant", name: "Mara", content: `${'"\\'.repeat(500)}LATEST` }],
  4,
  100,
);
assert.equal(state.recent_messages.length, 1);
assert.ok(state.recent_messages[0]!.content.endsWith("LATEST"));
assert.ok(estimateTextTokens(JSON.stringify(state)) <= 100);
assert.deepEqual(
  filterLanguageGenerationConnections([{ provider: "decision" }, { provider: "audio" }, { provider: "openrouter" }]),
  [{ provider: "openrouter" }],
);
const source = readFileSync(new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url), "utf8");
const builtInsIndex = source.indexOf("const builtInAgentTypes");
const cadenceIndex = source.indexOf("shouldSkipAgentByMessageInterval({", builtInsIndex);
const questionGateIndex = source.indexOf("const inactivePreGenerationQuestionIds");
assert.ok(builtInsIndex >= 0 && cadenceIndex >= 0 && questionGateIndex >= 0);
assert.ok(cadenceIndex < questionGateIndex);
assert.match(source, /gateActivationQuestions\(\s*resolvedAgents\.filter\(.*inactivePostProcessingAgentIds/s);

// A stalled DNS lookup must not make the fail-open deadline or cancellation wait indefinitely.
const originalLookup = dns.lookup;
try {
  dns.lookup = (() => new Promise(() => {})) as typeof dns.lookup;
  const request = {
    connection: {
      endpoint: "https://decision.invalid/v1/systemone",
      apiKey: "",
      model: "jev-latest",
      maxStateTokens: 3500,
    },
    state: {},
    questions: [{ id: "a", instructions: "A?" }],
  };
  const started = Date.now();
  const keepAlive = setTimeout(() => {}, 2000);
  try {
    assert.equal((await askNoulQuestions({ ...request, timeoutMs: 30 })).error, "timeout");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    assert.equal((await askNoulQuestions({ ...request, signal: controller.signal })).error, "cancelled");
    assert.ok(Date.now() - started < 1000);
  } finally {
    clearTimeout(keepAlive);
  }
} finally {
  dns.lookup = originalLookup;
}

const directory = mkdtempSync(join(tmpdir(), "marinara-decisions-"));
const previousDirectory = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = directory;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/connections" });
const received: Array<{ url?: string; key?: string; body: Record<string, unknown> }> = [];
let mode = "valid";
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  received.push({ url: req.url, key: req.headers.authorization, body });
  if (mode === "slow") return;
  if (mode === "redirect") {
    res.writeHead(302, { location: "http://127.0.0.1:1/private" });
    res.end();
    return;
  }
  res.writeHead(mode === "422" ? 422 : 200, { "content-type": "application/json" });
  if (mode === "invalid") {
    res.end("not json");
    return;
  }
  if (mode === "partial") {
    res.end(JSON.stringify({ answers: { a: { type: "noul", noul: 0.1 }, b: { type: "noul", noul: "0.1" } } }));
    return;
  }
  res.end(
    JSON.stringify({
      answers: Object.fromEntries(Object.keys(body.questions).map((id) => [id, { type: "noul", noul: 0.8 }])),
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  const create = (input: Record<string, unknown>) => storage.create(createConnectionSchema.parse(input));
  const chat = await create({
    name: "Chat",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "original",
    defaultForAgents: true,
    isDefault: true,
  });
  const decision = await create({
    name: "Decision",
    provider: "decision",
    decisionSource: "openrouter",
    apiKey: "must-not-store",
    credentialsFromConnectionId: chat!.id,
    defaultForAgents: true,
    isDefault: true,
    useForRandom: true,
  });
  assert.equal((await storage.getWithKey(decision!.id))!.apiKey, "");
  assert.equal((await storage.getDefaultForAgents())!.id, chat!.id);
  assert.equal((await storage.getDefault())!.id, chat!.id);
  assert.equal((await storage.getDefaultForDecision())!.id, decision!.id);
  assert.equal((await storage.listRandomPool()).length, 0);
  const resolve = async () =>
    resolveDecisionConnection((await storage.getWithKey(decision!.id))!, (id) => storage.getWithKey(id));
  assert.equal((await resolve()).connection?.apiKey, "original");
  await storage.update(chat!.id, { apiKey: "rotated" });
  assert.equal((await resolve()).connection?.apiKey, "rotated");
  await storage.update(chat!.id, { baseUrl: "https://unexpected.example/v1" });
  assert.equal((await resolve()).error, "needs_relinking");
  await storage.remove(chat!.id);
  assert.equal((await resolve()).error, "needs_relinking");
  assert.equal((await storage.getById(decision!.id))!.credentialsFromConnectionId, chat!.id);
  const duplicate = await storage.duplicate(decision!.id);
  assert.equal(duplicate!.credentialsFromConnectionId, chat!.id);
  assert.equal(duplicate!.defaultForAgents, "false");
  assert.equal(
    quarantineProfileApiConnectionRow({ ...decision, credentialsFromConnectionId: "someone-else" }, decision!)
      .trustedIdentity,
    false,
  );

  const local = await create({
    name: "Local",
    provider: "decision",
    decisionSource: "custom",
    baseUrl,
    model: "open-jev",
    maxStateTokens: 3500,
    defaultForAgents: true,
  });
  const resolved = await resolveDecisionConnection((await storage.getWithKey(local!.id))!, (id) =>
    storage.getWithKey(id),
  );
  assert.ok(resolved.connection);
  assert.equal(resolved.connection.maxStateTokens, 3500);
  const request = {
    connection: resolved.connection,
    state: { recent_messages: messages },
    questions: [
      { id: "a", instructions: "A?" },
      { id: "b", instructions: "B?" },
    ],
  };
  assert.equal((await askNoulQuestions(request)).answers.get("a"), 0.8);
  assert.equal(received.at(-1)!.url, "/v1/systemone");
  assert.equal(received.at(-1)!.key, undefined);
  mode = "partial";
  const partial = await askNoulQuestions(request);
  assert.deepEqual([...partial.answers], [["a", 0.1]]);
  assert.equal(partial.error, "partial_response");
  for (const [nextMode, expected] of [
    ["invalid", "invalid_response"],
    ["422", "http_422"],
    ["redirect", "network"],
  ]) {
    mode = nextMode!;
    const result = await askNoulQuestions(request);
    assert.equal(result.error, expected);
    assert.equal(result.answers.size, 0);
  }
  mode = "slow";
  const started = Date.now();
  assert.equal((await askNoulQuestions({ ...request, timeoutMs: 30 })).error, "timeout");
  assert.ok(Date.now() - started < 1000);
  const abort = new AbortController();
  abort.abort();
  const before = received.length;
  assert.equal((await askNoulQuestions({ ...request, signal: abort.signal })).error, "cancelled");
  assert.equal(received.length, before);
  mode = "valid";
  const tested = await app.inject({ method: "POST", url: `/connections/${local!.id}/test` });
  assert.equal(tested.statusCode, 200, tested.body);
  assert.equal(tested.json().decisionProbability, 0.8);
  const exported = createConnectionExportEnvelope([local!]).connections[0]!;
  assert.equal(exported.decisionSource, "custom");
  const imported = normalizeImportedConnectionEntry(exported)!;
  assert.equal(imported.connection.decisionSource, "custom");
  assert.equal(imported.connection.credentialsFromConnectionId, null);
  assert.equal(imported.connection.maxStateTokens, 3500);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Agent activation questions regression passed.");
