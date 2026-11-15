/**
 * NanoGPT decision models (#9310).
 *
 * A decision Model under a NanoGPT account with the `nanogpt` source is asked at NanoGPT's
 * Decisions API (`<origin>/api/v1/decisions`) with the System One body and the account's key,
 * not as a chat model. A NanoGPT chat model used for decisions keeps the log-probability path.
 * The Model's Custom Request Headers (such as `x-billing-mode: paygo`) ride along, and the
 * host-managed ones stay the host's. NanoGPT itself is never contacted: a stand-in on
 * 127.0.0.1 answers instead.
 */
import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { DECISION_TIMEOUT_MS, defaultDecisionTimeoutMs } from "../../../packages/shared/src/index.js";
import {
  resolveDecisionConnection,
  type DecisionConnectionRow,
} from "../../../packages/server/src/services/decision/decision-connection.js";
import { askNoulQuestions } from "../../../packages/server/src/services/decision/system-one.client.js";

const requests: Array<{ path: string; headers: IncomingHttpHeaders; body: Record<string, unknown> }> = [];
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
  requests.push({ path: req.url ?? "", headers: req.headers, body });
  if (req.method !== "POST" || req.url !== "/api/v1/decisions") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "dec_1",
      model: body.model,
      answers: Object.fromEntries(
        Object.keys(body.questions as object).map((id) => [id, { type: "noul", noul: 0.83 }]),
      ),
      usage: { input_tokens: 12, output_tokens: 0 },
    }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const row = (fields: Partial<DecisionConnectionRow>): DecisionConnectionRow => ({
  id: "nano-decision",
  provider: "decision",
  baseUrl: `${origin}/api/v1`,
  model: "typesafe/jev-latest",
  apiKey: "nano-key",
  decisionSource: "nanogpt",
  account: { provider: "nanogpt", baseUrl: `${origin}/api/v1` },
  ...fields,
});
const noLinks = async () => null;

try {
  // A NanoGPT decision model goes to the Decisions API under /api, with the account's key.
  const resolved = await resolveDecisionConnection(
    row({ defaultParameters: JSON.stringify({ customHeaders: { "x-billing-mode": "paygo" } }) }),
    noLinks,
  );
  assert.ok(resolved.connection, `resolves: ${resolved.error}`);
  assert.equal(resolved.connection.protocol, "system_one");
  assert.equal(resolved.connection.endpoint, `${origin}/api/v1/decisions`);
  assert.equal(resolved.connection.apiKey, "nano-key");
  assert.equal(resolved.connection.model, "typesafe/jev-latest");
  assert.deepEqual(resolved.connection.headers, { "x-billing-mode": "paygo" });
  // NanoGPT answered in 1.1–2.5 s when measured, so it gets the longer default limit.
  assert.equal(resolved.connection.timeoutMs, DECISION_TIMEOUT_MS.sidecar);
  assert.equal(defaultDecisionTimeoutMs("nanogpt"), DECISION_TIMEOUT_MS.sidecar);
  assert.equal(defaultDecisionTimeoutMs("typesafe"), DECISION_TIMEOUT_MS.systemOne);

  // The default NanoGPT address (…/api/v1) maps to its Decisions API too.
  const defaultAddress = await resolveDecisionConnection(
    row({ account: { provider: "nanogpt", baseUrl: "" } }),
    noLinks,
  );
  assert.equal(defaultAddress.connection?.endpoint, "https://nano-gpt.com/api/v1/decisions");

  // A NanoGPT chat model picked for decisions still reads log-probabilities at chat completions.
  const chat = await resolveDecisionConnection(row({ decisionSource: "openai_compatible", model: "glm-5.3" }), noLinks);
  assert.equal(chat.connection?.protocol, "chat_logprobs");
  assert.equal(chat.connection?.endpoint, `${origin}/api/v1/chat/completions`);

  // The `nanogpt` source under another vendor's account is not a way to reach NanoGPT.
  const elsewhere = await resolveDecisionConnection(
    row({ account: { provider: "openai", baseUrl: `${origin}/v1` }, model: "gpt-x" }),
    noLinks,
  );
  assert.equal(elsewhere.connection?.protocol, "chat_logprobs");

  // No key, no request.
  assert.equal((await resolveDecisionConnection(row({ apiKey: " " }), noLinks)).error, "missing_key");

  // Host-managed or malformed headers are dropped wholesale, as for a chat Model; broken JSON sends none.
  const reserved = await resolveDecisionConnection(
    row({ defaultParameters: JSON.stringify({ customHeaders: { Authorization: "Bearer stolen" } }) }),
    noLinks,
  );
  assert.equal(reserved.connection?.headers, undefined);
  assert.equal(
    (await resolveDecisionConnection(row({ defaultParameters: "{not json" }), noLinks)).connection?.headers,
    undefined,
  );

  // The request: System One body, bearer key, the custom header; the answer is read back.
  const result = await askNoulQuestions({
    connection: resolved.connection,
    state: { recent_messages: [{ role: "user", name: "User", content: "The door is open." }] },
    questions: [{ id: "door", instructions: "The door is open." }],
    timeoutMs: 5_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.answers.get("door"), 0.83);
  const sent = requests.at(-1)!;
  assert.equal(sent.path, "/api/v1/decisions");
  assert.equal(sent.headers.authorization, "Bearer nano-key");
  assert.equal(sent.headers["x-billing-mode"], "paygo");
  assert.equal(sent.body.model, "typesafe/jev-latest");
  assert.deepEqual(Object.keys(sent.body).sort(), ["model", "questions", "state"]);
  assert.deepEqual((sent.body.questions as Record<string, unknown>).door, {
    type: "noul",
    instructions: "The door is open.",
  });
  // A row any picker made (source openai_compatible) still goes to the Decisions API when the account's catalog
  // lists the model as a decision model, and its context caps the chat sent (Clef takes 1,800 tokens in all).
  const fromCatalog = await resolveDecisionConnection(
    row({
      decisionSource: "openai_compatible",
      model: "cloudflare/clef",
      account: { provider: "nanogpt", baseUrl: `${origin}/api/v1`, decisionModel: true, context: 1800 },
    }),
    noLinks,
  );
  assert.equal(fromCatalog.connection?.protocol, "system_one");
  assert.equal(fromCatalog.connection?.endpoint, `${origin}/api/v1/decisions`);
  assert.equal(fromCatalog.connection?.maxStateTokens, 1350);
  // A user-set budget wins; a large context leaves the 30,000 default.
  assert.equal(
    (
      await resolveDecisionConnection(
        row({ maxStateTokens: 900, account: { provider: "nanogpt", baseUrl: origin, context: 1800 } }),
        noLinks,
      )
    ).connection?.maxStateTokens,
    900,
  );
  assert.equal(
    (
      await resolveDecisionConnection(
        row({ account: { provider: "nanogpt", baseUrl: origin, context: 64000 } }),
        noLinks,
      )
    ).connection?.maxStateTokens,
    30000,
  );

  console.log("decision-nanogpt: ok");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
