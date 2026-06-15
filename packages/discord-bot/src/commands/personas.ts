import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "./command.types.js";
import { buildPersonaListComponents } from "../components/persona-list.components.js";
import { getBridgeSetupOptions } from "../core/marinara-api.js";
import { buildPersonaListEmbed } from "../embeds/persona-list.embed.js";

export const personasCommand: SlashCommandModule = {
  data: new SlashCommandBuilder().setName("personas").setDescription("Browse Marinara personas"),
  async execute(interaction, config) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const setup = await getBridgeSetupOptions(config.serverUrl);
    await interaction.editReply({
      embeds: [buildPersonaListEmbed(setup.personas)],
      components: buildPersonaListComponents(setup.personas),
    });
  },
};
