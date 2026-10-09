import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { compressJsonHook } from "../../packages/server/src/middleware/compress-json.js";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

// API JSON is compressed for clients that accept it; SSE, streams, small bodies and non-API routes are not.
const big = {
  messages: Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, content: "Professor Mari ".repeat(20) })),
};
const app = Fastify();
app.addHook("onSend", compressJsonHook);
app.get("/api/big", async () => big);
app.get("/api/small", async () => ({ ok: true }));
app.get("/big", async () => big);
app.get("/api/stream", async (_req, reply) =>
  reply.type("application/json").send(Readable.from([JSON.stringify(big)])),
);
app.get("/api/sse", (_req, reply) => {
  reply.raw.writeHead(200, { "Content-Type": "text/event-stream" });
  reply.raw.end(`data: ${JSON.stringify(big)}\n\n`);
});
await app.ready();

try {
  const get = (url: string, encoding?: string) =>
    app.inject({ method: "GET", url, headers: encoding ? { "accept-encoding": encoding } : {} });
  const json = JSON.stringify(big);

  const br = await get("/api/big", "gzip, deflate, br");
  assert.equal(br.headers["content-encoding"], "br");
  assert.match(String(br.headers.vary), /Accept-Encoding/);
  assert.equal(brotliDecompressSync(br.rawPayload).toString(), json);
  assert.ok(br.rawPayload.length < json.length / 5, "the body shrinks");
  assert.equal(Number(br.headers["content-length"]), br.rawPayload.length);

  const gz = await get("/api/big", "br;q=0, gzip");
  assert.equal(gz.headers["content-encoding"], "gzip", "q=0 turns an encoding off");
  assert.equal(gunzipSync(gz.rawPayload).toString(), json);

  const plain = await get("/api/big");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.body, json);
  assert.match(String(plain.headers.vary), /Accept-Encoding/, "a cache must not serve the plain body to others");

  for (const url of ["/api/small", "/big", "/api/stream", "/api/sse"]) {
    const response = await get(url, "br, gzip");
    assert.equal(response.headers["content-encoding"], undefined, `${url} stays uncompressed`);
  }
  assert.match((await get("/api/sse", "br")).body, /^data: /);
} finally {
  await app.close();
}
