import {
  ActionRowBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type Client,
} from "discord.js";
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
  PERSONA_USE_CUSTOM_ID,
  buildPersonaEditModalCustomId,
  buildPersonaDetailComponents,
  buildPersonaListComponents,
} from "../components/persona-list.components.js";
import {
  ROLEPLAY_CHARACTER_SELECT_CUSTOM_ID,
  ROLEPLAY_CLOSE_CUSTOM_ID,
  ROLEPLAY_CREATE_CUSTOM_ID,
  ROLEPLAY_ENGINE_DEFAULT_VALUE,
  ROLEPLAY_FINAL_CREATE_CUSTOM_ID,
  ROLEPLAY_LOAD_CUSTOM_ID,
  ROLEPLAY_LOAD_SELECT_CUSTOM_ID,
  ROLEPLAY_NAME_MODAL_CUSTOM_ID,
  ROLEPLAY_PERSONA_SELECT_CUSTOM_ID,
  ROLEPLAY_SETTINGS_BACK_CUSTOM_ID,
  ROLEPLAY_SETTINGS_CONNECTION_SELECT_CUSTOM_ID,
  ROLEPLAY_SETTINGS_CUSTOM_ID,
  ROLEPLAY_SETTINGS_PROMPT_PRESET_SELECT_CUSTOM_ID,
  buildRoleplayLoadComponents,
  buildRoleplaySelectionComponents,
  buildRoleplaySettingsComponents,
  buildRoleplaySetupComponents,
} from "../components/roleplay-setup.components.js";
import {
  createBridgeRoleplayChat,
  deleteThreadBinding,
  getBridgeConnections,
  getBridgeChatContext,
  getBridgePromptPresets,
  getBridgeRoleplayDefaults,
  getBridgeSetupOptions,
  getCharacterById,
  getDiscordUserPersona,
  getPersonaById,
  listThreadBindings,
  setDiscordUserPersona,
  upsertThreadBinding,
  updateCharacterFields,
  updateBridgeRoleplayDefaults,
  updatePersonaFields,
} from "../core/marinara-api.js";
import { logger } from "../core/logger.js";
import { commands } from "../commands/index.js";
import {
  CHARACTER_CARD_PAGES,
  buildCharacterCardEmbed,
  type CharacterCardPage,
} from "../embeds/character-card.embed.js";
import { buildCharacterListEmbed } from "../embeds/character-list.embed.js";
import { PERSONA_CARD_PAGES, buildPersonaCardEmbed, type PersonaCardPage } from "../embeds/persona-card.embed.js";
import { buildPersonaListEmbed } from "../embeds/persona-list.embed.js";
import {
  buildRoleplayCreatedEmbed,
  buildRoleplayDraftEmbed,
  buildRoleplayLoadedEmbed,
  buildRoleplayLoadEmbed,
  buildRoleplaySettingsEmbed,
  buildRoleplaySetupEmbed,
} from "../embeds/roleplay-setup.embed.js";
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
import { fillThreadFromChatMessages } from "../core/thread-fill.js";

const CHARACTER_PAGE_SELECT_PREFIX = `${CHARACTER_PAGE_SELECT_CUSTOM_ID}:`;
const PERSONA_PAGE_SELECT_PREFIX = `${PERSONA_PAGE_SELECT_CUSTOM_ID}:`;
const CHARACTER_EDIT_PREFIX = `${CHARACTER_EDIT_CUSTOM_ID}:`;
const CHARACTER_SAVE_PREFIX = `${CHARACTER_SAVE_CUSTOM_ID}:`;
const CHARACTER_EDIT_MODAL_PREFIX = `${CHARACTER_EDIT_MODAL_CUSTOM_ID}:`;
const PERSONA_EDIT_PREFIX = `${PERSONA_EDIT_CUSTOM_ID}:`;
const PERSONA_SAVE_PREFIX = `${PERSONA_SAVE_CUSTOM_ID}:`;
const PERSONA_USE_PREFIX = `${PERSONA_USE_CUSTOM_ID}:`;
const PERSONA_EDIT_MODAL_PREFIX = `${PERSONA_EDIT_MODAL_CUSTOM_ID}:`;
const MODAL_VALUE_LIMIT = 4000;
const ROLEPLAY_LOAD_SEND_DELAY_MS = 500;
const DISCORD_UNKNOWN_MESSAGE_CODE = 10008;

