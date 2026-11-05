/**
 * A catalog ruleset's language packs (Capability API 1.811). Its translations are not inside its
 * `.ruleset.json`: the catalog entry lists `locales: { <lang>: { url, sha256, bytes, name?, description? } }`,
 * one `<id>-<version>.<lang>.json` per language, holding what a ruleset file's `locales/<lang>.json` holds.
 *
 *   - The entry is read strictly: a language code (never English), an https URL named for the version and
 *     language, a sha256, a size within 8 MB, at most 40, and only on a ruleset declaring 1.811.
 *   - An install fetches the main file, then the one pack in the Engine's language, and keeps it in the
 *     installed version's folder. A change of language fetches that language's pack and removes the old.
 *   - Offline, with none listed, or with a pack that is not the file listed (size, checksum, language,
 *     no ruleset section), the ruleset reads in English and nothing is thrown.
 *   - An update leaves the version kept for rollback without a pack; after a rollback the next change of
 *     language (each page opening sends one) fetches it again if the catalog lists it.
 *   - A catalog ruleset carrying `locales/<lang>.json` inside its file is refused, and such a file in an
 *     installed version is never read.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-language-packs-"));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = "silent";

const { capabilityPackageManifestSchema, capabilityCatalogPackageSchema, parseCapabilityCatalogWithCompat } =
  await import("../../packages/shared/src/schemas/capability-package.schema.js");
const { capabilityPackageManager, installCatalogPackageForTests, getCapabilityPackageArtifactSourceIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");
const { openRulesetLocale } = await import("../../packages/server/src/services/game/ruleset-catalog.service.js");

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const ARTIFACTS = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts";
const ID = "ember-roads-tongues";
const VERSIONS = join(dataDir, "capability-packages", "versions", ID);

const ruleset = JSON.parse(
  readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
ruleset.id = ID;
const english = ruleset.name as string;
const rulesetData = Buffer.from(JSON.stringify(ruleset));

function manifestOf(version: string, paths: Array<{ path: string; data: Buffer }>, minor = 811) {
  return capabilityPackageManifestSchema.parse({
    schemaVersion: 2,
    id: ID,
    name: "Ember Roads (tongues)",
    version,
    description: "Roads of embers.",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: paths.map((file) => file.path) } },
    files: paths.map((file) => ({ path: file.path, sha256: sha256(file.data), bytes: file.data.length })),
    permissions: [],
    restartRequired: false,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  });
}
const rulesetFile = (manifest: unknown, files: Array<{ path: string; data: Buffer }>) =>
  Buffer.from(
    JSON.stringify({
      format: "marinara-ruleset",
      version: 1,
      manifest,
      files: Object.fromEntries(files.map((file) => [file.path, file.data.toString("base64")])),
    }),
  );
const packOf = (locale: string, strings: Record<string, string>, edit: Record<string, unknown> = {}) =>
  Buffer.from(
    JSON.stringify({
      _meta: { locale, direction: "ltr" },
      package: { name: strings[english] ?? english },
      ruleset: strings,
      ...edit,
    }),
  );

const packs = {
  ru: packOf("ru", { [english]: "Угольные дороги", Goblin: "Гоблин" }),
  pt: packOf("pt", { [english]: "Estradas de Brasa" }),
};
/** What the "network" serves, by URL, and every URL asked for. */
const served = new Map<string, Buffer>();
const fetched: string[] = [];
let offline = false;
const download = async (url: string, maximum: number) => {
  fetched.push(url);
  if (offline) throw new Error("offline");
  const data = served.get(url);
  if (!data) throw new Error(`HTTP 404 ${url}`);
  if (data.length > maximum) throw new Error("too large");
  return data;
};

