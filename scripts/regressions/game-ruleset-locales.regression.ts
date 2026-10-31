/**
 * A ruleset's translations in a ruleset package file a player shares (Capability API 1.811):
 * `locales/<language>.json` beside its ruleset, the package localization catalog's shape with a `ruleset`
 * section of display strings, each keyed by its English word for word. (A catalog ruleset's come as
 * language packs instead: ruleset-language-packs.regression.ts.)
 *
 *   - Read strictly: the language its name says, strings only, nothing else in the file; one not
 *     translated yet is left out, and a package's own English listing translates nothing.
 *   - A package file carries them only at 1.811; the import keeps only the one in the page's language
 *     (or the one it is a kind of) under its version, and importing the version again in another
 *     language replaces it (display only, no part of the version).
 *   - The strings route answers the language asked, else the one it is a kind of ("pt" for "pt-BR"),
 *     else nothing, with a validator.
 *   - The fight screen swaps them in as it draws: numbered names and lists too, never an id.
 *   - What the view keeps as written but a player reads (Spanish playtest 2026-10-26): what a creature
 *     is ("Humanoid", "Construct", kept under `kind`/`type`), the budgets' names and letters read off
 *     the ruleset itself, and its own short name for its defense.
 *   - The character sheet (and the party's shared sheet) reads the same translation as the fight
 *     screen: spells, features, conditions, items, tabs, pools and rests in the player's language,
 *     while every command it sends still names the ruleset's own ids.
 *   - A line the Engine joins out of the ruleset's words ("Languages: Common, Elvish", "Wish: Fireball")
 *     is read label first, then name by name, as the translation is keyed by each exact English string.
 *   - A language pack picked with the package file (`<id>-<version>.<lang>.json`, as a catalog publishes
 *     it) is read as the file's own translation in that language, standing over one inside it; one of
 *     another ruleset or version, renamed, or not a pack is refused with why, keeping what was there.
 *   - The card editor's sheet and its guided builder (Spanish playtest 2026-10-27) show the ruleset's
 *     words translated, steps, choices, field options and suggestions alike, writing its own words.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  capabilityPackageManifestSchema,
  readRulesetLocaleFile,
  rulesetLocaleOfAssetPath,
  supportedCapabilityApi,
} from "../../packages/shared/src/index.js";
import {
  rulesetTextLookup,
  translateRulesetView,
  RULESET_TEXT_AS_IS,
} from "../../packages/client/src/lib/ruleset-text.js";

const { rulesetBudgetMarks } = await import("../../packages/client/src/components/game/RulesetBudgetPip.js");
const { rulesetKindLine } = await import("../../packages/client/src/components/game/RulesetTurnOrder.js");

const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-locales-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";

assert.ok(supportedCapabilityApi.minor >= 811);

// ── The file, read strictly ──
{
  const ok = readRulesetLocaleFile(
    {
      $schema: "../schema.json",
      _meta: { locale: "ru", direction: "ltr" },
      package: { name: "5e" },
      ruleset: { Prone: "Лежащий", Grappled: "", Fireball: "Огненный шар" },
    },
    "ru",
  );
  assert.ok(ok.ok);
  assert.deepEqual(
    { ...(ok as { strings: Record<string, string> }).strings },
    { Prone: "Лежащий", Fireball: "Огненный шар" },
    "one not translated yet is left out",
  );
  const own = readRulesetLocaleFile({ _meta: { locale: "en" }, package: { name: "5e" } }, "en");
  assert.ok(own.ok && Object.keys(own.strings).length === 0, "a package's own English listing translates nothing");
  const refused = (document: unknown, locale = "ru") => {
    const read = readRulesetLocaleFile(document, locale);
    assert.equal(read.ok, false, JSON.stringify(document));
    return (read as { issue: string }).issue;
  };
  assert.match(refused({ _meta: { locale: "de" }, ruleset: {} }), /_meta.locale is not "ru"/);
  assert.match(refused({ _meta: { locale: "ru" }, ruleset: {}, code: "x" }), /holds "code"/);
  assert.match(refused({ _meta: { locale: "ru" }, ruleset: { Prone: 1 } }), /is not text/);
  assert.match(refused({ _meta: { locale: "ru", direction: "up" }, ruleset: {} }), /direction/);
  assert.match(refused({ _meta: { locale: "ru" }, ruleset: [] }), /not a section of strings/);
  const proto = readRulesetLocaleFile(JSON.parse('{"_meta":{"locale":"ru"},"ruleset":{"__proto__":"x"}}'), "ru");
  assert.ok(proto.ok && proto.strings["__proto__"] === "x" && Object.getPrototypeOf(proto.strings) === null);
  assert.equal(rulesetLocaleOfAssetPath("locales/pt-BR.json"), "pt-BR");
  assert.equal(rulesetLocaleOfAssetPath("locales/zh-Hans.json"), "zh-Hans");
  for (const path of ["locales/RU.json", "locales/../x.json", "locales/ru.txt", "locales/r.json", "ru.json"])
    assert.equal(rulesetLocaleOfAssetPath(path), null, path);
}

// ── A package of the ember-roads example with translations ──
const example = JSON.parse(
  readFileSync(new URL("../../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"),
) as Record<string, any>;
example.id = "ember-roads-tongues";
const english = example.name as string;
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const localeFile = (locale: string, strings: Record<string, string>) => ({
  name: `locales/${locale}.json`,
  data: Buffer.from(JSON.stringify({ _meta: { locale }, ruleset: strings })),
});
function packageFile(locales: Array<{ name: string; data: Buffer }>, minor = 811) {
  const files = [{ name: "ruleset.json", data: Buffer.from(JSON.stringify(example)) }, ...locales];
  const manifest = {
    schemaVersion: 2,
    id: "ember-roads-tongues",
    name: "Ember Roads (tongues)",
    version: "1.0.0",
    description: "",
    engine: { min: "2.4.0", maxExclusive: "3.0.0" },
    kind: ["ruleset"],
    entrypoints: {},
    contributions: { assets: { paths: files.map((file) => file.name) } },
    files: files.map((file) => ({ path: file.name, sha256: sha256(file.data), bytes: file.data.length })),
    permissions: [],
    restartRequired: false,
    capabilityApi: { major: 1, minor },
    builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
  };
  return {
    format: "marinara-ruleset",
    version: 1,
    manifest,
    files: Object.fromEntries(files.map((file) => [file.name, file.data.toString("base64")])),
  };
}

// The manifest gate: a ruleset file's translations need 1.811 (no longer 1.806); another package's
// locales/ folder is its own.
{
  const early = packageFile([localeFile("ru", { [english]: "Угольные дороги" })], 802).manifest;
  const read = capabilityPackageManifestSchema.safeParse(early);
  assert.equal(read.success, false);
  assert.match(
    JSON.stringify(read.error?.issues),
    /translations \(locales\/<language>.json\) require schemaVersion 2 and capabilityApi 1.811/,
  );
  assert.equal(
    capabilityPackageManifestSchema.safeParse(packageFile([localeFile("ru", {})], 798).manifest).success,
    false,
    "1.806 no longer carries translations",
  );
  const notRuleset = {
    ...early,
    kind: ["writer"],
    contributions: { assets: { paths: ["locales/ru.json"] } },
    files: [early.files[1]],
  };
  assert.ok(
    !JSON.stringify(capabilityPackageManifestSchema.safeParse(notRuleset).error?.issues ?? []).includes("1.811"),
  );
}

const { default: Fastify } = await import("../../packages/server/node_modules/fastify/fastify.js");
const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
const { setCustomAgentImportsEnabled } =
  await import("../../packages/server/src/services/agents/custom-agent-import-policy.service.js");
const { gameRulesetsRoutes } = await import("../../packages/server/src/routes/game-rulesets.routes.js");
const { capabilityPackagesRoutes } = await import("../../packages/server/src/routes/capability-packages.routes.js");
const { gameRulesetCatalogs } = await import("../../packages/server/src/db/schema/index.js");
const { readRulesetPackageFile } = await import("../../packages/server/src/services/game/ruleset-package-file.js");

try {
  const db = await getDB();
  const app = Fastify({ bodyLimit: 64 * 1024 * 1024 });
  app.decorate("db", db);
  await app.register(gameRulesetsRoutes, { prefix: "/api/game-rulesets" });
  await app.register(capabilityPackagesRoutes, { prefix: "/api/capability-packages" });
  try {
    await setCustomAgentImportsEnabled(db, true);
    const ru = localeFile("ru", { [english]: "Угольные дороги", Goblin: "Гоблин" });
    const pt = localeFile("pt", { [english]: "Estradas de Brasa" });
    const en = {
      name: "locales/en.json",
      data: Buffer.from(JSON.stringify({ _meta: { locale: "en" }, package: { name: english } })),
    };
    const file = packageFile([en, pt, ru]);

    // ── Read: each translation's strings; the English listing is not kept ──
    const read = readRulesetPackageFile(file);
    assert.ok(read.ok, JSON.stringify(read).slice(0, 400));
    assert.deepEqual(Object.keys(read.locales).sort(), ["pt", "ru"]);
    assert.equal(JSON.parse(read.locales.ru!)[english], "Угольные дороги");
    const early = readRulesetPackageFile(packageFile([ru], 802));
    assert.equal(early.ok, false);
    assert.match((early as { issues: string[] }).issues.join(" "), /1.811/);
    const wrong = readRulesetPackageFile(
      packageFile([
        { name: "locales/ru.json", data: Buffer.from(JSON.stringify({ _meta: { locale: "de" }, ruleset: {} })) },
      ]),
    );
    assert.equal(wrong.ok, false);
    assert.match((wrong as { issues: string[] }).issues.join(" "), /_meta.locale is not "ru"/);

    // ── A check names the least API, 1.811 with translations, and every language the file carries ──
    const checked = await app.inject({ method: "POST", url: "/api/game-rulesets/check", payload: { package: file } });
    assert.equal(checked.statusCode, 200, checked.body);
    assert.deepEqual(checked.json().capabilityApi, { major: 1, minor: 811 });
    assert.deepEqual(checked.json().locales, ["pt", "ru"]);
    const review = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: file, dryRun: true, locale: "ru" },
    });
    assert.deepEqual(review.json().locales, ["pt", "ru"], "the review lists what the file carries");

    // ── Imported in Russian: only Russian is kept ──
    const imported = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: file, locale: "ru" },
    });
    assert.equal(imported.statusCode, 200, imported.body);
    assert.deepEqual(imported.json().locales, ["ru"]);
    const strings = (locale: string, headers: Record<string, string> = {}) =>
      app.inject({
        method: "GET",
        url: `/api/capability-packages/rulesets/strings?rulesetId=local/ember-roads-tongues&version=1&locale=${locale}`,
        headers,
      });
    const inRussian = await strings("ru");
    assert.equal(inRussian.statusCode, 200, inRussian.body);
    assert.equal(inRussian.json().locale, "ru");
    assert.equal(inRussian.json().strings.Goblin, "Гоблин");
    assert.ok(inRussian.headers.etag);
    assert.equal((await strings("ru", { "if-none-match": String(inRussian.headers.etag) })).statusCode, 304);
    assert.equal((await strings("pt")).json().locale, null, "the languages not the page's are not kept");
    assert.deepEqual((await strings("de")).json(), {
      rulesetId: "local/ember-roads-tongues",
      version: 1,
      locale: null,
      strings: {},
    });
    assert.equal((await strings("en")).json().locale, null);
    assert.equal((await strings("../x")).statusCode >= 400, true);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/capability-packages/rulesets/strings?rulesetId=local/nothing&locale=ru",
        })
      ).statusCode,
      404,
    );

    // ── Imported again in Brazilian Portuguese: the language it is a kind of replaces Russian ──
    const stored = async () => ((await db.select().from(gameRulesetCatalogs)) as unknown[]).length;
    const before = await stored();
    const inPortuguese = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: file, locale: "pt-BR" },
    });
    assert.equal(inPortuguese.statusCode, 200, inPortuguese.body);
    assert.deepEqual(inPortuguese.json().locales, ["pt"]);
    const brazil = (await strings("pt-BR")).json();
    assert.equal(brazil.locale, "pt", "a kind of a language reads that language");
    assert.equal(brazil.strings[english], "Estradas de Brasa");
    assert.equal((await strings("ru")).json().locale, null, "Russian went");
    assert.equal(await stored(), before, "one language kept at a time");

    // ── The same version again in Russian, with a corrected translation: the translation is replaced ──
    const corrected = packageFile([en, pt, localeFile("ru", { [english]: "Угольные пути" })]);
    const again = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: corrected, locale: "ru" },
    });
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(again.json().status, "unchanged", "the same version: translations are no part of it");
    const now = (await strings("ru")).json();
    assert.equal(now.strings[english], "Угольные пути");
    assert.equal(now.strings.Goblin, undefined);
    assert.equal(await stored(), before, "the old translation goes, the new one is kept once");
    assert.equal((await strings("pt")).json().locale, null);
    // A package of it with no translations leaves what it had.
    const bare = packageFile([], 803);
    bare.manifest.capabilityApi.minor = 79;
    const plain = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: bare },
    });
    assert.equal(plain.statusCode, 200, plain.body);
    assert.equal((await strings("ru")).json().strings[english], "Угольные пути");
    // One carrying translations but none in the page's language (English, the Engine's default) keeps
    // none of them, and leaves the translation already kept alone (laptop 2026-10-27: French imported
    // while playing in Spanish took the Spanish away).
    const inEnglish = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: corrected },
    });
    assert.equal(inEnglish.statusCode, 200, inEnglish.body);
    assert.deepEqual(inEnglish.json().locales, []);
    assert.equal(inEnglish.json().status, "unchanged");
    assert.equal((await strings("ru")).json().strings[english], "Угольные пути");

    // ── A language pack picked with the file (installed from a file, 2026-10-27): kept as its own ──
    const pack = (locale: string, ruleset: Record<string, string>) => ({ _meta: { locale }, ruleset });
    const withPacks = (packs: Array<{ name: string; document: unknown }>, extra: Record<string, unknown> = {}) =>
      app.inject({
        method: "POST",
        url: "/api/game-rulesets/import-package",
        payload: { package: bare, locale: "ru", packs, ...extra },
      });
    const russianPack = {
      name: "ember-roads-tongues-1.0.0.ru.json",
      document: pack("ru", { [english]: "Тропы углей" }),
    };
    const packReview = await withPacks([russianPack], { dryRun: true });
    assert.equal(packReview.statusCode, 200, packReview.body);
    assert.deepEqual(packReview.json().locales, ["ru"], "the review lists the pack's language");
    const packed = await withPacks([russianPack]);
    assert.equal(packed.statusCode, 200, packed.body);
    assert.equal(packed.json().status, "unchanged", "the same version, now with its translation");
    assert.deepEqual(packed.json().locales, ["ru"]);
    assert.equal((await strings("ru")).json().strings[english], "Тропы углей");
    // A pack stands over the same language inside the file.
    const over = await app.inject({
      method: "POST",
      url: "/api/game-rulesets/import-package",
      payload: { package: corrected, locale: "ru", packs: [russianPack] },
    });
    assert.equal(over.statusCode, 200, over.body);
    assert.equal((await strings("ru")).json().strings[english], "Тропы углей");
    // Refused, keeping what was there: another ruleset's or version's pack, one renamed, not a pack, broken.
    for (const [packs, why] of [
      [
        [{ ...russianPack, name: "ember-roads-tongues-0.9.0.ru.json" }],
        /its ru pack is ember-roads-tongues-1.0.0.ru.json/,
      ],
      [[{ ...russianPack, name: "other-ruleset-1.0.0.ru.json" }], /not a language pack of ember-roads-tongues 1.0.0/],
      [[{ name: "ember-roads-tongues-1.0.0.ru.json", document: { ruleset: {} } }], /not a ruleset language pack/],
      [[{ ...russianPack, document: { ...pack("ru", {}), code: "x" } }], /holds "code"/],
      [[{ ...russianPack, document: { _meta: { locale: "ru" } } }], /has no ruleset section/],
    ] as const) {
      const refused = await withPacks([...packs]);
      assert.equal(refused.statusCode, 400, refused.body);
      assert.match(refused.json().error, why);
    }
    assert.equal((await strings("ru")).json().strings[english], "Тропы углей");
    const tooMany = await withPacks(Array.from({ length: 5 }, () => russianPack));
    assert.equal(tooMany.statusCode, 400, "a few packs at most");
  } finally {
    await app.close();
    await closeDB();
  }
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

// ── On screen: swapped as it is drawn, ids never ──
{
  const text = rulesetTextLookup({
    Goblin: "Гоблин",
    Prone: "Лежащий",
    "Fire Bolt": "Огненный снаряд",
    "1st-level slots": "Espacios de nivel 1",
    "1st-level slot": "Espacio de nivel 1",
  });
  assert.equal(text("Goblin"), "Гоблин");
  assert.equal(text("Goblin 2"), "Гоблин 2", "a fight's number on a translated name");
  assert.equal(text("Goblin, Prone"), "Гоблин, Лежащий");
  assert.equal(text("Bram"), "Bram");
  assert.equal(text("constructor"), "constructor", "nothing off a prototype");
  assert.equal(rulesetTextLookup({}), RULESET_TEXT_AS_IS);
  // A line joined out of the ruleset's words reads its label and each name on its own.
  const joined = rulesetTextLookup({
    Languages: "Языки",
    Common: "Общий",
    Elvish: "Эльфийский",
    Wish: "Желание",
    Fireball: "Огненный шар",
  });
  assert.equal(joined("Languages: Common, Elvish"), "Языки: Общий, Эльфийский");
  assert.equal(joined("Wish: Fireball"), "Желание: Огненный шар");
  assert.equal(joined("Languages: Common, Kaela's cant"), "Языки: Общий, Kaela's cant", "an unknown name as written");
  assert.equal(joined("Wish: Fireball, Languages: Elvish"), "Желание: Огненный шар, Языки: Эльфийский");
  assert.equal(joined("Nothing: here"), "Nothing: here");
  // A way of a spell the fight named after it reads the spell, brackets and all, and the way.
  const ways = rulesetTextLookup({
    "True Polymorph (unwilling)": "Polimorfismo verdadero (involuntario)",
    Frog: "Rana",
    Fireball: "Bola de fuego",
  });
  assert.equal(ways("True Polymorph (unwilling) (Frog)"), "Polimorfismo verdadero (involuntario) (Rana)");
  assert.equal(ways("True Polymorph (unwilling)"), "Polimorfismo verdadero (involuntario)");
  assert.equal(ways("Fireball (Kaela's twist)"), "Bola de fuego (Kaela's twist)", "an unknown way as written");
  assert.equal(ways("Dagger (thrown)"), "Dagger (thrown)", "nothing known, nothing changed");
  const view = {
    combatants: [
      {
        id: "Goblin",
        name: "Goblin 1",
        conditions: ["Prone"],
        pools: [{ id: "spell_slots_1", label: "1st-level slots", value: 2, max: 3, unit: "1st-level slot" }],
      },
    ],
    options: [{ id: "spells/fire-bolt", optionId: "Fire Bolt", label: "Fire Bolt" }],
    adjustments: ["Goblin is built from its tier."],
    events: [{ seq: 1, event: { type: "turn", actorId: "Goblin", label: "Fire Bolt" } }],
  } as never;
  const shown = translateRulesetView(view, text) as unknown as typeof view & Record<string, any>;
  assert.equal(shown.combatants[0].name, "Гоблин 1");
  assert.equal(shown.combatants[0].id, "Goblin");
  assert.deepEqual(shown.combatants[0].conditions, ["Prone"], "condition ids stay ids");
  // The fight's HUD names a caster's slots in the player's language (Spanish playtest 2026-10-27).
  assert.deepEqual(shown.combatants[0].pools, [
    { id: "spell_slots_1", label: "Espacios de nivel 1", value: 2, max: 3, unit: "Espacio de nivel 1" },
  ]);
  assert.equal(shown.options[0].label, "Огненный снаряд");
  assert.equal(shown.options[0].optionId, "Fire Bolt");
  assert.equal(shown.events[0].event.label, "Огненный снаряд");
  assert.equal(shown.events[0].event.actorId, "Goblin");
  assert.deepEqual(shown.adjustments, ["Goblin is built from its tier."], "notes are read against their English");
  assert.equal(translateRulesetView(view, RULESET_TEXT_AS_IS), view);
}

// ── What the view keeps as written, put in the player's language as it is drawn ──
{
  const text = rulesetTextLookup({
    Humanoid: "Humanoide",
    Goblinoid: "Goblinoide",
    "neutral evil": "neutral malvado",
    Construct: "Constructo",
    Action: "Acción",
    Movement: "Movimiento",
    "Bonus action": "Acción adicional",
  });
  const kind = { type: "Humanoid", tags: ["Goblinoid"], alignment: "neutral evil" };
  assert.equal(rulesetKindLine(kind, text), "Humanoide · Goblinoide");
  assert.equal(rulesetKindLine(kind, text, true), "Humanoide · Goblinoide, neutral malvado");
  assert.equal(rulesetKindLine({ type: "Construct" }, text), "Constructo");
  assert.equal(rulesetKindLine(kind), "Humanoid · Goblinoid", "as written with no translation");
  const definition = {
    combat: {
      economy: {
        budgets: [
          { id: "action", label: "Action", count: 1 },
          { id: "bonus", label: "Bonus action", short: "B", count: 1 },
          { id: "move", label: "Movement", count: 1 },
        ],
      },
    },
  } as never;
  assert.deepEqual(
    rulesetBudgetMarks(definition, text).map((mark) => [mark.id, mark.label, mark.short]),
    [
      ["action", "Acción", "A"],
      ["bonus", "Acción adicional", "B"],
      ["move", "Movimiento", "M"],
    ],
  );
  assert.deepEqual(
    rulesetBudgetMarks(definition).map((mark) => mark.label),
    ["Action", "Bonus action", "Movement"],
  );
}

// ── The character sheet reads the same words (source-level) ──
{
  const sheet = readFileSync(
    new URL("../../packages/client/src/components/game/GameRulesetSheet.tsx", import.meta.url),
    "utf8",
  );
  assert.match(sheet, /return useRulesetDefinitionText\(definition\);/);
  assert.match(
    readFileSync(new URL("../../packages/client/src/hooks/use-ruleset-text.ts", import.meta.url), "utf8"),
    /useRulesetStrings\(definition\.id, definition\.version, i18n\.resolvedLanguage \?\? i18n\.language\)/,
    "loaded as the fight screen loads it",
  );
  assert.match(sheet, /<RulesetTextContext\.Provider value=\{text\}>/, "its parts read the same words");
  for (const shown of [
    "text(condition.label)",
    "text(list.label)",
    "text(entry.name)",
    "text(pool.label)",
    "text(track.label)",
    "text(kind.label)",
    "text(attack.label)",
    "text(rest.label)",
    "text(offer.name)",
    "text(source.name)",
    "text(field.label)",
    "text(ability.short ?? ability.label)",
    "text(group.section.label)",
    "text(one)",
    "text(definition.party.label)",
    // A written value too, name by name ("Common, Elvish" under Languages).
    'text(field.type === "enum" ? (field.valueLabels?.[value] ?? value) : value)',
  ])
    assert.ok(sheet.includes(shown), `the sheet shows ${shown}`);
  // What it sends back is the ruleset's own: ids and keys, never a translated label.
  assert.match(sheet, /onToggle\(condition\.id, (?:true|false)\)/);
  assert.match(sheet, /apply\(\{ op: "rest", rest: rest\.id/);
  assert.match(sheet, /apply\(\{ op: "spend", pool: pool\.key, amount: 1 \}\)/);
  assert.doesNotMatch(sheet, /op: "[a-z]+", [a-z]+: text\(/, "no command carries a translated word");
}

console.log(
  "Ruleset file translations: read strictly, the page's language kept beside its version, served by language, swapped in as drawn.",
);

// ── The sheet editor and its builder read the translation as they draw (Spanish playtest 2026-10-27) ──
{
  const source = (path: string) => readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");
  const editor = source("components/rulesets/RulesetSheetEditor.tsx");
  assert.match(editor, /<RulesetTextContext\.Provider value=\{text\}>\s*<SheetEditor \{\.\.\.props\} \/>/);
  assert.match(editor, /useRulesetDefinitionText\(props\.definition\)/);
  const builder = source("components/rulesets/RulesetSheetBuilder.tsx");
  assert.match(builder, /const rt = useRulesetText\(\);/);
  assert.match(builder, /\{rt\(step\.label\)\}<\/h4>/, "a step's heading");
  assert.match(builder, /\{rt\(entry\.label\)\}/, "a catalog entry's name");
  const typed = source("components/rulesets/RulesetTypedInput.tsx");
  assert.match(typed, /\{rt\(spec\.valueLabels\?\.\[option\] \?\? option\)\}/, "a field's options");
  assert.match(typed, /\{rt\(word\)\}/, "a field's suggestions");
  assert.match(
    typed,
    /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/,
    "the value kept is the ruleset's own",
  );
  // The editor's catalog picker too: filters, entries and chips as shown, values kept as written.
  const picker = source("components/rulesets/RulesetCatalogPicker.tsx");
  assert.match(picker, /const rt = useRulesetText\(\);/);
  assert.match(picker, /\{rt\(view\.filter\.label\)\}/, "a filter's name");
  assert.match(picker, /<option key=\{option\} value=\{option\}>\s*\{rt\(option\)\}/, "a filter's values");
  assert.match(picker, /\{rt\(entry\.label\)\}<\/span>/, "an entry's name");
  assert.match(picker, /rt\(entry\.label\)\.toLowerCase\(\)\.includes\(needle\)/, "found by its name as shown");
  const items = source("components/game/RulesetItemPicker.tsx");
  assert.match(items, /const rt = useRulesetDefinitionText\(definition\);/);
  assert.match(items, /\{rt\(each\.name\)\}<\/span>/, "an item's name in the inventory's picker");
}

// ── An item's lines read the ruleset's words in the player's language (Spanish re-test 2026-10-27) ──
{
  const { rulesetItemEffectLines, rulesetItemStatsLine } =
    await import("../../packages/client/src/components/game/RulesetItemPicker.js");
  const spanish: Record<string, string> = {
    "Weight (lb)": "Peso (lb)",
    acid: "ácido",
    Dexterity: "Destreza",
    Action: "Acción",
    ft: "pies",
    "gold pieces": "piezas de oro",
    poisoned: "envenenado",
  };
  const rt = (english: string) => spanish[english] ?? english;
  const t = ((key: string, options?: Record<string, unknown>) =>
    `${key}(${Object.entries(options ?? {})
      .map(([name, value]) => `${name}=${value}`)
      .join(",")})`) as never;
  const facts = {
    stats: [{ label: "Weight (lb)", text: "2" }],
    tags: [],
    use: {
      kind: "attack",
      budget: "Action",
      amount: "2d6",
      type: "acid",
      toHit: "Dexterity",
      unit: "ft",
      range: 20,
      applies: ["poisoned", "blinded"],
      consumes: true,
    },
  } as never;
  assert.equal(rulesetItemStatsLine(facts, rt), "Peso (lb) 2");
  assert.equal(rulesetItemStatsLine(facts), "Weight (lb) 2", "English stays as written");
  const [line] = rulesetItemEffectLines(facts, t, rt);
  for (const word of ["Acción", "ácido", "Destreza", "unit=pies", "envenenado, blinded"]) {
    assert.ok(line!.includes(word), `${word} in ${line}`);
  }
  for (const word of ["Action", "acid", "Dexterity", "unit=ft"]) assert.ok(!line!.includes(word), line);
  const source = readFileSync(
    new URL("../../packages/client/src/components/game/RulesetItemPicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\{rt\(word\)\}/, "a chip");
  assert.match(source, /withRulesetWords\(t, rt\)\("game\.ruleset\.items\.cost", facts\.cost\)/, "a price's coin");
}
