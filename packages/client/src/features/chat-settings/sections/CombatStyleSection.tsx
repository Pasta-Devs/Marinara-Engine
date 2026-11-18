import { Swords } from "lucide-react";
import type { GameCombatStyle } from "@marinara-engine/shared";
import { Select } from "../../../components/ui/Select";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { getCombatStyle, isBuiltInCombatStyle, listCombatStyles } from "../../../components/game/combat-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

interface CombatStyleSectionProps {
  combatStyle: GameCombatStyle;
  /** Whether this game's own ruleset resolves its battles. The choice below is kept either way: a
   *  game that changes ruleset, or turns the director off, is back on whichever presentation is
   *  picked here. */
  rulesetResolvesFights?: boolean;
  /** Whether that ruleset also says what one cell of a board is worth. With it the choice below
   *  decides whether such a fight has positions; without it, it is kept and not used. */
  rulesetHasPositions?: boolean;
  /** The styles this game's ruleset lets it play (`combat.styles`, 1.379), or null for every one. */
  allowedStyles?: readonly string[] | null;
  onCombatStyleChange: (style: GameCombatStyle) => void;
  /** Who acts when in a Tactical battle (combat C6c). */
  turnOrder: "side" | "initiative";
  onTurnOrderChange: (order: "side" | "initiative") => void;
}

export function CombatStyleSection({
  combatStyle,
  rulesetResolvesFights,
  rulesetHasPositions,
  allowedStyles,
  onCombatStyleChange,
  turnOrder,
  onTurnOrderChange,
}: CombatStyleSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const offered = (id: string) => !allowedStyles || allowedStyles.includes(id);
  return (
    <ChatSettingsSection
      id="combat-style"
      label={localizeUi("ui.chatSettings.combatstylesection.combatStyle")}
      icon={<Swords size="0.875rem" />}
      help={localizeUi("ui.chatSettings.combatstylesection.chooseHowBattlesPlayOutWhenTheGameMaster")}
    >
      <div className="space-y-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.combatstylesection.battleSystem")}
          </span>
          <Select
            label={localizeUi("ui.chatSettings.combatstylesection.battleSystem")}
            value={combatStyle}
            options={[
              ...(offered("classic")
                ? [
                    {
                      value: "classic",
                      label: localizeUi("ui.chatSettings.combatstylesection.classicCinematicMenuBattles"),
                    },
                  ]
                : []),
              ...(offered("tactical")
                ? [{ value: "tactical", label: localizeUi("game.combat.preference.tacticalLabel") }]
                : []),
              ...listCombatStyles()
                .filter((id) => !isBuiltInCombatStyle(id) && offered(id))
                .map((id) => ({ value: id as string, label: getCombatStyle(id).label ?? id })),
            ]}
            onChange={(value) => onCombatStyleChange(value as GameCombatStyle)}
            className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
          />
        </div>
        {/* A ruleset's own fights roll initiative by its own rules, so the choice is for Tactical battles. */}
        {combatStyle === "tactical" && !rulesetResolvesFights && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.combatstylesection.turnOrder")}
            </span>
            <Select<"side" | "initiative">
              label={localizeUi("ui.chatSettings.combatstylesection.turnOrder")}
              value={turnOrder}
              options={[
                { value: "initiative", label: localizeUi("ui.chatSettings.combatstylesection.turnOrderInitiative") },
                { value: "side", label: localizeUi("ui.chatSettings.combatstylesection.turnOrderSide") },
              ]}
              onChange={onTurnOrderChange}
              className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
            />
          </div>
        )}
        {allowedStyles && (
          <p className="text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("game.combat.ruleset.stylesLimited")}
          </p>
        )}
        {rulesetResolvesFights && (
          <p className="text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi(
              rulesetHasPositions ? "game.combat.ruleset.preferencePositions" : "game.combat.ruleset.preferenceIgnored",
            )}
          </p>
        )}
        <p className="text-[0.575rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.chatSettings.combatstylesection.takesEffectAtTheNextBattleBattlesAlreadyIn")}
        </p>
      </div>
    </ChatSettingsSection>
  );
}
