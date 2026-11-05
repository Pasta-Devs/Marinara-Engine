// Generated scene videos play inline: through the real gallery route, with a fake text model and a fake
// ComfyUI, the finished video is attached to the newest reply the user can see (whichever reply its picture
// came from, and never in Game Mode), a video attachment never reaches a model prompt as an image or a
// readable file, and attaching one does not change Advanced Memory's history fingerprint.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureDir = mkdtempSync(join(tmpdir(), "marinara-inline-chat-videos-"));
process.env.DATA_DIR = fixtureDir;
process.env.FILE_STORAGE_DIR = join(fixtureDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.SEEDANCE_VIDEO_POLL_INTERVAL_MS = "1";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { galleryRoutes } = await import("../../packages/server/src/routes/gallery.routes.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
const { toVideoReferenceImage } = await import("../../packages/server/src/services/video/chat-video-generation.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGalleryStorage } = await import("../../packages/server/src/services/storage/gallery.storage.js");
const { resolveChatVideoAnchor } = await import("../../packages/server/src/services/video/chat-video-messages.js");
const { advancedMemorySourceFingerprint } = await import("../../packages/server/src/services/advanced-memory.js");
const { extractImageAttachmentDataUrls, extractFileAttachmentInputs, buildReadableAttachmentBlocks } =
  await import("../../packages/server/src/services/generation/prompt-attachments.js");

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(12)]);

// One local server plays both the text model (director) and ComfyUI.
const comfyPrompts: string[] = [];
// Runs when a video job starts, to change the chat while the clip is being made.
let duringGeneration: (() => Promise<void>) | null = null;
const provider = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const url = request.url ?? "";
  if (url.endsWith("/prompt")) {
    comfyPrompts.push(Buffer.concat(chunks).toString());
    await duringGeneration?.();
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ prompt_id: "job-1" }));
    return;
  }
  if (url.includes("/history/")) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        "job-1": {
          status: { completed: true, status_str: "success" },
          outputs: { "9": { gifs: [{ filename: "clip.mp4", subfolder: "", type: "output" }] } },
        },
      }),
    );
    return;
  }
  if (url.startsWith("/view")) {
    response.setHeader("content-type", "video/mp4");
    response.end(mp4);
    return;
  }
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({
      choices: [
        {
          message: { role: "assistant", content: JSON.stringify({ narrationBeat: "Aster lifts the lantern" }) },
          finish_reason: "stop",
        },
      ],
      usage: { total_tokens: 20 },
    }),
  );
});

const db = await getDB();
const app = Fastify();
app.decorate("db", db);
await app.register(galleryRoutes, { prefix: "/api/gallery" });
await app.register(gameRoutes, { prefix: "/api/game" });

