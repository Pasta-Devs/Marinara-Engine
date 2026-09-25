import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";

// Public DeepSeek Chat Completions shape; synthetic local responses, no live API call.
let visibleText = "The experiment is ready.";
let combined = false;
const server = createServer(async (request, response) => {
  let input = "";
  for await (const chunk of request) input += chunk;
  const body = JSON.parse(input);
  assert.equal(body.model, "deepseek-flash");
  const usage = { prompt_tokens: 20, completion_tokens: 56, completion_tokens_details: { reasoning_tokens: 50 } };
  if (!body.stream) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          { message: { reasoning_content: "Checking the scene.", content: visibleText }, finish_reason: "stop" },
        ],
        usage,
      }),
    );
    return;
  }
  const deltas = combined
    ? [{ reasoning_content: "Checking the scene.", content: visibleText }]
    : [{ reasoning_content: "Checking the scene.", content: null }, { content: visibleText }];
  response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
  for (const delta of deltas)
    response.write(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`);
  response.end(
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage })}\n\ndata: [DONE]\n\n`,
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(
    `http://127.0.0.1:${address.port}/v1`,
    "fixture",
    undefined,
    undefined,
    undefined,
    "custom",
  );
  for (const text of ["The experiment is ready.", ""]) {
    visibleText = text;
    for (const captureThinking of [false, true]) {
      for (const wire of ["separate", "combined", "non-stream"] as const) {
        combined = wire === "combined";
        let thinking = "";
        const options = {
          model: "deepseek-flash",
          stream: wire !== "non-stream",
          ...(captureThinking
            ? {
                onThinking: (chunk: string) => {
                  thinking += chunk;
                },
              }
            : {}),
        };
        let streamed = "";
        const complete = await provider.chatComplete([{ role: "user", content: "Continue." }], {
          ...options,
          onToken:
            wire !== "non-stream"
              ? (chunk) => {
                  streamed += chunk;
                }
              : undefined,
        });
        assert.equal(complete.content ?? "", text);
        assert.equal(complete.finishReason, "stop");
        assert.equal(complete.usage?.completionReasoningTokens, 50);
        if (wire !== "non-stream") assert.equal(streamed, text);
        assert.equal(thinking, captureThinking ? "Checking the scene." : "");
        thinking = "";
        let chatText = "";
        for await (const chunk of provider.chat([{ role: "user", content: "Continue." }], options)) chatText += chunk;
        assert.equal(chatText, text, "capturing reasoning must never discard or promote the visible answer");
        assert.equal(thinking, captureThinking ? "Checking the scene." : "");
      }
    }
  }
  console.info("DeepSeek-shaped reasoning/content fixture passed for both provider entry points.");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
