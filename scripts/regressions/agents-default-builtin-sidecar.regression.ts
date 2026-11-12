import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-builtin-agents-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";

const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { resolveChatSummaryConnection } =
  await import("../../packages/server/src/services/chat-summary/connection-resolution.js");
const { resolveBaseUrl } = await import("../../packages/server/src/services/generation/connection-base-url.js");
const { sidecarModelService } = await import("../../packages/server/src/services/sidecar/sidecar-model.service.js");
const { LOCAL_SIDECAR_CONNECTION_ID } = await import("../../packages/shared/src/index.js");

try {
  const db = await getDB();
  const connections = createConnectionsStorage(db);
  // The reported state: an older saved connection still carries the agents default, pointing at a server
  // that is no longer running, while the built-in model is also set as the agents default (#9075).
  const row = await connections.create({
    name: "Stale agents default",
    provider: "custom",
    baseUrl: "http://127.0.0.1:5001/v1",
    model: "stale-model",
    apiKey: "fixture",
    defaultForAgents: true,
  });
  sidecarModelService.updateConfig({ useAsAgentsDefault: true });
  // No model configured yet: the flag alone must not hand agents to a sidecar that cannot answer.
  assert.equal((await connections.getDefaultForAgents())?.id, row.id, "no configured model: falls back to the row");

  writeFileSync(join(dir, "fixture.gguf"), "x");
  sidecarModelService.updateConfig({ externalModelPath: join(dir, "fixture.gguf") });
  assert.equal(
    (await connections.getDefaultForAgents())?.id,
    LOCAL_SIDECAR_CONNECTION_ID,
    "the built-in model outranks a saved row still flagged as the agents default",
  );
  // The reported user-visible path: summaries must reach the built-in model, not the dead row.
  const summary = await resolveChatSummaryConnection({
    chatConnectionId: null,
    defaultConnectionId: null,
    chatMetadata: {},
    connections,
    resolveBaseUrl,
  });
  assert.equal(summary.ok, true, "a summary can resolve a connection");
  assert.equal(summary.ok && summary.connectionId, LOCAL_SIDECAR_CONNECTION_ID, "summaries use the built-in model");
  assert.equal(summary.ok && summary.source, "agent-default", "the built-in model is the agents default source");

  // Not the agents default any more: the saved row answers again.
  sidecarModelService.updateConfig({ useAsAgentsDefault: false });
  assert.equal((await connections.getDefaultForAgents())?.id, row.id, "the saved connection is the agents default");
  assert.equal(sidecarModelService.getConfig().useAsAgentsDefault, false);

  // The flag turned back on while the model is gone keeps the row: a default must be able to answer.
  sidecarModelService.updateConfig({ useAsAgentsDefault: true });
  await sidecarModelService.deleteModel();
  assert.equal((await connections.getDefaultForAgents())?.id, row.id, "a deleted model leaves the row as the default");

  console.log("built-in model as agents default regression passed.");
} finally {
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
