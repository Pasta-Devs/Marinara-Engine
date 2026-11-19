// The In hand row of a ruleset fight (2026-10-26, owner-approved): what the fighter whose turn it is
// holds in hand, a select to take a carried weapon or shield in hand on their own turn, and beside each
// weapon that shoots from the bag, a select for the stack it shoots first.
//
// Presentational: every fact is the view's (`DirectedRulesetCombatant.hands`), and both selects only
// send a command. Shown only to the player who commands the fighter.
import type { DirectedRulesetCombatant, DirectedRulesetView } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";

export interface RulesetInHandProps {
  view: DirectedRulesetView;
  busy: boolean;
  /** A carried item taken in hand, by its place in the fighter's items. */
  onDraw: (unitId: string, item: number) => void;
  /** The stack a weapon shoots first, both by their places in the fighter's items. */
  onAmmo: (unitId: string, weapon: number, stack: number) => void;
}

/** The fighter whose turn it is, when the viewer commands them and they have hands to show. */
export function rulesetInHandFighter(view: DirectedRulesetView): DirectedRulesetCombatant | undefined {
  const actor = view.combatants.find((one) => one.id === view.actorId);
  if (!actor?.hands || actor.side !== "party") return undefined;
  return !view.yours || view.yours.includes(actor.id) ? actor : undefined;
}

export function RulesetInHand({ view, busy, onDraw, onAmmo }: RulesetInHandProps) {
  const { t: localizeUi } = useTranslation();
  const actor = rulesetInHandFighter(view);
  const hands = actor?.hands;
  if (!actor || !hands) return null;
  // Taking something in hand is part of the fighter's own turn: only while their menu is the viewer's.
  const ownTurn = !!view.options && !view.window && !view.deploy;
  const held = hands.holding.map((one) => one.name);
  const room = hands.slots.reduce((sum, slot) => sum + slot.count, 0);
  const free = Math.max(0, room - hands.holding.reduce((sum, one) => sum + one.takes, 0));
  const ammo = hands.ammo.filter((weapon) => weapon.stacks.length > 1);
  return (
    <section
      aria-label={localizeUi("game.combat.ruleset.inHand.title")}
      data-game-section="ruleset-in-hand"
      className="shrink-0 space-y-1.5 border-t border-[var(--border)] px-3.5 py-2 text-[0.72rem]"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 font-semibold text-[var(--muted-foreground)]">
          {localizeUi("game.combat.ruleset.inHand.title")}
        </span>
        <span className="min-w-0 flex-1 truncate" title={held.join(", ")}>
          {held.length ? held.join(", ") : localizeUi("game.combat.ruleset.inHand.nothing")}
          {free > 0 && held.length > 0 && (
            <span className="text-[var(--muted-foreground)]">
              {" "}
              {localizeUi("game.combat.ruleset.inHand.free", { count: free })}
            </span>
          )}
        </span>
        {ownTurn && hands.carried.length > 0 && (
          <Select
            label={localizeUi("game.combat.ruleset.inHand.drawLabel")}
            title={hands.free ? undefined : localizeUi("game.combat.ruleset.inHand.spent")}
            value={null}
            placeholder={localizeUi("game.combat.ruleset.inHand.draw")}
            disabled={busy || !hands.free}
            onChange={(next) => {
              const item = Number(next);
              if (next !== "" && Number.isInteger(item)) onDraw(actor.id, item);
            }}
            className="min-h-8 max-w-[11rem] rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 disabled:opacity-60"
            options={hands.carried.map((one) => ({
              value: String(one.item),
              label: one.name,
              disabledReason: one.blockedBy
                ? one.blockedBy.length
                  ? localizeUi("game.combat.ruleset.inHand.blocked", { item: one.name, by: one.blockedBy.join(", ") })
                  : localizeUi("game.combat.ruleset.inHand.noRoom", { item: one.name })
                : undefined,
            }))}
          />
        )}
      </div>
      {ammo.map((weapon) => (
        <div key={weapon.weapon} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[var(--muted-foreground)]">
            {localizeUi("game.combat.ruleset.inHand.ammo", { weapon: weapon.name })}
          </span>
          <Select
            label={localizeUi("game.combat.ruleset.inHand.ammo", { weapon: weapon.name })}
            value={String(weapon.first)}
            disabled={busy}
            onChange={(next) => onAmmo(actor.id, weapon.weapon, Number(next))}
            className="min-h-8 max-w-[11rem] rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 disabled:opacity-60"
            options={weapon.stacks.map((stack) => ({
              value: String(stack.item),
              label: localizeUi("game.combat.ruleset.inHand.ammoStack", { name: stack.name, left: stack.left }),
            }))}
          />
        </div>
      ))}
    </section>
  );
}
