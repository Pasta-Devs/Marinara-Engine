import type { CustomTrackerField } from "../types/game-state.js";

export const PARTICIPANT_TRACKER_FIELD_NAME = "Participant Tracker";

export interface ParticipantTrackerState {
  personaName: string;
  discordDisplayName?: string | null;
  location?: string | null;
  currentAction?: string | null;
  inventory?: string[] | null;
  status?: string | null;
  notes?: string | null;
}

export function isParticipantTrackerField(field: Pick<CustomTrackerField, "name"> | null | undefined): boolean {
  return field?.name?.trim().toLowerCase() === PARTICIPANT_TRACKER_FIELD_NAME.toLowerCase();
}

export function splitParticipantTrackerFields(fields: CustomTrackerField[]): {
  participantTracker: CustomTrackerField | null;
  customFields: CustomTrackerField[];
} {
  let participantTracker: CustomTrackerField | null = null;
  const customFields: CustomTrackerField[] = [];
  for (const field of fields) {
    if (isParticipantTrackerField(field) && !participantTracker) {
      participantTracker = field;
    } else {
      customFields.push(field);
    }
  }
  return { participantTracker, customFields };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter((item) => item.length > 0)
    : [];
}

function parseParticipantTrackerValue(value: string): ParticipantTrackerState[] | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const entries = parsed.flatMap((entry): ParticipantTrackerState[] => {
      if (!entry || typeof entry !== "object") return [];
      const record = entry as Record<string, unknown>;
      const personaName = normalizeText(record.personaName ?? record.name);
      if (!personaName) return [];
      return [
        {
          personaName,
          discordDisplayName: normalizeText(record.discordDisplayName) || null,
          location: normalizeText(record.location) || null,
          currentAction: normalizeText(record.currentAction ?? record.action) || null,
          inventory: normalizeStringArray(record.inventory),
          status: normalizeText(record.status) || null,
          notes: normalizeText(record.notes) || null,
        },
      ];
    });
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

export function formatParticipantTrackerField(field: CustomTrackerField): string {
  const entries = parseParticipantTrackerValue(field.value);
  if (!entries) return field.value;

  return entries
    .map((entry) => {
      const details = [
        entry.discordDisplayName ? `Discord: ${entry.discordDisplayName}` : "",
        entry.location ? `location: ${entry.location}` : "",
        entry.currentAction ? `current action: ${entry.currentAction}` : "",
        entry.status ? `status: ${entry.status}` : "",
        entry.inventory?.length ? `inventory: ${entry.inventory.join(", ")}` : "",
        entry.notes ? `notes: ${entry.notes}` : "",
      ].filter(Boolean);
      return `- ${entry.personaName}${details.length > 0 ? ` (${details.join("; ")})` : ""}`;
    })
    .join("\n");
}
