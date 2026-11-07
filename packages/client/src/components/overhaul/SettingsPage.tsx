// ──────────────────────────────────────────────
// UI overhaul: Settings as one page with seven plain tabs
//
// Every real settings section is kept and placed in one of seven tabs; the
// sections themselves are the app's own components, so nothing loses
// behaviour. Chips under the tabs jump to a section; search covers all tabs.
// ──────────────────────────────────────────────
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { APP_VERSION, SETTINGS_SECTIONS, type SettingsSectionId } from "@marinara-engine/shared";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../../stores/ui.store";
import { useMatchMedia } from "../../hooks/use-match-media";
import { useOverhaulMobile, useOverhaulStore, type OverhaulSettingsTab } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { openLibrarySection } from "./library-navigation";
import { OVERHAUL_SETTINGS_TABS, overhaulSettingsTabFor } from "./settings-tabs";
import { SETTINGS_SEARCHABLE_CONTROLS } from "../../lib/settings-registry";

export { OVERHAUL_SETTINGS_TABS };

const OverhaulSettingsSections = lazy(() =>
  import("../panels/SettingsPanel").then((m) => ({ default: m.OverhaulSettingsSections })),
);

const SECTION_LABELS: Partial<Record<SettingsSectionId, string>> = {};

function sectionLabel(id: SettingsSectionId) {
  return SECTION_LABELS[id] ?? SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? id;
}

/**
 * Scrolls the settings list (only the list, never the page around it) to a section and flashes
 * it, so you can see which block the chip meant.
 */
