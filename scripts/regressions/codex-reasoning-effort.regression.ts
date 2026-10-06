import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Codex (OpenAI ChatGPT login) connections send the chosen thinking level as `reasoning.effort`, the field the Codex
// client uses, and send nothing when no level is chosen so Codex keeps the model's default (#7083). A throwaway
// CODEX_HOME and a local stub keep the test away from a real login and from chatgpt.com.
const codexHome = mkdtempSync(join(tmpdir(), "marinara-codex-effort-"));
const previousCodexHome = process.env.CODEX_HOME;
process.env.CODEX_HOME = codexHome;
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";
writeFileSync(
  join(codexHome, "auth.json"),
  JSON.stringify({
    auth_mode: "chatgpt",
    last_refresh: new Date().toISOString(),
    tokens: { access_token: `test.${Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString("base64url")}.sig` },
  }),
);

const bodies: Array<Record<string, any>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  bodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.end(
    [
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "ok" })}`,
      "",
      `data: ${JSON.stringify({ type: "response.completed", response: { status: "completed", output: [] } })}`,
      "",
      "",
    ].join("\n"),
  );
});

try {
  const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
  const { OpenAIChatGPTProvider } =
    await import("../../packages/server/src/services/llm/providers/openai-chatgpt.provider.js");
  const { BaseLLMProvider } = await import("../../packages/server/src/services/llm/base-provider.js");
  const { ConnectionFallbackProvider } =
    await import("../../packages/server/src/services/llm/connection-fallback-provider.js");
  const { resolveGenerationProviderRuntime } =
    await import("../../packages/server/src/services/generation/provider-generation-runtime.js");
  const { resolveModelAccessPolicy } =
    await import("../../packages/server/src/services/generation/model-access-policy.js");
  const { reasoningEffortChoices, relevantGenerationParameters } =
    await import("../../packages/shared/src/constants/generation-parameter-relevance.js");
  const { MODEL_LISTS } = await import("../../packages/shared/src/constants/model-lists.js");

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  // The same request builder and transport the Codex wrapper delegates to, pointed at the stub instead of chatgpt.com.
  const codex = new OpenAIProvider(base, "codex-token", undefined, null, null, "openai-chatgpt");
  type Options = Parameters<typeof codex.chat>[1];

  const send = async (options: Partial<Options> & { model: string }) => {
    let text = "";
    for await (const chunk of codex.chat([{ role: "user", content: "Hello" }], { stream: true, ...options })) {
      text += chunk;
    }
    assert.equal(text, "ok");
    return bodies.at(-1)!;
  };

  // Each level the Codex catalog lists for these models goes out as reasoning.effort, unchanged.
  const accepted: Record<string, Array<NonNullable<Options["reasoningEffort"]>>> = {
    "gpt-6.1-sol": ["low", "medium", "high", "xhigh", "max"],
    "gpt-5.6-sol": ["low", "medium", "high", "xhigh", "max"],
    "gpt-5.5": ["low", "medium", "high", "xhigh"],
  };
  for (const [model, levels] of Object.entries(accepted)) {
    for (const effort of levels) {
      const body = await send({ model, reasoningEffort: effort, temperature: 0.7, maxTokens: 512 });
      assert.deepEqual(body.reasoning, { effort }, `${model} sends ${effort} as reasoning.effort`);
      // Codex still rejects the API-only fields the wrapper never sends.
      for (const field of ["include", "temperature", "top_p", "max_output_tokens", "text", "reasoning_effort"]) {
        assert.equal(field in body, false, `${model} ${effort} leaves out ${field}`);
      }
      assert.equal(body.stream, true);
      assert.equal(body.store, false);
    }
  }

  // Unset, "none" (Codex has no off level), a switched-off parameter, a model that does not reason, and a model the
  // catalog does not know all leave the field out, so Codex uses the model's default.
  for (const [label, options] of [
    ["unset", { model: "gpt-6.1-sol" }],
    ["none", { model: "gpt-6.1-sol", reasoningEffort: "none" }],
    [
      "send switch off",
      { model: "gpt-6.1-sol", reasoningEffort: "high", enabledParameters: { reasoningEffort: false } },
    ],
    ["non-reasoning model", { model: "gpt-4o", reasoningEffort: "high" }],
    ["unknown model", { model: "some-future-model", reasoningEffort: "high" }],
  ] as const) {
    const body = await send(options as Partial<Options> & { model: string });
    assert.equal("reasoning" in body, false, `${label}: no reasoning field`);
  }

  // A level from a caller that does not convert it first (an agent package, a fallback) becomes one the model takes.
  for (const [model, effort, expected] of [
    ["gpt-5.5", "max", "xhigh"],
    ["gpt-5.6-sol", "max", "max"],
    ["gpt-6.1-sol", "xhigh", "xhigh"],
  ] as const) {
    const body = await send({ model, reasoningEffort: effort });
    assert.deepEqual(body.reasoning, { effort: expected }, `${model} turns ${effort} into ${expected}`);
  }

  // A Codex fallback sends its own saved level, converted for its model, and otherwise keeps Codex's default instead
  // of taking the main connection's level.
  const failingPrimary = new (class extends BaseLLMProvider {
    async *chat(): AsyncGenerator<string, void, unknown> {
      throw new Error("primary unavailable");
    }
  })("", "");
  const viaFallback = async (fallback: Record<string, unknown>, mainEffort?: Options["reasoningEffort"]) => {
    const provider = new ConnectionFallbackProvider(
      failingPrimary,
      codex,
      { id: "codex-fallback", name: "Codex", provider: "openai_chatgpt", baseUrl: base, apiKey: "", ...fallback },
      "main",
      async () => {},
    );
    for await (const _chunk of provider.chat([{ role: "user", content: "Hello" }], {
      model: "main-model",
      stream: true,
      reasoningEffort: mainEffort,
    })) {
      // drain
    }
    return bodies.at(-1)!;
  };
  assert.deepEqual(
    (await viaFallback({ model: "gpt-5.5", defaultParameters: JSON.stringify({ reasoningEffort: "maximum" }) }))
      .reasoning,
    { effort: "xhigh" },
    "a gpt-5.5 fallback turns its saved Maximum into xhigh",
  );
  assert.deepEqual(
    (await viaFallback({ model: "gpt-6.1-sol", defaultParameters: JSON.stringify({ reasoningEffort: "medium" }) }))
      .reasoning,
    { effort: "medium" },
  );
  for (const model of ["gpt-5.5", "gpt-6.1-sol"]) {
    assert.equal(
      "reasoning" in (await viaFallback({ model, defaultParameters: null }, "max")),
      false,
      `a ${model} fallback with no saved level keeps Codex's default`,
    );
  }

  // The real wrapper builds the same body through the local login, without calling chatgpt.com.
  const wrapper = await (new OpenAIChatGPTProvider("", "") as any).delegate();
  assert.deepEqual(
    wrapper.buildResponsesBody([{ role: "user", content: "Hello" }], { model: "gpt-6.1-sol", reasoningEffort: "xhigh" })
      .reasoning,
    { effort: "xhigh" },
  );

  // Codex follows the effort only once the connection or the chat picks a level; until then preset, built-in and scene
  // levels keep the model's default, so existing Codex chats do not jump to Maximum.
  const runtime = (args: {
    provider?: string;
    model?: string;
    connection?: Record<string, unknown> | null;
    chat?: Record<string, unknown> | null;
    scene?: boolean;
  }) => {
    const provider = args.provider ?? "openai_chatgpt";
    const model = args.model ?? "gpt-6.1-sol";
    return resolveGenerationProviderRuntime({
      connectionId: "connection",
      connection: {
        provider,
        model,
        apiKey: "",
        defaultParameters: args.connection ? JSON.stringify(args.connection) : null,
      },
      baseUrl: base,
      chatMode: "roleplay",
      isSceneChat: !!args.scene,
      chatParameters: args.chat ?? null,
      managedParameterDefinitions: [],
      modelAccessPolicy: resolveModelAccessPolicy({ provider, model }),
      initial: {
        temperature: 1,
        maxTokens: 8192,
        topP: 1,
        topK: 0,
        minP: 0,
        frequencyPenalty: 0,
        presencePenalty: 0,
        showThoughts: true,
        reasoningEffort: "maximum",
        verbosity: "high",
        serviceTier: null,
        assistantPrefill: "",
        assistantReasoningPrefill: "",
        customThinkingTags: [],
        customParameters: {},
        enabledParameters: undefined,
        stopSequences: [],
        effectiveMaxContext: undefined,
      },
    });
  };
  const sent = (args: Parameters<typeof runtime>[0]) => runtime(args).providerReasoningEffort;
  assert.equal(sent({}), undefined, "a preset or built-in Maximum keeps Codex's default");
  assert.equal(runtime({}).parameterSources.reasoningEffort, "defaults");
  assert.equal(sent({ scene: true }), undefined, "scene chats keep Codex's default");
  assert.equal(sent({ scene: true, connection: { reasoningEffort: "medium" } }), "max", "then scenes force Maximum");
  assert.equal(sent({ connection: { reasoningEffort: "medium" } }), "medium", "the connection's level is sent");
  assert.equal(sent({ connection: { reasoningEffort: "maximum" } }), "max");
  assert.equal(sent({ model: "gpt-5.5", connection: { reasoningEffort: "maximum" } }), "xhigh");
  assert.equal(sent({ connection: { reasoningEffort: null } }), undefined, "Default on the connection sends nothing");
  // Default is not a level: turning on custom parameters (which saves Default for Codex) keeps scenes on Codex's default.
  assert.equal(
    sent({ scene: true, connection: { reasoningEffort: null } }),
    undefined,
    "Default keeps scenes on default",
  );
  assert.equal(runtime({ connection: { reasoningEffort: null } }).parameterSources.reasoningEffort, "connection");
  assert.equal(
    sent({ connection: { reasoningEffort: "high" }, chat: { reasoningEffort: "low" } }),
    "low",
    "a chat's level overrides the connection's",
  );
  assert.equal(sent({ connection: { reasoningEffort: "high" }, chat: { reasoningEffort: null } }), undefined);
  assert.equal(sent({ chat: { reasoningEffort: "xhigh" } }), "xhigh");
  assert.equal(
    sent({ connection: { reasoningEffort: "high", enabledParameters: { reasoningEffort: false } } }),
    undefined,
    "the send switch still leaves the level out",
  );
  assert.equal(
    sent({ provider: "openai", model: "gpt-5.6-sol" }),
    "max",
    "other providers still use preset and built-in levels",
  );

  // The panel shows the control for Codex reasoning models, with Default instead of an Off it cannot honour.
  assert.ok(relevantGenerationParameters({ provider: "openai_chatgpt", model: "gpt-6.1-sol" }).has("reasoningEffort"));
  assert.ok(!relevantGenerationParameters({ provider: "openai_chatgpt", model: "gpt-4o" }).has("reasoningEffort"));
  assert.deepEqual(
    reasoningEffortChoices({ provider: "openai_chatgpt", model: "gpt-6.1-sol" }).map((choice) => [
      choice.label,
      choice.kind ?? "",
    ]),
    [
      [null, "default"],
      ["low", ""],
      ["medium", ""],
      ["high", ""],
      ["xhigh", ""],
      ["max", ""],
    ],
  );
  assert.deepEqual(
    reasoningEffortChoices({ provider: "openai_chatgpt", model: "gpt-5.5" }).map((choice) => choice.label),
    [null, "low", "medium", "high", "xhigh"],
  );

  // Adding the GPT-6 and GPT-5.6 models does not change the model a new Codex connection starts with.
  assert.equal(MODEL_LISTS.openai_chatgpt?.[0]?.id, "gpt-5.5");

  console.log("codex-reasoning-effort regression passed");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = previousCodexHome;
  rmSync(codexHome, { recursive: true, force: true });
}
