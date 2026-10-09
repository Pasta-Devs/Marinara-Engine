// Advanced Memory decides who sees each new message in individual group chats (#7192).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "marinara-auto-visibility-"));
process.env.DATA_DIR = dir;
process.env.FILE_STORAGE_DIR = join(dir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createAdvancedMemoryService } = await import("../../packages/server/src/services/advanced-memory.js");
const { roleplayHiddenWhisperMessageIds } =
  await import("../../packages/server/src/services/generation/roleplay-commands.js");
const { DEFAULT_ADVANCED_MEMORY_SETTINGS, characterDataSchema, estimateChatSummaryTokens } =
  await import("../../packages/shared/dist/index.js");

type Call = { kind: "main" | "visibility" | "scene" | "scene+visibility" | "other"; prompt: string };
const calls: Call[] = [];
const decisionRequests: Array<{ state: Record<string, any>; questions: Record<string, { instructions: string }> }> = [];
const ids = { maukie: "", pantalone: "", narrator: "" };
let failVisibility = false;
let dropPresence = false;
let dropEnds = false;
/** When set, the fake Jev gives this unsure score to every presence question. */
let unsurePresence: number | null = null;
let mainReplies: string[] = [];

/** The fake helper keeps Maukie (by first name only) and leaves Pantalone out of every scene. */
function presence(task: { decide: Array<{ messageNumber: number; candidates: string[] }> }) {
  return task.decide.map(({ messageNumber, candidates }) => ({
    messageNumber,
    present: Object.fromEntries(
      candidates.map((name) => [name.split(" ")[0]!.toUpperCase(), !name.startsWith("Pantalone")]),
    ),
  }));
}

