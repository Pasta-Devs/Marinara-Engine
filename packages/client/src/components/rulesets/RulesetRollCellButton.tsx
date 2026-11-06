import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { DiceRollResult } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";

/** One throw of a rolled cell's dice with the Engine's own dice, its total. */
export async function rollRulesetCell(notation: string): Promise<number> {
  const { result } = await api.post<{ result: DiceRollResult }>("/game/dice/roll", { notation });
  return result.total;
}

/** A rolled list cell's button (Capability API 1.85): the Engine's own dice, so the number is thrown,
 *  not typed. Disabled while the row does not say what to throw (its die is not picked yet). */
export function RollCellButton({
  notation,
  ariaLabel,
  onRolled,
}: {
  notation: string | null;
  /** The cell it fills, which its accessible name says. */
  ariaLabel: string;
  onRolled: (total: number) => void;
}) {
  const { t } = useUiTranslation();
  const [rolling, setRolling] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={!notation || rolling}
        onClick={async () => {
          if (!notation) return;
          setRolling(true);
          setFailed(false);
          try {
            onRolled(await rollRulesetCell(notation));
          } catch {
            // Nothing is written when the roll did not happen, and the button says so.
            setFailed(true);
          } finally {
            setRolling(false);
          }
        }}
        aria-label={
          notation
            ? t("ui.rulesets.sheet.rollCell", { cell: ariaLabel, notation })
            : t("ui.rulesets.sheet.rollNeedsDieFor", { cell: ariaLabel })
        }
        className="self-start rounded-lg border border-[var(--border)] px-2 py-0.5 text-[0.6875rem] text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
      >
        {notation ? t("ui.rulesets.sheet.roll", { notation }) : t("ui.rulesets.sheet.rollNeedsDie")}
      </button>
      {failed && (
        <span role="status" className="text-[0.625rem] text-[var(--marinara-app-accent-static)]">
          {t("ui.rulesets.sheet.rollFailed")}
        </span>
      )}
    </>
  );
}
