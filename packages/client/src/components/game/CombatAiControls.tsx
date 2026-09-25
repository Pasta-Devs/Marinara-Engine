import { useTranslation } from "react-i18next";
import type { CombatController, CombatTactics } from "@marinara-engine/shared";

interface Member {
  id: string;
  name: string;
  hp: number;
  tactics?: CombatTactics;
  controller?: CombatController;
  hasActed?: boolean;
}

export function CombatAiControls({
  party,
  enemies,
  defaultController,
  locked,
  onChange,
}: {
  party: Member[];
  enemies: Member[];
  defaultController: CombatController;
  locked: boolean;
  onChange: (id: string, controller: CombatController) => void;
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
  return (
    <details className="relative z-10 shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]">
      <summary className="cursor-pointer font-medium focus-visible:outline focus-visible:outline-[var(--primary)]">
        {t("game.combat.ai.controls")}
      </summary>
      <p className="my-2 text-[var(--muted-foreground)]">{t("game.combat.ai.help")}</p>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {party.map((member) => (
          <label key={member.id} className="flex flex-wrap items-center justify-between gap-2">
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
          </label>
        ))}
        {enemies
          .filter((member) => member.tactics)
          .map((member) => (
            <p key={member.id} className="text-[var(--muted-foreground)]">
              {describe(member)}
            </p>
          ))}
      </div>
    </details>
  );
}
