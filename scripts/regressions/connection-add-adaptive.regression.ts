import assert from "node:assert/strict";
import {
  isAddService,
  jobsForAddedKinds,
  missingAddJobs,
} from "../../packages/client/src/lib/connection-add-adaptive.js";


assert.deepEqual(jobsForAddedKinds(["image"]), ["images"]);
assert.deepEqual(jobsForAddedKinds(["voice"]), ["voice"]);
assert.deepEqual(jobsForAddedKinds(["decision"]), ["decision"]);
assert.deepEqual(jobsForAddedKinds([]), []);
assert(jobsForAddedKinds(["chat", "image"]).includes("main"));
assert(jobsForAddedKinds(["chat", "image"]).includes("images"));
assert(!jobsForAddedKinds(["chat"]).includes("voice"));
assert(!jobsForAddedKinds(["chat"]).includes("images"));

for (const container of ["audio", "decision", "image_generation", "video_generation"]) assert(!isAddService(container));
for (const service of ["audio:elevenlabs", "audio:pockettts", "openai", "xai", "nanogpt", "media:comfyui"])
  assert(isAddService(service));

const missing = missingAddJobs(
  [
    { provider: "openai", isDefault: "true", defaultForAgents: true },
    { provider: "image_generation", defaultForAgents: true },
  ],
  { mariConnectionId: "mari", visionConnectionId: "vision" },
  "embedding",
);
assert(!missing.includes("main"));
assert(!missing.includes("agents"));
assert(!missing.includes("images"));
assert(!missing.includes("mari"));
assert(!missing.includes("vision"));
assert(!missing.includes("embeddings"));
assert(missing.includes("voice"), "a chat Agents flag does not fill Voice");
assert(missing.includes("video"), "an image flag does not fill Video");
assert(missing.includes("decision"));
assert(missingAddJobs([], undefined).includes("embeddings"));
assert.deepEqual(missingAddJobs([{ provider: "image_generation" }], undefined), [
  "main",
  "agents",
  "mari",
  "images",
  "video",
  "voice",
  "decision",
  "embeddings",
  "vision",
]);

console.log("connection-add-adaptive regression passed");
