import { useState, useMemo, useCallback } from "react";
import { Modal } from "../../../components/ui/Modal";
import { History, Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useChatPersonaAttributions, useReassignMessagePersonas } from "../../../hooks/use-chats";
import type { CharacterData, Persona } from "@marinara-engine/shared";

interface PersonaHistoryReassignModalProps {
  chatId: string;
  chatMode?: string | null;
  open: boolean;
  onClose: () => void;
  personas: Array<Pick<Persona, "id" | "name" | "avatarPath">>;
  characters: Array<{ id: string; data: CharacterData }>;
}

export function PersonaHistoryReassignModal({
  chatId,
  chatMode,
  open,
  onClose,
  personas,
  characters,
}: PersonaHistoryReassignModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const { data: attributions, isLoading } = useChatPersonaAttributions(chatId, open);
  const reassignMutation = useReassignMessagePersonas(chatId);

  const [scope, setScope] = useState<"unassigned" | "persona" | "all">("unassigned");
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>("");
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>("none");

  // Character identities are not valid user identities in Game mode
  const isGameMode = chatMode === "game";

  const identities = useMemo(() => attributions?.identities ?? [], [attributions]);

  // Set default source persona if none selected
  const activeSourceKey = useMemo(() => {
    if (selectedSourceKey && identities.some((i) => `${i.source}:${i.personaId}` === selectedSourceKey)) {
      return selectedSourceKey;
    }
    if (identities.length > 0) {
      return `${identities[0].source}:${identities[0].personaId}`;
    }
    return "";
  }, [selectedSourceKey, identities]);

  const unassignedCount = attributions?.unassignedCount ?? 0;
  const allUserCount = attributions?.allUserMessageCount ?? 0;

  const currentSourceIdentity = useMemo(() => {
    return identities.find((i) => `${i.source}:${i.personaId}` === activeSourceKey) ?? null;
  }, [identities, activeSourceKey]);

  const targetCount = useMemo(() => {
    if (scope === "unassigned") return unassignedCount;
    if (scope === "all") return allUserCount;
    return currentSourceIdentity?.count ?? 0;
  }, [scope, unassignedCount, allUserCount, currentSourceIdentity]);

  // Target candidate options
  const targetOptions = useMemo(() => {
    const list: Array<{
      key: string;
      id: string | null;
      source: "persona" | "character" | null;
      name: string;
      avatarUrl?: string | null;
    }> = [
      {
        key: "none",
        id: null,
        source: null,
        name: localizeUi("ui.chat.chatsettingsdrawer.noneNoPersona"),
      },
    ];

    for (const p of personas) {
      list.push({
        key: `persona:${p.id}`,
        id: p.id,
        source: "persona",
        name: p.name,
        avatarUrl: p.avatarPath,
      });
    }

    if (!isGameMode) {
      for (const c of characters) {
        const avatarUrl = typeof c.data.avatarPath === "string" ? c.data.avatarPath : null;
        list.push({
          key: `character:${c.id}`,
          id: c.id,
          source: "character",
          name: c.data.name || "Unnamed Character",
          avatarUrl,
        });
      }
    }

    return list;
  }, [personas, characters, isGameMode, localizeUi]);

  const selectedTarget = useMemo(() => {
    return targetOptions.find((t) => t.key === selectedTargetKey) ?? targetOptions[0];
  }, [targetOptions, selectedTargetKey]);

  const handleApply = useCallback(async () => {
    if (targetCount === 0) return;

    const sourcePersonaId = scope === "persona" ? currentSourceIdentity?.personaId : undefined;
    const sourcePersonaSource = scope === "persona" ? currentSourceIdentity?.source : undefined;

    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.chat.chatsettingsdrawer.confirmReassignTitle"),
      message: localizeUi("ui.chat.chatsettingsdrawer.confirmReassignMessage", {
        count: targetCount,
        targetName: selectedTarget.name,
      }),
      confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.applyPersona"),
    });

    if (!confirmed) return;

    try {
      const res = await reassignMutation.mutateAsync({
        scope,
        sourcePersonaId,
        sourcePersonaSource,
        targetPersonaId: selectedTarget.id,
        targetPersonaSource: selectedTarget.source,
      });

      toast.success(
        localizeUi("ui.chat.chatsettingsdrawer.reassignedMessagesSuccess", {
          count: res.updatedCount,
        }),
      );
      onClose();
    } catch (err) {
      toast.error(
        localizeUi("ui.chat.chatsettingsdrawer.failedToReassignMessages", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }, [targetCount, scope, currentSourceIdentity, selectedTarget, reassignMutation, onClose, localizeUi]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.chat.chatsettingsdrawer.applyPersonaToEarlierMessages")}
      width="max-w-md"
      chatFloatingPanel
    >
      <div className="space-y-4 text-xs text-[var(--foreground)]">
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.applyPersonaToEarlierMessagesDesc")}
        </p>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-[var(--muted-foreground)]">
            <Loader2 size="1rem" className="animate-spin text-[var(--primary)]" />
            <span>{localizeUi("ui.chat.chatsettingsdrawer.loadingAttributions")}</span>
          </div>
        ) : (
          <>
            {/* Target Scope Selection */}
            <div className="space-y-2">
              <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.messagesToUpdate")}
              </label>

              <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
                {/* Option 1: Unassigned */}
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reassign-scope"
                      value="unassigned"
                      checked={scope === "unassigned"}
                      onChange={() => setScope("unassigned")}
                      className="text-[var(--primary)] focus:ring-0"
                    />
                    <span>{localizeUi("ui.chat.chatsettingsdrawer.messagesSentWithoutPersona")}</span>
                  </div>
                  <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {unassignedCount}
                  </span>
                </label>

                {/* Option 2: Sent as specific persona */}
                <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--accent)]">
                  <label className="flex cursor-pointer items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="reassign-scope"
                        value="persona"
                        checked={scope === "persona"}
                        onChange={() => setScope("persona")}
                        disabled={identities.length === 0}
                        className="text-[var(--primary)] focus:ring-0 disabled:opacity-50"
                      />
                      <span>{localizeUi("ui.chat.chatsettingsdrawer.messagesSentAs")}</span>
                    </div>
                    {scope === "persona" && currentSourceIdentity && (
                      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                        {currentSourceIdentity.count}
                      </span>
                    )}
                  </label>

                  {scope === "persona" && identities.length > 0 && (
                    <div className="mt-2 pl-6">
                      <select
                        value={activeSourceKey}
                        onChange={(e) => setSelectedSourceKey(e.target.value)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none focus:border-[var(--primary)]"
                      >
                        {identities.map((id) => (
                          <option key={`${id.source}:${id.personaId}`} value={`${id.source}:${id.personaId}`}>
                            {id.name} ({id.count})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Option 3: All messages */}
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="reassign-scope"
                      value="all"
                      checked={scope === "all"}
                      onChange={() => setScope("all")}
                      className="text-[var(--primary)] focus:ring-0"
                    />
                    <span>{localizeUi("ui.chat.chatsettingsdrawer.allUserMessagesInChat")}</span>
                  </div>
                  <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--muted-foreground)]">
                    {allUserCount}
                  </span>
                </label>
              </div>
            </div>

            {/* Target Persona Selection */}
            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.newPersonaAttribution")}
              </label>

              <select
                value={selectedTargetKey}
                onChange={(e) => setSelectedTargetKey(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)]"
              >
                {targetOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Explanatory note */}
            <div className="rounded-lg bg-[var(--secondary)]/50 p-2.5 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.chatsettingsdrawer.reassignNote")}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={reassignMutation.isPending}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                {localizeUi("ui.common.cancel")}
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={reassignMutation.isPending || targetCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reassignMutation.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <History size="0.75rem" />
                )}
                {localizeUi("ui.chat.chatsettingsdrawer.updateCountMessages", { count: targetCount })}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
