import assert from "node:assert/strict";
import { request } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { compressJsonHook } from "../../packages/server/src/middleware/compress-json.js";

const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const Fastify = requireServer("fastify") as typeof import("fastify").default;

// API JSON is compressed for clients that accept it; SSE, streams, small bodies, non-API routes and the
// server's own app.inject() reads are not.
const big = {
  messages: Array.from({ length: 200 }, (_, i) => ({ id: `m${i}`, content: "Professor Mari ".repeat(20) })),
};
const json = JSON.stringify(big);
const app = Fastify();
app.addHook("onSend", compressJsonHook);
app.get("/api/big", async () => big);
app.get("/api/small", async () => ({ ok: true }));
app.get("/big", async () => big);
app.get("/api/stream", async (_req, reply) => reply.type("application/json").send(Readable.from([json])));
app.get("/api/sse", (_req, reply) => {
  reply.raw.writeHead(200, { "Content-Type": "text/event-stream" });
  reply.raw.end(`data: ${json}\n\n`);
});
await app.listen({ port: 0, host: "127.0.0.1" });
const { port } = app.server.address() as AddressInfo;

/** Raw bytes and headers, without the client decompressing them. */
function get(path: string, encoding?: string) {
  return new Promise<{ headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path, headers: encoding ? { "accept-encoding": encoding } : {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

try {
  const br = await get("/api/big", "gzip, deflate, br");
  assert.equal(br.headers["content-encoding"], "br");
  assert.match(String(br.headers.vary), /Accept-Encoding/);
  assert.equal(brotliDecompressSync(br.body).toString(), json);
  assert.ok(br.body.length < json.length / 5, "the body shrinks");
  assert.equal(Number(br.headers["content-length"]), br.body.length);

  const gz = await get("/api/big", "br;q=0, gzip");
  assert.equal(gz.headers["content-encoding"], "gzip", "q=0 turns an encoding off");
  assert.equal(gunzipSync(gz.body).toString(), json);

  const plain = await get("/api/big");
  assert.equal(plain.headers["content-encoding"], undefined);
  assert.equal(plain.body.toString(), json);
  assert.match(String(plain.headers.vary), /Accept-Encoding/, "a cache must not serve the plain body to others");

  for (const path of ["/api/small", "/big", "/api/stream", "/api/sse"]) {
    const response = await get(path, "br, gzip");
    assert.equal(response.headers["content-encoding"], undefined, `${path} stays uncompressed`);
  }
  assert.match((await get("/api/sse", "br")).body.toString(), /^data: /);

  // Prompt preview forwards the browser's headers into app.inject() and parses the reply itself.
  const injected = await app.inject({ url: "/api/big", headers: { "accept-encoding": "br, gzip" } });
  assert.equal(injected.headers["content-encoding"], undefined);
  assert.deepEqual(injected.json(), big);
} finally {
  await app.close();
}
