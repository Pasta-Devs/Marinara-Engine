import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage, LLMToolDefinition } from "../../packages/server/src/services/llm/base-provider.js";
import { findKnownModel, resolveProviderReasoningEffort } from "../../packages/shared/src/constants/model-lists.js";

const requests: Array<{ path: string; body: Record<string, any> }> = [];
const preamble = "I'll pull a live news snapshot. ";
const answer = "The completed answer after the search.";
const webSearch: LLMToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  requests.push({ path: req.url!, body });
  const responses = req.url === "/v1/responses";
  const searched = responses
    ? body.input?.some((item: Record<string, unknown>) => item.type === "function_call_output")
    : body.messages?.some((item: Record<string, unknown>) => item.role === "tool");
  const canSearch = body.tools?.some(
    (tool: Record<string, any>) => (tool.name ?? tool.function?.name) === "web_search",
  );
  const text = searched ? answer : preamble;
  const reasoning = { type: "reasoning", id: searched ? "r2" : "r1", encrypted_content: "synthetic", summary: [] };
  const message = { type: "message", role: "assistant", content: [{ type: "output_text", text }] };
  const call = {
    type: "function_call",
    id: "fc1",
    call_id: "fc_search1",
    name: "web_search",
    arguments: '{"query":"news"}',
  };
  const output = searched || !canSearch ? [reasoning, message] : [reasoning, message, call];
  if (!responses) {
    const toolCalls =
      searched || !canSearch
        ? []
        : [{ id: "fc_search1", type: "function", function: { name: "web_search", arguments: call.arguments } }];
    const finishReason = toolCalls.length ? "tool_calls" : "stop";
    const usage = { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 };
    if (body.stream) {
      res.setHeader("content-type", "text/event-stream");
      const events = [
        { choices: [{ delta: { content: text, tool_calls: toolCalls.map((item, index) => ({ ...item, index })) } }] },
        { choices: [{ delta: {}, finish_reason: finishReason }], usage },
      ];
      res.end(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n");
    } else {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            { message: { role: "assistant", content: text, tool_calls: toolCalls }, finish_reason: finishReason },
          ],
          usage,
        }),
      );
    }
    return;
  }
  const result = { status: "completed", output, usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 } };
  if (body.stream) {
    res.setHeader("content-type", "text/event-stream");
    const events = [
      { type: "response.output_text.delta", delta: text },
      ...output.map((item) => ({ type: "response.output_item.done", item })),
      { type: "response.completed", response: result },
    ];
    res.end(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  } else {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(result));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const baseUrl = `http://127.0.0.1:${addr.port}/v1`;
  const provider = new OpenAIProvider(baseUrl, "synthetic", undefined, undefined, undefined, "xai");
  for (const model of ["grok-4.6", "grok-4.7"]) {
    for (const captureReasoning of [false, true]) {
      for (const stream of [false, true]) {
        requests.length = 0;
        let streamed = "";
        const options = {
          model,
          stream,
          captureReasoning,
          tools: [webSearch],
          reasoningEffort: "xhigh" as const,
          maxTokens: 20000,
          stop: ["END"],
          frequencyPenalty: 0.5,
          onToken: stream
            ? (chunk: string) => {
                streamed += chunk;
              }
            : undefined,
        };
        const messages: ChatMessage[] = [{ role: "user", content: "Search the latest news and explain it." }];
        const first = await provider.chatComplete(messages, options);
        assert.equal(requests[0]?.path, captureReasoning ? "/v1/responses" : "/v1/chat/completions");
        assert.equal(first.content, preamble);
        assert.equal(first.finishReason, "tool_calls", "a search preamble does not end the turn");
        assert.equal(first.toolCalls[0]?.function.name, "web_search");
        assert.deepEqual(
          requests[0]?.body.tools,
          captureReasoning ? [{ type: "function", ...webSearch.function }] : [webSearch],
          "reuse the Engine's existing search tool",
        );
        assert.deepEqual(
          captureReasoning ? requests[0]?.body.reasoning : requests[0]?.body.reasoning_effort,
          captureReasoning ? { effort: "xhigh" } : "xhigh",
        );
        assert.equal(requests[0]?.body[captureReasoning ? "max_output_tokens" : "max_tokens"], 20000);
        assert.equal(requests[0]?.body.stop, undefined);
        assert.equal(requests[0]?.body.frequency_penalty, undefined);
        messages.push({
          role: "assistant",
          content: first.content!,
          tool_calls: first.toolCalls,
          providerMetadata: first.providerMetadata,
        });
        messages.push({
          role: "tool",
          tool_call_id: "fc_search1",
          content: '{"results":[{"title":"News","url":"https://example.org/news"}]}',
        });
        const final = await provider.chatComplete(messages, options);
        assert.equal(final.content, answer);
        assert.equal(final.finishReason, "stop");
        assert.equal(final.toolCalls.length, 0);
        assert.equal(final.usage?.totalTokens, 50);
        if (captureReasoning) {
          assert.ok(requests[1]?.body.input.some((item: Record<string, unknown>) => item.type === "reasoning"));
          assert.ok(
            requests[1]?.body.input.some(
              (item: Record<string, unknown>) => item.type === "function_call_output" && item.call_id === "fc_search1",
            ),
          );
        } else {
          assert.ok(
            requests[1]?.body.messages.some(
              (item: Record<string, unknown>) => item.role === "tool" && item.tool_call_id === "fc_search1",
            ),
          );
        }
        assert.equal(streamed, stream ? preamble + answer : "");
      }
    }
    assert.equal(findKnownModel("xai", model)?.context, 500000);
    assert.equal(resolveProviderReasoningEffort({ provider: "xai", model, reasoningEffort: "maximum" }), "xhigh");
    const native = provider as unknown as {
      buildResponsesBody(messages: ChatMessage[], options: Record<string, unknown>): Record<string, unknown>;
    };
    assert.equal(
      native.buildResponsesBody([], { model, reasoningEffort: "none" }).reasoning,
      undefined,
      "mandatory reasoning is never disabled on the wire",
    );
  }
  for (const kind of ["custom", "openrouter"] as const) {
    const other = new OpenAIProvider(baseUrl, "", undefined, undefined, undefined, kind) as unknown as {
      useResponsesAPI(model: string): boolean;
    };
    assert.equal(
      other.useResponsesAPI(kind === "openrouter" ? "x-ai/grok-4.7" : "grok-4.7"),
      false,
      "other connection protocols remain unchanged",
    );
  }
  assert.equal(
    resolveProviderReasoningEffort({ provider: "xai", model: "grok-4.5", reasoningEffort: "maximum" }),
    "high",
  );
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
console.info("Grok tool completion regression passed");
