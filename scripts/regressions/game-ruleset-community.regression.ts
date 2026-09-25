/**
 * Community rulesets: a ruleset the user imported, stored version by version in `game_rulesets`,
 * merged into the same registry the installed packages feed.
 *
 * What is pinned here:
 *   - A community ruleset is namespaced (`local/<id>`, `<owner>/<id>`), so it can never shadow an
 *     official ruleset and two authors' `v20` are two rulesets.
 *   - A stored version is never rewritten: the same bytes are a no-op, different bytes are refused.
 *   - A game resolves the EXACT version it pinned, even after the author publishes a newer one.
 *   - Turning "Allow custom Agent imports" off hides imported rulesets from NEW games and never
 *     breaks a game that already pinned one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRulesetDefinition, RULESET_MAX_BYTES, type GameSetupConfig } from "../../packages/shared/src/index.js";

const exampleUrl = new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url);
const exampleText = readFileSync(fileURLToPath(exampleUrl), "utf8");

/** A variant of the shipped 5e document: parse, edit, serialize. */
function ruleset(edit: (doc: Record<string, any>) => void): string {
  const doc = JSON.parse(exampleText) as Record<string, any>;
  edit(doc);
  return JSON.stringify(doc, null, 2);
}

const my5eV1 = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
});
const my5eV1Relabelled = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
  doc.sheet.skills[0].label = "Tumbling";
});
const my5eV2 = ruleset((doc) => {
  doc.id = "my-5e";
  doc.name = "My 5e";
  doc.version = 2;
});
const v20 = ruleset((doc) => {
  doc.id = "v20";
  doc.name = "Vampire-ish";
});

