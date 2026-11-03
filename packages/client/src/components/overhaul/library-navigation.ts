// ──────────────────────────────────────────────
// UI overhaul: Library sections and how to open them
// ──────────────────────────────────────────────
import { BookOpen, FileText, Link, Puzzle, Settings, Sparkles, Users, VenetianMask } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUIStore, type Panel } from "../../stores/ui.store";
import { useOverhaulStore, type LibrarySection } from "../../stores/overhaul.store";

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
  useUIStore.setState({ rightPanel: section as Panel });
}
