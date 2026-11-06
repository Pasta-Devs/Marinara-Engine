/**
 * Dying outside a fight (cheap-GM playtest 2026-10-26: a hero stabilised in the story stayed dying
 * and rolled death saves again in the next fight, and the Game Master wrote two death save failures
 * with no roll).
 *
 *   - The Game Master writing a hero's dying successes up to the full count is the story stabilising
 *     them, as a fight does: both counts go back, the sheet keeps them stable, and the next fight
 *     starts them down and stable, rolling nothing.
 *   - Failures written up by hand are refused: outside a fight only a blow while down marks them,
 *     by the dying rule's own count. Written down (a revival's clearing) they still go through.
 *   - Health back, or a blow while down, ends the stable.
 *   - A fight that ends with somebody down and stable writes so onto their sheet.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetLive,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const parsed = parseRulesetDefinition(
  JSON.parse(readFileSync(join(root, "docs/development/ruleset-5e-2014.example.json"), "utf8")),
);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition: RulesetDefinition = parsed.definition;
const build = defaultRulesetSheetBuild(definition);
build.fields = { ...build.fields, hp_max: 20 };
const KEY = "mara";
const read = (live: RulesetLiveStates) => readRulesetLive(definition, build, live[KEY]);
const track = (live: RulesetLiveStates, id: string) => read(live).tracks.find((one) => one.id === id)!.value;
const hp = (live: RulesetLiveStates) => read(live).pools.find((one) => one.key === "hp")!.value;
const tell = (text: string, live: RulesetLiveStates) =>
  applySheetCommandTags(text, { definition, cards: [{ name: "Mara", build }], playerName: "Mara", live });
// Down after a fight: no health, one failure, unconscious.
const down: RulesetLiveStates = {
  [KEY]: { pools: { hp: { value: 0 } }, tracks: { death_save_failures: 1 }, conditions: ["unconscious"] },
} as never;

// ── Stabilised in the story ──
const steadied = tell('[sheet: who="Mara" op="track" track="Death save successes" to="3"]', down);
assert.equal(steadied.outcomes[0]?.ok, true, JSON.stringify(steadied.outcomes));
assert.match(steadied.outcomes[0]!.now!, /stable/);
assert.equal(steadied.live[KEY]?.stable, true, "the sheet keeps them stable");
assert.equal(track(steadied.live, "death_save_successes"), 0, "both counts go back");
assert.equal(track(steadied.live, "death_save_failures"), 0);
assert.equal(hp(steadied.live), 0, "still at no health");

// ── The next fight starts them stable, rolling nothing ──
const block = {
  health: 30,
  defense: 30,
  initiativeModifier: 0,
  speed: 30,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  actions: [],
} as unknown as RulesetStatBlock;
const fightWith = (live: unknown) =>
  createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      { id: "mara", name: "Mara", side: "party", build, live: live as never },
      { id: "orc", name: "Orc", side: "enemy", block },
    ],
  }).combatants.find((one) => one.id === "mara")!;
const stable = fightWith(steadied.live[KEY]);
assert.equal(stable.down, true);
assert.equal(stable.dying, true);
assert.equal(stable.stable, true, "the next fight starts them stable");
const dying = fightWith(down[KEY]);
assert.equal(dying.stable, false, "one never stabilised is dying, as before");

// ── Failures are rolled or struck, never written ──
{
  const written = tell('[sheet: who="Mara" op="track" track="death_save_failures" by="2"]', down);
  assert.equal(written.outcomes[0]?.ok, false);
  assert.match(written.outcomes[0]!.tag, /dying-saves-rolled/);
  assert.equal(track(written.live, "death_save_failures"), 1, "the sheet is as it was");
  const set = tell('[sheet: who="Mara" op="track" track="Death save failures" to="2"]', down);
  assert.equal(set.outcomes[0]?.ok, false);
  // Cleared is no failure written: it goes through.
  const cleared = tell('[sheet: who="Mara" op="track" track="death_save_failures" to="0"]', down);
  assert.equal(cleared.outcomes[0]?.ok, true);
  assert.equal(track(cleared.live, "death_save_failures"), 0);
  // A blow while down marks the dying rule's one failure, and ends a stable.
  const struck = tell('[sheet: who="Mara" op="damage" pool="hp" amount="3"]', steadied.live);
  assert.equal(struck.outcomes[0]?.ok, true, JSON.stringify(struck.outcomes));
  assert.equal(track(struck.live, "death_save_failures"), 1);
  assert.equal(struck.live[KEY]?.stable, undefined);
  // A blow on somebody standing marks nothing.
  const standing = tell('[sheet: who="Mara" op="damage" pool="hp" amount="3"]', {});
  assert.equal(track(standing.live, "death_save_failures"), 0);
}

// ── Health back ends the stable ──
{
  const healed = tell('[sheet: who="Mara" op="restore" pool="hp" amount="4"]', steadied.live);
  assert.equal(healed.outcomes[0]?.ok, true);
  assert.equal(healed.live[KEY]?.stable, undefined);
  assert.equal(fightWith(healed.live[KEY]).down, false);
}

// ── A fight that ends with them down and stable says so on their sheet ──
{
  const dataDir = mkdtempSync(join(tmpdir(), "marinara-stable-"));
  process.env.DATA_DIR = dataDir;
  process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
  try {
    const { rulesetFightLiveStates } =
      await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");
    const encounter = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mara", name: "Mara", side: "party", build, live: down[KEY] as never },
        { id: "orc", name: "Orc", side: "enemy", block },
      ],
    });
    const mara = encounter.combatants.find((one) => one.id === "mara")!;
    assert.equal(rulesetFightLiveStates({ encounter } as never)[KEY]?.stable, undefined, "dying is not stable");
    mara.stable = true;
    assert.equal(rulesetFightLiveStates({ encounter } as never)[KEY]?.stable, true);
    // Back up, it is gone.
    mara.down = false;
    mara.dying = false;
    mara.stable = false;
    const stored = { ...(mara.sheet!.live as object), stable: true };
    mara.sheet!.live = stored as never;
    assert.equal(rulesetFightLiveStates({ encounter } as never)[KEY]?.stable, undefined);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

console.log(
  "Story stable: full successes in the story keep a hero stable into the next fight; failures are rolled or struck, never written.",
);
