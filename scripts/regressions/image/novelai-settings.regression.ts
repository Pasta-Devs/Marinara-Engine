// NovelAI image settings: subject counts in a prompt, image sizes and the defaults a connection profile gets.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mock } from "node:test";
import { deflateSync } from "node:zlib";
import {
  clampNovelAiCanvasSize,
  detectNovelAiSubjectCount,
  generateImage,
  imageConnectionTakesReferencePicture,
  NovelAiEditInputError,
  prepareNovelAiEditInputs,
  readNovelAiPngSeed,
  resolveNovelAiDefaults,
  resolveNovelAiInpaintingModel,
  resolveNovelAiRequestSize,
  resolveNovelAiSize,
} from "../../../packages/server/src/services/image/image-generation.js";
import {
  isNovelAiCharacterPromptModel,
  resolveNovelAiCharacterPromptLimit,
} from "../../../packages/server/src/services/image/character-prompts.js";
import { getSharp } from "../../../packages/server/src/services/image/sharp-runtime.js";
import { isNativeNovelAiConnection } from "../../../packages/shared/dist/index.js";
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

// Native NovelAI host & connection detection (excludes HTTP, non-NovelAI proxies, non-image connections).
assert.equal(isNativeNovelAiConnection({ provider: "image_generation", baseUrl: "https://image.novelai.net" }), true);
assert.equal(isNativeNovelAiConnection({ provider: "image_generation", baseUrl: "https://novelai.net/" }), true);
assert.equal(isNativeNovelAiConnection({ provider: "image_generation", baseUrl: "http://image.novelai.net" }), false);
assert.equal(
  isNativeNovelAiConnection({ provider: "image_generation", baseUrl: "https://novelai-proxy.example.com" }),
  false,
);
assert.equal(
  isNativeNovelAiConnection({
    provider: "image_generation",
    baseUrl: "https://image.novelai.net",
    imageService: "openai",
  }),
  false,
);
assert.equal(isNativeNovelAiConnection({ provider: "custom", baseUrl: "https://image.novelai.net" }), false);

// Inpainting model ID mapping stays idempotent and keeps V4 curated mapped properly.
assert.equal(resolveNovelAiInpaintingModel("nai-diffusion-5-full"), "nai-diffusion-5-full-inpainting");
assert.equal(resolveNovelAiInpaintingModel("nai-diffusion-5-full-inpainting"), "nai-diffusion-5-full-inpainting");
assert.equal(resolveNovelAiInpaintingModel("nai-diffusion-4-5-curated"), "nai-diffusion-4-5-curated-inpainting");
assert.equal(resolveNovelAiInpaintingModel("nai-diffusion-4-curated-preview"), "nai-diffusion-4-curated-inpainting");

// Inpainting model suffixes retain character-prompt limits and V4.5 precise reference support.
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-4-5-full-inpainting"), 6);
assert.equal(resolveNovelAiCharacterPromptLimit("nai-diffusion-5-full-inpainting"), 22);
assert.equal(isNovelAiCharacterPromptModel("nai-diffusion-4-curated-inpainting"), true);
assert.equal(
  imageConnectionTakesReferencePicture({
    source: "novelai",
    baseUrl: "https://image.novelai.net",
    serviceHint: "novelai",
    model: "nai-diffusion-4-5-full-inpainting",
  }),
  true,
);

// PNG chunk helpers for readNovelAiPngSeed fallback tests (tEXt Comment and zTXt).
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBytes, data]);
  let crc = 0xffffffff;
  for (let i = 0; i < body.length; i++) {
    crc ^= body[i]!;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcBuf]);
}

