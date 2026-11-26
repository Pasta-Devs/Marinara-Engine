// "Combine older summaries automatically" (chat setting summaryAutoCombineAbove): once a chat has more turned-on
// summary entries than the limit, every one but the newest is folded into one entry with the combine prompt.
import assert from "node:assert/strict";
import type { ChatSummaryEntry } from "../../../packages/shared/src/index.js";
import {
  combineSummaryEntries,
  normalizeSummaryAutoCombineAbove,
  selectEntriesToAutoCombine,
} from "../../../packages/server/src/services/chat-summary/combine-entries.js";
import type { BaseLLMProvider } from "../../../packages/server/src/services/llm/base-provider.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";

const entry = (n: number, enabled = true): ChatSummaryEntry =>
  ({
    id: `e${n}`,
    kind: "rolling",
    origin: "automated",
    title: `Part ${n}`,
    content: `Recap ${n}`,
    enabled,
    messageIds: [`m${n * 2 - 1}`, `m${n * 2}`],
    createdAt: "2026-11-26T00:00:00.000Z",
    updatedAt: "2026-11-26T00:00:00.000Z",
  }) as ChatSummaryEntry;

const cases: RegressionCase[] = [
  {
    name: "the setting is off unless it is a whole number from 2",
    run() {
      assert.equal(normalizeSummaryAutoCombineAbove(undefined), 0);
      assert.equal(normalizeSummaryAutoCombineAbove(1), 0);
      assert.equal(normalizeSummaryAutoCombineAbove("4"), 4);
      assert.equal(normalizeSummaryAutoCombineAbove(1000), 100);
    },
  },
  {
    name: "it waits until there are more entries than the limit, then takes all but the newest",
    run() {
      const four = [1, 2, 3, 4].map((n) => entry(n));
      assert.deepEqual(selectEntriesToAutoCombine(four, 4), [], "at the limit: nothing yet");
      assert.deepEqual(selectEntriesToAutoCombine([...four, entry(5)], 4), ["e1", "e2", "e3", "e4"]);
      assert.deepEqual(selectEntriesToAutoCombine([...four, entry(5)], 0), [], "off");
      const withOff = [entry(1), entry(2, false), entry(3), entry(4), entry(5), entry(6)];
      assert.deepEqual(selectEntriesToAutoCombine(withOff, 4), ["e1", "e3", "e4", "e5"], "turned-off entries stay");
    },
  },
  {
    name: "combining keeps order and coverage and saves one entry in place of the older ones",
    async run() {
      let meta: Record<string, unknown> = { summaryEntries: [1, 2, 3, 4, 5].map((n) => entry(n)) };
      const prompts: string[] = [];
      const provider = {
        maxContextValue: undefined,
        maxTokensOverrideValue: undefined,
        async chatComplete(messages: Array<{ content: string }>) {
          prompts.push(messages.at(-1)!.content);
          return { content: "Everything before part 5." };
        },
      } as unknown as BaseLLMProvider;
      const result = await combineSummaryEntries({
        chatId: "chat-1",
        chatMeta: meta,
        entryIds: selectEntriesToAutoCombine(meta.summaryEntries as ChatSummaryEntry[], 4),
        provider,
        model: "test",
        temperatureOptions: {},
        summaryMaxTokens: 512,
        promptTemplateId: null,
        globalSummaryPromptSettings: null,
        storage: {
          async patchMetadata(_id, patch) {
            meta = { ...meta, ...patch(meta) };
            return meta;
          },
        },
      });
      assert.ok(result.ok);
      assert.match(prompts[0]!, /Summary 1 — Part 1:\nRecap 1[\s\S]*Summary 4 — Part 4:\nRecap 4/u);
      assert.doesNotMatch(prompts[0]!, /Recap 5/u, "the newest entry is not sent");
      const saved = meta.summaryEntries as ChatSummaryEntry[];
      assert.equal(saved.filter((item) => item.enabled).length, 2);
      const enabled = saved.filter((item) => item.enabled);
      assert.equal(enabled[0]!.content, "Everything before part 5.");
      assert.deepEqual(enabled[0]!.messageIds, ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]);
      assert.equal(enabled[1]!.id, "e5", "the newest entry stays last");
    },
  },
];

await runNamedCases(cases);
