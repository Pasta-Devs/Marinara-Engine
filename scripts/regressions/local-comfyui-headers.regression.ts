import assert from "node:assert/strict";
import { createServer } from "node:http";
import { normalizeImageGenerationProfile } from "../../packages/shared/src/constants/image-generation-defaults.js";
import { normalizeVideoGenerationProfile } from "../../packages/shared/src/constants/video-generation-defaults.js";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../../packages/server/src/services/image/image-generation-defaults.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const validHeaders = { "x-test-header": "test-value", "ngrok-skip-browser-warning": "true" };

// Reserved and malformed names must not survive normalization, so a hand-edited
// connection can never smuggle credentials or transport headers into requests.
// Reserved and malformed names fail the whole object closed, so a hand-edited
// connection can never smuggle credentials or transport headers into requests.
const smuggledHeaders = {
  ...validHeaders,
  Authorization: "Bearer smuggled",
  Cookie: "smuggled",
  "x-api-key": "smuggled",
  "Content-Type": "smuggled",
};
assert.equal(
  normalizeImageGenerationProfile(
    { version: 1, service: "comfyui", seed: -1, customHeaders: smuggledHeaders },
    "comfyui",
  ).profile.customHeaders,
  undefined,
);
assert.equal(
  normalizeVideoGenerationProfile({
    version: 1,
    service: "comfyui",
    comfyui: { loras: [] },
    customHeaders: smuggledHeaders,
  }).profile.customHeaders,
  undefined,
);
// Valid non-secret headers survive normalization on both profiles.
const normalizedImage = normalizeImageGenerationProfile(
  { version: 1, service: "comfyui", seed: -1, customHeaders: validHeaders },
  "comfyui",
).profile;
assert.deepEqual(normalizedImage.customHeaders, validHeaders);
const normalizedVideo = normalizeVideoGenerationProfile({
  version: 1,
  service: "comfyui",
  comfyui: { loras: [] },
  customHeaders: validHeaders,
}).profile;
assert.deepEqual(normalizedVideo.customHeaders, validHeaders);
assert.equal(normalizeImageGenerationProfile({}, "comfyui").profile.customHeaders, undefined);

const requests: Array<{ url: string; method: string; headers: Record<string, string | undefined> }> = [];
const server = createServer(async (request, response) => {
  for await (const _chunk of request) {
    // Drain the body; only headers are under test.
  }
  requests.push({
    url: request.url!,
    method: request.method!,
    headers: {
      authorization: request.headers.authorization,
      "x-test-header": request.headers["x-test-header"],
      "ngrok-skip-browser-warning": request.headers["ngrok-skip-browser-warning"],
    },
  });
  response.setHeader("content-type", "application/json");
  if (request.url!.startsWith("/prompt") && request.method === "POST") {
    response.end(JSON.stringify({ prompt_id: "p1" }));
  } else if (request.url!.startsWith("/history/")) {
    response.end(
      JSON.stringify({
        p1: {
          status: { status_str: "success", completed: true },
          outputs: { 9: { images: [{ filename: "out.png", subfolder: "", type: "output" }] } },
        },
      }),
    );
  } else if (request.url!.startsWith("/upload/image")) {
    response.end(JSON.stringify({ name: "uploaded.png" }));
  } else if (request.url!.startsWith("/view")) {
    response.setHeader("content-type", "image/png");
    response.end(Buffer.from(png, "base64"));
  } else {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "unexpected request" }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const imageDefaults = resolveConnectionImageDefaults({
    imageService: "comfyui",
    defaultParameters: JSON.stringify({
      imageGeneration: {
        version: 1,
        service: "comfyui",
        seed: -1,
        customHeaders: validHeaders,
        comfyui: { uploadPlaceholderOnMissingReference: false },
      },
    }),
  });
  assert.deepEqual(imageDefaults?.customHeaders, validHeaders);

  const result = await generateImage("comfyui", baseUrl, "fixture-key", "comfyui", {
    prompt: "a bowl of spaghetti",
    width: 64,
    height: 64,
    referenceImage: png,
    comfyWorkflow: JSON.stringify({
      1: { class_type: "LoadImage", inputs: { image: "%reference_image_name%" } },
      2: { class_type: "KSampler", inputs: { seed: "%seed%" } },
    }),
    imageDefaults,
    allowLocalUrls: true,
  });
  assert.equal(result.mimeType, "image/png");

  const byUrl = (prefix: string) => requests.filter(({ url }) => url.startsWith(prefix));
  assert.equal(byUrl("/upload/image").length, 1, "reference upload runs once");
  assert.equal(byUrl("/prompt").length, 1, "workflow queues once");
  assert.ok(byUrl("/history/").length >= 1, "history is polled");
  assert.equal(byUrl("/view").length, 1, "result downloads once");
  for (const { url, headers } of requests) {
    assert.equal(headers.authorization, "Bearer fixture-key", `${url} carries the API key as Bearer`);
    assert.equal(headers["x-test-header"], "test-value", `${url} carries custom headers`);
    assert.equal(headers["ngrok-skip-browser-warning"], "true", `${url} carries custom headers`);
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Local ComfyUI requests carry API-key Authorization plus validated custom headers.");
