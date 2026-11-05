/**
 * The Game Master's `prepare` sheet command (playtest 2026-10-26: a cleric "swapping Sanctuary for
 * Detect Magic" after a long rest had no command to write, and the ritual Detect Magic was then
 * refused as unknown-entry).
 *
 *   - `op="prepare"` ticks a held row's prepared mark (the list's `display.mark`), and `op="unprepare"`
 *     clears it.
 *   - An entry the sheet does not hold is added, stamped as the builder stamps it, where the builder
 *     would let the sheet pick it for that list ticked (a cleric's class list), with or without the
 *     builder's stored picks; one it could not pick (another class's spell) is refused.
 *   - No more are held prepared than the builder lets the sheet pick or mark (too-many-prepared).
 *   - A `use` of an entry the sheet could prepare is refused as not-prepared, saying how to prepare it;
 *     once prepared, its ritual use pays nothing.
 *   - The tag round-trips, and the Game Master is told to write it when the story changes what a caster
 *     has prepared.
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
  parseSheetCommandTagBody,
  readRulesetLive,
  RULESET_CATALOG_ROW_KEY,
  rulesetPrepareCatalogIds,
  rulesetSheetBuildSchema,
  serializeSheetCommandTag,
  type RulesetDefinition,
  type RulesetSheetBuild,
  type SheetCommandContext,
} from "../../packages/shared/src/index.js";

const fiveEText = readFileSync(
  fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
  "utf8",
);
const spell = (id: string, label: string, level: number, known: string[], book: string[] = [], ritual = false) => ({
  id,
  label,
  filters: { kind: "spell", level, known_ids: known, book_ids: book },
  rows: [{ list: "spells", values: { name: label, level, prepared: false, ritual } }],
  mechanics: { kind: "buff", targets: "self", cost: [{ pool: "slots", amount: 1 }] },
});
const spells = [
  spell("bless", "Bless", 1, ["cleric"]),
  spell("sanctuary", "Sanctuary", 1, ["cleric"]),
  spell("cure-wounds", "Cure Wounds", 1, ["cleric"]),
  spell("detect-magic", "Detect Magic", 1, ["cleric"], ["wizard"], true),
  spell("shield", "Shield", 1, [], ["wizard"]),
  spell("fireball", "Fireball", 3, [], ["wizard"]),
];
const classes = ["cleric", "wizard"].map((id) => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  filters: { kind: "class", spell_class: id },
  rows: [{ list: "proficiencies", values: { name: `${id} armor` } }],
}));
const doc = JSON.parse(fiveEText) as Record<string, any>;
doc.catalogs = [
  {
    id: "classes",
    label: "Classes",
    feeds: ["proficiencies"],
    filters: [
      { id: "kind", label: "Kind", type: "text" },
      { id: "spell_class", label: "Spellcasting class", type: "text" },
    ],
    entries: classes,
  },
  {
    id: "spells",
    label: "Spells",
    feeds: ["spells"],
    filters: [
      { id: "kind", label: "Kind", type: "text" },
      { id: "level", label: "Level", type: "number" },
      { id: "known_ids", label: "Class that prepares it", type: "tags" },
      { id: "book_ids", label: "Spellbook", type: "tags" },
    ],
    entries: spells,
  },
];
const list = doc.sheet.lists.find((one: { id: string }) => one.id === "spells");
list.display = { ...list.display, mark: "prepared" };
list.ritual = "ritual";
list.columns.push({ id: "class", label: "Class", type: "text", maxLength: 40 });
doc.sheet.builder = {
  steps: [
    { id: "class", label: "Class", kind: "catalog", catalog: "classes", min: 1, max: 1 },
    {
      id: "spells",
      label: "Spells",
      kind: "catalog",
      catalog: "spells",
      min: 0,
      max: 30,
      filters: { kind: "spell" },
      within: { step: "class", filter: "known_ids" },
      stamp: { class: { fromWithin: "spell_class" }, prepared: true },
      countFrom: { abilityMod: "wis" },
    },
    {
      id: "spellbook",
      label: "Spellbook",
      kind: "catalog",
      catalog: "spells",
      min: 0,
      max: 10,
      filters: { kind: "spell" },
      within: { step: "class", filter: "book_ids" },
      stamp: { class: { fromWithin: "spell_class" }, prepared: false },
    },
    {
      id: "prepared",
      label: "Prepared spells",
      kind: "mark",
      list: "spells",
      column: "prepared",
      where: { level: { atLeast: 1 }, class: "wizard" },
      countFrom: { abilityMod: "int" },
    },
  ],
};
const parsed = parseRulesetDefinition(doc);
assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
const definition: RulesetDefinition = parsed.definition;
const catalogs = { classes: definition.catalogs![0]!.entries!, spells: definition.catalogs![1]!.entries! };

const row = (catalog: string, id: string, values: Record<string, string | number | boolean> = {}) => {
  const entry = (catalog === "spells" ? spells : classes).find((one) => one.id === id)!;
  return { ...entry.rows[0]!.values, ...values, [RULESET_CATALOG_ROW_KEY]: `${catalog}/${id}` };
};
const cleric = rulesetSheetBuildSchema.parse({
  abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
  fields: { level: 3, hp_max: 24, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 2 },
  lists: {
    proficiencies: [row("classes", "cleric")],
    spells: ["bless", "sanctuary", "cure-wounds"].map((id) => row("spells", id, { prepared: true, class: "cleric" })),
  },
});
const wizard = rulesetSheetBuildSchema.parse({
  abilities: { str: 8, dex: 14, con: 12, int: 14, wis: 12, cha: 10 },
  fields: { level: 3, hp_max: 18, spellcasting_ability: "int", slots_max_1: 4, slots_max_2: 2 },
  lists: {
    proficiencies: [row("classes", "wizard")],
    spells: [
      row("spells", "detect-magic", { class: "wizard", prepared: true }),
      row("spells", "shield", { class: "wizard" }),
      row("spells", "fireball", { class: "wizard", prepared: true }),
    ],
  },
});
const bran = normalizeCharacterLookupName("Bran");
const ilse = normalizeCharacterLookupName("Ilse");
const run = (
  content: string,
  builds: { bran?: RulesetSheetBuild; ilse?: RulesetSheetBuild } = {},
  extra: Partial<SheetCommandContext> = {},
) =>
  applySheetCommandTags(content, {
    definition,
    cards: [
      { name: "Bran", build: builds.bran ?? cleric, builder: { picks: { class: ["cleric"] } } },
      { name: "Ilse", build: builds.ilse ?? wizard },
    ],
    playerName: "Ilse",
    live: {},
    catalogs,
    ...extra,
  });
const spellRows = (build: RulesetSheetBuild | undefined) =>
  (build?.lists.spells ?? []).map((one) => `${one.name}${one.prepared ? "*" : ""}`);

// ── The catalogs a prepare reads: the spell list, and the classes it is picked within ──
assert.deepEqual(rulesetPrepareCatalogIds(definition).sort(), ["classes", "spells"]);

// ── The tag round-trips ──
const tag = parseSheetCommandTagBody(` who="Bran" op="prepare" name="Detect Magic"`);
assert.deepEqual(tag.op, { op: "prepare", name: "Detect Magic" });
assert.deepEqual(parseSheetCommandTagBody(` op="unprepare" spell="Sanctuary"`).op, {
  op: "unprepare",
  name: "Sanctuary",
});
assert.equal(parseSheetCommandTagBody(` op="prepare"`).op, null, "a prepare names what it prepares");
const written = serializeSheetCommandTag({ ...tag, raw: "" }, { ok: true, now: "Detect Magic prepared" });
assert.equal(written, `[sheet: who="Bran" op="prepare" name="Detect Magic" result="ok" now="Detect Magic prepared"]`);
assert.deepEqual(parseSheetCommandTagBody(written.slice(7, -1)).op, tag.op);

// ── Over what the builder lets the cleric pick: Wisdom's +3, all three held ──
const full = run(`[sheet: who="Bran" op="prepare" name="Detect Magic"]`);
assert.equal(full.outcomes[0]!.ok, false);
assert.match(full.outcomes[0]!.reason!, /^too-many-prepared: 3 of 3 Spells already; unprepare one first$/);
assert.deepEqual(full.builds, {});

// ── The use is refused as not prepared, saying how ──
const before = run(`[sheet: who="Bran" op="use" name="Detect Magic" ritual="yes"]`);
assert.equal(
  before.outcomes[0]!.reason,
  "not-prepared: Detect Magic is not on Bran's sheet; prepare it first, with op=prepare name=Detect Magic",
);
assert.match(before.content, /result="refused" reason="not-prepared: Detect Magic is not on Bran's sheet;/);
// Nothing it could prepare stays unknown.
assert.equal(run(`[sheet: who="Bran" op="use" name="Wish"]`).outcomes[0]!.reason, "unknown-entry");

// ── Swapping Sanctuary for Detect Magic, then the ritual ──
const swap = run(
  `Bran prays at dawn. [sheet: who="Bran" op="unprepare" name="Sanctuary"] [sheet: who="Bran" op="prepare" name="Detect Magic"] [sheet: who="Bran" op="use" name="Detect Magic" ritual="yes"]`,
);
assert.ok(
  swap.outcomes.every((one) => one.ok),
  JSON.stringify(swap.outcomes),
);
assert.equal(swap.outcomes[0]!.now, "Sanctuary no longer prepared");
assert.equal(swap.outcomes[1]!.now, "Detect Magic prepared, added from Spells");
assert.deepEqual(spellRows(swap.builds[bran]), ["Bless*", "Sanctuary", "Cure Wounds*", "Detect Magic*"]);
const added = swap.builds[bran]!.lists.spells!.at(-1)!;
assert.equal(added[RULESET_CATALOG_ROW_KEY], "spells/detect-magic", "stamped as a builder row");
assert.equal(added.class, "cleric", "with the builder's stamp");
assert.equal(added.ritual, true);
const slots = (result: ReturnType<typeof run>) =>
  readRulesetLive(definition, result.builds[bran] ?? cleric, result.live[bran]).pools.find(
    (one) => one.key === "slots_1",
  )?.value;
assert.equal(slots(swap), 4, "the ritual pays no slot");
assert.match(swap.content, /op="prepare" name="Detect Magic" result="ok"/);

// ── A held row ticked again, and one already as asked ──
const unprepared = swap.builds[bran]!;
const back = run(`[sheet: who="Bran" op="unprepare" name="Bless"] [sheet: who="Bran" op="prepare" name="Sanctuary"]`, {
  bran: unprepared,
});
assert.ok(
  back.outcomes.every((one) => one.ok),
  JSON.stringify(back.outcomes),
);
assert.deepEqual(spellRows(back.builds[bran]), ["Bless", "Sanctuary*", "Cure Wounds*", "Detect Magic*"]);
const same = run(`[sheet: who="Bran" op="prepare" name="Bless"]`);
assert.equal(same.outcomes[0]!.now, "Bless already prepared");
assert.deepEqual(same.builds, {}, "nothing changed, nothing to save");
assert.equal(run(`[sheet: who="Bran" op="unprepare" name="Wish"]`).outcomes[0]!.reason, "unknown-entry");

// ── Without the builder's picks, the class rows the sheet holds stand in for them ──
const npc = applySheetCommandTags(
  `[sheet: who="Bran" op="unprepare" name="Cure Wounds"] [sheet: who="Bran" op="prepare" name="Detect Magic"]`,
  { definition, cards: [{ name: "Bran", build: cleric }], playerName: null, live: {}, catalogs },
);
assert.ok(
  npc.outcomes.every((one) => one.ok),
  JSON.stringify(npc.outcomes),
);

// ── A wizard prepares from the spellbook, up to Intelligence's +2, and nothing off another list ──
const shield = run(`[sheet: op="prepare" name="Shield"]`);
assert.equal(shield.outcomes[0]!.reason, "too-many-prepared: 2 of 2 Prepared spells already; unprepare one first");
const swapped = run(`[sheet: op="unprepare" name="Fireball"] [sheet: op="prepare" name="Shield"]`);
assert.ok(
  swapped.outcomes.every((one) => one.ok),
  JSON.stringify(swapped.outcomes),
);
assert.deepEqual(spellRows(swapped.builds[ilse]), ["Detect Magic*", "Shield*", "Fireball"]);
assert.equal(run(`[sheet: op="prepare" name="Cure Wounds"]`).outcomes[0]!.reason, "not-allowed");

// ── Refused with an advance when the build cannot be saved ──
assert.equal(
  run(`[sheet: who="Bran" op="unprepare" name="Bless"]`, {}, { advancementRefusal: "save-failed" }).outcomes[0]!.reason,
  "save-failed",
);

// ── The Game Master is told, where a list has a prepared mark ──
const dataDir = mkdtempSync(join(tmpdir(), "marinara-prepare-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
try {
  const { buildGmFormatReminder, renderGameRulesetSheetBlocks } = await Promise.all([
    import("../../packages/server/src/services/game/gm-prompts.js"),
    import("../../packages/server/src/services/game/ruleset-sheet-turn.service.js"),
  ]).then(([prompts, turn]) => ({ ...prompts, ...turn }));
  const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
  const line =
    /\[sheet: who="Name" op="prepare" name="Ability"\] marks it Prepared on Spells, adding it from what they could pick; op="unprepare" clears it\. When the story has a caster change what they have prepared, write one for each ability changed\./;
  const sheets = renderGameRulesetSheetBlocks(definition, [{ name: "Bran" }], null);
  assert.match(buildGmFormatReminder({ ...base, ruleset: definition, rulesetSheetBlocks: sheets }), line);
  const unmarked = parseRulesetDefinition({
    ...doc,
    sheet: {
      ...doc.sheet,
      lists: doc.sheet.lists.map((one: { id: string; display?: object }) =>
        one.id === "spells" ? { ...one, display: { ...one.display, mark: undefined } } : one,
      ),
    },
  });
  assert.ok(unmarked.ok, unmarked.ok ? "" : unmarked.issues.join("; "));
  assert.doesNotMatch(
    buildGmFormatReminder({ ...base, ruleset: unmarked.definition, rulesetSheetBlocks: sheets }),
    /op="prepare"/,
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(
  "Prepare: held rows ticked and cleared, class-list entries added as the builder would, counts kept, and an unprepared use says to prepare it.",
);
