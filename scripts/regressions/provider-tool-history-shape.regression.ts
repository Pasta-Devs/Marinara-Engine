// An OpenAI-typed connection in front of an Anthropic-backed proxy refuses the `tool` role in replayed history
// (LinkAPI: `messages: Unexpected role "tool". Allowed roles are "user", "assistant" or "system"`). The provider must
// retry once with the tool rounds retold as text, keep native `tools` requested, and remember the endpoint so later
// rounds skip the refusal. A refusal that merely names the tool role, and a plain 429, must both stay untouched.
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

/** How the fixture answers. `role-order` is OpenAI's own complaint about a tool row, which is not a refusal of it. */
type Mode =
  | "refuse-tool-role"
  | "rate-limit"
  | "role-order"
  | "role-order-typed"
  | "role-allowed"
  | "role-invalid-conditional"
  | "accept";
let mode: Mode = "refuse-tool-role";

const LINKAPI_WORDING =
  'messages: Unexpected role "tool". Allowed roles are "user", "assistant" or "system" (request id: 202610302337086847479988268d9d6Omw023bE)';
const ANTHROPIC_WORDING =
  "messages.1.role: Input tag 'tool' found using 'role' does not match any of the expected tags: 'user', 'assistant'";
const ROLE_ORDER_WORDING = "messages with role 'tool' must be a response to a preceeding message with 'tool_calls'";
/** The same complaint with the `type` field beside it, so the message ends against a quote and a neighbouring field. */
const TYPED_ROLE_ORDER_PAYLOAD = {
  error: {
    message: "Unexpected role 'user' after role 'tool'",
    type: "invalid_request_error",
    param: "messages",
  },
};
/** Permission, not prohibition: the same vocabulary with the verdict missing. */
const ROLE_ALLOWED_WORDING = "messages: role 'tool' is allowed only after an assistant message with tool_calls";
/** A conditional complaint about the pairing, which does not say the role itself is refused. */
const ROLE_INVALID_CONDITIONAL_WORDING =
  "messages: role 'tool' is invalid without a preceding assistant message with tool_calls";

