/**
 * Gemini decision models.
 *
 * A decision Model under a Google account (`gemini-decision-1`) is asked at Gemini's Decisions API
 * (`<base>/v1beta/decisions`) with the account's key in `x-goog-api-key`. The context goes in `input` (a string),
 * and the question ids are plain (`q0`, `q1`, ...) because Gemini refuses ours; the answers are mapped back.
 * A Google chat model has no log-probabilities, so it is not a decision model. Google itself is never contacted:
 * a stand-in on 127.0.0.1 answers instead.
 */
import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import {
  resolveDecisionConnection,
  type DecisionConnectionRow,
} from "../../../packages/server/src/services/decision/decision-connection.js";
import { askNoulQuestions } from "../../../packages/server/src/services/decision/system-one.client.js";
import { normalizeModelsResponse } from "../../../packages/server/src/routes/connections.routes.js";

const requests: Array<{ path: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }> = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
  requests.push({ path: req.url ?? "", headers: req.headers, body });
  if (req.method !== "POST" || req.url !== "/v1beta/decisions" || "state" in body) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("bad request");
    return;
  }
  const questions = body.questions as Record<string, { type: string; criteria?: Record<string, string> }>;
  for (const id of Object.keys(questions)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("bad id");
      return;
    }
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      answers: Object.fromEntries(
        Object.entries(questions).map(([id, question]) => [
          id,
          question.type === "choice"
            ? {
                type: "choice",
                choice: Object.keys(question.criteria ?? {})[0],
                probabilities: {},
                confidence: 0.9,
              }
            : { type: "noul", noul: 0.83, confidence: 0.9 },
        ]),
      ),
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const row = (fields: Partial<DecisionConnectionRow>): DecisionConnectionRow => ({
  id: "gemini-decision",
  provider: "decision",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  model: "gemini-decision-1",
  apiKey: "goog-key",
  decisionSource: "google",
  account: { provider: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  ...fields,
});
const noLinks = async () => null;

try {
  // (a) A Gemini decision model goes to the Decisions API with the account's key and the gemini dialect.
  const resolved = await resolveDecisionConnection(row({}), noLinks);
  assert.ok(resolved.connection, `resolves: ${resolved.error}`);
  assert.equal(resolved.connection.protocol, "system_one");
  assert.equal(resolved.connection.endpoint, "https://generativelanguage.googleapis.com/v1beta/decisions");
  assert.equal(resolved.connection.apiKey, "goog-key");
  assert.equal(resolved.connection.dialect, "gemini");
  assert.equal(resolved.connection.model, "gemini-decision-1");

  // (b) An account with no address of its own, and a row the catalog marks as a decision model, resolve the same.
  const fromCatalog = await resolveDecisionConnection(
    row({
      decisionSource: "openai_compatible",
      account: { provider: "google", baseUrl: "", decisionModel: true, context: 262144 },
    }),
    noLinks,
  );
  assert.equal(fromCatalog.connection?.endpoint, "https://generativelanguage.googleapis.com/v1beta/decisions");
  assert.equal(fromCatalog.connection?.dialect, "gemini");
  // A google row without an account (imported, or its account removed) asks Google's own address.
  const orphan = await resolveDecisionConnection(row({ account: null, baseUrl: "" }), noLinks);
  assert.ok(orphan.connection, `resolves without an account: ${orphan.error}`);
  assert.equal(orphan.connection.endpoint, "https://generativelanguage.googleapis.com/v1beta/decisions");
  assert.equal(orphan.connection.dialect, "gemini");

  // (c) A Google chat model has no log-probabilities.
  const chat = await resolveDecisionConnection(
    row({ decisionSource: "openai_compatible", model: "gemini-2.5-pro" }),
    noLinks,
  );
  assert.equal(chat.error, "invalid_source");
  // No key, no request. NanoGPT rows carry no dialect.
  assert.equal((await resolveDecisionConnection(row({ apiKey: " " }), noLinks)).error, "missing_key");
  const nano = await resolveDecisionConnection(
    row({ decisionSource: "nanogpt", account: { provider: "nanogpt", baseUrl: "" } }),
    noLinks,
  );
  assert.equal(nano.connection?.dialect, undefined);

  // (d) The request: `input` as a string, no `state`, the Google key header, plain ids, answers mapped back.
  const local = await resolveDecisionConnection(
    row({ account: { provider: "google", baseUrl: `${origin}/v1beta` } }),
    noLinks,
  );
  assert.ok(local.connection, `resolves locally: ${local.error}`);
  assert.equal(local.connection.endpoint, `${origin}/v1beta/decisions`);
  const state = { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] };
  const noulId = "door\u00000";
  const choiceId = "mood\u00001";
  const result = await askNoulQuestions({
    connection: local.connection,
    state,
    questions: [
      { id: noulId, instructions: "The door is open." },
      { id: choiceId, instructions: "Which mood?", options: ["calm", "tense"], criteria: ["", "Raised voices."] },
    ],
    timeoutMs: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.answers.get(noulId), 0.83);
  assert.equal(result.choices.get(choiceId), "calm");
  const sent = requests.at(-1)!;
  assert.equal(sent.path, "/v1beta/decisions");
  assert.equal(sent.headers["x-goog-api-key"], "goog-key");
  assert.equal(sent.headers.authorization, undefined);
  assert.equal(sent.body.model, "gemini-decision-1");
  assert.deepEqual(Object.keys(sent.body).sort(), ["input", "model", "questions"]);
  assert.equal(sent.body.input, JSON.stringify(state));
  assert.deepEqual(Object.keys(sent.body.questions as object), ["q0", "q1"]);

  // A state that is already a string is sent as is; the inspection trace shows what is sent.
  const inspection = { mode: "inspect" as const, createdAt: "", turnId: null, model: null, results: [], requests: [] };
  await askNoulQuestions({
    connection: local.connection,
    state: "plain context",
    questions: [{ id: noulId, instructions: "x" }],
    inspection,
  });
  assert.equal((inspection.requests[0]!.body as { input?: unknown }).input, "plain context");
  assert.deepEqual(Object.keys(inspection.requests[0]!.body.questions as object), ["q0"]);

  // (e) Discovery keeps Gemini's decision model as a decision model and still drops embedding-only models.
  const models = normalizeModelsResponse("google", {
    models: [
      { name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", supportedGenerationMethods: ["generateContent"] },
      {
        name: "models/gemini-decision-1",
        displayName: "Gemini Decision 1",
        supportedGenerationMethods: ["createDecision"],
        inputTokenLimit: 262144,
        outputTokenLimit: 1,
      },
      { name: "models/gemini-embedding-001", supportedGenerationMethods: ["embedContent"] },
    ],
  });
  assert.deepEqual(
    models.map((model) => model.id),
    ["gemini-2.5-pro", "gemini-decision-1"],
  );
  assert.deepEqual(models[1]!.outputModalities, ["decisions"]);
  assert.equal(models[1]!.context, 262144);
  assert.equal(models[0]!.outputModalities, undefined);

  console.log("decision-google: ok");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
