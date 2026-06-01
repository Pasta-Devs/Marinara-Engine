import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Camera,
  Eye,
  FileText,
  Heart,
  Image,
  Library,
  MapPin,
  MessageCircle,
  Palette,
  Settings2,
  Swords,
  User,
} from "lucide-react";
import { cn } from "../../../../shared/lib/utils";

const TABS = [
  { id: "metadata", label: "Metadata", icon: User },
  { id: "description", label: "Description", icon: FileText },
  { id: "personality", label: "Personality", icon: Heart },
  { id: "backstory", label: "Backstory", icon: BookOpen },
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "scenario", label: "Scenario", icon: MapPin },
  { id: "dialogue", label: "Dialogue", icon: MessageCircle },
  { id: "sprites", label: "Sprites", icon: Image },
  { id: "gallery", label: "Gallery", icon: Camera },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "stats", label: "Stats", icon: Swords },
  { id: "advanced", label: "Advanced", icon: Settings2 },
  { id: "lorebook", label: "Lorebook", icon: Library },
] as const satisfies Array<{ id: string; label: string; icon: LucideIcon }>;

export type CharacterEditorTabId = (typeof TABS)[number]["id"];

type CharacterEditorTabRailProps = {
  activeTab: CharacterEditorTabId;
  onTabChange: (tab: CharacterEditorTabId) => void;
};

export function CharacterEditorTabRail({ activeTab, onTabChange }: CharacterEditorTabRailProps) {
  return (
    <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-2 @max-5xl:w-full @max-5xl:flex-row @max-5xl:overflow-x-auto @max-5xl:border-r-0 @max-5xl:border-b @max-5xl:p-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all @max-5xl:whitespace-nowrap @max-5xl:px-2.5 @max-5xl:py-1.5",
              activeTab === tab.id
                ? "bg-gradient-to-r from-pink-400/15 to-purple-500/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/20"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon size="0.875rem" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
