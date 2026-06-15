import { REST, Routes } from "discord.js";
import { logger } from "../core/logger.js";
import { charactersCommand } from "./characters.js";
import { personasCommand } from "./personas.js";
import { roleplayCommand } from "./roleplay.js";

export const commands = [charactersCommand, personasCommand, roleplayCommand];

export async function syncGuildCommands(token: string, clientId: string, guildId: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands.map((command) => command.data.toJSON()),
  });
  logger.info("Synced %d Discord bridge commands for guild %s", commands.length, guildId);
}
