import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GenerationRunner } from "../../../packages/server/src/routes/generate.routes.js";

// #7430: every agent reads Roleplay whispers, marked as private, at their place in the story. Character
// responders keep receiving only their own, and hosted rooms keep whispers away from agents.
const dir = mkdtempSync(join(tmpdir(), "marinara-agent-whispers-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.CUSTOM_TOOL_SCRIPT_ENABLED = "true";
const requireServer = createRequire(new URL("../../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../../packages/server/src/routes/generate.routes.js");
const { createGenerationEventSink } = await import("../../../packages/server/src/routes/generate/sse.js");
const { createChatsStorage } = await import("../../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../../packages/server/src/services/storage/characters.storage.js");
const { createPromptsStorage } = await import("../../../packages/server/src/services/storage/prompts.storage.js");
const { createAgentsStorage } = await import("../../../packages/server/src/services/storage/agents.storage.js");
const { createCustomToolsStorage } = await import("../../../packages/server/src/services/storage/custom-tools.storage.js");
const { createAppSettingsStorage } = await import("../../../packages/server/src/services/storage/app-settings.storage.js");
const { roleplayAgentContinuation, roleplayAgentsSeeWhispers, roleplayAgentText } =
  await import("../../../packages/server/src/services/generation/roleplay-commands.js");
const { createCapabilityPersistenceHost } =
  await import("../../../packages/server/src/services/capability-packages/capability-persistence.service.js");
const { personas: personasTable } = await import("../../../packages/server/src/db/schema/index.js");
const { characterDataSchema, DECISION_SMART_ORDER_SETTINGS_KEY, replaceBuiltInAgentDefinitions } =
  await import("../../../packages/shared/dist/index.js");

const SENTINELS = ["PRE_AGENT_FIXTURE", "POST_AGENT_FIXTURE", "REWRITE_AGENT_FIXTURE", "ROOM_TRACKER_FIXTURE"] as const;
const agentPrompts = new Map<string, string[]>(SENTINELS.map((sentinel) => [sentinel, []]));
const mainPrompts: string[] = [];
// What Smart speaker selection read: the Decision model's state and the chat-model selector's prompt.
const decisionStates: string[] = [];
const selectorPrompts: string[] = [];
let decisionAnswers: Record<string, number> = {};
let selectorAnswer: string[] = [];
let outputs: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (request.url?.endsWith("/systemone")) {
    decisionStates.push(JSON.stringify(body.state));
    const answers = Object.fromEntries(
      Object.keys(body.questions ?? {}).map((id) => [id, { type: "noul", noul: decisionAnswers[id] ?? 0 }]),
    );
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ answers }));
    return;
  }
  const prompt = JSON.stringify(body.messages);
  if (prompt.includes("hidden response orchestrator")) {
    selectorPrompts.push(prompt);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          { index: 0, message: { role: "assistant", content: JSON.stringify(selectorAnswer) }, finish_reason: "stop" },
        ],
      }),
    );
    return;
  }
  const sentinel = SENTINELS.find((candidate) => prompt.includes(candidate));
  if (sentinel) agentPrompts.get(sentinel)!.push(prompt);
  else mainPrompts.push(prompt);
  const content =
    sentinel === "ROOM_TRACKER_FIXTURE"
      ? "{}"
      : sentinel === "REWRITE_AGENT_FIXTURE"
        ? JSON.stringify({ editNeeded: false, editedText: "", changes: [] })
        : sentinel
          ? "Agent note."
          : outputs.shift();
  assert.notEqual(content, undefined, "unexpected provider request");
  if (body.stream) {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
  } else {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
    );
  }
});
const latest = (sentinel: (typeof SENTINELS)[number]) => agentPrompts.get(sentinel)!.at(-1) ?? "";
const inOrder = (text: string, ...parts: string[]) =>
  parts.every(
    (part, index) => text.includes(part) && (index === 0 || text.indexOf(parts[index - 1]!) < text.indexOf(part)),
  );
