// ──────────────────────────────────────────────
// Modal: Import Character (JSON / PNG)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../../../../shared/components/ui/Modal";
import { Download, FileJson, Image, CheckCircle, XCircle, Loader2, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cacheCharacterListRecordFromResult,
  invalidateCharacterCollectionQueries,
  useCharacterSummaries,
  useDeleteCharacter,
  useUpdateCharacter,
} from "../hooks/use-characters";
import { lorebookKeys } from "../../lorebooks/index";
import { importApi } from "../../../../shared/api/import-api";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  inspectCharacterFilesForEmbeddedLorebooks,
  type EmbeddedLorebookImportPreview,
} from "../../../../shared/lib/character-import";
import {
  CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE,
  extractDroppedCharacterImportFiles,
  isSupportedCharacterImportFilename,
} from "../lib/import-drop";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ImportResultRow = {
  filename: string;
  success: boolean;
  message: string;
};

type TagImportMode = "all" | "none" | "existing";
type CharacterRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  data?: unknown;
  comment?: string;
  avatarPath?: string;
};

const TAG_IMPORT_OPTIONS: Array<{ value: TagImportMode; label: string; description: string }> = [
  { value: "all", label: "All tags", description: "Keep source tags." },
  { value: "none", label: "No tags", description: "Skip source tags." },
  { value: "existing", label: "Existing only", description: "Keep tags already in Marinara." },
];

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
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

function characterData(row: CharacterRow | null | undefined): Record<string, unknown> {
  return readRecord(row?.data);
}

function characterDisplayName(row: CharacterRow | null | undefined): string {
  return readString(row?.name) || readString(characterData(row).name) || "Unnamed character";
}

