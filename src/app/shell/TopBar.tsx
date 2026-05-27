// ──────────────────────────────────────────────
// Layout: Mobile App Top Bar
// ──────────────────────────────────────────────
import { Bot, ChevronDown, Menu, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";
import { RIGHT_PANEL_BUTTONS } from "./PanelNavButtons";

export function TopBar({
  professorMariOpen = false,
  onOpenProfessorMari,
  onGoHome,
}: {
  professorMariOpen?: boolean;
  onOpenProfessorMari?: () => void;
  onGoHome?: () => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const rightPanel = useUIStore((s) => s.rightPanel);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const setTrackerPanelOpen = useUIStore((s) => s.setTrackerPanelOpen);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const hasOpenSurface = useUIStore((s) =>
    Boolean(
      s.characterDetailId ||
        s.lorebookDetailId ||
        s.presetDetailId ||
        s.connectionDetailId ||
        s.agentDetailId ||
        s.toolDetailId ||
        s.personaDetailId ||
        s.regexDetailId ||
        s.characterLibraryOpen ||
        s.botBrowserOpen ||
        s.gameAssetsBrowserOpen ||
        s.rightPanelOpen,
    ),
  );

  useEffect(() => {
    if (!toolsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setToolsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toolsOpen]);

  const openChats = () => {
    closeRightPanel();
    setTrackerPanelOpen(false);
    setSidebarOpen(true);
    setToolsOpen(false);
  };

  const goHome = () => {
    setActiveChatId(null);
    closeAllDetails();
    closeRightPanel();
    setSidebarOpen(false);
    setTrackerPanelOpen(false);
    setToolsOpen(false);
    onGoHome?.();
  };

  const openProfessorMari = () => {
    setActiveChatId(null);
    closeAllDetails();
    closeRightPanel();
    setSidebarOpen(false);
    setTrackerPanelOpen(false);
    setToolsOpen(false);
    onOpenProfessorMari?.();
  };

  const isHomeSurface = !professorMariOpen && !activeChatId && !hasOpenSurface;

  return (
    <header
      data-component="TopBar"
      className="mari-topbar relative z-30 flex h-[3.25rem] flex-shrink-0 items-center gap-2 px-2.5 pb-1 md:hidden"
    >
      <button
        type="button"
        onClick={openChats}
        className={cn(
          "mari-mobile-topbar-button shrink-0",
          sidebarOpen && "mari-mobile-topbar-button-active text-[var(--primary)]",
        )}
        title="Open chats"
        aria-label="Open chats"
        aria-pressed={sidebarOpen}
      >
        <Menu size="1.05rem" aria-hidden />
      </button>

      <button
        type="button"
        onClick={goHome}
        className="mari-mobile-topbar-title mari-mobile-topbar-home"
        title="Home"
        aria-label="Home"
        aria-current={isHomeSurface ? "page" : undefined}
      >
        <span className="mari-mobile-home-mark" aria-hidden>
          <img src="/favicon.png" alt="" draggable={false} />
        </span>
      </button>

      <button
        type="button"
        onClick={openProfessorMari}
        className={cn(
          "mari-mobile-topbar-button shrink-0 max-[360px]:hidden",
          professorMariOpen && "mari-mobile-topbar-button-active text-[var(--primary)]",
        )}
        title="Professor Mari"
        aria-label="Professor Mari"
        aria-pressed={professorMariOpen}
      >
        <img
          src="/sprites/mari/Mari_profile.png"
          alt=""
          className="mari-titlebar-avatar-icon rounded-[0.2rem] object-cover"
          draggable={false}
        />
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setToolsOpen((open) => !open)}
          className={cn("mari-mobile-topbar-tools", toolsOpen && "mari-mobile-topbar-button-active")}
          title={toolsOpen ? "Close tools" : "Open tools"}
          aria-label={toolsOpen ? "Close tools" : "Open tools"}
          aria-expanded={toolsOpen}
        >
          {toolsOpen ? <X size="1rem" aria-hidden /> : <Sparkles size="1rem" aria-hidden />}
          <span className="max-[340px]:hidden">Tools</span>
          <ChevronDown size="0.75rem" aria-hidden className={cn("transition-transform", toolsOpen && "rotate-180")} />
        </button>

        {toolsOpen && (
          <div className="mari-mobile-tools-menu" role="menu" aria-label="Tools and panels">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                setTrackerPanelOpen(false);
                openRightPanel("bot-browser");
                setToolsOpen(false);
              }}
              className="mari-mobile-tools-item"
              role="menuitem"
            >
              <Bot size="0.95rem" aria-hidden />
              Browser
            </button>
            {RIGHT_PANEL_BUTTONS.filter(({ panel }) => panel !== "bot-browser").map(({ panel, icon: Icon, label }) => {
              const isActive = rightPanelOpen && rightPanel === panel;
              return (
                <button
                  key={panel}
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setTrackerPanelOpen(false);
                    openRightPanel(panel);
                    setToolsOpen(false);
                  }}
                  className={cn("mari-mobile-tools-item", isActive && "mari-mobile-tools-item-active")}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size="0.95rem" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
