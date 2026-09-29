import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The parameter panel only shows settings that change the request for the selected provider and model. This test is
// the source of truth for those rules: it changes one setting at a time and records which changes alter the request.
// Most providers use a local HTTP stub; ChatGPT uses its production Responses body builder before transport, and the
// subscription provider uses an SDK stub.
// The shared rules must match exactly, for effort on and effort off, so a provider change that makes a hidden setting
// matter (or a shown one stop mattering) fails here instead of silently misleading the panel.
const root = mkdtempSync(join(tmpdir(), "marinara-param-relevance-"));
const previousCodexHome = process.env.CODEX_HOME;
process.env.DATA_DIR = root;
process.env.FILE_STORAGE_DIR = `${process.env.DATA_DIR}/storage`; // never the live store named in .env
process.env.CODEX_HOME = join(root, "codex-home");
mkdirSync(process.env.CODEX_HOME, { recursive: true });
const testTokenPayload = Buffer.from(JSON.stringify({ exp: 9_999_999_999 })).toString("base64url");
writeFileSync(
  join(process.env.CODEX_HOME, "auth.json"),
  JSON.stringify({
    auth_mode: "chatgpt",
    last_refresh: new Date().toISOString(),
    tokens: { access_token: `test.${testTokenPayload}.signature` },
  }),
);
// Every stubbed request fails on purpose; keep those expected provider errors out of the output.
process.env.LOG_LEVEL = "silent";
process.env.LOG_FILE_LEVEL = "silent";

type ProbedKey =
  | "temperature"
  | "maxTokens"
  | "topP"
  | "topK"
  | "frequencyPenalty"
  | "presencePenalty"
  | "reasoningEffort"
  | "verbosity"
  | "serviceTier";
const PROBED: ProbedKey[] = [
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "reasoningEffort",
  "verbosity",
  "serviceTier",
];

