/**
 * Catalog variants (Capability API 1.769).
 *
 *   - A catalog entry lists `variants`, other entries of its catalog that each say `variantOf` back:
 *     Chromatic Orb's fire and cold.
 *   - A builder step offers only the parent; a variant is never picked on its own.
 *   - A sheet row of the parent is each variant in a fight, by the variant's label, and casting one
 *     does what that variant does. The fight keeps the variants of a row's entry.
 *   - A creature's spell that has variants is each of them too, every one cast from the spell's
 *     own uses.
 *   - Refused shapes; the install gate.
 *   - The fight pane keeps a spell's row open through the steps of the way picked under it, a target
 *     and a form for Polymorph (unwilling), since that way has no row of its own (playtest 2026-10-27).
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
  rulesetBuilderOptions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-variants-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetMenuGroups, rulesetMenuVariantName, rulesetMenuVariants } =
  await import("../../packages/client/src/lib/ruleset-combat-menu.js");
const t = ((key: string, params: Record<string, unknown> = {}) =>
  `${key}${Object.keys(params).length ? JSON.stringify(params) : ""}`) as never;

try {
  assert.ok(supportedCapabilityApi.minor >= 769);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  // Written as a cantrip, so the test needs no slots to cast it.
  const row = { list: "spells", values: { name: "Chromatic Orb", level: 0, prepared: true } };
  const orb = (type: string) => ({
    id: `chromatic-orb-${type}`,
    label: `Chromatic Orb (${type})`,
    variantOf: "chromatic-orb",
    rows: [row],
    mechanics: { kind: "attack", attackRoll: true, range: 90, amount: { dice: "3d8" }, damageType: type },
  });
  const entries = () => [
    {
      id: "chromatic-orb",
      label: "Chromatic Orb",
      rows: [row],
      variants: ["chromatic-orb-fire", "chromatic-orb-cold"],
    },
    orb("fire"),
    orb("cold"),
  ];
  const document = (spells: unknown[]) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    return doc;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const result = parseRulesetDefinition(document(entries()));
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  const definition: RulesetDefinition = result.definition;
  const spells = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];

  // ── A builder step offers only the parent ──
  {
    const offered = rulesetBuilderOptions(
      definition,
      { id: "spells", label: "Spells", kind: "catalog", catalog: "spells", min: 1, max: 1 } as never,
      { picks: {} } as never,
      { spells },
    );
    assert.deepEqual(
      offered.map((entry) => entry.id),
      ["chromatic-orb"],
    );
  }

  // ── A row of the parent is each variant in a fight ──
  {
    const parent = spells.find((entry) => entry.id === "chromatic-orb")!;
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "wizard",
          name: "Wizard",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 18, wis: 10, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 30 },
            lists: { spells: rowsFromCatalogEntry("spells", parent).map((one) => one.row) },
          }),
          live: {},
          // Every entry of the catalog, as a fight is handed them: only the row's own and its
          // variants are kept.
          catalogs: { spells },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ id: "smash", label: "Smash", kind: "attack", budget: "action", toHit: 4, damage: { flat: 3 } }],
          },
        },
      ],
    });
    state.order = ["wizard", "brute"];
    state.turn = 0;
    const menu = rulesetCombatOptions(definition, state, "wizard");
    const labels = menu.map((option) => option.label);
    assert.ok(labels.includes("Chromatic Orb (fire)"), labels.join(", "));
    assert.ok(labels.includes("Chromatic Orb (cold)"), labels.join(", "));
    // The parent has nothing of its own to do, so it is not on the menu.
    assert.ok(!labels.includes("Chromatic Orb"), labels.join(", "));
    // Each names the parent's action, so a menu can fold them under it (re-test 9); with the parent
    // not offered, under one button of their own named after it (re-test 10: Command).
    const kinds = menu.filter((option) => option.label.startsWith("Chromatic Orb ("));
    assert.ok(
      kinds.length === 2 && kinds.every((option) => !!option.variantOf),
      JSON.stringify(kinds.map((o) => o.variantOf)),
    );
    const shown = (options: unknown[]) =>
      rulesetMenuGroups(options as never).flatMap((group) => group.options.map((option) => option.label));
    assert.ok(kinds.every((option) => option.variantName === "Chromatic Orb"));
    const alone = shown(menu).filter((label) => label.startsWith("Chromatic Orb"));
    assert.deepEqual(alone, ["Chromatic Orb (fire)"], "no parent on the menu: the first stands for both");
    const fire = menu.find((option) => option.label === "Chromatic Orb (fire)")!;
    assert.deepEqual(
      rulesetMenuVariants(menu as never, fire as never).map((option) => option.label),
      ["Chromatic Orb (fire)", "Chromatic Orb (cold)"],
    );
    assert.equal(rulesetMenuVariantName(menu as never, fire as never, t), "Chromatic Orb", "and is named after it");
    // Readying it folds the same way: one Ready Command, not five.
    const readies = ["Halt", "Flee"].map((way) => ({
      id: `ready:command-${way}@comes`,
      kind: "standard",
      label: "ready",
      budget: "action",
      targets: { side: "self", count: 0 },
      ready: { optionId: `command-${way}`, label: `Command (${way})`, on: "comes" },
      variantOf: "ready:command@comes",
      variantName: "Command",
    }));
    const readyButtons = rulesetMenuGroups(readies as never).flatMap((group) => group.options);
    assert.equal(readyButtons.length, 1);
    assert.match(rulesetMenuVariantName(readies as never, readyButtons[0]!, t)!, /readyComes\{"option":"Command"\}/);
    const parentOption = { ...kinds[0]!, id: kinds[0]!.variantOf!, label: "Chromatic Orb", variantOf: undefined };
    const folded = shown([...menu, parentOption]);
    assert.ok(
      folded.includes("Chromatic Orb") && !folded.some((label) => label.startsWith("Chromatic Orb (")),
      folded.join(", "),
    );
    assert.deepEqual(
      rulesetMenuVariants([...menu, parentOption] as never, parentOption as never).map((option) => option.label),
      ["Chromatic Orb", "Chromatic Orb (fire)", "Chromatic Orb (cold)"],
    );
    const cold = menu.find((option) => option.label === "Chromatic Orb (cold)")!;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "wizard", optionId: cold.id, targetIds: ["brute"] },
      () => 10,
    );
    const damage = step.events.filter(
      (event): event is Extract<RulesetCombatEvent, { type: "damage" }> => event.type === "damage",
    );
    assert.ok(damage.length > 0, JSON.stringify(step.events.slice(-4)));
    assert.equal(damage[0]!.damageType, "cold", "the cold one deals cold");
  }

  // ── A creature's spell is each of its variants, from one count of uses ──
  {
    const doc = document(entries());
    doc.catalogs.push({
      id: "foes",
      label: "Foes",
      holds: "creatures",
      entries: [
        {
          id: "mage",
          label: "Mage",
          creature: {
            tier: "cr_5",
            health: 40,
            defense: 12,
            initiativeModifier: 20,
            actions: [{ id: "staff", name: "Staff", budget: "action", damage: { flat: 1 } }],
            spellcasting: { toHit: 6, spells: [{ entry: "spells/chromatic-orb", uses: { per: "day", count: 1 } }] },
          },
        },
      ],
    });
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    const rules = parsed.definition;
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      bestiary: Object.fromEntries(rules.catalogs!.map((catalog) => [catalog.id, catalog.entries ?? []])),
      combatants: [
        { id: "mage", name: "Mage", side: "enemy", creature: { catalogId: "foes", entryId: "mage" } },
        {
          id: "hero",
          name: "Hero",
          side: "party",
          block: { health: 100, defense: 10, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
    } as never);
    state.order = ["mage", "hero"];
    state.turn = 0;
    const orbs = () =>
      rulesetCombatOptions(rules, state, "mage")
        .map((option) => option.label)
        .filter((label) => label.startsWith("Chromatic Orb"));
    assert.deepEqual(orbs(), ["Chromatic Orb (fire)", "Chromatic Orb (cold)"], "each kind, by its label");
    const fire = rulesetCombatOptions(rules, state, "mage").find((option) => option.label === "Chromatic Orb (fire)")!;
    const cast = applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "mage", optionId: fire.id, targetIds: ["hero"] },
      () => 10,
    );
    const damage = cast.events.find(
      (event): event is Extract<RulesetCombatEvent, { type: "damage" }> => event.type === "damage",
    );
    assert.equal(damage?.damageType, "fire", JSON.stringify(cast.events.slice(-4)));
    // Its one use a day is spent, whichever kind took it.
    cast.state.combatants.find((one) => one.id === "mage")!.budgets.action = 1;
    Object.assign(state, cast.state);
    assert.deepEqual(orbs(), [], "the one use is gone for every kind");
  }

  // ── Refused shapes ──
  {
    refused(
      document([{ ...entries()[0], variants: ["chromatic-orb-fire", "nothing"] }, orb("fire")]),
      /Unknown entry "nothing"/,
    );
    refused(
      document([{ ...entries()[0], variants: ["chromatic-orb-fire"] }, orb("fire"), orb("cold")]),
      /does not list "chromatic-orb-cold"/,
    );
    refused(
      document([entries()[0], { ...orb("fire"), variantOf: undefined }, orb("cold")]),
      /does not say variantOf "chromatic-orb"/,
    );
    refused(document([{ ...orb("fire"), variants: ["chromatic-orb-cold"] }]), /no variants of its own/);
    refused(document([{ ...entries()[0], variants: ["chromatic-orb"] }]), /no variant of itself/);
  }

  // ── The install gate ──
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
      "A ruleset with a catalog entry that has variants (variants, variantOf) requires schemaVersion 2 and capabilityApi 1.769 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(768) as never, document(entries())), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(769) as never, document(entries())), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(768) as never, document([])), gate);
  }

  console.log(
    "Catalog variants: a builder offers only the parent, a parent's row is each variant in a fight by its own label, the fight keeps them; refusals; gated at 1.769.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

// ── The pane's row stays open for the way picked under it ──
{
  const menu = readFileSync(
    fileURLToPath(new URL("../../packages/client/src/components/game/RulesetCombatMenu.tsx", import.meta.url)),
    "utf8",
  );
  assert.match(menu, /const open = openId !== undefined && ways\.some\(\(way\) => way\.id === openId\);/);
  assert.doesNotMatch(menu, /const open = openId === option\.id;/);
}
