import { EmbedBuilder } from "discord.js";
import type { DiscordBridgePersonaOption } from "@marinara-engine/shared";

const EMBED_COLOR = 0xe85d75;
const DESCRIPTION_LIMIT = 4096;

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

export function buildPersonaListEmbed(personas: DiscordBridgePersonaOption[]) {
  const lines = personas.map((persona, index) => {
    const active = persona.isActive ? " (active)" : "";
    return `${index + 1}. ${persona.name}${active}`;
  });
  const description = lines.length > 0 ? lines.join("\n") : "No personas found.";
  const selectNote = personas.length > 25 ? `\n\nShowing ${personas.length} personas. Selector includes the first 25.` : "";

  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("Personas")
    .setDescription(truncate(`${description}${selectNote}`, DESCRIPTION_LIMIT))
    .setFooter({ text: `${personas.length} persona(s)` });
}
