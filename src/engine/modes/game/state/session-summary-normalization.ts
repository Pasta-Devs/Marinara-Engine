export interface SessionSummaryFactLists {
  keyDiscoveries: string[];
  characterMoments: string[];
  littleDetails: string[];
  npcUpdates: string[];
}

function buildSessionFactKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[.,!?;:()[\]{}"'`*_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeBucket(values: string[], seen: Set<string>): string[] {
  const deduped: string[] = [];

  for (const value of values) {
    const key = buildSessionFactKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

export function dedupeSessionSummaryLists(lists: SessionSummaryFactLists): SessionSummaryFactLists {
  const seen = new Set<string>();

  // Keep the most specific buckets first so repeated facts fall out of the broader ones.
  const characterMoments = dedupeBucket(lists.characterMoments, seen);
  const npcUpdates = dedupeBucket(lists.npcUpdates, seen);
  const littleDetails = dedupeBucket(lists.littleDetails, seen);
  const keyDiscoveries = dedupeBucket(lists.keyDiscoveries, seen);

  return {
    keyDiscoveries,
    characterMoments,
    littleDetails,
    npcUpdates,
  };
}
