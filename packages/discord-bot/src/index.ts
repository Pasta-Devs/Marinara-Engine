import { Client, GatewayIntentBits } from "discord.js";
import { syncGuildCommands } from "./commands/index.js";
import { isEnabledFlag, loadDiscordBridgeConfig } from "./config/env.js";
import { logger } from "./core/logger.js";
import { registerEvents } from "./events/index.js";

async function main() {
  if (!isEnabledFlag(process.env.DISCORD_BRIDGE_ENABLED)) {
    logger.info("Discord bridge disabled");
    return;
  }

  const config = loadDiscordBridgeConfig();

  await syncGuildCommands(config.token, config.clientId, config.guildId);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });
  registerEvents(client, config);

  process.once("SIGINT", () => {
    void client.destroy();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    void client.destroy();
    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((err) => {
  logger.error(err, "Discord bridge failed to start");
  process.exit(1);
});