function scrollToSection(id: SettingsSectionId, attempt = 0, controlId?: string | null) {
  window.requestAnimationFrame(() => {
    const target =
      (controlId ? document.getElementById(`settings-control-${controlId}`) : null) ??
      document.getElementById(`settings-section-${id}`);
    const scroller = target?.closest<HTMLElement>(".ov-settings__scroll");
    if (!target || !scroller || target.offsetParent === null) {
      // The tab's sections load lazily; try again for a moment after a tab switch.
      if (attempt < 20) window.setTimeout(() => scrollToSection(id, attempt + 1, controlId), 100);
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

/**
 * A setting picked somewhere else (omnibar, Professor Mari, a link): the navigation already chose
 * this page's tab; here the page goes to the section or row and flashes it, then forgets the request.
 */
function useSettingsJumpTarget(onJump: (sectionId: SettingsSectionId, controlId: string | null) => void) {
  const controlId = useUIStore((s) => s.settingsTargetControlId);
  const targetSectionId = useUIStore((s) => s.settingsTargetSectionId);
  const jump = useRef(onJump);
  jump.current = onJump;
  useEffect(() => {
    if (!controlId && !targetSectionId) return;
    const sectionId = (targetSectionId ??
      SETTINGS_SEARCHABLE_CONTROLS.find((control) => control.id === controlId)?.sectionId ??
      null) as SettingsSectionId | null;
    const ui = useUIStore.getState();
    ui.setSettingsTargetControlId(null);
    ui.setSettingsTargetSectionId(null);
    if (!sectionId) return;
    const tab = overhaulSettingsTabFor(sectionId);
    if (tab && useOverhaulStore.getState().settingsTab !== tab) useOverhaulStore.getState().setSettingsTab(tab);
    jump.current(sectionId, controlId);
  }, [controlId, targetSectionId]);
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

/** Phones and tablets: a shorter line under each tab, and how the tab opens. */
const MOBILE_TABS: Partial<
  Record<OverhaulSettingsTab, { blurb: string; onePage?: boolean; inline?: SettingsSectionId[] }>
> = {
  general: { blurb: "Language, confirmations, notifications", onePage: true },
  chatting: { blurb: "Replies, message box, swipes, thinking" },
  appearance: { blurb: "Theme, fonts, colors and backgrounds" },
  conversation: { blurb: "How Conversation chats look", onePage: true },
  roleplay: { blurb: "Tracker Panel, avatars, Visual Novel" },
  game: { blurb: "Game Mode text, art and assets", onePage: true },
  media: { blurb: "Image and video generation", inline: ["overall-generations"] },
  data: { blurb: "Imports, backups, storage and deleting data" },
  advanced: { blurb: "Updates, server, requests and security" },
};

/** Sections whose risky buttons (resets, deletes) only show after tapping Edit. */
const EDIT_SECTIONS = new Set<SettingsSectionId>(["app-style", "image-generation", "danger-zone"]);

const IS_ANDROID = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
/** Layout holds a computer-only setting and an Android-only one; elsewhere it would be empty. */
const HIDDEN_ON_DEVICE = new Set<SettingsSectionId>(IS_ANDROID ? [] : ["layout"]);

const VISUAL_THEME_LABELS: Record<string, string> = { default: "Marinara", sillytavern: "SillyTavern", stage: "Stage" };
const AVATAR_LABELS: Record<string, string> = {
  none: "None",
  circles: "Small circles",
  rectangles: "Small rectangles",
  panel: "Side panel",
  faded: "Faded",
};
const WIDGET_LABELS: Record<string, string> = { default: "Default", dottore: "Dottore", mari: "Mari" };

/** The current value shown in grey on a section's row, where one short value says it. */
function useSectionValues(): Partial<Record<SettingsSectionId, string>> {
  const s = useUIStore(
    useShallow((state) => ({
      visualTheme: state.visualTheme,
      theme: state.theme,
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      chatFontColor: state.chatFontColor,
      weatherEffects: state.weatherEffects,
      chatBackground: state.chatBackground,
      chatWidgetPreset: state.chatWidgetPreset,
      activeCustomTheme: state.activeCustomTheme,
      customThemes: state.customThemes,
      trackerPanelEnabled: state.trackerPanelEnabled,
      roleplayAvatarStyle: state.roleplayAvatarStyle,
      roleplayDisplayStyle: state.roleplayDisplayStyle,
      enableStreaming: state.enableStreaming,
      enterToSendRP: state.enterToSendRP,
    })),
  );
  const localize = useLocalizedUiText();
  const customTheme = s.customThemes.find((item) => item.id === s.activeCustomTheme);
  return {
    "app-style": `${VISUAL_THEME_LABELS[s.visualTheme] ?? s.visualTheme} · ${localize(s.theme === "light" ? "Light" : "Dark")}`,
    "text-scale": `${s.fontFamily ? s.fontFamily.split(",")[0]!.replace(/["']/g, "").trim() : localize("Default")} · ${s.fontSize} px`,
    "text-colors": localize(s.chatFontColor ? "Custom" : "Default"),
    "motion-backgrounds": localize(s.weatherEffects ? "Weather on" : "Weather off"),
    "chat-backgrounds": localize(s.chatBackground ? "Custom" : "None"),
    "chat-widgets": localize(WIDGET_LABELS[s.chatWidgetPreset] ?? s.chatWidgetPreset),
    "theme-library": customTheme?.name ?? localize("None"),
    "roleplay-tracker": localize(s.trackerPanelEnabled ? "On" : "Off"),
    "roleplay-avatars": localize(AVATAR_LABELS[s.roleplayAvatarStyle] ?? s.roleplayAvatarStyle),
    "visual-novel": localize(s.roleplayDisplayStyle === "visual-novel" ? "On" : "Off"),
    responses: localize(s.enableStreaming ? "Streaming" : "All at once"),
    "input-editing": localize(s.enterToSendRP ? "Enter sends" : "Enter adds a line"),
    updates: `v${APP_VERSION}`,
  };
}

/**
 * Phones: Settings is three levels of pages. The nine tabs are rows; a tab opens a list of its
 * sections (small tabs open as one page); a section opens a page of its settings. Search jumps
 * straight to a section's page. Back returns to where you were. From about 700px wide (iPad)
 * it is a split view instead: tabs on the left, the tab's sections on the right.
 */
function OverhaulSettingsMobile() {
  const split = useMatchMedia("(min-width: 700px)");
  return split ? <OverhaulSettingsSplit /> : <OverhaulSettingsPhone />;
}

function EditToggle({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  const localize = useLocalizedUiText();
  return (
    <button type="button" className="ovm-settings__edit" aria-pressed={editing} onClick={onToggle}>
      {localize(editing ? "Done" : "Edit")}
    </button>
  );
}

function SettingsSearchField({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  const localize = useLocalizedUiText();
  return (
    <div className="ov-settings__search">
      <label className="ov-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={localize("Search all settings")}
          aria-label={localize("Search all settings")}
        />
      </label>
    </div>
  );
}

function OverhaulSettingsPhone() {
  const localize = useLocalizedUiText();
  const tabId = useOverhaulStore((s) => s.settingsTab);
  const setTab = useOverhaulStore((s) => s.setSettingsTab);
  const [level, setLevel] = useState<"root" | "tab" | "section">("root");
  const [sectionId, setSectionId] = useState<SettingsSectionId | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const results = useSettingsSearch(query).filter((result) => !HIDDEN_ON_DEVICE.has(result.id));
  const values = useSectionValues();
  const tab = OVERHAUL_SETTINGS_TABS.find((item) => item.id === tabId) ?? OVERHAUL_SETTINGS_TABS[0]!;
  const mobileTab = MOBILE_TABS[tab.id] ?? { blurb: tab.blurb };
  const inline = mobileTab.inline ?? [];
  const rootRef = useRef<HTMLElement>(null);
  const scrolls = useRef<Record<string, number>>({});
  const restore = useRef<number | null>(null);
  // Section titles exactly as the sections print them, read from an off-screen copy of the tab.
  const [probeEl, setProbeEl] = useState<HTMLDivElement | null>(null);
  const chips = useSectionChips(probeEl, tab.sections).filter((chip) => !HIDDEN_ON_DEVICE.has(chip.id));
  const onePage = mobileTab.onePage || chips.length === 1;
  const rowChips = chips.filter((chip) => !inline.includes(chip.id));

  const go = (next: "root" | "tab" | "section", back = false) => {
    const el = rootRef.current;
    if (el && !back) scrolls.current[level] = el.scrollTop;
    restore.current = back ? (scrolls.current[next] ?? 0) : 0;
    setEditing(false);
    setLevel(next);
  };
  // Phone: a picked setting opens its section's page (a small tab is one page: open the tab there).
  useSettingsJumpTarget((target, controlId) => {
    const tabEntry = OVERHAUL_SETTINGS_TABS.find((item) => item.sections.includes(target));
    const small = tabEntry ? MOBILE_TABS[tabEntry.id]?.onePage : false;
    setQuery("");
    scrolls.current.tab = 0;
    setSectionId(target);
    go(small ? "tab" : "section");
    if (small) scrollToSectionIn(target, rootRef.current);
    else if (controlId) scrollToSection(target, 0, controlId);
  });
  useLayoutEffect(() => {
    if (restore.current === null) return;
    const top = restore.current;
    restore.current = null;
    rootRef.current?.scrollTo({ top });
  }, [level, sectionId, tab.id]);

  const row = (key: string, label: string, value: string | null | undefined, onClick: () => void) => (
    <button key={key} type="button" className="ovm-drill-row" onClick={onClick}>
      <span className="ovm-drill-row__title">{label}</span>
      {value ? <span className="ovm-drill-row__value">{value}</span> : null}
      <ChevronRight size={16} className="ovm-drill-row__chev" aria-hidden="true" />
    </button>
  );
  const head = (title: string, onBack: () => void, edit = false) => (
    <div className="ovm-drill-page__head">
      <button type="button" className="ovm-drill-page__back" aria-label={localize("Back")} onClick={onBack}>
        <ChevronLeft size={26} aria-hidden="true" />
      </button>
      <span className="ovm-drill-page__title">{title}</span>
      {edit ? <EditToggle editing={editing} onToggle={() => setEditing((on) => !on)} /> : <span aria-hidden="true" />}
    </div>
  );
  const sectionTitle = sectionId ? (chips.find((chip) => chip.id === sectionId)?.label ?? sectionLabel(sectionId)) : "";
  const loading = <p className="ov-gallery__note">{localize("Loading…")}</p>;

  return (
    <section
      ref={rootRef}
      className="ov-settings ovm-settings"
      data-component="OverhaulSettingsPage"
      data-ovm-level={level}
      data-ovm-edit={editing ? "" : undefined}
      data-ovm-android={IS_ANDROID ? "" : undefined}
    >
      {level === "root" ? (
        <>
          <header className="ov-settings__head">
            <h1>{localize("Settings")}</h1>
            <SettingsSearchField query={query} setQuery={setQuery} />
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
                        const small = MOBILE_TABS[result.tab.id]?.onePage;
                        setSectionId(result.id);
                        go(small ? "tab" : "section");
                        if (small) scrollToSectionIn(result.id, rootRef.current);
                      },
                    ),
                  )
                : [
                    <p key="none" className="ovm-drill-help">
                      {localize("No settings match.")}
                    </p>,
                  ]
              : OVERHAUL_SETTINGS_TABS.map((item) =>
                  row(item.id, localize(item.label), localize(MOBILE_TABS[item.id]?.blurb ?? item.blurb), () => {
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
          {onePage ? (
            // Small tabs (and Media before the Illustrator Agent is installed) are one page.
            <div className="ov-settings__scroll ovm-settings__section ovm-settings__onepage">
              <Suspense fallback={loading}>
                <OverhaulSettingsSections key={tab.id} sectionIds={tab.sections} />
              </Suspense>
            </div>
          ) : (
            <>
              {inline.length ? (
                <div className="ov-settings__scroll ovm-settings__section ovm-settings__onepage ovm-settings__inline">
                  <Suspense fallback={loading}>
                    <OverhaulSettingsSections key={`${tab.id}:inline`} sectionIds={inline} />
                  </Suspense>
                </div>
              ) : null}
              <div className="ovm-settings__rows">
                {rowChips.map((chip) =>
                  row(chip.id, chip.label, values[chip.id], () => {
                    setSectionId(chip.id);
                    go("section");
                  }),
                )}
              </div>
            </>
          )}
        </>
      ) : null}
      {level === "section" && sectionId ? (
        <>
          {head(sectionTitle, () => go("tab", true), EDIT_SECTIONS.has(sectionId))}
          <div className="ov-settings__scroll ovm-settings__section ovm-settings__single">
            <Suspense fallback={loading}>
              <OverhaulSettingsSections
                key={sectionId}
                // Sections nested inside this one (Professor Mari inside App Behavior) show on its page.
                sectionIds={[
                  sectionId,
                  ...tab.sections.filter((id) => id !== sectionId && !chips.some((chip) => chip.id === id)),
                ]}
              />
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

/** Scrolls a phone one-page tab to a section once it has loaded. */
function scrollToSectionIn(id: SettingsSectionId, root: HTMLElement | null, attempt = 0) {
  window.requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>(`.ovm-settings__onepage #settings-section-${id}`);
    if (!target || !root) {
      if (attempt < 20) window.setTimeout(() => scrollToSectionIn(id, root, attempt + 1), 100);
      return;
    }
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top: Math.max(0, top - 56) });
  });
}

/** iPad (from about 700px wide): tabs on the left, the selected tab's sections on the right. */
function OverhaulSettingsSplit() {
  const localize = useLocalizedUiText();
  const tabId = useOverhaulStore((s) => s.settingsTab);
  const setTab = useOverhaulStore((s) => s.setSettingsTab);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const results = useSettingsSearch(query).filter((result) => !HIDDEN_ON_DEVICE.has(result.id));
  const tab = OVERHAUL_SETTINGS_TABS.find((item) => item.id === tabId) ?? OVERHAUL_SETTINGS_TABS[0]!;
  const sections = tab.sections.filter((id) => !HIDDEN_ON_DEVICE.has(id));
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  useSettingsJumpTarget((sectionId, controlId) => scrollToSection(sectionId, 0, controlId));
  // Edit shows only when the tab has a risky button on screen (Media has none before its Agent is installed).
  const [hasEdit, setHasEdit] = useState(false);
  useEffect(() => {
    if (!scrollEl) return;
    const read = () =>
      setHasEdit(
        Array.from(scrollEl.querySelectorAll<HTMLElement>('[id^="settings-section-"]')).some(
          (el) => el.offsetParent !== null && !!el.querySelector(".ovm-risky"),
        ),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(scrollEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scrollEl]);
  useEffect(() => {
    scrollEl?.scrollTo({ top: 0 });
    setEditing(false);
  }, [scrollEl, tab.id]);

  return (
    <section
      className="ov-settings ovm-settings ovm-settings--split"
      data-component="OverhaulSettingsPage"
      data-ovm-edit={editing ? "" : undefined}
      data-ovm-android={IS_ANDROID ? "" : undefined}
      data-ovm-tab={tab.id}
    >
      <nav className="ovm-settings__side" aria-label={localize("Settings tabs")}>
        <h1>{localize("Settings")}</h1>
        <SettingsSearchField query={query} setQuery={setQuery} />
        {query.trim() ? (
          results.length ? (
            results.map((result) => (
              <button
                key={`${result.tab.id}:${result.id}`}
                type="button"
                className="ovm-settings__tab ovm-settings__tab--result"
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
            ))
          ) : (
            <p className="ovm-drill-help">{localize("No settings match.")}</p>
          )
        ) : (
          OVERHAUL_SETTINGS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn("ovm-settings__tab", item.id === tab.id && "is-on")}
              aria-current={item.id === tab.id ? "page" : undefined}
              onClick={() => setTab(item.id)}
            >
              {localize(item.label)}
            </button>
          ))
        )}
      </nav>
      <div className="ov-settings__scroll ovm-settings__main ovm-settings__onepage" ref={setScrollEl}>
        <div className="ovm-settings__mainhead">
          <h2>{localize(tab.label)}</h2>
          {hasEdit ? <EditToggle editing={editing} onToggle={() => setEditing((on) => !on)} /> : null}
        </div>
        <Suspense fallback={<p className="ov-gallery__note">{localize("Loading…")}</p>}>
          <OverhaulSettingsSections key={tab.id} sectionIds={sections} />
        </Suspense>
      </div>
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
  useSettingsJumpTarget((sectionId, controlId) => scrollToSection(sectionId, 0, controlId));

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
      {chips.length > 1 ? (
        <div className="ov-settings__chips">
          {chips.map((chip) => (
            <button key={chip.id} type="button" className="ov-chip" onClick={() => scrollToSection(chip.id)}>
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
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
