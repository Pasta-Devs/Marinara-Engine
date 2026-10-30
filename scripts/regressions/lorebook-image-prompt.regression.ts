import assert from "node:assert/strict";
import {
  BaseLLMProvider,
  LLMHttpError,
  type ChatMessage,
  type ChatOptions,
} from "../../packages/server/src/services/llm/base-provider.js";
import { withLorebookImageCompatibility } from "../../packages/server/src/services/llm/lorebook-image-provider.js";
import { appendLorebookImageMessages } from "../../packages/server/src/services/generation/lorebook-image-prompt.js";
import {
  discardLorebookImage,
  saveLorebookImage,
} from "../../packages/server/src/services/lorebook/lorebook-images.js";
import { processActivatedEntries } from "../../packages/server/src/services/lorebook/prompt-injector.js";
import {
  scopeLorebookScanResultToCharacterContext,
  resolveBudgetAndRecursivelyActivateLorebookEntries,
} from "../../packages/server/src/services/lorebook/index.js";
import { createLorebookEntrySchema, type LorebookEntry, type ChatMLMessage } from "../../packages/shared/dist/index.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jX8AAAAASUVORK5CYII=",
  "base64",
);
const image = { ...(await saveLorebookImage(png)), caption: "Blue coat" };
const makeEntry = (id: string, overrides: Partial<LorebookEntry> = {}) =>
  ({
    ...createLorebookEntrySchema.parse({
      lorebookId: "book",
      name: id,
      content: `Text ${id}`,
      keys: ["wardrobe"],
      images: [image],
    }),
    id,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }) as LorebookEntry;
const entry = makeEntry("outfit");
const activation = { entry, matchedKeys: ["wardrobe"], activationSources: ["keyword" as const], injectionOrder: 100 };
assert.equal(
  processActivatedEntries([activation], 1).imageEntries,
  undefined,
  "budget-rejected entries carry no images",
);
const textOnly = processActivatedEntries([activation], 50);
assert.equal(textOnly.totalEntries, 1, "entry text that fits the budget survives when its images do not");
assert.equal(textOnly.imageEntries, undefined, "over-budget images are dropped before the entry text");
const recursive = resolveBudgetAndRecursivelyActivateLorebookEntries(
  [{ role: "user", content: "wardrobe" }],
  [
    makeEntry("starter", { content: "recur-trigger", order: 0, preventRecursion: false }),
    makeEntry("later", {
      keys: ["recur-trigger"],
      content: "The queen guards the northern gate. ".repeat(15),
      order: 1,
      images: [],
    }),
  ],
  { scanDepth: 2 },
  2,
  new Map([["book", { name: "Book", tokenBudget: 1000, entryLimit: 100 }]]),
  300,
  100,
);
assert.deepEqual(
  recursive.map(({ entry }) => entry.id),
  ["starter", "later"],
);
assert.deepEqual(recursive[0]!.entry.images, [], "optional images cannot displace affordable recursive text");
const processed = processActivatedEntries([activation], 500);
assert.equal(processed.imageEntries?.length, 1);
assert.ok(processed.totalTokensEstimate >= 256, "images contribute to budget estimates");
const messages: ChatMLMessage[] = [
  { role: "system", content: processed.worldInfoBefore },
  { role: "user", content: "wardrobe", contextKind: "history" },
];
const urls = new Set<string>();
await appendLorebookImageMessages(messages, processed.imageEntries, { rememberImage: (url) => urls.add(url) });
assert.equal(messages[1]?.role, "user");
assert.deepEqual(messages[1]?.images, [...urls]);
assert.match(messages[1]!.content, /outfit.*\nReference 1: Blue coat/s);
assert.equal(messages[2]?.content, "wardrobe");
const outletMessages: ChatMLMessage[] = [{ role: "user", content: entry.content, contextKind: "prompt" }];
await appendLorebookImageMessages(outletMessages, [{ ...processed.imageEntries![0]!, position: 7 }]);
assert.equal(outletMessages.length, 1, "unused outlet does not leak images");
await appendLorebookImageMessages(outletMessages, [
  { ...processed.imageEntries![0]!, position: 7, content: "", outletUsed: true },
]);
assert.equal(outletMessages.length, 2, "used images-only outlet sends its references");
const prefilled: ChatMLMessage[] = [
  { role: "system", content: processed.worldInfoBefore, contextKind: "prompt" },
  { role: "assistant", content: "Prefill" },
];
await appendLorebookImageMessages(prefilled, processed.imageEntries);
assert.equal(prefilled.at(-1)?.content, "Prefill", "references never follow an assistant prefill");
const scan = {
  ...processed,
  activatedEntryIds: [entry.id],
  activatedEntries: [
    {
      id: entry.id,
      content: entry.content,
      matchedKeys: ["wardrobe"],
      activationSources: ["keyword" as const],
      matchType: "keyword" as const,
    },
  ],
  budgetSkippedEntries: [],
};
const privateEntry = { ...entry, characterFilterMode: "include" as const, characterFilterIds: ["alice"] };
assert.deepEqual(
  scopeLorebookScanResultToCharacterContext(scan, [privateEntry], { characterId: "bob" }).imageEntries,
  [],
  "responder-filtered entries carry no images",
);

