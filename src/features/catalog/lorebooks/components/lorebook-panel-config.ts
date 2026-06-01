import { BookOpen, Gamepad2, Globe, Layers, UserRound, Users, Wand2, Zap, type LucideIcon } from "lucide-react";
import type { LorebookCategory } from "../../../../engine/contracts/types/lorebook";

export type LorebookPanelCategory = LorebookCategory | "all" | "active";

export const LOREBOOK_PANEL_CATEGORIES: Array<{
  id: LorebookPanelCategory;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "all", label: "All", icon: Layers },
  { id: "active", label: "Active", icon: Zap },
  { id: "world", label: "World", icon: Globe },
  { id: "character", label: "Character", icon: Users },
  { id: "npc", label: "NPC", icon: UserRound },
  { id: "spellbook", label: "Spellbook", icon: Wand2 },
  { id: "game", label: "Game", icon: Gamepad2 },
  { id: "uncategorized", label: "Other", icon: BookOpen },
];

export const LOREBOOK_CATEGORY_COLORS: Record<string, string> = {
  world: "from-emerald-400 to-teal-500",
  character: "from-violet-400 to-purple-500",
  npc: "from-rose-400 to-pink-500",
  spellbook: "from-blue-400 to-indigo-500",
  game: "from-cyan-400 to-sky-500",
  uncategorized: "from-amber-400 to-orange-500",
  all: "from-amber-400 to-orange-500",
};
