// Professor Mari edits Game Mode ruleset sheets through `persona.rulesetSheet.get|update` and
// `character.rulesetSheet.get|update`. One patch shape covers every ruleset, so this drives the REAL
// MariDbService against the two docs examples, which share no ids or dice: Ember Roads (2d6, three
// stats, no saves) on a persona and Gravewatch (a d10 pool, a save, enum fields) on a card. Each
// update writes only that ruleset's sheet, refuses anything the sheet editor would refuse, and
// leaves the rest of personaStats and the card untouched.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-mari-ruleset-sheets-"));
const previousDataDir = process.env.DATA_DIR;
const previousFileStorageDir = process.env.FILE_STORAGE_DIR;
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const example = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../docs/examples/rulesets/${name}.json`, import.meta.url)), "utf8");

const { getDB, closeDB } = await import("../../../packages/server/src/db/connection.js");
const { eq } = await import("../../../packages/server/src/db/file-query.js");
const { characters, personas } = await import("../../../packages/server/src/db/schema/characters.js");
const { createGameRulesetsStorage } =
  await import("../../../packages/server/src/services/storage/game-rulesets.storage.js");
const { MariDbService } = await import("../../../packages/server/src/services/mari-db/mari-db.service.js");

type Row = Record<string, unknown>;
const EMBER = "local/ember-roads";
const GRAVE = "local/gravewatch";

try {
  const db = await getDB();
  const rulesets = createGameRulesetsStorage(db);
  await rulesets.put({ rulesetId: EMBER, version: 1, sourceKind: "local", definition: example("ember-roads") });
  await rulesets.put({ rulesetId: GRAVE, version: 1, sourceKind: "local", definition: example("gravewatch") });
  const mari = new MariDbService(db);

  const created = await mari.executeAction({
    action: "persona.create",
    personaId: "rook",
    data: { name: "Rook" },
    apply: true,
  });
  assert.equal(created.ok, true, `persona.create: ${created.error ?? ""}`);
  const otherStats = { enabled: true, bars: [{ name: "Grit", value: 3, max: 5, color: "#ff0000" }] };
  await db
    .update(personas)
    .set({ personaStats: JSON.stringify(otherStats) })
    .where(eq(personas.id, "rook"));
  const personaStats = async () => {
    const [row] = await db.select().from(personas).where(eq(personas.id, "rook"));
    return JSON.parse(String(row!.personaStats)) as Row & { rulesetSheets?: Record<string, { v: number; build: Row }> };
  };
  const update = (patch: unknown, extra: Row = {}) =>
    mari.executeAction({
      action: "persona.rulesetSheet.update",
      personaId: "rook",
      rulesetId: EMBER,
      patch,
      apply: true,
      ...extra,
    });

  // ── Discovery ──
  const listing = await mari.executeAction({ action: "persona.rulesetSheet.get", personaId: "rook" });
  assert.equal(listing.ok, true);
  const listed = listing.output as { sheets: unknown[]; installed: Array<{ id: string }> };
  assert.deepEqual(listed.sheets, [], "a new persona holds no sheets");
  assert.deepEqual(listed.installed.map((entry) => entry.id).sort(), [EMBER, GRAVE]);
  const blank = (
    await mari.executeAction({ action: "personas.ruleset_sheet.get", personaId: "rook", rulesetId: EMBER })
  ).output as Row & { layout: { abilities: Array<{ id: string }> } };
  assert.equal(blank.status, "none");
  assert.deepEqual(
    blank.layout.abilities.map((ability) => ability.id),
    ["brawn", "wits", "heart"],
  );

  // ── A preview writes nothing; a missing sheet starts blank and takes the patch ──
  const preview = await update({ abilities: { brawn: 2 } }, { apply: false });
  assert.equal(preview.ok, true, `preview: ${preview.error ?? ""}`);
  assert.equal((await personaStats()).rulesetSheets, undefined, "apply:false saves nothing");

  const [rowBefore] = await db.select().from(personas).where(eq(personas.id, "rook"));
  const first = await update({
    abilities: { brawn: 2, wits: -1 },
    skills: { scrap: "expert" },
    bonuses: { sneak: 1 },
    fields: { calling: "Courier", toughness: 4 },
    lists: { gear: { add: [{ name: "Crowbar", swing: "brawn", damage: "1d6", bulk: 1, packed: true }] } },
  });
  assert.equal(first.ok, true, `first update: ${first.error ?? ""}`);
  const [rowAfter] = await db.select().from(personas).where(eq(personas.id, "rook"));
  const { personaStats: _a, updatedAt: _b, ...restBefore } = rowBefore!;
  const { personaStats: _c, updatedAt: _d, ...restAfter } = rowAfter!;
  assert.deepEqual(restAfter, restBefore, "no other persona column changes");
  let stats = await personaStats();
  assert.deepEqual(stats.bars, otherStats.bars, "bars beside the sheets are untouched");
  assert.equal(stats.enabled, true);
  let sheet = stats.rulesetSheets![EMBER]!;
  assert.equal(sheet.v, 1, "the sheet is stamped with the ruleset's sheet version");
  assert.deepEqual(sheet.build.abilities, { brawn: 2, wits: -1, heart: 0 }, "untouched scores keep their default");
  assert.deepEqual(sheet.build.skills, { scrap: "expert" });
  assert.deepEqual(sheet.build.fields, { calling: "Courier", toughness: 4 });
  assert.equal((sheet.build.lists as Record<string, Row[]>).gear!.length, 1);

  // ── Every value is held to the ruleset; one bad value refuses the whole patch ──
  for (const [patch, expected] of [
    [{ abilities: { brawn: 9 } }, /Ability "brawn" takes a whole number from -1 to 3/],
    [{ abilities: { might: 1 } }, /Unknown ability "might"/],
    [{ abilities: { brawn: 2, luck: null } }, /abilities\.luck: Unknown ability "luck"/],
    [{ skills: { swim: null } }, /skills\.swim: Unknown skill "swim"/],
    [{ fields: { mood: null } }, /fields\.mood: Unknown field "mood"/],
    [{ saves: { steel: null } }, /saves\.steel: Unknown save "steel"/],
    [{ bonuses: { steel: null } }, /bonuses\.steel: Unknown skill or save "steel"/],
    [
      { lists: { gear: { update: [{ index: 0, cells: { heft: null } }] } } },
      /lists\.gear\.0\.heft: Unknown column "heft"/,
    ],
    [{ skills: { scrap: "master" } }, /Unknown proficiency tier "master"/],
    [{ saves: { steel: "trained" } }, /Unknown save "steel"/],
    [{ fields: { toughness: 7 } }, /Field "toughness" is outside 0 to 6/],
    [{ fields: { calling: 3 } }, /Field "calling" takes text/],
    [{ lists: { gear: { add: [{ notes: "no name" }] } } }, /Column "name" is required/],
    [{ lists: { gear: { add: [{ name: "Axe", swing: "luck" }] } } }, /Column "swing" takes one of its declared values/],
    [{ lists: { gear: { update: [{ index: 4, cells: { bulk: 1 } }] } } }, /there is no row 4/],
    [{ lists: { spells: { add: [{ name: "Fireball" }] } } }, /Unknown list "spells"/],
    [
      { lists: { tricks: { add: Array.from({ length: 13 }, (_, i) => ({ name: `Trick ${i}` })) } } },
      /holds at most 12 rows/,
    ],
    [{ live: { health: 3 } }, /Unrecognized key/],
    [{}, /changes nothing/],
  ] as const) {
    const refused = await update(patch);
    assert.equal(refused.ok, false, `${JSON.stringify(patch)} is refused`);
    assert.match(String(refused.error), expected);
    assert.deepEqual((await personaStats()).rulesetSheets![EMBER], sheet, `${JSON.stringify(patch)} changes nothing`);
  }

  // ── Lists: update cells, remove and add rows; null clears back to the default ──
  const second = await update({
    skills: { scrap: null },
    bonuses: { sneak: null },
    fields: { calling: null },
    lists: {
      gear: { update: [{ index: 0, cells: { bulk: 2, packed: null } }], add: [{ name: "Lantern" }] },
      tricks: { add: [{ name: "Smoke", uses: 2, recharge: "scene" }] },
    },
  });
  assert.equal(second.ok, true, `second update: ${second.error ?? ""}`);
  sheet = (await personaStats()).rulesetSheets![EMBER]!;
  assert.deepEqual(sheet.build.skills, {}, "a null tier is untrained again");
  assert.deepEqual(sheet.build.bonuses, {});
  assert.deepEqual(sheet.build.fields, { toughness: 4 }, "a null field reads its default again");
  const gear = (sheet.build.lists as Record<string, Row[]>).gear!;
  assert.deepEqual(gear[0], { name: "Crowbar", swing: "brawn", damage: "1d6", bulk: 2 });
  assert.deepEqual(gear[1], { name: "Lantern" });
  const third = await update({ lists: { gear: { remove: [0] }, tricks: { set: [] } } });
  assert.equal(third.ok, true, `third update: ${third.error ?? ""}`);
  sheet = (await personaStats()).rulesetSheets![EMBER]!;
  assert.deepEqual((sheet.build.lists as Record<string, Row[]>).gear, [{ name: "Lantern" }]);
  assert.equal((sheet.build.lists as Record<string, Row[]>).tricks, undefined, "an emptied list is dropped");

  // A refusal names each row by what a resend calls it: its stored index even after a removal, and
  // add.<n> for a new row. The resend at that index then fixes the row that was named.
  const knacks = await update({ lists: { knacks: { set: [{ name: "A" }, { name: "B" }, { name: "C" }] } } });
  assert.equal(knacks.ok, true, `set with rows: ${knacks.error ?? ""}`);
  const misaimed = await update({
    lists: { knacks: { remove: [0], update: [{ index: 2, cells: { name: null } }], add: [{ notes: "unnamed" }] } },
  });
  assert.equal(misaimed.ok, false);
  assert.match(String(misaimed.error), /lists\.knacks\.2: Column "name" is required/);
  assert.match(String(misaimed.error), /lists\.knacks\.add\.0: Column "name" is required/);
  const aimed = await update({ lists: { knacks: { remove: [0], update: [{ index: 2, cells: { notes: "third" } }] } } });
  assert.equal(aimed.ok, true, `resend at the named index: ${aimed.error ?? ""}`);
  sheet = (await personaStats()).rulesetSheets![EMBER]!;
  assert.deepEqual((sheet.build.lists as Record<string, Row[]>).knacks, [{ name: "B" }, { name: "C", notes: "third" }]);
  // Empty arrays beside set are no second write mode; set: [] still clears; a list entry that asks
  // for nothing is said to change nothing; a null score is the ruleset's default again.
  const replaced = await update({ lists: { knacks: { set: [{ name: "D" }], update: [], remove: [] } } });
  assert.equal(replaced.ok, true, `set beside empty arrays: ${replaced.error ?? ""}`);
  sheet = (await personaStats()).rulesetSheets![EMBER]!;
  assert.deepEqual((sheet.build.lists as Record<string, Row[]>).knacks, [{ name: "D" }]);
  const nothing = await update({ lists: { knacks: { update: [] } } });
  assert.equal(nothing.ok, false);
  assert.match(String(nothing.error), /lists\.knacks: changes nothing/);
  const cleared = await update({ abilities: { brawn: null }, lists: { knacks: { set: [] } } });
  assert.equal(cleared.ok, true, `clear: ${cleared.error ?? ""}`);
  sheet = (await personaStats()).rulesetSheets![EMBER]!;
  assert.equal((sheet.build.abilities as Row).brawn, 0, "a null score reads its default again");
  assert.equal((sheet.build.lists as Record<string, Row[]>).knacks, undefined);
  await update({ abilities: { brawn: 2 } });

  const read = (await mari.executeAction({ action: "persona.rulesetSheet.get", personaId: "rook", rulesetId: EMBER }))
    .output as Row & { values: { abilityMods: Row } };
  assert.equal(read.status, "stored");
  assert.equal(read.values.abilityMods.brawn, 2, "the read carries the worked-out numbers");

  // ── A ruleset that is not installed, and a stored sheet that cannot be read ──
  const missing = await mari.executeAction({
    action: "persona.rulesetSheet.update",
    personaId: "rook",
    rulesetId: "local/nope",
    patch: { abilities: { a: 1 } },
    apply: true,
  });
  assert.equal(missing.ok, false);
  assert.match(String(missing.error), /not installed.*local\/ember-roads/);
  const broken = {
    ...(await personaStats()),
    rulesetSheets: { ...(await personaStats()).rulesetSheets, [GRAVE]: { v: "x" } },
  };
  await db
    .update(personas)
    .set({ personaStats: JSON.stringify(broken) })
    .where(eq(personas.id, "rook"));
  const unreadable = await mari.executeAction({
    action: "persona.rulesetSheet.update",
    personaId: "rook",
    rulesetId: GRAVE,
    patch: { abilities: { sinew: 3 } },
    apply: true,
  });
  assert.equal(unreadable.ok, false);
  assert.match(String(unreadable.error), /cannot be read/);
  assert.deepEqual(
    (await personaStats()).rulesetSheets![GRAVE],
    { v: "x" },
    "an unreadable sheet is never overwritten",
  );

  // ── The character twin, on a different ruleset ──
  const card = await mari.executeAction({
    action: "character.create",
    characterId: "warden",
    data: { name: "Warden", description: "Keeps the gate." },
    apply: true,
  });
  assert.equal(card.ok, true, `character.create: ${card.error ?? ""}`);
  const cardSheet = await mari.executeAction({
    action: "character.rulesetSheet.update",
    characterId: "warden",
    rulesetId: GRAVE,
    patch: {
      abilities: { sinew: 4 },
      skills: { dig: "rating_3" },
      saves: { steel: "rating_2" },
      bonuses: { dig: 3 },
      fields: { watch: "night", lantern: 2 },
      lists: { arms: { add: [{ name: "Spade", rating: "sinew", trade: "dig", dice: "2d10", harm: "blunt" }] } },
    },
    apply: true,
  });
  assert.equal(cardSheet.ok, true, `character update: ${cardSheet.error ?? ""}`);
  const [cardRow] = await db.select().from(characters).where(eq(characters.id, "warden"));
  const data = JSON.parse(String(cardRow!.data)) as Row & {
    extensions: Row & { rulesetSheets: Record<string, { build: Row }> };
  };
  assert.equal(data.description, "Keeps the gate.", "the rest of the card is untouched");
  const build = data.extensions.rulesetSheets[GRAVE]!.build;
  assert.deepEqual(build.abilities, { sinew: 4, nerve: 2, warmth: 2 });
  assert.deepEqual(build.saves, { steel: "rating_2" });
  assert.deepEqual(build.fields, { post: "", watch: "night", lantern: 2 });
  const refusedCard = await mari.executeAction({
    action: "character.rulesetSheet.update",
    characterId: "warden",
    rulesetId: GRAVE,
    patch: { bonuses: { dig: 4 }, fields: { watch: "noon" } },
    apply: true,
  });
  assert.equal(refusedCard.ok, false);
  assert.match(String(refusedCard.error), /Bonus "dig" takes a whole number from 0 to 3/);
  assert.match(
    String(refusedCard.error),
    /Field "watch" takes one of its declared values/,
    "every problem is listed at once",
  );

  // Worked-out values read live state as it starts, as the editor shows them: Harm still to take is
  // the whole track, not 0.
  const cardRead = (
    await mari.executeAction({ action: "character.rulesetSheet.get", characterId: "warden", rulesetId: GRAVE })
  ).output as Row & { values: { derived: Row } };
  assert.equal(cardRead.values.derived.harm_left, 4);
  const blankRead = (
    await mari.executeAction({ action: "persona.rulesetSheet.get", personaId: "rook", rulesetId: GRAVE })
  ).output as Row;
  assert.equal(blankRead.status, "unreadable");
} finally {
  await closeDB();
  if (previousDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = previousDataDir;
  if (previousFileStorageDir === undefined) delete process.env.FILE_STORAGE_DIR;
  else process.env.FILE_STORAGE_DIR = previousFileStorageDir;
  rmSync(dataDir, { recursive: true, force: true });
}
