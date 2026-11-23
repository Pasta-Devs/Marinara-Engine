// ──────────────────────────────────────────────
// UI overhaul: a Library section's landing page in the main area
//
// Lorebooks, Presets, Connections, Agents, Settings and Extensions open here
// instead of in a side panel. For now the page hosts the existing panel's
// contents at a readable width; dedicated list views come in a later slice.
// ──────────────────────────────────────────────
import { Suspense, type ComponentType, type CSSProperties } from "react";
import { scheduleBackgroundPreload } from "../../lib/background-preload";
import { preloadedLazy } from "../../lib/preloaded-lazy";
import { DelayedFallback } from "../ui/DelayedFallback";
import type { LibrarySection } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { PersonalExtensionContributionSlot } from "../extensions/PersonalExtensionContributionSlot";
import { isAssetTab, LIBRARY_SECTIONS } from "./library-navigation";
import { AssetsTabContext } from "./AssetsTabs";

// One lazy wrapper per module (not per section): once a module has loaded, switching between
// its sections renders straight away instead of flashing "Loading…" again. Both modules are also
// fetched in the background shortly after start, so the first open is normally instant too.
const loadTables = () => import("./LibraryTables");
const loadSettings = () => import("./SettingsPage");
type PageProps = { section: LibrarySection };
const TablesPage = preloadedLazy(() =>
  loadTables().then((m) => {
    function TablesPage({ section }: PageProps) {
      const Page =
        section === "lorebooks"
          ? m.LorebooksLanding
          : section === "presets"
            ? m.PresetsLanding
            : section === "regex"
              ? m.RegexLanding
              : m.ConnectionsLanding;
      return <Page />;
    }
    return TablesPage;
  }),
);
const SettingsModulePage = preloadedLazy(() =>
  loadSettings().then((m) => {
    function SettingsModulePage(_props: PageProps) {
      return <m.OverhaulSettingsPage />;
    }
    return SettingsModulePage;
  }),
);
// Extensions is a list + editor viewer, like Custom tools.
const ExtensionsPage = preloadedLazy(() =>
  import("./ExtensionsViewer").then((m) => {
    function ExtensionsPage(_props: PageProps) {
      return <m.OvExtensionsViewer />;
    }
    return ExtensionsPage;
  }),
);
// Agents opens on the Agent Organizer, which lists installed and the user's own agents.
const AgentsPage = preloadedLazy(() =>
  import("../agents/AgentCatalogView").then((m) => {
    function AgentsPage(_props: PageProps) {
      return <m.AgentCatalogView />;
    }
    return AgentsPage;
  }),
);
// Backgrounds, Game assets and Rulesets: managers that were windows or an old full page (QC panel 2, E2).
const BackgroundsPage = preloadedLazy(() =>
  import("./BackgroundsPage").then((m) => {
    function BackgroundsLibraryPage(_props: PageProps) {
      return <m.BackgroundsPage />;
    }
    return BackgroundsLibraryPage;
  }),
);
const GameAssetsPage = preloadedLazy(() =>
  import("./GameAssetsPage").then((m) => {
    function GameAssetsLibraryPage(_props: PageProps) {
      return <m.GameAssetsPage />;
    }
    return GameAssetsLibraryPage;
  }),
);
const RulesetsPage = preloadedLazy(() =>
  import("./RulesetsViewer").then((m) => {
    function RulesetsLibraryPage(_props: PageProps) {
      return <m.RulesetsViewer />;
    }
    return RulesetsLibraryPage;
  }),
);
const PAGES: Partial<Record<LibrarySection, ComponentType<PageProps>>> = {
  backgrounds: BackgroundsPage,
  "game-assets": GameAssetsPage,
  rulesets: RulesetsPage,
  lorebooks: TablesPage,
  presets: TablesPage,
  regex: TablesPage,
  connections: TablesPage,
  agents: AgentsPage,
  settings: SettingsModulePage,
  extensions: ExtensionsPage,
};
/**
 * Queues every Library page's code (and Settings' sections) in the background preload queue, one page per
 * slice, so opening one renders at once instead of showing "Loading…" first (QC Nov 14 #2) without a burst of
 * downloads in the way of the first tap (QC panel 3, speed H1).
 */
export function queueLibraryPagePreloads() {
  const pages = {
    "library:tables": () => TablesPage.preload(),
    "library:settings": () => SettingsModulePage.preload(),
    "library:settings-sections": () => loadSettings().then((m) => m.preloadOverhaulSettingsSections()),
    "library:agents-page": () => AgentsPage.preload(),
    "library:extensions": () => ExtensionsPage.preload(),
    "library:backgrounds": () => BackgroundsPage.preload(),
    "library:game-assets": () => GameAssetsPage.preload(),
    "library:rulesets": () => RulesetsPage.preload(),
  };
  for (const [name, run] of Object.entries(pages)) scheduleBackgroundPreload(name, run);
}

const SURFACES = {
  lorebooks: "lorebooks",
  presets: "presets",
  connections: "connections",
  agents: "agents",
  settings: "settings",
} as const;

/** Settings reads better wider; the lists stay at a comfortable column. */
const PAGE_WIDTH: Partial<Record<LibrarySection, number>> = { settings: 980, agents: 1080 };

/** Pages that draw their own title row and toolbar (the Library tables). */
const SELF_HEADED = new Set<LibrarySection>([
  "lorebooks",
  "presets",
  "regex",
  "connections",
  "agents",
  "settings",
  "extensions",
  "backgrounds",
  "game-assets",
  "rulesets",
]);

export function LibraryLandingPage({ section }: { section: LibrarySection }) {
  const localize = useLocalizedUiText();
  const Page = PAGES[section];
  if (Page && isAssetTab(section)) {
    return (
      <AssetsTabContext.Provider value={section}>
        <Suspense
          fallback={
            <DelayedFallback>
              <div className="ov-libpage__loading">{localize("Loading…")}</div>
            </DelayedFallback>
          }
        >
          <Page section={section} />
        </Suspense>
      </AssetsTabContext.Provider>
    );
  }
  if (Page && SELF_HEADED.has(section)) {
    return (
      <Suspense
        fallback={
          <DelayedFallback>
            <div className="ov-libpage__loading">{localize("Loading…")}</div>
          </DelayedFallback>
        }
      >
        <Page section={section} />
      </Suspense>
    );
  }
  const entry = LIBRARY_SECTIONS.find((item) => item.id === section);
  const surface = SURFACES[section as keyof typeof SURFACES];
  const width = PAGE_WIDTH[section] ?? 860;
  return (
    <section
      data-component="OverhaulLibraryPage"
      data-section={section}
      className="ov-libpage"
      aria-label={entry ? localize(entry.label) : undefined}
    >
      <header className="ov-libpage__head" style={{ maxWidth: width }}>
        <h1 data-mari-part="page-title">{entry ? localize(entry.label) : section}</h1>
        {surface ? <PersonalExtensionContributionSlot surface={surface} position="header" /> : null}
      </header>
      <div
        className="ov-libpage__body mari-right-panel-content"
        style={{ maxWidth: width, "--mari-right-panel-width": `${width}px` } as CSSProperties}
      >
        <Suspense
          fallback={
            <DelayedFallback>
              <div className="ov-libpage__loading">{localize("Loading…")}</div>
            </DelayedFallback>
          }
        >
          {Page ? <Page section={section} /> : null}
        </Suspense>
      </div>
    </section>
  );
}
