import { useCallback, useMemo, useState } from "react";
import { History } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useChatPersonaAttributions, useReassignMessagePersonas } from "../../../hooks/use-chats";
import { useFieldWindow } from "../../../components/ui/PickerField";
import { PickRow } from "../../../components/ui/PickerParts";
import { PickerWindow } from "../../../components/ui/PickerWindow";
import { Select } from "../../../components/ui/Select";
import { Spinner } from "../../../components/ui/Spinner";

interface PersonaHistoryReassignDropdownProps {
  chatId: string;
  targetName: string | null;
}

export function PersonaHistoryReassignDropdown({ chatId, targetName }: PersonaHistoryReassignDropdownProps) {
  const { t: localizeUi } = useUiTranslation();
  // Closing hands focus back to the button, as every shared picker does.
  const { open, triggerRef, close, toggle } = useFieldWindow(false);
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
      close();
    } catch (error) {
      toast.error(
        localizeUi("ui.chat.chatsettingsdrawer.failedToReassignMessages", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }, [close, currentSourceIdentity, localizeUi, reassignMutation, scope, targetCount, targetName]);

  const count = (value: number | undefined) => (
    <span className="text-[0.6875rem] text-foreground/50">{value ?? 0}</span>
  );

  return (
    <div className="mt-2">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        disabled={!targetName}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[0.6875rem] text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--foreground)]"
      >
        <History size="0.75rem" />
        <span>{localizeUi("ui.chat.chatsettingsdrawer.applyPersonaToEarlierMessages")}</span>
      </button>
      {open && (
        // The shared picker window (#9468): pick which messages, then apply.
        <PickerWindow
          title={localizeUi("ui.chat.chatsettingsdrawer.messagesToUpdate")}
          anchorRef={triggerRef}
          onClose={close}
          hug
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-[var(--muted-foreground)]">
              <Spinner size="sm" />
              {localizeUi("ui.chat.chatsettingsdrawer.loadingAttributions")}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 overflow-y-auto px-1.5 pb-2">
              <PickRow
                picked={scope === "unassigned"}
                onClick={() => setScope("unassigned")}
                title={localizeUi("ui.chat.chatsettingsdrawer.messagesSentWithoutPersona")}
                badge={count(attributions?.unassignedCount)}
              />
              {identities.length > 0 && (
                <PickRow
                  picked={scope === "persona"}
                  onClick={() => setScope("persona")}
                  title={localizeUi("ui.chat.chatsettingsdrawer.messagesSentAs")}
                  badge={scope === "persona" ? count(currentSourceIdentity?.count) : undefined}
                />
              )}
              {scope === "persona" && identities.length > 0 && (
                <div className="px-2 pb-1">
                  <Select
                    label={localizeUi("ui.chat.chatsettingsdrawer.messagesSentAs")}
                    value={activeSourceKey}
                    options={identities.map((identity) => ({
                      value: `${identity.source}:${identity.personaId}`,
                      label: `${identity.name} (${identity.count})`,
                    }))}
                    onChange={setSelectedSourceKey}
                    className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
                  />
                </div>
              )}
              <PickRow
                picked={scope === "all"}
                onClick={() => setScope("all")}
                title={localizeUi("ui.chat.chatsettingsdrawer.allUserMessagesInChat")}
                badge={count(attributions?.allUserMessageCount)}
              />
              <button
                type="button"
                onClick={handleApply}
                disabled={reassignMutation.isPending || !targetName || targetCount === 0}
                className="mx-1.5 mt-1.5 flex items-center justify-center gap-1.5 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              >
                {reassignMutation.isPending && <Spinner size="sm" />}
                {localizeUi("ui.chat.chatsettingsdrawer.updateCountMessages", { count: targetCount })}
              </button>
            </div>
          )}
        </PickerWindow>
      )}
    </div>
  );
}
