import assert from "node:assert/strict";
import { createServer } from "node:http";
import { logger } from "../../packages/server/src/lib/logger.js";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";
import { resolveConnectionImageDefaults } from "../../packages/server/src/services/image/image-generation-defaults.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const custom = {
  lora_url_1: "https://example.com/style.safetensors",
  lora_scale_1: 0.7,
  loras: [{ path: "second", scale: 0.4 }],
  seed: 42,
  prompt: "custom prompt",
  enabled: false,
  nullable: null,
  headers: { Authorization: "body-only-credential" },
  api_key: "custom-api-credential",
  accessToken: "custom-access-credential",
  nested: [{ secret: "nested-credential", max_tokens: 256, token_count: 12 }],
  serialized: JSON.stringify({ password: "serialized-credential", image: `data:image/png;base64,${png}` }),
  imageDataUrl: `data:image/png;base64,${png}`,
  rawImage: png,
  max_tokens: 512,
  method: "DELETE",
};
const logs: unknown[][] = [];
const priorWarn = logger.warn;
const priorLevel = logger.level;
logger.level = "warn";
logger.warn = ((...args: unknown[]) => logs.push(args)) as typeof logger.warn;
function assertSafeLogs() {
  const payloadLogs = logs.filter(([message]) => String(message).includes("payload"));
  assert.ok(payloadLogs.length > 0, "Explicit debug mode still logs the request");
  const text = JSON.stringify(payloadLogs);
  for (const sensitive of [
    png,
    "body-only-credential",
    "custom-api-credential",
    "custom-access-credential",
    "nested-credential",
    "serialized-credential",
  ]) {
    assert.ok(!text.includes(sensitive), "Image bytes and credentials must not enter debug logs");
  }
  assert.ok(text.includes("custom prompt"), "Prompt diagnostics remain readable");
  const payloads = payloadLogs.map((entry) => JSON.parse(String(entry[1])));
  const fields = payloads.flatMap((payload) => (Array.isArray(payload) ? payload : [payload]));
  assert.ok(
    fields.some((field) => Number(field.max_tokens) === 512),
    "Ordinary token-limit diagnostics survive",
  );
  assert.ok(
    fields.some((field) => field.nested?.[0]?.max_tokens === 256 && field.nested?.[0]?.token_count === 12),
    "Nested token limits/counts survive",
  );
  logs.length = 0;
}
const requests: Array<{
  url: string;
  method: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  const contentType = request.headers["content-type"] ?? "";
  let body: Record<string, unknown> = {};
  if (contentType.startsWith("multipart/form-data")) {
    body = Object.fromEntries(
      (await new Response(bytes, { headers: { "content-type": contentType } }).formData()).entries(),
    );
  } else if (bytes.length) body = JSON.parse(bytes.toString());
  requests.push({ url: request.url!, method: request.method!, authorization: request.headers.authorization, body });
  response.setHeader("content-type", "application/json");
  if (request.url!.startsWith("/fail/")) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: "fixture failure" }));
  } else if (request.url!.includes("generate/async")) response.end(JSON.stringify({ id: "job" }));
  else if (request.url!.includes("/fal-ai/"))
    response.end(JSON.stringify({ images: [{ url: `data:image/png;base64,${png}` }] }));
  else if (request.url!.includes("generate/check")) response.end(JSON.stringify({ done: true }));
  else if (request.url!.includes("generate/status")) response.end(JSON.stringify({ generations: [{ img: png }] }));
  else response.end(JSON.stringify({ data: [{ b64_json: png, url: `data:image/png;base64,${png}` }], images: [png] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const defaults = (service: string, value: unknown = custom) =>
    resolveConnectionImageDefaults({
      imageService: service,
      defaultParameters: JSON.stringify({
        customParameters: value,
        imageGeneration: { seed: 17, novelai: { steps: 31 } },
      }),
    });
  assert.equal(defaults("openai", []), null);
  const novelai = defaults("novelai");
  assert.equal(novelai?.seed, 17);
  assert.equal(novelai?.novelai?.steps, 31);
  assert.deepEqual(novelai?.customParameters, custom);
  for (const backend of ["openai", "nanogpt", "xai", "togetherai", "openrouter", "venice", "zai", "arli", "fal"]) {
    requests.length = 0;
    const result = await generateImage(backend, baseUrl, "fixture-key", backend, {
      prompt: "default prompt",
      referenceImage: backend === "nanogpt" || backend === "arli" ? png : undefined,
      model: backend === "fal" ? "fal-ai/flux/schnell" : backend === "openrouter" ? "openai/gpt-image-2" : "flux-2-pro",
      imageDefaults: defaults(backend),
      allowLocalUrls: true,
      debugMode: true,
    });
    assert.equal(result.base64, png);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.method, "POST");
    assert.equal(requests[0]!.authorization, `${backend === "fal" ? "Key" : "Bearer"} fixture-key`);
    for (const [key, value] of Object.entries(custom))
      assert.deepEqual(requests[0]!.body[key], value, `${backend}: ${key}`);
    assertSafeLogs();
  }
  requests.length = 0;
  await generateImage("openai", baseUrl, "fixture-key", "openai", {
    prompt: "default prompt",
    model: "gpt-image-2",
    referenceImage: png,
    debugMode: true,
    imageDefaults: defaults("openai"),
    allowLocalUrls: true,
  });
  assert.match(requests[0]!.url, /\/images\/edits$/u);
  const referenceFile = requests[0]!.body["image[]"];
  assert.ok(referenceFile instanceof Blob, "Reference file remains present");
  assert.deepEqual(
    Buffer.from(await referenceFile.arrayBuffer()),
    Buffer.from(png, "base64"),
    "Logging preserves uploaded image bytes",
  );
  for (const [key, value] of Object.entries(custom)) {
    assert.equal(requests[0]!.body[key], typeof value === "string" ? value : JSON.stringify(value));
  }
  assert.equal(requests[0]!.authorization, "Bearer fixture-key");
  assertSafeLogs();
  requests.length = 0;
  await generateImage("horde", baseUrl, "fixture-key", "horde", {
    prompt: "default prompt",
    imageDefaults: defaults("horde"),
    allowLocalUrls: true,
  });
  assert.equal(requests[0]!.body.lora_scale_1, 0.7);
  assert.deepEqual(
    requests.slice(1).map(({ method, body }) => ({ method, body })),
    [
      { method: "GET", body: {} },
      { method: "GET", body: {} },
    ],
    "Polling requests do not inherit generation fields",
  );
  requests.length = 0;
  await generateImage("openai", `http://127.0.0.1:${address.port}/fail/v1`, "fixture-key", "openai", {
    prompt: "default prompt",
    imageDefaults: defaults("openai"),
    allowLocalUrls: true,
    fallback: {
      connectionId: "fallback",
      connectionName: "Fallback",
      provider: "image_generation",
      source: "openai",
      baseUrl,
      apiKey: "fallback-key",
      serviceHint: "openai",
      model: "flux-2-pro",
      imageDefaults: defaults("openai", { seed: 99 }),
    },
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1]!.body.seed, 99);
  assert.equal(requests[1]!.body.lora_url_1, undefined, "Primary fields do not leak into a fallback connection");
  assert.equal(requests[1]!.authorization, "Bearer fallback-key");
} finally {
  logger.warn = priorWarn;
  logger.level = priorLevel;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info(
  "Image custom parameters reach JSON/multipart generation, preserve transport, and stay out of polls/fallback defaults.",
);
