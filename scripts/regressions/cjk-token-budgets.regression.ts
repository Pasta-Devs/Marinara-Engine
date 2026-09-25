import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { estimateTextTokens, sliceTextToTokenBudget } from "../../packages/shared/src/utils/token-estimator.js";
import type { AgentContext, LorebookEntry } from "../../packages/shared/src/index.js";
import {
  packRecalledMemories,
  truncateRecalledMemory,
} from "../../packages/server/src/services/generation/memory-recall-pack.js";
import {
  BaseLLMProvider,
  fitMessagesToContext,
  type ChatMessage,
} from "../../packages/server/src/services/llm/base-provider.js";
import { buildCatalog } from "../../packages/server/src/services/agents/knowledge-router.js";
import { executeKnowledgeRetrieval } from "../../packages/server/src/services/agents/knowledge-retrieval.js";

const isWellFormed = (text: string) => !/[\uD800-\uDFFF]/u.test(text);

for (const text of ["Latin words ".repeat(100), "漢字かな".repeat(300), "한글".repeat(600), "𠀀😀a漢한".repeat(300)]) {
  for (const budget of [0, 1, 8, 96, 384]) {
    for (const fromEnd of [false, true]) {
      const sliced = sliceTextToTokenBudget(text, budget, fromEnd);
      assert.ok(estimateTextTokens(sliced) <= budget);
      assert.ok(fromEnd ? text.endsWith(sliced) : text.startsWith(sliced));
      assert.ok(isWellFormed(sliced), "Token slicing must not split supplementary Unicode code points");
      if (sliced.length < text.length) {
        const remaining = fromEnd ? text.slice(0, text.length - sliced.length) : text.slice(sliced.length);
        const next = fromEnd ? Array.from(remaining).at(-1)! + sliced : sliced + Array.from(remaining)[0]!;
        assert.ok(estimateTextTokens(next) > budget, "A fitting adjacent code point must not be discarded");
      }
    }
    const recalled = truncateRecalledMemory(text, budget);
    assert.ok(estimateTextTokens(recalled) <= budget, "The recall marker and both ends must fit together");
    assert.ok(isWellFormed(recalled));
  }
}
assert.equal(sliceTextToTokenBudget("small", 10), "small");
assert.equal(truncateRecalledMemory("small", 10), "small");

for (const content of ["漢".repeat(600), "한".repeat(900), "𠀀".repeat(600)]) {
  const packed = packRecalledMemories([{ content }], 2560);
  assert.equal(packed.lines.length, 1, "A high-ranked CJK memory must be trimmed, not dropped as over budget");
  assert.ok(packed.estimatedTokens <= packed.budgetTokens);
  assert.ok(estimateTextTokens(packed.lines[0]!) <= 384);
  assert.match(packed.lines[0]!, /recalled memory truncated/);
}
const packedMany = packRecalledMemories(
  ["漢".repeat(2000), "한".repeat(2000), "mixed 漢한😀 ".repeat(500)].map((content) => ({ content })),
  8192,
);
assert.equal(packedMany.lines.length, 3);
assert.ok(packedMany.estimatedTokens <= packedMany.budgetTokens);
assert.ok(packedMany.lines.every((line) => estimateTextTokens(line) <= 384));

for (const role of ["system", "user"] as const) {
  const content = `BEGIN ${"漢字かな한글𠀀".repeat(400)} END`;
  const fitted = fitMessagesToContext([{ role, content }], { maxContext: 1024, maxTokens: 128 });
  assert.ok(fitted.trimmed);
  assert.ok(fitted.estimatedTokensAfter <= fitted.inputBudget!);
  assert.ok(fitted.messages[0]!.content.startsWith("BEGIN"));
  if (role === "user") assert.ok(fitted.messages[0]!.content.endsWith("END"));
  assert.ok(isWellFormed(fitted.messages[0]!.content));
}

