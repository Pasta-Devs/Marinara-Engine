import assert from "node:assert/strict";

import {
  DEFAULT_IMAGE_CAPTIONING_PROMPT,
  DEFAULT_IMAGE_READING_SETTINGS,
  parseImageReadingSettings,
} from "../../packages/shared/src/index.js";
import {
  generateImageCaptionsForDataUrls,
  redactImageCaptionMessagesForLog,
  resolveImageCaptioningRuntime,
  resolvePromptAttachmentInputs,
  setImageReadingSettings,
  stripCaptionThinking,
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

const mainConnection: ImageCaptionConnection = {
  ...connection,
  id: "main-connection",
  model: "main-model",
  baseUrl: "http://localhost:1234/v1",
  defaultParameters: JSON.stringify({
    imageCaptioningEnabled: true,
    imageCaptioningConnectionId: "vision-connection",
  }),
};
const visionConnection: ImageCaptionConnection = {
  ...connection,
  id: "vision-connection",
  model: "vision-model",
  baseUrl: "http://localhost:5678/v1",
};
const runtimeConnections = {
  listRandomPool: async () => [],
  getWithKey: async (connectionId: string) =>
    connectionId === mainConnection.id
      ? mainConnection
      : connectionId === visionConnection.id
        ? visionConnection
        : null,
  getFallbackForAgents: async () => null,
};
const inheritedRuntime = await resolveImageCaptioningRuntime({
  chatMeta: {},
  fallbackConnectionId: mainConnection.id,
  connections: runtimeConnections,
});
assert.equal(inheritedRuntime.enabled, true);
assert.equal(inheritedRuntime.connectionId, visionConnection.id);
assert.equal(inheritedRuntime.connection?.model, visionConnection.model);

const disabledOverrideRuntime = await resolveImageCaptioningRuntime({
  chatMeta: { imageCaptioningEnabled: false },
  fallbackConnectionId: mainConnection.id,
  connections: runtimeConnections,
});
assert.equal(disabledOverrideRuntime.enabled, false);

// Captioning switched on in the chat reports a connection that can't be loaded instead of quietly turning off.
const failingLoadRuntime = await resolveImageCaptioningRuntime({
  chatMeta: { imageCaptioningEnabled: true },
  fallbackConnectionId: mainConnection.id,
  connections: {
    ...runtimeConnections,
    getWithKey: async () => {
      throw new Error("connection storage is unavailable");
    },
  },
});
assert.equal(failingLoadRuntime.enabled, true, "an explicit on must stay on when loading fails");
assert.match(String(failingLoadRuntime.unavailableReason), /connection storage is unavailable/u);

const inheritedConnectionRuntime = await resolveImageCaptioningRuntime({
  chatMeta: { imageCaptioningEnabled: true },
  fallbackConnectionId: mainConnection.id,
  connections: runtimeConnections,
});
assert.equal(inheritedConnectionRuntime.connectionId, visionConnection.id);

const currentConnectionRuntime = await resolveImageCaptioningRuntime({
  chatMeta: { imageCaptioningEnabled: true, imageCaptioningConnectionId: null },
  fallbackConnectionId: mainConnection.id,
  connections: runtimeConnections,
});
assert.equal(currentConnectionRuntime.connectionId, mainConnection.id);

const disabledByDefaultRuntime = await resolveImageCaptioningRuntime({
  chatMeta: {},
  fallbackConnectionId: visionConnection.id,
  connections: runtimeConnections,
});
assert.equal(disabledByDefaultRuntime.enabled, false);

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
  systemPrompts: string[] = [];
  active = 0;
  maxActive = 0;

  constructor(
    private readonly failures = new Set<string>(),
    private readonly blanks = new Set<string>(),
  ) {
    super("", "");
  }

  async *chat(messages: ChatMessage[], _options: ChatOptions) {
    const filename = messages[1]!.content.match(/named "([^"]+)"/)?.[1] ?? "unknown";
    this.calls.push(filename);
    this.systemPrompts.push(messages[0]!.content);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    await new Promise((resolve) => setTimeout(resolve, filename === "image-0.png" ? 15 : 5));
    this.active -= 1;
    if (this.failures.has(filename)) throw new Error("caption failed");
    if (!this.blanks.has(filename)) yield `caption for ${filename}`;
  }
}

