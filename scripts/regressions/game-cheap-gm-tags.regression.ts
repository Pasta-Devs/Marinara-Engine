/**
 * Cheap-model Game Master playtest, 2026-10-26 (5e SRD game). What the Engine does with the tags a
 * cheap model writes:
 *
 *   - 14 / 26: a `who=` holding a quoted nickname (`who="Marigold "Mars" Thimblewick"`) is read whole,
 *     and the nickname form finds the card, for a check, a sheet command and an inventory tag. A
 *     `who=` that finds nobody is refused on the record, never applied to somebody else.
 *   - 15: an `[OOC: ...]` answer is shown as an out-of-character note, not dropped as an unknown tag,
 *     and the stray `---` after it goes.
 *   - 21a: a slot spend that names its pool loosely (`pool="spell_slots_2"`), a use that names only
 *     its pool, and a use of a spell not on the sheet that names its pool all pay the slot.
 *   - 21b: a `now=` copied with a `result=` from an Engine record never marks a new command as paid.
 *   - 23: a check the Engine re-rolled that came out unlike the model's own `result=` carries a
 *     correction line after its record, so the reply says the Engine's outcome.
 *   - 24: a leading plan block with labels of its own is lifted off the narration; a scene opening
 *     with speakers or one labelled line is not.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applySheetCommandTags,
  defaultRulesetSheetBuild,
  parseGameNarrationSegments,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  parseSkillCheckTagBody,
  readGmTagAttributes,
  resolveGameInventoryHolder,
  rowsFromCatalogEntry,
  stripGmTags,
  stripGmTagsKeepReadables,
  uniqueCharacterKeyFor,
  type RulesetDefinition,
  type RulesetSheetBuild,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-cheap-gm-tags-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [
  { buildSkillCheckRulesetContext, resolveSkillCheckTagsInContent },
  { extractLeadingGmPlanning, stripStrayRuleLines },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/gm-planning.js"),
]);

try {
  const fiveEText = readFileSync(
    fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
    "utf8",
  );
  const parsed = (doc: unknown): RulesetDefinition => {
    const result = parseRulesetDefinition(doc);
    assert.ok(result.ok, result.ok ? "" : result.issues.join("; "));
    return result.definition;
  };
  const fiveE = parsed(JSON.parse(fiveEText));
  const buildFor = (
    fields: Record<string, string | number | boolean>,
    overrides: Partial<RulesetSheetBuild> = {},
  ): RulesetSheetBuild => {
    const base = defaultRulesetSheetBuild(fiveE);
    return { ...base, ...overrides, fields: { ...base.fields, ...fields } };
  };

  // ── 14 / 26: a quoted nickname inside a `who=` ──
  {
    for (const [body, who] of [
      [`skill="Stealth" dc=15 who="Marigold "Mars" Thimblewick"`, `Marigold "Mars" Thimblewick`],
      [`who="Wren "Pockets" Mossbottom" skill="Sleight of Hand" dc=12`, `Wren "Pockets" Mossbottom`],
    ] as const) {
      const tag = parseSkillCheckTagBody(body);
      assert.equal(tag?.who, who, body);
      assert.ok(tag?.dc, `the attributes after the name are still read: ${body}`);
    }
    // The shapes that read the first quote as the close still do.
    const flag = parseSkillCheckTagBody(`skill="Stealth" advantage who="Bob" dc=10`);
    assert.deepEqual([flag?.skill, flag?.who, flag?.advantage], ["Stealth", "Bob", true]);
    assert.deepEqual(
      readGmTagAttributes(`who='O'Brien' dc=10`).map((one) => [one.key, one.rawValue]),
      [
        ["who", "'O'Brien'"],
        ["dc", "10"],
      ],
    );
    assert.equal(parseSkillCheckTagBody(`skill="Stealth" dc=15 who="Mira`)?.who, "Mira", "an unclosed quote");
    const tight = parseSkillCheckTagBody(`skill="Stealth"dc=15 who="Bob"`);
    assert.deepEqual(
      [tight?.skill, tight?.dc, tight?.who],
      ["Stealth", 15, "Bob"],
      "a value closed right against a key",
    );
    const sheet = parseSheetCommandTagBody(`who="Marigold "Mars" Thimblewick" op="spend" pool="hit_dice" amount="1"`);
    assert.equal(sheet.who, `Marigold "Mars" Thimblewick`);
    assert.deepEqual(sheet.op, { op: "spend", pool: "hit_dice", amount: 1 });

    const keys = ["marigold thimblewick", "wren mossbottom"];
    assert.equal(uniqueCharacterKeyFor(keys, `Marigold "Mars" Thimblewick`), "marigold thimblewick");
    assert.equal(uniqueCharacterKeyFor(keys, `Wren “Pockets” Mossbottom`), "wren mossbottom");
    assert.equal(uniqueCharacterKeyFor(keys, `Wren (Pockets) Mossbottom`), "wren mossbottom");
    assert.equal(uniqueCharacterKeyFor(keys, "Mars"), null, "a nickname no card carries finds nobody");
    assert.equal(uniqueCharacterKeyFor(["marigold mars thimblewick"], "Mars"), "marigold mars thimblewick");

    // A check rolls with her sheet's modifier, however her name is written.
    const marigold = buildFor(
      { level: 5, hp_max: 30 },
      { abilities: { str: 8, dex: 20, con: 12, int: 10, wis: 12, cha: 14 }, skills: { stealth: "proficient" } },
    );
    const wren = buildFor(
      { level: 3, hp_max: 20 },
      {
        abilities: { str: 10, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
        skills: { sleight_of_hand: "proficient" },
      },
    );
    const party = [
      { name: "Marigold Thimblewick", rulesetSheet: { v: 1, build: marigold } },
      { name: "Wren Mossbottom", rulesetSheet: { v: 1, build: wren } },
    ];
    const context = {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(fiveE, party, party[0]),
    };
    const roll = async (tag: string) =>
      resolveSkillCheckTagsInContent(tag, { loadContext: async () => context, rulesetPinned: true, rollD20: () => 10 });
    for (const [plain, nicknamed, skill] of [
      ["Marigold Thimblewick", `Marigold "Mars" Thimblewick`, "Stealth"],
      ["Wren Mossbottom", `Wren "Pockets" Mossbottom`, "Sleight of Hand"],
    ] as const) {
      const expected = (await roll(`[skill_check: skill="${skill}" dc=15 who="${plain}"]`)).results![0]!;
      assert.ok(expected.modifier > 0, `${plain} has a modifier to lose`);
      const got = (await roll(`[skill_check: skill="${skill}" dc=15 who="${nicknamed}"]`)).results![0]!;
      assert.equal(got.modifier, expected.modifier, `${nicknamed} rolls with ${plain}'s sheet`);
    }

    // A sheet command finds her too, and one that finds nobody is refused on the record.
    const cards = [
      { name: "Marigold Thimblewick", build: marigold },
      { name: "Wren Mossbottom", build: wren },
    ];
    const sheetContext = { definition: fiveE, cards, playerName: "Marigold Thimblewick", live: {} };
    const spent = applySheetCommandTags(
      `She rests. [sheet: who="Marigold "Mars" Thimblewick" op="spend" pool="hit_dice" amount="1"]`,
      sheetContext,
    );
    assert.equal(spent.outcomes.length, 1);
    assert.deepEqual([spent.outcomes[0]!.ok, spent.outcomes[0]!.who], [true, "Marigold Thimblewick"]);
    assert.match(spent.content, /who="Marigold Thimblewick"/);
    const nobody = applySheetCommandTags(
      `[sheet: who="Pip Underbough" op="spend" pool="hit_dice" amount="1"]`,
      sheetContext,
    );
    assert.equal(nobody.outcomes[0]!.ok, false);
    assert.match(nobody.content, /result="refused" reason="unknown-character"/);

    // An inventory tag's holder too.
    const holder = resolveGameInventoryHolder(`Wren "Pockets" Mossbottom`, {
      player: "Marigold Thimblewick",
      members: ["Wren Mossbottom"],
    });
    assert.deepEqual(holder, { ok: true, bag: { holder: "Wren Mossbottom" } });
  }

  // ── 15: an OOC answer is shown ──
  {
    const reply = "[OOC: Yes, a short rest here is safe. Spend Hit Dice on your sheet.]\n\n---\n\nThe fire crackles.";
    const segments = parseGameNarrationSegments({ id: "m1", content: reply });
    assert.ok(
      segments.some((segment) => segment.content.includes("(OOC: Yes, a short rest here is safe.")),
      JSON.stringify(segments),
    );
    assert.match(stripGmTags(reply), /^\(OOC: Yes, a short rest here is safe\. Spend Hit Dice on your sheet\.\)/);
    assert.match(
      stripGmTagsKeepReadables("Rain. [ooc : nested [b] fine] More."),
      /Rain\. \(OOC: nested \[b\] fine\) More\./,
    );
    // Another unknown tag is still stripped, and an empty OOC tag leaves nothing.
    assert.equal(stripGmTags("A [mood: grim] night. [OOC: ]"), "A  night.");
    assert.equal(stripStrayRuleLines("(OOC: Yes.)\n\n---\n\nThe fire crackles."), "(OOC: Yes.)\n\nThe fire crackles.");
    const routes = readFileSync(
      fileURLToPath(new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url)),
      "utf8",
    );
    assert.match(routes, /stripStrayRuleLines\(fullResponse\)/, "a game reply loses its stray rules before saving");
  }

  // ── 21a: slots named by their pool ──
  {
    const entries = [
      {
        id: "invisibility",
        label: "Invisibility",
        rows: [{ list: "spells", values: { name: "Invisibility", level: 2, prepared: true } }],
        mechanics: { kind: "utility", cost: [{ pool: "slots_2", amount: 1 }] },
      },
    ];
    const doc = JSON.parse(fiveEText) as Record<string, any>;
    doc.catalogs = [...(doc.catalogs ?? []), { id: "spells", label: "Spells", feeds: ["spells"], entries }];
    const ruleset = parsed(doc);
    const catalogs = { spells: ruleset.catalogs!.find((one) => one.id === "spells")!.entries! };
    const rows = rowsFromCatalogEntry("spells", catalogs.spells[0]!).map((row) => row.row);
    const caster = buildFor(
      { level: 5, hp_max: 30, spellcasting_ability: "wis", slots_max_1: 4, slots_max_2: 3 },
      { lists: { spells: rows } },
    );
    const context = {
      definition: ruleset,
      cards: [{ name: "Ivy", build: caster }],
      playerName: "Ivy",
      live: {},
      catalogs,
    };
    const run = (text: string) => applySheetCommandTags(text, context);
    const slots2 = (result: ReturnType<typeof run>) =>
      (result.live.ivy as { pools?: Record<string, { value: number }> } | undefined)?.pools?.slots_2?.value;

    for (const tag of [
      `[sheet: op="use" name="Invisibility" pool="spell_slots_2"]`,
      `[sheet: op="cast" spell="Invisibility" pool="Level 2 Slot"]`,
      `[sheet: op="spend" pool="spell_slots_2" amount="1"]`,
      `[sheet: op="use" pool="2nd level spell slot"]`,
      // A spell the Engine cannot price still pays the slot it names.
      `[sheet: op="use" name="Pass without Trace" pool="spell_slots_2"]`,
    ]) {
      const result = run(tag);
      assert.equal(result.outcomes[0]?.ok, true, `${tag}: ${result.content}`);
      assert.equal(slots2(result), 2, `${tag} pays one 2nd-level slot: ${result.content}`);
    }
    assert.match(run(`[sheet: op="use" name="Pass without Trace" pool="spell_slots_2"]`).content, /not on the sheet/);
    // Nothing named to pay, or health named, is refused as before.
    assert.match(run(`[sheet: op="use" name="Pass without Trace"]`).content, /reason="unknown-entry"/);
    assert.match(run(`[sheet: op="use" name="Pass without Trace" pool="Hit points"]`).content, /result="refused"/);
    // A use named loosely is still read as an upcast only inside its family.
    assert.match(run(`[sheet: op="use" name="Invisibility" pool="pact_slots"]`).content, /reason="bad-pool"/);
  }

  // ── 21b: an Engine record copied into a new tag ──
  {
    const fighter = buildFor({ level: 5, hp_max: 32 });
    const tell = (text: string) =>
      applySheetCommandTags(text, {
        definition: fiveE,
        cards: [{ name: "Isolde", build: fighter }],
        playerName: "Isolde",
        live: { isolde: { pools: { hp: { value: 20 } } } } as never,
      });
    const hp = (result: ReturnType<typeof tell>) =>
      (result.live.isolde as { pools: Record<string, { value: number }> }).pools.hp!.value;
    const copied = tell(`[sheet: who="Isolde" op="damage" pool="hp" amount="5" result="ok" now="20/32"]`);
    assert.equal(hp(copied), 15, `a copied record's now= is no claim: ${copied.content}`);
    assert.doesNotMatch(copied.content, /already paid/);
    assert.equal(
      parseSheetCommandTagBody(`op="damage" pool="hp" amount="5" result="ok" now="20/32"`).claimed,
      undefined,
    );
    // The Game Master's own now= without a result still says the fight already took it.
    assert.equal(hp(tell(`[sheet: who="Isolde" op="damage" pool="hp" amount="5" now="20/32"]`)), 20);
  }

  // ── 23: a re-rolled check's outcome is said ──
  {
    const legacy = { skills: { Stealth: 2 }, attributes: null, sheetAttributes: {} };
    // Wrong arithmetic (5 + 2 is not 9), so the Engine rolls it again: a 20, a success.
    const failureClaimed = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Stealth" dc=15 rolls="5" modifier="2" total="9" result="failure"] She stumbles into the crate.`,
      { loadContext: async () => legacy, rollD20: () => 20 },
    );
    assert.equal(failureClaimed.results?.[0]?.success, true);
    assert.equal(failureClaimed.corrected, 1);
    assert.match(
      failureClaimed.content,
      /result="(?:critical_)?success"[^\]]*\]\n\n\(Correction: Stealth check is a success \(\d+ against 15\), not the failure first written\. The Engine's roll stands\.\)\n\n ?She stumbles/,
      failureClaimed.content,
    );
    // A re-roll that agrees with what the model wrote says nothing more.
    const agrees = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Stealth" dc=15 rolls="5" modifier="2" total="9" result="success"] She slips past.`,
      { loadContext: async () => legacy, rollD20: () => 20 },
    );
    assert.equal(agrees.corrected, undefined);
    assert.doesNotMatch(agrees.content, /Correction/);
    // A second pass over the saved reply corrects nothing again.
    const again = await resolveSkillCheckTagsInContent(failureClaimed.content, {
      loadContext: async () => legacy,
      rollD20: () => 1,
    });
    assert.equal(again.content, failureClaimed.content);

    // The playtest's shape: a ruleset check whose modifier is not the sheet's, re-rolled to a success.
    const rogue = buildFor(
      { level: 5, hp_max: 30 },
      { abilities: { str: 8, dex: 20, con: 12, int: 10, wis: 12, cha: 14 }, skills: { stealth: "proficient" } },
    );
    const party = [{ name: "Marigold Thimblewick", rulesetSheet: { v: 1, build: rogue } }];
    const ruled = await resolveSkillCheckTagsInContent(
      `[skill_check: skill="Stealth" dc=15 who="Marigold "Mars" Thimblewick" rolls="12" modifier="0" total="12" result="failure"]\n\nThe guard spots her.`,
      {
        loadContext: async () => ({
          skills: null,
          attributes: null,
          sheetAttributes: {},
          ruleset: buildSkillCheckRulesetContext(fiveE, party, party[0]),
        }),
        rulesetPinned: true,
        rollD20: () => 12,
      },
    );
    assert.equal(ruled.results?.[0]?.success, true, ruled.content);
    assert.match(
      ruled.content,
      /\n\n\(Correction: Marigold "Mars" Thimblewick's Stealth check is a success \(\d+ against 15\)/,
    );
    assert.match(ruled.content, /\)\n\nThe guard spots her\.$/);
  }

  // ── 24: a plan block with labels of its own ──
  {
    const plan = [
      "Location: The old mill at the river bend, dusk.",
      "Beats: (1) Wren hears the wheel stop. (2) A nature check reads the tracks. (3) The miller's dog barks.",
      "Commands: place, branch nature check, sfx dog",
    ].join("\n");
    const lifted = extractLeadingGmPlanning(`${plan}\n\nThe mill wheel creaks to a stop.`);
    assert.equal(lifted.content, "The mill wheel creaks to a stop.");
    assert.equal(lifted.planning, plan);
    // Beats on lines of their own, under a label.
    const listed = extractLeadingGmPlanning(
      "Scene: Market.\nNPCs: Brannagh, the fishmonger.\nBeats:\n1. Haggle.\n2. Theft.\n\nGulls wheel overhead.",
    );
    assert.equal(listed.content, "Gulls wheel overhead.");

    for (const reply of [
      // Speakers, even three of them, are a scene.
      "Mira: Welcome back.\nBram: The cellar flooded again.\nOld Tom: Bring a lantern.\n\nRain hammers the roof.",
      // One labelled line opens plenty of scenes.
      "Note: the door is locked.\n\nShe tries the handle anyway.",
      'Mira: "Commands? I give none." She laughs.\nBram: "Beats me."\nTom: "Tags?"\n\nThe tide turns.',
      '[Mira] [main] [smirk]: "Location: anywhere but here."\n\nShe walks off.',
      // A plan that is the whole reply is left for the normal no-output handling.
      plan,
    ]) {
      assert.deepEqual(extractLeadingGmPlanning(reply), { content: reply, planning: "" }, reply);
    }
  }

  console.log(
    "Cheap-GM tags: nicknamed who= finds the card, OOC answers show, named slots are paid, copied records are not claims, re-rolls are corrected, labelled plans are lifted.",
  );
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
