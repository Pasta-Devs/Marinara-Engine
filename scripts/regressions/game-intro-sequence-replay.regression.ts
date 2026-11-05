/**
 * A game's blueprint intro sequence plays at its opening alone, and played directions never replay.
 * A Game screen first mounted after the player had spoken (a shared room's host switching back from
 * the Room view after a Continue story) played the intro again, which hid the game until Skip effects
 * was pressed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const surface = readFileSync(
  new URL("../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const intro = surface.slice(surface.indexOf("// Play blueprint intro sequence"));
assert.match(
  intro.slice(0, intro.indexOf("const applyGameAudioSettings")),
  /if \(isRestoredRef\.current \|\| messages\.some\(\(message\) => message\.role === "user"\)\) \{\s+introPlayedRef\.current = true;\s+return;/u,
  "a game the player has spoken in never plays its intro",
);
assert.match(
  surface,
  /if \(!playing\) setActiveDirections\(\(current\) => \(current\.length \? \[\] : current\)\);/u,
  "directions that played out are cleared, so a remounted engine never plays them again",
);
console.log("Game intro sequence: the opening's alone, and played directions never replay.");
