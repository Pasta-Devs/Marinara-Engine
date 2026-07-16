export type BackgroundLibraryFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type BackgroundLibraryOrganization = {
  folders: BackgroundLibraryFolder[];
  assignments: Record<string, string>;
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

  return { folders, assignments };
}

export function removeBackgroundFolder(
  organization: BackgroundLibraryOrganization,
  folderId: string,
): BackgroundLibraryOrganization {
  return {
    folders: organization.folders.filter((folder) => folder.id !== folderId),
    assignments: Object.fromEntries(
      Object.entries(organization.assignments).filter(([, assignedFolderId]) => assignedFolderId !== folderId),
    ),
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
  return { ...organization, assignments };
}
