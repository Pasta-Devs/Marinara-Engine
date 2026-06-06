import { LayoutGrid, MessageSquare } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { TOOLS_PANELS, type MobileToolsPanel } from "../../shared/components/mobile-shell-actions";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";

export function MobileTabBar({
  professorMariOpen,
  toolsSheetOpen,
  toolsSheetRef,
  trackerPanelVisible,
  onToolsSheetOpenChange,
  onToggleProfessorMari,
  onGoHome,
}: {
  professorMariOpen: boolean;
  toolsSheetOpen: boolean;
  toolsSheetRef: RefObject<HTMLDivElement | null>;
  trackerPanelVisible: boolean;
  onToolsSheetOpenChange: (open: boolean | ((open: boolean) => boolean)) => void;
  onToggleProfessorMari: () => void;
  onGoHome: () => void;
}) {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);
  const openRightPanel = useUIStore((s) => s.openRightPanel);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanel = useUIStore((s) => s.rightPanel);

  if (activeChatId !== null) return null;

  const closeAll = () => {
    onToolsSheetOpenChange(false);
    setSidebarOpen(false);
    closeRightPanel();
    closeAllDetails();
  };

  const openChats = () => {
    const wasOpen = sidebarOpen;
    closeAll();
    if (!wasOpen) setSidebarOpen(true);
  };

  const openMari = () => {
    closeAll();
    setActiveChatId(null);
    if (professorMariOpen) {
      onGoHome();
    } else {
      onToggleProfessorMari();
    }
  };

  const openPanel = (panel: MobileToolsPanel) => {
    const wasThisPanel = rightPanelOpen && rightPanel === panel;
    closeAll();
    if (!wasThisPanel) openRightPanel(panel);
  };

  const isTools = rightPanelOpen || toolsSheetOpen;
  const isChats = sidebarOpen && !rightPanelOpen && !toolsSheetOpen && !trackerPanelVisible;
  const isMari = professorMariOpen;

  return (
    <>
      {/* Scrim for tools sheet */}
      {toolsSheetOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
          style={{ zIndex: 65 }}
          onClick={closeAll}
        />
      )}

      {/* Tools bottom sheet */}
      {toolsSheetOpen && (
        <div
          ref={toolsSheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Tools panels"
          tabIndex={-1}
          className="fixed left-0 right-0 max-h-[70dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl animate-fade-in-up md:hidden"
          style={{ zIndex: 70, bottom: "calc(3.5rem + env(safe-area-inset-bottom))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <p className="px-5 pt-6 pb-3 text-[0.7rem] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]/60">
            Panels
          </p>
          <div className="grid grid-cols-2 gap-2.5 px-4 pb-2 overflow-hidden">
            {TOOLS_PANELS.map(({ panel, icon: Icon, label, gradient }) => {
              const isActive = rightPanelOpen && rightPanel === panel;
              return (
                <button
                  key={panel}
                  type="button"
                  onClick={() => openPanel(panel)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-95",
                    isActive
                      ? "border-[var(--primary)]/40 bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))]"
                      : "border-[var(--border)]/50 bg-[var(--secondary)]/50 hover:border-[var(--border)]",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                      gradient,
                    )}
                  >
                    <Icon size="1rem" />
                  </div>
                  <span className={cn("text-sm font-semibold", isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]")}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav
        aria-label="Main navigation"
        className="mari-mobile-tab-bar fixed bottom-0 left-0 right-0 flex items-center justify-around overflow-hidden border-t border-[var(--border)]/40 bg-[var(--card)] pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ zIndex: 80, isolation: "isolate", transform: "translateZ(0)", willChange: "transform" }}
      >
        <TabButton icon={<MessageSquare size="1.15rem" />} label="Chats" active={isChats} onClick={openChats} />

        <TabButton
          icon={
            <img
              src="/sprites/mari/Mari_profile.png"
              alt=""
              className="h-[1.15rem] w-[1.15rem] rounded-[0.2rem] object-cover"
              draggable={false}
            />
          }
          label="Mari"
          active={isMari}
          onClick={openMari}
        />

        <TabButton
          icon={<LayoutGrid size="1.15rem" />}
          label="Tools"
          active={isTools}
          onClick={() => {
            if (rightPanelOpen) {
              closeRightPanel();
            } else if (toolsSheetOpen) {
              onToolsSheetOpenChange(false);
            } else {
              setSidebarOpen(false);
              closeAllDetails();
              onToolsSheetOpenChange(true);
            }
          }}
        />
      </nav>
    </>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-0.5 px-3 text-[0.6rem] font-semibold tracking-wide transition-all active:scale-90",
        active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
      )}
    >
      <span className="relative flex items-center justify-center">
        {icon}
        {active && (
          <span className="absolute -top-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--primary)] to-[color-mix(in_srgb,var(--primary)_70%,transparent)]" />
        )}
      </span>
      {label}
    </button>
  );
}
