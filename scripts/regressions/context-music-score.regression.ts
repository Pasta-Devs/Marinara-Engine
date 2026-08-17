// Context-bound music selection (#5161): the scorer's area/tier precedence,
// its keep-current stability contract, and the isolation between context
// tracks and the legacy state library.
import assert from "node:assert/strict";
import {
  scoreMusic,
  musicAreaSlug,
  normalizeMusicEnemyTier,
} from "../../packages/shared/src/utils/music-score.js";

const bundled = [
  "music:exploration:fantasy:tense:winding-paths",
  "music:exploration:fantasy:calm:meadows",
  "music:combat:fantasy:intense:clash-of-steel",
  "music:travel_rest:fantasy:calm:campfire",
];
const areaTrack = "music:area:the-slag-bar:generated-abc123";
const bossTrack = "music:tier:boss:generated-def456";
const library = [...bundled, areaTrack, bossTrack];

// 1. Outside combat, a matching area track wins outright over the state library.
assert.equal(
  scoreMusic({ state: "exploration", locationSlug: "the-slag-bar", availableMusic: library }),
  areaTrack,
  "a matching area track wins outside combat",
);

// 2. The stability contract: the current track is KEPT while it still fits the
// context — even when the anti-repeat history lists it. Context music changes
// when context changes, never per turn.
assert.equal(
  scoreMusic({
    state: "dialogue",
    locationSlug: "the-slag-bar",
    currentMusic: areaTrack,
    recentMusic: [areaTrack],
    availableMusic: library,
  }),
  areaTrack,
  "the current area track is kept, not rotated off",
);

// 3. Combat with a tier picks the tier track and never the area track.
assert.equal(
  scoreMusic({ state: "combat", locationSlug: "the-slag-bar", enemyTier: "boss", availableMusic: library }),
  bossTrack,
  "combat with a matching tier selects the tier track",
);

// 4. Combat without tier tracks for the tier (or no tier at all) falls back to
// legacy combat scoring — never an area track.
for (const enemyTier of [null, "miniboss"]) {
  const picked = scoreMusic({
    state: "combat",
    locationSlug: "the-slag-bar",
    enemyTier,
    availableMusic: library,
  });
  assert.equal(picked, "music:combat:fantasy:intense:clash-of-steel", `combat fallback for tier=${enemyTier}`);
}

// 5. A non-matching slug falls through to legacy scoring, and context tags
// never leak into the legacy pool (they are unparseable as state tags).
const legacyPick = scoreMusic({ state: "exploration", locationSlug: "elsewhere", availableMusic: library });
assert.ok(
  legacyPick && legacyPick.startsWith("music:exploration:"),
  `legacy scoring stays within the state library (got ${legacyPick})`,
);

// 6. Malformed context tags are not selectable: a 3-part area tag has no name.
assert.equal(
  scoreMusic({
    state: "exploration",
    locationSlug: "the-slag-bar",
    availableMusic: ["music:area:the-slag-bar", ...bundled],
  }),
  "music:exploration:fantasy:tense:winding-paths",
  "an area tag without a name part is rejected",
);

// 7. Multiple variants under one key rotate off the recent list but stay
// inside the context set.
const variantA = "music:area:the-slag-bar:generated-aaa";
const variantB = "music:area:the-slag-bar:custom-user-track";
const variantPick = scoreMusic({
  state: "exploration",
  locationSlug: "the-slag-bar",
  currentMusic: null,
  recentMusic: [variantA],
  availableMusic: [...bundled, variantA, variantB],
});
assert.equal(variantPick, variantB, "a fresh variant is preferred over a recently played one");

// 8. Tier normalization accepts the taxonomy plus its aliases.
assert.equal(normalizeMusicEnemyTier("Boss"), "boss");
assert.equal(normalizeMusicEnemyTier("elite"), "miniboss");
assert.equal(normalizeMusicEnemyTier("legendary"), "special");
assert.equal(normalizeMusicEnemyTier("swarm"), null);

// 9. The area slug matches the background slugification: shared identity.
assert.equal(musicAreaSlug("The Slag Bar, Kepler's Rest"), "the-slag-bar-kepler-s-rest");
assert.equal(musicAreaSlug("  "), null);
assert.equal(musicAreaSlug(null), null);
assert.equal(musicAreaSlug("---Neon District---"), "neon-district");

// 10. Non-Latin location names keep the area axis alive through a stable
// hash key instead of silently disabling it.
{
  const cjk = musicAreaSlug("東京タワー");
  assert.ok(cjk && /^x[0-9a-z]+$/.test(cjk), `non-Latin names get a stable hash key (got ${cjk})`);
  assert.equal(musicAreaSlug("東京タワー"), cjk, "the hash key is deterministic");
}

// 11. Uncontrolled input stays linear (CodeQL polynomial-regex alert): a
// dash flood must neither blow up nor produce a dangling-dash slug. Inputs
// are capped before any scanning, so content past the cap is deliberately
// ignored — the flood and the flood-plus-suffix resolve identically.
{
  const started = Date.now();
  const flood = musicAreaSlug("-".repeat(500_000));
  assert.ok(flood && flood.startsWith("x"), "a punctuation-only name still gets a stable hash key");
  assert.equal(musicAreaSlug(`${"-".repeat(500_000)}x`), flood, "content beyond the input cap is not scanned");
  assert.equal(musicAreaSlug(`abc${"-".repeat(500_000)}`), "abc");
  assert.ok(Date.now() - started < 1_000, "slugging a dash flood stays fast");
}

console.log("context-music-score: all cases passed");
