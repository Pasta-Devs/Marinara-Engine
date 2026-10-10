import type { ProfessorMariNavigationTarget } from "./professor-mari-navigation";
import type { OmnibarSettingsDestination } from "./omnibar-settings";
import type { MariWorkspaceTraceItem } from "@marinara-engine/shared";

// What Professor Mari looked at during a run, so her reply can show it as cards (a character's avatar
// and name, a lorebook, an agent and whether it is on, a chat, a lorebook entry, a setting) instead of
// leaving you with "Reading character" steps only.

export type MariReferencedResourceKind =
  "character" | "lorebook" | "persona" | "agent" | "chat" | "lorebookEntry" | "setting";

export interface MariReferencedResource {
  kind: MariReferencedResourceKind;
  /** An agent's type (its editor opens by type), an entry's id, a setting's destination id. */
  id: string;
  /** From the tool output when the client has no preview of the record yet. */
  name: string | null;
  /** Came from a list or search, not a direct read: show it only if her answer names it. */
  fromList: boolean;
  /** An entry's lorebook, so the card opens the lorebook at that entry. */
  parentId?: string;
  /** An agent as she read it: on, off, or its last run failed. */
  state?: "on" | "off" | "failed";
  /** One line about it from the tool output (an agent's or entry's description). */
  detail?: string;
  /** An entry's first key, so its card can say which word fires it. */
  key?: string;
}

interface MariToolCallLike {
  name: string;
  status: string;
  input?: unknown;
  output: string | null;
}

const READ_ACTION = /^(character|lorebook|persona|agent|chat)\.(get|list|search|runs|entries|getEntry)$/u;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The server always stores a string (or null) trace output on disk; a record with any other
 *  `output` is dropped here instead of trusting disk data and crashing downstream `string` ops. */
export function isWorkspaceTraceItem(value: unknown): value is MariWorkspaceTraceItem {
  const record = asRecord(value);
  if (!record || typeof record.type !== "string") return false;
  if (["text", "thinking", "status"].includes(record.type)) return typeof record.content === "string";
  if (record.type !== "tool") return false;
  const tool = asRecord(record.tool);
  return (
    !!tool &&
    typeof tool.id === "string" &&
    typeof tool.name === "string" &&
    ["running", "done", "error"].includes(String(tool.status)) &&
    (tool.output === null || tool.output === undefined || typeof tool.output === "string")
  );
}

function recordName(record: Record<string, unknown>): string | null {
  const name = record.name ?? asRecord(record.data)?.name ?? record.title;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Tool output is a report ("Command: ...", "stdout:", JSON); the JSON is the stdout part. */
function stdoutOf(output: string | null): string {
  if (!output) return "";
  const start = output.indexOf("stdout:\n");
  const body = start >= 0 ? output.slice(start + "stdout:\n".length) : output;
  const end = body.search(/\n\s*stderr:\n/u);
  return end >= 0 ? body.slice(0, end) : body;
}

function parseOutput(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    // Long results come back cut off and are no longer JSON; callers fall back to a pattern scan.
    return null;
  }
}

