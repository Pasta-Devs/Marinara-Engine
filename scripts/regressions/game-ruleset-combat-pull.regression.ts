/**
 * Pulled toward whoever pulls (Capability API 1.675).
 *
 *   - A creature action's `pull`: a balor's whip pulls whoever fails its save straight toward it, a
 *     cell at a time, and stops beside it, at a filled cell, or when the distance runs out. A made
 *     save leaves them where they are. Diagonally too.
 *   - A roper's Reel: `pull` with `targetHolds.fromSelf`, only at somebody it holds.
 *   - A catalog entry's `pull`: Thorn Whip, 10 feet toward its caster.
 *   - The log's "pulls ... in"; import refusals; the install gate.
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
  rulesetOptionTargets,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetCatalogEntry,
  type RulesetCombatCell,
  type RulesetCombatEvent,
  type RulesetDefinition,
  type RulesetEncounterState,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import type { TacticalGrid } from "../../packages/shared/src/features/tactical-combat/types.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-pull-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 675);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (doc: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(doc);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const spell = (id: string, mechanics: Record<string, unknown>) =>
    ({
      id,
      label: id[0]!.toUpperCase() + id.slice(1),
      rows: [{ list: "spells", values: { name: id[0]!.toUpperCase() + id.slice(1), level: 0, prepared: true } }],
      mechanics,
    }) as unknown as RulesetCatalogEntry;
  const thornWhip = spell("whip", {
    kind: "attack",
    range: 30,
    amount: { flat: 1 },
    damageType: "piercing",
    pull: 10,
  });
  const spells = [thornWhip];
  const definition = parsed(
    fiveE((doc) => doc.catalogs.push({ id: "spells", label: "Spells", feeds: ["spells"], entries: spells })),
  );
  const whip = {
    id: "whip",
    name: "Whip",
    budget: "action",
    // Longer than a balor's own 30 feet, to see the pull run out before it is beside it.
    reach: 60,
    autoHit: true,
    damage: { count: 2, sides: 6, flat: 0, type: "slashing" },
    save: { save: "str_save", difficulty: 20, onSuccess: "none" },
    pull: 25,
  };
  /** The whip as a bestiary writes it. */
  const whipEntry = { ...whip, damage: { dice: "2d6", type: "slashing" } };
  const reel = {
    id: "reel",
    name: "Reel",
    budget: "action",
    reach: 50,
    autoHit: true,
    targetHolds: { fromSelf: ["grappled"] },
    pull: 25,
  };
  const block = (extra: Partial<RulesetStatBlock> = {}): RulesetStatBlock =>
    ({
      health: 100,
      defense: 5,
      initiativeModifier: 0,
      speed: 30,
      saves: { str_save: -10 },
      actions: [whip, reel],
      ...extra,
    }) as unknown as RulesetStatBlock;
  const grid = (): TacticalGrid => ({
    width: 20,
    height: 15,
    tiles: Array.from({ length: 15 }, () => Array(20).fill("plains")),
  });
  const fight = (places: Record<string, RulesetCombatCell>, hero: Partial<RulesetStatBlock> = {}) => {
    const state = createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      bestiary: { spells },
      combatants: [
        { id: "balor", name: "Balor", side: "enemy", block: block() },
        { id: "hero", name: "Hero", side: "party", block: block({ actions: [], ...hero }) },
        { id: "other", name: "Other", side: "party", block: block({ actions: [] }) },
        {
          id: "druid",
          name: "Druid",
          side: "party",
          build: rulesetSheetBuildSchema.parse({
            abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 10 },
            fields: { level: 5, ac: 12, speed: 30, hp_max: 40, spellcasting_ability: "wis" },
            lists: { spells: spells.flatMap((entry) => rowsFromCatalogEntry("spells", entry).map((row) => row.row)) },
          }),
          catalogs: { spells },
        },
      ],
      board: {
        grid: grid(),
        placements: { other: { x: 0, y: 14 }, druid: { x: 19, y: 0 }, ...places } as never,
      },
    });
    state.order = state.combatants.map((one) => one.id);
    state.turn = 0;
    return state;
  };
  const who = (state: RulesetEncounterState, id: string) => rulesetCombatant(state, id)!;
  const at = (state: RulesetEncounterState, id: string) => ({ x: who(state, id).x, y: who(state, id).y });
  const use = (state: RulesetEncounterState, actorId: string, label: string, targetIds: string[]) => {
    state.turn = state.order.indexOf(actorId);
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => one.label === label);
    assert.ok(option, `${actorId} has no ${label}`);
    const step = applyRulesetCombatChoice(definition, state, { actorId, optionId: option.id, targetIds }, () => 10);
    const refusal = step.events.find((one) => one.type === "refused");
    assert.equal(refusal, undefined, JSON.stringify(refusal));
    return step;
  };
  const pulls = (events: readonly RulesetCombatEvent[]) =>
    events.filter(
      (one): one is Extract<RulesetCombatEvent, { type: "pushed" }> => one.type === "pushed" && !!one.pulled,
    );

  // ── The whip: 25 feet, five cells, straight in ──
  {
    const step = use(fight({ balor: { x: 2, y: 5 }, hero: { x: 12, y: 5 } }), "balor", "Whip", ["hero"]);
    assert.deepEqual(at(step.state, "hero"), { x: 7, y: 5 });
    const [pulled] = pulls(step.events);
    assert.ok(pulled, "a pulled event");
    assert.equal(pulled!.path.length, 5);
    assert.deepEqual(pulled!.to, { x: 7, y: 5 });
  }
  // ── Stops beside the balor ──
  {
    const step = use(fight({ balor: { x: 2, y: 5 }, hero: { x: 5, y: 5 } }), "balor", "Whip", ["hero"]);
    assert.deepEqual(at(step.state, "hero"), { x: 3, y: 5 });
  }
  // ── Diagonally ──
  {
    const step = use(fight({ balor: { x: 2, y: 5 }, hero: { x: 6, y: 9 } }), "balor", "Whip", ["hero"]);
    assert.deepEqual(at(step.state, "hero"), { x: 3, y: 6 });
  }
  // ── A filled cell stops it ──
  {
    const step = use(fight({ balor: { x: 2, y: 5 }, hero: { x: 6, y: 5 }, other: { x: 4, y: 5 } }), "balor", "Whip", [
      "hero",
    ]);
    assert.deepEqual(at(step.state, "hero"), { x: 5, y: 5 });
  }
  // ── A made save: not moved ──
  {
    const step = use(
      fight({ balor: { x: 2, y: 5 }, hero: { x: 10, y: 5 } }, { saves: { str_save: 30 } }),
      "balor",
      "Whip",
      ["hero"],
    );
    assert.deepEqual(at(step.state, "hero"), { x: 10, y: 5 });
    assert.equal(pulls(step.events).length, 0);
  }
  // ── The Reel: only at somebody it holds ──
  {
    const state = fight({ balor: { x: 2, y: 5 }, hero: { x: 8, y: 5 }, other: { x: 2, y: 9 } });
    state.turn = 0;
    const option = rulesetCombatOptions(definition, state, "balor").find((one) => one.label === "Reel");
    assert.deepEqual(option ? rulesetOptionTargets(definition, state, "balor", option) : [], [], "nobody held");
    who(state, "hero").tracked.push({ condition: "grappled", source: "balor" } as never);
    const step = use(state, "balor", "Reel", ["hero"]);
    assert.deepEqual(at(step.state, "hero"), { x: 3, y: 5 });
  }
  // ── Thorn Whip: 10 feet toward its caster ──
  {
    const step = use(fight({ balor: { x: 6, y: 0 }, hero: { x: 0, y: 0 }, druid: { x: 12, y: 0 } }), "druid", "Whip", [
      "balor",
    ]);
    assert.deepEqual(at(step.state, "balor"), { x: 8, y: 0 });
  }

  // ── Refusals ──
  {
    const withCreature = (action: Record<string, unknown>) =>
      fiveE((doc) =>
        doc.catalogs
          .find((one: { holds?: string }) => one.holds === "creatures")
          .entries[0].creature.actions.push(action),
      );
    parsed(withCreature(whipEntry));
    refused(withCreature({ ...whipEntry, push: 10 }), /pushes or pulls whoever it lands on, not both/);
    refused(
      fiveE((doc) =>
        doc.catalogs.push({
          id: "spells",
          label: "Spells",
          feeds: ["spells"],
          entries: [spell("whip", { ...(thornWhip.mechanics as object), push: 10 })],
        }),
      ),
      /pushes or pulls whoever it lands on, not both/,
    );
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset that pulls somebody toward whoever pulls them (pull) requires schemaVersion 2 and capabilityApi 1.675 or newer";
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
    const withWhip = fiveE((doc) =>
      doc.catalogs
        .find((one: { holds?: string }) => one.holds === "creatures")
        .entries[0].creature.actions.push(whipEntry),
    );
    assert.equal(getCapabilityPackageInstallIssue(manifest(674) as never, withWhip), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(675) as never, withWhip), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(674) as never, fiveE()), gate);
  }

  console.log(
    "Pull: straight toward the puller, stopping beside them or at a filled cell; on a failed save; Reel; Thorn Whip; gated at 1.675.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
