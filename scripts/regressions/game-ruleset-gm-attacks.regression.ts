/**
 * What the Game Master wrote for an invented opponent, kept (laptop playtest 2026-10-25: a duelist's
 * Rapier and Dagger both read "Attack", and its "Parry" never fired).
 *
 *   - An opponent built off its tier strikes under the names of its attacks, a heal or a ward naming
 *     none, and with none named it still has one "Attack".
 *   - A reaction it was given is the one this ruleset's bestiary has by that name; one the bestiary
 *     has nowhere is said, and left out.
 *     A skill that is no attack is looked for by name too: the blueprint drops a reaction word the
 *     Engine has none of ("Parry"), so the duelist's arrived as a plain buff.
 *   - The Game Master is told which reactions there are.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rulesetBestiaryReactionNames,
  rulesetSheetBuildSchema,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-gm-attacks-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
  creatures.entries.push({
    id: "knight",
    label: "Knight",
    creature: {
      health: 52,
      defense: 18,
      initiativeModifier: 0,
      speed: 30,
      abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
      tier: "cr_1",
      actions: [
        { id: "greatsword", name: "Greatsword", budget: "action", toHit: 5, damage: { dice: "2d6", flat: 3 } },
        {
          id: "parry",
          name: "Parry",
          budget: "reaction",
          self: true,
          reaction: { on: "hit", blow: "melee", seesSource: true },
          applies: [{ condition: "parrying", duration: { rounds: 1 }, endsAfter: "attacked" }],
        },
      ],
    },
  });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const bestiary = { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! };
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 15, speed: 30, hp_max: 28, race: "Human" },
  });
  const fight = (enemies: Parameters<typeof createRulesetFight>[0]["enemies"]) => {
    const built = createRulesetFight({
      definition,
      seed: 7,
      party: [{ id: "rook", name: "Rook" }],
      enemies,
      cards: [{ name: "Rook", rulesetSheet: { v: 1, build } }],
      playerName: "Rook",
      live: null,
      partyCatalogs: {},
      bestiary,
    });
    assert.ok(built.ok, built.ok ? "" : built.error);
    return built.fight;
  };
  const own = (one: { actions: Array<{ kind: string; label: string }> }) =>
    one.actions.filter((action) => action.kind !== "contest");

  // ── Its strikes keep their names; its reaction is the bestiary's ──
  const duel = fight([
    {
      id: "duelist",
      name: "Duelist",
      tier: "cr_1",
      attacks: [
        { name: "Rapier" },
        { name: "Dagger" },
        { name: "Parry", kind: "buff" },
        { name: "Bolt Ward", reaction: "guard" },
        { name: "Battle Cry", kind: "buff" },
      ],
    },
  ]);
  const duelist = duel.encounter.combatants.find((one) => one.id === "duelist")!;
  const labels = own(duelist).map((action) => action.label);
  assert.deepEqual(labels.slice(0, 2), ["Rapier", "Dagger"], "named for the Game Master's attacks");
  assert.ok(!labels.includes("Attack"), "no plain Attack beside them");
  const parry = duelist.actions.find((action) => action.label === "Parry");
  assert.ok(parry?.reaction, "Parry is the bestiary's reaction");
  assert.equal(parry.reaction.on, "hit");
  assert.ok(
    duel.adjustments.some((line) => line === 'Duelist: this ruleset has no reaction called "Bolt Ward".'),
    duel.adjustments.join(" | "),
  );
  assert.ok(!duelist.actions.some((action) => action.label === "Bolt Ward"), "one the bestiary lacks is left out");
  // A buff that is no reaction anywhere is no strike either, and nothing is said of it.
  assert.ok(!labels.includes("Battle Cry"));
  assert.ok(!duel.adjustments.some((line) => line.includes("Battle Cry")));

  // ── With no attacks named, still one Attack ──
  const plain = fight([{ id: "thing", name: "Thing", tier: "cr_1" }]);
  assert.deepEqual(
    own(plain.encounter.combatants.find((one) => one.id === "thing")!).map((action) => action.label),
    ["Attack"],
  );

  // ── The Game Master is told which reactions there are ──
  assert.ok(rulesetBestiaryReactionNames(bestiary).includes("Parry"));
  console.log("game-ruleset-gm-attacks: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
