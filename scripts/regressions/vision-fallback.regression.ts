import assert from "node:assert/strict";

import { LOCAL_SIDECAR_CONNECTION_ID, modelReadsImages } from "../../packages/shared/src/index.js";
import {
  resolveImageCaptioningRuntime,
  withImageCaptionFallback,
  type ImageCaptionConnection,
  type ImageCaptioningRuntime,
} from "../../packages/server/src/services/generation/image-captioning-runtime.js";
import {
  BaseLLMProvider,
  LLMHttpError,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";

// Capability: the Model's own setting, then its catalog; unknown is null (images are sent). The sidecar never reads.
assert.equal(modelReadsImages({ imageInput: "reads" }, { inputModalities: ["text"] }), true, "the setting wins");
assert.equal(modelReadsImages({ imageInput: "text" }, { inputModalities: ["text", "image"] }), false);
assert.equal(modelReadsImages({ imageInput: null }, { inputModalities: ["text", "image"] }), true, "then the catalog");
assert.equal(modelReadsImages({}, { inputModalities: ["text"] }), false);
assert.equal(modelReadsImages({}, { inputModalities: [] }), null, "an empty list says nothing");
assert.equal(modelReadsImages({}, null), null, "no catalog: unknown");
assert.equal(modelReadsImages({ id: LOCAL_SIDECAR_CONNECTION_ID, imageInput: "reads" }), false);

// Resolver: Automatic mode and the captioning Model order (chat > Model default > Image reading > own Model).
const row = (id: string, extra: Partial<ImageCaptionConnection> = {}): ImageCaptionConnection => ({
  id,
  provider: "openai",
  apiKey: "",
  model: `${id}-model`,
  baseUrl: `http://localhost/${id}/v1`,
  ...extra,
});
const rows = new Map(
  [
    row("text-only", { imageInput: "text" }),
    row("catalog-text", { accountId: "acct" }),
    row("catalog-vision", { accountId: "acct" }),
    row("unknown"),
    row("own-pick", { defaultParameters: JSON.stringify({ imageCaptioningEnabled: true }) }),
    row("model-pick", {
      imageInput: "text",
      defaultParameters: JSON.stringify({ imageCaptioningConnectionId: "picked" }),
    }),
    row("vision"),
    row("picked"),
    row("chat-pick"),
  ].map((entry) => [entry.id, entry]),
);
const connections = {
  listRandomPool: async () => [],
  getWithKey: async (id: string) => rows.get(id) ?? null,
  getFallbackForAgents: async () => null,
  readCatalog: async (entry: { accountId?: string | null }) =>
    entry.accountId === "acct"
      ? {
          models: [
            { id: "catalog-text-model", inputModalities: ["text"] },
            { id: "catalog-vision-model", inputModalities: ["text", "image"] },
          ],
        }
      : null,
};
const resolve = (
  fallbackConnectionId: string,
  extra: { chatMeta?: Record<string, unknown>; vision?: string | null } = {},
) =>
  resolveImageCaptioningRuntime({
    chatMeta: extra.chatMeta ?? {},
    fallbackConnectionId,
    connections,
    visionConnectionId: extra.vision === undefined ? "vision" : extra.vision,
  });

assert.equal((await resolve("text-only")).connectionId, "vision", "a text-only Model is captioned by Image reading");
assert.equal((await resolve("catalog-text")).connectionId, "vision", "the catalog says text only");
assert.equal((await resolve("catalog-vision")).enabled, false, "a Model that reads images gets them");
assert.equal((await resolve("unknown")).enabled, false, "unknown: the images are sent");
assert.equal((await resolve("text-only", { vision: null })).enabled, false, "no Image reading model: unchanged");
assert.equal(
  (await resolve("text-only", { chatMeta: { imageCaptioningEnabled: false } })).enabled,
  false,
  "the chat's switch wins",
);
assert.equal((await resolve("model-pick")).connectionId, "picked", "the Model's captioning pick beats Image reading");
assert.equal(
  (await resolve("model-pick", { chatMeta: { imageCaptioningConnectionId: "chat-pick" } })).connectionId,
  "chat-pick",
  "the chat's pick beats both",
);
assert.equal((await resolve("own-pick")).connectionId, "vision", "captioning on without a pick uses Image reading");
assert.equal((await resolve("own-pick", { vision: null })).connectionId, "own-pick", "then the chat's own Model");
assert.equal(
  (
    await resolve("unknown", {
      chatMeta: { imageCaptioningEnabled: true, imageCaptioningConnectionId: LOCAL_SIDECAR_CONNECTION_ID },
    })
  ).connectionId,
  "vision",
  "the on-device model is never a captioning Model",
);
assert.equal((await resolve(LOCAL_SIDECAR_CONNECTION_ID)).connectionId, "vision", "a sidecar chat is captioned");
assert.match(
  (await resolve(LOCAL_SIDECAR_CONNECTION_ID, { chatMeta: { imageCaptioningEnabled: true }, vision: null }))
    .unavailableReason ?? "",
  /local model cannot read images/,
);

// Runtime fallback: a refusal before output is retried once with captions; later requests caption straight away.
const image = "data:image/png;base64,AAAA";
class ChatProvider extends BaseLLMProvider {
  seen: ChatMessage[][] = [];
  constructor() {
    super("", "");
  }
  async *chat(messages: ChatMessage[], _options: ChatOptions) {
    this.seen.push(messages);
    if (messages.some((message) => message.images?.length)) {
      throw new LLMHttpError("This model does not support image input", { status: 400 });
    }
    yield "ok";
  }
}
class CaptionProvider extends BaseLLMProvider {
  calls = 0;
  constructor() {
    super("", "");
  }
  async *chat() {
    this.calls += 1;
    yield "a red square";
  }
}
const chat = new ChatProvider();
const captioner = new CaptionProvider();
const runtime: ImageCaptioningRuntime = {
  enabled: true,
  connectionId: "vision",
  connection: row("vision"),
  provider: captioner,
};
const wrapped = withImageCaptionFallback(chat, async () => runtime);
const messages: ChatMessage[] = [{ role: "user", content: "Look", images: [image] }];
const first = await wrapped.chatComplete(messages, { model: "m" });
assert.equal(first.content, "ok");
assert.equal(chat.seen.length, 2, "one refusal, one retry");
assert.equal(chat.seen[1]![0]!.images, undefined, "the retry sends no images");
assert.match(
  chat.seen[1]![0]!.content,
  /<attached_image name="image-1" type="image">\na red square\n<\/attached_image>/,
);
await wrapped.chatComplete(messages, { model: "m" });
assert.equal(chat.seen.length, 3, "after a refusal the images go as captions at once");
assert.equal(captioner.calls, 1, "each image is described once");

const noVision = withImageCaptionFallback(new ChatProvider(), async () => ({ ...runtime, provider: null }));
await assert.rejects(noVision.chatComplete(messages, { model: "m" }), /does not support image input/);

// #9342 (Professor Mari): a caption says which model described the picture; without an Image reading model the
// picture is replaced by a note and the request goes on, now and on every later request of the run.
const labelled = new ChatProvider();
const marked = withImageCaptionFallback(labelled, async () => runtime, false, {
  captionNote: (model) => `[described by ${model}, not seen]`,
});
await marked.chatComplete(messages, { model: "m" });
assert.match(labelled.seen[1]![0]!.content, /^Look\n\n\[described by vision-model, not seen\]\n<attached_image /);
const blind = new ChatProvider();
const noted = withImageCaptionFallback(blind, async () => ({ ...runtime, provider: null }), false, {
  unavailableNote: "[picture not shown]",
});
assert.equal((await noted.chatComplete(messages, { model: "m" })).content, "ok");
assert.equal(blind.seen[1]![0]!.images, undefined);
assert.equal(blind.seen[1]![0]!.content, "Look\n\n[picture not shown]");
await noted.chatComplete(messages, { model: "m" });
assert.equal(blind.seen.length, 3, "later requests send the note at once");

// A Model known not to read images (the on-device one drops them silently) gets captions on the first request.
const silent = new ChatProvider();
const upfront = withImageCaptionFallback(silent, async () => runtime, false, { readsImages: false });
await upfront.chatComplete(messages, { model: "m" });
assert.equal(silent.seen.length, 1, "no refusal round trip");
assert.equal(silent.seen[0]![0]!.images, undefined);
assert.match(silent.seen[0]![0]!.content, /a red square/);

// A caption call that fails falls back to the note instead of ending the request.
class FailingCaptioner extends BaseLLMProvider {
  constructor() {
    super("", "");
  }
  async *chat(): AsyncGenerator<string> {
    throw new Error("captioner down");
  }
}
const failing = new ChatProvider();
const failed = withImageCaptionFallback(
  failing,
  async () => ({ ...runtime, provider: new FailingCaptioner() }),
  false,
  {
    readsImages: false,
    unavailableNote: "[picture not shown]",
  },
);
assert.equal((await failed.chatComplete(messages, { model: "m" })).content, "ok");
assert.equal(failing.seen[0]![0]!.content, "Look\n\n[picture not shown]");
const strict = withImageCaptionFallback(
  new ChatProvider(),
  async () => ({ ...runtime, provider: new FailingCaptioner() }),
  false,
  {
    readsImages: false,
  },
);
await assert.rejects(
  strict.chatComplete(messages, { model: "m" }),
  /caption|captioner down/i,
  "no note: the failure stands",
);

console.log("vision fallback regression passed");
