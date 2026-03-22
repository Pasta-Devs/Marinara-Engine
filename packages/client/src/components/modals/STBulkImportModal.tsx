// ──────────────────────────────────────────────
// Modal: SillyTavern Bulk Import
// ──────────────────────────────────────────────
import { useState, useCallback } from "react";
import { Modal } from "../ui/Modal";
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
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ScanResult {
  success: boolean;
  error?: string;
  dataDir?: string;
  characters: { path: string; name: string; format: string }[];
  chats: { path: string; characterName: string; folderName: string }[];
  groupChats: { path: string; groupName: string; members: string[] }[];
  presets: { path: string; name: string }[];
  lorebooks: { path: string; name: string }[];
  backgrounds: { path: string; name: string }[];
  personas: { path: string; name: string }[];
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

export function STBulkImportModal({ open, onClose }: Props) {
  const [folderPath, setFolderPath] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState("");
  const [options, setOptions] = useState({
    characters: true,
    chats: true,
    groupChats: true,
    presets: true,
    lorebooks: true,
    backgrounds: true,
    personas: true,
  });
  const qc = useQueryClient();

  const reset = useCallback(() => {
    setPhase("input");
    setScanResult(null);
    setImportResult(null);
    setProgress(null);
    setError("");
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
      const res = await fetch("/api/import/st-bulk/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath: folderPath.trim() }),
      });
      const data = (await res.json()) as ScanResult;
      if (data.success) {
        setScanResult(data);
        setPhase("preview");
      } else {
        setError(data.error ?? "Scan failed");
        setPhase("input");
      }
    } catch {
      setError("Failed to connect to server");
      setPhase("input");
    }
  }, [folderPath]);

  const [picking, setPicking] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState("");
  const [browserFolders, setBrowserFolders] = useState<string[]>([]);
  const [browserLoading, setBrowserLoading] = useState(false);

  const loadDirectory = useCallback(async (dirPath?: string) => {
    setBrowserLoading(true);
    try {
      const res = await fetch("/api/import/list-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath || "" }),
      });
      const data = (await res.json()) as { success: boolean; path?: string; folders?: string[] };
      if (data.success && data.path) {
        setBrowserPath(data.path);
        setBrowserFolders(data.folders ?? []);
      }
    } catch {
      // silent
    }
    setBrowserLoading(false);
  }, []);

  const handleBrowse = useCallback(async () => {
    setPicking(true);
    setError("");
    try {
      const res = await fetch("/api/import/pick-folder", { method: "POST" });
      const data = (await res.json()) as { success: boolean; path?: string; error?: string };
      if (data.success && data.path) {
        setFolderPath(data.path);
        setPicking(false);
        return;
      }
    } catch {
      // native picker failed
    }
    setPicking(false);
    // Native picker didn't return a path — fall back to directory browser
    setShowFolderBrowser(true);
    loadDirectory(folderPath || undefined);
  }, [folderPath, loadDirectory]);

  const handleImport = useCallback(async () => {
    if (!folderPath.trim()) return;
    setPhase("importing");
    setProgress(null);

    try {
      const res = await fetch("/api/import/st-bulk/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath: folderPath.trim(), options }),
      });

      if (!res.ok || !res.body) {
        setError("Import failed — server error");
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

        // Parse SSE events from the buffer
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
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
            // skip malformed events
          }
        }
      }

      // If we exited the loop without a "done" event, the phase may still be "importing"
      // — this is fine, the SSE stream just ended cleanly after the done event was processed
    } catch {
      setError("Import failed — server error");
      setPhase("preview");
    }
  }, [folderPath, options, qc]);

  return (
    <Modal open={open} onClose={handleClose} title="Import from SillyTavern" width="max-w-lg">
      <div className="flex flex-col gap-4">
        {/* ── Phase: Input ── */}
        {(phase === "input" || phase === "scanning") && (
          <>
            <p className="text-xs text-[var(--muted-foreground)]">
              Select or enter the path to your SillyTavern installation folder. We'll scan for characters, chats,
              presets, lorebooks, and backgrounds to import.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">SillyTavern Folder Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder="/path/to/SillyTavern"
                  disabled={phase === "scanning"}
                  className="flex-1 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent placeholder:text-[var(--muted-foreground)]/50 focus:ring-[var(--primary)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScan();
                  }}
                />
                <button
                  onClick={handleBrowse}
                  disabled={phase === "scanning" || picking}
                  className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition-all hover:bg-[var(--secondary)] active:scale-95 disabled:opacity-50"
                  title="Browse for folder"
                >
                  {picking ? <Loader2 size="0.875rem" className="animate-spin" /> : <FolderOpen size="0.875rem" />}
                  Browse
                </button>
              </div>
            </div>

            {/* ── Inline Folder Browser ── */}
            {showFolderBrowser && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50">
                <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
                  <button
                    onClick={() => {
                      const parent = browserPath.replace(/\/[^/]+$/, "") || "/";
                      if (parent !== browserPath) loadDirectory(parent);
                    }}
                    disabled={browserLoading || browserPath === "/"}
                    className="rounded p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
                    title="Go up"
                  >
                    <ArrowLeft size="0.75rem" />
                  </button>
                  <span className="flex-1 truncate text-[0.625rem] font-mono text-[var(--muted-foreground)]">
                    {browserPath || "/"}
                  </span>
                  <button
                    onClick={() => {
                      setFolderPath(browserPath);
                      setShowFolderBrowser(false);
                    }}
                    className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-[0.625rem] font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 active:scale-95"
                  >
                    Select This Folder
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto p-1">
                  {browserLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size="0.875rem" className="animate-spin text-[var(--muted-foreground)]" />
                    </div>
                  ) : browserFolders.length === 0 ? (
                    <p className="py-3 text-center text-[0.625rem] text-[var(--muted-foreground)]">No subfolders</p>
                  ) : (
                    browserFolders.map((name) => (
                      <button
                        key={name}
                        onClick={() => loadDirectory(`${browserPath}/${name}`)}
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

            <button
              onClick={handleScan}
              disabled={!folderPath.trim() || phase === "scanning"}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-medium transition-all",
                folderPath.trim() && phase !== "scanning"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-95"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed",
              )}
            >
              {phase === "scanning" ? (
                <Loader2 size="0.875rem" className="animate-spin" />
              ) : (
                <FolderSearch size="0.875rem" />
              )}
              {phase === "scanning" ? "Scanning…" : "Scan Folder"}
            </button>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
                <XCircle size="0.875rem" className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
              <strong>Tip:</strong> This is the main SillyTavern folder (the one containing{" "}
              <code className="rounded bg-[var(--secondary)] px-1">data/</code> or{" "}
              <code className="rounded bg-[var(--secondary)] px-1">public/</code>). On most setups it's named{" "}
              <code className="rounded bg-[var(--secondary)] px-1">SillyTavern</code>.
            </div>
          </>
        )}

        {/* ── Phase: Preview ── */}
        {phase === "preview" && scanResult && (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
              <CheckCircle size="0.875rem" />
              <span>
                Found ST data in{" "}
                <code className="rounded bg-[var(--secondary)] px-1 text-[0.625rem]">{scanResult.dataDir}</code>
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium">Select what to import:</span>

              <ImportCategory
                icon={<Users size="0.875rem" />}
                label="Characters"
                count={scanResult.characters.length}
                items={scanResult.characters.map((c) => c.name)}
                checked={options.characters}
                onChange={(v) => setOptions((o) => ({ ...o, characters: v }))}
              />

              <ImportCategory
                icon={<MessageSquare size="0.875rem" />}
                label="Chats"
                count={scanResult.chats.length}
                items={scanResult.chats.map((c) => c.characterName)}
                checked={options.chats}
                onChange={(v) => setOptions((o) => ({ ...o, chats: v }))}
              />

              <ImportCategory
                icon={<Users size="0.875rem" />}
                label="Group Chats"
                count={scanResult.groupChats?.length ?? 0}
                items={(scanResult.groupChats ?? []).map((g) => `${g.groupName} (${g.members.join(", ")})`)}
                checked={options.groupChats}
                onChange={(v) => setOptions((o) => ({ ...o, groupChats: v }))}
              />

              <ImportCategory
                icon={<FileText size="0.875rem" />}
                label="Presets"
                count={scanResult.presets.length}
                items={scanResult.presets.map((p) => p.name)}
                checked={options.presets}
                onChange={(v) => setOptions((o) => ({ ...o, presets: v }))}
              />

              <ImportCategory
                icon={<BookOpen size="0.875rem" />}
                label="Lorebooks"
                count={scanResult.lorebooks.length}
                items={scanResult.lorebooks.map((l) => l.name)}
                checked={options.lorebooks}
                onChange={(v) => setOptions((o) => ({ ...o, lorebooks: v }))}
              />

              <ImportCategory
                icon={<Image size="0.875rem" />}
                label="Backgrounds"
                count={scanResult.backgrounds.length}
                items={scanResult.backgrounds.map((b) => b.name)}
                checked={options.backgrounds}
                onChange={(v) => setOptions((o) => ({ ...o, backgrounds: v }))}
              />

              <ImportCategory
                icon={<UserCircle size="0.875rem" />}
                label="Personas"
                count={scanResult.personas?.length ?? 0}
                items={(scanResult.personas ?? []).map((p) => p.name)}
                checked={options.personas}
                onChange={(v) => setOptions((o) => ({ ...o, personas: v }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition-all hover:bg-[var(--secondary)] active:scale-95"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={
                  !options.characters &&
                  !options.chats &&
                  !options.groupChats &&
                  !options.presets &&
                  !options.lorebooks &&
                  !options.backgrounds &&
                  !options.personas
                }
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-95",
                  "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
                )}
              >
                <Import size="0.875rem" />
                Import Selected
              </button>
            </div>
          </>
        )}

        {/* ── Phase: Importing ── */}
        {phase === "importing" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 size="2rem" className="animate-spin text-[var(--primary)]" />
            <p className="text-sm font-medium">Importing your data…</p>
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
                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                  />
                </div>
                <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{progress.item}</p>

                {/* Running totals */}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.625rem] text-[var(--muted-foreground)]">
                  {progress.imported.characters > 0 && <span>{progress.imported.characters} characters</span>}
                  {progress.imported.chats > 0 && <span>{progress.imported.chats} chats</span>}
                  {progress.imported.groupChats > 0 && <span>{progress.imported.groupChats} group chats</span>}
                  {progress.imported.presets > 0 && <span>{progress.imported.presets} presets</span>}
                  {progress.imported.lorebooks > 0 && <span>{progress.imported.lorebooks} lorebooks</span>}
                  {progress.imported.backgrounds > 0 && <span>{progress.imported.backgrounds} backgrounds</span>}
                  {progress.imported.personas > 0 && <span>{progress.imported.personas} personas</span>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">Preparing…</p>
            )}
          </div>
        )}

        {/* ── Phase: Done ── */}
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
                {importResult.success ? "Import complete!" : (importResult.error ?? "Import failed")}
              </span>
            </div>

            {importResult.success && (
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  icon={<Users size="0.875rem" />}
                  label="Characters"
                  count={importResult.imported.characters}
                />
                <StatCard icon={<MessageSquare size="0.875rem" />} label="Chats" count={importResult.imported.chats} />
                <StatCard
                  icon={<Users size="0.875rem" />}
                  label="Group Chats"
                  count={importResult.imported.groupChats ?? 0}
                />
                <StatCard icon={<FileText size="0.875rem" />} label="Presets" count={importResult.imported.presets} />
                <StatCard
                  icon={<BookOpen size="0.875rem" />}
                  label="Lorebooks"
                  count={importResult.imported.lorebooks}
                />
                <StatCard
                  icon={<Image size="0.875rem" />}
                  label="Backgrounds"
                  count={importResult.imported.backgrounds}
                />
                <StatCard
                  icon={<UserCircle size="0.875rem" />}
                  label="Personas"
                  count={importResult.imported.personas ?? 0}
                />
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-amber-500/10 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                  <AlertTriangle size="0.75rem" />
                  {importResult.errors.length} warning{importResult.errors.length !== 1 ? "s" : ""}
                </div>
                <div className="max-h-24 overflow-y-auto text-[0.625rem] text-[var(--muted-foreground)]">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="py-0.5">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 active:scale-95"
            >
              Done
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Sub-components ───

function ImportCategory({
  icon,
  label,
  count,
  items,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: string[];
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = items.slice(0, 20);
  const remaining = items.length - displayItems.length;

  return (
    <div className="rounded-lg border border-[var(--border)] transition-colors">
      <label className="flex cursor-pointer items-center gap-2.5 p-2.5">
        <input
          type="checkbox"
          checked={checked && count > 0}
          disabled={count === 0}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--primary)]"
        />
        <span className={cn("text-[var(--muted-foreground)]", count === 0 && "opacity-40")}>{icon}</span>
        <span className="flex-1 text-xs font-medium">
          {label} <span className={cn("text-[var(--muted-foreground)]", count === 0 && "opacity-40")}>({count})</span>
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setExpanded(!expanded);
            }}
            className="text-[0.625rem] text-[var(--primary)] hover:underline"
          >
            {expanded ? "Hide" : "Show"}
          </button>
        )}
      </label>
      {expanded && count > 0 && (
        <div className="border-t border-[var(--border)] px-2.5 py-2 max-h-28 overflow-y-auto">
          {displayItems.map((name, i) => (
            <div key={i} className="truncate py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
              {name}
            </div>
          ))}
          {remaining > 0 && (
            <div className="py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
              … and {remaining} more
            </div>
          )}
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
