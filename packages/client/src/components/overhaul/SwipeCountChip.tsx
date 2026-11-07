// ──────────────────────────────────────────────
// UI overhaul, phones: "2 / 3" under the latest reply once it has swipes
//
// Phones show no swipe arrows on messages (all actions live in the long-press
// sheet), so this quiet line is the only sign that the reply can be swiped and
// which version is showing (panel 3, PP4).
// ──────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SwipeCountChip({ index, count }: { index: number; count: number }) {
  const { t } = useTranslation();
  if (count < 2) return null;
  const current = Math.min(Math.max(index, 0), count - 1) + 1;
  return (
    <div
      className="ov-swipe-chip"
      role="status"
      aria-label={t("ui.overhaul.swipechip.replyOfCount", { current, count })}
    >
      <ChevronLeft size={12} aria-hidden="true" className={current === 1 ? "is-off" : undefined} />
      <span>
        {current} / {count}
      </span>
      <ChevronRight size={12} aria-hidden="true" />
    </div>
  );
}
