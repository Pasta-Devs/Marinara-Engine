import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatCompletionResult, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-error-recovery-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");

try {
  const db = await getDB();
  const { ProfessorMariWorkspaceService } =
    await import("../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const chats = createChatsStorage(db);
  const chat = await chats.create({ name: "Mari error recovery", mode: "conversation", characterIds: [] });
  const service = new ProfessorMariWorkspaceService({ db } as never);
  const reportedError =
    "Custom OpenAI-compatible endpoint error 400: GLM 5.3 always thinks and does not support disabling reasoning.";
  const recoveredResponse: ChatCompletionResult = {
    content: JSON.stringify({ say: "The request completed successfully.", commands: [], stop: true }),
    toolCalls: [],
    finishReason: "stop",
  };
  let complete: (options: ChatOptions) => Promise<ChatCompletionResult> = async () => {
    throw new Error(reportedError);
  };
  Object.assign(service, {
    ensureMariCliShim: async () => {},
    resolveConnection: async () => ({
      id: "mari-error-recovery",
      name: "Regression",
      provider: "custom",
      model: "glm-5.3",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "",
      maxContext: 8192,
    }),
    resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
    buildPromptMessages: async () => ({
      messages: [{ role: "user", content: "Check the workspace." }],
      manualApprovalArmed: false,
    }),
    chatCompleteWorkspace: async (_provider: unknown, _messages: unknown, options: ChatOptions) => complete(options),
  });
  const prompt = (text: string, existingUserMessageId?: string) =>
    service.prompt({ chatId: chat.id, text, existingUserMessageId, onEvent: () => {} });
  const status = () => service.status(null, chat.id);

  await assert.rejects(prompt("Trigger the provider error."), { message: reportedError });
  assert.equal((await status()).error, reportedError, "A failed request must remain visible until a new run starts");
  assert.equal((await status()).active, false);

  await assert.rejects(prompt("Invalid retry.", "missing-user-message"), /Existing Professor Mari user message/u);
  assert.equal((await status()).error, reportedError, "A rejected preflight must not erase the previous failure");

  complete = async () => {
    const running = await status();
    assert.equal(running.active, true);
    assert.equal(running.error, null, "The prior GLM error must clear while the retry is running, without reset");
    return recoveredResponse;
  };
  await prompt("Retry after correcting the connection.");
  assert.equal((await status()).error, null, "A successful retry must not display the previous provider error");
  assert.equal((await status()).active, false);
  assert.ok(
    (await chats.listMessages(chat.id)).some(
      (message) => message.role === "assistant" && message.content === "The request completed successfully.",
    ),
    "The successful retry still persists its response",
  );

  const newError = "Custom OpenAI-compatible endpoint error 401: Invalid API key.";
  complete = async () => {
    throw new Error(newError);
  };
  await assert.rejects(prompt("Trigger a new provider failure."), { message: newError });
  assert.equal((await status()).error, newError, "Clearing stale errors must not suppress a new failure");

  complete = async () => {
    assert.equal((await status()).error, null);
    await service.abort();
    throw new Error("Request aborted");
  };
  await prompt("Cancel the next retry.");
  assert.equal((await status()).error, null, "Cancellation must not resurrect the old provider error");

  // A superseded request can reject after its replacement fails. Its aborted
  // catch must leave the replacement's current error intact.
  let releaseOldRequest!: (error: Error) => void;
  let markOldRequestStarted!: () => void;
  const oldRequestStarted = new Promise<void>((resolve) => {
    markOldRequestStarted = resolve;
  });
  complete = async () => {
    markOldRequestStarted();
    return new Promise<ChatCompletionResult>((_resolve, reject) => {
      releaseOldRequest = reject;
    });
  };
  const oldRun = prompt("Start a request that will be replaced.");
  await oldRequestStarted;
  complete = async () => {
    throw new Error(newError);
  };
  await assert.rejects(prompt("Replace the previous request."), { message: newError });
  releaseOldRequest(new Error(reportedError));
  await oldRun;
  assert.equal((await status()).error, newError, "A late superseded failure must not replace the current error");

  console.log("Professor Mari error recovery regression passed.");
} finally {
  await closeDB();
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
  rmSync(storageDir, { recursive: true, force: true });
}
