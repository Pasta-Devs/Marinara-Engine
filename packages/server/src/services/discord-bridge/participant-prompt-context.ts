import { stripMacroComments, type ChatParticipantSnapshot, type DiscordBridgeParticipant } from "@marinara-engine/shared";
import { wrapContent } from "../prompt/format-engine.js";

export type PersonaPromptFields = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  backstory?: string | null;
  appearance?: string | null;
};

export interface ParticipantPromptEntry {
  participant: DiscordBridgeParticipant;
  persona: PersonaPromptFields | null;
}

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

export function buildParticipantPromptEntries(
  participants: DiscordBridgeParticipant[],
  personas: PersonaPromptFields[],
): ParticipantPromptEntry[] {
  const personasById = new Map(personas.flatMap((persona) => (persona.id ? [[persona.id, persona] as const] : [])));

  return participants.map((participant) => ({
    participant,
    persona: participant.personaId ? (personasById.get(participant.personaId) ?? null) : null,
  }));
}

export function compactPersonaSummary(persona: PersonaPromptFields | null): string {
  if (!persona) return "";
  return [
    persona.description,
    persona.personality ? `Personality: ${persona.personality}` : "",
    persona.backstory ? `Backstory: ${persona.backstory}` : "",
    persona.appearance ? `Appearance: ${persona.appearance}` : "",
    persona.scenario ? `Scenario: ${persona.scenario}` : "",
  ]
    .map((part) => cardPromptText(part))
    .filter(Boolean)
    .join("\n");
}

export function participantPersonaName(entry: ParticipantPromptEntry | null): string | null {
  return entry?.persona?.name?.trim() || null;
}

export function participantSpeakerName(entry: ParticipantPromptEntry | null, fallback = "User"): string {
  return participantPersonaName(entry) ?? entry?.participant.discordDisplayName?.trim() ?? fallback;
}

export function formatParticipantsMacro(entries: ParticipantPromptEntry[]): string {
  return entries
    .map((entry) => {
      const personaName = participantPersonaName(entry) ?? "No selected persona";
      const spoken = entry.participant.hasSpoken ? "has spoken" : "has not spoken yet";
      return `${personaName} (${entry.participant.discordDisplayName}, ${spoken})`;
    })
    .join("; ");
}

export function formatParticipantPromptBlock(input: {
  activeEntry: ParticipantPromptEntry | null;
  entries: ParticipantPromptEntry[];
  wrapFormat: "xml" | "markdown" | "none";
}): string {
  if (!input.activeEntry && input.entries.length === 0) return "";

  const activeName = participantSpeakerName(input.activeEntry);
  const activeSummary = compactPersonaSummary(input.activeEntry?.persona ?? null);
  const activeLines = [
    `Active speaker: ${activeName}`,
    input.activeEntry?.participant.discordDisplayName
      ? `Discord display name: ${input.activeEntry.participant.discordDisplayName}`
      : "",
    activeSummary ? `Persona card:\n${activeSummary}` : "",
  ].filter(Boolean);

  const rosterLines = input.entries.map((entry) => {
    const personaName = participantPersonaName(entry) ?? "No selected persona";
    const spoken = entry.participant.hasSpoken ? "has spoken" : "has not spoken yet";
    return `- ${personaName} controlled by ${entry.participant.discordDisplayName} (${spoken})`;
  });

  const controlRule =
    "The active player-controlled roster is authoritative for who the AI must not control. Player-controlled personas are controlled by Discord users. Do not write their dialogue, thoughts, decisions, or actions unless the user explicitly provides them.";

  if (input.wrapFormat === "markdown") {
    return [
      "## Discord Multiplayer Participants",
      activeLines.join("\n"),
      "Player-controlled roster:",
      ...rosterLines,
      controlRule,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (input.wrapFormat === "none") {
    return ["Discord multiplayer participants:", activeLines.join("\n"), ...rosterLines, controlRule]
      .filter(Boolean)
      .join("\n");
  }

  return [
    wrapContent(activeLines.join("\n"), "active_speaker", "xml", 1),
    wrapContent(rosterLines.join("\n"), "player_controlled_personas", "xml", 1),
    wrapContent(controlRule, "player_control_rule", "xml", 1),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildParticipantSnapshot(input: {
  participant: DiscordBridgeParticipant;
  persona: PersonaPromptFields | null;
}): ChatParticipantSnapshot {
  return {
    participantId: input.participant.id,
    chatId: input.participant.chatId,
    source: input.participant.source,
    guildId: input.participant.guildId,
    discordUserId: input.participant.discordUserId,
    discordDisplayName: input.participant.discordDisplayName,
    personaId: input.participant.personaId,
    personaName: input.persona?.name ?? null,
  };
}
