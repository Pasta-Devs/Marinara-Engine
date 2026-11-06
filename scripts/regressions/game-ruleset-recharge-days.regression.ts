/**
 * Rows that recharge after days of game time (Capability API 1.445).
 *
 *   - Divine Intervention on a `week` recharge: spent, it stays spent through a long rest and five
 *     days, and is back once seven have passed; a long-rest row beside it is left to its rest.
 *   - The `pass` tag reads and writes; the Game Master is told of it only where a ruleset has days.
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
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";
import {
  parseSheetCommandTagBody,
  serializeSheetCommandTag,
} from "../../packages/shared/src/utils/sheet-command-tag.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-recharge-days-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 445);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (days: unknown = { week: 7 }) => {
    const doc = JSON.parse(fiveEText);
    const counters = doc.sheet.lists.find((list: { id: string }) => list.id === "counters");
    const recharge = counters.columns.find((column: { id: string }) => column.id === "recharge");
    recharge.values.push("week");
    recharge.valueLabels.week = "Seven days";
    counters.pools.rechargeDays = days;
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
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 18, cha: 10 },
    fields: { level: 12, ac: 16, speed: 30, hp_max: 80 },
    lists: {
      counters: [
        { name: "Divine Intervention", max: 1, recharge: "week" },
        { name: "Divine Plea", max: 1, recharge: "long" },
      ],
    },
  });
  const apply = (live: unknown, op: Record<string, unknown>) => {
    const result = applyRulesetSheetOp(definition, build, live as never, op as never);
    assert.ok(result.ok, JSON.stringify(result));
    return result;
  };
  const left = (live: unknown, label: string) =>
    readRulesetLive(definition, build, live as never).pools.find((pool) => pool.label === label)!.value;

  // ── Divine Intervention, seven days ──
  {
    let live = apply(undefined, { op: "spend", pool: "Divine Intervention", amount: 1 }).live;
    live = apply(live, { op: "spend", pool: "Divine Plea", amount: 1 }).live;
    live = apply(live, { op: "rest", rest: "long" }).live;
    assert.equal(left(live, "Divine Intervention"), 0, "a long rest gives it nothing back");
    assert.equal(left(live, "Divine Plea"), 1, "the plea is the long rest's");
    const five = apply(live, { op: "pass", days: 5 });
    assert.equal(left(five.live, "Divine Intervention"), 0, "five days: not yet");
    assert.equal(five.now, "5 days pass");
    // A long rest between leaves the count be.
    live = apply(five.live, { op: "rest", rest: "long" }).live;
    const seven = apply(live, { op: "pass", days: 2 });
    assert.equal(left(seven.live, "Divine Intervention"), 1, "seven days: back");
    assert.equal(seven.now, "2 days pass: Divine Intervention 1/1");
    assert.equal(seven.live.waited, undefined, "and its count is gone");
    // Days passing while it is unspent count nothing.
    const idle = apply(seven.live, { op: "pass", days: 6 }).live;
    const spent = apply(idle, { op: "spend", pool: "Divine Intervention", amount: 1 }).live;
    assert.equal(left(apply(spent, { op: "pass", days: 1 }).live, "Divine Intervention"), 0);
    // A count below one is refused.
    const zero = applyRulesetSheetOp(definition, build, spent as never, { op: "pass", days: 0 } as never);
    assert.equal(zero.ok, false);
  }

  // ── The tag ──
  {
    const tag = parseSheetCommandTagBody('who="Brenna" op="pass" days="7"');
    assert.deepEqual(tag.op, { op: "pass", days: 7 }, JSON.stringify(tag));
    assert.match(
      serializeSheetCommandTag({ who: "Brenna", op: { op: "pass", days: 7 }, raw: "" }, {
        ok: true,
        now: "7 days pass",
      } as never),
      /op="pass" days="7"/,
    );
    assert.equal(parseSheetCommandTagBody('who="Brenna" op="pass" days="0"').op, null);
  }

  // ── Refusals ──
  refused(document({ month: 30 }), /"month" is not a value of the recharge column/);
  refused(document({ week: 0 }), /rechargeDays/);

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose list rows recharge after days of game time (rechargeDays) requires schemaVersion 2 and capabilityApi 1.445 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(444) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(445) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(444) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Recharge days: Divine Intervention stays spent through rests and five days and is back after seven, counted by the pass tag; gated at 1.445.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
