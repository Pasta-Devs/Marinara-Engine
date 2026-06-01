import { CheckCircle, Loader2, XCircle } from "lucide-react";
import type { ImportResultRow } from "../lib/character-import-model";

type CharacterImportStatusPanelProps = {
  status: "idle" | "loading" | "done";
  results: ImportResultRow[];
};

export function CharacterImportStatusPanel({ status, results }: CharacterImportStatusPanelProps) {
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-3 text-xs">
        <Loader2 size="0.875rem" className="animate-spin text-[var(--primary)]" />
        Importing files...
      </div>
    );
  }

  if (status !== "done" || results.length === 0) return null;

  const succeeded = results.filter((result) => result.success).length;
  const failed = results.length - succeeded;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
          succeeded > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--destructive)]/10 text-[var(--destructive)]"
        }`}
      >
        {succeeded > 0 ? <CheckCircle size="0.875rem" /> : <XCircle size="0.875rem" />}
        {succeeded} succeeded, {failed} failed
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
  );
}
