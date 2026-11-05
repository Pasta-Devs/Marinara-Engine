/**
 * A feature a rest offers (Capability API 1.789): `recovers.atRest`.
 *
 *   - A Short rest offers Arcane Recovery while it has a use left and a slot is spent, with the
 *     highest spent slots that fit under its levels picked already.
 *   - Taken with the rest, it gives back the slots picked and pays its own counter, all or nothing.
 *   - Another rest, a used-up counter, nothing spent: no offer. Asking for one the rest does not
 *     offer, or more levels than it gives, refuses the lot.
 *   - The Game Master's rest tag takes it with use=, the highest that fit or recover= as picked; the
 *     rest stands when it gives nothing, and says why.
 *   - Checked at import, and the install gate asks for 1.789.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetRestRecoveries,
  applySheetCommandTags,
  normalizeCharacterLookupName,
  parseRulesetDefinition,
  readRulesetLive,
  RULESET_CATALOG_ROW_KEY,
  rulesetRestRecoveries,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-recovery-773-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 789);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const fiveE = (): Record<string, any> => JSON.parse(fiveEText) as Record<string, any>;
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const refused = (document: unknown, pattern: RegExp) => {
    const result = parseRulesetDefinition(document);
    assert.equal(result.ok, false, `should be refused: ${pattern}`);
    if (!result.ok) assert.match(result.issues.join("; "), pattern);
  };

  const recovery = {
    id: "arcane-recovery-test",
    label: "Arcane Recovery",
    rows: [
      { list: "features", values: { name: "Arcane Recovery", text: "Recover slots as a short rest ends." } },
      { list: "counters", values: { name: "Arcane Recovery", max: 1, recharge: "long" } },
    ],
    mechanics: {
      kind: "buff",
      targets: "self",
      recovers: { group: "slots", upTo: { const: 3 }, most: 5, atRest: "short" },
    },
  };
  const withRecovery = (edit: (entry: Record<string, any>) => void = () => {}) => {
    const doc = fiveE();
    const entry = structuredClone(recovery) as Record<string, any>;
    edit(entry);
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(entry);
    return doc;
  };
  const definition = parsed(withRecovery());
  const catalogs = { feats: [recovery] } as never;
  const build = rulesetSheetBuildSchema.parse({
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    fields: { level: 5, spellcasting_ability: "int", slots_max_1: 4, slots_max_2: 3, slots_max_3: 2 },
    lists: {
      features: [
        { name: "Arcane Recovery", text: "Recover slots.", [RULESET_CATALOG_ROW_KEY]: "feats/arcane-recovery-test" },
      ],
      counters: [
        { name: "Arcane Recovery", max: 1, recharge: "long", [RULESET_CATALOG_ROW_KEY]: "feats/arcane-recovery-test" },
      ],
    },
  });
  const pool = (live: unknown, key: string) =>
    readRulesetLive(definition, build, live).pools.find((one) => one.key === key);
  const spent = { pools: { slots_1: { value: 2 }, slots_2: { value: 1 }, slots_3: { value: 1 } } };

  // ── Offered on a Short rest, the highest that fit picked ──
  const offers = rulesetRestRecoveries(definition, build, spent, catalogs, "short");
  assert.equal(offers.length, 1, JSON.stringify(offers));
  const offer = offers[0]!;
  assert.equal(offer.name, "Arcane Recovery");
  assert.equal(offer.upTo, 3);
  assert.deepEqual(
    offer.pools.map((one) => [one.key, one.level, one.spent]),
    [
      ["slots_3", 3, 1],
      ["slots_2", 2, 2],
      ["slots_1", 1, 2],
    ],
  );
  assert.deepEqual(offer.picks, [{ pool: "slots_3", count: 1 }], "one 3rd-level slot fills 3 levels");
  // Not on a Long rest, nor with nothing spent.
  assert.deepEqual(rulesetRestRecoveries(definition, build, spent, catalogs, "long"), []);
  assert.deepEqual(rulesetRestRecoveries(definition, build, {}, catalogs, "short"), []);

  // ── Taken: the slots come back and its counter is paid ──
  const taken = applyRulesetRestRecoveries(definition, build, spent, catalogs, "short", [
    {
      name: "Arcane Recovery",
      recover: [
        { pool: "slots_2", count: 1 },
        { pool: "slots_1", count: 1 },
      ],
    },
  ]);
  assert.ok(taken.ok, JSON.stringify(taken));
  assert.equal(pool(taken.live, "slots_2")!.value, 2);
  assert.equal(pool(taken.live, "slots_1")!.value, 3);
  assert.match(taken.now.join("; "), /^Arcane Recovery: /);
  const counter = readRulesetLive(definition, build, taken.live).pools.find((one) => one.listId === "counters");
  assert.equal(counter?.value, 0, "its one use is spent");
  // Used up: no offer until it recharges.
  assert.deepEqual(rulesetRestRecoveries(definition, build, taken.live, catalogs, "short"), []);

  // ── Refused, the sheet as it was ──
  const tooMany = applyRulesetRestRecoveries(definition, build, spent, catalogs, "short", [
    {
      name: "Arcane Recovery",
      recover: [
        { pool: "slots_3", count: 1 },
        { pool: "slots_1", count: 1 },
      ],
    },
  ]);
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.match(tooMany.reason, /3 levels at most/);
  const wrongRest = applyRulesetRestRecoveries(definition, build, spent, catalogs, "long", [
    { name: "Arcane Recovery", recover: [{ pool: "slots_1", count: 1 }] },
  ]);
  assert.deepEqual(wrongRest, { ok: false, reason: "unknown-entry" });

  // ── From the Game Master's rest tag: use="Arcane Recovery", the highest that fit or what is picked ──
  const key = normalizeCharacterLookupName("Ilse");
  const tagged = (tag: string, live: unknown = spent) =>
    applySheetCommandTags(tag, {
      definition,
      cards: [{ name: "Ilse", build }],
      playerName: "Ilse",
      live: { [key]: live as never },
      catalogs,
    });
  const byDefault = tagged(`[sheet: op="rest" rest="Short rest" use="Arcane Recovery"]`);
  assert.ok(byDefault.outcomes[0]!.ok, JSON.stringify(byDefault.outcomes));
  assert.equal(pool(byDefault.live[key], "slots_3")!.value, 2, "the highest spent that fit");
  assert.match(byDefault.content, /use="Arcane Recovery"/);
  assert.match(byDefault.outcomes[0]!.now!, /Arcane Recovery: /);
  const picked = tagged(`[sheet: op="rest" rest="Short rest" use="arcane recovery" recover="slots_1:2"]`);
  assert.ok(picked.outcomes[0]!.ok);
  assert.equal(pool(picked.live[key], "slots_1")!.value, 4);
  assert.equal(pool(picked.live[key], "slots_3")!.value, 1);
  // Used up, too much picked, or a rest that does not offer it: the rest stands and says why.
  // A later short rest, with time passed: one taken again in the next reply is refused (2026-10-26).
  const { rested: _rested, ...later } = byDefault.live[key]!;
  const again = tagged(`[sheet: op="rest" rest="Short rest" use="Arcane Recovery"]`, later);
  assert.ok(again.outcomes[0]!.ok);
  assert.match(again.outcomes[0]!.now!, /Arcane Recovery: nothing it can give back now$/);
  const greedy = tagged(`[sheet: op="rest" rest="Short rest" use="Arcane Recovery" recover="slots_3:2"]`);
  assert.ok(greedy.outcomes[0]!.ok);
  assert.match(greedy.outcomes[0]!.now!, /Arcane Recovery refused: /);
  assert.equal(pool(greedy.live[key], "slots_3")!.value, 1);

  // ── Checked at import ──
  refused(
    withRecovery((entry) => (entry.mechanics.recovers.atRest = "nap")),
    /Unknown rest "nap"/,
  );

  // ── The install gate ──
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
    "A ruleset with a feature a rest offers (recovers.atRest) requires schemaVersion 2 and capabilityApi 1.789 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(788) as never, withRecovery()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(789) as never, withRecovery()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(788) as never, fiveE()), gate);

  console.log(
    "Rest recovery 1.789: a Short rest offers Arcane Recovery, takes it with the slots picked, refuses what it does not offer, and the gate asks for 1.789.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
