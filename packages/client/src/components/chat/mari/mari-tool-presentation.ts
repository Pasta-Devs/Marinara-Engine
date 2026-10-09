// How one of Mari's tool calls reads in her timeline: its title, detail and tone, from the raw call.
import {
  mergeMariActionResults,
  type MariWorkspaceActionResult,
  type MariWorkspaceTraceItem,
  type Message,
} from "@marinara-engine/shared";

import { isWorkspaceTraceItem } from "../../../lib/mari-referenced-resources";
import { toMessageExtra } from "./mari-chat-helpers";

export type WorkspaceToolCall = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  input?: unknown;
  detail: string | null;
  output: string | null;
  /** First time we saw this call. Preserved across upserts so a RUNNING step can tick live. */
  startedAt: number;
  /** Server-measured wall time of a finished call. Authoritative - it survives a reload. */
  durationMs?: number;
  updatedAt: number;
};

type ToolTone = "db" | "shell" | "file" | "search" | "write" | "theme" | "image" | "wiki" | "skill" | "generic";

type ToolPresentation = {
  eyebrow: string;
  title: string;
  detail: string | null;
  tone: ToolTone;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function previewValue(value: unknown, limit = 180): string | null {
  if (value == null) return null;
  let text: string;
  if (typeof value === "string") text = value;
  else {
    const record = asRecord(value);
    if (record) {
      const primary = record.command ?? record.path ?? record.pattern ?? record.query ?? record.url ?? record.reason;
      if (typeof primary === "string") text = primary;
      else {
        try {
          text = JSON.stringify(record);
        } catch {
          text = String(value);
        }
      }
    } else text = String(value);
  }

  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

export function outputValue(value: unknown, limit = 8000): string | null {
  if (value == null) return null;
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  const trimmed = text.trimEnd();
  if (!trimmed) return null;
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

export function getToolCallId(data: Record<string, unknown> | null, name: string) {
  const id = data?.id;
  return typeof id === "string" && id.trim() ? id : `${name}-${Date.now()}`;
}

export function formatToolName(name: string) {
  return name
    .replace(/^functions\./, "")
    .replace(/^multi_tool_use\./, "")
    .replace(/_/g, " ");
}

export function getMessageWorkspaceTrace(message: Message): MariWorkspaceTraceItem[] | null {
  const extra = toMessageExtra(message);
  const trace = extra?.mariWorkspaceTimeline;
  if (!Array.isArray(trace)) return null;
  const items = trace.filter(isWorkspaceTraceItem);
  return items.length > 0 ? items : null;
}

/** R14: why this turn failed (`mariRunError`); null when it did not, or once you dismissed it. */
/** The run's start or end on the server clock (ms), saved on the request and reply messages; null for older messages. */
export function getMessageRunTime(message: Message, key: "mariRunStartedAt" | "mariRunFinishedAt"): number | null {
  const value = asRecord(toMessageExtra(message))?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getMessageRunError(
  message: Message,
  { includeDismissed = false }: { includeDismissed?: boolean } = {},
): { message: string; dismissed: boolean } | null {
  const value = asRecord(toMessageExtra(message)?.mariRunError);
  if (typeof value?.message !== "string") return null;
  const dismissed = value.dismissed === true;
  return dismissed && !includeDismissed ? null : { message: value.message, dismissed };
}

export function isMariWorkspaceActionResult(value: unknown): value is MariWorkspaceActionResult {
  const result = asRecord(value);
  const resource = asRecord(result?.resource);
  return (
    // A failed change ("Not saved") is kept too, so its card survives a reload.
    (result?.status === "created" ||
      result?.status === "updated" ||
      (result?.status === "failed" && typeof result.error === "string")) &&
    typeof result.summary === "string" &&
    !!resource &&
    ["character", "persona", "lorebook", "preset"].includes(String(resource.kind)) &&
    typeof resource.id === "string" &&
    resource.id.length > 0 &&
    Array.isArray(result.changedFields) &&
    result.changedFields.every((field) => typeof field === "string")
  );
}

/** Slice 74: a receipt excerpt the card can draw; anything else is dropped, never rendered half. */
function isMariChangeExcerpt(value: unknown): boolean {
  const change = asRecord(value);
  if (typeof change?.field !== "string") return false;
  if (change.kind === "text" || change.kind === "value") {
    return typeof change.before === "string" && typeof change.after === "string";
  }
  const count = asRecord(change.count);
  return (
    change.kind === "list" &&
    ["added", "edited", "removed"].every((part) => Array.isArray(change[part]) && typeof count?.[part] === "number")
  );
}

/** One record per thing the run changed (older messages kept one per command). */
export function getMessageWorkspaceActionResults(message: Message): MariWorkspaceActionResult[] {
  const extra = toMessageExtra(message);
  const results = extra?.mariWorkspaceActionResults;
  if (!Array.isArray(results)) return [];
  return mergeMariActionResults(
    results
      .filter(isMariWorkspaceActionResult)
      .map((result) =>
        Array.isArray(result.changes)
          ? { ...result, changes: result.changes.filter(isMariChangeExcerpt) }
          : { ...result, changes: undefined },
      ),
  );
}

export type WorkspaceTimelineItem =
  | { id: string; type: "text"; content: string; narration?: boolean }
  | { id: string; type: "thinking"; content: string; startedAt?: number; updatedAt?: number }
  | { id: string; type: "tool"; tool: WorkspaceToolCall }
  | { id: string; type: "status"; content: string };

function timelineId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function timelineItemsFromTrace(trace: MariWorkspaceTraceItem[], message: Message): WorkspaceTimelineItem[] {
  const items = trace.map((item, index): WorkspaceTimelineItem => {
    if (item.type === "tool") {
      return {
        id: `${message.id}-tool-${item.tool.id || index}`,
        type: "tool",
        tool: {
          id: item.tool.id || `${message.id}-${index}`,
          name: item.tool.name || "tool",
          status: item.tool.status === "running" ? "done" : item.tool.status,
          input: item.tool.input,
          detail: previewValue(item.tool.input),
          output: item.tool.output ?? null,
          // A replayed step never ticks, so it has no local anchor. Its duration comes from the
          // server-stamped pair; a trace written before those existed stays "—" rather than
          // showing a fabricated 1s.
          startedAt: 0,
          durationMs:
            item.tool.startedAt && item.tool.updatedAt
              ? Math.max(0, item.tool.updatedAt - item.tool.startedAt)
              : undefined,
          updatedAt: item.tool.updatedAt ?? 0,
        },
      };
    }
    if (item.type === "thinking") {
      return {
        id: `${message.id}-thinking-${index}`,
        type: "thinking",
        content: item.content,
        startedAt: item.startedAt,
        updatedAt: item.updatedAt,
      };
    }
    return { id: `${message.id}-${item.type}-${index}`, type: item.type, content: item.content };
  });

  if (!items.some((item) => item.type === "text") && message.content.trim()) {
    items.push({ id: `${message.id}-text-fallback`, type: "text", content: message.content });
  }
  return items;
}

export function appendTextTimeline(current: WorkspaceTimelineItem[], delta: string): WorkspaceTimelineItem[] {
  if (!delta) return current;
  const last = current[current.length - 1];
  // A round's narration is closed when the server marks it (slice 72); her next words are a new item.
  if (last?.type === "text" && !last.narration) {
    return [...current.slice(0, -1), { ...last, content: `${last.content}${delta}` }];
  }
  return [...current, { id: timelineId("text"), type: "text", content: delta }];
}

/** Slice 72: the words just sent belong to the round whose steps came before them. */
export function markNarrationTimeline(current: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  const last = current.at(-1);
  return last?.type === "text" ? [...current.slice(0, -1), { ...last, narration: true }] : current;
}

export function appendThinkingTimeline(current: WorkspaceTimelineItem[], delta: string): WorkspaceTimelineItem[] {
  if (!delta) return current;
  const now = Date.now();
  const last = current[current.length - 1];
  if (last?.type === "thinking") {
    return [...current.slice(0, -1), { ...last, content: `${last.content}${delta}`, updatedAt: now }];
  }
  return [...current, { id: timelineId("thinking"), type: "thinking", content: delta, startedAt: now, updatedAt: now }];
}

export function appendStatusTimeline(current: WorkspaceTimelineItem[], content: string): WorkspaceTimelineItem[] {
  const trimmed = content.trim();
  if (!trimmed) return current;
  const last = current[current.length - 1];
  if (last?.type === "status" && last.content === trimmed) return current;
  return [...current, { id: timelineId("status"), type: "status", content: trimmed }];
}

export function upsertToolTimeline(
  current: WorkspaceTimelineItem[],
  update: WorkspaceToolCall,
): WorkspaceTimelineItem[] {
  const existingIndex = current.findIndex((item) => item.type === "tool" && item.tool.id === update.id);
  if (existingIndex < 0) {
    const toolItem: WorkspaceTimelineItem = { id: `tool-${update.id}`, type: "tool", tool: update };
    return [...current, toolItem];
  }
  return current.map((item, index) => {
    if (index !== existingIndex || item.type !== "tool") return item;
    return {
      ...item,
      tool: {
        ...item.tool,
        ...update,
        name: update.name === "tool" && item.tool.name !== "tool" ? item.tool.name : update.name,
        input: update.input ?? item.tool.input,
        detail: update.detail ?? item.tool.detail,
        output: update.output ?? item.tool.output,
        // The update carries its own timestamp; the first sighting is what dates the step.
        startedAt: item.tool.startedAt || update.startedAt,
        // A later event without a duration must not erase one we already have.
        durationMs: update.durationMs ?? item.tool.durationMs,
      },
    };
  });
}

const MARI_DB_MUTATIONS = new Set(["insert", "patch", "replace", "delete", "transform"]);

function splitShellWords(command: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (!quote && /\s/.test(char)) {
      if (current) words.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) words.push(current);
  return words;
}

function humanizeIdentifier(value: string | null | undefined) {
  if (!value) return "data";
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactCommand(command: string, limit = 220) {
  const compact = command.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
}

function getBashCommand(tool: WorkspaceToolCall) {
  const input = asRecord(tool.input);
  const command = input?.command;
  if (typeof command === "string" && command.trim()) return command.trim();
  return null;
}

function shellTokenBasename(token: string) {
  const clean = token.trim().replace(/^["']|["']$/g, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1]?.toLowerCase() ?? "";
}

function isMariExecutableToken(token: string) {
  return /^(?:mari|mari\.(?:cmd|ps1|exe))$/i.test(shellTokenBasename(token));
}

function getMariTokens(command: string): string[] | null {
  const tokens = splitShellWords(command);
  const start = tokens.findIndex(isMariExecutableToken);
  return start >= 0 ? tokens.slice(start) : null;
}

function firstCommandValue(tokens: string[], start = 0) {
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || token === "--" || token.startsWith("-") || token.includes("=")) continue;
    return token;
  }
  return null;
}

function looksLikeHelpToken(token: string | null | undefined) {
  return !token || token === "help" || token === "--help" || token === "-h";
}

function extractMariDbCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "db") return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "status");
  const target = tokens.slice(3).find((token) => token && !token.startsWith("-") && !token.includes("=")) ?? null;
  return {
    action,
    target,
    apply: tokens.includes("--apply"),
    dryRun: tokens.includes("--dry-run") || (MARI_DB_MUTATIONS.has(action) && !tokens.includes("--apply")),
  };
}

function mariDbTitle(info: NonNullable<ReturnType<typeof extractMariDbCommand>>) {
  const target = humanizeIdentifier(info.target);
  switch (info.action) {
    case "status":
      return "Checking database status";
    case "help":
      return "Opening database command help";
    case "tables":
      return "Listing database tables";
    case "counts":
      return "Counting database rows";
    case "schema":
      return `Reading ${target} schema`;
    case "list":
      return `Listing ${target}`;
    case "get":
      return `Reading ${target} row`;
    case "search":
      return `Searching ${info.target === "all" ? "all tables" : target}`;
    case "select":
      return `Querying ${target}`;
    case "validate":
      return "Validating workspace data";
    case "insert":
      return info.apply ? `Creating ${target}` : `Previewing new ${target}`;
    case "patch":
      return info.apply ? `Applying ${target} update` : `Previewing ${target} update`;
    case "replace":
      return info.apply ? `Replacing ${target}` : `Previewing ${target} replacement`;
    case "delete":
      return info.apply ? `Deleting ${target}` : `Previewing ${target} deletion`;
    case "transform":
      return info.apply ? `Applying ${target} transform` : `Previewing ${target} transform`;
    default:
      return `Running mari db ${info.action}`;
  }
}

function mariDbDetail(info: NonNullable<ReturnType<typeof extractMariDbCommand>>) {
  if (!info.target || ["status", "tables", "counts", "validate", "data-dir", "now", "new-id"].includes(info.action))
    return null;
  return info.target === "all" ? "all tables" : humanizeIdentifier(info.target);
}

function tokenFlagValue(tokens: string[], flag: string) {
  const prefixed = `${flag}=`;
  const inline = tokens.find((token) => token.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);
  const index = tokens.indexOf(flag);
  return index >= 0 ? (tokens[index + 1] ?? null) : null;
}

function extractMariCodeCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "code") return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "status");
  return {
    action,
    subaction: action === "reload" ? (tokens[3] ?? null) : null,
    kind: tokenFlagValue(tokens, "--kind"),
    changed: tokens.includes("--changed"),
    patch: tokens.includes("--patch") || tokens.includes("--full"),
  };
}

