import assert from "node:assert/strict";
import {
  CHARACTERS_EMOJI_SHEET,
  CHARACTERS_STICKER_SHEET,
} from "../../../packages/server/src/services/prompt-overrides/registry/characters.js";
import { withGallerySheetTransparency } from "../../../packages/server/src/routes/characters.routes.js";
import { imageConnectionMakesTransparentPicture } from "../../../packages/shared/src/utils/openai-image.js";
import { normalizeImportedConnectionEntry } from "../../../packages/client/src/lib/connection-transfer.js";

// #9574: a sticker or emoji sheet on a Model that draws see-through pictures asks for one, keeping the green
// screen only as the fallback the gallery keys out.
for (const definition of [CHARACTERS_STICKER_SHEET, CHARACTERS_EMOJI_SHEET]) {
  const prompt = definition.defaultBuilder(definition.exampleContext);
  const seeThrough = withGallerySheetTransparency(prompt);
  assert.match(seeThrough, /^.*Transparent background everywhere \(no backdrop at all, real PNG alpha\)/su);
  assert.match(seeThrough, /only if transparency is impossible, a plain flat solid pure green \(#00FF00\)/u);
  assert.doesNotMatch(seeThrough, /Plain flat solid pure green/u, "the green screen is no longer the first ask");
  assert.match(seeThrough, /with no green in the (stickers|emoji) themselves;/u);
}
assert.equal(
  withGallerySheetTransparency("A sheet of stickers on a blue background."),
  "A sheet of stickers on a blue background. Transparent background everywhere (no backdrop at all, real PNG alpha).",
  "an edited prompt without the green screen gets the request added",
);

// On NovelAI the sheet asks with its transparency tags, and the green screen is gone instead of kept as a fallback.
for (const definition of [CHARACTERS_STICKER_SHEET, CHARACTERS_EMOJI_SHEET]) {
  const prompt = definition.defaultBuilder(definition.exampleContext);
  const tagged = withGallerySheetTransparency(prompt, true);
  assert.match(tagged, /transparent background, alpha transparency, no background;/u);
  assert.doesNotMatch(tagged, /green/iu);
}
assert.equal(
  withGallerySheetTransparency("A sheet of stickers on a blue background.", true),
  "A sheet of stickers on a blue background. transparent background, alpha transparency, no background.",
);

// Automatic knows the models that return alpha; the Model's own setting wins either way.
const row = (model: string, baseUrl: string, serviceHint = model) => ({ source: model, baseUrl, serviceHint, model });
assert.equal(imageConnectionMakesTransparentPicture(row("gpt-image-1", "https://api.openai.com/v1")), true);
assert.equal(imageConnectionMakesTransparentPicture(row("gpt-image-2.6-flare", "https://api.openai.com/v1")), true);
assert.equal(imageConnectionMakesTransparentPicture(row("gpt-image-2", "https://api.openai.com/v1")), false);
assert.equal(imageConnectionMakesTransparentPicture(row("dall-e-3", "https://api.openai.com/v1")), false);
assert.equal(imageConnectionMakesTransparentPicture(row("gpt-image-1", "https://toapis.com/v1")), false);
assert.equal(imageConnectionMakesTransparentPicture(row("openai/gpt-image-1.5", "https://openrouter.ai/api/v1")), true);
assert.equal(imageConnectionMakesTransparentPicture(row("openai/gpt-image-2", "https://openrouter.ai/api/v1")), false);
assert.equal(imageConnectionMakesTransparentPicture(row("", "", "codex_chatgpt")), false, "Codex draws GPT Image 2");
assert.equal(
  imageConnectionMakesTransparentPicture(row("nai-diffusion-5-full", "https://image.novelai.net", "novelai")),
  true,
);
assert.equal(
  imageConnectionMakesTransparentPicture(row("nai-diffusion-4-5-full", "https://image.novelai.net", "novelai")),
  false,
);
const comfy = row("flux", "http://127.0.0.1:8188", "comfyui");
assert.equal(imageConnectionMakesTransparentPicture(comfy), false);
assert.equal(imageConnectionMakesTransparentPicture({ ...comfy, imageTransparency: "supported" }), true);
assert.equal(
  imageConnectionMakesTransparentPicture({
    ...row("gpt-image-1", "https://api.openai.com/v1"),
    imageTransparency: "unsupported",
  }),
  false,
);

// The setting travels with an exported connection; anything else reads as Automatic.
const imported = (imageTransparency: unknown) =>
  normalizeImportedConnectionEntry({
    name: "Pictures",
    provider: "image_generation",
    model: "flux",
    baseUrl: "http://127.0.0.1:8188",
    imageTransparency,
  } as never);
assert.equal(imported("supported")?.connection.imageTransparency, "supported");
assert.equal(imported("unsupported")?.connection.imageTransparency, "unsupported");
assert.equal(imported("always")?.connection.imageTransparency, null);
