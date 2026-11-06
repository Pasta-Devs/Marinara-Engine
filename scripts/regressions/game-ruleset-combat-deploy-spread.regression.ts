/**
 * Deploying spread against a blast (combat AI S1a).
 *
 *   - A party facing an opponent that holds an area that harms starts spread by its size, not in a
 *     block its opening blast catches whole.
 *   - Against opponents with none it still starts together.
 *   - The same for the other side: `placeSpawns` spreads whichever side it is asked to, never nearer
 *     the other.
 *   - Each one by its own mind (2026-10-24, Alyssa): a tactical one keeps exactly the blast's size
 *     off, a cunning one only sometimes (a third of them, the same in a replay), a wolf or a zombie
 *     never; a zombie stays bunched beside the cultist who keeps clear of them.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  rulesetPositionOf,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import { placeSpawns } from "../../packages/shared/src/features/tactical-combat/grid-gen.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-deploy-spread-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { createRulesetFight, rulesetDeploySpread } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const slam = { id: "slam", name: "Slam", budget: "action", toHit: 5, reach: 5, damage: { dice: "1d6" } };
  const blast = {
    id: "blast",
    name: "Fire Blast",
    budget: "action",
    range: { normal: 150 },
    autoHit: true,
    damage: { dice: "8d6", type: "fire" },
    area: { shape: "burst", size: 10 },
  };
  const withMage = (actions: Record<string, unknown>[]): RulesetDefinition => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
    const mage = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
    mage.id = "mage";
    mage.label = "Mage";
    mage.creature.actions = actions;
    creatures.entries.push(mage);
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const names = ["Ada", "Bram", "Cora", "Dain"];
  const deploy = (definition: RulesetDefinition) => {
    const bestiary = Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const creaturesId = (definition.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const built = createRulesetFight({
      definition,
      seed: 5,
      positioned: true,
      party: names.map((name) => ({ id: name.toLowerCase(), name })),
      enemies: [{ id: "mage", name: "Mage", creature: `${creaturesId}/mage` }],
      cards: names.map((name) => ({ name, rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } })),
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary,
    } as never);
    assert.ok(built.ok, built.ok ? "" : (built as { error: string }).error);
    const encounter = (built as { fight: { encounter: { combatants: never[] } } }).fight.encounter;
    return names.map((name) =>
      rulesetPositionOf(encounter.combatants.find((one: { id: string }) => one.id === name.toLowerCase()))!,
    );
  };
  const gap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const closest = (cells: { x: number; y: number }[]) =>
    Math.min(...cells.flatMap((a, i) => cells.slice(i + 1).map((b) => gap(a, b))));
  /** The most of them one blast of this many cells across its centre catches. */
  const mostCaught = (cells: { x: number; y: number }[], radius: number) =>
    Math.max(...cells.map((centre) => cells.filter((one) => gap(one, centre) <= radius).length));

  {
    // Nobody on the party's side is refused in words (Kenhito prep K3).
    const definition = withMage([slam]);
    const empty = createRulesetFight({
      definition,
      seed: 5,
      positioned: true,
      party: [],
      enemies: [
        {
          id: "mage",
          name: "Mage",
          creature: `${(definition.catalogs ?? []).find((one) => one.holds === "creatures")!.id}/mage`,
        },
      ],
      cards: [],
      playerName: null,
      live: {},
      items: () => [],
      partyCatalogs: {},
      bestiary: {},
    } as never);
    assert.deepEqual(empty, { ok: false, error: "This fight has nobody on the party's side." });
  }

  {
    const together = deploy(withMage([slam]));
    assert.equal(closest(together), 1, `against a slam the party starts together: ${JSON.stringify(together)}`);
    const spread = deploy(withMage([slam, blast]));
    // The blast's size and one more, not closed back up by where each one's role stands it (D5).
    assert.ok(closest(spread) >= 3, `against a blast it starts spread: ${JSON.stringify(spread)}`);
    assert.ok(
      mostCaught(spread, 2) < mostCaught(together, 2),
      `a 10-foot blast catches fewer of them: ${JSON.stringify(spread)} against ${JSON.stringify(together)}`,
    );
    assert.ok(
      spread.every((cell) => cell.x <= Math.max(...together.map((one) => one.x)) + 2),
      `and none of them steps far out toward the mage: ${JSON.stringify(spread)}`,
    );
  }

  {
    // Only a side with somebody in it that thinks about the fight (S1b re-test): a wolf pack or a
    // horde of zombies facing the same blast comes on bunched as it always does.
    const definition = withMage([slam]);
    const sides = (mind: string | ((i: number) => string), count = 3, seed = 1) =>
      rulesetDeploySpread(
        definition,
        createRulesetEncounter({
          definition,
          seed,
          board: {
            grid: {
              width: 16,
              height: 12,
              tiles: Array.from({ length: 12 }, () => Array.from({ length: 16 }, () => "plains")),
            } as never,
            placements: {
              caster: { x: 0, y: 5 },
              ...Object.fromEntries(
                Array.from({ length: count }, (_, i) => [`pack${i}`, { x: 15 - Math.floor(i / 12), y: i % 12 }]),
              ),
            },
          },
          combatants: [
            {
              id: "caster",
              name: "Caster",
              side: "party",
              block: {
                health: 20,
                defense: 12,
                initiativeModifier: 0,
                speed: 30,
                actions: [{ ...blast, damage: { count: 8, sides: 6, flat: 0 } }],
              } as never,
            },
            ...Array.from({ length: count }, (_, i) => ({
              id: `pack${i}`,
              name: `Pack ${i}`,
              side: "enemy" as const,
              block: {
                health: 11,
                defense: 13,
                initiativeModifier: 0,
                speed: 40,
                mind: typeof mind === "string" ? mind : mind(i),
                actions: [slam],
              } as never,
            })),
          ],
        }),
      );
    assert.deepEqual(sides("instinct"), {}, "a wolf pack does not spread");
    assert.deepEqual(sides("mindless"), {}, "nor a horde of zombies");
    assert.deepEqual(
      sides("tactical"),
      { pack0: 3, pack1: 3, pack2: 3 },
      "a tactical band keeps exactly a 2-cell burst's size and one more apart",
    );
    assert.deepEqual(sides("genius"), sides("tactical"), "a genius no farther: exactly as far as needed");
    // A cunning one only sometimes: about a third of a big band, the same ones every time for one seed.
    const cunning = Object.keys(sides("cunning", 30));
    assert.ok(cunning.length >= 5 && cunning.length <= 15, `about a third think of it: ${cunning.length} of 30`);
    assert.deepEqual(Object.keys(sides("cunning", 30)), cunning, "the same ones in a replay");
    assert.notDeepEqual(Object.keys(sides("cunning", 30, 2)), cunning, "other ones in another fight");
    // Zombies beside a cultist: only the cultist keeps clear.
    assert.deepEqual(
      sides((i) => (i === 1 ? "tactical" : "mindless")),
      { pack1: 3 },
      "the cultist spreads, the zombies beside it do not",
    );
  }

  {
    // The other side, straight off placement: enemies asked to spread do, never nearer the party.
    const open = (): TacticalGrid => ({
      width: 16,
      height: 12,
      tiles: Array.from({ length: 12 }, () => Array.from({ length: 16 }, () => "plains" as const)),
    });
    const units = () => [
      ...[0, 1].map((i) => ({ id: `p${i}`, side: "party" as const, x: 0, y: 0 })),
      ...[0, 1, 2, 3].map((i) => ({ id: `e${i}`, side: "enemy" as const, x: 0, y: 0 })),
    ];
    const asked = (gaps: number[]) =>
      units().map((one) =>
        one.side === "enemy" && gaps[Number(one.id.slice(1))] ? { ...one, spread: gaps[Number(one.id.slice(1))] } : one,
      );
    const plain = units();
    assert.ok(placeSpawns(open(), plain, "skirmish", () => 0.5, new Set(), true));
    const spaced = asked([3, 3, 3, 3]);
    assert.ok(placeSpawns(open(), spaced, "skirmish", () => 0.5, new Set(), true));
    const enemies = (list: typeof plain) => list.filter((one) => one.side === "enemy");
    assert.ok(closest(enemies(plain)) < 3, `a skirmish bunches them: ${JSON.stringify(enemies(plain))}`);
    assert.ok(closest(enemies(spaced)) >= 3, `spread three apart: ${JSON.stringify(enemies(spaced))}`);
    const party = spaced.filter((one) => one.side === "party");
    const nearest = (list: typeof plain) =>
      Math.min(
        ...enemies(list).flatMap((foe) => list.filter((one) => one.side === "party").map((one) => gap(one, foe))),
      );
    assert.ok(nearest(spaced) >= nearest(plain) - 1, `none of them nearer the party: ${JSON.stringify(party)}`);
    // One cultist among three zombies: it keeps three off each, they stay bunched.
    const mixed = asked([0, 3, 0, 0]);
    assert.ok(placeSpawns(open(), mixed, "skirmish", () => 0.5, new Set(), true));
    const zombies = enemies(mixed).filter((one) => one.id !== "e1");
    const cultist = enemies(mixed).find((one) => one.id === "e1")!;
    assert.ok(closest(zombies) < 3, `the zombies stay bunched: ${JSON.stringify(zombies)}`);
    assert.ok(
      zombies.every((one) => gap(one, cultist) >= 3),
      `the cultist keeps clear of them: ${JSON.stringify(enemies(mixed))}`,
    );
  }

  console.log(
    "Deploying spread: a party facing a blast starts spread by its size, one facing none starts together, and either side spreads without stepping toward the other.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
