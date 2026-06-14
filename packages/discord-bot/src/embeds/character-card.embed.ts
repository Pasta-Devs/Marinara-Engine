import { EmbedBuilder } from "discord.js";
import type { CharacterData } from "@marinara-engine/shared";

const EMBED_COLOR = 0xe85d75;
const FIELD_LIMIT = 1024;
const DESCRIPTION_LIMIT = 4096;

export const CHARACTER_CARD_PAGES = [
  "metadata",
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
  "dialogue",
  "advanced",
] as const;

export type CharacterCardPage = (typeof CHARACTER_CARD_PAGES)[number];

export interface CharacterCardEmbedInput {
  characterId: string;
  data: CharacterData;
  page: CharacterCardPage;
  comment?: string | null;
}

function normalizeText(value: unknown, fallback = "Not set.") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function fieldValue(value: unknown) {
  return truncate(normalizeText(value), FIELD_LIMIT);
}

function pageDescription(value: unknown) {
  return truncate(normalizeText(value), DESCRIPTION_LIMIT);
}

function pageIndex(page: CharacterCardPage) {
  return CHARACTER_CARD_PAGES.indexOf(page) + 1;
}

function baseEmbed(input: CharacterCardEmbedInput) {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(input.data.name || "Unnamed Character")
    .setFooter({ text: `Character ${input.characterId} | Page ${pageIndex(input.page)}/${CHARACTER_CARD_PAGES.length}` });
}

function addTags(embed: EmbedBuilder, tags: string[]) {
  if (tags.length === 0) return;
  embed.addFields({ name: "Tags", value: truncate(tags.join(", "), FIELD_LIMIT) });
}

function buildMetadataPage(input: CharacterCardEmbedInput) {
  const { data } = input;
  const embed = baseEmbed(input).setDescription(input.comment ? truncate(input.comment, DESCRIPTION_LIMIT) : null);
  embed.addFields(
    { name: "Name", value: fieldValue(data.name), inline: true },
    { name: "Creator", value: fieldValue(data.creator), inline: true },
    { name: "Version", value: fieldValue(data.character_version), inline: true },
    { name: "Talkativeness", value: fieldValue(String(data.extensions?.talkativeness ?? "Not set.")), inline: true },
    { name: "Creator Notes", value: fieldValue(data.creator_notes) },
  );
  addTags(embed, Array.isArray(data.tags) ? data.tags : []);
  return embed;
}

export function buildCharacterCardEmbed(input: CharacterCardEmbedInput) {
  const { data, page } = input;

  if (page === "metadata") return buildMetadataPage(input);
  if (page === "description") return baseEmbed(input).setDescription(pageDescription(data.description));
  if (page === "personality") return baseEmbed(input).setDescription(pageDescription(data.personality));
  if (page === "backstory") return baseEmbed(input).setDescription(pageDescription(data.extensions?.backstory));
  if (page === "appearance") return baseEmbed(input).setDescription(pageDescription(data.extensions?.appearance));
  if (page === "scenario") return baseEmbed(input).setDescription(pageDescription(data.scenario));

  if (page === "dialogue") {
    return baseEmbed(input).addFields(
      { name: "First Message", value: fieldValue(data.first_mes) },
      { name: "Example Dialogue", value: fieldValue(data.mes_example) },
    );
  }

  return baseEmbed(input).addFields(
    { name: "System Prompt", value: fieldValue(data.system_prompt) },
    { name: "Post-History Instructions", value: fieldValue(data.post_history_instructions) },
  );
}
