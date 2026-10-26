import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";
import { NON_CHAT_PROVIDERS } from "../../packages/shared/src/constants/providers.js";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";
import { connectionsRoutes } from "../../packages/server/src/routes/connections.routes.js";
import { errorHandler } from "../../packages/server/src/middleware/error-handler.js";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const modal = read("../../packages/client/src/components/modals/create-connection/CreateConnectionModalContent.tsx");
const picker = read("../../packages/client/src/components/connections/ConnectionSelect.tsx");
const access = read("../../packages/client/src/components/modals/create-connection/AccessStep.tsx");
const backup = read("../../packages/server/src/routes/backup.routes.ts");
const connections = read("../../packages/server/src/routes/connections.routes.ts");
const generation = read("../../packages/server/src/routes/generate.routes.ts");
const services = read("../../packages/client/src/components/modals/create-connection/shared.tsx");
const models = read("../../packages/client/src/components/modals/create-connection/ModelsStep.tsx");

assert.match(picker, /assign: \(id\) => onChangeRef\.current\(id\)/);
assert.match(modal, /if \(assignment\.assign\) \{[\s\S]*?await Promise\.resolve\(assign\(id\)\);/);
assert.match(
  modal,
  /const discardFreshAccount = async \(\) => \{[\s\S]*?deleteRow\.mutateAsync\(current\.connectionId\)/,
);
assert.match(access, /failure === "key"[\s\S]*?connections\.add\.retryKey/);
assert.doesNotMatch(backup, /Profile connection records must include a non-empty model ID/);
assert.match(connections, /Object\.hasOwn\(body, "model"\)[\s\S]*?non-empty model ID/);
assert.match(services, /custom: \["chat", "image", "local"\]/);
assert.match(models, /props\.service === "custom"[\s\S]*?kind === "image"/);
assert.match(generation, /This chat has no character\. Add a character before sending a message\./);

// Run the actual modal handler with mutation doubles: failed results and thrown tests
// remove only the fresh account; retry and Continue anyway create a usable target again.
const handler = modal.slice(modal.indexOf("const saveAndTest ="), modal.indexOf("  const showModelsOf ="));
const javascript = ts.transpile(handler + "\nreturn saveAndTest;", { target: ts.ScriptTarget.ES2022 });
const calls: string[] = [];
let target: unknown = null;
let result: unknown = { success: false, message: "API returned 401" };
const mutation = (name: string, value?: unknown) => ({
  mutateAsync: async () => {
    calls.push(name);
    return value;
  },
});
const createHandler = new Function("context", `with(context) { ${javascript} }`);
const context = {
  provider: "custom",
  target: null,
  accountFields: () => ({}),
  name: "",
  isMedia: false,
  createAccount: mutation("create", {
    account: { id: "account", baseUrl: "http://localhost/v1" },
    connectionId: "row",
  }),
  updateAccount: mutation("update"),
  deleteRow: mutation("delete-row"),
  deleteAccount: mutation("delete-account"),
  testConnection: {
    mutateAsync: async () => {
      calls.push("test");
      if (result instanceof Error) throw result;
      return result;
    },
  },
  setTarget: (value: unknown) => {
    target = value;
  },
  setTested: () => {},
  kindsOf: () => ["chat", "image"],
  service: "custom",
  startKind: () => "chat",
  setSetupKind: () => {},
  setStep: () => {
    calls.push("models");
  },
  errorText: String,
  toast: { error: () => {} },
  t: () => "error",
};
for (const testResult of [{ success: false }, new Error("network")]) {
  calls.length = 0;
  result = testResult;
  await createHandler(context)();
  assert.deepEqual(calls, ["create", "test", "delete-row", "delete-account"]);
  assert.equal(target, null);
}
calls.length = 0;
await createHandler(context)(true);
assert.deepEqual(calls, ["create", "models"]);
calls.length = 0;
result = { success: true };
await createHandler(context)();
assert.deepEqual(calls, ["create", "test", "models"]);
calls.length = 0;
result = { success: false };
await createHandler({ ...context, target: { accountId: "existing", connectionId: "row", fresh: false } })();
assert.deepEqual(calls, ["update", "test"]);

const directory = await mkdtemp(join(tmpdir(), "connection-safety-"));
process.env.FILE_STORAGE_DIR = directory;
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const app = Fastify();
app.decorate("db", await createFileNativeDB());
app.setErrorHandler(errorHandler);
await app.register(connectionsRoutes, { prefix: "/connections" });
try {
  for (const model of ["", "   ", null, 42]) {
    const response = await app.inject({
      method: "POST",
      url: "/connections",
      payload: { name: "Imported", provider: "custom", model },
    });
    assert.equal(response.statusCode, 400, response.body);
    assert.match(response.json().error, /non-empty model ID/);
  }
  const valid = await app.inject({
    method: "POST",
    url: "/connections",
    payload: { name: "Imported", provider: "custom", model: "stub-chat" },
  });
  assert.ok([200, 201].includes(valid.statusCode), valid.body);
  const placeholder = await app.inject({
    method: "POST",
    url: "/connections",
    payload: { name: "Setup", provider: "custom" },
  });
  assert.ok([200, 201].includes(placeholder.statusCode), placeholder.body);
  for (const provider of NON_CHAT_PROVIDERS) {
    for (const model of [undefined, "", "   "]) {
      const response = await app.inject({
        method: "POST",
        url: "/connections",
        payload: { name: "Container", provider, model, audioGenerationSource: "elevenlabs" },
      });
      assert.ok([200, 201].includes(response.statusCode), `${provider}: ${response.body}`);
    }
  }
} finally {
  await app.close();
  await rm(directory, { recursive: true, force: true });
}

console.log("connections account safety regression passed");
