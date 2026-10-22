// The turn order of a fight on a board, as one dense table in the combat pane: initiative, who, a
// line on what they are and how they stand, their health, their defense, and who plays them. A row
// opens into the details the fight sent for that combatant.
//
// Every number is the view's. The rows only print it; the Player/AI choice is sent to the server,
// which owns who controls whom, exactly as the old "Party control" strip did.
import { Fragment } from "react";
import {
  rulesetConditionIcons,
  rulesetHideLines,
  type CombatController,
  type Combatant,
  type DirectedRulesetCombatant,
  type DirectedRulesetView,
  type RulesetDefinition,
} from "@marinara-engine/shared";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { ArtIcon } from "./ArtIcon";
import { rulesetEffectPhrase } from "./RulesetItemPicker";
import { rulesetCombatNames, type RulesetCombatNames } from "../../lib/ruleset-combat-log";
import { initialsOf } from "../../lib/tactical-board-look";
import { rulesetHealthPercent } from "../../lib/ruleset-combat-board";
import { cn } from "../../lib/utils";

/** The ruleset's own words for what a combatant is (1.168): "Fiend (devil)". */
export function rulesetKindLine(kind: { type?: string; tags?: string[] }): string {
  const tags = (kind.tags ?? []).join(", ");
  if (!kind.type) return tags;
  return tags ? `${kind.type} (${tags})` : kind.type;
}

/** The one word for how a combatant stands, when it is anything but simply in the fight. The order is
 *  the order that decides: somebody who left is not also down. */
export function rulesetStateWord(combatant: DirectedRulesetCombatant, t: TFunction): string {
  if (combatant.left) return t("game.combat.ruleset.status.left");
  if (combatant.away) return t("game.combat.ruleset.status.away");
  if (combatant.defeated) return t("game.combat.ruleset.status.defeated");
  if (combatant.stable) return t("game.combat.ruleset.status.stable");
  if (combatant.dying) return t("game.combat.ruleset.status.dying");
  if (combatant.down) return t("game.combat.ruleset.status.down");
  if (combatant.surprised) return t("game.combat.ruleset.status.surprised");
  return "";
}

/** The defense column's heading: what the ruleset says (1.375), else its defense's own name made
 *  short, "Armor Class" read as "AC" and a short word kept as it is. */
export function rulesetDefenseShort(definition: RulesetDefinition, names: RulesetCombatNames): string {
  const own = definition.combat?.display?.defense?.short;
  if (own) return own;
  const label = names.defense.trim();
  if (!label) return "";
  if (label.length <= 6) return label;
  const words = label.split(/\s+/u).filter(Boolean);
  return words.length > 1 ? words.map((word) => Array.from(word)[0]!.toLocaleUpperCase()).join("") : label;
}

/** The health bar's colour by how much is left: the same three steps the tokens use. */
export function rulesetHealthTone(percent: number): string {
  return percent > 60 ? "bg-emerald-500" : percent > 25 ? "bg-amber-500" : "bg-red-500";
}

/** A token's small face for the table and the cards: a circle for the party and a rounded square for
 *  the other side, so shape tells the sides apart and colour only repeats it. */
export function RulesetSideBadge({
  combatant,
  className,
}: {
  combatant: Pick<DirectedRulesetCombatant, "name" | "side">;
  className?: string;
}) {
  const party = combatant.side === "party";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center text-[0.6rem] font-extrabold text-white",
        party
          ? "rounded-full bg-[#2a4778] ring-[1.5px] ring-[#9dbdff]"
          : "rounded-[24%] bg-[#6a2133] ring-[1.5px] ring-[#ff9aaa]",
        className,
      )}
    >
      {initialsOf(combatant.name)}
    </span>
  );
}

