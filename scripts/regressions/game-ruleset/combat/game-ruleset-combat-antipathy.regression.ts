/**
 * A creature type named as it is cast, and auras reaching only that kind (Capability API 1.270).
 *
 *   - `mechanics.kindChoice`: Antipathy names its kind as a mode, `kind-<id>`, and what it puts on
 *     remembers it; cast with no kind named, it is refused.
 *   - An aura's `chosenKind`: only creatures of that kind are asked its save.
 *   - An aura's `orSeen`: past its distance, whoever can see its holder is reached too.
 *   - `saveEnds.beyond`: the repeated save is rolled only farther off than it says (with `unseen`,
 *     out of sight as well).
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
  rulesetCatalogEntryIssues,
  rulesetCombatant,
  rulesetCombatConditions,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCombatChoice,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-antipathy-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 265);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const conditionOf = (doc: Record<string, any>, id: string) =>
    doc.combat.conditions.find((entry: { condition: string }) => entry.condition === id);
  const antipathy = () => ({
    id: "antipathy",
    label: "Antipathy",
    rows: [{ list: "spells", values: { name: "Antipathy", level: 1, prepared: true } }],
    mechanics: {
      kind: "buff",
      range: 60,
      kindChoice: true,
      applies: [{ condition: "repugnant", duration: { rounds: 100 } }],
    },
  });
  const document = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.combat.creatureTypes = {
      types: ["beast", "humanoid", "monstrosity"].map((id) => ({ id, label: id })),
      field: "race",
      default: "humanoid",
    };
    for (const [id, label] of [
      ["repugnant", "Antipathy"],
      ["repelled", "Repelled"],
    ]) {
      doc.sheet.live.conditions.push({ id, label });
    }
    doc.combat.conditions.push(
      {
        condition: "repugnant",
        effects: [],
        auras: [
          {
            distance: 60,
            side: "all",
            chosenKind: true,
            orSeen: true,
            save: {
              save: "wis_save",
              difficulty: 15,
              applies: [
                {
                  condition: "repelled",
                  duration: "until-save",
                  saveEnds: { save: "wis_save", at: "turn-end", unseen: true, beyond: 60 },
                },
              ],
            },
          },
        ],
      },
      { condition: "repelled", effects: [], behavior: { moves: "away" } },
    );
    doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: [antipathy()] });
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
  const definition = parsed(document());
  const spells = definition.catalogs!.find((entry) => entry.id === "spells")!.entries!;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    fields: { level: 5, ac: 14, speed: 30, hp_max: 40, race: "Human", spellcasting_ability: "wis" },
    lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
  });
  const block = (type: string): RulesetStatBlock => ({
    health: 40,
    defense: 10,
    initiativeModifier: 0,
    speed: 30,
    type,
    saves: { wis_save: -10 },
    actions: [{ id: "claw", name: "Claw", budget: "action", toHit: 4, damage: { count: 0, sides: 0, flat: 1 } }],
  });
  // Faces by die size; 10 for anything not queued.
  let faces: Record<number, number[]> = {};
  const roll = (sides: number) => faces[sides]?.shift() ?? 10;
  const width = 30;
  const fight = (foes: Record<string, { x: number; type: string }>, walls: number[] = []): RulesetEncounterState => {
    faces = {};
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: roll,
      combatants: [
        { id: "hero", name: "Hero", side: "party", build, live: {}, catalogs: { spells } },
        { id: "friend", name: "Friend", side: "party", build, live: {} },
        ...Object.entries(foes).map(([id, one]) => ({
          id,
          name: id[0]!.toUpperCase() + id.slice(1),
          side: "enemy" as const,
          block: block(one.type),
        })),
      ],
      board: {
        grid: {
          width,
          height: 1,
          tiles: [Array.from({ length: width }, (_, x) => (walls.includes(x) ? "wall" : "plains"))],
          elevation: [Array(width).fill(0)],
        } as never,
        placements: Object.fromEntries([
          ["hero", { x: 0, y: 0 }],
          ["friend", { x: 1, y: 0 }],
          ...Object.entries(foes).map(([id, one]) => [id, { x: one.x, y: 0 }]),
        ]),
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const has = (state: RulesetEncounterState, id: string, condition: string) =>
    rulesetCombatConditions(definition, who(state, id)).includes(condition);
  const of = <T extends RulesetCombatEvent["type"]>(events: RulesetCombatEvent[], type: T) =>
    events.filter((one): one is Extract<RulesetCombatEvent, { type: T }> => one.type === type);
  const act = (state: RulesetEncounterState, choice: RulesetCombatChoice) => {
    const done = applyRulesetCombatChoice(definition, state, choice, roll);
    assert.deepEqual(of(done.events, "refused"), [], JSON.stringify(done.events));
    return done;
  };
  const endTurn = (state: RulesetEncounterState, id: string) =>
    act(state, { actorId: id, optionId: "end-turn", targetIds: [] });
  /** Into this one's turn: the one before it ends theirs, and the aura asks its save. */
  const into = (state: RulesetEncounterState, id: string) => {
    const at = state.order.indexOf(id);
    state.turn = at - 1;
    return endTurn(state, state.order[at - 1]!);
  };
  const savesOf = (events: RulesetCombatEvent[], id: string) => of(events, "save").filter((one) => one.actorId === id);
  /** The hero casts Antipathy on its friend, naming beasts. */
  const cast = (state: RulesetEncounterState) =>
    act(state, { actorId: "hero", optionId: option(state).id, targetIds: ["friend"], mode: "kind-beast" }).state;
  const option = (state: RulesetEncounterState) =>
    rulesetCombatOptions(definition, state, "hero").find((one) => one.label.startsWith("Antipathy"))!;

  // ── The kind is named as it is cast, and remembered by what it puts on ──
  {
    const state = fight({ wolf: { x: 5, type: "beast" } });
    const offered = option(state);
    assert.deepEqual(
      offered.modes?.map((one) => one.id),
      ["kind-beast", "kind-humanoid", "kind-monstrosity"],
    );
    const bare = applyRulesetCombatChoice(
      definition,
      structuredClone(state),
      { actorId: "hero", optionId: offered.id, targetIds: ["friend"] },
      roll,
    );
    assert.equal(of(bare.events, "refused")[0]?.reason, "unknown-mode", "no kind named, no Antipathy");
    const done = cast(state);
    const on = who(done, "friend").tracked.find((one) => one.condition === "repugnant")!;
    assert.equal(on.kind, "beast");
  }

  // ── Only the kind named: the wolf is asked its save, the goblin beside it is not ──
  {
    const state = cast(fight({ wolf: { x: 5, type: "beast" }, goblin: { x: 6, type: "humanoid" } }));
    faces = { 20: [1] };
    const wolf = into(state, "wolf");
    assert.equal(savesOf(wolf.events, "wolf").length, 1);
    assert.ok(has(wolf.state, "wolf", "repelled"));
    const goblin = into(structuredClone(wolf.state), "goblin");
    assert.equal(savesOf(goblin.events, "goblin").length, 0, "a goblin is no beast");
    // The kind is the one this condition was put on with, not another the holder carries.
    const crowded = cast(fight({ wolf: { x: 5, type: "beast" } }));
    who(crowded, "friend").tracked.unshift({ condition: "repelled", rounds: null, kind: "humanoid" } as never);
    faces = { 20: [1] };
    assert.equal(savesOf(into(crowded, "wolf").events, "wolf").length, 1, "still beasts");
    assert.ok(!has(goblin.state, "goblin", "repelled"));
    assert.ok(!has(goblin.state, "hero", "repelled"), "nor is the hero");
    // Named humanoids instead, the goblin is asked and the wolf is not.
    const other = fight({ wolf: { x: 5, type: "beast" }, goblin: { x: 6, type: "humanoid" } });
    const humanoids = act(other, {
      actorId: "hero",
      optionId: option(other).id,
      targetIds: ["friend"],
      mode: "kind-humanoid",
    }).state;
    faces = { 20: [1] };
    assert.equal(savesOf(into(structuredClone(humanoids), "wolf").events, "wolf").length, 0);
    assert.equal(savesOf(into(structuredClone(humanoids), "goblin").events, "goblin").length, 1);
  }

  // ── An aura that spreads a condition spreads it to the named kind only ──
  {
    const aura = definition.combat!.conditions!.find((one) => one.condition === "repugnant")!.auras![0]!;
    aura.conditions = ["repelled"];
    try {
      const state = cast(fight({ wolf: { x: 5, type: "beast" }, goblin: { x: 6, type: "humanoid" } }));
      assert.ok(has(state, "wolf", "repelled"), "spread to the beast");
      assert.ok(!has(state, "goblin", "repelled"), "not to the goblin");
    } finally {
      delete aura.conditions;
    }
  }

  // ── Or seen: past 60 feet, a wolf that can see its holder is reached; one behind a wall is not ──
  {
    const seen = cast(fight({ wolf: { x: 25, type: "beast" } }));
    faces = { 20: [1] };
    assert.equal(savesOf(into(seen, "wolf").events, "wolf").length, 1, "in sight, however far");
    const hidden = cast(fight({ wolf: { x: 25, type: "beast" } }, [20]));
    faces = { 20: [1] };
    assert.equal(savesOf(into(hidden, "wolf").events, "wolf").length, 0, "out of sight and range");
    // Without orSeen, distance alone decides.
    const plain = cast(fight({ wolf: { x: 25, type: "beast" } }));
    delete (definition.combat!.conditions!.find((one) => one.condition === "repugnant")!.auras![0] as { orSeen?: true })
      .orSeen;
    faces = { 20: [1] };
    assert.equal(savesOf(into(plain, "wolf").events, "wolf").length, 0, "in sight, but too far");
    definition.combat!.conditions!.find((one) => one.condition === "repugnant")!.auras![0]!.orSeen = true;
    const near = cast(fight({ wolf: { x: 13, type: "beast" } }, [7]));
    faces = { 20: [1] };
    assert.equal(savesOf(into(near, "wolf").events, "wolf").length, 1, "within 60 feet, sight or no sight");
  }

  // ── The repeated save: only farther than 60 feet off, and out of sight ──
  {
    const repelledAt = (x: number, walls: number[] = []) => {
      const state = cast(fight({ wolf: { x, type: "beast" } }, walls));
      who(state, "wolf").tracked.push({
        condition: "repelled",
        rounds: null,
        source: "friend",
        difficulty: 5,
        saveEnds: { save: "wis_save", at: "turn-end", unseen: true, beyond: 60 },
      } as never);
      state.turn = state.order.indexOf("wolf");
      faces = { 20: [20] };
      return state;
    };
    assert.equal(savesOf(endTurn(repelledAt(5), "wolf").events, "wolf").length, 0, "within 60 feet");
    assert.equal(savesOf(endTurn(repelledAt(20), "wolf").events, "wolf").length, 0, "far, but in sight");
    assert.equal(savesOf(endTurn(repelledAt(5, [3]), "wolf").events, "wolf").length, 0, "unseen, but near");
    const free = endTurn(repelledAt(20, [10]), "wolf");
    assert.equal(savesOf(free.events, "wolf").length, 1, "far and unseen: rolled");
    assert.ok(!has(free.state, "wolf", "repelled"));
    // Beyond alone: far enough is all it asks.
    const farOnly = repelledAt(20);
    delete (who(farOnly, "wolf").tracked.at(-1)!.saveEnds as { unseen?: true }).unseen;
    assert.equal(savesOf(endTurn(farOnly, "wolf").events, "wolf").length, 1, "far, in sight: rolled");
    const nearOnly = repelledAt(5);
    delete (who(nearOnly, "wolf").tracked.at(-1)!.saveEnds as { unseen?: true }).unseen;
    assert.equal(savesOf(endTurn(nearOnly, "wolf").events, "wolf").length, 0, "near, in sight: not rolled");
  }

  // ── Import ──
  {
    refused(
      document((doc) => delete doc.catalogs.at(-1).entries[0].mechanics.applies),
      /"kindChoice" goes with "applies"/,
    );
    refused(
      document((doc) => delete doc.combat.creatureTypes),
      /This ruleset has no creature types to choose from/,
    );
    refused(
      document((doc) => {
        delete doc.combat.creatureTypes;
        doc.catalogs.at(-1).entries = [];
      }),
      /This ruleset has no creature types to choose from/,
    );
    refused(
      document((doc) => (conditionOf(doc, "repugnant").auras[0].save.applies[0].saveEnds.beyond = 0)),
      /beyond/,
    );
    refused(
      document((doc) => (conditionOf(doc, "repugnant").auras[0].chosenKind = "beast")),
      /chosenKind/,
    );
    // A catalog file of its own with a kind to name and no creature types.
    const bare = parsed(
      document((doc) => {
        delete doc.combat.creatureTypes;
        delete conditionOf(doc, "repugnant").auras[0].chosenKind;
        doc.catalogs.at(-1).entries = [];
      }),
    );
    const issues = rulesetCatalogEntryIssues(
      bare,
      bare.catalogs!.find((one) => one.id === "spells")! as never,
      [antipathy()] as never,
    ).map((one) => one.message);
    assert.ok(issues.includes("This ruleset has no creature types to choose from"), issues.join("; "));
  }

  // ── The install gate ──
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
      "A ruleset with a catalog entry whose creature type is chosen as it is used, an aura reaching only that kind or whoever sees its holder, or a save that ends a condition only from far enough away, requires schemaVersion 2 and capabilityApi 1.270 or newer";
    const issue = (minor: number, doc: unknown, files?: unknown) =>
      getCapabilityPackageInstallIssue(manifest(minor) as never, doc, files as never);
    const only = (keep: (doc: Record<string, any>) => void) =>
      document((doc) => {
        const aura = conditionOf(doc, "repugnant").auras[0];
        delete aura.chosenKind;
        delete aura.orSeen;
        delete aura.save.applies[0].saveEnds.beyond;
        delete doc.catalogs.at(-1).entries[0].mechanics.kindChoice;
        keep(doc);
      });
    assert.notEqual(
      issue(
        269,
        only(() => {}),
      ),
      gate,
      "nothing of 1.270 left",
    );
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["kindChoice", (doc) => (doc.catalogs.at(-1).entries[0].mechanics.kindChoice = true)],
      ["chosenKind", (doc) => (conditionOf(doc, "repugnant").auras[0].chosenKind = true)],
      ["orSeen", (doc) => (conditionOf(doc, "repugnant").auras[0].orSeen = true)],
      ["beyond", (doc) => (conditionOf(doc, "repugnant").auras[0].save.applies[0].saveEnds.beyond = 60)],
    ];
    for (const [name, keep] of cases) {
      const doc = only(keep);
      parsed(doc);
      assert.equal(issue(269, doc), gate, name);
      assert.notEqual(issue(270, doc), gate, name);
    }
    assert.equal(
      issue(
        269,
        only(() => {}),
        new Map([["extra.json", [{ id: "x", mechanics: { kind: "buff", kindChoice: true } }]]]),
      ),
      gate,
    );
  }

  console.log(
    "Ruleset antipathy: Antipathy names its creature type as it is cast and its aura asks only that kind, within 60 feet or in sight; its repeated save is rolled only from farther than 60 feet and out of sight; gated at 1.270.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
