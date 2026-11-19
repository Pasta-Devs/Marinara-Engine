// The New Game wizard: adjusting Game Assets for this game, the Agents choice, exporting the setup file, and the World
// Maps place target and grounding mode through setup, import and draft generation. Reads component source; replacing
// these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSurfaceSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const gameSetupWizardSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameSetupWizard.tsx", import.meta.url),
  "utf8",
);
assert.match(gameSetupWizardSource, /ui\.game\.gamesetupwizard\.adjustGameAssetsForThisGame/u);
assert.match(gameSetupWizardSource, /selectFoldersByDefault/u);
assert.match(gameSetupWizardSource, /enableAgents: enableAgents \|\| undefined/u);
assert.match(
  gameSetupWizardSource,
  /handleExportSetup[\s\S]{0,700}buildGameSetupShareFile/u,
  "New Game's final setup step must export the same reusable setup format before starting",
);
assert.match(
  gameSetupWizardSource,
  /id="game-setup-spatial-map-target-count"[\s\S]{0,180}min=\{1\}[\s\S]{0,120}max=\{SPATIAL_CUSTOM_TARGET_LOCATION_LIMIT\}/u,
  "New Game AI map setup must expose the bounded custom place target from World Maps",
);
assert.match(
  gameSetupWizardSource,
  /targetLocationCount:\s*spatialMapTargetLocationCount/u,
  "New Game setup must preserve the selected custom place target in its post-setup map plan",
);
assert.match(
  gameSetupWizardSource,
  /setSpatialMapTargetLocationCount\(importedSpatialMapDraftOptions\.targetLocationCount\)/u,
  "New Game setup imports must restore the saved World Maps place target",
);
assert.match(
  gameSetupWizardSource,
  /setSpatialMapGroundingMode\(config\.spatialMapGroundingMode \?\? "setup"\)/u,
  "New Game setup imports must restore the saved World Maps grounding mode",
);
assert.match(
  gameSurfaceSource,
  /targetLocationCount:\s*plan\.targetLocationCount/u,
  "Game setup must send the custom place target to World Maps draft generation",
);
