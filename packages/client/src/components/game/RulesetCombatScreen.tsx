// The screen a fight on a board is fought on: the board on the left with the log under it, and one
// combat pane on the right holding whatever asks the player something, the turn order, the turn in
// hand, the options and the way out.
//
// Presentational, as the board and the menu are. The half-made choice lives here only because both
// the board and the pane's option list draw it; every number is the view's.
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type {
  CombatController,
  CombatWeather,
  Combatant,
  DirectedRulesetCombatant,
  DirectedRulesetView,
  RulesetDefinition,
} from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CombatWeatherSummary } from "./CombatWeatherSummary";
import { RulesetBudgetPip, rulesetBudgetMarks, type RulesetBudgetMark } from "./RulesetBudgetPip";
import { RulesetCombatBoard, type RulesetCombatBoardProps } from "./RulesetCombatBoard";
import { RulesetCombatLog } from "./RulesetCombatLog";
import { RulesetCombatMenu, rulesetWindowPrompt } from "./RulesetCombatMenu";
import { RulesetInHand } from "./RulesetInHand";
import { zoneLine } from "./RulesetCombatStatus";
import { RulesetSideBadge, RulesetTurnOrder, rulesetHealthTone, rulesetStateWord } from "./RulesetTurnOrder";
import { rulesetDistanceText, rulesetHealthPercent, rulesetHeldCaught } from "../../lib/ruleset-combat-board";
import type { RulesetMenuStep } from "../../lib/ruleset-combat-menu";
import { rulesetFoeFates } from "../../lib/ruleset-combat-log";
import { useRulesetText } from "../../lib/ruleset-text";
import { useCombatScreenStore } from "../../stores/combat-screen.store";
import { useMatchMedia } from "../../hooks/use-match-media";
import { cn } from "../../lib/utils";

export interface RulesetCombatScreenProps {
  definition: RulesetDefinition;
  /** A view that carries a grid. */
  view: DirectedRulesetView;
  units: Combatant[];
  weather?: CombatWeather;
  environment?: string;
  busy: boolean;
  budgetLabel: (id: string) => string;
  defenseLabel?: string;
  onChoose: RulesetCombatBoardProps["onChoose"];
  onFlee: () => void;
  /** Giving the party up, offered while every foe standing would take it (combat AI T6). */
  onYield?: () => void;
  onControl: (id: string, controller: CombatController) => void;
  /** Every companion at once, all but the player's own character. */
  onControlCompanions?: (controller: CombatController) => void;
  /** The companions' standing orders, under the turn order. */
  controls?: ReactNode;
  /** Whether the player picks their own symbol spends (1.382). */
  onSpends?: (choose: boolean) => void;
  /** An error, or the fight's end, put at the top of the pane by the caller. */
  notice?: ReactNode;
  /** The fight is over: the pane holds only the notice (the caller's end of the fight), no turn. */
  ended?: boolean;
  /** Before the first turn (2026-10-24): one of the party set down on a square, and the fight begun. */
  onDeploy?: (unitId: string, to: { x: number; y: number }) => void;
  onDeployed?: () => void;
  /** A carried item taken in hand, and the stack a weapon shoots first (2026-10-26): the In hand row. */
  onDraw?: (unitId: string, item: number) => void;
  onAmmo?: (unitId: string, weapon: number, stack: number) => void;
}

/** How far the game's top-left float (`data-game-float="map-and-party"`) reaches down into `column`
 *  where the two overlap, in pixels, kept up as either changes size: none when it lies beside it. */
