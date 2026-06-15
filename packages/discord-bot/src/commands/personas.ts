import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "./command.types.js";
import { buildPersonaListComponents } from "../components/persona-list.components.js";
import { getBridgeSetupOptions } from "../core/marinara-api.js";
import { buildPersonaListEmbed } from "../embeds/persona-list.embed.js";

export const personasCommand: SlashCommandModule = {
  data: new SlashCommandBuilder().setName("personas").setDescription("Browse Marinara personas"),
  async execute(interaction, config) {
    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: "Only the configured Marinara Discord owner can use this command.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    const setup = await getBridgeSetupOptions(config.serverUrl);
    await interaction.editReply({
      embeds: [buildPersonaListEmbed(setup.personas)],
      components: buildPersonaListComponents(setup.personas),
    });
  },
};
