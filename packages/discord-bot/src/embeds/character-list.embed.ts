import { EmbedBuilder } from "discord.js";
import type { DiscordBridgeCharacterOption } from "@marinara-engine/shared";

const EMBED_COLOR = 0xe85d75;
const DESCRIPTION_LIMIT = 4096;

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

export function buildCharacterListEmbed(characters: DiscordBridgeCharacterOption[]) {
  const lines = characters.map((character, index) => `${index + 1}. ${character.name}`);
  const description = lines.length > 0 ? lines.join("\n") : "No characters found.";
  const selectNote =
    characters.length > 25 ? `\n\nShowing ${characters.length} characters. Selector includes the first 25.` : "";

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("Characters")
    .setDescription(truncate(`${description}${selectNote}`, DESCRIPTION_LIMIT))
    .setFooter({ text: `${characters.length} character(s)` });
}
