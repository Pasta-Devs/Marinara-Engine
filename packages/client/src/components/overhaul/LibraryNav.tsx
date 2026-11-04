// ──────────────────────────────────────────────
// UI overhaul: the Library pane (right side)
//
// Sections only, never item lists: each section opens its landing page in the
// main area. Characters shows its tags, which filter the gallery.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { Hash } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useOverhaulStore } from "../../stores/overhaul.store";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useLorebooks } from "../../hooks/use-lorebooks";
import { usePresets } from "../../hooks/use-presets";
import { useConnections } from "../../hooks/use-connections";
import { useRegexScripts } from "../../hooks/use-regex-scripts";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";
import { OVERHAUL_SETTINGS_TABS } from "./SettingsPage";
import { useOvAgentRows } from "./LibraryTables";

function characterTags(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const data = (record as { data?: unknown }).data;
  try {
    const parsed = typeof data === "string" ? (JSON.parse(data) as { tags?: unknown }) : (data as { tags?: unknown });
    return Array.isArray(parsed?.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

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
  const characterLibraryOpen = useUIStore((s) => s.characterLibraryOpen);
  const cardLibraryKind = useUIStore((s) => s.cardLibraryKind);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const libraryPage = useOverhaulStore((s) => s.libraryPage);
  const characterTag = useOverhaulStore((s) => s.characterTag);
  const setCharacterTag = useOverhaulStore((s) => s.setCharacterTag);
  const settingsTab = useOverhaulStore((s) => s.settingsTab);
  const setSettingsTab = useOverhaulStore((s) => s.setSettingsTab);

  const counts: Partial<Record<string, number>> = {
    characters: Array.isArray(characters.data) ? characters.data.length : undefined,
    personas: Array.isArray(personas.data) ? personas.data.length : undefined,
    lorebooks: Array.isArray(lorebooks.data) ? lorebooks.data.length : undefined,
    presets: Array.isArray(presets.data) ? presets.data.length : undefined,
    connections: Array.isArray(connections.data) ? connections.data.length : undefined,
    regex: Array.isArray(regexScripts.data) ? regexScripts.data.length : undefined,
    agents: agents.ready ? agents.rows.length : undefined,
  };

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    let untagged = 0;
    for (const record of Array.isArray(characters.data) ? characters.data : []) {
      const tags = characterTags(record);
      if (!tags.length) untagged += 1;
      for (const tag of tags) map.set(tag, (map.get(tag) ?? 0) + 1);
    }
    return { tags: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])), untagged };
  }, [characters.data]);

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
                  : libraryPage;

  const pickTag = (tag: string | null) => {
    setCharacterTag(tag);
    if (!(characterLibraryOpen && cardLibraryKind === "characters")) openLibrarySection("characters");
  };

  return (
    <nav data-component="OverhaulLibraryNav" className="ov-libnav" aria-label={localize("Library")}>
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
                  onClick={() => {
                    if (entry.id === "characters") setCharacterTag(null);
                    openLibrarySection(entry.id);
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{localize(entry.label)}</span>
                  {counts[entry.id] !== undefined ? <small>{counts[entry.id]}</small> : null}
                </button>
                {entry.id === "settings" && on ? (
                  <div className="ov-libnav__tags" role="group" aria-label={localize("Settings categories")}>
                    {OVERHAUL_SETTINGS_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn("ov-libnav__tag", settingsTab === tab.id && "is-on")}
                        aria-pressed={settingsTab === tab.id}
                        onClick={() => setSettingsTab(tab.id)}
                      >
                        <span>{localize(tab.label)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {entry.id === "characters" && on && tagCounts.tags.length > 0 ? (
                  <div className="ov-libnav__tags" role="group" aria-label={localize("Tags")}>
                    <button
                      type="button"
                      className={cn("ov-libnav__tag", characterTag === null && "is-on")}
                      aria-pressed={characterTag === null}
                      onClick={() => pickTag(null)}
                    >
                      <Hash size={12} aria-hidden="true" />
                      <span>{localize("All")}</span>
                      <small>{counts.characters}</small>
                    </button>
                    {tagCounts.tags.map(([tag, count]) => (
                      <button
                        key={tag}
                        type="button"
                        className={cn("ov-libnav__tag", characterTag === tag && "is-on")}
                        aria-pressed={characterTag === tag}
                        onClick={() => pickTag(tag)}
                      >
                        <Hash size={12} aria-hidden="true" />
                        <span>{tag}</span>
                        <small>{count}</small>
                      </button>
                    ))}
                    {tagCounts.untagged > 0 ? (
                      <button
                        type="button"
                        className={cn("ov-libnav__tag", characterTag === "" && "is-on")}
                        aria-pressed={characterTag === ""}
                        onClick={() => pickTag("")}
                      >
                        <Hash size={12} aria-hidden="true" />
                        <span>{localize("Untagged")}</span>
                        <small>{tagCounts.untagged}</small>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
