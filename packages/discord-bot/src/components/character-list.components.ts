import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type APISelectMenuOption,
} from "discord.js";
import type { DiscordBridgeCharacterOption } from "@marinara-engine/shared";
import { CHARACTER_CARD_PAGES, type CharacterCardPage } from "../embeds/character-card.embed.js";
import { getEditableFieldsForPage } from "../core/character-card-fields.js";

export const CHARACTER_SELECT_CUSTOM_ID = "characters:select";
export const CHARACTER_PAGE_SELECT_CUSTOM_ID = "characters:page";
export const CHARACTER_EDIT_CUSTOM_ID = "characters:edit";
export const CHARACTER_SAVE_CUSTOM_ID = "characters:save";
export const CHARACTER_EDIT_MODAL_CUSTOM_ID = "characters:edit-modal";
export const CHARACTER_CLOSE_CUSTOM_ID = "characters:close";
export const CHARACTER_BACK_CUSTOM_ID = "characters:back";
const SELECT_LIMIT = 25;

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

export function buildCharacterListComponents(characters: DiscordBridgeCharacterOption[]) {
  const selectable = characters.slice(0, SELECT_LIMIT);
  const options: APISelectMenuOption[] = selectable.map((character, index) => ({
    label: truncate(`${index + 1}. ${character.name}`, 100),
    value: character.id,
    description: truncate(character.comment || character.id, 100),
  }));

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CHARACTER_SELECT_CUSTOM_ID)
      .setPlaceholder(selectable.length > 0 ? "Select a character" : "No characters available")
      .setDisabled(selectable.length === 0)
      .addOptions(options.length > 0 ? options : [{ label: "No characters", value: "none" }]),
  );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CHARACTER_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
  );

  return [selectRow, buttonRow];
}

export function buildCharacterPageCustomId(characterId: string) {
  return `${CHARACTER_PAGE_SELECT_CUSTOM_ID}:${encodeURIComponent(characterId)}`;
}

export function buildCharacterEditCustomId(characterId: string, page: CharacterCardPage) {
  return `${CHARACTER_EDIT_CUSTOM_ID}:${encodeURIComponent(characterId)}:${page}`;
}

export function buildCharacterSaveCustomId(characterId: string, page: CharacterCardPage) {
  return `${CHARACTER_SAVE_CUSTOM_ID}:${encodeURIComponent(characterId)}:${page}`;
}

export function buildCharacterEditModalCustomId(characterId: string, page: CharacterCardPage) {
  return `${CHARACTER_EDIT_MODAL_CUSTOM_ID}:${encodeURIComponent(characterId)}:${page}`;
}

export function buildCharacterDetailComponents(
  characterId: string,
  selectedPage: CharacterCardPage = "metadata",
  hasDraft = false,
) {
  const pageOptions = CHARACTER_CARD_PAGES.map((page) => ({
    label: pageLabel(page),
    value: page,
    default: page === selectedPage,
  }));

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(buildCharacterPageCustomId(characterId))
        .setPlaceholder("Select a card page")
        .addOptions(pageOptions),
    ),
    buildCharacterDetailButtonRow(characterId, selectedPage, hasDraft),
  ];
}

function buildCharacterDetailButtonRow(characterId: string, selectedPage: CharacterCardPage, hasDraft: boolean) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(buildCharacterEditCustomId(characterId, selectedPage))
      .setLabel("Edit")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(getEditableFieldsForPage(selectedPage).length === 0),
  ];

  if (hasDraft) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(buildCharacterSaveCustomId(characterId, selectedPage))
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
    );
  }

  buttons.push(
    new ButtonBuilder().setCustomId(CHARACTER_BACK_CUSTOM_ID).setLabel("Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CHARACTER_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

function pageLabel(page: CharacterCardPage) {
  if (page === "metadata") return "Metadata";
  if (page === "description") return "Description";
  if (page === "personality") return "Personality";
  if (page === "backstory") return "Backstory";
  if (page === "appearance") return "Appearance";
  if (page === "scenario") return "Scenario";
  if (page === "dialogue") return "Dialogue";
  return "Advanced";
}
