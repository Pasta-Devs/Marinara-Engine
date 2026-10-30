import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { spriteCatalogSchema, type SpriteCatalog, type CharacterSpriteCatalog } from "@marinara-engine/shared";
import { DATA_DIR } from "../../utils/data-dir.js";
import { logger } from "../../lib/logger.js";

const IMAGE = /\.(png|jpg|jpeg|gif|webp|avif|svg)$/iu;
const queues = new Map<string, Promise<unknown>>();

export function spriteDirectory(ownerId: string): string {
  if (!ownerId || ownerId.includes("..") || /[/\\\u0000]/u.test(ownerId)) throw Error("Invalid sprite owner");
  const directory = join(DATA_DIR, "sprites", ownerId);
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw Error("Linked sprite directory refused");
  return directory;
}

/** Upgrade legacy character-wide folders without changing or deleting image assets. */
function separateSpriteFolders(catalog: SpriteCatalog): SpriteCatalog {
  for (const folder of [...catalog.folders]) {
    if (folder.category) continue;
    const members = Object.entries(catalog.sprites).filter(([, sprite]) => sprite.folderId === folder.id);
    const hasFullBody = members.some(([handle]) => handle.startsWith("full_"));
    const hasExpressions = members.some(([handle]) => !handle.startsWith("full_"));
    folder.category = hasFullBody && !hasExpressions ? "full-body" : "expressions";
    if (hasFullBody && hasExpressions) {
      const hex = createHash("sha256")
        .update(folder.id + "/full-body")
        .digest("hex");
      const id =
        hex.slice(0, 8) +
        "-" +
        hex.slice(8, 12) +
        "-4" +
        hex.slice(13, 16) +
        "-8" +
        hex.slice(17, 20) +
        "-" +
        hex.slice(20, 32);
      if (catalog.folders.some((existing) => existing.id === id)) throw Error("Conflicting legacy folder identity");
      catalog.folders.push({ ...folder, id, category: "full-body" });
      for (const [handle, sprite] of members) if (handle.startsWith("full_")) sprite.folderId = id;
    }
  }
  return catalog;
}

export function readSpriteCatalog(ownerId: string): SpriteCatalog {
  const file = join(spriteDirectory(ownerId), "catalog.json");
  if (!existsSync(file)) return { version: 1, folders: [], sprites: {} };
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) throw Error("Invalid sprite catalog file");
  const catalog = spriteCatalogSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const ids = new Set(catalog.folders.map((folder) => folder.id));
  if (ids.size !== catalog.folders.length) {
    throw Error("Invalid sprite folder references");
  }
  if (Object.values(catalog.sprites).some((sprite) => sprite.folderId && !ids.has(sprite.folderId))) {
    throw Error("Invalid sprite membership");
  }
  return separateSpriteFolders(catalog);
}

export function readOptionalSpriteCatalog(ownerId: string): SpriteCatalog {
  // Directory checks must not be swallowed by the metadata fallback.
  spriteDirectory(ownerId);
  try {
    return readSpriteCatalog(ownerId);
  } catch (err) {
    logger.warn(err, "Unreadable sprite catalog for %s; listing images without folder metadata", ownerId);
    return { version: 1, folders: [], sprites: {} };
  }
}

export async function writeSpriteCatalog(ownerId: string, value: SpriteCatalog): Promise<void> {
  const catalog = separateSpriteFolders(spriteCatalogSchema.parse(value));
  const directory = spriteDirectory(ownerId);
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `catalog-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(catalog, null, 2) + "\n", { flag: "wx" });
  await rename(temporary, join(directory, "catalog.json"));
}

export async function withSpriteCatalogLock<T>(ownerId: string, action: () => Promise<T>): Promise<T> {
  spriteDirectory(ownerId);
  const previous = queues.get(ownerId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  queues.set(ownerId, next);
  try {
    return await next;
  } finally {
    if (queues.get(ownerId) === next) queues.delete(ownerId);
  }
}

export function listSpriteCatalog(ownerId: string): CharacterSpriteCatalog {
  const directory = spriteDirectory(ownerId);
  const catalog = readOptionalSpriteCatalog(ownerId);
  const sprites = existsSync(directory)
    ? readdirSync(directory)
        .filter((filename) => IMAGE.test(filename) && lstatSync(join(directory, filename)).isFile())
        .sort((a, b) => a.localeCompare(b))
        .map((filename) => {
          const expression = filename.slice(0, -extname(filename).length);
          const metadata = (Object.hasOwn(catalog.sprites, expression) ? catalog.sprites[expression] : undefined) ?? {
            label: expression,
            folderId: null,
          };
          return {
            ...metadata,
            expression,
            filename,
            url: `/api/sprites/${encodeURIComponent(ownerId)}/file/${encodeURIComponent(filename)}?v=${Math.floor(statSync(join(directory, filename)).mtimeMs)}`,
            folderName: catalog.folders.find((folder) => folder.id === metadata.folderId)?.name ?? null,
          };
        })
    : [];
  return { folders: catalog.folders, sprites };
}

/** Import only memberships whose image was successfully restored; never accept filesystem paths from metadata. */
export async function restoreSpriteCatalog(
  ownerId: string,
  value: unknown,
  restored: ReadonlyMap<string, string>,
): Promise<void> {
  if (value === undefined) return;
  const imported = spriteCatalogSchema.parse(value);
  const folderIds = new Set(imported.folders.map((folder) => folder.id));
  if (folderIds.size !== imported.folders.length) throw Error("Invalid imported sprite folders");
  const existing = listSpriteCatalog(ownerId).sprites;
  const sprites = Object.fromEntries(
    [...restored].flatMap(([original, expression]) => {
      const metadata = Object.hasOwn(imported.sprites, original) ? imported.sprites[original] : undefined;
      if (!metadata || (metadata.folderId && !folderIds.has(metadata.folderId))) return [];
      const sprite = existing.find((entry) => entry.expression === expression);
      if (!sprite || metadata.label.startsWith("full_") !== expression.startsWith("full_")) return [];
      const folder = imported.folders.find((entry) => entry.id === metadata.folderId);
      const wrongType =
        folder?.category && folder.category !== (expression.startsWith("full_") ? "full-body" : "expressions");
      return [[expression, { ...metadata, folderId: wrongType ? null : metadata.folderId }]];
    }),
  );
  await writeSpriteCatalog(ownerId, { ...imported, sprites });
}
