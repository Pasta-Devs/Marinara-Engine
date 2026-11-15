/**
 * What a creature is, read further (Capability API 1.185).
 *
 *   - `save.modes`: a target that is this rolls the save twice (Sunbeam against undead).
 *   - `maxAgainst`: damage at its most against a kind (Blight against plants).
 *   - `targetTypes.abilityAtMost` and `notImmuneTo`: Animal Friendship, Sleep.
 *   - Modifiers that roll attacks twice: the holder's own against their source (Chill Touch), and
 *     attacks taken from attackers of a kind (Protection from Evil and Good); saves `against.from` a
 *     kind of creature (Dragon Scale Mail).
 *   - Import refusals, and the install gate.
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
  rulesetAttackMode,
  rulesetCombatant,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-kinds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 180);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const withKinds = (doc: Record<string, any>) => {
    doc.combat.creatureTypes = {
      types: ["humanoid", "undead", "plant", "beast", "fiend", "dragon", "construct"].map((id) => ({ id, label: id })),
      tags: [{ id: "shapechanger", label: "Shapechanger" }],
      default: "humanoid",
    };
    doc.sheet.live.conditions.push(
      { id: "pfeg", label: "Protection from Evil and Good" },
      { id: "chilled", label: "Chill Touch" },
      { id: "dragonward", label: "Dragon Scale Mail" },
      { id: "outlined", label: "Outlined" },
    );
    doc.combat.conditions.push(
      {
        condition: "pfeg",
        modifiers: [{ to: "attacks-taken", mode: "disadvantage", from: { types: ["fiend", "undead"] } }],
      },
      { condition: "chilled", modifiers: [{ to: "attacks", mode: "disadvantage", atSource: true }] },
      {
        condition: "dragonward",
        modifiers: [{ to: "saves", mode: "advantage", against: { from: { types: ["humanoid"] } } }],
      },
      { condition: "outlined", modifiers: [{ to: "attacks-taken", mode: "advantage" }] },
    );
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    withKinds(doc);
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
  const sunbeam = spell("sunbeam", {
    kind: "attack",
    range: 60,
    amount: { flat: 6 },
    damageType: "radiant",
    save: {
      save: "con_save",
      onSuccess: "half",
      modes: [
        { is: { types: ["undead"], tags: ["shapechanger"] }, mode: "disadvantage" },
        { is: { types: ["construct"] }, mode: "advantage" },
      ],
    },
  });
  const blight = spell("blight", {
    kind: "attack",
    autoHit: true,
    range: 30,
    amount: { dice: "2d8" },
    damageType: "necrotic",
    maxAgainst: { types: ["plant"] },
  });
  const friend = spell("friend", {
    kind: "debuff",
    range: 30,
    targetTypes: { is: { types: ["beast"] }, abilityAtMost: { int: 3 } },
    applies: [{ condition: "charmed", duration: { rounds: 1 } }],
  });
  const sleep = spell("sleep", {
    kind: "debuff",
    range: 30,
    targetTypes: { notImmuneTo: ["charmed"] },
    applies: [{ condition: "unconscious", duration: { rounds: 1 } }],
  });
  const spells = [sunbeam, blight, friend, sleep];
  const definition = parsed(
    fiveE((doc) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells });
    }),
  );
  const combat = definition.combat!;
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 100,
    defense: 5,
    initiativeModifier: 0,
    speed: 30,
    saves: { con_save: 0 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
    ...extra,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  // A d20 shows 10; every other die shows 1.
  const roll = (sides: number) => (sides === 20 ? 10 : 1);
  const fight = (blocks: Record<"a" | "b" | "c", Partial<RulesetStatBlock>>): RulesetEncounterState => {
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
        { id: "a", name: "A", side: "enemy", block: block(blocks.a) },
        { id: "b", name: "B", side: "enemy", block: block(blocks.b) },
        { id: "c", name: "C", side: "enemy", block: block(blocks.c) },
      ],
      board: {
        grid: grid(),
        placements: { mage: { x: 2, y: 7 }, a: { x: 4, y: 7 }, b: { x: 4, y: 8 }, c: { x: 4, y: 6 } },
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const hp = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, combat, who(state, id)).value;
  const optionOf = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "mage").find((one) => one.label === label)!;
  const cast = (state: RulesetEncounterState, label: string, targetIds: string[]) =>
    applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "mage", optionId: optionOf(state, label).id, targetIds },
      roll,
    );
  const saveOf = (events: RulesetCombatEvent[], id: string) => {
    const found = events.find((one) => one.type === "save" && one.actorId === id);
    assert.ok(found && found.type === "save", `no save by ${id}`);
    return found;
  };

  // ── Sunbeam: undead and shapechangers roll twice and keep the worse ──
  {
    const state = fight({
      a: { type: "undead" },
      b: { type: "beast" },
      c: { type: "humanoid", tags: ["shapechanger"] },
    });
    const undead = cast(state, "Sunbeam", ["a"]);
    assert.equal(saveOf(undead.events, "a").mode, "disadvantage");
    assert.equal(saveOf(undead.events, "a").rolls.length, 2);
    assert.equal(saveOf(cast(state, "Sunbeam", ["b"]).events, "b").mode, undefined, "a beast rolls once");
    assert.equal(saveOf(cast(state, "Sunbeam", ["c"]).events, "c").mode, "disadvantage", "by tag too");
    const golem = fight({ a: { type: "construct" }, b: {}, c: {} });
    assert.equal(saveOf(cast(golem, "Sunbeam", ["a"]).events, "a").mode, "advantage", "a mode the other way");
  }

  // ── Blight: at its most against a plant ──
  {
    const state = fight({ a: { type: "plant" }, b: { type: "beast" }, c: {} });
    assert.equal(hp(cast(state, "Blight", ["a"]).state, "a"), 100 - 16, "two eights");
    assert.equal(hp(cast(state, "Blight", ["b"]).state, "b"), 100 - 2, "two ones, as rolled");
  }

  // ── Animal Friendship and Sleep: who may be picked ──
  {
    const state = fight({
      a: { type: "beast", abilities: { int: 2 } },
      b: { type: "beast", abilities: { int: 6 } },
      c: { type: "beast", conditionImmunities: ["charmed"] },
    });
    const friendly = rulesetOptionTargets(definition, state, "mage", optionOf(state, "Friend"));
    assert.deepEqual(friendly.sort(), ["a", "c"], "Int 2, and a beast written with no Int; not Int 6");
    const sleepy = rulesetOptionTargets(definition, state, "mage", optionOf(state, "Sleep"));
    assert.deepEqual(sleepy.sort(), ["a", "b"], "not the one that cannot be charmed");
    const refused = cast(state, "Friend", ["b"]);
    assert.ok(refused.events.some((one) => one.type === "refused"));
  }

  // ── Protection from Evil and Good, Chill Touch ──
  {
    const state = fight({ a: { type: "fiend" }, b: { type: "beast" }, c: { type: "undead" } });
    const mage = who(state, "mage");
    mage.tracked.push({ condition: "pfeg", rounds: null });
    assert.equal(rulesetAttackMode(definition, combat, who(state, "a"), mage), "disadvantage", "a fiend attacking");
    assert.equal(rulesetAttackMode(definition, combat, who(state, "b"), mage), "normal", "a beast attacking");
    // Chill Touch on the undead C, from the mage: its attacks on the mage only.
    who(state, "c").tracked.push({ condition: "chilled", rounds: 1, source: "mage" });
    mage.tracked.length = 0;
    assert.equal(rulesetAttackMode(definition, combat, who(state, "c"), mage), "disadvantage");
    assert.equal(rulesetAttackMode(definition, combat, who(state, "c"), who(state, "b")), "normal", "anybody else");
    // Both leaning one way is still one disadvantage; the other way cancels it.
    mage.tracked.push({ condition: "pfeg", rounds: null });
    assert.equal(rulesetAttackMode(definition, combat, who(state, "c"), mage), "disadvantage");
    who(state, "c").flags.helped = true;
    assert.equal(rulesetAttackMode(definition, combat, who(state, "c"), mage), "normal");
    // Attacks against an outlined holder roll twice and keep the better, whoever attacks.
    who(state, "b").tracked.push({ condition: "outlined", rounds: 1 });
    assert.equal(rulesetAttackMode(definition, combat, who(state, "a"), who(state, "b")), "advantage");
  }

  // ── A save against what a kind of creature does ──
  {
    const state = fight({ a: {}, b: {}, c: {} });
    who(state, "a").tracked.push({ condition: "dragonward", rounds: null });
    // The mage is a humanoid by the ruleset's default.
    assert.equal(saveOf(cast(state, "Sunbeam", ["a"]).events, "a").mode, "advantage");
    assert.equal(saveOf(cast(state, "Sunbeam", ["b"]).events, "b").mode, undefined);
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
    const modifier = (one: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.combat.conditions.find((entry: any) => entry.condition === "pfeg").modifiers = [one];
    };
    refusedDoc(modifier({ to: "defense", mode: "advantage" }), /"mode" rolls checks, saves or attacks twice/);
    refusedDoc(modifier({ to: "attacks-taken", flat: 2 }), /"attacks-taken" rolls attacks against the holder twice/);
    refusedDoc(
      modifier({ to: "saves", mode: "advantage", from: { types: ["fiend"] } }),
      /"from" narrows attacks-taken only/,
    );
    refusedDoc(modifier({ to: "damage", flat: 2, atSource: true }), /"atSource" narrows the holder's own attacks only/);
    refusedDoc(
      modifier({ to: "attacks-taken", mode: "advantage", from: { types: ["robot"] } }),
      /Unknown creature type "robot"/,
    );
    refusedDoc(
      modifier({ to: "saves", mode: "advantage", against: { from: { tags: ["winged"] } } }),
      /Unknown creature tag "winged"/,
    );
    const withSpell = (mechanics: Record<string, unknown>) => (doc: Record<string, any>) => {
      doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [spell("x", mechanics)] });
    };
    const base = { kind: "debuff", range: 30, applies: [{ condition: "charmed", duration: { rounds: 1 } }] };
    refusedDoc(withSpell({ ...base, targetTypes: { abilityAtMost: { luck: 3 } } }), /Unknown ability "luck"/);
    refusedDoc(withSpell({ ...base, targetTypes: { notImmuneTo: ["sneezy"] } }), /Unknown condition "sneezy"/);
    refusedDoc(withSpell({ ...base, maxAgainst: { types: ["robot"] } }), /Unknown creature type "robot"/);
    refusedDoc(
      withSpell({
        ...base,
        save: { save: "con_save", onSuccess: "negates", modes: [{ is: { types: ["robot"] }, mode: "advantage" }] },
      }),
      /Unknown creature type "robot"/,
    );
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
      "A ruleset with saves or damage that change by what the target is, targets limited by ability scores or condition immunities, or changes to attacks that roll twice by who is attacking whom, requires schemaVersion 2 and capabilityApi 1.185 or newer";
    const plain = () => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      return doc;
    };
    const withEntries = (entries: unknown[]) => {
      const doc = plain();
      doc.catalogs.push({ id: "x", label: "X", entries });
      return doc;
    };
    const withModifier = (one: Record<string, unknown>) => {
      const doc = plain();
      doc.combat.conditions.push({ condition: "x", modifiers: [one] });
      return doc;
    };
    const docs: Array<[string, Record<string, any>]> = [
      ["save modes", withEntries([sunbeam])],
      ["max against", withEntries([blight])],
      ["ability at most", withEntries([friend])],
      ["not immune to", withEntries([sleep])],
      ["attacks-taken", withModifier({ to: "attacks-taken", mode: "disadvantage" })],
      ["attacks mode", withModifier({ to: "attacks", mode: "advantage" })],
      ["at source", withModifier({ to: "attacks", mode: "disadvantage", atSource: true })],
      ["against from", withModifier({ to: "saves", mode: "advantage", against: { from: { types: ["dragon"] } } })],
    ];
    for (const [label, doc] of docs) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(184) as never, doc), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(185) as never, doc), gate, label);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(184) as never, plain()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset creature kinds: Sunbeam is harder for undead, Blight is at its most on plants, Animal Friendship and Sleep pass over who they cannot affect, Protection from Evil and Good and Chill Touch roll attacks twice, and Dragon Scale Mail's saves read who they are against.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
