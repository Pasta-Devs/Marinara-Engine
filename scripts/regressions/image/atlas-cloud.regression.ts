// Atlas Cloud image and video generation: the API URL, request bodies, prediction responses and the model lists.
import assert from "node:assert/strict";
import {
  buildAtlasCloudImageRequest,
  buildAtlasCloudUrl,
  buildAtlasCloudVideoRequest,
  parseAtlasCloudPrediction,
} from "../../../packages/server/src/services/media/atlas-cloud.js";
import {
  ATLAS_CLOUD_IMAGE_MODELS,
  ATLAS_CLOUD_VIDEO_MODELS,
} from "../../../packages/shared/src/constants/model-lists.js";

assert.equal(
  buildAtlasCloudUrl("https://api.atlascloud.ai/v1/", "generateImage"),
  "https://api.atlascloud.ai/api/v1/model/generateImage",
);
assert.equal(
  buildAtlasCloudUrl("https://api.atlascloud.ai/api/v1/model", "prediction/prediction-123"),
  "https://api.atlascloud.ai/api/v1/model/prediction/prediction-123",
);
assert.deepEqual(
  buildAtlasCloudImageRequest({
    model: "google/nano-banana/text-to-image",
    prompt: "marinara laboratory",
    width: 1600,
    height: 900,
  }),
  {
    model: "google/nano-banana/text-to-image",
    prompt: "marinara laboratory",
    aspect_ratio: "16:9",
  },
);
assert.deepEqual(
  buildAtlasCloudImageRequest({
    model: "black-forest-labs/flux-kontext-pro/image-to-image",
    prompt: "add blue light",
    width: 1024,
    height: 768,
    referenceImageDataUrl: "data:image/png;base64,atlas-reference",
  }),
  {
    model: "black-forest-labs/flux-kontext-pro/image-to-image",
    prompt: "add blue light",
    size: "1024*768",
    image: "data:image/png;base64,atlas-reference",
  },
);
assert.deepEqual(
  buildAtlasCloudVideoRequest({
    model: "google/veo3.1/image-to-video",
    prompt: "slow camera push",
    durationSeconds: 8,
    aspectRatio: "16:9",
    resolution: "720p",
    referenceImageDataUrl: "data:image/png;base64,atlas-reference",
  }),
  {
    model: "google/veo3.1/image-to-video",
    prompt: "slow camera push",
    duration: 8,
    aspect_ratio: "16:9",
    resolution: "720p",
    image: "data:image/png;base64,atlas-reference",
  },
);
assert.deepEqual(parseAtlasCloudPrediction({ data: { id: "prediction-123", status: "processing" } }), {
  id: "prediction-123",
  status: "processing",
  output: null,
  error: null,
});
assert.deepEqual(
  parseAtlasCloudPrediction({ data: { status: "completed", outputs: ["https://cdn.example/out.mp4"] } }),
  {
    id: null,
    status: "completed",
    output: "https://cdn.example/out.mp4",
    error: null,
  },
);
assert.ok(ATLAS_CLOUD_IMAGE_MODELS.some((model) => model.id === "google/nano-banana/text-to-image"));
assert.ok(ATLAS_CLOUD_VIDEO_MODELS.some((model) => model.id === "google/veo3.1/text-to-video"));
