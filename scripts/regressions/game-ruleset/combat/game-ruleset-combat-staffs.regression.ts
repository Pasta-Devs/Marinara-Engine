/**
 * Staffs cast with their holder's numbers (Capability API 1.269).
 *
 *   - `sheetDifficulty`: a staff's spell saved against at its holder's spell save DC, and its attack
 *     rolled with their spell attack bonus (`toHit.sheetBonus`, already there).
 *   - `chargeStep`: more charges spent for more, each a step of a higher cost: a Fireball's die a
 *     charge, a Hold's target a charge, offered only as far as the staff still holds.
 *   - (The same minor raises the condition cap to 320 and adds an aura save's `immuneWhenEnds`;
 *     both are proven in the ability-narrowing and gazes regressions, and gated here.)
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-staffs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 264);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.items = { categories: [{ id: "staff", label: "Staff" }] };
    edit(doc);
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
    if (!result.ok)
      assert.ok(
        result.issues.some((issue) => pattern.test(issue)),
        result.issues.join("; "),
      );
  };
  const definition = parsed(document());
  const fireball = {
    kind: "attack",
    budget: "action",
    range: 150,
    amount: { dice: "8d6" },
    damageType: "fire",
    save: { save: "dex_save", onSuccess: "half" },
    sheetDifficulty: { derived: "spell_save_dc" },
    charges: 3,
    chargeStep: { max: 3, amount: { dice: "1d6" } },
  };
  const ray = {
    kind: "attack",
    budget: "action",
    range: 120,
    attackRoll: true,
    toHit: { sheetBonus: { derived: "spell_attack" } },
    amount: { flat: 4 },
    damageType: "cold",
    charges: 1,
  };
  const hold = {
    kind: "debuff",
    budget: "action",
    range: 60,
    targetCount: 1,
    save: { save: "wis_save", onSuccess: "negates" },
    sheetDifficulty: { derived: "spell_save_dc" },
    applies: [{ condition: "paralyzed", duration: { rounds: 1 } }],
    charges: 2,
    chargeStep: { max: 2, targets: 1 },
  };
  const staffItem = {
    category: "staff",
    charges: { max: 10 },
    stack: 1,
    use: fireball,
    moreUses: [
      { label: "Ray", use: ray },
      { label: "Hold", use: hold },
    ],
  };
  const staff = (charges?: number) =>
    ({
      item: staffItem as unknown as RulesetCatalogItem,
      quantity: 1,
      name: "Staff",
      ...(charges !== undefined ? { charges } : {}),
    }) as RulesetSheetItem;
  const build = (wis = 16) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 12, int: 10, wis, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
      lists: {},
    });
  const foe = (): RulesetStatBlock => ({
    health: 100,
    defense: 1,
    initiativeModifier: 0,
    saves: { dex_save: -20, wis_save: -20 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  // Every die shows 1 except the d20, which shows 10: a save fails, a ray hits defense 1.
  const roll = (sides: number) => (sides === 20 ? 10 : 1);
  const fight = (options: { wis?: number; charges?: number } = {}): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "hero",
          name: "Hero",
          side: "party",
          build: build(options.wis),
          live: {},
          items: [staff(options.charges)],
        },
        ...["a", "b", "c"].map((id) => ({ id, name: id, side: "enemy" as const, block: foe() })),
      ],
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const step = (state: RulesetEncounterState, choice: RulesetCombatChoice) =>
    applyRulesetCombatChoice(definition, state, choice, roll);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = step(state, choice);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const option = (state: RulesetEncounterState, id: string) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.id === id)!;
  const actionOf = (state: RulesetEncounterState, id: string) =>
    who(state, "hero").actions.find((one) => one.id === id)!;
  const dealt = (events: RulesetCombatEvent[]) => of(events, "damage").reduce((total, one) => total + one.dealt, 0);

  // ── The holder's numbers: spell save DC 8 + 3 + 3, spell attack 3 + 3 ──
  {
    const state = fight();
    assert.equal(actionOf(state, "use:0").saveDifficulty, 14);
    assert.equal(actionOf(state, "use:0:2").saveDifficulty, 14);
    assert.equal(actionOf(state, "use:0:1").toHit, 6);
    const wiser = fight({ wis: 20 });
    assert.equal(actionOf(wiser, "use:0").saveDifficulty, 16, "a wiser holder, a harder save");
    assert.equal(actionOf(wiser, "use:0:1").toHit, 8);
    const done = act(state, { actorId: "hero", optionId: "use:0", targetIds: ["a"] });
    assert.deepEqual(
      of(done.events, "save").map((one) => one.difficulty),
      [14],
    );
  }

  // ── More charges: Fireball, a die each; offered as far as the staff holds ──
  {
    const state = fight();
    assert.deepEqual(option(state, "use:0").payWith, ["charges:1", "charges:2", "charges:3"]);
    assert.equal(option(state, "use:0:1").payWith, undefined, "the Ray takes no more charges");
    const plain = act(state, { actorId: "hero", optionId: "use:0", targetIds: ["a"] });
    assert.equal(dealt(plain.events), 8);
    assert.equal(who(plain.state, "hero").charges?.[0], 7);
    const more = act(fight(), { actorId: "hero", optionId: "use:0", targetIds: ["a"], payWith: "charges:2" });
    assert.equal(dealt(more.events), 10, "two dice more");
    assert.equal(who(more.state, "hero").charges?.[0], 5, "3 and 2 more");
    // Four left: one more is all it holds beyond the spell's own 3.
    const low = fight({ charges: 4 });
    assert.deepEqual(option(low, "use:0").payWith, ["charges:1"]);
    assert.equal(
      of(step(low, { actorId: "hero", optionId: "use:0", targetIds: ["a"], payWith: "charges:2" }).events, "refused")[0]
        ?.reason,
      "bad-pool",
    );
    const exact = fight({ charges: 3 });
    assert.equal(option(exact, "use:0").payWith, undefined);
  }

  // ── More charges: Hold, a target each ──
  {
    const state = fight();
    const offered = option(state, "use:0:2");
    assert.deepEqual(offered.payWith, ["charges:1", "charges:2"]);
    assert.deepEqual(offered.targetsWith, { "charges:1": 2, "charges:2": 3 });
    assert.ok(
      of(step(state, { actorId: "hero", optionId: "use:0:2", targetIds: ["a", "b"] }).events, "refused").length > 0,
      "two targets need a charge more",
    );
    const done = act(state, { actorId: "hero", optionId: "use:0:2", targetIds: ["a", "b"], payWith: "charges:1" });
    assert.equal(of(done.events, "save").length, 2);
    assert.equal(who(done.state, "hero").charges?.[0], 7);
  }

  // ── Import ──
  {
    const withStaff = (edit: (item: Record<string, any>) => void) =>
      document((doc) => {
        const item = structuredClone(staffItem) as Record<string, any>;
        edit(item);
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "staff", label: "Staff", item }],
        });
      });
    parsed(withStaff(() => {}));
    refused(
      withStaff((item) => (item.use.saveDifficulty = 15)),
      /A save difficulty is the item's own or read off the sheet, not both/,
    );
    refused(
      withStaff((item) => delete item.moreUses[1].use.charges),
      /More charges go beside the "charges" a use spends/,
    );
    refused(
      withStaff((item) => (item.use.chargeStep = { max: 2 })),
      /A charge more adds an amount, targets, a push, or some of them/,
    );
    refused(
      withStaff((item) => (item.use.sheetDifficulty = { derived: "nope" })),
      /nope/,
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
      "A ruleset with more than 160 conditions, an aura save whose holder's aura stays off once what it put on ends, an item use whose save difficulty is read off its holder's sheet, or one that spends more charges for more, requires schemaVersion 2 and capabilityApi 1.269 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const gear = (use: Record<string, unknown>) =>
      document((doc) =>
        doc.catalogs.push({
          id: "gear",
          label: "Gear",
          holds: "items",
          entries: [{ id: "staff", label: "Staff", item: { category: "staff", charges: { max: 10 }, stack: 1, use } }],
        }),
      );
    const { sheetDifficulty: _sd, chargeStep: _cs, ...bare } = fireball;
    assert.notEqual(issue(268, gear({ ...bare, saveDifficulty: 14 })), gate, "nothing of 1.269");
    for (const [name, use] of [
      ["sheetDifficulty", { ...bare, sheetDifficulty: { derived: "spell_save_dc" } }],
      ["chargeStep", { ...bare, saveDifficulty: 14, chargeStep: { max: 3, amount: { dice: "1d6" } } }],
    ] as const) {
      const doc = gear(use);
      parsed(doc);
      assert.equal(issue(268, doc), gate, name);
      assert.notEqual(issue(269, doc), gate, name);
    }
    assert.equal(
      issue(268, gear({ ...bare, saveDifficulty: 14 }), new Map([["extra.json", { use: { chargeStep: { max: 1 } } }]])),
      gate,
    );
    // More than 160 conditions (320 now), and an aura save immune once what it put on ends.
    const many = (count: number) =>
      document((doc) => {
        for (let index = doc.sheet.live.conditions.length; index < count; index++) {
          doc.sheet.live.conditions.push({ id: `extra_${index}`, label: `Extra ${index}` });
        }
      });
    assert.notEqual(issue(268, many(160)), gate, "160 fit before");
    parsed(many(161));
    assert.equal(issue(268, many(161)), gate, "161 conditions");
    assert.notEqual(issue(269, many(161)), gate);
    const immune = document((doc) => {
      doc.sheet.live.conditions.push({ id: "horrific", label: "Horrific Appearance" });
      doc.combat.conditions.push({
        condition: "horrific",
        effects: [],
        auras: [
          {
            distance: 30,
            side: "enemies",
            save: {
              save: "wis_save",
              difficulty: 11,
              immuneWhenEnds: true,
              applies: [{ condition: "frightened", duration: { rounds: 10 } }],
            },
          },
        ],
      });
    });
    parsed(immune);
    assert.equal(issue(268, immune), gate, "immuneWhenEnds");
    assert.notEqual(issue(269, immune), gate);
  }

  console.log(
    "Ruleset staffs: a staff's spells save against the holder's spell save DC and hit with their spell attack bonus; more charges add a die or a target each, offered only as far as the staff holds; gated at 1.269.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
