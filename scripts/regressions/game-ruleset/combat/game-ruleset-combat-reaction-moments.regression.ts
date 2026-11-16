/** Reactions for others, at turn start, on a save, and for several fallers (Capability API 1.131). */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetCombatChoice,
  advanceRulesetTurn,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetFallTargets,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  RULESET_PASS_OPTION,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

import { rulesetCombatEventLine, rulesetCombatNames } from "../../../../packages/client/src/lib/ruleset-combat-log.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-reaction-moments-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetWindowTargetOf, rulesetMenu } =
  await import("../../../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 126);
  const text = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const protection = {
    id: "protection",
    label: "Protection",
    rows: [{ list: "spells", values: { name: "Protection", level: 0, prepared: true } }],
    mechanics: {
      kind: "debuff",
      targets: "enemy",
      budget: "reaction",
      reaction: { on: "aimed", for: "ally", within: 5, seesSource: true, at: "source" },
      applies: [{ condition: "protected_attack", duration: "this-action" }],
    },
  };
  const guardian = {
    ...protection,
    id: "shield",
    label: "Shield",
    mechanics: {
      kind: "buff",
      targets: "ally",
      budget: "reaction",
      range: 5,
      reaction: { on: "hit", for: "ally", within: 5, at: "target" },
      applies: [{ condition: "parrying", duration: "this-action" }],
    },
  };
  const feather = {
    ...protection,
    id: "feather",
    label: "Feather Fall",
    mechanics: {
      kind: "buff",
      targets: "ally",
      budget: "reaction",
      range: 60,
      targetCount: 5,
      reaction: { on: "falls" },
      applies: [{ condition: "feather_falling", duration: { rounds: 10 } }],
    },
  };
  const document = () => {
    const doc = JSON.parse(text);
    doc.sheet.live.conditions.push(
      { id: "protected_attack", label: "Protected attack" },
      { id: "feather_falling", label: "Feather falling" },
    );
    doc.combat.conditions.push(
      { condition: "protected_attack", effects: ["own-attacks-disadvantage"] },
      { condition: "feather_falling", fallsSafely: true },
    );
    doc.combat.elevation = {
      levelHeight: 5,
      falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
    };
    doc.catalogs.push({
      id: "spells",
      label: "Spells",
      feeds: ["spells"],
      units: { distance: { label: "ft", perCell: 5 } },
      entries: [protection],
    });
    return doc;
  };
  const parsed = (doc: unknown) => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const english = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../../../packages/client/src/localization/locales/en.json", import.meta.url)),
      "utf8",
    ),
  );
  const t = ((key: string, params: Record<string, unknown> = {}) => {
    assert.ok(english[key], `missing English key ${key}`);
    return english[key].replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (_: string, name: string) => String(params[name] ?? ""));
  }) as Parameters<typeof rulesetCombatEventLine>[2];
  const line = (event: RulesetCombatEvent, state: RulesetEncounterState) =>
    rulesetCombatEventLine(event, rulesetCombatNames(definition, { combatants: state.combatants } as any, t), t) ?? "";

  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [
      { id: "rock", name: "Rock", budget: "action", toHit: 4, range: 100, damage: { flat: 3 } },
      { id: "club", name: "Club", budget: "action", toHit: 4, range: 100, damage: { flat: 3 } },
    ],
    ...extra,
  });
  const fight = (entry: unknown = protection) => {
    const spell = entry as RulesetCatalogEntry;
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "attacker", name: "Attacker", side: "enemy", block: block({ initiativeModifier: 20 }) },
        {
          id: "ally",
          name: "Ally",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
        },
        {
          id: "holder",
          name: "Holder",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
            lists: { spells: rowsFromCatalogEntry("spells", spell).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [spell] },
        },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [Array(20).fill(0)] },
        placements: { attacker: { x: 0, y: 0 }, ally: { x: 2, y: 0 }, holder: { x: 3, y: 0 } },
      },
    });
  };
  const who = (s: RulesetEncounterState, id: string) => rulesetCombatant(s, id)!;
  const events = <T extends RulesetCombatEvent["type"]>(es: RulesetCombatEvent[], type: T) =>
    es.filter((e): e is Extract<RulesetCombatEvent, { type: T }> => e.type === type);
  const dice = (faces: number[]) => {
    let i = 0;
    return (sides: number) => {
      assert.ok(i < faces.length, `no die left for d${sides}`);
      return faces[i++]!;
    };
  };
  const act = (s: RulesetEncounterState, choice: RulesetCombatChoice, faces: number[] = []) => {
    const step = applyRulesetCombatChoice(definition, s, choice, dice(faces));
    assert.equal(events(step.events, "refused").length, 0, JSON.stringify(step.events));
    return step;
  };
  const attack = (s: RulesetEncounterState, target = "ally", faces: number[] = [], optionId = "rock") =>
    act(s, { actorId: "attacker", optionId, targetIds: [target] }, faces);
  const answer = (s: RulesetEncounterState, faces: number[] = [], targetIds: string[] = [], pass = false) => {
    assert.ok(s.window, "a reaction window must open");
    const actorId = s.window.waiting[0]!;
    const option = rulesetWindowOptions(definition, s, actorId)[0];
    assert.ok(option, "the window offers its answer");
    return act(s, { actorId, optionId: pass ? RULESET_PASS_OPTION : option.id, targetIds, window: s.window.id }, faces);
  };

  // Protection is applied before the roll, lasts for that action, and answers only a nearby ally.
  {
    const held = attack(fight());
    assert.equal(held.state.window?.trigger.kind, "aimed");
    assert.deepEqual(held.state.window?.waiting, ["holder"]);
    assert.match(line(events(held.events, "window")[0]!, held.state), /Attacker attacks Ally.*Holder may answer/);
    assert.deepEqual(events(held.events, "attack"), [], "aimed precedes the attack dice");
    const saved = answer(JSON.parse(JSON.stringify(held.state)), [17, 3]);
    const roll = events(saved.events, "attack")[0]!;
    assert.equal(roll.mode, "disadvantage");
    assert.deepEqual(roll.rolls, [17, 3]);
    assert.equal(roll.kept, 3);
    assert.equal(roll.outcome, "miss");
    assert.ok(!rulesetCombatConditions(definition, who(saved.state, "attacker")).includes("protected_attack"));
    who(saved.state, "attacker").budgets.action = 1;
    const next = attack(saved.state, "ally", [17]);
    assert.deepEqual(events(next.events, "attack")[0]!.rolls, [17]);
    for (const change of [
      (s: RulesetEncounterState) => {
        who(s, "holder").x = 4;
      },
      (s: RulesetEncounterState) => {
        who(s, "attacker").flags.hidden = true;
      },
      (s: RulesetEncounterState) => {
        who(s, "holder").budgets.reaction = 0;
      },
    ]) {
      const s = fight();
      change(s);
      assert.equal(attack(s, "ally", [17]).state.window, undefined);
    }
    const self = fight();
    who(self, "attacker").x = 2;
    assert.equal(attack(self, "holder", [17, 17]).state.window, undefined);
    const both = fight();
    who(both, "attacker").actions.find((one) => one.id === "rock")!.targets.count = 2;
    const shared = act(both, { actorId: "attacker", optionId: "rock", targetIds: ["holder", "ally"] });
    assert.ok(
      rulesetWindowOptions(definition, shared.state, "holder").length,
      "a holder also targeted can answer for its ally",
    );
    const any = structuredClone(protection);
    any.mechanics.reaction.for = "any";
    const close = fight(any);
    who(close, "attacker").x = 0;
    assert.equal(attack(close, "holder").state.window?.trigger.kind, "aimed");
    const cancelled = structuredClone(held.state);
    who(cancelled, "ally").actions.push({
      id: "cancel",
      label: "Cancel",
      kind: "ability",
      budget: "reaction",
      targets: { side: "self", count: 0 },
      reaction: { on: "aimed", at: "source", cancels: true },
    });
    cancelled.window!.waiting.push("ally");
    const protectedStep = answer(cancelled);
    assert.ok(rulesetCombatConditions(definition, who(protectedStep.state, "attacker")).includes("protected_attack"));
    const cancelledStep = answer(protectedStep.state);
    assert.equal(events(cancelledStep.events, "cancelled").length, 1);
    assert.ok(!rulesetCombatConditions(definition, who(cancelledStep.state, "attacker")).includes("protected_attack"));
    const also = structuredClone(protection);
    (also.mechanics as any).reaction = { on: "harmed", at: "source", also: [protection.mechanics.reaction] };
    delete (also.mechanics as any).reaction.also[0].at;
    assert.equal(attack(fight(also)).state.window?.trigger.kind, "aimed");
  }

  // Shield Guardian rechecks the ALLY's defense, even when the holder's is quite different.
  {
    const s = fight(guardian);
    who(s, "holder").sheet!.build.fields.ac = 25;
    const held = attack(s, "ally", [9]);
    assert.equal(held.state.window?.trigger.kind, "hit");
    const option = rulesetWindowOptions(definition, held.state, "holder")[0]!;
    assert.equal(rulesetWindowTargetOf(held.state, who(held.state, "holder"), option), "ally");
    const saved = answer(held.state);
    assert.ok(events(saved.events, "recheck")[0], "the original hit resumes after the guardian answers");
    assert.equal(events(saved.events, "recheck")[0]!.defense, 14);
    assert.equal(events(saved.events, "recheck")[0]!.outcome, "miss");
    assert.deepEqual(events(saved.events, "damage"), []);
  }

  // A moment after the original action finished must not leave this-action conditions behind.
  {
    const after = { ...guardian, mechanics: { ...guardian.mechanics, targets: "self", reaction: { on: "harmed" } } };
    const held = attack(fight(after), "holder", [17]);
    const ended = answer(held.state);
    assert.ok(!rulesetCombatConditions(definition, who(ended.state, "holder")).includes("parrying"));
  }

  // Unnerving Mask opens before the enemy acts; its failed save lasts through this turn only.
  {
    const s = fight();
    who(s, "holder").actions = [];
    who(s, "holder").actions.push({
      id: "mask",
      label: "Unnerving Mask",
      kind: "ability",
      harmful: true,
      budget: "reaction",
      targets: { side: "enemy", count: 1 },
      range: { normal: 6 },
      reaction: { on: "turn-start", at: "source", seesSource: true },
      save: { save: "wis_save", difficulty: 14, onSuccess: "negates" },
      applies: [{ condition: "frightened", duration: { rounds: 1 } }],
    });
    s.turn = s.order.length - 1;
    const started = advanceRulesetTurn(definition, s, dice([]));
    assert.equal(started.state.window?.trigger.kind, "turn-start");
    assert.equal(started.state.window?.trigger.sourceId, "attacker");
    assert.match(
      line(events(started.events, "window")[0]!, started.state),
      /Attacker starts their turn.*Holder may answer/,
    );
    const saved = answer(started.state, [1]);
    assert.equal(events(saved.events, "save")[0]!.save, "wis_save");
    assert.equal(events(saved.events, "save")[0]!.success, false);
    assert.ok(rulesetCombatConditions(definition, who(saved.state, "attacker")).includes("frightened"));
    const ended = advanceRulesetTurn(definition, saved.state, dice([]));
    assert.ok(!rulesetCombatConditions(definition, who(ended.state, "attacker")).includes("frightened"));
    const far = structuredClone(s);
    who(far, "holder").x = 8;
    assert.equal(advanceRulesetTurn(definition, far, dice([])).state.window, undefined);
    const unseen = structuredClone(s);
    unseen.board!.grid.tiles[0]![1] = "wall";
    assert.equal(advanceRulesetTurn(definition, unseen, dice([])).state.window, undefined);
    assert.equal(events(answer(started.state, [20]).events, "condition").filter((e) => e.active).length, 0);
  }

  // A stat-block reaction also sees the FIRST turn, without waiting for advanceRulesetTurn.
  {
    const base = fight();
    const build = structuredClone(who(base, "ally").sheet!.build);
    build.abilities.dex = 30;
    const first = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "starter", name: "Starter", side: "party", build, live: {} },
        {
          id: "devil",
          name: "Chain Devil",
          side: "enemy",
          block: block({
            actions: [
              {
                id: "mask",
                name: "Unnerving Mask",
                budget: "reaction",
                range: 30,
                reaction: { on: "turn-start", at: "source", seesSource: true },
                save: { save: "wis_save", difficulty: 14, onSuccess: "negates" },
                applies: [{ condition: "frightened", duration: { rounds: 1 } }],
              },
            ],
          }),
        },
      ],
      board: {
        grid: { width: 10, height: 1, tiles: [Array(10).fill("plains")] },
        placements: { starter: { x: 0, y: 0 }, devil: { x: 6, y: 0 } },
      },
    });
    assert.equal(first.window?.trigger.kind, "turn-start");
    assert.equal(first.window?.trigger.sourceId, "starter");
    const answered = answer(first, [1]);
    assert.ok(rulesetCombatConditions(definition, who(answered.state, "starter")).includes("frightened"));
    assert.ok(
      !rulesetCombatConditions(
        definition,
        who(advanceRulesetTurn(definition, answered.state, dice([])).state, "starter"),
      ).includes("frightened"),
    );
  }

  // Rock Catching spends the reaction on either result, and only answers the whole action name.
  {
    const catchRock = {
      ...guardian,
      mechanics: {
        kind: "buff",
        targets: "self",
        budget: "reaction",
        reaction: {
          on: "aimed",
          cancels: true,
          cancelSave: { save: "dex_save", dc: 10 },
          against: { actions: ["rOcK"] },
        },
      },
    };
    for (const pass of [true, false]) {
      const held = attack(fight(catchRock), "holder");
      who(held.state, "holder").saves.dex_save = 4;
      assert.equal(rulesetMenu(definition, held.state, "holder", true)[0]!.cancelSave?.save, "dex_save");
      const saved = answer(held.state, pass ? [6] : [1, 17]);
      assert.equal(events(saved.events, "save")[0]!.modifier, 4);
      assert.equal(events(saved.events, "save")[0]!.success, pass);
      assert.match(line(events(saved.events, "save")[0]!, saved.state), /Dexterity/);
      assert.equal(events(saved.events, "cancelled").length, pass ? 1 : 0);
      assert.equal(events(saved.events, "attack").length, pass ? 0 : 1);
      assert.equal(who(saved.state, "holder").budgets.reaction, 0);
    }
    assert.equal(attack(fight(catchRock), "holder", [17], "club").state.window, undefined);
    const legacy = { ...catchRock, mechanics: { ...catchRock.mechanics, reaction: { on: "aimed", cancels: true } } };
    assert.equal(events(answer(attack(fight(legacy), "holder").state).events, "cancelled").length, 1);
    const held = attack(fight(legacy), "holder");
    assert.equal(events(answer(held.state, [17], [], true).events, "attack").length, 1);
  }

  // Three falling together are one choice; a later event is a separate question.
  {
    const s = fight(feather);
    for (const [id, x] of [
      ["second", 4],
      ["third", 5],
      ["later", 6],
    ] as const) {
      const clone = structuredClone(who(s, "ally"));
      clone.id = id;
      clone.name = id;
      clone.x = x;
      s.combatants.push(clone);
      s.order.push(id);
    }
    for (const id of ["ally", "second", "third", "later"]) {
      who(s, id).altitude = 4;
      who(s, id).speeds = { fly: 30 };
    }
    who(s, "attacker").actions.push({
      id: "bind",
      label: "Bind",
      kind: "ability",
      budget: "action",
      targets: { side: "enemy", count: 3 },
      range: { normal: 20 },
      applies: [{ condition: "grappled", duration: "instant" }],
    });
    const held = act(s, { actorId: "attacker", optionId: "bind", targetIds: ["third", "ally", "second"] });
    const option = rulesetWindowOptions(definition, held.state, "holder")[0]!;
    assert.equal(option.targets.count, 5);
    assert.deepEqual(
      rulesetMenu(definition, held.state, "holder", true)[0]!.targetIds,
      ["ally", "second", "third"],
      "the menu offers this event, nearest first",
    );
    assert.deepEqual(
      new Set(
        rulesetFallTargets(
          definition,
          held.state,
          who(held.state, "holder"),
          who(held.state, "holder").actions.find((one) => one.id === option.id)!,
        ),
      ),
      new Set(["ally", "second", "third"]),
    );
    const saved = answer(JSON.parse(JSON.stringify(held.state)));
    assert.equal(saved.state.window, undefined);
    assert.deepEqual(events(saved.events, "damage"), []);
    assert.equal(events(saved.events, "fell").length, 3);
    for (const id of ["ally", "second", "third"])
      assert.ok(rulesetCombatConditions(definition, who(saved.state, id)).includes("feather_falling"));
    assert.ok(!rulesetCombatConditions(definition, who(saved.state, "later")).includes("feather_falling"));
    who(saved.state, "holder").budgets.reaction = 1;
    who(saved.state, "attacker").budgets.action = 1;
    const later = act(saved.state, { actorId: "attacker", optionId: "bind", targetIds: ["later"] });
    assert.equal(later.state.window?.trigger.sourceId, "later");
    assert.equal(events(answer(later.state).events, "fell").length, 1);
    const chosen = answer(held.state, [3, 3, 3, 3], ["ally"]);
    assert.equal(events(chosen.events, "damage").length, 2, "unchosen fallers still land");
  }

  // Import and the gate, for headers and files, catalog mechanics and creature actions.
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "reaction-moments",
      name: "Moments",
      version: "0.1.0",
      description: "Reaction moments",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json", "catalogs/spells.json", "catalogs/creatures.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    const cases = [
      { reaction: { on: "aimed", for: "ally", within: 5 } },
      { reaction: { on: "hit", also: [{ on: "aimed", for: "any", within: 5 }] } },
      { reaction: { on: "hit", at: "target" } },
      { reaction: { on: "turn-start" } },
      { reaction: { on: "aimed", cancels: true, cancelSave: { save: "dex_save", dc: 10 } } },
      { reaction: { on: "aimed", against: { actions: ["Rock"] } } },
      { applies: [{ condition: "parrying", duration: "this-action" }] },
      { reaction: { on: "falls" }, targetCount: 5 },
    ];
    for (const extra of cases)
      for (const creature of [false, true])
        for (const file of [false, true]) {
          const doc = document();
          doc.catalogs.at(-1).entries = [];
          const header = creature ? doc.catalogs.find((c: any) => c.id === "creatures") : doc.catalogs.at(-1);
          if (creature) {
            header.entries[0].creature.actions = [header.entries[0].creature.actions[0]];
            Object.assign(header.entries[0].creature.actions[0], extra);
          } else
            header.entries = [
              { ...protection, mechanics: { kind: "buff", targets: "self", budget: "reaction", ...extra } },
            ];
          parsed(doc);
          const files = new Map<string, unknown>();
          if (file) {
            files.set(`catalogs/${header.id}.json`, { schemaVersion: 1, catalog: header.id, entries: header.entries });
            delete header.entries;
            header.asset = `catalogs/${header.id}.json`;
          }
          assert.equal(
            getCapabilityPackageInstallIssue(manifest(130) as any, doc, files),
            "A ruleset whose reactions answer for others, at a turn's start, on a save or for several fallers requires schemaVersion 2 and capabilityApi 1.131 or newer",
          );
          assert.equal(getCapabilityPackageInstallIssue(manifest(131) as any, doc, files), null);
        }
    for (const reaction of [
      { on: "aimed", for: "ally" },
      { on: "harmed", for: "ally", within: 5 },
      { on: "used", for: "any", within: 5 },
      { on: "falls", for: "ally", within: 5 },
      { on: "turn-start", for: "ally", within: 5 },
      { on: "turn-start", cancels: true },
      { on: "turn-start", blow: "melee" },
      { on: "turn-start", against: { actions: ["Rock"] } },
      { on: "turn-start", upTo: "paid" },
      { on: "aimed", cancelSave: { save: "dex_save", dc: 10 } },
      { on: "aimed", cancels: true, cancelSave: { save: "dex_save", dc: 0 } },
    ]) {
      const doc = document();
      doc.catalogs.at(-1).entries[0].mechanics.reaction = reaction;
      assert.equal(parseRulesetDefinition(doc).ok, false, JSON.stringify(reaction));
    }
  }
  // The editor carries the same cross-key requirements as import, for primary and also moments.
  {
    const schema = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    let moments = 0;
    const visit = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object" && node.properties?.within && node.properties?.on) {
        moments++;
        assert.ok(node.properties.on.enum.includes("turn-start"));
        const nearby = node.allOf?.find((one: any) => one.if?.properties?.for);
        assert.deepEqual(nearby.then.required, ["within"]);
        assert.deepEqual(nearby.then.properties.on.enum, ["aimed", "hit"]);
        if (node.properties.cancelSave) {
          assert.ok(node.properties.at.enum.includes("target"));
          assert.deepEqual(node.allOf.find((one: any) => one.if?.required?.includes("cancelSave")).then.required, [
            "cancels",
          ]);
        }
      }
      Object.values(node).forEach(visit);
    };
    visit(schema);
    assert.ok(moments >= 4);
  }
  console.log(
    "Reaction moments: Protection, Shield Guardian, Unnerving Mask, Rock Catching and several fallers, gated at 1.131.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