class FakeProvider extends BaseLLMProvider {
  requests: ChatMessage[][] = [];
  error: Error | null = new LLMHttpError("This model does not support image inputs", { status: 400 });
  outputBeforeError = false;
  beforeError?: () => void;
  failWithoutImages = false;
  constructor() {
    super("", "");
  }
  async *chat(input: ChatMessage[], _options: ChatOptions) {
    this.requests.push(input);
    if ((this.failWithoutImages || input.some((m) => m.images?.some((url) => urls.has(url)))) && this.error) {
      this.beforeError?.();
      if (this.outputBeforeError) yield "partial";
      throw this.error;
    }
    yield "ok";
  }
}
const options = { model: "text-only" };
const fake = new FakeProvider();
let notices = 0;
const wrapped = withLorebookImageCompatibility(fake, urls, () => notices++);
let response = "";
for await (const token of wrapped.chat(messages, options)) response += token;
assert.equal(response, "ok");
assert.equal(fake.requests.length, 2);
assert.equal(fake.requests[1]![1]!.images, undefined);
assert.match(fake.requests[1]![1]!.content, /Blue coat/);
assert.equal(notices, 1);
const llama = new FakeProvider();
llama.error = new LLMHttpError(
  "Custom OpenAI-compatible endpoint error 500: image input is not supported - hint: if this is unexpected, you may need to provide the mmproj",
  { status: 500 },
);
let llamaNotices = 0;
const llamaResponse = await withLorebookImageCompatibility(llama, urls, () => llamaNotices++).chatComplete(
  messages,
  options,
);
assert.equal(llamaResponse.content, "ok", "explicit llama.cpp image-incompatibility500 retries as text");
assert.equal(llama.requests.length, 2);
assert.equal(llama.requests[1]![1]!.images, undefined);
assert.match(llama.requests[1]![1]!.content, /Blue coat/);
assert.equal(llamaNotices, 1);
const streamLlama = new FakeProvider();
streamLlama.error = llama.error;
let streamLlamaNotices = 0;
let streamLlamaText = "";
for await (const token of withLorebookImageCompatibility(streamLlama, urls, () => streamLlamaNotices++).chat(
  [...messages, { role: "user", content: "attachment", images: ["data:image/png;base64,dXNlcg=="] }],
  options,
))
  streamLlamaText += token;
assert.equal(streamLlamaText, "ok");
assert.equal(streamLlama.requests.length, 2);
assert.equal(streamLlama.requests[1]![1]!.images, undefined);
assert.deepEqual(streamLlama.requests[1]!.at(-1)!.images, ["data:image/png;base64,dXNlcg=="]);
assert.equal(streamLlamaNotices, 1);

