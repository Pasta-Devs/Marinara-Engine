import type { CharacterBook, CharacterBookEntry, CharacterData, DepthPrompt } from "../types/character.js";
import { estimateTextTokens } from "./token-estimator.js";

type CharacterTokenData = Partial<Omit<CharacterData, "alternate_greetings" | "character_book" | "extensions">> & {
  alternate_greetings?: unknown;
  character_book?: unknown;
  extensions?: unknown;
};

const CARD_TEXT_FIELDS: Array<keyof CharacterData> = [
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function collectString(value: unknown, output: string[]) {
  const text = asString(value);
  if (text) output.push(text);
}

function collectStringArray(value: unknown, output: string[]) {
  if (!Array.isArray(value)) return;
  for (const item of value) collectString(item, output);
}

function collectDepthPrompt(value: unknown, output: string[]) {
  const depthPrompt = asRecord(value) as Partial<DepthPrompt>;
  collectString(depthPrompt.prompt, output);
}

function collectCharacterBookEntry(entry: Partial<CharacterBookEntry>, output: string[]) {
  collectString(entry.name, output);
  collectString(entry.comment, output);
  collectString(entry.content, output);
  collectStringArray(entry.keys, output);
  collectStringArray(entry.secondary_keys, output);
}

function collectCharacterBook(value: unknown, output: string[]) {
  const book = asRecord(value) as Partial<CharacterBook>;
  collectString(book.name, output);
  collectString(book.description, output);

  if (!Array.isArray(book.entries)) return;
  for (const entry of book.entries) {
    collectCharacterBookEntry(asRecord(entry) as Partial<CharacterBookEntry>, output);
  }
}

/** Estimate all prompt-bearing text stored in a character card. */
export function estimateCharacterCardTokens(data: CharacterTokenData): number {
  const textParts: string[] = [];

  for (const field of CARD_TEXT_FIELDS) {
    collectString(data[field], textParts);
  }

  collectStringArray(data.alternate_greetings, textParts);

  const extensions = asRecord(data.extensions);
  collectString(extensions.backstory, textParts);
  collectString(extensions.appearance, textParts);
  collectString(extensions.world, textParts);
  collectDepthPrompt(extensions.depth_prompt, textParts);

  collectCharacterBook(data.character_book, textParts);

  return estimateTextTokens(textParts.join("\n"));
}
