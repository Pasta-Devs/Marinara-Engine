// The ComfyUI Workflow check: placeholders found, reference slots, and picture loaders that still open a saved file.
import assert from "node:assert/strict";
import {
  checkComfyWorkflow,
  findComfyReferenceSlots,
} from "../../../packages/shared/src/utils/comfy-workflow-check.js";

{
  const workflow = JSON.stringify({
    "6": { class_type: "CLIPTextEncode", inputs: { text: "%prompt%" } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "%negative_prompt%" } },
    "5": { class_type: "EmptyLatentImage", inputs: { width: "%width%", height: "%height%" } },
    "3": { class_type: "KSampler", inputs: { seed: "%seed%" } },
    "10": { class_type: "LoadImage", inputs: { image: "%reference_image_name_01%" } },
    "11": { class_type: "LoadImage", inputs: { image: "%reference_image_name_02%" } },
    "12": { class_type: "LoadImage", inputs: { image: "ComfyUI_00042_.png" }, _meta: { title: "Third face" } },
    "13": { class_type: "ETN_LoadImageBase64", inputs: { image: "iVBORw0KGgo" } },
  });
  const check = checkComfyWorkflow(workflow);
  assert.equal(check.parsed, true);
  assert.equal(check.uiFormat, false);
  assert.equal(check.hasPrompt && check.hasNegativePrompt && check.hasSize && check.hasSeed, true);
  assert.deepEqual(check.referenceSlots, [1, 2]);
  // A base64 loader carries its own picture, so only the file loader is reported.
  assert.deepEqual(check.literalLoaders, [{ nodeId: "12", title: "Third face", file: "ComfyUI_00042_.png" }]);
}

// The bare placeholders are slot 1; numbers past the fourth are not slots.
assert.deepEqual(
  findComfyReferenceSlots('{"a":"%reference_image%","b":"%reference_image_03%","c":"%reference_image_05%"}'),
  [1, 3],
);

// A save from the editor ("nodes" array) is flagged, and its loaders are still read.
{
  const check = checkComfyWorkflow(
    JSON.stringify({ nodes: [{ id: 4, type: "LoadImage", widgets_values: ["old.png", "image"], title: "Ref" }] }),
  );
  assert.equal(check.uiFormat, true);
  assert.deepEqual(check.literalLoaders, [{ nodeId: "4", title: "Ref", file: "old.png" }]);
}

// Text that is not JSON reports why, and empty text is not an error.
assert.equal(checkComfyWorkflow("{nope").parsed, false);
assert.ok(checkComfyWorkflow("{nope").error);
assert.equal(checkComfyWorkflow("").error, null);

console.log("comfyui-workflow-check regression passed");
