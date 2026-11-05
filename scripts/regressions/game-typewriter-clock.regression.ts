/**
 * The opening's world overview and a turn's narration type out off the clock (2026-10-23 playtest):
 * a hidden tab's timers slowed to one a second, or a parent re-render clearing the next tick, held
 * the opening's Continue button and a fight's start for over six minutes with the server idle.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const surface = read("../../packages/client/src/components/game/GameSurface.tsx");
const intro = surface.slice(
  surface.indexOf("function IntroTypewriter"),
  surface.indexOf("function normalizeInventoryName"),
);
assert.match(intro, /performance\.now\(\) - startedAtRef\.current!\) \/ msPerChar/u, "the overview reads the clock");
assert.match(intro, /INTRO_TYPEWRITER_MAX_MS \/ Math\.max\(1, text\.length\)/u, "a long overview types faster");
assert.match(intro, /\}, \[visible, text\.length\]\);/u, "a new onComplete never restarts it");
assert.doesNotMatch(intro, /\[visible, text\.length, onComplete\]/u);

const narration = read("../../packages/client/src/components/game/GameNarration.tsx");
assert.match(
  narration,
  /tw\.pos = Math\.min\(dispLen, Math\.max\(tw\.pos \+ charsPerTick, byClock\)\);/u,
  "the narration catches up with the clock",
);

console.log(
  "Typewriters: the opening overview and the narration read the clock, so a hidden tab never holds the game.",
);
