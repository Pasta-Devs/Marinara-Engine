// ──────────────────────────────────────────────
// Modal: Import regex scripts (new layout)
//
// Regex scripts' Import used to open the file picker straight away, took one file, and told the result in a
// toast over the editor's Save. SillyTavern exports one file per script, so this window takes several files at
// once, like the other import windows, and lists what came in and what was left out, and why.
// ──────────────────────────────────────────────
import { useRef, useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { OvImportDrop } from "./ImportTagChecks";

export interface RegexImportFileResult {
  filename: string;
  imported: number;
  /** Scripts or files left out, each with its reason. */
  skipped: string[];
}

export function ImportRegexModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (files: File[]) => Promise<RegexImportFileResult[]>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RegexImportFileResult[] | null>(null);

  const close = () => {
    setResults(null);
    onClose();
  };

  const run = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    try {
      setResults(await onImport(files));
    } finally {
      setBusy(false);
    }
  };

  const imported = results?.reduce((sum, result) => sum + result.imported, 0) ?? 0;
  const filesWithScripts = results?.filter((result) => result.imported > 0).length ?? 0;

  return (
    <Modal open={open} onClose={close} title={localizeUi("ui.modals.importregex.title")}>
      <div className="flex flex-col gap-4" data-import-regex-modal="">
        <OvImportDrop
          types={localizeUi("ui.modals.importtags.typesJson")}
          dragOver={dragOver}
          setDragOver={setDragOver}
          onFiles={(files) => void run(files)}
          onBrowse={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void run(files);
          }}
        />
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Spinner size="sm" className="text-[var(--primary)]" />
            {localizeUi("ui.modals.importconnectionmodal.importing")}
          </div>
        ) : null}
        {results && !busy ? (
          <div className="flex flex-col gap-2" data-mari-part="regex-import-result">
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                imported > 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
              }`}
            >
              {imported > 0 ? <CheckCircle size="0.875rem" /> : <XCircle size="0.875rem" />}
              {imported > 0
                ? localizeUi("ui.modals.importregex.summary", {
                    count: imported,
                    files: localizeUi("ui.modals.importregex.files", { count: filesWithScripts }),
                  })
                : localizeUi("ui.modals.importregex.none")}
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-[var(--border)]">
              {results.map((result, index) => (
                <div
                  key={`${result.filename}-${index}`}
                  className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2 text-xs last:border-b-0"
                >
                  {result.imported > 0 ? (
                    <CheckCircle size="0.8125rem" className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size="0.8125rem" className="mt-0.5 shrink-0 text-[var(--destructive)]" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{result.filename}</div>
                    {result.imported > 0 ? (
                      <div className="text-[var(--muted-foreground)]">
                        {localizeUi("ui.modals.importregex.fileImported", { count: result.imported })}
                      </div>
                    ) : null}
                    {result.skipped.map((line, lineIndex) => (
                      <div key={`${lineIndex}-${line}`} className="text-[var(--muted-foreground)]">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex justify-end border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            {localizeUi("capabilities.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
