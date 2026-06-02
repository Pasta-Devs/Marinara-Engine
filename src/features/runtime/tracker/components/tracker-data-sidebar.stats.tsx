import { X } from "lucide-react";
import type { CharacterStat } from "../../../../engine/contracts/types/game-state";
import { cn } from "../../../../shared/lib/utils";
import { TRACKER_BAR, TRACKER_TEXT_ROW } from "./tracker-data-sidebar.constants";
import type { TrackerStatDensity, TrackerStatDisplayScale } from "./tracker-data-sidebar.constants";
import { visibleText } from "./tracker-display.helpers";
import { getTrackerStatDisplayScale } from "./tracker-stat-layout";
import { getTrackerStatPercent } from "../../world-state/index";
import { EmptySection, FittedText, InlineAddRow, InlineEdit, InlineNumber } from "./tracker-data-sidebar.controls";
import "./TrackerProfileStats.css";

type StatListVisualTone = "plain" | "instrument";

function getStatNameFitNeed(name: string | null | undefined) {
  const text = visibleText(name, "Stat").replace(/\s+/g, " ");
  const longestWord = text.split(" ").reduce((longest, word) => Math.max(longest, word.length), 0);
  return text.length + longestWord * 0.55;
}

function StatBarGhost({
  density = "normal",
  visualTone = "plain",
  wideColumnCell = false,
}: {
  density?: TrackerStatDensity;
  visualTone?: StatListVisualTone;
  wideColumnCell?: boolean;
}) {
  const isTight = density === "tight";
  const isInstrument = visualTone === "instrument";
  const ghostTrackClass = isInstrument ? "tracker-stat-track--ghost-instrument" : "tracker-stat-track--ghost-plain";

  return (
    <div
      aria-hidden="true"
      className={cn("tracker-stat-ghost-card", wideColumnCell ? "px-1" : "px-1.5", isTight ? "px-1 py-0.5" : "py-1")}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-x-1">
        <span className="tracker-stat-ghost-name" />
        <span className="tracker-stat-ghost-number" />
      </div>
      <div className={cn(ghostTrackClass, isTight ? "h-[2px] rounded-[1px]" : "h-[4px] rounded-[2px]")}>
        <div className="tracker-stat-ghost-fill" />
      </div>
    </div>
  );
}

