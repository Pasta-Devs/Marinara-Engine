import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

const SPEND_CHOICE_KEY = "marinara.combat.chooseSpends";

/** Whether this browser's player last chose to pick their own symbol spends (1.382). */
export function readSpendChoice(): boolean {
  try {
    return window.localStorage.getItem(SPEND_CHOICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSpendChoice(choose: boolean): void {
  try {
    if (choose) window.localStorage.setItem(SPEND_CHOICE_KEY, "1");
    else window.localStorage.removeItem(SPEND_CHOICE_KEY);
  } catch {
    // A browser that keeps nothing asks again next fight.
  }
}

/** The player picks what their own symbol throws buy (1.382), or leaves it to the Engine, which
 *  picks for everybody else either way. Shown only in a fight thrown in symbol dice. */
export function RulesetSpendToggle({
  choose,
  locked,
  onChange,
  className,
}: {
  choose: boolean;
  locked: boolean;
  onChange: (choose: boolean) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <label
      data-game-section="ruleset-spend-choice"
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2 text-xs text-[var(--foreground)] has-[:disabled]:cursor-default has-[:disabled]:opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={choose}
        disabled={locked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span>
        <span className="block font-medium">{t("game.combat.ruleset.spends.choose")}</span>
        <span className="block text-[0.66rem] text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.spends.chooseHint")}
        </span>
      </span>
    </label>
  );
}
