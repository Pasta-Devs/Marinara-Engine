import type { AchievementDefinition } from "@marinara-engine/shared";
import type { TOptions } from "i18next";

type AchievementTranslator = (key: string, options?: TOptions) => unknown;

export function localizeAchievementTitle(t: AchievementTranslator, achievement: AchievementDefinition) {
  const title = String(t(achievement.titleKey, { defaultValue: achievement.title }));
  return achievement.rankLabel ? `${title} ${achievement.rankLabel}` : title;
}

export function localizeAchievementDescription(t: AchievementTranslator, achievement: AchievementDefinition) {
  return String(
    t(achievement.descriptionKey, {
      defaultValue: achievement.description,
      target: achievement.target,
      count: achievement.target,
    }),
  );
}
