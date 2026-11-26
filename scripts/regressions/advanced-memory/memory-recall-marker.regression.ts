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
  {
    name: "a Memory Recall marker between sections of one group stays inside that group's container",
    async run() {
      const group = (id: string, name: string) => ({
        id,
        presetId: "memory-recall-marker",
        name,
        parentGroupId: null,
        order: 0,
        enabled: "true",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      const groupedSections = (withRules: boolean) => [
        ...(withRules
          ? [promptSection({ id: "rule-a", identifier: "rule-a", name: "A", content: "RULE_A", groupId: "rules" })]
          : []),
        promptSection({
          id: "recall",
          identifier: "recall",
          name: "Memory Recall",
          isMarker: "true",
          markerConfig: JSON.stringify({ type: "memory_recall" }),
          groupId: "rules",
        }),
        ...(withRules
          ? [promptSection({ id: "rule-b", identifier: "rule-b", name: "B", content: "RULE_B", groupId: "rules" })]
          : []),
        promptSection({
          id: "history",
          identifier: "history",
          name: "Chat History",
          isMarker: "true",
          markerConfig: JSON.stringify({ type: "chat_history" }),
        }),
      ];
      const assemble = (withRules: boolean) => {
        const sections = groupedSections(withRules);
        return assemblePrompt({
          db: undefined as unknown as DB,
          preset: {
            id: "memory-recall-marker",
            name: "Memory Recall marker",
            sectionOrder: JSON.stringify(sections.map((section) => section.id)),
            groupOrder: JSON.stringify(["rules"]),
            wrapFormat: "xml",
            parameters: JSON.stringify({}),
            variableGroups: "[]",
            variableValues: "{}",
          },
          sections,
          groups: [group("rules", "House Rules")],
          choiceBlocks: [],
          chatChoices: {},
          chatId: "memory-recall-marker",
          characterIds: [],
          personaName: "Mari",
          personaDescription: "",
          chatMessages: [{ role: "user", content: "LIVE_WORDS" }],
          previewOnly: true,
          deferMemoryRecall: true,
        });
      };

      const grouped = await assemble(true);
      const containers = grouped.messages.filter((message) => message.content.includes("<house_rules>"));
      assert.equal(containers.length, 1, "one container for the whole group");
      const filled = grouped.messages.map((message) => ({ ...message }));
      fillMemoryRecallSlot(filled, "RECALLED");
      const container = filled.find((message) => message.content.includes("<house_rules>"))!.content;
      assert.match(container, /RULE_A[\s\S]*RECALLED[\s\S]*RULE_B[\s\S]*<\/house_rules>/u, "memories sit inside");
      const empty = stripMemoryRecallSlot(grouped.messages);
      const emptyContainer = empty.find((message) => message.content.includes("<house_rules>"))!.content;
      assert.match(emptyContainer, /RULE_A[\s\S]*RULE_B/u, "with nothing recalled the group keeps its other sections");
      assert.doesNotMatch(JSON.stringify(empty), /MARINARA_MEMORY_RECALL/u);

      const alone = await assemble(false);
      const aloneFilled = alone.messages.map((message) => ({ ...message }));
      fillMemoryRecallSlot(aloneFilled, "RECALLED");
      assert.match(order(aloneFilled).join("\n"), /<house_rules>\s*RECALLED\s*<\/house_rules>/u);
      assert.doesNotMatch(JSON.stringify(aloneFilled), /MARINARA_MEMORY_RECALL/u);
      const aloneEmpty = stripMemoryRecallSlot(alone.messages);
      assert.doesNotMatch(
        JSON.stringify(aloneEmpty),
        /house_rules|MARINARA_MEMORY_RECALL/u,
        "an empty group goes whole",
      );
      assert.match(order(aloneEmpty).join("\n"), /LIVE_WORDS/u);
      assert.ok(
        aloneEmpty.every((message) => message.content.trim().length > 0),
        "no empty message is left",
      );
    },
  },
];

await runNamedCases(cases);