const provider = new CaptionProvider();
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
// Only images past the per-message caption cap still go out as images.
assert.deepEqual(resolution.images, [dataUrl("8"), dataUrl("9")]);
assert.ok(
  resolution.content.indexOf("caption for image-0.png") < resolution.content.indexOf("caption for image-1.png"),
);
assert.ok(resolution.content.indexOf("caption for image-7.png") < resolution.content.indexOf("cached caption"));
assert.equal(resolution.updatedAttachments?.[7]?.imageCaption, "caption for image-7.png");
assert.equal(resolution.updatedAttachments?.[10]?.imageCaption, "cached caption");

// A changed prompt makes a new caption instead of reusing one made with the old prompt.
assert.ok(resolution.updatedAttachments?.[7]?.imageCaptionPromptKey, "new captions remember their prompt");
const promptChanged = new CaptionProvider();
const recaptioned = await resolvePromptAttachmentInputs({
  content: "prompt",
  attachments: [attachments[10]!],
  imageCaptioning: { ...runtime, provider: promptChanged, prompt: "Describe every detail." },
  signal: new AbortController().signal,
});
assert.deepEqual(promptChanged.calls, ["cached-after-limit.png"], "a changed prompt must caption the image again");
assert.match(recaptioned.content, /caption for cached-after-limit\.png/u);

// A failed caption stops the turn with a clear error instead of quietly sending the raw image.
const signal = new AbortController().signal;
await assert.rejects(
  resolvePromptAttachmentInputs({
    content: "prompt",
    attachments,
    imageCaptioning: { ...runtime, provider: new CaptionProvider(new Set(["image-3.png"])) },
    signal,
  }),
  (error: Error) => {
    assert.equal(error.message, 'Image captioning failed for "image-3.png"');
    assert.equal((error.cause as Error | undefined)?.message, "caption failed");
    return true;
  },
);
await assert.rejects(
  generateImageCaptionsForDataUrls(
    [{ filename: "blank.png", imageDataUrl: dataUrl("blank") }],
    { ...runtime, provider: new CaptionProvider(new Set(), new Set(["blank.png"])) },
    signal,
  ),
  { message: 'Image captioning failed for "blank.png": the captioning model sent back no text' },
);

// A captioning connection that can't be used fails turns with images and leaves text-only turns alone.
const brokenRuntime = await resolveImageCaptioningRuntime({
  chatMeta: { imageCaptioningEnabled: true, imageCaptioningConnectionId: "deleted-connection" },
  fallbackConnectionId: mainConnection.id,
  connections: runtimeConnections,
});
await assert.rejects(
  resolvePromptAttachmentInputs({
    content: "look",
    attachments: [attachments[0]!],
    imageCaptioning: brokenRuntime,
    signal,
  }),
  { message: "Image captioning failed: the captioning connection was not found" },
);
const textOnlyTurn = await resolvePromptAttachmentInputs({
  content: "just text",
  attachments: undefined,
  imageCaptioning: brokenRuntime,
  signal,
});
assert.equal(textOnlyTurn.content, "just text");
assert.deepEqual(textOnlyTurn.images, []);

// The chat's custom captioning prompt is the system prompt; a blank one falls back to the default.
const promptProvider = new CaptionProvider();
for (const imageCaptioningPrompt of ["  Describe every detail.  ", "   "]) {
  const promptRuntime = await resolveImageCaptioningRuntime({
    chatMeta: { imageCaptioningEnabled: true, imageCaptioningPrompt },
    fallbackConnectionId: mainConnection.id,
    connections: runtimeConnections,
  });
  await generateImageCaptionsForDataUrls(
    [{ filename: "prompt.png", imageDataUrl: dataUrl("prompt") }],
    { ...promptRuntime, provider: promptProvider },
    signal,
  );
}
assert.deepEqual(promptProvider.systemPrompts, ["Describe every detail.", DEFAULT_IMAGE_CAPTIONING_PROMPT]);

