// ──────────────────────────────────────────────
// Routes: Backup
// ──────────────────────────────────────────────
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { extname, join, relative } from "path";
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync } from "fs";
import type { Dirent, WriteStream } from "fs";
import { chmod, cp, mkdir, copyFile, readFile, readdir, writeFile, stat, mkdtemp, rm, open, rename } from "fs/promises";
import type { FileHandle } from "fs/promises";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";
import { StringDecoder } from "string_decoder";
import { createHash, randomBytes, randomUUID } from "crypto";
import { inflateRawSync } from "zlib";
import AdmZip from "adm-zip";
import { FILE_BACKED_TABLES } from "../db/file-backed-store.js";
import { migrateLegacyNoodleAccountRow } from "../db/noodle-platform-migration.js";
import { migrateLegacyNoodlePostAccessRow } from "../db/noodle-access-migration.js";
import { getFileTableConfig, isFileTable, type AnyFileTable } from "../db/file-schema.js";
import * as schema from "../db/schema/index.js";
import { createCharactersStorage } from "../services/storage/characters.storage.js";
import { createLorebooksStorage } from "../services/storage/lorebooks.storage.js";
import { createPromptsStorage } from "../services/storage/prompts.storage.js";
import { createAgentsStorage } from "../services/storage/agents.storage.js";
import { createThemesStorage } from "../services/storage/themes.storage.js";
import { createAppSettingsStorage } from "../services/storage/app-settings.storage.js";
import {
  canReparentFolder,
  normalizePersonalExtensionCapabilities,
  type ExportEnvelope,
} from "@marinara-engine/shared";
import { getDataDir } from "../utils/data-dir.js";
import { getFileStorageDir } from "../config/runtime-config.js";
import { normalizeTimestampOverrides } from "../services/import/import-timestamps.js";
import { flushDB, type DB } from "../db/connection.js";
import { requirePrivilegedAccess } from "../middleware/privileged-gate.js";
import { BACKUP_RATE_LIMIT } from "../middleware/rate-limit.js";
import { assertInsideDir, safeCompareString } from "../utils/security.js";
import { logger } from "../lib/logger.js";
import { crc32Buffer, finishCrc32, updateCrc32State } from "../utils/crc32.js";
import { ENCRYPTED_WEBHOOK_PREFIX, encryptCustomToolWebhookUrl } from "../utils/custom-tool-webhook.js";
import {
  ProfileImportAssetValidationError,
  cleanupStagedProfileAssets,
  promoteStagedProfileAssets,
  rollbackPromotedProfileAssets,
  stageProfileImportAssets,
  type ProfileImportAssetInput,
  type ProfileImportAssetStream,
  type StagedProfileImportAssets,
} from "../services/import/profile-import-assets.js";
import { ProfileImportRequestError } from "../services/import/profile-import-errors.js";
import { planProfileNoodleImport, type ProfileNoodleImportWarning } from "../services/import/profile-import-noodle.js";
import { getCapabilityService } from "../services/capability-packages/capability-service-registry.service.js";
import { computePersonalExtensionHash } from "../services/extensions/personal-extension-hash.js";
import { personalServerExtensionRuntime } from "../services/extensions/personal-server-extension-runtime.js";
import {
  AUTOMATIC_BACKUP_FILENAME,
  automaticBackupArchiveFilename,
  automaticBackupExists,
  normalizeAutomaticBackupRetentionCount,
  parseAutomaticBackupRetentionCount,
  pruneAutomaticBackupFiles,
} from "../services/backup/automatic-backup-retention.js";

/** Directories inside DATA_DIR that should be included in every backup. */
const BACKUP_DIRS = [
  "storage",
  "avatars",
  "sprites",
  "backgrounds",
  "gallery",
  "game-scene-videos",
  "conversation-call-character-videos",
  "fonts",
  "knowledge-sources",
  "game-assets",
  "custom-emojis",
  "custom-stickers",
  "notification-sounds",
  "lorebooks/images",
  "prompts/images",
  "agents/images",
  "connections/images",
  "long-term-memory",
];
const ENCRYPTION_KEY_FILENAME = ".encryption-key";
const PROFILE_ASSET_DIRS = BACKUP_DIRS.filter((dirName) => dirName !== "storage");
const ZIP16_MAX_VALUE = 0xffff;
const ZIP32_MAX_VALUE = 0xffffffff;
const PROFILE_IMPORT_BODY_LIMIT_BYTES = 256 * 1024 * 1024;
const PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES = 256 * 1024 * 1024;
const PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES = 8 * 1024 * 1024;
const PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const LARGE_STORED_IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const LARGE_STORED_VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);
const PROFILE_IMAGE_ASSET_PREFIXES = [
  "avatars/",
  "backgrounds/",
  "custom-emojis/",
  "custom-stickers/",
  "lorebooks/images/",
  "prompts/images/",
  "agents/images/",
  "connections/images/",
  "sprites/",
  "game-assets/backgrounds/",
  "game-assets/sprites/",
] as const;
const PROFILE_VIDEO_ASSET_PREFIXES = [
  "gallery/character-videos/",
  "gallery/persona-videos/",
  "game-scene-videos/",
  "conversation-call-character-videos/",
] as const;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

async function hardenPrivateBackupTree(rootPath: string): Promise<void> {
  if (process.platform === "win32" || !existsSync(rootPath)) return;
  try {
    await chmod(rootPath, PRIVATE_DIRECTORY_MODE);
    const entries = await readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(rootPath, entry.name);
      if (entry.isDirectory()) await hardenPrivateBackupTree(path);
      else if (entry.isFile()) await chmod(path, PRIVATE_FILE_MODE);
    }
  } catch (err) {
    logger.warn(err, "[backup] Could not apply private permissions to %s", rootPath);
  }
}

function withOptionalNoodleAutoPostPaused<T>(operation: () => Promise<T>): Promise<T> {
  const service = getCapabilityService<{ pause<TValue>(run: () => Promise<TValue>): Promise<TValue> }>("noodle:backup");
  return service ? service.pause(operation) : operation();
}
const PROFILE_IMPORT_MEMORY_WARNING_BYTES = 512 * 1024 * 1024;
const PROFILE_EXPORT_JSON_TOO_LARGE_CODE = "PROFILE_EXPORT_JSON_TOO_LARGE";
const AUTOMATIC_BACKUP_SETTINGS_KEY = "automatic_backup";
const AUTOMATIC_BACKUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const AUTOMATIC_BACKUP_OMISSION_HISTORY_LIMIT = 1_000;
const AUTOMATIC_BACKUP_OMISSION_HISTORY_BYTES = 256 * 1024;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const ZIP_EOCD_MIN_SIZE = 22;
const ZIP64_EOCD_MIN_SIZE = 56;
const ZIP64_EOCD_LOCATOR_SIZE = 20;
const ZIP_EOCD_MAX_COMMENT_BYTES = 0xffff;
const ZIP_ENCRYPTED_FLAG = 0x0001;
let profileImportLifecycleTail = Promise.resolve();
let automaticBackupLifecycleTail = Promise.resolve();

type AutomaticBackupFrequency = "daily" | "weekly" | "monthly";
type AutomaticBackupSettings = {
  enabled: boolean;
  frequency: AutomaticBackupFrequency;
  retentionCount: number;
  lastBackupAt: string | null;
  lastError: string | null;
  lastOmittedEntries: string[];
};

export function buildPreparedBackupDownloadUrl(jobId: string, token: string): string {
  return `/api/backup/download/file/${encodeURIComponent(jobId)}?token=${encodeURIComponent(token)}`;
}

export function isPreparedBackupDownloadTokenValid(expected: string, provided: unknown): boolean {
  return typeof provided === "string" && provided.length > 0 && safeCompareString(provided, expected);
}

export function limitAutomaticBackupOmissionHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const entries: string[] = [];
  let bytes = 0;
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const entryBytes = Buffer.byteLength(entry, "utf8");
    if (bytes + entryBytes > AUTOMATIC_BACKUP_OMISSION_HISTORY_BYTES) break;
    entries.push(entry);
    bytes += entryBytes;
    if (entries.length >= AUTOMATIC_BACKUP_OMISSION_HISTORY_LIMIT) break;
  }
  return entries;
}

function normalizeAutomaticBackupSettings(value: unknown): AutomaticBackupSettings {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const frequency: AutomaticBackupFrequency =
    candidate.frequency === "weekly" || candidate.frequency === "monthly" ? candidate.frequency : "daily";
  return {
    enabled: candidate.enabled === true,
    frequency,
    retentionCount: normalizeAutomaticBackupRetentionCount(candidate.retentionCount),
    lastBackupAt: typeof candidate.lastBackupAt === "string" ? candidate.lastBackupAt : null,
    lastError: typeof candidate.lastError === "string" ? candidate.lastError : null,
    lastOmittedEntries: limitAutomaticBackupOmissionHistory(candidate.lastOmittedEntries),
  };
}

function automaticBackupPeriodMs(frequency: AutomaticBackupFrequency) {
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  if (frequency === "monthly") return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function automaticBackupNextAt(settings: AutomaticBackupSettings) {
  if (!settings.enabled) return null;
  const lastBackupMs = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : Number.NaN;
  return new Date(
    Number.isFinite(lastBackupMs) ? lastBackupMs + automaticBackupPeriodMs(settings.frequency) : Date.now(),
  ).toISOString();
}

/** Serialize database replacement, asset promotion, and failure recovery as one import lifecycle. */
async function withProfileImportLifecycleLock<T>(task: () => Promise<T>): Promise<T> {
  const predecessor = profileImportLifecycleTail;
  let release: () => void = () => undefined;
  profileImportLifecycleTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await predecessor;
  try {
    return await task();
  } finally {
    release();
  }
}

/** Serialize automatic backup rotation and retention pruning against the same archive directory. */
async function withAutomaticBackupLifecycleLock<T>(task: () => Promise<T>): Promise<T> {
  const predecessor = automaticBackupLifecycleTail;
  let release: () => void = () => undefined;
  automaticBackupLifecycleTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await predecessor;
  try {
    return await task();
  } finally {
    release();
  }
}

/** Resolve the directory shared by automatic archives and user-created backup folders. */
function getBackupsRoot(): string {
  return join(getDataDir(), "backups");
}

function normalizeLorebookScope(value: unknown): { mode: "all" | "disabled" | "specific"; chatIds: string[] } {
  if (!value || typeof value !== "object") return { mode: "all", chatIds: [] };
  const raw = value as Record<string, unknown>;
  const mode = raw.mode === "disabled" || raw.mode === "specific" ? raw.mode : "all";
  const chatIds = Array.isArray(raw.chatIds)
    ? raw.chatIds.filter((chatId): chatId is string => typeof chatId === "string" && chatId.trim().length > 0)
    : [];
  return { mode, chatIds: Array.from(new Set(chatIds)) };
}

type ExportFormat = "native" | "compatible" | "zip";
type ProfileTableSnapshots = Record<string, Array<Record<string, unknown>>>;
type ProfileFileAsset = { path: string; data?: string; size: number };
type ProfileStorageSnapshot = {
  version: 1;
  tables: ProfileTableSnapshots;
  files: ProfileFileAsset[];
};
type ProfileArchiveTableFile = { path: string; count: number; size: number };
type ProfileArchiveStorageSnapshot = {
  version: 2;
  tables: Record<string, ProfileArchiveTableFile>;
  files: ProfileFileAsset[];
};
type ProfileExportEnvelopeOptions = {
  includeFileStorage?: boolean;
  inlineFileData?: boolean;
  includeLegacyAvatarBase64?: boolean;
  inlineJsonBudget?: ProfileInlineJsonBudget;
};
type ProfileStorageSnapshotOptions = {
  inlineFileData?: boolean;
  inlineJsonBudget?: ProfileInlineJsonBudget;
  skipUnreadableFiles?: boolean;
  onSkippedFile?: (path: string) => void;
};
type ProfileInlineJsonBudget = {
  limitBytes: number;
  estimatedBytes: number;
};
type ProfileAssetReader<TContents = Buffer | ProfileImportAssetStream> = (
  safePath: string,
) => TContents | null | Promise<TContents | null>;
type ProfileArchiveAssetIndex = Map<string, { entryName: string; expectedSize: number }>;
type ProfileImportWarning =
  | ProfileNoodleImportWarning
  | { type: "missing_asset"; path: string; message: string }
  | {
      type:
        | "connection_credentials_quarantined"
        | "custom_tools_quarantined"
        | "mari_instructions_quarantined"
        | "personal_extensions_quarantined"
        | "custom_themes_quarantined";
      message: string;
    };
type ProfileZipEntry = {
  entryName: string;
  isDirectory: boolean;
  header: {
    method: number;
    crc32: number;
    compressedSize: number;
    size: number;
    dataOffset: number;
  };
};
type ProfileZipArchive = {
  filePath: string;
  entries: ProfileZipEntry[];
  entriesByName: Map<string, ProfileZipEntry>;
  isFullBackup: boolean;
};
type StoredZipEntrySource =
  | { entryName: string; data: Buffer; mtime?: Date }
  | { entryName: string; buildData: () => Buffer; mtime?: Date }
  | {
      entryName: string;
      filePath: string;
      size: number;
      mtime?: Date;
      tolerateSourceChanges?: boolean;
      allowLargeStoredEntry?: boolean;
    };
type StoredZipEntryRecord = {
  entryName: string;
  crc32: number;
  size: number;
  localHeaderOffset: number;
  dosTime: number;
  dosDate: number;
  usesDataDescriptor: boolean;
  forceZip64: boolean;
};
type ProfileImportInput = {
  envelope: ExportEnvelope;
  readAsset?: ProfileAssetReader;
  warnings?: ProfileImportWarning[];
  cleanup?: () => Promise<void>;
  fileFingerprint?: string;
  assetTotalByteLimit?: number;
};
type ProfileImportStats = {
  characters: number;
  personas: number;
  lorebooks: number;
  presets: number;
  agents: number;
  themes: number;
  chats?: number;
  messages?: number;
  connections?: number;
  customTools?: number;
  mariInstructions?: number;
  personalExtensions?: number;
  files?: number;
  tables?: Record<string, number>;
};
type ProfileImportProgress = {
  phase: string;
  label: string;
  completedItems: number;
  totalItems: number;
  imported: ProfileImportStats;
};
type ProfileImportProgressReporter = (progress: ProfileImportProgress) => void;

class ProfileJsonTooLargeError extends Error {
  constructor(public estimatedBytes: number) {
    super("Profile export is too large for JSON");
  }
}

class ProfileArchiveTooLargeError extends Error {}

class ProfileImportArchiveTooLargeError extends ProfileImportRequestError {}

function sendProfileImportRequestError(reply: FastifyReply, err: ProfileImportRequestError) {
  const message = err.message || "Profile import file could not be read.";
  const statusCode = err instanceof ProfileImportArchiveTooLargeError ? 413 : 400;
  return reply.status(statusCode).send({ error: "Invalid profile export", message });
}

function resolveBackupDir(dataDir: string, dirName: string) {
  return dirName === "storage" ? getFileStorageDir() : join(dataDir, dirName);
}

function resolvePersistedEncryptionKeyPath(dataDir: string) {
  return assertInsideDir(dataDir, join(dataDir, ENCRYPTION_KEY_FILENAME));
}

function toSafeExportName(name: string, fallback: string) {
  const sanitized = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function stSelectiveLogic(value: unknown): number {
  if (value === "and" || value === "or") return 0;
  if (value === "not_all") return 1;
  if (value === "not") return 2;
  if (value === "and_all") return 3;
  return 0;
}

function stPosition(value: unknown): number {
  const position = Number(value ?? 0);
  if (position === 7) return 7;
  if (position === 2) return 4;
  if (position === 1) return 1;
  return 0;
}

function stRole(value: unknown): number {
  return value === "user" ? 1 : value === "assistant" ? 2 : 0;
}

function buildCompatibleLorebookExport(lb: Record<string, any>) {
  const entries: Record<string, Record<string, unknown>> = {};
  (Array.isArray(lb.entries) ? lb.entries : []).forEach((entry: Record<string, unknown>, index: number) => {
    entries[String(index)] = {
      uid: index,
      key: asStringArray(entry.keys),
      keysecondary: asStringArray(entry.secondaryKeys),
      comment: String(entry.name ?? `Entry ${index + 1}`),
      content: String(entry.content ?? ""),
      disable: entry.enabled === false,
      constant: entry.constant === true,
      selective: entry.selective === true,
      selectiveLogic: stSelectiveLogic(entry.selectiveLogic),
      order: Number(entry.order ?? 100),
      position: stPosition(entry.position),
      outletName: String(entry.outletName ?? ""),
      depth: Number(entry.depth ?? 4),
      probability: entry.probability ?? null,
      scanDepth: entry.scanDepth ?? null,
      matchWholeWords: entry.matchWholeWords === true,
      caseSensitive: entry.caseSensitive === true,
      role: stRole(entry.role),
      group: String(entry.group ?? ""),
      groupWeight: entry.groupWeight ?? null,
      sticky: entry.sticky ?? null,
      cooldown: entry.cooldown ?? null,
      delay: entry.delay ?? null,
      useRegex: entry.useRegex === true,
      preventRecursion: entry.preventRecursion === true,
      excludeRecursion: entry.excludeRecursion === true,
      delayUntilRecursion: entry.delayUntilRecursion === true,
    };
  });

  return {
    name: String(lb.name ?? "Lorebook"),
    characterId: lb.characterId ?? null,
    personaId: lb.personaId ?? null,
    chatId: lb.chatId ?? null,
    extensions: {
      marinara: {
        exportedAt: new Date().toISOString(),
        source: "Marinara Engine compatibility export",
      },
    },
    entries,
  };
}

async function buildCompatibleProfileZip(app: FastifyInstance) {
  const envelope = await buildProfileExportEnvelope(app, {
    includeFileStorage: false,
    includeLegacyAvatarBase64: false,
  });
  const data = envelope.data as Record<string, any>;
  const zip = new AdmZip();

  for (const [index, character] of (Array.isArray(data.characters) ? data.characters : []).entries()) {
    const charData = typeof character.data === "string" ? JSON.parse(character.data) : character.data;
    zip.addFile(
      `characters/${toSafeExportName(String(charData?.name ?? "character"), `character-${index + 1}`)}.json`,
      Buffer.from(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: charData }, null, 2), "utf8"),
    );
  }

  for (const [index, persona] of (Array.isArray(data.personas) ? data.personas : []).entries()) {
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      avatarPath: _avatarPath,
      avatarBase64: _avatarBase64,
      isActive: _isActive,
      ...personaData
    } = persona as Record<string, unknown>;
    zip.addFile(
      `personas/${toSafeExportName(String(personaData.name ?? "persona"), `persona-${index + 1}`)}.json`,
      Buffer.from(JSON.stringify(personaData, null, 2), "utf8"),
    );
  }

  for (const [index, lorebook] of (Array.isArray(data.lorebooks) ? data.lorebooks : []).entries()) {
    zip.addFile(
      `lorebooks/${toSafeExportName(String(lorebook.name ?? "lorebook"), `lorebook-${index + 1}`)}.json`,
      Buffer.from(JSON.stringify(buildCompatibleLorebookExport(lorebook), null, 2), "utf8"),
    );
  }

  return zip;
}

function resolveAvatarWritePath(dataDir: string, avatarPath: unknown) {
  if (typeof avatarPath !== "string" || !avatarPath.trim()) return null;
  const filename = avatarPath.split("?")[0]?.split("/").filter(Boolean).pop();
  if (!filename) return null;
  return assertInsideDir(join(dataDir, "avatars"), join(dataDir, "avatars", filename));
}

