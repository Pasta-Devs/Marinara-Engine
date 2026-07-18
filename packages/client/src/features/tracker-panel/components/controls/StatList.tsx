import { X } from "lucide-react";
import {
  isTrackerFieldLocked,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  type CharacterStat,
} from "@marinara-engine/shared";
import { cn } from "../../../../lib/utils";
import { TRACKER_BAR, TRACKER_TEXT_ROW } from "../../lib/tracker-panel.constants";
import type { TrackerStatDensity, TrackerStatDisplayScale } from "../../tracker-panel.types";
import { visibleText } from "../../lib/tracker-display";
import { getStatPercent, getTrackerStatDisplayScale } from "../../lib/tracker-stat-layout";
import { FittedText, InlineAddRow, InlineEdit, InlineNumber } from "./InlineControls";
import { EmptySection } from "./SectionControls";
import { useTrackerLockContext } from "../TrackerLockContext";

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
  nameLocked,
  valueLocked,
  maxLocked,
  lockMode,
  onToggleNameLock,
  onToggleValueLock,
  onToggleMaxLock,
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
  nameLocked?: boolean;
  valueLocked?: boolean;
  maxLocked?: boolean;
  lockMode?: boolean;
  onToggleNameLock?: () => void;
  onToggleValueLock?: () => void;
  onToggleMaxLock?: () => void;
}) {
  const percent = getStatPercent(stat);
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
        isTight ? "py-0" : isCompact ? "py-px" : isRoomy ? "py-1" : "py-0.5",
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
            locked={nameLocked}
            lockMode={lockMode}
            onToggleLock={onToggleNameLock}
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
            <InlineNumber
              value={stat.value}
              onChange={onUpdateValue}
              title="Value"
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
              title="Max"
              className={valueInputClass}
              locked={maxLocked}
              lockMode={lockMode}
              onToggleLock={onToggleMaxLock}
            />
          </div>
        ) : (
          <div className={valueGroupClass} title={`${stat.value} / ${stat.max}`}>
            <span>{stat.value}</span>
            <span className="px-px text-[color:color-mix(in_srgb,var(--tracker-profile-number-text)_58%,transparent)]">
              /
            </span>
            <span>{stat.max}</span>
          </div>
        )}
        {deleteMode && (
          <button
            type="button"
            onClick={onRemove}
            disabled={!onRemove}
            className="flex h-4 w-4 items-center justify-center rounded text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 disabled:opacity-0"
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
          style={{ width: `${percent}%`, backgroundColor: stat.color || "var(--primary)" }}
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
  getLockKey,
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
  getLockKey?: (index: number, field: "name" | "value" | "max", stat: CharacterStat) => string;
}) {
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  if (stats.length === 0) {
    return onAdd && addMode ? (
      <InlineAddRow onClick={onAdd} title="Add stat" className="border-t-0" />
    ) : (
      <EmptySection>No stats tracked.</EmptySection>
    );
  }
  const updateStat = (index: number, updated: CharacterStat) => {
    if (!onUpdate) return;
    const previous = stats[index];
    if (previous && previous.name !== updated.name) {
      const fromKey = getLockKey?.(index, "name", previous);
      const toKey = getLockKey?.(index, "name", updated);
      if (fromKey && toKey) {
        onUpdateFieldLocks?.((locks) =>
          renameTrackerFieldLockPrefix(locks, fromKey.replace(/\.name$/, ""), toKey.replace(/\.name$/, "")),
        );
      }
    }
    const next = [...stats];
    next[index] = updated;
    onUpdate(next);
  };
  const removeStat = (index: number) => {
    if (!onUpdate) return;
    const nameLockKey = getLockKey?.(index, "name", stats[index]!);
    if (nameLockKey)
      onUpdateFieldLocks?.((locks) => removeTrackerFieldLockPrefix(locks, nameLockKey.replace(/\.name$/, "")));
    onUpdate(stats.filter((_, statIndex) => statIndex !== index));
  };
  const buildLockToggle = (index: number, field: "name" | "value" | "max") =>
    getLockKey && onToggleFieldLock ? () => onToggleFieldLock(getLockKey(index, field, stats[index]!)) : undefined;
  const displayScale = getTrackerStatDisplayScale(
    stats.length,
    density,
    fillAvailable || displayRoomy,
    !!(onAdd && addMode),
  );
  const compactNameRhythm =
    nameMode === "truncate" && density === "normal" && stats.some((stat) => getStatNameFitNeed(stat.name) >= 24);
  const shouldFillWideColumns = wideColumns && fillWideColumns && fillAvailable;
  const shouldConnectWideColumns = showWideColumnGhost && wideColumns && stats.length > 1;
  const shouldRenderWideColumnGhost = shouldConnectWideColumns && stats.length % 2 === 1;
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
          shouldConnectWideColumns &&
            "@min-[240px]:gap-0 @min-[240px]:overflow-hidden @min-[240px]:rounded-[5px] @min-[240px]:border @min-[240px]:border-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_34%,transparent)] @min-[240px]:bg-[image:var(--tracker-profile-field-material)] @min-[240px]:shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent),inset_0_-5px_10px_color-mix(in_srgb,var(--background)_22%,transparent)] @min-[240px]:[background-blend-mode:var(--tracker-profile-field-material-blend)] @min-[240px]:[&>*]:rounded-none @min-[240px]:[&>*]:border-0 @min-[240px]:[&>*]:bg-transparent @min-[240px]:[&>*]:shadow-none @min-[240px]:[&>*]:before:hidden @min-[240px]:[&>*]:after:hidden @min-[240px]:[&>*:nth-child(odd)]:border-r @min-[240px]:[&>*:nth-child(odd)]:border-r-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_28%,transparent)] @min-[240px]:[&>*:not(:nth-last-child(-n+2))]:border-b @min-[240px]:[&>*:not(:nth-last-child(-n+2))]:border-b-[color-mix(in_srgb,var(--tracker-profile-dialogue-border)_28%,transparent)]",
        )}
      >
        {stats.map((stat, index) => (
          <StatBar
            key={`${stat.name}-${index}`}
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
            nameLocked={getLockKey ? isTrackerFieldLocked(fieldLocks, getLockKey(index, "name", stat)) : false}
            valueLocked={getLockKey ? isTrackerFieldLocked(fieldLocks, getLockKey(index, "value", stat)) : false}
            maxLocked={getLockKey ? isTrackerFieldLocked(fieldLocks, getLockKey(index, "max", stat)) : false}
            lockMode={lockMode}
            onToggleNameLock={buildLockToggle(index, "name")}
            onToggleValueLock={buildLockToggle(index, "value")}
            onToggleMaxLock={buildLockToggle(index, "max")}
          />
        ))}
        {shouldRenderWideColumnGhost && <StatColumnFiller density={density} />}
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