/** A catalog entry of one version, with packs listed as given (each its real sha256 and size unless set). */
function entryOf(
  version: string,
  listed: Record<string, { data: Buffer; sha256?: string; bytes?: number; name?: string }> = {},
) {
  const files = [{ path: "ruleset.json", data: rulesetData }];
  const manifest = manifestOf(version, files);
  const bytes = rulesetFile(manifest, files);
  const url = `${ARTIFACTS}/${ID}-${version}.ruleset.json`;
  served.set(url, bytes);
  const locales = Object.fromEntries(
    Object.entries(listed).map(([locale, pack]) => {
      const packUrl = `${ARTIFACTS}/${ID}-${version}.${locale}.json`;
      served.set(packUrl, pack.data);
      return [
        locale,
        {
          url: packUrl,
          sha256: pack.sha256 ?? sha256(pack.data),
          bytes: pack.bytes ?? pack.data.length,
          ...(pack.name ? { name: pack.name } : {}),
        },
      ];
    }),
  );
  return capabilityCatalogPackageSchema.parse({
    manifest,
    category: "misc",
    artifact: { url, sha256: sha256(bytes), bytes: bytes.length },
    ...(Object.keys(locales).length ? { locales } : {}),
  });
}
const catalogOf =
  (...entries: Array<ReturnType<typeof entryOf>>) =>
  async () => ({
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    packages: entries,
  });
const packsIn = (version: string) =>
  existsSync(join(VERSIONS, version))
    ? readdirSync(join(VERSIONS, version)).filter((name) => /\.[a-zA-Z-]+\.json$/.test(name) && name.startsWith(ID))
    : [];
const stringsIn = async (locale: string) => {
  const opened = await openRulesetLocale(ID, ruleset as never, locale);
  if (!opened) return null;
  const read = await opened.read();
  assert.ok(read.ok);
  return { locale: opened.locale, strings: read.strings };
};

