// ──────────────────────────────────────────────
// React Query: In-app documentation (docs/*.md)
// ──────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { useDocsLanguage } from "./use-docs-language";

export interface DocSummary {
  /** Path relative to the docs folder, forward slashes (e.g. "installation/windows.md") */
  path: string;
  title: string;
  /** Subfolder relative to docs ("" for root-level guides) */
  dir: string;
  /** File modification time (ISO). Reflects install/update time on fresh clones. */
  updatedAt: string;
  /** Language actually served for this doc ("en" when a translation is missing) */
  language: string;
}

export interface DocsIndex {
  /** Absolute on-disk path of the docs folder */
  root: string;
  /** Language the index was resolved for */
  language: string;
  docs: DocSummary[];
}

export interface DocContent {
  path: string;
  language: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface DocSearchSnippet {
  line: number;
  text: string;
}

export interface DocSearchResult extends DocSummary {
  matches: number;
  snippets: DocSearchSnippet[];
}

export interface DocsSearchResponse {
  query: string;
  language: string;
  results: DocSearchResult[];
}

export const docsKeys = {
  all: ["docs"] as const,
  index: (lang: string) => [...docsKeys.all, "index", lang] as const,
  content: (lang: string, path: string) => [...docsKeys.all, "content", lang, path] as const,
  search: (lang: string, query: string) => [...docsKeys.all, "search", lang, query] as const,
};

/**
 * Active docs language for query keys and request URLs. "en" until the status
 * loads; if the status request fails, docs queries proceed in English rather
 * than never loading (`ready` only gates the initial resolution).
 */
function useActiveDocsLang(enabled: boolean): { lang: string; ready: boolean } {
  const status = useDocsLanguage(enabled);
  return { lang: status.data?.active ?? "en", ready: status.isSuccess || status.isError };
}

/** The docs shipped with the app only change on update or language switch, so cache per language. */
export function useDocsIndex(enabled = true) {
  const { lang, ready } = useActiveDocsLang(enabled);
  return useQuery({
    queryKey: docsKeys.index(lang),
    queryFn: () => api.get<DocsIndex>(`/docs?lang=${encodeURIComponent(lang)}`),
    enabled: enabled && ready,
    staleTime: Infinity,
  });
}

export function useDocContent(path: string | null) {
  const { lang, ready } = useActiveDocsLang(!!path);
  return useQuery({
    queryKey: docsKeys.content(lang, path ?? ""),
    queryFn: () =>
      api.get<DocContent>(`/docs/content?path=${encodeURIComponent(path ?? "")}&lang=${encodeURIComponent(lang)}`),
    enabled: !!path && ready,
    staleTime: Infinity,
  });
}

/** Full-text search across the shipped docs. Pass a debounced query of 2+ characters. */
export function useDocsSearch(query: string) {
  const trimmed = query.trim();
  const { lang, ready } = useActiveDocsLang(trimmed.length >= 2);
  return useQuery({
    queryKey: docsKeys.search(lang, trimmed),
    queryFn: () =>
      api.get<DocsSearchResponse>(`/docs/search?q=${encodeURIComponent(trimmed)}&lang=${encodeURIComponent(lang)}`),
    enabled: trimmed.length >= 2 && ready,
    staleTime: Infinity,
    // Carry the previous results across TERM changes only — queryKey[2] is the
    // language dimension, and results from another language must never bleed
    // into a freshly switched one.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === lang ? previous : undefined),
  });
}
