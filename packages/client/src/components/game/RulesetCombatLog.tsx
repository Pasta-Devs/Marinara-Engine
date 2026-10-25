// The log of a fight on a board, under the board: newest first, each round named once in a column of
// its own, names in their side's colour and the arithmetic of every roll in a chip. The sentences are
// the plain log's own (`rulesetCombatEventLine`); only how they are drawn is new.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DirectedRulesetView, RulesetDefinition } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { rulesetRichLogLines, rulesetWindowLineSeq, type RulesetLogPiece } from "../../lib/ruleset-combat-log-rich";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";

const PIECE_CLASS: Record<RulesetLogPiece["kind"], string> = {
  text: "",
  party: "font-semibold text-sky-700 dark:text-[#9dbdff]",
  enemy: "font-semibold text-rose-700 dark:text-[#ff9aaa]",
  roll: "mx-0.5 inline-block rounded border border-[var(--border)] bg-[var(--foreground)]/[0.06] px-1 py-px font-mono text-[0.92em] text-[var(--foreground)]",
  mono: "font-mono text-[var(--foreground)]",
  good: "font-semibold text-emerald-700 dark:text-emerald-400",
  bad: "font-semibold text-rose-700 dark:text-[#ff9aaa]",
};

export function RulesetCombatLog({
  definition,
  view,
  className,
}: {
  definition: RulesetDefinition;
  view: DirectedRulesetView;
  className?: string;
}) {
  const { t } = useTranslation();
  // With Debug on, the Engine's reason for each of its AI's steps follows the step.
  const debugMode = useUIStore((state) => state.debugMode);
  // Built fresh from the events on every view, as the plain log is, so a fight read back or a
  // language changed mid-battle prints in the language on screen now.
  const lines = useMemo(() => rulesetRichLogLines(definition, view, t, debugMode), [definition, view, t, debugMode]);
  const newestFirst = useMemo(() => [...lines].reverse(), [lines]);
  const asking = rulesetWindowLineSeq(view);
  const box = useRef<HTMLDivElement>(null);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const newest = lines.at(-1)?.seq;
  useEffect(() => {
    // The box's own scroll, back to the top where the newest line is; never the page's.
    if (box.current) box.current.scrollTop = 0;
  }, [newest]);

  return (
    <section
      aria-label={t("game.combat.ruleset.log.title")}
      data-game-section="ruleset-log"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <h3 className="text-sm font-bold">{t("game.combat.ruleset.log.title")}</h3>
        <span className="text-[0.65rem] text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.screen.newestFirst")}
        </span>
        <span className="flex-1" />
        {view.adjustments.length > 0 && (
          <button
            type="button"
            aria-expanded={adjustmentsOpen}
            onClick={() => setAdjustmentsOpen((open) => !open)}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            {t("game.combat.ruleset.screen.adjustments", { count: view.adjustments.length })}
          </button>
        )}
      </header>
      <div ref={box} className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5">
        {/* Shown in the log's own scroll box, so a short log card never cuts the list off. */}
        {adjustmentsOpen && view.adjustments.length > 0 && (
          <ul className="m-0 mb-1.5 list-none space-y-1 rounded-md border border-[var(--border)] p-2 text-xs text-[var(--muted-foreground)]">
            {view.adjustments.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <ol aria-live="polite" className="m-0 list-none p-0 text-[0.78rem] leading-relaxed">
          {newestFirst.map((line, index) => {
            // A round is named once, at the top of its own block: its newest line. Each turn inside
            // it is a block of its own under its taker's name, so "what did they just do" reads as one.
            const newer = newestFirst[index - 1];
            const firstOfRound = line.round > 0 && newer?.round !== line.round;
            const firstOfTurn = !!line.turnOf && (firstOfRound || newer?.turnOf !== line.turnOf);
            const taker = firstOfTurn ? view.combatants.find((one) => one.id === line.turnOf)?.name : undefined;
            return (
              <li
                key={line.seq}
                className={cn(
                  "grid grid-cols-[4.25rem_minmax(0,1fr)] gap-2 rounded px-1 py-0.5",
                  line.seq === asking && "bg-amber-400/15",
                  index > 0 && firstOfTurn && "mt-1 border-t border-[var(--border)] pt-1",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex flex-col pt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300"
                >
                  {firstOfRound ? t("game.combat.ruleset.status.round", { round: line.round }) : ""}
                  {taker && (
                    <span className="truncate font-semibold normal-case tracking-normal text-[var(--muted-foreground)]">
                      {taker}
                    </span>
                  )}
                </span>
                <span
                  data-log-reason={line.reason ? "" : undefined}
                  className={cn("min-w-0 text-[var(--muted-foreground)]", line.reason && "pl-3 text-[0.92em] italic")}
                >
                  {line.pieces.map((piece, n) => (
                    <span key={n} className={PIECE_CLASS[piece.kind]}>
                      {piece.text}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
