import { useCallback, useMemo, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useChatPersonaAttributions, useReassignMessagePersonas } from "../../../hooks/use-chats";
import { PickerDropdown } from "../PickerDropdown";

interface PersonaHistoryReassignDropdownProps {
  chatId: string;
  targetName: string | null;
}

export function PersonaHistoryReassignDropdown({ chatId, targetName }: PersonaHistoryReassignDropdownProps) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"unassigned" | "persona" | "all">("unassigned");
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const { data: attributions, isLoading } = useChatPersonaAttributions(chatId, open);
  const reassignMutation = useReassignMessagePersonas(chatId);

  const identities = useMemo(() => attributions?.identities ?? [], [attributions]);
  const activeSourceKey = useMemo(() => {
    if (
      selectedSourceKey &&
      identities.some((identity) => `${identity.source}:${identity.personaId}` === selectedSourceKey)
    ) {
      return selectedSourceKey;
    }
    return identities[0] ? `${identities[0].source}:${identities[0].personaId}` : "";
  }, [identities, selectedSourceKey]);
  const currentSourceIdentity = identities.find(
    (identity) => `${identity.source}:${identity.personaId}` === activeSourceKey,
  );
  const targetCount =
    scope === "unassigned"
      ? (attributions?.unassignedCount ?? 0)
      : scope === "all"
        ? (attributions?.allUserMessageCount ?? 0)
        : (currentSourceIdentity?.count ?? 0);

  const handleApply = useCallback(async () => {
    if (!targetName || targetCount === 0) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.chat.chatsettingsdrawer.confirmReassignTitle"),
      message: localizeUi("ui.chat.chatsettingsdrawer.confirmReassignMessage", {
        count: targetCount,
        targetName,
      }),
      confirmLabel: localizeUi("ui.chat.chatsettingsdrawer.applyPersona"),
    });
    if (!confirmed) return;

    try {
      const result = await reassignMutation.mutateAsync({
        scope,
        sourcePersonaId: scope === "persona" ? currentSourceIdentity?.personaId : undefined,
        sourcePersonaSource: scope === "persona" ? currentSourceIdentity?.source : undefined,
      });
      toast.success(localizeUi("ui.chat.chatsettingsdrawer.reassignedMessagesSuccess", { count: result.updatedCount }));
      setOpen(false);
    } catch (error) {
      toast.error(
        localizeUi("ui.chat.chatsettingsdrawer.failedToReassignMessages", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }, [currentSourceIdentity, localizeUi, reassignMutation, scope, targetCount, targetName]);

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!targetName}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
        >
          <History size="0.75rem" />
          <span>{localizeUi("ui.chat.chatsettingsdrawer.applyPersonaToEarlierMessages")}</span>
        </button>
      ) : (
        <PickerDropdown
          search=""
          onSearchChange={() => {}}
          onClose={() => setOpen(false)}
          placeholder={localizeUi("ui.chat.chatsettingsdrawer.applyPersonaToEarlierMessages")}
          searchable={false}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-[var(--muted-foreground)]">
              <Loader2 size="0.875rem" className="animate-spin" />
              {localizeUi("ui.chat.chatsettingsdrawer.loadingAttributions")}
            </div>
          ) : (
            <div className="space-y-1 p-2 text-xs">
              <div className="px-1 py-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.chatsettingsdrawer.messagesToUpdate")}
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                <span className="flex items-center gap-2">
                  <input type="radio" checked={scope === "unassigned"} onChange={() => setScope("unassigned")} />
                  {localizeUi("ui.chat.chatsettingsdrawer.messagesSentWithoutPersona")}
                </span>
                <span>{attributions?.unassignedCount ?? 0}</span>
              </label>
              <div className="rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                <label className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scope === "persona"}
                      onChange={() => setScope("persona")}
                      disabled={identities.length === 0}
                    />
                    {localizeUi("ui.chat.chatsettingsdrawer.messagesSentAs")}
                  </span>
                  {scope === "persona" && currentSourceIdentity?.count}
                </label>
                {scope === "persona" && identities.length > 0 && (
                  <select
                    value={activeSourceKey}
                    onChange={(event) => setSelectedSourceKey(event.target.value)}
                    className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  >
                    {identities.map((identity) => (
                      <option
                        key={`${identity.source}:${identity.personaId}`}
                        value={`${identity.source}:${identity.personaId}`}
                      >
                        {identity.name} ({identity.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--accent)]">
                <span className="flex items-center gap-2">
                  <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
                  {localizeUi("ui.chat.chatsettingsdrawer.allUserMessagesInChat")}
                </span>
                <span>{attributions?.allUserMessageCount ?? 0}</span>
              </label>
              <button
                type="button"
                onClick={handleApply}
                disabled={reassignMutation.isPending || !targetName || targetCount === 0}
                className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {reassignMutation.isPending && <Loader2 size="0.75rem" className="animate-spin" />}
                {localizeUi("ui.chat.chatsettingsdrawer.updateCountMessages", { count: targetCount })}
              </button>
            </div>
          )}
        </PickerDropdown>
      )}
    </div>
  );
}
