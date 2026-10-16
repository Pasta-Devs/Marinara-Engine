/**
 * Image edits need a connection that sends the picture to its model (#7685). A provider that drops it
 * (Pollinations sends only the prompt and size) draws a new picture, as a blink or talk picture redrawn
 * as a full-body shot.
 *   - every backend generateImage calls has an entry in the reference-picture table, matching its adapter;
 *   - an avatar edit on such a connection is refused with a plain message before anything is paid for;
 *   - a fallback connection that would drop the picture is skipped for an edit, one that takes it is used;
 *   - SpicyAPI, whose model's input schema decides, refuses an edit before a task is created.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-image-edit-reference-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.IMAGE_LOCAL_URLS_ENABLED = "true";

const { logger } = await import("../../packages/server/src/lib/logger.js");
const { getSharp } = await import("../../packages/server/src/services/image/sharp-runtime.js");
const {
  IMAGE_EDIT_REFERENCE_TOO_LARGE_MESSAGE,
  IMAGE_EDIT_UNSUPPORTED_MESSAGE,
  generateImage,
  imageConnectionTakesReferencePicture,
} = await import("../../packages/server/src/services/image/image-generation.js");
const { AvatarGenerationError, drawAvatarImageEdit, resolveAvatarImageConnection } =
  await import("../../packages/server/src/services/avatars/generation/generation-context.js");
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");

assert.equal(
  IMAGE_EDIT_UNSUPPORTED_MESSAGE,
  "This image connection can't edit pictures. Choose one that accepts a reference picture.",
);

// ── The table, backend by backend ──
{
  const takes = (
    serviceHint: string,
    { baseUrl = "https://images.example.test/v1", model = "", comfyWorkflow = "" } = {},
  ) =>
    imageConnectionTakesReferencePicture({ source: serviceHint || model, baseUrl, serviceHint, model, comfyWorkflow });
  const withReference = JSON.stringify({ 1: { inputs: { image: "%reference_image%" } } });
  const withNumberedName = JSON.stringify({ 1: { inputs: { image: "%reference_image_name_01%" } } });
  // An edit sends one picture, into %reference_image% or the _01 slot only.
  const withLaterSlotOnly = JSON.stringify({ 1: { inputs: { image: "%reference_image_02%" } } });
  const withLaterNameSlotOnly = JSON.stringify({ 1: { inputs: { image: "%reference_image_name_03%" } } });
  const textOnly = JSON.stringify({ 1: { inputs: { text: "%prompt%" } } });
  const withReferenceAndNameSlot = JSON.stringify({
    1: { inputs: { image: "%reference_image%" } },
    2: { inputs: { image: "%reference_image_name_02%" } },
  });
  const cases: Array<[backend: string, label: string, expected: boolean, actual: boolean]> = [
    ["pollinations", "Pollinations sends only the prompt", false, takes("pollinations")],
    [
      "pollinations",
      "an avatar connection with no service and no URL is Pollinations",
      false,
      takes("", { baseUrl: "https://image.pollinations.ai" }),
    ],
    ["togetherai", "Together AI", false, takes("togetherai", { model: "black-forest-labs/FLUX.1-schnell-Free" })],
    ["horde", "Horde", false, takes("horde")],
    ["venice", "Venice", false, takes("venice", { model: "qwen-image-2" })],
    ["zai", "Z.AI", false, takes("zai", { model: "glm-image" })],
    ["fal", "fal.ai", false, takes("fal", { model: "fal-ai/flux/dev" })],
    ["openai", "GPT Image edits", true, takes("openai", { model: "gpt-image-1" })],
    ["openai", "DALL-E is asked for a new picture", false, takes("openai", { model: "dall-e-3" })],
    ["codex_chatgpt", "ChatGPT plan", true, takes("codex_chatgpt")],
    ["arli", "Arli img2img", true, takes("arli", { model: "fixture" })],
    ["nanogpt", "NanoGPT", true, takes("", { baseUrl: "https://nano-gpt.com/api/v1", model: "flux-kontext" })],
    ["openrouter", "OpenRouter", true, takes("openrouter", { model: "google/gemini-2.5-flash-image" })],
    ["xai", "xAI edits", true, takes("xai", { model: "grok-2-image" })],
    ["gemini_image", "Gemini image", true, takes("gemini_image", { model: "gemini-2.5-flash-image" })],
    ["automatic1111", "A1111 img2img", true, takes("automatic1111")],
    ["automatic1111", "Draw Things img2img", true, takes("drawthings")],
    ["spicyapi", "SpicyAPI (checked against the model when asked)", true, takes("spicyapi")],
    ["stability", "Stability v2 image-to-image", true, takes("stability", { baseUrl: "https://api.stability.ai" })],
    [
      "stability",
      "Stability v1 is text-to-image",
      false,
      takes("stability", { baseUrl: "https://api.stability.ai/v1" }),
    ],
    [
      "novelai",
      "NovelAI V4.5 precise reference",
      true,
      takes("novelai", { baseUrl: "https://image.novelai.net", model: "nai-diffusion-4-5-full" }),
    ],
    ["novelai", "NovelAI's default model", true, takes("novelai", { baseUrl: "https://image.novelai.net" })],
    [
      "novelai",
      "NovelAI V5 drops references",
      false,
      takes("novelai", { baseUrl: "https://image.novelai.net", model: "nai-diffusion-5-full" }),
    ],
    [
      "novelai",
      "a NovelAI proxy gets them through chat completions",
      true,
      takes("novelai", { baseUrl: "https://proxy.example.test/v1", model: "nai-diffusion-5-full" }),
    ],
    ["atlas", "an Atlas Cloud edit model", true, takes("atlas", { model: "black-forest-labs/flux-kontext-dev" })],
    [
      "atlas",
      "an Atlas Cloud text-to-image model",
      false,
      takes("atlas", { model: "google/nano-banana/text-to-image" }),
    ],
    ["comfyui", "ComfyUI's built-in workflow", false, takes("comfyui")],
    ["comfyui", "a ComfyUI workflow without a slot", false, takes("comfyui", { comfyWorkflow: textOnly })],
    ["comfyui", "a ComfyUI workflow with a slot", true, takes("comfyui", { comfyWorkflow: withReference })],
    ["comfyui", "a numbered ComfyUI file slot", true, takes("comfyui", { comfyWorkflow: withNumberedName })],
    [
      "comfyui",
      "a ComfyUI workflow with only a later slot never gets the picture",
      false,
      takes("comfyui", { comfyWorkflow: withLaterSlotOnly }),
    ],
    [
      "comfyui",
      "a ComfyUI workflow with only a later file slot never gets the picture",
      false,
      takes("comfyui", { comfyWorkflow: withLaterNameSlotOnly }),
    ],
    ["swarmui", "SwarmUI prompt images", true, takes("swarmui")],
    ["swarmui", "a SwarmUI workflow without a slot", false, takes("swarmui", { comfyWorkflow: textOnly })],
    ["swarmui", "a SwarmUI workflow with a slot", true, takes("swarmui", { comfyWorkflow: withReference })],
    ["swarmui", "SwarmUI refuses file-name slots", false, takes("swarmui", { comfyWorkflow: withNumberedName })],
    [
      "swarmui",
      "SwarmUI refuses a file-name slot next to a picture slot",
      false,
      takes("swarmui", { comfyWorkflow: withReferenceAndNameSlot }),
    ],
    [
      "swarmui",
      "a SwarmUI workflow with only a later slot never gets the picture",
      false,
      takes("swarmui", { comfyWorkflow: withLaterSlotOnly }),
    ],
    ["runpod_comfyui", "a RunPod workflow without a slot", false, takes("runpod_comfyui", { comfyWorkflow: textOnly })],
    [
      "runpod_comfyui",
      "a RunPod workflow with a slot",
      true,
      takes("runpod_comfyui", { comfyWorkflow: withReference }),
    ],
    [
      "runpod_comfyui",
      "a RunPod workflow with only a later slot never gets the picture",
      false,
      takes("runpod_comfyui", { comfyWorkflow: withLaterSlotOnly }),
    ],
  ];
  for (const [, label, expected, actual] of cases) assert.equal(actual, expected, label);

  // A backend added to generateImage needs its own entry here (and in the table).
  const source = readFileSync(
    new URL("../../packages/server/src/services/image/image-generation.ts", import.meta.url),
    "utf8",
  );
  const generate = source.slice(source.indexOf("export async function generateImage("));
  const dispatch = generate.slice(generate.indexOf("switch (resolvedSource)"), generate.indexOf("default:"));
  const backends = [...dispatch.matchAll(/case "([a-z0-9_]+)":/gu)].map((match) => match[1]!);
  assert.ok(backends.length >= 20, `generateImage dispatches every backend: ${backends.join(", ")}`);
  const covered = new Set(cases.map(([backend]) => backend));
  assert.deepEqual(
    backends.filter((backend) => !covered.has(backend)),
    [],
    "every backend generateImage calls is checked against its adapter",
  );
}

// ── An avatar edit on a connection that drops the picture is refused before anything is paid for ──
const db = await createFileNativeDB();
{
  const connections = createConnectionsStorage(db);
  const pollinations = await connections.create({
    name: "Pollinations",
    provider: "image_generation",
    imageService: "pollinations",
    model: "",
  } as never);
  await assert.rejects(resolveAvatarImageConnection(db, pollinations.id), (error: unknown) => {
    assert.ok(error instanceof AvatarGenerationError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, IMAGE_EDIT_UNSUPPORTED_MESSAGE);
    return true;
  });
  const gptImage = await connections.create({
    name: "GPT Image",
    provider: "image_generation",
    imageService: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-image-1",
  } as never);
  const resolved = await resolveAvatarImageConnection(db, gptImage.id);
  assert.equal(resolved.conn.id, gptImage.id, "a connection that edits pictures is used");
}

// ── Fallbacks for an edit, and SpicyAPI's per-model check ──
const sharp = await getSharp();
const picture = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 120, b: 90 } } })
  .png()
  .toBuffer();
const requests: string[] = [];
const server = createServer(async (request, response) => {
  for await (const _chunk of request) void _chunk;
  const url = request.url ?? "";
  requests.push(url);
  response.setHeader("content-type", "application/json");
  if (url.startsWith("/primary/")) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: { message: "primary is down" } }));
  } else if (url.startsWith("/spicy/api/v1/models/")) {
    const model = decodeURIComponent(url.slice("/spicy/api/v1/models/".length));
    const inputSchema = model.endsWith("/edit")
      ? { properties: { prompt: {}, image_urls: { maxItems: 1 } } }
      : { properties: { prompt: {}, width: {}, height: {} } };
    response.end(JSON.stringify({ code: 200, msg: "success", data: { model, inputSchema } }));
  } else if (url.startsWith("/spicy/")) {
    response.statusCode = 503;
    response.end(JSON.stringify({ code: 503, msg: "fixture stops here" }));
  } else {
    response.end(JSON.stringify({ data: [{ b64_json: picture.toString("base64") }] }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const warnings: string[] = [];
const warn = logger.warn.bind(logger);
(logger as { warn: unknown }).warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
};
try {
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  const fallback = (serviceHint: string, model: string) => ({
    connectionId: `fallback-${serviceHint}`,
    connectionName: `Fallback ${serviceHint}`,
    provider: "image_generation",
    source: model || serviceHint,
    baseUrl: `${base}/fallback/v1`,
    apiKey: "fixture-key",
    serviceHint,
    model,
  });
  const edit = (imageFallback: ReturnType<typeof fallback>) =>
    drawAvatarImageEdit({
      image: {
        conn: {
          id: "primary",
          provider: "image_generation",
          baseUrl: `${base}/primary/v1`,
          apiKey: "fixture-key",
          model: "gpt-image-1",
          imageService: "openai",
        } as never,
        fallback: imageFallback,
      },
      prompt: "Close both eyes.",
      source: { label: "neutral", png: picture, width: 64, height: 64, transparent: false, hash: "" },
      debug: false,
      logLabel: "pngtuber neutral eyes-closed",
    });

  requests.length = 0;
  await assert.rejects(edit(fallback("togetherai", "black-forest-labs/FLUX.1-schnell-Free")), /primary is down/u);
  assert.deepEqual(
    requests.filter((url) => url.startsWith("/fallback/")),
    [],
    "a fallback that would draw a new picture is never asked",
  );
  assert.ok(
    warnings.some((line) => line.includes("skipped fallback connection") && line.includes("fallback-togetherai")),
    "the skipped fallback is logged",
  );

  requests.length = 0;
  const kept = await edit(fallback("openai", "gpt-image-1"));
  assert.ok(kept.length > 0, "a fallback that edits pictures draws the edit");
  assert.deepEqual(
    requests.filter((url) => url.startsWith("/fallback/")),
    ["/fallback/v1/images/edits"],
    "the fallback is sent the picture",
  );

  // SpicyAPI reads the model's inputs first; a model without a picture input is refused before a task.
  const spicy = (model: string) =>
    generateImage("spicyapi", `${base}/spicy`, "fixture-key", "spicyapi", {
      prompt: "Close both eyes.",
      model,
      referenceImage: picture.toString("base64"),
      referenceIsCanvas: true,
      allowLocalUrls: true,
    });
  requests.length = 0;
  await assert.rejects(spicy("acme/text/text-to-image"), { message: IMAGE_EDIT_UNSUPPORTED_MESSAGE });
  assert.deepEqual(
    requests,
    ["/spicy/api/v1/models/acme/text/text-to-image"],
    "no task is created for a model that would redraw",
  );
  // A custom picture field is not the model's picture input: the edit is still refused before a task.
  requests.length = 0;
  await assert.rejects(
    generateImage("spicyapi", `${base}/spicy`, "fixture-key", "spicyapi", {
      prompt: "Close both eyes.",
      model: "acme/text/text-to-image",
      referenceImage: picture.toString("base64"),
      referenceIsCanvas: true,
      allowLocalUrls: true,
      imageDefaults: { customParameters: { image_url: "https://images.example.test/other.png" } } as never,
    }),
    { message: IMAGE_EDIT_UNSUPPORTED_MESSAGE },
  );
  assert.ok(!requests.some((url) => url.includes("createTask")), "no task for a custom picture field");
  // A picture too large to fit SpicyAPI's inline limit, and too broken to shrink, is dropped: the error says so
  // instead of claiming the model can't edit pictures, and no task is made.
  requests.length = 0;
  await assert.rejects(
    generateImage("spicyapi", `${base}/spicy`, "fixture-key", "spicyapi", {
      prompt: "Close both eyes.",
      model: "acme/picture/edit",
      referenceImage: Buffer.alloc(1_200_000, 7).toString("base64"),
      referenceIsCanvas: true,
      allowLocalUrls: true,
    }),
    { message: IMAGE_EDIT_REFERENCE_TOO_LARGE_MESSAGE },
  );
  assert.ok(!requests.some((url) => url.includes("createTask")), "no task for a picture that didn't fit");
  requests.length = 0;
  await assert.rejects(spicy("acme/picture/edit"), /fixture stops here/u);
  assert.ok(
    requests.some((url) => url.startsWith("/spicy/api/v1/jobs/createTask")),
    "a model with a picture input gets its task",
  );
} finally {
  (logger as { warn: unknown }).warn = warn;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dataDir, { recursive: true, force: true });
}
