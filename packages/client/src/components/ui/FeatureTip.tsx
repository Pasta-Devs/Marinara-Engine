// ──────────────────────────────────────────────
// Feature tip: one line inside the panel where a feature lives (lib/feature-tips.tsx).
// It shows only when `when` is true and the tip may show (tips on, not seen, no other tip
// this session). The action button and the ✕ both retire it for good.
// ──────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  canShowFeatureTip,
  claimFeatureTip,
  FEATURE_TIP_FACE,
  markFeatureTipSeen,
  type FeatureTipId,
} from "../../lib/feature-tips";
import { useUIStore } from "../../stores/ui.store";

export function FeatureTip({
  id,
  when = true,
  children,
  actionLabel,
  onAction,
  className,
}: {
  id: FeatureTipId;
  when?: boolean;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const enabled = useUIStore((s) => s.featureTipsEnabled);
  // Decided once per mount, so the tip doesn't vanish mid-read when a counter moves.
  const [visible, setVisible] = useState(() => when && canShowFeatureTip(id));
  useEffect(() => {
    if (!visible && when && canShowFeatureTip(id)) setVisible(true);
  }, [id, visible, when]);
  useEffect(() => {
    if (visible) claimFeatureTip(id);
  }, [id, visible]);
  if (!visible || !enabled) return null;

  const retire = () => {
    markFeatureTipSeen(id);
    setVisible(false);
  };

  return (
    <div className={["mari-feature-tip", className].filter(Boolean).join(" ")} role="note" data-mari-part="feature-tip">
      <img src={FEATURE_TIP_FACE} alt="" className="mari-feature-tip__face" aria-hidden="true" />
      <p className="mari-feature-tip__text">{children}</p>
      <div className="mari-feature-tip__actions">
        {actionLabel && onAction ? (
          <button
            type="button"
            className="mari-feature-tip__action"
            onClick={() => {
              retire();
              onAction();
            }}
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="mari-feature-tip__close"
          aria-label={t("featureTips.dismiss")}
          title={t("featureTips.dismissHint")}
          onClick={retire}
        >
          <X size="0.8rem" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