function resolveProfileExportFilePath(dataDir: string, filePath: unknown) {
  if (typeof filePath !== "string" || !filePath.trim()) return null;
  const cleanPath = filePath.split("?")[0];
  if (!cleanPath) return null;
  try {
    return assertInsideDir(dataDir, join(dataDir, cleanPath));
  } catch {
    return null;
  }
}

function redactAgentSecrets(agent: any) {
  const SECRET_KEY_RE = /token|secret|password|api[_-]?key/i;

  const redactSettings = (settings: unknown): unknown => {
    if (Array.isArray(settings)) return settings.map(redactSettings);
    if (!settings || typeof settings !== "object") return settings;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (SECRET_KEY_RE.test(key)) {
        out[key] = null;
      } else if (value && typeof value === "object") {
        out[key] = redactSettings(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  };

  if (typeof agent.settings === "string") {
    try {
      return { ...agent, settings: redactSettings(JSON.parse(agent.settings)) };
    } catch {
      return { ...agent, settings: null };
    }
  }

  return { ...agent, settings: redactSettings(agent.settings) };
}

function schemaTableName(table: AnyFileTable) {
  return getFileTableConfig(table).name;
}

function schemaPrimaryKeyColumn(table: AnyFileTable) {
  return getFileTableConfig(table).columns.find((column) => column.primary) ?? null;
}

const profileTableObjects = new Map<string, AnyFileTable>();
for (const candidate of Object.values(schema)) {
  if (!isFileTable(candidate)) continue;
  const tableName = schemaTableName(candidate);
  if (tableName && FILE_BACKED_TABLES.includes(tableName as (typeof FILE_BACKED_TABLES)[number])) {
    profileTableObjects.set(tableName, candidate);
  }
}

export function sanitizeProfileTableRows(tableName: string, rows: Array<Record<string, unknown>>) {
  if (tableName === "noodler_fan_activity_state") return [];
  if (tableName === "chats") {
    return rows.map((row) => {
      if (typeof row.metadata !== "string") return row;
      try {
        const metadata = JSON.parse(row.metadata) as unknown;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return row;
        const sanitized = { ...(metadata as Record<string, unknown>) };
        delete sanitized.branchParentChatId;
        delete sanitized.branchParentMessageId;
        delete sanitized.branchMessageId;
        return { ...row, metadata: JSON.stringify(sanitized) };
      } catch {
        return row;
      }
    });
  }
  if (tableName === "api_connections") {
    return rows.map((row) => ({ ...row, apiKeyEncrypted: "" }));
  }
  if (tableName === "agent_configs") {
    return rows.map((row) => redactAgentSecrets(row));
  }
  // custom_tools.webhookUrl is a bearer credential for executionType="webhook" tools
  // (a Discord webhook URL embeds its token in the path), so blank it on every
  // export sink, mirroring the api_connections.apiKeyEncrypted branch above. Only
  // webhookUrl is redacted: scriptBody/staticResult are user-authored tool bodies,
  // not credentials.
  if (tableName === "custom_tools") {
    return rows.map((row) => ({ ...row, webhookUrl: "" }));
  }
  if (tableName === "installed_extensions") {
    return rows.map(quarantineProfilePersonalExtensionRow);
  }
  return rows;
}

export function quarantineProfilePersonalExtensionRow(row: Record<string, unknown>) {
  const runtime = row.runtime === "server" ? "server" : "client";
  const capabilities =
    runtime === "client"
      ? (() => {
          try {
            return normalizePersonalExtensionCapabilities(
              typeof row.capabilities === "string" ? JSON.parse(row.capabilities) : row.capabilities,
            );
          } catch {
            return [];
          }
        })()
      : [];
  const contentHash = computePersonalExtensionHash({
    runtime,
    capabilities,
    css: runtime === "client" && typeof row.css === "string" ? row.css : null,
    js: runtime === "client" && typeof row.js === "string" ? row.js : null,
    serverJs: runtime === "server" && typeof row.serverJs === "string" ? row.serverJs : null,
  });
  return {
    ...row,
    runtime,
    capabilities: JSON.stringify(capabilities),
    enabled: "false",
    contentHash,
    approvedHash: null,
    source: "profile_import",
    revisions: typeof row.revisions === "string" ? row.revisions : "[]",
  };
}

export function quarantineProfileCustomToolRow(row: Record<string, unknown>) {
  const importedWebhookUrl =
    typeof row.webhookUrl === "string" && !row.webhookUrl.startsWith(ENCRYPTED_WEBHOOK_PREFIX)
      ? encryptCustomToolWebhookUrl(row.webhookUrl)
      : null;
  const secured: Record<string, unknown> = {
    ...row,
    webhookUrl: importedWebhookUrl,
  };
  if (row.executionType === "static") return secured;
  return { ...secured, enabled: "false", includeHiddenContext: "false" };
}

const PROFILE_CONNECTION_CREDENTIAL_IDENTITY_FIELDS = [
  "provider",
  "baseUrl",
  "embeddingBaseUrl",
  "imageGenerationSource",
  "imageService",
  "imageEndpointId",
  "videoGenerationSource",
  "videoService",
  "audioSource",
] as const;

const PROFILE_CONNECTION_AUTOMATIC_SELECTION_FIELDS = [
  "isDefault",
  "fallbackForMain",
  "useForRandom",
  "defaultForAgents",
  "fallbackForAgents",
] as const;

function profileConnectionIdentityValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function profileConnectionCredentialIdentityMatches(
  existing: Record<string, unknown>,
  imported: Record<string, unknown>,
) {
  return PROFILE_CONNECTION_CREDENTIAL_IDENTITY_FIELDS.every(
    (field) => profileConnectionIdentityValue(existing[field]) === profileConnectionIdentityValue(imported[field]),
  );
}

type ProfileApiConnectionImportPlan = {
  row: Record<string, unknown>;
  trustedIdentity: boolean;
};

export function quarantineProfileApiConnectionRow(
  row: Record<string, unknown>,
  existing?: Record<string, unknown>,
): ProfileApiConnectionImportPlan {
  const existingCredential = typeof existing?.apiKeyEncrypted === "string" ? existing.apiKeyEncrypted : "";
  const trustedIdentity = !!existing && profileConnectionCredentialIdentityMatches(existing, row);
  const secured: Record<string, unknown> = {
    ...row,
    apiKeyEncrypted: trustedIdentity ? existingCredential : "",
    profileImportReviewRequired: trustedIdentity ? "false" : "true",
  };
  if (trustedIdentity) return { row: secured, trustedIdentity };
  for (const field of PROFILE_CONNECTION_AUTOMATIC_SELECTION_FIELDS) secured[field] = "false";
  return { row: secured, trustedIdentity };
}

async function planProfileApiConnectionImports(
  db: DB,
  rows: Array<Record<string, unknown>>,
): Promise<ProfileApiConnectionImportPlan[]> {
  const existingRows = (await db.select().from(schema.apiConnections)) as Array<Record<string, unknown>>;
  const existingById = new Map<unknown, Record<string, unknown>>(existingRows.map((row) => [row.id, row]));
  return rows.map((row) => quarantineProfileApiConnectionRow(row, existingById.get(row.id)));
}

export function quarantineProfileMariInstructionRow(row: Record<string, unknown>) {
  return { ...row, enabled: 0, persistent: 0 };
}

export function quarantineProfileThemeRow(row: Record<string, unknown>) {
  return { ...row, isActive: "false" };
}

// Secret-bearing columns to omit on the conflict-UPDATE path so an existing row
// keeps its stored secret (the file store leaves an unmentioned column untouched); only
// the fresh-insert path carries the export's redacted values. For custom_tools the
// export blanks the whole column; for agent_configs the export redacts secret keys
// *inside* the settings JSON, so we
// omit the entire settings column on update rather than overwrite live secrets
// with the redacted blob (an existing row's non-secret settings are left as-is). API
// connection credentials are handled separately: they are retained only when the
// imported credential destination matches the existing row exactly.
const REDACTED_UPDATE_COLUMNS: Record<string, string> = {
  agent_configs: "settings",
  custom_tools: "webhookUrl",
};

export function buildProfileUpdateSet(tableName: string, cleanRow: Record<string, unknown>): Record<string, unknown> {
  const updateSet: Record<string, unknown> = { ...cleanRow };
  const secretColumn = REDACTED_UPDATE_COLUMNS[tableName];
  if (secretColumn) delete updateSet[secretColumn];
  return updateSet;
}

async function buildProfileTableSnapshot(app: FastifyInstance): Promise<ProfileTableSnapshots> {
  const tables: ProfileTableSnapshots = {};

  for (const tableName of FILE_BACKED_TABLES) {
    const table = profileTableObjects.get(tableName);
    if (!table) continue;
    const rows = (await app.db.select().from(table as any)) as Array<Record<string, unknown>>;
    tables[tableName] = sanitizeProfileTableRows(tableName, rows);
  }

  return tables;
}

function normalizeProfileAssetPath(pathValue: unknown) {
  if (typeof pathValue !== "string" || !pathValue.trim()) return null;
  if (pathValue.includes("\0")) return null;
  const parts = pathValue.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts.some((part) => part === "." || part === ".." || part.includes(":"))) return null;
  const normalized = parts.join("/");
  const isAllowedAssetPath = PROFILE_ASSET_DIRS.some(
    (dirName) => normalized === dirName || normalized.startsWith(`${dirName}/`),
  );
  if (!isAllowedAssetPath) return null;
  return normalized;
}

function profileArchiveSizeError(label: string, size: number, limit: number) {
  return `${label} is too large for profile ZIP import/export (${size} bytes, limit ${limit} bytes).`;
}

function getProfileAssetManifestSize(file: unknown, safePath: string) {
  const size = (file as { size?: unknown } | null)?.size;
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    throw new ProfileImportRequestError(`Profile archive asset ${safePath} has an invalid size manifest.`);
  }
  return size;
}

function assertProfileArchiveEntryLimit(label: string, size: number) {
  if (size > PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES) {
    throw new ProfileImportRequestError(profileArchiveSizeError(label, size, PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES));
  }
}

function assertProfileArchiveTotalLimit(total: number, label = "Profile archive restored assets") {
  if (total > PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES) {
    throw new ProfileImportRequestError(
      profileArchiveSizeError(label, total, PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES),
    );
  }
}

function getZipEntryUncompressedSize(entry: ProfileZipEntry) {
  const size = entry.header.size;
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function getZipEntryCompressedSize(entry: ProfileZipEntry) {
  const size = entry.header.compressedSize;
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function estimateBase64Length(byteLength: number) {
  return Math.ceil(byteLength / 3) * 4;
}

function reserveInlineJsonBudget(budget: ProfileInlineJsonBudget | undefined, bytes: number) {
  if (!budget) return;
  budget.estimatedBytes += bytes;
  if (budget.estimatedBytes > budget.limitBytes) {
    throw new ProfileJsonTooLargeError(budget.estimatedBytes);
  }
}

async function readInlineBase64File(filePath: string, budget?: ProfileInlineJsonBudget) {
  const fileStat = await stat(filePath);
  reserveInlineJsonBudget(budget, estimateBase64Length(fileStat.size));
  const buffer = await readFile(filePath);
  return buffer.toString("base64");
}

async function collectProfileAssetFiles(
  dataDir: string,
  options: ProfileStorageSnapshotOptions = {},
): Promise<ProfileFileAsset[]> {
  const files: ProfileFileAsset[] = [];
  const inlineFileData = options.inlineFileData ?? true;

  for (const dirName of PROFILE_ASSET_DIRS) {
    const src = join(dataDir, dirName);
    if (!existsSync(src)) continue;
    const stack = [src];
    while (stack.length > 0) {
      const current = stack.pop()!;
      let directoryEntries: Dirent[];
      try {
        directoryEntries = await readdir(current, { withFileTypes: true });
      } catch (error) {
        if (!options.skipUnreadableFiles) throw error;
        const logError = error instanceof Error ? error : new Error(String(error));
        logger.warn(logError, "[backup] Skipping unreadable profile asset directory: %s", current);
        options.onSkippedFile?.(relative(dataDir, current).split(/[\\/]/g).join("/"));
        continue;
      }
      for (const entry of directoryEntries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.isFile()) continue;
        const relPath = [dirName, relative(src, full)].filter(Boolean).join("/").split(/[\\/]/g).join("/");
        const safePath = normalizeProfileAssetPath(relPath);
        if (!safePath) continue;
        let fileStat: Awaited<ReturnType<typeof stat>>;
        try {
          fileStat = await stat(full);
        } catch (error) {
          if (!options.skipUnreadableFiles) throw error;
          const logError = error instanceof Error ? error : new Error(String(error));
          logger.warn(logError, "[backup] Skipping unreadable profile asset: %s", relPath);
          options.onSkippedFile?.(relPath);
          continue;
        }
        const asset: ProfileFileAsset = { path: safePath, size: fileStat.size };
        if (inlineFileData) {
          reserveInlineJsonBudget(options.inlineJsonBudget, estimateBase64Length(fileStat.size));
          const buffer = await readFile(full);
          asset.data = buffer.toString("base64");
        }
        files.push(asset);
      }
    }
  }

  return files;
}

async function buildProfileStorageSnapshot(
  app: FastifyInstance,
  options: ProfileStorageSnapshotOptions = {},
): Promise<ProfileStorageSnapshot> {
  // Tables and assets are two separate reads. The NoodleR reserve writes both in one pass, so
  // without holding it still the archive can contain a row whose media bytes are missing, or
  // media no surviving row owns.
  return withOptionalNoodleAutoPostPaused(async () => ({
    version: 1,
    tables: await buildProfileTableSnapshot(app),
    files: await collectProfileAssetFiles(getDataDir(), options),
  }));
}

function isProfileStorageSnapshot(value: unknown): value is ProfileStorageSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProfileStorageSnapshot>;
  return candidate.version === 1 && !!candidate.tables && typeof candidate.tables === "object";
}

function isProfileArchiveStorageSnapshot(value: unknown): value is ProfileArchiveStorageSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProfileArchiveStorageSnapshot>;
  return candidate.version === 2 && !!candidate.tables && typeof candidate.tables === "object";
}

function buildProfileImportStats(tableCounts: Record<string, number>, files: number) {
  return {
    characters: tableCounts.characters ?? 0,
    personas: tableCounts.personas ?? 0,
    lorebooks: tableCounts.lorebooks ?? 0,
    presets: tableCounts.prompt_presets ?? 0,
    agents: tableCounts.agent_configs ?? 0,
    themes: tableCounts.custom_themes ?? 0,
    chats: tableCounts.chats ?? 0,
    messages: tableCounts.messages ?? 0,
    connections: tableCounts.api_connections ?? 0,
    customTools: tableCounts.custom_tools ?? 0,
    mariInstructions: tableCounts.mari_instructions ?? 0,
    personalExtensions: tableCounts.installed_extensions ?? 0,
    files,
    tables: tableCounts,
  };
}

