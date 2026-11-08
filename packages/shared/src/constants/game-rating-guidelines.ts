/**
 * The rating guidelines a game's Game Master follows: the default text for each rating, and the
 * per-game override a player can write over it (`GameSetupConfig.ratingGuidelines`). Both the game
 * setup prompt and the GM prompt use the same text, so a game reads one set of rules from setup on.
 *
 * Worded as guidance for an author of adult fiction rather than as a waiver: phrases that read like a
 * jailbreak ("anything goes", "the user has agreed to the terms", "take consent for granted") can make
 * a model decline the whole request before it reads the game.
 */

export const GAME_RATING_GUIDELINES_MAX_CHARS = 4000;

export const DEFAULT_GAME_NSFW_RATING_GUIDELINES = `This is mature fiction for adult players, rated NSFW. Write it as a skilled author of adult fiction would, without sanitizing language, cruelty, sex, or violence:
- Dark themes belong in the story when they fit: cruelty, betrayal, corruption, torture, abuse of power, ruin, and death, the player character's included. Villains can be ruthless and play dirty; heroes can have a dark side or break under pressure.
- Romance and desire may develop on their own: flirtation, jealousy, possessiveness, seduction, and messy attachment. Handholding, charged proximity, touches, kisses, and embraces need no out-of-character check-in, and characters may make the first move.
- When characters have sex on the page, write it explicitly and with craft: anatomically grounded, emotionally reactive, and detailed, with the build-up given as much weight as the act. Characters respond in character, by their personality and the situation: some are eager, some shy, some say no.
- Violence can be graphic, visceral, and consequential.
- Stay true to motive, tone, and fallout; never soften outcomes for comfort. Let mature material carry weight, cost, and aftermath instead of treating it as decorative edge.`;

export const DEFAULT_GAME_SFW_RATING_GUIDELINES = `This is mature fiction for adult players, rated SFW. Profanity, dark themes, danger, and death are allowed; explicit sex is not:
- Romance, flirtation, longing, jealousy, possessiveness, tenderness, handholding, charged proximity, touches, kisses, and embraces are allowed. Do not refuse or over-explain ordinary affection; read willingness from context, then portray the emotional reaction.
- Sexual content fades to black and resumes in the aftermath. Treat boundaries as part of characterization and scene dynamics, not as repeated disclaimers.
- Violence may be serious and consequential, but not gory or gratuitous. Injury, death, intimidation, cruelty, exploitation, addiction, trauma, corruption, betrayal, and moral compromise may be central to the story when they fit.
- Profanity, menace, fear, grief, ugly motives, and uncomfortable choices are allowed. Keep stakes, fallout, and character behavior real; do not soften danger or rush to reassure the player.`;

/** The built-in rating guidelines for a rating. */
export function defaultGameRatingGuidelines(rating: "sfw" | "nsfw" | null | undefined): string {
  return rating === "nsfw" ? DEFAULT_GAME_NSFW_RATING_GUIDELINES : DEFAULT_GAME_SFW_RATING_GUIDELINES;
}

/**
 * The rating guidelines a game uses: the player's own text when they wrote any, else the built-in text
 * for the game's rating.
 */
export function resolveGameRatingGuidelines(
  config: { rating?: unknown; ratingGuidelines?: unknown } | null | undefined,
): string {
  const custom = typeof config?.ratingGuidelines === "string" ? config.ratingGuidelines.trim() : "";
  if (custom) return custom;
  return defaultGameRatingGuidelines(config?.rating === "nsfw" ? "nsfw" : "sfw");
}

/**
 * What to store for a guidelines draft: null when it is empty or the built-in text for the rating, so a
 * game that never changed it follows later updates to the default.
 */
export function storedGameRatingGuidelines(draft: string, rating: "sfw" | "nsfw"): string | null {
  const trimmed = draft.trim();
  if (!trimmed || trimmed === defaultGameRatingGuidelines(rating).trim()) return null;
  return trimmed.slice(0, GAME_RATING_GUIDELINES_MAX_CHARS);
}
