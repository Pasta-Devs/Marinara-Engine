import { Home, PanelLeft, PanelLeftClose } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../../shared/lib/utils";
import { useChatStore } from "../../shared/stores/chat.store";
import { useUIStore } from "../../shared/stores/ui.store";

function stopChromeDrag(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

export function ChatTitleControls({
  professorMariOpen = false,
  onOpenProfessorMari,
  onGoHome,
  className,
  hideProfessorOnNarrow = false,
  showDivider = true,
}: {
  professorMariOpen?: boolean;
  onOpenProfessorMari?: () => void;
  onGoHome?: () => void;
  className?: string;
  hideProfessorOnNarrow?: boolean;
  showDivider?: boolean;
}) {
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const closeAllDetails = useUIStore((s) => s.closeAllDetails);

  const goHome = () => {
    setActiveChatId(null);
    closeAllDetails();
    onGoHome?.();
  };

  const openProfessorMari = () => {
    setActiveChatId(null);
    closeAllDetails();
    onOpenProfessorMari?.();
  };

  return (
    <div className={cn("mari-chat-title-controls flex h-full shrink-0 items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={toggleSidebar}
        onMouseDown={stopChromeDrag}
        onDoubleClick={stopChromeDrag}
        data-tour="sidebar-toggle"
        className={cn(
          "mari-titlebar-action relative rounded-md p-1.5 transition-all duration-200",
          sidebarOpen
            ? "mari-titlebar-action-active text-[color-mix(in_srgb,var(--primary)_54%,var(--muted-foreground))] [&>svg]:stroke-[2.3]"
            : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
        )}
        title={sidebarOpen ? "Close chats" : "Open chats"}
        aria-label={sidebarOpen ? "Close chats" : "Open chats"}
        aria-pressed={sidebarOpen}
      >
        {sidebarOpen ? <PanelLeftClose size="0.875rem" /> : <PanelLeft size="0.875rem" />}
        {sidebarOpen && (
          <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" />
        )}
      </button>
      <button
        type="button"
        onClick={goHome}
        onMouseDown={stopChromeDrag}
        onDoubleClick={stopChromeDrag}
        className="mari-titlebar-action rounded-md p-1.5 text-[var(--muted-foreground)] transition-all duration-200 hover:text-[var(--primary)]"
        title="Home"
        aria-label="Home"
      >
        <Home size="0.875rem" />
      </button>
      <button
        type="button"
        onClick={openProfessorMari}
        onMouseDown={stopChromeDrag}
        onDoubleClick={stopChromeDrag}
        className={cn(
          "mari-titlebar-action relative rounded-md p-1 transition-all duration-200",
          hideProfessorOnNarrow && "mari-titlebar-action-mobile-optional",
          professorMariOpen
            ? "mari-titlebar-action-active text-[color-mix(in_srgb,var(--primary)_54%,var(--muted-foreground))]"
            : "text-[var(--muted-foreground)] hover:text-[var(--primary)]",
        )}
        title="Professor Mari"
        aria-label="Professor Mari"
        aria-pressed={professorMariOpen}
      >
        <img
          src="/sprites/mari/Mari_profile.png"
          alt=""
          className="h-[1.125rem] w-[1.125rem] rounded-md object-cover"
          draggable={false}
        />
        {professorMariOpen && (
          <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500" />
        )}
      </button>
      {showDivider && <span className="mari-chat-title-divider" aria-hidden />}
    </div>
  );
}
