/**
 * Reactions narrowed by what is thrown and by who holds what (Capability API 1.564).
 *
 *   - `against.qualities`: Rock Catching answers any attack carrying a quality ("thrown_object"),
 *     whatever it is called; nothing else opens it.
 *   - `forHolds`: a shield guardian's Shield answers a hit only on whoever holds its amulet.
 *   - The install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reaction-qualities-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 564);
  const text = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const catchRock = {
    id: "rock-catching",
    label: "Rock Catching",
    rows: [{ list: "spells", values: { name: "Rock Catching", level: 0, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "reaction",
      reaction: { on: "aimed", cancels: true, against: { qualities: ["thrown_object"] } },
    },
  };
  const shield = {
    id: "shield",
    label: "Shield",
    rows: [{ list: "spells", values: { name: "Shield", level: 0, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "ally",
      budget: "reaction",
      range: 5,
      reaction: { on: "hit", for: "ally", within: 5, at: "target", forHolds: ["guardian_amulet"] },
      applies: [{ condition: "parrying", duration: "this-action" }],
    },
  };
  const document = () => {
    const doc = JSON.parse(text);
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      units: { distance: { label: "ft", perCell: 5 } },
      entries: [catchRock, shield],
    });
    return doc;
  };
  const parsed = (doc: unknown) => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const attacker: RulesetStatBlock = {
    health: 40,
    defense: 10,
    initiativeModifier: 20,
    speed: 30,
    actions: [
      {
        id: "boulder",
        name: "Hurl Boulder",
        budget: "action",
        toHit: 4,
        range: 100,
        damage: { flat: 3, qualities: ["thrown_object"] },
      },
      { id: "club", name: "Club", budget: "action", toHit: 4, range: 100, damage: { flat: 3 } },
    ],
  } as unknown as RulesetStatBlock;
  const sheet = (entry: unknown) => {
    const spell = entry as RulesetCatalogEntry;
    return {
      build: rulesetSheetBuildSchema.parse({
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
        lists: { spells: rowsFromCatalogEntry("spells", spell).map((row) => row.row) },
      }),
      live: {},
      catalogs: { spells: [spell] },
    };
  };
  const fight = (entry: unknown) =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "attacker", name: "Attacker", side: "enemy", block: attacker },
        {
          id: "ally",
          name: "Ally",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 5, speed: 30, hp_max: 40 },
          }),
          live: {},
        },
        { id: "holder", name: "Holder", side: "party", ...sheet(entry) },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [Array(20).fill(0)] } as never,
        placements: { attacker: { x: 0, y: 0 }, ally: { x: 2, y: 0 }, holder: { x: 3, y: 0 } },
      },
    });
  const of = <T extends RulesetCombatEvent["type"]>(es: RulesetCombatEvent[], type: T) =>
    es.filter((e): e is Extract<RulesetCombatEvent, { type: T }> => e.type === type);
  const attack = (s: RulesetEncounterState, optionId: string, target: string) => {
    s.order = ["attacker", "ally", "holder"];
    s.turn = 0;
    const step = applyRulesetCombatChoice(
      definition,
      s,
      { actorId: "attacker", optionId, targetIds: [target] } as RulesetCombatChoice,
      (sides) => (sides === 20 ? 17 : 3),
    );
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(step.events));
    return step;
  };

  // ── Rock Catching: a hurled boulder, by its quality; never a club ──
  assert.equal(attack(fight(catchRock), "boulder", "holder").state.window?.trigger.kind, "aimed");
  assert.equal(attack(fight(catchRock), "club", "holder").state.window, undefined);

  // ── Shield: only for whoever holds the amulet ──
  {
    const bare = fight(shield);
    assert.equal(attack(bare, "club", "ally").state.window, undefined, "nobody holds the amulet");
    const worn = fight(shield);
    rulesetCombatant(worn, "ally")!.sheet!.items = [
      { item: { category: "gear", tags: ["guardian_amulet"] }, quantity: 1, name: "Amulet" },
    ] as never;
    const step = attack(worn, "club", "ally");
    assert.equal(step.state.window?.trigger.kind, "hit");
    assert.deepEqual(step.state.window?.waiting, ["holder"]);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a reaction narrowed by qualities or by what the one it answers for holds (against.qualities, forHolds) requires schemaVersion 2 and capabilityApi 1.564 or newer";
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "fivee",
      name: "5e",
      version: "1.0.0",
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(563) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(564) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(563) as never, JSON.parse(text)), gate);
  }

  console.log(
    "Reaction qualities: Rock Catching answers a hurled boulder by its quality, not a club; Shield answers only for the amulet's holder; gated at 1.564.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
