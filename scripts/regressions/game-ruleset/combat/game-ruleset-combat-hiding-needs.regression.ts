/**
 * Hide in Plain Sight's needs, Feral Senses and surprise from a hidden start (Capability API 1.309).
 *
 *   - `hiding.stillWhile`: `still` counts only while its holder holds a condition (camouflage made
 *     beforehand) and, with `wall`, stands beside something that blocks sight.
 *   - `hiding.unseenStrikes`: no disadvantage attacking whom its holder cannot see (Feral Senses).
 *   - A creature's `hiding.surprises`: whoever it starts hidden from begins the fight surprised (a
 *     gelatinous cube's Transparent).
 *   - Import refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULESET_MOVE_OPTION,
  applyRulesetCombatChoice,
  createRulesetEncounter,
  parseRulesetDefinition,
  rowsFromCatalogEntry,
  rulesetAttackMode,
  rulesetCanSee,
  rulesetCombatOptions,
  rulesetCombatant,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetCombatStep,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hiding-needs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 304);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const trait = (id: string, hiding: Record<string, unknown>) =>
    ({
      id: id.toLowerCase().replace(/ /g, "-"),
      label: id,
      rows: [{ list: "features", values: { name: id, text: id } }],
      mechanics: { kind: "utility", hiding },
    }) as unknown as RulesetCatalogEntry;
  const plainSight = trait("Hide in Plain Sight", { still: 10, stillWhile: { holds: "camouflaged", wall: true } });
  const wallOnly = trait("Against the Wall", { still: 10, stillWhile: { wall: true } });
  const feral = trait("Feral Senses", { unseenStrikes: true });
  const traits = [plainSight, wallOnly, feral];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.sight = { unseenAttacks: true };
    doc.combat.checks.push(
      { id: "sneak", label: "Stealth", value: { skillMod: "stealth" } },
      { id: "look", label: "Perception", value: { skillMod: "perception" } },
    );
    doc.combat.hiding = { stealth: "sneak", perception: "look", passiveMode: 5 };
    doc.combat.standard.push("search");
    doc.combat.sizes = {
      order: [
        { id: "small", label: "Small" },
        { id: "medium", label: "Medium" },
        { id: "large", label: "Large" },
      ],
      default: "medium",
    };
    doc.sheet.live.conditions.push({ id: "keen", label: "Keen" }, { id: "camouflaged", label: "Camouflaged" });
    doc.combat.conditions.push({ condition: "camouflaged", effects: [] });
    // Unseen as the fight's sight reads it, and nothing else.
    doc.sheet.live.conditions.push({ id: "veiled", label: "Veiled" });
    doc.combat.conditions.push({ condition: "veiled", effects: [], unseen: {} });
    doc.combat.conditions.push({
      condition: "keen",
      modifiers: [{ to: "checks", skills: ["perception"], mode: "advantage" }],
    });
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(...structuredClone(traits));
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
  const feats = definition.catalogs!.find((catalog) => catalog.id === "feats")!.entries!;
  // Dexterity 16, Stealth +3; Perception +0, a passive of 10.
  const hero = (...held: RulesetCatalogEntry[]) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 30 },
      lists: {
        attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }],
        features: held.flatMap((entry) => rowsFromCatalogEntry("feats", entry).map((row) => row.row)),
      },
    });
  // Perception +3: a passive of 13.
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 40,
      defense: 10,
      initiativeModifier: 0,
      speed: 30,
      checks: { look: 3, sneak: 3 },
      actions: [{ name: "Claw", budget: "action", toHit: 4, reach: 5, damage: { count: 1, sides: 6, flat: 0 } }],
      ...extra,
    }) as RulesetStatBlock;
  type Who = { id: string; side: "party" | "enemy"; at: { x: number; y: number }; held?: RulesetCatalogEntry[] };
  // A wall down x = 8 from y = 1 to y = 10, unless the board is open.
  const fight = (who: Array<Who & { block?: RulesetStatBlock }>, open = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: who.map((one) =>
        one.block
          ? { id: one.id, name: one.id, side: one.side, block: one.block }
          : {
              id: one.id,
              name: one.id,
              side: one.side,
              build: hero(...(one.held ?? [])),
              live: {},
              catalogs: { feats },
            },
      ),
      board: {
        grid: {
          width: 20,
          height: 15,
          tiles: Array.from({ length: 15 }, (_, y) =>
            Array.from({ length: 20 }, (_, x) => (!open && x === 8 && y >= 1 && y <= 10 ? "wall" : "plains")),
          ),
        } as never,
        placements: Object.fromEntries(who.map((one) => [one.id, one.at])),
      },
    });
    state.order = who.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const refused = (step: RulesetCombatStep) => step.events.find((one) => one.type === "refused");
  const dice =
    (...faces: number[]) =>
    () =>
      faces.shift() ?? 10;
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice, roll = dice()) => {
    state.turn = state.order.indexOf(choice.actorId);
    const step = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.equal(refused(step), undefined, JSON.stringify(step.events));
    return step;
  };
  const hide = (state: RulesetEncounterState, id: string, roll = dice()) => {
    const step = act(state, { actorId: id, optionId: "standard:hide", targetIds: [] }, roll);
    const event = step.events.find((one) => one.type === "standard" && one.action === "hide");
    assert.ok(event?.type === "standard" && event.check, JSON.stringify(step.events));
    return { step, check: event.check!, from: event.from ?? [] };
  };
  const walk = (state: RulesetEncounterState, id: string, to: { x: number; y: number }) =>
    act(state, { actorId: id, optionId: RULESET_MOVE_OPTION, targetIds: [], to });

  // ── Hide in Plain Sight: camouflaged, and against the wall ──
  {
    const scene = (x: number, camouflaged: boolean, held = [plainSight]) => {
      const state = fight([
        { id: "ranger", side: "party", at: { x, y: 5 }, held },
        { id: "guard", side: "enemy", at: { x: 12, y: 5 }, block: block() },
      ]);
      if (camouflaged) who(state, "ranger").tracked.push({ condition: "camouflaged", rounds: null } as never);
      return state;
    };
    // 1 + 3 + 10 = 14 meets the guard's 13; 4 without the bonus does not.
    const pressed = hide(scene(7, true), "ranger", dice(1));
    assert.equal(pressed.check.total, 14, "camouflaged, against the wall");
    assert.deepEqual(pressed.from, ["guard"]);
    assert.equal(who(pressed.step.state, "ranger").hiding?.still, 10);
    assert.equal(hide(scene(7, false), "ranger", dice(1)).check.total, 4, "no camouflage");
    assert.equal(hide(scene(6, true), "ranger", dice(1)).check.total, 4, "nothing to press against");
    // Only what it says it needs.
    assert.equal(hide(scene(7, false, [wallOnly]), "ranger", dice(1)).check.total, 14, "a wall alone");
    assert.equal(hide(scene(6, false, [wallOnly]), "ranger", dice(1)).check.total, 4);
    // Without the bonus there is none to lose.
    const plain = hide(scene(6, true), "ranger", dice(12)).step.state;
    assert.equal(who(plain, "ranger").hiding?.still, undefined);
  }

  // ── Feral Senses: no disadvantage at whom it cannot see ──
  {
    const scene = (held: RulesetCatalogEntry[]) =>
      fight([
        { id: "ranger", side: "party", at: { x: 7, y: 5 }, held },
        { id: "ghost", side: "enemy", at: { x: 7, y: 6 }, block: block() },
      ]);
    const modeAt = (state: RulesetEncounterState) => {
      who(state, "ghost").tracked.push({ condition: "veiled", rounds: null } as never);
      const dagger = rulesetCombatOptions(definition, state, "ranger").find((one) => one.label === "Dagger")!;
      return rulesetAttackMode(definition, definition.combat!, who(state, "ranger"), who(state, "ghost"), {
        state,
        optionId: dagger.id,
      });
    };
    assert.equal(modeAt(scene([])), "disadvantage", "unseen, at disadvantage");
    assert.equal(modeAt(scene([feral])), "normal", "with Feral Senses, not");
  }

  // ── Transparent: those unaware of it are surprised ──
  {
    const scene = (hiding: Record<string, unknown>) =>
      fight(
        [
          { id: "rogue", side: "party", at: { x: 6, y: 5 } },
          { id: "sharp", side: "party", at: { x: 6, y: 7 } },
          { id: "cube", side: "enemy", at: { x: 12, y: 5 }, block: block({ hiding } as never) },
        ],
        true,
      );
    const caught = scene({ starts: 15, surprises: true });
    assert.equal(who(caught, "rogue").surprised, true, "unaware, surprised");
    assert.equal(who(caught, "sharp").surprised, true);
    assert.notEqual(who(caught, "cube").surprised, true);
    const quiet = scene({ starts: 15 });
    assert.notEqual(who(quiet, "rogue").surprised, true, "only when it says so");
    // One that sees it is not surprised.
    const seen = scene({ starts: 1, surprises: true });
    assert.notEqual(who(seen, "rogue").surprised, true, "seen, not surprised");
  }

  // ── Refusals ──
  {
    const withTrait = (hiding: unknown) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "feats")
          .entries.push(trait("Odd", hiding as Record<string, unknown>));
      });
    refusedDoc(withTrait({ still: 10, stillWhile: { holds: "sleepy" } }), /Unknown condition "sleepy"/);
    refusedDoc(withTrait({ stillWhile: { wall: true } }), /"stillWhile" goes with "still"/);
    refusedDoc(withTrait({ still: 10, stillWhile: {} }), /stillWhile/);
    refusedDoc(withTrait({ surprises: true }), /surprises/);
    const cube = (hiding: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push({
            id: "cube",
            label: "Cube",
            creature: {
              health: 30,
              defense: 6,
              initiativeModifier: -4,
              tier: "cr_1_2",
              hiding,
              actions: [{ id: "touch", name: "Touch", budget: "action", toHit: 4, damage: { dice: "1d6" }, reach: 5 }],
            },
          });
      });
    parsed(cube({ starts: 15, surprises: true }));
    refusedDoc(cube({ surprises: true }), /"surprises" goes with "starts"/);
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
      "A ruleset with hiding that needs camouflage or a wall, attacks unhindered by not seeing, surprise from a hidden start, or a weapon bound out of the fight requires schemaVersion 2 and capabilityApi 1.309 or newer";
    const only = (entry: RulesetCatalogEntry) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(entry);
      return doc;
    };
    for (const entry of [plainSight, wallOnly, feral]) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(308) as never, only(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(309) as never, only(entry)), gate, entry.id);
    }
    const creature = JSON.parse(fiveEText) as Record<string, any>;
    creature.catalogs
      .find((catalog: { id: string }) => catalog.id === "creatures")
      .entries.push({ id: "cube", label: "Cube", creature: { hiding: { starts: 15, surprises: true } } });
    assert.equal(getCapabilityPackageInstallIssue(manifest(308) as never, creature), gate);
    const old = only(trait("Old", { still: 10 }));
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(308) as never, old), gate, "1.292's own");
  }

  console.log(
    "Hiding needs: Hide in Plain Sight only camouflaged and against a wall, Feral Senses' attacks unhindered, a cube surprising those unaware of it; refusals; gated at 1.309.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
