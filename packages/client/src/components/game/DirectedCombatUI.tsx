import { CombatAiControls } from "./CombatAiControls";
import { CombatWeatherSummary } from "./CombatWeatherSummary";
import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import type { CombatDecisionOption, RulesetDefinition, TacticalBattlefieldBrief } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { useDirectedCombat } from "../../hooks/use-directed-combat";
import { GameCombatUI } from "./GameCombatUI";
import { RulesetCombatBoard } from "./RulesetCombatBoard";
import { RulesetCombatStatus } from "./RulesetCombatStatus";
import { TacticalCombatUI } from "./TacticalCombatUI";
import { cn } from "../../lib/utils";

type Props = ComponentProps<typeof GameCombatUI> & {
  anchor: string;
  style: "classic" | "tactical" | "ruleset";
  environment?: string;
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
  const { t } = useTranslation();
  const {
    session: s,
    error,
    loading,
    busy,
    send,
    refresh,
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
  if (loading || !s)
    return (
      <div className="flex h-full items-center justify-center p-4 text-[var(--foreground)]" role="status">
        {error ? t("game.combat.director.error") : t("game.combat.director.loading")}
        {error && (
          <button onClick={() => void refresh()} className="ml-3 min-h-11 px-3">
            {t("game.combat.director.retry")}
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
  const fight = s.style === "ruleset" && definition ? s.ruleset : undefined;
  // The screen decides from the VIEW, never from what was asked for: a grid on it is a fight with
  // positions, and a fight without one keeps the Classic stage it has had since C3.
  const board = fight?.grid ? fight : undefined;
  /** One ruleset choice, with the two cells only a positioned fight ever carries. */
  const choose = (
    optionId: string,
    targetIds: string[],
    payWith?: string,
    cell?: { to?: { x: number; y: number }; at?: { x: number; y: number } },
  ) =>
    send({
      type: "ruleset",
      optionId,
      targetIds,
      ...(payWith ? { payWith } : {}),
      ...(cell?.to ? { to: cell.to } : {}),
      ...(cell?.at ? { at: cell.at } : {}),
    });
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {s.style === "tactical" && s.tactical ? (
          <TacticalCombatUI
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
                      : { type: "tactical", action },
                ),
            }}
          />
        ) : board ? (
          <RulesetCombatBoard
            view={board}
            units={[...s.party, ...s.enemies]}
            budgetLabel={budgetLabel}
            environment={props.environment}
            busy={busy}
            onChoose={choose}
            onFlee={() => send({ type: "flee" })}
            controls={
              <CombatAiControls
                party={s.party}
                enemies={s.enemies}
                defaultController="ai"
                locked={busy}
                onChange={(unitId, controller) => send({ type: "control", unitId, controller })}
              />
            }
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
              ...(fight
                ? {
                    ruleset: {
                      view: fight,
                      budgetLabel,
                      busy,
                      onChoose: choose,
                      onFlee: () => send({ type: "flee" }),
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
        className={cn(
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
                      /^(frozen|stun|stunned|imprisoned|paralyzed|incapacitated|sleep|asleep)$/i.test(e.name.trim()),
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
  );
}