for (const method of ["stream", "complete"] as const) {
  const consume = async (provider: BaseLLMProvider, input = messages, opts: ChatOptions = options) => {
    if (method === "complete") return provider.chatComplete(input, opts);
    for await (const _ of provider.chat(input, opts)) {
      /* consume */
    }
  };
  for (const error of [
    new LLMHttpError("Image server failed unexpectedly", { status: 500 }),
    new LLMHttpError("You may need to provide the mmproj", { status: 500 }),
    ...[401, 403, 429, 503].map((status) => new LLMHttpError("image input is not supported", { status })),
    new Error("image input is not supported"),
  ]) {
    const control = new FakeProvider();
    control.error = error;
    await assert.rejects(
      consume(withLorebookImageCompatibility(control, urls, () => assert.fail())),
      (actual) => actual === error,
    );
    assert.equal(control.requests.length, 1, `${method}: unrelated failures do not retry`);
  }
  const controller = new AbortController();
  const cancelled = new FakeProvider();
  cancelled.error = llama.error;
  cancelled.beforeError = () => controller.abort();
  await assert.rejects(
    consume(
      withLorebookImageCompatibility(cancelled, urls, () => assert.fail()),
      messages,
      { ...options, signal: controller.signal },
    ),
    (actual) => actual === llama.error,
  );
  assert.equal(cancelled.requests.length, 1, `${method}: cancellation prevents a compatibility retry`);
  const protectedImage = new FakeProvider();
  protectedImage.error = llama.error;
  await assert.rejects(
    consume(withLorebookImageCompatibility(protectedImage, urls, () => assert.fail(), urls)),
    (actual) => actual === llama.error,
  );
  assert.equal(protectedImage.requests.length, 1, `${method}: no removable lorebook references means no retry`);
  const twice = new FakeProvider();
  twice.error = llama.error;
  twice.failWithoutImages = true;
  let twiceNotices = 0;
  await assert.rejects(
    consume(withLorebookImageCompatibility(twice, urls, () => twiceNotices++)),
    (actual) => actual === llama.error,
  );
  assert.equal(twice.requests.length, 2, `${method}: a failed text retry is not retried again`);
  assert.equal(twiceNotices, 1);
}
const partial500 = new FakeProvider();
partial500.error = llama.error;
partial500.outputBeforeError = true;
await assert.rejects(
  async () => {
    for await (const _ of withLorebookImageCompatibility(partial500, urls, () => assert.fail()).chat(
      messages,
      options,
    )) {
      /* consume */
    }
  },
  (actual) => actual === llama.error,
);
assert.equal(partial500.requests.length, 1, "500 after streamed output must never replay the reply");
const token500 = new FakeProvider();
token500.error = llama.error;
token500.outputBeforeError = true;
const delivered: string[] = [];
const partialCompletion = await withLorebookImageCompatibility(token500, urls, () => assert.fail()).chatComplete(
  messages,
  {
    ...options,
    onToken: (token) => {
      delivered.push(token);
    },
  },
);
assert.equal(partialCompletion.content, "partial");
assert.deepEqual(delivered, ["partial"]);
assert.equal(token500.requests.length, 1, "nonstream completion with delivered tokens never replays the reply");
await wrapped.chatComplete(
  [...messages, { role: "user", content: "attachment", images: ["data:image/png;base64,dXNlcg=="] }],
  options,
);
assert.deepEqual(
  fake.requests.at(-1)!.at(-1)!.images,
  ["data:image/png;base64,dXNlcg=="],
  "unrelated chat images preserved",
);
const identical = new FakeProvider();
await assert.rejects(async () => {
  const wrapped = withLorebookImageCompatibility(identical, urls, () => assert.fail(), urls);
  await wrapped.chatComplete(
    [...messages, { role: "user", content: "Same chat attachment", images: [...urls] }],
    options,
  );
}, /not support/);
assert.equal(
  identical.requests.length,
  1,
  "identical chat attachments must never be silently stripped as lorebook references",
);
const rejected = new FakeProvider();
rejected.error = new LLMHttpError("Rate limited image model", { status: 429 });
await assert.rejects(async () => {
  for await (const _ of withLorebookImageCompatibility(rejected, urls, () => assert.fail()).chat(messages, options)) {
    /* consume */
  }
}, /Rate limited/);
assert.equal(rejected.requests.length, 1, "non-compatibility errors do not retry");
const partial = new FakeProvider();
partial.outputBeforeError = true;
await assert.rejects(async () => {
  for await (const _ of withLorebookImageCompatibility(partial, urls, () => assert.fail()).chat(messages, options)) {
    /* consume */
  }
}, /not support/);
assert.equal(partial.requests.length, 1, "streamed output must never be replayed");
await discardLorebookImage(image);
console.info("Lorebook image prompt regressions passed");
