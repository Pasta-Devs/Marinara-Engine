import type { Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { registerInteractionCreateEvent } from "./interaction-create.js";
import { registerReadyEvent } from "./ready.js";

export function registerEvents(client: Client, config: DiscordBridgeConfig) {
  registerReadyEvent(client, config);
  registerInteractionCreateEvent(client, config);
}
