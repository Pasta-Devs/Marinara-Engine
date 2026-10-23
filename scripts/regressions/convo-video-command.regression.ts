// Conversation video messages: through the real gallery route, with a fake text model, image service and
// ComfyUI, each first-frame setting starts the clip from the right picture (a new selfie, the avatar, or
// none), the writer gets the video connection's instructions, a new clip arrives as a message from the
// character, animating a gallery picture joins the newest reply, and later replies see a note.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-convo-video-command-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { chatsRoutes } = await import("../../packages/server/src/routes/chats.routes.js");
const { agentsRoutes } = await import("../../packages/server/src/routes/agents.routes.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createCharactersStorage } = await import("../../packages/server/src/services/storage/characters.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { formatRecentVideoContext } = await import("../../packages/server/src/services/video/prompt-context.js");
const { formatSentVideoNotes } =
  await import("../../packages/server/src/routes/generate/conversation-prompt-formatting.js");
const { characterDataSchema, LOCAL_SIDECAR_CONNECTION_ID } = await import("../../packages/shared/dist/index.js");
const sharp = requireServer("sharp") as typeof import("sharp").default;

// Two distinct PNGs, so the clip's first frame can be traced back to the avatar or the selfie.
const avatarPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const selfiePng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
const INSTRUCTIONS = "Keep every clip to one continuous handheld take.";
const VIDEO_PROMPT = "Aster waves at the camera and laughs";
// How the fake writer answers: plainly, with its reasoning inline, or out of budget before any answer.
let writerMode: "plain" | "inline-thinking" | "out-of-budget" = "plain";

const writerRequests: string[] = [];
const selfieWriterRequests: string[] = [];
const writerMaxTokens: number[] = [];
const comfyPrompts: string[] = [];
// What the image service returns for a selfie (Venice always returns WebP), and what it was asked to draw.
let selfieImage: Buffer | null = null;
const imageRequests: string[] = [];
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString();
  const url = request.url ?? "";
  const json = (value: unknown) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(value));
  };
  if (url.endsWith("/prompt")) {
    comfyPrompts.push(body);
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
    response.end(mp4);
    return;
  }
  if (url.endsWith("/images/generations")) {
    imageRequests.push(body);
    return json({ data: [{ b64_json: (selfieImage ?? selfiePng).toString("base64") }] });
  }
  const messages = JSON.stringify(JSON.parse(body).messages);
  const isVideoWriter = messages.includes("video prompt writer");
  if (isVideoWriter) writerRequests.push(messages);
  else selfieWriterRequests.push(messages);
  writerMaxTokens.push(isVideoWriter ? Number(JSON.parse(body).max_tokens) : 0);
  const writerContent =
    writerMode === "inline-thinking"
      ? `<think>Plan the clip first.</think>${VIDEO_PROMPT}`
      : writerMode === "out-of-budget"
        ? ""
        : VIDEO_PROMPT;
  json({
    choices: [
      {
        message: {
          role: "assistant",
          content: isVideoWriter ? writerContent : "Aster, selfie, smiling",
          ...(isVideoWriter && writerMode === "out-of-budget" ? { reasoning_content: "Thinking..." } : {}),
        },
        finish_reason: isVideoWriter && writerMode === "out-of-budget" ? "length" : "stop",
      },
    ],
    usage: { total_tokens: 20 },
  });
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });
await app.register(chatsRoutes, { prefix: "/api/chats" });
await app.register(agentsRoutes, { prefix: "/api/agents" });