export function ImportCharacterModal({ open, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: rawCharacters } = useCharacterSummaries(open);
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [pendingLorebookChoice, setPendingLorebookChoice] = useState<{
    files: File[];
    previews: EmbeddedLorebookImportPreview[];
  } | null>(null);
  const [tagImportMode, setTagImportMode] = useState<TagImportMode>("all");
  const [importMode, setImportMode] = useState<"new" | "update">("new");
  const [targetCharacterId, setTargetCharacterId] = useState("");
  const qc = useQueryClient();
  const characters = (rawCharacters ?? []) as CharacterRow[];

  const updateImportedCharacterInPlace = async (imported: unknown, importedName: string) => {
    if (!targetCharacterId) throw new Error("Choose a character to update.");
    const target = await storageApi.get<CharacterRow>("characters", targetCharacterId, {
      fields: ["id", "data", "comment", "avatarPath"],
    });
    if (!target?.id) throw new Error("Target character not found.");
    const importedRow =
      imported && typeof imported === "object" && !Array.isArray(imported) ? (imported as CharacterRow) : null;
    const importedData = characterData(importedRow);
    if (Object.keys(importedData).length === 0) throw new Error("Imported character record did not include card data.");

    const targetData = characterData(target);
    await storageApi.create("character-versions", {
      characterId: target.id,
      data: targetData,
      comment: readString(target.comment),
      avatarPath: target.avatarPath ?? null,
      version: readString(targetData.character_version, "current"),
      source: "import",
      reason: `Before in-place import from ${importedName}`,
    });

    const patch: Parameters<typeof updateCharacter.mutateAsync>[0] = {
      id: target.id,
      data: importedData,
      comment: readString(importedRow?.comment),
      versionSource: "import",
      versionReason: `Imported updated card from ${importedName}`,
    };
    if (readString(importedRow?.avatarPath).trim()) patch.avatarPath = readString(importedRow?.avatarPath);
    await updateCharacter.mutateAsync(patch);

    const importedId = readString(importedRow?.id);
    if (importedId && importedId !== target.id) {
      await deleteCharacter.mutateAsync(importedId);
    }

    return characterDisplayName(target);
  };

  const isZipFile = async (file: File): Promise<boolean> => {
    if (file.size < 4) return false;
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b;
  };

  const handleFiles = async (files: File[], importEmbeddedLorebook?: boolean) => {
    if (files.length === 0) return;
    if (importMode === "update" && !targetCharacterId) {
      setResults([
        {
          filename: files.length === 1 ? files[0]!.name : `${files.length} files`,
          success: false,
          message: "Choose a character to update first.",
        },
      ]);
      setStatus("done");
      return;
    }
    if (importMode === "update" && files.length !== 1) {
      setResults([
        {
          filename: `${files.length} files`,
          success: false,
          message: "Update existing accepts one character file at a time.",
        },
      ]);
      setStatus("done");
      return;
    }
    setStatus("loading");
    setResults([]);
    setPendingLorebookChoice(null);
    setDropError(null);

    try {
      const stCharacterFiles: File[] = [];
      const marinaraPayloads: Array<{ file: File; payload: Record<string, unknown> }> = [];
      const marinaraPackages: File[] = [];
      const nextResults: ImportResultRow[] = [];

      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".png") || lower.endsWith(".charx")) {
          stCharacterFiles.push(file);
          continue;
        }

        // Marinara native files are .marinara zip files (data.json + avatar
        // binary). Detect via the zip signature so a renamed file still works.
        if (await isZipFile(file)) {
          marinaraPackages.push(file);
          continue;
        }

        if (!isSupportedCharacterImportFilename(file.name)) {
          nextResults.push({
            filename: file.name,
            success: false,
            message: CHARACTER_IMPORT_UNSUPPORTED_FILE_MESSAGE,
          });
          continue;
        }

        const text = await file.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(text) as Record<string, unknown>;
        } catch (error) {
          nextResults.push({
            filename: file.name,
            success: false,
            message: error instanceof Error ? error.message : "Invalid JSON file",
          });
          continue;
        }
        const isMarinaraEnvelope =
          json.version === 1 && typeof json.type === "string" && (json.type as string).startsWith("marinara_");

        if (isMarinaraEnvelope) {
          marinaraPayloads.push({ file, payload: json });
        } else {
          stCharacterFiles.push(file);
        }
      }

      const hasImportableFiles =
        stCharacterFiles.length > 0 || marinaraPayloads.length > 0 || marinaraPackages.length > 0;
      if (!hasImportableFiles) {
        setResults(nextResults);
        setStatus("done");
        return;
      }

      if (importMode !== "update" && stCharacterFiles.length > 0 && importEmbeddedLorebook === undefined) {
        const previews = await inspectCharacterFilesForEmbeddedLorebooks(stCharacterFiles);
        if (previews.length > 0) {
          setPendingLorebookChoice({ files, previews });
          setStatus("idle");
          return;
        }
      }

      let importedLorebook = false;
      let importedCharacterMissingCacheRecord = false;

      if (stCharacterFiles.length > 0) {
        const shouldImportEmbeddedLorebook = importMode === "update" ? false : (importEmbeddedLorebook ?? true);
        const form = new FormData();
        for (const file of stCharacterFiles) {
          form.append("files", file);
        }
        form.append(
          "fileTimestamps",
          JSON.stringify(
            stCharacterFiles.map((file) => ({
              name: file.name,
              lastModified: file.lastModified,
            })),
          ),
        );
        form.append("importEmbeddedLorebook", String(shouldImportEmbeddedLorebook));
        form.append("tagImportMode", tagImportMode);

        const batchResult = await importApi.stCharacterBatch<{
          success: boolean;
          results: Array<{
            filename: string;
            success: boolean;
            name?: string;
            error?: string;
            character?: unknown;
            lorebook?: { lorebookId?: string };
            embeddedLorebook?: { hasEmbeddedLorebook?: boolean; skipped?: boolean; entries?: number };
          }>;
        }>(form);

        for (const result of batchResult.results) {
          if (result.lorebook?.lorebookId) importedLorebook = true;
          if (result.success) {
            if (importMode === "update") {
              const updatedName = await updateImportedCharacterInPlace(
                result.character,
                result.name ?? result.filename,
              );
              nextResults.push({
                filename: result.filename,
                success: true,
                message: `Updated "${updatedName}" from "${result.name ?? result.filename}"`,
              });
              continue;
            } else {
              const cached = cacheCharacterListRecordFromResult(qc, result);
              if (!cached) importedCharacterMissingCacheRecord = true;
            }
          }
          nextResults.push({
            filename: result.filename,
            success: result.success,
            message: result.success
              ? `Imported "${result.name ?? result.filename}"${
                  result.embeddedLorebook?.skipped
                    ? " without creating the embedded lorebook"
                    : result.lorebook?.lorebookId
                      ? " with its embedded lorebook"
                      : ""
                }`
              : (result.error ?? "Import failed"),
          });
        }
      }

      for (const item of marinaraPayloads) {
        try {
          const result = await importApi.marinara<{
            success: boolean;
            name?: string;
            error?: string;
            character?: unknown;
          }>({
            ...item.payload,
            timestampOverrides: {
              createdAt: item.file.lastModified,
              updatedAt: item.file.lastModified,
            },
          });

          if (result.success) {
            if (importMode === "update") {
              const updatedName = await updateImportedCharacterInPlace(result.character, result.name ?? item.file.name);
              nextResults.push({
                filename: item.file.name,
                success: true,
                message: `Updated "${updatedName}" from "${result.name ?? item.file.name}"`,
              });
              continue;
            } else {
              const cached = cacheCharacterListRecordFromResult(qc, result);
              if (!cached) importedCharacterMissingCacheRecord = true;
            }
          }
          nextResults.push({
            filename: item.file.name,
            success: result.success,
            message: result.success ? `Imported "${result.name ?? item.file.name}"` : (result.error ?? "Import failed"),
          });
        } catch (error) {
          nextResults.push({
            filename: item.file.name,
            success: false,
            message: error instanceof Error ? error.message : "Import failed",
          });
        }
      }

      for (const file of marinaraPackages) {
        try {
          const result = await importApi.marinaraFile<{
            success: boolean;
            name?: string;
            error?: string;
            character?: unknown;
          }>({
            file,
            fields: {
              timestampOverrides: JSON.stringify({
                createdAt: file.lastModified,
                updatedAt: file.lastModified,
              }),
            },
          });
          if (result.success) {
            if (importMode === "update") {
              const updatedName = await updateImportedCharacterInPlace(result.character, result.name ?? file.name);
              nextResults.push({
                filename: file.name,
                success: true,
                message: `Updated "${updatedName}" from "${result.name ?? file.name}"`,
              });
              continue;
            } else {
              const cached = cacheCharacterListRecordFromResult(qc, result);
              if (!cached) importedCharacterMissingCacheRecord = true;
            }
          }
          nextResults.push({
            filename: file.name,
            success: result.success,
            message: result.success ? `Imported "${result.name ?? file.name}"` : (result.error ?? "Import failed"),
          });
        } catch (error) {
          nextResults.push({
            filename: file.name,
            success: false,
            message: error instanceof Error ? error.message : "Import failed",
          });
        }
      }

      setResults(nextResults);
      setStatus("done");

      if (importedCharacterMissingCacheRecord) {
        invalidateCharacterCollectionQueries(qc);
      }
      if (importedLorebook) {
        qc.invalidateQueries({ queryKey: lorebookKeys.all });
      }
    } catch (err) {
      setResults([
        {
          filename: files.length === 1 ? files[0]!.name : `${files.length} files`,
          success: false,
          message: err instanceof Error ? err.message : "Failed to parse import files",
        },
      ]);
      setStatus("done");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const { files, error } = extractDroppedCharacterImportFiles(e.dataTransfer);
    if (error) {
      setDropError(error);
      setPendingLorebookChoice(null);
      setStatus("idle");
      setResults([]);
      return;
    }

    void handleFiles(files);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDropError(null);
    setDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const nextTarget = e.relatedTarget;
    if (nextTarget instanceof Node && e.currentTarget.contains(nextTarget)) return;
    setDragOver(false);
  };

  const reset = () => {
    setStatus("idle");
    setResults([]);
    setPendingLorebookChoice(null);
    setTagImportMode("all");
    setImportMode("new");
    setTargetCharacterId("");
    setDropError(null);
    setDragOver(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import Character"
    >
      <div className="flex flex-col gap-4">
        {pendingLorebookChoice && (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 p-4">
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 shrink-0 text-[var(--primary)]" size="1.125rem" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">Embedded lorebook found</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  Import the embedded lorebook as a standalone Marinara lorebook, or keep it only inside the character
                  card.
                </p>
                <div className="mt-3 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)]/70 bg-[var(--background)]/40">
                  {pendingLorebookChoice.previews.map((preview) => (
                    <div
                      key={`${preview.filename}-${preview.name ?? ""}`}
                      className="flex items-center justify-between gap-3 border-b border-[var(--border)]/60 px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="min-w-0 truncate font-medium">{preview.name ?? preview.filename}</span>
                      <span className="shrink-0 text-[var(--muted-foreground)]">
                        {preview.embeddedLorebookEntries} {preview.embeddedLorebookEntries === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void handleFiles(pendingLorebookChoice.files, false)}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    No Import
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFiles(pendingLorebookChoice.files, true)}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
                  >
                    Import Lorebook
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
          <div className="mb-2">
            <p className="text-xs font-semibold text-[var(--foreground)]">Import target</p>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
              Import as a new card, or update one existing character while keeping its chat links.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                importMode === "new"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
              }`}
            >
              <input
                type="radio"
                name="characterImportMode"
                value="new"
                checked={importMode === "new"}
                onChange={() => setImportMode("new")}
                className="sr-only"
              />
              <span className="block text-xs font-medium text-[var(--foreground)]">New copy</span>
              <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                Create separate imported characters.
              </span>
            </label>
            <label
              className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                importMode === "update"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10"
                  : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
              }`}
            >
              <input
                type="radio"
                name="characterImportMode"
                value="update"
                checked={importMode === "update"}
                onChange={() => setImportMode("update")}
                className="sr-only"
              />
              <span className="block text-xs font-medium text-[var(--foreground)]">Update existing</span>
              <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                Save the current card to version history first.
              </span>
            </label>
          </div>
          {importMode === "update" && (
            <select
              value={targetCharacterId}
              onChange={(event) => setTargetCharacterId(event.target.value)}
              className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            >
              <option value="">Choose character to update</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {characterDisplayName(character)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">Imported card tags</p>
              <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                Choose how source-site tags are applied to character cards.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TAG_IMPORT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                  tagImportMode === option.value
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
                }`}
              >
                <input
                  type="radio"
                  name="tagImportMode"
                  value={option.value}
                  checked={tagImportMode === option.value}
                  onChange={() => setTagImportMode(option.value)}
                  className="sr-only"
                />
                <span className="block text-xs font-medium text-[var(--foreground)]">{option.label}</span>
                <span className="mt-1 block text-[0.625rem] leading-snug text-[var(--muted-foreground)]">
                  {option.description}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all ${
            dragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Download
            size="2rem"
            className={`transition-colors ${dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}
          />
          <div className="text-center">
            <p className="text-sm font-medium">Drop one or more files here or click to browse</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Supports JSON, PNG character cards, CharX, and Marinara exports
            </p>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .json
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <Image size="0.75rem" /> .png
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .charx
            </span>
            <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
              <FileJson size="0.75rem" /> .marinara
            </span>
          </div>
        </div>

        {dropError && (
          <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
            {dropError}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".json,.png,.marinara,.charx"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {/* Status */}
        {status === "loading" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs">
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />
            Importing files...
          </div>
        )}
        {status === "done" && results.length > 0 && (
          <div className="flex flex-col gap-2">
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                results.some((result) => result.success)
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
              }`}
            >
              {results.some((result) => result.success) ? <CheckCircle size="0.875rem" /> : <XCircle size="0.875rem" />}
              {results.filter((result) => result.success).length} succeeded,{" "}
              {results.filter((result) => !result.success).length} failed
            </div>

            <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border)]">
              {results.map((result) => (
                <div
                  key={`${result.filename}-${result.message}`}
                  className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2 text-xs last:border-b-0"
                >
                  {result.success ? (
                    <CheckCircle size="0.8125rem" className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{result.filename}</div>
                    <div className="text-[var(--muted-foreground)]">{result.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
