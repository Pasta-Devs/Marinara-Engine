/**
 * Creature healing (Capability API 1.121): Healing Touch gives hit points back to its own side.
 *
 *   - The same amount and maximum as a catalog heal, for creatures without sheets too.
 *   - Ally and any targets, limited uses, and a heal that never hurts.
 *   - Import refusals, the proposal clamp, and the install gate for inline and file catalogs.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyRulesetCombatChoice,
  clampRulesetStatBlock,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  applyRulesetSheetOp,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetOptionTargets,
  rulesetProposedStatBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-creature-heal-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const touch = {
    id: "healing_touch",
    name: "Healing Touch",
    budget: "action",
    heal: { dice: "4d8", flat: 2 },
    targets: "ally",
    uses: { per: "day", count: 3 },
  };
  const entryWith = (action: Record<string, unknown> = touch) => ({
    id: "deva",
    label: "Deva",
    creature: {
      tier: "cr_5",
      health: 80,
      defense: 17,
      initiativeModifier: 20,
      actions: [action, { id: "strike", name: "Strike", budget: "action", damage: { flat: 1 } }],
    },
  });
  const withTouch = (doc: Record<string, any>, action: Record<string, unknown> = touch) => {
    doc.catalogs.push({ id: "healers", label: "Healers", holds: "creatures", entries: [entryWith(action)] });
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  const refused = (document: unknown, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(document);
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  assert.equal(supportedCapabilityApi.major, 1);
  assert.ok(supportedCapabilityApi.minor >= 116);
  const definition = parsedOrThrow(fiveE(withTouch), "the 5e example with Healing Touch");
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      assert.ok(faces[index]! >= 1 && faces[index]! <= sides, `the face fits a d${sides}`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const blockFor = (rules: RulesetDefinition) => {
    const entry = rules.catalogs!.find((catalog) => catalog.id === "healers")!.entries![0]!;
    const block = rulesetCreatureBlock(rules, entry);
    assert.ok(block, "the catalog creature becomes a block");
    return block;
  };
  const fight = (rules = definition): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "deva", name: "Deva", side: "enemy", block: blockFor(rules) },
        {
          id: "ally",
          name: "Ally",
          side: "enemy",
          block: { health: 40, defense: 12, initiativeModifier: -10, actions: [] },
        },
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 30 },
          }),
          live: {},
        },
      ],
    });
    rulesetCombatant(state, "ally")!.health!.value = 5;
    assert.equal(state.order[state.turn], "deva", "Deva acts first");
    return state;
  };
  const optionFor = (state: RulesetEncounterState, rules = definition) => {
    const option = rulesetCombatOptions(rules, state, "deva").find((one) => one.id === touch.id);
    assert.ok(option, "Deva has Healing Touch");
    return option;
  };
  const use = (state: RulesetEncounterState, targetIds: string[], faces: number[], rules = definition) =>
    applyRulesetCombatChoice(
      rules,
      state,
      { actorId: "deva", optionId: optionFor(state, rules).id, targetIds },
      dice(...faces),
    );
  const endTurn = (state: RulesetEncounterState, actorId: string) => {
    assert.equal(state.order[state.turn], actorId, `it is ${actorId}'s turn`);
    return applyRulesetCombatChoice(definition, state, { actorId, optionId: "end-turn", targetIds: [] }, dice()).state;
  };

  // ── An ally without a sheet gains the rolled amount, never past its maximum ──
  {
    assert.deepEqual(blockFor(definition).actions[0]!.heal, { count: 4, sides: 8, flat: 2 });
    assert.equal(blockFor(definition).actions[0]!.targets, "ally");
    const state = fight();
    const option = optionFor(state);
    assert.equal(option.heals, true, "the director can recognize healing");
    assert.deepEqual(option.targets, { side: "ally", count: 1 });
    assert.deepEqual(rulesetOptionTargets(definition, state, "deva", option).sort(), ["ally", "deva"]);
    const healed = use(state, ["ally"], [1, 2, 3, 4]);
    assert.deepEqual(eventsOf(healed.events, "refused"), []);
    assert.equal(rulesetCombatant(healed.state, "ally")!.health!.value, 17);
    assert.deepEqual(eventsOf(healed.events, "heal"), [
      {
        type: "heal",
        sourceId: "deva",
        label: "Healing Touch",
        targetId: "ally",
        rolls: [1, 2, 3, 4],
        flat: 2,
        amount: 12,
        health: 17,
        maxHealth: 40,
      },
    ]);
    assert.deepEqual(eventsOf(healed.events, "damage"), [], "a heal does no harm");
    const nearFull = fight();
    rulesetCombatant(nearFull, "ally")!.health!.value = 39;
    const capped = use(nearFull, ["ally"], [8, 8, 8, 8]);
    assert.deepEqual(eventsOf(capped.events, "refused"), []);
    assert.equal(rulesetCombatant(capped.state, "ally")!.health!.value, 40);
    const illegal = use(fight(), ["corwin"], []);
    assert.equal(eventsOf(illegal.events, "refused").length, 1, "an enemy is refused as an ally target");
    assert.deepEqual(eventsOf(illegal.events, "heal"), []);
    assert.equal(rulesetCombatant(illegal.state, "deva")!.budgets.action, 1, "refusal spends nothing");
  }

  // ── Any reaches either side; a multi-target heal rolls its amount once ──
  {
    const rules = parsedOrThrow(
      fiveE((doc) => withTouch(doc, { ...touch, targets: "any", targetCount: 2 })),
      "any targets",
    );
    const state = fight(rules);
    const corwin = rulesetCombatant(state, "corwin")!;
    const wounded = applyRulesetSheetOp(rules, corwin.sheet!.build, corwin.sheet!.live, {
      op: "spend",
      pool: "hp",
      amount: 25,
    });
    assert.ok(wounded.ok);
    corwin.sheet!.live = wounded.live;
    const option = optionFor(state, rules);
    assert.deepEqual(option.targets, { side: "any", count: 2 });
    assert.deepEqual(rulesetOptionTargets(rules, state, "deva", option).sort(), ["ally", "corwin", "deva"]);
    const healed = use(state, ["ally", "corwin"], [2, 2, 2, 2], rules);
    assert.deepEqual(eventsOf(healed.events, "refused"), []);
    assert.equal(rulesetCombatant(healed.state, "ally")!.health!.value, 15);
    assert.equal(
      readRulesetLive(rules, corwin.sheet!.build, rulesetCombatant(healed.state, "corwin")!.sheet!.live).pools.find(
        (pool) => pool.key === "hp",
      )!.value,
      15,
    );
    assert.deepEqual(
      eventsOf(healed.events, "heal").map((event) => event.amount),
      [10, 10],
    );
    assert.deepEqual(eventsOf(healed.events, "damage"), []);
  }

  // ── The daily uses run out, even though each turn gives its action back ──
  {
    let state = fight();
    for (let left = 2; left >= 0; left--) {
      const healed = use(state, ["ally"], [1, 1, 1, 1]);
      assert.deepEqual(eventsOf(healed.events, "refused"), []);
      state = healed.state;
      assert.equal(rulesetCombatant(state, "deva")!.uses[touch.id], left);
      for (const actorId of [...state.order]) state = endTurn(state, actorId);
    }
    assert.equal(rulesetCombatant(state, "ally")!.health!.value, 23);
    assert.equal(
      rulesetCombatOptions(definition, state, "deva").some((option) => option.id === touch.id),
      false,
    );
    const exhausted = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "deva", optionId: touch.id, targetIds: ["ally"] },
      dice(),
    );
    assert.equal(eventsOf(exhausted.events, "refused").length, 1);
    assert.deepEqual(eventsOf(exhausted.events, "heal"), []);
  }

  // ── Flat, dice-only, and signed amounts; omitted targets keep the old other-side rule ──
  for (const [amount, faces, expected] of [
    [{ flat: 7 }, [], 12],
    [{ dice: "1d8" }, [3], 8],
    [{ dice: "1d8-2", flat: 4 }, [3], 10],
    [{ flat: -7 }, [], 5],
    [{ dice: "1d8", flat: -20 }, [1], 5],
  ] as const) {
    const rules = parsedOrThrow(
      fiveE((doc) => withTouch(doc, { ...touch, heal: amount })),
      "a heal amount",
    );
    const healed = use(fight(rules), ["ally"], [...faces], rules);
    assert.deepEqual(eventsOf(healed.events, "refused"), []);
    assert.equal(rulesetCombatant(healed.state, "ally")!.health!.value, expected);
    assert.deepEqual(eventsOf(healed.events, "damage"), []);
  }
  {
    const { targets: _targets, ...otherSide } = touch;
    const rules = parsedOrThrow(
      fiveE((doc) => withTouch(doc, otherSide)),
      "the default target side",
    );
    assert.deepEqual(optionFor(fight(rules), rules).targets, { side: "enemy", count: 1 });
  }

  // ── The clamp drops what the threat scale cannot bound, with its usual note ──
  {
    const proposed = rulesetProposedStatBlock(definition, entryWith().creature as any);
    assert.ok(proposed);
    assert.deepEqual(proposed.actions[0]!.heal, { count: 4, sides: 8, flat: 2 });
    for (const rules of [definition, { ...definition, combat: { ...definition.combat!, threat: undefined } }]) {
      const clamped = clampRulesetStatBlock(rules, proposed, definition.combat!.threat!.tiers[0]!.id);
      assert.equal(clamped.block.actions[0]!.heal, undefined);
      assert.equal(clamped.block.actions[0]!.targets, undefined);
      assert.ok(clamped.adjusted.some((note) => /healing or targets.*dropped/.test(note)));
    }
    assert.ok(proposed.actions[0]!.heal, "the proposal itself was not changed");
  }

  // ── Import ──
  {
    for (const [key, value] of [
      ["damage", { flat: 1 }],
      ["toHit", 3],
      ["save", { save: "con", difficulty: 12, onSuccess: "none" }],
      ["area", { shape: "burst", size: 10 }],
    ] as const)
      refused(
        fiveE((doc) => withTouch(doc, { ...touch, [key]: value })),
        /healing action carries no/,
        `heal with ${key}`,
      );
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, heal: {} })),
      /heal needs dice, a flat amount, or both/,
      "empty heal",
    );
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, self: true })),
      /takes no other target/,
      "targets with self",
    );
    for (const key of ["heal", "targets"] as const) {
      refused(
        fiveE((doc) =>
          withTouch(doc, {
            id: "sequence",
            name: "Sequence",
            budget: "action",
            sequence: [{ action: "strike" }],
            [key]: touch[key],
          }),
        ),
        /sequence resolves the actions it names/,
        `sequence with ${key}`,
      );
    }
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, heal: { dice: "bad" } })),
      /dice/i,
      "invalid dice",
    );
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, heal: { flat: 1.5 } })),
      /heal\.flat: Invalid input: expected int, received number/,
      "fractional heal",
    );
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, heal: { flat: 1, extra: 2 } })),
      /extra/,
      "unknown heal key",
    );
    refused(
      fiveE((doc) => withTouch(doc, { ...touch, targets: "enemy" })),
      /targets: Invalid option: expected one of "ally"\|"any"/,
      "unknown target side",
    );
    parsedOrThrow(
      fiveE((doc) => {
        const { targets: _targets, ...self } = touch;
        withTouch(doc, { ...self, self: true });
      }),
      "a self heal",
    );
  }

  // ── The install gate: both keys, in header entries and catalog files ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-creature-heal",
      name: "Creature healing",
      version: "0.1.0",
      description: "A packaged ruleset whose creatures heal.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json", "healers.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset whose creatures heal, or point an action at their own side, requires schemaVersion 2 and capabilityApi 1.121 or newer";
    for (const action of [
      touch,
      { id: "heal", name: "Heal", budget: "action", heal: { flat: 1 } },
      { id: "guard", name: "Guard", budget: "action", targets: "ally" },
    ]) {
      for (const file of [false, true]) {
        const doc = fiveE((doc) => withTouch(doc, action));
        const catalogs = new Map<string, unknown>();
        if (file) {
          const header = doc.catalogs.at(-1);
          catalogs.set("healers.json", { entries: header.entries });
          delete header.entries;
          header.asset = "healers.json";
        }
        assert.equal(getCapabilityPackageInstallIssue(manifest(120) as any, doc, catalogs), gate);
        assert.equal(getCapabilityPackageInstallIssue(manifest(121) as any, doc, catalogs), null);
      }
    }
    assert.equal(
      getCapabilityPackageInstallIssue(manifest(120) as any, fiveE()),
      null,
      "unchanged creatures need no new API",
    );
  }

  // ── The published editor schema carries the same refusals as import ──
  {
    const schema = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    let found = 0;
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.properties?.sequence && node.properties?.self) {
        found++;
        const properties = node.properties;
        assert.deepEqual(properties.heal.anyOf, [{ required: ["dice"] }, { required: ["flat"] }]);
        assert.equal(properties.heal.additionalProperties, false);
        assert.deepEqual(properties.targets.enum, ["ally", "any"]);
        const forbiddenWhen = (key: string) =>
          node.allOf
            .find((rule: any) => rule.if?.required?.[0] === key)
            .then.not.anyOf.map((rule: any) => rule.required[0]);
        for (const key of ["heal", "targets"]) assert.ok(forbiddenWhen("sequence").includes(key));
        assert.deepEqual(forbiddenWhen("heal"), ["damage", "toHit", "save", "area"]);
        assert.deepEqual(forbiddenWhen("targets"), ["self", "sequence"]);
      }
      Object.values(node).forEach(visit);
    };
    visit(schema);
    assert.ok(found > 0, "the published schema has creature actions");
  }

  console.log("Creature healing: ally and any targets, capped amounts, daily uses, import and clamp, gated at 1.121.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
