import { MARI_ANIMATION_PACKS, selectMariWorkAnimation } from "./mari-work-animations";

// Minimal assert-based self-check. Run with: pnpm tsx packages/client/src/lib/mari-work-animations.test.ts
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const core = MARI_ANIMATION_PACKS.find((pack) => pack.id === "core");
assert(core?.locked, "core is locked, so a pool can always fall back to it");
assert(MARI_ANIMATION_PACKS.every((pack) => pack.animations.length > 0), "no pack ships empty");

// Disabling every optional pack must still produce a sprite, from core.
const disabled = MARI_ANIMATION_PACKS.filter((pack) => !pack.locked).map((pack) => pack.id);
for (const activity of ["reading the wiki", "installing packages", "fixing an error", "", "drawing a portrait"]) {
  const picked = selectMariWorkAnimation({ seed: activity, activity, toolNames: [], disabledPacks: disabled });
  assert(picked.pack === "core", `"${activity}" falls back to core when every optional pack is off`);
}

// The same seed always picks the same sprite, so a card does not reshuffle on re-render.
const first = selectMariWorkAnimation({ seed: "run-1", activity: "searching", toolNames: ["grep"] });
const again = selectMariWorkAnimation({ seed: "run-1", activity: "searching", toolNames: ["grep"] });
assert(first.id === again.id, "selection is stable for a seed");

// An empty disabled list must not change what an untouched install sees.
const untouched = selectMariWorkAnimation({ seed: "run-2", activity: "riding along", toolNames: [], disabledPacks: [] });
const noArg = selectMariWorkAnimation({ seed: "run-2", activity: "riding along", toolNames: [] });
assert(untouched.id === noArg.id, "an empty disabled list is a no-op");

console.log("mari-work-animations: ok");
