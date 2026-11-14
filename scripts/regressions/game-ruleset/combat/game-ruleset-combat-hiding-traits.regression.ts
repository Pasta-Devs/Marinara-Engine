/**
 * Somebody's own ways of hiding and of finding the hidden (Capability API 1.292).
 *
 *   - `hiding.behindLarger`: hidden behind somebody at least one size larger (Naturally Stealthy).
 *   - `hiding.still`: added to the Stealth total until its holder moves or acts (Hide in Plain Sight).
 *   - `hiding.slow`: Hide rolled with advantage after moving no more than half its speed (Supreme
 *     Sneak).
 *   - `hiding.aware`: nobody that near hides from its holder, unless it has a condition that takes
 *     that away (Blindsense, lost while deafened).
 *   - A creature's `hiding.starts`: hidden in plain sight from the start, from whoever's passive
 *     Perception does not beat it, until it moves (a gelatinous cube's Transparent).
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

const dataDir = mkdtempSync(join(tmpdir(), "marinara-hiding-traits-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 287);
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
  const stealthy = trait("Naturally Stealthy", { behindLarger: true });
  const plainSight = trait("Hide in Plain Sight", { still: 10 });
  const sneak = trait("Supreme Sneak", { slow: "advantage" });
  const blindsense = trait("Blindsense", { aware: { within: 10, lostWith: ["deafened"] } });
  const traits = [stealthy, plainSight, sneak, blindsense];
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
    doc.sheet.live.conditions.push({ id: "keen", label: "Keen" });
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
  type Who = {
    id: string;
    side: "party" | "enemy";
    at: { x: number; y: number };
    held?: RulesetCatalogEntry[];
    conditions?: string[];
  };
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
              live: one.conditions ? { conditions: one.conditions } : {},
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

  // ── Naturally Stealthy: behind somebody larger ──
  {
    const scene = (held: RulesetCatalogEntry[], screen: "small" | "medium") => {
      const state = fight(
        [
          { id: "pip", side: "party", at: { x: 6, y: 5 }, held },
          { id: "ogre", side: "party", at: { x: 9, y: 5 } },
          { id: "guard", side: "enemy", at: { x: 12, y: 5 }, block: block() },
        ],
        true,
      );
      who(state, "pip").size = "small";
      who(state, "ogre").size = screen;
      return state;
    };
    assert.deepEqual(hide(scene([stealthy], "medium"), "pip").from, ["guard"], "behind somebody larger");
    assert.deepEqual(hide(scene([], "medium"), "pip").from, [], "only with the trait");
    assert.deepEqual(hide(scene([stealthy], "small"), "pip").from, [], "not behind somebody its own size");
    // Somebody off the line screens nothing.
    const aside = scene([stealthy], "medium");
    who(aside, "ogre").y = 9;
    assert.deepEqual(hide(aside, "pip").from, []);
  }

  // ── Hide in Plain Sight: +10 while it stays put ──
  {
    const scene = () =>
      fight([
        { id: "ranger", side: "party", at: { x: 6, y: 5 }, held: [plainSight] },
        { id: "guard", side: "enemy", at: { x: 12, y: 5 }, block: block() },
      ]);
    // 1 + 3 + 10 = 14 meets the guard's 13.
    const hid = hide(scene(), "ranger", dice(1));
    assert.equal(hid.check.total, 14);
    assert.deepEqual(hid.from, ["guard"]);
    assert.equal(who(hid.step.state, "ranger").hiding?.still, 10);
    // A step, still behind the wall: 4 is found.
    const moved = walk(hid.step.state, "ranger", { x: 6, y: 6 });
    assert.equal(who(moved.state, "ranger").hiding, undefined, JSON.stringify(moved.events));
    assert.ok(moved.events.some((one) => one.type === "revealed" && one.reason === "seen"));
    // Dodging is acting too.
    const again = hide(scene(), "ranger", dice(1)).step.state;
    who(again, "ranger").budgets = { ...who(scene(), "ranger").budgets };
    const dodged = act(again, { actorId: "ranger", optionId: "standard:dodge", targetIds: [] });
    assert.equal(who(dodged.state, "ranger").hiding, undefined, "acted: 4 is found");
    // So is using something that gives nothing away: 2 + 3 + 10 = 15, and 5 without the bonus.
    const mending = hide(scene(), "ranger", dice(2)).step.state;
    assert.equal(who(mending, "ranger").hiding?.total, 15);
    who(mending, "ranger").budgets = { ...who(scene(), "ranger").budgets };
    who(mending, "ranger").actions.push({
      id: "mend",
      label: "Mend",
      kind: "block",
      budget: "action",
      targets: { side: "self", count: 0 },
      heal: { count: 0, sides: 0, flat: 1 },
    } as never);
    const mended = act(mending, { actorId: "ranger", optionId: "mend", targetIds: [] });
    assert.equal(who(mended.state, "ranger").hiding, undefined, JSON.stringify(mended.events));
    // The trait itself is nothing to take.
    const menuScene = scene();
    const menu = rulesetCombatOptions(definition, menuScene, "ranger").map((option) => option.id);
    const permission = who(menuScene, "ranger").actions.find((action) => action.hiding)!;
    assert.ok(menu.includes("standard:hide"), menu.join());
    assert.ok(!menu.includes(permission.id), menu.join());
    // A bigger roll survives losing the bonus.
    const steady = walk(hide(scene(), "ranger", dice(12)).step.state, "ranger", { x: 6, y: 6 });
    assert.equal(who(steady.state, "ranger").hiding?.total, 15);
    assert.equal(who(steady.state, "ranger").hiding?.still, undefined);
  }

  // ── Supreme Sneak: advantage after no more than half its speed ──
  {
    const scene = () =>
      fight([
        { id: "thief", side: "party", at: { x: 6, y: 1 }, held: [sneak] },
        { id: "guard", side: "enemy", at: { x: 12, y: 5 }, block: block() },
      ]);
    assert.equal(hide(scene(), "thief", dice(15, 4)).check.mode, "advantage", "unmoved");
    const half = walk(scene(), "thief", { x: 6, y: 4 }).state;
    assert.equal(hide(half, "thief", dice(15, 4)).check.mode, "advantage", "3 of 6 cells");
    const far = walk(scene(), "thief", { x: 6, y: 5 }).state;
    assert.equal(hide(far, "thief", dice(15, 4)).check.mode, undefined, "4 of 6 cells");
    const plain = fight([
      { id: "thief", side: "party", at: { x: 6, y: 1 } },
      { id: "guard", side: "enemy", at: { x: 12, y: 5 }, block: block() },
    ]);
    assert.equal(hide(plain, "thief", dice(15, 4)).check.mode, undefined, "only with the trait");
  }

  // ── Blindsense: nobody within 10 feet hides from it ──
  {
    const scene = () =>
      fight([
        { id: "rogue", side: "party", at: { x: 7, y: 5 }, held: [blindsense] },
        { id: "lurker", side: "enemy", at: { x: 9, y: 5 }, block: block() },
      ]);
    // Behind the wall, 13 beats a passive of 10: hidden, but not from somebody this near.
    assert.deepEqual(hide(scene(), "lurker").from, [], "within 10 feet");
    const deaf = scene();
    who(deaf, "rogue").tracked.push({ condition: "deafened", rounds: null } as never);
    assert.deepEqual(hide(deaf, "lurker").from, ["rogue"], "deafened, it hears nothing");
    // Hidden from afar, found by coming near.
    const far = scene();
    who(far, "rogue").x = 2;
    const hid = hide(far, "lurker").step.state;
    assert.deepEqual(who(hid, "lurker").hiding?.from, ["rogue"]);
    const near = walk(hid, "rogue", { x: 7, y: 6 });
    assert.equal(who(near.state, "lurker").hiding, undefined, JSON.stringify(near.events));
  }

  // ── A creature's own: a bat's Blindsense, 10 feet ──
  {
    const scene = (x: number) =>
      fight([
        { id: "pip", side: "party", at: { x, y: 5 } },
        { id: "bat", side: "enemy", at: { x: 9, y: 5 }, block: block({ hiding: { aware: { within: 10 } } }) },
      ]);
    // 10 + 3 meets the bat's 13 behind the wall, three cells off; two cells off it is aware.
    assert.deepEqual(hide(scene(6), "pip").from, ["bat"], "15 feet off");
    assert.deepEqual(hide(scene(7), "pip").from, [], "10 feet off");
  }

  // ── Transparent: hidden in plain sight from the start, until it moves ──
  {
    const scene = () =>
      fight(
        [
          { id: "rogue", side: "party", at: { x: 6, y: 5 } },
          { id: "sharp", side: "party", at: { x: 6, y: 7 } },
          { id: "cube", side: "enemy", at: { x: 12, y: 5 }, block: block({ hiding: { starts: 15 } }) },
        ],
        true,
      );
    const state = scene();
    assert.deepEqual(who(state, "cube").hiding, { total: 15, from: ["rogue", "sharp"], plain: true });
    assert.equal(rulesetCanSee(definition, state, who(state, "rogue"), who(state, "cube")), false, "out in the open");
    // Keen eyes: advantage on Perception makes a passive of 15, which beats a 14.
    const keen = fight(
      [
        { id: "rogue", side: "party", at: { x: 6, y: 5 }, conditions: ["keen"] },
        { id: "sharp", side: "party", at: { x: 6, y: 7 } },
        { id: "cube", side: "enemy", at: { x: 12, y: 5 }, block: block({ hiding: { starts: 14 } }) },
      ],
      true,
    );
    assert.deepEqual(who(keen, "cube").hiding?.from, ["sharp"], "seen by the keen-eyed rogue");
    // A step: seen.
    const moved = walk(state, "cube", { x: 12, y: 6 });
    assert.equal(who(moved.state, "cube").hiding, undefined);
    const event = moved.events.find((one) => one.type === "revealed");
    assert.ok(event?.type === "revealed" && event.reason === "moved", JSON.stringify(moved.events));
    // Hiding again hides it in plain sight again: 12 + 3 beats the rogue's 10, seen clearly or not.
    const again = hide(moved.state, "cube", dice(12));
    assert.deepEqual(again.from, ["rogue", "sharp"]);
    assert.equal(who(again.step.state, "cube").hiding?.plain, true);
    // Standing still while somebody walks past keeps it hidden.
    const passing = walk(scene(), "rogue", { x: 9, y: 5 });
    assert.deepEqual(who(passing.state, "cube").hiding?.from, ["rogue", "sharp"]);
  }

  // ── Refusals ──
  {
    const withTrait = (hiding: unknown, edit: (doc: Record<string, any>) => void = () => {}) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "feats")
          .entries.push(trait("Odd", hiding as Record<string, unknown>));
        edit(doc);
      });
    refusedDoc(withTrait({}), /hiding names at least one way of hiding/);
    refusedDoc(withTrait({ starts: 15 }), /starts/);
    refusedDoc(withTrait({ slow: "disadvantage" }), /slow/);
    refusedDoc(withTrait({ aware: { within: 10, lostWith: ["sleepy"] } }), /Unknown condition "sleepy"/);
    refusedDoc(
      withTrait({ behindLarger: true }, (doc) => {
        delete doc.combat.sizes;
      }),
      /Hiding behind somebody larger reads combat.sizes/,
    );
    refusedDoc(
      fiveE((doc) => {
        delete doc.combat.hiding;
        doc.combat.standard = doc.combat.standard.filter((one: string) => one !== "search");
      }),
      /A way of hiding is read where combat.hiding hides for real/,
    );
    // A creature's.
    const cube = {
      id: "cube",
      label: "Cube",
      creature: {
        health: 30,
        defense: 6,
        initiativeModifier: -4,
        tier: "cr_1_2",
        hiding: { starts: 15 },
        actions: [{ id: "touch", name: "Touch", budget: "action", toHit: 4, damage: { dice: "1d6" }, reach: 5 }],
      },
    };
    parsed(
      fiveE((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "creatures").entries.push(cube);
      }),
    );
    refusedDoc(
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "creatures")
          .entries.push({
            ...cube,
            creature: { ...cube.creature, hiding: { aware: { within: 10, lostWith: ["sleepy"] } } },
          });
      }),
      /Unknown condition "sleepy"/,
    );
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
      "A ruleset with somebody's own ways of hiding or of finding the hidden requires schemaVersion 2 and capabilityApi 1.292 or newer";
    const only = (entry: RulesetCatalogEntry) => {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(entry);
      return doc;
    };
    for (const entry of traits) {
      assert.equal(getCapabilityPackageInstallIssue(manifest(291) as never, only(entry)), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(292) as never, only(entry)), gate, entry.id);
    }
    // The fight's own hiding is not one.
    const own = JSON.parse(fiveEText) as Record<string, any>;
    own.combat.hiding = { stealth: "sneak", perception: "look" };
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(291) as never, own), gate);
    // A ruleset's own columns and scores are its data: a row's `passive`, `magical` or `search`, or a
    // stat block's `passive` check, asks for nothing newer.
    const columns = JSON.parse(fiveEText) as Record<string, any>;
    columns.catalogs
      .find((catalog: { id: string }) => catalog.id === "feats")
      .entries.push({
        id: "watchful",
        label: "Watchful",
        values: { passive: 3, magical: true, search: true, sunlight: 1 },
      });
    assert.doesNotMatch(
      getCapabilityPackageInstallIssue(manifest(286) as never, columns) ?? "",
      /capabilityApi 1\.(28[7-9]|29\d|3\d\d) or newer/,
    );
  }

  console.log(
    "Hiding traits: hidden behind somebody larger, +10 while standing still, advantage after half a move, nobody hidden within Blindsense, a Transparent cube hidden from the start until it moves; refusals; gated at 1.292.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
