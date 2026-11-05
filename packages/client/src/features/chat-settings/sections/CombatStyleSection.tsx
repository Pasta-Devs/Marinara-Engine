import type { CSSProperties } from "react";
import { Swords } from "lucide-react";
import type { GameCombatStyle } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { getCombatStyle, isBuiltInCombatStyle, listCombatStyles } from "../../../components/game/combat-styles";
import { useTranslation as useUiTranslation } from "react-i18next";

interface CombatStyleSectionProps {
  style?: CSSProperties;
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
  style,
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
      style={style}
      label={localizeUi("ui.chatSettings.combatstylesection.combatStyle")}
      icon={<Swords size="0.875rem" />}
      help={localizeUi("ui.chatSettings.combatstylesection.chooseHowBattlesPlayOutWhenTheGameMaster")}
    >
      <div className="space-y-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.combatstylesection.battleSystem")}
          </span>
          <select
            value={combatStyle}
            onChange={(event) => onCombatStyleChange(event.target.value as GameCombatStyle)}
            className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
          >
            {offered("classic") && (
              <option value="classic">
                {localizeUi("ui.chatSettings.combatstylesection.classicCinematicMenuBattles")}
              </option>
            )}
            {offered("tactical") && (
              <option value="tactical">{localizeUi("game.combat.preference.tacticalLabel")}</option>
            )}
            {listCombatStyles()
              .filter((id) => !isBuiltInCombatStyle(id) && offered(id))
              .map((id) => (
                <option key={id} value={id}>
                  {getCombatStyle(id).label ?? id}
                </option>
              ))}
          </select>
        </label>
        {/* A ruleset's own fights roll initiative by its own rules, so the choice is for Tactical battles. */}
        {combatStyle === "tactical" && !rulesetResolvesFights && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
              {localizeUi("ui.chatSettings.combatstylesection.turnOrder")}
            </span>
            <select
              value={turnOrder}
              onChange={(event) => onTurnOrderChange(event.target.value as "side" | "initiative")}
              className="mari-preset-native-select w-full truncate rounded-lg bg-[var(--secondary)] px-3 py-2 pr-8 text-xs text-[var(--foreground)] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--primary)]/40"
            >
              <option value="initiative">{localizeUi("ui.chatSettings.combatstylesection.turnOrderInitiative")}</option>
              <option value="side">{localizeUi("ui.chatSettings.combatstylesection.turnOrderSide")}</option>
            </select>
          </label>
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
