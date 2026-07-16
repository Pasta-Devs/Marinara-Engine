// ──────────────────────────────────────────────
// Professor Mari DB service
// ──────────────────────────────────────────────
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { eq } from "../../db/file-query.js";
import type { DB } from "../../db/connection.js";
import { flushDB } from "../../db/connection.js";
import { CASCADES, FILE_BACKED_TABLES } from "../../db/file-backed-store.js";
import { getFileTableConfig, isFileTable, type AnyFileColumn, type AnyFileTable } from "../../db/file-schema.js";
import * as schema from "../../db/schema/index.js";
import { getFileStorageDir, getMonorepoRoot, isCustomToolScriptEnabled } from "../../config/runtime-config.js";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { normalizeThemeCss } from "../../utils/theme-css.js";
import { getMariImagesService } from "./mari-images.service.js";
import { executeWikiCli } from "../professor-mari/fandom-mediawiki/wiki-cli.js";
import {
  LIMITS,
  PROFESSOR_MARI_ID,
  normalizeLorebookCategory,
  type MariDbCommandResult,
  type MariDbDiffSummary,
  type MariDbHistoryEntry,
  type MariDbPendingApproval,
  type MariDbRowChange,
  type MariDbValidationIssue,
  type MariDbValidationResult,
} from "@marinara-engine/shared";

type Row = Record<string, unknown>;
type Table = AnyFileTable;
type Column = AnyFileColumn;
type ColumnMeta = {
  key: string;
  dbName: string;
  column: Column;
  primary: boolean;
  notNull: boolean;
};
type TableMeta = {
  name: string;
  table: Table;
  columns: ColumnMeta[];
  byKey: Map<string, ColumnMeta>;
  primaryKey: string | null;
};
type PlanChange = MariDbRowChange & {
  beforeRaw?: Row | null;
  afterRaw?: Row | null;
  apply: boolean;
  cascadeOf?: string;
};
type Plan = {
  changes: PlanChange[];
  validation: MariDbValidationResult;
  summary: MariDbDiffSummary;
  operationHash: string;
  reason: string | null;
  request: ParsedMutationRequest;
};
type ParsedMutationRequest = {
  kind: "insert" | "patch" | "replace" | "delete" | "transform" | "theme-create" | "theme-update" | "theme-set-active";
  table: string | "all";
  id?: string;
  where?: string;
  row?: Row;
  patch?: Row;
  scriptPath?: string;
  name?: string;
  css?: string;
  installedAt?: string;
  activate?: boolean;
  cwd?: string;
  apply: boolean;
  requiresApproval?: boolean;
  cascade: boolean;
  reason: string | null;
  generatedIds?: string[];
  relatedInserts?: Array<{ table: string; row: Row }>;
};
type PendingRecord = MariDbPendingApproval & {
  plan: Plan;
  command: string;
  historyId: string | null;
  journalPath: string | null;
  timer: NodeJS.Timeout;
};

type MariCliEnvelope = {
  argv?: string[];
  command?: string;
  cwd?: string;
  sessionId?: string;
};

type MariAppDataActionEnvelope = Row & {
  action?: unknown;
  cwd?: string;
  sessionId?: string;
};

type CodeCommandContext = {
  command: string;
  sessionId: string;
  cwd?: string;
};

type ProcessRunResult = {
  command: string;
  cwd: string;
  ok: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  truncated: boolean;
};

const PREVIEW_LIMIT = 50;
const APPROVAL_TIMEOUT_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 50;
const COMMAND_OUTPUT_LIMIT = 32_000;
const CODE_READ_TIMEOUT_MS = 30_000;
const CODE_CHECK_TIMEOUT_MS = 15 * 60 * 1000;
const FILE_BACKED_TABLE_SET = new Set<string>(FILE_BACKED_TABLES);
const THEME_TABLE = "custom_themes";
const THEME_ACTIVE_TRUE = "true";
const THEME_ACTIVE_FALSE = "false";
const BOOLEAN_FLAGS = new Set([
  "active",
  "activate",
  "apply",
  "cached",
  "cascade",
  "changed",
  "constant",
  "disable",
  "dry-run",
  "enable",
  "full",
  "global",
  "help",
  "jsonl",
  "no-constant",
  "no-global",
  "parsed",
  "patch",
  "raw",
  "resume",
  "staged",
  "strict",
  "tail",
]);

function truncateOutput(value: string, limit = COMMAND_OUTPUT_LIMIT): { text: string; truncated: boolean } {
  if (value.length <= limit) return { text: value, truncated: false };
  return { text: `${value.slice(0, limit)}\n… output truncated at ${limit} characters …`, truncated: true };
}

function appendLimited(current: string, chunk: string, limit = COMMAND_OUTPUT_LIMIT): { text: string; truncated: boolean } {
  if (current.length >= limit) return { text: current, truncated: true };
  const next = current + chunk;
  return truncateOutput(next, limit);
}

