import type { DocsIndex, DocsSearchResponse } from "../hooks/use-docs";
import type { CommandResult } from "./command-center";

export const DOCS_COMMAND_SEARCH_MIN_QUERY_LENGTH = 2;
/**
 * Docs are a fallback, not the main event. Cap how many surface so a common word
 * doesn't bury real resources under a wall of near-identical documentation rows.
 */
export const DOCS_COMMAND_SEARCH_MAX_RESULTS = 6;

export interface DocsCommandSearchPassage extends CommandResult {
  id: string;
  title: string;
  source: string;
  snippet: string;
  path: string;
  line: number | null;
}

export function searchDocsCommandTitles(query: string, index: DocsIndex | undefined): DocsCommandSearchPassage[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < DOCS_COMMAND_SEARCH_MIN_QUERY_LENGTH) return [];

  return (index?.docs ?? [])
    .filter((doc) => doc.title.toLocaleLowerCase().includes(normalized))
    .slice(0, DOCS_COMMAND_SEARCH_MAX_RESULTS)
    .map((doc) => ({
      id: `docs:${doc.path}:title`,
      title: doc.title,
      source: doc.path,
      snippet: doc.title,
      path: doc.path,
      line: null,
      command: {
        id: `docs:${doc.path}:title`,
        title: doc.title,
        kind: "resource" as const,
        icon: "documentation" as const,
      },
      score: 200,
    }));
}

/** Question words and grammatical filler, stripped so a natural-language
 * question searches docs on its real content words. */
const DOCS_QUESTION_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "am",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "shall",
  "may",
  "might",
  "how",
  "what",
  "where",
  "which",
  "when",
  "who",
  "whom",
  "whose",
  "why",
  "to",
  "for",
  "of",
  "in",
  "on",
  "at",
  "by",
  "with",
  "about",
  "into",
  "from",
  "up",
  "down",
  "and",
  "or",
  "but",
  "if",
  "as",
  "so",
  "than",
  "that",
  "this",
  "these",
  "those",
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "it",
  "my",
  "your",
  "our",
  "their",
  "me",
  "us",
]);

/**
 * Strips question words and grammatical filler so a natural-language question
 * ("how do lorebooks work?") searches docs on its real content words
 * ("lorebooks work") instead of the literal phrase, which full-text search
 * rarely matches verbatim — a fresh install with no model otherwise gets no
 * docs rows at all for a question (O4 task 9). Falls back to the original
 * query when stripping would leave nothing to search.
 */
export function extractDocsSearchQuery(query: string): string {
  const words = query
    .toLocaleLowerCase()
    .replace(/[?!.,;:]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !DOCS_QUESTION_STOPWORDS.has(word));
  return words.length > 0 ? words.join(" ") : query.trim();
}

export function toDocsCommandPassages(search: DocsSearchResponse | undefined): DocsCommandSearchPassage[] {
  // One row per doc — the best snippet — not one per matching line. A single doc
  // with many hits used to explode into dozens of identical-titled rows.
  return (search?.results ?? [])
    .slice()
    .sort((a, b) => b.matches - a.matches)
    .slice(0, DOCS_COMMAND_SEARCH_MAX_RESULTS)
    .map((result) => {
      const snippet = result.snippets[0] ?? { line: null, text: result.title };
      return {
        id: `docs:${result.path}`,
        title: result.title,
        source: result.path,
        snippet: snippet.text,
        path: result.path,
        line: snippet.line,
        command: {
          id: `docs:${result.path}`,
          title: result.title,
          kind: "resource" as const,
          icon: "documentation" as const,
        },
        score: 100 + result.matches,
      };
    });
}
