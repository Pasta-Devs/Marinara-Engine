import assert from "node:assert/strict";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";
import type { LorebookEntry } from "../../packages/shared/src/types/lorebook.js";
import { scanForActivatedEntries } from "../../packages/server/src/services/lorebook/keyword-scanner.js";
import {
  isFeatureEnabled,
  resetFeatureSettingsForTests,
} from "../../packages/server/src/services/features/feature-settings.js";

// An inclusion group activates one of its matching entries per generation. By default the winner is re-rolled on
// every turn. With a group seed (the chat id, opt-in via the stableLorebookGroupPicks switch), the same candidates must give
// the same winner on every turn, so the prompt prefix stays cacheable, while other chats and other candidate sets can
// still pick differently.
const ids = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];
const entries = ids.map(
  (id) =>
    ({
      ...createLorebookEntrySchema.parse({ lorebookId: "book", name: `Notes - ${id}`, keys: [id], group: "notes" }),
      id,
      embedding: null,
    }) as LorebookEntry,
);
const scene = [{ role: "user" as const, content: ids.join(" ") }];
const winner = (options: Parameters<typeof scanForActivatedEntries>[2]) =>
  scanForActivatedEntries(scene, entries, options)
    .filter((row) => row.entry.group === "notes")
    .map((row) => row.entry.id);

const first = winner({ groupSeed: "chat-a" });
assert.equal(first.length, 1, "a group still activates exactly one entry");
for (let turn = 0; turn < 20; turn += 1) {
  assert.deepEqual(
    winner({ groupSeed: "chat-a" }),
    first,
    `turn ${turn}: same chat and candidates keep the same winner`,
  );
}

// The activation order of the candidates does not change a seeded pick.
const reversed = scanForActivatedEntries(scene, [...entries].reverse(), { groupSeed: "chat-a" })
  .filter((row) => row.entry.group === "notes")
  .map((row) => row.entry.id);
assert.deepEqual(reversed, first, "candidates that activate in another order keep the same seeded winner");

const acrossChats = new Set(Array.from({ length: 30 }, (_, index) => winner({ groupSeed: `chat-${index}` })[0]));
assert.ok(acrossChats.size > 1, "different chats still get different winners");

const smaller = scanForActivatedEntries([{ role: "user", content: "delta echo" }], entries, { groupSeed: "chat-a" })
  .filter((row) => row.entry.group === "notes")
  .map((row) => row.entry.id);
assert.equal(smaller.length, 1);
assert.ok(["delta", "echo"].includes(smaller[0]!), "the winner comes from the activated candidates only");

// A seed also wins over an injected random source (the Active Context preview passes one), so the preview shows
// the same group winner as generation. The random source still drives everything else.
assert.deepEqual(winner({ groupSeed: "chat-a", random: () => 0 }), first);
assert.deepEqual(winner({ groupSeed: "chat-a", random: () => 0.999 }), first);

// Without a seed the scan keeps the existing per-generation random pick.
assert.deepEqual(winner({ random: () => 0 }), ["alpha"]);

// The seed is opt-in: off unless the stableLorebookGroupPicks switch is on (Settings > Advanced > Features) or
// LOREBOOK_STABLE_GROUP_WINNERS pins it.
const previous = process.env.LOREBOOK_STABLE_GROUP_WINNERS;
delete process.env.LOREBOOK_STABLE_GROUP_WINNERS;
resetFeatureSettingsForTests();
assert.equal(isFeatureEnabled("stableLorebookGroupPicks"), false);
resetFeatureSettingsForTests({ stableLorebookGroupPicks: true });
assert.equal(isFeatureEnabled("stableLorebookGroupPicks"), true);
resetFeatureSettingsForTests();
process.env.LOREBOOK_STABLE_GROUP_WINNERS = "true";
assert.equal(isFeatureEnabled("stableLorebookGroupPicks"), true);
if (previous === undefined) delete process.env.LOREBOOK_STABLE_GROUP_WINNERS;
else process.env.LOREBOOK_STABLE_GROUP_WINNERS = previous;

console.log("lorebook-group-seed regression passed");
