import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "./command.types.js";
import { buildControlsComponents } from "../components/controls.components.js";
import { getRoleplayControlsState } from "../core/marinara-api.js";
import { buildControlsEmbed } from "../embeds/controls.embed.js";

function isNotFoundError(err: unknown) {
  return err instanceof Error && err.message.includes("HTTP 404");
}

export const controlsCommand: SlashCommandModule = {
  data: new SlashCommandBuilder()
    .setName("controls")
    .setDescription("Show controls for the bound Marinara roleplay thread"),
  async execute(interaction, config) {
    if (interaction.user.bot) {
      await interaction.reply({ content: "Bots cannot use roleplay controls.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: "Run /controls in a bound roleplay thread.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    let state;
    try {
      state = await getRoleplayControlsState(config.serverUrl, interaction.channelId);
    } catch (err) {
      if (isNotFoundError(err)) {
        await interaction.editReply({ content: "Run /controls in a bound roleplay thread." });
        return;
      }
      throw err;
    }

    if (!state.latestAssistantMessage) {
      await interaction.editReply({ content: "No bot response is available yet." });
      return;
    }

    await interaction.editReply({
      embeds: [buildControlsEmbed(state)],
      components: buildControlsComponents(state),
    });
  },
};
