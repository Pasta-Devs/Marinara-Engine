export const CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Drop JSON, PNG character cards, CharX, or Marinara exports.";

const EMPTY_DROP_ERROR = "Drop supported character files here.";
const FOLDER_DROP_ERROR = "Folders are not supported here. Drop supported character files instead.";
const UNSUPPORTED_DROP_ERROR = "Drop supported character files here. Folders and other items are not supported.";

const SUPPORTED_CHARACTER_IMPORT_EXTENSIONS = [".json", ".png", ".charx", ".marinara"] as const;

interface DroppedEntryLike {
  isDirectory?: boolean;
}

interface DroppedItemLike {
  kind: string;
  getAsFile(): File | null;
  webkitGetAsEntry?: () => DroppedEntryLike | null;
}

interface DropDataTransferLike {
  items?: ArrayLike<DroppedItemLike> | null;
  files?: ArrayLike<File> | null;
}

export interface DroppedCharacterImportFiles {
  files: File[];
  error: string | null;
}

export function isSupportedCharacterImportFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_CHARACTER_IMPORT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function extractDroppedCharacterImportFiles(dataTransfer: DropDataTransferLike): DroppedCharacterImportFiles {
  const items = Array.from(dataTransfer.items ?? []);
  if (items.length > 0) {
    const files: File[] = [];
    let hasFolder = false;
    let hasUnsupportedItem = false;

    for (const item of items) {
      if (item.kind !== "file") {
        hasUnsupportedItem = true;
        continue;
      }

      const entry = item.webkitGetAsEntry?.() ?? null;
      if (entry?.isDirectory) {
        hasFolder = true;
        continue;
      }

      const file = item.getAsFile();
      if (!file) {
        hasFolder = true;
        continue;
      }

      files.push(file);
    }

    if (hasFolder) return { files: [], error: FOLDER_DROP_ERROR };
    if (hasUnsupportedItem) return { files: [], error: UNSUPPORTED_DROP_ERROR };
    return files.length > 0 ? { files, error: null } : { files: [], error: EMPTY_DROP_ERROR };
  }

  const files = Array.from(dataTransfer.files ?? []);
  return files.length > 0 ? { files, error: null } : { files: [], error: EMPTY_DROP_ERROR };
}
