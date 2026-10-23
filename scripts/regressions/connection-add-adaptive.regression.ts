import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isAddService,
  jobsForAddedKinds,
  missingAddJobs,
} from "../../packages/client/src/lib/connection-add-adaptive.js";

const read = (name: string) => readFileSync(new URL(`../../packages/client/src/${name}`, import.meta.url), "utf8");
const list = read("components/modals/create-connection/ServiceListStep.tsx");
const data = read("components/modals/create-connection/useServiceListData.ts");
const modal = read("components/modals/create-connection/CreateConnectionModalContent.tsx");
const english = JSON.parse(read("localization/locales/en.json"));

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

assert(!list.includes("data-add-connection-question"), "the old question-card entry must be gone");
assert(!list.includes("<ServiceCard"));
for (const component of ["ServiceRow", "ModelRow", "ListSearch", "ListHeading"]) assert(list.includes(`<${component}`));
for (const section of ["missing-jobs", "your-services", "new-service"]) assert(list.includes(`section="${section}"`));
assert.match(list, /data-add-connection-account=[\s\S]*?showModelsOf\(account.id\)/);
assert.match(data, /isAddService\(key\)/);
assert.match(data, /missingAddJobs\(props.rows, props.featureModels, props.embeddingId\)/);
assert.match(modal, /assignment.assign[\s\S]*?assign\(id\)[\s\S]*?assign\(previous\)/);
assert.match(modal, /for \(const key of jobs\) await assignJob\(\{ job: key \}\)/);
assert.match(modal, /applyChoices\(!choosingJobs\)/, "Skip must not implicitly set Main");
assert.match(modal, /!jobFor && !modelsFor && !onStartChat/, "prefilled jobs retain direct assign-on-Done");
assert.match(modal, /t\("connections\.add\.heading\.forJob", \{ job: jobLabel\(job\) \}\)/);
assert.match(modal, /const totalSteps = job \? 2 : 3/);
for (const key of [
  "connections.add.useFor.heading",
  "connections.add.useFor.skip",
  "connections.add.setUp",
  "connections.add.section.yourServices",
])
  assert.equal(typeof english[key], "string");
console.log("connection-add-adaptive regression passed");
