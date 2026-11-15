import assert from "node:assert/strict";
import { DEFAULT_AGENT_TOOLS } from "../../../packages/shared/src/index.js";
import { isChatToolEnabledByDefault } from "../../../packages/server/src/services/generation/tool-resolution-runtime.js";
import {
  createCustomToolArgumentsValidator,
  executeToolCalls,
  formatToolExecutionResultForModel,
} from "../../../packages/server/src/services/tools/tool-executor.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "custom tool validators isolate schema identifiers and reject async schemas",
    run() {
      const schema = {
        $id: "https://marinara.invalid/regression-tool.schema.json",
        type: "object",
        properties: {
          action: { type: "string" },
        },
        required: ["action"],
      };
      const firstValidator = createCustomToolArgumentsValidator(schema);
      const secondValidator = createCustomToolArgumentsValidator({ ...schema });

      assert.equal(firstValidator({ action: "retry" }), null);
      assert.equal(secondValidator({ action: "retry" }), null);
      assert.match(firstValidator({}) ?? "", /required property 'action'/u);
      assert.throws(
        () =>
          createCustomToolArgumentsValidator({
            $async: true,
            type: "object",
            properties: {},
          }),
        /Async tool parameter schemas are not supported/u,
      );
    },
  },
  {
    name: "built-in tool schemas reject malformed and invalid arguments while allowing valid calls",
    async run() {
      const results = await executeToolCalls([
        {
          id: "call_malformed_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "{",
          },
        },
        {
          id: "call_array_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "[]",
          },
        },
        {
          id: "call_missing_roll_dice_argument",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: "{}",
          },
        },
        {
          id: "call_valid_roll_dice",
          type: "function",
          function: {
            name: "roll_dice",
            arguments: JSON.stringify({ notation: "1d2" }),
          },
        },
        {
          id: "call_missing_spotify_play_target",
          type: "function",
          function: {
            name: "spotify_play",
            arguments: JSON.stringify({ reason: "No track supplied" }),
          },
        },
        {
          id: "call_combined_spotify_play",
          type: "function",
          function: {
            name: "spotify_play",
            arguments: JSON.stringify({
              uri: "spotify:track:lead",
              uris: ["spotify:track:queued"],
            }),
          },
        },
      ]);

      assert.equal(results[0]?.success, false);
      assert.match(results[0]!.result, /expected valid JSON/u);
      assert.equal(results[1]?.success, false);
      assert.match(results[1]!.result, /expected a JSON object/u);
      assert.equal(results[2]?.success, false);
      assert.match(results[2]!.result, /required property 'notation'/u);
      assert.equal(results[3]?.success, true);
      assert.equal((JSON.parse(results[3]!.result) as { notation: string }).notation, "1d2");
      assert.equal(results[4]?.success, false);
      assert.match(results[4]!.result, /Invalid arguments/u);
      assert.equal(results[5]?.success, false);
      assert.doesNotMatch(results[5]!.result, /Invalid arguments/u);
      assert.match(results[5]!.result, /Spotify not configured/u);
    },
  },
  {
    name: "custom schema validation blocks invalid webhooks and reports semantic failures",
    async run() {
      const originalFetch = globalThis.fetch;
      const previousAllowLocal = process.env.WEBHOOK_LOCAL_URLS_ENABLED;
      const conflictPayload = { message: "Retry later", retryable: true };
      let fetchCalls = 0;
      process.env.WEBHOOK_LOCAL_URLS_ENABLED = "true";
      globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
        fetchCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          arguments?: { action?: string };
        };
        if (body.arguments?.action === "conflict") {
          return new Response(JSON.stringify(conflictPayload), {
            status: 409,
          });
        }
        if (body.arguments?.action === "reported_error") {
          return new Response(JSON.stringify({ error: "Webhook rejected the request" }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ accepted: true }), {
          status: 200,
        });
      }) as typeof fetch;

      try {
        const customTool = {
          name: "regression_webhook",
          executionType: "webhook",
          webhookUrl: "http://127.0.0.1/regression",
          staticResult: null,
          scriptBody: null,
          validateArguments: createCustomToolArgumentsValidator({
            type: "object",
            properties: {
              action: { type: "string" },
              target: { type: "string", format: "email" },
            },
            required: ["action", "target"],
            additionalProperties: false,
          }),
        };
        const results = await executeToolCalls(
          [
            {
              id: "call_missing_custom_webhook_argument",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: "{}",
              },
            },
            {
              id: "call_invalid_custom_webhook_format",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "accepted", target: "not-an-email" }),
              },
            },
            {
              id: "call_failed_custom_webhook",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "conflict", target: "retry@example.com" }),
              },
            },
            {
              id: "call_reported_custom_webhook_error",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "reported_error", target: "retry@example.com" }),
              },
            },
            {
              id: "call_successful_custom_webhook",
              type: "function",
              function: {
                name: "regression_webhook",
                arguments: JSON.stringify({ action: "accepted", target: "accepted@example.com" }),
              },
            },
          ],
          { customTools: [customTool] },
        );

        assert.equal(results[0]?.success, false);
        assert.match(results[0]!.result, /required property 'action'/u);
        assert.equal(results[1]?.success, false);
        assert.match((JSON.parse(results[1]!.result) as { error: string }).error, /format "email"/u);
        assert.equal(results[2]?.success, false);
        assert.deepEqual(JSON.parse(results[2]!.result), conflictPayload);
        assert.equal(results[2]?.httpStatus, 409);
        assert.deepEqual(JSON.parse(formatToolExecutionResultForModel(results[2]!)), {
          error: "Tool request failed with HTTP status 409",
          success: false,
          httpStatus: 409,
          response: conflictPayload,
        });
        assert.equal(results[3]?.success, false);
        assert.deepEqual(JSON.parse(results[3]!.result), { error: "Webhook rejected the request" });
        assert.equal(results[4]?.success, true);
        assert.deepEqual(JSON.parse(results[4]!.result), { accepted: true });
        assert.equal(formatToolExecutionResultForModel(results[4]!), results[4]!.result);
        assert.equal(fetchCalls, 3);
      } finally {
        globalThis.fetch = originalFetch;
        if (previousAllowLocal === undefined) {
          delete process.env.WEBHOOK_LOCAL_URLS_ENABLED;
        } else {
          process.env.WEBHOOK_LOCAL_URLS_ENABLED = previousAllowLocal;
        }
      }
    },
  },
  {
    name: "Spotify tools stay agent-owned when chat function calls are enabled",
    run() {
      for (const toolName of DEFAULT_AGENT_TOOLS.spotify ?? []) {
        assert.equal(isChatToolEnabledByDefault(toolName), false, `${toolName} must require Music DJ selection`);
      }
      assert.equal(isChatToolEnabledByDefault("roll_dice"), true);
    },
  },
];

await runNamedCases(cases);
