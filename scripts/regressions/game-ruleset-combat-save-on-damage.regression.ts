/**
 * A save rolled only when its holder takes damage (Capability API 1.129): Dominate Person.
 * Turns roll nothing; damage uses the applying DC once for each blow and holder.
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
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetCombatRoller,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-save-on-damage-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 124);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, mechanics: Record<string, unknown>): RulesetCatalogEntry =>
    ({
      id,
      label: id,
      rows: [{ list: "spells", values: { name: id, level: 1, prepared: true } }],
      mechanics: { range: 60, ...mechanics },
    }) as RulesetCatalogEntry;
  const spells = [
    spell("dominate", {
      kind: "debuff",
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "dominated", duration: "until-save", saveEnds: { save: "wis_save", at: "damaged" } }],
    }),
    spell("turn-save", {
      kind: "debuff",
      save: { save: "wis_save", onSuccess: "negates" },
      applies: [{ condition: "turn_save", duration: "until-save", saveEnds: { save: "wis_save", at: "turn-end" } }],
    }),
  ];
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.sheet.live.conditions.push({ id: "dominated", label: "Dominated" }, { id: "turn_save", label: "Turn save" });
    doc.combat.conditions.push({ condition: "dominated" }, { condition: "turn_save", saveWhenDamaged: true });
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (doc: unknown): RulesetDefinition => {
    const parsed = parseRulesetDefinition(doc);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
    return parsed.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const parsed = parseRulesetDefinition(doc);
    assert.equal(parsed.ok, false, "the file should be refused");
    if (!parsed.ok) assert.match(parsed.issues.join("; "), pattern);
  };
  const definition = parsedOrThrow(document());
  const dice = (...faces: number[]): RulesetCombatRoller => {
    let index = 0;
    return (sides) => {
      assert.ok(index < faces.length, `the script ran out of dice (a d${sides} was asked for)`);
      return faces[index++]!;
    };
  };
  type EventOf<T extends RulesetCombatEvent["type"]> = Extract<RulesetCombatEvent, { type: T }>;
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T): EventOf<T>[] =>
    events.filter((event): event is EventOf<T> => event.type === type);
  const block = (actions: RulesetStatBlock["actions"] = []): RulesetStatBlock => ({
    health: 80,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    saves: { wis_save: 3 },
    actions,
  });
  const bite = { id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 8 } };
  const fight = (
    rules = definition,
    actions: RulesetStatBlock["actions"] = [bite],
    extra: Partial<RulesetStatBlock> = {},
  ): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: rules,
      bestiary: { spells: rules.catalogs!.find((entry) => entry.id === "spells")!.entries! },
      seed: 1,
      roller: () => 10,
      combatants: [
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 20, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 80, spellcasting_ability: "int" },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: rules.catalogs!.find((entry) => entry.id === "spells")!.entries! },
        },
        { id: "ally", name: "Ally", side: "enemy", block: { ...block(actions), ...extra } },
        { id: "holder", name: "Holder", side: "enemy", block: block([bite]) },
        { id: "friend", name: "Friend", side: "enemy", block: block([bite]) },
      ],
      board: {
        grid: { width: 12, height: 1, tiles: [Array(12).fill("plains")] },
        placements: { corwin: { x: 0, y: 0 }, ally: { x: 1, y: 0 }, holder: { x: 2, y: 0 }, friend: { x: 3, y: 0 } },
      },
    });
    rulesetCombatant(state, "ally")!.side = "party";
    return state;
  };
  const who = (state: RulesetEncounterState, id = "holder") => rulesetCombatant(state, id)!;
  const turn = (state: RulesetEncounterState, id: string) => {
    state.turn = state.order.indexOf(id);
    return state;
  };
  const has = (state: RulesetEncounterState, condition: string, target = "holder", rules = definition) =>
    rulesetCombatConditions(rules, who(state, target)).includes(condition);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, faces: number[] = [], rules = definition) => {
    const step = applyRulesetCombatChoice(rules, state, choice, dice(...faces));
    assert.deepEqual(eventsOf(step.events, "refused"), [], JSON.stringify(step.events));
    return step;
  };
  const use = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    faces: number[] = [],
    rules = definition,
    targetIds = ["holder"],
  ) => {
    const option = rulesetCombatOptions(rules, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has ${label}`);
    return act(state, { actorId, optionId: option.id, targetIds }, faces, rules);
  };
  const dominated = (rules = definition, actions: RulesetStatBlock["actions"] = [bite]) =>
    use(fight(rules, actions), "corwin", "dominate", [1], rules).state;
  const strike = (state: RulesetEncounterState, faces: number[], rules = definition) =>
    use(turn(state, "ally"), "ally", "Bite", faces, rules);

  // The applies stores the same save and DC, and neither end nor start of a turn tests it.
  {
    let state = JSON.parse(JSON.stringify(dominated())) as RulesetEncounterState;
    const tracked = who(state).tracked.find((entry) => entry.condition === "dominated")!;
    assert.deepEqual(tracked.saveEnds, { save: "wis_save", at: "damaged" });
    assert.equal(tracked.difficulty, 13);
    assert.equal(tracked.rounds, null, '"until-save" waits for damage');
    turn(state, "holder");
    const cursor = state.cursor;
    for (let i = 0; i < state.order.length * 2; i++) {
      const step = advanceRulesetTurn(definition, state, dice());
      assert.deepEqual(eventsOf(step.events, "save"), []);
      assert.equal(has(step.state, "dominated"), true);
      assert.equal(step.state.cursor, cursor);
      state = step.state;
    }
  }

  // Positive damage tests the stored DC, not the damaging action's DC; success ends with "save".
  {
    for (const [face, remains] of [
      [9, true],
      [10, false],
    ] as const) {
      const state = dominated();
      who(state, "ally").actions[0]!.saveDifficulty = 19;
      const hit = strike(JSON.parse(JSON.stringify(state)), [10, face]);
      assert.equal(has(hit.state, "dominated"), remains);
      assert.equal(who(hit.state).health!.value, 72);
      assert.deepEqual(
        eventsOf(hit.events, "save").map((save) => [save.save, save.difficulty, save.sourceId, save.success]),
        [["wis_save", 13, "corwin", !remains]],
      );
      assert.deepEqual(
        eventsOf(hit.events, "condition")
          .filter((event) => !event.active)
          .map((event) => event.reason),
        remains ? [] : ["save"],
      );
      assert.equal(hit.state.cursor, state.cursor + 2);
    }
    for (const alter of [
      (state: RulesetEncounterState) => {
        delete who(state).tracked[0]!.saveEnds;
      },
      (state: RulesetEncounterState) => {
        delete who(state).tracked[0]!.difficulty;
      },
    ]) {
      const state = dominated();
      alter(state);
      assert.deepEqual(eventsOf(strike(state, [10]).events, "save"), [], "no stored save or DC rolls nothing");
    }
    const noRule = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions = doc.combat.conditions.filter((entry: any) => entry.condition !== "dominated");
      }),
    );
    assert.equal(has(strike(dominated(noRule), [10, 10], noRule).state, "dominated", "holder", noRule), false);
    const flagged = parsedOrThrow(
      document((doc) => {
        doc.combat.conditions.find((entry: any) => entry.condition === "dominated").saveWhenDamaged = true;
      }),
    );
    assert.equal(eventsOf(strike(dominated(flagged), [10, 9], flagged).events, "save").length, 1);
  }

  // A miss, zero damage or immunity never asks for the damage save.
  {
    for (const [damage, faces] of [
      [8, [1]],
      [0, [10]],
    ] as const) {
      const state = dominated(definition, [{ ...bite, damage: { flat: damage } }]);
      const hit = strike(state, [...faces]);
      assert.deepEqual(eventsOf(hit.events, "save"), []);
      assert.equal(has(hit.state, "dominated"), true);
      assert.equal(hit.state.cursor, state.cursor + 1);
    }
    const immune = dominated(definition, [{ ...bite, damage: { flat: 8, type: "fire" } }]);
    who(immune).block!.immune = ["fire"];
    const hit = strike(immune, [10]);
    assert.equal(eventsOf(hit.events, "damage")[0]?.dealt, 0);
    assert.deepEqual(eventsOf(hit.events, "save"), []);
    assert.equal(has(hit.state, "dominated"), true);
  }

  // Clauses and riders belong to one blow. A failed save is not retried by its second amount.
  {
    for (const first of [0, 8]) {
      const state = dominated(definition, [{ ...bite, damage: { flat: first, plus: [{ flat: 3 }] } }]);
      const hit = strike(state, [10, 9]);
      assert.deepEqual(
        eventsOf(hit.events, "damage").map((event) => event.dealt),
        [first, 3],
      );
      assert.equal(eventsOf(hit.events, "save").length, 1);
      assert.equal(has(hit.state, "dominated"), true);
      assert.equal(hit.state.cursor, state.cursor + 2);
      who(hit.state, "ally").budgets.action = 1;
      const again = strike(hit.state, [10, 10]);
      assert.equal(eventsOf(again.events, "save").length, 1, "a later blow rolls again");
      assert.equal(has(again.state, "dominated"), false);
    }
    const rider = dominated();
    who(rider, "ally").riders = [
      { id: "sting", label: "Sting", on: "hit", oncePer: "turn", amount: { count: 0, sides: 0, flat: 3 } },
    ];
    const hit = strike(rider, [10, 9]);
    assert.deepEqual(
      eventsOf(hit.events, "damage").map((event) => event.dealt),
      [8, 3],
    );
    assert.equal(eventsOf(hit.events, "save").length, 1);
    assert.equal(has(hit.state, "dominated"), true);

    // Each holder in one multi-target action gets their own save.
    const several = dominated(definition, [
      { id: "bite", name: "Bite", budget: "action", damage: { flat: 8, plus: [{ flat: 3 }] } },
    ]);
    who(several, "friend").tracked.push(structuredClone(who(several).tracked[0]!));
    who(several, "ally").actions[0]!.targets.count = 2;
    who(several, "ally").actions[0]!.reach = 2;
    const both = use(turn(several, "ally"), "ally", "Bite", [9, 10], definition, ["holder", "friend"]);
    assert.deepEqual(
      eventsOf(both.events, "save").map((event) => [event.actorId, event.success]),
      [
        ["holder", false],
        ["friend", true],
      ],
    );
    assert.equal(has(both.state, "dominated"), true);
    assert.equal(has(both.state, "dominated", "friend"), false);
  }

  // 1.125 still repeats a turn save for each positive amount, and still saves at turn end.
  {
    const state = use(
      fight(definition, [{ ...bite, damage: { flat: 8, plus: [{ flat: 3 }] } }]),
      "corwin",
      "turn-save",
      [1],
    ).state;
    const hit = strike(state, [10, 9, 9]);
    assert.deepEqual(
      eventsOf(hit.events, "save").map((save) => [save.difficulty, save.success]),
      [
        [13, false],
        [13, false],
      ],
    );
    assert.equal(has(hit.state, "turn_save"), true);
    const ended = advanceRulesetTurn(definition, turn(hit.state, "holder"), dice(10));
    assert.equal(has(ended.state, "turn_save"), false);
    assert.equal(eventsOf(ended.events, "save")[0]?.difficulty, 13);
  }

  // Import and the editor accept the new timing, including an until-save duration.
  {
    for (const at of ["turn-start", "turn-end", "damaged"]) {
      assert.equal(
        parseRulesetDefinition(
          document((doc) => {
            doc.catalogs.at(-1).entries[0].mechanics.applies[0].saveEnds.at = at;
          }),
        ).ok,
        true,
      );
    }
    refused(
      document((doc) => {
        doc.catalogs.at(-1).entries[0].mechanics.applies[0].saveEnds.at = "hit";
      }),
      /saveEnds/,
    );
    refused(
      document((doc) => {
        delete doc.catalogs.at(-1).entries[0].mechanics.applies[0].saveEnds;
      }),
      /until-save/,
    );
    const editor = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    let saves = 0;
    const walk = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object" && node.properties?.saveEnds && node.properties?.duration) {
        saves++;
        assert.deepEqual(node.properties.saveEnds.properties.at.enum, [
          "turn-end",
          "turn-start",
          "damaged",
          "action",
          "source-turn-start",
          "days",
        ]);
        assert.deepEqual(node.then, { required: ["saveEnds"] });
      }
      Object.values(node).forEach(walk);
    };
    walk(editor);
    assert.ok(saves >= 4, "all editor applies nodes carry the timing");
  }

  // Header entries, catalog files, creature actions and condition onEnd applies require 1.129.
  {
    const manifest = (minor: number, schemaVersion = 2) => ({
      schemaVersion,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-save-on-damage",
      name: "Save on damage",
      version: "0.1.0",
      description: "A ruleset with saves only on damage.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json", "catalogs/saves.json"] } },
      files: ["ruleset.json", "catalogs/saves.json"].map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gate =
      "A ruleset whose saves are rolled only on damage requires schemaVersion 2 and capabilityApi 1.129 or newer";
    const applies = { condition: "charmed", duration: "until-save", saveEnds: { save: "wis_save", at: "damaged" } };
    for (const kind of ["catalog", "creature", "onEnd", "item"] as const) {
      for (const file of kind === "catalog" || kind === "creature" || kind === "item" ? [false, true] : [false]) {
        const doc = JSON.parse(fiveEText);
        let catalog: any;
        if (kind === "item") doc.items = { categories: [{ id: "gear", label: "Gear" }] };
        if (kind === "onEnd")
          doc.combat.conditions[0].onEnd = { applies: [{ ...structuredClone(applies), duration: { rounds: 2 } }] };
        else {
          const entry =
            kind === "catalog"
              ? {
                  ...spell("dominate", {
                    kind: "debuff",
                    save: { save: "wis_save", onSuccess: "negates" },
                    applies: [structuredClone(applies)],
                  }),
                }
              : kind === "creature"
                ? {
                    id: "caster",
                    label: "Caster",
                    creature: {
                      ...block(),
                      tier: "cr_1",
                      actions: [
                        {
                          id: "dominate",
                          name: "Dominate",
                          budget: "action",
                          saveDifficulty: 13,
                          applies: [structuredClone(applies)],
                        },
                      ],
                    },
                  }
                : {
                    id: "wand",
                    label: "Wand",
                    item: {
                      category: "gear",
                      use: { kind: "buff", budget: "action", saveDifficulty: 13, applies: [structuredClone(applies)] },
                    },
                  };
          catalog = {
            id: "saves",
            label: "Saves",
            ...(kind === "catalog" ? { feeds: ["spells"] } : { holds: kind === "creature" ? "creatures" : "items" }),
            entries: [entry],
          };
          doc.catalogs.push(catalog);
        }
        parsedOrThrow(doc);
        const documents = new Map<string, unknown>();
        if (file) {
          documents.set("catalogs/saves.json", { entries: catalog.entries });
          delete catalog.entries;
          catalog.asset = "catalogs/saves.json";
        }
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(128) as any, doc, documents),
          gate,
          `${kind}, file=${file}`,
        );
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(129) as any, doc, documents),
          null,
          `${kind}, file=${file}`,
        );
        assert.match(
          getCapabilityPackageInstallIssue(manifest(129, 1) as any, doc, documents) ?? "",
          /requires schemaVersion 2/,
        );
      }
    }
    assert.equal(getCapabilityPackageInstallIssue(manifest(128) as any, JSON.parse(fiveEText)), null);
    const turnSave = document((doc) => {
      doc.catalogs.at(-1).entries[0].mechanics.applies[0].saveEnds.at = "turn-end";
    });
    assert.equal(getCapabilityPackageInstallIssue(manifest(128) as any, turnSave), null);
  }
  console.info("Damage-only saves: no turn save, stored DC, one roll per blow and holder, gated at 1.129.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
