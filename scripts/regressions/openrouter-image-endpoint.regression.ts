import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateImage, usesOpenRouterImagesApi } from "../../packages/server/src/services/image/image-generation.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
let failureStatus = 404;
let failureMessage =
  "future/image-only is an image generation model and cannot be used with the chat/completions endpoint. Use the /api/v1/images endpoint instead.";
let imagesFail = false;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push({ path: request.url ?? "", body: JSON.parse(Buffer.concat(chunks).toString()) });
  response.setHeader("content-type", "application/json");
  if (request.url?.endsWith("/images") && !imagesFail) {
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  } else {
    response.statusCode = failureStatus;
    response.end(JSON.stringify({ error: { message: failureMessage, code: failureStatus } }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const generate = (model: string) =>
    generateImage("openrouter", `http://127.0.0.1:${address.port}/api/v1`, "fixture-key", "openrouter", {
      model,
      prompt: "a moonlit laboratory",
      negativePrompt: "letters",
      width: 1024,
      height: 1536,
      referenceImages: [png],
      allowLocalUrls: true,
    });
  for (const model of ["qwen/qwen-image-3", "meta/muse-image"]) {
    requests.length = 0;
    assert.equal((await generate(model)).base64, png);
    assert.equal(requests.length, 1, `${model} must use the Images API directly`);
    assert.equal(requests[0]?.path, "/api/v1/images");
    assert.equal(requests[0]?.body.model, model);
    assert.equal(requests[0]?.body.aspect_ratio, "2:3");
    assert.match(String(requests[0]?.body.prompt), /letters/);
    assert.ok(Array.isArray(requests[0]?.body.input_references));
    assert.equal(requests[0]?.body.messages, undefined);
  }
  for (const status of [400, 404]) {
    failureStatus = status;
    requests.length = 0;
    assert.equal((await generate("future/image-only")).base64, png);
    assert.deepEqual(
      requests.map(({ path }) => path),
      ["/api/v1/chat/completions", "/api/v1/images"],
    );
    assert.equal(requests[1]?.body.model, "future/image-only");
  }
  for (const status of [401, 429, 500]) {
    failureStatus = status;
    requests.length = 0;
    await assert.rejects(generate("future/image-only"));
    assert.equal(requests.length, 1, "Non-validation failures must not trigger another generation");
  }
  failureStatus = 400;
  failureMessage = "Invalid model or missing image data";
  requests.length = 0;
  await assert.rejects(generate("future/image-only"));
  assert.equal(requests.length, 1);
  failureMessage =
    "future/image-only is an image generation model and cannot be used with the chat/completions endpoint. Use the /api/v1/images endpoint instead.";
  imagesFail = true;
  requests.length = 0;
  await assert.rejects(generate("future/image-only"), /OpenRouter Images API failed/);
  assert.equal(requests.length, 2, "An unsuccessful Images API retry must not loop");
  for (const model of [
    "microsoft/mai-image-2.5",
    "x-ai/grok-imagine-image-2.0",
    "black-forest-labs/flux.2-pro",
    "google/gemini-2.5-flash-image",
  ])
    assert.equal(usesOpenRouterImagesApi(model), false, "Existing chat-capable models retain their route");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("OpenRouter image endpoint regression passed");
