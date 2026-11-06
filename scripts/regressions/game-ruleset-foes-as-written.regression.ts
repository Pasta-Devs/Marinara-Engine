/**
 * Foes fight as the Game Master described them (cheap-GM playtest 2026-10-26: spearmen asked for as the
 * SRD Bandit fought with its scimitar and crossbow, and a boss given points "but nothing priced out of
 * them" fought with no legendary actions at all).
 *
 *   - A foe asked for as a bestiary creature, written with weapons that creature has none of and not
 *     called by its name, is built at that creature's tier under the weapons it was written with, and
 *     the fight says so. One written with the creature's own weapon, one with no weapon written, and
 *     one called by the creature's name keep the bestiary's block.
 *   - A boss given points whose proposed block cannot be read is built from its tier with something to
 *     spend them on, rather than none.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  rulesetSheetBuildSchema,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-foes-as-written-"));
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
    id: "bandit",
    label: "Bandit",
    creature: {
      health: 11,
      defense: 12,
      initiativeModifier: 1,
      speed: 30,
      abilities: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      tier: "cr_1_8",
      actions: [
        { id: "scimitar", name: "Scimitar", budget: "action", toHit: 3, reach: 5, damage: { dice: "1d6", flat: 1 } },
        {
          id: "light_crossbow",
          name: "Light Crossbow",
          budget: "action",
          toHit: 3,
          range: { normal: 80, long: 320 },
          damage: { dice: "1d8", flat: 1 },
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
  const labels = (built: ReturnType<typeof fight>, id: string) =>
    built.encounter.combatants
      .find((one) => one.id === id)!
      .actions.filter((action) => action.kind !== "contest")
      .map((action) => action.label);
  const creatureOf = (built: ReturnType<typeof fight>, id: string) =>
    built.encounter.combatants.find((one) => one.id === id)!.creature;

  // ── Spearmen asked for as Bandits fight with spears ──
  const spears = fight([
    { id: "spear-1", name: "Spearman 1", creature: "Bandit", attacks: [{ name: "Spear" }] },
    { id: "bandit-1", name: "Bandit Scout", creature: "Bandit", attacks: [{ name: "Light Crossbow" }] },
    { id: "bandit-2", name: "Cutpurse", creature: "Bandit" },
    { id: "bandit-3", name: "Bandit 2", creature: "Bandit", attacks: [{ name: "Club" }] },
  ]);
  const said = spears.adjustments.join(" | ");
  const spear = labels(spears, "spear-1");
  assert.ok(spear.includes("Spear"), `the spear it was written with: ${spear.join(", ")}`);
  assert.ok(!spear.includes("Light Crossbow") && !spear.includes("Scimitar"), spear.join(", "));
  assert.equal(creatureOf(spears, "spear-1"), undefined, "no longer the bestiary's Bandit");
  assert.ok(
    spears.adjustments.includes(
      "Spearman 1 was written with Spear, which the Bandit of the bestiary has none of, so it was built at CR 1/8 instead.",
    ),
    said,
  );
  // Written with the creature's own weapon, with none, or called by its name: the bestiary's block.
  for (const id of ["bandit-1", "bandit-2", "bandit-3"]) {
    assert.ok(creatureOf(spears, id), `${id} is still the bestiary's Bandit`);
    assert.ok(labels(spears, id).includes("Scimitar"), `${id}: ${labels(spears, id).join(", ")}`);
  }

  // ── A boss whose proposed block cannot be read still has something to spend its points on ──
  const boss = fight([
    { id: "warden", name: "Iron Warden", tier: "cr_3", boss: true, points: 2, proposed: { health: "lots" } },
  ]);
  const bossSaid = boss.adjustments.join(" | ");
  assert.doesNotMatch(bossSaid, /no legendary actions/);
  assert.match(bossSaid, /The proposed stat block for Iron Warden could not be read, so its tier was used\./);
  const warden = boss.encounter.combatants.find((one) => one.id === "warden")!;
  assert.ok(
    warden.actions.some((action) => action.signature),
    warden.actions.map((action) => action.label).join(", "),
  );
  console.log("game-ruleset-foes-as-written: ok");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
