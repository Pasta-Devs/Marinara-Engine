// Safety net for OpenAI-compatible Chat Completions: a model that always reasons
// and rejects a reasoning-off request with HTTP 400 gets one retry without the
// disable fields, and is remembered so later requests skip the disable.
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { logger } from "../../packages/server/src/lib/logger.js";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";
import {
  hasReasoningDisableFields,
  isReasoningDisableRejectedError,
  resetReasoningDisableRejectionsForTests,
  stripReasoningDisableFields,
} from "../../packages/server/src/services/llm/providers/reasoning-disable-rejection.js";

type Body = Record<string, unknown> & { stream?: boolean; model: string };
const requests: Body[] = [];
const ALWAYS_REASONS = "mystery-reasoner-1";
const BAD_PARAMETER = "picky-model-1";
const SERVER_ERROR = "flaky-model-1";

function sendError(response: ServerResponse, status: number, message: string): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ error: { message } }));
}

const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Body;
  requests.push(body);
  if (body.model === ALWAYS_REASONS && hasReasoningDisableFields(body)) {
    sendError(response, 400, "Mystery Reasoner always thinks and does not support disabling reasoning.");
    return;
  }
  if (body.model === BAD_PARAMETER) {
    sendError(response, 400, "Invalid value for reasoning_effort: expected low, medium or high.");
    return;
  }
  if (body.model === SERVER_ERROR) {
    sendError(response, 500, "Cannot disable reasoning right now, upstream failed.");
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

// Pure helpers first.
assert.equal(isReasoningDisableRejectedError("GLM 5.3 always thinks and does not support disabling reasoning."), true);
assert.equal(isReasoningDisableRejectedError("This model cannot disable thinking."), true);
assert.equal(isReasoningDisableRejectedError("Invalid value for reasoning_effort"), false);
assert.equal(isReasoningDisableRejectedError("context length exceeded"), false);
const mixed: Record<string, unknown> = {
  enable_thinking: false,
  thinking: { type: "disabled" },
  reasoning_effort: "none",
  reasoning: { effort: "none", enabled: false, exclude: true },
  temperature: 0.7,
};
assert.equal(hasReasoningDisableFields(mixed), true);
assert.equal(stripReasoningDisableFields(mixed), true);
assert.deepEqual(mixed, { reasoning: { exclude: true }, temperature: 0.7 }, "Only the disabling fields are removed");
assert.equal(hasReasoningDisableFields(mixed), false);
const onlyEffort: Record<string, unknown> = { reasoning: { effort: "none" }, reasoning_effort: "high" };
stripReasoningDisableFields(onlyEffort);
assert.deepEqual(onlyEffort, { reasoning_effort: "high" }, "An emptied reasoning object is dropped; active effort stays");

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
// The unrelated 400/500 cases below log provider failures by design; keep the run quiet.
const priorLevel = logger.level;
logger.level = "silent";
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const messages: ChatMessage[] = [{ role: "user", content: "Continue." }];
  const run = async (method: "chat" | "chatComplete", options: ChatOptions) => {
    const provider = createLLMProvider("nanogpt", baseUrl, "stub-key");
    if (method === "chatComplete") return (await provider.chatComplete(messages, options)).content;
    let text = "";
    for await (const token of provider.chat(messages, options)) text += token;
    return text;
  };

  for (const stream of [false, true]) {
    for (const method of ["chat", "chatComplete"] as const) {
      const where = `${method} stream=${stream}`;
      resetReasoningDisableRejectionsForTests();
      requests.length = 0;
      const options: ChatOptions = { model: ALWAYS_REASONS, reasoningEffort: "none", stream, maxTokens: 64 };
      assert.equal(await run(method, options), "ok", `${where}: the retry succeeds`);
      assert.equal(requests.length, 2, `${where}: exactly one retry after the rejection`);
      assert.equal(requests[0]!.reasoning_effort, "none", `${where}: the first request carried the disable`);
      assert.equal(hasReasoningDisableFields(requests[1]!), false, `${where}: the retry drops every disable field`);
      assert.equal("reasoning_effort" in requests[1]!, false, `${where}: reasoning stays at the provider default`);

      requests.length = 0;
      assert.equal(await run(method, options), "ok", `${where}: a later request to the same model succeeds`);
      assert.equal(requests.length, 1, `${where}: the remembered model makes one call only`);
      assert.equal(hasReasoningDisableFields(requests[0]!), false, `${where}: no disable field is sent any more`);
    }
  }

  // Memory is per base URL and model: another model on the same URL keeps its reasoning-off choice.
  resetReasoningDisableRejectionsForTests();
  await run("chatComplete", { model: ALWAYS_REASONS, reasoningEffort: "none", stream: false, maxTokens: 64 });
  requests.length = 0;
  await run("chatComplete", { model: "plain-model-1", reasoningEffort: "none", stream: false, maxTokens: 64 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.reasoning_effort, "none", "Other models keep the reasoning-off choice");

  // A different 400 is not retried, and the model is not remembered.
  for (const stream of [false, true]) {
    for (const method of ["chat", "chatComplete"] as const) {
      const options: ChatOptions = { model: BAD_PARAMETER, reasoningEffort: "none", stream, maxTokens: 64 };
      requests.length = 0;
      await assert.rejects(run(method, options), /400/);
      assert.equal(requests.length, 1, `${method} stream=${stream}: an unrelated 400 is not retried`);
      requests.length = 0;
      await assert.rejects(run(method, options), /400/);
      assert.equal(requests[0]!.reasoning_effort, "none", "An unrelated 400 does not mark the model");
    }
  }

  // A matching message on a non-400 status is not retried either.
  requests.length = 0;
  await assert.rejects(
    run("chatComplete", { model: SERVER_ERROR, reasoningEffort: "none", stream: false, maxTokens: 64 }),
  );
  assert.equal(requests.length, 1, "Server errors are never retried by this fallback");
  requests.length = 0;
  await run("chatComplete", { model: SERVER_ERROR.replace("flaky", "plain"), reasoningEffort: "none", stream: false });
  assert.equal(requests[0]!.reasoning_effort, "none");
} finally {
  logger.level = priorLevel;
  resetReasoningDisableRejectionsForTests();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("OpenAI reasoning-disable retry regression passed");
