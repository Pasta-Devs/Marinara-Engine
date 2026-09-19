import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";

let sendDone = true;
const server = createServer(async (request, response) => {
  for await (const _chunk of request) {
    /* drain request */
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  const send = (payload: unknown) => response.write(`data: ${JSON.stringify(payload)}\n\n`);
  send({ choices: [{ delta: { reasoning_content: "Checking." } }] });
  send({ choices: [{ delta: { content: "Complete." } }] });
  send({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call-1",
              type: "function",
              function: { name: "update_tracker", arguments: '{"ok":true}' },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  });
  if (sendDone) response.write("data: [DONE]\n\n");
  // Deliberately leave HTTP open: the terminal SSE frame is the completion boundary.
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = new OpenAIProvider(`http://127.0.0.1:${address.port}/v1`, "fixture");
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 750);
  let text = "";
  let thinking = "";
  const completed = await provider.chatComplete([{ role: "user", content: "Continue." }], {
    model: "fixture",
    stream: true,
    signal: controller.signal,
    onToken: (chunk) => {
      text += chunk;
    },
    onThinking: (chunk) => {
      thinking += chunk;
    },
  });
  clearTimeout(timeout);
  assert.equal(timedOut, false, "[DONE] must settle the agent response without waiting for HTTP EOF");
  assert.equal(text, "Complete.");
  assert.equal(thinking, "Checking.");
  assert.equal(completed.content, "Complete.");
  assert.equal(completed.toolCalls[0]?.function.arguments, '{"ok":true}');
  assert.equal(completed.usage?.totalTokens, 13);

  sendDone = false;
  const abort = new AbortController();
  const stalled = provider.chatComplete([{ role: "user", content: "Continue." }], {
    model: "fixture",
    stream: true,
    signal: abort.signal,
    onToken: () => {
      abort.abort();
    },
  });
  let cancellationTimedOut = false;
  const watchdog = setTimeout(() => {
    cancellationTimedOut = true;
    server.closeAllConnections();
  }, 750);
  try {
    // A cancelled reader may return its collected partial response or reject
    // with AbortError. Either must settle before the watchdog closes the socket.
    await stalled.catch((error: unknown) => {
      assert.equal((error as Error).name, "AbortError");
    });
  } finally {
    clearTimeout(watchdog);
  }
  assert.equal(cancellationTimedOut, false, "abort must settle without closing the provider socket externally");
  assert.ok(abort.signal.aborted, "an unfinished provider stream stays cancellable");
  console.info("Terminal provider frames settle agent completions; unfinished streams remain cancellable.");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
