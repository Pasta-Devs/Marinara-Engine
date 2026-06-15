import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { SlashCommandModule } from "./command.types.js";
import { getBridgeSetupOptions, listThreadBindings } from "../core/marinara-api.js";
import { buildRoleplaySetupComponents } from "../components/roleplay-setup.components.js";
import { buildRoleplaySetupEmbed } from "../embeds/roleplay-setup.embed.js";

export const roleplayCommand: SlashCommandModule = {
  data: new SlashCommandBuilder()
    .setName("roleplay")
    .setDescription("Set up a Discord thread-backed Marinara roleplay"),
  async execute(interaction, config) {
    if (interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: "Only the configured Marinara Discord owner can use this command.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const [setup, bindings] = await Promise.all([
      getBridgeSetupOptions(config.serverUrl),
      listThreadBindings(config.serverUrl),
    ]);

    await interaction.editReply({
      embeds: [buildRoleplaySetupEmbed({ setup, bindings })],
      components: buildRoleplaySetupComponents(),
    });
  },
};
