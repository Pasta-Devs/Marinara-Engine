/**
 * Valen-Decision's full release, served on loopback as a System One endpoint.
 *
 * Marinara starts this with its own Node and stops it by ending the process, which is
 * what frees the model's memory. It loads the ONNX package Marinara downloaded (pinned
 * by revision and checked file by file) through Valen's own SDK, the published path
 * that reads text, images and video without PyTorch. Video frames are decoded by the
 * pinned FFmpeg build Marinara installed beside it.
 *
 * Arguments: --model <dir> --port <n> [--variant q8-mlp] [--threads <n>]
 *            [--ffmpeg <path>] [--ffprobe <path>] [--frames <n>]
 *
 * Only loopback, only `GET /health` and `POST /v1/systemone`. Media arrive inline as
 * data URLs; a path or a web address in a request is refused, so a request can never
 * make this process read a file or reach the network.
 */
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Valen } from "@valen-team/sdk";

const MAX_BODY_BYTES = 100 * 1024 * 1024;

function readArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key?.startsWith("--")) throw new Error(`Unexpected argument ${key}`);
    out[key.slice(2)] = argv[index + 1];
  }
  return out;
}

const args = readArgs(process.argv.slice(2));
if (!args.model || !args.port) {
  console.error("valen-onnx-server: --model and --port are required");
  process.exit(2);
}
const threads = Number(args.threads) > 0 ? Math.floor(Number(args.threads)) : undefined;
const frames = Number(args.frames) > 0 ? Math.floor(Number(args.frames)) : 4;

const client = await Valen.local(args.model, {
  variant: args.variant || "q8-mlp",
  localFilesOnly: true,
  ...(threads ? { numThreads: threads } : {}),
  ...(args.ffmpeg ? { ffmpegPath: args.ffmpeg } : {}),
  ...(args.ffprobe ? { ffprobePath: args.ffprobe } : {}),
  // Evenly spaced frames per clip, not a rate: a 15-second clip and a 3-second one cost the same.
  mediaKwargs: { videos_kwargs: { num_frames: frames, fps: null } },
});

/**
 * Inline media only. Anything else would let a request choose a file or a host.
 *
 * Images are written to a private temporary folder for the request, because the SDK's
 * image reader in Node opens files rather than data URLs. Videos stay inline; the SDK
 * writes them out for FFmpeg itself. Returns the folder to remove afterwards.
 */
async function materializeMedia(state) {
  if (!state || typeof state !== "object" || !Array.isArray(state.messages)) return null;
  let folder = null;
  let count = 0;
  try {
    return await writeMedia();
  } catch (error) {
    // A later part refused, or a write failed: the pictures already decoded go too.
    if (folder) await rm(folder, { recursive: true, force: true });
    throw error;
  }

  async function writeMedia() {
    for (const message of state.messages) {
      if (!Array.isArray(message?.content)) continue;
      for (const part of message.content) {
        if (part?.type === "video_url") {
          const url = part.video_url?.url;
          if (typeof url !== "string" || !url.startsWith("data:video/"))
            throw new RangeError("Videos must be inline data URLs");
          continue;
        }
        if (part?.type !== "image_url") continue;
        const url = part.image_url?.url;
        const match = typeof url === "string" ? /^data:image\/(png|jpeg|webp|gif);base64,/u.exec(url) : null;
        if (!match) throw new RangeError("Images must be inline PNG, JPEG, WebP or GIF data URLs");
        folder ??= await mkdtemp(join(tmpdir(), "marinara-valen-"));
        const file = join(folder, `image-${count++}.${match[1] === "jpeg" ? "jpg" : match[1]}`);
        await writeFile(file, Buffer.from(url.slice(match[0].length), "base64"));
        part.image_url = { url: file };
      }
    }
    return folder;
  }
}

/**
 * Valen's SDK wants every option described. Marinara sends an empty description for an
 * option its author left plain, so the option's own name stands in for it.
 */
function describeOptions(questions) {
  for (const question of Object.values(questions)) {
    if (question?.type !== "choice" || !question.criteria || typeof question.criteria !== "object") continue;
    if (Array.isArray(question.criteria)) continue;
    for (const [name, description] of Object.entries(question.criteria))
      if (typeof description !== "string" || !description.trim()) question.criteria[name] = name;
  }
  return questions;
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new RangeError("Request too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok" });
    if (req.method !== "POST" || req.url !== "/v1/systemone") return send(res, 404, { error: "Not found" });
    const body = JSON.parse(await readBody(req));
    if (!body || typeof body !== "object" || !body.questions || typeof body.questions !== "object")
      return send(res, 400, { error: "questions is required" });
    // Valen reads a state that is text or a chat-message list. Marinara's ordinary state
    // is an object, so it goes as its JSON text, as Valen's GGUF server is sent it too.
    const state =
      typeof body.state === "string" || Array.isArray(body.state?.messages)
        ? body.state
        : JSON.stringify(body.state ?? null);
    const folder = await materializeMedia(state);
    try {
      const result = await client.systemOne(state, describeOptions(body.questions));
      send(res, 200, result);
    } finally {
      if (folder) await rm(folder, { recursive: true, force: true });
    }
  } catch (error) {
    const status =
      error instanceof SyntaxError || error instanceof RangeError || error?.name === "ValenInputError" ? 400 : 500;
    // Bounded, and with any data URL cut out: an error that quotes its input would
    // otherwise echo megabytes of a picture back into the log.
    const message = (error instanceof Error ? error.message : "Decision request failed")
      .replace(/data:[^"'\s]{40,}/gu, "data:…")
      .slice(0, 500);
    send(res, status, { error: message });
  }
});

const stop = async () => {
  server.close();
  await client.close().catch(() => undefined);
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

server.listen(Number(args.port), "127.0.0.1", () => {
  console.log(`valen-onnx-server listening on 127.0.0.1:${args.port}`);
});
