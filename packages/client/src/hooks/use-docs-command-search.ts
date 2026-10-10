import { useEffect, useMemo, useState } from "react";
import {
  DOCS_COMMAND_SEARCH_MIN_QUERY_LENGTH,
  extractDocsSearchQuery,
  searchDocsCommandTitles,
  toDocsCommandPassages,
  type DocsCommandSearchPassage,
} from "../lib/docs-command-search";
import { useDocsIndex, useDocsSearch } from "./use-docs";

export type DocsCommandSearchStage = "idle" | "titles" | "passages";

export interface DocsCommandSearchProvider {
  results: DocsCommandSearchPassage[];
  stage: DocsCommandSearchStage;
  isSearching: boolean;
  isError: boolean;
}

export function useDocsCommandSearchProvider(
  query: string,
  options: { enabled?: boolean; delay?: number } = {},
): DocsCommandSearchProvider {
  const { enabled = true, delay = 250 } = options;
  const trimmed = query.trim().slice(0, 200);
  const eligible = enabled && trimmed.length >= DOCS_COMMAND_SEARCH_MIN_QUERY_LENGTH;
  const [delayedQuery, setDelayedQuery] = useState("");

  useEffect(() => {
    if (!eligible) {
      setDelayedQuery("");
      return;
    }
    const timer = window.setTimeout(() => setDelayedQuery(trimmed), delay);
    return () => window.clearTimeout(timer);
  }, [delay, eligible, trimmed]);

  const stagedQuery = eligible && delayedQuery === trimmed ? delayedQuery : "";
  // A question is searched on its content words, not its literal phrase
  // (O4 task 9); title matching stays on the raw text since substring
  // matching there already tolerates the extra words.
  const docsSearchQuery = stagedQuery ? extractDocsSearchQuery(stagedQuery) : "";
  const index = useDocsIndex(eligible);
  const search = useDocsSearch(docsSearchQuery);
  const searchData = search.data;
  const passages = useMemo(
    () => (searchData?.query === docsSearchQuery ? toDocsCommandPassages(searchData) : []),
    [searchData, docsSearchQuery],
  );
  const titles = useMemo(
    () => (eligible ? searchDocsCommandTitles(trimmed, index.data) : []),
    [eligible, index.data, trimmed],
  );
  const hasPassageStage =
    docsSearchQuery.length >= DOCS_COMMAND_SEARCH_MIN_QUERY_LENGTH && !search.isFetching && !search.isError;

  // Memoized so the result array keeps a stable identity between renders: the
  // omnibar's search pipeline is keyed on it and would otherwise rerun on every
  // keystroke-unrelated render.
  return useMemo(() => {
    if (!eligible) return { results: [], stage: "idle" as const, isSearching: false, isError: false };
    if (hasPassageStage) {
      return { results: passages, stage: "passages" as const, isSearching: false, isError: false };
    }
    return {
      results: titles,
      stage: "titles" as const,
      isSearching: index.isLoading || stagedQuery === "" || search.isFetching,
      isError: index.isError || search.isError,
    };
  }, [
    eligible,
    hasPassageStage,
    index.isError,
    index.isLoading,
    passages,
    search.isError,
    search.isFetching,
    stagedQuery,
    titles,
  ]);
}
