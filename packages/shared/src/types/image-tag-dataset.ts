export const IMAGE_TAG_CATEGORIES = [0, 1, 3, 4, 5] as const;
export type ImageTagCategory = (typeof IMAGE_TAG_CATEGORIES)[number];

export const IMAGE_TAG_LIMITS = {
  uploadBytes: 64 * 1024 * 1024,
  recordsPerSource: 500_000,
  installedRecords: 1_000_000,
  sources: 20,
  fieldCharacters: 512,
  aliasesPerRecord: 64,
  issueExamples: 50,
  queries: 20,
  queryCharacters: 200,
  resultsPerQuery: 20,
  resultsPerCall: 100,
} as const;

export interface ImageTagRecord {
  name: string;
  category: ImageTagCategory;
  postCount: number;
  aliases: string[];
}

export interface ImageTagImportIssue {
  row: number;
  code: "invalid_columns" | "invalid_name" | "invalid_category" | "invalid_count" | "invalid_aliases" | "duplicate";
}

export interface ImageTagImportReport {
  totalRows: number;
  acceptedRows: number;
  blankRows: number;
  invalidRows: number;
  duplicateRows: number;
  headerRows: number;
  issues: ImageTagImportIssue[];
  omittedIssues: number;
}

export interface ImageTagDatasetSummary {
  id: string;
  name: string;
  originalName: string;
  sourceUrl?: string;
  importedAt: string;
  updatedAt: string;
  fingerprint: string;
  scheme: "danbooru";
  enabled: boolean;
  enabledCategories: ImageTagCategory[];
  recordCount: number;
  categoryCounts: Partial<Record<ImageTagCategory, number>>;
  report: ImageTagImportReport;
}

export type ImageTagSearchMode = "exact" | "prefix" | "substring";

export interface ImageTagSearchRequest {
  queries: string[];
  mode?: ImageTagSearchMode;
  limit?: number;
  sourceIds?: string[];
  categories?: ImageTagCategory[];
}

export interface ImageTagSearchMatch {
  canonicalName: string;
  category: ImageTagCategory;
  postCount: number;
  sourceIds: string[];
  matchedAlias?: string;
}

export interface ImageTagSearchResponse {
  status: "ready" | "no_datasets" | "disabled" | "no_enabled_categories";
  results: Array<{
    query: string;
    matches: ImageTagSearchMatch[];
    totalMatches: number;
    truncated: boolean;
  }>;
}