function mariCodeTitle(info: NonNullable<ReturnType<typeof extractMariCodeCommand>>) {
  switch (info.action) {
    case "status":
      return "Checking workspace status";
    case "help":
      return "Opening workspace command help";
    case "diff":
      return info.patch ? "Inspecting workspace diff" : "Summarizing workspace diff";
    case "check":
      return info.changed ? "Checking changed workspace files" : "Running workspace checks";
    case "health":
      return "Checking workspace health";
    case "reload":
      return info.subaction === "request"
        ? `Requesting ${info.kind ?? "workspace"} reload`
        : "Managing workspace reload";
    case "continue":
      return "Continuing workspace run";
    default:
      return `Running mari code ${info.action}`;
  }
}

function mariCodeDetail(info: NonNullable<ReturnType<typeof extractMariCodeCommand>>) {
  if (info.action === "reload" && info.kind) return info.kind;
  if (info.action === "diff" && info.patch) return "patch included";
  if (info.action === "check" && info.changed) return "changed scope requested";
  return null;
}

const MARI_THEME_MUTATIONS = new Set(["create", "update", "set-active"]);

function extractMariThemesCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || (tokens[1] !== "themes" && tokens[1] !== "theme")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "list");
  const name = tokenFlagValue(tokens, "--name");
  return {
    action,
    name,
    apply: tokens.includes("--apply"),
    activate: tokens.includes("--activate") || tokens.includes("--active") || action === "set-active",
    dryRun: MARI_THEME_MUTATIONS.has(action) && !tokens.includes("--apply"),
  };
}

