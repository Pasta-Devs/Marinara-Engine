import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const { Agent, getGlobalDispatcher, setGlobalDispatcher } = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
)("undici");
const previousDispatcher = getGlobalDispatcher();
const previousTimeout = process.env.IMAGE_GEN_TIMEOUT_MS;
process.env.IMAGE_GEN_TIMEOUT_MS = "5000";
// Reproduce the transport's shorter default without a five-minute regression.
const shortTimeoutDispatcher = new Agent({ headersTimeout: 10, bodyTimeout: 10 });
setGlobalDispatcher(shortTimeoutDispatcher);

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const server = createServer((request, response) => {
  request.resume();
  if (request.url?.startsWith("/stall/")) return;
  response.setHeader("Content-Type", "application/json");
  const body = JSON.stringify({ data: [{ b64_json: png }] });
  const delayBody = request.url?.startsWith("/body/");
  if (delayBody) response.write(body.slice(0, 1));
  const timer = setTimeout(() => response.end(delayBody ? body.slice(1) : body), 2000);
  response.once("close", () => clearTimeout(timer));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");
  const generate = (path: string, signal?: AbortSignal) =>
    generateImage("openai", `${base}/${path}/v1`, "fixture-key", "openai", {
      prompt: "a moonlit laboratory",
      model: "local-flux",
      allowLocalUrls: true,
      signal,
    });

  await assert.rejects(fetch(`${base}/headers/`), (error: unknown) => {
    assert.equal((error as { cause?: { code?: string } }).cause?.code, "UND_ERR_HEADERS_TIMEOUT");
    return true;
  });
  for (const path of ["headers", "body"]) {
    assert.equal((await generate(path)).base64, png, `${path} must honor the configured image timeout`);
  }

  const abortStartedAt = Date.now();
  await assert.rejects(generate("stall", AbortSignal.timeout(50)), /timeout|aborted/i);
  assert.ok(Date.now() - abortStartedAt < 1000, "Caller cancellation must settle before the image deadline");
  await assert.rejects(generate("stall"), /5000|5 seconds/);
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  setGlobalDispatcher(previousDispatcher);
  await shortTimeoutDispatcher.close();
  if (previousTimeout === undefined) delete process.env.IMAGE_GEN_TIMEOUT_MS;
  else process.env.IMAGE_GEN_TIMEOUT_MS = previousTimeout;
}

console.info("Image generation transport timeout regression passed.");
