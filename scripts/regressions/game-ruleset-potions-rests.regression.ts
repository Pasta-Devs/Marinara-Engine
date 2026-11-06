/**
 * Healing items, rest-only pools and rituals on the Game Master's sheet commands (laptop 2026-10-26).
 *
 *   - One healing item used in a reply heals once: the Engine's own heal for the use, never again by
 *     a restore of the same character's health written beside it. A restore with no such use, or in
 *     a reply that also uses an ability (whose heal it may be), still heals.
 *   - A pool only a rest gives back (spell slots, hit dice) is not given back by a bare restore: only
 *     in a reply where that character takes a rest that gives it back. A pool a rest gives back only
 *     a fixed few of is a point the story hands out too, and health heals many ways: both untouched.
 *   - Such a restore beside the rest a feature works at (Arcane Recovery on a Short rest) is that
 *     feature's use: its counter is paid, and once it is spent the restore is refused.
 *   - A list's `ritual` column (Capability API 1.807): a ticked row used with ritual="yes" pays no
 *     slot; an unticked one is refused; the column is checked at import and the gate asks for 1.807.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  normalizeCharacterLookupName,
  parseRulesetDefinition,
  readRulesetLive,
  RULESET_CATALOG_ROW_KEY,
  rulesetRowIsRitual,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
  type RulesetLiveStates,
  type SheetCommandContext,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-potions-rests-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 807);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const entries = [
    {
      id: "detect-magic",
      label: "Detect Magic",
      rows: [{ list: "spells", values: { name: "Detect Magic", level: 1, ritual: true } }],
      mechanics: { kind: "buff", targets: "self", cost: [{ pool: "slots", amount: 1 }] },
    },
    {
      id: "shield",
      label: "Shield",
      rows: [{ list: "spells", values: { name: "Shield", level: 1 } }],
      mechanics: { kind: "buff", targets: "self", cost: [{ pool: "slots", amount: 1 }] },
    },
    {
      id: "arcane-recovery",
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
    },
  ];
  const fiveE = (edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs = [{ id: "spells", label: "Spells and features", feeds: ["spells", "counters", "features"], entries }];
    doc.sheet.lists.find((list: { id: string }) => list.id === "spells").ritual = "ritual";
    edit(doc);
    return doc;
  };
  const parsed = (document: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(document);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const definition = parsed(fiveE());
  const catalogs = { spells: definition.catalogs![0]!.entries! };
  const row = (id: string, list: string) => ({
    ...entries.find((entry) => entry.id === id)!.rows.find((one) => one.list === list)!.values,
    [RULESET_CATALOG_ROW_KEY]: `spells/${id}`,
  });
  const wizard = rulesetSheetBuildSchema.parse({
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
    fields: { level: 5, hp_max: 30, spellcasting_ability: "int", slots_max_1: 4, slots_max_2: 3, slots_max_3: 2 },
    lists: {
      spells: [row("detect-magic", "spells"), row("shield", "spells")],
      features: [row("arcane-recovery", "features")],
      counters: [row("arcane-recovery", "counters")],
    },
  });
  const cleric = rulesetSheetBuildSchema.parse({
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    fields: { level: 5, hp_max: 38, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 3, slots_max_3: 2 },
  });
  const ilse = normalizeCharacterLookupName("Ilse");
  const bran = normalizeCharacterLookupName("Bran");
  const hurt = { pools: { hp: { value: 10 }, slots_1: { value: 1 }, slots_2: { value: 1 }, hit_dice: { value: 2 } } };
  const run = (content: string, extra: Partial<SheetCommandContext> = {}, live: RulesetLiveStates = {}) =>
    applySheetCommandTags(content, {
      definition,
      cards: [
        { name: "Ilse", build: wizard },
        { name: "Bran", build: cleric },
      ],
      playerName: "Ilse",
      live: { [ilse]: hurt as never, [bran]: hurt as never, ...live },
      catalogs,
      ...extra,
    });
  const value = (result: ReturnType<typeof run>, key: string, pool: string) =>
    readRulesetLive(definition, key === ilse ? wizard : cleric, result.live[key]).pools.find((one) => one.key === pool)
      ?.value;
  const potion = (item: string) => item.trim().toLowerCase() === "potion of healing";

  // ── A healing item heals once ──
  const drink = `Bran drinks. [inventory: action="use" item="Potion of Healing" who="Bran"] [sheet: who="Bran" op="restore" pool="Hit points" amount="7"]`;
  const once = run(drink, { itemHealsUser: potion });
  assert.equal(once.outcomes[0]!.ok, true, JSON.stringify(once.outcomes));
  assert.match(once.outcomes[0]!.now!, /left to the use of Potion of Healing/);
  assert.equal(value(once, bran, "hp"), 10, "the use heals; the restore beside it does not heal again");
  // Without the Engine knowing it heals, or with a cast beside it, the restore is the Game Master's.
  assert.equal(value(run(drink), bran, "hp"), 17);
  const withCast = run(`${drink} [sheet: who="Ilse" op="use" name="Shield"]`, { itemHealsUser: potion });
  assert.equal(value(withCast, bran, "hp"), 17, "the restore may be the cast's heal");
  // One potion stands for one restore; a second restore heals.
  const twice = run(`${drink} [sheet: who="Bran" op="restore" pool="hp" amount="3"]`, { itemHealsUser: potion });
  assert.equal(value(twice, bran, "hp"), 13);
  // Another character's restore is theirs.
  const other = run(`${drink} [sheet: who="Ilse" op="restore" pool="hp" amount="4"]`, { itemHealsUser: potion });
  assert.equal(value(other, ilse, "hp"), 14);
  // A use already refused healed nobody.
  const refusedUse = run(
    `[inventory: action="use" item="Potion of Healing" who="Bran" result="refused" reason="no-stack"] [sheet: who="Bran" op="restore" pool="hp" amount="7"]`,
    { itemHealsUser: potion },
  );
  assert.equal(value(refusedUse, bran, "hp"), 17);

  // ── A pool only a rest gives back ──
  const shortSlots = run(
    `[sheet: who="Bran" op="rest" rest="Short rest"] [sheet: who="Bran" op="restore" pool="1st-level slots" amount="2"]`,
  );
  assert.deepEqual(
    shortSlots.outcomes.map((one) => one.ok),
    [true, false],
  );
  assert.equal(shortSlots.outcomes[1]!.reason, "rest-only");
  assert.equal(value(shortSlots, bran, "slots_1"), 1, "a Short rest gives back no spell slots");
  assert.equal(value(run(`[sheet: who="Bran" op="restore" pool="slots_1" amount="1"]`), bran, "slots_1"), 1);
  assert.equal(value(run(`[sheet: who="Bran" op="restore" pool="Hit dice" amount="1"]`), bran, "hit_dice"), 2);
  // With the rest that gives it back, in either order, it stands.
  const longSlots = run(
    `[sheet: who="Bran" op="restore" pool="slots_1" amount="1"] [sheet: who="party" op="rest" rest="Long rest"]`,
  );
  assert.ok(
    longSlots.outcomes.every((one) => one.ok),
    JSON.stringify(longSlots.outcomes),
  );
  // Health heals many ways.
  assert.equal(value(run(`[sheet: who="Bran" op="restore" pool="hp" amount="5"]`), bran, "hp"), 15);
  // A rest that gives back only a fixed few of a pool leaves it to the story too.
  const flat = parsed(
    fiveE((doc) =>
      doc.rests
        .find((rest: { id: string }) => rest.id === "short")
        .restore.push({ pool: "hit_dice", by: { const: 1 } }),
    ),
  );
  const flatRun = applySheetCommandTags(`[sheet: who="Bran" op="restore" pool="hit_dice" amount="1"]`, {
    definition: flat,
    cards: [{ name: "Bran", build: cleric }],
    playerName: "Bran",
    live: { [bran]: hurt as never },
  });
  assert.equal(flatRun.outcomes[0]!.ok, true, JSON.stringify(flatRun.outcomes));

  // ── Through the one feature that gives it back, paying its use ──
  const recovered = run(`[sheet: op="rest" rest="Short rest"] [sheet: op="restore" pool="2nd-level slots" amount="1"]`);
  assert.ok(recovered.outcomes[1]!.ok, JSON.stringify(recovered.outcomes));
  assert.match(recovered.content, /op="use" name="Arcane Recovery" recover="2nd-level slots:1"/);
  assert.equal(value(recovered, ilse, "slots_2"), 2);
  const counter = (live: unknown) =>
    readRulesetLive(definition, wizard, live).pools.find((one) => one.listId === "counters")?.value;
  assert.equal(counter(recovered.live[ilse]), 0, "its one use is spent");
  // Spent, it gives nothing back again.
  const again = run(
    `[sheet: op="rest" rest="Short rest"] [sheet: op="restore" pool="slots_1" amount="1"]`,
    {},
    { [ilse]: recovered.live[ilse]! },
  );
  assert.equal(again.outcomes[1]!.ok, false);
  assert.equal(value(again, ilse, "slots_1"), 1);
  // Not without the rest it works at.
  const noRest = run(`[sheet: op="restore" pool="slots_1" amount="1"]`);
  assert.equal(noRest.outcomes[0]!.reason, "rest-only");
  assert.equal(counter(noRest.live[ilse]), 1);

  // ── A ritual pays no slot ──
  const ritual = run(`[sheet: op="use" name="Detect Magic" ritual="yes"]`);
  assert.ok(ritual.outcomes[0]!.ok, JSON.stringify(ritual.outcomes));
  assert.equal(value(ritual, ilse, "slots_1"), 1);
  assert.match(ritual.content, /ritual="yes"/);
  assert.match(ritual.outcomes[0]!.now ?? "", /cast as a ritual, at no cost, taking the longer time/);
  const cast = run(`[sheet: op="use" name="Detect Magic"]`);
  assert.ok(cast.outcomes[0]!.ok);
  assert.equal(value(cast, ilse, "slots_1"), 0, "cast as a spell it pays its slot");
  const notRitual = run(`[sheet: op="use" name="Shield" ritual="yes"]`);
  assert.equal(notRitual.outcomes[0]!.reason, "not-ritual");
  assert.equal(value(notRitual, ilse, "slots_1"), 1);

  // ── Only a sheet holding what the list's ritualNeeds names (1.809): Ritual Casting ──
  const needing = parsed(
    fiveE((doc) => {
      doc.sheet.lists.find((list: { id: string }) => list.id === "spells").ritualNeeds = ["spells/arcane-recovery"];
    }),
  );
  assert.equal(rulesetRowIsRitual(needing, wizard, "spells/detect-magic"), true, "the wizard holds it");
  const sorcerer = rulesetSheetBuildSchema.parse({ ...wizard, lists: { spells: wizard.lists!.spells } });
  assert.equal(rulesetRowIsRitual(needing, sorcerer, "spells/detect-magic"), false, "a sheet without it may not");
  assert.equal(
    rulesetRowIsRitual(definition, sorcerer, "spells/detect-magic"),
    true,
    "nor is anyone held back unasked",
  );
  const unknownNeed = parseRulesetDefinition(
    fiveE((doc) => {
      doc.sheet.lists.find((list: { id: string }) => list.id === "spells").ritualNeeds = ["spells/nope"];
    }),
  );
  assert.equal(unknownNeed.ok, false);
  if (!unknownNeed.ok) assert.match(unknownNeed.issues.join("; "), /Unknown entry "spells\/nope"/);

  // ── Checked at import, and the install gate ──
  const bad = parseRulesetDefinition(
    fiveE((doc) => (doc.sheet.lists.find((list: { id: string }) => list.id === "spells").ritual = "name")),
  );
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.issues.join("; "), /yes-or-no column/);
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
    "A ruleset whose list rows may be used as rituals (a list's ritual) requires schemaVersion 2 and capabilityApi 1.807 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(806) as never, fiveE()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(807) as never, fiveE()), gate);
  const withNeeds = fiveE((doc) => {
    doc.sheet.lists.find((list: { id: string }) => list.id === "spells").ritualNeeds = ["spells/arcane-recovery"];
  });
  const needsGate =
    "A ruleset whose rituals need an entry on the sheet (a list's ritualNeeds) requires schemaVersion 2 and capabilityApi 1.809 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(808) as never, withNeeds), needsGate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(809) as never, withNeeds), needsGate);

  console.log(
    "Potions and rests: a healing item heals once, a rest-only pool needs its rest or its feature's use, and a ritual pays no slot.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
