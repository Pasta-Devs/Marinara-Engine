// Professor Mari's prompt keeps a stable start from one turn to the next, so a provider's prefix cache (DeepSeek,
// OpenAI, llama.cpp) can reuse the system prompt AND the chat history. Before: the per-turn blocks
// (<workspace_context> with currentTime, the continuity record) sat before the history, and a 40-message window
// moved by two rows every turn, so a long chat reused only the system prompt.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ChatCompletionResult,
  ChatMessage,
  ChatOptions,
} from "../../../packages/server/src/services/llm/base-provider.js";

const storageDir = mkdtempSync(join(tmpdir(), "marinara-mari-cache-storage-"));
const workspaceDir = mkdtempSync(join(tmpdir(), "marinara-mari-cache-workspace-"));
const previousStorageDir = process.env.FILE_STORAGE_DIR;
process.env.FILE_STORAGE_DIR = storageDir;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");

const reply = (content: string, calls: Array<{ id: string; name: string; args: Record<string, unknown> }> = []) =>
  ({
    content,
    toolCalls: calls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })),
    finishReason: calls.length > 0 ? "tool_calls" : "stop",
    usage: { promptTokens: 1000, completionTokens: 100, totalTokens: 1100 },
  }) satisfies ChatCompletionResult;

/** The request as a provider sees it, one string per message, for the shared-start measure. */
const wire = (messages: ChatMessage[]) =>
  JSON.stringify(
    messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
      ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    })),
  );
const sharedStart = (a: string, b: string) => {
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index++;
  return index;
};

