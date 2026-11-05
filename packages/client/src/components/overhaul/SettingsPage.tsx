// ──────────────────────────────────────────────
// UI overhaul: Settings as one page with seven plain tabs
//
// Every real settings section is kept and placed in one of seven tabs; the
// sections themselves are the app's own components, so nothing loses
// behaviour. Chips under the tabs jump to a section; search covers all tabs.
// ──────────────────────────────────────────────
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@marinara-engine/shared";
import { useOverhaulMobile, useOverhaulStore, type OverhaulSettingsTab } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { openLibrarySection } from "./library-navigation";

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

/**
 * Scrolls the settings list (only the list, never the page around it) to a section and flashes
 * it, so you can see which block the chip meant.
 */
function scrollToSection(id: SettingsSectionId, attempt = 0) {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(`settings-section-${id}`);
    const scroller = target?.closest<HTMLElement>(".ov-settings__scroll");
    if (!target || !scroller || target.offsetParent === null) {
      // The tab's sections load lazily; try again for a moment after a tab switch.
      if (attempt < 20) window.setTimeout(() => scrollToSection(id, attempt + 1), 100);
      return;
    }
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
    target.classList.remove("ov-flash");
    void target.offsetWidth;
    target.classList.add("ov-flash");
    window.setTimeout(() => target.classList.remove("ov-flash"), 1800);
  });
}

type Chip = { id: SettingsSectionId; label: string };

/**
 * The jump chips, read from what is on screen: one per top-level section (rows nested inside
 * another section don't get their own), labelled with the section's own title, in page order.
 */
