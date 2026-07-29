import type { CharacterStat, SupportedStatIcon } from "@marinara-engine/shared";
import { StatIconPicker } from "../../../../components/ui/StatIconPicker";
import { cn } from "../../../../lib/utils";
import { visibleText } from "../../lib/tracker-display";
import { getStatPercent } from "../../lib/tracker-stat-layout";
import { InlineEdit, InlineNumber } from "./InlineControls";
import { useEffect, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";

type StatGaugeSize = "large" | "medium" | "compact";

// The progress arc sits between two hairline bezel rims, leaving a calm center for
// the icon and label. Each gauge is a segment of one shared rail, not its own card.
const GAUGE_ARC_RADIUS = 43.625;
const GAUGE_ARC_STROKE = 3.5;
const GAUGE_TRACK_STROKE = 1.875;
const GAUGE_RIM_STROKE = 1.1;
const GAUGE_OUTER_RIM_RADIUS = 48.25;
const GAUGE_INNER_RIM_RADIUS = 40;
const LOW_STATE_THRESHOLD = 45;
const CRITICAL_STATE_THRESHOLD = 15;
const MAX_LOW_STATE_TINT = 24;
const GAUGE_RIM_COLOR =
  "color-mix(in srgb, color-mix(in srgb, var(--tracker-profile-dialogue-border) 76%, var(--tracker-profile-number-text) 24%) 55%, transparent)";

const GAUGE_SEGMENT_CLASS =
  "flex min-w-[4.25rem] flex-1 snap-start flex-col items-center justify-center px-1 py-1 @min-[380px]:min-w-[4.75rem] @min-[380px]:py-1.5";

const GAUGE_SIZE_CLASS = {
  large:
    "h-[4.5rem] w-[4.5rem] @min-[380px]:h-[5.75rem] @min-[380px]:w-[5.75rem] @min-[520px]:h-28 @min-[520px]:w-28",
  medium: "h-16 w-16 @min-[380px]:h-[4.5rem] @min-[380px]:w-[4.5rem]",
  compact: "h-14 w-14 @min-[380px]:h-16 @min-[380px]:w-16",
} satisfies Record<StatGaugeSize, string>;

const GAUGE_ICON_CLASS = {
  large:
    "text-[0.875rem] @min-[380px]:text-[1.0625rem] @min-[520px]:text-xl",
  medium: "text-[0.6875rem] @min-[380px]:text-[0.8125rem]",
  compact: "text-[0.625rem] @min-[380px]:text-[0.6875rem]",
} satisfies Record<StatGaugeSize, string>;

const GAUGE_NAME_CLASS = {
  large:
    "text-[0.625rem] leading-3 @min-[380px]:text-[0.6875rem] @min-[380px]:leading-[0.875rem] @min-[520px]:text-xs @min-[520px]:leading-4",
  medium: "text-[0.5rem] leading-[0.625rem] @min-[380px]:text-[0.5625rem] @min-[380px]:leading-[0.6875rem]",
  compact: "text-[0.4375rem] leading-[0.5625rem] @min-[380px]:text-[0.5rem] @min-[380px]:leading-[0.625rem]",
} satisfies Record<StatGaugeSize, string>;

const GAUGE_NUMBER_CLASS = {
  large:
    "text-[0.5625rem] leading-[0.6875rem] @min-[380px]:text-[0.625rem] @min-[380px]:leading-3 @min-[520px]:text-[0.6875rem] @min-[520px]:leading-[0.875rem]",
  medium: "text-[0.4375rem] leading-[0.5625rem] @min-[380px]:text-[0.5rem] @min-[380px]:leading-[0.625rem]",
  compact: "text-[0.4375rem] leading-[0.5625rem]",
} satisfies Record<StatGaugeSize, string>;

export function StatGauge({
  stat,
  iconValue,
  icon,
  onSelectIcon,
  onUpdate,
  size,
  nameLocked,
  valueLocked,
  maxLocked,
}: {
  stat: CharacterStat;
  iconValue?: SupportedStatIcon | null;
  icon?: SupportedStatIcon | null;
  onSelectIcon: (icon: SupportedStatIcon | null | undefined) => void;
  onUpdate: (stat: CharacterStat) => void;
  size: StatGaugeSize;
  nameLocked?: boolean;
  valueLocked?: boolean;
  maxLocked?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const percent = getStatPercent(stat);
  const renderedPercent = Math.min(percent, 99);
  const lowStateSeverity = Math.max(0, (LOW_STATE_THRESHOLD - percent) / LOW_STATE_THRESHOLD);
  const lowStateTint = MAX_LOW_STATE_TINT * lowStateSeverity ** 0.8;
  const isCritical = percent < CRITICAL_STATE_THRESHOLD;
  const displayedPercent = Math.round(percent);
  const statStroke = stat.color || "var(--primary)";
  const name = visibleText(stat.name, "Stat");
  const numberClass = GAUGE_NUMBER_CLASS[size];
  const [editingValues, setEditingValues] = useState(false);
  const valueEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingValues) return;
    valueEditorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [editingValues]);

  return (
    <div className={GAUGE_SEGMENT_CLASS} role="listitem">
      <div className={cn("relative shrink-0", GAUGE_SIZE_CLASS[size])}>
        <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full -rotate-90 overflow-visible">
          <circle
            cx="50"
            cy="50"
            r={GAUGE_OUTER_RIM_RADIUS}
            fill="none"
            stroke={GAUGE_RIM_COLOR}
            strokeWidth={GAUGE_RIM_STROKE}
          />
          <circle
            cx="50"
            cy="50"
            r={GAUGE_INNER_RIM_RADIUS - GAUGE_RIM_STROKE / 2}
            fill={`color-mix(in srgb, var(--destructive) ${lowStateTint}%, transparent)`}
          />
          <circle
            cx="50"
            cy="50"
            r={GAUGE_ARC_RADIUS}
            fill="none"
            stroke="color-mix(in srgb, var(--tracker-profile-dialogue-border) 22%, transparent)"
            strokeWidth={GAUGE_TRACK_STROKE}
          />
          <circle
            cx="50"
            cy="50"
            r={GAUGE_INNER_RIM_RADIUS}
            fill="none"
            stroke={GAUGE_RIM_COLOR}
            strokeWidth={GAUGE_RIM_STROKE}
          />
          {percent <= 0 ? (
            <circle
              cx="50"
              cy="50"
              r={GAUGE_ARC_RADIUS}
              fill="none"
              pathLength="100"
              stroke={statStroke}
              strokeDasharray="0.75 99.25"
              strokeLinecap="round"
              strokeWidth={GAUGE_ARC_STROKE / 2}
              className="opacity-[0.42]"
            />
          ) : null}
          <circle
            cx="50"
            cy="50"
            r={GAUGE_ARC_RADIUS}
            fill="none"
            pathLength="100"
            stroke={statStroke}
            strokeDasharray="100"
            strokeDashoffset={100 - renderedPercent}
            strokeLinecap="round"
            strokeWidth={GAUGE_ARC_STROKE}
            className="drop-shadow-[0_0_1px_var(--tracker-profile-stat-fill-glow)] transition-[stroke-dashoffset] duration-200"
          />
        </svg>
        <div className="absolute inset-[15%] flex min-w-0 -translate-y-[2%] flex-col items-center justify-center gap-0 text-center text-[color:var(--tracker-profile-text)]">
          <StatIconPicker
            value={iconValue}
            displayIcon={icon}
            statName={name}
            onSelect={onSelectIcon}
            allowInherit
            iconSize="1em"
            triggerClassName={cn(
              "h-auto w-auto -translate-y-1 rounded-full border-transparent bg-transparent p-0 text-[color:color-mix(in_srgb,var(--tracker-profile-rule)_35%,var(--tracker-profile-text)_65%)] hover:border-[color-mix(in_srgb,var(--tracker-profile-rule)_34%,transparent)] hover:bg-[color-mix(in_srgb,var(--tracker-profile-text)_5%,transparent)] hover:text-[var(--tracker-profile-text)] focus-visible:ring-1",
              size === "large" ? "min-h-5 min-w-5" : "min-h-4 min-w-4",
              GAUGE_ICON_CLASS[size],
            )}
            iconClassName="stroke-[2.25]"
          />
          <InlineEdit
            value={stat.name}
            onSave={(nextName) => onUpdate({ ...stat, name: nextName })}
            placeholder={localizeUi("ui.trackerPanel.statbar.stat")}
            title={name}
            ariaLabel={localizeUi("ui.trackerPanel.statbar.stat")}
            className={cn(
              "w-full min-w-0 -translate-y-1 justify-center px-0 py-0 text-center font-semibold hover:bg-[var(--accent)]/25",
              GAUGE_NAME_CLASS[size],
            )}
            fitPreview
            fitAlign="center"
            showEditHint={false}
            locked={nameLocked}
          />
          <div
            ref={valueEditorRef}
            className={cn(
              "mt-0.5 flex min-w-0 items-baseline justify-center whitespace-nowrap tabular-nums text-[color:color-mix(in_srgb,var(--tracker-profile-number-text)_78%,transparent)] [--tracker-inline-number:color-mix(in_srgb,var(--tracker-profile-number-text)_78%,transparent)]",
              numberClass,
            )}
            onBlur={(event) => {
              const nextFocus = event.relatedTarget;
              if (!nextFocus || !event.currentTarget.contains(nextFocus as Node)) {
                setEditingValues(false);
              }
            }}
            title={localizeUi("ui.trackerPanel.statbar.value1Value2", { value1: stat.value, value2: stat.max })}
          >
            {editingValues ? (
              <>
                <InlineNumber
                  value={stat.value}
                  onChange={(nextValue) => onUpdate({ ...stat, value: nextValue })}
                  title={localizeUi("ui.trackerPanel.charactertrackercard.value")}
                  className={cn(
                    "min-w-0 px-0 py-0 text-right",
                    isCritical &&
                      "[--tracker-inline-number:color-mix(in_srgb,var(--destructive)_42%,var(--tracker-profile-number-text)_58%)]",
                    numberClass,
                  )}
                  locked={valueLocked}
                />
                <span className="px-[0.1875rem] text-[color:color-mix(in_srgb,var(--tracker-profile-number-text)_52%,transparent)]">
                  /
                </span>
                <InlineNumber
                  value={stat.max}
                  onChange={(nextMax) => onUpdate({ ...stat, max: nextMax })}
                  min={0}
                  title={localizeUi("ui.agents.regexscripteditor.max")}
                  className={cn("min-w-0 px-0 py-0 text-left", numberClass)}
                  locked={maxLocked}
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditingValues(true)}
                className={cn(
                  "min-w-[2.25rem] rounded px-1 py-0 text-center outline-none hover:bg-[color-mix(in_srgb,var(--tracker-profile-text)_7%,transparent)] focus-visible:ring-1 focus-visible:ring-[color-mix(in_srgb,var(--tracker-profile-rule)_58%,transparent)]",
                  isCritical &&
                    "text-[color:color-mix(in_srgb,var(--destructive)_42%,var(--tracker-profile-number-text)_58%)]",
                )}
                title={localizeUi("ui.trackerPanel.statgauge.editValue1Percent", {
                  value1: displayedPercent,
                })}
                aria-label={localizeUi("ui.trackerPanel.statgauge.editValue1Percent", {
                  value1: displayedPercent,
                })}
              >
                {displayedPercent}%
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
