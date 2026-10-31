import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { defaultRulesetSheetBuild, readRulesetSheetEnvelope } from "@marinara-engine/shared";
import { useGameRuleset } from "../../hooks/use-game-ruleset";
import { MULTIPLAYER_BUTTON_CLASS } from "./MultiplayerFields";

/** The party members of a ruleset game whose sheet is still the ruleset's blank default, as a player's
 *  room persona starts: they would fight at the blank sheet's numbers (room playtest 2026-10-27: 1/1 HP,
 *  AC 10). Named to the host with the Game screen a click away, where the party's sheets are built. */
export function MultiplayerBlankSheets({
  metadata,
  onOpen,
}: {
  metadata: Record<string, unknown>;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const ruleset = useGameRuleset(metadata);
  const cards = metadata.gameCharacterCards;
  const names = useMemo(() => {
    if (ruleset.status !== "ok" || !Array.isArray(cards)) return [];
    const blank = JSON.stringify(defaultRulesetSheetBuild(ruleset.definition));
    return (cards as Array<Record<string, unknown>>).flatMap((card) => {
      const name = typeof card?.name === "string" ? card.name.trim() : "";
      if (!name || card.rulesetCreature) return [];
      const build = readRulesetSheetEnvelope(ruleset.definition, card.rulesetSheet)?.build;
      return !build || JSON.stringify(build) === blank ? [name] : [];
    });
  }, [ruleset, cards]);
  if (names.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-xs">
      <p className="min-w-0 flex-1 break-words">{t("multiplayer.host.blankSheets", { names: names.join(", ") })}</p>
      {onOpen && (
        <button type="button" className={MULTIPLAYER_BUTTON_CLASS} onClick={onOpen}>
          {t("multiplayer.host.showGame")}
        </button>
      )}
    </div>
  );
}
