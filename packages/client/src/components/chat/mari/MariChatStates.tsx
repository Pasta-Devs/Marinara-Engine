import { useTranslation } from "react-i18next";
import { useMariAppearancePack } from "../../../hooks/use-mari-appearance-pack";
import { MARI_ASSET_TIER, mariImgLoading } from "../../../lib/mari-work-animations";

import { MariStorySprite } from "../MariStorySprite";

/** Her chat is loading: her sprite at the top and soft placeholder rows. CSS holds it back ~150 ms (no flash on fast loads). */
export function LoadingHistoryState() {
  const { t } = useTranslation();
  return (
    <div className="mari-loading" role="status" aria-live="polite">
      <span className="sr-only">{t("ui.chat.homeprofessormarichat.loadingChat")}</span>
      <div className="mari-loading__head" aria-hidden="true">
        <MariStorySprite state="idle" />
      </div>
      <div className="mari-loading__rows" aria-hidden="true">
        <span className="mari-loading__row mari-loading__row--short" />
        <span className="mari-loading__row" />
        <span className="mari-loading__row mari-loading__row--mid" />
      </div>
    </div>
  );
}

export function ProfessorMariPixelScene({ active }: { active: boolean }) {
  const { poses } = useMariAppearancePack();
  return (
    <div className="mari-professor-pixel-scene" data-state={active ? "active" : "idle"} aria-hidden="true">
      <div data-part="glow" />
      <div data-part="desk" />
      <img
        src={poses.chibi}
        {...mariImgLoading(MARI_ASSET_TIER.poses.chibi)}
        width={94}
        height={128}
        alt=""
        data-part="sprite"
        draggable={false}
      />
      <div data-part="laptop">
        <div data-part="screen">
          <span />
          <span />
          <span />
        </div>
        <div data-part="base">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
