import { useLibraryFolderDrag } from "../../hooks/use-library-folder-drag";
import { useLibraryOrder } from "../../hooks/use-library-order";
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
import {
  usePresets,
  useDeletePreset,
  useDuplicatePreset,
  useSetDefaultPreset,
  useUploadPresetImage,
} from "../../hooks/use-presets";
import { useUpdateChat, useUpdateChatMetadata } from "../../hooks/use-chats";
import {
  useRegexScripts,
  useDeleteRegexScript,
  useImportRegexScript,
  useUpdateRegexScript,
  useReorderRegexScripts,
  useSetRegexScriptsEnabled,
  type RegexScriptRow,
} from "../../hooks/use-regex-scripts";
import {
  useCustomTools,
  useCreateCustomTool,
  useUpdateCustomTool,
  useDeleteCustomTool,
  useCustomToolCapabilities,
  useReorderCustomTools,
  useSetCustomToolsEnabled,
  type CustomToolCapabilities,
  type CustomToolRow,
} from "../../hooks/use-custom-tools";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore, type ResourcePanelSort } from "../../stores/ui.store";
import { api, ApiError } from "../../lib/api-client";
import { EXPORT_FAILED_TOAST_ID } from "../../lib/file-download";
import { confirmNonEmptyFolderDelete, showConfirmDialog } from "../../lib/app-dialogs";
import { ChoiceSelectionModal } from "../presets/ChoiceSelectionModal";
import { SelectionActionBar } from "../ui/SelectionActionBar";
import { LibraryTabToolbar } from "./LibraryTabToolbar";
import {
  FileText,
  Trash2,
  Check,
  Copy,
  ArrowUpDown,
  Code2,
  Hash,
  Star,
  Regex,
  GripVertical,
  Pencil,
  ChevronDown,
  ChevronRight,
  FolderInput,
  Pause,
  Wrench,
  ShieldCheck,
  Camera,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { sortBasicPanelItems, sortPanelFolders } from "../../lib/panel-sort";
import { downloadJsonFile } from "../../lib/download-json";
import { downloadZipFile } from "../../lib/download-zip";
import { getFolderImportEntries, isPatternSafe, isStockMarinaraUniversalPreset } from "@marinara-engine/shared";
import {
  createCustomToolFolderPackageFiles,
  importCustomToolEntries,
  serializeCustomToolForTransfer,
  type CustomToolImportReview,
} from "../../lib/custom-tool-transfer";
import { collectFolderPackageEntries, type FolderPackageImportEntry } from "../../lib/folder-package-transfer";
import { isZipFile, readTextFilesFromZip } from "../../lib/read-zip-text";
import { SettingsSwitch } from "./settings/SettingControls";
import { PausableLibraryFolder, useLibraryMoveMenu, type EditingLibraryFolder } from "./PausableLibraryFolder";
import {
  getNextUnnamedLibraryFolderName,
  useCreateLibraryFolder,
  useDeleteLibraryFolder,
  useLibraryFolders,
  useMoveLibraryItem,
  useUpdateLibraryFolder,
} from "../../hooks/use-library-folders";
import {
  handleFolderRenameInputKeyDown,
  handleFolderRenameKeyDown,
  useFolderRenameGesture,
} from "../../hooks/use-folder-rename-gesture";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { SmoothFolderContent } from "../ui/SmoothFolderContent";
import { getTouchReorderDropIndex } from "../../lib/touch-reorder";
import { useTranslation as useUiTranslation } from "react-i18next";
import { clearActiveChatResourceDrag, writeChatResourceDragPayload } from "../../lib/chat-resource-drag";
import { ChatResourceActionButton } from "../chat/ChatResourceActionButton";
import { resolvePresetArtwork } from "../../lib/preset-artwork";

type PresetRow = {
  id: string;
  name: string;
  description: string;
  imagePath?: string | null;
  wrapFormat?: string;
  isDefault?: string | boolean;
  author?: string;
  systemKey?: string;
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
    applyMode: isRegexApplyMode(script.applyMode)
      ? script.applyMode
      : readRegexApplyMode(script as unknown as Record<string, unknown>),
    targetCharacterIds: parseStringArray(script.targetCharacterIds),
    targetPromptPresetIds: parseStringArray(script.targetPromptPresetIds),
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
    targetPromptPresetIds: parseStringArray(entry.targetPromptPresetIds),
    order: typeof entry.order === "number" ? fallbackOrder + entry.order : fallbackOrder,
    minDepth: parseNullableNumber(entry.minDepth),
    maxDepth: parseNullableNumber(entry.maxDepth),
  };
}