function useSectionChips(container: HTMLElement | null, fallback: SettingsSectionId[]): Chip[] {
  const [chips, setChips] = useState<Chip[]>(() => fallback.map((id) => ({ id, label: sectionLabel(id) })));
  useEffect(() => {
    if (!container) return;
    const read = () => {
      const anchors = Array.from(container.querySelectorAll<HTMLElement>('[id^="settings-section-"]')).filter(
        (el) => el.offsetParent !== null && !el.parentElement?.closest('[id^="settings-section-"]'),
      );
      if (!anchors.length) return;
      const next = anchors.map((el) => {
        const id = el.id.replace("settings-section-", "") as SettingsSectionId;
        const titleNode = el.querySelector(":scope > div:first-child .font-semibold")?.firstChild;
        const title = titleNode?.textContent?.trim();
        return { id, label: title || sectionLabel(id) };
      });
      setChips((current) =>
        current.length === next.length &&
        current.every((chip, i) => chip.id === next[i]!.id && chip.label === next[i]!.label)
          ? current
          : next,
      );
    };
    read();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [container]);
  return chips;
}

/** Settings that live on another Library page now, still found by Settings search. */
const ELSEWHERE: { id: SettingsSectionId; page: "extensions"; label: string }[] = [
  { id: "personal-extensions", page: "extensions", label: "Extensions" },
];

export function OverhaulSettingsPage() {
  const mobile = useOverhaulMobile();
  return mobile ? <OverhaulSettingsMobile /> : <OverhaulSettingsDesktop />;
}

function useSettingsSearch(query: string) {
  return useMemo(() => {
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
    )
      .concat(
        ELSEWHERE.filter((item) => {
          const meta = SETTINGS_SECTIONS.find((section) => section.id === item.id);
          return [meta?.label, meta?.description, ...(meta?.aliases ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle);
        }).map((item) => ({
          tab: { id: item.page, label: item.label } as unknown as (typeof OVERHAUL_SETTINGS_TABS)[number],
          id: item.id,
          page: item.page,
        })),
      )
      .slice(0, 12) as { tab: (typeof OVERHAUL_SETTINGS_TABS)[number]; id: SettingsSectionId; page?: "extensions" }[];
  }, [query]);
}

/**
 * Phones: Settings is three levels of pages. The seven tabs are rows; a tab
 * opens a page of its sections; a section opens a page of its settings.
 * Search jumps straight to a section's page. Back returns to where you were.
 */
function OverhaulSettingsMobile() {
  const localize = useLocalizedUiText();
  const tabId = useOverhaulStore((s) => s.settingsTab);
  const setTab = useOverhaulStore((s) => s.setSettingsTab);
  const [level, setLevel] = useState<"root" | "tab" | "section">("root");
  const [sectionId, setSectionId] = useState<SettingsSectionId | null>(null);
  const [query, setQuery] = useState("");
  const results = useSettingsSearch(query);
  const tab = OVERHAUL_SETTINGS_TABS.find((item) => item.id === tabId) ?? OVERHAUL_SETTINGS_TABS[0]!;
  const rootRef = useRef<HTMLElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const restore = useRef<number | null>(null);
  // Section titles exactly as the sections print them, read from an off-screen copy of the tab.
  const [probeEl, setProbeEl] = useState<HTMLDivElement | null>(null);
  const chips = useSectionChips(probeEl, tab.sections);

  const go = (next: "root" | "tab" | "section", back = false) => {
    const el = rootRef.current;
    if (el && !back) scrolls.current[level] = el.scrollTop;
    restore.current = back ? (scrolls.current[next] ?? 0) : 0;
    setLevel(next);
  };
  useLayoutEffect(() => {
    if (restore.current === null) return;
    const top = restore.current;
    restore.current = null;
    rootRef.current?.scrollTo({ top });
  }, [level, sectionId, tab.id]);

  const row = (key: string, label: string, value: string | null, onClick: () => void) => (
    <button key={key} type="button" className="ovm-drill-row" onClick={onClick}>
      <span className="ovm-drill-row__title">{label}</span>
      {value ? <span className="ovm-drill-row__value">{value}</span> : null}
      <ChevronRight size={16} className="ovm-drill-row__chev" aria-hidden="true" />
    </button>
  );
  const head = (title: string, onBack: () => void) => (
    <div className="ovm-drill-page__head">
      <button type="button" className="ovm-drill-page__back" aria-label={localize("Back")} onClick={onBack}>
        <ChevronLeft size={26} aria-hidden="true" />
      </button>
      <span className="ovm-drill-page__title">{title}</span>
      <span aria-hidden="true" />
    </div>
  );
  const sectionTitle = sectionId ? (chips.find((chip) => chip.id === sectionId)?.label ?? sectionLabel(sectionId)) : "";

  return (
    <section
      ref={rootRef}
      className="ov-settings ovm-settings"
      data-component="OverhaulSettingsPage"
      data-ovm-level={level}
    >
      {level === "root" ? (
        <>
          <header className="ov-settings__head">
            <h1>{localize("Settings")}</h1>
            <div className="ov-settings__search">
              <label className="ov-search">
                <Search size={14} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={localize("Search all settings")}
                />
              </label>
            </div>
          </header>
          <div className="ovm-settings__rows">
            {query.trim()
              ? results.length
                ? results.map((result) =>
                    row(
                      `${result.tab.id}:${result.id}`,
                      localize(sectionLabel(result.id)),
                      localize(result.tab.label),
                      () => {
                        setQuery("");
                        if (result.page) {
                          openLibrarySection(result.page);
                          return;
                        }
                        scrolls.current.tab = 0;
                        setTab(result.tab.id);
                        setSectionId(result.id);
                        go("section");
                      },
                    ),
                  )
                : [
                    <p key="none" className="ovm-drill-help">
                      {localize("No settings match.")}
                    </p>,
                  ]
              : OVERHAUL_SETTINGS_TABS.map((item) =>
                  row(item.id, localize(item.label), localize(item.blurb), () => {
                    scrolls.current.tab = 0;
                    setTab(item.id);
                    go("tab");
                  }),
                )}
          </div>
        </>
      ) : null}
      {level === "tab" ? (
        <>
          {head(localize(tab.label), () => go("root", true))}
          <div className="ovm-settings__rows">
            {chips.map((chip) =>
              row(chip.id, chip.label, null, () => {
                setSectionId(chip.id);
                go("section");
              }),
            )}
          </div>
        </>
      ) : null}
      {level === "section" && sectionId ? (
        <>
          {head(sectionTitle, () => go("tab", true))}
          <div className="ov-settings__scroll ovm-settings__section">
            <Suspense fallback={<p className="ov-gallery__note">{localize("Loading…")}</p>}>
              <OverhaulSettingsSections key={sectionId} sectionIds={[sectionId]} />
            </Suspense>
          </div>
        </>
      ) : null}
      {level === "tab" ? (
        <div className="ovm-settings__probe" ref={setProbeEl} aria-hidden="true">
          <Suspense fallback={null}>
            <OverhaulSettingsSections key={tab.id} sectionIds={tab.sections} />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}

function OverhaulSettingsDesktop() {
  const localize = useLocalizedUiText();
  const tabId = useOverhaulStore((s) => s.settingsTab);
  const setTab = useOverhaulStore((s) => s.setSettingsTab);
  const [query, setQuery] = useState("");
  const tab = OVERHAUL_SETTINGS_TABS.find((item) => item.id === tabId) ?? OVERHAUL_SETTINGS_TABS[0]!;
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const chips = useSectionChips(scrollEl, tab.sections);
  // A new tab starts at its top.
  useEffect(() => {
    scrollEl?.scrollTo({ top: 0 });
  }, [scrollEl, tab.id]);

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
    )
      .concat(
        ELSEWHERE.filter((item) => {
          const meta = SETTINGS_SECTIONS.find((section) => section.id === item.id);
          return [meta?.label, meta?.description, ...(meta?.aliases ?? [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle);
        }).map((item) => ({
          tab: { id: item.page, label: item.label } as unknown as (typeof OVERHAUL_SETTINGS_TABS)[number],
          id: item.id,
          page: item.page,
        })),
      )
      .slice(0, 12) as { tab: (typeof OVERHAUL_SETTINGS_TABS)[number]; id: SettingsSectionId; page?: "extensions" }[];
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
                    if (result.page) {
                      openLibrarySection(result.page);
                      return;
                    }
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
        {chips.map((chip) => (
          <button key={chip.id} type="button" className="ov-chip" onClick={() => scrollToSection(chip.id)}>
            {chip.label}
          </button>
        ))}
      </div>
      <div className="ov-settings__scroll" ref={setScrollEl}>
        <Suspense fallback={<p className="ov-gallery__note">{localize("Loading…")}</p>}>
          <OverhaulSettingsSections key={tab.id} sectionIds={tab.sections} />
        </Suspense>
      </div>
    </section>
  );
}

/** The Extensions page: Personal Extensions (moved here from Settings > Addons). */
export function OverhaulExtensionsPage() {
  const localize = useLocalizedUiText();
  return (
    <section className="ov-settings ov-settings--extensions" data-component="OverhaulExtensionsPage">
      <header className="ov-settings__head">
        <h1>{localize("Extensions")}</h1>
        <p>{localize("Personal Extensions: drafts Professor Mari writes for you, and packages you import")}</p>
      </header>
      <div className="ov-settings__scroll">
        <Suspense fallback={<p className="ov-gallery__note">{localize("Loading…")}</p>}>
          <OverhaulSettingsSections sectionIds={["personal-extensions"]} />
        </Suspense>
      </div>
    </section>
  );
}
