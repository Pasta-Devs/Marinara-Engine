import assert from "node:assert/strict";
import type { DB } from "../../../packages/server/src/db/connection.js";
import {
  insertPerTurnBlock,
  normalizeLoreHistoryDepth,
  placeLorebookContent,
  type PromptMessage,
} from "../../../packages/server/src/services/lorebook/prompt-injector.js";
import {
  fillMemoryRecallSlot,
  MEMORY_RECALL_SLOT_TOKEN,
  stripMemoryRecallSlot,
} from "../../../packages/server/src/services/prompt/memory-recall-slot.js";
import { assemblePrompt, type AssemblerInput } from "../../../packages/server/src/services/prompt/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

const chat = (): PromptMessage[] => [
  { role: "system", content: "RULES" },
  { role: "user", content: "U1", contextKind: "history" },
  { role: "assistant", content: "A1", contextKind: "history" },
  { role: "user", content: "U2", contextKind: "history" },
  { role: "assistant", content: "A2", contextKind: "history" },
  { role: "user", content: "U3", contextKind: "history" },
];
const order = (messages: Array<{ content: string }>) => messages.map((message) => message.content);

async function assembleWithMemoryMarker(
  marker: Partial<AssemblerInput["sections"][number]>,
  extra: Partial<AssemblerInput> = {},
) {
  const sections = [
    promptSection({ id: "main", identifier: "main", name: "Instructions", content: "STABLE_RULE" }),
    promptSection({
      id: "recall",
      identifier: "recall",
      name: "Memory Recall",
      isMarker: "true",
      markerConfig: JSON.stringify({ type: "memory_recall" }),
      ...marker,
    }),
    promptSection({
      id: "history",
      identifier: "history",
      name: "Chat History",
      isMarker: "true",
      markerConfig: JSON.stringify({ type: "chat_history" }),
    }),
  ];
  return assemblePrompt({
    db: undefined as unknown as DB,
    preset: {
      id: "memory-recall-marker",
      name: "Memory Recall marker",
      sectionOrder: JSON.stringify(sections.map((section) => section.id)),
      groupOrder: "[]",
      wrapFormat: "xml",
      parameters: JSON.stringify({}),
      variableGroups: "[]",
      variableValues: "{}",
    },
    sections,
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "memory-recall-marker",
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages: [
      { role: "user", content: "OLD_TURN" },
      { role: "assistant", content: "OLD_REPLY" },
      { role: "user", content: "LIVE_WORDS" },
    ],
    previewOnly: true,
    ...extra,
  });
}

