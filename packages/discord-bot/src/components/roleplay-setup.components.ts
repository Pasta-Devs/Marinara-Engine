import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type {
  DiscordBridgeCharacterOption,
  DiscordBridgeChatOption,
  DiscordBridgeConnectionOption,
  DiscordBridgePersonaOption,
  DiscordBridgePromptPresetOption,
  DiscordBridgeRoleplayDefaults,
} from "@marinara-engine/shared";

export const ROLEPLAY_CREATE_CUSTOM_ID = "roleplay:create";
export const ROLEPLAY_LOAD_CUSTOM_ID = "roleplay:load";
export const ROLEPLAY_CLOSE_CUSTOM_ID = "roleplay:close";
export const ROLEPLAY_SETTINGS_CUSTOM_ID = "roleplay:settings";
export const ROLEPLAY_SETTINGS_BACK_CUSTOM_ID = "roleplay:settings-back";
export const ROLEPLAY_SETTINGS_CONNECTION_SELECT_CUSTOM_ID = "roleplay:settings-connection";
export const ROLEPLAY_SETTINGS_PROMPT_PRESET_SELECT_CUSTOM_ID = "roleplay:settings-prompt-preset";
export const ROLEPLAY_LOAD_SELECT_CUSTOM_ID = "roleplay:load-select";
export const ROLEPLAY_NAME_MODAL_CUSTOM_ID = "roleplay:name-modal";
export const ROLEPLAY_PERSONA_SELECT_CUSTOM_ID = "roleplay:persona";
export const ROLEPLAY_CHARACTER_SELECT_CUSTOM_ID = "roleplay:characters";
export const ROLEPLAY_FINAL_CREATE_CUSTOM_ID = "roleplay:final-create";

const MAX_SELECT_OPTIONS = 25;
export const ROLEPLAY_ENGINE_DEFAULT_VALUE = "engine-default";

export function buildRoleplaySetupComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_CREATE_CUSTOM_ID)
        .setLabel("Create roleplay")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_LOAD_CUSTOM_ID)
        .setLabel("Load roleplay")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_SETTINGS_CUSTOM_ID)
        .setLabel("Settings")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ROLEPLAY_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildRoleplayLoadComponents(chats: DiscordBridgeChatOption[]) {
  const roleplayChats = chats.filter((chat) => chat.mode === "roleplay").slice(0, MAX_SELECT_OPTIONS);
  const options = roleplayChats.map((chat) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(chat.name.slice(0, 100) || "Untitled Roleplay")
      .setDescription(new Date(chat.updatedAt).toLocaleString().slice(0, 100))
      .setValue(chat.id),
  );

  if (options.length === 0) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel("No roleplay chats found")
        .setDescription("Create a roleplay in Marinara first")
        .setValue("none"),
    );
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ROLEPLAY_LOAD_SELECT_CUSTOM_ID)
        .setPlaceholder("Select a roleplay chat")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_SETTINGS_BACK_CUSTOM_ID)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ROLEPLAY_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildRoleplaySelectionComponents(input: {
  personas: DiscordBridgePersonaOption[];
  characters: DiscordBridgeCharacterOption[];
  personaId: string | null;
  characterIds: string[];
}) {
  const personaOptions = [
    new StringSelectMenuOptionBuilder()
      .setLabel("No persona")
      .setDescription("Create the chat without a selected persona")
      .setValue("none")
      .setDefault(!input.personaId),
    ...input.personas.slice(0, MAX_SELECT_OPTIONS - 1).map((persona) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(persona.name.slice(0, 100) || "Unnamed Persona")
        .setDescription((persona.comment || persona.id).slice(0, 100))
        .setValue(persona.id)
        .setDefault(persona.id === input.personaId),
    ),
  ];

  const selectedCharacterIds = new Set(input.characterIds);
  const noCharacters = input.characters.length === 0;
  const characterOptions = input.characters.slice(0, MAX_SELECT_OPTIONS).map((character) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(character.name.slice(0, 100) || "Unnamed Character")
      .setDescription((character.comment || character.id).slice(0, 100))
      .setValue(character.id)
      .setDefault(selectedCharacterIds.has(character.id)),
  );

  if (noCharacters) {
    characterOptions.push(
      new StringSelectMenuOptionBuilder()
        .setLabel("No characters found")
        .setDescription("Create a character in Marinara first")
        .setValue("none"),
    );
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ROLEPLAY_PERSONA_SELECT_CUSTOM_ID)
        .setPlaceholder("Select persona")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(personaOptions),
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ROLEPLAY_CHARACTER_SELECT_CUSTOM_ID)
        .setPlaceholder("Select characters")
        .setMinValues(1)
        .setMaxValues(noCharacters ? 1 : Math.min(characterOptions.length, MAX_SELECT_OPTIONS))
        .addOptions(characterOptions),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_FINAL_CREATE_CUSTOM_ID)
        .setLabel("Create thread")
        .setStyle(ButtonStyle.Success)
        .setDisabled(input.characterIds.length === 0),
      new ButtonBuilder().setCustomId(ROLEPLAY_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildRoleplaySettingsComponents(input: {
  defaults: DiscordBridgeRoleplayDefaults;
  connections: DiscordBridgeConnectionOption[];
  promptPresets: DiscordBridgePromptPresetOption[];
}) {
  const selectedConnectionId = input.defaults.settings.connectionId;
  const selectedPromptPresetId = input.defaults.settings.promptPresetId;
  const connectionOptions = [
    new StringSelectMenuOptionBuilder()
      .setLabel("Use engine default")
      .setDescription("Follow the active Marinara roleplay/default connection")
      .setValue(ROLEPLAY_ENGINE_DEFAULT_VALUE)
      .setDefault(!selectedConnectionId),
    ...input.connections.slice(0, MAX_SELECT_OPTIONS - 1).map((connection) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(connection.name.slice(0, 100) || "Unnamed Connection")
        .setDescription(`${connection.provider}${connection.model ? ` / ${connection.model}` : ""}`.slice(0, 100))
        .setValue(connection.id)
        .setDefault(connection.id === selectedConnectionId),
    ),
  ];

  const promptPresetOptions = [
    new StringSelectMenuOptionBuilder()
      .setLabel("Use engine default")
      .setDescription("Follow the active roleplay preset or selected connection")
      .setValue(ROLEPLAY_ENGINE_DEFAULT_VALUE)
      .setDefault(!selectedPromptPresetId),
    ...input.promptPresets.slice(0, MAX_SELECT_OPTIONS - 1).map((preset) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(preset.name.slice(0, 100) || "Unnamed Preset")
        .setDescription((preset.description || preset.author || preset.id).slice(0, 100))
        .setValue(preset.id)
        .setDefault(preset.id === selectedPromptPresetId),
    ),
  ];

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ROLEPLAY_SETTINGS_CONNECTION_SELECT_CUSTOM_ID)
        .setPlaceholder("Select connection")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(connectionOptions),
    ),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(ROLEPLAY_SETTINGS_PROMPT_PRESET_SELECT_CUSTOM_ID)
        .setPlaceholder("Select prompt preset")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(promptPresetOptions),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(ROLEPLAY_SETTINGS_BACK_CUSTOM_ID)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(ROLEPLAY_CLOSE_CUSTOM_ID).setLabel("Close").setStyle(ButtonStyle.Danger),
    ),
  ];
}
