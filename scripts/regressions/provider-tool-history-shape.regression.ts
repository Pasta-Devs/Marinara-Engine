// An OpenAI-typed connection in front of an Anthropic-backed proxy refuses the `tool` role in replayed history
// (LinkAPI: `messages: Unexpected role "tool". Allowed roles are "user", "assistant" or "system"`). The provider must
// retry once with the tool rounds retold as text, keep native `tools` requested, and remember the endpoint so later
// rounds skip the refusal. A plain 429 must still be a plain 429.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { LLMHttpError } from "../../packages/server/src/services/llm/base-provider.js";
import { OpenAIProvider } from "../../packages/server/src/services/llm/providers/openai.provider.js";

const tools = [
  {
    type: "function" as const,
    function: { name: "lorebook_list", description: "List entries", parameters: { type: "object", properties: {} } },
  },
];

type WireMessage = { role?: string; content?: unknown; tool_calls?: unknown[]; tool_call_id?: string };
type WireRequest = { model?: string; messages: WireMessage[]; tools: unknown[] };
const requests: WireRequest[] = [];
let rateLimitOnly = false;

const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as WireRequest;
  requests.push(body);
  response.setHeader("content-type", "application/json");
  if (rateLimitOnly || (body.messages ?? []).some((message) => message.role === "tool")) {
    response.statusCode = 429;
    response.end(
      JSON.stringify({
        error: rateLimitOnly
          ? { message: "Rate limit exceeded, please retry later." }
          : {
              message:
                'messages: Unexpected role "tool". Allowed roles are "user", "assistant" or "system" (request id: 202610302337086847479988268d9d6Omw023bE)',
            },
      }),
    );
    return;
  }
  response.end(JSON.stringify({ choices: [{ message: { content: "Found the entry." }, finish_reason: "stop" }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/v1`;

const user = { role: "user" as const, content: "read Final Fantasy Compendium" };
const assistant = {
  role: "assistant" as const,
  content: "Let me pull up the lorebook handbook and find that compendium.",
  tool_calls: [{ id: "call_list", type: "function", function: { name: "lorebook_list", arguments: "{}" } }],
};
const toolResult = { role: "tool" as const, tool_call_id: "call_list", content: "1 entry: Final Fantasy" };
const history = [user, assistant, toolResult];

const roles = (request: WireRequest) => request.messages.map((message) => String(message.role));
const textOf = (message: WireMessage) =>
  Array.isArray(message.content)
    ? message.content.map((part) => String((part as { text?: unknown }).text ?? "")).join("\n")
    : String(message.content ?? "");

try {
  for (const model of ["claude-opus-4-5-20251101", "proxy-alias-sonnet"]) {
    const provider = new OpenAIProvider(base, "");

    // 1. The refusing round recovers: one refusal, then a retold request that the endpoint accepts.
    const before = requests.length;
    const result = await provider.chatComplete(history, { model, tools, stream: false });
    assert.equal(result.content, "Found the entry.", `${model}: the retried round must return the answer`);
    const sent = requests.slice(before);
    assert.equal(sent.length, 2, `${model}: exactly one refusal and one retry`);
    assert.ok(roles(sent[0]).includes("tool"), `${model}: the first request must carry the refused tool role`);
    assert.ok(!roles(sent[1]).includes("tool"), `${model}: the retried request must not carry a tool role`);
    assert.equal(sent[1].tools.length, 1, `${model}: native tools stay requested after the retell`);
    assert.ok(
      textOf(sent[1].messages[1]!).includes("Let me pull up the lorebook handbook"),
      `${model}: the retold round keeps her words`,
    );
    assert.ok(
      textOf(sent[1].messages[2]!).includes("lorebook_list: 1 entry: Final Fantasy"),
      `${model}: the results still name the call that ran and what it returned`,
    );

    // 2. The endpoint is remembered: the next round goes out retold on the first try, with no refusal.
    const beforeRemembered = requests.length;
    await provider.chatComplete(history, { model, tools, stream: false });
    const remembered = requests.slice(beforeRemembered);
    assert.equal(remembered.length, 1, `${model}: a remembered endpoint must not be refused again`);
    assert.ok(!roles(remembered[0]!).includes("tool"), `${model}: the remembered request is already retold`);

    // 3. A different model on the same endpoint still learns on its own.
    const other = new OpenAIProvider(base, "");
    const beforeOther = requests.length;
    await other.chatComplete(history, { model: `${model}-sibling`, tools, stream: false });
    assert.equal(requests.length - beforeOther, 2, `${model}: the memory is scoped to the model that refused`);
  }

  // 4. A plain rate limit is not a shape problem: no retell, the error reaches the caller as a 429.
  rateLimitOnly = true;
  const limited = new OpenAIProvider(base, "");
  const beforeLimit = requests.length;
  await assert.rejects(
    limited.chatComplete(history, { model: "claude-opus-4-5-20251101", tools, stream: false }),
    (error) => {
      assert.ok(error instanceof LLMHttpError, "a rate limit must surface as the provider's typed error");
      assert.equal(error.status, 429);
      assert.match(error.message, /Rate limit exceeded/);
      return true;
    },
  );
  assert.equal(requests.length - beforeLimit, 1, "a plain 429 must not be reshaped and resent");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Provider tool-history shape regression passed");
