/**
 * Putting out and lighting again (Capability API 1.295).
 *
 *   - `combat.sight.darkness.carried` is a switch on the menu of whoever carries it, named by its
 *     `label`: for nothing once a turn, or on its `budget`.
 *   - Put out, it sheds no light: its holder may go unseen in the dark. Lit again, they are seen,
 *     and found if they were hiding.
 *   - An item with a `toggle` sheds its `light` only while it is on: a lantern.
 *   - Nobody lights one in daylight: in bright light or sunlight, or in shade on a board fought in
 *     sunlight (a barn at noon), though dark ground is lit whatever the board's light.
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
  rulesetCanSee,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetLightAt,
  rulesetLightOf,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetSheetItem,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-light-switch-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 290);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = {
      unseenAttacks: true,
      eyes: "sight",
      darkness: { seeIn: ["darkvision"], carried: { bright: 20, dim: 20, label: "Torch" } },
    };
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look" };
    doc.sheet.live.conditions.push({ id: "darksighted", label: "Darksighted" });
    doc.combat.conditions.push({ condition: "darksighted", senses: { darkvision: 60 } });
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refusedDoc = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(fiveE());

  const hero = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    fields: { level: 1, ac: 12, speed: 30, hp_max: 30 },
    lists: { attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }] },
  });
  const orc = {
    health: 20,
    defense: 12,
    initiativeModifier: 0,
    speed: 30,
    checks: { look: 0, sneak: 0 },
    actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 4, flat: 0 } }],
  } as RulesetStatBlock;
  const lantern: RulesetSheetItem = {
    name: "Lantern",
    quantity: 1,
    worn: true,
    item: { category: "gear", toggle: { label: "Light", budget: "bonus" }, worn: { light: { bright: 30, dim: 30 } } },
  } as RulesetSheetItem;
  const fight = (def = definition, items?: RulesetSheetItem[]): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition: def,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build: hero, live: {}, ...(items ? { items } : {}) },
        { id: "orc", name: "Orc", side: "enemy", block: structuredClone(orc) },
      ],
      board: {
        grid: {
          width: 24,
          height: 10,
          tiles: Array.from({ length: 10 }, () => Array.from({ length: 24 }, () => "plains")),
        } as never,
        placements: { hero: { x: 2, y: 5 }, orc: { x: 14, y: 5 } },
        light: "dark",
      },
    });
    state.order = ["hero", "orc"];
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const menu = (state: RulesetEncounterState, def = definition) => rulesetCombatOptions(def, state, "hero");
  const flip = (state: RulesetEncounterState, optionId = "light:carried", def = definition): RulesetCombatStep => {
    state.turn = 0;
    const step = applyRulesetCombatChoice(def, state, { actorId: "hero", optionId, targetIds: [] }, () => 10);
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const seen = (state: RulesetEncounterState) =>
    rulesetCanSee(definition, state, who(state, "orc"), who(state, "hero"));

  // ── The torch: on the menu, for nothing, once a turn ──
  {
    const state = fight();
    const torch = menu(state).find((option) => option.id === "light:carried");
    assert.ok(
      torch,
      menu(state)
        .map((option) => option.id)
        .join(),
    );
    assert.equal(torch.kind, "switch");
    assert.equal(torch.label, "Torch");
    assert.equal(torch.on, true, "lit as the fight begins");
    assert.equal(seen(state), true, "the orc sees the torch-bearer");
    const out = flip(state);
    const event = out.events.find((one) => one.type === "switch");
    assert.ok(event?.type === "switch" && event.on === false && event.label === "Torch", JSON.stringify(out.events));
    assert.equal(who(out.state, "hero").doused, true);
    assert.equal(rulesetLightOf(definition, who(out.state, "hero"), out.state), null, "put out");
    assert.equal(seen(out.state), false, "unseen in the dark");
    assert.equal(who(out.state, "hero").budgets.action, 1, "it cost nothing");
    assert.ok(!menu(out.state).some((option) => option.id === "light:carried"), "once a turn");
    // Its next turn: lit again.
    who(out.state, "hero").flags = {};
    assert.equal(menu(out.state).find((option) => option.id === "light:carried")?.on, false);
    const lit = flip(out.state);
    assert.equal(who(lit.state, "hero").doused, undefined);
    assert.equal(seen(lit.state), true);
    // Hiding in the dark, then lighting it: found.
    const hidden = flip(fight()).state;
    who(hidden, "hero").flags = {};
    who(hidden, "hero").hiding = { total: 20, from: ["orc"] };
    const shown = flip(hidden);
    assert.equal(who(shown.state, "hero").hiding, undefined, JSON.stringify(shown.events));
    assert.ok(
      shown.events.some((one) => one.type === "revealed"),
      JSON.stringify(shown.events),
    );
  }

  // ── Nobody who sees in the dark carries one ──
  {
    const state = fight();
    who(state, "hero").tracked.push({ condition: "darksighted", rounds: null } as never);
    assert.ok(!menu(state).some((option) => option.id === "light:carried"));
    const refused = applyRulesetCombatChoice(
      definition,
      state,
      { actorId: "hero", optionId: "light:carried", targetIds: [] },
      () => 10,
    );
    assert.ok(refused.events.some((one) => one.type === "refused"));
  }

  // ── Not lit in daylight: the barn at noon stays shade ──
  {
    const noon = fight();
    noon.board!.light = "sunlight";
    noon.board!.grid.ground = { "2,5": { light: "dim" }, "3,5": { light: "dim" }, "14,5": { light: "dark" } };
    assert.equal(rulesetLightOf(definition, who(noon, "hero"), noon), null, "in the barn's shade at noon");
    assert.equal(rulesetLightAt(definition, noon, { x: 3, y: 5 }), "dim", "the barn stays shade");
    who(noon, "hero").x = 6;
    assert.equal(rulesetLightOf(definition, who(noon, "hero"), noon), null, "out in the sun");
    who(noon, "hero").x = 14;
    who(noon, "orc").x = 20;
    assert.equal(rulesetLightOf(definition, who(noon, "hero"), noon)?.bright, 4, "a cellar dark at noon is lit");
    const day = fight();
    day.board!.light = "bright";
    assert.equal(rulesetLightOf(definition, who(day, "hero"), day), null, "a bright day");
    day.board!.grid.ground = { "2,5": { light: "dim" } };
    assert.equal(rulesetLightOf(definition, who(day, "hero"), day)?.bright, 4, "dusk on a bright board is lit");
  }

  // ── On a budget ──
  {
    const onBonus = parsed(
      fiveE((doc) => {
        doc.combat.sight.darkness.carried.budget = "bonus";
      }),
    );
    const state = fight(onBonus);
    assert.equal(menu(state, onBonus).find((option) => option.id === "light:carried")?.budget, "bonus");
    const out = flip(state, "light:carried", onBonus);
    assert.equal(who(out.state, "hero").budgets.bonus, 0, "the bonus action is spent");
    assert.equal(who(out.state, "hero").flags.lightSwitched, undefined);
  }

  // ── A lantern sheds light only while it is on ──
  {
    const state = fight(definition, [lantern]);
    who(state, "hero").doused = true;
    assert.equal(rulesetLightOf(definition, who(state, "hero"), state), null, "off as the fight begins");
    const on = flip(state, "switch:0");
    assert.deepEqual(rulesetLightOf(definition, who(on.state, "hero"), on.state), { bright: 6, dim: 6 });
    // Without a switch it is always lit.
    const plain = fight(definition, [{ ...lantern, item: { category: "gear", worn: lantern.item.worn } }]);
    who(plain, "hero").doused = true;
    assert.deepEqual(rulesetLightOf(definition, who(plain, "hero"), plain), { bright: 6, dim: 6 });
  }

  // ── An item whose only effect is its light parses (a torch, a lamp) ──
  parsed(
    fiveE((doc) => {
      doc.items = { categories: [{ id: "gear", label: "Gear" }], slots: [{ id: "hands", label: "Hands", count: 2 }] };
      doc.catalogs.push({
        id: "gear",
        label: "Gear",
        holds: "items",
        entries: [
          { id: "lamp", label: "Lamp", item: { category: "gear", carried: { light: { bright: 15, dim: 30 } } } },
          {
            id: "hooded-lantern",
            label: "Hooded lantern",
            item: {
              category: "gear",
              toggle: { label: "Open", budget: "bonus" },
              worn: { light: { bright: 30, dim: 30 } },
            },
          },
        ],
      });
    }),
  );

  // ── Refusals ──
  refusedDoc(
    fiveE((doc) => {
      doc.combat.sight.darkness.carried.budget = "object";
    }),
    /Unknown budget "object"/,
  );

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
      "A ruleset whose carried light has a name or a price to put out and light again requires schemaVersion 2 and capabilityApi 1.295 or newer";
    const named = JSON.parse(fiveEText) as Record<string, any>;
    named.combat.sight = { darkness: { seeIn: ["darkvision"], carried: { bright: 20, dim: 20, label: "Torch" } } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(294) as never, named), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(295) as never, named), gate);
    const priced = JSON.parse(fiveEText) as Record<string, any>;
    priced.combat.sight = { darkness: { seeIn: ["darkvision"], carried: { bright: 20, dim: 20, budget: "bonus" } } };
    assert.equal(getCapabilityPackageInstallIssue(manifest(294) as never, priced), gate);
    const plain = JSON.parse(fiveEText) as Record<string, any>;
    plain.combat.sight = { darkness: { seeIn: ["darkvision"], carried: { bright: 20, dim: 20 } } };
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(294) as never, plain), gate);
  }

  console.log(
    "Light switch: a torch put out and lit again for nothing once a turn or on a budget, unseen in the dark and found when lit, none for whoever sees in the dark, a lantern lit only while on; refusals; gated at 1.295.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
