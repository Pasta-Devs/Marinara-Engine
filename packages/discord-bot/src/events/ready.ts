import type { Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { logger } from "../core/logger.js";

export function registerReadyEvent(client: Client, config: DiscordBridgeConfig) {
  client.once("ready", () => {
    logger.info("Discord bridge connected as %s", client.user?.tag ?? config.clientId);
    logger.info("Discord bridge will query Marinara at %s", config.serverUrl);
  });
}