// ── The authoring guide's example is a real ruleset, and deliberately not a d20 one ──
{
  const guideExampleUrl = new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url);
  const parsed = parseRulesetDefinition(JSON.parse(readFileSync(fileURLToPath(guideExampleUrl), "utf8")));
  assert.ok(parsed.ok, `the guide's example must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
  assert.deepEqual(
    parsed.definition.resolution.dice,
    { count: 2, sides: 6 },
    "the example shows authors a system that is not 5e-shaped",
  );
}

// ── A really installed package shipping the BARE id `my-5e`, written before the server loads ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-community-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const officialBytes = Buffer.from(my5eV1, "utf8");
const manifest = {
  schemaVersion: 2,
  capabilityApi: { major: 1, minor: 20 },
  builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  id: "ruleset-my-5e",
  name: "My 5e",
  version: "0.1.0",
  description: "An official packaged ruleset that happens to share a bare id with an import.",
  engine: { min: "2.4.6", maxExclusive: "4.0.0" },
  kind: ["ruleset"],
  entrypoints: {},
  contributions: { assets: { paths: ["ruleset.json"] } },
  files: [
    {
      path: "ruleset.json",
      sha256: createHash("sha256").update(officialBytes).digest("hex"),
      bytes: officialBytes.length,
    },
  ],
  permissions: [],
  restartRequired: false,
};
const packageDir = join(dataDir, "capability-packages", "versions", manifest.id, manifest.version);
mkdirSync(packageDir, { recursive: true });
writeFileSync(join(packageDir, "ruleset.json"), officialBytes);
writeFileSync(
  join(dataDir, "capability-packages", "installed.json"),
  JSON.stringify({
    schemaVersion: 1,
    packages: [
      {
        id: manifest.id,
        version: manifest.version,
        manifest,
        installedAt: "2026-09-18T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
      },
    ],
  }),
);

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { createGameRulesetsStorage, gameRulesetRowId, RulesetVersionConflictError } =
  await import("../../packages/server/src/services/storage/game-rulesets.storage.js");
const { buildRulesetRegistry, createRulesetRef, readRulesetRegistry, resolveGameRuleset } =
  await import("../../packages/server/src/services/game/ruleset-registry.service.js");
const { setCustomAgentImportsEnabled } =
  await import("../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
const { gameRoutes } = await import("../../packages/server/src/routes/game.routes.js");
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");

const db = await getDB();
const rulesets = createGameRulesetsStorage(db);
const app = Fastify();
app.decorate("db", db);
await app.register(gameRoutes, { prefix: "/api/game" });
await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });

const localSource = { sourceKind: "local", definition: my5eV1 } as const;

try {
  // ── A version is stored once and never rewritten ──
  {
    const added = await rulesets.put({ rulesetId: "local/my-5e", version: 1, ...localSource });
    assert.equal(added.status, "added");
    assert.equal(added.row.id, gameRulesetRowId("local/my-5e", 1));
    assert.equal(added.row.sourceUrl, null);
    assert.equal(added.row.repositoryId, null);
    assert.equal(added.row.definition, my5eV1, "the bytes are stored verbatim, never re-serialized");

    const again = await rulesets.put({ rulesetId: "local/my-5e", version: 1, ...localSource });
    assert.equal(again.status, "unchanged", "re-importing the same file is a no-op");
    assert.equal(again.row.createdAt, added.row.createdAt);

    await assert.rejects(
      rulesets.put({ rulesetId: "local/my-5e", version: 1, sourceKind: "local", definition: my5eV1Relabelled }),
      (error: unknown) =>
        error instanceof RulesetVersionConflictError && /Raise the ruleset's version/.test(String(error)),
      "different bytes under a stored version are refused, not swapped in",
    );
    assert.equal(
      (await rulesets.get("local/my-5e", 1))?.definition,
      my5eV1,
      "a refused import leaves the stored bytes exactly as they were",
    );

    // A catalog kept in a separate file is something only a package can ship: an imported ruleset
    // is one file, so the picker would have nothing to read. Refused when stored, not at pick time.
    const withAssetCatalog = ruleset((doc) => {
      doc.id = "asset-catalog";
      doc.name = "Asset catalog";
      doc.catalogs = [{ id: "gear", label: "Gear", feeds: [doc.sheet.lists[0].id], asset: "catalogs/gear.json" }];
    });
    await assert.rejects(
      rulesets.put({ rulesetId: "local/asset-catalog", version: 1, sourceKind: "local", definition: withAssetCatalog }),
      /carries its catalogs inline/,
      "an imported ruleset cannot point at a catalog file",
    );
    assert.equal(await rulesets.get("local/asset-catalog", 1), null);

    const second = await rulesets.put({
      rulesetId: "local/my-5e",
      version: 2,
      sourceKind: "local",
      definition: my5eV2,
    });
    assert.equal(second.status, "added");
    assert.equal((await rulesets.list()).length, 2, "v2 stands beside v1 rather than replacing it");
  }

  // ── Everything the registry will later assume is checked before the bytes land ──
  {
    const refused = async (input: Parameters<typeof rulesets.put>[0], pattern: RegExp, why: string) =>
      assert.rejects(rulesets.put(input), (error: unknown) => pattern.test(String(error)), why);

    await refused(
      { rulesetId: "my-5e", version: 1, ...localSource },
      /not a community ruleset id/,
      "a bare id belongs to an official package and can never be imported",
    );
    await refused(
      { rulesetId: "local/other-5e", version: 1, ...localSource },
      /declares the id "my-5e"/,
      "the namespace plus the document's own id must be the id it is filed under",
    );
    await refused(
      { rulesetId: "local/my-5e", version: 7, ...localSource },
      /declares version 1, not 7/,
      "the stored version is the document's, never the caller's claim",
    );
    await refused(
      { rulesetId: "local/my-5e", version: 1, sourceKind: "local", definition: "{ not json" },
      /not valid JSON/,
      "a file that will not parse never becomes a row",
    );
    await refused(
      {
        rulesetId: "local/my-5e",
        version: 1,
        sourceKind: "local",
        definition: ruleset((doc) => {
          doc.id = "my-5e";
          doc.sheet.skills[0].ability = "luck";
        }),
      },
      /not usable: .*Unknown ability "luck"/,
      "a document the schema refuses is refused here too, with the author's own issues",
    );
    await refused(
      { rulesetId: "local/my-5e", version: 1, sourceKind: "local", definition: " ".repeat(RULESET_MAX_BYTES + 1) },
      new RegExp(`over the ${RULESET_MAX_BYTES}-byte limit`),
      "the size ceiling is checked before anything reads the bytes",
    );
    await refused(
      { rulesetId: "alice/my-5e", version: 1, ...localSource, sourceKind: "repository", sourceUrl: "not a url" },
      /not a usable ruleset source address/,
      "a source the pin could not carry is refused here, not written into a game's pin",
    );
    assert.equal((await rulesets.list()).length, 2, "no refusal left a row behind");
  }

  // ── Two namespaces, one bare id ──
  await rulesets.put({
    rulesetId: "alice/v20",
    version: 1,
    sourceKind: "repository",
    sourceUrl: "https://github.com/alice/rules",
    repositoryId: "repo-alice",
    definition: v20,
  });
  await rulesets.put({ rulesetId: "bob/v20", version: 1, sourceKind: "local", definition: v20 });

  // ── The merged registry ──
  {
    const registry = await readRulesetRegistry(db);
    const community = registry.get("local/my-5e");
    assert.ok(community, "the imported ruleset is in the registry under its namespaced id");
    assert.equal(community.packageId, null);
    assert.equal(community.definition.id, "local/my-5e", "the entry is keyed by the id the rest of the Engine sees");
    assert.equal(community.definition.version, 2, "the entry's definition is the highest stored version");
    assert.deepEqual([...community.versions!.keys()].sort(), [1, 2]);
    assert.equal(community.versions!.get(1)!.id, "local/my-5e", "every held version carries the namespaced id");
    assert.equal(community.versions!.get(1)!.version, 1);
    assert.deepEqual(community.source, { kind: "local", url: null });

    const official = registry.get("my-5e");
    assert.ok(official, "the packaged ruleset with the same bare id is untouched");
    assert.equal(official.packageId, "ruleset-my-5e");
    assert.equal(official.definition.id, "my-5e");
    assert.equal(official.versions, undefined, "an official ruleset holds only what is installed");

    assert.equal(registry.get("alice/v20")!.definition.id, "alice/v20");
    assert.equal(registry.get("bob/v20")!.definition.id, "bob/v20");
    assert.deepEqual(registry.get("alice/v20")!.source, {
      kind: "repository",
      url: "https://github.com/alice/rules",
    });
    assert.deepEqual(createRulesetRef(registry.get("alice/v20")!), {
      id: "alice/v20",
      version: 1,
      packageId: null,
      source: "https://github.com/alice/rules",
      options: {},
    });
    assert.deepEqual(createRulesetRef(registry.get("local/my-5e")!), {
      id: "local/my-5e",
      version: 2,
      packageId: null,
      options: {},
    });
  }

  // ── A stored row the current schema no longer accepts is skipped, never thrown ──
  {
    const lines: string[] = [];
    const registry = buildRulesetRegistry([], (line) => lines.push(line), [
      { rulesetId: "local/my-5e", version: 1, sourceKind: "local", sourceUrl: null, definition: my5eV1 },
      { rulesetId: "local/my-5e", version: 2, sourceKind: "local", sourceUrl: null, definition: "{ not json" },
      {
        rulesetId: "local/broken",
        version: 1,
        sourceKind: "local",
        sourceUrl: null,
        definition: '{"schemaVersion":1}',
      },
      { rulesetId: "my-5e", version: 1, sourceKind: "local", sourceUrl: null, definition: my5eV1 },
    ]);
    assert.deepEqual([...registry.keys()], ["local/my-5e"], "only the usable rows survive");
    assert.deepEqual(
      [...registry.get("local/my-5e")!.versions!.keys()],
      [1],
      "one bad version costs only that version",
    );
    assert.equal(lines.length, 3, `one line per dropped row: ${JSON.stringify(lines)}`);
    assert.ok(
      lines.some((line) => /"my-5e" is not namespaced/.test(line)),
      "a bare stored id cannot shadow a package",
    );
  }

  // ── Resolution takes the EXACT pinned version ──
  {
    const registry = await readRulesetRegistry(db);
    const pin = { id: "local/my-5e", version: 1, packageId: null, options: {} };
    const resolved = resolveGameRuleset({ gameRuleset: pin }, registry);
    assert.equal(resolved.status, "ok");
    assert.equal(resolved.status === "ok" && resolved.definition.version, 1, "v1 resolves to v1 although v2 exists");
    assert.equal(resolved.status === "ok" && resolved.definition.id, "local/my-5e");
    assert.equal(resolved.status === "ok" && resolved.packageId, null);

    const future = resolveGameRuleset({ gameRuleset: { ...pin, version: 3 } }, registry);
    assert.equal(future.status === "unavailable" && future.reason, "version-missing");
    assert.equal(
      future.status === "unavailable" && future.installedVersion,
      2,
      "the highest stored version is reported",
    );

    const packaged = resolveGameRuleset({ gameRuleset: { ...pin, packageId: "ruleset-my-5e" } }, registry);
    assert.equal(
      packaged.status === "unavailable" && packaged.reason,
      "different-package",
      "a community id pinned to a package is not this ruleset",
    );
  }

  // ── Through the real routes ──
  const baseConfig = {
    genre: "Fantasy",
    setting: "A quiet harbor",
    tone: "Hopeful",
    difficulty: "normal",
    rating: "sfw",
    playerGoals: "Find my lost friend",
    gmMode: "standalone",
    partyCharacterIds: [],
  } as unknown as GameSetupConfig;
  const create = (ruleset?: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/game/create",
      payload: { name: "Community rules", setupConfig: { ...baseConfig, ...(ruleset ? { ruleset } : {}) } },
    });

  let communityGameMeta: Record<string, unknown>;
  {
    // The client's version is not trusted: the pin is rebuilt from the highest stored version.
    const created = await create({ id: "local/my-5e", version: 1 });
    assert.equal(created.statusCode, 200, created.body);
    communityGameMeta = JSON.parse(created.json().sessionChat.metadata);
    assert.deepEqual(communityGameMeta.gameRuleset, {
      id: "local/my-5e",
      version: 2,
      packageId: null,
      options: {},
    });

    const listed = await app.inject({ method: "GET", url: "/api/capability-packages/rulesets" });
    assert.equal(listed.statusCode, 200, listed.body);
    const entries = listed.json() as Array<{ packageId: string | null; definition: { id: string }; source?: unknown }>;
    const imported = entries.find((entry) => entry.definition.id === "local/my-5e");
    assert.ok(imported, "the editors are told about imported rulesets");
    assert.deepEqual(imported.source, { kind: "local", url: null });

    // The list carries the NEWEST definition. A game pinned to an older stored version asks for that
    // one, so the sheet on screen is the one the server does its arithmetic with.
    const exact = await app.inject({
      method: "GET",
      url: "/api/capability-packages/rulesets/version?rulesetId=local%2Fmy-5e&version=1",
    });
    assert.equal(exact.statusCode, 200, exact.body);
    assert.equal(exact.json().definition.version, 1);
    assert.equal(exact.json().definition.id, "local/my-5e", "served under the namespaced id, like the list");
    const notStored = await app.inject({
      method: "GET",
      url: "/api/capability-packages/rulesets/version?rulesetId=local%2Fmy-5e&version=9",
    });
    assert.equal(notStored.statusCode, 404, notStored.body);
    assert.equal(notStored.json().code, "ruleset_version_missing");
    const official = await app.inject({
      method: "GET",
      url: "/api/capability-packages/rulesets/version?rulesetId=my-5e&version=1",
    });
    assert.equal(official.statusCode, 404, "a package installs one version, which the list already carries");
    assert.equal(
      entries.find((entry) => entry.definition.id === "my-5e")?.source,
      undefined,
      "an official ruleset carries no source",
    );
  }

  // ── The import policy gates NEW games only ──
  {
    await setCustomAgentImportsEnabled(db, false);

    const refused = await create({ id: "local/my-5e", version: 2 });
    assert.equal(refused.statusCode, 400, refused.body);
    assert.equal(refused.json().code, "ruleset_imports_disabled");

    const official = await create({ id: "my-5e", version: 1 });
    assert.equal(official.statusCode, 200, official.body);
    assert.deepEqual(JSON.parse(official.json().sessionChat.metadata).gameRuleset, {
      id: "my-5e",
      version: 1,
      packageId: "ruleset-my-5e",
      options: {},
    });

    const stillPinned = resolveGameRuleset(communityGameMeta, await readRulesetRegistry(db));
    assert.equal(stillPinned.status, "ok", "turning imports off never breaks a game that already pinned one");
    assert.equal(stillPinned.status === "ok" && stillPinned.definition.version, 2);

    await setCustomAgentImportsEnabled(db, true);
  }

  // ── Removing a version, and letting a repository go ──
  {
    await rulesets.remove("local/my-5e", 1);
    assert.equal(await rulesets.get("local/my-5e", 1), null);
    const afterRemove = resolveGameRuleset(
      { gameRuleset: { id: "local/my-5e", version: 1, packageId: null, options: {} } },
      await readRulesetRegistry(db),
    );
    assert.equal(afterRemove.status === "unavailable" && afterRemove.reason, "version-missing");
    assert.equal(afterRemove.status === "unavailable" && afterRemove.installedVersion, 2);

    assert.equal((await rulesets.listByRepository("repo-alice")).length, 1);
    await rulesets.detachRepository("repo-alice");
    assert.equal((await rulesets.listByRepository("repo-alice")).length, 0);
    const kept = await rulesets.get("alice/v20", 1);
    assert.equal(kept?.repositoryId, null, "the rows stay; only the managing repository is forgotten");
    assert.equal(kept?.sourceUrl, "https://github.com/alice/rules", "where it came from is still recorded");
    const pinnedToDetached = resolveGameRuleset(
      { gameRuleset: { id: "alice/v20", version: 1, packageId: null, options: {} } },
      await readRulesetRegistry(db),
    );
    assert.equal(pinnedToDetached.status, "ok", "a game pinned to a detached repository's ruleset still resolves");
  }

  console.info("game ruleset community regressions passed.");
} finally {
  await app.close();
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
}
