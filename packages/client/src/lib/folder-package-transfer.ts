import { getFolderImportEntries, isJsonRecord, sanitizeFolderSegment } from "@marinara-engine/shared";

export type PackageTextFile = {
  path: string;
  text: string;
};

export type FolderPackageImportEntry = {
  raw: unknown;
  path: string;
  basePath: string;
  resolveTextFile: (path: unknown) => string | null;
};

const PACKAGE_TEXT_FILE_RE = /\.(json|js|mjs|cjs|css|md|txt|ts|tsx)$/i;

export function normalizePackagePath(path: string) {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

export function getPackagePathBasename(path: string) {
  const normalized = normalizePackagePath(path);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

export function getPackagePathDirname(path: string) {
  const normalized = normalizePackagePath(path);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

export function reservePackageFolderSegment(value: string, fallback: string, usedSegments: Set<string>) {
  const baseSegment = sanitizeFolderSegment(value, fallback);
  let segment = baseSegment;
  let suffix = 2;
  while (usedSegments.has(segment.toLowerCase())) {
    segment = `${baseSegment}-${suffix}`;
    suffix++;
  }
  usedSegments.add(segment.toLowerCase());
  return segment;
}

export async function readTextFilesFromFileList(fileList: FileList | null): Promise<PackageTextFile[]> {
  const result: PackageTextFile[] = [];
  for (const file of Array.from(fileList ?? [])) {
    const relativePath = normalizePackagePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "",
    );
    const path = relativePath || normalizePackagePath(file.name);
    if (!path || !PACKAGE_TEXT_FILE_RE.test(path)) continue;
    result.push({ path, text: await file.text() });
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

export function collectFolderPackageEntries(
  files: PackageTextFile[],
  {
    rootFilenames,
    collectionKeys,
  }: {
    rootFilenames: string[];
    collectionKeys: string[];
  },
): FolderPackageImportEntry[] {
  const textByPath = new Map(files.map((file) => [normalizePackagePath(file.path).toLowerCase(), file.text]));
  const normalizedFiles = files.map((file) => ({
    path: normalizePackagePath(file.path),
    text: file.text,
  }));
  const normalizedRootFilenames = new Set(rootFilenames.map((name) => name.toLowerCase()));
  const packageEntries: FolderPackageImportEntry[] = [];

  for (const file of normalizedFiles) {
    if (!normalizedRootFilenames.has(getPackagePathBasename(file.path).toLowerCase())) continue;
    const parsed = parsePackageJson(file.text);
    if (parsed === null) continue;
    for (const raw of getFolderImportEntries(parsed, collectionKeys)) {
      packageEntries.push(createPackageImportEntry(raw, file.path, textByPath));
    }
  }

  if (packageEntries.length > 0) return packageEntries;

  for (const file of normalizedFiles) {
    if (getPackagePathBasename(file.path).toLowerCase() !== "manifest.json") continue;
    const parsed = parsePackageJson(file.text);
    if (parsed === null) continue;
    packageEntries.push(createPackageImportEntry(parsed, file.path, textByPath));
  }

  return packageEntries;
}

export function resolvePackageTextPaths(resolveTextFile: (path: unknown) => string | null, value: unknown) {
  const paths = Array.isArray(value) ? value : [value];
  const parts = paths.map((path) => resolveTextFile(path)).filter((text): text is string => typeof text === "string");
  return parts.length > 0 ? parts.join("\n\n") : null;
}

function parsePackageJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function createPackageImportEntry(
  raw: unknown,
  packagePath: string,
  textByPath: Map<string, string>,
): FolderPackageImportEntry {
  const entryPath = isJsonRecord(raw) && typeof raw.path === "string" ? raw.path : packagePath;
  const normalizedEntryPath = normalizePackagePath(entryPath);
  const basePath =
    getPackagePathBasename(normalizedEntryPath).toLowerCase() === "manifest.json"
      ? getPackagePathDirname(normalizedEntryPath)
      : getPackagePathDirname(packagePath);

  return {
    raw,
    path: normalizedEntryPath || packagePath,
    basePath,
    resolveTextFile: (path) => {
      if (typeof path !== "string" || !path.trim()) return null;
      const normalizedPath = normalizePackagePath(path);
      if (!normalizedPath) return null;
      const candidates = [
        basePath ? normalizePackagePath(`${basePath}/${normalizedPath}`) : normalizedPath,
        normalizedPath,
      ];
      for (const candidate of candidates) {
        const text = textByPath.get(candidate.toLowerCase());
        if (typeof text === "string") return text;
      }
      return null;
    },
  };
}
