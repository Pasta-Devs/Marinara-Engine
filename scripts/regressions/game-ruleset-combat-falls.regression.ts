/**
 * Catching a fall (Capability API 1.124): Feather Fall before a ledge or a grounded flier lands.
 * The answer pays its reaction and slot, and puts its condition on the faller. With no answer the
 * fall lands as before. Each fall from an area is asked about separately, even across a save/load.
 */
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_PASS_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  readRulesetLive,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatHealth,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  rulesetWindowOptions,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-falls-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { rulesetWindowTargetOf } =
  await import("../../packages/server/src/services/game/ruleset-combat-director.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 120);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const feather = (reaction: Record<string, unknown> = { on: "falls" }, targets = "ally") => ({
    id: "feather-fall",
    label: "Feather Fall",
    rows: [{ list: "spells", values: { name: "Feather Fall", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      targets,
      range: 60,
      budget: "reaction",
      cost: [{ pool: "slots_1", amount: 1 }],
      reaction,
      applies: [{ condition: "feather_falling", duration: { rounds: 10 } }],
    },
  });
  const document = () => {
    const doc = JSON.parse(fiveEText);
    doc.combat.elevation = {
      levelHeight: 5,
      falling: { per: 10, dice: { count: 1, sides: 6 }, max: 20, type: "bludgeoning", prone: "prone" },
    };
    doc.sheet.live.conditions.push({ id: "feather_falling", label: "Feather falling" });
    doc.combat.conditions.push({ condition: "feather_falling", fallsSafely: true });
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [feather()] });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, "the file should be refused");
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock => ({
    health: 40,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    actions: [{ id: "bite", name: "Bite", budget: "action", toHit: 4, damage: { flat: 1 } }],
    ...extra,
  });
  const fight = (entry = feather(), casterAt = 3): RulesetEncounterState => {
    const spell = entry as unknown as RulesetCatalogEntry;
    return createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "snag", name: "Snag", side: "enemy", block: block({ initiativeModifier: 20 }) },
        {
          id: "brenna",
          name: "Brenna",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40 },
          }),
          live: {},
          catalogs: {},
        },
        {
          id: "corwin",
          name: "Corwin",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
            fields: { level: 3, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "int", slots_max_1: 4 },
            lists: { spells: rowsFromCatalogEntry("spells", spell).map((row) => row.row) },
          }),
          live: {},
          catalogs: { spells: [spell] },
        },
      ],
      board: {
        grid: { width: 20, height: 1, tiles: [Array(20).fill("plains")], elevation: [[4, 4, ...Array(18).fill(0)]] },
        placements: { snag: { x: 0, y: 0 }, brenna: { x: 1, y: 0 }, corwin: { x: casterAt, y: 0 } },
      },
    });
  };
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, faces: number[] = []) => {
    let index = 0;
    const step = applyRulesetCombatChoice(definition, state, choice, (sides) => {
      assert.ok(index < faces.length, `no die left for d${sides}`);
      return faces[index++]!;
    });
    assert.equal(
      step.events.find((event) => event.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const shove = (state: RulesetEncounterState, label = "Shove away", target = "brenna") => {
    const option = rulesetCombatOptions(definition, state, "snag").find((one) => one.label === label);
    assert.ok(option, `Snag has ${label}`);
    return act(state, { actorId: "snag", optionId: option.id, targetIds: [target] }, [18, 1, 3, 4]);
  };
  const eventsOf = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const who = (state: RulesetEncounterState, id = "brenna") => rulesetCombatant(state, id)!;
  const answer = (state: RulesetEncounterState, pass = false) => {
    const window = state.window;
    assert.ok(window, "the fall must be held for an answer");
    assert.equal(window.trigger.kind, "falls");
    const actorId = window.waiting[0]!;
    const option = rulesetWindowOptions(definition, state, actorId).find((one) => one.label === "Feather Fall");
    assert.ok(option);
    assert.deepEqual(option.targets, { side: "self", count: 0 }, "the faller is already chosen");
    assert.equal(rulesetWindowTargetOf(state, who(state, actorId), option), window.trigger.sourceId);
    return act(
      state,
      { actorId, optionId: pass ? RULESET_PASS_OPTION : option.id, targetIds: [], window: window.id },
      pass ? [3, 4, 3, 4] : [],
    );
  };

  // ── A ledge, answered or declined ──
  {
    const held = shove(fight());
    assert.deepEqual(held.state.window?.trigger, { kind: "falls", sourceId: "brenna", label: "fall", levels: 4 });
    assert.deepEqual(held.state.window?.resume, { kind: "fall", actorId: "snag", targetId: "brenna", levels: 4 });
    assert.deepEqual(held.state.window?.waiting, ["corwin"]);
    assert.deepEqual(eventsOf(held.events, "damage"), []);
    assert.deepEqual(who(held.state).tracked, []);
    assert.equal(who(held.state).x, 2, "the shove finishes before its fall lands");
    const caught = answer(JSON.parse(JSON.stringify(held.state)));
    assert.equal(caught.state.window, undefined);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(caught.state)).value, 40);
    assert.deepEqual(rulesetCombatConditions(definition, who(caught.state)), ["feather_falling"]);
    assert.equal(who(caught.state, "corwin").budgets.reaction, 0);
    assert.deepEqual(
      eventsOf(caught.events, "spend").map((one) => [one.actorId, one.pool, one.amount]),
      [["corwin", "slots_1", 1]],
    );
    assert.deepEqual(eventsOf(caught.events, "damage"), []);
    assert.deepEqual(eventsOf(caught.events, "fell"), [{ type: "fell", targetId: "brenna", levels: 4 }]);
    const declined = answer(held.state, true);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(declined.state)).value, 33);
    assert.ok(rulesetCombatConditions(definition, who(declined.state)).includes("prone"));
    assert.equal(who(declined.state, "corwin").budgets.reaction, 1);
    const absent = fight();
    who(absent, "corwin").actions = [];
    const plain = shove(absent);
    const withoutWindows = [...held.events, ...declined.events].filter(
      (one) => one.type !== "window" && one.type !== "pass",
    );
    assert.deepEqual(withoutWindows, plain.events, "declining preserves the original event stream");
  }

  // ── A Ring of Feather Falling (1.477): worn, no fall harms; carried, it does nothing ──
  {
    for (const worn of [true, false]) {
      const state = fight();
      who(state, "corwin").actions = [];
      who(state).sheet!.items = [
        { name: "Ring of Feather Falling", quantity: 1, worn, item: { category: "gear", worn: { fallsSafely: true } } },
      ];
      const step = shove(state);
      assert.equal(step.state.window, undefined);
      assert.deepEqual(eventsOf(step.events, "fell"), [{ type: "fell", targetId: "brenna", levels: 4 }]);
      assert.equal(rulesetCombatHealth(definition, definition.combat!, who(step.state)).value, worn ? 40 : 33);
      assert.equal(rulesetCombatConditions(definition, who(step.state)).includes("prone"), !worn);
    }
  }

  // ── Eligibility, its side and its range ──
  {
    for (const change of [
      (state: RulesetEncounterState) => {
        who(state, "corwin").x = 19;
      },
      (state: RulesetEncounterState) => {
        who(state, "corwin").budgets.reaction = 0;
      },
      (state: RulesetEncounterState) => {
        who(state, "corwin").sheet!.build.fields.slots_max_1 = 0;
      },
      (state: RulesetEncounterState) => {
        who(state, "corwin").side = "enemy";
      },
      (state: RulesetEncounterState) => {
        who(state, "corwin").tracked.push({ condition: "incapacitated", rounds: 1 });
      },
    ]) {
      const state = fight();
      change(state);
      const plain = structuredClone(state);
      who(plain, "corwin").actions = [];
      const step = shove(state);
      assert.equal(step.state.window, undefined);
      assert.deepEqual(step.events, shove(plain).events, "no eligible answer changes no events");
      assert.equal(rulesetCombatHealth(definition, definition.combat!, who(step.state)).value, 33);
    }
    const atRange = fight(feather(), 14);
    assert.ok(shove(atRange).state.window, "sixty feet reaches the faller");
    assert.equal(shove(fight(feather(), 15)).state.window, undefined, "sixty-five feet does not");
    assert.ok(shove(fight(feather({ on: "harmed", also: [{ on: "falls" }] }))).state.window);
    const chosen = shove(fight(feather({ on: "falls", at: "chosen" })));
    assert.equal(
      rulesetCombatHealth(definition, definition.combat!, who(answer(chosen.state).state)).value,
      40,
      "falls still resolves on the faller",
    );
    assert.equal(
      shove(fight(feather({ on: "falls" }, "self"))).state.window,
      undefined,
      "a self answer cannot catch another",
    );
    const self = fight(feather({ on: "falls" }, "self"), 1);
    who(self).x = 3;
    const saved = answer(shove(self, "Shove away", "corwin").state);
    assert.ok(rulesetCombatConditions(definition, who(saved.state, "corwin")).includes("feather_falling"));
  }

  // ── A condition already held, even one read off a sheet ──
  {
    const state = fight();
    who(state, "corwin").actions = [];
    who(state).tracked.push({ condition: "feather_falling", rounds: 1 });
    const landed = shove(state);
    assert.equal(landed.state.window, undefined);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(landed.state)).value, 40);
    assert.deepEqual(rulesetCombatConditions(definition, who(landed.state)), ["feather_falling"]);
    assert.deepEqual(eventsOf(landed.events, "damage"), []);
  }

  // ── A safe condition held on the sheet needs no tracked combat copy ──
  {
    const state = fight();
    who(state, "corwin").actions = [];
    who(state).sheet!.live = { conditions: ["feather_falling"] };
    const landed = shove(state);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(landed.state)).value, 40);
    assert.deepEqual(eventsOf(landed.events, "damage"), []);
    assert.ok(!rulesetCombatConditions(definition, who(landed.state)).includes("prone"));
  }

  // ── A flier knocked prone, or held out of speed ──
  {
    const state = fight();
    who(state).altitude = 5;
    who(state).speeds = { fly: 30 };
    const held = shove(state, "Shove prone");
    assert.equal(held.state.window?.trigger.kind, "falls");
    assert.equal(who(held.state).altitude, undefined);
    assert.deepEqual(eventsOf(held.events, "damage"), []);
    const saved = answer(held.state);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(saved.state)).value, 40);
    assert.ok(
      rulesetCombatConditions(definition, who(saved.state)).includes("prone"),
      "Feather Fall does not remove the shove's prone",
    );
  }

  // ── A flier taken down by damage also gets the moment ──
  {
    const state = fight();
    who(state).altitude = 8;
    who(state).speeds = { fly: 30 };
    who(state, "snag").actions.push({
      id: "blast",
      label: "Blast",
      kind: "ability",
      budget: "action",
      targets: { side: "enemy", count: 1 },
      range: { normal: 20 },
      autoHit: true,
      damage: { count: 0, sides: 6, flat: 40 },
    });
    const held = act(state, { actorId: "snag", optionId: "blast", targetIds: ["brenna"] });
    assert.equal(held.state.window?.trigger.kind, "falls");
    assert.ok(who(held.state).down);
    assert.equal(eventsOf(held.events, "damage").length, 1, "only the blow, not the fall");
    const saved = answer(held.state);
    assert.deepEqual(eventsOf(saved.events, "damage"), []);
    assert.equal(
      readRulesetLive(definition, who(saved.state).sheet!.build, who(saved.state).sheet!.live).tracks.find(
        (one) => one.id === definition.combat!.dying!.failures,
      )?.value,
      0,
    );
    const declined = answer(held.state, true);
    assert.equal(eventsOf(declined.events, "damage").length, 1);
    assert.equal(
      readRulesetLive(definition, who(declined.state).sheet!.build, who(declined.state).sheet!.live).tracks.find(
        (one) => one.id === definition.combat!.dying!.failures,
      )?.value,
      1,
    );
  }

  // ── The cause can end the fight while its fall is still held ──
  {
    const state = fight();
    state.turn = state.order.indexOf("corwin");
    state.board!.grid.elevation = [Array(20).fill(0)];
    who(state).altitude = 4;
    who(state).speeds = { fly: 30 };
    who(state, "snag").health!.value = 1;
    who(state, "corwin").actions.push({
      id: "blast",
      label: "Blast",
      kind: "ability",
      budget: "action",
      targets: { side: "any", count: 2 },
      range: { normal: 20 },
      autoHit: true,
      damage: { count: 0, sides: 6, flat: 1 },
      applies: [{ condition: "grappled", duration: "instant" }],
    });
    const held = act(state, { actorId: "corwin", optionId: "blast", targetIds: ["brenna", "snag"] });
    assert.ok(who(held.state, "snag").defeated);
    assert.equal(held.state.window?.trigger.kind, "falls");
    assert.deepEqual(eventsOf(held.events, "outcome"), [], "the landing is still owed");
    const saved = answer(held.state);
    assert.deepEqual(eventsOf(saved.events, "outcome"), [{ type: "outcome", outcome: "victory" }]);
    assert.deepEqual(eventsOf(saved.events, "fell"), [{ type: "fell", targetId: "brenna", levels: 4 }]);
  }

  // ── Several fliers grounded by one action, with each fall held in turn ──
  {
    const state = fight();
    state.board!.grid.elevation = [Array(20).fill(0)];
    const tess = structuredClone(who(state));
    tess.id = "tess";
    tess.name = "Tess";
    tess.x = 2;
    state.combatants.push(tess);
    state.order.push(tess.id);
    for (const target of [who(state), tess]) {
      target.altitude = 4;
      target.speeds = { fly: 30 };
    }
    who(state, "corwin").budgets.reaction = 2;
    who(state, "snag").actions.push({
      id: "bind",
      label: "Bind",
      kind: "ability",
      budget: "action",
      targets: { side: "enemy", count: 2 },
      range: { normal: 20 },
      applies: [{ condition: "grappled", duration: "instant" }],
    });
    const distant = structuredClone(state);
    who(distant, "tess").x = 19;
    const unasked = act(distant, { actorId: "snag", optionId: "bind", targetIds: ["brenna", "tess"] }, [3, 4]);
    assert.equal(unasked.state.pendingFalls, undefined, "no eligible answer lands even during another window");
    assert.deepEqual(
      eventsOf(unasked.events, "damage").map((one) => one.targetId),
      ["tess"],
    );
    const held = act(state, { actorId: "snag", optionId: "bind", targetIds: ["brenna", "tess"] });
    assert.deepEqual(held.state.pendingFalls, [{ kind: "fall", actorId: "tess", targetId: "tess", levels: 4 }]);
    assert.equal(held.state.window?.trigger.sourceId, "brenna");
    assert.deepEqual(eventsOf(held.events, "damage"), []);
    assert.ok(
      rulesetCombatConditions(definition, who(held.state, "tess")).includes("grappled"),
      "the action finished its other target",
    );
    const first = answer(JSON.parse(JSON.stringify(held.state)));
    assert.equal(first.state.window?.trigger.sourceId, "tess");
    assert.notEqual(first.state.window?.id, held.state.window?.id);
    assert.equal(first.state.pendingFalls, undefined);
    const second = answer(JSON.parse(JSON.stringify(first.state)));
    assert.equal(second.state.window, undefined);
    assert.equal(who(second.state, "corwin").budgets.reaction, 0);
    for (const id of ["brenna", "tess"]) {
      assert.equal(rulesetCombatHealth(definition, definition.combat!, who(second.state, id)).value, 40);
      assert.ok(!rulesetCombatConditions(definition, who(second.state, id)).includes("prone"));
    }
    const passed = answer(held.state, true);
    assert.equal(passed.state.window?.trigger.sourceId, "tess");
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(passed.state)).value, 33);
    const last = answer(passed.state, true);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(last.state, "tess")).value, 33);
    assert.equal(last.state.window, undefined);
    // Spending the only reaction on the first leaves the second nobody to ask.
    const one = structuredClone(held.state);
    who(one, "corwin").budgets.reaction = 1;
    const option = rulesetWindowOptions(definition, one, "corwin")[0]!;
    const spent = act(one, { actorId: "corwin", optionId: option.id, targetIds: [], window: one.window!.id }, [3, 4]);
    assert.equal(spent.state.window, undefined);
    assert.equal(rulesetCombatHealth(definition, definition.combat!, who(spent.state, "tess")).value, 33);
  }

  // ── Import, for catalog mechanics and creature actions ──
  {
    for (const creature of [false, true]) {
      const withReaction = (reaction: Record<string, unknown>) => {
        const doc = document();
        if (creature)
          doc.catalogs
            .find((one: any) => one.id === "creatures")
            .entries.find((one: any) => one.id === "toll-sergeant").creature.actions[0].reaction = reaction;
        else doc.catalogs.at(-1).entries[0].mechanics.reaction = reaction;
        return doc;
      };
      parsed(withReaction({ on: "falls" }));
      parsed(withReaction({ on: "hit", also: [{ on: "falls" }] }));
      for (const extra of [
        { cancels: true },
        { blow: "melee" },
        { seesSource: true },
        { against: { catalogs: ["spells"] } },
      ]) {
        const key = Object.keys(extra)[0]!;
        refused(
          withReaction({ on: "falls", ...extra }),
          key === "cancels" ? /Only an "aimed" or "used" reaction cancels/ : /falls.*no source entry/,
        );
        refused(
          withReaction({ on: "hit", also: [{ on: "falls", ...extra }] }),
          key === "cancels" ? /cancels/ : /falls.*no source entry/,
        );
      }
    }
    const invalid = document();
    invalid.combat.conditions.at(-1).fallsSafely = false;
    refused(invalid, /fallsSafely/);
  }

  // ── The install gate, in headers and catalog files ──
  {
    const manifest = (minor: number) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-falls",
      name: "Falling",
      version: "0.1.0",
      description: "Reactions that catch a fall.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths: ["ruleset.json", "catalogs/spells.json", "catalogs/creatures.json"] } },
      files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
      permissions: [],
      restartRequired: false,
    });
    for (const kind of ["reaction", "also", "condition", "creature", "creature-also"]) {
      for (const file of [false, true]) {
        const doc = document();
        const spell = doc.catalogs.at(-1).entries[0];
        delete spell.mechanics.reaction;
        delete doc.combat.conditions.at(-1).fallsSafely;
        if (kind === "reaction") spell.mechanics.reaction = { on: "falls" };
        if (kind === "also") spell.mechanics.reaction = { on: "hit", also: [{ on: "falls" }] };
        if (kind === "condition") doc.combat.conditions.at(-1).fallsSafely = true;
        if (kind.startsWith("creature"))
          doc.catalogs
            .find((one: any) => one.id === "creatures")
            .entries.find((one: any) => one.id === "toll-sergeant").creature.actions[0].reaction =
            kind === "creature" ? { on: "falls" } : { on: "hit", also: [{ on: "falls" }] };
        const files = new Map<string, unknown>();
        if (file)
          for (const header of doc.catalogs.filter((one: any) => ["spells", "creatures"].includes(one.id))) {
            files.set(`catalogs/${header.id}.json`, { schemaVersion: 1, catalog: header.id, entries: header.entries });
            delete header.entries;
            header.asset = `catalogs/${header.id}.json`;
          }
        assert.equal(
          getCapabilityPackageInstallIssue(manifest(123) as any, doc, files),
          "A ruleset whose reactions catch a fall requires schemaVersion 2 and capabilityApi 1.124 or newer",
          `${kind}, file ${file}`,
        );
        assert.equal(getCapabilityPackageInstallIssue(manifest(124) as any, doc, files), null);
      }
    }
    assert.equal(getCapabilityPackageInstallIssue(manifest(123) as any, JSON.parse(fiveEText)), null);
  }
  // ── The editor schema says the same thing, for both moment shapes ──
  {
    const schema = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../docs/extending/ruleset.schema.json", import.meta.url)), "utf8"),
    );
    let main = 0,
      also = 0,
      conditions = 0;
    const visit = (node: any): void => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object" && node.properties?.on && node.properties?.against) {
        assert.ok(node.properties.on.enum.includes("falls"));
        const rule = node.allOf?.find((one: any) => one.if?.properties?.on?.const === "falls");
        assert.deepEqual(rule?.then, {
          not: { anyOf: ["cancels", "blow", "seesSource", "against"].map((key) => ({ required: [key] })) },
        });
        if (node.properties.at) {
          main++;
          assert.deepEqual(node.then.properties.on.enum, ["aimed", "used"]);
        } else also++;
      }
      if (node.type === "object" && node.properties?.noDamageFrom) {
        conditions++;
        assert.ok(JSON.stringify(node.properties.fallsSafely).includes('"const":true'));
      }
      Object.values(node).forEach(visit);
    };
    visit(schema);
    assert.ok(main > 0 && also > 0 && conditions > 0);
  }
  console.log("Falls: Feather Fall catches a ledge or grounded flier, with imports gated at 1.124.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
