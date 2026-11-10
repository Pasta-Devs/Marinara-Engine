// ──────────────────────────────────────────────
// UI overhaul: a Library section's landing page in the main area
//
// Lorebooks, Presets, Connections, Agents, Settings and Extensions open here
// instead of in a side panel. For now the page hosts the existing panel's
// contents at a readable width; dedicated list views come in a later slice.
// ──────────────────────────────────────────────
import { lazy, Suspense, type ComponentType, type CSSProperties, type LazyExoticComponent } from "react";
import type { LibrarySection } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { PersonalExtensionContributionSlot } from "../extensions/PersonalExtensionContributionSlot";
import { LIBRARY_SECTIONS } from "./library-navigation";

// One lazy wrapper per module (not per section): once a module has loaded, switching between
// its sections renders straight away instead of flashing "Loading…" again. Both modules are also
// fetched in the background shortly after start, so the first open is normally instant too.
const loadTables = () => import("./LibraryTables");
const loadSettings = () => import("./SettingsPage");
type PageProps = { section: LibrarySection };
const TablesPage = lazy(() =>
  loadTables().then((m) => ({
    default: ({ section }: PageProps) => {
      const Page =
        section === "lorebooks"
          ? m.LorebooksLanding
          : section === "presets"
            ? m.PresetsLanding
            : section === "regex"
              ? m.RegexLanding
              : m.ConnectionsLanding;
      return <Page />;
    },
  })),
);
const SettingsModulePage = lazy(() =>
  loadSettings().then((m) => ({
    default: ({ section }: PageProps) =>
      section === "extensions" ? <m.OverhaulExtensionsPage /> : <m.OverhaulSettingsPage />,
  })),
);
// Agents opens on the Agent Organizer, which lists installed and the user's own agents.
const AgentsPage = lazy(() =>
  import("../agents/AgentCatalogView").then((m) => ({ default: () => <m.AgentCatalogView /> })),
);
const PAGES: Partial<Record<LibrarySection, LazyExoticComponent<ComponentType<PageProps>>>> = {
  lorebooks: TablesPage,
  presets: TablesPage,
  regex: TablesPage,
  connections: TablesPage,
  agents: AgentsPage,
  settings: SettingsModulePage,
  extensions: SettingsModulePage,
};
if (typeof window !== "undefined") {
  const preload = () => {
    void loadTables().catch(() => undefined);
    void loadSettings().catch(() => undefined);
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (idle) idle(preload);
  else window.setTimeout(preload, 1500);
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
]);

export function LibraryLandingPage({ section }: { section: LibrarySection }) {
  const localize = useLocalizedUiText();
  const Page = PAGES[section];
  if (Page && SELF_HEADED.has(section)) {
    return (
      <Suspense fallback={<div className="ov-libpage__loading">{localize("Loading…")}</div>}>
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
        <Suspense fallback={<div className="ov-libpage__loading">{localize("Loading…")}</div>}>
          {Page ? <Page section={section} /> : null}
        </Suspense>
      </div>
    </section>
  );
}
