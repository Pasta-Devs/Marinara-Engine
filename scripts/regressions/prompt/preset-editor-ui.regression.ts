// The preset editor: it opens at the requested tab, the Presets panel opens presets at Overview, and a single-option
// variable renders as an accessible switch. Reads component source; replacing these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guidedPresetEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/presets/PresetEditor.tsx", import.meta.url),
  "utf8",
);
const presetPanelSource = readFileSync(
  new URL("../../../packages/client/src/components/panels/PresetsPanel.tsx", import.meta.url),
  "utf8",
);
assert.match(
  guidedPresetEditorSource,
  /presetDetailInitialTab[\s\S]{0,260}setActiveTab\(presetDetailInitialTab \?\? "overview"\)/u,
  "PresetEditor must consume the requested initial tab and retain Overview by default",
);
assert.match(
  presetPanelSource,
  /openPresetDetail\(preset\.id\)/u,
  "Ordinary preset-panel navigation must continue using the default Overview tab",
);
// The modal renders each variable's options through the shared ChoiceOptionsField.
const choiceSelectionModalSource =
  readFileSync(
    new URL("../../../packages/client/src/components/presets/ChoiceSelectionModal.tsx", import.meta.url),
    "utf8",
  ) +
  readFileSync(
    new URL("../../../packages/client/src/components/presets/ChoiceOptionsField.tsx", import.meta.url),
    "utf8",
  );
assert.match(
  choiceSelectionModalSource,
  /presentedOptions\.length === 1[\s\S]*<SettingsSwitch[\s\S]*labelPosition="start"/u,
  "Single-option preset variables must use the standard accessible settings switch",
);

// #4237-#4240: the preset editor's agent section choices line up with its other add-section choices.
{
  const presetEditorSource = readFileSync(
    new URL("../../../packages/client/src/components/presets/PresetEditor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    presetEditorSource,
    /injectableAgents\.map[\s\S]{0,700}justify-start[\s\S]{0,120}text-left/u,
    "Agent section choices must align with the preset editor's other add-section choices",
  );
}
