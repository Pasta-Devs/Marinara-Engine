// ──────────────────────────────────────────────
// Mobile shell actions shared between app shell and mode surfaces
// ──────────────────────────────────────────────
import { Bot, BookOpen, FileText, Link, Settings, Sparkles, User, Users } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";

interface TopBarActionsContextValue {
  rightSlot: ReactNode;
  setRightSlot: (slot: ReactNode) => void;
}

const TopBarActionsContext = createContext<TopBarActionsContextValue>({
  rightSlot: null,
  setRightSlot: () => {},
});

export function TopBarActionsProvider({ children }: { children: ReactNode }) {
  const [rightSlot, setRightSlot] = useState<ReactNode>(null);
  return (
    <TopBarActionsContext.Provider value={{ rightSlot, setRightSlot }}>
      {children}
    </TopBarActionsContext.Provider>
  );
}

export function useTopBarActions() {
  return useContext(TopBarActionsContext);
}

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

export type MobileToolsPanel = typeof TOOLS_PANELS[number]["panel"];
