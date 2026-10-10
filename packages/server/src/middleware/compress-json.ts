import { IncomingMessage } from "node:http";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import type { FastifyReply, FastifyRequest } from "fastify";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Below this a compressed body saves less than the headers cost. */
const MIN_BYTES = 1024;

function acceptedEncoding(header: string | string[] | undefined): "br" | "gzip" | null {
  const offered = new Set<string>();
  for (const part of String(header ?? "").split(",")) {
    const [name = "", ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
    if (q && Number(q.slice(2)) === 0) continue;
    offered.add(name.trim());
  }
  if (offered.has("br")) return "br";
  if (offered.has("gzip")) return "gzip";
  return null;
}

/**
 * Compress finished API JSON bodies. A long chat's messages are hundreds of KB of JSON, which over a LAN
 * or a phone connection is most of the wait. Streams never get here as a string or Buffer: SSE writes to
 * `reply.raw`, and file sends pass a stream, so both go out untouched. Replies to `app.inject()` stay plain:
 * the server reads those itself (prompt preview forwards the browser's own Accept-Encoding).
 */
export async function compressJsonHook(req: FastifyRequest, reply: FastifyReply, payload: unknown) {
  if (typeof payload !== "string" && !Buffer.isBuffer(payload)) return payload;
  if (!(req.raw instanceof IncomingMessage)) return payload;
  if (!req.url.startsWith("/api/") || reply.hasHeader("content-encoding")) return payload;
  if (!String(reply.getHeader("content-type") ?? "").includes("application/json")) return payload;
  if (Buffer.byteLength(payload) < MIN_BYTES) return payload;
  const vary = String(reply.getHeader("vary") ?? "");
  if (!/accept-encoding/i.test(vary)) reply.header("vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  const encoding = acceptedEncoding(req.headers["accept-encoding"]);
  if (!encoding) return payload;
  // Quality 4 / level 6: most of the saving at a few ms for a 300 KB body; brotli's default 11 is far slower.
  const body =
    encoding === "br"
      ? await brotli(payload, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      : await gzipAsync(payload, { level: 6 });
  reply.header("content-encoding", encoding);
  reply.removeHeader("content-length");
  return body;
}
