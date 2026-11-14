/**
 * Quivering Palm and Hurl Through Hell (Capability API 1.245).
 *
 *   - `usesSpent`: one use spends several of its row's uses: Quivering Palm's 3 ki.
 *   - A "hit" reaction's `names`: only a hit by those attacks opens it (an unarmed strike).
 *   - `dropsOnFailedSave`: a target that fails the save drops to 0 health; one that makes it takes
 *     the amount.
 *   - A condition's `onEnd.harm`: damage as it ends, from whoever put it on, unless the holder is what
 *     `unless` names: Hurl Through Hell's 10d10 psychic, which a fiend never takes.
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRulesetLive } from "../../../../packages/shared/src/features/rulesets/live-state.js";
import {
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  RULESET_PASS_OPTION,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-quivering-palm-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 240);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const palm = {
    id: "quivering-palm",
    label: "Quivering Palm",
    rows: [
      { list: "features", values: { name: "Quivering Palm" } },
      { list: "counters", values: { name: "Ki", max: 5, recharge: "short" } },
    ],
    mechanics: {
      kind: "debuff",
      free: true,
      usesOf: "Ki",
      usesSpent: 3,
      reaction: { on: "hit", by: "self", names: ["Unarmed Strike"], at: "target" },
      applies: [{ condition: "quivering", duration: { rounds: 100 } }],
    },
  };
  const vibrations = {
    id: "end-vibrations",
    label: "End the Vibrations",
    rows: [{ list: "features", values: { name: "End the Vibrations" } }],
    mechanics: {
      kind: "attack",
      budget: "action",
      targets: "enemy",
      targetHolds: { fromSelf: ["quivering"] },
      amount: { dice: "10d10" },
      damageType: "necrotic",
      save: { save: "con_save", onSuccess: "none" },
      dropsOnFailedSave: true,
      ends: { conditions: ["quivering"] },
    },
  };
  const hurl = {
    id: "hurl-through-hell",
    label: "Hurl Through Hell",
    rows: [{ list: "features", values: { name: "Hurl Through Hell" } }],
    mechanics: {
      kind: "debuff",
      free: true,
      reaction: { on: "hit", by: "self", at: "target" },
      applies: [{ condition: "hurled", duration: { rounds: 1, of: "source" } }],
      dismisses: { while: "hurled" },
    },
  };
  const features = [palm, vibrations, hurl] as unknown as RulesetCatalogEntry[];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.sheet.live.conditions.push({ id: "quivering", label: "Quivering" }, { id: "hurled", label: "Hurled" });
    doc.combat.conditions.push({
      condition: "hurled",
      effects: [],
      onEnd: { harm: { dice: "10d10", type: "psychic", unless: { types: ["fiend"] } } },
    });
    Object.assign(
      doc.combat.abilities.find((one: { list: string }) => one.list === "features"),
      { saveDifficulty: { derived: "spell_save_dc" }, toHit: { derived: "spell_attack" } },
    );
    doc.catalogs.push({
      id: "monkish",
      label: "Feats",
      feeds: ["features", "counters"],
      entries: structuredClone(features),
    });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  let d20 = 15;
  const roll = (sides: number) => (sides === 20 ? d20 : 3);
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 80,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { con_save: -20 },
      actions: [],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const rows = (list: string, without: string[] = []) =>
    features
      .filter((entry) => !without.includes(entry.id))
      .flatMap((entry) =>
        rowsFromCatalogEntry("monkish", entry).flatMap((one) => (one.list === list ? [one.row] : [])),
      );
  const fight = (foe: Partial<RulesetStatBlock> = {}, without: string[] = []): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "monk",
          name: "Monk",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 16, cha: 16 },
            fields: { level: 17, ac: 18, speed: 50, hp_max: 100, spellcasting_ability: "wis" },
            lists: {
              attacks: [
                { name: "Unarmed Strike", ability: "dex", proficient: true, bonus: 0, damage: "1d10", reach: 5 },
                { name: "Longsword", ability: "dex", proficient: true, bonus: 0, damage: "1d8", reach: 5 },
              ],
              features: rows("features", without),
              counters: rows("counters", without),
            },
          }),
          live: {},
          catalogs: { monkish: features },
        },
        { id: "foe", name: "Foe", side: "enemy", block: block(foe) },
        // Somebody left to fight while the foe is away.
        { id: "brute", name: "Brute", side: "enemy", block: block() },
      ],
    });
    state.order = ["monk", "foe", "brute"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id = "foe") => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState) => rulesetCombatHealth(definition, definition.combat!, who(state)).value;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const choose = (state: RulesetEncounterState, optionId: string, targetIds: string[] = [], actorId = "monk") => {
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId, targetIds }, roll);
    assert.equal(of(step.events, "refused").length, 0, JSON.stringify(of(step.events, "refused")));
    return step;
  };
  const take = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "monk").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return choose(state, option.id, ["foe"]);
  };
  const answers = (state: RulesetEncounterState) => rulesetWindowOptions(definition, state, "monk");
  const answer = (state: RulesetEncounterState, label: string) => {
    const option = answers(state).find((one) => one.label === label);
    assert.ok(option, `no ${label}: ${answers(state).map((one) => one.label)}`);
    return choose(state, option.id);
  };
  const ki = (state: RulesetEncounterState) => {
    const monk = who(state, "monk");
    return readRulesetLive(definition, monk.sheet!.build, monk.sheet!.live).pools.find(
      (one) => one.key === "counters:ki",
    )?.value;
  };

  // ── Only an unarmed strike's hit offers Quivering Palm; any hit offers Hurl Through Hell ──
  {
    const sword = take(fight(), "Longsword");
    assert.deepEqual(
      answers(sword.state).map((one) => one.label),
      ["Hurl Through Hell"],
    );
    const fist = take(fight(), "Unarmed Strike");
    assert.deepEqual(
      answers(fist.state).map((one) => one.label),
      ["Quivering Palm", "Hurl Through Hell"],
    );
  }

  // ── Without Hurl Through Hell, only an unarmed strike's hit is held at all ──
  {
    const fist = take(fight({}, ["hurl-through-hell"]), "Unarmed Strike");
    assert.equal(fist.state.window?.trigger.kind, "hit");
    const sword = take(fight({}, ["hurl-through-hell"]), "Longsword");
    assert.equal(sword.state.window, undefined);
    assert.equal(of(sword.events, "damage").length, 1);
  }

  // ── Quivering Palm spends 3 ki at once, and wants all 3 ──
  {
    const fist = take(fight(), "Unarmed Strike");
    assert.equal(ki(fist.state), 5);
    const palmed = choose(answer(fist.state, "Quivering Palm").state, RULESET_PASS_OPTION);
    assert.equal(ki(palmed.state), 2);
    assert.ok(rulesetCombatConditions(definition, who(palmed.state)).includes("quivering"));
    // Two left: not enough for another.
    const again = take(fight(), "Unarmed Strike");
    who(again.state, "monk").sheet!.live = palmed.state.combatants.find((one) => one.id === "monk")!.sheet!.live;
    assert.ok(!answers(again.state).some((one) => one.label === "Quivering Palm"));
  }

  // ── Ending the vibrations: a failed save drops the foe to 0; a made one takes 10d10 ──
  {
    const palmed = () => {
      const state = fight();
      who(state).tracked.push({ condition: "quivering", source: "monk", rounds: 100 });
      return state;
    };
    const failed = take(palmed(), "End the Vibrations");
    assert.equal(of(failed.events, "save")[0]?.success, false);
    assert.deepEqual(of(failed.events, "dropped"), [
      { type: "dropped", actorId: "monk", targetId: "foe", label: "End the Vibrations" },
    ]);
    assert.equal(hp(failed.state), 0);
    assert.ok(who(failed.state).defeated);
    assert.equal(of(failed.events, "damage").length, 0);
    assert.deepEqual(
      who(failed.state).tracked.map((one) => one.condition),
      [],
      "the vibrations are spent, dropped or not",
    );

    const sturdy = palmed();
    who(sturdy).saves.con_save = 40;
    const made = take(sturdy, "End the Vibrations");
    assert.equal(of(made.events, "dropped").length, 0);
    assert.equal(80 - hp(made.state), 30);
    assert.deepEqual(
      who(made.state).tracked.map((one) => one.condition),
      [],
    );
    // Only on somebody it quivers in.
    const still = fight();
    const end = rulesetCombatOptions(definition, still, "monk").find((one) => one.label === "End the Vibrations");
    assert.ok(!end || rulesetOptionTargets(definition, still, "monk", end).length === 0);
  }

  // ── Hurl Through Hell: gone, and back at the end of the monk's next turn with 10d10 psychic ──
  {
    const run = (foe: Partial<RulesetStatBlock> = {}) => {
      const hurled = answer(take(fight(foe), "Longsword").state, "Hurl Through Hell");
      assert.equal(hurled.state.window, undefined);
      assert.ok(who(hurled.state).away, "gone");
      const hit = 80 - hp(hurled.state);
      // The monk's turn ends, the foe has none, the brute's, the monk's next ends: back.
      let state = hurled.state;
      let returned = false;
      let psychic = 0;
      for (let turn = 0; turn < 5 && !returned; turn++) {
        const actor = state.order[state.turn]!;
        const end = rulesetCombatOptions(definition, state, actor).find((one) => one.kind === "end-turn")!;
        const step = choose(state, end.id, [], actor);
        state = step.state;
        returned = of(step.events, "returned").length > 0;
        psychic += of(step.events, "damage")
          .filter((one) => one.targetId === "foe")
          .reduce((sum, one) => sum + one.dealt, 0);
      }
      assert.ok(returned && !who(state).away, "back");
      return { psychic, total: 80 - hp(state) - hit };
    };
    assert.deepEqual(run(), { psychic: 30, total: 30 });
    assert.deepEqual(run({ type: "fiend" } as Partial<RulesetStatBlock>), { psychic: 0, total: 0 }, "a fiend is home");
  }

  // ── Import refusals ──
  {
    const refused = (edit: (doc: Record<string, any>) => void, pattern: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `must refuse ${pattern}`);
      if (!result.ok)
        assert.ok(
          result.issues.some((issue) => pattern.test(issue)),
          result.issues.join("; "),
        );
    };
    const entry = (doc: Record<string, any>, id: string) =>
      doc.catalogs.at(-1).entries.find((one: { id: string }) => one.id === id).mechanics;
    const hurled = (doc: Record<string, any>) =>
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "hurled").onEnd.harm;
    refused((doc) => delete entry(doc, "end-vibrations").save, /"dropsOnFailedSave" follows/);
    refused((doc) => (entry(doc, "quivering-palm").usesSpent = 1), /usesSpent/);
    refused((doc) => (entry(doc, "quivering-palm").reaction.on = "aimed"), /"names" narrows a hit/);
    refused((doc) => (hurled(doc).type = "sonic-boom"), /Unknown damage type "sonic-boom"/);
    refused((doc) => (hurled(doc).unless = { types: ["dragon"] }), /Unknown creature type "dragon"/);
    refused((doc) => delete hurled(doc).dice, /names dice, a flat amount, or both/);
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
      "A ruleset with uses that spend several uses at once or drop a target that fails its save to 0, reactions to hits by named attacks, or conditions that harm as they end, requires schemaVersion 2 and capabilityApi 1.245 or newer";
    const without = JSON.parse(fiveEText);
    const issue = (minor: number, document: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, document, files as never);
    for (const extra of [
      { mechanics: { usesSpent: 3 } },
      { mechanics: { dropsOnFailedSave: true } },
      { mechanics: { reaction: { on: "hit", names: ["Unarmed Strike"] } } },
      { mechanics: { reaction: { on: "aimed", also: [{ on: "hit", names: ["Unarmed Strike"] }] } } },
      { onEnd: { harm: { dice: "1d6" } } },
    ]) {
      const document = structuredClone(without);
      document.extra = { entry: extra };
      assert.equal(issue(244, document), gate, JSON.stringify(extra));
      assert.notEqual(issue(245, document), gate);
    }
    assert.notEqual(issue(244, without), gate);
    assert.equal(issue(244, without, new Map([["monkish.json", { entries: [palm] }]])), gate);
  }

  console.log(
    "Ruleset quivering palm: 3 ki at once on an unarmed strike's hit, a failed save drops to 0 and a made one takes 10d10, and Hurl Through Hell's return harms all but fiends; gated at 1.245.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
