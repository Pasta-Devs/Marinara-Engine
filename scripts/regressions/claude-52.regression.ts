import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  ANTHROPIC_MODELS,
  findKnownModel,
  isClaudeStrictRequestModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "../../packages/shared/src/constants/model-lists.js";
import {
  reasoningEffortChoices,
  relevantGenerationParameters,
} from "../../packages/shared/src/constants/generation-parameter-relevance.js";
import {
  AnthropicProvider,
  applyAnthropicToolChoice,
} from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

const models = ["claude-fable-5-2", "claude-mythos-5-2"] as const;
const tool = {
  type: "function" as const,
  function: { name: "lookup", description: "Look up a fact", parameters: { type: "object", properties: {} } },
};

await test("Claude 5.2 models are selectable with native and gateway limits", () => {
  for (const model of models) {
    assert.ok(
      ANTHROPIC_MODELS.some((entry) => entry.id === model),
      model,
    );
    for (const [provider, id] of [
      ["anthropic", model],
      ["custom", model],
      ["openrouter", `anthropic/${model.replace("5-2", "5.2")}`],
      ["openrouter", `anthropic/${model.replace("5-2", "5.2")}:thinking`],
    ] as const) {
      assert.equal(findKnownModel(provider, id)?.context, 1_000_000, id);
      assert.equal(findKnownModel(provider, id)?.maxOutput, 128_000, id);
      assert.equal(shouldSuppressUnknownModelParameters(provider, id), false, id);
      assert.equal(isClaudeStrictRequestModel(id), true, id);
    }
    assert.equal(resolveProviderReasoningEffort({ provider: "anthropic", model, reasoningEffort: "maximum" }), "max");
    assert.equal(findKnownModel("anthropic", model.replace("5-2", "5-20")), undefined);
    assert.equal(isClaudeStrictRequestModel(model), true);
    assert.equal(isClaudeStrictRequestModel(model.replace("5-2", "5-20")), false);
    const relevant = relevantGenerationParameters({ provider: "anthropic", model });
    assert.ok(relevant.has("reasoningEffort"));
    assert.ok(relevant.has("maxTokens"));
    for (const sampler of ["temperature", "topP", "topK"] as const) assert.equal(relevant.has(sampler), false);
    assert.ok(
      reasoningEffortChoices({
        provider: "anthropic",
        model,
        capabilities: { adaptiveThinking: true, effortLevels: ["low", "high", "maximum"] },
      }).every((choice) => choice.value !== null),
      "always-on thinking cannot offer Off",
    );
  }
  assert.equal(findKnownModel("claude_subscription", "claude-fable-5-2")?.maxOutput, 128_000);
});

await test("5.2 forced tools fall back to automatic choice without changing Fable 5", () => {
  for (const model of [...models, "claude-fable-5"]) {
    const body: Record<string, unknown> = { thinking: { type: "adaptive" } };
    applyAnthropicToolChoice(body, { model, toolChoice: "required", tools: [tool] });
    assert.deepEqual(body.tool_choice, { type: model === "claude-fable-5" ? "any" : "auto" }, model);
  }
});

// Exercise the actual request builders without provider credentials or paid calls.
const requests: Array<Record<string, unknown>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push(body);
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      [
        { type: "message_start", message: { usage: { input_tokens: 12 } } },
        { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Reasoned." } },
        { type: "content_block_stop", index: 0 },
        { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hello Mari" } },
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 8 } },
        { type: "message_stop" },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    );
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        content: [
          { type: "thinking", thinking: "Reasoned." },
          { type: "text", text: "Hello Mari" },
        ],
        stop_reason: "end_turn",
        usage: { input_tokens: 12, output_tokens: 8 },
      }),
    );
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const provider = new AnthropicProvider(`http://127.0.0.1:${address.port}`, "fixture");
const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

try {
  for (const model of models) {
    await test(`${model} plain and tool requests preserve reasoning, tokens and replies`, async () => {
      for (const stream of [false, true]) {
        for (const tools of [undefined, [tool]]) {
          for (const reasoningEffort of ["none", "max"] as const) {
            const thoughts: string[] = [];
            const options: ChatOptions = {
              model,
              stream,
              tools,
              toolChoice: "required",
              maxTokens: 128_000,
              reasoningEffort,
              captureReasoning: true,
              temperature: 0.7,
              topP: 0.8,
              topK: 32,
              onThinking: (thought) => {
                thoughts.push(thought);
              },
            };
            let content = "";
            if (tools) content = (await provider.chatComplete(messages, options)).content;
            else for await (const token of provider.chat(messages, options)) content += token;
            assert.equal(content, "Hello Mari");
            assert.equal(thoughts.join(""), "Reasoned.");
            const body = requests.at(-1)!;
            assert.equal(body.model, model);
            assert.equal(body.max_tokens, 128_000);
            assert.deepEqual(body.thinking, { type: "adaptive", display: "summarized" });
            assert.deepEqual(body.output_config, { effort: reasoningEffort === "none" ? "low" : "max" });
            for (const sampler of ["temperature", "top_p", "top_k"]) assert.equal(sampler in body, false);
            assert.deepEqual(body.tool_choice, tools ? { type: "auto" } : undefined);
          }
        }
      }
    });
    await test(`${model} normalizes saved thinking and continues assistant prefill`, async () => {
      const history: ChatMessage[] = [
        ...messages,
        { role: "system", content: "Depth instruction" },
        { role: "assistant", content: "The door " },
      ];
      for (const tools of [undefined, [tool]]) {
        for (const thinking of [{ type: "disabled" }, { type: "enabled", budget_tokens: 2000 }]) {
          const customParameters = {
            thinking,
            output_config: { effort: "none" },
            ...(tools ? { tool_choice: { type: "tool", name: "lookup" } } : {}),
            temperature: 0.4,
            top_p: 0.8,
            top_k: 8,
          };
          const original = structuredClone(customParameters);
          const options: ChatOptions = { model, stream: false, tools, customParameters };
          if (tools) await provider.chatComplete(history, options);
          else
            for await (const _token of provider.chat(history, options)) {
              /* exhaust the request */
            }
          const body = requests.at(-1)!;
          assert.deepEqual(body.thinking, { type: "adaptive" });
          assert.deepEqual(body.output_config, { effort: "low" });
          assert.deepEqual(body.tool_choice, tools ? { type: "auto" } : undefined);
          for (const sampler of ["temperature", "top_p", "top_k"]) assert.equal(sampler in body, false);
          const sentHistory = body.messages as Array<{ role: string; content: unknown }>;
          assert.equal(sentHistory[1]?.role, "system", "depth instruction keeps its history position");
          assert.equal(sentHistory.at(-1)?.role, "user", "continuation avoids rejected assistant prefill");
          assert.ok(JSON.stringify(sentHistory).includes("The door "));
          assert.deepEqual(customParameters, original, "stored settings are not mutated");
        }
      }
      assert.equal(history.at(-1)?.content, "The door ");
    });
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
