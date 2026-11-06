import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { join } from "path";

export type BackgroundLibraryFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type BackgroundLibraryOrganization = {
  folders: BackgroundLibraryFolder[];
  assignments: Record<string, string>;
  /** Background ids the user starred. Independent of the Roleplay default background. */
  favorites: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

export function normalizeBackgroundLibraryOrganization(value: unknown): BackgroundLibraryOrganization {
  const source = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const folders: BackgroundLibraryFolder[] = [];
  const folderIds = new Set<string>();

  if (Array.isArray(source.folders)) {
    for (const candidate of source.folders) {
      if (!isRecord(candidate)) continue;
      const id = typeof candidate.id === "string" ? candidate.id.trim().slice(0, 100) : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 80) : "";
      if (!id || !name || folderIds.has(id)) continue;
      const createdAt = normalizedTimestamp(candidate.createdAt, now);
      folders.push({
        id,
        name,
        createdAt,
        updatedAt: normalizedTimestamp(candidate.updatedAt, createdAt),
      });
      folderIds.add(id);
    }
  }

  const assignments: Record<string, string> = {};
  if (isRecord(source.assignments)) {
    for (const [backgroundId, folderId] of Object.entries(source.assignments)) {
      const normalizedBackgroundId = backgroundId.trim().slice(0, 500);
      if (!normalizedBackgroundId || typeof folderId !== "string" || !folderIds.has(folderId)) continue;
      assignments[normalizedBackgroundId] = folderId;
    }
  }

  const favorites = Array.isArray(source.favorites)
    ? [
        ...new Set(
          source.favorites
            .filter((candidate): candidate is string => typeof candidate === "string")
            .map((candidate) => candidate.trim().slice(0, 500))
            .filter(Boolean),
        ),
      ]
    : [];

  return { folders, assignments, favorites };
}

const organizationPath = (backgroundsDir: string) => join(backgroundsDir, "organization.json");

export function readBackgroundLibraryOrganization(backgroundsDir: string): BackgroundLibraryOrganization {
  const path = organizationPath(backgroundsDir);
  if (!existsSync(path)) return normalizeBackgroundLibraryOrganization(undefined);
  try {
    return normalizeBackgroundLibraryOrganization(JSON.parse(readFileSync(path, "utf-8")));
  } catch {
    return normalizeBackgroundLibraryOrganization(undefined);
  }
}

export function writeBackgroundLibraryOrganization(
  backgroundsDir: string,
  organization: BackgroundLibraryOrganization,
): void {
  mkdirSync(backgroundsDir, { recursive: true });
  const path = organizationPath(backgroundsDir);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(organization, null, 2), "utf-8");
    renameSync(temporaryPath, path);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

export function removeBackgroundFolder(
  organization: BackgroundLibraryOrganization,
  folderId: string,
): BackgroundLibraryOrganization {
  return {
    ...organization,
    folders: organization.folders.filter((folder) => folder.id !== folderId),
    assignments: Object.fromEntries(
      Object.entries(organization.assignments).filter(([, assignedFolderId]) => assignedFolderId !== folderId),
    ),
  };
}

/**
 * Drop assignments and favorites for backgrounds that no longer exist. Called on the write paths,
 * which already know the live id set, so listing stays read-only.
 */
export function pruneBackgroundLibraryOrganization(
  organization: BackgroundLibraryOrganization,
  knownBackgroundIds: Set<string>,
): BackgroundLibraryOrganization {
  return {
    ...organization,
    assignments: Object.fromEntries(
      Object.entries(organization.assignments).filter(([backgroundId]) => knownBackgroundIds.has(backgroundId)),
    ),
    favorites: organization.favorites.filter((backgroundId) => knownBackgroundIds.has(backgroundId)),
  };
}

export function moveBackgroundAssignment(
  organization: BackgroundLibraryOrganization,
  oldBackgroundId: string,
  newBackgroundId: string | null,
): BackgroundLibraryOrganization {
  const assignments = { ...organization.assignments };
  const folderId = assignments[oldBackgroundId];
  delete assignments[oldBackgroundId];
  if (folderId && newBackgroundId) assignments[newBackgroundId] = folderId;

  // Renaming or deleting a file carries its star with it, so a rename does not silently unstar.
  // A target that is already starred keeps its star.
  const wasFavorite = organization.favorites.includes(oldBackgroundId);
  const favorites = organization.favorites.filter((id) => id !== oldBackgroundId);
  if (wasFavorite && newBackgroundId && !favorites.includes(newBackgroundId)) favorites.push(newBackgroundId);

  return { ...organization, assignments, favorites };
}
