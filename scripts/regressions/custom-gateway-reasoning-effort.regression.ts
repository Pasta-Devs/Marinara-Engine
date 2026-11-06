import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolveProviderReasoningEffort } from "../../packages/shared/src/constants/model-lists.js";
import {
  isCustomGatewayReasoningModel,
  OpenAIProvider,
} from "../../packages/server/src/services/llm/providers/openai.provider.js";

// A generic custom (OpenAI-compatible) connection used to send a reasoning effort only for GPT ids, so Claude, Gemini
// and DeepSeek behind a gateway ran without the level the user picked. Wire-level fixtures; no paid calls.
for (const model of [
  "claude-haiku-5-5",
  "anthropic/claude-sonnet-4-5",
  "claude-3-7-sonnet-20250219",
  "gemini-3.5-flash-lite",
  "google/gemini-2.5-pro",
  "deepseek-v4-flash",
  "deepseek-reasoner",
  "qwen3-235b-a22b-thinking-2507",
  "glm-4.6",
  "kimi-k2-thinking",
  "grok-3-mini",
  "o4-mini",
  "gpt-5.6-terra",
  "gpt-oss-120b",
]) {
  assert.equal(isCustomGatewayReasoningModel(model), true, `${model} takes a reasoning effort`);
}
for (const model of [
  "custom-model",
  "gpt-4o",
  "gpt-5-chat-latest",
  "claude-3-5-sonnet-20241022",
  "gemini-2.0-flash",
  "gemini-2.5-flash-image",
  "deepseek-chat",
  "qwen3-235b-a22b-instruct-2507",
  "grok-4-fast-non-reasoning",
  "llama-3.3-70b",
  "mistral-large-4-0",
]) {
  assert.equal(isCustomGatewayReasoningModel(model), false, `${model} gets no reasoning effort`);
}

const requests: Array<Record<string, unknown>> = [];
let rejectReasoning = false;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push(body);
  if (rejectReasoning && "reasoning_effort" in body) {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Unrecognized request argument supplied: reasoning_effort" } }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
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
  // The fixture listens on loopback, which the provider treats as a local inference server; the case under test is a
  // remote gateway.
  Object.assign(provider, { isLocalInferenceEndpoint: () => false });

  const send = async (model: string, stored: "medium" | "maximum") => {
    requests.length = 0;
    const reasoningEffort = resolveProviderReasoningEffort({ provider: "custom", model, reasoningEffort: stored });
    const result = await provider.chatComplete([{ role: "user", content: "think" }], {
      model,
      stream: false,
      reasoningEffort: reasoningEffort ?? undefined,
      enabledParameters: { reasoningEffort: true },
    });
    assert.equal(result.content, "ok");
    return requests;
  };

  assert.equal((await send("claude-haiku-5-5", "maximum"))[0]?.reasoning_effort, "high");
  assert.equal((await send("gemini-3.5-flash-lite", "medium"))[0]?.reasoning_effort, "medium");
  assert.equal((await send("deepseek-v4-flash", "maximum"))[0]?.reasoning_effort, "high");
  assert.equal((await send("gpt-5.6-terra", "maximum"))[0]?.reasoning_effort, "max", "GPT keeps its own levels");
  assert.equal((await send("gpt-oss-120b", "maximum"))[0]?.reasoning_effort, "high", "gpt-oss takes up to high");
  assert.equal((await send("openai/gpt-oss-120b", "maximum"))[0]?.reasoning_effort, "high");
  assert.equal("reasoning_effort" in (await send("custom-model", "maximum"))[0]!, false, "unknown ids get none");

  // A gateway that refuses the parameter is retried once without it, and the turn still completes.
  rejectReasoning = true;
  const retried = await send("claude-haiku-5-5", "maximum");
  assert.equal(retried.length, 2, "exactly one retry");
  assert.equal(retried[0]?.reasoning_effort, "high");
  assert.equal("reasoning_effort" in retried[1]!, false);
  // The refusal is remembered for this gateway and model: the next request leaves the effort out from the start.
  const remembered = await send("claude-haiku-5-5", "maximum");
  assert.equal(remembered.length, 1, "no second refused round trip");
  assert.equal("reasoning_effort" in remembered[0]!, false);

  // An explicit Off is the user's own setting: a gateway that refuses it reports the error rather than thinking.
  requests.length = 0;
  await assert.rejects(
    provider.chatComplete([{ role: "user", content: "think" }], {
      model: "gemini-3.5-flash-lite",
      stream: false,
      reasoningEffort: "none",
      enabledParameters: { reasoningEffort: true },
    }),
    /reasoning_effort/,
  );
  assert.equal(requests.length, 1, "Off is not retried without it");
  assert.equal(requests[0]?.reasoning_effort, "none");

  // An effort set through Custom Parameters is the user's own: it is not stripped, so the refusal surfaces.
  requests.length = 0;
  await assert.rejects(
    provider.chatComplete([{ role: "user", content: "think" }], {
      model: "claude-haiku-5-5",
      stream: false,
      customParameters: { reasoning_effort: "high" },
    }),
    /reasoning_effort/,
  );
  assert.equal(requests.length, 1);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log("custom-gateway-reasoning-effort regression passed");