function profileEnvelopeFingerprint(envelope: ExportEnvelope) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(envelope ?? null))
    .digest("hex")}`;
}

async function fileFingerprint(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return `sha256:${hash.digest("hex")}`;
}

function profileMissingAssetWarningPathSet(warnings: ProfileImportWarning[]) {
  return new Set(
    warnings.flatMap((warning) => (warning.type === "missing_asset" && warning.path ? [warning.path] : [])),
  );
}

function addProfileImportWarning(warnings: ProfileImportWarning[], warning: ProfileImportWarning) {
  const warningPath = "path" in warning ? warning.path : undefined;
  if (
    warnings.some(
      (existing) => existing.type === warning.type && ("path" in existing ? existing.path : undefined) === warningPath,
    )
  ) {
    return;
  }
  warnings.push(warning);
}

type ProfileImportSecuritySummary = {
  connectionsQuarantined: number;
  customToolsQuarantined: number;
  mariInstructionsQuarantined: number;
  personalExtensionsQuarantined: number;
  customThemesQuarantined: number;
};

function isProfileImportActiveFlag(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function buildProfileImportSecuritySummary(
  snapshot: Pick<ProfileStorageSnapshot, "tables">,
  connectionPlans: ProfileApiConnectionImportPlan[],
): ProfileImportSecuritySummary {
  const rows = (tableName: string) => snapshot.tables[tableName] ?? [];
  return {
    connectionsQuarantined: connectionPlans.filter((plan) => !plan.trustedIdentity).length,
    customToolsQuarantined: rows("custom_tools").filter((row) => row.executionType !== "static").length,
    mariInstructionsQuarantined: rows("mari_instructions").filter(
      (row) => isProfileImportActiveFlag(row.enabled) || isProfileImportActiveFlag(row.persistent),
    ).length,
    personalExtensionsQuarantined: rows("installed_extensions").length,
    customThemesQuarantined: rows("custom_themes").filter((row) => isProfileImportActiveFlag(row.isActive)).length,
  };
}

function profileImportCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function addProfileImportSecurityWarnings(warnings: ProfileImportWarning[], summary: ProfileImportSecuritySummary) {
  if (summary.connectionsQuarantined > 0) {
    addProfileImportWarning(warnings, {
      type: "connection_credentials_quarantined",
      message: `${profileImportCountLabel(summary.connectionsQuarantined, "imported connection")} had no matching local endpoint. It will stay unavailable until opened, reviewed, and saved; API keys and automatic-selection flags were cleared.`,
    });
  }
  if (summary.customToolsQuarantined > 0) {
    addProfileImportWarning(warnings, {
      type: "custom_tools_quarantined",
      message: `${profileImportCountLabel(summary.customToolsQuarantined, "imported executable custom tool")} will be disabled and denied hidden-context access until reviewed.`,
    });
  }
  if (summary.mariInstructionsQuarantined > 0) {
    addProfileImportWarning(warnings, {
      type: "mari_instructions_quarantined",
      message: `${profileImportCountLabel(summary.mariInstructionsQuarantined, "active Professor Mari memory", "active Professor Mari memories")} will be imported disabled and non-persistent until reviewed.`,
    });
  }
  if (summary.personalExtensionsQuarantined > 0) {
    addProfileImportWarning(warnings, {
      type: "personal_extensions_quarantined",
      message: `${profileImportCountLabel(summary.personalExtensionsQuarantined, "personal extension")} will be imported disabled and require local approval before they can run.`,
    });
  }
  if (summary.customThemesQuarantined > 0) {
    addProfileImportWarning(warnings, {
      type: "custom_themes_quarantined",
      message: `${profileImportCountLabel(summary.customThemesQuarantined, "active custom theme")} will be imported inactive so profile CSS cannot take effect before review.`,
    });
  }
}

async function addProfileStoragePreviewSecurityWarnings(
  db: DB,
  snapshot: ProfileStorageSnapshot,
  warnings: ProfileImportWarning[],
) {
  const importedConnections = snapshot.tables.api_connections ?? [];
  const connectionPlans = await planProfileApiConnectionImports(db, importedConnections);
  addProfileImportSecurityWarnings(warnings, buildProfileImportSecuritySummary(snapshot, connectionPlans));
}

function previewProfileStorageSnapshotStats(
  snapshot: ProfileStorageSnapshot,
  readAsset: ProfileAssetReader | undefined,
  warnings: ProfileImportWarning[],
) {
  const tableCounts: Record<string, number> = {};
  for (const tableName of FILE_BACKED_TABLES) {
    const rows = snapshot.tables[tableName];
    tableCounts[tableName] = Array.isArray(rows) ? rows.length : 0;
  }

  const missingAssetPaths = profileMissingAssetWarningPathSet(warnings);
  let files = 0;
  if (Array.isArray(snapshot.files)) {
    for (const file of snapshot.files) {
      const safePath = normalizeProfileAssetPath(file?.path);
      if (!safePath || missingAssetPaths.has(safePath)) continue;
      if (typeof file.data === "string" || readAsset) {
        files++;
        continue;
      }
      addProfileImportWarning(warnings, {
        type: "missing_asset",
        path: safePath,
        message: `Profile JSON is missing ${safePath}. Imported the rest of the profile without that asset.`,
      });
    }
  }

  return buildProfileImportStats(tableCounts, files);
}

function addLegacyProfileThemeSecurityWarning(data: Record<string, any>, warnings: ProfileImportWarning[]) {
  const activeThemes = Array.isArray(data.themes)
    ? data.themes.filter((theme: Record<string, unknown>) => isProfileImportActiveFlag(theme?.isActive)).length
    : 0;
  if (activeThemes === 0) return;
  addProfileImportSecurityWarnings(warnings, {
    connectionsQuarantined: 0,
    customToolsQuarantined: 0,
    mariInstructionsQuarantined: 0,
    personalExtensionsQuarantined: 0,
    customThemesQuarantined: activeThemes,
  });
}

function previewLegacyProfileImportStats(
  data: Record<string, any>,
  warnings: ProfileImportWarning[],
): ProfileImportStats {
  addLegacyProfileThemeSecurityWarning(data, warnings);
  return {
    characters: Array.isArray(data.characters) ? data.characters.length : 0,
    personas: Array.isArray(data.personas) ? data.personas.length : 0,
    lorebooks: Array.isArray(data.lorebooks) ? data.lorebooks.length : 0,
    presets: Array.isArray(data.presets) ? data.presets.length : 0,
    agents: Array.isArray(data.agents) ? data.agents.length : 0,
    themes: Array.isArray(data.themes) ? data.themes.length : 0,
    files: 0,
  };
}

function countProfileStorageSnapshotItems(snapshot: ProfileStorageSnapshot) {
  const tableRows = FILE_BACKED_TABLES.reduce((count, tableName) => {
    const rows = snapshot.tables[tableName];
    return count + (Array.isArray(rows) ? rows.length : 0);
  }, 0);
  return tableRows + (Array.isArray(snapshot.files) ? snapshot.files.length : 0);
}

function countLegacyProfileImportItems(data: Record<string, any>) {
  return ["characters", "personas", "lorebooks", "presets", "agents", "themes"].reduce((count, key) => {
    const value = data[key];
    return count + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function validateProfileStorageTableInputs(snapshot: ProfileStorageSnapshot) {
  for (const tableName of FILE_BACKED_TABLES) {
    const rows = snapshot.tables[tableName];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      throw new ProfileImportRequestError(`Profile table ${tableName} is not an array.`);
    }

    const table = profileTableObjects.get(tableName);
    if (!table) throw new ProfileImportRequestError(`Profile table ${tableName} is not supported.`);
    const primaryKey = schemaPrimaryKeyColumn(table);
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new ProfileImportRequestError(`Profile table ${tableName} contains an invalid row.`);
      }
      if (primaryKey) {
        const primaryValue = row[primaryKey.key];
        if (primaryValue === undefined || primaryValue === null || primaryValue === "") {
          throw new ProfileImportRequestError(`Profile table ${tableName} contains a row without ${primaryKey.key}.`);
        }
      }
    }
  }
}

function buildProfileImportAssetInputs(
  snapshot: ProfileStorageSnapshot,
  readAsset: ProfileAssetReader | undefined,
): Array<ProfileImportAssetInput> {
  if (!Array.isArray(snapshot.files)) return [];
  return snapshot.files.flatMap((file) => {
    const safePath = normalizeProfileAssetPath(file?.path);
    if (!safePath) return [];
    const expectedSize = getProfileAssetManifestSize(file, safePath);
    if (typeof file.data === "string") assertProfileArchiveEntryLimit(safePath, expectedSize);
    return [
      {
        path: safePath,
        expectedSize,
        read: () =>
          typeof file.data === "string" ? Buffer.from(file.data, "base64") : readAsset ? readAsset(safePath) : null,
      },
    ];
  });
}

async function importProfileStorageSnapshot(
  app: FastifyInstance,
  snapshot: ProfileStorageSnapshot,
  warnings: ProfileImportWarning[],
  onProgress?: ProfileImportProgressReporter,
  readAsset?: ProfileAssetReader,
  assetTotalByteLimit = PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES,
) {
  validateProfileStorageTableInputs(snapshot);
  let stagedAssets: StagedProfileImportAssets;
  try {
    stagedAssets = await stageProfileImportAssets(
      getDataDir(),
      buildProfileImportAssetInputs(snapshot, readAsset),
      assetTotalByteLimit,
    );
  } catch (error) {
    if (error instanceof ProfileImportAssetValidationError) {
      throw new ProfileImportRequestError(error.message);
    }
    throw error;
  }

  const totalItems = Math.max(1, countProfileStorageSnapshotItems(snapshot));
  let completedItems = 0;
  const tableCounts: Record<string, number> = {};

  const emit = (phase: string, label: string, files = 0) => {
    onProgress?.({
      phase,
      label,
      completedItems,
      totalItems,
      imported: buildProfileImportStats(tableCounts, files),
    });
  };

  return withProfileImportLifecycleLock(async () => {
    let files = 0;
    let committed = false;
    let rollbackFailed = false;
    try {
      await app.db.transaction(async (tx) => {
        const plannedSnapshot = await planProfileNoodleImport(
          tx,
          snapshot,
          warnings as Parameters<typeof planProfileNoodleImport>[2],
        );
        const connectionPlans = await planProfileApiConnectionImports(tx, plannedSnapshot.tables.api_connections ?? []);
        addProfileImportSecurityWarnings(warnings, buildProfileImportSecuritySummary(plannedSnapshot, connectionPlans));
        for (const tableName of FILE_BACKED_TABLES) {
          const table = profileTableObjects.get(tableName);
          const rows = plannedSnapshot.tables[tableName];
          if (!table || !Array.isArray(rows) || rows.length === 0) {
            tableCounts[tableName] = 0;
            continue;
          }

          emit("tables", `Importing ${tableName.replace(/_/g, " ")}`);
          for (const [rowIndex, row] of rows.entries()) {
            let cleanRow = { ...row };
            // A pre-rename snapshot carries `visibility`/`publicAccountId`. Inserting it raw
            // lets the column default fill `platform: "noodle"`, putting a restored NoodleR
            // account and its posts on the Noodle timeline.
            if (tableName === "noodle_accounts") cleanRow = migrateLegacyNoodleAccountRow(cleanRow);
            if (tableName === "noodle_posts") cleanRow = migrateLegacyNoodlePostAccessRow(cleanRow);
            if (tableName === "api_connections") {
              const connectionPlan = connectionPlans[rowIndex];
              if (!connectionPlan) {
                throw new ProfileImportRequestError("Profile import could not plan an imported API connection.");
              }
              cleanRow = connectionPlan.row;
            }
            if (tableName === "installed_extensions") cleanRow = quarantineProfilePersonalExtensionRow(cleanRow);
            if (tableName === "custom_tools") cleanRow = quarantineProfileCustomToolRow(cleanRow);
            if (tableName === "mari_instructions") cleanRow = quarantineProfileMariInstructionRow(cleanRow);
            if (tableName === "custom_themes") cleanRow = quarantineProfileThemeRow(cleanRow);
            const insert = tx.insert(table as any).values(cleanRow as any) as any;
            const conflictTarget = schemaPrimaryKeyColumn(table);
            if (conflictTarget) {
              // Exported secrets are redacted. The table-specific update set preserves
              // agent/tool secrets, while the connection plan above retains a credential
              // only when its provider and destination still match.
              await insert.onConflictDoUpdate({
                target: conflictTarget,
                set: buildProfileUpdateSet(tableName, cleanRow),
              });
            } else {
              await insert;
            }
            completedItems++;
            tableCounts[tableName] = (tableCounts[tableName] ?? 0) + 1;
            emit("tables", `Importing ${tableName.replace(/_/g, " ")}`);
          }
        }

        await promoteStagedProfileAssets(stagedAssets);
        for (const asset of stagedAssets.assets) {
          files++;
          completedItems++;
          emit("files", `Restoring ${asset.path}`, files);
        }
        await flushDB();
      });
      committed = true;
      if ((tableCounts.installed_extensions ?? 0) > 0) {
        await personalServerExtensionRuntime.reloadAll();
      }
      return buildProfileImportStats(tableCounts, files);
    } catch (error) {
      try {
        await rollbackPromotedProfileAssets(stagedAssets);
      } catch (rollbackError) {
        rollbackFailed = true;
        logger.error(
          rollbackError,
          "[backup] Asset rollback failed; preserving recovery files at %s",
          stagedAssets.rootDir,
        );
        throw new AggregateError([error, rollbackError], "Profile import and asset rollback both failed");
      }
      throw error;
    } finally {
      if (!rollbackFailed) {
        try {
          await cleanupStagedProfileAssets(stagedAssets);
        } catch (cleanupError) {
          if (committed) logger.warn(cleanupError, "[backup] Failed to remove profile import staging files");
        }
      }
    }
  });
}

async function buildProfileExportEnvelope(
  app: FastifyInstance,
  options: ProfileExportEnvelopeOptions = {},
): Promise<ExportEnvelope> {
  const includeFileStorage = options.includeFileStorage ?? true;
  const inlineFileData = options.inlineFileData ?? true;
  const includeLegacyAvatarBase64 = options.includeLegacyAvatarBase64 ?? true;
  const inlineJsonBudget = options.inlineJsonBudget;
  const chars = createCharactersStorage(app.db);
  const lbs = createLorebooksStorage(app.db);
  const presets = createPromptsStorage(app.db);
  const agents = createAgentsStorage(app.db);
  const themes = createThemesStorage(app.db);
  const dataDir = getDataDir();

  const allChars = await chars.list();
  const characterExports = await Promise.all(
    allChars.map(async (c: any) => {
      let avatarBase64: string | null = null;
      const avatarPath = resolveProfileExportFilePath(dataDir, c.avatarPath);
      if (includeLegacyAvatarBase64 && avatarPath && existsSync(avatarPath)) {
        avatarBase64 = await readInlineBase64File(avatarPath, inlineJsonBudget);
      }
      return { ...c, avatarBase64 };
    }),
  );

  const allPersonaRows = await chars.listPersonas();
  const allPersonas = await Promise.all(
    (allPersonaRows as any[]).map(async (p: any) => {
      let avatarBase64: string | null = null;
      const avatarPath = resolveProfileExportFilePath(dataDir, p.avatarPath);
      if (includeLegacyAvatarBase64 && avatarPath && existsSync(avatarPath)) {
        avatarBase64 = await readInlineBase64File(avatarPath, inlineJsonBudget);
      }
      return { ...p, avatarBase64 };
    }),
  );

  const allLorebooks = await lbs.list();
  const lorebookExports = await Promise.all(
    (allLorebooks as any[]).map(async (lb: any) => {
      const folders = await lbs.listFolders(lb.id);
      const entries = await lbs.listEntries(lb.id);
      return { ...lb, folders, entries };
    }),
  );

  const allPresets = await presets.list();
  const presetExports = await Promise.all(
    (allPresets as any[]).map(async (p: any) => {
      const groups = await presets.listGroups(p.id);
      const sections = await presets.listSections(p.id);
      const choices = await presets.listChoiceBlocksForPreset(p.id);
      return { ...p, groups, sections, choices };
    }),
  );

  const allAgents = (await agents.list()).map(redactAgentSecrets);
  const allThemes = await themes.list();
  const data: Record<string, unknown> = {
    characters: characterExports,
    personas: allPersonas,
    lorebooks: lorebookExports,
    presets: presetExports,
    agents: allAgents,
    themes: allThemes,
  };
  if (includeFileStorage) {
    data.fileStorage = await buildProfileStorageSnapshot(app, { inlineFileData, inlineJsonBudget });
  }

  return {
    type: "marinara_profile",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function normalizeProfileArchiveEntryPath(entryName: string) {
  return entryName.replace(/\\/g, "/").replace(/^\/+/, "");
}

function profileArchiveBasePath(profileEntryName: string) {
  const normalized = normalizeProfileArchiveEntryPath(profileEntryName);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function profileArchiveEntryPath(basePath: string, safePath: string) {
  return basePath ? `${basePath}/${safePath}` : safePath;
}

function getProfileStorageSnapshotFromEnvelope(envelope: ExportEnvelope) {
  const data = envelope.data as Record<string, unknown>;
  return isProfileStorageSnapshot(data.fileStorage) ? data.fileStorage : null;
}

type CollectProfileAssetZipSourcesOptions = {
  skipFailedFiles?: boolean;
  onSkipped?: (path: string) => void;
};

async function collectProfileAssetZipSources(
  files: ProfileFileAsset[],
  basePath = "",
  options: CollectProfileAssetZipSourcesOptions = {},
) {
  const dataDir = getDataDir();
  const sources: StoredZipEntrySource[] = [];
  let totalUncompressedBytes = 0;
  const seenEntryNames = new Set<string>();

  for (const file of files) {
    const safePath = normalizeProfileAssetPath(file.path);
    if (!safePath) continue;
    try {
      const inputPath = assertInsideDir(dataDir, join(dataDir, ...safePath.split("/")));
      if (!existsSync(inputPath)) throw new Error("file no longer exists");
      const fileStat = await stat(inputPath);
      if (!fileStat.isFile()) throw new Error("path is not a regular file");
      if (fileStat.size !== file.size) {
        throw new Error(`Profile asset changed while exporting: ${safePath}`);
      }
      const nextTotalBytes = totalUncompressedBytes + fileStat.size;
      if (nextTotalBytes > PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES) {
        throw new ProfileArchiveTooLargeError(
          profileArchiveSizeError("Profile ZIP assets", nextTotalBytes, PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES),
        );
      }
      const entryName = profileArchiveEntryPath(basePath, safePath);
      if (seenEntryNames.has(entryName)) continue;
      seenEntryNames.add(entryName);
      totalUncompressedBytes = nextTotalBytes;
      sources.push({
        entryName,
        filePath: inputPath,
        size: fileStat.size,
        mtime: fileStat.mtime,
        tolerateSourceChanges: options.skipFailedFiles,
        allowLargeStoredEntry: isLargeStoredMediaEntry(entryName),
      });
    } catch (error) {
      if (!options.skipFailedFiles) throw error;
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.warn(logError, "[backup] Omitting profile asset %s from this backup", safePath);
      options.onSkipped?.(safePath);
    }
  }

  return sources;
}

async function writeProfileTableJsonLines(outputPath: string, tableName: string, rows: Array<Record<string, unknown>>) {
  const stream = createWriteStream(outputPath, { mode: PRIVATE_FILE_MODE });
  let size = 0;
  let count = 0;
  try {
    for (const row of sanitizeProfileTableRows(tableName, rows)) {
      const line = Buffer.from(`${JSON.stringify(row)}\n`, "utf8");
      await writeZipBuffer(stream, line);
      size += line.length;
      count += 1;
    }
    await finishZipStream(stream);
    return { size, count };
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function buildProfileArchiveSources(
  app: FastifyInstance,
  basePath: string,
  workingDir: string,
  includeAssets: boolean,
  skipUnreadableAssets = false,
  onSkippedAsset?: (path: string) => void,
) {
  const skippedAssetPaths = new Set<string>();
  const tables: Record<string, ProfileArchiveTableFile> = {};
  const tableSources: StoredZipEntrySource[] = [];
  const tablesDir = join(workingDir, "profile-tables");
  await mkdir(tablesDir, { recursive: true });

  for (const tableName of FILE_BACKED_TABLES) {
    const table = profileTableObjects.get(tableName);
    if (!table) continue;
    const rows = (await app.db.select().from(table as any)) as Array<Record<string, unknown>>;
    const relativePath = `profile-tables/${tableName}.jsonl`;
    const outputPath = join(tablesDir, `${tableName}.jsonl`);
    const { size, count } = await writeProfileTableJsonLines(outputPath, tableName, rows);
    tables[tableName] = { path: relativePath, count, size };
    tableSources.push({
      entryName: profileArchiveEntryPath(basePath, relativePath),
      filePath: outputPath,
      size,
    });
  }

  const collectedFiles = await collectProfileAssetFiles(getDataDir(), {
    inlineFileData: false,
    skipUnreadableFiles: skipUnreadableAssets,
    onSkippedFile: (path) => skippedAssetPaths.add(path),
  });
  const assetSources = includeAssets
    ? await collectProfileAssetZipSources(collectedFiles, basePath, {
        skipFailedFiles: skipUnreadableAssets,
        onSkipped: (path) => skippedAssetPaths.add(path),
      })
    : [];
  const files = collectedFiles.filter((file) => !skippedAssetPaths.has(file.path));
  for (const path of skippedAssetPaths) onSkippedAsset?.(path);
  const snapshot: ProfileArchiveStorageSnapshot = { version: 2, tables, files };
  const envelope: ExportEnvelope = {
    type: "marinara_profile",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { fileStorage: snapshot },
  };
  const manifest = Buffer.from(JSON.stringify(envelope, null, 2), "utf8");
  if (manifest.length > PROFILE_IMPORT_BODY_LIMIT_BYTES) {
    throw new ProfileArchiveTooLargeError(
      profileArchiveSizeError("Profile ZIP manifest", manifest.length, PROFILE_IMPORT_BODY_LIMIT_BYTES),
    );
  }

  return [
    { entryName: profileArchiveEntryPath(basePath, "marinara-profile.json"), data: manifest },
    ...tableSources,
    ...assetSources,
  ] satisfies StoredZipEntrySource[];
}

async function writeNativeProfileZip(app: FastifyInstance, outputPath: string, skipFailedAssets = false) {
  const workingDir = await mkdtemp(join(tmpdir(), "marinara-profile-tables-"));
  try {
    // Same row/asset consistency requirement as the JSON snapshot above.
    const sources = await withOptionalNoodleAutoPostPaused(() =>
      buildProfileArchiveSources(app, "", workingDir, true, skipFailedAssets),
    );
    await writeStoredZipArchive(outputPath, sources, { skipFailedFileEntries: skipFailedAssets });
  } finally {
    await rm(workingDir, { recursive: true, force: true }).catch(() => {});
  }
}

function cleanupTempDirAfterReply(reply: FastifyReply, dirPath: string) {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    void rm(dirPath, { recursive: true, force: true }).catch((err) => {
      logger.warn(err, "[backup] Failed to remove temporary profile ZIP");
    });
  };
  reply.raw.once("finish", cleanup);
  reply.raw.once("close", cleanup);
}

async function sendNativeProfileZipExport(app: FastifyInstance, reply: FastifyReply) {
  const tempDir = await mkdtemp(join(tmpdir(), "marinara-profile-export-"));
  const archivePath = join(tempDir, "marinara-profile.zip");
  try {
    await writeNativeProfileZip(app, archivePath);
    const archiveStat = await stat(archivePath);
    cleanupTempDirAfterReply(reply, tempDir);
    return reply
      .header("Content-Disposition", `attachment; filename="marinara-profile.zip"`)
      .header("Content-Type", "application/zip")
      .header("Content-Length", archiveStat.size.toString())
      .send(createReadStream(archivePath));
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

function getProfileJsonExportLimitBytes() {
  const configured = Number(process.env.PROFILE_EXPORT_JSON_LIMIT_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : PROFILE_IMPORT_BODY_LIMIT_BYTES;
}

function estimateJsonStringLength(value: unknown, seen = new WeakSet<object>()): number {
  if (value === null || value === undefined) return 4;
  if (typeof value === "string") return value.length + 2;
  if (typeof value === "number" || typeof value === "boolean") return String(value).length;
  if (typeof value !== "object") return 2;

  if (seen.has(value)) return 2;
  seen.add(value);

  if (Array.isArray(value)) {
    return 2 + value.reduce((total, item) => total + estimateJsonStringLength(item, seen) + 1, 0);
  }

  return (
    2 +
    Object.entries(value).reduce(
      (total, [key, item]) => total + key.length + 3 + estimateJsonStringLength(item, seen) + 1,
      0,
    )
  );
}

function isJsonStringSizeError(err: unknown) {
  return (
    err instanceof RangeError &&
    /invalid string length|cannot create a string longer than|failed to allocate string/i.test(err.message)
  );
}

function sendProfileJsonTooLarge(reply: FastifyReply, estimatedBytes: number, limitBytes: number) {
  return reply.status(413).send({
    error: "Profile export is too large for JSON",
    code: PROFILE_EXPORT_JSON_TOO_LARGE_CODE,
    message: "This profile is too large for the JSON profile exporter. Export it as a profile ZIP instead.",
    fallbackFormat: "zip",
    estimatedBytes,
    limitBytes,
  });
}

async function sendNativeProfileJsonExport(app: FastifyInstance, reply: FastifyReply) {
  const limitBytes = getProfileJsonExportLimitBytes();
  const inlineJsonBudget: ProfileInlineJsonBudget = { limitBytes, estimatedBytes: 0 };
  let envelope: ExportEnvelope;
  try {
    envelope = await buildProfileExportEnvelope(app, {
      inlineFileData: true,
      includeLegacyAvatarBase64: true,
      inlineJsonBudget,
    });
  } catch (err) {
    if (err instanceof ProfileJsonTooLargeError) {
      return sendProfileJsonTooLarge(reply, err.estimatedBytes, limitBytes);
    }
    if (isJsonStringSizeError(err)) {
      return sendProfileJsonTooLarge(reply, inlineJsonBudget.estimatedBytes, limitBytes);
    }
    throw err;
  }
  const estimatedBytes = Math.ceil(estimateJsonStringLength(envelope) * 1.05);

  if (estimatedBytes > limitBytes) {
    return sendProfileJsonTooLarge(reply, estimatedBytes, limitBytes);
  }

  let body: string;
  try {
    body = JSON.stringify(envelope);
  } catch (err) {
    if (isJsonStringSizeError(err)) {
      return sendProfileJsonTooLarge(reply, estimatedBytes, limitBytes);
    }
    throw err;
  }

  const bodyBytes = Buffer.byteLength(body);
  if (bodyBytes > limitBytes) {
    return sendProfileJsonTooLarge(reply, bodyBytes, limitBytes);
  }

  return reply
    .header("Content-Type", "application/json; charset=utf-8")
    .header("Content-Disposition", `attachment; filename="marinara-profile.json"`)
    .header("Content-Length", bodyBytes.toString())
    .send(body);
}

function getZipDosTimeDate(mtime?: Date) {
  const date = mtime ?? new Date();
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  const month = Math.min(12, Math.max(1, date.getMonth() + 1));
  const day = Math.min(31, Math.max(1, date.getDate()));
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function normalizeStoredZipEntryName(entryName: string) {
  const normalized = normalizeProfileArchiveEntryPath(entryName);
  const parts = normalized.split("/").filter(Boolean);
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.endsWith("/") ||
    parts.length === 0 ||
    parts.some((part) => part === "." || part === ".." || part.includes(":"))
  ) {
    throw new Error(`Invalid profile ZIP entry name: ${entryName}`);
  }
  return parts.join("/");
}

function profileAssetPathFromArchiveEntry(entryName: string) {
  const normalized = normalizeProfileArchiveEntryPath(entryName);
  const parts = normalized.split("/").filter(Boolean);
  const rootOffset = parts[0]?.startsWith("marinara-") ? 1 : 0;
  const root = parts.slice(rootOffset).join("/");
  return normalizeProfileAssetPath(root);
}

function isLargeStoredMediaEntry(entryName: string) {
  const assetPath = profileAssetPathFromArchiveEntry(entryName);
  if (!assetPath) return false;
  const extension = extname(assetPath).toLowerCase();
  if (PROFILE_VIDEO_ASSET_PREFIXES.some((prefix) => assetPath.startsWith(prefix))) {
    return LARGE_STORED_VIDEO_EXTENSIONS.has(extension);
  }
  const isImagePath =
    assetPath.startsWith("gallery/") || PROFILE_IMAGE_ASSET_PREFIXES.some((prefix) => assetPath.startsWith(prefix));
  return isImagePath && LARGE_STORED_IMAGE_EXTENSIONS.has(extension);
}

/** Large entries stay safe to inspect when they are uncompressed files under a known backup directory. */
export function isPermittedLargeStoredBackupEntry(
  entryName: string,
  method: number,
  compressedSize: number,
  size: number,
  entryLimitBytes = PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES,
) {
  if (size <= entryLimitBytes && compressedSize <= entryLimitBytes) return true;
  if (method !== 0 || compressedSize !== size) return false;
  return isLargeStoredMediaEntry(entryName);
}

/** Testable stored-ZIP writer seam used by the backup regression without constructing a complete application DB. */
export async function writeStoredBackupArchiveForRegression(
  outputPath: string,
  sources: Array<{ entryName: string; filePath: string; size: number; tolerateSourceChanges?: boolean }>,
  options: {
    skipFailedFileEntries?: boolean;
    entryLimitBytes?: number;
    unlimitedArchiveSize?: boolean;
    forceZip64?: boolean;
  } = {},
) {
  return writeStoredZipArchive(
    outputPath,
    sources.map((source) => ({ ...source, allowLargeStoredEntry: isLargeStoredMediaEntry(source.entryName) })),
    options,
  );
}

function assertZipSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Profile ZIP ${label} exceeds the supported size limit.`);
  }
}

