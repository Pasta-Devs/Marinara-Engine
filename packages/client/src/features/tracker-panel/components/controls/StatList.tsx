import { X } from "lucide-react";
import {
  isTrackerFieldLocked,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  type CharacterStat,
  type SupportedStatIcon,
} from "@marinara-engine/shared";
import { cn } from "../../../../lib/utils";
import { getStatNameOccurrence } from "../../../../lib/stat-icon-assignments";
import { TRACKER_BAR, TRACKER_TEXT_ROW } from "../../lib/tracker-panel.constants";
import type { TrackerStatDisplayMode } from "../../../../stores/ui.store";
import type { TrackerStatDensity } from "../../tracker-panel.types";
import { visibleText } from "../../lib/tracker-display";
import { getStatPercent, shouldRenderStatGauges } from "../../lib/tracker-stat-layout";
import { InlineAddRow, InlineEdit, InlineNumber } from "./InlineControls";
import { EmptySection } from "./SectionControls";
import { StatGauge } from "./StatGauge";
import { useTrackerLockContext } from "../TrackerLockContext";
import { Fragment } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

type StatListVisualTone = "plain" | "instrument";

function getStatNameFitNeed(name: string | null | undefined) {
  const text = visibleText(name, "Stat").replace(/\s+/g, " ");
  const longestWord = text.split(" ").reduce((longest, word) => Math.max(longest, word.length), 0);
  return text.length + longestWord * 0.55;
}

function StatColumnFiller({ density = "normal" }: { density?: TrackerStatDensity }) {
  const isTight = density === "tight";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative hidden select-none overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_24%,transparent)] bg-[image:var(--tracker-profile-field-material)] opacity-70 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_3%,transparent),inset_0_-4px_8px_color-mix(in_srgb,var(--background)_20%,transparent)] [background-blend-mode:var(--tracker-profile-field-material-blend)] before:pointer-events-none before:absolute before:inset-x-1 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--tracker-profile-dialogue-border)_28%,transparent),transparent)] before:content-[''] @min-[240px]:block",
        isTight ? "px-1 py-0.5" : "py-1",
      )}
    >
      <div className={cn("flex items-center justify-evenly", isTight ? "h-3" : "h-[1.375rem]")}>
        {[0, 1, 2, 3].map((diamond) => (
          <span
            key={diamond}
            className={cn(
              "block rotate-45 border border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_36%,transparent)] bg-[color-mix(in_srgb,var(--tracker-profile-text)_2%,transparent)] shadow-[inset_0_0_4px_color-mix(in_srgb,var(--background)_34%,transparent)]",
              isTight ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function GaugeOrnamentRail({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative hidden min-w-0 items-center justify-center @min-[320px]:flex",
        compact ? "px-2 @min-[320px]:w-14 @min-[320px]:flex-none" : "flex-1 px-3",
      )}
    >
      <span className="h-6 w-6 rotate-45 border border-[color-mix(in_srgb,var(--tracker-profile-rule)_30%,transparent)]" />
    </div>
  );
}

function GaugeDivider({ ornamentEdge = false }: { ornamentEdge?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative z-[2] my-2 w-px shrink-0 self-stretch bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--tracker-profile-rule)_30%,transparent)_18%,color-mix(in_srgb,var(--tracker-profile-rule)_30%,transparent)_82%,transparent)]",
        ornamentEdge && "hidden @min-[320px]:block",
      )}
    />
  );
}

