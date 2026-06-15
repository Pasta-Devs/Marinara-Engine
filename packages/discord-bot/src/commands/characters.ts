import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "./command.types.js";
import { buildCharacterListComponents } from "../components/character-list.components.js";
import { getBridgeSetupOptions } from "../core/marinara-api.js";
import { buildCharacterListEmbed } from "../embeds/character-list.embed.js";

export const charactersCommand: SlashCommandModule = {
  data: new SlashCommandBuilder().setName("characters").setDescription("Browse Marinara character cards"),
  async execute(interaction, config) {
    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: "Only the configured Marinara Discord owner can use this command.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();
    const setup = await getBridgeSetupOptions(config.serverUrl);
    await interaction.editReply({
      embeds: [buildCharacterListEmbed(setup.characters)],
      components: buildCharacterListComponents(setup.characters),
    });
  },
};
