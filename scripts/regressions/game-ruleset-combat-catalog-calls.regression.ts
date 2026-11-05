/**
 * Creatures called by a catalog entry or an item use (Capability API 1.394).
 *
 *   - `mechanics.calls` with `options`: Conjure Animals, its user picking one wolf or two hounds as
 *     they cast it, each option a mode. They join on the caster's side, beside them.
 *   - Held by the entry's concentration: broken, they leave the fight.
 *   - With `rounds`: they leave as that many rounds pass, at their caller's turn.
 *   - A bestiary creature or a stat block may stand on the party's side from the start.
 *   - Refused shapes; the install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetItemUseSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetCatalogItem,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-catalog-calls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 394);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const wolf = {
    id: "dire-wolf",
    label: "Dire Wolf",
    filters: { challenge: "CR 1", kind: "Beast", places: ["Forest"] },
    creature: {
      health: 30,
      defense: 14,
      initiativeModifier: 0,
      speed: 50,
      tier: "cr_1",
      actions: [{ id: "maul", name: "Maul", budget: "action", toHit: 5, damage: { flat: 8 }, reach: 5 }],
    },
  };
  const conjure = (calls: Record<string, unknown>) => ({
    id: "conjure-animals",
    label: "Conjure Animals",
    rows: [{ list: "spells", values: { name: "Conjure Animals", level: 3, prepared: true } }],
    mechanics: { kind: "utility", targets: "self", budget: "action", concentration: true, calls },
  });
  const options = {
    options: [
      { creature: "creatures/dire-wolf", count: { flat: 1 } },
      { creature: "creatures/cinder-hound", count: { flat: 2 }, label: "Two cinder hounds" },
      { creature: "creatures/nobody", count: { flat: 4 } },
    ],
    initiative: "after",
    rounds: 10,
  };
  const document = (entries: unknown[], edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries.push(structuredClone(wolf));
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries });
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
  let queued: number[] = [];
  const roll = (sides: number) => Math.min(sides, queued.shift() ?? 10);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const fight = (definition: RulesetDefinition, fields: Record<string, unknown> = {}) => {
    const entries = definition.catalogs!.find((catalog) => catalog.id === "spells")!.entries! as RulesetCatalogEntry[];
    const bestiary: RulesetCatalogEntriesById = {
      creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries!,
    };
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary,
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, ...fields },
            lists: { spells: entries.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          live: {},
          catalogs: { spells: entries },
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: {
            health: 100,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [
              {
                id: "smash",
                label: "Smash",
                kind: "attack",
                budget: "action",
                toHit: 30,
                damage: { flat: 30, type: "bludgeoning" },
              },
            ],
          },
        },
      ],
      board: {
        grid: { width: 10, height: 3, tiles: Array.from({ length: 3 }, () => Array(10).fill("plains")) },
        placements: { druid: { x: 3, y: 1 }, brute: { x: 4, y: 1 } },
      },
    });
    state.order = ["druid", "brute"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const step = (definition: RulesetDefinition, state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const taken = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(taken.events, "refused"), [], JSON.stringify(taken.events));
    return taken;
  };
  const cast = (definition: RulesetDefinition, state: RulesetEncounterState, mode?: string) => {
    const option = rulesetCombatOptions(definition, state, "druid").find((one) => one.label === "Conjure Animals");
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, "druid")
        .map((one) => one.label)
        .join(", "),
    );
    return {
      option,
      taken: step(definition, state, {
        actorId: "druid",
        optionId: option.id,
        targetIds: option.targets.count === 0 ? [] : ["druid"],
        ...(mode ? { mode } : {}),
      }),
    };
  };

  // ── Conjure Animals: picked among its options ──
  const definition = parsed(document([conjure(options)]));
  {
    const { option, taken } = cast(definition, fight(definition), "call-1");
    assert.deepEqual(
      option.modes?.map((one) => [one.id, one.label]),
      [
        ["call-0", "Dire Wolf ×1"],
        ["call-1", "Two cinder hounds"],
      ],
      "an option nobody can find is not offered",
    );
    const [called] = of(taken.events, "called");
    assert.deepEqual(called?.ids, ["called-1", "called-2"]);
    const state = taken.state;
    for (const id of called!.ids) {
      const hound = who(state, id);
      assert.equal(hound.side, "party", "on the caster's side");
      assert.equal(hound.calledBy, "druid");
      assert.deepEqual(hound.creature, { catalogId: "creatures", entryId: "cinder-hound" });
      assert.equal(hound.calledUntil, 11);
    }
    assert.deepEqual(state.order, ["druid", "called-1", "called-2", "brute"], "right after the druid");
    assert.equal(who(state, "druid").concentrating?.label, "Conjure Animals (Two cinder hounds)");

    // Concentration broken: a blow on the druid and a failed save.
    const hit = structuredClone(state);
    hit.turn = hit.order.indexOf("brute");
    who(hit, "brute").budgets.action = 1;
    queued = [10, 1];
    const broken = step(definition, hit, { actorId: "brute", optionId: "smash", targetIds: ["druid"] });
    queued = [];
    const [gone] = of(broken.events, "sentAway");
    assert.deepEqual(gone, {
      type: "sentAway",
      actorId: "druid",
      ids: ["called-1", "called-2"],
      reason: "concentration",
    });
    for (const id of gone!.ids) {
      const hound = who(broken.state, id);
      assert.ok(hound.dismissed && hound.defeated, "out of the fight");
      assert.equal(hound.x, undefined, "and off the board");
    }

    // Kept, they leave as the tenth round after comes round to the druid.
    let later = structuredClone(state);
    later.round = 10;
    later.turn = later.order.indexOf("brute");
    later = step(definition, later, { actorId: "brute", optionId: "end-turn", targetIds: [] }).state;
    const next = applyRulesetCombatChoice(
      definition,
      structuredClone(later),
      { actorId: "druid", optionId: "end-turn", targetIds: [] },
      roll,
    );
    assert.equal(of(next.events, "sentAway").length, 0, "not yet in round 10");
    let round = structuredClone(state);
    round.round = 10;
    round.turn = round.order.indexOf("brute");
    who(round, "brute").budgets.action = 1;
    const turned = step(definition, round, { actorId: "brute", optionId: "end-turn", targetIds: [] });
    assert.equal(turned.state.round, 11);
    assert.equal(turned.state.order[turned.state.turn], "druid");
    assert.deepEqual(of(turned.events, "sentAway")[0]?.ids, ["called-1", "called-2"]);
    assert.equal(of(turned.events, "sentAway")[0]?.reason, "rounds");
  }

  // ── One creature, no choosing ──
  {
    const one = parsed(document([conjure({ creature: "creatures/dire-wolf", count: { dice: "1d4" } })]));
    const { option, taken } = cast(one, fight(one));
    assert.equal(option.modes, undefined);
    assert.equal(of(taken.events, "called")[0]?.ids.length, 4, "a d4 thrown at its most");
  }

  // ── Read from a catalog (1.402): any beast, capped by challenge, picked as it is cast ──
  {
    const ranked = (calls: Record<string, unknown>) =>
      parsed(
        document([conjure(calls)], (doc) => {
          const creatures = doc.catalogs.find((catalog: { holds?: string }) => catalog.holds === "creatures");
          creatures.filters.push({ id: "cr", label: "Challenge rating", type: "number" });
          creatures.entries.find((one: { id: string }) => one.id === "cinder-hound").filters.cr = 1;
          creatures.entries.find((one: { id: string }) => one.id === "dire-wolf").filters.cr = 2;
        }),
      );
    const banded = ranked({
      options: [
        {
          from: { catalog: "creatures", filters: { kind: "beast" } },
          upTo: { filter: "cr", at: 2 },
          count: { flat: 1 },
          label: "One of CR 2",
        },
        {
          from: { catalog: "creatures", filters: { kind: "Beast" } },
          upTo: { filter: "cr", at: 1 },
          count: { flat: 2 },
        },
      ],
      initiative: "after",
    });
    const { option, taken } = cast(banded, fight(banded), "call-1-cinder-hound");
    assert.deepEqual(
      option.modes?.map((one) => [one.id, one.label]),
      [
        ["call-0-cinder-hound", "One of CR 2: Cinder Hound ×1"],
        ["call-0-dire-wolf", "One of CR 2: Dire Wolf ×1"],
        ["call-1-cinder-hound", "Cinder Hound ×2"],
      ],
      "the wolf is above the second band",
    );
    const [called] = of(taken.events, "called");
    assert.equal(called?.ids.length, 2);
    assert.deepEqual(who(taken.state, called!.ids[0]!).creature, { catalogId: "creatures", entryId: "cinder-hound" });
    // One band, without options.
    const any = ranked({
      from: { catalog: "creatures", notFilters: { kind: ["Plant", "Undead", "Construct", "Humanoid"] } },
      count: { flat: 1 },
    });
    assert.deepEqual(
      cast(any, fight(any), "call-dire-wolf").option.modes?.map((one) => one.id),
      ["call-cinder-hound", "call-dire-wolf"],
    );
    refused(
      document([conjure({ creature: "creatures/dire-wolf", upTo: { filter: "cr", at: 1 }, count: { flat: 1 } })]),
      /"upTo" caps/,
    );
    refused(
      document([
        conjure({
          options: [
            { creature: "creatures/dire-wolf", from: { catalog: "creatures" }, count: { flat: 1 } },
            { creature: "creatures/dire-wolf", count: { flat: 1 } },
          ],
        }),
      ]),
      /An option names one "creature" or reads "from" a catalog/,
    );
  }

  // ── Twice as many with a 5th-level slot, three times with 7th (1.402) ──
  {
    const upcast = conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, timesPerSteps: 2 });
    const scaled = parsed(
      document([{ ...upcast, mechanics: { ...upcast.mechanics, cost: [{ pool: "slots_3", amount: 1 }] } }]),
    );
    const wolves = (payWith: string | undefined) => {
      const state = fight(scaled, {
        level: 17,
        spellcasting_ability: "wis",
        slots_max_3: 3,
        slots_max_5: 2,
        slots_max_7: 1,
      });
      const option = rulesetCombatOptions(scaled, state, "druid").find((one) => one.label === "Conjure Animals")!;
      const taken = step(scaled, state, {
        actorId: "druid",
        optionId: option.id,
        targetIds: [],
        ...(payWith ? { payWith } : {}),
      });
      return of(taken.events, "called")[0]?.ids.length;
    };
    assert.equal(wolves(undefined), 1, "its own 3rd-level slot");
    assert.equal(wolves("slots_5"), 2);
    assert.equal(wolves("slots_7"), 3);
    // Eight at a time, picked among options read from the bestiary: more than eight come (1.403).
    const pack = conjure({
      options: [
        { creature: "creatures/cinder-hound", count: { flat: 2 } },
        { from: { catalog: "creatures" }, count: { flat: 8 } },
      ],
      timesPerSteps: 2,
    });
    const packed = parsed(
      document([{ ...pack, mechanics: { ...pack.mechanics, cost: [{ pool: "slots_3", amount: 1 }] } }]),
    );
    const many = (payWith: string) => {
      const state = fight(packed, {
        level: 17,
        spellcasting_ability: "wis",
        slots_max_3: 3,
        slots_max_5: 2,
        slots_max_7: 1,
      });
      const option = rulesetCombatOptions(packed, state, "druid").find((one) => one.label === "Conjure Animals")!;
      const taken = step(packed, state, {
        actorId: "druid",
        optionId: option.id,
        targetIds: [],
        mode: option.modes!.find((one) => one.id.endsWith("-dire-wolf"))!.id,
        payWith,
      });
      return of(taken.events, "called")[0]?.ids.length;
    };
    assert.equal(many("slots_5"), 16);
    assert.equal(many("slots_7"), 24);
  }

  // ── A bestiary creature or a stat block beside the party, built as an opponent is ──
  {
    const allied = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      bestiary: { creatures: definition.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        { id: "wolf", name: "Wolf", side: "party", creature: { catalogId: "creatures", entryId: "dire-wolf" } },
        {
          id: "post",
          name: "Post",
          side: "party",
          block: { health: 9, defense: 10, initiativeModifier: 0, speed: 0, actions: [] },
        },
      ],
    });
    assert.deepEqual(
      allied.combatants.map((one) => [one.id, one.side, one.health?.max, one.sheet === undefined]),
      [
        ["wolf", "party", 30, true],
        ["post", "party", 9, true],
      ],
    );
    // Felled, such an ally is out of the fight, not dying as a character would be.
    const felled = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        {
          id: "post",
          name: "Post",
          side: "party",
          block: { health: 9, defense: 10, initiativeModifier: 0, speed: 0, actions: [] },
        },
        {
          id: "ogre",
          name: "Ogre",
          side: "enemy",
          block: {
            health: 50,
            defense: 10,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Club", budget: "action", toHit: 30, damage: { count: 0, sides: 0, flat: 20 } }],
          },
        },
      ],
    });
    felled.order = ["ogre", "post"];
    felled.turn = 0;
    const clubbed = step(definition, felled, {
      actorId: "ogre",
      optionId: who(felled, "ogre").actions[0]!.id,
      targetIds: ["post"],
    });
    assert.equal(who(clubbed.state, "post").defeated, true);
    assert.ok(!who(clubbed.state, "post").dying, "never dying");
    assert.equal(of(clubbed.events, "defeated").length, 1);
  }

  // ── An item's use that calls, a utility use with nothing else: a Figurine of Wondrous Power ──
  {
    const use = {
      kind: "utility",
      targets: "self",
      budget: "action",
      calls: { creature: "creatures/dire-wolf", count: { flat: 1 }, initiative: "after", rounds: 600 },
    };
    const checked = rulesetItemUseSchema.safeParse(use);
    assert.ok(checked.success, checked.success ? "" : JSON.stringify(checked.error.issues));
    const withItems = parsed(
      document([], (doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
        doc.catalogs.push({
          id: "magic_items",
          label: "Magic items",
          holds: "items",
          entries: [{ id: "figurine", label: "Ebony Fly", item: { category: "gear", use } }],
        });
      }),
    );
    const figurine: RulesetSheetItem = {
      name: "Ebony Fly",
      quantity: 1,
      worn: true,
      item: { category: "gear", use } as unknown as RulesetCatalogItem,
    };
    const state = createRulesetEncounter({
      definition: withItems,
      seed: 1,
      roller: roll,
      bestiary: { creatures: withItems.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [figurine],
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
    });
    state.order = ["druid", "brute"];
    state.turn = 0;
    const option = rulesetCombatOptions(withItems, state, "druid").find((one) => one.label.includes("Ebony Fly"));
    assert.ok(
      option,
      rulesetCombatOptions(withItems, state, "druid")
        .map((one) => one.label)
        .join(", "),
    );
    const taken = step(withItems, state, { actorId: "druid", optionId: option.id, targetIds: [] });
    const [called] = of(taken.events, "called");
    assert.equal(called?.ids.length, 1);
    assert.deepEqual(who(taken.state, called!.ids[0]!).creature, { catalogId: "creatures", entryId: "dire-wolf" });

    // A further use spending charges that reads its creature from a catalog, picked as it is used:
    // a Staff of the Magi's Conjure Elemental, 7 charges.
    const staffItem = {
      category: "gear",
      stack: 1,
      charges: { max: 50 },
      use: { label: "Light", kind: "heal", budget: "action", amount: { flat: 1 }, charges: 1 },
      moreUses: [
        {
          label: "Conjure Elemental",
          use: {
            kind: "utility",
            targets: "self",
            budget: "action",
            charges: 7,
            calls: { from: { catalog: "creatures" }, count: { flat: 1 }, initiative: "after", rounds: 600 },
          },
        },
      ],
    };
    const withStaff = parsed(
      document([], (doc) => {
        doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
        doc.catalogs.push({
          id: "magic_items",
          label: "Magic items",
          holds: "items",
          entries: [{ id: "staff", label: "Staff of the Magi", item: staffItem }],
        });
      }),
    );
    const staffState = createRulesetEncounter({
      definition: withStaff,
      seed: 1,
      roller: roll,
      bestiary: { creatures: withStaff.catalogs!.find((catalog) => catalog.holds === "creatures")!.entries! },
      combatants: [
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 18, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          items: [
            {
              name: "Staff of the Magi",
              quantity: 1,
              worn: true,
              charges: 50,
              item: staffItem as unknown as RulesetCatalogItem,
            },
          ],
        },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 10, defense: 10, initiativeModifier: 0, speed: 30, actions: [] },
        },
      ],
    });
    staffState.order = ["druid", "brute"];
    staffState.turn = 0;
    const conjure = rulesetCombatOptions(withStaff, staffState, "druid").find((one) =>
      one.label.endsWith("Conjure Elemental"),
    );
    assert.ok(conjure);
    const wolf = conjure.modes?.find((one) => one.id.endsWith("dire-wolf"));
    assert.ok(wolf, JSON.stringify(conjure.modes?.map((one) => one.id)));
    const conjured = step(withStaff, staffState, {
      actorId: "druid",
      optionId: conjure.id,
      targetIds: [],
      mode: wolf.id,
    });
    const [elemental] = of(conjured.events, "called");
    assert.deepEqual(who(conjured.state, elemental!.ids[0]!).creature, {
      catalogId: "creatures",
      entryId: "dire-wolf",
    });
    assert.equal(who(conjured.state, "druid").charges?.[0], 43, "seven charges spent");
  }

  // ── Refused shapes ──
  {
    refused(document([conjure({ creature: "creatures/dire-wolf" })]), /says its "count"/);
    refused(document([conjure({ count: { flat: 1 } })]), /reads "from" a catalog, or lists "options"/);
    refused(
      document([conjure({ creature: "creatures/dire-wolf", count: { flat: 1 }, options: options.options })]),
      /reads "from" a catalog, or lists "options"/,
    );
    refused(document([conjure({ ...options, count: { flat: 2 } })]), /its own "count"/);
    refused(document([conjure({ creature: "dire-wolf", count: { flat: 1 } })]), /<catalogId>\/<entryId>/);
    refused(document([conjure({ creature: "creatures/dire-wolf", count: { flat: 0 } })]), /at least one creature/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a catalog entry or an item use that calls creatures into the fight requires schemaVersion 2 and capabilityApi 1.394 or newer";
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
    const caller = document([conjure(options)]);
    assert.equal(getCapabilityPackageInstallIssue(manifest(393) as never, caller), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(394) as never, caller), gate);
    // A creature's own call is 1.325's, not this.
    const creatureCall = JSON.parse(fiveEText);
    creatureCall.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "creatures")
      .entries[0].creature.actions.push({
        id: "howl",
        name: "Howl",
        budget: "action",
        calls: { creature: "creatures/cinder-hound", count: { flat: 1 } },
      });
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(393) as never, creatureCall), gate);
    // Read from a catalog or scaled by cost: 1.402.
    const later =
      "A ruleset with calls read from a catalog or scaled by cost, or an attack mode on melee attacks, requires schemaVersion 2 and capabilityApi 1.402 or newer";
    for (const calls of [
      { from: { catalog: "creatures" }, count: { flat: 1 } },
      { creature: "creatures/dire-wolf", count: { flat: 1 }, timesPerSteps: 2 },
      { options: [{ from: { catalog: "creatures" }, count: { flat: 1 } }] },
    ]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(401) as never, document([conjure(calls)])), later);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(402) as never, document([conjure(calls)])), later);
    }
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(401) as never, document([conjure(options)])), later);
  }

  console.log(
    "Catalog calls: Conjure Animals' two hounds on the druid's side right after them, gone with its concentration or as its ten rounds pass; one creature by its count; refusals; gated at 1.394.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
