// ──────────────────────────────────────────────
// Professor Mari DB service
// ──────────────────────────────────────────────
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
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
import {
  clearCharacterEmbeddedLorebook,
  embedLorebookIntoCharacter,
  resolveEmbeddedCharacterId,
  syncCharacterBookFromLorebook,
} from "../lorebook/character-book-sync.js";
import {
  createMariInstructionsStorage,
  MAX_INSTRUCTION_CONTENT_LENGTH,
  MAX_INSTRUCTION_DESCRIPTION_LENGTH,
  MAX_INSTRUCTION_NAME_LENGTH,
} from "../storage/mari-instructions.storage.js";
import { newId, now } from "../../utils/id-generator.js";
import { normalizeThemeCss } from "../../utils/theme-css.js";
import { getMariImagesService } from "./mari-images.service.js";
import { executeWikiCli } from "../professor-mari/fandom-mediawiki/wiki-cli.js";
import {
  LIMITS,
  PROFESSOR_MARI_ID,
  HOME_CUSTOM_WIDGET_LIMIT,
  HOME_CUSTOM_WIDGETS_SETTINGS_KEY,
  createPersonalExtensionSchema,
  homeCustomWidgetCatalogSchema,
  homeCustomWidgetDraftSchema,
  homeCustomWidgetSchema,
  normalizeLorebookCategory,
  normalizePersonalExtensionCapabilities,
  type MariDbCommandResult,
  type MariDbReadTruncation,
  type MariDbDiffSummary,
  type MariDbHistoryEntry,
  type MariDbPendingApproval,
  type MariDbRowChange,
  type MariDbValidationIssue,
  type MariDbValidationResult,
} from "@marinara-engine/shared";
import { computePersonalExtensionHash } from "../extensions/personal-extension-hash.js";
import { HomeWidgetCatalogConflictError, replaceHomeWidgetCatalog } from "../home-widget-catalog.service.js";
import { createMariWherePredicate } from "./mari-where-expression.js";
import { runMariTransformSandbox } from "./mari-transform-sandbox.js";
import { encryptCustomToolWebhookUrl, ENCRYPTED_WEBHOOK_PREFIX } from "../../utils/custom-tool-webhook.js";

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
  embeddedCharacterId?: string;
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
  kind:
    | "insert"
    | "patch"
    | "replace"
    | "delete"
    | "transform"
    | "theme-create"
    | "theme-update"
    | "theme-set-active"
    | "character-move-folder"
    | "preset-section-delete"
    | "preset-group-delete";
  table: string | "all";
  id?: string;
  characterId?: string;
  folderId?: string;
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
  personalExtensionDraftMutation?: boolean;
  instructionMutation?: boolean;
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
};

function homeWidgetCatalogFromPlanRow(row: Row | null | undefined) {
  if (typeof row?.value !== "string") return homeCustomWidgetCatalogSchema.parse({ widgets: [] });
  return homeCustomWidgetCatalogSchema.parse(JSON.parse(row.value));
}

function singleHomeWidgetCatalogChange(plan: Plan): PlanChange | null {
  const applied = plan.changes.filter((change) => change.apply);
  if (
    applied.length !== 1 ||
    applied[0]?.table !== "app_settings" ||
    applied[0].id !== HOME_CUSTOM_WIDGETS_SETTINGS_KEY
  ) {
    return null;
  }
  return applied[0];
}

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
const HISTORY_LIMIT = 50;
// #4813 (durable review): applied-review undo cards are persisted to disk so a Keep/Restore
// survives a restart instead of vanishing after a timer. Keep at most this many; prune ones past
// the retention window on load. The cap mirrors HISTORY_LIMIT.
const PENDING_REVIEW_LIMIT = HISTORY_LIMIT;
const PENDING_REVIEW_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
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
  "case-sensitive",
  "changed",
  "constant",
  "disable",
  "dry-run",
  "enable",
  "full",
  "global",
  "help",
  "jsonl",
  "match-whole-words",
  "no-case-sensitive",
  "no-constant",
  "no-global",
  "no-match-whole-words",
  "no-selective",
  "no-use-regex",
  "parsed",
  "patch",
  "raw",
  "resume",
  "selective",
  "staged",
  "strict",
  "tail",
  "use-regex",
]);

function truncateOutput(value: string, limit = COMMAND_OUTPUT_LIMIT): { text: string; truncated: boolean } {
  if (value.length <= limit) return { text: value, truncated: false };
  return { text: `${value.slice(0, limit)}\n… output truncated at ${limit} characters …`, truncated: true };
}

function appendLimited(
  current: string,
  chunk: string,
  limit = COMMAND_OUTPUT_LIMIT,
): { text: string; truncated: boolean } {
  if (current.length >= limit) return { text: current, truncated: true };
  const next = current + chunk;
  return truncateOutput(next, limit);
}

