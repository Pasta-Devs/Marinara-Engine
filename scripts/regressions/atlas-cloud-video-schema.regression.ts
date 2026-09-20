import assert from "node:assert/strict";
import {
  adaptAtlasCloudVideoRequest,
  atlasCloudSchemaRequiresImage,
  buildAtlasCloudModelSchemaUrl,
  describeAtlasCloudModelLimits,
  listAtlasCloudModelOptionFields,
  parseAtlasCloudModelSchema,
} from "../../packages/server/src/services/media/atlas-cloud-video-schema.js";
import {
  buildAtlasCloudCatalogUrl,
  parseAtlasCloudCatalog,
} from "../../packages/server/src/services/media/atlas-cloud.js";

import { normalizeVideoGenerationProfile } from "../../packages/shared/src/constants/video-generation-defaults.js";

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

// Model options: the editor lists every input Marinara does not fill itself, and the request carries
// only the saved values that model declares and accepts.
const optionModel = inputSchema(["model", "image", "prompt", "resolution"], {
  model: { type: "string" },
  image: { type: "string" },
  prompt: { type: "string" },
  duration: { type: "integer", minimum: 5, maximum: 15 },
  resolution: { type: "string", enum: ["720p", "1080p"] },
  negative_prompt: { type: "string", description: "  What to avoid.  " },
  enable_prompt_expansion: { type: "boolean", default: true },
  shot_type: { type: "string", enum: ["multi", "single"], default: "multi" },
  seed: { type: "integer", default: -1, minimum: -1, maximum: 2147483647 },
  guidance_scale: { type: "number", minimum: 1, maximum: 10 },
  loras: { type: "array" },
});
assert.deepEqual(
  listAtlasCloudModelOptionFields(optionModel).map((field) => [field.name, field.type, field.default]),
  [
    ["negative_prompt", "string", undefined],
    ["enable_prompt_expansion", "boolean", true],
    ["shot_type", "string", "multi"],
    ["seed", "integer", -1],
    ["guidance_scale", "number", undefined],
    ["loras", "json", undefined],
  ],
);
assert.equal(listAtlasCloudModelOptionFields(optionModel)[0]?.description, "What to avoid.");
assert.deepEqual(describeAtlasCloudModelLimits(optionModel), {
  durations: null,
  minDurationSeconds: 5,
  maxDurationSeconds: 15,
  resolutions: ["720p", "1080p"],
  sizes: null,
  aspectRatios: null,
  acceptsReferenceImage: true,
  requiresReferenceImage: true,
});
assert.deepEqual(describeAtlasCloudModelLimits(sizeOnly).durations, [5, 10]);
assert.equal(describeAtlasCloudModelLimits(sizeOnly).acceptsReferenceImage, false);

const optionRequest = adaptAtlasCloudVideoRequest(
  {
    ...common,
    model: "alibaba/wan-2.6/image-to-video-flash",
    referenceImageDataUrl: reference,
    modelOptions: {
      enable_prompt_expansion: false,
      shot_type: "single",
      negative_prompt: "blurry",
      seed: 42,
      guidance_scale: 7.5,
      loras: [{ path: "motion.safetensors", scale: 1 }],
      // Rejected: managed by Marinara, unknown to the model, or outside what the model accepts.
      prompt: "override",
      image: "https://example.test/other.png",
      resolution: "1080p",
      made_up: true,
    },
  },
  optionModel,
);
assert.deepEqual(optionRequest.body, {
  model: "alibaba/wan-2.6/image-to-video-flash",
  prompt: "slow push-in",
  duration: 8,
  resolution: "720p",
  image: reference,
  enable_prompt_expansion: false,
  shot_type: "single",
  negative_prompt: "blurry",
  seed: 42,
  guidance_scale: 7.5,
  loras: [{ path: "motion.safetensors", scale: 1 }],
});
for (const rejected of ["prompt", "image", "resolution", "made_up"]) {
  assert.ok(
    optionRequest.adjustments.some((note) => note.startsWith(`option ${rejected} was not sent`)),
    `${rejected} must be reported as not sent`,
  );
}
const invalidOptions = adaptAtlasCloudVideoRequest(
  {
    ...common,
    model: "m/i2v",
    modelOptions: { shot_type: "triple", seed: 1.5, guidance_scale: 11, enable_prompt_expansion: "yes", loras: "x" },
  },
  optionModel,
);
assert.deepEqual(Object.keys(invalidOptions.body).sort(), ["duration", "model", "prompt", "resolution"]);
assert.equal(invalidOptions.adjustments.filter((note) => note.startsWith("option ")).length, 5);

