/**
 * Gentle storytelling, violence apart from the rating, and content boundaries (game-story-style.ts):
 *   - a game that never chose them reads the rating text and GM prompt it always has;
 *   - "gentle" swaps the built-in instructions, the agency line and the rating text's closing line, and
 *     says what is worth a roll; a prompt the player wrote stays theirs;
 *   - the violence level changes only the violence lines, so explicit sex and mild violence can go together;
 *   - boundaries reach the system prompt, every turn, the setup and the session's end, and the player's
 *     own rating text does not drop them;
 *   - a prompt preset can carry the three settings; picking it sets style and violence and adds its
 *     boundaries without dropping the game's own.
 */
import assert from "node:assert/strict";
import {
  ANIME_GAME_SYSTEM_PROMPT,
  DEFAULT_GAME_NSFW_RATING_GUIDELINES,
  DEFAULT_GAME_SFW_RATING_GUIDELINES,
  defaultGameRatingGuidelines,
  applyGamePresetStorySettings,
  GENTLE_GAME_SYSTEM_PROMPT,
  mergeGameContentBoundaries,
  parseGamePresetStorySettings,
  serializeGamePresetStorySettings,
  parseGameContentBoundaries,
  resolveGameRatingGuidelines,
  resolveGameViolenceLevel,
} from "../../packages/shared/src/index.js";
import {
  buildCampaignProgressionPrompt,
  buildGmFormatReminder,
  buildGmSystemPrompt,
  buildSessionConclusionPrompt,
  buildSetupPrompt,
} from "../../packages/server/src/services/game/gm-prompts.js";

// Unchosen is what each rating has always meant.
assert.equal(defaultGameRatingGuidelines("nsfw"), DEFAULT_GAME_NSFW_RATING_GUIDELINES);
assert.equal(defaultGameRatingGuidelines("sfw"), DEFAULT_GAME_SFW_RATING_GUIDELINES);
assert.equal(
  resolveGameRatingGuidelines({ rating: "nsfw", violence: "graphic", storyStyle: "standard" }),
  DEFAULT_GAME_NSFW_RATING_GUIDELINES,
);
assert.equal(resolveGameViolenceLevel({ rating: "nsfw" }), "graphic");
assert.equal(resolveGameViolenceLevel({ rating: "sfw" }), "serious");
assert.equal(resolveGameViolenceLevel({ rating: "nsfw", violence: "odd" }), "graphic", "an unknown word is no level");

// Violence apart from sex.
const explicitMild = defaultGameRatingGuidelines("nsfw", { violence: "mild" });
assert.match(explicitMild, /write it explicitly/u);
assert.match(explicitMild, /Violence stays light/u);
assert.doesNotMatch(explicitMild, /graphic|gory|torture, abuse/u);
const fadeGraphic = defaultGameRatingGuidelines("sfw", { violence: "graphic" });
assert.match(fadeGraphic, /fades to black/u);
assert.match(fadeGraphic, /graphic, visceral/u);

// Gentle closing line.
const gentleRating = defaultGameRatingGuidelines("nsfw", { storyStyle: "gentle" });
assert.doesNotMatch(gentleRating, /never soften outcomes for comfort/u);
assert.match(gentleRating, /room for comfort, repair, and recovery/u);

// Boundaries: one per line or ";", bullets and repeats dropped.
assert.deepEqual(parseGameContentBoundaries("- spiders\nself-harm; Spiders\n\n  • drowning "), [
  "spiders",
  "self-harm",
  "drowning",
]);

type SystemContext = Parameters<typeof buildGmSystemPrompt>[0];
const ctx = {
  gameActiveState: "exploration",
  storyArc: null,
  plotTwists: null,
  map: null,
  npcs: [],
  sessionSummaries: [],
  sessionNumber: 1,
  partyNames: [],
  partyCards: [],
  playerName: "Pat",
  playerCard: "Name: Pat",
  gmCharacterCard: null,
  difficulty: "normal",
  genre: "fantasy",
  setting: "original",
  tone: "cozy",
  rating: "nsfw",
} as unknown as SystemContext;

