// ──────────────────────────────────────────────
// Layout: Right Panel (polished with panel transitions)
// ──────────────────────────────────────────────
import { Activity, Suspense, useRef, useState, type ComponentType, type ReactNode } from "react";
import { X, Users, BookOpen, FileText, Link, Sparkles, Settings, VenetianMask, Bot, Puzzle } from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { usePersonalExtensionContributions } from "../../lib/personal-extension-contributions";
import { PersonalExtensionContributionIcon } from "../extensions/PersonalExtensionContributionIcon";
import { PersonalExtensionContributionSlot } from "../extensions/PersonalExtensionContributionSlot";
import { HelpTooltip } from "../ui/HelpTooltip";
import { RIGHT_PANELS } from "./right-panel-panels";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { usePanelKeyboardFocus } from "./use-panel-keyboard-focus";
import type { PersonalExtensionContributionSurface } from "@marinara-engine/shared";

// Panels load through right-panel-panels so the top bar can preload them on hover.

type PanelConfig = { title: string; icon: ReactNode; gradient?: string; gradientClass?: string; helpKey?: string };

const PANEL_CONFIG: Record<string, PanelConfig> = {
  "bot-browser": {
    title: "Browser",
    icon: <Bot size="0.875rem" />,
    gradient: "from-lime-400 via-green-500 to-cyan-500",
  },
  characters: {
    title: "Characters",
    icon: <Users size="0.875rem" />,
    gradientClass: "mari-panel-gradient-surface mari-panel-gradient--characters",
    helpKey: "navigation.sidebarHelp.characters",
  },
  lorebooks: {
    title: "Lorebooks",
    icon: <BookOpen size="0.875rem" />,
    gradient: "from-amber-400 to-orange-500",
    helpKey: "navigation.sidebarHelp.lorebooks",
  },
  presets: {
    title: "Presets",
    icon: <FileText size="0.875rem" />,
    gradientClass: "mari-panel-gradient-surface mari-panel-gradient--presets",
    helpKey: "navigation.sidebarHelp.presets",
  },
  connections: {
    title: "Connections",
    icon: <Link size="0.875rem" />,
    gradient: "from-sky-400 to-blue-500",
  },
  agents: {
    title: "Agents",
    icon: <Sparkles size="0.875rem" />,
    gradient: "from-violet-400 to-purple-500",
    helpKey: "navigation.sidebarHelp.agents",
  },
  personas: {
    title: "Personas",
    icon: <VenetianMask size="0.875rem" />,
    gradient: "from-emerald-400 to-teal-500",
    helpKey: "navigation.sidebarHelp.personas",
  },
  settings: {
    title: "Settings",
    icon: <Settings size="0.875rem" />,
    gradient: "from-gray-400 to-gray-500",
    helpKey: "navigation.sidebarHelp.settings",
  },
  extensions: { title: "Extensions", icon: <Puzzle size="0.875rem" /> },
};

const PANELS: Record<string, ComponentType> = RIGHT_PANELS;

const PANEL_CONTRIBUTION_SURFACES: Partial<Record<string, Exclude<PersonalExtensionContributionSurface, "top-bar">>> = {
  "bot-browser": "bots",
  characters: "characters",
  personas: "personas",
  lorebooks: "lorebooks",
  presets: "presets",
  connections: "connections",
  agents: "agents",
  settings: "settings",
};

function PanelFallback() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="mari-chrome-text-muted flex h-full items-center justify-center text-sm">
      {localizeUi("ui.characters.characterlibraryview.loading")}
    </div>
  );
}

