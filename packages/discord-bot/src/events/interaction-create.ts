import { ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import {
  CHARACTER_BACK_CUSTOM_ID,
  CHARACTER_CLOSE_CUSTOM_ID,
  CHARACTER_EDIT_CUSTOM_ID,
  CHARACTER_EDIT_MODAL_CUSTOM_ID,
  CHARACTER_PAGE_SELECT_CUSTOM_ID,
  CHARACTER_SAVE_CUSTOM_ID,
  CHARACTER_SELECT_CUSTOM_ID,
  buildCharacterEditModalCustomId,
  buildCharacterDetailComponents,
  buildCharacterListComponents,
} from "../components/character-list.components.js";
import { getBridgeSetupOptions, getCharacterById, updateCharacterFields } from "../core/marinara-api.js";
import { logger } from "../core/logger.js";
import { commands } from "../commands/index.js";
import { CHARACTER_CARD_PAGES, buildCharacterCardEmbed, type CharacterCardPage } from "../embeds/character-card.embed.js";
import { buildCharacterListEmbed } from "../embeds/character-list.embed.js";
import {
  applyCharacterFieldUpdates,
  getCharacterFieldValue,
  getEditableFieldsForPage,
  type EditableCharacterField,
} from "../core/character-card-fields.js";

const CHARACTER_PAGE_SELECT_PREFIX = `${CHARACTER_PAGE_SELECT_CUSTOM_ID}:`;
const CHARACTER_EDIT_PREFIX = `${CHARACTER_EDIT_CUSTOM_ID}:`;
const CHARACTER_SAVE_PREFIX = `${CHARACTER_SAVE_CUSTOM_ID}:`;
const CHARACTER_EDIT_MODAL_PREFIX = `${CHARACTER_EDIT_MODAL_CUSTOM_ID}:`;
const MODAL_VALUE_LIMIT = 4000;

const characterDrafts = new Map<string, Partial<Record<EditableCharacterField, string>>>();

function isCharacterCardPage(value: string): value is CharacterCardPage {
  return CHARACTER_CARD_PAGES.includes(value as CharacterCardPage);
}

function draftKey(userId: string, characterId: string, page: CharacterCardPage) {
  return `${userId}:${characterId}:${page}`;
}

function getDraft(userId: string, characterId: string, page: CharacterCardPage) {
  return characterDrafts.get(draftKey(userId, characterId, page)) ?? {};
}

function hasDraft(userId: string, characterId: string, page: CharacterCardPage) {
  return Object.keys(getDraft(userId, characterId, page)).length > 0;
}

function parseCharacterPageAction(customId: string, prefix: string) {
  const raw = customId.slice(prefix.length);
  const pageSeparator = raw.lastIndexOf(":");
  if (pageSeparator === -1) return null;

  const characterId = decodeURIComponent(raw.slice(0, pageSeparator));
  const page = raw.slice(pageSeparator + 1);
  if (!characterId || !isCharacterCardPage(page)) return null;
  return { characterId, page };
}

function truncateModalValue(value: string) {
  return value.length <= MODAL_VALUE_LIMIT ? value : value.slice(0, MODAL_VALUE_LIMIT);
}

function draftAsUpdateArray(updates: Partial<Record<EditableCharacterField, string>>) {
  return Object.entries(updates).map(([field, value]) => ({ field: field as EditableCharacterField, value: value ?? "" }));
}

export function registerInteractionCreateEvent(client: Client, config: DiscordBridgeConfig) {
  client.on(Events.InteractionCreate, (interaction) => {
    void (async () => {
      if (interaction.isChatInputCommand()) {
        const command = commands.find((candidate) => candidate.data.name === interaction.commandName);
        if (!command) return;
        await command.execute(interaction, config);
        return;
      }

      if (interaction.isButton() && interaction.customId === CHARACTER_CLOSE_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can close this.", ephemeral: true });
          return;
        }
        await interaction.message.delete();
        return;
      }

      if (interaction.isButton() && interaction.customId === CHARACTER_BACK_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this.", ephemeral: true });
          return;
        }
        const setup = await getBridgeSetupOptions(config.serverUrl);
        await interaction.update({
          embeds: [buildCharacterListEmbed(setup.characters)],
          components: buildCharacterListComponents(setup.characters),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith(CHARACTER_EDIT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can edit this.", ephemeral: true });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_EDIT_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character edit target not found.", ephemeral: true });
          return;
        }

        const fields = getEditableFieldsForPage(parsed.page);
        if (fields.length === 0) {
          await interaction.reply({ content: "This page has no editable fields yet.", ephemeral: true });
          return;
        }

        const fullCharacter = await getCharacterById(config.serverUrl, parsed.characterId);
        const draft = getDraft(interaction.user.id, parsed.characterId, parsed.page);
        const draftData = applyCharacterFieldUpdates(fullCharacter.data, draft);
        const modal = new ModalBuilder()
          .setCustomId(buildCharacterEditModalCustomId(parsed.characterId, parsed.page))
          .setTitle(`Edit ${parsed.page}`);

        for (const field of fields) {
          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId(field.field)
                .setLabel(field.label)
                .setStyle(field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(MODAL_VALUE_LIMIT)
                .setValue(truncateModalValue(getCharacterFieldValue(draftData, field.field))),
            ),
          );
        }

        await interaction.showModal(modal);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith(CHARACTER_SAVE_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can save this.", ephemeral: true });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_SAVE_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character save target not found.", ephemeral: true });
          return;
        }

        const key = draftKey(interaction.user.id, parsed.characterId, parsed.page);
        const draft = characterDrafts.get(key);
        if (!draft || Object.keys(draft).length === 0) {
          await interaction.reply({ content: "No edits to save.", ephemeral: true });
          return;
        }

        const updated = await updateCharacterFields(config.serverUrl, parsed.characterId, draftAsUpdateArray(draft));
        characterDrafts.delete(key);
        await interaction.update({
          embeds: [
            buildCharacterCardEmbed({
              characterId: updated.id,
              data: updated.data,
              page: parsed.page,
              comment: updated.comment,
            }),
          ],
          components: buildCharacterDetailComponents(updated.id, parsed.page, false),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === CHARACTER_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this selector.", ephemeral: true });
          return;
        }

        const selectedId = interaction.values[0];
        if (!selectedId || selectedId === "none") return;
        const setup = await getBridgeSetupOptions(config.serverUrl);
        const character = setup.characters.find((candidate) => candidate.id === selectedId);
        if (!character) {
          await interaction.reply({ content: "Character not found.", ephemeral: true });
          return;
        }
        const fullCharacter = await getCharacterById(config.serverUrl, character.id);
        await interaction.update({
          embeds: [
            buildCharacterCardEmbed({
              characterId: fullCharacter.id,
              data: fullCharacter.data,
              page: "metadata",
              comment: fullCharacter.comment,
            }),
          ],
          components: buildCharacterDetailComponents(
            fullCharacter.id,
            "metadata",
            hasDraft(interaction.user.id, fullCharacter.id, "metadata"),
          ),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith(CHARACTER_PAGE_SELECT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this selector.", ephemeral: true });
          return;
        }

        const page = interaction.values[0];
        if (!page || !isCharacterCardPage(page)) {
          await interaction.reply({ content: "Character page not found.", ephemeral: true });
          return;
        }

        const encodedCharacterId = interaction.customId.slice(CHARACTER_PAGE_SELECT_PREFIX.length);
        const characterId = decodeURIComponent(encodedCharacterId);
        const fullCharacter = await getCharacterById(config.serverUrl, characterId);
        const draft = getDraft(interaction.user.id, fullCharacter.id, page);
        const displayData = applyCharacterFieldUpdates(fullCharacter.data, draft);
        await interaction.update({
          embeds: [
            buildCharacterCardEmbed({
              characterId: fullCharacter.id,
              data: displayData,
              page,
              comment: fullCharacter.comment,
            }),
          ],
          components: buildCharacterDetailComponents(fullCharacter.id, page, Object.keys(draft).length > 0),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith(CHARACTER_EDIT_MODAL_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can submit this edit.", ephemeral: true });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_EDIT_MODAL_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character edit target not found.", ephemeral: true });
          return;
        }

        const fullCharacter = await getCharacterById(config.serverUrl, parsed.characterId);
        const updates: Partial<Record<EditableCharacterField, string>> = {};
        for (const field of getEditableFieldsForPage(parsed.page)) {
          const nextValue = interaction.fields.getTextInputValue(field.field);
          if (nextValue !== getCharacterFieldValue(fullCharacter.data, field.field)) {
            updates[field.field] = nextValue;
          }
        }

        const key = draftKey(interaction.user.id, parsed.characterId, parsed.page);
        if (Object.keys(updates).length > 0) {
          characterDrafts.set(key, updates);
        } else {
          characterDrafts.delete(key);
        }

        const displayData = applyCharacterFieldUpdates(fullCharacter.data, updates);
        if (!interaction.message) {
          await interaction.reply({ content: "Character message not found.", ephemeral: true });
          return;
        }

        await interaction.deferUpdate();
        await interaction.message.edit({
          embeds: [
            buildCharacterCardEmbed({
              characterId: fullCharacter.id,
              data: displayData,
              page: parsed.page,
              comment: fullCharacter.comment,
            }),
          ],
          components: buildCharacterDetailComponents(fullCharacter.id, parsed.page, Object.keys(updates).length > 0),
          content: null,
          attachments: [],
        });
      }
    })().catch(async (err) => {
      logger.error(err, "Discord interaction failed");
      const message = err instanceof Error ? err.message : "Discord interaction failed";
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: message, embeds: [], components: [] }).catch(() => undefined);
        } else {
          await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        }
      }
    });
  });
}
