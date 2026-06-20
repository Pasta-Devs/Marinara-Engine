export type FandomWikiRef = {
  key: string;
  source: "fandom";
  url: string;
  apiUrl: string;
  host: string;
  slug?: string;
  wikiId?: string;
  sitename?: string;
  language?: string;
  articlePath?: string;
  scriptPath?: string;
};

export type WikiTruncation = {
  reason: "content_truncated" | "more_available" | "capped_no_continuation";
  returnedBytes?: number;
  totalBytes?: number;
  continueFrom?: string;
  remedyHint?: string;
};

export type ProfessorMariWikiResult<T> = {
  ok: true;
  source: "fandom";
  wiki?: FandomWikiRef;
  data: T;
  truncation?: WikiTruncation;
  fetchedAt: string;
};

export type ProfessorMariWikiError = {
  ok: false;
  source: "fandom";
  category:
    | "invalid_input"
    | "not_found"
    | "permission_denied"
    | "rate_limited"
    | "upstream_failure"
    | "timeout"
    | "content_truncated";
  message: string;
  wiki?: Partial<FandomWikiRef>;
  page?: {
    title?: string;
    pageId?: number;
    url?: string;
  };
  retryAfterSeconds?: number;
};

export type ProfessorMariWikiPayload<T> = ProfessorMariWikiResult<T> | ProfessorMariWikiError;

export type WikiSearchResult = {
  title: string;
  pageId?: number;
  wikiId?: string;
  wikiName?: string;
  wikiUrl?: string;
  url?: string;
  snippet?: string;
  namespace?: number;
  size?: number;
  wordCount?: number;
  timestamp?: string;
  thumbnail?: string;
  score?: number;
};

export type WikiSection = {
  index: string;
  number?: string;
  line: string;
  level?: string;
  tocLevel?: number;
  anchor?: string;
  byteOffset?: number;
};

export type WikiPageContentMode = "summary" | "source" | "html" | "none";

export type WikiPageData = {
  title: string;
  pageId?: number;
  url?: string;
  displayTitle?: string;
  contentMode: WikiPageContentMode;
  content?: string;
  source?: string;
  htmlText?: string;
  metadata?: Record<string, unknown>;
  sections?: WikiSection[];
  categories?: string[];
  links?: string[];
};

export type WikiCategoryMember = {
  title: string;
  pageId?: number;
  namespace?: number;
  type?: "page" | "subcat" | "file";
};

export type WikiSiteInfo = {
  general: Record<string, unknown>;
  namespaces?: Record<string, unknown>;
  namespaceAliases?: unknown[];
  statistics?: Record<string, unknown>;
};

export type WikiPageSearchMatch = {
  line: number;
  text: string;
  before: string[];
  after: string[];
};

export type FandomMediaWikiClientOptions = {
  requestTimeoutMs?: number;
  contentMaxBytes?: number;
  cacheTtlMs?: number;
  searchCacheTtlMs?: number;
  siteInfoCacheTtlMs?: number;
  maxConcurrentPerHost?: number;
};
