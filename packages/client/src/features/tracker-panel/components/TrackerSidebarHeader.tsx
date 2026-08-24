import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import {
  BarChart3,
  ExternalLink,
  EyeOff,
  Gauge,
  Lock,
  PanelLeft,
  PanelRight,
  Plus,
  Settings2,
  Trash2,
  Unlock,
} from "lucide-react";
import { TrackerPanelIcon } from "../../../components/ui/TrackerPanelIcon";
import { TrackerSizeTierIcon } from "../../../components/ui/TrackerSizeTierIcon";
import type { TrackerPanelSide, TrackerPanelSizeProfile, TrackerStatDisplayMode } from "../../../stores/ui.store";
import { cn } from "../../../lib/utils";
import type { TrackerEditMode } from "../tracker-panel.types";
import { useTranslation as useUiTranslation } from "react-i18next";

const TRACKER_PANEL_SIZE_SEQUENCE: TrackerPanelSizeProfile[] = ["compact", "standard", "expanded"];
const TRACKER_PANEL_SIZE_LABELS: Record<TrackerPanelSizeProfile, string> = {
  compact: "Compact",
  standard: "Standard",
  expanded: "Expanded",
};
const TRACKER_TOOLBAR_ITEM_ORDER = ["detach", "side", "size", "statDisplay", "hide", "lock", "add", "delete"] as const;
type TrackerToolbarItem = (typeof TRACKER_TOOLBAR_ITEM_ORDER)[number];

const isToolbarButton = (target: EventTarget | null): target is HTMLButtonElement =>
  typeof target === "object" && target !== null && "localName" in target && target.localName === "button";

