import { TtlCache } from "./cache.js";
import {
  assertSafeRedirect,
  isFandomHost,
  pageRefFromUrl,
  pageUrlForTitle,
  serviceUrl,
  wikiApiUrl,
  wikiRefFromCommunityResult,
  wikiRefFromHost,
  wikiRefFromInput,
} from "./fandom-url.js";
import { cleanSnippet, stripHtml } from "./html-text.js";
import { truncateUtf8 } from "./truncation.js";
import type {
  FandomMediaWikiClientOptions,
  FandomWikiRef,
  ProfessorMariWikiError,
  ProfessorMariWikiPayload,
  ProfessorMariWikiResult,
  WikiCategoryMember,
  WikiPageContentMode,
  WikiPageData,
  WikiPageSearchMatch,
  WikiSearchResult,
  WikiSection,
  WikiSiteInfo,
  WikiTruncation,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CONTENT_MAX_BYTES = 50_000;
const DEFAULT_CACHE_TTL_MS = 300_000;
const DEFAULT_SEARCH_CACHE_TTL_MS = 60_000;
const DEFAULT_SITE_INFO_CACHE_TTL_MS = 3_600_000;
const DEFAULT_MAX_CONCURRENT_PER_HOST = 3;

type JsonRecord = Record<string, unknown>;

class WikiClientError extends Error {
  constructor(
    readonly category: ProfessorMariWikiError["category"],
    message: string,
    readonly extras: Partial<ProfessorMariWikiError> = {},
  ) {
    super(message);
  }
}

class HostQueue {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      this.queue.shift()?.();
    }
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeLimit(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return fallback;
  return Math.min(max, Math.floor(value));
}

function ok<T>(wiki: FandomWikiRef | undefined, data: T, truncation?: WikiTruncation): ProfessorMariWikiResult<T> {
  return {
    ok: true,
    source: "fandom",
    wiki,
    data,
    truncation,
    fetchedAt: new Date().toISOString(),
  };
}

function titleFromPageArgs(args: { title?: string; pageUrl?: string }) {
  return args.title?.trim() || (args.pageUrl ? pageRefFromUrl(args.pageUrl).title : undefined);
}

function extractRevisionContent(page: JsonRecord): {
  source?: string;
  metadata: Record<string, unknown>;
} {
  const revisions = Array.isArray(page.revisions) ? page.revisions : [];
  const revision = revisions.find(isRecord);
  const slots = isRecord(revision?.slots) ? revision.slots : undefined;
  const main = isRecord(slots?.main) ? slots.main : undefined;
  const source =
    stringValue(main?.content) ??
    stringValue(main?.["*"]) ??
    stringValue(revision?.content) ??
    stringValue(revision?.["*"]);
  return {
    source,
    metadata: {
      latestRevisionId: revision?.revid,
      parentRevisionId: revision?.parentid,
      revisionTimestamp: revision?.timestamp,
      contentModel: main?.contentmodel ?? revision?.contentmodel,
      contentFormat: main?.contentformat,
      size: revision?.size ?? page.length,
    },
  };
}

function normalizeSections(value: unknown): WikiSection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((section) => ({
    index: String(section.index ?? ""),
    number: stringValue(section.number),
    line: stringValue(section.line) ?? "",
    level: stringValue(section.level),
    tocLevel: numberValue(section.toclevel),
    anchor: stringValue(section.anchor) ?? stringValue(section.linkAnchor),
    byteOffset: numberValue(section.byteoffset),
  }));
}

function categoryNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => stringValue(entry.category) ?? stringValue(entry.title))
    .filter((entry): entry is string => !!entry);
}

function linkNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => stringValue(entry.title))
    .filter((entry): entry is string => !!entry);
}

function resultFromServicePage(value: JsonRecord): WikiSearchResult | null {
  const title = stringValue(value.title);
  if (!title) return null;
  let wikiUrl: string | undefined;
  const url = stringValue(value.url);
  if (url) {
    try {
      const parsed = new URL(url);
      if (isFandomHost(parsed.hostname)) wikiUrl = parsed.origin;
    } catch {
      // ignore malformed upstream URLs
    }
  }
  return {
    title,
    pageId: numberValue(value.pageId),
    wikiId: value.wikiId === undefined ? undefined : String(value.wikiId),
    wikiName: stringValue(value.sitename),
    wikiUrl,
    url,
    snippet: cleanSnippet(value.content),
    namespace: numberValue(value.namespace),
    thumbnail: stringValue(value.thumbnail),
    score: numberValue(value.score),
  };
}

