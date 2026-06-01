import type { CharacterStat } from "../../../../engine/contracts/types/game-state";
import { removeTrackerListItem, replaceTrackerListItem } from "../../../runtime/world-state/index";
import { TRACKER_SECTION_AGENT_TYPES } from "../../../runtime/world-state/index";
import { EMPTY_STATE, PersonaStatusField, TrackerSectionRefresh } from "./RoleplayHUDPanelPrimitives";
import { StatBarEditable } from "./RoleplayHUDStatControls";
import {
  bodyClass,
  headerClass,
  sectionPadding,
  type TrackerRetryControls,
  type TrackerSectionLayout,
} from "./RoleplayHUDTrackerSectionLayout";

export function PersonaTrackerSection({
  stats,
  onUpdate,
  status = "",
  onUpdateStatus,
  layout = "panel",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  stats: CharacterStat[];
  onUpdate: (bars: CharacterStat[]) => void;
  status?: string;
  onUpdateStatus?: (status: string) => void;
  layout?: TrackerSectionLayout;
} & TrackerRetryControls) {
  const updateStat = (idx: number, field: "value" | "max" | "name", val: number | string) => {
    const stat = stats[idx];
    if (!stat) return;
    onUpdate(replaceTrackerListItem(stats, idx, { ...stat, [field]: val }));
  };
  const removeStat = (idx: number) => {
    onUpdate(removeTrackerListItem(stats, idx));
  };

  if (layout === "panel") {
    return (
      <>
        <div className="border-b border-[var(--border)] p-2">
          <PersonaStatusField value={status} onSave={onUpdateStatus} />
        </div>
        <div className={headerClass(layout)}>
          <span className="text-[0.625rem] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
            Persona Stats
          </span>
          <TrackerSectionRefresh
            agentType={TRACKER_SECTION_AGENT_TYPES.persona}
            onRerunSingleTracker={onRerunSingleTracker}
            busy={isTrackerRetryBusy}
            title="Re-run persona tracker (stats + inventory)"
          />
        </div>
        <div className={bodyClass(layout, "space-y-2")}>
          {stats.map((stat, idx) => (
            <StatBarEditable
              key={idx}
              stat={stat}
              onUpdateName={(name) => updateStat(idx, "name", name)}
              onUpdateValue={(value) => updateStat(idx, "value", value)}
              onUpdateMax={(value) => updateStat(idx, "max", value)}
              onRemove={() => removeStat(idx)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={sectionPadding(layout)}>
      <PersonaStatusField value={status} onSave={onUpdateStatus} />
      <div className={headerClass(layout)}>
        <span className="text-[0.625rem] font-semibold text-violet-300/70 uppercase tracking-wider">Persona Stats</span>
        <TrackerSectionRefresh
          agentType={TRACKER_SECTION_AGENT_TYPES.persona}
          onRerunSingleTracker={onRerunSingleTracker}
          busy={isTrackerRetryBusy}
          title="Re-run persona tracker (stats + inventory)"
        />
      </div>
      <div className="space-y-2">
        {stats.length === 0 && <div className={EMPTY_STATE}>No stats tracked</div>}
        {stats.map((stat, idx) => (
          <StatBarEditable
            key={idx}
            stat={stat}
            onUpdateName={(name) => updateStat(idx, "name", name)}
            onUpdateValue={(value) => updateStat(idx, "value", value)}
            onUpdateMax={(value) => updateStat(idx, "max", value)}
          />
        ))}
      </div>
    </div>
  );
}