function writeZip64Value(buffer: Buffer, value: number, offset: number, label: string) {
  assertZipSafeInteger(value, label);
  buffer.writeBigUInt64LE(BigInt(value), offset);
}

function readZip64Value(buffer: Buffer, offset: number, label: string) {
  if (offset < 0 || offset + 8 > buffer.length) {
    throw new ProfileImportRequestError(`Profile archive ${label} has damaged ZIP64 metadata.`);
  }
  const value = buffer.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ProfileImportRequestError(`Profile archive ${label} exceeds the supported size limit.`);
  }
  return Number(value);
}

function buildZip64ExtraField(values: Array<{ value: number; label: string }>) {
  if (values.length === 0) return Buffer.alloc(0);
  const extra = Buffer.alloc(4 + values.length * 8);
  extra.writeUInt16LE(ZIP64_EXTRA_FIELD_ID, 0);
  extra.writeUInt16LE(values.length * 8, 2);
  for (const [index, item] of values.entries()) {
    writeZip64Value(extra, item.value, 4 + index * 8, item.label);
  }
  return extra;
}

async function waitForWritableDrain(stream: WriteStream) {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      stream.off("drain", onDrain);
      stream.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

async function writeZipBuffer(stream: WriteStream, buffer: Buffer) {
  if (!stream.write(buffer)) {
    await waitForWritableDrain(stream);
  }
}

function buildLocalFileHeader(record: StoredZipEntryRecord) {
  const filename = Buffer.from(record.entryName, "utf8");
  if (filename.length > 0xffff) throw new Error(`Profile ZIP entry name is too long: ${record.entryName}`);
  const usesZip64Size = record.forceZip64 || record.size >= ZIP32_MAX_VALUE;
  const extra = usesZip64Size
    ? buildZip64ExtraField([
        { value: record.size, label: `${record.entryName} size` },
        { value: record.size, label: `${record.entryName} compressed size` },
      ])
    : Buffer.alloc(0);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(usesZip64Size ? 45 : 20, 4);
  header.writeUInt16LE(record.usesDataDescriptor ? 0x0808 : 0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(record.dosTime, 10);
  header.writeUInt16LE(record.dosDate, 12);
  header.writeUInt32LE(record.usesDataDescriptor ? 0 : record.crc32, 14);
  header.writeUInt32LE(usesZip64Size ? ZIP32_MAX_VALUE : record.usesDataDescriptor ? 0 : record.size, 18);
  header.writeUInt32LE(usesZip64Size ? ZIP32_MAX_VALUE : record.usesDataDescriptor ? 0 : record.size, 22);
  header.writeUInt16LE(filename.length, 26);
  header.writeUInt16LE(extra.length, 28);
  return Buffer.concat([header, filename, extra]);
}

function buildCentralDirectoryHeader(record: StoredZipEntryRecord) {
  const filename = Buffer.from(record.entryName, "utf8");
  const usesZip64Size = record.forceZip64 || record.size >= ZIP32_MAX_VALUE;
  const usesZip64Offset = record.forceZip64 || record.localHeaderOffset >= ZIP32_MAX_VALUE;
  const extraValues: Array<{ value: number; label: string }> = [];
  if (usesZip64Size) {
    extraValues.push(
      { value: record.size, label: `${record.entryName} size` },
      { value: record.size, label: `${record.entryName} compressed size` },
    );
  }
  if (usesZip64Offset) {
    extraValues.push({ value: record.localHeaderOffset, label: `${record.entryName} offset` });
  }
  const extra = buildZip64ExtraField(extraValues);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(usesZip64Size || usesZip64Offset ? 45 : 20, 4);
  header.writeUInt16LE(usesZip64Size || usesZip64Offset ? 45 : 20, 6);
  header.writeUInt16LE(record.usesDataDescriptor ? 0x0808 : 0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(record.dosTime, 12);
  header.writeUInt16LE(record.dosDate, 14);
  header.writeUInt32LE(record.crc32, 16);
  header.writeUInt32LE(usesZip64Size ? ZIP32_MAX_VALUE : record.size, 20);
  header.writeUInt32LE(usesZip64Size ? ZIP32_MAX_VALUE : record.size, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt16LE(extra.length, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(usesZip64Offset ? ZIP32_MAX_VALUE : record.localHeaderOffset, 42);
  return Buffer.concat([header, filename, extra]);
}

function buildStoredZipDataDescriptor(record: StoredZipEntryRecord) {
  const usesZip64Size = record.forceZip64 || record.size >= ZIP32_MAX_VALUE;
  const descriptor = Buffer.alloc(usesZip64Size ? 24 : 16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(record.crc32, 4);
  if (usesZip64Size) {
    writeZip64Value(descriptor, record.size, 8, `${record.entryName} descriptor size`);
    writeZip64Value(descriptor, record.size, 16, `${record.entryName} descriptor compressed size`);
  } else {
    descriptor.writeUInt32LE(record.size, 8);
    descriptor.writeUInt32LE(record.size, 12);
  }
  return descriptor;
}

function buildEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
  zip64RecordOffset: number,
  forceZip64 = false,
) {
  const usesZip64 =
    forceZip64 ||
    entryCount >= ZIP16_MAX_VALUE ||
    centralDirectorySize >= ZIP32_MAX_VALUE ||
    centralDirectoryOffset >= ZIP32_MAX_VALUE;
  const header = Buffer.alloc(ZIP_EOCD_MIN_SIZE);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(usesZip64 ? ZIP16_MAX_VALUE : entryCount, 8);
  header.writeUInt16LE(usesZip64 ? ZIP16_MAX_VALUE : entryCount, 10);
  header.writeUInt32LE(usesZip64 ? ZIP32_MAX_VALUE : centralDirectorySize, 12);
  header.writeUInt32LE(usesZip64 ? ZIP32_MAX_VALUE : centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  if (!usesZip64) return header;

  const zip64End = Buffer.alloc(ZIP64_EOCD_MIN_SIZE);
  zip64End.writeUInt32LE(ZIP64_EOCD_SIGNATURE, 0);
  writeZip64Value(zip64End, ZIP64_EOCD_MIN_SIZE - 12, 4, "ZIP64 end record size");
  zip64End.writeUInt16LE(45, 12);
  zip64End.writeUInt16LE(45, 14);
  zip64End.writeUInt32LE(0, 16);
  zip64End.writeUInt32LE(0, 20);
  writeZip64Value(zip64End, entryCount, 24, "ZIP64 entries on disk");
  writeZip64Value(zip64End, entryCount, 32, "ZIP64 entry count");
  writeZip64Value(zip64End, centralDirectorySize, 40, "ZIP64 central directory size");
  writeZip64Value(zip64End, centralDirectoryOffset, 48, "ZIP64 central directory offset");

  const locator = Buffer.alloc(ZIP64_EOCD_LOCATOR_SIZE);
  locator.writeUInt32LE(ZIP64_EOCD_LOCATOR_SIGNATURE, 0);
  locator.writeUInt32LE(0, 4);
  writeZip64Value(locator, zip64RecordOffset, 8, "ZIP64 end record offset");
  locator.writeUInt32LE(1, 16);
  return Buffer.concat([zip64End, locator, header]);
}

async function writeStoredZipFileEntry(
  output: FileHandle,
  source: StoredZipEntrySource,
  position: number,
  entryLimitBytes: number,
  skipFailedFileEntries: boolean,
  forceZip64: boolean,
  onOmittedEntry?: (entryName: string) => void,
): Promise<{ record: StoredZipEntryRecord; position: number } | null> {
  const fileSource = "filePath" in source ? source : null;
  const tolerateSourceChanges = fileSource?.tolerateSourceChanges === true;
  const entryStart = position;
  let entryName = source.entryName;
  let sourceHandle: FileHandle | null = null;
  try {
    entryName = normalizeStoredZipEntryName(source.entryName);
    const sourceData = "data" in source ? source.data : "buildData" in source ? source.buildData() : null;
    let sourceMtime = source.mtime;
    if (tolerateSourceChanges) {
      sourceHandle = await open(fileSource!.filePath, "r");
      const currentStat = await sourceHandle.stat();
      if (!currentStat.isFile()) throw new Error(`Profile ZIP source is not a regular file: ${entryName}`);
      if (currentStat.size !== fileSource!.size) {
        throw new Error(`Profile ZIP source changed while exporting: ${entryName}`);
      }
      assertZipSafeInteger(currentStat.size, `${entryName} size`);
      if (currentStat.size > entryLimitBytes) {
        throw new ProfileArchiveTooLargeError(profileArchiveSizeError(entryName, currentStat.size, entryLimitBytes));
      }
      sourceMtime = currentStat.mtime;
    }

    const { dosTime, dosDate } = getZipDosTimeDate(sourceMtime);
    const size = sourceData ? sourceData.length : fileSource!.size;
    assertZipSafeInteger(size, `${entryName} size`);
    if (size > entryLimitBytes) {
      throw new ProfileArchiveTooLargeError(profileArchiveSizeError(entryName, size, entryLimitBytes));
    }
    assertZipSafeInteger(position, `${entryName} offset`);

    const crc32 = sourceData ? crc32Buffer(sourceData) : 0;
    const record: StoredZipEntryRecord = {
      entryName,
      crc32,
      size,
      localHeaderOffset: position,
      dosTime,
      dosDate,
      usesDataDescriptor: tolerateSourceChanges,
      forceZip64,
    };
    const header = buildLocalFileHeader(record);
    position = await writeZipFileBuffer(output, header, position);

    if (sourceData) {
      position = await writeZipFileBuffer(output, sourceData, position);
    } else if (sourceHandle) {
      let crcState = 0xffffffff;
      let written = 0;
      for await (const chunk of sourceHandle.createReadStream({ autoClose: false })) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (written + buffer.length > entryLimitBytes) {
          throw new ProfileArchiveTooLargeError(
            profileArchiveSizeError(entryName, written + buffer.length, entryLimitBytes),
          );
        }
        position = await writeZipFileBuffer(output, buffer, position);
        crcState = updateCrc32State(crcState, buffer);
        written += buffer.length;
      }
      record.crc32 = finishCrc32(crcState);
      record.size = written;
      if (record.size !== fileSource!.size) {
        throw new Error(`Profile ZIP source changed while exporting: ${entryName}`);
      }
      assertZipSafeInteger(record.size, `${entryName} size`);
      assertZipSafeInteger(position, `${entryName} offset`);
      const descriptor = buildStoredZipDataDescriptor(record);
      position = await writeZipFileBuffer(output, descriptor, position);
    } else {
      let crcState = 0xffffffff;
      let written = 0;
      for await (const chunk of createReadStream(fileSource!.filePath)) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        if (written + buffer.length > entryLimitBytes) {
          throw new ProfileArchiveTooLargeError(
            profileArchiveSizeError(entryName, written + buffer.length, entryLimitBytes),
          );
        }
        position = await writeZipFileBuffer(output, buffer, position);
        crcState = updateCrc32State(crcState, buffer);
        written += buffer.length;
      }
      if (written !== fileSource!.size) {
        throw new Error(`Profile ZIP source changed while exporting: ${entryName}`);
      }
      record.crc32 = finishCrc32(crcState);
      record.size = written;
      const localHeaderCrc = Buffer.alloc(4);
      localHeaderCrc.writeUInt32LE(record.crc32, 0);
      await writeZipFileBuffer(output, localHeaderCrc, entryStart + 14);
    }

    return { record, position };
  } catch (error) {
    if (!tolerateSourceChanges || !skipFailedFileEntries) throw error;
    await output.truncate(entryStart);
    const reason = error instanceof Error ? error.message : String(error);
    const logError = error instanceof Error ? error : new Error(reason);
    logger.warn(logError, "[backup] Skipping ZIP source %s because it could not be archived", entryName);
    onOmittedEntry?.(entryName);
    return null;
  } finally {
    await sourceHandle?.close().catch(() => {});
  }
}

async function writeZipFileBuffer(handle: FileHandle, buffer: Buffer, position: number) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset, position + offset);
    if (bytesWritten === 0) throw new Error("Profile ZIP output stopped accepting data.");
    offset += bytesWritten;
  }
  return position + buffer.length;
}

async function finishZipStream(stream: WriteStream) {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      stream.off("finish", onFinish);
      reject(err);
    };
    const onFinish = () => {
      stream.off("error", onError);
      resolve();
    };
    stream.once("error", onError);
    stream.once("finish", onFinish);
    stream.end();
  });
}