function mariThemesTitle(info: NonNullable<ReturnType<typeof extractMariThemesCommand>>) {
  const suffix = info.name ? `: ${info.name}` : "";
  switch (info.action) {
    case "list":
      return "Listing themes";
    case "help":
      return "Opening theme command help";
    case "active":
      return "Checking active theme";
    case "get":
      return "Reading theme";
    case "create":
      return info.apply ? `Creating theme${suffix}` : `Previewing theme${suffix}`;
    case "update":
      return info.apply ? "Updating theme" : "Previewing theme update";
    case "set-active":
      return info.apply ? "Activating theme" : "Previewing theme activation";
    default:
      return `Running mari themes ${info.action}`;
  }
}

function mariThemesDetail(info: NonNullable<ReturnType<typeof extractMariThemesCommand>>) {
  if (info.dryRun) return "dry run, not saved";
  if (info.activate) return "activate";
  return null;
}

const MARI_IMAGE_WRITES = new Set(["assign", "add", "replace", "delete", "remove", "clear"]);

function extractMariImagesCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || !["image", "images", "media"].includes(tokens[1] ?? "")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  return {
    action,
    target: tokenFlagValue(tokens, "--target") ?? firstCommandValue(tokens, 3),
    asset: tokenFlagValue(tokens, "--asset") ?? tokenFlagValue(tokens, "--id"),
    prompt: tokenFlagValue(tokens, "--prompt"),
    source: tokenFlagValue(tokens, "--source"),
    connection: tokenFlagValue(tokens, "--connection"),
    edit: tokens.includes("--edit"),
    mutating: MARI_IMAGE_WRITES.has(action),
  };
}

