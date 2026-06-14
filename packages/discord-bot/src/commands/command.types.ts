import type { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { DiscordBridgeConfig } from "../config/env.js";

export interface SlashCommandModule {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction, config: DiscordBridgeConfig): Promise<void>;
}
