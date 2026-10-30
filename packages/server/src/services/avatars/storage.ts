// ──────────────────────────────────────────────
// Avatar agents: per-owner storage (lane: base)
// ──────────────────────────────────────────────
// Layout, one folder per character or persona:
//   DATA_DIR/avatar-models/<ownerType>/<ownerId>/avatar.json      AvatarConfig v1 (avatarConfigSchema)
//   DATA_DIR/avatar-models/<ownerType>/<ownerId>/pngtuber/*.png    PNGTuber layers (imported or generated)
//   DATA_DIR/avatar-models/<ownerType>/<ownerId>/mesh-avatar/*.mavatar
//   DATA_DIR/avatar-models/<ownerType>/<ownerId>/vrm/*.vrm, *.vrma
// `DATA_DIR/avatars` already holds profile pictures, so model files live apart from it. Owner sprites
// stay in DATA_DIR/sprites; a PNGTuber setup that reuses them stores only sprite labels.
//
// Import routes and generation call only these functions, so every write goes through one per-owner
// queue and every path through one containment check. Backups cover the folder (BACKUP_DIRS), and
// deleting a character or persona removes its folder.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AVATAR_CONFIG_FILENAME,
  AVATAR_KINDS,
  AVATAR_OWNER_TYPES,
  DEFAULT_AVATAR_FEATURE_FLAGS,
  avatarConfigSchema,
  avatarOwnerRefSchema,
  createAvatarConfig,
  isAvatarFilePath,
  type AvatarConfig,
  type AvatarExtractedFile,
  type AvatarExtractedImport,
  type AvatarFeatureFlags,
  type AvatarFilePath,
  type AvatarImportResult,
  type AvatarKind,
  type AvatarKindDataMap,
  type AvatarOwnerRef,
  type AvatarOwnerSummary,
} from "@marinara-engine/shared";
import { logger } from "../../lib/logger.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";

export const AVATAR_MODELS_DIR = join(DATA_DIR, "avatar-models");

/** The global upload cap (MAX_UPLOAD_BYTES in app.ts). Avatar imports add no lower limit: archive
 *  entries are read with this as their bound, and only dishonest archives are refused. */
export const AVATAR_IMPORT_MAX_BYTES = 256 * 1024 * 1024;

/** A refusal the routes answer with `statusCode` and a message plain enough to show the user. */
export class AvatarStorageError extends Error {
  readonly statusCode: 400 | 404;
  constructor(statusCode: 400 | 404, message: string) {
    super(message);
    this.name = "AvatarStorageError";
    this.statusCode = statusCode;
  }
}

function checkedOwner(owner: AvatarOwnerRef): AvatarOwnerRef {
  const parsed = avatarOwnerRefSchema.safeParse(owner);
  if (!parsed.success) throw new AvatarStorageError(400, "That character or persona can't have an avatar.");
  return parsed.data;
}

function ownerKey(owner: AvatarOwnerRef): string {
  return `${owner.ownerType}/${owner.ownerId}`;
}

/** Absolute folder of one owner. Validates the owner id; never creates anything. */
export function avatarOwnerDir(owner: AvatarOwnerRef): string {
  const checked = checkedOwner(owner);
  return assertInsideDir(AVATAR_MODELS_DIR, join(AVATAR_MODELS_DIR, checked.ownerType, checked.ownerId));
}

/** Absolute path of a stored file, checked to stay inside the owner's folder. */
export function resolveAvatarFile(owner: AvatarOwnerRef, path: AvatarFilePath): string {
  if (!isAvatarFilePath(path)) throw new AvatarStorageError(400, "That avatar file name isn't allowed.");
  const dir = avatarOwnerDir(owner);
  const [kind, name] = path.split("/") as [string, string];
  return assertInsideDir(dir, join(dir, kind, name));
}

// ── Per-owner queue ──

const ownerQueues = new Map<string, Promise<unknown>>();

/** Runs `task` after every earlier task for the same owner settles, so writes never interleave. */
function withOwnerLock<T>(owner: AvatarOwnerRef, task: () => Promise<T>): Promise<T> {
  const key = ownerKey(owner);
  const run = (ownerQueues.get(key) ?? Promise.resolve()).then(() => task());
  const tail = run.catch(() => undefined);
  ownerQueues.set(key, tail);
  void tail.then(() => {
    if (ownerQueues.get(key) === tail) ownerQueues.delete(key);
  });
  return run;
}

// ── Files ──

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

interface PendingWrite {
  target: string;
  dir: string;
  name: string;
  bytes: Uint8Array | string;
}