try {
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
    videoPromptInstructions: INSTRUCTIONS,
  });

  mkdirSync(join(fixtureDir, "avatars"), { recursive: true });
  writeFileSync(join(fixtureDir, "avatars", "aster.png"), avatarPng);
  const aster = await createCharactersStorage(db).create(
    characterDataSchema.parse({ name: "Aster", description: "silver hair" }),
    "/api/avatars/file/aster.png",
  );
  assert.ok(aster);

  const chats = createChatsStorage(db);
  const gallery = createGalleryStorage(db);
  const convo = await chats.create({
    name: "Convo",
    mode: "conversation",
    characterIds: [aster.id],
    connectionId: text.id,
  });
  assert.ok(convo);

  const send = async (payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: `/api/gallery/${convo.id}/video`,
      payload: { characterId: aster.id, ...payload },
    });
  const lastComfyImage = () => {
    const workflow = JSON.parse(comfyPrompts.at(-1) ?? "{}") as {
      prompt?: Record<string, { inputs: { image: string; text: string } }>;
    };
    return workflow.prompt?.["1"]?.inputs;
  };
  // Saved through Chat Settings' own route, so a route that dropped the setting would fail here.
  const setFirstFrame = async (mode: string, imageGen: string | null) => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/chats/${convo.id}/metadata`,
      payload: { sceneVideoConnectionId: video.id, sceneVideoFirstFrame: mode, imageGenConnectionId: imageGen },
    });
    assert.equal(response.statusCode, 200, response.body);
    const raw = (await chats.getById(convo.id))?.metadata;
    const saved = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    assert.equal(saved.sceneVideoFirstFrame, mode);
    assert.equal(saved.sceneVideoConnectionId, video.id);
  };

  // Preview writes the prompt with the connection's instructions and calls no video service.
  await setFirstFrame("prompt_only", null);
  const preview = await send({ previewOnly: true });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.equal((preview.json() as { prompt: string }).prompt, VIDEO_PROMPT);
  assert.match(writerRequests.at(-1) ?? "", /<video_prompting_instructions>[^<]*one continuous handheld take/u);
  assert.equal(comfyPrompts.length, 0);

  // A clip the user asks for reads the recent conversation, as Illustrator does for a picture (its Agent Budget).
  await chats.createMessage({ chatId: convo.id, role: "user", characterId: null, content: "We're at the aquarium!" });
  await chats.createMessage({
    chatId: convo.id,
    role: "assistant",
    characterId: aster.id,
    content: "The secret staff room is behind this door.",
    extra: { hiddenFromAI: true },
  });
  await chats.createMessage({
    chatId: convo.id,
    role: "assistant",
    characterId: aster.id,
    content: "Look at the jellyfish glowing!",
  });
  assert.equal((await send({ previewOnly: true })).statusCode, 200);
  assert.match(
    writerRequests.at(-1) ?? "",
    /Recent conversation:[\s\S]*aquarium[\s\S]*Aster:\\nLook at the jellyfish/u,
  );
  assert.doesNotMatch(writerRequests.at(-1) ?? "", /secret staff room/u, "messages hidden from the AI stay out");
  const { createAgentsStorage } = await import("../../packages/server/src/services/storage/agents.storage.js");
  await createAgentsStorage(db).create({
    type: "illustrator",
    name: "Illustrator",
    phase: "post_processing",
    connectionId: text.id,
    settings: {},
  });
  const narrowed = await app.inject({
    method: "PATCH",
    url: "/api/agents/type/illustrator",
    payload: { settings: { contextSize: 1 } },
  });
  assert.equal(narrowed.statusCode, 200, narrowed.body);
  assert.equal((await send({ previewOnly: true })).statusCode, 200);
  assert.match(writerRequests.at(-1) ?? "", /jellyfish/u);
  assert.doesNotMatch(writerRequests.at(-1) ?? "", /aquarium/u, "Illustrator's context size limits how far back");

  // Prompt only: no picture reaches the video model, and the clip arrives as a message from Aster.
  const promptOnly = await send({});
  assert.equal(promptOnly.statusCode, 200, promptOnly.body);
  const promptOnlyBody = promptOnly.json() as { messageId: string; firstFrame: string; video: { id: string } };
  assert.equal(promptOnlyBody.firstFrame, "none");
  assert.equal(lastComfyImage()?.image, "%reference_image%");
  assert.equal(lastComfyImage()?.text, VIDEO_PROMPT);
  const message = await chats.getMessage(promptOnlyBody.messageId);
  assert.equal(message?.role, "assistant");
  assert.equal(message?.characterId, aster.id);
  const attachment = (JSON.parse(String(message?.extra)) as { attachments: Array<Record<string, unknown>> })
    .attachments[0];
  assert.equal(attachment?.type, "video");
  assert.equal(attachment?.characterName, "Aster");
  assert.equal(attachment?.videoId, promptOnlyBody.video.id);

  // Avatar: the avatar is the first frame.
  await setFirstFrame("avatar", null);
  const avatar = await send({});
  assert.equal(avatar.statusCode, 200, avatar.body);
  assert.equal((avatar.json() as { firstFrame: string }).firstFrame, "avatar");
  assert.equal(lastComfyImage()?.image, avatarPng.toString("base64"));

  // Selfie with avatar fallback and no selfie connection falls back to the avatar.
  await setFirstFrame("picture_or_avatar", null);
  const fallback = await send({});
  assert.equal((fallback.json() as { firstFrame: string }).firstFrame, "avatar");

  // Selfie: a new selfie is made, saved to the gallery, and becomes the first frame.
  await setFirstFrame("picture", image.id);
  const galleryBefore = (await gallery.listByChatId(convo.id)).length;
  const selfie = await send({ context: "at the beach" });
  assert.equal(selfie.statusCode, 200, selfie.body);
  assert.equal((selfie.json() as { firstFrame: string }).firstFrame, "selfie");
  assert.equal((await gallery.listByChatId(convo.id)).length, galleryBefore + 1);
  assert.equal(lastComfyImage()?.image, selfiePng.toString("base64"));
  assert.match(writerRequests.at(-1) ?? "", /Context for the video message: at the beach/u);
  assert.doesNotMatch(writerRequests.at(-1) ?? "", /Recent conversation/u, "a clip with its own context needs none");
  assert.match(selfieWriterRequests.at(-1) ?? "", /Context for the selfie: at the beach/u);

  // Without its own context, the selfie shows the same recent moment as the clip, also when the video prompt was
  // reviewed and sent back as an override.
  assert.equal((await send({})).statusCode, 200);
  assert.match(
    selfieWriterRequests.at(-1) ?? "",
    /Context for the selfie: The latest moment of this conversation:[\s\S]*jellyfish/u,
    "the selfie reads the recent conversation",
  );
  // The video messages sent above have no text, so they don't use up Illustrator's context size of 1.
  assert.match(writerRequests.at(-1) ?? "", /Recent conversation:[\s\S]*jellyfish/u, "empty messages are skipped");
  assert.equal((await send({ promptOverride: "Aster waves at the jellyfish tank" })).statusCode, 200);
  assert.match(selfieWriterRequests.at(-1) ?? "", /The latest moment of this conversation:[\s\S]*jellyfish/u);

  // Selfie mode without a selfie connection fails instead of silently using something else.
  await setFirstFrame("picture", null);
  const noSelfie = await send({});
  assert.equal(noSelfie.statusCode, 400, "a missing Selfie Connection is a setting to fix");
  assert.match(noSelfie.body, /choose a Selfie Connection/u);
  // The settings check runs before any paid call, in a preview too: no prompt was written.
  const writersBefore = writerRequests.length;
  assert.equal((await send({ previewOnly: true })).statusCode, 400);
  assert.equal(writerRequests.length, writersBefore, "no prompt is written for a request that can't work");

  // With Generated Selfies off, the default first frame uses the avatar, even with a Selfie Connection still set.
  const setToggles = async (toggles: Record<string, boolean>) => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/chats/${convo.id}/metadata`,
      payload: { conversationCommandToggles: toggles },
    });
    assert.equal(response.statusCode, 200, response.body);
  };
  await setFirstFrame("picture_or_avatar", image.id);
  await setToggles({ selfie: false });
  const imagesBefore = imageRequests.length;
  const selfiesOff = await send({});
  assert.equal((selfiesOff.json() as { firstFrame: string }).firstFrame, "avatar");
  assert.equal(imageRequests.length, imagesBefore, "no selfie is paid for while selfies are off");
  await setToggles({ selfie: true });

  // A WebP selfie is converted to PNG and used, not thrown away for the avatar.
  selfieImage = await sharp(selfiePng).webp().toBuffer();
  const webpClip = await send({});
  assert.equal(webpClip.statusCode, 200, webpClip.body);
  assert.equal((webpClip.json() as { firstFrame: string }).firstFrame, "selfie");
  const firstFrameBytes = Buffer.from(lastComfyImage()?.image ?? "", "base64");
  assert.equal(firstFrameBytes.subarray(1, 4).toString("ascii"), "PNG", "the WebP selfie reaches the video as PNG");
  assert.notEqual(lastComfyImage()?.image, avatarPng.toString("base64"));
  selfieImage = null;

  // The selfie is reviewed with the clip: the preview returns its prompt without drawing, and a reviewed selfie
  // prompt is drawn as the user left it.
  await setFirstFrame("picture", image.id);
  const imagesBeforeReview = imageRequests.length;
  const reviewed = await send({ previewOnly: true });
  assert.equal(reviewed.statusCode, 200, reviewed.body);
  assert.match((reviewed.json() as { selfie?: { prompt: string } }).selfie?.prompt ?? "", /Aster, selfie, smiling/u);
  assert.equal(imageRequests.length, imagesBeforeReview, "a preview draws nothing");
  const reviewedSend = await send({ promptOverride: VIDEO_PROMPT, selfiePromptOverride: "REVIEWED_SELFIE_PROMPT" });
  assert.equal(reviewedSend.statusCode, 200, reviewedSend.body);
  assert.match(imageRequests.at(-1) ?? "", /REVIEWED_SELFIE_PROMPT/u);

  // Animating a gallery picture joins the newest reply, even when an earlier one shows it; no new message is made.
  mkdirSync(join(fixtureDir, "gallery", convo.id), { recursive: true });
  writeFileSync(join(fixtureDir, "gallery", convo.id, "pic.png"), avatarPng);
  const picture = await gallery.create({
    chatId: convo.id,
    filePath: `${convo.id}/pic.png`,
    prompt: "Aster beside a koi pond at sunset",
  });
  assert.ok(picture);
  const holder = await chats.createMessage({
    chatId: convo.id,
    role: "assistant",
    characterId: aster.id,
    content: "Look!",
    extra: { attachments: [{ type: "image", url: "/x", galleryId: picture.id }] },
  });
  assert.ok(holder);
  const newest = await chats.createMessage({
    chatId: convo.id,
    role: "assistant",
    characterId: aster.id,
    content: "Anyway, how was your day?",
  });
  assert.ok(newest);
  const messageCount = (await chats.listMessages(convo.id)).length;
  const animate = await send({ galleryImageId: picture.id });
  assert.equal(animate.statusCode, 200, animate.body);
  assert.equal((animate.json() as { messageId: string }).messageId, newest.id);
  assert.equal((await chats.listMessages(convo.id)).length, messageCount);
  // The writer continues the picture itself, and the clip under someone's reply credits no sender.
  assert.match(writerRequests.at(-1) ?? "", /The clip starts from this picture:[\s\S]*koi pond at sunset/u);
  const newestExtra = JSON.parse(String((await chats.getMessage(newest.id))?.extra)) as {
    attachments: Array<Record<string, unknown>>;
  };
  assert.equal(newestExtra.attachments.at(-1)?.type, "video");
  assert.equal(newestExtra.attachments.at(-1)?.characterName, undefined, "no sent-video note for an animation");

  // A reasoning model gets room to think: the writer asks for the same budget as the selfie writer.
  assert.equal(Math.max(...writerMaxTokens), 8192);
  // Inline reasoning is not part of the prompt.
  await setFirstFrame("prompt_only", null);
  writerMode = "inline-thinking";
  const inline = await send({ previewOnly: true });
  assert.equal(inline.statusCode, 200, inline.body);
  assert.equal((inline.json() as { prompt: string }).prompt, VIDEO_PROMPT);
  // A writer that spends its whole budget thinking gets a clear error, and no video request is made.
  writerMode = "out-of-budget";
  const comfyBefore = comfyPrompts.length;
  const exhausted = await send({});
  assert.equal(exhausted.statusCode, 502, exhausted.body);
  assert.match((exhausted.json() as { error: string }).error, /whole response budget/u);
  assert.equal(comfyPrompts.length, comfyBefore);
  writerMode = "plain";

  // Only Conversation chats send video messages.
  const roleplay = await chats.create({
    name: "RP",
    mode: "roleplay",
    characterIds: [aster.id],
    connectionId: text.id,
  });
  assert.ok(roleplay);
  const rejected = await app.inject({
    method: "POST",
    url: `/api/gallery/${roleplay.id}/video`,
    payload: { characterId: aster.id },
  });
  assert.equal(rejected.statusCode, 400);

  // The built-in local model reaches the Prompt Model with its id, as /selfie does, instead of "no text connection".
  const local = await chats.create({
    name: "Local",
    mode: "conversation",
    characterIds: [aster.id],
    connectionId: LOCAL_SIDECAR_CONNECTION_ID,
  });
  assert.ok(local);
  await app.inject({
    method: "PATCH",
    url: `/api/chats/${local.id}/metadata`,
    payload: { sceneVideoConnectionId: video.id, sceneVideoFirstFrame: "prompt_only" },
  });
  const localVideo = await app.inject({
    method: "POST",
    url: `/api/gallery/${local.id}/video`,
    payload: { characterId: aster.id, previewOnly: true },
  });
  assert.doesNotMatch(localVideo.body, /No text connection is configured/u);

  // Recent context starts at the latest conversation start and leaves out what is hidden from this character.
  const recentText = formatRecentVideoContext(
    [
      { id: "1", role: "user", content: "BEFORE_START" },
      { id: "2", role: "user", content: "After the start", extra: { isConversationStart: true } },
      { id: "3", role: "assistant", content: "HIDDEN_FROM_ASTER", extra: { hiddenFromAICharacterIds: ["aster"] } },
      { id: "4", role: "assistant", content: "Seen by everyone" },
    ],
    { count: 10, characterId: "aster" },
  );
  assert.match(recentText, /After the start[\s\S]*Seen by everyone/u);
  assert.doesNotMatch(recentText, /BEFORE_START|HIDDEN_FROM_ASTER/u);

  // Later replies see who sent a video and what it shows; Roleplay clips (no sender) stay hidden.
  assert.equal(
    formatSentVideoNotes([{ type: "video", characterName: "Aster", prompt: VIDEO_PROMPT }]),
    `\n[Aster sent a video message: ${VIDEO_PROMPT}]`,
  );
  assert.equal(formatSentVideoNotes([{ type: "video", prompt: "scene" }]), "");

  // Attaching reports whether the clip landed: a message deleted meanwhile gets nothing and reports false.
  const { attachVideoToMessage, buildChatVideoAttachment } =
    await import("../../packages/server/src/services/video/chat-video-messages.js");
  const attachChat = await chats.create({ name: "Attach", mode: "conversation", characterIds: [], connectionId: null });
  assert.ok(attachChat);
  const live = await chats.createMessage({
    chatId: attachChat.id,
    role: "assistant",
    characterId: null,
    content: "hi",
  });
  const gone = await chats.createMessage({
    chatId: attachChat.id,
    role: "assistant",
    characterId: null,
    content: "bye",
  });
  assert.ok(live && gone);
  await chats.removeMessage(gone.id);
  const clip = buildChatVideoAttachment({
    id: "clip",
    url: "/api/gallery/scene-videos/file/x/clip.mp4",
    filePath: "x/clip.mp4",
    prompt: "",
    durationSeconds: 5,
    aspectRatio: "16:9",
  } as never);
  assert.equal(await attachVideoToMessage(chats, { messageId: gone.id, swipeIndex: 0 }, clip), false);
  assert.equal(await attachVideoToMessage(chats, { messageId: live.id, swipeIndex: 0 }, clip), true);
  const liveExtra = (await chats.getMessage(live.id))?.extra;
  assert.match(typeof liveExtra === "string" ? liveExtra : JSON.stringify(liveExtra), /"videoId":"clip"/u);

  // /video with a partial name several characters share picks no one; an exact or unique name still works.
  const { matchSlashCommand } = await import("../../packages/client/src/lib/slash-commands.js");
  const slashVideo = matchSlashCommand("/video", {
    mode: "conversation",
    availableCapabilityIds: new Set(["illustrator"]),
  })?.command;
  assert.ok(slashVideo, "/video is registered in Conversation with Illustrator installed");
  const videoTargets: Array<string | undefined> = [];
  const slashContext = {
    chatId: "slash-chat",
    mode: "conversation",
    characters: [
      { id: "alice", name: "Alice Smith" },
      { id: "bob", name: "Bob Smith" },
    ],
    video: (characterId?: string) => {
      videoTargets.push(characterId);
    },
  };
  const ambiguous = await slashVideo.execute("Smith", slashContext as never);
  assert.equal(ambiguous.feedback, "ui.chat.slash.video.ambiguousCharacter", "asks for the full name");
  assert.deepEqual(videoTargets, [], "an ambiguous name makes no clip");
  await slashVideo.execute("Bob", slashContext as never);
  await slashVideo.execute("alice smith", slashContext as never);
  assert.deepEqual(videoTargets, ["bob", "alice"], "a unique partial or exact name still picks its character");
  // Two characters with the very same name: an exact match is ambiguous too.
  const twins = await slashVideo.execute("Aster", {
    ...slashContext,
    characters: [
      { id: "aster-1", name: "Aster" },
      { id: "aster-2", name: "Aster" },
    ],
  } as never);
  assert.equal(twins.feedback, "ui.chat.slash.video.ambiguousCharacter", "two identical names pick no one");
  assert.deepEqual(videoTargets, ["bob", "alice"], "and make no clip");
  console.log("convo-video-command regression passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