function injectTestTextChunk(
  png: Buffer,
  type: "tEXt" | "zTXt" | "iTXt",
  keyword: string,
  text: string,
  options?: { compressed?: boolean; compressionMethod?: number },
): Buffer {
  let data: Buffer;
  if (type === "tEXt") {
    data = Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(text, "utf8")]);
  } else if (type === "zTXt") {
    data = Buffer.concat([
      Buffer.from(keyword, "latin1"),
      Buffer.from([0, options?.compressionMethod ?? 0]),
      deflateSync(Buffer.from(text, "utf8")),
    ]);
  } else {
    const compressed = options?.compressed === true ? 1 : 0;
    const method = options?.compressionMethod ?? 0;
    const rawPayload = Buffer.from(text, "utf8");
    const payload = compressed === 1 ? deflateSync(rawPayload) : rawPayload;
    data = Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0, compressed, method, 0, 0]), payload]);
  }
  const chunk = pngChunk(type, data);
  const parts: Buffer[] = [png.subarray(0, 8)];
  let offset = 8;
  let injected = false;
  while (offset + 12 <= png.length) {
    const chunkLen = png.readUInt32BE(offset);
    const total = 12 + chunkLen;
    const chunkType = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (!injected && (chunkType === "IDAT" || chunkType === "IEND")) {
      parts.push(chunk);
      injected = true;
    }
    parts.push(png.subarray(offset, offset + total));
    offset += total;
  }
  return Buffer.concat(parts);
}

function readITXtText(png: Buffer, keyword: string): string | null {
  let offset = 8;
  while (offset + 12 <= png.length) {
    const chunkLen = png.readUInt32BE(offset);
    const chunkType = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "iTXt") {
      const data = png.subarray(offset + 8, offset + 8 + chunkLen);
      const kwEnd = data.indexOf(0);
      if (kwEnd > 0 && data.subarray(0, kwEnd).toString("latin1") === keyword) {
        const langEnd = data.indexOf(0, kwEnd + 3);
        const transEnd = langEnd === -1 ? -1 : data.indexOf(0, langEnd + 1);
        if (transEnd !== -1) return data.subarray(transEnd + 1).toString("utf8");
      }
    }
    offset += 12 + chunkLen;
  }
  return null;
}

const sharp = await getSharp();
assert.ok(sharp, "sharp is available for NovelAI edit preprocessing");

const sampleSource = await sharp({
  create: { width: 768, height: 512, channels: 3, background: { r: 40, g: 80, b: 140 } },
})
  .png()
  .toBuffer();

// Build an unaligned soft/thin-stroke mask over 768x512 and verify exact 8x8 max/any-pixel quantization + binarization.
const rawSoftMask = Buffer.alloc(768 * 512);
for (let y = 0; y < 512; y++) {
  for (let x = 0; x < 768; x++) {
    const inUnalignedBox = x >= 131 && x < 253 && y >= 67 && y < 189;
    const inThinStroke = x >= 402 && x < 404 && y >= 200 && y < 216;
    rawSoftMask[y * 768 + x] = inUnalignedBox || inThinStroke ? 200 : x < 16 ? 120 : 0;
  }
}
const softMaskPng = await sharp(rawSoftMask, { raw: { width: 768, height: 512, channels: 1 } })
  .png()
  .toBuffer();

const preparedEdit = await prepareNovelAiEditInputs(
  `data:image/png;base64,${sampleSource.toString("base64")}`,
  `data:image/png;base64,${softMaskPng.toString("base64")}`,
);
assert.equal(preparedEdit.width, 768);
assert.equal(preparedEdit.height, 512);
assert.ok(preparedEdit.maskBase64);
const maskPixels = await sharp(Buffer.from(preparedEdit.maskBase64, "base64"))
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
assert.equal(maskPixels.info.width, 768);
assert.equal(maskPixels.info.height, 512);
for (let i = 0; i < maskPixels.data.length; i += maskPixels.info.channels) {
  const v = maskPixels.data[i]!;
  assert.ok(v === 0 || v === 255, `Expected binary mask pixel 0 or 255, got ${v}`);
}
// Every pixel in every 8x8 block must match exact white/black block coverage (catching thin strokes and unaligned edges).
for (let by = 0; by < 512; by += 8) {
  for (let bx = 0; bx < 768; bx += 8) {
    let intersectsPainted = false;
    for (let dy = 0; dy < 8 && !intersectsPainted; dy++) {
      for (let dx = 0; dx < 8; dx++) {
        const px = bx + dx;
        const py = by + dy;
        if ((px >= 131 && px < 253 && py >= 67 && py < 189) || (px >= 402 && px < 404 && py >= 200 && py < 216)) {
          intersectsPainted = true;
          break;
        }
      }
    }
    const expected = intersectsPainted ? 255 : 0;
    const ch = maskPixels.info.channels;
    for (let dy = 0; dy < 8; dy++) {
      for (let dx = 0; dx < 8; dx++) {
        assert.equal(maskPixels.data[((by + dy) * 768 + (bx + dx)) * ch]!, expected);
      }
    }
  }
}