try {
  const { createLLMProvider } = await import("../../packages/server/src/services/llm/provider-registry.js");
  const { OpenAIProvider } = await import("../../packages/server/src/services/llm/providers/openai.provider.js");
  const { OpenAIChatGPTProvider } =
    await import("../../packages/server/src/services/llm/providers/openai-chatgpt.provider.js");
  const { __setSdkForTesting, ClaudeSubscriptionProvider } =
    await import("../../packages/server/src/services/llm/providers/claude-subscription.provider.js");
  const { isClaudeAdaptiveOnlyNoSamplingModel, resolveProviderReasoningEffort } =
    await import("../../packages/shared/src/constants/model-lists.js");
  const { relevantGenerationParameters, reasoningEffortChoices, verbosityChoices } =
    await import("../../packages/shared/src/constants/generation-parameter-relevance.js");
  const { readOpenRouterModelCapabilities } = await import("../../packages/server/src/routes/connections.routes.js");

  assert.deepEqual(
    readOpenRouterModelCapabilities({
      supported_parameters: ["temperature", "reasoning", "max_completion_tokens", "unknown"],
    }),
    { supportedParameters: ["temperature", "reasoningEffort", "maxTokens"] },
    "OpenRouter catalog capabilities map only controls recognized by the panel",
  );
  assert.equal(
    readOpenRouterModelCapabilities({ supported_parameters: ["unknown"] }),
    undefined,
    "an unrecognized OpenRouter parameter list does not hide all controls",
  );
  let firstBody: string | null = null;
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (firstBody === null) firstBody = Buffer.concat(chunks).toString("utf8");
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "stub", type: "invalid_request_error" } }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  let sdkOptions: string | null = null;
  __setSdkForTesting({
    query: ((args: { options: Record<string, unknown> }) => {
      const {
        env: _env,
        abortController: _abort,
        canUseTool: _tool,
        hooks: _hooks,
        stderr: _stderr,
        ...rest
      } = args.options;
      if (sdkOptions === null) sdkOptions = JSON.stringify(rest);
      return (async function* () {
        yield { type: "result", subtype: "success", result: "", usage: { input_tokens: 1, output_tokens: 1 } };
      })();
    }) as never,
  });

  const requireRequestCapture = (captured: string | null, provider: string, model: string): string => {
    assert.ok(captured, `${provider}/${model} did not produce a request body`);
    return captured;
  };
  assert.throws(
    () => requireRequestCapture(null, "capture-fixture", "no-request"),
    /capture-fixture\/no-request did not produce a request body/,
    "a provider probe without a captured body must fail instead of comparing a sentinel",
  );

  type Values = {
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
    frequencyPenalty: number;
    presencePenalty: number;
    reasoningEffort: "low" | "high" | null;
    verbosity: string;
    serviceTier: string;
  };

  // Mirrors provider-generation-runtime.ts and the generate route's option mapping.
  const chatOptions = (provider: string, model: string, values: Values) => {
    const lower = model.toLowerCase();
    let temperature: number | undefined = values.temperature;
    let topP: number | undefined = values.topP;
    let topK = values.topK;
    let frequencyPenalty = values.frequencyPenalty;
    let presencePenalty = values.presencePenalty;
    if (isClaudeAdaptiveOnlyNoSamplingModel(lower)) {
      temperature = undefined;
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    } else if (/claude-(opus|sonnet)-4-[56]/.test(lower) || /claude-(opus|sonnet)-4\.[56]/.test(lower)) {
      topP = undefined;
      topK = 0;
      frequencyPenalty = 0;
      presencePenalty = 0;
    }
    const resolved = resolveProviderReasoningEffort({
      provider,
      model: lower,
      reasoningEffort: values.reasoningEffort ?? undefined,
    });
    return {
      model,
      stream: true,
      temperature,
      maxTokens: values.maxTokens,
      topP,
      topK: topK > 0 ? topK : undefined,
      frequencyPenalty: frequencyPenalty || undefined,
      presencePenalty: presencePenalty || undefined,
      enableThinking: !!resolved,
      reasoningEffort: values.reasoningEffort === null ? "none" : (resolved ?? undefined),
      verbosity: values.verbosity,
      serviceTier: values.serviceTier,
      enabledParameters: Object.fromEntries(PROBED.map((key) => [key, true])),
    };
  };

  const capture = async (make: () => any, provider: string, model: string, values: Values, sdk: boolean) => {
    firstBody = null;
    sdkOptions = null;
    const instance = make();
    if (provider === "openai_chatgpt") {
      const delegated = await instance.delegate();
      const body = delegated.buildResponsesBody(
        [{ role: "user", content: "test" }],
        chatOptions(provider, model, values),
      );
      return JSON.stringify(body);
    }
    const run = (async () => {
      try {
        for await (const _chunk of instance.chat(
          [{ role: "user", content: "test" }],
          chatOptions(provider, model, values),
        )) {
          // drain
        }
      } catch {
        // The stub rejects every request; only the request body matters.
      }
    })();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        run,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`${provider}/${model} request capture timed out`)), 5000);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    return requireRequestCapture(sdk ? sdkOptions : firstBody, provider, model);
  };

  const registry = (id: string, url: string) => () => createLLMProvider(id, url, "test");
  const cases: Array<{ provider: string; baseUrl: string; models: string[]; make: () => any; sdk?: boolean }> = [
    {
      provider: "openai",
      baseUrl: `${base}/v1`,
      models: [
        "gpt-4o",
        "gpt-4.1",
        "o3",
        "gpt-5",
        "gpt-5.4",
        "gpt-5.6-sol",
        "gpt-6-astra",
        "gpt-6-sol",
        "gpt-6-luna",
        "gpt-6.1-sol",
        "some-unknown-model",
      ],
      make: registry("openai", `${base}/v1`),
    },
    {
      provider: "openrouter",
      baseUrl: `${base}/openrouter.ai/api/v1`,
      models: [
        "openai/gpt-5",
        "anthropic/claude-sonnet-4.5",
        "anthropic/claude-opus-5",
        "anthropic/claude-sonnet-5.5",
        "deepseek/deepseek-v4-pro",
        "meta-llama/llama-3.3-70b-instruct",
        "x-ai/grok-4.3",
        "google/gemini-3.5-flash",
      ],
      make: registry("openrouter", `${base}/openrouter.ai/api/v1`),
    },
    {
      provider: "nanogpt",
      baseUrl: `${base}/nano-gpt.com/api/v1`,
      models: ["TheDrummer/Artemis-v1.1", "gpt-5", "glm-4.6", "deepseek-v4-pro", "claude-opus-5"],
      make: registry("nanogpt", `${base}/nano-gpt.com/api/v1`),
    },
    {
      provider: "xai",
      baseUrl: `${base}/api.x.ai/v1`,
      models: ["grok-4.3", "grok-4.5", "grok-4-1-fast", "grok-3", "grok-4.20-multi-agent"],
      make: registry("xai", `${base}/api.x.ai/v1`),
    },
    {
      provider: "mistral",
      baseUrl: `${base}/v1`,
      models: ["mistral-large-latest", "magistral-medium-latest", "unknown-mistral"],
      make: registry("mistral", `${base}/v1`),
    },
    {
      provider: "cohere",
      baseUrl: `${base}/v1`,
      models: ["command-a-03-2025", "unknown-cohere"],
      make: registry("cohere", `${base}/v1`),
    },
    {
      provider: "arli",
      baseUrl: `${base}/v1`,
      models: ["Mistral-Nemo-12B-Instruct-2407", "unknown-arli"],
      make: registry("arli", `${base}/v1`),
    },
    {
      provider: "custom",
      baseUrl: `${base}/v1`,
      models: ["llama-3.3-70b", "gpt-5.5", "glm-4.6", "claude-opus-5"],
      make: registry("custom", `${base}/v1`),
    },
    {
      provider: "some_future_provider",
      baseUrl: `${base}/v1`,
      models: ["whatever-1"],
      make: registry("some_future_provider", `${base}/v1`),
    },
    {
      provider: "anthropic",
      baseUrl: base,
      models: [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-5",
        "claude-opus-4-6",
        "claude-opus-5",
        "claude-sonnet-5-5",
        "claude-3-7-sonnet-20250219",
        "claude-unknown-9",
      ],
      make: registry("anthropic", base),
    },
    {
      provider: "google",
      baseUrl: `${base}/v1beta`,
      models: [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-3-pro-preview",
        "gemini-2.0-flash",
        "gemma-3-27b-it",
        "gemini-unknown",
      ],
      make: registry("google", `${base}/v1beta`),
    },
    {
      provider: "openai_chatgpt",
      baseUrl: `${base}/v1`,
      models: ["gpt-5.6-sol", "gpt-5.6-luna", "gpt-6-astra", "gpt-5.5"],
      make: () => new OpenAIChatGPTProvider(`${base}/v1`, "test"),
    },
    {
      provider: "local_sidecar",
      baseUrl: `${base}/v1`,
      models: ["gemma-3-12b", "qwen3-8b"],
      make: () => new OpenAIProvider(`${base}/v1`, "local-sidecar", undefined, undefined, undefined, "local-sidecar"),
    },
    {
      provider: "claude_subscription",
      baseUrl: "",
      models: [
        "claude-opus-5",
        "claude-sonnet-5-5",
        "claude-fable-5-1",
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-unknown-9",
      ],
      make: () => new ClaudeSubscriptionProvider("", ""),
      sdk: true,
    },
  ];

  const mismatches: string[] = [];
  for (const effort of ["high", null] as const) {
    const baseline: Values = {
      temperature: 0.7,
      maxTokens: 777,
      topP: 0.9,
      topK: 40,
      frequencyPenalty: 0.3,
      presencePenalty: 0.4,
      reasoningEffort: effort,
      verbosity: "low",
      serviceTier: "flex",
    };
    const changes: Array<[ProbedKey, unknown]> = [
      ["temperature", 0.3],
      ["maxTokens", 1555],
      ["topP", 0.5],
      ["topK", 20],
      ["frequencyPenalty", 0.6],
      ["presencePenalty", 0.8],
      ["reasoningEffort", "low"],
      ["reasoningEffort", effort === null ? "high" : null],
      ["verbosity", "high"],
      ["serviceTier", "priority"],
    ];
    for (const testCase of cases) {
      for (const model of testCase.models) {
        const before = await capture(testCase.make, testCase.provider, model, baseline, !!testCase.sdk);
        const sent = new Set<ProbedKey>();
        for (const [key, value] of changes) {
          const after = await capture(
            testCase.make,
            testCase.provider,
            model,
            { ...baseline, [key]: value } as Values,
            !!testCase.sdk,
          );
          if (after !== before) sent.add(key);
        }
        const shown = relevantGenerationParameters({
          provider: testCase.provider,
          model,
          reasoningEffort: effort,
          baseUrl: testCase.baseUrl,
        });
        const expected = PROBED.filter((key) => sent.has(key)).join(", ");
        const actual = PROBED.filter((key) => shown.has(key)).join(", ");
        if (expected !== actual) {
          mismatches.push(
            `${testCase.provider} ${model} (effort ${effort ?? "off"}): request uses [${expected}] but panel shows [${actual}]`,
          );
        }
      }
    }
  }
  assert.deepEqual(mismatches, [], `panel rules disagree with the providers:\n${mismatches.join("\n")}`);

  // Live data only narrows: OpenRouter's per-model list hides what the model ignores upstream.
  const openRouterGpt5 = relevantGenerationParameters({
    provider: "openrouter",
    model: "openai/gpt-5",
    reasoningEffort: "high",
    capabilities: { supportedParameters: ["maxTokens", "reasoningEffort"] },
  });
  assert.deepEqual(
    PROBED.filter((key) => openRouterGpt5.has(key)),
    ["maxTokens", "reasoningEffort", "serviceTier"],
  );

  // A provider this build has never heard of keeps its controls.
  const future = relevantGenerationParameters({ provider: "brand_new_provider", model: "", reasoningEffort: "high" });
  for (const key of ["temperature", "maxTokens", "topP", "topK", "reasoningEffort", "verbosity"] as const) {
    assert.ok(future.has(key), `unknown providers keep ${key}`);
  }

  // Effort buttons use the provider's names. Live names come first; otherwise the value actually sent, once each.
  assert.deepEqual(
    reasoningEffortChoices({
      provider: "claude_subscription",
      model: "claude-opus-5",
      capabilities: {
        effortLevels: ["low", "medium", "high", "xhigh", "maximum"],
        effortLabels: { low: "low", medium: "medium", high: "high", xhigh: "xhigh", maximum: "max" },
        adaptiveThinking: true,
      },
    }).map((choice) => choice.label),
    [null, "low", "medium", "high", "xhigh", "max"],
    "Opus 5 can turn thinking off, so Off stays",
  );
  assert.deepEqual(
    reasoningEffortChoices({
      provider: "claude_subscription",
      model: "claude-fable-5-1",
      capabilities: {
        effortLevels: ["low", "high", "maximum"],
        effortLabels: { maximum: "max" },
        adaptiveThinking: true,
      },
    }).map((choice) => choice.label),
    ["low", "high", "max"],
    "Fable always thinks, so there is no Off",
  );
  assert.deepEqual(
    reasoningEffortChoices({ provider: "openai", model: "o3", selected: "maximum" }).map((choice) => [
      choice.value,
      choice.label,
    ]),
    [
      [null, null],
      ["low", "low"],
      ["medium", "medium"],
      ["maximum", "high"],
    ],
    "levels that send the same value appear once, keeping the selected one",
  );
  assert.deepEqual(
    reasoningEffortChoices({ provider: "openai", model: "gpt-5.6-sol" }).map((choice) => choice.label),
    [null, "low", "medium", "high", "xhigh", "max"],
  );
  const chatGptChoices = reasoningEffortChoices({
    provider: "openai_chatgpt",
    model: "gpt-5.6-sol",
    capabilities: {
      effortLevels: ["low", "medium", "high", "xhigh", "maximum"],
      effortLabels: { low: "low", medium: "medium", high: "high", xhigh: "xhigh", maximum: "max" },
      defaultEffort: "low",
    },
  });
  assert.deepEqual(
    chatGptChoices.map((choice) => [choice.label, choice.kind ?? ""]),
    [
      [null, "default"],
      ["low", ""],
      ["medium", ""],
      ["high", ""],
      ["xhigh", ""],
      ["max", ""],
    ],
    "ChatGPT offers its own levels plus the model default instead of an Off it cannot honour",
  );
  assert.deepEqual(
    verbosityChoices({
      provider: "openai_chatgpt",
      capabilities: { verbosity: { supported: true, default: "low" } },
    }).map((choice) => [choice.label, choice.description ?? ""]),
    [
      [null, "Provider default: low"],
      ["low", "Provider default"],
      ["medium", ""],
      ["high", ""],
    ],
  );

  __setSdkForTesting(null);
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  console.log("generation-parameter-relevance regression passed");
} finally {
  if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = previousCodexHome;
  rmSync(root, { recursive: true, force: true });
}
