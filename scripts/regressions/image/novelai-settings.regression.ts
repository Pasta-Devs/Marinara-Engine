// NovelAI image settings: subject counts in a prompt, image sizes and the defaults a connection profile gets.
import assert from "node:assert/strict";
import {
  detectNovelAiSubjectCount,
  resolveNovelAiDefaults,
  resolveNovelAiRequestSize,
  resolveNovelAiSize,
} from "../../../packages/server/src/services/image/image-generation.js";
import { DEFAULT_NOVELAI_DEFAULTS } from "../../../packages/shared/src/constants/image-generation-defaults.js";
import type { ImageGenerationDefaultsProfile } from "../../../packages/shared/src/types/image-generation-defaults.js";
import { resolveImagePromptReviewSize } from "../../../packages/server/src/services/image/image-prompt-review.js";

assert.equal(detectNovelAiSubjectCount("2girls, 1boy, outdoors | first | second | third"), 3);
assert.equal(detectNovelAiSubjectCount("cinematic scene | first character | second character"), 2);
assert.equal(detectNovelAiSubjectCount("empty landscape"), null);
assert.deepEqual(
  resolveNovelAiSize({ prompt: "1girl", width: 1216, height: 832 }, "1girl", {
    ...DEFAULT_NOVELAI_DEFAULTS,
    dynamicResolutionBySubjectCount: true,
  }),
  { width: 832, height: 1216 },
);
assert.deepEqual(
  resolveNovelAiSize({ prompt: "2girls", width: 832, height: 1216 }, "2girls", {
    ...DEFAULT_NOVELAI_DEFAULTS,
    dynamicResolutionBySubjectCount: true,
  }),
  { width: 1024, height: 1024 },
);
assert.deepEqual(
  resolveNovelAiSize({ prompt: "1girl, 1boy, 1other", width: 832, height: 1216 }, "1girl, 1boy, 1other", {
    ...DEFAULT_NOVELAI_DEFAULTS,
    dynamicResolutionBySubjectCount: true,
  }),
  { width: 1216, height: 832 },
);
assert.deepEqual(
  resolveNovelAiSize({ prompt: "1girl", width: 1024, height: 1024 }, "1girl", {
    ...DEFAULT_NOVELAI_DEFAULTS,
    dynamicResolutionBySubjectCount: false,
  }),
  { width: 1024, height: 1024 },
);
const legacyNovelAiProfile = {
  version: 1,
  service: "novelai",
  seed: -1,
  novelai: { promptPrefix: "2girls" },
} as unknown as ImageGenerationDefaultsProfile;
assert.deepEqual(resolveNovelAiDefaults({ prompt: "1boy", imageDefaults: legacyNovelAiProfile }), {
  ...DEFAULT_NOVELAI_DEFAULTS,
  promptPrefix: "2girls",
});
assert.deepEqual(
  resolveNovelAiSize({ prompt: "1boy", width: 1216, height: 832, imageDefaults: legacyNovelAiProfile }),
  { width: 832, height: 1216 },
);
const nativeNovelAiConnection = {
  baseUrl: "https://image.novelai.net",
  model: "nai-diffusion-4-5-full",
  imageService: "novelai",
};
const prefixedNovelAiProfile = {
  version: 1,
  service: "novelai",
  seed: -1,
  novelai: { ...DEFAULT_NOVELAI_DEFAULTS, promptPrefix: "2girls" },
} satisfies ImageGenerationDefaultsProfile;
assert.deepEqual(
  resolveNovelAiRequestSize({
    prompt: "1boy",
    width: 1216,
    height: 832,
    model: nativeNovelAiConnection.model,
    imageDefaults: prefixedNovelAiProfile,
  }),
  { width: 832, height: 1216 },
);
assert.deepEqual(
  resolveImagePromptReviewSize({
    connection: nativeNovelAiConnection,
    prompt: "1boy",
    width: 1216,
    height: 832,
    imageDefaults: prefixedNovelAiProfile,
  }),
  { width: 832, height: 1216 },
);
assert.deepEqual(
  resolveImagePromptReviewSize({
    connection: nativeNovelAiConnection,
    prompt: "1girl, 1boy, 1other",
    width: 832,
    height: 1216,
    imageDefaults: prefixedNovelAiProfile,
  }),
  { width: 1216, height: 832 },
);
assert.deepEqual(
  resolveImagePromptReviewSize({
    connection: nativeNovelAiConnection,
    prompt: "1boy",
    width: 1216,
    height: 832,
    imageDefaults: {
      ...prefixedNovelAiProfile,
      novelai: { ...prefixedNovelAiProfile.novelai!, dynamicResolutionBySubjectCount: false },
    },
  }),
  { width: 1216, height: 832 },
);
assert.deepEqual(
  resolveImagePromptReviewSize({
    connection: { ...nativeNovelAiConnection, baseUrl: "https://novelai-proxy.example.com" },
    prompt: "1boy",
    width: 1216,
    height: 832,
    imageDefaults: prefixedNovelAiProfile,
  }),
  { width: 1216, height: 832 },
);
