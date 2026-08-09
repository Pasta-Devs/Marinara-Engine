import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Database } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import {
  useAcknowledgeStorageMigrationNotice,
  useStorageMigrationNotice,
} from "../../hooks/use-storage-migration-notice";
import { Modal } from "../ui/Modal";

/**
 * One-time notice shown after the store migrated chat data to the per-chat
 * shard layout (#4756). Purely informational — the migration is automatic by
 * design (#4708); this explains what changed, why disk usage grew, and where
 * the downgrade path lives. Dismissing acknowledges server-side, so the
 * notice never returns (until a future storage-format bump migrates again).
 */
export function StorageMigrationNoticeModal({ presentationAllowed }: { presentationAllowed: boolean }) {
  const { t: localizeUi } = useUiTranslation();
  const hasCompletedOnboarding = useUIStore((state) => state.hasCompletedOnboarding);
  const { data: notice } = useStorageMigrationNotice();
  const acknowledge = useAcknowledgeStorageMigrationNotice();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    // `dismissed` makes the close authoritative client-side even if the
    // cached notice were still present — without it, the auto-open effect
    // re-fires the moment `open` flips false and the modal cannot be closed
    // until (unless) the acknowledge round trip lands.
    if (!presentationAllowed || !hasCompletedOnboarding || !notice || open || dismissed) return;
    setOpen(true);
  }, [dismissed, hasCompletedOnboarding, notice, open, presentationAllowed]);

  if (!notice) return null;

  const handleDismiss = () => {
    setDismissed(true);
    setOpen(false);
    acknowledge.mutate();
  };

  const openStorageGuide = () => {
    handleDismiss();
    useUIStore.getState().openModal("docs-viewer", { initialDoc: "TROUBLESHOOTING.md" });
  };

  return (
    <Modal
      open={open}
      onClose={handleDismiss}
      title={localizeUi("ui.modals.storagemigrationnoticemodal.yourStorageGotAnUpgrade")}
      width="max-w-xl"
    >
      <div data-component="StorageMigrationNoticeModal" className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--sidebar)] text-[var(--primary)]">
            <Database size="1.25rem" aria-hidden="true" />
          </div>
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            {localizeUi("ui.modals.storagemigrationnoticemodal.marinaraReorganizedHowYourChatsAreSaved")}
          </p>
        </div>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.modals.storagemigrationnoticemodal.nothingWasLostBackupsWereKept")}
        </p>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {localizeUi("ui.modals.storagemigrationnoticemodal.olderVersionsNeedAGuide")}
        </p>

        <button
          type="button"
          onClick={() => setShowTechnical((value) => !value)}
          aria-expanded={showTechnical}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] active:scale-95"
        >
          {showTechnical ? (
            <ChevronDown size="0.875rem" aria-hidden="true" />
          ) : (
            <ChevronRight size="0.875rem" aria-hidden="true" />
          )}
          {showTechnical
            ? localizeUi("ui.modals.storagemigrationnoticemodal.hideTechnicalDetails")
            : localizeUi("ui.modals.storagemigrationnoticemodal.showTechnicalDetails")}
        </button>

        {showTechnical ? (
          <ul className="list-disc space-y-2 rounded-lg border border-[var(--border)] bg-[var(--sidebar)] py-3 pl-8 pr-4 text-sm leading-6 text-[var(--muted-foreground)]">
            <li>
              {notice.fromFormat === null
                ? localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormatsUnknownFrom", {
                    to: notice.toFormat,
                    count: notice.migratedTables.length,
                  })
                : localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormats", {
                    from: notice.fromFormat,
                    to: notice.toFormat,
                    count: notice.migratedTables.length,
                  })}
            </li>
            <li>{localizeUi("ui.modals.storagemigrationnoticemodal.technicalBackups")}</li>
            <li>{localizeUi("ui.modals.storagemigrationnoticemodal.technicalDowngrade")}</li>
          </ul>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={openStorageGuide}
            className="mari-chrome-control min-h-10 justify-center px-4 py-2 text-sm"
          >
            <BookOpen size="0.875rem" aria-hidden="true" />
            {localizeUi("ui.modals.storagemigrationnoticemodal.openTheStorageGuide")}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="mari-chrome-control mari-chrome-control--primary min-h-10 justify-center px-5 py-2 text-sm"
          >
            {localizeUi("ui.modals.storagemigrationnoticemodal.gotIt")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
