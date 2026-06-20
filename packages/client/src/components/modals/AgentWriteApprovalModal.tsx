// ──────────────────────────────────────────────
// Modal: Confirm agent-proposed lorebook and summary writes
// ──────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Check, FilePenLine, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/Modal";
import { useAgentStore } from "../../stores/agent.store";
import { api } from "../../lib/api-client";
import { chatKeys } from "../../hooks/use-chats";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useGenerate } from "../../hooks/use-generate";

interface Props {
  open: boolean;
  onClose: () => void;
}

type BusyAction = "accept" | "regenerate" | null;

function describeKind(kind: string) {
  if (kind === "lorebook_update") return "Lorebook";
  if (kind === "summary_update") return "Summary";
  return "Agent Write";
}

export function AgentWriteApprovalModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { retryAgents } = useGenerate();
  const pending = useAgentStore((s) => s.pendingAgentWriteApprovals);
  const dismissPendingAgentWriteApproval = useAgentStore((s) => s.dismissPendingAgentWriteApproval);
  const entry = pending[0] ?? null;
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  useEffect(() => {
    setDraft(entry?.text ?? "");
    setError(null);
    setBusyAction(null);
  }, [entry?.id, entry?.text]);

  const queueNote = pending.length > 1 ? ` (${pending.length - 1} more queued)` : "";
  const kindLabel = describeKind(entry?.kind ?? "");
  const canRegenerate = !!entry?.canRegenerate && !!entry.agentType;
  const placeholder = useMemo(
    () =>
      entry?.kind === "lorebook_update"
        ? "### Entry name\nKeys: key, alias\nTag: optional\n\nLorebook content..."
        : "Summary text...",
    [entry?.kind],
  );

  if (!entry) return null;

  const closeAndAdvance = () => {
    dismissPendingAgentWriteApproval(entry.id);
    setError(null);
    if (pending.length <= 1) {
      onClose();
    }
  };

  const refreshAffectedData = () => {
    qc.invalidateQueries({ queryKey: chatKeys.detail(entry.chatId) });
    qc.invalidateQueries({ queryKey: chatKeys.list() });
    if (entry.kind === "lorebook_update") {
      qc.invalidateQueries({ queryKey: lorebookKeys.all });
      qc.invalidateQueries({ queryKey: lorebookKeys.active(entry.chatId) });
    }
  };

  const handleAccept = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusyAction("accept");
    setError(null);
    try {
      await api.post(`/chats/${entry.chatId}/agent-write-approval/commit`, {
        kind: entry.kind,
        text,
        payload: entry.payload ?? {},
        agentName: entry.agentName,
        agentType: entry.agentType,
      });
      refreshAffectedData();
      toast.success(`${kindLabel} update committed`);
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not commit ${kindLabel.toLowerCase()} update`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegenerate = async () => {
    if (!entry.agentType) {
      toast.warning("This proposal cannot be regenerated automatically.");
      return;
    }
    setBusyAction("regenerate");
    setError(null);
    try {
      const didRegenerate = await retryAgents(entry.chatId, [entry.agentType]);
      if (!didRegenerate) {
        setError("Could not regenerate proposal");
        return;
      }
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate proposal");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Modal open={open} onClose={closeAndAdvance} title={`Review ${kindLabel} Update`} width="max-w-2xl">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/12 text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
            <FilePenLine size="1.25rem" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.title || `${entry.agentName} proposed a change`}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {entry.agentName} wants to commit a {kindLabel.toLowerCase()} update{queueNote}.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.625rem] font-semibold uppercase text-[var(--muted-foreground)]">Proposed Text</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            className="min-h-[18rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/55 focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </label>

        {entry.kind === "lorebook_update" && (
          <p className="rounded-lg bg-[var(--background)]/70 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            Keep each lorebook entry under a <span className="font-mono">###</span> heading. You can edit names, keys,
            tags, and content before approving.
          </p>
        )}

        {error && (
          <div className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={closeAndAdvance}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <Trash2 size="0.75rem" />
            Discard
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canRegenerate || busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            title={canRegenerate ? "Regenerate this proposal" : "This proposal cannot be regenerated automatically"}
          >
            {busyAction === "regenerate" ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <RefreshCw size="0.75rem" />
            )}
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={busyAction !== null || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busyAction === "accept" ? <Loader2 size="0.75rem" className="animate-spin" /> : <Check size="0.75rem" />}
            Accept
          </button>
        </div>
      </div>
    </Modal>
  );
}
