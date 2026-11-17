// ComfyUI workflow inputs: numbered reference-image placeholders, the placeholder reference image, and LoRA slots.
import assert from "node:assert/strict";
import {
  buildComfyUiLoraWorkflowReplacements,
  COMFYUI_PLACEHOLDER_REFERENCE_BASE64,
  normalizeComfyUiLoraSettings,
} from "../../../packages/shared/src/constants/image-generation-defaults.js";
import {
  findMissingComfyReferenceSlots,
  numberedComfyReferencePlaceholder,
} from "../../../packages/server/src/services/image/comfyui-reference-placeholders.js";

const comfyReferenceWorkflow = JSON.stringify({
  first: "%reference_image_01%",
  second: "%reference_image_02%",
  thirdName: "%reference_image_name_03%",
  outsideSupportedRange: "%reference_image_05%",
});
assert.deepEqual(findMissingComfyReferenceSlots(comfyReferenceWorkflow, "reference_image", 1), [1]);
assert.deepEqual(findMissingComfyReferenceSlots(comfyReferenceWorkflow, "reference_image_name", 1), [2]);
assert.equal(numberedComfyReferencePlaceholder("reference_image_name", 2), "%reference_image_name_03%");
const comfyPlaceholderPng = Buffer.from(COMFYUI_PLACEHOLDER_REFERENCE_BASE64, "base64");
assert.equal(comfyPlaceholderPng.toString("ascii", 1, 4), "PNG");
assert.equal(comfyPlaceholderPng.readUInt32BE(16), 16);
assert.equal(comfyPlaceholderPng.readUInt32BE(20), 16);
// Issues #4118 and #5072 — ComfyUI exposes up to five LoRAs consistently to
// image and video API-format workflows without clipping slider LoRA strengths
// to the legacy -2..2 range.
{
  const normalizedBounds = normalizeComfyUiLoraSettings([
    { model: "upper-endpoint.safetensors", strength: 100 },
    { model: "lower-endpoint.safetensors", strength: -100 },
    { model: "above-range.safetensors", strength: 101 },
    { model: "below-range.safetensors", strength: -101 },
  ]);
  assert.deepEqual(
    normalizedBounds.map(({ strength }) => strength),
    [100, -100, 100, -100],
  );

  const normalized = normalizeComfyUiLoraSettings([
    { model: "style-a.safetensors", strength: 1.25 },
    { model: "style-b.safetensors", strength: 99 },
    { model: "style-c.safetensors", strength: -99 },
    { model: "style-d.safetensors", strength: 0.5 },
    { model: "style-e.safetensors", strength: 1 },
    { model: "ignored.safetensors", strength: 1 },
  ]);
  assert.equal(normalized.length, 5);
  assert.equal(normalized[0]?.strength, 1.25);
  assert.equal(normalized[1]?.strength, 99);
  assert.equal(normalized[2]?.strength, -99);
  assert.deepEqual(buildComfyUiLoraWorkflowReplacements(normalized), {
    "%LORA_1%": "style-a.safetensors",
    "%LORA_1_strength%": 1.25,
    "%LORA_2%": "style-b.safetensors",
    "%LORA_2_strength%": 99,
    "%LORA_3%": "style-c.safetensors",
    "%LORA_3_strength%": -99,
    "%LORA_4%": "style-d.safetensors",
    "%LORA_4_strength%": 0.5,
    "%LORA_5%": "style-e.safetensors",
    "%LORA_5_strength%": 1,
  });
}