// Aspect-preserving NovelAI canvas clamp keeps source proportions across 2048 px sides, pixel budget, and slivers.
assert.deepEqual(clampNovelAiCanvasSize(4032, 3024), { width: 1152, height: 832 });
assert.deepEqual(clampNovelAiCanvasSize(3024, 4032), { width: 832, height: 1152 });
assert.deepEqual(clampNovelAiCanvasSize(1600, 1200), { width: 1152, height: 832 });
assert.deepEqual(clampNovelAiCanvasSize(4032, 100), { width: 2048, height: 64 });
assert.deepEqual(clampNovelAiCanvasSize(768, 512), { width: 768, height: 512 });
assert.deepEqual(clampNovelAiCanvasSize(1185, 865), { width: 1152, height: 832 });

// Corrupted source bytes convert into NovelAiEditInputError (400) rather than opaque 500s.
await assert.rejects(
  prepareNovelAiEditInputs(Buffer.from("not-an-image").toString("base64")),
  (err: unknown) => err instanceof NovelAiEditInputError,
);

// Large 4:3 edit source preserves its 4:3 proportion instead of collapsing to 1024x1024.
const largeLandscapeSource = await sharp({
  create: { width: 4032, height: 3024, channels: 3, background: { r: 20, g: 50, b: 90 } },
})
  .png({ compressionLevel: 1 })
  .toBuffer();
const preparedLargeEdit = await prepareNovelAiEditInputs(largeLandscapeSource.toString("base64"));
assert.equal(preparedLargeEdit.width, 1152);
assert.equal(preparedLargeEdit.height, 832);
assert.equal(preparedLargeEdit.width % 64, 0);
assert.equal(preparedLargeEdit.height % 64, 0);
assert.ok(preparedLargeEdit.width * preparedLargeEdit.height <= 1024 * 1024);

// Empty mask is rejected cleanly before calling NovelAI.
const emptyMaskPng = await sharp({
  create: { width: 768, height: 512, channels: 3, background: { r: 0, g: 0, b: 0 } },
})
  .png()
  .toBuffer();
await assert.rejects(
  prepareNovelAiEditInputs(sampleSource.toString("base64"), emptyMaskPng.toString("base64")),
  /Inpainting mask is empty/,
);

// Mock NovelAI transport to assert img2img, infill, seedOverride, dynamic resolution bypass,
// reference omission, and iTXt redaction + seed recovery.
const capturedPayloads: Array<Record<string, unknown>> = [];
const dnsMock = mock.method(dns, "lookup", async (hostname: string) => {
  assert.equal(hostname, "image.novelai.net");
  return [{ address: "8.8.8.8", family: 4 }];
});
const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.origin, "https://image.novelai.net");
  assert.equal(url.pathname, "/ai/generate-image");
  assert.equal(typeof init?.body, "string", "Edit requests must send JSON, never multipart director refs");
  capturedPayloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
  return new Response(new Uint8Array(sampleSource), { status: 200, headers: { "content-type": "image/png" } });
});

