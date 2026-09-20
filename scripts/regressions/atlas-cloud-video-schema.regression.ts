import assert from "node:assert/strict";
import {
  adaptAtlasCloudVideoRequest,
  atlasCloudSchemaRequiresImage,
  buildAtlasCloudModelSchemaUrl,
  parseAtlasCloudModelSchema,
} from "../../packages/server/src/services/media/atlas-cloud-video-schema.js";

// Atlas Cloud models do not share one input shape. Each fixture below mirrors the published
// `Input` schema of a real model family so the request Marinara sends is one that model accepts.

function inputSchema(required: string[], properties: Record<string, unknown>) {
  const schema = parseAtlasCloudModelSchema({ components: { schemas: { Input: { required, properties } } } });
  assert.ok(schema, "fixture schema should parse");
  return schema;
}

const reference = "data:image/png;base64,first-frame";
const common = { prompt: " slow push-in ", durationSeconds: 8, aspectRatio: "16:9", resolution: "720p" } as const;

assert.equal(
  buildAtlasCloudModelSchemaUrl("alibaba/wan-2.6/image-to-video-flash"),
  "https://static.atlascloud.ai/model/schema/alibaba-wan-2.6-image-to-video-flash.json",
);
assert.equal(buildAtlasCloudModelSchemaUrl("../secrets"), null);
assert.equal(buildAtlasCloudModelSchemaUrl("vendor/../../model"), null);
assert.equal(buildAtlasCloudModelSchemaUrl("https://example.test/model"), null);
assert.equal(buildAtlasCloudModelSchemaUrl("no-namespace"), null);
assert.equal(parseAtlasCloudModelSchema({ components: { schemas: {} } }), null);
assert.equal(parseAtlasCloudModelSchema("not a document"), null);

// Required `size` replaces resolution and aspect ratio, and the duration list has no 8.
const sizeOnly = inputSchema(["model", "prompt", "size"], {
  model: { type: "string" },
  prompt: { type: "string" },
  duration: { type: "integer", enum: [5, 10] },
  size: { type: "string", enum: ["832*480", "480*832", "1280*720", "720*1280", "1920*1080", "1080*1920"] },
});
const sizeOnlyRequest = adaptAtlasCloudVideoRequest(
  { ...common, model: "alibaba/wan-2.5/text-to-video", referenceImageDataUrl: reference },
  sizeOnly,
);
assert.deepEqual(sizeOnlyRequest.body, {
  model: "alibaba/wan-2.5/text-to-video",
  prompt: "slow push-in",
  duration: 10,
  size: "1280*720",
});
assert.ok(
  sizeOnlyRequest.adjustments.some((note) => note.includes("does not accept a reference image")),
  "dropping the source illustration must be reported",
);
assert.equal(sizeOnlyRequest.referenceImageDropped, true);
assert.equal(atlasCloudSchemaRequiresImage(sizeOnly), false);
assert.equal(
  adaptAtlasCloudVideoRequest({ ...common, model: "m/t2v", aspectRatio: "9:16", resolution: "1080p" }, sizeOnly).body
    .size,
  "1080*1920",
);

// A ranged duration and a resolution list without 480p.
const ranged = inputSchema(["model", "image", "prompt", "resolution"], {
  model: { type: "string" },
  image: { type: "string" },
  prompt: { type: "string" },
  duration: { type: "integer", minimum: 5, maximum: 15 },
  resolution: { type: "string", enum: ["720p", "1080p"] },
});
assert.deepEqual(
  adaptAtlasCloudVideoRequest(
    { ...common, model: "alibaba/wan-2.6/image-to-video-flash", durationSeconds: 3, resolution: "480p" },
    ranged,
  ).body,
  { model: "alibaba/wan-2.6/image-to-video-flash", prompt: "slow push-in", duration: 5, resolution: "720p" },
);
assert.equal(atlasCloudSchemaRequiresImage(ranged), true);
assert.equal(
  adaptAtlasCloudVideoRequest({ ...common, model: "m/i2v", referenceImageDataUrl: reference }, ranged).body.image,
  reference,
);

// A segmented model takes the prompt as a list and only generates five-second segments.
const segmented = inputSchema(["model", "prompt", "image"], {
  model: { type: "string" },
  prompt: { type: "array" },
  image: { type: "string" },
  duration: { type: "integer", minimum: 5, maximum: 5 },
  resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
});
assert.deepEqual(
  adaptAtlasCloudVideoRequest({ ...common, model: "atlascloud/wan-2.2-turbo/infinite-image-to-video" }, segmented).body,
  {
    model: "atlascloud/wan-2.2-turbo/infinite-image-to-video",
    prompt: ["slow push-in"],
    duration: 5,
    resolution: "720p",
  },
);

// `image_url`, no duration or resolution field at all: undeclared fields are left to the model.
const imageUrl = inputSchema(["model", "prompt", "image_url"], {
  model: { type: "string" },
  prompt: { type: "string" },
  image_url: { type: "string" },
  num_frames: { type: "integer", minimum: 25, maximum: 257 },
});
assert.deepEqual(
  adaptAtlasCloudVideoRequest(
    { ...common, model: "ltx-2.3-quality/image-to-video", referenceImageDataUrl: reference },
    imageUrl,
  ).body,
  { model: "ltx-2.3-quality/image-to-video", prompt: "slow push-in", image_url: reference },
);
assert.equal(atlasCloudSchemaRequiresImage(imageUrl), true);

// `ratio`, a string-typed duration, provider-cased resolutions, and an image list.
const ratioModel = inputSchema(["model", "prompt"], {
  model: { type: "string" },
  prompt: { type: "string" },
  duration: { type: "string", enum: ["-1", "4", "6", "12"] },
  ratio: { type: "string", enum: ["adaptive", "16:9", "9:16"] },
  resolution: { type: "string", enum: ["480P", "768P", "4k-sr"] },
  images: { type: "array" },
});
assert.deepEqual(
  adaptAtlasCloudVideoRequest({ ...common, model: "vendor/ratio-model", referenceImageDataUrl: reference }, ratioModel)
    .body,
  {
    model: "vendor/ratio-model",
    prompt: "slow push-in",
    duration: "6",
    resolution: "768P",
    ratio: "16:9",
    images: [reference],
  },
);

// An aspect ratio the model does not offer is left to the provider instead of being sent anyway.
const squareOnly = inputSchema(["model", "prompt"], {
  model: { type: "string" },
  prompt: { type: "string" },
  aspect_ratio: { type: "string", enum: ["1:1"] },
});
const squareRequest = adaptAtlasCloudVideoRequest({ ...common, model: "vendor/square" }, squareOnly);
assert.equal("aspect_ratio" in squareRequest.body, false);
assert.ok(squareRequest.adjustments.some((note) => note.includes("aspect ratio 16:9 is not offered")));

assert.throws(() => adaptAtlasCloudVideoRequest({ ...common, model: "  " }, ranged), /requires a model/);

console.log("atlas-cloud-video-schema regression passed");
