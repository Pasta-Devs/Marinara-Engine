import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatBranchGraphEntry } from "@marinara-engine/shared";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-branch-graph-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: {
  ready(): Promise<unknown>;
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<any>;
} | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { getDB } = await import("../../packages/server/src/db/connection.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { toBranchGraphSnippet } = await import("../../packages/server/src/services/chat-branch-graph.js");

  app = await buildApp();
  await app.ready();
  const chatStorage = createChatsStorage(await getDB());

  const create = async (name: string) => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/chats",
      payload: { name, mode: "roleplay", characterIds: [] },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const addMessage = async (chatId: string, content: string, role: "user" | "assistant" = "user") => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      payload: { role, content },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const branchOf = async (chatId: string, upToMessageId?: string) => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/chats/${chatId}/branch`,
      payload: upToMessageId ? { upToMessageId } : {},
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const graph = async (groupId: string) => {
    const response = await app!.inject({ method: "GET", url: `/api/chats/group/${groupId}/branch-graph` });
    assert.equal(response.statusCode, 200);
    return new Map((response.json() as ChatBranchGraphEntry[]).map((entry) => [entry.chatId, entry]));
  };

  // root: u a u ; branch forks at the assistant reply and adds one of its own; child forks at its tip.
  const root = await create("Graph root");
  await addMessage(root.id, "Hello there");
  const middle = await addMessage(root.id, "  The   fork\nhappens here  ", "assistant");
  await addMessage(root.id, "after fork");
  const branch = await branchOf(root.id, middle.id);
  await addMessage(branch.id, "branch reply", "assistant");
  const child = await branchOf(branch.id);
  await addMessage(child.id, "x".repeat(200));
  const groupId: string = branch.groupId;
  assert.equal(typeof groupId, "string");

  let entries = await graph(groupId);
  assert.equal(entries.size, 3);

  const rootEntry = entries.get(root.id)!;
  assert.equal(rootEntry.forkIndex, null, "a root has no fork");
  assert.equal(rootEntry.parentForkIndex, null);
  assert.equal(rootEntry.messageCount, 3);
  assert.equal(rootEntry.roles, "uau", "a root's roles cover every message");
  assert.equal(rootEntry.fork, null);
  assert.deepEqual(
    { index: rootEntry.tip?.index, role: rootEntry.tip?.role, snippet: rootEntry.tip?.snippet },
    { index: 2, role: "user", snippet: "after fork" },
  );

  const branchEntry = entries.get(branch.id)!;
  assert.equal(branchEntry.forkIndex, 1, "the fork is the copied assistant reply");
  assert.equal(branchEntry.parentForkIndex, 1);
  assert.equal(branchEntry.messageCount, 3);
  assert.equal(branchEntry.roles, "a", "only messages after the fork belong to the branch's lane");
  assert.equal(branchEntry.roles.length, branchEntry.messageCount - (branchEntry.forkIndex! + 1));
  assert.equal(branchEntry.fork?.snippet, "The fork happens here", "snippets are one trimmed line");
  assert.equal(branchEntry.fork?.messageId, branch.metadata.branchMessageId);
  assert.equal(branchEntry.tip?.snippet, "branch reply");

  // Nested: a branch of a branch, forked at its parent's latest message.
  const childEntry = entries.get(child.id)!;
  assert.equal(childEntry.forkIndex, 2);
  assert.equal(childEntry.parentForkIndex, 2);
  assert.equal(childEntry.roles, "u");
  assert.equal(childEntry.tip?.snippet.length, 80, "long text is cut");
  assert.ok(childEntry.tip?.snippet.endsWith("…"));
  assert.equal(toBranchGraphSnippet(""), "");

  // An older or imported branch has no lineage: its fork is unknown and its whole transcript is its own.
  const legacy = await branchOf(root.id, middle.id);
  const legacyMetadata = { ...legacy.metadata };
  delete legacyMetadata.branchParentChatId;
  delete legacyMetadata.branchParentMessageId;
  delete legacyMetadata.branchMessageId;
  await chatStorage.updateMetadata(legacy.id, legacyMetadata);
  entries = await graph(groupId);
  const legacyEntry = entries.get(legacy.id)!;
  assert.equal(legacyEntry.forkIndex, null);
  assert.equal(legacyEntry.parentForkIndex, null);
  assert.equal(legacyEntry.roles, "ua");
  assert.equal(legacyEntry.fork, null);

  // Deleting the parent keeps the branch's own fork position, from its copy of the fork message.
  const deleted = await app.inject({ method: "DELETE", url: `/api/chats/${root.id}?force=true` });
  assert.ok(deleted.statusCode === 200 || deleted.statusCode === 204, `delete returned ${deleted.statusCode}`);
  entries = await graph(groupId);
  assert.equal(entries.has(root.id), false);
  assert.equal(entries.get(branch.id)!.forkIndex, 1, "the fork still resolves without its parent");
  assert.equal(entries.get(branch.id)!.parentForkIndex, null, "the parent's index is gone with it");
  assert.equal(entries.get(branch.id)!.fork?.snippet, "The fork happens here");

  // A branch of an empty chat forked before message 0.
  const empty = await create("Empty root");
  const emptyBranch = await branchOf(empty.id);
  await addMessage(emptyBranch.id, "first words");
  entries = await graph(emptyBranch.groupId);
  const emptyEntry = entries.get(emptyBranch.id)!;
  assert.equal(emptyEntry.forkIndex, -1);
  assert.equal(emptyEntry.parentForkIndex, -1);
  assert.equal(emptyEntry.roles, "u");
  assert.equal(emptyEntry.fork, null);
  assert.deepEqual(entries.get(empty.id)?.tip, null, "an empty chat has no tip");

  // An unknown group is just empty.
  assert.equal((await graph("no-such-group")).size, 0);
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Chat branch graph regression passed");