try {
  const db = await getDB();
  const { ProfessorMariWorkspaceService } =
    await import("../../../packages/server/src/services/professor-mari/workspace-agent.service.js");
  const { setSkillGateEnabled } =
    await import("../../../packages/server/src/services/professor-mari/workspace-commands.js");
  setSkillGateEnabled(false);
  const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
  const { createAppSettingsStorage } =
    await import("../../../packages/server/src/services/storage/app-settings.storage.js");
  const { MARI_RUNTIME_SETTINGS_KEY } = await import("../../../packages/shared/src/constants/mari-runtime.js");
  const chats = createChatsStorage(db);
  const settings = createAppSettingsStorage(db);

  let script: ChatCompletionResult[] = [];
  let requests: ChatMessage[][] = [];
  const service = new ProfessorMariWorkspaceService({ db } as never);
  service.setEnabled(true, workspaceDir);
  Object.assign(service, {
    ensureMariCliShim: async () => {},
    resolveConnection: async () => ({
      id: "mari-cache",
      name: "Regression",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "",
      maxContext: 1_000_000,
      defaultParameters: null,
    }),
    resolvePermissionsMode: async () => ({ mode: "auto", defaultMode: "auto", source: "chat" }),
    chatCompleteWorkspace: async (_provider: unknown, messages: ChatMessage[], _options: ChatOptions) => {
      requests.push(structuredClone(messages));
      const next = script.shift();
      if (!next) throw new Error("The scripted provider ran out of replies.");
      return next;
    },
  });

  const filler = (turn: number) =>
    `Answer ${turn}. ${"Here is a long and useful explanation of the setting. ".repeat(30)}`;

  for (const runtime of ["pi", "classic"] as const) {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, runtime);
    const chat = await chats.create({ name: `cache ${runtime}`, mode: "conversation", characterIds: [] });
    const turns: ChatMessage[][][] = [];
    for (let turn = 0; turn < 30; turn += 1) {
      requests = [];
      // Every third turn reads a file first: a tool round, then the answer.
      script =
        runtime === "pi" && turn % 3 === 0
          ? [reply("", [{ id: `read-${turn}`, name: "read", args: { path: "missing.txt" } }]), reply(filler(turn))]
          : [reply(runtime === "classic" ? JSON.stringify({ say: filler(turn) }) : filler(turn))];
      await service.prompt({
        chatId: chat.id,
        text: `Question ${turn}: tell me about part ${turn}.`,
        onEvent: () => {},
      });
      assert.ok(requests.length > 0, `${runtime} turn ${turn} sent a request`);
      turns.push(requests);
    }
    const shares: number[] = [];
    for (let turn = 1; turn < turns.length; turn += 1) {
      const previous = wire(turns[turn - 1]!.at(-1)!);
      const current = wire(turns[turn]![0]!);
      const shared = sharedStart(previous, current);
      shares.push(shared / current.length);
      // Inside one turn, each tool round extends the request before it.
      for (let round = 1; round < turns[turn]!.length; round += 1) {
        const before = wire(turns[turn]![round - 1]!).slice(0, -1);
        const after = wire(turns[turn]![round]!);
        assert.ok(after.startsWith(before.slice(0, before.lastIndexOf("}"))), `${runtime} turn ${turn} round ${round}`);
      }
    }
    const late = shares.slice(-10);
    console.log(
      `${runtime}: shared start of consecutive turns, last 10:`,
      late.map((share) => `${Math.round(share * 100)}%`).join(" "),
    );
    // The history window moves one step every ten turns; every other turn reuses all but the newest exchange.
    assert.ok(
      late.filter((share) => share > 0.85).length >= 9,
      `${runtime}: a long chat reuses most of its prompt from the turn before`,
    );
  }
  // On the wire: the system prompt goes as one message and the per-turn context keeps its place after the history.
  // A local server's chat template takes one system message, at index 0, so there all of them join it.
  {
    const fresh = new ProfessorMariWorkspaceService({ db } as never);
    const sent: ChatMessage[][] = [];
    const fakeProvider = {
      chatComplete: async (messages: ChatMessage[]) => {
        sent.push(messages);
        return reply("ok");
      },
    };
    const input: ChatMessage[] = [
      { role: "system", content: "Stable A", contextKind: "prompt" },
      { role: "system", content: "Stable B", contextKind: "prompt" },
      { role: "user", content: "Earlier", contextKind: "history" },
      { role: "assistant", content: "Answer", contextKind: "history" },
      { role: "user", content: "Now", contextKind: "history" },
      {
        role: "system",
        content: "<workspace_context>\ncurrentTime: now\n</workspace_context>",
        contextKind: "injection",
      },
    ];
    const internals = fresh as unknown as {
      baseChatOptions: (
        connection: Record<string, unknown>,
        signal: AbortSignal,
        onThinking: () => void,
      ) => ChatOptions;
      chatCompleteWorkspace: (provider: unknown, messages: ChatMessage[], options: ChatOptions) => Promise<unknown>;
    };
    const connection = (baseUrl: string) => ({
      id: "wire",
      name: "Wire",
      provider: "custom",
      model: "some-model",
      baseUrl,
      apiKey: "",
      maxContext: 0,
      defaultParameters: null,
    });
    for (const [baseUrl, expected] of [
      [
        "https://api.example.com/v1",
        ["system:Stable A\n\nStable B", "user", "assistant", "user", "system:<workspace_context>"],
      ],
      ["http://127.0.0.1:8080/v1", ["system:Stable A\n\nStable B\n\n<workspace_context>", "user", "assistant", "user"]],
    ] as const) {
      const options = internals.baseChatOptions(connection(baseUrl), new AbortController().signal, () => {});
      await internals.chatCompleteWorkspace(fakeProvider, input, options);
      assert.deepEqual(
        sent
          .at(-1)!
          .map((message) =>
            message.role === "system" ? `system:${message.content.split("\ncurrentTime")[0]}` : message.role,
          ),
        expected,
        baseUrl,
      );
    }
  }

  // A reply cut at the output limit is Marinara's to handle (redo smaller, then stop). pi must not also take it for a
  // context overflow: that sent the whole long conversation again in an extra summary request, uncached.
  {
    await settings.set(MARI_RUNTIME_SETTINGS_KEY, "pi");
    const chat = await chats.create({ name: "cache cut", mode: "conversation", characterIds: [] });
    const long = (turn: number) => `Answer ${turn}. ${"A long reply that fills the context. ".repeat(250)}`;
    for (let turn = 0; turn < 16; turn += 1) {
      script = [reply(long(turn))];
      await service.prompt({ chatId: chat.id, text: `Question ${turn}.`, onEvent: () => {} });
    }
    requests = [];
    const cut = { ...reply("Partial"), finishReason: "length" } satisfies ChatCompletionResult;
    script = [cut, cut, cut, reply("never sent")];
    await service.prompt({ chatId: chat.id, text: "Write it all.", onEvent: () => {} });
    assert.equal(requests.length, 3, "two smaller redos, then the run stops: no extra summary request");
  }
  console.log("mari-prompt-cache: ok");
} finally {
  await closeDB();
  rmSync(storageDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
  if (previousStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousStorageDir;
}