function StatBar({
  stat,
  onUpdateName,
  onUpdateValue,
  onUpdateMax,
  onRemove,
  deleteMode = false,
  density = "normal",
  compactNameRhythm = false,
  wideColumnCell = false,
  visualTone = "plain",
  nameLocked,
  valueLocked,
  maxLocked,
  lockMode,
  onToggleNameLock,
  onToggleValueLock,
  onToggleMaxLock,
}: {
  stat: CharacterStat;
  onUpdateName: (name: string) => void;
  onUpdateValue: (value: number) => void;
  onUpdateMax: (value: number) => void;
  onRemove: () => void;
  deleteMode?: boolean;
  density?: TrackerStatDensity;
  compactNameRhythm?: boolean;
  wideColumnCell?: boolean;
  visualTone?: StatListVisualTone;
  nameLocked?: boolean;
  valueLocked?: boolean;
  maxLocked?: boolean;
  lockMode?: boolean;
  onToggleNameLock?: () => void;
  onToggleValueLock?: () => void;
  onToggleMaxLock?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const percent = getStatPercent(stat);
  const isCompact = density === "compact";
  const isTight = density === "tight";
  const isCondensed = isCompact || isTight;
  const isInstrument = visualTone === "instrument";
  const rowTextClass = isTight
    ? "text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "text-[0.625rem] leading-3"
      : TRACKER_TEXT_ROW;
  const inlineEditClass = isTight
    ? "h-[0.6875rem] text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "h-3 text-[0.625rem] leading-3"
      : cn("h-[0.875rem]", TRACKER_TEXT_ROW);
  const compactNameClass = isTight
    ? "text-[0.5625rem] leading-[0.6875rem]"
    : "text-[0.625rem] leading-3";
  const nameInlineEditClass = compactNameRhythm ? cn(inlineEditClass, compactNameClass) : inlineEditClass;
  const numberClass = isTight ? "text-[0.5625rem] leading-[0.6875rem]" : "text-[0.625rem] leading-3";
  const barClass = isInstrument
    ? isTight
      ? "h-[2px] rounded-[1px]"
      : "h-[4px] rounded-[2px]"
    : isTight
      ? "h-px rounded-[1px]"
      : isCompact
        ? "h-[2px] rounded-[1px]"
        : TRACKER_BAR;
  const rowColumns = deleteMode
    ? "grid-cols-[minmax(0,1fr)_max-content_1rem]"
    : "grid-cols-[minmax(0,1fr)_max-content]";
  const valueGroupClass = cn(
    "flex shrink-0 items-baseline justify-end gap-0 whitespace-nowrap tabular-nums text-[color:var(--tracker-profile-number-text)]",
    isInstrument && "text-[color:color-mix(in_srgb,var(--tracker-profile-number-text)_90%,var(--foreground)_10%)]",
    numberClass,
  );
  const valueInputClass = cn("min-w-0 px-0 py-0 text-right tabular-nums", numberClass);
  const statBarContainerClass = isInstrument
    ? cn(
        "relative isolate overflow-hidden rounded-[4px] border border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent)] bg-[image:var(--tracker-profile-field-material)] text-[color:var(--tracker-profile-text)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),inset_0_-5px_10px_color-mix(in_srgb,var(--background)_22%,transparent)] transition-colors [background-blend-mode:var(--tracker-profile-field-material-blend)] before:pointer-events-none before:absolute before:inset-x-1 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--tracker-profile-dialogue-border)_48%,transparent)_48%,transparent)] before:opacity-70 before:content-[''] after:pointer-events-none after:absolute after:bottom-px after:right-1 after:h-px after:w-[40%] after:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--tracker-profile-accent-solid)_32%,transparent)_48%,transparent)] after:opacity-[var(--tracker-profile-accent-highlight-opacity,0.28)] after:[mask-image:linear-gradient(90deg,transparent_0%,black_22%,black_86%,transparent_100%)] after:content-[''] hover:border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_44%,transparent)]",
        wideColumnCell ? "px-1" : "px-1.5",
        isTight ? "px-1 py-0.5" : "py-1",
      )
    : cn(
        "border-b border-[var(--tracker-profile-row-rule)] last:border-b-0",
        isTight ? "py-0" : isCompact ? "py-px" : "py-0.5",
      );
  const statTrackClass = isInstrument
    ? "relative isolate shrink-0 overflow-hidden bg-transparent ring-1 ring-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent)] shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--background)_46%,transparent)]"
    : "relative isolate shrink-0 overflow-hidden bg-[image:var(--tracker-profile-stat-track)] ring-1 ring-[var(--tracker-profile-stat-track-ring)] shadow-[inset_0_1px_2px_var(--tracker-profile-stat-track-shadow)] [background-blend-mode:var(--tracker-profile-stat-track-blend)]";
  const statFillClass = cn(
    "h-full rounded-[inherit] bg-[var(--primary)] transition-[width] duration-200",
    isInstrument
      ? "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_28%,transparent),0_0_6px_color-mix(in_srgb,var(--primary)_34%,transparent)]"
      : "shadow-[inset_0_1px_0_var(--tracker-profile-stat-fill-highlight),0_0_7px_var(--tracker-profile-stat-fill-glow)]",
  );

  return (
    <div className={statBarContainerClass}>
      <div className={cn("grid items-center", isInstrument ? "gap-x-1" : "gap-x-0.5", rowTextClass, rowColumns)}>
        <InlineEdit
          value={stat.name}
          onSave={onUpdateName}
          placeholder={localizeUi("ui.trackerPanel.statbar.stat")}
          title={visibleText(stat.name, "Stat")}
          className={cn(
            nameInlineEditClass,
            "w-full font-medium",
            isInstrument ? "rounded-[2px] px-0.5 text-[color:var(--tracker-profile-text)]" : "px-0",
          )}
          fitPreview
          fitMinScale={0.56}
          locked={nameLocked}
          lockMode={lockMode}
          onToggleLock={onToggleNameLock}
        />
        <div className={valueGroupClass}>
          <InlineNumber
            value={stat.value}
            onChange={onUpdateValue}
            title={localizeUi("ui.trackerPanel.charactertrackercard.value")}
            className={valueInputClass}
            locked={valueLocked}
            lockMode={lockMode}
            onToggleLock={onToggleValueLock}
          />
          <span className="px-px text-[color:color-mix(in_srgb,var(--tracker-profile-number-text)_58%,transparent)]">
            /
          </span>
          <InlineNumber
            value={stat.max}
            onChange={onUpdateMax}
            min={0}
            title={localizeUi("ui.agents.regexscripteditor.max")}
            className={valueInputClass}
            locked={maxLocked}
            lockMode={lockMode}
            onToggleLock={onToggleMaxLock}
          />
        </div>
        {deleteMode && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
            title={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: visibleText(stat.name, "stat") })}
            aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: visibleText(stat.name, "stat") })}
          >
            <X size={isCondensed ? "0.6rem" : "0.65rem"} />
          </button>
        )}
      </div>
      <div className={cn(statTrackClass, isInstrument ? "mt-0.5" : "mt-0", barClass)}>
        <div
          className={statFillClass}
          style={{ width: `${percent}%`, backgroundColor: stat.color || "var(--primary)" }}
        />
      </div>
    </div>
  );
}

