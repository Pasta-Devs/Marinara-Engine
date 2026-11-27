// "Run with summaries" (chat settings lorebookKeeperRunWithSummaries / cardEvolutionRunWithSummaries): Lorebook
// Keeper and Card Evolution Auditor run on the reply the automatic summary follows, and card edits approved later
// wait in the chat (heldCardUpdates) for the next summary turn, so the prompt changes once per summary.
import assert from "node:assert/strict";
import {
  applyCharacterCardFieldUpdates,
  isCharacterCardUpdateStale,
  readHeldCardUpdates,
  type CharacterCardFieldUpdate,
  type HeldCardUpdate,
} from "../../../packages/shared/src/index.js";
import {
  agentRunsWithSummaries,
  applyHeldCardUpdates,
  automaticSummaryDueAfterReply,
  summaryTurnIsNext,
} from "../../../packages/server/src/services/chat-summary/summary-paced-agents.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const turns = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `m${index}`, role: index % 2 === 0 ? "user" : "assistant" }));

const edit = (
  field: CharacterCardFieldUpdate["field"],
  oldText: string,
  newText: string,
): CharacterCardFieldUpdate => ({
  characterId: "c1",
  action: "update",
  field,
  oldText,
  newText,
  reason: "",
});

const cases: RegressionCase[] = [
  {
    name: "the agents follow summaries only with the switch on and automatic summaries running",
    run() {
      const on = { automaticSummaryEnabled: true, lorebookKeeperRunWithSummaries: true };
      assert.equal(agentRunsWithSummaries("lorebook-keeper", on, "roleplay"), true);
      assert.equal(agentRunsWithSummaries("card-evolution-auditor", on, "roleplay"), false);
      assert.equal(
        agentRunsWithSummaries("lorebook-keeper", { ...on, automaticSummaryEnabled: false }, "roleplay"),
        false,
      );
      assert.equal(agentRunsWithSummaries("lorebook-keeper", on, "conversation"), false);
      assert.equal(
        agentRunsWithSummaries("lorebook-keeper", { ...on, advancedMemory: { enabled: true } }, "roleplay"),
        false,
        "Advanced Memory replaces the automatic summary",
      );
    },
  },
  {
    name: "the summary is due after the reply that reaches the interval, counting the new reply",
    run() {
      const meta = { summaryRunInterval: 6, lastAutomaticSummaryMessageId: "m1" };
      // m2..m6 after the anchor = 5, plus the new reply = 6.
      assert.equal(automaticSummaryDueAfterReply(meta, turns(7), true), true);
      assert.equal(automaticSummaryDueAfterReply(meta, turns(6), true), false);
      // A regenerated reply is already in the list.
      assert.equal(automaticSummaryDueAfterReply(meta, turns(8), false), true);
      assert.equal(automaticSummaryDueAfterReply(meta, turns(7), false), false);
    },
  },
  {
    name: "the summary turn is the reply right after the one the summary was made after",
    run() {
      const meta = { lastAutomaticSummaryMessageId: "m3" };
      assert.equal(summaryTurnIsNext(meta, turns(4)), true, "approving before sending");
      assert.equal(summaryTurnIsNext(meta, turns(5)), false, "a message sent since: hold");
      assert.equal(summaryTurnIsNext(meta, turns(5), true), true, "the generation for that message");
      assert.equal(summaryTurnIsNext(meta, turns(6), true), false, "a later turn");
      assert.equal(summaryTurnIsNext({}, turns(4)), false, "no summary yet");
    },
  },
  {
    name: "card edits replace text in place, fill empty fields, and append only when stale ones are overridden",
    run() {
      const data = { description: "Tall. Quiet.", extensions: { aboutMe: "" }, character_version: "1.4" };
      const replaced = applyCharacterCardFieldUpdates(data, [edit("description", "Quiet.", "Loud $&.")]);
      assert.equal(replaced.description, "Tall. Loud $&.");
      assert.equal(replaced.character_version, "1.5");
      const filled = applyCharacterCardFieldUpdates(data, [edit("aboutMe", "", "Likes tea.")]);
      assert.equal((filled.extensions as Record<string, unknown>).aboutMe, "Likes tea.");
      const stale = edit("description", "Gone.", "New line.");
      assert.equal(isCharacterCardUpdateStale(data, stale), true);
      assert.equal(applyCharacterCardFieldUpdates(data, [stale]).description, "Tall. Quiet.");
      assert.equal(applyCharacterCardFieldUpdates(data, [stale], true).description, "Tall. Quiet.\n\nNew line.");
    },
  },
  {
    name: "held card edits are taken out of the chat and applied, oldest first",
    async run() {
      const held = (id: string, oldText: string, newText: string): HeldCardUpdate => ({
        id,
        characterId: "c1",
        characterName: "Ada",
        agentName: "Card Evolution Auditor",
        updates: [edit("description", oldText, newText)],
        overrideStale: false,
        approvedAt: "2026-11-27T00:00:00.000Z",
      });
      let metadata: Record<string, unknown> = {
        heldCardUpdates: [held("a", "Quiet.", "Shy."), held("b", "Shy.", "Bold.")],
      };
      let card: Record<string, unknown> = { description: "Tall. Quiet." };
      const reasons: string[] = [];
      const chats = {
        async patchMetadata(_id: string, updater: (current: Record<string, unknown>) => Record<string, unknown>) {
          metadata = { ...metadata, ...updater(metadata) };
        },
      };
      const characters = {
        async getById() {
          return { data: JSON.stringify(card) };
        },
        async update(_id: string, data: never, _avatar?: string, options?: { versionReason?: string }) {
          card = data as Record<string, unknown>;
          reasons.push(options?.versionReason ?? "");
        },
      };
      const applied = await applyHeldCardUpdates(chats, characters, "chat");
      assert.deepEqual(
        applied.map((item) => item.id),
        ["a", "b"],
      );
      assert.equal(card.description, "Tall. Bold.");
      assert.deepEqual(readHeldCardUpdates(metadata), []);
      assert.deepEqual(reasons, ["Card Evolution Auditor card update", "Card Evolution Auditor card update"]);
    },
  },
];

await runNamedCases(cases);
