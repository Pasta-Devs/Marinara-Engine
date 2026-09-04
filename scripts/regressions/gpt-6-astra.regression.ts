import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  findKnownModel,
  isOpenAIGpt6AstraModel,
  resolveProviderReasoningEffort,
  shouldSuppressUnknownModelParameters,
} from "../../packages/shared/src/constants/model-lists.js";
import { resolveStoredChatOptions } from "../../packages/server/src/services/generation/generation-parameters.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";

// Ground truth: https://developers.openai.com/api/docs/models/gpt-6-astra
// and https://developers.openai.com/api/docs/guides/latest-model (Astra migration).
assert.deepEqual(findKnownModel("openai", "gpt-6-astra"), {
  id: "gpt-6-astra",
  name: "gpt-6-astra",
  context: 1050000,
  maxOutput: 128000,
});
assert.equal(shouldSuppressUnknownModelParameters("openai", "gpt-6-astra"), false);
assert.equal(isOpenAIGpt6AstraModel("GPT-6-ASTRA"), true);
assert.equal(isOpenAIGpt6AstraModel("gpt-6-astral-local"), false);
for (const [stored, expected] of [
  ["low", "low"],
  ["medium", "medium"],
  ["high", "high"],
  ["xhigh", "xhigh"],
  ["maximum", "max"],
  ["max", "max"],
] as const) {
  assert.equal(
    resolveProviderReasoningEffort({ provider: "openai", model: "gpt-6-astra", reasoningEffort: stored }),
    expected,
  );
}

