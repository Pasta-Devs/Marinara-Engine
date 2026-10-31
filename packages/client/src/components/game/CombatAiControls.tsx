import { useTranslation } from "react-i18next";
import { COMBAT_POSTURES, type CombatController, type CombatOrders, type CombatTactics } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";

interface Member {
  id: string;
  name: string;
  hp: number;
  tactics?: CombatTactics;
  controller?: CombatController;
  orders?: CombatOrders;
  hasActed?: boolean;
}

export function CombatAiControls({
  party,
  defaultController,
  locked,
  onChange,
  onOrders,
  className,
}: {
  party: Member[];
  defaultController: CombatController;
  locked: boolean;
  onChange: (id: string, controller: CombatController) => void;
  /** A companion's standing orders, where the fight takes them; null goes back to its default. */
  onOrders?: (id: string, orders: CombatOrders | null) => void;
  /** GAME_SECTION_CLASS where the controls stand alone, outside another Game section. */
  className?: string;
}) {
  const { t } = useTranslation();
  const leader = party.find((u) => u.hp > 0)?.id;
  const describe = (member: Member) =>
    member.tactics
      ? t("game.combat.ai.profile", {
          name: member.name,
          adjective: t(`game.combat.ai.adjective.${member.tactics.adjective}`),
          role: t(`game.combat.ai.role.${member.tactics.role}`),
        })
      : member.name;
  // A posture, with whom it protects folded in: "protect:<id>".
  const postureOf = (orders?: CombatOrders) =>
    orders?.posture === "protect" ? `protect:${orders.protectId}` : (orders?.posture ?? "guard");
  const ordered = (member: Member, change: Partial<CombatOrders> & { pick?: string }) => {
    const { pick, ...flags } = change;
    const current = member.orders ?? {};
    const next: CombatOrders = { ...current, ...flags };
    if (pick !== undefined) {
      delete next.protectId;
      if (pick.startsWith("protect:")) {
        next.posture = "protect";
        next.protectId = pick.slice("protect:".length);
      } else next.posture = pick as CombatOrders["posture"];
    }
    for (const key of ["conserve", "heal", "spare"] as const) if (!next[key]) delete next[key];
    if (next.posture === "guard") delete next.posture;
    onOrders?.(member.id, Object.keys(next).length > 0 ? next : null);
  };
  const postureLabel = (orders?: CombatOrders) =>
    orders?.posture === "protect"
      ? t("game.combat.ai.posture.protect", {
          name: party.find((other) => other.id === orders.protectId)?.name ?? orders.protectId,
        })
      : t(`game.combat.ai.posture.${orders?.posture ?? "guard"}`);
  const orderLine = onOrders
    ? party
        .filter((member) => member.id !== leader && member.hp > 0 && (member.controller ?? defaultController) === "ai")
        .map((member) => t("game.combat.ai.orderSummary", { name: member.name, posture: postureLabel(member.orders) }))
        .join(", ")
    : "";
  return (
    <details
      data-game-section="combat-ai"
      className={cn(
        "relative z-10 shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]",
        className,
      )}
    >
      <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-[var(--primary)]">
        {t("game.combat.ai.controls")}
        {/* Each AI companion's orders, read while the panel is closed (2026-10-23 playtest: hidden). */}
        {orderLine && <span className="ml-2 font-normal text-[var(--muted-foreground)]">{orderLine}</span>}
      </summary>
      <p className="my-2 text-[var(--muted-foreground)]">{t("game.combat.ai.help")}</p>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {party.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{describe(member)}</span>
            <select
              aria-label={t("game.combat.ai.controllerFor", { name: member.name })}
              value={member.id === leader ? "manual" : (member.controller ?? defaultController)}
              disabled={locked || member.id === leader || member.hp <= 0 || member.hasActed}
              onChange={(event) => onChange(member.id, event.target.value as CombatController)}
              className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 disabled:opacity-60"
            >
              <option value="manual">{t("game.combat.ai.manual")}</option>
              <option value="ai">{t("game.combat.ai.automatic")}</option>
            </select>
            {onOrders && member.id !== leader && (member.controller ?? defaultController) === "ai" && member.hp > 0 && (
              <span className="flex w-full flex-wrap items-center gap-2">
                <select
                  aria-label={t("game.combat.ai.ordersFor", { name: member.name })}
                  value={postureOf(member.orders)}
                  disabled={locked}
                  onChange={(event) => ordered(member, { pick: event.target.value })}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 disabled:opacity-60"
                >
                  {COMBAT_POSTURES.filter((posture) => posture !== "protect").map((posture) => (
                    <option key={posture} value={posture}>
                      {t(`game.combat.ai.posture.${posture}`)}
                    </option>
                  ))}
                  {party
                    // The one it protects stays named while down, so the order shown is the order kept.
                    .filter(
                      (other) =>
                        other.id !== member.id &&
                        (other.hp > 0 ||
                          (member.orders?.posture === "protect" && other.id === member.orders.protectId)),
                    )
                    .map((other) => (
                      <option key={other.id} value={`protect:${other.id}`}>
                        {t("game.combat.ai.posture.protect", { name: other.name })}
                      </option>
                    ))}
                  {member.orders?.posture === "protect" &&
                    !party.some((other) => other.id === member.orders?.protectId) && (
                      <option value={postureOf(member.orders)}>{postureLabel(member.orders)}</option>
                    )}
                </select>
                {(["conserve", "heal", "spare"] as const).map((flag) => (
                  <label key={flag} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!member.orders?.[flag]}
                      disabled={locked}
                      onChange={(event) => ordered(member, { [flag]: event.target.checked })}
                    />
                    {t(`game.combat.ai.order.${flag}`)}
                  </label>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
