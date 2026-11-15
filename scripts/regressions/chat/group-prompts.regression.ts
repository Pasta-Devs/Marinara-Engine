import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type ChatMLMessage } from "../../../packages/shared/src/index.js";
import {
  getMessageHiddenFromAICharacterIds,
  injectIntoOutputFormatOrLastUser,
  isMessageHiddenFromAIForCharacter,
  stripSpeakerTagsExceptLastAssistant,
  type SimpleMessage,
} from "../../../packages/server/src/routes/generate/generate-route-utils.js";
import { filterPromptMessagesForCharacterAudience } from "../../../packages/server/src/services/generation/prompt-message-scope.js";
import {
  mergeAdjacentMessages,
  squashLeadingSystemMessages,
} from "../../../packages/server/src/services/prompt/merger.js";
import { wrapContent } from "../../../packages/server/src/services/prompt/format-engine.js";
import { scopeIndividualGroupMessagesForTarget } from "../../../packages/server/src/services/generation/prompt-message-scope.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const selectivelyHiddenMessage = {
  extra: JSON.stringify({ hiddenFromAICharacterIds: ["pantalone", "pantalone", " dottore ", 42] }),
};
assert.deepEqual(
  getMessageHiddenFromAICharacterIds(selectivelyHiddenMessage),
  ["pantalone", "dottore"],
  "per-character AI visibility should normalize valid unique character IDs",
);
assert.equal(
  isMessageHiddenFromAIForCharacter(selectivelyHiddenMessage, "pantalone"),
  true,
  "a selectively hidden message should be excluded from the selected character's context",
);
assert.equal(
  isMessageHiddenFromAIForCharacter(selectivelyHiddenMessage, "maukie"),
  false,
  "a selectively hidden message should remain visible to non-selected characters",
);
assert.equal(
  isMessageHiddenFromAIForCharacter({ extra: { hiddenFromAI: true } }, "maukie"),
  true,
  "legacy global AI visibility should continue to hide messages from every character",
);
const audienceScopedHistory: ChatMLMessage[] = [
  {
    role: "user",
    content: "<chat_history>\nVisible setup\n</chat_history>",
    contextKind: "history",
  },
  {
    role: "assistant",
    content: "<last_message>\nPantalone's private clue\n</last_message>",
    contextKind: "history",
    characterId: "dottore",
    hiddenFromAICharacterIds: ["pantalone"],
  },
];
const pantaloneHistory = filterPromptMessagesForCharacterAudience(audienceScopedHistory, ["pantalone"]);
assert.equal(pantaloneHistory.length, 1, "the selected character should not receive the restricted history message");
assert.match(
  pantaloneHistory[0]!.content,
  /^<last_message>[\s\S]*Visible setup[\s\S]*<\/last_message>$/,
  "history wrappers should be repaired after a restricted message is removed",
);
assert.equal(
  filterPromptMessagesForCharacterAudience(audienceScopedHistory, ["dottore"]).length,
  2,
  "other group characters should keep the restricted message in context",
);
const characterStartHistory: ChatMLMessage[] = [
  { role: "user", content: "Shared opening", contextKind: "history" },
  {
    role: "assistant",
    content: "Maukie enters",
    contextKind: "history",
    characterId: "maukie",
    conversationStartForCharacterIds: ["maukie"],
  },
  { role: "user", content: "Welcome, Maukie", contextKind: "history" },
];
assert.deepEqual(
  filterPromptMessagesForCharacterAudience(characterStartHistory, ["maukie"]).map((message) => message.content),
  ["Maukie enters", "Welcome, Maukie"],
  "a character-specific New Start should exclude earlier history only for that character",
);
assert.deepEqual(
  filterPromptMessagesForCharacterAudience(characterStartHistory, ["dottore"]).map((message) => message.content),
  ["Shared opening", "Maukie enters", "Welcome, Maukie"],
  "other characters should retain history before another character's New Start",
);
assert.equal(
  mergeAdjacentMessages(characterStartHistory).length,
  3,
  "prompt merging must preserve character-specific context boundaries",
);
assert.equal(
  mergeAdjacentMessages([
    { role: "user", content: "Visible", contextKind: "history" },
    {
      role: "user",
      content: "Private",
      contextKind: "history",
      hiddenFromAICharacterIds: ["pantalone"],
    },
  ]).length,
  2,
  "prompt assembly must not merge messages with different character audiences",
);
const mergedRestrictedHistory = mergeAdjacentMessages([
  {
    role: "user",
    content: "First private detail",
    contextKind: "history",
    hiddenFromAICharacterIds: ["pantalone"],
  },
  {
    role: "user",
    content: "Second private detail",
    contextKind: "history",
    hiddenFromAICharacterIds: ["pantalone"],
  },
]);
assert.equal(mergedRestrictedHistory.length, 1, "messages with the same restricted audience may still merge");
assert.deepEqual(
  mergedRestrictedHistory[0]!.hiddenFromAICharacterIds,
  ["pantalone"],
  "merged messages should retain their restricted audience",
);
assert.equal(
  mergeAdjacentMessages([
    { role: "user", content: "First shared secret", hiddenFromAICharacterIds: ["pantalone", "dottore"] },
    { role: "user", content: "Second shared secret", hiddenFromAICharacterIds: ["dottore", "pantalone"] },
  ]).length,
  1,
  "equivalent character audiences should merge regardless of selection order",
);
assert.equal(
  squashLeadingSystemMessages([
    { role: "system", content: "Visible system context" },
    { role: "system", content: "Private event", hiddenFromAICharacterIds: ["pantalone"] },
  ]).length,
  2,
  "system-message squashing should not combine different character audiences",
);
const audienceScopedSystemMessages = squashLeadingSystemMessages([
  { role: "system", content: "Public setup A" },
  { role: "system", content: "Public setup B" },
  { role: "system", content: "Private setup A", hiddenFromAICharacterIds: ["pantalone", "dottore"] },
  { role: "system", content: "Private setup B", hiddenFromAICharacterIds: ["dottore", "pantalone"] },
  { role: "user", content: "Continue" },
]);
assert.deepEqual(
  audienceScopedSystemMessages.map((message) => message.content),
  ["Public setup A\n\nPublic setup B", "Private setup A\n\nPrivate setup B", "Continue"],
  "leading system messages should squash within contiguous equivalent audience runs",
);
assert.deepEqual(
  audienceScopedSystemMessages[1]!.hiddenFromAICharacterIds,
  ["pantalone", "dottore"],
  "squashed system runs should retain their character audience",
);
const maukieRestrictedRun: ChatMLMessage[] = [
  { role: "user", content: "Visible before private run", contextKind: "history" },
  ...Array.from({ length: 16 }, (_, index) => ({
    role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: `Private run message ${index + 1}`,
    contextKind: "history" as const,
    hiddenFromAICharacterIds: ["maukie"],
  })),
  { role: "user", content: "Visible after private run", contextKind: "history" },
];
assert.deepEqual(
  filterPromptMessagesForCharacterAudience(maukieRestrictedRun, ["powers-that-be"]).map((message) => message.content),
  maukieRestrictedRun.map((message) => message.content),
  "every message in a character-scoped run should remain visible to other responding characters",
);
assert.deepEqual(
  filterPromptMessagesForCharacterAudience(maukieRestrictedRun, ["maukie"]).map((message) => message.content),
  ["Visible before private run", "Visible after private run"],
  "every message in a character-scoped run should be removed for the restricted character",
);

