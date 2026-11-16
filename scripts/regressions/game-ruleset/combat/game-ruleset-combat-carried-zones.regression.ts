/**
 * Zones carried with somebody, and copies spaced apart and moved together (Capability API 1.301).
 *
 *   - A zone's `carried`: a burst put on a cell somebody stands on (its caster's own for `own`,
 *     anybody's for `any`) is centred on them wherever they go: 5e's Darkness on a held object.
 *   - An area's `copiesWithin`: copies whose middles each lie within that far of another's, rather
 *     than touching, and a zone of copies its caster moves all together: 5e's Dancing Lights.
 *   - Import refusals and the install gate.
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
  RULESET_ZONE_OPTION_PREFIX,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetSheetBuildSchema,
  rulesetZoneCells,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-carried-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 296);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 0, prepared: true } }],
      mechanics: { kind: "utility", ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Darkness on whatever anybody holds, and on only its caster's own.
  const shadow = spell("shadow", {
    area: { shape: "burst", size: 15 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: { darkness: true }, carried: "any" },
  });
  const cloak = spell("cloak", {
    area: { shape: "burst", size: 15 },
    range: 120,
    zone: { rounds: 10, triggers: [], obscures: { darkness: true }, carried: "own" },
  });
  // Dancing Lights: four 10-foot spheres of dim light, each within 20 feet of another, moved together.
  const dancing = spell("dancing", {
    area: { shape: "burst", size: 10, copies: 4, copiesWithin: 20 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 0, dim: 10 }, move: { budget: "bonus", distance: 60 } },
  });
  // Daylight, small, on a held object: its light goes with its holder.
  const lamp = spell("lamp", {
    area: { shape: "burst", size: 20 },
    range: 120,
    zone: { rounds: 10, triggers: [], lights: { bright: 10, dim: 10 }, carried: "any" },
  });
  const spells = [shadow, cloak, dancing, lamp];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 60, spellcasting_ability: "wis" },
      lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
    });
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: {
            health: 100,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
          },
        },
      ],
      board: {
        grid: { width: 30, height: 15, tiles: Array.from({ length: 15 }, () => Array(30).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 7 }, a: { x: 12, y: 7 } },
        light: "dark",
      },
    });
    state.order = ["mage", "a"];
    state.turn = 0;
    return state;
  };
  const cast = (state: RulesetEncounterState, label: string, at: RulesetCombatCell, also?: RulesetCombatCell[]) => {
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: option.id, targetIds: [], at, ...(also ? { also } : {}) },
      () => 10,
    );
  };
  const ok = (step: RulesetCombatStep) => {
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const mage = (state: RulesetEncounterState) => rulesetCombatant(state, "mage")!;
  const zone = (state: RulesetEncounterState, label: string) => mage(state).zones!.find((one) => one.label === label)!;
  const covers = (state: RulesetEncounterState, label: string, x: number, y = 7) =>
    rulesetZoneCells(state, mage(state), zone(state, label)).some((cell) => cell.x === x && cell.y === y);
  const light = (state: RulesetEncounterState, x: number, y = 7) => rulesetLightAt(definition, state, { x, y });

  // ── Darkness on a foe's held thing goes where they go ──
  {
    const dark = ok(cast(fight(), "Shadow", { x: 12, y: 7 }));
    assert.equal(zone(dark.state, "Shadow").on, "a");
    assert.ok(covers(dark.state, "Shadow", 12));
    rulesetCombatant(dark.state, "a")!.x = 20;
    assert.ok(covers(dark.state, "Shadow", 20), "around them where they went");
    assert.ok(covers(dark.state, "Shadow", 23));
    assert.ok(!covers(dark.state, "Shadow", 12), "not where they were");
    // On an empty cell it stays put.
    const ground = ok(cast(fight(), "Shadow", { x: 6, y: 3 }));
    assert.equal(zone(ground.state, "Shadow").on, undefined);
    assert.ok(covers(ground.state, "Shadow", 6, 3));
    // Only on its caster's own, for `own`.
    const theirs = ok(cast(fight(), "Cloak", { x: 12, y: 7 }));
    assert.equal(zone(theirs.state, "Cloak").on, undefined, "not on a foe's");
    const mine = ok(cast(fight(), "Cloak", { x: 2, y: 7 }));
    assert.equal(zone(mine.state, "Cloak").on, "mage");
    mage(mine.state).x = 8;
    assert.ok(covers(mine.state, "Cloak", 10) && !covers(mine.state, "Cloak", 2), "carried by its caster");
  }

  // ── A carried light shines from its holder ──
  {
    const lit = ok(cast(fight(), "Lamp", { x: 12, y: 7 }));
    rulesetCombatant(lit.state, "a")!.x = 22;
    assert.equal(light(lit.state, 22), "bright", "where its holder went");
    assert.equal(light(lit.state, 25), "dim");
    assert.equal(light(lit.state, 12), "dark", "not where it was cast");
  }

  // ── Dancing Lights: four lights apart, moved together ──
  {
    const four = [
      { x: 14, y: 7 },
      { x: 18, y: 7 },
      { x: 22, y: 7 },
    ];
    const lit = ok(cast(fight(), "Dancing", { x: 10, y: 7 }, four));
    assert.deepEqual(zone(lit.state, "Dancing").also, four);
    for (const x of [8, 10, 12, 16, 20, 24]) assert.equal(light(lit.state, x), "dim", `dim at ${x}`);
    assert.equal(light(lit.state, 25), "dark", "past the last");
    // Too far from every other one: refused.
    const apart = cast(fight(), "Dancing", { x: 10, y: 7 }, [{ x: 15, y: 7 }]);
    assert.ok(
      apart.events.some((one) => one.type === "refused"),
      "25 feet from any other",
    );
    // Within 20 feet of the second, not the first: allowed.
    ok(
      cast(fight(), "Dancing", { x: 10, y: 7 }, [
        { x: 14, y: 7 },
        { x: 18, y: 7 },
      ]),
    );
    // Moved: all four go the same way.
    const state = lit.state;
    state.turn = 0;
    const moved = ok(
      applyRulesetCombatChoice(
        definition,
        state,
        {
          actorId: "mage",
          optionId: `${RULESET_ZONE_OPTION_PREFIX}${zone(state, "Dancing").actionId}`,
          targetIds: [],
          to: { x: 10, y: 10 },
        },
        () => 10,
      ),
    );
    assert.deepEqual(zone(moved.state, "Dancing").also, [
      { x: 14, y: 10 },
      { x: 18, y: 10 },
      { x: 22, y: 10 },
    ]);
    assert.equal(light(moved.state, 22, 10), "dim", "the last light moved too");
    assert.equal(light(moved.state, 22, 7), "dark", "and is gone from where it was");
  }

  // ── Refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(spell("odd", mechanics));
      });
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 10, copiesWithin: 20 },
        range: 60,
        zone: { rounds: 1, triggers: [], lights: { bright: 0, dim: 10 } },
      }),
      /copiesWithin/,
    );
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 10 },
        range: 60,
        zone: { rounds: 1, triggers: [], obscures: {}, carried: "any", move: { budget: "bonus", distance: 30 } },
      }),
      /carried with somebody/,
    );
    refusedDoc(
      withSpell({ area: { shape: "cone", size: 15 }, zone: { rounds: 1, triggers: [], obscures: {}, carried: "own" } }),
      /carried with somebody/,
    );
    refusedDoc(
      withSpell({
        area: { shape: "burst", size: 10, copies: 2 },
        range: 60,
        zone: { rounds: 1, triggers: [], obscures: {}, drift: { distance: 10 } },
      }),
      /moved all together/,
    );
  }

  // ── A scroll of Dancing Lights spaces its lights out too ──
  {
    const scroll = (area: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
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
                  kind: "utility",
                  budget: "action",
                  range: 120,
                  area,
                  zone: { rounds: 10, triggers: [], lights: { bright: 0, dim: 10 } },
                  consumes: true,
                },
              },
            },
          ],
        });
      });
    parsed(scroll({ shape: "burst", size: 10, copies: 4, copiesWithin: 20 }));
    refusedDoc(scroll({ shape: "burst", size: 10, copiesWithin: 20 }), /copiesWithin/);
  }

  // ── The gate ──
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
      "A ruleset with zones carried with somebody, or copies set down apart, requires schemaVersion 2 and capabilityApi 1.301 or newer";
    for (const entry of [shadow, dancing]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [entry] });
      assert.equal(getCapabilityPackageInstallIssue(manifest(300) as never, doc), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(301) as never, doc), gate, entry.id);
    }
    // The ruleset's own carried light is no zone carried with somebody.
    const torch = JSON.parse(fiveEText) as Record<string, any>;
    torch.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    torch.combat.sight = { darkness: { seeIn: ["darkvision"], carried: { bright: 20, dim: 20 } } };
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(300) as never, torch), gate);
  }

  console.log(
    "Carried zones: Darkness on a foe's held thing follows them, on its caster's own only for own, Dancing Lights' four lights each within 20 feet of another and moved together; refusals; gated at 1.301.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