function displayCommand(bin: string, args: string[]) {
  return [bin, ...args].map((part) => (/[\s"']/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function runProcess(
  bin: string,
  args: string[],
  options: { cwd: string; timeoutMs: number },
): Promise<ProcessRunResult> {
  const startedAt = Date.now();
  const command = displayCommand(bin, args);
  return new Promise((resolveRun) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let settled = false;
    let timedOut = false;

    const useWindowsCommand = process.platform === "win32" && bin === "pnpm";
    const windowsCommand = useWindowsCommand
      ? [bin, ...args]
          .map((part) => {
            if (!/^[A-Za-z0-9@._/:=+-]+$/u.test(part)) {
              throw new Error(`Unsupported character in command argument: ${part}`);
            }
            return part;
          })
          .join(" ")
      : "";
    const child = spawn(
      useWindowsCommand ? (process.env.ComSpec ?? "cmd.exe") : bin,
      useWindowsCommand ? ["/d", "/s", "/c", windowsCommand] : args,
      {
        cwd: options.cwd,
        env: process.env,
        windowsHide: true,
      },
    );

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
  installed_extensions: ["capabilities", "revisions"],
  game_state_snapshots: [
    "presentCharacters",
    "recentEvents",
    "playerStats",
    "personaStats",
    "manualOverrides",
    "fieldLocks",
  ],
  game_checkpoints: ["snapshotData", "spatialSnapshotData"],
  // chat_images, character_images, assets, and custom_themes
  // have no JSON columns; their former entries named columns that do not exist.
  game_engine_state: ["state"],
  regex_scripts: ["trimStrings", "placement", "targetCharacterIds", "targetPromptPresetIds"],
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

function secureCustomToolRequestForStorage(
  request: ParsedMutationRequest,
  encryptedWebhooks: ReadonlyMap<string, string>,
): void {
  const secureRow = (row: Row | undefined) => {
    if (!row || typeof row.webhookUrl !== "string") return;
    row.webhookUrl = encryptedWebhooks.get(row.webhookUrl) ?? encryptCustomToolWebhookUrl(row.webhookUrl);
  };
  if (request.table === "custom_tools") {
    secureRow(request.row);
    secureRow(request.patch);
  }
  for (const related of request.relatedInserts ?? []) {
    if (related.table === "custom_tools") secureRow(related.row);
  }
}

function commandForStorage(request: ParsedMutationRequest, command: string): string {
  const hasWebhookCredential =
    (request.table === "custom_tools" &&
      [request.row?.webhookUrl, request.patch?.webhookUrl].some((value) => typeof value === "string" && value)) ||
    (request.relatedInserts ?? []).some(
      (related) =>
        related.table === "custom_tools" && typeof related.row.webhookUrl === "string" && related.row.webhookUrl,
    );
  return hasWebhookCredential ? `mari db ${request.kind} ${request.table} [webhook credential redacted]` : command;
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

function protectPromptPresetSystemKeys(changes: PlanChange[]): void {
  for (const change of changes) {
    if (change.table !== "prompt_presets" || !change.afterRaw) continue;
    change.afterRaw.systemKey =
      change.action === "insert"
        ? ""
        : typeof change.beforeRaw?.systemKey === "string"
          ? change.beforeRaw.systemKey
          : "";
    delete change.afterRaw.system_key;
    change.after = parseRow(change.table, change.afterRaw);
  }
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

// Thrown by restorePlan (#4852 F2) when a row a Restore would revert was changed by a newer
// write after this review applied. Caught in restoreAppliedReview so the newer data is left
// untouched and the pending review survives instead of silently clobbering it.
class RestoreStateChangedError extends Error {}

// Optimistic-concurrency check for Restore. `afterRaw` is the exact serialized row this review
// wrote at apply time (a full row, or null for a delete); `current` is the live row read inside
// the restore transaction. Returns true when the live state has diverged from what this review
// applied, meaning restoring would overwrite a newer edit.
//
// Compared ONLY over the columns present in this review's afterRaw snapshot (via
// knownColumnPatch(meta, afterRaw), NOT knownColumnPatch(current), which the file-native store
// can pad with extra null columns the review never wrote, producing false conflicts). applyPlan
// writes knownColumnPatch(meta, afterRaw) verbatim, so immediately post-apply the stored row's
// known columns equal afterRaw's; any later divergence is a real newer write.
function restoreRowSuperseded(meta: TableMeta, current: Row | null, afterRaw: Row | null): boolean {
  if (afterRaw == null) return current != null; // delete-undo: a newer write re-created the row
  if (current == null) return true; // a newer write deleted the row this review left in place
  const expected = knownColumnPatch(meta, afterRaw);
  for (const key of Object.keys(expected)) {
    if ((current[key] ?? null) !== (expected[key] ?? null)) return true;
  }
  return false;
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

function parseChatRangeInteger(value: string | undefined, flag: string, options: { minimum: number; maximum: number }) {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < options.minimum || parsed > options.maximum) {
    throw new Error(`--${flag} must be an integer from ${options.minimum} to ${options.maximum}`);
  }
  return parsed;
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

// #4812: map `mari presets` CLI flags to the data object the preset.* app_data actions accept, so
// the CLI delegates to executePresetAction instead of reimplementing every child edit. Extra keys
// are harmless — each action's field list keeps only what it uses.
function presetDataFromFlags(flags: Map<string, string | boolean>): Row {
  const data: Row = {};
  const setStr = (flag: string, key: string) => {
    const value = flagString(flags, flag);
    if (value !== undefined) data[key] = value;
  };
  const setNum = (flag: string, key: string) => {
    const value = flagString(flags, flag);
    if (value === undefined || value.trim() === "") return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error(`--${flag} must be a number, got "${value}"`);
    data[key] = parsed;
  };
  setStr("name", "name");
  setStr("content", "content");
  setStr("role", "role");
  setStr("identifier", "identifier");
  setStr("group-id", "groupId");
  setStr("parent-group-id", "parentGroupId");
  setStr("injection-position", "injectionPosition");
  setNum("injection-depth", "injectionDepth");
  setNum("injection-order", "injectionOrder");
  setNum("order", "order");
  setStr("variable-name", "variableName");
  setStr("question", "question");
  setStr("separator", "separator");
  setStr("display-mode", "displayMode");
  setStr("option-sort", "optionSort");
  setNum("sort-order", "sortOrder");
  if (hasFlag(flags, "enable")) data.enabled = true;
  if (hasFlag(flags, "disable")) data.enabled = false;
  if (hasFlag(flags, "marker")) data.isMarker = true;
  if (hasFlag(flags, "multi-select")) data.multiSelect = true;
  if (hasFlag(flags, "random-pick")) data.randomPick = true;
  const options = flagString(flags, "options");
  if (options !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(options);
    } catch {
      parsed = undefined;
    }
    data.options = Array.isArray(parsed)
      ? parsed
      : options
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean);
  }
  return data;
}

function normalizeAppDataActionName(action: string): string {
  let key = action
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
  key = key
    .replace(/^characters\./, "character.")
    .replace(/^personas\./, "persona.")
    .replace(/^lorebooks\./, "lorebook.")
    .replace(/^themes\./, "theme.")
    .replace(/^personalextensions\./, "personalextension.")
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
    "lorebook.entry.delete": "lorebook.deleteentry",
    "lorebook.entries.delete": "lorebook.deleteentry",
    "lorebook.entry.remove": "lorebook.deleteentry",
    "lorebook.entries.remove": "lorebook.deleteentry",
    "lorebook.removeentry": "lorebook.deleteentry",
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

// #4851: Mari-authored memory rows. Writes flow through executeMutation so each
// gets a Keep/Restore card showing the exact text before it becomes a standing
// instruction. Over-cap fields are REJECTED, not silently truncated, so a long
// file the user asks Mari to remember never lands half-saved without anyone knowing.
function requireInstructionLength(value: string, max: number, field: string): string {
  if (value.length > max) {
    throw new Error(
      `That memory's ${field} is ${value.length} characters; the maximum is ${max}. Trim it or split it into two memories.`,
    );
  }
  return value;
}

function buildInstructionInsertRow(data: Row, id: string, timestamp: string): Row {
  const name = requireInstructionLength(
    (firstString(data, ["name", "title", "label"]) ?? "").trim(),
    MAX_INSTRUCTION_NAME_LENGTH,
    "name",
  );
  if (!name) throw new Error("A memory needs a name.");
  const content = requireInstructionLength(
    (firstString(data, ["content", "text", "body", "memory"]) ?? "").trim(),
    MAX_INSTRUCTION_CONTENT_LENGTH,
    "content",
  );
  if (!content) throw new Error("A memory needs content: the thing to remember.");
  return {
    id,
    name,
    description: requireInstructionLength(
      (firstString(data, ["description", "summary"]) ?? "").trim(),
      MAX_INSTRUCTION_DESCRIPTION_LENGTH,
      "description",
    ),
    content,
    persistent:
      firstBoolean(data, ["persistent", "pinned", "always", "alwaysInject", "always_inject"]) === true ? 1 : 0,
    // Disabled, ALWAYS: a Mari-authored memory is inert until the USER enables it (via the
    // Memories panel or "Keep & Enable" on the review card). Mari never sets `enabled` herself,
    // so a prompt-injection cannot induce a self-activating memory. Defense-in-depth.
    enabled: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildInstructionPatch(data: Row): Row {
  const patch: Row = { updatedAt: now() };
  const name = firstString(data, ["name", "title", "label"]);
  if (name !== undefined) {
    const trimmed = requireInstructionLength(name.trim(), MAX_INSTRUCTION_NAME_LENGTH, "name");
    if (trimmed) patch.name = trimmed;
  }
  // Description is optional and clearable: detect the key's presence directly (firstString skips
  // "") so a supplied "" reaches the always-injected index instead of leaving the stale value.
  const descriptionKey = ["description", "summary"].find((key) => typeof data[key] === "string");
  if (descriptionKey !== undefined) {
    patch.description = requireInstructionLength(
      (data[descriptionKey] as string).trim(),
      MAX_INSTRUCTION_DESCRIPTION_LENGTH,
      "description",
    );
  }
  const content = firstString(data, ["content", "text", "body", "memory"]);
  if (content !== undefined) {
    const trimmed = requireInstructionLength(content.trim(), MAX_INSTRUCTION_CONTENT_LENGTH, "content");
    if (trimmed) patch.content = trimmed;
  }
  const persistent = firstBoolean(data, ["persistent", "pinned", "always", "alwaysInject", "always_inject"]);
  if (persistent !== undefined) patch.persistent = persistent ? 1 : 0;
  // Intentionally no `enabled`: Mari never sets a memory's enabled state (create OR update).
  // Only the user enables/disables, via "Keep & Enable" or the Memories panel, so an injected
  // instruction.update cannot silently activate a standing directive behind a small field diff.
  return patch;
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
  for (const key of [
    "first_mes",
    "mes_example",
    "creator_notes",
    "system_prompt",
    "post_history_instructions",
    "character_version",
    "alternate_greetings",
  ]) {
    if (out[key] === undefined) delete out[key];
  }
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

const SELECTIVE_LOGIC_VALUES = new Set(["and", "and_all", "or", "not", "not_all"]);
const LOREBOOK_FILTER_MODE_VALUES = new Set(["any", "include", "exclude"]);
const LOREBOOK_MATCHING_SOURCE_VALUES = new Set([
  "character_name",
  "character_description",
  "character_personality",
  "character_scenario",
  "character_tags",
  "persona_description",
  "persona_tags",
]);

/** Validate a selectiveLogic string against the stored enum; undefined if absent or invalid. */
function normalizeSelectiveLogicValue(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  return SELECTIVE_LOGIC_VALUES.has(normalized) ? normalized : undefined;
}

/** Validate an incoming selectiveLogic against the stored enum; undefined if absent or invalid. */
function normalizeSelectiveLogic(source: Row): string | undefined {
  return normalizeSelectiveLogicValue(firstString(source, ["selectiveLogic", "selective_logic"]));
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
    selective: boolText(firstBoolean(data, ["selective"]) ?? false),
    selectiveLogic: normalizeSelectiveLogic(data) ?? "and",
    matchWholeWords: boolText(firstBoolean(data, ["matchWholeWords", "match_whole_words"]) ?? false),
    caseSensitive: boolText(firstBoolean(data, ["caseSensitive", "case_sensitive"]) ?? false),
    useRegex: boolText(firstBoolean(data, ["useRegex", "use_regex"]) ?? false),
    characterFilterMode: "any",
    characterFilterIds: [],
    characterTagFilterMode: "any",
    characterTagFilters: [],
    generationTriggerFilterMode: "any",
    generationTriggerFilters: [],
    additionalMatchingSources: [],
    position: firstNumber(data, ["position"]) ?? 0,
    outletName: firstString(data, ["outletName", "outlet_name"]) ?? "",
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
    versioningEnabled:
      data.versioningEnabled === false ||
      data.versioningEnabled === "false" ||
      data.versioning_enabled === false ||
      data.versioning_enabled === "false"
        ? "false"
        : "true",
    creatorNotes: firstString(data, ["creatorNotes", "creator_notes", "creator-notes"]) ?? "",
    phoneticName: firstString(data, ["phoneticName", "phonetic_name", "phonetic-name"]) ?? "",
    description: firstString(data, ["description"]) ?? "",
    personality: firstString(data, ["personality"]) ?? "",
    scenario: firstString(data, ["scenario"]) ?? "",
    backstory: firstString(data, ["backstory"]) ?? "",
    appearance: firstString(data, ["appearance"]) ?? "",
    useCharacterSheetAsReference: "false",
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
    type:
      firstString(input, ["type", "agentType", "agent_type"]) ??
      (typeof existing?.type === "string" ? existing.type : `custom-${slugFromName(name)}`),
    name,
    description:
      firstString(input, ["description"]) ?? (typeof existing?.description === "string" ? existing.description : ""),
    phase: firstString(input, ["phase"]) ?? (typeof existing?.phase === "string" ? existing.phase : "parallel"),
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
    description:
      firstString(input, ["description"]) ?? (typeof existing?.description === "string" ? existing.description : ""),
    imagePath:
      input.imagePath === undefined && input.image_path === undefined
        ? (existing?.imagePath ?? null)
        : (input.imagePath ?? input.image_path ?? null),
    conversationPrompt:
      firstString(input, ["conversationPrompt", "conversation_prompt"]) ??
      (typeof existing?.conversationPrompt === "string" ? existing.conversationPrompt : ""),
    gamePrompt:
      firstString(input, ["gamePrompt", "game_prompt"]) ??
      (typeof existing?.gamePrompt === "string" ? existing.gamePrompt : ""),
    sectionOrder: jsonString(input.sectionOrder ?? input.section_order ?? existing?.sectionOrder, []),
    groupOrder: jsonString(input.groupOrder ?? input.group_order ?? existing?.groupOrder, []),
    variableGroups: jsonString(input.variableGroups ?? input.variable_groups ?? existing?.variableGroups, []),
    variableValues: jsonString(input.variableValues ?? input.variable_values ?? existing?.variableValues, {}),
    parameters: jsonString(input.parameters ?? existing?.parameters, {}),
    wrapFormat:
      firstString(input, ["wrapFormat", "wrap_format"]) ??
      (typeof existing?.wrapFormat === "string" ? existing.wrapFormat : "xml"),
    defaultChoices: jsonString(input.defaultChoices ?? input.default_choices ?? existing?.defaultChoices, {}),
    isDefault: boolText(
      firstBoolean(input, ["isDefault", "is_default"]) ?? (existing ? existing.isDefault === "true" : false),
    ),
    author: firstString(input, ["author"]) ?? (typeof existing?.author === "string" ? existing.author : ""),
    // Engine-owned preset identity is never writable through Professor Mari.
    systemKey: typeof existing?.systemKey === "string" ? existing.systemKey : "",
  };
  delete row.conversation_prompt;
  delete row.game_prompt;
  delete row.image_path;
  delete row.section_order;
  delete row.group_order;
  delete row.variable_groups;
  delete row.variable_values;
  delete row.wrap_format;
  delete row.default_choices;
  delete row.is_default;
  delete row.system_key;
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

// #4812: field-by-field patch builders for granular section/group/choice-block edits. Only keys
// present in the caller's data land in the patch; planPatch deep-merges it (arrays replace whole,
// content strings replace, markerConfig object-merges), then serializeRow stringifies JSON columns.
function buildPromptSectionPatch(data: Row): Row {
  const patch: Row = {};
  const name = firstString(data, ["name", "title", "label"]);
  if (name !== undefined) patch.name = name;
  const content = firstString(data, ["content", "prompt", "text"]);
  if (content !== undefined) patch.content = content;
  const role = firstString(data, ["role"]);
  if (role !== undefined) {
    if (!["system", "user", "assistant"].includes(role))
      throw new Error(`role must be system, user, or assistant, got "${role}"`);
    patch.role = role;
  }
  const enabled = firstBoolean(data, ["enabled"]);
  if (enabled !== undefined) patch.enabled = boolText(enabled);
  const isMarker = firstBoolean(data, ["isMarker", "marker"]);
  if (isMarker !== undefined) patch.isMarker = boolText(isMarker);
  if ("groupId" in data) patch.groupId = typeof data.groupId === "string" && data.groupId ? data.groupId : null;
  if (isRecord(data.markerConfig)) patch.markerConfig = data.markerConfig;
  const injectionPosition = firstString(data, ["injectionPosition"]);
  if (injectionPosition !== undefined) {
    if (injectionPosition !== "ordered" && injectionPosition !== "depth")
      throw new Error(`injectionPosition must be ordered or depth, got "${injectionPosition}"`);
    patch.injectionPosition = injectionPosition;
  }
  const injectionDepth = firstNumber(data, ["injectionDepth", "depth"]);
  if (injectionDepth !== undefined) patch.injectionDepth = injectionDepth;
  const injectionOrder = firstNumber(data, ["injectionOrder", "order", "sortOrder"]);
  if (injectionOrder !== undefined) patch.injectionOrder = injectionOrder;
  return patch;
}

function buildPromptGroupPatch(data: Row): Row {
  const patch: Row = {};
  const name = firstString(data, ["name", "title", "label"]);
  if (name !== undefined) patch.name = name;
  if ("parentGroupId" in data)
    patch.parentGroupId = typeof data.parentGroupId === "string" && data.parentGroupId ? data.parentGroupId : null;
  const order = firstNumber(data, ["order", "sortOrder"]);
  if (order !== undefined) patch.order = order;
  const enabled = firstBoolean(data, ["enabled"]);
  if (enabled !== undefined) patch.enabled = boolText(enabled);
  return patch;
}

function buildChoiceBlockPatch(data: Row, usedVariableNames: Set<string>): Row {
  const patch: Row = {};
  const variableName = firstString(data, ["variableName", "variable", "name", "key"]);
  if (variableName !== undefined)
    patch.variableName = normalizePromptVariableName(variableName, variableName, usedVariableNames);
  const question = firstString(data, ["question", "prompt", "label", "title"]);
  if (question !== undefined) patch.question = question;
  if ("options" in data || "choices" in data || "values" in data) {
    patch.options = promptOptionRows(data.options ?? data.choices ?? data.values);
  }
  const multiSelect = firstBoolean(data, ["multiSelect", "multi"]);
  if (multiSelect !== undefined) patch.multiSelect = boolText(multiSelect);
  const separator = firstString(data, ["separator"]);
  if (separator !== undefined) patch.separator = separator;
  const randomPick = firstBoolean(data, ["randomPick", "random"]);
  if (randomPick !== undefined) patch.randomPick = boolText(randomPick);
  const displayMode = firstString(data, ["displayMode"]);
  if (displayMode !== undefined) {
    if (!["auto", "buttons", "listbox"].includes(displayMode))
      throw new Error(`displayMode must be auto, buttons, or listbox, got "${displayMode}"`);
    patch.displayMode = displayMode;
  }
  const optionSort = firstString(data, ["optionSort"]);
  if (optionSort !== undefined) {
    if (optionSort !== "alphabetical" && optionSort !== "manual")
      throw new Error(`optionSort must be alphabetical or manual, got "${optionSort}"`);
    patch.optionSort = optionSort;
  }
  const sortOrder = firstNumber(data, ["sortOrder", "order"]);
  if (sortOrder !== undefined) patch.sortOrder = sortOrder;
  return patch;
}

// #4812: full insert rows for a single added section/group/choice-block, mirroring the per-child
// building in normalizePromptPresetChildInserts. Always allocate a fresh id at the call site.
// #4812: like the patch builders, the single-add insert path must reject an unsupported enum value
// rather than silently coercing it to a default (which reports success on a typo). An absent or blank
// value keeps the documented default.
function requireOneOf(value: unknown, allowed: readonly string[], field: string, fallback: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value);
  if (!allowed.includes(text)) throw new Error(`${field} must be one of ${allowed.join(", ")}, got "${text}"`);
  return text;
}

function buildPromptSectionInsertRow(
  data: Row,
  presetId: string,
  id: string,
  index: number,
  usedIdentifiers: Set<string>,
): Row {
  const name = firstString(data, ["name", "title", "label"]) ?? `Section ${index}`;
  return {
    id,
    presetId,
    identifier: normalizePromptIdentifier(
      firstString(data, ["identifier", "key", "slug"]) ?? name,
      `section_${index}`,
      usedIdentifiers,
    ),
    name,
    content: firstString(data, ["content", "prompt", "text"]) ?? "",
    role: requireOneOf(data.role, ["system", "user", "assistant"], "role", "system"),
    enabled: boolText(firstBoolean(data, ["enabled"]) ?? true),
    isMarker: boolText(firstBoolean(data, ["isMarker", "marker"]) ?? false),
    groupId: typeof data.groupId === "string" && data.groupId ? data.groupId : null,
    markerConfig: isRecord(data.markerConfig) ? JSON.stringify(data.markerConfig) : null,
    injectionPosition: requireOneOf(data.injectionPosition, ["ordered", "depth"], "injectionPosition", "ordered"),
    injectionDepth: firstNumber(data, ["injectionDepth", "depth"]) ?? 0,
    injectionOrder: firstNumber(data, ["injectionOrder", "order", "sortOrder"]) ?? index * 100,
    wrapInXml: "false",
    xmlTagName: "",
    forbidOverrides: boolText(firstBoolean(data, ["forbidOverrides"]) ?? false),
  };
}

function buildPromptGroupInsertRow(data: Row, presetId: string, id: string, order: number): Row {
  return {
    id,
    presetId,
    name: firstString(data, ["name", "title", "label"]) ?? "Group",
    parentGroupId: typeof data.parentGroupId === "string" && data.parentGroupId ? data.parentGroupId : null,
    order: firstNumber(data, ["order", "sortOrder"]) ?? order,
    enabled: boolText(firstBoolean(data, ["enabled"]) ?? true),
  };
}

function buildChoiceBlockInsertRow(
  data: Row,
  presetId: string,
  id: string,
  index: number,
  usedVariableNames: Set<string>,
): Row {
  const rawVariableName = firstString(data, ["variableName", "variable", "name", "key"]) ?? `variable_${index}`;
  return {
    id,
    presetId,
    variableName: normalizePromptVariableName(rawVariableName, `variable_${index}`, usedVariableNames),
    question: firstString(data, ["question", "prompt", "label", "title"]) ?? rawVariableName,
    options: promptOptionRows(data.options ?? data.choices ?? data.values),
    multiSelect: boolText(firstBoolean(data, ["multiSelect", "multi"]) ?? false),
    separator: firstString(data, ["separator"]) ?? ", ",
    randomPick: boolText(firstBoolean(data, ["randomPick", "random"]) ?? false),
    displayMode: requireOneOf(data.displayMode, ["auto", "buttons", "listbox"], "displayMode", "auto"),
    optionSort: requireOneOf(data.optionSort, ["alphabetical", "manual"], "optionSort", "manual"),
    sortOrder: firstNumber(data, ["sortOrder", "order"]) ?? index * 100,
  };
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

/**
 * Assign a nullable numeric field: an explicit `null` clears it to its default, a finite number (or
 * numeric string) sets it — optionally truncated to an integer and/or clamped to [min, max] — and an
 * absent or non-numeric value is ignored. Lets Mari both set and clear the entry's nullable numbers.
 */
function assignNullableNumberField(
  target: Row,
  source: Row,
  sourceKeys: string[],
  targetKey: string,
  bounds?: { min?: number; max?: number; integer?: boolean },
): boolean {
  for (const key of sourceKeys) {
    if (!(key in source)) continue;
    const raw = source[key];
    if (raw === null) {
      target[targetKey] = null;
      return true;
    }
    let value: number | undefined;
    if (typeof raw === "number" && Number.isFinite(raw)) value = raw;
    else if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) value = Number(raw);
    if (value === undefined) continue;
    if (bounds?.integer) value = Math.trunc(value);
    if (bounds?.min !== undefined) value = Math.max(bounds.min, value);
    if (bounds?.max !== undefined) value = Math.min(bounds.max, value);
    target[targetKey] = value;
    return true;
  }
  return false;
}

/** Assign a lorebook filter mode, validated against the stored enum (invalid values are ignored). */
function assignFilterModeField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  const value = firstString(source, sourceKeys);
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  if (!LOREBOOK_FILTER_MODE_VALUES.has(normalized)) return false;
  target[targetKey] = normalized;
  return true;
}

/** Assign the additional-matching-sources array, keeping only known source names. */
function assignMatchingSourcesField(target: Row, source: Row, sourceKeys: string[], targetKey: string): boolean {
  for (const key of sourceKeys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    target[targetKey] = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => LOREBOOK_MATCHING_SOURCE_VALUES.has(entry));
    return true;
  }
  return false;
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

// ── Field-aware bounding for full-object reads (#4767) ──────────────────────
// A `.get` returns the whole parsed row, which for a heavy card (many long
// alternate greetings, a big lorebook body) used to overflow the workspace
// output cap and get sliced mid-field — silently, and sometimes dropping
// name/description entirely. Instead we elide whole oversized fields (strings
// and arrays, as a unit) largest-first, keeping the object structurally valid
// and reporting exactly what was cut so the model can re-read any elided field
// with `app_data { field, offset }`. A hard cap guarantees the serialized
// overview stays under the char command cap even for pathological rows, so the
// downstream compactOutput never has to re-slice it mid-JSON.
const MARI_READ_OUTPUT_BUDGET = 24_000; // structured-elision target (pretty chars)
const MARI_READ_HARD_CAP = 28_000; // absolute pretty-char ceiling, guaranteed
const MARI_READ_FIELD_ELIDE_MIN = 200; // don't bother eliding values smaller than this
const MARI_READ_FIELD_WINDOW_MAX = 20_000;
// Identity fields are never elided, so a bounded overview always tells the model
// what it is looking at even when every large field was cut.
const MARI_NEVER_ELIDE_PATHS = new Set(["id", "name", "data.id", "data.name"]);
// The description is important context but can legitimately be the bulk of a card;
// elide it only as a last resort (after all other bulk), so an ordinary card keeps
// it inline while a description-dominated one is still bounded and recoverable.
const MARI_DEPRIORITIZED_ELIDE_PATHS = new Set(["description", "data.description"]);

function prettyLength(value: unknown): number {
  try {
    return JSON.stringify(value, null, 2)?.length ?? 0;
  } catch {
    return 0;
  }
}

function serializedSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return 0;
  }
}

// Path grammar: simple identifiers as `.key`, array indices as `[3]`, and any
// other key (dots, brackets, empty, leading digits) JSON-quoted as `["key"]`, so
// the collect→elide→drill-down round-trip survives real-world extension keys.
function appendKeyPath(path: string, key: string): string {
  if (/^[A-Za-z_$][\w$]*$/.test(key)) return path ? `${path}.${key}` : key;
  return `${path}[${JSON.stringify(key)}]`;
}

function parseFieldPath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  let rest = path;
  const token = /^\.?([A-Za-z_$][\w$]*)|^\[(\d+)\]|^\[("(?:[^"\\]|\\.)*")\]/;
  while (rest.length > 0) {
    const match = rest.match(token);
    if (!match) return []; // malformed path — resolve to nothing rather than mis-index
    if (match[1] !== undefined) tokens.push(match[1]);
    else if (match[2] !== undefined) tokens.push(Number(match[2]));
    else tokens.push(JSON.parse(match[3]!) as string);
    rest = rest.slice(match[0].length);
  }
  return tokens;
}

// Numeric tokens index arrays; against an object they are string keys — so the
// container type, not the token type, decides how each hop resolves. Object hops
// resolve OWN properties only, so a caller-supplied path like "constructor" or
// "__proto__" reads nothing instead of walking the prototype chain.
function resolveHop(current: object, tokenValue: string | number): unknown {
  if (Array.isArray(current)) return current[Number(tokenValue)];
  const key = String(tokenValue);
  if (!Object.prototype.hasOwnProperty.call(current, key)) return undefined;
  return (current as Record<string, unknown>)[key];
}

function getByPath(root: unknown, path: string): unknown {
  const tokens = parseFieldPath(path);
  if (tokens.length === 0) return undefined;
  let current: unknown = root;
  for (const tokenValue of tokens) {
    if (current == null || typeof current !== "object") return undefined;
    current = resolveHop(current, tokenValue);
  }
  return current;
}

function setByPath(root: unknown, path: string, next: unknown): void {
  const tokens = parseFieldPath(path);
  if (tokens.length === 0) return;
  let current: unknown = root;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (current == null || typeof current !== "object") return;
    current = resolveHop(current, tokens[i]!);
  }
  if (current == null || typeof current !== "object") return;
  const last = tokens[tokens.length - 1]!;
  if (Array.isArray(current)) current[Number(last)] = next;
  else if (Object.prototype.hasOwnProperty.call(current, String(last)))
    (current as Record<string, unknown>)[String(last)] = next;
}

// Elidable nodes are whole strings and whole arrays (elided as a unit — so a big
// tags/greetings array becomes one placeholder rather than thousands). We recurse
// into plain objects to reach their large fields, but never elide an object as a
// unit, so identity siblings (name, id) always stay inline.
function collectElidableNodes(
  value: unknown,
  path: string,
  out: Array<{ path: string; size: number }>,
): Array<{ path: string; size: number }> {
  if (path && MARI_NEVER_ELIDE_PATHS.has(path)) return out;
  if (typeof value === "string") {
    if (path && value.length >= MARI_READ_FIELD_ELIDE_MIN) out.push({ path, size: value.length });
  } else if (Array.isArray(value)) {
    if (path) {
      const size = serializedSize(value);
      if (size >= MARI_READ_FIELD_ELIDE_MIN) out.push({ path, size });
    }
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectElidableNodes(entry, appendKeyPath(path, key), out);
    }
  }
  return out;
}

function elisionPlaceholder(path: string, size: number): string {
  return `[elided ${size} chars — read this field with app_data { field: "${path}" }]`;
}

function boundReadObject(output: Row, budget: number): { output: Row | string; truncation: MariDbReadTruncation } {
  if (prettyLength(output) <= budget) return { output, truncation: { truncated: false } };

  const clone = JSON.parse(JSON.stringify(output)) as Row;
  const candidates = collectElidableNodes(clone, "", []).sort((a, b) => {
    const depA = MARI_DEPRIORITIZED_ELIDE_PATHS.has(a.path) ? 1 : 0;
    const depB = MARI_DEPRIORITIZED_ELIDE_PATHS.has(b.path) ? 1 : 0;
    return depA - depB || b.size - a.size;
  });

  const fields: NonNullable<MariDbReadTruncation["fields"]> = [];
  for (const node of candidates) {
    if (prettyLength(clone) <= budget) break;
    const placeholder = elisionPlaceholder(node.path, node.size);
    if (placeholder.length >= node.size) continue; // only elide when it actually shrinks
    setByPath(clone, node.path, placeholder);
    fields.push({ path: node.path, fullLength: node.size, returnedLength: placeholder.length });
  }

  // Guaranteed ceiling: structured elision handles realistic cards, but a row
  // whose bulk lives in tiny scalar fields we can't name (or JSON-quoting overhead)
  // could still exceed the cap. Hard-cap the serialized overview so the char-level
  // command truncation never re-slices it. Output becomes a string in this case.
  const pretty = JSON.stringify(clone, null, 2) ?? "";
  if (pretty.length > MARI_READ_HARD_CAP) {
    const capped = `${pretty.slice(0, MARI_READ_HARD_CAP)}\n… overview hard-capped; re-read individual fields with field= …`;
    return { output: capped, truncation: { truncated: true, fields, hardCapped: true } };
  }
  return { output: clone, truncation: { truncated: fields.length > 0, fields } };
}

function projectReadField(
  output: Row,
  path: string,
  offset: number,
  limit: number,
): { found: false } | { found: true; value: string; meta: NonNullable<MariDbReadTruncation["field"]> } {
  const raw = getByPath(output, path);
  if (raw === undefined) return { found: false };
  const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  // A value that does not serialize (e.g. a function reached via an odd path) has
  // no readable window — treat it as unresolved rather than throwing on .slice.
  if (typeof text !== "string") return { found: false };
  const window = text.slice(offset, offset + limit);
  return { found: true, value: window, meta: { path, offset, returned: window.length, total: text.length } };
}

// Post-processes a structured read so a single response stays bounded while the
// model retains a path to every byte. Only touches single-object reads (`.get`):
// list/search results are already summarized arrays and pass straight through.
function applyReadBounding(result: MariDbCommandResult, envelope: Row): MariDbCommandResult {
  if (result.ok === false || result.mode !== "read") return result;
  const output = result.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) return result;

  const fieldPath = firstString(envelope, ["field"]);
  if (fieldPath) {
    const offset = normalizeOffset(firstNumber(envelope, ["offset"]));
    const limit = normalizeLimit(
      firstNumber(envelope, ["limit"]),
      MARI_READ_FIELD_WINDOW_MAX,
      MARI_READ_FIELD_WINDOW_MAX,
    );
    const projected = projectReadField(output as Row, fieldPath, offset, limit);
    if (projected.found) {
      return {
        ...result,
        output: projected.value,
        truncation: {
          truncated: projected.meta.offset > 0 || projected.meta.returned < projected.meta.total,
          field: projected.meta,
        },
      };
    }
    // Requested field did not resolve: return the bounded overview but flag the
    // miss, so the model sees the real field paths (in the elision notes) and
    // retries rather than silently getting the whole object back.
    const overview = boundReadObject(output as Row, MARI_READ_OUTPUT_BUDGET);
    return {
      ...result,
      output: overview.output,
      truncation: { ...overview.truncation, truncated: true, unresolvedField: fieldPath },
    };
  }

  const bounded = boundReadObject(output as Row, MARI_READ_OUTPUT_BUDGET);
  if (!bounded.truncation.truncated) return result;
  return { ...result, output: bounded.output, truncation: bounded.truncation };
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
    imagePath: parsed.imagePath ?? null,
    isDefault: parsed.isDefault,
    author: parsed.author ?? "",
    sectionCount: Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder.length : 0,
    groupCount: Array.isArray(parsed.groupOrder) ? parsed.groupOrder.length : 0,
    choiceDefaults: Object.keys(parseJsonRecordValue(row.defaultChoices)).length,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
}

// #4812: compact index rows so Prof Mari can SEE a preset's sections/groups/choice-blocks with
// their ids + a content preview, then read one in full and patch it — mirroring lorebook entries.
function summarizePromptSectionRow(row: Row): Row {
  const parsed = parseRow("prompt_sections", row);
  return {
    id: parsed.id,
    presetId: parsed.presetId,
    identifier: parsed.identifier,
    name: parsed.name,
    role: parsed.role,
    enabled: parsed.enabled,
    isMarker: parsed.isMarker,
    groupId: parsed.groupId ?? null,
    injectionPosition: parsed.injectionPosition,
    injectionDepth: parsed.injectionDepth,
    injectionOrder: parsed.injectionOrder,
    content: typeof parsed.content === "string" ? truncateStr(parsed.content, 200) : "",
  };
}

function summarizePromptGroupRow(row: Row): Row {
  const parsed = parseRow("prompt_groups", row);
  return {
    id: parsed.id,
    presetId: parsed.presetId,
    name: parsed.name,
    parentGroupId: parsed.parentGroupId ?? null,
    order: parsed.order,
    enabled: parsed.enabled,
  };
}

function summarizeChoiceBlockRow(row: Row): Row {
  const parsed = parseRow("choice_blocks", row);
  return {
    id: parsed.id,
    presetId: parsed.presetId,
    variableName: parsed.variableName,
    question: typeof parsed.question === "string" ? truncateStr(parsed.question, 160) : "",
    optionCount: parseJsonArrayValue(parsed.options).length,
    multiSelect: parsed.multiSelect,
    sortOrder: parsed.sortOrder,
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
  return (
    isRecord(value.data) ||
    (typeof value.data === "string" &&
      ["id", "comment", "avatarPath", "spriteFolderPath", "createdAt", "updatedAt"].some((key) =>
        hasOwnKey(value, key),
      ))
  );
}

function normalizeCharacterDataBase(base: Record<string, unknown>): Record<string, unknown> {
  const parsedData =
    typeof base.data === "string" && looksLikeCharacterRowInput(base) ? parseJsonMaybe(base.data) : null;
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
  const hint =
    meta.name === "characters" && unknownKeys.some((key) => key === "appearance" || key === "backstory")
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
    issues.push({
      level: "error",
      table: tableName,
      id: issueId,
      message: "Character data does not look like a CharacterData card",
    });
    return;
  }
  if (typeof card.name !== "string") {
    issues.push({
      level: "error",
      table: tableName,
      id: issueId,
      message: "Character data does not look like a CharacterData card",
    });
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
      ? tagsVal
          .split(/[,|]/)
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];
  }
  return data;
}

export class MariDbService {
  private pending = new Map<string, PendingRecord>();
  private pendingHydrated = false;
  private history: MariDbHistoryEntry[] = [];
  private writeQueue: Promise<unknown> = Promise.resolve();
  private characterFolderMutationQueue: Promise<void> = Promise.resolve();
  // Per-review serialization queue. keepAppliedReview / restoreAppliedReview / rejectRows each do a
  // read-modify-write over pending.get(id) + the durable sidecar across await points; two concurrent
  // requests for the SAME review id would both read the same record and clobber each other on write.
  // Keyed by id so unrelated reviews stay concurrent; entries self-evict once the queue drains.
  private reviewLocks = new Map<string, Promise<unknown>>();

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
      if (group === "preset" || group === "presets") {
        return await this.executePresetsCommand(argv.slice(1), { command, sessionId, cwd: envelope.cwd });
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
            error:
              "mari storage tx is reserved for a later hot-reload repair phase; use mari db for managed data edits.",
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
        sessionId:
          typeof envelope.sessionId === "string" && envelope.sessionId.trim()
            ? envelope.sessionId.trim()
            : "mari-app-data",
        cwd: typeof envelope.cwd === "string" ? envelope.cwd : undefined,
      };
      const key = normalizeAppDataActionName(action);
      const dispatch = async (): Promise<MariDbCommandResult> => {
        if (key.startsWith("character."))
          return this.executeCharacterAction(key.slice("character.".length), envelope, context);
        if (key.startsWith("persona."))
          return this.executePersonaAction(key.slice("persona.".length), envelope, context);
        if (key.startsWith("lorebook."))
          return this.executeLorebookAction(key.slice("lorebook.".length), envelope, context);
        if (key.startsWith("theme.")) return this.executeThemeAction(key.slice("theme.".length), envelope, context);
        if (key.startsWith("personalextension.")) {
          return this.executePersonalExtensionAction(key.slice("personalextension.".length), envelope, context);
        }
        if (key.startsWith("agent.")) return this.executeAgentAction(key.slice("agent.".length), envelope, context);
        if (key.startsWith("preset.")) return this.executePresetAction(key.slice("preset.".length), envelope, context);
        if (key.startsWith("homewidget."))
          return this.executeHomeWidgetAction(key.slice("homewidget.".length), envelope, context);
        // #4851: the user's saved memories. Canonical surface is `instruction.*` (the code
        // namespace stays instruction_/mari_); those are the entries in the tool catalog enum.
        if (key.startsWith("instruction."))
          return this.executeInstructionAction(key.slice("instruction.".length), envelope, context);
        return {
          ok: false,
          mode: "read",
          command,
          error:
            "Unsupported app_data action. Use character.*, persona.*, lorebook.*, theme.*, personal_extension.*, agent.*, preset.*, home_widget.*, or instruction.* actions for structured no-shell app-data work.",
        };
      };
      // Field-aware bounding keeps a single read response within the workspace
      // output cap while leaving every elided field re-readable (#4767).
      return applyReadBounding(await dispatch(), envelope);
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
      case "folder.list": {
        const rows = (await this.rawRows("character_groups"))
          .map((row) => parseRow("character_groups", row))
          .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            characterIds: row.characterIds,
          })),
        };
      }
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
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("characters", row) : null,
        };
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
          actionDataWithTopLevel(
            args,
            ["data", "card", "character"],
            [
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
            ],
          ),
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
          actionDataWithTopLevel(
            args,
            ["patch", "data", "card", "character"],
            [
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
            ],
          ),
        );
        const comment =
          firstString(patchData, ["comment"]) ?? (typeof existing.comment === "string" ? existing.comment : "");
        delete patchData.comment;
        if (
          Object.keys(patchData).length === 0 &&
          comment === (typeof existing.comment === "string" ? existing.comment : "")
        ) {
          throw new Error(
            "character.update needs a patch field such as name, description, personality, scenario, firstMes, creatorNotes, backstory, appearance, aboutMe, tags, or comment",
          );
        }
        const name =
          firstString(patchData, ["name"]) ?? (typeof existingData.name === "string" ? existingData.name : "");
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
      case "movetofolder": {
        return this.withCharacterFolderMutationLock(async () => {
          const characterId = requiredString(args, ["characterId", "id"], "character id");
          const character = await this.getRawById(getMeta("characters"), characterId);
          if (!character) throw new Error(`Character ${characterId} not found`);

          const requestedFolderId = firstString(args, ["folderId"]);
          const requestedFolderName = firstString(args, ["folderName", "folder"]);
          if (!requestedFolderId && !requestedFolderName) {
            throw new Error("character.moveToFolder needs folderId or folderName");
          }

          const groups = await this.rawRows("character_groups");
          const matches = requestedFolderId
            ? groups.filter((group) => group.id === requestedFolderId)
            : groups.filter(
                (group) =>
                  typeof group.name === "string" &&
                  group.name.trim().toLowerCase() === requestedFolderName!.trim().toLowerCase(),
              );
          if (matches.length === 0) {
            throw new Error(
              requestedFolderId
                ? `Character folder ${requestedFolderId} not found`
                : `Character folder ${requestedFolderName} not found`,
            );
          }
          if (matches.length > 1) {
            throw new Error(`More than one character folder is named ${requestedFolderName}; use folderId instead`);
          }

          return this.executeMutation(
            {
              kind: "character-move-folder",
              table: "character_groups",
              characterId,
              folderId: String(matches[0]!.id),
              apply: firstBoolean(args, ["apply"]) === true,
              cascade: false,
              reason: firstString(args, ["reason"]) ?? null,
              cwd: context.cwd,
            },
            context.command,
            context.sessionId,
          );
        });
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizePersonaRow),
        };
      }
      case "active": {
        const row = (await this.rawRows("personas")).find((candidate) => candidate.isActive === "true") ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "get": {
        const id = requiredString(args, ["id", "personaId"], "persona id");
        const row = await this.getRawById(getMeta("personas"), id);
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("personas", row) : null,
        };
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
        const data = actionDataWithTopLevel(
          args,
          ["data", "persona", "row"],
          [
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
          ],
        );
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
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "persona"],
          [
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
          ],
        );
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
        if (
          data.convoBehavior !== undefined ||
          data.convo_behavior !== undefined ||
          data["convo-behavior"] !== undefined
        ) {
          patch.convoBehavior = normalizePersonaConvoBehavior(
            data.convoBehavior ?? data.convo_behavior ?? data["convo-behavior"],
          );
        }
        assignListField(patch, data, ["tags"], "tags");
        if (Object.keys(patch).length <= 1) {
          throw new Error(
            "persona.update needs a patch field such as name, description, personality, scenario, backstory, appearance, tags, comment, creator, or creatorNotes",
          );
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
    changed =
      assignBooleanTextField(target, source, ["recursiveScanning", "recursive"], "recursiveScanning") || changed;
    changed =
      assignBoundedNumberField(
        target,
        source,
        ["maxRecursionDepth", "max_recursion_depth"],
        "maxRecursionDepth",
        1,
        10,
      ) || changed;
    changed =
      assignBooleanTextField(
        target,
        source,
        ["excludeFromVectorization", "vectorsDisabled"],
        "excludeFromVectorization",
      ) || changed;
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
      ) || changed;
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
    for (const key of ["outletName", "outlet_name"]) {
      const value = source[key];
      if (typeof value !== "string") continue;
      target.outletName = value.trim();
      changed = true;
      break;
    }
    changed = assignNumberField(target, source, ["depth"], "depth") || changed;
    changed = assignStringField(target, source, ["role"], "role") || changed;
    changed = assignStringField(target, source, ["group"], "group") || changed;
    changed = assignBooleanTextField(target, source, ["selective"], "selective") || changed;
    const selectiveLogic = normalizeSelectiveLogic(source);
    if (selectiveLogic !== undefined) {
      target.selectiveLogic = selectiveLogic;
      changed = true;
    }
    changed =
      assignBooleanTextField(target, source, ["matchWholeWords", "match_whole_words"], "matchWholeWords") || changed;
    changed = assignBooleanTextField(target, source, ["caseSensitive", "case_sensitive"], "caseSensitive") || changed;
    changed = assignBooleanTextField(target, source, ["useRegex", "use_regex"], "useRegex") || changed;
    // #4791 follow-up: the remaining user-editable entry settings — activation chance, timing,
    // recursion, grouping, matching filters, and per-entry vectorization. Nullable numbers accept an
    // explicit null to clear; filter modes and matching sources are validated against their enums.
    // (folderId is validated against the entry's own lorebook in the add/update handlers below, which
    // have DB access; it cannot be resolved from this synchronous helper.)
    changed =
      assignNullableNumberField(target, source, ["probability"], "probability", { min: 0, max: 100, integer: true }) ||
      changed;
    changed = assignNullableNumberField(target, source, ["scanDepth", "scan_depth"], "scanDepth") || changed;
    changed = assignNullableNumberField(target, source, ["sticky"], "sticky") || changed;
    changed = assignNullableNumberField(target, source, ["cooldown"], "cooldown") || changed;
    changed = assignNullableNumberField(target, source, ["delay"], "delay") || changed;
    changed =
      assignNullableNumberField(target, source, ["ephemeral"], "ephemeral", { min: 0, integer: true }) || changed;
    changed = assignNullableNumberField(target, source, ["groupWeight", "group_weight"], "groupWeight") || changed;
    changed =
      assignBooleanTextField(target, source, ["preventRecursion", "prevent_recursion"], "preventRecursion") || changed;
    changed =
      assignBooleanTextField(target, source, ["excludeRecursion", "exclude_recursion"], "excludeRecursion") || changed;
    changed =
      assignBooleanTextField(target, source, ["delayUntilRecursion", "delay_until_recursion"], "delayUntilRecursion") ||
      changed;
    changed =
      assignBooleanTextField(
        target,
        source,
        ["excludeFromVectorization", "exclude_from_vectorization"],
        "excludeFromVectorization",
      ) || changed;
    changed = assignBooleanTextField(target, source, ["locked"], "locked") || changed;
    changed =
      assignFilterModeField(target, source, ["characterFilterMode", "character_filter_mode"], "characterFilterMode") ||
      changed;
    changed =
      assignListField(target, source, ["characterFilterIds", "character_filter_ids"], "characterFilterIds") || changed;
    changed =
      assignFilterModeField(
        target,
        source,
        ["characterTagFilterMode", "character_tag_filter_mode"],
        "characterTagFilterMode",
      ) || changed;
    changed =
      assignListField(target, source, ["characterTagFilters", "character_tag_filters"], "characterTagFilters") ||
      changed;
    changed =
      assignFilterModeField(
        target,
        source,
        ["generationTriggerFilterMode", "generation_trigger_filter_mode"],
        "generationTriggerFilterMode",
      ) || changed;
    changed =
      assignListField(
        target,
        source,
        ["generationTriggerFilters", "generation_trigger_filters"],
        "generationTriggerFilters",
      ) || changed;
    changed =
      assignMatchingSourcesField(
        target,
        source,
        ["additionalMatchingSources", "additional_matching_sources"],
        "additionalMatchingSources",
      ) || changed;
    return changed;
  }

  /**
   * Resolve and validate a folderId change for a lorebook entry. The add/update handlers own this
   * (not the synchronous field helper) because it needs a DB lookup: an explicit null / empty / "none"
   * clears placement, otherwise the folder must exist and belong to the entry's own lorebook — mirroring
   * the CLI (`mari lorebooks add-entry/update-entry --folder-id`) and the storage layer.
   */
  private async assignEntryFolderId(target: Row, source: Row, lorebookId: string): Promise<void> {
    for (const key of ["folderId", "folder_id"]) {
      if (!(key in source)) continue;
      const value = source[key];
      if (value === null || (typeof value === "string" && (!value.trim() || value.trim().toLowerCase() === "none"))) {
        target.folderId = null;
        return;
      }
      if (typeof value === "string") {
        const folderId = value.trim();
        const folderRow = await this.getRawById(getMeta("lorebook_folders"), folderId);
        if (!folderRow || String(folderRow.lorebookId) !== String(lorebookId)) {
          throw new Error(`Folder ${folderId} not found in lorebook ${lorebookId}`);
        }
        target.folderId = folderId;
        return;
      }
      return;
    }
  }

  // #4851: Professor Mari's persistent standing instructions ("memories").
  // Reads (list/get) back the index-and-fetch injection; writes (remember/update/
  // forget) run through executeMutation so each surfaces a Keep/Restore card.
  private async executeInstructionAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const storage = createMariInstructionsStorage(this.db);
    switch (sub) {
      case "list": {
        // The lean index Mari also sees injected each turn: title + one-liner, NO
        // content (she fetches a body with instruction.get only when it's relevant).
        //
        // Paged, because an unbounded list overflows the read budget: the envelope is
        // an object, so it runs through boundReadObject (MARI_READ_OUTPUT_BUDGET = 24k),
        // which elides an oversized `items` array AS A UNIT, hiding every id and making
        // the tail unfetchable. Descriptions are truncated here (Mari fetches the full
        // memory with instruction.get before acting on it), and the page is capped so the
        // worst case stays well under budget by construction: 50 rows x ~434 pretty chars
        // (120-char name + 120-char truncated description + flags/ts) ≈ 21.8k < 24k.
        const offset = normalizeOffset(firstNumber(args, ["offset"]));
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 40, 50);
        const rows = await storage.list();
        const total = rows.length;
        const items = rows.slice(offset, offset + limit).map((row) => ({
          id: row.id,
          name: row.name,
          description: truncateStr(row.description, 120),
          persistent: row.persistent,
          enabled: row.enabled,
          updatedAt: row.updatedAt,
        }));
        // items.length (not limit), so a short final page reports nextOffset: null and an
        // offset past the end returns { items: [], nextOffset: null }.
        const nextOffset = offset + items.length < total ? offset + items.length : null;
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: { items, total, offset, nextOffset },
        };
      }
      case "get": {
        const id = requiredString(args, ["id", "instructionId", "memoryId"], "memory id");
        const row = await storage.get(id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row };
      }
      case "remember": {
        const data = actionDataWithTopLevel(
          args,
          ["data", "instruction", "memory", "row"],
          // NB: no "enabled"; Mari never sets a memory's enabled state (see buildInstructionInsertRow).
          [
            "name",
            "title",
            "label",
            "description",
            "summary",
            "content",
            "text",
            "body",
            "memory",
            "persistent",
            "pinned",
            "always",
            "alwaysInject",
            "always_inject",
          ],
        );
        const timestamp = now();
        const id = firstString(args, ["id", "instructionId", "memoryId"]) ?? newId();
        const row = buildInstructionInsertRow(data, id, timestamp);
        return this.executeMutation(
          {
            kind: "insert",
            table: "mari_instructions",
            id,
            row,
            apply: appDataCreateApply(args),
            instructionMutation: true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "update": {
        const id = requiredString(args, ["id", "instructionId", "memoryId"], "memory id");
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "instruction", "memory"],
          // NB: no "enabled"; only the user toggles a memory's enabled state (see buildInstructionPatch).
          [
            "name",
            "title",
            "label",
            "description",
            "summary",
            "content",
            "text",
            "body",
            "memory",
            "persistent",
            "pinned",
            "always",
            "alwaysInject",
            "always_inject",
          ],
        );
        const patch = buildInstructionPatch(data);
        if (Object.keys(patch).length <= 1) {
          throw new Error("instruction.update needs a field to change: name, description, content, or persistent.");
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "mari_instructions",
            id,
            patch,
            apply: firstBoolean(args, ["apply"]) === true,
            instructionMutation: true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "forget": {
        const id = requiredString(args, ["id", "instructionId", "memoryId"], "memory id");
        // Fail loudly on a missing id instead of a no-op delete that reports success (which would
        // make Mari tell the user a memory was forgotten when nothing changed).
        if (!(await this.getRawById(getMeta("mari_instructions"), id))) {
          throw new Error(`Memory ${id} not found.`);
        }
        return this.executeMutation(
          {
            kind: "delete",
            table: "mari_instructions",
            id,
            apply: firstBoolean(args, ["apply"]) === true,
            instructionMutation: true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      default:
        return {
          ok: false,
          mode: "read",
          command: context.command,
          error: `Unsupported instruction action "${sub}". Use list, get, remember, update, or forget.`,
        };
    }
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizeLorebookRow),
        };
      }
      case "get": {
        const id = requiredString(args, ["id", "lorebookId"], "lorebook id");
        const row = await this.getRawById(getMeta("lorebooks"), id);
        if (!row) return { ok: false, mode: "read", command: context.command, output: null };
        const entryCount = (await this.rawRows("lorebook_entries")).filter((entry) => entry.lorebookId === id).length;
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: { ...parseRow("lorebooks", row), entryCount },
        };
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
        const data = actionDataWithTopLevel(
          args,
          ["data", "lorebook", "row"],
          [
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
          ],
        );
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
          hiddenFromLibrary: "false",
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
        const relatedInserts = await Promise.all(
          entries.map(async (entry, index) => {
            if (!isRecord(entry)) throw new Error(`lorebook entry ${index + 1} must be an object`);
            // Give embedded entries the same coverage as lorebook.addEntry: build the base row, then
            // apply every user-editable setting and validate folder placement against this lorebook.
            const entryRow = buildLorebookEntryCreateRow(entry, id, newId(), timestamp, (index + 1) * 100);
            this.assignLorebookEntryActionFields(entryRow, entry);
            await this.assignEntryFolderId(entryRow, entry, id);
            return { table: "lorebook_entries", row: entryRow };
          }),
        );
        return this.executeMutation(
          {
            kind: "insert",
            table: "lorebooks",
            id,
            row,
            apply: appDataCreateApply(args),
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
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "lorebook"],
          [
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
          ],
        );
        const patch: Row = { updatedAt: now() };
        this.assignLorebookActionFields(patch, data);
        if (Object.keys(patch).length <= 1) {
          throw new Error(
            "lorebook.update needs a patch field such as name, description, category, tags, enabled, global, scanDepth, tokenBudget, entryLimit, recursiveScanning, excludeFromVectorization, vectorQueryDepth, vectorScoreThreshold, or vectorMaxResults",
          );
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
        const data = actionDataWithTopLevel(
          args,
          ["data", "entry", "row"],
          [
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
            "outletName",
            "depth",
            "role",
            "group",
            "selective",
            "selectiveLogic",
            "matchWholeWords",
            "caseSensitive",
            "useRegex",
            "probability",
            "scanDepth",
            "sticky",
            "cooldown",
            "delay",
            "ephemeral",
            "groupWeight",
            "preventRecursion",
            "excludeRecursion",
            "delayUntilRecursion",
            "excludeFromVectorization",
            "locked",
            "characterFilterMode",
            "characterFilterIds",
            "characterTagFilterMode",
            "characterTagFilters",
            "generationTriggerFilterMode",
            "generationTriggerFilters",
            "additionalMatchingSources",
            "folderId",
          ],
        );
        const timestamp = now();
        const id = firstString(args, ["entryId", "id"]) ?? newId();
        const row = buildLorebookEntryCreateRow(data, lorebookId, id, timestamp);
        this.assignLorebookEntryActionFields(row, data);
        await this.assignEntryFolderId(row, data, lorebookId);
        return this.executeMutation(
          {
            kind: "insert",
            table: "lorebook_entries",
            id,
            row,
            apply: appDataCreateApply(args),
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
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "entry"],
          [
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
            "outletName",
            "depth",
            "role",
            "group",
            "selective",
            "selectiveLogic",
            "matchWholeWords",
            "caseSensitive",
            "useRegex",
            "probability",
            "scanDepth",
            "sticky",
            "cooldown",
            "delay",
            "ephemeral",
            "groupWeight",
            "preventRecursion",
            "excludeRecursion",
            "delayUntilRecursion",
            "excludeFromVectorization",
            "locked",
            "characterFilterMode",
            "characterFilterIds",
            "characterTagFilterMode",
            "characterTagFilters",
            "generationTriggerFilterMode",
            "generationTriggerFilters",
            "additionalMatchingSources",
            "folderId",
          ],
        );
        const patch: Row = { updatedAt: now() };
        this.assignLorebookEntryActionFields(patch, data);
        await this.assignEntryFolderId(patch, data, String(entryExists.lorebookId));
        if (Object.keys(patch).length <= 1) {
          throw new Error(
            "lorebook.updateEntry needs entryId plus a patch field such as name, content, keys, description, enabled, constant, or order",
          );
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
      case "deleteentry": {
        // A safe, scoped single-entry delete so Mari never reaches for a raw `mari db delete --where`
        // (which can match — and remove — far more rows than intended).
        const entryId = requiredString(args, ["entryId", "id"], "lorebook entry id");
        const entryExists = await this.getRawById(getMeta("lorebook_entries"), entryId);
        if (!entryExists) throw new Error(`Lorebook entry ${entryId} not found`);
        return this.executeMutation(
          {
            kind: "delete",
            table: "lorebook_entries",
            id: entryId,
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

  private async executeHomeWidgetAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const rows = await this.rawRows("app_settings");
    const settingsRow = rows.find((row) => row.key === HOME_CUSTOM_WIDGETS_SETTINGS_KEY) ?? null;
    let catalog = homeCustomWidgetCatalogSchema.parse({ widgets: [] });
    if (typeof settingsRow?.value === "string") {
      try {
        catalog = homeCustomWidgetCatalogSchema.parse(JSON.parse(settingsRow.value));
      } catch {
        throw new Error("The stored Home custom widget catalog is invalid and must be repaired before editing it.");
      }
    }

    const saveCatalog = (widgets: typeof catalog.widgets) => {
      const nextCatalog = homeCustomWidgetCatalogSchema.parse({ revision: catalog.revision + 1, widgets });
      const request: ParsedMutationRequest = {
        kind: settingsRow ? "replace" : "insert",
        table: "app_settings",
        ...(settingsRow ? { id: HOME_CUSTOM_WIDGETS_SETTINGS_KEY } : {}),
        row: { key: HOME_CUSTOM_WIDGETS_SETTINGS_KEY, value: JSON.stringify(nextCatalog), updatedAt: now() },
        apply: firstBoolean(args, ["apply"]) === true,
        cascade: false,
        reason: firstString(args, ["reason"]) ?? null,
        cwd: context.cwd,
      };
      return this.executeMutation(request, context.command, context.sessionId);
    };

    switch (sub) {
      case "list":
        return { ok: true, mode: "read", command: context.command, output: catalog.widgets };
      case "get": {
        const id = requiredString(args, ["id", "widgetId"], "Home widget id");
        const widget = catalog.widgets.find((candidate) => candidate.id === id) ?? null;
        return { ok: Boolean(widget), mode: "read", command: context.command, output: widget };
      }
      case "create": {
        if (catalog.widgets.length >= HOME_CUSTOM_WIDGET_LIMIT)
          throw new Error(`Home supports at most ${HOME_CUSTOM_WIDGET_LIMIT} custom widgets.`);
        const data = actionDataWithTopLevel(args, ["data", "widget"], ["title", "description", "accent", "icon"]);
        const draft = homeCustomWidgetDraftSchema.parse(data);
        const slug =
          draft.title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "widget";
        const suffix = newId()
          .replace(/[^a-z0-9]/gi, "")
          .toLowerCase()
          .slice(0, 8);
        const timestamp = now();
        return saveCatalog([
          ...catalog.widgets,
          homeCustomWidgetSchema.parse({
            ...draft,
            id: `${slug}-${suffix}`,
            createdAt: timestamp,
            updatedAt: timestamp,
          }),
        ]);
      }
      case "update": {
        const id = requiredString(args, ["id", "widgetId"], "Home widget id");
        const index = catalog.widgets.findIndex((candidate) => candidate.id === id);
        if (index < 0) throw new Error(`Home widget ${id} was not found.`);
        const patch = homeCustomWidgetDraftSchema
          .partial()
          .parse(actionDataWithTopLevel(args, ["patch", "data", "widget"], ["title", "description", "accent", "icon"]));
        if (Object.keys(patch).length === 0) throw new Error("home_widget.update needs a non-empty patch.");
        const widgets = [...catalog.widgets];
        widgets[index] = homeCustomWidgetSchema.parse({ ...widgets[index], ...patch, updatedAt: now() });
        return saveCatalog(widgets);
      }
      case "delete": {
        const id = requiredString(args, ["id", "widgetId"], "Home widget id");
        if (!catalog.widgets.some((candidate) => candidate.id === id))
          throw new Error(`Home widget ${id} was not found.`);
        return saveCatalog(catalog.widgets.filter((candidate) => candidate.id !== id));
      }
      default:
        return { ok: false, mode: "read", command: context.command, error: "Unsupported Home widget app_data action." };
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizeThemeRow),
        };
      }
      case "active": {
        const row =
          (await this.rawRows(THEME_TABLE)).find((candidate) => candidate.isActive === THEME_ACTIVE_TRUE) ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "get": {
        const id = requiredString(args, ["id", "themeId"], "theme id");
        const row = await this.getRawById(getMeta(THEME_TABLE), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseThemeRow(row) : null };
      }
      case "create": {
        const data = actionDataWithTopLevel(
          args,
          ["data", "theme", "row"],
          ["name", "css", "activate", "active", "installedAt"],
        );
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
        if (request.name === undefined && request.css === undefined)
          throw new Error("theme.update needs a patch with name or css");
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

  private async executePersonalExtensionAction(
    sub: string,
    args: Row,
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const table = "installed_extensions";
    const capabilitiesFromRow = (row: Row) => {
      try {
        return normalizePersonalExtensionCapabilities(
          typeof row.capabilities === "string" ? JSON.parse(row.capabilities) : row.capabilities,
        );
      } catch {
        return [];
      }
    };
    const summarize = (row: Row) => ({
      id: row.id,
      name: row.name,
      version: row.version ?? null,
      description: row.description ?? "",
      runtime: row.runtime === "server" ? "server" : "client",
      capabilities: capabilitiesFromRow(row),
      enabled: row.enabled === "true",
      contentHash: row.contentHash ?? null,
      approvedHash: row.approvedHash ?? null,
      source: row.source ?? "legacy",
      updatedAt: row.updatedAt,
    });
    const executableFromRow = (row: Row) => {
      const runtime = row.runtime === "server" ? "server" : "client";
      return {
        runtime,
        capabilities: runtime === "client" ? capabilitiesFromRow(row) : [],
        css: runtime === "client" && typeof row.css === "string" ? row.css : null,
        js: runtime === "client" && typeof row.js === "string" ? row.js : null,
        serverJs: runtime === "server" && typeof row.serverJs === "string" ? row.serverJs : null,
      } as const;
    };

    switch (sub) {
      case "list": {
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows(table)).sort((left, right) =>
          String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")),
        );
        return { ok: true, mode: "read", command: context.command, output: rows.slice(0, limit).map(summarize) };
      }
      case "get": {
        const id = requiredString(args, ["id", "extensionId"], "Personal Extension id");
        const row = await this.getRawById(getMeta(table), id);
        return { ok: Boolean(row), mode: "read", command: context.command, output: row ? parseRow(table, row) : null };
      }
      case "search": {
        const query = requiredString(args, ["query", "search"], "Personal Extension search query").toLowerCase();
        const limit = normalizeLimit(firstNumber(args, ["limit"]), 50, 1000);
        const rows = (await this.rawRows(table))
          .filter((row) => JSON.stringify(row).toLowerCase().includes(query))
          .slice(0, limit)
          .map(summarize);
        return { ok: true, mode: "read", command: context.command, output: rows };
      }
      case "create": {
        const data = actionDataWithTopLevel(
          args,
          ["data", "extension", "row"],
          ["name", "version", "description", "runtime", "capabilities", "css", "js", "serverJs"],
        );
        const parsed = createPersonalExtensionSchema.parse(data);
        const runtime = parsed.runtime === "server" ? "server" : "client";
        const executable = {
          runtime,
          capabilities: runtime === "client" ? normalizePersonalExtensionCapabilities(parsed.capabilities) : [],
          css: runtime === "client" ? (parsed.css ?? null) : null,
          js: runtime === "client" ? (parsed.js ?? null) : null,
          serverJs: runtime === "server" ? (parsed.serverJs ?? null) : null,
        } as const;
        const timestamp = now();
        const id = firstString(args, ["id", "extensionId"]) ?? newId();
        const row: Row = {
          id,
          name: parsed.name,
          version: parsed.version == null ? null : String(parsed.version),
          description: parsed.description ?? "",
          ...executable,
          capabilities: JSON.stringify(executable.capabilities),
          enabled: "false",
          contentHash: computePersonalExtensionHash(executable),
          approvedHash: null,
          source: "professor_mari",
          revisions: [],
          installedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        return this.executeMutation(
          {
            kind: "insert",
            table,
            id,
            row,
            apply: appDataCreateApply(args),
            personalExtensionDraftMutation: true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? "Professor Mari created a Personal Extension draft",
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "update": {
        const id = requiredString(args, ["id", "extensionId"], "Personal Extension id");
        const existingRaw = await this.getRawById(getMeta(table), id);
        if (!existingRaw) throw new Error(`Personal Extension ${id} not found`);
        const existing = parseRow(table, existingRaw);
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "extension"],
          ["name", "version", "description", "runtime", "capabilities", "css", "js", "serverJs"],
        );
        if (Object.keys(data).length === 0) throw new Error("personal_extension.update needs a code or metadata patch");
        const runtime =
          data.runtime === "server" || (data.runtime === undefined && existing.runtime === "server")
            ? "server"
            : "client";
        const textOrFallback = (key: string, fallback: unknown) =>
          data[key] === null ? null : typeof data[key] === "string" ? data[key] : fallback;
        const parsed = createPersonalExtensionSchema.parse({
          name: textOrFallback("name", existing.name),
          version: textOrFallback("version", existing.version),
          description: textOrFallback("description", existing.description),
          runtime,
          capabilities:
            runtime === "client"
              ? data.capabilities === undefined
                ? capabilitiesFromRow(existing)
                : normalizePersonalExtensionCapabilities(data.capabilities)
              : [],
          css: runtime === "client" ? textOrFallback("css", existing.css) : null,
          js: runtime === "client" ? textOrFallback("js", existing.js) : null,
          serverJs: runtime === "server" ? textOrFallback("serverJs", existing.serverJs) : null,
        });
        const executable = {
          runtime,
          capabilities: runtime === "client" ? normalizePersonalExtensionCapabilities(parsed.capabilities) : [],
          css: runtime === "client" ? (parsed.css ?? null) : null,
          js: runtime === "client" ? (parsed.js ?? null) : null,
          serverJs: runtime === "server" ? (parsed.serverJs ?? null) : null,
        } as const;
        const previousExecutable = executableFromRow(existing);
        const previousHash =
          typeof existing.contentHash === "string" && existing.contentHash
            ? existing.contentHash
            : computePersonalExtensionHash(previousExecutable);
        const contentHash = computePersonalExtensionHash(executable);
        const executableChanged = contentHash !== previousHash;
        const existingRevisions = Array.isArray(existing.revisions) ? existing.revisions : [];
        const revisions = executableChanged
          ? [
              {
                contentHash: previousHash,
                version: typeof existing.version === "string" ? existing.version : null,
                ...previousExecutable,
                savedAt: now(),
              },
              ...existingRevisions.filter((revision) => !isRecord(revision) || revision.contentHash !== previousHash),
            ].slice(0, 10)
          : existingRevisions;
        const row: Row = {
          ...existing,
          id,
          name: parsed.name,
          version: parsed.version == null ? null : String(parsed.version),
          description: parsed.description ?? "",
          ...executable,
          capabilities: JSON.stringify(executable.capabilities),
          enabled: executableChanged ? "false" : existing.enabled,
          contentHash,
          approvedHash: executableChanged ? null : existing.approvedHash,
          source: "professor_mari",
          revisions,
          installedAt: existing.installedAt,
          createdAt: existing.createdAt,
          updatedAt: now(),
        };
        return this.executeMutation(
          {
            kind: "replace",
            table,
            id,
            row,
            apply: firstBoolean(args, ["apply"]) === true,
            personalExtensionDraftMutation: true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? "Professor Mari updated a Personal Extension draft",
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      default:
        return {
          ok: false,
          mode: "read",
          command: context.command,
          error: "Unsupported Personal Extension app_data action.",
        };
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
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("agent_configs", row) : null,
        };
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
          actionDataWithTopLevel(
            args,
            ["data", "agent", "row"],
            [
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
            ],
          ),
        );
        requiredString(data, ["name"], "agent name");
        requiredString(data, ["type"], "agent type");
        const request: ParsedMutationRequest = {
          kind: "insert",
          table: "agent_configs",
          row: data,
          apply: appDataCreateApply(args),
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
          actionDataWithTopLevel(
            args,
            ["patch", "data", "agent"],
            [
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
            ],
          ),
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
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parsePromptPresetRow(row) : null,
        };
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
        const payload = actionDataWithTopLevel(
          args,
          ["data", "preset", "promptPreset", "row"],
          [
            "name",
            "description",
            "imagePath",
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
          ],
        );
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
        const payload = actionDataWithTopLevel(
          args,
          ["patch", "data", "preset", "promptPreset"],
          [
            "name",
            "description",
            "imagePath",
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
          ],
        );
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
      case "sections": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const sectionId = firstString(args, ["sectionId"]);
        const orderIndex = new Map(
          parseJsonArrayValue(preset.sectionOrder).map((id, index) => [String(id), index] as const),
        );
        const sections = (await this.rawRows("prompt_sections"))
          .filter((section) => section.presetId === presetId)
          .filter((section) => !sectionId || section.id === sectionId)
          .sort(
            (a, b) =>
              (orderIndex.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
              (orderIndex.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER),
          )
          .map(summarizePromptSectionRow);
        return { ok: true, mode: "read", command: context.command, output: sections };
      }
      case "getsection": {
        const sectionId = requiredString(args, ["sectionId", "id"], "prompt section id");
        const row = await this.getRawById(getMeta("prompt_sections"), sectionId);
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("prompt_sections", row) : null,
        };
      }
      case "groups": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const orderIndex = new Map(
          parseJsonArrayValue(preset.groupOrder).map((id, index) => [String(id), index] as const),
        );
        const groups = (await this.rawRows("prompt_groups"))
          .filter((group) => group.presetId === presetId)
          .sort(
            (a, b) =>
              (orderIndex.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
              (orderIndex.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER),
          )
          .map(summarizePromptGroupRow);
        return { ok: true, mode: "read", command: context.command, output: groups };
      }
      case "getgroup": {
        const groupId = requiredString(args, ["groupId", "id"], "prompt group id");
        const row = await this.getRawById(getMeta("prompt_groups"), groupId);
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("prompt_groups", row) : null,
        };
      }
      case "choiceblocks": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const blocks = (await this.rawRows("choice_blocks"))
          .filter((block) => block.presetId === presetId)
          .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
          .map(summarizeChoiceBlockRow);
        return { ok: true, mode: "read", command: context.command, output: blocks };
      }
      case "getchoiceblock": {
        const choiceBlockId = requiredString(args, ["choiceBlockId", "id"], "choice block id");
        const row = await this.getRawById(getMeta("choice_blocks"), choiceBlockId);
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("choice_blocks", row) : null,
        };
      }
      case "updatesection": {
        const sectionId = requiredString(args, ["sectionId", "id"], "prompt section id");
        const existing = await this.getRawById(getMeta("prompt_sections"), sectionId);
        if (!existing) throw new Error(`Prompt section ${sectionId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "section"],
          [
            "name",
            "content",
            "role",
            "enabled",
            "isMarker",
            "groupId",
            "markerConfig",
            "injectionPosition",
            "injectionDepth",
            "injectionOrder",
          ],
        );
        const patch = buildPromptSectionPatch(data);
        if (Object.keys(patch).length === 0) {
          throw new Error(
            "preset.updateSection needs sectionId plus a field such as content, name, role, enabled, groupId, or injectionOrder",
          );
        }
        if (String(existing.isMarker) === "true" && typeof patch.content === "string") {
          throw new Error(
            `Section ${sectionId} is a marker; its content is generated from markerConfig at assembly, so a content edit has no effect. Edit markerConfig instead.`,
          );
        }
        // #4812: a section may only join a group in its OWN preset, or it drops out of its preset's
        // group tree. validateTouchedRows only checks the group row exists, not its presetId.
        if (typeof patch.groupId === "string" && patch.groupId) {
          const group = await this.getRawById(getMeta("prompt_groups"), patch.groupId);
          if (!group || String(group.presetId) !== String(existing.presetId)) {
            throw new Error(`Group ${patch.groupId} is not a group in this section's preset.`);
          }
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "prompt_sections",
            id: sectionId,
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
      case "updategroup": {
        const groupId = requiredString(args, ["groupId", "id"], "prompt group id");
        const existing = await this.getRawById(getMeta("prompt_groups"), groupId);
        if (!existing) throw new Error(`Prompt group ${groupId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "group"],
          ["name", "parentGroupId", "order", "enabled"],
        );
        const patch = buildPromptGroupPatch(data);
        if (Object.keys(patch).length === 0) {
          throw new Error(
            "preset.updateGroup needs groupId plus a field such as name, enabled, order, or parentGroupId",
          );
        }
        // #4812: a parent group must live in the same preset and must not create a cycle (a group
        // nested under itself or under one of its own descendants would loop any tree walk).
        if (typeof patch.parentGroupId === "string" && patch.parentGroupId) {
          const parentId = patch.parentGroupId;
          if (parentId === groupId) throw new Error("A group cannot be its own parent.");
          const groupsById = new Map((await this.rawRows("prompt_groups")).map((group) => [String(group.id), group]));
          const parent = groupsById.get(parentId);
          if (!parent || String(parent.presetId) !== String(existing.presetId)) {
            throw new Error(`Parent group ${parentId} is not a group in this preset.`);
          }
          const seen = new Set<string>();
          let cursor: Row | undefined = parent;
          while (cursor) {
            const cursorId = String(cursor.id);
            if (cursorId === groupId) throw new Error("That parent would create a group cycle.");
            if (seen.has(cursorId)) break;
            seen.add(cursorId);
            cursor =
              typeof cursor.parentGroupId === "string" && cursor.parentGroupId
                ? groupsById.get(cursor.parentGroupId)
                : undefined;
          }
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "prompt_groups",
            id: groupId,
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
      case "updatechoiceblock": {
        const choiceBlockId = requiredString(args, ["choiceBlockId", "id"], "choice block id");
        const existing = await this.getRawById(getMeta("choice_blocks"), choiceBlockId);
        if (!existing) throw new Error(`Choice block ${choiceBlockId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["patch", "data", "choiceBlock", "choice"],
          [
            "variableName",
            "variable",
            "question",
            "options",
            "choices",
            "values",
            "multiSelect",
            "separator",
            "randomPick",
            "displayMode",
            "optionSort",
            "sortOrder",
          ],
        );
        const usedVariableNames = new Set(
          (await this.rawRows("choice_blocks"))
            .filter((block) => block.presetId === existing.presetId && block.id !== choiceBlockId)
            .map((block) => String(block.variableName)),
        );
        const patch = buildChoiceBlockPatch(data, usedVariableNames);
        if (Object.keys(patch).length === 0) {
          throw new Error(
            "preset.updateChoiceBlock needs choiceBlockId plus a field such as question, options, variableName, or multiSelect",
          );
        }
        if (Array.isArray(patch.options) && patch.options.length === 0) {
          throw new Error(
            "preset.updateChoiceBlock cannot set an empty options array; a choice block needs at least one option",
          );
        }
        return this.executeMutation(
          {
            kind: "patch",
            table: "choice_blocks",
            id: choiceBlockId,
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
      case "addsection": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["data", "section", "row"],
          [
            "name",
            "identifier",
            "content",
            "role",
            "enabled",
            "isMarker",
            "groupId",
            "markerConfig",
            "injectionPosition",
            "injectionDepth",
            "injectionOrder",
          ],
        );
        requiredString(data, ["name", "title", "label"], "section name");
        // #4812: a section may only be filed under a group in its OWN preset (same reason as
        // updateSection) — validateTouchedRows only checks the group row exists, not its presetId.
        if (typeof data.groupId === "string" && data.groupId) {
          const group = await this.getRawById(getMeta("prompt_groups"), data.groupId);
          if (!group || String(group.presetId) !== String(presetId)) {
            throw new Error(`Group ${data.groupId} is not a group in this preset.`);
          }
        }
        const sectionOrder = parseJsonArrayValue(preset.sectionOrder).map(String);
        const sectionId = newId();
        const usedIdentifiers = new Set(
          (await this.rawRows("prompt_sections"))
            .filter((section) => section.presetId === presetId)
            .map((section) => String(section.identifier)),
        );
        const row = buildPromptSectionInsertRow(data, presetId, sectionId, sectionOrder.length + 1, usedIdentifiers);
        // Insert the section AND append its id to the parent sectionOrder in one reviewable plan;
        // a section missing from sectionOrder is never assembled (would look like the #4812 bug).
        return this.executeMutation(
          {
            kind: "patch",
            table: "prompt_presets",
            id: presetId,
            patch: { sectionOrder: [...sectionOrder, sectionId] },
            apply: appDataCreateApply(args),
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
            relatedInserts: [{ table: "prompt_sections", row }],
          },
          context.command,
          context.sessionId,
        );
      }
      case "addgroup": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["data", "group", "row"],
          ["name", "parentGroupId", "order", "enabled"],
        );
        requiredString(data, ["name", "title", "label"], "group name");
        // #4812: a parent group must live in the same preset. A fresh group has no descendants yet,
        // so a cycle is impossible here — only the cross-preset/existence check is needed.
        if (typeof data.parentGroupId === "string" && data.parentGroupId) {
          const parent = await this.getRawById(getMeta("prompt_groups"), data.parentGroupId);
          if (!parent || String(parent.presetId) !== String(presetId)) {
            throw new Error(`Parent group ${data.parentGroupId} is not a group in this preset.`);
          }
        }
        const groupOrder = parseJsonArrayValue(preset.groupOrder).map(String);
        const groupId = newId();
        const row = buildPromptGroupInsertRow(data, presetId, groupId, (groupOrder.length + 1) * 100);
        return this.executeMutation(
          {
            kind: "patch",
            table: "prompt_presets",
            id: presetId,
            patch: { groupOrder: [...groupOrder, groupId] },
            apply: appDataCreateApply(args),
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
            relatedInserts: [{ table: "prompt_groups", row }],
          },
          context.command,
          context.sessionId,
        );
      }
      case "addchoiceblock": {
        const presetId = requiredString(args, ["presetId", "id"], "prompt preset id");
        const preset = await this.getRawById(getMeta("prompt_presets"), presetId);
        if (!preset) throw new Error(`Prompt preset ${presetId} not found`);
        const data = actionDataWithTopLevel(
          args,
          ["data", "choiceBlock", "choice", "row"],
          [
            "variableName",
            "variable",
            "question",
            "options",
            "choices",
            "values",
            "multiSelect",
            "separator",
            "randomPick",
            "displayMode",
            "optionSort",
            "sortOrder",
          ],
        );
        const existingBlocks = (await this.rawRows("choice_blocks")).filter((block) => block.presetId === presetId);
        const choiceBlockId = newId();
        const usedVariableNames = new Set(existingBlocks.map((block) => String(block.variableName)));
        const row = buildChoiceBlockInsertRow(
          data,
          presetId,
          choiceBlockId,
          existingBlocks.length + 1,
          usedVariableNames,
        );
        if ((row.options as unknown[]).length === 0) {
          throw new Error(
            "preset.addChoiceBlock needs a non-empty options array (each option is a label the user can pick)",
          );
        }
        // choice_blocks are ordered by their own sortOrder column, not a parent order array, so a
        // plain insert is enough — no parent patch needed.
        return this.executeMutation(
          {
            kind: "insert",
            table: "choice_blocks",
            id: choiceBlockId,
            row,
            apply: appDataCreateApply(args),
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "deletesection": {
        const sectionId = requiredString(args, ["sectionId", "id"], "prompt section id");
        const existing = await this.getRawById(getMeta("prompt_sections"), sectionId);
        if (!existing) throw new Error(`Prompt section ${sectionId} not found`);
        return this.executeMutation(
          {
            kind: "preset-section-delete",
            table: "prompt_sections",
            id: sectionId,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "deletegroup": {
        const groupId = requiredString(args, ["groupId", "id"], "prompt group id");
        const existing = await this.getRawById(getMeta("prompt_groups"), groupId);
        if (!existing) throw new Error(`Prompt group ${groupId} not found`);
        return this.executeMutation(
          {
            kind: "preset-group-delete",
            table: "prompt_groups",
            id: groupId,
            apply: firstBoolean(args, ["apply"]) === true,
            cascade: false,
            reason: firstString(args, ["reason"]) ?? null,
            cwd: context.cwd,
          },
          context.command,
          context.sessionId,
        );
      }
      case "deletechoiceblock": {
        const choiceBlockId = requiredString(args, ["choiceBlockId", "id"], "choice block id");
        const existing = await this.getRawById(getMeta("choice_blocks"), choiceBlockId);
        if (!existing) throw new Error(`Choice block ${choiceBlockId} not found`);
        return this.executeMutation(
          {
            kind: "delete",
            table: "choice_blocks",
            id: choiceBlockId,
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
        return {
          ok: false,
          mode: "read",
          command: context.command,
          error: "Unsupported prompt preset app_data action.",
        };
    }
  }

  getPendingApprovals(): MariDbPendingApproval[] {
    this.ensurePendingHydrated();
    return Array.from(this.pending.values()).map((record) => this.pendingView(record));
  }

  // #4931: the raw (serialized) snapshot of one pending change, for the synthetic prompt render.
  // diffPreview only carries the parsed before/after; the render needs the raw rows (JSON columns as
  // strings) to feed the assembler. The client validates its diffPreview index against the tuple, so
  // this maps 1:1 to plan.changes[index] for the first PREVIEW_LIMIT changes.
  getPendingChangeRaw(
    id: string,
    index: number,
  ): {
    table: string;
    id: string;
    action: MariDbRowChange["action"];
    beforeRaw: Row | null;
    afterRaw: Row | null;
  } | null {
    this.ensurePendingHydrated();
    if (!Number.isInteger(index) || index < 0 || index >= PREVIEW_LIMIT) return null;
    const change = this.pending.get(id)?.plan.changes[index];
    if (!change) return null;
    return {
      table: change.table,
      id: change.id,
      action: change.action,
      beforeRaw: change.beforeRaw ?? null,
      afterRaw: change.afterRaw ?? null,
    };
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

  async keepAppliedReviewAndWait(
    id: string,
    opts?: { enable?: boolean },
  ): Promise<{ approval: MariDbPendingApproval; history: MariDbHistoryEntry | null; completed: boolean } | null> {
    this.ensurePendingHydrated();
    const record = this.pending.get(id);
    if (!record) return null;
    const approval = this.pendingView(record);
    const history = await this.keepAppliedReview(id, opts);
    return { approval, history, completed: true };
  }

  async keepAppliedReview(id: string, opts?: { enable?: boolean }): Promise<MariDbHistoryEntry | null> {
    this.ensurePendingHydrated();
    return this.withReviewLock(id, () => this.keepAppliedReviewLocked(id, opts));
  }

  private async keepAppliedReviewLocked(id: string, opts?: { enable?: boolean }): Promise<MariDbHistoryEntry | null> {
    const record = this.pending.get(id);
    if (!record) return null;
    // Do not resolve memory until the durable undo leaves the hydration set. If retirement fails,
    // Keep fails closed and the review remains pending both now and after restart.
    await this.deletePendingSidecar(id);
    this.pending.delete(id);
    // #4851 "Keep & Enable": a Mari-authored memory lands disabled; flip it on when the
    // user chooses that action, before we drop the pending record. Strictly gated to
    // mari_instructions inserts (deliberately never touches installed_extensions.enabled
    // or any other table).
    if (opts?.enable) {
      // Enabling a kept memory is a convenience, not part of the Keep contract. Isolate its
      // failure (e.g. the row was deleted from the panel between insert and approval) so the
      // Keep always completes and never strands the pending review with the change applied.
      try {
        const instructionsStore = createMariInstructionsStorage(this.db);
        for (const change of record.plan.changes) {
          if (change.action === "insert" && change.table === "mari_instructions") {
            await instructionsStore.update(String(change.id), { enabled: true });
          }
        }
      } catch (err) {
        logger.warn(err, "[mari-db] Keep & Enable: could not enable the kept memory");
      }
    }
    const history = await this.recordHistory({
      plan: record.plan,
      command: record.command,
      sessionId: record.sessionId,
      status: "kept",
      journalPath: record.journalPath,
    });
    return history;
  }

  async restoreAppliedReview(
    id: string,
  ): Promise<
    | { approval: MariDbPendingApproval; history: MariDbHistoryEntry }
    | { approval: MariDbPendingApproval; outcome: "state_changed"; error: string }
    | null
  > {
    this.ensurePendingHydrated();
    return this.withReviewLock(id, () => this.restoreAppliedReviewLocked(id));
  }

  private async restoreAppliedReviewLocked(
    id: string,
  ): Promise<
    | { approval: MariDbPendingApproval; history: MariDbHistoryEntry }
    | { approval: MariDbPendingApproval; outcome: "state_changed"; error: string }
    | null
  > {
    const record = this.pending.get(id);
    if (!record) return null;
    const approval = this.pendingView(record);
    const retiredSidecar = this.retirePendingSidecar(id);
    try {
      await this.restorePlan(record.plan);
    } catch (err) {
      if (err instanceof RestoreStateChangedError) {
        await this.reactivatePendingSidecar(record, retiredSidecar);
        // #4852 F2: a newer edit landed after Mari staged this change, so reverting would
        // overwrite it. Leave the live data AND the pending review in place (do not delete the
        // pending record, drop the sidecar, or record a "restored" history entry) so the user can
        // re-review against current state instead of silently losing the newer edit.
        return {
          approval,
          outcome: "state_changed",
          error:
            "This data changed after Professor Mari staged it; a newer edit would be overwritten. Review a fresh proposal instead.",
        };
      }
      if (err instanceof HomeWidgetCatalogConflictError) {
        // The catalog compare-and-swap rejected before writing, so this known conflict is safe to
        // retry and retains its original typed error contract.
        await this.reactivatePendingSidecar(record, retiredSidecar);
        throw err;
      }
      // An unexpected error may occur after the database transaction committed (for example during
      // validation/flush). Never reactivate an undo whose live-state correspondence is uncertain.
      this.pending.delete(id);
      this.discardRetiredPendingSidecar(retiredSidecar);
      throw new Error("Restore failed and its review was retired to avoid exposing stale undo.", { cause: err });
    }
    this.pending.delete(id);
    this.discardRetiredPendingSidecar(retiredSidecar);
    // #4927: the restore reverted the lorebook rows, so rebuild any embedded character_book from the
    // restored state (no-op for standalone lorebooks).
    await this.syncAffectedCharacterBooks(record.plan.changes);
    const history = await this.recordHistory({
      plan: record.plan,
      command: record.command,
      sessionId: record.sessionId,
      status: "restored",
      journalPath: record.journalPath,
    });
    return { approval, history };
  }

  // Reject a dependency-closed SUBSET of a pending review's rows (revert just those, keep the rest
  // applied), scoped to top-level `lorebook_entries` changes. The client sends each row's
  // diffPreview index plus a {table,id,action} consistency tuple; the index maps 1:1 to
  // plan.changes[index] for the first PREVIEW_LIMIT changes, where the real PlanChange still carries
  // apply/cascadeOf/beforeRaw that diffPreview drops. Mirrors restoreAppliedReview's audited
  // contract (#4852 supersede via restoreChanges, #4927 charbook sync, #4813 durable sidecar),
  // shrinking the pending record in place instead of resolving it whole.
  async rejectRows(
    id: string,
    selections: Array<{ index: number; table: string; id: string; action: MariDbRowChange["action"] }>,
  ): Promise<
    | {
        approval: MariDbPendingApproval | null;
        history: MariDbHistoryEntry;
        rejected: number;
        remaining: number;
        completed: boolean;
      }
    | { outcome: "state_changed"; error: string }
    | { outcome: "invalid_selection"; error: string }
    | null
  > {
    this.ensurePendingHydrated();
    return this.withReviewLock(id, () => this.rejectRowsLocked(id, selections));
  }

  private async rejectRowsLocked(
    id: string,
    selections: Array<{ index: number; table: string; id: string; action: MariDbRowChange["action"] }>,
  ): Promise<
    | {
        approval: MariDbPendingApproval | null;
        history: MariDbHistoryEntry;
        rejected: number;
        remaining: number;
        completed: boolean;
      }
    | { outcome: "state_changed"; error: string }
    | { outcome: "invalid_selection"; error: string }
    | null
  > {
    const record = this.pending.get(id);
    if (!record) return null;

    if (selections.length === 0) {
      return { outcome: "invalid_selection", error: "No rows were selected to reject." };
    }
    const selected = new Set<PlanChange>();
    for (const sel of selections) {
      if (!Number.isInteger(sel.index) || sel.index < 0 || sel.index >= PREVIEW_LIMIT) {
        return {
          outcome: "invalid_selection",
          error: "This review changed since it was shown. Reopen it and try again.",
        };
      }
      const matchesSelection = (candidate: PlanChange | undefined): candidate is PlanChange =>
        !!candidate && candidate.table === sel.table && candidate.id === sel.id && candidate.action === sel.action;
      const indexedChange = record.plan.changes[sel.index];
      // A serialized rejection may shift the second request's index. Resolve only the exact tuple
      // from the still-visible preview when it has one unique match, never another row or a hidden
      // change beyond PREVIEW_LIMIT.
      const shiftedMatches = matchesSelection(indexedChange)
        ? []
        : record.plan.changes.slice(0, PREVIEW_LIMIT).filter(matchesSelection);
      const change = matchesSelection(indexedChange)
        ? indexedChange
        : shiftedMatches.length === 1
          ? shiftedMatches[0]
          : undefined;
      if (!change) {
        return {
          outcome: "invalid_selection",
          error: "This review changed since it was shown. Reopen it and try again.",
        };
      }
      // v1: only individually-authored lorebook entries can be rejected one at a time. A whole-
      // lorebook delete's cascade children (cascadeOf set) would re-insert an entry whose parent
      // lorebook is still deleted (dangling reference) — reject the parent change instead.
      if (change.table !== "lorebook_entries") {
        return {
          outcome: "invalid_selection",
          error: "Only lorebook entries can be rejected individually. Use Restore to revert the whole change.",
        };
      }
      if (change.cascadeOf) {
        return {
          outcome: "invalid_selection",
          error: "This entry was removed as part of deleting its lorebook. Reject the lorebook change instead.",
        };
      }
      // Rejecting an entry DELETE re-inserts the entry, which needs a live parent lorebook. A plan can
      // hold a top-level `lorebooks` delete AND a top-level `lorebook_entries` delete with no
      // cascadeOf link (a transform, or two delete plans merged into one review); rejecting only the
      // entry would re-insert it under a deleted parent. Post-restore validate() only catches that
      // dangling reference AFTER restoreChanges has committed (leaving the bad row + an unhandled
      // error), so refuse it up front.
      if (change.action === "delete") {
        const parentLorebookId = typeof change.beforeRaw?.lorebookId === "string" ? change.beforeRaw.lorebookId : null;
        const parentLive =
          parentLorebookId !== null && (await this.getRawById(getMeta("lorebooks"), parentLorebookId)) !== null;
        if (!parentLive) {
          return {
            outcome: "invalid_selection",
            error:
              "This entry's lorebook was also removed, so it can't be restored on its own. Use Restore to revert the whole change.",
          };
        }
      }
      selected.add(change);
    }

    // lorebook_entries is a cascade leaf, so the closure is exactly the selected rows.
    const rejectedChanges = record.plan.changes.filter((change) => selected.has(change));
    const remainingChanges = record.plan.changes.filter((change) => !selected.has(change));
    const rejectedPlan: Plan = {
      ...record.plan,
      changes: rejectedChanges,
      summary: summaryForChanges(rejectedChanges),
    };

    const retiredSidecar = this.retirePendingSidecar(id);
    try {
      await this.restoreChanges(rejectedChanges);
    } catch (err) {
      if (err instanceof RestoreStateChangedError) {
        await this.reactivatePendingSidecar(record, retiredSidecar);
        // #4852 F2: a newer edit landed after Mari staged one of these rows, so reverting would
        // overwrite it. Leave the live data AND the whole pending review intact (nothing was
        // written; the tx rolled back) so the user can re-review against current state.
        return {
          outcome: "state_changed",
          error:
            "This data changed after Professor Mari staged it; a newer edit would be overwritten. Review a fresh proposal instead.",
        };
      }
      this.pending.delete(id);
      this.discardRetiredPendingSidecar(retiredSidecar);
      throw new Error("Row rejection failed and its review was retired to avoid exposing stale undo.", { cause: err });
    }

    const remainingPlan = { ...record.plan, changes: remainingChanges, summary: summaryForChanges(remainingChanges) };
    const remainingRecord: PendingRecord = {
      ...record,
      plan: remainingPlan,
      affectedTables: remainingPlan.summary.affectedTables,
      affectedRows: remainingPlan.summary.affectedRows,
      diffPreview: remainingPlan.summary.preview,
      diffTruncated: remainingPlan.summary.truncated,
    };

    try {
      await this.syncAffectedCharacterBooks(rejectedChanges);
      if (remainingChanges.length === 0) {
        this.pending.delete(id);
      } else {
        // The old full plan is already retired. Install the replacement sidecar before publishing
        // its matching in-memory card, so disk and memory cannot disagree across a restart.
        await this.writePendingSidecar(remainingRecord);
        this.pending.set(id, remainingRecord);
      }
      this.discardRetiredPendingSidecar(retiredSidecar);
    } catch (err) {
      // The rows were already restored. Drop both stale review representations and surface the
      // durability loss instead of keeping an undo that could overwrite newer data after restart.
      this.pending.delete(id);
      this.discardRetiredPendingSidecar(retiredSidecar);
      throw new Error("Rows were restored, but the remaining review could not be saved safely.", { cause: err });
    }

    const history = await this.recordHistory({
      plan: rejectedPlan,
      command: record.command,
      sessionId: record.sessionId,
      status: "restored",
      journalPath: record.journalPath,
    });

    if (remainingChanges.length === 0) {
      // Every row was rejected — resolve the review whole instead of persisting a zero-row card.
      return { approval: null, history, rejected: rejectedChanges.length, remaining: 0, completed: true };
    }
    return {
      approval: this.pendingView(remainingRecord),
      history,
      rejected: rejectedChanges.length,
      remaining: remainingChanges.length,
      completed: false,
    };
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
          issues.push({
            level: "error",
            table: tableName,
            id: id == null ? null : String(id),
            message: `Missing primary key ${pk}`,
          });
        } else if (ids.has(id)) {
          issues.push({ level: "error", table: tableName, id, message: `Duplicate primary key ${pk}=${id}` });
        } else {
          ids.add(id);
        }
        for (const column of meta.columns) {
          if (column.notNull && (row[column.key] === null || row[column.key] === undefined)) {
            issues.push({
              level: "error",
              table: tableName,
              id: id == null ? null : String(id),
              message: `Missing required column ${column.key}`,
            });
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
            issues.push({
              level: "error",
              table: tableName,
              id: id == null ? null : String(id),
              message: `Column ${key} is not valid JSON`,
            });
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
      const parents = new Set(
        (await getRows(cascade.parent)).map((row) => row[cascade.parentKey]).filter((id) => typeof id === "string"),
      );
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
      issues.push({
        level: "error",
        table: "agent_configs",
        id,
        message: 'Agent enabled must be stored as "true" or "false"',
      });
    }
    if (row.connectionId !== null && row.connectionId !== undefined && typeof row.connectionId !== "string") {
      issues.push({
        level: "error",
        table: "agent_configs",
        id,
        message: "Agent connectionId must be a string or null",
      });
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
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Tool description must be a non-empty string",
      });
    }
    if (typeof row.executionType !== "string" || !TOOL_EXECUTION_TYPES.has(row.executionType)) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: `Tool executionType must be one of: ${[...TOOL_EXECUTION_TYPES].join(", ")}`,
      });
    }
    if (row.executionType === "script" && row.enabled === "true" && !isCustomToolScriptEnabled()) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Script custom tools require CUSTOM_TOOL_SCRIPT_ENABLED=true and a server restart",
      });
    }
    if (typeof row.enabled !== "string" || !BOOLEAN_TEXT_VALUES.has(row.enabled)) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: 'Tool enabled must be stored as "true" or "false"',
      });
    }
    if (
      row.includeHiddenContext !== undefined &&
      (typeof row.includeHiddenContext !== "string" || !BOOLEAN_TEXT_VALUES.has(row.includeHiddenContext))
    ) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: 'Tool includeHiddenContext must be stored as "true" or "false"',
      });
    }
    const parametersSchema = tryParseJsonColumn(row, "parametersSchema");
    if (parametersSchema !== undefined && !isRecord(parametersSchema)) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Tool parametersSchema must be a JSON object",
      });
    }
    if (row.webhookUrl !== null && row.webhookUrl !== undefined && row.webhookUrl !== "") {
      if (typeof row.webhookUrl !== "string") {
        issues.push({
          level: "error",
          table: "custom_tools",
          id,
          message: "Tool webhookUrl must be a URL string or null",
        });
      } else if (!row.webhookUrl.startsWith(ENCRYPTED_WEBHOOK_PREFIX)) {
        try {
          new URL(row.webhookUrl);
        } catch {
          issues.push({ level: "error", table: "custom_tools", id, message: "Tool webhookUrl must be a valid URL" });
        }
      }
    }
    if (row.executionType === "script" && (typeof row.scriptBody !== "string" || row.scriptBody.trim().length === 0)) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Script tools require a non-empty scriptBody",
      });
    }
    if (
      row.executionType === "static" &&
      row.staticResult !== null &&
      row.staticResult !== undefined &&
      typeof row.staticResult !== "string"
    ) {
      issues.push({
        level: "error",
        table: "custom_tools",
        id,
        message: "Static tool result must be a string or null",
      });
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
    if (hasFlag(parsed.flags, "help"))
      return { ok: true, mode: "read", command: context.command, output: this.codeHelpText() };

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
          errors: [repoRoot, branch, status, stat]
            .filter((result) => !result.ok)
            .map((result) => result.stderr.trim() || `${result.command} failed`),
        },
      },
    };
  }

  private async executeCodeDiff(
    context: CodeCommandContext,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
    const cwd = this.codeCwd(context.cwd);
    const cached = hasFlag(flags, "cached") || hasFlag(flags, "staged");
    const includePatch = hasFlag(flags, "patch") || hasFlag(flags, "full");
    const diffBaseArgs = ["diff", ...(cached ? ["--cached"] : [])];
    const [status, stat, nameOnly, patch] = await Promise.all([
      runProcess("git", ["status", "--short", "--branch"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", [...diffBaseArgs, "--stat"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      runProcess("git", [...diffBaseArgs, "--name-only"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS }),
      includePatch
        ? runProcess("git", [...diffBaseArgs, "--patch"], { cwd, timeoutMs: CODE_READ_TIMEOUT_MS })
        : Promise.resolve(null),
    ]);
    const statusText = status.stdout.trim();
    const gitFiles = nameOnly.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const changedFiles = [...new Set([...parseGitStatusFiles(statusText), ...gitFiles])].sort((a, b) =>
      a.localeCompare(b),
    );
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
        errors: [status, stat, nameOnly, patch]
          .filter((result): result is ProcessRunResult => !!result && !result.ok)
          .map((result) => result.stderr.trim() || `${result.command} failed`),
      },
    };
  }

  private async executeCodeCheck(
    context: CodeCommandContext,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
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
      return {
        ok: false,
        mode: "read",
        command: context.command,
        error: `Unknown mari code reload command: ${sub}\n${this.codeReloadHelpText()}`,
      };
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
              ? [
                  "Restart the Marinara server or wait for tsx watch/dev launcher to restart it.",
                  "Run mari code health after reconnecting.",
                ]
              : [
                  "Restart the Marinara server and reload the browser client.",
                  "Run mari code health after reconnecting.",
                ],
      },
    };
  }

  private executeCodeContinue(runId: string | undefined, context: CodeCommandContext): MariDbCommandResult {
    if (!runId)
      return { ok: false, mode: "read", command: context.command, error: "Usage: mari code continue <run-id>" };
    return {
      ok: false,
      mode: "read",
      command: context.command,
      error:
        "Durable workspace run resume is planned but not implemented yet. Reopen Professor Mari and paste the run context or continue manually.",
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
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("characters", row) : null,
        };
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizePersonaRow),
        };
      }
      case "active": {
        const row = (await this.rawRows("personas")).find((r) => r.isActive === "true") ?? null;
        return { ok: true, mode: "read", command: context.command, output: row ? parseRow("personas", row) : null };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari personas get <id>");
        const row = await this.getRawById(getMeta("personas"), id);
        return {
          ok: Boolean(row),
          mode: "read",
          command: context.command,
          output: row ? parseRow("personas", row) : null,
        };
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
            ? personaTagsRaw
                .split(/[,|]/)
                .map((t) => t.trim())
                .filter(Boolean)
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizeLorebookRow),
        };
      }
      case "get": {
        const id = parsed.positionals[0];
        if (!id) throw new Error("Usage: mari lorebooks get <id>");
        const row = await this.getRawById(getMeta("lorebooks"), id);
        if (!row) return { ok: false, mode: "read", command: context.command, output: null };
        const entryCount = (await this.rawRows("lorebook_entries")).filter((e) => e.lorebookId === id).length;
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: { ...parseRow("lorebooks", row), entryCount },
        };
      }
      case "entries": {
        const lorebookId = parsed.positionals[0];
        if (!lorebookId)
          throw new Error("Usage: mari lorebooks entries <lorebook-id> [--limit <n>] [--entry-id <entry-id>]");
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
        if (!name)
          throw new Error("Usage: mari lorebooks create --name <name> [--description <text>] [--global] [--apply]");
        const timestamp = now();
        const row: Row = {
          id: flagString(flags, "id") ?? newId(),
          name,
          description: flagString(flags, "description") ?? "",
          category: normalizeLorebookCategory(flagString(flags, "category")),
          isGlobal: hasFlag(flags, "global") ? "true" : "false",
          enabled: "true",
          hiddenFromLibrary: "false",
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
            ? lorebookTagsRaw
                .split(/[,|]/)
                .map((t) => t.trim())
                .filter(Boolean)
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
            "Usage: mari lorebooks add-entry <lorebook-id> --name <name> [--content <text>] [--keys <k1,k2,...>] [--secondary-keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--selective] [--selective-logic <and|and_all|or|not|not_all>] [--match-whole-words] [--case-sensitive] [--use-regex] [--outlet-name <name>] [--folder-id <folder-id>] [--apply] [--reason <text>]",
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
        const addOutletName = flagString(flags, "outlet-name")?.trim() ?? "";
        const timestamp = now();
        const addSecondaryKeysRaw = flagString(flags, "secondary-keys") ?? "";
        const addSecondaryKeys = addSecondaryKeysRaw
          ? addSecondaryKeysRaw
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
        const addSelectiveLogic = flagString(flags, "selective-logic");
        if (addSelectiveLogic !== undefined && !normalizeSelectiveLogicValue(addSelectiveLogic)) {
          throw new Error("--selective-logic must be one of: and, and_all, or, not, not_all");
        }
        // Reuse buildLorebookEntryCreateRow (the app_data create path) so the CLI and app_data
        // entry shapes cannot drift; then apply the CLI-only folderId.
        const entryRow = buildLorebookEntryCreateRow(
          {
            name: entryName,
            content: flagString(flags, "content") ?? "",
            description: flagString(flags, "description") ?? "",
            tag: flagString(flags, "tag") ?? "",
            keys,
            secondaryKeys: addSecondaryKeys,
            selective: hasFlag(flags, "selective"),
            selectiveLogic: addSelectiveLogic,
            matchWholeWords: hasFlag(flags, "match-whole-words"),
            caseSensitive: hasFlag(flags, "case-sensitive"),
            useRegex: hasFlag(flags, "use-regex"),
            outletName: addOutletName,
            position: addOutletName ? 7 : 0,
          },
          lorebookId,
          flagString(flags, "id") ?? newId(),
          timestamp,
        );
        entryRow.folderId = addFolderId ?? null;
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
            "Usage: mari lorebooks update-entry <entry-id> [--name <name>] [--content <text>] [--keys <k1,k2,...>] [--secondary-keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--outlet-name <name>] [--enable] [--disable] [--constant] [--no-constant] [--selective] [--no-selective] [--selective-logic <and|and_all|or|not|not_all>] [--match-whole-words] [--no-match-whole-words] [--case-sensitive] [--no-case-sensitive] [--use-regex] [--no-use-regex] [--order <n>] [--folder-id <folder-id>|none] [--apply] [--reason <text>]",
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
          ["outlet-name", "outletName"],
        ];
        for (const [flagName, fieldName] of entryFieldMap) {
          const val = flagString(flags, flagName);
          if (val !== undefined) entryPatch[fieldName] = fieldName === "outletName" ? val.trim() : val;
        }
        if (typeof entryPatch.outletName === "string" && entryPatch.outletName) entryPatch.position = 7;
        const keysRaw = flagString(flags, "keys");
        if (keysRaw !== undefined) {
          entryPatch.keys = keysRaw
            ? keysRaw
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
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
        if (hasFlag(flags, "selective")) entryPatch.selective = "true";
        if (hasFlag(flags, "no-selective")) entryPatch.selective = "false";
        if (hasFlag(flags, "match-whole-words")) entryPatch.matchWholeWords = "true";
        if (hasFlag(flags, "no-match-whole-words")) entryPatch.matchWholeWords = "false";
        if (hasFlag(flags, "case-sensitive")) entryPatch.caseSensitive = "true";
        if (hasFlag(flags, "no-case-sensitive")) entryPatch.caseSensitive = "false";
        if (hasFlag(flags, "use-regex")) entryPatch.useRegex = "true";
        if (hasFlag(flags, "no-use-regex")) entryPatch.useRegex = "false";
        const updateSelectiveLogic = flagString(flags, "selective-logic");
        if (updateSelectiveLogic !== undefined) {
          const normalizedLogic = normalizeSelectiveLogicValue(updateSelectiveLogic);
          if (!normalizedLogic) throw new Error("--selective-logic must be one of: and, and_all, or, not, not_all");
          entryPatch.selectiveLogic = normalizedLogic;
        }
        const updateSecondaryKeysRaw = flagString(flags, "secondary-keys");
        if (updateSecondaryKeysRaw !== undefined) {
          entryPatch.secondaryKeys = updateSecondaryKeysRaw
            ? updateSecondaryKeysRaw
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean)
            : [];
        }
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
            "Provide at least one field to update (--name, --content, --keys, --secondary-keys, --description, --tag, --outlet-name, --enable, --disable, --constant, --no-constant, --selective, --no-selective, --selective-logic, --match-whole-words, --no-match-whole-words, --case-sensitive, --no-case-sensitive, --use-regex, --no-use-regex, --order, --folder-id)",
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
        if (links.length === 0)
          throw new Error(`No link found between lorebook ${lorebookId} and character ${characterId}`);
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

  // #4812: `mari presets` CLI parity — a thin flag-parser that delegates to executePresetAction, so
  // the granular section/group/choice-block edits are available from the shell too.
  private async executePresetsCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const parsed = parseArgs(args.slice(1));
    const flags = parsed.flags;
    const apply = hasFlag(flags, "apply");
    const reason = flagString(flags, "reason") ?? null;
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.presetsHelpText() };
    }
    const run = (action: string, extra: Row) => this.executePresetAction(action, extra, context);
    const need = (index: number, usage: string) => {
      const value = parsed.positionals[index];
      if (!value) throw new Error(usage);
      return value;
    };
    switch (sub) {
      case "list":
        return run("list", { limit: flagString(flags, "limit"), search: flagString(flags, "search") });
      case "get":
        return run("get", { id: need(0, "Usage: mari presets get <preset-id>") });
      case "sections":
        return run("sections", {
          presetId: need(0, "Usage: mari presets sections <preset-id> [--section-id <id>]"),
          sectionId: flagString(flags, "section-id"),
        });
      case "get-section":
        return run("getsection", { sectionId: need(0, "Usage: mari presets get-section <section-id>") });
      case "groups":
        return run("groups", { presetId: need(0, "Usage: mari presets groups <preset-id>") });
      case "get-group":
        return run("getgroup", { groupId: need(0, "Usage: mari presets get-group <group-id>") });
      case "choice-blocks":
        return run("choiceblocks", { presetId: need(0, "Usage: mari presets choice-blocks <preset-id>") });
      case "get-choice-block":
        return run("getchoiceblock", {
          choiceBlockId: need(0, "Usage: mari presets get-choice-block <choice-block-id>"),
        });
      case "add-section":
        return run("addsection", {
          presetId: need(
            0,
            "Usage: mari presets add-section <preset-id> --name <name> [--content <text>] [--role <system|user|assistant>] [--group-id <id>] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "update-section":
        return run("updatesection", {
          sectionId: need(
            0,
            "Usage: mari presets update-section <section-id> [--content <text>] [--name <name>] [--enable|--disable] [--group-id <id>] [--injection-order <n>] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "delete-section":
        return run("deletesection", {
          sectionId: need(0, "Usage: mari presets delete-section <section-id> [--apply]"),
          apply,
          reason,
        });
      case "add-group":
        return run("addgroup", {
          presetId: need(
            0,
            "Usage: mari presets add-group <preset-id> --name <name> [--parent-group-id <id>] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "update-group":
        return run("updategroup", {
          groupId: need(
            0,
            "Usage: mari presets update-group <group-id> [--name <name>] [--enable|--disable] [--order <n>] [--parent-group-id <id>] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "delete-group":
        return run("deletegroup", {
          groupId: need(0, "Usage: mari presets delete-group <group-id> [--apply]"),
          apply,
          reason,
        });
      case "add-choice-block":
        return run("addchoiceblock", {
          presetId: need(
            0,
            "Usage: mari presets add-choice-block <preset-id> --variable-name <name> --question <text> --options <a,b,c> [--multi-select] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "update-choice-block":
        return run("updatechoiceblock", {
          choiceBlockId: need(
            0,
            "Usage: mari presets update-choice-block <choice-block-id> [--question <text>] [--options <a,b,c>] [--variable-name <name>] [--multi-select] [--apply]",
          ),
          data: presetDataFromFlags(flags),
          apply,
          reason,
        });
      case "delete-choice-block":
        return run("deletechoiceblock", {
          choiceBlockId: need(0, "Usage: mari presets delete-choice-block <choice-block-id> [--apply]"),
          apply,
          reason,
        });
      case "create": {
        const json = await resolveJsonInput(flags, context.cwd);
        if (!json)
          throw new Error(
            'Usage: mari presets create (--json \'{"name":"...","sections":[...]}\' | --json-file <path>) [--apply]',
          );
        return run("create", { data: parseRequiredJsonObjectInput(json, "preset json"), apply, reason });
      }
      case "update": {
        const id = need(
          0,
          "Usage: mari presets update <preset-id> (--json '<partial-json>' | --json-file <path>) [--apply]",
        );
        const json = await resolveJsonInput(flags, context.cwd);
        if (!json)
          throw new Error(
            "Usage: mari presets update <preset-id> (--json '<partial-json>' | --json-file <path>) [--apply]",
          );
        return run("update", { id, data: parseRequiredJsonObjectInput(json, "preset json"), apply, reason });
      }
      default:
        return {
          ok: false,
          mode: "read",
          command: context.command,
          error: `Unknown presets command "${sub}".\n${this.presetsHelpText()}`,
        };
    }
  }

  private presetsHelpText() {
    return [
      "Usage: mari presets <command>",
      "Reads:    list [--search <q>] [--limit <n>] | get <preset-id> | sections <preset-id> [--section-id <id>] | get-section <section-id> | groups <preset-id> | get-group <group-id> | choice-blocks <preset-id> | get-choice-block <id>",
      "Sections: add-section <preset-id> --name <n> [--content <t>] [--role <system|user|assistant>] [--group-id <id>] | update-section <section-id> [--content <t>] [--name <n>] [--enable|--disable] [--injection-order <n>] | delete-section <section-id>",
      "Groups:   add-group <preset-id> --name <n> [--parent-group-id <id>] | update-group <group-id> [--name <n>] [--enable|--disable] [--order <n>] | delete-group <group-id>",
      "Choices:  add-choice-block <preset-id> --variable-name <n> --question <t> --options <a,b,c> [--multi-select] | update-choice-block <id> [--question <t>] [--options <a,b,c>] | delete-choice-block <id>",
      "Whole:    create --json '<preset-json>' | update <preset-id> --json '<partial-json>'",
      "Writes need --apply to commit (otherwise a dry-run preview); add [--reason <text>]. Edits show an in-chat Keep/Restore review card.",
    ].join("\n");
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: { ...parseRow("chats", row), messageCount },
        };
      }
      case "messages": {
        const chatId = parsed.positionals[0];
        if (!chatId) {
          throw new Error(
            "Usage: mari chats messages <chat-id> [--last <n> | --after-post <n>] [--limit <n>] [--offset <n>] [--tail]",
          );
        }
        const limitFlag = flagString(flags, "limit");
        const limit = limitFlag !== undefined ? normalizeLimit(limitFlag, 20, 200) : null;
        const offset = normalizeOffset(flagString(flags, "offset"));
        const tail = hasFlag(flags, "tail");
        const last = parseChatRangeInteger(flagString(flags, "last"), "last", { minimum: 1, maximum: 200 });
        const afterPost = parseChatRangeInteger(flagString(flags, "after-post"), "after-post", {
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
        });
        if (last !== null && afterPost !== null) throw new Error("Use either --last or --after-post, not both");
        if (afterPost !== null && tail) throw new Error("--after-post cannot be combined with --tail");
        let messages = (await this.rawRows("messages")).filter((m) => m.chatId === chatId);
        messages.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
        const numberedMessages = messages.map((message, index) => ({ message, postNumber: index + 1 }));
        let selectedMessages: typeof numberedMessages;
        if (last !== null || afterPost !== null) {
          const scopedMessages = last !== null ? numberedMessages.slice(-last) : numberedMessages.slice(afterPost ?? 0);
          selectedMessages = scopedMessages.slice(offset, limit !== null ? offset + limit : undefined);
        } else if (tail) {
          const offsetMessages =
            offset > 0 ? numberedMessages.slice(0, Math.max(0, numberedMessages.length - offset)) : numberedMessages;
          selectedMessages = limit !== null ? offsetMessages.slice(-limit) : offsetMessages;
        } else {
          selectedMessages = numberedMessages.slice(offset, limit !== null ? offset + limit : undefined);
        }
        const result = selectedMessages.map(({ message, postNumber }) => ({
          postNumber,
          id: message.id,
          role: message.role,
          characterId: message.characterId ?? null,
          content: typeof message.content === "string" ? message.content : "",
          createdAt: message.createdAt,
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

  private async executeThemeCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
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
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: rows.slice(0, limit).map(summarizeThemeRow),
        };
      }
      case "active": {
        const row =
          (await this.rawRows(THEME_TABLE)).find((candidate) => candidate.isActive === THEME_ACTIVE_TRUE) ?? null;
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
        if (!name)
          throw new Error(
            "Usage: mari themes create --name <name> (--css <css> | --css-file <path>) [--activate] [--apply]",
          );
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
        if (!id)
          throw new Error("Usage: mari themes update <id> [--name <name>] [--css <css> | --css-file <path>] [--apply]");
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

  private async executeDbCommand(
    args: string[],
    context: { command: string; sessionId: string; cwd?: string },
  ): Promise<MariDbCommandResult> {
    const sub = args[0];
    const rest = args.slice(1);
    const parsed = parseArgs(rest);
    if (!sub || sub === "help" || sub === "--help" || sub === "-h" || hasFlag(parsed.flags, "help")) {
      return { ok: true, mode: "read", command: context.command, output: this.helpText() };
    }
    switch (sub) {
      case "status":
        return {
          ok: true,
          mode: "read",
          command: context.command,
          output: { status: "ok", dataDir: getFileStorageDir(), tables: FILE_BACKED_TABLES.length },
        };
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
        return {
          ok: result.status === "passed",
          mode: "read",
          command: context.command,
          validation: result,
          output: result,
        };
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

  private async listRows(
    table: string | undefined,
    command: string,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
    if (!table) throw new Error("Usage: mari db list <table>");
    const rows = (await this.rawRows(table)).map((row) => (hasFlag(flags, "parsed") ? parseRow(table, row) : row));
    const limit = normalizeLimit(flagString(flags, "limit"), 50, 1000);
    const offset = normalizeLimit(flagString(flags, "offset"), 0, Number.MAX_SAFE_INTEGER);
    return { ok: true, mode: "read", command, output: rows.slice(offset, offset + limit) };
  }

  private async getRow(
    table: string | undefined,
    id: string | undefined,
    command: string,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
    if (!table || !id) throw new Error("Usage: mari db get <table> <id>");
    const meta = getMeta(table);
    const row = await this.getRawById(meta, id);
    return {
      ok: Boolean(row),
      mode: "read",
      command,
      output: row && hasFlag(flags, "parsed") ? parseRow(table, row) : row,
    };
  }

  private async selectRows(
    table: string | undefined,
    command: string,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
    if (!table) throw new Error("Usage: mari db select <table> --where <expr>");
    const predicate = createMariWherePredicate(flagString(flags, "where"));
    const rows = (await this.rawRows(table)).map((row) => parseRow(table, row)).filter(predicate);
    const limit = normalizeLimit(flagString(flags, "limit"), 100, 5000);
    return { ok: true, mode: "read", command, output: rows.slice(0, limit) };
  }

  private async searchRows(
    tableArg: string | undefined,
    query: string | undefined,
    command: string,
    flags: Map<string, string | boolean>,
  ): Promise<MariDbCommandResult> {
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

  private async parseMutation(
    kind: ParsedMutationRequest["kind"],
    positionals: string[],
    flags: Map<string, string | boolean>,
    cwd?: string,
  ): Promise<ParsedMutationRequest> {
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
      if (!table || !id)
        throw new Error(
          "Usage: mari db patch <table> <id> (--json '<partial-row-json>' | --json-file <path>) [--apply]",
        );
      return { kind, table, id, patch: await parseJsonInput(flags, cwd), apply, cascade, reason, cwd };
    }
    if (kind === "replace") {
      const [table, id] = positionals;
      if (!table || !id)
        throw new Error(
          "Usage: mari db replace <table> <id> (--json '<full-row-json>' | --json-file <path>) [--apply]",
        );
      return { kind, table, id, row: await parseJsonInput(flags, cwd), apply, cascade, reason, cwd };
    }
    if (kind === "delete") {
      const table = positionals[0];
      if (!table) throw new Error("Usage: mari db delete <table> <id>|--where <expr> [--cascade] [--apply]");
      const id = positionals[1];
      const where = flagString(flags, "where");
      if (!id && !where) throw new Error("Delete requires an id or an explicit --where expression");
      return { kind, table, id, where, apply, cascade, reason, cwd };
    }
    const [table, scriptPath] = positionals;
    if (!table || !scriptPath)
      throw new Error("Usage: mari db transform <table|all> <script.mjs> [--dry-run] [--apply]");
    return { kind, table, scriptPath, apply, cascade: true, reason, cwd };
  }

  private async captureDeletedLorebookEmbeddings(changes: PlanChange[]): Promise<void> {
    for (const change of changes) {
      if (!change.apply || change.table !== "lorebooks" || change.action !== "delete") continue;
      change.embeddedCharacterId = (await resolveEmbeddedCharacterId(this.db, change.id)) ?? undefined;
    }
  }

  // #4927/#4932: keep an embedded character's data.character_book in sync after Mari mutates a lorebook
  // through the generic mutation path — which, unlike the HTTP routes, never called the sync, so
  // add/update/delete of an embedded lorebook's entries left the derived copy stale. Safe for
  // standalone lorebooks: syncCharacterBookFromLorebook no-ops when the lorebook isn't embedded, and
  // swallows its own errors, so a sync failure never breaks the mutation.
  private async syncAffectedCharacterBooks(changes: PlanChange[]): Promise<void> {
    const lorebookIds = new Set<string>();
    const collect = (value: unknown) => {
      if (typeof value === "string" && value) lorebookIds.add(value);
    };
    for (const change of changes) {
      if (!change.apply) continue;
      if (change.table === "lorebook_entries") {
        // Collect BOTH sides: an entry reparented between lorebooks (a raw patch of its
        // lorebookId) leaves its former lorebook stale too, not just the destination.
        collect(change.before?.lorebookId);
        collect(change.after?.lorebookId);
      } else if (change.table === "lorebooks" && change.id) {
        if (change.action === "delete") {
          if (!change.embeddedCharacterId) continue;
          const restored = await this.getRawById(getMeta("lorebooks"), change.id);
          if (restored) {
            try {
              await embedLorebookIntoCharacter(this.db, change.embeddedCharacterId, change.id);
            } catch (err) {
              logger.error(err, "[mari-db] failed to restore embedded lorebook %s", change.id);
            }
          } else {
            await clearCharacterEmbeddedLorebook(this.db, change.embeddedCharacterId, change.id);
          }
        } else {
          collect(change.id);
        }
      }
    }
    for (const lorebookId of lorebookIds) {
      await syncCharacterBookFromLorebook(this.db, lorebookId);
    }
  }

  private async executeMutation(
    request: ParsedMutationRequest,
    command: string,
    sessionId: string,
  ): Promise<MariDbCommandResult> {
    const planTimestamp = now();
    const storedCommand = commandForStorage(request, command);
    const plan = await this.planMutation(request, storedCommand, planTimestamp);
    if (plan.validation.status === "blocked") {
      await this.recordHistory({ plan, command: storedCommand, sessionId, status: "blocked", journalPath: null });
      return {
        ok: false,
        mode: request.apply ? "apply" : "dry-run",
        command,
        summary: plan.summary,
        validation: plan.validation,
        error: "Blocking validation failed",
      };
    }

    if (!request.apply) {
      await this.recordHistory({ plan, command: storedCommand, sessionId, status: "dry-run", journalPath: null });
      return {
        ok: true,
        mode: "dry-run",
        command,
        summary: plan.summary,
        validation: plan.validation,
        approval: { status: "not_required", operationHash: plan.operationHash },
      };
    }

    try {
      await this.captureDeletedLorebookEmbeddings(plan.changes);
      const journalPath = await this.applyPlan(plan);
      await this.syncAffectedCharacterBooks(plan.changes);
      const history = await this.recordHistory({
        plan,
        command: storedCommand,
        sessionId,
        status: "approved",
        journalPath,
      });
      const review = await this.createAppliedReview(plan, storedCommand, sessionId, journalPath, history.id);
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
      await this.recordHistory({ plan, command: storedCommand, sessionId, status: "failed", journalPath: null });
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

  private async planMutation(
    request: ParsedMutationRequest,
    command: string,
    timestamp: string = now(),
  ): Promise<Plan> {
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
    else if (request.kind === "character-move-folder") changes = await this.planCharacterMoveFolder(request, timestamp);
    else if (request.kind === "preset-section-delete") changes = await this.planPresetSectionDelete(request, timestamp);
    else if (request.kind === "preset-group-delete") changes = await this.planPresetGroupDelete(request, timestamp);
    else changes = await this.planTransform(request, timestamp, allocateId);

    // systemKey identifies Engine-owned presets. Apply this after every planner so raw writes and
    // transforms cannot bypass the structured preset-action boundary.
    protectPromptPresetSystemKeys(changes);

    const personalExtensionChanges = changes.filter((change) => change.table === "installed_extensions");
    if (personalExtensionChanges.length > 0 && !request.personalExtensionDraftMutation) {
      issues.push({
        level: "error",
        table: "installed_extensions",
        message:
          "Professor Mari cannot mutate Personal Extensions through raw DB actions. Use personal_extension.create or personal_extension.update; only the user can approve execution in Settings > Addons.",
      });
    }
    if (request.personalExtensionDraftMutation) {
      for (const change of personalExtensionChanges) {
        const enabledEscalated = change.afterRaw?.enabled === "true" && change.beforeRaw?.enabled !== "true";
        const approvalEscalated =
          typeof change.afterRaw?.approvedHash === "string" &&
          change.afterRaw.approvedHash.length > 0 &&
          change.afterRaw.approvedHash !== change.beforeRaw?.approvedHash;
        if (enabledEscalated || approvalEscalated) {
          issues.push({
            level: "error",
            table: "installed_extensions",
            id: change.id,
            message: "Professor Mari can save Personal Extension drafts but cannot approve or enable them.",
          });
        }
      }
    }

    // Raw Mari DB commands are model-driven and apply before the user sees the
    // Keep/Restore review. Keep executable tool authoring available, but never
    // let that path arm a webhook/script or grant it hidden chat context. The
    // user can inspect and enable the saved draft in the privileged Tools UI.
    const encryptedWebhooks = new Map<string, string>();
    for (const change of changes.filter((candidate) => candidate.table === "custom_tools")) {
      const before = change.beforeRaw;
      const beforeWebhookUrl = before?.webhookUrl;
      if (typeof beforeWebhookUrl === "string") {
        before!.webhookUrl = encryptCustomToolWebhookUrl(beforeWebhookUrl);
        change.before = parseRow("custom_tools", before!);
      }

      const after = change.afterRaw;
      if (!after) continue;
      if (
        typeof after.webhookUrl === "string" &&
        after.webhookUrl &&
        !after.webhookUrl.startsWith(ENCRYPTED_WEBHOOK_PREFIX)
      ) {
        try {
          new URL(after.webhookUrl);
        } catch {
          issues.push({
            level: "error",
            table: "custom_tools",
            id: change.id,
            message: "Tool webhookUrl must be a valid URL",
          });
        }
      }
      const executable = after.executionType === "webhook" || after.executionType === "script";
      const executableDefinitionChanged =
        !before ||
        before.executionType !== after.executionType ||
        beforeWebhookUrl !== after.webhookUrl ||
        before.scriptBody !== after.scriptBody;
      const privilegeEscalated =
        (after.enabled === "true" && before?.enabled !== "true") ||
        (after.includeHiddenContext === "true" && before?.includeHiddenContext !== "true");
      if (executable && (executableDefinitionChanged || privilegeEscalated)) {
        after.enabled = "false";
        after.includeHiddenContext = "false";
        change.after = parseRow("custom_tools", after);
        issues.push({
          level: "notice",
          table: "custom_tools",
          id: change.id,
          message:
            "Executable tool changes are saved disabled without hidden context; review and enable them in Tools.",
        });
      }
      if (typeof after.webhookUrl === "string") {
        const originalWebhookUrl = after.webhookUrl;
        const encryptedWebhookUrl =
          encryptedWebhooks.get(originalWebhookUrl) ?? encryptCustomToolWebhookUrl(originalWebhookUrl);
        after.webhookUrl = encryptedWebhookUrl;
        if (encryptedWebhookUrl) encryptedWebhooks.set(originalWebhookUrl, encryptedWebhookUrl);
        change.after = parseRow("custom_tools", after);
      }
    }
    secureCustomToolRequestForStorage(request, encryptedWebhooks);

    // Memories (mari_instructions) are a normal file-backed table, so the generic raw path would
    // otherwise reach them and skip the length caps + enabled=0 forcing that only the instruction.*
    // builders enforce. Deny raw writes so every memory mutation goes through instruction.remember /
    // instruction.update / instruction.forget. Filters on change.table (not request.table) so a
    // transform-all that emits a mari_instructions change is caught too. Mirrors installed_extensions.
    const instructionChanges = changes.filter((change) => change.table === "mari_instructions");
    if (instructionChanges.length > 0 && !request.instructionMutation) {
      issues.push({
        level: "error",
        table: "mari_instructions",
        message:
          "Professor Mari cannot mutate memories through raw DB actions. Use instruction.remember, instruction.update, or instruction.forget so length limits and flag rules apply.",
      });
    }

    const touchedTables = [...new Set(changes.map((change) => change.table))];
    const validation = await this.validateTouchedRows(changes, touchedTables, issues);
    const summary = summaryForChanges(changes);
    const operationHash = hash({
      command,
      request,
      changes: changes.map((change) => ({
        table: change.table,
        id: change.id,
        action: change.action,
        beforeRaw: change.beforeRaw ?? null,
        afterRaw: change.afterRaw ?? null,
      })),
    });
    return { changes, validation, summary, operationHash, reason: request.reason, request };
  }

  private async planInsert(
    request: ParsedMutationRequest,
    timestamp: string,
    allocateId: () => string,
  ): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const pk = getPrimary(meta);
    const parsed = { ...(request.row ?? {}) };
    if (parsed[pk] == null || parsed[pk] === "") parsed[pk] = allocateId();
    // #4813: a create must insert a NEW row. If a row with this id already exists, refuse
    // rather than overwrite it — an insert records beforeRaw:null, so a later Restore would
    // delete the pre-existing row too (unrecoverable). Callers changing an existing row use update.
    const insertPk = String(parsed[pk]);
    if (await this.getRawById(meta, insertPk)) {
      throw new Error(
        `A ${meta.name} row with id "${insertPk}" already exists; a create cannot overwrite it. Use an update instead.`,
      );
    }
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
    // Seed the collision set with the primary row's id so a related insert cannot re-claim it.
    changes.push(
      ...(await this.planRelatedInserts(
        request.relatedInserts,
        timestamp,
        allocateId,
        new Set([`${meta.name}:${insertPk}`]),
      )),
    );
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
    changes.push(...(await this.planRelatedInserts(request.relatedInserts, timestamp, () => newId())));
    return changes;
  }

  private async planRelatedInserts(
    relatedInserts: ParsedMutationRequest["relatedInserts"],
    timestamp: string,
    allocateId: () => string,
    seenIds: Set<string> = new Set(),
  ): Promise<PlanChange[]> {
    if (!relatedInserts?.length) return [];
    const changes: PlanChange[] = [];
    for (const insert of relatedInserts) {
      const meta = getMeta(insert.table);
      const pk = getPrimary(meta);
      const parsed = { ...insert.row };
      if (parsed[pk] == null || parsed[pk] === "") parsed[pk] = allocateId();
      // #4813: a related insert (a preset's sections / choice-blocks, whose ids can survive from a
      // caller payload) must also insert a NEW row. Guard it the same way planInsert guards its
      // primary row, so the whole insert surface is symmetric and a colliding id fails early with a
      // clear message instead of a late unique-constraint abort on a deceptively clean dry-run.
      const insertPk = String(parsed[pk]);
      if (await this.getRawById(meta, insertPk)) {
        throw new Error(
          `A ${meta.name} row with id "${insertPk}" already exists; a create cannot overwrite it. Use an update instead.`,
        );
      }
      // The committed-row lookup above never sees ids that only exist inside THIS plan. A duplicate
      // child id in one payload (or a child re-using the primary row's id) would otherwise pass a
      // clean dry-run and abort late at apply, so reject it here too.
      const seenKey = `${meta.name}:${insertPk}`;
      if (seenIds.has(seenKey)) {
        throw new Error(
          `A ${meta.name} row with id "${insertPk}" is used more than once in this create; each row needs a unique id.`,
        );
      }
      seenIds.add(seenKey);
      this.fillTimestamps(meta, parsed, true, timestamp);
      const afterRaw = serializeRow(meta.name, parsed);
      changes.push({
        table: meta.name,
        id: String(afterRaw[pk]),
        action: "insert",
        before: null,
        after: parseRow(meta.name, afterRaw),
        beforeRaw: null,
        afterRaw,
        apply: true,
      });
    }
    return changes;
  }

  private async planReplace(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    const existing = await this.requireRawById(meta, String(request.id));
    const next = normalizeWriteRow(meta.name, { ...(request.row ?? {}) });
    next[getPrimary(meta)] = existing[getPrimary(meta)];
    if (meta.byKey.has("createdAt") && !next.createdAt) next.createdAt = existing.createdAt;
    this.fillTimestamps(meta, next, false, timestamp);
    const afterRaw = serializeRow(meta.name, next);
    return [
      {
        table: meta.name,
        id: rowId(meta, existing),
        action: "replace",
        before: parseRow(meta.name, existing),
        after: parseRow(meta.name, afterRaw),
        beforeRaw: existing,
        afterRaw,
        apply: true,
      },
    ];
  }

  private async planCharacterMoveFolder(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const characterId = String(request.characterId ?? "");
    const targetFolderId = String(request.folderId ?? "");
    const meta = getMeta("character_groups");
    const groups = await this.rawRows(meta.name);
    if (!groups.some((group) => group.id === targetFolderId)) {
      throw new Error(`Character folder ${targetFolderId} not found`);
    }

    return groups
      .map((group): PlanChange | null => {
        const parsed = parseRow(meta.name, group);
        if (!Array.isArray(parsed.characterIds)) {
          throw new Error(`Character folder ${String(group.id)} has invalid membership data`);
        }
        const currentIds = parsed.characterIds.filter((id): id is string => typeof id === "string" && !!id);
        const matchingIdCount = currentIds.filter((id) => id === characterId).length;
        const withoutCharacter = currentIds.filter((id) => id !== characterId);
        const nextIds =
          group.id === targetFolderId
            ? matchingIdCount === 1
              ? currentIds
              : [...withoutCharacter, characterId]
            : withoutCharacter;
        if (nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])) {
          return null;
        }
        const afterRaw = serializeRow(meta.name, {
          ...parsed,
          characterIds: nextIds,
          updatedAt: timestamp,
        });
        return {
          table: meta.name,
          id: rowId(meta, group),
          action: "update",
          before: parsed,
          after: parseRow(meta.name, afterRaw),
          beforeRaw: group,
          afterRaw,
          apply: true,
        };
      })
      .filter((change): change is PlanChange => change !== null);
  }

  // #4812: deleting a section must also prune its id from the parent's sectionOrder (a dangling id
  // there is harmless but untidy), all in one reversible plan.
  private async planPresetSectionDelete(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const sectionMeta = getMeta("prompt_sections");
    const sectionId = String(request.id ?? "");
    const section = await this.getRawById(sectionMeta, sectionId);
    if (!section) throw new Error(`Prompt section ${sectionId} not found`);
    const changes: PlanChange[] = [];
    const presetMeta = getMeta("prompt_presets");
    const preset = await this.getRawById(presetMeta, String(section.presetId));
    if (preset) {
      const parsed = parseRow(presetMeta.name, preset);
      const currentOrder = parseJsonArrayValue(parsed.sectionOrder).map(String);
      const nextOrder = currentOrder.filter((id) => id !== sectionId);
      if (nextOrder.length !== currentOrder.length) {
        const afterRaw = serializeRow(presetMeta.name, { ...parsed, sectionOrder: nextOrder, updatedAt: timestamp });
        changes.push({
          table: presetMeta.name,
          id: rowId(presetMeta, preset),
          action: "update",
          before: parsed,
          after: parseRow(presetMeta.name, afterRaw),
          beforeRaw: preset,
          afterRaw,
          apply: true,
        });
      }
    }
    changes.push({
      table: sectionMeta.name,
      id: rowId(sectionMeta, section),
      action: "delete",
      before: parseRow(sectionMeta.name, section),
      after: null,
      beforeRaw: section,
      afterRaw: null,
      apply: true,
    });
    return changes;
  }

  // #4812: deleting a group matches prompts.storage.removeGroup — prune it from groupOrder, ORPHAN
  // its member sections (groupId -> null), un-nest its child groups (parentGroupId -> null), then
  // delete the group. All in one reversible plan so nothing is left half-detached.
  private async planPresetGroupDelete(request: ParsedMutationRequest, timestamp: string): Promise<PlanChange[]> {
    const groupMeta = getMeta("prompt_groups");
    const groupId = String(request.id ?? "");
    const group = await this.getRawById(groupMeta, groupId);
    if (!group) throw new Error(`Prompt group ${groupId} not found`);
    const presetId = String(group.presetId);
    const changes: PlanChange[] = [];

    const presetMeta = getMeta("prompt_presets");
    const preset = await this.getRawById(presetMeta, presetId);
    if (preset) {
      const parsed = parseRow(presetMeta.name, preset);
      const currentOrder = parseJsonArrayValue(parsed.groupOrder).map(String);
      const nextOrder = currentOrder.filter((id) => id !== groupId);
      if (nextOrder.length !== currentOrder.length) {
        const afterRaw = serializeRow(presetMeta.name, { ...parsed, groupOrder: nextOrder, updatedAt: timestamp });
        changes.push({
          table: presetMeta.name,
          id: rowId(presetMeta, preset),
          action: "update",
          before: parsed,
          after: parseRow(presetMeta.name, afterRaw),
          beforeRaw: preset,
          afterRaw,
          apply: true,
        });
      }
    }

    const sectionMeta = getMeta("prompt_sections");
    for (const section of (await this.rawRows(sectionMeta.name)).filter(
      (row) => row.presetId === presetId && row.groupId === groupId,
    )) {
      const parsed = parseRow(sectionMeta.name, section);
      const afterRaw = serializeRow(sectionMeta.name, { ...parsed, groupId: null });
      changes.push({
        table: sectionMeta.name,
        id: rowId(sectionMeta, section),
        action: "update",
        before: parsed,
        after: parseRow(sectionMeta.name, afterRaw),
        beforeRaw: section,
        afterRaw,
        apply: true,
      });
    }

    for (const child of (await this.rawRows(groupMeta.name)).filter(
      (row) => row.presetId === presetId && row.parentGroupId === groupId,
    )) {
      const parsed = parseRow(groupMeta.name, child);
      const afterRaw = serializeRow(groupMeta.name, { ...parsed, parentGroupId: null });
      changes.push({
        table: groupMeta.name,
        id: rowId(groupMeta, child),
        action: "update",
        before: parsed,
        after: parseRow(groupMeta.name, afterRaw),
        beforeRaw: child,
        afterRaw,
        apply: true,
      });
    }

    changes.push({
      table: groupMeta.name,
      id: rowId(groupMeta, group),
      action: "delete",
      before: parseRow(groupMeta.name, group),
      after: null,
      beforeRaw: group,
      afterRaw: null,
      apply: true,
    });
    return changes;
  }

  private withCharacterFolderMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.characterFolderMutationQueue.then(operation);
    this.characterFolderMutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  // Serialize an operation against all others touching the SAME review id (see reviewLocks). The
  // stored tail never rejects, so a failed operation cannot wedge the id's queue; the next waiter
  // still runs. The tail self-evicts from the map once it is the last holder, so ids do not
  // accumulate. Distinct ids never block each other. Callers must NOT nest this on the same id
  // (keepAppliedReviewAndWait deliberately does its read-only snapshot outside the lock, then
  // delegates the mutation to keepAppliedReview, which takes the lock once).
  private withReviewLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const prev = this.reviewLocks.get(id) ?? Promise.resolve();
    const run = prev.then(operation);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.reviewLocks.set(id, tail);
    void tail.then(() => {
      if (this.reviewLocks.get(id) === tail) this.reviewLocks.delete(id);
    });
    return run;
  }

  private async planDelete(request: ParsedMutationRequest, issues: MariDbValidationIssue[]): Promise<PlanChange[]> {
    const meta = getMeta(String(request.table));
    if (!request.id && !request.where?.trim()) {
      throw new Error("Delete requires an id or an explicit --where expression");
    }
    const rows = await this.rawRows(meta.name);
    const predicate = request.id
      ? (row: Row) => String(row[getPrimary(meta)]) === request.id
      : createMariWherePredicate(request.where);
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
      issues.push({
        level: "error",
        table: meta.name,
        message: `Delete would cascade to ${cascaded.length} child row(s). Re-run with --cascade to confirm.`,
      });
    }
    return this.dedupeDeletes(changes);
  }

  private async planTransform(
    request: ParsedMutationRequest,
    timestamp: string,
    allocateId: () => string,
  ): Promise<PlanChange[]> {
    const cwd = request.cwd ? resolve(request.cwd) : process.cwd();
    const scriptPath = resolve(cwd, String(request.scriptPath));
    const tables = request.table === "all" ? [...FILE_BACKED_TABLES] : [String(request.table)];
    const allParsed = new Map<string, Row[]>();
    const allRaw = new Map<string, Row[]>();
    for (const table of tables) {
      getMeta(table);
      const rawRows = await this.rawRows(table);
      allRaw.set(table, rawRows);
      allParsed.set(
        table,
        rawRows.map((row) => parseRow(table, row)),
      );
    }
    const sandboxResults = await runMariTransformSandbox({
      workspaceRoot: cwd,
      scriptPath,
      timestamp,
      tables: tables.map((table) => ({
        name: table,
        rows: allRaw.get(table) ?? [],
        jsonColumns: [...(JSON_COLUMNS[table] ?? [])],
      })),
    });
    const resultsByTable = new Map(sandboxResults.map((result) => [result.table, result.results]));
    const changes: PlanChange[] = [];
    for (const table of tables) {
      const meta = getMeta(table);
      const rawRows = allRaw.get(table) ?? [];
      const parsedRows = allParsed.get(table) ?? [];
      for (let index = 0; index < parsedRows.length; index++) {
        const row = clone(parsedRows[index]!);
        const raw = rawRows[index]!;
        const tableResults = resultsByTable.get(table);
        if (!tableResults || tableResults.length !== parsedRows.length) {
          throw new Error(`Transform sandbox returned an incomplete result for ${table}`);
        }
        const sandboxResult = tableResults[index];
        if (!sandboxResult || typeof sandboxResult.defined !== "boolean") {
          throw new Error(`Transform sandbox returned an invalid result for ${table}`);
        }
        const result = sandboxResult.defined ? sandboxResult.value : undefined;
        if (result === null || result === false || result === undefined) continue;
        if (isRecord(result) && result.delete === true) {
          changes.push({
            table,
            id: rowId(meta, raw),
            action: "delete",
            before: row,
            after: null,
            beforeRaw: raw,
            afterRaw: null,
            apply: true,
          });
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
            changes.push({
              table,
              id: String(afterRaw[pk]),
              action: "insert",
              before: null,
              after: parseRow(table, afterRaw),
              beforeRaw: null,
              afterRaw,
              apply: true,
            });
          }
          continue;
        }
        const resultRow =
          isRecord(result) && Object.prototype.hasOwnProperty.call(result, "update")
            ? (deepMerge(row, result.update) as Row)
            : (result as Row);
        if (!isRecord(resultRow)) continue;
        const next = normalizeWriteRow(table, resultRow);
        next[getPrimary(meta)] = raw[getPrimary(meta)];
        this.fillTimestamps(meta, next, false, timestamp);
        const afterRaw = serializeRow(table, next);
        if (stableJson(afterRaw) !== stableJson(raw)) {
          changes.push({
            table,
            id: rowId(meta, raw),
            action: "update",
            before: row,
            after: parseRow(table, afterRaw),
            beforeRaw: raw,
            afterRaw,
            apply: true,
          });
        }
      }
    }
    await this.addCascadeDeletes(changes, true);
    return this.dedupeDeletes(changes);
  }

  private async planThemeCreate(
    request: ParsedMutationRequest,
    timestamp: string,
    issues: MariDbValidationIssue[],
  ): Promise<PlanChange[]> {
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
      issues.push({
        level: "notice",
        table: THEME_TABLE,
        id,
        message: "A theme with the same name and CSS already exists",
      });
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

  private async planThemeUpdate(
    request: ParsedMutationRequest,
    timestamp: string,
    issues: MariDbValidationIssue[],
  ): Promise<PlanChange[]> {
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

  private async planThemeSetActive(
    request: ParsedMutationRequest,
    timestamp: string,
    issues: MariDbValidationIssue[],
  ): Promise<PlanChange[]> {
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
        const afterRaw = serializeRow(THEME_TABLE, {
          ...parseRow(THEME_TABLE, row),
          isActive: nextActive,
          updatedAt: timestamp,
        });
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
    if (name.length > 200)
      issues.push({ level: "error", table: THEME_TABLE, id, message: "Theme name must be 200 characters or fewer" });
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

  private async validateTouchedRows(
    changes: PlanChange[],
    tables: string[],
    priorIssues: MariDbValidationIssue[],
  ): Promise<MariDbValidationResult> {
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
          issues.push({
            level: "error",
            table: change.table,
            id: change.id,
            message: `Missing required column ${column.key}`,
          });
        }
      }
      for (const key of JSON_COLUMNS[change.table] ?? []) {
        const value = row[key];
        if (value === null || value === undefined || value === "") continue;
        if (typeof value !== "string") continue;
        try {
          JSON.parse(value);
        } catch {
          issues.push({
            level: "error",
            table: change.table,
            id: change.id,
            message: `Column ${key} is not valid JSON`,
          });
        }
      }
      addCharacterDataShapeIssues(change.table, row, change.id, issues);
      if (change.table === "agent_configs") this.validateAgentConfigRow(row, change.id, issues);
      if (change.table === "custom_tools") this.validateCustomToolRow(row, change.id, issues);
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
          (entry) =>
            entry.table === cascade.parent && entry.action !== "delete" && entry.afterRaw?.[cascade.parentKey] === ref,
        );
        const parentDeleted = changes.some(
          (entry) =>
            entry.table === cascade.parent && entry.action === "delete" && entry.beforeRaw?.[cascade.parentKey] === ref,
        );
        const parentExists =
          !parentDeleted && (await parentRows(cascade.parent)).some((row) => row[cascade.parentKey] === ref);
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
    return validationFromIssues([
      ...issues,
      ...scopedExistingErrors,
      ...fullValidation.notices,
      ...fullValidation.infos,
    ]);
  }

  private async applyPlan(plan: Plan): Promise<string> {
    const operationId = newId();
    const journalPath = await this.writeJournal(operationId, plan);
    const homeWidgetChange = singleHomeWidgetCatalogChange(plan);
    if (homeWidgetChange) {
      const before = homeWidgetCatalogFromPlanRow(homeWidgetChange.beforeRaw);
      const after = homeWidgetCatalogFromPlanRow(homeWidgetChange.afterRaw);
      await replaceHomeWidgetCatalog(this.db, before.revision, after.widgets);
    } else {
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
    }
    const validation = await this.validate();
    if (validation.status === "blocked") {
      const touchedRows = new Set(plan.changes.map((change) => `${change.table}:${change.id}`));
      const touchedErrors = validation.errors.filter(
        (issue) => issue.table && issue.id != null && touchedRows.has(`${issue.table}:${String(issue.id)}`),
      );
      if (touchedErrors.length > 0) {
        throw new Error(`Post-apply validation failed: ${touchedErrors.map((issue) => issue.message).join("; ")}`);
      }
      logger.warn(
        "[mari-db] post-apply validation still reports unrelated errors: %s",
        validation.errors.map((issue) => issue.message).join("; "),
      );
    }
    await flushDB();
    return journalPath;
  }

  private async restorePlan(plan: Plan): Promise<void> {
    const homeWidgetChange = singleHomeWidgetCatalogChange(plan);
    if (homeWidgetChange) {
      const before = homeWidgetCatalogFromPlanRow(homeWidgetChange.beforeRaw);
      const after = homeWidgetCatalogFromPlanRow(homeWidgetChange.afterRaw);
      await replaceHomeWidgetCatalog(this.db, after.revision, before.widgets);
      await this.validateAndFlushRestored(plan.changes);
    } else {
      await this.restoreChanges(plan.changes);
    }
  }

  // Revert a subset of a plan's changes in one transaction, then validate + flush. Shared by whole-
  // plan restore (restorePlan) and per-row reject (rejectRows). The in-tx supersede check is the
  // audited #4852 / apply-asymmetry contract (see comments below) — the
  // callers must pass a dependency-closed subset; this helper does not compute cascade closure.
  private async restoreChanges(changes: PlanChange[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      // #4852 F2: abort the whole restore if any row it would revert was changed by a newer
      // write after this review applied. Read inside the tx, because restore is NOT serialized against
      // a concurrent Mari apply (serializeWorkspaceMutation wraps only Mari's own tool mutations,
      // not this direct-service path), so reading here is what closes the race. The throw rolls
      // the tx back before any write, and the caller catches it and leaves the newer data plus the
      // pending review intact. Cascade rows carry apply:false because the parent delete removed
      // them implicitly, but Restore writes those snapshots back and must protect them too.
      for (const change of changes) {
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        const rows = (await tx
          .select()
          .from(meta.table as any)
          .where(eq(meta.byKey.get(pk)!.column as any, change.id))) as Row[];
        const current = rows[0] ? { ...rows[0] } : null;
        if (restoreRowSuperseded(meta, current, change.afterRaw ?? null)) {
          throw new RestoreStateChangedError();
        }
      }

      const insertedRows = [...changes].reverse().filter((change) => change.action === "insert");
      for (const change of insertedRows) {
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        await tx.delete(meta.table as any).where(eq(meta.byKey.get(pk)!.column as any, change.id));
      }

      const updatedRows = changes.filter((change) => change.action === "update" || change.action === "replace");
      for (const change of updatedRows) {
        if (!change.beforeRaw) continue;
        const meta = getMeta(change.table);
        const pk = getPrimary(meta);
        await tx
          .update(meta.table as any)
          .set(knownColumnPatch(meta, change.beforeRaw))
          .where(eq(meta.byKey.get(pk)!.column as any, change.id));
      }

      const deletedRows = changes.filter((change) => change.action === "delete");
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

      // #4931: a restored lorebook entry needs a live parent lorebook. A concurrent lorebook deletion
      // can land between rejectRows' pre-check and this transaction (TOCTOU), so re-verify in-tx and
      // roll back rather than committing a dangling reference that only post-commit validate() would
      // catch (which would leave the bad row + surface a 500). This covers every non-insert entry
      // change — a delete re-inserts the row, and an update/replace revert can rewrite lorebookId (e.g.
      // reverting a reparent whose original lorebook is now gone). Whole-plan restores re-insert the
      // parent in the loops above, so this fires only when the parent is genuinely gone.
      for (const change of changes) {
        if (change.action === "insert" || change.table !== "lorebook_entries" || !change.beforeRaw) continue;
        const lorebookId = change.beforeRaw.lorebookId;
        if (typeof lorebookId !== "string") continue;
        const meta = getMeta("lorebooks");
        const pk = getPrimary(meta);
        const parent = (await tx
          .select()
          .from(meta.table as any)
          .where(eq(meta.byKey.get(pk)!.column as any, lorebookId))) as Row[];
        if (parent.length === 0) throw new RestoreStateChangedError();
      }
    });

    await this.validateAndFlushRestored(changes);
  }

  private async validateAndFlushRestored(changes: PlanChange[]): Promise<void> {
    const validation = await this.validate();
    if (validation.status === "blocked") {
      const touchedRows = new Set(changes.map((change) => `${change.table}:${change.id}`));
      const touchedErrors = validation.errors.filter(
        (issue) => issue.table && issue.id != null && touchedRows.has(`${issue.table}:${String(issue.id)}`),
      );
      if (touchedErrors.length > 0) {
        throw new Error(`Post-restore validation failed: ${touchedErrors.map((issue) => issue.message).join("; ")}`);
      }
      logger.warn(
        "[mari-db] post-restore validation still reports unrelated errors: %s",
        validation.errors.map((issue) => issue.message).join("; "),
      );
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

  private async createAppliedReview(
    plan: Plan,
    command: string,
    sessionId: string,
    journalPath: string | null,
    historyId: string | null,
  ): Promise<MariDbPendingApproval> {
    this.ensurePendingHydrated();
    const id = newId();
    const requestedAt = now();
    // #4813: the undo card is persisted (writePendingSidecar) and no longer self-evicts on a
    // timer, so it survives a restart. expiresAt is the retention deadline used when pruning.
    const expiresAt = new Date(Date.now() + PENDING_REVIEW_RETENTION_MS).toISOString();
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
    };
    this.pending.set(id, record);
    try {
      await this.writePendingSidecar(record);
    } catch {
      // There is no older sidecar to invalidate on initial creation. Retain the in-memory undo and
      // let the already-applied action succeed; writePendingSidecar has logged the durability loss.
    }
    await this.enforcePendingRetention();
    return this.pendingView(record);
  }

  private pendingView(record: PendingRecord): MariDbPendingApproval {
    const { plan: _plan, historyId: _historyId, journalPath: _journalPath, ...view } = record;
    return view;
  }

  private pendingDir() {
    return join(this.journalDir(), "pending");
  }

  private pendingSidecarPath(id: string) {
    // Defense-in-depth against path traversal: every caller already passes a server-generated
    // newId() (a 21-char nanoid) or a route id that first matched a pending record, so a traversal
    // value can't reach here — but never build a filesystem path from an id that isn't a safe token.
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid pending review id: ${id}`);
    }
    return join(this.pendingDir(), `${id}.json`);
  }

  private async writePendingSidecar(record: PendingRecord): Promise<void> {
    const finalPath = this.pendingSidecarPath(record.id);
    // Write to a temp file then atomically rename into place, so a crash mid-write can't leave a
    // partial .json that hydration would discard (losing the undo while the change stays applied).
    // The .tmp suffix keeps an interrupted write out of the .json hydration set.
    const tempPath = `${finalPath}.${process.pid}.tmp`;
    try {
      await mkdir(this.pendingDir(), { recursive: true });
      await writeFile(tempPath, JSON.stringify(record), "utf8");
      renameSync(tempPath, finalPath);
    } catch (err) {
      this.safeRm(tempPath);
      logger.warn(err, "[mari-db] failed to persist pending review %s", record.id);
      throw err;
    }
  }

  // rmSync({ force: true }) only swallows ENOENT; on Windows a locked or AV-held file still
  // throws EPERM/EBUSY/EISDIR. Sidecar cleanup is always best-effort, so never let it propagate.
  private safeRm(path: string): void {
    try {
      rmSync(path, { force: true });
    } catch (err) {
      logger.warn(err, "[mari-db] failed to remove pending review file %s", path);
    }
  }

  private retirePendingSidecar(id: string): string | null {
    const finalPath = this.pendingSidecarPath(id);
    if (!existsSync(finalPath)) return null;
    const retiredPath = `${finalPath}.${process.pid}.${newId()}.done`;
    try {
      renameSync(finalPath, retiredPath);
      return retiredPath;
    } catch (err) {
      logger.warn(err, "[mari-db] failed to retire pending review %s", id);
      throw err;
    }
  }

  private async reactivatePendingSidecar(record: PendingRecord, retiredPath: string | null): Promise<void> {
    if (!retiredPath) return;
    try {
      renameSync(retiredPath, this.pendingSidecarPath(record.id));
    } catch (renameErr) {
      logger.warn(renameErr, "[mari-db] failed to reactivate pending review %s by rename", record.id);
      try {
        await this.writePendingSidecar(record);
        this.safeRm(retiredPath);
      } catch (writeErr) {
        throw new Error("The review operation failed and its durable undo could not be restored.", {
          cause: writeErr,
        });
      }
    }
  }

  private discardRetiredPendingSidecar(retiredPath: string | null): void {
    if (retiredPath) this.safeRm(retiredPath);
  }

  private async deletePendingSidecar(id: string): Promise<void> {
    const retiredPath = this.retirePendingSidecar(id);
    this.discardRetiredPendingSidecar(retiredPath);
  }

  // Load persisted pending reviews on first access so a Keep/Restore card survives a restart.
  // Prune anything past its retention deadline and keep only the newest PENDING_REVIEW_LIMIT.
  // This runs synchronously on the getPendingApprovals hot path, so it must NEVER throw: one
  // unreadable or undeletable file must not 500 the approvals endpoint or wipe the loaded set.
  private ensurePendingHydrated(): void {
    if (this.pendingHydrated) return;
    this.pendingHydrated = true;
    try {
      const dir = this.pendingDir();
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir);
      const nowMs = Date.now();
      const loaded: PendingRecord[] = [];
      const stale: string[] = [];
      // Sweep leftover temp/retired files from an interrupted write or delete; they are never
      // rehydrated (only *.json is) but shouldn't accumulate.
      for (const file of entries) {
        if (file.endsWith(".tmp") || file.endsWith(".done")) this.safeRm(join(dir, file));
      }
      for (const file of entries) {
        if (!file.endsWith(".json")) continue;
        const path = join(dir, file);
        try {
          const record = JSON.parse(readFileSync(path, "utf8")) as PendingRecord;
          const expiresMs = Date.parse(record?.expiresAt ?? "");
          const requestedMs = Date.parse(record?.requestedAt ?? "");
          // Reject anything that isn't a well-formed, filename-bound, unexpired review with a usable
          // plan — prune its sidecar rather than hydrate a record that would break a later action or,
          // via a forged id, escape journal/pending. record.id MUST match the file it lives in, and
          // both timestamps must parse (an unparseable requestedAt would also poison the sort).
          if (
            !record?.id ||
            record.id !== basename(file, ".json") ||
            !Array.isArray(record?.plan?.changes) ||
            !Number.isFinite(expiresMs) ||
            !Number.isFinite(requestedMs) ||
            expiresMs <= nowMs
          ) {
            stale.push(path);
            continue;
          }
          if (!this.pending.has(record.id)) loaded.push(record);
        } catch (err) {
          logger.warn(err, "[mari-db] discarding unreadable pending review %s", file);
          stale.push(path);
        }
      }
      // Oldest first so the in-memory Map stays insertion-ordered oldest->newest. Hydrate every
      // valid review first, then retire overflow sidecars before dropping their memory entries.
      loaded.sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
      const dropCount = Math.max(0, loaded.length - PENDING_REVIEW_LIMIT);
      loaded.forEach((record) => this.pending.set(record.id, record));
      for (const path of stale) this.safeRm(path);
      let dropped = 0;
      for (const record of loaded.slice(0, dropCount)) {
        try {
          const retiredPath = this.retirePendingSidecar(record.id);
          this.pending.delete(record.id);
          this.discardRetiredPendingSidecar(retiredPath);
          dropped += 1;
        } catch {
          // Keep the matching in-memory record when the sidecar could not be retired safely.
        }
      }
      if (dropped > 0) {
        logger.info(
          "[mari-db] dropped %d persisted pending review(s) over the %d cap on load",
          dropped,
          PENDING_REVIEW_LIMIT,
        );
      }
    } catch (err) {
      logger.warn(err, "[mari-db] failed to hydrate persisted pending reviews");
    }
  }

  // After adding a review, keep the in-memory set and its sidecars within the retention cap.
  // The oldest reviews past the cap lose their undo (their change stays applied).
  private async enforcePendingRetention(): Promise<void> {
    if (this.pending.size <= PENDING_REVIEW_LIMIT) return;
    // this.pending is insertion-ordered (oldest first after hydration + appends), so the leading
    // entries are the oldest reviews; evicting them never touches the review that was just added.
    const evictable = Array.from(this.pending.values()).slice(0, this.pending.size - PENDING_REVIEW_LIMIT);
    for (const record of evictable) {
      // Serialize eviction against a concurrent keep/restore/reject on the SAME id (the withReviewLock
      // contract). Otherwise a partial rejectRows whose trailing writePendingSidecar is mid-flight
      // (mkdir/writeFile await before the atomic rename) could recreate the sidecar this eviction just
      // retired, resurrecting a phantom review on the next restart. Re-check membership inside the lock
      // in case that concurrent op already resolved the review.
      try {
        await this.withReviewLock(record.id, async () => {
          if (!this.pending.has(record.id)) return;
          await this.deletePendingSidecar(record.id);
          this.pending.delete(record.id);
          logger.info(
            "[mari-db] dropped oldest pending review %s to stay within the %d-review cap; its change stays applied",
            record.id,
            PENDING_REVIEW_LIMIT,
          );
        });
      } catch (err) {
        // The data mutation and its new in-memory undo already succeeded. A locked old sidecar may
        // temporarily leave us over the cap, but must not turn that applied mutation into a reported
        // failure or discard a still-hydratable review.
        logger.warn(err, "[mari-db] could not evict pending review %s; retaining it temporarily", record.id);
      }
    }
  }

  private async recordHistory(args: {
    plan: Plan;
    command: string;
    sessionId: string;
    status: MariDbHistoryEntry["status"];
    journalPath: string | null;
  }) {
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
    const rows = (await this.db
      .select()
      .from(meta.table as any)
      .where(eq(meta.byKey.get(pk)!.column as any, id))) as Row[];
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
      "Creative data:       mari presets list|get|sections <preset-id>|get-section <id>|groups|get-group|choice-blocks|get-choice-block|add-section|update-section|delete-section|add-group|update-group|delete-group|add-choice-block|update-choice-block|delete-choice-block|create|update",
      "Chats (read-only):   mari chats list|get|messages|search",
      "Fandom/Wikipedia:    mari wiki find-wikis|search-all|search|get-page|sections|category|site-info",
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
      "Write: add-entry <lorebook-id> --name <name> [--content <text>] [--keys <k1,k2,...>] [--secondary-keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--selective] [--selective-logic <and|and_all|or|not|not_all>] [--match-whole-words] [--case-sensitive] [--use-regex] [--outlet-name <name>] [--folder-id <folder-id>] [--apply] [--reason <text>]",
      "Write: update-entry <entry-id> [--name <name>] [--content <text>] [--keys <k1,k2,...>] [--secondary-keys <k1,k2,...>] [--description <text>] [--tag <tag>] [--outlet-name <name>] [--enable] [--disable] [--constant] [--no-constant] [--selective] [--no-selective] [--selective-logic <and|and_all|or|not|not_all>] [--match-whole-words] [--no-match-whole-words] [--case-sensitive] [--no-case-sensitive] [--use-regex] [--no-use-regex] [--order <n>] [--folder-id <folder-id>|none] [--apply] [--reason <text>]",
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
      "Read:  messages <chat-id> [--last <n> | --after-post <n>] [--limit <n>] [--offset <n>] [--tail]",
      "       --last counts back from the newest post; --after-post uses the 1-indexed #post shown in chat.",
      "       Add --limit and advance --offset to page within either requested range.",
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
      '  mari code reload request --kind server --reason "Server route changed" --resume',
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
      "Where: row.field and row['field'] with comparisons, &&, ||, !, parentheses, and safe string/array methods (includes, startsWith, endsWith, case conversion, trim); arbitrary code and calls are rejected",
      "Write: insert|patch|replace|delete|transform ... (dry-run by default; --apply saves reversible changes and shows a Keep/Restore review card)",
      "Transform scripts use an OS sandbox where supported; on other systems, reviewed local scripts remain available only with MARI_DB_ALLOW_UNSAFE_TRANSFORMS=true.",
      `Known tables: ${FILE_BACKED_TABLES.slice(0, 8).join(", ")} ... (${FILE_BACKED_TABLES.length})`,
      `Journal directory: ${this.journalDir()} (${basename(getFileStorageDir())})`,
    ].join("\n");
  }
}

let singleton: MariDbService | null = null;
let singletonDb: DB | null = null;
export function getMariDbService(db: DB) {
  if (!singleton || singletonDb !== db) {
    singleton = new MariDbService(db);
    singletonDb = db;
  }
  return singleton;
}
