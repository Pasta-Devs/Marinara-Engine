/**
 * #8022: NanoGPT's Nano Banana 2.1 takes a resolution tier and a separate aspect ratio.
 * #9560: every NanoGPT model gets the size, aspect ratio and reference pictures its entry in NanoGPT's
 * model list says it takes (Anima `1k`/`1.5k`, Chroma no pictures), the list is read once per endpoint,
 * and a model that refuses a negative prompt (Chroma, Qwen Image 3 Uncensored) is retried once without it.
 * Exercise the actual adapter over HTTP, including legacy models and another provider.
 * Contract checked against NanoGPT's public image-model metadata on 2026-10-22 and 2026-11-23 (the
 * entries below are copied from it, trimmed to the fields the adapter reads):
 * https://api.nano-gpt.com/api/v1/image-models?detailed=true
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  IMAGE_EDIT_UNSUPPORTED_MESSAGE,
  generateImage,
  type ImageGenRequest,
} from "../../packages/server/src/services/image/image-generation.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const modelList = {
  object: "list",
  data: [
    {
      id: "nano-banana-2.1",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: {
        resolutions: ["1k", "2k"],
        aspect_ratio: ["auto", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"].concat([
          "1:4",
          "4:1",
          "1:8",
          "8:1",
        ]),
        max_input_images: 14,
      },
    },
    {
      id: "nano-banana",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: {
        resolutions: ["auto"],
        aspect_ratio: ["auto", "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
        max_input_images: 4,
      },
    },
    {
      id: "nano-banana-2",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: {
        resolutions: ["1k", "2k", "4k"],
        aspect_ratio: ["auto", "1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
        max_input_images: 14,
      },
    },
    {
      id: "flux-2-pro",
      capabilities: { image_to_image: false },
      architecture: { input_modalities: ["text"] },
      supported_parameters: { resolutions: ["1024*1024", "1280*720", "720*1280", "1536*1024", "1024*1536"] },
    },
    {
      id: "gpt-image-1",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: { resolutions: ["1024x1024", "1536x1024", "1024x1536", "auto"], max_input_images: 4 },
    },
    {
      id: "anima/text-to-image",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: {
        resolutions: ["1k", "1.5k"],
        aspect_ratio: [
          "1:1",
          "1:2",
          "2:1",
          "1:3",
          "3:1",
          "2:3",
          "3:2",
          "3:4",
          "4:3",
          "4:5",
          "5:4",
          "9:16",
          "16:9",
        ].concat(["9:21", "21:9"]),
        max_input_images: 1,
      },
    },
    {
      id: "animagine-xl-31",
      capabilities: { image_to_image: true },
      architecture: { input_modalities: ["text", "image"] },
      supported_parameters: {
        resolutions: ["1024x1024", "1920x1088", "1088x1920", "768x1024", "1024x768", "1408x1024", "1024x1408"],
        max_input_images: 1,
      },
    },
    {
      id: "chroma",
      capabilities: { image_to_image: false },
      architecture: { input_modalities: ["text"] },
      supported_parameters: {
        resolutions: ["1024x1024", "1536x1024", "1024x1536", "512x512", "768x1024", "576x1024", "1024x768", "1024x576"],
      },
    },
    {
      id: "qwen-image-3-uncensored",
      capabilities: { image_to_image: false },
      architecture: { input_modalities: ["text"] },
      supported_parameters: {
        resolutions: ["1k", "2k"],
        aspect_ratio: ["1:1", "3:2", "16:9", "21:9", "9:16", "2:3", "3:4", "4:5"],
      },
    },
  ],
};
const names: Record<string, string> = {
  chroma: "Chroma",
  "anima/text-to-image": "Anima",
  "qwen-image-3-uncensored": "Qwen Image 3 Uncensored",
};
/** NanoGPT's own 400s for the parameters a listed model doesn't take (texts from the #9560 report). */
function rejection(body: Record<string, unknown>): Record<string, unknown> | null {
  const entry = modelList.data.find((candidate) => candidate.id === body.model);
  if (!entry || body.model === "nano-banana-2.1") return null;
  const name = names[String(body.model)] ?? String(body.model);
  const params: { resolutions: string[]; aspect_ratio?: string[]; max_input_images?: number } =
    entry.supported_parameters;
  const tiers = params.resolutions.filter((value) => /^\d+(?:\.\d+)?k$/.test(value));
  if (tiers.length && !tiers.includes(String(body.size))) {
    return { error: `${name} resolution must be ${tiers.join(" or ")}.`, code: "INVALID_RESOLUTION" };
  }
  if (tiers.length && params.aspect_ratio && !params.aspect_ratio.includes(String(body.aspect_ratio))) {
    return {
      error: `${name} does not support aspect_ratio ${String(body.aspect_ratio)}.`,
      code: "INVALID_IMAGE_PARAMETER",
    };
  }
  const pictures = body.imageDataUrls ? (body.imageDataUrls as unknown[]).length : body.imageDataUrl ? 1 : 0;
  if (pictures > (params.max_input_images ?? 0)) {
    return { error: `${name} does not support image input.`, code: "INVALID_IMAGE_PARAMETER" };
  }
  if (body.negative_prompt !== undefined && (body.model === "chroma" || body.model === "qwen-image-3-uncensored")) {
    return { error: `${name} does not support negative_prompt.`, code: "INVALID_IMAGE_PARAMETER" };
  }
  return null;
}
const supportedRatios = new Set([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
]);
const requests: Array<{ path: string; authorization?: string; body: Record<string, unknown> }> = [];
const listReads: string[] = [];
let releaseSlowList = () => {};
const slowList = new Promise<void>((resolve) => (releaseSlowList = resolve));
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  response.setHeader("content-type", "application/json");
  const path = request.url ?? "";
  if (request.method === "GET" && /\/v1\/image-models\?detailed=true$/.test(path)) {
    listReads.push(path);
    // `/nolist/` stands for an endpoint whose model list can't be read, `/slow/` for one still answering.
    if (path.startsWith("/nolist/")) response.statusCode = 503;
    if (path.startsWith("/slow/")) await slowList;
    response.end(JSON.stringify(/^\/(?:nano|slow)\//.test(path) ? modelList : { error: "unavailable" }));
    return;
  }
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push({ path, authorization: request.headers.authorization, body });
  const refused = path.startsWith("/nano/") ? rejection(body) : null;
  if (
    (path.startsWith("/nano/") || path.startsWith("/nolist/")) &&
    body.model === "nano-banana-2.1" &&
    (!["1k", "2k"].includes(String(body.size)) || !supportedRatios.has(String(body.aspect_ratio)))
  ) {
    response.statusCode = 400;
    response.end(
      JSON.stringify({ message: "Nano Banana 2.1 supports 1K or 2K resolution and a supported aspect ratio." }),
    );
  } else if (refused) {
    response.statusCode = 400;
    response.end(JSON.stringify(refused));
  } else response.end(JSON.stringify({ data: [{ b64_json: png }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const generate = async (overrides: Partial<ImageGenRequest> = {}, backend = "nanogpt") => {
    requests.length = 0;
    const result = await generateImage(
      backend,
      `http://127.0.0.1:${address.port}/${backend === "nanogpt" ? "nano" : "other"}/v1`,
      "fixture-key",
      backend,
      {
        model: "nano-banana-2.1",
        prompt: "a moonlit laboratory",
        negativePrompt: "letters",
        allowLocalUrls: true,
        ...overrides,
      },
    );
    assert.equal(result.base64, png);
    assert.equal(requests.length, 1, "Valid requests succeed without a retry");
    assert.equal(requests[0]!.authorization, "Bearer fixture-key");
    assert.equal(requests[0]!.path, `/${backend === "nanogpt" ? "nano" : "other"}/v1/images/generations`);
    if (backend === "nanogpt") {
      assert.equal(requests[0]!.body.prompt, "a moonlit laboratory");
      assert.equal(requests[0]!.body.negative_prompt, "letters");
    }
    return requests[0]!.body;
  };

  // The original avatar repro omits dimensions and should request the default square at 1K.
  assert.deepEqual(await generate(), {
    model: "nano-banana-2.1",
    prompt: "a moonlit laboratory",
    negative_prompt: "letters",
    n: 1,
    size: "1k",
    aspect_ratio: "1:1",
    response_format: "url",
  });
  const cases: Array<[width: number, height: number, size: string, ratio: string]> = [
    [512, 512, "1k", "1:1"],
    [1024, 1024, "1k", "1:1"],
    [1025, 1025, "2k", "1:1"],
    [2048, 2048, "2k", "1:1"],
    [4096, 4096, "2k", "1:1"],
    [1024, 1536, "2k", "2:3"],
    [1536, 1024, "2k", "3:2"],
    [1280, 720, "2k", "16:9"],
    [720, 1280, "2k", "9:16"],
    [896, 1280, "2k", "2:3"],
    [3072, 384, "2k", "8:1"],
    [384, 3072, "2k", "1:8"],
  ];
  for (const [width, height, size, ratio] of cases) {
    const body = await generate({ width, height });
    assert.equal(body.size, size, `${width}x${height}: tier`);
    assert.equal(body.aspect_ratio, ratio, `${width}x${height}: aspect ratio`);
  }
  const edit = await generate({ referenceImages: [png, png] });
  assert.deepEqual(edit.imageDataUrls, [`data:image/png;base64,${png}`, `data:image/png;base64,${png}`]);
  assert.equal(edit.size, "1k", "Edits use the same valid tier");
  assert.equal(edit.aspect_ratio, "1:1", "Edits retain the requested composition");
  const custom = await generate({
    width: 512,
    height: 512,
    imageDefaults: {
      version: 1,
      service: "api",
      seed: -1,
      customParameters: { size: "2k", aspect_ratio: "16:9", seed: 42 },
    },
  });
  assert.equal(custom.size, "2k", "Explicit connection parameters still override adapter defaults");
  assert.equal(custom.aspect_ratio, "16:9");
  assert.equal(custom.seed, 42);

  for (const [model, expected] of [
    // Models whose list entry has pixel sizes or only `auto`, or that the list doesn't name, keep their sizes.
    ["nano-banana", "768x1344"],
    ["nano-banana-2.10", "768x1344"],
    ["flux-2-pro", "1024x1536"],
    ["gpt-image-1", "1024x1536"],
  ]) {
    const body = await generate({ model, width: 1024, height: 1536 });
    assert.equal(body.size, expected, `${model}: existing NanoGPT dimensions are preserved`);
    assert.equal(body.aspect_ratio, undefined, `${model}: no Nano Banana 2.1-specific field`);
  }
  // Nano Banana 2 lists `1k`/`2k`/`4k` and aspect ratios, as 2.1 does.
  const nanoBanana2 = await generate({ model: "nano-banana-2", width: 1024, height: 1536 });
  assert.equal(nanoBanana2.size, "2k");
  assert.equal(nanoBanana2.aspect_ratio, "2:3");
  const otherProvider = await generate({ width: 1024, height: 1536 }, "openai");
  assert.equal(otherProvider.size, "1024x1536", "Another provider's Nano Banana request stays unchanged");
  assert.equal(otherProvider.aspect_ratio, undefined);
  await assert.rejects(
    generate({ imageDefaults: { version: 1, service: "api", seed: -1, customParameters: { size: "1024x1024" } } }),
    /NanoGPT image generation failed \(400\):.*Nano Banana 2.1 supports 1K or 2K/u,
    "An explicit invalid custom size surfaces the provider error instead of retrying generation",
  );
  assert.equal(requests.length, 1);

  // #9560: the shapes each model's list entry asks for.
  const scene = { width: 1344, height: 768, referenceImages: [png, png] };
  const anima = await generate({ model: "anima/text-to-image", ...scene });
  assert.equal(anima.size, "1.5k", "Anima gets its named size, not 1344x768");
  assert.equal(anima.aspect_ratio, "16:9", "and the shape, so it doesn't come back square");
  assert.equal(anima.imageDataUrl, `data:image/png;base64,${png}`, "Anima takes one reference picture");
  assert.equal(anima.imageDataUrls, undefined);
  const animaSquare = await generate({ model: "anima/text-to-image" });
  assert.equal(animaSquare.size, "1k");
  assert.equal(animaSquare.aspect_ratio, "1:1");
  const animagine = await generate({ model: "animagine-xl-31", ...scene, referenceImages: [png] });
  assert.equal(animagine.size, "1344x768", "Matching is by the whole model ID, so Animagine keeps pixel sizes");
  assert.ok(animagine.imageDataUrl);

  const nano = `http://127.0.0.1:${address.port}/nano/v1`;
  const posted = async (overrides: Partial<ImageGenRequest>, baseUrl = nano) => {
    requests.length = 0;
    const result = await generateImage("nanogpt", baseUrl, "fixture-key", "nanogpt", {
      prompt: "a moonlit laboratory",
      negativePrompt: "letters",
      allowLocalUrls: true,
      ...overrides,
    });
    assert.equal(result.base64, png);
    return requests.map((entry) => entry.body);
  };
  const [chromaFirst, chromaRetry, ...chromaExtra] = await posted({ model: "chroma", ...scene });
  assert.equal(chromaExtra.length, 0, "Chroma: one retry");
  assert.equal(chromaFirst!.negative_prompt, "letters", "The list doesn't say Chroma refuses a negative prompt");
  assert.equal(chromaFirst!.imageDataUrl ?? chromaFirst!.imageDataUrls, undefined, "Chroma gets no pictures");
  assert.equal(chromaFirst!.size, "1344x768");
  const { negative_prompt: _dropped, ...chromaRest } = chromaFirst!;
  assert.deepEqual(chromaRetry, chromaRest, "Only the negative prompt is dropped");
  const chromaAgain = await posted({ model: "chroma", ...scene });
  assert.equal(chromaAgain.length, 1, "The refusal is remembered, so the next picture needs no retry");
  assert.equal(chromaAgain[0]!.negative_prompt, undefined);

  const qwen = await posted({ model: "qwen-image-3-uncensored", ...scene });
  assert.equal(qwen.length, 2);
  assert.equal(qwen[1]!.size, "2k");
  assert.equal(qwen[1]!.aspect_ratio, "16:9");
  assert.equal(qwen[1]!.negative_prompt, undefined);
  assert.equal(qwen[1]!.imageDataUrl ?? qwen[1]!.imageDataUrls, undefined);

  requests.length = 0;
  await assert.rejects(
    generateImage("nanogpt", nano, "fixture-key", "nanogpt", {
      model: "chroma",
      prompt: "close the eyes",
      referenceImage: png,
      referenceIsCanvas: true,
      allowLocalUrls: true,
    }),
    (error: unknown) => error instanceof Error && error.message.includes(IMAGE_EDIT_UNSUPPORTED_MESSAGE),
    "An edit for a model with no picture input is refused before a paid call",
  );
  assert.equal(requests.length, 0);
  assert.deepEqual(
    listReads.filter((path) => path.startsWith("/nano/")),
    ["/nano/v1/image-models?detailed=true"],
    "The model list is read once per endpoint and cached",
  );

  // A negative prompt in the connection's custom parameters is dropped the same way.
  const customNegative = (model: string, negativePrompt?: string) =>
    posted(
      {
        model,
        negativePrompt,
        imageDefaults: { version: 1, service: "api", seed: -1, customParameters: { negative_prompt: "smudges" } },
      },
      `http://127.0.0.1:${address.port}/nano/custom/v1`,
    );
  const [chromaCustom, chromaCustomRetry, ...chromaCustomExtra] = await customNegative("chroma", "letters");
  assert.equal(chromaCustomExtra.length, 0, "Chroma with a custom negative prompt: one retry");
  assert.equal(chromaCustom!.negative_prompt, "smudges", "The custom parameter overrides the request's prompt");
  assert.equal(chromaCustomRetry!.negative_prompt, undefined, "The retry carries no negative prompt from either");
  const chromaCustomAgain = await customNegative("chroma");
  assert.equal(chromaCustomAgain.length, 1, "The remembered refusal covers the custom parameter too");
  assert.equal(chromaCustomAgain[0]!.negative_prompt, undefined);
  const qwenCustom = await customNegative("qwen-image-3-uncensored");
  assert.equal(qwenCustom.length, 2, "A negative prompt only in the custom parameters is retried too");
  assert.equal(qwenCustom[0]!.negative_prompt, "smudges");
  assert.equal(qwenCustom[1]!.negative_prompt, undefined);
  const animaCustom = await customNegative("anima/text-to-image");
  assert.equal(animaCustom.length, 1);
  assert.equal(animaCustom[0]!.negative_prompt, "smudges", "A model that takes a negative prompt keeps the custom one");

  // A cancelled request stops waiting for a model list that another request still waits on.
  const slowRequest = (signal?: AbortSignal) =>
    generateImage("nanogpt", `http://127.0.0.1:${address.port}/slow/v1`, "fixture-key", "nanogpt", {
      model: "anima/text-to-image",
      prompt: "a moonlit laboratory",
      width: 1344,
      height: 768,
      allowLocalUrls: true,
      signal,
    });
  requests.length = 0;
  const cancel = new AbortController();
  const cancelled = slowRequest(cancel.signal);
  const waiting = slowRequest();
  void waiting.catch(() => undefined); // A failed assertion below reports itself, not this request.
  while (!listReads.some((path) => path.startsWith("/slow/"))) await new Promise((resolve) => setTimeout(resolve, 5));
  cancel.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settled = await Promise.race([
    cancelled.then(
      () => "drawn",
      () => "cancelled",
    ),
    new Promise((resolve) => (timer = setTimeout(resolve, 2_000, "still waiting"))),
  ]);
  clearTimeout(timer);
  assert.equal(settled, "cancelled", "A cancelled request doesn't wait out the list read's 15-second timeout");
  releaseSlowList();
  assert.equal((await waiting).base64, png);
  assert.equal(requests.length, 1, "Only the request that wasn't cancelled is sent");
  assert.equal(requests[0]!.body.size, "1.5k", "and it still gets the list");
  assert.deepEqual(
    listReads.filter((path) => path.startsWith("/slow/")),
    ["/slow/v1/image-models?detailed=true"],
  );

  // A list that can't be read keeps today's requests, and Nano Banana 2.1's known contract.
  const nolist = `http://127.0.0.1:${address.port}/nolist/v1`;
  const [fallback] = await posted({ model: "nano-banana-2.1", width: 1536, height: 1024 }, nolist);
  assert.equal(fallback!.size, "2k");
  assert.equal(fallback!.aspect_ratio, "3:2");
  assert.equal(fallback!.negative_prompt, "letters");
  const [unlisted] = await posted({ model: "anima/text-to-image", ...scene }, nolist);
  assert.equal(unlisted!.size, "1344x768");
  assert.equal((unlisted!.imageDataUrls as unknown[]).length, 2);
} finally {
  releaseSlowList();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info(
  "NanoGPT image requests follow each model's list entry, and keep their old shape when the list can't be read.",
);
