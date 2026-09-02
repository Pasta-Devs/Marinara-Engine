import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CapabilityPackageUpdate } from "@marinara-engine/shared";
import {
  useDeclineCapabilityPackageUpdate,
  useInstallCapabilityPackage,
  usePendingCapabilityPackageUpdates,
} from "../../hooks/use-capability-packages";
import { getPrivilegedActionErrorMessage } from "../../lib/api-client";
import { AgentUpdateDialog } from "./AgentUpdateDialog";
import { useTranslation as useUiTranslation } from "react-i18next";

export function AgentUpdatePrompter({ presentationAllowed }: { presentationAllowed: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const { data: pendingUpdateData, refetch: refetchPendingUpdates } = usePendingCapabilityPackageUpdates();
  const install = useInstallCapabilityPackage();
  const decline = useDeclineCapabilityPackageUpdate();
  // Kept as a ref, not state: a dismissed update must not re-prompt this session,
  // and marking it must not schedule another render of the queue effect.
  const handledUpdates = useRef(new Set<string>());
  const [prompted, setPrompted] = useState<CapabilityPackageUpdate[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const updates = (pendingUpdateData ?? []).filter(
      (update) => !handledUpdates.current.has(`${update.id}@${update.version}`),
    );
    if (!presentationAllowed || updates.length === 0 || prompted) return;
    setPrompted(updates);
  }, [pendingUpdateData, presentationAllowed, prompted]);

  const finish = useCallback(
    async (updates: CapabilityPackageUpdate[]) => {
      updates.forEach((update) => handledUpdates.current.add(`${update.id}@${update.version}`));
      setPrompted(null);
      setBusy(false);
      await refetchPendingUpdates();
    },
    [refetchPendingUpdates],
  );

  const handleUpdateAll = useCallback(async () => {
    // Same guard as handleNotNow: a second click landing before the disabled
    // state commits would run the install loop again and post a duplicate
    // install for every prompted package.
    if (!prompted || busy) return;
    setBusy(true);
    const failures: unknown[] = [];
    let restartRequired = false;
    let succeeded = 0;
    for (const update of prompted) {
      try {
        const installed = await install.mutateAsync({
          id: update.id,
          expectedVersion: update.version,
          expectedArtifactSha256: update.artifactSha256,
        });
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
    await finish(prompted);
  }, [busy, finish, install, localizeUi, prompted]);

  const handleNotNow = useCallback(async () => {
    if (!prompted || busy) return;
    setBusy(true);
    const failures: unknown[] = [];
    for (const update of prompted) {
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
    await finish(prompted);
  }, [busy, decline, finish, localizeUi, prompted]);

  if (!prompted) return null;

  return (
    <AgentUpdateDialog
      open
      updates={prompted}
      busy={busy}
      onUpdateAll={() => void handleUpdateAll()}
      onNotNow={() => void handleNotNow()}
    />
  );
}
