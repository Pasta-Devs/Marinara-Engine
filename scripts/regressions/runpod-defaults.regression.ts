import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  IMAGE_DEFAULTS_STORAGE_KEY,
  createDefaultImageGenerationProfile,
  imageSourceToDefaultsService,
} from "../../packages/shared/src/index.js";
import { resolveConnectionImageDefaults } from "../../packages/server/src/services/image/image-generation-defaults.js";
import { generateRunPodComfyUI } from "../../packages/server/src/services/image/runpod-comfyui.service.js";

assert.equal(imageSourceToDefaultsService("runpod_comfyui"), "comfyui");
assert.equal(imageSourceToDefaultsService("swarmui"), "comfyui");
assert.equal(imageSourceToDefaultsService("openai"), null);
const defaults = createDefaultImageGenerationProfile("comfyui");
defaults.seed = 42;
Object.assign(defaults.comfyui!, {
  steps: 17,
  cfgScale: 4.5,
  sampler: "euler",
  scheduler: "karras",
  denoisingStrength: 0.75,
  clipSkip: 2,
  promptPrefix: "Style",
  negativePromptPrefix: "Blur",
  uploadPlaceholderOnMissingReference: true,
  loras: [{ model: 'models/quoted"$&.safetensors', strength: 0.8 }],
});
const savedDefaults = resolveConnectionImageDefaults({
  provider: "image_generation",
  imageGenerationSource: "runpod_comfyui",
  defaultParameters: JSON.stringify({ [IMAGE_DEFAULTS_STORAGE_KEY]: defaults }),
});
assert.deepEqual(savedDefaults, defaults, "RunPod keeps the saved ComfyUI defaults");
let workflow: Record<string, string> | undefined;
let uploads: Array<{ name: string; image: string }> = [];
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XxY4WQAAAABJRU5ErkJggg==";
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.method === "POST") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const { input } = JSON.parse(Buffer.concat(chunks).toString());
    workflow = input.workflow;
    uploads = input.images ?? [];
    res.end(JSON.stringify({ id: "fixture-job" }));
  } else {
    res.end(JSON.stringify({ status: "COMPLETED", output: { images: [{ data: png }] } }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
process.env.RUNPOD_POLL_INTERVAL_MS = "1";
try {
  await generateRunPodComfyUI(`http://127.0.0.1:${address.port}/v2`, "endpoint", "fixture-key", {
    prompt: "a garden",
    negativePrompt: "noise",
    imageDefaults: savedDefaults,
    allowLocalUrls: true,
    comfyWorkflow: JSON.stringify({
      prompt: "%prompt%",
      negative: "%negative_prompt%",
      steps: "%steps%",
      cfg: "%cfg%",
      seed: "%seed%",
      sampler: "%sampler%",
      scheduler: "%scheduler%",
      denoise: "%denoise%",
      clip: "%clip_skip%",
      lora: "%LORA_1%",
      strength: "%LORA_1_strength%",
      emptyLora: "%LORA_5%",
      reference: "%reference_image%",
      referenceName: "%reference_image_name%",
      referenceNameAlias: "%reference_image_name_01%",
      missingReference: "%reference_image_name_04%",
    }),
  });
  assert.ok(workflow);
  assert.match(workflow.prompt!, /Style.*a garden/);
  assert.match(workflow.negative!, /Blur.*noise/);
  for (const [field, value] of Object.entries({
    steps: "17",
    cfg: "4.5",
    seed: "42",
    sampler: "euler",
    scheduler: "karras",
    denoise: "0.75",
    clip: "2",
    lora: 'models/quoted"$&.safetensors',
    strength: "0.8",
    emptyLora: "",
  })) {
    assert.equal(workflow[field], value, field);
  }
  assert.ok(workflow.reference && !workflow.reference.includes("%"), "missing references use the enabled placeholder");
  assert.equal(uploads.length, 2, "only the requested filename slots are uploaded");
  assert.equal(workflow.referenceName, workflow.referenceNameAlias);
  assert.equal(uploads[0]!.name, workflow.referenceName);
  assert.equal(uploads[0]!.image, workflow.reference);
  assert.equal(uploads[1]!.name, workflow.missingReference);
  const previousWorkflow = workflow;
  await assert.rejects(
    generateRunPodComfyUI(`http://127.0.0.1:${address.port}/v2`, "endpoint", "fixture-key", {
      prompt: "",
      allowLocalUrls: true,
      comfyWorkflow: JSON.stringify({ prompt: "a".repeat(10 * 1024 * 1024) }),
    }),
    /10 MiB request limit.*smaller reference images/,
  );
  assert.equal(workflow, previousWorkflow, "oversized requests never reach the endpoint");
  console.info("RunPod saved defaults, escaped LoRA values, and references reach the submitted workflow.");
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
