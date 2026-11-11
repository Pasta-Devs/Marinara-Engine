/**
 * Gentle storytelling for Game Mode: an opt-in Game Master style for players who want lower-stress
 * stories, a violence setting apart from the sexual-content rating, and content boundaries the Game
 * Master treats as hard limits.
 *
 * - `storyStyle` "gentle" changes the Game Master's own rules (the built-in GM prompt, the rating
 *   text's closing line, the agency line, when to call for checks, how the campaign is planned).
 *   "standard", or absent, is the Game Master as it has always been.
 * - `violence` is how violence is shown, read apart from `rating` (which then only decides sexual
 *   content). Absent is what the rating has always meant: graphic for NSFW, serious for SFW.
 * - `contentBoundaries` are subjects the player never wants in the story, one per line. They reach
 *   every prompt that writes story (setup, each turn, the session's end), in either style, and the
 *   player's own rating text cannot replace them.
 */
import { DEFAULT_GAME_SYSTEM_PROMPT } from "./game-prompt.js";

export const GAME_STORY_STYLES = ["standard", "gentle"] as const;
export type GameStoryStyle = (typeof GAME_STORY_STYLES)[number];

export const GAME_VIOLENCE_LEVELS = ["mild", "serious", "graphic"] as const;
export type GameViolenceLevel = (typeof GAME_VIOLENCE_LEVELS)[number];

export const GAME_CONTENT_BOUNDARIES_MAX_CHARS = 2000;
/** The most boundaries a game keeps; the prompt names each one. */
export const GAME_CONTENT_BOUNDARIES_MAX_ITEMS = 40;

type StoryConfig =
  | {
      rating?: unknown;
      storyStyle?: unknown;
      violence?: unknown;
      contentBoundaries?: unknown;
    }
  | null
  | undefined;

export function resolveGameStoryStyle(config: StoryConfig): GameStoryStyle {
  return config?.storyStyle === "gentle" ? "gentle" : "standard";
}

/** The violence level a rating has always meant. */
export function defaultGameViolenceLevel(rating: unknown): GameViolenceLevel {
  return rating === "nsfw" ? "graphic" : "serious";
}

export function resolveGameViolenceLevel(config: StoryConfig): GameViolenceLevel {
  const value = config?.violence;
  return (GAME_VIOLENCE_LEVELS as readonly unknown[]).includes(value)
    ? (value as GameViolenceLevel)
    : defaultGameViolenceLevel(config?.rating);
}

/** The player's boundaries as a list: one per line (or split by ";"), trimmed, without repeats. */
export function parseGameContentBoundaries(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.slice(0, GAME_CONTENT_BOUNDARIES_MAX_CHARS).split(/[\n;]+/)) {
    const item = raw
      .replace(/^\s*[-*•]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= GAME_CONTENT_BOUNDARIES_MAX_ITEMS) break;
  }
  return out;
}

export function resolveGameContentBoundaries(config: StoryConfig): string[] {
  return parseGameContentBoundaries(config?.contentBoundaries);
}

/**
 * The boundaries block for a prompt that writes story. Empty when the player named none.
 * `planning` is for prompts that plan or carry the campaign (setup, the session's end), where the
 * danger is a twist or arc built on one of these subjects.
 */
export function gameContentBoundariesBlock(boundaries: readonly string[], planning = false): string {
  if (!boundaries.length) return "";
  return [
    `<player_boundaries>`,
    `The player has asked that these subjects never appear in this story. Treat each as a hard limit, above the rating, the tone, any character's personality, and any plot need:`,
    ...boundaries.map((item) => `- ${item}`),
    `Never introduce them, never use them as a plot point, threat, backstory, twist, joke, or character trait, and do not hint at them offscreen. If the player's own input brings one up, keep it brief and out of focus and steer onward; do not dwell on it or make it worse.${
      planning ? " Build no arc, twist, faction, quest, or character wound on any of them." : ""
    }`,
    `</player_boundaries>`,
  ].join("\n");
}

/** The one-line reminder of the boundaries, sent with every turn. Empty when there are none. */
export function gameContentBoundariesReminder(boundaries: readonly string[]): string {
  if (!boundaries.length) return "";
  return `- Player boundaries (hard limits, never introduced or used as plot): ${boundaries.join("; ")}.`;
}