export function TrackerSidebarHeader({
  trackerPanelSide,
  sizeProfile,
  statDisplayMode,
  detached,
  activeEditMode,
  onSetEditMode,
  onSetSide,
  onSetSizeProfile,
  onSetStatDisplayMode,
  onToggleDetached,
  onClose,
}: {
  trackerPanelSide: TrackerPanelSide;
  sizeProfile: TrackerPanelSizeProfile;
  statDisplayMode: TrackerStatDisplayMode;
  detached: boolean;
  activeEditMode: TrackerEditMode | null;
  onSetEditMode: (mode: TrackerEditMode | null) => void;
  onSetSide: (side: TrackerPanelSide) => void;
  onSetSizeProfile: (profile: TrackerPanelSizeProfile) => void;
  onSetStatDisplayMode: (mode: TrackerStatDisplayMode) => void;
  onToggleDetached?: () => void;
  onClose: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolbarFocusIndex, setToolbarFocusIndex] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const addMode = activeEditMode === "add";
  const deleteMode = activeEditMode === "delete";
  const hideMode = activeEditMode === "hide";
  const lockMode = activeEditMode === "lock";
  const resolvedToolbarFocusIndex =
    !onToggleDetached && toolbarFocusIndex === TRACKER_TOOLBAR_ITEM_ORDER.indexOf("detach")
      ? TRACKER_TOOLBAR_ITEM_ORDER.indexOf("side")
      : toolbarFocusIndex;
  const sizeIndex = Math.max(0, TRACKER_PANEL_SIZE_SEQUENCE.indexOf(sizeProfile));
  const nextSizeProfile = TRACKER_PANEL_SIZE_SEQUENCE[(sizeIndex + 1) % TRACKER_PANEL_SIZE_SEQUENCE.length]!;
  const sizeLabel = TRACKER_PANEL_SIZE_LABELS[sizeProfile];
  const nextSizeLabel = TRACKER_PANEL_SIZE_LABELS[nextSizeProfile];
  const sizeTitle = `Tracker panel size: ${sizeLabel}. Click for ${nextSizeLabel}.`;
  const gaugesSelected = statDisplayMode === "gauges";
  const statDisplayTitle = localizeUi(
    gaugesSelected
      ? "ui.trackerPanel.trackersidebarheader.showRegularStatBars"
      : "ui.trackerPanel.trackersidebarheader.showRadialStatGauges",
  );
  const closePanelButton = (
    <button
      type="button"
      onClick={onClose}
      title={localizeUi("ui.trackerPanel.trackersidebarheader.closeTrackers")}
      aria-label={localizeUi("ui.trackerPanel.trackersidebarheader.closeTrackerPanel")}
      className="mari-accent-animated flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[var(--marinara-app-accent-solid)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--marinara-app-accent-solid)] active:scale-90"
    >
      <TrackerPanelIcon size="1.25rem" />
    </button>
  );
  const closeSettings = () => {
    setSettingsOpen(false);
    onSetEditMode(null);
  };

  const getToolbarItems = () =>
    TRACKER_TOOLBAR_ITEM_ORDER.flatMap((_, index) => {
      const element = toolbarRef.current?.querySelector<HTMLButtonElement>(`[data-tracker-toolbar-item="${index}"]`);
      return element ? [{ element, index }] : [];
    });

  const getToolbarItemProps = (item: TrackerToolbarItem) => {
    const index = TRACKER_TOOLBAR_ITEM_ORDER.indexOf(item);
    return {
      "data-tracker-toolbar-item": index,
      tabIndex: resolvedToolbarFocusIndex === index ? 0 : -1,
    };
  };

  const handleToolbarFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!isToolbarButton(target)) return;
    const indexAttribute = target.getAttribute("data-tracker-toolbar-item");
    if (indexAttribute === null) return;
    const index = Number(indexAttribute);
    if (!Number.isInteger(index) || index < 0 || index >= TRACKER_TOOLBAR_ITEM_ORDER.length) return;
    setToolbarFocusIndex(index);
  };

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!isToolbarButton(target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
      settingsButtonRef.current?.focus();
      return;
    }

    const toolbarItems = getToolbarItems();
    const focusedPosition = toolbarItems.findIndex(({ element }) => element === target);
    if (focusedPosition < 0) return;

    let nextPosition: number | undefined;
    if (event.key === "ArrowRight") nextPosition = (focusedPosition + 1) % toolbarItems.length;
    else if (event.key === "ArrowLeft")
      nextPosition = (focusedPosition - 1 + toolbarItems.length) % toolbarItems.length;
    else if (event.key === "Home") nextPosition = 0;
    else if (event.key === "End") nextPosition = toolbarItems.length - 1;

    if (nextPosition === undefined) return;
    event.preventDefault();
    const nextItem = toolbarItems[nextPosition];
    if (!nextItem) return;
    setToolbarFocusIndex(nextItem.index);
    nextItem.element.focus();
  };

  const settingsButton = (
    <button
      ref={settingsButtonRef}
      type="button"
      onClick={() => {
        if (settingsOpen) closeSettings();
        else setSettingsOpen(true);
      }}
      title={
        settingsOpen
          ? localizeUi("ui.trackerPanel.trackersidebarheader.closeTrackerSettings")
          : localizeUi("ui.trackerPanel.trackersidebarheader.openTrackerSettings")
      }
      aria-label={
        settingsOpen
          ? localizeUi("ui.trackerPanel.trackersidebarheader.closeTrackerSettings")
          : localizeUi("ui.trackerPanel.trackersidebarheader.openTrackerSettings")
      }
      aria-expanded={settingsOpen}
      aria-controls="tracker-panel-settings-controls"
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[var(--muted-foreground)] ring-1 transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-[var(--primary)] active:scale-90",
        settingsOpen
          ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
          : "ring-transparent",
      )}
    >
      <Settings2 size="0.8rem" />
    </button>
  );

  const outerHeaderControls = (
    <div className="flex w-full flex-wrap items-center justify-center gap-1 @min-[220px]:justify-between @min-[220px]:gap-2">
      <div
        role="group"
        aria-label={localizeUi("ui.trackerPanel.trackersidebarheader.trackerDisplaySettings")}
        className="flex items-center gap-0.5 rounded-md bg-[var(--background)]/30 p-0.5 ring-1 ring-[var(--border)]/45 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)]"
      >
        {onToggleDetached ? (
          <button
            {...getToolbarItemProps("detach")}
            type="button"
            onClick={onToggleDetached}
            title={localizeUi(
              detached
                ? "ui.trackerPanel.trackersidebarheader.dockTrackerPanel"
                : "ui.trackerPanel.trackersidebarheader.detachTrackerPanel",
            )}
            aria-label={localizeUi(
              detached
                ? "ui.trackerPanel.trackersidebarheader.dockTrackerPanel"
                : "ui.trackerPanel.trackersidebarheader.detachTrackerPanel",
            )}
            aria-pressed={detached}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm ring-1 transition-all focus-visible:outline-none focus-visible:ring-[var(--primary)] active:scale-90",
              detached
                ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
                : "text-[var(--muted-foreground)]/62 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--foreground)] hover:ring-[var(--border)]",
            )}
          >
            <ExternalLink size="0.8rem" />
          </button>
        ) : null}
        <button
          {...getToolbarItemProps("side")}
          type="button"
          onClick={() => onSetSide(trackerPanelSide === "left" ? "right" : "left")}
          title={localizeUi("ui.trackerPanel.trackersidebarheader.panelAnchoredValue1ClickToAnchorValue2", {
            value1: trackerPanelSide,
            value2:
              trackerPanelSide === "left"
                ? localizeUi("ui.trackerPanel.trackersidebarheader.right")
                : localizeUi("ui.trackerPanel.trackersidebarheader.left"),
          })}
          aria-label={localizeUi("ui.trackerPanel.trackersidebarheader.trackerPanelAnchoredValue1ClickToAnchorValue2", {
            value1: trackerPanelSide,
            value2:
              trackerPanelSide === "left"
                ? localizeUi("ui.trackerPanel.trackersidebarheader.right")
                : localizeUi("ui.trackerPanel.trackersidebarheader.left"),
          })}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-transparent text-[var(--muted-foreground)]/62 ring-1 ring-transparent transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] hover:ring-[var(--border)] focus-visible:outline-none focus-visible:ring-[var(--primary)] active:scale-90"
        >
          {trackerPanelSide === "left" ? <PanelLeft size="0.8rem" /> : <PanelRight size="0.8rem" />}
        </button>
        <button
          {...getToolbarItemProps("size")}
          type="button"
          onClick={() => onSetSizeProfile(nextSizeProfile)}
          title={sizeTitle}
          aria-label={sizeTitle}
          className="flex h-6 w-6 items-center justify-center rounded-sm text-[var(--muted-foreground)]/62 ring-1 ring-transparent transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)] hover:ring-[var(--border)] active:scale-90"
        >
          <TrackerSizeTierIcon sizeProfile={sizeProfile} />
        </button>
        <button
          {...getToolbarItemProps("statDisplay")}
          type="button"
          onClick={() => onSetStatDisplayMode(gaugesSelected ? "bars" : "gauges")}
          title={statDisplayTitle}
          aria-label={statDisplayTitle}
          className="relative grid h-6 w-[2.875rem] grid-cols-2 items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--background)]/30 p-0.5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--foreground)]/20 hover:bg-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
        >
          <span
            className={cn(
              "absolute inset-y-0.5 w-[1.25rem] rounded-full bg-[var(--foreground)]/12 ring-1 ring-[var(--foreground)]/20 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              gaugesSelected ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
          <BarChart3
            size="0.7rem"
            className={cn("relative z-10 mx-auto", !gaugesSelected && "text-[var(--foreground)]")}
          />
          <Gauge size="0.75rem" className={cn("relative z-10 mx-auto", gaugesSelected && "text-[var(--foreground)]")} />
        </button>
      </div>
      <div
        role="group"
        aria-label={localizeUi("ui.trackerPanel.trackersidebarheader.trackerEditingModes")}
        className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-md bg-[var(--background)]/30 p-0.5 ring-1 ring-[var(--border)]/45 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)]"
      >
        <button
          {...getToolbarItemProps("hide")}
          type="button"
          onClick={() => onSetEditMode(hideMode ? null : "hide")}
          title={
            hideMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitHideMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterHideMode")
          }
          aria-label={
            hideMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitTrackerHideMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterTrackerHideMode")
          }
          aria-pressed={hideMode}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
            hideMode
              ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
              : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
          )}
        >
          <EyeOff size="0.75rem" />
        </button>
        <button
          {...getToolbarItemProps("lock")}
          type="button"
          onClick={() => onSetEditMode(lockMode ? null : "lock")}
          title={
            lockMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitLockMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterLockMode")
          }
          aria-label={
            lockMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitTrackerLockMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterTrackerLockMode")
          }
          aria-pressed={lockMode}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
            lockMode
              ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
              : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
          )}
        >
          {lockMode ? <Lock size="0.75rem" /> : <Unlock size="0.75rem" />}
        </button>
        <button
          {...getToolbarItemProps("add")}
          type="button"
          onClick={() => onSetEditMode(addMode ? null : "add")}
          title={
            addMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitAddMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterAddMode")
          }
          aria-label={
            addMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitTrackerAddMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterTrackerAddMode")
          }
          aria-pressed={addMode}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
            addMode
              ? "bg-[var(--foreground)]/12 text-[var(--foreground)] ring-[var(--foreground)]/24"
              : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
          )}
        >
          <Plus size="0.875rem" />
        </button>
        <button
          {...getToolbarItemProps("delete")}
          type="button"
          onClick={() => onSetEditMode(deleteMode ? null : "delete")}
          title={
            deleteMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitDeleteMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterDeleteMode")
          }
          aria-label={
            deleteMode
              ? localizeUi("ui.trackerPanel.trackersidebarheader.exitTrackerDeleteMode")
              : localizeUi("ui.trackerPanel.trackersidebarheader.enterTrackerDeleteMode")
          }
          aria-pressed={deleteMode}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-sm transition-all ring-1 active:scale-90",
            deleteMode
              ? "bg-[var(--destructive)]/15 text-[var(--destructive)] ring-[var(--destructive)]/45"
              : "text-[var(--muted-foreground)]/55 ring-transparent hover:bg-[var(--accent)] hover:text-[var(--muted-foreground)] hover:ring-[var(--border)]",
          )}
        >
          <Trash2 size="0.75rem" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="sticky top-0 z-30 flex-shrink-0 bg-[color-mix(in_srgb,var(--card)_28%,var(--background)_72%)] shadow-[0_1px_0_color-mix(in_srgb,var(--border)_36%,transparent),0_8px_14px_color-mix(in_srgb,var(--background)_22%,transparent)] backdrop-blur-sm">
      <div className="relative flex h-7 items-center justify-between gap-1 px-1">
        {trackerPanelSide === "left" ? settingsButton : closePanelButton}
        <div className="min-w-0 flex-1" />
        {trackerPanelSide === "left" ? closePanelButton : settingsButton}
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          settingsOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={toolbarRef}
            id="tracker-panel-settings-controls"
            role="toolbar"
            aria-label={localizeUi("ui.trackerPanel.trackersidebarheader.trackerPanelSettings")}
            aria-orientation="horizontal"
            aria-hidden={!settingsOpen}
            inert={!settingsOpen}
            onFocusCapture={handleToolbarFocus}
            onKeyDown={handleToolbarKeyDown}
            className="flex items-center justify-center border-y border-[var(--border)]/30 bg-[color-mix(in_srgb,var(--card)_82%,var(--background)_18%)] px-2 py-1.5 shadow-lg"
          >
            {outerHeaderControls}
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]/30" />
    </div>
  );
}
