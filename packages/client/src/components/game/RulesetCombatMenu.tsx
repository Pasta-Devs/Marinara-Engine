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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { RULESET_CHARGE_STEP_PREFIX, RULESET_PASS_OPTION } from "@marinara-engine/shared";
import type { DirectedRulesetOption, DirectedRulesetView } from "@marinara-engine/shared";
import { ArtIcon } from "./ArtIcon";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  rulesetAimSoFar,
  rulesetDistanceText,
  rulesetAimTurning,
  type RulesetCellChoice,
  rulesetOptionHasAim,
  rulesetOptionNeedsAim,
  rulesetOptionNeedsCell,
} from "../../lib/ruleset-combat-board";
import {
  rulesetDefaultTargets,
  rulesetPicksStep,
  rulesetMenuGroups,
  rulesetMenuReadyName,
  rulesetOptionCostText,
  rulesetModeText,
  rulesetOptionForecastText,
  rulesetOptionLabel,
  rulesetOptionOutOfReach,
  rulesetOptionNeedsTargets,
  rulesetPickTarget,
  rulesetSendsOnPick,
  rulesetStyleForecastText,
  rulesetUpcastOwnText,
  rulesetUpcastPoolText,
  type RulesetMenuStep,
} from "../../lib/ruleset-combat-menu";
import { cn } from "../../lib/utils";
import { RulesetBudgetPip, type RulesetBudgetMark } from "./RulesetBudgetPip";
import { useMatchMedia } from "../../hooks/use-match-media";

