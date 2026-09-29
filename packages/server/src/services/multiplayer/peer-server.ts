import { createServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import {
  MULTIPLAYER_LIMITS,
  MULTIPLAYER_PROTOCOL_VERSION,
  multiplayerPeerRequestSchema,
  multiplayerPeerResponseSchema,
  parseMultiplayerJson,
  type MultiplayerPeerRequest,
  type MultiplayerPeerResponse,
  type MultiplayerErrorCode,
} from "@marinara-engine/shared";

export const MULTIPLAYER_PEER_SERVER_LIMITS = {
  sockets: 64,
  inFlight: 24,
  requestsPerAddress: 120,
  requestsGlobal: 300,
  addressBuckets: 256,
  windowMs: 60_000,
} as const;

interface PeerServerOptions {
  tls: { cert: Buffer; key: Buffer };
  port: number;
  host?: string;
  enabled: () => boolean;
  handle: (
    message: MultiplayerPeerRequest,
    context: { session: string | null; address: string; signal: AbortSignal },
  ) => Promise<MultiplayerPeerResponse>;
}

type Bucket = { count: number; until: number };

/** A room-only TLS listener. It never mounts Engine routes or forwards HTTP requests. */
export async function startMultiplayerPeerServer(options: PeerServerOptions) {
  if (!options.enabled()) throw new Error("Multiplayer is disabled");
  if (!options.tls.cert.length || !options.tls.key.length) throw new Error("Multiplayer requires TLS");
  const sockets = new Set<Duplex>();
  const active = new Set<AbortController>();
  const addressBuckets = new Map<string, Bucket>();
  let globalBucket: Bucket = { count: 0, until: 0 };
  let closed = false;

  function available() {
    try {
      return !closed && options.enabled();
    } catch {
      return false;
    }
  }
  function allowedRate(address: string) {
    const now = Date.now();
    if (globalBucket.until <= now) globalBucket = { count: 0, until: now + MULTIPLAYER_PEER_SERVER_LIMITS.windowMs };
    if (++globalBucket.count > MULTIPLAYER_PEER_SERVER_LIMITS.requestsGlobal) return false;
    let bucket = addressBuckets.get(address);
    if (!bucket || bucket.until <= now) {
      if (!bucket && addressBuckets.size >= MULTIPLAYER_PEER_SERVER_LIMITS.addressBuckets) {
        addressBuckets.delete(addressBuckets.keys().next().value!);
      }
      bucket = { count: 0, until: now + MULTIPLAYER_PEER_SERVER_LIMITS.windowMs };
      addressBuckets.set(address, bucket);
    }
    return ++bucket.count <= MULTIPLAYER_PEER_SERVER_LIMITS.requestsPerAddress;
  }
  function error(reply: ServerResponse, code: MultiplayerErrorCode, status = 200) {
    if (reply.destroyed || reply.writableEnded) return;
    reply.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      connection: "close",
    });
    reply.end(JSON.stringify({ version: MULTIPLAYER_PROTOCOL_VERSION, type: "error", code }));
  }

  async function receive(request: IncomingMessage, signal: AbortSignal) {
    const body: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      if (signal.aborted) throw new Error("Multiplayer request was cancelled");
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      size += buffer.length;
      if (size > MULTIPLAYER_LIMITS.actionBytes) throw new Error("Multiplayer request exceeds the size limit");
      body.push(buffer);
    }
    return parseMultiplayerJson(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(body)),
      multiplayerPeerRequestSchema,
      MULTIPLAYER_LIMITS.actionBytes,
    );
  }

  const server = createServer(
    {
      ...options.tls,
      handshakeTimeout: 5_000,
      maxHeaderSize: 8_192,
      headersTimeout: 5_000,
      requestTimeout: 10_000,
      keepAliveTimeout: 1_000,
    },
    (request, reply) => {
      const address = request.socket.remoteAddress ?? "unknown";
      if (!available()) return error(reply, "disabled");
      if (!allowedRate(address)) return error(reply, "rate-limited");
      if (request.method !== "POST" || request.url !== "/room") return error(reply, "invalid-message", 404);
      // The trusted guest's own backend connects here; browsers cannot submit
      // cookie-bearing requests or use this as a cross-origin Engine endpoint.
      if (request.headers.origin !== undefined || request.headers["sec-fetch-site"] !== undefined) {
        return error(reply, "invalid-message", 403);
      }
      const authorization = request.headers.authorization;
      const session = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/u)?.[1] ?? null;
      if (authorization !== undefined && !session) return error(reply, "invalid-message", 400);
      if (
        request.headers["content-type"]?.split(";", 1)[0]?.trim() !== "application/json" ||
        (request.headers["content-encoding"] !== undefined && request.headers["content-encoding"] !== "identity")
      ) {
        return error(reply, "invalid-message", 400);
      }
      if (active.size >= MULTIPLAYER_PEER_SERVER_LIMITS.inFlight) return error(reply, "busy");
      const abort = new AbortController();
      active.add(abort);
      const cancel = () => abort.abort();
      const onClose = () => {
        if (!reply.writableFinished) cancel();
      };
      request.once("aborted", cancel);
      reply.once("close", onClose);
      // Body and handler are bounded independently. The room controller must
      // honor cancellation before committing a queued action or resolving a poll.
      let timer = setTimeout(cancel, 10_000);
      const cancelled = new Promise<never>((_resolve, reject) => {
        abort.signal.addEventListener("abort", () => reject(new Error("Multiplayer request was cancelled")), {
          once: true,
        });
      });
      void (async () => {
        try {
          const message = await Promise.race([receive(request, abort.signal), cancelled]);
          if (!available() || abort.signal.aborted) return error(reply, "disabled");
          clearTimeout(timer);
          timer = setTimeout(cancel, MULTIPLAYER_LIMITS.pollMs + 5_000);
          const output = await Promise.race([
            options.handle(message, { session, address, signal: abort.signal }),
            cancelled,
          ]);
          if (!available() || abort.signal.aborted) return error(reply, "disabled");
          const json = JSON.stringify(multiplayerPeerResponseSchema.parse(output));
          if (Buffer.byteLength(json) > MULTIPLAYER_LIMITS.snapshotBytes) return error(reply, "snapshot-too-large");
          reply.writeHead(200, {
            "content-type": "application/json",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          });
          reply.end(json);
        } catch {
          error(reply, available() ? "invalid-message" : "disabled");
        } finally {
          clearTimeout(timer);
          if (abort.signal.aborted) request.destroy();
          active.delete(abort);
          request.off("aborted", cancel);
          reply.off("close", onClose);
        }
      })();
    },
  );
  server.maxConnections = MULTIPLAYER_PEER_SERVER_LIMITS.sockets;
  server.maxHeadersCount = 32;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host ?? "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  if (!available()) {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error("Multiplayer is disabled");
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Multiplayer listener could not start");
  return {
    port: address.port,
    async close() {
      if (closed) return;
      closed = true;
      for (const controller of active) controller.abort();
      for (const socket of sockets) socket.destroy();
      addressBuckets.clear();
      await new Promise<void>((resolve, reject) => server.close((cause) => (cause ? reject(cause) : resolve())));
    },
  };
}
