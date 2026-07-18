import assert from "node:assert/strict";

import {
  generateImageCaptionsForDataUrls,
  redactImageCaptionMessagesForLog,
  resolvePromptAttachmentInputs,
  type ImageCaptionConnection,
  type ImageCaptioningRuntime,
} from "../../packages/server/src/services/generation/image-captioning-runtime.js";
import {
  buildReadableAttachmentBlocks,
  parseExtra,
  type PromptAttachment,
} from "../../packages/server/src/services/generation/prompt-attachments.js";
import {
  BaseLLMProvider,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

const dataUrl = (value: string) => `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
const connection: ImageCaptionConnection = {
  id: "caption-connection",
  provider: "openai",
  apiKey: "",
  model: "caption-model",
  baseUrl: null,
};

const providerMessages: ChatMessage[] = [
  { role: "system", content: "exact system prompt" },
  { role: "user", content: "exact user prompt", images: [dataUrl("private-image")] },
];
const redactedProviderMessages = redactImageCaptionMessagesForLog(providerMessages);
assert.equal(redactedProviderMessages[0]?.content, providerMessages[0]?.content);
assert.equal(redactedProviderMessages[1]?.content, providerMessages[1]?.content);
assert.deepEqual(redactedProviderMessages[1]?.images, [
  { mediaType: "image/png", encodedCharacters: dataUrl("private-image").length },
]);
assert.deepEqual(providerMessages[1]?.images, [dataUrl("private-image")], "provider messages must remain unchanged");
assert.doesNotMatch(JSON.stringify(redactedProviderMessages), /private-image/u);

class CaptionProvider extends BaseLLMProvider {
  calls: string[] = [];
  active = 0;
  maxActive = 0;

  constructor(private readonly failures = new Set<string>()) {
    super("", "");
  }

  async *chat(messages: ChatMessage[], _options: ChatOptions) {
    const filename = messages[1]!.content.match(/named "([^"]+)"/)?.[1] ?? "unknown";
    this.calls.push(filename);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    await new Promise((resolve) => setTimeout(resolve, filename === "image-0.png" ? 15 : 5));
    this.active -= 1;
    if (this.failures.has(filename)) throw new Error("caption failed");
    yield `caption for ${filename}`;
  }
}

const provider = new CaptionProvider(new Set(["image-3.png"]));
const runtime: ImageCaptioningRuntime = {
  enabled: true,
  connectionId: connection.id,
  connection,
  provider,
};
const attachments: PromptAttachment[] = Array.from({ length: 10 }, (_, index) => ({
  type: "image/png",
  filename: `image-${index}.png`,
  data: dataUrl(String(index)),
}));
attachments.push({
  type: "image/png",
  filename: "cached-after-limit.png",
  data: dataUrl("cached"),
  imageCaption: "cached caption",
  imageCaptionConnectionId: connection.id,
  imageCaptionModel: connection.model,
  imageCaptionProvider: connection.provider,
});

const resolution = await resolvePromptAttachmentInputs({
  content: "prompt",
  attachments,
  imageCaptioning: runtime,
  signal: new AbortController().signal,
});
assert.deepEqual(
  provider.calls,
  Array.from({ length: 8 }, (_, index) => `image-${index}.png`),
);
assert.equal(provider.maxActive, 2);
assert.deepEqual(resolution.images, [dataUrl("3"), dataUrl("8"), dataUrl("9")]);
assert.ok(
  resolution.content.indexOf("caption for image-0.png") < resolution.content.indexOf("caption for image-1.png"),
);
assert.ok(resolution.content.indexOf("caption for image-7.png") < resolution.content.indexOf("cached caption"));
assert.equal(resolution.updatedAttachments?.[7]?.imageCaption, "caption for image-7.png");
assert.equal(resolution.updatedAttachments?.[10]?.imageCaption, "cached caption");

const abortedProvider = new CaptionProvider();
const abortedRuntime = { ...runtime, provider: abortedProvider };
const aborted = new AbortController();
aborted.abort();
await assert.rejects(
  generateImageCaptionsForDataUrls(
    [{ filename: "aborted.png", imageDataUrl: dataUrl("aborted") }],
    abortedRuntime,
    aborted.signal,
  ),
  { name: "AbortError" },
);
assert.equal(abortedProvider.calls.length, 0);

assert.deepEqual(parseExtra({ value: 1 }), { value: 1 });
assert.deepEqual(parseExtra('{"value":1}'), { value: 1 });
for (const value of [null, 1, true, [], "[]", "null"]) assert.deepEqual(parseExtra(value), {});

const oversizedReadable = {
  type: "text/plain",
  filename: "oversized.txt",
  data: `data:text/plain;base64,${"A".repeat(Math.ceil(((20 * 1024 * 1024 + 1) * 4) / 3))}`,
};
assert.deepEqual(buildReadableAttachmentBlocks([oversizedReadable]), []);
assert.equal(
  buildReadableAttachmentBlocks([{ type: "text/plain", filename: "small.txt", data: "data:text/plain,small%20text" }])
    .length,
  1,
);

process.stdout.write("Prompt attachment regression passed.\n");
