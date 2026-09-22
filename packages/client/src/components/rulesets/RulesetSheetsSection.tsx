// The "Ruleset sheets" block of the character and persona Stats tabs: one collapsible sheet per
// installed Game Mode ruleset, plus a removable line for every stored sheet whose ruleset is not
// installed. Such a sheet is kept dormant under its key, never dropped and never shown to a prompt.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  createRulesetSheetEnvelope,
  rulesetSheetEnvelopeSchema,
  RULESET_SHEET_MAX_BYTES,
  RULESET_SHEETS_MAX,
  type RulesetSheetEnvelope,
} from "@marinara-engine/shared";
import { useInstalledRulesets } from "../../hooks/use-capability-packages";
import { RulesetSheetEditor } from "./RulesetSheetEditor";

type StoredSheets = Record<string, unknown>;

function sheetBytes(sheet: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(sheet)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function RulesetSheetsSection({
  sheets,
  onChange,
}: {
  sheets: StoredSheets | undefined;
  onChange: (sheets: StoredSheets | undefined) => void;
}) {
  const { t } = useUiTranslation();
  const installed = useInstalledRulesets();
  // The ruleset whose last edit was refused for size, so its entry can say so.
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const stored = sheets && typeof sheets === "object" && !Array.isArray(sheets) ? sheets : {};
  const rulesets = installed.data ?? [];
  const installedIds = new Set(rulesets.map((entry) => entry.definition.id));
  // Until the list has loaded, nothing is known to be missing, so nothing is called dormant.
  const dormantIds = installed.isSuccess ? Object.keys(stored).filter((id) => !installedIds.has(id)) : [];

  // A failed load says nothing about what is installed. Stored sheets are left exactly as they
  // are, and the block says why it cannot be edited rather than silently disappearing.
  if (installed.isError) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("ui.rulesets.sheets.title")}</h3>
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {t("ui.rulesets.sheets.loadFailed")}
        </p>
      </div>
    );
  }
  if (rulesets.length === 0 && dormantIds.length === 0) return null;

  // One card or persona holds a bounded number of sheets, dormant ones included. A new sheet past
  // the limit would make the whole save fail, so the button is off until one is removed.
  const atSheetLimit = Object.keys(stored).length >= RULESET_SHEETS_MAX;

  const setSheet = (id: string, sheet: RulesetSheetEnvelope | undefined) => {
    // The save boundary refuses an oversized sheet, and that refusal fails the whole character or
    // persona save. So an edit that would leave the sheet over the limit is not applied, unless it
    // makes an already oversized sheet smaller, which is how such a sheet gets repaired.
    if (sheet) {
      const nextBytes = sheetBytes(sheet);
      const previousBytes = Object.hasOwn(stored, id) ? sheetBytes(stored[id]) : 0;
      if (nextBytes > RULESET_SHEET_MAX_BYTES && nextBytes >= previousBytes) {
        setRefusedId(id);
        return;
      }
    }
    setRefusedId(null);
    const { [id]: _previous, ...rest } = stored;
    const next = sheet ? { ...rest, [id]: sheet } : rest;
    onChange(Object.keys(next).length > 0 ? next : undefined);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("ui.rulesets.sheets.title")}</h3>
        <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.sheets.description")}</p>
      </div>

      {rulesets.map(({ definition }) => {
        const parsed = rulesetSheetEnvelopeSchema.safeParse(stored[definition.id]);
        const envelope = parsed.success ? parsed.data : undefined;
        // A stored value this editor cannot read (another Engine version, a hand edit) is kept as
        // it is. Offering "Add a sheet" here would overwrite it, so the only action is Remove.
        const unreadable = !envelope && Object.hasOwn(stored, definition.id);
        const tooLarge = envelope ? sheetBytes(envelope) > RULESET_SHEET_MAX_BYTES : false;
        return (
          <details key={definition.id} className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-[var(--foreground)]">
              <span className="min-w-0 truncate">{definition.name}</span>
              <span className="shrink-0 text-[0.6875rem] font-normal text-[var(--muted-foreground)]">
                {envelope
                  ? t("ui.rulesets.sheets.hasSheet")
                  : unreadable
                    ? t("ui.rulesets.sheets.unreadable")
                    : t("ui.rulesets.sheets.noSheet")}
              </span>
            </summary>
            <div className="space-y-3 border-t border-[var(--border)] p-3">
              {envelope ? (
                <>
                  {tooLarge && (
                    <p role="alert" className="text-xs text-[var(--destructive)]">
                      {t("ui.rulesets.sheets.tooLarge", { limit: Math.floor(RULESET_SHEET_MAX_BYTES / 1024) })}
                    </p>
                  )}
                  {refusedId === definition.id && (
                    <p role="alert" className="text-xs text-[var(--destructive)]">
                      {t("ui.rulesets.sheets.changeRefused", { limit: Math.floor(RULESET_SHEET_MAX_BYTES / 1024) })}
                    </p>
                  )}
                  <RulesetSheetEditor
                    definition={definition}
                    envelope={envelope}
                    onChange={(next) => setSheet(definition.id, next)}
                  />
                  <button
                    type="button"
                    onClick={() => setSheet(definition.id, undefined)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--destructive)] hover:bg-[var(--accent)]"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    {t("ui.rulesets.sheets.removeSheet")}
                  </button>
                </>
              ) : unreadable ? (
                <>
                  <p className="text-xs text-[var(--muted-foreground)]">{t("ui.rulesets.sheets.unreadableHint")}</p>
                  <button
                    type="button"
                    onClick={() => setSheet(definition.id, undefined)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--destructive)] hover:bg-[var(--accent)]"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    {t("ui.rulesets.sheets.removeSheet")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={atSheetLimit}
                    onClick={() => setSheet(definition.id, createRulesetSheetEnvelope(definition))}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("ui.rulesets.sheets.addSheet")}
                  </button>
                  {atSheetLimit && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("ui.rulesets.sheets.limitReached", { limit: RULESET_SHEETS_MAX })}
                    </p>
                  )}
                </>
              )}
            </div>
          </details>
        );
      })}

      {dormantIds.map((id) => (
        <div
          key={id}
          className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-2"
        >
          <span className="min-w-0 truncate text-xs text-[var(--muted-foreground)]">
            {t("ui.rulesets.sheets.dormant", { id })}
          </span>
          <button
            type="button"
            onClick={() => setSheet(id, undefined)}
            className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-[0.6875rem] text-[var(--destructive)] hover:bg-[var(--accent)]"
          >
            {t("ui.rulesets.sheets.remove")}
          </button>
        </div>
      ))}
    </div>
  );
}
