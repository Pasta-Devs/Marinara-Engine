// ──────────────────────────────────────────────
// UI overhaul: the Library pane (right side)
//
// Sections only, never item lists: each section opens its landing page in the
// main area. Characters, Personas and Lorebooks show their tags, which filter
// the gallery / list.
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
import { useCustomTools } from "../../hooks/use-custom-tools";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";
import { OVERHAUL_SETTINGS_TABS } from "./SettingsPage";
import { useOvAgentRows } from "./LibraryTables";
import { splitDragProps } from "./split-view";

function cleanTags(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return cleanTags(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
}

/** Tags of a character (inside its card data), persona or lorebook (top-level `tags`). */
function recordTags(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const own = (record as { tags?: unknown }).tags;
  if (own !== undefined) return cleanTags(own);
  const data = (record as { data?: unknown }).data;
  try {
    const parsed = typeof data === "string" ? (JSON.parse(data) as { tags?: unknown }) : (data as { tags?: unknown });
    return cleanTags(parsed?.tags);
  } catch {
    return [];
  }
}

function countTags(records: unknown) {
  const map = new Map<string, number>();
  let untagged = 0;
  for (const record of Array.isArray(records) ? records : []) {
    const tags = recordTags(record);
    if (!tags.length) untagged += 1;
    for (const tag of tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  }
  return { tags: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])), untagged };
}

type TaggedSection = "characters" | "personas" | "lorebooks";

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
  const characterTag = useOverhaulStore((s) => s.characterTag);
  const setCharacterTag = useOverhaulStore((s) => s.setCharacterTag);
  const personaTag = useOverhaulStore((s) => s.personaTag);
  const setPersonaTag = useOverhaulStore((s) => s.setPersonaTag);
  const lorebookTag = useOverhaulStore((s) => s.lorebookTag);
  const setLorebookTag = useOverhaulStore((s) => s.setLorebookTag);
  const settingsTab = useOverhaulStore((s) => s.settingsTab);
  const setSettingsTab = useOverhaulStore((s) => s.setSettingsTab);

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

  const characterTagCounts = useMemo(() => countTags(characters.data), [characters.data]);
  const personaTagCounts = useMemo(() => countTags(personas.data), [personas.data]);
  const lorebookTagCounts = useMemo(() => countTags(lorebooks.data), [lorebooks.data]);
  const tagState: Record<
    TaggedSection,
    { counts: ReturnType<typeof countTags>; value: string | null; set: (tag: string | null) => void }
  > = {
    characters: { counts: characterTagCounts, value: characterTag, set: setCharacterTag },
    personas: { counts: personaTagCounts, value: personaTag, set: setPersonaTag },
    lorebooks: { counts: lorebookTagCounts, value: lorebookTag, set: setLorebookTag },
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

  const pickTag = (section: TaggedSection, tag: string | null) => {
    tagState[section].set(tag);
    const onLanding =
      section === "lorebooks"
        ? libraryPage === "lorebooks" && !lorebookDetailId
        : characterLibraryOpen && cardLibraryKind === section;
    if (!onLanding) openLibrarySection(section);
  };

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
                  onClick={() => {
                    if (entry.id === "characters" || entry.id === "personas" || entry.id === "lorebooks") {
                      tagState[entry.id].set(null);
                    }
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
                {(entry.id === "characters" || entry.id === "personas" || entry.id === "lorebooks") &&
                on &&
                tagState[entry.id].counts.tags.length > 0 ? (
                  <div className="ov-libnav__tags" role="group" aria-label={localize("Tags")}>
                    {[
                      { key: "__all", tag: null, label: localize("All"), count: counts[entry.id] },
                      ...tagState[entry.id].counts.tags.map(([tag, count]) => ({ key: tag, tag, label: tag, count })),
                      ...(tagState[entry.id].counts.untagged > 0
                        ? [
                            {
                              key: "__untagged",
                              tag: "",
                              label: localize("Untagged"),
                              count: tagState[entry.id].counts.untagged,
                            },
                          ]
                        : []),
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={cn(
                          "ov-libnav__tag",
                          tagState[entry.id as TaggedSection].value === item.tag && "is-on",
                        )}
                        aria-pressed={tagState[entry.id as TaggedSection].value === item.tag}
                        onClick={() => pickTag(entry.id as TaggedSection, item.tag)}
                      >
                        <Hash size={12} aria-hidden="true" />
                        <span>{item.label}</span>
                        <small>{item.count}</small>
                      </button>
                    ))}
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
