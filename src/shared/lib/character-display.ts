export interface CharacterDisplayInfo {
  name: string;
  comment?: string | null;
}

export type CharacterLookupAliasKind = "fullTitle" | "explicitAlias" | "parenthetical" | "titleLead";

export interface CharacterLookupAliasCandidate {
  text: string;
  kind: CharacterLookupAliasKind;
}

const EXPLICIT_ALIAS_CONNECTOR_PATTERN =
  /(?:^|\s+)(?:a\.?k\.?a\.?|also known as|alias(?:es)?|nickname(?:s)?)(?:\s*(?::|-)\s*|\s+)/gi;
const LIST_ALIAS_PATTERN = /\s*(?:[|/;]|\r?\n)\s*/;
const LEADING_TITLE_SEPARATOR_PATTERN = /^(.+?)\s+[-\u2013\u2014]\s+.+$/u;
const PARENTHETICAL_ALIAS_PATTERN = /[[(]([^\])]+)[\])]/g;
const LOOKUP_TEXT_MAX_LENGTH = 96;
const LOOKUP_ALIAS_EDGE_PUNCTUATION = /^[\s"']+|[\s"',.:;]+$/g;
const WRAPPED_LOOKUP_ALIAS_PATTERN = /^[([{]\s*(.+?)\s*[\])}]$/;

function cleanDisplayText(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/g, " ").replace(LOOKUP_ALIAS_EDGE_PUNCTUATION, "").trim();
  return cleaned.match(WRAPPED_LOOKUP_ALIAS_PATTERN)?.[1]?.trim() ?? cleaned;
}

function addAliasCandidate(
  candidates: CharacterLookupAliasCandidate[],
  seen: Set<string>,
  kind: CharacterLookupAliasKind,
  value: string | null | undefined,
) {
  const cleaned = cleanDisplayText(value);
  if (!cleaned || cleaned.length > LOOKUP_TEXT_MAX_LENGTH) return;

  const key = `${kind}\0${cleaned.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push({ text: cleaned, kind });
}

function addParentheticalAliases(candidates: CharacterLookupAliasCandidate[], seen: Set<string>, value: string) {
  PARENTHETICAL_ALIAS_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(PARENTHETICAL_ALIAS_PATTERN)) {
    addAliasCandidate(candidates, seen, "parenthetical", match[1]);
  }
}

function addAliasPayloadCandidates(candidates: CharacterLookupAliasCandidate[], seen: Set<string>, payload: string) {
  for (const part of payload.split(LIST_ALIAS_PATTERN)) {
    const cleaned = cleanDisplayText(part);
    if (!cleaned) continue;

    addAliasCandidate(candidates, seen, "explicitAlias", cleaned);

    const withoutParentheticals = cleanDisplayText(cleaned.replace(PARENTHETICAL_ALIAS_PATTERN, " "));
    if (withoutParentheticals !== cleaned) {
      addAliasCandidate(candidates, seen, "explicitAlias", withoutParentheticals);
    }

    addParentheticalAliases(candidates, seen, cleaned);
  }
}

function addCommentAliasCandidates(
  candidates: CharacterLookupAliasCandidate[],
  seen: Set<string>,
  comment: string | null | undefined,
) {
  const raw = typeof comment === "string" ? comment.trim() : "";
  const cleaned = cleanDisplayText(raw);
  if (!cleaned) return;

  EXPLICIT_ALIAS_CONNECTOR_PATTERN.lastIndex = 0;
  const explicitAliasConnectors = Array.from(cleaned.matchAll(EXPLICIT_ALIAS_CONNECTOR_PATTERN));
  const firstConnectorIndex = explicitAliasConnectors[0]?.index;
  const titleText =
    explicitAliasConnectors.length > 0 && typeof firstConnectorIndex === "number"
      ? cleanDisplayText(cleaned.slice(0, firstConnectorIndex))
      : cleaned;

  addAliasCandidate(candidates, seen, "fullTitle", titleText);
  addParentheticalAliases(candidates, seen, titleText);

  const leadingTitle = titleText.match(LEADING_TITLE_SEPARATOR_PATTERN)?.[1];
  addAliasCandidate(candidates, seen, "titleLead", leadingTitle);

  for (let index = 0; index < explicitAliasConnectors.length; index += 1) {
    const connector = explicitAliasConnectors[index];
    if (!connector || typeof connector.index !== "number") continue;

    const nextConnector = explicitAliasConnectors[index + 1];
    const payloadStart = connector.index + connector[0].length;
    const payloadEnd = typeof nextConnector?.index === "number" ? nextConnector.index : cleaned.length;
    addAliasPayloadCandidates(candidates, seen, cleaned.slice(payloadStart, payloadEnd));
  }

  if (explicitAliasConnectors.length === 0 && !leadingTitle) {
    const listParts = cleaned.split(LIST_ALIAS_PATTERN);
    if (listParts.length > 1) {
      for (const part of listParts) addAliasPayloadCandidates(candidates, seen, part);
    }
  }
}

export function getCharacterLookupAliasCandidates(
  character: CharacterDisplayInfo | null | undefined,
): CharacterLookupAliasCandidate[] {
  const candidates: CharacterLookupAliasCandidate[] = [];
  addCommentAliasCandidates(candidates, new Set<string>(), character?.comment);
  return candidates;
}

export function getCharacterTitle(character: CharacterDisplayInfo | null | undefined): string | null {
  const title = typeof character?.comment === "string" ? character.comment.trim() : "";
  return title || null;
}

export function parseCharacterDisplayData(raw: { data: unknown; comment?: string | null }): CharacterDisplayInfo {
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";

  try {
    const parsed = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const name = typeof record?.name === "string" && record.name.trim() ? record.name.trim() : "Unknown";
    return { name, comment };
  } catch {
    return { name: "Unknown", comment };
  }
}
