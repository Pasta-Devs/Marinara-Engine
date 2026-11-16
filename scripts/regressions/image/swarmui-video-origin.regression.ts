import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  generateVideo,
  buildSwarmUiVideoGenerationBody,
  parseSwarmUiVideoReference,
} from "../../../packages/server/src/services/video/video-generation.js";

const mp4 = Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex");
const received: Array<{ url: string; cookie?: string }> = [];
const foreignCookies: Array<string | undefined> = [];
let output = "output.mp4";
const foreign = createServer((request, response) => {
  foreignCookies.push(request.headers.cookie);
  response.end(mp4);
});
await new Promise<void>((resolve) => foreign.listen(0, "127.0.0.1", resolve));
const foreignAddress = foreign.address();
assert.ok(foreignAddress && typeof foreignAddress === "object");
const foreignUrl = `http://127.0.0.1:${foreignAddress.port}/output.mp4`;
const server = createServer(async (request, response) => {
  for await (const _chunk of request) {
    /* Drain the request before replying. */
  }
  received.push({ url: request.url!, cookie: request.headers.cookie });
  if (request.url === "/API/GetNewSession") response.end(JSON.stringify({ session_id: "session" }));
  else if (request.url === "/API/GenerateText2Image") response.end(JSON.stringify({ images: [output] }));
  else if (request.url === "/redirect.mp4") {
    response.writeHead(302, { location: foreignUrl });
    response.end();
  } else response.end(mp4);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const run = () =>
    generateVideo("swarmui", base, "fixture-token", "swarmui", {
      prompt: "A wave",
      durationSeconds: 4,
      aspectRatio: "16:9",
      comfyWorkflow: "{}",
    });
  assert.equal((await run()).base64, mp4.toString("base64"));
  assert.equal(received.at(-1)?.cookie, "swarm_token=fixture-token");
  output = `${base}/output.mp4`;
  assert.equal((await run()).base64, mp4.toString("base64"));
  output = `data:video/mp4;base64,${mp4.toString("base64")}`;
  assert.equal((await run()).base64, mp4.toString("base64"));
  output = foreignUrl;
  await assert.rejects(run(), /outside the configured server/);
  assert.equal(foreignCookies.length, 0, "An untrusted output must not receive the Swarm cookie");
  output = "redirect.mp4";
  assert.equal((await run()).base64, mp4.toString("base64"));
  assert.deepEqual(foreignCookies, [undefined], "Existing safeFetch strips cookies across redirects");
} finally {
  await Promise.all(
    [server, foreign].map(
      (listener) =>
        new Promise<void>((resolve, reject) => {
          listener.close((error) => (error ? reject(error) : resolve()));
          listener.closeAllConnections();
        }),
    ),
  );
}

const swarmUiVideoBody = buildSwarmUiVideoGenerationBody(
  {
    prompt: "a blue fox waves",
    durationSeconds: 5,
    aspectRatio: "9:16",
    resolution: "720p",
    model: "wan-video.safetensors",
    referenceImage: { base64: "data:image/png;base64,cG5n", mimeType: "image/png" },
    comfyWorkflow: JSON.stringify({
      "1": {
        class_type: "VideoNode",
        inputs: {
          prompt: "%prompt%",
          width: "%width%",
          height: "%height%",
          frames: "%length%",
          fps: "%fps%",
          image: "%reference_image%",
        },
      },
    }),
    fps: 16,
  },
  "video-session",
  42,
);
assert.equal(swarmUiVideoBody.session_id, "video-session");
assert.equal(swarmUiVideoBody.width, 720);
assert.equal(swarmUiVideoBody.height, 1280);
assert.deepEqual(JSON.parse(String(swarmUiVideoBody.comfyworkflowraw)), {
  "1": {
    class_type: "VideoNode",
    inputs: {
      prompt: "a blue fox waves",
      width: 720,
      height: 1280,
      frames: 80,
      fps: 16,
      image: "cG5n",
    },
  },
});
assert.equal(parseSwarmUiVideoReference({ images: ["View/local/raw/output.mp4"] }), "View/local/raw/output.mp4");
assert.throws(
  () =>
    buildSwarmUiVideoGenerationBody(
      {
        prompt: "video",
        durationSeconds: 5,
        aspectRatio: "16:9",
        comfyWorkflow: '{"image":"%reference_image_name%"}',
      },
      "video-session",
    ),
  /must use %reference_image%/u,
);

console.info("SwarmUI video origin regression passed.");
