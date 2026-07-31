import {
  getFolderImportEntries,
  getFolderManifestConfig,
  isJsonRecord,
  PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY,
  normalizePersonalExtensionCapabilities,
  type PersonalExtensionCapability,
} from "@marinara-engine/shared";
import {
  getPackagePathBasename,
  resolvePackageTextPaths,
  type FolderPackageImportEntry,
  type PackageTextFile,
} from "./folder-package-transfer";

export type PersonalExtensionImportDraft = {
  name: string;
  version: string | null;
  description: string;
  runtime: "client" | "server";
  capabilities: PersonalExtensionCapability[];
  css: string | null;
  js: string | null;
  serverJs: string | null;
};

export function normalizePersonalExtensionVersion(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return String(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 64 ? normalized : null;
}

function parseNumericVersion(value: string | null | undefined): number[] | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^v/i, "");
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) return null;
  return normalized.split(".").map((part) => Number.parseInt(part, 10));
}

export function comparePersonalExtensionVersions(left: string | null | undefined, right: string | null | undefined) {
  const leftParts = parseNumericVersion(left);
  const rightParts = parseNumericVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

function inlineEntry(raw: unknown, path: string): FolderPackageImportEntry {
  return { raw, path, basePath: "", resolveTextFile: () => null };
}

function importKind(raw: unknown) {
  if (!isJsonRecord(raw)) return "";
  const manifest = isJsonRecord(raw.manifest) ? raw.manifest : raw;
  return typeof manifest.kind === "string" ? manifest.kind.toLowerCase() : "";
}

export function normalizePersonalExtensionImportEntry(
  entry: FolderPackageImportEntry,
  fallbackName: string,
): PersonalExtensionImportDraft | null {
  const source = getFolderManifestConfig(entry.raw);
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const kind = importKind(entry.raw);
  const runtime =
    (typeof record.runtime === "string" && record.runtime.toLowerCase() === "server") ||
    kind === "marinara.server-extension" ||
    kind === "marinara.personal-server-extension"
      ? "server"
      : "client";
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : getPackagePathBasename(entry.basePath) || fallbackName;
  if (!name) return null;

  if (runtime === "server") {
    const serverJs =
      resolvePackageTextPaths(
        entry.resolveTextFile,
        record.serverJsPath ?? record.serverJsPaths ?? record.jsPath ?? record.jsPaths,
      ) ?? (typeof record.serverJs === "string" ? record.serverJs : typeof record.js === "string" ? record.js : null);
    if (!serverJs?.trim()) return null;
    return {
      name,
      version: normalizePersonalExtensionVersion(record.version),
      description: typeof record.description === "string" ? record.description : "",
      runtime,
      capabilities: [],
      css: null,
      js: null,
      serverJs,
    };
  }

  const css =
    resolvePackageTextPaths(entry.resolveTextFile, record.cssPath ?? record.cssPaths) ??
    (typeof record.css === "string" ? record.css : null);
  const js =
    resolvePackageTextPaths(entry.resolveTextFile, record.jsPath ?? record.jsPaths) ??
    (typeof record.js === "string" ? record.js : null);
  if (!css?.trim() && !js?.trim()) return null;
  const capabilities = normalizePersonalExtensionCapabilities(record.capabilities);
  // `marinara.extension` is the pre-sandbox browser-extension envelope. Those
  // packages were authored for the host page and otherwise import successfully
  // only to fail at runtime. An explicit capabilities field always wins so a
  // modern package can deliberately opt into the safe sandbox.
  if (
    kind === "marinara.extension" &&
    !Object.prototype.hasOwnProperty.call(record, "capabilities")
  ) {
    capabilities.push(PERSONAL_EXTENSION_FULL_PAGE_CAPABILITY);
  }
  return {
    name,
    version: normalizePersonalExtensionVersion(record.version),
    description: typeof record.description === "string" ? record.description : "",
    runtime,
    capabilities,
    css,
    js,
    serverJs: null,
  };
}

export function createLoosePersonalExtensionEntries(
  files: PackageTextFile[],
  fallbackName: string,
): FolderPackageImportEntry[] {
  const serverJs = files
    .filter((file) => /\.server\.(js|mjs|cjs)$/i.test(file.path))
    .map((file) => file.text)
    .join("\n\n");
  if (serverJs) {
    return [
      inlineEntry(
        {
          name: fallbackName || "Personal Extension",
          description: "Server Personal Extension imported from local files",
          runtime: "server",
          capabilities: [],
          serverJs,
        },
        fallbackName,
      ),
    ];
  }
  const css = files
    .filter((file) => file.path.toLowerCase().endsWith(".css"))
    .map((file) => file.text)
    .join("\n\n");
  const js = files
    .filter((file) => /\.(js|mjs|cjs)$/i.test(file.path) && !/\.server\.(js|mjs|cjs)$/i.test(file.path))
    .map((file) => file.text)
    .join("\n\n");
  if (!css && !js) return [];
  return [
    inlineEntry(
      {
        name: fallbackName || "Personal Extension",
        description: "Browser Personal Extension imported from local files",
        runtime: "client",
        capabilities: [],
        css: css || null,
        js: js || null,
      },
      fallbackName,
    ),
  ];
}

export function personalExtensionEntriesFromJson(parsed: unknown, path: string) {
  return getFolderImportEntries(parsed, ["extensions", "personalExtensions"]).map((entry) => inlineEntry(entry, path));
}

export function personalExtensionEntryFromSourceFile(
  fileName: string,
  source: string,
): FolderPackageImportEntry | null {
  if (/\.server\.(js|mjs|cjs)$/i.test(fileName)) {
    const name = fileName.replace(/\.server\.(js|mjs|cjs)$/i, "");
    return inlineEntry(
      {
        name,
        description: "Server Personal Extension imported from a local file",
        runtime: "server",
        capabilities: [],
        serverJs: source,
      },
      fileName,
    );
  }
  if (/\.(js|mjs|cjs)$/i.test(fileName)) {
    const name = fileName.replace(/\.(js|mjs|cjs)$/i, "");
    return inlineEntry(
      {
        name,
        description: "Browser Personal Extension imported from a local file",
        runtime: "client",
        capabilities: [],
        js: source,
      },
      fileName,
    );
  }
  if (/\.css$/i.test(fileName)) {
    const name = fileName.replace(/\.css$/i, "");
    return inlineEntry(
      {
        name,
        description: "CSS Personal Extension imported from a local file",
        runtime: "client",
        capabilities: [],
        css: source,
      },
      fileName,
    );
  }
  return null;
}
