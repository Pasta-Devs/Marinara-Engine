import { useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { importApi } from "../../../../shared/api/import-api";
import { storageApi } from "../../../../shared/api/storage-api";
import {
  inspectCharacterFilesForEmbeddedLorebooks,
  type EmbeddedLorebookImportPreview,
} from "../../../../shared/lib/character-import";
import { lorebookKeys } from "../../lorebooks/index";
import { classifyCharacterImportFiles } from "../lib/character-import-file-classifier";
import {
  buildCharacterImportUpdatePlan,
  type CharacterImportMode,
  type CharacterImportRow,
  type ImportResultRow,
  type TagImportMode,
} from "../lib/character-import-model";
import { extractDroppedCharacterImportFiles } from "../lib/import-drop";
import {
  cacheCharacterListRecordFromResult,
  invalidateCharacterCollectionQueries,
  useCharacterSummaries,
  useDeleteCharacter,
  useUpdateCharacter,
} from "./use-characters";

type CharacterImportStatus = "idle" | "loading" | "done";

type PendingLorebookChoice = {
  files: File[];
  previews: EmbeddedLorebookImportPreview[];
};

export function useCharacterImportFlow(open: boolean) {
  const { data: rawCharacters } = useCharacterSummaries(open);
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();
  const qc = useQueryClient();

  const [status, setStatus] = useState<CharacterImportStatus>("idle");
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [pendingLorebookChoice, setPendingLorebookChoice] = useState<PendingLorebookChoice | null>(null);
  const [tagImportMode, setTagImportMode] = useState<TagImportMode>("all");
  const [importMode, setImportMode] = useState<CharacterImportMode>("new");
  const [targetCharacterId, setTargetCharacterId] = useState("");

  const characters = (rawCharacters ?? []) as CharacterImportRow[];

  const updateImportedCharacterInPlace = async (imported: unknown, importedName: string) => {
    if (!targetCharacterId) throw new Error("Choose a character to update.");
    const target = await storageApi.get<CharacterImportRow>("characters", targetCharacterId, {
      fields: ["id", "data", "comment", "avatarPath"],
    });
    const plan = buildCharacterImportUpdatePlan(target, imported, importedName);

    await storageApi.create("character-versions", plan.snapshot);
    await updateCharacter.mutateAsync(plan.patch);

    if (plan.importedId && plan.importedId !== plan.patch.id) {
      await deleteCharacter.mutateAsync(plan.importedId);
    }

    return plan.updatedName;
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
      const {
        stCharacterFiles,
        marinaraPayloads,
        marinaraPackages,
        results: nextResults,
      } = await classifyCharacterImportFiles(files);

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

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDropError(null);
    setDragOver(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
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

  return {
    characters,
    status,
    results,
    dragOver,
    dropError,
    pendingLorebookChoice,
    tagImportMode,
    setTagImportMode,
    importMode,
    setImportMode,
    targetCharacterId,
    setTargetCharacterId,
    handleFiles,
    handleDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    reset,
  };
}