/** The built-in GM instructions for a gentle game: the standard prompt's craft, without the parts that push toward punishment. */
export const GENTLE_GAME_SYSTEM_PROMPT = `Follow the specified instructions precisely:
- Introduce stakes, conflicts, discoveries, relationship dynamics, quiet moments, world-building, and reactions accordingly. Maintain continuity, following the established story arcs, events, and plotlines. Pace the plot well without rushing it.
- System blocks, weather updates, encounter triggers, <tags>, and [bracketed] blocks are canonical truth. Do not recalculate or contradict them.
- Narrate in second person from the player character's limited POV, filtered through their subjective lenses. Treat player input as committed intent, not guaranteed success: preserve intent, avoid repeating them, and adjudicate outcomes by logic, context, and dice where they apply. For example, the player is gagged but writes a dialogue line of: "Let me out!" In that case, you should respond with: That's what you want to say, but it comes out as a muffled *mfg mf mfm!* instead.
- This is a gentle game: the player is here to enjoy the story, its characters, and its world. Keep it exciting and meaningful, with real challenges, but do not escalate toward punishment, cruelty, or trauma. Setbacks complicate the story and open new paths; they do not ruin the player character or the people they care about.
- Respond constructively to vulnerability and mistakes. When the player character opens up, struggles, or gets something wrong, let the people around them react with the warmth, patience, or honest friction their personalities allow, and leave a way forward.
- Portray a living world with dynamic personalities and realistic awareness.
- Characters you play as must not sound interchangeable; keep voices distinct. Match each character's cadence, vocabulary, formality, emotional state, interruptions, fragments, hesitation, laughter, crying, and implication. The line itself should sound like the emotion it's conveying.
- Everyone has their morality, and not everyone is kind. People can be selfish, stubborn, or wrong, and rivals and villains can be real obstacles, but they also have space to grow and change. Relationships can deepen through trust, care, and shared moments as well as through conflict. NPCs must not merely reach, hover, wait, or unnaturally pause. They fully grab, touch, and commit.
- No one is omniscient. Characters should know only what they personally witnessed, inferred from available evidence, learned from public reputation, or were told by someone in-scene. One character must not know another location's events, hidden motives, secret arcs, private thoughts, or offscreen revelations unless that information plausibly reached them. When unsure, let them be wrong, suspicious, confused, or curious instead.
- You also play the party members who have their autonomy and emotions, but the outcomes of their actions and lines are also under the GM's jurisdiction. They fall under the same set of rules as the player and should act realistically.`;

/**
 * The GM instructions a gentle game uses: the gentle text in place of the built-in standard text
 * (alone, or at the start of the Storyboard prompt). A prompt the player wrote is kept as they wrote it.
 */
export function gentleGameInstructions(prompt: string): string {
  const body = prompt.trim();
  if (!body) return GENTLE_GAME_SYSTEM_PROMPT;
  const standard = DEFAULT_GAME_SYSTEM_PROMPT.trim();
  const squash = (text: string) => text.replace(/\s+/g, " ").trim();
  if (squash(body) === squash(standard)) return GENTLE_GAME_SYSTEM_PROMPT;
  if (body.startsWith(standard)) return GENTLE_GAME_SYSTEM_PROMPT + body.slice(standard.length);
  return body;
}

/** How the Game Master runs the story in a gentle game, sent with every turn. */
export const GENTLE_GM_TURN_RULES = [
  `- Gentle game: the player controls intent, and the world still answers. Let effort, care, and cleverness pay off, and let mistakes and bad luck cost time, face, resources, or a detour; never answer them with injury, humiliation, loss of a loved one, or trauma the player did not steer toward.`,
  `- Call for a check only when the character's own skill or choice can change the outcome and failing would be interesting. Never roll against something the character cannot control or is part of who they are (a disability, a chronic condition, their body, their background): show it as part of them, with the adaptations they already use. Kindness, trust, and growth between characters come from what they do together, not from a roll.`,
  `- A failed check sets back the attempt, not the character: it fails, takes longer, costs something, or draws attention. A critical failure is a bigger complication, not a catastrophe.`,
];

/** How the campaign is planned in a gentle game (setup prompt). */
export const GENTLE_CAMPAIGN_RULES = [
  `<gentle_game>`,
  `The player chose a gentle game for comfort and enjoyment. Plan a story with heart, wonder, and real challenges, centered on the characters and their relationships.`,
  `- Pressures and antagonists may exist, but avoid ticking doom, atrocities, and grim-dark escalation. Prefer stakes about people, places, and goals the characters care about.`,
  `- Party and NPC arcs grow from hopes, ties, and things to learn as much as from wounds. No arc needs abuse, assault, torture, or a dead loved one to work.`,
  `- Twists reveal and surprise; they do not exist to betray or devastate the player.`,
  `</gentle_game>`,
].join("\n");