const ID_NAME_PAIR = /"id"\s*:\s*"([^"]+)"\s*,\s*"name"\s*:\s*"((?:[^"\\]|\\.){1,80})"/gu;

/** The first array in a list/search result: the result itself, or a field such as `items`. */
function listRecords(parsed: unknown): Record<string, unknown>[] {
  const list = Array.isArray(parsed) ? parsed : Object.values(asRecord(parsed) ?? {}).find(Array.isArray);
  return (list ?? []).map(asRecord).filter((record): record is Record<string, unknown> => record !== null);
}

function recordDetail(record: Record<string, unknown>): string | undefined {
  const text = record.description;
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

/** `enabled` is a boolean in merged agent rows and "true"/"false" in raw config rows. */
function agentState(record: Record<string, unknown>): MariReferencedResource["state"] {
  if (record.enabled === undefined) return undefined;
  return record.enabled === true || record.enabled === "true" ? "on" : "off";
}

/** Slice 72: how many records a list step returned ("3 entries"); null when the output is not a JSON list. */
export function countMariListOutput(output: string | null): number | null {
  const parsed = parseOutput(stdoutOf(output));
  if (parsed === null) return null;
  return Array.isArray(parsed) || Object.values(asRecord(parsed) ?? {}).some(Array.isArray)
    ? listRecords(parsed).length
    : null;
}

/** Slice 72: a read that found nothing (its stdout is `null`, or it says so). */
export function isMariNotFoundOutput(output: string | null): boolean {
  const stdout = stdoutOf(output).trim();
  return stdout === "null" || /not found|no such|does not exist/iu.test(output ?? "");
}

export function collectMariReferencedResources(tools: readonly MariToolCallLike[]): MariReferencedResource[] {
  const seen = new Map<string, MariReferencedResource>();
  const add = (
    kind: MariReferencedResourceKind,
    id: unknown,
    name: string | null,
    fromList: boolean,
    extra: Pick<MariReferencedResource, "parentId" | "state" | "detail" | "key"> = {},
  ) => {
    if (typeof id !== "string" || !id.trim()) return;
    const key = `${kind}:${id}`;
    const existing = seen.get(key);
    seen.set(key, {
      kind,
      id,
      // A direct read's name beats a list's.
      name: (fromList ? (existing?.name ?? name) : (name ?? existing?.name)) ?? null,
      fromList: fromList && (existing?.fromList ?? true),
      parentId: extra.parentId ?? existing?.parentId,
      detail: extra.detail ?? existing?.detail,
      key: extra.key ?? existing?.key,
      // A failed run is the news about an agent, whatever an earlier read said about it.
      state: existing?.state === "failed" ? "failed" : (extra.state ?? existing?.state),
    });
  };
  for (const tool of tools) {
    if (tool.status !== "done" || !/app[ _-]?data/iu.test(tool.name)) continue;
    const input = asRecord(tool.input);
    const match = typeof input?.action === "string" ? READ_ACTION.exec(input.action) : null;
    if (!match) continue;
    const resource = match[1]!;
    const verb = match[2]!;
    const stdout = stdoutOf(tool.output);
    const parsed = parseOutput(stdout);
    if (resource === "agent") {
      // Built-in agents open by type, and so do custom ones (the editor matches either).
      if (verb === "runs") {
        const runs = listRecords(parsed);
        add("agent", input?.type ?? input?.agentType, null, false, {
          state: runs[0]?.success === false ? "failed" : undefined,
        });
      } else if (verb === "get") {
        const record = asRecord(parsed);
        add("agent", record?.type ?? input?.type ?? input?.agentType, record ? recordName(record) : null, false, {
          state: record ? agentState(record) : undefined,
          detail: record ? recordDetail(record) : undefined,
        });
      } else {
        for (const record of listRecords(parsed)) {
          add("agent", record.type, recordName(record), true, {
            state: agentState(record),
            detail: recordDetail(record),
          });
        }
      }
      continue;
    }
    if (resource === "lorebook" && (verb === "entries" || verb === "getEntry")) {
      // Slice 72: reading a lorebook's entries is reading that lorebook (its face, a link to it in her answer).
      if (verb === "entries") add("lorebook", input?.lorebookId ?? input?.id, null, false);
      const records = verb === "entries" ? listRecords(parsed) : [asRecord(parsed)].filter((r) => r !== null);
      for (const record of records) {
        const parentId = record.lorebookId ?? input?.lorebookId ?? input?.id;
        const keys = record.keys ?? record.primaryKeys;
        add("lorebookEntry", record.id ?? input?.entryId, recordName(record), verb === "entries", {
          parentId: typeof parentId === "string" ? parentId : undefined,
          detail: recordDetail(record),
          key: Array.isArray(keys) && typeof keys[0] === "string" && keys[0].trim() ? keys[0].trim() : undefined,
        });
      }
      continue;
    }
    if (verb === "runs" || verb === "entries" || verb === "getEntry") continue;
    const kind = resource as MariReferencedResourceKind;
    if (verb === "get") {
      const record = asRecord(parsed);
      const outputName =
        (record && recordName(record)) ?? stdout.match(/"(?:name|title)"\s*:\s*"((?:[^"\\]|\\.){1,80})"/u)?.[1];
      add(kind, input?.id ?? input?.[`${kind}Id`] ?? record?.id, outputName ?? null, false);
      continue;
    }
    const records = listRecords(parsed);
    if (records.length > 0) {
      for (const record of records) add(kind, record.id, recordName(record), true);
    } else {
      for (const [, id, name] of stdout.matchAll(ID_NAME_PAIR)) add(kind, id, name.replace(/\\(.)/gu, "$1"), true);
    }
  }
  return [...seen.values()];
}

/**
 * Settings she names in bold, by their exact label ("turn on **Hide chat Help button**"), as cards that
 * open that setting. Only bold names count, so a passing word such as "language" never becomes a card.
 */
export function findMariSettingReferences(
  replyText: string,
  settings: readonly { id: string; title: string }[],
): MariReferencedResource[] {
  const byLabel = new Map(settings.map((setting) => [setting.title.toLocaleLowerCase(), setting]));
  const found = new Map<string, MariReferencedResource>();
  for (const [, bold] of replyText.matchAll(/\*\*(.+?)\*\*/gu)) {
    const setting = byLabel.get(bold!.trim().toLocaleLowerCase());
    if (setting && !found.has(setting.id)) {
      found.set(setting.id, { kind: "setting", id: setting.id, name: setting.title, fromList: true });
    }
  }
  return [...found.values()];
}

/** Slice 72: a name shorter than this never links on its own (it is likely an ordinary word). */
const MIN_LINK_TERM = 4;

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Slice 72: which names in her answer become links that open the record (no cards under the answer). A name
 * links when it is in bold; a record she read directly (not from a list or search) also links by its whole
 * name, or a character's or persona's first name ("Gandalf" for "Gandalf the Confused"), as whole words.
 * Never a substring: "the swamp" in her words is not the entry "The swamp" she only listed.
 */
export function selectMariReplyLinks(
  resources: readonly MariReferencedResource[],
  replyText: string,
): { resource: MariReferencedResource; term: string }[] {
  const bold = new Set([...replyText.matchAll(/\*\*(.+?)\*\*/gu)].map((match) => match[1]!.trim().toLocaleLowerCase()));
  const says = (term: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "iu").test(replyText);
  const seen = new Set<string>();
  const links: { resource: MariReferencedResource; term: string }[] = [];
  for (const resource of resources) {
    const name = resource.name?.trim();
    const key = `${resource.kind}:${resource.id}`;
    if (!name || seen.has(key)) continue;
    const first = name.split(/\s+/u)[0]!;
    const term = bold.has(name.toLocaleLowerCase())
      ? name
      : resource.fromList
        ? null
        : name.length >= MIN_LINK_TERM && says(name)
          ? name
          : (resource.kind === "character" || resource.kind === "persona") &&
              first !== name &&
              first.length >= MIN_LINK_TERM &&
              says(first)
            ? first
            : null;
    if (!term) continue;
    seen.add(key);
    links.push({ resource, term });
  }
  return links;
}

/** Where a card goes when you open it; null when it cannot go anywhere (an entry without its lorebook). */
export function mariReferenceTarget(
  resource: MariReferencedResource,
  settings: readonly OmnibarSettingsDestination[],
): ProfessorMariNavigationTarget | null {
  switch (resource.kind) {
    case "chat":
      return { kind: "chat", chatId: resource.id };
    case "lorebookEntry":
      return resource.parentId
        ? { kind: "resource", resource: "lorebook", id: resource.parentId, entryId: resource.id }
        : null;
    case "setting": {
      const setting = settings.find((candidate) => candidate.id === resource.id);
      return setting
        ? { kind: "settings", tab: setting.tab, controlId: setting.controlId, sectionId: setting.sectionId }
        : null;
    }
    default:
      return { kind: "resource", resource: resource.kind, id: resource.id };
  }
}

/** The first sentence of a description, for a one-line fact (CSS truncates the rest). */
export function firstSentence(text: string | null | undefined): string | undefined {
  const line = text
    ?.split("\n")
    .find((part) => part.trim())
    ?.trim();
  if (!line) return undefined;
  const end = line.search(/[.!?](\s|$)/u);
  return end >= 0 ? line.slice(0, end + 1) : line;
}

type FactTranslate = (key: string, options?: Record<string, unknown>) => string;

/**
 * R10: a reference row's one fact. The slot already says what the thing is, so the fact says something
 * about THIS thing (a state, a count, where it lives) and never the type ("Chat", "Agent") or a tag.
 * Undefined when nothing useful is known: the row then shows its name only.
 */
export function mariReferenceFact(
  kind: MariReferencedResourceKind,
  facts: {
    description?: string;
    /** An agent: on, off, or its last run failed; null when unknown. */
    agentState?: "on" | "off" | "failed" | null;
    entryCount?: number;
    lorebookName?: string;
    entryKey?: string;
    /** A chat: who is in it, and when it last moved (already relative: "4 min ago"). */
    people?: string;
    time?: string | null;
    section?: string;
    value?: string;
  },
  t: FactTranslate,
): string | undefined {
  const join = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ") || undefined;
  switch (kind) {
    case "character":
    case "persona":
      return firstSentence(facts.description);
    case "lorebook":
      return typeof facts.entryCount === "number"
        ? t("ui.chat.homeprofessormarichat.refFact.entries", { count: facts.entryCount })
        : firstSentence(facts.description);
    case "lorebookEntry":
      return facts.entryKey
        ? join(facts.lorebookName, t("ui.chat.homeprofessormarichat.refFact.key", { key: facts.entryKey }))
        : facts.lorebookName;
    case "chat":
      return join(facts.people, facts.time);
    case "agent":
      return facts.agentState === "failed"
        ? t("ui.chat.homeprofessormarichat.referenceAgentFailed")
        : join(
            facts.agentState
              ? t(
                  facts.agentState === "on"
                    ? "ui.chat.homeprofessormarichat.refFact.on"
                    : "ui.chat.homeprofessormarichat.refFact.off",
                )
              : null,
            firstSentence(facts.description),
          );
    case "setting":
      return join(facts.section, facts.value);
  }
}
