import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The choice cards open where the narration's Next button just was. A click meant for Next must not
// land on a card and send it as a whole turn, so the cards take clicks only after a short arming delay.
const source = readFileSync(
  new URL("../../packages/client/src/components/game/GameChoiceCards.tsx", import.meta.url),
  "utf8",
).replace(/\r\n?/gu, "\n");

const delay = /export const CHOICE_CARDS_ARM_DELAY_MS = (\d+);/u.exec(source);
assert.ok(delay, "the arming delay is a named constant");
const ms = Number(delay[1]);
assert.ok(ms >= 400 && ms <= 1200, "long enough to catch a follow-through click, short enough not to be noticed");
assert.match(
  source,
  /window\.setTimeout\(\(\) => setArmed\(true\), CHOICE_CARDS_ARM_DELAY_MS\)/u,
  "the cards arm once the delay has passed since they appeared",
);
assert.match(source, /return \(\) => window\.clearTimeout\(timer\);/u, "an unmounted card set never arms");
assert.match(
  source,
  /if \(!armed \|\| disabled \|\| selected !== null \|\| !isRecordedChoice\) return;/u,
  "a click before the cards are armed sends nothing",
);

console.info("Game choice cards arm before they take a click.");