const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw) as WireRequest;
  requests.push(body);
  response.setHeader("content-type", "application/json");
  const hasToolRow = (body.messages ?? []).some((message) => message.role === "tool");
  if (mode === "rate-limit" || (mode !== "accept" && hasToolRow)) {
    // The proxy reports a schema rejection with the same status it uses for throttling, which is half of why this is
    // hard to read from a screenshot; the other half is that only the body says what is wrong.
    response.statusCode = 429;
    const anthropicWording = /anthropic-wording/u.test(String(body.model ?? ""));
    const message =
      mode === "rate-limit"
        ? "Rate limit exceeded, please retry later."
        : mode === "role-order"
          ? ROLE_ORDER_WORDING
          : anthropicWording
            ? ANTHROPIC_WORDING
            : LINKAPI_WORDING;
    response.end(
      JSON.stringify(
        mode === "role-order-typed"
          ? TYPED_ROLE_ORDER_PAYLOAD
          : mode === "role-allowed"
            ? { error: { message: ROLE_ALLOWED_WORDING } }
            : mode === "role-invalid-conditional"
              ? { error: { message: ROLE_INVALID_CONDITIONAL_WORDING } }
              : { error: { message } },
      ),
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
  // Both wordings the refusal comes in: LinkAPI's own, and Anthropic's tag mismatch, which a proxy that passes the
  // upstream error through hands back unchanged. Neither model id is catalogued on the OpenAI type, so both also
  // exercise the uncatalogued-model path from #8576.
  for (const model of ["claude-opus-4-5-20251101", "proxy-alias-sonnet", "claude-anthropic-wording-opus"]) {
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
  mode = "rate-limit";
  const limited = new OpenAIProvider(base, "");
  const beforeLimit = requests.length;
  await assert.rejects(
    limited.chatComplete(history, { model: "claude-rate-limited-opus", tools, stream: false }),
    (error) => {
      assert.ok(error instanceof LLMHttpError, "a rate limit must surface as the provider's typed error");
      assert.equal(error.status, 429);
      assert.match(error.message, /Rate limit exceeded/);
      return true;
    },
  );
  assert.equal(requests.length - beforeLimit, 1, "a plain 429 must not be reshaped and resent");

  // 5. A refusal that only *names* the tool role (OpenAI's own ordering rule) is not this bug: no retry, and — the
  //    part that would hurt — the healthy endpoint must not be remembered as one that refuses tool history. A fresh
  //    model id, because the loop above remembered the ones it used.
  mode = "role-order";
  const orderOnly = new OpenAIProvider(base, "");
  const beforeOrder = requests.length;
  await assert.rejects(
    orderOnly.chatComplete(history, { model: "claude-role-order-opus", tools, stream: false }),
    (error) => {
      assert.ok(error instanceof LLMHttpError);
      assert.match(error.message, /must be a response to a preceeding message/);
      return true;
    },
  );
  assert.equal(requests.length - beforeOrder, 1, "a mere mention of the tool role must not be reshaped and resent");
  mode = "accept";
  const beforeAccept = requests.length;
  await orderOnly.chatComplete(history, { model: "claude-role-order-opus", tools, stream: false });
  assert.equal(requests.length - beforeAccept, 1, "the accepted call is one request");
  assert.ok(roles(requests.at(-1)!).includes("tool"), "a mere mention of the tool role must not be remembered");

  // 6. The user's next message after a tool round: retelling folds that round's results into a user turn, which would
  //    sit beside the user's next message. This endpoint also wants user and assistant turns to alternate, so the two
  //    are merged instead of leaving a shape it would refuse again.
  mode = "refuse-tool-role";
  const nextTurn = new OpenAIProvider(base, "");
  const conversation = [...history, { role: "user" as const, content: "and the next entry?" }];
  const beforeNext = requests.length;
  await nextTurn.chatComplete(conversation, { model: "claude-alternation-opus", tools, stream: false });
  const sentNext = requests.slice(beforeNext);
  assert.equal(sentNext.length, 2, "one refusal and one retry");
  const retoldRoles = roles(sentNext[1]!);
  assert.ok(!retoldRoles.includes("tool"), "the retried request must not carry a tool role");
  for (let index = 1; index < retoldRoles.length; index += 1) {
    assert.notEqual(retoldRoles[index], retoldRoles[index - 1], "a retold history must still alternate roles");
  }
  // Remembered, the same conversation goes out alternated in a single request.
  const beforeRememberedNext = requests.length;
  await nextTurn.chatComplete(conversation, { model: "claude-alternation-opus", tools, stream: false });
  assert.equal(requests.length - beforeRememberedNext, 1, "the remembered shape is sent once");
  const rememberedRoles = roles(requests.at(-1)!);
  for (let index = 1; index < rememberedRoles.length; index += 1) {
    assert.notEqual(rememberedRoles[index], rememberedRoles[index - 1], "the remembered shape must alternate too");
  }

  // 7. The same complaint carrying `"type":"invalid_request_error"` must not read as a refusal either: the verdict
  //    phrase has to follow the quoted role, and must not be borrowed from the neighbouring JSON field.
  mode = "role-order-typed";
  const typedOrder = new OpenAIProvider(base, "");
  const beforeTyped = requests.length;
  await assert.rejects(
    typedOrder.chatComplete(history, { model: "claude-typed-order-opus", tools, stream: false }),
    /OpenAI API error 429/,
  );
  assert.equal(requests.length - beforeTyped, 1, "a typed role-order error must not be reshaped and resent");
  mode = "accept";
  const beforeTypedAccept = requests.length;
  await typedOrder.chatComplete(history, { model: "claude-typed-order-opus", tools, stream: false });
  assert.equal(requests.length - beforeTypedAccept, 1, "the accepted call is one request");
  assert.ok(roles(requests.at(-1)!).includes("tool"), "a typed role-order error must not be remembered");

  // 8. Permission is not prohibition: `role 'tool' is allowed only after …` uses the same vocabulary and must not be
  //    read as a refusal of the role.
  mode = "role-allowed";
  const allowed = new OpenAIProvider(base, "");
  const beforeAllowed = requests.length;
  await assert.rejects(
    allowed.chatComplete(history, { model: "claude-allowed-role-opus", tools, stream: false }),
    /OpenAI API error 429/,
  );
  assert.equal(requests.length - beforeAllowed, 1, "an allowance must not be reshaped and resent");
  mode = "accept";
  const beforeAllowedAccept = requests.length;
  await allowed.chatComplete(history, { model: "claude-allowed-role-opus", tools, stream: false });
  assert.equal(requests.length - beforeAllowedAccept, 1, "the accepted call is one request");
  assert.ok(roles(requests.at(-1)!).includes("tool"), "an allowance must not be remembered");

  // 9. A conditional complaint about the pairing ("… is invalid without a preceding assistant message") does not say
  //    the role itself is refused, so it must not be remembered as a refusal either.
  mode = "role-invalid-conditional";
  const conditional = new OpenAIProvider(base, "");
  const beforeConditional = requests.length;
  await assert.rejects(
    conditional.chatComplete(history, { model: "claude-conditional-opus", tools, stream: false }),
    /OpenAI API error 429/,
  );
  assert.equal(requests.length - beforeConditional, 1, "a conditional complaint must not be reshaped and resent");
  mode = "accept";
  const beforeConditionalAccept = requests.length;
  await conditional.chatComplete(history, { model: "claude-conditional-opus", tools, stream: false });
  assert.equal(requests.length - beforeConditionalAccept, 1, "the accepted call is one request");
  assert.ok(roles(requests.at(-1)!).includes("tool"), "a conditional complaint must not be remembered");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Provider tool-history shape regression passed");
