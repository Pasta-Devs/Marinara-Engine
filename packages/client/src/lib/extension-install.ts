import type { InstalledExtension } from "@marinara-engine/shared";

export function normalizeExtensionVersion(value: unknown): string | null {
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

export function compareExtensionVersions(left: string | null | undefined, right: string | null | undefined) {
  const leftParts = parseNumericVersion(left);
  const rightParts = parseNumericVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

export function findExtensionsByName<T extends Pick<InstalledExtension, "name">>(extensions: T[], name: string) {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) return [];
  return extensions.filter((extension) => extension.name.trim().toLowerCase() === normalizedName);
}
