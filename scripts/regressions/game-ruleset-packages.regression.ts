/**
 * Ruleset package files (RM, `<name>.ruleset.json`): imported as data, never as a package, never run.
 *
 *   - A package file of exactly its format, version, manifest and files (a ruleset.json and its
 *     catalogs/<id>.json documents, each strict base64) is read in memory, checked whole and kept under
 *     `local/<id>` with its catalog files; anything else refuses it, each with the reason: other keys,
 *     other files or odd names, more files than a ruleset has, sizes over their caps, text that is not
 *     base64 or not UTF-8, a manifest that is more than a ruleset's (code, permissions, other
 *     contributions, files that are not the package's), a ruleset or catalog that does not read or
 *     carries more than a ruleset ($comment essays, a foreign $schema), catalogs not the ruleset's.
 *     Zips are not accepted at all.
 *   - A dry run keeps nothing; the import follows privilege and the import policy.
 *   - A version is its ruleset AND its catalogs: the same text with another catalog is a conflict; a
 *     catalog file is kept once whatever versions name it, and goes with the last of them; one version
 *     no game pins can be removed alone.
 *   - Play reads a stored catalog file like a package's; the JSON import still refuses catalog files.
 *   - An editor checks a ruleset (or a package file) without saving it, with issues where they point and
 *     the least capability API a package of it needs, and reads an installed ruleset's files from its
 *     source.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseRulesetCatalogFile,
  parseRulesetDefinition,
  RULESET_CATALOG_EARLIER_MAX_BYTES,
  RULESET_CATALOG_MAX_BYTES,
  RULESET_EARLIER_MAX_BYTES,
  RULESET_MAX_BYTES,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-packages-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

// ── A ruleset package: the ember-roads example, its first catalog in its own file ──
const example = JSON.parse(
  readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
type Docs = { ruleset: Record<string, any>; catalogs: Record<string, Record<string, unknown>> };
function packageDocs(edit?: (docs: Docs) => void): Docs {
  const ruleset = structuredClone(example);
  ruleset.id = "ember-roads-house";
  const [first] = ruleset.catalogs as Array<Record<string, any>>;
  const catalogs = { [first.id]: { schemaVersion: 1, catalog: first.id, entries: first.entries } };
  delete first.entries;
  first.asset = `catalogs/${first.id}.json`;
  const docs = { ruleset, catalogs };
  edit?.(docs);
  return docs;
}
type Manifest = Record<string, any>;
type PackageFile = Record<string, any> & { manifest: Manifest; files: Record<string, unknown> };
/** A package file whose documents are exactly these bytes, its manifest listing them truly, plus `extra`
 *  files its manifest does not list. */
function packageOfFiles(
  files: Array<{ name: string; data: Buffer }>,
  manifestEdit?: (manifest: Manifest) => void,
  extra: Record<string, unknown> = {},
): PackageFile {
  const manifest: Manifest = {
    schemaVersion: 2,
    id: "ember-roads-house",
    name: "Ember Roads (house)",
    version: "1.0.0",
    description: "",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: files.map((file) => file.name) } },
    files: files.map((file) => ({ path: file.name, sha256: sha256(file.data), bytes: file.data.length })),
    permissions: [],
    restartRequired: false,
    capabilityApi: { major: 1, minor: 79 },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  };
  manifestEdit?.(manifest);
  return {
    format: "marinara-ruleset",
    version: 1,
    manifest,
    files: { ...Object.fromEntries(files.map((file) => [file.name, file.data.toString("base64")])), ...extra },
  };
}
const documentsOf = (docs: Docs) => [
  { name: "ruleset.json", data: Buffer.from(JSON.stringify(docs.ruleset, null, 2)) },
  ...Object.entries(docs.catalogs).map(([id, catalog]) => ({
    name: `catalogs/${id}.json`,
    data: Buffer.from(JSON.stringify(catalog)),
  })),
];
const fileOf = (docs: Docs, manifestEdit?: (manifest: Manifest) => void, extra: Record<string, unknown> = {}) =>
  packageOfFiles(documentsOf(docs), manifestEdit, extra);
