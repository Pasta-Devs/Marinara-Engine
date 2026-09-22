// The review behind "Refresh from ruleset": the rows of one list whose catalog entry now carries
// different text, each with what the sheet holds beside what the ruleset says, and a checkbox.
//
// Nothing is applied here. The chosen rows go back to the editor, which writes them in one change,
// so a review the user cancels leaves the sheet exactly as it was.
import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { CatalogRefreshRow } from "../../lib/ruleset-catalog";
import { Modal } from "../ui/Modal";

const labelClass = "text-[0.6875rem] font-medium text-[var(--muted-foreground)]";

export function RulesetCatalogRefreshModal({
  open,
  onClose,
  listLabel,
  rows,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  /** The list being reviewed, named in the title so a sheet with several lists is never ambiguous. */
  listLabel: string;
  rows: readonly CatalogRefreshRow[];
  /** The rows the user kept. The editor turns them into one change. */
  onApply: (chosen: CatalogRefreshRow[]) => void;
}) {
  const { t } = useUiTranslation();
  // Every row starts checked, so what is tracked is what the user takes OUT. A row index is unique
  // inside one list, and this modal only ever shows one list.
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const chosen = rows.filter((row) => !skipped.has(row.index));

  // The rows can change under an open review (a catalog that finishes loading, another list). An
  // index the user unticked then means a different row, so the choice starts over with the rows.
  const reviewed = `${listLabel}:${rows.map((row) => row.index).join(",")}`;
  useEffect(() => setSkipped(new Set()), [reviewed]);

  const toggle = (index: number) =>
    setSkipped((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("ui.rulesets.sheet.refreshTitle", { list: listLabel })}
      width="max-w-xl"
      mobileFullscreen
      contentClassName="flex flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{t("ui.rulesets.sheet.refreshHint")}</p>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {rows.map((row) => (
            <label
              key={row.index}
              className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2"
            >
              <input
                type="checkbox"
                checked={!skipped.has(row.index)}
                onChange={() => toggle(row.index)}
                aria-label={t("ui.rulesets.sheet.refreshRowAria", { name: row.name })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block text-xs font-medium text-[var(--foreground)]">{row.name}</span>
                {row.columns.map((column) => (
                  <span key={column.columnId} className="block space-y-0.5">
                    <span className={`block ${labelClass}`}>
                      {column.added ? t("ui.rulesets.sheet.refreshAddedColumn", { label: column.label }) : column.label}
                    </span>
                    <span className="grid gap-1 sm:grid-cols-2">
                      <span className="block min-w-0">
                        <span className={`block ${labelClass}`}>{t("ui.rulesets.sheet.refreshCurrent")}</span>
                        <span className="block whitespace-pre-wrap break-words text-[0.6875rem] text-[var(--muted-foreground)]">
                          {column.current || t("ui.rulesets.sheet.refreshEmpty")}
                        </span>
                      </span>
                      <span className="block min-w-0">
                        <span className={`block ${labelClass}`}>{t("ui.rulesets.sheet.refreshNew")}</span>
                        <span className="block whitespace-pre-wrap break-words text-[0.6875rem] text-[var(--foreground)]">
                          {column.next || t("ui.rulesets.sheet.refreshEmpty")}
                        </span>
                      </span>
                    </span>
                  </span>
                ))}
              </span>
            </label>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-2">
          <button type="button" onClick={onClose} className="mari-chrome-control mari-chrome-control--small text-xs">
            {t("ui.rulesets.sheet.refreshCancel")}
          </button>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => {
              onApply(chosen);
              onClose();
            }}
            className="mari-chrome-control mari-chrome-control--primary mari-chrome-control--small text-xs"
          >
            {t("ui.rulesets.sheet.refreshApply")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