export function RulesetTurnOrder({
  definition,
  view,
  units,
  selectedId,
  onSelect,
  onControl,
  locked,
}: {
  definition: RulesetDefinition;
  view: DirectedRulesetView;
  /** The Engine's own combatants, for who plays each party member and their AI profile. */
  units: Combatant[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onControl: (id: string, controller: CombatController) => void;
  locked: boolean;
}) {
  const { t } = useTranslation();
  const names = rulesetCombatNames(definition, view, t);
  const byId = new Map(view.combatants.map((combatant) => [combatant.id, combatant]));
  // One who takes two turns this round (1.238) is listed once.
  const order = [...new Set(view.order)].flatMap((id) => {
    const combatant = byId.get(id);
    return combatant ? [combatant] : [];
  });
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  // The leader is whoever of the party is still standing first, as the old controls said: they are
  // always the player's, so their choice is shown and locked.
  const leader = units.find((unit) => unit.side === "player" && unit.hp > 0)?.id;
  const defenseShort = rulesetDefenseShort(definition, names);
  const showDefense = !definition.combat?.display?.defense?.hide;
  const answering = view.window?.actorId;
  const columns = showDefense
    ? "grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_5.25rem_2rem_3.75rem]"
    : "grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_5.25rem_3.75rem]";

  return (
    <section aria-label={t("game.combat.ruleset.status.order")} data-game-section="ruleset-turn-order">
      <div className="flex items-baseline gap-2 px-3.5 pb-1.5 pt-2.5">
        <h3 className="flex-1 text-base font-bold text-[var(--foreground)]">{t("game.combat.ruleset.status.order")}</h3>
        <span className="text-xs text-[var(--muted-foreground)]">
          {t("game.combat.ruleset.status.round", { round: view.round })}
        </span>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "grid h-6 items-center gap-2 px-3.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]",
          columns,
        )}
      >
        <span className="text-right">{t("game.combat.ruleset.screen.initiative")}</span>
        <span />
        <span>{t("game.combat.ruleset.screen.name")}</span>
        <span>{t("game.combat.ruleset.screen.health")}</span>
        {showDefense && (
          <span className="text-center">{defenseShort || t("game.combat.ruleset.status.defenseFallback")}</span>
        )}
        <span>{t("game.combat.ruleset.screen.control")}</span>
      </div>
      <ol className="m-0 list-none p-0">
        {order.map((combatant) => {
          const onTurn = combatant.id === view.actorId;
          const asked = combatant.id === answering;
          const selected = combatant.id === selectedId;
          const unit = unitById.get(combatant.id);
          const percent = rulesetHealthPercent(combatant.health);
          const state = rulesetStateWord(combatant, t);
          const second = [
            combatant.kind ? rulesetKindLine(combatant.kind) : "",
            combatant.tier ? t("game.combat.ruleset.status.tier", { label: names.tier(combatant.tier) }) : "",
            state ||
              (asked
                ? t("game.combat.ruleset.screen.answering")
                : onTurn
                  ? t("game.combat.ruleset.screen.onTurn")
                  : ""),
          ]
            .filter(Boolean)
            .join(" · ");
          const isLeader = combatant.id === leader;
          const party = combatant.side === "party";
          return (
            <li
              key={combatant.id}
              aria-current={onTurn ? "step" : undefined}
              className="border-t border-[var(--border)]/60"
            >
              <div
                data-combatant-row={combatant.id}
                className={cn(
                  "grid min-h-9 items-center gap-2 px-3.5 text-[0.78rem]",
                  columns,
                  onTurn && "bg-[var(--foreground)]/[0.06]",
                  asked && "bg-amber-400/[0.12]",
                  selected && "bg-[var(--primary)]/[0.12]",
                )}
              >
                <span className="text-right text-[0.7rem] font-semibold tabular-nums text-[var(--muted-foreground)]">
                  {onTurn || asked ? (
                    <span
                      aria-hidden="true"
                      className={cn("mr-0.5 text-[0.6rem]", asked ? "text-amber-500" : "text-[var(--foreground)]")}
                    >
                      ▶
                    </span>
                  ) : null}
                  {combatant.initiative}
                </span>
                <RulesetSideBadge combatant={combatant} />
                <button
                  type="button"
                  aria-expanded={selected}
                  onClick={() => onSelect(selected ? null : combatant.id)}
                  className="min-w-0 rounded text-left leading-tight focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                >
                  <span className="block truncate font-semibold text-[var(--foreground)]">{combatant.name}</span>
                  {second && (
                    <span className="block truncate text-[0.66rem] text-[var(--muted-foreground)]">{second}</span>
                  )}
                </button>
                <span className="grid gap-0.5 text-[0.66rem] tabular-nums text-[var(--muted-foreground)]">
                  <span className="h-1.5 overflow-hidden rounded-full bg-[var(--foreground)]/10">
                    <span
                      className={cn("block h-full rounded-full", rulesetHealthTone(percent))}
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span>
                    {t("game.combat.ruleset.screen.healthValue", {
                      value: combatant.health.value,
                      max: combatant.health.max,
                    })}
                    {combatant.health.temp > 0 &&
                      ` ${t("game.combat.ruleset.screen.temp", { amount: combatant.health.temp })}`}
                  </span>
                </span>
                {showDefense && (
                  <span className="text-center text-xs font-semibold tabular-nums text-[var(--foreground)]">
                    {combatant.defense}
                  </span>
                )}
                {party && !isLeader ? (
                  <select
                    aria-label={t("game.combat.ai.controllerFor", { name: combatant.name })}
                    value={unit?.controller ?? "ai"}
                    disabled={locked || combatant.down || combatant.defeated}
                    onChange={(event) => onControl(combatant.id, event.target.value as CombatController)}
                    className="h-6 min-w-0 rounded-md border border-[var(--border)] bg-[var(--background)] px-1 text-[0.7rem] text-[var(--foreground)] disabled:opacity-60"
                  >
                    <option value="manual">{t("game.combat.ai.manual")}</option>
                    <option value="ai">{t("game.combat.ai.automatic")}</option>
                  </select>
                ) : (
                  <span className="inline-flex h-6 items-center rounded-md border border-dashed border-[var(--border)] px-1.5 text-[0.7rem] text-[var(--muted-foreground)]">
                    {party ? t("game.combat.ruleset.screen.you") : t("game.combat.ruleset.screen.enemy")}
                  </span>
                )}
              </div>
              {selected && (
                <RulesetCombatantDetail definition={definition} combatant={combatant} unit={unit} names={names} />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Everything else the fight sent for one combatant, opened under its row. */
function RulesetCombatantDetail({
  definition,
  combatant,
  unit,
  names,
}: {
  definition: RulesetDefinition;
  combatant: DirectedRulesetCombatant;
  unit: Combatant | undefined;
  names: RulesetCombatNames;
}) {
  const { t } = useTranslation();
  const hides = combatant.hides ? rulesetHideLines(definition, [combatant.hides], t) : [];
  const profile = unit?.tactics
    ? `${t(`game.combat.ai.adjective.${unit.tactics.adjective}`)} ${t(`game.combat.ai.role.${unit.tactics.role}`)}`
    : "";
  const empty =
    combatant.conditions.length === 0 &&
    hides.length === 0 &&
    !combatant.concentrating &&
    !(combatant.damageModifiers?.length ?? 0) &&
    !(combatant.saveModifiers?.length ?? 0);
  const track = combatant.dying ? combatant.deathTrack : undefined;
  return (
    <div
      data-combatant-detail={combatant.id}
      className="grid gap-1.5 border-t border-[var(--border)]/60 bg-[var(--primary)]/[0.06] px-3.5 py-2 pl-[4.25rem] text-[0.72rem] text-[var(--muted-foreground)]"
    >
      {(combatant.conditions.length > 0 || combatant.concentrating || profile) && (
        <div className="flex flex-wrap gap-1">
          {combatant.conditions.map((condition) => (
            <span key={condition.id} className={CHIP}>
              <ArtIcon ids={rulesetConditionIcons(definition, condition.id)} className="h-3.5 w-3.5" />
              {typeof condition.rounds === "number"
                ? t("game.combat.ruleset.status.conditionRounds", { label: condition.label, rounds: condition.rounds })
                : condition.label}
            </span>
          ))}
          {combatant.concentrating && (
            <span className={CHIP}>
              {t("game.combat.ruleset.status.concentrating", { label: combatant.concentrating })}
            </span>
          )}
          {profile && <span className={CHIP}>{profile}</span>}
        </div>
      )}
      {track && (
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
          {(
            [
              ["successes", track.successes, track.successesMax, "bg-emerald-500"],
              ["failures", track.failures, track.failuresMax, "bg-red-500"],
            ] as const
          ).map(([which, value, max, tone]) => (
            <Fragment key={which}>
              <span>{names.track(definition.combat?.dying?.[which] ?? "")}</span>
              <span
                role="img"
                aria-label={t("game.combat.ruleset.screen.ofMax", { value, max })}
                className="flex gap-1"
              >
                {Array.from({ length: max }, (_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      index < value ? tone : "ring-[1.5px] ring-inset ring-[var(--border)]",
                    )}
                  />
                ))}
              </span>
            </Fragment>
          ))}
        </div>
      )}
      {hides.map((line) => (
        <p key={line} className="m-0">
          {line}
        </p>
      ))}
      {combatant.damageModifiers?.map((source, index) => (
        <p key={`damage-${index}`} className="m-0">
          <span className="font-semibold text-[var(--foreground)]">{source.name}.</span>{" "}
          {source.facts.map((fact) => rulesetEffectPhrase(fact, t)).join("; ")}
        </p>
      ))}
      {(combatant.saveModifiers ?? []).map((fact, index) => (
        <p key={`save-${index}`} className="m-0">
          {rulesetEffectPhrase(fact, t)}
        </p>
      ))}
      {(combatant.traits ?? []).map((trait) => (
        <p key={trait.name} className="m-0">
          <span className="font-semibold text-[var(--foreground)]">{trait.name}.</span> {trait.text}
        </p>
      ))}
      {empty && <p className="m-0">{t("game.combat.ruleset.screen.nothingSpecial")}</p>}
    </div>
  );
}

const CHIP =
  "inline-flex h-5 items-center gap-1 rounded-[5px] border border-[var(--border)] bg-[var(--foreground)]/[0.04] px-1.5 text-[0.68rem] text-[var(--foreground)]";
