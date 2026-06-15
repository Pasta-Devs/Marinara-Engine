import { EmbedBuilder } from "discord.js";
import type {
  DiscordBridgeRoleplayDefaults,
  DiscordBridgeSetupOptions,
  DiscordBridgeThreadBinding,
} from "@marinara-engine/shared";

function fieldValue(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "Not set";
}

function formatConnection(defaults: DiscordBridgeRoleplayDefaults) {
  const connection = defaults.connection;
  if (!connection) return defaults.connectionId === "random" ? "Random pool" : "Not set";
  const model = connection.model ? `\nModel: ${connection.model}` : "";
  return `${connection.name}\nProvider: ${connection.provider}${model}`;
}

export function buildRoleplaySetupEmbed(input: {
  setup: DiscordBridgeSetupOptions;
  bindings: DiscordBridgeThreadBinding[];
}) {
  return new EmbedBuilder()
    .setTitle("Roleplay Bridge")
    .setColor(0x2f855a)
    .setDescription("Thread-backed roleplay setup is ready for the next bridge step.")
    .addFields(
      { name: "Personas", value: String(input.setup.personas.length), inline: true },
      { name: "Characters", value: String(input.setup.characters.length), inline: true },
      { name: "Thread bindings", value: String(input.bindings.length), inline: true },
    );
}

export function buildRoleplayDraftEmbed(input: {
  chatName: string;
  personaName: string | null;
  characterNames: string[];
}) {
  return new EmbedBuilder()
    .setTitle("Create Roleplay")
    .setColor(0x2f855a)
    .addFields(
      { name: "Chat name", value: input.chatName || "Untitled", inline: false },
      { name: "Persona", value: input.personaName ?? "No persona", inline: true },
      {
        name: "Characters",
        value: input.characterNames.length > 0 ? input.characterNames.join("\n").slice(0, 1024) : "Select at least one character",
        inline: false,
      },
    );
}

export function buildRoleplayCreatedEmbed(input: {
  chatName: string;
  chatId: string;
  threadId: string;
  filledMessages: number;
  filledChunks: number;
}) {
  return new EmbedBuilder()
    .setTitle("Roleplay Thread Created")
    .setColor(0x2f855a)
    .addFields(
      { name: "Chat", value: input.chatName, inline: false },
      { name: "Marinara chat ID", value: input.chatId, inline: false },
      { name: "Discord thread ID", value: input.threadId, inline: false },
      { name: "Initial fill", value: `${input.filledMessages} messages / ${input.filledChunks} chunks`, inline: false },
    );
}

export function buildRoleplayLoadEmbed(input: { roleplayCount: number }) {
  return new EmbedBuilder()
    .setTitle("Load Roleplay")
    .setColor(0x2f855a)
    .setDescription("Select an existing Marinara roleplay chat to bind into a new Discord thread.")
    .addFields({ name: "Available roleplays", value: String(input.roleplayCount), inline: true });
}

export function buildRoleplayLoadedEmbed(input: {
  chatName: string;
  chatId: string;
  threadId: string;
  filledMessages: number;
  filledChunks: number;
}) {
  return new EmbedBuilder()
    .setTitle("Roleplay Thread Loaded")
    .setColor(0x2f855a)
    .addFields(
      { name: "Chat", value: input.chatName, inline: false },
      { name: "Marinara chat ID", value: input.chatId, inline: false },
      { name: "Discord thread ID", value: input.threadId, inline: false },
      { name: "Thread fill", value: `${input.filledMessages} messages / ${input.filledChunks} chunks`, inline: false },
    );
}

export function buildRoleplaySettingsEmbed(defaults: DiscordBridgeRoleplayDefaults) {
  const connectionMode = defaults.settings.connectionId ? "Discord override" : "Engine default";
  const promptPresetMode = defaults.settings.promptPresetId ? "Discord override" : "Engine default";
  return new EmbedBuilder()
    .setTitle("Roleplay Settings")
    .setColor(0x2f855a)
    .setDescription("Select the connection and prompt preset Discord roleplay chats will use.")
    .addFields(
      { name: "Connection mode", value: connectionMode, inline: true },
      { name: "Connection", value: formatConnection(defaults), inline: false },
      { name: "Prompt preset mode", value: promptPresetMode, inline: true },
      { name: "Prompt preset", value: fieldValue(defaults.promptPreset?.name), inline: false },
      { name: "Chat preset", value: fieldValue(defaults.chatPreset?.name), inline: true },
    );
}
