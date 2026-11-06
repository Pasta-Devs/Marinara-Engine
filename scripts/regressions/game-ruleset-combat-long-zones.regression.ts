/**
 * A zone lasting past 1000 rounds, closed by its caster, or spreading (Capability API 1.637): 5e's
 * Eversmoking Bottle, whose smoke "expands at a rate of 10 feet per minute until it reaches its maximum
 * radius" and, stoppered, "disperses after 10 minutes"; and an Oil of Slipperiness's grease "for 8
 * hours".
 *
 *   - It widens every so many of its caster's turns, to its most.
 *   - Closed, it lingers its last rounds, spreads no more, and is gone.
 *   - 4800 rounds is read; the install gate.
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
  rulesetCombatant,
  rulesetCombatOptions,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetStatBlock,
} from "../../packages/shared/src/index.js";
import { rulesetZoneCells } from "../../packages/shared/src/features/ruleset-combat/grid.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-long-zones-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 637);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (zone: Record<string, unknown> = {}) => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.items = { categories: [{ id: "gear", label: "Gear" }] };
    doc.catalogs.push({
      id: "kit",
      label: "Kit",
      holds: "items",
      entries: [
        {
          id: "bottle",
          label: "Eversmoking Bottle",
          item: {
            category: "gear",
            use: {
              kind: "utility",
              budget: "action",
              label: "Open",
              range: 60,
              area: { shape: "burst", size: 10 },
              zone: {
                rounds: 14400,
                anchor: "point",
                triggers: [],
                obscures: {},
                close: { budget: "action", lingers: 3 },
                spreads: { by: 5, every: 2, upTo: 20 },
                ...zone,
              },
            },
          },
        },
      ],
    });
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const bottle = definition.catalogs!.find((catalog) => catalog.id === "kit")!.entries![0]!.item!;
  let state = createRulesetEncounter({
    definition,
    seed: 1,
    roller: () => 10,
    combatants: [
      {
        id: "bard",
        name: "Bard",
        side: "party",
        build: rulesetSheetBuildSchema.parse({
          abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
          fields: { level: 5, ac: 13, speed: 30, hp_max: 40 },
        }),
        items: [{ item: bottle, quantity: 1, worn: false, name: "Eversmoking Bottle" }],
      },
      {
        id: "goblin",
        name: "Goblin",
        side: "enemy",
        block: { health: 7, defense: 13, initiativeModifier: 0, speed: 30, actions: [] } as unknown as RulesetStatBlock,
      },
    ],
    board: {
      grid: { width: 30, height: 30, tiles: Array.from({ length: 30 }, () => Array(30).fill("plains")) } as never,
      placements: { bard: { x: 2, y: 2 }, goblin: { x: 28, y: 28 } },
    },
  });
  state.order = ["bard", "goblin"];
  state.turn = 0;
  const choose = (actorId: string, pick: (label: string, kind: string) => boolean, at?: { x: number; y: number }) => {
    const option = rulesetCombatOptions(definition, state, actorId).find((one) => pick(one.label, one.kind));
    assert.ok(
      option,
      rulesetCombatOptions(definition, state, actorId)
        .map((one) => one.label)
        .join(", "),
    );
    const step = applyRulesetCombatChoice(
      definition,
      state,
      { actorId, optionId: option.id, targetIds: [], ...(at ? { at } : {}) },
      () => 10,
    );
    assert.equal(
      step.events.find((one) => one.type === "refused"),
      undefined,
      JSON.stringify(step.events),
    );
    state = step.state;
    return step;
  };
  const round = () => {
    const ended = choose("bard", (_, kind) => kind === "end-turn");
    choose("goblin", (_, kind) => kind === "end-turn");
    return ended;
  };
  const bard = () => rulesetCombatant(state, "bard")!;
  const zone = () => bard().zones?.[0];
  const radius = () => {
    const cells = rulesetZoneCells(state, bard(), zone()!);
    return Math.max(...cells.map((cell) => Math.abs(cell.x - 12)));
  };

  choose("bard", (label) => label.includes("Open"), { x: 12, y: 12 });
  assert.ok(zone());
  assert.equal(radius(), 2, "10 feet");
  round();
  assert.equal(radius(), 2, "a turn ended, not yet");
  const second = round();
  assert.equal(radius(), 3, "every two of its caster's turns, 5 feet wider");
  assert.ok(second.events.some((one) => one.type === "zone" && one.outcome === "spread"));
  for (let i = 0; i < 8; i++) round();
  assert.equal(radius(), 4, "no wider than 20 feet");

  // ── Closed: it lingers 3 rounds, and is gone ──
  const closed = choose("bard", (label) => label.startsWith("Close"));
  assert.ok(closed.events.some((one) => one.type === "zone" && one.outcome === "closed"));
  assert.equal(zone()?.closed, true);
  choose("bard", (_, kind) => kind === "end-turn");
  choose("goblin", (_, kind) => kind === "end-turn");
  assert.ok(
    !rulesetCombatOptions(definition, state, "bard").some((one) => one.label.startsWith("Close")),
    "closed once",
  );
  round();
  assert.ok(zone(), "still lingering");
  round();
  assert.equal(zone(), undefined, "dispersed");

  // ── An Oil of Slipperiness's 8 hours ──
  parsed(document({ rounds: 4800, close: undefined, spreads: undefined }));
  assert.equal(parseRulesetDefinition(document({ rounds: 14401 })).ok, false);

  // ── The install gate ──
  {
    const gate =
      "A ruleset with a zone lasting past 1000 rounds, closed by its caster or spreading (zone.rounds, zone.close, zone.spreads) requires schemaVersion 2 and capabilityApi 1.637 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(636) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(637) as never, document()), gate);
  }

  console.log(
    "Long zones: the bottle's smoke spreads to its most, closed lingers and goes; 8 hours read; gated at 1.637.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
