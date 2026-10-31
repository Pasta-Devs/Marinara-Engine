import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import { GoogleProvider } from "../../packages/server/src/services/llm/providers/google.provider.js";
import { shouldSuppressUnknownModelParameters } from "../../packages/shared/src/constants/model-lists.js";

const tools = [
  {
    type: "function" as const,
    function: { name: "lookup", description: "Read an entry", parameters: { type: "object", properties: {} } },
  },
];
const messages = [{ role: "user" as const, content: "Read the entry." }];
type RequestBody = {
  tools?: unknown[];
  temperature?: number;
  top_p?: number;
  generationConfig?: { temperature?: number; topP?: number };
};
const requests: Array<{ path: string; body: RequestBody }> = [];
let rejectTools = false;
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  const path = request.url!;
  requests.push({ path, body });
  const hasTools = Boolean(body.tools?.length);
  response.setHeader("content-type", "application/json");
  if (hasTools && rejectTools) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: { message: "Tools unsupported by fixture" } }));
    return;
  }
  if (path.includes(":generateContent") || path.includes(":streamGenerateContent")) {
    const payload = JSON.stringify({
      candidates: [
        {
          content: {
            role: "model",
            parts: hasTools ? [{ functionCall: { name: "lookup", args: {} } }] : [{ text: "No tools" }],
          },
          finishReason: "STOP",
        },
      ],
    });
    if (path.includes(":streamGenerateContent")) {
      response.setHeader("content-type", "text/event-stream");
      response.end(`data: ${payload}\n\n`);
    } else response.end(payload);
  } else if (path.endsWith("/responses")) {
    response.end(
      JSON.stringify({
        status: "completed",
        output: hasTools
          ? [{ type: "function_call", call_id: "fc_lookup", name: "lookup", arguments: "{}" }]
          : [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "No tools" }] }],
      }),
    );
  } else {
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: hasTools ? null : "No tools",
              ...(hasTools
                ? { tool_calls: [{ id: "lookup", type: "function", function: { name: "lookup", arguments: "{}" } }] }
                : {}),
            },
            finish_reason: hasTools ? "tool_calls" : "stop",
          },
        ],
      }),
    );
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  for (const kind of ["openai", "google"] as const) {
    const provider = kind === "google" ? new GoogleProvider(base, "") : new OpenAIProvider(`${base}/v1`, "");
    const models = kind === "google" ? ["uncatalogued-gemini"] : ["uncatalogued-proxy-model", "gpt-5.5-uncatalogued"];
    for (const model of models) {
      assert.equal(
        shouldSuppressUnknownModelParameters(kind, model),
        true,
        `${kind}/${model} must exercise suppression`,
      );
      for (const stream of [false, true]) {
        const result = await provider.chatComplete(messages, {
          model,
          tools,
          stream,
          temperature: 0.4,
          topP: 0.7,
          maxTokens: 128,
        });
        const { body } = requests.at(-1)!;
        assert.ok(body.tools?.length, `${kind}/${model}: requested tools must reach the endpoint`);
        assert.equal(result.toolCalls[0]?.function.name, "lookup", `${kind}/${model}: tool call must reach the caller`);
        assert.equal(body.temperature, undefined);
        assert.equal(body.top_p, undefined);
        assert.equal(body.generationConfig?.temperature, undefined);
        assert.equal(body.generationConfig?.topP, undefined);
      }
      await provider.chatComplete(messages, { model, stream: false });
      assert.equal(requests.at(-1)!.body.tools, undefined, "No tools requested means no tools sent");
      if (kind === "openai") {
        for await (const _chunk of provider.chat(messages, { model, tools, stream: false })) {
          // chat() returns text only, but must still preserve the requested protocol.
        }
        assert.ok(requests.at(-1)!.body.tools?.length, "chat() must preserve tools too");
      }
      await provider.chatComplete(messages, { model, tools, forceTextualToolCalls: true, stream: false });
      assert.equal(requests.at(-1)!.body.tools, undefined, "Textual tool mode must not send native tools");
      rejectTools = true;
      await assert.rejects(
        provider.chatComplete(messages, { model, tools, stream: false }),
        /Tools unsupported by fixture/,
      );
      rejectTools = false;
    }
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Unknown-model provider tools regression passed");
