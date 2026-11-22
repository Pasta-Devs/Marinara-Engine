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
import { ASSET_TABS, openLibrarySection, type AssetTab } from "./library-navigation";

/** The Assets tab on screen; null outside the Assets page (the page then shows its own title). */
export const AssetsTabContext = createContext<AssetTab | null>(null);

export function AssetsTitle({ children }: { children: ReactNode }) {
  const tab = useContext(AssetsTabContext);
  const { t } = useTranslation();
  if (!tab) return <>{children}</>;
  return (
    <div className="ov-assets__title" data-component="AssetsTabs">
      <h1 data-mari-part="page-title">{t("library.sections.assets")}</h1>
      <div className="ov-seg ov-assets__tabs" role="tablist" aria-label={t("library.sections.assets")}>
        {ASSET_TABS.map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={each === tab}
            className={cn(each === tab && "is-on")}
            onClick={() => each !== tab && openLibrarySection(each)}
          >
            {t(`library.sections.${each === "game-assets" ? "gameAssets" : each}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
