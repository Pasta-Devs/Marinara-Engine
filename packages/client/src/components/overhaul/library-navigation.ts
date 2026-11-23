// ──────────────────────────────────────────────
// UI overhaul: Library sections and how to open them
// ──────────────────────────────────────────────
import {
  BookOpen,
  FileText,
  FolderOpen,
  Link,
  Puzzle,
  Regex,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Users,
  VenetianMask,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore, type Panel } from "../../stores/ui.store";
import { isOverhaulLook, useOverhaulStore, type LibrarySection } from "../../stores/overhaul.store";
import {
  deferEditorLeave,
  deferPageEditorLeave,
  leaveWithoutSaving,
  type PageLeaveStates,
} from "../../lib/editor-leave";

export type LibrarySectionEntry = {
  id: LibrarySection;
  /** English source text; localized where it is shown. */
  label: string;
  icon: LucideIcon;
  group: "library" | "app";
};

export const LIBRARY_SECTIONS: readonly LibrarySectionEntry[] = [
  { id: "characters", label: "Characters", icon: Users, group: "library" },
  { id: "personas", label: "Personas", icon: VenetianMask, group: "library" },
  { id: "lorebooks", label: "Lorebooks", icon: BookOpen, group: "library" },
  { id: "presets", label: "Presets", icon: FileText, group: "library" },
  // Chat settings profiles: kept and edited here, not only from inside an open chat.
  { id: "profiles", label: "Settings profiles", icon: SlidersHorizontal, group: "library" },
  { id: "regex", label: "Regex scripts", icon: Regex, group: "library" },
  { id: "connections", label: "Connections", icon: Link, group: "library" },
  { id: "agents", label: "Agents", icon: Sparkles, group: "library" },
  { id: "tools", label: "Custom tools", icon: Wrench, group: "library" },
  // One row for chat backgrounds, the game asset folders and Game Mode rulesets (tabs on the page), so the
  // sidebar stays short (owner, 2026-11-22). They were windows or an old full page before (QC panel 2, E2).
  { id: "assets", label: "Assets", icon: FolderOpen, group: "library" },
  { id: "settings", label: "Settings", icon: Settings, group: "app" },
  { id: "extensions", label: "Extensions", icon: Puzzle, group: "app" },
];

/**
 * Shows a Library section's landing page in the main area and marks it in the
 * Library pane. Characters and Personas use the existing card gallery.
 */
export function openLibrarySection(section: LibrarySection) {
  // An open editor with unsaved edits asks first (Save / Don't save / Keep editing). Nothing here runs
  // until it says go, so Keep editing leaves the editor, the Library pane highlight and the page as they were.
  const proceed = () => leaveWithoutSaving(() => showLibrarySection(section));
  // A page's own editor (a Game assets file) asks once, up front, unless the section is its own page.
  if (deferPageEditorLeave({ ...useOverhaulStore.getState(), libraryPage: landingPageOf(section) }, proceed)) return;
  if (!deferEditorLeave(useUIStore.getState(), CLOSED_EDITORS, proceed)) proceed();
}

/** The page id `showLibrarySection` lands on (Characters and Personas are the card gallery, not a page). */
function landingPageOf(section: LibrarySection): LibrarySection | null {
  if (section === "characters" || section === "personas") return null;
  return section === "assets" ? lastAssetTab : section;
}

/**
 * Whether a Library section's landing page is what the main area shows: nothing that AppShell puts in front of it
 * (an open item, the card gallery, the agent catalog, Docs, Mari, Schedules, an app) is open. `next` replaces either
 * store's state with the state a change leaves behind.
 */
export function libraryPageShowing(section: LibrarySection, next: PageLeaveStates = {}): boolean {
  const ui = (next.ui ?? useUIStore.getState()) as Record<string, unknown>;
  const overhaul = (next.overhaul ?? useOverhaulStore.getState()) as Record<string, unknown>;
  if (overhaul.libraryPage !== section) return false;
  if (overhaul.activeSchedules || overhaul.activeMari || overhaul.activeDocsTab || overhaul.activeApp) return false;
  if (ui.characterLibraryOpen || ui.agentCatalogOpen) return false;
  return !Object.keys(CLOSED_EDITORS).some((field) => ui[field]);
}

const CLOSED_EDITORS = {
  characterDetailId: null,
  personaDetailId: null,
  lorebookDetailId: null,
  presetDetailId: null,
  profileDetailId: null,
  connectionDetailId: null,
  agentDetailId: null,
  toolDetailId: null,
  regexDetailId: null,
};

/** Sections with no classic right panel of their own: the pane's highlight follows the page instead. */
const PAGE_ONLY_SECTIONS = new Set<LibrarySection>([
  "regex",
  "tools",
  "profiles",
  "assets",
  "rulesets",
  "backgrounds",
  "game-assets",
]);

/** The Assets row's tabs, each its own page id; the row reopens the tab used last. */
export const ASSET_TABS = ["backgrounds", "game-assets", "rulesets"] as const;
export type AssetTab = (typeof ASSET_TABS)[number];
export const isAssetTab = (section: LibrarySection | null): section is AssetTab =>
  !!section && (ASSET_TABS as readonly string[]).includes(section);
let lastAssetTab: AssetTab = "backgrounds";

function showLibrarySection(requested: LibrarySection) {
  const section = requested === "assets" ? lastAssetTab : requested;
  if (isAssetTab(section)) lastAssetTab = section;
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
  // The one sidebar flips to its Library view, so the open section is highlighted there.
  overhaul.setSidePane("library");
  if (section === "characters") {
    overhaul.setLibraryPage(null);
    ui.openCharacterLibrary();
  } else if (section === "personas") {
    overhaul.setLibraryPage(null);
    ui.openPersonaLibrary();
  } else {
    ui.closeAllDetails();
    overhaul.setLibraryPage(section);
  }
  // Keep the pane's highlight in step without reopening a closed pane.
  if (!PAGE_ONLY_SECTIONS.has(section)) useUIStore.setState({ rightPanel: section as Panel });
}

/** The "Library" crumb: shows the Library pane beside whatever is open (nothing is closed). */
export function openLibraryPane() {
  const ui = useUIStore.getState();
  ui.openRightPanel(ui.rightPanel === "chat" ? "characters" : ui.rightPanel);
}

/**
 * "Open Connections" buttons (connection gates, setup wizards). In the new
 * layout this lands on the Connections page itself, not just the Library pane.
 */
export function openConnectionsPage() {
  if (isOverhaulLook()) openLibrarySection("connections");
  else useUIStore.getState().openRightPanel("connections");
}