function resultFromMediaWikiSearch(value: JsonRecord, wiki: FandomWikiRef): WikiSearchResult | null {
  const title = stringValue(value.title);
  if (!title) return null;
  return {
    title,
    pageId: numberValue(value.pageid),
    wikiId: wiki.wikiId,
    wikiName: wiki.sitename,
    wikiUrl: wiki.url,
    url: pageUrlForTitle(wiki, title),
    snippet: cleanSnippet(value.snippet),
    namespace: numberValue(value.ns),
    size: numberValue(value.size),
    wordCount: numberValue(value.wordcount),
    timestamp: stringValue(value.timestamp),
  };
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class FandomMediaWikiClient {
  private readonly requestTimeoutMs: number;
  private readonly contentMaxBytes: number;
  private readonly searchCacheTtlMs: number;
  private readonly siteInfoCacheTtlMs: number;
  private readonly jsonCache: TtlCache<unknown>;
  private readonly siteInfoCache: TtlCache<FandomWikiRef>;
  private readonly queues = new Map<string, HostQueue>();
  private readonly maxConcurrentPerHost: number;

  constructor(options: FandomMediaWikiClientOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? envNumber("MARI_WIKI_REQUEST_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
    this.contentMaxBytes =
      options.contentMaxBytes ?? envNumber("MARI_WIKI_CONTENT_MAX_BYTES", DEFAULT_CONTENT_MAX_BYTES);
    const cacheTtlMs = options.cacheTtlMs ?? envNumber("MARI_WIKI_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
    this.searchCacheTtlMs = options.searchCacheTtlMs ?? DEFAULT_SEARCH_CACHE_TTL_MS;
    this.siteInfoCacheTtlMs = options.siteInfoCacheTtlMs ?? DEFAULT_SITE_INFO_CACHE_TTL_MS;
    this.jsonCache = new TtlCache<unknown>(cacheTtlMs);
    this.siteInfoCache = new TtlCache<FandomWikiRef>(this.siteInfoCacheTtlMs);
    this.maxConcurrentPerHost = options.maxConcurrentPerHost ?? DEFAULT_MAX_CONCURRENT_PER_HOST;
  }

  async findWikis(args: { query: string; lang?: string; limit?: number }): Promise<ProfessorMariWikiPayload<{ results: FandomWikiRef[]; total?: number }>> {
    return this.wrap(undefined, async () => {
      const limit = normalizeLimit(args.limit, 10, 50);
      const url = serviceUrl("/unified-search/community-search", {
        query: args.query,
        lang: args.lang || "en",
        limit,
      });
      const json = await this.getJson(url, this.searchCacheTtlMs);
      const results = Array.isArray(json.results)
        ? json.results.filter(isRecord).map(wikiRefFromCommunityResult).filter((entry): entry is FandomWikiRef => !!entry)
        : [];
      for (const wiki of results) this.cacheWiki(wiki);
      return ok(undefined, { results, total: numberValue(json.totalResultsFound) });
    });
  }

  async searchAll(args: {
    query: string;
    lang?: string;
    namespace?: number;
    limit?: number;
  }): Promise<ProfessorMariWikiPayload<{ results: WikiSearchResult[]; total?: number; queryId?: string }>> {
    return this.wrap(undefined, async () => {
      const limit = normalizeLimit(args.limit, 10, 50);
      const url = serviceUrl("/unified-search/page-search", {
        query: args.query,
        lang: args.lang || "en",
        namespace: args.namespace ?? 0,
        limit,
      });
      const json = await this.getJson(url, this.searchCacheTtlMs);
      const results = Array.isArray(json.results)
        ? json.results.filter(isRecord).map(resultFromServicePage).filter((entry): entry is WikiSearchResult => !!entry)
        : [];
      return ok(undefined, {
        results,
        total: numberValue(json.totalResultsFound),
        queryId: stringValue(json.queryId),
      });
    });
  }

  async searchWiki(args: {
    wiki: string | FandomWikiRef;
    query: string;
    limit?: number;
    continueFrom?: string;
  }): Promise<ProfessorMariWikiPayload<{ results: WikiSearchResult[]; continueFrom?: string; total?: number }>> {
    const wiki = await this.resolveWiki(args.wiki);
    return this.wrap<{ results: WikiSearchResult[]; continueFrom?: string; total?: number }>(wiki, async () => {
      const limit = normalizeLimit(args.limit, 10, 50);
      if (wiki.wikiId && /^\d+$/.test(wiki.wikiId) && !args.continueFrom) {
        try {
          const url = serviceUrl("/unified-search/page-search", {
            query: args.query,
            namespace: 0,
            limit,
            wikiId: wiki.wikiId,
          });
          const json = await this.getJson(url, this.searchCacheTtlMs);
          const serviceResults = Array.isArray(json.results)
            ? json.results
                .filter(isRecord)
                .map(resultFromServicePage)
                .filter((entry): entry is WikiSearchResult => !!entry)
            : [];
          if (serviceResults.length > 0) {
            return ok(wiki, {
              results: serviceResults,
              total: numberValue(json.totalResultsFound),
              continueFrom: undefined,
            });
          }
        } catch {
          // MediaWiki search below is the stable fallback.
        }
      }

      const json = await this.mediaWiki(wiki, {
        action: "query",
        list: "search",
        srsearch: args.query,
        srprop: "snippet|size|timestamp|wordcount",
        srlimit: limit,
        sroffset: args.continueFrom,
        format: "json",
        formatversion: 2,
      });
      const query = isRecord(json.query) ? json.query : {};
      const results = Array.isArray(query.search)
        ? query.search
            .filter(isRecord)
            .map((entry) => resultFromMediaWikiSearch(entry, wiki))
            .filter((entry): entry is WikiSearchResult => !!entry)
        : [];
      const cont = isRecord(json.continue) ? json.continue : {};
      return ok(wiki, {
        results,
        continueFrom: cont.sroffset === undefined ? undefined : String(cont.sroffset),
        total: undefined,
      });
    });
  }

  async getSiteInfo(args: {
    wiki: string | FandomWikiRef;
    includeStatistics?: boolean;
  }): Promise<ProfessorMariWikiPayload<WikiSiteInfo>> {
    const wiki = typeof args.wiki === "string" ? wikiRefFromInput(args.wiki) : args.wiki;
    return this.wrap(wiki, async () => {
      const json = await this.fetchSiteInfo(wiki, args.includeStatistics);
      return ok(json.wiki, json.data);
    });
  }

  async getPage(args: {
    wiki?: string | FandomWikiRef;
    title?: string;
    pageId?: number;
    pageUrl?: string;
    content?: WikiPageContentMode;
    metadata?: boolean;
    section?: string;
    followRedirects?: boolean;
  }): Promise<ProfessorMariWikiPayload<WikiPageData>> {
    const pageRef = args.pageUrl ? pageRefFromUrl(args.pageUrl) : null;
    const wiki = await this.resolveWiki(args.wiki ?? pageRef?.wiki);
    return this.wrap(wiki, async () => {
      const title = args.title?.trim() || pageRef?.title;
      if (!title && !args.pageId) throw new WikiClientError("invalid_input", "Provide a title, pageId, or pageUrl.");
      const content = args.content ?? "summary";
      let pageData: WikiPageData;
      let truncation: WikiTruncation | undefined;

      if (content === "source" && args.section) {
        const pageSelector =
          args.pageId !== undefined ? `--page-id ${args.pageId}` : `--title ${JSON.stringify(title ?? "")}`;
        const parsed = await this.parsePage(wiki, {
          title,
          pageId: args.pageId,
          section: args.section,
          props: "wikitext|sections|displaytitle|categories|links",
        });
        const source = stringValue(parsed.parse?.wikitext) ?? "";
        const truncated = truncateUtf8(
          source,
          this.contentMaxBytes,
          `call mari wiki get-page --wiki ${wiki.host} ${pageSelector} --content source --section ${JSON.stringify(args.section)}`,
        );
        truncation = truncated.truncation;
        pageData = this.pageDataFromParse(wiki, parsed, content, truncated.text, "source");
      } else if (content === "source") {
        const sourcePage = await this.fetchSourcePage(wiki, {
          title,
          pageId: args.pageId,
          followRedirects: args.followRedirects ?? true,
        });
        const source = sourcePage.source ?? "";
        const truncated = truncateUtf8(source, this.contentMaxBytes, "call mari wiki sections first, then fetch a specific section");
        truncation = truncated.truncation;
        pageData = {
          title: sourcePage.title,
          pageId: sourcePage.pageId,
          url: sourcePage.url,
          contentMode: content,
          source: truncated.text,
          metadata: args.metadata === false ? undefined : sourcePage.metadata,
        };
      } else if (content === "html" || content === "summary") {
        const parsed = await this.parsePage(wiki, {
          title,
          pageId: args.pageId,
          section: content === "summary" ? "0" : args.section,
          props: "text|sections|displaytitle|categories|links",
        });
        const html = stringValue(parsed.parse?.text) ?? "";
        const text = stripHtml(html);
        const truncated = truncateUtf8(text, this.contentMaxBytes, "call mari wiki sections first, then fetch a specific section");
        truncation = truncated.truncation;
        pageData = this.pageDataFromParse(wiki, parsed, content, truncated.text, content === "html" ? "htmlText" : "content");
      } else {
        const sourcePage = await this.fetchSourcePage(wiki, {
          title,
          pageId: args.pageId,
          followRedirects: args.followRedirects ?? true,
        });
        pageData = {
          title: sourcePage.title,
          pageId: sourcePage.pageId,
          url: sourcePage.url,
          contentMode: "none",
          metadata: args.metadata === false ? undefined : sourcePage.metadata,
        };
      }

      return ok(wiki, pageData, truncation);
    });
  }

  async getPages(args: {
    wiki: string | FandomWikiRef;
    titles: string[];
    content?: "summary" | "source" | "none";
    metadata?: boolean;
    followRedirects?: boolean;
  }): Promise<ProfessorMariWikiPayload<{ pages: WikiPageData[]; missing: string[] }>> {
    const wiki = await this.resolveWiki(args.wiki);
    return this.wrap(wiki, async () => {
      const titles = args.titles.map((title) => title.trim()).filter(Boolean).slice(0, 50);
      if (titles.length === 0) throw new WikiClientError("invalid_input", "Provide at least one page title.");
      const pages: WikiPageData[] = [];
      const missing: string[] = [];
      for (const title of titles) {
        const payload = await this.getPage({
          wiki,
          title,
          content: args.content ?? "summary",
          metadata: args.metadata,
          followRedirects: args.followRedirects,
        });
        if (payload.ok) pages.push(payload.data);
        else missing.push(title);
      }
      return ok(wiki, { pages, missing });
    });
  }

  async getSections(args: {
    wiki?: string | FandomWikiRef;
    title?: string;
    pageUrl?: string;
    section?: string;
    content?: "none" | "source" | "html";
  }): Promise<ProfessorMariWikiPayload<{ title: string; url: string; sections: WikiSection[]; sectionContent?: WikiPageData }>> {
    const pageRef = args.pageUrl ? pageRefFromUrl(args.pageUrl) : null;
    const wiki = await this.resolveWiki(args.wiki ?? pageRef?.wiki);
    return this.wrap(wiki, async () => {
      const title = titleFromPageArgs({ title: args.title, pageUrl: args.pageUrl });
      if (!title) throw new WikiClientError("invalid_input", "Provide a page title or pageUrl.");
      const parsed = await this.parsePage(wiki, { title, props: "sections|displaytitle" });
      const sections = normalizeSections(parsed.parse?.sections);
      let sectionContent: WikiPageData | undefined;
      if (args.section && args.content && args.content !== "none") {
        const page = await this.getPage({ wiki, title, section: args.section, content: args.content });
        if (page.ok) sectionContent = page.data;
      }
      return ok(wiki, { title, url: pageUrlForTitle(wiki, title), sections, sectionContent });
    });
  }

  async getCategoryMembers(args: {
    wiki: string | FandomWikiRef;
    category: string;
    type?: "page" | "subcat" | "file";
    namespace?: number;
    limit?: number;
    continueFrom?: string;
  }): Promise<ProfessorMariWikiPayload<{ category: string; members: WikiCategoryMember[]; continueFrom?: string }>> {
    const wiki = await this.resolveWiki(args.wiki);
    return this.wrap(wiki, async () => {
      const category = args.category.replace(/^Category:/i, "").trim();
      if (!category) throw new WikiClientError("invalid_input", "Category is required.");
      const limit = normalizeLimit(args.limit, 50, 500);
      const json = await this.mediaWiki(wiki, {
        action: "query",
        list: "categorymembers",
        cmtitle: `Category:${category}`,
        cmtype: args.type,
        cmnamespace: args.namespace,
        cmlimit: limit,
        cmcontinue: args.continueFrom,
        format: "json",
        formatversion: 2,
      });
      const query = isRecord(json.query) ? json.query : {};
      const members = Array.isArray(query.categorymembers)
        ? query.categorymembers.filter(isRecord).map((entry) => ({
            title: stringValue(entry.title) ?? "",
            pageId: numberValue(entry.pageid),
            namespace: numberValue(entry.ns),
            type: args.type,
          }))
        : [];
      const cont = isRecord(json.continue) ? json.continue : {};
      return ok(wiki, {
        category: `Category:${category}`,
        members,
        continueFrom: stringValue(cont.cmcontinue),
      });
    });
  }

  async searchInPage(args: {
    wiki?: string | FandomWikiRef;
    title?: string;
    pageUrl?: string;
    query: string;
    regex?: boolean;
    caseSensitive?: boolean;
    contextLines?: number;
  }): Promise<ProfessorMariWikiPayload<{ title: string; query: string; matches: WikiPageSearchMatch[]; matchCount: number }>> {
    const pageRef = args.pageUrl ? pageRefFromUrl(args.pageUrl) : null;
    const wiki = await this.resolveWiki(args.wiki ?? pageRef?.wiki);
    return this.wrap(wiki, async () => {
      const title = titleFromPageArgs({ title: args.title, pageUrl: args.pageUrl });
      if (!title) throw new WikiClientError("invalid_input", "Provide a page title or pageUrl.");
      if (!args.query.trim()) throw new WikiClientError("invalid_input", "Search query is required.");
      if (args.regex && args.query.length > 500) {
        throw new WikiClientError("invalid_input", "Regex queries must be 500 characters or fewer.");
      }
      const page = await this.getPage({ wiki, title, content: "source" });
      if (!page.ok) throw new WikiClientError(page.category, page.message, page);
      const source = page.data.source ?? "";
      const lines = source.split(/\r?\n/);
      const contextLines = normalizeLimit(args.contextLines, 2, 10);
      const flags = args.caseSensitive ? "" : "i";
      const matcher = args.regex
        ? new RegExp(args.query, flags)
        : new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
      const matches: WikiPageSearchMatch[] = [];
      for (const [index, line] of lines.entries()) {
        if (!matcher.test(line)) continue;
        const start = Math.max(0, index - contextLines);
        const end = Math.min(lines.length, index + contextLines + 1);
        matches.push({
          line: index + 1,
          text: line,
          before: lines.slice(start, index),
          after: lines.slice(index + 1, end),
        });
        if (matches.length >= 50) break;
      }
      return ok(wiki, { title, query: args.query, matches, matchCount: matches.length });
    });
  }

  private async resolveWiki(input: string | FandomWikiRef | undefined): Promise<FandomWikiRef> {
    if (!input) throw new WikiClientError("invalid_input", "Wiki is required unless pageUrl is supplied.");
    const base = typeof input === "string" ? wikiRefFromInput(input) : input;
    const cached = this.siteInfoCache.get(base.host);
    if (cached) return { ...base, ...cached, wikiId: base.wikiId ?? cached.wikiId };
    try {
      const siteInfo = await this.fetchSiteInfo(base, false);
      return { ...siteInfo.wiki, wikiId: base.wikiId ?? siteInfo.wiki.wikiId };
    } catch {
      return base;
    }
  }

  private cacheWiki(wiki: FandomWikiRef) {
    this.siteInfoCache.set(wiki.host, wiki, this.siteInfoCacheTtlMs);
    if (wiki.wikiId) this.siteInfoCache.set(wiki.wikiId, wiki, this.siteInfoCacheTtlMs);
  }

  private async fetchSiteInfo(
    wiki: FandomWikiRef,
    includeStatistics = false,
  ): Promise<{ wiki: FandomWikiRef; data: WikiSiteInfo }> {
    const cacheKey = `${wiki.host}:siteinfo:${includeStatistics ? "stats" : "base"}`;
    return this.jsonCache.getOrSet(
      cacheKey,
      async () => {
        const json = await this.mediaWiki(wiki, {
          action: "query",
          meta: "siteinfo",
          siprop: includeStatistics ? "general|namespaces|namespacealiases|statistics" : "general|namespaces|namespacealiases",
          format: "json",
          formatversion: 2,
        });
        const query = isRecord(json.query) ? json.query : {};
        const general = isRecord(query.general) ? query.general : {};
        const resolved = wikiRefFromHost(wiki.host, {
          ...wiki,
          wikiId: stringValue(general.wikiid) ?? wiki.wikiId,
          sitename: stringValue(general.sitename) ?? wiki.sitename,
          language: stringValue(general.lang) ?? wiki.language,
          articlePath: stringValue(general.articlepath) ?? wiki.articlePath,
          scriptPath: stringValue(general.scriptpath) ?? wiki.scriptPath,
          url: stringValue(general.server) ?? wiki.url,
        });
        this.cacheWiki(resolved);
        return {
          wiki: resolved,
          data: {
            general,
            namespaces: isRecord(query.namespaces) ? query.namespaces : undefined,
            namespaceAliases: Array.isArray(query.namespacealiases) ? query.namespacealiases : undefined,
            statistics: isRecord(query.statistics) ? query.statistics : undefined,
          },
        };
      },
      this.siteInfoCacheTtlMs,
    ) as Promise<{ wiki: FandomWikiRef; data: WikiSiteInfo }>;
  }

  private async fetchSourcePage(
    wiki: FandomWikiRef,
    args: { title?: string; pageId?: number; followRedirects: boolean },
  ): Promise<{ title: string; pageId?: number; url?: string; source?: string; metadata: Record<string, unknown> }> {
    const json = await this.mediaWiki(wiki, {
      action: "query",
      prop: "revisions|info",
      inprop: "url",
      rvprop: "ids|timestamp|contentmodel|size|content",
      rvslots: "main",
      titles: args.title,
      pageids: args.pageId,
      redirects: args.followRedirects ? 1 : undefined,
      format: "json",
      formatversion: 2,
    });
    const query = isRecord(json.query) ? json.query : {};
    const page = Array.isArray(query.pages) ? query.pages.find(isRecord) : undefined;
    if (!page || page.missing === true) {
      throw new WikiClientError("not_found", "Page not found.", { wiki, page: { title: args.title, pageId: args.pageId } });
    }
    const revision = extractRevisionContent(page);
    const title = stringValue(page.title) ?? args.title ?? String(args.pageId ?? "");
    return {
      title,
      pageId: numberValue(page.pageid),
      url: stringValue(page.fullurl) ?? pageUrlForTitle(wiki, title),
      source: revision.source,
      metadata: {
        pageId: page.pageid,
        namespace: page.ns,
        title,
        touched: page.touched,
        lastRevisionId: page.lastrevid,
        length: page.length,
        ...revision.metadata,
      },
    };
  }

  private async parsePage(
    wiki: FandomWikiRef,
    args: { title?: string; pageId?: number; section?: string; props: string },
  ): Promise<{ parse?: JsonRecord }> {
    const json = await this.mediaWiki(wiki, {
      action: "parse",
      page: args.title,
      pageid: args.pageId,
      prop: args.props,
      section: args.section,
      format: "json",
      formatversion: 2,
    });
    if (!isRecord(json.parse)) {
      throw new WikiClientError("not_found", "Page not found.", { wiki, page: { title: args.title, pageId: args.pageId } });
    }
    return { parse: json.parse };
  }

  private pageDataFromParse(
    wiki: FandomWikiRef,
    parsed: { parse?: JsonRecord },
    contentMode: WikiPageContentMode,
    contentText: string,
    contentKey: "content" | "source" | "htmlText",
  ): WikiPageData {
    const parse = parsed.parse ?? {};
    const title = stringValue(parse.title) ?? "";
    return {
      title,
      pageId: numberValue(parse.pageid),
      url: title ? pageUrlForTitle(wiki, title) : undefined,
      displayTitle: stripHtml(stringValue(parse.displaytitle) ?? ""),
      contentMode,
      [contentKey]: contentText,
      sections: normalizeSections(parse.sections),
      categories: categoryNames(parse.categories),
      links: linkNames(parse.links),
      metadata: {
        pageId: parse.pageid,
        title,
      },
    };
  }

  private async mediaWiki(wiki: FandomWikiRef, params: Record<string, string | number | boolean | undefined>) {
    const url = wikiApiUrl(wiki, params);
    return this.getJson(url);
  }

  private async getJson(url: URL, ttlMs?: number): Promise<JsonRecord> {
    const key = url.toString();
    return this.jsonCache.getOrSet(
      key,
      async () => {
        const json = await this.fetchJson(url);
        if (!isRecord(json)) throw new WikiClientError("upstream_failure", "Fandom returned a non-object JSON response.");
        if (isRecord(json.error)) {
          const code = stringValue(json.error.code);
          const info = stringValue(json.error.info) ?? "MediaWiki API error.";
          const category = code === "missingtitle" ? "not_found" : code === "permissiondenied" ? "permission_denied" : "upstream_failure";
          throw new WikiClientError(category, info);
        }
        return json;
      },
      ttlMs,
    ) as Promise<JsonRecord>;
  }

  private queueFor(host: string) {
    let queue = this.queues.get(host);
    if (!queue) {
      queue = new HostQueue(this.maxConcurrentPerHost);
      this.queues.set(host, queue);
    }
    return queue;
  }

  private async fetchJson(url: URL, redirects = 0): Promise<unknown> {
    if (redirects > 5) throw new WikiClientError("upstream_failure", "Too many Fandom API redirects.");
    return this.queueFor(url.hostname).run(async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(this.requestTimeoutMs),
          headers: {
            accept: "application/json",
            "user-agent": "Marinara-Engine Professor-Mari Fandom-MediaWiki-CLI",
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new WikiClientError("timeout", `Fandom request timed out after ${this.requestTimeoutMs} ms.`);
        }
        throw new WikiClientError("upstream_failure", err instanceof Error ? err.message : String(err));
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new WikiClientError("upstream_failure", "Fandom API redirected without a Location header.");
        const next = new URL(location, url);
        assertSafeRedirect(url, next);
        return this.fetchJson(next, redirects + 1);
      }

      if (response.status === 401 || response.status === 403) {
        throw new WikiClientError("permission_denied", "Fandom denied access to this page or wiki.");
      }
      if (response.status === 404) throw new WikiClientError("not_found", "Fandom API endpoint or page was not found.");
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new WikiClientError("rate_limited", "Fandom rate-limited the request.", {
          retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
        });
      }
      if (!response.ok) {
        throw new WikiClientError("upstream_failure", `Fandom API request failed with HTTP ${response.status}.`);
      }

      const text = await response.text();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new WikiClientError("upstream_failure", "Fandom returned non-JSON content.");
      }
    });
  }

  private async wrap<T>(
    wiki: FandomWikiRef | undefined,
    task: () => Promise<ProfessorMariWikiResult<T>>,
  ): Promise<ProfessorMariWikiPayload<T>> {
    try {
      return await task();
    } catch (err) {
      if (err instanceof WikiClientError) {
        return {
          ok: false,
          source: "fandom",
          category: err.category,
          message: err.message,
          wiki: err.extras.wiki ?? wiki,
          page: err.extras.page,
          retryAfterSeconds: err.extras.retryAfterSeconds,
        };
      }
      return {
        ok: false,
        source: "fandom",
        category: "upstream_failure",
        message: err instanceof Error ? err.message : String(err),
        wiki,
      };
    }
  }
}
