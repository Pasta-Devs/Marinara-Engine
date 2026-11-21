// ──────────────────────────────────────────────
// Search (Ctrl+K): one "open this page" command per Library section
// ──────────────────────────────────────────────
// Typing a page's name ("presets", "regex") found only guides, because the page commands were a
// hand-kept list that had drifted from the sidebar (QC Nov 21 IA14). This table is keyed by every
// Library section, so TypeScript refuses a new section until it has a command here too.
import type { LibrarySection } from "../stores/overhaul.store";
import type { OmnibarCategory } from "./omnibar-search";

/** The sections the Library sidebar lists (components/overhaul/library-navigation.ts). */
export type LibraryPageSection = Exclude<LibrarySection, "bot-browser">;

export type LibrarySectionCommand = {
  /** An existing system command that already opens this page, or the id of the one generated for it. */
  commandId: string;
  /** Extra words that name the page, SillyTavern's among them. Matched whole, like a title. */
  aliases: readonly string[];
  /** The kind of item the page lists, so "open presets" keeps this row when the search narrows to presets. */
  category?: OmnibarCategory;
};

export const LIBRARY_SECTION_COMMANDS: Readonly<Record<LibraryPageSection, LibrarySectionCommand>> = {
  characters: {
    commandId: "character-library",
    aliases: ["characters", "character", "cards", "bots"],
    category: "character",
  },
  personas: { commandId: "persona-library", aliases: ["personas", "persona", "user personas"], category: "persona" },
  lorebooks: { commandId: "lorebook-library", aliases: ["lorebooks", "lorebook"], category: "lorebook" },
  presets: {
    commandId: "library-section:presets",
    aliases: ["presets", "preset", "prompt presets", "prompt manager", "chat completion presets"],
    category: "preset",
  },
  profiles: { commandId: "library-section:profiles", aliases: ["settings profiles", "settings profile", "profiles"] },
  regex: {
    commandId: "library-section:regex",
    aliases: ["regex", "regexes", "regex scripts", "regex script", "find and replace"],
  },
  connections: {
    commandId: "integrations",
    aliases: ["connections", "connection", "api connections"],
    category: "connection",
  },
  agents: { commandId: "library-section:agents", aliases: ["agents", "agent"], category: "agent" },
  tools: {
    commandId: "library-section:tools",
    aliases: ["custom tools", "custom tool", "tools", "function calling", "functions"],
  },
  settings: { commandId: "settings", aliases: ["settings"], category: "settings" },
  extensions: { commandId: "extensions", aliases: ["extensions", "extension"] },
};

const PAGE_COMMAND_IDS = new Set(Object.values(LIBRARY_SECTION_COMMANDS).map((entry) => entry.commandId));

export function isLibraryPageCommand(id: string): boolean {
  return PAGE_COMMAND_IDS.has(id);
}

/** The page command for a kind of item: "open presets" narrows to presets and still offers the Presets page. */
export function libraryPageCommandFor(category: OmnibarCategory): string | undefined {
  return Object.values(LIBRARY_SECTION_COMMANDS).find((entry) => entry.category === category)?.commandId;
}
