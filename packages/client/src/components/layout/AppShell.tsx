// ──────────────────────────────────────────────
// Layout: Main App Shell (Discord-like three-column)
// ──────────────────────────────────────────────
import { ChatSidebar } from "./ChatSidebar";
import { ChatArea } from "../chat/ChatArea";
import { CharacterEditor } from "../characters/CharacterEditor";
import { LorebookEditor } from "../lorebooks/LorebookEditor";
import { PresetEditor } from "../presets/PresetEditor";
import { ConnectionEditor } from "../connections/ConnectionEditor";
import { AgentEditor } from "../agents/AgentEditor";
import { ToolEditor } from "../agents/ToolEditor";
import { PersonaEditor } from "../personas/PersonaEditor";
import { RegexScriptEditor } from "../agents/RegexScriptEditor";
import { BotBrowserView } from "../bot-browser/BotBrowserView";
import { RightPanel } from "./RightPanel";
import { TopBar } from "./TopBar";
import { OnboardingTutorial } from "../onboarding/OnboardingTutorial";
import { ChatNotificationBubbles } from "../chat/ChatNotificationBubbles";
import { useUIStore } from "../../stores/ui.store";
import { useBackgroundAutonomousPolling } from "../../hooks/use-background-autonomous";
import { useIdleDetection } from "../../hooks/use-idle-detection";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";

