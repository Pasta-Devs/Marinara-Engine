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

const PAGES: Partial<Record<LibrarySection, LazyExoticComponent<ComponentType>>> = {
  lorebooks: lazy(() => import("../panels/LorebooksPanel").then((m) => ({ default: m.LorebooksPanel }))),
  presets: lazy(() => import("../panels/PresetsPanel").then((m) => ({ default: m.PresetsPanel }))),
  connections: lazy(() => import("../panels/ConnectionsPanel").then((m) => ({ default: m.ConnectionsPanel }))),
  agents: lazy(() => import("../panels/AgentsPanel").then((m) => ({ default: m.AgentsPanel }))),
  settings: lazy(() => import("../panels/SettingsPanel").then((m) => ({ default: m.SettingsPanel }))),
  extensions: lazy(() =>
    import("../panels/PersonalExtensionPanel").then((m) => ({ default: m.PersonalExtensionPanel })),
  ),
};

const SURFACES = {
  lorebooks: "lorebooks",
  presets: "presets",
  connections: "connections",
  agents: "agents",
  settings: "settings",
} as const;

/** Settings reads better wider; the lists stay at a comfortable column. */
const PAGE_WIDTH: Partial<Record<LibrarySection, number>> = { settings: 980, agents: 1080 };

export function LibraryLandingPage({ section }: { section: LibrarySection }) {
  const localize = useLocalizedUiText();
  const Page = PAGES[section];
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
        <h1>{entry ? localize(entry.label) : section}</h1>
        {surface ? <PersonalExtensionContributionSlot surface={surface} position="header" /> : null}
      </header>
      <div
        className="ov-libpage__body mari-right-panel-content"
        style={{ maxWidth: width, "--mari-right-panel-width": `${width}px` } as CSSProperties}
      >
        <Suspense fallback={<div className="ov-libpage__loading">{localize("Loading…")}</div>}>
          {Page ? <Page /> : null}
        </Suspense>
      </div>
    </section>
  );
}
