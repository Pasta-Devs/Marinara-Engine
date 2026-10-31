import { CombatWeatherSummary } from "./CombatWeatherSummary";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ApiError } from "../../lib/api-client";
import type {
  CombatDecisionOption,
  RulesetDefinition,
  TacticalBattlefieldBrief,
  TacticalTerrain,
} from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { isRulesetRefusal, useDirectedCombat } from "../../hooks/use-directed-combat";
import { GameCombatUI } from "./GameCombatUI";
import { RulesetCombatScreen, RulesetFightEnd } from "./RulesetCombatScreen";
import { RulesetKindsContext } from "./RulesetKindsContext";
import { RulesetTextContext, rulesetTextLookup, translateRulesetView } from "../../lib/ruleset-text";
import { useRulesetStrings } from "../../hooks/use-capability-packages";
import { RulesetCombatStatus } from "./RulesetCombatStatus";
import { readSpendChoice, writeSpendChoice } from "./RulesetSpendToggle";
import { rulesetValueLabel } from "../../lib/ruleset-combat-log";
import { rulesetSpendCarry, runRulesetSpendCarry, type RulesetSpendCarried } from "../../lib/ruleset-combat-menu";
import type { RulesetCellChoice } from "../../lib/ruleset-combat-board";
import { TacticalCombatUI } from "./TacticalCombatUI";
import { CombatAiControls } from "./CombatAiControls";
import { cn } from "../../lib/utils";
import { GAME_SECTION_CLASS } from "../../lib/chat-widget-colors";

