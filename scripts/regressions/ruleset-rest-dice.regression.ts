/**
 * Dice a rest spends to heal (Capability API 1.335): 5e's Hit Dice on a short rest, Song of Rest's extra
 * die from whoever in the party has it, and Pell's Teapot's +1 on that die.
 *
 *   - `[sheet: op="rest" rest="short" dice="2"]` spends two hit dice, rolls each (the hit die field's
 *     "d10") plus Constitution, never below 0 a die, heals that, then rests.
 *   - The party's best extra die is added once to everybody who spends any, with its holder's bonus.
 *   - Too few dice, or a rest without dice, is refused and changes nothing.
 *   - The tag is written back with its dice; the GM is told about them; the install gate.
 *   - Over several pools (1.337), each its own die: from the pool named, else the first listed that
 *     has any, then the next; the extra die still once.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyRulesetSheetOp,
  applySheetCommandTags,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  rulesetSheetBuildSchema,
  supportedCapabilityApi,
  type RulesetDefinition,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-rest-dice-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.LOG_LEVEL = "silent";
const { getCapabilityPackageInstallIssue } =
  await import("../../packages/server/src/services/capability-packages/package-manager.service.js");

try {
  assert.ok(supportedCapabilityApi.minor >= 335);
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const document = (dice = true): Record<string, any> => {
    const doc = JSON.parse(fiveEText);
    doc.sheet.fields.push(
      { id: "song_die", label: "Song of Rest die", type: "number", min: 0, max: 12, default: 0, section: "combat" },
      { id: "song_bonus", label: "Song of Rest bonus", type: "number", min: 0, max: 5, default: 0, section: "combat" },
    );
    if (dice)
      doc.rests.find((rest: { id: string }) => rest.id === "short").dice = {
        pool: "hit_dice",
        die: { field: "hit_die" },
        add: { abilityMod: "con" },
        heals: "hp",
        extra: { die: { field: "song_die" }, add: { field: "song_bonus" } },
      };
    return doc;
  };
  const parsed = parseRulesetDefinition(document());
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  const definition: RulesetDefinition = parsed.definition;
  const build = (fields: Record<string, unknown>, con = 14) =>
    rulesetSheetBuildSchema.parse({
      abilities: { str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 },
      fields: { level: 4, ac: 12, speed: 30, hp_max: 40, hit_die: "d10", ...fields },
    });
  const ada = build({});
  // Pell the bard: a d6 Song of Rest and the Teapot's +1.
  const pell = build({ hit_die: "d8", song_die: 6, song_bonus: 1 }, 6);
  const hurt = { pools: { hp: { value: 10 } } };
  const roll = (sides: number) => (sides === 10 ? 7 : sides === 6 ? 4 : 5);

  // ── On one sheet ──
  {
    const rested = applyRulesetSheetOp(definition, ada, hurt, { op: "rest", rest: "short", dice: 2 }, roll);
    assert.ok(rested.ok, JSON.stringify(rested));
    // Two d10s of 7, +2 Constitution each: 18, 10 + 18 = 28 of 40; two of four dice left.
    assert.equal(rested.live.pools?.hp?.value, 28);
    assert.equal(rested.live.pools?.hit_dice?.value, 2);
    assert.ok(rested.now.startsWith("2 spent (7, 7): "), rested.now);
    // Without a roller each die counts its average: 5.5 + 2, twice, is 15.
    const averaged = applyRulesetSheetOp(definition, ada, hurt, { op: "rest", rest: "short", dice: 2 });
    assert.ok(averaged.ok);
    assert.equal(averaged.live.pools?.hp?.value, 25);
    // A Constitution of 6 takes 2 a die, but never below 0: a d8 of 1 heals nothing.
    const frail = applyRulesetSheetOp(
      definition,
      build({ hit_die: "d8" }, 6),
      hurt,
      { op: "rest", rest: "short", dice: 1 },
      () => 1,
    );
    assert.ok(frail.ok);
    assert.equal(frail.live.pools?.hp?.value, 10);
    // Pell on their own sheet gets their own song: d8 of 5 - 2 = 3, + d6 of 4 + 1 = 5: 8.
    const own = applyRulesetSheetOp(definition, pell, hurt, { op: "rest", rest: "short", dice: 1 }, roll);
    assert.ok(own.ok);
    assert.equal(own.live.pools?.hp?.value, 18);
    // Refused, nothing changed.
    const short = applyRulesetSheetOp(definition, ada, hurt, { op: "rest", rest: "short", dice: 5 }, roll);
    assert.deepEqual(short, { ok: false, reason: "insufficient" });
    const longRest = applyRulesetSheetOp(definition, ada, hurt, { op: "rest", rest: "long", dice: 1 }, roll);
    assert.deepEqual(longRest, { ok: false, reason: "bad-amount" }, "a long rest spends no dice");
  }

  // ── Kept from healing (Mummy Rot): the dice are spent, nothing is healed, and the rest goes on ──
  {
    const doc = document();
    doc.sheet.live.conditions.push({ id: "rot", label: "Mummy Rot" });
    doc.combat.conditions.push({ condition: "rot", effects: ["cannot-heal"] });
    const rotting = parseRulesetDefinition(doc);
    assert.ok(rotting.ok, rotting.ok ? "" : rotting.issues.join("; "));
    const rested = applyRulesetSheetOp(
      rotting.definition,
      ada,
      { ...hurt, conditions: ["rot"] },
      { op: "rest", rest: "short", dice: 1 },
      roll,
    );
    assert.ok(rested.ok, JSON.stringify(rested));
    assert.equal(rested.live.pools?.hp?.value, 10);
    assert.equal(rested.live.pools?.hit_dice?.value, 3);
    assert.match(rested.now, /Mummy Rot keeps it from healing/);
  }

  // ── The party, with Pell's song ──
  {
    const result = applySheetCommandTags('They rest. [sheet: who="party" op="rest" rest="short" dice="1"]', {
      definition,
      cards: [
        { name: "Ada", build: ada },
        { name: "Pell", build: pell },
      ],
      playerName: "Ada",
      live: { ada: hurt, pell: hurt },
      roll,
    });
    // Ada: d10 of 7 + 2 = 9, + Pell's d6 of 4 + 1 = 5: 24. Pell: 3 + 5 = 18.
    assert.equal(result.live.ada?.pools?.hp?.value, 24, JSON.stringify(result.outcomes));
    assert.equal(result.live.pell?.pools?.hp?.value, 18);
    assert.ok(result.content.includes('dice="1"'), result.content);
  }

  // ── The tag, the GM, the gate ──
  assert.deepEqual(parseSheetCommandTagBody('op="rest" rest="short" dice="3"').op, {
    op: "rest",
    rest: "short",
    dice: 3,
  });
  assert.equal(parseSheetCommandTagBody('op="rest" rest="short" dice="many"').op, null);
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
    "A ruleset with a rest that spends dice to heal requires schemaVersion 2 and capabilityApi 1.335 or newer";
  assert.equal(getCapabilityPackageInstallIssue(manifest(334) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(335) as never, document()), gate);
  assert.notEqual(getCapabilityPackageInstallIssue(manifest(334) as never, document(false)), gate);

  // ── Several pools, each its own die (1.337): a fighter 1 / wizard 1 has one d10 and one d6 ──
  {
    const multi = (() => {
      const doc = document(false);
      doc.sheet.live.pools.push(
        { id: "hit_dice_d10", label: "Hit dice (d10)", group: "hit_dice_group", max: { const: 1 } },
        { id: "hit_dice_d6", label: "Hit dice (d6)", group: "hit_dice_group", max: { const: 1 } },
      );
      const entry = (pool: string, sides: number) => ({
        pool,
        die: { const: sides },
        add: { abilityMod: "con" },
        heals: "hp",
        extra: { die: { field: "song_die" }, add: { field: "song_bonus" } },
      });
      doc.rests.find((rest: { id: string }) => rest.id === "short").dice = [
        entry("hit_dice_d10", 10),
        entry("hit_dice_d6", 6),
      ];
      return doc;
    })();
    const read = parseRulesetDefinition(multi);
    assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
    const several: RulesetDefinition = read.definition;
    const rest = (who: typeof ada, dice: number, pool?: string) =>
      applyRulesetSheetOp(several, who, hurt, { op: "rest", rest: "short", dice, ...(pool ? { pool } : {}) }, roll);
    // Both, the first listed first: d10 of 7 + 2, d6 of 4 + 2: 15.
    const both = rest(ada, 2);
    assert.ok(both.ok, JSON.stringify(both));
    assert.equal(both.live.pools?.hp?.value, 25);
    assert.equal(both.live.pools?.hit_dice_d10?.value, 0);
    assert.equal(both.live.pools?.hit_dice_d6?.value, 0);
    assert.ok(both.now.startsWith("2 spent (7, 4): "), both.now);
    // One, from the first pool that has any.
    const one = rest(ada, 1);
    assert.ok(one.ok);
    assert.equal(one.live.pools?.hp?.value, 19);
    assert.equal(one.live.pools?.hit_dice_d10?.value, 0);
    assert.equal(one.live.pools?.hit_dice_d6?.value, undefined, "untouched, still full");
    // Named: the d6.
    const named = rest(ada, 1, "hit_dice_d6");
    assert.ok(named.ok);
    assert.equal(named.live.pools?.hp?.value, 16);
    assert.equal(named.live.pools?.hit_dice_d10?.value, undefined, "untouched, still full");
    // Written loosely, as a GM might, it is still the d6 (#8271).
    assert.equal(rest(ada, 1, "Hit Dice d6").ok && rest(ada, 1, "hit-dice-d6").live.pools?.hp?.value, 16);
    assert.deepEqual(rest(ada, 2, "hit_dice_d6"), { ok: false, reason: "insufficient" });
    assert.deepEqual(rest(ada, 3), { ok: false, reason: "insufficient" });
    assert.deepEqual(rest(ada, 1, "hit_dice_d12"), { ok: false, reason: "bad-pool" });
    // Song of Rest still comes when only a later pool pays: the d6 named, or the d10 already spent.
    const later = rest(pell, 1, "hit_dice_d6");
    assert.ok(later.ok);
    assert.equal(later.live.pools?.hp?.value, 17, "d6 of 4 - 2, + d6 of 4 + 1");
    const emptied = applyRulesetSheetOp(
      several,
      pell,
      { pools: { hp: { value: 10 }, hit_dice_d10: { value: 0 } } },
      { op: "rest", rest: "short", dice: 1 },
      roll,
    );
    assert.ok(emptied.ok);
    assert.equal(emptied.live.pools?.hp?.value, 17);
    assert.equal(emptied.live.pools?.hit_dice_d6?.value, 0);
    // Pell's song once, not once a pool: d10 of 7 - 2, d6 of 4 - 2, + d6 of 4 + 1: 12.
    const sung = rest(pell, 2);
    assert.ok(sung.ok);
    assert.equal(sung.live.pools?.hp?.value, 22);
    // The tag says which pool, and is written back with it.
    assert.deepEqual(parseSheetCommandTagBody('op="rest" rest="short" dice="1" pool="hit_dice_d6"').op, {
      op: "rest",
      rest: "short",
      dice: 1,
      pool: "hit_dice_d6",
    });
    const tagged = applySheetCommandTags('[sheet: who="Ada" op="rest" rest="short" dice="1" pool="hit_dice_d6"]', {
      definition: several,
      cards: [{ name: "Ada", build: ada }],
      playerName: "Ada",
      live: { ada: hurt },
      roll,
    });
    assert.equal(tagged.live.ada?.pools?.hp?.value, 16, JSON.stringify(tagged.outcomes));
    assert.ok(tagged.content.includes('pool="hit_dice_d6"'), tagged.content);
    const severalGate =
      "A ruleset with a rest that spends dice from several pools requires schemaVersion 2 and capabilityApi 1.337 or newer";
    assert.equal(getCapabilityPackageInstallIssue(manifest(336) as never, multi), severalGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(337) as never, multi), severalGate);
    assert.notEqual(getCapabilityPackageInstallIssue(manifest(336) as never, document()), severalGate);
  }

  // ── The Teapot carried (1.337): an `itemStat` in the extra die's add reads what its holder carries ──
  {
    const doc = document();
    doc.items = {
      categories: [{ id: "gear", label: "Gear" }],
      stats: [{ id: "song_of_rest_add", label: "Song of Rest bonus", type: "number", min: 0, max: 5 }],
    };
    doc.rests.find((rest: { id: string }) => rest.id === "short").dice.extra.add = {
      itemStat: { stat: "song_of_rest_add", from: "carried", pick: "max", default: 0 },
    };
    const read = parseRulesetDefinition(doc);
    assert.ok(read.ok, read.ok ? "" : read.issues.join("; "));
    const teapotRuleset: RulesetDefinition = read.definition;
    const teapot = {
      item: { category: "gear", stats: { song_of_rest_add: 1 } },
      quantity: 1,
      worn: false,
      name: "Teapot",
    };
    const singer = build({ hit_die: "d8", song_die: 6 }, 6);
    const party = (items: unknown[]) =>
      applySheetCommandTags('[sheet: who="party" op="rest" rest="short" dice="1"]', {
        definition: teapotRuleset,
        cards: [
          { name: "Ada", build: ada },
          { name: "Pell", build: singer, items: items as never },
        ],
        playerName: "Ada",
        live: { ada: hurt, pell: hurt },
        roll,
      });
    // Ada: d10 of 7 + 2, + Pell's d6 of 4 + the Teapot's 1: 14 -> 24. Without it, 23.
    assert.equal(party([teapot]).live.ada?.pools?.hp?.value, 24);
    assert.equal(party([]).live.ada?.pools?.hp?.value, 23);
    // On Pell's own sheet too.
    const own = applyRulesetSheetOp(teapotRuleset, singer, hurt, { op: "rest", rest: "short", dice: 1 }, roll, [
      teapot as never,
    ]);
    assert.ok(own.ok);
    assert.equal(own.live.pools?.hp?.value, 18, "d8 of 5 - 2, + d6 of 4 + 1");
  }

  console.log("Rest dice: hit dice spent on a short rest heal, with the party's Song of Rest and the Teapot's +1.");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
