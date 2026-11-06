// The fight screen's own controls in the top bar while a fight on a board is up: which round it is,
// and the two toggles that hide the log under the board and the combat pane beside it. The board
// takes whatever room either leaves. Chat Settings opens from here too, since the fight puts its
// bubble away (laptop playtest 2026-10-24: a connection that failed mid-fight could not be changed).
import { PanelRight, ScrollText, Settings2, Swords } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCombatScreenStore } from "../../stores/combat-screen.store";
import { CHAT_SETTINGS_WINDOW_ID, useFloatingWindowStore } from "../../stores/floating-window.store";
import { announceChatToolbarAction } from "../chat/ChatToolbarControls";
import { cn } from "../../lib/utils";

const TOGGLE =
  "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]";

export function CombatTopbarControls() {
  const { t } = useTranslation();
  const round = useCombatScreenStore((state) => state.round);
  const logOpen = useCombatScreenStore((state) => state.logOpen);
  const paneOpen = useCombatScreenStore((state) => state.paneOpen);
  const toggleLog = useCombatScreenStore((state) => state.toggleLog);
  const togglePane = useCombatScreenStore((state) => state.togglePane);
  // The same window the Chat Settings bubble opens, while the open chat hosts it.
  const settingsHosted = useFloatingWindowStore((state) => (state.hosts[CHAT_SETTINGS_WINDOW_ID] ?? 0) > 0);
  const settingsOpen = useFloatingWindowStore((state) => state.open[CHAT_SETTINGS_WINDOW_ID] === true);
  if (round === null) return null;
  const toggleSettings = (button: HTMLButtonElement) => {
    announceChatToolbarAction("settings");
    const windows = useFloatingWindowStore.getState();
    if (windows.open[CHAT_SETTINGS_WINDOW_ID]) windows.dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
    else windows.openWindow(CHAT_SETTINGS_WINDOW_ID, button);
  };
  return (
    <div data-component="TopBar.CombatControls" className="flex min-w-0 shrink-0 items-center gap-1">
      <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 text-xs font-semibold text-[var(--foreground)] max-sm:hidden">
        <Swords aria-hidden="true" className="h-3.5 w-3.5 text-[var(--primary)]" />
        {t("game.combat.ruleset.screen.topbarRound", { round })}
      </span>
      <button
        type="button"
        aria-pressed={logOpen}
        onClick={toggleLog}
        className={cn(
          TOGGLE,
          logOpen
            ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.06]",
        )}
      >
        <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
        {t("game.combat.ruleset.screen.topbarLog")}
      </button>
      <button
        type="button"
        aria-pressed={paneOpen}
        aria-label={t("game.combat.ruleset.screen.topbarPane")}
        title={t("game.combat.ruleset.screen.topbarPane")}
        onClick={togglePane}
        className={cn(
          TOGGLE,
          // A phone shows the pane as a tab of its own, so the toggle is for wider screens only.
          "max-md:hidden",
          paneOpen
            ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.06]",
        )}
      >
        <PanelRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {settingsHosted && (
        <button
          type="button"
          aria-expanded={settingsOpen}
          aria-label={t("chat.toolbar.settings")}
          title={t("chat.toolbar.settings")}
          data-window-opener={CHAT_SETTINGS_WINDOW_ID}
          data-chat-toolbar-panel-action="settings"
          onClick={(event) => toggleSettings(event.currentTarget)}
          className={cn(
            TOGGLE,
            settingsOpen
              ? "bg-[var(--primary)]/15 text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--foreground)]/[0.06]",
          )}
        >
          <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
