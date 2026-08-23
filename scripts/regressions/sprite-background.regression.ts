import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  applySpriteBackgroundInstruction,
  removeUniformSpriteBackgroundPng,
  selectSpriteChromaMatte,
} from "../../packages/server/src/services/image/sprite-background.service.js";
import {
  buildFullBodyReferenceContract,
  resolveSpriteNativeTransparency,
  resolveSpriteSheetCanvas,
} from "../../packages/server/src/routes/sprites.routes.js";
import type { ImageGenerationDefaultsProfile } from "../../packages/shared/src/types/image-generation-defaults.js";

// Resolve the optional native dependency from the server package where it is
// declared instead of from this root-level regression script.
const requireFromServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const sharp = requireFromServer("sharp");

assert.equal(selectSpriteChromaMatte("black hair, red coat").id, "green");
assert.equal(selectSpriteChromaMatte("long green hair, emerald dress").id, "magenta");
assert.equal(selectSpriteChromaMatte("green hair, magenta coat").id, "cyan");

const prompt = applySpriteBackgroundInstruction("portrait on a solid white background", {
  matte: selectSpriteChromaMatte("green hair"),
  nativeTransparentPng: true,
  removeBackground: true,
});
assert.match(prompt, /transparent PNG/iu);
assert.match(prompt, /chroma magenta #FF00FF/iu);
assert.doesNotMatch(prompt, /pure white #ffffff/iu);
assert.equal(prompt.match(/transparent PNG format/giu)?.length, 1);

const chromaOnlyPrompt = applySpriteBackgroundInstruction("full-body character on a solid white background", {
  matte: selectSpriteChromaMatte("black hair, red coat"),
  nativeTransparentPng: false,
  removeBackground: true,
});
assert.match(chromaOnlyPrompt, /chroma green #00FF00/iu);
assert.doesNotMatch(chromaOnlyPrompt, /solid white background/iu);
assert.match(chromaOnlyPrompt, /never a painted transparency checkerboard/iu);
assert.equal(resolveSpriteNativeTransparency("gpt-image-2", true), false);
assert.equal(resolveSpriteNativeTransparency("gpt-image-2-preview", true), false);
assert.equal(resolveSpriteNativeTransparency("gpt-image-1.5", true), true);
assert.equal(resolveSpriteNativeTransparency("sdxl", true), true);
assert.equal(resolveSpriteNativeTransparency("gpt-image-2", false), false);

assert.deepEqual(
  resolveSpriteSheetCanvas({ cols: 1, rows: 1, spriteType: "full-body", model: "gpt-image-2" }),
  {
    sheetWidth: 1024,
    sheetHeight: 1536,
    cellWidth: 1024,
    cellHeight: 1536,
  },
);
assert.deepEqual(
  resolveSpriteSheetCanvas({ cols: 1, rows: 1, spriteType: "full-body", model: "sdxl" }),
  {
    sheetWidth: 1024,
    sheetHeight: 1536,
    cellWidth: 1024,
    cellHeight: 1536,
  },
);

const fullBodyReferenceContract = buildFullBodyReferenceContract([
  { kind: "neutral-full-body" },
  { kind: "expression", expression: "happy" },
  { kind: "identity" },
]);
assert.match(fullBodyReferenceContract, /Reference image 1 is the user-approved neutral full-body design/iu);
assert.match(fullBodyReferenceContract, /Preserve its exact clothing, footwear, accessories/iu);
assert.match(fullBodyReferenceContract, /Reference image 2 is the saved portrait for the "happy" expression/iu);
assert.match(fullBodyReferenceContract, /Match its face, gaze, mouth, eyebrows, and emotional intensity/iu);
assert.match(fullBodyReferenceContract, /Reference image 3 is an additional identity reference/iu);
assert.match(fullBodyReferenceContract, /one uninterrupted head-to-toe sprite/iu);

function solidImage(width: number, height: number, color: [number, number, number, number]) {
  return Buffer.alloc(width * height * 4).fill(Buffer.from(color));
}

function setPixel(pixels: Buffer, width: number, xPos: number, yPos: number, color: [number, number, number, number]) {
  const offset = (yPos * width + xPos) * 4;
  pixels.set(color, offset);
}

async function encodeRaw(pixels: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

async function decodeRaw(input: Buffer) {
  return sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pixelAt(data: Buffer, width: number, xPos: number, yPos: number) {
  const offset = (yPos * width + xPos) * 4;
  return {
    red: data[offset] ?? 0,
    green: data[offset + 1] ?? 0,
    blue: data[offset + 2] ?? 0,
    alpha: data[offset + 3] ?? 0,
  };
}

const width = 40;
const height = 40;
const chromaPixels = solidImage(width, height, [0, 255, 0, 255]);
for (let yPos = 10; yPos < 30; yPos++) {
  for (let xPos = 10; xPos < 30; xPos++) {
    const edge = xPos === 10 || xPos === 29 || yPos === 10 || yPos === 29;
    setPixel(chromaPixels, width, xPos, yPos, edge ? [128, 128, 0, 255] : [255, 0, 0, 255]);
  }
}
for (let yPos = 16; yPos < 24; yPos++) {
  for (let xPos = 16; xPos < 24; xPos++) setPixel(chromaPixels, width, xPos, yPos, [0, 255, 0, 255]);
}
setPixel(chromaPixels, width, 5, 5, [0, 80, 0, 255]);
for (let yPos = 14; yPos < 27; yPos++) {
  for (let xPos = 2; xPos < 10; xPos++) setPixel(chromaPixels, width, xPos, yPos, [0, 72, 0, 255]);
}
setPixel(chromaPixels, width, 20, 9, [80, 160, 0, 255]);
const chromaCleanup = await removeUniformSpriteBackgroundPng(await encodeRaw(chromaPixels, width, height), 35);
assert.ok(chromaCleanup.confidence > 0.8, `expected a confident flat matte, received ${chromaCleanup.confidence}`);
const chromaOutput = await decodeRaw(chromaCleanup.buffer);
assert.ok(pixelAt(chromaOutput.data, width, 0, 0).alpha <= 4, "flat chroma corner should be transparent");
assert.ok(pixelAt(chromaOutput.data, width, 13, 13).alpha >= 250, "opaque subject should be preserved");
assert.ok(
  pixelAt(chromaOutput.data, width, 20, 20).alpha <= 4,
  "an enclosed chroma pocket between subject regions should be transparent",
);
const chromaEdge = pixelAt(chromaOutput.data, width, 10, 20);
assert.ok(
  chromaEdge.alpha > 40 && chromaEdge.alpha < 220,
  `soft subject edge should keep partial alpha, got ${chromaEdge.alpha}`,
);
assert.ok(chromaEdge.green < 80, `soft subject edge should be despilled, got green=${chromaEdge.green}`);
const chromaFringe = pixelAt(chromaOutput.data, width, 20, 9);
assert.ok(chromaFringe.alpha < 180, `mixed chroma fringe should lose matte opacity, got alpha=${chromaFringe.alpha}`);
assert.ok(
  chromaFringe.green - (chromaFringe.red + chromaFringe.blue) / 2 <= 2,
  `mixed chroma fringe should have no residual green dominance, got rgb=${chromaFringe.red},${chromaFringe.green},${chromaFringe.blue}`,
);
const isolatedChroma = pixelAt(chromaOutput.data, width, 5, 5);
assert.ok(
  isolatedChroma.alpha <= 4,
  `an isolated dark chroma pixel surrounded by backdrop should be transparent, got alpha=${isolatedChroma.alpha}`,
);
const wideChromaHalo = pixelAt(chromaOutput.data, width, 8, 20);
assert.ok(
  wideChromaHalo.green - (wideChromaHalo.red + wideChromaHalo.blue) / 2 <= 2,
  `a wide dark chroma halo beyond the local edge band should have no green spill, got rgb=${wideChromaHalo.red},${wideChromaHalo.green},${wideChromaHalo.blue}`,
);
for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex++) {
  const xPos = pixelIndex % width;
  const yPos = Math.floor(pixelIndex / width);
  const pixel = pixelAt(chromaOutput.data, width, xPos, yPos);
  if (pixel.alpha <= 4) continue;
  assert.ok(
    pixel.green - (pixel.red + pixel.blue) / 2 <= 2,
    `visible output pixel ${xPos},${yPos} retained green matte dominance: rgb=${pixel.red},${pixel.green},${pixel.blue}`,
  );
}

const legacyWhitePixels = solidImage(width, height, [255, 255, 255, 255]);
for (let yPos = 8; yPos < 32; yPos++) {
  for (let xPos = 8; xPos < 32; xPos++) setPixel(legacyWhitePixels, width, xPos, yPos, [40, 40, 40, 255]);
}
for (let yPos = 16; yPos < 24; yPos++) {
  for (let xPos = 16; xPos < 24; xPos++) setPixel(legacyWhitePixels, width, xPos, yPos, [255, 255, 255, 255]);
}
const legacyCleanup = await removeUniformSpriteBackgroundPng(await encodeRaw(legacyWhitePixels, width, height), 35);
const legacyOutput = await decodeRaw(legacyCleanup.buffer);
assert.ok(pixelAt(legacyOutput.data, width, 0, 0).alpha <= 4, "legacy white background should be removed");
assert.ok(pixelAt(legacyOutput.data, width, 20, 20).alpha >= 250, "enclosed white subject detail should remain");

const partiallyTransparentPixels = solidImage(width, height, [255, 255, 255, 255]);
for (let yPos = 8; yPos < 32; yPos++) {
  for (let xPos = 8; xPos < 32; xPos++) setPixel(partiallyTransparentPixels, width, xPos, yPos, [35, 35, 35, 255]);
}
for (let yPos = 17; yPos < 23; yPos++) {
  for (let xPos = 17; xPos < 23; xPos++) setPixel(partiallyTransparentPixels, width, xPos, yPos, [80, 80, 80, 128]);
}
const partiallyTransparentCleanup = await removeUniformSpriteBackgroundPng(
  await encodeRaw(partiallyTransparentPixels, width, height),
  35,
);
assert.equal(
  partiallyTransparentCleanup.alreadyTransparent,
  false,
  "small transparent subject details must not make an opaque backdrop look already clean",
);
const partiallyTransparentOutput = await decodeRaw(partiallyTransparentCleanup.buffer);
assert.ok(pixelAt(partiallyTransparentOutput.data, width, 0, 0).alpha <= 4);
assert.equal(pixelAt(partiallyTransparentOutput.data, width, 20, 20).alpha, 128);

const transparentPixels = solidImage(width, height, [0, 0, 0, 0]);
for (let yPos = 12; yPos < 28; yPos++) {
  for (let xPos = 12; xPos < 28; xPos++) setPixel(transparentPixels, width, xPos, yPos, [50, 80, 220, 255]);
}
const transparentCleanup = await removeUniformSpriteBackgroundPng(
  await encodeRaw(transparentPixels, width, height),
  35,
);
assert.equal(transparentCleanup.alreadyTransparent, true);
const transparentOutput = await decodeRaw(transparentCleanup.buffer);
assert.equal(pixelAt(transparentOutput.data, width, 0, 0).alpha, 0);
assert.equal(pixelAt(transparentOutput.data, width, 20, 20).blue, 220);

console.info("Sprite background regression passed.");

// ── styleProfileId threading (#5095) ─────────────────────────────────────────
// The sprite compiler must honor an explicit per-request style profile, keep
// byte-identical output when the field is absent, and degrade unknown ids the
// same way the gallery path does (findImageStyleProfile falls back gracefully).
{
  const { compileSpritePrompt } = await import("../../packages/server/src/routes/sprites.routes.js");
  const { normalizeImageStyleProfileSettings, findImageStyleProfile } = await import(
    "../../packages/shared/src/constants/image-style-profiles.js"
  );
  const settings = normalizeImageStyleProfileSettings(null);
  const nonDefault = settings.profiles.find((profile) => profile.id !== settings.defaultProfileId);
  assert.ok(nonDefault, "built-in profiles must include a non-default profile for this regression");

  const base = { appearance: "a test subject", styleProfiles: settings };
  const omitted = compileSpritePrompt("sprite of the subject", base);
  const explicitDefault = compileSpritePrompt("sprite of the subject", {
    ...base,
    styleProfileId: settings.defaultProfileId,
  });
  assert.deepEqual(explicitDefault, omitted, "explicitly passing the default profile must equal omitting the field");

  const overridden = compileSpritePrompt("sprite of the subject", { ...base, styleProfileId: nonDefault.id });
  assert.notDeepEqual(overridden, omitted, "an explicit non-default profile must change the compiled prompt");

  const unknown = compileSpritePrompt("sprite of the subject", { ...base, styleProfileId: "no-such-profile" });
  const fallbackProfile = findImageStyleProfile(settings, "no-such-profile");
  const fallbackDirect = compileSpritePrompt("sprite of the subject", { ...base, styleProfileId: fallbackProfile.id });
  assert.deepEqual(unknown, fallbackDirect, "unknown ids must degrade exactly like findImageStyleProfile");

  const blank = compileSpritePrompt("sprite of the subject", { ...base, styleProfileId: "   " });
  assert.deepEqual(blank, omitted, "a blank styleProfileId must behave like an omitted one");

  // Connection-scoped default: imageDefaults.styleProfileId is the middle link of
  // the compiler's `explicit ?? connection default ?? user default` chain, which the
  // `base` object (no imageDefaults) never exercises. A styleProfileId-only defaults
  // object is prompt/negative-prefix-neutral (the prefixes come from the per-service
  // sub-objects, left unset here), so its only effect on the compiled prompt is which
  // profile the chain resolves to.
  const connectionDefault: ImageGenerationDefaultsProfile = {
    version: 1,
    service: "automatic1111",
    seed: 0,
    styleProfileId: nonDefault.id,
  };
  const viaConnectionDefault = compileSpritePrompt("sprite of the subject", { ...base, imageDefaults: connectionDefault });
  assert.deepEqual(
    viaConnectionDefault,
    overridden,
    "omitting styleProfileId must fall back to the connection's imageDefaults.styleProfileId",
  );
  assert.notDeepEqual(
    viaConnectionDefault,
    omitted,
    "the connection default must move the compiled prompt off the user's default profile",
  );

  const explicitOverridesConnectionDefault = compileSpritePrompt("sprite of the subject", {
    ...base,
    imageDefaults: connectionDefault,
    styleProfileId: settings.defaultProfileId,
  });
  assert.deepEqual(
    explicitOverridesConnectionDefault,
    omitted,
    "an explicit styleProfileId must override the connection's imageDefaults.styleProfileId",
  );
  console.log("sprite styleProfileId threading regression passed");
}
