// ──────────────────────────────────────────────
// UI overhaul: Settings as one page with seven plain tabs
//
// Every real settings section is kept and placed in one of seven tabs; the
// sections themselves are the app's own components, so nothing loses
// behaviour. Chips under the tabs jump to a section; search covers all tabs.
// ──────────────────────────────────────────────
import { lazy, Suspense, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@marinara-engine/shared";
import { useOverhaulStore, type OverhaulSettingsTab } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";

const OverhaulSettingsSections = lazy(() =>
  import("../panels/SettingsPanel").then((m) => ({ default: m.OverhaulSettingsSections })),
);

export const OVERHAUL_SETTINGS_TABS: {
  id: OverhaulSettingsTab;
  label: string;
  blurb: string;
  sections: SettingsSectionId[];
}[] = [
  {
    id: "general",
    label: "General",
    blurb: "App, Professor Mari and notifications",
    sections: ["application", "omnibar", "notifications"],
  },
  {
    id: "chatting",
    label: "Chatting",
    blurb: "Replies, the chat box, text formatting and message info",
    sections: ["responses", "input-editing", "text-rules", "message-tools"],
  },
  {
    id: "appearance",
    label: "Appearance",
    blurb: "Theme, text size, chat display, backgrounds and CSS personalization",
    sections: ["app-style", "text-scale", "chat-display", "motion-backgrounds", "chat-backgrounds", "theme-library"],
  },
  {
    id: "chat-modes",
    label: "Chat modes",
    blurb: "Conversation, Roleplay and Game Mode specifics",
    sections: ["conversation-theme", "roleplay-tracker", "roleplay-messages", "game-presentation", "game-playback"],
  },
  {
    id: "media",
    label: "Media",
    blurb: "Image, video and game asset generation",
    sections: ["overall-generations", "image-generation", "video-generation", "prompt-overrides", "game-assets"],
  },
  {
    id: "data",
    label: "Data",
    blurb: "Imports, exports, backups and storage",
    sections: ["profile-marinara", "sillytavern-import", "backup-export", "storage-optimization"],
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "Access, multiplayer, features, updates, diagnostics and the danger zone",
    sections: [
      "admin-access",
      "multiplayer",
      "features",
      "parameters",
      "request-timeouts",
      "updates",
      "support-diagnostics",
      "danger-zone",
    ],
  },
];

const SECTION_LABELS: Partial<Record<SettingsSectionId, string>> = {
  application: "App",
  omnibar: "Professor Mari",
  "message-tools": "Message info",
  "theme-library": "CSS personalization",
};

function sectionLabel(id: SettingsSectionId) {
  return SECTION_LABELS[id] ?? SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

function scrollToSection(id: SettingsSectionId) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(`settings-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

export function OverhaulSettingsPage() {
  const localize = useLocalizedUiText();
  const tabId = useOverhaulStore((s) => s.settingsTab);
  const setTab = useOverhaulStore((s) => s.setSettingsTab);
  const [query, setQuery] = useState("");
  const tab = OVERHAUL_SETTINGS_TABS.find((item) => item.id === tabId) ?? OVERHAUL_SETTINGS_TABS[0]!;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return OVERHAUL_SETTINGS_TABS.flatMap((item) =>
      item.sections
        .filter((id) => {
          const meta = SETTINGS_SECTIONS.find((section) => section.id === id);
          const haystack = [sectionLabel(id), meta?.label, meta?.description, ...(meta?.aliases ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(needle);
        })
        .map((id) => ({ tab: item, id })),
    ).slice(0, 12);
  }, [query]);

  return (
    <section className="ov-settings" data-component="OverhaulSettingsPage">
      <header className="ov-settings__head">
        <h1>{localize("Settings")}</h1>
        <p>{localize(tab.blurb)}</p>
        <div className="ov-settings__search">
          <label className="ov-search">
            <Search size={14} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localize("Search all settings")}
            />
          </label>
          {results.length ? (
            <div className="ov-settings__results" role="listbox">
              {results.map((result) => (
                <button
                  key={`${result.tab.id}:${result.id}`}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setTab(result.tab.id);
                    scrollToSection(result.id);
                  }}
                >
                  <span>{localize(sectionLabel(result.id))}</span>
                  <small>{localize(result.tab.label)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <div className="ov-settings__tabs">
        <div role="tablist" aria-label={localize("Settings categories")}>
          {OVERHAUL_SETTINGS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === tab.id}
              className={cn(item.id === tab.id && "is-on")}
              onClick={() => setTab(item.id)}
            >
              {localize(item.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="ov-settings__chips">
        {tab.sections.map((id) => (
          <button key={id} type="button" className="ov-chip" onClick={() => scrollToSection(id)}>
            {localize(sectionLabel(id))}
          </button>
        ))}
      </div>
      <div className="ov-settings__scroll">
        <Suspense fallback={<p className="ov-gallery__note">{localize("Loading…")}</p>}>
          <OverhaulSettingsSections key={tab.id} sectionIds={tab.sections} />
        </Suspense>
      </div>
    </section>
  );
}