try {
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const connections = createConnectionsStorage(db);
  const text = await connections.create({
    name: "Text fixture",
    provider: "custom",
    baseUrl: `${baseUrl}/v1`,
    model: "fixture",
    apiKey: "fixture",
  });
  const video = await connections.create({
    name: "ComfyUI video fixture",
    provider: "video_generation",
    baseUrl,
    model: "fixture-video",
    videoService: "comfyui",
    videoGenerationSource: "comfyui",
    comfyuiWorkflow: JSON.stringify({ "1": { inputs: { text: "%prompt%", image: "%reference_image%" } } }),
    apiKey: "",
  });

  const chats = createChatsStorage(db);
  const gallery = createGalleryStorage(db);
  const roleplay = await chats.create({ name: "Roleplay", mode: "roleplay", characterIds: [], connectionId: text.id });
  assert.ok(roleplay);
  await chats.patchMetadata(roleplay.id, { sceneVideoConnectionId: video.id });
  mkdirSync(join(fixtureDir, "gallery", roleplay.id), { recursive: true });
  writeFileSync(join(fixtureDir, "gallery", roleplay.id, "lantern.png"), png);
  const image = await gallery.create({
    chatId: roleplay.id,
    filePath: `${roleplay.id}/lantern.png`,
    prompt: "A lantern",
  });
  assert.ok(image);

  // The source message shows the image; the clip still joins the newest reply, where the user is.
  const source = await chats.createMessage({
    chatId: roleplay.id,
    role: "assistant",
    characterId: null,
    content: "Aster finds a lantern.",
    extra: { attachments: [{ type: "image", url: "/api/gallery/file/x/lantern.png", galleryId: image.id }] },
  });
  const later = await chats.createMessage({
    chatId: roleplay.id,
    role: "assistant",
    characterId: null,
    content: "The night goes on.",
  });
  assert.ok(source && later);

  const generate = async (payload: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/gallery/generate-scene-video",
      payload: { chatId: roleplay.id, ...payload },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { video: { id: string; url: string }; messageId: string | null };
  };
  const videoAttachments = async (messageId: string) => {
    const message = await chats.getMessage(messageId);
    const extra = typeof message?.extra === "string" ? JSON.parse(message.extra) : (message?.extra ?? {});
    const swipes = await chats.getSwipes(messageId);
    const swipeExtra = swipes[0]?.extra;
    const parsedSwipe = typeof swipeExtra === "string" ? JSON.parse(swipeExtra) : (swipeExtra ?? {});
    const pick = (record: { attachments?: Array<{ type?: string }> }) =>
      (record.attachments ?? []).filter((attachment) => attachment.type === "video");
    return { message: pick(extra), swipe: pick(parsedSwipe) };
  };

  // Animating the image attaches the video to the newest reply, on the message and its swipe.
  // A clip landing on the newest reply mid-send must not look like a history change to Advanced Memory.
  const fingerprintBefore = advancedMemorySourceFingerprint(await chats.listMessages(roleplay.id));
  const first = await generate({ galleryImageId: image.id });
  assert.equal(
    advancedMemorySourceFingerprint(await chats.listMessages(roleplay.id)),
    fingerprintBefore,
    "adding a clip leaves the memory fingerprint unchanged",
  );
  assert.equal(first.messageId, later.id);
  assert.equal((await videoAttachments(source.id)).message.length, 0, "not under the older picture's message");
  const onSource = await videoAttachments(later.id);
  assert.equal(onSource.message.length, 1);
  assert.equal(onSource.swipe.length, 1);
  assert.deepEqual(
    { ...onSource.message[0], url: undefined },
    {
      type: "video",
      url: undefined,
      filename: first.video.url.split("/").pop(),
      prompt: (onSource.message[0] as { prompt?: string }).prompt,
      videoId: first.video.id,
      durationSeconds: (onSource.message[0] as { durationSeconds?: number }).durationSeconds,
      aspectRatio: (onSource.message[0] as { aspectRatio?: string }).aspectRatio,
    },
  );
  assert.equal((onSource.message[0] as { url?: string }).url, first.video.url);
  assert.match(comfyPrompts[0] ?? "", /Aster lifts the lantern/u);

  // An image no message shows also goes to the newest reply.
  writeFileSync(join(fixtureDir, "gallery", roleplay.id, "loose.png"), png);
  const loose = await gallery.create({ chatId: roleplay.id, filePath: `${roleplay.id}/loose.png`, prompt: "Loose" });
  assert.ok(loose);
  const second = await generate({ galleryImageId: loose.id });
  assert.equal(second.messageId, later.id);
  assert.equal((await videoAttachments(later.id)).message.length, 2);

  // A reply that arrives while the clip is being made gets it: the newest reply is chosen after generating.
  let arrived: { id: string } | null = null;
  duringGeneration = async () => {
    arrived = await chats.createMessage({
      chatId: roleplay.id,
      role: "assistant",
      characterId: null,
      content: "Meanwhile, the storm breaks.",
    });
  };
  const third = await generate({ galleryImageId: loose.id });
  duringGeneration = null;
  assert.ok(arrived);
  assert.equal(third.messageId, (arrived as { id: string }).id);
  assert.equal((await videoAttachments((arrived as { id: string }).id)).message.length, 1);

  // Game Mode is unchanged: its clip stays in the gallery and no message gets it.
  const game = await chats.create({ name: "Game", mode: "game", characterIds: [], connectionId: text.id });
  assert.ok(game);
  await chats.patchMetadata(game.id, { sceneVideoConnectionId: video.id });
  mkdirSync(join(fixtureDir, "gallery", game.id), { recursive: true });
  writeFileSync(join(fixtureDir, "gallery", game.id, "map.png"), png);
  const gameImage = await gallery.create({ chatId: game.id, filePath: `${game.id}/map.png`, prompt: "A map" });
  const gameTurn = await chats.createMessage({
    chatId: game.id,
    role: "assistant",
    characterId: null,
    content: "The party unrolls the map.",
  });
  assert.ok(gameImage && gameTurn);
  const gameClip = await generate({ chatId: game.id, galleryImageId: gameImage.id });
  assert.equal(gameClip.messageId, null, "a Game clip is not attached to a message");
  assert.equal((await videoAttachments(gameTurn.id)).message.length, 0);

  // Game scene animation also accepts opt-in WebP saves, converting only the provider reference to PNG.
  await chats.patchMetadata(game.id, { gameVideoConnectionId: video.id });
  const sharp = await getSharp();
  const scene = sharp({
    create: { width: 32, height: 32, channels: 4, background: { r: 20, g: 30, b: 40, alpha: 0.5 } },
  });
  const webpScene = await scene.clone().webp().toBuffer();
  const gamePictures = new Map<string, string>();
  const generateGameClip = async (input: Record<string, unknown>) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/game/generate-scene-video",
      payload: { chatId: game.id, promptOverride: "The lantern sways in the wind.", ...input },
    });
    assert.equal(response.statusCode, 200, response.body);
    const sent = JSON.parse(comfyPrompts.at(-1)!) as { prompt: { "1": { inputs: { image: string } } } };
    return Buffer.from(sent.prompt["1"].inputs.image, "base64");
  };
  for (const [ext, bytes] of [
    ["png", await scene.clone().png().toBuffer()],
    ["jpg", await scene.clone().jpeg().toBuffer()],
    ["webp", webpScene],
  ] as const) {
    const filePath = `${game.id}/scene.${ext}`;
    writeFileSync(join(fixtureDir, "gallery", filePath), bytes);
    const picture = await gallery.create({ chatId: game.id, filePath, prompt: "A lantern" });
    assert.ok(picture);
    gamePictures.set(ext, picture.id);
    const reference = await generateGameClip({ galleryImageId: picture.id });
    if (ext === "webp") {
      assert.equal((await sharp(reference).metadata()).format, "png");
      assert.deepEqual(await sharp(reference).raw().toBuffer(), await sharp(bytes).raw().toBuffer());
    } else {
      assert.deepEqual(reference, bytes, "existing PNG/JPEG references retain their original bytes");
    }
    assert.deepEqual(readFileSync(join(fixtureDir, "gallery", filePath)), bytes, "the saved image is unchanged");
  }
  const illustrationDir = join(fixtureDir, "game-assets", "backgrounds", "illustrations");
  mkdirSync(illustrationDir, { recursive: true });
  writeFileSync(join(illustrationDir, "webp-scene.webp"), webpScene);
  const currentReference = await generateGameClip({ illustrationTag: "backgrounds:illustrations:webp-scene" });
  assert.equal((await sharp(currentReference).metadata()).format, "png");
  assert.deepEqual(await sharp(currentReference).raw().toBuffer(), await sharp(webpScene).raw().toBuffer());

  // Direct Seedance needs URLs; converted frames use only the connection's existing opt-in upload.
  const seedance = await connections.create({
    name: "Seedance reference fixture",
    provider: "video_generation",
    videoGenerationSource: "seedance",
    videoService: "seedance",
    baseUrl: "https://8.8.8.8",
    model: "seedance-2-0",
    apiKey: "fixture",
  });
  await chats.patchMetadata(game.id, { gameVideoConnectionId: seedance.id });
  const originalFetch = globalThis.fetch;
  const originalLookup = dns.lookup;
  const originalPublicBase = process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL;
  const uploaded: Buffer[] = [];
  const submitted: Array<{ input: { image_urls: string[] } }> = [];
  const inlineRequests: Record<string, unknown>[] = [];
  dns.lookup = (async () => [{ address: "8.8.8.8", family: 4 }]) as typeof dns.lookup;
  process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL = "https://public.fixture.example";
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname === "litterbox.catbox.moe") {
      assert.ok(Buffer.isBuffer(options?.body));
      const body = options.body;
      const start = body.indexOf("\r\n\r\n", body.indexOf('name="fileToUpload"')) + 4;
      const bytes = body.subarray(start, body.indexOf("\r\n--", start));
      assert.equal((await sharp(bytes).metadata()).format, "png");
      uploaded.push(bytes);
      return new Response(`https://8.8.8.8/frame-${uploaded.length}.png`);
    }
    assert.ok(["8.8.8.8", "8.8.4.4", "1.1.1.1", "9.9.9.9"].includes(url.hostname), "all HTTP is a fixture");
    if (options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      if (url.hostname !== "8.8.8.8") {
        inlineRequests.push(body);
        return new Response("fixture stops before generation", { status: 400 });
      }
      submitted.push(body);
      return new Response(JSON.stringify({ taskId: "fixture" }));
    }
    if (url.pathname === "/fixture.mp4") return new Response(mp4);
    return new Response(JSON.stringify({ status: "completed", output: { url: "https://8.8.8.8/fixture.mp4" } }));
  };
  try {
    for (const ext of ["png", "jpg"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/game/generate-scene-video",
        payload: { chatId: game.id, galleryImageId: gamePictures.get(ext) },
      });
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(submitted.at(-1)!.input.image_urls, [
        `https://public.fixture.example/gallery/${game.id}/scene.${ext}`,
      ]);
      assert.equal(uploaded.length, 0, "PNG/JPEG keep their public URLs without uploading");
    }
    for (const source of [
      { galleryImageId: gamePictures.get("webp") },
      { illustrationTag: "backgrounds:illustrations:webp-scene" },
    ]) {
      const before = submitted.length;
      const response = await app.inject({
        method: "POST",
        url: "/api/game/generate-scene-video",
        payload: { chatId: game.id, ...source },
      });
      assert.equal(response.statusCode, 502);
      assert.match(response.json().error, /converted.*WebP.*Upload Seedance reference frames temporarily/isu);
      assert.equal(submitted.length, before, "disabled upload never submits a paid task");
      assert.equal(uploaded.length, 0, "a configured public origin does not silently upload converted bytes");
    }
    await connections.updateDefaultParameters(seedance.id, {
      videoGeneration: { service: "seedance", seedance: { temporaryPublicReferenceUploadEnabled: true } },
    });
    const enabled = await app.inject({
      method: "POST",
      url: "/api/game/generate-scene-video",
      payload: { chatId: game.id, galleryImageId: gamePictures.get("webp") },
    });
    assert.equal(enabled.statusCode, 200, enabled.body);
    assert.deepEqual(submitted.at(-1)!.input.image_urls, ["https://8.8.8.8/frame-1.png"]);
    assert.deepEqual(await sharp(uploaded[0]!).raw().toBuffer(), await sharp(webpScene).raw().toBuffer());

    const first = await toVideoReferenceImage(webpScene.toString("base64"), "/original.webp");
    const lastWebp = await sharp({ create: { width: 32, height: 32, channels: 3, background: "orange" } })
      .webp()
      .toBuffer();
    const last = await toVideoReferenceImage(lastWebp.toString("base64"), "/last.webp");
    assert.equal(first.url, undefined);
    assert.equal(last.url, undefined);
    await generateVideo("seedance", "https://8.8.8.8", "fixture", "seedance", {
      prompt: "The lantern sways.",
      durationSeconds: 4,
      aspectRatio: "16:9",
      referenceImage: first,
      lastFrameImage: last,
      publicReferenceUpload: { enabled: true },
    });
    assert.deepEqual(submitted.at(-1)!.input.image_urls, [
      "https://8.8.8.8/frame-2.png",
      "https://8.8.8.8/frame-3.png",
    ]);
    assert.deepEqual(await sharp(uploaded[1]!).raw().toBuffer(), await sharp(webpScene).raw().toBuffer());
    assert.deepEqual(await sharp(uploaded[2]!).raw().toBuffer(), await sharp(lastWebp).raw().toBuffer());
    const inlineReferences = [
      await toVideoReferenceImage(
        readFileSync(join(fixtureDir, "gallery", game.id, "scene.png")).toString("base64"),
        "/scene.png",
      ),
      await toVideoReferenceImage(
        readFileSync(join(fixtureDir, "gallery", game.id, "scene.jpg")).toString("base64"),
        "/scene.jpg",
      ),
      first,
    ];
    assert.equal(inlineReferences[0]!.url, "/scene.png");
    assert.equal(inlineReferences[1]!.url, "/scene.jpg");
    for (const [service, baseUrl, model] of [
      ["openrouter", "https://8.8.4.4/api/v1", "bytedance/seedance-2.5"],
      ["xai", "https://1.1.1.1/v1", "grok-imagine-video"],
      ["google_veo", "https://9.9.9.9/v1beta", "veo-3.1-generate-preview"],
    ] as const) {
      for (const reference of inlineReferences) {
        await assert.rejects(
          generateVideo(service, baseUrl, "fixture", service, {
            model,
            prompt: "The lantern sways.",
            durationSeconds: 8,
            aspectRatio: "16:9",
            referenceImage: reference,
          }),
          /400.*fixture stops before generation/su,
        );
        const payload = JSON.stringify(inlineRequests.at(-1));
        assert.ok(payload.includes(reference.base64), `${service} sends the prepared image bytes inline`);
        assert.ok(payload.includes(reference.mimeType));
        assert.ok(!payload.includes("original.webp"));
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    dns.lookup = originalLookup;
    if (originalPublicBase === undefined) delete process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL;
    else process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL = originalPublicBase;
  }

  // The newest reply's shown swipe gets the clip.
  assert.deepEqual(
    resolveChatVideoAnchor([
      { id: "old", role: "assistant", activeSwipeIndex: 0 },
      { id: "reply", role: "assistant", activeSwipeIndex: 1 },
      { id: "you", role: "user" },
    ]),
    { messageId: "reply", swipeIndex: 1 },
  );
  assert.equal(resolveChatVideoAnchor([{ id: "you", role: "user" }]), null, "no reply yet: Gallery only");
  // A hidden command-only reply is never shown, so the clip goes to the newest reply the user can see.
  assert.deepEqual(
    resolveChatVideoAnchor([
      { id: "shown", role: "assistant", activeSwipeIndex: 0 },
      { id: "hidden", role: "assistant", activeSwipeIndex: 0, extra: JSON.stringify({ hiddenFromUser: true }) },
    ]),
    { messageId: "shown", swipeIndex: 0 },
  );
  assert.equal(
    resolveChatVideoAnchor([{ id: "hidden", role: "assistant", extra: { hiddenFromUser: true } }]),
    null,
    "only hidden replies: Gallery only",
  );

  // A video attachment is never an image, a provider file, or readable text for a model prompt.
  const attachment = { type: "video", url: first.video.url, filename: "clip.mp4", prompt: "Aster lifts the lantern" };
  assert.deepEqual(extractImageAttachmentDataUrls([attachment]), []);
  assert.deepEqual(extractFileAttachmentInputs([attachment]), []);
  assert.deepEqual(buildReadableAttachmentBlocks([attachment]), []);
  console.log("inline-chat-videos regression passed");
} finally {
  await app.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await closeDB();
  rmSync(fixtureDir, { recursive: true, force: true });
}
