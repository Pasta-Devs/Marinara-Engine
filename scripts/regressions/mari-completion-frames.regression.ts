import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-completion-frames-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
try {
  const db = await getDB();
  const { ProfessorMariWorkspaceService } =
    await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { MariDbService } = await import("../../packages/server/src/services/mari-db/mari-db.service.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const mariDb = new MariDbService(db);
  const created = await mariDb.executeAction({
    action: "character.create",
    data: { name: "Frame regression", description: "Original" },
    apply: true,
  });
  assert.equal(created.ok, true);
  const characterId = String((created.summary?.preview?.[0] as { id?: string })?.id);
  const chats = createChatsStorage(db);

  for (const mode of ["auto", "manual", "plan"] as const) {
    const chat = await chats.create({ name: `Mixed frame ${mode}`, mode: "conversation", characterIds: [] });
    const calls: ChatMessage[][] = [];
    const tokens: string[] = [];
    const action = {
      action: "character.update",
      characterId,
      patch: { description: `Updated in ${mode}` },
      apply: true,
    };
    const service = new ProfessorMariWorkspaceService({ db } as never);
    Object.assign(service, {
      ensureMariCliShim: async () => {},
      resolveConnection: async () => ({
        id: "regression",
        name: "Regression",
        provider: "custom",
        model: "test",
        baseUrl: "http://127.0.0.1:1/v1",
        apiKey: "",
        maxContext: 8192,
      }),
      resolvePermissionsMode: async () => ({ mode, defaultMode: mode, source: "chat" }),
      buildPromptMessages: async () => ({
        messages: [{ role: "user", content: "Update the description." }],
        manualApprovalArmed: false,
      }),
      baseChatOptions: () => ({ model: "test" }),
      chatCompleteWorkspace: async (_provider: unknown, messages: ChatMessage[]) => {
        calls.push(structuredClone(messages));
        return {
          content: JSON.stringify(
            calls.length === 1
              ? {
                  say: "I've updated the description.",
                  commands: [{ name: "app_data", arguments: action }],
                  stop: false,
                }
              : { say: "The requested operation has been reviewed.", commands: [], stop: true },
          ),
          toolCalls: [],
          finishReason: "stop",
        };
      },
    });
    await service.prompt({
      chatId: chat.id,
      text: "Update the description.",
      onEvent: (event) => {
        if (event.type === "token") tokens.push(String(event.data));
      },
    });
    const current = await mariDb.executeAction({ action: "character.get", characterId });
    assert.equal(current.ok, true);
    if (mode === "auto") {
      assert.match(
        JSON.stringify(current),
        /Updated in auto/u,
        "a command sharing its frame with a completion claim must actually persist",
      );
      assert.match(tokens.join(""), /I've updated/u);
      assert.equal(calls.length, 2);
      assert.match(
        JSON.stringify(calls[1]),
        /Readback: store-verified/u,
        "the next round receives the same frame's executed result",
      );
    } else {
      assert.doesNotMatch(
        JSON.stringify(current),
        new RegExp(`Updated in ${mode}`, "u"),
        `${mode} still prevents the edit`,
      );
    }
  }
  console.log("Mari mixed completion frames preserve edits and permission boundaries.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}
