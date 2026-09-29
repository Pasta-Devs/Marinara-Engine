/**
 * Conditions and worn or carried items change checks outside a fight (#6832, Capability API 1.53).
 *
 *   - An item's `worn` and `carried` effects, a condition's or a level's `skills`, a modifier's own
 *     `skills`, `saves` and `mode`, and a rarity cap's `bonus` are read and checked at import, and the
 *     install gate asks for 1.53 for any of them, in the ruleset file and in a catalog file.
 *   - A check reads the character's active conditions, reached levels and worn or carried items: the
 *     numbers add up (dice rolled), advantage and disadvantage cancel and combine with the Game
 *     Master's `mode=`, a save a source fails is failed without a roll, and something narrowed to some
 *     skills or saves changes only those. The record says what applied and reads back after a reload,
 *     and a Game Master's own numbers are never taken for a check something changes.
 *   - A fight keeps what is narrowed to skills out of its contests, and counts a modifier's mode and
 *     own saves.
 *   - An item's details say what it does while worn or carried; the Game Master can give an invented
 *     item worn or carried effects, held to its rarity's bonus.
 *   - The Game Master is told the Engine applies them.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRulesetEncounter,
  defaultRulesetSheetBuild,
  inventRulesetItem,
  parseInventoryTagBody,
  parseRulesetDefinition,
  parseSkillCheckTagBody,
  readRulesetInventedItems,
  rollRulesetCheckModifiers,
  rulesetCheckEffects,
  rulesetCheckMode,
  rulesetCheckRollMode,
  rulesetCheckSources,
  rulesetCombatant,
  rulesetConditionModifiers,
  rulesetItemBook,
  rulesetItemFacts,
  rulesetItemPromptFacts,
  rulesetSaveMode,
  rulesetSheetItems,
  matchRulesetCheckTarget,
  type GameInventoryStack,
  type RulesetCatalogEntry,
  type RulesetCatalogItem,
  type RulesetDefinition,
  type RulesetLiveStates,
  type RulesetSheetItem,
  type SkillCheckResult,
} from "../../packages/shared/src/index.js";
import type { SkillCheckModifierContext } from "../../packages/server/src/services/game/skill-check-resolution.service.js";

// Server modules read DATA_DIR once at load, so they are imported only after it points at scratch.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-ruleset-check-effects-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");

const [
  {
    buildSkillCheckRulesetContext,
    loadSkillCheckModifierContext,
    resolveSkillCheckTagsInContent,
    rulesetCheckModifierFor,
    rulesetCheckThrowsTwice,
  },
  { buildGmFormatReminder },
  { getCapabilityPackageInstallIssue },
  { getDB, closeDB },
  { createChatsStorage },
  { createGameRulesetsStorage },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/gm-prompts.js"),
  import("../../packages/server/src/services/capability-packages/package-manager.service.js"),
  import("../../packages/server/src/db/connection.js"),
  import("../../packages/server/src/services/storage/chats.storage.js"),
  import("../../packages/server/src/services/storage/game-rulesets.storage.js"),
]);
const db = await getDB();

try {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
  const emberText = read("../../docs/examples/rulesets/ember-roads.json");
  const gravewatchText = read("../../docs/examples/rulesets/gravewatch.json");
  const fiveEText = read("../../docs/development/ruleset-5e-2014.example.json");

  const variant = (text: string, edit: (doc: Record<string, any>) => void = () => {}): Record<string, any> => {
    const doc = JSON.parse(text) as Record<string, any>;
    edit(doc);
    return doc;
  };
  const parsedOrThrow = (document: unknown, what: string): RulesetDefinition => {
    const parsed = parseRulesetDefinition(document);
    assert.ok(parsed.ok, `${what} must import cleanly: ${parsed.ok ? "" : parsed.issues.join("; ")}`);
    return parsed.definition;
  };
  /** The file is refused, and one of its issues matches. */
  const refused = (text: string, edit: (doc: Record<string, any>) => void, pattern: RegExp, what: string) => {
    const parsed = parseRulesetDefinition(variant(text, edit));
    assert.equal(parsed.ok, false, `${what}: the file should be refused`);
    if (parsed.ok) return;
    assert.ok(
      parsed.issues.some((issue) => pattern.test(issue)),
      `${what}: expected ${pattern}, got ${parsed.issues.join("; ")}`,
    );
  };
  const itemEntry = (doc: Record<string, any>, id: string) =>
    doc.catalogs
      .find((catalog: { holds?: string }) => catalog.holds === "items")
      .entries.find((entry: { id: string }) => entry.id === id);
  const entriesOf = (definition: RulesetDefinition): Record<string, RulesetCatalogEntry[]> =>
    Object.fromEntries(
      (definition.catalogs ?? []).flatMap((catalog) =>
        catalog.holds === "items" && catalog.entries ? [[catalog.id, catalog.entries]] : [],
      ),
    );

  const ember = parsedOrThrow(JSON.parse(emberText), "Ember Roads");
  const gravewatch = parsedOrThrow(JSON.parse(gravewatchText), "Gravewatch");
  const fiveE = parsedOrThrow(JSON.parse(fiveEText), "the 5e example");
  const emberBook = rulesetItemBook(ember, entriesOf(ember));
  const graveBook = rulesetItemBook(gravewatch, entriesOf(gravewatch));
  const itemOf = (book: typeof emberBook, ref: string): RulesetCatalogItem => {
    const found = book.itemOf(ref)?.entry.item;
    assert.ok(found, `the book has ${ref}`);
    return found;
  };

  // ── Import: worn and carried, skills, saves, mode and the bonus cap ──
  {
    assert.deepEqual(itemOf(emberBook, "outfitter/leather-coat").worn, {
      modifiers: [{ to: "checks", skills: ["sneak"], flat: -1 }],
    });
    assert.deepEqual(itemOf(emberBook, "outfitter/waystone").carried, {
      modifiers: [{ to: "checks", skills: ["sway"], flat: 1 }],
    });
    assert.deepEqual(
      ember.items?.rarityCaps?.map((cap) => cap.bonus),
      [1, 1, 2],
    );
    const worn = (effect: unknown) => (doc: Record<string, any>) => (itemEntry(doc, "leather-coat").item.worn = effect);
    parsedOrThrow(
      variant(emberText, worn({ modifiers: [{ to: "checks", mode: "disadvantage", skills: ["sneak"] }] })),
      "a mode on its own",
    );
    parsedOrThrow(
      variant(fiveEText, (doc) => {
        doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "charmed").modifiers = [
          { to: "saves", saves: ["wis_save"], flat: -1 },
        ];
      }),
      "a save modifier narrowed on its own",
    );
    refused(emberText, worn({}), /An item's effect does something/, "an empty effect");
    refused(emberText, worn({ effects: ["cannot-act"] }), /Invalid enum value/, "an effect only a fight reads");
    refused(
      emberText,
      worn({ modifiers: [{ to: "defense", flat: 1 }] }),
      /An item changes checks and saves; what it does in a fight comes with weapons and armor in a fight/,
      "a defense modifier",
    );
    refused(emberText, worn({ modifiers: [{ to: "checks" }] }), /or for checks and saves by a mode/, "no change");
    refused(
      emberText,
      worn({ modifiers: [{ to: "saves", skills: ["sneak"], flat: 1 }] }),
      /"skills" narrows a change to checks/,
      "skills on a save modifier",
    );
    refused(
      emberText,
      worn({ modifiers: [{ to: "checks", saves: ["steel"], flat: 1 }] }),
      /"saves" narrows a change to saves/,
      "saves on a check modifier",
    );
    refused(
      fiveEText,
      (doc) => doc.combat.conditions.push({ condition: "deafened", modifiers: [{ to: "attacks", mode: "advantage" }] }),
      /"mode" rolls checks or saves twice/,
      "a mode on attacks",
    );
    refused(
      emberText,
      worn({ skills: ["sneak"], failsSaves: ["steel"] }),
      /"skills" narrows own-checks-advantage and own-checks-disadvantage and modifiers to checks/,
      "skills with nothing to narrow",
    );
    refused(
      emberText,
      worn({ modifiers: [{ to: "checks", skills: ["juggle"], flat: 1 }] }),
      /Unknown skill "juggle"/,
      "an unknown skill",
    );
    refused(
      emberText,
      worn({ skills: ["juggle"], effects: ["own-checks-disadvantage"] }),
      /Unknown skill "juggle"/,
      "an unknown skill on the effect",
    );
    refused(
      gravewatchText,
      (doc) => (itemEntry(doc, "dawn-bell").item.worn = { failsSaves: ["nerve"] }),
      /Unknown save "nerve"/,
      "an unknown save",
    );
    refused(
      fiveEText,
      (doc) =>
        doc.combat.conditions.push({
          condition: "deafened",
          skills: ["juggling"],
          effects: ["own-checks-disadvantage"],
        }),
      /Unknown skill "juggling"/,
      "an unknown skill on a condition",
    );
    refused(
      fiveEText,
      (doc) => doc.combat.levels.push({ track: "exhaustion", at: 4, skills: ["stealth"], effects: ["speed-zero"] }),
      /"skills" narrows/,
      "a level's skills with nothing to narrow",
    );
    refused(emberText, (doc) => (doc.items.rarityCaps[0].bonus = -1), /rarityCaps/, "a negative bonus");
  }

  // ── Install gate: every 1.53 key, in the ruleset file and in a catalog file ──
  {
    const manifest = (minor: number, paths = ["ruleset.json"]) => ({
      schemaVersion: 2,
      capabilityApi: { major: 1, minor },
      builtAgainst: { engineVersion: "2.4.6", engineCommit: "0".repeat(40) },
      id: "ruleset-effects",
      name: "Effects",
      version: "0.1.0",
      description: "A packaged ruleset whose items and conditions change checks.",
      engine: { min: "2.4.6", maxExclusive: "4.0.0" },
      kind: ["ruleset"],
      entrypoints: {},
      contributions: { assets: { paths } },
      files: paths.map((path) => ({ path, sha256: "0".repeat(64), bytes: 10 })),
      permissions: [],
      restartRequired: false,
    });
    const gateIssue = /change checks while worn or carried.*capabilityApi 1\.53/;
    const issue = (minor: number, doc: Record<string, any>, paths?: string[], files?: Map<string, unknown>) =>
      getCapabilityPackageInstallIssue(manifest(minor, paths) as any, doc, files);
    /** Ember Roads without any 1.53 key, to add one back at a time. */
    const bare = (edit: (doc: Record<string, any>) => void = () => {}) =>
      variant(emberText, (doc) => {
        for (const cap of doc.items.rarityCaps) delete cap.bonus;
        for (const entry of doc.catalogs.find((each: { holds?: string }) => each.holds === "items").entries) {
          delete entry.item.worn;
          delete entry.item.carried;
          // And the 1.55 weapons.
          delete entry.item.attack;
        }
        // And the 1.54 level off a derived value.
        doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
        edit(doc);
      });
    assert.equal(issue(52, bare()), null, "the rest of the example stays 1.52");
    assert.match(issue(52, variant(emberText)) ?? "", gateIssue);
    // The whole example is 1.54, for its gauntlets and its level off the bulk carried; without them, 1.53.
    const upTo153 = variant(emberText, (doc) => {
      for (const entry of doc.catalogs.find((each: { holds?: string }) => each.holds === "items").entries) {
        delete entry.item.attack;
      }
      delete itemEntry(doc, "ox-hide-gauntlets").item.worn;
      doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
    });
    assert.equal(issue(53, upTo153), null);
    const cases: Array<[string, (doc: Record<string, any>) => void]> = [
      ["a worn effect", (doc) => (itemEntry(doc, "leather-coat").item.worn = { effects: ["own-checks-disadvantage"] })],
      ["a carried effect", (doc) => (itemEntry(doc, "waystone").item.carried = { effects: ["own-checks-advantage"] })],
      ["a bonus cap", (doc) => (doc.items.rarityCaps[0].bonus = 1)],
      ["a condition's skills", (doc) => (doc.combat.conditions[0].skills = ["sneak"])],
      ["a level's skills", (doc) => (doc.combat.levels[0].skills = ["sneak"])],
      ["a modifier's skills", (doc) => (doc.combat.conditions[1].modifiers[0].skills = ["sneak"])],
      ["a modifier's saves", (doc) => (doc.combat.conditions[1].modifiers[0].saves = ["steel"])],
      ["a modifier's mode", (doc) => (doc.combat.levels[0].modifiers[0].mode = "disadvantage")],
    ];
    for (const [what, edit] of cases) assert.match(issue(52, bare(edit)) ?? "", gateIssue, what);
    // An item's effect in a catalog file is read the same way.
    const inFile = bare((doc) => {
      const catalog = doc.catalogs.find((each: { holds?: string }) => each.holds === "items");
      delete catalog.entries;
      catalog.asset = "catalogs/outfitter.json";
    });
    const entries = bare().catalogs.find((each: { holds?: string }) => each.holds === "items").entries;
    entries.find((entry: { id: string }) => entry.id === "waystone").item.carried = {
      effects: ["own-checks-advantage"],
    };
    const paths = ["ruleset.json", "catalogs/outfitter.json"];
    const files = new Map<string, unknown>([["catalogs/outfitter.json", { entries }]]);
    assert.match(issue(52, inFile, paths, files) ?? "", gateIssue, "a catalog file");
    assert.equal(issue(53, inFile, paths, files), null);
  }

  // ── What changes a check: sources and their parts ──
  {
    const coat = itemOf(emberBook, "outfitter/leather-coat");
    const waystone = itemOf(emberBook, "outfitter/waystone");
    const build = defaultRulesetSheetBuild(ember);
    const names = (items: RulesetSheetItem[]) => rulesetCheckSources(ember, build, undefined, items).map((s) => s.name);
    // Worn while worn, carried while only carried; one item's effect once, however many stacks.
    assert.deepEqual(names([{ item: coat, quantity: 1, worn: true, name: "Old coat" }]), ["Old coat"]);
    assert.deepEqual(names([{ item: coat, quantity: 1, worn: false, name: "Old coat" }]), [], "a coat in the pack");
    assert.deepEqual(names([{ item: waystone, quantity: 2, worn: false, name: "Waystone" }]), ["Waystone"]);
    assert.deepEqual(
      names([
        { item: waystone, quantity: 1, worn: false, name: "Waystone" },
        { item: waystone, quantity: 1, worn: false, name: "Waystone" },
      ]),
      ["Waystone"],
      "two stacks of one item count once",
    );
    // Conditions while active and levels while reached, by their labels.
    const fiveBuild = defaultRulesetSheetBuild(fiveE);
    const live = { conditions: ["poisoned", "charmed"], tracks: { exhaustion: 3 } };
    assert.deepEqual(
      rulesetCheckSources(fiveE, fiveBuild, live).map((source) => source.name),
      ["Charmed", "Poisoned", "Exhaustion 1", "Exhaustion 2", "Exhaustion 3"],
    );
    // What they do to one check or save.
    const sources = rulesetCheckSources(fiveE, fiveBuild, live);
    const target = (name: string) => matchRulesetCheckTarget(fiveE, name);
    assert.deepEqual(rulesetCheckEffects(sources, target("Stealth")), {
      modifiers: [],
      advantage: [],
      disadvantage: ["Poisoned", "Exhaustion 1"],
      fails: [],
    });
    assert.deepEqual(rulesetCheckEffects(sources, target("Dexterity save")).disadvantage, ["Exhaustion 3"]);
    assert.deepEqual(
      rulesetCheckEffects(
        rulesetCheckSources(fiveE, fiveBuild, { conditions: ["paralyzed", "restrained"] }),
        target("Dex save"),
      ),
      { modifiers: [], advantage: [], disadvantage: ["Restrained"], fails: ["Paralyzed"] },
    );
    assert.deepEqual(
      rulesetCheckEffects(rulesetCheckSources(fiveE, fiveBuild, { conditions: ["restrained"] }), target("Wisdom save"))
        .disadvantage,
      [],
      "a save effect narrowed to other saves",
    );
    // Narrowing: a modifier's own skills, else its source's; an ability check or an unknown one reads
    // only what is narrowed to nothing.
    const narrowed = [
      {
        name: "Kit",
        skills: ["stealth"],
        effects: ["own-checks-advantage"],
        modifiers: [
          { to: "checks" as const, flat: 1 },
          { to: "checks" as const, skills: ["perception"], flat: 2 },
          { to: "checks" as const, skills: ["perception"], mode: "disadvantage" as const },
        ],
      },
      { name: "Charm", modifiers: [{ to: "checks" as const, flat: 5 }] },
    ];
    const flats = (name: string) =>
      rulesetCheckEffects(narrowed, target(name) ?? null).modifiers.map(
        (entry) => `${entry.from} ${entry.modifier.flat}`,
      );
    assert.deepEqual(flats("Stealth"), ["Kit 1", "Charm 5"]);
    assert.deepEqual(rulesetCheckEffects(narrowed, target("Stealth")).advantage, ["Kit"]);
    assert.deepEqual(rulesetCheckEffects(narrowed, target("Athletics")).advantage, [], "its effect is about Stealth");
    assert.deepEqual(flats("Perception"), ["Kit 2", "Charm 5"]);
    assert.deepEqual(rulesetCheckEffects(narrowed, target("Perception")).disadvantage, ["Kit"]);
    assert.deepEqual(flats("Strength"), ["Charm 5"], "an ability check");
    assert.deepEqual(rulesetCheckEffects(narrowed, null).modifiers.length, 1, "a check the ruleset cannot name");
    assert.deepEqual(flats("Strength save"), [], "checks are not saves");
    // Leans cancel, with the Game Master's mode= as one more.
    const lean = (advantage: string[], disadvantage: string[]) => ({ advantage, disadvantage });
    assert.equal(rulesetCheckRollMode({}, lean(["a"], [])), "advantage");
    assert.equal(rulesetCheckRollMode({}, lean(["a", "b"], ["c"])), "normal", "any of each cancel");
    assert.equal(rulesetCheckRollMode({ advantage: true }, lean([], ["c"])), "normal");
    assert.equal(rulesetCheckRollMode({ disadvantage: true }, lean([], ["c"])), "disadvantage");
    assert.equal(rulesetCheckRollMode({ advantage: true }, lean([], [])), "advantage");
    // Numbers, with dice rolled and minus taking them away.
    const faces = [3, 4];
    let next = 0;
    const die = () => faces[next++]!;
    assert.deepEqual(
      rollRulesetCheckModifiers(
        [
          { from: "a", modifier: { to: "checks", flat: 2 } },
          { from: "b", modifier: { to: "checks", dice: "1d4" } },
          { from: "c", modifier: { to: "checks", dice: "1d4+1", minus: true } },
        ],
        die,
      ),
      { total: 2 + 3 - 5, rolls: [3, 4] },
    );
  }

  // ── Checks outside a fight, through the resolver a turn uses ──
  const contextFor = (
    definition: RulesetDefinition,
    live?: RulesetLiveStates,
    items?: (name: string) => RulesetSheetItem[],
  ): SkillCheckModifierContext => {
    const party = [
      { name: "Mira", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } },
      { name: "Bram", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(definition) } },
    ];
    return {
      skills: null,
      attributes: null,
      sheetAttributes: {},
      ruleset: buildSkillCheckRulesetContext(definition, party, party[0], live, undefined, items),
    };
  };
  const resolve = async (context: SkillCheckModifierContext, tag: string) =>
    resolveSkillCheckTagsInContent(tag, { loadContext: async () => context, rulesetPinned: true });
  const only = (rolled: Awaited<ReturnType<typeof resolve>>): SkillCheckResult => {
    assert.equal(rolled.resolved, 1, `one check should have been rolled: ${rolled.content}`);
    return rolled.results![0]!;
  };
  {
    // 5e: poisoned leans a check, the Game Master's advantage cancels it, and a paralyzed character
    // fails a Dexterity save without a roll.
    const poisoned = contextFor(fiveE, { mira: { conditions: ["poisoned"] } });
    const leaned = only(await resolve(poisoned, `[skill_check: skill="Stealth" dc="10"]`));
    assert.equal(leaned.rollMode, "disadvantage");
    assert.equal(leaned.rolls.length, 2);
    assert.equal(leaned.usedRoll, Math.min(...leaned.rolls));
    assert.deepEqual(leaned.from, ["Poisoned"]);
    assert.equal(leaned.effects, undefined, "a lean adds no number");
    const helped = only(await resolve(poisoned, `[skill_check: skill="Stealth" dc="10" mode="advantage"]`));
    assert.equal(helped.rollMode, "normal", "advantage and disadvantage cancel");
    assert.equal(helped.rolls.length, 1);
    const both = only(await resolve(poisoned, `[skill_check: skill="Stealth" dc="10" mode="disadvantage"]`));
    assert.equal(both.rollMode, "disadvantage", "two disadvantages are one");
    const bram = only(await resolve(poisoned, `[skill_check: skill="Stealth" dc="10" who="Bram"]`));
    assert.equal(bram.rollMode, "normal", "Bram is not poisoned");
    assert.equal(bram.from, undefined);
    assert.equal(rulesetCheckThrowsTwice(poisoned.ruleset!, { skill: "Stealth", dc: 10 }), true);
    assert.equal(rulesetCheckThrowsTwice(poisoned.ruleset!, { skill: "Stealth", dc: 10, advantage: true }), false);

    const paralyzed = contextFor(fiveE, { mira: { conditions: ["paralyzed"] } });
    const failed = only(await resolve(paralyzed, `[skill_check: skill="Dexterity save" dc="12"]`));
    assert.deepEqual(
      [failed.success, failed.automatic, failed.rolls, failed.total, failed.from],
      [false, true, [], 0, ["Paralyzed"]],
    );
    const record = await resolve(paralyzed, `[skill_check: skill="Dexterity save" dc="12"]`);
    assert.match(record.content, /rolls="" .*dice="0d20".* from="Paralyzed" automatic="true"/);
    // The record reads back as the failure it was.
    const body = record.content.slice("[skill_check:".length, -1);
    const back = parseSkillCheckTagBody(body)?.resolvedResult;
    assert.deepEqual(
      [back?.success, back?.automatic, back?.rolls, back?.from],
      [false, true, [], ["Paralyzed"]],
      "an automatic failure survives a reload",
    );
    // A record claiming such a failure is never taken from the Game Master: a ruleset game decides the
    // save again from the sheet, and a game with no ruleset keeps only the ask.
    const claimedFailure = `[skill_check: skill="Dexterity save" dc="12" rolls="" used="0" modifier="0" total="0" result="failure" mode="normal" resolution="sum" dice="0d20" from="Paralyzed" automatic="true"]`;
    const redecided = only(await resolve(contextFor(fiveE), claimedFailure));
    assert.deepEqual([redecided.automatic, redecided.rolls.length], [undefined, 1], "rolled, since nothing fails it");
    const unpinned = await resolveSkillCheckTagsInContent(claimedFailure, {
      loadContext: async () => ({ skills: null, attributes: null, sheetAttributes: {} }),
    });
    assert.equal(unpinned.trusted, 0);
    assert.equal(unpinned.content, `[skill_check: skill="Dexterity save" dc="12"]`, "only the ask is kept");
    const wisdom = only(await resolve(paralyzed, `[skill_check: skill="Wisdom save" dc="12"]`));
    assert.equal(wisdom.automatic, undefined, "a save it does not fail is rolled");
    assert.equal(wisdom.rolls.length, 1);

    // Ember Roads: the coat worn costs Sneak 1, the waystone carried helps Sway, and neither touches
    // the other skills. No advantage in this system, so nothing leans.
    const coat = itemOf(emberBook, "outfitter/leather-coat");
    const waystone = itemOf(emberBook, "outfitter/waystone");
    const dressed = contextFor(ember, undefined, (name) =>
      name === "Mira"
        ? [
            { item: coat, quantity: 1, worn: true, name: "Leather coat" },
            { item: waystone, quantity: 1, worn: false, name: "Waystone" },
          ]
        : [],
    );
    const bare = contextFor(ember);
    const sneak = only(await resolve(dressed, `[skill_check: skill="Sneak" dc="8"]`));
    const plainSneak = only(await resolve(bare, `[skill_check: skill="Sneak" dc="8"]`));
    assert.equal(sneak.modifier, plainSneak.modifier - 1);
    assert.deepEqual([sneak.effects, sneak.from], [-1, ["Leather coat"]]);
    const sway = only(await resolve(dressed, `[skill_check: skill="Sway" dc="8"]`));
    assert.deepEqual([sway.effects, sway.from], [1, ["Waystone"]]);
    const tinker = only(await resolve(dressed, `[skill_check: skill="Tinker" dc="8"]`));
    assert.deepEqual([tinker.effects, tinker.from], [undefined, undefined]);
    const sneakRecord = await resolve(dressed, `[skill_check: skill="Sneak" dc="8"]`);
    assert.match(sneakRecord.content, /effects="-1" from="Leather coat"/);
    const sneakBack = parseSkillCheckTagBody(sneakRecord.content.slice("[skill_check:".length, -1))?.resolvedResult;
    assert.deepEqual([sneakBack?.effects, sneakBack?.from], [-1, ["Leather coat"]], "the record reads back");
    // A Game Master's own numbers are not taken for a check something changes: the Engine rolls it.
    const claimed = `[skill_check: skill="Sneak" dc="8" rolls="6|6" used="12" modifier="${plainSneak.modifier}" total="${12 + plainSneak.modifier}" result="success" mode="normal" resolution="sum" dice="2d6"]`;
    const trusted = await resolve(bare, claimed);
    assert.equal(trusted.trusted, 1, "an unchanged check is vouched for");
    const retaken = await resolve(dressed, claimed);
    assert.equal(retaken.trusted, 0, "a changed one is not");
    assert.match(retaken.content, /effects="-1" from="Leather coat"/);

    // Gravewatch, a pool: the bound bell adds a die to Ward, and Rattled takes one off Soothe.
    const bell = itemOf(graveBook, "kit/dawn-bell");
    const warded = contextFor(gravewatch, { mira: { conditions: ["rattled"] } }, (name) =>
      name === "Mira" ? [{ item: bell, quantity: 1, worn: true, name: "Dawn bell" }] : [],
    );
    const ward = only(await resolve(warded, `[skill_check: skill="Ward" dc="1"]`));
    const sheetPool = rulesetCheckModifierFor(warded.ruleset!, "Ward");
    // The pool the sheet gives and the bell's die, before any die explodes.
    assert.ok(ward.rolls.length >= sheetPool + 1, "one die more");
    assert.deepEqual([ward.effects, ward.from], [1, ["Dawn bell"]]);
    const soothe = only(await resolve(warded, `[skill_check: skill="Soothe" dc="1"]`));
    assert.deepEqual([soothe.effects, soothe.from], [-1, ["Rattled"]]);
  }

  // ── The real loader: a ruleset with items but no itemStat still reads what each card holds ──
  {
    const rulesetId = "local/gravewatch-effects";
    const document = variant(gravewatchText, (doc) => (doc.id = "gravewatch-effects"));
    await createGameRulesetsStorage(db).put({
      rulesetId,
      version: gravewatch.version,
      sourceKind: "local",
      definition: JSON.stringify(document),
    });
    const chats = createChatsStorage(db);
    const chat = await chats.create({ name: "The dawn bell", mode: "game", characterIds: [] });
    await chats.patchMetadata(chat.id, {
      gameRuleset: { id: rulesetId, version: gravewatch.version, packageId: null, options: {} },
      gameCharacterCards: [{ name: "Mira", rulesetSheet: { v: 1, build: defaultRulesetSheetBuild(gravewatch) } }],
      gameInventory: [
        { id: "st-bell", name: "Dawn bell", quantity: 1, item: "kit/dawn-bell", equipped: true, bound: true },
      ],
    });
    const loaded = await loadSkillCheckModifierContext(db, chat.id);
    const ward = only(await resolve(loaded, `[skill_check: skill="Ward" dc="1"]`));
    assert.deepEqual([ward.effects, ward.from], [1, ["Dawn bell"]], "the bound bell, read by the loader a turn uses");
  }

  // ── In a fight: skills stay out of contests; a modifier's mode and own saves count ──
  {
    const fighter = (definition: RulesetDefinition, live: unknown) =>
      rulesetCombatant(
        createRulesetEncounter({
          definition,
          seed: 3,
          combatants: [{ id: "mira", name: "Mira", side: "party", build: defaultRulesetSheetBuild(definition), live }],
        }),
        "mira",
      )!;
    const rattled = fighter(gravewatch, { conditions: ["rattled"] });
    assert.deepEqual(
      rulesetConditionModifiers(gravewatch, gravewatch.combat!, rattled, "attacks").map((one) => one.modifier.flat),
      [-1],
    );
    assert.deepEqual(
      rulesetConditionModifiers(gravewatch, gravewatch.combat!, rattled, "checks"),
      [],
      "narrowed to skills, so not a contest's",
    );
    const leaning = parsedOrThrow(
      variant(fiveEText, (doc) => {
        doc.combat.conditions.find((entry: { condition: string }) => entry.condition === "charmed").modifiers = [
          { to: "checks", mode: "advantage" },
          { to: "checks", skills: ["stealth"], mode: "disadvantage" },
          { to: "saves", saves: ["wis_save"], mode: "disadvantage" },
          { to: "saves", saves: ["wis_save"], flat: -2 },
        ];
      }),
      "modes on a condition",
    );
    const charmed = fighter(leaning, { conditions: ["charmed"] });
    assert.equal(rulesetCheckMode(leaning, leaning.combat!, charmed), "advantage", "the unnarrowed mode only");
    const sneaking = parsedOrThrow(
      variant(fiveEText, (doc) => {
        doc.combat.conditions.push({
          condition: "deafened",
          skills: ["perception"],
          effects: ["own-checks-disadvantage"],
        });
      }),
      "a check effect narrowed to a skill",
    );
    assert.equal(
      rulesetCheckMode(sneaking, sneaking.combat!, fighter(sneaking, { conditions: ["deafened"] })),
      "normal",
      "an effect narrowed to a skill never reaches a contest",
    );
    assert.equal(rulesetSaveMode(leaning, leaning.combat!, charmed, "wis_save"), "disadvantage");
    assert.equal(rulesetSaveMode(leaning, leaning.combat!, charmed, "dex_save"), "normal");
    assert.deepEqual(
      rulesetConditionModifiers(leaning, leaning.combat!, charmed, "saves", undefined, "wis_save").map(
        (one) => one.modifier.flat,
      ),
      [-2],
      "a mode adds no number",
    );
    assert.deepEqual(rulesetConditionModifiers(leaning, leaning.combat!, charmed, "saves", undefined, "dex_save"), []);
  }

  // ── What an item says it does ──
  {
    const facts = rulesetItemFacts(ember, itemOf(emberBook, "outfitter/leather-coat"));
    assert.deepEqual(facts.worn, [{ to: "checks", names: ["Sneak"], change: { value: "-1" } }]);
    assert.equal(facts.carried, undefined);
    assert.match(rulesetItemPromptFacts(facts), /; worn: -1 on checks \(Sneak\)$/);
    const every = rulesetItemFacts(fiveE, {
      category: "gear",
      worn: {
        effects: ["own-saves-advantage"],
        saves: ["dex_save"],
        modifiers: [
          { to: "checks", flat: 1, dice: "1d4", mode: "disadvantage" },
          { to: "saves", dice: "1d6", minus: true },
        ],
        failsSaves: ["str_save"],
      },
    } as RulesetCatalogItem);
    assert.deepEqual(
      every.worn?.map((fact) => rulesetItemPromptFacts({ category: "", tags: [], stats: [], worn: [fact] })),
      [
        "worn: advantage on saves (Dexterity save)",
        "worn: +1d4+1 on checks",
        "worn: disadvantage on checks",
        "worn: -1d6 on saves (Dexterity save)",
        "worn: fails saves (Strength save)",
      ],
    );
  }

  // ── Invented items: worn and carried, held to the bonus ──
  {
    const invent = (proposal: Record<string, string>, like?: RulesetCatalogItem) =>
      inventRulesetItem(ember, { category: "gear", ...proposal }, like)!;
    const lucky = invent({ rarity: "common", worn: "+3 Sneak; disadvantage on Sway checks; -2 Tinker" });
    assert.deepEqual(lucky.item.worn, {
      modifiers: [
        { to: "checks", flat: 1, skills: ["sneak"] },
        { to: "checks", mode: "disadvantage", skills: ["sway"] },
        { to: "checks", flat: -2, skills: ["tinker"] },
      ],
    });
    assert.deepEqual(lucky.notes, ["A bonus while worn is +1 instead of +3, the most at Common."]);
    const dice = invent({ rarity: "storied", carried: "+1d4 Sway; +2 checks" });
    assert.deepEqual(dice.item.carried, { modifiers: [{ to: "checks", flat: 2 }] });
    assert.match(
      dice.notes.join(" "),
      /A bonus in dice cannot be held to Storied's most, so \+1d4 while carried was left out\./,
    );
    const odd = invent({ worn: "+1 Juggle; lots of luck; +1" });
    assert.equal(odd.item.worn, undefined);
    assert.deepEqual(odd.notes.slice(1), [
      'No skill, save or ability "Juggle", so it was left out of "+1 Juggle".',
      '"lots of luck" is not a change such as +1, -1, advantage or fails, so it was left out.',
      '"+1" is not a change such as +1, -1, advantage or fails, so it was left out.',
    ]);
    // Started from a catalog item, its effect comes along and is capped with the rest; "none" drops it.
    const coat = itemOf(emberBook, "outfitter/leather-coat");
    assert.deepEqual(invent({}, coat).item.worn, coat.worn);
    assert.equal(invent({ worn: "none" }, coat).item.worn, undefined);
    assert.deepEqual(invent({ worn: "none" }, coat).notes, [], "none is not a mistake to say");
    // Saves and saves failed, in a ruleset that has them, and no cap where the ruleset sets none.
    const graveInvent = inventRulesetItem(gravewatch, { category: "token", worn: "+3 Steel; fails saves" })!;
    assert.deepEqual(graveInvent.item.worn, {
      modifiers: [{ to: "saves", flat: 3, saves: ["steel"] }],
      failsSaves: ["steel"],
    });
    // The tag's parts, and an invented item read back only while the ruleset still has its words.
    assert.deepEqual(
      parseInventoryTagBody(` action="add" item="Charm" worn="+1 Sneak" carried="advantage on Sway"`)?.proposal,
      { worn: "+1 Sneak", carried: "advantage on Sway" },
    );
    const kept = readRulesetInventedItems(ember, [
      { id: "charm", name: "Charm", item: lucky.item },
      {
        id: "odd",
        name: "Odd",
        item: { category: "gear", worn: { modifiers: [{ to: "checks", skills: ["juggle"], flat: 1 }] } },
      },
    ]);
    assert.deepEqual(
      kept.map((each) => each.id),
      ["charm"],
    );
  }

  // ── What the Game Master is told ──
  {
    const base = { hasSceneModel: true } as never as Parameters<typeof buildGmFormatReminder>[0];
    const told = (ruleset: RulesetDefinition) => buildGmFormatReminder({ ...base, ruleset });
    assert.match(
      told(ember),
      /The engine applies each character's own conditions and what they wear or carry to their checks and saves; do not add those yourself\. A check marked from="\.\.\." says what changed it, and automatic="true" a save that failed without a roll\./,
    );
    assert.match(told(fiveE), /The engine applies each character's own conditions to their checks and saves/);
    assert.match(
      told(gravewatch),
      /The engine applies each character's own conditions and what they wear or carry to their checks/,
    );
    const plain = parsedOrThrow(
      variant(emberText, (doc) => {
        delete doc.items;
        doc.catalogs = doc.catalogs.filter((catalog: { holds?: string }) => catalog.holds !== "items");
        const guard = doc.sheet.derived.find((entry: { id: string }) => entry.id === "guard");
        guard.of = guard.of.filter((ref: { itemStat?: unknown }) => ref.itemStat === undefined);
        doc.sheet.derived = doc.sheet.derived.filter((entry: { id: string }) => entry.id !== "bulk_carried");
        doc.combat.levels = doc.combat.levels.filter((level: { derived?: string }) => level.derived === undefined);
      }),
      "Ember Roads without items",
    );
    assert.doesNotMatch(told(plain), /The engine applies each character's own/, "nothing to apply, nothing said");
  }

  // ── Worn and carried, as the inventory holds them ──
  {
    const stacks: GameInventoryStack[] = [
      { id: "s1", name: "Old coat", quantity: 1, item: "outfitter/leather-coat", equipped: true },
    ];
    assert.deepEqual(
      rulesetSheetItems(emberBook, stacks, undefined).map((each) => each.name),
      ["Old coat"],
      "a record names the stack as the player calls it",
    );
  }

  console.log(
    "Ruleset check effects: import checks, the 1.53 gate, sources and narrowing, checks and saves outside a fight, fights, item facts, invented items and the Game Master's line passed.",
  );
} finally {
  await closeDB();
  rmSync(dataDir, { recursive: true, force: true });
}
