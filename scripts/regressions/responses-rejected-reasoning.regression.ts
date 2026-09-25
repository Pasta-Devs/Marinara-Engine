import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

type Input = Record<string, unknown>;
type Body = { input: Input[]; stream?: boolean; model: string };
const requests: Body[] = [];
const reasoning = (id: string) => ({ type: "reasoning", id, encrypted_content: `signed-${id}`, summary: [] });
const valid = reasoning("rs_valid");
const rejected = reasoning("rs_rejected");
const fresh = reasoning("rs_fresh");
let rejection: "index" | "id" | "unspecified" | "server" | "none" = "index";
let failEveryRequest = false;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Body;
  requests.push(body);
  const rejectedIndex = body.input.findIndex((item) => item.id === rejected.id);
  if (failEveryRequest || (rejection !== "none" && rejectedIndex >= 0)) {
    response.statusCode = rejection === "server" ? 500 : 400;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          message: `The encrypted content${rejection === "id" ? ` for '${rejected.id}'` : ""} could not be verified.`,
          ...(rejection === "index" ? { param: `input[${rejectedIndex}].encrypted_content` } : {}),
        },
      }),
    );
    return;
  }
  const call = { type: "function_call", id: "fc_lookup", call_id: "fc_lookup", name: "lookup", arguments: "{}" };
  const message = { type: "message", role: "assistant", content: [{ type: "output_text", text: "Result" }] };
  const result = { status: "completed", output: [fresh, message, call] };
  if (body.stream) {
    response.setHeader("content-type", "text/event-stream");
    response.end(
      [
        { type: "response.output_item.done", item: fresh },
        { type: "response.output_text.delta", delta: "Result" },
        { type: "response.output_item.done", item: call },
        { type: "response.completed", response: result },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(""),
    );
  } else {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const createProvider = () => new OpenAIProvider(`http://127.0.0.1:${address.port}/v1`, "synthetic");
  const history: ChatMessage[] = [
    { role: "user", content: "Earlier turn" },
    { role: "assistant", content: "Earlier answer", providerMetadata: { encryptedReasoning: [valid, rejected] } },
    { role: "user", content: "Next turn" },
  ];
  const savedHistory = JSON.stringify(history);
  const ids = (body: Body) => body.input.filter((item) => item.type === "reasoning").map((item) => item.id);
  const options = {
    model: "gpt-6-astra",
    reasoningEffort: "medium",
    encryptedReasoningItems: [rejected],
  } satisfies ChatOptions;
  for (const stream of [false, true]) {
    for (const method of ["chat", "chatComplete"] as const) {
      for (const identifiedBy of ["index", "id"] as const) {
        requests.length = 0;
        rejection = identifiedBy;
        const provider = createProvider();
        const run = async (messages = history, model = options.model) => {
          const requestOptions = { ...options, model, stream };
          if (method === "chatComplete") return provider.chatComplete(messages, requestOptions);
          for await (const _token of provider.chat(messages, requestOptions)) {
            /* consume the stream */
          }
          return undefined;
        };
        const result = await run();
        assert.equal(requests.length, 2, "An explicit encrypted-content rejection permits one retry");
        assert.deepEqual(ids(requests[1]!), [valid.id], "Only the identified bad item is removed from the retry");
        assert.equal(JSON.stringify(history), savedHistory, "Saved thoughts and provider metadata stay untouched");
        const followup = result
          ? [
              ...history,
              {
                role: "assistant" as const,
                content: result.content ?? "",
                tool_calls: result.toolCalls,
                providerMetadata: result.providerMetadata,
              },
              { role: "tool" as const, content: "Lookup result", tool_call_id: "fc_lookup" },
            ]
          : [
              ...history,
              { role: "assistant" as const, content: "Result", providerMetadata: { encryptedReasoning: [fresh] } },
            ];
        await run(followup);
        assert.equal(
          requests.length,
          3,
          "The next tool/request round must not replay a rejected history or legacy item",
        );
        assert.deepEqual(ids(requests[2]!), [valid.id, fresh.id], "Valid old and new reasoning still replay");
        await run(history, "gpt-5.6");
        assert.equal(requests.length, 5, "Rejections must not transfer to another model");
      }
    }
  }
  rejection = "unspecified";
  requests.length = 0;
  const genericProvider = createProvider();
  await genericProvider.chatComplete(history, { ...options, stream: false });
  await genericProvider.chatComplete(history, { ...options, stream: false });
  assert.equal(requests.length, 3, "An unspecified rejection keeps the existing batch fallback within this session");
  assert.deepEqual(ids(requests[1]!), []);
  assert.deepEqual(ids(requests[2]!), []);
  await createProvider().chatComplete(history, { ...options, stream: false });
  assert.equal(requests.length, 5, "A new provider instance can retry saved items; rejection state is not persisted");
  requests.length = 0;
  failEveryRequest = true;
  await assert.rejects(createProvider().chatComplete(history, { ...options, stream: false }));
  assert.equal(requests.length, 2, "The fallback must not loop if its retry also fails");
  failEveryRequest = false;
  rejection = "server";
  requests.length = 0;
  const transientProvider = createProvider();
  await assert.rejects(transientProvider.chatComplete(history, { ...options, stream: false }));
  assert.equal(requests.length, 1, "Server failures must not trigger encrypted-content recovery");
  rejection = "none";
  await transientProvider.chatComplete(history, { ...options, stream: false });
  assert.deepEqual(ids(requests[1]!), [valid.id, rejected.id], "Transient failures must not invalidate signed history");
  const bounded = createProvider() as unknown as {
    stripEncryptedItems(body: Body, errorText: string, model: string): void;
    rejectedEncryptedReasoning: Set<string>;
  };
  const largeBatch: Body = {
    model: options.model,
    input: [
      { role: "user", content: "Keep the prompt" },
      ...Array.from({ length: 257 }, (_, i) => reasoning(`rs_${i}`)),
    ],
  };
  bounded.stripEncryptedItems(largeBatch, "The encrypted content could not be verified.", options.model);
  assert.equal(
    bounded.rejectedEncryptedReasoning.size,
    256,
    "Rejection state is bounded even for a long-lived instance",
  );
  assert.deepEqual(
    largeBatch.input,
    [{ role: "user", content: "Keep the prompt" }],
    "Cache eviction must not retain rejected items in the immediate retry",
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Responses rejected reasoning regression passed");
