/**
 * A text that follows the sheet, and a pool refilled at initiative (Capability API 1.411).
 *
 *   - Font of Inspiration: the Bardic Inspiration counter recharges on a long rest until level 5, then
 *     a short one, written by the scaled-row recompute and locked in the editor.
 *   - Superior Inspiration: rolling initiative with no uses left gives one back; with one left, nothing.
 *   - Refusals at import and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  createRulesetEncounter,
  parseRulesetDefinition,
  readRulesetLive,
  recomputeScaledRows,
  RULESET_CATALOG_ROW_KEY,
  rulesetSheetBuildSchema,
  scaledRowColumns,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-inspiration-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 411);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const bardic = {
    id: "bardic-inspiration",
    label: "Bardic Inspiration",
    rows: [
      {
        list: "counters",
        values: { name: "Bardic Inspiration", max: 3, recharge: "long" },
        scaled: {
          recharge: {
            from: { field: "level" },
            texts: [
              [1, "long"],
              [5, "short"],
            ],
          },
        },
      },
    ],
  };
  const superior = {
    id: "superior-inspiration",
    label: "Superior Inspiration",
    rows: [{ list: "features", values: { name: "Superior Inspiration", text: "One back at initiative." } }],
    mechanics: { kind: "utility", refillsAtInitiative: { pool: "Bardic Inspiration" } },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.catalogs
      .find((catalog: { id: string }) => catalog.id === "feats")
      .entries.push(structuredClone(bardic), structuredClone(superior));
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
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };
  const definition = parsed(document());
  const catalogs = { feats: [bardic, superior] } as never;
  const sheet = (level: number, withSuperior = true): RulesetSheetBuild =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 },
      fields: { level, ac: 13, speed: 30, hp_max: 30 },
      lists: {
        counters: [
          {
            name: "Bardic Inspiration",
            max: 3,
            recharge: "long",
            [RULESET_CATALOG_ROW_KEY]: "feats/bardic-inspiration",
          },
        ],
        ...(withSuperior
          ? {
              features: [
                {
                  name: "Superior Inspiration",
                  text: "One back at initiative.",
                  [RULESET_CATALOG_ROW_KEY]: "feats/superior-inspiration",
                },
              ],
            }
          : {}),
      },
    });

  // ── Font of Inspiration ──
  {
    const low = recomputeScaledRows(definition, sheet(4), catalogs);
    assert.equal((low.lists!.counters as Array<Record<string, unknown>>)[0]!.recharge, "long");
    const high = recomputeScaledRows(definition, sheet(5), catalogs);
    assert.equal((high.lists!.counters as Array<Record<string, unknown>>)[0]!.recharge, "short");
    assert.deepEqual(
      scaledRowColumns(definition, "counters", (high.lists!.counters as Array<Record<string, unknown>>)[0]!, catalogs),
      ["recharge"],
    );
    // Unchanged: the same build back.
    assert.equal(recomputeScaledRows(definition, high, catalogs), high);
  }

  // ── Superior Inspiration ──
  const pool = "counters:bardic inspiration";
  const spent = (build: RulesetSheetBuild, amount: number): RulesetLiveState => {
    const done = applyRulesetSheetOp(definition, build, undefined, { op: "spend", pool, amount });
    assert.ok(done.ok, JSON.stringify(done));
    return done.live;
  };
  const fight = (build: RulesetSheetBuild, live: RulesetLiveState) =>
    createRulesetEncounter({
      definition,
      seed: 1,
      roller: () => 10,
      combatants: [
        { id: "bard", name: "Bard", side: "party", build, live, catalogs },
        {
          id: "brute",
          name: "Brute",
          side: "enemy",
          block: { health: 20, defense: 10, initiativeModifier: 0, speed: 30, actions: [] } as never,
        },
      ],
    });
  {
    const build = sheet(20);
    const state = fight(build, spent(build, 3));
    const refill = state.opening!.find((one) => one.type === "refilled");
    assert.deepEqual(refill, {
      type: "refilled",
      actorId: "bard",
      label: "Superior Inspiration",
      pool: "Bardic Inspiration",
      now: "1/3",
    });
    const bard = state.combatants.find((one) => one.id === "bard")!;
    assert.equal(readRulesetLive(definition, build, bard.sheet!.live).pools.find((one) => one.key === pool)!.value, 1);
    // One left: nothing.
    const kept = fight(build, spent(build, 2));
    assert.equal(kept.opening!.filter((one) => one.type === "refilled").length, 0);
    // Without the feature: nothing.
    const plain = sheet(20, false);
    assert.equal(fight(plain, spent(plain, 3)).opening!.filter((one) => one.type === "refilled").length, 0);
  }

  // ── Refusals ──
  {
    const scaledWith = (scaled: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.at(-2).rows[0].scaled = scaled;
      });
    refused(
      scaledWith({ recharge: { from: { field: "level" }, texts: [[1, "dawn"]] } }),
      /"dawn" is not one of "recharge"'s values/,
    );
    refused(scaledWith({ max: { from: { field: "level" }, texts: [[1, "long"]] } }), /holds no text/);
    refused(
      scaledWith({
        recharge: {
          from: { field: "level" },
          texts: [
            [5, "long"],
            [1, "short"],
          ],
        },
      }),
      /starts above/,
    );
    refused(scaledWith({ recharge: { from: { field: "level" }, table: [[1, 1]], texts: [[1, "long"]] } }), /not both/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose row sets a text by steps (scaled texts) or refills a pool at initiative (mechanics.refillsAtInitiative) requires schemaVersion 2 and capabilityApi 1.411 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(410) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(411) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(410) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Inspiration: a counter's recharge follows the level by steps of text; an empty pool gets one back as initiative is rolled; gated at 1.411.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
