import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Socket } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// #9060: SwarmUI returns each image inline as a data: URL over its WebSocket, and the decode ran whole-subject
// regexps (`^data:…;base64,([\s\S]+)$` and a base64 shape test). V8's regexp interpreter recurses once per subject
// character when the pattern's compiled code is no longer available, which a long-lived server reaches, so a
// multi-megabyte image ended in "Maximum call stack size exceeded" while SwarmUI reported success. Every generation
// here runs in a child whose regexps stay interpreted, the state the report failed in; 4 MB is the smallest payload
// that recurses that far, and 2 MB passes, on this Node.
const IMAGE_MB = 4;
const GENERATIONS = 10;
const role = process.argv[2];

if (role === "--generations") {
  const { DEFAULT_COMFYUI_DEFAULTS } = await import("../../packages/shared/src/constants/image-generation-defaults.js");
  const { generateImage } = await import("../../packages/server/src/services/image/image-generation.js");

  // "QUJD" is "ABC": the payload is base64 of a run of bytes, so the decode has a real image to validate.
  const dataUrl = `data:image/png;base64,${"QUJD".repeat((IMAGE_MB * 1024 * 1024) / 4)}`;
  const sockets = new Set<Socket>();

  const swarm = createServer((request, response) => {
    if (request.url === "/API/GetNewSession") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ session_id: "s1" }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  swarm.on("upgrade", (request, socket) => {
    const accept = createHash("sha1")
      .update(`${request.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    const frame = (value: unknown) => {
      const payload = Buffer.from(JSON.stringify(value));
      const length = Buffer.alloc(payload.length < 65536 ? 2 : 8);
      if (payload.length < 65536) length.writeUInt16BE(payload.length);
      else length.writeBigUInt64BE(BigInt(payload.length));
      return Buffer.concat([Buffer.from([0x81, payload.length < 65536 ? 126 : 127]), length, payload]);
    };
    socket.once("data", () => {
      socket.write(frame({ image: dataUrl, batch_index: "0" }));
      socket.write(frame({ socket_intention: "close" }));
    });
  });

  const port = await new Promise<number>((resolve) =>
    swarm.listen(0, "127.0.0.1", () => resolve((swarm.address() as { port: number }).port)),
  );

  try {
    for (let index = 0; index < GENERATIONS; index += 1) {
      const image = await generateImage("swarmui", `http://127.0.0.1:${port}`, "", "swarmui", {
        prompt: `large inline image ${index}`,
        imageDefaults: { version: 1, service: "comfyui", seed: 7, comfyui: { ...DEFAULT_COMFYUI_DEFAULTS } },
      });
      assert.equal(image.mimeType, "image/png", `generation ${index} kept its image type`);
      assert.equal(image.base64.length, IMAGE_MB * 1024 * 1024, `generation ${index} kept every byte`);
    }
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => swarm.close(() => resolve()));
  }

  // The chat-completions providers (OpenRouter, Gemini image, Ollama/proxies) return the finished image inline in the
  // reply's `content`, and the extractor ran the same class of whole-subject pattern over it.
  const chat = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ choices: [{ message: { role: "assistant", content: `Here you go: ${dataUrl}` } }] }),
      );
    });
  });
  const chatPort = await new Promise<number>((resolve) =>
    chat.listen(0, "127.0.0.1", () => resolve((chat.address() as { port: number }).port)),
  );
  try {
    const image = await generateImage("gemini_image", `http://127.0.0.1:${chatPort}`, "", "gemini_image", {
      prompt: "inline image from a chat-completions provider",
      allowLocalUrls: true,
    });
    assert.equal(image.mimeType, "image/png", "a chat-completions reply kept its image type");
    assert.equal(image.base64.length, IMAGE_MB * 1024 * 1024, "a chat-completions reply kept every byte");
  } finally {
    await new Promise<void>((resolve) => chat.close(() => resolve()));
  }
  console.info(
    `${GENERATIONS} SwarmUI generations and a chat-completions reply of ${IMAGE_MB} MB decoded without exhausting the stack.`,
  );
  process.exit(0);
}

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const child = spawn(
  process.execPath,
  [
    // Keep every regexp interpreted: the state V8 leaves a pattern in once it stops tiering it up.
    "--no-regexp-optimization",
    "--import",
    pathToFileURL(serverRequire.resolve("tsx")).href,
    fileURLToPath(import.meta.url),
    "--generations",
  ],
  { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."), stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.stderr.on("data", (chunk) => (output += chunk));
const exitCode = await new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
assert.equal(exitCode, 0, `a large inline SwarmUI image must decode\n${output.slice(-4000)}`);
