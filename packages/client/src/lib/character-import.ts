import { api } from "./api-client";

export interface EmbeddedLorebookImportPreview {
  filename: string;
  success: boolean;
  name?: string;
  hasEmbeddedLorebook: boolean;
  embeddedLorebookEntries: number;
  error?: string;
}

export function countLorebookEntries(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const entries = (value as Record<string, unknown>).entries;
  if (Array.isArray(entries)) return entries.length;
  if (entries && typeof entries === "object") return Object.keys(entries).length;
  return 0;
}

export function hasLorebookEntries(value: unknown): boolean {
  return countLorebookEntries(value) > 0;
}

export function readEmbeddedLorebookFromCharacterPayload(raw: Record<string, unknown>): unknown {
  const target =
    (raw.spec === "chara_card_v2" || raw.spec === "chara_card_v3") &&
    raw.data &&
    typeof raw.data === "object" &&
    !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;

  return target.character_book;
}

export function confirmEmbeddedLorebookImport(characterName: string, embeddedLorebook: unknown): boolean {
  const entryCount = countLorebookEntries(embeddedLorebook);
  if (entryCount === 0) return true;

  return window.confirm(
    `${characterName} includes an embedded lorebook with ${entryCount} entr${entryCount === 1 ? "y" : "ies"}.\n\nImport it as a standalone Marinara lorebook too?`,
  );
}

export async function inspectCharacterFilesForEmbeddedLorebooks(
  files: File[],
): Promise<EmbeddedLorebookImportPreview[]> {
  if (files.length === 0) return [];

  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const result = await api.upload<{
    success: boolean;
    results: EmbeddedLorebookImportPreview[];
  }>("/import/st-character/inspect", form);

  return result.results.filter((item) => item.success && item.hasEmbeddedLorebook);
}
