// "Leave stored messages out of Chat History" (Lorebook Keeper, Long-term memory): messages a memory has stored
// leave the prompt except the newest few; with "Drop in steps of" they leave a whole step at a time.
import assert from "node:assert/strict";
import {
  resolveRetireStoredTail,
  resolveStoredThroughIds,
  retireStoredHistory,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `m${index + 1}`, extra: {} as Record<string, unknown> }));
const first = (messages: Array<{ id: string }>) => messages[0]!.id;

const cases: RegressionCase[] = [
  {
    name: "stored messages leave except the newest tail, and nothing unstored leaves",
    run() {
      const all = rows(30);
      assert.equal(first(retireStoredHistory(all, all, ["m25"], { tail: 10, step: 1 })), "m21", "tail binds");
      assert.equal(first(retireStoredHistory(all, all, ["m12"], { tail: 10, step: 1 })), "m13", "stored binds");
      assert.equal(first(retireStoredHistory(all, all, [], { tail: 10, step: 1 })), "m1", "nothing stored");
      assert.equal(first(retireStoredHistory(all, all, ["gone"], { tail: 10, step: 1 })), "m1", "unknown id");
      assert.equal(
        first(retireStoredHistory(all, all, ["m5", "m12"], { tail: 10, step: 1 })),
        "m13",
        "the memory that stored more decides",
      );
      const shown = all.map((row) => (row.id === "m3" ? { ...row, extra: { visibilityManual: true } } : row));
      assert.equal(first(retireStoredHistory(shown, shown, ["m12"], { tail: 10, step: 1 })), "m3", "shown by hand");
    },
  },
  {
    name: "with steps the retired part grows a whole step at a time",
    run() {
      const starts = [24, 29, 33, 34].map((count) => {
        const all = rows(count);
        // The memory stores up to two messages behind the newest, as a read-behind keeper does.
        return first(retireStoredHistory(all, all, [`m${count - 2}`], { tail: 4, step: 10 }));
      });
      assert.deepEqual(starts, ["m21", "m21", "m21", "m31"], "held for several turns, then one jump of 10");
    },
  },
  {
    name: "only memories turned on for the chat and set to retire are asked",
    async run() {
      const asked: string[] = [];
      const ids = (chatMeta: Record<string, unknown>) =>
        resolveStoredThroughIds({
          chatId: "c",
          chatMeta,
          agentsStore: {
            async getLastSuccessfulRunByType(type) {
              asked.push(type);
              return { messageId: "m7" };
            },
          },
          longTermMemoryStoredThrough: async () => {
            asked.push("ltm");
            return "m9";
          },
        });
      const active = { enableAgents: true, activeAgentIds: ["lorebook-keeper", "long-term-memory"] };
      assert.deepEqual(await ids(active), [], "switches off");
      assert.deepEqual(await ids({ ...active, lorebookKeeperRetireStored: true, longTermMemoryRetireStored: true }), [
        "m7",
        "m9",
      ]);
      assert.deepEqual(await ids({ lorebookKeeperRetireStored: true, enableAgents: false }), [], "agents off");
      assert.equal(resolveRetireStoredTail(undefined), 10);
      assert.equal(resolveRetireStoredTail(0), 0);
    },
  },
];

await runNamedCases(cases);
