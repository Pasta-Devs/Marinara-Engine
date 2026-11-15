/**
 * Cures (Capability API 1.176).
 *
 *   - `ends`: the named conditions come off the target in the order named, at most `count` of them
 *     (Lesser Restoration), and it is offered only against somebody holding one.
 *   - `stabilizes`: a dying target stops rolling (Spare the Dying), offered only against the dying.
 *   - `revives`: aimed only at somebody dead no longer than `withinRounds`, back at its amount
 *     (Revivify).
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCanRevive,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cures-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 171);
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
      mechanics: { kind: "utility", targets: "ally", range: 0, ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  // Lesser Restoration: one of four, the first named that is held.
  const restoration = spell("restoration", {
    ends: { conditions: ["blinded", "deafened", "paralyzed", "poisoned"], count: 1 },
  });
  // Every one named, no count.
  const purge = spell("purge", { ends: { conditions: ["blinded", "poisoned"] } });
  const steady = spell("steady", { stabilizes: true });
  const revivify = spell("revivify", { revives: { withinRounds: 10, health: { flat: 1 } } });
  const spells = [restoration, purge, steady, revivify];
  const block: RulesetStatBlock = { health: 30, defense: 5, initiativeModifier: 0, speed: 30, actions: [] };
  let faces = 10;
  const roll = () => faces;
  const fight = (fighterLive: Record<string, unknown> = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { spells },
      combatants: [
        {
          id: "c",
          name: "Cleric",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 4 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells },
        },
        {
          id: "f",
          name: "Fighter",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
            fields: { level: 5, ac: 16, speed: 30, hp_max: 44 },
          }),
          live: fighterLive,
          catalogs: {},
        },
        { id: "e", name: "Ogre", side: "enemy", block },
      ],
    });
    state.order = ["c", "f", "e"];
    state.turn = 0;
    return state;
  };
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "c").find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${rulesetCombatOptions(definition, state, "c").map((one) => one.label)}`);
    return option;
  };
  const targetsOf = (state: RulesetEncounterState, label: string) =>
    rulesetOptionTargets(definition, state, "c", optionOf(state, label));
  const cast = (state: RulesetEncounterState, label: string, target = "f") =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "c", optionId: optionOf(state, label).id, targetIds: [target] },
      roll,
    );
  const hold = (state: RulesetEncounterState, ...conditions: string[]) => {
    const fighter = rulesetCombatant(state, "f")!;
    for (const condition of conditions) fighter.tracked.push({ condition, rounds: null });
    return state;
  };
  const held = (state: RulesetEncounterState, id = "f") =>
    rulesetCombatant(state, id)!.tracked.map((entry) => entry.condition);
  const cured = (step: { events: RulesetCombatEvent[] }) =>
    step.events
      .filter(
        (one): one is Extract<RulesetCombatEvent, { type: "condition" }> =>
          one.type === "condition" && one.reason === "cured",
      )
      .map((one) => one.condition);
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, rulesetCombatant(state, id)!).value;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");

  // ── Lesser Restoration: one condition, the first named that is held ──
  {
    const state = hold(fight(), "poisoned", "prone", "blinded");
    assert.deepEqual(targetsOf(state, "Restoration"), ["f"], "only the one holding something it ends");
    const step = cast(state, "Restoration");
    assert.equal(refused(step), undefined);
    assert.deepEqual(cured(step), ["blinded"], "in the order named, and only one");
    assert.deepEqual(held(step.state), ["poisoned", "prone"]);
    const all = cast(hold(fight(), "poisoned", "prone", "blinded"), "Purge");
    assert.deepEqual(cured(all), ["blinded", "poisoned"], "no count ends every one named");
    assert.deepEqual(held(all.state), ["prone"], "and nothing it did not name");
    // Nobody holds anything it ends: nobody to aim it at.
    assert.deepEqual(targetsOf(hold(fight(), "prone"), "Restoration"), []);
    assert.deepEqual(targetsOf(fight(), "Purge"), []);
  }

  // ── Spare the Dying: no more rolls ──
  {
    const state = fight({ pools: { hp: { value: 0 } }, tracks: { death_save_failures: 1 } });
    assert.equal(rulesetCombatant(state, "f")!.dying, true);
    assert.deepEqual(targetsOf(state, "Steady"), ["f"]);
    const step = cast(state, "Steady");
    assert.equal(refused(step), undefined);
    const fighter = rulesetCombatant(step.state, "f")!;
    assert.equal(fighter.stable, true);
    assert.ok(step.events.some((one) => one.type === "stabilized" && one.targetId === "f" && one.sourceId === "c"));
    const sheet = fighter.sheet!;
    assert.equal(sheet.live.tracks?.death_save_failures ?? 0, 0, "the count is over");
    // Round to the cleric again: the fighter's turn is stepped over, with no dying roll.
    faces = 2;
    let next: RulesetCombatStep = { state: step.state, events: [] };
    const events: RulesetCombatEvent[] = [];
    do {
      next = advanceRulesetTurn(definition, next.state, roll);
      events.push(...next.events);
    } while (next.state.order[next.state.turn] !== "c");
    faces = 10;
    assert.equal(
      events.some((one) => one.type === "dying"),
      false,
      "a stable member rolls nothing",
    );
    assert.equal(rulesetCombatant(next.state, "f")!.defeated, false);
    // Nobody dying: nobody to steady. Somebody already stable neither.
    assert.deepEqual(targetsOf(fight(), "Steady"), []);
    assert.deepEqual(targetsOf(next.state, "Steady"), []);
  }

  // ── Revivify: the dead of the last ten rounds, back at 1 ──
  const dead = () => {
    const state = fight({ pools: { hp: { value: 0 } }, tracks: { death_save_failures: 2 } });
    faces = 2;
    let step = advanceRulesetTurn(definition, state, roll);
    assert.ok(
      step.events.some((one) => one.type === "dying" && one.result === "dead"),
      "the third failure",
    );
    while (step.state.order[step.state.turn] !== "c") step = advanceRulesetTurn(definition, step.state, roll);
    faces = 10;
    return step.state;
  };
  {
    const state = dead();
    const fighter = rulesetCombatant(state, "f")!;
    assert.equal(fighter.defeated, true);
    assert.equal(fighter.diedRound, 1, "the round it died in");
    assert.equal(state.round, 2);
    assert.deepEqual(targetsOf(state, "Revivify"), ["f"]);
    assert.deepEqual(targetsOf(state, "Steady"), [], "the dead are not steadied");
    const step = cast(state, "Revivify");
    assert.equal(refused(step), undefined);
    const back = rulesetCombatant(step.state, "f")!;
    assert.equal(back.defeated, false);
    assert.equal(back.down, false);
    assert.equal(back.dying, false);
    assert.equal(back.diedRound, undefined);
    assert.equal(hp(step.state, "f"), 1);
    assert.ok(step.events.some((one) => one.type === "revived" && one.actorId === "f"));
    assert.equal(back.sheet!.live.tracks?.death_save_failures ?? 0, 0, "the dying count is cleared");
    // Back in the order: their turn comes round again.
    const after = advanceRulesetTurn(definition, step.state, roll);
    assert.equal(after.state.order[after.state.turn], "f");
    // Nobody dead: nobody to bring back.
    assert.deepEqual(targetsOf(fight(), "Revivify"), []);
  }
  {
    // Exactly ten rounds on is still in time; eleven is not, and naming them anyway is refused.
    const state = dead();
    state.round = 11;
    assert.deepEqual(targetsOf(state, "Revivify"), ["f"], "ten rounds on");
    state.round = 12;
    assert.equal(
      rulesetCanRevive(
        state,
        { revives: { withinRounds: 10, amount: { count: 0, sides: 0, flat: 1 } } },
        rulesetCombatant(state, "f")!,
      ),
      false,
    );
    assert.deepEqual(targetsOf(state, "Revivify"), [], "eleven is too late");
    const late = cast(state, "Revivify");
    assert.equal(rulesetCombatant(late.state, "f")!.defeated, true, "too late stays dead");
    assert.equal(hp(late.state, "f"), 0);
  }

  // ── Import refusals ──
  {
    const refusedDoc = (document: Record<string, any>, pattern: RegExp) => {
      const result = parseRulesetDefinition(document);
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const withEntry = (mechanics: Record<string, unknown>, edit: (doc: Record<string, any>) => void = () => {}) =>
      fiveE((doc) => {
        edit(doc);
        doc.catalogs.push({
          id: "cures",
          label: "Cures",
          feeds: ["spells"],
          entries: [{ ...spell("x", {}), mechanics }],
        });
      });
    refusedDoc(withEntry({ kind: "utility", ends: { conditions: ["dazed"] } }), /Unknown condition "dazed"/);
    refusedDoc(
      withEntry({ kind: "utility", ends: { conditions: ["blinded", "poisoned"], count: 3 } }),
      /at most as many conditions as it names/,
    );
    refusedDoc(
      withEntry({ kind: "utility", stabilizes: true }, (doc) => delete doc.combat.dying),
      /dying rule/,
    );
    refusedDoc(
      fiveE((doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        doc.catalogs.push({
          id: "kit",
          label: "Kit",
          entries: [
            {
              id: "salve",
              label: "Salve",
              item: { category: "gear", use: { kind: "heal", budget: "action", ends: { conditions: ["dazed"] } } },
            },
          ],
        });
      }),
      /Unknown condition "dazed"/,
    );
    parsed(withEntry({ kind: "utility", ends: { conditions: ["blinded", "poisoned"], count: 2 } }));
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
      "A ruleset with cures that end conditions, stabilize the dying or revive the dead requires schemaVersion 2 and capabilityApi 1.176 or newer";
    for (const entry of [restoration, steady, revivify]) {
      const withEntry = fiveE((doc) => {
        doc.catalogs.push({ id: "cures", label: "Cures", entries: [entry] });
      });
      assert.equal(getCapabilityPackageInstallIssue(manifest(175) as never, withEntry), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(176) as never, withEntry), gate, entry.id);
    }
    const salve = fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }] };
      doc.catalogs.push({
        id: "kit",
        label: "Kit",
        entries: [
          {
            id: "salve",
            label: "Salve",
            item: { category: "gear", use: { kind: "heal", budget: "action", ends: { conditions: ["poisoned"] } } },
          },
        ],
      });
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(175) as never, salve), gate, "an item's cure");
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(175) as never, fiveE()), gate, "nothing cures");
  }

  console.log(
    "Cures: Lesser Restoration ends the first condition named, Spare the Dying stops the rolls, Revivify brings back the dead of ten rounds and no later; gated at 1.176.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
