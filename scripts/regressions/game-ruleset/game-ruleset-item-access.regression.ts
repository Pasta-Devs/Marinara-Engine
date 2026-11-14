/** Capability API 1.215: a pick that opens items without carrying them, so a Blades playbook's
 *  items are on the sheet and before the Game Master, and none is in the bag until it is taken. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyRulesetBuilder,
  createRulesetSheetEnvelope,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  renderRulesetSheetBlock,
  rulesetItemAccess,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-item-access-"));
const previous = { DATA_DIR: process.env.DATA_DIR, MARINARA_DATA_DIR: process.env.MARINARA_DATA_DIR };
process.env.DATA_DIR = dataDir;
process.env.MARINARA_DATA_DIR = dataDir;
const { getCapabilityPackageInstallIssue } =
  await import("../../../packages/server/src/services/capability-packages/package-manager.service.js");
const { renderGameRulesetSheetBlocks } =
  await import("../../../packages/server/src/services/game/ruleset-sheet-turn.service.js");

const baseText = readFileSync(new URL("../../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8");
const fixture = (edit: (doc: Record<string, any>) => void = () => {}) => {
  const doc = JSON.parse(baseText) as Record<string, any>;
  doc.catalogs.push({
    id: "playbooks",
    label: "Playbooks",
    entries: [
      { id: "lurk", label: "Lurk", grants: { itemAccess: ["kit/grave-spade", "kit/silver-nail"] } },
      { id: "warden", label: "Warden", grants: { itemAccess: ["kit/silver-nail", "kit/watch-pistol"] } },
    ],
  });
  doc.sheet.builder = {
    steps: [{ id: "playbook", label: "Playbook", kind: "catalog", catalog: "playbooks", min: 0, max: 2 }],
  };
  edit(doc);
  return doc;
};
const parse = (doc: unknown): RulesetDefinition => {
  const result = parseRulesetDefinition(doc);
  assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
  return result.definition;
};
const issuesOf = (doc: unknown) => {
  const result = parseRulesetDefinition(doc);
  return result.ok ? "" : result.issues.join("; ");
};

try {
  const definition = parse(fixture());
  const catalogs: RulesetCatalogEntriesById = Object.fromEntries(
    (definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]),
  );
  const picked = (picks: string[]) => {
    const applied = applyRulesetBuilder(
      definition,
      defaultRulesetSheetBuild(definition),
      { picks: { playbook: picks } },
      catalogs,
    );
    return { ...createRulesetSheetEnvelope(definition, applied.build), builder: applied.state };
  };
  // What the picks open, each once, and nothing before a pick.
  assert.deepEqual(rulesetItemAccess(definition, picked([]), catalogs), []);
  assert.deepEqual(rulesetItemAccess(definition, picked(["lurk"]), catalogs), ["kit/grave-spade", "kit/silver-nail"]);
  assert.deepEqual(rulesetItemAccess(definition, picked(["lurk", "warden"]), catalogs), [
    "kit/grave-spade",
    "kit/silver-nail",
    "kit/watch-pistol",
  ]);
  // The Game Master reads them by name as not carried.
  const stored = picked(["lurk"]);
  const block = renderRulesetSheetBlock(definition, { name: "Ash", build: stored.build }, stored, catalogs);
  assert.match(block, /Has access to, not carried until taken as load: Grave spade, Silver coffin nail$/);
  const none = picked([]);
  assert.doesNotMatch(
    renderRulesetSheetBlock(definition, { name: "Ash", build: none.build }, none, catalogs),
    /Has access to/,
  );
  // As a game renders it: the stored sheet on the card, the live state beside it.
  const [gameBlock] = renderGameRulesetSheetBlocks(definition, [{ name: "Ash", rulesetSheet: stored }], {}, catalogs);
  assert.match(gameBlock ?? "", /Has access to, not carried until taken as load: Grave spade, Silver coffin nail$/);

  // ── The schema ──
  const access = (refs: string[]) =>
    issuesOf(fixture((doc) => (doc.catalogs.at(-1).entries[0].grants.itemAccess = refs)));
  assert.match(access(["kit/nope"]), /No item "nope" in catalog "kit"/);
  assert.match(access(["charms/steady-hand"]), /No item catalog "charms"/);
  assert.match(access(["kit/grave-spade", "kit/grave-spade"]), /named twice/);

  // ── The gate ──
  const manifest = (minor: number) => ({
    schemaVersion: 2,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
    id: "item-access",
    name: "Item access",
    version: "1.0.0",
    description: "Item access proof",
    engine: { min: "2.4.6", maxExclusive: "4.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: ["ruleset.json"] } },
    files: [{ path: "ruleset.json", sha256: "0".repeat(64), bytes: 10 }],
    permissions: [],
    restartRequired: false,
  });
  const gate = (minor: number, doc: unknown) => getCapabilityPackageInstallIssue(manifest(minor) as any, doc);
  assert.match(gate(214, fixture()) ?? "", /1\.215/);
  assert.equal(gate(215, fixture()), null);
  // The same pick in a catalog kept in its own file.
  const inFile = fixture((doc) => {
    const playbooks = doc.catalogs.at(-1);
    doc.catalogs[doc.catalogs.length - 1] = {
      id: playbooks.id,
      label: playbooks.label,
      asset: "catalogs/playbooks.json",
    };
  });
  const filed = { ...manifest(214), contributions: { assets: { paths: ["ruleset.json", "catalogs/playbooks.json"] } } };
  const files = new Map([["catalogs/playbooks.json", { entries: fixture().catalogs.at(-1).entries }]]);
  assert.match(getCapabilityPackageInstallIssue(filed as any, inFile, files) ?? "", /1\.215/);

  console.log("game-ruleset-item-access: passed");
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
