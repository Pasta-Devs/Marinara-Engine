import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { DEFAULT_COMFYUI_DEFAULTS } from "../../packages/shared/src/constants/image-generation-defaults.js";
import { generateImage } from "../../packages/server/src/services/image/image-generation.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const customHeaders = { "x-test-header": "test-value" };
type Seen = { url: string; authorization?: string; cookie?: string; custom?: string };
const downloads: Seen[] = [];
const elsewhere: Seen[] = [];
const sockets = new Set<Socket>();
let imageReference = "";

const record = (request: IncomingMessage, into: Seen[]) =>
  into.push({
    url: request.url!,
    authorization: request.headers.authorization,
    cookie: request.headers.cookie,
    custom: request.headers["x-test-header"] as string | undefined,
  });
const sendPng = (response: ServerResponse) => {
  response.setHeader("content-type", "image/png");
  response.end(png);
};
function webSocketText(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value));
  assert.ok(payload.length < 126, "fixture frames stay short");
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

// A SwarmUI behind an authenticating proxy: the saved-image route answers 401 without the auth headers.
const swarm = createServer((request, response) => {
  if (request.url === "/API/GetNewSession") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ session_id: "s1" }));
    return;
  }
  if (request.url!.startsWith("/View/")) {
    record(request, downloads);
    const authorized =
      request.headers.authorization === "Bearer fixture-key" &&
      request.headers.cookie === "swarm_token=fixture-key" &&
      request.headers["x-test-header"] === "test-value";
    if (request.url === "/View/local/raw/saved.png" && !authorized) {
      response.statusCode = 401;
      response.end("auth required");
      return;
    }
    return sendPng(response);
  }
  response.statusCode = 404;
  response.end();
});
swarm.on("upgrade", (request, socket) => {
  const accept = createHash("sha1")
    .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  sockets.add(socket);
  socket.once("close", () => sockets.delete(socket));
  // The first client frame is the generation body; answer with one image and close.
  socket.once("data", () => {
    socket.write(webSocketText({ image: imageReference, batch_index: "0" }));
    socket.write(webSocketText({ socket_intention: "close" }));
  });
});
// Another host the result URL could point at; it must never see the connection's credentials.
const other = createServer((request, response) => {
  record(request, elsewhere);
  sendPng(response);
});

const listen = (server: ReturnType<typeof createServer>) =>
  new Promise<number>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address === "object");
      resolve(address.port);
    }),
  );
const port = await listen(swarm);
const otherPort = await listen(other);
const generate = () =>
  generateImage("swarmui", `http://127.0.0.1:${port}`, "fixture-key", "swarmui", {
    prompt: "saved image download",
    imageDefaults: {
      version: 1,
      service: "comfyui",
      seed: 7,
      customHeaders,
      comfyui: { ...DEFAULT_COMFYUI_DEFAULTS, saveToBackend: true },
    },
  });

try {
  // Same origin as the backend: the saved image downloads with the API key, cookie and custom headers.
  imageReference = "View/local/raw/saved.png";
  const saved = await generate();
  assert.equal(saved.mimeType, "image/png");
  assert.equal(saved.base64, png.toString("base64"));
  assert.deepEqual(downloads.at(-1), {
    url: "/View/local/raw/saved.png",
    authorization: "Bearer fixture-key",
    cookie: "swarm_token=fixture-key",
    custom: "test-value",
  });

  // A different origin (the localhost alias of the same server) keeps the headerless result-URL policy.
  imageReference = `http://localhost:${port}/View/local/raw/alias.png`;
  const alias = await generate();
  assert.equal(alias.base64, png.toString("base64"));
  assert.deepEqual(
    downloads.at(-1),
    { url: "/View/local/raw/alias.png", authorization: undefined, cookie: undefined, custom: undefined },
    "no credentials or custom headers leave the backend's origin",
  );

  // A private host other than the backend stays refused, so it receives nothing.
  imageReference = `http://127.0.0.1:${otherPort}/View/local/raw/other.png`;
  await assert.rejects(generate(), /Refused to fetch .*private/);
  assert.equal(elsewhere.length, 0, "a foreign private host is never contacted");
} finally {
  for (const socket of sockets) socket.destroy();
  for (const server of [swarm, other]) {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}
console.info("SwarmUI saved images download with local auth headers only from the backend's own origin.");
