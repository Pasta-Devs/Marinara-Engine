/**
 * Exposure saves and stops (Capability API 1.364): Noonfield's DC 12 Constitution save, up to 3 levels.
 *
 *   - An exposure's `save` is made by each of the party each time it bites, rolled by the Engine off their
 *     own sheet; only those who fail take its tracks and conditions, as their own `[sheet:]` commands.
 *   - `against` is what the save is made against, so a modifier narrowed to it (a hat's advantage
 *     `against: { conditions: ["noon_light"] }`) counts outside a fight as it does inside one.
 *   - A track's `upTo` stops the move there (`upto=` on the sheet command): never past it, and never
 *     moving one already beyond it. It works on an exposure without a save as well.
 *   - `sparedByShade` (1.365): a shade carried lit by any of the party (a Lantern of Dusk) keeps it off,
 *     as its `if` not holding does; a switched item counts only while on.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  applySheetCommandTags,
  checkStoryScript,
  checkWorldBrief,
  compileGameWorld,
  createSheetCommandTagRegex,
  defaultRulesetSheetBuild,
  parseRulesetDefinition,
  parseSheetCommandTagBody,
  parseWorldKit,
  rulesetItemsShedShade,
  storyCapabilityMinor,
  storyExposureSaveOutcome,
  storyTurn,
  type GameWorld,
  type StoryScriptInput,
} from "../../packages/shared/src/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "marinara-exposure-saves-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
const [
  { buildSkillCheckRulesetContext, resolveSkillCheckWithContext },
  { rollStoryExposureSavesWith, storyPartyCarriesShade },
] = await Promise.all([
  import("../../packages/server/src/services/game/skill-check-resolution.service.js"),
  import("../../packages/server/src/services/game/story-exposure-saves.service.js"),
]);

// ── The script ──
const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((each) => each.id === "high_fantasy")!);
assert.ok(parsedKit.ok);
const kit = parsedKit.kit;
const settlementLayer = kit.layers.find((layer) => layer.settlements)!;
const brief = checkWorldBrief(kit, {
  briefVersion: 1,
  premise: "A valley held at harvest",
  places: [{ name: "Thrushwick", layer: settlementLayer.id, size: kit.sizes.at(-1)!.id, tags: [] }],
});
assert.ok(brief.ok, JSON.stringify(brief));
const stored = { seed: 7, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief: brief.brief };
const game: GameWorld = { kit, ...stored, world: compileGameWorld({ kit, ...stored }) };
const start = game.world.startId!;

const input: StoryScriptInput = {
  storyVersion: 1,
  flags: [],
  exposures: [
    {
      id: "noonfield",
      place: start,
      label: "Noonfield's light",
      hours: 1,
      tracks: [{ track: "exhaustion", by: 1, upTo: 3 }],
      save: { save: "con_save", difficulty: 12, against: { conditions: ["noon_light"] } },
      tell: "Shade or water would help.",
    },
  ],
  events: [],
  cutscenes: [],
  fights: [],
  endings: [],
};
const read = checkStoryScript(game, input);
assert.ok(read.ok, JSON.stringify(read));
const story = read.story;
assert.equal(storyCapabilityMinor(story), 364);
const { save: _save, ...noSave } = input.exposures![0]!;
assert.equal(storyCapabilityMinor(checkStoryScript(game, { ...input, exposures: [noSave] }).story!), 364, "upTo");
assert.equal(
  storyCapabilityMinor(
    checkStoryScript(game, { ...input, exposures: [{ ...noSave, tracks: [{ track: "exhaustion", by: 1 }] }] }).story!,
  ),
  362,
);
assert.ok(
  !checkStoryScript(game, {
    ...input,
    exposures: [{ ...input.exposures![0]!, save: { save: "con_save", difficulty: 1001 } }],
  }).ok,
  "a difficulty to roll against",
);

const turnOf = (replies: string[], clock: number, script = story) =>
  storyTurn(script, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    clock,
  });
const first = turnOf([], 600);
assert.deepEqual(first.saves, []);
// Two hours in the open: two bites, owed a save each, and nothing marked until they are rolled.
const second = turnOf([`${first.prepend}Into the light.`], 720);
assert.equal(second.sheet, "");
assert.equal(second.tells.length, 0);
assert.deepEqual(second.saves, [
  {
    exposure: "noonfield",
    label: "Noonfield's light",
    times: 2,
    hours: 1,
    save: "con_save",
    difficulty: 12,
    against: { conditions: ["noon_light"] },
    tracks: [{ track: "exhaustion", by: 1, upTo: 3 }],
    applies: [],
    tell: "Shade or water would help.",
  },
]);
assert.match(second.prepend, /exposure="noonfield" since="600" bitten="2"/, "recorded once, rolled or not");

// What the saves cost: only failures, each member their own.
const outcome = storyExposureSaveOutcome(second.saves[0]!, [
  { who: "Jory", failed: 2, totals: [7, 9] },
  { who: "Liesl", failed: 0, totals: [15, 13] },
  { who: "Hayward", failed: 1, totals: [11, 14] },
]);
assert.deepEqual(outcome.sheet, [
  '[sheet: who="Jory" op="track" track="exhaustion" by="2" upto="3"]',
  '[sheet: who="Hayward" op="track" track="exhaustion" by="1" upto="3"]',
]);
assert.match(outcome.tell, /Jory failed \(7, 9\); Liesl saved \(15, 13\); Hayward failed 1 of 2 \(11, 14\)/);
assert.match(outcome.tell, /con_save save against 12 each time/);

// ── On a real 5e sheet ──
const fiveE = (() => {
  const doc = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../docs/development/ruleset-5e-2014.example.json", import.meta.url)),
      "utf8",
    ),
  );
  // What an Experience's overlay adds: a hat's shade, advantage on saves against Noonfield's light.
  doc.sheet.live.conditions.push({ id: "hat_shade", label: "Hat's shade" }, { id: "noon_light", label: "Noon light" });
  doc.combat.conditions.push({
    condition: "hat_shade",
    modifiers: [{ to: "saves", mode: "advantage", against: { conditions: ["noon_light"] } }],
  });
  const parsed = parseRulesetDefinition(doc);
  assert.ok(parsed.ok, parsed.ok ? "" : parsed.issues.join("; "));
  return parsed.definition;
})();
const cards = [{ name: "Jory" }, { name: "Liesl" }];
const live = { liesl: { conditions: ["hat_shade"] }, jory: { tracks: { exhaustion: 2 } } };
const context = {
  skills: null,
  attributes: null,
  sheetAttributes: {},
  ruleset: buildSkillCheckRulesetContext(fiveE, cards, cards[0], live),
};
// The hat counts only against what it names.
const faces =
  (...values: number[]) =>
  () =>
    values.shift() ?? 10;
const hatted = resolveSkillCheckWithContext(
  context,
  { skill: "con_save", dc: 12, who: "Liesl", against: { conditions: ["noon_light"] } },
  faces(3, 17),
);
assert.equal(hatted.rollMode, "advantage");
assert.equal(hatted.success, true);
const bare = resolveSkillCheckWithContext(context, { skill: "con_save", dc: 12, who: "Liesl" }, faces(3, 17));
assert.equal(bare.rollMode, "normal", "not against the light, no advantage");
assert.equal(bare.success, false);

// The turn rolled: Jory fails twice, Liesl's hat saves her twice.
const rolled = rollStoryExposureSavesWith(context, { gameCharacterCards: cards }, second, faces(5, 6, 4, 18, 2, 16));
assert.equal(rolled.sheet, '[sheet: who="Jory" op="track" track="exhaustion" by="2" upto="3"]');
assert.ok(
  rolled.tells.some((tell) => tell.includes("Jory failed") && tell.includes("Liesl saved")),
  rolled.tells.join("\n"),
);

// Applied: Jory's exhaustion stops at 3, Liesl's is untouched.
const applied = applySheetCommandTags(rolled.sheet, {
  definition: fiveE,
  cards: cards.map((card) => ({ name: card.name, build: defaultRulesetSheetBuild(fiveE) })),
  playerName: "Jory",
  live,
});
assert.deepEqual(applied.live.jory?.tracks, { exhaustion: 3 });
assert.equal(applied.live.liesl?.tracks, undefined);
// A stop never moves a track already beyond it, and a move with none goes on as before.
const past = applySheetCommandTags('[sheet: who="Jory" op="track" track="exhaustion" by="1" upto="3"]', {
  definition: fiveE,
  cards: [{ name: "Jory", build: defaultRulesetSheetBuild(fiveE) }],
  playerName: "Jory",
  live: { jory: { tracks: { exhaustion: 4 } } },
});
assert.deepEqual(past.live.jory?.tracks, { exhaustion: 4 });
const parsedTag = parseSheetCommandTagBody(' who="Jory" op="track" track="exhaustion" by="1" upto="3"');
assert.deepEqual(parsedTag.op, { op: "track", track: "exhaustion", by: 1, upTo: 3 });
assert.equal(parseSheetCommandTagBody(' op="track" track="exhaustion" to="1" upto="3"').op, null, "not beside to=");

// Without a save, the party's own command carries the stop.
const plain = checkStoryScript(game, { ...input, exposures: [noSave] });
assert.ok(plain.ok);
const plainTurn = turnOf([`${turnOf([], 600, plain.story).prepend}On.`], 720, plain.story);
const commands = [...plainTurn.sheet.matchAll(createSheetCommandTagRegex())].map((match) =>
  parseSheetCommandTagBody(match[1]!),
);
assert.deepEqual(
  commands.map((each) => each.op),
  [{ op: "track", track: "exhaustion", by: 2, upTo: 3 }],
);

// ── Spared by a shade (1.365) ──
const shaded = checkStoryScript(game, {
  ...input,
  exposures: [{ ...input.exposures![0]!, sparedByShade: true }],
});
assert.ok(shaded.ok, JSON.stringify(shaded));
assert.equal(storyCapabilityMinor(shaded.story), 365);
const shadeTurn = (replies: string[], clock: number, shade: boolean) =>
  storyTurn(shaded.story, {
    game,
    replies,
    repliesBefore: replies.length,
    latest: replies.at(-1) ?? null,
    told: [],
    day: 0,
    fight: null,
    clock,
    shade,
  });
assert.equal(shadeTurn([], 600, true).prepend, "", "a lantern lit: it never starts");
const begun = shadeTurn([], 600, false);
assert.match(begun.prepend, /since="600"/);
const lit = shadeTurn([`${begun.prepend}Out.`], 720, true);
assert.match(lit.prepend, /exposure="noonfield" since="" bitten="0"/, "lit later: it ends");
assert.deepEqual(lit.saves, []);
// What counts as a shade carried lit.
const lantern = {
  id: "lantern_of_dusk",
  name: "Lantern of Dusk",
  carried: { light: { bright: 0, dim: 15, shade: true as const } },
};
const hooded = { ...lantern, toggle: { label: "Unhood", budget: "action" } };
const torch = { id: "torch", name: "Torch", carried: { light: { bright: 20, dim: 20 } } };
const held = (item: object, extra: object = {}) => ({ item, quantity: 1, worn: false, ...extra }) as never;
assert.equal(rulesetItemsShedShade([held(lantern)]), true);
assert.equal(rulesetItemsShedShade([held(torch)]), false);
assert.equal(rulesetItemsShedShade([held(hooded)]), false, "switched off");
assert.equal(rulesetItemsShedShade([held(hooded, { on: true })]), true);
assert.equal(
  rulesetItemsShedShade([held({ ...lantern, carried: undefined, worn: lantern.carried }, { worn: true })]),
  true,
);
const carrying = buildSkillCheckRulesetContext(fiveE, cards, cards[0], {}, undefined, (name) =>
  name === "Liesl" ? [held(lantern)] : [],
);
assert.equal(storyPartyCarriesShade({ skills: null, attributes: null, sheetAttributes: {}, ruleset: carrying }), true);
assert.equal(storyPartyCarriesShade(context), false);
assert.equal(storyPartyCarriesShade(null), false);

console.log(
  "Story exposure saves: each of the party rolls, only failures are marked, a track stops where it says, and a shade carried lit spares them.",
);
