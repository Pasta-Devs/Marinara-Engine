// #6961: NanoGPT GLM chats kept reasoning with Reasoning Effort set to Off, whether the chat set it
// or inherited it from the connection's Default Chat Parameters over a preset with no parameters.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { parsePresetParameters } from "../../packages/server/src/services/prompt/assembler.js";
import { resolveGenerationProviderRuntime } from "../../packages/server/src/services/generation/provider-generation-runtime.js";
import { resolveModelAccessPolicy } from "../../packages/server/src/services/generation/model-access-policy.js";

let requestBody: Record<string, unknown> | null = null;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as { port: number };
// A preset without saved parameters falls back to the built-in defaults (reasoning at maximum).
const preset = parsePresetParameters("{}");

async function send(model: string, connectionDefaults: unknown, chatParameters: unknown) {
  // Mirrors the generate route: preset values, then connection defaults, then chat overrides.
  const runtime = resolveGenerationProviderRuntime({
    connectionId: "nanogpt-glm",
    connection: { provider: "nanogpt", model, apiKey: "synthetic", defaultParameters: connectionDefaults },
    baseUrl: `http://127.0.0.1:${port}/v1`,
    chatMode: "roleplay",
    isSceneChat: false,
    chatParameters,
    managedParameterDefinitions: [],
    modelAccessPolicy: resolveModelAccessPolicy({ provider: "nanogpt", model }),
    initial: { ...preset, enabledParameters: preset.enabledParameters, effectiveMaxContext: undefined },
  });
  requestBody = null;
  for await (const _chunk of runtime.provider.chat([{ role: "user", content: "Hi" }], {
    model,
    stream: false,
    maxTokens: runtime.maxTokens,
    enableThinking: runtime.enableThinking,
    reasoningEffort: runtime.providerReasoningEffort,
    enabledParameters: runtime.enabledParameters,
  })) {
    // Drain the response.
  }
  return { runtime, body: requestBody as Record<string, unknown> | null };
}

try {
  for (const model of ["zai-org/glm-4.7", "zai-org/glm-5.1"]) {
    const inherited = await send(model, JSON.stringify({ reasoningEffort: null }), {});
    assert.equal(inherited.runtime.parameterSources.reasoningEffort, "connection", `${model}: chat inherits Off`);
    assert.equal(inherited.body?.enable_thinking, false);
    assert.equal(inherited.body?.reasoning_effort, "none", `${model}: NanoGPT gets its documented disable`);

    const chatOff = await send(model, JSON.stringify({ reasoningEffort: "high" }), { reasoningEffort: null });
    assert.equal(chatOff.runtime.parameterSources.reasoningEffort, "chat");
    assert.equal(chatOff.body?.reasoning_effort, "none", `${model}: a chat's own Off is sent too`);

    const chatOn = await send(model, JSON.stringify({ reasoningEffort: null }), { reasoningEffort: "high" });
    assert.equal(chatOn.body?.enable_thinking, true, `${model}: a chat override still wins over the default`);
    assert.equal("reasoning_effort" in (chatOn.body ?? {}), false);
  }

  // GLM 5.3 and 5.4 (#9700) always reason: Off sends their lightest level, never a disable they refuse.
  for (const model of ["zai-org/glm-5.3", "zai-org/glm-5.4"]) {
    const off = await send(model, JSON.stringify({ reasoningEffort: null }), {});
    assert.equal(off.body?.enable_thinking, true, `${model}: thinking stays on`);
    assert.equal(off.body?.reasoning_effort, "low", `${model}: Off sends low`);

    const high = await send(model, JSON.stringify({ reasoningEffort: null }), { reasoningEffort: "high" });
    assert.equal(high.body?.reasoning_effort, "high", `${model}: a chosen level is sent`);
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
