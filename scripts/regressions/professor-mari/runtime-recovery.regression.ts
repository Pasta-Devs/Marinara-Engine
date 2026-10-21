// Exercise the rollout and failure threshold through real settings, chats and prompt() persistence.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_MARI_RUNTIME,
  MARI_RUNTIME_SETTINGS_KEY,
} from "../../../packages/shared/src/constants/mari-runtime.js";

const root = mkdtempSync(join(tmpdir(), "mari-runtime-recovery-"));
process.env.FILE_STORAGE_DIR = join(root, "storage");
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { seedProfessorMari } = await import("../../../packages/server/src/db/seed-mari.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const { ProfessorMariWorkspaceService, readStoredMariRuntime } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const settings = createAppSettingsStorage(db);
  assert.equal(DEFAULT_MARI_RUNTIME, "pi");
  assert.equal(await readStoredMariRuntime(settings), "pi", "fresh installs default to Pi");
  await settings.set(MARI_RUNTIME_SETTINGS_KEY, "classic");
  await seedProfessorMari(db);
  assert.equal(await readStoredMariRuntime(settings), "pi", "existing installs join the rollout once");
  await settings.set(MARI_RUNTIME_SETTINGS_KEY, "classic");
  await seedProfessorMari(db);
  assert.equal(await readStoredMariRuntime(settings), "classic", "subsequent startups preserve Classic");
  await settings.set(MARI_RUNTIME_SETTINGS_KEY, "pi");

  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Pi recovery", mode: "conversation", characterIds: [] });
  const service = new ProfessorMariWorkspaceService({ db } as never);
  service.setEnabled(true, join(root, "workspace"));
  let outcome: "failure" | "success" | "abort" = "failure";
  Object.assign(service, {
    ensureMariCliShim: async () => {},
    resolveConnection: async () => ({
      id: "recovery",
      name: "Fake",
      provider: "custom",
      model: "fake",
      baseUrl: "http://127.0.0.1:1",
      apiKey: "",
      maxContext: 32768,
    }),
    resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "default" }),
    buildPromptMessages: async () => ({ messages: [], manualApprovalArmed: false, heldCalls: [] }),
    runPiRuntime: async ({ state, signal }: { state: { assistantText: string }; signal: AbortSignal }) => {
      if (outcome === "failure") throw new Error("Scripted Pi error");
      if (outcome === "abort") {
        await service.abort();
        signal.throwIfAborted();
      }
      state.assistantText = "Hello.";
    },
    chatCompleteWorkspace: async () => {
      throw new Error("Classic error");
    },
  });
  const run = () => service.prompt({ chatId: chat.id, text: "Hello", onEvent: () => {} });
  const count = async () => (await service.status()).piConsecutiveFailures;
  for (let n = 1; n <= 3; n++) {
    await assert.rejects(run, /Scripted Pi error/);
    assert.equal(await count(), n, `Pi failure ${n} counts once`);
  }
  const beforeSwitch = await chats.listMessages(chat.id);
  await settings.set(MARI_RUNTIME_SETTINGS_KEY, "classic");
  service.resetRuntimeFailures();
  assert.equal(await count(), 0);
  assert.deepEqual(await chats.listMessages(chat.id), beforeSwitch, "switching keeps the conversation");
  await assert.rejects(run, /Classic error/);
  assert.equal(await count(), 0, "Classic errors do not count as Pi errors");
  await settings.set(MARI_RUNTIME_SETTINGS_KEY, "pi");
  await assert.rejects(run, /Scripted Pi error/);
  outcome = "abort";
  await run();
  assert.equal(await count(), 1, "cancellation neither adds nor clears a failure");
  outcome = "success";
  await run();
  assert.equal(await count(), 0, "a successful Pi run resets the streak");
  console.log("Professor Mari runtime rollout and recovery regression passed");
} finally {
  await closeDB();
  rmSync(root, { recursive: true, force: true });
}
