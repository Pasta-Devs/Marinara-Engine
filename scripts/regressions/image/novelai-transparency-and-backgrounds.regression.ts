// NovelAI V5 draws real alpha when the prompt carries its transparency tags. Automatic knows it on NovelAI's own
// site, sprites and sticker sheets ask with the tags and no chroma fallback (which NovelAI would draw literally),
// and the native request adds the tags and keeps them out of the negative prompt.
import assert from "node:assert/strict";
import {
  imageConnectionAsksTransparencyWithTags,
  imageConnectionMakesTransparentPicture,
  isNovelAiV5ImageModel,
  NOVELAI_TRANSPARENCY_TAGS,
} from "../../../packages/shared/src/utils/openai-image.js";
import {
  NOVELAI_BACKGROUND_DATASET_TAG,
  resolveNovelAiDefaults,
  withNovelAiBackgroundDataset,
  withNovelAiTransparencyTags,
} from "../../../packages/server/src/services/image/image-generation.js";
import { normalizeImageGenerationProfile } from "../../../packages/shared/src/constants/image-generation-defaults.js";
import {
  applySpriteBackgroundInstruction,
  selectSpriteChromaMatte,
  spriteBackgroundContract,
} from "../../../packages/server/src/services/image/sprite-background.service.js";
import {
  resolveSpriteNativeTransparency,
  resolveSpriteTransparencyTags,
} from "../../../packages/server/src/routes/sprites.routes.js";
import { withGallerySheetTransparency } from "../../../packages/server/src/routes/characters.routes.js";
import { CHARACTERS_STICKER_SHEET } from "../../../packages/server/src/services/prompt-overrides/registry/characters.js";

assert.equal(NOVELAI_TRANSPARENCY_TAGS, "transparent background, alpha transparency");
for (const model of ["nai-diffusion-5", "nai-diffusion-5-full", "NAI-Diffusion-5-Curated"]) {
  assert.equal(isNovelAiV5ImageModel(model), true, model);
}
for (const model of ["nai-diffusion-4-5-full", "nai-diffusion-3", "", null]) {
  assert.equal(isNovelAiV5ImageModel(model), false, String(model));
}

// Automatic: V5 on NovelAI's own host only.
const row = (model: string, baseUrl: string) => ({ source: "novelai", baseUrl, serviceHint: "novelai", model });
assert.equal(imageConnectionMakesTransparentPicture(row("nai-diffusion-5-full", "https://image.novelai.net")), true);
assert.equal(
  imageConnectionMakesTransparentPicture(row("nai-diffusion-5-curated", "https://image.novelai.net/")),
  true,
);
assert.equal(imageConnectionMakesTransparentPicture(row("nai-diffusion-4-5-full", "https://image.novelai.net")), false);
assert.equal(
  imageConnectionMakesTransparentPicture(row("nai-diffusion-5-full", "https://linkapi.ai/v1")),
  false,
  "a proxy speaks chat completions and returns what it returns",
);
assert.equal(
  imageConnectionMakesTransparentPicture(row("nai-diffusion-5-full", "https://novelai.net.evil.example")),
  false,
);
assert.equal(
  imageConnectionMakesTransparentPicture({
    ...row("nai-diffusion-5-full", "https://image.novelai.net"),
    imageTransparency: "unsupported",
  }),
  false,
  "the Model's own setting wins",
);
assert.equal(imageConnectionAsksTransparencyWithTags(row("nai-diffusion-5-full", "https://image.novelai.net")), true);
assert.equal(
  imageConnectionAsksTransparencyWithTags({
    source: "gpt-image-1",
    baseUrl: "https://api.openai.com/v1",
    serviceHint: "gpt-image-1",
    model: "gpt-image-1",
  }),
  false,
);

// Sprites: the plan asks with tags only when it asks for transparency at all.
const novelAi = { model: "nai-diffusion-5-full", baseUrl: "https://image.novelai.net", imageService: "novelai" };
assert.equal(resolveSpriteNativeTransparency(novelAi, true), true);
assert.equal(resolveSpriteTransparencyTags(novelAi, true), true);
assert.equal(resolveSpriteTransparencyTags(novelAi, false), false);
assert.equal(
  resolveSpriteTransparencyTags({ model: "gpt-image-1", baseUrl: "https://api.openai.com/v1" }, true),
  false,
);

const matte = selectSpriteChromaMatte("red hair, blue dress");
const tagged = applySpriteBackgroundInstruction("1girl, standing, plain white background, full body", {
  matte,
  nativeTransparentPng: true,
  removeBackground: true,
  transparencyTags: true,
});
assert.equal(tagged, "1girl, standing, transparent background, alpha transparency, no background, full body");
assert.doesNotMatch(tagged, new RegExp(matte.hex, "i"), "no chroma fallback NovelAI would paint");
assert.equal(
  spriteBackgroundContract({ matte, nativeTransparentPng: true, removeBackground: true, transparencyTags: true }),
  "",
);
// Without tags the instruction and its fallback are unchanged.
assert.match(
  applySpriteBackgroundInstruction("1girl, plain white background", {
    matte,
    nativeTransparentPng: true,
    removeBackground: true,
  }),
  /transparent PNG format\. If native transparency is unsupported, use one perfectly flat/u,
);
// A model asked for chroma cleanup instead never gets the tags.
assert.doesNotMatch(
  applySpriteBackgroundInstruction("1girl, plain white background", {
    matte,
    nativeTransparentPng: false,
    removeBackground: true,
    transparencyTags: true,
  }),
  /alpha transparency/u,
);

// Sticker sheets: the green screen is replaced by the tags, with no green fallback.
const sheet = withGallerySheetTransparency(
  CHARACTERS_STICKER_SHEET.defaultBuilder(CHARACTERS_STICKER_SHEET.exampleContext),
  true,
);
assert.match(sheet, /transparent background, alpha transparency, no background;/u);
assert.doesNotMatch(sheet, /green/iu);
assert.equal(
  withGallerySheetTransparency("A sheet of stickers.", true),
  "A sheet of stickers. transparent background, alpha transparency, no background.",
);

// Native request: tags added once, transparency words dropped from the negative prompt.
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
assert.deepEqual(withNovelAiTransparencyTags("1girl", "fake transparency", "nai-diffusion-4-5-full", true), {
  prompt: "1girl",
  negativePrompt: "fake transparency",
});
assert.deepEqual(withNovelAiTransparencyTags("1girl", "fake transparency", "nai-diffusion-5-full", false), {
  prompt: "1girl",
  negativePrompt: "fake transparency",
});

// "Background dataset for backgrounds": off by default; when on, only scene backgrounds on V4.5/V5 start with it.

assert.equal(NOVELAI_BACKGROUND_DATASET_TAG, "background dataset");
assert.equal(resolveNovelAiDefaults({ prompt: "x" }).backgroundDataset, false);
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
assert.equal(withNovelAiBackgroundDataset("forest", "nai-diffusion-5", true, false), "forest", "off by default");
assert.equal(withNovelAiBackgroundDataset("1girl", "nai-diffusion-5", false, true), "1girl", "only backgrounds");
assert.equal(withNovelAiBackgroundDataset("forest", "nai-diffusion-4-full", true, true), "forest", "V4.5 and later");
assert.equal(
  withNovelAiBackgroundDataset("background dataset, forest", "nai-diffusion-5", true, true),
  "background dataset, forest",
  "not repeated",
);

console.log("novelai-transparency regression passed");
