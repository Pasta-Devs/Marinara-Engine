// ──────────────────────────────────────────────
// UI overhaul: Library sections and how to open them
// ──────────────────────────────────────────────
import { BookOpen, FileText, Link, Puzzle, Regex, Settings, Sparkles, Users, VenetianMask } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore, type Panel } from "../../stores/ui.store";
import { isOverhaulLook, useOverhaulStore, type LibrarySection } from "../../stores/overhaul.store";
import { deferEditorLeave, leaveWithoutSaving } from "../../lib/editor-leave";

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
  { id: "regex", label: "Regex scripts", icon: Regex, group: "library" },
  { id: "connections", label: "Connections", icon: Link, group: "library" },
  { id: "agents", label: "Agents", icon: Sparkles, group: "library" },
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
  if (!deferEditorLeave(useUIStore.getState(), CLOSED_EDITORS, proceed)) proceed();
}

const CLOSED_EDITORS = {
  characterDetailId: null,
  personaDetailId: null,
  lorebookDetailId: null,
  presetDetailId: null,
  connectionDetailId: null,
  agentDetailId: null,
  toolDetailId: null,
  regexDetailId: null,
};

function showLibrarySection(section: LibrarySection) {
  const ui = useUIStore.getState();
  const overhaul = useOverhaulStore.getState();
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
  if (section !== "regex") useUIStore.setState({ rightPanel: section as Panel });
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