// Saved options survive normalization per model; malformed names, values, and empty models are dropped.
const normalized = normalizeVideoGenerationProfile({
  service: "atlas",
  atlas: {
    durationSeconds: 5,
    modelOptions: {
      "alibaba/wan-2.6/image-to-video-flash": {
        shot_type: "single",
        generate_audio: false,
        seed: 7,
        loras: [{ path: "a" }],
        "motion-strength.v2": 0.5,
        prototype: "cinematic",
        ["x".repeat(65)]: 1,
        ["__proto__"]: 1,
        constructor: 1,
        nothing: null,
        infinite: Number.POSITIVE_INFINITY,
      },
      "vendor/empty": { ["x".repeat(65)]: 1 },
      "  ": { seed: 1 },
    },
  },
}).profile;
assert.deepEqual(normalized.atlas.modelOptions, {
  "alibaba/wan-2.6/image-to-video-flash": {
    shot_type: "single",
    generate_audio: false,
    seed: 7,
    loras: [{ path: "a" }],
    "motion-strength.v2": 0.5,
    prototype: "cinematic",
  },
});
assert.equal(
  Object.getPrototypeOf(normalized.atlas.modelOptions["alibaba/wan-2.6/image-to-video-flash"]),
  Object.prototype,
);
assert.deepEqual(
  normalizeVideoGenerationProfile({ service: "atlas", atlas: { durationSeconds: 5 } }).profile.atlas.modelOptions,
  {},
);

// Ordinary schema inputs named `prototype` are safe; inherited object keys are not inputs.
const objectInput = { ...common, model: "vendor/model" };
const objectOptions = parseAtlasCloudModelSchema({
  properties: {
    prompt: { type: "string" },
    prototype: { type: "string" },
    metadata: { type: "object" },
    ["__proto__"]: { type: "string" },
    constructor: { type: "string" },
  },
});
assert.ok(objectOptions);
assert.deepEqual(
  listAtlasCloudModelOptionFields(objectOptions).map((field) => field.name),
  ["prototype", "metadata"],
);
assert.deepEqual(
  adaptAtlasCloudVideoRequest(
    { ...objectInput, modelOptions: { prototype: "cinematic", metadata: { scene: 1 } } },
    objectOptions,
  ).body,
  { model: objectInput.model, prompt: common.prompt.trim(), prototype: "cinematic", metadata: { scene: 1 } },
);
for (const metadata of [null, [], "scene", 1, true]) {
  const invalidObject = adaptAtlasCloudVideoRequest({ ...objectInput, modelOptions: { metadata } }, objectOptions);
  assert.equal(Object.hasOwn(invalidObject.body, "metadata"), false);
  assert.ok(invalidObject.adjustments.some((note) => note.includes("expected an object")));
}

// Fetch Models reads the live catalog: only generation models of the requested kind, hidden entries
// skipped, image-to-video ahead of text-to-video because every scene video animates an image.
assert.equal(buildAtlasCloudCatalogUrl("https://api.atlascloud.ai/v1/"), "https://api.atlascloud.ai/api/v1/models");
assert.equal(buildAtlasCloudCatalogUrl("https://api.atlascloud.ai"), "https://api.atlascloud.ai/api/v1/models");
const catalog = {
  data: [
    { model: "vendor/chat", displayName: "Chat", categories: ["LLM"] },
    {
      model: "vendor/t2v",
      displayName: "Text Clip",
      categories: ["TEXT-TO-VIDEO"],
      price: { actual: { base_price: "0.05" } },
    },
    {
      model: "vendor/i2v",
      displayName: "Image Clip",
      categories: ["IMAGE-TO-VIDEO"],
      price: { actual: { base_price: "0.018" } },
    },
    { model: "vendor/i2v", displayName: "Duplicate", categories: ["IMAGE-TO-VIDEO"] },
    { model: "vendor/hidden", displayName: "Hidden", categories: ["IMAGE-TO-VIDEO"], display_console: false },
    { model: "vendor/upscale", displayName: "Upscale", categories: ["VIDEO-TO-VIDEO"] },
    {
      model: "vendor/t2i",
      displayName: "Still",
      categories: ["TEXT-TO-IMAGE"],
      price: { actual: { base_price: "0.01" } },
    },
    { displayName: "No ID", categories: ["IMAGE-TO-VIDEO"] },
  ],
};
assert.deepEqual(parseAtlasCloudCatalog(catalog, "video"), [
  { id: "vendor/i2v", name: "Image Clip · image-to-video · from $0.018/s" },
  { id: "vendor/t2v", name: "Text Clip · text-to-video · from $0.05/s" },
]);
assert.deepEqual(parseAtlasCloudCatalog(catalog, "image"), [{ id: "vendor/t2i", name: "Still · text-to-image" }]);
assert.deepEqual(parseAtlasCloudCatalog({ error: "nope" }, "video"), []);

console.log("atlas-cloud-video-schema regression passed");