const provider = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  res.writeHead(200, { "content-type": body.stream ? "text/event-stream" : "application/json" });
  if (req.url?.endsWith("/systemone")) {
    decisionRequests.push(body);
    res.end(
      JSON.stringify({
        answers: Object.fromEntries(
          Object.keys(body.questions)
            .filter((id) => !dropPresence || !id.startsWith("presence:"))
            .map((id) => [
              id,
              {
                type: "noul",
                // The question asks whether the character can't see or hear the message:
                // the fake Jev is sure only about the absent Pantalone.
                noul: id.startsWith("presence:")
                  ? (unsurePresence ?? (id.endsWith(ids.pantalone) ? 0.99 : 0.01))
                  : 0.01,
              },
            ]),
        ),
      }),
    );
    return;
  }
  const messages = body.messages as Array<{ role: string; content: string }>;
  const system = messages[0]?.content ?? "";
  const scene = system.includes("Identify scene transitions");
  const visibility = system.includes("Decide which characters can perceive");
  const kind: Call["kind"] =
    scene && visibility ? "scene+visibility" : scene ? "scene" : visibility ? "visibility" : "main";
  calls.push({ kind, prompt: JSON.stringify(messages) });
  const user = messages.at(-1)?.content ?? "";
  let content: string;
  if (kind === "main") content = mainReplies.shift() ?? "A quiet reply.";
  else if (kind === "visibility") content = JSON.stringify({ visibility: presence(JSON.parse(user)) });
  else if (kind === "scene+visibility")
    content = JSON.stringify({
      ...(dropEnds ? {} : { ends: [] }),
      visibility: presence(JSON.parse(user.split("Presence task:\n")[1]!)),
    });
  else content = system.includes('"ends"') ? '{"ends":[]}' : '{"starts":[]}';
  if (body.stream) {
    res.end(
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n` +
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
    );
    return;
  }
  res.end(
    JSON.stringify({
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: failVisibility && kind === "visibility" ? "length" : "stop",
        },
      ],
      usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
    }),
  );
});

const db = await getDB();
const chats = createChatsStorage(db);
const memory = createAdvancedMemoryService(db);
const app = Fastify();
app.decorate("db", db);
await app.register(generateRoutes, { prefix: "/api/generate" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
try {
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const connections = createConnectionsStorage(db);
  const connection = await connections.create({
    name: "Visibility fixture",
    provider: "custom",
    model: "fixture",
    apiKey: "fixture",
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    maxContext: 16_384,
    maxTokensOverride: 1024,
  });
  const decisionConnection = await connections.create({
    name: "Visibility Jev",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: "jev-fixture",
    apiKey: "",
  });
  const characters = createCharactersStorage(db);
  for (const [key, name] of [
    ["maukie", "Maukie Whiskers"],
    ["pantalone", "Pantalone"],
    ["narrator", "Narrator"],
  ] as const) {
    const created = await characters.create(characterDataSchema.parse({ name }));
    assert(created);
    ids[key] = created.id;
  }

  const createChat = async (settings: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) => {
    const chat = await chats.create({
      name: "Visibility",
      mode: "roleplay",
      characterIds: [ids.maukie, ids.pantalone, ids.narrator],
      connectionId: connection.id,
    });
    assert(chat);
    await chats.patchMetadata(chat.id, {
      enableAgents: false,
      groupChatMode: "individual",
      advancedMemory: {
        ...DEFAULT_ADVANCED_MEMORY_SETTINGS,
        enabled: true,
        maxContextTokens: 16_384,
        helperConnectionId: connection.id,
        narratorCharacterId: ids.narrator,
        autoMessageVisibility: true,
        sceneCheckInterval: 50,
        knowledgeStarts: { [ids.maukie]: null, [ids.pantalone]: null, [ids.narrator]: null },
        knowledgeConfirmed: true,
        ...settings,
      },
      ...metadata,
    });
    return chat.id;
  };
  const say = (
    chatId: string,
    role: "user" | "assistant",
    content: string,
    characterId: string | null = null,
    extra = {},
  ) =>
    chats.createMessage({
      chatId,
      role,
      characterId,
      content,
      extra: role === "user" ? { personaSnapshot: { personaId: "p", name: "P" }, ...extra } : extra,
    });
  const extraOf = async (messageId: string) => {
    const message = await chats.getMessage(messageId);
    return (typeof message!.extra === "string" ? JSON.parse(message!.extra) : message!.extra) as Record<string, any>;
  };

  // Helper path: each new message is hidden from the absent Pantalone only.
  const helperChat = await createChat();
  const greeting = await say(helperChat, "user", "P waves at Maukie across the tavern.");
  const maukieReply = await say(helperChat, "assistant", "Maukie purrs back.", ids.maukie);
  const pantaloneLine = await say(helperChat, "assistant", "Pantalone counts coins far away.", ids.pantalone);
  calls.length = 0;
  await memory.settleMessageVisibility(helperChat);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["visibility"],
    "one helper call decides every undecided recent message",
  );
  const task = JSON.parse(JSON.parse(calls[0]!.prompt)[1].content);
  assert(
    JSON.parse(calls[0]!.prompt)[0].content.includes("when unsure, mark them true"),
    "the helper hides only on evidence",
  );
  assert(
    JSON.parse(calls[0]!.prompt)[0].content.includes("being left out of a whisper does not count"),
    "a whisper stays private on its own, so a bystander keeps the rest of the message",
  );
  assert.deepEqual(task.recentlyActive, ["Maukie Whiskers", "Pantalone"], "speakers since the scene began are a hint");
  assert(
    task.decide.every((entry: { candidates: string[] }) => !entry.candidates.includes("Narrator")),
    "the narrator is never a candidate",
  );
  assert.deepEqual((await extraOf(greeting.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  assert.deepEqual(
    (await extraOf(maukieReply.id)).hiddenFromAICharacterIds,
    [ids.pantalone],
    "first-name, upper-case answers still map to the right characters",
  );
  const ownLine = await extraOf(pantaloneLine.id);
  assert.equal(ownLine.hiddenFromAICharacterIds, undefined, "the author always sees their own message");
  assert.deepEqual(ownLine.autoVisibility.hiddenCharacterIds, [], "a message everyone sees is still decided once");
  for (const swipe of await chats.getSwipes(maukieReply.id))
    assert.deepEqual(
      (typeof swipe.extra === "string" ? JSON.parse(swipe.extra) : swipe.extra).hiddenFromAICharacterIds,
      [ids.pantalone],
      "swipes stay in sync",
    );
  calls.length = 0;
  await memory.settleMessageVisibility(helperChat);
  assert.equal(calls.length, 0, "decided messages are never asked about again");

  // A manual change wins, before or after automation.
  const unhidden = await app.inject({
    method: "PATCH",
    url: `/api/chats/${helperChat}/messages/${maukieReply.id}/extra`,
    payload: { hiddenFromAI: false, hiddenFromAICharacterIds: [] },
  });
  assert.equal(unhidden.statusCode, 200, unhidden.body);
  const manualBefore = await say(helperChat, "assistant", "Maukie stretches.", ids.maukie);
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: `/api/chats/${helperChat}/messages/${manualBefore.id}/extra`,
        payload: { hiddenFromAICharacterIds: [] },
      })
    ).statusCode,
    200,
  );
  // /hide then /unhide is the user's choice too.
  const slashUnhidden = await say(helperChat, "user", "P mutters to himself.");
  for (const hidden of [true, false])
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/chats/${helperChat}/messages/bulk-hidden`,
          payload: { messageIds: [slashUnhidden.id], hidden },
        })
      ).statusCode,
      200,
    );
  // Hiding for everyone and back through the message menu is the user's choice too.
  const globalUnhidden = await say(helperChat, "user", "P checks the door.");
  for (const hiddenFromAI of [true, false])
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/chats/${helperChat}/messages/${globalUnhidden.id}/extra`,
          payload: { hiddenFromAI },
        })
      ).statusCode,
      200,
    );
  const presetHide = await say(helperChat, "assistant", "Maukie whispers.", ids.maukie, {
    hiddenFromAICharacterIds: [ids.narrator],
  });
  const later = await say(helperChat, "user", "P orders a drink.");
  calls.length = 0;
  await memory.settleMessageVisibility(helperChat);
  const laterTask = JSON.parse(JSON.parse(calls[0]!.prompt)[1].content);
  const numbers = new Map((await chats.listMessages(helperChat)).map((message, index) => [message.id, index + 1]));
  assert.deepEqual(
    laterTask.decide.map((entry: { messageNumber: number }) => entry.messageNumber),
    [numbers.get(later.id)],
    "manual and pre-existing visibility choices are not asked about",
  );
  assert.deepEqual((await extraOf(maukieReply.id)).hiddenFromAICharacterIds, [], "a later run keeps the user's unhide");
  assert.equal((await extraOf(maukieReply.id)).visibilityManual, true);
  assert.deepEqual((await extraOf(manualBefore.id)).hiddenFromAICharacterIds, []);
  assert.equal((await extraOf(manualBefore.id)).autoVisibility, undefined);
  assert.deepEqual((await extraOf(presetHide.id)).hiddenFromAICharacterIds, [ids.narrator]);
  assert.equal((await extraOf(slashUnhidden.id)).hiddenFromAICharacterIds, undefined, "/unhide keeps it visible");
  assert.equal((await extraOf(globalUnhidden.id)).visibilityManual, true, "Hide from AI for everyone counts as manual");
  assert.equal((await extraOf(globalUnhidden.id)).hiddenFromAICharacterIds, undefined, "unhiding keeps it visible");
  assert.deepEqual((await extraOf(later.id)).hiddenFromAICharacterIds, [ids.pantalone]);

  // A failed decision hides nothing.
  failVisibility = true;
  const failed = await say(helperChat, "user", "P sings loudly.");
  await memory.settleMessageVisibility(helperChat);
  failVisibility = false;
  assert.equal((await extraOf(failed.id)).hiddenFromAICharacterIds, undefined);
  assert.deepEqual((await extraOf(failed.id)).autoVisibility.hiddenCharacterIds, []);

  // An absent whisper recipient loses the narration, and the whisper still reaches them (#7191).
  const whisper = { type: "whisper", character: "Pantalone", text: "Meet me at dawn." };
  const whispered = await say(helperChat, "user", "P glances at the window.", null, {
    roleplayCommandActivity: [
      { raw: JSON.stringify(whisper), command: whisper, whisperRecipient: { id: ids.pantalone, kind: "character" } },
    ],
  });
  calls.length = 0;
  await memory.settleMessageVisibility(helperChat);
  assert.deepEqual(JSON.parse(JSON.parse(calls[0]!.prompt)[1].content).decide[0].candidates, [
    "Maukie Whiskers",
    "Pantalone",
  ]);
  assert.deepEqual((await extraOf(whispered.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  assert(
    roleplayHiddenWhisperMessageIds(await chats.listMessages(helperChat), ids.pantalone).has(whispered.id),
    "the hidden message still delivers its whisper to Pantalone",
  );

  // Off, merged mode and one-character chats make no extra call.
  const offChat = await createChat({ autoMessageVisibility: false });
  const mergedChat = await createChat({}, { groupChatMode: "merged" });
  const soloChat = await chats.create({
    name: "Solo",
    mode: "roleplay",
    characterIds: [ids.maukie],
    connectionId: connection.id,
  });
  assert(soloChat);
  await chats.patchMetadata(soloChat.id, {
    groupChatMode: "individual",
    advancedMemory: { ...DEFAULT_ADVANCED_MEMORY_SETTINGS, enabled: true, autoMessageVisibility: true },
  });
  calls.length = 0;
  for (const chatId of [offChat, mergedChat, soloChat.id]) {
    const message = await say(chatId, "user", "P waves.");
    await memory.settleMessageVisibility(chatId);
    await memory.checkScenesAfterGeneration(chatId);
    const extra = await extraOf(message.id);
    assert.equal(extra.autoVisibility, undefined);
    assert.equal(extra.hiddenFromAICharacterIds, undefined);
  }
  assert(!calls.some((call) => call.kind.includes("visibility")), "no visibility call without the toggle");

  // Without a Decision model, a due helper scene check also answers presence in the same call.
  const sharedHelperChat = await createChat({ sceneCheckInterval: 1 });
  const sharedHelperMessage = await say(sharedHelperChat, "user", "P sits beside Maukie.");
  calls.length = 0;
  await memory.checkScenesAfterGeneration(sharedHelperChat);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["scene+visibility"],
  );
  assert.deepEqual((await extraOf(sharedHelperMessage.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  const sharedState = JSON.parse((await chats.getById(sharedHelperChat))!.metadata).advancedMemoryState;
  assert.equal(sharedState.sceneCheckMessageId, sharedHelperMessage.id, "the shared scene check still commits");
  dropEnds = true;
  const noEnds = await say(sharedHelperChat, "user", "P orders tea.");
  calls.length = 0;
  await memory.checkScenesAfterGeneration(sharedHelperChat);
  dropEnds = false;
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["scene+visibility", "scene"],
    "a shared answer without scene endings asks for the scene check alone",
  );
  assert.deepEqual((await extraOf(noEnds.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  const retriedState = JSON.parse((await chats.getById(sharedHelperChat))!.metadata).advancedMemoryState;
  assert.equal(retriedState.sceneCheckMessageId, noEnds.id);
  assert.equal(retriedState.error, null);

  // Decision model: presence questions ride along with the scene-end check, or go alone when it is not due.
  const jevChat = await createChat({
    decisionEnabled: true,
    decisionConnectionId: decisionConnection.id,
    sceneCheckInterval: 1,
  });
  const jevMessage = await say(jevChat, "user", "P pours tea for Maukie.");
  decisionRequests.length = 0;
  calls.length = 0;
  await memory.checkScenesAfterGeneration(jevChat);
  assert.equal(decisionRequests.length, 1, "one Decision request answers the scene end and presence");
  const questionIds = Object.keys(decisionRequests[0]!.questions);
  assert(questionIds.includes(jevMessage.id), "the scene-end question is asked");
  assert.deepEqual(
    questionIds.filter((id) => id.startsWith("presence:")).sort(),
    [`presence:${jevMessage.id}:${ids.maukie}`, `presence:${jevMessage.id}:${ids.pantalone}`].sort(),
  );
  assert(decisionRequests[0]!.state.transcript && decisionRequests[0]!.state.presence.transcript);
  assert.equal(calls.length, 0, "the Decision model, not the helper, decides presence");
  assert.deepEqual((await extraOf(jevMessage.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  dropPresence = true;
  const unanswered = await say(jevChat, "user", "P hums.");
  decisionRequests.length = 0;
  await memory.checkScenesAfterGeneration(jevChat);
  dropPresence = false;
  assert.equal(decisionRequests.length, 2, "an unusable presence answer retries the scene check alone");
  assert(Object.keys(decisionRequests[1]!.questions).every((id) => !id.startsWith("presence:")));
  assert.equal(calls.length, 0, "the scene check does not fall back to the helper");
  assert.equal(
    JSON.parse((await chats.getById(jevChat))!.metadata).advancedMemoryState.sceneCheckMessageId,
    unanswered.id,
  );
  assert.equal((await extraOf(unanswered.id)).hiddenFromAICharacterIds, undefined, "no presence answer hides nothing");
  await memory.updateSettings(jevChat, { sceneCheckInterval: 50 });
  const jevAlone = await say(jevChat, "assistant", "Maukie sips.", ids.maukie);
  decisionRequests.length = 0;
  await memory.checkScenesAfterGeneration(jevChat);
  assert.equal(decisionRequests.length, 1);
  assert(Object.keys(decisionRequests[0]!.questions).every((id) => id.startsWith("presence:")));
  assert.deepEqual((await extraOf(jevAlone.id)).hiddenFromAICharacterIds, [ids.pantalone]);

  // Maukie replies, then Pantalone answers beside her: an unsure Decision model hides nothing (#7263).
  const besideChat = await createChat({ decisionEnabled: true, decisionConnectionId: decisionConnection.id });
  await say(besideChat, "user", "P sits by the campfire with Maukie and Pantalone.");
  await say(besideChat, "assistant", "MAUKIE_BESIDE_THE_FIRE", ids.maukie);
  await memory.settleMessageVisibility(besideChat);
  const besideLine = await say(besideChat, "assistant", "Pantalone passes Maukie the bread.", ids.pantalone);
  unsurePresence = 0.3;
  decisionRequests.length = 0;
  await memory.settleMessageVisibility(besideChat);
  unsurePresence = null;
  assert.equal(decisionRequests.length, 1);
  assert.deepEqual(
    decisionRequests[0]!.state.presence.transcript
      .slice(-2)
      .map((entry: { speaker: string; content: string }) => [entry.speaker, entry.content]),
    [
      ["Maukie Whiskers", "MAUKIE_BESIDE_THE_FIRE"],
      ["Pantalone", "Pantalone passes Maukie the bread."],
    ],
    "the reply just before is in the context, with its speaker",
  );
  const besideQuestion = decisionRequests[0]!.questions[`presence:${besideLine.id}:${ids.maukie}`];
  assert(besideQuestion?.instructions.includes('by "Pantalone"'), "the question names who wrote the message");
  assert(besideQuestion.instructions.includes("present even when silent or left out of a whisper"));
  assert(
    besideQuestion.instructions.includes("never places there"),
    "a character never shown in the scene is elsewhere",
  );
  assert.equal(
    (await extraOf(besideLine.id)).hiddenFromAICharacterIds,
    undefined,
    "an unsure answer keeps a present character seeing the message",
  );
  assert.deepEqual((await extraOf(besideLine.id)).autoVisibility.hiddenCharacterIds, []);

  // A new scene's opening message still shows the messages just before it (#7263).
  const sceneChat = await createChat({ decisionEnabled: true, decisionConnectionId: decisionConnection.id });
  await say(sceneChat, "user", "P and Maukie walk to the market together.");
  await say(sceneChat, "assistant", "MAUKIE_FOLLOWS_TO_MARKET", ids.maukie);
  await memory.settleMessageVisibility(sceneChat);
  const closing = await memory.getSceneCheck(sceneChat, { force: true });
  assert(closing && (await memory.commitSceneCheck(sceneChat, closing, { ends: [{ messageNumber: 2 }] })));
  const opening = await say(sceneChat, "assistant", "Pantalone haggles at the market stall.", ids.pantalone);
  decisionRequests.length = 0;
  await memory.settleMessageVisibility(sceneChat);
  assert.equal(decisionRequests.length, 1);
  assert.deepEqual(
    decisionRequests[0]!.state.presence.transcript.map((entry: { content: string }) => entry.content),
    ["P and Maukie walk to the market together.", "MAUKIE_FOLLOWS_TO_MARKET", "Pantalone haggles at the market stall."],
    "the messages before a new scene are still context",
  );
  assert.deepEqual(decisionRequests[0]!.state.presence.recentlyActive, ["Pantalone"], "speakers stay scene-only");
  assert.equal((await extraOf(opening.id)).hiddenFromAICharacterIds, undefined);

  // A small Decision state limit shortens long messages instead of dropping the earlier ones (#7263).
  const smallJev = await connections.create({
    name: "Small Jev",
    provider: "decision",
    decisionSource: "custom",
    baseUrl: `http://127.0.0.1:${address.port}`,
    model: "jev-fixture",
    apiKey: "",
    maxStateTokens: 2000,
  });
  const longChat = await createChat({ decisionEnabled: true, decisionConnectionId: smallJev.id });
  const rain = " The rain drums on the tavern roof.".repeat(300);
  const decided = { autoVisibility: { decidedAt: "2026-01-01T00:00:00.000Z", hiddenCharacterIds: [] } };
  await say(longChat, "user", `EARLIER_1 Pantalone walks out toward the harbour.${rain}`, null, decided);
  await say(longChat, "assistant", `EARLIER_2 Maukie watches him go.${rain}`, ids.maukie, decided);
  await say(longChat, "user", `EARLIER_3 P shuts the door.${rain}`, null, decided);
  // Under the 1000-token cap, so its last line reaches the shortening.
  const lastLine = "Pantalone's footsteps fade down the stairs.";
  await say(
    longChat,
    "assistant",
    `EARLIER_4 Maukie curls up by the fire.${rain.slice(0, 3200)} ${lastLine}`,
    ids.maukie,
    decided,
  );
  const longLine = await say(longChat, "user", `CURRENT_LINE P raises a toast.${rain}`);
  decisionRequests.length = 0;
  await memory.settleMessageVisibility(longChat);
  assert.equal(decisionRequests.length, 1, "the shortened transcript fits the Decision request");
  const longState = decisionRequests[0]!.state;
  assert(estimateChatSummaryTokens(JSON.stringify(longState)) <= 2000, "the Decision state limit holds");
  const longTranscript = longState.presence.transcript as Array<{ speaker: string; content: string }>;
  assert.deepEqual(
    longTranscript.map((entry) => [entry.speaker, entry.content.split(" ")[0]]),
    [
      ["P", "EARLIER_1"],
      ["Maukie Whiskers", "EARLIER_2"],
      ["P", "EARLIER_3"],
      ["Maukie Whiskers", "EARLIER_4"],
      ["P", "CURRENT_LINE"],
    ],
    "four earlier messages stay in order with their speakers beside a long new message",
  );
  assert(longTranscript[0]!.content.includes("walks out toward the harbour"), "who left is still in the context");
  assert(longTranscript[3]!.content.endsWith(lastLine), "a shortened message keeps its end, where people often leave");
  assert(
    longTranscript.every((entry) => estimateChatSummaryTokens(entry.content) >= 64),
    "each message keeps a few sentences",
  );
  assert.deepEqual((await extraOf(longLine.id)).hiddenFromAICharacterIds, [ids.pantalone]);

  // A message over the 1000-token cap keeps its real end, even when the transcript is shortened again.
  const overCapChat = await createChat({ decisionEnabled: true, decisionConnectionId: smallJev.id });
  const exitLine = "At last Pantalone walks out toward the harbour.";
  await say(
    overCapChat,
    "assistant",
    `OVER_CAP Maukie and Pantalone share a drink.${rain} ${exitLine}`,
    ids.maukie,
    decided,
  );
  await say(overCapChat, "user", `AFTER_EXIT P raises a toast.${rain}`);
  decisionRequests.length = 0;
  await memory.settleMessageVisibility(overCapChat);
  assert.equal(decisionRequests.length, 1);
  const overCapState = decisionRequests[0]!.state;
  assert(estimateChatSummaryTokens(JSON.stringify(overCapState)) <= 2000, "the Decision state limit holds");
  const overCapTranscript = overCapState.presence.transcript as Array<{ content: string }>;
  assert(overCapTranscript[0]!.content.startsWith("OVER_CAP"), "the long message keeps its start");
  assert(overCapTranscript[0]!.content.endsWith(exitLine), "and its real last line, where Pantalone leaves");
  assert.equal(overCapTranscript[0]!.content.split("omitted]").length, 2, "shortening twice leaves one gap");

  // The generation guard decides earlier messages before each character's context is built.
  const routeChat = await createChat();
  await memory.initialize(routeChat);
  const undecided = await say(routeChat, "user", "UNDECIDED_PERSONA_LINE");
  calls.length = 0;
  mainReplies = ["MAUKIE_REPLY", "PANTALONE_REPLY", "NARRATOR_REPLY"];
  const generated = await app.inject({ method: "POST", url: "/api/generate/", payload: { chatId: routeChat } });
  assert.equal(generated.statusCode, 200, generated.body);
  assert(!generated.body.includes('"type":"error"'), generated.body);
  const kinds = calls.map((call) => call.kind);
  assert.deepEqual(
    kinds.slice(0, 5),
    ["visibility", "main", "visibility", "main", "visibility"],
    "visibility settles before every character replies",
  );
  const mains = calls.filter((call) => call.kind === "main");
  assert.equal(mains.length, 3);
  assert.deepEqual((await extraOf(undecided.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  assert(mains[0]!.prompt.includes("UNDECIDED_PERSONA_LINE"), "Maukie is present");
  assert(!mains[1]!.prompt.includes("UNDECIDED_PERSONA_LINE"), "Pantalone never receives the earlier line");
  assert(!mains[1]!.prompt.includes("MAUKIE_REPLY"), "nor Maukie's reply from the same turn");
  assert(mains[2]!.prompt.includes("UNDECIDED_PERSONA_LINE") && mains[2]!.prompt.includes("MAUKIE_REPLY"));
  const routeMessages = await chats.listMessages(routeChat);
  for (const message of routeMessages)
    assert(
      !(await extraOf(message.id)).hiddenFromAICharacterIds?.includes(ids.narrator),
      "the narrator is never hidden from",
    );
  const narratorReply = routeMessages.find((message) => message.content.includes("NARRATOR_REPLY"))!;
  assert.deepEqual(
    (await extraOf(narratorReply.id)).hiddenFromAICharacterIds,
    [ids.pantalone],
    "the post-reply check decides the turn's last reply",
  );

  // Your own message is decided once, when you send it (#7349).
  const events = (body: string) =>
    body
      .split("\n\n")
      .filter((block) => block.startsWith("data: "))
      .map((block) => JSON.parse(block.slice(6)) as { type: string; data: any });
  const timesDecided = async (chatId: string, messageId: string) => {
    const number = (await chats.listMessages(chatId)).findIndex((message) => message.id === messageId) + 1;
    return calls
      .filter((call) => call.kind === "visibility")
      .flatMap((call) => JSON.parse(JSON.parse(call.prompt)[1].content).decide)
      .filter((entry: { messageNumber: number }) => entry.messageNumber === number).length;
  };
  const sendChat = await createChat();
  await memory.initialize(sendChat);
  calls.length = 0;
  mainReplies = ["MAUKIE_ANSWERS", "PANTALONE_ANSWERS", "NARRATOR_ANSWERS"];
  const sent = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: sendChat, userMessage: "SENT_PERSONA_LINE" },
  });
  assert.equal(sent.statusCode, 200, sent.body);
  const sentEvents = events(sent.body);
  const sentLine = (await chats.listMessages(sendChat)).find((message) => message.content === "SENT_PERSONA_LINE")!;
  assert.deepEqual((await extraOf(sentLine.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  const firstReply = sentEvents.findIndex((event) => event.type === "message_saved" && event.data.role === "assistant");
  const shownDecided = sentEvents.findIndex(
    (event) =>
      event.type === "message_saved" &&
      event.data.id === sentLine.id &&
      JSON.parse(event.data.extra).hiddenFromAICharacterIds?.includes(ids.pantalone),
  );
  assert(
    shownDecided >= 0 && shownDecided < firstReply,
    "the crossed-eye marker reaches your message before the first character replies",
  );
  assert.equal(await timesDecided(sendChat, sentLine.id), 1, "a sent message is decided once");

  // Posted without a reply (manual order, Post only, /send): decided right away, and never again.
  calls.length = 0;
  const posted = await app.inject({
    method: "POST",
    url: `/api/chats/${sendChat}/messages`,
    payload: { role: "user", content: "POSTED_PERSONA_LINE", characterId: null },
  });
  assert.equal(posted.statusCode, 200, posted.body);
  assert.deepEqual(
    JSON.parse(posted.json().extra).hiddenFromAICharacterIds,
    [ids.pantalone],
    "a message posted without a reply is decided when you post it",
  );
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["visibility"],
  );
  await memory.settleMessageVisibility(sendChat);
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["visibility"],
    "a posted message is not asked about again",
  );
  const asCharacter = await app.inject({
    method: "POST",
    url: `/api/chats/${sendChat}/messages`,
    payload: { role: "assistant", content: "Maukie, by hand.", characterId: ids.maukie },
  });
  assert.equal(asCharacter.statusCode, 200, asCharacter.body);
  assert.equal(calls.length, 1, "a character message written by hand is left for the next reply, as before");
  const offPosted = await app.inject({
    method: "POST",
    url: `/api/chats/${offChat}/messages`,
    payload: { role: "user", content: "P waves again.", characterId: null },
  });
  assert.equal(offPosted.statusCode, 200, offPosted.body);
  assert.equal(calls.length, 1, "no call when the toggle is off");

  // A message written for you by Impersonate is yours too.
  calls.length = 0;
  mainReplies = ["IMPERSONATED_PERSONA_LINE"];
  const impersonated = await app.inject({
    method: "POST",
    url: "/api/generate/",
    payload: { chatId: sendChat, impersonate: true },
  });
  assert.equal(impersonated.statusCode, 200, impersonated.body);
  const impersonatedLine = (await chats.listMessages(sendChat)).at(-1)!;
  assert.equal(impersonatedLine.role, "user", impersonated.body);
  assert.deepEqual((await extraOf(impersonatedLine.id)).hiddenFromAICharacterIds, [ids.pantalone]);
  assert(
    events(impersonated.body).some(
      (event) =>
        event.type === "message_saved" &&
        event.data.id === impersonatedLine.id &&
        JSON.parse(event.data.extra).hiddenFromAICharacterIds?.includes(ids.pantalone),
    ),
    "the crossed-eye marker reaches the written message without waiting for a refresh",
  );
} finally {
  await app.close();
  provider.close();
  closeDB();
  rmSync(dir, { recursive: true, force: true });
}
