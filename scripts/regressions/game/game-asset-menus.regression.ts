// The game asset browser's menus render in a portal and stay inside the viewport. Reads component source until a test
// can open them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameAssetBrowserSource = readFileSync(
  new URL("../../../packages/client/src/components/game-assets/GameAssetsBrowserView.tsx", import.meta.url),
  "utf8",
);
const gameAssetActionDropdownSource = readFileSync(
  new URL("../../../packages/client/src/components/game-assets/ActionDropdown.tsx", import.meta.url),
  "utf8",
);
assert.match(gameAssetBrowserSource, /createPortal/u);
assert.match(gameAssetActionDropdownSource, /createPortal/u);
assert.match(gameAssetActionDropdownSource, /window\.innerWidth - rect\.width/u);
