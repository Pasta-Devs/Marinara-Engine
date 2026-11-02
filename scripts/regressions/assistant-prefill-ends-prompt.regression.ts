import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The Assistant Prefill is the last message each provider actually sends, through the real route: after a depth-0
// section, a post-history section and a generation guide, under every Post-Processing mode, after Conversation's group
// reply format and after an earlier in-turn reply in an individual group. A model that refuses a request ending on an
// assistant message (Claude Opus 5.5, strict Gemini) reads it at the start of its last reply in the history instead,
// and the request gains no trailing assistant message or continuation prompt.
const started = performance.now();
const dir = mkdtempSync(join(tmpdir(), "marinara-assistant-prefill-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
// The stub runs on 127.0.0.1; nothing leaves the machine.
process.env.PROVIDER_LOCAL_URLS_ENABLED = "true";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
const { characterDataSchema, buildGuidedGenerationInstructionMessage } =
  await import("../../packages/shared/dist/index.js");

const REPLY = "reply.";
const bodies: Array<Record<string, any>> = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  bodies.push(body);
  const gemini = { candidates: [{ content: { role: "model", parts: [{ text: REPLY }] }, finishReason: "STOP" }] };
  if (request.url?.includes(":generateContent")) {
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(gemini));
    return;
  }
  response.writeHead(200, { "content-type": "text/event-stream" });
  if (request.url?.endsWith("/messages")) {
    const send = (type: string, value: object) =>
      response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
    send("message_start", {
      message: { id: "m", type: "message", role: "assistant", model: body.model, content: [], usage: {} },
    });
    send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    send("content_block_delta", { index: 0, delta: { type: "text_delta", text: REPLY } });
    send("content_block_stop", { index: 0 });
    send("message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } });
    send("message_stop", {});
    response.end();
  } else if (request.url?.includes(":streamGenerateContent")) {
    response.end(`data: ${JSON.stringify(gemini)}\n\n`);
  } else {
    response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: REPLY } }] })}\n\n`);
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  }
});

/** The turns a request body sends, in the provider's own shape: Gemini's "model" turns read as assistant, and the
 *  system text Anthropic and Gemini take apart from the turns comes first. */
const turnsOf = (body: Record<string, any>): Array<{ role: string; text: string }> => {
  const text = (content: unknown) =>
    typeof content === "string"
      ? content
      : (content as Array<{ text?: string }>).map((part) => part.text ?? "").join("");
  const system = body.system ?? body.systemInstruction?.parts;
  return [
    ...(system ? [{ role: "system", text: text(system) }] : []),
    ...(body.contents
      ? body.contents.map((turn: any) => ({
          role: turn.role === "model" ? "assistant" : turn.role,
          text: text(turn.parts),
        }))
      : body.messages.map((message: any) => ({ role: message.role, text: text(message.content) }))),
  ];
};

const db = await getDB();
const chats = createChatsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const characters = createCharactersStorage(db);
  const alice = await characters.create(characterDataSchema.parse({ name: "Alice" }));
  const bob = await characters.create(characterDataSchema.parse({ name: "Bob" }));
  assert(alice && bob);
  const presets = createPromptsStorage(db);
  const presetIds = new Map<string, string>();
  for (const [mode, parameters] of [
    ["Apply", { strictRoleFormatting: true }],
    ["Don't Apply", { strictRoleFormatting: false }],
    ["Single User Message", { singleUserMessage: true }],
  ] as const) {
    const preset = await presets.create({
      name: mode,
      parameters: { maxTokens: 512, maxContext: 32768, ...parameters },
      wrapFormat: "xml",
    });
    assert(preset);
    await presets.createSection({ presetId: preset.id, identifier: "rules", name: "Rules", content: "Rules." });
    await presets.createSection({
      presetId: preset.id,
      identifier: "depth",
      name: "Depth zero",
      content: "DEPTH_ZERO",
      injectionPosition: "depth",
      injectionDepth: 0,
    });
    await presets.createSection({
      presetId: preset.id,
      identifier: "history",
      name: "Chat History",
      isMarker: true,
      markerConfig: { type: "chat_history" },
    });
    await presets.createSection({ presetId: preset.id, identifier: "post", name: "Post", content: "POST_HISTORY" });
    presetIds.set(mode, preset.id);
  }
  const guide = buildGuidedGenerationInstructionMessage("make it braver");
  // A prefill ending in a space: sent trimmed (Anthropic refuses trailing whitespace), streamed and saved as set.
  const prefill = "Sure! ";

  for (const [providerName, path, model, endsOnPrefill] of [
    ["anthropic", "v1", "claude-sonnet-4-5", true],
    ["google", "google", "gemini-3.5-flash", true],
    ["openrouter", "openrouter.ai/api/v1", "meta-llama/llama-3.3-70b-instruct", true],
    ["anthropic", "v1", "claude-opus-5-5", false],
    ["google", "google", "gemini-4-argon", false],
    ["openrouter", "openrouter.ai/api/v1", "google/gemini-3.8-flash", false],
  ] as const) {
    const connection = await createConnectionsStorage(db).create({
      name: model,
      provider: providerName,
      baseUrl: `${base}/${path}`,
      model,
      apiKey: "fixture",
      maxContext: 32768,
      maxTokensOverride: 512,
    });
    assert(connection);
    const setups = [
      ...["Apply", "Don't Apply", "Single User Message"].map((postProcessing) => ({
        label: `roleplay, ${postProcessing}, guided`,
        mode: "roleplay" as const,
        characterIds: [alice.id],
        preset: postProcessing,
        metadata: {},
        guided: true,
        requests: 1,
      })),
      {
        label: "Conversation merged group",
        mode: "conversation" as const,
        characterIds: [alice.id, bob.id],
        preset: "Apply",
        metadata: { groupChatMode: "merged" },
        guided: false,
        requests: 1,
      },
      {
        label: "roleplay individual group",
        mode: "roleplay" as const,
        characterIds: [alice.id, bob.id],
        preset: "Apply",
        metadata: { groupChatMode: "individual", groupResponseOrder: "sequential" },
        guided: false,
        requests: 2,
      },
    ];
    for (const setup of setups) {
      const label = `${providerName} ${model} ${setup.label}`;
      const chat = await chats.create({
        name: label,
        mode: setup.mode,
        characterIds: setup.characterIds,
        connectionId: connection.id,
        promptPresetId: presetIds.get(setup.preset)!,
      });
      assert(chat);
      await chats.patchMetadata(chat.id, {
        // Conversation's cross-chat awareness would quote the other fixture chats' replies.
        crossChatAwareness: false,
        enableAgents: false,
        enableTools: false,
        chatParameters: { assistantPrefill: prefill },
        ...setup.metadata,
      });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "I knock." });
      await chats.createMessage({ chatId: chat.id, role: "assistant", characterId: alice.id, content: "Alice opens." });
      await chats.createMessage({ chatId: chat.id, role: "user", content: "I step inside." });
      bodies.length = 0;
      const response = await app.inject({
        method: "POST",
        url: "/api/generate/",
        payload: {
          chatId: chat.id,
          streaming: true,
          ...(setup.guided ? { generationGuide: guide, generationGuideSource: "guide" } : {}),
        },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert(!response.body.includes('"type":"error"'), `${label}: ${response.body}`);
      assert.equal(bodies.length, setup.requests, `${label} sends ${setup.requests} request(s)`);
      const saved = (await chats.listMessages(chat.id)).slice(3);
      assert.equal(saved.length, setup.requests, `${label} saves each reply`);
      for (const [index, body] of bodies.entries()) {
        const turns = turnsOf(body);
        const sent = JSON.stringify(turns);
        const request = `${label}, request ${index + 1}`;
        if (setup.guided) assert(sent.includes("make it braver"), `${request} sends the guide`);
        if (setup.preset !== "Apply" || setup.mode === "roleplay") {
          assert(sent.includes("DEPTH_ZERO") && sent.includes("POST_HISTORY"), `${request} sends the preset`);
        }
        if (endsOnPrefill) {
          // Ends on the prefill, exactly, after everything else; the reply is streamed and saved after it.
          assert.deepEqual(turns.at(-1), { role: "assistant", text: "Sure!" }, `${request}: ${sent.slice(-400)}`);
          // Elsewhere only in an earlier in-turn reply, which was saved with its prefill.
          assert.equal(sent.split("Sure!").length, 2 + index, `${request} sends the prefill once`);
          assert.equal(saved[index]!.content, `${prefill}${REPLY}`, `${request} saves the reply after the prefill`);
          continue;
        }
        // A model that refuses a final assistant message: no trailing assistant turn, no continuation prompt.
        assert.notEqual(turns.at(-1)?.role, "assistant", `${request} does not end on an assistant turn: ${sent}`);
        assert(!sent.includes("Continue the assistant's reply"), `${request} needs no continuation prompt`);
        assert.equal(saved[index]!.content, REPLY, `${request} saves the reply as the model wrote it`);
        const replies = turns.filter((turn) => turn.role === "assistant");
        if (setup.preset === "Single User Message") {
          // One user message holds the whole history: the prefill opens Alice's reply inside it.
          assert.deepEqual(replies, [], request);
          assert(sent.includes("[ASSISTANT]\\nSure! Alice opens."), `${request}: ${sent}`);
        } else if (setup.mode === "roleplay" && index === 1) {
          // Bob, the second responder, has no reply of his own in the history: the prefill is left out.
          assert(!sent.includes("Sure!"), `${request} has no turn to show the prefill in: ${sent}`);
        } else {
          // The prefill opens the last reply in the history: inside its chat-history wrapper, after its timestamp
          // and speaker name.
          assert.match(
            replies.at(-1)!.text,
            setup.mode === "conversation"
              ? /^\[\d\d:\d\d\] Alice: Sure! Alice opens\.$/u
              : /^Sure! Alice opens\.\n<\/chat_history>$/u,
            `${request}: ${sent}`,
          );
          assert.equal(sent.split("Sure!").length, 2, `${request} sends the prefill once`);
        }
      }
    }
  }
  // The fallback's edges, on the helper itself. A saved reply's Gemini parts replace its text when sent, so a reply
  // the prefill opens goes as text; with no reply in the history nothing is sent; a reasoning prefill still ends it.
  const { endPromptOnAssistantPrefill } =
    await import("../../packages/server/src/routes/generate/generate-route-utils.js");
  type Message = { role: string; content: string; contextKind?: string; providerMetadata?: Record<string, unknown> };
  const reasoned: Message[] = [
    { role: "user", content: "I knock.", contextKind: "history" },
    {
      role: "assistant",
      content: "Alice opens.",
      contextKind: "history",
      providerMetadata: { geminiParts: [{ text: "Alice opens.", thoughtSignature: "sig" }] },
    },
    { role: "user", content: "I step inside.", contextKind: "history" },
  ];
  assert.deepEqual(endPromptOnAssistantPrefill(reasoned, { role: "assistant", content: prefill }, false), {
    endsOnPrefill: false,
    opensReply: false,
  });
  assert.deepEqual(reasoned[1], { role: "assistant", content: "Sure! Alice opens.", contextKind: "history" });
  assert.equal(reasoned.length, 3);
  const noReply: Message[] = [{ role: "user", content: "Hello.", contextKind: "history" }];
  endPromptOnAssistantPrefill(noReply, { role: "assistant", content: prefill }, false);
  assert.deepEqual(noReply, [{ role: "user", content: "Hello.", contextKind: "history" }]);
  const both: Message[] = [{ role: "assistant", content: "Hi.", contextKind: "history" }];
  const thinking = { reasoning_content: "Plan.", partial: true };
  assert.deepEqual(
    endPromptOnAssistantPrefill(both, { role: "assistant", content: prefill, providerMetadata: thinking }, false),
    { endsOnPrefill: true, opensReply: false },
  );
  assert.deepEqual(both, [
    { role: "assistant", content: "Sure! Hi.", contextKind: "history" },
    { role: "assistant", content: "", providerMetadata: thinking },
  ]);
  console.log("Assistant prefill ends-prompt regression passed in %d ms.", Math.round(performance.now() - started));
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
