import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";

const requests: Array<{ input: Array<Record<string, unknown>>; stream?: boolean }> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as (typeof requests)[number];
  requests.push(body);
  const round = requests.length;
  const reasoning = { type: "reasoning", id: `rs_${round}`, encrypted_content: `signed-${round}`, summary: [] };
  const call = { type: "function_call", id: `fc_${round}`, call_id: `fc_${round}`, name: "lookup", arguments: "{}" };
  const result = { status: "completed", output: [reasoning, call] };
  if (body.stream) {
    response.setHeader("content-type", "text/event-stream");
    const events = [
      { type: "response.output_item.done", item: reasoning },
      { type: "response.output_item.done", item: call },
      { type: "response.completed", response: result },
    ];
    response.end(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  } else {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "synthetic",
    undefined,
    undefined,
    undefined,
    "openai",
  );
  for (const stream of [false, true]) {
    requests.length = 0;
    const messages: ChatMessage[] = [{ role: "user", content: "Perform two lookups." }];
    let latestReasoning: unknown[] = [];
    for (let round = 1; round <= 3; round++) {
      const result = await provider.chatComplete(messages, {
        model: "gpt-6-astra",
        reasoningEffort: "medium",
        stream,
        encryptedReasoningItems: latestReasoning,
        onEncryptedReasoning: (items) => {
          latestReasoning = items;
        },
      });
      assert.deepEqual(
        result.providerMetadata?.encryptedReasoning,
        [
          {
            type: "reasoning",
            id: `rs_${round}`,
            encrypted_content: `signed-${round}`,
            summary: [],
          },
        ],
        "Both streaming and non-streaming tool results must retain their signed reasoning",
      );
      messages.push({
        role: "assistant",
        content: result.content ?? "",
        tool_calls: result.toolCalls,
        providerMetadata: result.providerMetadata,
      });
      messages.push({ role: "tool", content: `lookup ${round}`, tool_call_id: `fc_${round}` });
    }
    assert.deepEqual(
      requests[2]?.input.map((item) => item.id ?? item.output ?? item.content),
      ["Perform two lookups.", "rs_1", "fc_1", "lookup 1", "rs_2", "fc_2", "lookup 2"],
      "Reasoning must remain before its own tool call across multiple rounds, without legacy duplicates",
    );
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Responses tool reasoning regression passed");
