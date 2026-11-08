// What a Classic Marinara fight shows beside the menu (combat overhaul): who acts next on the timeline,
// each fighter's class, level, row, stamina and what is on them, and at the end what the party gained.
import type { Combatant, MarinaraFightGrowth } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";

type Props = {
  party: readonly Combatant[];
  enemies: readonly Combatant[];
  actorId?: string | null;
  growth?: readonly MarinaraFightGrowth[];
  /** What the won fight dropped into the bags. */
  loot?: ReadonlyArray<{ name: string; quantity?: number }>;
  /** The fight is over: nobody acts next. */
  over?: boolean;
  /** Loads another ammunition type for a Marksman of the party (Alyssa 2026-11-01): a free action. */
  onLoadAmmo?: (unitId: string, type: string) => void;
  onChannel?: (unitId: string, element: string) => void;
  busy?: boolean;
};

const pct = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

export function MarinaraFightPanel({
  party,
  enemies,
  actorId,
  growth,
  loot,
  over,
  onLoadAmmo,
  onChannel,
  busy,
}: Props) {
  const { t } = useTranslation();
  const units = [...party, ...enemies].filter((unit) => unit.marinara);
  if (!units.length) return null;
  const order = units
    .filter((unit) => unit.hp > 0)
    .sort((a, b) => (a.id === actorId ? -1 : b.id === actorId ? 1 : a.marinara!.next - b.marinara!.next))
    .slice(0, 6);
  return (
    <div className="mt-2 space-y-2 text-xs" data-testid="marinara-fight-panel">
      {!over && (
        <p className="text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{t("game.combat.marinara.next")}</span>{" "}
          {order.map((unit) => unit.name).join(" → ")}
        </p>
      )}
      {/* What landed hits have shown of each foe so far, in sight without opening the fighter list
          (overnight playtest 2026-11-06: testers kept their own notes of weak spots and resists). */}
      {!over &&
        enemies
          .filter((unit) => unit.hp > 0 && Object.keys(unit.marinara?.affinities ?? {}).length > 0)
          .map((unit) => (
            <p key={unit.id} className="text-[var(--muted-foreground)]" data-testid="marinara-learned">
              <span className="font-medium text-[var(--foreground)]">
                {t("game.combat.marinara.learned", { name: unit.name })}
              </span>{" "}
              {Object.entries(unit.marinara!.affinities!)
                .map(([type, affinity]) =>
                  t(`game.combat.marinara.affinity.${affinity}`, {
                    type: t(`game.combat.marinara.damageType.${type}`, { defaultValue: type }),
                  }),
                )
                .join(", ")}
            </p>
          ))}
      {/* A Marksman's ammunition, switched by hand at any time; one the AI runs loads its own. */}
      {!over &&
        onLoadAmmo &&
        party
          .filter((unit) => unit.hp > 0 && unit.marinara?.ammo)
          .map((unit) => {
            const ammo = unit.marinara!.ammo!;
            return (
              <div
                key={unit.id}
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={t("game.combat.marinara.ammo", { name: unit.name })}
                data-testid="marinara-ammo"
              >
                <span className="text-[var(--muted-foreground)]">
                  {t("game.combat.marinara.ammo", { name: unit.name })}
                </span>
                {ammo.choices.map((type) => {
                  const loaded = !ammo.auto && ammo.loaded === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={ammo.auto || busy || loaded}
                      aria-pressed={loaded}
                      onClick={() => onLoadAmmo(unit.id, type)}
                      className={
                        "rounded border px-1.5 py-0.5 disabled:cursor-default " +
                        (loaded
                          ? "border-[var(--primary)] bg-[var(--secondary)] font-medium"
                          : "border-[var(--border)] disabled:opacity-60")
                      }
                    >
                      {t(`game.combat.marinara.damageType.${type}`, { defaultValue: type })}
                    </button>
                  );
                })}
                {ammo.auto && (
                  <span className="text-[var(--muted-foreground)]">{t("game.combat.marinara.ammoAuto")}</span>
                )}
              </div>
            );
          })}
      {/* Channel Element: a Channeler's element, a bonus action once between their turns; the AI channels its own. */}
      {!over &&
        onChannel &&
        party
          .filter((unit) => unit.hp > 0 && unit.marinara?.channel)
          .map((unit) => {
            const channel = unit.marinara!.channel!;
            return (
              <div
                key={unit.id}
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={t("game.combat.marinara.channel", { name: unit.name })}
                data-testid="marinara-channel"
              >
                <span className="text-[var(--muted-foreground)]">
                  {t("game.combat.marinara.channel", { name: unit.name })}
                </span>
                {channel.choices.map((type) => {
                  const current = !channel.auto && channel.element === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={channel.auto || busy || current || !channel.ready}
                      aria-pressed={current}
                      onClick={() => onChannel(unit.id, type)}
                      className={
                        "rounded border px-1.5 py-0.5 disabled:cursor-default " +
                        (current
                          ? "border-[var(--primary)] bg-[var(--secondary)] font-medium"
                          : "border-[var(--border)] disabled:opacity-60")
                      }
                    >
                      {t(`game.combat.marinara.damageType.${type}`, { defaultValue: type })}
                    </button>
                  );
                })}
                {channel.auto && (
                  <span className="text-[var(--muted-foreground)]">{t("game.combat.marinara.channelAuto")}</span>
                )}
              </div>
            );
          })}
      {/* Folded by default: open, it pushed the stage above it down to a sliver (playtest 2026-11-01). */}
      <details>
        <summary className="cursor-pointer text-[var(--muted-foreground)]">
          {t("game.combat.marinara.fighters", { count: units.length })}
        </summary>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {units.map((unit) => {
            const m = unit.marinara!;
            const flags = [
              m.defending && t("game.combat.marinara.defending"),
              m.charging && t("game.combat.marinara.charging"),
              m.covering && t("game.combat.marinara.covering"),
              m.hidden && t("game.combat.marinara.hidden"),
              m.enraged && t("game.combat.marinara.enraged"),
              m.yielded && t("game.combat.marinara.yielded"),
              m.coating && t("game.combat.marinara.coated", { type: m.coating }),
            ].filter(Boolean);
            const known = Object.entries(m.affinities ?? {});
            return (
              <li
                key={unit.id}
                className={
                  "rounded-md border border-[var(--border)] px-2 py-1" +
                  (unit.hp <= 0 ? " opacity-50" : "") +
                  (unit.id === actorId ? " border-[var(--primary)]" : "")
                }
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{unit.name}</span>
                  <span className="text-[var(--muted-foreground)]">
                    {[
                      m.classLabel ?? (m.archetype ? t(`game.combat.marinara.archetype.${m.archetype}`) : null),
                      t("game.combat.marinara.level", { level: m.level }),
                      m.tier && m.tier !== "standard" ? t(`game.combat.marinara.tier.${m.tier}`) : null,
                      t(`game.combat.marinara.row.${m.row}`),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div className="tabular-nums text-[var(--muted-foreground)]">
                  {m.shield > 0
                    ? t("game.combat.marinara.hpShield", { hp: unit.hp, max: unit.maxHp, shield: m.shield })
                    : t("game.combat.marinara.hp", { hp: unit.hp, max: unit.maxHp })}{" "}
                  · {t("game.combat.marinara.stamina", { amount: m.stamina, max: m.maxStamina })}
                  {unit.maxMp
                    ? [" · ", t("game.combat.marinara.mp", { amount: unit.mp, max: unit.maxMp })].join("")
                    : ""}
                </div>
                {(m.statuses.length > 0 || m.mods.length > 0 || flags.length > 0) && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {m.statuses.map((status) => (
                      <span key={status.status} className="rounded bg-[var(--secondary)] px-1">
                        {t(`game.combat.marinara.status.${status.status}`)} ({status.turns})
                      </span>
                    ))}
                    {m.mods.map((mod) => (
                      <span key={mod.stat} className="rounded bg-[var(--secondary)] px-1">
                        {t(`game.combat.marinara.stat.${mod.stat}`, { defaultValue: mod.stat })} {pct(mod.pct)}
                      </span>
                    ))}
                    {flags.map((flag) => (
                      <span key={String(flag)} className="rounded bg-[var(--secondary)] px-1">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
                {known.length > 0 && (
                  <div className="mt-0.5 text-[var(--muted-foreground)]">
                    {known
                      .map(([type, affinity]) => t(`game.combat.marinara.affinity.${affinity}`, { type }))
                      .join(", ")}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      {loot && loot.length > 0 && (
        <p>
          {t("game.combat.marinara.loot", {
            items: loot
              .map((drop) => ((drop.quantity ?? 1) > 1 ? `${drop.name} ×${drop.quantity}` : drop.name))
              .join(", "),
          })}
        </p>
      )}
      {growth && growth.length > 0 && (
        <ul className="space-y-1" aria-label={t("game.combat.marinara.growth")}>
          {growth.map((one) => (
            <li key={one.name}>
              <span className="font-medium">{one.name}</span>{" "}
              {one.fallen
                ? t("game.combat.marinara.fallen")
                : [
                    t("game.combat.marinara.xp", { amount: one.xp }),
                    ...one.levelUps.map((up) =>
                      t("game.combat.marinara.levelUp", {
                        level: up.level,
                        gains: Object.entries(up.gains)
                          .filter(([, gain]) => gain)
                          .map(
                            ([stat, gain]) =>
                              `${t(`game.combat.marinara.stat.${stat}`, { defaultValue: stat })} +${gain}`,
                          )
                          .join(", "),
                      }),
                    ),
                    one.promotionReady ? t("game.combat.marinara.promotionReady") : null,
                    one.tamed ? t("game.combat.marinara.tamed", { name: one.tamed }) : null,
                    one.stableFull ? t("game.combat.marinara.stableFull") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
