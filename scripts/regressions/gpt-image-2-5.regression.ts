import assert from "node:assert/strict";
import { createServer } from "node:http";
import { MODEL_LISTS } from "../../packages/shared/src/constants/model-lists.js";
import { imageGenerationQualitySchema } from "../../packages/shared/src/schemas/connection.schema.js";
import { isOpenAIGptImageModel, isOpenAIGptImage25Model } from "../../packages/shared/src/utils/openai-image.js";
import {
  buildOpenRouterImagesRequest,
  generateImage,
  type ImageGenRequest,
} from "../../packages/server/src/services/image/image-generation.js";
import { resolveConnectionImageQuality } from "../../packages/server/src/services/image/image-generation-defaults.js";
import { resolveImageConnectionFallback } from "../../packages/server/src/services/generation/media-connection-fallback.js";
import {
  createConnectionExportEnvelope,
  normalizeImportedConnectionEntry,
} from "../../packages/client/src/lib/connection-transfer.js";
import {
  resolveSpriteNativeTransparency,
  resolveSpriteSheetCanvas,
} from "../../packages/server/src/routes/sprites.routes.js";

const models = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"];
for (const model of models) {
  assert.ok(MODEL_LISTS.image_generation.some((entry) => entry.id === model));
  for (const id of [model, `${model}-2026-09-08`]) {
    assert.ok(isOpenAIGptImageModel(id));
    assert.ok(isOpenAIGptImage25Model(id));
    assert.equal(resolveSpriteNativeTransparency(id, true), true);
    assert.equal(resolveSpriteNativeTransparency(id, false), false);
    assert.deepEqual(resolveSpriteSheetCanvas({ cols: 3, rows: 2, spriteType: "portrait", model: id }), {
      sheetWidth: 1536,
      sheetHeight: 1024,
      cellWidth: 512,
      cellHeight: 512,
    });
    for (const quality of ["auto", "low", "medium", "high", "xhigh", "max"]) {
      assert.equal(imageGenerationQualitySchema.parse(quality), quality);
      assert.equal(resolveConnectionImageQuality({ model: id, imageGenerationQuality: quality }), quality);
      const exported = createConnectionExportEnvelope([
        {
          name: "Image connection",
          provider: "image_generation",
          model: id,
          imageGenerationQuality: quality,
        },
      ]);
      assert.equal(exported.connections[0]?.imageGenerationQuality, quality);
      assert.equal(
        normalizeImportedConnectionEntry(exported.connections[0])?.connection.imageGenerationQuality,
        quality,
      );
    }
  }
}
for (const model of ["gpt-image-2.5", "gpt-image-2.50-flare", "gpt-image-2.5-flarex", "dall-e-3", ""]) {
  assert.equal(isOpenAIGptImage25Model(model), false);
  assert.equal(isOpenAIGptImageModel(model), false);
}
for (const model of ["gpt-image-1", "gpt-image-1-mini", "gpt-image-1.5", "gpt-image-2", "gpt-image-2-preview"]) {
  assert.ok(isOpenAIGptImageModel(model));
  assert.equal(resolveConnectionImageQuality({ model, imageGenerationQuality: "max" }), "auto");
  assert.equal(resolveConnectionImageQuality({ model, imageGenerationQuality: "high" }), "high");
}
assert.equal(imageGenerationQualitySchema.safeParse("ultra").success, false);
assert.equal(resolveSpriteNativeTransparency("gpt-image-2", true), false);
for (const model of ["gpt-image-2.5-flare", "gpt-image-2"]) {
  const fallback = await resolveImageConnectionFallback(
    {
      getFallbackForImageGeneration: async () => ({
        id: "fallback",
        provider: "image_generation",
        baseUrl: "https://api.openai.com/v1",
        model,
        imageGenerationQuality: "max",
      }),
    },
    "primary",
  );
  assert.equal(fallback?.quality, model === "gpt-image-2" ? "auto" : "max");
}

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<{ path: string; contentType: string; body: Buffer }> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push({
    path: request.url ?? "",
    contentType: request.headers["content-type"] ?? "",
    body: Buffer.concat(chunks),
  });
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ data: [{ b64_json: png }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const generate = async (request: Partial<ImageGenRequest>) => {
    const result = await generateImage("openai", `http://127.0.0.1:${address.port}/v1`, "fixture-key", "openai", {
      model: models[0],
      prompt: "a moonlit laboratory",
      width: 1536,
      height: 864,
      quality: "max",
      transparentBackground: true,
      allowLocalUrls: true,
      ...request,
    });
    assert.equal(result.base64, png);
    const captured = requests.pop();
    assert.ok(captured);
    assert.equal(requests.length, 0, "Each call must make exactly one provider request");
    return captured;
  };

  for (const model of models) {
    const generation = await generate({ model, quality: "xhigh" });
    assert.equal(generation.path, "/v1/images/generations");
    assert.deepEqual(JSON.parse(generation.body.toString()), {
      model,
      prompt: "a moonlit laboratory",
      n: 1,
      size: "1536x864",
      output_format: "png",
      quality: "xhigh",
      background: "transparent",
    });

    const edit = await generate({ model, referenceImages: [png, `data:image/png;base64,${png}`] });
    assert.equal(edit.path, "/v1/images/edits");
    const form = await new Response(new Uint8Array(edit.body), {
      headers: { "content-type": edit.contentType },
    }).formData();
    for (const [key, value] of Object.entries({
      model,
      size: "1536x864",
      quality: "max",
      output_format: "png",
      background: "transparent",
    }))
      assert.equal(form.get(key), value);
    assert.equal(form.has("response_format"), false);
    const references = form.getAll("image[]");
    assert.equal(references.length, 2);
    for (const reference of references) {
      assert.ok(reference instanceof File);
      assert.equal(reference.type, "image/png");
      assert.equal(Buffer.from(await reference.arrayBuffer()).toString("base64"), png);
    }
  }

  // Exercise the serialized request, including API bounds and exact preservation of valid canvases.
  for (const [width, height] of [
    [1024, 640],
    [3840, 2160],
    [2160, 3840],
    [1536, 864],
    [864, 1536],
    [1, 1],
    [512, 512],
    [1024, 576],
    [999, 777],
    [4096, 4096],
    [4096, 256],
    [256, 4096],
    [10_000, 20_000],
    [Number.MAX_VALUE, 1],
    [NaN, -1],
  ]) {
    const response = await generate({ width, height });
    const size = JSON.parse(response.body.toString()).size as string;
    const [outWidth, outHeight] = size.split("x").map(Number);
    assert.ok(outWidth && outHeight, size);
    assert.equal(outWidth % 16, 0, size);
    assert.equal(outHeight % 16, 0, size);
    assert.ok(Math.max(outWidth, outHeight) <= 3840, size);
    assert.ok(outWidth * outHeight >= 655_360 && outWidth * outHeight <= 8_294_400, size);
    assert.ok(outWidth / outHeight >= 1 / 3 && outWidth / outHeight <= 3, size);
    if (
      width % 16 === 0 &&
      height % 16 === 0 &&
      width * height >= 655_360 &&
      width * height <= 8_294_400 &&
      Math.max(width, height) <= 3840 &&
      width / height >= 1 / 3 &&
      width / height <= 3
    )
      assert.equal(size, `${width}x${height}`);
  }

  for (const model of ["gpt-image-1.5", "gpt-image-2", "dall-e-3"]) {
    const response = await generate({ model });
    const body = JSON.parse(response.body.toString());
    assert.equal(body.quality, model === "dall-e-3" ? undefined : "auto");
    assert.equal(body.background, model === "gpt-image-1.5" ? "transparent" : undefined);
    assert.equal(body.size, model === "gpt-image-1.5" ? "1536x1024" : model === "dall-e-3" ? "1792x1024" : "1536x864");
    assert.equal(body.response_format, model === "dall-e-3" ? "b64_json" : undefined);
  }
  for (const model of ["openai/gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]) {
    assert.equal(buildOpenRouterImagesRequest({ model, prompt: "test", quality: "max" }).quality, "max");
  }
  assert.equal(
    buildOpenRouterImagesRequest({ model: "openai/gpt-image-2", prompt: "test", quality: "max" }).quality,
    "auto",
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("GPT Image 2.5 regression passed");
