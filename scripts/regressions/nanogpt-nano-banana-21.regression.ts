/**
 * #8022: NanoGPT's Nano Banana 2.1 takes a resolution tier and a separate aspect ratio.
 * Exercise the actual adapter over HTTP, including legacy models and another provider.
 * Contract checked against NanoGPT's public image-model metadata on 2026-10-22:
 * https://api.nano-gpt.com/api/v1/image-models?detailed=true
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateImage, type ImageGenRequest } from "../../packages/server/src/services/image/image-generation.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
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
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push({ path: request.url ?? "", authorization: request.headers.authorization, body });
  response.setHeader("content-type", "application/json");
  if (
    request.url?.startsWith("/nano/") &&
    body.model === "nano-banana-2.1" &&
    (!["1k", "2k"].includes(String(body.size)) || !supportedRatios.has(String(body.aspect_ratio)))
  ) {
    response.statusCode = 400;
    response.end(
      JSON.stringify({ message: "Nano Banana 2.1 supports 1K or 2K resolution and a supported aspect ratio." }),
    );
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
    ["nano-banana", "768x1344"],
    ["nano-banana-2", "768x1344"],
    ["nano-banana-2.10", "768x1344"],
    ["flux-2-pro", "1024x1536"],
    ["gpt-image-1", "1024x1536"],
  ]) {
    const body = await generate({ model, width: 1024, height: 1536 });
    assert.equal(body.size, expected, `${model}: existing NanoGPT dimensions are preserved`);
    assert.equal(body.aspect_ratio, undefined, `${model}: no Nano Banana 2.1-specific field`);
  }
  const otherProvider = await generate({ width: 1024, height: 1536 }, "openai");
  assert.equal(otherProvider.size, "1024x1536", "Another provider's Nano Banana request stays unchanged");
  assert.equal(otherProvider.aspect_ratio, undefined);
  await assert.rejects(
    generate({ imageDefaults: { version: 1, service: "api", seed: -1, customParameters: { size: "1024x1024" } } }),
    /NanoGPT image generation failed \(400\):.*Nano Banana 2.1 supports 1K or 2K/u,
    "An explicit invalid custom size surfaces the provider error instead of retrying generation",
  );
  assert.equal(requests.length, 1);
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info(
  "NanoGPT Nano Banana 2.1 uses supported resolution tiers and aspect ratios without changing other models/providers.",
);
