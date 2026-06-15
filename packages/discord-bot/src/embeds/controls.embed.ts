import { EmbedBuilder } from "discord.js";
import type { DiscordBridgeControlsState } from "@marinara-engine/shared";

export function buildControlsEmbed(state: DiscordBridgeControlsState) {
  const message = state.latestAssistantMessage;
  const embed = new EmbedBuilder().setTitle("Roleplay Controls").setColor(0x2f855a);

  if (!message) {
    return embed.setDescription("No bot response is available yet.");
  }

  return embed.addFields({
    name: "Response history",
    value: `${message.activeSwipeIndex + 1} / ${Math.max(message.swipeCount, 1)}`,
    inline: true,
  });
}
