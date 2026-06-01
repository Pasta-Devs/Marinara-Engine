export type EchoMessage = { characterName: string; reaction: string; timestamp: number };

export function readEchoRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function readEchoText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function normalizeEchoMessages(rows: unknown[]): EchoMessage[] {
  const messages: EchoMessage[] = [];
  for (const row of rows) {
    const record = readEchoRecord(row);
    const timestamp = readTimestamp(record.timestamp ?? record.createdAt);
    const directName = readEchoText(record.characterName);
    const directReaction = readEchoText(record.reaction);
    if (directName && directReaction) {
      messages.push({ characterName: directName, reaction: directReaction, timestamp });
      continue;
    }

    const resultData = readEchoRecord(record.resultData);
    const reactions = Array.isArray(resultData.reactions) ? resultData.reactions : [];
    for (const item of reactions) {
      const reactionRecord = readEchoRecord(item);
      const characterName = readEchoText(reactionRecord.characterName);
      const reaction = readEchoText(reactionRecord.reaction);
      if (characterName && reaction) {
        messages.push({ characterName, reaction, timestamp });
      }
    }
  }
  return messages;
}