function useTopFloatClearance(column: RefObject<HTMLDivElement | null>, active: boolean): number {
  const [clear, setClear] = useState(0);
  useEffect(() => {
    const own = column.current;
    if (!active || !own || typeof ResizeObserver === "undefined") {
      setClear(0);
      return;
    }
    const float = document.querySelector<HTMLElement>('[data-game-float="map-and-party"]');
    if (!float) return;
    const measure = () => {
      const at = own.getBoundingClientRect();
      const over = float.getBoundingClientRect();
      const overlaps = over.height > 0 && over.left < at.right && over.right > at.left && over.top < at.bottom;
      setClear(overlaps ? Math.max(0, Math.ceil(over.bottom + 6 - at.top)) : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(float);
    observer.observe(own);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [column, active]);
  return clear;
}

export function RulesetCombatScreen({
  definition,
  view,
  units,
  weather,
  environment,
  busy,
  budgetLabel,
  defenseLabel,
  onChoose,
  onFlee,
  onYield,
  onControl,
  onControlCompanions,
  controls,
  onSpends,
  notice,
  ended,
  onDeploy,
  onDeployed,
  onDraw,
  onAmmo,
}: RulesetCombatScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<RulesetMenuStep | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const menuRoot = useRef<HTMLDivElement>(null);
  const logOpen = useCombatScreenStore((state) => state.logOpen);
  const paneOpen = useCombatScreenStore((state) => state.paneOpen);
  const setRound = useCombatScreenStore((state) => state.setRound);
  // The top bar shows the fight's controls while this screen is up, and puts them away after.
  useEffect(() => {
    setRound(view.round);
  }, [view.round, setRound]);
  useEffect(() => () => setRound(null), [setRound]);

  // The budgets' names in the player's language (1.806), as the rest of the fight's words are.
  const text = useRulesetText();
  const marks = useMemo(() => rulesetBudgetMarks(definition, text), [definition, text]);
  const byId = new Map(view.combatants.map((combatant) => [combatant.id, combatant]));
  const actor = view.actorId ? byId.get(view.actorId) : undefined;
  const window = view.window;
  // A question is the player's only when they play whoever is asked, which is exactly when the view
  // carries the menu for it.
  const asked = window && view.options ? window : undefined;
  const answerer = asked ? byId.get(asked.actorId) : undefined;
  // Before the first turn the player sets their own down (2026-10-24), and nobody acts until they begin.
  const deploy = !ended && onDeploy ? view.deploy : undefined;
  const [deployPick, setDeployPick] = useState<string | null>(null);
  // A tap that sets nobody down says why (re-test 2026-10-24: a bad tap did nothing at all).
  const [deployNote, setDeployNote] = useState(false);
  const placingId = deploy ? (deploy.ids.find((id) => id === deployPick) ?? deploy.ids[0]) : undefined;
  const placing = useMemo(
    () => (deploy ? new Set(deploy.cells.map((cell) => `${cell.x},${cell.y}`)) : undefined),
    [deploy],
  );
  const place = (cell: { x: number; y: number }) => {
    if (!deploy || !onDeploy) return;
    const there = view.combatants.find((one) => one.x === cell.x && one.y === cell.y);
    if (there && deploy.ids.includes(there.id)) {
      setDeployPick(there.id);
      setDeployNote(false);
      return;
    }
    const lit = placing?.has(`${cell.x},${cell.y}`) && !there;
    setDeployNote(!lit);
    if (placingId && lit) onDeploy(placingId, cell);
  };
  const ending = !window && !deploy ? view.options?.find((option) => option.kind === "end-turn") : undefined;
  const distance = view.grid?.distance;

  // The option list starts at its top on every new turn, never where the last turn left it scrolled.
  const optionsBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (optionsBox.current) optionsBox.current.scrollTop = 0;
  }, [view.actorId, view.round, window?.id]);

  // ── A phone ──
  // The board, the pane, the turn order and the log are four tabs. A step finished on the board takes the phone to the board,
  // and it stays there once the step is sent or dropped so the player sees what it did. A new turn
  // or a new question chooses again: a question and the player's own turn go to the options,
  // somebody else's turn goes to the board. Nothing switches while a step is open.
  const narrow = useMatchMedia("(max-width: 767px)");
  const boardColumnRef = useRef<HTMLDivElement>(null);
  const floatClear = useTopFloatClearance(boardColumnRef, !narrow);
  const [phoneTab, setPhoneTab] = useState<"board" | "pane" | "order" | "log">("pane");
  const [orderOpen, setOrderOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [yielding, setYielding] = useState(false);
  const boardStep = !!step && (step.stage === "move" || step.stage === "aim" || step.stage === "target");
  const ownTurn = !!view.options && !window && !deploy;
  const deploying = !!deploy;
  const askedId = asked?.id;
  useEffect(() => {
    if (narrow && (boardStep || deploying)) setPhoneTab("board");
  }, [narrow, boardStep, deploying]);
  useEffect(() => {
    // Somebody else's turn leaves a player reading the turn order or the log where they are.
    if (narrow) setPhoneTab((tab) => (ended || askedId || ownTurn ? "pane" : tab === "pane" ? "board" : tab));
  }, [narrow, ended, askedId, ownTurn, view.actorId, view.round]);
  useEffect(() => {
    setLeaving(false);
    setYielding(false);
  }, [view.actorId, view.round]);

  // Ending the turn and leaving: at the foot of the pane, and under the board while the pane is put away.
  const footer = (
    <footer hidden={ended} className="shrink-0 space-y-2 border-t border-[var(--border)] px-3.5 py-2.5">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !ending}
          onClick={() => {
            if (!ending) return;
            setStep(null);
            onChoose(ending.id, []);
          }}
          className="min-h-9 flex-1 rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
        >
          {t("game.combat.ruleset.menu.endTurn")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            // Leaving ends the fight for everybody and sits right beside End turn, so it asks twice
            // (laptop playtest 2026-10-24).
            if (!leaving) {
              setLeaving(true);
              return;
            }
            onFlee();
          }}
          className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.05] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
        >
          {leaving
            ? t(narrow ? "game.combat.ruleset.screen.leaveConfirm" : "game.combat.ruleset.menu.fleeConfirm")
            : t("game.combat.ruleset.menu.flee")}
        </button>
      </div>
      {!window && view.canYield && onYield && (
        <button
          type="button"
          disabled={busy}
          // Giving up cannot be taken back, so it always asks twice.
          onClick={() => (yielding ? onYield() : setYielding(true))}
          className="min-h-9 w-full rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.05] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
        >
          {t(
            yielding
              ? narrow
                ? "game.combat.ruleset.menu.yieldConfirmTouch"
                : "game.combat.ruleset.menu.yieldConfirm"
              : "game.combat.ruleset.menu.yield",
          )}
        </button>
      )}
      <CombatWeatherSummary weather={weather} tactical={false} inline />
    </footer>
  );
  // The question waiting on the player: in the pane, or under the board while the pane is put away.
  const question = !ended && asked && answerer && (
    <ReactionCard view={view} answerer={answerer} marks={marks} prompt={rulesetWindowPrompt(view, defenseLabel, t)}>
      <RulesetCombatMenu
        layout="pane"
        marks={marks}
        view={view}
        budgetLabel={budgetLabel}
        defenseLabel={defenseLabel}
        busy={busy}
        onChoose={onChoose}
        onFlee={onFlee}
        step={step}
        onStepChange={setStep}
        menuRef={menuRoot}
      />
      {narrow && (
        <button
          type="button"
          onClick={() => setPhoneTab("board")}
          className="min-h-11 w-full rounded-md border border-[var(--border)] text-sm text-[var(--foreground)]"
        >
          {t("game.combat.ruleset.screen.seeOnBoard")}
        </button>
      )}
    </ReactionCard>
  );
  const paneBody = (withOrder: boolean) => (
    <>
      {notice}
      {question}
      {narrow && (
        <PhoneTurnStrip
          view={view}
          open={orderOpen}
          onOpen={() => setOrderOpen(!orderOpen)}
          onPick={(id) => {
            setSelected(id);
            setOrderOpen(true);
          }}
        />
      )}
      {withOrder && (!narrow || orderOpen) && (
        <div className="max-h-[42%] shrink-0 overflow-y-auto">
          <RulesetTurnOrder
            definition={definition}
            view={view}
            units={units}
            // Pointing at a token opens its details as clicking its row does, until the pointer leaves.
            selectedId={hovered ?? selected}
            onSelect={setSelected}
            onControl={onControl}
            onControlCompanions={onControlCompanions}
            onSpends={onSpends}
            locked={busy}
          />
          {controls}
        </div>
      )}
      {!ended && !deploy && actor && <CurrentTurn actor={actor} marks={marks} distance={distance} t={t} />}
      {!ended && !deploy && onDraw && onAmmo && (
        <RulesetInHand view={view} busy={busy} onDraw={onDraw} onAmmo={onAmmo} />
      )}
      {!ended && ownTurn && <CalloutHints view={view} byId={byId} t={t} />}
      <div ref={optionsBox} className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)]">
        {ended ? null : deploy ? (
          <DeployPane
            ids={deploy.ids}
            view={view}
            placingId={placingId}
            busy={busy}
            note={deployNote}
            onPick={setDeployPick}
            onBegin={() => onDeployed?.()}
            t={t}
          />
        ) : asked ? (
          <p className="m-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">
            {t("game.combat.ruleset.screen.takingTurn", { name: actor?.name ?? "" })}
          </p>
        ) : (
          <RulesetCombatMenu
            layout="pane"
            marks={marks}
            view={view}
            budgetLabel={budgetLabel}
            defenseLabel={defenseLabel}
            busy={busy}
            onChoose={onChoose}
            onFlee={onFlee}
            step={step}
            onStepChange={setStep}
            menuRef={menuRoot}
          />
        )}
      </div>
      {view.zones && view.zones.length > 0 && (
        <ul
          aria-label={t("game.combat.ruleset.status.zones")}
          className="m-0 shrink-0 list-none space-y-0.5 border-t border-[var(--border)] px-3.5 py-2 text-[0.72rem] text-[var(--muted-foreground)]"
        >
          {view.zones.map((zone) => (
            <li key={`${zone.casterId}:${zone.label}`}>{zoneLine(zone, view, t)}</li>
          ))}
        </ul>
      )}
      {footer}
    </>
  );
  const boardColumn = (
    <div
      ref={boardColumnRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      // Below the game's top-left float (the folded map pill and the portraits) on a wide screen, so
      // it lies over none of the board's squares (playtest 2026-10-24).
      style={floatClear > 0 ? { paddingTop: floatClear } : undefined}
    >
      <RulesetCombatBoard
        className="min-h-0 flex-1"
        view={view}
        units={units}
        environment={environment}
        busy={busy}
        onChoose={onChoose}
        step={step}
        onStepChange={setStep}
        menuRef={menuRoot}
        onHover={setHovered}
        placing={placing}
        onPlace={deploy ? place : undefined}
      />
      {/* A phone has the log as a tab of its own, so the board keeps the height. */}
      {logOpen && !narrow && (
        <RulesetCombatLog
          definition={definition}
          view={view}
          className="mx-2 mb-2 h-[min(15.5rem,34%)] shrink-0 sm:mx-4 sm:mb-3"
        />
      )}
    </div>
  );

  if (narrow) {
    return (
      <div
        role="region"
        aria-label={t("game.combat.director.title")}
        data-game-section="combat-director"
        className="flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]"
      >
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-[var(--border)] bg-[var(--card)] p-1">
          {(["board", "pane", "order", "log"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={phoneTab === tab}
              disabled={boardStep && tab !== "board"}
              onClick={() => setPhoneTab(tab)}
              className={cn(
                "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1 text-[0.8rem] font-semibold disabled:opacity-50",
                phoneTab === tab ? "bg-[var(--primary)]/15 text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
              )}
            >
              <span className="truncate">{t(PHONE_TAB_KEYS[tab])}</span>
              {tab === "pane" && asked && phoneTab !== "pane" && (
                <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-[#f5c97a]" />
              )}
            </button>
          ))}
        </div>
        {phoneTab === "board" ? (
          <>
            {boardColumn}
            {/* The bar under the board: the open step with its way back, the way back to a question,
                or the end of the player's turn. It keeps one height whichever it holds, so the board
                above never jumps between steps under a finger about to tap it. */}
            <div className={cn("flex shrink-0 flex-col justify-end overflow-hidden", !ended && "h-[min(10.5rem,36%)]")}>
              {deploy ? (
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] bg-[var(--card)]">
                  <DeployPane
                    ids={deploy.ids}
                    view={view}
                    placingId={placingId}
                    busy={busy}
                    note={deployNote}
                    onPick={setDeployPick}
                    onBegin={() => onDeployed?.()}
                    t={t}
                  />
                </div>
              ) : boardStep ? (
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] bg-[var(--card)]">
                  <RulesetCombatMenu
                    layout="step"
                    marks={marks}
                    view={view}
                    budgetLabel={budgetLabel}
                    defenseLabel={defenseLabel}
                    busy={busy}
                    onChoose={onChoose}
                    onFlee={onFlee}
                    step={step}
                    onStepChange={setStep}
                    menuRef={menuRoot}
                  />
                </div>
              ) : ended ? (
                <button
                  type="button"
                  onClick={() => setPhoneTab("pane")}
                  className="m-2 min-h-11 shrink-0 rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]"
                >
                  {t("game.combat.ruleset.screen.howItEnded")}
                </button>
              ) : asked ? (
                <button
                  type="button"
                  onClick={() => setPhoneTab("pane")}
                  className="m-2 min-h-11 shrink-0 rounded-lg border-2 border-[#f5c97a] bg-[var(--card)] text-sm font-semibold"
                >
                  {t("game.combat.ruleset.screen.backToAnswer")}
                </button>
              ) : ending ? (
                <div className="flex shrink-0 gap-2 border-t border-[var(--border)] bg-[var(--card)] p-2">
                  <button
                    type="button"
                    onClick={() => setPhoneTab("pane")}
                    className="min-h-11 flex-1 rounded-lg border border-[var(--border)] text-sm"
                  >
                    {t("game.combat.ruleset.screen.tabPane")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChoose(ending.id, [])}
                    className="min-h-11 flex-1 rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    {t("game.combat.ruleset.menu.endTurn")}
                  </button>
                </div>
              ) : (
                // Somebody else's turn: what they are doing, in the room the step would take.
                <RulesetCombatLog definition={definition} view={view} className="m-2 min-h-0 flex-1" />
              )}
            </div>
          </>
        ) : phoneTab === "order" ? (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--card)]">
            <RulesetTurnOrder
              definition={definition}
              view={view}
              units={units}
              selectedId={selected}
              onSelect={setSelected}
              onControl={onControl}
              onControlCompanions={onControlCompanions}
              onSpends={onSpends}
              locked={busy}
            />
            {controls}
          </div>
        ) : phoneTab === "log" ? (
          <RulesetCombatLog definition={definition} view={view} className="m-2 min-h-0 flex-1" />
        ) : (
          <div data-game-section="ruleset-pane" className="flex min-h-0 flex-1 flex-col bg-[var(--card)]">
            {paneBody(true)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={t("game.combat.director.title")}
      data-game-section="combat-director"
      className="flex h-full min-h-0 bg-[var(--background)] text-[var(--foreground)]"
    >
      {paneOpen ? (
        boardColumn
      ) : (
        // With the pane put away, the fight's end, a waiting question and the way out of the turn
        // stay under the board.
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {boardColumn}
          <div className="max-h-[50%] shrink-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--card)]">
            {notice}
            {question}
            {footer}
          </div>
        </div>
      )}
      {paneOpen && (
        <aside
          aria-label={t("game.combat.ruleset.screen.pane")}
          data-game-section="ruleset-pane"
          className="flex w-[min(24rem,42vw)] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--card)]"
        >
          {paneBody(true)}
        </aside>
      )}
    </div>
  );
}

/** The budgets a combatant has, as pips: one per use the turn gives, filled while it is still there.
 *  A budget of no count is shown only while a condition gives some (combat C6d). */
function BudgetPips({
  combatant,
  marks,
  spentExcept,
}: {
  combatant: DirectedRulesetCombatant;
  marks: RulesetBudgetMark[];
  /** Out of turn only these may be spent, so every other one is drawn spent. */
  spentExcept?: Set<string>;
}) {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap items-center gap-1">
      {marks.flatMap((mark) => {
        const left = combatant.budgets[mark.id] ?? 0;
        const total = Math.max(left, mark.count);
        if (total === 0) return [];
        const usable = !spentExcept || spentExcept.has(mark.id);
        const shown = usable ? left : 0;
        const title = t("game.combat.ruleset.status.budget", { label: mark.label, left: shown });
        // Past six a row of pips stops reading at a glance, so one pip carries the count beside it.
        if (total > 6) {
          return [
            <span key={mark.id} className="inline-flex items-center gap-0.5" title={title}>
              <RulesetBudgetPip mark={mark} spent={shown === 0} title={title} />
              <span className="text-[0.68rem] tabular-nums text-[var(--muted-foreground)]">
                {t("game.combat.ruleset.screen.budgetCount", { left: shown, total })}
              </span>
            </span>,
          ];
        }
        return Array.from({ length: total }, (_, index) => (
          <RulesetBudgetPip key={`${mark.id}-${index}`} mark={mark} spent={index >= shown} title={title} />
        ));
      })}
    </span>
  );
}

