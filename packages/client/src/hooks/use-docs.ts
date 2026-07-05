// ──────────────────────────────────────────────
// React Query: In-app documentation (docs/*.md)
// ──────────────────────────────────────────────
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";

export interface DocSummary {
  /** Path relative to the docs folder, forward slashes (e.g. "installation/windows.md") */
  path: string;
  title: string;
  /** Subfolder relative to docs ("" for root-level guides) */
  dir: string;
  /** File modification time (ISO). Reflects install/update time on fresh clones. */
  updatedAt: string;
}

export interface DocsIndex {
  /** Absolute on-disk path of the docs folder */
  root: string;
  docs: DocSummary[];
}

export interface DocContent {
  path: string;
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
  results: DocSearchResult[];
}

export const docsKeys = {
  all: ["docs"] as const,
  index: () => [...docsKeys.all, "index"] as const,
  content: (path: string) => [...docsKeys.all, "content", path] as const,
  search: (query: string) => [...docsKeys.all, "search", query] as const,
};

/** The docs shipped with the app only change on update, so cache for the session. */
export function useDocsIndex(enabled = true) {
  return useQuery({
    queryKey: docsKeys.index(),
    queryFn: () => api.get<DocsIndex>("/docs"),
    enabled,
    staleTime: Infinity,
  });
}

export function useDocContent(path: string | null) {
  return useQuery({
    queryKey: docsKeys.content(path ?? ""),
    queryFn: () => api.get<DocContent>(`/docs/content?path=${encodeURIComponent(path ?? "")}`),
    enabled: !!path,
    staleTime: Infinity,
  });
}

/** Full-text search across the shipped docs. Pass a debounced query of 2+ characters. */
export function useDocsSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: docsKeys.search(trimmed),
    queryFn: () => api.get<DocsSearchResponse>(`/docs/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    staleTime: Infinity,
    placeholderData: (previous) => previous,
  });
}
