import { toast } from "sonner";
import { ACHIEVEMENT_DEFINITION_BY_ID, type AchievementDefinition, type AchievementProgress } from "@marinara-engine/shared";

function getAchievementLabel(achievement: AchievementDefinition) {
  return achievement.rankLabel ? `${achievement.title} ${achievement.rankLabel}` : achievement.title;
}

export function showAchievementUnlockToasts(progress: AchievementProgress[]) {
  for (const item of progress) {
    const achievement = ACHIEVEMENT_DEFINITION_BY_ID.get(item.id);
    if (!achievement) continue;

    toast.success("Achievement unlocked", {
      description: getAchievementLabel(achievement),
    });
  }
}