const catalog = buildCatalog([
  { id: "cjk", name: "CJK", description: "", content: "𠀀漢かな".repeat(10000), keys: [] },
] as unknown as LorebookEntry[]);
assert.ok(estimateTextTokens(catalog[0]!.summary) <= 60);
assert.ok(isWellFormed(catalog[0]!.summary));

class SourceRecordingProvider extends BaseLLMProvider {
  sources: string[] = [];
  constructor() {
    super("http://localhost", "", 8192);
  }
  async *chat(): AsyncGenerator<string, void, unknown> {}
  override async chatComplete(messages: ChatMessage[]) {
    const text = messages.map((message) => message.content).join("\n");
    const source = text.match(/<source_material>\n([\s\S]*?)\n<\/source_material>/u)?.[1];
    assert.ok(source, "The real retrieval executor must forward its source chunk");
    this.sources.push(source);
    return { content: '{"text":"Relevant finding."}', finishReason: "stop", toolCalls: [] };
  }
}
const context: AgentContext = {
  chatId: "cjk-budget-proof",
  chatMode: "roleplay",
  recentMessages: [],
  mainResponse: null,
  characters: [],
  persona: null,
  gameState: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
};
for (const source of ["漢字かな한글𠀀".repeat(300), "First sentence. ".repeat(200)]) {
  const provider = new SourceRecordingProvider();
  const result = await executeKnowledgeRetrieval(
    {
      id: "retrieval",
      type: "knowledge-retrieval",
      name: "Retrieval fixture",
      phase: "pre_generation",
      connectionId: null,
      isCustomAgent: false,
      promptTemplate: "Return relevant facts as JSON with a text field.",
      settings: { sourceContextBudget: 256, resultType: "context_injection", maxTokens: 128 },
    },
    context,
    provider,
    "fixture",
    source,
  );
  assert.ok(result.success, result.error ?? "Retrieval failed");
  assert.ok(provider.sources.length > 1);
  assert.ok(provider.sources.every((chunk) => estimateTextTokens(chunk) <= 256));
  assert.ok(provider.sources.every((chunk) => isWellFormed(chunk)));
  assert.equal(provider.sources.join("").replace(/\s/gu, ""), source.replace(/\s/gu, ""));
}

// Execute the existing private, pure Game cutter without starting route/storage dependencies.
const gameSource = readFileSync(new URL("../../packages/server/src/routes/game.routes.ts", import.meta.url), "utf8");
const gameCutter = gameSource.slice(
  gameSource.indexOf("function truncateSessionTranscriptMiddle("),
  gameSource.indexOf("function buildSessionConclusionMessages("),
);
const truncateSession = new Function(
  "estimateTextTokens",
  "sliceTextToTokenBudget",
  "SESSION_SUMMARY_MIN_TRANSCRIPT_CHARS",
  "SESSION_SUMMARY_TRUNCATION_MARKER",
  `${stripTypeScriptTypes(gameCutter)}; return truncateSessionTranscriptMiddle;`,
)(
  estimateTextTokens,
  sliceTextToTokenBudget,
  256,
  "\n\n[Middle of session transcript truncated to fit context window]\n\n",
) as (text: string, budget: number) => string;
for (const content of [`BEGIN ${"漢".repeat(1500)} END`, `BEGIN ${"abc ".repeat(1000)} END`]) {
  const result = truncateSession(content, 500);
  assert.ok(estimateTextTokens(result) <= 500);
  assert.ok(result.startsWith("BEGIN"));
  assert.ok(result.endsWith("END"));
  assert.match(result, /Middle of session transcript truncated/);
}
const minimumTranscript = truncateSession("漢".repeat(1000), 64);
assert.ok(Array.from(minimumTranscript).length >= 256, "Game retains its existing minimum transcript prefix");
assert.ok(estimateTextTokens(minimumTranscript) <= estimateTextTokens("漢".repeat(256)));

process.stdout.write(
  "CJK recall, provider fitting, catalog previews, retrieval chunks and Game transcript budgets passed.\n",
);
