import { FileText, Settings2 } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: Settings2 },
  { id: "entries", label: "Entries", icon: FileText },
] as const;

export type LorebookEditorTabId = (typeof TABS)[number]["id"];

export function LorebookEditorTabs({
  activeTab,
  entriesCount,
  onChange,
}: {
  activeTab: LorebookEditorTabId;
  entriesCount: number;
  onChange: (tab: LorebookEditorTabId) => void;
}) {
  return (
    <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-2 @max-5xl:w-full @max-5xl:flex-row @max-5xl:overflow-x-auto @max-5xl:border-r-0 @max-5xl:border-b @max-5xl:p-1.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all @max-5xl:whitespace-nowrap @max-5xl:px-2.5 @max-5xl:py-1.5",
              activeTab === tab.id
                ? "bg-gradient-to-r from-amber-400/15 to-orange-500/15 text-amber-400 ring-1 ring-amber-400/20"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon size="0.875rem" />
            {tab.label}
            {tab.id === "entries" && (
              <span className="ml-auto rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[0.625rem] @max-5xl:ml-1">
                {entriesCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
