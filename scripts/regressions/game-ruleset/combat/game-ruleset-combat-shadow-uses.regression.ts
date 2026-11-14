/**
 * Uses only in some light, and conditions moving or acting ends (Capability API 1.303).
 *
 *   - An entry's `usableIn.light`: offered only while its user stands in one of those lights, as the
 *     fight reads it where they stand: 5e's One with Shadows, in dim light or darkness.
 *   - `endsWhenHolder.moves` and `.acts`: what its holder moving, or taking any action or reaction
 *     after the one that put it on, takes off them.
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
  RULESET_MOVE_OPTION,
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetBoardLight,
  type RulesetCatalogEntry,
  type RulesetCombatChoice,
  type RulesetDefinition,
  type RulesetEncounterState,
} from "../../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-shadow-uses-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 298);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const shadows = {
    id: "shadows",
    label: "One with Shadows",
    rows: [{ list: "features", values: { name: "One with Shadows" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      usableIn: { light: ["dim", "dark"] },
      applies: [{ condition: "shadowed", duration: { rounds: 100 }, endsWhenHolder: { moves: true, acts: true } }],
    },
  } as unknown as RulesetCatalogEntry;
  // Ends only on moving.
  const still = {
    id: "still",
    label: "Stillness",
    rows: [{ list: "features", values: { name: "Stillness" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      applies: [{ condition: "calm", duration: { rounds: 100 }, endsWhenHolder: { moves: true } }],
    },
  } as unknown as RulesetCatalogEntry;
  // Ends only on acting.
  const focus = {
    id: "focus",
    label: "Focus",
    rows: [{ list: "features", values: { name: "Focus" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      applies: [{ condition: "focused", duration: { rounds: 100 }, endsWhenHolder: { acts: true } }],
    },
  } as unknown as RulesetCatalogEntry;
  // Usable only in the dark, ending however its condition does.
  const dusk = {
    id: "dusk",
    label: "Dusk",
    rows: [{ list: "features", values: { name: "Dusk" } }],
    mechanics: {
      kind: "buff",
      targets: "self",
      usableIn: { light: ["dark"] },
      applies: [{ condition: "calm", duration: { rounds: 1 } }],
    },
  } as unknown as RulesetCatalogEntry;
  const entries = [shadows, still, focus, dusk];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.combat.senses = [{ id: "darkvision", label: "Darkvision" }];
    doc.combat.sight = { unseenAttacks: true, eyes: "sight", darkness: { seeIn: ["darkvision"] } };
    doc.sheet.live.conditions.push(
      { id: "shadowed", label: "Shadowed" },
      { id: "calm", label: "Calm" },
      { id: "focused", label: "Focused" },
    );
    doc.combat.conditions.push(
      { condition: "shadowed", effects: [] },
      { condition: "calm", effects: [] },
      { condition: "focused", effects: [] },
    );
    doc.catalogs.push({
      id: "invocations",
      label: "Invocations",
      feeds: ["features"],
      entries: structuredClone(entries),
    });
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
  const warlock = () =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      fields: { level: 5, ac: 12, speed: 30, hp_max: 40 },
      lists: {
        features: entries.flatMap((entry) => rowsFromCatalogEntry("invocations", entry).map((row) => row.row)),
        attacks: [{ name: "Dagger", ability: "dex", proficient: true, bonus: 0, damage: "1d4", reach: 5 }],
      },
    });
  const fight = (light: RulesetBoardLight, torch = false): RulesetEncounterState => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 15,
      combatants: [
        { id: "lock", name: "Lock", side: "party", build: warlock(), live: {}, catalogs: { invocations: entries } },
        {
          id: "a",
          name: "A",
          side: "enemy",
          block: {
            health: 200,
            defense: 5,
            initiativeModifier: 0,
            speed: 30,
            actions: [{ name: "Claw", budget: "action", toHit: 4, damage: { count: 1, sides: 4, flat: 0 } }],
            ...(torch ? { light: { bright: 20, dim: 20 } } : {}),
          },
        },
      ],
      board: {
        grid: { width: 20, height: 10, tiles: Array.from({ length: 10 }, () => Array(20).fill("plains")) } as never,
        placements: { lock: { x: 2, y: 5 }, a: { x: 3, y: 5 } },
        light,
      },
    });
    state.order = ["lock", "a"];
    state.turn = 0;
    return state;
  };
  const offered = (state: RulesetEncounterState, label: string) =>
    rulesetCombatOptions(definition, state, "lock").find((one) => one.label === label);
  const act = (state: RulesetEncounterState, choice: Omit<RulesetCombatChoice, "actorId">) => {
    state.turn = 0;
    const step = applyRulesetCombatChoice(definition, state, { actorId: "lock", ...choice }, () => 15);
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    return step.state;
  };
  const has = (state: RulesetEncounterState, condition: string) =>
    rulesetCombatant(state, "lock")!.tracked.some((one) => one.condition === condition);
  const use = (state: RulesetEncounterState, label: string) => {
    const option = offered(state, label);
    assert.ok(option, `no ${label}`);
    return act(state, { optionId: option.id, targetIds: ["lock"] });
  };
  const fresh = (state: RulesetEncounterState) => {
    const lock = rulesetCombatant(state, "lock")!;
    lock.budgets = Object.fromEntries(Object.keys(lock.budgets).map((key) => [key, 9]));
    lock.movementLeft = 6;
    return state;
  };

  // ── Only in dim light or darkness ──
  {
    assert.ok(offered(fight("dark"), "One with Shadows"), "in darkness");
    assert.ok(offered(fight("dim"), "One with Shadows"), "in dim light");
    assert.equal(offered(fight("bright"), "One with Shadows"), undefined, "not in bright light");
    assert.equal(offered(fight("dark", true), "One with Shadows"), undefined, "nor by a torch");
  }

  // ── Moving or acting ends it ──
  {
    const hidden = use(fight("dark"), "One with Shadows");
    assert.ok(has(hidden, "shadowed"), "on once used");
    const moved = act(fresh(structuredClone(hidden)), {
      optionId: RULESET_MOVE_OPTION,
      targetIds: [],
      to: { x: 2, y: 3 },
    });
    assert.ok(!has(moved, "shadowed"), "moving ends it");
    const dodged = act(fresh(structuredClone(hidden)), { optionId: "standard:dodge", targetIds: [] });
    assert.ok(!has(dodged, "shadowed"), "an action ends it");
    const struck = act(fresh(structuredClone(hidden)), {
      optionId: offered(fresh(structuredClone(hidden)), "Dagger")!.id,
      targetIds: ["a"],
    });
    assert.ok(!has(struck, "shadowed"), "an attack ends it");
    // Only moving ends the other.
    const calm = use(fight("bright"), "Stillness");
    assert.ok(has(act(fresh(structuredClone(calm)), { optionId: "standard:dodge", targetIds: [] }), "calm"));
    assert.ok(
      !has(
        act(fresh(structuredClone(calm)), { optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 3 } }),
        "calm",
      ),
    );
  }

  // Only acting ends a third; moving leaves it.
  {
    const focused = use(fight("bright"), "Focus");
    assert.ok(
      has(
        act(fresh(structuredClone(focused)), { optionId: RULESET_MOVE_OPTION, targetIds: [], to: { x: 2, y: 3 } }),
        "focused",
      ),
    );
    assert.ok(!has(act(fresh(structuredClone(focused)), { optionId: "standard:dodge", targetIds: [] }), "focused"));
  }

  // ── Refusals ──
  {
    const withEntry = (mechanics: Record<string, unknown>) =>
      fiveE((doc) => {
        doc.catalogs
          .find((catalog: { id: string }) => catalog.id === "invocations")
          .entries.push({ ...shadows, id: "odd", mechanics });
      });
    refusedDoc(withEntry({ kind: "buff", targets: "self", usableIn: { light: ["dim", "dim"] } }), /named once/);
    refusedDoc(
      withEntry({
        kind: "buff",
        targets: "self",
        applies: [{ condition: "calm", duration: { rounds: 1 }, endsWhenHolder: {} }],
      }),
      /moving, acting or using/,
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
      "A ruleset with uses only in some light, or conditions that moving or acting ends, requires schemaVersion 2 and capabilityApi 1.303 or newer";
    for (const entry of [shadows, still, dusk]) {
      const doc = JSON.parse(fiveEText) as Record<string, any>;
      doc.catalogs.push({ id: "invocations", label: "Invocations", feeds: ["features"], entries: [entry] });
      assert.equal(getCapabilityPackageInstallIssue(manifest(302) as never, doc), gate, entry.id);
      assert.notEqual(getCapabilityPackageInstallIssue(manifest(303) as never, doc), gate, entry.id);
    }
  }

  console.log(
    "Shadow uses: One with Shadows offered only in dim light or darkness and ended by moving or acting, another only by moving; refusals; gated at 1.303.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
