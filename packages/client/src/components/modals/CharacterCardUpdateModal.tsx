// ──────────────────────────────────────────────
// Modal: Confirm character_card_update agent result
// ──────────────────────────────────────────────
//
// The Card Evolution Auditor post-processing agent proposes edits to a
// character card's fields (description, personality, etc.) based on what
// happened in the roleplay. Unlike the Lorebook Keeper, card edits require
// the user's explicit approval — this modal shows the old → new diff and
// asks the user to approve, edit, regenerate, or reject each batch.
import { useEffect, useMemo, useState } from "react";
import { Loader2, UserCog, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useAgentStore } from "../../stores/agent.store";
import { useCharacter, useUpdateCharacter } from "../../hooks/use-characters";
import { type CharacterCardFieldUpdate, type EditableCharacterCardField } from "@marinara-engine/shared";
import { useGenerate } from "../../hooks/use-generate";

function getCharacterCardFieldValue(data: Record<string, unknown>, field: EditableCharacterCardField): string | null {
  if (field === "backstory" || field === "appearance" || field === "aboutMe") {
    const extensions = data.extensions;
    const value =
      extensions && typeof extensions === "object" ? (extensions as Record<string, unknown>)[field] : undefined;
    if (typeof value === "string") return value;
    // aboutMe is optional and often absent; treat missing as empty so About Me
    // Keeper can populate a character's about-me from scratch. backstory/appearance
    // keep returning null when absent (they always carry a "" default in practice).
    return field === "aboutMe" ? "" : null;
  }

  const value = data[field];
  return typeof value === "string" ? value : null;
}

function setCharacterCardFieldValue(
  data: Record<string, unknown>,
  field: EditableCharacterCardField,
  value: string,
): Record<string, unknown> {
  if (field === "backstory" || field === "appearance" || field === "aboutMe") {
    const extensions =
      data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};

    return {
      ...data,
      extensions: {
        ...extensions,
        [field]: value,
      },
    };
  }

  return {
    ...data,
    [field]: value,
  };
}

function appendStaleCardReplacement(base: string, replacement: string): string {
  const trimmedReplacement = replacement.trim();
  if (!trimmedReplacement) return base;
  if (base.includes(trimmedReplacement)) return base;
  const separator = base.trim().length > 0 ? "\n\n" : "";
  return `${base.trimEnd()}${separator}${trimmedReplacement}`;
}

