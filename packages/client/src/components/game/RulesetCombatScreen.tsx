// The screen a fight on a board is fought on: the board on the left with the log under it, and one
// combat pane on the right holding whatever asks the player something, the turn order, the turn in
// hand, the options and the way out.
//
// Presentational, as the board and the menu are. The half-made choice lives here only because both
// the board and the pane's option list draw it; every number is the view's.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { zoneLine } from "./RulesetCombatStatus";
import { RulesetSideBadge, RulesetTurnOrder } from "./RulesetTurnOrder";
import { rulesetDistanceText, rulesetHeldCaught } from "../../lib/ruleset-combat-board";
import type { RulesetMenuStep } from "../../lib/ruleset-combat-menu";
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
  onControl: (id: string, controller: CombatController) => void;
  /** An error, or the fight's end, put at the top of the pane by the caller. */
  notice?: ReactNode;
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
  onControl,
  notice,
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

  const marks = useMemo(() => rulesetBudgetMarks(definition), [definition]);
  const byId = new Map(view.combatants.map((combatant) => [combatant.id, combatant]));
  const actor = view.actorId ? byId.get(view.actorId) : undefined;
  const window = view.window;
  // A question is the player's only when they play whoever is asked, which is exactly when the view
  // carries the menu for it.
  const asked = window && view.options ? window : undefined;
  const answerer = asked ? byId.get(asked.actorId) : undefined;
  const ending = !window ? view.options?.find((option) => option.kind === "end-turn") : undefined;
  const distance = view.grid?.distance;

  // The option list starts at its top on every new turn, never where the last turn left it scrolled.
  const optionsBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (optionsBox.current) optionsBox.current.scrollTop = 0;
  }, [view.actorId, view.round, window?.id]);

  // ── A phone ──
  const narrow = useMatchMedia("(max-width: 767px)");
  const phoneLayout = useCombatScreenStore((state) => state.phoneLayout);
  const [phoneTab, setPhoneTab] = useState<"board" | "pane">("pane");
  const [sheet, setSheet] = useState<"peek" | "full">("peek");
  // A step finished on the board takes the phone to the board; a question takes it to the answers.
  const boardStep = step && (step.stage === "move" || step.stage === "aim" || step.stage === "target");
  useEffect(() => {
    if (!narrow) return;
    if (boardStep) {
      setPhoneTab("board");
      setSheet("peek");
    } else setPhoneTab("pane");
  }, [narrow, boardStep]);
  useEffect(() => {
    if (narrow && asked) {
      setPhoneTab("pane");
      setSheet("full");
    }
  }, [narrow, asked]);

  const paneBody = (withOrder: boolean) => (
    <>
      {notice}
      {asked && answerer && (
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
        </ReactionCard>
      )}
      {withOrder && (
        <div className="max-h-[42%] shrink-0 overflow-y-auto">
          <RulesetTurnOrder
            definition={definition}
            view={view}
            units={units}
            // Pointing at a token opens its details as clicking its row does, until the pointer leaves.
            selectedId={hovered ?? selected}
            onSelect={setSelected}
            onControl={onControl}
            locked={busy}
          />
        </div>
      )}
      {actor && <CurrentTurn actor={actor} marks={marks} distance={distance} t={t} />}
      <div ref={optionsBox} className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)]">
        {asked ? (
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
      <footer className="shrink-0 space-y-2 border-t border-[var(--border)] px-3.5 py-2.5">
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
            onClick={onFlee}
            className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.05] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-50"
          >
            {t("game.combat.ruleset.menu.flee")}
          </button>
        </div>
        <CombatWeatherSummary weather={weather} tactical={false} inline />
      </footer>
    </>
  );
  const boardColumn = (
    <div className="flex min-w-0 flex-1 flex-col">
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
      />
      {logOpen && (
        <RulesetCombatLog
          definition={definition}
          view={view}
          className="mx-2 mb-2 h-[min(15.5rem,34%)] shrink-0 sm:mx-4 sm:mb-3"
        />
      )}
    </div>
  );

  if (narrow && phoneLayout === "tabs") {
    return (
      <div
        role="region"
        aria-label={t("game.combat.director.title")}
        data-game-section="combat-director"
        className="flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]"
      >
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-[var(--border)] bg-[var(--card)] p-1">
          {(["board", "pane"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={phoneTab === tab}
              onClick={() => setPhoneTab(tab)}
              className={cn(
                "min-h-10 flex-1 rounded-lg text-sm font-semibold",
                phoneTab === tab ? "bg-[var(--primary)]/15 text-[var(--foreground)]" : "text-[var(--muted-foreground)]",
              )}
            >
              {t(tab === "board" ? "game.combat.ruleset.screen.tabBoard" : "game.combat.ruleset.screen.tabPane")}
              {tab === "pane" && asked ? " •" : ""}
            </button>
          ))}
        </div>
        {phoneTab === "board" ? (
          <>
            {boardColumn}
            {boardStep && (
              <button
                type="button"
                onClick={() => setStep(null)}
                className="m-2 min-h-11 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
              >
                {t("game.combat.ruleset.target.back")}
              </button>
            )}
          </>
        ) : (
          <div data-game-section="ruleset-pane" className="flex min-h-0 flex-1 flex-col bg-[var(--card)]">
            {paneBody(true)}
          </div>
        )}
      </div>
    );
  }

  if (narrow) {
    return (
      <div
        role="region"
        aria-label={t("game.combat.director.title")}
        data-game-section="combat-director"
        className="relative flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]"
      >
        {/* The board keeps the part of the screen the sheet leaves. */}
        <div
          className="flex min-h-0 flex-col"
          style={{ height: !paneOpen ? "100%" : sheet === "full" ? "12%" : boardStep ? "66%" : "48%" }}
        >
          {boardColumn}
        </div>
        {paneOpen && (
          <aside
            aria-label={t("game.combat.ruleset.screen.pane")}
            data-game-section="ruleset-pane"
            className={cn(
              "absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--card)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] transition-[height] duration-200",
              sheet === "full" ? "h-[88%]" : boardStep ? "h-[34%]" : "h-[52%]",
            )}
          >
            <button
              type="button"
              aria-expanded={sheet === "full"}
              aria-label={t(
                sheet === "full" ? "game.combat.ruleset.screen.sheetLess" : "game.combat.ruleset.screen.sheetMore",
              )}
              onClick={() => setSheet(sheet === "full" ? "peek" : "full")}
              className="flex h-6 shrink-0 items-center justify-center"
            >
              <span className="h-1 w-10 rounded-full bg-[var(--muted-foreground)]/50" />
            </button>
            {paneBody(sheet === "full")}
          </aside>
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
      {boardColumn}
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
        return Array.from({ length: Math.min(total, 6) }, (_, index) => (
          <RulesetBudgetPip
            key={`${mark.id}-${index}`}
            mark={mark}
            spent={!usable || index >= left}
            title={t("game.combat.ruleset.status.budget", { label: mark.label, left: usable ? left : 0 })}
          />
        ));
      })}
    </span>
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
          <span className="w-24 shrink-0 truncate" title={pool.label}>
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
