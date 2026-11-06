/**
 * Pools given back within a budget (Capability API 1.410): 5e's Arcane Recovery.
 *
 *   - A 4th-level wizard recovers two levels of spent slots: two 1st, or one 2nd, and its counter.
 *   - Refused whole past the budget, above `most`, outside the group, or more than were spent.
 *   - The tag reads and writes `recover`.
 *   - Refusals at import and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  planRulesetUse,
  readRulesetLive,
  RULESET_CATALOG_ROW_KEY,
  applyRulesetSheetOp,
  rulesetSheetBuildSchema,
  serializeSheetCommandTag,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveState,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-recovers-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 410);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const recovery = {
    id: "arcane-recovery",
    label: "Arcane Recovery",
    rows: [{ list: "features", values: { name: "Arcane Recovery", text: "Recover spent slots." } }],
    mechanics: { kind: "utility", recovers: { group: "slots", upTo: { field: "recovery_levels" }, most: 5 } },
  };
  const document = (edit: (doc: Record<string, any>) => void = () => {}) => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.fields.push({
      id: "recovery_levels",
      label: "Recovery levels",
      type: "number",
      min: 0,
      max: 20,
      default: 0,
    });
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(structuredClone(recovery));
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
  const build: RulesetSheetBuild = rulesetSheetBuildSchema.parse({
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    fields: {
      level: 4,
      spellcasting_ability: "int",
      slots_max_1: 4,
      slots_max_2: 3,
      slots_max_3: 0,
      recovery_levels: 2,
    },
    lists: {
      features: [
        { name: "Arcane Recovery", text: "Recover spent slots.", [RULESET_CATALOG_ROW_KEY]: "feats/arcane-recovery" },
      ],
    },
  });
  const catalogs = { feats: [recovery] } as never;
  // Two 1st-level and two 2nd-level slots spent.
  let live: RulesetLiveState | undefined;
  for (const [pool, amount] of [
    ["slots_1", 2],
    ["slots_2", 2],
  ] as const) {
    const spent = applyRulesetSheetOp(definition, build, live, { op: "spend", pool, amount });
    assert.ok(spent.ok, JSON.stringify(spent));
    live = spent.live;
  }
  const value = (state: RulesetLiveState | undefined, pool: string) =>
    readRulesetLive(definition, build, state).pools.find((one) => one.key === pool)!.value;
  const use = (recover?: Array<{ pool: string; count: number }>) =>
    planRulesetUse(definition, build, live, catalogs, {
      op: "use",
      name: "Arcane Recovery",
      ...(recover ? { recover } : {}),
    });
  const apply = (plan: ReturnType<typeof use>) => {
    assert.ok(plan.ok, JSON.stringify(plan));
    let state = live;
    for (const step of plan.steps) {
      const done = applyRulesetSheetOp(definition, build, state, step.op);
      assert.ok(done.ok, JSON.stringify(done));
      state = done.live;
    }
    return state;
  };

  // ── Two levels: two 1st, by label, or one 2nd by id ──
  {
    const two = apply(use([{ pool: "1st-level slots", count: 2 }]));
    assert.equal(value(two, "slots_1"), 4);
    assert.equal(value(two, "slots_2"), 1);
    const one = apply(use([{ pool: "slots_2", count: 1 }]));
    assert.equal(value(one, "slots_2"), 2);
    assert.equal(value(one, "slots_1"), 2);
  }

  // ── Refused whole ──
  {
    const reason = (plan: ReturnType<typeof use>) => (plan.ok ? "ok" : plan.reason);
    assert.match(reason(use([{ pool: "slots_2", count: 2 }])), /recovers 2 levels at most, not 4/);
    assert.match(
      reason(
        use([
          { pool: "slots_1", count: 1 },
          { pool: "slots_2", count: 1 },
        ]),
      ),
      /not 3/,
    );
    assert.equal(reason(use([{ pool: "slots_1", count: 3 }])), "insufficient", "only two were spent");
    assert.equal(reason(use([{ pool: "Hit Dice", count: 1 }])), "bad-pool");
    assert.match(reason(use()), /name what Arcane Recovery recovers, as recover=/);
    const capped = parsed(
      document((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.at(-1).mechanics.recovers.most =
          1;
      }),
    );
    const plan = planRulesetUse(
      capped,
      build,
      live,
      {
        feats: [
          { ...recovery, mechanics: { ...recovery.mechanics, recovers: { ...recovery.mechanics.recovers, most: 1 } } },
        ],
      } as never,
      { op: "use", name: "Arcane Recovery", recover: [{ pool: "slots_2", count: 1 }] },
    );
    assert.equal(plan.ok ? "ok" : plan.reason, "bad-pool", "above the most it recovers");
  }

  // ── A count caps how many come back (1.656) ──
  {
    const counted = {
      ...recovery,
      mechanics: { ...recovery.mechanics, recovers: { ...recovery.mechanics.recovers, count: 1 } },
    };
    const plan = planRulesetUse(definition, build, live, { feats: [counted] } as never, {
      op: "use",
      name: "Arcane Recovery",
      recover: [{ pool: "slots_1", count: 2 }],
    });
    assert.match(plan.ok ? "ok" : plan.reason, /recovers 1 at most, not 2/);
    const one = planRulesetUse(definition, build, live, { feats: [counted] } as never, {
      op: "use",
      name: "Arcane Recovery",
      recover: [{ pool: "slots_1", count: 1 }],
    });
    assert.ok(one.ok, JSON.stringify(one));
  }

  // ── The tag ──
  {
    const op = parseSheetCommandTagBody(`op="use" name="Arcane Recovery" recover="1st-level slots:2, slots_2"`).op;
    assert.deepEqual(op, {
      op: "use",
      name: "Arcane Recovery",
      recover: [
        { pool: "1st-level slots", count: 2 },
        { pool: "slots_2", count: 1 },
      ],
    });
    const written = serializeSheetCommandTag({ op, raw: "" }, { ok: true, now: "ok" });
    assert.deepEqual(parseSheetCommandTagBody(written.slice("[sheet:".length, -1)).op, op, written);
    assert.equal(parseSheetCommandTagBody(`op="use" name="Arcane Recovery" recover="slots_1:0"`).op, null);
  }

  // ── Refusals at import ──
  {
    const withRecovers = (recovers: Record<string, unknown>) =>
      document((doc) => {
        doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.at(-1).mechanics.recovers =
          recovers;
      });
    refused(withRecovers({ group: "nothing_here", upTo: { const: 2 } }), /Unknown pool group "nothing_here"/);
    refused(withRecovers({ group: "slots", upTo: { field: "nothing_here" } }), /nothing_here/);
  }

  // ── The install gate ──
  {
    const gate =
      "A ruleset whose entry gives back pools its user picks within a budget (mechanics.recovers) requires schemaVersion 2 and capabilityApi 1.410 or newer";
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
    assert.equal(getCapabilityPackageInstallIssue(manifest(409) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(410) as never, document()), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(409) as never, JSON.parse(fiveEText)), gate);
  }

  console.log(
    "Recovers: Arcane Recovery gives back two levels of spent slots, refused whole past the budget, above its most, outside the group or beyond what was spent; the tag carries recover; gated at 1.410.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
