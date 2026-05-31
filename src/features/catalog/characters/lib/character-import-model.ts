export type ImportResultRow = {
  filename: string;
  success: boolean;
  message: string;
};

export type TagImportMode = "all" | "none" | "existing";
export type CharacterImportMode = "new" | "update";

export type CharacterImportRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  data?: unknown;
  comment?: string;
  avatarPath?: string | null;
};

type CharacterImportUpdatePatch = {
  id: string;
  data: Record<string, unknown>;
  comment: string;
  avatarPath?: string;
  versionSource: "import";
  versionReason: string;
};

type CharacterImportVersionSnapshot = {
  characterId: string;
  data: Record<string, unknown>;
  comment: string;
  avatarPath: string | null;
  version: string;
  source: "import";
  reason: string;
};

export type CharacterImportUpdatePlan = {
  patch: CharacterImportUpdatePatch;
  snapshot: CharacterImportVersionSnapshot;
  importedId: string;
  updatedName: string;
};

export class CharacterImportPartialSuccessError extends Error {
  readonly importedId: string;
  readonly importedName: string;
  readonly targetId: string;
  readonly updatedName: string;

  constructor({
    cause,
    importedId,
    importedName,
    targetId,
    updatedName,
  }: {
    cause: unknown;
    importedId: string;
    importedName: string;
    targetId: string;
    updatedName: string;
  }) {
    const causeMessage = cause instanceof Error ? cause.message : "Unknown cleanup error.";
    super(
      `Updated "${updatedName}" from "${importedName}", but the imported duplicate "${importedId}" could not be removed. Delete the duplicate manually. ${causeMessage}`,
    );
    this.name = "CharacterImportPartialSuccessError";
    this.importedId = importedId;
    this.importedName = importedName;
    this.targetId = targetId;
    this.updatedName = updatedName;
  }
}

export const TAG_IMPORT_OPTIONS: Array<{ value: TagImportMode; label: string; description: string }> = [
  { value: "all", label: "All tags", description: "Keep source tags." },
  { value: "none", label: "No tags", description: "Skip source tags." },
  { value: "existing", label: "Existing only", description: "Keep tags already in Marinara." },
];

function readCharacterImportString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readCharacterImportRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function characterImportData(row: CharacterImportRow | null | undefined): Record<string, unknown> {
  return readCharacterImportRecord(row?.data);
}

export function characterImportDisplayName(row: CharacterImportRow | null | undefined): string {
  return (
    readCharacterImportString(row?.name) ||
    readCharacterImportString(characterImportData(row).name) ||
    "Unnamed character"
  );
}

export function buildCharacterImportUpdatePlan(
  target: CharacterImportRow | null | undefined,
  imported: unknown,
  importedName: string,
): CharacterImportUpdatePlan {
  const targetId = readCharacterImportString(target?.id);
  if (!targetId) throw new Error("Target character not found.");

  const importedRow =
    imported && typeof imported === "object" && !Array.isArray(imported) ? (imported as CharacterImportRow) : null;
  const importedData = characterImportData(importedRow);
  if (Object.keys(importedData).length === 0) throw new Error("Imported character record did not include card data.");
  const missingRequiredFields = ["name", "description"].filter(
    (field) => typeof importedData[field] !== "string",
  );
  if (missingRequiredFields.length > 0) {
    const displayName = readCharacterImportString(importedRow?.name) || importedName || "imported character";
    throw new Error(
      `Imported character "${displayName}" is missing required card field${missingRequiredFields.length === 1 ? "" : "s"}: ${missingRequiredFields.join(", ")}.`,
    );
  }

  const targetData = characterImportData(target);
  const patch: CharacterImportUpdatePatch = {
    id: targetId,
    data: importedData,
    comment: readCharacterImportString(importedRow?.comment),
    versionSource: "import",
    versionReason: `Imported updated card from ${importedName}`,
  };

  const importedAvatarPath = readCharacterImportString(importedRow?.avatarPath);
  if (importedAvatarPath.trim()) patch.avatarPath = importedAvatarPath;

  return {
    patch,
    snapshot: {
      characterId: targetId,
      data: targetData,
      comment: readCharacterImportString(target?.comment),
      avatarPath: target?.avatarPath ?? null,
      version: readCharacterImportString(targetData.character_version, "current"),
      source: "import",
      reason: `Before in-place import from ${importedName}`,
    },
    importedId: readCharacterImportString(importedRow?.id),
    updatedName: characterImportDisplayName(target),
  };
}
