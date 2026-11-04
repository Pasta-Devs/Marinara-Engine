// ──────────────────────────────────────────────
// Modal: SillyTavern Bulk Import
// ──────────────────────────────────────────────
import { useState, useCallback } from "react";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_SECONDARY } from "../ui/neutral-surface-styles";
import {
  FolderSearch,
  FolderOpen,
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  MessageSquare,
  FileText,
  BookOpen,
  Image,
  AlertTriangle,
  Import,
  UserCircle,
  ChevronRight,
  ArrowLeft,
  Folder,
  Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api-client";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ScanItemBase {
  id: string;
  path: string;
  name: string;
  modifiedAt: string | null;
}

interface ScanResult {
  success: boolean;
  error?: string;
  dataDir?: string;
  characters: Array<ScanItemBase & { format: string }>;
  chats: Array<ScanItemBase & { characterName: string; folderName: string }>;
  groupChats: Array<ScanItemBase & { groupName: string; members: string[] }>;
  presets: Array<ScanItemBase & { isBuiltin?: boolean }>;
  lorebooks: ScanItemBase[];
  backgrounds: ScanItemBase[];
  personas: Array<ScanItemBase & { description: string }>;
}

interface ImportResult {
  success: boolean;
  error?: string;
  imported: {
    characters: number;
    chats: number;
    groupChats: number;
    presets: number;
    lorebooks: number;
    backgrounds: number;
    personas: number;
  };
  errors: string[];
}

interface ImportProgress {
  category: string;
  item: string;
  current: number;
  total: number;
  imported: ImportResult["imported"];
}

type Phase = "input" | "scanning" | "preview" | "importing" | "done";
type CategoryKey = "characters" | "chats" | "groupChats" | "presets" | "lorebooks" | "backgrounds" | "personas";
type SelectionState = Record<CategoryKey, string[]>;
type TagImportMode = "all" | "none" | "existing";

const TAG_IMPORT_OPTIONS: Array<{ value: TagImportMode; label: string; description: string }> = [
  { value: "all", label: "All tags", description: "Keep source tags." },
  { value: "none", label: "No tags", description: "Skip source tags." },
  { value: "existing", label: "Existing only", description: "Keep tags already in Marinara." },
];

const REGEX_SCOPE_OPTIONS: Array<{ value: "character" | "global"; label: string; description: string }> = [
  { value: "character", label: "Character only", description: "Scripts apply only to each bot." },
  { value: "global", label: "Global", description: "Add to Presets → Regexes for every chat." },
];

type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

async function readJsonResponse<T>(res: Response): Promise<{ data: T | null; raw: string }> {
  const raw = await res.text().catch(() => "");
  if (!raw.trim()) return { data: null, raw };

  try {
    return { data: JSON.parse(raw) as T, raw };
  } catch {
    return { data: null, raw };
  }
}

function describeResponseError(res: Response, data: ApiErrorPayload | null, raw: string, fallback: string): string {
  const status = [res.status, res.statusText].filter(Boolean).join(" ");
  const detail =
    typeof data?.error === "string" ? data.error : typeof data?.message === "string" ? data.message : raw.trim();

  return `${fallback}${status ? ` (${status})` : ""}${detail ? `: ${detail.slice(0, 500)}` : ""}`;
}

function buildInitialSelection(scan: ScanResult): SelectionState {
  return {
    characters: scan.characters.map((item) => item.id),
    chats: scan.chats.map((item) => item.id),
    groupChats: scan.groupChats.map((item) => item.id),
    presets: scan.presets.filter((item) => !item.isBuiltin).map((item) => item.id),
    lorebooks: scan.lorebooks.map((item) => item.id),
    backgrounds: scan.backgrounds.map((item) => item.id),
    personas: scan.personas.map((item) => item.id),
  };
}

function formatModifiedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function STBulkImportModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const modifiedDetail = (modified: string | null) =>
    modified ? ` ${localizeUi("ui.modals.stbulkimportmodal.modifiedValue1", { value1: modified })}` : "";
  const [folderPath, setFolderPath] = useState("");
  const [folderToken, setFolderToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selection, setSelection] = useState<SelectionState>({
    characters: [],
    chats: [],
    groupChats: [],
    presets: [],
    lorebooks: [],
    backgrounds: [],
    personas: [],
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState("");
  const [characterTagImportMode, setCharacterTagImportMode] = useState<TagImportMode>("all");
  const [regexScriptScope, setRegexScriptScope] = useState<"character" | "global">("character");
  const qc = useQueryClient();

  const reset = useCallback(() => {
    setPhase("input");
    setScanResult(null);
    setFolderToken(null);
    setSelection({
      characters: [],
      chats: [],
      groupChats: [],
      presets: [],
      lorebooks: [],
      backgrounds: [],
      personas: [],
    });
    setImportResult(null);
    setProgress(null);
    setError("");
    setCharacterTagImportMode("all");
    setRegexScriptScope("character");
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleScan = useCallback(async () => {
    if (!folderPath.trim()) return;
    setPhase("scanning");
    setError("");

    try {
      const res = await api.raw("/import/st-bulk/scan", {
        method: "POST",
        body: JSON.stringify({ folderPath: folderPath.trim(), folderToken }),
      });
      const { data, raw } = await readJsonResponse<ScanResult>(res);
      if (res.ok && data?.success) {
        setScanResult(data);
        setSelection(buildInitialSelection(data));
        setPhase("preview");
      } else {
        setError(describeResponseError(res, data, raw, "Scan failed"));
        setPhase("input");
      }
    } catch (err) {
      setError(err instanceof Error ? `Failed to connect to server: ${err.message}` : "Failed to connect to server");
      setPhase("input");
    }
  }, [folderPath, folderToken]);

  const [picking, setPicking] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState("");
  const [browserFolders, setBrowserFolders] = useState<string[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  const loadDirectory = useCallback(async (dirPath?: string) => {
    setBrowserLoading(true);
    try {
      const res = await api.raw("/import/list-directory", {
        method: "POST",
        body: JSON.stringify({ path: dirPath || "" }),
      });
      const { data, raw } = await readJsonResponse<{
        success: boolean;
        path?: string;
        folderToken?: string;
        folders?: string[];
        error?: string;
      }>(res);
      if (!res.ok || !data?.success || !data.path) {
        setBrowserFolders([]);
        setFolderToken(null);
        setError(describeResponseError(res, data, raw, "Unable to list directories"));
        return;
      }
      setBrowserPath(data.path);
      setFolderToken(data.folderToken ?? null);
      setBrowserFolders(data.folders ?? []);
    } catch (err) {
      setBrowserFolders([]);
      setFolderToken(null);
      setError(err instanceof Error ? err.message : "Unable to list directories");
    } finally {
      setBrowserLoading(false);
    }
  }, []);

  const handleBrowse = useCallback(async () => {
    setPicking(true);
    setError("");
    try {
      const res = await api.raw("/import/pick-folder", {
        method: "POST",
      });
      const { data, raw } = await readJsonResponse<{
        success: boolean;
        path?: string;
        folderToken?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        setError(describeResponseError(res, data, raw, "Unable to open folder picker"));
        setPicking(false);
        return;
      }
      if (data?.success && data.path) {
        setFolderPath(data.path);
        setFolderToken(data.folderToken ?? null);
        setPicking(false);
        return;
      }
    } catch {
      // Native picker failed — fall back to browser below
    }
    setPicking(false);
    setShowFolderBrowser(true);
    loadDirectory(folderPath || undefined);
  }, [folderPath, loadDirectory]);

  const updateCategorySelection = useCallback((category: CategoryKey, nextIds: string[]) => {
    setSelection((prev) => ({ ...prev, [category]: nextIds }));
  }, []);

  const toggleCategoryItem = useCallback((category: CategoryKey, itemId: string, checked: boolean) => {
    setSelection((prev) => {
      const existing = new Set(prev[category]);
      if (checked) existing.add(itemId);
      else existing.delete(itemId);
      return { ...prev, [category]: [...existing] };
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!folderPath.trim()) return;
    setPhase("importing");
    setProgress(null);
    setError("");

    try {
      const res = await api.raw("/import/st-bulk/run", {
        method: "POST",
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          folderToken,
          options: { ...selection, characterTagImportMode, regexScriptScope },
        }),
      });

      if (!res.ok) {
        const { data, raw } = await readJsonResponse<ApiErrorPayload>(res);
        setError(describeResponseError(res, data, raw, "Import failed"));
        setPhase("preview");
        return;
      }

      if (!res.body) {
        setError("Import failed: server returned no response stream");
        setPhase("preview");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === "progress") {
              setProgress(parsed as ImportProgress);
            } else if (eventType === "done") {
              setImportResult(parsed as ImportResult);
              setPhase("done");
              qc.invalidateQueries();
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? `Import failed: ${err.message}` : "Import failed — server error");
      setPhase("preview");
    }
  }, [characterTagImportMode, regexScriptScope, folderPath, folderToken, qc, selection]);

  const hasAnySelected = Object.values(selection).some((ids) => ids.length > 0);
  const builtinPresetCount = scanResult?.presets.filter((item) => item.isBuiltin).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeDisabled={phase === "importing"}
      title={localizeUi("ui.modals.stbulkimportmodal.importFromSillytavern")}
      width="max-w-3xl"
      footer={
        phase === "input" || phase === "scanning" ? (
          <button
            onClick={handleScan}
            disabled={!folderPath.trim() || phase === "scanning"}
            className={SHEET_BUTTON_PRIMARY}
          >
            {phase === "scanning" ? (
              <Loader2 size="0.875rem" className="animate-spin" />
            ) : (
              <FolderSearch size="0.875rem" />
            )}
            {phase === "scanning"
              ? localizeUi("ui.modals.stbulkimportmodal.scanning")
              : localizeUi("ui.modals.stbulkimportmodal.scanFolder")}
          </button>
        ) : phase === "preview" && scanResult ? (
          <>
            <button onClick={handleImport} disabled={!hasAnySelected} className={SHEET_BUTTON_PRIMARY}>
              <Import size="0.875rem" />
              {localizeUi("ui.modals.stbulkimportmodal.importSelected")}
            </button>
            <button onClick={reset} className={SHEET_BUTTON_SECONDARY}>
              {localizeUi("ui.noodle.noodlerframe.back")}
            </button>
          </>
        ) : phase === "done" && importResult ? (
          <button onClick={handleClose} className={SHEET_BUTTON_PRIMARY}>
            {localizeUi("lorebook.editor.batch.done")}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {(phase === "input" || phase === "scanning") && (
          <>
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.modals.stbulkimportmodal.selectOrEnterThePathToYourSillytavernInstallation")}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">
                {localizeUi("ui.modals.stbulkimportmodal.sillytavernFolderPath")}
              </label>
              <div className="flex gap-2 max-sm:flex-col">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => {
                    setFolderPath(e.target.value);
                    setFolderToken(null);
                  }}
                  placeholder={localizeUi("ui.modals.stbulkimportmodal.pathToSillytavern")}
                  disabled={phase === "scanning"}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs max-sm:text-base outline-none ring-1 ring-transparent placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScan();
                  }}
                />
                <button
                  onClick={handleBrowse}
                  disabled={phase === "scanning" || picking}
                  className="flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium max-sm:min-h-11 max-sm:text-sm transition-all hover:bg-[var(--secondary)] active:scale-95 disabled:opacity-50"
                  title={localizeUi("ui.modals.stbulkimportmodal.browseForFolder")}
                >
                  {picking ? <Loader2 size="0.875rem" className="animate-spin" /> : <FolderOpen size="0.875rem" />}
                  {localizeUi("ui.modals.stbulkimportmodal.browse")}
                </button>
              </div>
            </div>

            {showFolderBrowser && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                  <button
                    onClick={() => {
                      const parent = browserPath.includes("\\")
                        ? browserPath.replace(/\\[^\\]+$/, "")
                        : browserPath.replace(/\/[^/]+$/, "") || "/";
                      if (parent !== browserPath) loadDirectory(parent);
                    }}
                    disabled={browserLoading || browserPath === "/"}
                    className="rounded p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
                    title={localizeUi("ui.modals.stbulkimportmodal.goUp")}
                  >
                    <ArrowLeft size="0.75rem" />
                  </button>
                  <span className="flex-1 truncate font-mono text-[0.625rem] text-[var(--muted-foreground)]">
                    {browserPath || "/"}
                  </span>
                  <button
                    onClick={() => {
                      setFolderPath(browserPath);
                      setShowFolderBrowser(false);
                    }}
                    className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 active:scale-95"
                  >
                    {localizeUi("ui.modals.stbulkimportmodal.selectThisFolder")}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {browserLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size="0.875rem" className="animate-spin text-[var(--muted-foreground)]" />
                    </div>
                  ) : browserFolders.length === 0 ? (
                    <p className="py-3 text-center text-[0.625rem] text-[var(--muted-foreground)]">
                      {localizeUi("ui.modals.stbulkimportmodal.noSubfolders")}
                    </p>
                  ) : (
                    browserFolders.map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          const sep = browserPath.includes("\\") ? "\\" : "/";
                          loadDirectory(browserPath ? `${browserPath}${sep}${name}` : name);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--accent)]"
                      >
                        <Folder size="0.8125rem" className="shrink-0 text-sky-400" />
                        <span className="truncate">{name}</span>
                        <ChevronRight size="0.6875rem" className="ml-auto shrink-0 text-[var(--muted-foreground)]" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
                <XCircle size="0.875rem" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              <strong>{localizeUi("ui.panels.themessettings.tip")}</strong>{" "}
              {localizeUi("ui.modals.stbulkimportmodal.thisIsTheMainSillytavernFolderUsuallyTheOne")}{" "}
              <code className="rounded bg-[var(--secondary)] px-1">data/</code> {localizeUi("ui.noodle.noodlehome.or")}{" "}
              <code className="rounded bg-[var(--secondary)] px-1">public/</code>.
            </div>
          </>
        )}

        {phase === "preview" && scanResult && (
          <>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
              <CheckCircle size="0.875rem" className="mt-0.5 shrink-0" />
              <span>
                {localizeUi("ui.modals.stbulkimportmodal.foundSillytavernDataIn")}{" "}
                <code className="rounded bg-[var(--secondary)] px-1 text-[0.625rem]">{scanResult.dataDir}</code>
              </span>
            </div>

            {builtinPresetCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-400">
                <AlertTriangle size="0.875rem" className="mt-0.5 shrink-0" />
                <span>
                  {localizeUi("ui.modals.stbulkimportmodal.builtInPresetsDetectedAndUnchecked", {
                    count: builtinPresetCount,
                  })}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {localizeUi("ui.modals.stbulkimportmodal.chooseExactlyWhatToImport")}
                </span>
                <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.modals.stbulkimportmodal.selectedItems", {
                    count: Object.values(selection).reduce((sum, ids) => sum + ids.length, 0),
                  })}
                </span>
              </div>

              <SelectableImportCategory
                icon={<Users size="0.875rem" />}
                label={localizeUi("navigation.topbar.characters")}
                items={scanResult.characters}
                selectedIds={selection.characters}
                onToggleItem={(itemId, checked) => toggleCategoryItem("characters", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "characters",
                    scanResult.characters.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("characters", [])}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return (
                    <span>
                      {item.format.toUpperCase()}
                      {modifiedDetail(modified)}
                    </span>
                  );
                }}
              />

              {scanResult.characters.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {localizeUi("ui.modals.stbulkimportmodal.importedCharacterTags")}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.modals.stbulkimportmodal.chooseHowSourceSiteTagsAreAppliedToImported")}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {TAG_IMPORT_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                          characterTagImportMode === option.value
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkCharacterTagImportMode"
                          value={option.value}
                          checked={characterTagImportMode === option.value}
                          onChange={() => setCharacterTagImportMode(option.value)}
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
              )}

              {scanResult.characters.length > 0 && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-3">
                  <p className="text-xs font-medium text-[var(--foreground)]">
                    {localizeUi("ui.modals.importcharactermodal.importedRegexScripts")}
                  </p>
                  <p className="mt-0.5 text-[0.6875rem] text-[var(--muted-foreground)]">
                    {localizeUi("ui.modals.stbulkimportmodal.keepEachBotSEmbeddedFindReplaceScriptsScoped")}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {REGEX_SCOPE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
                          regexScriptScope === option.value
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border)] bg-[var(--background)]/40 hover:border-[var(--muted-foreground)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkRegexScriptScope"
                          value={option.value}
                          checked={regexScriptScope === option.value}
                          onChange={() => setRegexScriptScope(option.value)}
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
              )}

              <SelectableImportCategory
                icon={<MessageSquare size="0.875rem" />}
                label={localizeUi("navigation.common.chats")}
                items={scanResult.chats}
                selectedIds={selection.chats}
                onToggleItem={(itemId, checked) => toggleCategoryItem("chats", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "chats",
                    scanResult.chats.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("chats", [])}
                getItemLabel={(item) => item.name || item.characterName}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.folder")} {item.folderName}{" "}
                      {localizeUi("ui.modals.stbulkimportmodal.filename")} {item.name}{" "}
                      {localizeUi("ui.modals.stbulkimportmodal.charactername")} {item.characterName}
                      {modifiedDetail(modified)}
                    </span>
                  );
                }}
              />

              <SelectableImportCategory
                icon={<Users size="0.875rem" />}
                label={localizeUi("ui.modals.stbulkimportmodal.groupChats")}
                items={scanResult.groupChats}
                selectedIds={selection.groupChats}
                onToggleItem={(itemId, checked) => toggleCategoryItem("groupChats", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "groupChats",
                    scanResult.groupChats.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("groupChats", [])}
                getItemLabel={(item) => item.groupName || item.name}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return (
                    <span>
                      {item.members.length > 0
                        ? item.members.join(", ")
                        : localizeUi("ui.modals.stbulkimportmodal.noLinkedMembers")}
                      {modifiedDetail(modified)}
                    </span>
                  );
                }}
              />

              <SelectableImportCategory
                icon={<FileText size="0.875rem" />}
                label={localizeUi("navigation.topbar.presets")}
                items={scanResult.presets}
                selectedIds={selection.presets}
                onToggleItem={(itemId, checked) => toggleCategoryItem("presets", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "presets",
                    scanResult.presets.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("presets", [])}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return (
                    <span>
                      {item.isBuiltin
                        ? localizeUi("ui.modals.stbulkimportmodal.detectedBuiltInPreset")
                        : localizeUi("ui.modals.stbulkimportmodal.customOrUserPreset")}
                      {modifiedDetail(modified)}
                    </span>
                  );
                }}
                renderBadge={(item) =>
                  item.isBuiltin ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.5625rem] font-medium text-amber-400">
                      {localizeUi("ui.modals.stbulkimportmodal.builtIn")}
                    </span>
                  ) : null
                }
              />

              <SelectableImportCategory
                icon={<BookOpen size="0.875rem" />}
                label={localizeUi("navigation.topbar.lorebooks")}
                items={scanResult.lorebooks}
                selectedIds={selection.lorebooks}
                onToggleItem={(itemId, checked) => toggleCategoryItem("lorebooks", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "lorebooks",
                    scanResult.lorebooks.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("lorebooks", [])}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return modified ? (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.modified")} {modified}
                    </span>
                  ) : null;
                }}
              />

              <SelectableImportCategory
                icon={<Image size="0.875rem" />}
                label={localizeUi("settings.controls.backgroundGeneration.label")}
                items={scanResult.backgrounds}
                selectedIds={selection.backgrounds}
                onToggleItem={(itemId, checked) => toggleCategoryItem("backgrounds", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "backgrounds",
                    scanResult.backgrounds.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("backgrounds", [])}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  return modified ? (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.modified")} {modified}
                    </span>
                  ) : null;
                }}
              />

              <SelectableImportCategory
                icon={<UserCircle size="0.875rem" />}
                label={localizeUi("navigation.topbar.personas")}
                items={scanResult.personas}
                selectedIds={selection.personas}
                onToggleItem={(itemId, checked) => toggleCategoryItem("personas", itemId, checked)}
                onSelectAll={() =>
                  updateCategorySelection(
                    "personas",
                    scanResult.personas.map((item) => item.id),
                  )
                }
                onSelectNone={() => updateCategorySelection("personas", [])}
                renderDetails={(item) => {
                  const modified = formatModifiedAt(item.modifiedAt);
                  const description = item.description?.trim();
                  return (
                    <span>
                      {description || "No description"}
                      {modifiedDetail(modified)}
                    </span>
                  );
                }}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
                <XCircle size="0.875rem" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}

        {phase === "importing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 size="2rem" className="animate-spin text-[var(--primary)]" />
            <p className="text-sm font-medium">{localizeUi("ui.modals.stbulkimportmodal.importingYourData")}</p>
            {progress ? (
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--foreground)]">{progress.category}</span>
                  <span className="tabular-nums text-[var(--muted-foreground)]">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-200"
                    style={{ width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%` }}
                  />
                </div>
                <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{progress.item}</p>

                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {progress.imported.characters > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedCharacters", {
                        count: progress.imported.characters,
                      })}
                    </span>
                  )}
                  {progress.imported.chats > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedChats", {
                        count: progress.imported.chats,
                      })}
                    </span>
                  )}
                  {progress.imported.groupChats > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedGroupChats", {
                        count: progress.imported.groupChats,
                      })}
                    </span>
                  )}
                  {progress.imported.presets > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedPresets", {
                        count: progress.imported.presets,
                      })}
                    </span>
                  )}
                  {progress.imported.lorebooks > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedLorebooks", {
                        count: progress.imported.lorebooks,
                      })}
                    </span>
                  )}
                  {progress.imported.backgrounds > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedBackgrounds", {
                        count: progress.imported.backgrounds,
                      })}
                    </span>
                  )}
                  {progress.imported.personas > 0 && (
                    <span>
                      {localizeUi("ui.modals.stbulkimportmodal.importedPersonas", {
                        count: progress.imported.personas,
                      })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.modals.stbulkimportmodal.preparing")}
              </p>
            )}
          </div>
        )}

        {phase === "done" && importResult && (
          <>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 text-xs",
                importResult.success
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-[var(--destructive)]/10 text-[var(--destructive)]",
              )}
            >
              {importResult.success ? <CheckCircle size="0.875rem" /> : <XCircle size="0.875rem" />}
              <span className="font-medium">
                {importResult.success
                  ? localizeUi("ui.modals.stbulkimportmodal.importComplete")
                  : (importResult.error ?? "Import failed")}
              </span>
            </div>

            {importResult.success && (
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={<Users size="0.875rem" />}
                  label={localizeUi("navigation.topbar.characters")}
                  count={importResult.imported.characters}
                />
                <StatCard
                  icon={<MessageSquare size="0.875rem" />}
                  label={localizeUi("navigation.common.chats")}
                  count={importResult.imported.chats}
                />
                <StatCard
                  icon={<Users size="0.875rem" />}
                  label={localizeUi("ui.modals.stbulkimportmodal.groupChats")}
                  count={importResult.imported.groupChats}
                />
                <StatCard
                  icon={<FileText size="0.875rem" />}
                  label={localizeUi("navigation.topbar.presets")}
                  count={importResult.imported.presets}
                />
                <StatCard
                  icon={<BookOpen size="0.875rem" />}
                  label={localizeUi("navigation.topbar.lorebooks")}
                  count={importResult.imported.lorebooks}
                />
                <StatCard
                  icon={<Image size="0.875rem" />}
                  label={localizeUi("settings.controls.backgroundGeneration.label")}
                  count={importResult.imported.backgrounds}
                />
                <StatCard
                  icon={<UserCircle size="0.875rem" />}
                  label={localizeUi("navigation.topbar.personas")}
                  count={importResult.imported.personas}
                />
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-amber-500/10 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <AlertTriangle size="0.75rem" />
                  {localizeUi("ui.modals.stbulkimportmodal.importWarnings", {
                    count: importResult.errors.length,
                  })}
                </div>
                <div className="max-h-24 overflow-y-auto text-[0.625rem] text-[var(--muted-foreground)]">
                  {importResult.errors.map((warning, index) => (
                    <div key={`${warning}-${index}`} className="py-0.5">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function SelectableImportCategory<T extends ScanItemBase>({
  icon,
  label,
  items,
  selectedIds,
  onToggleItem,
  onSelectAll,
  onSelectNone,
  getItemLabel,
  renderDetails,
  renderBadge,
}: {
  icon: React.ReactNode;
  label: string;
  items: T[];
  selectedIds: string[];
  onToggleItem: (itemId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  getItemLabel?: (item: T) => string;
  renderDetails?: (item: T) => React.ReactNode;
  renderBadge?: (item: T) => React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [expanded, setExpanded] = useState(items.length <= 8 && items.length > 0);
  const selectedSet = new Set(selectedIds);

  return (
    <div className="rounded-lg border border-[var(--border)]">
      <div className="flex items-center gap-2.5 p-2.5">
        <span className={cn("shrink-0 text-[var(--muted-foreground)]", items.length === 0 && "opacity-40")}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">
              {label}{" "}
              <span className={cn("text-[var(--muted-foreground)]", items.length === 0 && "opacity-40")}>
                ({selectedIds.length}/{items.length})
              </span>
            </span>
          </div>
        </div>
        {items.length > 0 && (
          <>
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-md px-2 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)]"
            >
              {localizeUi("ui.noodle.stageprofilesourcepicker.all")}
            </button>
            <button
              type="button"
              onClick={onSelectNone}
              className="rounded-md px-2 py-1 text-[0.625rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {localizeUi("ui.game.gamesurfacecomponent.none")}
            </button>
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="rounded-md px-2 py-1 text-[0.625rem] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--accent)]"
            >
              {expanded
                ? localizeUi("ui.noodle.stageprofileview.hide")
                : localizeUi("ui.modals.selectableimportcategory.show")}
            </button>
          </>
        )}
      </div>

      {expanded && items.length > 0 && (
        <div className="max-h-60 space-y-1 overflow-y-auto border-t border-[var(--border)] px-2.5 py-2">
          {items.map((item) => {
            const checked = selectedSet.has(item.id);
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--secondary)]/70",
                  checked && "bg-[var(--primary)]/6",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium">
                      {getItemLabel ? getItemLabel(item) : item.name}
                    </span>
                    {renderBadge?.(item)}
                    {checked && (
                      <span className="shrink-0 rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--primary)]">
                        <span className="inline-flex items-center gap-1">
                          <Check size="0.5625rem" />
                          {localizeUi("ui.modals.selectableimportcategory.selected")}
                        </span>
                      </span>
                    )}
                  </div>
                  {renderDetails && (
                    <div className="truncate text-[0.625rem] text-[var(--muted-foreground)]">{renderDetails(item)}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-2.5">
      <span className="text-[var(--primary)]">{icon}</span>
      <div className="flex flex-col">
        <span className="text-sm font-bold">{count}</span>
        <span className="text-[0.625rem] text-[var(--muted-foreground)]">{label}</span>
      </div>
    </div>
  );
}
