// The fight screen's own controls in the top bar while a fight on a board is up: which round it is,
// and the two toggles that hide the log under the board and the combat pane beside it. The board
// takes whatever room either leaves.
import { PanelRight, ScrollText, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCombatScreenStore } from "../../stores/combat-screen.store";
import { cn } from "../../lib/utils";

const TOGGLE =
  "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]";

export function CombatTopbarControls() {
  const { t } = useTranslation();
  const round = useCombatScreenStore((state) => state.round);
  const logOpen = useCombatScreenStore((state) => state.logOpen);
  const paneOpen = useCombatScreenStore((state) => state.paneOpen);
  const toggleLog = useCombatScreenStore((state) => state.toggleLog);
  const togglePane = useCombatScreenStore((state) => state.togglePane);
  if (round === null) return null;
  return (
    <div data-component="TopBar.CombatControls" className="flex min-w-0 shrink-0 items-center gap-1">
      <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 text-xs font-semibold text-[var(--foreground)] max-sm:hidden">
        <Swords aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)]" />
        {t("game.combat.ruleset.screen.topbarRound", { round })}
      </span>
      <button
        type="button"
        aria-pressed={logOpen}
        onClick={toggleLog}
        className={cn(
          TOGGLE,
          logOpen
            ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.06]",
        )}
      >
        <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
        {t("game.combat.ruleset.screen.topbarLog")}
      </button>
      <button
        type="button"
        aria-pressed={paneOpen}
        aria-label={t("game.combat.ruleset.screen.topbarPane")}
        title={t("game.combat.ruleset.screen.topbarPane")}
        onClick={togglePane}
        className={cn(
          TOGGLE,
          // A phone shows the pane as a tab of its own, so the toggle is for wider screens only.
          "max-md:hidden",
          paneOpen
            ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.06]",
        )}
      >
        <PanelRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
