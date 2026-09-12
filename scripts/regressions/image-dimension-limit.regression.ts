import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<Record<string, unknown>> = [];
let axis = "height";
let limit = 1440;
let status = 400;
let keepFailing = false;
let errorMessage: string | undefined;
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
  requests.push(body);
  const dimensions = String(body.size).split("x").map(Number);
  const dimension = dimensions[axis === "width" ? 0 : 1]!;
  response.setHeader("content-type", "application/json");
  if (keepFailing || dimension > limit) {
    response.statusCode = status;
    response.end(
      JSON.stringify({
        message:
          errorMessage ??
          `1 validation error for Flux2Pro\n${axis}\n Input should be less than or equal to ${limit} [type=less_than_equal, input_value=${dimension}, input_type=int]`,
      }),
    );
  } else {
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const generate = (backend: string, width = 1024, height = 1536) =>
    generateImage(backend, `http://127.0.0.1:${address.port}/v1`, "fixture-key", backend, {
      model: "flux-2-pro",
      prompt: "a moonlit laboratory",
      negativePrompt: "letters",
      width,
      height,
      referenceImages: [png],
      allowLocalUrls: true,
    });
  for (const backend of ["nanogpt", "openai"]) {
    requests.length = 0;
    axis = "height";
    assert.equal((await generate(backend)).base64, png);
    assert.deepEqual(
      requests.map((body) => body.size),
      ["1024x1536", "960x1440"],
    );
    assert.deepEqual({ ...requests[0], size: "960x1440" }, requests[1], "Only dimensions may change on retry");
    if (backend === "nanogpt") assert.ok(requests[1]?.imageDataUrl, "NanoGPT avatar references survive the retry");
    requests.length = 0;
    axis = "width";
    assert.equal((await generate(backend, 1536, 1024)).base64, png);
    assert.deepEqual(
      requests.map((body) => body.size),
      ["1536x1024", "1440x960"],
    );
  }
  for (const statusCode of [401, 429, 500]) {
    status = statusCode;
    requests.length = 0;
    axis = "height";
    await assert.rejects(generate("nanogpt"));
    assert.equal(requests.length, 1);
  }
  status = 400;
  errorMessage = "Image generation failed for an unrelated reason";
  requests.length = 0;
  await assert.rejects(generate("nanogpt"));
  assert.equal(requests.length, 1);
  errorMessage = undefined;
  keepFailing = true;
  requests.length = 0;
  await assert.rejects(generate("nanogpt"));
  assert.equal(requests.length, 2, "Dimension correction must not loop");
  keepFailing = false;
  limit = 2048;
  requests.length = 0;
  assert.equal((await generate("nanogpt")).base64, png);
  assert.deepEqual(
    requests.map((body) => body.size),
    ["1024x1536"],
    "Endpoints accepting 1536 must not be capped",
  );
  for (const [width, height] of [
    [960, 1440],
    [1440, 960],
    [2048, 2048],
  ]) {
    requests.length = 0;
    assert.equal((await generate("openai", width, height)).base64, png);
    assert.deepEqual(
      requests.map((body) => body.size),
      [`${width}x${height}`],
      "Non-GPT models must retain their configured dimensions instead of GPT Image canvas presets",
    );
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
console.info("Image dimension limit regression passed");
