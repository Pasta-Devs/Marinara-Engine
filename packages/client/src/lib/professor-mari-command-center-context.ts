import type {
  ProfessorMariAskContext,
  ProfessorMariCapability,
  ProfessorMariContextResource,
  ProfessorMariQuickSource,
} from "@marinara-engine/shared";
import type { OmnibarCategory, OmnibarResult } from "./omnibar-search";

const RESOURCE_KIND_BY_CATEGORY: Partial<Record<OmnibarCategory, ProfessorMariContextResource["kind"]>> = {
  chat: "chat",
  character: "character",
  persona: "persona",
  lorebook: "lorebook",
  preset: "preset",
  connection: "connection",
  agent: "agent",
  settings: "setting",
};

const RECOMMEND_QUERY = /\b(?:compare|recommend|which|best|suggest)\b/i;
const REPAIR_QUERY = /\b(?:broken|error|fail(?:ed|ing|ure)?|fix|repair|troubleshoot|why (?:does|is|did|won't))\b/i;
const EDIT_QUERY = /\b(?:change|edit|improve|make|rewrite|shorten|update)\b/i;
const CREATE_QUERY = /\b(?:create|make a new|new)\b/i;

export function inferProfessorMariCommandCenterCapability(query: string): ProfessorMariCapability {
  if (REPAIR_QUERY.test(query)) return "repair";
  if (RECOMMEND_QUERY.test(query)) return "recommend";
  if (CREATE_QUERY.test(query)) return "create";
  if (EDIT_QUERY.test(query)) return "edit";
  return "explain";
}

function resourceIdFromResult(result: Pick<OmnibarResult, "id" | "category">) {
  const kind = RESOURCE_KIND_BY_CATEGORY[result.category];
  if (!kind) return null;
  // L4: a lorebook-entry row's id is `lorebook-entry:<lorebookId>:<entryId>` - splitting on
  // the first colon alone would hand Mari the two ids glued together, and the existing
  // lorebook-attachment UI resolves `resource.id` as a lorebookId (it shows "no longer
  // available" otherwise). The entry's own name already travels as `resource.label`.
  if (result.id.startsWith("lorebook-entry:")) return result.id.split(":")[1] ?? null;
  // A chat tool row (`chat-tool:<tool>:<chatId>`, e.g. the R2 "Fix: Check the last reply" row) is about
  // its chat; sending `<tool>:<chatId>` made the server answer "the selected chat is no longer available".
  if (result.id.startsWith("context:") || result.id.startsWith("chat-tool:")) {
    const parts = result.id.split(":");
    return parts.at(-1) ?? null;
  }
  if (result.category === "settings") {
    const parts = result.id.split(":");
    return parts.at(-1) ?? null;
  }
  const separator = result.id.indexOf(":");
  return separator >= 0 ? result.id.slice(separator + 1) : result.id;
}

export function buildProfessorMariCommandCenterContext(
  query: string,
  selectedResult: Pick<OmnibarResult, "id" | "title" | "category"> | null | undefined,
  relatedResults: readonly Pick<OmnibarResult, "id" | "title" | "category">[] = [],
  commandCenterResultId = selectedResult?.id,
  options: {
    activeChat?: { id: string; label?: string; mode?: string };
    settingsLocation?: { tab?: string; controlId?: string };
    field?: string;
    fieldId?: string;
    error?: { message: string; code?: string };
    asideAnswer?: { query: string; answer: string; tier: "local" | "remote"; sources?: ProfessorMariQuickSource[] };
    /** R22/K1: a failed-reply "fix this" row hands off through the chat-error door, not command-center. */
    /** L8: opened over the game setup wizard, the handoff comes from game-setup (the step rides in `field`). */
    source?: "command-center" | "chat-error" | "game-setup";
  } = {},
): ProfessorMariAskContext {
  const trimmedQuery = query.trim();
  const resourceKind = selectedResult ? RESOURCE_KIND_BY_CATEGORY[selectedResult.category] : undefined;
  const resourceId = selectedResult ? resourceIdFromResult(selectedResult) : null;
  const relatedResources = relatedResults.flatMap((result) => {
    const kind = RESOURCE_KIND_BY_CATEGORY[result.category];
    const id = resourceIdFromResult(result);
    return kind && id && kind !== "setting" && kind !== "chat" && kind !== "game"
      ? [{ kind, id, label: result.title }]
      : [];
  });

  return {
    source: options.source ?? "command-center",
    capability: inferProfessorMariCommandCenterCapability(trimmedQuery),
    query: trimmedQuery || undefined,
    resource:
      selectedResult && resourceKind && resourceId
        ? { kind: resourceKind, id: resourceId, label: selectedResult.title }
        : undefined,
    ...(relatedResources.length > 0 ? { relatedResources: relatedResources.slice(0, 4) } : {}),
    action: selectedResult ? `Selected Command Center result: ${selectedResult.title}` : undefined,
    ...(commandCenterResultId ? { commandCenterResultId } : {}),
    ...(options.activeChat ? { activeChat: options.activeChat } : {}),
    ...(options.settingsLocation ? { settingsLocation: options.settingsLocation } : {}),
    ...(options.field ? { field: options.field } : {}),
    ...(options.fieldId ? { fieldId: options.fieldId } : {}),
    ...(options.error ? { error: options.error } : {}),
    ...(options.asideAnswer ? { asideAnswer: options.asideAnswer } : {}),
  };
}