const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
const toolCall = {
  type: "function_call",
  id: "fc_astra",
  call_id: "call_astra",
  name: "lookup",
  arguments: '{"query":"scene"}',
};
const reasoningItem = {
  type: "reasoning",
  id: "rs_astra",
  encrypted_content: "opaque",
  summary: [{ type: "summary_text", text: "Checked the scene." }],
};
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  requests.push({ url: request.url ?? "", body });
  if (request.url === "/v1/chat/completions") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: "Astra reply" }, finish_reason: "stop" }] }));
    return;
  }
  const output = [
    reasoningItem,
    ...(Array.isArray(body.tools) && body.tools.length ? [toolCall] : []),
    { type: "message", id: "msg_astra", role: "assistant", content: [{ type: "output_text", text: "Astra reply" }] },
  ];
  const result = {
    status: "completed",
    output,
    usage: { input_tokens: 10, output_tokens: 8, total_tokens: 18, output_tokens_details: { reasoning_tokens: 3 } },
  };
  if (body.stream) {
    const events = [
      { type: "response.output_text.delta", delta: "Astra reply" },
      ...output.map((item) => ({ type: "response.output_item.done", item })),
      { type: "response.completed", response: result },
    ];
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const provider = new OpenAIProvider(baseUrl, "test", undefined, undefined, undefined, "openai");
  const messages: ChatMessage[] = [
    { role: "system", content: "Keep <scene> verbatim." },
    { role: "user", content: "Describe this scene.", images: ["data:image/png;base64,aW1hZ2U="] },
  ];
  const storedOptions = resolveStoredChatOptions({ reasoningEffort: "maximum" }, "openai", "gpt-6-astra");
  assert.equal(storedOptions.reasoningEffort, "max", "connection Maximum must reach the provider as max");

  // Both public entrypoints must use Responses with and without streaming.
  for (const stream of [false, true]) {
    for (const method of ["chat", "chatComplete"] as const) {
      for (const effort of [undefined, "none", "low", "medium", "high", "xhigh", "max"] as const) {
        let thinking = "";
        const options: ChatOptions = {
          model: "gpt-6-astra",
          stream,
          reasoningEffort: effort,
          temperature: 0.7,
          topP: 0.8,
          maxTokens: 512,
          verbosity: "low",
          excludePastReasoning: false,
          customParameters: {
            temperature: 0.9,
            top_p: 0.9,
            logprobs: true,
            top_logprobs: 3,
            include: ["reasoning.encrypted_content", "message.output_text.logprobs"],
          },
          onThinking: (chunk) => {
            thinking += chunk;
          },
        };
        let content = "";
        if (method === "chat") {
          for await (const chunk of provider.chat(messages, options)) content += chunk;
        } else {
          const result = await provider.chatComplete(messages, options);
          content = result.content;
          assert.equal(result.usage?.completionReasoningTokens, 3);
        }
        assert.equal(content, "Astra reply");
        assert.equal(thinking, "Checked the scene.");
        const sent = requests.at(-1)!;
        assert.equal(sent.url, "/v1/responses");
        assert.equal(sent.body.model, "gpt-6-astra");
        assert.equal(sent.body.stream, stream);
        assert.equal(sent.body.store, false);
        assert.equal(sent.body.max_output_tokens, 512);
        assert.equal(sent.body.instructions, "Keep <scene> verbatim.");
        assert.deepEqual(sent.body.input, [
          {
            role: "user",
            content: [
              { type: "input_text", text: "Describe this scene." },
              { type: "input_image", image_url: "data:image/png;base64,aW1hZ2U=" },
            ],
          },
        ]);
        assert.deepEqual(sent.body.reasoning, {
          ...(effort ? { effort: effort === "none" ? "low" : effort } : {}),
          context: "all_turns",
          ...(effort !== "none" ? { summary: "auto" } : {}),
        });
        assert.deepEqual(sent.body.text, { verbosity: "low" });
        assert.deepEqual(sent.body.include, ["reasoning.encrypted_content"]);
        for (const key of ["temperature", "top_p", "logprobs", "top_logprobs"])
          assert.equal(key in sent.body, false, `${method} must omit ${key}`);
      }
    }
  }

  // Enabled-parameter toggles leave the provider's default reasoning untouched.
  await provider.chatComplete(messages, {
    model: "gpt-6-astra",
    stream: false,
    reasoningEffort: "none",
    enabledParameters: { reasoningEffort: false },
  });
  assert.equal("reasoning" in requests.at(-1)!.body, false);
  assert.equal("include" in requests.at(-1)!.body, false);

  // Tools and replay use the existing Responses contract, including matching call IDs.
  for (const stream of [false, true]) {
    const result = await provider.chatComplete(messages, {
      model: "gpt-6-astra",
      stream,
      ...storedOptions,
      toolChoice: "required",
      tools: [
        {
          type: "function",
          function: {
            name: "lookup",
            description: "Look up a scene",
            parameters: { type: "object", properties: { query: { type: "string" } } },
          },
        },
      ],
    });
    assert.equal(requests.at(-1)!.url, "/v1/responses");
    assert.equal(requests.at(-1)!.body.tool_choice, "required");
    assert.deepEqual(result.toolCalls, [
      { id: "call_astra", type: "function", function: { name: "lookup", arguments: '{"query":"scene"}' } },
    ]);
    await provider.chatComplete(
      [
        ...messages,
        { role: "assistant", content: result.content, tool_calls: result.toolCalls },
        { role: "tool", content: "Scene found", tool_call_id: result.toolCalls[0].id },
      ],
      {
        model: "gpt-6-astra",
        stream,
        reasoningEffort: "high",
        excludePastReasoning: true,
        encryptedReasoningItems: [reasoningItem],
      },
    );
    const replay = requests.at(-1)!.body.input as Array<Record<string, unknown>>;
    assert.deepEqual(
      replay.find((item) => item.type === "reasoning"),
      reasoningItem,
    );
    assert.equal(
      replay.find((item) => item.type === "function_call")?.call_id,
      replay.find((item) => item.type === "function_call_output")?.call_id,
    );
    assert.deepEqual(requests.at(-1)!.body.reasoning, { effort: "high", context: "current_turn", summary: "auto" });
  }

  // Custom gateways retain their Chat Completions contract and explicit escape hatch.
  const custom = new OpenAIProvider(baseUrl, "test", undefined, undefined, undefined, "custom");
  await custom.chatComplete(messages, {
    model: "gpt-6-astra",
    stream: false,
    reasoningEffort: "none",
    temperature: 0.7,
    maxTokens: 512,
  });
  assert.equal(requests.at(-1)!.url, "/v1/chat/completions");
  assert.equal(requests.at(-1)!.body.reasoning_effort, "low");
  assert.equal(requests.at(-1)!.body.max_completion_tokens, 512);
  assert.equal("temperature" in requests.at(-1)!.body, false);
  await custom.chatComplete(messages, { model: "gpt-6-astra", stream: false, customParameters: { temperature: 0.4 } });
  assert.equal(requests.at(-1)!.body.temperature, 0.4);

  // Older native models keep their existing Chat Completions behavior.
  await provider.chatComplete(messages, { model: "gpt-4.1", stream: false, temperature: 0.7 });
  assert.equal(requests.at(-1)!.url, "/v1/chat/completions");
  assert.equal(requests.at(-1)!.body.temperature, 0.7);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log("GPT-6 Astra provider regressions passed.");