const characterDrafts = new Map<string, Partial<Record<EditableCharacterField, string>>>();
const personaDrafts = new Map<string, Partial<Record<EditablePersonaField, string>>>();
const roleplayDrafts = new Map<string, { chatName: string; personaId: string | null; characterIds: string[] }>();
type DraftMap<T extends string> = Partial<Record<T, string>>;

interface ThreadParentChannel {
  id: string;
  threads: {
    create(input: {
      name: string;
      autoArchiveDuration?: ThreadAutoArchiveDuration;
      reason?: string;
    }): Promise<{ id: string; send(input: { content: string }): Promise<{ id: string }> }>;
  };
}

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

function discordThreadUrl(guildId: string, threadId: string) {
  return `https://discord.com/channels/${guildId}/${threadId}`;
}

async function findLiveRoleplayThread(input: { client: Client; serverUrl: string; guildId: string; chatId: string }) {
  const bindings = (await listThreadBindings(input.serverUrl)).filter(
    (binding) => binding.chatId === input.chatId && binding.guildId === input.guildId,
  );

  for (const binding of bindings) {
    const channel = await input.client.channels.fetch(binding.threadId).catch(() => null);
    if (channel) {
      return {
        binding,
        url: discordThreadUrl(binding.guildId, binding.threadId),
      };
    }

    await deleteThreadBinding(input.serverUrl, binding.id);
    logger.warn("Pruned stale Discord bridge binding for missing thread %s during roleplay load", binding.threadId);
  }

  return null;
}

function hasDraftValues<T extends string>(updates: DraftMap<T>) {
  return Object.keys(updates).length > 0;
}

function draftAsUpdateArray<T extends string>(updates: DraftMap<T>) {
  return (Object.entries(updates) as Array<[T, string | undefined]>).map(([field, value]) => ({
    field,
    value: value ?? "",
  }));
}

function isDiscordErrorCode(err: unknown, code: number) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === code;
}

function isNotFoundApiError(err: unknown) {
  return err instanceof Error && err.message.includes("HTTP 404");
}

function parsePersonaIdAction(customId: string, prefix: string) {
  const raw = customId.slice(prefix.length);
  const personaId = decodeURIComponent(raw);
  return personaId || null;
}

async function deleteComponentMessage(message: { delete(): Promise<unknown> }) {
  try {
    await message.delete();
  } catch (err) {
    if (isDiscordErrorCode(err, DISCORD_UNKNOWN_MESSAGE_CODE)) {
      return;
    }

    throw err;
  }
}

async function closeComponentPanel(interaction: ButtonInteraction) {
  if (interaction.message.flags.has(MessageFlags.Ephemeral)) {
    await interaction.update({ content: "Closed.", embeds: [], components: [] });
    return;
  }

  await interaction.deferUpdate();
  await deleteComponentMessage(interaction.message);
}

