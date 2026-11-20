import assert from "node:assert/strict";
import {
  isMistralAdjustableReasoningModel,
  isMistralGlm53Model,
  resolveProviderReasoningEffort,
} from "../../packages/shared/src/constants/model-lists.js";
import { createLLMProvider } from "../../packages/server/src/services/llm/provider-registry.js";
import type { ChatMessage, ChatOptions } from "../../packages/server/src/services/llm/base-provider.js";

// #7164: Mistral Large 4 through the "mistral" provider. A local stub answers the way Mistral's Chat Completions API
// does (https://docs.mistral.ai/capabilities/reasoning): with reasoning_effort "high" the content is a list of a
// ThinkChunk and a TextChunk, streamed as chunk lists until the answer turns into plain string deltas. After a final
// `prefix: true` assistant message it starts its reply with that prefix (https://docs.mistral.ai/guides/prefix). No
// live call.
const THINKING = "Checking the scene.";
const ANSWER = "The experiment is ready.";
const PREFILL = "Sure,";
const usage = { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 };
const thinkChunk = (text: string) => ({ type: "thinking", thinking: [{ type: "text", text }] });
type SentMessage = { role: string; tool_call_id?: string; tool_calls?: Array<{ id: string }> };

const bodies: Array<Record<string, unknown>> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  bodies.push(body);
  const reasons = body.reasoning_effort === "high";
  const last = (body.messages as Array<Record<string, unknown>>).at(-1);
  // The stub repeats only the fixed PREFILL; any other prefix is answered without a repeat.
  const echo = last?.prefix === true && last.content === PREFILL ? PREFILL : "";
  if (!body.stream) {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: reasons ? [thinkChunk(THINKING), { type: "text", text: echo + ANSWER }] : echo + ANSWER,
            },
            finish_reason: "stop",
          },
        ],
        usage,
      }),
      { headers: { "content-type": "application/json" } },
    );
  }
  // The repeated prefix arrives split across deltas, and across the thinking-to-answer switch.
  const text = echo
    ? [echo.slice(0, 2), `${echo.slice(2)}The `, "experiment is ready."]
    : ["The ", "experiment is ready."];
  const deltas = reasons
    ? [
        { role: "assistant", content: [thinkChunk("Checking ")] },
        { content: [thinkChunk("the scene")] },
        { content: [thinkChunk("."), { type: "text", text: text[0] }] },
        ...text.slice(1).map((content) => ({ content })),
      ]
    : text.map((content, index) => (index === 0 ? { role: "assistant", content } : { content }));
  const chunks = deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`);
  // Mistral reports usage on its last chunk without stream_options.
  return new Response(
    chunks.join("") +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: "" }, finish_reason: "stop" }], usage })}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
};

try {
  const baseUrl = "http://127.0.0.1:7860/v1";
  const mistral = createLLMProvider("mistral", baseUrl, "fixture");
  const lastBody = () => {
    const body = bodies.at(-1);
    assert.ok(body, "the stub received a request");
    return body;
  };
  const user: ChatMessage[] = [{ role: "user", content: "Continue." }];

  // Which models take reasoning_effort, and what Marinara's levels become.
  for (const model of [
    "mistral-large-4-0",
    "mistral-large-4",
    "mistral-medium-3-5",
    "mistral-medium-3.5",
    "mistral-small-latest",
  ]) {
    assert.equal(isMistralAdjustableReasoningModel(model), true, `${model} takes reasoning_effort`);
  }
  for (const model of [
    "magistral-medium-latest",
    "mistral-large-latest",
    "mistral-large-2411",
    "mistral-large-40",
    "mistral-small-2506",
    "mistralai/mistral-large-4",
  ]) {
    assert.equal(isMistralAdjustableReasoningModel(model), false, `${model} keeps its own reasoning behaviour`);
  }
  for (const level of ["low", "medium", "high", "xhigh", "maximum"] as const) {
    assert.equal(
      resolveProviderReasoningEffort({ provider: "mistral", model: "mistral-large-4-0", reasoningEffort: level }),
      level === "low" || level === "medium" ? level : "high",
      `${level} maps to a documented Mistral Large 4 level`,
    );
  }
  assert.equal(
    resolveProviderReasoningEffort({ provider: "mistral", model: "mistral-large-4-0", reasoningEffort: "none" }),
    "high",
  );
  // GLM 5.3 on Mistral always reasons and takes "low", "high" or "max".
  assert.equal(isMistralGlm53Model("zai-glm-5-3"), true);
  assert.equal(isMistralGlm53Model("glm-5.3"), false);
  assert.equal(isMistralAdjustableReasoningModel("zai-glm-5-3"), false);
  for (const [level, sentLevel] of [
    ["low", "low"],
    ["medium", "high"],
    ["high", "high"],
    ["xhigh", "max"],
    ["maximum", "max"],
  ] as const) {
    assert.equal(
      resolveProviderReasoningEffort({ provider: "mistral", model: "zai-glm-5-3", reasoningEffort: level }),
      sentLevel,
      `GLM 5.3 ${level}`,
    );
  }
  assert.equal(
    resolveProviderReasoningEffort({
      provider: "openrouter",
      model: "mistralai/mistral-large-4",
      reasoningEffort: "low",
    }),
    "low",
    "other providers serving Mistral models are unchanged",
  );

  // Request fields: only what Mistral accepts, with reasoning_effort mapped onto "high" | "none".
  const requestOptions: ChatOptions = {
    model: "mistral-large-4-0",
    stream: true,
    maxTokens: 500,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    minP: 0.1,
    frequencyPenalty: 0.2,
    presencePenalty: 0.3,
    stop: ["END"],
    serviceTier: "flex",
    verbosity: "low",
    reasoningEffort: "xhigh",
    enabledParameters: { topK: true, reasoningEffort: true, verbosity: true },
  };
  for await (const _chunk of mistral.chat(user, requestOptions)) {
    // drain
  }
  const sent = lastBody();
  assert.equal(sent.reasoning_effort, "high");
  assert.equal(sent.max_tokens, 500);
  assert.equal(sent.temperature, 0.7);
  assert.equal(sent.top_p, 0.9);
  assert.equal(sent.frequency_penalty, 0.2);
  assert.equal(sent.presence_penalty, 0.3);
  assert.deepEqual(sent.stop, ["END"]);
  for (const field of [
    "stream_options",
    "seed",
    "max_completion_tokens",
    "logit_bias",
    "user",
    "top_k",
    "min_p",
    "service_tier",
    "verbosity",
    "prompt_mode",
    "reasoning",
  ]) {
    assert.equal(field in sent, false, `Mistral never receives ${field}`);
  }

  const sentEffort = async (model: string, reasoningEffort: ChatOptions["reasoningEffort"]) => {
    await mistral.chatComplete(user, { model, stream: false, reasoningEffort });
    return lastBody().reasoning_effort;
  };
  assert.equal(await sentEffort("mistral-large-4-0", "low"), "low");
  assert.equal(await sentEffort("mistral-large-4-0", "none"), "high", "Off resolves to the documented default");
  assert.equal(await sentEffort("mistral-large-4-0", undefined), undefined, "no level leaves Mistral's default");
  assert.equal(await sentEffort("magistral-medium-latest", "high"), undefined);
  assert.equal(await sentEffort("magistral-medium-latest", "none"), undefined);
  assert.equal(await sentEffort("mistral-large-latest", "high"), undefined);
  assert.equal(await sentEffort("unknown-mistral", "none"), undefined);
  assert.equal(await sentEffort("zai-glm-5-3", "none"), "low", "GLM 5.3 cannot turn reasoning off");
  assert.equal(await sentEffort("zai-glm-5-3", "medium"), "high");
  assert.equal(await sentEffort("zai-glm-5-3", "max"), "max");
  assert.equal(await sentEffort("zai-glm-5-3", undefined), undefined);

  // A prompt_mode set in Custom Parameters is never sent together with reasoning_effort.
  await mistral.chatComplete(user, {
    model: "mistral-large-4-0",
    stream: false,
    reasoningEffort: "high",
    customParameters: { prompt_mode: "reasoning" },
  });
  assert.equal(lastBody().prompt_mode, "reasoning");
  assert.equal("reasoning_effort" in lastBody(), false);

  // A final assistant message (Assistant Prefill) is sent as a Mistral prefix, without reasoning fields that another
  // provider saved; a system message right after an assistant turn goes as a user message.
  const history: ChatMessage[] = [
    { role: "system", content: "You are the narrator." },
    { role: "user", content: "Hello." },
    { role: "assistant", content: "Hi.", providerMetadata: { reasoning_content: "Earlier thinking." } },
    { role: "system", content: "[Author's note]" },
    { role: "system", content: "[Lore]" },
    { role: "user", content: "Continue.", images: ["data:image/png;base64,iVBORw0KGgo="] },
    { role: "assistant", content: PREFILL, providerMetadata: { reasoning_content: "pre-think", partial: true } },
  ];
  await mistral.chatComplete(history, { model: "mistral-large-4-0", stream: false });
  assert.deepEqual(lastBody().messages, [
    { role: "system", content: "You are the narrator." },
    { role: "user", content: "Hello." },
    { role: "assistant", content: "Hi." },
    { role: "user", content: "[Author's note]" },
    { role: "system", content: "[Lore]" },
    {
      role: "user",
      content: [
        { type: "text", text: "Continue." },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
      ],
    },
    { role: "assistant", content: PREFILL, prefix: true },
  ]);

  const runChat = async (messages: ChatMessage[], options: ChatOptions) => {
    const generator = mistral.chat(messages, options);
    let text = "";
    let step = await generator.next();
    while (!step.done) {
      assert.equal(typeof step.value, "string");
      text += step.value;
      step = await generator.next();
    }
    return { text, usage: step.value || undefined };
  };

  // ThinkChunk/TextChunk replies: the thinking reaches onThinking and only the text becomes the reply, through both
  // entry points, streamed and not. Without reasoning the content is a plain string. After a prefix, Mistral's repeat
  // of it is dropped, so callers get only the continuation.
  for (const [conversation, messages] of [
    ["plain", user],
    ["prefix", history],
  ] as const) {
    for (const reasoningEffort of ["high", "none"] as const) {
      const expectedThinking = THINKING;
      for (const stream of [true, false]) {
        let thinking = "";
        let streamed = "";
        const options: ChatOptions = {
          model: "mistral-large-4-0",
          stream,
          reasoningEffort,
          onThinking: (chunk) => {
            thinking += chunk;
          },
        };
        const complete = await mistral.chatComplete(messages, {
          ...options,
          onToken: stream
            ? (chunk) => {
                streamed += chunk;
              }
            : undefined,
        });
        const label = `${conversation} chatComplete effort=${reasoningEffort} stream=${stream}`;
        assert.equal(complete.content, ANSWER, label);
        assert.equal(complete.finishReason, "stop", label);
        assert.equal(complete.usage?.totalTokens, 50, `${label} reads usage`);
        assert.equal(complete.providerMetadata, undefined, `${label} keeps nothing to replay`);
        if (stream) assert.equal(streamed, ANSWER, label);
        assert.equal(thinking, expectedThinking, label);

        thinking = "";
        const chatLabel = `${conversation} chat effort=${reasoningEffort} stream=${stream}`;
        const { text, usage: chatUsage } = await runChat(messages, options);
        assert.equal(text, ANSWER, chatLabel);
        assert.ok(!text.includes("[object Object]"));
        assert.equal(thinking, expectedThinking, chatLabel);
        assert.equal(chatUsage?.totalTokens, 50, `${chatLabel} usage`);
      }
    }
  }

  // A reply that does not repeat the prefix is passed on whole, including one that matches the prefix only partly
  // and is held back until the stream ends.
  for (const prefix of ["Well,", `${ANSWER} And more.`]) {
    const messages: ChatMessage[] = [...user, { role: "assistant", content: prefix }];
    for (const stream of [true, false]) {
      const label = `prefix ${JSON.stringify(prefix)} stream=${stream}`;
      let streamed = "";
      const complete = await mistral.chatComplete(messages, {
        model: "mistral-large-4-0",
        stream,
        onToken: stream
          ? (chunk) => {
              streamed += chunk;
            }
          : undefined,
      });
      assert.deepEqual((lastBody().messages as unknown[]).at(-1), { role: "assistant", content: prefix, prefix: true });
      assert.equal(complete.content, ANSWER, `${label} chatComplete`);
      if (stream) assert.equal(streamed, ANSWER, `${label} chatComplete tokens`);
      assert.equal((await runChat(messages, { model: "mistral-large-4-0", stream })).text, ANSWER, `${label} chat`);
    }
  }

  // Tool calls replay with Mistral's 9-character ids: its own ids are kept, and ids it did not issue (calls read from
  // reply text, a fallback connection's calls) get the same 9-character id on the call and on its result. A final tool
  // result is not a prefix.
  const textToolId = "text_tool_1759750000000_0_roll";
  const toolHistory: ChatMessage[] = [
    { role: "user", content: "Roll." },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "abcDEF123", type: "function", function: { name: "roll", arguments: "{}" } },
        { id: textToolId, type: "function", function: { name: "roll", arguments: "{}" } },
      ],
    },
    { role: "tool", content: "4", tool_call_id: "abcDEF123" },
    { role: "tool", content: "2", tool_call_id: textToolId },
  ];
  await mistral.chatComplete(toolHistory, { model: "mistral-large-4-0", stream: false });
  const toolMessages = (lastBody().messages as SentMessage[]).slice(1);
  const reshapedId = toolMessages[0]?.tool_calls?.[1]?.id ?? "";
  assert.match(reshapedId, /^[a-zA-Z0-9]{9}$/);
  assert.deepEqual(toolMessages, [
    {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "abcDEF123", type: "function", function: { name: "roll", arguments: "{}" } },
        { id: reshapedId, type: "function", function: { name: "roll", arguments: "{}" } },
      ],
    },
    { role: "tool", content: "4", tool_call_id: "abcDEF123" },
    { role: "tool", content: "2", tool_call_id: reshapedId },
  ]);
  await mistral.chatComplete(toolHistory, { model: "mistral-large-4-0", stream: false });
  assert.equal(
    (lastBody().messages as SentMessage[])[1]?.tool_calls?.[1]?.id,
    reshapedId,
    "the same id is reshaped the same way every round",
  );

  // Other providers keep their request shape for the same model name and history.
  const custom = createLLMProvider("custom", baseUrl, "fixture");
  for await (const _chunk of custom.chat(history, {
    model: "mistral-large-4-0",
    stream: true,
    reasoningEffort: "high",
  })) {
    // drain
  }
  const customBody = lastBody();
  assert.deepEqual(customBody.stream_options, { include_usage: true });
  assert.equal("reasoning_effort" in customBody, false);
  const customMessages = customBody.messages as Array<Record<string, unknown>>;
  assert.equal(customMessages[3]?.role, "system");
  assert.deepEqual(customMessages.at(-1), {
    role: "assistant",
    content: PREFILL,
    reasoning_content: "pre-think",
    partial: true,
  });
  await custom.chatComplete(toolHistory, { model: "mistral-large-4-0", stream: false });
  const customToolMessages = lastBody().messages as SentMessage[];
  assert.equal(customToolMessages[1]?.tool_calls?.[1]?.id, textToolId, "other providers keep tool-call ids");
  assert.equal(customToolMessages[3]?.tool_call_id, textToolId);

  // OpenRouter serving a Mistral model is not the native provider: its request keeps the OpenAI shape.
  const openrouter = createLLMProvider("openrouter", baseUrl, "fixture");
  for await (const _chunk of openrouter.chat(history, {
    model: "mistralai/mistral-large-4",
    stream: true,
    reasoningEffort: "high",
  })) {
    // drain
  }
  const openrouterBody = lastBody();
  assert.deepEqual(openrouterBody.stream_options, { include_usage: true });
  assert.equal("reasoning_effort" in openrouterBody, false);
  const openrouterMessages = openrouterBody.messages as Array<Record<string, unknown>>;
  assert.ok(openrouterMessages.every((message) => !("prefix" in message)));
  assert.equal(openrouterMessages[3]?.role, "system");
  assert.deepEqual(openrouterMessages.at(-1), {
    role: "assistant",
    content: PREFILL,
    reasoning_content: "pre-think",
    partial: true,
  });

  console.info("Mistral Large 4 requests, reasoning levels, prefixes, tool ids and ThinkChunk replies passed.");
} finally {
  globalThis.fetch = originalFetch;
}