function StatBar({
  stat,
  onUpdateName,
  onUpdateValue,
  onUpdateMax,
  onRemove,
  deleteMode = false,
  nameMode = "full",
  density = "normal",
  fillAvailable = false,
  displayRoomy = false,
  displayScale = "standard",
  compactNameRhythm = false,
  wideColumnCell = false,
  visualTone = "plain",
}: {
  stat: CharacterStat;
  onUpdateName?: (name: string) => void;
  onUpdateValue?: (value: number) => void;
  onUpdateMax?: (value: number) => void;
  onRemove?: () => void;
  deleteMode?: boolean;
  nameMode?: "full" | "scroll" | "truncate";
  density?: TrackerStatDensity;
  fillAvailable?: boolean;
  displayRoomy?: boolean;
  displayScale?: TrackerStatDisplayScale;
  compactNameRhythm?: boolean;
  wideColumnCell?: boolean;
  visualTone?: StatListVisualTone;
}) {
  const percent = getTrackerStatPercent(stat);
  const isCompact = density === "compact";
  const isTight = density === "tight";
  const isCondensed = isCompact || isTight;
  const isInstrument = visualTone === "instrument";
  const isRoomy = (fillAvailable || displayRoomy) && density === "normal" && displayScale !== "standard";
  const isSpacious = isRoomy && displayScale === "spacious";
  const rowTextClass = isTight
    ? "text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "text-[0.625rem] leading-3"
      : isSpacious
        ? "text-[0.8125rem] leading-4"
        : isRoomy
          ? "text-[0.75rem] leading-4"
          : TRACKER_TEXT_ROW;
  const inlineEditClass = isTight
    ? "h-[0.6875rem] text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "h-3 text-[0.625rem] leading-3"
      : isSpacious
        ? "h-4 text-[0.8125rem] leading-4"
        : isRoomy
          ? "h-4 text-[0.75rem] leading-4"
          : cn("h-[0.875rem]", TRACKER_TEXT_ROW);
  const compactNameClass = isTight
    ? "text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "text-[0.625rem] leading-3"
      : isSpacious
        ? TRACKER_TEXT_ROW
        : isRoomy
          ? "text-[0.625rem] leading-3"
          : "text-[0.625rem] leading-3";
  const nameTextClass = compactNameRhythm ? compactNameClass : rowTextClass;
  const nameInlineEditClass = compactNameRhythm ? cn(inlineEditClass, compactNameClass) : inlineEditClass;
  const numberClass = isTight
    ? "text-[0.5625rem] leading-[0.6875rem]"
    : isCompact
      ? "text-[0.625rem] leading-3"
      : isSpacious
        ? "text-[0.6875rem] leading-[0.875rem]"
        : isRoomy
          ? "text-[0.625rem] leading-3"
          : "text-[0.625rem] leading-3";
  const barClass = isInstrument
    ? isTight
      ? "h-[2px] rounded-[1px]"
      : "h-[4px] rounded-[2px]"
    : isTight
      ? "h-px rounded-[1px]"
      : isCompact
        ? fillAvailable
          ? "h-[3px] rounded-[1px]"
          : "h-[2px] rounded-[1px]"
        : isSpacious
          ? "h-2 rounded"
          : isRoomy
            ? "h-1.5 rounded-[3px]"
            : TRACKER_BAR;
  const rowColumns =
    deleteMode && nameMode === "full"
      ? "grid-cols-[max-content_max-content_1rem]"
      : deleteMode
        ? "grid-cols-[minmax(0,1fr)_max-content_1rem]"
        : nameMode === "full"
          ? "grid-cols-[max-content_max-content]"
          : "grid-cols-[minmax(0,1fr)_max-content]";
  const valueGroupClass = cn(
    "flex shrink-0 items-baseline justify-end gap-0 whitespace-nowrap tabular-nums text-[color:var(--tracker-profile-number-text)]",
    isInstrument && "tracker-stat-value-group--instrument",
    numberClass,
  );
  const valueInputClass = cn("min-w-0 px-0 py-0 text-right tabular-nums", numberClass);
  const statBarContainerClass = isInstrument
    ? cn("tracker-stat-row--instrument", wideColumnCell ? "px-1" : "px-1.5", isTight ? "px-1 py-0.5" : "py-1")
    : cn(
        "border-b border-[var(--tracker-profile-row-rule)] last:border-b-0",
        isTight ? "py-0" : isCompact ? "py-px" : isRoomy ? "py-1" : "py-0.5",
      );
  const statTrackClass = isInstrument ? "tracker-stat-track--instrument" : "tracker-stat-track--plain";
  const statFillClass = cn(
    "tracker-stat-fill",
    isInstrument ? "tracker-stat-fill--instrument" : "tracker-stat-fill--plain",
  );

  return (
    <div
      className={cn(statBarContainerClass, fillAvailable && "flex min-h-0 flex-col justify-center", isRoomy && "gap-1")}
    >
      <div className={cn("grid items-center", isInstrument ? "gap-x-1" : "gap-x-0.5", rowTextClass, rowColumns)}>
        {onUpdateName ? (
          <InlineEdit
            value={stat.name}
            onSave={onUpdateName}
            placeholder="Stat"
            title={visibleText(stat.name, "Stat")}
            className={cn(
              nameInlineEditClass,
              "font-medium",
              isInstrument ? "rounded-[2px] px-0.5 text-[color:var(--tracker-profile-text)]" : "px-0",
              nameMode !== "full" && "w-full",
            )}
            fullPreview={nameMode === "full"}
            scrollOnHover={nameMode === "scroll"}
            fitPreview={nameMode === "truncate"}
            fitMinScale={0.56}
            editHintMode="overlay"
          />
        ) : nameMode === "truncate" ? (
          <FittedText
            className={cn("w-full font-medium text-[color:var(--tracker-profile-text)]", nameTextClass)}
            title={visibleText(stat.name, "Stat")}
            minScale={0.56}
          >
            {visibleText(stat.name, "Stat")}
          </FittedText>
        ) : (
          <span
            className={cn(
              "font-medium text-[color:var(--tracker-profile-text)]",
              nameTextClass,
              nameMode === "full" ? "whitespace-nowrap" : "min-w-0 truncate",
            )}
            title={visibleText(stat.name, "Stat")}
          >
            {visibleText(stat.name, "Stat")}
          </span>
        )}
        {onUpdateValue && onUpdateMax ? (
          <div className={valueGroupClass}>
            <InlineNumber value={stat.value} onChange={onUpdateValue} title="Value" className={valueInputClass} />
            <span className="tracker-stat-value-separator">/</span>
            <InlineNumber value={stat.max} onChange={onUpdateMax} min={0} title="Max" className={valueInputClass} />
          </div>
        ) : (
          <div className={valueGroupClass} title={`${stat.value} / ${stat.max}`}>
            <span>{stat.value}</span>
            <span className="tracker-stat-value-separator">/</span>
            <span>{stat.max}</span>
          </div>
        )}
        {deleteMode && (
          <button
            type="button"
            onClick={onRemove}
            disabled={!onRemove}
            className="tracker-stat-remove-button"
            title={`Remove ${visibleText(stat.name, "stat")}`}
            aria-label={`Remove ${visibleText(stat.name, "stat")}`}
          >
            <X size={isCondensed ? "0.6rem" : "0.65rem"} />
          </button>
        )}
      </div>
      <div className={cn(statTrackClass, isInstrument ? "mt-0.5" : isRoomy ? "mt-0.5" : "mt-0", barClass)}>
        <div
          className={statFillClass}
          style={{ transform: `scaleX(${percent / 100})`, backgroundColor: stat.color || "var(--primary)" }}
        />
      </div>
    </div>
  );
}

