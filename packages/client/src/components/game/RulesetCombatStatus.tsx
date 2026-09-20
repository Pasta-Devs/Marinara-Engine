// Where a ruleset fight stands, and what has happened in it so far.
//
// Turn order, the round, every combatant's conditions in the ruleset's own words, what is left of
// each budget for the actor on turn, and the log with the real arithmetic in it. Every number here
// was sent by the server; this file reads the view and prints it.
import type { DirectedRulesetView, RulesetDefinition } from "@marinara-engine/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { rulesetCombatLogLines, rulesetCombatNames } from "../../lib/ruleset-combat-log";
import { rulesetDistanceText } from "../../lib/ruleset-combat-board";
import { cn } from "../../lib/utils";

export function RulesetCombatStatus({
  definition,
  view,
}: {
  definition: RulesetDefinition;
  view: DirectedRulesetView;
}) {
  const { t } = useTranslation();
  const names = useMemo(() => rulesetCombatNames(definition, view, t), [definition, view, t]);
  // Built fresh on every render rather than accumulated, so a saved fight read back, or a language
  // changed mid-battle, prints in the language on screen now. The running number is the key, so a
  // re-render adds only the lines that are new and a reader is told only about those.
  const lines = rulesetCombatLogLines(view.events, names, t);
  const [orderOpen, setOrderOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 640px)").matches,
  );
  // Open by default wherever there is room. A window that GROWS past the breakpoint opens it too,
  // because the summary that would open it by hand is visually hidden there.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wide = window.matchMedia("(min-width: 640px)");
    const follow = (event: MediaQueryListEvent) => {
      if (event.matches) setOrderOpen(true);
    };
    wide.addEventListener("change", follow);
    return () => wide.removeEventListener("change", follow);
  }, []);
  const logBox = useRef<HTMLElement>(null);
  const newest = lines.at(-1)?.seq;
  useEffect(() => {
    // The box's own scroll position, never `scrollIntoView`, which would move the page under a
    // player who is reading the menu.
    const box = logBox.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [newest]);
  const byId = new Map(view.combatants.map((combatant) => [combatant.id, combatant]));
  const order = view.order.flatMap((id) => {
    const combatant = byId.get(id);
    return combatant ? [combatant] : [];
  });
  const budgets = definition.combat?.economy.budgets ?? [];
  const actor = view.actorId ? byId.get(view.actorId) : undefined;

  // On a wide screen who is who sits beside the log instead of above it: the strip is then one row
  // tall, and the stage above keeps the height its two rows of portraits need.
  return (
    <div className="mt-1 space-y-1 sm:mt-2 sm:space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4 lg:space-y-0">
      {/* One wrapping row: the round, what the actor has left, and the fold. Folded, the fold sits
          on that same line; open, it takes the next one to itself. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:gap-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">
            {t("game.combat.ruleset.status.round", { round: view.round })}
          </span>
          {actor &&
            budgets.map((budget) => (
              <span key={budget.id}>
                {t("game.combat.ruleset.status.budget", {
                  label: budget.label,
                  left: actor.budgets[budget.id] ?? 0,
                })}
              </span>
            ))}
          {/* What is left of this turn's walking, in the ruleset's own unit. Only a fight on a
              board has any, and then everybody on it does. */}
          {actor && typeof actor.movementLeft === "number" && (
            <span>
              {t("game.combat.ruleset.status.movement", {
                amount: rulesetDistanceText(actor.movementLeft, view.grid?.distance, t),
              })}
            </span>
          )}
        </div>

        {/* Folded away on a phone, where the stage already shows both sides and every row this strip
            takes is a row the stage loses; one tap opens it. Open from the start anywhere wider. */}
        <details
          open={orderOpen}
          onToggle={(event) => setOrderOpen(event.currentTarget.open)}
          className="min-w-0 open:basis-full sm:basis-full"
        >
          <summary className="cursor-pointer text-xs text-[var(--muted-foreground)] sm:sr-only">
            {t("game.combat.ruleset.status.order")}
          </summary>
          <ol
            aria-label={t("game.combat.ruleset.status.order")}
            className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
          >
            {order.map((combatant) => {
              const onTurn = combatant.id === view.actorId;
              const deathTrack = combatant.deathTrack;
              const conditions = combatant.conditions.map((condition) =>
                typeof condition.rounds === "number"
                  ? t("game.combat.ruleset.status.conditionRounds", {
                      label: condition.label,
                      rounds: condition.rounds,
                    })
                  : condition.label,
              );
              const state = combatant.defeated
                ? t("game.combat.ruleset.status.defeated")
                : combatant.stable
                  ? t("game.combat.ruleset.status.stable")
                  : combatant.dying
                    ? t("game.combat.ruleset.status.dying")
                    : combatant.down
                      ? t("game.combat.ruleset.status.down")
                      : "";
              return (
                <li
                  key={combatant.id}
                  aria-current={onTurn ? "step" : undefined}
                  className={cn(
                    "min-w-[9rem] shrink-0 rounded-lg border px-2 py-1.5 text-xs sm:flex-1 sm:shrink",
                    onTurn
                      ? "border-[var(--primary)]/50 bg-[var(--primary)]/10"
                      : "border-[var(--border)] bg-[var(--secondary)]",
                  )}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-[var(--foreground)]">{combatant.name}</span>
                    <span className="tabular-nums text-[var(--muted-foreground)]">
                      {t("game.combat.ruleset.status.health", {
                        value: combatant.health.value,
                        max: combatant.health.max,
                      })}
                    </span>
                    {combatant.health.temp > 0 && (
                      <span className="text-[var(--muted-foreground)]">
                        {t("game.combat.ruleset.status.temp", { amount: combatant.health.temp })}
                      </span>
                    )}
                    <span className="text-[var(--muted-foreground)]">
                      {t("game.combat.ruleset.status.defense", {
                        label: names.defense || t("game.combat.ruleset.status.defenseFallback"),
                        value: combatant.defense,
                      })}
                    </span>
                    {onTurn && <span className="text-[var(--primary)]">{t("game.combat.ruleset.status.turn")}</span>}
                  </span>
                  {(state || conditions.length > 0 || combatant.concentrating) && (
                    <span className="mt-0.5 block text-[0.65rem] text-[var(--muted-foreground)]">
                      {[
                        state,
                        ...conditions,
                        combatant.concentrating
                          ? t("game.combat.ruleset.status.concentrating", { label: combatant.concentrating })
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {deathTrack && (
                    <span className="mt-0.5 block text-[0.65rem] tabular-nums text-[var(--muted-foreground)]">
                      {t("game.combat.ruleset.status.deathTrack", {
                        successes: names.track(definition.combat?.dying?.successes ?? ""),
                        successesValue: deathTrack.successes,
                        successesMax: deathTrack.successesMax,
                        failures: names.track(definition.combat?.dying?.failures ?? ""),
                        failuresValue: deathTrack.failures,
                        failuresMax: deathTrack.failuresMax,
                      })}
                    </span>
                  )}
                  {(!!combatant.tier || (combatant.traits?.length ?? 0) > 0) && (
                    <details className="mt-0.5">
                      <summary className="cursor-pointer text-[0.65rem] text-[var(--muted-foreground)]">
                        {t("game.combat.ruleset.status.details")}
                      </summary>
                      <div className="mt-1 space-y-1 text-[0.65rem] text-[var(--muted-foreground)]">
                        {combatant.tier && (
                          <p>{t("game.combat.ruleset.status.tier", { label: names.tier(combatant.tier) })}</p>
                        )}
                        {(combatant.traits ?? []).map((trait) => (
                          <p key={trait.name}>
                            <span className="font-medium text-[var(--foreground)]">{trait.name}</span> {trait.text}
                          </p>
                        ))}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        </details>

        {view.adjustments.length > 0 && (
          <details>
            <summary className="cursor-pointer py-1 text-xs">{t("game.combat.ruleset.status.adjustments")}</summary>
            <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted-foreground)]">
              {view.adjustments.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Its own scroll box, kept at the newest line: a log that grew with the fight would take the
          stage's room, and the two sides would end up drawn over each other. */}
      <section
        ref={logBox}
        aria-label={t("game.combat.ruleset.log.title")}
        className={cn(
          "min-w-0 overflow-y-auto pr-1",
          // Once it is over the shell puts its own outcome panel on the stage, and that needs the
          // room more than the last lines do.
          view.summary ? "max-h-[7svh]" : "max-h-[7svh] sm:max-h-[11svh] lg:max-h-[14svh]",
        )}
      >
        <ol aria-live="polite" className="space-y-1 text-xs text-[var(--muted-foreground)]">
          {lines.map((line) => (
            <li key={line.seq}>{line.text}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