/** What the party's companions set up that the player can follow through on (Alyssa 2026-10-24): a
 *  held foe to strike from beside it, an open one to attack. Nothing when there is none. */
function CalloutHints({
  view,
  byId,
  t,
}: {
  view: DirectedRulesetView;
  byId: Map<string, DirectedRulesetCombatant>;
  t: TFunction;
}) {
  const callouts = (view.callouts ?? []).filter((one) => byId.has(one.targetId));
  if (callouts.length === 0) return null;
  return (
    <section
      aria-label={t("game.combat.ruleset.screen.callouts")}
      data-game-section="ruleset-callouts"
      className="shrink-0 space-y-1 border-t border-[var(--border)] px-3.5 py-2 text-xs"
    >
      <h3 className="font-semibold text-[var(--muted-foreground)]">{t("game.combat.ruleset.screen.callouts")}</h3>
      <ul className="space-y-0.5">
        {callouts.map((one) => (
          <li key={`${one.targetId}:${one.way}`}>
            {t(`game.combat.ruleset.screen.callout.${one.way}`, {
              by: byId.get(one.by)?.name ?? "",
              target: byId.get(one.targetId)?.name ?? "",
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CurrentTurn({
  actor,
  marks,
  distance,
  t,
}: {
  actor: DirectedRulesetCombatant;
  marks: RulesetBudgetMark[];
  distance: { label: string; perCell: number } | undefined;
  t: TFunction;
}) {
  const moved = typeof actor.movementLeft === "number" && typeof actor.movement === "number" && actor.movement > 0;
  const share = moved ? Math.max(0, Math.min(100, (actor.movementLeft! / actor.movement!) * 100)) : 0;
  return (
    <section
      aria-label={t("game.combat.ruleset.board.turnOf", { name: actor.name })}
      data-game-section="ruleset-turn"
      className="shrink-0 space-y-1.5 border-t border-[var(--border)] px-3.5 py-2.5"
    >
      <div className="flex items-center gap-2">
        <RulesetSideBadge combatant={actor} className="h-5 w-5 text-[0.5rem]" />
        <h3 className="flex-1 truncate text-sm font-bold">
          {t("game.combat.ruleset.board.turnOf", { name: actor.name })}
        </h3>
        <BudgetPips combatant={actor} marks={marks} />
      </div>
      {moved && (
        <div className="flex items-center gap-2 text-[0.7rem] text-[var(--muted-foreground)]">
          <span className="w-24 shrink-0">{t("game.combat.ruleset.screen.movement")}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--foreground)]/10">
            <span className="block h-full rounded-full bg-[#6fcf97]" style={{ width: `${share}%` }} />
          </span>
          <span className="shrink-0 font-mono tabular-nums text-[var(--foreground)]">
            {t("game.combat.ruleset.screen.movementLeft", {
              left: rulesetDistanceText(actor.movementLeft!, distance, t),
              max: rulesetDistanceText(actor.movement!, distance, t),
            })}
          </span>
        </div>
      )}
      {(actor.pools ?? []).map((pool) => (
        <div key={pool.id} className="flex items-center gap-2 text-[0.7rem] text-[var(--muted-foreground)]">
          {/* Wrapped, never cut: nine slot pools that differ only at the end ("… nivel 1") must read apart. */}
          <span className="w-24 shrink-0 break-words leading-tight" title={pool.label}>
            {pool.label}
          </span>
          {pool.max <= 12 ? (
            <span
              role="img"
              aria-label={t("game.combat.ruleset.screen.ofMax", { value: pool.value, max: pool.max })}
              className="flex flex-1 flex-wrap gap-1"
            >
              {Array.from({ length: pool.max }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    index < pool.value ? "bg-[#b9adff]" : "ring-[1.5px] ring-inset ring-[var(--border)]",
                  )}
                />
              ))}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          <span className="shrink-0 font-mono tabular-nums text-[var(--foreground)]">
            {t("game.combat.ruleset.screen.ofMax", { value: pool.value, max: pool.max })}
          </span>
        </div>
      ))}
    </section>
  );
}

/** The question put to the player out of turn: what is happening, who it catches, what the answerer
 *  has left, every legal answer and the way to let it go by. */
function ReactionCard({
  view,
  answerer,
  marks,
  prompt,
  children,
}: {
  view: DirectedRulesetView;
  answerer: DirectedRulesetCombatant;
  marks: RulesetBudgetMark[];
  prompt: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const window = view.window!;
  const caught = rulesetHeldCaught(view)
    .map((id) => view.combatants.find((combatant) => combatant.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  // Only what an answer spends may be spent out of turn.
  const spends = new Set((view.options ?? []).flatMap((option) => (option.budget ? [option.budget] : [])));
  return (
    <section
      aria-label={t("game.combat.ruleset.screen.mayAnswer", { name: answerer.name })}
      aria-live="polite"
      data-game-section="ruleset-reaction"
      className="m-2.5 shrink-0 space-y-2 rounded-xl border-2 border-[#f5c97a] bg-amber-400/[0.08] p-3"
    >
      <p className="m-0 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-[#f5c97a]">
        {t("game.combat.ruleset.screen.mayAnswer", { name: answerer.name })}
      </p>
      <h3 className="m-0 text-sm font-bold leading-snug">{prompt}</h3>
      {caught && (
        <p className="m-0 text-[0.72rem] text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.screen.catches", { names: caught })}
        </p>
      )}
      <div className="flex items-center gap-2 text-[0.7rem] text-[var(--muted-foreground)]">
        <span>{t("game.combat.ruleset.screen.hasLeft", { name: answerer.name })}</span>
        <BudgetPips combatant={answerer} marks={marks} spentExcept={spends} />
      </div>
      {children}
      <p className="m-0 text-[0.68rem] text-[var(--muted-foreground)]">
        {window.waiting > 0
          ? t("game.combat.ruleset.screen.waiting", { count: window.waiting })
          : t("game.combat.ruleset.screen.nobodyWaiting")}
      </p>
    </section>
  );
}

/** A phone's turn order: one row of faces in the order they act, each with its health under it,
 *  and the full table one tap away. */
function PhoneTurnStrip({
  view,
  open,
  onOpen,
  onPick,
}: {
  view: DirectedRulesetView;
  open: boolean;
  onOpen: () => void;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const byId = new Map(view.combatants.map((combatant) => [combatant.id, combatant]));
  const order = [...new Set(view.order)].flatMap((id) => {
    const combatant = byId.get(id);
    return combatant ? [combatant] : [];
  });
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
      <ol
        aria-label={t("game.combat.ruleset.status.order")}
        className="m-0 flex min-w-0 flex-1 list-none gap-1.5 overflow-x-auto p-0"
      >
        {order.map((combatant) => {
          const percent = rulesetHealthPercent(combatant.health);
          const onTurn = combatant.id === view.actorId;
          const asked = combatant.id === view.window?.actorId;
          return (
            <li key={combatant.id} aria-current={onTurn ? "step" : undefined}>
              <button
                type="button"
                onClick={() => onPick(combatant.id)}
                aria-label={t("game.combat.ruleset.screen.tokenLabel", {
                  name: combatant.name,
                  health: t("game.combat.ruleset.screen.healthValue", {
                    value: combatant.health.value,
                    max: combatant.health.max,
                  }),
                })}
                className={cn(
                  "flex w-12 flex-col items-center gap-0.5 rounded-md py-0.5",
                  onTurn && "bg-[var(--foreground)]/[0.08]",
                  asked && "bg-amber-400/20",
                  (combatant.defeated || combatant.left) && "opacity-40",
                )}
              >
                <RulesetSideBadge combatant={combatant} className="h-7 w-7" />
                <span className="h-1 w-8 overflow-hidden rounded-full bg-[var(--foreground)]/10">
                  <span className={cn("block h-full", rulesetHealthTone(percent))} style={{ width: `${percent}%` }} />
                </span>
                <span className="w-full truncate text-center text-[0.6rem] text-[var(--muted-foreground)]">
                  {combatant.name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="min-h-11 shrink-0 rounded-md px-2 text-xs text-[var(--muted-foreground)]"
      >
        {t(open ? "game.combat.ruleset.screen.orderLess" : "game.combat.ruleset.screen.orderMore")}
      </button>
    </div>
  );
}

const PHONE_TAB_KEYS = {
  board: "game.combat.ruleset.screen.tabBoard",
  pane: "game.combat.ruleset.screen.tabPane",
  order: "game.combat.ruleset.screen.tabOrder",
  log: "game.combat.ruleset.screen.tabLog",
} as const;

const OUTCOME_LINE = {
  victory: "game.combat.ruleset.event.outcomeVictory",
  defeat: "game.combat.ruleset.event.outcomeDefeat",
  flee: "game.combat.ruleset.event.outcomeFled",
} as const;

/** The end of a fight on a board, at the top of the pane where the turn was: how it went, how
 *  the party stands, what it found, and the way back to the story. */
export function RulesetFightEnd({
  view,
  outcome,
  ended,
  loot,
  onFinish,
}: {
  view: DirectedRulesetView;
  outcome: keyof typeof OUTCOME_LINE;
  /** How a defeat came: given up alive to honourable foes, or broken off with both sides standing. */
  ended?: { yielded?: true; stalled?: true };
  loot?: Array<{ name: string; quantity?: number }>;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  const party = view.combatants.filter((combatant) => combatant.side === "party" && !combatant.left);
  const { fates, beaten, total } = rulesetFoeFates(view);
  return (
    <section
      aria-label={t("game.combat.ruleset.screen.endTitle")}
      className={cn(
        "m-3 flex shrink-0 flex-col gap-3 rounded-xl border-2 p-3.5",
        outcome === "victory" ? "border-emerald-500/70" : "border-[var(--border)]",
      )}
    >
      <div>
        <h3 className="text-base font-bold">
          {t(
            ended?.yielded
              ? "game.combat.ruleset.event.outcomeYielded"
              : ended?.stalled
                ? "game.combat.ruleset.event.outcomeStalled"
                : OUTCOME_LINE[outcome],
          )}
        </h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.screen.endRounds", { count: view.round })}
          {total > 0 && <> · {t("game.combat.ruleset.screen.endFoes", { beaten, total })}</>}
        </p>
      </div>
      {fates.length > 0 && (
        <ul className="m-0 list-none space-y-0.5 p-0 text-xs text-[var(--muted-foreground)]">
          {fates.map(([key, list]) => (
            <li key={key}>
              {t(`game.combat.ruleset.screen.${key}`, { names: list.map((one) => one.name).join(", ") })}
            </li>
          ))}
        </ul>
      )}
      <ul className="m-0 list-none space-y-1.5 p-0">
        {party.map((combatant) => {
          const state = rulesetStateWord(combatant, t);
          const percent = rulesetHealthPercent(combatant.health);
          // What the fight cost them, pool by pool: only what was spent.
          const spent = (combatant.pools ?? []).filter((pool) => pool.value < pool.max);
          return (
            <li
              key={combatant.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 text-sm"
            >
              <RulesetSideBadge combatant={combatant} />
              <span className="truncate">{combatant.name}</span>
              <span className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {state ? (
                  <span className="font-semibold text-rose-700 dark:text-[#ff9aaa]">{state}</span>
                ) : (
                  <>
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--foreground)]/10">
                      <span
                        className={cn("block h-full", rulesetHealthTone(percent))}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="font-mono">
                      {t("game.combat.ruleset.screen.healthValue", {
                        value: combatant.health.value,
                        max: combatant.health.max,
                      })}
                    </span>
                  </>
                )}
              </span>
              {spent.length > 0 && (
                <span className="col-start-2 col-end-4 text-xs text-[var(--muted-foreground)]">
                  {spent
                    .map((pool) =>
                      t("game.combat.ruleset.screen.endPool", { label: pool.label, value: pool.value, max: pool.max }),
                    )
                    .join(" · ")}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {loot && loot.length > 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.screen.endLoot", {
            items: loot
              .map((item) => ((item.quantity ?? 1) > 1 ? `${item.name} ×${item.quantity}` : item.name))
              .join(", "),
          })}
        </p>
      )}
      <button
        type="button"
        onClick={onFinish}
        className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
      >
        {t("game.combat.director.finish")}
      </button>
    </section>
  );
}

/** Setting the party down before the first turn (2026-10-24): who is being placed, the others to
 *  pick from, and the way to begin. */
function DeployPane({
  ids,
  view,
  placingId,
  busy,
  note,
  onPick,
  onBegin,
  t,
}: {
  ids: string[];
  view: DirectedRulesetView;
  placingId?: string;
  busy: boolean;
  note: boolean;
  onPick: (id: string) => void;
  onBegin: () => void;
  t: TFunction;
}) {
  const names = new Map(view.combatants.map((one) => [one.id, one.name]));
  return (
    <div className="space-y-2.5 p-3">
      <h3 className="m-0 text-sm font-semibold">{t("game.combat.ruleset.deploy.title")}</h3>
      <p className="m-0 text-xs text-[var(--muted-foreground)]">{t("game.combat.ruleset.deploy.hint")}</p>
      {note && (
        <p role="status" className="m-0 text-xs font-medium text-amber-300">
          {t("game.combat.ruleset.deploy.notHere")}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === placingId}
            onClick={() => onPick(id)}
            className={cn(
              "min-h-9 rounded-lg border px-3 text-xs focus-visible:outline-2 focus-visible:outline-[var(--primary)]",
              id === placingId
                ? "border-emerald-300/80 bg-emerald-400/15 font-semibold text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {id === placingId
              ? t("game.combat.ruleset.deploy.placing", { name: names.get(id) ?? id })
              : (names.get(id) ?? id)}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onBegin}
        className="min-h-9 w-full rounded-lg bg-[var(--primary)] px-3 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
      >
        {t("game.combat.ruleset.deploy.begin")}
      </button>
    </div>
  );
}
