export const CHAT_SUMMARY_BATCH_MAX_MESSAGES = 500;

export interface ChatSummaryBatchRangeDraft {
  id: string;
  start: string;
  end: string;
}

export type ChatSummaryBatchRangeError = "missing" | "invalid" | "outside" | "tooLarge";

export interface ChatSummaryBatchRangeInspection {
  id: string;
  start: number | null;
  end: number | null;
  normalizedStart: number | null;
  normalizedEnd: number | null;
  error: ChatSummaryBatchRangeError | null;
  overlaps: boolean;
}

export interface ChatSummaryBatchEntryRange {
  id: string;
  start: number;
  end: number;
}

function parseRangeEndpoint(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasRangeEndpoint(value: string): boolean {
  return value.trim().length > 0;
}

export function inspectChatSummaryBatchRanges(
  ranges: ChatSummaryBatchRangeDraft[],
  totalMessageCount: number,
  maxMessages = CHAT_SUMMARY_BATCH_MAX_MESSAGES,
): ChatSummaryBatchRangeInspection[] {
  const inspected = ranges.map<ChatSummaryBatchRangeInspection>((range) => {
    const start = parseRangeEndpoint(range.start);
    const end = parseRangeEndpoint(range.end);
    const normalizedStart = start !== null && end !== null ? Math.min(start, end) : null;
    const normalizedEnd = start !== null && end !== null ? Math.max(start, end) : null;
    let error: ChatSummaryBatchRangeError | null = null;

    if (!hasRangeEndpoint(range.start) || !hasRangeEndpoint(range.end)) {
      error = "missing";
    } else if (start === null || end === null) {
      error = "invalid";
    } else if (normalizedStart! > totalMessageCount || normalizedEnd! > totalMessageCount || totalMessageCount < 1) {
      error = "outside";
    } else if (normalizedEnd! - normalizedStart! + 1 > maxMessages) {
      error = "tooLarge";
    }

    return {
      id: range.id,
      start,
      end,
      normalizedStart,
      normalizedEnd,
      error,
      overlaps: false,
    };
  });

  const overlapIds = new Set<string>();
  for (let leftIndex = 0; leftIndex < inspected.length; leftIndex += 1) {
    const left = inspected[leftIndex]!;
    if (left.normalizedStart === null || left.normalizedEnd === null) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < inspected.length; rightIndex += 1) {
      const right = inspected[rightIndex]!;
      if (right.normalizedStart === null || right.normalizedEnd === null) continue;
      if (left.normalizedStart <= right.normalizedEnd && right.normalizedStart <= left.normalizedEnd) {
        overlapIds.add(left.id);
        overlapIds.add(right.id);
      }
    }
  }

  return inspected.map((range) => ({ ...range, overlaps: overlapIds.has(range.id) }));
}

export function createNextChatSummaryBatchRange(
  previous: ChatSummaryBatchRangeInspection,
  totalMessageCount: number,
): Pick<ChatSummaryBatchRangeDraft, "start" | "end"> | null {
  if (
    previous.error !== null ||
    previous.normalizedStart === null ||
    previous.normalizedEnd === null ||
    totalMessageCount < 1
  ) {
    return null;
  }
  const start = previous.normalizedEnd + 1;
  if (start > totalMessageCount) return null;
  const size = previous.normalizedEnd - previous.normalizedStart + 1;
  return {
    start: String(start),
    end: String(Math.min(totalMessageCount, start + size - 1)),
  };
}

export function sortChatSummaryBatchRanges<T extends { id: string; start: number; end: number }>(ranges: T[]): T[] {
  return [...ranges].sort(
    (left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id),
  );
}

export function orderChatSummaryBatchEntries(entryIds: string[], batchEntries: ChatSummaryBatchEntryRange[]): string[] {
  const batchIds = new Set(batchEntries.map((entry) => entry.id));
  const orderedBatchIds = sortChatSummaryBatchRanges(batchEntries.filter((entry) => entryIds.includes(entry.id))).map(
    (entry) => entry.id,
  );
  if (orderedBatchIds.length === 0) return entryIds;
  return [...entryIds.filter((entryId) => !batchIds.has(entryId)), ...orderedBatchIds];
}
