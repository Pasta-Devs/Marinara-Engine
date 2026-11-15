import assert from "node:assert/strict";
import { createServer } from "node:http";

const previousLimit = process.env.IMAGE_GEN_MAX_RESPONSE_BYTES;
process.env.IMAGE_GEN_MAX_RESPONSE_BYTES = "400";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const server = createServer((request, response) => {
  request.resume();
  response.setHeader("Content-Type", "application/json");
  const padding = request.url?.startsWith("/big/") ? "x".repeat(400) : "";
  response.end(JSON.stringify({ data: [{ b64_json: png }], padding }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const { generateImage } = await import("../../../packages/server/src/services/image/image-generation.js");
  const generate = (path: string) =>
    generateImage("openai", `${base}/${path}/v1`, "fixture-key", "openai", {
      prompt: "a moonlit laboratory",
      model: "local-flux",
      allowLocalUrls: true,
    });

  assert.equal((await generate("small")).base64, png, "A response under the configured limit must pass");
  await assert.rejects(generate("big"), (error: unknown) => {
    const message = (error as Error).message;
    assert.match(message, /^Outbound response exceeded 400 bytes/, "The configured limit must apply");
    assert.match(message, /IMAGE_GEN_MAX_RESPONSE_BYTES/, "The error must name the setting");
    return true;
  });
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (previousLimit === undefined) delete process.env.IMAGE_GEN_MAX_RESPONSE_BYTES;
  else process.env.IMAGE_GEN_MAX_RESPONSE_BYTES = previousLimit;
}

console.info("Image response limit regression passed.");
