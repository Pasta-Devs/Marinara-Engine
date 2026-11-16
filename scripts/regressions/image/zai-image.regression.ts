// Z.ai image generation: the API URL, image sizes, the request body, the response and the model list.
import assert from "node:assert/strict";
import {
  buildZaiImageRequest,
  buildZaiImageUrl,
  parseZaiImageUrl,
  resolveZaiImageSize,
} from "../../../packages/server/src/services/image/zai-image.js";
import { ZAI_IMAGE_MODELS } from "../../../packages/shared/src/constants/model-lists.js";

assert.equal(buildZaiImageUrl("https://api.z.ai/api/paas/v4"), "https://api.z.ai/api/paas/v4/images/generations");
assert.throws(() => buildZaiImageUrl("https://api.z.ai/api/coding/paas/v4"), /general API URL/u);
assert.equal(resolveZaiImageSize("glm-image", 1600, 900), "1728x960");
assert.equal(resolveZaiImageSize("cogview-4-250304", 900, 1600), "768x1344");
assert.deepEqual(buildZaiImageRequest({ model: "glm-image", prompt: "canal", width: 1600, height: 900 }), {
  model: "glm-image",
  prompt: "canal",
  size: "1728x960",
});
assert.equal(parseZaiImageUrl({ data: [{ url: "https://cdn.example/zai.png" }] }), "https://cdn.example/zai.png");
assert.deepEqual(
  ZAI_IMAGE_MODELS.map((model) => model.id),
  ["glm-image", "cogview-4-250304"],
);