/** Write each file to a hidden temporary file in its folder, and rename them over their targets only once
 *  all are written, so a failed write replaces nothing. The leading dot keeps temporary names outside
 *  AVATAR_FILE_PATH_PATTERN, so they are never served or referenced. */
async function writeFilesAtomic(writes: readonly PendingWrite[]) {
  const staged: { temporary: string; target: string }[] = [];
  try {
    for (const { target, dir, name, bytes } of writes) {
      await mkdir(dir, { recursive: true });
      const temporary = join(dir, `.${name}.${randomUUID()}.tmp`);
      staged.push({ temporary, target });
      await writeFile(temporary, bytes);
    }
    for (const { temporary, target } of staged) await rename(temporary, target);
  } catch (error) {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true }).catch(() => undefined)));
    throw error;
  }
}

async function writeFilesUnlocked(owner: AvatarOwnerRef, files: readonly AvatarExtractedFile[]) {
  const ownerDir = avatarOwnerDir(owner);
  await writeFilesAtomic(
    files.map((file) => {
      const [kind, name] = file.path.split("/") as [string, string];
      return { target: resolveAvatarFile(owner, file.path), dir: join(ownerDir, kind), name, bytes: file.bytes };
    }),
  );
  return files.map((file) => file.path);
}

/** Write files into the owner's folder, replacing same-named ones only once every file is written. */
export async function writeAvatarFiles(
  owner: AvatarOwnerRef,
  files: readonly AvatarExtractedFile[],
): Promise<AvatarFilePath[]> {
  const checked = checkedOwner(owner);
  return withOwnerLock(checked, () => writeFilesUnlocked(checked, files));
}

