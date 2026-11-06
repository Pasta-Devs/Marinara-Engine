import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VideoGenerationRequest } from "../../packages/shared/src/types/generation-integration.js";

const directory = mkdtempSync(join(tmpdir(), "marinara-gallery-animation-"));
const outside = mkdtempSync(join(tmpdir(), "marinara-gallery-animation-outside-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.LOG_LEVEL = "silent";
const { createFileNativeDB } = await import("../../packages/server/src/db/file-backed-store.js");
const { createConnectionsStorage } = await import("../../packages/server/src/services/storage/connections.storage.js");
const { createGlobalGalleryStorage } =
  await import("../../packages/server/src/services/storage/global-gallery.storage.js");
const { createConnectionSchema } = await import("../../packages/shared/dist/index.js");
const { apiConnections } = await import("../../packages/server/src/db/schema/index.js");
const { eq } = await import("../../packages/server/src/db/file-query.js");
const { animateCapabilityGalleryImage } =
  await import("../../packages/server/src/services/capability-packages/capability-gallery-animation.service.js");
const { createCapabilityIntegrationHost } =
  await import("../../packages/server/src/services/capability-packages/capability-integrations.service.js");
const { withGlobalGalleryImageLifecycleLocks } =
  await import("../../packages/server/src/services/image/gallery-file-lifecycle.js");
const { getSharp } = await import("../../packages/server/src/utils/sharp.js");
const db = await createFileNativeDB();
const connections = createConnectionsStorage(db);
const gallery = createGlobalGalleryStorage(db);
const root = join(directory, "gallery", "global");
mkdirSync(root, { recursive: true });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const calls: Array<{ source: string; baseUrl: string; key: string; service: string; request: VideoGenerationRequest }> =
  [];
const video = { base64: "fixture-mp4", mimeType: "video/mp4", ext: "mp4" } as const;
const provider: Parameters<typeof animateCapabilityGalleryImage>[2] = async (
  source,
  baseUrl,
  key,
  service,
  request,
) => {
  calls.push({ source, baseUrl, key, service, request });
  return video;
};
try {
  const primary = await connections.create(
    createConnectionSchema.parse({
      name: "Animation fixture",
      provider: "video_generation",
      videoGenerationSource: "openrouter",
      videoService: "openrouter",
      apiKey: "saved-primary-secret",
      model: "fixture-video-model",
    }),
  );
  await connections.updateDefaultParameters(primary.id, {
    videoGeneration: {
      service: "openrouter",
      openrouter: { durationSeconds: 6, aspectRatio: "9:16", resolution: "480p" },
    },
  });
  const fallback = await connections.create(
    createConnectionSchema.parse({
      name: "Fallback fixture",
      provider: "video_generation",
      videoGenerationSource: "xai",
      apiKey: "saved-fallback-secret",
      model: "fallback-video-model",
      fallbackForAgents: true,
    }),
  );
  writeFileSync(join(root, "fixture.png"), png);
  const image = await gallery.createImage({ filePath: "global/fixture.png" });
  assert(image);
  const input = {
    connectionId: primary.id,
    galleryImageId: image.id,
    prompt: "Subtle wind in a looping illustration.",
  };
  for (const permissions of [[], ["network"], ["storage"]]) {
    const host = createCapabilityIntegrationHost(permissions, db);
    assert.throws(() => host.videos.animateGalleryImage!(input), /permission/);
  }
  const result = await animateCapabilityGalleryImage(db, input, provider);
  assert.deepEqual(result, video);
  assert(!JSON.stringify(result).includes("secret"), "the package receives no saved credentials or connection fields");
  assert.equal(calls[0].key, "saved-primary-secret", "only the host reads the decrypted saved key");
  assert.equal(calls[0].source, "openrouter");
  assert.equal(calls[0].request.model, "fixture-video-model");
  assert.equal(calls[0].request.durationSeconds, 6);
  assert.equal(calls[0].request.aspectRatio, "9:16");
  assert.equal(calls[0].request.resolution, "480p");
  assert.equal(calls[0].request.referenceImage?.mimeType, "image/png");
  assert.equal(calls[0].request.referenceImage?.base64, png.toString("base64"));
  assert.equal(calls[0].request.referenceImage?.url, "/api/global-gallery/file/fixture.png");
  assert.equal(calls[0].request.lastFrameImage, undefined);
  assert.equal(calls[0].request.queue, true);
  assert.equal(calls[0].request.connectionKey, primary.id);
  assert.equal(calls[0].request.fallback?.connectionId, fallback.id);
  assert.equal(calls[0].request.fallback?.apiKey, "saved-fallback-secret");
  await animateCapabilityGalleryImage(
    db,
    { ...input, loop: true, durationSeconds: 5, aspectRatio: "16:9", debugMode: true },
    provider,
  );
  assert.deepEqual(calls[1].request.lastFrameImage, calls[1].request.referenceImage);
  assert.equal(calls[1].request.durationSeconds, 5);
  assert.equal(calls[1].request.aspectRatio, "16:9");
  assert.equal(calls[1].request.debugMode, true);
  const liveAbort = new AbortController();
  await animateCapabilityGalleryImage(db, { ...input, signal: liveAbort.signal }, provider);
  assert.equal(calls.at(-1)!.request.signal, liveAbort.signal, "cancellation reaches the queued provider");
  await connections.update(primary.id, { videoGenerationSource: "google_veo", videoService: "google_veo" });
  await animateCapabilityGalleryImage(db, { ...input, durationSeconds: 5 }, provider);
  assert.equal(calls.at(-1)!.request.durationSeconds, 8, "provider duration rules account for an image first frame");
  await connections.update(primary.id, { videoGenerationSource: "openrouter", videoService: "openrouter" });
  assert.equal(
    existsSync(join(directory, "game-scene-videos")),
    false,
    "the helper creates no chat rows or video files",
  );

  const beforeInvalid = calls.length;
  const wrong = await connections.create(createConnectionSchema.parse({ name: "Language", provider: "custom" }));
  const quarantined = await connections.create(
    createConnectionSchema.parse({
      name: "Unreviewed",
      provider: "video_generation",
      profileImportReviewRequired: true,
    }),
  );
  await db
    .update(apiConnections)
    .set({ profileImportReviewRequired: "true" })
    .where(eq(apiConnections.id, quarantined.id));
  for (const patch of [
    { connectionId: "missing" },
    { connectionId: wrong.id },
    { connectionId: quarantined.id },
    { galleryImageId: "missing" },
    { galleryImageId: "https://example.invalid/image.png" },
    { prompt: " " },
    { durationSeconds: NaN },
    { durationSeconds: 0 },
    { aspectRatio: "4:3" },
  ])
    await assert.rejects(animateCapabilityGalleryImage(db, { ...input, ...patch } as typeof input, provider));
  for (const path of ["../outside.png", "global/../fixture.png", "other/fixture.png", "global/missing.png"]) {
    const bad = await gallery.createImage({ filePath: path });
    assert(bad);
    await assert.rejects(animateCapabilityGalleryImage(db, { ...input, galleryImageId: bad.id }, provider));
  }
  writeFileSync(join(root, "invalid.png"), "not an image");
  const invalid = await gallery.createImage({ filePath: "global/invalid.png" });
  assert(invalid);
  await assert.rejects(animateCapabilityGalleryImage(db, { ...input, galleryImageId: invalid.id }, provider));
  writeFileSync(join(outside, "private.png"), png);
  symlinkSync(join(outside, "private.png"), join(root, "linked.png"));
  const linked = await gallery.createImage({ filePath: "global/linked.png" });
  assert(linked);
  await assert.rejects(animateCapabilityGalleryImage(db, { ...input, galleryImageId: linked.id }, provider));
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(animateCapabilityGalleryImage(db, { ...input, signal: abort.signal }, provider), /abort/i);
  assert.equal(calls.length, beforeInvalid, "invalid, missing and cancelled inputs never contact the provider");
  await assert.rejects(
    animateCapabilityGalleryImage(db, input, async () => {
      throw new Error("fixture provider failure");
    }),
    /fixture provider failure/,
  );

  const sharp = await getSharp();
  assert(sharp, "the image conversion regression requires the installed image processor");
  const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: "pink" } })
    .webp()
    .toBuffer();
  writeFileSync(join(root, "fixture.webp"), webp);
  const converted = await gallery.createImage({ filePath: "global/fixture.webp" });
  assert(converted);
  await animateCapabilityGalleryImage(db, { ...input, galleryImageId: converted.id }, provider);
  assert.equal(calls.at(-1)!.request.referenceImage?.mimeType, "image/png");
  assert.notEqual(calls.at(-1)!.request.referenceImage?.base64, webp.toString("base64"));
  assert.equal(calls.at(-1)!.request.referenceImage?.url, undefined, "converted image bytes have no public URL");

  const filename = "Banner #1 + 100%.jpeg";
  const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: "pink" } })
    .jpeg()
    .toBuffer();
  writeFileSync(join(root, filename), jpeg);
  const jpegImage = await gallery.createImage({ filePath: `global/${filename}` });
  assert(jpegImage);
  await animateCapabilityGalleryImage(db, { ...input, galleryImageId: jpegImage.id }, provider);
  const relativeUrl = "/api/global-gallery/file/Banner%20%231%20%2B%20100%25.jpeg";
  assert.equal(calls.at(-1)!.request.referenceImage?.url, relativeUrl);
  assert.equal(calls.at(-1)!.request.referenceImage?.mimeType, "image/jpeg");
  assert.equal(calls.at(-1)!.request.referenceImage?.base64, jpeg.toString("base64"));

  const seedance = await connections.create(
    createConnectionSchema.parse({
      name: "Seedance public reference fixture",
      provider: "video_generation",
      videoGenerationSource: "seedance",
      videoService: "seedance",
      baseUrl: "https://8.8.8.8",
      apiKey: "fixture-only",
    }),
  );
  const seedanceInput = { ...input, connectionId: seedance.id, galleryImageId: jpegImage.id, loop: true };
  const originalFetch = globalThis.fetch;
  const originalPublicBase = process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL;
  const submissions: Array<{ input: { image_urls: string[] } }> = [];
  await connections.update(fallback.id, { fallbackForAgents: false });
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://8.8.8.8/v1/videos/generations");
    submissions.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify({ error: "fixture stops before generation" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    delete process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL;
    await assert.rejects(animateCapabilityGalleryImage(db, seedanceInput), /require.*publicly reachable HTTPS/);
    assert.equal(submissions.length, 0, "missing public configuration does not submit or upload an image");
    process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL = "https://public.fixture.example";
    await assert.rejects(animateCapabilityGalleryImage(db, seedanceInput), /400.*fixture stops before generation/);
    assert.equal(submissions.length, 1, "the real Seedance adapter reaches the intercepted submission once");
    const publicUrl = `https://public.fixture.example${relativeUrl}`;
    assert.deepEqual(submissions[0].input.image_urls, [publicUrl, publicUrl]);
    await animateCapabilityGalleryImage(db, seedanceInput, provider);
    assert.equal(calls.at(-1)!.request.publicReferenceUpload, null, "temporary upload remains opt-in");
    await connections.updateDefaultParameters(seedance.id, {
      videoGeneration: {
        service: "seedance",
        seedance: { temporaryPublicReferenceUploadEnabled: true, temporaryPublicReferenceUploadExpiry: "1h" },
      },
    });
    await animateCapabilityGalleryImage(db, seedanceInput, provider);
    assert.deepEqual(calls.at(-1)!.request.publicReferenceUpload, { enabled: true, expiry: "1h" });
    assert.equal(
      calls.at(-1)!.request.referenceImage?.url,
      undefined,
      "explicit upload retains its byte-based reference even when a protected public origin is configured",
    );
    assert.equal(calls.at(-1)!.request.lastFrameImage?.url, undefined);
    assert.equal(submissions.length, 1, "the fixture makes no live provider or temporary-upload requests");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPublicBase === undefined) delete process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL;
    else process.env.VIDEO_REFERENCE_PUBLIC_BASE_URL = originalPublicBase;
    await connections.update(fallback.id, { fallbackForAgents: true });
  }
  let finish!: () => void, started!: () => void;
  const generating = new Promise<void>((resolve) => {
    started = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const pending = animateCapabilityGalleryImage(db, input, async () => {
    started();
    await blocked;
    return video;
  });
  await generating;
  const unlocked = await Promise.race([
    withGlobalGalleryImageLifecycleLocks([image.id], () => true),
    new Promise<false>((resolve) => {
      const timer = setTimeout(() => resolve(false), 1000);
      timer.unref();
    }),
  ]);
  finish();
  await pending;
  assert.equal(unlocked, true, "slow video generation does not hold the image's deletion lock");
} finally {
  await db._fileStore.close();
  rmSync(directory, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
}
console.info(
  "Gallery animation uses saved credentials/defaults/fallback, validated artwork, loop frames and queued media without exposing secrets or creating chat records.",
);
