// Reviewing a prompt before an image or video is generated: an edited prompt replaces the generated one, a blank
// one keeps it, one past the provider's limit is refused, and the review shows the size the image will have.
import assert from "node:assert/strict";
import {
  parseIllustratorPromptReviewOverride,
  resolveIllustratorPromptSubmission,
} from "../../../packages/server/src/services/image/illustrator-prompt-review.js";
import {
  resolveImagePromptReviewSize,
  resolveReviewedImagePromptSubmission,
} from "../../../packages/server/src/services/image/image-prompt-review.js";
import { resolveSceneVideoPrompt } from "../../../packages/server/src/services/video/scene-video-prompt-review.js";

assert.equal(
  resolveSceneVideoPrompt({
    generatedPrompt: "Generated Gallery animation prompt",
    promptOverride: "  Reviewed Gallery animation prompt  ",
    maxPromptLength: null,
  }),
  "Reviewed Gallery animation prompt",
);
assert.equal(
  resolveSceneVideoPrompt({
    generatedPrompt: "Generated Gallery animation prompt",
    maxPromptLength: null,
  }),
  "Generated Gallery animation prompt",
);
assert.throws(
  () =>
    resolveSceneVideoPrompt({
      generatedPrompt: "Generated prompt",
      promptOverride: "Reviewed prompt exceeds provider limit",
      maxPromptLength: 12,
    }),
  /at most 12 characters/u,
);
assert.deepEqual(
  resolveIllustratorPromptSubmission({
    generatedPrompt: "Generated compiled illustration prompt",
    generatedNegativePrompt: "Generated negative prompt",
    reviewOverride: {
      prompt: "  Reviewed illustration prompt  ",
      negativePrompt: "  Reviewed negative prompt  ",
    },
  }),
  {
    prompt: "Reviewed illustration prompt",
    negativePrompt: "Reviewed negative prompt",
  },
);
assert.deepEqual(
  parseIllustratorPromptReviewOverride({
    resultData: { shouldGenerate: true, prompt: "Agent prompt" },
    prompt: " Reviewed provider prompt ",
  }),
  {
    resultData: { shouldGenerate: true, prompt: "Agent prompt" },
    prompt: "Reviewed provider prompt",
  },
);
assert.equal(parseIllustratorPromptReviewOverride({ resultData: {}, prompt: "   " }), null);
assert.deepEqual(
  resolveReviewedImagePromptSubmission({
    generatedPrompt: "Compiled selfie prompt",
    generatedNegativePrompt: "Compiled selfie negative",
    promptOverride: " Reviewed selfie prompt ",
  }),
  {
    prompt: "Reviewed selfie prompt",
    negativePrompt: "Compiled selfie negative",
  },
);
assert.deepEqual(
  resolveReviewedImagePromptSubmission({
    generatedPrompt: "Compiled selfie prompt",
    generatedNegativePrompt: "Compiled selfie negative",
    promptOverride: "Reviewed selfie prompt",
    negativePromptOverride: "",
  }),
  {
    prompt: "Reviewed selfie prompt",
    negativePrompt: "",
  },
);
assert.deepEqual(
  resolveImagePromptReviewSize({
    connection: { baseUrl: "https://api.openai.com", model: "gpt-image-1", imageService: "openai" },
    prompt: "1boy",
    width: 1024,
    height: 1024,
    imageDefaults: null,
  }),
  { width: 1024, height: 1024 },
);
