import assert from "node:assert/strict";
import { buildSwarmUiGenerationBody } from "../../packages/server/src/services/image/image-generation.js";
import { normalizeImageGenerationProfile } from "../../packages/shared/src/constants/image-generation-defaults.js";

const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const profile = normalizeImageGenerationProfile(
  {
    comfyui: {
      saveToBackend: true,
      loras: [
        { model: "", strength: 3 },
        { model: "character", strength: 0.6 },
        { model: "style", strength: -0.2 },
      ],
    },
  },
  "comfyui",
).profile;
assert.equal(normalizeImageGenerationProfile({}, "comfyui").profile.comfyui?.saveToBackend, false);
assert.equal(
  normalizeImageGenerationProfile({ comfyui: { saveToBackend: "true" } }, "comfyui").profile.comfyui?.saveToBackend,
  false,
);
assert.equal(
  normalizeImageGenerationProfile(JSON.parse(JSON.stringify(profile)), "comfyui").profile.comfyui?.saveToBackend,
  true,
);
assert.equal(buildSwarmUiGenerationBody({ prompt: "Default" }, "session").donotsave, true);
const body = buildSwarmUiGenerationBody(
  {
    prompt: "Configured",
    imageDefaults: profile,
    referenceImage: image,
    referenceImages: [image, `data:image/png;base64,${image}`],
  },
  "session",
);
assert.equal(body.donotsave, false);
assert.equal(body.loras, "character,style");
assert.equal(body.loraweights, "0.6,-0.2");
assert.equal(body.promptimages, [`data:image/png;base64,${image}`, `data:image/png;base64,${image}`].join("|"));
assert.equal(body.comfyworkflowraw, undefined);
const custom = buildSwarmUiGenerationBody(
  {
    prompt: "Custom",
    imageDefaults: profile,
    comfyWorkflow: '{"model":"%lora_01%","image":"%reference_image%"}',
    referenceImage: image,
  },
  "session",
);
assert.equal(custom.donotsave, false);
assert.equal(custom.promptimages, undefined, "custom workflows retain their existing placeholder contract");
assert.equal(custom.loras, undefined, "custom workflows must not apply LoRAs twice");
assert.equal(JSON.parse(custom.comfyworkflowraw as string).image, image);
console.info("SwarmUI native parameters preserve defaults, selected weights, references and custom workflows.");
