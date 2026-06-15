import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { DiscordBridgeControlsState } from "@marinara-engine/shared";

export const CONTROLS_BACK_CUSTOM_ID = "controls:back";
export const CONTROLS_REGEN_CUSTOM_ID = "controls:regen";
export const CONTROLS_FORWARD_CUSTOM_ID = "controls:forward";
export const CONTROLS_CLOSE_CUSTOM_ID = "controls:close";

export function buildControlsComponents(state: DiscordBridgeControlsState) {
  const hasMessage = !!state.latestAssistantMessage;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CONTROLS_BACK_CUSTOM_ID)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMessage || !state.canGoBack),
      new ButtonBuilder()
        .setCustomId(CONTROLS_REGEN_CUSTOM_ID)
        .setLabel("Regen")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!hasMessage || !state.canRegenerate),
      new ButtonBuilder()
        .setCustomId(CONTROLS_FORWARD_CUSTOM_ID)
        .setLabel("Forward")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasMessage || !state.canGoForward),
      new ButtonBuilder()
        .setCustomId(CONTROLS_CLOSE_CUSTOM_ID)
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}
