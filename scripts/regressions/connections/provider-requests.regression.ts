import assert from "node:assert/strict";
import { formatAgentFailuresToast, toAgentFailure } from "../../../packages/client/src/lib/agent-failures.js";
import { formatGenerationParameterError } from "../../../packages/client/src/lib/generation-parameter-errors.js";
import { suppressesReferencePromptLine } from "../../../packages/server/src/routes/generate/illustrator-references.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "audited provider requests use documented effort, sampling and continuation fields",
    async run() {
      const { createLLMProvider } = await import("../../../packages/server/src/services/llm/provider-registry.js");
      const { resolveProviderReasoningEffort, findKnownModel } =
        await import("../../../packages/shared/src/constants/model-lists.js");
      const { relevantGenerationParameters, reasoningEffortChoices } =
        await import("../../../packages/shared/src/constants/generation-parameter-relevance.js");
      const { resolveGeminiThinkingConfig } =
        await import("../../../packages/server/src/services/llm/providers/google.provider.js");
      const { applyGlmThinkingParameters } =
        await import("../../../packages/server/src/services/llm/providers/glm-request-compat.js");
      type Effort = "low" | "medium" | "high" | "xhigh" | "maximum" | null;
      // Every row pins all stored levels, including the default used by a saved Off.
      const levels: Effort[] = [null, "low", "medium", "high", "xhigh", "maximum"];
      const rows: Array<[string, string, Array<string | null>]> = [
        ...["openai", "openai_chatgpt", "custom"].flatMap((provider): Array<[string, string, Array<string | null>]> => [
          [provider, "gpt-5.2", [null, "low", "medium", "high", "xhigh", "xhigh"]],
          ...["gpt-5.2-codex", "gpt-5.3-codex"].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            ["medium", "low", "medium", "high", "xhigh", "xhigh"],
          ]),
          [provider, "gpt-5.4-pro-2026-03-05", ["medium", "medium", "medium", "high", "xhigh", "xhigh"]],
          [provider, "gpt-5.5-pro", ["high", "medium", "medium", "high", "xhigh", "xhigh"]],
          ...["gpt-5", "gpt-5-mini", "gpt-5-nano-2025-08-07"].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            ["medium", "low", "medium", "high", "high", "high"],
          ]),
          ...["gpt-6-astra", "gpt-6.1-sol", "gpt-6.2-sol", "gpt-6.2-astra"].map(
            (model): [string, string, Array<string | null>] => [
              provider,
              model,
              ["low", "low", "medium", "high", "xhigh", "max"],
            ],
          ),
        ]),
        ...["anthropic", "claude_subscription"].flatMap((provider): Array<[string, string, Array<string | null>]> => [
          ...["claude-opus-4-6", "claude-sonnet-4-6"].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            [null, "low", "medium", "high", "max", "max"],
          ]),
          [provider, "claude-haiku-5-5", ["medium", "low", "medium", "high", "xhigh", "max"]],
          ...["claude-opus-5-5", "claude-fable-5-2", "claude-mythos-5-2"].map(
            (model): [string, string, Array<string | null>] => [
              provider,
              model,
              ["low", "low", "medium", "high", "xhigh", "max"],
            ],
          ),
          ...["claude-fable-5", "claude-fable-5-1", "claude-mythos-5", "claude-mythos-5-1"].map(
            (model): [string, string, Array<string | null>] => [
              provider,
              model,
              ["low", "low", "medium", "high", "xhigh", "max"],
            ],
          ),
          ...["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-7-sonnet-20250219"].map(
            (model): [string, string, Array<string | null>] => [
              provider,
              model,
              provider === "anthropic"
                ? [null, "high", "high", "high", "high", "high"]
                : [null, null, null, null, null, null],
            ],
          ),
        ]),
        ["anthropic", "claude-sonnet-5-5", [null, "low", "medium", "high", "xhigh", "max"]],
        ["claude_subscription", "claude-sonnet-5-5", ["low", "low", "medium", "high", "xhigh", "max"]],
        ...["google", "google_vertex"].flatMap((provider): Array<[string, string, Array<string | null>]> => [
          ...[
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-2.5-pro-preview-06-05",
          ].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            ["medium", "low", "medium", "high", "high", "high"],
          ]),
          ...[
            "gemini-3.1-pro-preview",
            "gemini-3.1-pro-preview-customtools",
            "gemini-3.1-pro",
            "gemini-3-flash",
            "gemini-3-flash-preview",
          ].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            ["high", "low", "medium", "high", "high", "high"],
          ]),
          ...["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            [null, "low", "medium", "high", "high", "high"],
          ]),
          ...["gemini-3.1-flash-image", "gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-image"].map(
            (model): [string, string, Array<string | null>] => [
              provider,
              model,
              [null, "high", "high", "high", "high", "high"],
            ],
          ),
        ]),
        ["xai", "grok-4.5", ["high", "low", "medium", "high", "high", "high"]],
        ["xai", "grok-4.5-latest", ["high", "low", "medium", "high", "high", "high"]],
        ...["xai", "openrouter"].flatMap((provider): Array<[string, string, Array<string | null>]> =>
          ["grok-4.6", "grok-4.7"].map((model) => [
            provider,
            provider === "openrouter" ? `x-ai/${model}` : model,
            ["high", "low", "medium", "high", "xhigh", "xhigh"],
          ]),
        ),
        ["xai", "grok-4.20-multi-agent", ["high", "low", "low", "high", "high", "high"]],
        ["mistral", "mistral-large-4-0", ["high", "low", "medium", "high", "high", "high"]],
        ["mistral", "mistral-small-2603", [null, "high", "high", "high", "high", "high"]],
        ["mistral", "zai-glm-5-3", ["low", "low", "high", "high", "max", "max"]],
        ...["command-a-reasoning-08-2025", "command-a-plus-05-2026"].map(
          (model): [string, string, Array<string | null>] => [
            "cohere",
            model,
            [null, "high", "high", "high", "high", "high"],
          ],
        ),
        ...["glm-5.3", "glm-5.3-flash"].map((model): [string, string, Array<string | null>] => [
          "zai",
          model,
          ["low", "low", "high", "high", "max", "max"],
        ]),
        ["zai", "glm-5.2", [null, "high", "high", "high", "max", "max"]],
        ...["glm-5.1", "glm-5", "glm-4.7", "glm-4.6"].map((model): [string, string, Array<string | null>] => [
          "zai",
          model,
          [null, "high", "high", "high", "high", "high"],
        ]),
        ...["custom", "nanogpt", "openrouter"].flatMap((provider): Array<[string, string, Array<string | null>]> => [
          [provider, "moonshotai/kimi-k3", ["low", "low", "high", "high", "max", "max"]],
          // NanoGPT turns reasoning_effort into the model's own thinking switch, so these keep Off plus one on level.
          ...["moonshotai/kimi-k2.6", "xiaomi/mimo-v2.5-pro"].map((model): [string, string, Array<string | null>] => [
            provider,
            model,
            provider === "nanogpt"
              ? [null, "high", "high", "high", "high", "high"]
              : [null, null, null, null, null, null],
          ]),
        ]),
        ["nanogpt", "openai/gpt-5.5", [null, "low", "medium", "high", "xhigh", "xhigh"]],
        ["nanogpt", "openai/gpt-5.6-sol", [null, "low", "medium", "high", "xhigh", "max"]],
        ["local_sidecar", "qwen3-8b", [null, "high", "high", "high", "high", "high"]],
      ];
      for (const [provider, model, expected] of rows) {
        assert.deepEqual(
          levels.map((reasoningEffort) => resolveProviderReasoningEffort({ provider, model, reasoningEffort })),
          expected,
          `${provider}/${model} levels`,
        );
        if (expected[0]) {
          assert.ok(
            reasoningEffortChoices({ provider, model }).every((choice) => choice.value !== null),
            `${provider}/${model} has no Off`,
          );
          assert.ok(
            reasoningEffortChoices({
              provider,
              model,
              capabilities: { effortLevels: ["low", "medium", "high", "xhigh", "maximum"] },
            }).every((choice) => choice.value !== null),
            `${provider}/${model} live metadata cannot add Off`,
          );
        }
      }
      for (const model of [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.1-flash-image",
        "gemini-3.1-flash-lite-image",
      ]) {
        assert.deepEqual(reasoningEffortChoices({ provider: "google", model })[0], {
          value: null,
          label: null,
          kind: "default",
          providerDefault: "minimal",
        });
      }
      for (const model of [
        "gemini-3-pro-image",
        "gemini-3-pro-image-preview",
        "gemini-2.5-flash-image",
        "gemini-2.5-flash-image-preview",
      ]) {
        for (const reasoningEffort of ["none", "low", "max"] as const)
          assert.equal(resolveGeminiThinkingConfig(model, { enableThinking: true, reasoningEffort }, 32000), undefined);
      }
      assert.deepEqual(resolveGeminiThinkingConfig("gemini-2.5-pro", { reasoningEffort: "none" }, 32000), {
        thinkingBudget: 8192,
        includeThoughts: true,
      });
      for (const [model, maxOutput, context] of [
        ["claude-opus-4-6", 128000, 1000000],
        ["claude-opus-4-5", 64000, 200000],
        ["claude-sonnet-4-5", 64000, 200000],
      ] as const) {
        assert.equal(findKnownModel("anthropic", model)?.maxOutput, maxOutput);
        assert.equal(findKnownModel("anthropic", model)?.context, context);
      }
      assert.ok(findKnownModel("google_vertex", "gemini-4-hydrogen"));
      assert.ok(findKnownModel("anthropic", "claude-haiku-5-5"));
      assert.equal(findKnownModel("cohere", "command-a-plus-08-2025")?.id, "command-a-plus-05-2026");
      assert.equal(
        relevantGenerationParameters({ provider: "grok_subscription", model: "grok-4.7" }).has("maxTokens"),
        false,
      );
      assert.equal(
        relevantGenerationParameters({ provider: "deepseek", model: "deepseek-v4-pro" }).has("assistantPrefill"),
        false,
      );
      assert.equal(
        relevantGenerationParameters({ provider: "openai", model: "gpt-5.2" }).has("assistantReasoningPrefill"),
        false,
      );
      assert.equal(
        relevantGenerationParameters({
          provider: "openrouter",
          model: "x-ai/grok-4.7",
          capabilities: { supportedParameters: ["temperature"] },
        }).has("reasoningEffort"),
        false,
      );
      for (const model of ["glm-5.1", "glm-5", "glm-4.7", "glm-4.6"]) {
        const body = {};
        applyGlmThinkingParameters(body, {
          providerKind: "zai",
          baseUrl: "https://api.z.ai/api/paas/v4",
          model,
          reasoningEffort: "none",
        });
        assert.deepEqual(body, { thinking: { type: "disabled" } });
      }

      const originalFetch = globalThis.fetch;
      let captured: Record<string, any> | undefined;
      globalThis.fetch = async (_url, init) => {
        captured = JSON.parse(String(init?.body));
        return new Response('{"error":{"message":"audit stub"}}', {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      };
      const request = async (
        provider: string,
        model: string,
        effort: "none" | "low" | "medium" | "high" | "xhigh" | "max",
        tools = false,
      ) => {
        captured = undefined;
        const instance = createLLMProvider(provider, "http://127.0.0.1:7860/v1", "fixture");
        const options = {
          model,
          stream: false,
          maxTokens: 32000,
          temperature: 0.4,
          topP: 0.8,
          frequencyPenalty: 0.5,
          presencePenalty: 0.5,
          enableThinking: effort !== "none",
          reasoningEffort: effort,
        };
        const messages = [
          { role: "user" as const, content: "Continue." },
          {
            role: "assistant" as const,
            content: "The answer",
            providerMetadata: { reasoning_content: "prefilled thought", partial: true },
          },
        ];
        try {
          if (tools)
            await instance.chatComplete(messages, {
              ...options,
              tools: [
                {
                  type: "function",
                  function: { name: "test", description: "test", parameters: { type: "object", properties: {} } },
                },
              ],
            });
          else
            for await (const _chunk of instance.chat(messages, options)) {
              /* drain */
            }
        } catch {
          /* The stub rejects after capturing the real request. */
        }
        assert.ok(captured, `${provider}/${model} produced a request`);
        return captured;
      };
      try {
        for (const tools of [false, true]) {
          for (const model of [
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-opus-4-7",
            "claude-opus-4-8",
            "claude-opus-5",
            "claude-sonnet-5",
            "claude-fable-5",
            "claude-fable-5-1",
            "claude-mythos-5",
            "claude-mythos-5-1",
            "claude-haiku-5-5",
          ]) {
            const body = await request("anthropic", model, "none", tools);
            assert.equal(body.messages.at(-1).role, "user", `${model} uses continuation`);
          }
          for (const model of ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"]) {
            const body = await request("anthropic", model, "high", tools);
            assert.equal(body.thinking.type, "enabled");
            assert.ok(body.thinking.budget_tokens >= 1024);
            assert.equal(body.output_config?.effort, undefined);
            assert.equal(body.messages.at(-1).role, "user");
            assert.equal(
              (await request("anthropic", model, "none", tools)).messages.at(-1).role,
              "assistant",
              "without thinking 4.5 keeps prefill",
            );
          }
          for (const provider of ["google", "google_vertex"]) {
            const body = await request(provider, "gemini-3.5-flash", "none", tools);
            assert.equal(body.contents.at(-1).role, provider === "google" ? "user" : "model");
            assert.equal(body.generationConfig.temperature, provider === "google" ? undefined : 0.4);
          }
          for (const model of ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-5.4-pro", "gpt-5.5-pro"]) {
            const body = await request("openai", model, "none", tools);
            assert.equal(body.temperature, undefined);
            assert.equal(body.top_p, undefined);
            assert.ok((body.reasoning?.effort ?? body.reasoning_effort) !== "none");
          }
          for (const provider of ["custom", "nanogpt", "openrouter"]) {
            for (const model of ["kimi-k3", "kimi-k2.6", "mimo-v2.5-pro"]) {
              const body = await request(provider, model, "medium", tools);
              assert.equal(body.temperature, undefined);
              assert.equal(body.top_p, undefined);
              assert.equal(body.reasoning?.effort ?? body.reasoning_effort, model === "kimi-k3" ? "high" : undefined);
              if (model.startsWith("kimi")) {
                assert.equal(body.frequency_penalty, undefined);
                assert.equal(body.presence_penalty, undefined);
              }
            }
          }
          for (const model of ["gpt-6-astra", "gpt-6.1-sol", "gpt-6.2-sol", "gpt-6.2-astra", "kimi-k3"]) {
            const body = await request("custom", model, "none", tools);
            assert.equal(body.reasoning_effort, "low");
            assert.equal(body.chat_template_kwargs?.enable_thinking, undefined);
          }
          for (const model of ["gpt-5.2-codex", "gpt-5.3-codex"]) {
            const body = await request("openai", model, "none", tools);
            assert.equal(body.reasoning?.effort ?? body.reasoning_effort, "medium");
            assert.equal(body.temperature, undefined);
            assert.equal(body.top_p, undefined);
          }
          const openai = await request("openai", "gpt-4o", "none", tools);
          assert.equal(openai.messages.at(-1).reasoning_content, undefined);
          assert.equal(openai.messages.at(-1).partial, undefined);
          const cohere = await request("cohere", "command-a-plus-08-2025", "high", tools);
          assert.equal(cohere.model, "command-a-plus-05-2026");
          assert.equal(cohere.reasoning_effort, "high");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "provider concurrency failures remain visible in generation and agent messages",
    run() {
      const providerMessage = "Provider concurrency limit exceeded for this account";
      assert.match(formatGenerationParameterError(providerMessage), /Provider message: Provider concurrency limit/);
      assert.match(formatGenerationParameterError("Too many parallel requests"), /concurrency limit was reached/);
      assert.match(
        formatGenerationParameterError("Simultaneous generations limit reached"),
        /concurrency limit was reached/,
      );
      assert.equal(
        formatAgentFailuresToast([
          toAgentFailure({ agentType: "illustrator", agentName: "Illustrator", error: providerMessage }),
        ]),
        "Illustrator failed: Concurrency limit: Provider concurrency limit exceeded for this account. Use Retry Failed Agents in the Agents menu to try again.",
      );
      assert.equal(
        toAgentFailure({ agentType: "illustrator", error: "Too many parallel generations" }).reasonLabel,
        "Concurrency limit",
      );
    },
  },
  {
    name: "a Gemini thought signature refusal is not sent hunting for a setting",
    run() {
      const providerMessage =
        "Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly.";
      const hint = formatGenerationParameterError(providerMessage);
      assert.doesNotMatch(hint, /turn on Send for/);
      assert.match(hint, /not a setting/);
      assert.match(hint, /Provider message: Function call is missing a thought_signature/);
      // A signature that is there but spoiled is the provider's own message.
      assert.equal(formatGenerationParameterError("Corrupted thought signature."), "Corrupted thought signature.");
    },
  },
  {
    name: "reference prompt suppression requires explicit local providers and fallback-safe routing",
    run() {
      for (const service of ["comfyui", "automatic1111", "drawthings"]) {
        assert.equal(suppressesReferencePromptLine({ imageService: service }), true);
        assert.equal(suppressesReferencePromptLine({ imageGenerationSource: service }), true);
      }

      assert.equal(suppressesReferencePromptLine({ baseUrl: "http://127.0.0.1:8188" }), true);
      assert.equal(suppressesReferencePromptLine({ baseUrl: "http://localhost:7860/sdapi/v1" }), true);
      assert.equal(suppressesReferencePromptLine({ baseUrl: "http://[::1]:8188" }), true);
      assert.equal(suppressesReferencePromptLine({ baseUrl: "https://images.example.com:8188" }), false);
      assert.equal(suppressesReferencePromptLine({ baseUrl: "https://images.example.com/api/:7860" }), false);
      assert.equal(suppressesReferencePromptLine({ imageService: "proxy:8188" }), false);
      assert.equal(suppressesReferencePromptLine({ baseUrl: "http://localhost:81880" }), false);

      const localPrimary = { imageService: "comfyui" };
      assert.equal(
        suppressesReferencePromptLine(localPrimary, {
          serviceHint: "openai",
          baseUrl: "https://api.openai.com/v1",
        }),
        false,
      );
      assert.equal(
        suppressesReferencePromptLine(localPrimary, {
          serviceHint: "automatic1111",
          baseUrl: "http://localhost:7860",
        }),
        true,
      );
    },
  },
];

await runNamedCases(cases);
