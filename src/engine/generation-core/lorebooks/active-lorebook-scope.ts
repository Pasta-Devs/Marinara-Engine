import {
  resolveGameLorebookScopeExclusions,
  type LorebookScopeExclusions,
} from "./game-lorebook-scope";

type ActiveLorebookScopeReasonType = "global" | "character" | "persona" | "chat" | "selected";
export type ActiveLorebookScopeReasonLabel = "Global" | "Character" | "Persona" | "Chat";

export interface ActiveLorebookScopeReason {
  lorebookId: string;
  lorebookName: string;
  reason: ActiveLorebookScopeReasonType;
  matchedIds: string[];
}

export interface ActiveLorebookScopeLorebook {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  isGlobal?: unknown;
  global?: unknown;
  characterId?: unknown;
  characterIds?: unknown;
  personaId?: unknown;
  personaIds?: unknown;
  chatId?: unknown;
  sourceAgentId?: unknown;
}

interface ActiveLorebookScopeChatContext {
  id?: unknown;
  mode?: unknown;
  chatMode?: unknown;
  metadata?: unknown;
  activeLorebookIds?: unknown;
  personaId?: unknown;
}

interface ActiveLorebookScopeCharacterContext {
  id: string;
}

interface ActiveLorebookScopePersonaContext {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

export interface ActiveLorebookScopeContext {
  chat: ActiveLorebookScopeChatContext | null | undefined;
  characters: ActiveLorebookScopeCharacterContext[];
  persona: ActiveLorebookScopePersonaContext | null | undefined;
  scopeExclusions?: LorebookScopeExclusions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}

function stringArray(value: unknown): string[] {
  return parseArray(value)
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function boolish(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }
  return fallback;
}

function activeLorebookScopeReasonLabel(reason: ActiveLorebookScopeReasonType): ActiveLorebookScopeReasonLabel {
  switch (reason) {
    case "global":
      return "Global";
    case "character":
      return "Character";
    case "persona":
      return "Persona";
    case "chat":
    case "selected":
      return "Chat";
  }
}

export function activeLorebookScopeReasonLabels(
  reasons: readonly ActiveLorebookScopeReason[],
): ActiveLorebookScopeReasonLabel[] {
  const labels: ActiveLorebookScopeReasonLabel[] = [];
  for (const reason of reasons) {
    const label = activeLorebookScopeReasonLabel(reason.reason);
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function resolveActiveLorebookScopeReasons(
  lorebook: ActiveLorebookScopeLorebook,
  context: ActiveLorebookScopeContext,
): ActiveLorebookScopeReason[] {
  if (!boolish(lorebook.enabled, true)) return [];
  const chat = context.chat ?? {};
  const metadata = parseRecord(chat.metadata);
  const lorebookId = readString(lorebook.id);
  const lorebookName = readString(lorebook.name, lorebookId || "Lorebook");
  const scopeExclusions =
    context.scopeExclusions ??
    resolveGameLorebookScopeExclusions(readString(chat.mode ?? chat.chatMode), metadata);

  if (scopeExclusions.excludedLorebookIds.includes(lorebookId)) return [];
  if (scopeExclusions.excludedSourceAgentIds.includes(readString(lorebook.sourceAgentId))) return [];

  const reasons: ActiveLorebookScopeReason[] = [];
  if (boolish(lorebook.isGlobal ?? lorebook.global, false)) {
    reasons.push({ lorebookId, lorebookName, reason: "global", matchedIds: [] });
  }

  const activeCharacterIds = new Set(
    context.characters.map((character) => character.id.trim()).filter(Boolean),
  );
  const lorebookCharacterIds = stringArray(lorebook.characterIds);
  const matchedCharacterIds = [
    ...lorebookCharacterIds.filter((id) => activeCharacterIds.has(id)),
    readString(lorebook.characterId),
  ].filter((id, index, ids) => id && activeCharacterIds.has(id) && ids.indexOf(id) === index);
  if (matchedCharacterIds.length > 0) {
    reasons.push({
      lorebookId,
      lorebookName,
      reason: "character",
      matchedIds: matchedCharacterIds,
    });
  }

  const activePersonaIds = [readString(chat.personaId), readString(context.persona?.id)].filter(
    (id, index, ids) => id && ids.indexOf(id) === index,
  );
  if (context.persona && activePersonaIds.length > 0) {
    const personaIds = stringArray(lorebook.personaIds);
    const lorebookPersonaId = readString(lorebook.personaId);
    const matchedPersonaIds = activePersonaIds.filter((id) => personaIds.includes(id) || lorebookPersonaId === id);
    if (matchedPersonaIds.length > 0) {
      reasons.push({ lorebookId, lorebookName, reason: "persona", matchedIds: matchedPersonaIds });
    }
  }

  const chatId = readString(chat.id);
  const chatScopedId = readString(lorebook.chatId);
  if (chatScopedId && chatScopedId === chatId) {
    reasons.push({ lorebookId, lorebookName, reason: "chat", matchedIds: [chatId] });
  }

  const selectedLorebookIds = stringArray(metadata.activeLorebookIds ?? chat.activeLorebookIds);
  if (selectedLorebookIds.includes(lorebookId)) {
    reasons.push({ lorebookId, lorebookName, reason: "selected", matchedIds: [lorebookId] });
  }

  return reasons;
}

export function resolveActiveLorebookScopeReason(
  lorebook: ActiveLorebookScopeLorebook,
  context: ActiveLorebookScopeContext,
): ActiveLorebookScopeReason | null {
  return resolveActiveLorebookScopeReasons(lorebook, context)[0] ?? null;
}

export function lorebookAppliesToContext(
  lorebook: ActiveLorebookScopeLorebook,
  context: ActiveLorebookScopeContext,
): boolean {
  return resolveActiveLorebookScopeReasons(lorebook, context).length > 0;
}
