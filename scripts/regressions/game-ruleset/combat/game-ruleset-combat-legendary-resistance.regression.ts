/**
 * Legendary Resistance (Capability API 1.317): "If the dragon fails a saving throw, it can choose to
 * succeed instead", so many times.
 *
 *   - A creature's `legendaryResistance` turns that many failed saves into successes in a fight,
 *     each told with how many are left; then its saves fail as they fall.
 *   - A save it makes, or one a condition fails outright, as well; never while it is down.
 *   - The bestiary carries it, import refuses a bad count, and the install gate.
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
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-legendary-resistance-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 317);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  // A bolt saved against for half, and a hold saved against or held.
  const spells = [
    spell("bolt", { kind: "attack", range: 60, amount: { flat: 10 }, save: { save: "dex_save", onSuccess: "half" } }),
    spell("hold", {
      kind: "debuff",
      range: 60,
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "paralyzed", duration: { rounds: 10 } }],
    }),
  ];
  const wyrm = (resistances?: number): RulesetStatBlock =>
    ({
      health: 200,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      saves: { dex_save: 0, wis_save: 0 },
      ...(resistances !== undefined ? { legendaryResistance: resistances } : {}),
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 6, flat: 2 } }],
    }) as unknown as RulesetStatBlock;
  let d20 = 2;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const fight = (resistances?: number): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        { id: "w", name: "Wyrm", side: "enemy", block: wyrm(resistances) },
        // Somebody still standing when the wyrm is down.
        { id: "v", name: "Vole", side: "enemy", block: wyrm() },
      ],
    });
    state.order = ["mage", "w", "v"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string): RulesetCombatStep => {
    rulesetCombatant(state, "mage")!.budgets.action = 1;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: ["w"] },
      roll,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const resisted = (events: RulesetCombatEvent[]) =>
    events.flatMap((one) => (one.type === "legendaryResistance" ? [[one.actorId, one.save, one.left]] : []));
  const hp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, "w")!).value;
  const held = (state: RulesetEncounterState) =>
    rulesetCombatant(state, "w")!.tracked.some((one) => one.condition === "paralyzed");

  // ── Two failed saves turned into successes, then they fail as they fall ──
  {
    d20 = 2;
    let state = fight(2);
    const first = cast(state, "Bolt");
    assert.deepEqual(resisted(first.events), [["w", "dex_save", 1]]);
    const save = first.events.find((one) => one.type === "save");
    assert.ok(save && save.type === "save" && !save.success, "the roll itself failed and is told so");
    assert.equal(hp(first.state), 195, "half, as on a success");
    assert.equal(rulesetCombatant(first.state, "w")!.legendaryResisted, 1);
    state = first.state;
    const second = cast(state, "Bolt");
    assert.deepEqual(resisted(second.events), [["w", "dex_save", 0]]);
    assert.equal(hp(second.state), 190);
    const third = cast(second.state, "Bolt");
    assert.deepEqual(resisted(third.events), [], "none left");
    assert.equal(hp(third.state), 180, "the whole of it");
    // A save it makes spends nothing.
    d20 = 18;
    const made = cast(fight(2), "Bolt");
    assert.deepEqual(resisted(made.events), []);
    assert.equal(rulesetCombatant(made.state, "w")!.legendaryResisted, undefined);
    // Without it, a failure stands.
    d20 = 2;
    const plain = cast(fight(), "Bolt");
    assert.deepEqual(resisted(plain.events), []);
    assert.equal(hp(plain.state), 190);
  }

  // ── A condition it shrugs off; a save a condition fails outright; never while down ──
  {
    d20 = 2;
    const shrugged = cast(fight(1), "Hold");
    assert.deepEqual(resisted(shrugged.events), [["w", "wis_save", 0]]);
    assert.equal(held(shrugged.state), false, "not paralyzed");
    const caught = cast(fight(), "Hold");
    assert.equal(held(caught.state), true);
    // Paralyzed, it fails a Dexterity save outright, and turns even that.
    const frozen = fight(1);
    rulesetCombatant(frozen, "w")!.tracked.push({ condition: "paralyzed", rounds: null, kept: true } as never);
    d20 = 20;
    const outright = cast(frozen, "Bolt");
    const automatic = outright.events.find((one) => one.type === "save");
    assert.ok(automatic && automatic.type === "save" && automatic.automatic && !automatic.success);
    assert.deepEqual(resisted(outright.events), [["w", "dex_save", 0]]);
    assert.equal(hp(outright.state), 195);
    // Down, it has nothing to choose with.
    d20 = 2;
    const down = fight(3);
    const wyrmDown = rulesetCombatant(down, "w")!;
    wyrmDown.down = true;
    wyrmDown.defeated = false;
    const helpless = cast(down, "Hold");
    assert.deepEqual(resisted(helpless.events), []);
  }

  // ── From a bestiary, and refused when it is not a count ──
  {
    const withWyrm = parsed(
      fiveE((doc) => {
        const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
        const entry = structuredClone(creatures.entries[0]);
        entry.id = "wyrm";
        entry.creature.legendaryResistance = 3;
        creatures.entries.push(entry);
      }),
    );
    const bestiary = Object.fromEntries(
      (withWyrm.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "creatures" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );
    const catalogId = (withWyrm.catalogs ?? []).find((catalog) => catalog.holds === "creatures")!.id;
    const state = createRulesetEncounter({
      definition: withWyrm,
      seed: 1,
      bestiary,
      combatants: [{ id: "w", name: "Wyrm", side: "enemy", creature: { catalogId, entryId: "wyrm" } }],
    });
    assert.equal(rulesetCombatant(state, "w")!.block?.legendaryResistance, 3);
    for (const bad of [0, 1.5, 21]) {
      const result = parseRulesetDefinition(
        fiveE((doc) => {
          const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
          creatures.entries[0].creature.legendaryResistance = bad;
        }),
      );
      assert.equal(result.ok, false, `${bad} is refused`);
    }
  }

  // ── An item's use no bigger than it reaches (a scroll of Resilient Sphere) ──
  const scrolled = (use: Record<string, unknown>, sized = true) =>
    fiveE((doc) => {
      if (sized) {
        doc.combat.sizes = {
          order: ["small", "medium", "large", "huge"].map((id) => ({ id, label: id })),
          default: "medium",
        };
      }
      doc.items = {
        ...(doc.items ?? {}),
        categories: [...(doc.items?.categories ?? []), { id: "gear", label: "Gear" }],
      };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "scroll",
            label: "Scroll",
            item: {
              category: "gear",
              use: {
                kind: "debuff",
                budget: "action",
                range: 30,
                saveDifficulty: 15,
                save: { save: "dex_save", onSuccess: "negates" },
                consumes: true,
                ...use,
              },
            },
          },
        ],
      });
    });
  {
    parsed(scrolled({ targetsUpTo: "large" }));
    const unknown = parseRulesetDefinition(scrolled({ targetsUpTo: "colossal" }));
    assert.ok(
      !unknown.ok && unknown.issues.some((issue) => issue.includes('Unknown size "colossal"')),
      JSON.stringify(unknown),
    );
    const unsized = parseRulesetDefinition(scrolled({ targetsUpTo: "large" }, false));
    assert.ok(
      !unsized.ok && unsized.issues.some((issue) => issue.includes('"targetsUpTo" reads combat.sizes')),
      JSON.stringify(unsized.ok ? "" : unsized.issues),
    );
    const area = parseRulesetDefinition(scrolled({ targetsUpTo: "large", area: { shape: "burst", size: 10 } }));
    assert.ok(
      !area.ok && area.issues.some((issue) => issue.includes("not an area")),
      JSON.stringify(area.ok ? "" : area.issues),
    );
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
      "A ruleset with a creature's legendary resistances or an item use's targetsUpTo requires schemaVersion 2 and capabilityApi 1.317 or newer";
    const doc = fiveE((doc) => {
      const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
      creatures.entries[0].creature.legendaryResistance = 3;
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(316) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(317) as never, doc), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(316) as never, fiveE()), gate, "the plain 5e example");
    assert.equal(getCapabilityPackageInstallIssue(manifest(316) as never, scrolled({ targetsUpTo: "large" })), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(317) as never, scrolled({ targetsUpTo: "large" })), gate);
    assert.notEqual(
      getCapabilityPackageInstallIssue(manifest(316) as never, scrolled({})),
      gate,
      "a scroll with no limit",
    );
  }

  console.log(
    "Ruleset Legendary Resistance: failed saves turned into successes while uses last, from a bestiary, gated.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
