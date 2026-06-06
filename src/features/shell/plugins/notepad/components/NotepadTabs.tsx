import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../../../../shared/lib/utils";
import { labelForTabTarget, tabRowLabel } from "../lib/state";
import type { DropTarget, NoteScope, NotepadContext, NotepadTab } from "../types";

export function NotepadTabs({
  activeTabId,
  context,
  draggedTabId,
  dropTarget,
  groups,
  onDragEnd,
  onDragStart,
  onMoveTab,
  onSelectTab,
  onSetDropTarget,
  onStartRename,
  onToggleCollapsed,
  tabsCollapsed,
  tabCount,
}: {
  activeTabId: string | null;
  context: NotepadContext;
  draggedTabId: string | null;
  dropTarget: DropTarget | null;
  groups: Array<{ scope: NoteScope; tabs: NotepadTab[] }>;
  onDragEnd: () => void;
  onDragStart: (tabId: string) => void;
  onMoveTab: (targetId: string, position?: "before" | "after") => void;
  onSelectTab: (tab: NotepadTab) => void;
  onSetDropTarget: (target: DropTarget | null | ((current: DropTarget | null) => DropTarget | null)) => void;
  onStartRename: (tab: NotepadTab) => void;
  onToggleCollapsed: (collapsed: boolean | ((current: boolean) => boolean)) => void;
  tabsCollapsed: boolean;
  tabCount: number;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 border-b border-[var(--border)] bg-[var(--secondary)]/25 pr-8",
        tabsCollapsed ? "h-8 overflow-hidden px-2 py-1" : "max-h-28 overflow-y-auto px-1.5 py-1.5",
      )}
    >
      <button
        type="button"
        aria-label={tabsCollapsed ? "Show tabs" : "Hide tabs"}
        title={tabsCollapsed ? "Show tabs" : "Hide tabs"}
        onClick={() => onToggleCollapsed((current) => !current)}
        className="me-notes-tabs-toggle"
      >
        {tabsCollapsed ? <Eye size="0.75rem" /> : <EyeOff size="0.75rem" />}
      </button>
      {tabsCollapsed ? (
        <button
          type="button"
          className="h-full w-full text-left text-[0.6875rem] font-semibold text-[var(--muted-foreground)]"
          onClick={() => onToggleCollapsed(false)}
        >
          {tabCount} tab{tabCount === 1 ? "" : "s"}
        </button>
      ) : (
        <div className="grid gap-1">
          {groups.map((group) =>
            group.tabs.length > 0 ? (
              <TabGroup
                key={group.scope}
                activeTabId={activeTabId}
                context={context}
                draggedTabId={draggedTabId}
                dropTarget={dropTarget}
                group={group}
                onDragEnd={onDragEnd}
                onDragStart={onDragStart}
                onMoveTab={onMoveTab}
                onSelectTab={onSelectTab}
                onSetDropTarget={onSetDropTarget}
                onStartRename={onStartRename}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function TabGroup({
  activeTabId,
  context,
  draggedTabId,
  dropTarget,
  group,
  onDragEnd,
  onDragStart,
  onMoveTab,
  onSelectTab,
  onSetDropTarget,
  onStartRename,
}: {
  activeTabId: string | null;
  context: NotepadContext;
  draggedTabId: string | null;
  dropTarget: DropTarget | null;
  group: { scope: NoteScope; tabs: NotepadTab[] };
  onDragEnd: () => void;
  onDragStart: (tabId: string) => void;
  onMoveTab: (targetId: string, position?: "before" | "after") => void;
  onSelectTab: (tab: NotepadTab) => void;
  onSetDropTarget: (target: DropTarget | null | ((current: DropTarget | null) => DropTarget | null)) => void;
  onStartRename: (tab: NotepadTab) => void;
}) {
  return (
    <div className="grid min-h-6 grid-cols-[2rem_minmax(0,1fr)] items-center gap-1">
      <div className="text-center text-[0.5625rem] font-black text-[var(--muted-foreground)]">
        {tabRowLabel(group.scope)}
      </div>
      <div className="flex min-w-0 gap-1 overflow-x-auto">
        {group.tabs.map((tab, index) => (
          <TabButton
            key={tab.id}
            active={tab.id === activeTabId}
            context={context}
            draggedTabId={draggedTabId}
            dropTarget={dropTarget}
            index={index}
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            onMoveTab={onMoveTab}
            onSelectTab={onSelectTab}
            onSetDropTarget={onSetDropTarget}
            onStartRename={onStartRename}
            tab={tab}
          />
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  context,
  draggedTabId,
  dropTarget,
  index,
  onDragEnd,
  onDragStart,
  onMoveTab,
  onSelectTab,
  onSetDropTarget,
  onStartRename,
  tab,
}: {
  active: boolean;
  context: NotepadContext;
  draggedTabId: string | null;
  dropTarget: DropTarget | null;
  index: number;
  onDragEnd: () => void;
  onDragStart: (tabId: string) => void;
  onMoveTab: (targetId: string, position?: "before" | "after") => void;
  onSelectTab: (tab: NotepadTab) => void;
  onSetDropTarget: (target: DropTarget | null | ((current: DropTarget | null) => DropTarget | null)) => void;
  onStartRename: (tab: NotepadTab) => void;
  tab: NotepadTab;
}) {
  const branchSpecific = tab.scope === "chat" && tab.branchMode === "branch" && Boolean(tab.groupId);
  const targetLabel = labelForTabTarget(tab, context);
  const dropBefore = dropTarget?.id === tab.id && dropTarget.position === "before";
  const dropAfter = dropTarget?.id === tab.id && dropTarget.position === "after";

  return (
    <button
      type="button"
      draggable
      data-active={active}
      onDragStart={() => onDragStart(tab.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!draggedTabId || draggedTabId === tab.id) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        onSetDropTarget({
          id: tab.id,
          position: event.clientX < rect.left + rect.width / 2 ? "before" : "after",
        });
      }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          onSetDropTarget((current) => (current?.id === tab.id ? null : current));
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onMoveTab(tab.id, dropTarget?.id === tab.id ? dropTarget.position : "before");
      }}
      onClick={() => onSelectTab(tab)}
      onDoubleClick={(event) => {
        event.preventDefault();
        onStartRename(tab);
      }}
      className={cn(
        "relative inline-flex h-6 max-w-28 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-semibold transition-colors",
        active
          ? "border-[var(--primary)]/60 bg-[var(--primary)]/15 text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--secondary)]/55 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
        branchSpecific && "border-b-[var(--primary)]",
        dropBefore &&
          "before:absolute before:-left-1 before:bottom-1 before:top-1 before:w-0.5 before:rounded-full before:bg-[var(--primary)] before:content-['']",
        dropAfter &&
          "after:absolute after:-right-1 after:bottom-1 after:top-1 after:w-0.5 after:rounded-full after:bg-[var(--primary)] after:content-['']",
      )}
      title={`${tab.title} / saved for ${targetLabel}`}
      aria-label={`${tab.title}, saved for ${targetLabel}, tab ${index + 1}`}
    >
      <span className={cn("min-w-0 truncate", !active && "w-4 text-center")}>{active ? tab.title : index + 1}</span>
      {branchSpecific && active ? (
        <span
          aria-hidden="true"
          className="rounded-full bg-[var(--primary)]/15 px-1 text-[0.5rem] font-black uppercase text-[var(--primary)]"
        >
          br
        </span>
      ) : null}
    </button>
  );
}
