import type { StorageGateway } from "../capabilities/storage";
import type { MessageExtra } from "../contracts/types/chat";
import { boolish, isRecord, parseRecord, readString, type JsonRecord } from "./runtime-records";

export type PersonaMessageSnapshot = NonNullable<MessageExtra["personaSnapshot"]>;

function recordData(record: JsonRecord): JsonRecord {
  const data = parseRecord(record.data);
  return Object.keys(data).length > 0 ? data : record;
}

function field(record: JsonRecord, data: JsonRecord, key: string): unknown {
  return data[key] ?? record[key];
}

function optionalString(value: unknown): string | null {
  const text = readString(value).trim();
  return text || null;
}

function avatarCropSnapshot(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!isRecord(value)) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function personaSnapshotFromRecord(value: unknown): PersonaMessageSnapshot | null {
  if (!isRecord(value)) return null;
  const data = recordData(value);
  const personaId = readString(value.id ?? data.id).trim();
  if (!personaId) return null;
  const name = readString(field(value, data, "name")).trim() || "You";
  return {
    personaId,
    name,
    description: optionalString(field(value, data, "description")),
    personality: optionalString(field(value, data, "personality")),
    scenario: optionalString(field(value, data, "scenario")),
    backstory: optionalString(field(value, data, "backstory")),
    appearance: optionalString(field(value, data, "appearance")),
    avatarUrl:
      optionalString(field(value, data, "avatarPath")) ??
      optionalString(field(value, data, "avatarUrl")) ??
      optionalString(field(value, data, "avatar")),
    avatarCrop: avatarCropSnapshot(field(value, data, "avatarCrop")),
    nameColor: optionalString(field(value, data, "nameColor")),
    dialogueColor: optionalString(field(value, data, "dialogueColor")),
    boxColor: optionalString(field(value, data, "boxColor")),
  };
}

function personaRecordMatchesId(value: unknown, personaId: string): value is JsonRecord {
  if (!isRecord(value)) return false;
  return readString(value.id ?? parseRecord(value.data).id).trim() === personaId;
}

function personaRecordIsActive(value: unknown): value is JsonRecord {
  if (!isRecord(value)) return false;
  const data = parseRecord(value.data);
  return boolish(data.isActive ?? value.isActive ?? data.active ?? value.active, false);
}

export function findPersonaSnapshotForChat(personas: unknown[], chat: unknown): PersonaMessageSnapshot | null {
  const chatRecord = parseRecord(chat);
  const personaId = readString(chatRecord.personaId).trim();
  const persona =
    (personaId ? personas.find((candidate) => personaRecordMatchesId(candidate, personaId)) : null) ??
    personas.find(personaRecordIsActive);
  return personaSnapshotFromRecord(persona);
}

export async function loadPersonaSnapshotForChat(
  storage: StorageGateway,
  chat: unknown,
): Promise<PersonaMessageSnapshot | null> {
  const chatRecord = parseRecord(chat);
  const personaId = readString(chatRecord.personaId).trim();
  if (personaId) {
    const persona = await storage.get<JsonRecord>("personas", personaId).catch(() => null);
    const snapshot = personaSnapshotFromRecord(persona);
    if (snapshot) return snapshot;
  }
  const personas = await storage.list<JsonRecord>("personas").catch(() => []);
  return findPersonaSnapshotForChat(personas, chatRecord);
}
