// Presets: the artwork each preset shows, and when a preset's choices count as all made.
import assert from "node:assert/strict";
import { arePresetChoiceSelectionsComplete } from "../../../packages/client/src/lib/preset-choice-selection.js";
import {
  MARINARA_UNIVERSAL_PRESET_ARTWORK,
  resolvePresetArtwork,
} from "../../../packages/client/src/lib/preset-artwork.js";

assert.equal(
  resolvePresetArtwork({ name: "Marinara's Universal Preset", author: "Marinara" }),
  MARINARA_UNIVERSAL_PRESET_ARTWORK,
);
assert.equal(
  resolvePresetArtwork({
    name: "Marinara's Universal Preset",
    author: "Marinara",
    imagePath: "/api/prompts/images/file/custom.png",
  }),
  "/api/prompts/images/file/custom.png",
);
const choiceVariables = [
  {
    variableName: "optional_instruction",
    options: [{ value: "" }, { value: "Add the instruction" }],
    multiSelect: false,
  },
  {
    variableName: "boolean_toggle",
    options: [{ value: "Enabled" }],
    multiSelect: false,
  },
  {
    variableName: "tags",
    options: [{ value: "Action" }, { value: "Romance" }],
    multiSelect: true,
  },
] as const;
assert.equal(
  arePresetChoiceSelectionsComplete(choiceVariables, {
    optional_instruction: "",
    boolean_toggle: "",
    tags: [],
  }),
  true,
);
assert.equal(
  arePresetChoiceSelectionsComplete(choiceVariables, {
    optional_instruction: "not-an-option",
    boolean_toggle: "",
    tags: [],
  }),
  false,
);
