import assert from "node:assert/strict";
import { persistLorebookKeeperUpdates } from "../../packages/server/src/routes/generate/lorebook-keeper-utils.js";
import { buildLorebookWriteApprovalProposal } from "../../packages/server/src/routes/generate/agent-write-approval.js";

const books = [
  { id: "chosen", name: "Chosen" },
  { id: "other", name: "Other" },
];
const writes: Array<Record<string, unknown>> = [];
const createdBooks: Array<Record<string, unknown>> = [];
const store = {
  async list() {
    return books;
  },
  async create(input: Record<string, unknown>) {
    createdBooks.push(input);
    return { id: "new-book", ...input };
  },
  async listEntries(id: string) {
    return id === "chosen" ? [{ id: "locked", name: "Locked", content: "Preserve", locked: true }] : [];
  },
  async createEntry(input: Record<string, unknown>) {
    writes.push(input);
    return input;
  },
  async updateEntry() {
    assert.fail("A locked entry must not be changed");
  },
};
const updates = [
  { entryName: "Memory", content: "A fact", targetLorebook: "Other" },
  { entryName: "Scene", content: "A scene", targetLorebook: "scene" },
  { entryName: "Locked", content: "Do not overwrite", targetLorebook: "Other" },
];
const options = {
  lorebooksStore: store as unknown as Parameters<typeof persistLorebookKeeperUpdates>[0]["lorebooksStore"],
  chatId: "chat",
  chatName: "Campaign",
  preferredTargetLorebookId: "chosen",
  writableLorebookIds: ["chosen", "other"],
  lorebookNamingScheme: { scene: "[WorldName] Scenes" },
  updates,
};
const proposal = buildLorebookWriteApprovalProposal({
  ...options,
  agentType: "lorebook-keeper",
  agentName: "Lorebook Keeper",
  allowTargetRouting: false,
});
assert.equal(proposal.payload.allowTargetRouting, false, "Approval must carry the explicit-target decision");
assert.equal(await persistLorebookKeeperUpdates({ ...options, allowTargetRouting: false }), "chosen");
assert.deepEqual(
  writes.map((write) => write.lorebookId),
  ["chosen", "chosen"],
);
assert.equal(createdBooks.length, 0, "An explicit target must not create model-proposed lorebooks");

writes.length = 0;
await persistLorebookKeeperUpdates({ ...options, updates: updates.slice(0, 2) });
assert.deepEqual(
  writes.map((write) => write.lorebookId),
  ["other", "new-book"],
);
assert.equal(createdBooks[0]?.name, "Campaign Scenes", "Automatic routing must remain available without a selection");
console.log("Lorebook Keeper explicit target, approval, locks and automatic routing regressions passed.");
