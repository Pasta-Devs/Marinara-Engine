// "Drop in steps of" (chat setting historyDropStep): every place that cuts old messages lets them go a whole
// step at a time, so the history starts at the same message for several turns and a prompt cache keeps hitting.
import assert from "node:assert/strict";
import type { ChatMessage, ChatMLMessage } from "../../../packages/shared/src/index.js";
import {
  applyContextMessageLimitWithPins,
  normalizeHistoryDropStep,
  steppedDropCount,
} from "../../../packages/shared/src/utils/message-marks.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import { assemblePrompt } from "../../../packages/server/src/services/prompt/index.js";
import { fitMessagesToContext } from "../../../packages/server/src/services/llm/base-provider.js";
import { capSummarizedHistory } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index + 1}`,
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `MSG_${index + 1}`,
    extra: {} as Record<string, unknown>,
  }));

async function assembleWithMax(count: number, maxMessages: number, historyDropStep?: number) {
  const result = await assemblePrompt({
    db: undefined as unknown as DB,
    preset: {
      id: "preset-drop-step",
      name: "Drop Step Fixture",
      sectionOrder: JSON.stringify(["main", "chat"]),
      groupOrder: JSON.stringify([]),
      wrapFormat: "xml",
      parameters: JSON.stringify({}),
      variableGroups: JSON.stringify([]),
      variableValues: JSON.stringify({}),
    },
    sections: [
      promptSection({ id: "main", identifier: "main", name: "Main Prompt", content: "WORLD", role: "system" }),
      promptSection({
        id: "chat",
        identifier: "chat",
        name: "Chat History",
        isMarker: "true",
        markerConfig: JSON.stringify({ type: "chat_history", chatHistoryOptions: { maxMessages } }),
      }),
    ],
    groups: [],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "chat-drop-step",
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages: rows(count) as ChatMLMessage[],
    historyDropStep,
    chatSummary: null,
    deferMessagePostProcessing: true,
  });
  return result.messages;
}

/** A system prompt and `count` history messages of ~100 tokens each, wrapped like the assembler does. */
function longPrompt(count: number): ChatMessage[] {
  const body = (n: number) => `MSG_${n} ${"word ".repeat(80)}`.trim();
  const history: ChatMessage[] = Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: body(index + 1),
    contextKind: "history",
  }));
  history[0] = { ...history[0]!, content: `<chat_history>\n${history[0]!.content}` };
  history[count - 2] = { ...history[count - 2]!, content: `${history[count - 2]!.content}\n</chat_history>` };
  history[count - 1] = {
    ...history[count - 1]!,
    content: `<last_message>\n${history[count - 1]!.content}\n</last_message>`,
  };
  return [{ role: "system", content: "SYSTEM_RULES" }, ...history];
}

const firstHistoryNumber = (messages: ChatMessage[]) =>
  Number(/MSG_(\d+)/u.exec(messages.find((message) => message.contextKind === "history")!.content)![1]);

const cases: RegressionCase[] = [
  {
    name: "the stepped cut stays put between steps and then jumps a whole step",
    run() {
      assert.equal(normalizeHistoryDropStep(undefined), 1);
      assert.equal(normalizeHistoryDropStep("abc"), 1);
      assert.equal(normalizeHistoryDropStep(500), 100);
      const drops = Array.from({ length: 21 }, (_, index) => steppedDropCount(20 + index, 20, 10));
      assert.deepEqual(drops, [0, ...Array(10).fill(10), ...Array(10).fill(20)]);
      assert.equal(steppedDropCount(25, 20, 1), 5, "a step of 1 is the old one-at-a-time cut");
    },
  },
  {
    name: "the chat's message limit drops in steps and never drops the newest message",
    run() {
      const starts = [21, 25, 30, 31].map(
        (count) => applyContextMessageLimitWithPins(rows(count), 20, undefined, 10)[0]!.id,
      );
      assert.deepEqual(starts, ["m11", "m11", "m11", "m21"]);
      const small = applyContextMessageLimitWithPins(rows(5), 2, undefined, 10);
      assert.deepEqual(
        small.map((row) => row.id),
        ["m5"],
        "a step larger than the history still keeps the newest message",
      );
      assert.equal(applyContextMessageLimitWithPins(rows(25), 20)[0]!.id, "m6", "no step: unchanged");
    },
  },
  {
    name: "Chat History's Max messages drops in steps",
    async run() {
      const first = async (count: number, step?: number) =>
        (await assembleWithMax(count, 20, step)).find((message) => /MSG_\d+/u.test(message.content))!.content;
      assert.match(await first(25, 10), /^<chat_history>\nMSG_11$/u);
      assert.match(await first(30, 10), /^<chat_history>\nMSG_11$/u);
      assert.match(await first(31, 10), /^<chat_history>\nMSG_21$/u);
      assert.match(await first(25), /^<chat_history>\nMSG_6$/u, "no step: the last 20");
    },
  },
  {
    name: "the context-size trim drops whole steps and the start holds across turns",
    run() {
      const fit = (count: number, step?: number) =>
        fitMessagesToContext(longPrompt(count), { maxContext: 4000, maxTokens: 200, historyDropStep: step }).messages;
      const minimal = firstHistoryNumber(fit(40)) - 1;
      assert.ok(minimal > 0, "the fixture is over budget");
      const stepped = firstHistoryNumber(fit(40, 10)) - 1;
      assert.equal(stepped % 10, 0, "a whole number of steps is dropped");
      assert.ok(stepped >= minimal && stepped < minimal + 10);
      // Two turns later the minimal cut moved by about two messages; the stepped one stays unless a step is due.
      const later = firstHistoryNumber(fit(42, 10)) - 1;
      const laterMinimal = firstHistoryNumber(fit(42)) - 1;
      assert.equal(later, Math.ceil(laterMinimal / 10) * 10);
      if (laterMinimal <= stepped) assert.equal(later, stepped, "the start holds between steps");
    },
  },
  {
    name: "trimming keeps the opening <chat_history> tag on the new first message",
    run() {
      for (const step of [undefined, 10]) {
        const messages = fitMessagesToContext(longPrompt(40), {
          maxContext: 4000,
          maxTokens: 200,
          historyDropStep: step,
        }).messages;
        const history = messages.filter((message) => message.contextKind === "history");
        assert.match(history[0]!.content, /^<chat_history>\nMSG_\d+/u, `step ${step ?? 1}`);
        assert.equal(
          messages.filter((message) => message.content.includes("<chat_history>")).length,
          1,
          "exactly one opening tag",
        );
        assert.match(history.at(-1)!.content, /^<last_message>/u, "the newest message stays");
      }
    },
  },
  {
    name: "summarised messages leave the recent tail in steps",
    run() {
      const meta = (count: number) => ({
        hideSummarisedMessages: true,
        summaryTailMessages: 10,
        historyDropStep: 10,
        summaryEntries: [
          {
            id: "e1",
            content: "Recap",
            enabled: true,
            messageIds: rows(count).map((row) => row.id),
          },
        ],
      });
      const start = (count: number) => capSummarizedHistory(rows(count), meta(count)).messages[0]!.id;
      assert.deepEqual([12, 15, 20, 21].map(start), ["m11", "m11", "m11", "m21"]);
      const plain = capSummarizedHistory(rows(15), { ...meta(15), historyDropStep: undefined }).messages[0]!.id;
      assert.equal(plain, "m6", "no step: the newest 10");
    },
  },
];

await runNamedCases(cases);
