import { Check, Scissors, Sparkles, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { DescriptionSplitField, DescriptionSplitResult } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { SETTINGS_BUTTON_CLASS, SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS } from "../panels/settings/SettingControls";

type MovedField = Exclude<DescriptionSplitField, "description">;

interface DescriptionSplitDialogProps {
  open: boolean;
  /** Kept after closing so the dialog does not empty out while it fades. */
  result: DescriptionSplitResult | null;
  /** Professor Mari edits the saved card, so the dialog warns when the form has unsaved edits. */
  hasUnsavedChanges: boolean;
  /** Absent for a card that has not been saved yet. */
  onAskMari?: () => void;
  /** The split was already saved as a new version (import), so the dialog only reports it. */
  applied?: boolean;
  /** Saves the split card as a new version. */
  onApply?: () => void;
  onSplitAnyway?: () => void;
  onClose: () => void;
}

/** One line per filled field: was it empty, added to, or replaced, and the first line of what moved. */
function summarizeSplit(result: DescriptionSplitResult) {
  return result.changed
    .filter((field): field is MovedField => field !== "description")
    .map((field) => {
      const existing = result.before[field].trim();
      const after = result.after[field].trim();
      const status = !existing ? "new" : after.startsWith(existing) ? "added" : "replaced";
      const moved = status === "added" ? after.slice(existing.length) : after;
      const preview =
        moved
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line && line !== "<START>") ?? "";
      return { field, status, length: moved.trim().length, preview };
    });
}

export function DescriptionSplitDialog({
  open,
  result,
  hasUnsavedChanges,
  onAskMari,
  applied = false,
  onApply,
  onSplitAnyway,
  onClose,
}: DescriptionSplitDialogProps) {
  const { t: localizeUi } = useUiTranslation();
  const rows = result?.status === "changed" ? summarizeSplit(result) : [];
  const descriptionAfter = result?.after.description.trim().length ?? 0;
  const canSplitAnyway = !applied && result?.status === "skipped" && !!result.before.description.trim();

  return (
    <Modal
      open={open && result !== null}
      onClose={onClose}
      title={localizeUi("ui.characters.descriptionsplitdialog.title")}
      width="max-w-md"
    >
      {result && (
        <div className="space-y-3 text-xs">
          {result.status === "changed" ? (
            <>
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {rows.map((row) => (
                  <li key={row.field} className="space-y-0.5 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--foreground)]">
                        {localizeUi(`ui.characters.descriptionsplitdialog.field.${row.field}`)}
                      </span>
                      <span className="rounded-full bg-[var(--muted)] px-1.5 py-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi(`ui.characters.descriptionsplitdialog.status.${row.status}`)}
                      </span>
                      <span className="ml-auto shrink-0 text-[0.6875rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.characters.descriptionsplitdialog.characters", {
                          length: row.length.toLocaleString(),
                        })}
                      </span>
                    </div>
                    <p className="truncate text-[0.6875rem] text-[var(--muted-foreground)]">{row.preview}</p>
                  </li>
                ))}
              </ul>
              <p className="text-[var(--muted-foreground)]">
                {descriptionAfter
                  ? localizeUi("ui.characters.descriptionsplitdialog.descriptionShrinks", {
                      before: result.before.description.trim().length.toLocaleString(),
                      after: descriptionAfter.toLocaleString(),
                    })
                  : localizeUi("ui.characters.descriptionsplitdialog.descriptionEmptied")}{" "}
                {localizeUi(
                  applied
                    ? "ui.characters.descriptionsplitdialog.savedAsVersion"
                    : "ui.characters.descriptionsplitdialog.nothingSavedYet",
                )}
              </p>
              {result.keywordSorted && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[var(--foreground)]">
                  {localizeUi("ui.characters.descriptionsplitdialog.keywordSorted")}
                  {onAskMari && <> {localizeUi("ui.characters.descriptionsplitdialog.mariCanSort")}</>}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[var(--foreground)]">
                {result.status === "skipped"
                  ? localizeUi("ui.characters.descriptionsplitdialog.skipped", { reason: result.reason })
                  : localizeUi("ui.characters.descriptionsplitdialog.nothingToMove")}
              </p>
              {onAskMari && (
                <p className="text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.descriptionsplitdialog.mariCanSort")}
                </p>
              )}
            </>
          )}
          {onAskMari && hasUnsavedChanges && (
            <p className="text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.descriptionsplitdialog.mariUsesSavedCard")}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {onAskMari && (
              <button
                type="button"
                onClick={onAskMari}
                className={SETTINGS_BUTTON_CLASS}
                title={localizeUi("ui.characters.descriptionsplitdialog.askMariHelp")}
              >
                <Sparkles size="0.75rem" />
                {localizeUi("ui.characters.descriptionsplitdialog.askMari")}
              </button>
            )}
            <button type="button" onClick={onClose} className={SETTINGS_BUTTON_CLASS}>
              <X size="0.75rem" />
              {localizeUi(
                applied || result.status === "unchanged"
                  ? "ui.characters.descriptionsplitdialog.close"
                  : "ui.characters.descriptionsplitdialog.cancel",
              )}
            </button>
            {!applied && result.status === "changed" && (
              <button type="button" onClick={onApply} className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}>
                <Check size="0.75rem" />
                {localizeUi("ui.characters.descriptionsplitdialog.apply")}
              </button>
            )}
            {canSplitAnyway && (
              <button type="button" onClick={onSplitAnyway} className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}>
                <Scissors size="0.75rem" />
                {localizeUi("ui.characters.descriptionsplitdialog.splitAnyway")}
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
