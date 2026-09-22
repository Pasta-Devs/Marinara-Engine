import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  findKnownModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "../../packages/shared/src/constants/model-lists.js";
import { AnthropicProvider } from "../../packages/server/src/services/llm/providers/anthropic.provider.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import {
  ClaudeSubscriptionProvider,
  __setSdkForTesting,
} from "../../packages/server/src/services/llm/providers/claude-subscription.provider.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

// Wire-level fixtures; no paid provider calls or real credentials.
const requests: Array<Record<string, any>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push(body);
  const native = request.url?.startsWith("/anthropic/");
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    const events = native
      ? [
          { type: "message_start", message: { usage: { input_tokens: 12 } } },
          { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Reasoned." } },
          { type: "content_block_stop", index: 0 },
          { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hello " } },
          { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Mari" } },
          { type: "content_block_stop", index: 1 },
          { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 8 } },
          { type: "message_stop" },
        ]
      : [
          { choices: [{ delta: { content: "Hello " } }] },
          { choices: [{ delta: { content: "Mari" }, finish_reason: "stop" }] },
        ];
    response.end(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        native
          ? {
              content: [
                { type: "thinking", thinking: "Reasoned." },
                { type: "text", text: "Hello Mari" },
              ],
              stop_reason: "end_turn",
              usage: { input_tokens: 12, output_tokens: 8 },
            }
          : {
              choices: [{ message: { content: "Hello Mari" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 12, completion_tokens: 8 },
            },
      ),
    );
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const tool = {
  type: "function" as const,
  function: { name: "lookup", description: "Look up a fact", parameters: { type: "object", properties: {} } },
};
const messages: ChatMessage[] = [
  { role: "system", content: "Chat normally." },
  { role: "user", content: "Hello" },
];
const model = "claude-opus-5-5";
const native = new AnthropicProvider(`${baseUrl}/anthropic`, "fixture");

try {
  await test("Opus 5.5 is selectable with correct limits, including dotted gateway IDs", () => {
    for (const [provider, id] of [
      ["anthropic", model],
      ["claude_subscription", model],
      ["custom", model],
      ["openrouter", "anthropic/claude-opus-5.5"],
      ["openrouter", "anthropic/claude-opus-5.5:batch"],
      ["nanogpt", "claude-opus-5.5"],
    ] as const) {
      assert.equal(findKnownModel(provider, id)?.context, 1_000_000);
      assert.equal(findKnownModel(provider, id)?.maxOutput, 128_000);
      assert.equal(shouldSuppressUnknownModelParameters(provider, id), false);
    }
    assert.equal(findKnownModel("custom", "claude-opus-5.50"), undefined);
    assert.equal(resolveProviderReasoningEffort({ provider: "anthropic", model, reasoningEffort: "maximum" }), "max");
    assert.equal(resolveProviderReasoningEffort({ provider: "anthropic", model, reasoningEffort: "xhigh" }), "xhigh");
  });

  await test("native plain/tool requests stream text after thinking and send only supported effort/sampling", async () => {
    for (const stream of [false, true]) {
      for (const tools of [undefined, [tool]]) {
        for (const reasoningEffort of [undefined, "none", "low", "medium", "high", "xhigh", "max"] as const) {
          const text: string[] = [];
          const thoughts: string[] = [];
          const result = await native.chatComplete(messages, {
            model,
            stream,
            tools,
            toolChoice: "required",
            reasoningEffort,
            captureReasoning: true,
            maxTokens: 128_000,
            temperature: 0.7,
            topP: 0.8,
            topK: 32,
            onToken: (token) => {
              text.push(token);
            },
            onThinking: (thought) => {
              thoughts.push(thought);
            },
          });
          assert.equal(result.content, "Hello Mari");
          assert.equal(thoughts.join(""), "Reasoned.");
          if (stream) assert.deepEqual(text, ["Hello ", "Mari"]);
          const body = requests.at(-1)!;
          assert.equal(body.model, model);
          assert.equal(body.max_tokens, 128_000);
          assert.deepEqual(body.thinking, { type: "adaptive", display: "summarized" });
          assert.equal(body.output_config.effort, reasoningEffort === "none" ? "low" : (reasoningEffort ?? "medium"));
          for (const sampler of ["temperature", "top_p", "top_k"]) assert.equal(sampler in body, false);
          assert.deepEqual(body.tool_choice, tools ? { type: "auto" } : undefined);
        }
      }
    }
  });

  await test("explicit effort works without thought capture; disabled controls preserve provider defaults", async () => {
    for (const tools of [undefined, [tool]]) {
      await native.chatComplete(messages, { model, stream: false, tools, maxTokens: 200 });
      assert.equal(requests.at(-1)!.output_config.effort, "medium");
      assert.ok(requests.at(-1)!.max_tokens > 200, "connection pings retain output room for mandatory thinking");
      await native.chatComplete(messages, { model, stream: false, tools, reasoningEffort: "xhigh" });
      assert.equal(requests.at(-1)!.output_config.effort, "xhigh");
      await native.chatComplete(messages, {
        model,
        stream: false,
        tools,
        reasoningEffort: "xhigh",
        enabledParameters: { reasoningEffort: false },
      });
      assert.equal(requests.at(-1)!.output_config, undefined);
      assert.equal(requests.at(-1)!.thinking, undefined);
      await native.chatComplete(messages, {
        model: "claude-opus-5",
        stream: false,
        tools,
        reasoningEffort: "none",
        captureReasoning: true,
        toolChoice: "required",
      });
      assert.deepEqual(requests.at(-1)!.thinking, { type: "disabled" });
      assert.deepEqual(requests.at(-1)!.tool_choice, tools ? { type: "any" } : undefined);
      await native.chatComplete(messages, {
        model: "claude-fable-5",
        stream: false,
        tools,
        reasoningEffort: "none",
        captureReasoning: true,
      });
      assert.equal(
        requests.at(-1)!.output_config.effort,
        "low",
        "other mandatory-thinking models honor the lightest effort",
      );
    }
  });

  await test("mandatory thinking headroom respects the connection's output cap", async () => {
    const capped = new AnthropicProvider(`${baseUrl}/anthropic`, "fixture", undefined, undefined, 512);
    for (const tools of [undefined, [tool]]) {
      await capped.chatComplete(messages, { model, stream: false, tools, maxTokens: 4096, reasoningEffort: "max" });
      assert.equal(requests.at(-1)!.max_tokens, 512);
    }
  });

  await test("legacy custom budgets are normalized, structured output survives, continuation preserves history", async () => {
    const customParameters = {
      thinking: { type: "enabled", budget_tokens: 2000 },
      output_config: { format: { type: "json_schema", schema: { type: "object", properties: {} } } },
      temperature: 0.4,
      top_p: 0.8,
      top_k: 8,
    };
    const original = structuredClone(customParameters);
    const history: ChatMessage[] = [
      ...messages,
      { role: "system", content: "Depth instruction" },
      { role: "assistant", content: "The door " },
    ];
    for (const tools of [undefined, [tool]]) {
      await native.chatComplete(history, { model, stream: false, tools, customParameters, captureReasoning: true });
      const body = requests.at(-1)!;
      assert.deepEqual(body.thinking, { type: "adaptive", display: "summarized" });
      assert.deepEqual(body.output_config, { ...customParameters.output_config, effort: "medium" });
      assert.equal(body.messages[1].role, "system", "depth system instruction retains its position");
      assert.equal(body.messages.at(-1).role, "user", "no rejected assistant prefill");
      assert.ok(JSON.stringify(body.messages).includes("The door "));
      assert.equal(body.temperature, undefined);
      assert.deepEqual(customParameters, original, "stored parameters are not mutated");
      await native.chatComplete(messages, {
        model,
        stream: false,
        tools,
        customParameters: { thinking: { type: "disabled" } },
      });
      assert.deepEqual(requests.at(-1)!.thinking, { type: "adaptive", display: "summarized" });
    }
    assert.equal(history.at(-1)!.content, "The door ");
  });

  await test("OpenRouter and OAI-compatible gateways retain effort and tools without disabling mandatory reasoning", async () => {
    for (const kind of ["openrouter", "custom", "nanogpt"] as const) {
      const provider = new OpenAIProvider(`${baseUrl}/proxy/v1`, "fixture", undefined, undefined, undefined, kind);
      for (const stream of [false, true]) {
        for (const reasoningEffort of ["none", "xhigh"] as const) {
          const options: ChatOptions = {
            model: kind === "openrouter" ? "anthropic/claude-opus-5.5" : model,
            stream,
            reasoningEffort,
            temperature: 0.5,
            topP: 0.8,
            tools: [tool],
            toolChoice: "required",
            onToken: () => {},
          };
          assert.equal(
            (await provider.chatComplete([...messages, { role: "assistant", content: "The door" }], options)).content,
            "Hello Mari",
          );
          const body = requests.at(-1)!;
          const effort = reasoningEffort === "none" ? "low" : reasoningEffort;
          assert.equal(kind === "openrouter" ? body.reasoning.effort : body.reasoning_effort, effort);
          assert.equal(body.tool_choice, "auto");
          assert.deepEqual(body.tools, [tool]);
          assert.equal(body.temperature, undefined);
          assert.equal(body.top_p, undefined);
          assert.equal(body.chat_template_kwargs, undefined, "local proxy URLs must not disable mandatory thinking");
          assert.equal(body.messages.at(-1).role, "user");
          const chunks: string[] = [];
          for await (const chunk of provider.chat(messages, options)) chunks.push(chunk);
          assert.equal(chunks.join(""), "Hello Mari");
          assert.equal(requests.at(-1)!.tool_choice, "auto");
        }
      }
    }
  });

  await test("subscription uses adaptive thinking and never sends manual budgets or a disabled thinking mode", async () => {
    let sdkOptions: Record<string, any> = {};
    __setSdkForTesting({
      query: ((args: { options: Record<string, unknown> }) => {
        sdkOptions = args.options;
        return (async function* () {
          yield {
            type: "stream_event",
            event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hello Mari" } },
          };
          yield {
            type: "result",
            subtype: "success",
            result: "",
            usage: { input_tokens: 12, output_tokens: 8 },
            modelUsage: { [model]: {} },
            fast_mode_state: "off",
          };
        })();
      }) as never,
    });
    try {
      const provider = new ClaudeSubscriptionProvider("", "");
      await provider.chatComplete(messages, { model, stream: true });
      assert.equal(sdkOptions.effort, "medium", "subscription requests use the documented default explicitly");
      await provider.chatComplete(messages, { model, stream: true, enabledParameters: { reasoningEffort: false } });
      assert.equal(sdkOptions.effort, undefined, "the connection can omit the effort parameter");
      for (const reasoningEffort of [undefined, "none", "max"] as const) {
        await provider.chatComplete(messages, {
          model,
          stream: true,
          reasoningEffort,
          enableThinking: true,
          captureReasoning: true,
        });
        assert.deepEqual(sdkOptions.thinking, { type: "adaptive", display: "summarized" });
        assert.equal(sdkOptions.effort, reasoningEffort === "none" ? "low" : (reasoningEffort ?? "medium"));
      }
      await provider.chatComplete(messages, {
        model,
        stream: true,
        customParameters: {
          thinking: { type: "enabled", budgetTokens: 2000 },
          maxThinkingTokens: 2000,
          effort: "none",
        },
      });
      assert.deepEqual(sdkOptions.thinking, { type: "adaptive" });
      assert.equal(sdkOptions.effort, "low");
      assert.equal(sdkOptions.maxThinkingTokens, undefined);
    } finally {
      __setSdkForTesting(null);
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
