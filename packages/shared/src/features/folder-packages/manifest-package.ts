// ──────────────────────────────────────────────
// Folder-shaped import/export packages
// ──────────────────────────────────────────────

export type MarinaraFolderKind =
  | "marinara.agent-folder"
  | "marinara.function-folder"
  | "marinara.theme-folder"
  | "marinara.extension-folder"
  | "marinara.preset-folder";

export interface MarinaraItemManifest<T = unknown> {
  kind: string;
  version: 1;
  config: T;
}

export interface MarinaraFolderEntry<T = unknown> {
  path: string;
  manifest: MarinaraItemManifest<T>;
}

export interface MarinaraFolderPackage<T = unknown> {
  kind: MarinaraFolderKind;
  version: 1;
  exportedAt: string;
  folderName: string;
  agents?: MarinaraFolderEntry<T>[];
  functions?: MarinaraFolderEntry<T>[];
  themes?: MarinaraFolderEntry<T>[];
  extensions?: MarinaraFolderEntry<T>[];
  presets?: MarinaraFolderEntry<T>[];
}

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeFolderSegment(value: string, fallback: string): string {
  const safe = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

export function createFolderEntry<T>({
  folderName,
  itemName,
  itemKind,
  config,
  fallbackName,
}: {
  folderName: string;
  itemName: string;
  itemKind: string;
  config: T;
  fallbackName: string;
}): MarinaraFolderEntry<T> {
  const segment = sanitizeFolderSegment(itemName, fallbackName);
  return {
    path: `${folderName}/${segment}/manifest.json`,
    manifest: {
      kind: itemKind,
      version: 1,
      config,
    },
  };
}

export function getFolderManifestConfig<T = unknown>(entry: unknown): T | null {
  if (!isJsonRecord(entry)) return null;
  const manifest = isJsonRecord(entry.manifest) ? entry.manifest : entry;
  if (typeof manifest.type === "string" && manifest.version === 1) return manifest as T;
  if (isJsonRecord(manifest.config)) return manifest.config as T;
  if (typeof manifest.kind === "string" && isJsonRecord(manifest.data)) return manifest.data as T;
  return manifest as T;
}

export function getFolderImportEntries(parsed: unknown, keys: string[]): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!isJsonRecord(parsed)) return [];
  for (const key of keys) {
    const value = parsed[key];
    if (Array.isArray(value)) return value;
  }
  return [parsed];
}
