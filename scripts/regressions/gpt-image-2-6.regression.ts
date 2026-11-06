/**
 * GPT Image 2.6 and animated GIF output (capability API 1.816):
 *   - 2.6 stills behave like 2.5: listed models, custom sizes with the 1024x1536-pixel floor, xhigh/max quality, alpha;
 *   - `animation` on a native OpenAI 2.6 connection sends one /images/generations request with output_format "gif",
 *     2..12 frames of 20..2000 ms, the smallest frame size in the requested shape, a quality only when it is a level
 *     2.6 lists (never "auto"), and none of the fields OpenAI refuses with a GIF, even when the connection's custom
 *     parameters set them or its size;
 *   - ChatGPT (Codex login), OpenRouter, NanoGPT, ToAPIs, a 2.5 model and any picture are refused before a request,
 *     and the shared imageConnectionMakesAnimatedGif gives generateImage's answer for each connection row;
 *   - a fallback that can't make GIFs is skipped, and a still answer (typed by its bytes, even from a URL with a wrong
 *     content type) is a failed attempt, never a quiet still;
 *   - the GIF is saved as .gif (WebP conversion leaves it alone), a chat record of it names no references, and the
 *     avatar-generation route answers 400 code "animation-unsupported" for a refusal and a GIF data URL otherwise,
 *     logging the final GIF request in debug mode.
 * Every provider is a local fake server, so nothing is paid for.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "../../packages/server/node_modules/fastify/fastify.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gpt-image-2-6-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";
process.env.LOG_LEVEL = "silent";

const { MODEL_LISTS } = await import("../../packages/shared/src/constants/model-lists.js");
const openAIImage = await import("../../packages/shared/src/utils/openai-image.js");
const { buildChatImageGenerationRecord, parseChatImageGenerationRecord } =
  await import("../../packages/shared/src/utils/chat-image-generation.js");
const imageGeneration = await import("../../packages/server/src/services/image/image-generation.js");
const { applyGeneratedImageFormatUiSettingsValue, formatGeneratedImageForStorage } =
  await import("../../packages/server/src/services/image/generated-image-format.js");
const { logger } = await import("../../packages/server/src/lib/logger.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { charactersRoutes } = await import("../../packages/server/src/routes/characters.routes.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const {
  OPENAI_GIF_MAX_FRAMES,
  isOpenAIGptImage25Model,
  isOpenAIGptImageModel,
  resolveOpenAIGifAnimation,
  resolveOpenAIImageQuality,
  supportsOpenAIAnimatedGif,
  supportsOpenAIImageCustomSize,
  supportsOpenAITransparentBackground,
} = openAIImage;
const {
  IMAGE_ANIMATION_REFERENCE_MESSAGE,
  IMAGE_ANIMATION_STILL_MESSAGE,
  IMAGE_ANIMATION_UNSUPPORTED_MESSAGE,
  ImageAnimationUnsupportedError,
  OPENAI_GIF_LOOP_PROMPT,
  generateImage,
  imageConnectionMakesAnimatedGif,
  openAIGifFrameSize,
  saveImageToDisk,
} = imageGeneration;
type ImageGenRequest = Parameters<typeof generateImage>[4];

// ── Models and predicates ──
const models = ["gpt-image-2.6-flare", "gpt-image-2.6-sunburst"];
for (const model of models) {
  assert.ok(
    MODEL_LISTS.image_generation.some((entry) => entry.id === model),
    `${model} is listed`,
  );
  for (const id of [model, `${model}-2026-11-01`, model.toUpperCase()]) {
    assert.ok(isOpenAIGptImageModel(id), id);
    assert.ok(isOpenAIGptImage25Model(id), `${id} keeps 2.5's sizes, quality levels and alpha`);
    assert.ok(supportsOpenAIImageCustomSize(id), id);
    assert.ok(supportsOpenAITransparentBackground(id), id);
    assert.ok(supportsOpenAIAnimatedGif(id), id);
    for (const quality of ["xhigh", "max"]) assert.equal(resolveOpenAIImageQuality(quality, id), quality);
  }
}
assert.equal(resolveOpenAIImageQuality("max", "openai/gpt-image-2.6-sunburst"), "max");
assert.equal(resolveOpenAIImageQuality("xhigh", "openai/gpt-image-2.6-flare"), "xhigh");
for (const model of [
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2",
  "openai/gpt-image-2.6-flare",
  "gpt-image-2.6",
  "gpt-image-2.60-flare",
  "gpt-image-2.6-flarex",
  "",
  null,
  undefined,
])
  assert.equal(supportsOpenAIAnimatedGif(model), false, String(model));
for (const model of ["gpt-image-2.6", "gpt-image-2.60-flare"]) assert.equal(isOpenAIGptImageModel(model), false);

// ── Frame timing and frame size ──
assert.equal(OPENAI_GIF_MAX_FRAMES, 12);
for (const [input, expected] of [
  [{}, { frameCount: 9, frameDurationMs: 200 }],
  [
    { frameCount: 1, frameDurationMs: 15 },
    { frameCount: 2, frameDurationMs: 20 },
  ],
  [
    { frameCount: 99, frameDurationMs: 2345 },
    { frameCount: 12, frameDurationMs: 2000 },
  ],
  [
    { frameCount: 4.6, frameDurationMs: 333 },
    { frameCount: 5, frameDurationMs: 330 },
  ],
  [
    { frameCount: Number.NaN, frameDurationMs: Infinity },
    { frameCount: 9, frameDurationMs: 200 },
  ],
  [
    { frameCount: "12", frameDurationMs: "50" },
    { frameCount: 9, frameDurationMs: 200 },
  ],
] as const)
  assert.deepEqual(resolveOpenAIGifAnimation(input as never), expected, JSON.stringify(input));
for (const [width, height, expected] of [
  [1024, 1024, "816x816"],
  [576, 1024, "608x1088"],
  [1024, 1536, "672x992"],
  [1920, 640, "1408x480"],
] as const)
  assert.equal(openAIGifFrameSize(width, height), expected, `${width}x${height}`);
for (const [width, height] of [
  [undefined, undefined],
  [1, 1],
  [4096, 256],
  [256, 4096],
  [3840, 2160],
  [999, 777],
  [Number.NaN, -1],
  [Number.MAX_VALUE, 1],
]) {
  const size = openAIGifFrameSize(width, height);
  const [w, h] = size.split("x").map(Number);
  assert.ok(w! % 16 === 0 && h! % 16 === 0, size);
  assert.ok(w! * h! >= 655_360 && w! * h! <= 691_200, size);
  assert.ok(OPENAI_GIF_MAX_FRAMES * w! * h! <= 8_294_400, size);
}

// ── A fake OpenAI images server (as in gpt-image-2-5.regression.ts) ──
// A real two-frame 1x1 looping GIF: black, then white, 100 ms each.
// Each frame: a 100 ms delay, a 1x1 image, then one LZW-coded pixel of colour 0 ("44") or 1 ("4c").
const gifFrame = (pixel: string) => `21f904000a0000002c0000000001000100000202${pixel}0100`;
const gif = Buffer.from(
  "474946383961" + // GIF89a
    "01000100800000" + // 1x1 with a two-colour table
    "000000ffffff" +
    "21ff0b4e45545343415045322e300301000000" + // loop forever
    gifFrame("44") +
    gifFrame("4c") +
    "3b",
  "hex",
).toString("base64");
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<{ path: string; contentType: string; body: Buffer }> = [];
// It answers in the format asked for, unless the test sets a base path to answer with a PNG or to fail.
const answers = new Map<string, "png" | "fail">();
// A base path set here answers with `data[0].url` instead, a file of these bytes served with this content type.
const urlAnswers = new Map<string, { bytes: string; contentType: string; file: string }>();
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const path = request.url ?? "";
  const served = [...urlAnswers.values()].find(({ file }) => path === `/files/${file}`);
  if (served) {
    response.setHeader("content-type", served.contentType);
    response.end(Buffer.from(served.bytes, "base64"));
    return;
  }
  const body = Buffer.concat(chunks);
  requests.push({ path, contentType: request.headers["content-type"] ?? "", body });
  const asksForGif =
    request.headers["content-type"] === "application/json" && /"output_format":"gif"/.test(body.toString());
  const base = path.split("/")[1] ?? "";
  const answer = answers.get(base) ?? (asksForGif ? "gif" : "png");
  response.setHeader("content-type", "application/json");
  const byUrl = urlAnswers.get(base);
  if (byUrl) {
    response.end(JSON.stringify({ data: [{ url: `http://${request.headers.host}/files/${byUrl.file}` }] }));
    return;
  }
  if (answer === "fail") {
    response.statusCode = 503;
    response.end(JSON.stringify({ error: { message: "fixture unavailable" } }));
    return;
  }
  response.end(JSON.stringify({ data: [{ b64_json: answer === "gif" ? gif : png }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const local = (name: string) => `http://127.0.0.1:${address.port}/${name}/v1`;
const json = (captured: { body: Buffer }) => JSON.parse(captured.body.toString()) as Record<string, unknown>;
const takeOne = () => {
  const captured = requests.pop();
  assert.ok(captured);
  assert.equal(requests.length, 0, "Each call must make exactly one provider request");
  return captured;
};
const generate = (request: Partial<ImageGenRequest>, baseUrl = local("primary"), serviceHint = "openai") =>
  generateImage("openai", baseUrl, "fixture-key", serviceHint, {
    model: models[0],
    prompt: "a moonlit laboratory",
    width: 1536,
    height: 864,
    quality: "max",
    transparentBackground: true,
    allowLocalUrls: true,
    ...request,
  });

const fileStoreDb = await createFileNativeDB();
const app = Fastify();
try {
  // ── 2.6 stills match 2.5 ──
  for (const model of models) {
    const still = await generate({ model, quality: "xhigh" });
    assert.equal(still.mimeType, "image/png");
    const generation = takeOne();
    assert.equal(generation.path, "/primary/v1/images/generations");
    assert.deepEqual(json(generation), {
      model,
      prompt: "a moonlit laboratory",
      n: 1,
      size: "1680x944",
      output_format: "png",
      quality: "xhigh",
      background: "transparent",
    });
    await generate({ model });
    assert.equal(json(takeOne()).quality, "max");
    // The ~1 MP sizes packages ask for grow to the 1024x1536-pixel floor in their own shape, as #8759 does for 2.5.
    await generate({ model, width: 768, height: 1344 });
    assert.equal(json(takeOne()).size, "960x1664");
    // A still with a picture is still an edit.
    await generate({ model, referenceImages: [png] });
    assert.equal(takeOne().path, "/primary/v1/images/edits");
  }

  // ── The GIF request ──
  const debugLogs: string[] = [];
  const priorWarn = logger.warn;
  logger.warn = ((message: unknown, ...args: unknown[]) => {
    debugLogs.push([message, ...args].map(String).join(" "));
  }) as typeof logger.warn;
  const result = await generate({
    animation: {},
    width: 1024,
    height: 1024,
    quality: "xhigh",
    debugMode: true,
  }).finally(() => {
    logger.warn = priorWarn;
  });
  let captured = takeOne();
  assert.equal(captured.path, "/primary/v1/images/generations", "a GIF never goes to /edits");
  assert.equal(captured.contentType, "application/json");
  assert.deepEqual(json(captured), {
    model: models[0],
    prompt: `a moonlit laboratory\n\n${OPENAI_GIF_LOOP_PROMPT}`,
    n: 1,
    size: "816x816",
    output_format: "gif",
    frame_count: 9,
    frame_duration_ms: 200,
    quality: "xhigh",
  });
  assert.ok(
    debugLogs.some(
      (line) => line.includes("[debug/image/openai] GIF request payload") && line.includes('"frame_count": 9'),
    ),
    "debug mode logs the final GIF request",
  );
  assert.equal(result.mimeType, "image/gif");
  assert.equal(result.ext, "gif");
  assert.equal(result.base64, gif);

  // The connection's default quality, "auto", isn't a level 2.6 lists, so the field is left off and the API default applies.
  await generate({ animation: {}, quality: "auto" });
  assert.equal("quality" in json(takeOne()), false, "quality auto sends no quality");
  await generate({ animation: {}, quality: undefined });
  assert.equal("quality" in json(takeOne()), false);

  // The connection's custom parameters can't add what a GIF refuses or change its model, size or frames. A custom
  // quality wins over the connection's, as on stills.
  await generate({
    model: models[1],
    animation: { frameCount: 99, frameDurationMs: 333 },
    width: 576,
    height: 1024,
    quality: undefined,
    negativePrompt: "text",
    imageDefaults: {
      version: 1,
      service: "api",
      seed: -1,
      customParameters: {
        background: "transparent",
        output_compression: 50,
        stream: true,
        partial_images: 2,
        response_format: "url",
        prompt_rewriter: "auto",
        size: "1536x1024",
        quality: "low",
        n: 4,
        output_format: "png",
        frame_count: 64,
        frame_duration_ms: 5,
        model: "gpt-image-2.5-flare",
        complexity: "low",
      },
    },
  });
  assert.deepEqual(json(takeOne()), {
    model: models[1],
    prompt: `a moonlit laboratory\n\nDo not include: text.\n\n${OPENAI_GIF_LOOP_PROMPT}`,
    n: 1,
    size: "608x1088",
    output_format: "gif",
    frame_count: 12,
    frame_duration_ms: 330,
    quality: "low",
    complexity: "low",
  });
  // A custom quality is checked like the connection's: one 2.6 doesn't list is left off.
  for (const customQuality of ["auto", "ultra", 3]) {
    await generate({
      animation: {},
      quality: "xhigh",
      imageDefaults: { version: 1, service: "api", seed: -1, customParameters: { quality: customQuality } },
    });
    assert.equal("quality" in json(takeOne()), false, String(customQuality));
  }
  await generate({
    animation: {},
    quality: "low",
    imageDefaults: { version: 1, service: "api", seed: -1, customParameters: { quality: "max" } },
  });
  assert.equal(json(takeOne()).quality, "max");
  await generate({ animation: { frameCount: 1, frameDurationMs: 15 } });
  captured = takeOne();
  assert.equal(json(captured).frame_count, 2);
  assert.equal(json(captured).frame_duration_ms, 20);
  assert.equal(json(captured).size, openAIGifFrameSize(1536, 864));
  // An empty reference list or field is no picture.
  await generate({ animation: {}, referenceImages: [], referenceImage: "" });
  assert.equal(json(takeOne()).output_format, "gif");
  await generate({ animation: {}, referenceImages: ["  "] });
  assert.equal(json(takeOne()).output_format, "gif");
  // A request without `animation`, as backgrounds, a video's first frame and every other existing caller send, is a still.
  await generate({ width: 1024, height: 1024 });
  const stillBody = json(takeOne());
  assert.equal(stillBody.output_format, "png");
  assert.equal(stillBody.frame_count, undefined);

  // ── Saving ──
  applyGeneratedImageFormatUiSettingsValue(JSON.stringify({ saveGeneratedImagesAsWebp: true }));
  try {
    assert.equal((await generate({})).mimeType, "image/webp", "the WebP setting is on");
    takeOne();
    const kept = await generate({ animation: {} });
    takeOne();
    assert.equal(kept.mimeType, "image/gif", "WebP conversion leaves a GIF alone");
    assert.equal(kept.base64, gif);
    assert.deepEqual(await formatGeneratedImageForStorage(kept), kept);
    const saved = saveImageToDisk("gif-chat", kept.base64, kept.ext);
    assert.match(saved, /^gif-chat\/[^/]+\.gif$/);
    const file = join(dataDir, "gallery", saved);
    assert.ok(existsSync(file));
    assert.equal(readFileSync(file).toString("base64"), gif);
  } finally {
    applyGeneratedImageFormatUiSettingsValue(null);
  }

  // ── Answers as a URL: the bytes decide, not the content type or the URL's text ──
  urlAnswers.set("url-still", { bytes: png, contentType: "image/gif", file: "still.gif" });
  await assert.rejects(generate({ animation: {} }, local("url-still")), { message: IMAGE_ANIMATION_STILL_MESSAGE });
  takeOne();
  const stillFromUrl = await generate({}, local("url-still"));
  takeOne();
  assert.equal(stillFromUrl.mimeType, "image/png", "a still labelled as a GIF is typed by its bytes");
  urlAnswers.set("url-gif", { bytes: gif, contentType: "image/jpeg", file: "loop.jpg" });
  const gifFromUrl = await generate({ animation: {} }, local("url-gif"));
  takeOne();
  assert.equal(gifFromUrl.mimeType, "image/gif", "a GIF labelled as a JPEG is kept as a GIF");
  assert.equal(gifFromUrl.ext, "gif");
  assert.equal(gifFromUrl.base64, gif);
  assert.match(saveImageToDisk("gif-chat", gifFromUrl.base64, gifFromUrl.ext), /^gif-chat\/[^/]+\.gif$/);
  urlAnswers.clear();

  // ── Refusals, before any request ──
  const refuses = async (
    message: string,
    request: Partial<ImageGenRequest>,
    baseUrl = local("primary"),
    serviceHint = "openai",
    source = "openai",
  ) => {
    await assert.rejects(
      generateImage(source, baseUrl, "fixture-key", serviceHint, {
        model: models[0],
        prompt: "a moonlit laboratory",
        animation: {},
        allowLocalUrls: true,
        ...request,
      }),
      (error: unknown) =>
        error instanceof ImageAnimationUnsupportedError &&
        error.code === "animation-unsupported" &&
        error.message === message,
    );
    assert.equal(requests.length, 0, `${message} is refused before any request`);
  };
  await refuses(IMAGE_ANIMATION_REFERENCE_MESSAGE, { referenceImages: [png] });
  await refuses(IMAGE_ANIMATION_REFERENCE_MESSAGE, { referenceImage: `data:image/png;base64,${png}` });
  await refuses(IMAGE_ANIMATION_REFERENCE_MESSAGE, { referenceIsCanvas: true });
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, { model: "gpt-image-2.5-flare" });
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, { model: "gpt-image-2" });
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, {}, local("primary"), "codex_chatgpt", "codex_chatgpt");
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, {}, local("primary"), "openrouter");
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, { model: "openai/gpt-image-2.6-flare" }, local("primary"));
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, {}, local("primary"), "nanogpt");
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, {}, "https://toapis.com/v1");
  // The refusal is the connection's, so it comes first even with a picture.
  await refuses(IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, { model: "gpt-image-2.5-flare", referenceImages: [png] });
  // The connection rule, as callers that pass the model as `source` see it.
  const rule = (baseUrl: string, serviceHint: string, model = models[0]) =>
    imageConnectionMakesAnimatedGif({ source: model, baseUrl, serviceHint, model });
  assert.equal(rule("https://api.openai.com/v1", "openai"), true);
  assert.equal(rule("https://api.openai.com/v1", ""), true);
  assert.equal(rule("https://api.openai.com/v1", "openai", "gpt-image-2.5-sunburst"), false);
  assert.equal(rule("https://openrouter.ai/api/v1", ""), false);
  assert.equal(rule("https://openrouter.ai/api/v1", "openrouter", "openai/gpt-image-2.6-flare"), false);
  assert.equal(rule("https://openrouter.ai/api/v1", "openai", "openai/gpt-image-2.6-flare"), false);
  // An explicit OpenAI-compatible account is tried as one; a still answer is then refused (below).
  assert.equal(rule("https://openrouter.ai/api/v1", "openai"), true);
  assert.equal(rule("https://nano-gpt.com/api/v1", ""), false);
  assert.equal(rule("https://toapis.com/v1", "openai"), false);
  assert.equal(rule("", "codex_chatgpt"), false);
  // The shared rule, which client gates ask with a connection row mapped as the routes map it, gives generateImage's
  // answer: it refuses exactly the rows the rule says can't make GIFs.
  const rows: Array<{ row: Record<string, string>; makesGifs: boolean }> = [
    { row: { imageGenerationSource: "openai", baseUrl: local("rows"), model: models[0] }, makesGifs: true },
    { row: { imageService: "openai", baseUrl: local("rows"), model: models[1] }, makesGifs: true },
    { row: { baseUrl: local("rows"), model: models[0] }, makesGifs: true },
    { row: { imageGenerationSource: "openai", baseUrl: local("rows"), model: "gpt-image-2.5-flare" }, makesGifs: false },
    { row: { imageGenerationSource: "codex_chatgpt", baseUrl: "", model: models[0] }, makesGifs: false },
    { row: { imageGenerationSource: "openai", baseUrl: "https://toapis.com/v1", model: models[0] }, makesGifs: false },
    { row: { baseUrl: "https://toapis.cn", model: models[1] }, makesGifs: false },
    { row: { imageGenerationSource: "nanogpt", baseUrl: local("rows"), model: models[0] }, makesGifs: false },
    { row: { baseUrl: "https://nano-gpt.com/api/v1", model: models[0] }, makesGifs: false },
    { row: { imageGenerationSource: "openrouter", baseUrl: local("rows"), model: models[0] }, makesGifs: false },
    { row: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-image-2.6-flare" }, makesGifs: false },
  ];
  for (const { row, makesGifs } of rows) {
    const source = row.imageGenerationSource || row.model!;
    const connection = { source, baseUrl: row.baseUrl!, serviceHint: row.imageService || source, model: row.model };
    const label = JSON.stringify(row);
    assert.equal(openAIImage.imageConnectionMakesAnimatedGif(connection), makesGifs, label);
    const allowed = await generateImage(source, connection.baseUrl, "fixture-key", connection.serviceHint, {
      model: row.model,
      prompt: "a moonlit laboratory",
      animation: {},
      allowLocalUrls: true,
    }).then(
      () => true,
      (error: unknown) => {
        if (error instanceof ImageAnimationUnsupportedError) return false;
        throw error;
      },
    );
    assert.equal(allowed, makesGifs, `generateImage agrees with the shared rule for ${label}`);
    assert.equal(requests.splice(0).length, makesGifs ? 1 : 0, label);
  }

  // ── Fallbacks and still answers ──
  const fallbackTo = (name: string, model: string) => ({
    connectionId: `${name}-connection`,
    connectionName: name,
    provider: "image_generation",
    source: "openai",
    baseUrl: local(name),
    apiKey: "fixture-key",
    serviceHint: "openai",
    model,
  });
  const notices: string[] = [];
  const onFallback = async ({ connectionId }: { connectionId: string }) => {
    notices.push(connectionId);
  };
  answers.set("primary", "fail");
  await assert.rejects(
    generate({ animation: {}, fallback: fallbackTo("still-fallback", "gpt-image-2.5-flare"), onFallback }),
    /OpenAI image generation failed \(503\)/,
  );
  assert.deepEqual(
    requests.splice(0).map((entry) => entry.path),
    ["/primary/v1/images/generations"],
    "a fallback that can't make GIFs is skipped",
  );
  assert.deepEqual(notices.splice(0), []);
  // A still answer is a failed attempt: it is never returned as the GIF, and one fallback that makes GIFs may run.
  // Background work waits for an endpoint with no recent foreground work, so this one books on its own.
  const booked: string[] = [];
  answers.set("background", "png");
  await assert.rejects(
    generate(
      {
        animation: {},
        admissionMode: { kind: "background", beforeAttempt: () => (outcome) => void booked.push(outcome) },
      },
      local("background"),
    ),
    { message: IMAGE_ANIMATION_STILL_MESSAGE },
  );
  takeOne();
  assert.deepEqual(booked, ["failed"], "a still answer is booked as a failed attempt");
  answers.set("primary", "png");
  const rescued = await generate({ animation: {}, fallback: fallbackTo("gif-fallback", models[1]), onFallback });
  assert.equal(rescued.mimeType, "image/gif");
  assert.equal(rescued.effectiveConnection?.connectionId, "gif-fallback-connection");
  const legs = requests.splice(0);
  assert.deepEqual(
    legs.map((entry) => entry.path),
    ["/primary/v1/images/generations", "/gif-fallback/v1/images/generations"],
  );
  assert.equal(json(legs[1]!).output_format, "gif");
  assert.equal(json(legs[1]!).model, models[1]);
  assert.deepEqual(notices.splice(0), ["gif-fallback-connection"]);
  answers.set("gif-fallback", "png");
  await assert.rejects(generate({ animation: {}, fallback: fallbackTo("gif-fallback", models[1]), onFallback }), {
    message: IMAGE_ANIMATION_STILL_MESSAGE,
  });
  assert.equal(requests.splice(0).length, 2, "a still from the fallback fails too, with no third attempt");
  notices.length = 0;
  answers.clear();

  // ── The chat record of a GIF ──
  const references = {
    referenceCharacterIds: ["char-1"],
    referencePersonaId: "persona-1",
    referencePersonaSource: "avatar" as const,
    locationImageId: "location-1",
  };
  const gifRecord = buildChatImageGenerationRecord({ prompt: "a wave", ...references, animation: { frameCount: 6 } });
  assert.deepEqual(gifRecord.animation, { frameCount: 6 });
  assert.deepEqual(gifRecord.references, {
    characterIds: [],
    personaId: null,
    personaSource: null,
    locationImageId: null,
  });
  assert.deepEqual(parseChatImageGenerationRecord(JSON.stringify(gifRecord)), gifRecord);
  assert.deepEqual(parseChatImageGenerationRecord({ ...gifRecord, animation: {} })?.animation, {});
  const stillRecord = buildChatImageGenerationRecord({ prompt: "a wave", ...references });
  assert.equal("animation" in stillRecord, false);
  assert.deepEqual(stillRecord.references.characterIds, ["char-1"]);
  assert.equal(parseChatImageGenerationRecord({ ...stillRecord, animation: "gif" })?.animation, undefined);

  // ── POST /api/characters/avatar-generation ──
  app.decorate("db", fileStoreDb);
  await app.register(charactersRoutes, { prefix: "/api/characters" });
  await app.ready();
  const connections = createConnectionsStorage(fileStoreDb);
  const connectionFor = async (model: string) =>
    (await connections.create({
      name: model,
      provider: "image_generation",
      imageGenerationSource: "openai",
      baseUrl: local("avatar"),
      apiKey: "fixture-key",
      model,
    }))!.id;
  const gif25 = await connectionFor("gpt-image-2.5-flare");
  const gif26 = await connectionFor(models[0]);
  const avatar = (payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/characters/avatar-generation",
      payload: { name: "Mira", appearance: "silver hair, green coat", width: 1024, height: 1024, ...payload },
    });
  let response = await avatar({ connectionId: gif25, animation: {} });
  assert.equal(response.statusCode, 400, response.body);
  assert.deepEqual(response.json(), { error: IMAGE_ANIMATION_UNSUPPORTED_MESSAGE, code: "animation-unsupported" });
  response = await avatar({ connectionId: gif26, animation: {}, referenceImages: [`data:image/png;base64,${png}`] });
  assert.equal(response.statusCode, 400, response.body);
  assert.deepEqual(response.json(), { error: IMAGE_ANIMATION_REFERENCE_MESSAGE, code: "animation-unsupported" });
  assert.equal(requests.length, 0, "the route's refusals send nothing");
  // The route forwards the UI's debug mode, so the final GIF request is logged.
  const routeLogs: string[] = [];
  logger.warn = ((message: unknown, ...args: unknown[]) => {
    routeLogs.push([message, ...args].map(String).join(" "));
  }) as typeof logger.warn;
  try {
    response = await avatar({ connectionId: gif26, animation: { frameCount: 4 }, debugMode: true });
  } finally {
    logger.warn = priorWarn;
  }
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().image, `data:image/gif;base64,${gif}`);
  assert.ok(
    routeLogs.some(
      (line) => line.includes("[debug/image/openai] GIF request payload") && line.includes('"frame_count": 4'),
    ),
    "the route's debug mode logs the final GIF request",
  );
  const avatarBody = json(takeOne());
  assert.equal(avatarBody.output_format, "gif");
  assert.equal(avatarBody.frame_count, 4);
  assert.equal(avatarBody.size, "816x816");
  assert.equal("quality" in avatarBody, false, "a connection without an Image quality sends none");
  response = await avatar({ connectionId: gif26 });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().image, `data:image/png;base64,${png}`, "without animation the avatar stays a still");
  assert.equal(json(takeOne()).output_format, "png");
  answers.set("avatar", "png");
  response = await avatar({ connectionId: gif26, animation: {} });
  assert.equal(response.statusCode, 500, "a still answer to a GIF request is an error");
  assert.equal(response.json().error, IMAGE_ANIMATION_STILL_MESSAGE);
  takeOne();
} finally {
  await app.close();
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await fileStoreDb._fileStore.close();
  rmSync(dataDir, { recursive: true, force: true });
}
console.info("GPT Image 2.6 regression passed");
