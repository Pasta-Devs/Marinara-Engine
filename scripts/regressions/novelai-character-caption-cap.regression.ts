// Guards the NovelAI request builder's caption cap: V5 carries up to 22 character captions,
// V4/V4.5 still stop at six. Kept separate from the Illustrator regression so neither file
// loads both the image-generation and agent-executor module graphs at once.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  buildNovelAiV4CharacterPromptPayload,
  generateImage,
} from "../../packages/server/src/services/image/image-generation.js";

const crowd = Array.from({ length: 25 }, (_, index) => `Colonist ${index + 1}`);
const crowdPrompts = crowd.map((name) => ({ name, prompt: `girl, ${name}` }));

// The NovelAI request builder honours the V5 cap instead of the old fixed six.
const sevenCaptions = crowdPrompts.slice(0, 7).map((entry, index) => ({
  ...entry,
  position: { x: (index + 1) / 8, y: 0.5 },
}));
assert.equal(
  buildNovelAiV4CharacterPromptPayload(sevenCaptions, "nai-diffusion-5-full").captions.length,
  7,
  "V5 payload carries all seven captions",
);
assert.equal(
  buildNovelAiV4CharacterPromptPayload(sevenCaptions, "nai-diffusion-4-5-full").captions.length,
  6,
  "V4.5 payload still stops at six",
);

assert.equal(
  buildNovelAiV4CharacterPromptPayload(crowdPrompts, "nai-diffusion-5-full").captions.length,
  22,
  "V5 retains exactly its full caption capacity",
);

console.log("NovelAI character caption cap regression passed");

for (const baseUrl of ["http://image.novelai.net", "http://image.novelai.net."]) {
  await assert.rejects(
    generateImage("novelai", baseUrl, "synthetic", "novelai", {
      prompt: "2girls, forest",
      model: "nai-diffusion-5-full",
      allowLocalUrls: true,
    }),
    /Native NovelAI image connections require HTTPS/,
    "native credentials cannot be sent over HTTP",
  );
}

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const requests: Array<Record<string, unknown>> = [];
const server = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  requests.push(JSON.parse(Buffer.concat(chunks).toString()));
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ b64_json: png }] }));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const result = await generateImage("novelai", "http://image.novelai.net", "synthetic", "novelai", {
    prompt: "2girls, forest",
    model: "nai-diffusion-5-full",
    allowLocalUrls: true,
    characterPrompts: [
      { name: "Aster", prompt: "girl, red hair, new dress", position: { x: 0.3, y: 0.5 } },
      { name: "Briar", prompt: "girl, blue hair", position: { x: 0.7, y: 0.5 } },
    ],
    fallback: {
      connectionId: "local",
      connectionName: "Local fixture",
      provider: "custom",
      source: "openai",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "",
      serviceHint: "openai",
      model: "dall-e-3",
      prompt: "Two characters in a forest",
    },
    onFallback: async () => {},
  });
  assert.equal(result.base64, png);
  assert.equal(requests.length, 1);
  const sentPrompt = String(requests[0]?.prompt);
  assert.match(sentPrompt, /Two characters in a forest/);
  assert.match(sentPrompt, /Aster: girl, red hair, new dress/);
  assert.match(sentPrompt, /Briar: girl, blue hair/);
  assert.equal(result.effectivePrompt, sentPrompt, "gallery metadata matches the prompt the fallback received");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
