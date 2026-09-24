import { toast } from "sonner";
import {
  ACHIEVEMENT_DEFINITION_BY_ID,
  type AchievementDefinition,
  type AchievementProgress,
} from "@marinara-engine/shared";
import { translate } from "../localization/i18n";
import { localizeAchievementTitle } from "./achievement-localization";

// A package unlock is written server-side, so the client learns about it from a status refresh
// rather than from the call that caused it. That refresh repeats every unlock it knows about, so
// the ids already announced are remembered for the page's lifetime.
const announcedIds = new Set<string>();

/** Records unlocks without announcing them, for the first status read of a session. */
export function markAchievementUnlocksSeen(progress: AchievementProgress[]) {
  for (const item of progress) announcedIds.add(item.id);
}

export function showAchievementUnlockToasts(
  progress: AchievementProgress[],
  definitions: readonly AchievementDefinition[] = [],
) {
  for (const item of progress) {
    if (announcedIds.has(item.id)) continue;
    const achievement =
      ACHIEVEMENT_DEFINITION_BY_ID.get(item.id) ?? definitions.find((definition) => definition.id === item.id);
    // An unknown id is a package whose definitions have not loaded yet. Leave it unannounced so the
    // next refresh, which carries the definition, can name the badge properly.
    if (!achievement) continue;
    announcedIds.add(item.id);

    toast.success(translate("ui.achievements.unlocked"), {
      description: localizeAchievementTitle(translate, achievement),
    });
  }
}
