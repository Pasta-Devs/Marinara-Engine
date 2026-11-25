import {
  IMAGE_TAG_CATEGORIES,
  IMAGE_TAG_LIMITS,
  type ImageTagCategory,
  type ImageTagDatasetSummary,
  type ImageTagRecord,
  type ImageTagSearchMatch,
  type ImageTagSearchMode,
  type ImageTagSearchRequest,
  type ImageTagSearchResponse,
} from "@marinara-engine/shared";
import { normalizeImageTagQuery } from "./csv.js";

const MAX_SERIALIZED_RESPONSE_BYTES = 48 * 1024;

type SearchSource = { summary: ImageTagDatasetSummary; records: ImageTagRecord[] };
type SearchResult = ImageTagSearchResponse["results"][number];
type SearchableRecord = {
  canonicalName: string;
  normalizedName: string;
  category: ImageTagCategory;
  postCount: number;
  sourceIds: string[];
  aliases: Array<{ raw: string; normalized: string }>;
};
type RecordMatch = { tier: number; alias?: string };
type Candidate = ImageTagSearchMatch & { tier: number };
type ValidatedRequest = {
  queries: string[];
  mode: ImageTagSearchMode;
  limit: number;
  sourceIds?: Set<string>;
  categories?: Set<ImageTagCategory>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageTagCategory(value: unknown): value is ImageTagCategory {
  return typeof value === "number" && (IMAGE_TAG_CATEGORIES as readonly number[]).includes(value);
}

function validateRequest(request: ImageTagSearchRequest): ValidatedRequest {
  if (!isObject(request)) throw new Error("request must be an object");
  const input = request as Record<string, unknown>;

  if (!Array.isArray(input.queries) || input.queries.length < 1 || input.queries.length > IMAGE_TAG_LIMITS.queries) {
    throw new Error(`queries must contain 1 to ${IMAGE_TAG_LIMITS.queries} entries`);
  }
  const queries = Array.from(input.queries, (query, index) => {
    if (typeof query !== "string" || query.trim().length === 0 || query.length > IMAGE_TAG_LIMITS.queryCharacters) {
      throw new Error(
        `queries[${index}] must be a non-empty string of at most ${IMAGE_TAG_LIMITS.queryCharacters} characters`,
      );
    }
    return query;
  });

  const mode = input.mode === undefined ? "prefix" : input.mode;
  if (mode !== "exact" && mode !== "prefix" && mode !== "substring") {
    throw new Error('mode must be "exact", "prefix", or "substring"');
  }

  const limit = input.limit === undefined ? IMAGE_TAG_LIMITS.resultsPerQuery : input.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > IMAGE_TAG_LIMITS.resultsPerQuery) {
    throw new Error(`limit must be an integer from 1 to ${IMAGE_TAG_LIMITS.resultsPerQuery}`);
  }

  let sourceIds: Set<string> | undefined;
  if (input.sourceIds !== undefined) {
    if (!Array.isArray(input.sourceIds) || input.sourceIds.length > IMAGE_TAG_LIMITS.sources) {
      throw new Error(`sourceIds must be an array of at most ${IMAGE_TAG_LIMITS.sources} source IDs`);
    }
    const ids = new Set<string>();
    for (let index = 0; index < input.sourceIds.length; index += 1) {
      const id = input.sourceIds[index];
      if (typeof id !== "string" || id.trim().length === 0 || id.length > IMAGE_TAG_LIMITS.fieldCharacters) {
        throw new Error(
          `sourceIds[${index}] must be a non-empty string of at most ${IMAGE_TAG_LIMITS.fieldCharacters} characters`,
        );
      }
      ids.add(id);
    }
    sourceIds = ids;
  }

  let categories: Set<ImageTagCategory> | undefined;
  if (input.categories !== undefined) {
    if (!Array.isArray(input.categories)) {
      throw new Error("categories must be an array of Danbooru category IDs");
    }
    const selected = new Set<ImageTagCategory>();
    for (let index = 0; index < input.categories.length; index += 1) {
      const category = input.categories[index];
      if (!isImageTagCategory(category)) {
        throw new Error(`categories[${index}] must be one of ${IMAGE_TAG_CATEGORIES.join(", ")}`);
      }
      selected.add(category);
    }
    categories = selected;
  }

  return { queries, mode, limit, sourceIds, categories };
}

