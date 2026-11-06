import assert from "node:assert/strict";
import type { AgentContext } from "../../packages/shared/src/types/agent.js";
import { executeAgent } from "../../packages/server/src/services/agents/agent-executor.js";
import type { ResolvedAgent } from "../../packages/server/src/services/agents/agent-pipeline.js";
import { mergePairedBuiltInRewriteAgents } from "../../packages/server/src/services/generation/prose-guardian-settings.js";
import {
  BaseLLMProvider,
  type ChatCompletionResult,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

class RecordingProvider extends BaseLLMProvider {
  requests: ChatMessage[][] = [];

  constructor() {
    super("http://127.0.0.1:1", "fixture");
  }

  async *chat(_messages: ChatMessage[], _options: ChatOptions): AsyncGenerator<string, void, unknown> {
    return;
  }

  override async chatComplete(messages: ChatMessage[], _options: ChatOptions): Promise<ChatCompletionResult> {
    this.requests.push(messages);
    return {
      content: JSON.stringify({ editNeeded: false, editedText: "", changes: [] }),
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  }
}

const entry = (id: string, content: string) => ({ id, content, matchedKeys: [], activationSources: [] });
const context: AgentContext = {
  chatId: "merged-rewrite-lorebooks",
  chatMode: "roleplay",
  recentMessages: [{ role: "assistant", content: "A crystal glows." }],
  mainResponse: "A crystal glows.",
  characters: [],
  persona: null,
  memory: {},
  writableLorebookIds: null,
  chatSummary: null,
  streaming: false,
  triggeredLorebookEntriesByAgentId: {
    "cfg-prose-guardian": [entry("style-entry", "STYLE_REFERENCE"), entry("shared-entry", "SHARED_REFERENCE")],
    "cfg-continuity": [entry("continuity-entry", "CONTINUITY_REFERENCE"), entry("shared-entry", "SHARED_REFERENCE")],
    "cfg-html": [entry("html-entry", "HTML_REFERENCE")],
    "unrelated-agent": [entry("unrelated-entry", "UNRELATED_REFERENCE")],
  },
};

function makeAgent(type: string, attached: boolean, provider: RecordingProvider): ResolvedAgent {
  return {
    id: `cfg-${type}`,
    type,
    name: type,
    phase: "post_processing",
    promptTemplate: `${type} instructions`,
    connectionId: "fixture",
    settings: {
      resultType: "text_rewrite",
      contextSize: 4,
      maxTokens: 512,
      ...(attached ? { chatLorebookAttachmentEnabled: true, chatAttachedLorebookId: `book-${type}` } : {}),
    },
    isCustomAgent: false,
    provider,
    model: "fixture",
  };
}

for (const attachedTypes of [[], ["continuity"], ["prose-guardian"], ["prose-guardian", "continuity", "html"]]) {
  const provider = new RecordingProvider();
  const agents = ["prose-guardian", "continuity", "html"].map((type) =>
    makeAgent(type, attachedTypes.includes(type), provider),
  );
  const settingsBefore = agents.map((agent) => structuredClone(agent.settings));
  const merged = mergePairedBuiltInRewriteAgents(agents);
  assert.equal(merged.length, 1, "references must not split the shared editor call");
  assert.deepEqual(
    agents.map((agent) => agent.settings),
    settingsBefore,
    "merging leaves source settings intact",
  );
  const result = await executeAgent(merged[0]!, context, provider, "fixture");
  assert(result.success, result.error ?? "rewrite failed");
  assert.equal(provider.requests.length, 1, "all merged editors retain one provider request");
  const prompt = provider.requests[0]!.map((message) => message.content).join("\n");
  for (const [type, reference] of [
    ["prose-guardian", "STYLE_REFERENCE"],
    ["continuity", "CONTINUITY_REFERENCE"],
    ["html", "HTML_REFERENCE"],
  ]) {
    assert.equal(prompt.includes(reference!), attachedTypes.includes(type!), `${type} keeps its own attachment`);
  }
  assert(!prompt.includes("UNRELATED_REFERENCE"), "unrelated agents' references never enter the merged call");
  assert.equal(
    prompt.split("SHARED_REFERENCE").length - 1,
    attachedTypes.some((type) => type !== "html") ? 1 : 0,
    "a matching entry shared by merged members is rendered once",
  );
}

const provider = new RecordingProvider();
const independent = makeAgent("continuity", true, provider);
independent.settings.batchWithOtherAgents = false;
const separate = mergePairedBuiltInRewriteAgents([makeAgent("prose-guardian", false, provider), independent]);
assert.equal(separate.length, 2, "an explicit no-sharing choice stays separate");
const result = await executeAgent(independent, context, provider, "fixture");
assert(result.success, result.error ?? "independent rewrite failed");
const prompt = provider.requests[0]!.map((message) => message.content).join("\n");
assert(prompt.includes("CONTINUITY_REFERENCE"));
assert(!prompt.includes("STYLE_REFERENCE") && !prompt.includes("HTML_REFERENCE"));

console.info("PASS: merged rewrite attachments preserve each member, deduplicate entries and retain one call");
