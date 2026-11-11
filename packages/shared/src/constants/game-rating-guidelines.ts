/**
 * The rating guidelines a game's Game Master follows: the default text for each rating, and the
 * per-game override a player can write over it (`GameSetupConfig.ratingGuidelines`). Both the game
 * setup prompt and the GM prompt use the same text, so a game reads one set of rules from setup on.
 *
 * Worded as guidance for an author of adult fiction rather than as a waiver: phrases that read like a
 * jailbreak ("anything goes", "the user has agreed to the terms", "take consent for granted") can make
 * a model decline the whole request before it reads the game.
 */

import {
  defaultGameViolenceLevel,
  resolveGameStoryStyle,
  resolveGameViolenceLevel,
  type GameStoryStyle,
  type GameViolenceLevel,
} from "./game-story-style.js";

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

/** What else shapes the built-in text: the violence level and the story style (see game-story-style.ts). */
export interface GameRatingGuidelineOptions {
  violence?: GameViolenceLevel | null;
  storyStyle?: GameStoryStyle | null;
}

const VIOLENCE_LINES: Record<GameViolenceLevel, string> = {
  graphic: `- Violence can be graphic, visceral, and consequential.`,
  serious: `- Violence may be serious and consequential, but not gory or gratuitous.`,
  mild: `- Violence stays light: scuffles, peril, and close calls are fine, but injuries are told plainly and briefly, with no gore, torture, or lingering on pain.`,
};

/**
 * The built-in rating guidelines. The rating decides sexual content; violence and story style are read
 * apart from it. With neither given (or both at what the rating has always meant), this is exactly the
 * text each rating has had, so games that never chose them read the same rules.
 */
export function defaultGameRatingGuidelines(
  rating: "sfw" | "nsfw" | null | undefined,
  options: GameRatingGuidelineOptions = {},
): string {
  const nsfw = rating === "nsfw";
  const violence = options.violence ?? defaultGameViolenceLevel(rating);
  const gentle = options.storyStyle === "gentle";
  if (!gentle && violence === defaultGameViolenceLevel(rating)) {
    return nsfw ? DEFAULT_GAME_NSFW_RATING_GUIDELINES : DEFAULT_GAME_SFW_RATING_GUIDELINES;
  }
  const lines: string[] = [];
  lines.push(
    nsfw
      ? `This is mature fiction for adult players, rated NSFW for sexual content. Write it as a skilled author of adult fiction would, without sanitizing language or sex:`
      : `This is fiction for adult players, rated SFW: explicit sex is not part of it.`,
  );
  if (gentle) {
    lines.push(
      `- Conflict, danger, sadness, and loss can be part of the story when they fit, but darkness is never the default direction: do not escalate toward abuse, torture, sexual violence, or trauma unless the player steers there.`,
    );
  } else if (violence === "mild") {
    lines.push(
      `- Danger, rivalry, betrayal, grief, and loss can be part of the story. Cruelty stays brief or offscreen: no torture, mutilation, or dwelling on suffering.`,
    );
  } else {
    lines.push(
      `- Dark themes belong in the story when they fit: cruelty, betrayal, corruption, ${violence === "graphic" ? "torture, " : ""}abuse of power, addiction, ruin, and death, the player character's included. Villains can be ruthless and play dirty; heroes can have a dark side or break under pressure.`,
    );
  }
  lines.push(
    nsfw
      ? `- Romance and desire may develop on their own: flirtation, jealousy, seduction, and messy attachment. Handholding, charged proximity, touches, kisses, and embraces need no out-of-character check-in, and characters may make the first move.`
      : `- Romance, flirtation, longing, jealousy, tenderness, handholding, charged proximity, touches, kisses, and embraces are allowed. Do not refuse or over-explain ordinary affection; read willingness from context, then portray the emotional reaction.`,
  );
  lines.push(
    nsfw
      ? `- When characters have sex on the page, write it explicitly and with craft: anatomically grounded, emotionally reactive, and detailed, with the build-up given as much weight as the act. Characters respond in character, by their personality and the situation: some are eager, some shy, some say no.${
          gentle ? " Intimacy is wanted and mutual; follow the player's lead on how far it goes." : ""
        }`
      : `- Sexual content fades to black and resumes in the aftermath.`,
  );
  lines.push(VIOLENCE_LINES[violence]);
  lines.push(
    gentle
      ? `- Let choices matter and hard moments carry weight, then leave room for comfort, repair, and recovery. Reassurance and kindness are allowed when they fit the characters.`
      : nsfw
        ? `- Stay true to motive, tone, and fallout; never soften outcomes for comfort. Let mature material carry weight, cost, and aftermath instead of treating it as decorative edge.`
        : `- Profanity, menace, fear, grief, ugly motives, and uncomfortable choices are allowed. Keep stakes, fallout, and character behavior real; do not soften danger or rush to reassure the player.`,
  );
  return lines.join("\n");
}

type RatingConfig =
  { rating?: unknown; ratingGuidelines?: unknown; violence?: unknown; storyStyle?: unknown } | null | undefined;

/** The built-in options a game's setup carries. */
export function gameRatingGuidelineOptions(config: RatingConfig): GameRatingGuidelineOptions {
  return { violence: resolveGameViolenceLevel(config), storyStyle: resolveGameStoryStyle(config) };
}

/**
 * The rating guidelines a game uses: the player's own text when they wrote any, else the built-in text
 * for the game's rating, violence level and story style.
 */
export function resolveGameRatingGuidelines(config: RatingConfig): string {
  const custom = typeof config?.ratingGuidelines === "string" ? config.ratingGuidelines.trim() : "";
  if (custom) return custom;
  return defaultGameRatingGuidelines(config?.rating === "nsfw" ? "nsfw" : "sfw", gameRatingGuidelineOptions(config));
}

/**
 * What to store for a guidelines draft: null when it is empty or the built-in text for the rating, so a
 * game that never changed it follows later updates to the default.
 */
export function storedGameRatingGuidelines(
  draft: string,
  rating: "sfw" | "nsfw",
  options: GameRatingGuidelineOptions = {},
): string | null {
  const trimmed = draft.trim();
  if (!trimmed || trimmed === defaultGameRatingGuidelines(rating, options).trim()) return null;
  return trimmed.slice(0, GAME_RATING_GUIDELINES_MAX_CHARS);
}
