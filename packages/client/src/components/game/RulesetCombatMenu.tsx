// The menu of a fight the ruleset resolves: what the actor on turn may do, who they may do it to,
// and which pool pays for it.
//
// Every option on screen came off the server's own legal menu, with its own label, its own costs,
// its own forecast and the exact ids it may be pointed at. Nothing here works out whether something
// is allowed, what it would cost or how likely it is to land: an option the rules do not allow is
// simply not sent, so nothing is ever greyed out by this file.
//
// On a board, a step that picks a cell (walking, or aiming a shape) is drawn by the board rather
// than listed here, so the half-made choice is HELD by the board and handed back down: one step,
// two ways of finishing it, and the same pure rules behind both.
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { RULESET_PASS_OPTION } from "@marinara-engine/shared";
import type { DirectedRulesetOption, DirectedRulesetView, RulesetCombatCell } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { rulesetOptionHasAim, rulesetOptionNeedsAim, rulesetOptionNeedsCell } from "../../lib/ruleset-combat-board";
import {
  rulesetDefaultTargets,
  rulesetMenuGroups,
  rulesetOptionCostText,
  rulesetOptionForecastText,
  rulesetOptionLabel,
  rulesetOptionNeedsTargets,
  rulesetPickTarget,
  rulesetSendsOnPick,
  type RulesetMenuStep,
} from "../../lib/ruleset-combat-menu";
import { cn } from "../../lib/utils";

export interface RulesetCombatMenuProps {
  view: DirectedRulesetView;
  /** The ruleset's own name for a budget id, so the menu says "Bonus action" or "Action" as the
   *  file does, never a word this Engine picked. */
  budgetLabel: (id: string) => string;
  busy: boolean;
  onChoose: (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    /** Where a walk goes, and where a shape is aimed. Only a positioned fight ever sends one. */
    cell?: { to?: RulesetCombatCell; at?: RulesetCombatCell },
  ) => void;
  /** Walking away. The ruleset's menu never carries it, because leaving is not a thing the rules
   *  resolve: it is the director ending the session, exactly as the other two styles end it. */
  onFlee: () => void;
  /** The half-made choice, when a board is holding it. Without both of these the menu keeps its
   *  own, which is what the fight with no board does. */
  step?: RulesetMenuStep | null;
  onStepChange?: (step: RulesetMenuStep | null) => void;
  /** The board's handle on this menu, so Escape from a cell can put the keyboard back here. */
  menuRef?: RefObject<HTMLDivElement | null>;
}

const buttonClass =
  "min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50";

