import assert from "node:assert/strict";
import type { DB } from "../../../packages/server/src/db/connection.js";
import {
  fillMemoryRecallSlot,
  MEMORY_RECALL_SLOT_TOKEN,
  stripMemoryRecallSlot,
} from "../../../packages/server/src/services/prompt/memory-recall-slot.js";
import { assemblePrompt, type AssemblerInput } from "../../../packages/server/src/services/prompt/index.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";
import "../fixtures/regression-agent-definitions.js";

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
