import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type APISelectMenuOption,
} from "discord.js";
import type { DiscordBridgePersonaOption } from "@marinara-engine/shared";
import { PERSONA_CARD_PAGES, type PersonaCardPage } from "../embeds/persona-card.embed.js";

export const PERSONA_SELECT_CUSTOM_ID = "personas:select";
export const PERSONA_PAGE_SELECT_CUSTOM_ID = "personas:page";
export const PERSONA_EDIT_CUSTOM_ID = "personas:edit";
export const PERSONA_SAVE_CUSTOM_ID = "personas:save";
export const PERSONA_USE_CUSTOM_ID = "personas:use";
export const PERSONA_LEAVE_ROSTER_CUSTOM_ID = "personas:leave-roster";
export const PERSONA_EDIT_MODAL_CUSTOM_ID = "personas:edit-modal";
export const PERSONA_CLOSE_CUSTOM_ID = "personas:close";
export const PERSONA_BACK_CUSTOM_ID = "personas:back";
const SELECT_LIMIT = 25;

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function pageLabel(page: PersonaCardPage) {
  if (page === "description") return "Description";
  if (page === "personality") return "Personality";
  if (page === "backstory") return "Backstory";
  if (page === "appearance") return "Appearance";
  return "Scenario";
}

export function buildPersonaPageCustomId(personaId: string) {
  return `${PERSONA_PAGE_SELECT_CUSTOM_ID}:${encodeURIComponent(personaId)}`;
}

export function buildPersonaEditCustomId(personaId: string, page: PersonaCardPage) {
  return `${PERSONA_EDIT_CUSTOM_ID}:${encodeURIComponent(personaId)}:${page}`;
}

export function buildPersonaSaveCustomId(personaId: string, page: PersonaCardPage) {
  return `${PERSONA_SAVE_CUSTOM_ID}:${encodeURIComponent(personaId)}:${page}`;
}

export function buildPersonaUseCustomId(personaId: string) {
  return `${PERSONA_USE_CUSTOM_ID}:${encodeURIComponent(personaId)}`;
}

export function buildPersonaEditModalCustomId(personaId: string, page: PersonaCardPage) {
  return `${PERSONA_EDIT_MODAL_CUSTOM_ID}:${encodeURIComponent(personaId)}:${page}`;
}

export function buildPersonaListComponents(personas: DiscordBridgePersonaOption[]) {
  const selectable = personas.slice(0, SELECT_LIMIT);
  const options: APISelectMenuOption[] = selectable.map((persona, index) => ({
    label: truncate(`${index + 1}. ${persona.name}`, 100),
    value: persona.id,
    description: truncate(persona.comment || persona.id, 100),
  }));

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(PERSONA_SELECT_CUSTOM_ID)
      .setPlaceholder(selectable.length > 0 ? "Select a persona" : "No personas available")
      .setDisabled(selectable.length === 0)
      .addOptions(options.length > 0 ? options : [{ label: "No personas", value: "none" }]),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PERSONA_LEAVE_ROSTER_CUSTOM_ID)
      .setLabel("Leave roster")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(PERSONA_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
  );

  return [selectRow, buttonRow];
}

export function buildPersonaDetailComponents(
  personaId: string,
  selectedPage: PersonaCardPage = "description",
  hasDraft = false,
  isSelectedPersona = false,
) {
  const pageOptions = PERSONA_CARD_PAGES.map((page) => ({
    label: pageLabel(page),
    value: page,
    default: page === selectedPage,
  }));

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildPersonaPageCustomId(personaId))
        .setPlaceholder("Select a persona page")
        .addOptions(pageOptions),
    ),
    buildPersonaDetailButtonRow(personaId, selectedPage, hasDraft, isSelectedPersona),
  ];
}

function buildPersonaDetailButtonRow(
  personaId: string,
  selectedPage: PersonaCardPage,
  hasDraft: boolean,
  isSelectedPersona: boolean,
) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(buildPersonaEditCustomId(personaId, selectedPage))
      .setLabel("Edit")
      .setStyle(ButtonStyle.Primary),
  ];

  if (hasDraft) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildPersonaSaveCustomId(personaId, selectedPage))
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(buildPersonaUseCustomId(personaId))
      .setLabel(isSelectedPersona ? "Using persona" : "Use persona")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isSelectedPersona),
    new ButtonBuilder().setCustomId(PERSONA_BACK_CUSTOM_ID).setLabel("Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(PERSONA_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}
