// Text fields in editors: the expanded macro editor initialises and focuses only when it opens, and the Assistant
// Prefill placeholder shows a literal <thinking> without an indent. Reads component source; replacing these needs
// browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const macroTextareaSource = readFileSync(
  new URL("../../../packages/client/src/components/ui/MacroTextarea.tsx", import.meta.url),
  "utf8",
);
assert.match(
  macroTextareaSource,
  /const valueRef = useRef\(value\);[\s\S]{0,500}\}, \[open\]\);/u,
  "Expanded macro editors must only initialize and focus when opened, not after every parent value update",
);
const generationParametersEditorSource = readFileSync(
  new URL("../../../packages/client/src/components/ui/GenerationParametersEditor.tsx", import.meta.url),
  "utf8",
);
assert.match(
  generationParametersEditorSource,
  /placeholder=\{localizeUi\("ui\.ui\.generationparametersfields\.thinking", \{\s*value1: "<",\s*value2: ">",\s*\}\)\.trimStart\(\)\}/u,
  "Assistant Prefill must render literal angle brackets without unbalanced localization markup",
);
assert.match(generationParametersEditorSource, /placeholder:\[text-indent:0\]/u);