function displayCommand(bin: string, args: string[]) {
  return [bin, ...args].map((part) => (/[\s"']/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function runProcess(bin: string, args: string[], options: { cwd: string; timeoutMs: number }): Promise<ProcessRunResult> {
  const startedAt = Date.now();
  const command = displayCommand(bin, args);
  return new Promise((resolveRun) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let settled = false;
    let timedOut = false;

    const child = spawn(bin, args, {
      cwd: options.cwd,
      env: process.env,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    timer.unref?.();

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null, spawnError?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (spawnError) {
        stderr = stderr ? `${stderr}\n${spawnError.message}` : spawnError.message;
      }
      resolveRun({
        command,
        cwd: options.cwd,
        ok: exitCode === 0 && !timedOut && !spawnError,
        exitCode,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        timedOut,
        truncated,
      });
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      const result = appendLimited(stdout, chunk.toString());
      stdout = result.text;
      truncated ||= result.truncated;
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const result = appendLimited(stderr, chunk.toString());
      stderr = result.text;
      truncated ||= result.truncated;
    });
    child.on("error", (err) => finish(null, null, err));
    child.on("close", (code, signal) => finish(code, signal));
  });
}

function parseGitStatusFiles(status: string): string[] {
  const files = new Set<string>();
  for (const line of status.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("##")) continue;
    const raw = line.slice(3).trim();
    if (!raw) continue;
    const renamed = raw.split(" -> ");
    files.add(renamed[renamed.length - 1] ?? raw);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

async function readPackageVersion(cwd: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(resolve(cwd, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

// The parent→child delete graph is imported from db/file-backed-store.ts (the
// single source of truth) so cascade deletes and the dangling-reference
// validator never drift from the real relations again.

// Columns stored as JSON text. Ground truth is the file-table definition in
// db/schema/* — these are plain text() columns whose JSON-ness only exists in
// their doc comments, so this map cannot be derived automatically. Keep it in
// sync with the schema when columns change.
const JSON_COLUMNS: Record<string, readonly string[]> = {
  characters: ["data"],
  character_card_versions: ["data"],
  persona_card_versions: ["data"],
  personas: ["avatarCrop", "trackerCardColors", "personaStats", "tags", "savedStatusOptions", "convoBehavior"],
  character_groups: ["characterIds"],
  persona_groups: ["personaIds"],
  chats: ["characterIds", "metadata"],
  messages: ["extra"],
  message_swipes: ["extra"],
  memory_chunks: ["embedding"],
  lorebooks: ["scope", "tags"],
  lorebook_entries: [
    "keys",
    "secondaryKeys",
    "characterFilterIds",
    "characterTagFilters",
    "generationTriggerFilters",
    "additionalMatchingSources",
    "relationships",
    "dynamicState",
    "activationConditions",
    "schedule",
    "embedding",
  ],
  prompt_presets: ["sectionOrder", "groupOrder", "variableGroups", "variableValues", "parameters", "defaultChoices"],
  prompt_sections: ["markerConfig"],
  choice_blocks: ["options"],
  chat_presets: ["settings"],
  // comfyuiWorkflow must be valid JSON by contract: image-generation.ts throws
  // "Invalid ComfyUI workflow JSON" on parse failure (placeholders live inside
  // string values). treatAsLocalEndpoint is a boolean-as-text, not JSON.
  api_connections: ["defaultParameters", "comfyuiWorkflow"],
  agent_configs: ["settings"],
  agent_runs: ["resultData"],
  agent_memory: ["value"],
  custom_tools: ["parametersSchema"],
  game_state_snapshots: [
    "presentCharacters",
    "recentEvents",
    "playerStats",
    "personaStats",
    "manualOverrides",
    "fieldLocks",
  ],
  game_checkpoints: ["snapshotData", "spatialSnapshotData"],
  // chat_images, character_images, assets, custom_themes, and installed_extensions
  // have no JSON columns; their former entries named columns that do not exist.
  game_engine_state: ["state"],
  regex_scripts: ["trimStrings", "placement", "targetCharacterIds"],
};

function buildTableMetas() {
  const metas = new Map<string, TableMeta>();
  for (const candidate of Object.values(schema)) {
    if (!isFileTable(candidate)) continue;
    const table = candidate;
    const config = getFileTableConfig(table);
    const name = config.name;
    if (!FILE_BACKED_TABLE_SET.has(name)) continue;
    const columns = config.columns.map((column) => ({
      key: column.key,
      dbName: column.name,
      column,
      primary: column.primary,
      notNull: column.isNotNull,
    }));
    metas.set(name, {
      name,
      table,
      columns,
      byKey: new Map(columns.map((column) => [column.key, column])),
      primaryKey: columns.find((column) => column.primary)?.key ?? null,
    });
  }
  return metas;
}

const TABLE_METAS = buildTableMetas();
const AGENT_PHASES = new Set(["pre_generation", "parallel", "post_processing"]);
const TOOL_EXECUTION_TYPES = new Set(["webhook", "static", "script"]);
const BOOLEAN_TEXT_VALUES = new Set(["true", "false"]);

function isRecord(value: unknown): value is Row {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortForHash(value));
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (!isRecord(value)) return value;
  const out: Row = {};
  for (const key of Object.keys(value).sort()) out[key] = sortForHash(value[key]);
  return out;
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && trimmed !== "null") return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function jsonColumnSet(table: string) {
  return new Set(JSON_COLUMNS[table] ?? []);
}

function parseRow(table: string, row: Row): Row {
  const jsonCols = jsonColumnSet(table);
  const out: Row = { ...row };
  for (const key of jsonCols) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = parseJsonMaybe(out[key]);
  }
  return out;
}

function tryParseJsonColumn(row: Row, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(row, key)) return undefined;
  const value = row[key];
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function parseRequiredJsonObjectInput(rawJson: string, label: string): Row {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson) as unknown;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} is not valid JSON: ${reason}`);
  }
  if (Array.isArray(parsed)) {
    throw new Error(
      `${label} must be one JSON object, not an array. Do not pass tables/characters.json; use a temp file containing one CharacterData object, or use mari db for raw row/table edits.`,
    );
  }
  if (!isRecord(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed;
}

function toBooleanText(value: unknown): unknown {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number" && (value === 0 || value === 1)) return value === 1 ? "true" : "false";
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return BOOLEAN_TEXT_VALUES.has(normalized) ? normalized : value;
}

function normalizeAgentConfigWriteRow(row: Row): Row {
  const out: Row = { ...row };
  if (out.description === undefined) out.description = "";
  if (out.connectionId === undefined) out.connectionId = null;
  if (out.imagePath === undefined) out.imagePath = null;
  if (out.promptTemplate === undefined) out.promptTemplate = "";
  if (out.settings === undefined) out.settings = {};
  if (typeof out.phase === "string" && out.phase.trim().toLowerCase() === "inactive") {
    out.phase = "post_processing";
  } else if (typeof out.phase === "string") {
    out.phase = out.phase.trim();
  }
  out.enabled = "true";
  return out;
}

function normalizeCustomToolWriteRow(row: Row): Row {
  const out: Row = { ...row };
  if (out.description === undefined) out.description = "";
  if (out.parametersSchema === undefined) out.parametersSchema = {};
  if (out.executionType === undefined) out.executionType = "static";
  if (out.webhookUrl === undefined) out.webhookUrl = null;
  if (out.staticResult === undefined) out.staticResult = null;
  if (out.scriptBody === undefined) out.scriptBody = null;
  out.includeHiddenContext = out.includeHiddenContext === undefined ? "false" : toBooleanText(out.includeHiddenContext);
  out.enabled = out.enabled === undefined ? "true" : toBooleanText(out.enabled);
  return out;
}

function normalizeWriteRow(table: string, row: Row): Row {
  if (table === "agent_configs") return normalizeAgentConfigWriteRow(row);
  if (table === "custom_tools") return normalizeCustomToolWriteRow(row);
  return { ...row };
}

function serializeRow(table: string, row: Row): Row {
  const jsonCols = jsonColumnSet(table);
  const out: Row = normalizeWriteRow(table, row);
  for (const key of jsonCols) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const value = out[key];
    if (value === undefined) continue;
    if (value === null) {
      out[key] = null;
    } else if (typeof value !== "string") {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

function parseThemeRow(row: Row): Row {
  const parsed = parseRow(THEME_TABLE, row);
  return {
    ...parsed,
    css: typeof parsed.css === "string" ? normalizeThemeCss(parsed.css) : parsed.css,
    isActive: row.isActive === THEME_ACTIVE_TRUE,
  };
}

function summarizeThemeRow(row: Row): Row {
  const parsed = parseThemeRow(row);
  const css = typeof row.css === "string" ? row.css : "";
  return {
    id: parsed.id,
    name: parsed.name,
    isActive: parsed.isActive,
    cssLength: css.length,
    installedAt: parsed.installedAt,
    updatedAt: parsed.updatedAt,
  };
}

function knownColumnPatch(meta: TableMeta, row: Row): Row {
  const out: Row = {};
  for (const column of meta.columns) {
    if (Object.prototype.hasOwnProperty.call(row, column.key)) out[column.key] = row[column.key];
  }
  return out;
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isRecord(base) || !isRecord(patch) || Array.isArray(base) || Array.isArray(patch)) return clone(patch);
  const out: Row = { ...clone(base) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete out[key];
      continue;
    }
    out[key] = isRecord(out[key]) && isRecord(value) ? deepMerge(out[key], value) : clone(value);
  }
  return out;
}

function getMeta(table: string): TableMeta {
  const meta = TABLE_METAS.get(table);
  if (!meta) throw new Error(`Unknown file-backed table: ${table}`);
  return meta;
}

function getPrimary(meta: TableMeta): string {
  if (!meta.primaryKey) throw new Error(`Table ${meta.name} does not expose a primary key`);
  return meta.primaryKey;
}

function rowId(meta: TableMeta, row: Row): string {
  const key = getPrimary(meta);
  const value = row[key];
  return value == null ? "" : String(value);
}

function normalizeLimit(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function normalizeOffset(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function makeEmptyValidation(): MariDbValidationResult {
  return { status: "passed", errors: [], notices: [], infos: [] };
}

function validationFromIssues(issues: MariDbValidationIssue[]): MariDbValidationResult {
  const errors = issues.filter((issue) => issue.level === "error");
  const notices = issues.filter((issue) => issue.level === "notice");
  const infos = issues.filter((issue) => issue.level === "info");
  return { status: errors.length > 0 ? "blocked" : "passed", errors, notices, infos };
}

function summaryForChanges(changes: PlanChange[]): MariDbDiffSummary {
  const preview = changes.slice(0, PREVIEW_LIMIT).map(({ table, id, action, before, after }) => ({
    table,
    id,
    action,
    before: before ?? null,
    after: after ?? null,
  }));
  const affectedTables: Record<string, number> = {};
  for (const change of changes) affectedTables[change.table] = (affectedTables[change.table] ?? 0) + 1;
  return {
    matchedRows: changes.length,
    affectedRows: changes.length,
    insertedRows: changes.filter((change) => change.action === "insert").length,
    updatedRows: changes.filter((change) => change.action === "update").length,
    replacedRows: changes.filter((change) => change.action === "replace").length,
    deletedRows: changes.filter((change) => change.action === "delete").length,
    affectedTables,
    preview,
    truncated: changes.length > PREVIEW_LIMIT,
  };
}

function formatCommand(argv: string[] | undefined, fallback: string | undefined) {
  if (fallback?.trim()) return fallback.trim();
  return ["mari", ...(argv ?? [])]
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ")
    .trim();
}

function parseArgs(args: string[]) {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf("=");
    if (eqIndex > 2) {
      flags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name)) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }
  return { positionals, flags };
}

function flagString(flags: Map<string, string | boolean>, name: string): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFlag(flags: Map<string, string | boolean>, name: string): boolean {
  return flags.has(name) && flags.get(name) !== false;
}

function normalizeAppDataActionName(action: string): string {
  let key = action.trim().toLowerCase().replace(/[-_\s]+/g, "");
  key = key
    .replace(/^characters\./, "character.")
    .replace(/^personas\./, "persona.")
    .replace(/^lorebooks\./, "lorebook.")
    .replace(/^themes\./, "theme.")
    .replace(/^agents\./, "agent.")
    .replace(/^presets\./, "preset.")
    .replace(/^promptpresets\./, "preset.");
  const aliases: Record<string, string> = {
    "lorebook.entry.add": "lorebook.addentry",
    "lorebook.entry.create": "lorebook.addentry",
    "lorebook.entries.add": "lorebook.addentry",
    "lorebook.entries.create": "lorebook.addentry",
    "lorebook.entry.get": "lorebook.getentry",
    "lorebook.entries.get": "lorebook.getentry",
    "lorebook.entry.update": "lorebook.updateentry",
    "lorebook.entries.update": "lorebook.updateentry",
    "theme.set": "theme.setactive",
    "theme.activate": "theme.setactive",
    "promptpreset.list": "preset.list",
    "promptpreset.get": "preset.get",
    "promptpreset.search": "preset.search",
    "promptpreset.create": "preset.create",
    "promptpreset.update": "preset.update",
  };
  return aliases[key] ?? key;
}

function firstString(source: Row, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function requiredString(source: Row, keys: string[], label: string): string {
  const value = firstString(source, keys);
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function firstBoolean(source: Row, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
      if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
    }
  }
  return undefined;
}

function appDataCreateApply(source: Row): boolean {
  return firstBoolean(source, ["apply"]) !== false;
}

function firstNumber(source: Row, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function stringListValue(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === "string" ? entry.trim() : String(entry).trim())).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return undefined;
}

function firstStringList(source: Row, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = stringListValue(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function collectActionRecords(source: Row, keys: string[]): Row {
  const out: Row = {};
  for (const key of keys) {
    const value = source[key];
    if (isRecord(value)) Object.assign(out, clone(value));
  }
  return out;
}

function actionDataWithTopLevel(source: Row, recordKeys: string[], scalarKeys: string[]): Row {
  const out = collectActionRecords(source, recordKeys);
  for (const key of scalarKeys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export function normalizeCharacterActionData(input: Row): Row {
  const out: Row = { ...input };
  out.first_mes = out.first_mes ?? out.firstMes ?? out.firstMessage ?? out.greeting;
  out.mes_example = out.mes_example ?? out.mesExample;
  out.creator_notes = out.creator_notes ?? out.creatorNotes;
  out.system_prompt = out.system_prompt ?? out.systemPrompt;
  out.post_history_instructions = out.post_history_instructions ?? out.postHistoryInstructions;
  out.character_version = out.character_version ?? out.characterVersion;
  out.alternate_greetings = out.alternate_greetings ?? out.alternateGreetings;
  delete out.firstMes;
  delete out.firstMessage;
  delete out.greeting;
  delete out.mesExample;
  delete out.creatorNotes;
  delete out.systemPrompt;
  delete out.postHistoryInstructions;
  delete out.characterVersion;
  delete out.alternateGreetings;
  const extensions = isRecord(out.extensions) ? { ...(out.extensions as Row) } : {};
  if (typeof out.backstory === "string") {
    extensions.backstory = out.backstory;
    delete out.backstory;
  }
  if (typeof out.appearance === "string") {
    extensions.appearance = out.appearance;
    delete out.appearance;
  }
  const aboutMe = out.aboutMe ?? out.about_me ?? out["about-me"];
  if (typeof aboutMe === "string") extensions.aboutMe = aboutMe;
  delete out.aboutMe;
  delete out.about_me;
  delete out["about-me"];
  if (Object.keys(extensions).length > 0) out.extensions = extensions;
  return out;
}

export function buildLorebookEntryCreateRow(
  data: Row,
  lorebookId: string,
  id: string,
  timestamp: string,
  defaultOrder = 100,
): Row {
  return {
    id,
    lorebookId,
    name: requiredString(data, ["name"], "lorebook entry name"),
    content: firstString(data, ["content"]) ?? "",
    description: firstString(data, ["description"]) ?? "",
    tag: firstString(data, ["tag"]) ?? "",
    keys: firstStringList(data, ["keys"]) ?? [],
    secondaryKeys: firstStringList(data, ["secondaryKeys", "secondary_keys"]) ?? [],
    enabled: boolText(firstBoolean(data, ["enabled"]) ?? true),
    constant: boolText(firstBoolean(data, ["constant"]) ?? false),
    selective: "false",
    selectiveLogic: "and",
    matchWholeWords: "false",
    caseSensitive: "false",
    useRegex: "false",
    characterFilterMode: "any",
    characterFilterIds: [],
    characterTagFilterMode: "any",
    characterTagFilters: [],
    generationTriggerFilterMode: "any",
    generationTriggerFilters: [],
    additionalMatchingSources: [],
    position: firstNumber(data, ["position"]) ?? 0,
    depth: firstNumber(data, ["depth"]) ?? 4,
    order: firstNumber(data, ["order"]) ?? defaultOrder,
    role: firstString(data, ["role"]) ?? "system",
    group: firstString(data, ["group"]) ?? "",
    relationships: {},
    dynamicState: {},
    activationConditions: [],
    preventRecursion: "true",
    excludeRecursion: "false",
    delayUntilRecursion: "false",
    excludeFromVectorization: "false",
    locked: "false",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizePersonaConvoBehavior(value: unknown): unknown {
  if (isRecord(value)) return clone(value);
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (isRecord(parsed)) return parsed;
  } catch {
    // A plain directive is still useful input from Professor Mari or the CLI.
  }
  return { instruction: trimmed, insertionStrategy: "constant_after" };
}

export function buildPersonaCreateRow(data: Row, id: string, timestamp: string): Row {
  return {
    id,
    name: requiredString(data, ["name"], "persona name"),
    comment: firstString(data, ["comment"]) ?? "",
    creator: firstString(data, ["creator"]) ?? "",
    personaVersion: firstString(data, ["personaVersion", "persona_version"]) ?? "1.0",
    creatorNotes: firstString(data, ["creatorNotes", "creator_notes", "creator-notes"]) ?? "",
    phoneticName: firstString(data, ["phoneticName", "phonetic_name", "phonetic-name"]) ?? "",
    description: firstString(data, ["description"]) ?? "",
    personality: firstString(data, ["personality"]) ?? "",
    scenario: firstString(data, ["scenario"]) ?? "",
    backstory: firstString(data, ["backstory"]) ?? "",
    appearance: firstString(data, ["appearance"]) ?? "",
    isActive: "false",
    nameColor: "",
    dialogueColor: "",
    boxColor: "",
    trackerCardColors: { mode: "chat" },
    personaStats: "",
    tags: firstStringList(data, ["tags"]) ?? [],
    savedStatusOptions: [],
    avatarCrop: "",
    convoDisplayName: firstString(data, ["convoDisplayName", "convo_display_name", "convo-display-name"]) ?? "",
    aboutMe: firstString(data, ["aboutMe", "about_me", "about-me"]) ?? "",
    convoBehavior: normalizePersonaConvoBehavior(data.convoBehavior ?? data.convo_behavior ?? data["convo-behavior"]),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function jsonString(value: unknown, fallback: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed === "null") return value;
  }
  return JSON.stringify(value ?? fallback);
}

function slugFromName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "custom"
  );
}

function boolText(value: boolean): string {
  return value ? "true" : "false";
}

function normalizeAgentActionData(input: Row, existing?: Row | null): Row {
  const name = firstString(input, ["name"]) ?? (typeof existing?.name === "string" ? existing.name : "");
  const settings = {
    ...(isRecord(existing?.settings) ? existing.settings : parseJsonRecordValue(existing?.settings)),
    ...(isRecord(input.settings) ? input.settings : {}),
  };
  const resultType = firstString(input, ["resultType", "result_type"]);
  if (resultType) settings.resultType = resultType;
  const row: Row = {
    ...input,
    type: firstString(input, ["type", "agentType", "agent_type"]) ?? (typeof existing?.type === "string" ? existing.type : `custom-${slugFromName(name)}`),
    name,
    description: firstString(input, ["description"]) ?? (typeof existing?.description === "string" ? existing.description : ""),
    phase:
      firstString(input, ["phase"]) ??
      (typeof existing?.phase === "string" ? existing.phase : "parallel"),
    enabled: boolText(firstBoolean(input, ["enabled"]) ?? (existing ? existing.enabled !== "false" : true)),
    connectionId:
      input.connectionId === undefined && input.connection_id === undefined
        ? (existing?.connectionId ?? null)
        : (input.connectionId ?? input.connection_id ?? null),
    imagePath:
      input.imagePath === undefined && input.image_path === undefined
        ? (existing?.imagePath ?? null)
        : (input.imagePath ?? input.image_path ?? null),
    promptTemplate:
      firstString(input, ["promptTemplate", "prompt_template", "prompt"]) ??
      (typeof existing?.promptTemplate === "string" ? existing.promptTemplate : ""),
    settings,
  };
  delete row.agentType;
  delete row.agent_type;
  delete row.resultType;
  delete row.result_type;
  delete row.prompt;
  return row;
}

function normalizePromptPresetActionData(input: Row, existing?: Row | null): Row {
  const row: Row = {
    ...input,
    name: firstString(input, ["name"]) ?? (typeof existing?.name === "string" ? existing.name : ""),
    description: firstString(input, ["description"]) ?? (typeof existing?.description === "string" ? existing.description : ""),
    conversationPrompt:
      firstString(input, ["conversationPrompt", "conversation_prompt"]) ??
      (typeof existing?.conversationPrompt === "string" ? existing.conversationPrompt : ""),
    gamePrompt:
      firstString(input, ["gamePrompt", "game_prompt"]) ?? (typeof existing?.gamePrompt === "string" ? existing.gamePrompt : ""),
    sectionOrder: jsonString(input.sectionOrder ?? input.section_order ?? existing?.sectionOrder, []),
    groupOrder: jsonString(input.groupOrder ?? input.group_order ?? existing?.groupOrder, []),
    variableGroups: jsonString(input.variableGroups ?? input.variable_groups ?? existing?.variableGroups, []),
    variableValues: jsonString(input.variableValues ?? input.variable_values ?? existing?.variableValues, {}),
    parameters: jsonString(input.parameters ?? existing?.parameters, {}),
    wrapFormat:
      firstString(input, ["wrapFormat", "wrap_format"]) ?? (typeof existing?.wrapFormat === "string" ? existing.wrapFormat : "xml"),
    defaultChoices: jsonString(input.defaultChoices ?? input.default_choices ?? existing?.defaultChoices, {}),
    isDefault: boolText(firstBoolean(input, ["isDefault", "is_default"]) ?? (existing ? existing.isDefault === "true" : false)),
    author: firstString(input, ["author"]) ?? (typeof existing?.author === "string" ? existing.author : ""),
  };
  delete row.conversation_prompt;
  delete row.game_prompt;
  delete row.section_order;
  delete row.group_order;
  delete row.variable_groups;
  delete row.variable_values;
  delete row.wrap_format;
  delete row.default_choices;
  delete row.is_default;
  return row;
}

function normalizePromptIdentifier(value: string, fallback: string, used: Set<string>): string {
  const base =
    value
      .trim()
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || fallback;
  let next = base;
  let suffix = 2;
  while (used.has(next)) {
    next = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(next);
  return next;
}

function normalizePromptVariableName(value: string, fallback: string, used: Set<string>): string {
  const base =
    value
      .trim()
      .replace(/[^\w]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || fallback;
  let next = base;
  let suffix = 2;
  while (used.has(next)) {
    next = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(next);
  return next;
}

function promptOptionRows(value: unknown): Array<{ id: string; label: string; value: string }> {
  const rawOptions = Array.isArray(value) ? value : [];
  const usedIds = new Set<string>();
  return rawOptions
    .map((option, index) => {
      if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
        const text = String(option).trim();
        if (!text) return null;
        return {
          id: normalizePromptIdentifier(text, `option_${index + 1}`, usedIds),
          label: text,
          value: text,
        };
      }
      if (!isRecord(option)) return null;
      const label = firstString(option, ["label", "name", "title", "text", "value"]);
      const optionValue =
        firstString(option, ["value", "content", "prompt", "text", "label", "name", "title"]) ?? label;
      if (!label || !optionValue) return null;
      return {
        id: normalizePromptIdentifier(firstString(option, ["id", "key"]) ?? label, `option_${index + 1}`, usedIds),
        label,
        value: optionValue,
      };
    })
    .filter((option): option is { id: string; label: string; value: string } => option !== null);
}

function normalizePromptPresetChildInserts(payload: Row, presetId: string): Array<{ table: string; row: Row }> {
  const relatedInserts: Array<{ table: string; row: Row }> = [];
  const groupIdsByName = new Map<string, string>();
  const groupOrder: string[] = [];
  const sectionOrder: string[] = [];
  const usedSectionIdentifiers = new Set<string>();
  const usedVariableNames = new Set<string>();
  const groupKey = (name: string) => name.trim().toLowerCase();

  const ensureGroup = (name: string, order?: number, enabled?: boolean): string => {
    const trimmed = name.trim();
    const key = groupKey(trimmed);
    const existing = groupIdsByName.get(key);
    if (existing) return existing;
    const id = newId();
    groupIdsByName.set(key, id);
    groupOrder.push(id);
    relatedInserts.push({
      table: "prompt_groups",
      row: {
        id,
        presetId,
        name: trimmed,
        parentGroupId: null,
        order: order ?? groupOrder.length * 100,
        enabled: boolText(enabled ?? true),
      },
    });
    return id;
  };

  const rawGroups = Array.isArray(payload.groups) ? payload.groups : [];
  for (const rawGroup of rawGroups) {
    if (!isRecord(rawGroup)) continue;
    const name = firstString(rawGroup, ["name", "title", "label"]);
    if (!name) continue;
    ensureGroup(name, firstNumber(rawGroup, ["order", "sortOrder"]), firstBoolean(rawGroup, ["enabled"]));
  }
  for (const rawGroup of rawGroups) {
    if (!isRecord(rawGroup)) continue;
    const name = firstString(rawGroup, ["name", "title", "label"]);
    const parentName = firstString(rawGroup, ["parentGroupName", "parentGroup", "parent"]);
    if (!name || !parentName) continue;
    const childId = groupIdsByName.get(groupKey(name));
    const parentId = ensureGroup(parentName);
    const groupInsert = relatedInserts.find((insert) => insert.table === "prompt_groups" && insert.row.id === childId);
    if (groupInsert) groupInsert.row.parentGroupId = parentId;
  }

  const rawSections = Array.isArray(payload.sections)
    ? payload.sections
    : Array.isArray(payload.promptSections)
      ? payload.promptSections
      : [];
  for (const [index, rawSection] of rawSections.entries()) {
    if (!isRecord(rawSection)) continue;
    const name = firstString(rawSection, ["name", "title", "label"]) ?? `Section ${index + 1}`;
    const groupName = firstString(rawSection, ["groupName", "group"]);
    const id = firstString(rawSection, ["id", "sectionId"]) ?? newId();
    sectionOrder.push(id);
    relatedInserts.push({
      table: "prompt_sections",
      row: {
        id,
        presetId,
        identifier: normalizePromptIdentifier(
          firstString(rawSection, ["identifier", "key", "slug"]) ?? name,
          `section_${index + 1}`,
          usedSectionIdentifiers,
        ),
        name,
        content: firstString(rawSection, ["content", "prompt", "text"]) ?? "",
        role: ["system", "user", "assistant"].includes(String(rawSection.role ?? ""))
          ? String(rawSection.role)
          : "system",
        enabled: boolText(firstBoolean(rawSection, ["enabled"]) ?? true),
        isMarker: boolText(firstBoolean(rawSection, ["isMarker", "marker"]) ?? false),
        groupId: groupName ? ensureGroup(groupName) : null,
        markerConfig: isRecord(rawSection.markerConfig) ? JSON.stringify(rawSection.markerConfig) : null,
        injectionPosition: rawSection.injectionPosition === "depth" ? "depth" : "ordered",
        injectionDepth: firstNumber(rawSection, ["injectionDepth", "depth"]) ?? 0,
        injectionOrder: firstNumber(rawSection, ["injectionOrder", "order", "sortOrder"]) ?? (index + 1) * 100,
        wrapInXml: "false",
        xmlTagName: "",
        forbidOverrides: boolText(firstBoolean(rawSection, ["forbidOverrides"]) ?? false),
      },
    });
  }

  const rawChoiceBlocks = Array.isArray(payload.choiceBlocks)
    ? payload.choiceBlocks
    : Array.isArray(payload.variables)
      ? payload.variables
      : Array.isArray(payload.choices)
        ? payload.choices
        : [];
  for (const [index, rawChoiceBlock] of rawChoiceBlocks.entries()) {
    if (!isRecord(rawChoiceBlock)) continue;
    const rawVariableName =
      firstString(rawChoiceBlock, ["variableName", "variable", "name", "key", "id"]) ?? `variable_${index + 1}`;
    const variableName = normalizePromptVariableName(rawVariableName, `variable_${index + 1}`, usedVariableNames);
    const options = promptOptionRows(
      rawChoiceBlock.options ?? rawChoiceBlock.choices ?? rawChoiceBlock.values ?? rawChoiceBlock.value,
    );
    if (options.length === 0) continue;
    relatedInserts.push({
      table: "choice_blocks",
      row: {
        id: firstString(rawChoiceBlock, ["id", "choiceBlockId"]) ?? newId(),
        presetId,
        variableName,
        question: firstString(rawChoiceBlock, ["question", "prompt", "label", "title"]) ?? variableName,
        options,
        multiSelect: boolText(firstBoolean(rawChoiceBlock, ["multiSelect", "multi"]) ?? false),
        separator: firstString(rawChoiceBlock, ["separator"]) ?? ", ",
        randomPick: boolText(firstBoolean(rawChoiceBlock, ["randomPick", "random"]) ?? false),
        displayMode: ["auto", "buttons", "listbox"].includes(String(rawChoiceBlock.displayMode ?? ""))
          ? String(rawChoiceBlock.displayMode)
          : "auto",
        optionSort: rawChoiceBlock.optionSort === "alphabetical" ? "alphabetical" : "manual",
        sortOrder: firstNumber(rawChoiceBlock, ["sortOrder", "order"]) ?? (index + 1) * 100,
      },
    });
  }

  if (!payload.groupOrder && groupOrder.length > 0) payload.groupOrder = groupOrder;
  if (!payload.sectionOrder && sectionOrder.length > 0) payload.sectionOrder = sectionOrder;
  return relatedInserts;
}

function stripPromptPresetChildPayload(row: Row): Row {
  const out = { ...row };
  delete out.groups;
  delete out.sections;
  delete out.promptSections;
  delete out.choiceBlocks;
  delete out.variables;
  delete out.choices;
  return out;
}

function actionCommandPayload(envelope: MariAppDataActionEnvelope): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(envelope)) {
    if (key === "cwd" || key === "sessionId") continue;
    out[key] = typeof value === "string" && value.length > 600 ? truncateStr(value, 600) : value;
  }
  return out;
}

function formatAppDataActionCommand(action: string, envelope: MariAppDataActionEnvelope): string {
  return `app_data ${action} ${stableJson(actionCommandPayload(envelope))}`;
}

function assignStringField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  const value = firstString(source, sourceKeys);
  if (value === undefined) return false;
  target[targetKey] = value;
  return true;
}

function assignNumberField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  const value = firstNumber(source, sourceKeys);
  if (value === undefined) return false;
  target[targetKey] = value;
  return true;
}

function assignBoundedNumberField(
  target: Row,
  source: Row,
  sourceKeys: string[],
  targetKey: string,
  minimum: number,
  maximum: number,
  integer = true,
): boolean {
  const value = firstNumber(source, sourceKeys);
  if (value === undefined) return false;
  const normalized = integer ? Math.trunc(value) : value;
  target[targetKey] = Math.max(minimum, Math.min(maximum, normalized));
  return true;
}

function assignListField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  const value = firstStringList(source, sourceKeys);
  if (value === undefined) return false;
  target[targetKey] = value;
  return true;
}

function assignBooleanTextField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  const value = firstBoolean(source, sourceKeys);
  if (value === undefined) return false;
  target[targetKey] = value ? "true" : "false";
  return true;
}

function createRequestIdAllocator(request: ParsedMutationRequest): () => string {
  let index = 0;
  return () => {
    request.generatedIds ??= [];
    const existing = request.generatedIds[index];
    if (existing) {
      index += 1;
      return existing;
    }
    const id = newId();
    request.generatedIds.push(id);
    index += 1;
    return id;
  };
}

async function parseJsonInput(flags: Map<string, string | boolean>, cwd?: string) {
  const raw = flagString(flags, "json");
  const file = flagString(flags, "json-file") ?? flagString(flags, "file");
  if (raw && file) throw new Error("Use only one of --json or --json-file");
  if (!raw && !file) throw new Error("Missing --json '<json>' or --json-file <path>");
  const jsonText = file ? await readFile(resolve(cwd ? resolve(cwd) : process.cwd(), file), "utf8") : raw!;
  return parseRequiredJsonObjectInput(jsonText, "JSON input");
}

async function parseCssInput(flags: Map<string, string | boolean>, cwd?: string): Promise<string> {
  const raw = flagString(flags, "css");
  const file = flagString(flags, "css-file") ?? flagString(flags, "file");
  if (raw !== undefined && file) throw new Error("Use only one of --css or --css-file");
  if (raw === undefined && !file) throw new Error("Missing --css '<css>' or --css-file <path>");
  const css = file ? await readFile(resolve(cwd ? resolve(cwd) : process.cwd(), file), "utf8") : raw!;
  return normalizeThemeCss(css);
}

async function resolveJsonInput(flags: Map<string, string | boolean>, cwd?: string): Promise<string | null> {
  const inline = flagString(flags, "json");
  if (inline) return inline;
  const filePath = flagString(flags, "json-file") ?? flagString(flags, "file");
  if (!filePath) return null;
  return readFile(resolve(cwd ? resolve(cwd) : process.cwd(), filePath), "utf8");
}

function truncateStr(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function summarizeCharacterRow(row: Row): Row {
  const data = (tryParseJsonColumn(row, "data") as Record<string, unknown>) ?? {};
  return {
    id: row.id,
    name: typeof data.name === "string" ? data.name : "(unnamed)",
    comment: row.comment ?? "",
    tags: Array.isArray(data.tags) ? data.tags.slice(0, 8) : [],
    avatarPath: row.avatarPath ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function summarizePersonaRow(row: Row): Row {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive === "true",
    comment: row.comment ?? "",
    description: typeof row.description === "string" ? truncateStr(row.description, 120) : "",
    avatarPath: row.avatarPath ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function summarizeLorebookRow(row: Row): Row {
  return {
    id: row.id,
    name: row.name,
    description: typeof row.description === "string" ? truncateStr(row.description, 120) : "",
    category: row.category ?? "uncategorized",
    isGlobal: row.isGlobal === "true",
    enabled: row.enabled !== "false",
    scanDepth: row.scanDepth,
    tokenBudget: row.tokenBudget,
    vectorQueryDepth: row.vectorQueryDepth,
    vectorScoreThreshold: row.vectorScoreThreshold,
    vectorMaxResults: row.vectorMaxResults,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function summarizeLorebookEntryRow(row: Row): Row {
  const parsed = parseRow("lorebook_entries", row);
  return {
    id: parsed.id,
    lorebookId: parsed.lorebookId,
    name: parsed.name,
    description: typeof parsed.description === "string" ? parsed.description : "",
    tag: typeof parsed.tag === "string" ? parsed.tag : "",
    enabled: parsed.enabled,
    constant: parsed.constant,
    keys: parsed.keys,
    content: typeof parsed.content === "string" ? truncateStr(parsed.content, 200) : "",
    order: parsed.order,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

function parseJsonArrayValue(value: unknown): unknown[] {
  const parsed = typeof value === "string" ? parseJsonMaybe(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonRecordValue(value: unknown): Row {
  const parsed = typeof value === "string" ? parseJsonMaybe(value) : value;
  return isRecord(parsed) ? parsed : {};
}

function parsePromptPresetRow(row: Row): Row {
  return {
    ...row,
    sectionOrder: parseJsonArrayValue(row.sectionOrder),
    groupOrder: parseJsonArrayValue(row.groupOrder),
    variableGroups: parseJsonArrayValue(row.variableGroups),
    variableValues: parseJsonRecordValue(row.variableValues),
    parameters: parseJsonRecordValue(row.parameters),
    defaultChoices: parseJsonRecordValue(row.defaultChoices),
    isDefault: row.isDefault === "true",
  };
}

function summarizePromptPresetRow(row: Row): Row {
  const parsed = parsePromptPresetRow(row);
  return {
    id: parsed.id,
    name: parsed.name,
    description: typeof parsed.description === "string" ? truncateStr(parsed.description, 120) : "",
    isDefault: parsed.isDefault,
    author: parsed.author ?? "",
    sectionCount: Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder.length : 0,
    groupCount: Array.isArray(parsed.groupOrder) ? parsed.groupOrder.length : 0,
    choiceDefaults: Object.keys(parseJsonRecordValue(row.defaultChoices)).length,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

function summarizeAgentConfigRow(row: Row): Row {
  const settings = parseJsonRecordValue(row.settings);
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: typeof row.description === "string" ? truncateStr(row.description, 120) : "",
    phase: row.phase,
    enabled: row.enabled !== "false",
    connectionId: row.connectionId ?? null,
    imagePath: row.imagePath ?? null,
    promptTemplate: typeof row.promptTemplate === "string" ? truncateStr(row.promptTemplate, 160) : "",
    resultType: typeof settings.resultType === "string" ? settings.resultType : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function summarizeChatRow(row: Row): Row {
  const charIds = tryParseJsonColumn(row, "characterIds");
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    characterIds: Array.isArray(charIds) ? charIds.slice(0, 4) : [],
    personaId: row.personaId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const CHARACTER_DATA_HINT_KEYS = new Set([
  "name",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "system_prompt",
  "post_history_instructions",
  "tags",
  "creator",
  "character_version",
  "alternate_greetings",
  "extensions",
  "character_book",
]);

function hasOwnKey(value: Row, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function looksLikeCharacterData(value: Row): boolean {
  return Array.from(CHARACTER_DATA_HINT_KEYS).some((key) => hasOwnKey(value, key));
}

function looksLikeCharacterRowInput(value: Row): boolean {
  return isRecord(value.data) || (typeof value.data === "string" && ["id", "comment", "avatarPath", "spriteFolderPath", "createdAt", "updatedAt"].some((key) => hasOwnKey(value, key)));
}

function normalizeCharacterDataBase(base: Record<string, unknown>): Record<string, unknown> {
  const parsedData = typeof base.data === "string" && looksLikeCharacterRowInput(base) ? parseJsonMaybe(base.data) : null;
  const source =
    isRecord(base.data) &&
    (typeof base.spec === "string" ||
      typeof base.spec_version === "string" ||
      looksLikeCharacterRowInput(base) ||
      !looksLikeCharacterData(base))
      ? (base.data as Record<string, unknown>)
      : isRecord(parsedData)
        ? parsedData
        : base;
  const data = { ...source };
  delete data.spec;
  delete data.spec_version;
  for (const key of Object.keys(data)) {
    if (/^\d+$/.test(key)) delete data[key];
  }
  return data;
}

function parseCharacterDataJsonInput(rawJson: string, label: string): Row {
  const data = normalizeCharacterDataBase(parseRequiredJsonObjectInput(rawJson, label));
  if (!looksLikeCharacterData(data)) {
    throw new Error(
      `${label} must contain a CharacterData card object, such as {"name":"...","description":"..."}. Do not pass a raw table export or tables/characters.json to mari characters.`,
    );
  }
  return data;
}

function addUnknownColumnIssues(meta: TableMeta, row: Row, id: unknown, issues: MariDbValidationIssue[]) {
  const unknownKeys = Object.keys(row).filter((key) => !meta.byKey.has(key));
  if (unknownKeys.length === 0) return;
  const issueId = id == null ? null : String(id);
  const hint = meta.name === "characters" && unknownKeys.some((key) => key === "appearance" || key === "backstory")
    ? " Use mari characters update --appearance/--backstory, or patch data.extensions.appearance/backstory."
    : " Check `mari db schema <table>` and nest JSON-column edits under the JSON column name.";
  issues.push({
    level: "error",
    table: meta.name,
    id: issueId,
    message: `Unknown column(s): ${unknownKeys.slice(0, 8).join(", ")}.${hint}`,
  });
}

function addCharacterDataShapeIssues(tableName: string, row: Row, id: unknown, issues: MariDbValidationIssue[]) {
  if (tableName !== "characters") return;
  const card = tryParseJsonColumn(row, "data");
  const issueId = id == null ? null : String(id);
  if (!isRecord(card)) {
    issues.push({ level: "error", table: tableName, id: issueId, message: "Character data does not look like a CharacterData card" });
    return;
  }
  if (typeof card.name !== "string") {
    issues.push({ level: "error", table: tableName, id: issueId, message: "Character data does not look like a CharacterData card" });
  }
  const numericKeys = Object.keys(card).filter((key) => /^\d+$/.test(key));
  if (numericKeys.length > 0) {
    issues.push({
      level: "error",
      table: tableName,
      id: issueId,
      message: `Character data contains numeric keys (${numericKeys.slice(0, 5).join(", ")}) from a table-array merge; repair it with a single CharacterData object, not tables/characters.json.`,
    });
  }
}

function buildMinimalCharacterData(
  name: string,
  base: Record<string, unknown>,
  flags: Map<string, string | boolean>,
): Record<string, unknown> {
  const normalizedBase = normalizeCharacterDataBase(base);
  const baseExtensions = isRecord(normalizedBase.extensions)
    ? (normalizedBase.extensions as Record<string, unknown>)
    : {};
  const data: Record<string, unknown> = {
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    creator_notes: "",
    character_version: "",
    alternate_greetings: [],
    post_history_instructions: "",
    system_prompt: "",
    tags: [],
    ...normalizedBase,
    name,
    extensions: { ...baseExtensions },
  };
  const topLevelMap: Array<[string, string]> = [
    ["description", "description"],
    ["personality", "personality"],
    ["scenario", "scenario"],
    ["first-mes", "first_mes"],
    ["greeting", "first_mes"],
    ["creator-notes", "creator_notes"],
  ];
  for (const [flagName, fieldName] of topLevelMap) {
    const val = flagString(flags, flagName);
    if (val !== undefined) data[fieldName] = val;
  }
  // backstory and appearance are Marinara extensions stored under data.extensions.*
  const extensions = data.extensions as Record<string, unknown>;
  const extMap: Array<[string, string]> = [
    ["backstory", "backstory"],
    ["appearance", "appearance"],
    ["about-me", "aboutMe"],
  ];
  for (const [flagName, fieldName] of extMap) {
    const val = flagString(flags, flagName);
    if (val !== undefined) extensions[fieldName] = val;
  }
  const tagsVal = flagString(flags, "tags");
  if (tagsVal !== undefined) {
    data.tags = tagsVal
      ? tagsVal.split(/[,|]/).map((t: string) => t.trim()).filter(Boolean)
      : [];
  }
  return data;
}

function createWherePredicate(expr: string | undefined): (row: Row) => boolean {
  if (!expr) return () => true;
  const fn = new Function("row", `return Boolean(${expr});`) as (row: Row) => boolean;
  return (row: Row) => {
    try {
      return Boolean(fn(row));
    } catch {
      return false;
    }
  };
}

async function importTransform(path: string): Promise<(row: Row, ctx: TransformContext) => unknown> {
  const url = pathToFileURL(path).href + `?mariDb=${Date.now()}`;
  const mod = (await import(url)) as { default?: unknown; transform?: unknown };
  const fn = mod.default ?? mod.transform;
  if (typeof fn !== "function") throw new Error(`Transform ${path} must export a default function`);
  return fn as (row: Row, ctx: TransformContext) => unknown;
}

type TransformContext = {
  table: string;
  now: string;
  newId: () => string;
  raw: (row: Row) => Row;
  parse: (row: Row) => Row;
  find: (table: string, predicate: (row: Row) => boolean) => Row[];
};

export class MariDbService {
  private pending = new Map<string, PendingRecord>();
  private history: MariDbHistoryEntry[] = [];
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: DB) {}

  async executeCli(envelope: MariCliEnvelope): Promise<MariDbCommandResult> {
    const argv = envelope.argv ?? [];
    const command = formatCommand(argv, envelope.command);
    const sessionId = envelope.sessionId || "mari-cli";
    try {
      const group = argv[0];
      if (!group || group === "help" || group === "--help" || group === "-h") {
        return { ok: true, mode: "read", command, output: this.topLevelHelpText() };
      }
      if (group === "code") {
        return await this.executeCodeCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "theme" || group === "themes") {
        return await this.executeThemeCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "image" || group === "images" || group === "media") {
        return await getMariImagesService(this.db).execute(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "wiki" || group === "fandom") {
        return await executeWikiCli(argv.slice(1), { command });
      }
      if (group === "character" || group === "characters") {
        return await this.executeCharactersCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "persona" || group === "personas") {
        return await this.executePersonasCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "lorebook" || group === "lorebooks") {
        return await this.executeLorebooksCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group === "chat" || group === "chats") {
        return await this.executeChatsCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
      }
      if (group !== "db") {
        if (group === "storage") {
          return {
            ok: false,
            mode: "read",
            command,
            error: "mari storage tx is reserved for a later hot-reload repair phase; use mari db for managed data edits.",
          };
        }
        return { ok: false, mode: "read", command, error: this.topLevelHelpText() };
      }
      return await this.executeDbCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
    } catch (err) {
      logger.warn(err, "[mari-db] command failed");
      return { ok: false, mode: "read", command, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async executeAction(envelope: MariAppDataActionEnvelope): Promise<MariDbCommandResult> {
    let command = "app_data";
    try {
      const action = requiredString(envelope, ["action", "type"], "app_data action");
      command = formatAppDataActionCommand(action, envelope);
      const context = {
        command,
        sessionId: typeof envelope.sessionId === "string" && envelope.sessionId.trim() ? envelope.sessionId.trim() : "mari-app-data",
        cwd: typeof envelope.cwd === "string" ? envelope.cwd : undefined,
      };
      const key = normalizeAppDataActionName(action);
      if (key.startsWith("character.")) return await this.executeCharacterAction(key.slice("character.".length), envelope, context);
      if (key.startsWith("persona.")) return await this.executePersonaAction(key.slice("persona.".length), envelope, context);
      if (key.startsWith("lorebook.")) return await this.executeLorebookAction(key.slice("lorebook.".length), envelope, context);
      if (key.startsWith("theme.")) return await this.executeThemeAction(key.slice("theme.".length), envelope, context);
      if (key.startsWith("agent.")) return await this.executeAgentAction(key.slice("agent.".length), envelope, context);
      if (key.startsWith("preset.")) return await this.executePresetAction(key.slice("preset.".length), envelope, context);
      return {
        ok: false,
        mode: "read",
        command,
        error:
          "Unsupported app_data action. Use character.*, persona.*, lorebook.*, theme.*, agent.*, or preset.* actions for structured no-shell app-data work.",
      };
    } catch (err) {
      logger.warn(err, "[mari-db] structured app_data action failed");
      return { ok: false, mode: "read", command, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async executeCharacterAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const search = firstString(args, ["search", "query"])?.toLowerCase();
        const rows = (await this.rawRows("characters")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        const summaries = rows
          .map(summarizeCharacterRow)
          .filter((summary) => !search || JSON.stringify(summary).toLowerCase().includes(search));
        return { ok: true, mode: "read", command: context.command, output: summaries.slice(0, limit) };
      }
      case "get": {
        const id = requiredString(args, ["id", "characterId"], "character id");
        const row = await this.getRawById(getMeta("characters"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow("characters", row) : null };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "character search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("characters"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarizeCharacterRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const data = normalizeCharacterActionData(
          actionDataWithTopLevel(args, ["data", "card", "character"], [
            "name",
            "description",
            "personality",
            "scenario",
            "first_mes",
            "firstMes",
            "mes_example",
            "creator_notes",
            "creatorNotes",
            "backstory",
            "appearance",
            "aboutMe",
            "about_me",
            "about-me",
            "tags",
            "comment",
          ]),
        );
        const name = requiredString(data, ["name"], "character name");
        const comment = firstString(data, ["comment"]) ?? "";
        delete data.comment;
        const timestamp = now();
        const id = firstString(args, ["id", "characterId"]) ?? newId();
        const row: Row = {
          id,
          data: buildMinimalCharacterData(name, data, new Map()),
          comment,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        return this.executeMutation(
          {
            kind: "insert",
            table: "characters",
            id,
            row,
            apply: appDataCreateApply(args),
            requiresApproval: false,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "update": {
        const id = requiredString(args, ["id", "characterId"], "character id");
        const existing = await this.getRawById(getMeta("characters"), id);
        if (!existing) throw new Error(`Character ${id} not found`);
        const existingDataRaw = tryParseJsonColumn(existing, "data");
        const existingData = isRecord(existingDataRaw) ? existingDataRaw : {};
        const patchData = normalizeCharacterActionData(
          actionDataWithTopLevel(args, ["patch", "data", "card", "character"], [
            "name",
            "description",
            "personality",
            "scenario",
            "first_mes",
            "firstMes",
            "mes_example",
            "creator_notes",
            "creatorNotes",
            "backstory",
            "appearance",
            "aboutMe",
            "about_me",
            "about-me",
            "tags",
            "comment",
          ]),
        );
        const comment = firstString(patchData, ["comment"]) ?? (typeof existing.comment === "string" ? existing.comment : "");
        delete patchData.comment;
        if (Object.keys(patchData).length === 0 && comment === (typeof existing.comment === "string" ? existing.comment : "")) {
          throw new Error("character.update needs a patch field such as name, description, personality, scenario, firstMes, creatorNotes, backstory, appearance, aboutMe, tags, or comment");
        }
        const name = firstString(patchData, ["name"]) ?? (typeof existingData.name === "string" ? existingData.name : "");
        const row: Row = {
          id,
          data: buildMinimalCharacterData(name, deepMerge(existingData, patchData) as Row, new Map()),
          comment,
          avatarPath: existing.avatarPath ?? null,
          spriteFolderPath: existing.spriteFolderPath ?? null,
          createdAt: existing.createdAt,
          updatedAt: now(),
        };
        return this.executeMutation(
          {
            kind: "replace",
            table: "characters",
            id,
            row,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported character app_data action." };
    }
  }

  private async executePersonaAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("personas")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizePersonaRow) };
      }
      case "active": {
        const row = (await this.rawRows("personas")).find((candidate) => candidate.isActive === "true") ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "get": {
        const id = requiredString(args, ["id", "personaId"], "persona id");
        const row = await this.getRawById(getMeta("personas"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "persona search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("personas"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarizePersonaRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const data = actionDataWithTopLevel(args, ["data", "persona", "row"], [
          "name",
          "description",
          "personality",
          "scenario",
          "backstory",
          "appearance",
          "comment",
          "creator",
          "creatorNotes",
          "creator_notes",
          "tags",
          "phoneticName",
          "phonetic_name",
          "convoDisplayName",
          "convo_display_name",
          "aboutMe",
          "about_me",
          "convoBehavior",
          "convo_behavior",
        ]);
        const timestamp = now();
        const id = firstString(args, ["id", "personaId"]) ?? newId();
        const row = buildPersonaCreateRow(data, id, timestamp);
        return this.executeMutation(
          {
            kind: "insert",
            table: "personas",
            id,
            row,
            apply: appDataCreateApply(args),
            requiresApproval: false,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "update": {
        const id = requiredString(args, ["id", "personaId"], "persona id");
        const data = actionDataWithTopLevel(args, ["patch", "data", "persona"], [
          "name",
          "description",
          "personality",
          "scenario",
          "backstory",
          "appearance",
          "comment",
          "creator",
          "creatorNotes",
          "creator_notes",
          "tags",
          "phoneticName",
          "phonetic_name",
          "convoDisplayName",
          "convo_display_name",
          "aboutMe",
          "about_me",
          "convoBehavior",
          "convo_behavior",
        ]);
        const patch: Row = { updatedAt: now() };
        assignStringField(patch, data, ["name"], "name");
        assignStringField(patch, data, ["description"], "description");
        assignStringField(patch, data, ["personality"], "personality");
        assignStringField(patch, data, ["scenario"], "scenario");
        assignStringField(patch, data, ["backstory"], "backstory");
        assignStringField(patch, data, ["appearance"], "appearance");
        assignStringField(patch, data, ["comment"], "comment");
        assignStringField(patch, data, ["creator"], "creator");
        assignStringField(patch, data, ["creatorNotes", "creator_notes", "creator-notes"], "creatorNotes");
        assignStringField(patch, data, ["phoneticName", "phonetic_name", "phonetic-name"], "phoneticName");
        assignStringField(
          patch,
          data,
          ["convoDisplayName", "convo_display_name", "convo-display-name"],
          "convoDisplayName",
        );
        assignStringField(patch, data, ["aboutMe", "about_me", "about-me"], "aboutMe");
        if (data.convoBehavior !== undefined || data.convo_behavior !== undefined || data["convo-behavior"] !== undefined) {
          patch.convoBehavior = normalizePersonaConvoBehavior(
            data.convoBehavior ?? data.convo_behavior ?? data["convo-behavior"],
          );
        }
        assignListField(patch, data, ["tags"], "tags");
        if (Object.keys(patch).length <= 1) {
          throw new Error("persona.update needs a patch field such as name, description, personality, scenario, backstory, appearance, tags, comment, creator, or creatorNotes");
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "personas",
            id,
            patch,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported persona app_data action." };
    }
  }

  private assignLorebookActionFields(target: Row, source: Row): boolean {
    let changed = false;
    changed = assignStringField(target, source, ["name"], "name") || changed;
    changed = assignStringField(target, source, ["description"], "description") || changed;
    const category = firstString(source, ["category"]);
    if (category !== undefined) {
      target.category = normalizeLorebookCategory(category);
      changed = true;
    }
    changed = assignListField(target, source, ["tags"], "tags") || changed;
    changed = assignBooleanTextField(target, source, ["isGlobal", "global"], "isGlobal") || changed;
    changed = assignBooleanTextField(target, source, ["enabled"], "enabled") || changed;
    if (firstBoolean(source, ["enable"]) === true) {
      target.enabled = "true";
      changed = true;
    }
    if (firstBoolean(source, ["disable"]) === true) {
      target.enabled = "false";
      changed = true;
    }
    changed =
      assignBoundedNumberField(target, source, ["scanDepth", "scan_depth"], "scanDepth", 0, Number.MAX_SAFE_INTEGER) ||
      changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["tokenBudget", "token_budget"],
        "tokenBudget",
        0,
        Number.MAX_SAFE_INTEGER,
      ) || changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["entryLimit", "entry_limit"],
        "entryLimit",
        LIMITS.LOREBOOK_ENTRY_LIMIT_MIN,
        LIMITS.LOREBOOK_ENTRY_LIMIT_MAX,
      ) || changed;
    changed = assignBooleanTextField(target, source, ["recursiveScanning", "recursive"], "recursiveScanning") || changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["maxRecursionDepth", "max_recursion_depth"],
        "maxRecursionDepth",
        1,
        10,
      ) || changed;
    changed = assignBooleanTextField(target, source, ["excludeFromVectorization", "vectorsDisabled"], "excludeFromVectorization") || changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["vectorQueryDepth", "vector_query_depth"],
        "vectorQueryDepth",
        0,
        LIMITS.LOREBOOK_VECTOR_QUERY_DEPTH_MAX,
      ) || changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["vectorScoreThreshold", "vector_score_threshold"],
        "vectorScoreThreshold",
        0,
        1,
        false,
      ) ||
      changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["vectorMaxResults", "vector_max_results"],
        "vectorMaxResults",
        LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MIN,
        LIMITS.LOREBOOK_VECTOR_MAX_RESULTS_MAX,
      ) || changed;
    if (isRecord(source.scope)) {
      target.scope = clone(source.scope);
      changed = true;
    }
    return changed;
  }

  private assignLorebookEntryActionFields(target: Row, source: Row): boolean {
    let changed = false;
    changed = assignStringField(target, source, ["name"], "name") || changed;
    changed = assignStringField(target, source, ["content"], "content") || changed;
    changed = assignStringField(target, source, ["description"], "description") || changed;
    changed = assignStringField(target, source, ["tag"], "tag") || changed;
    changed = assignListField(target, source, ["keys"], "keys") || changed;
    changed = assignListField(target, source, ["secondaryKeys", "secondary_keys"], "secondaryKeys") || changed;
    changed = assignBooleanTextField(target, source, ["enabled"], "enabled") || changed;
    if (firstBoolean(source, ["enable"]) === true) {
      target.enabled = "true";
      changed = true;
    }
    if (firstBoolean(source, ["disable"]) === true) {
      target.enabled = "false";
      changed = true;
    }
    changed = assignBooleanTextField(target, source, ["constant"], "constant") || changed;
    changed = assignNumberField(target, source, ["order"], "order") || changed;
    changed = assignNumberField(target, source, ["position"], "position") || changed;
    changed = assignNumberField(target, source, ["depth"], "depth") || changed;
    changed = assignStringField(target, source, ["role"], "role") || changed;
    changed = assignStringField(target, source, ["group"], "group") || changed;
    return changed;
  }

  private async executeLorebookAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const globalOnly = firstBoolean(args, ["global", "isGlobal"]) === true;
        const rows = (await this.rawRows("lorebooks"))
          .filter((row) => !globalOnly || row.isGlobal === "true")
          .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizeLorebookRow) };
      }
      case "get": {
        const id = requiredString(args, ["id", "lorebookId"], "lorebook id");
        const row = await this.getRawById(getMeta("lorebooks"), id);
        if (!row) return { ok: false, mode: "read", command: context.command, output: null };
        const entryCount = (await this.rawRows("lorebook_entries")).filter((entry) => entry.lorebookId === id).length;
        return { ok: true, mode: "read", command: context.command, output: { ...parseRow("lorebooks", row), entryCount } };
      }
      case "entries": {
        const lorebookId = requiredString(args, ["lorebookId", "id"], "lorebook id");
        const entryId = firstString(args, ["entryId"]);
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 100, 2000);
        const entries = (await this.rawRows("lorebook_entries"))
          .filter((entry) => entry.lorebookId === lorebookId)
          .filter((entry) => !entryId || entry.id === entryId)
          .sort((a, b) => Number(a.order ?? 100) - Number(b.order ?? 100))
          .slice(0, limit)
          .map(summarizeLorebookEntryRow);
        return { ok: true, mode: "read", command: context.command, output: entries };
      }
      case "getentry": {
        const entryId = requiredString(args, ["entryId", "id"], "lorebook entry id");
        const row = await this.getRawById(getMeta("lorebook_entries"), entryId);
        return {
          ok: !!row,
          mode: "read",
          command: context.command,
          output: row ? parseRow("lorebook_entries", row) : null,
        };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "lorebook search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("lorebooks"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarizeLorebookRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const data = actionDataWithTopLevel(args, ["data", "lorebook", "row"], [
          "name",
          "description",
          "category",
          "tags",
          "global",
          "isGlobal",
          "enabled",
          "scanDepth",
          "tokenBudget",
          "entryLimit",
          "recursiveScanning",
          "recursive",
          "maxRecursionDepth",
          "excludeFromVectorization",
          "vectorQueryDepth",
          "vectorScoreThreshold",
          "vectorMaxResults",
          "scope",
          "entries",
        ]);
        const name = requiredString(data, ["name"], "lorebook name");
        const timestamp = now();
        const id = firstString(args, ["id", "lorebookId"]) ?? newId();
        const row: Row = {
          id,
          name,
          description: "",
          category: "uncategorized",
          isGlobal: "false",
          enabled: "true",
          scanDepth: 2,
          tokenBudget: 2048,
          entryLimit: 100,
          recursiveScanning: "false",
          maxRecursionDepth: 3,
          excludeFromVectorization: "false",
          vectorQueryDepth: 10,
          vectorScoreThreshold: 0.3,
          vectorMaxResults: 10,
          scope: { mode: "all", chatIds: [] },
          tags: [],
          generatedBy: "agent",
          sourceAgentId: PROFESSOR_MARI_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        this.assignLorebookActionFields(row, data);
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const relatedInserts = entries.map((entry, index) => {
          if (!isRecord(entry)) throw new Error(`lorebook entry ${index + 1} must be an object`);
          return {
            table: "lorebook_entries",
            row: buildLorebookEntryCreateRow(entry, id, newId(), timestamp, (index + 1) * 100),
          };
        });
        return this.executeMutation(
          {
            kind: "insert",
            table: "lorebooks",
            id,
            row,
            apply: appDataCreateApply(args),
            requiresApproval: false,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
            relatedInserts,
          },
          context.command,
          context.sessionId,
        );
      }
      case "update": {
        const id = requiredString(args, ["id", "lorebookId"], "lorebook id");
        const data = actionDataWithTopLevel(args, ["patch", "data", "lorebook"], [
          "name",
          "description",
          "category",
          "tags",
          "global",
          "isGlobal",
          "enabled",
          "enable",
          "disable",
          "scanDepth",
          "tokenBudget",
          "entryLimit",
          "recursiveScanning",
          "recursive",
          "maxRecursionDepth",
          "excludeFromVectorization",
          "vectorQueryDepth",
          "vectorScoreThreshold",
          "vectorMaxResults",
          "scope",
        ]);
        const patch: Row = { updatedAt: now() };
        this.assignLorebookActionFields(patch, data);
        if (Object.keys(patch).length <= 1) {
          throw new Error("lorebook.update needs a patch field such as name, description, category, tags, enabled, global, scanDepth, tokenBudget, entryLimit, recursiveScanning, excludeFromVectorization, vectorQueryDepth, vectorScoreThreshold, or vectorMaxResults");
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "lorebooks",
            id,
            patch,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "addentry":
      case "createentry": {
        const lorebookId = requiredString(args, ["lorebookId"], "lorebook id");
        const lorebookExists = await this.getRawById(getMeta("lorebooks"), lorebookId);
        if (!lorebookExists) throw new Error(`Lorebook ${lorebookId} not found`);
        const data = actionDataWithTopLevel(args, ["data", "entry", "row"], [
          "name",
          "content",
          "description",
          "tag",
          "keys",
          "secondaryKeys",
          "enabled",
          "constant",
          "order",
          "position",
          "depth",
          "role",
          "group",
        ]);
        const timestamp = now();
        const id = firstString(args, ["entryId", "id"]) ?? newId();
        const row = buildLorebookEntryCreateRow(data, lorebookId, id, timestamp);
        this.assignLorebookEntryActionFields(row, data);
        return this.executeMutation(
          {
            kind: "insert",
            table: "lorebook_entries",
            id,
            row,
            apply: appDataCreateApply(args),
            requiresApproval: false,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "updateentry": {
        const entryId = requiredString(args, ["entryId", "id"], "lorebook entry id");
        const entryExists = await this.getRawById(getMeta("lorebook_entries"), entryId);
        if (!entryExists) throw new Error(`Lorebook entry ${entryId} not found`);
        const data = actionDataWithTopLevel(args, ["patch", "data", "entry"], [
          "name",
          "content",
          "description",
          "tag",
          "keys",
          "secondaryKeys",
          "enabled",
          "enable",
          "disable",
          "constant",
          "order",
          "position",
          "depth",
          "role",
          "group",
        ]);
        const patch: Row = { updatedAt: now() };
        this.assignLorebookEntryActionFields(patch, data);
        if (Object.keys(patch).length <= 1) {
          throw new Error("lorebook.updateEntry needs entryId plus a patch field such as name, content, keys, description, enabled, constant, or order");
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "lorebook_entries",
            id: entryId,
            patch,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported lorebook app_data action." };
    }
  }

  private async executeThemeAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const activeOnly = firstBoolean(args, ["active"]) === true;
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows(THEME_TABLE))
          .filter((row) => !activeOnly || row.isActive === THEME_ACTIVE_TRUE)
          .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizeThemeRow) };
      }
      case "active": {
        const row = (await this.rawRows(THEME_TABLE)).find((candidate) => candidate.isActive === THEME_ACTIVE_TRUE) ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "get": {
        const id = requiredString(args, ["id", "themeId"], "theme id");
        const row = await this.getRawById(getMeta(THEME_TABLE), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "create": {
        const data = actionDataWithTopLevel(args, ["data", "theme", "row"], ["name", "css", "activate", "active", "installedAt"]);
        const id = firstString(args, ["id", "themeId"]) ?? newId();
        const activate = firstBoolean(data, ["activate", "active"]) === true;
        const request: ParsedMutationRequest = {
          kind: "theme-create",
          table: THEME_TABLE,
          id,
          name: requiredString(data, ["name"], "theme name"),
          css: requiredString(data, ["css"], "theme css"),
          installedAt: firstString(data, ["installedAt", "installed_at"]) ?? now(),
          activate,
          apply: appDataCreateApply(args),
          requiresApproval: activate ? undefined : false,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const data = actionDataWithTopLevel(args, ["patch", "data", "theme"], ["name", "css"]);
        const request: ParsedMutationRequest = {
          kind: "theme-update",
          table: THEME_TABLE,
          id: requiredString(args, ["id", "themeId"], "theme id"),
          name: firstString(data, ["name"]),
          css: firstString(data, ["css"]),
          apply: firstBoolean(args, ["apply"]) === true,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
        };
        if (request.name === undefined && request.css === undefined) throw new Error("theme.update needs a patch with name or css");
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "setactive": {
        const rawId = firstString(args, ["id", "themeId"]);
        const id = rawId && !["default", "none", "null", "off"].includes(rawId.toLowerCase()) ? rawId : undefined;
        const request: ParsedMutationRequest = {
          kind: "theme-set-active",
          table: THEME_TABLE,
          id,
          apply: firstBoolean(args, ["apply"]) === true,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported theme app_data action." };
    }
  }

  private async executeAgentAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const search = firstString(args, ["search", "query"])?.toLowerCase();
        const rows = (await this.rawRows("agent_configs")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        const summaries = rows
          .map(summarizeAgentConfigRow)
          .filter((summary) => !search || JSON.stringify(summary).toLowerCase().includes(search));
        return { ok: true, mode: "read", command: context.command, output: summaries.slice(0, limit) };
      }
      case "get": {
        const id = requiredString(args, ["id", "agentId", "agentConfigId"], "agent id");
        const row = await this.getRawById(getMeta("agent_configs"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow("agent_configs", row) : null };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "agent search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("agent_configs"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarizeAgentConfigRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const data = normalizeAgentActionData(
          actionDataWithTopLevel(args, ["data", "agent", "row"], [
            "type",
            "agentType",
            "name",
            "description",
            "phase",
            "enabled",
            "connectionId",
            "imagePath",
            "promptTemplate",
            "prompt",
            "settings",
            "resultType",
          ]),
        );
        requiredString(data, ["name"], "agent name");
        requiredString(data, ["type"], "agent type");
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "agent_configs",
          row: data,
          apply: appDataCreateApply(args),
          requiresApproval: false,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = requiredString(args, ["id", "agentId", "agentConfigId"], "agent id");
        const existing = await this.requireRawById(getMeta("agent_configs"), id);
        const data = normalizeAgentActionData(
          actionDataWithTopLevel(args, ["patch", "data", "agent"], [
            "type",
            "agentType",
            "name",
            "description",
            "phase",
            "enabled",
            "connectionId",
            "imagePath",
            "promptTemplate",
            "prompt",
            "settings",
            "resultType",
          ]),
          parseRow("agent_configs", existing),
        );
        delete data.id;
        const request: ParsedMutationRequest = {
          kind: "patch",
          table: "agent_configs",
          id,
          patch: data,
          apply: firstBoolean(args, ["apply"]) === true,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported agent app_data action." };
    }
  }

  private async executePresetAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const search = firstString(args, ["search", "query"])?.toLowerCase();
        const rows = (await this.rawRows("prompt_presets")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        const summaries = rows
          .map(summarizePromptPresetRow)
          .filter((summary) => !search || JSON.stringify(summary).toLowerCase().includes(search));
        return { ok: true, mode: "read", command: context.command, output: summaries.slice(0, limit) };
      }
      case "get": {
        const id = requiredString(args, ["id", "presetId", "promptPresetId"], "prompt preset id");
        const row = await this.getRawById(getMeta("prompt_presets"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parsePromptPresetRow(row) : null };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "prompt preset search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows("prompt_presets"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarizePromptPresetRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const payload = actionDataWithTopLevel(args, ["data", "preset", "promptPreset", "row"], [
          "name",
          "description",
          "conversationPrompt",
          "gamePrompt",
          "sectionOrder",
          "groupOrder",
          "variableGroups",
          "variableValues",
          "parameters",
          "wrapFormat",
          "defaultChoices",
          "isDefault",
          "author",
          "groups",
          "sections",
          "promptSections",
          "choiceBlocks",
          "variables",
          "choices",
        ]);
        const presetId = firstString(payload, ["id", "presetId", "promptPresetId"]) ?? newId();
        payload.id = presetId;
        const relatedInserts = normalizePromptPresetChildInserts(payload, presetId);
        const data = normalizePromptPresetActionData(stripPromptPresetChildPayload(payload));
        requiredString(data, ["name"], "prompt preset name");
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "prompt_presets",
          row: data,
          apply: appDataCreateApply(args),
          requiresApproval: false,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
          relatedInserts,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = requiredString(args, ["id", "presetId", "promptPresetId"], "prompt preset id");
        const existing = await this.requireRawById(getMeta("prompt_presets"), id);
        const payload = actionDataWithTopLevel(args, ["patch", "data", "preset", "promptPreset"], [
          "name",
          "description",
          "conversationPrompt",
          "gamePrompt",
          "sectionOrder",
          "groupOrder",
          "variableGroups",
          "variableValues",
          "parameters",
          "wrapFormat",
          "defaultChoices",
          "isDefault",
          "author",
          "groups",
          "sections",
          "promptSections",
          "choiceBlocks",
          "variables",
          "choices",
        ]);
        const relatedInserts = normalizePromptPresetChildInserts(payload, id);
        const data = normalizePromptPresetActionData(stripPromptPresetChildPayload(payload), existing);
        delete data.id;
        const request: ParsedMutationRequest = {
          kind: "patch",
          table: "prompt_presets",
          id,
          patch: data,
          apply: firstBoolean(args, ["apply"]) === true,
          cascade: false,
          reason: firstString(args, ["reason"]) ?? null,
          cwd: context.cwd,
          relatedInserts,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported prompt preset app_data action." };
    }
  }

  getPendingApprovals(): MariDbPendingApproval[] {
    return Array.from(this.pending.values()).map((record) => this.pendingView(record));
  }

  async getHistory(): Promise<MariDbHistoryEntry[]> {
    if (this.history.length > 0) return this.history.slice(-HISTORY_LIMIT).reverse();
    const path = this.historyPath();
    if (!existsSync(path)) return [];
    try {
      const content = await readFile(path, "utf8");
      const rows = content
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(-HISTORY_LIMIT)
        .map((line) => JSON.parse(line) as MariDbHistoryEntry)
        .reverse();
      return rows;
    } catch (err) {
      logger.warn(err, "[mari-db] failed to read history");
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    await mkdir(this.journalDir(), { recursive: true });
    await writeFile(this.historyPath(), "", "utf8");
  }

  async keepAppliedReviewAndWait(id: string): Promise<{ approval: MariDbPendingApproval; history: MariDbHistoryEntry | null; completed: boolean } | null> {
    const record = this.pending.get(id);
    if (!record) return null;
    const approval = this.pendingView(record);
    const history = await this.keepAppliedReview(id);
    return { approval, history, completed: true };
  }

  async keepAppliedReview(id: string): Promise<MariDbHistoryEntry | null> {
    const record = this.pending.get(id);
    if (!record) return null;
    clearTimeout(record.timer);
    this.pending.delete(id);
    const history = await this.recordHistory({
      plan: record.plan,
      command: record.command,
      sessionId: record.sessionId,
      status: "kept",
      journalPath: record.journalPath,
    });
    return history;
  }

  async restoreAppliedReview(id: string): Promise<{ approval: MariDbPendingApproval; history: MariDbHistoryEntry } | null> {
    const record = this.pending.get(id);
    if (!record) return null;
    const approval = this.pendingView(record);
    clearTimeout(record.timer);
    this.pending.delete(id);
    await this.restorePlan(record.plan);
    const history = await this.recordHistory({
      plan: record.plan,
      command: record.command,
      sessionId: record.sessionId,
      status: "restored",
      journalPath: record.journalPath,
    });
    return { approval, history };
  }

  async validate(table?: string | null): Promise<MariDbValidationResult> {
    const tables = table ? [table] : [...FILE_BACKED_TABLES];
    const issues: MariDbValidationIssue[] = [];
    const rowCache = new Map<string, Row[]>();

    for (const tableName of tables) {
      const meta = getMeta(tableName);
      const rows = await this.rawRows(tableName);
      rowCache.set(tableName, rows);
      const pk = meta.primaryKey;
      if (!pk) {
        issues.push({ level: "error", table: tableName, message: "Table has no primary key metadata" });
        continue;
      }
      const ids = new Set<string>();
      for (const row of rows) {
        const id = row[pk];
        if (typeof id !== "string" || id.trim().length === 0) {
          issues.push({ level: "error", table: tableName, id: id == null ? null : String(id), message: `Missing primary key ${pk}` });
        } else if (ids.has(id)) {
          issues.push({ level: "error", table: tableName, id, message: `Duplicate primary key ${pk}=${id}` });
        } else {
          ids.add(id);
        }
        for (const column of meta.columns) {
          if (column.notNull && (row[column.key] === null || row[column.key] === undefined)) {
            issues.push({ level: "error", table: tableName, id: id == null ? null : String(id), message: `Missing required column ${column.key}` });
          }
        }
        for (const key of JSON_COLUMNS[tableName] ?? []) {
          if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
          const value = row[key];
          if (value === null || value === undefined || value === "") continue;
          if (typeof value !== "string") continue;
          try {
            JSON.parse(value);
          } catch {
            issues.push({ level: "error", table: tableName, id: id == null ? null : String(id), message: `Column ${key} is not valid JSON` });
          }
        }
        addCharacterDataShapeIssues(tableName, row, id, issues);
        if (tableName === "agent_configs") {
          this.validateAgentConfigRow(row, id, issues);
        }
        if (tableName === "custom_tools") {
          this.validateCustomToolRow(row, id, issues);
        }
      }
    }

    const getRows = async (tableName: string) => {
      const cached = rowCache.get(tableName);
      if (cached) return cached;
      const rows = await this.rawRows(tableName);
      rowCache.set(tableName, rows);
      return rows;
    };

    for (const cascade of CASCADES) {
      if (table && table !== cascade.child && table !== cascade.parent) continue;
      const parents = new Set((await getRows(cascade.parent)).map((row) => row[cascade.parentKey]).filter((id) => typeof id === "string"));
      for (const child of await getRows(cascade.child)) {
        const ref = child[cascade.childKey];
        if (typeof ref === "string" && ref && !parents.has(ref)) {
          issues.push({
            level: "error",
            table: cascade.child,
            id: String(child[getMeta(cascade.child).primaryKey ?? "id"] ?? ""),
            message: `Dangling reference ${cascade.childKey}=${ref} -> ${cascade.parent}.${cascade.parentKey}`,
          });
        }
      }
    }

    return validationFromIssues(issues);
  }

  private validateAgentConfigRow(row: Row, idValue: unknown, issues: MariDbValidationIssue[]) {
    const id = idValue == null ? null : String(idValue);
    if (typeof row.type !== "string" || row.type.trim().length === 0) {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent type must be a non-empty string" });
    }
    if (typeof row.name !== "string" || row.name.trim().length === 0) {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent name must be a non-empty string" });
    }
    if (typeof row.description !== "string") {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent description must be a string" });
    }
    if (typeof row.phase !== "string" || !AGENT_PHASES.has(row.phase)) {
      issues.push({
        level: "error",
        table: "agent_configs",
        id,
        message: `Agent phase must be one of: ${[...AGENT_PHASES].join(", ")}`,
      });
    }
    if (typeof row.enabled !== "string" || !BOOLEAN_TEXT_VALUES.has(row.enabled)) {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent enabled must be stored as \"true\" or \"false\"" });
    }
    if (row.connectionId !== null && row.connectionId !== undefined && typeof row.connectionId !== "string") {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent connectionId must be a string or null" });
    }
    if (row.imagePath !== null && row.imagePath !== undefined && typeof row.imagePath !== "string") {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent imagePath must be a string or null" });
    }
    if (typeof row.promptTemplate !== "string") {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent promptTemplate must be a string" });
    }
    const settings = tryParseJsonColumn(row, "settings");
    if (settings !== undefined && !isRecord(settings)) {
      issues.push({ level: "error", table: "agent_configs", id, message: "Agent settings must be a JSON object" });
    }
  }

  private validateCustomToolRow(row: Row, idValue: unknown, issues: MariDbValidationIssue[]) {
    const id = idValue == null ? null : String(idValue);
    if (typeof row.name !== "string" || !/^[a-z][a-z0-9_]*$/.test(row.name)) {
      issues.push({ level: "error", table: "custom_tools", id, message: "Tool name must be lowercase snake_case" });
    }
    if (typeof row.description !== "string" || row.description.trim().length === 0) {
      issues.push({ level: "error", table: "custom_tools", id, message: "Tool description must be a non-empty string" });
    }
    if (typeof row.executionType !== "string" || !TOOL_EXECUTION_TYPES.has(row.executionType)) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: `Tool executionType must be one of: ${[...TOOL_EXECUTION_TYPES].join(", ")}`,
      });
    }
    if (row.executionType === "script" && !isCustomToolScriptEnabled()) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Script custom tools require CUSTOM_TOOL_SCRIPT_ENABLED=true and a server restart",
      });
    }
    if (typeof row.enabled !== "string" || !BOOLEAN_TEXT_VALUES.has(row.enabled)) {
      issues.push({ level: "error", table: "custom_tools", id, message: "Tool enabled must be stored as \"true\" or \"false\"" });
    }
    if (
      row.includeHiddenContext !== undefined &&
      (typeof row.includeHiddenContext !== "string" || !BOOLEAN_TEXT_VALUES.has(row.includeHiddenContext))
    ) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Tool includeHiddenContext must be stored as \"true\" or \"false\"",
      });
    }
    const parametersSchema = tryParseJsonColumn(row, "parametersSchema");
    if (parametersSchema !== undefined && !isRecord(parametersSchema)) {
      issues.push({ level: "error", table: "custom_tools", id, message: "Tool parametersSchema must be a JSON object" });
    }
    if (row.webhookUrl !== null && row.webhookUrl !== undefined && row.webhookUrl !== "") {
      if (typeof row.webhookUrl !== "string") {
        issues.push({ level: "error", table: "custom_tools", id, message: "Tool webhookUrl must be a URL string or null" });
      } else {
        try {
          new URL(row.webhookUrl);
        } catch {
          issues.push({ level: "error", table: "custom_tools", id, message: "Tool webhookUrl must be a valid URL" });
        }
      }
    }
    if (row.executionType === "script" && (typeof row.scriptBody !== "string" || row.scriptBody.trim().length === 0)) {
      issues.push({ level: "error", table: "custom_tools", id, message: "Script tools require a non-empty scriptBody" });
    }
    if (row.executionType === "static" && row.staticResult !== null && row.staticResult !== undefined && typeof row.staticResult !== "string") {
      issues.push({ level: "error", table: "custom_tools", id, message: "Static tool result must be a string or null" });
    }
  }

  private codeCwd(cwd?: string) {
    return resolve(cwd?.trim() ? cwd : getMonorepoRoot());
  }

  private async executeCodeCommand(args: string[], context: CodeCommandContext): Promise<MariDbCommandResult> {
    const sub = args[0];
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      return { ok: true, mode: "read", command: context.command, output: this.codeHelpText() };
    }
    const parsed = parseArgs(args.slice(1));
    if (hasFlag(parsed.flags, "help")) return { ok: true, mode: "read", command: context.command, output: this.codeHelpText() };

    switch (sub) {
      case "status":
        return this.executeCodeStatus(context);
      case "diff":
        return this.executeCodeDiff(context, parsed.flags);
      case "check":
        return this.executeCodeCheck(context, parsed.flags);
      case "health":
        return this.executeCodeHealth(context);
      case "reload":
        return this.executeCodeReload(args.slice(1), context);
      case "continue":
        return this.executeCodeContinue(parsed.positionals[0], context);
      default:
        return {
          ok: false,
          mode: "read",
          command: context.command,
          error: `Unknown mari code command: ${sub}\n${this.codeHelpText()}`,
        };
    }
  }

  private async executeCodeStatus(context: CodeCommandContext): Promise<MariDbCommandResult> {
    const cwd = this.codeCwd(context.cwd);
    const [repoRoot, branch, status, stat, version] = await Promise.all([
      runProcess("git", ["rev-parse", "--show-toplevel"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", ["branch", "--show-current"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", ["status", "--short", "--branch"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", ["diff", "--stat"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      readPackageVersion(cwd),
    ]);
    const statusText = status.stdout.trim();
    return {
      ok: status.ok,
      mode: "read",
      command: context.command,
      output: {
        workspace: cwd,
        repoRoot: repoRoot.ok ? repoRoot.stdout.trim() : null,
        dataDir: getFileStorageDir(),
        packageVersion: version,
        runtime: {
          pid: process.pid,
          node: process.version,
          platform: process.platform,
          uptimeSeconds: Math.round(process.uptime()),
        },
        git: {
          branch: branch.stdout.trim() || null,
          clean: status.ok && !statusText.split(/\r?\n/).some((line) => line && !line.startsWith("##")),
          statusShort: statusText,
          changedFiles: parseGitStatusFiles(statusText),
          diffStat: stat.stdout.trim(),
          errors: [repoRoot, branch, status, stat].filter((result) => !result.ok).map((result) => result.stderr.trim() || `${result.command} failed`),
        },
      },
    };
  }

  private async executeCodeDiff(context: CodeCommandContext, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    const cwd = this.codeCwd(context.cwd);
    const cached = hasFlag(flags, "cached") || hasFlag(flags, "staged");
    const includePatch = hasFlag(flags, "patch") || hasFlag(flags, "full");
    const diffBaseArgs = ["diff", ...(cached ? ["--cached"] : [])];
    const [status, stat, nameOnly, patch] = await Promise.all([
      runProcess("git", ["status", "--short", "--branch"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", [...diffBaseArgs, "--stat"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", [...diffBaseArgs, "--name-only"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      includePatch ? runProcess("git", [...diffBaseArgs, "--patch"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }) : Promise.resolve(null),
    ]);
    const statusText = status.stdout.trim();
    const gitFiles = nameOnly.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const changedFiles = [...new Set([...parseGitStatusFiles(statusText), ...gitFiles])].sort((a, b) => a.localeCompare(b));
    return {
      ok: status.ok && stat.ok && nameOnly.ok && (!patch || patch.ok),
      mode: "read",
      command: context.command,
      output: {
        workspace: cwd,
        cached,
        statusShort: statusText,
        changedFiles,
        stat: stat.stdout.trim(),
        patch: patch?.stdout,
        truncated: Boolean(patch?.truncated || stat.truncated || nameOnly.truncated),
        errors: [status, stat, nameOnly, patch].filter((result): result is ProcessRunResult => !!result && !result.ok).map((result) => result.stderr.trim() || `${result.command} failed`),
      },
    };
  }

  private async executeCodeCheck(context: CodeCommandContext, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    const cwd = this.codeCwd(context.cwd);
    const changedOnly = hasFlag(flags, "changed");
    const result = await runProcess("pnpm", ["check"], { cwd, timeoutMs: CODE_CHECK_TIMEOUT_MS });
    return {
      ok: result.ok,
      mode: "read",
      command: context.command,
      output: {
        scope: changedOnly ? "changed" : "workspace",
        note: changedOnly ? "No changed-file-only checker is wired yet; ran the baseline pnpm check." : undefined,
        result,
      },
      error: result.ok ? undefined : "pnpm check failed",
    };
  }

  private async executeCodeHealth(context: CodeCommandContext): Promise<MariDbCommandResult> {
    const cwd = this.codeCwd(context.cwd);
    const [gitStatus, validation] = await Promise.all([
      runProcess("git", ["status", "--short"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      this.validate().catch((err) => ({
        status: "blocked" as const,
        errors: [{ level: "error" as const, message: err instanceof Error ? err.message : String(err) }],
        notices: [],
        infos: [],
      })),
    ]);
    return {
      ok: validation.status === "passed",
      mode: "read",
      command: context.command,
      output: {
        status: validation.status === "passed" ? "ok" : "attention_required",
        workspace: cwd,
        dataDir: getFileStorageDir(),
        server: {
          pid: process.pid,
          node: process.version,
          platform: process.platform,
          uptimeSeconds: Math.round(process.uptime()),
        },
        git: {
          clean: gitStatus.ok && gitStatus.stdout.trim().length === 0,
          statusShort: gitStatus.stdout.trim(),
        },
        dataValidation: validation,
      },
    };
  }

  private executeCodeReload(args: string[], context: CodeCommandContext): MariDbCommandResult {
    const sub = args[0];
    const parsed = parseArgs(args.slice(1));
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(parsed.flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.codeReloadHelpText() };
    }
    if (sub !== "request") {
      return { ok: false, mode: "read", command: context.command, error: `Unknown mari code reload command: ${sub}\n${this.codeReloadHelpText()}` };
    }
    const kind = flagString(parsed.flags, "kind") ?? "client";
    if (!["client", "server", "full"].includes(kind)) {
      return { ok: false, mode: "read", command: context.command, error: "--kind must be client, server, or full" };
    }
    const reason = flagString(parsed.flags, "reason")?.trim() || "Workspace changes need reload/restart verification.";
    return {
      ok: true,
      mode: "read",
      command: context.command,
      output: {
        status: "reload_requested",
        kind,
        reason,
        resume: hasFlag(parsed.flags, "resume"),
        requestedAt: now(),
        workspace: this.codeCwd(context.cwd),
        note: "Automatic suspend/resume is not wired in this build yet. Stop generation after this request, ask the user to perform the reload/restart, then verify with mari code health or targeted checks.",
        manualSteps:
          kind === "client"
            ? ["Reload the browser tab or rely on Vite HMR if it already updated.", "Continue after the UI reconnects."]
            : kind === "server"
              ? ["Restart the Marinara server or wait for tsx watch/dev launcher to restart it.", "Run mari code health after reconnecting."]
              : ["Restart the Marinara server and reload the browser client.", "Run mari code health after reconnecting."],
      },
    };
  }

  private executeCodeContinue(runId: string | undefined, context: CodeCommandContext): MariDbCommandResult {
    if (!runId) return { ok: false, mode: "read", command: context.command, error: "Usage: mari code continue <run-id>" };
    return {
      ok: false,
      mode: "read",
      command: context.command,
      error: "Durable workspace run resume is planned but not implemented yet. Reopen Professor Mari and paste the run context or continue manually.",
    };
  }

  private async executeCharactersCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    const flags = parsed.flags;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.charactersHelpText() };
    }
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const search = flagString(flags, "search")?.toLowerCase();
        const rows = (await this.rawRows("characters")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        const summaries = rows
          .map(summarizeCharacterRow)
          .filter((s) => !search || JSON.stringify(s).toLowerCase().includes(search));
        return { ok: true, mode: "read", command: context.command, output: summaries.slice(0, limit) };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari characters get <id>");
        const row = await this.getRawById(getMeta("characters"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow("characters", row) : null };
      }
      case "search": {
        const query = parsed.positionals[0];
        if (!query) throw new Error("Usage: mari characters search <query>");
        const needle = query.toLowerCase();
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const rows = (await this.rawRows("characters"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
          .slice(0, limit)
          .map(summarizeCharacterRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const name = flagString(flags, "name")?.trim();
        const rawJson = await resolveJsonInput(flags, context.cwd);
        if (!name && !rawJson) {
          throw new Error(
            "Usage: mari characters create --name <name> [--description <text>] [--personality <text>] [--scenario <text>] [--about-me <text>] [--apply]\n" +
              "       or: mari characters create --json '<data_json>' [--json-file <path>] [--apply]",
          );
        }
        const baseData = rawJson ? parseCharacterDataJsonInput(rawJson, "Character create JSON") : {};
        const charName = name ?? (typeof baseData.name === "string" ? baseData.name.trim() : "");
        if (!charName) throw new Error("Character name is required (--name or name field in --json)");
        const charData = buildMinimalCharacterData(charName, baseData, flags);
        const id = flagString(flags, "id") ?? newId();
        const timestamp = now();
        const row: Row = {
          id,
          data: charData,
          comment: flagString(flags, "comment") ?? "",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "characters",
          id,
          row,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = parsed.positionals[0];
        if (!id)
          throw new Error(
            "Usage: mari characters update <id> [--name <name>] [--description <text>] [--personality <text>] [--scenario <text>] [--first-mes <text>] [--creator-notes <text>] [--backstory <text>] [--appearance <text>] [--about-me <text>] [--tags <t1,t2,...>] [--comment <text>] [--json '<data_json>' | --json-file <path>] [--apply] [--reason <text>]",
          );
        const existing = await this.getRawById(getMeta("characters"), id);
        if (!existing) throw new Error(`Character ${id} not found`);
        const existingDataRaw = tryParseJsonColumn(existing, "data");
        const existingData = isRecord(existingDataRaw) ? existingDataRaw : {};
        const rawJson = await resolveJsonInput(flags, context.cwd);
        const patchData = rawJson ? parseCharacterDataJsonInput(rawJson, "Character update JSON") : {};
        const updatedData = buildMinimalCharacterData(
          flagString(flags, "name")?.trim() ?? (typeof existingData.name === "string" ? existingData.name : ""),
          { ...existingData, ...patchData },
          flags,
        );
        const row: Row = {
          id,
          data: updatedData,
          comment: flagString(flags, "comment") ?? (typeof existing.comment === "string" ? existing.comment : ""),
          avatarPath: existing.avatarPath ?? null,
          spriteFolderPath: existing.spriteFolderPath ?? null,
          createdAt: existing.createdAt,
          updatedAt: now(),
        };
        const request: ParsedMutationRequest = {
          kind: "replace",
          table: "characters",
          id,
          row,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "delete": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari characters delete <id> [--apply]");
        const request: ParsedMutationRequest = {
          kind: "delete",
          table: "characters",
          id,
          apply: hasFlag(flags, "apply"),
          cascade: true,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: this.charactersHelpText() };
    }
  }

  private async executePersonasCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    const flags = parsed.flags;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.personasHelpText() };
    }
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const rows = (await this.rawRows("personas")).sort((a, b) =>
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
        );
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizePersonaRow) };
      }
      case "active": {
        const row = (await this.rawRows("personas")).find((r) => r.isActive === "true") ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari personas get <id>");
        const row = await this.getRawById(getMeta("personas"), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "search": {
        const query = parsed.positionals[0];
        if (!query) throw new Error("Usage: mari personas search <query>");
        const needle = query.toLowerCase();
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const rows = (await this.rawRows("personas"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
          .slice(0, limit)
          .map(summarizePersonaRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const name = flagString(flags, "name")?.trim();
        if (!name) {
          throw new Error(
            "Usage: mari personas create --name <name> [--description <text>] [--personality <text>] [--scenario <text>] [--backstory <text>] [--appearance <text>] [--phonetic-name <text>] [--convo-display-name <text>] [--about-me <text>] [--convo-behavior <text-or-json>] [--comment <text>] [--creator <text>] [--creator-notes <text>] [--apply] [--reason <text>]",
          );
        }
        const timestamp = now();
        const id = flagString(flags, "id") ?? newId();
        const row = buildPersonaCreateRow(
          {
            name,
            comment: flagString(flags, "comment"),
            creator: flagString(flags, "creator"),
            creatorNotes: flagString(flags, "creator-notes"),
            phoneticName: flagString(flags, "phonetic-name"),
            description: flagString(flags, "description"),
            personality: flagString(flags, "personality"),
            scenario: flagString(flags, "scenario"),
            backstory: flagString(flags, "backstory"),
            appearance: flagString(flags, "appearance"),
            convoDisplayName: flagString(flags, "convo-display-name"),
            aboutMe: flagString(flags, "about-me"),
            convoBehavior: flagString(flags, "convo-behavior"),
          },
          id,
          timestamp,
        );
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "personas",
          id,
          row,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = parsed.positionals[0];
        if (!id)
          throw new Error(
            "Usage: mari personas update <id> [--name <name>] [--description <text>] [--personality <text>] [--scenario <text>] [--backstory <text>] [--appearance <text>] [--phonetic-name <text>] [--convo-display-name <text>] [--about-me <text>] [--convo-behavior <text-or-json>] [--tags <t1,t2,...>] [--comment <text>] [--creator <text>] [--creator-notes <text>] [--apply] [--reason <text>]",
          );
        const patch: Row = { updatedAt: now() };
        const fieldMap: Array<[string, string]> = [
          ["name", "name"],
          ["description", "description"],
          ["personality", "personality"],
          ["scenario", "scenario"],
          ["backstory", "backstory"],
          ["appearance", "appearance"],
          ["comment", "comment"],
          ["creator", "creator"],
          ["creator-notes", "creatorNotes"],
          ["phonetic-name", "phoneticName"],
          ["convo-display-name", "convoDisplayName"],
          ["about-me", "aboutMe"],
        ];
        for (const [flagName, fieldName] of fieldMap) {
          const val = flagString(flags, flagName);
          if (val !== undefined) patch[fieldName] = val;
        }
        const personaTagsRaw = flagString(flags, "tags");
        if (personaTagsRaw !== undefined) {
          patch.tags = personaTagsRaw
            ? personaTagsRaw.split(/[,|]/).map((t) => t.trim()).filter(Boolean)
            : [];
        }
        const convoBehaviorRaw = flagString(flags, "convo-behavior");
        if (convoBehaviorRaw !== undefined) patch.convoBehavior = normalizePersonaConvoBehavior(convoBehaviorRaw);
        if (Object.keys(patch).length <= 1) {
          throw new Error(
            "Provide at least one field to update (--name, --description, --personality, --scenario, --backstory, --appearance, --phonetic-name, --convo-display-name, --about-me, --convo-behavior, --tags, --comment, --creator, --creator-notes)",
          );
        }
        const request: ParsedMutationRequest = {
          kind: "patch",
          table: "personas",
          id,
          patch,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "delete": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari personas delete <id> [--apply]");
        const request: ParsedMutationRequest = {
          kind: "delete",
          table: "personas",
          id,
          apply: hasFlag(flags, "apply"),
          cascade: true,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: this.personasHelpText() };
    }
  }

  private async executeLorebooksCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    const flags = parsed.flags;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.lorebooksHelpText() };
    }
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const globalOnly = hasFlag(flags, "global");
        const characterId = flagString(flags, "character");
        const rows = (await this.rawRows("lorebooks"))
          .filter((row) => !globalOnly || row.isGlobal === "true")
          .filter((row) => !characterId || row.characterId === characterId)
          .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizeLorebookRow) };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari lorebooks get <id>");
        const row = await this.getRawById(getMeta("lorebooks"), id);
        if (!row) return { ok: false, mode: "read", command: context.command, output: null };
        const entryCount = (await this.rawRows("lorebook_entries")).filter((e) => e.lorebookId === id).length;
        return { ok: true, mode: "read", command: context.command, output: { ...parseRow("lorebooks", row), entryCount } };
      }
      case "entries": {
        const lorebookId = parsed.positionals[0];
        if (!lorebookId) throw new Error("Usage: mari lorebooks entries <lorebook-id> [--limit <n>] [--entry-id <entry-id>]");
        const limit = normalizeLimit(flagString(flags, "limit"), 100, 2000);
        const entryId = flagString(flags, "entry-id") ?? flagString(flags, "entryId");
        const entries = (await this.rawRows("lorebook_entries"))
          .filter((e) => e.lorebookId === lorebookId)
          .filter((e) => !entryId || e.id === entryId)
          .sort((a, b) => Number(a.order ?? 100) - Number(b.order ?? 100))
          .slice(0, limit)
          .map(summarizeLorebookEntryRow);
        return { ok: true, mode: "read", command: context.command, output: entries };
      }
      case "get-entry": {
        const entryId = parsed.positionals[0] ?? flagString(flags, "entry-id") ?? flagString(flags, "entryId");
        if (!entryId) throw new Error("Usage: mari lorebooks get-entry <entry-id>");
        const row = await this.getRawById(getMeta("lorebook_entries"), entryId);
        return {
          ok: !!row,
          mode: "read",
          command: context.command,
          output: row ? parseRow("lorebook_entries", row) : null,
        };
      }
      case "search": {
        const query = parsed.positionals[0];
        if (!query) throw new Error("Usage: mari lorebooks search <query>");
        const needle = query.toLowerCase();
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const rows = (await this.rawRows("lorebooks"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
          .slice(0, limit)
          .map(summarizeLorebookRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const name = flagString(flags, "name")?.trim();
        if (!name) throw new Error("Usage: mari lorebooks create --name <name> [--description <text>] [--global] [--apply]");
        const timestamp = now();
        const row: Row = {
          id: flagString(flags, "id") ?? newId(),
          name,
          description: flagString(flags, "description") ?? "",
          category: normalizeLorebookCategory(flagString(flags, "category")),
          isGlobal: hasFlag(flags, "global") ? "true" : "false",
          enabled: "true",
          scanDepth: 2,
          tokenBudget: 2048,
          entryLimit: 100,
          recursiveScanning: "false",
          maxRecursionDepth: 3,
          excludeFromVectorization: "false",
          scope: { mode: "all", chatIds: [] },
          tags: [],
          generatedBy: "agent",
          sourceAgentId: PROFESSOR_MARI_ID,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "lorebooks",
          id: String(row.id),
          row,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = parsed.positionals[0];
        if (!id)
          throw new Error(
            "Usage: mari lorebooks update <id> [--name <name>] [--description <text>] [--category <text>] [--tags <t1,t2,...>] [--global] [--enable] [--disable] [--apply]",
          );
        const patch: Row = { updatedAt: now() };
        const fieldMap: Array<[string, string]> = [
          ["name", "name"],
          ["description", "description"],
        ];
        for (const [flagName, fieldName] of fieldMap) {
          const val = flagString(flags, flagName);
          if (val !== undefined) patch[fieldName] = val;
        }
        const category = flagString(flags, "category");
        if (category !== undefined) patch.category = normalizeLorebookCategory(category);
        if (hasFlag(flags, "global")) patch.isGlobal = "true";
        if (hasFlag(flags, "no-global")) patch.isGlobal = "false";
        if (hasFlag(flags, "enable")) patch.enabled = "true";
        if (hasFlag(flags, "disable")) patch.enabled = "false";
        const lorebookTagsRaw = flagString(flags, "tags");
        if (lorebookTagsRaw !== undefined) {
          patch.tags = lorebookTagsRaw
            ? lorebookTagsRaw.split(/[,|]/).map((t) => t.trim()).filter(Boolean)
            : [];
        }
        if (Object.keys(patch).length <= 1) {
          throw new Error(
            "Provide at least one field to update (--name, --description, --category, --tags, --global, --enable, --disable)",
          );
        }
        const request: ParsedMutationRequest = {
          kind: "patch",
          table: "lorebooks",
          id,
          patch,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "add-entry": {
        const lorebookId = parsed.positionals[0];
        if (!lorebookId) {
          throw new Error(
            "Usage: mari lorebooks add-entry <lorebook-id> --name <name> [--content <text>] [--keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--folder-id <folder-id>] [--apply] [--reason <text>]",
          );
        }
        const entryName = flagString(flags, "name")?.trim();
        if (!entryName) throw new Error("--name is required for add-entry");
        const lorebookExists = await this.getRawById(getMeta("lorebooks"), lorebookId);
        if (!lorebookExists) throw new Error(`Lorebook ${lorebookId} not found`);
        const addFolderId = flagString(flags, "folder-id");
        if (addFolderId) {
          const folderRow = await this.getRawById(getMeta("lorebook_folders"), addFolderId);
          if (!folderRow || String(folderRow.lorebookId) !== lorebookId) {
            throw new Error(`Folder ${addFolderId} not found in lorebook ${lorebookId}`);
          }
        }
        const keysRaw = flagString(flags, "keys") ?? "";
        const keys = keysRaw
          ? keysRaw
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
        const timestamp = now();
        const entryRow: Row = {
          id: flagString(flags, "id") ?? newId(),
          lorebookId,
          folderId: addFolderId ?? null,
          name: entryName,
          content: flagString(flags, "content") ?? "",
          description: flagString(flags, "description") ?? "",
          tag: flagString(flags, "tag") ?? "",
          keys,
          secondaryKeys: [],
          enabled: "true",
          constant: "false",
          selective: "false",
          selectiveLogic: "and",
          matchWholeWords: "false",
          caseSensitive: "false",
          useRegex: "false",
          characterFilterMode: "any",
          characterFilterIds: [],
          characterTagFilterMode: "any",
          characterTagFilters: [],
          generationTriggerFilterMode: "any",
          generationTriggerFilters: [],
          additionalMatchingSources: [],
          position: 0,
          depth: 4,
          order: 100,
          role: "system",
          group: "",
          relationships: {},
          dynamicState: {},
          activationConditions: [],
          preventRecursion: "true",
          excludeRecursion: "false",
          delayUntilRecursion: "false",
          excludeFromVectorization: "false",
          locked: "false",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "lorebook_entries",
          id: String(entryRow.id),
          row: entryRow,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update-entry": {
        const entryId = parsed.positionals[0];
        if (!entryId) {
          throw new Error(
            "Usage: mari lorebooks update-entry <entry-id> [--name <name>] [--content <text>] [--keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--enable] [--disable] [--constant] [--no-constant] [--order <n>] [--folder-id <folder-id>|none] [--apply] [--reason <text>]",
          );
        }
        const entryExists = await this.getRawById(getMeta("lorebook_entries"), entryId);
        if (!entryExists) throw new Error(`Lorebook entry ${entryId} not found`);
        const entryPatch: Row = { updatedAt: now() };
        const entryFieldMap: Array<[string, string]> = [
          ["name", "name"],
          ["content", "content"],
          ["description", "description"],
          ["tag", "tag"],
        ];
        for (const [flagName, fieldName] of entryFieldMap) {
          const val = flagString(flags, flagName);
          if (val !== undefined) entryPatch[fieldName] = val;
        }
        const keysRaw = flagString(flags, "keys");
        if (keysRaw !== undefined) {
          entryPatch.keys = keysRaw
            ? keysRaw.split(",").map((k) => k.trim()).filter(Boolean)
            : [];
        }
        const orderVal = flagString(flags, "order");
        if (orderVal !== undefined) {
          const order = Number(orderVal);
          if (!Number.isFinite(order)) throw new Error("--order must be a finite number");
          entryPatch.order = order;
        }
        if (hasFlag(flags, "enable")) entryPatch.enabled = "true";
        if (hasFlag(flags, "disable")) entryPatch.enabled = "false";
        if (hasFlag(flags, "constant")) entryPatch.constant = "true";
        if (hasFlag(flags, "no-constant")) entryPatch.constant = "false";
        const patchFolderId = flagString(flags, "folder-id");
        if (patchFolderId !== undefined) {
          if (!patchFolderId || patchFolderId === "none") {
            entryPatch.folderId = null;
          } else {
            const folderRow = await this.getRawById(getMeta("lorebook_folders"), patchFolderId);
            if (!folderRow || String(folderRow.lorebookId) !== String(entryExists.lorebookId)) {
              throw new Error(`Folder ${patchFolderId} not found in this entry's lorebook`);
            }
            entryPatch.folderId = patchFolderId;
          }
        }
        if (Object.keys(entryPatch).length <= 1) {
          throw new Error(
            "Provide at least one field to update (--name, --content, --keys, --description, --tag, --enable, --disable, --constant, --no-constant, --order, --folder-id)",
          );
        }
        const updateEntryRequest: ParsedMutationRequest = {
          kind: "patch",
          table: "lorebook_entries",
          id: entryId,
          patch: entryPatch,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(updateEntryRequest, context.command, context.sessionId);
      }
      case "delete-entry": {
        const entryId = parsed.positionals[0];
        if (!entryId) throw new Error("Usage: mari lorebooks delete-entry <entry-id> [--apply] [--reason <text>]");
        const deleteEntryRequest: ParsedMutationRequest = {
          kind: "delete",
          table: "lorebook_entries",
          id: entryId,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(deleteEntryRequest, context.command, context.sessionId);
      }
      case "link-character": {
        const lorebookId = parsed.positionals[0];
        const characterId = flagString(flags, "character");
        if (!lorebookId || !characterId)
          throw new Error("Usage: mari lorebooks link-character <lorebook-id> --character <character-id> [--apply]");
        const lorebookExists = await this.getRawById(getMeta("lorebooks"), lorebookId);
        if (!lorebookExists) throw new Error(`Lorebook ${lorebookId} not found`);
        const characterExists = await this.getRawById(getMeta("characters"), characterId);
        if (!characterExists) throw new Error(`Character ${characterId} not found`);
        const timestamp = now();
        const linkRow: Row = { id: newId(), lorebookId, characterId, createdAt: timestamp };
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "lorebook_character_links",
          id: String(linkRow.id),
          row: linkRow,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "unlink-character": {
        const lorebookId = parsed.positionals[0];
        const characterId = flagString(flags, "character");
        if (!lorebookId || !characterId)
          throw new Error("Usage: mari lorebooks unlink-character <lorebook-id> --character <character-id> [--apply]");
        const links = (await this.rawRows("lorebook_character_links")).filter(
          (row) => row.lorebookId === lorebookId && row.characterId === characterId,
        );
        if (links.length === 0) throw new Error(`No link found between lorebook ${lorebookId} and character ${characterId}`);
        const request: ParsedMutationRequest = {
          kind: "delete",
          table: "lorebook_character_links",
          id: String(links[0]!.id),
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "delete": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari lorebooks delete <id> [--apply]");
        const request: ParsedMutationRequest = {
          kind: "delete",
          table: "lorebooks",
          id,
          apply: hasFlag(flags, "apply"),
          cascade: hasFlag(flags, "cascade"),
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: this.lorebooksHelpText() };
    }
  }

  private async executeChatsCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    const flags = parsed.flags;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.chatsHelpText() };
    }
    switch (sub) {
      case "list": {
        const limit = normalizeLimit(flagString(flags, "limit"), 20, 500);
        const characterId = flagString(flags, "character");
        const rows = (await this.rawRows("chats"))
          .filter((row) => {
            if (!characterId) return true;
            const ids = tryParseJsonColumn(row, "characterIds");
            return Array.isArray(ids) && ids.includes(characterId);
          })
          .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
          .slice(0, limit)
          .map(summarizeChatRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari chats get <id>");
        const row = await this.getRawById(getMeta("chats"), id);
        if (!row) return { ok: false, mode: "read", command: context.command, output: null };
        const messageCount = (await this.rawRows("messages")).filter((m) => m.chatId === id).length;
        return { ok: true, mode: "read", command: context.command, output: { ...parseRow("chats", row), messageCount } };
      }
      case "messages": {
        const chatId = parsed.positionals[0];
        if (!chatId) throw new Error("Usage: mari chats messages <chat-id> [--limit <n>] [--offset <n>] [--tail]");
        const limitFlag = flagString(flags, "limit");
        const limit = limitFlag !== undefined ? normalizeLimit(limitFlag, 20, 200) : null;
        const offset = normalizeOffset(flagString(flags, "offset"));
        const tail = hasFlag(flags, "tail");
        let messages = (await this.rawRows("messages")).filter((m) => m.chatId === chatId);
        messages.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
        if (tail) {
          const offsetMessages = offset > 0 ? messages.slice(0, Math.max(0, messages.length - offset)) : messages;
          messages = limit !== null ? offsetMessages.slice(-limit) : offsetMessages;
        } else {
          messages = messages.slice(offset, limit !== null ? offset + limit : undefined);
        }
        const result = messages.map((row) => ({
          id: row.id,
          role: row.role,
          characterId: row.characterId ?? null,
          content: typeof row.content === "string" ? row.content : "",
          createdAt: row.createdAt,
        }));
        return { ok: true, mode: "read", command: context.command, output: result };
      }
      case "search": {
        const query = parsed.positionals[0];
        if (!query) throw new Error("Usage: mari chats search <query>");
        const needle = query.toLowerCase();
        const limit = normalizeLimit(flagString(flags, "limit"), 20, 200);
        const rows = (await this.rawRows("chats"))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(needle))
          .slice(0, limit)
          .map(summarizeChatRow);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: this.chatsHelpText() };
    }
  }

  private async executeThemeCommand(args: string[], context: { command: string; sessionId: string; cwd?: string }): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    const flags = parsed.flags;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.themeHelpText() };
    }

    switch (sub) {
      case "list": {
        const activeOnly = hasFlag(flags, "active");
        const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
        const rows = (await this.rawRows(THEME_TABLE))
          .filter((row) => !activeOnly || row.isActive === THEME_ACTIVE_TRUE)
          .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarizeThemeRow) };
      }
      case "active": {
        const row = (await this.rawRows(THEME_TABLE)).find((candidate) => candidate.isActive === THEME_ACTIVE_TRUE) ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari themes get <id>");
        const row = await this.getRawById(getMeta(THEME_TABLE), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "create": {
        const name = flagString(flags, "name")?.trim();
        if (!name) throw new Error("Usage: mari themes create --name <name> (--css <css> | --css-file <path>) [--activate] [--apply]");
        const css = await parseCssInput(flags, context.cwd);
        const request: ParsedMutationRequest = {
          kind: "theme-create",
          table: THEME_TABLE,
          id: flagString(flags, "id") ?? newId(),
          name,
          css,
          installedAt: flagString(flags, "installed-at") ?? now(),
          activate: hasFlag(flags, "activate") || hasFlag(flags, "active"),
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "update": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari themes update <id> [--name <name>] [--css <css> | --css-file <path>] [--apply]");
        const hasCssInput = flags.has("css") || flags.has("css-file") || flags.has("file");
        const name = flagString(flags, "name")?.trim();
        const css = hasCssInput ? await parseCssInput(flags, context.cwd) : undefined;
        if (name === undefined && css === undefined) throw new Error("Theme update needs --name, --css, or --css-file");
        const request: ParsedMutationRequest = {
          kind: "theme-update",
          table: THEME_TABLE,
          id,
          name,
          css,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "set-active": {
        const rawId = parsed.positionals[0];
        if (!rawId) throw new Error("Usage: mari themes set-active <id|none> [--apply]");
        const id = ["default", "none", "null", "off"].includes(rawId.toLowerCase()) ? undefined : rawId;
        const request: ParsedMutationRequest = {
          kind: "theme-set-active",
          table: THEME_TABLE,
          id,
          apply: hasFlag(flags, "apply"),
          cascade: false,
          reason: flagString(flags, "reason") ?? null,
          cwd: context.cwd,
        };
        return this.executeMutation(request, context.command, context.sessionId);
      }
      case "help":
        return { ok: true, mode: "read", command: context.command, output: this.themeHelpText() };
      default:
        return { ok: false, mode: "read", command: context.command, error: this.themeHelpText() };
    }
  }

  private async executeDbCommand(args: string[], context: { command: string; sessionId: string; cwd?: string }): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(parsed.flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.helpText() };
    }
    switch (sub) {
      case "status":
        return { ok: true, mode: "read", command: context.command, output: { status: "ok", dataDir: getFileStorageDir(), tables: FILE_BACKED_TABLES.length } };
      case "tables":
        return { ok: true, mode: "read", command: context.command, output: [...FILE_BACKED_TABLES] };
      case "schema": {
        const table = parsed.positionals[0];
        if (!table) throw new Error("Usage: mari db schema <table>");
        const meta = getMeta(table);
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: {
            table,
            primaryKey: meta.primaryKey,
            columns: meta.columns.map((column) => ({
              key: column.key,
              dbName: column.dbName,
              primary: column.primary,
              notNull: column.notNull,
              jsonEncoded: jsonColumnSet(table).has(column.key),
            })),
          },
        };
      }
      case "counts": {
        const counts: Record<string, number> = {};
        for (const table of FILE_BACKED_TABLES) counts[table] = (await this.rawRows(table)).length;
        return { ok: true, mode: "read", command: context.command, output: counts };
      }
      case "data-dir":
        return { ok: true, mode: "read", command: context.command, output: getFileStorageDir() };
      case "now":
        return { ok: true, mode: "read", command: context.command, output: now() };
      case "new-id":
        return { ok: true, mode: "read", command: context.command, output: newId() };
      case "list":
        return this.listRows(parsed.positionals[0], context.command, parsed.flags);
      case "get":
        return this.getRow(parsed.positionals[0], parsed.positionals[1], context.command, parsed.flags);
      case "select":
        return this.selectRows(parsed.positionals[0], context.command, parsed.flags);
      case "search":
        return this.searchRows(parsed.positionals[0], parsed.positionals[1], context.command, parsed.flags);
      case "validate": {
        const result = await this.validate(flagString(parsed.flags, "table") ?? null);
        return { ok: result.status === "passed", mode: "read", command: context.command, validation: result, output: result };
      }
      case "insert":
      case "patch":
      case "replace":
      case "delete":
      case "transform": {
        const request = await this.parseMutation(sub, parsed.positionals, parsed.flags, context.cwd);
        return this.executeMutation(request, context.command, context.sessionId);
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: this.helpText() };
    }
  }

  private async listRows(table: string | undefined, command: string, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    if (!table) throw new Error("Usage: mari db list <table>");
    const rows = (await this.rawRows(table)).map((row) => (hasFlag(flags, "parsed") ? parseRow(table, row) : row));
    const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
    const offset = normalizeLimit(flagString(flags, "offset"), 0, Number.MAX_SAFE_INTEGER);
    return { ok: true, mode: "read", command, output: rows.slice(offset, offset + limit) };
  }

  private async getRow(table: string | undefined, id: string | undefined, command: string, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    if (!table || !id) throw new Error("Usage: mari db get <table> <id>");
    const meta = getMeta(table);
    const row = await this.getRawById(meta, id);
    return { ok: Boolean(row), mode: "read", command, output: row && hasFlag(flags, "parsed") ? parseRow(table, row) : row };
  }

  private async selectRows(table: string | undefined, command: string, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    if (!table) throw new Error("Usage: mari db select <table> --where <expr>");
    const predicate = createWherePredicate(flagString(flags, "where"));
    const rows = (await this.rawRows(table)).map((row) => parseRow(table, row)).filter(predicate);
    const limit = normalizeLimit(flagString(flags, "limit"), 100, 5000);
    return { ok: true, mode: "read", command, output: rows.slice(0, limit) };
  }

  private async searchRows(tableArg: string | undefined, query: string | undefined, command: string, flags: Map<string, string | boolean>): Promise<MariDbCommandResult> {
    if (!tableArg || !query) throw new Error("Usage: mari db search <table|all> <query>");
    const needle = query.toLowerCase();
    const tables = tableArg === "all" ? [...FILE_BACKED_TABLES] : [tableArg];
    const results: Array<{ table: string; row: Row }> = [];
    const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
    for (const table of tables) {
      getMeta(table);
      for (const raw of await this.rawRows(table)) {
        const row = parseRow(table, raw);
        if (JSON.stringify(row).toLowerCase().includes(needle)) results.push({ table, row });
        if (results.length >= limit) return { ok: true, mode: "read", command, output: results };
      }
    }
    return { ok: true, mode: "read", command, output: results };
  }

  private async parseMutation(kind: ParsedMutationRequest["kind"], positionals: string[], flags: Map<string, string | boolean>, cwd?: string): Promise<ParsedMutationRequest> {
    const apply = hasFlag(flags, "apply");
    const cascade = hasFlag(flags, "cascade");
    const reason = flagString(flags, "reason") ?? null;
    if (kind === "insert") {
      const table = positionals[0];
      if (!table) throw new Error("Usage: mari db insert <table> (--json '<row-json>' | --json-file <path>) [--apply]");
      return { kind, table, row: await parseJsonInput(flags, cwd), apply, cascade, reason, cwd };
    }
    if (kind === "patch") {
      const [table, id] = positionals;
      if (!table || !id) throw new Error("Usage: mari db patch <table> <id> (--json '<partial-row-json>' | --json-file <path>) [--apply]");
      return { kind, table, id, patch: await parseJsonInput(flags, cwd), apply, cascade, reason, cwd };
    }
    if (kind === "replace") {
      const [table, id] = positionals;
      if (!table || !id) throw new Error("Usage: mari db replace <table> <id> (--json '<full-row-json>' | --json-file <path>) [--apply]");
      return { kind, table, id, row: await parseJsonInput(flags, cwd), apply, cascade, reason, cwd };
    }
    if (kind === "delete") {
      const table = positionals[0];
      if (!table) throw new Error("Usage: mari db delete <table> <id>|--where <expr> [--cascade] [--apply]");
      return { kind, table, id: positionals[1], where: flagString(flags, "where"), apply, cascade, reason, cwd };
    }
    const [table, scriptPath] = positionals;
    if (!table || !scriptPath) throw new Error("Usage: mari db transform <table|all> <script.mjs> [--dry-run] [--apply]");
    return { kind, table, scriptPath, apply, cascade: true, reason, cwd };
  }

  private async executeMutation(request: ParsedMutationRequest, command: string, sessionId: string): Promise<MariDbCommandResult> {
    const planTimestamp = now();
    const plan = await this.planMutation(request, command, planTimestamp);
    if (plan.validation.status === "blocked") {
      await this.recordHistory({ plan, command, sessionId, status: "blocked", journalPath: null });
      return { ok: false, mode: request.apply ? "apply" : "dry-run", command, summary: plan.summary, validation: plan.validation, error: "Blocking validation failed" };
    }

    if (!request.apply) {
      await this.recordHistory({ plan, command, sessionId, status: "dry-run", journalPath: null });
      return {
        ok: true,
        mode: "dry-run",
        command,
        summary: plan.summary,
        validation: plan.validation,
        approval: { status: "not_required", operationHash: plan.operationHash },
      };
    }

    if (request.requiresApproval === false) {
      try {
        const journalPath = await this.applyPlan(plan);
        await this.recordHistory({ plan, command, sessionId, status: "approved", journalPath });
        return {
          ok: true,
          mode: "apply",
          command,
          summary: plan.summary,
          validation: plan.validation,
          approval: { status: "not_required", operationHash: plan.operationHash },
          journalPath,
        };
      } catch (err) {
        logger.error(err, "[mari-db] approval-free apply failed");
        await this.recordHistory({ plan, command, sessionId, status: "failed", journalPath: null });
        return {
          ok: false,
          mode: "apply",
          command,
          summary: plan.summary,
          validation: plan.validation,
          approval: { status: "not_required", operationHash: plan.operationHash },
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    try {
      const journalPath = await this.applyPlan(plan);
      const history = await this.recordHistory({ plan, command, sessionId, status: "approved", journalPath });
      const review = this.createAppliedReview(plan, command, sessionId, journalPath, history.id);
      return {
        ok: true,
        mode: "apply",
        command,
        summary: plan.summary,
        validation: plan.validation,
        approval: { status: "pending", id: review.id, operationHash: plan.operationHash },
        journalPath,
      };
    } catch (err) {
      logger.error(err, "[mari-db] apply failed");
      await this.recordHistory({ plan, command, sessionId, status: "failed", journalPath: null });
      return {
        ok: false,
        mode: "apply",
        command,
        summary: plan.summary,
        validation: plan.validation,
        approval: { status: "not_required", operationHash: plan.operationHash },
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async planMutation(request: ParsedMutationRequest, command: string, timestamp: string = now()): Promise<Plan> {
    const issues: MariDbValidationIssue[] = [];
    const allocateId = createRequestIdAllocator(request);
    let changes: PlanChange[] = [];
    if (request.kind === "insert") changes = await this.planInsert(request, timestamp, allocateId);
    else if (request.kind === "patch") changes = await this.planPatch(request, timestamp);
    else if (request.kind === "replace") changes = await this.planReplace(request, timestamp);
    else if (request.kind === "delete") changes = await this.planDelete(request, issues);
    else if (request.kind === "theme-create") changes = await this.planThemeCreate(request, timestamp, issues);
    else if (request.kind === "theme-update") changes = await this.planThemeUpdate(request, timestamp, issues);
    else if (request.kind === "theme-set-active") changes = await this.planThemeSetActive(request, timestamp, issues);
    else changes = await this.planTransform(request, timestamp, allocateId);

    const touchedTables = [...new Set(changes.map((change) => change.table))];
    const validation = await this.validateTouchedRows(changes, touchedTables, issues);
    const summary = summaryForChanges(changes);
    const operationHash = hash({ command, request, changes: changes.map((change) => ({ table: change.table, id: change.id, action: change.action, beforeRaw: change.beforeRaw ?? null, afterRaw: change.afterRaw ?? null })) });
    return { changes, validation, summary, operationHash, reason: request.reason, request };
  }

  private async planInsert(request: ParsedMutationRequest, timestamp: string, allocateId: () => string): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const pk = getPrimary(meta);
    const parsed = { ...(request.row ?? {}) };
    if (parsed[pk] == null || parsed[pk] === "") parsed[pk] = allocateId();
    this.fillTimestamps(meta, parsed, true, timestamp);
    const afterRaw = serializeRow(meta.name, parsed);
    const changes: PlanChange[] = [
      {
        table: meta.name,
        id: String(afterRaw[pk]),
        action: "insert",
        before: null,
        after: parseRow(meta.name, afterRaw),
        beforeRaw: null,
        afterRaw,
        apply: true,
      },
    ];
    changes.push(...this.planRelatedInserts(request.relatedInserts, timestamp, allocateId));
    return changes;
  }

  private async planPatch(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const existing = await this.requireRawById(meta, String(request.id));
    const parsed = parseRow(meta.name, existing);
    const next = deepMerge(parsed, request.patch ?? {}) as Row;
    next[getPrimary(meta)] = existing[getPrimary(meta)];
    this.fillTimestamps(meta, next, false, timestamp);
    const afterRaw = serializeRow(meta.name, next);
    const changes: PlanChange[] = [
      {
        table: meta.name,
        id: rowId(meta, existing),
        action: "update",
        before: parsed,
        after: parseRow(meta.name, afterRaw),
        beforeRaw: existing,
        afterRaw,
        apply: true,
      },
    ];
    changes.push(...this.planRelatedInserts(request.relatedInserts, timestamp, () => newId()));
    return changes;
  }

  private planRelatedInserts(
    relatedInserts: ParsedMutationRequest["relatedInserts"],
    timestamp: string,
    allocateId: () => string,
  ): PlanChange[] {
    if (!relatedInserts?.length) return [];
    return relatedInserts.map((insert) => {
      const meta = getMeta(insert.table);
      const pk = getPrimary(meta);
      const parsed = { ...insert.row };
      if (parsed[pk] == null || parsed[pk] === "") parsed[pk] = allocateId();
      this.fillTimestamps(meta, parsed, true, timestamp);
      const afterRaw = serializeRow(meta.name, parsed);
      return {
        table: meta.name,
        id: String(afterRaw[pk]),
        action: "insert",
        before: null,
        after: parseRow(meta.name, afterRaw),
        beforeRaw: null,
        afterRaw,
        apply: true,
      };
    });
  }

  private async planReplace(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const existing = await this.requireRawById(meta, String(request.id));
    const next = normalizeWriteRow(meta.name, { ...(request.row ?? {}) });
    next[getPrimary(meta)] = existing[getPrimary(meta)];
    if (meta.byKey.has("createdAt") && !next.createdAt) next.createdAt = existing.createdAt;
    this.fillTimestamps(meta, next, false, timestamp);
    const afterRaw = serializeRow(meta.name, next);
    return [{ table: meta.name, id: rowId(meta, existing), action: "replace", before: parseRow(meta.name, existing), after: parseRow(meta.name, afterRaw), beforeRaw: existing, afterRaw, apply: true }];
  }

  private async planDelete(request: ParsedMutationRequest, issues: MariDbValidationIssue[]): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const rows = await this.rawRows(meta.name);
    const predicate = request.id ? (row: Row) => String(row[getPrimary(meta)]) === request.id : createWherePredicate(request.where);
    const selected = rows.filter((row) => predicate(parseRow(meta.name, row)));
    const changes: PlanChange[] = selected.map((row) => ({
      table: meta.name,
      id: rowId(meta, row),
      action: "delete",
      before: parseRow(meta.name, row),
      after: null,
      beforeRaw: row,
      afterRaw: null,
      apply: true,
    }));
    await this.addCascadeDeletes(changes, request.cascade);
    const cascaded = changes.filter((change) => change.cascadeOf);
    if (cascaded.length > 0 && !request.cascade) {
      issues.push({ level: "error", table: meta.name, message: `Delete would cascade to ${cascaded.length} child row(s). Re-run with --cascade to confirm.` });
    }
    return this.dedupeDeletes(changes);
  }

  private async planTransform(request: ParsedMutationRequest, timestamp: string, allocateId: () => string): Promise<PlanChange[]> {
    const cwd = request.cwd ? resolve(request.cwd) : process.cwd();
    const scriptPath = resolve(cwd, String(request.scriptPath));
    const transform = await importTransform(scriptPath);
    const tables = request.table === "all" ? [...FILE_BACKED_TABLES] : [String(request.table)];
    const allParsed = new Map<string, Row[]>();
    const allRaw = new Map<string, Row[]>();
    for (const table of tables) {
      getMeta(table);
      const rawRows = await this.rawRows(table);
      allRaw.set(table, rawRows);
      allParsed.set(table, rawRows.map((row) => parseRow(table, row)));
    }
    const changes: PlanChange[] = [];
    for (const table of tables) {
      const meta = getMeta(table);
      const rawRows = allRaw.get(table) ?? [];
      const parsedRows = allParsed.get(table) ?? [];
      for (let index = 0; index < parsedRows.length; index++) {
        const row = clone(parsedRows[index]!);
        const raw = rawRows[index]!;
        const ctx: TransformContext = {
          table,
          now: timestamp,
          newId: allocateId,
          raw: (parsedRow) => serializeRow(table, parsedRow),
          parse: (rawRow) => parseRow(table, rawRow),
          find: (findTable, predicate) => (allParsed.get(findTable) ?? []).filter(predicate).map(clone),
        };
        const result = await transform(row, ctx);
        if (result === null || result === false || result === undefined) continue;
        if (isRecord(result) && result.delete === true) {
          changes.push({ table, id: rowId(meta, raw), action: "delete", before: row, after: null, beforeRaw: raw, afterRaw: null, apply: true });
          continue;
        }
        if (isRecord(result) && Object.prototype.hasOwnProperty.call(result, "insert")) {
          const inserts = Array.isArray(result.insert) ? result.insert : [result.insert];
          for (const insert of inserts) {
            if (!isRecord(insert)) continue;
            const insertRow = { ...insert };
            const pk = getPrimary(meta);
            if (insertRow[pk] == null || insertRow[pk] === "") insertRow[pk] = allocateId();
            this.fillTimestamps(meta, insertRow, true, timestamp);
            const afterRaw = serializeRow(table, insertRow);
            changes.push({ table, id: String(afterRaw[pk]), action: "insert", before: null, after: parseRow(table, afterRaw), beforeRaw: null, afterRaw, apply: true });
          }
          continue;
        }
        const resultRow = isRecord(result) && Object.prototype.hasOwnProperty.call(result, "update") ? (deepMerge(row, result.update) as Row) : (result as Row);
        if (!isRecord(resultRow)) continue;
        const next = normalizeWriteRow(table, resultRow);
        next[getPrimary(meta)] = raw[getPrimary(meta)];
        this.fillTimestamps(meta, next, false, timestamp);
        const afterRaw = serializeRow(table, next);
        if (stableJson(afterRaw) !== stableJson(raw)) {
          changes.push({ table, id: rowId(meta, raw), action: "update", before: row, after: parseRow(table, afterRaw), beforeRaw: raw, afterRaw, apply: true });
        }
      }
    }
    await this.addCascadeDeletes(changes, true);
    return this.dedupeDeletes(changes);
  }

  private async planThemeCreate(request: ParsedMutationRequest, timestamp: string, issues: MariDbValidationIssue[]): Promise<PlanChange[]> {
    const meta = getMeta(THEME_TABLE);
    const pk = getPrimary(meta);
    const id = String(request.id ?? newId());
    const name = typeof request.name === "string" ? request.name.trim() : "";
    const css = typeof request.css === "string" ? request.css : "";
    const installedAt = request.installedAt ?? timestamp;
    const existingRows = await this.rawRows(THEME_TABLE);

    this.addThemeNameIssues(name, id, issues);
    if (existingRows.some((row) => row[pk] === id)) {
      issues.push({ level: "error", table: THEME_TABLE, id, message: `Theme id ${id} already exists` });
    }
    if (existingRows.some((row) => row.name === name && row.css === css)) {
      issues.push({ level: "notice", table: THEME_TABLE, id, message: "A theme with the same name and CSS already exists" });
    }

    const changes = request.activate ? this.planThemeActivationChanges(existingRows, id, timestamp) : [];
    const afterRaw = serializeRow(THEME_TABLE, {
      id,
      name,
      css,
      installedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      isActive: request.activate ? THEME_ACTIVE_TRUE : THEME_ACTIVE_FALSE,
    });
    changes.push({
      table: THEME_TABLE,
      id,
      action: "insert",
      before: null,
      after: parseThemeRow(afterRaw),
      beforeRaw: null,
      afterRaw,
      apply: true,
    });
    return changes;
  }

  private async planThemeUpdate(request: ParsedMutationRequest, timestamp: string, issues: MariDbValidationIssue[]): Promise<PlanChange[]> {
    const meta = getMeta(THEME_TABLE);
    const id = String(request.id ?? "");
    const existing = await this.requireRawById(meta, id);
    const next = parseRow(THEME_TABLE, existing);
    if (request.name !== undefined) {
      const name = request.name.trim();
      this.addThemeNameIssues(name, id, issues);
      next.name = name;
    }
    if (request.css !== undefined) next.css = request.css;
    this.fillTimestamps(meta, next, false, timestamp);
    const afterRaw = serializeRow(THEME_TABLE, next);
    if (stableJson(afterRaw) === stableJson(existing)) return [];
    return [
      {
        table: THEME_TABLE,
        id,
        action: "update",
        before: parseThemeRow(existing),
        after: parseThemeRow(afterRaw),
        beforeRaw: existing,
        afterRaw,
        apply: true,
      },
    ];
  }

  private async planThemeSetActive(request: ParsedMutationRequest, timestamp: string, issues: MariDbValidationIssue[]): Promise<PlanChange[]> {
    const targetId = request.id ? String(request.id) : null;
    const rows = await this.rawRows(THEME_TABLE);
    if (targetId && !rows.some((row) => row.id === targetId)) {
      issues.push({ level: "error", table: THEME_TABLE, id: targetId, message: "Theme not found" });
    }
    return this.planThemeActivationChanges(rows, targetId, timestamp);
  }

  private planThemeActivationChanges(rows: Row[], targetId: string | null, timestamp: string): PlanChange[] {
    const meta = getMeta(THEME_TABLE);
    return rows
      .map((row): PlanChange | null => {
        const id = rowId(meta, row);
        const nextActive = targetId && id === targetId ? THEME_ACTIVE_TRUE : THEME_ACTIVE_FALSE;
        if (row.isActive === nextActive) return null;
        const afterRaw = serializeRow(THEME_TABLE, { ...parseRow(THEME_TABLE, row), isActive: nextActive, updatedAt: timestamp });
        return {
          table: THEME_TABLE,
          id,
          action: "update",
          before: parseThemeRow(row),
          after: parseThemeRow(afterRaw),
          beforeRaw: row,
          afterRaw,
          apply: true,
        };
      })
      .filter((change): change is PlanChange => change !== null);
  }

  private addThemeNameIssues(name: string, id: string, issues: MariDbValidationIssue[]) {
    if (!name) issues.push({ level: "error", table: THEME_TABLE, id, message: "Theme name is required" });
    if (name.length > 200) issues.push({ level: "error", table: THEME_TABLE, id, message: "Theme name must be 200 characters or fewer" });
  }

  private fillTimestamps(meta: TableMeta, row: Row, isCreate: boolean, stamp: string) {
    if (isCreate && meta.byKey.has("createdAt") && !row.createdAt) row.createdAt = stamp;
    if (meta.byKey.has("updatedAt") && !row.updatedAt) row.updatedAt = stamp;
  }

  private async addCascadeDeletes(changes: PlanChange[], includeChildren: boolean) {
    if (!includeChildren && changes.length === 0) return;
    const queue = changes.filter((change) => change.action === "delete");
    const seen = new Set(queue.map((change) => `${change.table}:${change.id}`));
    for (let index = 0; index < queue.length; index++) {
      const parent = queue[index]!;
      for (const cascade of CASCADES.filter((entry) => entry.parent === parent.table)) {
        const childMeta = getMeta(cascade.child);
        const parentValue = parent.beforeRaw?.[cascade.parentKey];
        const childRows = (await this.rawRows(cascade.child)).filter((row) => row[cascade.childKey] === parentValue);
        for (const child of childRows) {
          const id = rowId(childMeta, child);
          const key = `${cascade.child}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const childChange: PlanChange = {
            table: cascade.child,
            id,
            action: "delete",
            before: parseRow(cascade.child, child),
            after: null,
            beforeRaw: child,
            afterRaw: null,
            apply: false,
            cascadeOf: `${parent.table}:${parent.id}`,
          };
          changes.push(childChange);
          queue.push(childChange);
        }
      }
    }
  }

  private dedupeDeletes(changes: PlanChange[]): PlanChange[] {
    const out: PlanChange[] = [];
    const seenDeletes = new Set<string>();
    for (const change of changes) {
      if (change.action !== "delete") {
        out.push(change);
        continue;
      }
      const key = `${change.table}:${change.id}`;
      if (seenDeletes.has(key)) continue;
      seenDeletes.add(key);
      out.push(change);
    }
    return out;
  }

  private async validateTouchedRows(changes: PlanChange[], tables: string[], priorIssues: MariDbValidationIssue[]): Promise<MariDbValidationResult> {
    const issues = [...priorIssues];
    for (const change of changes) {
      if (change.action === "delete") continue;
      const meta = getMeta(change.table);
      const row = change.afterRaw ?? {};
      addUnknownColumnIssues(meta, row, change.id, issues);
      const pk = getPrimary(meta);
      if (typeof row[pk] !== "string" || String(row[pk]).trim().length === 0) {
        issues.push({ level: "error", table: change.table, id: change.id, message: `Missing primary key ${pk}` });
      }
      for (const column of meta.columns) {
        if (column.notNull && (row[column.key] === null || row[column.key] === undefined)) {
          issues.push({ level: "error", table: change.table, id: change.id, message: `Missing required column ${column.key}` });
        }
      }
      for (const key of JSON_COLUMNS[change.table] ?? []) {
        const value = row[key];
        if (value === null || value === undefined || value === "") continue;
        if (typeof value !== "string") continue;
        try {
          JSON.parse(value);
        } catch {
          issues.push({ level: "error", table: change.table, id: change.id, message: `Column ${key} is not valid JSON` });
        }
      }
      addCharacterDataShapeIssues(change.table, row, change.id, issues);
    }

    const parentRowsByTable = new Map<string, Row[]>();
    const parentRows = async (table: string) => {
      const cached = parentRowsByTable.get(table);
      if (cached) return cached;
      const rows = await this.rawRows(table);
      parentRowsByTable.set(table, rows);
      return rows;
    };
    for (const change of changes) {
      if (change.action === "delete") continue;
      for (const cascade of CASCADES.filter((entry) => entry.child === change.table)) {
        const ref = change.afterRaw?.[cascade.childKey];
        if (typeof ref !== "string" || !ref) continue;
        const parentInsertedOrUpdated = changes.some(
          (entry) => entry.table === cascade.parent && entry.action !== "delete" && entry.afterRaw?.[cascade.parentKey] === ref,
        );
        const parentDeleted = changes.some(
          (entry) => entry.table === cascade.parent && entry.action === "delete" && entry.beforeRaw?.[cascade.parentKey] === ref,
        );
        const parentExists = !parentDeleted && (await parentRows(cascade.parent)).some((row) => row[cascade.parentKey] === ref);
        if (!parentInsertedOrUpdated && !parentExists) {
          issues.push({
            level: "error",
            table: change.table,
            id: change.id,
            message: `Dangling reference ${cascade.childKey}=${ref} -> ${cascade.parent}.${cascade.parentKey}`,
          });
        }
      }
    }

    const fullValidation = await this.validate();
    // Keep current unrelated optional notices visible to Mari, but only let touched-scope errors block.
    // Existing errors on rows being repaired/deleted must not make the repair impossible.
    const touched = new Set(tables);
    const touchedRows = new Set(changes.map((change) => `${change.table}:${change.id}`));
    const scopedExistingErrors = fullValidation.errors.filter((issue) => {
      if (!issue.table || !touched.has(issue.table)) return false;
      const issueId = issue.id == null ? null : String(issue.id);
      return !issueId || !touchedRows.has(`${issue.table}:${issueId}`);
    });
    return validationFromIssues([...issues, ...scopedExistingErrors, ...fullValidation.notices, ...fullValidation.infos]);
  }

  private async applyPlan(plan: Plan): Promise<string> {
    const operationId = newId();
    const journalPath = await this.writeJournal(operationId, plan);
    await this.db.transaction(async (tx) => {
      const characterStorage = createCharactersStorage(tx as unknown as DB);
      for (const change of plan.changes) {
        if (!change.apply) continue;
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        if ((change.action === "update" || change.action === "replace") && change.table === "characters") {
          await characterStorage.createVersionSnapshot(change.id, {
            source: "professor-mari-workspace",
            reason: plan.reason ?? "Professor Mari database change",
          });
        }
        if (change.action === "insert") {
          await tx.insert(meta.table as any).values(knownColumnPatch(meta, change.afterRaw ?? {}));
        } else if (change.action === "update" || change.action === "replace") {
          await tx
            .update(meta.table as any)
            .set(knownColumnPatch(meta, change.afterRaw ?? {}))
            .where(eq(meta.byKey.get(pk)!.column as any, change.id));
        } else if (change.action === "delete") {
          await tx.delete(meta.table as any).where(eq(meta.byKey.get(pk)!.column as any, change.id));
        }
      }
    });
    const validation = await this.validate();
    if (validation.status === "blocked") {
      const touchedRows = new Set(plan.changes.map((change) => `${change.table}:${change.id}`));
      const touchedErrors = validation.errors.filter((issue) => issue.table && issue.id != null && touchedRows.has(`${issue.table}:${String(issue.id)}`));
      if (touchedErrors.length > 0) {
        throw new Error(`Post-apply validation failed: ${touchedErrors.map((issue) => issue.message).join("; ")}`);
      }
      logger.warn("[mari-db] post-apply validation still reports unrelated errors: %s", validation.errors.map((issue) => issue.message).join("; "));
    }
    await flushDB();
    return journalPath;
  }

  private async restorePlan(plan: Plan): Promise<void> {
    await this.db.transaction(async (tx) => {
      const insertedRows = [...plan.changes].reverse().filter((change) => change.action === "insert");
      for (const change of insertedRows) {
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        await tx.delete(meta.table as any).where(eq(meta.byKey.get(pk)!.column as any, change.id));
      }

      const updatedRows = plan.changes.filter((change) => change.action === "update" || change.action === "replace");
      for (const change of updatedRows) {
        if (!change.beforeRaw) continue;
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        await tx
          .update(meta.table as any)
          .set(knownColumnPatch(meta, change.beforeRaw))
          .where(eq(meta.byKey.get(pk)!.column as any, change.id));
      }

      const deletedRows = plan.changes.filter((change) => change.action === "delete");
      for (const change of [...deletedRows].reverse()) {
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        await tx.delete(meta.table as any).where(eq(meta.byKey.get(pk)!.column as any, change.id));
      }
      for (const change of deletedRows) {
        if (!change.beforeRaw) continue;
        const meta = getMeta(change.table);
        await tx.insert(meta.table as any).values(knownColumnPatch(meta, change.beforeRaw));
      }
    });

    const validation = await this.validate();
    if (validation.status === "blocked") {
      const touchedRows = new Set(plan.changes.map((change) => `${change.table}:${change.id}`));
      const touchedErrors = validation.errors.filter((issue) => issue.table && issue.id != null && touchedRows.has(`${issue.table}:${String(issue.id)}`));
      if (touchedErrors.length > 0) {
        throw new Error(`Post-restore validation failed: ${touchedErrors.map((issue) => issue.message).join("; ")}`);
      }
      logger.warn("[mari-db] post-restore validation still reports unrelated errors: %s", validation.errors.map((issue) => issue.message).join("; "));
    }
    await flushDB();
  }

  private async writeJournal(operationId: string, plan: Plan): Promise<string> {
    const dir = this.journalDir();
    await mkdir(dir, { recursive: true });
    const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}_mari-db_${operationId}.jsonl`;
    const path = join(dir, filename);
    const lines = plan.changes.map((change) =>
      JSON.stringify({
        operationId,
        table: change.table,
        id: change.id,
        action: change.action,
        before: change.before ?? null,
        after: change.after ?? null,
        reason: plan.reason ?? null,
        createdAt: now(),
      }),
    );
    await writeFile(path, lines.join("\n") + "\n", "utf8");
    return path;
  }

  private createAppliedReview(
    plan: Plan,
    command: string,
    sessionId: string,
    journalPath: string | null,
    historyId: string | null,
  ): MariDbPendingApproval {
    const id = newId();
    const requestedAt = now();
    const expiresAt = new Date(Date.now() + APPROVAL_TIMEOUT_MS).toISOString();
    const timer = setTimeout(() => {
      this.pending.delete(id);
    }, APPROVAL_TIMEOUT_MS);
    timer.unref?.();
    const record: PendingRecord = {
      kind: "applied_review",
      id,
      sessionId,
      command,
      reason: plan.reason,
      operationHash: plan.operationHash,
      requestedAt,
      expiresAt,
      affectedTables: plan.summary.affectedTables,
      affectedRows: plan.summary.affectedRows,
      validationStatus: plan.validation.status,
      diffPreview: plan.summary.preview,
      diffTruncated: plan.summary.truncated,
      plan,
      historyId,
      journalPath,
      timer,
    };
    this.pending.set(id, record);
    return this.pendingView(record);
  }

  private pendingView(record: PendingRecord): MariDbPendingApproval {
    const { plan: _plan, historyId: _historyId, journalPath: _journalPath, timer: _timer, ...view } = record;
    return view;
  }

  private async recordHistory(args: { plan: Plan; command: string; sessionId: string; status: MariDbHistoryEntry["status"]; journalPath: string | null }) {
    const entry: MariDbHistoryEntry = {
      id: newId(),
      sessionId: args.sessionId,
      command: args.command,
      reason: args.plan.reason,
      status: args.status,
      operationHash: args.plan.operationHash,
      affectedTables: args.plan.summary.affectedTables,
      affectedRows: args.plan.summary.affectedRows,
      validationStatus: args.plan.validation.status,
      journalPath: args.journalPath,
      createdAt: now(),
      completedAt: now(),
    };
    this.history.push(entry);
    this.history = this.history.slice(-HISTORY_LIMIT);
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        await mkdir(this.journalDir(), { recursive: true });
        await appendFile(this.historyPath(), JSON.stringify(entry) + "\n", "utf8");
      });
    await this.writeQueue.catch((err) => logger.warn(err, "[mari-db] failed to write history"));
    return entry;
  }

  private async rawRows(table: string): Promise<Row[]> {
    const meta = getMeta(table);
    const rows = (await this.db.select().from(meta.table as any)) as Row[];
    return rows.map((row) => ({ ...row }));
  }

  private async getRawById(meta: TableMeta, id: string): Promise<Row | null> {
    const pk = getPrimary(meta);
    const rows = (await this.db.select().from(meta.table as any).where(eq(meta.byKey.get(pk)!.column as any, id))) as Row[];
    return rows[0] ? { ...rows[0] } : null;
  }

  private async requireRawById(meta: TableMeta, id: string): Promise<Row> {
    const row = await this.getRawById(meta, id);
    if (!row) throw new Error(`No row found in ${meta.name} with ${getPrimary(meta)}=${id}`);
    return row;
  }

  private journalDir() {
    return join(getFileStorageDir(), "journal");
  }

  private historyPath() {
    return join(this.journalDir(), "mari-db-history.jsonl");
  }

  private topLevelHelpText() {
    return [
      "Usage: mari <group> <command>",
      "Core code/workspace: mari code status|diff|check|health|reload",
      "Live app data:       mari db status|tables|list|get|search|insert|patch|replace|delete|transform|validate",
      "Customization:       mari themes list|active|get|create|update|set-active",
      "Images/media:        mari images connections|preview|generate|edit|assign|delete|list",
      "Creative data:       mari characters list|get|search|create|update|delete",
      "Creative data:       mari personas list|active|get|search|create|update|delete",
      "Creative data:       mari lorebooks list|get|get-entry <entry-id>|entries <lorebook-id>|search|create|update <lorebook-id>|add-entry <lorebook-id>|update-entry <entry-id>|delete-entry <entry-id>|link-character|unlink-character|delete",
      "Chats (read-only):   mari chats list|get|messages|search",
      "Fandom/wiki reads:   mari wiki find-wikis|search-all|search|get-page|sections|category|site-info",
      "Discovery:           mari <group> --help or mari <group> <command> --help",
      "Writes dry-run by default where supported; --apply saves reversible changes and shows a Keep/Restore review card.",
    ].join("\n");
  }

  private charactersHelpText() {
    return [
      "Usage: mari characters <command>",
      "Read:  list [--limit <n>] [--search <text>]",
      "Read:  get <id>",
      "Read:  search <query> [--limit <n>]",
      "Write: create (--name <name> [--description <text>] [--personality <text>] [--scenario <text>] [--first-mes <text>] [--creator-notes <text>] [--backstory <text>] [--appearance <text>] [--about-me <text>] [--tags <t1,t2,...>] [--comment <text>] | --json '<data_json>' | --json-file <path>) [--apply] [--reason <text>]",
      "       --backstory, --appearance, and --about-me write to matching data.extensions fields",
      "Write: update <id> [--name <name>] [--description <text>] [--personality <text>] [--scenario <text>] [--first-mes <text>] [--creator-notes <text>] [--backstory <text>] [--appearance <text>] [--about-me <text>] [--tags <t1,t2,...>] [--comment <text>] [--json '<data_json>' | --json-file <path>] [--apply] [--reason <text>]",
      "Write: delete <id> [--apply] [--reason <text>]",
      "Writes dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card.",
    ].join("\n");
  }

  private personasHelpText() {
    return [
      "Usage: mari personas <command>",
      "Read:  list [--limit <n>]",
      "Read:  active",
      "Read:  get <id>",
      "Read:  search <query> [--limit <n>]",
      "Write: create --name <name> [--description <text>] [--personality <text>] [--scenario <text>] [--backstory <text>] [--appearance <text>] [--phonetic-name <text>] [--convo-display-name <text>] [--about-me <text>] [--convo-behavior <text-or-json>] [--comment <text>] [--creator <text>] [--creator-notes <text>] [--apply] [--reason <text>]",
      "Write: update <id> [--name <name>] [--description <text>] [--personality <text>] [--scenario <text>] [--backstory <text>] [--appearance <text>] [--phonetic-name <text>] [--convo-display-name <text>] [--about-me <text>] [--convo-behavior <text-or-json>] [--tags <t1,t2,...>] [--comment <text>] [--creator <text>] [--creator-notes <text>] [--apply] [--reason <text>]",
      "Write: delete <id> [--apply] [--reason <text>]",
      "Writes dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card.",
    ].join("\n");
  }

  private lorebooksHelpText() {
    return [
      "Usage: mari lorebooks <command>",
      "Read:  list [--limit <n>] [--global] [--character <id>]",
      "Read:  get <id>",
      "Read:  entries <lorebook-id> [--limit <n>] [--entry-id <entry-id>]",
      "Read:  get-entry <entry-id>",
      "Read:  search <query> [--limit <n>]",
      "Write: create --name <name> [--description <text>] [--category <text>] [--global] [--apply] [--reason <text>]",
      "Write: update <id> [--name <name>] [--description <text>] [--category <text>] [--tags <t1,t2,...>] [--global] [--enable] [--disable] [--apply] [--reason <text>]",
      "Write: add-entry <lorebook-id> --name <name> [--content <text>] [--keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--folder-id <folder-id>] [--apply] [--reason <text>]",
      "Write: update-entry <entry-id> [--name <name>] [--content <text>] [--keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--enable] [--disable] [--constant] [--no-constant] [--order <n>] [--folder-id <folder-id>|none] [--apply] [--reason <text>]",
      "Write: delete-entry <entry-id> [--apply] [--reason <text>]",
      "Write: link-character <lorebook-id> --character <character-id> [--apply] [--reason <text>]",
      "Write: unlink-character <lorebook-id> --character <character-id> [--apply] [--reason <text>]",
      "Write: delete <id> [--cascade] [--apply] [--reason <text>]",
      "Writes dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card.",
    ].join("\n");
  }

  private chatsHelpText() {
    return [
      "Usage: mari chats <command>",
      "Read:  list [--limit <n>] [--character <id>]",
      "Read:  get <id>",
      "Read:  messages <chat-id> [--limit <n>] [--offset <n>] [--tail]",
      "Read:  search <query> [--limit <n>]",
      "All chat commands are read-only.",
    ].join("\n");
  }

  private codeHelpText() {
    return [
      "Usage: mari code <command>",
      "status                 Show workspace, runtime, git status, changed files, and diff stat.",
      "diff [--patch]          Show changed files and git diff --stat. Add --patch for a truncated patch.",
      "diff --cached [--patch] Show staged changed files and diff summary.",
      "check [--changed]       Run validation. --changed currently falls back to baseline pnpm check.",
      "health                 Show server/runtime health and database validation status.",
      "reload request --kind client|server|full --reason <text> [--resume]",
      "continue <run-id>       Planned durable resume command; not implemented yet.",
      "Examples:",
      "  mari code status",
      "  mari code diff --patch",
      "  mari code check",
      "  mari code reload request --kind server --reason \"Server route changed\" --resume",
    ].join("\n");
  }

  private codeReloadHelpText() {
    return [
      "Usage: mari code reload request --kind client|server|full --reason <text> [--resume]",
      "Records that a reload/restart is needed and returns manual resume instructions for this build.",
      "Automatic suspend/resume cards are planned for the durable workspace-runs phase.",
    ].join("\n");
  }

  private themeHelpText() {
    return [
      "Usage: mari themes <command>",
      "Read: list [--active] [--limit <n>], active, get <id>",
      "Write: create --name <name> (--css <css> | --css-file <path>) [--activate] [--apply] [--reason <text>]",
      "Write: update <id> [--name <name>] [--css <css> | --css-file <path>] [--apply] [--reason <text>]",
      "Write: set-active <id|none> [--apply] [--reason <text>]",
      "Writes dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card.",
    ].join("\n");
  }

  private helpText() {
    return [
      "Usage: mari db <command>",
      "Discovery: status, tables, schema <table>, counts, data-dir, now, new-id",
      "Read: list <table>, get <table> <id>, select <table> --where <expr>, search <table|all> <query>, validate [--table <table>]",
      "Write: insert|patch|replace|delete|transform ... (dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card)",
      `Known tables: ${FILE_BACKED_TABLES.slice(0, 8).join(", ")} ... (${FILE_BACKED_TABLES.length})`,
      `Journal directory: ${this.journalDir()} (${basename(getFileStorageDir())})`,
    ].join("\n");
  }
}

let singleton: MariDbService | null = null;
export function getMariDbService(db: DB) {
  if (!singleton) singleton = new MariDbService(db);
  return singleton;
}
