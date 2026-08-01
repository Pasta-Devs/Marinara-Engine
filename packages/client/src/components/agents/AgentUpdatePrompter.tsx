import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  useDeclineCapabilityPackageUpdate,
  useInstallCapabilityPackage,
  usePendingCapabilityPackageUpdates,
} from "../../hooks/use-capability-packages";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { useTranslation as useUiTranslation } from "react-i18next";

export function AgentUpdatePrompter({ presentationAllowed }: { presentationAllowed: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const { data: pendingUpdateData, refetch: refetchPendingUpdates } = usePendingCapabilityPackageUpdates();
  const install = useInstallCapabilityPackage();
  const decline = useDeclineCapabilityPackageUpdate();
  const activeUpdate = useRef<string | null>(null);
  const handledUpdates = useRef(new Set<string>());

  useEffect(() => {
    const updates = (pendingUpdateData ?? []).filter(
      (update) => !handledUpdates.current.has(`${update.id}@${update.version}`),
    );
    if (!presentationAllowed || updates.length === 0 || activeUpdate.current) return;
    const updateKeys = updates.map((update) => `${update.id}@${update.version}`);

    activeUpdate.current = updateKeys.join(",");
    void (async () => {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.agents.agentupdateprompter.agentUpdatesAvailable"),
        message: localizeUi("ui.agents.agentupdateprompter.updateAllNowOrDismiss", {
          value1: updates
            .map((update) => `• ${update.name} (${update.installedVersion} → ${update.version})`)
            .join("\n"),
        }),
        confirmLabel: localizeUi("ui.agents.agentupdateprompter.updateAll"),
        cancelLabel: localizeUi("ui.agents.agentupdateprompter.notNow"),
      });

      updateKeys.forEach((updateKey) => handledUpdates.current.add(updateKey));
      try {
        if (confirmed) {
          const failures: unknown[] = [];
          let restartRequired = false;
          let succeeded = 0;
          for (const update of updates) {
            try {
              const installed = await install.mutateAsync({ id: update.id, expectedVersion: update.version });
              restartRequired ||= installed.status === "restart-required";
              succeeded += 1;
            } catch (error) {
              failures.push(error);
            }
          }
          if (succeeded > 0) {
            toast.success(
              restartRequired
                ? localizeUi("ui.agents.agentupdateprompter.updatesAppliedRestartRequired")
                : localizeUi("ui.agents.agentupdateprompter.updatesAppliedReadyToUse"),
            );
          }
          if (failures.length > 0) {
            toast.error(
              getPrivilegedActionErrorMessage(
                failures[0],
                localizeUi("ui.agents.agentupdateprompter.someUpdatesCouldNotBeApplied"),
              ),
            );
          }
        } else {
          const failures: unknown[] = [];
          for (const update of updates) {
            try {
              await decline.mutateAsync({ id: update.id, version: update.version });
            } catch (error) {
              failures.push(error);
            }
          }
          if (failures.length > 0) {
            toast.error(
              getPrivilegedActionErrorMessage(
                failures[0],
                localizeUi("ui.agents.agentupdateprompter.someUpdateNoticesCouldNotBeDismissed"),
              ),
            );
          }
        }
      } finally {
        activeUpdate.current = null;
        await refetchPendingUpdates();
      }
    })();
  }, [decline, install, pendingUpdateData, presentationAllowed, localizeUi, refetchPendingUpdates]);

  return null;
}
