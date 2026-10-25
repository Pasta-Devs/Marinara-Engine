// ──────────────────────────────────────────────
// The Game Master's intro message (Capability API 1.339): how a game opens, set in the game's setup and,
// for an Experience, by its creator. A defined intro IS the Game Master's first message, exactly as set;
// a guided one only shapes the first message the Game Master writes. A creator may lock theirs, so a
// player cannot set an intro that breaks the Experience; one left unlocked the player may change or clear.
// ──────────────────────────────────────────────
import { z } from "zod";
import { BUILT_IN_GAME_COMBAT_STYLES } from "../../types/game.js";

/** The longest intro text: a defined intro is a whole first message. */
export const GAME_INTRO_TEXT_MAX = 8000;

const introText = z
  .string()
  .max(GAME_INTRO_TEXT_MAX)
  // Kept exactly as written: a defined intro is the first message, leading and trailing spaces included.
  .refine((value) => value.trim().length > 0, { message: "An intro cannot be blank" })
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), {
    message: "An intro cannot contain control characters",
  })
  .refine((value) => !/\{\{|\}\}/.test(value), { message: "An intro cannot contain macro braces" });

/** An intro as a creator or a player sets it. Guidance reaches the Game Master's prompt, so it never
 *  has a GM tag's square brackets; a defined intro is a message of the Game Master's own and may. */
export const gameIntroSchema = z
  .object({
    mode: z.enum(["defined", "guided"]),
    text: introText,
    /** Set by an Experience's creator: the player cannot change it. */
    locked: z.boolean().optional(),
  })
  .strict()
  .superRefine((intro, ctx) => {
    if (intro.mode === "guided" && /[[\]]/.test(intro.text)) {
      ctx.addIssue({ code: "custom", message: "Guidance cannot contain square brackets" });
    }
  });
export type GameIntro = z.infer<typeof gameIntroSchema>;

/** What a game's setup chose (`chat.metadata.gameIntro`): an intro, or `{ mode: "none" }` for none at
 *  all, the Experience's unlocked one cleared. Absent is the Experience's own, or none. */
export const gameIntroChoiceSchema = z.union([z.object({ mode: z.literal("none") }).strict(), gameIntroSchema]);
export type GameIntroChoice = z.infer<typeof gameIntroChoiceSchema>;

/** The intro a game opens with: the Experience's when its creator locked it, else what the setup chose,
 *  else the Experience's own. Null for none. A setup's own intro is never locked. */
export function gameIntroFor(
  experience: GameIntro | null | undefined,
  chosen: GameIntroChoice | null | undefined,
): GameIntro | null {
  if (experience?.locked) return experience;
  if (chosen) return chosen.mode === "none" ? null : { mode: chosen.mode, text: chosen.text };
  return experience ?? null;
}

/** The setup's choice as kept with a game, read leniently: anything else reads as none chosen. */
export function readGameIntroChoice(value: unknown): GameIntroChoice | null {
  const read = gameIntroChoiceSchema.safeParse(value);
  return read.success ? read.data : null;
}

/** What the Game Master is told on the turn it writes a guided intro. */
export function gameIntroGuidanceText(intro: GameIntro | null | undefined): string {
  if (!intro || intro.mode !== "guided") return "";
  return `This reply is the game's opening message. Write it as you would, guided by this, which its maker set for how the game opens:\n${intro.text}`;
}

/** An intro kept with a game, read leniently: anything that is not one reads as none. */
export function readGameIntro(value: unknown): GameIntro | null {
  const read = gameIntroSchema.safeParse(value);
  return read.success ? read.data : null;
}

const setupText = (max: number) => z.string().trim().min(1).max(max);
/** Genres or tones, joined with commas as a game's setup keeps them (at most 200 characters). */
const setupTags = z
  .array(setupText(60).refine((value) => !value.includes(","), { message: "A genre or tone cannot hold a comma" }))
  .min(1)
  .max(12)
  .refine((values) => values.join(", ").length <= 200, { message: "Too many genres or tones" });

/**
 * An Experience's GM setup values (Capability API 1.372), `contributions.gameSurface.setup.defaults`: what
 * picking the Experience in the Game wizard fills in, each value the player may still change. Only the
 * intro locks, and only when its creator says so. Every key is optional.
 */
export const experienceSetupDefaultsSchema = z
  .object({
    name: setupText(100).optional(),
    genre: setupTags.optional(),
    setting: setupText(4000).optional(),
    tone: setupTags.optional(),
    difficulty: z.enum(["Casual", "Normal", "Hard", "Brutal"]).optional(),
    rating: z.enum(["sfw", "nsfw"]).optional(),
    language: setupText(100).optional(),
    // An Experience names a built-in style only: a registered one exists only in the client that registered it.
    combatStyle: z.enum(BUILT_IN_GAME_COMBAT_STYLES).optional(),
    playerGoals: setupText(2000).optional(),
    preferences: setupText(2000).optional(),
    gameSpecialInstructions: setupText(2000).optional(),
    artStylePrompt: setupText(500).optional(),
    intro: gameIntroSchema.optional(),
  })
  .strict();
export type ExperienceSetupDefaults = z.infer<typeof experienceSetupDefaultsSchema>;