try {
  // 1) img2img keeps base model, locks canvas size (ignoring dynamicResolutionBySubjectCount),
  //    drops director_reference_images, forwards seedOverride & character captions, redacts metadata.
  const img2imgRes = await generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
    prompt: "1girl, glowing runes",
    negativePrompt: "lowres",
    model: "nai-diffusion-5-full",
    editMode: "img2img",
    sourceImage: sampleSource.toString("base64"),
    strength: 0.65,
    noise: 0.15,
    seedOverride: 424242,
    referenceImage: sampleSource.toString("base64"),
    characterPrompts: [{ name: "Aster", prompt: "girl, red hair", position: { x: 0.3, y: 0.5 } }],
    imageDefaults: {
      version: 1,
      service: "novelai",
      seed: -1,
      novelai: { ...DEFAULT_NOVELAI_DEFAULTS, dynamicResolutionBySubjectCount: true },
    },
  });

  assert.equal(img2imgRes.seed, 424242);
  assert.equal(img2imgRes.width, 768);
  assert.equal(img2imgRes.height, 512);
  const img2imgBody = capturedPayloads[0]!;
  assert.equal(img2imgBody.action, "img2img");
  assert.equal(img2imgBody.model, "nai-diffusion-5-full");
  const img2imgParams = img2imgBody.parameters as Record<string, unknown>;
  assert.equal(img2imgParams.width, 768);
  assert.equal(img2imgParams.height, 512);
  assert.equal(img2imgParams.seed, 424242);
  assert.equal(img2imgParams.extra_noise_seed, 424242);
  assert.equal(img2imgParams.strength, 0.65);
  assert.equal(img2imgParams.noise, 0.15);
  assert.equal(img2imgParams.color_correct, true);
  assert.equal(typeof img2imgParams.image, "string");
  assert.equal(img2imgParams.director_reference_images, undefined);
  assert.ok(img2imgParams.v4_prompt);
  assert.equal(
    ((img2imgParams.v4_prompt as Record<string, any>).caption.char_captions as Array<any>)[0].char_caption,
    "girl, red hair",
  );

  // Verify output PNG metadata kept seed and redacted image payload.
  const img2imgPng = Buffer.from(img2imgRes.base64, "base64");
  assert.equal(readNovelAiPngSeed(img2imgPng), 424242);
  const embeddedMeta = JSON.parse(readITXtText(img2imgPng, "marinara_novelai_request") ?? "{}") as {
    request?: { parameters?: Record<string, unknown> };
  };
  assert.equal(embeddedMeta.request?.parameters?.image, "[omitted]");

  // 2) infill uses -inpainting model, preserves V4/V5 v4_prompt + captions, sets img2img + mask, redacts both.
  const infillRes = await generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
    prompt: "1girl, smiling",
    negativePrompt: "lowres",
    model: "nai-diffusion-5-full",
    editMode: "infill",
    sourceImage: sampleSource.toString("base64"),
    maskImage: softMaskPng.toString("base64"),
    strength: 0.9,
    seedOverride: 777888,
    characterPrompts: [{ name: "Aster", prompt: "girl, happy expression", position: { x: 0.4, y: 0.3 } }],
  });
  assert.equal(infillRes.seed, 777888);
  const infillBody = capturedPayloads[1]!;
  assert.equal(infillBody.action, "infill");
  assert.equal(infillBody.model, "nai-diffusion-5-full-inpainting");
  const infillParams = infillBody.parameters as Record<string, unknown>;
  assert.equal(infillParams.params_version, 3);
  assert.equal(infillParams.add_original_image, true);
  assert.equal(infillParams.strength, 0.9);
  assert.equal(infillParams.noise, 0);
  assert.equal(infillParams.seed, 777888);
  assert.equal(infillParams.extra_noise_seed, 777888);
  assert.deepEqual(infillParams.img2img, {
    strength: 0.9,
    noise: 0,
    extra_noise_seed: 777888,
    color_correct: true,
  });
  assert.equal(typeof infillParams.image, "string");
  assert.equal(typeof infillParams.mask, "string");
  assert.ok(infillParams.v4_prompt);
  assert.equal(
    ((infillParams.v4_prompt as Record<string, any>).caption.char_captions as Array<any>)[0].char_caption,
    "girl, happy expression",
  );
  const infillPng = Buffer.from(infillRes.base64, "base64");
  assert.equal(readNovelAiPngSeed(infillPng), 777888);
  const infillMeta = JSON.parse(readITXtText(infillPng, "marinara_novelai_request") ?? "{}") as {
    request?: { parameters?: Record<string, unknown> };
  };
  assert.equal(infillMeta.request?.parameters?.image, "[omitted]");
  assert.equal(infillMeta.request?.parameters?.mask, "[omitted]");

  // 3) readNovelAiPngSeed supports Comment tEXt/zTXt/compressed iTXt, handles seed 0, rejects invalid uint32 / bad method / oversized chunks.
  const commentPng = injectTestTextChunk(sampleSource, "tEXt", "Comment", JSON.stringify({ seed: 987654321 }));
  assert.equal(readNovelAiPngSeed(commentPng), 987654321);
  const compressedCommentPng = injectTestTextChunk(sampleSource, "zTXt", "Comment", JSON.stringify({ seed: 13579 }));
  assert.equal(readNovelAiPngSeed(compressedCommentPng), 13579);
  const zeroSeedPng = injectTestTextChunk(sampleSource, "iTXt", "Comment", JSON.stringify({ seed: 0 }), {
    compressed: true,
  });
  assert.equal(readNovelAiPngSeed(zeroSeedPng), 0);
  const badMethodPng = injectTestTextChunk(sampleSource, "iTXt", "Comment", JSON.stringify({ seed: 99 }), {
    compressed: true,
    compressionMethod: 1,
  });
  assert.equal(readNovelAiPngSeed(badMethodPng), null);
  const outOfRangeSeedPng = injectTestTextChunk(sampleSource, "tEXt", "Comment", JSON.stringify({ seed: 4294967296 }));
  assert.equal(readNovelAiPngSeed(outOfRangeSeedPng), null);
  const oversizedCommentPng = injectTestTextChunk(
    sampleSource,
    "zTXt",
    "Comment",
    JSON.stringify({ seed: 42, pad: "x".repeat(300 * 1024) }),
  );
  assert.equal(readNovelAiPngSeed(oversizedCommentPng), null);
  assert.equal(readNovelAiPngSeed(Buffer.concat([sampleSource.subarray(0, 12), Buffer.from([0, 0, 5, 0])])), null);
  assert.equal(readNovelAiPngSeed(sampleSource), null);
  assert.equal(readNovelAiPngSeed(Buffer.from("not-a-png")), null);

  // 4) Non-native NovelAI hosts refuse editMode/seedOverride immediately; img2img refuses stray masks; customParameters cannot break infill/seed.
  await assert.rejects(
    generateImage("novelai", "https://novelai-proxy.example.com", "synthetic", "novelai", {
      prompt: "1girl",
      model: "nai-diffusion-5-full",
      editMode: "img2img",
      sourceImage: sampleSource.toString("base64"),
    }),
    /does not support image-to-image edits/,
  );
  await assert.rejects(
    generateImage("novelai", "https://novelai-proxy.example.com", "synthetic", "novelai", {
      prompt: "1girl",
      model: "nai-diffusion-5-full",
      seedOverride: 123,
    }),
    /does not support an explicit seed override/,
  );
  await assert.rejects(
    generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
      prompt: "1girl",
      model: "nai-diffusion-5-full",
      editMode: "img2img",
      sourceImage: sampleSource.toString("base64"),
      maskImage: softMaskPng.toString("base64"),
    }),
    /only valid for inpainting/,
  );
  assert.equal(capturedPayloads.length, 2, "rejected non-native/invalid requests must not dispatch any fetch");

  // customParameters cannot override infill action/model/mask, and explicit seedOverride wins over custom parameters.seed.
  const customEditRes = await generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
    prompt: "1girl, crown",
    model: "nai-diffusion-5-full",
    editMode: "infill",
    sourceImage: sampleSource.toString("base64"),
    maskImage: softMaskPng.toString("base64"),
    strength: 0.85,
    seedOverride: 111,
    imageDefaults: {
      version: 1,
      service: "novelai",
      seed: -1,
      customParameters: {
        action: "generate",
        model: "nai-diffusion-3",
        parameters: { seed: 555666, width: 512, strength: 0.1 },
      },
      novelai: { ...DEFAULT_NOVELAI_DEFAULTS },
    },
  });
  assert.equal(customEditRes.seed, 111);
  assert.equal(customEditRes.width, 768);
  assert.equal(customEditRes.height, 512);
  const customEditBody = capturedPayloads.at(-1)!;
  assert.equal(customEditBody.action, "infill");
  assert.equal(customEditBody.model, "nai-diffusion-5-full-inpainting");
  const customEditParams = customEditBody.parameters as Record<string, unknown>;
  assert.equal(customEditParams.seed, 111);
  assert.equal(customEditParams.extra_noise_seed, 111);
  assert.equal(customEditParams.strength, 0.85);
  assert.equal((customEditParams.img2img as Record<string, unknown>).extra_noise_seed, 111);
  assert.equal(typeof customEditParams.mask, "string");

  // Plain text-to-image with seedOverride keeps seedOverride over custom parameters.seed while still applying custom dimensions.
  const plainSeedOverrideRes = await generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
    prompt: "1girl, meadow",
    model: "nai-diffusion-5-full",
    seedOverride: 222,
    imageDefaults: {
      version: 1,
      service: "novelai",
      seed: -1,
      customParameters: {
        parameters: { seed: 555666, width: 512, height: 768 },
      },
      novelai: { ...DEFAULT_NOVELAI_DEFAULTS },
    },
  });
  assert.equal(plainSeedOverrideRes.seed, 222);
  assert.equal(plainSeedOverrideRes.width, 512);
  assert.equal(plainSeedOverrideRes.height, 768);
  const plainOverrideParams = capturedPayloads.at(-1)!.parameters as Record<string, unknown>;
  assert.equal(plainOverrideParams.seed, 222);
  assert.equal(plainOverrideParams.width, 512);
  assert.equal(plainOverrideParams.height, 768);

  // Without seedOverride, connection customParameters.parameters.seed still applies cleanly.
  const customSeedOnlyRes = await generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
    prompt: "1girl, sunset",
    model: "nai-diffusion-5-full",
    imageDefaults: {
      version: 1,
      service: "novelai",
      seed: -1,
      customParameters: {
        parameters: { seed: 555666 },
      },
      novelai: { ...DEFAULT_NOVELAI_DEFAULTS },
    },
  });
  assert.equal(customSeedOnlyRes.seed, 555666);
  const customSeedOnlyParams = capturedPayloads.at(-1)!.parameters as Record<string, unknown>;
  assert.equal(customSeedOnlyParams.seed, 555666);

  // 5) Primary NovelAI edit failure skips non-native fallback completely.
  let calledFallback = false;
  fetchMock.mock.mockImplementationOnce(async () => new Response("upstream error", { status: 500 }));
  await assert.rejects(
    generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
      prompt: "1girl",
      model: "nai-diffusion-5-full",
      editMode: "img2img",
      sourceImage: sampleSource.toString("base64"),
      fallback: {
        connectionId: "openai-fallback",
        connectionName: "OpenAI",
        provider: "image_generation",
        source: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        serviceHint: "openai",
        model: "gpt-image-1",
      },
      onFallback: async () => {
        calledFallback = true;
      },
    }),
    /500/,
  );
  assert.equal(calledFallback, false, "primary NovelAI edit failure must not invoke non-NovelAI fallback");
} finally {
  fetchMock.mock.restore();
  dnsMock.mock.restore();
}

