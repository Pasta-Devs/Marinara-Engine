// ──────────────────────────────────────────────
// UI overhaul: Library > Assets' tabs
//
// Backgrounds, Game assets and Rulesets share one Library sidebar row, "Assets" (owner, 2026-11-22: keep
// the sidebar short). Each tab is its own page; where the page would put its title, it puts "Assets"
// and the three tabs instead, so the switch sits on the title line and adds no row.
// ──────────────────────────────────────────────
import { createContext, useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useOverhaulMobile } from "../../stores/overhaul.store";
import { ASSET_TABS, openLibrarySection, type AssetTab } from "./library-navigation";

/** The Assets tab on screen; null outside the Assets page (the page then shows its own title). */
export const AssetsTabContext = createContext<AssetTab | null>(null);

export function AssetsTitle({
  children,
  guardLeave,
}: {
  children: ReactNode;
  /** Runs a tab switch, first asking about unsaved edits on the page (a Game assets file). */
  guardLeave?: (go: () => void) => void;
}) {
  const tab = useContext(AssetsTabContext);
  const { t } = useTranslation();
  const mobile = useOverhaulMobile();
  if (!tab) return <>{children}</>;
  const title = <h1 data-mari-part="page-title">{t("library.sections.assets")}</h1>;
  const tabs = (
    <div
      className="ov-seg ov-assets__tabs"
      role="tablist"
      aria-label={t("library.sections.assets")}
      data-component="AssetsTabs"
    >
      {ASSET_TABS.map((each) => (
        <button
          key={each}
          type="button"
          role="tab"
          aria-selected={each === tab}
          className={cn(each === tab && "is-on")}
          onClick={() => {
            if (each === tab) return;
            const go = () => openLibrarySection(each);
            if (guardLeave) guardLeave(go);
            else go();
          }}
        >
          {t(`library.sections.${each === "game-assets" ? "gameAssets" : each}`)}
        </button>
      ))}
    </div>
  );
  // Phones: the title and the tabs sit straight in the page header, so the header can give the tabs their
  // own full row under "Assets" (display: contents would hide the tabs from WebKit's accessibility tree).
  if (mobile)
    return (
      <>
        {title}
        {tabs}
      </>
    );
  return (
    <div className="ov-assets__title">
      {title}
      {tabs}
    </div>
  );
}
