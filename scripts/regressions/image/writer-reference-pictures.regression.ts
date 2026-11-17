import assert from "node:assert/strict";
import {
  BaseLLMProvider,
  LLMHttpError,
  type ChatMessage,
  type ChatOptions,
} from "../../../packages/server/src/services/llm/base-provider.js";
import {
  attachWriterReferencePictures,
  prepareWriterReferencePicture,
  readWriterReferencePayload,
  withWriterReferenceFallback,
  writerRejectsPictures,
  writerVisionKey,
  WRITER_REFERENCE_MEMORY_KEY,
} from "../../../packages/server/src/services/image/writer-reference-pictures.js";
import {
  DEFAULT_WRITER_REFERENCE_INSTRUCTION,
  readWriterReferenceSettings,
  resolveReferencePictureTarget,
  routeReferencePictures,
} from "../../../packages/shared/src/features/agents/writer-reference-settings.js";

// Settings: automatic by default, empty instruction means the default text, junk falls back to automatic.
assert.deepEqual(readWriterReferenceSettings({}), {
  target: "auto",
  instruction: DEFAULT_WRITER_REFERENCE_INSTRUCTION,
});
assert.deepEqual(
  readWriterReferenceSettings({ referencePictureTarget: "writer", writerReferenceInstruction: "  Only the style.  " }),
  { target: "writer", instruction: "Only the style." },
);
assert.equal(readWriterReferenceSettings({ referencePictureTarget: "cast" }).target, "auto");

// The chat's pick wins over the agent's; a missing or unknown chat value keeps the agent's.
assert.equal(resolveReferencePictureTarget("both", { referencePictureTarget: "image" }), "both");
assert.equal(resolveReferencePictureTarget(undefined, { referencePictureTarget: "image" }), "image");
assert.equal(resolveReferencePictureTarget("nope", null), "auto");

// Routing: who gets the pictures, given whether the image connection takes them.
const route = (target: Parameters<typeof routeReferencePictures>[0], takes: boolean) =>
  routeReferencePictures(target, takes);
assert.deepEqual(route("auto", true), { toImageModel: true, toWriter: false });
assert.deepEqual(route("auto", false), { toImageModel: false, toWriter: true });
assert.deepEqual(route("image", false), { toImageModel: true, toWriter: false });
assert.deepEqual(route("writer", true), { toImageModel: false, toWriter: true });
assert.deepEqual(route("both", true), { toImageModel: true, toWriter: true });

// Pictures become JPEG data URLs; something that isn't a picture is refused.
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2jX8AAAAASUVORK5CYII=";
const prepared = await prepareWriterReferencePicture(png);
assert.ok(prepared?.startsWith("data:image/"), "a PNG becomes a data URL");
assert.equal(await prepareWriterReferencePicture(Buffer.from("not a picture").toString("base64")), null);

// The block and the pictures land on the last user message, labeled by number.
const payload = { instruction: "Only the style.", pictures: [{ label: "Aria", dataUrl: prepared! }] };
assert.equal(readWriterReferencePayload({}), null);
assert.deepEqual(readWriterReferencePayload({ [WRITER_REFERENCE_MEMORY_KEY]: payload }), payload);
const base: ChatMessage[] = [
  { role: "system", content: "You write image prompts." },
  { role: "user", content: "Scene." },
];
const attached = attachWriterReferencePictures(base, payload);
assert.equal(base[1]!.images, undefined, "the input is not mutated");
assert.deepEqual(attached[1]!.images, [prepared]);
assert.match(attached[1]!.content, /<reference_pictures>\nOnly the style\.\nPicture 1: Aria/);

// Try first, fail gracefully, remember: a refusal retries without the pictures and is remembered.
class FakeProvider extends BaseLLMProvider {
  requests: ChatMessage[][] = [];
  constructor(private readonly refuses: boolean) {
    super("", "");
  }
  async *chat(input: ChatMessage[], _options: ChatOptions) {
    this.requests.push(input);
    if (this.refuses && input.some((message) => message.images?.length)) {
      throw new LLMHttpError("This model does not support image inputs", { status: 400 });
    }
    yield "ok";
  }
}
const options = { model: "writer" };
const key = writerVisionKey("conn-text", "writer");
assert.equal(writerRejectsPictures(key), false);
const refusing = new FakeProvider(true);
const result = await withWriterReferenceFallback(refusing, payload, key).chatComplete(attached, options);
assert.equal(result.content, "ok");
assert.equal(refusing.requests.length, 2);
assert.equal(refusing.requests[1]![1]!.images, undefined, "the retry carries no pictures");
assert.equal(writerRejectsPictures(key), true, "the refusal is remembered for this connection and model");

const seeing = new FakeProvider(false);
await withWriterReferenceFallback(seeing, payload, writerVisionKey("conn-vision", "writer")).chatComplete(
  attached,
  options,
);
assert.equal(seeing.requests.length, 1);
assert.deepEqual(seeing.requests[0]![1]!.images, [prepared], "a vision writer gets the pictures");
assert.equal(writerRejectsPictures(writerVisionKey("conn-vision", "writer")), false);

console.log("writer-reference-pictures regression passed");
