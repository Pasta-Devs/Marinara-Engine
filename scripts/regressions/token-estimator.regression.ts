import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateTextTokens } from "../../packages/shared/src/utils/token-estimator.js";
import { estimateCharacterCardTokens } from "../../packages/client/src/lib/character-token-count.js";
import { processActivatedEntries } from "../../packages/server/src/services/lorebook/prompt-injector.js";
import { createLorebookEntrySchema } from "../../packages/shared/src/schemas/lorebook.schema.js";

assert.equal(estimateTextTokens(""), 0);
assert.equal(estimateTextTokens("abcdefghijkl"), 3, "Latin text should retain the four-characters-per-token estimate");
assert.equal(estimateTextTokens("가나다라마바사아"), 4, "Hangul should estimate two characters per token");
assert.equal(estimateTextTokens("漢字漢字漢字"), 5, "Han characters should use their own 0.67 weight");
assert.equal(estimateTextTokens("あいうえおか"), 5, "Hiragana should use the Kana 0.67 weight");
assert.equal(estimateTextTokens("アイウエオカ"), 5, "Katakana should use the Kana 0.67 weight");
assert.equal(estimateTextTokens("ab가漢ア"), 3, "mixed scripts should add their per-code-point weights");
assert.equal(estimateTextTokens("😀😀😀😀"), 1, "non-CJK astral characters should be counted by Unicode code point");

const koreanCardDescription = "가나다라마바사아";
assert.equal(
  estimateCharacterCardTokens({ description: koreanCardDescription }),
  4,
  "character cards should display the shared token estimate, not their raw character count",
);

for (const [contents, expected] of [
  [[], 0],
  [["a", "b"], 1],
  [["가", "나"], 1],
  [["漢", "字", "漢"], 3],
  [["a", "가", "漢"], 2],
] as Array<[string[], number]>) {
  const entries: Parameters<typeof processActivatedEntries>[0] = contents.map((content, order) => ({
    entry: {
      ...createLorebookEntrySchema.parse({ lorebookId: "token-estimator", name: `Entry ${order}`, content, order }),
      id: `entry-${order}`,
      position: 0,
      embedding: null,
      sourceAgentId: null,
      sourceMessageRefs: [],
      createdAt: "2026-09-13T00:00:00.000Z",
      updatedAt: "2026-09-13T00:00:00.000Z",
    },
    matchedKeys: [],
    activationSources: [],
    injectionOrder: order,
  }));
  assert.equal(
    processActivatedEntries(entries).totalTokensEstimate,
    expected,
    "Lorebook totals must apply script weights and round once after combining entries",
  );
}

// Guard the other aggregate call sites without loading route or UI dependencies.
for (const [path, expression] of [
  [
    "packages/client/src/components/chat/AgentSuiteModal.tsx",
    'estimateTextTokens(selectedContextSources.map((source) => source.content).join(""))',
  ],
  [
    "packages/server/src/routes/generate.routes.ts",
    'estimateTextTokens( (assembled.lorebookActivatedEntries ?? []).map((entry) => entry.content).join(""), )',
  ],
  [
    "packages/server/src/routes/lorebooks.routes.ts",
    'estimateTextTokens(activatedEntries.map((entry) => entry.content).join(""))',
  ],
]) {
  const text = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8").replace(/\s+/gu, " ");
  assert.ok(text.includes(expression!), `${path}: combined text must be estimated only once`);
}
