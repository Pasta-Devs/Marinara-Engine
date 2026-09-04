import type { SceneIllustrationCharacterPrompt } from "@marinara-engine/shared";
import { normalizeAvatarLookupName } from "../game/npc-avatar-utils.js";

/**
 * Native NovelAI per-character captions shared by the Storyboard planner and the
 * roleplay Illustrator. NovelAI V4/V4.5 accept up to 6 character captions on a
 * 5x5 grid; V5 accepts 22 on a free canvas. Both take normalized centers.
 */
export const NOVELAI_V4_MAX_CHARACTER_PROMPTS = 6;
export const NOVELAI_V5_MAX_CHARACTER_PROMPTS = 22;

const NOVELAI_CHARACTER_PROMPT_MODEL =
  /^nai-diffusion-(?:4(?:-(?:curated-preview|full))?|4-5(?:-(?:curated|full))?|5(?:-(?:curated|full))?)$/i;
const NOVELAI_V5_MODEL = /^nai-diffusion-5(?:-(?:curated|full))?$/i;

const MAX_CHARACTER_PROMPT_LENGTH = 1400;
const MAX_CHARACTER_NEGATIVE_PROMPT_LENGTH = 700;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function compactText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

/** Whether the model accepts native character captions at all (V4, V4.5, V5). */
export function isNovelAiCharacterPromptModel(model: string): boolean {
  return NOVELAI_CHARACTER_PROMPT_MODEL.test(model.trim());
}

/** Caption cap for a NovelAI model: 22 on V5, 6 on V4/V4.5 and anything unrecognised. */
export function resolveNovelAiCharacterPromptLimit(model: string): number {
  return NOVELAI_V5_MODEL.test(model.trim()) ? NOVELAI_V5_MAX_CHARACTER_PROMPTS : NOVELAI_V4_MAX_CHARACTER_PROMPTS;
}

/**
 * Only a connection that talks to NovelAI's own image host receives the native
 * request body; proxies expose chat completions and would drop the captions.
 */
export function supportsNovelAiCharacterPrompts(connection: { model?: unknown; baseUrl?: unknown }): boolean {
  const baseUrl = readString(connection.baseUrl).toLowerCase();
  if (!baseUrl.includes("novelai.net")) return false;
  return isNovelAiCharacterPromptModel(readString(connection.model));
}

/** Spread characters left-to-right, wrapping onto rows of three past the third. */
export function defaultCharacterPromptPosition(index: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0.5, y: 0.5 };
  if (total <= 3) return { x: (index + 1) / (total + 1), y: 0.5 };

  const columns = 3;
  const rows = Math.ceil(total / columns);
  const row = Math.floor(index / columns);
  const rowStart = row * columns;
  const rowCount = Math.min(columns, total - rowStart);
  return {
    x: (index - rowStart + 1) / (rowCount + 1),
    y: (row + 1) / (rows + 1),
  };
}

export function normalizeCharacterPromptCoordinate(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.min(1, Math.max(0, numeric)) * 100) / 100;
}

function matchCharacterPromptName(value: unknown, characters: string[]): string | null {
  const requested = typeof value === "string" ? normalizeAvatarLookupName(value) : "";
  if (!requested) return null;
  return characters.find((name) => normalizeAvatarLookupName(name) === requested) ?? null;
}

/**
 * Validate prompt-writer output against the scene's visible-character list.
 * Unknown names, duplicates, and empty prompts are dropped; positions clamp to
 * the unit square; missing positions are filled from the default layout; the
 * result is capped at the model's caption limit.
 */
export function sanitizeCharacterPrompts(
  value: unknown,
  characters: string[],
  limit: number,
): SceneIllustrationCharacterPrompt[] {
  if (!Array.isArray(value) || characters.length === 0 || limit <= 0) return [];
  const seen = new Set<string>();
  const candidates: Array<
    Omit<SceneIllustrationCharacterPrompt, "position"> & { position?: { x: number; y: number } }
  > = [];

  for (const rawEntry of value) {
    if (candidates.length >= limit) break;
    const entry = asRecord(rawEntry);
    const name = matchCharacterPromptName(entry.name, characters);
    const prompt = compactText(entry.prompt, MAX_CHARACTER_PROMPT_LENGTH);
    if (!name || !prompt) continue;
    const normalizedName = normalizeAvatarLookupName(name);
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);

    const rawPosition = asRecord(entry.position);
    const hasPosition = rawPosition.x != null || rawPosition.y != null;
    candidates.push({
      name,
      prompt,
      negativePrompt: compactText(entry.negativePrompt, MAX_CHARACTER_NEGATIVE_PROMPT_LENGTH) || undefined,
      position: hasPosition
        ? {
            x: normalizeCharacterPromptCoordinate(rawPosition.x, 0.5),
            y: normalizeCharacterPromptCoordinate(rawPosition.y, 0.5),
          }
        : undefined,
    });
  }

  return candidates.map((entry, index) => ({
    ...entry,
    position: entry.position ?? defaultCharacterPromptPosition(index, candidates.length),
  }));
}

/** Rules shared by every prompt writer that emits NovelAI character captions. */
export const NOVELAI_CHARACTER_PROMPT_RULES = [
  "Start each character prompt with girl, boy, or other without a number, then add the canonical character tag or visual identity traits.",
  "For interactions, use NovelAI action roles such as source#hug, target#hug, or mutual#hug in the relevant character prompts when applicable.",
  "Use negativePrompt to block traits belonging only to the other visible characters. Use an empty string when no character-specific negative is needed.",
  "position is the character's approximate normalized center: x=0 is left, x=1 is right, y=0 is top, y=1 is bottom. Keep positions consistent with camera composition and character order.",
] as const;

