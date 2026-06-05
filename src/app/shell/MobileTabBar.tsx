import { Home, MessageSquare, Plus, LayoutGrid, Bot, Users, BookOpen, FileText, Link, Sparkles, Settings, User } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";
import { cn } from "../../shared/lib/utils";

const MODE_OPTIONS = [
  { mode: "conversation" as const, label: "Conversation", color: "text-cyan-400", border: "border-cyan-500/30", gradient: "from-cyan-500/20 to-cyan-500/5" },
  { mode: "roleplay" as const, label: "Roleplay", color: "text-pink-400", border: "border-pink-500/30", gradient: "from-pink-500/20 to-pink-500/5" },
  { mode: "game" as const, label: "Game", color: "text-amber-400", border: "border-amber-500/30", gradient: "from-amber-500/20 to-amber-500/5" },
];

export const TOOLS_PANELS = [
  { panel: "bot-browser" as const, icon: Bot, label: "Browser", gradient: "from-cyan-500 to-blue-500", color: "text-cyan-400" },
  { panel: "characters" as const, icon: Users, label: "Characters", gradient: "from-pink-500 to-rose-500", color: "text-rose-400" },
  { panel: "lorebooks" as const, icon: BookOpen, label: "Lorebooks", gradient: "from-amber-500 to-orange-500", color: "text-amber-400" },
  { panel: "presets" as const, icon: FileText, label: "Presets", gradient: "from-purple-500 to-violet-500", color: "text-violet-400" },
  { panel: "connections" as const, icon: Link, label: "Connections", gradient: "from-sky-500 to-blue-500", color: "text-sky-400" },
  { panel: "agents" as const, icon: Sparkles, label: "Agents", gradient: "from-pink-500 to-purple-500", color: "text-pink-400" },
  { panel: "personas" as const, icon: User, label: "Personas", gradient: "from-emerald-500 to-teal-500", color: "text-emerald-400" },
  { panel: "settings" as const, icon: Settings, label: "Settings", gradient: "from-zinc-400 to-zinc-500", color: "text-zinc-300" },
] as const;

export function MobileTabBar({
  professorMariOpen,
  onToggleProfessorMari,
  onGoHome,
}: {
  professorMariOpen: boolean;
  onToggleProfessorMari: () => void;
  onGoHome: () => void;
}) {
  const [modePicker, setModePicker] = useState(false);
  const [toolsSheet, setToolsSheet] = useState(false);
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
    setModePicker(false);
    setToolsSheet(false);
    setSidebarOpen(false);
    closeRightPanel();
    closeAllDetails();
  };

  const goHome = () => {
    closeAll();
    setActiveChatId(null);
    onGoHome();
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

  const openPanel = (panel: typeof TOOLS_PANELS[number]["panel"]) => {
    const wasThisPanel = rightPanelOpen && rightPanel === panel;
    closeAll();
    if (!wasThisPanel) openRightPanel(panel);
  };

  const startNewChat = (mode: "conversation" | "roleplay" | "game") => {
    closeAll();
    setActiveChatId(null);
    onGoHome();
    useChatStore.getState().setPendingNewChatMode(mode);
  };

  const isHome = !professorMariOpen && !sidebarOpen && !rightPanelOpen;
  const isChats = sidebarOpen;
  const isMari = professorMariOpen;
  const isTools = rightPanelOpen && !sidebarOpen;

  return (
    <>
      {/* Scrim for mode picker */}
      {modePicker && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
          style={{ zIndex: 65 }}
          onClick={closeAll}
        />
      )}

      {/* Scrim for tools sheet */}
      {toolsSheet && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm md:hidden"
          style={{ zIndex: 65 }}
          onClick={closeAll}
        />
      )}

      {/* Mode picker sheet */}
      {modePicker && (
        <div className="fixed left-1/2 w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 flex flex-col gap-2 md:hidden" style={{ zIndex: 70, bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}>
          {MODE_OPTIONS.map(({ mode, label, color, border, gradient }) => (
            <button
              key={mode}
              type="button"
              onClick={() => startNewChat(mode)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border bg-gradient-to-r px-5 py-3.5 text-sm font-bold shadow-lg backdrop-blur-xl transition-transform active:scale-95 bg-[var(--card)]",
                border,
                color,
                gradient,
              )}
            >
              <Plus size="0.9rem" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Tools bottom sheet */}
      {toolsSheet && (
        <div
          className="fixed left-0 right-0 rounded-t-3xl border-t border-[var(--border)]/50 bg-[var(--card)] shadow-2xl backdrop-blur-2xl md:hidden"
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
        <TabButton icon={<Home size="1.15rem" />} label="Home" active={isHome} onClick={goHome} />
        <TabButton icon={<MessageSquare size="1.15rem" />} label="Chats" active={isChats} onClick={openChats} />

        {/* + FAB */}
        <button
          type="button"
          onClick={() => { setToolsSheet(false); setModePicker((v) => !v); }}
          aria-label="New chat"
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-90",
            modePicker
              ? "border-[var(--primary)]/60 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg"
              : "border-[var(--primary)]/30 bg-[color-mix(in_srgb,var(--primary)_20%,var(--card))] text-[var(--primary)] shadow-md",
          )}
        >
          <Plus size="1.25rem" className={cn("transition-transform duration-200", modePicker && "rotate-45")} />
        </button>

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
          active={isTools || toolsSheet}
          onClick={() => {
            setModePicker(false);
            if (rightPanelOpen) {
              closeRightPanel();
            } else {
              setToolsSheet((v) => !v);
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
  icon: React.ReactNode;
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
