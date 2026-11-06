/**
 * Saves made as days pass that count successes and harm on a failure, and damage kept off healing
 * (Capability API 1.750).
 *
 *   - Pale tincture: "The poisoned creature must repeat the saving throw every 24 hours, taking 3
 *     (1d6) poison damage on a failed save. Until this poison ends, the damage the poison deals can't
 *     be healed by any means. After seven successful saving throws, the effect ends". A `saveEnds`
 *     with `"at": "days"` may say `successes` (counted on the sheet) and `harmsOnFail`, and a
 *     condition that `keepsDamage` lowers health's maximum by what it deals until it ends.
 *   - In a fight, a condition that keepsDamage keeps what its `harms` deal off a sheet's healing and a
 *     block's, given back as it ends.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  applyRulesetSheetOp,
  createRulesetEncounter,
  currentRulesetActor,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-day-save-harms-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 750);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const tincture = {
    save: "con_save",
    at: "days",
    days: 1,
    successes: 7,
    harmsOnFail: { dice: "1d6", type: "poison" },
  };
  const document = (
    saveEnds: Record<string, unknown> = tincture,
    condition: Record<string, unknown> = { keepsDamage: true },
  ) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "tinctured", label: "Pale tincture" });
    doc.combat.conditions.push({ condition: "tinctured", effects: ["own-attacks-disadvantage"], ...condition });
    doc.catalogs.push({
      id: "poisons",
      label: "Poisons",
      feeds: ["spells"],
      entries: [
        {
          id: "pale-tincture",
          label: "Pale tincture",
          rows: [{ list: "spells", values: { name: "Pale tincture", level: 1, prepared: true } }],
          mechanics: {
            kind: "attack",
            save: { save: "con_save", onSuccess: "negates" },
            amount: { dice: "1d6" },
            damageType: "poison",
            applies: [{ condition: "tinctured", duration: "until-save", saveEnds }],
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
  });
  const foe = {
    id: "foe",
    name: "Foe",
    side: "enemy" as const,
    block: { health: 10, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
  };

  // ── The fight over, its save, its count and its harm go onto the sheet ──
  let live: RulesetLiveState;
  {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [{ id: "hero", name: "Hero", side: "party", build, live: { conditions: ["tinctured"] } }, foe],
    });
    const hero = rulesetCombatant(state, "hero")!;
    hero.tracked.push({
      condition: "tinctured",
      rounds: null,
      source: "foe",
      difficulty: 16,
      saveEnds: { save: "con_save", at: "days", days: 1, successes: 7, harmsOnFail: { dice: "1d6", type: "poison" } },
    });
    liftRulesetFightEffects(definition, state);
    live = hero.sheet!.live as RulesetLiveState;
    assert.deepEqual(live.daySaves, {
      tinctured: {
        save: "con_save",
        difficulty: 16,
        every: 1,
        successes: 7,
        harm: { dice: "1d6", type: "poison" },
        keeps: true,
      },
    });
  }

  const op = (from: RulesetLiveState, command: Parameters<typeof applyRulesetSheetOp>[3], rolled = 10) => {
    const result = applyRulesetSheetOp(definition, build, from, command, () => rolled);
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  };
  const hp = (state: RulesetLiveState) => state.pools?.hp;
  // ── A failed day: 1d6 poison, kept off healing ──
  {
    let step = op(live, { op: "pass", days: 1 }, 3);
    assert.match(
      step.now,
      /Pale tincture: Constitution save 3 against 16, failed \(0 of 7\), took 3 poison \(Hit points 37\/40\)/,
    );
    assert.deepEqual(hp(step.live), { value: 37, sealed: 3, lasting: 3 });
    assert.deepEqual(step.live.lowered, { tinctured: 3 });
    // Healed, it stops short of what the poison keeps.
    step = op(step.live, { op: "restore", pool: "hp", amount: 10 });
    assert.equal(hp(step.live)?.value, 37, "can't be healed by any means");
    // Nor does a long rest give it back.
    step = op(step.live, { op: "rest", rest: definition.rests.at(-1)!.id });
    assert.ok((hp(step.live)?.value ?? 40) <= 37, "nor by a rest");
    // Six made, each counted; the seventh ends it, and the maximum comes back.
    step = op(step.live, { op: "pass", days: 6 }, 20);
    assert.match(step.now, /Pale tincture: Constitution save against 16, 6 made and 0 failed \(6 of 7\)/);
    assert.deepEqual(step.live.conditions, ["tinctured"], "six of seven, still poisoned");
    assert.equal(step.live.daySaves?.tinctured?.made, 6);
    step = op(step.live, { op: "pass", days: 1 }, 20);
    assert.match(step.now, /20 against 16, ended, Hit points's maximum back up by 3/);
    assert.ok(!(step.live.conditions ?? []).includes("tinctured"));
    assert.equal(step.live.daySaves, undefined);
    step = op(step.live, { op: "restore", pool: "hp", amount: 10 });
    assert.equal(hp(step.live)?.value ?? 40, 40, "and it heals normally");
  }
  // ── A failure among successes resets nothing: they are counted, not in a row ──
  {
    let step = op(live, { op: "pass", days: 2 }, 20);
    step = op(step.live, { op: "pass", days: 1 }, 2);
    assert.match(step.now, /failed \(2 of 7\), took 2 poison/);
    assert.equal(step.live.daySaves?.tinctured?.made, 2);
  }
  // ── Taken off another way, what it kept is given back ──
  {
    const failed = op(live, { op: "pass", days: 1 }, 4);
    const off = op(failed.live, { op: "condition", condition: "tinctured", active: false });
    assert.match(off.now, /maximum back up by 4/);
    assert.equal(off.live.lowered, undefined);
  }
  // ── A plain day save still ends on its first success, harming nothing ──
  {
    const plain = parsed(document({ save: "con_save", at: "days", days: 1 }, {}));
    const once = applyRulesetSheetOp(
      plain,
      build,
      { conditions: ["tinctured"], daySaves: { tinctured: { save: "con_save", difficulty: 16, every: 1 } } },
      { op: "pass", days: 2 },
      () => 3,
    );
    assert.ok(once.ok);
    assert.equal(once.live.pools?.hp, undefined, "no harm without harmsOnFail");
  }

  // ── In a fight, what its harms deal is kept off healing until it ends ──
  {
    const fight = parsed(
      document(tincture, { keepsDamage: true, harms: { at: "turn-start", flat: 5, type: "poison" } }),
    );
    let state = createRulesetEncounter({
      definition: fight,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {} },
        {
          ...foe,
          block: { health: 30, defense: 10, initiativeModifier: -20, actions: [] } as unknown as RulesetStatBlock,
        },
      ],
    });
    state.order = ["hero", "foe"];
    state.turn = 0;
    for (const id of ["hero", "foe"]) {
      rulesetCombatant(state, id)!.tracked.push({ condition: "tinctured", rounds: null, source: "foe" });
    }
    rulesetCombatant(state, "hero")!.sheet!.live = { conditions: ["tinctured"] };
    const end = (actorId: string) => {
      const step = applyRulesetCombatChoice(fight, state, { actorId, optionId: "end-turn", targetIds: [] }, () => 10);
      state = step.state;
    };
    end("hero");
    assert.equal(currentRulesetActor(state)?.id, "foe");
    const block = rulesetCombatant(state, "foe")!;
    assert.equal(block.health?.value, 25, "its harm lands on the block");
    assert.equal(block.health?.sealed, 5, "and is kept off its healing");
    end("foe");
    const hero = rulesetCombatant(state, "hero")!;
    const sheet = hero.sheet!.live as RulesetLiveState;
    assert.deepEqual(sheet.pools?.hp, { value: 35, sealed: 5, lasting: 5 }, "and off the hero's");
    assert.deepEqual(sheet.lowered, { tinctured: 5 });
  }

  // ── Refusals ──
  refused(document({ save: "con_save", at: "turn-end", harmsOnFail: { dice: "1d6" } }), /"harmsOnFail" is dealt/);
  refused(document({ ...tincture, harmsOnFail: { type: "poison" } }), /names dice, a flat amount, or both/);
  refused(document({ ...tincture, harmsOnFail: { dice: "1d6", type: "gloom" } }), /Unknown damage type "gloom"/);

  // ── The install gate ──
  {
    const gate =
      'A ruleset with a save made as days pass that counts successes or harms on a failure (saveEnds "at": "days" with successes or harmsOnFail), or a condition that keepsDamage, requires schemaVersion 2 and capabilityApi 1.750 or newer';
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(749) as never, document()), gate);
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(749) as never, document({ save: "con_save", at: "days", days: 1 })),
      gate,
      "keepsDamage alone",
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(750) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(749) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Day save harms: Pale tincture's save is counted to seven across the days, deals 1d6 poison on each failure kept off healing and rests until it ends; a fight's harms kept off a sheet's and a block's healing; gated at 1.750.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
