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

type PersonaSnapshotLike = {
  name?: unknown;
};

type ParticipantSnapshotLike = {
  discordUserId?: unknown;
  discordDisplayName?: unknown;
  personaName?: unknown;
};

function cardPromptText(value: unknown): string {
  return typeof value === "string" ? stripMacroComments(value).trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function participantDisplayName(entry: ParticipantPromptEntry): string {
  return entry.participant.discordDisplayName.trim() || "Discord User";
}

function participantDisplayNameKey(entry: ParticipantPromptEntry): string {
  return participantDisplayName(entry).toLocaleLowerCase();
}

function buildDisplayNameCounts(entries: ParticipantPromptEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = participantDisplayNameKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function participantOwnerLabel(entry: ParticipantPromptEntry, displayNameCounts: Map<string, number>): string {
  const displayName = participantDisplayName(entry);
  if ((displayNameCounts.get(participantDisplayNameKey(entry)) ?? 0) > 1 && entry.participant.discordUserId) {
    return `${displayName} (Discord user ${entry.participant.discordUserId})`;
  }
  return displayName;
}

export function formatParticipantsMacro(entries: ParticipantPromptEntry[]): string {
  const displayNameCounts = buildDisplayNameCounts(entries);
  return entries
    .map((entry) => {
      const personaName = participantPersonaName(entry) ?? "No selected persona";
      const spoken = entry.participant.hasSpoken ? "has spoken" : "has not spoken yet";
      return `${personaName} (${participantOwnerLabel(entry, displayNameCounts)}, ${spoken})`;
    })
    .join("; ");
}

export function participantSnapshotPersonaName(input: {
  personaSnapshot?: unknown;
  participantSnapshot?: unknown;
}): string | null {
  const personaSnapshot = asRecord(input.personaSnapshot) as PersonaSnapshotLike | null;
  const participantSnapshot = asRecord(input.participantSnapshot) as ParticipantSnapshotLike | null;
  return stringValue(participantSnapshot?.personaName) || stringValue(personaSnapshot?.name) || null;
}

export function formatParticipantHistoryContent(input: {
  content: string;
  personaSnapshot?: unknown;
  participantSnapshot?: unknown;
}): string {
  const participantSnapshot = asRecord(input.participantSnapshot) as ParticipantSnapshotLike | null;
  if (!participantSnapshot) return input.content;

  const personaName = participantSnapshotPersonaName(input) ?? "Unknown persona";
  const discordDisplayName = stringValue(participantSnapshot.discordDisplayName);
  const discordUserId = stringValue(participantSnapshot.discordUserId);
  const speakerParts = [
    `Persona: ${personaName}`,
    discordDisplayName ? `Discord display name: ${discordDisplayName}` : "",
    discordUserId ? `Discord user ID: ${discordUserId}` : "",
  ].filter(Boolean);

  return [`[Discord message speaker - ${speakerParts.join("; ")}]`, input.content].filter(Boolean).join("\n");
}

function indentBlock(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

export function formatParticipantPromptBlock(input: {
  activeEntry: ParticipantPromptEntry | null;
  entries: ParticipantPromptEntry[];
  wrapFormat: "xml" | "markdown" | "none";
}): string {
  if (!input.activeEntry && input.entries.length === 0) return "";

  const displayNameCounts = buildDisplayNameCounts(input.entries);
  const activeSummary = compactPersonaSummary(input.activeEntry?.persona ?? null);
  const activeLines = input.activeEntry
    ? [
        `Active speaker: ${participantSpeakerName(input.activeEntry)}`,
        input.activeEntry.participant.discordDisplayName
          ? `Discord user: ${participantOwnerLabel(input.activeEntry, displayNameCounts)}`
          : "",
        activeSummary ? `Persona card:\n${activeSummary}` : "",
      ].filter(Boolean)
    : [];

  const rosterLines = input.entries.map((entry) => {
    const personaName = participantPersonaName(entry) ?? "No selected persona";
    const spoken = entry.participant.hasSpoken ? "has spoken" : "has not spoken yet";
    const personaSummary = compactPersonaSummary(entry.persona);
    return [
      `- ${personaName} controlled by ${participantOwnerLabel(entry, displayNameCounts)} (${spoken})`,
      personaSummary ? `  Persona card:\n${indentBlock(personaSummary, "    ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const controlRule =
    "The active player-controlled roster is authoritative for who the AI must not control. Player-controlled personas are controlled by Discord users. The AI may mention them, remember facts about them, react to what they said, and describe the world around them. Do not write their dialogue, private thoughts, decisions, intentions, or voluntary actions unless the controlling Discord user explicitly provides them.";

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
    return ["Discord multiplayer participants:", activeLines.join("\n"), "Player-controlled roster:", ...rosterLines, controlRule]
      .filter(Boolean)
      .join("\n");
  }

  return [
    activeLines.length > 0 ? wrapContent(activeLines.join("\n"), "active_speaker", "xml", 1) : "",
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