const cases: RegressionCase[] = [
  {
    name: "group speaker instructions prefer output format and otherwise use the last user turn",
    run() {
      const withOutputFormat: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "user", content: "<output_format>\nexisting rule\n</output_format>" },
      ];
      injectIntoOutputFormatOrLastUser(withOutputFormat, "speaker tag rule", { indent: true });

      assert.match(withOutputFormat[1]?.content ?? "", /existing rule\n    speaker tag rule\n<\/output_format>/);

      const withoutOutputFormat: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "user", content: "latest user turn" },
        { role: "assistant", content: "assistant prefill" },
      ];
      injectIntoOutputFormatOrLastUser(withoutOutputFormat, "speaker tag rule", { indent: true });

      assert.equal(withoutOutputFormat[1]?.content, "latest user turn\n\nspeaker tag rule");
      assert.equal(withoutOutputFormat[2]?.content, "assistant prefill");
    },
  },
  {
    name: "group speaker tag cleanup preserves the latest assistant example",
    run() {
      const messages: SimpleMessage[] = [
        { role: "system", content: "base system" },
        { role: "assistant", content: '<speaker="Dottore">"An older line."</speaker>' },
        { role: "user", content: '<speaker="Mari">"A user-authored tag."</speaker>' },
        { role: "assistant", content: '<speaker="Pantalone">"The latest example."</speaker>' },
      ];

      stripSpeakerTagsExceptLastAssistant(messages);

      assert.equal(messages[1]?.content, '"An older line."');
      assert.equal(messages[2]?.content, '"A user-authored tag."');
      assert.equal(messages[3]?.content, '<speaker="Pantalone">"The latest example."</speaker>');
    },
  },
  {
    name: "manual group generation does not inject a duplicate recent transcript prompt",
    run() {
      const routeSource = readFileSync(
        new URL("../../../packages/server/src/routes/generate.routes.ts", import.meta.url),
        "utf8",
      );
      const forbiddenFragments = [
        ["recent", "_group", "_transcript"].join(""),
        ["Recent visible", " group transcript"].join(""),
        ["ignore the user's latest", " visible reply"].join(""),
        ["buildManual", "GroupRecent", "Transcript"].join(""),
      ];

      for (const fragment of forbiddenFragments) {
        assert.equal(routeSource.includes(fragment), false, `${fragment} must not be present in generate.routes.ts`);
      }
    },
  },
  {
    name: "individual group turns drop other cards with non-Latin names",
    run() {
      for (const format of ["xml", "markdown"] as const) {
        const scoped = scopeIndividualGroupMessagesForTarget(
          [
            {
              role: "system",
              content: [
                wrapContent("Hong card only.", "홍길동", format, 1),
                wrapContent("Kim card only.", "김 철수", format, 1),
                wrapContent("Ram card only.", "Dr. राम", format, 1),
              ].join("\n"),
              contextKind: "prompt",
            },
          ],
          "hong",
          [
            { id: "hong", name: "홍길동" },
            { id: "kim", name: "김 철수" },
            { id: "ram", name: "Dr. राम" },
          ],
        );

        const content = scoped[0]?.content ?? "";
        assert.match(content, /Hong card only\./u, format);
        assert.doesNotMatch(content, /Kim card only\./u, format);
        assert.doesNotMatch(content, /Ram card only\./u, format);
      }
    },
  },
];

await runNamedCases(cases);