function mariImagesTitle(info: NonNullable<ReturnType<typeof extractMariImagesCommand>>) {
  switch (info.action) {
    case "connections":
      return info.edit ? "Finding edit-capable image connections" : "Checking image connections";
    case "capabilities":
      return info.edit ? "Checking image edit capabilities" : "Checking image capabilities";
    case "preview":
      return "Preparing image preview";
    case "generate":
      return "Generating review image";
    case "edit":
      return "Editing review image";
    case "assign":
    case "add":
    case "replace":
      return "Assigning image asset";
    case "delete":
    case "remove":
    case "clear":
      return "Removing image asset";
    case "list":
      return `Listing ${humanizeIdentifier(info.target)}`;
    case "get":
      return "Reading image asset";
    case "help":
      return "Opening image command help";
    default:
      return `Running mari images ${info.action}`;
  }
}

function mariImagesDetail(info: NonNullable<ReturnType<typeof extractMariImagesCommand>>) {
  if (info.target && !["list", "get"].includes(info.action)) return humanizeIdentifier(info.target);
  if (info.asset) return compactCommand(info.asset, 70);
  if (info.source) return compactCommand(info.source, 70);
  if (info.prompt) return compactCommand(info.prompt, 70);
  if (info.connection) return compactCommand(info.connection, 70);
  return null;
}

function extractMariWikiCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || !["wiki", "fandom"].includes(tokens[1] ?? "")) return null;
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  const wiki =
    tokenFlagValue(tokens, "--wiki") ??
    (["search", "search-wiki", "pages", "category", "category-members", "site-info"].includes(action)
      ? tokens[3]
      : null);
  return {
    action,
    wiki,
    title: tokenFlagValue(tokens, "--title"),
    pageUrl: tokenFlagValue(tokens, "--page-url") ?? tokenFlagValue(tokens, "--pageUrl"),
    query: tokenFlagValue(tokens, "--query") ?? firstCommandValue(tokens, action === "search-in-page" ? 5 : 3),
    category:
      tokenFlagValue(tokens, "--category") ??
      (["category", "category-members"].includes(action)
        ? tokens.slice(4).find((token) => token && !token.startsWith("-"))
        : null),
    content: tokenFlagValue(tokens, "--content"),
  };
}

function mariWikiTitle(info: NonNullable<ReturnType<typeof extractMariWikiCommand>>) {
  switch (info.action) {
    case "find":
    case "find-wikis":
      return "Finding Fandom wikis";
    case "search-all":
      return "Searching Fandom pages";
    case "search":
    case "search-wiki":
      return "Searching wiki";
    case "get":
    case "get-page":
      return "Reading wiki page";
    case "pages":
      return "Reading wiki pages";
    case "sections":
      return "Reading wiki sections";
    case "category":
    case "category-members":
      return "Listing wiki category";
    case "site-info":
      return "Checking wiki site info";
    case "search-in-page":
      return "Searching inside wiki page";
    case "help":
      return "Opening wiki command help";
    default:
      return `Running mari wiki ${info.action}`;
  }
}

function mariWikiDetail(info: NonNullable<ReturnType<typeof extractMariWikiCommand>>) {
  const detail = info.title ?? info.category ?? info.pageUrl ?? info.wiki ?? info.query ?? info.content;
  return detail ? compactCommand(detail, 70) : null;
}

function extractMariStorageCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  if (!isMariExecutableToken(tokens[0] ?? "") || tokens[1] !== "storage") return null;
  return {
    action: looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help"),
  };
}

function extractMariGenericCommand(command: string) {
  const tokens = getMariTokens(command);
  if (!tokens) return null;
  const group = looksLikeHelpToken(tokens[1]) ? "help" : (tokens[1] ?? "help");
  const action = looksLikeHelpToken(tokens[2]) ? "help" : (tokens[2] ?? "help");
  return { group, action };
}

function mariGenericTitle(info: NonNullable<ReturnType<typeof extractMariGenericCommand>>) {
  if (info.group === "help") return "Opening Prof. Mari CLI help";
  if (info.group === "storage") return "Checking reserved storage command";
  if (info.action === "help") return `Opening mari ${info.group} help`;
  return `Running mari ${info.group} ${info.action}`;
}

