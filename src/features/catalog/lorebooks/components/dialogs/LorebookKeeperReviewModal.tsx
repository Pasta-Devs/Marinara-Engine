import { useState } from "react";
import { AlertCircle, BookOpen, Check, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "../../../../../shared/components/ui/Modal";
import { useAgentStore } from "../../../../../shared/stores/agent.store";
import { applyLorebookKeeperUpdate } from "../../lib/lorebook-keeper-updates";
import { lorebookKeys } from "../../query-keys";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LorebookKeeperReviewModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const pending = useAgentStore((s) => s.pendingLorebookUpdates);
  const dismissPendingLorebookUpdate = useAgentStore((s) => s.dismissPendingLorebookUpdate);
  const entry = pending[0] ?? null;
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  if (!entry) return null;

  const closeAndAdvance = () => {
    dismissPendingLorebookUpdate(entry.id);
    setError(null);
    if (pending.length <= 1) onClose();
  };

  const handleApprove = async () => {
    setApplying(true);
    setError(null);
    try {
      await applyLorebookKeeperUpdate(entry);
      await queryClient.invalidateQueries({ queryKey: lorebookKeys.entries(entry.lorebookId) });
      await queryClient.invalidateQueries({ queryKey: lorebookKeys.active() });
      toast.success(`Lorebook Keeper ${entry.action === "create" ? "created" : "updated"} "${entry.entryName}".`);
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply lorebook update.");
    } finally {
      setApplying(false);
    }
  };

  const queueNote = pending.length > 1 ? ` (${pending.length - 1} more queued)` : "";
  const facts = entry.newFacts.length > 0 ? entry.newFacts : entry.content ? [entry.content] : [];

  return (
    <Modal open={open} onClose={closeAndAdvance} title="Review Lorebook Keeper Update" width="max-w-2xl">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 ring-1 ring-amber-400/25">
            <BookOpen size="1.375rem" className="text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.entryName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {entry.agentName} proposed a {entry.action} in {entry.lorebookName}
              {queueNote}
            </p>
          </div>
        </div>

        {entry.reason && (
          <p className="rounded-lg bg-[var(--secondary)] p-2.5 text-xs italic text-[var(--muted-foreground)]">
            {entry.reason}
          </p>
        )}

        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
          <div className="rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)]">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Proposed facts
            </span>
            {facts.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--foreground)]">
                {facts.map((fact, index) => (
                  <li key={`${fact}-${index}`} className="whitespace-pre-wrap">
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">No text content was proposed.</p>
            )}
          </div>

          {entry.keys.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.keys.map((key) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--secondary)] px-2 py-0.5 text-[0.625rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)]"
                >
                  {key}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--destructive)]/10 p-2.5 text-xs text-[var(--destructive)]">
            <AlertCircle size="0.75rem" className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={closeAndAdvance}
            disabled={applying}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <X size="0.75rem" />
            Reject
          </button>
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={applying}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {applying ? <Loader2 size="0.75rem" className="animate-spin" /> : <Check size="0.75rem" />}
            Approve
          </button>
        </div>
      </div>
    </Modal>
  );
}