export function RightPanel() {
  const { t: localizeUi } = useUiTranslation();
  const localize = useLocalizedUiText();
  const panel = useUIStore((s) => s.rightPanel);
  const panelOpen = useUIStore((s) => s.rightPanelOpen);
  const [mountedPanels] = useState(() => new Set<string>());
  const close = useUIStore((s) => s.closeRightPanel);
  const sectionRef = useRef<HTMLElement>(null);
  const { onKeyDown } = usePanelKeyboardFocus({
    open: panelOpen,
    panelKey: panel,
    containerRef: sectionRef,
    toggleSelector: `[data-component="TopBar"] [data-tour="panel-${panel}"]`,
    onClose: close,
  });
  const { contributions, activePanelKey } = usePersonalExtensionContributions();

  // Remember visits only for this mounted panel, not every mobile reopen.
  mountedPanels.add(panel);

  const activeExtensionPanel = contributions.find(
    (contribution) => contribution.key === activePanelKey && contribution.kind === "panel",
  );
  const contributionSurface = PANEL_CONTRIBUTION_SURFACES[panel];
  const config: PanelConfig =
    panel === "extensions" && activeExtensionPanel
      ? {
          title: activeExtensionPanel.label,
          icon: <PersonalExtensionContributionIcon icon={activeExtensionPanel.icon} />,
        }
      : (PANEL_CONFIG[panel] ?? { title: "Panel", icon: null, gradient: "from-slate-400 to-slate-500" });

  return (
    <section
      ref={sectionRef}
      data-component="RightPanel"
      aria-label={localize(config.title)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="mari-right-panel-content mari-chrome-token-scope flex h-full min-h-0 flex-col outline-none"
    >
      {/* Header - OS window style */}
      <div className="mari-right-panel-header relative flex h-12 flex-shrink-0 items-center justify-between px-4">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            data-component="RightPanelHeaderIcon"
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md shadow-sm",
              config.gradientClass ??
                `bg-gradient-to-br ${config.gradient ?? "from-slate-400 to-slate-500"} text-white`,
            )}
          >
            {config.icon}
          </div>
          <h2 className="mari-chrome-text-strong truncate text-sm font-semibold">{localize(config.title)}</h2>
          {config.helpKey && (
            <HelpTooltip
              key={panel}
              text={localizeUi(config.helpKey)}
              ariaLabel={localizeUi("navigation.sidebarHelp.button", { sidebar: localize(config.title) })}
              side="bottom"
              wide
              className="shrink-0 [@media(pointer:coarse)]:-ml-3"
              buttonClassName="justify-center [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
            />
          )}
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          {contributionSurface && (
            <PersonalExtensionContributionSlot surface={contributionSurface} position="header" className="max-w-28" />
          )}
          <button
            onClick={close}
            aria-label={localizeUi("ui.layout.rightpanel.closePanel")}
            className="mari-chrome-control mari-chrome-control--small mari-accent-animated shrink-0 p-1.5 active:scale-90 max-md:h-9 max-md:w-9 [@media(pointer:coarse)]:h-9 [@media(pointer:coarse)]:w-9"
          >
            <X size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Content — keep visited panels mounted but hidden to avoid re-animation */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {Object.entries(PANELS).map(([key, PanelComp]) => {
          if (!mountedPanels.has(key)) return null;
          const active = key === panel && panelOpen;
          const panelContent = (
            <Suspense fallback={active ? <PanelFallback /> : null}>
              <PanelComp />
            </Suspense>
          );
          return (
            <Activity key={key} mode={active ? "visible" : "hidden"}>
              <div
                data-panel-key={key}
                className={cn(
                  "absolute inset-0",
                  key === "characters"
                    ? "flex min-h-0 flex-col overflow-hidden"
                    : "overflow-y-auto [scrollbar-gutter:stable]",
                  !active && "hidden",
                )}
                aria-hidden={!active}
              >
                {active && contributionSurface && (
                  <PersonalExtensionContributionSlot
                    surface={contributionSurface}
                    position="before-content"
                    className="shrink-0 border-b border-[var(--border)]/40"
                  />
                )}
                {key === "characters" ? (
                  <div className="min-h-0 flex-1 overflow-hidden">{panelContent}</div>
                ) : (
                  panelContent
                )}
                {active && contributionSurface && (
                  <PersonalExtensionContributionSlot
                    surface={contributionSurface}
                    position="after-content"
                    className="shrink-0 border-t border-[var(--border)]/40"
                  />
                )}
              </div>
            </Activity>
          );
        })}
      </div>
    </section>
  );
}