/** System-prompt block appended for the roleplay Illustrator when its image connection is native NovelAI. */
export function buildIllustratorCharacterPromptInstruction(limit: number): string {
  if (limit <= 0) return "";
  return [
    "<illustrator_character_prompts>",
    "The image connection is NovelAI with native multi-character prompting enabled for this request.",
    'Extend the JSON you return with "characterPrompts": [ { "name": string, "prompt": string, "negativePrompt": string, "position": { "x": number, "y": number } } ].',
    'When two or more named characters are visible, include exactly one characterPrompts entry for every name in "characters", using the exact same spelling. For zero or one visible character, return an empty characterPrompts array.',
    `Never return more than ${limit} entries. If more characters are visible, keep the most important for this beat and treat the rest as unnamed background.`,
    'Keep "prompt" as the base scene prompt: subject-count tags such as 1girl, 2girls, or 1boy, the shared interaction, camera, composition, environment, lighting, mood, and props. Put character-specific identity, appearance, hair, eyes, build, clothing, expression, pose, and role in that character\'s own prompt so traits never leak between characters.',
    "Fixed traits come from that character's card or persona Appearance field. If the Appearance field is already written as Danbooru tags, copy those tags verbatim into the caption; if it is prose, convert it into Danbooru tags. Do not restate fixed traits in the base prompt.",
    "Clothing comes from the tracker's current outfit for that character when one is present, converted into Danbooru tags; otherwise use what the scene describes. Put the clothing tags in the caption, not the base prompt.",
    ...NOVELAI_CHARACTER_PROMPT_RULES,
    "</illustrator_character_prompts>",
  ].join("\n");
}

/** Read a prompt writer's characterPrompts field off its parsed JSON result. */
export function readCharacterPrompts(
  data: Record<string, unknown>,
  characters: string[],
  limit: number,
): SceneIllustrationCharacterPrompt[] {
  return sanitizeCharacterPrompts(data.characterPrompts, characters, limit);
}

export type CharacterAppearanceSource = { name: string; appearance: string };

const ENSEMBLE_SEGMENT = /\[([^\]]+)\]\s*([^[]*)/g;
const SUBJECT_COUNT_TAG = /^(?:\d+\s*(?:girls?|boys?|others?)|solo)$/i;

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Ensemble cards keep one Appearance block for several characters, written as
 * "[NAME] tags | [NAME] tags". Returns one segment per marker, or null when the
 * block has no markers and therefore describes a single character.
 */
export function splitEnsembleAppearance(appearance: string): CharacterAppearanceSource[] | null {
  const text = appearance.trim();
  if (!text.startsWith("[")) return null;
  const segments: CharacterAppearanceSource[] = [];
  for (const match of text.matchAll(ENSEMBLE_SEGMENT)) {
    const name = (match[1] ?? "").trim();
    const body = (match[2] ?? "")
      .replace(/^[\s,|]+/, "")
      .replace(/[\s,|]+$/, "")
      .trim();
    if (!name) continue;
    segments.push({ name, appearance: body });
  }
  return segments.length > 0 ? segments : null;
}

/** Append only the tags a caption does not already carry; count and solo tags never enter a caption. */
function mergeAppearanceIntoCaption(
  caption: SceneIllustrationCharacterPrompt,
  appearance: string,
): SceneIllustrationCharacterPrompt {
  const present = new Set(splitTags(caption.prompt).map(normalizeTag));
  const additions: string[] = [];
  for (const tag of splitTags(appearance)) {
    const key = normalizeTag(tag);
    if (!key || present.has(key) || SUBJECT_COUNT_TAG.test(key)) continue;
    present.add(key);
    additions.push(tag);
  }
  if (additions.length === 0) return caption;
  return { ...caption, prompt: `${caption.prompt}, ${additions.join(", ")}` };
}

/**
 * Route matched card/persona appearance text into each character's own caption
 * instead of the base prompt, mirroring the Storyboard renderer. Single-character
 * cards that match no caption keep the classic base-prompt line. Ensemble cards
 * are split per marker and never reach the base prompt once captions exist.
 */
export function applyCharacterAppearanceToPrompts(
  prompts: SceneIllustrationCharacterPrompt[],
  appearances: CharacterAppearanceSource[],
): { prompts: SceneIllustrationCharacterPrompt[]; appliedNames: string[]; remainingAppearanceBlock: string | null } {
  const appliedNames: string[] = [];
  const remainingLines: string[] = [];
  const merged = new Map(prompts.map((entry) => [normalizeAvatarLookupName(entry.name), entry] as const));

  const applyTo = (name: string, appearance: string): boolean => {
    const key = normalizeAvatarLookupName(name);
    const caption = merged.get(key);
    if (!caption) return false;
    merged.set(key, mergeAppearanceIntoCaption(caption, appearance));
    if (!appliedNames.includes(caption.name)) appliedNames.push(caption.name);
    return true;
  };

  for (const source of appearances) {
    const appearance = compactText(source.appearance, MAX_CHARACTER_PROMPT_LENGTH);
    if (!appearance) continue;
    const segments = prompts.length > 0 ? splitEnsembleAppearance(appearance) : null;
    if (segments) {
      for (const segment of segments) {
        if (segment.appearance) applyTo(segment.name, segment.appearance);
      }
      continue;
    }
    if (!applyTo(source.name, appearance)) {
      remainingLines.push(`${source.name}'s Appearance: ${appearance}`);
    }
  }

  return {
    prompts: prompts.map((entry) => merged.get(normalizeAvatarLookupName(entry.name)) ?? entry),
    appliedNames,
    remainingAppearanceBlock: remainingLines.length > 0 ? remainingLines.join("\n") : null,
  };
}
