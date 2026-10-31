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
const presence = read("../../packages/server/src/routes/generate/conversation-presence-runtime.ts");
const generation = read("../../packages/server/src/routes/generate.routes.ts");
const services = read("../../packages/client/src/components/modals/create-connection/shared.tsx");
const models = read("../../packages/client/src/components/modals/create-connection/ModelsStep.tsx");

assert.match(
  modal,
  /const discardFreshAccount = async \(\) => \{[\s\S]*?deleteRow\.mutateAsync\(current\.connectionId\)/,
);
assert.match(access, /failure === "key"[\s\S]*?add-connection-key/);
assert.doesNotMatch(backup, /Profile connection records must include a non-empty model ID/);
assert.match(connections, /Object\.hasOwn\(body, "model"\)[\s\S]*?non-empty model ID/);
assert.match(services, /custom: \["chat", "image", "local"\]/);
assert.match(models, /props\.service === "custom"[\s\S]*?kind === "image"/);
assert.match(presence, /This chat has no character\. Add a character before sending a message\./);

// Run the actual modal handler with mutation doubles: failed results and thrown tests
// remove only the fresh account; retry and Continue anyway create a usable target again.
const handler = modal.slice(modal.indexOf("const saveAndTest ="), modal.indexOf("  const showModelsOf ="));
const javascript = ts.transpile(handler + "\nreturn saveAndTest;", { target: ts.ScriptTarget.ES2022 });
const calls: string[] = [];
type Target = { accountId: string; connectionId: string; fresh: boolean; accountBaseUrl?: string };
let target: Target | null = null;
let result: unknown = { success: false, message: "API returned 401" };
let rows: Array<{ id: string; accountId: string }> = [];
const createResult = {
  account: { id: "account", baseUrl: "http://localhost/v1" },
  connectionId: "row",
};
const mutation = (name: string, value?: unknown) => ({
  mutateAsync: async () => {
    calls.push(name);
    if (name === "create-row") return { id: "restored-row" };
    return value;
  },
});
const createHandler = new Function("context", `with(context) { ${javascript} }`);
const context = {
  savingRef: { current: false },
  provider: "custom",
  accountFields: () => ({}),
  name: "",
  isMedia: false,
  createAccount: {
    mutateAsync: async () => {
      calls.push("create");
      return createResult;
    },
  },
  updateAccount: mutation("update"),
  connectionsQuery: { refetch: async () => ({ data: rows }) },
  createRow: mutation("create-row"),
  deleteRow: mutation("delete-row"),
  deleteAccount: mutation("delete-account"),
  testConnection: {
    mutateAsync: async () => {
      calls.push("test");
      if (result instanceof Error) throw result;
      return result;
    },
  },
  setTarget: (value: Target | null) => {
    target = value;
  },
  setTested: () => {},
  hasMain: true,
  modelsFor: undefined,
  job: undefined,
  baseUrl: "http://localhost/v1",
  serviceName: () => "Custom",
  withHttpScheme: (value: string) => value,
  kindsOf: () => ["chat", "image"],
  service: "custom",
  startKind: () => "chat",
  setSetupKind: () => {},
  finishAdded: async () => {
    calls.push("done");
  },
  newChatMode: undefined,
  setStep: () => {
    calls.push("models");
  },
  errorText: (error: unknown) => {
    if (error instanceof ReferenceError || error instanceof TypeError) throw error;
    return String(error);
  },
  toast: { error: () => {} },
  t: () => "error",
};
const runHandler = (continueAnyway = false) => createHandler({ ...context, target })(continueAnyway);
for (const testResult of [{ success: false }, new Error("network")]) {
  calls.length = 0;
  result = testResult;
  await runHandler();
  assert.deepEqual(calls, ["create", "test", "delete-row", "delete-account"]);
  assert.equal(target, null);
}
calls.length = 0;
result = { success: true };
target = null;
rows = [];
await runHandler(true);
assert.deepEqual(calls, ["create", "done"]);
calls.length = 0;
target = { accountId: "account", connectionId: "", fresh: true };
await runHandler(true);
assert.deepEqual(calls, ["update", "create-row", "done"]);
assert.equal(target?.connectionId, "restored-row");
calls.length = 0;
rows = [{ id: "restored-row", accountId: "account" }];
await runHandler(true);
assert.deepEqual(calls, ["update", "done"]);
calls.length = 0;
result = { success: true };
target = null;
await runHandler();
assert.deepEqual(calls, ["create", "test", "done"]);
calls.length = 0;
result = { success: false };
rows = [{ id: "row", accountId: "existing" }];
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
