// NovelAI image settings: subject counts in a prompt, image sizes and the defaults a connection profile gets.
import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mock } from "node:test";
import { deflateSync } from "node:zlib";
import {
  detectNovelAiSubjectCount,
  generateImage,
  prepareNovelAiEditInputs,
  readNovelAiPngSeed,
  resolveNovelAiDefaults,
  resolveNovelAiInpaintingModel,
  resolveNovelAiRequestSize,
  resolveNovelAiSize,
} from "../../../packages/server/src/services/image/image-generation.js";
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

function injectTestTextChunk(png: Buffer, type: "tEXt" | "zTXt", keyword: string, text: string): Buffer {
  const data =
    type === "tEXt"
      ? Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0]), Buffer.from(text, "utf8")])
      : Buffer.concat([Buffer.from(keyword, "latin1"), Buffer.from([0, 0]), deflateSync(Buffer.from(text, "utf8"))]);
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

// Build a non-binary soft gradient/box mask over 768x512 and verify 8x8 quantization + binarization.
const rawSoftMask = Buffer.alloc(768 * 512);
for (let y = 0; y < 512; y++) {
  for (let x = 0; x < 768; x++) {
    rawSoftMask[y * 768 + x] = x >= 128 && x < 256 && y >= 64 && y < 192 ? 200 : x < 16 ? 120 : 0;
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
// Every 8x8 block must be uniform.
for (let by = 0; by < 512; by += 8) {
  for (let bx = 0; bx < 768; bx += 8) {
    const ch = maskPixels.info.channels;
    const expected = maskPixels.data[(by * 768 + bx) * ch]!;
    assert.equal(maskPixels.data[((by + 7) * 768 + (bx + 7)) * ch]!, expected);
  }
}

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

  // 3) readNovelAiPngSeed supports native NovelAI Comment JSON and returns null on missing/non-PNG bytes.
  const commentPng = injectTestTextChunk(sampleSource, "tEXt", "Comment", JSON.stringify({ seed: 987654321 }));
  assert.equal(readNovelAiPngSeed(commentPng), 987654321);
  const compressedCommentPng = injectTestTextChunk(sampleSource, "zTXt", "Comment", JSON.stringify({ seed: 13579 }));
  assert.equal(readNovelAiPngSeed(compressedCommentPng), 13579);
  assert.equal(readNovelAiPngSeed(sampleSource), null);
  assert.equal(readNovelAiPngSeed(Buffer.from("not-a-png")), null);

  // 4) Non-native NovelAI hosts refuse editMode immediately before sending any request.
  await assert.rejects(
    generateImage("novelai", "https://novelai-proxy.example.com", "synthetic", "novelai", {
      prompt: "1girl",
      model: "nai-diffusion-5-full",
      editMode: "img2img",
      sourceImage: sampleSource.toString("base64"),
    }),
    /native NovelAI connection/,
  );
  assert.equal(capturedPayloads.length, 2, "rejected non-native edit must not dispatch any fetch");
} finally {
  fetchMock.mock.restore();
  dnsMock.mock.restore();
}
