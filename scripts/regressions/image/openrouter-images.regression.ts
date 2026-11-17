// OpenRouter image generation: the output types each model asks for, which models use the Images API, its URL and
// the request bodies it gets.
import assert from "node:assert/strict";
import {
  buildOpenRouterImagesRequest,
  openRouterImagesUrl,
  openRouterModalities,
  usesOpenRouterImagesApi,
} from "../../../packages/server/src/services/image/image-generation.js";

assert.deepEqual(openRouterModalities("krea/krea-2-large"), ["image"]);
assert.deepEqual(openRouterModalities(" KREA/krea-2-medium-turbo "), ["image"]);
assert.deepEqual(openRouterModalities("bytedance-seed/seedream-4.5"), ["image"]);
assert.deepEqual(openRouterModalities(" BYTEDANCE-SEED/SEEDREAM-4.5-20251203 "), ["image"]);
assert.deepEqual(openRouterModalities("google/gemini-3.1-flash-image-preview"), ["image", "text"]);
assert.equal(usesOpenRouterImagesApi(" krea/krea-2-medium "), true);
assert.equal(usesOpenRouterImagesApi("bytedance-seed/seedream-4.5"), true);
assert.equal(usesOpenRouterImagesApi("BYTEDANCE-SEED/SEEDREAM-4.5-20251203"), true);
assert.equal(usesOpenRouterImagesApi("google/gemini-3.1-flash-image-preview"), false);
assert.equal(usesOpenRouterImagesApi("gpt-image-2"), true);
assert.equal(usesOpenRouterImagesApi("openai/gpt-image-2"), true);
assert.equal(usesOpenRouterImagesApi("google/gemini-2.5-flash-image"), false);
assert.equal(usesOpenRouterImagesApi("google/gemini-3.1-flash-image-preview"), false);
assert.equal(
  openRouterImagesUrl("https://openrouter.ai/api/v1/chat/completions"),
  "https://openrouter.ai/api/v1/images",
);
assert.deepEqual(
  buildOpenRouterImagesRequest({
    prompt: "plate of spaghetti",
    negativePrompt: "burnt pasta",
    model: "krea/krea-2-large",
    width: 512,
    height: 512,
  }),
  {
    model: "krea/krea-2-large",
    prompt: "plate of spaghetti\n\nAvoid in the image: burnt pasta",
    resolution: "1K",
    aspect_ratio: "1:1",
  },
);
assert.deepEqual(
  buildOpenRouterImagesRequest({
    prompt: "portrait of a red fox",
    model: "gpt-image-2",
    width: 1024,
    height: 1536,
  }),
  {
    model: "openai/gpt-image-2",
    prompt: "portrait of a red fox",
    aspect_ratio: "2:3",
  },
);
assert.deepEqual(
  buildOpenRouterImagesRequest({ prompt: "landscape", model: "openai/gpt-image-1", width: 1024, height: 576 }),
  { model: "openai/gpt-image-1", prompt: "landscape", aspect_ratio: "3:2" },
);
assert.deepEqual(
  buildOpenRouterImagesRequest({
    prompt: "portrait",
    model: "google/gemini-2.5-flash-image",
    width: 1024,
    height: 1536,
  }),
  { model: "google/gemini-2.5-flash-image", prompt: "portrait", resolution: "1K", aspect_ratio: "9:16" },
);
assert.deepEqual(
  buildOpenRouterImagesRequest({
    prompt: "two subjects",
    model: "openai/gpt-image-1",
    quality: "high",
    transparentBackground: true,
    referenceImages: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"],
  }),
  {
    model: "openai/gpt-image-1",
    prompt: "two subjects",
    quality: "high",
    background: "transparent",
    aspect_ratio: "1:1",
    input_references: [
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
      { type: "image_url", image_url: { url: "data:image/png;base64,BBBB" } },
    ],
  },
);
assert.deepEqual(
  buildOpenRouterImagesRequest({
    prompt: "a dreamy night market",
    model: "bytedance-seed/seedream-4.5",
    width: 1280,
    height: 720,
  }),
  {
    model: "bytedance-seed/seedream-4.5",
    prompt: "a dreamy night market",
    resolution: "1K",
    aspect_ratio: "16:9",
  },
);
