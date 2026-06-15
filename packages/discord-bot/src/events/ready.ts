import { Events, type Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { syncEngineMessagesToDiscord } from "../core/engine-sync.js";
import { getBridgeHealth } from "../core/marinara-api.js";
import { logger } from "../core/logger.js";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export function registerReadyEvent(client: Client, config: DiscordBridgeConfig) {
  client.once(Events.ClientReady, () => {
    logger.info("Discord bridge connected as %s", client.user?.tag ?? config.clientId);
    logger.info("Discord bridge will query Marinara at %s", config.serverUrl);
    let syncing = false;
    let serverReady = false;
    let waitingLogged = false;

    const waitForServer = () => {
      void getBridgeHealth(config.serverUrl)
        .then(() => {
          if (!serverReady) {
            logger.info("Discord bridge handshake succeeded with Marinara at %s", config.serverUrl);
          }
          serverReady = true;
          waitingLogged = false;
          runSync();
        })
        .catch((err) => {
          serverReady = false;
          if (!waitingLogged) {
            logger.warn("Discord bridge waiting for Marinara at %s: %s", config.serverUrl, errorMessage(err));
            waitingLogged = true;
          }
        });
    };

    const runSync = () => {
      if (!serverReady) {
        waitForServer();
        return;
      }
      if (syncing) return;
      syncing = true;
      void syncEngineMessagesToDiscord({ client, serverUrl: config.serverUrl })
        .catch((err) => {
          serverReady = false;
          logger.warn("Engine to Discord sync paused until Marinara handshake recovers: %s", errorMessage(err));
        })
        .finally(() => {
          syncing = false;
        });
    };
    waitForServer();
    setInterval(runSync, config.engineSyncIntervalMs).unref();
    logger.info("Discord bridge handshake and engine sync interval set to %d ms", config.engineSyncIntervalMs);
  });
}