async function writeStoredZipArchive(
  outputPath: string,
  sources: StoredZipEntrySource[],
  options: {
    skipFailedFileEntries?: boolean;
    entryLimitBytes?: number;
    onOmittedEntry?: (entryName: string) => void;
    unlimitedArchiveSize?: boolean;
    forceZip64?: boolean;
  } = {},
) {
  const output = await open(outputPath, "w", PRIVATE_FILE_MODE);
  const records: StoredZipEntryRecord[] = [];
  const omittedEntries: string[] = [];
  const recordOmission = (entryName: string) => {
    omittedEntries.push(entryName);
    options.onOmittedEntry?.(entryName);
  };
  let position = 0;
  let totalUncompressedBytes = 0;
  let centralDirectorySizeEstimate = 0;
  const archiveLimitBytes = options.unlimitedArchiveSize ? Number.MAX_SAFE_INTEGER : PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES;
  const totalLimitBytes = options.unlimitedArchiveSize
    ? Number.MAX_SAFE_INTEGER
    : PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES;

  try {
    for (const source of sources) {
      const entryStart = position;
      const canSkip =
        options.skipFailedFileEntries === true && "filePath" in source && source.tolerateSourceChanges === true;
      const ordinaryEntryLimit = options.entryLimitBytes ?? PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES;
      const normalEntryLimit =
        "filePath" in source && source.allowLargeStoredEntry === true
          ? options.unlimitedArchiveSize
            ? Number.MAX_SAFE_INTEGER
            : ZIP32_MAX_VALUE
          : ordinaryEntryLimit;
      const remainingContentBytes = totalLimitBytes - totalUncompressedBytes;
      let normalizedEntryName: string;
      try {
        normalizedEntryName = normalizeStoredZipEntryName(source.entryName);
      } catch (error) {
        if (!canSkip) throw error;
        const logError = error instanceof Error ? error : new Error(String(error));
        logger.warn(logError, "[backup] Omitting ZIP source %s because its entry name is unusable", source.entryName);
        recordOmission(source.entryName);
        continue;
      }
      const filenameBytes = Buffer.byteLength(normalizedEntryName, "utf8");
      const usesDataDescriptor = "filePath" in source && source.tolerateSourceChanges === true;
      const forceZip64 = options.forceZip64 === true;
      const localExtraBytes = forceZip64 ? 20 : 0;
      const descriptorBytes = usesDataDescriptor ? (forceZip64 ? 24 : 16) : 0;
      const centralExtraBytes = forceZip64 ? 28 : 0;
      const endBytes = forceZip64
        ? ZIP64_EOCD_MIN_SIZE + ZIP64_EOCD_LOCATOR_SIZE + ZIP_EOCD_MIN_SIZE
        : ZIP_EOCD_MIN_SIZE;
      const remainingArchiveBytes =
        archiveLimitBytes -
        position -
        (30 + filenameBytes) -
        localExtraBytes -
        descriptorBytes -
        centralDirectorySizeEstimate -
        (46 + filenameBytes) -
        centralExtraBytes -
        endBytes;
      const entryLimit = Math.max(0, Math.min(normalEntryLimit, remainingContentBytes, remainingArchiveBytes));
      const result = await writeStoredZipFileEntry(
        output,
        source,
        position,
        entryLimit,
        options.skipFailedFileEntries === true,
        forceZip64,
        recordOmission,
      );
      if (!result) continue;
      const centralHeaderSize = buildCentralDirectoryHeader(result.record).length;
      const nextTotalBytes = totalUncompressedBytes + result.record.size;
      const nextCentralDirectorySize = centralDirectorySizeEstimate + centralHeaderSize;
      if (nextTotalBytes > totalLimitBytes) {
        const failure = profileArchiveSizeError("Profile ZIP contents", nextTotalBytes, totalLimitBytes);
        await output.truncate(entryStart);
        if (!canSkip) throw new ProfileArchiveTooLargeError(failure);
        logger.warn("[backup] Skipping ZIP source %s: %s", result.record.entryName, failure);
        recordOmission(result.record.entryName);
        continue;
      }
      if (result.position + nextCentralDirectorySize + endBytes > archiveLimitBytes) {
        await output.truncate(entryStart);
        throw new ProfileArchiveTooLargeError(
          profileArchiveSizeError(
            "Profile archive",
            result.position + nextCentralDirectorySize + endBytes,
            archiveLimitBytes,
          ),
        );
      }
      if (nextCentralDirectorySize > PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES) {
        await output.truncate(entryStart);
        throw new ProfileArchiveTooLargeError(
          profileArchiveSizeError(
            "Profile archive central directory",
            nextCentralDirectorySize,
            PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES,
          ),
        );
      }
      records.push(result.record);
      totalUncompressedBytes = nextTotalBytes;
      centralDirectorySizeEstimate = nextCentralDirectorySize;
      position = result.position;
    }

    const centralDirectoryOffset = position;
    assertZipSafeInteger(centralDirectoryOffset, "central directory offset");
    for (const record of records) {
      const header = buildCentralDirectoryHeader(record);
      position = await writeZipFileBuffer(output, header, position);
    }
    const centralDirectorySize = position - centralDirectoryOffset;
    assertZipSafeInteger(centralDirectorySize, "central directory size");
    if (centralDirectorySize > PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES) {
      throw new ProfileArchiveTooLargeError(
        profileArchiveSizeError(
          "Profile archive central directory",
          centralDirectorySize,
          PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES,
        ),
      );
    }
    const end = buildEndOfCentralDirectory(
      records.length,
      centralDirectorySize,
      centralDirectoryOffset,
      position,
      options.forceZip64 === true,
    );
    if (position + end.length > archiveLimitBytes) {
      throw new ProfileArchiveTooLargeError(
        profileArchiveSizeError("Profile archive", position + end.length, archiveLimitBytes),
      );
    }
    await writeZipFileBuffer(output, end, position);
    return { omittedEntries };
  } finally {
    await output.close();
  }
}

async function readProfileZipBytes(handle: FileHandle, buffer: Buffer, position: number, label: string) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, position + offset);
    if (bytesRead === 0) {
      throw new ProfileImportRequestError(`Profile archive ${label} ended unexpectedly.`);
    }
    offset += bytesRead;
  }
}

async function readProfileArchiveFileRange(filePath: string, position: number, length: number, label: string) {
  if (!Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(length) || length < 0) {
    throw new ProfileImportRequestError(`Profile archive ${label} has an invalid offset.`);
  }
  if (length > PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES) {
    throw new ProfileImportRequestError(profileArchiveSizeError(label, length, PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES));
  }
  const buffer = Buffer.alloc(length);
  if (length === 0) return buffer;
  const handle = await open(filePath, "r");
  try {
    await readProfileZipBytes(handle, buffer, position, label);
    return buffer;
  } finally {
    await handle.close();
  }
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let offset = buffer.length - ZIP_EOCD_MIN_SIZE; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) !== ZIP_EOCD_SIGNATURE) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + ZIP_EOCD_MIN_SIZE + commentLength === buffer.length) return offset;
  }
  return -1;
}

function checkedZipSum(left: number, right: number, label: string) {
  if (!Number.isSafeInteger(left) || left < 0 || !Number.isSafeInteger(right) || right < 0) {
    throw new ProfileImportRequestError(`Profile archive ${label} has an invalid size.`);
  }
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new ProfileImportRequestError(`Profile archive ${label} exceeds the supported size limit.`);
  }
  return total;
}

function readZip64ExtraValues(
  extra: Buffer,
  needs: { size: boolean; compressedSize: boolean; localHeaderOffset: boolean },
) {
  let zip64: Buffer | null = null;
  let offset = 0;
  while (offset < extra.length) {
    if (offset + 4 > extra.length) {
      throw new ProfileImportRequestError("Profile archive central directory extra data is damaged.");
    }
    const id = extra.readUInt16LE(offset);
    const length = extra.readUInt16LE(offset + 2);
    const end = offset + 4 + length;
    if (end > extra.length) {
      throw new ProfileImportRequestError("Profile archive central directory extra data is damaged.");
    }
    if (id === ZIP64_EXTRA_FIELD_ID) {
      if (zip64) throw new ProfileImportRequestError("Profile archive contains duplicate ZIP64 entry metadata.");
      zip64 = extra.subarray(offset + 4, end);
    }
    offset = end;
  }

  if (!needs.size && !needs.compressedSize && !needs.localHeaderOffset) return {};
  if (!zip64) throw new ProfileImportRequestError("Profile archive entry is missing ZIP64 metadata.");
  let valueOffset = 0;
  const values: { size?: number; compressedSize?: number; localHeaderOffset?: number } = {};
  const take = (label: string) => {
    const value = readZip64Value(zip64!, valueOffset, label);
    valueOffset += 8;
    return value;
  };
  if (needs.size) values.size = take("entry size");
  if (needs.compressedSize) values.compressedSize = take("entry compressed size");
  if (needs.localHeaderOffset) values.localHeaderOffset = take("entry offset");
  return values;
}

async function readZipDirectoryMetadata(
  handle: FileHandle,
  archiveSize: number,
  eocdSearch: Buffer,
  eocdOffset: number,
) {
  const eocdAbsoluteOffset = archiveSize - eocdSearch.length + eocdOffset;
  const diskNumber = eocdSearch.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = eocdSearch.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk32 = eocdSearch.readUInt16LE(eocdOffset + 8);
  const totalEntries32 = eocdSearch.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize32 = eocdSearch.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset32 = eocdSearch.readUInt32LE(eocdOffset + 16);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk32 !== totalEntries32) {
    throw new ProfileImportRequestError("Profile archive split ZIP files are not supported.");
  }

  const usesZip64 =
    totalEntries32 === ZIP16_MAX_VALUE ||
    centralDirectorySize32 === ZIP32_MAX_VALUE ||
    centralDirectoryOffset32 === ZIP32_MAX_VALUE;
  if (!usesZip64) {
    return {
      totalEntries: totalEntries32,
      centralDirectorySize: centralDirectorySize32,
      centralDirectoryOffset: centralDirectoryOffset32,
    };
  }

  const locatorOffset = eocdAbsoluteOffset - ZIP64_EOCD_LOCATOR_SIZE;
  if (locatorOffset < 0) throw new ProfileImportRequestError("Profile archive is missing its ZIP64 locator.");
  const locator = Buffer.alloc(ZIP64_EOCD_LOCATOR_SIZE);
  await readProfileZipBytes(handle, locator, locatorOffset, "ZIP64 locator");
  if (
    locator.readUInt32LE(0) !== ZIP64_EOCD_LOCATOR_SIGNATURE ||
    locator.readUInt32LE(4) !== 0 ||
    locator.readUInt32LE(16) !== 1
  ) {
    throw new ProfileImportRequestError("Profile archive ZIP64 locator is damaged or split across disks.");
  }
  const zip64EndOffset = readZip64Value(locator, 8, "ZIP64 end record offset");
  if (checkedZipSum(zip64EndOffset, ZIP64_EOCD_MIN_SIZE, "ZIP64 end record") > locatorOffset) {
    throw new ProfileImportRequestError("Profile archive ZIP64 end record is outside the ZIP file.");
  }
  const zip64End = Buffer.alloc(ZIP64_EOCD_MIN_SIZE);
  await readProfileZipBytes(handle, zip64End, zip64EndOffset, "ZIP64 end record");
  if (zip64End.readUInt32LE(0) !== ZIP64_EOCD_SIGNATURE) {
    throw new ProfileImportRequestError("Profile archive ZIP64 end record is damaged.");
  }
  const zip64RecordSize = readZip64Value(zip64End, 4, "ZIP64 end record size");
  if (zip64RecordSize < ZIP64_EOCD_MIN_SIZE - 12) {
    throw new ProfileImportRequestError("Profile archive ZIP64 end record is too short.");
  }
  if (zip64End.readUInt32LE(16) !== 0 || zip64End.readUInt32LE(20) !== 0) {
    throw new ProfileImportRequestError("Profile archive split ZIP files are not supported.");
  }
  const entriesOnDisk = readZip64Value(zip64End, 24, "ZIP64 entries on disk");
  const totalEntries = readZip64Value(zip64End, 32, "ZIP64 entry count");
  if (entriesOnDisk !== totalEntries) {
    throw new ProfileImportRequestError("Profile archive split ZIP files are not supported.");
  }
  return {
    totalEntries,
    centralDirectorySize: readZip64Value(zip64End, 40, "ZIP64 central directory size"),
    centralDirectoryOffset: readZip64Value(zip64End, 48, "ZIP64 central directory offset"),
  };
}

function isStoredFullBackupArchive(entries: ProfileZipEntry[], archiveSize: number) {
  const profileEntries = entries.filter(
    (entry) => !entry.isDirectory && entry.entryName.endsWith("/marinara-profile.json"),
  );
  if (profileEntries.length !== 1 || entries.some((entry) => entry.entryName === "marinara-profile.json")) return false;
  const profileEntry = profileEntries[0];
  if (!profileEntry) return false;
  const basePath = profileArchiveBasePath(profileEntry.entryName);
  if (!/^marinara-(?:automatic-backup|backup-[A-Za-z0-9_-]+)$/u.test(basePath)) return false;
  if (!entries.some((entry) => !entry.isDirectory && entry.entryName === `${basePath}/RESTORE.txt`)) return false;
  if (entries.some((entry) => entry.entryName !== basePath && !entry.entryName.startsWith(`${basePath}/`)))
    return false;

  let totalStoredBytes = 0;
  const ranges: Array<{ start: number; end: number }> = [];
  for (const entry of entries) {
    const { method, compressedSize, size, dataOffset } = entry.header;
    if (method !== 0 || compressedSize !== size) return false;
    totalStoredBytes = checkedZipSum(totalStoredBytes, size, "stored backup contents");
    if (totalStoredBytes > archiveSize) return false;
    if (size > 0) ranges.push({ start: dataOffset, end: checkedZipSum(dataOffset, size, entry.entryName) });
  }
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index++) {
    const current = ranges[index];
    const previous = ranges[index - 1];
    if (current && previous && current.start < previous.end) return false;
  }
  return true;
}

async function readProfileZipArchive(filePath: string): Promise<ProfileZipArchive> {
  const archiveStat = await stat(filePath);
  if (archiveStat.size < ZIP_EOCD_MIN_SIZE) {
    throw new ProfileImportRequestError("Profile archive is not a valid ZIP file.");
  }

  const handle = await open(filePath, "r");
  try {
    const eocdSearchLength = Math.min(archiveStat.size, ZIP_EOCD_MIN_SIZE + ZIP_EOCD_MAX_COMMENT_BYTES);
    const eocdSearch = Buffer.alloc(eocdSearchLength);
    await readProfileZipBytes(handle, eocdSearch, archiveStat.size - eocdSearchLength, "end record");

    const eocdOffset = findEndOfCentralDirectory(eocdSearch);
    if (eocdOffset < 0) {
      throw new ProfileImportRequestError("Profile archive is missing a ZIP end record.");
    }

    const { totalEntries, centralDirectorySize, centralDirectoryOffset } = await readZipDirectoryMetadata(
      handle,
      archiveStat.size,
      eocdSearch,
      eocdOffset,
    );
    if (centralDirectorySize > PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES) {
      throw new ProfileImportRequestError(
        profileArchiveSizeError(
          "Profile archive central directory",
          centralDirectorySize,
          PROFILE_ARCHIVE_CENTRAL_DIRECTORY_LIMIT_BYTES,
        ),
      );
    }
    if (checkedZipSum(centralDirectoryOffset, centralDirectorySize, "central directory") > archiveStat.size) {
      throw new ProfileImportRequestError("Profile archive central directory is outside the ZIP file.");
    }

    const centralDirectory = Buffer.alloc(centralDirectorySize);
    await readProfileZipBytes(handle, centralDirectory, centralDirectoryOffset, "central directory");

    const entries: ProfileZipEntry[] = [];
    const entriesByName = new Map<string, ProfileZipEntry>();
    let offset = 0;
    let totalUncompressedBytes = 0;
    for (let index = 0; index < totalEntries; index++) {
      if (
        offset + 46 > centralDirectory.length ||
        centralDirectory.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
      ) {
        throw new ProfileImportRequestError("Profile archive central directory is damaged.");
      }

      const flags = centralDirectory.readUInt16LE(offset + 8);
      if ((flags & ZIP_ENCRYPTED_FLAG) !== 0) {
        throw new ProfileImportRequestError("Profile archive encrypted ZIP entries are not supported.");
      }
      const method = centralDirectory.readUInt16LE(offset + 10);
      const crc32 = centralDirectory.readUInt32LE(offset + 16);
      const compressedSize32 = centralDirectory.readUInt32LE(offset + 20);
      const size32 = centralDirectory.readUInt32LE(offset + 24);
      const fileNameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const entryDisk = centralDirectory.readUInt16LE(offset + 34);
      if (entryDisk !== 0) throw new ProfileImportRequestError("Profile archive split ZIP files are not supported.");
      const localHeaderOffset32 = centralDirectory.readUInt32LE(offset + 42);
      const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
      if (nextOffset > centralDirectory.length) {
        throw new ProfileImportRequestError("Profile archive central directory entry is damaged.");
      }
      const entryName = centralDirectory.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
      const normalizedName = normalizeProfileArchiveEntryPath(entryName);
      const extraStart = offset + 46 + fileNameLength;
      const zip64Values = readZip64ExtraValues(centralDirectory.subarray(extraStart, extraStart + extraLength), {
        size: size32 === ZIP32_MAX_VALUE,
        compressedSize: compressedSize32 === ZIP32_MAX_VALUE,
        localHeaderOffset: localHeaderOffset32 === ZIP32_MAX_VALUE,
      });
      const size = zip64Values.size ?? size32;
      const compressedSize = zip64Values.compressedSize ?? compressedSize32;
      const localHeaderOffset = zip64Values.localHeaderOffset ?? localHeaderOffset32;
      totalUncompressedBytes = checkedZipSum(totalUncompressedBytes, size, "contents");

      if (checkedZipSum(localHeaderOffset, 30, "local file header") > archiveStat.size) {
        throw new ProfileImportRequestError("Profile archive entry points outside the ZIP file.");
      }
      const localHeader = Buffer.alloc(30);
      await readProfileZipBytes(handle, localHeader, localHeaderOffset, "local file header");
      if (localHeader.readUInt32LE(0) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
        throw new ProfileImportRequestError("Profile archive local file header is damaged.");
      }
      const localFileNameLength = localHeader.readUInt16LE(26);
      const localExtraLength = localHeader.readUInt16LE(28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      if (
        !Number.isSafeInteger(dataOffset) ||
        dataOffset < 0 ||
        checkedZipSum(dataOffset, compressedSize, normalizedName || "entry data") > centralDirectoryOffset
      ) {
        throw new ProfileImportRequestError("Profile archive entry data is outside the ZIP file.");
      }

      const entry: ProfileZipEntry = {
        entryName: normalizedName,
        isDirectory: normalizedName.endsWith("/"),
        header: { method, crc32, compressedSize, size, dataOffset },
      };
      entries.push(entry);
      if (normalizedName && !entriesByName.has(normalizedName)) entriesByName.set(normalizedName, entry);
      offset = nextOffset;
    }

    if (offset !== centralDirectory.length) {
      throw new ProfileImportRequestError("Profile archive central directory has unexpected trailing data.");
    }

    const isFullBackup = isStoredFullBackupArchive(entries, archiveStat.size);
    if (!isFullBackup) {
      if (archiveStat.size > PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES) {
        throw new ProfileImportArchiveTooLargeError(
          profileArchiveSizeError("Profile archive", archiveStat.size, PROFILE_IMPORT_ARCHIVE_LIMIT_BYTES),
        );
      }
      assertProfileArchiveTotalLimit(totalUncompressedBytes, "Profile archive contents");
      for (const entry of entries) {
        const { method, compressedSize, size } = entry.header;
        if (!isPermittedLargeStoredBackupEntry(entry.entryName, method, compressedSize, size)) {
          throw new ProfileImportRequestError(
            profileArchiveSizeError(
              "Profile archive entry",
              Math.max(compressedSize, size),
              PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES,
            ),
          );
        }
      }
    }
    return { filePath, entries, entriesByName, isFullBackup };
  } finally {
    await handle.close();
  }
}

/** Test seam for ZIP64/full-backup classification without exposing archive internals to routes. */
export async function inspectStoredBackupArchiveForRegression(filePath: string) {
  const zip = await readProfileZipArchive(filePath);
  return {
    isFullBackup: zip.isFullBackup,
    entries: zip.entries.map((entry) => ({
      entryName: entry.entryName,
      compressedSize: entry.header.compressedSize,
      size: entry.header.size,
      dataOffset: entry.header.dataOffset,
    })),
  };
}

/** Test seam for proving that a production-written large media member can pass the production ZIP reader. */
export async function readStoredBackupAssetForRegression(
  filePath: string,
  entryName: string,
  entryLimitBytes = PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES,
) {
  const zip = await readProfileZipArchive(filePath);
  const entry = getProfileZipEntry(zip, entryName);
  if (!entry || entry.isDirectory) throw new Error(`Backup ZIP is missing ${entryName}`);
  const compressedSize = getZipEntryCompressedSize(entry);
  const size = getZipEntryUncompressedSize(entry);
  if (compressedSize === null || size === null) throw new Error("Backup ZIP entry has an invalid size");
  if (entry.header.method === 0 && compressedSize !== size) {
    throw new Error(`Backup ZIP stored entry size does not match: ${entryName}`);
  }
  if (!isPermittedLargeStoredBackupEntry(entry.entryName, entry.header.method, compressedSize, size, entryLimitBytes)) {
    throw new Error(`Backup ZIP entry is not a permitted stored media asset: ${entryName}`);
  }
  return {
    expectedSize: size,
    read: () => ({
      stream: createReadStream(zip.filePath, {
        start: entry.header.dataOffset,
        end: entry.header.dataOffset + size - 1,
      }),
      expectedCrc32: entry.header.crc32,
    }),
  };
}

function getProfileZipEntry(zip: ProfileZipArchive, entryName: string) {
  return zip.entriesByName.get(normalizeProfileArchiveEntryPath(entryName));
}

async function readProfileArchiveTableRows(
  zip: ProfileZipArchive,
  entry: ProfileZipEntry,
  descriptor: ProfileArchiveTableFile,
  tableName: string,
) {
  const compressedSize = getZipEntryCompressedSize(entry);
  const uncompressedSize = getZipEntryUncompressedSize(entry);
  if (compressedSize === null || uncompressedSize === null || entry.header.method !== 0) {
    throw new ProfileImportRequestError(`Profile table ${tableName} is not a supported stored JSONL entry.`);
  }
  if (uncompressedSize !== descriptor.size || compressedSize !== descriptor.size) {
    throw new ProfileImportRequestError(`Profile table ${tableName} does not match its manifest size.`);
  }
  if (uncompressedSize > PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES) {
    throw new ProfileImportRequestError(
      profileArchiveSizeError(
        `Profile table ${tableName}`,
        uncompressedSize,
        PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES,
      ),
    );
  }
  if (descriptor.size === 0) {
    if (descriptor.count !== 0 || entry.header.crc32 !== crc32Buffer(Buffer.alloc(0))) {
      throw new ProfileImportRequestError(`Profile table ${tableName} failed archive integrity checks.`);
    }
    return [];
  }

  const rows: Array<Record<string, unknown>> = [];
  const stream = createReadStream(zip.filePath, {
    start: entry.header.dataOffset,
    end: entry.header.dataOffset + compressedSize - 1,
  });
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let crcState = 0xffffffff;
  let bytesRead = 0;

  const parseLine = (line: string) => {
    if (!line.trim()) return;
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      throw new ProfileImportRequestError(`Profile table ${tableName} contains invalid JSONL.`);
    }
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new ProfileImportRequestError(`Profile table ${tableName} contains an invalid row.`);
    }
    rows.push(row as Record<string, unknown>);
  };

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    crcState = updateCrc32State(crcState, buffer);
    bytesRead += buffer.length;
    pending += decoder.write(buffer);
    let newlineIndex = pending.indexOf("\n");
    while (newlineIndex >= 0) {
      parseLine(pending.slice(0, newlineIndex));
      pending = pending.slice(newlineIndex + 1);
      newlineIndex = pending.indexOf("\n");
    }
    if (Buffer.byteLength(pending, "utf8") > PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES) {
      throw new ProfileImportRequestError(`Profile table ${tableName} contains an oversized row.`);
    }
  }
  pending += decoder.end();
  parseLine(pending);

  if (bytesRead !== descriptor.size || finishCrc32(crcState) !== entry.header.crc32) {
    throw new ProfileImportRequestError(`Profile table ${tableName} failed archive integrity checks.`);
  }
  if (rows.length !== descriptor.count) {
    throw new ProfileImportRequestError(`Profile table ${tableName} does not match its manifest row count.`);
  }
  return rows;
}

