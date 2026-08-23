// ──────────────────────────────────────────────
// Layout: Right Panel (polished with panel transitions)
// ──────────────────────────────────────────────
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import {
  X,
  Users,
  BookOpen,
  FileText,
  Link,
  Sparkles,
  Settings,
  VenetianMask,
  Bot,
  Puzzle,
  BookMarked,
} from "lucide-react";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { usePersonalExtensionContributions } from "../../lib/personal-extension-contributions";
import { PersonalExtensionContributionIcon } from "../extensions/PersonalExtensionContributionIcon";
import { PersonalExtensionContributionSlot } from "../extensions/PersonalExtensionContributionSlot";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { PersonalExtensionContributionSurface } from "@marinara-engine/shared";

const CharactersPanel = lazy(() =>
  import("../panels/CharactersPanel").then((module) => ({ default: module.CharactersPanel })),
);
const LorebooksPanel = lazy(() =>
  import("../panels/LorebooksPanel").then((module) => ({ default: module.LorebooksPanel })),
);
const PresetsPanel = lazy(() => import("../panels/PresetsPanel").then((module) => ({ default: module.PresetsPanel })));
const ConnectionsPanel = lazy(() =>
  import("../panels/ConnectionsPanel").then((module) => ({ default: module.ConnectionsPanel })),
);
const AgentsPanel = lazy(() => import("../panels/AgentsPanel").then((module) => ({ default: module.AgentsPanel })));
const PersonasPanel = lazy(() =>
  import("../panels/PersonasPanel").then((module) => ({ default: module.PersonasPanel })),
);
const SettingsPanel = lazy(() =>
  import("../panels/SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);
const BotBrowserPanel = lazy(() =>
  import("../panels/BotBrowserPanel").then((module) => ({ default: module.BotBrowserPanel })),
);
const PersonalExtensionPanel = lazy(() =>
  import("../panels/PersonalExtensionPanel").then((module) => ({ default: module.PersonalExtensionPanel })),
);
const StoryBundlesPanel = lazy(() =>
  import("../panels/StoryBundlesPanel").then((module) => ({ default: module.StoryBundlesPanel })),
);

const PANEL_CONFIG: Record<string, { title: string; icon: ReactNode; gradient?: string; gradientClass?: string }> = {
  "bot-browser": {
    title: "Browser",
    icon: <Bot size="0.875rem" />,
    gradient: "from-lime-400 via-green-500 to-cyan-500",
  },
  characters: {
    title: "Characters",
    icon: <Users size="0.875rem" />,
    gradientClass: "mari-panel-gradient-surface mari-panel-gradient--characters",
  },
  lorebooks: { title: "Lorebooks", icon: <BookOpen size="0.875rem" />, gradient: "from-amber-400 to-orange-500" },
  presets: {
    title: "Presets",
    icon: <FileText size="0.875rem" />,
    gradientClass: "mari-panel-gradient-surface mari-panel-gradient--presets",
  },
  connections: { title: "Connections", icon: <Link size="0.875rem" />, gradient: "from-sky-400 to-blue-500" },
  agents: { title: "Agents", icon: <Sparkles size="0.875rem" />, gradient: "from-violet-400 to-purple-500" },
  personas: {
    title: "Personas",
    icon: <VenetianMask size="0.875rem" />,
    gradient: "from-emerald-400 to-teal-500",
  },
  "story-bundles": {
    title: "Story Bundles",
    icon: <BookMarked size="0.875rem" />,
    gradientClass: "mari-panel-gradient-surface mari-panel-gradient--story-bundles",
  },
  settings: { title: "Settings", icon: <Settings size="0.875rem" />, gradient: "from-gray-400 to-gray-500" },
  extensions: { title: "Extensions", icon: <Puzzle size="0.875rem" /> },
};

const PANELS: Record<string, LazyExoticComponent<ComponentType>> = {
  "bot-browser": BotBrowserPanel,
  characters: CharactersPanel,
  lorebooks: LorebooksPanel,
  presets: PresetsPanel,
  connections: ConnectionsPanel,
  agents: AgentsPanel,
  personas: PersonasPanel,
  "story-bundles": StoryBundlesPanel,
  settings: SettingsPanel,
  extensions: PersonalExtensionPanel,
};

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

// Module-level set survives component remounts (e.g. mobile AnimatePresence unmount/remount)
const mountedPanels = new Set<string>();

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
  const panel = useUIStore((s) => s.rightPanel);
  const close = useUIStore((s) => s.closeRightPanel);
  const { contributions, activePanelKey } = usePersonalExtensionContributions();

  // Add synchronously so the current panel is in the set for this render.
  // Module-level Set is not React state, so mutating it during render is safe.
  mountedPanels.add(panel);

  const activeExtensionPanel = contributions.find(
    (contribution) => contribution.key === activePanelKey && contribution.kind === "panel",
  );
  const contributionSurface = PANEL_CONTRIBUTION_SURFACES[panel];
  const config: { title: string; icon: ReactNode; gradient?: string; gradientClass?: string } =
    panel === "extensions" && activeExtensionPanel
      ? {
          title: activeExtensionPanel.label,
          icon: <PersonalExtensionContributionIcon icon={activeExtensionPanel.icon} />,
        }
      : (PANEL_CONFIG[panel] ?? { title: "Panel", icon: null, gradient: "from-slate-400 to-slate-500" });

  return (
    <section
      data-component="RightPanel"
      aria-label={config.title}
      className="mari-right-panel-content mari-chrome-token-scope flex h-full min-h-0 flex-col"
    >
      {/* Header - OS window style */}
      <div className="mari-right-panel-header relative flex h-12 flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-4 backdrop-blur-sm">
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
          <h2 className="mari-chrome-text-strong truncate text-sm font-semibold">{config.title}</h2>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          {contributionSurface && (
            <PersonalExtensionContributionSlot surface={contributionSurface} position="header" className="max-w-28" />
          )}
          <button
            onClick={close}
            aria-label={localizeUi("ui.layout.rightpanel.closePanel")}
            className="mari-chrome-control mari-chrome-control--small mari-accent-animated shrink-0 p-1.5 active:scale-90"
          >
            <X size="0.875rem" />
          </button>
        </div>
      </div>

      {/* Content — keep visited panels mounted but hidden to avoid re-animation */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {Object.entries(PANELS).map(([key, PanelComp]) => {
          if (!mountedPanels.has(key)) return null;
          const active = key === panel;
          const panelContent = (
            <Suspense fallback={active ? <PanelFallback /> : null}>
              <PanelComp />
            </Suspense>
          );
          return (
            <div
              key={key}
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
          );
        })}
      </div>
    </section>
  );
}
