import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-builtin-main-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { resolveChatConnectionOrFallback } =
  await import("../../packages/server/src/services/generation/connection-resolution.js");
const { sidecarModelService } = await import("../../packages/server/src/services/sidecar/sidecar-model.service.js");
const { createLLMProvider } = await import("../../packages/server/src/services/llm/provider-registry.js");
const { LOCAL_SIDECAR_CONNECTION_ID } = await import("../../packages/shared/src/index.js");

try {
  const db = await getDB();
  const connections = createConnectionsStorage(db);
  const row = await connections.create({
    name: "Fixture",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "fixture",
    apiKey: "fixture",
  });
  await connections.update(row.id, { isDefault: true });
  const follows = async () => (await resolveChatConnectionOrFallback(connections, null, undefined, null, true))?.id;

  assert.equal(await follows(), row.id, "Main is the row while the flag is off");
  // No model configured yet: the flag alone must not hand Main to a sidecar that cannot answer.
  sidecarModelService.updateConfig({ useAsMainDefault: true });
  assert.equal((await connections.getDefault())?.id, row.id, "no configured model: falls back to the row");
  writeFileSync(join(dir, "fixture.gguf"), "x");
  sidecarModelService.updateConfig({ externalModelPath: join(dir, "fixture.gguf") });
  assert.equal(await follows(), LOCAL_SIDECAR_CONNECTION_ID, "a follows-Main chat resolves to the built-in model");
  assert.equal((await connections.getDefault())?.id, LOCAL_SIDECAR_CONNECTION_ID, "every Main fallback agrees");
  await connections.update(row.id, { isDefault: true });
  assert.equal(sidecarModelService.getConfig().useAsMainDefault, false, "setting a row as Main clears the flag");
  assert.equal(await follows(), row.id, "the row is Main again");
  // Creating a row as Main clears it too.
  sidecarModelService.updateConfig({ useAsMainDefault: true });
  await connections.create({
    name: "Second",
    provider: "custom",
    baseUrl: "http://127.0.0.1:1/v1",
    model: "m",
    apiKey: "k",
    isDefault: true,
  });
  assert.equal(sidecarModelService.getConfig().useAsMainDefault, false, "creating a Main row clears the flag");
  // Deleting the model clears it.
  sidecarModelService.updateConfig({ useAsMainDefault: true });
  await sidecarModelService.deleteModel();
  assert.equal(sidecarModelService.getConfig().useAsMainDefault, false, "deleting the model clears the flag");
  // The registry gives the sidecar its own provider, not an HTTP client.
  const provider = createLLMProvider("local_sidecar", "local-sidecar://runtime", "");
  assert.equal(provider.constructor.name, "LocalSidecarProvider");
  console.log("built-in model as Main regression passed.");
} finally {
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
