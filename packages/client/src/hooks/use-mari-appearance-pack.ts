import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  getMariAppearancePack,
  isMariPackUnlocked,
  MARI_APPEARANCE_PACKS,
  playHoursFromMs,
  resolveMariAppearancePack,
} from "../lib/mari-work-animations";
import { useUIStore } from "../stores/ui.store";
import { useActivityOverview } from "./use-chat-insights";

/** The pack that renders: the stored choice, or Basic while that choice is still locked (R12). */
export function useMariAppearancePack() {
  const id = useUIStore((state) => state.mariAppearancePackId);
  const unlockedIds = useUIStore((state) => state.mariUnlockedPackIds);
  return resolveMariAppearancePack(id, unlockedIds);
}

/**
 * R12: records a pack as unlocked, with one quiet toast, once play time reaches its rule. Mounted
 * once. It only fetches the Activity overview when the stored pick is locked; otherwise it just
 * listens, so opening Activity or the pack grid is what notices the unlock.
 */
export function useMariPackUnlocks() {
  const { t } = useTranslation();
  const storedId = useUIStore((state) => state.mariAppearancePackId);
  const unlockedIds = useUIStore((state) => state.mariUnlockedPackIds);
  const markUnlocked = useUIStore((state) => state.markMariPackUnlocked);
  const storedLocked = !isMariPackUnlocked(getMariAppearancePack(storedId), unlockedIds);
  const playHours = playHoursFromMs(useActivityOverview(storedLocked).data?.playTime.totalMs);
  useEffect(() => {
    if (playHours === null) return;
    for (const pack of MARI_APPEARANCE_PACKS) {
      if (!pack.unlock || unlockedIds.includes(pack.id) || !isMariPackUnlocked(pack, unlockedIds, playHours)) continue;
      markUnlocked(pack.id);
      toast(t("mari.appearancePacks.unlockedToast", { name: t(`mari.appearancePacks.${pack.id}.label`, pack.label) }));
    }
  }, [playHours, unlockedIds, markUnlocked, t]);
}
