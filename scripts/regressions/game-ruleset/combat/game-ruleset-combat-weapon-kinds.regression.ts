/**
 * Weapons that know what they hit (Capability API 1.187).
 *
 *   - `against`: a mace of smiting is more accurate against constructs, in the roll and the forecast.
 *   - `plus` clauses: `not` (a sword of life stealing feeds on no construct), `tempHp` (and its wielder
 *     gains what it dealt), `blow` (a dwarven thrower's extra only when hurled).
 *   - `onHit`: `targetIs` (a giant slayer fells giants only) and `oncePerTurn` (a sword of wounding).
 *   - `slay`: a mace of disruption destroys a low undead on a failed save, a nine lives stealer slays
 *     on a critical while it has charges and spends one, a vorpal sword beheads on a critical unless
 *     the target has no head or is immune to slashing.
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
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogItem,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-weapon-kinds-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 182);
  const fiveE = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const weapon = (name: string, extras: Record<string, unknown>, item: Record<string, unknown> = {}) =>
    ({
      name,
      quantity: 1,
      worn: true,
      item: {
        category: "gear",
        slots: { hands: 1 },
        attack: {
          budget: "action",
          toHit: { abilities: ["str"] },
          damage: { dice: "1d8", abilities: ["str"], type: "slashing" },
          ...extras,
        },
        ...item,
      } as RulesetCatalogItem,
    }) as RulesetSheetItem;
  const smiting = weapon("Smiting", { against: [{ is: { types: ["construct"] }, toHit: 20 }] });
  const stealing = weapon("Stealing", {
    plus: [
      {
        dice: "3d6",
        type: "necrotic",
        when: "critical",
        not: { types: ["construct", "undead"] },
        tempHp: true,
      },
    ],
  });
  const thrower = weapon("Thrower", {
    reach: 5,
    range: { normal: 20, long: 60 },
    plus: [{ dice: "1d8", type: "bludgeoning", blow: "ranged" }],
  });
  const slayer = weapon("Slayer", {
    onHit: [
      { condition: "prone", atLeast: 1, targetIs: { types: ["giant"] }, save: { save: "str_save", difficulty: 15 } },
    ],
  });
  const wounding = weapon("Wounding", {
    onHit: [
      {
        condition: "wounded",
        atLeast: 1,
        oncePerTurn: true,
        saveEnds: { save: "con_save", difficulty: 15, at: "turn-start" },
      },
    ],
  });
  const disruption = weapon("Disruption", {
    slay: [{ is: { types: ["undead"] }, healthAtMost: 25, save: { save: "wis_save", difficulty: 15 } }],
  });
  const stealer = (charges?: number) => ({
    ...weapon(
      "Stealer",
      { slay: [{ when: "critical", healthAtMost: 99, save: { save: "con_save", difficulty: 15 }, charges: 1 }] },
      { charges: { max: 3 }, stack: 1 },
    ),
    ...(charges !== undefined ? { charges } : {}),
  });
  const vorpal = weapon("Vorpal", {
    slay: [{ when: "critical", not: { tags: ["headless"] }, immuneTo: ["slashing"] }],
  });

  const document = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(fiveE);
    doc.combat.creatureTypes = {
      types: ["beast", "construct", "undead", "giant"].map((id) => ({ id, label: id })),
      tags: [{ id: "headless", label: "Headless" }],
    };
    doc.sheet.live.conditions.push({ id: "wounded", label: "Wounded" });
    doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
    edit(doc);
    return doc;
  };
  const parse = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parse(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    fields: { level: 3, ac: 12, speed: 30, hp_max: 100 },
  });
  const creature = (id: string, extra: Partial<RulesetStatBlock> = {}) => ({
    id,
    name: id,
    side: "enemy" as const,
    block: {
      health: 200,
      defense: 5,
      initiativeModifier: -20,
      type: "beast",
      saves: { con_save: 0, str_save: 0, wis_save: 0 },
      actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 0, damage: { count: 0, sides: 0, flat: 1 } }],
      ...extra,
    } as RulesetStatBlock,
  });
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 10,
    tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")),
  });
  let d20 = 10;
  const roller = (sides: number) => (sides === 20 ? d20 : 2);
  const fight = (items: RulesetSheetItem[], foe: Partial<RulesetStatBlock> = {}, far?: boolean) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller,
      combatants: [{ id: "hero", name: "Hero", side: "party", build, live: {}, items }, creature("foe", foe)],
      ...(far !== undefined
        ? { board: { grid: grid(), placements: { hero: { x: 2, y: 5 }, foe: { x: far ? 8 : 3, y: 5 } } } }
        : {}),
    });
    state.turn = state.order.indexOf("hero");
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const optionOf = (state: RulesetEncounterState, label: string) => {
    const option = rulesetCombatOptions(definition, state, "hero").find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    return option;
  };
  const hit = (state: RulesetEncounterState, label: string, face = 10) => {
    d20 = face;
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: optionOf(state, label).id, targetIds: ["foe"] },
      roller,
    );
    d20 = 10;
    return step;
  };
  const strike = (items: RulesetSheetItem[], label: string, foe: Partial<RulesetStatBlock> = {}, face = 10) =>
    hit(fight(items, foe), label, face);
  const dealt = (events: RulesetCombatEvent[]) =>
    events
      .filter((one): one is Extract<RulesetCombatEvent, { type: "damage" }> => one.type === "damage")
      .reduce((total, one) => total + one.dealt, 0);
  const landed = (events: RulesetCombatEvent[]) =>
    events.some((one) => one.type === "attack" && one.outcome !== "miss");
  const slain = (events: RulesetCombatEvent[]) => events.some((one) => one.type === "slain");
  const health = (state: RulesetEncounterState, id: string) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, id)).value;
  const temp = (state: RulesetEncounterState) =>
    rulesetCombatHealth(definition, definition.combat!, who(state, "hero")).temp ?? 0;

  // ── A mace of smiting finds a construct ──
  {
    assert.ok(!landed(strike([smiting], "Smiting", { defense: 25 }).events), "a beast's hide turns it");
    const golem = strike([smiting], "Smiting", { defense: 25, type: "construct" });
    assert.ok(landed(golem.events), "a construct's does not");
    const roll = golem.events.find((one) => one.type === "attack");
    assert.ok(roll && roll.type === "attack" && roll.modifier >= 20, "the roll says what it added");
    const chance = (type: string) =>
      optionOf(fight([smiting], { defense: 25, type }), "Smiting").forecast?.hitChance ?? 0;
    assert.ok(chance("construct") > chance("beast"), "and the forecast knows it");
  }

  // ── A sword of life stealing ──
  {
    const fed = strike([stealing], "Stealing", {}, 20);
    // The blade's 1d8 + 4 doubled to 2+2+4, then 3d6 doubled to twelve 2s... six dice of 2.
    assert.ok(fed.events.some((one) => one.type === "damage" && one.damageType === "necrotic"));
    assert.equal(temp(fed.state), 12, "the wielder gains what the necrotic dealt");
    const golem = strike([stealing], "Stealing", { type: "construct" }, 20);
    assert.ok(
      !golem.events.some((one) => one.type === "damage" && one.damageType === "necrotic"),
      "nothing to feed on",
    );
    assert.equal(temp(golem.state), 0);
    const plain = strike([stealing], "Stealing");
    assert.equal(temp(plain.state), 0, "only a critical");
    // A creature that shrugs off necrotic gives nothing.
    const warded = strike([stealing], "Stealing", { immune: ["necrotic"] }, 20);
    assert.equal(temp(warded.state), 0, "what was dealt, not what was rolled");
  }

  // ── A dwarven thrower adds only when it flies ──
  {
    const near = hit(fight([thrower], {}, false), "Thrower");
    assert.equal(dealt(near.events), 6, "swung in hand");
    const far = hit(fight([thrower], {}, true), "Thrower");
    assert.equal(dealt(far.events), 8, "hurled, 1d8 more");
  }

  // ── A giant slayer fells giants ──
  {
    const wolf = strike([slayer], "Slayer");
    assert.ok(!rulesetCombatConditions(definition, who(wolf.state, "foe")).includes("prone"));
    assert.ok(!wolf.events.some((one) => one.type === "save"), "no save to make");
    const giant = strike([slayer], "Slayer", { type: "giant" });
    assert.ok(rulesetCombatConditions(definition, who(giant.state, "foe")).includes("prone"));
  }

  // ── A sword of wounding wounds once a turn ──
  {
    const wounded = (events: RulesetCombatEvent[]) =>
      events.some((one) => one.type === "condition" && one.condition === "wounded" && one.reason === "applied");
    const first = hit(fight([wounding]), "Wounding");
    assert.ok(wounded(first.events));
    who(first.state, "hero").budgets.action = 1;
    const second = hit(first.state, "Wounding");
    assert.ok(landed(second.events) && !wounded(second.events), "the second hit this turn wounds no more");
    // Another turn, and another wound may be dealt.
    second.state.round += 1;
    who(second.state, "hero").budgets.action = 1;
    assert.ok(wounded(hit(second.state, "Wounding").events), "a new turn");
  }

  // ── A mace of disruption ──
  {
    const low = strike([disruption], "Disruption", { type: "undead", health: 30 });
    assert.ok(slain(low.events), "left at 24, it fails and is destroyed");
    assert.ok(who(low.state, "foe").defeated);
    assert.equal(health(low.state, "foe"), 0);
    assert.ok(!slain(strike([disruption], "Disruption", { type: "undead", health: 40 }).events), "left at 34");
    assert.ok(
      !slain(strike([disruption], "Disruption", { type: "undead", health: 30, saves: { wis_save: 20 } }).events),
      "saved",
    );
    assert.ok(!slain(strike([disruption], "Disruption", { type: "beast", health: 30 }).events), "not undead");
    // A blow that deals nothing destroys nothing, however low they already were.
    assert.ok(
      !slain(strike([disruption], "Disruption", { type: "undead", health: 20, immune: ["slashing"] }).events),
      "nothing dealt",
    );
    // A miss destroys nothing.
    assert.ok(!slain(strike([disruption], "Disruption", { type: "undead", health: 30 }, 1).events));
  }

  // ── A nine lives stealer ──
  // The critical's d20 is the save's too, so a target that fails has a save far below it.
  {
    const crit = strike([stealer()], "Stealer", { health: 100, saves: { con_save: -20 } }, 20);
    assert.ok(slain(crit.events), "a critical on somebody left under 100");
    assert.equal(who(crit.state, "hero").charges?.[0], 2, "a charge spent");
    assert.ok(
      !slain(strike([stealer()], "Stealer", { health: 100, saves: { con_save: -20 } }).events),
      "only a critical",
    );
    assert.ok(
      !slain(strike([stealer()], "Stealer", { health: 200, saves: { con_save: -20 } }, 20).events),
      "too much life left",
    );
    assert.ok(
      !slain(strike([stealer(0)], "Stealer", { health: 100, saves: { con_save: -20 } }, 20).events),
      "no charges left",
    );
    // Charges read off a stat the item does not give: it never slays.
    const unread = {
      ...stealer(),
      item: { ...stealer().item, charges: { max: { stat: "nope" } } } as RulesetCatalogItem,
    };
    assert.ok(!slain(strike([unread], "Stealer", { health: 100, saves: { con_save: -20 } }, 20).events), "no count");
    const missed = strike([stealer()], "Stealer", { health: 100, saves: { con_save: 20 } }, 20);
    assert.ok(!slain(missed.events));
    assert.equal(who(missed.state, "hero").charges?.[0], undefined, "a save spends nothing");
  }

  // ── A vorpal sword ──
  {
    assert.ok(slain(strike([vorpal], "Vorpal", {}, 20).events), "off with its head");
    assert.ok(!slain(strike([vorpal], "Vorpal").events), "only a critical");
    assert.ok(!slain(strike([vorpal], "Vorpal", { tags: ["headless"] }, 20).events), "no head");
    assert.ok(!slain(strike([vorpal], "Vorpal", { immune: ["slashing"] }, 20).events), "immune to the blade");
    // Immune to what the slay names, though the blow itself hurt: still spared.
    const club = weapon("Club", {
      damage: { dice: "1d8", abilities: ["str"], type: "bludgeoning" },
      slay: [{ when: "critical", immuneTo: ["slashing"] }],
    });
    const spared = strike([club], "Club", { immune: ["slashing"] }, 20);
    assert.ok(dealt(spared.events) > 0 && !slain(spared.events), "spared by its immunity alone");
    // Slain: out of the fight as anybody taken down is.
    const head = strike([vorpal], "Vorpal", {}, 20);
    assert.ok(
      head.events.some((one) => one.type === "defeated" && one.actorId === "foe"),
      "defeated",
    );
    assert.equal(health(head.state, "foe"), 0, "with nothing left");
  }

  // ── Import refusals ──
  {
    const withItem = (item: RulesetSheetItem["item"]) =>
      document((doc) => {
        doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "w", label: "W", item }] });
      });
    for (const one of [smiting, stealing, thrower, slayer, wounding, disruption, stealer(), vorpal])
      parse(withItem(one.item));
    const refused = (item: RulesetSheetItem["item"], message: RegExp) => {
      const result = parseRulesetDefinition(withItem(item));
      assert.ok(
        !result.ok && result.issues.some((issue) => message.test(issue)),
        result.ok ? "accepted" : result.issues.join("; "),
      );
    };
    const attack = (extras: Record<string, unknown>) => weapon("X", extras).item;
    refused(attack({ against: [{ is: { types: ["robot"] }, toHit: 2 }] }), /Unknown creature type "robot"/);
    refused(attack({ plus: [{ dice: "1d6", not: { types: ["robot"] } }] }), /Unknown creature type "robot"/);
    refused(
      attack({ onHit: [{ condition: "prone", atLeast: 1, targetIs: { types: ["robot"] } }] }),
      /Unknown creature type "robot"/,
    );
    refused(attack({ slay: [{ is: { types: ["robot"] } }] }), /Unknown creature type "robot"/);
    refused(attack({ slay: [{ not: { types: ["robot"] } }] }), /Unknown creature type "robot"/);
    refused(attack({ slay: [{ save: { save: "luck_save", difficulty: 10 } }] }), /Unknown save "luck_save"/);
    refused(attack({ slay: [{ immuneTo: ["shiny"] }] }), /Unknown damage type "shiny"/);
    refused(attack({ slay: [{ healthAtMost: 5, charges: 1 }] }), /spends charges is on an item that holds some/);
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
      "A ruleset with weapons that hit harder by what they hit, slay, drain, add only when thrown, or wound once a turn requires schemaVersion 2 and capabilityApi 1.187 or newer";
    const withItem = (item: RulesetSheetItem["item"]) =>
      document((doc) => {
        doc.catalogs.push({ id: "gear", label: "Gear", holds: "items", entries: [{ id: "w", label: "W", item }] });
      });
    for (const [label, one] of [
      ["against", smiting],
      ["not + tempHp", stealing],
      ["blow", thrower],
      ["onHit targetIs", slayer],
      ["oncePerTurn", wounding],
      ["slay", vorpal],
    ] as const) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(186) as never, withItem(one.item)), gate, label);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(187) as never, withItem(one.item)), gate, label);
    }
    for (const [label, plus] of [
      ["not", { dice: "1d6", not: { types: ["beast"] } }],
      ["tempHp", { dice: "1d6", tempHp: true }],
    ] as const) {
      assert.equal(
        getCapabilityPackageInstallIssue(manifest(186) as never, withItem(weapon("X", { plus: [plus] }).item)),
        gate,
        label,
      );
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(186) as never, document()), gate, "the plain 5e example");
  }

  console.log(
    "Ruleset weapon kinds: a mace of smiting finds constructs, life stealing feeds its wielder, a thrower adds only in flight, a giant slayer fells giants, wounding lands once a turn, and disruption, a nine lives stealer and a vorpal sword kill outright.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