// Precise Reference on V5 (2026-11-24): references fill V5's nearest bucket (cropped, alpha kept) instead of V4.5's
// padding, "Prefer same outfit" can be turned off, and V5 sends no fidelity.
{
  const sent: Array<{
    request: Record<string, any>;
    references: Array<{ width?: number; height?: number; alpha?: boolean }>;
  }> = [];
  const referenceDns = mock.method(dns, "lookup", async () => [{ address: "8.8.8.8", family: 4 }]);
  const referenceFetch = mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) => {
      const form = init?.body;
      assert.ok(form instanceof FormData, "Precise Reference requests are multipart");
      const references = [];
      for (let index = 0; form.has(`director_ref_${index}`); index++) {
        const meta = await sharp(
          Buffer.from(await (form.get(`director_ref_${index}`) as Blob).arrayBuffer()),
        ).metadata();
        references.push({ width: meta.width, height: meta.height, alpha: meta.hasAlpha });
      }
      sent.push({ request: JSON.parse(await (form.get("request") as Blob).text()), references });
      return new Response(new Uint8Array(sampleSource), { status: 200, headers: { "content-type": "image/png" } });
    },
  );
  const picture = async (width: number, height: number, alpha: number) =>
    (
      await sharp({ create: { width, height, channels: 4, background: { r: 200, g: 40, b: 90, alpha } } })
        .png()
        .toBuffer()
    ).toString("base64");
  const portrait = await picture(600, 900, 1);
  const cutout = await picture(500, 500, 0);
  const paint = (model: string, extra: Record<string, unknown> = {}, novelai = {}) =>
    generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
      prompt: "1girl, school uniform",
      model,
      referenceImage: portrait,
      referenceImages: [portrait, cutout],
      imageDefaults: { version: 1, service: "novelai", seed: 7, novelai: { ...DEFAULT_NOVELAI_DEFAULTS, ...novelai } },
      ...extra,
    });
  try {
    await paint("nai-diffusion-5-full", { preferReferenceOutfit: false });
    const v5 = sent.at(-1)!;
    const params = v5.request.parameters;
    assert.equal(v5.request.model, "nai-diffusion-5-full");
    assert.deepEqual(
      params.director_reference_descriptions.map((entry: any) => entry.caption.base_caption),
      ["character&style_anyoutfit", "character&style_anyoutfit"],
    );
    assert.deepEqual(params.director_reference_strength_values, [1, 1]);
    assert.deepEqual(params.director_reference_secondary_strength_values, [0, 0]);
    assert.equal(params.director_reference_images, undefined, "the pictures travel as multipart parts");
    assert.equal(params.director_reference_images_cached.length, 2);
    assert.deepEqual(v5.references, [
      { width: 832, height: 1216, alpha: true },
      { width: 1024, height: 1024, alpha: true },
    ]);

    await paint("nai-diffusion-5-curated");
    assert.deepEqual(
      sent.at(-1)!.request.parameters.director_reference_descriptions.map((entry: any) => entry.caption.base_caption),
      ["character&style", "character&style"],
      "Prefer same outfit stays on unless the caller turns it off",
    );

    // The style plate goes first; V5 ignores its fidelity.
    await paint("nai-diffusion-5-full", {}, { styleReferenceImage: cutout, styleReferenceFidelity: 0.25 });
    const styled = sent.at(-1)!.request.parameters;
    assert.deepEqual(
      styled.director_reference_descriptions.map((entry: any) => entry.caption.base_caption),
      ["style", "character&style"],
    );
    assert.deepEqual(styled.director_reference_secondary_strength_values, [0, 0]);

    // V4.5 is unchanged: padded to its three sizes, its fidelity kept, no outfit variant.
    await paint(
      "nai-diffusion-4-5-full",
      { preferReferenceOutfit: false },
      { styleReferenceImage: cutout, styleReferenceFidelity: 0.25 },
    );
    const v45 = sent.at(-1)!;
    assert.deepEqual(
      v45.request.parameters.director_reference_descriptions.map((entry: any) => entry.caption.base_caption),
      ["style", "character&style"],
    );
    assert.deepEqual(v45.request.parameters.director_reference_secondary_strength_values, [0.75, 0]);
    assert.deepEqual(
      v45.references.map(({ width, height }) => ({ width, height })),
      [
        { width: 1472, height: 1472 },
        { width: 1024, height: 1536 },
      ],
    );
  } finally {
    referenceFetch.mock.restore();
    referenceDns.mock.restore();
  }
}

