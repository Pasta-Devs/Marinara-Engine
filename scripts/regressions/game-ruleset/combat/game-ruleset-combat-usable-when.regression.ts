/** Abilities usable only while the sheet allows (Capability API 1.166): a shield for Protection,
 *  no heavy armor for Rage, read each time a menu or a reaction window is drawn. */
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
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-usable-when-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 161);
  const text = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const count = (category: string) => ({ itemStat: { from: "worn", pick: "count", category } });
  const protection = {
    id: "protection",
    label: "Protection",
    rows: [{ list: "spells", values: { name: "Protection", level: 0, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      budget: "reaction",
      reaction: { on: "aimed", for: "ally", within: 5, seesSource: true, at: "source" },
      applies: [{ condition: "protected_attack", duration: "this-action" }],
      usableWhen: { value: count("shield"), atLeast: 1 },
    },
  };
  const rage = {
    id: "rage",
    label: "Rage",
    rows: [{ list: "spells", values: { name: "Rage", level: 0, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      budget: "action",
      applies: [{ condition: "raging", duration: { rounds: 10 } }],
      usableWhen: { value: count("heavy"), atMost: 0 },
    },
  };
  const document = (entries: unknown[] = [protection, rage]) => {
    const doc = JSON.parse(text);
    doc.items ??= { categories: [] };
    doc.items.categories.push({ id: "shield", label: "Shield" }, { id: "heavy", label: "Heavy armor" });
    doc.sheet.live.conditions.push(
      { id: "protected_attack", label: "Protected attack" },
      { id: "raging", label: "Raging" },
    );
    doc.combat.conditions.push(
      { condition: "protected_attack", effects: ["own-attacks-disadvantage"] },
      { condition: "raging", modifiers: [{ to: "defense", flat: 1 }] },
    );
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      units: { distance: { label: "ft", perCell: 5 } },
      entries,
    });
    return doc;
  };
  const parse = (doc: unknown) => parseRulesetDefinition(doc);
  const parsed = parse(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition = parsed.definition;

  const shield: RulesetSheetItem = { name: "Shield", quantity: 1, worn: true, item: { category: "shield" } };
  const plate: RulesetSheetItem = { name: "Plate", quantity: 1, worn: true, item: { category: "heavy" } };
  const fight = (items: RulesetSheetItem[], first: "attacker" | "holder" = "attacker") => {
    const entries = [protection, rage] as RulesetCatalogEntry[];
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "attacker",
          name: "Attacker",
          side: "enemy",
          block: {
            health: 40,
            defense: 12,
            initiativeModifier: first === "attacker" ? 20 : -20,
            speed: 30,
            actions: [{ id: "club", name: "Club", budget: "action", toHit: 4, range: 5, damage: { flat: 3 } }],
          },
        },
        {
          id: "ally",
          name: "Ally",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
        },
        {
          id: "holder",
          name: "Holder",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 30, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
          items,
        },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [Array(20).fill(0)] },
        placements: { attacker: { x: 1, y: 0 }, ally: { x: 2, y: 0 }, holder: { x: 3, y: 0 } },
      },
    });
  };
  const who = (s: RulesetEncounterState, id: string) => rulesetCombatant(s, id)!;
  const club = (s: RulesetEncounterState) =>
    applyRulesetCombatChoice(definition, s, { actorId: "attacker", optionId: "club", targetIds: ["ally"] }, () => 10)
      .state;
  const protects = (s: RulesetEncounterState) =>
    !!s.window && s.window.waiting.includes("holder") && rulesetWindowOptions(definition, s, "holder").length > 0;
  const offers = (s: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, s, "holder").some((option) => option.label === label);

  // Protection: answered only with a shield worn.
  {
    assert.ok(protects(club(fight([shield]))), "a shield lets Protection answer");
    assert.ok(!protects(club(fight([]))), "no shield, no Protection");
    assert.ok(!protects(club(fight([{ ...shield, worn: false }]))), "a carried shield is not in hand");
    // Read as the window opens, not once when the fight began.
    const later = fight([]);
    who(later, "holder").sheet!.items = [shield];
    assert.ok(protects(club(later)), "a shield taken up mid-fight counts");
  }

  // Rage: offered on its holder's turn only without heavy armor.
  {
    const free = fight([], "holder");
    assert.ok(offers(free, "Rage"), "no armor, Rage is offered");
    assert.ok(!offers(fight([plate], "holder"), "Rage"), "heavy armor keeps Rage off the menu");
    const ruled = applyRulesetCombatChoice(
      definition,
      fight([plate], "holder"),
      {
        actorId: "holder",
        optionId: rulesetCombatOptions(definition, free, "holder").find((o) => o.label === "Rage")!.id,
        targetIds: ["holder"],
      },
      () => 10,
    );
    assert.ok(
      ruled.events.some((event) => event.type === "refused"),
      "choosing it anyway is refused",
    );
    // A stat block has no sheet: nothing holds it back, and the bound check is unaffected without the key.
    const plain = structuredClone(rage);
    delete (plain.mechanics as Record<string, unknown>).usableWhen;
    const without = parse(document([protection, plain]));
    assert.ok(without.ok);
  }

  // Import refusals.
  {
    const refused = (mutate: (entry: typeof rage) => void, pattern: RegExp) => {
      const entry = structuredClone(rage);
      mutate(entry);
      const result = parse(document([protection, entry]));
      assert.ok(!result.ok, `must refuse ${pattern}`);
      assert.match(result.issues.join("; "), pattern);
    };
    refused((entry) => {
      (entry.mechanics.usableWhen as Record<string, unknown>) = { value: count("heavy") };
    }, /at least one of "atLeast" and "atMost"/);
    refused((entry) => {
      (entry.mechanics.usableWhen as Record<string, unknown>) = { value: count("heavy"), atLeast: 2, atMost: 1 };
    }, /never usable/);
    refused((entry) => {
      (entry.mechanics.usableWhen as Record<string, unknown>) = { value: { field: "no_such_field" }, atLeast: 1 };
    }, /no_such_field/);
  }

  // The gate.
  {
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
    const gate =
      "A ruleset whose abilities are usable only while the sheet allows requires schemaVersion 2 and capabilityApi 1.166 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(165) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(166) as never, document()), gate);
    const plain = structuredClone(rage);
    delete (plain.mechanics as Record<string, unknown>).usableWhen;
    const bare = structuredClone(protection);
    delete (bare.mechanics as Record<string, unknown>).usableWhen;
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(165) as never, document([bare, plain])), gate);
  }

  console.log("Usable only while the sheet allows: Protection needs a shield, Rage no heavy armor, gated at 1.166.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
