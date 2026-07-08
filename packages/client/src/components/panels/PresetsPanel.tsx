// ──────────────────────────────────────────────
// Panel: Presets (overhauled — search, assign, edit, duplicate)
// ──────────────────────────────────────────────
import {
  useState,
  useMemo,
  useCallback,
  useRef,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { usePresets, useDeletePreset, useDuplicatePreset, useSetDefaultPreset } from "../../hooks/use-presets";
import { useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import {
  useRegexScripts,
  useDeleteRegexScript,
  useCreateRegexScript,
  useUpdateRegexScript,
  useReorderRegexScripts,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import {
  useCustomTools,
  useCreateCustomTool,
  useUpdateCustomTool,
  useDeleteCustomTool,
  useCustomToolCapabilities,
  useReorderCustomTools,
  type CustomToolCapabilities,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore, type ResourcePanelSort } from "../../stores/ui.store";
import { api, ApiError } from "../../lib/api-client";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import {
  Plus,
  Download,
  FileText,
  Trash2,
  Check,
  Copy,
  Search,
  ArrowUpDown,
  Code2,
  Hash,
  Star,
  Regex,
  GripVertical,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Wrench,
  Upload,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sortBasicPanelItems } from "../../lib/panel-sort";
import { downloadJsonFile } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import { getFolderImportEntries } from "@marinara-engine/shared";
import {
  createCustomToolFolderPackageFiles,
  importCustomToolEntries,
  serializeCustomToolForTransfer,
} from "../../lib/custom-tool-transfer";
import { collectFolderPackageEntries, type FolderPackageImportEntry } from "../../lib/folder-package-transfer";
import { isZipFile, readTextFilesFromZip } from "../../lib/read-zip-text";
import { SettingsSwitch } from "./settings/SettingControls";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import { handleFolderRenameKeyDown, useFolderRenameGesture } from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { TouchDragHandle } from "../ui/TouchDragHandle";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";

type PresetRow = {
  id: string;
  name: string;
  description: string;
  wrapFormat?: string;
  isDefault?: string | boolean;
  author?: string;
  sectionOrder?: string | string[];
  createdAt?: string;
  updatedAt?: string;
};

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseBooleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
}

function parseStringArray(value: unknown): string[] {
  const parsed = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const json = JSON.parse(value);
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  })();

  return parsed.filter((item): item is string => typeof item === "string");
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type RegexApplyMode = "prompt" | "display" | "both";

function isRegexApplyMode(value: unknown): value is RegexApplyMode {
  return value === "prompt" || value === "display" || value === "both";
}

function looksLikeSillyTavernRegex(entry: Record<string, unknown>): boolean {
  return (
    typeof entry.scriptName === "string" ||
    (Array.isArray(entry.placement) && entry.placement.some((placement) => typeof placement === "number")) ||
    "markdownOnly" in entry ||
    "markdown_only" in entry ||
    "onlyFormatDisplay" in entry
  );
}

function readRegexApplyMode(entry: Record<string, unknown>): RegexApplyMode {
  if (isRegexApplyMode(entry.applyMode)) return entry.applyMode;
  const promptOnly =
    parseBooleanValue(entry.promptOnly, false) ||
    parseBooleanValue(entry.prompt_only, false) ||
    parseBooleanValue(entry.onlyFormatPrompt, false);
  const markdownOnly =
    parseBooleanValue(entry.markdownOnly, false) ||
    parseBooleanValue(entry.markdown_only, false) ||
    parseBooleanValue(entry.onlyFormatDisplay, false);
  if (promptOnly && !markdownOnly) return "prompt";
  if (markdownOnly && !promptOnly) return "display";
  if (looksLikeSillyTavernRegex(entry)) return "both";
  return promptOnly ? "prompt" : "display";
}

function getImportEntries(parsed: unknown, envelopeKeys: string[]) {
  return getFolderImportEntries(parsed, envelopeKeys);
}

function serializeRegexScript(script: RegexScriptRow) {
  return {
    name: script.name,
    enabled: parseBooleanValue(script.enabled),
    findRegex: script.findRegex,
    replaceString: script.replaceString,
    trimStrings: parseStringArray(script.trimStrings),
    placement: parseStringArray(script.placement),
    flags: script.flags,
    promptOnly: parseBooleanValue(script.promptOnly, false),
    applyMode: isRegexApplyMode(script.applyMode) ? script.applyMode : readRegexApplyMode(script as unknown as Record<string, unknown>),
    targetCharacterIds: parseStringArray(script.targetCharacterIds),
    order: script.order,
    minDepth: script.minDepth,
    maxDepth: script.maxDepth,
  };
}

function describeImportError(error: unknown): string {
  if (error instanceof ApiError && isJsonRecord(error.payload)) {
    const details = error.payload.details ?? error.payload.issues;
    if (Array.isArray(details)) {
      const messages = details
        .map((issue) => {
          if (!isJsonRecord(issue) || typeof issue.message !== "string") return null;
          const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .filter((message): message is string => !!message);
      if (messages.length > 0) return messages[0]!;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Failed to import";
}

function getNextRegexOrderBase(regexScripts: RegexScriptRow[] | undefined) {
  return (regexScripts ?? []).reduce((maxOrder, script) => Math.max(maxOrder, script.order), -1) + 1;
}

function getUnsupportedStRegexPlacements(entry: unknown): number[] {
  if (!isJsonRecord(entry) || !Array.isArray(entry.placement)) return [];
  return entry.placement.filter(
    (placement): placement is number =>
      typeof placement === "number" && placement !== 0 && placement !== 1 && placement !== 2,
  );
}

function normalizeRegexImportEntry(entry: unknown, fallbackOrder: number) {
  if (!isJsonRecord(entry)) return null;
  const name =
    typeof entry.name === "string" ? entry.name : typeof entry.scriptName === "string" ? entry.scriptName : "";
  let findRegex = typeof entry.findRegex === "string" ? entry.findRegex : "";
  let flags = typeof entry.flags === "string" ? entry.flags : "gi";
  const delimited = findRegex.match(/^\/(.+)\/([dgimsuy]*)$/s);
  if (delimited) {
    findRegex = delimited[1] ?? "";
    flags = delimited[2] || "g";
  }
  if (!name || !findRegex) return null;

  const stPlacementMap: Record<number, string> = { 0: "ai_output", 1: "user_input", 2: "ai_output" };
  const rawPlacement = Array.isArray(entry.placement) ? entry.placement : [];
  const mappedPlacement = rawPlacement
    .map((placementValue) => (typeof placementValue === "number" ? stPlacementMap[placementValue] : placementValue))
    .filter(
      (placementValue): placementValue is string => placementValue === "ai_output" || placementValue === "user_input",
    );

  return {
    name,
    enabled: parseBooleanValue(entry.enabled, entry.disabled === undefined ? true : !parseBooleanValue(entry.disabled)),
    findRegex,
    replaceString: typeof entry.replaceString === "string" ? entry.replaceString : "",
    trimStrings: parseStringArray(entry.trimStrings),
    placement: mappedPlacement.length > 0 ? mappedPlacement : ["ai_output"],
    flags,
    promptOnly: readRegexApplyMode(entry) === "prompt",
    applyMode: readRegexApplyMode(entry),
    targetCharacterIds: parseStringArray(entry.targetCharacterIds),
    order: typeof entry.order === "number" ? fallbackOrder + entry.order : fallbackOrder,
    minDepth: parseNullableNumber(entry.minDepth),
    maxDepth: parseNullableNumber(entry.maxDepth),
  };
}

export function PresetsPanel() {
  const { data: presets, isLoading } = usePresets();
  const { data: regexScripts } = useRegexScripts();
  const { data: customTools } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const deletePreset = useDeletePreset();
  const duplicatePreset = useDuplicatePreset();
  const setDefaultPreset = useSetDefaultPreset();
  const deleteRegex = useDeleteRegexScript();
  const createRegexScript = useCreateRegexScript();
  const updateRegex = useUpdateRegexScript();
  const reorderRegexScripts = useReorderRegexScripts();
  const createCustomTool = useCreateCustomTool();
  const updateCustomTool = useUpdateCustomTool();
  const deleteCustomTool = useDeleteCustomTool();
  const reorderCustomTools = useReorderCustomTools();
  const { data: presetFolders = [] } = useLibraryFolders("presets");
  const createPresetFolder = useCreateLibraryFolder("presets");
  const updatePresetFolder = useUpdateLibraryFolder("presets");
  const deletePresetFolder = useDeleteLibraryFolder("presets");
  const movePresetItem = useMoveLibraryItem("presets");
  const openModal = useUIStore((s) => s.openModal);
  const openPresetDetail = useUIStore((s) => s.openPresetDetail);
  const openRegexDetail = useUIStore((s) => s.openRegexDetail);
  const openToolDetail = useUIStore((s) => s.openToolDetail);
  const sort = useUIStore((s) => s.presetPanelSort);
  const setSort = useUIStore((s) => s.setPresetPanelSort);
  const activeChat = useChatStore((s) => s.activeChat);
  const updateChat = useUpdateChat();
  const updateMetadata = useUpdateChatMetadata();
  const [search, setSearch] = useState("");
  const [choiceModalPresetId, setChoiceModalPresetId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [regexImportError, setRegexImportError] = useState<string | null>(null);
  const [regexImportSuccess, setRegexImportSuccess] = useState<string | null>(null);
  const [functionImportError, setFunctionImportError] = useState<string | null>(null);
  const [functionImportSuccess, setFunctionImportSuccess] = useState<string | null>(null);
  const [draggedRegexId, setDraggedRegexId] = useState<string | null>(null);
  const [regexDragReadyId, setRegexDragReadyId] = useState<string | null>(null);
  const [draggedFunctionId, setDraggedFunctionId] = useState<string | null>(null);
  const [functionDragReadyId, setFunctionDragReadyId] = useState<string | null>(null);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedPresetId, setDraggedPresetId] = useState<string | null>(null);
  const suppressPresetClickRef = useRef(false);
  const handleFolderRenameGesture = useFolderRenameGesture();

  const canAssignToActiveChat = !!activeChat && activeChat.mode !== "conversation";
  const activePresetId = canAssignToActiveChat ? (activeChat?.promptPresetId ?? null) : null;

  const filteredPresets = useMemo(() => {
    if (!presets) return [];
    if (!search.trim()) return presets as unknown as PresetRow[];
    const q = search.toLowerCase();
    return (presets as unknown as PresetRow[]).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        (p.author ?? "").toLowerCase().includes(q),
    );
  }, [presets, search]);
  const sortedPresets = useMemo(
    () =>
      sortBasicPanelItems(
        filteredPresets,
        sort,
        (preset) => preset.name,
        (preset) => preset.createdAt || preset.updatedAt,
      ),
    [filteredPresets, sort],
  );
  const presetSearchActive = search.trim().length > 0;

  const presetById = useMemo(() => new Map(sortedPresets.map((preset) => [preset.id, preset])), [sortedPresets]);

  const folderedPresetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of presetFolders) {
      for (const id of folder.itemIds) ids.add(id);
    }
    return ids;
  }, [presetFolders]);

  const rootPresets = useMemo(
    () => sortedPresets.filter((preset) => !folderedPresetIds.has(preset.id)),
    [sortedPresets, folderedPresetIds],
  );

  // Presets shows GLOBAL regex scripts only. Character-scoped scripts (non-empty
  // targetCharacterIds) live on the character (Advanced tab) and in a chat's
  // Scoped Regex Scripts settings, so they are filtered out here.
  const sortedRegexScripts = useMemo(
    () =>
      ((regexScripts ?? []) as RegexScriptRow[])
        .filter((script) => parseStringArray(script.targetCharacterIds).length === 0)
        .sort((a, b) => a.order - b.order),
    [regexScripts],
  );

  const customToolRows = useMemo(
    () =>
      ((customTools ?? []) as CustomToolRow[]).slice().sort((a, b) => {
        const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (orderDiff !== 0) return orderDiff;
        const updatedDiff = b.updatedAt.localeCompare(a.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;
        return a.name.localeCompare(b.name);
      }),
    [customTools],
  );

  const selectPreset = useCallback(
    (presetId: string) => {
      if (!activeChat) return;
      if (activeChat.mode === "conversation") {
        toast.error("Prompt presets are not available in conversation mode.");
        return;
      }
      const newId = activePresetId === presetId ? null : presetId;
      // Clear stale preset choices from the previous preset before switching
      updateMetadata.mutate({ id: activeChat.id, presetChoices: {} });
      updateChat.mutate(
        { id: activeChat.id, promptPresetId: newId },
        {
          onSuccess: async () => {
            if (!newId) {
              setChoiceModalPresetId(null);
              return;
            }

            try {
              const presetFull = await api.get<{ choiceBlocks?: unknown[] }>(`/prompts/${newId}/full`);
              if ((presetFull.choiceBlocks?.length ?? 0) > 0) {
                setChoiceModalPresetId(newId);
              } else {
                setChoiceModalPresetId(null);
              }
            } catch {
              setChoiceModalPresetId(null);
            }
          },
        },
      );
    },
    [activeChat, activePresetId, updateChat, updateMetadata],
  );

  const getSectionCount = useCallback((preset: PresetRow) => {
    try {
      const order = preset.sectionOrder;
      if (Array.isArray(order)) return order.length;
      return JSON.parse(order ?? "[]").length;
    } catch {
      return 0;
    }
  }, []);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPresetIds(new Set());
  };

  const toggleSelection = useCallback((presetId: string) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(presetId)) next.delete(presetId);
      else next.add(presetId);
      return next;
    });
  }, []);

  const handleExportSelected = async () => {
    if (selectedPresetIds.size === 0) return;
    setExportingSelected(true);
    try {
      await api.downloadPost("/prompts/export-bulk", { ids: [...selectedPresetIds] }, "marinara-presets.zip");
      toast.success(`Exported ${selectedPresetIds.size} preset${selectedPresetIds.size === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export presets");
    } finally {
      setExportingSelected(false);
    }
  };

  const handleCreateRegex = useCallback(() => {
    openRegexDetail("__new__");
  }, [openRegexDetail]);

  const handleCreateFunction = useCallback(() => {
    openToolDetail("__new__");
  }, [openToolDetail]);

  const handleExportRegex = useCallback(() => {
    if (sortedRegexScripts.length === 0) {
      toast.error("No regexes to export");
      return;
    }

    downloadJsonFile(
      {
        kind: "marinara.regex-scripts",
        version: 1,
        exportedAt: new Date().toISOString(),
        regexScripts: sortedRegexScripts.map(serializeRegexScript),
      },
      "marinara-regexes.json",
    );
    toast.success(`Exported ${sortedRegexScripts.length} regex${sortedRegexScripts.length === 1 ? "" : "es"}`);
  }, [sortedRegexScripts]);

  const handleImportRegex = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setRegexImportError(null);
      setRegexImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const entries = getImportEntries(parsed, ["regexScripts", "regexes", "scripts"]);
        if (entries.length === 0) throw new Error("No regex scripts found in file");

        let imported = 0;
        const failed: string[] = [];
        const orderBase = getNextRegexOrderBase((regexScripts ?? []) as RegexScriptRow[]);
        for (const [index, entry] of entries.entries()) {
          const unsupportedPlacements = getUnsupportedStRegexPlacements(entry);
          if (unsupportedPlacements.length > 0) {
            failed.push(
              `Entry ${index + 1}: unsupported SillyTavern placement ${unsupportedPlacements.join(", ")} was skipped.`,
            );
            continue;
          }
          const normalized = normalizeRegexImportEntry(entry, orderBase + index);
          if (!normalized) {
            failed.push(`Entry ${index + 1}: missing name or find pattern.`);
            continue;
          }
          try {
            await createRegexScript.mutateAsync(normalized);
            imported++;
          } catch (error) {
            failed.push(`Entry ${index + 1} (${normalized.name}): ${describeImportError(error)}`);
          }
        }

        if (imported > 0) {
          setRegexImportSuccess(`Imported ${imported} regex script${imported === 1 ? "" : "s"}.`);
        }
        if (failed.length > 0) {
          setRegexImportError(`Skipped ${failed.length} regex script${failed.length === 1 ? "" : "s"}. ${failed[0]}`);
        }
        if (imported === 0 && failed.length === 0) {
          setRegexImportError("No valid regex scripts found in file.");
        }
      } catch (error) {
        setRegexImportError(error instanceof Error ? error.message : "Failed to import regex scripts");
      }

      event.target.value = "";
    },
    [createRegexScript, regexScripts],
  );

  const handleExportFunctions = useCallback(() => {
    if (customToolRows.length === 0) {
      toast.error("No functions to export");
      return;
    }

    downloadZipFile(
      createCustomToolFolderPackageFiles(customToolRows.map(serializeCustomToolForTransfer)),
      "marinara-functions.zip",
    );
    toast.success(`Exported ${customToolRows.length} function${customToolRows.length === 1 ? "" : "s"}`);
  }, [customToolRows]);

  const handleImportFunctions = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setFunctionImportError(null);
      setFunctionImportSuccess(null);
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const entries: FolderPackageImportEntry[] = isZipFile(file)
          ? collectFolderPackageEntries(await readTextFilesFromZip(file), {
              rootFilenames: ["marinara-functions.json"],
              collectionKeys: ["functions", "customTools", "tools"],
            })
          : getImportEntries(JSON.parse(await file.text()), ["functions", "customTools", "tools"]).map(
              (raw): FolderPackageImportEntry => ({
                raw,
                path: file.name,
                basePath: "",
                resolveTextFile: () => null,
              }),
            );
        if (entries.length === 0) throw new Error("No functions found in file");

        const { imported, failed } = await importCustomToolEntries(entries, createCustomTool);

        if (imported === 0 && failed.length === 0) {
          throw new Error("No valid functions found in file");
        }

        if (imported > 0) {
          setFunctionImportSuccess(`Imported ${imported} function${imported === 1 ? "" : "s"}.`);
        }
        if (failed.length > 0) {
          setFunctionImportError(`${failed.length} function${failed.length === 1 ? "" : "s"} failed. ${failed[0]}`);
        }
      } catch (error) {
        setFunctionImportError(error instanceof Error ? error.message : "Failed to import functions");
      }

      event.target.value = "";
    },
    [createCustomTool],
  );

  const handleRegexReorderToIndex = useCallback(
    (sourceId: string, targetIdx: number) => {
      const nextIds = sortedRegexScripts.map((script) => script.id);
      const from = nextIds.indexOf(sourceId);
      if (from < 0 || targetIdx < 0 || targetIdx > nextIds.length) return;
      let insertAt = targetIdx;
      if (from < insertAt) insertAt--;
      if (from === insertAt) return;
      const [moved] = nextIds.splice(from, 1);
      if (!moved) return;
      nextIds.splice(insertAt, 0, moved);
      reorderRegexScripts.mutate(nextIds);
      setDraggedRegexId(null);
      setRegexDragReadyId(null);
    },
    [reorderRegexScripts, sortedRegexScripts],
  );

  const handleRegexDrop = useCallback(
    (targetId: string) => {
      if (!draggedRegexId || draggedRegexId === targetId) return;
      const targetIdx = sortedRegexScripts.findIndex((script) => script.id === targetId);
      if (targetIdx < 0) return;
      handleRegexReorderToIndex(draggedRegexId, targetIdx);
    },
    [draggedRegexId, handleRegexReorderToIndex, sortedRegexScripts],
  );

  const handleFunctionReorderToIndex = useCallback(
    (sourceId: string, targetIdx: number) => {
      const nextIds = customToolRows.map((tool) => tool.id);
      const from = nextIds.indexOf(sourceId);
      if (from < 0 || targetIdx < 0 || targetIdx > nextIds.length) return;
      let insertAt = targetIdx;
      if (from < insertAt) insertAt--;
      if (from === insertAt) return;
      const [moved] = nextIds.splice(from, 1);
      if (!moved) return;
      nextIds.splice(insertAt, 0, moved);
      reorderCustomTools.mutate(nextIds);
      setDraggedFunctionId(null);
      setFunctionDragReadyId(null);
    },
    [customToolRows, reorderCustomTools],
  );

  const handleFunctionDrop = useCallback(
    (targetId: string) => {
      if (!draggedFunctionId || draggedFunctionId === targetId) return;
      const targetIdx = customToolRows.findIndex((tool) => tool.id === targetId);
      if (targetIdx < 0) return;
      handleFunctionReorderToIndex(draggedFunctionId, targetIdx);
    },
    [customToolRows, draggedFunctionId, handleFunctionReorderToIndex],
  );

  const handleDeleteSelected = useCallback(async () => {
    const ids = [...selectedPresetIds];
    if (ids.length === 0) return;

    if (
      !(await showConfirmDialog({
        title: "Delete Presets",
        message: `Delete ${ids.length} preset${ids.length === 1 ? "" : "s"}?`,
        confirmLabel: "Delete",
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deletePreset.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} preset${deletedCount === 1 ? "" : "s"}`);
    }

    if (failedIds.length > 0) {
      setSelectedPresetIds(new Set(failedIds));
      toast.error(`Failed to delete ${failedIds.length} preset${failedIds.length === 1 ? "" : "s"}`);
      return;
    }

    exitSelectionMode();
  }, [selectedPresetIds, deletePreset]);

  const handleCreateFolder = useCallback(() => {
    createPresetFolder.mutate(
      { name: getNextUnnamedLibraryFolderName(presetFolders) },
      {
        onSuccess: (folder) => {
          setExpandedFolderId(folder.id);
        },
      },
    );
  }, [createPresetFolder, presetFolders]);

  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const name = editFolderName.trim();
      if (name) updatePresetFolder.mutate({ id: folderId, name });
      setEditingFolderId(null);
      setEditFolderName("");
    },
    [editFolderName, updatePresetFolder],
  );

  const getDraggedPresetIds = useCallback(
    (presetId: string) =>
      selectionMode && selectedPresetIds.has(presetId) ? Array.from(selectedPresetIds) : [presetId],
    [selectedPresetIds, selectionMode],
  );

  const movePresetsToFolder = useCallback(
    (presetIds: string[], folderId: string | null) => {
      movePresetItem.mutate({ itemIds: presetIds, folderId });
    },
    [movePresetItem],
  );

  const handlePresetDrop = useCallback(
    (folderId: string | null, presetIds?: string[]) => {
      if (!draggedPresetId) return;
      movePresetsToFolder(presetIds ?? [draggedPresetId], folderId);
      setDraggedPresetId(null);
    },
    [draggedPresetId, movePresetsToFolder],
  );

  const finishPresetTouchDrag = useCallback(
    (presetId: string, x: number, y: number) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-preset-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-preset-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.presetFolderId) {
        movePresetsToFolder(getDraggedPresetIds(presetId), folderElement.dataset.presetFolderId);
      } else if (rootElement) {
        movePresetsToFolder(getDraggedPresetIds(presetId), null);
      }
      setDraggedPresetId(null);
      window.setTimeout(() => {
        suppressPresetClickRef.current = false;
      }, 0);
    },
    [getDraggedPresetIds, movePresetsToFolder],
  );

  const cancelPresetTouchDrag = useCallback((_presetId: string, wasActive: boolean) => {
    setDraggedPresetId(null);
    if (wasActive) {
      window.setTimeout(() => {
        suppressPresetClickRef.current = false;
      }, 0);
    } else {
      suppressPresetClickRef.current = false;
    }
  }, []);

  const { startTouchDrag: startPresetTouchDrag } = useTouchFolderDrag({
    onActivate: (presetId) => {
      suppressPresetClickRef.current = true;
      setDraggedPresetId(presetId);
    },
    onDrop: finishPresetTouchDrag,
    onCancel: cancelPresetTouchDrag,
  });

  const renderPresetRow = useCallback(
    (preset: PresetRow) => {
      const isSelected = activePresetId === preset.id;
      const isBulkSelected = selectedPresetIds.has(preset.id);
      const sectionCount = getSectionCount(preset);
      const wrapFormat = (preset.wrapFormat ?? "xml") as string;
      const isDefault = String(preset.isDefault) === "true";

      return (
        <div
          key={preset.id}
          data-touch-drag-card="preset"
          className={cn(
            "group relative flex touch-pan-y cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
            selectionMode &&
              isBulkSelected &&
              "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
            isSelected &&
              "bg-[var(--marinara-chat-chrome-highlight-bg)] ring-1 ring-[var(--marinara-chat-chrome-button-border-active)]",
            draggedPresetId === preset.id && "opacity-50",
          )}
          draggable
          onDragStart={(event) => {
            const ids = getDraggedPresetIds(preset.id);
            setDraggedPresetId(preset.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-marinara-preset-ids", JSON.stringify(ids));
            event.dataTransfer.setData("text/plain", preset.id);
          }}
          onDragEnd={() => setDraggedPresetId(null)}
        >
          <TouchDragHandle
            label="Drag preset"
            onTouchStart={(event) => {
              startPresetTouchDrag(event, preset.id, {
                allowInteractiveTarget: true,
                sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="preset"]'),
              });
            }}
          />
          <div
            className="flex min-w-0 flex-1 items-center gap-3"
            onClick={() => {
              if (suppressPresetClickRef.current) return;
              if (selectionMode) toggleSelection(preset.id);
              else openPresetDetail(preset.id);
            }}
          >
            {selectionMode && (
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                  isBulkSelected
                    ? "border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]"
                    : "border-[var(--muted-foreground)]/40 bg-[var(--secondary)] text-transparent",
                )}
              >
                <Check size="0.75rem" />
              </div>
            )}
            <div className="mari-panel-gradient-surface mari-panel-gradient--presets relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
              <FileText size="1rem" />
              {isSelected && (
                <div className="mari-panel-gradient-surface mari-panel-gradient--presets absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-md shadow-sm">
                  <Check size="0.625rem" />
                </div>
              )}
            </div>
            <div
              className={cn(
                "min-w-0 flex-1",
                !selectionMode &&
                  "pr-0 transition-[padding] max-md:pr-32 [@media(pointer:coarse)]:pr-32 [@media(pointer:fine)]:group-hover:pr-32",
              )}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5" title={preset.name}>
                  {preset.name}
                </span>
                {isDefault && (
                  <span className="mari-chrome-muted-badge shrink-0 rounded px-1 py-0.5 text-[0.5625rem]">DEFAULT</span>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
                <span className="flex shrink-0 items-center gap-0.5">
                  {wrapFormat === "xml" ? <Code2 size="0.5625rem" /> : <Hash size="0.5625rem" />}
                  {wrapFormat.toUpperCase()}
                </span>
                <span className="shrink-0">{sectionCount} sections</span>
                {preset.author && (
                  <span className="min-w-0 truncate" title={`by ${preset.author}`}>
                    by {preset.author}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!selectionMode && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
              {canAssignToActiveChat && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectPreset(preset.id);
                  }}
                  className={cn(
                    "mari-chrome-control mari-chrome-control--small p-1.5",
                    isSelected && "mari-chrome-control--selected",
                  )}
                  title={isSelected ? "Unassign from chat" : "Assign to chat"}
                  aria-label={isSelected ? "Unassign preset from chat" : "Assign preset to chat"}
                >
                  <Check size="0.75rem" />
                </button>
              )}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDefaultPreset.mutate(preset.id);
                }}
                className={cn(
                  "rounded-lg p-1.5 transition-all active:scale-90",
                  isDefault
                    ? "text-yellow-500"
                    : "text-[var(--muted-foreground)] hover:bg-yellow-500/10 hover:text-yellow-500",
                )}
                title={isDefault ? "Default preset" : "Set as default"}
                aria-label={isDefault ? "Default preset" : "Set as default preset"}
              >
                <Star size="0.75rem" className={isDefault ? "fill-yellow-500" : ""} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  duplicatePreset.mutate(preset.id);
                }}
                className="mari-chrome-control mari-chrome-control--small p-1.5"
                title="Duplicate"
                aria-label="Duplicate preset"
              >
                <Copy size="0.75rem" />
              </button>
              <button
                type="button"
                onClick={async (event) => {
                  event.stopPropagation();
                  if (
                    await showConfirmDialog({
                      title: "Delete Preset",
                      message: `Delete "${preset.name}"?`,
                      confirmLabel: "Delete",
                      tone: "destructive",
                    })
                  ) {
                    deletePreset.mutate(preset.id);
                  }
                }}
                className="mari-chrome-control mari-chrome-control--small p-1.5"
                title="Delete"
                aria-label="Delete preset"
              >
                <Trash2 size="0.75rem" />
              </button>
            </div>
          )}
        </div>
      );
    },
    [
      activePresetId,
      canAssignToActiveChat,
      deletePreset,
      draggedPresetId,
      duplicatePreset,
      getDraggedPresetIds,
      getSectionCount,
      openPresetDetail,
      selectedPresetIds,
      selectPreset,
      selectionMode,
      setDefaultPreset,
      startPresetTouchDrag,
      toggleSelection,
    ],
  );

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openModal("create-preset")}
          className="mari-panel-gradient-button mari-panel-gradient--presets flex-1 text-xs"
          aria-label="Create preset"
          title="New"
        >
          <Plus size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => openModal("import-preset")}
          className="mari-chrome-control mari-chrome-control--primary flex-1 text-xs"
          aria-label="Import preset"
          title="Import"
        >
          <Download size="0.8125rem" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectionMode) exitSelectionMode();
            else setSelectionMode(true);
          }}
          className={cn(
            "mari-chrome-control mari-chrome-control--primary flex-1 text-xs",
            selectionMode && "mari-chrome-control--selected",
          )}
          aria-label={selectionMode ? "Exit preset selection mode" : "Select presets"}
          title="Select"
        >
          <Check size="0.8125rem" />
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search
            size="0.8125rem"
            className="mari-chrome-field-icon pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          />
          <input
            type="text"
            placeholder="Search presets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mari-chrome-field h-10 w-full py-0 pl-8 pr-3 text-xs md:h-9"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ResourcePanelSort)}
            className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
            title="Sort order"
            aria-label="Sort presets"
          >
            <option value="name-asc">A-Z</option>
            <option value="name-desc">Z-A</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ArrowUpDown
            size="0.625rem"
            className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateFolder}
            className="mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]"
          >
            <FolderPlus size="0.75rem" />
            New Folder
          </button>
        </div>
        {presetFolders.length > 0 && <p className="mari-folder-helper">Drag and drop presets to folders, double-click or double-tap to rename</p>}
      </div>

      <PanelSection title="Presets" icon={<FileText size="0.8125rem" />}>
        <div className="flex flex-col gap-0.5">
          {presetFolders.map((folder) => {
            const isEditing = editingFolderId === folder.id;
            const folderItems = sortBasicPanelItems(
              folder.itemIds.map((id) => presetById.get(id)).filter((item): item is PresetRow => Boolean(item)),
              sort,
              (preset) => preset.name,
              (preset) => preset.createdAt || preset.updatedAt,
            );
            if (presetSearchActive && folderItems.length === 0) return null;
            const isExpanded = (presetSearchActive && folderItems.length > 0) || expandedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                data-preset-folder-id={folder.id}
                onDragOver={(event) => {
                  if (draggedPresetId) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const payload = event.dataTransfer.getData("application/x-marinara-preset-ids");
                  handlePresetDrop(folder.id, payload ? (JSON.parse(payload) as string[]) : undefined);
                }}
                className="flex flex-col rounded-lg transition-colors"
              >
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} folder ${folder.name}. Double-tap or press F2 to rename.`}
                  title="Double-click, double-tap, or press F2 to rename."
                  className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40"
                  onClick={(event) =>
                    handleFolderRenameGesture(folder.id, event, {
                      onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                      onRename: () => {
                        setEditingFolderId(folder.id);
                        setEditFolderName(folder.name);
                      },
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    handleFolderRenameKeyDown(event, {
                      onSingleClick: () => setExpandedFolderId(isExpanded ? null : folder.id),
                      onRename: () => {
                        setEditingFolderId(folder.id);
                        setEditFolderName(folder.name);
                      },
                    });
                  }}
                >
                  <ChevronRight
                    size="0.75rem"
                    className={cn(
                      "mari-chrome-accent-icon mari-accent-animated shrink-0 transition-transform duration-200 ease-out",
                      isExpanded && "rotate-90",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editFolderName}
                        onChange={(event) => setEditFolderName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                          if (event.key === "Escape") {
                            setEditingFolderId(null);
                            setEditFolderName("");
                          }
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={() => handleRenameFolder(folder.id)}
                        className="w-full rounded bg-transparent px-1 py-0.5 text-xs font-medium outline-none ring-1 ring-[var(--marinara-chat-chrome-input-border-focus)]"
                      />
                    ) : (
                      <>
                        <div className="mari-chrome-text truncate text-xs font-medium">{folder.name}</div>
                      </>
                    )}
                  </div>
                  {(presetSearchActive ? folderItems.length : folder.itemIds.length) > 0 && (
                    <span className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {presetSearchActive ? folderItems.length : folder.itemIds.length}
                    </span>
                  )}
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 max-md:opacity-100">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void confirmNonEmptyFolderDelete(folder.itemIds.length, {
                          title: "Delete Folder",
                          message: `Delete "${folder.name}"? Its ${folder.itemIds.length} preset${
                            folder.itemIds.length === 1 ? "" : "s"
                          } will move out of the folder.`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        }).then((ok) => {
                          if (!ok) return;
                          deletePresetFolder.mutate(folder.id);
                          if (expandedFolderId === folder.id) setExpandedFolderId(null);
                        });
                      }}
                      className="mari-chrome-control mari-chrome-control--small p-1"
                      title="Delete folder"
                      aria-label="Delete folder"
                    >
                      <Trash2 size="0.6875rem" />
                    </button>
                  </div>
                </div>
                <SmoothFolderContent
                  open={isExpanded}
                  className="ml-4 border-l border-[var(--border)]/20 pb-1 pl-1"
                  innerClassName="flex flex-col gap-0.5"
                >
                  {folderItems.length === 0 ? (
                    <p className="mari-chrome-text-muted py-2 text-[0.625rem] italic">Drop presets here.</p>
                  ) : (
                    folderItems.map((preset) => renderPresetRow(preset))
                  )}
                </SmoothFolderContent>
              </div>
            );
          })}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredPresets.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="mari-panel-gradient-surface mari-panel-gradient--presets animate-float flex h-12 w-12 items-center justify-center rounded-2xl">
              <FileText size="1.25rem" />
            </div>
            <p className="mari-chrome-text-muted text-xs">
              {search ? "No matching presets" : "No presets yet"}
            </p>
          </div>
        )}

        {/* Preset list */}
        {draggedPresetId && (
          <div
            data-preset-folder-root
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const payload = event.dataTransfer.getData("application/x-marinara-preset-ids");
              handlePresetDrop(null, payload ? (JSON.parse(payload) as string[]) : undefined);
            }}
            className="rounded-xl border border-dashed border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-3 py-2 text-[0.625rem] text-[var(--marinara-chat-chrome-button-text-active)]"
          >
            Drop here to move out of folder
          </div>
        )}

        <div className="stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors">
          {rootPresets.map((preset) => renderPresetRow(preset))}
        </div>

        {activeChat && !selectionMode && (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
            {canAssignToActiveChat
              ? 'Click a preset to edit · hover → "Use" to assign to chat'
              : "Click a preset to edit"}
          </p>
        )}
      </PanelSection>

      <RegexSection
        handleCreateRegex={handleCreateRegex}
        handleImportRegex={handleImportRegex}
        handleExportRegex={handleExportRegex}
        regexImportError={regexImportError}
        regexImportSuccess={regexImportSuccess}
        sortedRegexScripts={sortedRegexScripts}
        draggedRegexId={draggedRegexId}
        regexDragReadyId={regexDragReadyId}
        setDraggedRegexId={setDraggedRegexId}
        setRegexDragReadyId={setRegexDragReadyId}
        handleRegexDrop={handleRegexDrop}
        handleRegexReorderToIndex={handleRegexReorderToIndex}
        openRegexDetail={openRegexDetail}
        updateRegex={updateRegex}
        deleteRegex={deleteRegex}
      />

      <FunctionsSection
        customToolRows={customToolRows}
        customToolCapabilities={customToolCapabilities}
        handleCreateFunction={handleCreateFunction}
        handleImportFunctions={handleImportFunctions}
        handleExportFunctions={handleExportFunctions}
        functionImportError={functionImportError}
        functionImportSuccess={functionImportSuccess}
        draggedFunctionId={draggedFunctionId}
        functionDragReadyId={functionDragReadyId}
        setDraggedFunctionId={setDraggedFunctionId}
        setFunctionDragReadyId={setFunctionDragReadyId}
        handleFunctionDrop={handleFunctionDrop}
        handleFunctionReorderToIndex={handleFunctionReorderToIndex}
        openToolDetail={openToolDetail}
        updateCustomTool={updateCustomTool}
        deleteCustomTool={deleteCustomTool}
      />

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedPresetIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}

      {/* Choice selection modal */}
      {activeChat && (
        <ChoiceSelectionModal
          open={!!choiceModalPresetId}
          onClose={() => setChoiceModalPresetId(null)}
          presetId={choiceModalPresetId}
          chatId={activeChat.id}
          existingChoices={
            typeof activeChat.metadata === "string"
              ? (JSON.parse(activeChat.metadata).presetChoices ?? {})
              : ((activeChat.metadata as any)?.presetChoices ?? {})
          }
        />
      )}
    </div>
  );
}

function RegexSection({
  handleCreateRegex,
  handleImportRegex,
  handleExportRegex,
  regexImportError,
  regexImportSuccess,
  sortedRegexScripts,
  draggedRegexId,
  regexDragReadyId,
  setDraggedRegexId,
  setRegexDragReadyId,
  handleRegexDrop,
  handleRegexReorderToIndex,
  openRegexDetail,
  updateRegex,
  deleteRegex,
}: {
  handleCreateRegex: () => void;
  handleImportRegex: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportRegex: () => void;
  regexImportError: string | null;
  regexImportSuccess: string | null;
  sortedRegexScripts: RegexScriptRow[];
  draggedRegexId: string | null;
  regexDragReadyId: string | null;
  setDraggedRegexId: Dispatch<SetStateAction<string | null>>;
  setRegexDragReadyId: Dispatch<SetStateAction<string | null>>;
  handleRegexDrop: (targetId: string) => void;
  handleRegexReorderToIndex: (sourceId: string, targetIdx: number) => void;
  openRegexDetail: (id: string) => void;
  updateRegex: ReturnType<typeof useUpdateRegexScript>;
  deleteRegex: ReturnType<typeof useDeleteRegexScript>;
}) {
  const { startTouchDrag: startRegexTouchDrag } = useTouchFolderDrag({
    onActivate: (scriptId) => {
      setDraggedRegexId(scriptId);
      setRegexDragReadyId(scriptId);
    },
    onDrop: (scriptId, x, y) => {
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="preset-regex"]',
        rootSelector: "[data-preset-regex-root]",
        itemCount: sortedRegexScripts.length,
      });
      setDraggedRegexId(null);
      setRegexDragReadyId(null);
      if (targetIdx === null) return;
      handleRegexReorderToIndex(scriptId, targetIdx);
    },
    onCancel: () => {
      setDraggedRegexId(null);
      setRegexDragReadyId(null);
    },
  });

  return (
    <PanelSection
      title="Regexes"
      icon={<Regex size="0.8125rem" />}
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCreateRegex}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Create regex"
            aria-label="Create regex"
          >
            <Plus size="0.8125rem" />
          </button>
          <label
            className="mari-chrome-control mari-chrome-control--small cursor-pointer p-1.5"
            title="Import regexes from JSON"
            aria-label="Import regexes from JSON"
          >
            <input type="file" accept="application/json" className="hidden" onChange={handleImportRegex} />
            <Download size="0.8125rem" />
          </label>
          <button
            type="button"
            onClick={handleExportRegex}
            disabled={sortedRegexScripts.length === 0}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Export regexes to JSON"
            aria-label="Export regexes to JSON"
          >
            <Upload size="0.8125rem" />
          </button>
        </div>
      }
    >
      <div className="mb-1.5 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
        Find/replace patterns applied to AI output or user input
      </div>
      {regexImportError && (
        <div className="mb-1 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
          {regexImportError}
        </div>
      )}
      {regexImportSuccess && <div className="mb-1 px-1 text-xs text-green-500">{regexImportSuccess}</div>}
      {sortedRegexScripts.length === 0 ? (
        <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">No regexes yet</p>
      ) : (
        <div data-preset-regex-root className="flex flex-col gap-0.5">
          {sortedRegexScripts.map((script, index) => {
            const placements = (() => {
              try {
                return JSON.parse(script.placement) as string[];
              } catch {
                return [];
              }
            })();
            const enabled = script.enabled === "true";
            return (
              <div
                key={script.id}
                data-touch-reorder-item="preset-regex"
                data-touch-reorder-index={index}
                className={cn(
                  "group flex flex-wrap items-start gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-accent)]",
                  !enabled && "opacity-50",
                  draggedRegexId === script.id && "opacity-40",
                )}
                draggable={regexDragReadyId === script.id}
                onDragStart={(event) => {
                  setDraggedRegexId(script.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", script.id);
                }}
                onDragOver={(event) => {
                  if (draggedRegexId && draggedRegexId !== script.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleRegexDrop(script.id);
                }}
                onDragEnd={() => {
                  setDraggedRegexId(null);
                  setRegexDragReadyId(null);
                }}
              >
                <button
                  type="button"
                  className="mari-chrome-accent-text-muted mari-accent-animated mt-0.5 shrink-0 cursor-grab rounded p-0.5 opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100"
                  title="Drag to reorder"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setRegexDragReadyId(script.id);
                  }}
                  onMouseUp={(event) => {
                    event.stopPropagation();
                    setRegexDragReadyId(null);
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation();
                    startRegexTouchDrag(event, script.id, {
                      allowInteractiveTarget: true,
                      sourceElement: event.currentTarget.closest<HTMLElement>(
                        '[data-touch-reorder-item="preset-regex"]',
                      ),
                    });
                  }}
                >
                  <GripVertical size="0.8125rem" />
                </button>
                <Regex size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text)]" />
                <button
                  className="min-w-0 flex-1 basis-[min(100%,10rem)] text-left"
                  onClick={() => openRegexDetail(script.id)}
                >
                  <div className="text-xs font-medium">{script.name}</div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                    {placements.map((placement) => (
                      <span
                        key={placement}
                        className="rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]"
                      >
                        {placement === "ai_output" ? "AI" : "User"}
                      </span>
                    ))}
                    <span className="min-w-0 max-w-full truncate font-mono text-[0.5625rem] text-[var(--muted-foreground)]">
                      /{script.findRegex}/{script.flags}
                    </span>
                  </div>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <div
                    className="shrink-0"
                    title={enabled ? "Disable regex" : "Enable regex"}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <SettingsSwitch
                      ariaLabel={enabled ? "Disable regex" : "Enable regex"}
                      checked={enabled}
                      onChange={(checked) => updateRegex.mutate({ id: script.id, enabled: checked })}
                      className="p-0 hover:bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
                    title="Edit regex"
                    aria-label="Edit regex"
                    onClick={() => openRegexDetail(script.id)}
                  >
                    <Pencil size="0.8125rem" />
                  </button>
                  <button
                    type="button"
                    className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
                    title="Delete regex"
                    aria-label="Delete regex"
                    onClick={async () => {
                      if (
                        await showConfirmDialog({
                          title: "Delete Regex",
                          message: `Delete "${script.name}"?`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        })
                      ) {
                        deleteRegex.mutate(script.id);
                      }
                    }}
                  >
                    <Trash2 size="0.8125rem" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelSection>
  );
}

function FunctionsSection({
  customToolRows,
  customToolCapabilities,
  handleCreateFunction,
  handleImportFunctions,
  handleExportFunctions,
  functionImportError,
  functionImportSuccess,
  draggedFunctionId,
  functionDragReadyId,
  setDraggedFunctionId,
  setFunctionDragReadyId,
  handleFunctionDrop,
  handleFunctionReorderToIndex,
  openToolDetail,
  updateCustomTool,
  deleteCustomTool,
}: {
  customToolRows: CustomToolRow[];
  customToolCapabilities?: CustomToolCapabilities;
  handleCreateFunction: () => void;
  handleImportFunctions: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportFunctions: () => void;
  functionImportError: string | null;
  functionImportSuccess: string | null;
  draggedFunctionId: string | null;
  functionDragReadyId: string | null;
  setDraggedFunctionId: Dispatch<SetStateAction<string | null>>;
  setFunctionDragReadyId: Dispatch<SetStateAction<string | null>>;
  handleFunctionDrop: (targetId: string) => void;
  handleFunctionReorderToIndex: (sourceId: string, targetIdx: number) => void;
  openToolDetail: (id: string) => void;
  updateCustomTool: ReturnType<typeof useUpdateCustomTool>;
  deleteCustomTool: ReturnType<typeof useDeleteCustomTool>;
}) {
  const { startTouchDrag: startFunctionTouchDrag } = useTouchFolderDrag({
    onActivate: (toolId) => {
      setDraggedFunctionId(toolId);
      setFunctionDragReadyId(toolId);
    },
    onDrop: (toolId, x, y) => {
      const targetIdx = getTouchReorderDropIndex({
        x,
        y,
        itemSelector: '[data-touch-reorder-item="preset-function"]',
        rootSelector: "[data-preset-functions-root]",
        itemCount: customToolRows.length,
      });
      setDraggedFunctionId(null);
      setFunctionDragReadyId(null);
      if (targetIdx === null) return;
      handleFunctionReorderToIndex(toolId, targetIdx);
    },
    onCancel: () => {
      setDraggedFunctionId(null);
      setFunctionDragReadyId(null);
    },
  });

  return (
    <PanelSection
      title="Functions"
      icon={<Wrench size="0.8125rem" />}
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCreateFunction}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Create function"
            aria-label="Create function"
          >
            <Plus size="0.8125rem" />
          </button>
          <label
            className="mari-chrome-control mari-chrome-control--small cursor-pointer p-1.5"
            title="Import functions from ZIP or JSON"
            aria-label="Import functions from ZIP or JSON"
          >
            <input
              type="file"
              accept="application/json,application/zip,.json,.zip"
              className="hidden"
              onChange={handleImportFunctions}
            />
            <Download size="0.8125rem" />
          </label>
          <button
            type="button"
            onClick={handleExportFunctions}
            disabled={customToolRows.length === 0}
            className="mari-chrome-control mari-chrome-control--small p-1.5"
            title="Export functions to ZIP"
            aria-label="Export functions to ZIP"
          >
            <Upload size="0.8125rem" />
          </button>
        </div>
      }
    >
      <div className="mb-1.5 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
        Custom function calls available from Chat Settings
      </div>
      {functionImportError && (
        <div className="mb-1 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
          {functionImportError}
        </div>
      )}
      {functionImportSuccess && <div className="mb-1 px-1 text-xs text-green-500">{functionImportSuccess}</div>}
      {customToolRows.length === 0 ? (
        <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">No functions yet</p>
      ) : (
        <div data-preset-functions-root className="flex flex-col gap-0.5">
          {customToolRows.map((tool, index) => {
            const enabled = tool.enabled === "true" || tool.enabled === "1";
            const scriptUnavailable =
              tool.executionType === "script" && customToolCapabilities?.scriptExecutionEnabled === false;
            const parameterCount = getFunctionParameterCount(tool.parametersSchema);

            return (
              <div
                key={tool.id}
                data-touch-reorder-item="preset-function"
                data-touch-reorder-index={index}
                className={cn(
                  "group flex flex-wrap items-start gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-accent)]",
                  !enabled && "opacity-50",
                  draggedFunctionId === tool.id && "opacity-40",
                )}
                draggable={functionDragReadyId === tool.id}
                onDragStart={(event) => {
                  setDraggedFunctionId(tool.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", tool.id);
                }}
                onDragOver={(event) => {
                  if (draggedFunctionId && draggedFunctionId !== tool.id) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFunctionDrop(tool.id);
                }}
                onDragEnd={() => {
                  setDraggedFunctionId(null);
                  setFunctionDragReadyId(null);
                }}
              >
                <button
                  type="button"
                  className="mari-chrome-accent-text-muted mari-accent-animated mt-0.5 shrink-0 cursor-grab rounded p-0.5 opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100"
                  title="Drag to reorder"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setFunctionDragReadyId(tool.id);
                  }}
                  onMouseUp={(event) => {
                    event.stopPropagation();
                    setFunctionDragReadyId(null);
                  }}
                  onTouchStart={(event) => {
                    event.stopPropagation();
                    startFunctionTouchDrag(event, tool.id, {
                      allowInteractiveTarget: true,
                      sourceElement: event.currentTarget.closest<HTMLElement>(
                        '[data-touch-reorder-item="preset-function"]',
                      ),
                    });
                  }}
                >
                  <GripVertical size="0.8125rem" />
                </button>
                <Wrench size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text)]" />
                <button
                  className="min-w-0 flex-1 basis-[min(100%,10rem)] text-left"
                  onClick={() => openToolDetail(tool.id)}
                >
                  <div className="truncate font-mono text-xs font-medium">{tool.name}</div>
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
                    <span className="rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]">
                      {formatFunctionExecutionType(tool.executionType)}
                    </span>
                    <span className="rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]">
                      {parameterCount} param{parameterCount === 1 ? "" : "s"}
                    </span>
                    {scriptUnavailable && (
                      <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[0.5rem] text-amber-400">
                        Script disabled
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[0.5625rem] text-[var(--muted-foreground)]">
                    {tool.description || "No description"}
                  </div>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <div
                    className="shrink-0"
                    title={enabled ? "Disable function" : "Enable function"}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <SettingsSwitch
                      ariaLabel={enabled ? "Disable function" : "Enable function"}
                      checked={enabled}
                      onChange={(checked) => updateCustomTool.mutate({ id: tool.id, enabled: checked })}
                      className="p-0 hover:bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
                    title="Edit function"
                    aria-label="Edit function"
                    onClick={() => openToolDetail(tool.id)}
                  >
                    <Pencil size="0.8125rem" />
                  </button>
                  <button
                    type="button"
                    className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
                    title="Delete function"
                    aria-label="Delete function"
                    onClick={async () => {
                      if (
                        await showConfirmDialog({
                          title: "Delete Function",
                          message: `Delete "${tool.name}"?`,
                          confirmLabel: "Delete",
                          tone: "destructive",
                        })
                      ) {
                        deleteCustomTool.mutate(tool.id);
                      }
                    }}
                  >
                    <Trash2 size="0.8125rem" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelSection>
  );
}

function formatFunctionExecutionType(executionType: string) {
  if (executionType === "webhook") return "Webhook";
  if (executionType === "script") return "Script";
  return "Static";
}

function getFunctionParameterCount(parametersSchema: string) {
  try {
    const schema = JSON.parse(parametersSchema || "{}") as { properties?: unknown };
    if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return 0;
    return Object.keys(schema.properties).length;
  } catch {
    return 0;
  }
}

function PanelSection({
  title,
  icon,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-1.5 px-1 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
        >
          <ChevronDown
            size="0.75rem"
            className={cn("mari-chrome-accent-icon mari-accent-animated transition-transform", open && "rotate-180")}
          />
          <span className="text-[var(--marinara-chat-chrome-button-text)]">{icon}</span>
          {title}
        </button>
        {action}
      </div>
      {open && <div className="mt-1 flex flex-col gap-1">{children}</div>}
    </div>
  );
}
