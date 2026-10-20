/**
 * A decision Model can live under any Connection whose service speaks OpenAI-style chat
 * (NanoGPT, OpenRouter, a custom server): the Connection's vendor picks the protocol
 * (`chat_logprobs` at the Connection's address). Older rows keep resolving from their own
 * `decisionSource`, a borrowed key never goes to another host, and a hosted vendor needs a key.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-decision-any-provider-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { resolveDecisionConnection } =
  await import("../../packages/server/src/services/decision/decision-connection.js");
const { credentialVendor, createConnectionAccountsStorage } =
  await import("../../packages/server/src/services/storage/connection-accounts.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/src/schemas/connection.schema.js");

type Row = Parameters<typeof resolveDecisionConnection>[0];
const KEY = "fixture-nanogpt-key";
const base: Row = { id: "d", provider: "decision", baseUrl: "", model: "", apiKey: "" };
const none = async () => null;
const resolve = (row: Partial<Row>, getWithKey: (id: string) => Promise<Row | null> = none) =>
  resolveDecisionConnection({ ...base, ...row }, getWithKey);

try {
  // A row under a NanoGPT Connection asks NanoGPT's chat endpoint and reads log-probabilities.
  const nano = await resolve({
    model: "fixture/chat-model",
    apiKey: KEY,
    decisionSource: "openai_compatible",
    baseUrl: "https://nano-gpt.com/api/v1",
    account: { provider: "nanogpt", baseUrl: "" },
  });
  assert.equal(nano.connection?.protocol, "chat_logprobs");
  assert.equal(nano.connection?.endpoint, "https://nano-gpt.com/api/v1/chat/completions");
  assert.equal(nano.connection?.apiKey, KEY);
  assert.equal(nano.connection?.model, "fixture/chat-model");
  // The Connection's own address wins over the vendor default.
  const bifrost = await resolve({
    model: "m",
    apiKey: KEY,
    account: { provider: "custom", baseUrl: "https://bifrost.example/v1" },
  });
  assert.equal(bifrost.connection?.endpoint, "https://bifrost.example/v1/chat/completions");

  // Older rows resolve exactly as before.
  const openrouter = await resolve({ decisionSource: "openrouter", apiKey: "k" });
  assert.equal(openrouter.connection?.protocol, "system_one");
  assert.equal(openrouter.connection?.endpoint, "https://openrouter.ai/api/v1/systemone");
  assert.equal(openrouter.connection?.model, "jev-latest");
  const typesafe = await resolve({ decisionSource: "typesafe", apiKey: "k" });
  assert.equal(typesafe.connection?.protocol, "system_one");
  assert.equal(typesafe.connection?.endpoint, "https://api.typesafe.ai/v1/systemone");
  // A row under an old "Decision" Connection keeps its own source.
  const oldAccount = await resolve({ apiKey: "k", account: { provider: "decision", baseUrl: "" } });
  assert.equal(oldAccount.connection?.endpoint, "https://api.typesafe.ai/v1/systemone");

  // Refusals: no key on a hosted vendor, a vendor without OpenAI chat, a key for another host.
  assert.equal((await resolve({ model: "m", account: { provider: "nanogpt", baseUrl: "" } })).error, "missing_key");
  assert.equal(
    (await resolve({ model: "m", apiKey: KEY, account: { provider: "anthropic", baseUrl: "" } })).error,
    "invalid_source",
  );
  const nanoChat: Row = { ...base, id: "chat", provider: "nanogpt", apiKey: KEY };
  const lend = async (id: string) => (id === "chat" ? nanoChat : null);
  const elsewhere = await resolve(
    {
      decisionSource: "openai_compatible",
      baseUrl: "https://evil.example/v1",
      model: "m",
      credentialsFromConnectionId: "chat",
    },
    lend,
  );
  assert.equal(elsewhere.error, "needs_relinking", "a key never goes to another host");
  // Any service may lend its key on its own host (the old gate allowed only OpenRouter and Custom).
  const sameHost = await resolve(
    {
      decisionSource: "openai_compatible",
      baseUrl: "https://nano-gpt.com/api/v1",
      model: "m",
      credentialsFromConnectionId: "chat",
    },
    lend,
  );
  assert.equal(sameHost.connection?.apiKey, KEY);

  // A chat decision row on a hosted service's address belongs to that service's Connection.
  assert.equal(
    credentialVendor({
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: "https://nano-gpt.com/api/v1",
    }),
    "nanogpt",
  );
  assert.equal(
    credentialVendor({
      provider: "decision",
      decisionSource: "openai_compatible",
      baseUrl: "http://localhost:11434/v1",
    }),
    "decision:openai_compatible",
  );
  assert.equal(credentialVendor({ provider: "decision", decisionSource: "typesafe" }), "decision:typesafe");

  // End to end: the Add window's row joins the NanoGPT Connection and resolves through it.
  const db = await getDB();
  const accounts = createConnectionAccountsStorage(db);
  const connections = createConnectionsStorage(db);
  const account = await accounts.create({
    name: "NanoGPT",
    provider: "nanogpt",
    apiKey: KEY,
    baseUrl: "https://nano-gpt.com/api/v1",
  });
  const created = await connections.create(
    createConnectionSchema.parse({
      name: "NanoGPT",
      provider: "decision",
      apiKey: "",
      baseUrl: "https://nano-gpt.com/api/v1",
      accountId: account.id,
      decisionSource: "openai_compatible",
      model: "fixture/chat-model",
    }),
  );
  assert.equal(created?.accountId, account.id, "the decision Model joins the NanoGPT Connection");
  const stored = await connections.getWithKey(created!.id);
  assert.deepEqual(stored?.account, { provider: "nanogpt", baseUrl: "https://nano-gpt.com/api/v1" });
  const linked = await resolveDecisionConnection(stored!, (id) => connections.getWithKey(id));
  assert.equal(linked.connection?.protocol, "chat_logprobs");
  assert.equal(linked.connection?.endpoint, "https://nano-gpt.com/api/v1/chat/completions");
  assert.equal(linked.connection?.apiKey, KEY, "the key comes from the Connection");

  // A voice Model at the Connection's address joins it too and uses its key (NanoGPT speaks
  // OpenAI-style speech).
  const voice = await connections.create(
    createConnectionSchema.parse({
      name: "NanoGPT",
      provider: "audio",
      apiKey: "",
      baseUrl: "https://nano-gpt.com/api/v1",
      accountId: account.id,
      audioSource: "openai",
    }),
  );
  assert.equal(voice?.accountId, account.id, "the voice Model joins the NanoGPT Connection");
  assert.equal((await connections.getWithKey(voice!.id))?.apiKey, KEY);
  console.log("decision-any-provider: ok");
} finally {
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
