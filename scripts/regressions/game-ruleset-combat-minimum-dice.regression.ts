/** Capability API 1.146–1.148: minimum damage dice, one-hit daze and target wound-kind remaps. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  advanceRulesetTurn,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  currentRulesetActor,
  liftRulesetFightEffects,
  parseRulesetDefinition,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetCombatantInput,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-minimum-dice-"));
const previous = { DATA_DIR: process.env.DATA_DIR, FILE_STORAGE_DIR: process.env.FILE_STORAGE_DIR };
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
try {
  const [
    { getCapabilityPackageInstallIssue },
    { rulesetCombatEventLine, rulesetCombatNames },
    { buildRulesetCombatBossPrompt },
  ] = await Promise.all([
    import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
    import("../../packages/client/src/lib/ruleset-combat-log.js"),
    import("../../packages/server/src/services/game/combat-boss.service.js"),
  ]);
  const text = readFileSync(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8")
    .replaceAll('"knock"', '"bashing"')
    .replaceAll('"tear"', '"lethal"');
  const raw = (edit: (doc: any) => void = () => {}) => {
    const doc = JSON.parse(text);
    delete doc.combat.initiative.each;
    delete doc.resolution.penaltyFrom;
    doc.combat.initiative.modifier = { const: 0 };
    doc.combat.pool.soak = { roll: false, byKind: { bashing: { abilityScore: "sinew" } } };
    doc.combat.economy.budgets[0].count = 3;
    const track = doc.sheet.live.tracks[0];
    track.max = 16;
    track.levels = Array.from({ length: 16 }, (_, i) => ({ label: `Level ${i + 1}`, penalty: 0 }));
    track.kinds[0].label = "Bashing";
    track.kinds[1].label = "Lethal";
    doc.sheet.live.conditions.push({ id: "dazed", label: "Dazed" });
    doc.sheet.fields.push({
      id: "vampire",
      label: "Vampire",
      type: "number",
      min: 0,
      max: 1,
      default: 0,
      section: "about",
    });
    doc.items.tags.push({ id: "firearm", label: "Firearm" });
    const pistol = doc.catalogs.find((c: any) => c.id === "kit").entries.find((e: any) => e.id === "watch-pistol").item;
    pistol.tags = ["firearm"];
    pistol.attack = { budget: "act", toHit: { bonus: 1 }, damage: { dice: "3d10", type: "tearing" } };
    edit(doc);
    return doc;
  };
  const definition = (edit: (doc: any) => void = () => {}) => {
    const parsed = parseRulesetDefinition(raw(edit));
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("\n"));
    return parsed.definition;
  };
  const refuses = (edit: (doc: any) => void, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(raw(edit));
    assert.ok(!parsed.ok, "invalid rule must be refused");
    assert.match(parsed.issues.join("\n"), pattern);
  };
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let at = 0;
    return (sides) => {
      assert.ok(at < faces.length, `unexpected d${sides}`);
      const face = faces[at++]!;
      assert.ok(face >= 1 && face <= sides);
      return face;
    };
  };
  const unit = (id: string, side: "party" | "enemy", stamina = 1, vampire = 0): RulesetCombatantInput => {
    const build = rulesetSheetBuildSchema.parse({
      abilities: { sinew: stamina, nerve: 1, warmth: 1 },
      fields: { vampire },
      skills: { dig: "rating_0" },
      lists: { arms: [{ name: "Strike", rating: "nerve", trade: "dig", dice: "3d10", harm: "tearing" }] },
    });
    return side === "party"
      ? { id, name: id, side, build, live: {} }
      : { id, name: id, side, block: { sheet: build, actions: [] } };
  };
  const pistol = (def: RulesetDefinition) =>
    def.catalogs!.find((c) => c.id === "kit")!.entries!.find((e) => e.id === "watch-pistol")!.item!;
  const equipped = (def: RulesetDefinition, id = "attacker", tags?: string[]): RulesetCombatantInput =>
    ({
      ...unit(id, "party"),
      items: [{ item: { ...pistol(def), ...(tags ? { tags } : {}) }, worn: true, quantity: 1, name: "Pistol" }],
    }) as RulesetCombatantInput;
  const start = (
    def: RulesetDefinition,
    inputs: RulesetCombatantInput[] = [unit("attacker", "party"), unit("target", "enemy", 2)],
  ) =>
    createRulesetEncounter({
      definition: def,
      seed: 1,
      combatants: inputs,
      roller: dice(...inputs.map((_, i) => 9 - i)),
    });
  const hit = (
    def: RulesetDefinition,
    state: RulesetEncounterState,
    faces: number[],
    label = "Strike",
    targetId = "target",
    actorId = "attacker",
  ) => {
    const option = rulesetCombatOptions(def, state, actorId).find((o) => o.label === label);
    assert.ok(option, `missing ${label}`);
    const step = applyRulesetCombatChoice(
      def,
      state,
      { actorId, optionId: option.id, targetIds: [targetId] },
      dice(...faces),
    );
    assert.equal(step.refused, undefined);
    return step;
  };
  const first = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) => {
    const event = events.find((e): e is Extract<RulesetCombatEvent, { type: T }> => e.type === type);
    assert.ok(event, `missing ${type}: ${JSON.stringify(events)}`);
    return event;
  };
  const advance = (def: RulesetDefinition, state: RulesetEncounterState, ...faces: number[]) =>
    advanceRulesetTurn(def, state, dice(...faces));
  const marks = (def: RulesetDefinition, state: RulesetEncounterState) => {
    const sheet = rulesetCombatant(state, "target")!.sheet!;
    return readRulesetLive(def, sheet.build, sheet.live).tracks[0]!.wound!;
  };
  const daze = (doc: any) => {
    doc.combat.daze = {
      over: { abilityScore: "sinew" },
      measure: "damage",
      condition: "dazed",
      text: "Reel from the blow.",
    };
  };
  const remap = (doc: any) => {
    doc.combat.damageKinds.remap = [{ when: { field: "vampire" }, from: "lethal", to: "bashing", tags: ["firearm"] }];
  };

  // Refusals cover both shapes and cross-references; existing kinds need no new API gate.
  refuses((d) => {
    d.combat.damage = { minimum: { field: "missing" } };
  }, /Unknown field/);
  refuses((d) => {
    d.combat.damage = { minimum: { const: -1 } };
  }, /cannot be negative/);
  refuses((d) => {
    d.combat.damage = { minimum: { const: 2 }, typo: true };
  }, /Unrecognized key/);
  refuses((d) => {
    daze(d);
    d.combat.daze.over = { abilityScore: "missing" };
  }, /Unknown ability/);
  refuses((d) => {
    daze(d);
    d.combat.daze.condition = "missing";
  }, /Unknown condition/);
  refuses((d) => {
    daze(d);
    d.combat.daze.measure = "total-wounds";
  }, /damage/);
  refuses((d) => {
    remap(d);
    d.combat.damageKinds.remap[0].when = { derived: "missing" };
  }, /Unknown derived/);
  for (const key of ["from", "to"] as const)
    refuses((d) => {
      remap(d);
      d.combat.damageKinds.remap[0][key] = "missing";
    }, /not a kind/);
  refuses((d) => {
    remap(d);
    d.combat.damageKinds.remap = Array(13).fill(d.combat.damageKinds.remap[0]);
  }, /12/);
  refuses((d) => {
    remap(d);
    d.combat.damageKinds.remap[0].tags = ["missing"];
  }, /Unknown item tag/);
  for (const edit of [
    (d: any) => {
      d.combat.damage = { minimum: { const: 1 } };
    },
    daze,
    remap,
  ]) {
    refuses((d) => {
      edit(d);
      d.combat.kind = "attack-vs-defense";
      d.combat.attackRoll = { dice: { count: 1, sides: 10 } };
    }, /need[s]? a "dice-pool" fight/);
  }
  refuses((d) => {
    const item = d.catalogs.find((c: any) => c.id === "kit").entries.find((e: any) => e.id === "watch-pistol").item;
    item.attack.damage.minimum = { stat: "harm" };
  }, /number/);

  // Heavy static soak leaves the attacker's minimum dice, not guaranteed successes. Extra hits still miss.
  const minimum = definition((d) => {
    d.combat.damage = { minimum: { abilityScore: "warmth" } };
    d.combat.pool.soak.all = { const: 50 };
  });
  const attacker = unit("attacker", "party");
  assert.ok("build" in attacker);
  attacker.build.abilities.warmth = 2;
  const minimumHit = hit(minimum, start(minimum, [attacker, unit("target", "enemy", 5)]), [7, 6, 2]);
  const minEvent = first(minimumHit.events, "damage");
  assert.deepEqual(minEvent.rolls, [6, 2]);
  assert.equal(minEvent.pool?.minimum, 2);
  assert.equal(minEvent.pool?.soak?.taken, 3);
  assert.equal(minEvent.dealt, 1);
  assert.equal(marks(minimum, minimumHit.state).filled, 1);
  assert.equal(
    first(hit(minimum, start(minimum, [attacker, unit("target", "enemy")]), [7, 2, 2]).events, "damage").dealt,
    0,
  );
  assert.ok(!hit(minimum, start(minimum), [2]).events.some((e) => e.type === "damage"));
  const forecast = rulesetCombatOptions(minimum, start(minimum, [attacker, unit("target", "enemy")]), "attacker").find(
    (o) => o.label === "Strike",
  )!.forecast;
  assert.equal(forecast?.averageDamage, 1);
  // A weapon overrides the shared floor, by its own stat or its holder's sheet.
  for (const value of [{ stat: "soak_blunt" }, { abilityScore: "sinew" }]) {
    const def = definition((d) => {
      d.combat.damage = { minimum: { const: 9 } };
      d.combat.pool.soak.all = { const: 50 };
      const item = d.catalogs.find((c: any) => c.id === "kit").entries.find((e: any) => e.id === "watch-pistol").item;
      item.stats.soak_blunt = 1;
      item.attack.damage.minimum = value;
    });
    const event = first(
      hit(def, start(def, [equipped(def), unit("target", "enemy")]), [7, 6], "Pistol").events,
      "damage",
    );
    assert.equal(event.pool?.minimum, 1);
    assert.deepEqual(event.rolls, [6]);
  }
  // Thrown soak still removes successes; a dice floor does not promise wound levels.
  const rolled = definition((d) => {
    d.combat.damage = { minimum: { const: 4 } };
    d.combat.pool.soak = { roll: true, all: { const: 4 } };
  });
  const rolledEvent = first(hit(rolled, start(rolled), [7, 6, 6, 6, 6, 6, 6, 6, 6]).events, "damage");
  assert.equal(rolledEvent.rolls.length, 4);
  assert.equal(rolledEvent.dealt, 0);

  // Strictly greater, one hit at a time. Smaller hits never accumulate into a daze.
  const dazing = definition(daze);
  let small = start(dazing);
  for (let i = 0; i < 3; i++) {
    const step = hit(dazing, small, [7, 6, 6, 2]);
    small = step.state;
    assert.ok(!step.events.some((e) => e.type === "daze"));
    assert.equal(rulesetCombatant(small, "target")!.dazed, undefined);
  }
  assert.equal(marks(dazing, small).filled, 6);
  assert.equal(currentRulesetActor(advance(dazing, small).state)?.id, "target");
  const large = hit(dazing, start(dazing), [7, 6, 6, 6]);
  assert.equal(first(large.events, "daze").over, 2);
  assert.ok(rulesetCombatConditions(dazing, rulesetCombatant(large.state, "target")!).includes("dazed"));
  const again = hit(dazing, large.state, [7, 6, 6, 6]);
  assert.ok(!again.events.some((e) => e.type === "daze"), "a second daze before the skip is not told again");
  const skipped = advance(dazing, JSON.parse(JSON.stringify(again.state)));
  assert.equal(skipped.events.filter((e) => e.type === "skip").length, 1);
  assert.equal(first(skipped.events, "skip").actorId, "target");
  assert.equal(currentRulesetActor(skipped.state)?.id, "attacker");
  assert.equal(skipped.state.round, 2);
  assert.ok(!rulesetCombatConditions(dazing, rulesetCombatant(skipped.state, "target")!).includes("dazed"));
  const next = advance(dazing, skipped.state);
  assert.equal(currentRulesetActor(next.state)?.id, "target");
  assert.ok(!next.events.some((e) => e.type === "skip"));
  // Daze itself works without a cosmetic condition; pre-existing conditions are not owned by it.
  const unnamed = definition((d) => {
    daze(d);
    delete d.combat.daze.condition;
  });
  assert.equal(
    first(advance(unnamed, hit(unnamed, start(unnamed), [7, 6, 6, 6]).state).events, "skip").actorId,
    "target",
  );
  const held = start(dazing);
  rulesetCombatant(held, "target")!.sheet!.live = { conditions: ["dazed"] };
  const preserved = advance(dazing, hit(dazing, held, [7, 6, 6, 6]).state);
  assert.ok(rulesetCombatConditions(dazing, rulesetCombatant(preserved.state, "target")!).includes("dazed"));
  const finished = structuredClone(large.state);
  liftRulesetFightEffects(dazing, finished);
  assert.equal(rulesetCombatant(finished, "target")!.dazed, undefined);
  assert.ok(!rulesetCombatConditions(dazing, rulesetCombatant(finished, "target")!).includes("dazed"));
  // A rerolled round can put the dazed unit first; consume its skip only after the new order is known.
  const rerolled = definition((d) => {
    daze(d);
    d.combat.initiative.each = "round";
  });
  const roundOne = hit(rerolled, start(rerolled), [7, 6, 6, 6]);
  const roundTwo = advance(rerolled, roundOne.state, 1, 9);
  assert.equal(roundTwo.events.filter((e) => e.type === "skip").length, 1);
  assert.equal(
    currentRulesetActor(roundTwo.state)?.id,
    "target",
    "their skipped round-one turn is followed by a valid round-two turn",
  );
  const enemyTurn = advance(rerolled, start(rerolled)).state;
  const ambushed = hit(rerolled, enemyTurn, [7, 6, 6, 6], "Strike", "attacker", "target");
  const skippedFirst = advance(rerolled, ambushed.state, 9, 1);
  assert.equal(first(skippedFirst.events, "skip").actorId, "attacker");
  assert.equal(currentRulesetActor(skippedFirst.state)?.id, "target");
  assert.equal(skippedFirst.state.round, 2);
  // Daze measures harm left after soak, and the target's value before any wound changes it.
  const softened = definition((d) => {
    daze(d);
    d.combat.pool.soak.all = { const: 2 };
  });
  const softHit = hit(softened, start(softened), [7, 6]);
  assert.equal(first(softHit.events, "damage").dealt, 1);
  assert.ok(!softHit.events.some((event) => event.type === "daze"));
  const liveThreshold = definition((d) => {
    daze(d);
    d.combat.daze.over = { liveTrack: "harm", read: "filled" };
  });
  assert.equal(first(hit(liveThreshold, start(liveThreshold), [7, 6, 2, 2]).events, "daze").over, 0);
  // A daze-owned condition survives another hit even if its ordinary rule ends on damage.
  const endsOnDamage = definition((d) => {
    daze(d);
    d.combat.conditions.push({ condition: "dazed", effects: ["ends-on-damage"] });
  });
  const pending = hit(endsOnDamage, start(endsOnDamage), [7, 6, 6, 6]);
  const tapped = hit(endsOnDamage, pending.state, [7, 6, 2, 2]);
  assert.ok(rulesetCombatConditions(endsOnDamage, rulesetCombatant(tapped.state, "target")!).includes("dazed"));
  const passed = advance(endsOnDamage, tapped.state);
  assert.ok(!rulesetCombatConditions(endsOnDamage, rulesetCombatant(passed.state, "target")!).includes("dazed"));
  // Everybody pending a skip still advances to a real turn; no stuck order or double skip.
  const allDazed = start(dazing);
  for (const actor of allDazed.combatants) actor.dazed = {};
  const allSkipped = advance(dazing, allDazed);
  assert.equal(allSkipped.events.filter((e) => e.type === "skip").length, 2);
  assert.equal(currentRulesetActor(allSkipped.state)?.id, "target");

  // Target flag AND attack tags decide the kind, before that kind's soak is read.
  const mapping = definition(remap);
  let mappedEvent: Extract<RulesetCombatEvent, { type: "damage" }> | undefined;
  for (const [vampire, tagged, remapped] of [
    [1, true, true],
    [0, true, false],
    [1, false, false],
  ] as const) {
    const state = start(mapping, [
      equipped(mapping, "attacker", tagged ? ["firearm"] : []),
      unit("target", "enemy", 2, vampire),
    ]);
    const result = hit(mapping, state, remapped ? [7, 6] : [7, 6, 6, 6], "Pistol");
    const event = first(result.events, "damage");
    assert.equal(event.damageType, "tearing");
    assert.equal(event.pool?.remappedFrom, remapped ? "lethal" : undefined);
    assert.equal(event.pool?.kind, remapped ? "bashing" : undefined);
    assert.equal(event.dealt, remapped ? 1 : 3);
    assert.equal(marks(mapping, result.state).filled, remapped ? 1 : 3);
    const sheet = rulesetCombatant(result.state, "target")!.sheet!;
    assert.match(JSON.stringify(sheet.live), new RegExp(remapped ? "bashing" : "lethal"));
    if (remapped) mappedEvent = event;
  }
  const rolledRemap = definition((d) => {
    remap(d);
    d.combat.pool.soak.roll = true;
  });
  const soakedShot = hit(
    rolledRemap,
    start(rolledRemap, [equipped(rolledRemap), unit("target", "enemy", 2, 1)]),
    [7, 6, 6, 6, 6, 6],
    "Pistol",
  );
  assert.deepEqual(first(soakedShot.events, "damage").pool?.soak?.rolls, [6, 6]);
  assert.equal(first(soakedShot.events, "damage").dealt, 1);
  // Missing tags is unrestricted; matching rules are not chained, and the first match wins.
  const chained = definition((d) => {
    remap(d);
    delete d.combat.damageKinds.remap[0].tags;
    d.combat.damageKinds.remap.push({ when: { const: 1 }, from: "bashing", to: "lethal" });
  });
  const chainEvent = first(
    hit(chained, start(chained, [unit("attacker", "party"), unit("target", "enemy", 2, 1)]), [7, 6]).events,
    "damage",
  );
  assert.equal(chainEvent.pool?.kind, "bashing");
  // All three together: three dice survive soak, become bashing wounds, and exceed Stamina 2.
  const combined = definition((d) => {
    remap(d);
    daze(d);
    d.combat.damage = { minimum: { const: 3 } };
  });
  const combinedHit = hit(
    combined,
    start(combined, [equipped(combined), unit("target", "enemy", 2, 1)]),
    [7, 6, 6, 6],
    "Pistol",
  );
  assert.equal(first(combinedHit.events, "damage").pool?.kind, "bashing");
  assert.equal(first(combinedHit.events, "daze").damage, 3);

  // The log says the new facts and the GM receives both the rule and the pending skipped turn.
  const english = JSON.parse(
    readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  );
  const t = ((key: string, params: Record<string, unknown> = {}) => {
    const plural = typeof params.count === "number" ? `${key}_${params.count === 1 ? "one" : "other"}` : key;
    return (english[key] ?? english[plural] ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, name: string) =>
      String(params[name] ?? ""),
    );
  }) as never;
  const names = rulesetCombatNames(combined, { combatants: combinedHit.state.combatants } as never, t);
  assert.match(rulesetCombatEventLine(minEvent, names, t)!, /Minimum damage pool: 2 dice/);
  assert.match(rulesetCombatEventLine(mappedEvent!, names, t)!, /Bashing instead of Lethal/);
  assert.match(rulesetCombatEventLine(first(large.events, "daze"), names, t)!, /3 damage exceeds 2.*next turn.*Reel/);
  assert.match(rulesetCombatEventLine(first(skipped.events, "skip"), names, t)!, /loses this turn/);
  const prompt = buildRulesetCombatBossPrompt(combined, {
    style: "ruleset",
    round: 1,
    difficulty: "normal",
    window: { actorId: "attacker", options: [] },
    rulesetFight: {
      encounter: combinedHit.state,
      controllers: {},
      bosses: [],
      adjustments: [],
      eventSeq: combinedHit.events.length,
      events: combinedHit.events.map((event, seq) => ({ seq, event })),
    },
  } as never);
  const gm = JSON.parse(prompt[1]!.content);
  assert.deepEqual(gm.daze.pending, ["target"]);
  assert.match(gm.daze.rule, /exactly their next turn/);
  assert.match(gm.minimumDamage, /dice, not guaranteed wounds/);
  assert.match(gm.damageKinds, /before soak/);

  // One gate per new key. Inline and external weapon minimums cannot evade 1.146.
  const manifest = (minor: number) =>
    ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      id: "ruleset-test",
      kind: ["ruleset"],
      permissions: [],
      restartRequired: false,
      contributions: { assets: { paths: ["ruleset.json", "catalogs/extra.json"] } },
    }) as never;
  const cases: Array<[number, unknown, Map<string, unknown>?]> = [
    [146, { combat: { damage: { minimum: { const: 2 } } } }],
    [147, { combat: { daze: { over: { const: 2 }, measure: "damage" } } }],
    [148, { combat: { damageKinds: { remap: [{ when: { const: 1 }, from: "lethal", to: "bashing" }] } } }],
    [
      146,
      {
        catalogs: [
          {
            id: "kit",
            holds: "items",
            entries: [{ id: "gun", item: { attack: { damage: { dice: "1d6", minimum: { const: 2 } } } } }],
          },
        ],
      },
    ],
    [
      146,
      { catalogs: [{ id: "kit", holds: "items", asset: "catalogs/extra.json" }] },
      new Map([
        [
          "catalogs/extra.json",
          {
            entries: [{ id: "gun", item: { attack: { damage: { dice: "1d6", minimum: { stat: "overwhelming" } } } } }],
          },
        ],
      ]),
    ],
  ];
  for (const [minor, doc, catalogs] of cases) {
    assert.match(
      getCapabilityPackageInstallIssue(manifest(minor - 1), doc, catalogs) ?? "",
      new RegExp(`capabilityApi 1\\.${minor} or newer`),
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(minor), doc, catalogs), null);
  }
  assert.equal(
    getCapabilityPackageInstallIssue(manifest(146), {
      combat: { damageKinds: { default: "bashing", marks: "per-point" } },
    }),
    null,
  );
  console.log(
    "game-ruleset-combat-minimum-dice: minimum dice, one-hit daze, kind remaps, logs, GM text and API gates passed",
  );
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
