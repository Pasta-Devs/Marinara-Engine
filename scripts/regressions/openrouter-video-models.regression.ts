import assert from "node:assert/strict";
import { promises as dns } from "node:dns";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "marinara-openrouter-videos-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.OPENROUTER_VIDEO_POLL_INTERVAL_MS = "1";
process.env.LOG_LEVEL = "silent";
const originalFetch = globalThis.fetch;
const originalLookup = dns.lookup;
dns.lookup = (async () => [{ address: "8.8.8.8", family: 4 }]) as typeof dns.lookup;
const requests: Array<{ url: URL; body: Record<string, unknown> | null }> = [];
const models = [
  { id: "minimax/hailuo-3-max", name: "MiniMax: H3 Max", supported_resolutions: ["480p", "768p"] },
  { id: "bytedance/seedance-2.5", name: "ByteDance: Seedance 2.5", supported_resolutions: ["480p", "720p"] },
];
const mp4 = Buffer.from("000000186674797069736f6d0000020069736f6d6d703432", "hex");
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, "https://openrouter.ai", "no real network or third-party endpoint is contacted");
  const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null;
  requests.push({ url, body });
  assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-key");
  if (url.pathname.endsWith("/content")) return new Response(mp4, { headers: { "content-type": "video/mp4" } });
  if (init?.method === "POST") return json({ id: "fixture-job" });
  return json({ id: "fixture-job", status: "completed" });
};
const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { connectionsRoutes } = await import("../../packages/server/src/routes/connections.routes.js");
const { generateVideo } = await import("../../packages/server/src/services/video/video-generation.js");
const { resolveGameVideoRuntime } = await import("../../packages/server/src/services/video/game-video-runtime.js");
const { MODEL_LISTS, inferVideoSource, normalizeVideoGenerationProfile } =
  await import("../../packages/shared/dist/index.js");
const app = Fastify();
app.decorate("db", await getDB());
try {
  await app.register(connectionsRoutes, { prefix: "/connections" });
  for (const model of models) {
    assert.ok(MODEL_LISTS.video_generation.some((entry) => entry.id === model.id));
    assert.equal(inferVideoSource(model.id, ""), "openrouter");
  }
  const created = await app.inject({
    method: "POST",
    url: "/connections",
    payload: {
      name: "Video models fixture",
      provider: "video_generation",
      videoGenerationSource: "openrouter",
      videoService: "openrouter",
      model: "minimax/hailuo-3-max",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "fixture-key",
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id as string;
  const discovery = await app.inject({ method: "GET", url: `/connections/${id}/models?refresh=true` });
  assert.equal(discovery.statusCode, 200, discovery.body);
  for (const model of models) assert.ok(discovery.json().models.some((entry: { id: string }) => entry.id === model.id));
  assert.equal(requests.length, 0, "curated discovery adds no network request or unknown model capability contract");

  const profile = normalizeVideoGenerationProfile({
    service: "openrouter",
    openrouter: {
      durationSeconds: 15,
      resolution: "768p",
      aspectRatio: "9:16",
    },
  }).profile;
  assert.equal(profile.openrouter.resolution, "768p", "saved H3 Max resolution is not replaced by 720p");
  const saved = await app.inject({
    method: "PATCH",
    url: `/connections/${id}`,
    payload: {
      defaultParameters: JSON.stringify({ videoGeneration: profile }),
    },
  });
  assert.equal(saved.statusCode, 200, saved.body);
  const reloaded = (await app.inject({ method: "GET", url: `/connections/${id}` })).json();
  assert.equal(resolveGameVideoRuntime(reloaded).resolution, "768p");
  assert.equal(
    resolveGameVideoRuntime({ ...reloaded, model: "google/veo-3.1" }).resolution,
    "720p",
    "switching away from H3 Max clears its saved 768p resolution",
  );
  assert.equal(
    resolveGameVideoRuntime({ ...reloaded, videoGenerationSource: "nanogpt", videoService: "nanogpt" }).resolution,
    "720p",
    "NanoGPT's shared defaults never inherit H3 Max's 768p resolution",
  );

  const generate = (model: string, durationSeconds: number, resolution: "480p" | "720p" | "768p" | "1080p") =>
    generateVideo("openrouter", "https://openrouter.ai/api/v1", "fixture-key", "openrouter", {
      model,
      prompt: "rain above a forest",
      durationSeconds,
      aspectRatio: "16:9",
      resolution,
      referenceImage: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
      lastFrameImage: { base64: "iVBORw0KGgo=", mimeType: "image/png" },
    });
  for (const [model, duration, resolution, expectedDuration, expectedResolution] of [
    ["minimax/hailuo-3-max", 1, "720p", 5, "768p"],
    ["minimax/hailuo-3-max", 60, "480p", 15, "480p"],
    ["bytedance/seedance-2.5", 60, "1080p", 30, "720p"],
    ["bytedance/seedance-2.5", 4, "480p", 4, "480p"],
    ["future/video", 25, "1080p", 25, "1080p"],
    ["google/veo-3.1", 8, "768p", 8, "720p"],
  ] as const) {
    const result = await generate(model, duration, resolution);
    assert.equal(result.base64, mp4.toString("base64"));
    const body = requests.filter((entry) => entry.body).at(-1)!.body!;
    assert.equal(body.model, model);
    assert.equal(body.duration, expectedDuration);
    assert.equal(body.resolution, expectedResolution);
    assert.equal(body.generate_audio, false);
    assert.deepEqual(
      (body.frame_images as Array<{ frame_type: string }>).map((frame) => frame.frame_type),
      ["first_frame", "last_frame"],
    );
  }
} finally {
  globalThis.fetch = originalFetch;
  dns.lookup = originalLookup;
  await app.close();
  await closeDB();
  rmSync(directory, { recursive: true, force: true });
}
console.info("OpenRouter video models regression passed");