function buildTextInputRow(input: { customId: string; label: string; style: TextInputStyle; value: string }) {
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

function isThreadParentChannel(channel: unknown): channel is ThreadParentChannel {
  return (
    !!channel &&
    typeof channel === "object" &&
    "id" in channel &&
    "threads" in channel &&
    typeof (channel as { threads?: { create?: unknown } }).threads?.create === "function"
  );
}

function getRoleplayDraft(userId: string) {
  return roleplayDrafts.get(userId) ?? { chatName: "", personaId: null, characterIds: [] };
}

async function buildRoleplayDraftResponse(config: DiscordBridgeConfig, userId: string) {
  const setup = await getBridgeSetupOptions(config.serverUrl);
  const draft = getRoleplayDraft(userId);
  const personaName = draft.personaId
    ? (setup.personas.find((persona) => persona.id === draft.personaId)?.name ?? null)
    : null;
  const selectedCharacters = setup.characters.filter((character) => draft.characterIds.includes(character.id));
  return {
    embeds: [
      buildRoleplayDraftEmbed({
        chatName: draft.chatName,
        personaName,
        characterNames: selectedCharacters.map((character) => character.name),
      }),
    ],
    components: buildRoleplaySelectionComponents({
      personas: setup.personas,
      characters: setup.characters,
      personaId: draft.personaId,
      characterIds: draft.characterIds,
    }),
  };
}

async function buildRoleplaySetupResponse(config: DiscordBridgeConfig) {
  const [setup, bindings] = await Promise.all([
    getBridgeSetupOptions(config.serverUrl),
    listThreadBindings(config.serverUrl),
  ]);
  return {
    embeds: [buildRoleplaySetupEmbed({ setup, bindings })],
    components: buildRoleplaySetupComponents(),
  };
}

async function buildRoleplaySettingsResponse(config: DiscordBridgeConfig) {
  const [defaults, connections, promptPresets] = await Promise.all([
    getBridgeRoleplayDefaults(config.serverUrl),
    getBridgeConnections(config.serverUrl),
    getBridgePromptPresets(config.serverUrl),
  ]);
  return {
    embeds: [buildRoleplaySettingsEmbed(defaults)],
    components: buildRoleplaySettingsComponents({
      defaults,
      connections: connections.connections,
      promptPresets: promptPresets.presets,
    }),
  };
}

async function buildRoleplayLoadResponse(config: DiscordBridgeConfig) {
  const setup = await getBridgeSetupOptions(config.serverUrl);
  const roleplayChats = setup.chats.filter((chat) => chat.mode === "roleplay");
  return {
    embeds: [buildRoleplayLoadEmbed({ roleplayCount: roleplayChats.length })],
    components: buildRoleplayLoadComponents(roleplayChats),
  };
}

async function getSelectedPersonaId(config: DiscordBridgeConfig, guildId: string | null, userId: string) {
  if (!guildId) return null;
  try {
    const binding = await getDiscordUserPersona(config.serverUrl, guildId, userId);
    return binding.personaId;
  } catch (err) {
    if (isNotFoundApiError(err)) return null;
    throw err;
  }
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can close this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await closeComponentPanel(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === PERSONA_CLOSE_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can close this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await closeComponentPanel(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_CLOSE_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can close this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        roleplayDrafts.delete(interaction.user.id);
        await closeComponentPanel(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_CREATE_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const modal = new ModalBuilder().setCustomId(ROLEPLAY_NAME_MODAL_CUSTOM_ID).setTitle("Create roleplay");
        modal.addComponents(
          buildTextInputRow({
            customId: "chatName",
            label: "Chat name",
            style: TextInputStyle.Short,
            value: getRoleplayDraft(interaction.user.id).chatName,
          }),
        );
        await interaction.showModal(modal);
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_SETTINGS_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.update(await buildRoleplaySettingsResponse(config));
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_LOAD_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.update(await buildRoleplayLoadResponse(config));
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_SETTINGS_BACK_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.update(await buildRoleplaySetupResponse(config));
        return;
      }

      if (interaction.isButton() && interaction.customId === ROLEPLAY_FINAL_CREATE_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can create this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const draft = getRoleplayDraft(interaction.user.id);
        if (!draft.chatName.trim() || draft.characterIds.length === 0) {
          await interaction.reply({
            content: "Set a chat name and select at least one character first.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!interaction.guildId || !isThreadParentChannel(interaction.channel)) {
          await interaction.reply({
            content: "Run /roleplay in a guild text channel that supports threads.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferUpdate();
        const created = await createBridgeRoleplayChat(config.serverUrl, {
          name: draft.chatName,
          personaId: draft.personaId,
          characterIds: draft.characterIds,
        });
        const thread = await interaction.channel.threads.create({
          name: created.chat.name.slice(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          reason: "Marinara Discord bridge roleplay",
        });
        const binding = await upsertThreadBinding(config.serverUrl, {
          guildId: interaction.guildId,
          channelId: interaction.channel.id,
          threadId: thread.id,
          chatId: created.chat.id,
          chatName: created.chat.name,
          personaId: created.chat.personaId,
          characterIds: created.chat.characterIds,
        });
        const initialFill = await fillThreadFromChatMessages({
          serverUrl: config.serverUrl,
          threadId: thread.id,
          binding,
          thread,
        });
        roleplayDrafts.delete(interaction.user.id);
        await interaction.editReply({
          embeds: [
            buildRoleplayCreatedEmbed({
              chatName: binding.chatName,
              chatId: binding.chatId,
              threadId: binding.threadId,
              filledMessages: initialFill.messageCount,
              filledChunks: initialFill.chunkCount,
            }),
          ],
          components: [],
        });
        return;
      }

      if (interaction.isButton() && interaction.customId === CHARACTER_BACK_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
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

      if (interaction.isButton() && interaction.customId.startsWith(PERSONA_USE_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (!interaction.guildId) {
          await interaction.reply({
            content: "Persona links can only be saved from a server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const personaId = parsePersonaIdAction(interaction.customId, PERSONA_USE_PREFIX);
        if (!personaId) {
          await interaction.reply({ content: "Persona target not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        const [updated, fullPersona] = await Promise.all([
          setDiscordUserPersona(config.serverUrl, interaction.guildId, interaction.user.id, personaId),
          getPersonaById(config.serverUrl, personaId),
        ]);

        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: fullPersona, page: "description" })],
          components: buildPersonaDetailComponents(fullPersona.id, "description", false, true),
          content: `Using persona: ${updated.personaName}`,
          attachments: [],
        });
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith(CHARACTER_EDIT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can edit this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_EDIT_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character edit target not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        const fields = getEditableFieldsForPage(parsed.page);
        if (fields.length === 0) {
          await interaction.reply({ content: "This page has no editable fields yet.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can edit this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_EDIT_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona edit target not found.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can save this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_SAVE_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character save target not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        const key = characterDraftKey(interaction.user.id, parsed.characterId, parsed.page);
        const draft = characterDrafts.get(key);
        if (!draft || !hasDraftValues(draft)) {
          await interaction.reply({ content: "No edits to save.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can save this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_SAVE_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona save target not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        const key = personaDraftKey(interaction.user.id, parsed.personaId, parsed.page);
        const draft = personaDrafts.get(key);
        if (!draft || !hasDraftValues(draft)) {
          await interaction.reply({ content: "No edits to save.", flags: MessageFlags.Ephemeral });
          return;
        }

        const [updated, selectedPersonaId] = await Promise.all([
          updatePersonaFields(config.serverUrl, parsed.personaId, draftAsUpdateArray(draft)),
          getSelectedPersonaId(config, interaction.guildId, interaction.user.id),
        ]);
        personaDrafts.delete(key);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: updated, page: parsed.page })],
          components: buildPersonaDetailComponents(updated.id, parsed.page, false, selectedPersonaId === updated.id),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === CHARACTER_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const selectedId = interaction.values[0];
        if (!selectedId || selectedId === "none") return;
        const setup = await getBridgeSetupOptions(config.serverUrl);
        const character = setup.characters.find((candidate) => candidate.id === selectedId);
        if (!character) {
          await interaction.reply({ content: "Character not found.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const selectedId = interaction.values[0];
        if (!selectedId || selectedId === "none") return;
        const setup = await getBridgeSetupOptions(config.serverUrl);
        const persona = setup.personas.find((candidate) => candidate.id === selectedId);
        if (!persona) {
          await interaction.reply({ content: "Persona not found.", flags: MessageFlags.Ephemeral });
          return;
        }
        const [fullPersona, selectedPersonaId] = await Promise.all([
          getPersonaById(config.serverUrl, persona.id),
          getSelectedPersonaId(config, interaction.guildId, interaction.user.id),
        ]);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: fullPersona, page: "description" })],
          components: buildPersonaDetailComponents(
            fullPersona.id,
            "description",
            hasPersonaDraft(interaction.user.id, fullPersona.id, "description"),
            selectedPersonaId === fullPersona.id,
          ),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === ROLEPLAY_PERSONA_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const selectedId = interaction.values[0];
        const draft = getRoleplayDraft(interaction.user.id);
        roleplayDrafts.set(interaction.user.id, {
          ...draft,
          personaId: selectedId && selectedId !== "none" ? selectedId : null,
        });
        await interaction.update(await buildRoleplayDraftResponse(config, interaction.user.id));
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === ROLEPLAY_CHARACTER_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const selectedIds = interaction.values.filter((value) => value !== "none");
        const draft = getRoleplayDraft(interaction.user.id);
        roleplayDrafts.set(interaction.user.id, {
          ...draft,
          characterIds: selectedIds,
        });
        await interaction.update(await buildRoleplayDraftResponse(config, interaction.user.id));
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === ROLEPLAY_LOAD_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const chatId = interaction.values[0];
        if (!chatId || chatId === "none") return;
        if (!interaction.guildId || !isThreadParentChannel(interaction.channel)) {
          await interaction.reply({
            content: "Run /roleplay in a guild text channel that supports threads.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.deferUpdate();
        const context = await getBridgeChatContext(config.serverUrl, chatId, 0);
        if (context.chat.mode !== "roleplay") {
          await interaction.editReply({ content: "Selected chat is not a roleplay chat.", embeds: [], components: [] });
          return;
        }

        const liveThread = await findLiveRoleplayThread({
          client: interaction.client,
          serverUrl: config.serverUrl,
          guildId: interaction.guildId,
          chatId: context.chat.id,
        });
        if (liveThread) {
          await interaction.editReply({
            content: `This roleplay is already loaded in Discord: [Open thread](${liveThread.url})`,
            embeds: [],
            components: [],
          });
          return;
        }

        const thread = await interaction.channel.threads.create({
          name: context.chat.name.slice(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          reason: "Marinara Discord bridge loaded roleplay",
        });
        const binding = await upsertThreadBinding(config.serverUrl, {
          guildId: interaction.guildId,
          channelId: interaction.channel.id,
          threadId: thread.id,
          chatId: context.chat.id,
          chatName: context.chat.name,
          personaId: context.chat.personaId,
          characterIds: context.chat.characterIds,
        });
        const initialFill = await fillThreadFromChatMessages({
          serverUrl: config.serverUrl,
          threadId: thread.id,
          binding,
          thread,
          messageLimit: "all",
          sendDelayMs: ROLEPLAY_LOAD_SEND_DELAY_MS,
        });
        await interaction.editReply({
          embeds: [
            buildRoleplayLoadedEmbed({
              chatName: binding.chatName,
              chatId: binding.chatId,
              threadId: binding.threadId,
              filledMessages: initialFill.messageCount,
              filledChunks: initialFill.chunkCount,
            }),
          ],
          components: [],
        });
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === ROLEPLAY_SETTINGS_CONNECTION_SELECT_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const defaults = await getBridgeRoleplayDefaults(config.serverUrl);
        const selectedId = interaction.values[0];
        await updateBridgeRoleplayDefaults(config.serverUrl, {
          connectionId: selectedId && selectedId !== ROLEPLAY_ENGINE_DEFAULT_VALUE ? selectedId : null,
          promptPresetId: defaults.settings.promptPresetId,
        });
        await interaction.update(await buildRoleplaySettingsResponse(config));
        return;
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === ROLEPLAY_SETTINGS_PROMPT_PRESET_SELECT_CUSTOM_ID
      ) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const defaults = await getBridgeRoleplayDefaults(config.serverUrl);
        const selectedId = interaction.values[0];
        await updateBridgeRoleplayDefaults(config.serverUrl, {
          connectionId: defaults.settings.connectionId,
          promptPresetId: selectedId && selectedId !== ROLEPLAY_ENGINE_DEFAULT_VALUE ? selectedId : null,
        });
        await interaction.update(await buildRoleplaySettingsResponse(config));
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith(CHARACTER_PAGE_SELECT_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const page = interaction.values[0];
        if (!page || !isCharacterCardPage(page)) {
          await interaction.reply({ content: "Character page not found.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can use this selector.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const page = interaction.values[0];
        if (!page || !isPersonaCardPage(page)) {
          await interaction.reply({ content: "Persona page not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        const encodedPersonaId = interaction.customId.slice(PERSONA_PAGE_SELECT_PREFIX.length);
        const personaId = decodeURIComponent(encodedPersonaId);
        const [fullPersona, selectedPersonaId] = await Promise.all([
          getPersonaById(config.serverUrl, personaId),
          getSelectedPersonaId(config, interaction.guildId, interaction.user.id),
        ]);
        const draft = getPersonaDraft(interaction.user.id, fullPersona.id, page);
        const displayPersona = applyPersonaFieldUpdates(fullPersona, draft);
        await interaction.update({
          embeds: [buildPersonaCardEmbed({ persona: displayPersona, page })],
          components: buildPersonaDetailComponents(
            fullPersona.id,
            page,
            hasDraftValues(draft),
            selectedPersonaId === fullPersona.id,
          ),
          content: null,
          attachments: [],
        });
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith(CHARACTER_EDIT_MODAL_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can submit this edit.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parseCharacterPageAction(interaction.customId, CHARACTER_EDIT_MODAL_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Character edit target not found.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({ content: "Character message not found.", flags: MessageFlags.Ephemeral });
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

      if (interaction.isModalSubmit() && interaction.customId === ROLEPLAY_NAME_MODAL_CUSTOM_ID) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can submit this.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const chatName = interaction.fields.getTextInputValue("chatName").trim();
        if (!chatName) {
          await interaction.reply({ content: "Chat name is required.", flags: MessageFlags.Ephemeral });
          return;
        }

        const draft = getRoleplayDraft(interaction.user.id);
        roleplayDrafts.set(interaction.user.id, { ...draft, chatName });
        if (!interaction.message) {
          await interaction.reply({ content: "Roleplay message not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferUpdate();
        await interaction.message.edit(await buildRoleplayDraftResponse(config, interaction.user.id));
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith(PERSONA_EDIT_MODAL_PREFIX)) {
        if (interaction.user.id !== config.ownerId) {
          await interaction.reply({
            content: "Only the configured Marinara Discord owner can submit this edit.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const parsed = parsePersonaPageAction(interaction.customId, PERSONA_EDIT_MODAL_PREFIX);
        if (!parsed) {
          await interaction.reply({ content: "Persona edit target not found.", flags: MessageFlags.Ephemeral });
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
          await interaction.reply({ content: "Persona message not found.", flags: MessageFlags.Ephemeral });
          return;
        }

        await interaction.deferUpdate();
        const selectedPersonaId = await getSelectedPersonaId(config, interaction.guildId, interaction.user.id);
        await interaction.message.edit({
          embeds: [buildPersonaCardEmbed({ persona: displayPersona, page: parsed.page })],
          components: buildPersonaDetailComponents(
            fullPersona.id,
            parsed.page,
            hasDraftValues(updates),
            selectedPersonaId === fullPersona.id,
          ),
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
          await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => undefined);
        }
      }
    });
  });
}
