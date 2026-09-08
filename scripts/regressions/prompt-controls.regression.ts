import assert from "node:assert/strict";
import { createServer } from "node:http";
import { customRequestHeadersSchema } from "../../packages/shared/src/schemas/prompt.schema.js";
import { postProcessMessages } from "../../packages/server/src/routes/generate/generate-route-utils.js";
import { filterPromptMessagesForCharacterAudience } from "../../packages/server/src/services/generation/prompt-message-scope.js";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";
import type { ChatMessage } from "../../packages/server/src/services/llm/base-provider.js";
import {
  parseIllustratorPromptReviewOverride,
  resolveIllustratorPromptSubmission,
} from "../../packages/server/src/services/image/illustrator-prompt-review.js";

const messages: ChatMessage[] = [
  { role: "system", content: "Rules" },
  { role: "system", content: "World" },
  { role: "user", content: "One", images: ["data:image/png;base64,fixture"] },
  { role: "user", content: "Two", files: [{ type: "application/pdf", data: "fixture" }] },
  { role: "assistant", content: "Three" },
  { role: "assistant", content: "Four" },
];
const unchanged = structuredClone(messages);
assert.deepEqual(
  postProcessMessages(messages).map((m) => m.role),
  ["system", "user", "assistant"],
);
const separate = postProcessMessages(messages, { strictRoleFormatting: false });
assert.deepEqual(
  separate.map((m) => m.role),
  ["system", "user", "user", "assistant", "assistant"],
);
assert.equal(separate[0]?.content, "Rules\n\nWorld");
const single = postProcessMessages(messages, { singleUserMessage: true });
assert.deepEqual(
  single.map((m) => m.role),
  ["system", "user"],
);
assert.equal(single[0]?.content, "Rules\n\nWorld");
assert.equal(single[1]?.content, "[USER]\nOne\n\n[USER]\nTwo\n\n[ASSISTANT]\nThree\n\n[ASSISTANT]\nFour");
assert.deepEqual(single[1]?.images, messages[2]?.images);
assert.deepEqual(single[1]?.files, messages[3]?.files);
assert.deepEqual(messages, unchanged, "formatting must not mutate stored history");
const scoped = filterPromptMessagesForCharacterAudience(
  [
    { role: "system", content: "Rules" },
    { role: "user", content: "Secret", hiddenFromAICharacterIds: ["reader"] },
    { role: "user", content: "Visible" },
  ],
  ["reader"],
);
assert.ok(!JSON.stringify(postProcessMessages(scoped, { singleUserMessage: true })).includes("Secret"));
const scopedSystems = filterPromptMessagesForCharacterAudience(
  [
    { role: "system", content: "PUBLIC_RULES" },
    { role: "system", content: "PRIVATE_RULES", hiddenFromAICharacterIds: ["reader"] },
    { role: "user", content: "VISIBLE_TURN" },
  ],
  ["reader"],
);
for (const parameters of [{}, { strictRoleFormatting: false }, { singleUserMessage: true }]) {
  assert.ok(!JSON.stringify(postProcessMessages(scopedSystems, parameters)).includes("PRIVATE_RULES"));
}
const toolTurns: ChatMessage[] = [
  {
    role: "assistant",
    content: "",
    tool_calls: [{ id: "one", type: "function", function: { name: "lookup", arguments: "{}" } }],
  },
  { role: "tool", content: "result", tool_call_id: "one" },
  { role: "tool", content: "second", tool_call_id: "two" },
];
for (const parameters of [{}, { strictRoleFormatting: false }, { singleUserMessage: true }]) {
  assert.deepEqual(postProcessMessages(toolTurns, parameters), toolTurns);
}

for (const headers of [
  { Authorization: "secret" },
  { "CONTENT-LENGTH": "2" },
  { Cookie: "secret" },
  { "X-API-KEY": "secret" },
  { "Bad Name": "x" },
  { "X-Test": "a\r\nInjected: x" },
  { "X-Test": 42 },
  { "X-Test": "one", "x-test": "two" },
  Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`X-${i}`, "value"])),
])
  assert.equal(customRequestHeadersSchema.safeParse(headers).success, false);
assert.equal(customRequestHeadersSchema.safeParse({ "X-Provider": "one", "anthropic-beta": "feature" }).success, true);

const requests: Array<{ headers: Record<string, unknown>; body: Record<string, unknown> }> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  requests.push({ headers: request.headers, body });
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":null}]}\n\ndata: [DONE]\n\n');
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [{ message: { content: "OK" } }],
        content: [{ type: "text", text: "OK" }],
        candidates: [{ content: { parts: [{ text: "OK" }] } }],
      }),
    );
  }
});
try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  for (const kind of ["custom", "nanogpt", "anthropic", "google"]) {
    const provider = createLLMProvider(
      kind,
      `${origin}/v1`,
      "fixture-key",
      128000,
      null,
      null,
      false,
      false,
      JSON.stringify({ customHeaders: { "X-Provider": "fixture-provider" } }),
    );
    await provider.chatComplete([{ role: "user", content: "hello" }], { model: "fixture", maxTokens: 10 });
    assert.equal(requests.at(-1)?.headers["x-provider"], "fixture-provider", kind);
    assert.equal(requests.at(-1)?.body.customHeaders, undefined);
  }
  for (const kind of ["nanogpt", "openrouter", "custom"]) {
    const provider = createLLMProvider(
      kind,
      `${origin}/${kind === "openrouter" ? "openrouter.ai/" : ""}v1`,
      "fixture-key",
    );
    for (const tier of [null, "flex", "priority"] as const) {
      for (const stream of [false, true]) {
        const options = { model: "fixture", maxTokens: 10, serviceTier: tier, stream };
        if (stream) {
          for await (const _chunk of provider.chat([{ role: "user", content: "hello" }], options)) {
            /* drain */
          }
        } else await provider.chatComplete([{ role: "user", content: "hello" }], options);
        assert.equal(
          requests.at(-1)?.body.service_tier,
          kind === "custom" ? undefined : (tier ?? undefined),
          `${kind}/${tier}/${stream}`,
        );
        assert.equal(requests.at(-1)?.headers["x-provider"], undefined, "headers cannot leak to another connection");
      }
    }
  }
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

const override = parseIllustratorPromptReviewOverride({
  subjectOnly: true,
  prompt: "  cup of tea  ",
  resultData: { prompt: "cup of tea", characters: [] },
});
assert.equal(override?.subjectOnly, true);
assert.deepEqual(
  resolveIllustratorPromptSubmission({
    generatedPrompt: "unrelated scene",
    generatedNegativePrompt: "scene defaults",
    reviewOverride: override,
  }),
  { prompt: "cup of tea", negativePrompt: "" },
);
assert.equal(parseIllustratorPromptReviewOverride({ subjectOnly: "true", prompt: "tea", resultData: {} }), null);
console.info("Prompt controls regressions passed.");
