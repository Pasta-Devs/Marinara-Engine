/**
 * List pools that count uses rather than being spent (Capability API 1.801, class pass 2026-10-25:
 * Relentless Rage /20 shown as a pool to spend, though 20 is only how far its save's tally counts).
 *
 *   - A row with the list's `tallyColumn` set is a tally; one without it is spent as always.
 *   - The Game Master reads it as the times it was used; a rest on its recharge starts it over.
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  parseRulesetDefinition,
  readRulesetLive,
  renderRulesetSheetBlock,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-tally-pools-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 801);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (column: Record<string, unknown> = { id: "tally", label: "Counts uses", type: "boolean" }) => {
    const doc = JSON.parse(fiveEText);
    const counters = doc.sheet.lists.find((list: { id: string }) => list.id === "counters");
    counters.columns.push(column);
    counters.pools.tallyColumn = column.id;
    return doc;
  };
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(document());
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 16, dex: 12, con: 16, int: 8, wis: 10, cha: 10 },
    fields: { level: 11, ac: 15, speed: 40, hp_max: 110 },
    lists: {
      counters: [
        { name: "Relentless Rage", max: 20, recharge: "short", tally: true },
        { name: "Rage", max: 4, recharge: "long" },
      ],
    },
  });
  const apply = (live: unknown, op: Record<string, unknown>) => {
    const result = applyRulesetSheetOp(definition, build, live as never, op as never);
    assert.ok(result.ok, JSON.stringify(result));
    return result.live;
  };
  const pool = (live: unknown, label: string) =>
    readRulesetLive(definition, build, live as never).pools.find((one) => one.label === label)!;

  // ── A tally beside a pool to spend ──
  assert.equal(pool(undefined, "Relentless Rage").tally, true);
  assert.equal(pool(undefined, "Rage").tally, undefined, "a row without the column is spent as always");
  let live = apply(undefined, { op: "spend", pool: "Relentless Rage", amount: 1 });
  live = apply(live, { op: "spend", pool: "Relentless Rage", amount: 1 });
  live = apply(live, { op: "spend", pool: "Rage", amount: 1 });
  const block = renderRulesetSheetBlock(definition, { name: "Brannoc", build }, live);
  assert.match(block, /Relentless Rage used 2 times/);
  assert.match(block, /Rage 3\/4/);
  assert.doesNotMatch(block, /Relentless Rage 18\/20/);
  // A rest on its recharge starts the count over.
  assert.equal(pool(apply(live, { op: "rest", rest: "short" }), "Relentless Rage").value, 20);
  assert.match(
    renderRulesetSheetBlock(definition, { name: "Brannoc", build }, apply(live, { op: "rest", rest: "short" })),
    /Relentless Rage used 0 times/,
  );
  // A number column counts too, set above 0.
  const numbered = parsed(document({ id: "tally", label: "Counts uses", type: "number", min: 0, max: 1, default: 0 }));
  const counted = rulesetSheetBuildSchema.parse({
    ...build,
    lists: { counters: [{ name: "Overchannel uses", max: 20, recharge: "long", tally: 1 }] },
  });
  assert.equal(
    readRulesetLive(numbered, counted, undefined).pools.find((one) => one.label === "Overchannel uses")?.tally,
    true,
  );

  // ── Refusals ──
  {
    const result = parseRulesetDefinition(document({ id: "tally", label: "Counts uses", type: "text", maxLength: 4 }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.issues.join("; "), /tallyColumn.*yes-or-no or number/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose list pools count uses (pools.tallyColumn) requires schemaVersion 2 and capabilityApi 1.801 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(800) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(801) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(800) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Tally pools: a counters row with the tally column reads as the times it was used, starts over on its rest, and is gated at 1.801.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