export interface RulesetCombatMenuProps {
  view: DirectedRulesetView;
  /** The ruleset's own name for a budget id, so the menu says "Bonus action" or "Action" as the
   *  file does, never a word this Engine picked. */
  budgetLabel: (id: string) => string;
  /** What the ruleset calls the number an attack is rolled against ("Armor Class", "Guard"), so a
   *  held hit reads as the log does. Empty when the ruleset names none. */
  defenseLabel?: string;
  busy: boolean;
  onChoose: (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    /** Where a walk goes, and where a shape is aimed. Only a positioned fight ever sends one. */
    cell?: RulesetCellChoice,
    /** The initiative style an attack is made in, where initiative is a number attacks move. */
    style?: string,
    /** The weapon's mode an attack is made in. */
    mode?: string,
    /** How many uses it spends, where the option lets its user choose (1.251). */
    amount?: number,
    /** The alterations it is used with (1.253): Metamagic. */
    alters?: string[],
    /** Who of its user's side they spare (1.254): Careful Spell. */
    spares?: string[],
    /** Who they give disadvantage on their first save (1.255): Heightened Spell. */
    heightens?: string,
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
  /** "pane" draws it as the fight screen's option list: one dense row per option, each step opened
   *  under its row, ending a turn and leaving left to the pane's footer. "step" draws only the open
   *  step, for a phone's bar under the board. The default is the band under the stage the fight
   *  without a board has. */
  layout?: "strip" | "pane" | "step";
  /** The ruleset's budgets as pips, for the pane's cost column. */
  marks?: RulesetBudgetMark[];
}

/** The two ways of drawing the menu's words: on the dark stage of a fight without a board, and on
 *  the pane, which follows the app's theme. */
const STRIP_INK = {
  hoverBorder: "hover:border-white/25",
  hoverText: "hover:text-white",
  hover: "hover:bg-white/10",
  border: "border-white/15",
  fill: "bg-white/5",
  strong: "text-white/90",
  body: "text-white/85",
  muted: "text-white/60",
  faint: "text-white/45",
  ask: "text-amber-200",
};
const PANE_INK: typeof STRIP_INK = {
  hoverBorder: "hover:border-[var(--primary)]/40",
  hoverText: "hover:text-[var(--foreground)]",
  hover: "hover:bg-[var(--foreground)]/[0.06]",
  border: "border-[var(--border)]",
  fill: "bg-[var(--foreground)]/[0.03]",
  strong: "text-[var(--foreground)]",
  body: "text-[var(--foreground)]",
  muted: "text-[var(--muted-foreground)]",
  faint: "text-[var(--muted-foreground)]",
  ask: "text-amber-700 dark:text-amber-300",
};

const buttonClass =
  "min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50";

/** Which question the window is asking, by what opened it. A moment a reaction waits for names
 *  itself; the other two are the kind of window they are. */
const WINDOW_PROMPTS = {
  aimed: "Aimed",
  hit: "Hit",
  harmed: "Harmed",
  falls: "Falls",
  "turn-start": "TurnStart",
  used: "Used",
  signature: "Between",
  reaction: "Leaving",
  spend: "Spend",
} as const;

/** What the window holding the fight open is asking, in one sentence: "Mage uses Cone of Cold on
 *  Elara and Brom. Elara may answer." */
const TOUCH_PROMPTS = new Set([
  "game.combat.ruleset.board.aimPrompt",
  "game.combat.ruleset.board.movePrompt",
  "game.combat.ruleset.board.teleportLeavePrompt",
  "game.combat.ruleset.board.teleportPrompt",
]);

export function rulesetWindowPrompt(view: DirectedRulesetView, defenseLabel: string | undefined, t: TFunction): string {
  const window = view.window;
  if (!window) return "";
  const nameOf = (id: string | undefined) => view.combatants.find((combatant) => combatant.id === id)?.name ?? "";
  const asked = nameOf(window.actorId);
  // What rides on a held hit, so an answer that stops it is weighed against what it saves.
  const stakes =
    window.stakes !== undefined ? ` ${t("game.combat.ruleset.menu.windowStakes", { amount: window.stakes })}` : "";
  return `${t(
    `game.combat.ruleset.menu.window${window.targetIds?.some((id) => id !== window.actorId) && (window.moment === "aimed" || window.moment === "hit") ? "Bystander" : WINDOW_PROMPTS[window.moment ?? window.kind]}`,
    {
      name: asked,
      target: window.targetIds?.map(nameOf).join(", ") ?? asked,
      mover: nameOf(window.sourceId ?? window.moverId),
      label: window.label ?? "",
      total: window.total ?? "",
      defense:
        window.defense === undefined ? "" : defenseLabel ? `${defenseLabel} ${window.defense}` : String(window.defense),
    },
  )}${stakes}`;
}

/** Kinds the sidebar menu folds into a line of their own rather than listing: ending the turn is
 *  the footer's, and the standard actions and contests are the moves a turn takes least. */
const FOLDED_KINDS: ReadonlySet<string> = new Set(["end-turn", "standard", "contest"]);
export function RulesetCombatMenu({
  view,
  budgetLabel,
  defenseLabel,
  busy,
  onChoose,
  onFlee,
  step: heldStep,
  onStepChange,
  menuRef,
  layout = "strip",
  marks = [],
}: RulesetCombatMenuProps) {
  const { t } = useTranslation();
  const pane = layout !== "strip";
  // A pointer that cannot hover is a finger: no keyboard hints for it.
  const touch = useMatchMedia("(pointer: coarse)");
  const ink = pane ? PANE_INK : STRIP_INK;
  const [ownStep, setOwnStep] = useState<RulesetMenuStep | null>(null);
  // The number typed into the amount step (1.251), kept as text so a cleared box is not a zero.
  const [amountText, setAmountText] = useState("");
  // The alterations ticked in the alter step (1.253).
  const [altersPicked, setAltersPicked] = useState<string[]>([]);
  // Who of its user's side is ticked to be spared in the spare step (1.254).
  const [sparesPicked, setSparesPicked] = useState<string[]>([]);
  // Which folds the player opened. A step inside one holds it open; Back leaves it as the player had it.
  const [foldsOpen, setFoldsOpen] = useState<Record<string, boolean>>({});
  // Held by the owner only when it passes BOTH halves (`step` may be null, never left out): with one
  // of them missing the menu keeps its own, or a pick would be handed up and never come back down.
  const held = onStepChange !== undefined && heldStep !== undefined;
  const step = held ? heldStep : ownStep;
  // Opened here or on the board, the spare step starts with as many ticked as it spares, in order.
  const spareOpen = step?.stage === "spare" ? step.spare : undefined;
  useEffect(() => {
    if (spareOpen) setSparesPicked(spareOpen.ids.slice(0, spareOpen.most));
  }, [spareOpen]);
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
  // Letting a spend window go by keeps what was chosen and buys nothing more (1.382).
  const passKey = (otherwise: string) =>
    view.window?.kind === "spend" ? "game.combat.ruleset.menu.spendDone" : otherwise;
  const groups = useMemo(() => rulesetMenuGroups(view.options), [view.options]);
  // A pool by its own name where the fight sent it (the party's pools), else by its id.
  const poolOf = (id: string) =>
    view.combatants
      .find((combatant) => combatant.id === (view.window?.actorId ?? view.actorId))
      ?.pools?.find((pool) => pool.id === id);
  const poolLabel = (id: string) => poolOf(id)?.label ?? id;
  // A fresh menu is a fresh choice: the turn moved on, so a half-finished pick from the last one
  // must never be sent against it.
  // A menu that mounts while its owner holds a step (a phone moving the step to the bar under the
  // board) keeps it: only a turn that moves on clears it.
  const turnKey = `${view.actorId ?? ""}|${view.round}|${view.window?.id ?? ""}`;
  const lastTurn = useRef(turnKey);
  useEffect(() => {
    if (held && lastTurn.current === turnKey) return;
    lastTurn.current = turnKey;
    setStep(null);
  }, [turnKey, held, setStep]);
  // On the pane a question put to the player takes the keyboard to its first answer, and Escape lets
  // the moment go by, as the button under the answers says.
  const asked = pane && !!view.window && !!view.options;
  const answering = asked ? view.window?.id : undefined;
  useEffect(() => {
    if (answering) first.current?.focus();
  }, [answering]);
  const passRef = useRef<() => void>(() => {});
  passRef.current = () => {
    if (busy || !asked || step) return;
    onChoose(RULESET_PASS_OPTION, []);
  };
  useEffect(() => {
    if (!answering) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      passRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answering]);
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
    if (
      stepStage === "style" ||
      stepStage === "mode" ||
      stepStage === "alter" ||
      stepStage === "spare" ||
      stepStage === "heighten" ||
      stepStage === "pay" ||
      stepStage === "amount" ||
      stepStage === "target"
    ) {
      first.current?.focus();
    }
    // Going BACK unmounts the step, and the browser would drop focus on the body, leaving a keyboard
    // player to Tab down from the top of the page. The menu takes it instead, and only then: a
    // menu that appears, or is reset because the turn moved on, must not steal focus from wherever
    // the player is.
    else if (!stepStage && playerClosedStep.current) root.current?.focus();
    playerClosedStep.current = false;
  }, [stepStage, stepOption, root]);

  if (!view.options) {
    if (pane) {
      return (
        <p
          role="status"
          className="m-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]"
        >
          {actorName
            ? t("game.combat.ruleset.screen.takingTurn", { name: actorName })
            : t("game.combat.ruleset.menu.waitingAnybody")}
        </p>
      );
    }
    return (
      <p className={`px-3 py-2 text-xs ${ink.faint}`} role="status">
        {actorName
          ? t("game.combat.ruleset.menu.waiting", { name: actorName })
          : t("game.combat.ruleset.menu.waitingAnybody")}
      </p>
    );
  }

  const send = (
    option: DirectedRulesetOption,
    targets: string[],
    payWith?: string,
    style?: string,
    mode?: string,
    // A step that went through the amount carries it; one sent straight off the menu passes its own.
    amount: number | undefined = step?.amount,
    alters: string[] | undefined = step?.alters,
  ) => {
    if (picksFirst({ stage: "target", option, targets, payWith, style, mode, amount, alters })) return;
    closeStep();
    onChoose(option.id, targets, payWith, undefined, style, mode, amount, alters);
  };
  /** Who it spares and who it heightens are picked before it is sent, where there is a pick to make
   *  (1.254, 1.255). True when that step was opened. */
  const picksFirst = (held: RulesetMenuStep): boolean => {
    const next = rulesetPicksStep(view, held, held.targets, held.cell);
    if (!next) return false;
    setStep(next);
    return true;
  };
  /** Sent with what was picked for it. */
  const sendPicked = (held: RulesetMenuStep, heightens?: string) => {
    closeStep();
    onChoose(
      held.option.id,
      held.targets,
      held.payWith,
      held.cell,
      held.style,
      held.mode,
      held.amount,
      held.alters,
      held.spared,
      heightens,
    );
  };
  /** Which picking step this option opens, or null for one that is simply sent. On a board, a walk
   *  and a shape are picked on the board; everything else is the list below. */
  const stageFor = (option: DirectedRulesetOption): RulesetMenuStep["stage"] | null => {
    if (view.grid && rulesetOptionNeedsCell(option)) return "move";
    if (view.grid && rulesetOptionNeedsAim(option)) return "aim";
    return rulesetOptionNeedsTargets(option) ? "target" : null;
  };
  /** A readied action with only one foe it could ever be held for, aimed at one, is held for that
   *  one: there is nobody else to choose. Asked the same whether its budget or a pool pays. */
  const heldForOnlyFoe = (option: DirectedRulesetOption, stage: RulesetMenuStep["stage"] | null) =>
    stage === "target" && !!option.ready && option.targetIds.length === 1 && option.targets.count <= 1;
  /** The step after the style and the mode are chosen: what pays for it, where it goes, or who it is
   *  aimed at, as many as the mode aims at. */
  const afterMode = (
    option: DirectedRulesetOption,
    style?: string,
    mode?: string,
    amount?: number | null,
    /** null once the alter step was passed with none ticked (1.253). */
    alters?: string[] | null,
  ) => {
    const how = {
      ...(style ? { style } : {}),
      ...(mode ? { mode } : {}),
      ...(typeof amount === "number" ? { amount } : {}),
      ...(alters?.length ? { alters } : {}),
    };
    // What it may be used with comes first (1.253): Metamagic, which may give it another target.
    if (option.alters?.length && alters === undefined) {
      setAltersPicked(option.alterNeeded ? [option.alterNeeded] : []);
      setStep({ stage: "alter", option, ...how, targets: [] });
      return;
    }
    const chosen = mode ? option.modes?.find((entry) => entry.id === mode) : undefined;
    const moded = chosen ? { ...option, targets: { ...option.targets, count: chosen.targets } } : option;
    const twins = (alters ?? []).filter((id) => option.alters?.find((offer) => offer.id === id)?.twins).length;
    const aimed = twins ? { ...moded, targets: { ...moded.targets, count: moded.targets.count + twins } } : moded;
    // How much of it to spend comes first where its user chooses (1.251); null is "just enough",
    // which the rules work out from the target.
    if (aimed.amount && amount === undefined) {
      setAmountText(String(aimed.amount.max));
      // The option as it came, so going on from here aims it once, not twice.
      setStep({ stage: "amount", option, ...how, targets: [] });
      return;
    }
    if (aimed.payWith && aimed.payWith.length > 0) {
      setStep({ stage: "pay", option: aimed, ...how, targets: [] });
      return;
    }
    const stage = stageFor(aimed);
    if (heldForOnlyFoe(aimed, stage)) {
      send(aimed, aimed.targetIds, undefined, style, mode, how.amount, how.alters);
      return;
    }
    if (stage) {
      setStep({
        stage,
        option: aimed,
        ...how,
        targets: view.window?.moment === "falls" ? aimed.targetIds.slice(0, aimed.targets.count) : [],
      });
      return;
    }
    send(aimed, rulesetDefaultTargets(aimed), undefined, style, mode, how.amount, how.alters);
  };
  /** The step after the style is chosen: the weapon's mode, where it has any. */
  const afterStyle = (option: DirectedRulesetOption, style?: string) => {
    if (option.modes && option.modes.length > 0) {
      setStep({ stage: "mode", option, ...(style ? { style } : {}), targets: [] });
      return;
    }
    afterMode(option, style);
  };
  const take = (option: DirectedRulesetOption) => {
    // Where attacks move initiative, how the attack is made comes first: it decides what it does.
    if (option.styles && option.styles.length > 0) {
      setStep({ stage: "style", option, targets: [] });
      return;
    }
    afterStyle(option);
  };
  const paid = (payWith?: string) => {
    if (!step) return;
    // A pool that lets it take more targets aims at as many as it lets it (1.171).
    const count = payWith ? step.option.targetsWith?.[payWith] : undefined;
    const option = count !== undefined ? { ...step.option, targets: { ...step.option.targets, count } } : step.option;
    const stage = stageFor(option);
    if (!stage) {
      send(option, rulesetDefaultTargets(option), payWith, step.style, step.mode);
      return;
    }
    if (heldForOnlyFoe(option, stage)) {
      send(option, option.targetIds, payWith, step.style, step.mode);
      return;
    }
    setStep({
      ...step,
      option,
      stage,
      ...(payWith ? { payWith } : {}),
      targets: view.window?.moment === "falls" ? option.targetIds.slice(0, option.targets.count) : [],
    });
  };
  const pick = (id: string) => {
    if (!step) return;
    const targets = rulesetPickTarget(step.option, step.targets, id);
    if (rulesetSendsOnPick(step.option) && targets.length === 1) {
      send(step.option, targets, step.payWith, step.style, step.mode);
      return;
    }
    setStep({ ...step, targets });
  };

  // Every step but the menu itself, drawn where the layout puts it: in place of the menu on the
  // stage's band, under the option's own row on the pane.
  const stepPanel = (() => {
    // ── Making an attack in one of the ruleset's initiative styles ──
    const styles = step?.stage === "style" ? (step.option.styles ?? []) : [];
    if (step && styles.length > 0) {
      const option = step.option;
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`} id="ruleset-style-prompt">
            {t("game.combat.ruleset.style.prompt", { label: rulesetOptionLabel(option, t) })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-style-prompt">
            {styles.map((style, index) => {
              const forecast = rulesetStyleForecastText(style, t);
              return (
                <button
                  ref={index === 0 ? first : undefined}
                  key={style.id}
                  type="button"
                  disabled={busy}
                  onClick={() => afterStyle(option, style.id)}
                  className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
                >
                  <span className={`block font-semibold ${ink.strong}`}>{style.label}</span>
                  {forecast && <span className={`block text-[0.65rem] ${ink.faint}`}>{forecast}</span>}
                </button>
              );
            })}
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Using a weapon in one of its modes ──
    const modes = step?.stage === "mode" ? (step.option.modes ?? []) : [];
    if (step && modes.length > 0) {
      const option = step.option;
      const plain = rulesetOptionForecastText(option, t);
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`} id="ruleset-mode-prompt">
            {t("game.combat.ruleset.mode.prompt", { label: rulesetOptionLabel(option, t) })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-mode-prompt">
            <button
              ref={first}
              type="button"
              disabled={busy}
              onClick={() => afterMode(option, step.style)}
              className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
            >
              <span className={`block font-semibold ${ink.strong}`}>{t("game.combat.ruleset.mode.plain")}</span>
              {plain && <span className={`block text-[0.65rem] ${ink.faint}`}>{plain}</span>}
            </button>
            {modes.map((mode) => {
              const forecast = rulesetModeText(option, mode, t);
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={busy}
                  onClick={() => afterMode(option, step.style, mode.id)}
                  className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
                >
                  <span className={`block font-semibold ${ink.strong}`}>{mode.label}</span>
                  {forecast && <span className={`block text-[0.65rem] ${ink.faint}`}>{forecast}</span>}
                </button>
              );
            })}
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Choosing what to use it with (1.253) ──
    if (step?.stage === "alter" && step.option.alters?.length) {
      const option = step.option;
      const offers = option.alters!;
      // Where nothing joins another, only one can be used at a time, so choosing it is the choice.
      const single = !option.alterNeeded && !offers.some((offer) => offer.joins);
      const toggle = (id: string) => {
        if (id === option.alterNeeded) return;
        if (single) {
          afterMode(option, step.style, step.mode, undefined, [id]);
          return;
        }
        const offer = offers.find((one) => one.id === id);
        if (altersPicked.includes(id)) {
          setAltersPicked(altersPicked.filter((one) => one !== id));
          return;
        }
        // Only one that does not join another (Empowered joins one).
        const kept = offer?.joins
          ? altersPicked
          : altersPicked.filter((one) => offers.find((entry) => entry.id === one)?.joins || one === option.alterNeeded);
        setAltersPicked(
          offer?.joins || !kept.some((one) => !offers.find((entry) => entry.id === one)?.joins) ? [...kept, id] : kept,
        );
      };
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`} id="ruleset-alter-prompt">
            {t("game.combat.ruleset.alter.prompt", { label: rulesetOptionLabel(option, t) })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-alter-prompt">
            {offers.map((offer, index) => {
              const picked = altersPicked.includes(offer.id);
              return (
                <button
                  ref={index === 0 ? first : undefined}
                  key={offer.id}
                  type="button"
                  disabled={busy || offer.id === option.alterNeeded}
                  aria-pressed={single ? undefined : picked}
                  onClick={() => toggle(offer.id)}
                  className={cn(
                    buttonClass,
                    picked
                      ? `border-[var(--primary)]/60 bg-[var(--primary)]/25 ${ink.strong}`
                      : `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`,
                  )}
                >
                  <span className="block font-semibold">{offer.label}</span>
                  <span className={`block text-[0.65rem] ${ink.faint}`}>
                    {t(offer.perLevel ? "game.combat.ruleset.alter.costPerLevel" : "game.combat.ruleset.alter.cost", {
                      count: offer.cost,
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                afterMode(option, step.style, step.mode, undefined, altersPicked.length ? altersPicked : null)
              }
              className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
            >
              {altersPicked.length && !single
                ? t("game.combat.ruleset.alter.use", { count: altersPicked.length })
                : t("game.combat.ruleset.alter.none")}
            </button>
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Who of its user's side it spares (1.254): Careful Spell ──
    if (step?.stage === "spare" && step.spare) {
      const { ids, most } = step.spare;
      const toggle = (id: string) =>
        setSparesPicked(
          sparesPicked.includes(id)
            ? sparesPicked.filter((one) => one !== id)
            : sparesPicked.length < most
              ? [...sparesPicked, id]
              : sparesPicked,
        );
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`} id="ruleset-spare-prompt">
            {t("game.combat.ruleset.spare.prompt", { label: rulesetOptionLabel(step.option, t), count: most })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-spare-prompt">
            {ids.map((id, index) => {
              const picked = sparesPicked.includes(id);
              const combatant = view.combatants.find((one) => one.id === id);
              return (
                <button
                  ref={index === 0 ? first : undefined}
                  key={id}
                  type="button"
                  disabled={busy || (!picked && sparesPicked.length >= most)}
                  aria-pressed={picked}
                  onClick={() => toggle(id)}
                  className={cn(
                    buttonClass,
                    picked
                      ? `border-[var(--primary)]/60 bg-[var(--primary)]/25 ${ink.strong}`
                      : `border-blue-400/30 bg-blue-500/10 ${ink.body} hover:bg-blue-500/20`,
                  )}
                >
                  <span className="block font-semibold">{combatant?.name ?? id}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const picked = { ...step, spared: sparesPicked };
                if (!picksFirst(picked)) sendPicked(picked);
              }}
              className={cn(buttonClass, `border-[var(--primary)]/50 bg-[var(--primary)]/20 ${ink.strong}`)}
            >
              {sparesPicked.length
                ? t("game.combat.ruleset.spare.confirm", { count: sparesPicked.length })
                : t("game.combat.ruleset.spare.none")}
            </button>
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Who it gives disadvantage on their first save (1.255): Heightened Spell ──
    if (step?.stage === "heighten" && step.heighten) {
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`} id="ruleset-heighten-prompt">
            {t("game.combat.ruleset.heighten.prompt", { label: rulesetOptionLabel(step.option, t) })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-heighten-prompt">
            {step.heighten.ids.map((id, index) => {
              const combatant = view.combatants.find((one) => one.id === id);
              return (
                <button
                  ref={index === 0 ? first : undefined}
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => sendPicked(step, id)}
                  className={cn(
                    buttonClass,
                    combatant?.side === "enemy"
                      ? `border-amber-400/30 bg-amber-500/10 ${ink.body} hover:bg-amber-500/20`
                      : `border-blue-400/30 bg-blue-500/10 ${ink.body} hover:bg-blue-500/20`,
                  )}
                >
                  <span className="block font-semibold">{combatant?.name ?? id}</span>
                </button>
              );
            })}
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Choosing how much of it to spend (1.251) ──
    if (step?.stage === "amount" && step.option.amount) {
      const option = step.option;
      const max = option.amount!.max;
      const typed = Number(amountText);
      const valid = Number.isInteger(typed) && typed >= 1 && typed <= max;
      const chooseAmount = (amount: number | null) => {
        afterMode(option, step.style, step.mode, amount, step.alters ?? null);
      };
      return (
        <div className="flex flex-col gap-2 p-3">
          <label className={`text-xs ${ink.muted}`} htmlFor="ruleset-amount-input">
            {t("game.combat.ruleset.amount.prompt", { label: rulesetOptionLabel(option, t), max })}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="ruleset-amount-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              step={1}
              value={amountText}
              disabled={busy}
              onChange={(event) => setAmountText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && valid) chooseAmount(typed);
              }}
              className={`min-h-11 w-20 rounded-lg border ${ink.border} ${ink.fill} px-2 text-base tabular-nums ${ink.strong} sm:text-xs`}
            />
            <button
              ref={first}
              type="button"
              disabled={busy || !valid}
              onClick={() => chooseAmount(typed)}
              className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
            >
              {t("game.combat.ruleset.amount.spend", { count: valid ? typed : 0 })}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => chooseAmount(null)}
              className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
            >
              {t("game.combat.ruleset.amount.fill")}
            </button>
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Paying for it out of another pool of the family ──
    const pools = step?.stage === "pay" ? (step.option.payWith ?? []) : [];
    if (step && pools.length > 0) {
      const option = step.option;
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.muted}`}>
            {t("game.combat.ruleset.upcast.prompt", { label: rulesetOptionLabel(option, t) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Its own pool is empty, so only a higher one pays for it now (1.171). */}
            {!option.upcastOnly && (
              <button
                ref={first}
                type="button"
                disabled={busy}
                onClick={() => paid(undefined)}
                className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.body} ${ink.hover}`)}
              >
                {rulesetUpcastOwnText(option, budgetLabel, t, distance)}
              </button>
            )}
            {pools.map((pool, index) => (
              <button
                key={pool}
                ref={option.upcastOnly && index === 0 ? first : undefined}
                type="button"
                disabled={busy}
                onClick={() => paid(pool)}
                className={cn(buttonClass, `border-blue-400/25 bg-blue-500/10 ${ink.body} hover:bg-blue-500/20`)}
              >
                {/* More of the item's own charges (1.269). */}
                {pool.startsWith(RULESET_CHARGE_STEP_PREFIX)
                  ? t("game.combat.ruleset.upcast.charges", {
                      count: Number(pool.slice(RULESET_CHARGE_STEP_PREFIX.length)),
                    })
                  : rulesetUpcastPoolText(option, pool, poolOf(pool)?.unit ?? poolLabel(pool), !!poolOf(pool)?.unit, t)}
              </button>
            ))}
          </div>
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Picking it on the board ──
    // The cells are the board's to draw and the board's to finish; this is the prompt and the way
    // out, in the place the option was chosen from, so a player who changed their mind is not
    // hunting for it on the grid.
    if (step?.stage === "move" || step?.stage === "aim") {
      const option = step.option;
      const lay = step.lay;
      const area = step.stage === "aim" ? option.area : undefined;
      const wall = area?.shape === "wall";
      const copies = area?.copies ?? 1;
      const placed = lay?.at ? 1 + (lay.also?.length ?? 0) : 0;
      const turning = step.stage === "aim" && rulesetAimTurning(option, lay);
      const sendLaid = () => {
        const laid = rulesetAimSoFar(lay);
        if (!laid) return;
        if (picksFirst({ ...step, targets: [], cell: laid })) return;
        closeStep();
        onChoose(option.id, [], step.payWith, laid, step.style, step.mode, step.amount, step.alters);
      };
      // Who may go along on a teleport (1.276), ticked here while the board takes the cell.
      const carries = step.stage === "aim" ? option.teleport?.carries : undefined;
      const prompt =
        step.stage === "move"
          ? "game.combat.ruleset.board.movePrompt"
          : option.teleport
            ? option.teleport.cells.length === 0
              ? "game.combat.ruleset.board.teleportLeavePrompt"
              : "game.combat.ruleset.board.teleportPrompt"
            : turning
              ? "game.combat.ruleset.board.aimTurnPrompt"
              : wall && !lay?.ring
                ? "game.combat.ruleset.board.aimWallPrompt"
                : copies > 1
                  ? "game.combat.ruleset.board.aimCopiesPrompt"
                  : rulesetOptionHasAim(option)
                    ? "game.combat.ruleset.board.aimPrompt"
                    : "game.combat.ruleset.board.aimNobody";
      // On a touch screen there is no Enter or Escape to name: the same ask, worded for a tap.
      const touchWords =
        touch && step.stage === "move" && step.to
          ? "game.combat.ruleset.board.movePromptConfirm"
          : touch && TOUCH_PROMPTS.has(prompt)
            ? `${prompt}Touch`
            : prompt;
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.ask}`}>
            {t(touchWords, { label: rulesetOptionLabel(option, t), name: actorName, count: copies, placed })}
          </p>
          {/* What the shape asks of whoever it catches, and what it does to them, while it is aimed. */}
          {area && option.saveAgainst && (
            <p className={`text-xs ${ink.faint}`}>{rulesetOptionForecastText(option, t)}</p>
          )}
          {/* How a wall is laid (1.177) and how many copies are down (1.178): the board takes the cells. */}
          {carries && (
            <div className="flex flex-wrap gap-2">
              {carries.ids.map((id) => {
                const along = step.targets.includes(id);
                const full = !along && step.targets.length >= carries.count;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy || full}
                    aria-pressed={along}
                    onClick={() =>
                      setStep({
                        ...step,
                        targets: along ? step.targets.filter((one) => one !== id) : [...step.targets, id],
                      })
                    }
                    className={cn(buttonClass, along ? "border-[var(--primary)]/60 bg-[var(--primary)]/25" : "")}
                  >
                    {t("game.combat.ruleset.board.teleportCarry", {
                      name: view.combatants.find((one) => one.id === id)?.name ?? id,
                    })}
                  </button>
                );
              })}
            </div>
          )}
          {/* Out of the fight altogether (1.279), with whoever is ticked to go along. */}
          {option.teleport?.leaves && step.stage === "aim" && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const along = step.targets;
                  closeStep();
                  onChoose(
                    option.id,
                    [],
                    step.payWith,
                    along.length ? { carries: along } : undefined,
                    step.style,
                    step.mode,
                    step.amount,
                    step.alters,
                  );
                }}
                className={buttonClass}
              >
                {t("game.combat.ruleset.board.teleportLeave")}
              </button>
            </div>
          )}
          {(wall || copies > 1) && (
            <div className="flex flex-wrap gap-2">
              {wall && area?.ring !== undefined && !turning && (
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={!!lay?.ring}
                  onClick={() => setStep({ ...step, lay: { ...lay, ring: !lay?.ring } })}
                  className={cn(buttonClass, lay?.ring ? "border-[var(--primary)]/60 bg-[var(--primary)]/25" : "")}
                >
                  {t("game.combat.ruleset.board.aimRing")}
                </button>
              )}
              {wall && area?.sided && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep({ ...step, lay: { ...lay, side: lay?.side === "near" ? "far" : "near" } })}
                  className={buttonClass}
                >
                  {t(
                    lay?.side === "near"
                      ? "game.combat.ruleset.board.aimSideNear"
                      : "game.combat.ruleset.board.aimSideFar",
                  )}
                </button>
              )}
              {turning && (
                <button type="button" disabled={busy} onClick={sendLaid} className={buttonClass}>
                  {t("game.combat.ruleset.board.aimAcross")}
                </button>
              )}
              {copies > 1 && placed > 0 && (
                <button type="button" disabled={busy} onClick={sendLaid} className={buttonClass}>
                  {t("game.combat.ruleset.board.aimCastNow", { count: placed })}
                </button>
              )}
            </div>
          )}
          <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
        </div>
      );
    }

    // ── Pointing it at somebody ──
    if (step?.stage === "target" && rulesetOptionNeedsTargets(step.option)) {
      const option = step.option;
      const many = option.targets.count > 1;
      const targets = view.combatants.filter((combatant) => option.targetIds.includes(combatant.id));
      // The walls' sections it may strike instead (1.200), each by the first of its cells offered.
      const offered = new Set((option.walls ?? []).map((cell) => `${cell.x},${cell.y}`));
      const sections = (view.zones ?? []).flatMap((zone) =>
        (zone.sections ?? []).flatMap((section) => {
          const cell = section.cells.find((one) => offered.has(`${one.x},${one.y}`));
          return cell ? [{ wall: zone.label, health: section.health, max: section.max, cell }] : [];
        }),
      );
      return (
        <div className="flex flex-col gap-2 p-3">
          <p className={`text-xs ${ink.ask}`} id="ruleset-target-prompt">
            {many
              ? t(
                  option.targets.repeat
                    ? "game.combat.ruleset.target.promptRepeat"
                    : "game.combat.ruleset.target.promptMany",
                  {
                    label: rulesetOptionLabel(option, t),
                    count: option.targets.count,
                  },
                )
              : t("game.combat.ruleset.target.prompt", { label: rulesetOptionLabel(option, t) })}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ruleset-target-prompt">
            {targets.map((combatant, index) => {
              const picked = step.targets.includes(combatant.id);
              // Picked more than once (1.305): eldritch blast's beams at one target.
              const times = step.targets.filter((id) => id === combatant.id).length;
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
                      ? `border-[var(--primary)]/60 bg-[var(--primary)]/25 ${ink.strong}`
                      : combatant.side === "enemy"
                        ? `border-amber-400/30 bg-amber-500/10 ${ink.body} hover:bg-amber-500/20`
                        : `border-blue-400/30 bg-blue-500/10 ${ink.body} hover:bg-blue-500/20`,
                  )}
                >
                  <span className="block font-semibold">{combatant.name}</span>
                  <span className={`mt-0.5 block text-[0.65rem] tabular-nums ${ink.faint}`}>
                    {t("game.combat.ruleset.status.health", {
                      value: combatant.health.value,
                      max: combatant.health.max,
                    })}
                  </span>
                  {/* Its odds against this one, as the server worked them out, so targets compare. */}
                  {option.forecastFor?.[combatant.id] && (
                    <span className={`mt-0.5 block text-[0.65rem] tabular-nums ${ink.body}`}>
                      {rulesetOptionForecastText({ ...option, forecast: option.forecastFor[combatant.id] }, t)}
                    </span>
                  )}
                  {times > 1 && (
                    <span className={`mt-0.5 block text-[0.65rem] font-semibold tabular-nums ${ink.body}`}>
                      {t("game.combat.ruleset.target.times", { count: times })}
                    </span>
                  )}
                </button>
              );
            })}
            {sections.map((section, index) => (
              <button
                ref={index === 0 && targets.length === 0 ? first : undefined}
                key={`${section.cell.x},${section.cell.y}`}
                type="button"
                disabled={busy}
                onClick={() => {
                  closeStep();
                  onChoose(
                    option.id,
                    [],
                    step.payWith,
                    { wall: { x: section.cell.x, y: section.cell.y } },
                    step.style,
                    step.mode,
                    step.amount,
                    step.alters,
                  );
                }}
                className={cn(buttonClass, `border-sky-300/30 bg-sky-500/10 ${ink.body} hover:bg-sky-500/20`)}
              >
                <span className="block font-semibold">
                  {t("game.combat.ruleset.target.wall", { wall: section.wall })}
                </span>
                <span className={`mt-0.5 block text-[0.65rem] tabular-nums ${ink.faint}`}>
                  {t("game.combat.ruleset.status.health", { value: section.health, max: section.max })}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {many && (
              <button
                type="button"
                disabled={busy || step.targets.length === 0}
                onClick={() => send(option, step.targets, step.payWith, step.style, step.mode)}
                className={cn(buttonClass, `border-[var(--primary)]/50 bg-[var(--primary)]/20 ${ink.strong}`)}
              >
                {t("game.combat.ruleset.target.confirm", { count: step.targets.length })}
              </button>
            )}
            <BackButton ink={ink} onClick={closeStep} label={t("game.combat.ruleset.target.back")} />
          </div>
        </div>
      );
    }

    return null;
  })();
  if (stepPanel && !pane) return stepPanel;
  if (layout === "step") return stepPanel;

  // ── The pane's option list ──
  if (pane) {
    const marksById = new Map(marks.map((mark) => [mark.id, mark]));
    const openId = step?.option.id;
    const row = (option: DirectedRulesetOption, answer = false, index = -1, label?: string) => {
      const mark = option.budget ? marksById.get(option.budget) : undefined;
      // What it spends besides its budget, which the pip already says.
      const cost = rulesetOptionCostText({ ...option, budget: undefined }, budgetLabel, t, distance);
      // An answer to a held hit says what it does to the defense the hit is checked against.
      const forecast = option.raisesDefense
        ? t(
            option.raisesDefense.misses
              ? "game.combat.ruleset.screen.defenseRaisedMiss"
              : "game.combat.ruleset.screen.defenseRaised",
            {
              defense: defenseLabel ?? "",
              from: view.window?.defense ?? "",
              to: option.raisesDefense.to,
            },
          ).trim()
        : rulesetOptionForecastText(option, t);
      const reach = option.area
        ? t("game.combat.ruleset.screen.area", {
            size: rulesetDistanceText(option.area.size, distance, t),
            shape: t(`game.combat.ruleset.screen.shape.${option.area.shape}`, { defaultValue: option.area.shape }),
          })
        : option.range && option.range.normal > 0
          ? option.range.long
            ? `${rulesetDistanceText(option.range.normal, distance, t)} / ${rulesetDistanceText(option.range.long, distance, t)}`
            : rulesetDistanceText(option.range.normal, distance, t)
          : "";
      const open = openId === option.id;
      return (
        <Fragment key={option.id}>
          <li>
            <button
              ref={answer && index === 0 ? first : undefined}
              type="button"
              disabled={busy}
              aria-expanded={open || undefined}
              onClick={() => (open ? closeStep() : take(option))}
              className={cn(
                "grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md border px-2 text-left text-[0.78rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] disabled:opacity-50",
                answer ? "min-h-11 py-1" : "min-h-11 py-0.5 md:min-h-[1.875rem]",
                open
                  ? "border-[var(--primary)]/70 bg-[var(--primary)]/10"
                  : "border-transparent hover:border-[var(--border)] hover:bg-[var(--foreground)]/[0.05]",
              )}
            >
              <span className="grid h-4 w-4 place-items-center">
                <ArtIcon ids={option.icons ?? []} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-semibold text-[var(--foreground)]">
                    {label ?? rulesetOptionLabel(option, t)}
                  </span>
                  {mark && <RulesetBudgetPip mark={mark} size="sm" />}
                  {(cost || reach) && (
                    <span className="truncate text-xs text-[var(--muted-foreground)] md:text-[0.68rem]">
                      {[cost, reach].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {option.cancelSave && (
                  <span className="block truncate text-[0.66rem] text-[var(--muted-foreground)]">
                    {t("game.combat.ruleset.menu.cancelSave", {
                      save: option.cancelSave.label,
                      dc: option.cancelSave.dc,
                    })}
                  </span>
                )}
              </span>
              <span className="text-right text-[0.68rem] tabular-nums text-[var(--muted-foreground)]">
                {open ? t("game.combat.ruleset.screen.choosing") : forecast}
              </span>
            </button>
          </li>
          {open && stepPanel && (
            <li className="mb-1 ml-3 rounded-md border border-[var(--border)] bg-[var(--foreground)]/[0.03]">
              {stepPanel}
            </li>
          )}
        </Fragment>
      );
    };
    if (view.window) {
      const answers = view.options.filter((option) => option.kind !== "end-turn");
      return (
        <div ref={root} tabIndex={-1} className="outline-none">
          <ul aria-label={t("game.combat.ruleset.screen.answers")} className="m-0 grid list-none gap-1 p-0">
            {answers.map((option, index) => row(option, true, index))}
          </ul>
          <button
            ref={answers.length === 0 ? first : undefined}
            type="button"
            disabled={busy}
            onClick={() => {
              closeStep();
              onChoose(RULESET_PASS_OPTION, []);
            }}
            className="mt-1.5 flex min-h-9 w-full items-center justify-between rounded-md border border-[var(--border)] px-3 text-left text-xs text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.05] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          >
            {t(passKey("game.combat.ruleset.screen.letItGo"))}
            {!touch && (
              <kbd className="rounded border border-[var(--border)] px-1 font-mono text-[0.6rem] text-[var(--muted-foreground)]">
                {t("game.combat.ruleset.screen.escKey")}
              </kbd>
            )}
          </button>
        </div>
      );
    }
    // Ending the turn is the footer's; the standard actions fold into one row of their own, and so
    // does every readied option, which would otherwise bury the turn under one "Ready …" per action.
    // An option with nobody to point it at folds into one line under the rest, so the ones that can
    // be taken are the ones a player reads first.
    const unreachable = groups
      .filter((group) => !FOLDED_KINDS.has(group.kind))
      .flatMap((group) => group.options.filter((option) => !option.ready && rulesetOptionOutOfReach(option)));
    const listed = groups
      .filter((group) => !FOLDED_KINDS.has(group.kind))
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => !option.ready && !rulesetOptionOutOfReach(option)),
      }))
      .filter((group) => group.options.length > 0);
    const readied = groups.flatMap((group) =>
      group.kind === "end-turn" || group.kind === "standard" ? [] : group.options.filter((option) => option.ready),
    );
    // Every group of a folded kind folds on its own, under its own heading: a ruleset may name more
    // than one (one per list it gives a tab).
    const standard = groups.filter((group) => group.kind === "standard");
    // Grabs and shoves are the moves a turn takes least, so they fold as the standard actions do.
    const contests = groups.filter((group) => group.kind === "contest");
    const fold = (
      labelKey: string,
      options: typeof readied,
      summary: string,
      body?: ReactNode,
      group?: { key: string; labelValues?: Record<string, string | number> },
    ) => {
      const foldKey = group?.key ?? labelKey;
      const stepping = options.some((option) => option.id === openId);
      return (
        <details
          key={foldKey}
          open={stepping || foldsOpen[foldKey] === true}
          onToggle={(event) => {
            if (stepping) return;
            const open = event.currentTarget.open;
            setFoldsOpen((folds) => (folds[foldKey] === open ? folds : { ...folds, [foldKey]: open }));
          }}
          className="group"
        >
          <summary
            // A step inside holds the fold open: the click that would shut it over the step does nothing.
            onClick={(event) => {
              if (stepping) event.preventDefault();
            }}
            className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-[0.78rem] font-semibold text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.05] md:min-h-[1.875rem] [&::-webkit-details-marker]:hidden"
          >
            <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform group-open:rotate-180" />
            {t(labelKey, group?.labelValues)}
            <span className="truncate text-[0.68rem] font-normal text-[var(--muted-foreground)]">{summary}</span>
          </summary>
          <ul className="m-0 grid list-none gap-px p-0 pl-2">{body ?? options.map((option) => row(option))}</ul>
        </details>
      );
    };
    // Readying is one choice in two picks: the action first, then the moment it waits for. Each
    // action is one row that opens onto its moments, so a caster's list is said once, not twice.
    const readiedBy = new Map<string, DirectedRulesetOption[]>();
    for (const option of readied) {
      const key = option.ready!.optionId;
      readiedBy.set(key, [...(readiedBy.get(key) ?? []), option]);
    }
    const readyRows = [...readiedBy.values()].map((moments) => {
      const ready = moments[0]!.ready!;
      const stepping = moments.some((option) => option.id === openId);
      return (
        <li key={ready.optionId}>
          <details
            open={stepping || foldsOpen[`ready:${ready.optionId}`] === true}
            onToggle={(event) => {
              if (stepping) return;
              const key = `ready:${ready.optionId}`;
              const open = event.currentTarget.open;
              setFoldsOpen((folds) => (folds[key] === open ? folds : { ...folds, [key]: open }));
            }}
            className="group/ready"
          >
            <summary
              onClick={(event) => {
                if (stepping) event.preventDefault();
              }}
              className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-[0.78rem] font-semibold text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.05] md:min-h-[1.875rem] [&::-webkit-details-marker]:hidden"
            >
              <ChevronDown className="h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform group-open/ready:rotate-180" />
              {rulesetMenuReadyName(ready.label, ready.optionId, t)}
            </summary>
            <ul className="m-0 grid list-none gap-px p-0 pl-4">
              {moments.map((option) =>
                row(
                  option,
                  false,
                  -1,
                  t(
                    option.ready!.on === "comes"
                      ? "game.combat.ruleset.screen.readyWhenComes"
                      : "game.combat.ruleset.screen.readyWhenActs",
                  ),
                ),
              )}
            </ul>
          </details>
        </li>
      );
    });
    return (
      <div ref={root} tabIndex={-1} className="flex flex-col gap-2 px-2 py-2 outline-none">
        {listed.map((group) => (
          <section key={group.key} aria-label={t(group.labelKey, group.labelValues)}>
            <h4 className="px-2 pb-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              {t(group.labelKey, group.labelValues)}
            </h4>
            <ul className="m-0 grid list-none gap-px p-0">{group.options.map((option) => row(option))}</ul>
          </section>
        ))}
        {unreachable.length > 0 &&
          fold(
            "game.combat.ruleset.screen.outOfReachFold",
            unreachable,
            unreachable.map((option) => rulesetOptionLabel(option, t)).join(", "),
          )}
        {readied.length > 0 &&
          fold(
            "game.combat.ruleset.screen.readyFold",
            readied,
            t("game.combat.ruleset.screen.readyCount", { count: readiedBy.size }),
            readyRows,
          )}
        {contests.map((group) => {
          const open = group.options.filter((option) => !option.ready);
          return open.length > 0
            ? fold(
                group.labelKey,
                open,
                open.map((option) => rulesetOptionLabel(option, t)).join(", "),
                undefined,
                group,
              )
            : null;
        })}
        {standard.map((group) =>
          fold(
            group.labelKey,
            group.options,
            group.options.map((option) => rulesetOptionLabel(option, t)).join(", "),
            undefined,
            group,
          ),
        )}
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
          {rulesetWindowPrompt(view, defenseLabel, t)}
        </p>
      ) : (
        <p className={`hidden text-[0.65rem] uppercase tracking-wide ${ink.faint} sm:block`}>
          {t("game.combat.ruleset.menu.title", { name: actorName })}
        </p>
      )}
      <div className="flex flex-row flex-wrap items-start gap-2 sm:gap-x-6 sm:gap-y-3">
        {groups.map((group) => (
          <section
            key={group.key}
            aria-label={t(group.labelKey, group.labelValues)}
            className="contents sm:flex sm:min-w-0 sm:flex-col sm:gap-1.5"
          >
            <h4 className={`hidden text-[0.6rem] font-semibold uppercase tracking-wide ${ink.faint} sm:block`}>
              {t(group.labelKey, group.labelValues)}
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
                      `${ink.border} ${ink.fill} ${ink.body} ${ink.hoverBorder} ${ink.hover} ${ink.hoverText}`,
                    )}
                  >
                    <span className={`flex items-center gap-1.5 font-semibold ${ink.strong}`}>
                      <ArtIcon ids={option.icons ?? []} className="h-5 w-5" />
                      {rulesetOptionLabel(option, t)}
                    </span>
                    {option.cancelSave && (
                      <span className={`block text-[0.65rem] ${ink.faint}`}>
                        {t("game.combat.ruleset.menu.cancelSave", {
                          save: option.cancelSave.label,
                          dc: option.cancelSave.dc,
                        })}
                      </span>
                    )}
                    {cost && <span className={`mt-0.5 block text-[0.65rem] ${ink.faint}`}>{cost}</span>}
                    {forecast && <span className={`block text-[0.65rem] ${ink.faint}`}>{forecast}</span>}
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
                `${ink.border} ${ink.fill} ${ink.body} ${ink.hoverBorder} ${ink.hover} ${ink.hoverText}`,
              )}
            >
              {t(passKey("game.combat.ruleset.menu.pass"))}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onFlee}
            className={cn(buttonClass, `${ink.border} ${ink.fill} ${ink.muted} ${ink.hover} ${ink.hoverText}`)}
          >
            {t("game.combat.ruleset.menu.flee")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onClick, label, ink }: { onClick: () => void; label: string; ink: typeof STRIP_INK }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded border ${ink.border} px-3 text-xs ${ink.muted} ${ink.hover} ${ink.hoverText} focus-visible:outline-2 focus-visible:outline-[var(--primary)]`}
    >
      {label}
    </button>
  );
}