/** Bytes of a stored file, or null when it is missing. */
export async function readAvatarFile(owner: AvatarOwnerRef, path: AvatarFilePath): Promise<Buffer | null> {
  try {
    return await readFile(resolveAvatarFile(owner, path));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** Every stored file a kind's data names. */
export function avatarKindFilePaths<K extends AvatarKind>(kind: K, data: AvatarKindDataMap[K]): AvatarFilePath[] {
  if (kind === "pngtuber") {
    const layers = (data as AvatarKindDataMap["pngtuber"]).layers;
    return Object.values(layers).flatMap((set) =>
      [set.base, set.mouthOpen, set.eyesClosed, set.eyesClosedMouthOpen].flatMap((ref) =>
        ref?.source === "file" ? [ref.path] : [],
      ),
    );
  }
  if (kind === "mesh-avatar") return [(data as AvatarKindDataMap["mesh-avatar"]).file];
  if (kind === "mmd") {
    const mmd = data as AvatarKindDataMap["mmd"];
    return [
      ...new Set([mmd.file, ...Object.values(mmd.texturePaths), ...(mmd.idleAnimation ? [mmd.idleAnimation] : [])]),
    ];
  }
  const vrm = data as AvatarKindDataMap["vrm"];
  return vrm.idleAnimation ? [vrm.file, vrm.idleAnimation] : [vrm.file];
}

/** Remove files in a kind's folder that `keep` does not name (case-insensitively, so a file a
 *  case-insensitive disk matched is never lost), plus leftover temporary files. */
async function removeUnreferencedFiles(owner: AvatarOwnerRef, kind: AvatarKind, keep: readonly AvatarFilePath[]) {
  const dir = join(avatarOwnerDir(owner), kind);
  const kept = new Set(keep.map((path) => path.slice(kind.length + 1).toLowerCase()));
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  for (const name of names) {
    if (kept.has(name.toLowerCase())) continue;
    await rm(assertInsideDir(dir, join(dir, name)), { recursive: true, force: true });
  }
}

// ── avatar.json ──

function configPath(owner: AvatarOwnerRef): string {
  return join(avatarOwnerDir(owner), AVATAR_CONFIG_FILENAME);
}

async function readConfigUnlocked(owner: AvatarOwnerRef): Promise<AvatarConfig | null> {
  let raw: string;
  try {
    raw = await readFile(configPath(owner), "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("[avatars] Ignoring an unreadable avatar.json for %s", ownerKey(owner));
    return null;
  }
  const result = avatarConfigSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn("[avatars] Ignoring an invalid avatar.json for %s: %s", ownerKey(owner), result.error.message);
    return null;
  }
  // The folder decides the owner, so a copied or restored file can't speak for someone else.
  return { ...result.data, owner: { ownerType: owner.ownerType, ownerId: owner.ownerId } };
}

/** Checks a config before it is written: schema, owner, every file in its kind's folder, and every file it
 *  newly names exists (or is in `pending`, written by this save). Files the stored config already named were
 *  checked when it was written; one lost since (a skipped restore, a hand deletion) must not block turning
 *  the avatar off, saving another kind or removing the broken one. */
async function validatedConfig(
  owner: AvatarOwnerRef,
  candidate: AvatarConfig,
  previous: AvatarConfig | null,
  pending: ReadonlySet<AvatarFilePath> = new Set(),
): Promise<AvatarConfig> {
  const result = avatarConfigSchema.safeParse({
    ...candidate,
    owner: { ownerType: owner.ownerType, ownerId: owner.ownerId },
  });
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AvatarStorageError(
      400,
      issue ? `${issue.path.join(".") || "avatar"}: ${issue.message}` : "Invalid avatar",
    );
  }
  const config = result.data as AvatarConfig;
  for (const kind of AVATAR_KINDS) {
    const data = config.kinds[kind];
    if (!data) continue;
    const previousData = previous?.kinds[kind];
    const stored = new Set(
      previousData ? avatarKindFilePaths(kind, previousData as AvatarKindDataMap[typeof kind]) : [],
    );
    for (const path of avatarKindFilePaths(kind, data as AvatarKindDataMap[typeof kind])) {
      if (!path.startsWith(`${kind}/`)) {
        throw new AvatarStorageError(400, `${kind} files live in ${kind}/.`);
      }
      if (stored.has(path) || pending.has(path)) continue;
      try {
        if (!(await stat(resolveAvatarFile(owner, path))).isFile()) throw new Error("not a file");
      } catch {
        throw new AvatarStorageError(400, `The avatar file ${path} is missing.`);
      }
    }
  }
  return config;
}

async function writeConfigUnlocked(owner: AvatarOwnerRef, config: AvatarConfig) {
  const dir = avatarOwnerDir(owner);
  await writeFilesAtomic([
    { target: configPath(owner), dir, name: AVATAR_CONFIG_FILENAME, bytes: `${JSON.stringify(config, null, 2)}\n` },
  ]);
}

/** The owner's parsed and validated `avatar.json`, or null when there is none. */
export async function readAvatarConfig(owner: AvatarOwnerRef): Promise<AvatarConfig | null> {
  return readConfigUnlocked(checkedOwner(owner));
}

async function updateConfigUnlocked(
  owner: AvatarOwnerRef,
  mutate: (current: AvatarConfig | null) => AvatarConfig | Promise<AvatarConfig>,
): Promise<AvatarConfig> {
  const current = await readConfigUnlocked(owner);
  const next = await validatedConfig(owner, await mutate(current), current);
  await writeConfigUnlocked(owner, next);
  return next;
}

/** Read-modify-write of `avatar.json`, queued per owner so concurrent writes never interleave. `mutate`
 *  gets null when no config exists yet (start from createAvatarConfig). Validates before writing. */
export async function updateAvatarConfig(
  owner: AvatarOwnerRef,
  mutate: (current: AvatarConfig | null) => AvatarConfig | Promise<AvatarConfig>,
): Promise<AvatarConfig> {
  const checked = checkedOwner(owner);
  return withOwnerLock(checked, () => updateConfigUnlocked(checked, mutate));
}

/** Every owner that has an `avatar.json`. */
export async function listAvatarOwners(): Promise<AvatarOwnerSummary[]> {
  const summaries: AvatarOwnerSummary[] = [];
  for (const ownerType of AVATAR_OWNER_TYPES) {
    let ownerIds: string[];
    try {
      ownerIds = await readdir(join(AVATAR_MODELS_DIR, ownerType));
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
    for (const ownerId of ownerIds) {
      const owner = { ownerType, ownerId };
      if (!avatarOwnerRefSchema.safeParse(owner).success) continue;
      const config = await readConfigUnlocked(owner);
      if (!config) continue;
      summaries.push({
        owner: config.owner,
        enabled: config.enabled,
        activeKind: config.activeKind,
        kinds: AVATAR_KINDS.filter((kind) => config.kinds[kind] !== undefined),
        updatedAt: config.updatedAt,
      });
    }
  }
  return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

/** Store an import or a generation result: write its files, set its kind data, make it the active kind
 *  when none is set, and remove files of that kind the new data no longer names. */
export async function saveExtractedAvatar(
  owner: AvatarOwnerRef,
  extraction: AvatarExtractedImport | (() => Promise<AvatarExtractedImport>),
): Promise<AvatarImportResult> {
  const checked = checkedOwner(owner);
  return withOwnerLock(checked, async () => {
    // Importers can read a stored model when attaching motion. Keep that read and its eventual save
    // in the same existing owner transaction, so a concurrent model/face edit cannot be overwritten.
    const extracted = typeof extraction === "function" ? await extraction() : extraction;
    const { kind } = extracted;
    if (!AVATAR_KINDS.includes(kind)) throw new AvatarStorageError(400, "Unknown avatar kind.");
    for (const file of extracted.files) {
      if (!isAvatarFilePath(file.path) || !file.path.startsWith(`${kind}/`)) {
        throw new AvatarStorageError(400, `${kind} files live in ${kind}/.`);
      }
    }
    const current = await readConfigUnlocked(checked);
    const now = new Date().toISOString();
    const base = current ?? createAvatarConfig(checked, now);
    // Checked before any file is written, so a refused save never replaces a file the stored avatar uses.
    const config = await validatedConfig(
      checked,
      {
        ...base,
        activeKind: base.activeKind ?? kind,
        kinds: { ...base.kinds, [kind]: extracted.data },
        updatedAt: now,
      },
      current,
      new Set(extracted.files.map((file) => file.path)),
    );
    try {
      await writeFilesUnlocked(checked, extracted.files);
      await writeConfigUnlocked(checked, config);
    } catch (error) {
      // Leave the folder as the stored config describes it: drop the files this attempt wrote.
      const data = current?.kinds[kind];
      await removeUnreferencedFiles(
        checked,
        kind,
        data ? avatarKindFilePaths(kind, data as AvatarKindDataMap[typeof kind]) : [],
      ).catch(() => undefined);
      throw error;
    }
    await removeUnreferencedFiles(
      checked,
      kind,
      avatarKindFilePaths(kind, config.kinds[kind] as AvatarKindDataMap[typeof kind]),
    );
    return { kind, config, detected: extracted.detected, warnings: extracted.warnings };
  });
}

/** Remove one kind's files and data; returns the remaining config, or null when nothing remains. */
export async function removeAvatarKind(owner: AvatarOwnerRef, kind: AvatarKind): Promise<AvatarConfig | null> {
  const checked = checkedOwner(owner);
  if (!AVATAR_KINDS.includes(kind)) throw new AvatarStorageError(400, "Unknown avatar kind.");
  return withOwnerLock(checked, async () => {
    const current = await readConfigUnlocked(checked);
    const ownerDir = avatarOwnerDir(checked);
    const kinds = { ...current?.kinds };
    delete kinds[kind];
    const remaining = AVATAR_KINDS.filter((candidate) => kinds[candidate] !== undefined);
    // The folder goes with the last kind unless avatar.json still holds a choice: expression sprites are
    // a PNGTuber avatar without one, so an avatar turned off (or with a switch changed) must stay that way.
    if (
      current &&
      remaining.length === 0 &&
      current.enabled &&
      Object.entries(DEFAULT_AVATAR_FEATURE_FLAGS).every(
        ([key, value]) => current.features[key as keyof AvatarFeatureFlags] === value,
      )
    ) {
      await rm(ownerDir, { recursive: true, force: true });
      return null;
    }
    // The config is written before the kind's files go, so a refusal leaves both as they were.
    let next: AvatarConfig | null = null;
    if (current) {
      next = await validatedConfig(
        checked,
        {
          ...current,
          kinds,
          activeKind: current.activeKind && kinds[current.activeKind] ? current.activeKind : (remaining[0] ?? null),
          updatedAt: new Date().toISOString(),
        },
        current,
      );
      await writeConfigUnlocked(checked, next);
    }
    await rm(join(ownerDir, kind), { recursive: true, force: true });
    return next;
  });
}

/** Remove the owner's whole avatar folder (when the avatar or its character or persona is deleted). */
export async function removeAvatarOwner(owner: AvatarOwnerRef): Promise<void> {
  const checked = checkedOwner(owner);
  await withOwnerLock(checked, () => rm(avatarOwnerDir(checked), { recursive: true, force: true }));
}

/** Remove the avatar folders of every character or every persona except `keepOwnerIds`, when all of them are
 *  deleted at once. Returns how many folders went. */
export async function removeAvatarOwnersOfType(
  ownerType: AvatarOwnerRef["ownerType"],
  keepOwnerIds: readonly string[] = [],
): Promise<number> {
  let ownerIds: string[];
  try {
    ownerIds = await readdir(join(AVATAR_MODELS_DIR, ownerType));
  } catch (error) {
    if (isMissing(error)) return 0;
    throw error;
  }
  let removed = 0;
  for (const ownerId of ownerIds) {
    const owner = { ownerType, ownerId };
    if (keepOwnerIds.includes(ownerId) || !avatarOwnerRefSchema.safeParse(owner).success) continue;
    await removeAvatarOwner(owner);
    removed += 1;
  }
  return removed;
}