const standard = buildGmSystemPrompt(ctx);
assert.equal(buildGmSystemPrompt({ ...ctx, storyStyle: "standard" }), standard, "standard is the GM as it was");
assert.match(standard, /punish recklessness/u);
const gentle = buildGmSystemPrompt({ ...ctx, storyStyle: "gentle" });
assert.ok(gentle.includes(GENTLE_GAME_SYSTEM_PROMPT));
assert.doesNotMatch(gentle, /punish recklessness|never soften outcomes/u);
// The Storyboard prompt keeps its own lines after the gentle text.
const storyboard = buildGmSystemPrompt({ ...ctx, storyStyle: "gentle", gameSystemPrompt: ANIME_GAME_SYSTEM_PROMPT });
assert.ok(storyboard.includes(GENTLE_GAME_SYSTEM_PROMPT));
assert.match(storyboard, /visual anchor moments/u);
// A prompt the player wrote stays theirs.
const own = buildGmSystemPrompt({ ...ctx, storyStyle: "gentle", gameSystemPrompt: "Be a pirate GM." });
assert.match(own, /<instructions>\nBe a pirate GM.\n<\/instructions>/u);

// Boundaries survive the player's own rating text.
const bounded = buildGmSystemPrompt({
  ...ctx,
  ratingGuidelines: "Anything mild.",
  contentBoundaries: ["spiders", "drowning"],
});
assert.match(bounded, /Anything mild\./u);
assert.match(bounded, /<player_boundaries>[\s\S]*- spiders\n- drowning[\s\S]*<\/player_boundaries>/u);
assert.doesNotMatch(standard, /player_boundaries/u, "none named, none sent");

// The turn reminder.
type ReminderContext = Parameters<typeof buildGmFormatReminder>[0];
const reminderBase = { hasSceneModel: true, rating: "nsfw" } as unknown as ReminderContext;
const standardTurn = buildGmFormatReminder(reminderBase);
assert.match(standardTurn, /No plot armor/u);
assert.match(standardTurn, /Player agency is not player immunity/u);
const gentleTurn = buildGmFormatReminder({ ...reminderBase, storyStyle: "gentle", contentBoundaries: ["spiders"] });
assert.doesNotMatch(gentleTurn, /No plot armor|Player agency is not player immunity/u);
assert.match(gentleTurn, /Never roll against something the character cannot control[^\n]*disability/u);
assert.match(gentleTurn, /A critical failure is a bigger complication, not a catastrophe/u);
assert.match(gentleTurn, /Player boundaries \(hard limits[^\n]*spiders/u);
assert.doesNotMatch(standardTurn, /Player boundaries/u);

// Setup and the session's end plan around the boundaries.
const setup = buildSetupPrompt({ rating: "sfw", storyStyle: "gentle", contentBoundaries: ["spiders"] });
assert.match(setup, /<gentle_game>/u);
assert.match(setup, /Build no arc, twist, faction, quest, or character wound on any of them/u);
assert.doesNotMatch(buildSetupPrompt({ rating: "sfw" }), /gentle_game|player_boundaries/u);
assert.match(
  buildSessionConclusionPrompt({ includeCharacterCards: false, contentBoundaries: ["spiders"] }),
  /- spiders/u,
);
assert.match(buildCampaignProgressionPrompt(null, ["spiders"]), /- spiders/u);
assert.doesNotMatch(buildCampaignProgressionPrompt(null), /player_boundaries/u);

// Prompt presets: none carried leaves the game alone; carried settings set style and violence and add boundaries.
assert.equal(parseGamePresetStorySettings(""), null);
assert.equal(parseGamePresetStorySettings("not json"), null);
assert.equal(serializeGamePresetStorySettings(null), "");
const carried = parseGamePresetStorySettings(
  serializeGamePresetStorySettings({ storyStyle: "gentle", violence: "mild", contentBoundaries: "Spiders\ndrowning" }),
);
assert.deepEqual(carried, { storyStyle: "gentle", violence: "mild", contentBoundaries: "Spiders\ndrowning" });
assert.equal(parseGamePresetStorySettings({ storyStyle: "odd", violence: "odd" })?.violence, null);
const game = { storyStyle: "standard" as const, violence: "graphic" as const, contentBoundaries: "spiders\nfire" };
assert.equal(applyGamePresetStorySettings(game, null), game);
assert.deepEqual(applyGamePresetStorySettings(game, carried), {
  storyStyle: "gentle",
  violence: "mild",
  contentBoundaries: "spiders\nfire\ndrowning",
});
assert.equal(mergeGameContentBoundaries("", "- cats; dogs"), "cats\ndogs");

console.log("game-story-style regression passed");
