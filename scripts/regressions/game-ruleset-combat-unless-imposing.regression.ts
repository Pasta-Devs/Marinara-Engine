/**
 * Not while holding somebody (Capability API 1.715): an ankheg's Acid Spray, used only while it is
 * not grappling.
 *
 *   - `unlessImposing`: offered only while its user has put none of these on anybody still holding it.
 *   - On a creature's action, copied off its catalog entry, and on a catalog entry's mechanics.
 *   - What somebody else put on does not count, nor one put on its own user.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetStatBlockFromCreature,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-unless-imposing-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 715);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const blast = {
    id: "blast",
    label: "Free Blast",
    rows: [{ list: "spells", values: { name: "Free Blast", level: 0, prepared: true } }],
    mechanics: {
      kind: "attack",
      autoHit: true,
      targets: "enemy",
      range: 60,
      budget: "action",
      amount: { flat: 1 },
      unlessImposing: ["grappled"],
    },
  } as unknown as RulesetCatalogEntry;
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [structuredClone(blast)] });
    doc.catalogs
      .find((one: { id: string }) => one.id === "creatures")
      .entries[0].creature.actions.push({
        id: "spray",
        name: "Acid Spray",
        budget: "action",
        toHit: 5,
        damage: { dice: "3d6", type: "acid" },
        reach: 5,
        unlessImposing: ["grappled"],
      });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const creature = definition.catalogs!.find((one) => one.id === "creatures")!.entries![0]!.creature!;
  const ankheg = rulesetStatBlockFromCreature(definition, creature)!;
  assert.deepEqual(ankheg.actions.find((one) => one.id === "spray")?.unlessImposing, ["grappled"]);
  const entries = definition.catalogs!.find((one) => one.id === "spells")!.entries! as RulesetCatalogEntry[];
  const plain = {
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    actions: [],
  } as unknown as RulesetStatBlock;
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "ankheg", name: "Ankheg", side: "enemy", block: { ...ankheg, health: 60 } },
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30, spellcasting_ability: "int" },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((one) => one.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        { id: "goblin", name: "Goblin", side: "enemy", block: plain },
        { id: "squire", name: "Squire", side: "party", block: plain },
      ],
    });
    return state;
  };
  const offers = (state: RulesetEncounterState, id: string, label: string) => {
    state.turn = state.order.indexOf(id);
    return rulesetCombatOptions(definition, state, id).some((one) => one.label === label);
  };
  const grab = (state: RulesetEncounterState, holder: string, by: string, condition = "grappled") =>
    rulesetCombatant(state, holder)!.tracked.push({ condition, rounds: null, source: by } as never);

  // ── The ankheg: Acid Spray while it holds nobody, not while it grapples ──
  {
    const free = fight();
    assert.equal(offers(free, "ankheg", "Acid Spray"), true);
    const holding = fight();
    grab(holding, "squire", "ankheg");
    assert.equal(offers(holding, "ankheg", "Acid Spray"), false);
    // Somebody else's grapple, or one with its holder out of the fight, is not the ankheg's.
    const other = fight();
    grab(other, "squire", "goblin");
    assert.equal(offers(other, "ankheg", "Acid Spray"), true);
    const gone = fight();
    grab(gone, "squire", "ankheg");
    rulesetCombatant(gone, "squire")!.defeated = true;
    assert.equal(offers(gone, "ankheg", "Acid Spray"), true);
    // Another condition it put on is not a grapple.
    const frightened = fight();
    grab(frightened, "squire", "ankheg", "frightened");
    assert.equal(offers(frightened, "ankheg", "Acid Spray"), true);
  }

  // ── A catalog entry's mechanics: the mage's blast, not while grappling ──
  {
    const free = fight();
    assert.equal(offers(free, "mage", "Free Blast"), true);
    const holding = fight();
    grab(holding, "goblin", "mage");
    assert.equal(offers(holding, "mage", "Free Blast"), false);
  }

  // ── Refusals ──
  refused(
    fiveE((doc) => (doc.catalogs.at(-1).entries[0].mechanics.unlessImposing = [])),
    /unlessImposing/,
  );
  refused(
    fiveE((doc) => (doc.catalogs.at(-1).entries[0].mechanics.unlessImposing = ["grappled", "grappled"])),
    /unlessImposing/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset with an action offered only while its user holds nobody so (unlessImposing) requires schemaVersion 2 and capabilityApi 1.715 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(714) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(715) as never, fiveE()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(714) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Unless imposing: the ankheg's Acid Spray is offered until it grapples somebody, and again once that one is out or held by another; a mage's blast likewise; gated at 1.715.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
