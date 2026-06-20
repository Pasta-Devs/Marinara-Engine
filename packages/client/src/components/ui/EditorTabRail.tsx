import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type EditorTabItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

export function EditorTabRail<T extends string>({
  tabs,
  activeId,
  onChange,
  getBadge,
  className,
}: {
  tabs: readonly EditorTabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  getBadge?: (id: T) => ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label="Editor sections"
      className={cn(
        "mari-editor-tab-rail flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 @max-5xl:w-full @max-5xl:flex-row @max-5xl:overflow-x-auto @max-5xl:border-b @max-5xl:border-r-0 @max-5xl:p-1.5",
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeId === tab.id;
        const badge = getBadge?.(tab.id);
        const hasBadge = badge !== null && badge !== undefined && badge !== false;
        return (
          <button
            type="button"
            aria-current={active ? "page" : undefined}
            data-active={active ? "true" : undefined}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="mari-editor-tab flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all @max-5xl:whitespace-nowrap @max-5xl:px-2.5 @max-5xl:py-1.5"
          >
            <Icon size="0.875rem" className="shrink-0" />
            <span>{tab.label}</span>
            {hasBadge && <span className="mari-editor-tab-badge @max-5xl:ml-1">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