function buildSearchableRecords(
  sources: SearchSource[],
  request: ValidatedRequest,
): { records: SearchableRecord[]; selectedSource: boolean; enabledCategory: boolean } {
  const records: SearchableRecord[] = [];
  const byIdentity = new Map<string, SearchableRecord>();
  let selectedSource = false;
  let enabledCategory = false;

  for (const source of sources) {
    if (!source.summary.enabled) continue;
    if (request.sourceIds && !request.sourceIds.has(source.summary.id)) continue;
    selectedSource = true;

    const categories = new Set<ImageTagCategory>();
    for (const category of source.summary.enabledCategories) {
      if (!isImageTagCategory(category)) continue;
      if (request.categories && !request.categories.has(category)) continue;
      categories.add(category);
    }
    if (categories.size === 0) continue;
    enabledCategory = true;

    for (const record of source.records) {
      if (!categories.has(record.category)) continue;
      const normalizedName = normalizeImageTagQuery(record.name);
      if (!normalizedName) continue;
      const aliases: Array<{ raw: string; normalized: string }> = [];
      for (const alias of record.aliases) {
        const normalized = normalizeImageTagQuery(alias);
        if (normalized) aliases.push({ raw: alias, normalized });
      }
      const key = `${record.category}\u0000${record.name}`;
      const existing = byIdentity.get(key);
      if (existing) {
        existing.postCount = Math.max(existing.postCount, record.postCount);
        if (!existing.sourceIds.includes(source.summary.id)) existing.sourceIds.push(source.summary.id);
        const present = new Set(existing.aliases.map((alias) => alias.raw));
        for (const alias of aliases) if (!present.has(alias.raw)) existing.aliases.push(alias);
      } else {
        const searchable: SearchableRecord = {
          canonicalName: record.name,
          normalizedName,
          category: record.category,
          postCount: record.postCount,
          sourceIds: [source.summary.id],
          aliases,
        };
        byIdentity.set(key, searchable);
        records.push(searchable);
      }
    }
  }

  return { records, selectedSource, enabledCategory };
}

function findAlias(
  aliases: Array<{ raw: string; normalized: string }>,
  matches: (alias: string) => boolean,
): string | undefined {
  let best: string | undefined;
  for (const alias of aliases) {
    if (matches(alias.normalized) && (best === undefined || alias.raw < best)) best = alias.raw;
  }
  return best;
}

function matchRecord(record: SearchableRecord, query: string, mode: ImageTagSearchMode): RecordMatch | null {
  if (record.normalizedName === query) return { tier: 0 };

  const exactAlias = findAlias(record.aliases, (alias) => alias === query);
  if (exactAlias !== undefined) return { tier: 1, alias: exactAlias };
  if (mode === "exact") return null;

  if (record.normalizedName.startsWith(query)) return { tier: 2 };
  const prefixAlias = findAlias(record.aliases, (alias) => alias.startsWith(query));
  if (prefixAlias !== undefined) return { tier: 3, alias: prefixAlias };
  if (mode === "prefix") return null;

  if (record.normalizedName.includes(query)) return { tier: 4 };
  const substringAlias = findAlias(record.aliases, (alias) => alias.includes(query));
  if (substringAlias !== undefined) return { tier: 5, alias: substringAlias };
  return null;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSourceIds(a: string[], b: string[]): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined || right === undefined) continue;
    const compared = compareStrings(left, right);
    if (compared !== 0) return compared;
  }
  return a.length - b.length;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.tier - b.tier ||
    b.postCount - a.postCount ||
    compareStrings(a.canonicalName, b.canonicalName) ||
    a.category - b.category ||
    compareSourceIds(a.sourceIds, b.sourceIds)
  );
}