const count = (text: string, part: string) => text.split(part).length - 1;
/** The reply an agent was given to process. */
const responseOf = (prompt: string) =>
  /<assistant_response>\n([\s\S]*?)\n<\/assistant_response>/u.exec(
    (JSON.parse(prompt) as Array<{ content: string }>).map((message) => message.content).join("\n"),
  )?.[1] ?? "";

const db = await getDB();
const chats = createChatsStorage(db);
const characters = createCharactersStorage(db);
const agents = createAgentsStorage(db);
const app = Fastify();
app.decorate("db", db);
let runner: GenerationRunner | undefined;
await app.register(generateRoutes, { prefix: "/api/generate", onRunnerReady: (ready) => (runner = ready) });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert(address && typeof address === "object");
  const connection = await createConnectionsStorage(db).create({
    name: "Agent whisper fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "fixture",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
  });
  assert(connection);
  const [alice, bob] = await Promise.all(
    ["Alice", "Bob"].map((name) => characters.create(characterDataSchema.parse({ name }))),
  );
  assert(alice && bob);
  const persona = await characters.createPersona("Mari", "The player.");
  assert(persona);
  const presets = createPromptsStorage(db);
  const preset = await presets.create({
    name: "Agent whisper fixture",
    parameters: { maxTokens: 512, maxContext: 32768, strictRoleFormatting: true },
    wrapFormat: "xml",
  });
  assert(preset);
  await presets.createSection({
    presetId: preset.id,
    identifier: "rules",
    name: "Rules",
    content: "Respond as {{char}}.",
  });
  await presets.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "Chat History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  // An Echo Chamber-like reader before the reply (with the main prompt preview) and a tracker-like one after it.
  const pre = await agents.create({
    type: "custom-whisper-pre",
    name: "Whisper reader before",
    phase: "pre_generation",
    connectionId: connection.id,
    promptTemplate: "PRE_AGENT_FIXTURE React to the latest message.",
    settings: { resultType: "context_injection", contextSize: 10, capabilities: { edit_main_prompt: true } },
  });
  const post = await agents.create({
    type: "custom-whisper-post",
    name: "Whisper reader after",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "POST_AGENT_FIXTURE Note what happened.",
    settings: { resultType: "context_injection", contextSize: 10, capabilities: { edit_main_prompt: true } },
  });
  assert(pre && post);
  const chat = await chats.create({
    name: "Agents see whispers",
    mode: "roleplay",
    characterIds: [alice.id, bob.id],
    personaId: persona.id,
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(chat);
  await chats.patchMetadata(chat.id, {
    enableAgents: true,
    activeAgentIds: [pre.type, post.type],
    enableTools: false,
    enableMemoryRecall: false,
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true },
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  await chats.createMessage({ chatId: chat.id, role: "user", content: "Opening line." });
  const generate = async (
    output: string,
    forCharacterId: string | undefined,
    options: Record<string, unknown> = {},
  ) => {
    outputs = [output];
    const response = await app.inject({
      method: "POST",
      url: "/api/generate/",
      payload: { chatId: chat.id, forCharacterId, ...options },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert(!response.body.includes('"type":"error"'), response.body);
    assert.equal(outputs.length, 0);
  };

  // The reply being generated: a post-generation agent reads its whispers in place, labeled with each recipient.
  await generate(
    'Before. [whisper: character="Bob" text="REPLY_SECRET"] After. [whisper: character="Mari" text="PERSONA_SECRET"]',
    alice.id,
  );
  const replyPost = latest("POST_AGENT_FIXTURE");
  assert(
    inOrder(
      replyPost,
      "Before.",
      "[Private whisper to Bob: REPLY_SECRET]",
      "After.",
      "[Private whisper to Mari: PERSONA_SECRET]",
    ),
    replyPost,
  );
  assert(!mainPrompts.at(-1)!.includes("REPLY_SECRET"), "the writer's own prompt never held the secret");

  // A whisper the user just typed, with no other text, reaches a pre-generation agent as the whisper itself,
  // and the earlier reply's whisper keeps its place in the agent's history and in the main prompt preview.
  await generate("Alice shrugs.", alice.id, { userMessage: '[whisper: character="Bob" text="USER_SECRET"]' });
  const echo = latest("PRE_AGENT_FIXTURE");
  assert(echo.includes("[Private whisper to Bob: USER_SECRET]"), echo);
  assert(!echo.includes("[Private whisper]"), "a whisper-only message reads as its whisper, not a placeholder");
  assert(inOrder(echo, "Before.", "[Private whisper to Bob: REPLY_SECRET]", "After."), echo);
  assert(echo.includes("<main_generation_prompt_preview>"), "the agent also reads the main prompt preview");
  assert.equal(
    count(echo, "[Private whisper to Bob: REPLY_SECRET]"),
    2,
    "once in the agent's history and once in the preview, never inserted twice",
  );
  // The responder in that same request is not a recipient and still gets none of them.
  const aliceView = mainPrompts.at(-1)!;
  // After the reply, the preview is Alice's own prompt, which still holds the whisper-only turn meant for Bob.
  assert.equal(count(latest("POST_AGENT_FIXTURE"), "[Private whisper to Bob: USER_SECRET]"), 2);
  for (const secret of ["USER_SECRET", "REPLY_SECRET", "PERSONA_SECRET"])
    assert(!aliceView.includes(secret), `${secret} stays out of a non-recipient's prompt`);
  await generate("Bob nods.", bob.id);
  const bobView = mainPrompts.at(-1)!;
  assert(bobView.includes("USER_SECRET") && bobView.includes("REPLY_SECRET"), "the recipient keeps its whispers");
  assert(!bobView.includes("PERSONA_SECRET") && !bobView.includes("[Private whisper to Bob:"));

  // Deleted and failed whispers are not live, so no agent reads them.
  const whisper = (text: string, extra: Record<string, unknown>) => ({
    command: { type: "whisper", character: "Bob", text },
    raw: `[whisper: character="Bob" text="${text}"]`,
    whisperRecipient: { id: bob.id, kind: "character" },
    contentOffset: 6,
    contentAnchor: "Plain.",
    ...extra,
  });
  await chats.createMessage({
    chatId: chat.id,
    role: "assistant",
    characterId: alice.id,
    content: "Plain.",
    extra: {
      roleplayCommandActivity: [
        whisper("DELETED_SECRET", { deleted: true }),
        whisper("FAILED_SECRET", { error: "roleplay.commands.errors.whisperRecipient" }),
        whisper("LIVE_SECRET", {}),
      ],
    },
  });
  await generate("Alice waits.", alice.id);
  const afterEdits = latest("PRE_AGENT_FIXTURE");
  assert(inOrder(afterEdits, "Plain.", "[Private whisper to Bob: LIVE_SECRET]"), afterEdits);
  assert(!afterEdits.includes("DELETED_SECRET") && !afterEdits.includes("FAILED_SECRET"));

  // A whisper-only body's whispers take the place of its own placeholder, not a later copy of that text.
  const onlyWhisper = { role: "assistant", content: "", extra: { roleplayCommandActivity: [whisper("ONLY", {})] } };
  const bobNames = new Map([[bob.id, "Bob"]]);
  assert.equal(
    roleplayAgentText("<Alice>\n[Private whisper]\n</Alice>", onlyWhisper, bobNames),
    "<Alice>\n[Private whisper to Bob: ONLY]\n</Alice>",
  );
  assert.equal(
    roleplayAgentText("[Private whisper]\n\nDocument: Quote\n[Private whisper]", onlyWhisper, bobNames),
    "[Private whisper to Bob: ONLY]\n\nDocument: Quote\n[Private whisper]",
  );
  assert.equal(roleplayAgentText("", onlyWhisper, bobNames), "[Private whisper to Bob: ONLY]");
  assert.equal(roleplayAgentText("[Private whisper]", onlyWhisper, null), "[Private whisper]");
  // A limit cuts the text and each whisper on their own; whispers whose places are cut off follow it, in order.
  const lateWhispers = {
    role: "assistant",
    content: "Plain.",
    extra: { roleplayCommandActivity: [whisper("FIRST", {}), whisper("SECOND", {})] },
  };
  assert.equal(
    roleplayAgentText("Plain.", lateWhispers, bobNames, false, 3),
    "Pla [Private whisper to Bob: FIR] [Private whisper to Bob: SEC]",
  );
  // A continue that added only a whisper reads as that whisper, without the message's earlier ones.
  const continuedOnlyWhisper = {
    role: "assistant",
    content: "Plain.",
    extra: { roleplayCommandActivity: [whisper("EARLIER", {}), whisper("ADDED", {})] },
  };
  assert.equal(roleplayAgentContinuation("", continuedOnlyWhisper, 1, bobNames), "[Private whisper to Bob: ADDED]");

  // A retried agent reads the retried reply with its whispers; a rewrite agent edits only its public text.
  const rewrite = await agents.create({
    type: "custom-whisper-rewrite",
    name: "Whisper rewrite",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "REWRITE_AGENT_FIXTURE Polish the reply.",
    settings: { resultType: "text_rewrite", contextSize: 10 },
  });
  assert(rewrite);
  await chats.patchMetadata(chat.id, { activeAgentIds: [pre.type, post.type, rewrite.type] });
  const firstReply = (await chats.listMessages(chat.id)).find((message) => message.content.startsWith("Before."))!;
  const retryReply = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: [post.type, rewrite.type], forMessageId: firstReply.id },
  });
  assert.equal(retryReply.statusCode, 200, retryReply.body);
  const retriedReply = responseOf(latest("POST_AGENT_FIXTURE"));
  assert(inOrder(retriedReply, "Before.", "[Private whisper to Bob: REPLY_SECRET]", "After."), retriedReply);
  const rewriteTarget = responseOf(latest("REWRITE_AGENT_FIXTURE"));
  assert(rewriteTarget.includes("Before.") && !rewriteTarget.includes("[Private whisper"), rewriteTarget);
  assert.equal((await chats.getMessage(firstReply.id))!.content, firstReply.content);
  await chats.patchMetadata(chat.id, { activeAgentIds: [pre.type, post.type] });

  // Retried agents read them too.
  const retry = await app.inject({
    method: "POST",
    url: "/api/generate/retry-agents",
    payload: { chatId: chat.id, agentTypes: [post.type] },
  });
  assert.equal(retry.statusCode, 200, retry.body);
  const retried = latest("POST_AGENT_FIXTURE");
  assert(retried.includes("[Private whisper to Bob: USER_SECRET]"), retried);
  assert(inOrder(retried, "Plain.", "[Private whisper to Bob: LIVE_SECRET]"), retried);

  // Packages read the same text through the capability API's agentContent (#7443); content stays public.
  const persistence = createCapabilityPersistenceHost(db);
  const packageView = await persistence.listMessages(chat.id);
  const packageMessage = (secret: string) => packageView.find((message) => message.extra.includes(secret))!;
  assert.equal(packageView[0]!.agentContent, "Opening line.", "a message with no whisper reads as itself");
  assert.equal(packageMessage("LIVE_SECRET").content, "Plain.");
  assert.equal(packageMessage("LIVE_SECRET").agentContent, "Plain. [Private whisper to Bob: LIVE_SECRET]");
  assert.equal(packageMessage("USER_SECRET").content, "");
  assert.equal(packageMessage("USER_SECRET").agentContent, "[Private whisper to Bob: USER_SECRET]");
  const packageReply = packageMessage("PERSONA_SECRET").agentContent!;
  assert(
    inOrder(
      packageReply,
      "Before.",
      "[Private whisper to Bob: REPLY_SECRET]",
      "After.",
      "[Private whisper to Mari: PERSONA_SECRET]",
    ),
    packageReply,
  );
  // A failed persona read costs only the agent view: the messages and their public text still list.
  const personaFailingDb = new Proxy(db, {
    get(target, property) {
      if (property === "select")
        return (...args: Parameters<typeof target.select>) => {
          const query = target.select(...args);
          return new Proxy(query, {
            get(builder, key) {
              if (key === "from")
                return (table: Parameters<typeof query.from>[0]) => {
                  if (table === personasTable) throw new Error("Forced persona read failure");
                  return builder.from(table);
                };
              const value = Reflect.get(builder, key);
              return typeof value === "function" ? value.bind(builder) : value;
            },
          });
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const unnamedView = await createCapabilityPersistenceHost(personaFailingDb).listMessages(chat.id);
  assert.deepEqual(
    unnamedView.map((message) => message.content),
    packageView.map((message) => message.content),
  );
  assert(
    unnamedView.every((message) => !("agentContent" in message)),
    JSON.stringify(unnamedView),
  );
  // Outside Roleplay there is no agent view, even for a message that carries a whisper.
  const conversation = await chats.create({
    name: "Conversation whisper",
    mode: "conversation",
    characterIds: [alice.id, bob.id],
    personaId: persona.id,
    promptPresetId: null,
  });
  assert(conversation);
  await chats.createMessage({
    chatId: conversation.id,
    role: "assistant",
    characterId: alice.id,
    content: "Plain.",
    extra: { roleplayCommandActivity: [whisper("CONVERSATION_SECRET", {})] },
  });
  const conversationView = await persistence.listMessages(conversation.id);
  assert.equal(conversationView.length, 1);
  assert(!("agentContent" in conversationView[0]!), JSON.stringify(conversationView[0]));
  // It is the text the generate route gives agents: a leftover private tag stays out and a letter stays in.
  const packageChat = await chats.create({
    name: "Package agent view",
    mode: "roleplay",
    characterIds: [alice.id, bob.id],
    personaId: persona.id,
    promptPresetId: null,
  });
  assert(packageChat);
  await persistence.createMessageWithSwipe({
    id: "package-noted-turn",
    swipeId: "package-noted-turn-swipe",
    chatId: packageChat.id,
    role: "user",
    characterId: null,
    content: "I nod. [notes: NOTE_SECRET] Then I leave.",
    extra: {},
    createdAt: new Date().toISOString(),
  });
  const documentActivity = {
    command: { type: "document", documentType: "letter", title: "Letter", content: "DOC_BODY" },
    raw: '[document: title="Letter"]',
  };
  await chats.createMessage({
    chatId: packageChat.id,
    role: "assistant",
    characterId: alice.id,
    content: "Plain.",
    extra: { roleplayCommandActivity: [whisper("DOC_WHISPER", {}), documentActivity] },
  });
  const [notedTurn, letter] = await persistence.listMessages(packageChat.id);
  assert(notedTurn!.content.includes("NOTE_SECRET"), "content stays as saved");
  assert(inOrder(notedTurn!.agentContent!, "I nod.", "Then I leave."), notedTurn!.agentContent);
  assert(!notedTurn!.agentContent!.includes("NOTE_SECRET"), notedTurn!.agentContent);
  assert.equal(letter!.agentContent, "Plain. [Private whisper to Bob: DOC_WHISPER]\n\nDocument: Letter\nDOC_BODY");

  // A reply that is only a whisper still reaches post-generation agents; a rewrite agent has nothing to edit.
  await chats.patchMetadata(chat.id, { activeAgentIds: [pre.type, post.type, rewrite.type] });
  const rewritesBefore = agentPrompts.get("REWRITE_AGENT_FIXTURE")!.length;
  const postsBefore = agentPrompts.get("POST_AGENT_FIXTURE")!.length;
  await generate('[whisper: character="Bob" text="ONLY_REPLY_SECRET"]', alice.id);
  assert.equal(agentPrompts.get("POST_AGENT_FIXTURE")!.length, postsBefore + 1, "post-generation agents ran");
  assert.equal(responseOf(latest("POST_AGENT_FIXTURE")), "[Private whisper to Bob: ONLY_REPLY_SECRET]");
  assert.equal(agentPrompts.get("REWRITE_AGENT_FIXTURE")!.length, rewritesBefore, "no rewrite of an empty reply");
  assert.equal((await chats.listMessages(chat.id)).at(-1)!.content, "");
  // Two whisper-only replies in one group turn join into blank lines, which are no public text either.
  await chats.patchMetadata(chat.id, { groupResponseOrder: "sequential" });
  outputs = [
    '[whisper: character="Bob" text="TURN_ONE_SECRET"]',
    '[whisper: character="Alice" text="TURN_TWO_SECRET"]',
  ];
  const groupTurn = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: chat.id } });
  assert.equal(groupTurn.statusCode, 200, groupTurn.body);
  assert.equal(outputs.length, 0);
  assert(
    inOrder(
      responseOf(latest("POST_AGENT_FIXTURE")),
      "[Private whisper to Bob: TURN_ONE_SECRET]",
      "[Private whisper to Alice: TURN_TWO_SECRET]",
    ),
  );
  assert.equal(agentPrompts.get("REWRITE_AGENT_FIXTURE")!.length, rewritesBefore, "no rewrite of blank replies");
  await chats.patchMetadata(chat.id, { activeAgentIds: [pre.type, post.type], groupResponseOrder: "manual" });

  // Continuing a reply with speaker names in history: the agents' segment is only the added text, with only
  // the whispers written in it, at their places.
  await chats.patchMetadata(chat.id, { groupSpeakerNamesInHistory: true });
  await generate('First. [whisper: character="Bob" text="OLD_SECRET"] Part.', alice.id);
  const continued = (await chats.listMessages(chat.id)).at(-1)!;
  await generate(' Second. [whisper: character="Bob" text="NEW_SECRET"] End.', alice.id, {
    continueMessageId: continued.id,
  });
  const continuation = responseOf(latest("POST_AGENT_FIXTURE"));
  assert(inOrder(continuation, "Second.", "[Private whisper to Bob: NEW_SECRET]", "End."), continuation);
  assert(!continuation.includes("OLD_SECRET") && !continuation.includes("First."), continuation);
  await chats.patchMetadata(chat.id, { groupSpeakerNamesInHistory: false });

  // A character's own custom tool call acts for that character, so a whisper for someone else stays out of it.
  await createCustomToolsStorage(db).create({
    name: "recall_input",
    description: "Recall what the player last said.",
    parametersSchema: { type: "object", properties: {}, required: [] },
    executionType: "script",
    scriptBody: "return { lastInput: context.macros.input };",
    includeHiddenContext: true,
  });
  const toolConnection = await createConnectionsStorage(db).create({
    name: "Agent whisper tool fixture",
    provider: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "gemma",
    apiKey: "fixture",
    maxContext: 32768,
    maxTokensOverride: 512,
    treatAsLocalEndpoint: true,
  });
  assert(toolConnection);
  const toolChat = await chats.create({
    name: "Tool whisper",
    mode: "roleplay",
    characterIds: [alice.id, bob.id],
    personaId: persona.id,
    connectionId: toolConnection.id,
    promptPresetId: preset.id,
  });
  assert(toolChat);
  await chats.patchMetadata(toolChat.id, {
    enableAgents: false,
    enableMemoryRecall: false,
    enableTools: true,
    activeToolIds: ["recall_input"],
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true },
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  await chats.createMessage({ chatId: toolChat.id, role: "user", content: "Opening." });
  const toolPromptsBefore = mainPrompts.length;
  outputs = ['<tool_call>{"name": "recall_input", "arguments": {}}</tool_call>', "Alice answers."];
  const toolTurn = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: {
      chatId: toolChat.id,
      forCharacterId: alice.id,
      userMessage: 'Hello there. [whisper: character="Bob" text="TOOL_SECRET"]',
    },
  });
  assert.equal(toolTurn.statusCode, 200, toolTurn.body);
  assert.equal(outputs.length, 0);
  const toolPrompts = mainPrompts.slice(toolPromptsBefore);
  assert(toolPrompts.at(-1)!.includes("lastInput") && toolPrompts.at(-1)!.includes("Hello there."), toolPrompts.at(-1));
  for (const toolPrompt of toolPrompts) assert(!toolPrompt.includes("TOOL_SECRET"), toolPrompt);

  // Smart speaker selection reads whispers like every agent, since a whisper to Bob can make Bob the one who replies.
  // The Decision model's transcript and the chat-model selector's both mark each one as private to its recipient,
  // and a whisper-only message reads as its whisper. Only a speaker comes back, so the responder still gets none.
  await generate('Alice smiles. [whisper: character="Bob" text="SMART_REPLY_SECRET"] Then waits.', alice.id);
  const settings = createAppSettingsStorage(db);
  const decision = await createConnectionsStorage(db).create({
    name: "Agent whisper decision fixture",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    model: "jev-latest",
    maxStateTokens: 3500,
    defaultForAgents: true,
  });
  assert(decision);
  await settings.set(DECISION_SMART_ORDER_SETTINGS_KEY, "true");
  await chats.patchMetadata(chat.id, { groupResponseOrder: "smart" });
  decisionAnswers = { [bob.id]: 0.9 };
  await generate("Bob leans in.", undefined, { userMessage: '[whisper: character="Bob" text="SMART_USER_SECRET"]' });
  assert.equal(selectorPrompts.length, 0, "the Decision model chose the speaker");
  assert.equal((await chats.listMessages(chat.id)).at(-1)!.characterId, bob.id, "the whisper's recipient replies");
  await settings.remove(DECISION_SMART_ORDER_SETTINGS_KEY);
  selectorAnswer = [alice.id];
  await generate("Alice answers.", undefined, { userMessage: "Who goes next?" });
  assert.equal((await chats.listMessages(chat.id)).at(-1)!.characterId, alice.id);
  for (const smart of [decisionStates.at(-1) ?? "", selectorPrompts.at(-1) ?? ""]) {
    assert(inOrder(smart, "Alice smiles.", "[Private whisper to Bob: SMART_REPLY_SECRET]", "Then waits."), smart);
    assert(smart.includes("[Private whisper to Bob: SMART_USER_SECRET]"), smart);
    assert(!smart.includes("[Private whisper]"), "a whisper-only message reads as its whisper, not a placeholder");
  }
  assert(!/SMART_(REPLY|USER)_SECRET/u.test(mainPrompts.at(-1)!), "Alice, not a recipient, gets neither whisper");
  // The chat-model selector gives a turn's text and each whisper 900 characters apiece, so a long whisper, such as
  // a vision, does not crowd the question asked aloud out of the line.
  const vision = `LONG_VISION${"x".repeat(1_050)}`;
  await generate("Alice answers.", undefined, {
    userMessage: `[whisper: character="Bob" text="${vision}"] Alice, what do you think?`,
  });
  const longTurn = selectorPrompts.at(-1)!;
  assert(longTurn.includes(`[Private whisper to Bob: ${vision.slice(0, 900)}] Alice, what do you think?`), longTurn);
  assert(!longTurn.includes(vision.slice(0, 901)), "the whisper is cut to its own 900 characters");
  await chats.patchMetadata(chat.id, { groupResponseOrder: "manual" });

  // A hosted room shows agent output to every participant, so its agents get no whispers.
  replaceBuiltInAgentDefinitions([
    {
      id: "world-state",
      name: "World State",
      description: "Synthetic tracker",
      phase: "post_processing" as const,
      enabledByDefault: false,
      category: "tracker" as const,
      defaultTools: [],
      defaultPromptTemplate: "ROOM_TRACKER_FIXTURE Return JSON.",
    },
  ]);
  await agents.create({
    type: "world-state",
    name: "World State",
    phase: "post_processing",
    connectionId: connection.id,
    promptTemplate: "ROOM_TRACKER_FIXTURE Return JSON.",
  });
  const roomChat = await chats.create({
    name: "Hosted room",
    mode: "roleplay",
    characterIds: [alice.id, bob.id],
    connectionId: connection.id,
    promptPresetId: preset.id,
  });
  assert(roomChat);
  const authority = { roomId: "room_12345", epoch: "epoch_12345", operationId: "operation_12345" };
  const room = {
    version: 1,
    role: "host",
    roomId: authority.roomId,
    epoch: authority.epoch,
    generationOperationId: authority.operationId,
    status: "active",
    characters: [
      { id: alice.id, name: "Alice", role: "character" },
      { id: bob.id, name: "Bob", role: "character" },
    ],
    participants: [
      { id: "host_12345", displayName: "Mari", persona: { name: "Mari", description: "The host." }, isHost: true },
    ],
  };
  await chats.patchMetadata(roomChat.id, {
    enableAgents: true,
    activeAgentIds: ["world-state"],
    enableTools: false,
    enableMemoryRecall: false,
    roleplayCommandsEnabled: true,
    roleplayCommandToggles: { whisper: true },
    groupChatMode: "individual",
    groupResponseOrder: "manual",
  });
  await chats.createMessage({
    chatId: roomChat.id,
    role: "user",
    content: 'The door creaks. [whisper: character="Alice" text="ROOM_SECRET"]',
  });
  await chats.patchMetadata(roomChat.id, { multiplayer: room });
  const runRoom = async (output: string, forCharacterId?: string) => {
    let roomStatus = 0;
    const roomErrors: unknown[] = [];
    outputs = [output];
    await runner!(
      { chatId: roomChat.id, forCharacterId, streaming: false },
      createGenerationEventSink({
        onEvent: (event) => {
          if (event.type === "error") roomErrors.push(event);
        },
        onFinish: ({ statusCode }) => {
          roomStatus = statusCode;
        },
      }),
      authority,
    );
    assert.equal(roomStatus, 200);
    assert.deepEqual(roomErrors, []);
    assert.equal(outputs.length, 0);
  };
  await runRoom("Bob looks up.", bob.id);
  const roomTracker = latest("ROOM_TRACKER_FIXTURE");
  assert(roomTracker.includes("The door creaks."), "the room's tracker ran on the room's history");
  assert(!roomTracker.includes("ROOM_SECRET"), "a room's agents never read a whisper");
  // Nor does the room's Smart speaker selection.
  await chats.patchMetadata(roomChat.id, { groupResponseOrder: "smart" });
  selectorAnswer = [bob.id];
  const roomSelectorsBefore = selectorPrompts.length;
  await runRoom("Bob listens.");
  assert.equal(selectorPrompts.length, roomSelectorsBefore + 1, "the room asked the chat-model selector");
  const roomSelector = selectorPrompts.at(-1)!;
  assert(roomSelector.includes("The door creaks.") && !roomSelector.includes("ROOM_SECRET"), roomSelector);
  // Runs started outside room generation, such as retries, treat any room data but an ended room as a room.
  for (const multiplayer of [room, { role: "guest", status: "active" }, { ...room, status: undefined }, "{"])
    assert.equal(roleplayAgentsSeeWhispers("roleplay", { multiplayer }), false, JSON.stringify(multiplayer));
  for (const multiplayer of [undefined, null, { ...room, status: "ended" }])
    assert.equal(roleplayAgentsSeeWhispers("roleplay", { multiplayer }), true, JSON.stringify(multiplayer));
  assert.equal(roleplayAgentsSeeWhispers("conversation", {}), false);
  // Nor do a room's packages.
  const roomView = await persistence.listMessages(roomChat.id);
  assert(roomView.length && roomView.every((message) => !("agentContent" in message)), JSON.stringify(roomView));
  // The same chat as a private chat again: its agents read the whisper.
  await chats.patchMetadata(roomChat.id, { multiplayer: { ...room, status: "ended" } });
  outputs = ["Bob looks away."];
  const ended = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: roomChat.id, forCharacterId: bob.id },
  });
  assert.equal(ended.statusCode, 200, ended.body);
  assert(latest("ROOM_TRACKER_FIXTURE").includes("[Private whisper to Alice: ROOM_SECRET]"));
  const endedView = await persistence.listMessages(roomChat.id);
  assert(
    endedView.some((message) => message.agentContent === "The door creaks. [Private whisper to Alice: ROOM_SECRET]"),
    JSON.stringify(endedView),
  );
  assert(!mainPrompts.at(-1)!.includes("ROOM_SECRET"), "Bob is still not a recipient");
  console.log(
    "Agents see whispers passed: post-generation reply whispers, whisper-only user turns, history placement, preview without double insertion, responder privacy, dead whispers, retries, continued group replies, responder tools, Smart speaker selection, hosted rooms and the package agent view.",
  );
} finally {
  await app.close();
  provider.closeAllConnections();
  await new Promise<void>((done) => provider.close(() => done()));
  await closeDB();
  rmSync(dir, { recursive: true, force: true });
}
