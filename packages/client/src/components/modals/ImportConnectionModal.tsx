// ──────────────────────────────────────────────
// Modal: Import Connections (JSON)
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { CheckCircle, Download, FileJson, Loader2, XCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useCreateConnection, useSaveConnectionDefaults } from "../../hooks/use-connections";
import { getConnectionImportEntries, normalizeImportedConnectionEntry } from "../../lib/connection-transfer";
import { api } from "../../lib/api-client";
import { useTranslation as useUiTranslation } from "react-i18next";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportConnectionModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const createConnection = useCreateConnection();
  const saveConnectionDefaults = useSaveConnectionDefaults();
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [results, setResults] = useState<Array<{ filename: string; success: boolean; message: string }>>([]);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setStatus("idle");
    setResults([]);
    setDragOver(false);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setStatus("loading");
    setResults([]);

    const nextResults: Array<{ filename: string; success: boolean; message: string }> = [];

    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const entries = getConnectionImportEntries(parsed);
        if (entries.length === 0) throw new Error("No connection data found");

        let imported = 0;
        let failed = 0;
        for (const entry of entries) {
          let createdConnectionId: string | null = null;
          try {
            const normalized = normalizeImportedConnectionEntry(entry);
            if (!normalized) {
              failed += 1;
              continue;
            }

            const result = await createConnection.mutateAsync(normalized.connection);
            const connectionId = (result as { id?: string } | null)?.id;
            createdConnectionId = connectionId ?? null;
            if (connectionId && normalized.hasDefaultParameters) {
              await saveConnectionDefaults.mutateAsync({
                id: connectionId,
                params: normalized.defaultParameters,
              });
            }
            imported += 1;
          } catch {
            if (createdConnectionId) {
              await api.delete(`/connections/${createdConnectionId}`).catch(() => undefined);
            }
            failed += 1;
          }
        }

        if (imported === 0) throw new Error("No supported connection entries found");
        nextResults.push({
          filename: file.name,
          success: true,
          message: `Imported ${imported} connection${imported === 1 ? "" : "s"} without API keys${
            failed > 0 ? ` (${failed} skipped)` : ""
          }`,
        });
      } catch (error) {
        nextResults.push({
          filename: file.name,
          success: false,
          message: error instanceof Error ? error.message : "Failed to import connections",
        });
      }
    }

    setResults(nextResults);
    setStatus("done");
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={localizeUi("ui.modals.importconnectionmodal.importConnections")}
    >
      <div className="flex flex-col gap-4">
        <div
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            dragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] hover:border-[var(--muted-foreground)] hover:bg-[var(--secondary)]/50"
          }`}
        >
          <Download size="2rem" className={dragOver ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"} />
          <div>
            <p className="text-sm font-medium">
              {localizeUi("ui.modals.importconnectionmodal.dropOneOrMoreConnectionFilesHereOrClick")}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.modals.importconnectionmodal.importedConnectionsNeverIncludeApiKeysAddEachKey")}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-[var(--secondary)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
            <FileJson size="0.75rem" /> {localizeUi("ui.modals.importcharactermodal.json")}
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
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
      </div>
    </Modal>
  );
}