function mariGenericDetail(info: NonNullable<ReturnType<typeof extractMariGenericCommand>>) {
  if (info.group === "help") return null;
  return info.action === "help" ? info.group : `${info.group} ${info.action}`;
}

function toolInputPath(tool: WorkspaceToolCall) {
  const input = asRecord(tool.input);
  const candidate = input?.path ?? input?.file ?? input?.filePath ?? input?.file_path ?? input?.uri ?? tool.detail;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function skillNameFromPath(path: string) {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const file = parts[parts.length - 1]?.toLowerCase();
  const parent = file === "skill.md" ? parts[parts.length - 2] : parts[parts.length - 1];
  return humanizeIdentifier(parent ?? "skill");
}

function getSkillReadPresentation(tool: WorkspaceToolCall): ToolPresentation | null {
  const path = toolInputPath(tool);
  if (!path) return null;
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (!normalized.endsWith("/skill.md") && normalized !== "skill.md") return null;
  const professorMariSkill = normalized.includes("/.mari-workspace/skills/");
  const skillName = skillNameFromPath(path);
  return {
    eyebrow: professorMariSkill ? "Prof. Mari skill" : "Skill",
    title: professorMariSkill ? "Loading Professor Mari skill" : `Loading ${skillName}`,
    detail: professorMariSkill ? skillName : null,
    tone: "skill",
  };
}

function summarizeShellCommand(command: string) {
  const compact = compactCommand(command, 120);
  const words = splitShellWords(command);
  if (words[0] === "pnpm" && words[1]) return `Running pnpm ${words[1]}`;
  if (words[0] === "git" && words[1]) return `Running git ${words[1]}`;
  if (words[0] === "node") return "Running node script";
  return compact ? `$ ${compact}` : "Running shell command";
}

/**
 * Who or what an app-data step was about, so a step reads "Reading character · Shrek" instead of a bare
 * verb. The name comes from the output (a single read returns the record), else from what she searched.
 * ponytail: the first "name"/"title" in the output text; parse per action if a record ever nests a
 * different name first.
 */
function appDataSubject(tool: WorkspaceToolCall, input: Record<string, unknown> | null): string | null {
  // A list's first record is not its subject; a list or search is only "about" what she searched for.
  const single = typeof input?.action === "string" && /\.get(Entry)?$/u.test(input.action);
  const named = single && tool.output?.match(/"(?:name|title)"\s*:\s*"((?:[^"\\]|\\.){1,80})"/u)?.[1];
  if (named) return named.replace(/\\(.)/gu, "$1");
  const asked = input?.query ?? input?.name ?? input?.search;
  return typeof asked === "string" && asked.trim() ? previewValue(asked, 60) : null;
}

const APP_DATA_WRITE_VERBS: Record<string, string> = {
  create: "Creating",
  update: "Updating",
  add: "Adding",
  delete: "Deleting",
  set: "Setting",
  move: "Moving",
};

