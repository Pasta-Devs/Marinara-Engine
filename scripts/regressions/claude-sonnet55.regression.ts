import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  findKnownModel,
  isClaudeSonnet55Model,
  isClaudeStrictRequestModel,
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

// Ground truth: https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5
// "disabled" thinking, forced tool choice and non-default sampling return 400; between_tools
// skips up-front thinking up to high effort. Wire-level fixtures; no paid calls or credentials.
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
const model = "claude-sonnet-5-5";
const native = new AnthropicProvider(`${baseUrl}/anthropic`, "fixture");

try {
  await test("Sonnet 5.5 is selectable with correct limits, including dotted gateway IDs", () => {
    for (const [provider, id] of [
      ["anthropic", model],
      ["claude_subscription", model],
      ["custom", model],
      ["openrouter", "anthropic/claude-sonnet-5.5"],
      ["openrouter", "anthropic/claude-sonnet-5.5:batch"],
      ["nanogpt", "claude-sonnet-5.5"],
    ] as const) {
      assert.equal(findKnownModel(provider, id)?.context, 1_000_000, `${provider} ${id}`);
      assert.equal(findKnownModel(provider, id)?.maxOutput, 128_000);
      assert.equal(shouldSuppressUnknownModelParameters(provider, id), false);
    }
    assert.equal(findKnownModel("custom", "claude-sonnet-5.50"), undefined);
    assert.equal(isClaudeSonnet55Model("anthropic/claude-sonnet-5.5"), true);
    assert.equal(isClaudeStrictRequestModel(model), true);
    assert.equal(isClaudeStrictRequestModel("claude-sonnet-5"), false);
    assert.equal(resolveProviderReasoningEffort({ provider: "anthropic", model, reasoningEffort: "maximum" }), "max");
    assert.equal(resolveProviderReasoningEffort({ provider: "anthropic", model, reasoningEffort: "xhigh" }), "xhigh");
  });

  await test("native requests use adaptive thinking, default high effort, no samplers and automatic tool choice", async () => {
    for (const stream of [false, true]) {
      for (const tools of [undefined, [tool]]) {
        for (const reasoningEffort of [undefined, "low", "medium", "high", "xhigh", "max"] as const) {
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
          });
          assert.equal(result.content, "Hello Mari");
          const body = requests.at(-1)!;
          assert.equal(body.model, model);
          assert.deepEqual(body.thinking, { type: "adaptive", display: "summarized" });
          assert.equal(body.output_config.effort, reasoningEffort ?? "high");
          for (const sampler of ["temperature", "top_p", "top_k"]) assert.equal(sampler in body, false);
          assert.deepEqual(body.tool_choice, tools ? { type: "auto" } : undefined);
        }
      }
    }
  });

  await test("native Off skips up-front thinking with between_tools, never disabled", async () => {
    for (const tools of [undefined, [tool]]) {
      await native.chatComplete(messages, {
        model,
        stream: false,
        tools,
        toolChoice: "required",
        reasoningEffort: "none",
        captureReasoning: true,
        temperature: 0.7,
      });
      const body = requests.at(-1)!;
      assert.deepEqual(body.thinking, { type: "between_tools" }, "between_tools takes no other field");
      assert.equal(body.output_config?.effort, undefined, "the API default (high) accepts between_tools");
      assert.equal("temperature" in body, false);
      assert.deepEqual(body.tool_choice, tools ? { type: "auto" } : undefined);
      await native.chatComplete(messages, {
        model,
        stream: false,
        tools,
        customParameters: { thinking: { type: "disabled" } },
      });
      assert.deepEqual(requests.at(-1)!.thinking, { type: "between_tools" }, "saved disabled thinking is translated");
      await native.chatComplete(messages, {
        model,
        stream: false,
        tools,
        reasoningEffort: "xhigh",
        captureReasoning: true,
        customParameters: { thinking: { type: "disabled" } },
      });
      assert.equal(requests.at(-1)!.thinking.type, "adaptive", "between_tools is rejected above high effort");
      assert.equal(requests.at(-1)!.output_config.effort, "xhigh");
    }
    // Claude Sonnet 5 still accepts "disabled".
    await native.chatComplete(messages, { model: "claude-sonnet-5", stream: false, reasoningEffort: "none" });
    assert.deepEqual(requests.at(-1)!.thinking, { type: "disabled" });
  });

  await test("continuation avoids prefill and history system messages keep their position", async () => {
    const history: ChatMessage[] = [
      ...messages,
      { role: "system", content: "Depth instruction" },
      { role: "assistant", content: "The door " },
    ];
    await native.chatComplete(history, { model, stream: false, captureReasoning: true });
    const body = requests.at(-1)!;
    assert.equal(body.messages[1].role, "system", "Sonnet 5.5 accepts mid-conversation system messages");
    assert.equal(body.messages.at(-1).role, "user", "no rejected assistant prefill");
    assert.ok(JSON.stringify(body.messages).includes("The door "));
    // Proxies behind a custom Anthropic base URL may namespace or suffix the ID.
    for (const id of ["anthropic/claude-sonnet-5-5", "claude-sonnet-5-5-20260928", "anthropic/claude-opus-5-5"]) {
      await native.chatComplete(history, { model: id, stream: false });
      assert.equal(requests.at(-1)!.messages[1].role, "system", `${id} keeps history system messages`);
    }
    await native.chatComplete(history, { model: "claude-sonnet-5", stream: false });
    const sonnet5 = requests.at(-1)!.messages as Array<{ role: string; content: unknown }>;
    assert.equal(
      sonnet5.some((message) => message.role === "system"),
      false,
      "Sonnet 5 has no history system role",
    );
    assert.ok(
      sonnet5.some(
        (message) => message.role === "user" && JSON.stringify(message.content).includes("Depth instruction"),
      ),
      "Sonnet 5 keeps the instruction as user context",
    );
  });

  await test("OpenRouter and OAI-compatible gateways never send a thinking disable, samplers or forced tools", async () => {
    for (const kind of ["openrouter", "custom", "nanogpt"] as const) {
      const provider = new OpenAIProvider(`${baseUrl}/proxy/v1`, "fixture", undefined, undefined, undefined, kind);
      for (const reasoningEffort of ["none", "xhigh"] as const) {
        const options: ChatOptions = {
          model: kind === "openrouter" ? "anthropic/claude-sonnet-5.5" : model,
          stream: false,
          reasoningEffort,
          temperature: 0.5,
          customParameters: { temperature: 0.6, top_p: 0.9, top_k: 20 },
          tools: [tool],
          toolChoice: "required",
        };
        await provider.chatComplete([...messages, { role: "assistant", content: "The door" }], options);
        const body = requests.at(-1)!;
        const effort = reasoningEffort === "none" ? "low" : reasoningEffort;
        assert.equal(kind === "openrouter" ? body.reasoning.effort : body.reasoning_effort, effort, kind);
        if (kind === "openrouter") assert.equal(body.reasoning.enabled, undefined);
        assert.equal(body.tool_choice, "auto");
        for (const sampler of ["temperature", "top_p", "top_k"])
          assert.equal(sampler in body, false, `${kind} ${sampler}`);
        assert.equal(body.messages.at(-1).role, "user");
      }
    }
  });

  await test("subscription Off runs adaptive at low effort because the Agent SDK cannot send between_tools", async () => {
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
      for (const reasoningEffort of [undefined, "none", "max"] as const) {
        await provider.chatComplete(messages, { model, stream: true, reasoningEffort, captureReasoning: true });
        assert.deepEqual(sdkOptions.thinking, { type: "adaptive", display: "summarized" });
        assert.equal(sdkOptions.effort, reasoningEffort === "none" ? "low" : (reasoningEffort ?? "high"));
      }
      await provider.chatComplete(messages, {
        model,
        stream: true,
        customParameters: { thinking: { type: "disabled" }, effort: "none" },
      });
      assert.deepEqual(sdkOptions.thinking, { type: "adaptive" });
      assert.equal(sdkOptions.effort, "low");
    } finally {
      __setSdkForTesting(null);
    }
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
