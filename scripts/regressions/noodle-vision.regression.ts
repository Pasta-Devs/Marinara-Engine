import assert from "node:assert/strict";
import {
  collectNoodlePromptImageCandidates,
  formatNoodleTimelineForPrompt,
  noodlePostImageKey,
  noodleReplyImageKey,
} from "../../packages/server/src/services/noodle/noodle-prompt.js";
import {
  isUnsupportedNoodleVisionInputError,
  NOODLE_VISION_MAX_IMAGES,
  prepareNoodleVisionAttachments,
  resolveNoodleImagePath,
} from "../../packages/server/src/services/noodle/noodle-vision.js";
import { normalizeNoodleSettings } from "../../packages/server/src/services/storage/noodle.storage.js";

const onePixelPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const post = {
  id: "post-with-image",
  authorAccountId: "character-account",
  authorSnapshot: null,
  content: "Look at this picture.",
  imageUrl: onePixelPng,
  imagePrompt: "A fallback textual description.",
  metadata: {},
  createdAt: "2026-07-11T10:00:00.000Z",
};
const reply = {
  id: "reply-with-image",
  postId: post.id,
  parentInteractionId: null,
  actorAccountId: "persona-account",
  type: "reply" as const,
  content: "And this one?",
  imageUrl: onePixelPng,
  actorSnapshot: null,
  createdAt: "2026-07-11T11:00:00.000Z",
};

const candidates = collectNoodlePromptImageCandidates([post], [reply]);
assert.deepEqual(
  candidates.map((candidate) => candidate.key),
  [noodlePostImageKey(post.id), noodleReplyImageKey(reply.id)],
);
const attachments = await prepareNoodleVisionAttachments(candidates);
assert.equal(attachments.length, 2);
assert.ok(attachments.every((attachment) => attachment.dataUrl.startsWith("data:image/jpeg;base64,")));

const corruptPng = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("not-a-decodable-png"),
]);
assert.deepEqual(
  await prepareNoodleVisionAttachments([
    {
      ...candidates[0]!,
      key: "corrupt-image",
      imageUrl: `data:image/png;base64,${corruptPng.toString("base64")}`,
    },
  ]),
  [],
);

const attachedKeys = new Set(attachments.map((attachment) => attachment.key));
const multimodalTimeline = formatNoodleTimelineForPrompt([post], [reply], { attachedImageKeys: attachedKeys });
assert.match(multimodalTimeline, new RegExp(`attached image: ${noodlePostImageKey(post.id)}`));
assert.match(multimodalTimeline, new RegExp(`attached image: ${noodleReplyImageKey(reply.id)}`));
assert.doesNotMatch(multimodalTimeline, /image prompt:/);

const textOnlyTimeline = formatNoodleTimelineForPrompt([post], [reply]);
assert.match(textOnlyTimeline, /image prompt: A fallback textual description/);
assert.match(textOnlyTimeline, /\[image not attached\]/);

const captionedTimeline = formatNoodleTimelineForPrompt([post], [reply], {
  imageCaptions: new Map([
    [noodlePostImageKey(post.id), "A blue laboratory flask on a desk."],
    [noodleReplyImageKey(reply.id), "A handwritten note saying hello."],
  ]),
});
assert.match(captionedTimeline, /image description: A blue laboratory flask on a desk\./);
assert.match(captionedTimeline, /image description: A handwritten note saying hello\./);
assert.doesNotMatch(captionedTimeline, /image prompt:/);

const overLimitCandidates = Array.from({ length: NOODLE_VISION_MAX_IMAGES + 2 }, (_, index) => ({
  ...candidates[0]!,
  key: `limit-image-${index}`,
  createdAt: new Date(Date.UTC(2026, 6, 11, 12, 0, index)).toISOString(),
}));
assert.equal((await prepareNoodleVisionAttachments(overLimitCandidates)).length, NOODLE_VISION_MAX_IMAGES);

assert.match(
  resolveNoodleImagePath("/api/global-gallery/file/noodle.png") ?? "",
  /gallery[/\\]global[/\\]noodle\.png$/,
);
assert.match(
  resolveNoodleImagePath("/api/characters/character-id/gallery/file/post.png") ?? "",
  /gallery[/\\]characters[/\\]character-id[/\\]post\.png$/,
);
assert.equal(resolveNoodleImagePath("/api/global-gallery/file/%2E%2E%2Fsecret.png"), null);
assert.equal(resolveNoodleImagePath("https://example.com/image.png"), null);

assert.equal(isUnsupportedNoodleVisionInputError(new Error("This model does not support image_url inputs")), true);
assert.equal(isUnsupportedNoodleVisionInputError(new Error("No endpoints found that support image input")), true);
assert.equal(isUnsupportedNoodleVisionInputError(new Error("No endpoints found for text generation")), false);
assert.equal(isUnsupportedNoodleVisionInputError(new Error("Expected message content to be a string")), true);
assert.equal(isUnsupportedNoodleVisionInputError(new Error("Provider rate limit exceeded")), false);

assert.equal(normalizeNoodleSettings({ maxImagePromptsPerDay: 7 }).maxImagesPerRefresh, 7);
assert.equal(normalizeNoodleSettings({ maxImagePromptsPerDay: 7, maxImagesPerRefresh: 4 }).maxImagesPerRefresh, 4);
assert.equal(normalizeNoodleSettings({}).imageCaptioningEnabled, false);
assert.equal(normalizeNoodleSettings({ imageCaptioningEnabled: false }).imageCaptioningUseConnectionDefault, true);
assert.equal(normalizeNoodleSettings({ imageCaptioningEnabled: true }).imageCaptioningEnabled, true);
assert.equal(normalizeNoodleSettings({ imageCaptioningEnabled: true }).imageCaptioningUseConnectionDefault, false);
assert.equal(
  normalizeNoodleSettings({
    imageCaptioningEnabled: false,
    imageCaptioningUseConnectionDefault: false,
  }).imageCaptioningUseConnectionDefault,
  false,
);

process.stdout.write("Noodle vision regression passed.\n");
