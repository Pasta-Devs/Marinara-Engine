import { EmbedBuilder } from "discord.js";

const EMBED_COLOR = 0xe85d75;
const DESCRIPTION_LIMIT = 4096;

export const PERSONA_CARD_PAGES = ["description", "personality", "backstory", "appearance", "scenario"] as const;

export type PersonaCardPage = (typeof PERSONA_CARD_PAGES)[number];

export interface PersonaCardData {
  id: string;
  name: string;
  comment?: string | null;
  description?: string | null;
  personality?: string | null;
  backstory?: string | null;
  appearance?: string | null;
  scenario?: string | null;
  isActive?: string | boolean | null;
}

export interface PersonaCardEmbedInput {
  persona: PersonaCardData;
  page: PersonaCardPage;
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

function pageIndex(page: PersonaCardPage) {
  return PERSONA_CARD_PAGES.indexOf(page) + 1;
}

function pageLabel(page: PersonaCardPage) {
  if (page === "description") return "Description";
  if (page === "personality") return "Personality";
  if (page === "backstory") return "Backstory";
  if (page === "appearance") return "Appearance";
  return "Scenario";
}

function pageValue(persona: PersonaCardData, page: PersonaCardPage) {
  if (page === "description") return persona.description;
  if (page === "personality") return persona.personality;
  if (page === "backstory") return persona.backstory;
  if (page === "appearance") return persona.appearance;
  return persona.scenario;
}

export function buildPersonaCardEmbed(input: PersonaCardEmbedInput) {
  const activeText = input.persona.isActive === true || input.persona.isActive === "true" ? "Active persona" : null;
  const footerParts = [`Persona ${input.persona.id}`, `Page ${pageIndex(input.page)}/${PERSONA_CARD_PAGES.length}`];
  if (activeText) footerParts.push(activeText);

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(input.persona.name || "Unnamed Persona")
    .setDescription(truncate(normalizeText(pageValue(input.persona, input.page)), DESCRIPTION_LIMIT))
    .setFooter({ text: footerParts.join(" | ") })
    .setAuthor({ name: pageLabel(input.page) });
}
