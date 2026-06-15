import { Events, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { logger } from "../core/logger.js";
import { startChatEventSync } from "../core/chat-event-sync.js";

export function registerReadyEvent(client: Client, config: DiscordBridgeConfig) {
  client.once(Events.ClientReady, () => {
    logger.info("Discord bridge connected as %s", client.user?.tag ?? config.clientId);
    logger.info("Discord bridge will query Marinara at %s", config.serverUrl);
    startChatEventSync({ client, serverUrl: config.serverUrl });
    logger.info("Discord bridge will use Marinara chat events for Engine to Discord sync");
  });
}
