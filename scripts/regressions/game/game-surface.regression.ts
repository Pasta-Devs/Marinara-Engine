// The Game surface: a reroll resets the narration when the active swipe changes, and the GM's SFX loop count reaches
// the audio manager. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSurfaceSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameSurface.tsx", import.meta.url),
  "utf8",
);
const gameNarrationSource = readFileSync(
  new URL("../../../packages/client/src/components/game/GameNarration.tsx", import.meta.url),
  "utf8",
);
assert.match(
  gameNarrationSource,
  /const narrationKey = latestAssistant \? `\$\{latestAssistant\.id\}:\$\{latestAssistant\.activeSwipeIndex \?\? 0\}` : null/u,
  "Game rerolls must reset narration when the saved swipe changes on the same message",
);
assert.match(gameSurfaceSource, /audioManager\.playSfx\(resolved, assetMap, fx\.sfxLoopCount\)/u);