export function StatList({
  stats,
  onUpdate,
  deleteMode = false,
  addMode = false,
  onAdd,
  density = "normal",
  visualTone = "plain",
  displayMode,
  resolveIcon,
  onSetIcon,
  onRemapIcons,
  getLockKey,
}: {
  stats: CharacterStat[];
  onUpdate: (stats: CharacterStat[]) => void;
  deleteMode?: boolean;
  addMode?: boolean;
  onAdd: () => void;
  density?: TrackerStatDensity;
  visualTone?: StatListVisualTone;
  displayMode: TrackerStatDisplayMode;
  resolveIcon: (
    stat: CharacterStat,
    occurrence: number,
  ) => { value: SupportedStatIcon | null | undefined; displayIcon: SupportedStatIcon | null };
  onSetIcon: (
    stat: CharacterStat,
    occurrence: number,
    icon: SupportedStatIcon | null | undefined,
  ) => void;
  onRemapIcons: (
    previousStats: CharacterStat[],
    nextStats: CharacterStat[],
    previousIndexForNext: (nextIndex: number) => number | undefined,
  ) => void;
  getLockKey: (index: number, field: "name" | "value" | "max", stat?: CharacterStat) => string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  if (stats.length === 0) {
    return addMode ? (
      <InlineAddRow onClick={onAdd} title={localizeUi("ui.trackerPanel.statlist.addStat")} className="border-t-0" />
    ) : (
      <EmptySection>{localizeUi("ui.trackerPanel.statlist.noStatsTracked")}</EmptySection>
    );
  }
  const updateStat = (index: number, updated: CharacterStat) => {
    const previous = stats[index];
    if (previous && previous.name !== updated.name) {
      const fromKey = getLockKey(index, "name", previous);
      const toKey = getLockKey(index, "name", updated);
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(locks, fromKey.replace(/\.name$/, ""), toKey.replace(/\.name$/, "")),
      );
    }
    const next = [...stats];
    next[index] = updated;
    if (previous && previous.name !== updated.name) {
      onRemapIcons(stats, next, (nextIndex) => nextIndex);
    }
    onUpdate(next);
  };
  const removeStat = (index: number) => {
    const nameLockKey = getLockKey(index, "name", stats[index]!);
    onUpdateFieldLocks?.((locks) => {
      let nextLocks = removeTrackerFieldLockPrefix(locks, nameLockKey.replace(/\.name$/, ""));
      for (let oldIndex = index + 1; oldIndex < stats.length; oldIndex += 1) {
        const fromPrefix = getLockKey(oldIndex, "name").replace(/\.name$/, "");
        const toPrefix = getLockKey(oldIndex - 1, "name").replace(/\.name$/, "");
        nextLocks = renameTrackerFieldLockPrefix(nextLocks, fromPrefix, toPrefix);
      }
      return nextLocks;
    });
    const next = stats.filter((_, statIndex) => statIndex !== index);
    onRemapIcons(stats, next, (nextIndex) => (nextIndex < index ? nextIndex : nextIndex + 1));
    onUpdate(next);
  };
  const buildLockToggle = (index: number, field: "name" | "value" | "max") =>
    onToggleFieldLock ? () => onToggleFieldLock(getLockKey(index, field, stats[index]!)) : undefined;
  const renderGauges = shouldRenderStatGauges(displayMode, addMode, deleteMode, lockMode);
  if (renderGauges) {
    const gaugeSize = stats.length <= 4 ? "large" : stats.length <= 6 ? "medium" : "compact";
    const showGaugeOrnaments = stats.length <= 2;
    return (
      <div
        className="@container scrollbar-hide relative isolate flex w-full min-w-0 snap-x snap-mandatory overflow-x-auto rounded-[0.5rem] border border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_42%,transparent)] bg-[image:var(--tracker-profile-field-material)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_6%,transparent),inset_0_-10px_18px_color-mix(in_srgb,var(--background)_30%,transparent)] [background-blend-mode:var(--tracker-profile-field-material-blend)] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--tracker-profile-dialogue-border)_58%,transparent),transparent)] before:opacity-80 before:content-['']"
        role="list"
      >
        {showGaugeOrnaments && (
          <>
            <GaugeOrnamentRail compact={stats.length === 2} />
            <GaugeDivider ornamentEdge />
          </>
        )}
        {stats.map((stat, index) => {
          const occurrence = getStatNameOccurrence(stats, index);
          const resolvedIcon = resolveIcon(stat, occurrence);
          return (
            <Fragment key={`${stat.name}-${index}`}>
              <StatGauge
                stat={stat}
                iconValue={resolvedIcon.value}
                icon={resolvedIcon.displayIcon}
                onSelectIcon={(icon) => onSetIcon(stat, occurrence, icon)}
                onUpdate={(updatedStat) => updateStat(index, updatedStat)}
                size={gaugeSize}
                nameLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "name", stat))}
                valueLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "value", stat))}
                maxLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "max", stat))}
              />
              {(index < stats.length - 1 || showGaugeOrnaments) && (
                <GaugeDivider ornamentEdge={showGaugeOrnaments && index === stats.length - 1} />
              )}
            </Fragment>
          );
        })}
        {showGaugeOrnaments && <GaugeOrnamentRail compact={stats.length === 2} />}
      </div>
    );
  }
  const compactNameRhythm =
    density === "normal" && stats.some((stat) => getStatNameFitNeed(stat.name) >= 24);
  const useWideColumns = visualTone === "instrument" && stats.length > 1;
  const shouldRenderWideColumnGhost = useWideColumns && stats.length % 2 === 1;

  return (
    <div className={useWideColumns ? "@min-[240px]:block @min-[240px]:h-auto" : undefined}>
      <div
        className={cn(
          "grid",
          visualTone === "instrument" && "gap-y-1",
          useWideColumns &&
            "@min-[240px]:grid-cols-2 @min-[240px]:gap-x-1.5 @min-[240px]:gap-y-1 @min-[240px]:auto-rows-min @min-[240px]:content-start @min-[240px]:flex-none",
          useWideColumns &&
            "@min-[240px]:gap-0 @min-[240px]:overflow-hidden @min-[240px]:rounded-[5px] @min-[240px]:border @min-[240px]:border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent)] @min-[240px]:bg-[image:var(--tracker-profile-field-material)] @min-[240px]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),inset_0_-5px_10px_color-mix(in_srgb,var(--background)_22%,transparent)] @min-[240px]:[background-blend-mode:var(--tracker-profile-field-material-blend)] @min-[240px]:[&>*]:rounded-none @min-[240px]:[&>*]:border-0 @min-[240px]:[&>*]:bg-transparent @min-[240px]:[&>*]:shadow-none @min-[240px]:[&>*]:before:hidden @min-[240px]:[&>*]:after:hidden @min-[240px]:[&>*:nth-child(odd)]:border-r @min-[240px]:[&>*:nth-child(odd)]:border-r-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_28%,transparent)] @min-[240px]:[&>*:not(:nth-last-child(-n+2))]:border-b @min-[240px]:[&>*:not(:nth-last-child(-n+2))]:border-b-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_28%,transparent)]",
        )}
      >
        {stats.map((stat, index) => (
          <StatBar
            key={`${stat.name}-${index}`}
            stat={stat}
            onUpdateName={(name) => updateStat(index, { ...stat, name })}
            onUpdateValue={(value) => updateStat(index, { ...stat, value })}
            onUpdateMax={(max) => updateStat(index, { ...stat, max })}
            onRemove={() => removeStat(index)}
            deleteMode={deleteMode}
            density={density}
            compactNameRhythm={compactNameRhythm}
            wideColumnCell={useWideColumns}
            visualTone={visualTone}
            nameLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "name", stat))}
            valueLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "value", stat))}
            maxLocked={isTrackerFieldLocked(fieldLocks, getLockKey(index, "max", stat))}
            lockMode={lockMode}
            onToggleNameLock={buildLockToggle(index, "name")}
            onToggleValueLock={buildLockToggle(index, "value")}
            onToggleMaxLock={buildLockToggle(index, "max")}
          />
        ))}
        {shouldRenderWideColumnGhost && <StatColumnFiller density={density} />}
      </div>
      {addMode && (
        <InlineAddRow
          onClick={onAdd}
          title={localizeUi("ui.trackerPanel.statlist.addStat")}
          className={
            density === "tight"
              ? "min-h-3 py-0 text-[0.5625rem] leading-[0.6875rem]"
              : density === "compact"
                ? "min-h-4 py-px text-[0.625rem] leading-3"
                : undefined
          }
        />
      )}
    </div>
  );
}
