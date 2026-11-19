// The native NovelAI request: a see-through request on V5 always carries the transparency tags (whoever built the
// prompt) without negatives that cancel them, and the "Background dataset for backgrounds" option (off by default)
// starts scene backgrounds on V4.5/V5 with NovelAI's "background dataset" tag.
import assert from "node:assert/strict";
import {
  NOVELAI_BACKGROUND_DATASET_TAG,
  resolveNovelAiDefaults,
  withNovelAiBackgroundDataset,
  withNovelAiTransparencyTags,
} from "../../../packages/server/src/services/image/image-generation.js";
import { NOVELAI_TRANSPARENCY_TAGS } from "../../../packages/shared/src/utils/openai-image.js";
import { normalizeImageGenerationProfile } from "../../../packages/shared/src/constants/image-generation-defaults.js";

const request = withNovelAiTransparencyTags(
  "1girl, smiling",
  "lowres, checkerboard background, fake transparency, transparency grid, white background",
  "nai-diffusion-5-full",
  true,
);
assert.equal(request.prompt, "1girl, smiling, transparent background, alpha transparency");
assert.equal(request.negativePrompt, "lowres, checkerboard background, white background");
assert.equal(
  withNovelAiTransparencyTags("1girl, transparent background, alpha transparency", "", "nai-diffusion-5", true).prompt,
  "1girl, transparent background, alpha transparency",
  "tags already in the prompt are not repeated",
);
assert.equal(withNovelAiTransparencyTags("", "", "nai-diffusion-5", true).prompt, NOVELAI_TRANSPARENCY_TAGS);
for (const [model, transparent] of [
  ["nai-diffusion-4-5-full", true],
  ["nai-diffusion-5-full", false],
] as const) {
  assert.deepEqual(withNovelAiTransparencyTags("1girl", "fake transparency", model, transparent), {
    prompt: "1girl",
    negativePrompt: "fake transparency",
  });
}

assert.equal(NOVELAI_BACKGROUND_DATASET_TAG, "background dataset");
assert.equal(resolveNovelAiDefaults({ prompt: "x" }).backgroundDataset, false, "off by default");
assert.equal(
  normalizeImageGenerationProfile(
    { version: 1, service: "novelai", seed: -1, novelai: { backgroundDataset: true } },
    "novelai",
  ).profile.novelai?.backgroundDataset,
  true,
);
assert.equal(
  withNovelAiBackgroundDataset("  forest clearing, dusk", "nai-diffusion-4-5-full", true, true),
  "background dataset, forest clearing, dusk",
);
assert.equal(
  withNovelAiBackgroundDataset("forest", "nai-diffusion-5-curated", true, true),
  "background dataset, forest",
);
assert.equal(withNovelAiBackgroundDataset("forest", "nai-diffusion-5", true, false), "forest", "option off");
assert.equal(withNovelAiBackgroundDataset("1girl", "nai-diffusion-5", false, true), "1girl", "only backgrounds");
assert.equal(withNovelAiBackgroundDataset("forest", "nai-diffusion-4-full", true, true), "forest", "V4.5 and later");
assert.equal(
  withNovelAiBackgroundDataset("background dataset, forest", "nai-diffusion-5", true, true),
  "background dataset, forest",
  "not repeated",
);

console.log("novelai-request-tags regression passed");