/** A package whose ruleset.json is exactly this text, its manifest listing it truly. */
function fileOfTexts(rulesetText: string, catalogs: Docs["catalogs"]): PackageFile {
  const [, ...catalogFiles] = documentsOf({ ruleset: {}, catalogs });
  return packageOfFiles([{ name: "ruleset.json", data: Buffer.from(rulesetText) }, ...catalogFiles]);
}
/** The same package with one of its documents replaced by these bytes, the manifest still listing them truly. */
function withDocument(name: string, data: Buffer): PackageFile {
  return packageOfFiles(documentsOf(packageDocs()).map((file) => (file.name === name ? { name, data } : file)));
}
const firstCatalog = (example.catalogs as Array<{ id: string; entries: unknown[] }>)[0]!;

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { setCustomAgentImportsEnabled } =
  await import("../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
const { gameRulesetsRoutes } = await import("../../packages/server/src/routes/game-rulesets.routes.js");
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
const { gameRulesetCatalogs } = await import("../../packages/server/src/db/schema/index.js");
const { readRulesetPackageFile } = await import("../../packages/server/src/services/game/ruleset-package-file.js");
const { createChatsStorage } = await import("../../packages/server/src/services/storage/chats.storage.js");
const { loadRulesetCatalogEntries } =
  await import("../../packages/server/src/services/game/ruleset-catalog.service.js");
const { readRulesetRegistry } = await import("../../packages/server/src/services/game/ruleset-registry.service.js");

try {
  const db = await getDB();
  const app = Fastify();
  app.decorate("db", db);
  await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
  await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
  try {
    const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
      app.inject({ method: "POST", url: `/api/game-rulesets${url}`, payload: payload as never, headers });
    const importFile = (file: unknown, dryRun?: boolean) =>
      post("/import-package", { package: file, ...(dryRun ? { dryRun } : {}) });
    const refusal = (file: unknown) => {
      const read = readRulesetPackageFile(file);
      assert.equal(read.ok, false, "refused");
      return (read as { issues: string[] }).issues.join(" | ");
    };
    const storedCatalogs = async () => ((await db.select().from(gameRulesetCatalogs)) as unknown[]).length;

    // ── What a package file may hold, and nothing else ──
    const good = fileOf(packageDocs());
    assert.equal(readRulesetPackageFile(good).ok, true, JSON.stringify(readRulesetPackageFile(good)).slice(0, 300));
    for (const notOne of [
      "not a package",
      null,
      [],
      {},
      { format: "marinara-experience" },
      { ...good, format: "zip" },
    ]) {
      assert.match(refusal(notOne), /not a ruleset package/, JSON.stringify(notOne).slice(0, 40));
    }
    assert.match(refusal({ ...good, version: 2 }), /of version 2; this Engine reads version 1/);
    assert.match(refusal({ ...good, client: "alert(1)" }), /format, version, manifest and files, and nothing else/);
    const { files: _files, ...noFiles } = good;
    assert.match(refusal(noFiles), /and nothing else/);
    assert.match(refusal({ ...good, files: ["ruleset.json"] }), /not a list of named documents/);
    assert.match(refusal({ ...good, files: "UEsDBA==" }), /not a list of named documents/);
    const many = fileOf(
      packageDocs(),
      undefined,
      // Its ruleset, 12 catalogs and 40 translations (1.811) at most.
      Object.fromEntries(Array.from({ length: 52 }, (_, n) => [`catalogs/c${n}.json`, "e30="])),
    );
    assert.match(refusal(many), /54 files; a ruleset package has at most 53/);
    for (const name of [
      "manifest.json",
      "payload.js",
      "../ruleset.json",
      "catalogs/../x.json",
      "/ruleset.json",
      "Ruleset.json",
      "Catalogs/x.json",
      "catalogs/X.json",
      "catalogs/a b.json",
      "catalogs/",
      "README.md",
      "catalogs/nested/x.json",
      "rules.zip",
    ]) {
      assert.match(
        refusal(fileOf(packageDocs(), undefined, { [name]: "e30=" })),
        /is not a file a ruleset package has/,
        name,
      );
    }
    // Strict base64, and the one way of writing these bytes: no spaces or line breaks, no URL alphabet,
    // no data URL, no padding left off or bits left over, no other value than a string.
    for (const text of ["e30", "e 30=", "e30=\n", "e3-_", "data:application/json;base64,e30=", "e31=", "!!!!"]) {
      assert.match(refusal({ ...good, files: { ...good.files, "ruleset.json": text } }), /is not base64/, text);
    }
    for (const value of [123, null, { data: "e30=" }, ["e30="]]) {
      assert.match(refusal({ ...good, files: { ...good.files, "ruleset.json": value } }), /is not base64/);
    }
    // Every file is capped by its kind before a byte of it is decoded.
    assert.match(
      refusal(withDocument(`catalogs/${firstCatalog.id}.json`, Buffer.alloc(RULESET_CATALOG_MAX_BYTES + 1, 0x20))),
      /over its 2097152-byte limit/,
    );
    assert.match(
      refusal(withDocument("ruleset.json", Buffer.alloc(RULESET_MAX_BYTES + 1, 0x20))),
      /over its 524288-byte limit/,
    );
    // The earlier limits (256 KiB and 1 MiB) still hold below 1.340; game-ruleset-caps checks that gate.
    assert.equal(RULESET_EARLIER_MAX_BYTES, 256 * 1024);
    assert.equal(RULESET_CATALOG_EARLIER_MAX_BYTES, 1024 * 1024);
    assert.match(refusal(withDocument("ruleset.json", Buffer.from([0xff, 0xfe, 0x00]))), /not UTF-8/);
    // The manifest is its own key, held to its size and its shape before anything reads it.
    assert.match(
      refusal({ ...good, manifest: { ...good.manifest, description: "x".repeat(70_000) } }),
      /The manifest is over its 65536-byte limit/,
    );
    let deepManifest: unknown = [];
    for (let depth = 0; depth < 5000; depth++) deepManifest = [deepManifest];
    assert.match(
      refusal({ ...good, manifest: { ...good.manifest, extra: deepManifest } }),
      /manifest .*nested deeper than a ruleset ever is/,
    );

    // ── The shared parsers guard their own shape, whatever reads them (a package's installed files too) ──
    const plainDefinition = parseRulesetDefinition(packageDocs().ruleset);
    assert.ok(plainDefinition.ok, JSON.stringify(plainDefinition).slice(0, 300));
    const startedParse = Date.now();
    const bombRead = parseRulesetCatalogFile(plainDefinition.definition, firstCatalog.id, {
      schemaVersion: 1,
      catalog: firstCatalog.id,
      entries: Array.from({ length: 300_000 }, () => ({})),
    });
    assert.ok(
      !bombRead.ok && /more than any part of a ruleset has/.test(bombRead.issues[0]!),
      JSON.stringify(bombRead).slice(0, 200),
    );
    assert.ok(Date.now() - startedParse < 3000, "refused before the schema reads every item");
    let nested: unknown = [];
    for (let depth = 0; depth < 5000; depth++) nested = [nested];
    const deepRead = parseRulesetDefinition({ ...packageDocs().ruleset, deep: nested });
    assert.ok(
      !deepRead.ok && /nested deeper than a ruleset ever is/.test(deepRead.issues[0]!),
      "never a stack overflow",
    );

    // ── A manifest that is a ruleset's and nothing more ──
    const manifestRefusal = (edit: (manifest: Manifest) => void) => refusal(fileOf(packageDocs(), edit));
    assert.match(
      manifestRefusal((m) => (m.kind = ["ruleset", "agent"])),
      /of the kind ruleset alone/,
    );
    assert.match(
      manifestRefusal((m) => (m.entrypoints = { client: "client.js" })),
      /no entrypoints \(no code\)/,
    );
    assert.match(
      manifestRefusal((m) => (m.permissions = ["routes"])),
      /asks for no permissions/,
    );
    assert.match(
      manifestRefusal((m) => (m.localizations = { fr: { name: "x" } })),
      /no localizations/,
    );
    assert.match(
      manifestRefusal((m) => (m.restartRequired = true)),
      /needs no restart/,
    );
    assert.match(
      manifestRefusal((m) => (m.contributions.slots = ["chat-settings"])),
      /contributes its assets and nothing else/,
    );
    assert.match(
      manifestRefusal((m) => m.contributions.assets.paths.pop()),
      /its assets are not/,
    );
    assert.match(
      manifestRefusal((m) => (m.files[0].sha256 = "0".repeat(64))),
      /is not the file it lists/,
    );
    assert.match(
      manifestRefusal((m) => m.files.pop()),
      /its files are not|must be listed in the package file manifest/,
    );
    assert.match(
      manifestRefusal((m) => (m.id = "Not An Id")),
      /manifest id/,
    );
    const { manifest: _manifest, ...noManifest } = good;
    assert.match(refusal(noManifest), /and nothing else/);
    assert.match(refusal({ ...good, manifest: null }), /^manifest/);

    // ── The ruleset and its catalogs, read strictly, and nothing more than a ruleset ──
    assert.match(refusal(fileOf(packageDocs((docs) => delete docs.ruleset.sheet))), /ruleset.json/);
    assert.match(
      refusal(fileOf(packageDocs((docs) => (docs.ruleset.combat = { $comment: "x".repeat(2001) })))),
      /^ruleset\.json combat\.\$comment: a \$comment is a note of at most 2000/,
    );
    // A note as long as the cap reads, and every example the docs ship travels as a package (their
    // notes run to 878 characters; 5e-2014's to 1,016).
    assert.ok(readRulesetPackageFile(fileOf(packageDocs((docs) => (docs.ruleset.$comment = "x".repeat(2000))))).ok);
    const examplesDir = new URL("../../docs/examples/rulesets/", import.meta.url);
    for (const file of readdirSync(examplesDir).filter((name) => name.endsWith(".json"))) {
      const ruleset = JSON.parse(readFileSync(new URL(file, examplesDir), "utf8")) as Record<string, unknown>;
      const read = readRulesetPackageFile(fileOf({ ruleset, catalogs: {} }));
      assert.ok(read.ok, `${file}: ${JSON.stringify(read).slice(0, 300)}`);
    }
    assert.match(
      refusal(fileOf(packageDocs((docs) => (docs.ruleset.$schema = "https://evil.example/s.json")))),
      /\$schema may only name/,
    );
    assert.equal(
      readRulesetPackageFile(
        fileOf(
          packageDocs(
            (docs) =>
              (docs.ruleset.$schema =
                "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Engine/staging/docs/extending/ruleset.schema.json"),
          ),
        ),
      ).ok,
      true,
      "the Engine's own schema",
    );
    assert.match(
      refusal(
        fileOf(
          packageDocs((docs) => ((docs.catalogs[firstCatalog.id] as { entries: unknown[] }).entries = [{ nope: 1 }])),
        ),
      ),
      new RegExp(`catalogs/${firstCatalog.id}.json`),
    );
    assert.match(
      refusal(
        fileOf(packageDocs((docs) => (docs.catalogs.extra = { schemaVersion: 1, catalog: "extra", entries: [] }))),
      ),
      /not a catalog the ruleset names/,
    );
    assert.match(refusal(fileOf(packageDocs((docs) => delete docs.catalogs[firstCatalog.id]))), /no catalogs\//);
    // Nesting deeper than a ruleset is, and a list longer than any it has: refused before the schema
    // reads them, never a crash or a long stall.
    const plainText = JSON.stringify(packageDocs().ruleset);
    const deepText = plainText.replace('"coverage":{', `"coverage":{"deep":${"[".repeat(5000)}${"]".repeat(5000)},`);
    assert.match(refusal(fileOfTexts(deepText, packageDocs().catalogs)), /nested deeper than a ruleset ever is/);
    const started = Date.now();
    assert.match(
      refusal(
        fileOf(
          packageDocs(
            (docs) =>
              ((docs.catalogs[firstCatalog.id] as { entries: unknown[] }).entries = Array.from(
                { length: 300_000 },
                () => ({}),
              )),
          ),
        ),
      ),
      /300000 items, more than any part/,
    );
    assert.ok(Date.now() - started < 3000, "refused before the schema reads every item");
    // A repeated key: only what was read is kept, never the bytes the parse dropped (a 200 KB $comment
    // the last, short one hides).
    const rulesetText = JSON.stringify(packageDocs().ruleset);
    const hidden = `{"$comment":"${"x".repeat(200_000)}","$comment":"short",${rulesetText.slice(1)}`;
    const twiceRead = readRulesetPackageFile(fileOfTexts(hidden, packageDocs().catalogs));
    assert.ok(twiceRead.ok, JSON.stringify(twiceRead).slice(0, 300));
    assert.ok(!twiceRead.ruleset.includes("x".repeat(1000)) && twiceRead.ruleset.length < 100_000, "kept as read");
    // Two catalog files whose ids share a beginning (sorted one way by code unit, another by a locale).
    const prefixed = fileOf(
      packageDocs((docs) => {
        const second = {
          ...structuredClone((example.catalogs as Array<Record<string, any>>)[0]),
          id: `${firstCatalog.id}_extra`,
          label: "More knacks",
        };
        delete second.entries;
        second.asset = `catalogs/${second.id}.json`;
        docs.ruleset.catalogs.push(second);
        docs.catalogs[second.id] = { schemaVersion: 1, catalog: second.id, entries: firstCatalog.entries.slice(0, 2) };
      }),
    );
    assert.equal(readRulesetPackageFile(prefixed).ok, true, refusal.name);

    // ── Imported: privileged, behind the policy, a dry run keeps nothing ──
    const untrusted = await post("/import-package", { package: good }, { host: "evil.example" });
    assert.equal(untrusted.statusCode, 421);
    await setCustomAgentImportsEnabled(db, false);
    const refusedByPolicy = await importFile(good);
    assert.equal(refusedByPolicy.statusCode, 403);
    // Its own code, so an editor tells it from the privileged gate's 403.
    assert.equal(refusedByPolicy.json().code, "custom_agent_imports_disabled");
    await setCustomAgentImportsEnabled(db, true);
    const dry = await importFile(good, true);
    assert.equal(dry.statusCode, 200, dry.body);
    assert.deepEqual(
      [dry.json().status, dry.json().rulesetId, dry.json().catalogs],
      ["checked", "local/ember-roads-house", { [firstCatalog.id]: firstCatalog.entries.length }],
    );
    assert.equal(JSON.parse(dry.json().ruleset).id, "ember-roads-house");
    assert.equal(await storedCatalogs(), 0, "a dry run keeps nothing");
    const bad = await importFile(fileOf(packageDocs(), (m) => (m.entrypoints = { server: "x.js" })));
    assert.equal(bad.statusCode, 400);
    assert.match(bad.json().error, /no entrypoints/);
    const added = await importFile(good);
    assert.equal(added.statusCode, 200, added.body);
    assert.equal(added.json().status, "added");
    assert.equal((await importFile(good)).json().status, "unchanged");

    // ── Played: its catalog file read like a package's ──
    const listed = (await app.inject({ method: "GET", url: "/api/capability-packages/rulesets" })).json() as Array<{
      definition: { id: string };
      versions?: number[];
    }>;
    assert.ok(
      listed.some((entry) => entry.definition.id === "local/ember-roads-house"),
      JSON.stringify(listed.map((e) => e.definition.id)),
    );
    const catalog = await app.inject({
      method: "GET",
      url: `/api/capability-packages/rulesets/catalog?rulesetId=local/ember-roads-house&catalogId=${firstCatalog.id}&version=1`,
    });
    assert.equal(catalog.statusCode, 200, catalog.body);
    assert.equal(catalog.json().entries.length, firstCatalog.entries.length);
    assert.ok(catalog.headers.etag, "with a validator from its sha256");

    // ── A version is its ruleset and its catalogs ──
    const otherCatalog = fileOf(
      packageDocs(
        (docs) => ((docs.catalogs[firstCatalog.id] as { entries: unknown[] }).entries = firstCatalog.entries.slice(1)),
      ),
    );
    const conflict = await importFile(otherCatalog);
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.json().code, "ruleset_version_conflict");
    // Version 2 keeps the catalog: stored once.
    const v2 = await importFile(fileOf(packageDocs((docs) => (docs.ruleset.version = 2))));
    assert.equal(v2.json().status, "added", v2.body);
    assert.equal(await storedCatalogs(), 1, "one catalog file for both versions");
    // Version 3 with a changed catalog: two files kept.
    const v3 = await importFile(
      fileOf(
        packageDocs((docs) => {
          docs.ruleset.version = 3;
          (docs.catalogs[firstCatalog.id] as { entries: unknown[] }).entries = firstCatalog.entries.slice(1);
        }),
      ),
    );
    assert.equal(v3.json().status, "added", v3.body);
    assert.equal(await storedCatalogs(), 2);

    // ── An editor reads them back, as written ──
    const source = await app.inject({
      method: "GET",
      url: "/api/game-rulesets/source?rulesetId=local/ember-roads-house&version=1",
    });
    assert.equal(source.statusCode, 200, source.body);
    assert.equal(JSON.parse(source.json().ruleset).id, "ember-roads-house");
    assert.deepEqual(JSON.parse(source.json().catalogs[firstCatalog.id]).entries, firstCatalog.entries);
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/game-rulesets/source?rulesetId=local/nothing&version=1" }))
        .statusCode,
      404,
    );
    // ── The schema an editor builds its forms from: exactly the one the Engine publishes ──
    const schemaRead = await app.inject({ method: "GET", url: "/api/game-rulesets/schema" });
    assert.equal(schemaRead.statusCode, 200, schemaRead.body);
    assert.match(String(schemaRead.headers["content-type"]), /application\/json/);
    assert.deepEqual(
      schemaRead.json(),
      JSON.parse(readFileSync(new URL("../../docs/extending/ruleset.schema.json", import.meta.url), "utf8")),
    );

    // ── Played by a game: its catalog file through the loader every turn and fight uses ──
    const registered = (await readRulesetRegistry(db)).get("local/ember-roads-house");
    assert.ok(registered, "registered");
    const definition = registered.versions?.get(1) ?? registered.definition;
    const header = definition.catalogs!.find((each) => each.id === firstCatalog.id)!;
    const loaded = await loadRulesetCatalogEntries(null, definition, header);
    assert.ok(loaded.ok && loaded.entries.length > 0, JSON.stringify(loaded).slice(0, 300));

    // ── Another ruleset with the same catalog file: kept once, and kept while either names it ──
    const sibling = await importFile(fileOf(packageDocs((docs) => (docs.ruleset.id = "ember-roads-sibling"))));
    assert.equal(sibling.json().status, "added", sibling.body);
    assert.equal(await storedCatalogs(), 2, "the sibling shares version 1's catalog file");

    // ── A version a game plays on is not removed alone; one no game pins is ──
    const chats = createChatsStorage(db);
    const pinned = await chats.create({ name: "On version 2", mode: "game", characterIds: [] });
    await chats.patchMetadata(pinned.id, {
      gameRuleset: { id: "local/ember-roads-house", version: 2, packageId: null, options: {} },
    });
    const refusedOne = await app.inject({
      method: "DELETE",
      url: "/api/game-rulesets?rulesetId=local/ember-roads-house&version=2",
    });
    assert.equal(refusedOne.statusCode, 409);
    assert.equal(refusedOne.json().code, "ruleset_in_use");

    // ── One version no game pins goes alone; the last version takes its catalog file with it ──
    const removeOne = await app.inject({
      method: "DELETE",
      url: "/api/game-rulesets?rulesetId=local/ember-roads-house&version=3",
    });
    assert.equal(removeOne.statusCode, 200, removeOne.body);
    assert.equal(await storedCatalogs(), 1, "the changed catalog went with version 3");
    assert.equal(
      (await app.inject({ method: "DELETE", url: "/api/game-rulesets?rulesetId=local/ember-roads-house&version=3" }))
        .statusCode,
      404,
    );
    // Every version, the game on one of them confirmed: the file stays while the sibling names it.
    const removeAll = await app.inject({
      method: "DELETE",
      url: "/api/game-rulesets?rulesetId=local/ember-roads-house&force=true",
    });
    assert.deepEqual([removeAll.json().removed, removeAll.json().games], [2, 1]);
    assert.equal(await storedCatalogs(), 1, "the sibling still names the shared file");
    const siblingCatalog = await app.inject({
      method: "GET",
      url: `/api/capability-packages/rulesets/catalog?rulesetId=local/ember-roads-sibling&catalogId=${firstCatalog.id}&version=1`,
    });
    assert.equal(siblingCatalog.statusCode, 200, siblingCatalog.body);
    await app.inject({ method: "DELETE", url: "/api/game-rulesets?rulesetId=local/ember-roads-sibling" });
    assert.equal(await storedCatalogs(), 0, "and goes with the last version that names it");

    // ── The JSON import still keeps its catalogs inline ──
    const asJson = await post("/import", { definition: JSON.stringify(packageDocs().ruleset) });
    assert.equal(asJson.statusCode, 400);
    assert.match(
      asJson.json().error,
      /carries its catalogs inline, as "entries", or comes as a package file \(\.ruleset\.json\)/,
    );

    // ── Checked without saving: issues where they point, the least capability API ──
    const checked = await post("/check", { definition: JSON.stringify(example) });
    assert.equal(checked.statusCode, 200, checked.body);
    assert.equal(checked.json().ok, true);
    assert.ok(checked.json().capabilityApi.minor >= 20, JSON.stringify(checked.json().capabilityApi));
    const broken = structuredClone(example);
    broken.sheet.skills[0].ability = "nope";
    const brokenCheck = (await post("/check", { definition: JSON.stringify(broken) })).json();
    assert.equal(brokenCheck.ok, false);
    assert.ok(
      brokenCheck.issues.some((issue: { path: string }) => issue.path.startsWith("sheet.skills.0")),
      JSON.stringify(brokenCheck.issues),
    );
    const fileCheck = (await post("/check", { package: good })).json();
    assert.equal(fileCheck.ok, true);
    assert.deepEqual(Object.keys(fileCheck.catalogs), [firstCatalog.id], "a package file comes back read");
    // What a catalog file holds counts toward the least API: a risky item in its own file asks for 1.79.
    const riskyDocs = packageDocs((docs) => {
      const outfitter = (docs.ruleset.catalogs as Array<Record<string, any>>).find((c) => c.id === "outfitter")!;
      const entries = structuredClone(outfitter.entries) as Array<Record<string, any>>;
      entries[0]!.item.risky = "It may spoil.";
      docs.catalogs.outfitter = { schemaVersion: 1, catalog: "outfitter", entries };
      delete outfitter.entries;
      outfitter.asset = "catalogs/outfitter.json";
    });
    const riskyCheck = (await post("/check", { package: fileOf(riskyDocs) })).json();
    assert.equal(riskyCheck.ok, true, JSON.stringify(riskyCheck.issues));
    assert.deepEqual(riskyCheck.capabilityApi, { major: 1, minor: 79 }, "read from the catalog file");
    // Reading a package costs work: only the Engine's own pages may ask.
    assert.equal(
      (await post("/check", { definition: JSON.stringify(example) }, { host: "evil.example" })).statusCode,
      421,
    );
    const fileRefused = (await post("/check", { package: many })).json();
    assert.equal(fileRefused.ok, false);
    assert.equal((await post("/check", { package: "not a package" })).statusCode, 400);
    // A zip is not a ruleset package any more, by either route.
    const zipBytes = "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==";
    assert.equal((await post("/check", { zip: zipBytes })).statusCode, 400);
    assert.equal((await post("/import-package", { zip: zipBytes })).statusCode, 400);
    // A key that would reach an object's prototype is refused by the body parser itself.
    const poisoned = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/check",
      headers: { "content-type": "application/json" },
      payload: '{"package":{"format":"marinara-ruleset","__proto__":{"ok":true}}}',
    });
    assert.equal(poisoned.statusCode, 400);
    assert.equal(await storedCatalogs(), 0, "checking keeps nothing");
  } finally {
    await app.close();
    await closeDB();
  }
  console.log("Ruleset package files: read whole or refused, kept as data with their catalog files, never run.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
