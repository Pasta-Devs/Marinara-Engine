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
import {
  PERSONA_BACK_CUSTOM_ID,
  PERSONA_CLOSE_CUSTOM_ID,
  PERSONA_EDIT_CUSTOM_ID,
  PERSONA_EDIT_MODAL_CUSTOM_ID,
  PERSONA_PAGE_SELECT_CUSTOM_ID,
  PERSONA_SAVE_CUSTOM_ID,
  PERSONA_SELECT_CUSTOM_ID,
  buildPersonaEditModalCustomId,
  buildPersonaDetailComponents,
  buildPersonaListComponents,
} from "../components/persona-list.components.js";
import {
  getBridgeSetupOptions,
  getCharacterById,
  getPersonaById,
  updateCharacterFields,
  updatePersonaFields,
} from "../core/marinara-api.js";
import { logger } from "../core/logger.js";
import { commands } from "../commands/index.js";
import { CHARACTER_CARD_PAGES, buildCharacterCardEmbed, type CharacterCardPage } from "../embeds/character-card.embed.js";
import { buildCharacterListEmbed } from "../embeds/character-list.embed.js";
import { PERSONA_CARD_PAGES, buildPersonaCardEmbed, type PersonaCardPage } from "../embeds/persona-card.embed.js";
import { buildPersonaListEmbed } from "../embeds/persona-list.embed.js";
import {
  applyCharacterFieldUpdates,
  getCharacterFieldValue,
  getEditableFieldsForPage,
  type EditableCharacterField,
} from "../core/character-card-fields.js";
import {
  applyPersonaFieldUpdates,
  getEditablePersonaFieldsForPage,
  getPersonaFieldValue,
  type EditablePersonaField,
} from "../core/persona-card-fields.js";

const CHARACTER_PAGE_SELECT_PREFIX = `${CHARACTER_PAGE_SELECT_CUSTOM_ID}:`;
const PERSONA_PAGE_SELECT_PREFIX = `${PERSONA_PAGE_SELECT_CUSTOM_ID}:`;
const CHARACTER_EDIT_PREFIX = `${CHARACTER_EDIT_CUSTOM_ID}:`;
const CHARACTER_SAVE_PREFIX = `${CHARACTER_SAVE_CUSTOM_ID}:`;
const CHARACTER_EDIT_MODAL_PREFIX = `${CHARACTER_EDIT_MODAL_CUSTOM_ID}:`;
const PERSONA_EDIT_PREFIX = `${PERSONA_EDIT_CUSTOM_ID}:`;
const PERSONA_SAVE_PREFIX = `${PERSONA_SAVE_CUSTOM_ID}:`;
const PERSONA_EDIT_MODAL_PREFIX = `${PERSONA_EDIT_MODAL_CUSTOM_ID}:`;
const MODAL_VALUE_LIMIT = 4000;

const characterDrafts = new Map<string, Partial<Record<EditableCharacterField, string>>>();
const personaDrafts = new Map<string, Partial<Record<EditablePersonaField, string>>>();
type DraftMap<T extends string> = Partial<Record<T, string>>;

function isCharacterCardPage(value: string): value is CharacterCardPage {
  return CHARACTER_CARD_PAGES.includes(value as CharacterCardPage);
}

function isPersonaCardPage(value: string): value is PersonaCardPage {
  return PERSONA_CARD_PAGES.includes(value as PersonaCardPage);
}

function characterDraftKey(userId: string, characterId: string, page: CharacterCardPage) {
  return `${userId}:${characterId}:${page}`;
}

function personaDraftKey(userId: string, personaId: string, page: PersonaCardPage) {
  return `${userId}:${personaId}:${page}`;
}

function getDraft(userId: string, characterId: string, page: CharacterCardPage) {
  return characterDrafts.get(characterDraftKey(userId, characterId, page)) ?? {};
}

function getPersonaDraft(userId: string, personaId: string, page: PersonaCardPage) {
  return personaDrafts.get(personaDraftKey(userId, personaId, page)) ?? {};
}

function hasDraft(userId: string, characterId: string, page: CharacterCardPage) {
  return hasDraftValues(getDraft(userId, characterId, page));
}