export function inferToolPresentation(tool: WorkspaceToolCall): ToolPresentation {
  const name = formatToolName(tool.name);
  const input = asRecord(tool.input);
  const appDataAction = typeof input?.action === "string" ? input.action : null;
  const command = getBashCommand(tool);
  const mariDb = command ? extractMariDbCommand(command) : null;
  const mariCode = command ? extractMariCodeCommand(command) : null;
  const mariThemes = command ? extractMariThemesCommand(command) : null;
  const mariImages = command ? extractMariImagesCommand(command) : null;
  const mariWiki = command ? extractMariWikiCommand(command) : null;
  const mariStorage = command ? extractMariStorageCommand(command) : null;
  const mariGeneric = command ? extractMariGenericCommand(command) : null;
  if (command && mariDb) {
    return {
      eyebrow: mariDb.dryRun ? "DB preview" : "Database",
      title: mariDbTitle(mariDb),
      detail: mariDbDetail(mariDb),
      tone: "db",
    };
  }
  if (command && mariCode) {
    return {
      eyebrow: "Workspace",
      title: mariCodeTitle(mariCode),
      detail: mariCodeDetail(mariCode),
      tone: "shell",
    };
  }
  if (command && mariThemes) {
    return {
      eyebrow: mariThemes.dryRun ? "Theme preview" : "Theme",
      title: mariThemesTitle(mariThemes),
      detail: mariThemesDetail(mariThemes),
      tone: "theme",
    };
  }
  if (command && mariImages) {
    return {
      eyebrow: mariImages.mutating ? "Image change" : "Images",
      title: mariImagesTitle(mariImages),
      detail: mariImagesDetail(mariImages),
      tone: mariImages.mutating ? "write" : "image",
    };
  }
  if (command && mariWiki) {
    return {
      eyebrow: "Wiki",
      title: mariWikiTitle(mariWiki),
      detail: mariWikiDetail(mariWiki),
      tone: "wiki",
    };
  }
  if (command && mariStorage) {
    return {
      eyebrow: "Storage",
      title: "Checking reserved storage command",
      detail: mariStorage.action === "help" ? null : mariStorage.action,
      tone: "shell",
    };
  }
  if (command && mariGeneric) {
    return {
      eyebrow: "Prof. Mari CLI",
      title: mariGenericTitle(mariGeneric),
      detail: mariGenericDetail(mariGeneric),
      tone: "shell",
    };
  }

  if (command) {
    return {
      eyebrow: "Shell",
      title: summarizeShellCommand(command),
      detail: compactCommand(command, 90),
      tone: "shell",
    };
  }

  if (appDataAction && /app[ _-]?data/i.test(name)) {
    const actionTitles: Record<string, string> = {
      "chat.get": "Reading chat",
      // UX-17: was the raw action, "Read chat diagnose".
      "chat.diagnose": "Checking the last reply",
      "chat.messages": "Reading recent messages",
      "chat.updateMessage": "Fixing a reply",
      "character.get": "Reading character",
      "instruction.get": "Reading instruction",
    };
    // A write reads as one ("Updating lorebook entry"), so its icon and its run phase say it changed something.
    const parts = appDataAction.split(".");
    const writeVerb = /^(create|update|add|delete|set|move)(.*)$/u.exec(parts.at(-1) ?? "");
    const writeTitle = writeVerb
      ? [
          APP_DATA_WRITE_VERBS[writeVerb[1]!],
          ...parts.slice(0, -1),
          writeVerb[2]!.replace(/([a-z])([A-Z])/gu, "$1 $2").toLowerCase(),
        ]
          .filter(Boolean)
          .join(" ")
      : null;
    return {
      eyebrow: "App data",
      title: actionTitles[appDataAction] ?? writeTitle ?? `Reading ${appDataAction.replaceAll(".", " ")}`,
      detail: appDataSubject(tool, input),
      tone: "db",
    };
  }

  const skillPresentation = getSkillReadPresentation(tool);
  if (skillPresentation) return skillPresentation;

  if (name === "package service") {
    const packageId = typeof input?.package === "string" && input.package.trim() ? input.package : null;
    // With an action it runs something in a package, which the Engine cannot preview or undo.
    return appDataAction
      ? { eyebrow: "Package", title: `Running ${appDataAction}`, detail: packageId, tone: "write" }
      : { eyebrow: "Package", title: "Checking package actions", detail: packageId, tone: "generic" };
  }

  const detail = previewValue(
    input?.path ?? input?.pattern ?? input?.query ?? input?.url ?? input?.command ?? tool.detail,
    90,
  );
  // Slice 72: her help docs are not "files" to the user.
  if (name === "docs search") return { eyebrow: "Help", title: "Searching help for", detail, tone: "search" };
  if (name === "docs read") return { eyebrow: "Help", title: "Reading help page", detail, tone: "file" };
  if (/grep|find|search/i.test(name)) {
    return { eyebrow: "Search", title: name === "grep" ? "Searching text" : "Finding files", detail, tone: "search" };
  }
  if (/read|file/i.test(name)) {
    return { eyebrow: "File", title: "Reading file", detail, tone: "file" };
  }
  if (/write|edit/i.test(name)) {
    return {
      eyebrow: "File change",
      title: name.includes("edit") ? "Editing file" : "Writing file",
      detail,
      tone: "write",
    };
  }
  if (name === "ls") {
    return { eyebrow: "Files", title: "Listing folder", detail, tone: "file" };
  }
  return { eyebrow: "Tool", title: name, detail, tone: "generic" };
}
