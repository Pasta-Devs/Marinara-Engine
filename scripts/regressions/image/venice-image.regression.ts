// Venice image generation: the API URL, the request body, the response and the model list.
import assert from "node:assert/strict";
import {
  buildVeniceApiUrl,
  buildVeniceImageRequest,
  normalizeVeniceImageModels,
  parseVeniceImageResponse,
} from "../../../packages/server/src/services/image/venice-image.js";

assert.equal(
  buildVeniceApiUrl("https://api.venice.ai/api/v1", "models"),
  "https://api.venice.ai/api/v1/models?type=image",
);
assert.deepEqual(buildVeniceImageRequest({ model: "venice-sd35", prompt: "canal", width: 1600, height: 900 }), {
  model: "venice-sd35",
  prompt: "canal",
  format: "webp",
  return_binary: false,
  safe_mode: false,
  variants: 1,
  width: 1280,
  height: 720,
});
assert.deepEqual(buildVeniceImageRequest({ model: "gpt-image-2", prompt: "canal", width: 1536, height: 1024 }), {
  model: "gpt-image-2",
  prompt: "canal",
  format: "webp",
  return_binary: false,
  safe_mode: false,
  variants: 1,
  aspect_ratio: "3:2",
  resolution: "2K",
});
const tinyVenicePng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
assert.equal(parseVeniceImageResponse({ images: [tinyVenicePng] }).mimeType, "image/png");
assert.deepEqual(
  normalizeVeniceImageModels({
    data: [
      { id: "chroma", type: "image", model_spec: { name: "Chroma" } },
      { id: "llama", type: "text", model_spec: { name: "Llama" } },
      { id: "untyped", model_spec: { name: "Untyped" } },
    ],
  }),
  [{ id: "chroma", name: "Chroma" }],
);
