// server-hunt batch 34:
// 1. An AI [memory] command must not snapshot and version-bump the target card,
//    and must send only extensions.characterMemories (not a stale full extensions object).
// 2. trimIncompleteModelEnding must keep complete final sentences wrapped in markdown emphasis.
// 3. pruneEmptyPromptWrappers must not drop image-only or single-heading chat history turns.
import assert from "node:assert/strict";

process.env.LOG_LEVEL = "silent";

const { handleConversationSideEffectCommand } = await import(
  "../../packages/server/src/services/generation/conversation-side-effect-command-runtime.js"
);
const { trimIncompleteModelEnding } = await import(
  "../../packages/server/src/services/generation/generation-text-utils.js"
);
const { pruneEmptyPromptWrappers } = await import(
  "../../packages/server/src/services/generation/runtime-agent-sections.js"
);
const { scopeIndividualGroupMessagesForTarget } = await import(
  "../../packages/server/src/services/generation/prompt-message-scope.js"
);

// 1. Memory command update shape.
{
  const calls: Array<{ id: string; data: Record<string, unknown>; avatarPath?: string; options?: unknown }> = [];
  const rows = [
    { id: "src", data: { name: "Alice", extensions: {} } },
    {
      id: "tgt",
      data: { name: "Bob", extensions: { talkativeness: 0.5, characterMemories: [{ summary: "old" }] } },
    },
  ];
  const chars = {
    async getById(id: string) {
      return rows.find((row) => row.id === id) ?? null;
    },
    async list() {
      return rows;
    },
    async update(id: string, data: Record<string, unknown>, avatarPath?: string, options?: unknown) {
      calls.push({ id, data, avatarPath, options });
      return null;
    },
  };
  const chats = {
    async getById() {
      return null;
    },
    async createInfluence() {
      return null;
    },
    async createNote() {
      return null;
    },
  };
  const handled = await handleConversationSideEffectCommand({
    command: { type: "memory", target: "Bob", summary: "Met Alice at the inn." } as never,
    characterId: "src",
    chatId: "chat-1",
    chars,
    chats,
  });
  assert.equal(handled, true);
  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.id, "tgt");
  assert.deepEqual((call.options as { skipVersionSnapshot?: boolean })?.skipVersionSnapshot, true, "skips snapshot");
  const ext = call.data.extensions as Record<string, unknown>;
  assert.deepEqual(Object.keys(ext), ["characterMemories"], "only characterMemories is sent");
  const memories = ext.characterMemories as Array<{ summary: string; from: string }>;
  assert.equal(memories.length, 2);
  assert.equal(memories[1]!.summary, "Met Alice at the inn.");
  assert.equal(memories[1]!.from, "Alice");
}

// 2. Emphasis-wrapped endings.
{
  const a = '"Come in." *She smiles warmly.*';
  assert.equal(trimIncompleteModelEnding(a), a);
  const b = "She waves. **Welcome home.**";
  assert.equal(trimIncompleteModelEnding(b), b);
  assert.equal(trimIncompleteModelEnding("She waves. *She turns to"), "She waves.");
  assert.equal(trimIncompleteModelEnding("*She nods.* Then she"), "*She nods.*");
  assert.equal(trimIncompleteModelEnding("Plain end."), "Plain end.");
}

// 3. Pruner keeps real history turns.
{
  const messages: Array<{ role: string; content: string; contextKind?: string; images?: string[] }> = [
    { role: "system", content: "## Empty Section\n" },
    { role: "system", content: "<lore>\n</lore>" },
    { role: "user", content: "", contextKind: "history", images: ["data:image/png;base64,AAAA"] },
    { role: "assistant", content: "## Chapter Two", contextKind: "history" },
    { role: "user", content: "  ", contextKind: "history" },
    { role: "user", content: "hello  ", contextKind: "history" },
  ];
  pruneEmptyPromptWrappers(messages);
  assert.equal(messages.length, 3, JSON.stringify(messages));
  assert.equal(messages[0]!.images?.length, 1, "image-only history turn kept");
  assert.equal(messages[1]!.content, "## Chapter Two", "single-heading history turn kept");
  assert.equal(messages[2]!.content, "hello", "content still trimmed");

  const scoped = scopeIndividualGroupMessagesForTarget(
    [
      { role: "system", content: "sys" },
      { role: "user", content: "", contextKind: "history", images: ["data:image/png;base64,AAAA"] },
      { role: "user", content: "hi", contextKind: "history" },
    ] as never,
    "char-a",
    [
      { id: "char-a", name: "Ann" },
      { id: "char-b", name: "Ben" },
    ],
  ) as Array<{ images?: string[] }>;
  assert.ok(
    scoped.some((message) => message.images?.length),
    "individual group scoping keeps image-only history",
  );
}

console.log("server-hunt-b34 regression passed");
