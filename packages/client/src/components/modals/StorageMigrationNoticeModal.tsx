import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, Database } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";
import {
  useAcknowledgeStorageMigrationNotice,
  useStorageMigrationNotice,
} from "../../hooks/use-storage-migration-notice";
import { Modal } from "../ui/Modal";
import { SHEET_BUTTON_PRIMARY, SHEET_BUTTON_SECONDARY } from "../ui/neutral-surface-styles";

/**
 * One-time notice shown after a storage-format migration: chat data split
 * into the per-chat shard layout (#4756), or persona rows converted to
 * character cards (format 11, #8688). Purely informational — the migration is automatic by
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

  // Format 11 converts persona rows in place without sharding anything, so the chat-split text
  // only shows when a table was actually split.
  const shardedCount = notice.migratedTables.length;
  const personasConverted = (notice.convertedTables ?? []).includes("personas");
  const showChatSplit = shardedCount > 0 || !personasConverted;

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
      footer={
        <>
          <button type="button" onClick={handleDismiss} className={SHEET_BUTTON_PRIMARY}>
            {localizeUi("ui.modals.storagemigrationnoticemodal.gotIt")}
          </button>
          <button type="button" onClick={openStorageGuide} className={SHEET_BUTTON_SECONDARY}>
            <BookOpen size="0.875rem" aria-hidden="true" />
            {localizeUi("ui.modals.storagemigrationnoticemodal.openTheStorageGuide")}
          </button>
        </>
      }
    >
      <div data-component="StorageMigrationNoticeModal" className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--sidebar)] text-[var(--primary)]">
            <Database size="1.25rem" aria-hidden="true" />
          </div>
          <div className="space-y-4">
            {showChatSplit ? (
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                {localizeUi("ui.modals.storagemigrationnoticemodal.marinaraReorganizedHowYourChatsAreSaved")}
              </p>
            ) : null}
            {personasConverted ? (
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                {localizeUi("ui.modals.storagemigrationnoticemodal.personasNowUseTheCardFormat")}
              </p>
            ) : null}
          </div>
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
          className="flex items-center gap-1.5 text-sm font-medium max-sm:min-h-11 text-[var(--primary)] active:scale-95"
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
              {shardedCount === 0
                ? notice.fromFormat === null
                  ? localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormatOnlyUnknownFrom", {
                      to: notice.toFormat,
                    })
                  : localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormatOnly", {
                      from: notice.fromFormat,
                      to: notice.toFormat,
                    })
                : notice.fromFormat === null
                  ? localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormatsUnknownFrom", {
                      to: notice.toFormat,
                      count: shardedCount,
                    })
                  : localizeUi("ui.modals.storagemigrationnoticemodal.technicalFormats", {
                      from: notice.fromFormat,
                      to: notice.toFormat,
                      count: shardedCount,
                    })}
            </li>
            {shardedCount > 0 ? <li>{localizeUi("ui.modals.storagemigrationnoticemodal.technicalBackups")}</li> : null}
            {personasConverted ? (
              <li>{localizeUi("ui.modals.storagemigrationnoticemodal.technicalPersonaCards")}</li>
            ) : null}
            <li>{localizeUi("ui.modals.storagemigrationnoticemodal.technicalDowngrade")}</li>
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}