export function AppShell() {
  // Background autonomous polling for inactive conversation chats
  useBackgroundAutonomousPolling();

  // Auto idle detection (10 min inactivity → idle, activity → active)
  useIdleDetection();

  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  // Track mobile breakpoint for right-panel animation strategy
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Auto-close right panel when viewport is too narrow for comfort
  useEffect(() => {
    if (isMobile) return; // Mobile uses overlays, no squishing concern
    let rafId = 0;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { rightPanelOpen: rp, sidebarOpen: sb, sidebarWidth: sw, closeRightPanel: close } = useUIStore.getState();
        if (!rp) return;
        const panelWidth = 320; // 20rem
        const reserved = (sb ? sw : 0) + panelWidth;
        if (window.innerWidth - reserved < 400) close();
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  // ── Center-area overflow detection ──
  // When the center <main> content overflows horizontally, switch to compact
  // layout. Uses hysteresis to prevent toggling back-and-forth.
  const mainRef = useRef<HTMLElement>(null);
  const compactWidthRef = useRef(0); // width when we last switched to compact
  const setCenterCompact = useUIStore((s) => s.setCenterCompact);

  const checkOverflow = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const compact = useUIStore.getState().centerCompact;
    const width = el.clientWidth;

    if (compact) {
      // Currently compact — switch back only if width grew past the
      // threshold where we entered compact + a comfort buffer.
      if (width > compactWidthRef.current + 80) {
        setCenterCompact(false);
      }
    } else {
      // Currently wide — walk immediate children looking for overflow.
      let overflows = false;
      const scan = (node: Element, depth: number) => {
        if (overflows || depth > 3) return;
        if (node.scrollWidth > node.clientWidth + 2) {
          overflows = true;
          return;
        }
        for (let i = 0; i < node.children.length; i++) {
          scan(node.children[i], depth + 1);
        }
      };
      scan(el, 0);
      if (overflows) {
        compactWidthRef.current = width;
        setCenterCompact(true);
      }
    }
  }, [setCenterCompact]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkOverflow]);

  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const characterDetailId = useUIStore((s) => s.characterDetailId);
  const lorebookDetailId = useUIStore((s) => s.lorebookDetailId);
  const presetDetailId = useUIStore((s) => s.presetDetailId);
  const connectionDetailId = useUIStore((s) => s.connectionDetailId);
  const agentDetailId = useUIStore((s) => s.agentDetailId);
  const toolDetailId = useUIStore((s) => s.toolDetailId);
  const personaDetailId = useUIStore((s) => s.personaDetailId);
  const regexDetailId = useUIStore((s) => s.regexDetailId);
  const botBrowserOpen = useUIStore((s) => s.botBrowserOpen);

  return (
    <div
      data-component="AppShell"
      className="mari-app retro-scanlines noise-bg geometric-grid fixed inset-0 flex overflow-hidden bg-[var(--background)] max-md:pt-[env(safe-area-inset-top)]"
    >
      {/* Y2K decorative stars */}
      <div className="y2k-star hidden md:block" style={{ top: "10%", left: "5%", animationDelay: "0s" }} />
      <div className="y2k-star-md hidden md:block" style={{ top: "25%", right: "8%", animationDelay: "1.5s" }} />
      <div className="y2k-star-lg hidden md:block" style={{ top: "60%", left: "3%", animationDelay: "3s" }} />
      <div className="y2k-star hidden md:block" style={{ top: "80%", right: "12%", animationDelay: "0.8s" }} />
      <div className="y2k-star-md hidden md:block" style={{ top: "45%", left: "50%", animationDelay: "2.2s" }} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar - Chat list */}
      <aside
        data-tour="sidebar"
        data-component="ChatSidebarPanel"
        aria-label="Chat list"
        className={cn(
          "mari-sidebar flex-shrink-0 overflow-hidden bg-[var(--background)]/80 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          sidebarOpen && "border-r border-[var(--sidebar-border)]/30",
          // Mobile: fixed overlay
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-2xl max-md:pt-[env(safe-area-inset-top)]",
          !sidebarOpen && "max-md:!w-0",
        )}
        style={{ width: sidebarOpen ? (isMobile ? "100vw" : sidebarWidth) : 0 }}
      >
        <div className="h-full" style={{ width: isMobile ? "100vw" : sidebarWidth }}>
          <ChatSidebar />
        </div>
      </aside>

      {/* Center content */}
      <main
        ref={mainRef}
        data-tour="chat-area"
        data-component="CenterContent"
        aria-label="Main content"
        className="@container mari-main relative flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <TopBar />
        {botBrowserOpen ? (
          <BotBrowserView />
        ) : regexDetailId ? (
          <RegexScriptEditor />
        ) : personaDetailId ? (
          <PersonaEditor />
        ) : toolDetailId ? (
          <ToolEditor />
        ) : agentDetailId ? (
          <AgentEditor />
        ) : connectionDetailId ? (
          <ConnectionEditor />
        ) : presetDetailId ? (
          <PresetEditor />
        ) : characterDetailId ? (
          <CharacterEditor />
        ) : lorebookDetailId ? (
          <LorebookEditor />
        ) : (
          <ChatArea />
        )}
        {/* Floating avatar notification bubbles (right edge) */}
        <ChatNotificationBubbles />
      </main>

      {/* Mobile right panel backdrop */}
      {rightPanelOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => closeRightPanel()} />
      )}

      {/* Right panel - Context / Settings */}
      {isMobile ? (
        <AnimatePresence mode="wait">
          {rightPanelOpen && (
            <motion.aside
              key="mobile"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              data-component="RightPanelMobile"
              aria-label="Settings and tools panel"
              className="mari-right-panel !fixed inset-y-0 right-0 z-50 !w-full shadow-2xl overflow-hidden bg-[var(--background)]/80 backdrop-blur-xl pt-[env(safe-area-inset-top)]"
            >
              <RightPanel />
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <aside
          data-component="RightPanelDesktop"
          aria-label="Settings and tools panel"
          className={cn(
            "mari-right-panel flex-shrink-0 overflow-hidden bg-[var(--background)]/80 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            rightPanelOpen && "border-l border-[var(--sidebar-border)]/30",
          )}
          style={{ width: rightPanelOpen ? "20rem" : 0 }}
        >
          <div className="h-full" style={{ width: "20rem" }}>
            <RightPanel />
          </div>
        </aside>
      )}

      {/* First-time onboarding tutorial */}
      <OnboardingTutorial />
    </div>
  );
}
