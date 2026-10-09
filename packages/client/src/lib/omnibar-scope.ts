import { normalizeTextForMatch } from "@marinara-engine/shared";

import type { OmnibarResult } from "./omnibar-search";

/**
 * Typed prefixes that narrow the omnibar to one kind of thing: "faq: import",
 * "msg: dragon". The colon is required, so an ordinary search for the word
 * "chat" still searches everything.
 */
export type OmnibarScopeId =
  | "faq"
  | "docs"
  | "messages"
  | "chat"
  | "character"
  | "persona"
  | "lorebook"
  | "preset"
  | "connection"
  | "agent"
  | "settings";

/** First alias is the canonical prefix, so the tuple is typed non-empty. */
const SCOPE_ALIASES: Readonly<Record<OmnibarScopeId, readonly [string, ...string[]]>> = {
  faq: ["faq", "help"],
  docs: ["docs", "doc", "documentation"],
  messages: ["msg", "message", "messages", "transcript"],
  chat: ["chat", "chats"],
  character: ["char", "character", "characters"],
  persona: ["persona", "personas"],
  lorebook: ["lore", "lorebook", "lorebooks"],
  preset: ["preset", "presets"],
  connection: ["conn", "connection", "connections"],
  agent: ["agent", "agents"],
  settings: ["set", "setting", "settings"],
};

const SCOPE_BY_ALIAS = new Map<string, OmnibarScopeId>(
  Object.entries(SCOPE_ALIASES).flatMap(([scope, aliases]) =>
    aliases.map((alias) => [alias, scope as OmnibarScopeId] as const),
  ),
);

/**
 * The prefix to type for a scope. The first alias is the canonical short form,
 * which is what the category chips write into the input.
 */
export function omnibarScopePrefix(scope: OmnibarScopeId): string {
  return `${SCOPE_ALIASES[scope][0]}: `;
}

export type OmnibarScopedQuery = { scope: OmnibarScopeId | null; query: string };

/** Splits "faq: import" into its scope and the rest. Unknown prefixes stay part of the query. */
export function parseOmnibarScope(rawQuery: string): OmnibarScopedQuery {
  const match = rawQuery.match(/^\s*([a-z]+)\s*:\s*/i);
  const scope = match ? (SCOPE_BY_ALIAS.get(match[1]!.toLowerCase()) ?? null) : null;
  return scope ? { scope, query: rawQuery.slice(match![0].length) } : { scope: null, query: rawQuery };
}

export function matchesOmnibarScope(result: Pick<OmnibarResult, "id" | "category" | "group">, scope: OmnibarScopeId) {
  if (scope === "faq") return result.id.startsWith("faq:");
  if (scope === "docs") return result.category === "docs" && !result.id.startsWith("faq:");
  if (scope === "messages") return result.group === "messages";
  if (scope === "chat") return result.category === "chat" && result.group !== "messages";
  return result.category === scope;
}

/**
 * Whether handing the typed text to Professor Mari should send it. Typing only
 * the name of the row you found ("eliza" on Eliza) is a search, not a request,
 * so it opens her with the draft; anything more ("make eliza meaner") sends.
 */
export function isMariInstruction(rawQuery: string, rowTitle: string | null | undefined): boolean {
  const typed = normalizeTextForMatch(parseOmnibarScope(rawQuery).query);
  if (!typed) return false;
  return !rowTitle || !normalizeTextForMatch(rowTitle).includes(typed);
}

const QUESTION_WORD =
  /^(why|how|what|when|where|who|whom|whose|which|can|could|should|would|will|is|are|am|was|were|do|does|did|has|have|had)\b/iu;

/**
 * Whether typed text reads as a question. Ctrl/⌘+J carries only a question into Mari's composer; any other
 * text leaves her window empty, so a half-typed search never lands there as a request.
 */
export function isQuestionShaped(rawQuery: string): boolean {
  const typed = parseOmnibarScope(rawQuery).query.trim();
  return typed.endsWith("?") || QUESTION_WORD.test(typed);
}
