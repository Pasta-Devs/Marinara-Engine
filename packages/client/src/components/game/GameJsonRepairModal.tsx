import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Braces, CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api, type JsonRepairRequest } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

type GameJsonRepairModalProps = {
  request: JsonRepairRequest | null;
  onClose: () => void;
  onApplied: (result: unknown, request: JsonRepairRequest) => void;
};

function extractJsonCandidate(raw: string): string {
  let cleaned = raw
    .trim()
    .replace(/^```(?:json|markdown)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  return cleaned.trim();
}

function validateJson(raw: string): { valid: true; parsed: unknown } | { valid: false; error: string } {
  try {
    return { valid: true, parsed: JSON.parse(extractJsonCandidate(raw)) };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

export function GameJsonRepairModal({ request, onClose, onApplied }: GameJsonRepairModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const [draft, setDraft] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const lineNumbersRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setDraft(request?.rawJson ?? "");
    setServerError(null);
    setIsApplying(false);
  }, [request]);

  const validation = useMemo(() => validateJson(draft), [draft]);
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: Math.max(1, draft.split(/\r\n|\r|\n/).length) }, (_, index) => String(index + 1)).join("\n"),
    [draft],
  );

  const handleFormat = () => {
    const next = validateJson(draft);
    if (!next.valid) {
      toast.error(localizeUi("ui.game.gamejsonrepairmodal.jsonIsStillInvalidSoICannotFormatIt"));
      return;
    }
    setDraft(JSON.stringify(next.parsed, null, 2));
  };

  const handleApply = async () => {
    if (!request || !validation.valid || isApplying) return;
    setIsApplying(true);
    setServerError(null);
    try {
      const result = await api.post(request.applyEndpoint, {
        ...(request.applyBody ?? {}),
        rawJson: draft,
      });
      toast.success(localizeUi("ui.game.gamejsonrepairmodal.repairedJsonApplied"));
      onApplied(result, request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply repaired JSON.";
      setServerError(message);
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      open={!!request}
      onClose={isApplying ? () => {} : onClose}
      title={request?.title ?? "Repair JSON"}
      width="max-w-5xl"
    >
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--foreground)]/75">
            <Braces size="1rem" />
          </div>
          <div className="min-w-0 text-sm text-[var(--muted-foreground)]">
            {localizeUi("ui.game.gamejsonrepairmodal.theModelReturnedJsonThatMarinaraCouldNotApply")}
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            validation.valid
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]",
          )}
        >
          {validation.valid ? <CheckCircle2 size="0.95rem" /> : <AlertTriangle size="0.95rem" />}
          <span>{validation.valid ? localizeUi("ui.game.gamejsonrepairmodal.jsonIsValid") : validation.error}</span>
        </div>

        {serverError && (
          <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
            {serverError}
          </div>
        )}

        <div className="grid min-h-[45vh] grid-cols-[3.25rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] focus-within:border-[var(--primary)] max-md:min-h-[52vh]">
          <pre
            ref={lineNumbersRef}
            aria-hidden="true"
            className="select-none overflow-hidden border-r border-[var(--border)] bg-[var(--secondary)]/50 px-2 py-2 text-right font-mono text-xs leading-relaxed text-[var(--muted-foreground)]/70"
          >
            {lineNumbers}
          </pre>
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setServerError(null);
            }}
            onScroll={(event) => {
              if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            className="min-h-[45vh] w-full resize-y border-0 bg-transparent px-3 py-2 font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] max-md:min-h-[52vh]"
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            onClick={handleFormat}
            disabled={!validation.valid || isApplying}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size="0.95rem" />
            {localizeUi("ui.game.gamejsonrepairmodal.format")}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!validation.valid || isApplying}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? <Loader2 size="0.95rem" className="animate-spin" /> : <CheckCircle2 size="0.95rem" />}
            {localizeUi("ui.game.gamejsonrepairmodal.applyRepairedJson")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
