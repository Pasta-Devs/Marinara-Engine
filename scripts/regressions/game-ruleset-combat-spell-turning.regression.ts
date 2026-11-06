/**
 * Turning a foe's spell aimed at the holder alone back at its caster (Capability API 1.523).
 *
 *   - A save against a spell aimed at its holder alone is thrown with advantage (`against.alone`);
 *     against a burst it is not.
 *   - On the top face, a spell at or under `maxLevel` does nothing to them and lands on its caster
 *     with the caster's own numbers; on any other face, or above `maxLevel`, it does not turn.
 *   - A worn ring turns it as a condition does. Refusals and the install gate.
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
  rulesetItemBook,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-turns-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 523);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>, level: number) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: {
        kind: "attack",
        damageType: "fire",
        range: 120,
        amount: { flat: 5 },
        save: { save: "wis_save", onSuccess: "negates" },
        cost: [{ pool: `slots_${level}`, amount: 1 }],
        ...mechanics,
      },
    }) as unknown as RulesetCatalogEntry;
  const spells = [
    spell("bolt", {}, 3),
    spell("great", {}, 7),
    spell("burst", { area: { shape: "burst", size: 5 } }, 3),
  ];
  const lean = { to: "saves", mode: "advantage", against: { casts: ["spells"], alone: true } };
  const document = (
    edit: (doc: Record<string, any>) => void = () => {},
    turns: Record<string, unknown> = { catalogs: ["spells"], maxLevel: 6 },
  ): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "spell_turning", label: "Spell Turning" });
    doc.combat.conditions.push({ condition: "spell_turning", effects: [], modifiers: [lean], turns });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hand", label: "Hand", count: 2 }] };
    doc.catalogs.push(
      { id: "spells", label: "Spells", feeds: ["spells"], entries: spells },
      {
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          {
            id: "ring",
            label: "Ring of Spell Turning",
            item: {
              category: "gear",
              stack: 1,
              slots: { hand: 1 },
              worn: { modifiers: [lean], turns: { catalogs: ["spells"], maxLevel: 7 } },
            },
          },
        ],
      },
    );
    edit(doc);
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const book = rulesetItemBook(definition, {
    gear: definition.catalogs!.find((one) => one.id === "gear")!.entries!,
  });
  const held = (id: string): RulesetSheetItem => ({
    item: book.itemOf(`gear/${id}`)!.entry.item!,
    quantity: 1,
    worn: true,
    name: id,
  });
  const build = (more: Record<string, unknown> = {}) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: {
        level: 13,
        ac: 12,
        speed: 30,
        hp_max: 60,
        spellcasting_ability: "wis",
        slots_max_3: 4,
        slots_max_7: 1,
      },
      ...more,
    });
  const fight = (foe: { keepsOn?: string[]; items?: RulesetSheetItem[] }): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        {
          id: "mage",
          name: "Mage",
          side: "party",
          build: build({
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        foe.items
          ? { id: "foe", name: "Foe", side: "enemy", build: build(), live: {}, items: foe.items }
          : {
              id: "foe",
              name: "Foe",
              side: "enemy",
              block: {
                health: 100,
                defense: 5,
                initiativeModifier: 0,
                speed: 30,
                actions: [],
                ...(foe.keepsOn ? { keepsOn: foe.keepsOn } : {}),
              } as unknown as RulesetStatBlock,
            },
      ],
      board: {
        grid: { width: 20, height: 5, tiles: Array.from({ length: 5 }, () => Array(20).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, foe: { x: 10, y: 2 } },
      },
    });
    // A sheet always walks in on the party's side; this one stands against the mage.
    const foeCombatant = state.combatants.find((one) => one.id === "foe")!;
    foeCombatant.side = "enemy";
    state.order = ["mage", "foe"];
    state.turn = 0;
    return state;
  };
  const hp = (state: RulesetEncounterState, id = "foe") =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  // The top face for the first `tops` dice, then the lowest.
  const faces = (tops: number) => {
    let left = tops;
    return (sides: number) => (left-- > 0 ? sides : 1);
  };
  const cast = (
    state: RulesetEncounterState,
    label: string,
    roller: (sides: number) => number,
    choice: Record<string, unknown> = { targetIds: ["foe"] },
  ) => {
    const before = hp(state);
    const mine = hp(state, "mage");
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], ...choice },
      roller,
    );
    assert.ok(!step.events.some((one) => one.type === "refused"), JSON.stringify(step.events));
    const turned = step.events.find(
      (one): one is Extract<RulesetCombatEvent, { type: "turnedBack" }> => one.type === "turnedBack",
    );
    const saves = step.events.filter(
      (one): one is Extract<RulesetCombatEvent, { type: "save" }> => one.type === "save",
    );
    return { step, turned, saves, lost: before - hp(step.state), mageLost: mine - hp(step.state, "mage") };
  };

  // ── A creature's condition ──
  {
    const top = cast(fight({ keepsOn: ["spell_turning"] }), "Bolt", faces(2));
    assert.deepEqual([top.turned?.by, top.turned?.sourceId, top.turned?.targetId], ["Spell Turning", "mage", "foe"]);
    assert.equal(top.saves[0]?.mode, "advantage", "aimed at it alone");
    assert.equal(top.lost, 0, "nothing to the foe");
    assert.equal(top.mageLost, 5, "it lands on its caster");
    assert.deepEqual(
      top.saves.map((one) => one.actorId),
      ["foe", "mage"],
      "the caster throws its own save",
    );
    const plain = cast(fight({ keepsOn: ["spell_turning"] }), "Bolt", () => 10);
    assert.equal(plain.turned, undefined, "not the top face");
    assert.equal(plain.saves[0]?.mode, "advantage");
    assert.equal(plain.lost, 5);
    const high = cast(fight({ keepsOn: ["spell_turning"] }), "Great", faces(2));
    assert.equal(high.turned, undefined, "a 7th is past it");
    assert.equal(high.mageLost, 0);
    // A burst catching it alone is not aimed at it alone.
    const area = cast(fight({ keepsOn: ["spell_turning"] }), "Burst", faces(2), { at: { x: 10, y: 2 } });
    assert.equal(area.turned, undefined, "an area");
    assert.equal(area.saves[0]?.mode, undefined, "no advantage against an area");
  }
  // ── A worn ring ──
  {
    const ring = cast(fight({ items: [held("ring")] }), "Great", faces(2));
    assert.equal(ring.turned?.by, "ring");
    assert.equal(ring.saves[0]?.mode, "advantage");
    assert.equal(ring.lost, 0);
    assert.equal(ring.mageLost, 5);
  }

  // ── Refusals ──
  refusedDoc(document(undefined, { catalogs: ["prayers"], maxLevel: 6 }), /Unknown catalog "prayers"/);
  refusedDoc(
    document((doc) => (doc.catalogs.at(-1).entries[0].item.worn.turns.catalogs = ["prayers"])),
    /Unknown catalog "prayers"/,
  );

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose conditions or worn items turn back an entry aimed at their holder alone (turns, against.alone) requires schemaVersion 2 and capabilityApi 1.523 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(522) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(523) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(522) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Spell turning: a save against a spell aimed at its holder alone has advantage; on the top face a spell at or under the limit turns back on its caster, from a condition or a worn ring; never a burst or a higher spell; gated at 1.523.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
