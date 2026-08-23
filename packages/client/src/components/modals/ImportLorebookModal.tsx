// ──────────────────────────────────────────────
// Modal: Import Lorebook (JSON)
// ──────────────────────────────────────────────
import { useState, useRef } from "react";
import { Modal } from "../ui/Modal";
import { Download, FileJson, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportLorebookModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<Array<{ filename: string; success: boolean; message: string }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const qc = useQueryClient();

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setStatus("loading");
    setResults([]);

    const nextResults: Array<{ filename: string; success: boolean; message: string }> = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as Record<string, unknown>;

        const isMarinaraLorebook = json.type === "marinara_lorebook" && json.version === 1;
        const endpoint = isMarinaraLorebook ? "/import/marinara" : "/import/st-lorebook";
        const payload = isMarinaraLorebook
          ? {
              ...json,
              timestampOverrides: {
                createdAt: file.lastModified,
                updatedAt: file.lastModified,
              },
            }
          : {
              ...json,
              __filename: file.name.replace(/\.json$/i, ""),
              timestampOverrides: {
                createdAt: file.lastModified,
                updatedAt: file.lastModified,
              },
            };

        const data = await api.post<{ success: boolean; error?: string }>(endpoint, payload);
        nextResults.push({
          filename: file.name,
          success: data.success,
          message: data.success ? "Imported lorebook" : (data.error ?? "Import failed"),
        });
      } catch (error) {
        nextResults.push({
          filename: file.name,
          success: false,
          message: error instanceof Error ? error.message : "Failed to parse file",
        });
      }
    }

    setResults(nextResults);
    setStatus("done");
    if (nextResults.some((result) => result.success)) {
      qc.invalidateQueries({ queryKey: ["lorebooks"] });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const reset = () => {
    setStatus("idle");
    setResults([]);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={localizeUi("ui.modals.importcharactermodal.importLorebook")}
    >
      <div className="flex flex-col gap-4">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all ${
            dragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Download size="2rem" className={dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} />
          <p className="text-sm font-medium">
            {localizeUi("ui.modals.importlorebookmodal.dropOneOrMoreLorebookFilesHereOrClick")}
          </p>
          <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
            <FileJson size="0.75rem" /> {localizeUi("ui.modals.importcharactermodal.json")}
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {status === "loading" && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs">
            <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />{" "}
            {localizeUi("ui.modals.importconnectionmodal.importing")}
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
              {results.filter((result) => result.success).length}{" "}
              {localizeUi("ui.modals.importcharactermodal.succeeded")}{" "}
              {results.filter((result) => !result.success).length} {localizeUi("ui.modals.importcharactermodal.failed")}
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

        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {localizeUi("capabilities.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
