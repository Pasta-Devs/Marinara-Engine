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
import { useCreateCharacter } from "../../hooks/use-characters";
import { lorebookKeys } from "../../hooks/use-lorebooks";
import { useGenerate } from "../../hooks/use-generate";
import { useTranslation as useUiTranslation } from "react-i18next";
import { characterDataSchema } from "@marinara-engine/shared";

interface Props {
  open: boolean;
  onClose: () => void;
}

type BusyAction = "accept" | "regenerate" | null;

export function AgentWriteApprovalModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const { retryAgents } = useGenerate();
  const createCharacter = useCreateCharacter();
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

  const queueNote =
    pending.length > 1 ? localizeUi("ui.modals.agentwriteapprovalmodal.moreQueued", { count: pending.length - 1 }) : "";
  const kindLabel =
    entry?.kind === "character_card_create"
      ? localizeUi("ui.modals.agentwriteapprovalmodal.characterCard")
      : entry?.kind === "lorebook_update"
        ? localizeUi("ui.modals.agentwriteapprovalmodal.lorebook")
        : entry?.kind === "summary_update"
          ? localizeUi("ui.modals.agentwriteapprovalmodal.summary")
          : localizeUi("ui.modals.agentwriteapprovalmodal.agentWrite");
  const canRegenerate = !!entry?.canRegenerate && !!entry.agentType;
  const placeholder = useMemo(
    () =>
      entry?.kind === "lorebook_update"
        ? "### Entry name\nKeys: key, alias\nTag: optional\n\nLorebook content..."
        : entry?.kind === "character_card_create"
          ? localizeUi("ui.modals.agentwriteapprovalmodal.characterCardJsonPlaceholder")
          : "Summary text...",
    [entry?.kind, localizeUi],
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
      if (entry.kind === "character_card_create") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text) as unknown;
        } catch {
          throw new Error(localizeUi("ui.modals.agentwriteapprovalmodal.invalidCharacterCard"));
        }
        const source =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>).data
            : null;
        const validated = characterDataSchema.safeParse(source);
        if (!validated.success) {
          throw new Error(localizeUi("ui.modals.agentwriteapprovalmodal.invalidCharacterCard"));
        }
        await createCharacter.mutateAsync({ data: validated.data });
        toast.success(localizeUi("ui.modals.agentwriteapprovalmodal.characterCardCreated"));
        closeAndAdvance();
        return;
      }
      await api.post(`/chats/${entry.chatId}/agent-write-approval/commit`, {
        kind: entry.kind,
        text,
        payload: entry.payload ?? {},
        agentName: entry.agentName,
        agentType: entry.agentType,
      });
      refreshAffectedData();
      toast.success(localizeUi("ui.modals.agentwriteapprovalmodal.value1UpdateCommitted", { value1: kindLabel }));
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not commit ${kindLabel.toLowerCase()} update`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegenerate = async () => {
    if (!entry.agentType) {
      toast.warning(
        localizeUi("ui.modals.agentwriteapprovalmodal.thisProposalCannotBeRegeneratedAutomatically_1793348"),
      );
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
    <Modal
      open={open}
      onClose={closeAndAdvance}
      title={
        entry.kind === "character_card_create"
          ? localizeUi("ui.modals.agentwriteapprovalmodal.reviewCharacterCard")
          : localizeUi("ui.modals.agentwriteapprovalmodal.reviewValue1Update", { value1: kindLabel })
      }
      width="max-w-2xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/12 text-[var(--primary)] ring-1 ring-[var(--primary)]/25">
            <FilePenLine size="1.25rem" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {entry.title ||
                localizeUi("ui.modals.agentwriteapprovalmodal.agentProposedChange", {
                  agentName: entry.agentName,
                })}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {entry.kind === "character_card_create"
                ? localizeUi("ui.modals.agentwriteapprovalmodal.agentWantsToCreateCharacterCard", {
                    agentName: entry.agentName,
                  })
                : localizeUi("ui.modals.agentwriteapprovalmodal.agentWantsToCommitUpdate", {
                    agentName: entry.agentName,
                    kind: kindLabel.toLowerCase(),
                  })}
              {queueNote}.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.625rem] font-semibold uppercase text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.agentwriteapprovalmodal.proposedText")}
          </span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            className="min-h-[18rem] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/55 focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
          />
        </label>

        {entry.kind === "lorebook_update" && (
          <p className="rounded-lg bg-[var(--background)]/70 px-3 py-2 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
            {localizeUi("ui.modals.agentwriteapprovalmodal.keepEachLorebookEntryUnderA")}{" "}
            <span className="font-mono">###</span>{" "}
            {localizeUi("ui.modals.agentwriteapprovalmodal.headingYouCanEditNamesKeysTagsAndContent")}
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
            {localizeUi("ui.agents.agenteditor.discard")}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canRegenerate || busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            title={
              canRegenerate
                ? localizeUi("ui.modals.agentwriteapprovalmodal.regenerateThisProposal")
                : localizeUi("ui.modals.agentwriteapprovalmodal.thisProposalCannotBeRegeneratedAutomatically")
            }
          >
            {busyAction === "regenerate" ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <RefreshCw size="0.75rem" />
            )}
            {localizeUi("ui.agents.secretplotpanel.regenerate")}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={busyAction !== null || !draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busyAction === "accept" ? <Loader2 size="0.75rem" className="animate-spin" /> : <Check size="0.75rem" />}
            {localizeUi("ui.modals.agentwriteapprovalmodal.accept")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
