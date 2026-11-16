/**
 * What its own user holds (Capability API 1.307).
 *
 *   - A creature's own action may be held by its concentration: an imp's or a quasit's Invisibility
 *     ends when that concentration does.
 *   - `endsWhenHolder.uses` ends a condition when its holder uses one of the named actions or
 *     entries: a quasit's invisibility ends on its Scare.
 *   - `appliesSelf` puts conditions on a use's own user, whatever its targets do, held by its
 *     concentration: Sunbeam's mote, which gives the later beams as an action.
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
  rowsFromCatalogEntry,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetCreatureBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-self-held-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 302);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const spell = (id: string, level: number, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level, prepared: true } }],
      mechanics: { ...(level > 0 ? { cost: [{ pool: `slots_${level}`, amount: 1 }] } : {}), ...mechanics },
    }) as unknown as RulesetCatalogEntry;
  const hit = { kind: "attack", range: 60, autoHit: true, amount: { flat: 1 }, damageType: "radiant" };
  // Sunbeam: a beam now, and a mote in its caster's hand that gives the later ones.
  const sunbeam = spell("sunbeam", 1, {
    ...hit,
    concentration: true,
    appliesSelf: [{ condition: "mote", duration: { rounds: 10 } }],
  });
  const beam = spell("beam", 0, hit);
  // The same mote with no concentration holding it.
  const glow = spell("glow", 1, { ...hit, appliesSelf: [{ condition: "mote", duration: { rounds: 10 } }] });
  // A ward held by concentration that ends when its holder casts Bolt.
  const ward = spell("ward", 1, {
    kind: "buff",
    targets: "self",
    concentration: true,
    applies: [{ condition: "warded", duration: { rounds: 10 }, endsWhenHolder: { uses: ["spells/bolt"] } }],
  });
  const bolt = spell("bolt", 0, hit);
  const spells = [sunbeam, beam, glow, ward, bolt];
  const invisibility = {
    id: "invisibility",
    name: "Invisibility",
    budget: "action",
    self: true,
    concentration: true,
    applies: [{ condition: "invisible", duration: { rounds: 100 }, endsWhenHolder: { uses: ["scare"] } }],
  };
  const quasit = {
    id: "quasit",
    label: "Quasit",
    creature: {
      tier: "cr_5",
      health: 200,
      defense: 5,
      initiativeModifier: 0,
      actions: [
        invisibility,
        { id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { flat: 1 } },
        {
          id: "scare",
          name: "Scare",
          budget: "action",
          autoHit: true,
          applies: [{ condition: "frightened", duration: { rounds: 1 } }],
        },
      ],
    },
  };
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.sheet.live.conditions.push({ id: "mote", label: "Mote" }, { id: "warded", label: "Warded" });
    doc.combat.conditions.push(
      { condition: "mote", effects: [], actions: ["spells/beam"] },
      { condition: "warded", effects: [] },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: structuredClone(spells) });
    doc.catalogs.push({ id: "fiends", label: "Fiends", holds: "creatures", entries: [structuredClone(quasit)] });
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
  const fields: Record<string, number> = { level: 11, ac: 12, speed: 30, hp_max: 60 };
  for (let level = 1; level <= 5; level++) fields[`slots_max_${level}`] = 4;
  const caster = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 },
      fields: { ...fields, spellcasting_ability: "int" },
      lists: {
        spells: [sunbeam, glow, ward, bolt].flatMap((entry) =>
          rowsFromCatalogEntry("spells", entry).map((row) => row.row),
        ),
      },
    });
  const block = rulesetCreatureBlock(definition, definition.catalogs!.find((one) => one.id === "fiends")!.entries![0]);
  assert.ok(block, "the quasit becomes a block");
  assert.equal(
    block.actions.find((one) => one.id === "invisibility")?.concentration,
    true,
    "its Invisibility keeps its concentration",
  );
  const fight = (): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 1,
      combatants: [
        { id: "mage", name: "Mage", side: "party", build: caster(), live: {}, catalogs: { spells } },
        { id: "q", name: "Quasit", side: "enemy", block },
      ],
      board: {
        grid: { width: 10, height: 5, tiles: Array.from({ length: 5 }, () => Array(10).fill("plains")) } as never,
        placements: { mage: { x: 2, y: 2 }, q: { x: 3, y: 2 } },
      },
    });
    state.order = ["mage", "q"];
    state.turn = 0;
    return state;
  };
  const optionsOf = (state: RulesetEncounterState, actorId: string) => {
    state.turn = state.order.indexOf(actorId);
    const actor = rulesetCombatant(state, actorId)!;
    for (const key of Object.keys(actor.budgets)) actor.budgets[key] = 9;
    return rulesetCombatOptions(definition, state, actorId);
  };
  const use = (
    state: RulesetEncounterState,
    actorId: string,
    label: string,
    targetIds: string[],
    payWith?: string,
  ): RulesetCombatStep => {
    const option = optionsOf(state, actorId).find((one) => one.label === label);
    assert.ok(option, `no ${label}`);
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds, ...(payWith ? { payWith } : {}) },
      () => 1,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step;
  };
  const holds = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatant(state, id)!.tracked.find((one) => one.condition === condition);
  const offered = (state: RulesetEncounterState, label: string) =>
    optionsOf(state, "mage").some((one) => one.label === label);

  // ── Sunbeam's mote ──
  {
    const state = fight();
    assert.equal(offered(state, "Beam"), false, "no mote, no beam");
    const cast = use(state, "mage", "Sunbeam", ["q"]);
    const mote = holds(cast.state, "mage", "mote");
    assert.ok(mote, "the mote is on its caster");
    assert.equal(mote.concentration, true, "held by the spell's concentration");
    assert.equal(mote.source, "mage");
    assert.equal(mote.level, 1);
    assert.equal(holds(cast.state, "q", "mote"), undefined, "and not on its target");
    assert.ok(
      cast.events.some((one) => one.type === "damage" && one.targetId === "q"),
      "the first beam lands as well",
    );
    assert.ok(offered(cast.state, "Beam"), "the later beams are an action");
    const again = use(cast.state, "mage", "Beam", ["q"]);
    assert.ok(again.events.some((one) => one.type === "damage" && one.targetId === "q"));
    // Another concentration takes the mote with it.
    const warded = use(again.state, "mage", "Ward", ["mage"]);
    assert.equal(holds(warded.state, "mage", "mote"), undefined, "the mote goes with the concentration");
    assert.equal(offered(warded.state, "Beam"), false);
    // Cast higher, it carries the level.
    const high = use(fight(), "mage", "Sunbeam", ["q"], "slots_3");
    assert.equal(holds(high.state, "mage", "mote")!.level, 3);
    assert.equal(holds(high.state, "mage", "mote")!.steps, 2);
  }

  // ── With no concentration it stays ──
  {
    const lit = use(fight(), "mage", "Glow", ["q"]);
    assert.notEqual(holds(lit.state, "mage", "mote")?.concentration, true);
    const warded = use(lit.state, "mage", "Ward", ["mage"]);
    assert.ok(holds(warded.state, "mage", "mote"), "nothing held it, so nothing takes it");
  }

  // ── Ends on using a named entry ──
  {
    const warded = use(fight(), "mage", "Ward", ["mage"]);
    assert.ok(holds(warded.state, "mage", "warded"));
    const beamless = use(warded.state, "mage", "Glow", ["q"]);
    assert.ok(holds(beamless.state, "mage", "warded"), "another entry leaves it");
    const bolted = use(beamless.state, "mage", "Bolt", ["q"]);
    assert.equal(holds(bolted.state, "mage", "warded"), undefined, "casting Bolt ends it");
  }

  // ── A quasit's Invisibility ──
  {
    const hidden = use(fight(), "q", "Invisibility", []);
    const invisible = holds(hidden.state, "q", "invisible");
    assert.ok(invisible, "the quasit is invisible");
    assert.equal(invisible.concentration, true, "held by its concentration");
    assert.deepEqual(invisible.endsWhenHolder, { uses: ["scare"] });
    assert.equal(rulesetCombatant(hidden.state, "q")!.concentrating?.actionId, "invisibility");
    assert.ok(hidden.events.some((one) => one.type === "concentration" && one.state === "started"));
    // A claw is not its Scare.
    const clawed = use(hidden.state, "q", "Claw", ["mage"]);
    assert.ok(holds(clawed.state, "q", "invisible"), "a claw leaves it");
    const scared = use(clawed.state, "q", "Scare", ["mage"]);
    assert.equal(holds(scared.state, "q", "invisible"), undefined, "its Scare ends it");
    // Hurt, it loses its concentration, and the invisibility with it.
    const again = use(fight(), "q", "Invisibility", []);
    const hurt = use(again.state, "mage", "Bolt", ["q"]);
    assert.ok(hurt.events.some((one) => one.type === "concentration" && one.state === "ended"));
    assert.equal(holds(hurt.state, "q", "invisible"), undefined, "the concentration took it");
  }

  // ── Refusals ──
  const withSpell = (entry: RulesetCatalogEntry) =>
    fiveE((doc) => {
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "spells").entries.push(entry);
    });
  refusedDoc(
    withSpell(spell("odd", 1, { ...hit, appliesSelf: [{ condition: "nope", duration: { rounds: 1 } }] })),
    /Unknown condition "nope"/,
  );
  refusedDoc(withSpell(spell("odd", 1, { ...hit, appliesSelf: [] })), /appliesSelf/);
  refusedDoc(
    withSpell(
      spell("odd", 1, {
        ...hit,
        applies: [{ condition: "warded", duration: { rounds: 1 }, endsWhenHolder: { uses: [] } }],
      }),
    ),
    /uses/,
  );
  refusedDoc(
    fiveE((doc) => {
      doc.catalogs.find(
        (catalog: { id: string }) => catalog.id === "fiends",
      ).entries[0].creature.actions[0].concentration = false;
    }),
    /concentration/,
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
      "A ruleset with creature actions held by concentration, conditions ended by using a named action, or uses that put conditions on their own user requires schemaVersion 2 and capabilityApi 1.307 or newer";
    const docWith = (entries: unknown[], holdsCreatures = false) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push(
        holdsCreatures
          ? { id: "fiends", label: "Fiends", holds: "creatures", entries }
          : { id: "spells", label: "Spells", feeds: ["spells"], entries },
      );
      return doc;
    };
    const plainQuasit = structuredClone(quasit);
    plainQuasit.creature.actions[0] = {
      ...invisibility,
      applies: [{ condition: "invisible", duration: { rounds: 100 } }],
    };
    const unconcentrated = structuredClone(plainQuasit) as Record<string, any>;
    delete unconcentrated.creature.actions[0].concentration;
    for (const doc of [docWith([sunbeam]), docWith([ward]), docWith([plainQuasit], true)]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(306) as never, doc), gate);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(307) as never, doc), gate);
    }
    for (const doc of [JSON.parse(fiveEText), docWith([bolt, beam]), docWith([unconcentrated], true)]) {
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(306) as never, doc), gate, "nothing new, no gate");
    }
  }

  console.log(
    "Self held: Sunbeam's mote on its caster held by its concentration, a quasit's Invisibility held by its own and ended by its Scare; refusals; gated at 1.307.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