export function PresetsPanel() {
  const manualOrder = useLibraryOrder("preset");
  const { active: manualOrderActive, orderItems: orderLibraryItems } = manualOrder;
  const folderDrag = useLibraryFolderDrag("preset");
  const { t: localizeUi } = useUiTranslation();
  const { data: presets, isLoading } = usePresets();
  const { data: regexScripts } = useRegexScripts();
  const { data: customTools } = useCustomTools();
  const { data: customToolCapabilities } = useCustomToolCapabilities();
  const deletePreset = useDeletePreset();
  const duplicatePreset = useDuplicatePreset();
  const setDefaultPreset = useSetDefaultPreset();
  const uploadPresetImage = useUploadPresetImage();
  const deleteRegex = useDeleteRegexScript();
  const importRegexScript = useImportRegexScript();
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
  const [tab, setTab] = useState<"presets" | "regex" | "functions">("presets");
  const [selectionTarget, setSelectionTarget] = useState<"presets" | "regex" | "functions" | null>(null);
  const selectionMode = selectionTarget === "presets";
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [regexImportError, setRegexImportError] = useState<string | null>(null);
  const [regexImportWarning, setRegexImportWarning] = useState<string | null>(null);
  const [regexImportSuccess, setRegexImportSuccess] = useState<string | null>(null);
  const [functionImportError, setFunctionImportError] = useState<string | null>(null);
  const [functionImportSuccess, setFunctionImportSuccess] = useState<string | null>(null);
  const [functionImportReviews, setFunctionImportReviews] = useState<CustomToolImportReview[]>([]);
  const [draggedRegexId, setDraggedRegexId] = useState<string | null>(null);
  const [regexDragReadyId, setRegexDragReadyId] = useState<string | null>(null);
  const [draggedFunctionId, setDraggedFunctionId] = useState<string | null>(null);
  const [functionDragReadyId, setFunctionDragReadyId] = useState<string | null>(null);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [draggedPresetId, setDraggedPresetId] = useState<string | null>(null);
  const presetImageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetPresetIdRef = useRef<string | null>(null);
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
      orderLibraryItems(
        sortBasicPanelItems(
          filteredPresets,
          sort,
          (preset) => preset.name,
          (preset) => preset.createdAt || preset.updatedAt,
        ),
      ),
    [filteredPresets, sort, orderLibraryItems],
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
        toast.error(localizeUi("ui.panels.presetspanel.promptPresetsAreNotAvailableInConversationMode"));
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
    [activeChat, activePresetId, updateChat, updateMetadata, localizeUi],
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
    setSelectionTarget((target) => (target === "presets" ? null : target));
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

  const handlePickPresetImage = useCallback((presetId: string) => {
    imageTargetPresetIdRef.current = presetId;
    if (presetImageInputRef.current) {
      presetImageInputRef.current.value = "";
      presetImageInputRef.current.click();
    }
  }, []);

  const handlePresetImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const presetId = imageTargetPresetIdRef.current;
      if (!file || !presetId) return;

      if (!file.type.startsWith("image/")) {
        imageTargetPresetIdRef.current = null;
        toast.error(localizeUi("ui.panels.presetspanel.chooseAnImageFileForThePresetPicture"));
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const image = typeof reader.result === "string" ? reader.result : "";
        if (!image) {
          toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
          return;
        }

        try {
          await uploadPresetImage.mutateAsync({ id: presetId, image });
          toast.success(localizeUi("ui.panels.presetspanel.presetPictureUpdated"));
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : localizeUi("ui.panels.presetspanel.failedToUploadPresetPicture"),
          );
        } finally {
          imageTargetPresetIdRef.current = null;
        }
      };
      reader.onerror = () => {
        imageTargetPresetIdRef.current = null;
        toast.error(localizeUi("ui.panels.agentspanel.couldNotReadThatImage"));
      };
      reader.readAsDataURL(file);
    },
    [localizeUi, uploadPresetImage],
  );

  const handleExportSelected = async () => {
    if (selectedPresetIds.size === 0) return;
    setExportingSelected(true);
    try {
      const saveStatus = await api.downloadPost(
        "/prompts/export-bulk",
        { ids: [...selectedPresetIds] },
        "marinara-presets.zip",
      );
      if (saveStatus === "saved")
        toast.success(
          localizeUi("ui.panels.presetspanel.exportedValue1PresetValue2", {
            value1: selectedPresetIds.size,
            value2: selectedPresetIds.size === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
          }),
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.panels.presetspanel.failedToExportPresets"), {
        id: EXPORT_FAILED_TOAST_ID,
      });
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

  const handleExportRegex = useCallback(
    (scripts = sortedRegexScripts) => {
      if (scripts.length === 0) {
        toast.error(localizeUi("ui.panels.presetspanel.noRegexesToExport"));
        return;
      }

      void downloadJsonFile(
        {
          kind: "marinara.regex-scripts",
          version: 1,
          exportedAt: new Date().toISOString(),
          regexScripts: scripts.map(serializeRegexScript),
        },
        "marinara-regexes.json",
      ).then((saveStatus) => {
        if (saveStatus === "saved")
          toast.success(
            localizeUi("ui.panels.presetspanel.exportedValue1RegexValue2", {
              value1: scripts.length,
              value2: scripts.length === 1 ? "" : localizeUi("ui.lorebooks.lorebookeditor.es"),
            }),
          );
      });
    },
    [sortedRegexScripts, localizeUi],
  );

  const handleImportRegex = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setRegexImportError(null);
      setRegexImportWarning(null);
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
        const warnings: string[] = [];
        const orderBase = getNextRegexOrderBase((regexScripts ?? []) as RegexScriptRow[]);
        for (const [index, entry] of entries.entries()) {
          const unsupportedPlacements = getUnsupportedStRegexPlacements(entry);
          const normalized = normalizeRegexImportEntry(entry, orderBase + index);
          if (!normalized) {
            failed.push(`Entry ${index + 1}: missing name or find pattern.`);
            continue;
          }
          try {
            await importRegexScript.mutateAsync(normalized);
            imported++;
            if (!isPatternSafe(normalized.findRegex.replace(/\{\{[^}]*\}\}/g, "x"))) {
              warnings.push(
                localizeUi("ui.regex.importUnsafePatternWarning", {
                  value1: index + 1,
                  value2: normalized.name,
                }),
              );
            }
            if (unsupportedPlacements.length > 0) {
              warnings.push(
                localizeUi("ui.panels.presetspanel.ignoredUnsupportedRegexPlacements", {
                  value1: index + 1,
                  value2: unsupportedPlacements.join(", "),
                }),
              );
            }
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
        if (warnings.length > 0) {
          setRegexImportWarning(warnings.join(" "));
        }
        if (imported === 0 && failed.length === 0) {
          setRegexImportError("No valid regex scripts found in file.");
        }
      } catch (error) {
        setRegexImportError(error instanceof Error ? error.message : "Failed to import regex scripts");
      }

      event.target.value = "";
    },
    [importRegexScript, localizeUi, regexScripts],
  );

  const handleExportFunctions = useCallback(
    async (tools = customToolRows) => {
      if (tools.length === 0) {
        toast.error(localizeUi("ui.panels.presetspanel.noFunctionsToExport"));
        return;
      }

      const includesWebhookCredentials = tools.some(
        (tool) => tool.executionType === "webhook" && Boolean(tool.webhookUrl),
      );
      if (
        includesWebhookCredentials &&
        !(await showConfirmDialog({
          title: localizeUi("ui.panels.presetspanel.exportWebhookCredentials"),
          message: localizeUi("ui.panels.presetspanel.exportWebhookCredentialsWarning"),
          confirmLabel: localizeUi("ui.panels.presetspanel.exportWithCredentials"),
          tone: "destructive",
        }))
      ) {
        return;
      }

      void downloadZipFile(
        createCustomToolFolderPackageFiles(tools.map(serializeCustomToolForTransfer)),
        "marinara-functions.zip",
      ).then((saveStatus) => {
        if (saveStatus === "saved")
          toast.success(
            localizeUi("ui.panels.presetspanel.exportedValue1FunctionValue2", {
              value1: tools.length,
              value2: tools.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
            }),
          );
      });
    },
    [customToolRows, localizeUi],
  );

  const handleImportFunctions = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setFunctionImportError(null);
      setFunctionImportSuccess(null);
      setFunctionImportReviews([]);
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
        if (entries.length === 0) {
          throw new Error(localizeUi("ui.panels.functionssection.noFunctionsFoundInFile"));
        }

        const { imported, failed, reviews } = await importCustomToolEntries(entries, createCustomTool);
        setFunctionImportReviews(reviews);

        if (imported === 0 && failed.length === 0) {
          throw new Error(localizeUi("ui.panels.functionssection.noValidFunctionsFoundInFile"));
        }

        if (imported > 0) {
          setFunctionImportSuccess(localizeUi("ui.panels.functionssection.importedFunctions", { count: imported }));
        }
        if (failed.length > 0) {
          setFunctionImportError(
            localizeUi("ui.panels.functionssection.failedFunctions", {
              count: failed.length,
              error: failed[0],
            }),
          );
        }
      } catch (error) {
        setFunctionImportError(
          error instanceof Error ? error.message : localizeUi("ui.panels.functionssection.failedToImportFunctions"),
        );
      }

      event.target.value = "";
    },
    [createCustomTool, localizeUi],
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
        title: localizeUi("ui.panels.presetspanel.deletePresets"),
        message: localizeUi("ui.panels.presetspanel.deleteValue1PresetValue2", {
          value1: ids.length,
          value2: ids.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
        tone: "destructive",
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(ids.map((id) => deletePreset.mutateAsync(id)));
    const failedIds = ids.filter((_, index) => results[index]?.status === "rejected");
    const deletedCount = ids.length - failedIds.length;

    if (deletedCount > 0) {
      toast.success(
        localizeUi("ui.panels.presetspanel.deletedValue1PresetValue2", {
          value1: deletedCount,
          value2: deletedCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
    }

    if (failedIds.length > 0) {
      setSelectedPresetIds(new Set(failedIds));
      toast.error(
        localizeUi("ui.panels.presetspanel.failedToDeleteValue1PresetValue2", {
          value1: failedIds.length,
          value2: failedIds.length === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s"),
        }),
      );
      return;
    }

    exitSelectionMode();
  }, [selectedPresetIds, deletePreset, localizeUi]);

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
    (presetId: string, x: number, y: number, dragIds?: string[]) => {
      const target = document.elementFromPoint(x, y);
      const folderElement = target?.closest("[data-preset-folder-id]") as HTMLElement | null;
      const rootElement = target?.closest("[data-preset-folder-root]") as HTMLElement | null;
      if (folderElement?.dataset.presetFolderId) {
        movePresetsToFolder(dragIds ?? getDraggedPresetIds(presetId), folderElement.dataset.presetFolderId);
      } else if (rootElement || target?.closest('[data-drag-kind="preset"]')) {
        movePresetsToFolder(dragIds ?? getDraggedPresetIds(presetId), null);
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
    getDragIds: getDraggedPresetIds,
    onReorder: manualOrder.reorder,
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
      const isStock = isStockMarinaraUniversalPreset(preset);
      const artwork = resolvePresetArtwork(preset);
      const pictureLabel = artwork
        ? localizeUi("ui.panels.presetspanel.replacePresetPicture")
        : localizeUi("ui.panels.presetspanel.uploadPresetPicture");
      const imageContent = artwork ? (
        <img src={artwork} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <FileText size="1rem" />
      );
      const imageClasses =
        "mari-panel-gradient-surface mari-panel-gradient--presets relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm";

      return (
        <div
          key={preset.id}
          data-touch-drag-card="preset"
          data-drag-id={preset.id}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          data-drag-kind="preset"
          data-drag-payload={JSON.stringify({ version: 1, kind: "preset", ids: [preset.id], label: preset.name })}
          onMouseDown={(event) => {
            startPresetTouchDrag(event, preset.id, {
              chatResourcePayload: { version: 1, kind: "preset", ids: [preset.id], label: preset.name },
              sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="preset"]'),
            });
          }}
          onTouchStart={(event) => {
            startPresetTouchDrag(event, preset.id, {
              chatResourcePayload: { version: 1, kind: "preset", ids: [preset.id], label: preset.name },
              sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-drag-card="preset"]'),
            });
          }}
          className={cn(
            "group relative flex touch-pan-y cursor-grab active:cursor-grabbing items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-[var(--sidebar-accent)]",
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
            event.dataTransfer.effectAllowed = "copyMove";
            event.dataTransfer.setData("application/x-marinara-preset-ids", JSON.stringify(ids));
            event.dataTransfer.setData("text/plain", preset.id);
            writeChatResourceDragPayload(event.dataTransfer, {
              version: 1,
              kind: "preset",
              ids: [preset.id],
              label: preset.name,
            });
          }}
          onDragEnd={() => {
            setDraggedPresetId(null);
            clearActiveChatResourceDrag();
          }}
        >
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
                {isBulkSelected && <Check size="0.75rem" />}
              </div>
            )}
            {selectionMode ? (
              <div className={cn(imageClasses, "overflow-hidden")}>{imageContent}</div>
            ) : isStock ? (
              <div className={cn(imageClasses, "overflow-hidden")}>{imageContent}</div>
            ) : (
              <button
                type="button"
                data-preset-image-action={preset.id}
                onClick={(event) => {
                  event.stopPropagation();
                  handlePickPresetImage(preset.id);
                }}
                className={cn(
                  imageClasses,
                  "group/preset-picture transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--marinara-chat-chrome-focus-ring)]",
                )}
                title={pictureLabel}
                aria-label={pictureLabel}
              >
                <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl">
                  {imageContent}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover/preset-picture:opacity-100 group-focus-visible/preset-picture:opacity-100 [@media(pointer:coarse)]:opacity-100">
                    <Camera size="0.875rem" />
                  </span>
                </span>
                {isSelected && (
                  <span
                    data-preset-selected-indicator
                    className="mari-panel-gradient-surface mari-panel-gradient--presets absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-md shadow-sm"
                  >
                    <Check size="0.625rem" />
                  </span>
                )}
              </button>
            )}
            <div
              data-preset-open-action={preset.id}
              className={cn("min-w-0 flex-1", !selectionMode && "pr-0 max-md:pr-36 [@media(pointer:coarse)]:pr-36")}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium leading-5" title={preset.name}>
                  {preset.name}
                </span>
                {isDefault && (
                  <span className="mari-chrome-muted-badge shrink-0 rounded px-1 py-0.5 text-[0.5625rem]">
                    {localizeUi("ui.panels.presetspanel.default")}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2 text-[0.6875rem] leading-4 text-[var(--muted-foreground)]">
                <span className="flex shrink-0 items-center gap-0.5">
                  {wrapFormat === "xml" ? <Code2 size="0.5625rem" /> : <Hash size="0.5625rem" />}
                  {wrapFormat.toUpperCase()}
                </span>
                <span className="shrink-0">
                  {sectionCount} {localizeUi("ui.presets.sectionstab.sections")}
                </span>
                {preset.author && (
                  <span
                    className="min-w-0 truncate"
                    title={localizeUi("ui.panels.presetspanel.byValue1", { value1: preset.author })}
                  >
                    {localizeUi("ui.panels.presetspanel.by")} {preset.author}
                  </span>
                )}
              </div>
            </div>
          </div>

          {!selectionMode && (
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100 group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto max-md:[&_button]:pointer-events-auto [@media(pointer:coarse)]:[&_button]:pointer-events-auto">
              <ChatResourceActionButton
                payload={{ version: 1, kind: "preset", ids: [preset.id], label: preset.name }}
              />
              {canAssignToActiveChat && isSelected && (
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
                  title={
                    isSelected
                      ? localizeUi("ui.panels.presetspanel.unassignFromChat")
                      : localizeUi("ui.panels.presetspanel.assignToChat")
                  }
                  aria-label={
                    isSelected
                      ? localizeUi("ui.panels.presetspanel.unassignPresetFromChat")
                      : localizeUi("ui.panels.presetspanel.assignPresetToChat")
                  }
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
                title={
                  isDefault
                    ? localizeUi("ui.panels.presetspanel.defaultPreset")
                    : localizeUi("ui.panels.presetspanel.setAsDefault")
                }
                aria-label={
                  isDefault
                    ? localizeUi("ui.panels.presetspanel.defaultPreset")
                    : localizeUi("ui.panels.presetspanel.setAsDefaultPreset")
                }
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
                title={localizeUi("ui.presets.sectionstab.duplicate")}
                aria-label={localizeUi("ui.panels.presetspanel.duplicatePreset")}
              >
                <Copy size="0.75rem" />
              </button>
              {!isStock && (
                <button
                  type="button"
                  onClick={async (event) => {
                    event.stopPropagation();
                    if (
                      await showConfirmDialog({
                        title: localizeUi("ui.panels.presetspanel.deletePreset_a513ba6"),
                        message: localizeUi("ui.panels.agentspanel.deleteValue1", { value1: preset.name }),
                        confirmLabel: localizeUi("lorebook.editor.batch.delete"),
                        tone: "destructive",
                      })
                    ) {
                      deletePreset.mutate(preset.id);
                    }
                  }}
                  className="mari-chrome-control mari-chrome-control--small p-1.5"
                  title={localizeUi("lorebook.editor.batch.delete")}
                  aria-label={localizeUi("ui.panels.presetspanel.deletePreset")}
                >
                  <Trash2 size="0.75rem" />
                </button>
              )}
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
      handlePickPresetImage,
      openPresetDetail,
      selectedPresetIds,
      selectPreset,
      selectionMode,
      setDefaultPreset,
      startPresetTouchDrag,
      toggleSelection,
      localizeUi,
    ],
  );

  const presetSort = (
    <div className="relative">
      <select
        value={manualOrderActive || folderDrag.active ? "custom" : sort}
        onChange={(e) => {
          manualOrder.setActive(e.target.value === "custom");
          folderDrag.setActive(e.target.value === "custom");
          if (e.target.value !== "custom") setSort(e.target.value as ResourcePanelSort);
        }}
        className="mari-chrome-field mari-chrome-sort-field mari-accent-animated h-10 appearance-none py-0 pl-2.5 pr-7 text-[0.6875rem] md:h-9"
        title={localizeUi("ui.panels.agentspanel.sortOrder")}
        aria-label={localizeUi("ui.panels.presetspanel.sortPresets")}
      >
        <option value="custom" title={localizeUi("dragDrop.manualOrderHelp")}>
          {localizeUi("dragDrop.manualOrder")}
        </option>
        <option value="name-asc">{localizeUi("ui.panels.backgroundpicker.aZ")}</option>
        <option value="name-desc">{localizeUi("ui.panels.backgroundpicker.zA")}</option>
        <option value="newest">{localizeUi("ui.panels.backgroundpicker.newest")}</option>
        <option value="oldest">{localizeUi("ui.panels.backgroundpicker.oldest")}</option>
      </select>
      <ArrowUpDown
        size="0.625rem"
        className="mari-chrome-field-icon mari-chrome-sort-icon mari-accent-animated pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );

  const presetLibrary = (
    <>
      <input
        ref={presetImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePresetImageSelected}
      />

      <LibraryTabToolbar
        create={{
          label: localizeUi("ui.panels.presetspanel.createPreset"),
          title: localizeUi("ui.lorebooks.lorebookassignmentsection.new"),
          onClick: () => openModal("create-preset"),
        }}
        importAction={{
          label: localizeUi("ui.panels.presetspanel.importPreset"),
          title: localizeUi("ui.chat.chatbranchselector.import"),
          onClick: () => openModal("import-preset"),
        }}
        select={{
          active: selectionMode,
          label: selectionMode
            ? localizeUi("ui.panels.presetspanel.exitPresetSelectionMode")
            : localizeUi("ui.panels.presetspanel.selectPresets"),
          title: localizeUi("settings.common.select"),
          onToggle: () => {
            if (selectionMode) exitSelectionMode();
            else setSelectionTarget("presets");
          },
        }}
        search={{ value: search, placeholder: localizeUi("search.panels.presets"), onChange: setSearch }}
        sort={presetSort}
        folder={{
          label: localizeUi("ui.panels.backgroundpicker.newFolder"),
          onCreate: handleCreateFolder,
          helper: presetFolders.length > 0 && (
            <p className="mari-folder-helper">
              {localizeUi("ui.panels.presetspanel.dragAndDropPresetsToFoldersDoubleClickOr")}
            </p>
          ),
        }}
      />

      <PanelSection title={localizeUi("ui.panels.presetspanel.prompts")} icon={<FileText size="0.8125rem" />}>
        <div className="flex flex-col gap-0.5">
          {folderDrag.orderItems(sortPanelFolders(presetFolders, sort)).map((folder) => {
            const isEditing = editingFolderId === folder.id;
            const folderItems = orderLibraryItems(
              sortBasicPanelItems(
                folder.itemIds.map((id) => presetById.get(id)).filter((item): item is PresetRow => Boolean(item)),
                sort,
                (preset) => preset.name,
                (preset) => preset.createdAt || preset.updatedAt,
              ),
            );
            if (presetSearchActive && folderItems.length === 0) return null;
            const isExpanded = (presetSearchActive && folderItems.length > 0) || expandedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                {...folderDrag.bind(folder.id)}
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
                  data-drag-surface
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={localizeUi("ui.panels.agentspanel.value1FolderValue2DoubleTapOrPressF2To", {
                    value1: isExpanded
                      ? localizeUi("ui.panels.ttsconfigcard.collapse")
                      : localizeUi("ui.panels.ttsconfigcard.expand"),
                    value2: folder.name,
                  })}
                  title={localizeUi("ui.panels.backgroundpicker.doubleClickDoubleTapOrPressF2ToRename")}
                  className="group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all hover:bg-[var(--sidebar-accent)]/40 max-md:pr-12 [@media(pointer:coarse)]:pr-12"
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
                        onKeyDown={(event) =>
                          handleFolderRenameInputKeyDown(event, () => {
                            setEditingFolderId(null);
                            setEditFolderName("");
                          })
                        }
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
                  {folderItems.length > 0 && (
                    <span
                      data-folder-item-count="inline"
                      className="shrink-0 text-[0.5625rem] text-[var(--muted-foreground)] max-md:hidden [@media(pointer:coarse)]:hidden"
                    >
                      {folderItems.length}
                    </span>
                  )}
                  <div
                    data-folder-actions
                    className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5 rounded-lg bg-[var(--sidebar)] px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:group-focus-within:opacity-100 max-md:opacity-100 [@media(pointer:coarse)]:opacity-100 group-hover:[&_button]:pointer-events-auto [@media(pointer:fine)]:group-focus-within:[&_button]:pointer-events-auto max-md:[&_button]:pointer-events-auto [@media(pointer:coarse)]:[&_button]:pointer-events-auto"
                  >
                    {folderItems.length > 0 && (
                      <span
                        data-folder-item-count="actions"
                        className="hidden px-1 text-[0.5625rem] text-[var(--muted-foreground)] max-md:inline [@media(pointer:coarse)]:inline"
                      >
                        {folderItems.length}
                      </span>
                    )}
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
                      title={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
                      aria-label={localizeUi("ui.panels.backgroundpicker.deleteFolder")}
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
                    <p className="mari-chrome-text-muted py-2 text-[0.625rem] italic">
                      {localizeUi("ui.panels.presetspanel.dropPresetsHere")}
                    </p>
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
              {search
                ? localizeUi("ui.panels.presetspanel.noMatchingPresets")
                : localizeUi("ui.panels.presetspanel.noPresetsYet")}
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
            {localizeUi("ui.panels.agentspanel.dropHereToMoveOutOfFolder")}
          </div>
        )}

        <div className="stagger-children flex min-h-8 flex-col gap-1 rounded-xl transition-colors">
          {rootPresets.map((preset) => renderPresetRow(preset))}
        </div>

        {activeChat && !selectionMode && (
          <p className="px-1 text-[0.625rem] text-[var(--muted-foreground)]/60">
            {canAssignToActiveChat
              ? localizeUi("ui.panels.presetspanel.clickAPresetToEditHoverUseToAssign")
              : localizeUi("ui.panels.presetspanel.clickAPresetToEdit")}
          </p>
        )}
      </PanelSection>

      {selectionMode && (
        <SelectionActionBar
          placement="panel"
          selectedCount={selectedPresetIds.size}
          onExport={() => void handleExportSelected()}
          onDelete={handleDeleteSelected}
          exporting={exportingSelected}
        />
      )}
    </>
  );

  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label={localizeUi("navigation.topbar.presets")}>
        {(["presets", "regex", "functions"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={cn(
              "mari-chrome-control h-8 min-h-8 flex-auto px-2 text-[0.625rem]",
              tab === value && "mari-chrome-control--selected",
            )}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {localizeUi(
              value === "presets"
                ? "navigation.topbar.presets"
                : value === "regex"
                  ? "ui.panels.regexsection.regexes"
                  : "ui.panels.functionssection.functions",
            )}
          </button>
        ))}
      </div>
      <div className={tab === "presets" ? "contents" : "hidden"}>{presetLibrary}</div>

      <div className={tab === "functions" ? "contents" : "hidden"}>
        <FunctionsSection
          selectionMode={selectionTarget === "functions"}
          setSelectionMode={(enabled) => {
            if (enabled) {
              setSelectedPresetIds(new Set());
              setSelectionTarget("functions");
            } else {
              setSelectionTarget((target) => (target === "functions" ? null : target));
            }
          }}
          customToolRows={customToolRows}
          customToolCapabilities={customToolCapabilities}
          handleCreateFunction={handleCreateFunction}
          handleImportFunctions={handleImportFunctions}
          handleExportFunctions={handleExportFunctions}
          functionImportError={functionImportError}
          functionImportSuccess={functionImportSuccess}
          functionImportReviews={functionImportReviews}
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
      </div>

      <div className={tab === "regex" ? "contents" : "hidden"}>
        <RegexSection
          selectionMode={selectionTarget === "regex"}
          setSelectionMode={(enabled) => {
            if (enabled) {
              setSelectedPresetIds(new Set());
              setSelectionTarget("regex");
            } else {
              setSelectionTarget((target) => (target === "regex" ? null : target));
            }
          }}
          handleCreateRegex={handleCreateRegex}
          handleImportRegex={handleImportRegex}
          handleExportRegex={handleExportRegex}
          regexImportError={regexImportError}
          regexImportWarning={regexImportWarning}
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
      </div>

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
  selectionMode,
  setSelectionMode,
  handleCreateRegex,
  handleImportRegex,
  handleExportRegex,
  regexImportError,
  regexImportWarning,
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
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  handleCreateRegex: () => void;
  handleImportRegex: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportRegex: (scripts?: RegexScriptRow[]) => void;
  regexImportError: string | null;
  regexImportWarning: string | null;
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
  const { t: localizeUi } = useUiTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Another tab can end selection mode through the parent, so drop the checks when it does.
  const [selectionModeSeen, setSelectionModeSeen] = useState(selectionMode);
  if (selectionModeSeen !== selectionMode) {
    setSelectionModeSeen(selectionMode);
    if (!selectionMode) setSelectedIds(new Set());
  }
  const [deleting, setDeleting] = useState(false);
  const [showExecutionOrder, setShowExecutionOrder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<EditingLibraryFolder>(null);
  const { data: folders = [], isError: foldersError } = useLibraryFolders("regex");
  const createFolder = useCreateLibraryFolder("regex");
  const updateFolder = useUpdateLibraryFolder("regex");
  const deleteFolder = useDeleteLibraryFolder("regex");
  const moveScripts = useMoveLibraryItem("regex");
  const setScriptsEnabled = useSetRegexScriptsEnabled();
  const [search, setSearch] = useState("");
  const busy = deleting || setScriptsEnabled.isPending || moveScripts.isPending;
  const flat = showExecutionOrder || folders.length === 0;
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  // Reorder is index-based on the full list, so drag is off while a search hides rows.
  const reorderable = flat && !searching;
  const visibleScripts = searching
    ? sortedRegexScripts.filter(
        (script) => script.name.toLowerCase().includes(query) || script.findRegex.toLowerCase().includes(query),
      )
    : sortedRegexScripts;
  const folderByScriptId = new Map(folders.flatMap((folder) => folder.itemIds.map((id) => [id, folder.id] as const)));
  const rowsByFolder = new Map<string | null, RegexScriptRow[]>();
  for (const script of visibleScripts) {
    const folderId = folderByScriptId.get(script.id) ?? null;
    const rows = rowsByFolder.get(folderId);
    if (rows) rows.push(script);
    else rowsByFolder.set(folderId, [script]);
  }
  const reportError = () => toast.error(localizeUi("regex.library.saveFailed"));
  const { openMoveMenu, moveMenu } = useLibraryMoveMenu(folders, moveScripts, reportError);
  // Bulk actions act only on rows the search shows; hidden checks come back when it clears.
  const selectedScripts = visibleScripts.filter((script) => selectedIds.has(script.id));
  const toggleSelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const deleteSelected = async () => {
    if (busy || selectedScripts.length === 0) return;
    setDeleting(true);
    try {
      if (
        !(await showConfirmDialog({
          title: localizeUi("regex.bulk.deleteTitle"),
          message: localizeUi("regex.bulk.deleteConfirm", { count: selectedScripts.length }),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      )
        return;
      const results = await Promise.allSettled(selectedScripts.map((script) => deleteRegex.mutateAsync(script.id)));
      const failedIds = selectedScripts
        .filter((_, index) => results[index]?.status === "rejected")
        .map((script) => script.id);
      setSelectedIds(new Set(failedIds));
      if (failedIds.length > 0) {
        toast.error(localizeUi("regex.bulk.deleteFailed", { count: failedIds.length }));
      } else {
        setSelectionMode(false);
      }
    } finally {
      setDeleting(false);
    }
  };
  const { startTouchDrag: startRegexTouchDrag } = useTouchFolderDrag({
    onActivate: (scriptId) => {
      setDraggedRegexId(scriptId);
      setRegexDragReadyId(scriptId);
    },
    onDrop: (scriptId, x, y) => {
      if (!reorderable) return;
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

  const renderScript = (script: RegexScriptRow, index: number) => {
    const placements = (() => {
      try {
        return JSON.parse(script.placement) as string[];
      } catch {
        return [];
      }
    })();
    const enabled = script.enabled === "true";
    const paused = script.pausedByFolder === true;
    return (
      <div
        key={script.id}
        data-touch-reorder-item="preset-regex"
        data-touch-reorder-index={index}
        className={cn(
          "group flex flex-wrap items-start gap-2 rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-accent)]",
          draggedRegexId === script.id && "opacity-40",
        )}
        draggable={reorderable && !selectionMode && regexDragReadyId === script.id}
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
        {selectionMode ? (
          <label className="flex min-h-11 w-6 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selectedIds.has(script.id)}
              disabled={busy}
              onChange={() => toggleSelection(script.id)}
              aria-label={localizeUi("regex.bulk.selectEntry", { name: script.name })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
          </label>
        ) : reorderable ? (
          <button
            type="button"
            className="mari-chrome-accent-text-muted mari-accent-animated mt-0.5 shrink-0 cursor-grab rounded p-0.5 opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100"
            title={localizeUi("ui.lorebooks.lorebookentryrow.dragToReorder")}
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
                sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-reorder-item="preset-regex"]'),
              });
            }}
          >
            <GripVertical size="0.8125rem" />
          </button>
        ) : null}
        <Regex size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text)]" />
        <button
          className={cn("min-w-0 flex-1 basis-[min(100%,10rem)] text-left", !enabled && "opacity-50")}
          disabled={busy}
          onClick={() => (selectionMode ? toggleSelection(script.id) : openRegexDetail(script.id))}
        >
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 break-words text-xs font-medium">{script.name}</span>
            {paused && enabled && (
              <span
                title={localizeUi("regex.library.pausedByFolder")}
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]"
              >
                <Pause size="0.5rem" aria-hidden="true" />
                <span>{localizeUi("regex.library.pausedByFolder")}</span>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1">
            <span
              className="min-w-0 flex-1 truncate font-mono text-[0.5625rem] text-[var(--muted-foreground)]"
              title={localizeUi("ui.panels.regexsection.value1Value2", {
                value1: script.findRegex,
                value2: script.flags,
              })}
            >
              /{script.findRegex}/{script.flags}
            </span>
            {placements.map((placement) => (
              <span
                key={placement}
                className="shrink-0 rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]"
              >
                {placement === "ai_output"
                  ? localizeUi("ui.characters.characterregexsection.ai")
                  : localizeUi("ui.characters.advancedtab.user")}
              </span>
            ))}
          </div>
        </button>
        {!selectionMode && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div
              className="shrink-0"
              title={
                enabled
                  ? localizeUi("ui.characters.characterregexsection.disableRegex")
                  : localizeUi("ui.characters.characterregexsection.enableRegex")
              }
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <SettingsSwitch
                ariaLabel={localizeUi(
                  paused && enabled ? "regex.library.pausedScriptSwitch" : "regex.library.scriptSwitch",
                  { name: script.name },
                )}
                switchClassName={paused && enabled ? "saturate-0 opacity-70" : undefined}
                checked={enabled}
                disabled={updateRegex.isPending}
                onChange={(checked) =>
                  updateRegex.mutate({ id: script.id, enabled: checked }, { onError: reportError })
                }
                className="p-0 hover:bg-transparent"
              />
            </div>
            {folders.length > 0 && (
              <button
                type="button"
                aria-label={localizeUi("regex.library.moveScript", { name: script.name })}
                title={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                aria-haspopup="menu"
                disabled={busy}
                onClick={(event) => openMoveMenu(event.currentTarget, [script.id])}
                className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              >
                <FolderInput size="0.8125rem" />
              </button>
            )}
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              title={localizeUi("ui.characters.characterregexsection.editRegex")}
              aria-label={localizeUi("ui.characters.characterregexsection.editRegex")}
              onClick={() => openRegexDetail(script.id)}
            >
              <Pencil size="0.8125rem" />
            </button>
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              title={localizeUi("ui.characters.characterregexsection.deleteRegex")}
              aria-label={localizeUi("ui.characters.characterregexsection.deleteRegex")}
              onClick={async () => {
                if (
                  await showConfirmDialog({
                    title: localizeUi("ui.panels.regexsection.deleteRegex"),
                    message: localizeUi("ui.panels.agentspanel.deleteValue1", { value1: script.name }),
                    confirmLabel: localizeUi("lorebook.editor.batch.delete"),
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
        )}
      </div>
    );
  };

  return (
    <>
      <LibraryTabToolbar
        create={{
          label: localizeUi("ui.characters.characterregexsection.createRegex"),
          title: localizeUi("ui.characters.characterregexsection.createRegex"),
          onClick: handleCreateRegex,
        }}
        importAction={{
          label: localizeUi("ui.characters.characterregexsection.importRegexesFromJson"),
          title: localizeUi("ui.characters.characterregexsection.importRegexesFromJson"),
          accept: "application/json",
          onChange: handleImportRegex,
        }}
        exportAction={{
          label: localizeUi("ui.characters.characterregexsection.exportRegexesToJson"),
          onClick: () => handleExportRegex(),
          disabled: sortedRegexScripts.length === 0,
        }}
        select={{
          active: selectionMode,
          label: localizeUi(selectionMode ? "regex.bulk.exitSelection" : "regex.bulk.select"),
          title: localizeUi(selectionMode ? "regex.bulk.exitSelection" : "regex.bulk.select"),
          disabled: busy || sortedRegexScripts.length === 0,
          onToggle: () => {
            setSelectionMode(!selectionMode);
            if (selectionMode) setSelectedIds(new Set());
          },
        }}
        search={{ value: search, placeholder: localizeUi("search.panels.regexes"), onChange: setSearch }}
        folder={{
          label: localizeUi("ui.panels.backgroundpicker.newFolder"),
          disabled: createFolder.isPending || foldersError,
          onCreate: () =>
            createFolder.mutate(
              { name: getNextUnnamedLibraryFolderName(folders) },
              {
                onSuccess: (folder) => {
                  setShowExecutionOrder(false);
                  setEditingFolder({ id: folder.id, name: folder.name });
                },
                onError: reportError,
              },
            ),
          extra: folders.length > 0 && (
            <button
              type="button"
              aria-pressed={showExecutionOrder}
              onClick={() => setShowExecutionOrder((current) => !current)}
              className={cn(
                "mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]",
                showExecutionOrder && "mari-chrome-control--selected",
              )}
            >
              <ArrowUpDown size="0.75rem" />
              {localizeUi("regex.library.executionOrder")}
            </button>
          ),
        }}
      />
      <PanelSection title={localizeUi("ui.panels.regexsection.regexes")} icon={<Regex size="0.8125rem" />}>
        <div className="mb-1.5 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.regexsection.findReplacePatternsAppliedToAiOutputOrUser")}
        </div>
        {foldersError && (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {localizeUi("regex.library.loadFailed")}
          </p>
        )}
        {regexImportError && (
          <div className="mb-1 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
            {regexImportError}
          </div>
        )}
        {regexImportWarning && <div className="mb-1 px-1 text-xs text-amber-500">{regexImportWarning}</div>}
        {regexImportSuccess && <div className="mb-1 px-1 text-xs text-green-500">{regexImportSuccess}</div>}
        {selectionMode && (
          <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs">
            <input
              type="checkbox"
              checked={visibleScripts.length > 0 && visibleScripts.every((script) => selectedIds.has(script.id))}
              disabled={busy}
              onChange={(event) =>
                setSelectedIds(new Set(event.target.checked ? visibleScripts.map((script) => script.id) : []))
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            {localizeUi("regex.bulk.selectAll")}
          </label>
        )}
        {sortedRegexScripts.length === 0 && folders.length === 0 ? (
          <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">
            {localizeUi("ui.panels.regexsection.noRegexesYet")}
          </p>
        ) : searching && visibleScripts.length === 0 ? (
          <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">{localizeUi("search.panels.noMatches")}</p>
        ) : (
          <div data-preset-regex-root className="flex flex-col gap-0.5">
            {flat ? (
              visibleScripts.map(renderScript)
            ) : (
              <>
                {folders.map((folder) => {
                  const scripts = rowsByFolder.get(folder.id) ?? [];
                  if (searching && scripts.length === 0) return null;
                  return (
                    <PausableLibraryFolder
                      key={folder.id}
                      folder={folder}
                      dataAttribute="data-regex-folder"
                      itemCount={scripts.length}
                      itemCountLabel={localizeUi("regex.library.scriptCount", { count: scripts.length })}
                      switchLabel={localizeUi("regex.library.folderSwitch", { name: folder.name })}
                      switchHint={localizeUi("regex.library.folderSwitchHint")}
                      deleteConfirmMessage={localizeUi("regex.library.deleteFolderConfirm", { name: folder.name })}
                      editingFolder={editingFolder}
                      setEditingFolder={setEditingFolder}
                      updateFolder={updateFolder}
                      deleteFolder={deleteFolder}
                      onError={reportError}
                      busy={busy}
                      selectionMode={selectionMode}
                      searching={searching}
                    >
                      {scripts.length > 0 ? (
                        scripts.map(renderScript)
                      ) : (
                        <p className="mari-chrome-text-muted px-2 py-1 text-[0.625rem]">
                          {localizeUi("regex.library.emptyFolder")}
                        </p>
                      )}
                    </PausableLibraryFolder>
                  );
                })}
                {rowsByFolder.get(null)?.map(renderScript)}
              </>
            )}
          </div>
        )}
        {selectionMode && (
          <SelectionActionBar
            selectedCount={selectedScripts.length}
            onExport={() => handleExportRegex(selectedScripts)}
            onDelete={() => void deleteSelected()}
            exportDisabled={busy}
            deleteDisabled={busy}
            extraAction={
              <div className="flex w-full flex-wrap gap-1">
                {([true, false] as const).map((enabled) => (
                  <button
                    key={String(enabled)}
                    type="button"
                    disabled={busy || selectedScripts.length === 0}
                    onClick={() =>
                      setScriptsEnabled.mutate(
                        { scriptIds: selectedScripts.map((script) => script.id), enabled },
                        { onError: reportError },
                      )
                    }
                    className="mari-chrome-control flex-auto px-2 py-2 text-xs"
                  >
                    {localizeUi(enabled ? "regex.library.enableSelected" : "regex.library.disableSelected")}
                  </button>
                ))}
                {folders.length > 0 && (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    disabled={busy || selectedScripts.length === 0}
                    onClick={(event) =>
                      openMoveMenu(
                        event.currentTarget,
                        selectedScripts.map((script) => script.id),
                      )
                    }
                    className="mari-chrome-control flex-auto px-2 py-2 text-xs"
                  >
                    <FolderInput size="0.75rem" />
                    {localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                  </button>
                )}
              </div>
            }
            className="[&>div:last-child]:flex-wrap"
          />
        )}
        {moveMenu}
      </PanelSection>
    </>
  );
}

function FunctionsSection({
  selectionMode,
  setSelectionMode,
  customToolRows,
  customToolCapabilities,
  handleCreateFunction,
  handleImportFunctions,
  handleExportFunctions,
  functionImportError,
  functionImportSuccess,
  functionImportReviews,
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
  selectionMode: boolean;
  setSelectionMode: (enabled: boolean) => void;
  customToolRows: CustomToolRow[];
  customToolCapabilities?: CustomToolCapabilities;
  handleCreateFunction: () => void;
  handleImportFunctions: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportFunctions: (tools?: CustomToolRow[]) => void;
  functionImportError: string | null;
  functionImportSuccess: string | null;
  functionImportReviews: CustomToolImportReview[];
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
  const { t: localizeUi } = useUiTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Another tab can end selection mode through the parent, so drop the checks when it does.
  const [selectionModeSeen, setSelectionModeSeen] = useState(selectionMode);
  if (selectionModeSeen !== selectionMode) {
    setSelectionModeSeen(selectionMode);
    if (!selectionMode) setSelectedIds(new Set());
  }
  const [deleting, setDeleting] = useState(false);
  const [showManualOrder, setShowManualOrder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<EditingLibraryFolder>(null);
  const { data: folders = [], isError: foldersError } = useLibraryFolders("functions");
  const createFolder = useCreateLibraryFolder("functions");
  const updateFolder = useUpdateLibraryFolder("functions");
  const deleteFolder = useDeleteLibraryFolder("functions");
  const moveTools = useMoveLibraryItem("functions");
  const setToolsEnabled = useSetCustomToolsEnabled();
  const [search, setSearch] = useState("");
  const busy = deleting || setToolsEnabled.isPending || moveTools.isPending;
  const flat = showManualOrder || folders.length === 0;
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  // Reorder is index-based on the full list, so drag is off while a search hides rows.
  const reorderable = flat && !searching;
  const visibleTools = searching
    ? customToolRows.filter(
        (tool) => tool.name.toLowerCase().includes(query) || (tool.description ?? "").toLowerCase().includes(query),
      )
    : customToolRows;
  const folderByToolId = new Map(folders.flatMap((folder) => folder.itemIds.map((id) => [id, folder.id] as const)));
  const rowsByFolder = new Map<string | null, CustomToolRow[]>();
  for (const tool of visibleTools) {
    const folderId = folderByToolId.get(tool.id) ?? null;
    const rows = rowsByFolder.get(folderId);
    if (rows) rows.push(tool);
    else rowsByFolder.set(folderId, [tool]);
  }
  const reportError = () => toast.error(localizeUi("functions.library.saveFailed"));
  const { openMoveMenu, moveMenu } = useLibraryMoveMenu(folders, moveTools, reportError);
  // Bulk actions act only on rows the search shows; hidden checks come back when it clears.
  const selectedTools = visibleTools.filter((tool) => selectedIds.has(tool.id));
  const toggleSelection = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const deleteSelected = async () => {
    if (busy || selectedTools.length === 0) return;
    setDeleting(true);
    try {
      if (
        !(await showConfirmDialog({
          title: localizeUi("functions.bulk.deleteTitle"),
          message: localizeUi("functions.bulk.deleteConfirm", { count: selectedTools.length }),
          confirmLabel: localizeUi("lorebook.editor.batch.delete"),
          tone: "destructive",
        }))
      )
        return;
      const results = await Promise.allSettled(selectedTools.map((tool) => deleteCustomTool.mutateAsync(tool.id)));
      const failedIds = selectedTools
        .filter((_, index) => results[index]?.status === "rejected")
        .map((tool) => tool.id);
      setSelectedIds(new Set(failedIds));
      if (failedIds.length > 0) {
        toast.error(localizeUi("functions.bulk.deleteFailed", { count: failedIds.length }));
      } else {
        setSelectionMode(false);
      }
    } finally {
      setDeleting(false);
    }
  };
  const { startTouchDrag: startFunctionTouchDrag } = useTouchFolderDrag({
    onActivate: (toolId) => {
      setDraggedFunctionId(toolId);
      setFunctionDragReadyId(toolId);
    },
    onDrop: (toolId, x, y) => {
      if (!reorderable) return;
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

  const renderTool = (tool: CustomToolRow, index: number) => {
    const enabled = tool.enabled === "true" || tool.enabled === "1";
    const paused = tool.pausedByFolder === true;
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
          draggedFunctionId === tool.id && "opacity-40",
        )}
        draggable={reorderable && !selectionMode && functionDragReadyId === tool.id}
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
        {selectionMode ? (
          <label className="flex min-h-11 w-6 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selectedIds.has(tool.id)}
              disabled={busy}
              onChange={() => toggleSelection(tool.id)}
              aria-label={localizeUi("functions.bulk.selectEntry", { name: tool.name })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
          </label>
        ) : reorderable ? (
          <button
            type="button"
            className="mari-chrome-accent-text-muted mari-accent-animated mt-0.5 shrink-0 cursor-grab rounded p-0.5 opacity-100 transition-all hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] active:cursor-grabbing [@media(pointer:fine)]:opacity-0 [@media(pointer:fine)]:group-focus-within:opacity-100 [@media(pointer:fine)]:group-hover:opacity-100"
            title={localizeUi("ui.lorebooks.lorebookentryrow.dragToReorder")}
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
                sourceElement: event.currentTarget.closest<HTMLElement>('[data-touch-reorder-item="preset-function"]'),
              });
            }}
          >
            <GripVertical size="0.8125rem" />
          </button>
        ) : null}
        <Wrench size="0.875rem" className="mt-0.5 shrink-0 text-[var(--marinara-chat-chrome-button-text)]" />
        <button
          className={cn("min-w-0 flex-1 basis-[min(100%,10rem)] text-left", !enabled && "opacity-50")}
          disabled={busy}
          onClick={() => (selectionMode ? toggleSelection(tool.id) : openToolDetail(tool.id))}
        >
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium" title={tool.name}>
              {tool.name}
            </span>
            {paused && enabled && (
              <span
                title={localizeUi("regex.library.pausedByFolder")}
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]"
              >
                <Pause size="0.5rem" aria-hidden="true" />
                <span>{localizeUi("regex.library.pausedByFolder")}</span>
              </span>
            )}
            <span className="shrink-0 rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]">
              {formatFunctionExecutionType(tool.executionType)}
            </span>
            <span className="shrink-0 rounded bg-[var(--secondary)] px-1 py-0.5 text-[0.5rem] text-[var(--muted-foreground)]">
              {parameterCount} {localizeUi("ui.panels.functionssection.param")}
              {parameterCount === 1 ? "" : localizeUi("ui.noodle.stageprofileview.s")}
            </span>
            {scriptUnavailable && (
              <span className="shrink-0 rounded bg-amber-500/10 px-1 py-0.5 text-[0.5rem] text-amber-400">
                {localizeUi("ui.panels.functionssection.scriptDisabled")}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[0.5625rem] text-[var(--muted-foreground)]">
            {tool.description || localizeUi("ui.panels.agentcard.noDescription")}
          </div>
        </button>
        {!selectionMode && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div
              className="shrink-0"
              title={
                enabled
                  ? localizeUi("ui.panels.functionssection.disableFunction")
                  : localizeUi("ui.panels.functionssection.enableFunction")
              }
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <SettingsSwitch
                ariaLabel={
                  paused && enabled
                    ? localizeUi("functions.library.pausedFunctionSwitch", { name: tool.name })
                    : enabled
                      ? localizeUi("ui.panels.functionssection.disableFunction")
                      : localizeUi("ui.panels.functionssection.enableFunction")
                }
                switchClassName={paused && enabled ? "saturate-0 opacity-70" : undefined}
                checked={enabled}
                disabled={updateCustomTool.isPending}
                onChange={(checked) =>
                  updateCustomTool.mutate({ id: tool.id, enabled: checked }, { onError: reportError })
                }
                className="p-0 hover:bg-transparent"
              />
            </div>
            {folders.length > 0 && (
              <button
                type="button"
                aria-label={localizeUi("functions.library.moveFunction", { name: tool.name })}
                title={localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                aria-haspopup="menu"
                disabled={busy}
                onClick={(event) => openMoveMenu(event.currentTarget, [tool.id])}
                className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              >
                <FolderInput size="0.8125rem" />
              </button>
            )}
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              title={localizeUi("ui.panels.functionssection.editFunction")}
              aria-label={localizeUi("ui.panels.functionssection.editFunction")}
              onClick={() => openToolDetail(tool.id)}
            >
              <Pencil size="0.8125rem" />
            </button>
            <button
              type="button"
              className="mari-chrome-control mari-chrome-control--small shrink-0 p-1"
              title={localizeUi("ui.agents.tooleditor.deleteFunction")}
              aria-label={localizeUi("ui.agents.tooleditor.deleteFunction")}
              onClick={async () => {
                if (
                  await showConfirmDialog({
                    title: localizeUi("ui.panels.functionssection.deleteFunction"),
                    message: localizeUi("ui.panels.agentspanel.deleteValue1", { value1: tool.name }),
                    confirmLabel: localizeUi("lorebook.editor.batch.delete"),
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
        )}
      </div>
    );
  };

  return (
    <>
      <LibraryTabToolbar
        create={{
          label: localizeUi("ui.panels.functionssection.createFunction"),
          title: localizeUi("ui.panels.functionssection.createFunction"),
          onClick: handleCreateFunction,
        }}
        importAction={{
          label: localizeUi("ui.panels.functionssection.importFunctionsFromZipOrJson"),
          title: localizeUi("ui.panels.functionssection.importFunctionsFromZipOrJson"),
          accept: "application/json,application/zip,.json,.zip",
          onChange: handleImportFunctions,
        }}
        exportAction={{
          label: localizeUi("ui.panels.functionssection.exportFunctionsToZip"),
          onClick: () => void handleExportFunctions(),
          disabled: customToolRows.length === 0,
        }}
        select={{
          active: selectionMode,
          label: localizeUi(selectionMode ? "functions.bulk.exitSelection" : "functions.bulk.select"),
          title: localizeUi(selectionMode ? "functions.bulk.exitSelection" : "functions.bulk.select"),
          disabled: busy || customToolRows.length === 0,
          onToggle: () => {
            setSelectionMode(!selectionMode);
            if (selectionMode) setSelectedIds(new Set());
          },
        }}
        search={{ value: search, placeholder: localizeUi("search.panels.functions"), onChange: setSearch }}
        folder={{
          label: localizeUi("ui.panels.backgroundpicker.newFolder"),
          disabled: createFolder.isPending || foldersError,
          onCreate: () =>
            createFolder.mutate(
              { name: getNextUnnamedLibraryFolderName(folders) },
              {
                onSuccess: (folder) => {
                  setShowManualOrder(false);
                  setEditingFolder({ id: folder.id, name: folder.name });
                },
                onError: reportError,
              },
            ),
          extra: folders.length > 0 && (
            <button
              type="button"
              aria-pressed={showManualOrder}
              onClick={() => setShowManualOrder((current) => !current)}
              className={cn(
                "mari-chrome-control mari-chrome-control--small flex-1 justify-start text-[0.6875rem]",
                showManualOrder && "mari-chrome-control--selected",
              )}
            >
              <ArrowUpDown size="0.75rem" />
              {localizeUi("dragDrop.manualOrder")}
            </button>
          ),
        }}
      />
      <PanelSection title={localizeUi("ui.panels.functionssection.functions")} icon={<Wrench size="0.8125rem" />}>
        <div className="mb-1.5 px-1 text-[0.625rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.panels.functionssection.customFunctionCallsAvailableFromChatSettings")}
        </div>
        {functionImportError && (
          <div className="mb-1 rounded-md border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)] px-2 py-1.5 text-xs text-[var(--marinara-chat-chrome-panel-text)]">
            {functionImportError}
          </div>
        )}
        {functionImportSuccess && <div className="mb-1 px-1 text-xs text-green-500">{functionImportSuccess}</div>}
        {functionImportReviews.length > 0 && (
          <section
            aria-live="polite"
            aria-label={localizeUi("ui.panels.functionssection.executableImportReviewTitle")}
            className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/45 p-2.5"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck aria-hidden="true" size="0.9375rem" className="mt-0.5 shrink-0 text-[var(--primary)]" />
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-[var(--foreground)]">
                  {localizeUi("ui.panels.functionssection.executableImportReviewTitle")}
                </h3>
                <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
                  {localizeUi("ui.panels.functionssection.executableImportReviewDescription")}
                </p>
              </div>
            </div>
            <dl className="mt-2 divide-y divide-[var(--border)]">
              {functionImportReviews.map((review, index) => (
                <div key={`${review.name}-${index}`} className="grid gap-1 py-2 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <dt className="sr-only">{localizeUi("ui.panels.functionssection.functionName")}</dt>
                    <dd className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] font-semibold">{review.name}</dd>
                    <span className="shrink-0 rounded bg-[var(--background)] px-1.5 py-0.5 text-[0.5625rem] text-[var(--muted-foreground)]">
                      {localizeUi(
                        review.executionType === "webhook"
                          ? "ui.panels.functionssection.webhook"
                          : "ui.panels.functionssection.script",
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 text-[0.625rem]">
                    {review.executionType === "webhook" && (
                      <>
                        <dt className="text-[var(--muted-foreground)]">
                          {localizeUi("ui.panels.functionssection.destinationOrigin")}
                        </dt>
                        <dd className="max-w-40 break-all text-right font-mono text-[var(--foreground)]">
                          {review.destinationOrigin ?? localizeUi("ui.panels.functionssection.invalidWebhookOrigin")}
                        </dd>
                      </>
                    )}
                    <dt className="text-[var(--muted-foreground)]">
                      {localizeUi("ui.panels.functionssection.requestedEnabled")}
                    </dt>
                    <dd className="text-right font-medium">
                      {localizeUi(
                        review.requestedEnabled ? "ui.panels.functionssection.yes" : "ui.panels.functionssection.no",
                      )}
                    </dd>
                    <dt className="text-[var(--muted-foreground)]">
                      {localizeUi("ui.panels.functionssection.requestedHiddenContext")}
                    </dt>
                    <dd className="text-right font-medium">
                      {localizeUi(
                        review.requestedHiddenContext
                          ? "ui.panels.functionssection.yes"
                          : "ui.panels.functionssection.no",
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[0.625rem] font-medium leading-relaxed text-[var(--foreground)]">
              {localizeUi("ui.panels.functionssection.importedWebhookSafeState")}
            </p>
            <p className="mt-0.5 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.panels.functionssection.reviewBeforeEnabling")}
            </p>
          </section>
        )}
        {foldersError && (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {localizeUi("functions.library.loadFailed")}
          </p>
        )}
        {selectionMode && (
          <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs">
            <input
              type="checkbox"
              checked={visibleTools.length > 0 && visibleTools.every((tool) => selectedIds.has(tool.id))}
              disabled={busy}
              onChange={(event) =>
                setSelectedIds(new Set(event.target.checked ? visibleTools.map((tool) => tool.id) : []))
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            {localizeUi("functions.bulk.selectAll")}
          </label>
        )}
        {customToolRows.length === 0 && folders.length === 0 ? (
          <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">
            {localizeUi("ui.panels.functionssection.noFunctionsYet")}
          </p>
        ) : searching && visibleTools.length === 0 ? (
          <p className="mari-chrome-text-muted px-1 py-2 text-[0.625rem]">{localizeUi("search.panels.noMatches")}</p>
        ) : (
          <div data-preset-functions-root className="flex flex-col gap-0.5">
            {flat ? (
              visibleTools.map(renderTool)
            ) : (
              <>
                {folders.map((folder) => {
                  const tools = rowsByFolder.get(folder.id) ?? [];
                  if (searching && tools.length === 0) return null;
                  return (
                    <PausableLibraryFolder
                      key={folder.id}
                      folder={folder}
                      dataAttribute="data-function-folder"
                      itemCount={tools.length}
                      itemCountLabel={localizeUi("functions.library.functionCount", { count: tools.length })}
                      switchLabel={localizeUi("functions.library.folderSwitch", { name: folder.name })}
                      switchHint={localizeUi("functions.library.folderSwitchHint")}
                      deleteConfirmMessage={localizeUi("functions.library.deleteFolderConfirm", { name: folder.name })}
                      editingFolder={editingFolder}
                      setEditingFolder={setEditingFolder}
                      updateFolder={updateFolder}
                      deleteFolder={deleteFolder}
                      onError={reportError}
                      busy={busy}
                      selectionMode={selectionMode}
                      searching={searching}
                    >
                      {tools.length > 0 ? (
                        tools.map(renderTool)
                      ) : (
                        <p className="mari-chrome-text-muted px-2 py-1 text-[0.625rem]">
                          {localizeUi("functions.library.emptyFolder")}
                        </p>
                      )}
                    </PausableLibraryFolder>
                  );
                })}
                {rowsByFolder.get(null)?.map(renderTool)}
              </>
            )}
          </div>
        )}
        {selectionMode && (
          <SelectionActionBar
            selectedCount={selectedTools.length}
            onExport={() => void handleExportFunctions(selectedTools)}
            onDelete={() => void deleteSelected()}
            exportDisabled={busy}
            deleteDisabled={busy}
            extraAction={
              <div className="flex w-full flex-wrap gap-1">
                {([true, false] as const).map((enabled) => (
                  <button
                    key={String(enabled)}
                    type="button"
                    disabled={busy || selectedTools.length === 0}
                    onClick={() =>
                      setToolsEnabled.mutate(
                        { toolIds: selectedTools.map((tool) => tool.id), enabled },
                        { onError: reportError },
                      )
                    }
                    className="mari-chrome-control flex-auto px-2 py-2 text-xs"
                  >
                    {localizeUi(enabled ? "regex.library.enableSelected" : "regex.library.disableSelected")}
                  </button>
                ))}
                {folders.length > 0 && (
                  <button
                    type="button"
                    aria-haspopup="menu"
                    disabled={busy || selectedTools.length === 0}
                    onClick={(event) =>
                      openMoveMenu(
                        event.currentTarget,
                        selectedTools.map((tool) => tool.id),
                      )
                    }
                    className="mari-chrome-control flex-auto px-2 py-2 text-xs"
                  >
                    <FolderInput size="0.75rem" />
                    {localizeUi("ui.panels.backgroundpicker.moveToFolder")}
                  </button>
                )}
              </div>
            }
            className="[&>div:last-child]:flex-wrap"
          />
        )}
        {moveMenu}
      </PanelSection>
    </>
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
