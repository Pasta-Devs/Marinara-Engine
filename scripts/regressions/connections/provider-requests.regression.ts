import assert from "node:assert/strict";
import { formatAgentFailuresToast, toAgentFailure } from "../../../packages/client/src/lib/agent-failures.js";
import { formatGenerationParameterError } from "../../../packages/client/src/lib/generation-parameter-errors.js";
import { suppressesReferencePromptLine } from "../../../packages/server/src/routes/generate/illustrator-references.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
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
