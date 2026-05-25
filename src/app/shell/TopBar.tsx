// ──────────────────────────────────────────────
// Layout: Top Bar (polished, with hover glow)
// ──────────────────────────────────────────────
import { SpotifyMiniPlayer } from "../../features/shell/spotify/shell";
import { ChatTitleControls } from "./ChatTitleControls";
import { PanelNavButtons } from "./PanelNavButtons";

export function TopBar({
  professorMariOpen = false,
  onOpenProfessorMari,
  onGoHome,
}: {
  professorMariOpen?: boolean;
  onOpenProfessorMari?: () => void;
  onGoHome?: () => void;
}) {
  return (
    <header
      data-component="TopBar"
      className="mari-topbar relative z-10 flex h-9 flex-shrink-0 items-center justify-between px-2 md:hidden"
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        <ChatTitleControls
          professorMariOpen={professorMariOpen}
          onOpenProfessorMari={onOpenProfessorMari}
          onGoHome={onGoHome}
          hideProfessorOnNarrow
          showDivider={false}
        />
        <SpotifyMiniPlayer />
      </div>
      <PanelNavButtons className="md:hidden" />
    </header>
  );
}
