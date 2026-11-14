/**
 * Heals kept off, conditions kept off by who puts them on, ability floors, and saves against named
 * actions (Capability API 1.191).
 *
 *   - The effect "cannot-heal": Chill Touch. The heal is rolled, nothing comes back, the log says so.
 *   - `conditionImmunitiesFrom`: Protection from Evil and Good keeps a fiend's fright off, not a
 *     dragon's, and leaves one already on.
 *   - `targetTypes.abilityAtLeast`: Hideous Laughter passes over Intelligence 4 or less.
 *   - A saves modifier's `against.actions`, AND its `from`: Dragon Scale Mail against a dragon's
 *     breath (by its shared recharge group) and Frightful Presence (the repeated save too), never its
 *     Wing Attack, and never a fiend's breath.
 *   - Import refusals, and the install gate.
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
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSaveAgainstMatches,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-heal-wards-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [{ getCapabilityPackageInstallIssue }, { rulesetCombatEventLine, rulesetCombatNames }] = await Promise.all([
  import("../../../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../../../packages/client/src/lib/ruleset-combat-log.js"),
]);

try {
  assert.ok(supportedCapabilityApi.minor >= 186);
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const fiveEText = read("../../../../docs/development/ruleset-5e-2014.example.json");
  const english = JSON.parse(read("../../../../packages/client/src/localization/locales/en.json")) as Record<string, string>;
  const scaled = {
    to: "saves",
    mode: "advantage",
    against: { from: { types: ["dragon"] }, actions: ["Breath_Weapons", "frightful_presence", "roar"] },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.creatureTypes = {
      types: ["humanoid", "fiend", "dragon", "beast"].map((id) => ({ id, label: id })),
      default: "humanoid",
    };
    doc.sheet.live.conditions.push(
      { id: "chill", label: "Chill Touch" },
      { id: "warded", label: "Protection from Evil and Good" },
      { id: "scaled", label: "Dragon Scale Mail" },
      { id: "winded", label: "Winded" },
      { id: "charmward", label: "Charm ward" },
    );
    doc.combat.conditions.push(
      { condition: "chill", effects: ["cannot-heal"] },
      {
        condition: "warded",
        conditionImmunitiesFrom: [{ conditions: ["frightened", "charmed"], from: { types: ["fiend"] } }],
      },
      {
        condition: "charmward",
        conditionImmunitiesFrom: [{ conditions: ["charmed"], from: { types: ["fiend"] } }],
      },
      { condition: "scaled", modifiers: [scaled] },
      {
        condition: "winded",
        modifiers: [{ to: "saves", mode: "disadvantage", against: { actions: ["wing attack"] } }],
      },
    );
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 1, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const cure = spell("cure", { kind: "heal", targets: "ally", range: 30, amount: { flat: 5 } });
  const laughter = spell("laughter", {
    kind: "debuff",
    range: 30,
    targetTypes: { abilityAtLeast: { int: 5 } },
    applies: [{ condition: "prone", duration: { rounds: 1 } }],
  });
  const spells = [cure, laughter];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const combat = definition.combat!;
  const frightening = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    budget: "action",
    range: 60,
    save: { save: "wis_save", difficulty: 30, onSuccess: "negates" as const },
    applies: [
      {
        condition: "frightened",
        duration: "until-save" as const,
        saveEnds: { save: "wis_save", at: "turn-end" as const },
      },
    ],
    ...extra,
  });
  const breathing = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id,
    name,
    budget: "action",
    range: 60,
    save: { save: "dex_save", difficulty: 15, onSuccess: "half" as const },
    damage: { count: 2, sides: 6, flat: 0, type: "fire" },
    ...extra,
  });
  const block = (type: string, actions: unknown[], extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      type,
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { con_save: 0 },
      actions,
      ...extra,
    }) as RulesetStatBlock;
  const dragonActions = [
    breathing("fire_breath", "Fire Breath", {
      recharge: { dice: { count: 1, sides: 6 }, from: 5, group: "breath_weapons" },
    }),
    breathing("wing_attack", "Wing Attack"),
    frightening("frightful_presence", "Frightful Presence"),
    frightening("roar", "Roar", {
      applies: [{ condition: "frightened", duration: "until-save", saveEnds: { save: "wis_save", at: "damaged" } }],
    }),
  ];
  const fiendActions = [
    breathing("fire_breath", "Fire Breath", {
      recharge: { dice: { count: 1, sides: 6 }, from: 5, group: "breath_weapons" },
    }),
    frightening("scare", "Scare"),
  ];
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  // A d20 shows 10; every other die shows 1.
  const roll = (sides: number) => (sides === 20 ? 10 : 1);
  const fight = (
    abilities: Partial<Record<"dragon" | "fiend" | "beast", Record<string, number>>> = {},
    friendHp = 20,
  ) => {
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
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis", slots_max_1: 9 },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
        },
        {
          id: "friend",
          name: "Friend",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 1, ac: 10, speed: 30, hp_max: 40 },
          }),
          live: { pools: { hp: { value: friendHp } } },
        },
        {
          id: "dragon",
          name: "Dragon",
          side: "enemy",
          block: block("dragon", dragonActions, abilities.dragon ? { abilities: abilities.dragon } : {}),
        },
        {
          id: "fiend",
          name: "Fiend",
          side: "enemy",
          block: block("fiend", fiendActions, abilities.fiend ? { abilities: abilities.fiend } : {}),
        },
        { id: "beast", name: "Beast", side: "enemy", block: block("beast", [], { abilities: abilities.beast ?? {} }) },
      ],
      board: {
        grid: grid(),
        placements: {
          mage: { x: 2, y: 7 },
          friend: { x: 2, y: 8 },
          dragon: { x: 4, y: 7 },
          fiend: { x: 4, y: 8 },
          beast: { x: 4, y: 6 },
        },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const optionOf = (state: RulesetEncounterState, actor: string, label: string) => {
    const option = rulesetCombatOptions(definition, state, actor).find((one) => one.label === label);
    assert.ok(option, `no ${label} for ${actor}`);
    return option;
  };
  const act = (state: RulesetEncounterState, actor: string, label: string, targetIds: string[]) => {
    state.turn = state.order.indexOf(actor);
    who(state, actor).budgets.action = 1;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: actor, optionId: optionOf(state, actor, label).id, targetIds },
      roll,
    );
    Object.assign(state, step.state);
    return step.events;
  };
  const saveOf = (events: RulesetCombatEvent[], id: string) => {
    const found = events.find((one) => one.type === "save" && one.actorId === id);
    assert.ok(found && found.type === "save", `no save by ${id}`);
    return found;
  };
  const healOf = (events: RulesetCombatEvent[]) => {
    const found = events.find((one) => one.type === "heal");
    assert.ok(found && found.type === "heal", "no heal");
    return found;
  };
  const tracked = (state: RulesetEncounterState, id: string, condition: string) =>
    who(state, id).tracked.find((entry) => entry.condition === condition);

  // ── Chill Touch: no heal comes back ──
  {
    const state = fight();
    const plain = healOf(act(state, "mage", "Cure", ["friend"]));
    assert.equal(plain.amount, 5);
    assert.equal(plain.blocked, undefined);
    assert.equal(hp(state, "friend"), 25);
    who(state, "friend").tracked.push({ condition: "chill", rounds: 1, source: "dragon" });
    const blocked = healOf(act(state, "mage", "Cure", ["friend"]));
    assert.equal(blocked.amount, 0, "nothing comes back");
    assert.equal(blocked.blocked, true);
    assert.equal(hp(state, "friend"), 25, "the health stands");
    // Down and chilled, a heal does not bring them back up.
    const down = fight({}, 0);
    assert.equal(who(down, "friend").down, true);
    who(down, "friend").tracked.push({ condition: "chill", rounds: 1, source: "dragon" });
    act(down, "mage", "Cure", ["friend"]);
    assert.equal(who(down, "friend").down, true, "still down");
    assert.equal(hp(down, "friend"), 0);
    // And the screen says why.
    const t = ((key: string, params: Record<string, unknown> = {}) =>
      (english[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(params[name] ?? ""))) as never;
    const view = { combatants: state.combatants.map((one) => ({ id: one.id, name: one.name })) } as never;
    assert.equal(
      rulesetCombatEventLine(blocked, rulesetCombatNames(definition, view, t), t),
      "Friend regains nothing: something keeps them from healing.",
    );
  }

  // ── Protection from Evil and Good: a fiend's fright, not a dragon's ──
  {
    const state = fight();
    who(state, "mage").tracked.push({ condition: "warded", rounds: null });
    const scared = act(state, "fiend", "Scare", ["mage"]);
    assert.ok(
      scared.some((one) => one.type === "condition" && one.reason === "immune" && one.condition === "frightened"),
      "kept off",
    );
    assert.equal(tracked(state, "mage", "frightened"), undefined);
    act(state, "dragon", "Frightful Presence", ["mage"]);
    assert.ok(tracked(state, "mage", "frightened"), "a dragon is no fiend");
    // Unwarded, the fiend's fright lands.
    const open = fight();
    act(open, "fiend", "Scare", ["mage"]);
    assert.ok(tracked(open, "mage", "frightened"));
    // One already on stays when the ward goes up, and a fresh one from the fiend is still kept off.
    who(open, "mage").tracked.push({ condition: "warded", rounds: null });
    act(open, "fiend", "Scare", ["mage"]);
    assert.equal(tracked(open, "mage", "frightened")?.source, "fiend", "the old fright stays");
    // A ward against charm only keeps fright out of nothing.
    const charmOnly = fight();
    who(charmOnly, "mage").tracked.push({ condition: "charmward", rounds: null });
    act(charmOnly, "fiend", "Scare", ["mage"]);
    assert.ok(tracked(charmOnly, "mage", "frightened"), "not a fright ward");
  }

  // ── Hideous Laughter: Intelligence 5 or more ──
  {
    const state = fight({ dragon: { int: 4 }, fiend: { int: 5 } });
    const targets = rulesetOptionTargets(definition, state, "mage", optionOf(state, "mage", "Laughter"));
    assert.ok(!targets.includes("dragon"), "Int 4 is passed over");
    assert.ok(targets.includes("fiend"), "Int 5 is not");
    assert.ok(targets.includes("beast"), "a creature written with no Int is not kept out");
  }

  // ── Dragon Scale Mail: the breath and Frightful Presence, not the Wing Attack ──
  {
    const scaledFight = () => {
      const state = fight();
      who(state, "mage").tracked.push({ condition: "scaled", rounds: null });
      return state;
    };
    assert.equal(saveOf(act(scaledFight(), "dragon", "Fire Breath", ["mage"]), "mage").mode, "advantage", "by group");
    assert.equal(
      saveOf(act(scaledFight(), "dragon", "Wing Attack", ["mage"]), "mage").mode,
      undefined,
      "not the wings",
    );
    assert.equal(saveOf(act(scaledFight(), "fiend", "Fire Breath", ["mage"]), "mage").mode, undefined, "not a fiend");
    const feared = scaledFight();
    assert.equal(saveOf(act(feared, "dragon", "Frightful Presence", ["mage"]), "mage").mode, "advantage", "by id");
    assert.deepEqual(tracked(feared, "mage", "frightened")?.action, ["frightful_presence", "Frightful Presence"]);
    // The save at the end of the holder's turn is against Frightful Presence too.
    feared.turn = feared.order.indexOf("mage");
    const turn = advanceRulesetTurn(definition, feared, roll);
    assert.equal(saveOf(turn.events, "mage").mode, "advantage", "the repeated save");
    // A save its holder makes when hurt is against the action that put it on, whoever hurts them.
    const roared = scaledFight();
    act(roared, "dragon", "Roar", ["mage"]);
    assert.ok(tracked(roared, "mage", "frightened"));
    const hurt = act(roared, "fiend", "Fire Breath", ["mage"]);
    const shaken = hurt.find((one) => one.type === "save" && one.save === "wis_save");
    assert.ok(shaken && shaken.type === "save", "a save on being hurt");
    assert.equal(shaken.mode, "advantage", "against the Roar");
    // Actions alone, by name and in any case.
    const winded = fight();
    who(winded, "mage").tracked.push({ condition: "winded", rounds: null });
    assert.equal(saveOf(act(winded, "dragon", "Wing Attack", ["mage"]), "mage").mode, "disadvantage");
    assert.equal(saveOf(act(winded, "fiend", "Fire Breath", ["mage"]), "mage").mode, undefined);
    // Straight from the matcher: actions narrow whatever else is named.
    const against = scaled.against as never;
    assert.equal(rulesetSaveAgainstMatches(against, { from: { type: "dragon", tags: [] } }), false, "no action");
    assert.equal(
      rulesetSaveAgainstMatches(against, { from: { type: "dragon", tags: [] }, action: ["BREATH_WEAPONS"] }),
      true,
    );
    assert.equal(
      rulesetSaveAgainstMatches(against, { from: { type: "fiend", tags: [] }, action: ["breath_weapons"] }),
      false,
    );
    assert.equal(
      rulesetSaveAgainstMatches({ actions: ["x"], damage: ["fire"] } as never, { action: ["x"], damage: ["cold"] }),
      false,
      "and damage too, when it names damage",
    );
  }

  // ── Import refusals ──
  {
    const refusedDoc = (edit: (doc: Record<string, any>) => void, message: RegExp) => {
      const result = parseRulesetDefinition(fiveE(edit));
      assert.equal(result.ok, false, `expected a refusal matching ${message}`);
      assert.ok(
        !result.ok && result.issues.some((issue) => message.test(issue)),
        !result.ok ? result.issues.join("; ") : "",
      );
    };
    const ward = (entry: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.combat.conditions.find((one: { condition: string }) => one.condition === "warded").conditionImmunitiesFrom = [
        entry,
      ];
    };
    refusedDoc(ward({ conditions: ["dazzled"], from: { types: ["fiend"] } }), /Unknown condition "dazzled"/);
    refusedDoc(ward({ conditions: ["charmed"], from: { types: ["robot"] } }), /Unknown creature type "robot"/);
    refusedDoc(ward({ conditions: ["charmed"] }), /conditionImmunitiesFrom/);
    refusedDoc((doc) => {
      doc.catalogs.push({
        id: "spells",
        label: "Spells",
        feeds: ["spells"],
        entries: [spell("joke", { kind: "debuff", targetTypes: { abilityAtLeast: { luck: 3 } } })],
      });
    }, /Unknown ability "luck"/);
    refusedDoc((doc) => {
      doc.combat.conditions.push({
        condition: "poisoned",
        modifiers: [{ to: "saves", mode: "advantage", against: { actions: [] } }],
      });
    }, /actions/);
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
      "A ruleset with conditions that keep heals off or keep conditions off by who puts them on, targets that need an ability score of at least some number, or saves against named actions requires schemaVersion 2 and capabilityApi 1.191 or newer";
    const plain = () => JSON.parse(fiveEText) as Record<string, any>;
    const condition = (entry: Record<string, unknown>) => {
      const doc = plain();
      doc.combat.conditions.push({ condition: "poisoned", ...entry });
      return doc;
    };
    const withSpell = (mechanics: Record<string, unknown>) => {
      const doc = plain();
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("joke", mechanics)] });
      return doc;
    };
    for (const [label, doc] of [
      ["cannot-heal", condition({ effects: ["cannot-heal"] })],
      [
        "immunity from",
        condition({ conditionImmunitiesFrom: [{ conditions: ["charmed"], from: { types: ["fiend"] } }] }),
      ],
      ["ability at least", withSpell({ kind: "debuff", targetTypes: { abilityAtLeast: { int: 5 } } })],
      ["save actions", condition({ modifiers: [{ to: "saves", mode: "advantage", against: { actions: ["bite"] } }] })],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(190) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(191) as never, doc), gate, label);
    }
    // A reaction's own `against.actions` is older, and an Animal Friendship ceiling is 1.185's.
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(190) as never,
        withSpell({ kind: "debuff", targetTypes: { abilityAtMost: { int: 3 } } }),
      ),
      gate,
    );
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(190) as never,
        condition({ modifiers: [{ to: "saves", mode: "advantage", against: { magic: true } }] }),
      ),
      gate,
    );
    // Named actions anywhere but a saves modifier are not this minor's.
    assert.notEqual(
      getCapabilityPackageInstallIssue(
        manifest(190) as never,
        condition({ modifiers: [{ to: "attacks", flat: 1, against: { actions: ["bite"] } }] }),
      ),
      gate,
    );
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(190) as never, plain()), gate, "plain 5e");
  }

  console.log(
    "Ruleset heal wards: Chill Touch keeps heals off, Protection from Evil and Good keeps a fiend's fright away, Hideous Laughter skips the dim, and dragon scale mail helps against a dragon's breath and Frightful Presence but not its Wing Attack.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
