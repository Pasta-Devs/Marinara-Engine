// Video Run Interval: automatic videos (a Conversation character's [video], a Roleplay Illustrator's
// generateVideo) wait the chat's Video Run Interval after the last automatic clip, are neither offered nor
// made in between, and 0 turns them off. The image Run Interval is separate and unchanged.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-video-run-interval-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

// Everything after the environment runs inside one try, so a failed import or setup still cleans up.
let appHandle: { close: () => Promise<unknown> } | undefined;
let providerHandle: import("node:http").Server | undefined;
let closeDatabase: (() => Promise<void>) | undefined;
try {
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
  const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
  const { agentsRoutes } = await import("../../packages/server/src/routes/agents.routes.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
  const { applyIllustratorChatRunInterval, automaticVideoAllowed, claimAutomaticVideoRun, resolveVideoRunInterval } =
    await import("../../packages/server/src/services/generation/agent-cadence.js");
  const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

  // ── The rules ──
  // Clips only: every Illustrator run is a clip, so the Video Run Interval paces it instead of the Image Run Interval.
  assert.equal(
    applyIllustratorChatRunInterval(
      "illustrator",
      { runInterval: 2 },
      { illustratorVideoMode: "clips_only", illustratorRunInterval: 1, illustratorVideoRunInterval: 4 },
      "roleplay",
    ).runInterval,
    4,
  );
  assert.equal(
    applyIllustratorChatRunInterval(
      "illustrator",
      { runInterval: 2 },
      { illustratorVideoMode: "pictures_and_clips", illustratorRunInterval: 1, illustratorVideoRunInterval: 4 },
      "roleplay",
    ).runInterval,
    1,
    "other modes keep the Image Run Interval",
  );
  assert.equal(resolveVideoRunInterval({}, {}), 5, "default");
  assert.equal(resolveVideoRunInterval({}, { videoRunInterval: "2" }), 2, "agent default");
  assert.equal(resolveVideoRunInterval({ illustratorVideoRunInterval: 0 }, { videoRunInterval: 2 }), 0, "chat wins");
  const messages = ["m1", "m2", "m3", "m4"].map((id, index) => ({ id, role: index % 2 ? "assistant" : "user" }));
  assert.equal(automaticVideoAllowed(messages, {}, 3), true, "no anchor: the first is allowed");
  assert.equal(automaticVideoAllowed(messages, {}, 0), false, "0: never on its own");
  assert.equal(automaticVideoAllowed(messages, { lastAutomaticVideoMessageId: "m2" }, 3), false, "2 since < 3");
  assert.equal(automaticVideoAllowed(messages, { lastAutomaticVideoMessageId: "m2" }, 3, true), true, "+ upcoming");
  assert.equal(automaticVideoAllowed(messages, { lastAutomaticVideoMessageId: "gone" }, 3), true, "deleted anchor");
  const anchoredOnLast = { lastAutomaticVideoMessageId: "m4" };
  assert.equal(
    automaticVideoAllowed(messages, anchoredOnLast, 3, false, "m4"),
    true,
    "a new swipe of the clip's message",
  );
  assert.equal(automaticVideoAllowed(messages, anchoredOnLast, 3, false, "m5"), false, "a different message");
  assert.equal(automaticVideoAllowed(messages, anchoredOnLast, 0, false, "m4"), false, "0 still means never");

  // Claiming the interval as a clip starts, against a store that runs metadata writes one at a time, as chats do.
  const fakeChat = () => {
    let meta: Record<string, unknown> = { lastAutomaticVideoMessageId: "old" };
    let queue: Promise<unknown> = Promise.resolve();
    return {
      anchor: () => meta.lastAutomaticVideoMessageId,
      patchMetadata(_id: string, updater: (current: Record<string, unknown>) => unknown) {
        const run = queue.then(async () => {
          meta = { ...meta, ...((await updater({ ...meta })) as Record<string, unknown>) };
        });
        queue = run.catch(() => undefined);
        return run;
      },
    };
  };
  {
    // Two replies that both pass the check before either claims: only the first starts a clip.
    const store = fakeChat();
    const freeOfOld = async (current: Record<string, unknown>) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return current.lastAutomaticVideoMessageId === "old";
    };
    const [first, second] = await Promise.all([
      claimAutomaticVideoRun(store, "race", "r1", freeOfOld),
      claimAutomaticVideoRun(store, "race", "r2", freeOfOld),
    ]);
    assert.ok(first, "the first claim starts its clip");
    assert.equal(second, null, "the second sees the first's claim and is refused");
    assert.equal(store.anchor(), "r1");
    // A failed clip gives the previous starting point back.
    await first.settle(false);
    assert.equal(store.anchor(), "old", "a failed clip gives the interval back");
  }
  {
    // Two clips from one merged group reply: one fails while the other is made, so the reply stays the anchor.
    const store = fakeChat();
    const [a, b] = await Promise.all([
      claimAutomaticVideoRun(store, "group", "g1"),
      claimAutomaticVideoRun(store, "group", "g1"),
    ]);
    assert.ok(a && b);
    await a.settle(false);
    assert.equal(store.anchor(), "g1", "still counting from the reply while the other clip is made");
    await b.settle(true);
    assert.equal(store.anchor(), "g1", "one clip of the reply was made");
    // Both failing gives the interval back.
    const [c, d] = await Promise.all([
      claimAutomaticVideoRun(store, "group", "g2"),
      claimAutomaticVideoRun(store, "group", "g2"),
    ]);
    await c!.settle(false);
    await d!.settle(false);
    assert.equal(store.anchor(), "g1", "neither was made");
  }
  {
    // A metadata write that fails after the claim took its hold gives the hold back, so a later clip for the same
    // message is checked again instead of joining a hold that never ends.
    const store = fakeChat();
    const failing = {
      patchMetadata: (id: string, updater: (current: Record<string, unknown>) => unknown) =>
        store.patchMetadata(id, async (current) => {
          await updater(current);
          throw new Error("disk full");
        }),
    };
    const lost = await claimAutomaticVideoRun(failing, "broken", "b1");
    assert.ok(lost, "the clip may still be made");
    const refused = await claimAutomaticVideoRun(store, "broken", "b1", () => false);
    assert.equal(refused, null, "the next claim is checked, not joined to a stale hold");
    // A clip that had to pass the interval check is refused when the write fails, rather than slipping through.
    assert.equal(await claimAutomaticVideoRun(failing, "broken", "b2", () => true), null, "a checked clip is refused");
  }

  replaceBuiltInAgentDefinitions([
    {
      id: "illustrator",
      name: "Illustrator",
      description: "Video interval fixture",
      phase: "post_processing",
      enabledByDefault: true,
      category: "utility",
      defaultTools: [],
      defaultSettings: { contextSize: 2 },
      defaultPromptTemplate: 'AGENT_WRITER Return JSON {"shouldGenerate":true,"prompt":"..."}.',
    },
  ]);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
  let mainReply = "";
  const agentRequests: string[] = [];
  const replyRequests: string[] = [];
  const provider = (providerHandle = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const url = request.url ?? "";
    const json = (value: unknown) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(value));
    };
    if (url.endsWith("/prompt")) return json({ prompt_id: "job" });
    if (url.includes("/history/")) {
      return json({
        job: {
          status: { completed: true, status_str: "success" },
          outputs: { "9": { gifs: [{ filename: "clip.mp4", subfolder: "", type: "output" }] } },
        },
      });
    }
    if (url.startsWith("/view")) {
      response.setHeader("content-type", "video/mp4");
      return response.end(mp4);
    }
    if (url.endsWith("/images/generations")) return json({ data: [{ b64_json: png.toString("base64") }] });
    const requestMessages = JSON.stringify(JSON.parse(body).messages ?? []);
    let content = mainReply;
    if (requestMessages.includes("AGENT_WRITER")) {
      agentRequests.push(requestMessages);
      content = JSON.stringify({
        shouldGenerate: true,
        prompt: "rain",
        generateVideo: true,
        videoPrompt: "Rain falls",
      });
    } else if (requestMessages.includes("video prompt writer")) {
      content = "Aster waves";
    } else {
      replyRequests.push(requestMessages);
    }
    json({
      choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { total_tokens: 20 },
    });
  }));

  // Registered first: closeDB also cleans up after a failed getDB().
  closeDatabase = closeDB;
  const db = await getDB();
  const app = Fastify();
  appHandle = app;
  app.decorate("db", db);
  await app.register(generateRoutes, { prefix: "/api/generate" });
  await app.register(chatsRoutes, { prefix: "/api/chats" });
  await app.register(agentsRoutes, { prefix: "/api/agents" });
  const chats = createChatsStorage(db);
  // Chat Settings saves through this route; it returns what the chat now holds for each key sent.
  const saveChatSettings = async (chatId: string, patch: Record<string, unknown>) => {
    const response = await app.inject({ method: "PATCH", url: `/api/chats/${chatId}/metadata`, payload: patch });
    assert.equal(response.statusCode, 200, response.body);
    const raw = (await chats.getById(chatId))?.metadata;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
  };
  const videoCount = async (chatId: string) =>
    (await chats.listMessages(chatId)).reduce((count, message) => {
      const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
      const attachments = (extra as { attachments?: Array<{ type?: string }> }).attachments ?? [];
      return count + attachments.filter((attachment) => attachment.type === "video").length;
    }, 0);

  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text",
    provider: "custom",
    baseUrl: `${baseUrl}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const image = await connections.create({
    name: "Image",
    provider: "image_generation",
    baseUrl: `${baseUrl}/v1`,
    model: "dall-e-3",
    imageService: "openai",
    imageGenerationSource: "openai",
    apiKey: "fixture",
  });
  const video = await connections.create({
    name: "ComfyUI video",
    provider: "video_generation",
    baseUrl,
    model: "fixture-video",
    videoService: "comfyui",
    videoGenerationSource: "comfyui",
    comfyuiWorkflow: JSON.stringify({ "1": { inputs: { text: "%prompt%", image: "%reference_image%" } } }),
    apiKey: "",
  });
  await createAgentsStorage(db).create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: text.id,
    settings: { imageConnectionId: image.id, contextSize: 2, enabledTools: [] },
  });
  // The agent default is saved by the Agent editor through the agents route and read back as the interval.
  const agentSaved = await app.inject({
    method: "PATCH",
    url: "/api/agents/type/illustrator",
    payload: { settings: { imageConnectionId: image.id, contextSize: 2, enabledTools: [], videoRunInterval: 7 } },
  });
  assert.equal(agentSaved.statusCode, 200, agentSaved.body);
  const illustratorSettings = (await createAgentsStorage(db).getByType("illustrator"))?.settings;
  const parsedSettings =
    typeof illustratorSettings === "string" ? JSON.parse(illustratorSettings) : illustratorSettings;
  assert.equal(resolveVideoRunInterval({}, parsedSettings), 7, "the agent's saved Video Run Interval is used");

  const aster = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Aster" }));
  assert.ok(aster);
  const prompts = createPromptsStorage(db);
  const preset = await prompts.create({ name: "Fixture", parameters: {}, wrapFormat: "xml" });
  assert.ok(preset);
  await prompts.createSection({
    presetId: preset.id,
    identifier: "history",
    name: "History",
    isMarker: true,
    markerConfig: { type: "chat_history" },
  });
  const generate = async (chatId: string, userMessage: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: { chatId, userMessage, streaming: false },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  const regenerate = async (chatId: string, regenerateMessageId: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/generate",
      payload: { chatId, regenerateMessageId, streaming: false },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  const latestAssistant = async (chatId: string) =>
    (await chats.listMessages(chatId)).filter((message) => message.role === "assistant").at(-1)!;
  // Videos on the message itself (its active swipe) and across all of its swipes.
  const messageVideos = async (messageId: string) => {
    const count = (extra: unknown) => {
      const parsed = typeof extra === "string" ? JSON.parse(extra) : (extra ?? {});
      return ((parsed as { attachments?: Array<{ type?: string }> }).attachments ?? []).filter(
        (attachment) => attachment.type === "video",
      ).length;
    };
    const swipes = await chats.getSwipes(messageId);
    return {
      active: count((await chats.getMessage(messageId))?.extra),
      swipes: swipes.length,
      perSwipe: swipes.map((swipe: { extra?: unknown }) => count(swipe.extra)),
    };
  };

  // ── Conversation: interval 3 ──
  const convo = await chats.create({
    name: "Convo",
    mode: "conversation",
    characterIds: [aster.id],
    connectionId: text.id,
  });
  assert.ok(convo);
  // The route clamps a typed value to the field's range.
  assert.equal(
    (await saveChatSettings(convo.id, { illustratorVideoRunInterval: 250 })).illustratorVideoRunInterval,
    100,
  );
  const convoSettings = await saveChatSettings(convo.id, {
    characterCommands: true,
    conversationCommandToggles: { video: true },
    sceneVideoConnectionId: video.id,
    sceneVideoFirstFrame: "prompt_only",
    illustratorVideoRunInterval: "3",
    automaticSummaryEnabled: false,
  });
  assert.equal(convoSettings.illustratorVideoRunInterval, 3);
  mainReply = "Here! [video]";
  await generate(convo.id, "Video please");
  assert.equal(await videoCount(convo.id), 1, "the first automatic clip is allowed");
  assert.match(replyRequests.at(-1) ?? "", /\[video\]/u, "the command was offered");
  // A short context window (here 1 message) must not hide the last clip: the interval counts over the whole chat,
  // so the command is not offered where the clip would then be refused.
  await saveChatSettings(convo.id, { contextMessageLimit: 1 });
  await generate(convo.id, "Another?");
  assert.equal(await videoCount(convo.id), 1, "held back: only 2 messages since the last clip");
  assert.doesNotMatch(replyRequests.at(-1) ?? "", /\[video\] or \[video:/u, "and not offered");
  await saveChatSettings(convo.id, { contextMessageLimit: null });
  await generate(convo.id, "And now?");
  assert.equal(await videoCount(convo.id), 2, "allowed again after the interval");

  // Swiping the reply that just sent a clip: the new swipe is a new reply, so its [video] is made too,
  // and the first swipe keeps its own clip.
  const swiped = await latestAssistant(convo.id);
  await regenerate(convo.id, swiped.id);
  assert.deepEqual(await messageVideos(swiped.id), { active: 1, swipes: 2, perSwipe: [1, 1] });
  // The interval still spaces separate messages.
  await generate(convo.id, "Right after?");
  assert.equal((await messageVideos((await latestAssistant(convo.id)).id)).active, 0);

  // 0: never on its own.
  const neverSettings = await saveChatSettings(convo.id, {
    illustratorVideoRunInterval: 0,
    lastAutomaticVideoMessageId: null,
  });
  assert.equal(neverSettings.illustratorVideoRunInterval, 0);
  await generate(convo.id, "One more?");
  assert.equal(await videoCount(convo.id), 2);

  // ── Roleplay Illustrator: interval 4 ──
  const roleplay = await chats.create({
    name: "Roleplay",
    mode: "roleplay",
    characterIds: [aster.id],
    connectionId: text.id,
    promptPresetId: preset.id,
  });
  assert.ok(roleplay);
  const roleplaySettings = await saveChatSettings(roleplay.id, {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    illustratorRunInterval: 1,
    illustratorVideoMode: "pictures_and_clips",
    illustratorVideoRunInterval: 4,
    sceneVideoConnectionId: video.id,
    automaticSummaryEnabled: false,
  });
  assert.equal(roleplaySettings.illustratorVideoRunInterval, 4);
  assert.equal(roleplaySettings.illustratorVideoMode, "pictures_and_clips");
  mainReply = "Rain falls on Aster.";
  await generate(roleplay.id, "Aster steps outside.");
  assert.equal(await videoCount(roleplay.id), 1);
  // Swiping the Illustrator's reply: the agent is offered a clip again and its new picture is animated.
  const illustrated = await latestAssistant(roleplay.id);
  await regenerate(roleplay.id, illustrated.id);
  assert.match(agentRequests.at(-1) ?? "", /optional_video/u, "offered again on a new swipe");
  const illustratedVideos = await messageVideos(illustrated.id);
  assert.equal(illustratedVideos.active, 1, JSON.stringify(illustratedVideos));
  assert.equal(illustratedVideos.swipes, 2);
  await generate(roleplay.id, "Aster waits.");
  assert.doesNotMatch(agentRequests.at(-1) ?? "", /optional_video/u, "not offered inside the interval");
  assert.equal(await videoCount(roleplay.id), 1, "an image, but no clip, inside the interval");
  console.log("illustrator-video-run-interval regression passed");
} finally {
  await appHandle?.close();
  const fakeProvider = providerHandle;
  if (fakeProvider?.listening) await new Promise<void>((resolve) => fakeProvider.close(() => resolve()));
  await closeDatabase?.();
  rmSync(fixtureDir, { recursive: true, force: true });
}
