// ──────────────────────────────────────────────
// UI overhaul: the Library pane (right side)
//
// Sections only, never item lists: each section opens its landing page in the
// main area. Characters, Personas and Lorebooks filter by tag from the selector
// beside their search (TagFilter.tsx), so a long tag list never grows here.
// ──────────────────────────────────────────────
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useRegexScripts } from "../../hooks/use-regex-scripts";
import { useCustomTools } from "../../hooks/use-custom-tools";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";
import { useOvAgentRows } from "./LibraryTables";
import { splitDragProps } from "./split-view";

export function LibraryNav() {
  const localize = useLocalizedUiText();
  const characters = useCharacters();
  const personas = usePersonas();
  const lorebooks = useLorebooks();
  const presets = usePresets();
  const connections = useConnections();
  const regexScripts = useRegexScripts();
  const agents = useOvAgentRows();
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const customTools = useCustomTools();
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const libraryPage = useOverhaulStore((s) => s.libraryPage);

  const counts: Partial<Record<string, number>> = {
    characters: Array.isArray(characters.data) ? characters.data.length : undefined,
    personas: Array.isArray(personas.data) ? personas.data.length : undefined,
    lorebooks: Array.isArray(lorebooks.data) ? lorebooks.data.length : undefined,
    presets: Array.isArray(presets.data) ? presets.data.length : undefined,
    connections: Array.isArray(connections.data) ? connections.data.length : undefined,
    regex: Array.isArray(regexScripts.data) ? regexScripts.data.length : undefined,
    tools: Array.isArray(customTools.data) ? customTools.data.length : undefined,
    agents: agents.ready ? agents.rows.length : undefined,
  };

  // Which section the main area is showing (an editor counts as its section).
  const activeSection = characterLibraryOpen
    ? cardLibraryKind
    : characterDetailId
      ? "characters"
      : personaDetailId
        ? "personas"
        : lorebookDetailId
          ? "lorebooks"
          : presetDetailId
            ? "presets"
            : connectionDetailId
              ? "connections"
              : agentDetailId
                ? "agents"
                : regexDetailId
                  ? "regex"
                  : toolDetailId
                    ? "tools"
                    : libraryPage;

  return (
    <nav
      data-component="OverhaulLibraryNav"
      data-tour="library-nav"
      className="ov-libnav"
      aria-label={localize("Library")}
    >
      <h2 className="ov-libnav__title">{localize("Library")}</h2>
      {(["library", "app"] as const).map((group) => (
        <div key={group} className="ov-libnav__group">
          {group === "app" ? <div className="ov-libnav__rule" aria-hidden="true" /> : null}
          {LIBRARY_SECTIONS.filter((entry) => entry.group === group).map((entry) => {
            const Icon = entry.icon;
            const on = activeSection === entry.id;
            return (
              <div key={entry.id}>
                <button
                  type="button"
                  className={cn("ov-libnav__item", on && "is-on")}
                  aria-current={on ? "page" : undefined}
                  data-tour={`panel-${entry.id}`}
                  {...splitDragProps(() => ({ kind: "library", id: entry.id }))}
                  onClick={() => openLibrarySection(entry.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{localize(entry.label)}</span>
                  {counts[entry.id] !== undefined ? <small>{counts[entry.id]}</small> : null}
                </button>
                {/* Settings' categories are the tabs on the page itself; the sidebar doesn't list them again (audit D18). */}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
