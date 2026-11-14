/**
 * Draining blows (Capability API 1.281).
 *
 *   - `drain` on a creature's action: an aboleth's Psychic Drain, whose maker regains hit points equal
 *     to the damage its target takes. Nothing comes off the target's maximum.
 *   - `drain.share` and `drain.damageType` on a catalog entry: Vampiric Touch, half of the necrotic
 *     damage dealt, rounded down; damage of another type gives nothing back.
 *   - A bestiary creature's drain reaches the fight too (fixed after 1.281).
 *   - What comes back is what was dealt, after a resistance halved it, and never above the maximum.
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
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-drain-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 276);
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
  const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
    const result = parseRulesetDefinition(fiveE(edit));
    assert.equal(result.ok, false, `expected a refusal matching ${message}`);
    assert.ok(
      !result.ok && result.issues.some((issue) => message.test(issue)),
      !result.ok ? result.issues.join("; ") : "",
    );
  };
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 3, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const touch = spell("touch", {
    kind: "attack",
    autoHit: true,
    amount: { flat: 9 },
    damageType: "necrotic",
    drain: { share: 0.5, damageType: "necrotic" },
  });
  const scorch = spell("scorch", {
    kind: "attack",
    autoHit: true,
    amount: { flat: 9 },
    damageType: "fire",
    drain: { share: 0.5, damageType: "necrotic" },
  });
  const spells = [touch, scorch];
  const definition = parsed(
    fiveE((doc) => doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells })),
  );
  const combat = definition.combat!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
    fields: {
      level: 9,
      ac: 12,
      speed: 30,
      hp_max: 60,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 3,
    },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const drainAction = {
    name: "Psychic Drain",
    budget: "action",
    autoHit: true,
    damage: { count: 3, sides: 6, flat: 0, type: "psychic" },
    drain: {},
  };
  const fight = (
    options: { mageHp?: number; foe?: Partial<RulesetStatBlock>; foeHealth?: number } = {},
  ): RulesetEncounterState => {
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
          build,
          live: { pools: { hp: { value: options.mageHp ?? 30 } } },
          catalogs: { spells },
        },
        {
          id: "foe",
          name: "Aboleth",
          side: "enemy",
          block: {
            health: 135,
            defense: 17,
            initiativeModifier: 0,
            speed: 10,
            actions: [drainAction as never],
            ...options.foe,
          } as RulesetStatBlock,
        },
      ],
    });
    if (options.foeHealth !== undefined) rulesetCombatant(state, "foe")!.health!.value = options.foeHealth;
    state.order = ["mage", "foe"];
    state.turn = 0;
    return state;
  };
  const roll = () => 4;
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, rulesetCombatant(state, id)!);
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const go = (state: RulesetEncounterState, actor: string, label: string, targetIds: string[]) => {
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `${actor} has no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId: actor, optionId: option.id, targetIds }, roll);
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    return step;
  };

  // ── Psychic Drain: the aboleth regains all it dealt, and the target keeps its maximum ──
  {
    const state = fight({ foeHealth: 100 });
    state.turn = 1;
    const before = health(state, "mage");
    const step = go(state, "foe", "Psychic Drain", ["mage"]);
    const after = health(step.state, "mage");
    const dealt = before.value - after.value;
    assert.ok(dealt > 0, "the drain hurt");
    assert.equal(after.max, before.max, "nothing comes off the target's maximum");
    assert.equal(health(step.state, "foe").value, 100 + dealt, "the aboleth regains what it dealt");
    const heal = step.events.find((one) => one.type === "heal" && one.targetId === "foe");
    assert.ok(heal, "and the log says so");
  }

  // ── A bestiary creature's drain reaches the fight as a hand-built block's does ──
  {
    const withAboleth = parsed(
      fiveE((doc) => {
        doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
        const creatures = doc.catalogs.find((one: { holds?: string }) => one.holds === "creatures");
        const aboleth = structuredClone(creatures.entries.find((one: { id: string }) => one.id === "thorn-lurker"));
        aboleth.id = "aboleth";
        aboleth.label = "Aboleth";
        aboleth.creature.actions = [
          {
            id: "psychic_drain",
            name: "Psychic Drain",
            budget: "action",
            autoHit: true,
            damage: { dice: "3d6", type: "psychic" },
            drain: {},
          },
        ];
        creatures.entries.push(aboleth);
      }),
    );
    const creatures = withAboleth.catalogs.find((one) => one.holds === "creatures")!;
    const state = createRulesetEncounter({
      definition: withAboleth,
      seed: 1,
      roller: () => 10,
      bestiary: { [creatures.id]: creatures.entries },
      combatants: [
        { id: "mage", name: "Mage", side: "party", build, live: {} },
        { id: "foe", name: "Aboleth", side: "enemy", creature: { catalogId: creatures.id, entryId: "aboleth" } },
      ],
    });
    state.order = ["mage", "foe"];
    state.turn = 1;
    const foe = rulesetCombatant(state, "foe")!;
    assert.deepEqual(
      foe.actions.find((one) => one.label === "Psychic Drain")?.drain,
      {},
      "the catalog creature's action keeps its drain",
    );
    foe.health!.value = Math.max(1, foe.health!.max - 30);
    const before = rulesetCombatHealth(withAboleth, withAboleth.combat!, foe).value;
    const option = rulesetCombatOptions(withAboleth, state, "foe").find((one) => one.label === "Psychic Drain")!;
    const step = applyRulesetCombatChoice(
      withAboleth,
      state,
      { actorId: "foe", optionId: option.id, targetIds: ["mage"] },
      roll,
    );
    assert.equal(refused(step), undefined, JSON.stringify(refused(step)));
    const heal = step.events.find((one) => one.type === "heal" && one.targetId === "foe");
    assert.ok(heal, "the aboleth regains what it dealt");
    assert.ok(
      rulesetCombatHealth(withAboleth, withAboleth.combat!, rulesetCombatant(step.state, "foe")!).value > before,
    );
  }

  // ── Never above its maximum ──
  {
    const state = fight({ foeHealth: 134 });
    state.turn = 1;
    const step = go(state, "foe", "Psychic Drain", ["mage"]);
    assert.equal(health(step.state, "foe").value, 135);
  }

  // ── A resisted blow gives back what it dealt: half of 9 is 4, and half of that 2 ──
  {
    const state = fight({ mageHp: 30, foe: { resist: ["necrotic"] } as never });
    const step = go(state, "mage", "Touch", ["foe"]);
    assert.equal(health(step.state, "foe").value, 135 - 4, "the resistance halved it");
    assert.equal(health(step.state, "mage").value, 32, "and half of what was dealt comes back");
  }

  // ── Vampiric Touch: half the necrotic, rounded down; fire gives nothing back ──
  {
    const state = fight({ mageHp: 30 });
    const step = go(state, "mage", "Touch", ["foe"]);
    assert.equal(health(step.state, "foe").value, 135 - 9, "the touch dealt 9");
    assert.equal(health(step.state, "mage").value, 34, "half of 9, rounded down, comes back");
    const other = go(fight({ mageHp: 30 }), "mage", "Scorch", ["foe"]);
    assert.equal(health(other.state, "foe").value, 135 - 9);
    assert.equal(health(other.state, "mage").value, 30, "fire is not what it drains");
  }

  // ── Import refusals ──
  {
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "x", label: "X", feeds: ["spells"], entries: [spell("t", mechanics)] });
    };
    refusedDoc(withSpell({ kind: "utility", drain: {} }), /A drain gives back what the blow dealt, so it deals damage/);
    refusedDoc(
      withSpell({ kind: "heal", amount: { flat: 5 }, drain: {} }),
      /A drain gives back what the blow dealt, so it deals damage/,
    );
    refusedDoc(withSpell({ kind: "attack", amount: { flat: 5 }, drain: { share: 0 } }), /share/);
    refusedDoc(withSpell({ kind: "attack", amount: { flat: 5 }, drain: { share: 1.5 } }), /share/);
    const withCreature = (action: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({
        id: "beasts",
        label: "Beasts",
        holds: "creatures",
        entries: [
          {
            id: "d",
            label: "D",
            creature: { health: 10, defense: 10, initiativeModifier: 0, speed: 30, actions: [action], tier: "cr_0" },
          },
        ],
      });
    };
    parsed(
      fiveE(
        withCreature({
          id: "drain",
          name: "Drain",
          budget: "action",
          autoHit: true,
          damage: { dice: "3d6", type: "psychic" },
          drain: {},
        }),
      ),
    );
    refusedDoc(
      withCreature({ id: "drain", name: "Drain", budget: "action", autoHit: true, drain: {} }),
      /A drain gives back what the blow dealt, so it deals damage/,
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
      "A ruleset with a blow whose maker regains the damage it dealt requires schemaVersion 2 and capabilityApi 1.281 or newer";
    const docs: Array<[string, Record<string, any>]> = [
      ["spell", fiveE((doc) => doc.catalogs.push({ id: "x", label: "X", entries: [touch] }))],
      [
        "creature",
        fiveE((doc) =>
          doc.catalogs.push({
            id: "x",
            label: "X",
            entries: [{ id: "a", label: "A", creature: { actions: [drainAction] } }],
          }),
        ),
      ],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(280) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(281) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(280) as never, fiveE()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset draining blows: an aboleth's Psychic Drain gives back all it dealt and Vampiric Touch half its necrotic, never past the maximum, and nothing comes off the target's.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
