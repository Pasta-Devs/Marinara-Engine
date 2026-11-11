// ──────────────────────────────────────────────
// UI overhaul: the one sidebar (right side)
//
// Chats and the Library share one sidebar on the right, with a Chats | Library
// switch at its top. Desktop shows it as the right pane (the top bar's Library
// button opens and hides it). Phones and tablets show the same sidebar as a page
// that slides over from the right (the Library button at the top right), with
// Settings, Docs and All Tabs pinned at the bottom of its Library view.
// ──────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, Layers, MessageCircle, Settings } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { useChatStore } from "../../stores/chat.store";
import { useOverhaulStore, type OverhaulSidePane } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { cn } from "../../lib/utils";
import { ChatSidebar } from "../layout/ChatSidebar";
import { LibraryNav } from "./LibraryNav";
import { LIBRARY_SECTIONS, openLibrarySection } from "./library-navigation";

/** The Chats | Library switch at the top of the sidebar. */
function SidePaneSwitch() {
  const localize = useLocalizedUiText();
  const view = useOverhaulStore((s) => s.sidePane);
  const setView = useOverhaulStore((s) => s.setSidePane);
  const options: { id: OverhaulSidePane; label: string; Icon: typeof Layers; tour: string }[] = [
    { id: "chats", label: "Chats", Icon: MessageCircle, tour: "sidebar-toggle" },
    { id: "library", label: "Library", Icon: Layers, tour: "library-switch" },
  ];
  return (
    <div className="ov-sideswitch" role="tablist" aria-label={localize("Sidebar")}>
      {options.map(({ id, label, Icon, tour }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          className={cn("ov-sideswitch__btn", view === id && "is-on")}
          onClick={() => setView(id)}
          data-tour={tour}
        >
          <Icon size={15} aria-hidden="true" />
          <span>{localize(label)}</span>
        </button>
      ))}
    </div>
  );
}

/** Desktop: the right pane. */
export function OverhaulSidePane() {
  const view = useOverhaulStore((s) => s.sidePane);
  return (
    <div className="ov-sidepane" data-component="OverhaulSidePane" data-view={view}>
      <SidePaneSwitch />
      <div className="ov-sidepane__body" data-tour={view === "chats" ? "sidebar" : undefined}>
        {view === "chats" ? <ChatSidebar /> : <LibraryNav />}
      </div>
    </div>
  );
}

/** Close the phone page, then run what a row asked for. */
function closeSidePage() {
  useOverhaulStore.getState().setMobileSidePageOpen(false);
}

/** Phones and tablets: the Library view, as today's Stack menu, rows then Settings, Docs and All Tabs. */
function MobileLibraryList() {
  const localize = useLocalizedUiText();
  const tabCount = useOverhaulStore((s) => s.tabs.length);
  const pick = (run: () => void) => () => {
    closeSidePage();
    run();
  };
  const rows = LIBRARY_SECTIONS.filter((entry) => entry.id !== "settings");
  return (
    <div className="ovm-sidepage__library">
      <nav className="ovm-sidepage__rows" aria-label={localize("Library")}>
        {rows.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              className="ovm-stack-menu__row"
              onClick={pick(() => openLibrarySection(entry.id))}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{localize(entry.label)}</span>
            </button>
          );
        })}
      </nav>
      <div className="ovm-sidepage__dock">
        <button type="button" className="ovm-stack-menu__tile" onClick={pick(() => openLibrarySection("settings"))}>
          <Settings size={22} aria-hidden="true" />
          <span>{localize("Settings")}</span>
        </button>
        <button
          type="button"
          className="ovm-stack-menu__tile"
          onClick={pick(() => {
            useUIStore.getState().closeAllDetails();
            useOverhaulStore.getState().openDocs(null);
          })}
        >
          <CircleHelp size={22} aria-hidden="true" />
          <span>{localize("Docs")}</span>
        </button>
        <button
          type="button"
          className="ovm-stack-menu__tile"
          onClick={pick(() => useOverhaulStore.getState().setAllTabsOpen(true))}
        >
          <span className="ovm-tabs-icon" aria-hidden="true">
            {tabCount + 1}
          </span>
          <span>{localize("All tabs")}</span>
        </button>
      </div>
    </div>
  );
}

/** Phones and tablets: the sidebar as a page that slides over from the right, under the top bar. */
export function MobileSidePage() {
  const localize = useLocalizedUiText();
  const open = useOverhaulStore((s) => s.mobileSidePageOpen);
  const view = useOverhaulStore((s) => s.sidePane);
  const activeChatId = useChatStore((s) => s.activeChatId);
  // Opening a chat from the list (or anywhere) closes the page so the chat shows.
  const lastChat = useRef(activeChatId);
  useEffect(() => {
    if (lastChat.current === activeChatId) return;
    lastChat.current = activeChatId;
    closeSidePage();
  }, [activeChatId]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidePage();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="ovm-sidepage" role="dialog" aria-label={localize(view === "chats" ? "Chats" : "Library")}>
      <SidePaneSwitch />
      <div className="ovm-sidepage__body" data-tour={view === "chats" ? "sidebar" : undefined}>
        {view === "chats" ? <ChatSidebar /> : <MobileLibraryList />}
      </div>
    </div>,
    document.body,
  );
}
