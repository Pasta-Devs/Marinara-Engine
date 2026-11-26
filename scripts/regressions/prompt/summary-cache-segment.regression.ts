// Past Events as its own system message on a caching connection: a new summary then changes the prompt only from Past
// Events on, so the fixed system prompt before it stays cached (the provider puts a cache breakpoint there).
import assert from "node:assert/strict";
import type { ChatMLMessage } from "../../../packages/shared/src/index.js";
import type { DB } from "../../../packages/server/src/db/connection.js";
import {
  assemblePrompt,
  appendFallbackChatSummaryToSystemPrompt,
} from "../../../packages/server/src/services/prompt/assembler.js";
import { postProcessMessages } from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import { promptSection } from "../fixtures/prompt-helpers.js";

const history: ChatMLMessage[] = [
  { role: "user", content: "Hello", contextKind: "history" },
  { role: "assistant", content: "Hi", contextKind: "history" },
];

/** The stock layout: Persona and Past Events in the Lore group, then Chat History. */
async function assemble(wrapFormat: "xml" | "markdown", summary: string, separate: boolean, defer = true) {
  const result = await assemblePrompt({
    db: undefined as unknown as DB,
    preset: {
      id: "preset-summary-segment",
      name: "Summary Segment Fixture",
      sectionOrder: JSON.stringify(["role", "persona", "summary", "chat"]),
      groupOrder: JSON.stringify(["lore"]),
      wrapFormat,
      parameters: JSON.stringify({}),
      variableGroups: JSON.stringify([]),
      variableValues: JSON.stringify({}),
    },
    sections: [
      promptSection({ id: "role", identifier: "role", name: "Role", content: "FIXED_ROLE\nline two" }),
      promptSection({
        id: "persona",
        identifier: "persona",
        name: "Persona",
        content: "FIXED_PERSONA",
        groupId: "lore",
      }),
      promptSection({
        id: "summary",
        identifier: "chatSummary",
        name: "Past Events",
        isMarker: "true",
        markerConfig: JSON.stringify({ type: "chat_summary" }),
        groupId: "lore",
      }),
      promptSection({
        id: "chat",
        identifier: "chatHistory",
        name: "Chat History",
        isMarker: "true",
        markerConfig: JSON.stringify({ type: "chat_history" }),
      }),
    ],
    groups: [
      {
        id: "lore",
        presetId: "preset-summary-segment",
        name: "Lore",
        parentGroupId: null,
        order: 0,
        enabled: "true",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    choiceBlocks: [],
    chatChoices: {},
    chatId: "chat-summary-segment",
    characterIds: [],
    personaName: "Mari",
    personaDescription: "",
    chatMessages: history,
    chatSummary: summary,
    separateSummaryForCache: separate,
    deferMessagePostProcessing: defer,
  });
  return defer ? postProcessMessages(result.messages as never, {}) : result.messages;
}

const leadingSystem = (messages: Array<{ role: string; content: string }>) =>
  messages.slice(
    0,
    messages.findIndex((message) => message.role !== "system"),
  );

const cases: RegressionCase[] = [
  {
    name: "Past Events splits off the group, and the system prompt reads exactly as before",
    async run() {
      for (const wrapFormat of ["xml", "markdown"] as const) {
        for (const defer of [true, false]) {
          const merged = leadingSystem(await assemble(wrapFormat, "SUMMARY_A", false, defer));
          const split = leadingSystem(await assemble(wrapFormat, "SUMMARY_A", true, defer));
          assert.equal(merged.length, 1, `${wrapFormat}: one system message without caching`);
          assert.equal(split.length, 2, `${wrapFormat}: Past Events is its own message`);
          assert.equal(split.map((message) => message.content).join(""), merged[0]!.content, `${wrapFormat}`);
          assert.match(split[0]!.content, /FIXED_PERSONA/u);
          assert.doesNotMatch(split[0]!.content, /SUMMARY_A/u);
          assert.match(
            split[1]!.content,
            /^\s*(?:<past_events>|## Past Events)/u,
            `${wrapFormat}: starts at Past Events`,
          );
          assert.equal((split[1] as { summaryCacheSegment?: boolean }).summaryCacheSegment, true);
        }
      }
    },
  },
  {
    name: "a new summary leaves the part before Past Events unchanged",
    async run() {
      const before = leadingSystem(await assemble("xml", "SUMMARY_A", true));
      const after = leadingSystem(await assemble("xml", "SUMMARY_B with more", true));
      assert.equal(after[0]!.content, before[0]!.content);
      assert.notEqual(after[1]!.content, before[1]!.content);
    },
  },
  {
    name: "presetless Roleplay adds the summary as its own message on a caching connection",
    run() {
      const base: ChatMLMessage[] = [{ role: "system", content: "SYSTEM" }, ...history];
      const ctx = { variables: {} } as never;
      const merged = appendFallbackChatSummaryToSystemPrompt(base, "RECAP", "xml", ctx);
      const split = appendFallbackChatSummaryToSystemPrompt(base, "RECAP", "xml", ctx, undefined, undefined, true);
      assert.equal(leadingSystem(merged).length, 1);
      assert.equal(leadingSystem(split).length, 2);
      assert.equal(
        leadingSystem(split)
          .map((message) => message.content)
          .join(""),
        merged[0]!.content,
      );
      assert.equal(split[1]!.summaryCacheSegment, true);
    },
  },
];

await runNamedCases(cases);