export function RulesetCombatMenu({
  view,
  budgetLabel,
  busy,
  onChoose,
  onFlee,
  step: heldStep,
  onStepChange,
  menuRef,
}: RulesetCombatMenuProps) {
  const { t } = useTranslation();
  const [ownStep, setOwnStep] = useState<RulesetMenuStep | null>(null);
  // Held by the owner only when it passes BOTH halves (`step` may be null, never left out): with one
  // of them missing the menu keeps its own, or a pick would be handed up and never come back down.
  const held = onStepChange !== undefined && heldStep !== undefined;
  const step = held ? heldStep : ownStep;
  // Stable whatever the owner passes, so the turn reset below runs when the turn moves and never
  // because a parent handed down a fresh function.
  const stepChange = useRef(held ? onStepChange : undefined);
  stepChange.current = held ? onStepChange : undefined;
  const setStep = useCallback((next: RulesetMenuStep | null) => {
    if (stepChange.current) stepChange.current(next);
    else setOwnStep(next);
  }, []);
  const first = useRef<HTMLButtonElement>(null);
  const ownRoot = useRef<HTMLDivElement>(null);
  const root = menuRef ?? ownRoot;
  const distance = view.grid?.distance;
  const nameOf = (id: string | undefined) => view.combatants.find((combatant) => combatant.id === id)?.name ?? "";
  const actorName = nameOf(view.actorId);
  // While a window holds the fight open the menu below is the ASKED combatant's, not the actor's,
  // so everything that says whose menu this is says theirs.
  const askedName = view.window ? nameOf(view.window.actorId) : actorName;
  const groups = useMemo(() => rulesetMenuGroups(view.options), [view.options]);
  // A fresh menu is a fresh choice: the turn moved on, so a half-finished pick from the last one
  // must never be sent against it.
  useEffect(() => {
    setStep(null);
  }, [view.actorId, view.round, view.window?.id, setStep]);
  // Focus follows a NEW stage or a new option, never every pick: choosing the second of three
  // targets replaces `step`, and pulling focus back to the first button each time would take the
  // keyboard away from somebody working down the list.
  const stepStage = step?.stage;
  const stepOption = step?.option.id;
  // Set by the player's own way out of a step (Back, or a choice that was sent), never by the turn
  // moving on underneath an open step.
  const playerClosedStep = useRef(false);
  const closeStep = () => {
    // Only when there IS a step to leave: a choice sent straight off the menu closes nothing, and a
    // flag left standing would be spent on the next turn reset instead.
    playerClosedStep.current = step !== null;
    setStep(null);
  };
  useEffect(() => {
    // A step the BOARD draws has its keyboard on the board, so the menu must not take it back the
    // moment the stage opens.
    if (stepStage === "pay" || stepStage === "target") first.current?.focus();
    // Going BACK unmounts the step, and the browser would drop focus on the body, leaving a keyboard
    // player to Tab down from the top of the page. The menu takes it instead, and only then: a
    // menu that appears, or is reset because the turn moved on, must not steal focus from wherever
    // the player is.
    else if (!stepStage && playerClosedStep.current) root.current?.focus();
    playerClosedStep.current = false;
  }, [stepStage, stepOption, root]);

  if (!view.options) {
    return (
      <p className="px-3 py-2 text-xs text-white/55" role="status">
        {actorName
          ? t("game.combat.ruleset.menu.waiting", { name: actorName })
          : t("game.combat.ruleset.menu.waitingAnybody")}
      </p>
    );
  }

  const send = (option: DirectedRulesetOption, targets: string[], payWith?: string) => {
    closeStep();
    onChoose(option.id, targets, payWith);
  };
  /** Which picking step this option opens, or null for one that is simply sent. On a board, a walk
   *  and a shape are picked on the board; everything else is the list below. */
  const stageFor = (option: DirectedRulesetOption): RulesetMenuStep["stage"] | null => {
    if (view.grid && rulesetOptionNeedsCell(option)) return "move";
    if (view.grid && rulesetOptionNeedsAim(option)) return "aim";
    return rulesetOptionNeedsTargets(option) ? "target" : null;
  };
  const take = (option: DirectedRulesetOption) => {
    if (option.payWith && option.payWith.length > 0) {
      setStep({ stage: "pay", option, targets: [] });
      return;
    }
    const stage = stageFor(option);
    if (stage) {
      setStep({ stage, option, targets: [] });
      return;
    }
    send(option, rulesetDefaultTargets(option));
  };
  const paid = (payWith?: string) => {
    if (!step) return;
    const stage = stageFor(step.option);
    if (!stage) {
      send(step.option, rulesetDefaultTargets(step.option), payWith);
      return;
    }
    setStep({ ...step, stage, ...(payWith ? { payWith } : {}), targets: [] });
  };
  const pick = (id: string) => {
    if (!step) return;
    const targets = rulesetPickTarget(step.option, step.targets, id);
    if (rulesetSendsOnPick(step.option) && targets.length === 1) {
      send(step.option, targets, step.payWith);
      return;
    }
    setStep({ ...step, targets });
  };

  // ── Paying for it out of another pool of the family ──
  const pools = step?.stage === "pay" ? (step.option.payWith ?? []) : [];
  if (step && pools.length > 0) {
    const option = step.option;
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-white/60">
          {t("game.combat.ruleset.upcast.prompt", { label: rulesetOptionLabel(option, t) })}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={first}
            type="button"
            disabled={busy}
            onClick={() => paid(undefined)}
            className={cn(buttonClass, "border-white/15 bg-white/5 text-white/85 hover:bg-white/10")}
          >
            {t("game.combat.ruleset.upcast.own", { cost: rulesetOptionCostText(option, budgetLabel, t, distance) })}
          </button>
          {pools.map((pool) => (
            <button
              key={pool}
              type="button"
              disabled={busy}
              onClick={() => paid(pool)}
              className={cn(buttonClass, "border-blue-400/25 bg-blue-500/10 text-white/85 hover:bg-blue-500/20")}
            >
              {t("game.combat.ruleset.upcast.pool", { pool })}
            </button>
          ))}
        </div>
        <BackButton onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
      </div>
    );
  }

  // ── Picking it on the board ──
  // The cells are the board's to draw and the board's to finish; this is the prompt and the way
  // out, in the place the option was chosen from, so a player who changed their mind is not
  // hunting for it on the grid.
  if (step?.stage === "move" || step?.stage === "aim") {
    const option = step.option;
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-amber-200">
          {t(
            step.stage === "move"
              ? "game.combat.ruleset.board.movePrompt"
              : rulesetOptionHasAim(option)
                ? "game.combat.ruleset.board.aimPrompt"
                : "game.combat.ruleset.board.aimNobody",
            { label: rulesetOptionLabel(option, t), name: actorName },
          )}
        </p>
        <BackButton onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
      </div>
    );
  }

  // ── Pointing it at somebody ──
  if (step?.stage === "target" && rulesetOptionNeedsTargets(step.option)) {
    const option = step.option;
    const many = option.targets.count > 1;
    const targets = view.combatants.filter((combatant) => option.targetIds.includes(combatant.id));
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-xs text-amber-200" id="ruleset-target-prompt">
          {many
            ? t("game.combat.ruleset.target.promptMany", {
                label: rulesetOptionLabel(option, t),
                count: option.targets.count,
              })
            : t("game.combat.ruleset.target.prompt", { label: rulesetOptionLabel(option, t) })}
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-target-prompt">
          {targets.map((combatant, index) => {
            const picked = step.targets.includes(combatant.id);
            return (
              <button
                ref={index === 0 ? first : undefined}
                key={combatant.id}
                type="button"
                disabled={busy}
                aria-pressed={many ? picked : undefined}
                onClick={() => pick(combatant.id)}
                className={cn(
                  buttonClass,
                  picked
                    ? "border-[var(--primary)]/60 bg-[var(--primary)]/25 text-white"
                    : combatant.side === "enemy"
                      ? "border-amber-400/30 bg-amber-500/10 text-white/85 hover:bg-amber-500/20"
                      : "border-blue-400/30 bg-blue-500/10 text-white/85 hover:bg-blue-500/20",
                )}
              >
                <span className="block font-semibold">{combatant.name}</span>
                <span className="mt-0.5 block text-[0.65rem] tabular-nums text-white/55">
                  {t("game.combat.ruleset.status.health", {
                    value: combatant.health.value,
                    max: combatant.health.max,
                  })}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {many && (
            <button
              type="button"
              disabled={busy || step.targets.length === 0}
              onClick={() => send(option, step.targets, step.payWith)}
              className={cn(buttonClass, "border-[var(--primary)]/50 bg-[var(--primary)]/20 text-white")}
            >
              {t("game.combat.ruleset.target.confirm", { count: step.targets.length })}
            </button>
          )}
          <BackButton onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      </div>
    );
  }

  // ── The menu itself ──
  // The shell's bottom panel takes whatever height its content asks for, so a menu stacked group
  // under group would take the stage's room and leave the two sides drawn over each other (or, on
  // a phone, leave no stage at all). The groups sit side by side, and a long list (a caster's)
  // scrolls inside its own bound.
  return (
    <div
      ref={root}
      tabIndex={-1}
      className="flex max-h-[24svh] flex-col gap-2 overflow-y-auto px-3 py-2 outline-none sm:max-h-[34svh] sm:p-3"
    >
      {/* A phone's shell already says whose turn it is right above this, and has no height to say
          it twice; the group names go the same way there and the buttons wrap as one run. */}
      {/* A window is somebody else's moment inside this turn, so it is said on every width: on a
          phone the shell above still names the actor, and the two would otherwise contradict. */}
      {view.window ? (
        <p className="text-[0.65rem] uppercase tracking-wide text-[var(--primary)]">
          {view.window.kind === "signature"
            ? t("game.combat.ruleset.menu.windowBetween", { name: askedName })
            : t("game.combat.ruleset.menu.windowLeaving", { name: askedName, mover: nameOf(view.window.moverId) })}
        </p>
      ) : (
        <p className="hidden text-[0.65rem] uppercase tracking-wide text-white/45 sm:block">
          {t("game.combat.ruleset.menu.title", { name: actorName })}
        </p>
      )}
      <div className="flex flex-row flex-wrap items-start gap-2 sm:gap-x-6 sm:gap-y-3">
        {groups.map((group) => (
          <section
            key={group.kind}
            aria-label={t(group.labelKey)}
            className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-1.5"
          >
            <h4 className="hidden text-[0.6rem] font-semibold uppercase tracking-wide text-white/40 sm:block">
              {t(group.labelKey)}
            </h4>
            <div className="contents sm:flex sm:flex-wrap sm:gap-2">
              {group.options.map((option) => {
                const cost = rulesetOptionCostText(option, budgetLabel, t, distance);
                const forecast = rulesetOptionForecastText(option, t);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    onClick={() => take(option)}
                    className={cn(
                      buttonClass,
                      "border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="block font-semibold text-white/90">{rulesetOptionLabel(option, t)}</span>
                    {cost && <span className="mt-0.5 block text-[0.65rem] text-white/45">{cost}</span>}
                    {forecast && <span className="block text-[0.65rem] text-white/45">{forecast}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        <div className="flex flex-wrap gap-2 self-end">
          {view.window && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                closeStep();
                onChoose(RULESET_PASS_OPTION, []);
              }}
              className={cn(
                buttonClass,
                "border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
              )}
            >
              {t("game.combat.ruleset.menu.pass")}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onFlee}
            className={cn(buttonClass, "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white")}
          >
            {t("game.combat.ruleset.menu.flee")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded border border-white/15 px-3 text-xs text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
    >
      {label}
    </button>
  );
}
