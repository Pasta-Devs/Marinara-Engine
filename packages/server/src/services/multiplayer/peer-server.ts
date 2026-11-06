import { createServer } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isIPv4, isIPv6, type Socket } from "node:net";
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
  // A quarter of all sockets: each guest Engine holds about two (its poll and an
  // action), so several guests behind one router fit while one address cannot fill it.
  socketsPerAddress: 16,
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

/** Groups a socket by IPv4 address or IPv6 /64, the block one household or host usually holds. */
export function multiplayerPeerSocketKey(address = "") {
  const ip = address.split("%", 1)[0]!.toLowerCase();
  if (ip.startsWith("::ffff:") && isIPv4(ip.slice(7))) return ip.slice(7);
  if (!isIPv6(ip)) return ip;
  const [head = "", tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  // An embedded dotted IPv4 tail fills two groups.
  const zeros = tail === undefined ? 0 : 8 - left.length - right.length - (tail.includes(".") ? 1 : 0);
  const groups = [...left, ...Array<string>(zeros).fill("0"), ...right].slice(0, 4);
  return `${groups.map((group) => Number.parseInt(group, 16).toString(16)).join(":")}::/64`;
}

/** A room-only TLS listener. It never mounts Engine routes or forwards HTTP requests. */
export async function startMultiplayerPeerServer(options: PeerServerOptions) {
  if (!options.enabled()) throw new Error("Multiplayer is disabled");
  if (!options.tls.cert.length || !options.tls.key.length) throw new Error("Multiplayer requires TLS");
  const sockets = new Set<Duplex>();
  const socketsByAddress = new Map<string, number>();
  const active = new Map<AbortController, ServerResponse>();
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
    let bucket = addressBuckets.get(address);
    if (!bucket || bucket.until <= now) {
      if (!bucket && addressBuckets.size >= MULTIPLAYER_PEER_SERVER_LIMITS.addressBuckets) {
        addressBuckets.delete(addressBuckets.keys().next().value!);
      }
      bucket = { count: 0, until: now + MULTIPLAYER_PEER_SERVER_LIMITS.windowMs };
      addressBuckets.set(address, bucket);
    }
    // Check the caller's own budget first: requests it already refuses must not spend
    // the shared budget, or one flooding address could lock out every admitted guest.
    if (++bucket.count > MULTIPLAYER_PEER_SERVER_LIMITS.requestsPerAddress) return false;
    if (globalBucket.until <= now) globalBucket = { count: 0, until: now + MULTIPLAYER_PEER_SERVER_LIMITS.windowMs };
    return ++globalBucket.count <= MULTIPLAYER_PEER_SERVER_LIMITS.requestsGlobal;
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
      // Enforce the header and request deadlines every second (Node checks every 30 s by
      // default), so a socket that connects and sends nothing is closed in about 6 s.
      // A long poll is unaffected: its request is complete and the handler bounds it.
      connectionsCheckingInterval: 1_000,
    },
    (request, reply) => {
      const address = request.socket.remoteAddress ?? "unknown";
      if (!available()) return error(reply, "disabled");
      // Keyed like the socket share, so one IPv6 host cannot multiply its budget across its /64.
      if (!allowedRate(multiplayerPeerSocketKey(address))) return error(reply, "rate-limited");
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
      active.set(abort, reply);
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
          // While closing, close() lets the final answer flush before it ends the socket.
          if (abort.signal.aborted && !closed) request.destroy();
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
    // Without a per-address share, one address holding idle sockets could lock out every guest.
    const key = multiplayerPeerSocketKey((socket as Socket).remoteAddress);
    const count = (socketsByAddress.get(key) ?? 0) + 1;
    if (count > MULTIPLAYER_PEER_SERVER_LIMITS.socketsPerAddress) return socket.destroy();
    socketsByAddress.set(key, count);
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
      const left = (socketsByAddress.get(key) ?? 1) - 1;
      if (left > 0) socketsByAddress.set(key, left);
      else socketsByAddress.delete(key);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // No host binds "::" (IPv4 and IPv6) where IPv6 exists and falls back to "0.0.0.0", so
    // an IPv6 room address is reachable as well as an IPv4 one.
    server.listen({ port: options.port, host: options.host }, () => {
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
      const stopped = new Promise<void>((resolve, reject) =>
        server.close((cause) => (cause ? reject(cause) : resolve())),
      );
      // Answer every waiting poll or action before the sockets go, so admitted guests
      // learn the room closed instead of retrying a dead address as a network blip.
      const answered = [...active].map(([controller, reply]) => {
        error(reply, "disabled");
        controller.abort();
        return reply.writableFinished || reply.destroyed
          ? undefined
          : new Promise<void>((resolve) => {
              reply.once("finish", resolve);
              reply.once("close", resolve);
            });
      });
      let flushTimer: NodeJS.Timeout | undefined;
      await Promise.race([
        Promise.all(answered),
        new Promise<void>((resolve) => {
          flushTimer = setTimeout(resolve, 500);
        }),
      ]);
      clearTimeout(flushTimer);
      for (const socket of sockets) socket.destroy();
      addressBuckets.clear();
      await stopped;
    },
  };
}