function bumpCharacterVersion(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "1.1";
  const match = raw.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return `${raw}.1`;
  const prefix = match[1] ?? "";
  const numberPart = match[2] ?? "0";
  const suffix = match[3] ?? "";
  const next = String(Number(numberPart) + 1).padStart(numberPart.length, "0");
  return `${prefix}${next}${suffix}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type BusyAction = "approve" | "regenerate" | null;
type CardUpdateState = {
  update: CharacterCardFieldUpdate;
  stale: boolean;
};

export function CharacterCardUpdateModal({ open, onClose }: Props) {
  const pending = useAgentStore((s) => s.pendingCardUpdates);
  const dismissPendingCardUpdate = useAgentStore((s) => s.dismissPendingCardUpdate);

  const entry = pending[0] ?? null;
  const { retryAgents } = useGenerate();
  const { data: character, isFetching: isFetchingCharacter, refetch: refetchCharacter } = useCharacter(
    entry?.characterId ?? null,
  );
  const updateCharacter = useUpdateCharacter();
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [draftUpdates, setDraftUpdates] = useState<CharacterCardFieldUpdate[]>([]);

  useEffect(() => {
    setDraftUpdates(entry?.updates ?? []);
    setError(null);
    setBusyAction(null);
  }, [entry?.id, entry?.updates]);

  useEffect(() => {
    if (!entry?.characterId) return;
    void refetchCharacter();
  }, [entry?.characterId, entry?.id, refetchCharacter]);

  // Character rows come back from /characters with `data` serialized as a JSON
  // string, so parse it once here and reuse below.
  const parsedData = useMemo((): Record<string, unknown> => {
    const raw = (character as { data?: unknown } | undefined)?.data;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (raw as Record<string, unknown>) ?? {};
  }, [character]);

  // Only apply exact replacements whose oldText is still present in the current
  // field. We force-refetch the character above before letting the user approve,
  // because a 5-minute React Query cache can otherwise make fresh server-side
  // auditor proposals look stale in this modal.
  // We use substring match, not equality, because oldText is a sentence-level
  // slice of a field that often contains multiple paragraphs.
  const updateStates = useMemo<CardUpdateState[]>(() => {
    if (!entry || !character) return [];
    return draftUpdates.map((u) => {
      const current = getCharacterCardFieldValue(parsedData, u.field);
      // Populating a currently-empty field from scratch (oldText === "") is a valid
      // insert, not a stale match — e.g. About Me Keeper filling a blank about-me.
      const isEmptyInsert = u.oldText.length === 0 && current === "";
      return {
        update: u,
        stale: !isEmptyInsert && !(typeof current === "string" && u.oldText.length > 0 && current.includes(u.oldText)),
      };
    });
  }, [entry, character, draftUpdates, parsedData]);
  const applicableUpdates = useMemo(
    () => updateStates.filter((state) => !state.stale).map((state) => state.update),
    [updateStates],
  );
  const staleUpdates = useMemo(
    () => updateStates.filter((state) => state.stale).map((state) => state.update),
    [updateStates],
  );

  if (!entry) return null;

  const closeAndAdvance = () => {
    dismissPendingCardUpdate(entry.id);
    setError(null);
    setBusyAction(null);
    // If another pending update is queued, keep the modal open so the user
    // can triage them in sequence; otherwise close.
    if (useAgentStore.getState().pendingCardUpdates.length === 0) {
      onClose();
    }
  };

  const handleApprove = async (overrideStale = false) => {
    if (!character || (applicableUpdates.length === 0 && (!overrideStale || staleUpdates.length === 0))) {
      closeAndAdvance();
      return;
    }
    if (overrideStale && staleUpdates.length > 0) {
      const ok = window.confirm(
        "Some proposed card edits no longer match the current card text exactly. Override anyway? Stale replacements will be appended to their fields instead of replacing unknown text.",
      );
      if (!ok) return;
    }
    // Apply each edit as a targeted substring replace inside the field's current
    // value, NOT by overwriting the field with newText (which would erase
    // everything around the edited sentence). If the user explicitly overrides
    // a stale proposal, append the edited replacement text to the current field
    // so stale oldText cannot delete unrelated card content.
    setBusyAction("approve");
    setError(null);
    let nextData: Record<string, unknown> = { ...parsedData };
    for (const u of overrideStale ? [...applicableUpdates, ...staleUpdates] : applicableUpdates) {
      const base = getCharacterCardFieldValue(nextData, u.field);
      if (typeof base !== "string") continue;
      let nextValue: string;
      if (u.oldText.length === 0 && base === "") {
        // From-scratch insert into an empty field — set it directly.
        nextValue = u.newText;
      } else if (u.oldText.length > 0 && base.includes(u.oldText)) {
        // Exact-match replace (guard against empty oldText, which base.includes()
        // always matches and would prepend newText at index 0).
        nextValue = base.replace(u.oldText, () => u.newText);
      } else if (overrideStale) {
        nextValue = appendStaleCardReplacement(base, u.newText);
      } else {
        nextValue = base;
      }
      nextData = setCharacterCardFieldValue(nextData, u.field, nextValue);
    }
    nextData.character_version = bumpCharacterVersion(nextData.character_version);
    try {
      await updateCharacter.mutateAsync({
        id: entry.characterId,
        data: nextData,
        versionSource: "agent",
        versionReason: `${entry.agentName} card update`,
      });
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply character updates");
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = () => {
    closeAndAdvance();
  };

  const handleRegenerate = async () => {
    if (!entry.chatId || !entry.agentType) {
      setError("This proposal cannot be regenerated automatically.");
      return;
    }
    setBusyAction("regenerate");
    setError(null);
    try {
      const didRegenerate = await retryAgents(entry.chatId, [entry.agentType]);
      if (!didRegenerate) {
        setError("Failed to regenerate character card updates");
        return;
      }
      closeAndAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate character card updates");
    } finally {
      setBusyAction(null);
    }
  };

  const updateDraftNewText = (index: number, newText: string) => {
    setDraftUpdates((current) => current.map((update, idx) => (idx === index ? { ...update, newText } : update)));
  };

  const queueNote = pending.length > 1 ? ` (${pending.length - 1} more queued)` : "";

  return (
    <Modal open={open} onClose={closeAndAdvance} title="Review Character Card Updates" width="max-w-2xl">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="mari-chrome-accent-tile mari-accent-animated flex h-12 w-12 items-center justify-center rounded-xl">
            <UserCog size="1.375rem" className="text-current" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {(typeof parsedData.name === "string" && parsedData.name) || entry.characterName}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {entry.agentName} proposed {draftUpdates.length} {draftUpdates.length === 1 ? "change" : "changes"}
              {queueNote}
            </p>
          </div>
        </div>

        {isFetchingCharacter && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-2.5 text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.75rem" className="shrink-0 animate-spin" />
            Refreshing the current character card before checking stale proposals...
          </div>
        )}

        {applicableUpdates.length === 0 && !isFetchingCharacter && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--secondary)] p-2.5 text-xs text-[var(--muted-foreground)]">
            <AlertCircle size="0.75rem" className="shrink-0" />
            None of these proposals still match the freshly loaded card. Regenerate, reject, or override if you still
            want to keep the edited text.
          </div>
        )}

        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {draftUpdates.map((u, idx) => {
            const stale = updateStates[idx]?.stale ?? true;
            return (
              <div
                key={idx}
                className={`flex flex-col gap-2 rounded-lg bg-[var(--secondary)] p-3 ring-1 ring-[var(--border)] ${
                  stale ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {u.field}
                  </span>
                  {stale && (
                    <span className="rounded-full bg-[var(--destructive)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--destructive)]">
                      stale
                    </span>
                  )}
                </div>
                {u.reason && <p className="text-xs italic text-[var(--muted-foreground)]">{u.reason}</p>}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    Before
                  </span>
                  <p className="whitespace-pre-wrap rounded-md bg-[var(--destructive)]/5 p-2 text-xs leading-relaxed text-[var(--foreground)]">
                    {u.oldText}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                    After
                  </span>
                  <textarea
                    value={u.newText}
                    onChange={(event) => updateDraftNewText(idx, event.target.value)}
                    disabled={busyAction !== null}
                    rows={Math.max(3, Math.min(8, u.newText.split(/\r?\n/).length + 1))}
                    className="w-full resize-y rounded-md border border-emerald-500/10 bg-emerald-500/5 p-2 text-xs leading-relaxed text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)]/55 focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)] disabled:opacity-70"
                  />
                </div>
              </div>
            );
          })}
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
            onClick={handleReject}
            disabled={busyAction !== null || updateCharacter.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <X size="0.75rem" />
            Reject
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={busyAction !== null || updateCharacter.isPending}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            title="Regenerate this proposal"
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
            onClick={() => void handleApprove(false)}
            disabled={
              busyAction !== null || updateCharacter.isPending || isFetchingCharacter || applicableUpdates.length === 0
            }
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-all hover:opacity-90 disabled:opacity-50"
          >
            {busyAction === "approve" || updateCharacter.isPending ? (
              <Loader2 size="0.75rem" className="animate-spin" />
            ) : (
              <Check size="0.75rem" />
            )}
            Approve {applicableUpdates.length > 0 ? `(${applicableUpdates.length})` : ""}
          </button>
          {staleUpdates.length > 0 && (
            <button
              type="button"
              onClick={() => void handleApprove(true)}
              disabled={busyAction !== null || updateCharacter.isPending || isFetchingCharacter}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {busyAction === "approve" || updateCharacter.isPending ? (
                <Loader2 size="0.75rem" className="animate-spin" />
              ) : (
                <AlertCircle size="0.75rem" />
              )}
              Override stale ({staleUpdates.length})
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