function findCandidates(records: SearchableRecord[], query: string, mode: ImageTagSearchMode): Candidate[] {
  const candidates = new Map<string, Candidate>();

  for (const record of records) {
    const match = matchRecord(record, query, mode);
    if (!match) continue;

    const key = `${record.category}\u0000${record.canonicalName}`;
    const existing = candidates.get(key);
    if (!existing) {
      const candidate: Candidate = {
        canonicalName: record.canonicalName,
        category: record.category,
        postCount: record.postCount,
        sourceIds: [...record.sourceIds],
        tier: match.tier,
      };
      if (match.alias !== undefined) candidate.matchedAlias = match.alias;
      candidates.set(key, candidate);
      continue;
    }

    existing.postCount = Math.max(existing.postCount, record.postCount);
    for (const id of record.sourceIds) if (!existing.sourceIds.includes(id)) existing.sourceIds.push(id);

    if (
      match.tier < existing.tier ||
      (match.tier === existing.tier &&
        match.alias !== undefined &&
        (existing.matchedAlias === undefined || match.alias < existing.matchedAlias))
    ) {
      existing.tier = match.tier;
      if (match.alias === undefined) delete existing.matchedAlias;
      else existing.matchedAlias = match.alias;
    }
  }

  const sorted = [...candidates.values()];
  for (const candidate of sorted) candidate.sourceIds.sort(compareStrings);
  sorted.sort(compareCandidates);
  return sorted;
}

function serializedBytes(response: ImageTagSearchResponse): number {
  return Buffer.byteLength(JSON.stringify(response), "utf8");
}

function capSerializedResponse(response: ImageTagSearchResponse): void {
  while (serializedBytes(response) > MAX_SERIALIZED_RESPONSE_BYTES) {
    let removed = false;
    for (let index = response.results.length - 1; index >= 0; index -= 1) {
      const result = response.results[index];
      if (!result || result.matches.length === 0) continue;
      result.matches.pop();
      removed = true;
      break;
    }
    if (!removed) break;
  }

  for (const result of response.results) {
    result.truncated = result.totalMatches > result.matches.length;
  }
}

function finalizeResponse(status: ImageTagSearchResponse["status"], results: SearchResult[]): ImageTagSearchResponse {
  const response: ImageTagSearchResponse = { status, results };
  capSerializedResponse(response);
  return response;
}

export function searchImageTagRecords(
  sources: Array<{ summary: ImageTagDatasetSummary; records: ImageTagRecord[] }>,
  request: ImageTagSearchRequest,
): ImageTagSearchResponse {
  const validated = validateRequest(request);
  if (!Array.isArray(sources)) throw new Error("sources must be an array");

  const results: SearchResult[] = validated.queries.map((query) => ({
    query,
    matches: [],
    totalMatches: 0,
    truncated: false,
  }));

  if (sources.length === 0) return finalizeResponse("no_datasets", results);

  const searchable = buildSearchableRecords(sources, validated);
  if (!searchable.selectedSource) return finalizeResponse("disabled", results);
  if (!searchable.enabledCategory) return finalizeResponse("no_enabled_categories", results);

  let remainingResults = IMAGE_TAG_LIMITS.resultsPerCall;
  for (let index = 0; index < validated.queries.length; index += 1) {
    const query = validated.queries[index];
    const result = results[index];
    if (query === undefined || result === undefined) continue;

    const normalizedQuery = normalizeImageTagQuery(query);
    const candidates = normalizedQuery ? findCandidates(searchable.records, normalizedQuery, validated.mode) : [];
    const allowance = Math.min(validated.limit, remainingResults);
    const matches: ImageTagSearchMatch[] = candidates.slice(0, allowance).map((candidate) => {
      const match: ImageTagSearchMatch = {
        canonicalName: candidate.canonicalName,
        category: candidate.category,
        postCount: candidate.postCount,
        sourceIds: candidate.sourceIds,
      };
      if (candidate.matchedAlias !== undefined) match.matchedAlias = candidate.matchedAlias;
      return match;
    });

    result.matches = matches;
    result.totalMatches = candidates.length;
    result.truncated = candidates.length > matches.length;
    remainingResults -= matches.length;
  }

  return finalizeResponse("ready", results);
}
