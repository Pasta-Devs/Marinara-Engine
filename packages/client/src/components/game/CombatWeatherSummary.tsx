import { combatWeatherEffects, type CombatWeather } from "@marinara-engine/shared";
import { useTranslation } from "react-i18next";
import { GAME_SECTION_CLASS } from "../../lib/chat-widget-colors";
import { cn } from "../../lib/utils";

/** Accepted battle rules, independent of the cosmetic weather-animation preference. */
export function CombatWeatherSummary({
  weather,
  tactical,
  inline,
}: {
  weather?: CombatWeather;
  tactical: boolean;
  /** One quiet line inside another panel (the fight screen's footer) rather than a band of its own. */
  inline?: boolean;
}) {
  const { t } = useTranslation();
  if (!weather) return null;
  const effects = combatWeatherEffects(weather);
  const notes = [
    effects.fireMultiplier !== 1 ? t("game.combat.weather.rainEffect") : null,
    effects.projectilePenalty
      ? t(tactical ? "game.combat.weather.projectileEffect" : "game.combat.weather.projectileRollEffect", {
          value: tactical ? effects.projectilePenalty : Math.ceil(effects.projectilePenalty / 5),
        })
      : null,
    effects.sightPenalty
      ? t(tactical ? "game.combat.weather.sightEffect" : "game.combat.weather.sightRollEffect", {
          value: tactical ? effects.sightPenalty : Math.ceil(effects.sightPenalty / 5),
        })
      : null,
    effects.projectilePenalty + effects.sightPenalty > 25
      ? t(tactical ? "game.combat.weather.accuracyCap" : "game.combat.weather.rollCap")
      : null,
    tactical && effects.walkingCost ? t("game.combat.weather.walkingEffect", { value: effects.walkingCost }) : null,
  ].filter(Boolean);
  return (
    <div
      data-game-section="combat-weather"
      className={cn(
        GAME_SECTION_CLASS,
        inline
          ? "text-[0.7rem] text-[var(--foreground)]"
          : "shrink-0 border-b border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)]",
      )}
      aria-label={t("game.combat.weather.label")}
    >
      <span className="font-medium">{t(`game.combat.weather.type.${weather.type}`)}</span>
      {" · "}
      {t(`game.combat.weather.exposure.${weather.exposure}`)}
      <span className="text-[var(--muted-foreground)]">
        {" · "}
        {notes.length ? notes.join(" · ") : t("game.combat.weather.neutral")}
      </span>
    </div>
  );
}