export function StatList({
  stats,
  onUpdate,
  editableName = true,
  nameMode = "full",
  deleteMode = false,
  addMode = false,
  onAdd,
  density = "normal",
  fillAvailable = false,
  displayRoomy = false,
  wideColumns = false,
  fillWideColumns = false,
  showWideColumnGhost = false,
  visualTone = "plain",
}: {
  stats: CharacterStat[];
  onUpdate?: (stats: CharacterStat[]) => void;
  editableName?: boolean;
  nameMode?: "full" | "scroll" | "truncate";
  deleteMode?: boolean;
  addMode?: boolean;
  onAdd?: () => void;
  density?: TrackerStatDensity;
  fillAvailable?: boolean;
  displayRoomy?: boolean;
  wideColumns?: boolean;
  fillWideColumns?: boolean;
  showWideColumnGhost?: boolean;
  visualTone?: StatListVisualTone;
}) {
  if (stats.length === 0) {
    return onAdd && addMode ? (
      <InlineAddRow onClick={onAdd} title="Add stat" className="border-t-0" />
    ) : (
      <EmptySection>No stats tracked.</EmptySection>
    );
  }
  const updateStat = (index: number, updated: CharacterStat) => {
    if (!onUpdate) return;
    const next = [...stats];
    next[index] = updated;
    onUpdate(next);
  };
  const removeStat = (index: number) => {
    if (!onUpdate) return;
    onUpdate(stats.filter((_, statIndex) => statIndex !== index));
  };
  const displayScale = getTrackerStatDisplayScale(
    stats.length,
    density,
    fillAvailable || displayRoomy,
    !!(onAdd && addMode),
  );
  const compactNameRhythm =
    nameMode === "truncate" && density === "normal" && stats.some((stat) => getStatNameFitNeed(stat.name) >= 24);
  const shouldFillWideColumns = wideColumns && fillWideColumns && fillAvailable;
  const shouldRenderWideColumnGhost = showWideColumnGhost && wideColumns && stats.length > 1 && stats.length % 2 === 1;
  const wideColumnCell = wideColumns && stats.length > 1;

  return (
    <div
      className={cn(
        fillAvailable && "flex h-full min-h-0 flex-col",
        wideColumns && !shouldFillWideColumns && "@min-[240px]:block @min-[240px]:h-auto",
      )}
    >
      <div
        className={cn(
          "grid",
          fillAvailable && "min-h-0 flex-1 auto-rows-fr",
          visualTone === "instrument" && "gap-y-1",
          wideColumns &&
            stats.length > 1 &&
            cn(
              "@min-[240px]:grid-cols-2 @min-[240px]:gap-x-1.5 @min-[240px]:gap-y-1",
              shouldFillWideColumns
                ? "@min-[240px]:auto-rows-fr @min-[240px]:flex-1"
                : "@min-[240px]:auto-rows-min @min-[240px]:content-start @min-[240px]:flex-none",
            ),
        )}
      >
        {stats.map((stat, index) => (
          <StatBar
            key={stat.statId || `${stat.name}-${index}`}
            stat={stat}
            onUpdateName={onUpdate && editableName ? (name) => updateStat(index, { ...stat, name }) : undefined}
            onUpdateValue={onUpdate ? (value) => updateStat(index, { ...stat, value }) : undefined}
            onUpdateMax={onUpdate ? (max) => updateStat(index, { ...stat, max }) : undefined}
            onRemove={onUpdate ? () => removeStat(index) : undefined}
            deleteMode={deleteMode}
            nameMode={nameMode}
            density={density}
            fillAvailable={fillAvailable}
            displayRoomy={displayRoomy}
            displayScale={displayScale}
            compactNameRhythm={compactNameRhythm}
            wideColumnCell={wideColumnCell}
            visualTone={visualTone}
          />
        ))}
        {shouldRenderWideColumnGhost && (
          <StatBarGhost density={density} visualTone={visualTone} wideColumnCell={wideColumnCell} />
        )}
      </div>
      {onAdd && addMode && (
        <InlineAddRow
          onClick={onAdd}
          title="Add stat"
          className={cn(
            fillAvailable && "shrink-0",
            density === "tight"
              ? "min-h-3 py-0 text-[0.5625rem] leading-[0.6875rem]"
              : density === "compact"
                ? "min-h-4 py-px text-[0.625rem] leading-3"
                : undefined,
          )}
        />
      )}
    </div>
  );
}
