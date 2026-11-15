/**
 * OpenRouter decision models.
 *
 * A decision Model under an OpenRouter account whose model is a decision model (the row says `openrouter`, or the
 * account's catalog lists the `decisions` output) is asked at OpenRouter's System One endpoint
 * (`https://openrouter.ai/api/v1/systemone`) with the account's key. An OpenRouter chat model keeps the
 * log-probability path, and the standalone `openrouter` source resolves as before. Nothing is contacted.
 */
import assert from "node:assert/strict";
import {
  resolveDecisionConnection,
  type DecisionConnectionRow,
} from "../../../packages/server/src/services/decision/decision-connection.js";

const row = (fields: Partial<DecisionConnectionRow>): DecisionConnectionRow => ({
  id: "or-decision",
  provider: "decision",
  baseUrl: "",
  model: "typesafe/jev-latest",
  apiKey: "or-key",
  decisionSource: "openrouter",
  account: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1" },
  ...fields,
});
const noLinks = async () => null;

// The row's own source: System One at /api/v1/systemone, the account's key.
const native = await resolveDecisionConnection(row({}), noLinks);
assert.ok(native.connection, `resolves: ${native.error}`);
assert.equal(native.connection.protocol, "system_one");
assert.equal(native.connection.endpoint, "https://openrouter.ai/api/v1/systemone");
assert.equal(native.connection.apiKey, "or-key");
assert.equal(native.connection.model, "typesafe/jev-latest");

// A blank account address means OpenRouter's default one.
const blank = await resolveDecisionConnection(row({ account: { provider: "openrouter", baseUrl: "" } }), noLinks);
assert.equal(blank.connection?.endpoint, "https://openrouter.ai/api/v1/systemone");

// An account behind a gateway path keeps its prefix; only the trailing /v1 is replaced.
const gateway = await resolveDecisionConnection(
  row({ account: { provider: "openrouter", baseUrl: "https://gw.example.com/openrouter/api/v1/" } }),
  noLinks,
);
assert.equal(gateway.connection?.endpoint, "https://gw.example.com/openrouter/api/v1/systemone");

// A row any picker made (source openai_compatible) is still right when the account's catalog lists a decision model.
const fromCatalog = await resolveDecisionConnection(
  row({
    decisionSource: "openai_compatible",
    account: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", decisionModel: true, context: 1800 },
  }),
  noLinks,
);
assert.equal(fromCatalog.connection?.protocol, "system_one");
assert.equal(fromCatalog.connection?.endpoint, "https://openrouter.ai/api/v1/systemone");
assert.equal(fromCatalog.connection?.maxStateTokens, 1350);

// The source left unset, with the catalog fact alone.
const unset = await resolveDecisionConnection(
  row({
    decisionSource: null,
    account: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", decisionModel: true },
  }),
  noLinks,
);
assert.equal(unset.connection?.protocol, "system_one");
assert.equal(unset.connection?.endpoint, "https://openrouter.ai/api/v1/systemone");

// An OpenRouter chat model with no decision facts keeps the chat path.
const chat = await resolveDecisionConnection(
  row({ decisionSource: "openai_compatible", model: "openai/gpt-5-mini" }),
  noLinks,
);
assert.equal(chat.connection?.protocol, "chat_logprobs");
assert.equal(chat.connection?.endpoint, "https://openrouter.ai/api/v1/chat/completions");

// The standalone `openrouter` source (no account) is unchanged.
const standalone = await resolveDecisionConnection(row({ account: null }), noLinks);
assert.equal(standalone.connection?.protocol, "system_one");
assert.equal(standalone.connection?.endpoint, "https://openrouter.ai/api/v1/systemone");
assert.equal(standalone.connection?.apiKey, "or-key");

// The `openrouter` source under another vendor's account is not a way to reach OpenRouter.
const elsewhere = await resolveDecisionConnection(
  row({ account: { provider: "openai", baseUrl: "https://api.openai.com/v1" }, model: "gpt-x" }),
  noLinks,
);
assert.equal(elsewhere.connection?.protocol, "chat_logprobs");

// No key, no request.
assert.equal((await resolveDecisionConnection(row({ apiKey: " " }), noLinks)).error, "missing_key");

// NanoGPT still goes to its own Decisions API.
const nano = await resolveDecisionConnection(
  row({ decisionSource: "nanogpt", account: { provider: "nanogpt", baseUrl: "" } }),
  noLinks,
);
assert.equal(nano.connection?.endpoint, "https://nano-gpt.com/api/v1/decisions");

console.log("decision-openrouter: ok");
