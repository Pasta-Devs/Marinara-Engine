/**
 * The Default model: a chat Model with no model id, on a Connection whose server answers with the model it has
 * loaded (a local or self-hosted engine, or the Grok CLI). It is listed and pickable like any Model there, and its
 * required name is not a setting of its own. On any other Connection an empty chat row stays a hidden anchor.
 */
import assert from "node:assert/strict";
import { groupModelsByAccount } from "../../../packages/client/src/lib/connection-groups.js";

const { accountAllowsLoadedModel } =
  await import("../../../packages/server/src/services/storage/connection-accounts.storage.js");
const { hasOwnModelSettings } = await import("../../../packages/server/src/services/storage/connections.storage.js");

const account = (id: string, loadedModel: boolean) => ({ id, name: id, state: "ok", loadedModel }) as never;

// A local engine lists its empty chat row as the Default model; a cloud Connection keeps it as a hidden anchor.
const { groups } = groupModelsByAccount(
  [
    { id: "local-default", model: "", provider: "custom", accountId: "local" },
    { id: "local-llama", model: "llama-3-8b", provider: "custom", accountId: "local" },
    { id: "cloud-anchor", model: "", provider: "openai", accountId: "cloud" },
    { id: "cloud-gpt", model: "gpt-5.5", provider: "openai", accountId: "cloud" },
  ],
  [account("local", true), account("cloud", false)],
);
assert.deepEqual(
  groups.map((group) => [group.account.id, group.rows.map((row) => row.id)]),
  [
    ["local", ["local-default", "local-llama"]],
    ["cloud", ["cloud-gpt"]],
  ],
);

// Which Connections may hold a Default model: the same rule the server uses to send no model id.
const allows = (provider: string, baseUrl: string, treatAsLocalEndpoint = "false") =>
  accountAllowsLoadedModel({ provider, baseUrl, treatAsLocalEndpoint });
assert.equal(allows("custom", "http://localhost:5001/v1"), true);
assert.equal(allows("custom", "http://192.168.1.50:11434/v1"), true);
assert.equal(allows("openai", "http://127.0.0.1:1234/v1"), true);
assert.equal(allows("custom", "https://api.example.com/v1"), false);
assert.equal(allows("custom", "https://api.example.com/v1", "true"), true);
assert.equal(allows("grok_subscription", ""), true);
assert.equal(allows("anthropic", "https://api.anthropic.com"), false);
assert.equal(allows("image_generation", "http://localhost:7860"), false);

// A Default model needs a name, so naming it is no custom setting; a named catalog model still is.
assert.equal(hasOwnModelSettings({ provider: "custom", model: "", name: "Default", maxContext: 128000 }, null), false);
assert.equal(
  hasOwnModelSettings(
    { provider: "custom", model: "", name: "Default", defaultParameters: '{"temperature":0.4}' },
    null,
  ),
  true,
);
assert.equal(hasOwnModelSettings({ provider: "custom", model: "llama-3-8b", name: "My llama" }, null), true);

console.log("default-loaded-model: ok");
