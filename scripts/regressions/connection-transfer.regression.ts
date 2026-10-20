import assert from "node:assert/strict";
import {
  createConnectionExportEnvelope,
  getConnectionImportPlan,
} from "../../packages/client/src/lib/connection-transfer.js";

const baseUrl = "https://api.openai.com/v1";
const secrets = ["sk-account-secret", "mgmt-token-secret", "zq9x", "98765431", "sk-model-secret", "sk-param-secret"];

// A Connection (account) as the list endpoint returns it, plus raw secret fields a future list might carry.
const account = {
  id: "acc-1",
  name: "My OpenAI",
  provider: "openai",
  baseUrl,
  icon: "letters:OA",
  enabled: true,
  treatAsLocalEndpoint: false,
  showUsageWidget: false,
  showUsageFiveHour: true,
  showUsageWeekly: true,
  maxRequestsPerMinute: 60,
  maxParallelJobs: 2,
  hasApiKey: true,
  apiKeyLast4: "zq9x",
  hasManagementToken: true,
  balanceUserId: "98765431",
  usageKeys: { nanogpt: { hasKey: true } },
  apiKey: "sk-account-secret",
  managementToken: "mgmt-token-secret",
};
const rows = [
  {
    accountId: "acc-1",
    name: "GPT A",
    provider: "openai",
    baseUrl,
    model: "gpt-a",
    apiKey: "sk-model-secret",
    defaultParameters: { temperature: 0.5, apiKey: "sk-param-secret" },
  },
  { accountId: "acc-1", name: "GPT B", provider: "openai", baseUrl, model: "gpt-b", pinnedModels: ["gpt-b"] },
  { accountId: null, name: "Local", provider: "custom", baseUrl: "http://localhost:1234/v1", model: "local" },
];

const json = JSON.stringify(createConnectionExportEnvelope(rows, [account]));
for (const secret of secrets) assert.ok(!json.includes(secret), `export leaks ${secret}`);

const exported = JSON.parse(json);
assert.equal(exported.kind, "marinara.connections");
assert.equal(exported.version, 2);
assert.deepEqual(
  exported.connections.map((row: { model: string }) => row.model),
  ["local"],
  "Models of an exported Connection leave the bare list",
);

const plan = getConnectionImportPlan(exported);
assert.equal(plan.accounts.length, 1);
const [entry] = plan.accounts;
assert.ok(entry.account);
assert.equal(entry.account.name, "My OpenAI");
assert.equal(entry.account.provider, "openai");
assert.equal(entry.account.baseUrl, baseUrl);
assert.equal(entry.account.icon, "letters:OA");
assert.equal(entry.account.maxParallelJobs, 2);
assert.equal(entry.account.apiKey, "");
assert.equal(entry.account.managementToken, "");
assert.equal(entry.account.balanceUserId, "");
assert.deepEqual(
  entry.models.map((model) => model?.connection.model),
  ["gpt-a", "gpt-b"],
);
assert.ok(entry.models.every((model) => model?.connection.apiKey === ""));
assert.deepEqual(entry.models[0]?.defaultParameters, { temperature: 0.5 });
assert.deepEqual(entry.models[1]?.connection.pinnedModels, ["gpt-b"]);
assert.deepEqual(
  plan.models.map((model) => model?.connection.model),
  ["local"],
);
// A hand-edited file with a key in it still imports a keyless Connection.
assert.equal(getConnectionImportPlan({ accounts: [{ ...account, models: [] }] }).accounts[0].account?.apiKey, "");

// Version 1 files: envelope, bare array and single object import exactly as before.
const oldModel = { name: "Old", provider: "openai", baseUrl, model: "gpt-old", apiKey: "sk-old" };
for (const file of [
  { kind: "marinara.connections", version: 1, connections: [oldModel] },
  [oldModel],
  oldModel,
  { items: [oldModel] },
]) {
  const oldPlan = getConnectionImportPlan(file);
  assert.equal(oldPlan.accounts.length, 0);
  assert.equal(oldPlan.models.length, 1);
  assert.equal(oldPlan.models[0]?.connection.name, "Old");
  assert.equal(oldPlan.models[0]?.connection.model, "gpt-old");
  assert.equal(oldPlan.models[0]?.connection.apiKey, "");
}
assert.deepEqual(getConnectionImportPlan({ version: 1, connections: [{ name: "No provider" }] }).models, [null]);

console.log("connection transfer regression passed");
