// Engine callers (agent executor, advanced memory, game routes) pass
// reasoningEffort "none" or enableThinking false. On a NanoGPT connection a
// GLM 5.3 model must never receive a reasoning disable: NanoGPT answers 400
// "GLM 5.3 always thinks and does not support disabling reasoning."
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";
import { resetReasoningDisableRejectionsForTests } from "../../packages/server/src/services/llm/providers/reasoning-disable-rejection.js";

type Body = Record<string, unknown> & { stream?: boolean; model: string };
const requests: Body[] = [];

function disablesReasoning(body: Body): boolean {
  const reasoning = body.reasoning as Record<string, unknown> | undefined;
  const thinking = body.thinking as Record<string, unknown> | undefined;
  return (
    body.enable_thinking === false ||
    thinking?.type === "disabled" ||
    body.reasoning_effort === "none" ||
    reasoning?.enabled === false ||
    reasoning?.effort === "none"
  );
}

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Body;
  requests.push(body);
  if (disablesReasoning(body)) {
    response.statusCode = 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ error: { message: "GLM 5.3 always thinks and does not support disabling reasoning." } }),
    );
    return;
  }
  if (body.stream) {
    response.setHeader("content-type", "text/event-stream");
    response.end(
      [
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: "assistant", content: "ok" } }] })}\n\n`,
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`,
        "data: [DONE]\n\n",
      ].join(""),
    );
    return;
  }
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }] }),
  );
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const messages: ChatMessage[] = [{ role: "user", content: "Summarize the scene." }];
  const callerOptions: Array<{ label: string; options: Partial<ChatOptions> }> = [
    { label: "reasoningEffort none", options: { reasoningEffort: "none" } },
    { label: "enableThinking false", options: { enableThinking: false } },
    { label: "both off", options: { reasoningEffort: "none", enableThinking: false } },
  ];
  for (const model of ["glm-5.3", "zai-org/glm-5.3", "zai-org/glm-5.3-flash", "zai-org/glm-5.3:thinking"]) {
    for (const { label, options } of callerOptions) {
      for (const stream of [false, true]) {
        for (const method of ["chat", "chatComplete"] as const) {
          resetReasoningDisableRejectionsForTests();
          requests.length = 0;
          const provider = createLLMProvider("nanogpt", baseUrl, "stub-key");
          const requestOptions: ChatOptions = { model, stream, maxTokens: 64, ...options };
          if (method === "chatComplete") {
            const result = await provider.chatComplete(messages, requestOptions);
            assert.equal(result.content, "ok");
          } else {
            let text = "";
            for await (const token of provider.chat(messages, requestOptions)) text += token;
            assert.equal(text, "ok");
          }
          const where = `${model} ${label} ${method} stream=${stream}`;
          assert.equal(requests.length, 1, `${where}: one request, no rejection and no retry`);
          const body = requests[0]!;
          assert.equal(body.enable_thinking, true, `${where}: GLM 5.3 on NanoGPT always sends enable_thinking true`);
          assert.notEqual(body.reasoning_effort, "none", `${where}: no reasoning_effort "none"`);
          assert.equal(disablesReasoning(body), false, `${where}: no reasoning-disable field of any dialect`);
        }
      }
    }
  }
} finally {
  resetReasoningDisableRejectionsForTests();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("GLM 5.3 NanoGPT reasoning-off regression passed");