async function hydrateProfileArchiveStorageSnapshot(
  zip: ProfileZipArchive,
  basePath: string,
  envelope: ExportEnvelope,
) {
  const data = envelope.data as Record<string, unknown>;
  const archiveSnapshot = data.fileStorage;
  if (!isProfileArchiveStorageSnapshot(archiveSnapshot)) return;

  const tables: ProfileTableSnapshots = {};
  let memoryWarningLogged = false;
  for (const tableName of FILE_BACKED_TABLES) {
    const descriptor = archiveSnapshot.tables[tableName];
    if (!descriptor) {
      tables[tableName] = [];
      continue;
    }
    const expectedPath = `profile-tables/${tableName}.jsonl`;
    if (
      descriptor.path !== expectedPath ||
      !Number.isSafeInteger(descriptor.count) ||
      descriptor.count < 0 ||
      !Number.isSafeInteger(descriptor.size) ||
      descriptor.size < 0
    ) {
      throw new ProfileImportRequestError(`Profile table ${tableName} has an invalid archive manifest.`);
    }
    const entry = getProfileZipEntry(zip, profileArchiveEntryPath(basePath, expectedPath));
    if (!entry || entry.isDirectory) {
      throw new ProfileImportRequestError(`Profile archive is missing table ${tableName}.`);
    }
    const rows = await readProfileArchiveTableRows(zip, entry, descriptor, tableName);
    tables[tableName] = rows;
    const memoryUsage = process.memoryUsage();
    const heapMiB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
    const rssMiB = Math.round(memoryUsage.rss / (1024 * 1024));
    logger.debug(
      "[backup] Hydrated profile table %s (%d rows); heap=%d MiB, rss=%d MiB",
      tableName,
      rows.length,
      heapMiB,
      rssMiB,
    );
    // Hydration currently re-materializes tables; retain peak visibility until imports can consume table streams.
    if (
      !memoryWarningLogged &&
      Math.max(memoryUsage.heapUsed, memoryUsage.rss) >= PROFILE_IMPORT_MEMORY_WARNING_BYTES
    ) {
      memoryWarningLogged = true;
      logger.warn(
        "[backup] Profile import hydration exceeded 512 MiB after table %s; heap=%d MiB, rss=%d MiB",
        tableName,
        heapMiB,
        rssMiB,
      );
    }
  }

  data.fileStorage = {
    version: 1,
    tables,
    files: Array.isArray(archiveSnapshot.files) ? archiveSnapshot.files : [],
  } satisfies ProfileStorageSnapshot;
}

async function readProfileEnvelopeFromArchive(zip: ProfileZipArchive) {
  const profileEntry =
    zip.entries.find((entry) => !entry.isDirectory && entry.entryName === "marinara-profile.json") ??
    zip.entries.find((entry) => !entry.isDirectory && entry.entryName.endsWith("/marinara-profile.json"));

  if (!profileEntry) {
    const sampleEntries = zip.entries
      .filter((entry) => !entry.isDirectory)
      .slice(0, 8)
      .map((entry) => entry.entryName)
      .join(", ");
    throw new ProfileImportRequestError(
      [
        "Profile archive is missing marinara-profile.json.",
        "Select a Marinara profile export or a full backup ZIP downloaded from Settings -> Advanced -> Backups.",
        sampleEntries ? `This ZIP starts with: ${sampleEntries}` : "This ZIP did not contain any readable files.",
      ].join(" "),
    );
  }

  try {
    const profileEntrySize = getZipEntryUncompressedSize(profileEntry);
    if (profileEntrySize === null || profileEntrySize > PROFILE_IMPORT_BODY_LIMIT_BYTES) {
      throw new ProfileImportRequestError(
        profileArchiveSizeError(
          "Profile archive marinara-profile.json",
          profileEntrySize ?? -1,
          PROFILE_IMPORT_BODY_LIMIT_BYTES,
        ),
      );
    }
    const profileBuffer = await readProfileArchiveEntryBuffer(zip, profileEntry, profileEntrySize);
    const envelope = JSON.parse(profileBuffer.toString("utf8")) as ExportEnvelope;
    const basePath = profileArchiveBasePath(profileEntry.entryName);
    await hydrateProfileArchiveStorageSnapshot(zip, basePath, envelope);
    return { envelope, basePath };
  } catch (err) {
    if (err instanceof ProfileImportRequestError) throw err;
    throw new ProfileImportRequestError("Profile archive contains an unreadable marinara-profile.json.");
  }
}

