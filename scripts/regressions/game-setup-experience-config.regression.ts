// Source-level pin for the two Experience keys the game-setup wizard emits.
//
// `continueExistingSetup` merges the wizard's answer over the stored config as `{...stored, ...submitted}`,
// so a key that is PRESENT with an explicit `undefined` wipes the stored value rather than leaving it
// alone. `gameExperienceId` and `experienceConfig` therefore have to leave `buildSetupConfig` as a
// CONDITIONAL SPREAD — absent entirely when no Experience is active — and never as
// `key: cond ? x : undefined`. Nothing else in the tree catches that regression: both shapes type-check,
// both read correctly in review, and the difference only shows up later as a chat whose Experience config
// silently vanished.
//
// The spread is gated on the NEW-GAME flag as well as on the selection, because only `/game/create` stamps
// the top-level `gameExperienceId` the Experience's own routes read; emitting it on a re-entered setup
// leaves a config claiming an Experience that never mounts.
//
// Read as source text, the way `prompt.regression.ts` already pins this same file. The extracted function
// has its whitespace normalized first, so every assertion survives reformatting.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizardSource = readFileSync(
  new URL("../../packages/client/src/components/game/GameSetupWizard.tsx", import.meta.url),
  "utf8",
).replace(/\r\n/gu, "\n");

const builderStart = wizardSource.indexOf("const buildSetupConfig");
assert.ok(builderStart >= 0, "GameSetupWizard should still build its setup config in buildSetupConfig");
const builderEnd = wizardSource.indexOf("\n  };", builderStart);
assert.ok(builderEnd > builderStart, "buildSetupConfig should still close at the component's own indentation");
const builder = wizardSource.slice(builderStart, builderEnd).replace(/\s+/gu, " ");

// 1. Both keys are emitted, together, inside one conditional spread gated on the selection AND on the
//    new-game flag.
assert.match(
  builder,
  /\.\.\.\(\s*(?:experienceSelectionEnabled && activeExperience|activeExperience && experienceSelectionEnabled)\s*\?\s*\{\s*gameExperienceId:\s*activeExperience\.id\s*,\s*experienceConfig:\s*\{/u,
  "buildSetupConfig should emit gameExperienceId and experienceConfig as one conditional spread gated on both the active Experience and the new-game flag",
);

// 2. The spread's other branch is an empty object, so with no Experience active both keys are ABSENT
//    rather than present and undefined.
assert.match(
  builder,
  /gameExperienceId: activeExperience\.id,[\s\S]{0,600}?:\s*\{\}\s*\)/u,
  "The Experience spread should fall back to an empty object so both keys stay absent with no Experience active",
);

// 3. Never a conditional VALUE: a key present with `undefined` is exactly what wipes a stored config.
assert.doesNotMatch(
  builder,
  /\bgameExperienceId:\s*[^,;}]*\bundefined\b/u,
  "gameExperienceId must never be emitted as a conditional value resolving to undefined",
);
assert.doesNotMatch(
  builder,
  /\bexperienceConfig:\s*[^,;}]*\bundefined\b/u,
  "experienceConfig must never be emitted as a conditional value resolving to undefined",
);

// 4. Exactly one emission of each key, so a second unconditional write cannot creep in beside the spread.
const emittedKeyCount = (key: string) => builder.split(new RegExp(`\\b${key}:`, "u")).length - 1;
assert.equal(emittedKeyCount("gameExperienceId"), 1, "buildSetupConfig should write gameExperienceId exactly once");
assert.equal(emittedKeyCount("experienceConfig"), 1, "buildSetupConfig should write experienceConfig exactly once");

// 5. Inside `experienceConfig`, the manifest's declared literals spread BEFORE the seed. Later keys win, so
//    the other order lets a manifest that names the seed key in `config` replace the player's number with a
//    constant the package would accept without complaint.
const declaredConfigSpread = builder.search(/setup\?\.config\s*\?\?\s*\{\}/u);
const seedWrite = builder.search(/\[\s*experienceSeedField\.key\s*\]\s*:/u);
assert.ok(declaredConfigSpread >= 0, "The Experience spread should copy the manifest's declared setup.config literals");
assert.ok(seedWrite >= 0, "The Experience spread should write the collected seed under the manifest's declared key");
assert.ok(
  seedWrite > declaredConfigSpread,
  "The declared config literals must spread before the seed, so a manifest cannot overwrite the player's seed",
);

// 6. The seed leaves the wizard as a validated NUMBER, never as the raw field text.
assert.match(
  builder,
  /experienceSeedField && isValidSeed\(experienceSeed\)/u,
  "The seed should only be written once it validates as a uint32",
);
assert.doesNotMatch(
  builder,
  /\[\s*experienceSeedField\.key\s*\]\s*:\s*experienceSeedInput/u,
  "The seed must be written as the parsed number, never as the raw input text",
);

// 7. The new-game gate is a declared prop the host passes, not a local constant that can drift to true.
assert.match(
  wizardSource.replace(/\s+/gu, " "),
  /experienceSelectionEnabled:\s*boolean/u,
  "experienceSelectionEnabled should stay a declared prop of GameSetupWizard",
);

console.log("Game setup Experience keys stay a conditional spread gated on the selection and the new-game flag.");