type Props = ComponentProps<typeof GameCombatUI> & {
  anchor: string;
  style: "classic" | "tactical" | "ruleset";
  environment?: string;
  /** The battlefield the scene is laid out like (worldgen W6d), for the board's colours; the server is
   *  sent the scene's own word and lays it out itself. */
  environmentLike?: string;
  /** The setting's own words for the board's tiles (worldgen W6d). */
  tileWords?: Partial<Record<TacticalTerrain, string>>;
  formation?: string;
  battlefield?: TacticalBattlefieldBrief;
  /** The rules the game is pinned to, for a fight the ruleset resolves. It is what names budgets,
   *  conditions, saves and tiers on screen, so the fight reads in the ruleset's own words. */
  rulesetDefinition?: RulesetDefinition;
  /** Ask for a fight the ruleset resolves to be fought on a board. The ruleset still has to say
   *  what a cell is worth, and the screen decides from the VIEW rather than from this. */
  positioned?: boolean;
};
export function DirectedCombatUI(props: Props) {
  const { t, i18n } = useTranslation();
  const {
    session: s,
    error,
    loading,
    busy,
    send,
    refresh,
    viewedAt,
  } = useDirectedCombat({
    chatId: props.chatId,
    anchor: props.anchor,
    style: props.style,
    party: props.party,
    enemies: props.enemies,
    environment: props.environment,
    formation: props.formation,
    battlefield: props.battlefield,
    positioned: props.positioned,
    mechanics: props.combatMechanics,
    inventory: props.inventoryItems,
    itemEffects: props.combatItemEffects,
  });
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (s?.window?.controller === "manual") firstChoice.current?.focus();
  }, [s?.window?.id, s?.window?.controller]);
  const definition = props.rulesetDefinition;
  const budgetLabel = useMemo(() => {
    const labels = new Map((definition?.combat?.economy.budgets ?? []).map((budget) => [budget.id, budget.label]));
    return (id: string) => labels.get(id) ?? id;
  }, [definition]);
  // What the ruleset calls the number an attack is rolled against, for the one prompt that shows it.
  const defenseLabel = definition ? rulesetValueLabel(definition, definition.combat?.defense) : "";
  // What the player reads of the ruleset is in their language where it ships a translation (1.811);
  // what goes back to the story (the summary, the choices sent) stays the ruleset's own English.
  const strings = useRulesetStrings(definition?.id, definition?.version, i18n.resolvedLanguage ?? i18n.language);
  const rulesetText = useMemo(() => rulesetTextLookup(strings.data?.strings), [strings.data]);
  const shown = useMemo(
    () => (s?.ruleset ? translateRulesetView(s.ruleset, rulesetText) : undefined),
    [s?.ruleset, rulesetText],
  );
  // The kinds a zone strikes, named in the menu as it is cast (1.753), sent with that option once.
  // Every hook comes before the loading return, so the screen asks for the same hooks every time.
  const namedKinds = useRef<{ optionId: string; kinds: string[] } | null>(null);
  const nameKinds = useCallback((optionId: string, kinds: string[]) => {
    namedKinds.current = { optionId, kinds };
  }, []);
  // Leaving ends the fight for good, so it asks once more first, as the menu's own Leave does.
  const [leaving, setLeaving] = useState(false);
  // Whether the player picks their own symbol spends (1.382) is this browser's, carried into each new
  // fight once, as it opens: the fight starts with the Engine picking.
  const spendsCarried = useRef<RulesetSpendCarried | null>(null);
  const [preferSpends, setPreferSpends] = useState(readSpendChoice);
  const carry = rulesetSpendCarry(
    s?.style === "ruleset" ? s : undefined,
    viewedAt,
    busy,
    spendsCarried.current,
    preferSpends,
  );
  const carryKey = carry?.key;
  const carrySends = !!carry?.send;
  const carryRevision = carry?.revision;
  const carryView = carry?.view;
  useEffect(() => {
    if (carryKey === undefined || carryRevision === undefined || carryView === undefined) return;
    runRulesetSpendCarry(
      { key: carryKey, send: carrySends, revision: carryRevision, view: carryView },
      spendsCarried,
      send,
      isRulesetRefusal,
    );
  }, [carryKey, carrySends, carryRevision, carryView, send]);
  const chooseSpends = (choose: boolean) => {
    writeSpendChoice(choose);
    setPreferSpends(choose);
    send({ type: "spends", choose });
  };
  if (loading || !s)
    return (
      <div className="flex h-full items-center justify-center p-4 text-[var(--foreground)]" role="status">
        {error ? t("game.combat.director.error") : t("game.combat.director.loading")}
        {/* The server's own reason, where it gave one: "Nobody in this party has a ruleset sheet". */}
        {error instanceof ApiError && typeof (error.payload as { error?: unknown } | undefined)?.error === "string" && (
          <span className="ml-2 text-[var(--muted-foreground)]">{(error.payload as { error: string }).error}</span>
        )}
        {error && (
          <button onClick={() => void refresh()} className="ml-3 min-h-11 px-3">
            {t("game.combat.director.retry")}
          </button>
        )}
        {/* A battle that cannot be read is no dead end (2026-10-23 playtest): the party walks out of
            it, nothing changed, and the story goes on. */}
        {error && (
          <button
            onClick={() =>
              leaving
                ? props.onCombatEnd("flee", { outcome: "flee", rounds: 0, party: [], enemies: [] })
                : setLeaving(true)
            }
            className="ml-3 min-h-11 px-3"
          >
            {t(leaving ? "game.combat.ruleset.menu.fleeConfirm" : "game.combat.director.leave")}
          </button>
        )}
      </div>
    );
  const name = (id?: string) => [...s.party, ...s.enemies].find((u) => u.id === id)?.name ?? "";
  const label = (c: CombatDecisionOption) =>
    t(`game.combat.director.option.${c.kind}`, {
      skill: c.skillName ?? "",
      target: name(c.targetId),
      x: c.to?.x ?? 0,
      y: c.to?.y ?? 0,
    });
  const finish = () => {
    // A ruleset fight hands over its OWN summary beside the Engine's: the recap is written from the
    // ruleset's pools, its conditions and its rounds, not from a share of a maximum.
    if (s.summary) {
      const fought = s.ruleset?.summary;
      props.onCombatEnd(s.summary.outcome, fought ? { ...s.summary, ruleset: fought } : s.summary);
    } else send({ type: "flee" });
  };
  const canAct = s.stage === "action" && !s.window && !busy;
  // A ruleset fight only reads as one when the rules it was started on can still be read here, which
  // is exactly when the server sends its view. Without either, the shell is the Classic one.
  const fight = s.style === "ruleset" && definition ? shown : undefined;
  // The screen decides from the VIEW, never from what was asked for: a grid on it is a fight with
  // positions, and a fight without one keeps the Classic stage it has had since C3.
  const board = fight?.grid ? fight : undefined;
  /** One ruleset choice, with the two cells only a positioned fight ever carries. */
  const choose = (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    cell?: RulesetCellChoice,
    style?: string,
    mode?: string,
    amount?: number,
    alters?: string[],
    spares?: string[],
    heightens?: string,
  ) => {
    const kinds = namedKinds.current?.optionId === optionId ? namedKinds.current.kinds : undefined;
    namedKinds.current = null;
    send({
      type: "ruleset",
      optionId,
      targetIds,
      ...(kinds?.length ? { kinds } : {}),
      ...(payWith ? { payWith } : {}),
      ...(style ? { style } : {}),
      ...(mode ? { mode } : {}),
      ...(cell?.to ? { to: cell.to } : {}),
      ...(cell?.at ? { at: cell.at } : {}),
      ...(cell?.toward ? { toward: cell.toward } : {}),
      ...(cell?.side ? { side: cell.side } : {}),
      ...(cell?.ring ? { ring: true } : {}),
      ...(cell?.also?.length ? { also: cell.also } : {}),
      ...(cell?.wall ? { wall: cell.wall } : {}),
      ...(cell?.dispel ? { dispel: cell.dispel } : {}),
      ...(cell?.cut ? { cut: cell.cut } : {}),
      ...(cell?.storesIn ? { storesIn: cell.storesIn } : {}),
      ...(cell?.ends?.length ? { ends: cell.ends } : {}),
      ...(cell?.carries?.length ? { carries: cell.carries } : {}),
      ...(cell?.designates?.length ? { designates: cell.designates } : {}),
      ...(cell?.to && cell.rises ? { rises: cell.rises } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(alters?.length ? { alters } : {}),
      ...(alters?.length && spares ? { spares } : {}),
      ...(alters?.length && heightens ? { heightens } : {}),
    });
  };
  // A fight on a board is its own screen: the board, the log under it and the combat pane, with
  // nothing of the bottom strip the other styles keep.
  if (board && definition) {
    return (
      <RulesetKindsContext.Provider value={nameKinds}>
        <RulesetTextContext.Provider value={rulesetText}>
          <RulesetCombatScreen
            definition={definition}
            view={board}
            units={[...s.party, ...s.enemies]}
            weather={s.weather}
            environment={board.grid?.scene ?? props.environmentLike ?? props.environment}
            busy={busy}
            budgetLabel={(id) => rulesetText(budgetLabel(id))}
            defenseLabel={rulesetText(defenseLabel)}
            onChoose={choose}
            onFlee={() => send({ type: "flee" })}
            onYield={() => send({ type: "yield" })}
            onControl={(unitId, controller) => send({ type: "control", unitId, controller })}
            onControlCompanions={(controller) => send({ type: "controlCompanions", controller })}
            onSpends={chooseSpends}
            onDeploy={(unitId, to) => send({ type: "deploy", unitId, to })}
            onDeployed={() => send({ type: "deployed" })}
            onDraw={(unitId, item) => send({ type: "draw", unitId, item })}
            onAmmo={(unitId, weapon, stack) => send({ type: "ammo", unitId, weapon, stack })}
            controls={
              <CombatAiControls
                // A ruleset fight takes a companion's controller at any time but a decision (the
                // server refuses that one), so having acted this round locks nothing here. In a shared
                // room only the viewer's own are offered (2026-10-26).
                party={s.party
                  .filter((member) => !board.yours || board.yours.includes(member.id))
                  .map((member) => ({ ...member, hasActed: false }))}
                defaultController="ai"
                locked={busy}
                onChange={(unitId, controller) => send({ type: "control", unitId, controller })}
                onOrders={(unitId, orders) => send({ type: "orders", unitId, orders })}
              />
            }
            notice={
              <>
                {error && (
                  <div
                    role="alert"
                    className="shrink-0 border-b border-[var(--border)] px-3.5 py-2.5 text-sm text-[var(--destructive)]"
                  >
                    {t("game.combat.director.error")}{" "}
                    <button className="min-h-9 px-2 underline" onClick={() => void refresh()}>
                      {t("game.combat.director.retry")}
                    </button>
                  </div>
                )}
                {s.outcome && (
                  <RulesetFightEnd
                    view={board}
                    outcome={s.outcome}
                    ended={s.summary}
                    loot={s.summary?.loot}
                    onFinish={finish}
                  />
                )}
              </>
            }
            ended={!!s.outcome}
          />
        </RulesetTextContext.Provider>
      </RulesetKindsContext.Provider>
    );
  }
  return (
    <RulesetKindsContext.Provider value={nameKinds}>
      <RulesetTextContext.Provider value={rulesetText}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {s.style === "tactical" && s.tactical ? (
              <TacticalCombatUI
                tileWords={props.tileWords}
                chatId={props.chatId}
                party={s.party}
                enemies={s.enemies}
                initialState={s.tactical}
                onCombatEnd={finish}
                directed={{
                  state: s.tactical,
                  items: s.inventory.flatMap((item) => {
                    const effect = props.combatItemEffects?.find((effect) => effect.name === item.name);
                    return effect && item.quantity > 0 ? [{ ...item, effect }] : [];
                  }),
                  actorId: s.actorId,
                  canAct,
                  busy: busy || !!s.window,
                  onAction: (action) =>
                    send(
                      action.type === "flee"
                        ? { type: "flee" }
                        : action.type === "control"
                          ? { type: "control", unitId: action.unitId, controller: action.controller }
                          : action.type === "orders"
                            ? { type: "orders", unitId: action.unitId, orders: action.orders }
                            : { type: "tactical", action },
                    ),
                }}
              />
            ) : (
              <GameCombatUI
                {...props}
                party={s.party}
                enemies={s.enemies}
                inventoryItems={s.inventory}
                onCombatEnd={finish}
                directed={{
                  actorId: s.actorId,
                  canAct,
                  round: s.round,
                  outcome: s.outcome,
                  onAction: (action) => send(action.type === "flee" ? { type: "flee" } : { type: "classic", action }),
                  onControl: (unitId, controller) => send({ type: "control", unitId, controller }),
                  onOrders: (unitId, orders) => send({ type: "orders", unitId, orders }),
                  ...(fight
                    ? {
                        ruleset: {
                          view: fight,
                          // Shown in the player's language, as on a board (the summary sent back stays the ruleset's own).
                          budgetLabel: (id: string) => rulesetText(budgetLabel(id)),
                          defenseLabel: rulesetText(defenseLabel),
                          busy,
                          onChoose: choose,
                          onFlee: () => send({ type: "flee" }),
                          onYield: () => send({ type: "yield" }),
                          onSpends: chooseSpends,
                          onDraw: (unitId, item) => send({ type: "draw", unitId, item }),
                          onAmmo: (unitId, weapon, stack) => send({ type: "ammo", unitId, weapon, stack }),
                        },
                      }
                    : {}),
                }}
              />
            )}
          </div>
          <CombatWeatherSummary weather={s.weather} tactical={s.style === "tactical"} />
          <section
            aria-label={t("game.combat.director.title")}
            data-game-section="combat-director"
            className={cn(
              GAME_SECTION_CLASS,
              "shrink-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)]",
              // A ruleset fight's log scrolls inside its own box, so this strip stays short and the
              // stage keeps the room its two rows need.
              fight ? "max-h-[20svh] px-3 py-1.5 sm:max-h-[26svh] sm:p-3" : "max-h-[42svh] p-3",
            )}
          >
            {error && (
              <div role="alert" className="mb-2 text-[var(--destructive)]">
                {t("game.combat.director.error")}{" "}
                <button className="min-h-11 px-3 underline" onClick={() => void refresh()}>
                  {t("game.combat.director.retry")}
                </button>
              </div>
            )}
            {/* The Engine's own legendary points and reactions belong to the other two styles: a fight
            the ruleset resolves spends the ruleset's budgets, which the panel below reports. */}
            {!fight && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--muted-foreground)]">
                {s.enemies
                  .filter((u) => u.boss)
                  .map((u) => (
                    <span key={u.id}>
                      {t("game.combat.director.budget", {
                        name: u.name,
                        points: s.budgets[u.id]?.legendary ?? 0,
                        max: u.boss!.points,
                      })}
                    </span>
                  ))}
                {s.party
                  .filter((u) => u.hp > 0 && u.skills?.some((k) => k.reaction))
                  .map((u) => (
                    <span key={u.id}>
                      {t("game.combat.director.reactions", { name: u.name, count: s.budgets[u.id]?.reaction ?? 0 })}
                    </span>
                  ))}
                {s.actorId && <span>{t("game.combat.director.active", { name: name(s.actorId) })}</span>}
              </div>
            )}
            {fight && definition && <RulesetCombatStatus definition={definition} view={fight} />}
            {s.stage === "select" && s.style === "classic" && (
              <button
                disabled={busy}
                className="mt-2 min-h-11 rounded-md bg-[var(--secondary)] px-3"
                onClick={() => send({ type: "continue" })}
              >
                {t("game.combat.director.waitRound")}
              </button>
            )}
            {s.stage === "select" && s.style === "tactical" && !busy && (
              <div className="mt-2 flex flex-wrap gap-2">
                <p className="w-full text-xs text-[var(--muted-foreground)]">{t("game.combat.director.beginHint")}</p>
                {s.party
                  .filter(
                    (u) =>
                      u.hp > 0 &&
                      !s.tactical?.units.find((tu) => tu.id === u.id)?.hasActed &&
                      u.speed +
                        (u.statusEffects ?? [])
                          .filter((e) => e.stat === "speed" && e.turnsLeft > 0)
                          .reduce((n, e) => n + e.modifier, 0) >
                        0 &&
                      !(u.statusEffects ?? []).some(
                        (e) =>
                          e.turnsLeft > 0 &&
                          /^(frozen|stun|stunned|imprisoned|paralyzed|incapacitated|sleep|asleep)$/i.test(
                            e.name.trim(),
                          ),
                      ),
                  )
                  .map((u) => (
                    <button
                      key={u.id}
                      className="min-h-11 rounded-md bg-[var(--secondary)] px-3 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                      onClick={() => send({ type: "begin", unitId: u.id })}
                    >
                      {t("game.combat.director.begin", { name: u.name })}
                    </button>
                  ))}
              </div>
            )}
            {s.window && (
              <div className="mt-2" aria-live="polite">
                <p className="font-medium">
                  {t(`game.combat.director.window.${s.window.kind}`, {
                    name: name(s.window.actorId),
                    trigger: name(s.window.triggerActorId),
                    skill: s.window.triggerSkillName ?? "",
                  })}
                </p>
                {s.window.controller === "gm" ? (
                  <div className="mt-2 flex items-center gap-3">
                    <span role="status">{t("game.combat.director.thinking")}</span>
                    <button
                      className="min-h-11 rounded-md border border-[var(--border)] px-3"
                      onClick={() => send({ type: "fallback" })}
                    >
                      {t("game.combat.director.fallback")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.window.options.map((c, i) => (
                      <button
                        ref={i === 0 ? firstChoice : undefined}
                        key={c.id}
                        disabled={busy}
                        onClick={() => send({ type: "choose", candidateId: c.id })}
                        className="min-h-11 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-left disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                      >
                        <span>{label(c)}</span>
                        {c.kind !== "pass" && (
                          <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                            {c.slotLevel
                              ? t("game.combat.director.slotCost", { level: c.slotLevel })
                              : t("game.combat.director.mpCost", { amount: c.mpCost })}{" "}
                            · {t("game.combat.director.reactionCost")}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {s.log.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer py-1">{t("game.combat.director.events")}</summary>
                <ol className="mt-1 space-y-1 text-xs text-[var(--muted-foreground)]">
                  {s.log.slice(-12).map((e) => (
                    <li key={e.id}>
                      {e.message ? t(e.message.key, { ...e.message.params, defaultValue: e.text }) : e.text}
                      {e.message?.suffixKey && ` ${t(e.message.suffixKey)}`}
                      {e.source === "fallback" && ` (${t("game.combat.director.fallbackUsed")})`}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {s.outcome && (
              <button
                className="mt-2 min-h-11 rounded-md bg-[var(--primary)] px-4 text-[var(--primary-foreground)]"
                onClick={finish}
              >
                {t("game.combat.director.finish")}
              </button>
            )}
          </section>
        </div>
      </RulesetTextContext.Provider>
    </RulesetKindsContext.Provider>
  );
}
