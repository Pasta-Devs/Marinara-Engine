import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";

const previousImageTimeout = process.env.IMAGE_GEN_TIMEOUT_MS;
const previousComfyTimeout = process.env.COMFYUI_GEN_TIMEOUT;
process.env.IMAGE_GEN_TIMEOUT_MS = "80";
process.env.COMFYUI_GEN_TIMEOUT = "5";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let httpGenerationRequests = 0;
let webSocketPath = "";
let webSocketCookie = "";
let generationBody: Record<string, unknown> | null = null;
const upgradedSockets = new Set<Socket>();

function encodeWebSocketText(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value));
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function readClientFrame(buffer: Buffer): { payload: string | null; consumed: number } | null {
  if (buffer.length < 2) return null;
  const opcode = buffer[0]! & 0x0f;
  let payloadLength = buffer[1]! & 0x7f;
  let cursor = 2;
  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    cursor = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    const length = buffer.readBigUInt64BE(2);
    if (length > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Regression WebSocket frame is too large");
    payloadLength = Number(length);
    cursor = 10;
  }
  const masked = (buffer[1]! & 0x80) !== 0;
  const maskLength = masked ? 4 : 0;
  if (buffer.length < cursor + maskLength + payloadLength) return null;
  const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
  cursor += maskLength;
  const payload = Buffer.from(buffer.subarray(cursor, cursor + payloadLength));
  if (mask) {
    for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4]!;
  }
  return { payload: opcode === 0x1 ? payload.toString("utf8") : null, consumed: cursor + payloadLength };
}

const server = createServer((request, response) => {
  if (request.url === "/API/GetNewSession") {
    response.setHeader("Content-Type", "application/json");
    // Local backend requests must use the selected ComfyUI/SwarmUI transport timeout too.
    const timer = setTimeout(() => response.end(JSON.stringify({ session_id: "regression-session" })), 2000);
    response.once("close", () => clearTimeout(timer));
    return;
  }
  if (request.url === "/API/GenerateText2Image") {
    httpGenerationRequests += 1;
    response.statusCode = 500;
    response.end("The streaming endpoint must be used");
    return;
  }
  if (request.url === "/View/generated.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(png);
    return;
  }
  response.statusCode = 404;
  response.end();
});

server.on("upgrade", (request, socket, head) => {
  webSocketPath = request.url ?? "";
  webSocketCookie = request.headers.cookie ?? "";
  const key = request.headers["sec-websocket-key"];
  assert.equal(typeof key, "string");
  const accept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  upgradedSockets.add(socket);
  socket.once("close", () => upgradedSockets.delete(socket));

  let buffered = Buffer.from(head);
  let generationStarted = false;
  const consume = (chunk?: Buffer) => {
    if (chunk) buffered = Buffer.concat([buffered, chunk]);
    while (!generationStarted) {
      const frame = readClientFrame(buffered);
      if (!frame) return;
      buffered = buffered.subarray(frame.consumed);
      if (frame.payload === null) continue;
      generationStarted = true;
      generationBody = JSON.parse(frame.payload) as Record<string, unknown>;
      setTimeout(() => socket.write(encodeWebSocketText({ gen_progress: { overall_percent: 0.5 } })), 60);
      setTimeout(() => socket.write(encodeWebSocketText({ image: "View/generated.png", batch_index: "0" })), 120);
      setTimeout(() => socket.write(encodeWebSocketText({ socket_intention: "close" })), 130);
    }
  };
  consume();
  socket.on("data", consume);
});

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { generateImage, resolveComfyUiImageGenerationTimeoutMs } =
    await import("../../packages/server/src/services/image/image-generation.js");

  assert.equal(
    resolveComfyUiImageGenerationTimeoutMs(1_800_000, 2400),
    2_400_000,
    "SwarmUI and ComfyUI share the longer configured image-generation deadline",
  );
  const result = await generateImage("swarmui", `http://127.0.0.1:${address.port}`, "regression-token", "swarmui", {
    prompt: "timeout regression",
  });
  assert.equal(result.mimeType, "image/png");
  assert.equal(result.base64, png.toString("base64"));
  assert.equal(httpGenerationRequests, 0, "SwarmUI generation must not use the idle HTTP route");
  assert.equal(webSocketPath, "/API/GenerateText2ImageWS");
  assert.match(webSocketCookie, /(?:^|;\s*)swarm_token=regression-token(?:;|$)/u);
  assert.equal(generationBody?.session_id, "regression-session");
  assert.equal(generationBody?.prompt, "timeout regression");
} finally {
  for (const socket of upgradedSockets) socket.destroy();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (previousImageTimeout === undefined) delete process.env.IMAGE_GEN_TIMEOUT_MS;
  else process.env.IMAGE_GEN_TIMEOUT_MS = previousImageTimeout;
  if (previousComfyTimeout === undefined) delete process.env.COMFYUI_GEN_TIMEOUT;
  else process.env.COMFYUI_GEN_TIMEOUT = previousComfyTimeout;
}

console.info("SwarmUI timeout regression passed.");
