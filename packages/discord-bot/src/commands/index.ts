import { REST, Routes } from "discord.js";
import { logger } from "../core/logger.js";

export async function syncGuildCommands(token: string, clientId: string, guildId: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: [],
  });
  logger.info("Synced %d Discord bridge commands for guild %s", 0, guildId);
}
