/**
 * 5e's ship-readiness asks of 2026-10-23 (Capability API 1.788):
 *
 *   - A fields step's `unansweredAtDefault`: its badge waits while a field holds its default (a dragon
 *     ancestor of "none").
 *   - A grant's `entries.add`: entries given outright, their rows on the sheet, and a choice of the
 *     same catalog never offers them again (an elf's Common and Elvish).
 *   - A heal's `outsideFight`: a Game Master's `use` heals its user outside a fight (Second Wind).
 *   - An item's `aliases`: other names it is found by ("Plate" for Plate Armor, a shovel for a spade).
 *   - Refusals and the install gate.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetBuilder,
  applySheetCommandTags,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  readRulesetLive,
  RULESET_CATALOG_ROW_KEY,
  rulesetBuilderEntrySlots,
  rulesetBuilderRemaining,
  rulesetItemBook,
  rulesetSheetBuildSchema,
  rulesetUseHealOutsideFight,
  supportedCapabilityApi,
  type RulesetCatalogEntriesById,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-asks-772-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 788);
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
  const catalogsOf = (definition: RulesetDefinition): RulesetCatalogEntriesById =>
    Object.fromEntries((definition.catalogs ?? []).map((catalog) => [catalog.id, catalog.entries ?? []]));
  const language = (id: string, label: string) => ({
    id,
    label,
    rows: [{ list: "proficiencies", values: { name: label } }],
  });
  /** A race step that gives an elf two languages and a choice of one more, and a fields step whose
   *  dragon ancestor starts at "none". */
  const builderDoc = () => {
    const doc = fiveE();
    doc.sheet.fields.push({
      id: "ancestor",
      label: "Dragon ancestor",
      type: "enum",
      values: ["none", "red", "gold"],
      default: "none",
    });
    doc.catalogs.push(
      {
        id: "langs",
        label: "Languages",
        feeds: ["proficiencies"],
        entries: [language("common", "Common"), language("elvish", "Elvish"), language("dwarvish", "Dwarvish")],
      },
      {
        id: "races_test",
        label: "Races",
        feeds: ["features"],
        entries: [
          {
            id: "elf",
            label: "Elf",
            rows: [{ list: "features", values: { name: "Darkvision" } }],
            grants: {
              entries: {
                add: [{ catalog: "langs", ids: ["common", "elvish"] }],
                choose: [{ id: "extra", catalog: "langs", count: 1 }],
              },
            },
          },
        ],
      },
    );
    doc.sheet.builder = {
      steps: [
        { id: "race", label: "Race", kind: "catalog", catalog: "races_test", field: "race", max: 1 },
        { id: "langs", label: "Languages", kind: "choices", catalog: "langs" },
        { id: "ancestry", label: "Ancestry", kind: "fields", fields: ["ancestor"], unansweredAtDefault: ["ancestor"] },
      ],
    };
    return doc;
  };

  // ── A default that still waits ──
  {
    const definition = parsed(builderDoc());
    const catalogs = catalogsOf(definition);
    const build = defaultRulesetSheetBuild(definition);
    assert.equal(build.fields.ancestor, "none");
    assert.equal(rulesetBuilderRemaining(definition, build, {}, catalogs).ancestry, 1, "none is not an answer");
    const red = { ...build, fields: { ...build.fields, ancestor: "red" } };
    assert.equal(rulesetBuilderRemaining(definition, red, {}, catalogs).ancestry ?? 0, 0, "red is");
    const plain = builderDoc();
    delete plain.sheet.builder.steps[2].unansweredAtDefault;
    const plainDef = parsed(plain);
    assert.equal(
      rulesetBuilderRemaining(plainDef, defaultRulesetSheetBuild(plainDef), {}, catalogsOf(plainDef)).ancestry ?? 0,
      0,
      "without it a default answers, as before",
    );
  }

  // ── Entries given outright ──
  {
    const definition = parsed(builderDoc());
    const catalogs = catalogsOf(definition);
    const made = applyRulesetBuilder(
      definition,
      defaultRulesetSheetBuild(definition),
      { picks: { race: ["elf"] } },
      catalogs,
    );
    const names = () => (made.build.lists.proficiencies ?? []).map((row) => (row as { name?: string }).name);
    assert.ok(names().includes("Common") && names().includes("Elvish"), JSON.stringify(names()));
    assert.ok(!names().includes("Dwarvish"));
    const slot = rulesetBuilderEntrySlots(definition, made.state, catalogs, made.build)[0]!;
    assert.deepEqual(slot.from, ["dwarvish"], "the choice never offers what is given");
    const chosen = applyRulesetBuilder(
      definition,
      made.build,
      { ...made.state, entryChoices: { [slot.key]: ["dwarvish"] } },
      catalogs,
    );
    const after = (chosen.build.lists.proficiencies ?? []).map((row) => (row as { name?: string }).name);
    assert.deepEqual([...after].sort(), ["Common", "Dwarvish", "Elvish"]);
    // Unpicked, they go again.
    const gone = applyRulesetBuilder(definition, chosen.build, { ...chosen.state, picks: { race: [] } }, catalogs);
    assert.equal((gone.build.lists.proficiencies ?? []).length, 0, JSON.stringify(gone.build.lists.proficiencies));
  }

  // ── Second Wind outside a fight ──
  {
    const doc = fiveE();
    const secondWind = {
      id: "second-wind-test",
      label: "Second Wind",
      rows: [{ list: "features", values: { name: "Second Wind", text: "Regain 1d10 + level hit points." } }],
      mechanics: {
        kind: "heal",
        targets: "self",
        amount: { dice: "1d10" },
        amountAdd: { field: "level" },
        outsideFight: true,
      },
    };
    doc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(secondWind);
    const definition = parsed(doc);
    const build = rulesetSheetBuildSchema.parse({
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
      fields: { level: 3, hp_max: 30 },
      lists: {
        features: [{ name: "Second Wind", text: "Regain.", [RULESET_CATALOG_ROW_KEY]: "feats/second-wind-test" }],
      },
    });
    const catalogs = { feats: [secondWind] } as never;
    const hurt = { pools: { hp: { value: 10 } } };
    const healed = rulesetUseHealOutsideFight(definition, build, catalogs, "Second Wind", hurt, () => 6);
    assert.ok(healed?.ok, JSON.stringify(healed));
    const hp = (live: unknown) =>
      readRulesetLive(definition, build, live).pools.find((pool) => pool.key === "hp")!.value;
    assert.equal(hp(healed.live), 19, "6 rolled and level 3");
    // The Game Master's tag does it.
    const told = applySheetCommandTags(`Ada catches her breath. [sheet: who="Ada" op="use" name="Second Wind"]`, {
      definition,
      cards: [{ name: "Ada", build }],
      playerName: "Ada",
      live: { ada: hurt } as never,
      catalogs,
      roll: () => 6,
    });
    assert.equal(hp(told.live.ada), 19, JSON.stringify(told));
    // Without `outsideFight` the use heals nothing, as before.
    const plainDoc = fiveE();
    const plain = { ...secondWind, mechanics: { ...secondWind.mechanics, outsideFight: undefined } };
    delete plain.mechanics.outsideFight;
    plainDoc.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries.push(plain);
    assert.equal(
      rulesetUseHealOutsideFight(parsed(plainDoc), build, { feats: [plain] } as never, "Second Wind", hurt),
      null,
    );
    // Refused on anything but a heal of its user with an amount.
    const others = fiveE();
    others.catalogs
      .find((catalog: { id: string }) => catalog.id === "feats")
      .entries.push({ ...secondWind, mechanics: { ...secondWind.mechanics, targets: "ally" } });
    refused(others, /"outsideFight" heals its user/);
  }

  // ── Other names for an item ──
  {
    const gravewatch = (): Record<string, any> =>
      JSON.parse(
        readFileSync(fileURLToPath(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url)), "utf8"),
      );
    const kit = (doc: Record<string, any>) => doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
    const doc = gravewatch();
    kit(doc).entries.find((entry: { id: string }) => entry.id === "grave-spade").aliases = ["Spade", "Shovel"];
    const definition = parsed(doc);
    const book = rulesetItemBook(definition, catalogsOf(definition));
    assert.equal(book.itemNamed("Shovel")?.name, "Grave spade");
    assert.equal(book.itemNamed("spade")?.name, "Grave spade");
    assert.equal(book.itemNamed("grave spade")?.name, "Grave spade");
    const bareDef = parsed(gravewatch());
    assert.equal(rulesetItemBook(bareDef, catalogsOf(bareDef)).itemNamed("Shovel"), undefined);
    // An item's own name is found first, whatever another calls itself.
    const clash = gravewatch();
    kit(clash).entries.find((entry: { id: string }) => entry.id === "grave-spade").aliases = ["Watch pistol"];
    const clashDef = parsed(clash);
    assert.equal(rulesetItemBook(clashDef, catalogsOf(clashDef)).itemNamed("Watch pistol")?.name, "Watch pistol");
    // Refused off an item.
    const off = fiveE();
    off.catalogs.find((catalog: { id: string }) => catalog.id === "feats").entries[0].aliases = ["Push"];
    refused(off, /"aliases" names an item/);
  }

  // ── Refusals ──
  {
    const noDefault = builderDoc();
    noDefault.sheet.fields.find((field: { id: string }) => field.id === "ancestor").default = undefined;
    delete noDefault.sheet.fields.find((field: { id: string }) => field.id === "ancestor").default;
    refused(noDefault, /has no default to wait past/);
    const notHere = builderDoc();
    notHere.sheet.builder.steps[2].unansweredAtDefault = ["level"];
    refused(notHere, /"level" is not one of this step's fields/);
    const unknown = builderDoc();
    unknown.catalogs.at(-1).entries[0].grants.entries.add[0].ids = ["common", "orcish"];
    refused(unknown, /No entry "orcish" in catalog "langs"/);
    const twice = builderDoc();
    twice.catalogs.at(-1).entries[0].grants.entries.add[0].ids = ["common", "common"];
    refused(twice, /"common" is named twice/);
    const unread = builderDoc();
    unread.sheet.builder.steps.splice(1, 1);
    unread.catalogs.at(-1).entries[0].grants.entries = { add: [{ catalog: "langs", ids: ["common"] }] };
    refused(unread, /No builder step reads catalog "langs"/);
    const empty = builderDoc();
    empty.catalogs.at(-1).entries[0].grants.entries = {};
    refused(empty, /Say what entries it gives/);
  }

  // ── The install gate ──
  {
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
      "A ruleset with a fields step's unansweredAtDefault, a grant's entries.add, a heal's outsideFight, or an item's aliases requires schemaVersion 2 and capabilityApi 1.788 or newer";
    const asks = builderDoc();
    assert.equal(getCapabilityPackageInstallIssue(manifest(787) as never, asks), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(788) as never, asks), gate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(787) as never, fiveE()), gate);
  }

  console.log(
    "Engine asks 1.788: none is no dragon yet, an elf's languages given and never offered again, Second Wind out of a fight, a shovel for the grave spade; refused where unsaid; gated at 1.788.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
