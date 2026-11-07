// ──────────────────────────────────────────────
// Classic: what an item does, shown before it is worn (owner 2026-11-06: players should see an
// item's effects from the inventory, not only by equipping it).
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { marinaraItemFacts } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

/** An item's numbers on one line and its summary under them; nothing for an id the tables don't know. */
export function MarinaraItemFacts({ itemId, className }: { itemId: string | undefined; className?: string }) {
  const { t } = useTranslation();
  const facts = itemId ? marinaraItemFacts(itemId) : undefined;
  if (!facts) return null;
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const numbers = [
    t("game.combat.marinara.item.tier", { n: facts.tier }),
    facts.range ? t(`game.combat.marinara.item.${facts.range}`) : null,
    facts.might !== undefined ? t("game.combat.marinara.item.might", { n: facts.might }) : null,
    facts.spell !== undefined ? t("game.combat.marinara.item.spell", { n: facts.spell }) : null,
    facts.hit ? t("game.combat.marinara.item.hit", { n: signed(facts.hit) }) : null,
    facts.crit ? t("game.combat.marinara.item.crit", { n: signed(facts.crit) }) : null,
    facts.defense ? t("game.combat.marinara.item.defense", { n: signed(facts.defense) }) : null,
    facts.resistance ? t("game.combat.marinara.item.resistance", { n: signed(facts.resistance) }) : null,
    facts.weight ? t("game.combat.marinara.item.weight", { n: facts.weight }) : null,
  ].filter((part): part is string => !!part);
  const users = facts.archetypes?.length
    ? t("game.combat.marinara.item.usedBy", {
        trees: facts.archetypes.map((tree) => t(`game.combat.marinara.archetype.${tree}`)).join(", "),
      })
    : null;
  return (
    <div className={cn("space-y-0.5 text-[0.65rem] leading-tight", className)} data-testid="marinara-item-facts">
      {facts.kind !== "consumable" && <div className="opacity-80">{numbers.join(" · ")}</div>}
      <div>{facts.summary}</div>
      {users && <div className="opacity-70">{users}</div>}
    </div>
  );
}
