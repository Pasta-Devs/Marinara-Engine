/**
 * A Decision connection pointed at a chat model on the user's own server (#6714).
 *
 * The stand-in server answers the way Ollama does: an OpenAI-compatible
 * `/v1/chat/completions` with log-probabilities, and a plain 404 for every other path,
 * `/v1/systemone` included. A Custom System One connection against it gets that 404,
 * which is what the report ran into; the chat-model source gets real answers.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TFunction } from "i18next";
import {
  createConnectionSchema,
  DECISION_TIMEOUT_MS,
  defaultDecisionStateTokens,
  defaultDecisionTimeoutMs,
} from "../../packages/shared/src/index.js";
import {
  decisionChatCompletionsUrl,
  resolveDecisionConnection,
} from "../../packages/server/src/services/decision/decision-connection.js";
import { resolveDecisionBackend } from "../../packages/server/src/services/decision/decision-default.js";
import { askNoulQuestions } from "../../packages/server/src/services/decision/system-one.client.js";
import {
  connectionChatTarget,
  probeDecisionSlot,
} from "../../packages/server/src/services/decision/sidecar-decision.backend.js";
import { clearDecisionThinkingCache } from "../../packages/server/src/services/decision/decision-thinking-cache.js";
import { createConnectionsStorage } from "../../packages/server/src/services/storage/connections.storage.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { decisionConnectionTestMessage } from "../../packages/client/src/lib/decision-test-message.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

// ── the URL and the defaults ─────────────────────────────────────────────────

assert.equal(decisionChatCompletionsUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1/chat/completions");
assert.equal(decisionChatCompletionsUrl("http://127.0.0.1:11434/v1/"), "http://127.0.0.1:11434/v1/chat/completions");
assert.equal(
  decisionChatCompletionsUrl("http://127.0.0.1:11434"),
  "http://127.0.0.1:11434/v1/chat/completions",
  "a bare host gets /v1",
);
assert.equal(
  decisionChatCompletionsUrl("http://127.0.0.1:1234/v1/chat/completions"),
  "http://127.0.0.1:1234/v1/chat/completions",
  "a full endpoint is kept",
);
assert.equal(
  decisionChatCompletionsUrl("https://api.example.com/openai/v1"),
  "https://api.example.com/openai/v1/chat/completions",
  "the same rule as the Custom chat connection",
);
assert.equal(defaultDecisionTimeoutMs("openai_compatible"), DECISION_TIMEOUT_MS.sidecar);
assert.equal(defaultDecisionTimeoutMs("custom"), DECISION_TIMEOUT_MS.systemOne);
assert.equal(defaultDecisionStateTokens("openai_compatible"), 3500);

// ── a stand-in Ollama ────────────────────────────────────────────────────────

const requests: Array<{ path: string; authorization?: string; body?: Record<string, unknown> }> = [];
let inFlight = 0;
let mostInFlight = 0;
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString();
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    requests.push({ path: req.url ?? "" });
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 page not found");
    return;
  }
  const body = JSON.parse(raw) as Record<string, unknown>;
  requests.push({ path: req.url, authorization: req.headers.authorization, body });
  inFlight += 1;
  mostInFlight = Math.max(mostInFlight, inFlight);
  await new Promise((resolve) => setTimeout(resolve, 20));
  inFlight -= 1;
  const user = String((body.messages as Array<{ content: string }>)[1]!.content);
  const yes = user.slice(user.lastIndexOf("Question:")).includes("door") ? 0.8 : 0.1;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      model: body.model,
      choices: [
        {
          message: { role: "assistant", content: yes > 0.5 ? "Yes" : "No" },
          logprobs: {
            content: [
              {
                token: yes > 0.5 ? "Yes" : "No",
                logprob: Math.log(Math.max(yes, 1 - yes)),
                top_logprobs: [
                  { token: "Yes", logprob: Math.log(yes) },
                  { token: "No", logprob: Math.log(1 - yes) },
                ],
              },
            ],
          },
        },
      ],
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const directory = mkdtempSync(join(tmpdir(), "marinara-decision-chat-connection-"));
const previousDirectory = process.env.FILE_STORAGE_DIR;
const previousLocalUrls = process.env.PROVIDER_LOCAL_URLS_ENABLED;
process.env.FILE_STORAGE_DIR = directory;
delete process.env.PROVIDER_LOCAL_URLS_ENABLED;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const db = await createFileNativeDB();
const storage = createConnectionsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(connectionsRoutes, { prefix: "/connections" });

const t = ((key: string, options?: Record<string, unknown>) =>
  options && Object.keys(options).length > 0 ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;
const state = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] };
const resolveRow = async (id: string) =>
  resolveDecisionConnection((await storage.getWithKey(id))!, (other) => storage.getWithKey(other));

try {
  // The report: a Custom System One connection asks a chat server for /v1/systemone.
  const systemOne = await storage.create(
    createConnectionSchema.parse({
      name: "Ollama as System One",
      provider: "decision",
      decisionSource: "custom",
      baseUrl: origin,
      model: "gemma4:e2b",
    }),
  );
  const systemOneConnection = (await resolveRow(systemOne!.id)).connection!;
  assert.equal(systemOneConnection.protocol, "system_one");
  const refused = await askNoulQuestions({
    connection: systemOneConnection,
    state,
    questions: [{ id: "q", instructions: "The door is open." }],
    timeoutMs: 2000,
  });
  assert.equal(refused.error, "http_404");
  assert.equal(refused.answers.size, 0);
  const refusedTest = (await app.inject({ method: "POST", url: `/connections/${systemOne!.id}/test` })).json();
  assert.equal(refusedTest.errorCode, "http_404");
  assert.match(decisionConnectionTestMessage(t, refusedTest).message, /connections\.decision\.errors\.http_404/);

  // The chat-model source, with the same base URL as the Custom chat connection.
  const chat = await storage.create(
    createConnectionSchema.parse({
      name: "Ollama decisions",
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: `${origin}/v1`,
      model: "gemma4:e2b",
      apiKey: "sk-local",
    }),
  );
  const chatConnection = (await resolveRow(chat!.id)).connection!;
  assert.equal(chatConnection.protocol, "chat_logprobs");
  assert.equal(chatConnection.endpoint, `${origin}/v1/chat/completions`);
  assert.equal(chatConnection.timeoutMs, DECISION_TIMEOUT_MS.sidecar, "an unset limit follows the source's default");
  assert.equal(chatConnection.maxStateTokens, 3500);
  const noModel = await storage.create(
    createConnectionSchema.parse({
      name: "No model",
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: `${origin}/v1`,
    }),
  );
  assert.equal((await resolveRow(noModel!.id)).error, "missing_model", "a chat server is never sent jev-latest");
  assert.deepEqual(
    (await app.inject({ method: "GET", url: `/connections/${noModel!.id}/models` })).json().models,
    [],
    "and the model list offers no Jev placeholder",
  );

  // Gates, prompt statements and Choice questions all answer through it.
  clearDecisionThinkingCache();
  requests.length = 0;
  const backend = (await resolveDecisionBackend({
    getLocalDefault: async () => null,
    getThinkingPreGeneration: async () => false,
    getDefaultConnection: () => storage.getWithKey(chat!.id),
    getConnectionWithKey: (id) => storage.getWithKey(id),
  }))!;
  assert.equal(backend.maxStateTokens, 3500);
  assert.equal(backend.deferPreGeneration, false);
  const answers = (await backend.ask(state, [
    { id: "door", instructions: "The door is open." },
    { id: "window", instructions: "The window is open." },
    { id: "door2", instructions: "Someone opened the door." },
  ]))!;
  assert.ok(Math.abs(answers.get("door")! - 0.8) < 0.001, `door ${answers.get("door")}`);
  assert.ok(Math.abs(answers.get("window")! - 0.1) < 0.001, `window ${answers.get("window")}`);
  assert.ok(answers.has("door2"));
  assert.equal(mostInFlight, 1, "statements go one at a time, so each limit starts when the server takes it");
  for (const request of requests) {
    assert.equal(request.path, "/v1/chat/completions");
    assert.equal(request.authorization, "Bearer sk-local");
    assert.equal(request.body!.model, "gemma4:e2b");
    assert.equal(request.body!.logprobs, true);
    assert.equal(request.body!.max_tokens, 1);
  }
  const mixed = await backend.askMixed(state, [
    { id: "open", instructions: "What is open", options: ["door", "window"] },
  ]);
  assert.equal(mixed.choices.get("open"), "door");

  // Test reports the probability and the two things only a chat model can be unsure about.
  const test = (await app.inject({ method: "POST", url: `/connections/${chat!.id}/test` })).json();
  assert.equal(test.success, true);
  assert.equal(test.logprobs, true);
  assert.equal(test.answersDirectly, true);
  assert.equal(test.timeLimitMs, DECISION_TIMEOUT_MS.sidecar);
  assert.equal(decisionConnectionTestMessage(t, test).ok, true);
  assert.match(
    decisionConnectionTestMessage(t, { ...test, logprobs: false }).message,
    /connections\.decision\.logprobsMissing/,
    "a server without log-probabilities is called out",
  );

  // A key is borrowed from the Custom chat connection only on the same origin.
  const custom = await storage.create(
    createConnectionSchema.parse({
      name: "Ollama",
      provider: "custom",
      baseUrl: `${origin}/v1`,
      model: "gemma4:e2b",
      apiKey: "sk-linked",
    }),
  );
  const linked = await storage.create(
    createConnectionSchema.parse({
      name: "Linked",
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: `${origin}/v1`,
      model: "gemma4:e2b",
      credentialsFromConnectionId: custom!.id,
    }),
  );
  assert.equal((await resolveRow(linked!.id)).connection!.apiKey, "sk-linked");
  const elsewhere = await storage.create(
    createConnectionSchema.parse({
      name: "Elsewhere",
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: "http://127.0.0.1:1/v1",
      model: "gemma4:e2b",
      credentialsFromConnectionId: custom!.id,
    }),
  );
  assert.equal((await resolveRow(elsewhere!.id)).error, "needs_relinking", "a key never goes to another host");

  // A user-entered URL goes through the provider URL policy, unlike a managed slot.
  requests.length = 0;
  const lan = await probeDecisionSlot(
    connectionChatTarget("lan", "LAN", { ...chatConnection, endpoint: "http://10.0.0.2:11434/v1/chat/completions" }),
  );
  assert.equal(lan.probability, null);
  assert.equal(lan.error, "private_address", "a private address needs PROVIDER_LOCAL_URLS_ENABLED");
  assert.equal(requests.length, 0);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await app.close();
  await db._fileStore.close();
  if (previousDirectory === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousDirectory;
  if (previousLocalUrls !== undefined) process.env.PROVIDER_LOCAL_URLS_ENABLED = previousLocalUrls;
  rmSync(directory, { recursive: true, force: true });
}
console.log("Decision chat connection regression passed.");
