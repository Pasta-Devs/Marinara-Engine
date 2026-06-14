import type { Client } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";
import { registerReadyEvent } from "./ready.js";

export function registerEvents(client: Client, config: DiscordBridgeConfig) {
  registerReadyEvent(client, config);
}
