// Generated Videos, through the real generate route with a fake text model, image service and ComfyUI:
// a Conversation character's [video] command sends a clip on its message only when the chat turned
// Generated Videos on, and a Roleplay Illustrator that sets generateVideo animates its new picture into
// the same message only when the chat allows it (and is only offered the fields then).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-agent-generated-videos-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

let appHandle: { close: () => Promise<unknown> } | undefined;
let providerHandle: import("node:http").Server | undefined;
let closeDatabase: (() => Promise<void>) | undefined;
try {
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { generateRoutes } = await import("../../packages/server/src/routes/generate.routes.js");
  const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
  const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
  const { appSettingsRoutes } = await import("../../packages/server/src/routes/app-settings.routes.js");
  const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
  const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
  const { createConnectionsStorage } =
    await import("../../packages/server/src/services/storage/connections.storage.js");
  const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
  const { createPromptsStorage } = await import("../../packages/server/src/services/storage/prompts.storage.js");
  const { createGameSceneVideosStorage } =
    await import("../../packages/server/src/services/storage/game-scene-videos.storage.js");
  const { parseCharacterCommands } =
    await import("../../packages/server/src/services/conversation/character-commands.js");
  const { VIDEO_CONTEXT_MAX_CHARS } =
    await import("../../packages/server/src/services/generation/conversation-video-runtime.js");
  const { filterEnabledConversationCommands } =
    await import("../../packages/server/src/services/generation/conversation-command-runtime.js");
  const { characterDataSchema, replaceBuiltInAgentDefinitions } = await import("../../packages/shared/dist/index.js");

  replaceBuiltInAgentDefinitions([
    {
      id: "illustrator",
      name: "Illustrator",
      description: "Generated videos fixture",
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
  let failVideo = false;
  // Runs once when the next clip reaches the video service (after the reply is saved).
  let beforeVideo: (() => Promise<void>) | null = null;
  let illustratorReply: Record<string, unknown> = {
    shouldGenerate: true,
    prompt: "1girl, lantern, rain",
    generateVideo: true,
    videoPrompt: "The lantern light flickers as Aster turns",
  };
  // Every text request, newest last.
  const textRequests: string[] = [];
  const videoWriterRequests: string[] = [];
  const shortenRequests: string[] = [];
  let shortenReply = "";
  const directorRequests: string[] = [];
  const agentRequests: string[] = [];
  const comfyPrompts: string[] = [];
  const provider = (providerHandle = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const url = request.url ?? "";
    const json = (value: unknown) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(value));
    };
    if (url.endsWith("/prompt")) {
      if (failVideo) {
        response.statusCode = 500;
        return json({ error: "ComfyUI is down" });
      }
      comfyPrompts.push(body);
      const hook = beforeVideo;
      beforeVideo = null;
      if (hook) await hook();
      return json({ prompt_id: "job" });
    }
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
    const messages = JSON.stringify(JSON.parse(body).messages ?? []);
    textRequests.push(messages);
    let content = mainReply;
    if (messages.includes("<source_exchange>")) {
      // A Roleplay video director writing a clip's prompt.
      directorRequests.push(messages);
      content = JSON.stringify({ narrationBeat: "Lantern light sways as the scene moves" });
    } else if (messages.includes("AGENT_WRITER")) {
      agentRequests.push(messages);
      content = JSON.stringify(illustratorReply);
    } else if (messages.includes("Shorten this description of a short video message")) {
      shortenRequests.push(messages);
      content = shortenReply;
    } else if (messages.includes("video prompt writer")) {
      videoWriterRequests.push(messages);
      content = "Aster waves at the camera";
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
  await app.register(connectionsRoutes, { prefix: "/api/connections" });
  await app.register(appSettingsRoutes, { prefix: "/api/app-settings" });
  const chats = createChatsStorage(db);

  // The Generated Videos toggles are saved through Chat Settings' own route, and each comes back as sent.
  const saveChatSettings = async (chatId: string, patch: Record<string, unknown>) => {
    const response = await app.inject({ method: "PATCH", url: `/api/chats/${chatId}/metadata`, payload: patch });
    assert.equal(response.statusCode, 200, response.body);
    const raw = (await chats.getById(chatId))?.metadata;
    const saved = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) assert.deepEqual(saved[key], value, key);
  };

  const videoAttachments = async (chatId: string) => {
    const messages = await chats.listMessages(chatId);
    return messages.flatMap((message) => {
      const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
      return ((extra as { attachments?: Array<{ type?: string }> }).attachments ?? [])
        .filter((attachment) => attachment.type === "video")
        .map((attachment) => ({ messageId: message.id, attachment }));
    });
  };

  // The [video] command parses like [selfie], and stays off unless Generated Videos is on.
  // Free text may quote dialogue and wrap lines; an unclosed tag never swallows text or the next command.
  const quoted = parseCharacterCommands(
    'Here! [video: she wears a "tardigrade enthusiast" shirt\nand whispers "sorry" to it.] Humbling.',
  );
  assert.deepEqual(quoted.commands, [
    { type: "video", context: 'she wears a "tardigrade enthusiast" shirt\nand whispers "sorry" to it.' },
  ]);
  assert.equal(quoted.cleanContent.replace(/\s+/gu, " ").trim(), "Here! Humbling.");
  assert.deepEqual(parseCharacterCommands("Look [video: no closing bracket and more words").commands, []);
  assert.deepEqual(
    parseCharacterCommands("Look [video: unclosed [selfie] after").commands.map((command) => command.type),
    ["selfie"],
  );
  assert.deepEqual(parseCharacterCommands("Now [video]").commands, [{ type: "video", context: undefined }]);
  // Brackets inside the description, as video prompts in a technical format use, keep the tag whole.
  const shots = parseCharacterCommands("Look! [video: description: [Shot 1] Ana waves. [Shot 2] She laughs.] Cute.");
  assert.deepEqual(shots.commands, [
    { type: "video", context: "description: [Shot 1] Ana waves. [Shot 2] She laughs." },
  ]);
  assert.equal(shots.cleanContent.replace(/\s+/gu, " ").trim(), "Look! Cute.", "the tag is hidden");
  // A tag that never closes makes no clip, and is hidden to the end of its line only.
  const unclosed = parseCharacterCommands("Look [video: no closing [Shot 1] bracket\nNext line stays.");
  assert.deepEqual(unclosed.commands, []);
  assert.equal(unclosed.cleanContent.replace(/\s+/gu, " ").trim(), "Look Next line stays.");
  // An unclosed tag can hold a later tag on the next line that does close; that one still makes its clip.
  assert.deepEqual(parseCharacterCommands("A [video: oops\n[video: waving] B").commands, [
    { type: "video", context: "waving" },
  ]);
  // Malformed lines before a balanced multiline tag leave it whole.
  const afterMalformed = parseCharacterCommands("[video:\n[video:\nLook [video: she waves\nand laughs.] Done.");
  assert.deepEqual(afterMalformed.commands, [{ type: "video", context: "she waves\nand laughs." }]);
  assert.equal(afterMalformed.cleanContent.replace(/\s+/gu, " ").trim(), "Look Done.");
  // Many unclosed tags parse in linear time: 8× the text must not take anywhere near 64× as long.
  const timeMalformed = (repeat: number) => {
    const text = "[video:\n".repeat(repeat);
    let best = Infinity;
    for (let run = 0; run < 3; run++) {
      const started = performance.now();
      assert.deepEqual(parseCharacterCommands(text).commands, []);
      best = Math.min(best, performance.now() - started);
    }
    return best;
  };
  const smallMalformed = Math.max(timeMalformed(4_096), 1);
  const largeMalformed = timeMalformed(32_768);
  assert.ok(
    largeMalformed < smallMalformed * 24,
    `malformed [video: tags scale linearly (${smallMalformed.toFixed(1)} ms → ${largeMalformed.toFixed(1)} ms)`,
  );

  const parsed = parseCharacterCommands('On my way! [video: context="waving from the bus"]');
  assert.deepEqual(parsed.commands, [{ type: "video", context: "waving from the bus" }]);
  assert.equal(parsed.cleanContent.trim(), "On my way!");
  assert.deepEqual(filterEnabledConversationCommands(parsed.commands, {}), []);
  assert.equal(
    filterEnabledConversationCommands(parsed.commands, { conversationCommandToggles: { video: true } }).length,
    1,
  );

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
    videoPromptInstructions: "Describe one slow camera move.",
  });
  await createAgentsStorage(db).create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: text.id,
    settings: { imageConnectionId: image.id, contextSize: 2, enabledTools: [] },
  });
  const aster = await createCharactersStorage(db).create(characterDataSchema.parse({ name: "Aster" }));
  assert.ok(aster);
  const preset = await createPromptsStorage(db).create({ name: "Fixture", parameters: {}, wrapFormat: "xml" });
  assert.ok(preset);
  await createPromptsStorage(db).createSection({
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
    return response.body;
  };

  // ── Roleplay Illustrator ──
  const roleplay = await chats.create({
    name: "Roleplay",
    mode: "roleplay",
    characterIds: [aster.id],
    connectionId: text.id,
    promptPresetId: preset.id,
  });
  assert.ok(roleplay);
  const roleplayMeta = {
    enableAgents: true,
    activeAgentIds: ["illustrator"],
    illustratorUseAvatarReferences: false,
    illustratorIncludeCharacterAppearance: false,
    illustratorRunInterval: 1,
    automaticSummaryEnabled: false,
    sceneVideoConnectionId: video.id,
  };

  // Pictures: the agent is not offered the fields, and its generateVideo is ignored.
  await saveChatSettings(roleplay.id, { ...roleplayMeta, illustratorVideoMode: "pictures" });
  mainReply = "Aster lifts a lantern.";
  await generate(roleplay.id, "Aster finds a lantern.");
  assert.doesNotMatch(agentRequests.at(-1) ?? "", /optional_video/u);
  assert.equal((await videoAttachments(roleplay.id)).length, 0);
  assert.equal(comfyPrompts.length, 0);

  // Pictures and clips: the fields and the video connection's instructions are offered, and the picture is animated.
  await saveChatSettings(roleplay.id, { ...roleplayMeta, illustratorVideoMode: "pictures_and_clips" });
  await generate(roleplay.id, "Aster walks into the rain.");
  assert.match(
    agentRequests.at(-1) ?? "",
    /<optional_video>[\s\S]*?generateVideo[\s\S]*?Describe one slow camera move\.\\n<\/optional_video>/u,
  );
  // The video connection's instructions decide what videoPrompt looks like.
  assert.match(agentRequests.at(-1) ?? "", /written exactly as the video-backend instructions below say/u);
  const roleplayVideos = await videoAttachments(roleplay.id);
  assert.equal(roleplayVideos.length, 1, JSON.stringify(roleplayVideos));
  const lastAssistant = (await chats.listMessages(roleplay.id))
    .filter((message) => message.role === "assistant")
    .at(-1);
  assert.equal(roleplayVideos[0]?.messageId, lastAssistant?.id, "the clip joins the message with its picture");
  const roleplayWorkflow = JSON.parse(comfyPrompts.at(-1) ?? "{}").prompt["1"].inputs;
  assert.equal(roleplayWorkflow.text, "The lantern light flickers as Aster turns");
  assert.equal(roleplayWorkflow.image, png.toString("base64"));
  const imagesOn = async (messageId: string | undefined) =>
    (await chats.listMessages(roleplay.id))
      .filter((message) => message.id === messageId)
      .flatMap((message) => {
        const extra = typeof message.extra === "string" ? JSON.parse(message.extra) : (message.extra ?? {});
        return ((extra as { attachments?: Array<{ type?: string }> }).attachments ?? []).filter(
          (attachment) => attachment.type === "image",
        );
      });
  assert.equal((await imagesOn(lastAssistant?.id)).length, 1, "the picture is shown with its clip");

  // Pictures and clips, a clip chosen without saying how it moves: no clip is paid for, and the picture stays.
  const clipsBeforeNoMotion = comfyPrompts.length;
  illustratorReply = { shouldGenerate: true, prompt: "1girl, lantern, rain", generateVideo: true };
  await generate(roleplay.id, "Aster shakes off the rain.");
  const noMotion = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
  assert.equal(comfyPrompts.length, clipsBeforeNoMotion, "no clip without a motion prompt");
  assert.equal((await imagesOn(noMotion?.id)).length, 1, "the picture is shown");

  // Clips only with no First frame chosen: no picture is drawn; the clip is written from the scene alone.
  // Clips only runs Illustrator on the Video Run Interval.
  await saveChatSettings(roleplay.id, {
    ...roleplayMeta,
    illustratorVideoMode: "clips_only",
    illustratorVideoRunInterval: 1,
  });
  illustratorReply = {
    shouldGenerate: true,
    prompt: "1girl, lantern, rain",
    videoPrompt: "The lantern swings as Aster opens the door",
  };
  await generate(roleplay.id, "Aster reaches the door.");
  const noPicture = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
  assert.equal((await videoAttachments(roleplay.id)).filter((item) => item.messageId === noPicture?.id).length, 1);
  assert.equal((await imagesOn(noPicture?.id)).length, 0);
  assert.notEqual(
    JSON.parse(comfyPrompts.at(-1) ?? "{}").prompt["1"].inputs.image,
    png.toString("base64"),
    "no picture is drawn for the clip",
  );

  // Clips only from a new picture: every picture becomes a clip without the agent asking, and only the clip is shown.
  await saveChatSettings(roleplay.id, {
    ...roleplayMeta,
    illustratorVideoMode: "clips_only",
    illustratorVideoRunInterval: 1,
    sceneVideoFirstFrame: "picture",
  });
  illustratorReply = { shouldGenerate: true, prompt: "1girl, lantern, rain" };
  await generate(roleplay.id, "Aster opens the door.");
  assert.match(agentRequests.at(-1) ?? "", /shows short video clips instead of pictures/u);
  const clipOnly = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
  assert.equal((await videoAttachments(roleplay.id)).filter((item) => item.messageId === clipOnly?.id).length, 1);
  assert.equal((await imagesOn(clipOnly?.id)).length, 0, "the picture is only the clip's first frame");
  // No motion was written, so the Gallery animation director writes the required clip from the picture, to the
  // video connection's instructions, instead of a generic line.
  assert.match(directorRequests.at(-1) ?? "", /<first_frame_generation_context>\\n1girl, lantern, rain/u);
  assert.match(directorRequests.at(-1) ?? "", /<video_prompting_instructions>[\s\S]*Describe one slow camera move\./u);
  // The director's own system prompt asks for JSON and one shot; with instructions it is told they win.
  assert.match(directorRequests.at(-1) ?? "", /The video prompting instructions in the request decide the output\./u);
  assert.equal(
    JSON.parse(comfyPrompts.at(-1) ?? "{}").prompt["1"].inputs.text,
    "Lantern light sways as the scene moves",
  );
  assert.equal(JSON.parse(comfyPrompts.at(-1) ?? "{}").prompt["1"].inputs.image, png.toString("base64"));

  // Clips only, clip fails: the picture is shown instead, and the Video Run Interval's starting point, taken
  // when the clip started, is given back.
  const runAnchor = async () => {
    const raw = (await chats.getById(roleplay.id))?.metadata;
    return ((typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>).lastAutomaticVideoMessageId;
  };
  const anchorBeforeFailure = await runAnchor();
  failVideo = true;
  await generate(roleplay.id, "Aster steps outside.");
  failVideo = false;
  assert.equal(await runAnchor(), anchorBeforeFailure, "a failed clip gives the interval back");
  const fellBack = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
  assert.equal((await videoAttachments(roleplay.id)).filter((item) => item.messageId === fellBack?.id).length, 0);
  assert.equal((await imagesOn(fellBack?.id)).length, 1, "a failed clip leaves its picture in the reply");

  // Clips only, clip saved but not attached (the reply's stored data breaks meanwhile): the clip still counts as
  // made, so there is no error and no stand-in picture.
  const { messageSwipes } = await import("../../packages/server/src/db/schema/index.js");
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  beforeVideo = async () => {
    const latest = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
    assert.ok(latest);
    // The interval already counts from this reply while its clip is still being made.
    assert.equal(await runAnchor(), latest.id, "the clip's reply is recorded as it starts");
    await db.update(messageSwipes).set({ extra: "{not json" }).where(eq(messageSwipes.messageId, latest.id));
  };
  const unattachedStream = await generate(roleplay.id, "Aster looks back.");
  assert.equal(beforeVideo, null, "the clip reached the video service");
  assert.match(unattachedStream, /"type":"video"/u, "the saved clip is reported as made");
  assert.doesNotMatch(unattachedStream, /video_error/u);
  assert.doesNotMatch(unattachedStream, /"type":"illustration"/u, "no stand-in picture");

  // The reply deleted while its clip is made: the clip still counts, and is reported with no message.
  beforeVideo = async () => {
    const latest = (await chats.listMessages(roleplay.id)).filter((message) => message.role === "assistant").at(-1);
    assert.ok(latest);
    await chats.removeMessage(latest.id);
  };
  const deletedStream = await generate(roleplay.id, "Aster turns away.");
  assert.equal(beforeVideo, null, "the clip reached the video service");
  assert.match(deletedStream, /"type":"video","data":\{"messageId":null/u, "no message to show the clip on");
  assert.doesNotMatch(deletedStream, /video_error/u);

  // Clips only with no picture: a clip that names the persona is tagged with them, so it shows in their gallery.
  const jamie = await createCharactersStorage(db).createPersona("Jamie", "The player.");
  assert.ok(jamie);
  const withPersona = await chats.create({
    name: "Roleplay with persona",
    mode: "roleplay",
    characterIds: [aster.id],
    personaId: jamie.id,
    connectionId: text.id,
    promptPresetId: preset.id,
  });
  assert.ok(withPersona);
  await saveChatSettings(withPersona.id, {
    ...roleplayMeta,
    illustratorVideoMode: "clips_only",
    sceneVideoFirstFrame: "prompt_only",
  });
  illustratorReply = { shouldGenerate: true, prompt: "Aster hands Jamie a lantern", characters: ["Aster", "Jamie"] };
  await generate(withPersona.id, "Aster finds Jamie in the rain.");
  const [personaClip] = await createGameSceneVideosStorage(db).listByChatId(withPersona.id);
  assert.ok(personaClip, "the clip is saved");
  assert.deepEqual(JSON.parse(String(personaClip.characterIds)).sort(), [aster.id, jamie.id].sort());
  // Pictures and clips, starting from no picture: the clip that follows the picture is tagged with the persona too.
  await saveChatSettings(withPersona.id, {
    ...roleplayMeta,
    illustratorVideoMode: "pictures_and_clips",
    illustratorVideoRunInterval: 1,
    sceneVideoFirstFrame: "prompt_only",
  });
  illustratorReply = {
    shouldGenerate: true,
    prompt: "Aster hands Jamie a lantern",
    characters: ["Aster", "Jamie"],
    generateVideo: true,
    videoPrompt: "The lantern swings between them",
  };
  await generate(withPersona.id, "Jamie takes the lantern.");
  const afterPicture = await createGameSceneVideosStorage(db).listByChatId(withPersona.id);
  assert.equal(afterPicture.length, 2, "a second clip is saved");
  const pictureClip = afterPicture.find((video) => video.id !== personaClip.id);
  assert.deepEqual(JSON.parse(String(pictureClip?.characterIds)).sort(), [aster.id, jamie.id].sort());

  // ── Conversation [video] ──
  const convo = await chats.create({
    name: "Convo",
    mode: "conversation",
    characterIds: [aster.id],
    connectionId: text.id,
  });
  assert.ok(convo);
  const convoMeta = {
    characterCommands: true,
    sceneVideoConnectionId: video.id,
    sceneVideoFirstFrame: "prompt_only",
    automaticSummaryEnabled: false,
  };
  mainReply = 'Look! [video: context="waving from the bus"]';

  await saveChatSettings(convo.id, { ...convoMeta, conversationCommandToggles: {} });
  await generate(convo.id, "Send me a video?");
  assert.equal((await videoAttachments(convo.id)).length, 0, "Generated Videos off: no clip");

  // Without a working video connection [video] isn't offered: every clip would only fail.
  const offersVideo = (text: string) =>
    /you send a short video message/u.test(textRequests.findLast((request) => request.includes(text)) ?? "");
  mainReply = "Not right now.";
  await saveChatSettings(convo.id, {
    ...convoMeta,
    sceneVideoConnectionId: text.id,
    conversationCommandToggles: { video: true },
  });
  await generate(convo.id, "Can you send videos?");
  assert.equal(offersVideo("Can you send videos?"), false, "no video connection: [video] isn't offered");
  mainReply = 'Look! [video: context="waving from the bus"]';

  await saveChatSettings(convo.id, { ...convoMeta, conversationCommandToggles: { video: true } });
  const body = await generate(convo.id, "Send me a video!");
  assert.equal(offersVideo("Send me a video!"), true, "with one, it is");
  const convoVideos = await videoAttachments(convo.id);
  assert.equal(convoVideos.length, 1, body);
  assert.equal((convoVideos[0]?.attachment as { characterName?: string }).characterName, "Aster");
  const sender = await chats.getMessage(convoVideos[0]!.messageId);
  assert.equal(sender?.characterId, aster.id);
  assert.doesNotMatch(String(sender?.content), /\[video/u, "the command tag is hidden");
  assert.match(body, /"type":"video"/u);
  assert.match(videoWriterRequests.at(-1) ?? "", /Context for the video message: waving from the bus/u);
  // Its instructions govern the format of every Conversation clip too.
  assert.match(videoWriterRequests.at(-1) ?? "", /These video-backend instructions govern the final video prompt/u);
  assert.match(
    videoWriterRequests.at(-1) ?? "",
    /The video prompting instructions in the request decide the output\./u,
  );

  // A bare [video] gives the writer the recent conversation, as /video does: the user's request and the reply.
  mainReply = "Here are the pinkish haloarchaea under my microscope! [video]";
  await chats.patchMetadata(convo.id, { illustratorVideoRunInterval: 1 });
  await generate(convo.id, "Show me the microscope dancing!");
  assert.equal((await videoAttachments(convo.id)).length, 2);
  assert.match(
    videoWriterRequests.at(-1) ?? "",
    /Recent conversation:[\s\S]*Show me the microscope dancing![\s\S]*pinkish haloarchaea/u,
    "the user's request and the reply both reach the writer",
  );
  assert.doesNotMatch(videoWriterRequests.at(-1) ?? "", /Context for the video message/u);
  // ── Attach Card Appearance for videos ──
  // Instructions that speak to appearance: the writer gets everyone's appearance details to build in, and nothing is
  // pasted after the prompt. Instructions that don't: the named people's lines are pasted after it, as before.
  const mira = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Mira", extensions: { appearance: "silver braid, green coat" } }),
  );
  const rae = await createCharactersStorage(db).createPersona("Rae", "The player.", undefined, {
    appearance: "short red hair, denim jacket",
  });
  assert.ok(mira && rae);
  const looks = await chats.create({
    name: "Looks",
    mode: "conversation",
    characterIds: [mira.id],
    personaId: rae.id,
    connectionId: text.id,
  });
  assert.ok(looks);
  await saveChatSettings(looks.id, {
    ...convoMeta,
    conversationCommandToggles: { video: true },
    selfieVideoIncludeCharacterAppearance: true,
    illustratorVideoRunInterval: 1,
  });
  const setInstructions = async (videoPromptInstructions: string) => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/connections/${video.id}`,
      payload: { videoPromptInstructions },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  const comfyText = () => String(JSON.parse(comfyPrompts.at(-1) ?? "{}").prompt["1"].inputs.text);
  await setInstructions("Describe every person from their appearance fields.");
  mainReply = 'Here! [video: context="waving at Mira"]';
  await generate(looks.id, "Send me a video, Mira!");
  assert.match(
    videoWriterRequests.at(-1) ?? "",
    /<character_appearance>[\s\S]*Mira's Appearance: silver braid, green coat/u,
  );
  assert.match(videoWriterRequests.at(-1) ?? "", /Rae's Appearance: short red hair, denim jacket/u, "the persona too");
  assert.doesNotMatch(comfyText(), /Appearance:/u, "built in by the writer, not pasted after the prompt");
  await setInstructions("Describe one slow camera move.");
  await generate(looks.id, "Another one, Mira!");
  assert.doesNotMatch(videoWriterRequests.at(-1) ?? "", /<character_appearance>/u);
  assert.match(comfyText(), /Mira's Appearance: silver braid, green coat/u, "pasted after the prompt, as before");

  // Playing as a character who is not one of the chat's characters: a clip that names them describes them too.
  const kit = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Kit", extensions: { appearance: "shaved head, orange scarf" } }),
  );
  assert.ok(kit);
  const switched = await app.inject({
    method: "PATCH",
    url: `/api/chats/${looks.id}`,
    payload: { personaId: null, personaCharacterId: kit.id },
  });
  assert.equal(switched.statusCode, 200, switched.body);
  mainReply = 'Here! [video: context="waving at Kit"]';
  await generate(looks.id, "Send me a video of us, Mira!");
  assert.match(comfyText(), /Kit's Appearance: shaved head, orange scarf/u, "the character played as the user");
  assert.doesNotMatch(comfyText(), /Rae's Appearance/u, "not the persona the chat no longer uses");

  // ── Long descriptions ──
  // A description of any length is read as a command; past the limit, the Prompt Model shortens it before the
  // writer sees it, and when it can't, the description is cut at the limit and the clip is still made.
  const longContext =
    `Aster waves from the bus stop. ${"The rain keeps drumming on the shelter roof. ".repeat(60)}`.trim();
  assert.ok(longContext.length > VIDEO_CONTEXT_MAX_CHARS);
  assert.deepEqual(parseCharacterCommands(`Here! [video: ${longContext}]`).commands, [
    { type: "video", context: longContext },
  ]);
  mainReply = `Here! [video: ${longContext}]`;
  shortenReply = "Aster waves from the bus stop while rain drums on the shelter roof.";
  let clips = (await videoAttachments(convo.id)).length;
  await generate(convo.id, "One more video!");
  assert.equal((await videoAttachments(convo.id)).length, clips + 1, "the long description makes a clip");
  assert.equal(shortenRequests.length, 1, "the Prompt Model is asked once to shorten it");
  assert.match(videoWriterRequests.at(-1) ?? "", /Context for the video message: Aster waves from the bus stop while/u);
  assert.doesNotMatch(videoWriterRequests.at(-1) ?? "", /The rain keeps drumming/u);
  shortenReply = "";
  clips = (await videoAttachments(convo.id)).length;
  await generate(convo.id, "And another!");
  assert.equal((await videoAttachments(convo.id)).length, clips + 1, "a failed shortening still makes a clip");
  const cut = /Context for the video message: (Aster waves from the bus stop\. The rain[^"\\]*)/u.exec(
    videoWriterRequests.at(-1) ?? "",
  );
  assert.ok(cut && cut[1]!.length <= VIDEO_CONTEXT_MAX_CHARS, "cut at the limit");

  // ── Group replies ──
  // Every character in a group turn may send a clip, one each, up to Videos per reply (3 by default).
  const extras = await Promise.all(
    ["Bo", "Cy"].map((name) => createCharactersStorage(db).create(characterDataSchema.parse({ name }))),
  );
  const group = await chats.create({
    name: "Group",
    mode: "conversation",
    characterIds: [aster.id, mira.id, ...extras.map((character) => character!.id)],
    connectionId: text.id,
  });
  assert.ok(group);
  await saveChatSettings(group.id, {
    ...convoMeta,
    conversationCommandToggles: { video: true },
    illustratorVideoRunInterval: 1,
    groupChatMode: "individual",
    groupResponseOrder: "sequential",
  });
  mainReply = 'Watch! [video: context="first take"] and [video: context="second take"]';
  await generate(group.id, "Everyone, send me a video!");
  const groupClips = await videoAttachments(group.id);
  assert.equal(groupClips.length, 3, "three clips at most per reply");
  assert.equal(
    new Set(groupClips.map(({ attachment }) => (attachment as { characterName?: string }).characterName)).size,
    3,
    "one clip per character",
  );
  // Videos per reply, saved through Settings' own route, sets the limit.
  const savedLimit = await app.inject({
    method: "PUT",
    url: "/api/app-settings/video-generation",
    payload: { value: JSON.stringify({ maxCharacterVideosPerReply: 2 }) },
  });
  assert.equal(savedLimit.statusCode, 200, savedLimit.body);
  await generate(group.id, "Everyone, one more video!");
  assert.equal((await videoAttachments(group.id)).length, 3 + 2, "two clips with Videos per reply set to 2");

  console.log("agent-generated-videos regression passed");
} finally {
  await appHandle?.close();
  const fakeProvider = providerHandle;
  if (fakeProvider?.listening) await new Promise<void>((resolve) => fakeProvider.close(() => resolve()));
  await closeDatabase?.();
  rmSync(fixtureDir, { recursive: true, force: true });
}