// The engine-wide Image reading settings: prompt (a chat's own still wins), request with {{filename}}, limits.
class RecordingProvider extends BaseLLMProvider {
  requests: Array<{ system: string; user: string; maxTokens?: number; temperature?: number }> = [];
  constructor(
    private readonly reply: string,
    private readonly finishReason = "stop",
  ) {
    super("", "");
  }
  async *chat(messages: ChatMessage[], options: ChatOptions) {
    this.requests.push({
      system: messages[0]!.content,
      user: messages[1]!.content,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
    yield this.reply;
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0, finishReason: this.finishReason };
  }
}
setImageReadingSettings(
  parseImageReadingSettings({
    prompt: "Engine prompt.",
    request: "Look at {{ filename }} closely.",
    maxTokens: 2048,
    temperature: 0.7,
  }),
);
const engineProvider = new RecordingProvider("an owl");
await generateImageCaptionsForDataUrls(
  [{ filename: "owl.png", imageDataUrl: dataUrl("owl") }],
  { ...runtime, provider: engineProvider },
  signal,
);
await generateImageCaptionsForDataUrls(
  [{ filename: "owl.png", imageDataUrl: dataUrl("owl") }],
  { ...runtime, provider: engineProvider, prompt: "Chat prompt." },
  signal,
);
assert.deepEqual(engineProvider.requests, [
  { system: "Engine prompt.", user: "Look at owl.png closely.", maxTokens: 2048, temperature: 0.7 },
  { system: "Chat prompt.", user: "Look at owl.png closely.", maxTokens: 2048, temperature: 0.7 },
]);
// Blank or out-of-range stored values fall back to the built-in ones.
assert.deepEqual(
  parseImageReadingSettings({ prompt: "  ", request: "", maxTokens: 5, temperature: 9 }),
  DEFAULT_IMAGE_READING_SETTINGS,
);

// A thinking model's inline reasoning never becomes the description; reasoning cut off by the limit says so.
assert.equal(stripCaptionThinking("<think>hmm</think>\n\nAn owl on a branch."), "An owl on a branch.");
assert.equal(stripCaptionThinking("the template opened it</think>An owl."), "An owl.");
assert.equal(stripCaptionThinking("<think>still thinking when the limit hit"), null);
assert.equal(stripCaptionThinking("An owl."), "An owl.");
const thinkingProvider = new RecordingProvider("<think>still thinking", "length");
await assert.rejects(
  generateImageCaptionsForDataUrls(
    [{ filename: "owl.png", imageDataUrl: dataUrl("owl") }],
    { ...runtime, provider: thinkingProvider },
    signal,
  ),
  /reached its answer length before writing a description/u,
);
// The template opened the thinking and the limit hit before it closed: no tags at all, still not a description.
await assert.rejects(
  generateImageCaptionsForDataUrls(
    [{ filename: "owl.png", imageDataUrl: dataUrl("owl") }],
    { ...runtime, provider: new RecordingProvider("Okay, let me look at this picture. The user wants", "length") },
    signal,
  ),
  /reached its answer length before writing a description/u,
);
// A description cut off by the limit is still a description.
const [truncated] = await generateImageCaptionsForDataUrls(
  [{ filename: "owl.png", imageDataUrl: dataUrl("owl") }],
  { ...runtime, provider: new RecordingProvider("A brown owl perched on a mossy branch, its feathers", "length") },
  signal,
);
assert.equal(truncated?.caption, "A brown owl perched on a mossy branch, its feathers");
// Each caption carries the key of the prompt it was made with.
assert.match(truncated?.promptKey ?? "", /^[0-9a-f]{16}$/u);
setImageReadingSettings(DEFAULT_IMAGE_READING_SETTINGS);

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
