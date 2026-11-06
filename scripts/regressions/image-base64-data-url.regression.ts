/**
 * A provider's base64 image field is decoded as the image it holds, not passed on as PNG:
 *   - xAI's generations endpoint (an image with no reference picture) fills `b64_json` with a whole
 *     `data:image/jpeg;base64,…` URL. Passed on as the base64 of a PNG, it was wrapped in a second data URL and
 *     decoded to broken bytes, so every Grok image without a reference failed after it was paid for;
 *   - bare base64 is typed by its bytes, so a JPEG is not labelled PNG; the OpenAI-compatible reader and Together AI
 *     answer the same way.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let answer = "";
const server = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ data: [{ b64_json: answer }] }));
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/v1`;
  const paint = (backend: string) =>
    generateImage(backend, baseUrl, "fixture-key", backend, {
      prompt: "a lighthouse keeper, full body",
      model: backend === "xai" ? "grok-imagine-image-2.0" : "fixture-model",
      width: 832,
      height: 1216,
      allowLocalUrls: true,
    });

  for (const backend of ["xai", "openai", "togetherai"]) {
    answer = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    const fromDataUrl = await paint(backend);
    assert.equal(fromDataUrl.mimeType, "image/jpeg", `${backend}: a data URL keeps its type`);
    assert.equal(fromDataUrl.ext, "jpg", backend);
    assert.deepEqual(Buffer.from(fromDataUrl.base64, "base64"), jpeg, `${backend}: the image bytes, not the data URL`);

    answer = jpeg.toString("base64");
    const bare = await paint(backend);
    assert.equal(bare.mimeType, "image/jpeg", `${backend}: bare base64 is typed by its bytes`);
    assert.equal(bare.base64, jpeg.toString("base64"), backend);

    answer = png;
    const bytesOfPng = await paint(backend);
    assert.deepEqual([bytesOfPng.mimeType, bytesOfPng.ext, bytesOfPng.base64], ["image/png", "png", png], backend);
  }
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("image base64 data URL regression passed");