async function readProfileArchiveEntryBuffer(zip: ProfileZipArchive, entry: ProfileZipEntry, expectedSize: number) {
  const compressedSize = getZipEntryCompressedSize(entry);
  const uncompressedSize = getZipEntryUncompressedSize(entry);
  if (compressedSize === null || uncompressedSize === null) {
    throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} has an invalid size header.`);
  }
  if (compressedSize > PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES || uncompressedSize > PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES) {
    throw new ProfileImportRequestError(
      profileArchiveSizeError(
        entry.entryName,
        Math.max(compressedSize, uncompressedSize),
        PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES,
      ),
    );
  }
  if (uncompressedSize !== expectedSize) {
    throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} does not match its manifest size.`);
  }

  const compressed = await readProfileArchiveFileRange(
    zip.filePath,
    entry.header.dataOffset,
    compressedSize,
    entry.entryName,
  );
  let data: Buffer;
  if (entry.header.method === 0) {
    data = compressed;
  } else if (entry.header.method === 8) {
    try {
      data = inflateRawSync(compressed, { maxOutputLength: expectedSize });
    } catch {
      throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} could not be decompressed.`);
    }
  } else {
    throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} uses an unsupported ZIP method.`);
  }
  if (data.length !== expectedSize) {
    throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} does not match its manifest size.`);
  }
  if (crc32Buffer(data) !== entry.header.crc32) {
    throw new ProfileImportRequestError(`Profile archive entry ${entry.entryName} failed CRC check.`);
  }
  return data;
}

function validateProfileArchiveAssets(
  zip: ProfileZipArchive,
  basePath: string,
  envelope: ExportEnvelope,
  warnings: ProfileImportWarning[],
) {
  const snapshot = getProfileStorageSnapshotFromEnvelope(envelope);
  const assets: ProfileArchiveAssetIndex = new Map();
  if (!snapshot || !Array.isArray(snapshot.files)) return assets;

  let totalUncompressedBytes = 0;
  for (const file of snapshot.files) {
    if (typeof file?.data === "string") continue;
    const safePath = normalizeProfileAssetPath(file?.path);
    if (!safePath) continue;
    const entryName = profileArchiveEntryPath(basePath, safePath);
    const expectedSize = getProfileAssetManifestSize(file, safePath);
    const entry = getProfileZipEntry(zip, entryName);
    if (!entry || entry.isDirectory) {
      warnings.push({
        type: "missing_asset",
        path: safePath,
        message: `Profile archive is missing ${safePath}. Imported the rest of the profile without that asset.`,
      });
      continue;
    }
    const entrySize = getZipEntryUncompressedSize(entry);
    if (entrySize === null || entrySize !== expectedSize) {
      throw new ProfileImportRequestError(`Profile archive asset ${safePath} does not match its manifest size.`);
    }
    const compressedSize = getZipEntryCompressedSize(entry);
    if (
      compressedSize === null ||
      (!zip.isFullBackup &&
        !isPermittedLargeStoredBackupEntry(entryName, entry.header.method, compressedSize, expectedSize))
    ) {
      throw new ProfileImportRequestError(
        profileArchiveSizeError(safePath, compressedSize ?? -1, PROFILE_ARCHIVE_ENTRY_LIMIT_BYTES),
      );
    }
    totalUncompressedBytes = checkedZipSum(totalUncompressedBytes, expectedSize, "restored assets");
    if (!zip.isFullBackup) assertProfileArchiveTotalLimit(totalUncompressedBytes);
    assets.set(safePath, { entryName, expectedSize });
  }
  return assets;
}

async function readProfileArchiveAsset(
  zip: ProfileZipArchive,
  archiveAssets: ProfileArchiveAssetIndex,
  safePath: string,
) {
  const normalized = normalizeProfileAssetPath(safePath);
  if (!normalized) return null;
  const asset = archiveAssets.get(normalized);
  if (!asset) return null;
  const entry = getProfileZipEntry(zip, asset.entryName);
  if (!entry || entry.isDirectory) return null;
  if (entry.header.method === 0) {
    const compressedSize = getZipEntryCompressedSize(entry);
    if (compressedSize === null || compressedSize !== asset.expectedSize) {
      throw new ProfileImportRequestError(`Profile archive asset ${safePath} does not match its stored entry size.`);
    }
    if (asset.expectedSize === 0) return Buffer.alloc(0);
    return {
      stream: createReadStream(zip.filePath, {
        start: entry.header.dataOffset,
        end: entry.header.dataOffset + asset.expectedSize - 1,
      }),
      expectedCrc32: entry.header.crc32,
    } satisfies ProfileImportAssetStream;
  }
  return readProfileArchiveEntryBuffer(zip, entry, asset.expectedSize);
}

async function readProfileImportRequest(req: FastifyRequest): Promise<ProfileImportInput> {
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    const envelope = req.body as ExportEnvelope;
    return { envelope, fileFingerprint: profileEnvelopeFingerprint(envelope) };
  }

  const uploadDir = await mkdtemp(join(tmpdir(), "marinara-profile-import-"));
  const archivePath = join(uploadDir, "profile.zip");
  try {
    // Full backups are streamed to disk before inspection. Their stored-only ZIP layout is
    // physically bounded, so the production reader can safely recognize archives above 2 GiB.
    const file = await req.file({ limits: { fileSize: Number.MAX_SAFE_INTEGER } });
    if (!file) throw new ProfileImportRequestError("No profile archive uploaded.");
    const fileStream = file.file as typeof file.file & { truncated?: boolean };
    await pipeline(fileStream, createWriteStream(archivePath));
    if (fileStream.truncated) throw new ProfileImportRequestError("Profile archive upload was truncated.");
    const zip = await readProfileZipArchive(archivePath);
    const { envelope, basePath } = await readProfileEnvelopeFromArchive(zip);
    const warnings: ProfileImportWarning[] = [];
    const archiveAssets = validateProfileArchiveAssets(zip, basePath, envelope, warnings);
    const fingerprint = await fileFingerprint(archivePath);
    return {
      envelope,
      readAsset: (safePath) => readProfileArchiveAsset(zip, archiveAssets, safePath),
      warnings,
      cleanup: () => rm(uploadDir, { recursive: true, force: true }),
      fileFingerprint: fingerprint,
      assetTotalByteLimit: zip.isFullBackup ? Number.MAX_SAFE_INTEGER : PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES,
    };
  } catch (err) {
    await rm(uploadDir, { recursive: true, force: true }).catch(() => {});
    if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      throw new ProfileImportRequestError("Profile archive upload was truncated.");
    }
    if (err instanceof ProfileImportRequestError) throw err;
    throw new ProfileImportRequestError(getBackupErrorMessage(err, "Profile archive could not be read."));
  }
}

/** Production-reader seam for proving that a full backup remains loadable by profile import. */
export async function readStoredBackupImportForRegression(filePath: string, safePath: string) {
  const zip = await readProfileZipArchive(filePath);
  const { envelope, basePath } = await readProfileEnvelopeFromArchive(zip);
  const warnings: ProfileImportWarning[] = [];
  const archiveAssets = validateProfileArchiveAssets(zip, basePath, envelope, warnings);
  return {
    isFullBackup: zip.isFullBackup,
    envelope,
    warnings,
    asset: await readProfileArchiveAsset(zip, archiveAssets, safePath),
    assetTotalByteLimit: zip.isFullBackup ? Number.MAX_SAFE_INTEGER : PROFILE_ARCHIVE_TOTAL_UNCOMPRESSED_LIMIT_BYTES,
  };
}

export function buildBackupRestoreNotes(omittedEntries: readonly string[] = []) {
  const lines = [
    "Marinara Engine backup",
    "",
    "This archive contains a raw filesystem backup for manual recovery.",
    "Treat it as sensitive: full backups include local secret material such as .encryption-key when that file exists.",
    "Restore .encryption-key together with the storage files to keep saved API keys decryptable.",
    "If this install used an ENCRYPTION_KEY environment variable instead of a persisted key file, restore that environment variable separately.",
    "",
    "For one-click import inside Marinara:",
    "1. Open Settings -> Import.",
    "2. Use Import Profile and select the downloaded backup zip archive.",
    "3. Keep the ZIP intact so its streamed table shards and assets remain available to the importer.",
    "",
    "The .marinara.json importer is for individual characters, personas, lorebooks, and presets.",
  ];
  if (omittedEntries.length > 0) {
    lines.push(
      "",
      "Warning: this backup completed without the following files because they could not be archived:",
      ...omittedEntries.map((entryName) => `- ${JSON.stringify(entryName)}`),
    );
  }
  return lines.join("\n");
}

async function copyPersistedEncryptionKey(dataDir: string, backupDir: string) {
  const keyPath = resolvePersistedEncryptionKeyPath(dataDir);
  if (!existsSync(keyPath)) return;
  const destination = join(backupDir, ENCRYPTION_KEY_FILENAME);
  await copyFile(keyPath, destination);
  if (process.platform !== "win32") await chmod(destination, PRIVATE_FILE_MODE);
}

async function collectDirectoryZipSources(
  sourceDir: string,
  entryRoot: string,
  options: { skipUnreadableFiles?: boolean; onSkippedEntry?: (entryName: string) => void } = {},
) {
  const sources: StoredZipEntrySource[] = [];
  if (!existsSync(sourceDir)) return sources;
  const stack = [sourceDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: Dirent[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (!options.skipUnreadableFiles) throw error;
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.warn(logError, "[backup] Skipping unreadable ZIP source directory: %s", current);
      const relativePath = relative(sourceDir, current).split(/[\\/]/g).join("/");
      options.onSkippedEntry?.([entryRoot, relativePath].filter(Boolean).join("/"));
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = relative(sourceDir, fullPath).split(/[\\/]/g).join("/");
      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(fullPath);
      } catch (error) {
        if (!options.skipUnreadableFiles) throw error;
        const reason = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          reason,
          "[backup] Skipping unreadable ZIP source during collection: %s/%s",
          entryRoot,
          relativePath,
        );
        options.onSkippedEntry?.(`${entryRoot}/${relativePath}`);
        continue;
      }
      const entryName = `${entryRoot}/${relativePath}`;
      sources.push({
        entryName,
        filePath: fullPath,
        size: fileStat.size,
        mtime: fileStat.mtime,
        tolerateSourceChanges: true,
        allowLargeStoredEntry: isLargeStoredMediaEntry(entryName),
      });
    }
  }
  return sources;
}

async function writeFullBackupArchive(
  app: FastifyInstance,
  outputPath: string,
  backupName: string,
  workingDir: string,
) {
  const dataDir = getDataDir();
  const omittedEntries = new Set<string>();
  const filesystemSources: StoredZipEntrySource[] = [];
  for (const dirName of BACKUP_DIRS) {
    const sourceDir = resolveBackupDir(dataDir, dirName);
    filesystemSources.push(
      ...(await collectDirectoryZipSources(sourceDir, `${backupName}/${dirName}`, {
        skipUnreadableFiles: true,
        onSkippedEntry: (entryName) => omittedEntries.add(entryName),
      })),
    );
  }

  // Capture the manifest after filesystem source sizes so a later change makes
  // the writer omit that source instead of creating a manifest-size mismatch.
  const sources = await withOptionalNoodleAutoPostPaused(() =>
    buildProfileArchiveSources(app, backupName, workingDir, false, true, (path) =>
      omittedEntries.add(profileArchiveEntryPath(backupName, path)),
    ),
  );
  sources.push(...filesystemSources);

  const keyPath = resolvePersistedEncryptionKeyPath(dataDir);
  if (existsSync(keyPath)) {
    try {
      const keyStat = await stat(keyPath);
      sources.push({
        entryName: `${backupName}/${ENCRYPTION_KEY_FILENAME}`,
        filePath: keyPath,
        size: keyStat.size,
        mtime: keyStat.mtime,
        tolerateSourceChanges: true,
      });
    } catch (error) {
      const logError = error instanceof Error ? error : new Error(String(error));
      logger.warn(logError, "[backup] Omitting unreadable encryption key from this backup");
      omittedEntries.add(`${backupName}/${ENCRYPTION_KEY_FILENAME}`);
    }
  }

  // Keep this deferred note last so it sees every omission discovered while earlier sources are written.
  sources.push({
    entryName: `${backupName}/RESTORE.txt`,
    buildData: () => Buffer.from(buildBackupRestoreNotes([...omittedEntries]), "utf8"),
  });
  await writeStoredZipArchive(outputPath, sources, {
    skipFailedFileEntries: true,
    entryLimitBytes: Number.MAX_SAFE_INTEGER,
    unlimitedArchiveSize: true,
    onOmittedEntry: (entryName) => omittedEntries.add(entryName),
  });
  return { omittedEntries: [...omittedEntries] };
}

async function writeAutomaticBackup(app: FastifyInstance, retentionCount: number) {
  await flushDB();
  const backupsRoot = getBackupsRoot();
  const workingDir = await mkdtemp(join(tmpdir(), "marinara-automatic-backup-"));
  const pendingPath = join(backupsRoot, `${AUTOMATIC_BACKUP_FILENAME}.pending`);
  const finalPath = join(backupsRoot, AUTOMATIC_BACKUP_FILENAME);
  const legacyPreviousPath = join(backupsRoot, `${AUTOMATIC_BACKUP_FILENAME}.previous`);
  let archivedPreviousPath: string | null = null;
  try {
    await mkdir(backupsRoot, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    await hardenPrivateBackupTree(backupsRoot);
    await rm(pendingPath, { force: true });
    if (!existsSync(finalPath) && existsSync(legacyPreviousPath)) {
      await rename(legacyPreviousPath, finalPath);
    } else {
      await rm(legacyPreviousPath, { force: true });
    }
    const { omittedEntries } = await writeFullBackupArchive(app, pendingPath, "marinara-automatic-backup", workingDir);
    const hadPreviousBackup = existsSync(finalPath);
    try {
      if (hadPreviousBackup) {
        const previousStat = await stat(finalPath);
        archivedPreviousPath = join(
          backupsRoot,
          automaticBackupArchiveFilename(previousStat.mtime, randomUUID().slice(0, 8)),
        );
        await rename(finalPath, archivedPreviousPath);
      }
      await rename(pendingPath, finalPath);
    } catch (error) {
      if (hadPreviousBackup && archivedPreviousPath && !existsSync(finalPath) && existsSync(archivedPreviousPath)) {
        await rename(archivedPreviousPath, finalPath).catch(() => {});
      }
      throw error;
    }
    return {
      removedBackups: await pruneAutomaticBackupFiles(backupsRoot, retentionCount),
      omittedEntries,
    };
  } finally {
    await rm(pendingPath, { force: true }).catch(() => {});
    await rm(workingDir, { recursive: true, force: true }).catch(() => {});
  }
}

function getBackupErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

function sendBackupRouteError(reply: FastifyReply, err: unknown, operation: string) {
  const message = getBackupErrorMessage(err, `${operation} failed. Check the server logs for details.`);
  const logError = err instanceof Error ? err : new Error(message);
  logger.error(logError, "[backup] %s failed", operation);
  return reply.status(500).send({
    error: `${operation} failed`,
    message,
  });
}

export async function backupRoutes(app: FastifyInstance) {
  await hardenPrivateBackupTree(getBackupsRoot());
  const automaticBackupStorage = createAppSettingsStorage(app.db);
  let automaticBackupRunning = false;
  type BackupDownloadJob = {
    status: "preparing" | "ready" | "failed";
    backupName: string;
    tempDir: string;
    archivePath: string;
    createdAt: number;
    completedAt?: number;
    stallWarningIssued?: boolean;
    workPromise?: Promise<void>;
    size?: number;
    omittedCount?: number;
    error?: string;
    downloadToken: string;
  };
  const backupDownloadJobs = new Map<string, BackupDownloadJob>();
  let activeBackupDownloadJobId: string | null = null;
  const removeBackupDownloadJob = async (jobId: string) => {
    const job = backupDownloadJobs.get(jobId);
    if (job?.status === "preparing") return;
    backupDownloadJobs.delete(jobId);
    if (job) await rm(job.tempDir, { recursive: true, force: true }).catch(() => {});
  };
  const backupDownloadCleanupTimer = setInterval(
    () => {
      const cutoff = Date.now() - 60 * 60 * 1_000;
      for (const [jobId, job] of backupDownloadJobs) {
        if (job.status === "preparing") {
          if (job.createdAt < cutoff && !job.stallWarningIssued) {
            job.stallWarningIssued = true;
            logger.warn("[backup] Asynchronous backup download job %s is still preparing after one hour", jobId);
          }
          continue;
        }
        if ((job.completedAt ?? job.createdAt) < cutoff) void removeBackupDownloadJob(jobId);
      }
    },
    5 * 60 * 1_000,
  );
  backupDownloadCleanupTimer.unref();
  app.addHook("onClose", async () => {
    clearInterval(backupDownloadCleanupTimer);
    await Promise.allSettled(
      [...backupDownloadJobs.values()].flatMap((job) => (job.workPromise ? [job.workPromise] : [])),
    );
    await Promise.all([...backupDownloadJobs.keys()].map(removeBackupDownloadJob));
  });

  const loadAutomaticBackupSettings = async () => {
    const raw = await automaticBackupStorage.get(AUTOMATIC_BACKUP_SETTINGS_KEY);
    if (!raw) return normalizeAutomaticBackupSettings(null);
    try {
      return normalizeAutomaticBackupSettings(JSON.parse(raw));
    } catch {
      return normalizeAutomaticBackupSettings(null);
    }
  };
  const saveAutomaticBackupSettings = (settings: AutomaticBackupSettings) =>
    automaticBackupStorage.set(
      AUTOMATIC_BACKUP_SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        lastOmittedEntries: limitAutomaticBackupOmissionHistory(settings.lastOmittedEntries),
      }),
    );
  const automaticBackupResponse = async (settings: AutomaticBackupSettings) => ({
    ...settings,
    nextBackupAt: automaticBackupNextAt(settings),
    backupExists: await automaticBackupExists(getBackupsRoot()),
  });
  const runAutomaticBackupIfDue = async (force = false) => {
    if (automaticBackupRunning) return;
    automaticBackupRunning = true;
    try {
      const settings = await loadAutomaticBackupSettings();
      if (!settings.enabled) return;
      const lastBackupMs = settings.lastBackupAt ? Date.parse(settings.lastBackupAt) : Number.NaN;
      const due =
        force ||
        !Number.isFinite(lastBackupMs) ||
        Date.now() - lastBackupMs >= automaticBackupPeriodMs(settings.frequency);
      if (!due) return;

      const { removedBackups, omittedEntries } = await withAutomaticBackupLifecycleLock(() =>
        writeAutomaticBackup(app, settings.retentionCount),
      );
      const current = await loadAutomaticBackupSettings();
      await saveAutomaticBackupSettings({
        ...current,
        lastBackupAt: new Date().toISOString(),
        lastError: null,
        lastOmittedEntries: omittedEntries,
      });
      if (omittedEntries.length > 0) {
        logger.warn(
          "[backup] Automatic backup completed with %d omitted file(s); see RESTORE.txt in the archive",
          omittedEntries.length,
        );
      }
      logger.info("[backup] Automatic backup completed; pruned %d expired automatic archive(s)", removedBackups.length);
    } catch (error) {
      const current = await loadAutomaticBackupSettings();
      const message = getBackupErrorMessage(error, "Automatic backup failed");
      await saveAutomaticBackupSettings({ ...current, lastError: message });
      logger.error(error, "[backup] Automatic backup failed");
    } finally {
      automaticBackupRunning = false;
    }
  };

  app.get("/automatic", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Automatic backup settings" })) return;
    return automaticBackupResponse(await loadAutomaticBackupSettings());
  });

  app.put<{
    Body: { enabled?: unknown; frequency?: unknown; retentionCount?: unknown };
  }>("/automatic", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Automatic backup settings" })) return;
    const parsedRetentionCount =
      req.body?.retentionCount === undefined ? undefined : parseAutomaticBackupRetentionCount(req.body.retentionCount);
    if (
      typeof req.body?.enabled !== "boolean" ||
      !["daily", "weekly", "monthly"].includes(String(req.body?.frequency)) ||
      parsedRetentionCount === null
    ) {
      return reply.status(400).send({ error: "Invalid automatic backup settings" });
    }
    const current = await loadAutomaticBackupSettings();
    const next = normalizeAutomaticBackupSettings({
      ...current,
      enabled: req.body.enabled,
      frequency: req.body.frequency,
      retentionCount: parsedRetentionCount ?? current.retentionCount,
      lastError: null,
      lastOmittedEntries: [],
    });
    await saveAutomaticBackupSettings(next);
    const backupsRoot = getBackupsRoot();
    const removedBackups = await withAutomaticBackupLifecycleLock(() =>
      pruneAutomaticBackupFiles(backupsRoot, next.retentionCount),
    );
    if (removedBackups.length > 0) {
      logger.info(
        "[backup] Automatic backup retention changed; pruned %d expired automatic archive(s)",
        removedBackups.length,
      );
    }
    if (next.enabled) {
      const hasAutomaticBackup = await automaticBackupExists(backupsRoot);
      queueMicrotask(() => void runAutomaticBackupIfDue(!current.enabled || !hasAutomaticBackup));
    }
    return automaticBackupResponse(next);
  });

  const automaticBackupTimer = setInterval(() => void runAutomaticBackupIfDue(), AUTOMATIC_BACKUP_CHECK_INTERVAL_MS);
  automaticBackupTimer.unref();
  queueMicrotask(() => void runAutomaticBackupIfDue());
  app.addHook("onClose", async () => {
    clearInterval(automaticBackupTimer);
  });

  // Create a full backup folder
  app.post("/", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Backup creation" })) return;
    try {
      await flushDB();
      const dataDir = getDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
      const backupName = `marinara-backup-${timestamp}`;
      const backupsRoot = join(dataDir, "backups");
      const backupDir = join(backupsRoot, backupName);

      await mkdir(backupDir, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
      await writeNativeProfileZip(app, join(backupDir, "marinara-profile.zip"), true);
      await writeFile(join(backupDir, "RESTORE.txt"), buildBackupRestoreNotes(), {
        encoding: "utf8",
        mode: PRIVATE_FILE_MODE,
      });

      await copyPersistedEncryptionKey(dataDir, backupDir);

      // Copy data directories.
      for (const dirName of BACKUP_DIRS) {
        const src = resolveBackupDir(dataDir, dirName);
        if (existsSync(src)) {
          await cp(src, join(backupDir, dirName), { recursive: true });
        }
      }

      await hardenPrivateBackupTree(backupDir);

      return reply.send({
        success: true,
        backupName,
      });
    } catch (err) {
      return sendBackupRouteError(reply, err, "Backup creation");
    }
  });

  // Download a full backup as a single zip — client-side saves to a
  // user-chosen location via the browser's Save dialog / File System Access
  // API. Preferred on Android where the on-disk data folder isn't reachable.
  app.post("/download", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Backup download" })) return;
    let tempDir: string | null = null;
    try {
      await flushDB();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
      const backupName = `marinara-backup-${timestamp}`;
      tempDir = await mkdtemp(join(tmpdir(), "marinara-backup-download-"));
      const archivePath = join(tempDir, `${backupName}.zip`);
      const { omittedEntries } = await writeFullBackupArchive(app, archivePath, backupName, tempDir);
      const archiveStat = await stat(archivePath);
      cleanupTempDirAfterReply(reply, tempDir);
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${backupName}.zip"`)
        .header("Content-Length", archiveStat.size.toString())
        .header("X-Marinara-Backup-Omitted-Count", omittedEntries.length.toString())
        .send(createReadStream(archivePath));
    } catch (err) {
      if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return sendBackupRouteError(reply, err, "Backup download");
    }
  });

  // Safari can terminate a request that receives no response bytes while a
  // large archive is being assembled. Start that work asynchronously and let
  // the client poll short status requests before opening the finished stream.
  app.post("/download/start", { config: { rateLimit: BACKUP_RATE_LIMIT } }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Backup download" })) return;
    if (activeBackupDownloadJobId) {
      const activeJob = backupDownloadJobs.get(activeBackupDownloadJobId);
      if (activeJob) {
        return reply.status(202).send({ jobId: activeBackupDownloadJobId, status: activeJob.status });
      }
      return reply.status(409).send({ error: "A backup download is already being prepared" });
    }
    const jobId = randomUUID();
    activeBackupDownloadJobId = jobId;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const backupName = `marinara-backup-${timestamp}`;
    let tempDir: string;
    try {
      tempDir = await mkdtemp(join(tmpdir(), "marinara-backup-download-"));
    } catch (error) {
      activeBackupDownloadJobId = null;
      throw error;
    }
    const archivePath = join(tempDir, `${backupName}.zip`);
    const job: BackupDownloadJob = {
      status: "preparing",
      backupName,
      tempDir,
      archivePath,
      createdAt: Date.now(),
      downloadToken: randomBytes(32).toString("base64url"),
    };
    backupDownloadJobs.set(jobId, job);

    job.workPromise = (async () => {
      try {
        await flushDB();
        const { omittedEntries } = await writeFullBackupArchive(app, archivePath, backupName, tempDir);
        const archiveStat = await stat(archivePath);
        job.status = "ready";
        job.completedAt = Date.now();
        job.size = archiveStat.size;
        job.omittedCount = omittedEntries.length;
      } catch (error) {
        job.status = "failed";
        job.completedAt = Date.now();
        job.error = getBackupErrorMessage(error, "Backup download failed");
        logger.error(error, "[backup] Asynchronous backup download failed");
      } finally {
        if (activeBackupDownloadJobId === jobId) activeBackupDownloadJobId = null;
      }
    })();
    void job.workPromise;

    return reply.status(202).send({ jobId, status: job.status });
  });

  app.get<{ Params: { jobId: string } }>(
    "/download/status/:jobId",
    { config: { rateLimit: BACKUP_RATE_LIMIT } },
    async (req, reply) => {
      if (!requirePrivilegedAccess(req, reply, { feature: "Backup download" })) return;
      const job = backupDownloadJobs.get(req.params.jobId);
      if (!job) return reply.status(404).send({ error: "Backup download job not found or expired" });
      return reply.send({
        status: job.status,
        filename: `${job.backupName}.zip`,
        ...(job.status === "ready"
          ? {
              size: job.size,
              omittedCount: job.omittedCount ?? 0,
              downloadUrl: buildPreparedBackupDownloadUrl(req.params.jobId, job.downloadToken),
            }
          : {}),
        ...(job.status === "failed" ? { error: job.error ?? "Backup download failed" } : {}),
      });
    },
  );

  app.get<{ Params: { jobId: string }; Querystring: { token?: string } }>(
    "/download/file/:jobId",
    { exposeHeadRoute: false, config: { rateLimit: BACKUP_RATE_LIMIT } },
    async (req, reply) => {
      const jobId = req.params.jobId;
      const job = backupDownloadJobs.get(jobId);
      const oneTimeCapabilityAuthorized = job
        ? isPreparedBackupDownloadTokenValid(job.downloadToken, req.query.token)
        : false;
      if (!requirePrivilegedAccess(req, reply, { feature: "Backup download", oneTimeCapabilityAuthorized })) return;
      if (!job) return reply.status(404).send({ error: "Backup download job not found or expired" });
      if (job.status === "failed") return reply.status(500).send({ error: job.error ?? "Backup download failed" });
      if (job.status !== "ready" || job.size === undefined) {
        return reply.status(409).send({ error: "Backup is still being prepared" });
      }
      backupDownloadJobs.delete(jobId);
      cleanupTempDirAfterReply(reply, job.tempDir);
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${job.backupName}.zip"`)
        .header("Content-Length", job.size.toString())
        .header("X-Marinara-Backup-Omitted-Count", String(job.omittedCount ?? 0))
        .send(createReadStream(job.archivePath));
    },
  );

  // List existing backups
  app.get("/", async () => {
    const backupsRoot = getBackupsRoot();
    if (!existsSync(backupsRoot)) return [];

    return readdirSync(backupsRoot)
      .filter((name) => {
        const p = join(backupsRoot, name);
        return statSync(p).isDirectory() && name.startsWith("marinara-backup-");
      })
      .map((name) => {
        const p = join(backupsRoot, name);
        const st = statSync(p);
        return { name, createdAt: st.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  // Delete a backup
  app.delete<{ Params: { name: string } }>("/:name", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Backup deletion" })) return;
    const { name } = req.params;
    // Sanitize: only allow backup folder names
    if (!/^marinara-backup-[\w-]+$/.test(name)) {
      return reply.status(400).send({ error: "Invalid backup name" });
    }
    const backupsRoot = getBackupsRoot();
    const backupDir = join(backupsRoot, name);

    if (!existsSync(backupDir)) {
      return reply.status(404).send({ error: "Backup not found" });
    }

    // Remove recursively
    const { rm } = await import("fs/promises");
    await rm(backupDir, { recursive: true, force: true });

    return { success: true };
  });

  // ── Profile Export ──
  // Native keeps the original profile JSON shape; ZIP is offered when JSON gets too large.
  app.get<{ Querystring: { format?: ExportFormat } }>("/export-profile", async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Profile export" })) return;

    try {
      if (req.query.format === "compatible") {
        const zip = await buildCompatibleProfileZip(app);
        const buffer = zip.toBuffer();
        return reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="marinara-compatible-export.zip"`)
          .header("Content-Length", buffer.length.toString())
          .send(buffer);
      }

      if (req.query.format === "zip") {
        return await sendNativeProfileZipExport(app, reply);
      }

      return await sendNativeProfileJsonExport(app, reply);
    } catch (err) {
      if (err instanceof ProfileArchiveTooLargeError) {
        return reply.status(413).send({
          error: "Profile ZIP export is too large",
          message: err.message,
        });
      }
      return sendBackupRouteError(reply, err, "Profile export");
    }
  });

  // ── Profile Import ──
  // Accepts a profile JSON envelope or profile ZIP archive and creates all entities.
  app.post("/import-profile", { bodyLimit: PROFILE_IMPORT_BODY_LIMIT_BYTES }, async (req, reply) => {
    if (!requirePrivilegedAccess(req, reply, { feature: "Profile import" })) return;

    const wantsProgressStream = String(req.headers.accept ?? "").includes("text/event-stream");
    const previewOnly = (req.query as { preview?: unknown } | undefined)?.preview === "true";
    const expectedFingerprint =
      typeof req.headers["x-profile-preview-fingerprint"] === "string"
        ? req.headers["x-profile-preview-fingerprint"].trim()
        : "";
    let importInput: ProfileImportInput;
    try {
      importInput = await readProfileImportRequest(req);
    } catch (err) {
      if (err instanceof ProfileImportRequestError) {
        return sendProfileImportRequestError(reply, err);
      }
      const message = err instanceof Error ? err.message : "Profile import file could not be read.";
      return reply.status(400).send({ error: "Invalid profile export", message });
    }

    try {
      const envelope = importInput.envelope;
      if (!envelope || envelope.type !== "marinara_profile" || envelope.version !== 1) {
        return reply.status(400).send({ error: "Invalid profile export" });
      }

      const data = envelope.data as Record<string, any>;
      const warnings = importInput.warnings ?? [];
      const profileStoragePreviewStats = isProfileStorageSnapshot(data.fileStorage)
        ? previewProfileStorageSnapshotStats(data.fileStorage, importInput.readAsset, warnings)
        : null;
      if (previewOnly && isProfileStorageSnapshot(data.fileStorage)) {
        await planProfileNoodleImport(
          app.db,
          data.fileStorage,
          warnings as Parameters<typeof planProfileNoodleImport>[2],
        );
        await addProfileStoragePreviewSecurityWarnings(app.db, data.fileStorage, warnings);
      }
      if (!previewOnly && expectedFingerprint && importInput.fileFingerprint !== expectedFingerprint) {
        return reply.status(409).send({
          error: "Profile file changed",
          code: "PROFILE_FILE_CHANGED_AFTER_PREVIEW",
          message: "Profile file changed after preview. Select the file again before importing.",
          expectedFingerprint,
          actualFingerprint: importInput.fileFingerprint,
        });
      }
      const totalItems = isProfileStorageSnapshot(data.fileStorage)
        ? Math.max(1, countProfileStorageSnapshotItems(data.fileStorage))
        : Math.max(1, countLegacyProfileImportItems(data));

      if (previewOnly) {
        const imported = profileStoragePreviewStats ?? previewLegacyProfileImportStats(data, warnings);
        return {
          success: true,
          preview: true,
          imported,
          warnings,
          fileFingerprint: importInput.fileFingerprint,
          totalItems,
        };
      }

      const sendEvent = (event: { type: string; data?: unknown; [key: string]: unknown }) => {
        if (wantsProgressStream && !reply.raw.destroyed) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };
      const sendProgress = (progress: ProfileImportProgress) => {
        sendEvent({ type: "progress", data: progress });
      };

      if (wantsProgressStream) {
        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        sendEvent({
          type: "started",
          data: {
            label: "Profile import started",
            totalItems,
          },
        });
      }

      try {
        if (isProfileStorageSnapshot(data.fileStorage)) {
          const imported = await importProfileStorageSnapshot(
            app,
            data.fileStorage,
            warnings,
            wantsProgressStream ? sendProgress : undefined,
            importInput.readAsset,
            importInput.assetTotalByteLimit,
          );
          const payload = { success: true, imported, warnings };
          if (wantsProgressStream) {
            sendEvent({ type: "done", data: payload });
            reply.raw.end();
            return;
          }
          return payload;
        }

        const chars = createCharactersStorage(app.db);
        const lbs = createLorebooksStorage(app.db);
        const presets = createPromptsStorage(app.db);
        const agents = createAgentsStorage(app.db);
        const themes = createThemesStorage(app.db);

        const stats = { characters: 0, personas: 0, lorebooks: 0, presets: 0, agents: 0, themes: 0 };
        addLegacyProfileThemeSecurityWarning(data, warnings);
        let completedItems = 0;
        const emitLegacyProgress = (phase: string, label: string) => {
          if (!wantsProgressStream) return;
          sendProgress({
            phase,
            label,
            completedItems,
            totalItems,
            imported: { ...stats },
          });
        };

        // Import characters
        if (Array.isArray(data.characters)) {
          for (const c of data.characters) {
            try {
              emitLegacyProgress("characters", "Importing characters");
              const charData = typeof c.data === "string" ? JSON.parse(c.data) : c.data;
              const result = await chars.create(
                charData,
                c.avatarPath ?? undefined,
                normalizeTimestampOverrides({ createdAt: c.createdAt, updatedAt: c.updatedAt }),
                typeof c.comment === "string" ? c.comment : undefined,
              );
              // Restore avatar from base64 if provided
              if (c.avatarBase64 && result?.avatarPath) {
                const dataDir = getDataDir();
                const avatarDir = join(dataDir, "avatars");
                await mkdir(avatarDir, { recursive: true });
                const { writeFile } = await import("fs/promises");
                const avatarFile = resolveAvatarWritePath(dataDir, result.avatarPath);
                if (avatarFile) {
                  await writeFile(avatarFile, Buffer.from(c.avatarBase64, "base64"));
                }
              }
              stats.characters++;
            } catch {
              /* skip failed entries */
            }
            completedItems++;
            emitLegacyProgress("characters", "Importing characters");
          }
        }

        // Import personas
        if (Array.isArray(data.personas)) {
          for (const p of data.personas) {
            try {
              emitLegacyProgress("personas", "Importing personas");
              const created = await chars.createPersona(
                p.name,
                p.description ?? "",
                undefined,
                {
                  comment: p.comment,
                  creator: p.creator,
                  personaVersion: p.personaVersion,
                  versioningEnabled:
                    p.versioningEnabled === false || p.versioningEnabled === "false" ? "false" : "true",
                  creatorNotes: p.creatorNotes,
                  phoneticName: typeof p.phoneticName === "string" ? p.phoneticName : "",
                  personality: p.personality,
                  backstory: p.backstory,
                  appearance: p.appearance,
                  scenario: p.scenario,
                  nameColor: p.nameColor,
                  dialogueColor: p.dialogueColor,
                  boxColor: p.boxColor,
                  trackerCardColors:
                    typeof p.trackerCardColors === "string"
                      ? p.trackerCardColors
                      : JSON.stringify(p.trackerCardColors ?? { mode: "chat" }),
                  personaStats: p.personaStats,
                  tags: typeof p.tags === "string" ? p.tags : JSON.stringify(p.tags ?? []),
                  savedStatusOptions:
                    typeof p.savedStatusOptions === "string"
                      ? p.savedStatusOptions
                      : JSON.stringify(p.savedStatusOptions ?? []),
                  convoDisplayName: typeof p.convoDisplayName === "string" ? p.convoDisplayName : "",
                  aboutMe: typeof p.aboutMe === "string" ? p.aboutMe : "",
                  convoBehavior: typeof p.convoBehavior === "string" ? p.convoBehavior : "",
                  avatarCrop: typeof p.avatarCrop === "string" ? p.avatarCrop : JSON.stringify(p.avatarCrop ?? null),
                },
                normalizeTimestampOverrides({ createdAt: p.createdAt, updatedAt: p.updatedAt }),
              );
              stats.personas++;

              if (created && p.avatarBase64) {
                let avatarFile: string | null = null;
                try {
                  const dataDir = getDataDir();
                  const avatarDir = join(dataDir, "avatars");
                  await mkdir(avatarDir, { recursive: true });
                  const avatarName = `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                  const avatarPath = `avatars/${avatarName}`;
                  avatarFile = assertInsideDir(avatarDir, join(avatarDir, avatarName));
                  await writeFile(avatarFile, Buffer.from(p.avatarBase64, "base64"));
                  const updated = await chars.updatePersona(created.id, { avatarPath }, { skipVersionSnapshot: true });
                  if (!updated) throw new Error("Imported Persona disappeared before its avatar could be attached");
                } catch (err) {
                  if (avatarFile) {
                    try {
                      await rm(avatarFile, { force: true });
                    } catch (cleanupErr) {
                      logger.warn(cleanupErr, "[backup] Failed to remove unattached legacy Persona avatar");
                    }
                  }
                  logger.warn(err, "[backup] Skipped optional avatar restoration for imported Persona %s", created.id);
                }
              }
            } catch {
              /* skip */
            }
            completedItems++;
            emitLegacyProgress("personas", "Importing personas");
          }
        }

        // Import lorebooks + entries
        if (Array.isArray(data.lorebooks)) {
          for (const lb of data.lorebooks) {
            try {
              emitLegacyProgress("lorebooks", "Importing lorebooks");
              const created = await lbs.create(
                {
                  name: lb.name,
                  description: lb.description ?? "",
                  category: lb.category ?? "uncategorized",
                  scanDepth: lb.scanDepth,
                  tokenBudget: lb.tokenBudget,
                  entryLimit: lb.entryLimit,
                  recursiveScanning: lb.recursiveScanning,
                  maxRecursionDepth: lb.maxRecursionDepth,
                  excludeFromVectorization: lb.excludeFromVectorization ?? false,
                  vectorQueryDepth: lb.vectorQueryDepth ?? 10,
                  vectorScoreThreshold: lb.vectorScoreThreshold ?? 0.3,
                  vectorMaxResults: lb.vectorMaxResults ?? 10,
                  enabled: lb.enabled ?? true,
                  characterId: lb.characterId ?? null,
                  characterIds: Array.isArray(lb.characterIds)
                    ? lb.characterIds.filter((value: unknown): value is string => typeof value === "string")
                    : typeof lb.characterId === "string"
                      ? [lb.characterId]
                      : [],
                  personaId: lb.personaId ?? null,
                  personaIds: Array.isArray(lb.personaIds)
                    ? lb.personaIds.filter((value: unknown): value is string => typeof value === "string")
                    : typeof lb.personaId === "string"
                      ? [lb.personaId]
                      : [],
                  chatId: lb.chatId ?? null,
                  isGlobal: lb.isGlobal ?? false,
                  scope: normalizeLorebookScope(lb.scope),
                  tags: Array.isArray(lb.tags) ? lb.tags : [],
                  generatedBy: lb.generatedBy ?? null,
                  sourceAgentId: lb.sourceAgentId ?? null,
                },
                normalizeTimestampOverrides({ createdAt: lb.createdAt, updatedAt: lb.updatedAt }),
              );
              const folderIdMap = new Map<string, string>();
              if (created && Array.isArray(lb.folders)) {
                // Pass 1: create all folders without parent references
                for (const folder of lb.folders) {
                  const oldId = typeof folder.id === "string" ? folder.id : null;
                  const createdFolder = (await lbs.createFolder((created as any).id, {
                    name: folder.name ?? "Folder",
                    enabled: folder.enabled === "true" || folder.enabled === true,
                    parentFolderId: null,
                    order: folder.order ?? 0,
                  })) as { id?: string } | null;
                  if (oldId && createdFolder?.id) folderIdMap.set(oldId, createdFolder.id);
                }
                // Pass 2: restore nesting using the fully-populated map (same
                // parent→child pattern as the preset group import below). lbs
                // writes through storage without the PATCH route's validation,
                // so each move is gated with canReparentFolder against a mirror
                // of the applied state — a malformed export cannot persist a
                // self-parent or cycle; an invalid link leaves that folder at root.
                const folderRows = Array.from(folderIdMap.values()).map((id) => ({
                  id,
                  lorebookId: (created as any).id as string,
                  parentFolderId: null as string | null,
                }));
                const rowById = new Map(folderRows.map((row) => [row.id, row]));
                for (const folder of lb.folders) {
                  const oldId = typeof folder.id === "string" ? folder.id : null;
                  const oldParentId = typeof folder.parentFolderId === "string" ? folder.parentFolderId : null;
                  if (!oldId || !oldParentId) continue;
                  const newId = folderIdMap.get(oldId);
                  const newParentId = folderIdMap.get(oldParentId);
                  if (!newId || !newParentId) continue;
                  const check = canReparentFolder(folderRows, newId, newParentId);
                  if (!check.ok) {
                    logger.warn(
                      "[backup] Skipping invalid folder parent link in legacy import (folder %s): %s",
                      oldId,
                      check.reason,
                    );
                    continue;
                  }
                  try {
                    await lbs.updateFolder(newId, { parentFolderId: newParentId }, (created as any).id);
                    const row = rowById.get(newId);
                    if (row) row.parentFolderId = newParentId;
                  } catch (err) {
                    logger.warn(err, "[backup] Failed to restore folder nesting during legacy import");
                  }
                }
              }
              if (created && Array.isArray(lb.entries)) {
                for (const entry of lb.entries) {
                  const folderId =
                    typeof entry.folderId === "string" && folderIdMap.has(entry.folderId)
                      ? folderIdMap.get(entry.folderId)
                      : null;
                  await lbs.createEntry({ ...entry, lorebookId: (created as any).id, folderId });
                }
              }
              stats.lorebooks++;
            } catch {
              /* skip */
            }
            completedItems++;
            emitLegacyProgress("lorebooks", "Importing lorebooks");
          }
        }

        // Import presets with full hierarchy (groups, sections, choice blocks)
        if (Array.isArray(data.presets)) {
          for (const p of data.presets) {
            try {
              emitLegacyProgress("presets", "Importing presets");
              const existing = await presets.getById(p.id);
              if (!existing) {
                const created = await presets.create(
                  {
                    name: `${p.name} (imported)`,
                    description: p.description ?? "",
                    parameters:
                      typeof p.parameters === "string"
                        ? JSON.parse(p.parameters)
                        : (p.parameters ?? p.generationParams),
                    variableGroups:
                      typeof p.variableGroups === "string" ? JSON.parse(p.variableGroups) : (p.variableGroups ?? []),
                    variableValues:
                      typeof p.variableValues === "string" ? JSON.parse(p.variableValues) : (p.variableValues ?? {}),
                  },
                  normalizeTimestampOverrides({ createdAt: p.createdAt, updatedAt: p.updatedAt }),
                );
                if (created) {
                  const newPresetId = (created as any).id;
                  // Map old group IDs → new group IDs for section groupId references
                  const groupIdMap = new Map<string, string>();

                  // Import groups — two passes to handle parent→child ordering
                  if (Array.isArray(p.groups)) {
                    // Pass 1: create all groups without parent references
                    for (const g of p.groups) {
                      try {
                        const newGroup = await presets.createGroup({
                          presetId: newPresetId,
                          name: g.name,
                          parentGroupId: null,
                          order: g.order ?? 100,
                          enabled: g.enabled === "true" || g.enabled === true,
                        });
                        if (newGroup) groupIdMap.set(g.id, (newGroup as any).id);
                      } catch {
                        /* skip individual group */
                      }
                    }
                    // Pass 2: fix parent references using the fully-populated map
                    for (const g of p.groups) {
                      if (g.parentGroupId && groupIdMap.has(g.id) && groupIdMap.has(g.parentGroupId)) {
                        try {
                          await presets.updateGroup(groupIdMap.get(g.id)!, {
                            parentGroupId: groupIdMap.get(g.parentGroupId)!,
                          });
                        } catch {
                          /* skip */
                        }
                      }
                    }
                  }

                  // Import sections
                  if (Array.isArray(p.sections)) {
                    for (const s of p.sections) {
                      try {
                        await presets.createSection({
                          presetId: newPresetId,
                          identifier: s.identifier,
                          name: s.name,
                          content: s.content ?? "",
                          role: s.role ?? "system",
                          enabled: s.enabled === "true" || s.enabled === true,
                          isMarker: s.isMarker === "true" || s.isMarker === true,
                          groupId: s.groupId ? (groupIdMap.get(s.groupId) ?? null) : null,
                          markerConfig:
                            typeof s.markerConfig === "string" ? JSON.parse(s.markerConfig) : (s.markerConfig ?? null),
                          injectionPosition: s.injectionPosition ?? "ordered",
                          injectionDepth: s.injectionDepth ?? 0,
                          injectionOrder: s.injectionOrder ?? 100,
                          forbidOverrides: s.forbidOverrides === "true" || s.forbidOverrides === true,
                        });
                      } catch {
                        /* skip individual section */
                      }
                    }
                  }

                  // Import choice blocks
                  if (Array.isArray(p.choices)) {
                    for (const cb of p.choices) {
                      try {
                        await presets.createChoiceBlock({
                          presetId: newPresetId,
                          variableName: cb.variableName,
                          question: cb.question,
                          options: typeof cb.options === "string" ? JSON.parse(cb.options) : (cb.options ?? []),
                          multiSelect: cb.multiSelect === "true" || cb.multiSelect === true,
                          separator: cb.separator ?? ", ",
                          randomPick: cb.randomPick === "true" || cb.randomPick === true,
                          displayMode:
                            cb.displayMode === "buttons" || cb.displayMode === "listbox" ? cb.displayMode : "auto",
                          optionSort: cb.optionSort === "alphabetical" ? "alphabetical" : "manual",
                        });
                      } catch {
                        /* skip individual choice block */
                      }
                    }
                  }

                  stats.presets++;
                }
              }
            } catch {
              /* skip */
            }
            completedItems++;
            emitLegacyProgress("presets", "Importing presets");
          }
        }

        // Import agent configs
        if (Array.isArray(data.agents)) {
          for (const a of data.agents) {
            try {
              emitLegacyProgress("agents", "Importing agents");
              // Only import if this agent type doesn't already exist
              const existing = await agents.getByType(a.type);
              if (!existing) {
                await agents.create({
                  type: a.type,
                  name: a.name,
                  description: a.description ?? "",
                  phase: a.phase,
                  enabled: true,
                  connectionId: a.connectionId ?? null,
                  imagePath: a.imagePath ?? null,
                  promptTemplate: a.promptTemplate ?? "",
                  settings: typeof a.settings === "string" ? JSON.parse(a.settings) : (a.settings ?? {}),
                });
                stats.agents++;
              }
            } catch {
              /* skip */
            }
            completedItems++;
            emitLegacyProgress("agents", "Importing agents");
          }
        }

        // Import synced custom themes
        if (Array.isArray(data.themes)) {
          for (const theme of data.themes) {
            try {
              emitLegacyProgress("themes", "Importing themes");
              const duplicate = await themes.findDuplicate(theme.name ?? "", theme.css ?? "");
              const syncedTheme =
                duplicate ??
                (await themes.create({
                  name: theme.name ?? "Imported Theme",
                  css: theme.css ?? "",
                  installedAt: theme.installedAt,
                }));

              if (!duplicate && syncedTheme) {
                stats.themes++;
              }
            } catch {
              /* skip */
            }
            completedItems++;
            emitLegacyProgress("themes", "Importing themes");
          }
        }

        const payload = { success: true, imported: stats, warnings };
        if (wantsProgressStream) {
          sendEvent({ type: "done", data: payload });
          reply.raw.end();
          return;
        }
        return payload;
      } catch (err) {
        if (wantsProgressStream) {
          const message = getBackupErrorMessage(err, "Profile import failed. Check the server logs for details.");
          if (!(err instanceof ProfileImportRequestError)) {
            const logError = err instanceof Error ? err : new Error(message);
            logger.error(logError, "[backup] Profile import failed");
          }
          sendEvent({
            type: "error",
            data: {
              error: err instanceof ProfileImportRequestError ? "Invalid profile export" : "Profile import failed",
              message,
            },
          });
          reply.raw.end();
          return;
        }
        if (err instanceof ProfileImportRequestError) {
          return sendProfileImportRequestError(reply, err);
        }
        return sendBackupRouteError(reply, err, "Profile import");
      }
    } finally {
      await importInput.cleanup?.();
    }
  });
}
