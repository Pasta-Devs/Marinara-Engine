import assert from "node:assert/strict";
import { persistLorebookKeeperUpdates } from "../../packages/server/src/routes/generate/lorebook-keeper-utils.js";
import {
  formatLorebookWriteApprovalText,
  parseLorebookWriteApprovalText,
} from "../../packages/server/src/routes/generate/agent-write-approval.js";

const writes: Array<Record<string, unknown>> = [];
const content = "Keep user-authored &apos; and <markup> verbatim.";
const store = {
  async listEntries() {
    return [
      { id: "existing", name: "Mari's beach", content: "", locked: false },
      { id: "locked", name: "Dottore & Mari", content: "Private", locked: true },
    ];
  },
  async createEntry(input: Record<string, unknown>) {
    writes.push(input);
    return { id: "new", ...input };
  },
  async updateEntry(id: string, input: Record<string, unknown>) {
    writes.push({ id, ...input });
    return { id, ...input };
  },
};
const updates = [
  { name: "Mari&apos;s beach", content },
  { entry: { name: "The &#34;Doctor&#34; &amp; Co.", content } },
  { entryName: "Dottore &amp; Mari", content: "Must not overwrite a locked entry" },
];
await persistLorebookKeeperUpdates({
  lorebooksStore: store as unknown as Parameters<typeof persistLorebookKeeperUpdates>[0]["lorebooksStore"],
  chatId: "chat",
  chatName: "Chat",
  preferredTargetLorebookId: "lorebook",
  writableLorebookIds: ["lorebook"],
  updates,
});
assert.equal(writes.length, 2, "Entity-escaped names must still respect locks");
assert.equal(writes[0]?.id, "existing", "Do not create an escaped duplicate of an existing name");
assert.equal(writes[1]?.name, 'The "Doctor" & Co.');
assert.ok(
  writes.every((write) => write.content === content),
  "Lore content must remain verbatim",
);
const approval = formatLorebookWriteApprovalText(updates);
assert.ok(approval.includes("### Mari's beach"));
assert.ok(approval.includes('### The "Doctor" & Co.'));
assert.ok(approval.includes(content));
await persistLorebookKeeperUpdates({
  lorebooksStore: store as unknown as Parameters<typeof persistLorebookKeeperUpdates>[0]["lorebooksStore"],
  chatId: "chat",
  chatName: "Chat",
  preferredTargetLorebookId: "lorebook",
  writableLorebookIds: ["lorebook"],
  updates: parseLorebookWriteApprovalText(formatLorebookWriteApprovalText([{ name: "Literal &amp;apos;", content }])),
  namesAreVerbatim: true,
});
assert.equal(writes.at(-1)?.name, "Literal &apos;", "Approved names must not be decoded a second time");
console.log("Lorebook entity names, approval, locks and verbatim content passed.");