try {
  // ── The catalog entry's packs, read strictly ──
  {
    const good = entryOf("1.0.0", { ru: { data: packs.ru, name: "Угольные дороги" } });
    assert.equal(good.locales?.ru?.name, "Угольные дороги");
    const raw = JSON.parse(JSON.stringify(good)) as Record<string, any>;
    const refused = (edit: (entry: Record<string, any>) => void, pattern: RegExp, message: string) => {
      const entry = structuredClone(raw);
      edit(entry);
      const read = capabilityCatalogPackageSchema.safeParse(entry);
      assert.equal(read.success, false, message);
      assert.match(JSON.stringify(read.error?.issues), pattern, message);
    };
    refused((entry) => (entry.locales.en = entry.locales.ru), /English is the ruleset itself/, "no English pack");
    refused((entry) => (entry.locales.RU = entry.locales.ru), /not a language a pack is listed under/, "a code");
    refused(
      (entry) => (entry.locales.ru.url = entry.locales.ru.url.replace("https:", "http:")),
      /over https/,
      "https only",
    );
    refused((entry) => (entry.locales.ru.sha256 = "ABC"), /sha256/, "a sha256");
    refused((entry) => (entry.locales.ru.bytes = 0), /bytes/, "a size");
    refused((entry) => (entry.locales.ru.bytes = 8 * 1024 * 1024 + 1), /bytes/, "within 8 MB");
    refused((entry) => (entry.locales.ru.extra = 1), /unrecognized|Unrecognized/, "nothing else in a pack");
    // A card name or description the Engine cannot show is dropped, so that language's card reads in
    // English while the package and its pack stay listed.
    {
      const entry = structuredClone(raw);
      entry.locales.ru.description = "д".repeat(2001);
      entry.locales.ru.name = "";
      const read = capabilityCatalogPackageSchema.safeParse(entry);
      assert.ok(read.success, "an over-long card description keeps the package");
      assert.equal(read.data.locales?.ru?.description, undefined);
      assert.equal(read.data.locales?.ru?.name, undefined);
      assert.equal(read.data.locales?.ru?.sha256, raw.locales.ru.sha256);
    }
    refused(
      (entry) => (entry.locales.ru.url = `${ARTIFACTS}/${ID}-0.9.0.ru.json`),
      /is not ember-roads-tongues-1\.0\.0\.ru\.json/,
      "the version's own pack",
    );
    refused(
      (entry) => {
        for (let n = 0; n < 41; n++) entry.locales[`x${String.fromCharCode(97 + (n % 26))}${n}`] = entry.locales.ru;
      },
      /at most 40/,
      "at most 40",
    );
    refused(
      (entry) => (entry.manifest.capabilityApi.minor = 810),
      /capabilityApi 1\.811/,
      "packs need a ruleset of 1.811",
    );
    // An older Engine's catalog read drops such an entry; this one keeps it, and drops a bad one alone.
    const parsed = parseCapabilityCatalogWithCompat({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      packages: [raw, { ...raw, locales: { en: raw.locales.ru } }],
    });
    assert.equal(parsed.catalog.packages.length, 1);
    assert.equal(parsed.droppedEntries, 1);
    // The official catalog names each pack canonically, as it does the artifact.
    const official = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/catalog/v2/catalog.json";
    const canonical = {
      ...good,
      artifact: { ...good.artifact, url: `${ARTIFACTS}/${ID}-1.0.0.zip` },
    };
    assert.equal(getCapabilityPackageArtifactSourceIssue(canonical, official), null);
    assert.match(
      getCapabilityPackageArtifactSourceIssue(
        { ...canonical, locales: { ru: { ...good.locales!.ru!, url: `https://example.com/${ID}-1.0.0.ru.json` } } },
        official,
      ) ?? "",
      /canonical Marinara-Agents ru language pack URL/,
    );
  }

  // ── Installed in Russian: the main file, then the Russian pack alone ──
  await capabilityPackageManager.setRulesetLanguage(
    "ru",
    async () => {
      throw new Error("nothing installed: the catalog is not needed");
    },
    download,
  );
  const v1 = entryOf("1.0.0", { ru: { data: packs.ru }, pt: { data: packs.pt } });
  fetched.length = 0;
  const installed = await installCatalogPackageForTests(v1, download);
  assert.equal(installed.status, "active");
  assert.deepEqual(fetched, [v1.artifact.url, v1.locales!.ru!.url], "only the active language's pack is fetched");
  assert.deepEqual(packsIn("1.0.0"), [`${ID}-1.0.0.ru.json`]);
  assert.deepEqual(readFileSync(join(VERSIONS, "1.0.0", `${ID}-1.0.0.ru.json`)), packs.ru);
  assert.equal((await stringsIn("ru"))?.strings.Goblin, "Гоблин");
  assert.equal(await stringsIn("pt"), null);

  // ── The language changes: the new pack fetched, the old removed ──
  fetched.length = 0;
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("pt-BR", catalogOf(v1), download), {
    [ID]: "stored",
  });
  assert.deepEqual(fetched, [v1.locales!.pt!.url], "a kind of a language fetches that language's pack");
  assert.deepEqual(packsIn("1.0.0"), [`${ID}-1.0.0.pt.json`]);
  const brazil = await stringsIn("pt-BR");
  assert.equal(brazil?.locale, "pt");
  assert.equal(brazil?.strings[english], "Estradas de Brasa");
  assert.equal(await stringsIn("ru"), null, "the old language is gone");
  // Already the file listed: nothing fetched.
  fetched.length = 0;
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("pt-BR", catalogOf(v1), download), {
    [ID]: "kept",
  });
  assert.deepEqual(fetched, []);
  // A catalog that no longer lists this version leaves the pack kept in the language.
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("pt-BR", catalogOf(), download), {
    [ID]: "kept",
  });

  // ── Offline: what is kept in the language stays; another language reads in English ──
  const unreachable = async () => {
    throw new Error("offline");
  };
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("pt", unreachable, download), { [ID]: "kept" });
  assert.equal((await stringsIn("pt"))?.locale, "pt");
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", unreachable, download), { [ID]: "none" });
  assert.deepEqual(packsIn("1.0.0"), []);
  assert.equal(await stringsIn("ru"), null, "English, without an error");
  // The catalog read, the pack not: English again, and the next change tries again.
  offline = true;
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(v1), download), {
    [ID]: "failed",
  });
  offline = false;
  assert.equal(await stringsIn("ru"), null);
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(v1), download), {
    [ID]: "stored",
  });
  assert.equal((await stringsIn("ru"))?.locale, "ru");
  // A revised pack listed but not to be had: the one kept stays until a replacement is stored.
  {
    const revised = entryOf("1.0.0", { ru: { data: packOf("ru", { [english]: "Новые дороги" }) } });
    offline = true;
    assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(revised), download), {
      [ID]: "failed",
    });
    offline = false;
    assert.deepEqual(packsIn("1.0.0"), [`${ID}-1.0.0.ru.json`]);
    assert.equal((await stringsIn("ru"))?.locale, "ru");
  }
  // A language with no pack listed: English, and the old one removed.
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("de", catalogOf(v1), download), {
    [ID]: "none",
  });
  assert.deepEqual(packsIn("1.0.0"), []);
  // English needs no pack and no catalog.
  await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(v1), download);
  let asked = false;
  assert.deepEqual(
    await capabilityPackageManager.setRulesetLanguage(
      "en",
      async () => {
        asked = true;
        return catalogOf(v1)();
      },
      download,
    ),
    { [ID]: "none" },
  );
  assert.equal(asked, false);
  assert.deepEqual(packsIn("1.0.0"), []);

  // ── A pack that is not the file listed is refused, and the ruleset reads in English ──
  /** Refused when the catalog lists `listed` and the network serves `instead` (or what is listed). */
  const refusedPack = async (listed: { data: Buffer; sha256?: string; bytes?: number }, instead?: Buffer) => {
    const entry = entryOf("1.0.0", { ru: listed });
    if (instead) served.set(entry.locales!.ru!.url, instead);
    assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(entry), download), {
      [ID]: "failed",
    });
    assert.deepEqual(packsIn("1.0.0"), []);
    assert.equal(await stringsIn("ru"), null);
  };
  const tampered = packOf("ru", { [english]: "Подменённые дороги" });
  await refusedPack({ data: packs.ru, bytes: tampered.length }, tampered); // the size listed, not its checksum
  await refusedPack({ data: packs.ru }, Buffer.concat([packs.ru, Buffer.from(" ")])); // another size
  await refusedPack({ data: packOf("de", { [english]: "Glutstraßen" }) }); // another language
  await refusedPack({ data: Buffer.from(JSON.stringify({ _meta: { locale: "ru" } })) }); // no ruleset section
  await refusedPack({ data: packOf("ru", { [english]: 1 } as never) }); // not strings
  await refusedPack({ data: Buffer.from("not json") });
  // An install with a bad pack still installs, in English.
  {
    const bad = entryOf("1.0.0", { ru: { data: packs.ru, sha256: "0".repeat(64) } });
    const again = await installCatalogPackageForTests(bad, download);
    assert.equal(again.status, "active");
    assert.deepEqual(packsIn("1.0.0"), []);
  }

  // ── An update: the version kept for rollback holds no pack; a rollback fetches it again ──
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(v1), download), {
    [ID]: "stored",
  });
  assert.deepEqual(packsIn("1.0.0"), [`${ID}-1.0.0.ru.json`]);
  const v2 = entryOf("1.1.0", { ru: { data: packOf("ru", { [english]: "Угольные пути" }) } });
  fetched.length = 0;
  const updated = await installCatalogPackageForTests(v2, download);
  assert.equal(updated.previousVersion, "1.0.0");
  assert.deepEqual(fetched, [v2.artifact.url, v2.locales!.ru!.url]);
  assert.deepEqual(packsIn("1.1.0"), [`${ID}-1.1.0.ru.json`]);
  assert.ok(existsSync(join(VERSIONS, "1.0.0", "ruleset.json")), "the previous version is kept");
  assert.deepEqual(packsIn("1.0.0"), [], "but holds no pack");
  assert.equal((await stringsIn("ru"))?.strings[english], "Угольные пути");
  await capabilityPackageManager.rollbackRuntime(ID);
  assert.equal((await capabilityPackageManager.installed()).find((item) => item.id === ID)?.version, "1.0.0");
  assert.equal(await stringsIn("ru"), null, "rolled back, in English until the pack comes again");
  assert.deepEqual(await capabilityPackageManager.setRulesetLanguage("ru", catalogOf(v1), download), {
    [ID]: "stored",
  });
  assert.deepEqual(packsIn("1.1.0"), []);
  assert.equal((await stringsIn("ru"))?.strings[english], "Угольные дороги");

  // ── Translations inside the file: refused from the catalog, and never read from an installed version ──
  {
    const locale = { path: "locales/ru.json", data: packs.ru };
    const files = [{ path: "ruleset.json", data: rulesetData }, locale];
    const manifest = manifestOf("1.2.0", files);
    const bytes = rulesetFile(manifest, files);
    let downloaded = false;
    await assert.rejects(
      installCatalogPackageForTests(
        {
          manifest,
          category: "misc",
          artifact: { url: `${ARTIFACTS}/${ID}-1.2.0.ruleset.json`, sha256: sha256(bytes), bytes: bytes.length },
        } as never,
        async () => {
          downloaded = true;
          return bytes;
        },
      ),
      /carries its translations inside its file\. A catalog ruleset lists them as language packs\./,
    );
    assert.equal(downloaded, false, "refused before anything is downloaded");
    await capabilityPackageManager.setRulesetLanguage("en", catalogOf(v1), download);
    mkdirSync(join(VERSIONS, "1.0.0", "locales"), { recursive: true });
    writeFileSync(join(VERSIONS, "1.0.0", "locales", "ru.json"), packs.ru);
    assert.equal(await capabilityPackageManager.rulesetLocaleAsset(ID, "ru"), null, "locales/ru.json is not read");
    assert.equal(await stringsIn("ru"), null);
  }

  // ── The page tells the Engine its language: the route, and the page's hook on opening and on a change ──
  {
    const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
    const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
    const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
    const app = Fastify();
    app.decorate("db", await getDB());
    await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
    try {
      const told = await app.inject({
        method: "POST",
        url: "/api/capability-packages/rulesets/language",
        payload: { locale: "en" },
      });
      assert.equal(told.statusCode, 200, told.body);
      assert.deepEqual(told.json(), { locale: "en", rulesets: { [ID]: "none" } });
      const bad = await app.inject({
        method: "POST",
        url: "/api/capability-packages/rulesets/language",
        payload: { locale: "../x" },
      });
      assert.ok(bad.statusCode >= 400);
    } finally {
      await app.close();
      await closeDB();
    }
    const provider = readFileSync(
      new URL("../../packages/client/src/localization/LocalizationProvider.tsx", import.meta.url),
      "utf8",
    );
    assert.match(provider, /syncRulesetLanguage\(resolvedLanguage, queryClient\)/);
    const hooks = readFileSync(
      new URL("../../packages/client/src/hooks/use-capability-packages.ts", import.meta.url),
      "utf8",
    );
    assert.match(hooks, /"\/capability-packages\/rulesets\/language", \{ locale \}/);
    assert.equal(
      (hooks.match(/locale: rulesetPackLanguage\(\)/g) ?? []).length,
      3,
      "installs and file imports send it",
    );
  }

  // ── The store card: a ruleset's name and description in the page's language, from the catalog ──
  {
    const { resolveCapabilityCatalogEntryDisplay } =
      await import("../../packages/client/src/lib/capability-package-localization.js");
    const listed = entryOf("1.0.0", { ru: { data: packs.ru, name: "Угольные дороги" } });
    listed.locales!.ru!.description = "Дороги углей.";
    assert.deepEqual(
      (({ name, description }) => ({ name, description }))(resolveCapabilityCatalogEntryDisplay(listed, "ru-RU")),
      { name: "Угольные дороги", description: "Дороги углей." },
    );
    const tooLong = structuredClone(listed) as Record<string, any>;
    tooLong.locales.ru.description = "д".repeat(2001);
    const kept = capabilityCatalogPackageSchema.parse(tooLong);
    assert.equal(resolveCapabilityCatalogEntryDisplay(kept, "ru").description, "Roads of embers.");
    assert.equal(resolveCapabilityCatalogEntryDisplay(kept, "ru").name, "Угольные дороги");
    assert.equal(resolveCapabilityCatalogEntryDisplay(listed, "de").name, "Ember Roads (tongues)");
    assert.equal(resolveCapabilityCatalogEntryDisplay(listed, "en").description, "Roads of embers.");
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(
  "Ruleset language packs: listed strictly, fetched in the Engine's language alone, swapped on a change, English when none checks out.",
);
