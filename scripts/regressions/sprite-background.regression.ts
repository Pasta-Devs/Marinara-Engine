import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  applySpriteBackgroundInstruction,
  removeUniformSpriteBackgroundPng,
  selectSpriteChromaMatte,
  SPRITE_CLEANUP_REVISION,
} from "../../packages/server/src/services/image/sprite-background.service.js";
import {
  buildFullBodyReferenceContract,
  resolveSpriteNativeTransparency,
  resolveSpriteSheetCanvas,
  spritesRoutes,
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

assert.deepEqual(resolveSpriteSheetCanvas({ cols: 1, rows: 1, spriteType: "full-body", model: "gpt-image-2" }), {
  sheetWidth: 1024,
  sheetHeight: 1536,
  cellWidth: 1024,
  cellHeight: 1536,
});
assert.deepEqual(resolveSpriteSheetCanvas({ cols: 1, rows: 1, spriteType: "full-body", model: "sdxl" }), {
  sheetWidth: 1024,
  sheetHeight: 1536,
  cellWidth: 1024,
  cellHeight: 1536,
});

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
// The wide halo leaves the left red edge without original key-matte neighbors within three pixels.
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

// Opaque costume ribbons are foreground even when green exceeds the average of red and blue.
const detailWidth = 96;
const detailHeight = 96;
const detailPixels = solidImage(detailWidth, detailHeight, [0, 255, 0, 255]);
for (let yPos = 12; yPos < 84; yPos++) {
  for (let xPos = 58; xPos < 80; xPos++) setPixel(detailPixels, detailWidth, xPos, yPos, [42, 48, 65, 255]);
}
const ribbonColors: Array<[number, number, number, number]> = [
  [120, 200, 230, 255],
  [220, 180, 80, 255],
  [80, 150, 220, 255],
  [224, 212, 160, 255],
];
for (const [row, color] of ribbonColors.entries()) {
  for (let xPos = 10; xPos < 59; xPos++) {
    const yPos = 18 + row * 17 + Math.floor((58 - xPos) / 7);
    setPixel(detailPixels, detailWidth, xPos, yPos, color);
    if (row % 2) setPixel(detailPixels, detailWidth, xPos, yPos + 1, color);
  }
}
setPixel(detailPixels, detailWidth, 66, 40, [120, 200, 230, 255]);
setPixel(detailPixels, detailWidth, 66, 50, [220, 180, 80, 255]);
setPixel(detailPixels, detailWidth, 66, 60, [40, 180, 175, 255]);
const detailCleanup = await removeUniformSpriteBackgroundPng(
  await encodeRaw(detailPixels, detailWidth, detailHeight),
  35,
);
const detailOutput = await decodeRaw(detailCleanup.buffer);
for (let yPos = 0; yPos < detailHeight; yPos++) {
  for (let xPos = 0; xPos < detailWidth; xPos++) {
    const original = pixelAt(detailPixels, detailWidth, xPos, yPos);
    const actual = pixelAt(detailOutput.data, detailWidth, xPos, yPos);
    if (original.red === 0 && original.green === 255 && original.blue === 0) {
      assert.ok(actual.alpha <= 4, `the matte around ribbons must be removed at ${xPos},${yPos}`);
    } else {
      assert.deepEqual(actual, original, `opaque ribbon/body color must remain intact at ${xPos},${yPos}`);
    }
  }
}

// Textured opaque gold stays intact beyond the three-pixel matte-neighbor band.
const textureWidth = 64;
const texturePixels = solidImage(textureWidth, textureWidth, [0, 255, 0, 255]);
for (let yPos = 8; yPos < 56; yPos++) {
  for (let xPos = 8; xPos < 56; xPos++) {
    const color: [number, number, number, number] = (xPos + yPos) % 2 ? [210, 172, 76, 255] : [220, 180, 80, 255];
    setPixel(texturePixels, textureWidth, xPos, yPos, color);
  }
}
const textureOutput = await decodeRaw(
  (await removeUniformSpriteBackgroundPng(await encodeRaw(texturePixels, textureWidth, textureWidth), 35)).buffer,
);
for (let yPos = 11; yPos < 53; yPos++) {
  for (let xPos = 11; xPos < 53; xPos++) {
    const matteDistance = Math.min(xPos - 7, 56 - xPos, yPos - 7, 56 - yPos);
    if (matteDistance > 16) continue;
    assert.deepEqual(
      pixelAt(textureOutput.data, textureWidth, xPos, yPos),
      pixelAt(texturePixels, textureWidth, xPos, yPos),
      `opaque textured gold ${matteDistance}px from the matte must retain RGBA at ${xPos},${yPos}`,
    );
  }
}

// A real four-pixel half-red/half-green band stays connected to the matte during cleanup.
const wideBlendPixels = solidImage(width, height, [0, 255, 0, 255]);
for (let yPos = 8; yPos < 32; yPos++) {
  for (let xPos = 8; xPos < 30; xPos++) {
    setPixel(wideBlendPixels, width, xPos, yPos, xPos < 12 ? [128, 127, 0, 255] : [255, 0, 0, 255]);
  }
}
const wideBlendOutput = await decodeRaw(
  (await removeUniformSpriteBackgroundPng(await encodeRaw(wideBlendPixels, width, height), 35)).buffer,
);
const wideBlendEdge = pixelAt(wideBlendOutput.data, width, 11, 20);
assert.ok(
  wideBlendEdge.alpha >= 120 && wideBlendEdge.alpha <= 136,
  `wide true blends must keep half coverage, got ${wideBlendEdge.alpha}`,
);
assert.deepEqual(
  { red: wideBlendEdge.red, green: wideBlendEdge.green, blue: wideBlendEdge.blue },
  { red: 255, green: 0, blue: 0 },
  "wide true blends must lose their green matte color",
);

// A nearby opaque shade is not necessarily a noisy mixture of another shade and the key color.
const shadePixels = solidImage(width, height, [0, 255, 0, 255]);
for (let yPos = 8; yPos < 32; yPos++) {
  for (let xPos = 10; xPos < 30; xPos++) setPixel(shadePixels, width, xPos, yPos, [130, 150, 250, 255]);
  setPixel(shadePixels, width, 9, yPos, [100, 150, 210, 255]);
}
// This pixel really is an 80% foreground / 20% green matte mixture and still needs decontamination.
setPixel(shadePixels, width, 8, 20, [104, 171, 200, 255]);
setPixel(shadePixels, width, 8, 22, [116, 171, 200, 255]);
const shadeCleanup = await removeUniformSpriteBackgroundPng(await encodeRaw(shadePixels, width, height), 35);
const shadeOutput = await decodeRaw(shadeCleanup.buffer);
assert.deepEqual(
  pixelAt(shadeOutput.data, width, 9, 20),
  pixelAt(shadePixels, width, 9, 20),
  "an opaque blue edge shade must not be recolored or faded to a neighboring shade",
);
const realBlueFringe = pixelAt(shadeOutput.data, width, 8, 20);
assert.ok(realBlueFringe.alpha >= 195 && realBlueFringe.alpha <= 215, "a true blue/green fringe keeps its coverage");
assert.deepEqual(
  { red: realBlueFringe.red, green: realBlueFringe.green, blue: realBlueFringe.blue },
  { red: 130, green: 150, blue: 250 },
  "a true blue/green fringe must still lose its green matte color",
);
const noisyBlueFringe = pixelAt(shadeOutput.data, width, 8, 22);
assert.ok(
  noisyBlueFringe.alpha >= 195 && noisyBlueFringe.alpha <= 215,
  "a slightly noisy true blue fringe keeps partial coverage",
);
assert.deepEqual(
  { red: noisyBlueFringe.red, green: noisyBlueFringe.green, blue: noisyBlueFringe.blue },
  { red: 130, green: 150, blue: 250 },
  "a slightly noisy true blue fringe must still lose its green matte color",
);

for (const [matte, subject] of [
  [
    [255, 0, 255],
    [0, 255, 0],
  ],
  [
    [0, 255, 255],
    [255, 0, 0],
  ],
]) {
  const pixels = solidImage(width, height, [...matte!, 255] as [number, number, number, number]);
  for (let yPos = 10; yPos < 30; yPos++) {
    for (let xPos = 10; xPos < 30; xPos++) {
      const edge = xPos === 10 || xPos === 29 || yPos === 10 || yPos === 29;
      const rgb = edge ? subject!.map((value, index) => Math.round((value + matte![index]!) / 2)) : subject!;
      setPixel(pixels, width, xPos, yPos, [...rgb, 255] as [number, number, number, number]);
    }
  }
  if (matte![0] === 255) setPixel(pixels, width, 10, 20, [132, 125, 128, 255]);
  const output = await decodeRaw(
    (await removeUniformSpriteBackgroundPng(await encodeRaw(pixels, width, height), 35)).buffer,
  );
  assert.ok(pixelAt(output.data, width, 0, 0).alpha <= 4, "other supported chroma mattes must still be removed");
  assert.deepEqual(pixelAt(output.data, width, 15, 15), pixelAt(pixels, width, 15, 15));
  const edge = pixelAt(output.data, width, 10, 20);
  assert.ok(edge.alpha >= 120 && edge.alpha <= 136, "other chroma mattes retain true half-coverage edges");
  assert.deepEqual([edge.red, edge.green, edge.blue], subject, "other chroma mattes still despill true edges");
}

// Optional metadata is additive: existing cleanup requests/cells still work and advertise the corrected host.
const cleanupApp = requireFromServer("fastify")();
await cleanupApp.register(spritesRoutes);
try {
  const status = await cleanupApp.inject({ method: "GET", url: "/cleanup/status" });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().cleanupRevision, SPRITE_CLEANUP_REVISION);
  const response = await cleanupApp.inject({
    method: "POST",
    url: "/cleanup",
    payload: {
      engine: "builtin",
      cleanupStrength: 35,
      cells: [
        {
          expression: "feathers",
          base64: (await encodeRaw(detailPixels, detailWidth, detailHeight)).toString("base64"),
        },
      ],
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  const result = response.json();
  assert.equal(result.cleanupRevision, SPRITE_CLEANUP_REVISION);
  assert.equal(result.engine, "builtin");
  assert.equal(result.builtinProcessed, 1);
  assert.equal(result.backgroundRemoverProcessed, 0);
  assert.equal(result.cells[0].expression, "feathers");
  const cleaned = await decodeRaw(Buffer.from(result.cells[0].base64, "base64"));
  assert.equal(pixelAt(cleaned.data, detailWidth, 20, 23).alpha, 255);
} finally {
  await cleanupApp.close();
}

console.info("Sprite background regression passed.");

// ── styleProfileId threading (#5095) ─────────────────────────────────────────
// The sprite compiler must honor an explicit per-request style profile, keep
// byte-identical output when the field is absent, and degrade unknown ids the
// same way the gallery path does (findImageStyleProfile falls back gracefully).
{
  const { compileSpritePrompt } = await import("../../packages/server/src/routes/sprites.routes.js");
  const { normalizeImageStyleProfileSettings, findImageStyleProfile } =
    await import("../../packages/shared/src/constants/image-style-profiles.js");
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
  const viaConnectionDefault = compileSpritePrompt("sprite of the subject", {
    ...base,
    imageDefaults: connectionDefault,
  });
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

// ── Talking-head faces ───────────────────────────────────────────────────────
// Faces made for a 2D avatar must start with open eyes and a closed mouth, or its blink and talk pictures
// change nothing; the rule is added after compiling, so the tag compiler can't drop it.
{
  const { withTalkingHeadFaceContract } = await import("../../packages/server/src/routes/sprites.routes.js");
  const compiled = { prompt: "happy, portrait", negativePrompt: "blurry" };
  assert.deepEqual(
    withTalkingHeadFaceContract(compiled, { talkingHeadFaces: false }),
    compiled,
    "other sprites are drawn as before",
  );
  const faces = withTalkingHeadFaceContract(compiled, { talkingHeadFaces: true });
  assert.ok(faces.prompt.startsWith("happy, portrait\n\n"), "the compiled prompt stays first");
  assert.match(faces.prompt, /both eyes are fully open/u);
  assert.match(faces.prompt, /lips are closed/u);
  assert.match(faces.prompt, /happy face smiles with open eyes and closed lips/u);
  assert.match(faces.prompt, /angry face glares under lowered brows with its lips pressed shut/u);
  assert.match(faces.prompt, /surprised face has wide-open eyes and raised brows with a closed mouth/u);
  assert.match(faces.negativePrompt, /^blurry, closed eyes, .*open mouth/u);
  assert.doesNotMatch(faces.prompt, /Draw each face like this/u, "no faces asked for, no looks");
}

// ── Talking-head face looks ──────────────────────────────────────────────────
// Each of the 29 faces gets a look that keeps the eyes open and the lips closed, and a prompt describes only the
// faces it asks for.
{
  const { TALKING_HEAD_FACE_LOOKS, withTalkingHeadFaceContract } =
    await import("../../packages/server/src/routes/sprites.routes.js");
  const { AVATAR_EMOTIONS, AVATAR_EXTRA_FEELINGS } = await import("../../packages/shared/src/types/avatars.js");
  const faces = [...AVATAR_EMOTIONS, ...AVATAR_EXTRA_FEELINGS];
  assert.equal(faces.length, 29);
  assert.deepEqual(Object.keys(TALKING_HEAD_FACE_LOOKS).sort(), [...faces].sort(), "every face has a look");
  for (const [face, look] of Object.entries(TALKING_HEAD_FACE_LOOKS)) {
    assert.doesNotMatch(look, /open mouth|teeth|closed eyes|wink|laugh/iu, `${face} keeps open eyes and closed lips`);
  }

  const compiled = { prompt: "portrait", negativePrompt: "" };
  const sheet = withTalkingHeadFaceContract(compiled, {
    talkingHeadFaces: true,
    expressions: ["neutral", "pride", "realization", "my_custom_face"],
  });
  assert.ok(sheet.prompt.includes("visible teeth. Separate blinking and talking pictures are made from these faces"));
  const looksLine = sheet.prompt.split("\n").find((line) => line.startsWith("Draw each face like this: "));
  assert.ok(looksLine, "a sheet's faces get their looks");
  assert.equal(
    looksLine,
    `Draw each face like this: neutral: ${TALKING_HEAD_FACE_LOOKS.neutral}; pride: ${TALKING_HEAD_FACE_LOOKS.pride}; realization: ${TALKING_HEAD_FACE_LOOKS.realization}.`,
    "only the faces asked for, in order; a custom label gets no look",
  );
  assert.doesNotMatch(sheet.prompt, /happy: |grief: /u, "faces not asked for get no look");

  const oneFace = withTalkingHeadFaceContract(
    compiled,
    { talkingHeadFaces: true, expressions: ["neutral", "pride", "grief"] },
    ["grief"],
  );
  assert.match(
    oneFace.prompt,
    new RegExp(`Draw each face like this: grief: ${TALKING_HEAD_FACE_LOOKS.grief}\\.$`, "u"),
  );
  assert.doesNotMatch(oneFace.prompt, /neutral: |pride: /u, "a one-face picture describes only its own face");
  assert.equal(
    withTalkingHeadFaceContract(compiled, { talkingHeadFaces: false, expressions: ["neutral"] }),
    compiled,
    "other sprites get no looks",
  );
}
