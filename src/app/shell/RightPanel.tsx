// ──────────────────────────────────────────────
// Layout: Right Panel (polished with panel transitions)
// ──────────────────────────────────────────────
import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { X, Users, BookOpen, FileText, Link, Sparkles, Settings, User, Bot } from "lucide-react";
import { useUIStore } from "../../shared/stores/ui.store";

const CharactersPanel = lazy(() =>
  import("../../features/catalog/characters/shell").then((module) => ({ default: module.CharactersPanel })),
);
const LorebooksPanel = lazy(() =>
  import("../../features/catalog/lorebooks/shell").then((module) => ({ default: module.LorebooksPanel })),
);
const PresetsPanel = lazy(() =>
  import("../../features/catalog/presets/shell").then((module) => ({ default: module.PresetsPanel })),
);
const ConnectionsPanel = lazy(() =>
  import("../../features/shell/connections/shell").then((module) => ({ default: module.ConnectionsPanel })),
);
const AgentsPanel = lazy(() =>
  import("../../features/catalog/agents/shell").then((module) => ({ default: module.AgentsPanel })),
);
const PersonasPanel = lazy(() =>
  import("../../features/catalog/personas/shell").then((module) => ({ default: module.PersonasPanel })),
);
const SettingsPanel = lazy(() =>
  import("../../features/shell/settings/shell").then((module) => ({ default: module.SettingsPanel })),
);
const BotBrowserPanel = lazy(() =>
  import("../../features/shell/bot-browser/shell").then((module) => ({ default: module.BotBrowserPanel })),
);

const PANEL_CONFIG: Record<string, { title: string; icon: ReactNode; gradient: string }> = {
  "bot-browser": { title: "Browser", icon: <Bot size="0.875rem" />, gradient: "from-cyan-400 to-blue-500" },
  characters: { title: "Characters", icon: <Users size="0.875rem" />, gradient: "from-pink-400 to-rose-500" },
  lorebooks: { title: "Lorebooks", icon: <BookOpen size="0.875rem" />, gradient: "from-amber-400 to-orange-500" },
  presets: { title: "Presets", icon: <FileText size="0.875rem" />, gradient: "from-purple-400 to-violet-500" },
  connections: { title: "Connections", icon: <Link size="0.875rem" />, gradient: "from-sky-400 to-blue-500" },
  agents: { title: "Agents", icon: <Sparkles size="0.875rem" />, gradient: "from-pink-300 to-purple-400" },
  personas: { title: "Personas", icon: <User size="0.875rem" />, gradient: "from-emerald-400 to-teal-500" },
  settings: { title: "Settings", icon: <Settings size="0.875rem" />, gradient: "from-gray-400 to-gray-500" },
};

const PANELS: Record<string, LazyExoticComponent<ComponentType>> = {
  "bot-browser": BotBrowserPanel,
  characters: CharactersPanel,
  lorebooks: LorebooksPanel,
  presets: PresetsPanel,
  connections: ConnectionsPanel,
  agents: AgentsPanel,
  personas: PersonasPanel,
  settings: SettingsPanel,
};

function PanelFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">Loading...</div>
  );
}

export function RightPanel() {
  const panel = useUIStore((s) => s.rightPanel);
  const close = useUIStore((s) => s.closeRightPanel);

  const config = PANEL_CONFIG[panel] ?? { title: "Panel", icon: null, gradient: "from-slate-400 to-slate-500" };
  const ActivePanel = PANELS[panel];

  return (
    <section
      data-component="RightPanel"
      aria-label={config.title}
      className="mari-right-panel-content flex h-full flex-col"
    >
      {/* Header - OS window style */}
      <div className="mari-right-panel-header relative flex h-12 flex-shrink-0 items-center justify-between bg-[var(--card)]/80 px-4 backdrop-blur-sm">
        <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}
          >
            {config.icon}
          </div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{config.title}</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={`Close ${config.title}`}
          className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--primary)] active:scale-90 max-md:min-h-11 max-md:min-w-11"
        >
          <X size="0.875rem" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {ActivePanel ? (
          <Suspense fallback={<PanelFallback />}>
            <ActivePanel />
          </Suspense>
        ) : null}
      </div>
    </section>
  );
}