const cases: RegressionCase[] = [
  {
    name: "lore goes before the history by default and inside it at the chat's depth",
    run() {
      const before = chat();
      insertPerTurnBlock(before, { role: "system", content: "LORE" }, null);
      assert.deepEqual(order(before), ["RULES", "LORE", "U1", "A1", "U2", "A2", "U3"]);

      const depthTwo = chat();
      insertPerTurnBlock(depthTwo, { role: "system", content: "LORE" }, 2);
      assert.deepEqual(order(depthTwo), ["RULES", "U1", "A1", "U2", "LORE", "A2", "U3"]);
      assert.equal(depthTwo[4]!.contextKind, "injection", "context fitting must not trim it as history");

      const depthZero = chat();
      insertPerTurnBlock(depthZero, { role: "system", content: "LORE" }, 0);
      assert.deepEqual(order(depthZero), ["RULES", "U1", "A1", "U2", "A2", "U3", "LORE"]);

      const tooDeep = chat();
      insertPerTurnBlock(tooDeep, { role: "system", content: "LORE" }, 40);
      assert.deepEqual(order(tooDeep), ["RULES", "LORE", "U1", "A1", "U2", "A2", "U3"]);

      const unmarked = chat().map(({ contextKind: _kind, ...message }) => message);
      insertPerTurnBlock(unmarked, { role: "system", content: "LORE" }, 2);
      assert.deepEqual(order(unmarked), ["RULES", "U1", "A1", "U2", "LORE", "A2", "U3"]);
    },
  },
  {
    name: "the lore block at a depth leaves the prompt before it unchanged on the next turn",
    run() {
      const turn = (messages: PromptMessage[], lore: string) => {
        const prompt = messages.map((message) => ({ ...message }));
        insertPerTurnBlock(prompt, { role: "system", content: lore }, 2);
        return order(prompt);
      };
      const first = turn(chat(), "LORE_TURN_1");
      const next = turn(
        [
          ...chat(),
          { role: "assistant", content: "A3", contextKind: "history" },
          { role: "user", content: "U4", contextKind: "history" },
        ],
        "LORE_TURN_2",
      );
      const shared = first.findIndex((content, index) => next[index] !== content);
      assert.equal(first[shared], "LORE_TURN_1", "the prompts first differ at the old lore block, after U2");
      assert.deepEqual(first.slice(0, shared), ["RULES", "U1", "A1", "U2"]);
    },
  },
  {
    name: "@ Depth entries still count chat messages when the lore block sits inside the history",
    run() {
      const placed = placeLorebookContent(chat(), "LORE", [{ content: "DEPTH_ONE", role: "system", depth: 1 }], 2);
      assert.deepEqual(order(placed), ["RULES", "U1", "A1", "U2", "LORE", "A2", "DEPTH_ONE", "U3"]);
      const defaultPlace = placeLorebookContent(
        chat(),
        "LORE",
        [{ content: "DEPTH_ONE", role: "system", depth: 1 }],
        null,
      );
      assert.deepEqual(order(defaultPlace), ["RULES", "LORE", "U1", "A1", "U2", "A2", "DEPTH_ONE", "U3"]);
      const macroPlaced = placeLorebookContent(chat(), null, [], 2);
      assert.deepEqual(order(macroPlaced), order(chat()), "a {{lorebook}} macro already placed the block");
    },
  },
  {
    name: "the depth setting reads only whole numbers from 0 to 100",
    run() {
      assert.equal(normalizeLoreHistoryDepth(undefined), null);
      assert.equal(normalizeLoreHistoryDepth(null), null);
      assert.equal(normalizeLoreHistoryDepth("2"), null);
      assert.equal(normalizeLoreHistoryDepth(2.7), 2);
      assert.equal(normalizeLoreHistoryDepth(-3), 0);
      assert.equal(normalizeLoreHistoryDepth(500), 100);
    },
  },
  {
    name: "the Memory Recall marker holds the memories where the preset puts it",
    async run() {
      const deferred = await assembleWithMemoryMarker({}, { deferMemoryRecall: true });
      const slotIndex = deferred.messages.findIndex((message) => message.content.includes(MEMORY_RECALL_SLOT_TOKEN));
      assert.ok(slotIndex >= 0, "generation gets the slot");
      assert.ok(slotIndex < deferred.messages.findIndex((message) => message.content.includes("LIVE_WORDS")));
      const filled = deferred.messages.map((message) => ({ ...message }));
      assert.equal(fillMemoryRecallSlot(filled, "<memories>RECALLED</memories>"), true);
      const text = order(filled).join("\n");
      assert.ok(text.indexOf("STABLE_RULE") < text.indexOf("RECALLED"));
      assert.ok(text.indexOf("RECALLED") < text.indexOf("OLD_TURN"));
      assert.doesNotMatch(text, /MARINARA_MEMORY_RECALL/u);

      const atDepth = await assembleWithMemoryMarker(
        { injectionPosition: "depth", injectionDepth: 1 },
        { deferMemoryRecall: true },
      );
      const atDepthOrder = order(atDepth.messages);
      const slot = atDepthOrder.findIndex((content) => content.includes(MEMORY_RECALL_SLOT_TOKEN));
      assert.ok(slot > atDepthOrder.findIndex((content) => content.includes("OLD_REPLY")));
      assert.ok(slot < atDepthOrder.findIndex((content) => content.includes("LIVE_WORDS")));

      assert.equal(fillMemoryRecallSlot([{ content: "no marker" }], "X"), false);
    },
  },
  {
    name: "an unfilled Memory Recall marker never reaches a prompt",
    async run() {
      const preview = await assembleWithMemoryMarker({});
      assert.doesNotMatch(JSON.stringify(preview.messages), /MARINARA_MEMORY_RECALL/u);
      const deferred = await assembleWithMemoryMarker({}, { deferMemoryRecall: true });
      const stripped = stripMemoryRecallSlot(deferred.messages);
      assert.doesNotMatch(JSON.stringify(stripped), /MARINARA_MEMORY_RECALL/u);
      assert.ok(stripped.every((message) => message.content.trim().length > 0));
      assert.match(order(stripped).join("\n"), /STABLE_RULE[\s\S]*LIVE_WORDS/u);
    },
  },
];

await runNamedCases(cases);