function hasPersonaDraft(userId: string, personaId: string, page: PersonaCardPage) {
  return hasDraftValues(getPersonaDraft(userId, personaId, page));
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

function parsePersonaPageAction(customId: string, prefix: string) {
  const raw = customId.slice(prefix.length);
  const pageSeparator = raw.lastIndexOf(":");
  if (pageSeparator === -1) return null;

  const personaId = decodeURIComponent(raw.slice(0, pageSeparator));
  const page = raw.slice(pageSeparator + 1);
  if (!personaId || !isPersonaCardPage(page)) return null;
  return { personaId, page };
}

function truncateModalValue(value: string) {
  return value.length <= MODAL_VALUE_LIMIT ? value : value.slice(0, MODAL_VALUE_LIMIT);
}

function hasDraftValues<T extends string>(updates: DraftMap<T>) {
  return Object.keys(updates).length > 0;
}

function draftAsUpdateArray<T extends string>(updates: DraftMap<T>) {
  return (Object.entries(updates) as Array<[T, string | undefined]>).map(([field, value]) => ({ field, value: value ?? "" }));
}

function buildTextInputRow(input: {
  customId: string;
  label: string;
  style: TextInputStyle;
  value: string;
}) {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId(input.customId)
      .setLabel(input.label)
      .setStyle(input.style)
      .setRequired(false)
      .setMaxLength(MODAL_VALUE_LIMIT)
      .setValue(truncateModalValue(input.value)),
  );
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

      if (interaction.isButton() && interaction.customId === PERSONA_CLOSE_CUSTOM_ID) {
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

      if (interaction.isButton() && interaction.customId === PERSONA_BACK_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this.", ephemeral: true });
          return;
        }
        const setup = await getBridgeSetupOptions(config.serverUrl);
        await interaction.update({
          embeds: [buildPersonaListEmbed(setup.personas)],
          components: buildPersonaListComponents(setup.personas),
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
            buildTextInputRow({
              customId: field.field,
              label: field.label,
              style: field.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short,
              value: getCharacterFieldValue(draftData, field.field),
            }),
          );
        }

        await interaction.showModal(modal);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith(PERSONA_EDIT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can edit this.", ephemeral: true });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_EDIT_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona edit target not found.", ephemeral: true });
          return;
        }

        const fullPersona = await getPersonaById(config.serverUrl, parsed.personaId);
        const draft = getPersonaDraft(interaction.user.id, parsed.personaId, parsed.page);
        const draftPersona = applyPersonaFieldUpdates(fullPersona, draft);
        const modal = new ModalBuilder()
          .setCustomId(buildPersonaEditModalCustomId(parsed.personaId, parsed.page))
          .setTitle(`Edit ${parsed.page}`);

        for (const field of getEditablePersonaFieldsForPage(parsed.page)) {
          modal.addComponents(
            buildTextInputRow({
              customId: field.field,
              label: field.label,
              style: TextInputStyle.Paragraph,
              value: getPersonaFieldValue(draftPersona, field.field),
            }),
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

        const key = characterDraftKey(interaction.user.id, parsed.characterId, parsed.page);
        const draft = characterDrafts.get(key);
        if (!draft || !hasDraftValues(draft)) {
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

      if (interaction.isButton() && interaction.customId.startsWith(PERSONA_SAVE_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can save this.", ephemeral: true });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_SAVE_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona save target not found.", ephemeral: true });
          return;
        }

        const key = personaDraftKey(interaction.user.id, parsed.personaId, parsed.page);
        const draft = personaDrafts.get(key);
        if (!draft || !hasDraftValues(draft)) {
          await interaction.reply({ content: "No edits to save.", ephemeral: true });
          return;
        }

        const updated = await updatePersonaFields(config.serverUrl, parsed.personaId, draftAsUpdateArray(draft));
        personaDrafts.delete(key);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: updated, page: parsed.page })],
          components: buildPersonaDetailComponents(updated.id, parsed.page, false),
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

      if (interaction.isStringSelectMenu() && interaction.customId === PERSONA_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this selector.", ephemeral: true });
          return;
        }

        const selectedId = interaction.values[0];
        if (!selectedId || selectedId === "none") return;
        const setup = await getBridgeSetupOptions(config.serverUrl);
        const persona = setup.personas.find((candidate) => candidate.id === selectedId);
        if (!persona) {
          await interaction.reply({ content: "Persona not found.", ephemeral: true });
          return;
        }
        const fullPersona = await getPersonaById(config.serverUrl, persona.id);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: fullPersona, page: "description" })],
          components: buildPersonaDetailComponents(
            fullPersona.id,
            "description",
            hasPersonaDraft(interaction.user.id, fullPersona.id, "description"),
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
          components: buildCharacterDetailComponents(fullCharacter.id, page, hasDraftValues(draft)),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith(PERSONA_PAGE_SELECT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can use this selector.", ephemeral: true });
          return;
        }

        const page = interaction.values[0];
        if (!page || !isPersonaCardPage(page)) {
          await interaction.reply({ content: "Persona page not found.", ephemeral: true });
          return;
        }

        const encodedPersonaId = interaction.customId.slice(PERSONA_PAGE_SELECT_PREFIX.length);
        const personaId = decodeURIComponent(encodedPersonaId);
        const fullPersona = await getPersonaById(config.serverUrl, personaId);
        const draft = getPersonaDraft(interaction.user.id, fullPersona.id, page);
        const displayPersona = applyPersonaFieldUpdates(fullPersona, draft);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: displayPersona, page })],
          components: buildPersonaDetailComponents(fullPersona.id, page, hasDraftValues(draft)),
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

        const key = characterDraftKey(interaction.user.id, parsed.characterId, parsed.page);
        if (hasDraftValues(updates)) {
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
          components: buildCharacterDetailComponents(fullCharacter.id, parsed.page, hasDraftValues(updates)),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith(PERSONA_EDIT_MODAL_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({ content: "Only the configured Marinara Discord owner can submit this edit.", ephemeral: true });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_EDIT_MODAL_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona edit target not found.", ephemeral: true });
          return;
        }

        const fullPersona = await getPersonaById(config.serverUrl, parsed.personaId);
        const updates: Partial<Record<EditablePersonaField, string>> = {};
        for (const field of getEditablePersonaFieldsForPage(parsed.page)) {
          const nextValue = interaction.fields.getTextInputValue(field.field);
          if (nextValue !== getPersonaFieldValue(fullPersona, field.field)) {
            updates[field.field] = nextValue;
          }
        }

        const key = personaDraftKey(interaction.user.id, parsed.personaId, parsed.page);
        if (hasDraftValues(updates)) {
          personaDrafts.set(key, updates);
        } else {
          personaDrafts.delete(key);
        }

        const displayPersona = applyPersonaFieldUpdates(fullPersona, updates);
        if (!interaction.message) {
          await interaction.reply({ content: "Persona message not found.", ephemeral: true });
          return;
        }

        await interaction.deferUpdate();
        await interaction.message.edit({
          embeds: [buildPersonaCardEmbed({ persona: displayPersona, page: parsed.page })],
          components: buildPersonaDetailComponents(fullPersona.id, parsed.page, hasDraftValues(updates)),
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
