import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-chat-branch-lineage-"));
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";

let app: { close(): Promise<void>; inject(options: Record<string, unknown>): Promise<any> } | null = null;

try {
  const { buildApp } = await import("../../packages/server/src/app.js");
  const { createCapabilityPersistenceHost } = await import(
    "../../packages/server/src/services/capability-packages/capability-persistence.service.js"
  );
  const { getDB } = await import("../../packages/server/src/db/connection.js");

  app = await buildApp();
  await app.ready();

  const create = async (name: string) => {
    const response = await app!.inject({
      method: "POST",
      url: "/api/chats",
      payload: { name, mode: "roleplay", characterIds: [] },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };
  const addMessage = async (chatId: string, content: string) => {
    const response = await app!.inject({
      method: "POST",
      url: `/api/chats/${chatId}/messages`,
      payload: { role: "user", content },
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  };

  const root = await create("Branch root");
  const first = await addMessage(root.id, "before fork");
  const middle = await addMessage(root.id, "fork here");
  await addMessage(root.id, "after fork");

  const branchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${root.id}/branch`,
    payload: { upToMessageId: middle.id },
  });
  assert.equal(branchResponse.statusCode, 200);
  const branch = branchResponse.json();
  assert.equal(branch.metadata.branchName, "New Branch");
  assert.equal(branch.metadata.branchParentChatId, root.id);
  assert.equal(branch.metadata.branchParentMessageId, middle.id);
  assert.equal(typeof branch.groupId, "string");

  const branchMessagesResponse = await app.inject({ method: "GET", url: `/api/chats/${branch.id}/messages` });
  assert.equal(branchMessagesResponse.statusCode, 200);
  const branchMessages = branchMessagesResponse.json();
  assert.deepEqual(
    branchMessages.map((message: { content: string }) => message.content),
    ["before fork", "fork here"],
  );
  assert.equal(typeof branch.metadata.branchMessageId, "string");
  assert.equal(branchMessages.at(-1).id, branch.metadata.branchMessageId);

  const childResponse = await app.inject({ method: "POST", url: `/api/chats/${branch.id}/branch`, payload: {} });
  assert.equal(childResponse.statusCode, 200);
  const child = childResponse.json();
  assert.equal(child.metadata.branchParentChatId, branch.id);
  assert.equal(child.metadata.branchParentMessageId, branchMessages.at(-1).id);

  const empty = await create("Empty root");
  const emptyBranchResponse = await app.inject({
    method: "POST",
    url: `/api/chats/${empty.id}/branch`,
    payload: {},
  });
  assert.equal(emptyBranchResponse.statusCode, 200);
  const emptyBranch = emptyBranchResponse.json();
  assert.equal(emptyBranch.metadata.branchParentChatId, empty.id);
  assert.equal(emptyBranch.metadata.branchParentMessageId, null);
  assert.equal(emptyBranch.metadata.branchMessageId, null);

  const persistence = createCapabilityPersistenceHost(await getDB());
  const listed = await persistence.listChats();
  assert.equal((await persistence.getChat(root.id))?.branch, null);
  const listedBranch = listed.find((chat) => chat.id === branch.id);
  assert.deepEqual(listedBranch?.branch, {
    title: "New Branch",
    parentChatId: root.id,
    parentMessageId: middle.id,
    childMessageId: branch.metadata.branchMessageId,
  });
  assert.deepEqual((await persistence.getChat(branch.id))?.branch, listedBranch?.branch);

  const exportResponse = await app.inject({
    method: "GET",
    url: `/api/chats/${branch.id}/export?format=jsonl`,
  });
  assert.equal(exportResponse.statusCode, 200);
  const exportedMetadata = JSON.parse(exportResponse.body.split("\n")[0]).chat_metadata;
  assert.equal(exportedMetadata.branchName, "New Branch");
  for (const key of ["branchParentChatId", "branchParentMessageId", "branchMessageId"]) {
    assert.equal(key in exportedMetadata, false);
    assert.equal(key in exportedMetadata.marinara_metadata, false);
  }

  const malformed = await create("Malformed metadata");
  const malformedMetadataResponse = await app.inject({
    method: "PATCH",
    url: `/api/chats/${malformed.id}/metadata`,
    payload: {
      branchName: "  Imported sibling  ",
      branchParentChatId: "foreign-chat",
      branchParentMessageId: "only-one-anchor",
      branchMessageId: 12,
    },
  });
  assert.equal(malformedMetadataResponse.statusCode, 200);
  assert.deepEqual((await persistence.getChat(malformed.id))?.branch, {
    title: "Imported sibling",
    parentChatId: null,
    parentMessageId: null,
    childMessageId: null,
  });

  const deleted = await app.inject({ method: "DELETE", url: `/api/chats/${root.id}` });
  assert.equal(deleted.statusCode, 204);
  const survivingChild = await app.inject({ method: "GET", url: `/api/chats/${branch.id}` });
  assert.equal(survivingChild.statusCode, 200);
  assert.equal(survivingChild.json().metadata.branchParentChatId, root.id);
} finally {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
}

console.info("Chat branch lineage regression passed");