// Automatic NovelAI settings: unset Steps and Prompt guidance send NovelAI's own default for the model (its client,
// 2026-11-24), a saved value wins, and a profile saved before them reads its built-in 28 / 6 as automatic once.
{
  const { normalizeImageGenerationProfile } =
    await import("../../../packages/shared/src/constants/image-generation-defaults.js");
  const novelaiOf = (novelai: Record<string, unknown>) =>
    normalizeImageGenerationProfile({ version: 1, service: "novelai", seed: -1, novelai }, "novelai").profile.novelai!;
  assert.equal(novelaiOf({ steps: 28, promptGuidance: 6 }).steps, null, "the old built-in steps read as automatic");
  assert.equal(novelaiOf({ steps: 28, promptGuidance: 6 }).promptGuidance, null);
  assert.equal(novelaiOf({ steps: 30, promptGuidance: 6.5 }).steps, 30, "an old profile's own choice is kept");
  assert.equal(novelaiOf({ steps: 30, promptGuidance: 6.5 }).promptGuidance, 6.5);
  const saved = novelaiOf({ steps: 28, promptGuidance: 6, settingsVersion: 2 });
  assert.equal(saved.steps, 28, "a value saved with automatic settings is taken as saved");
  assert.equal(saved.promptGuidance, 6);
  assert.equal(novelaiOf({ steps: null, settingsVersion: 2 }).steps, null);

  const sentParams: Array<Record<string, unknown>> = [];
  const settingsDns = mock.method(dns, "lookup", async () => [{ address: "8.8.8.8", family: 4 }]);
  const settingsFetch = mock.method(globalThis, "fetch", async (_input: string | URL | Request, init?: RequestInit) => {
    sentParams.push((JSON.parse(String(init?.body)) as { parameters: Record<string, unknown> }).parameters);
    return new Response(new Uint8Array(sampleSource), { status: 200, headers: { "content-type": "image/png" } });
  });
  const paintWith = (model: string, novelai: Record<string, unknown> = {}) =>
    generateImage("novelai", "https://image.novelai.net", "synthetic", "novelai", {
      prompt: "1girl, garden",
      model,
      imageDefaults: { version: 1, service: "novelai", seed: 7, novelai: novelaiOf(novelai) },
    });
  try {
    await paintWith("nai-diffusion-5-full");
    assert.equal(sentParams.at(-1)!.steps, 23);
    assert.equal(sentParams.at(-1)!.scale, 7);
    assert.equal(sentParams.at(-1)!.sampler, "k_euler_ancestral");
    assert.equal(sentParams.at(-1)!.noise_schedule, "karras");
    assert.equal(sentParams.at(-1)!.cfg_rescale, 0);
    assert.equal(sentParams.at(-1)!.deliberate_euler_ancestral_bug, false);
    assert.equal(sentParams.at(-1)!.prefer_brownian, true);

    await paintWith("nai-diffusion-4-5-curated", { steps: 28, promptGuidance: 6 });
    assert.equal(sentParams.at(-1)!.steps, 23, "an old profile's built-in steps follow the model now");
    assert.equal(sentParams.at(-1)!.scale, 5);

    await paintWith("nai-diffusion-5-curated", { steps: 28, promptGuidance: 6, settingsVersion: 2 });
    assert.equal(sentParams.at(-1)!.steps, 28, "the connection's own steps win");
    assert.equal(sentParams.at(-1)!.scale, 6);

    await paintWith("nai-diffusion-5-full", { noiseSchedule: "native", settingsVersion: 2 });
    assert.equal(sentParams.at(-1)!.deliberate_euler_ancestral_bug, undefined, "native noise keeps NovelAI's own");
    assert.equal(sentParams.at(-1)!.prefer_brownian, undefined);
  } finally {
    settingsFetch.mock.restore();
    settingsDns.mock.restore();
  }
}
