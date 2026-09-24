export const NOODLE_FAN_ACTIVITY_DAY_PLAN_VERSION = 1 as const;
export const NOODLE_FAN_ACTIVITY_RUNS_PER_DAY = 4 as const;
export const NOODLE_FAN_ACTIVITY_MAX_RUNS_PER_DAY = 24 as const;
export const NOODLE_FAN_ACTIVITY_MAX_MANUAL_RUNS = 24 as const;
export const NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN = 12 as const;
export const NOODLE_FAN_ACTIVITY_MAX_ACTIVITIES_PER_CREATOR = 4 as const;

export type NoodleFanActivityRunStatus =
  "scheduled" | "generating" | "applying" | "completed" | "skipped" | "abandoned";

export interface NoodleFanAcceptedActivity {
  id: string;
  creatorId: string;
  type: string;
  targetPostId: string;
  content: string | null;
  actorId: string;
  snapshot: NoodleAuthorSnapshot;
  applied: boolean;
}

export interface NoodleFanActivityDayPlanRun {
  id: string;
  scheduledAt: string;
  creatorIds: string[];
  status: NoodleFanActivityRunStatus;
  acceptedActivities: NoodleFanAcceptedActivity[];
  claimedAt: string | null;
  finishedAt: string | null;
  manual?: boolean;
}

export interface PersistedNoodleFanActivityDayPlan {
  version: typeof NOODLE_FAN_ACTIVITY_DAY_PLAN_VERSION;
  localDate: string;
  timezone: string;
  runs: NoodleFanActivityDayPlanRun[];
  nextCreatorOffset: number;
}

export interface NoodleFanActivityToStore {
  creatorId: string;
  type: string;
  targetPostId: string;
  content?: string | null;
  actorId: string;
  snapshot: NoodleAuthorSnapshot;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isStatus(value: unknown): value is NoodleFanActivityRunStatus {
  return (
    value === "scheduled" ||
    value === "generating" ||
    value === "applying" ||
    value === "completed" ||
    value === "skipped" ||
    value === "abandoned"
  );
}

function localDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

function creatorList(creatorIds: string[]): string[] {
  return [...new Set(creatorIds.filter((id) => typeof id === "string" && id.length > 0))].sort();
}

function validActivity(value: unknown): value is NoodleFanAcceptedActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.creatorId === "string" &&
    typeof row.type === "string" &&
    typeof row.targetPostId === "string" &&
    typeof row.actorId === "string" &&
    (row.content === null || typeof row.content === "string") &&
    typeof row.applied === "boolean" &&
    "snapshot" in row
  );
}

function validRun(value: unknown): value is NoodleFanActivityDayPlanRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    isTimestamp(row.scheduledAt) &&
    Array.isArray(row.creatorIds) &&
    row.creatorIds.length <= NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN &&
    new Set(row.creatorIds).size === row.creatorIds.length &&
    row.creatorIds.every((id) => typeof id === "string") &&
    isStatus(row.status) &&
    Array.isArray(row.acceptedActivities) &&
    row.acceptedActivities.every(validActivity) &&
    (row.claimedAt === null || isTimestamp(row.claimedAt)) &&
    (row.finishedAt === null || isTimestamp(row.finishedAt))
  );
}

export function parsePersistedNoodleFanActivityDayPlan(value: unknown): PersistedNoodleFanActivityDayPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== NOODLE_FAN_ACTIVITY_DAY_PLAN_VERSION) return null;
  if (typeof row.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(row.localDate)) return null;
  if (typeof row.timezone !== "string" || !row.timezone || !Array.isArray(row.runs)) return null;
  const validRuns = row.runs.every(validRun);
  const manualRunCount = validRuns
    ? row.runs.filter((run) => (run as NoodleFanActivityDayPlanRun).manual === true).length
    : 0;
  const automaticRunCount = validRuns ? row.runs.length - manualRunCount : 0;
  if (
    row.runs.length < 1 ||
    !validRuns ||
    automaticRunCount > NOODLE_FAN_ACTIVITY_MAX_RUNS_PER_DAY ||
    manualRunCount > NOODLE_FAN_ACTIVITY_MAX_MANUAL_RUNS
  ) {
    return null;
  }
  if (
    typeof row.nextCreatorOffset !== "number" ||
    !Number.isInteger(row.nextCreatorOffset) ||
    row.nextCreatorOffset < 0
  ) {
    return null;
  }
  return {
    version: NOODLE_FAN_ACTIVITY_DAY_PLAN_VERSION,
    localDate: row.localDate,
    timezone: row.timezone,
    runs: row.runs,
    nextCreatorOffset: row.nextCreatorOffset,
  };
}

function scheduledRuns(at: Date, runsPerDay: number = NOODLE_FAN_ACTIVITY_RUNS_PER_DAY): NoodleFanActivityDayPlanRun[] {
  const start = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  return Array.from({ length: runsPerDay }, (_, index) => ({
    id: `${localDate(at)}-run-${index + 1}`,
    scheduledAt: new Date(start.getTime() + (index * 24 * 60 * 60 * 1000) / runsPerDay).toISOString(),
    creatorIds: [],
    status: "scheduled" as const,
    acceptedActivities: [],
    claimedAt: null,
    finishedAt: null,
    manual: false,
  }));
}

export function reconcileNoodleFanActivityDayPlan(
  current: PersistedNoodleFanActivityDayPlan | null,
  creatorIds: string[],
  at: Date,
  runsPerDay: number = NOODLE_FAN_ACTIVITY_RUNS_PER_DAY,
): PersistedNoodleFanActivityDayPlan {
  const date = localDate(at);
  const zone = timezone();
  if (current?.localDate === date && current.timezone === zone) {
    const targetRuns = Math.max(1, Math.min(NOODLE_FAN_ACTIVITY_MAX_RUNS_PER_DAY, runsPerDay));
    const manualRuns = current.runs.filter((run) => run.manual);
    const automaticRuns = current.runs.filter((run) => !run.manual);
    const usedRuns = automaticRuns.filter((run) => run.status !== "scheduled");
    const scheduledRunsById = new Map(
      automaticRuns.filter((run) => run.status === "scheduled").map((run) => [run.id, run]),
    );
    const retainedScheduledRuns = [...scheduledRunsById.values()].slice(0, Math.max(0, targetRuns - usedRuns.length));
    const retainedIds = new Set([...usedRuns, ...retainedScheduledRuns].map((run) => run.id));
    const addedRuns = scheduledRuns(at, targetRuns)
      .filter((run) => !retainedIds.has(run.id))
      .slice(0, Math.max(0, targetRuns - usedRuns.length - retainedScheduledRuns.length));
    const creators = creatorList(creatorIds);
    let offset = creators.length === 0 ? 0 : current.nextCreatorOffset % creators.length;
    for (const run of addedRuns) {
      const count = Math.min(NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN, creators.length);
      run.creatorIds = Array.from({ length: count }, (_, index) => creators[(offset + index) % creators.length]!);
      offset = creators.length === 0 ? 0 : (offset + count) % creators.length;
    }
    return reconcileOverdueNoodleFanActivityRuns(
      {
        ...current,
        runs: [...usedRuns, ...retainedScheduledRuns, ...addedRuns, ...manualRuns],
        nextCreatorOffset: offset,
      },
      at,
    );
  }

  const creators = creatorList(creatorIds);
  const runs = scheduledRuns(at, Math.max(1, Math.min(NOODLE_FAN_ACTIVITY_MAX_RUNS_PER_DAY, runsPerDay)));
  let offset = creators.length === 0 ? 0 : (current?.nextCreatorOffset ?? 0) % creators.length;
  for (const run of runs) {
    const count = Math.min(NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN, creators.length);
    run.creatorIds = Array.from({ length: count }, (_, index) => creators[(offset + index) % creators.length]!);
    offset = creators.length === 0 ? 0 : (offset + count) % creators.length;
  }
  return { version: 1, localDate: date, timezone: zone, runs, nextCreatorOffset: offset };
}

function reconcileOverdueNoodleFanActivityRuns(
  plan: PersistedNoodleFanActivityDayPlan,
  at: Date,
): PersistedNoodleFanActivityDayPlan {
  const due = plan.runs.filter((run) => run.status === "scheduled" && Date.parse(run.scheduledAt) <= at.getTime());
  const newest = due.at(-1)?.id;
  if (!newest) return plan;
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.status === "scheduled" && Date.parse(run.scheduledAt) <= at.getTime() && run.id !== newest
        ? { ...run, status: "skipped", finishedAt: at.toISOString() }
        : run,
    ),
  };
}

export function dueNoodleFanActivityRun(
  plan: PersistedNoodleFanActivityDayPlan,
  at: Date,
): NoodleFanActivityDayPlanRun | null {
  return (
    plan.runs.filter((run) => run.status === "scheduled" && Date.parse(run.scheduledAt) <= at.getTime()).at(-1) ?? null
  );
}

export function claimNoodleFanActivityRun(
  plan: PersistedNoodleFanActivityDayPlan,
  runId: string,
  at: Date,
): PersistedNoodleFanActivityDayPlan {
  const reconciled = reconcileOverdueNoodleFanActivityRuns(plan, at);
  const run = reconciled.runs.find((candidate) => candidate.id === runId);
  if (!run || run.status !== "scheduled" || Date.parse(run.scheduledAt) > at.getTime()) {
    throw new Error("That Noodle fan activity run is not due or is no longer available.");
  }
  return {
    ...reconciled,
    runs: reconciled.runs.map((candidate) =>
      candidate.id === runId ? { ...candidate, status: "generating", claimedAt: at.toISOString() } : candidate,
    ),
  };
}

export function storeNoodleFanAcceptedActivities(
  plan: PersistedNoodleFanActivityDayPlan,
  runId: string,
  activities: NoodleFanActivityToStore[],
): PersistedNoodleFanActivityDayPlan {
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.id !== runId
        ? run
        : {
            ...run,
            status: "applying",
            acceptedActivities: activities.map((activity) => ({
              id: `${runId}-${activity.creatorId}-${activity.targetPostId}-${activity.type}-${activity.actorId}`,
              creatorId: activity.creatorId,
              type: activity.type,
              targetPostId: activity.targetPostId,
              actorId: activity.actorId,
              content: activity.content ?? null,
              snapshot: activity.snapshot,
              applied: false,
            })),
          },
    ),
  };
}

export function markNoodleFanActivityApplied(
  plan: PersistedNoodleFanActivityDayPlan,
  runId: string,
  activityId: string,
): PersistedNoodleFanActivityDayPlan {
  return {
    ...plan,
    runs: plan.runs.map((run) =>
      run.id !== runId
        ? run
        : {
            ...run,
            acceptedActivities: run.acceptedActivities.map((activity) =>
              activity.id === activityId ? { ...activity, applied: true } : activity,
            ),
          },
    ),
  };
}

export function finishNoodleFanActivityRun(
  plan: PersistedNoodleFanActivityDayPlan,
  runId: string,
  status: "completed" | "skipped" | "abandoned",
  at: Date,
): PersistedNoodleFanActivityDayPlan {
  if (status !== "completed" && status !== "skipped" && status !== "abandoned") {
    throw new Error("Invalid Noodle fan activity finish status.");
  }
  return {
    ...plan,
    runs: plan.runs.map((run) => (run.id === runId ? { ...run, status, finishedAt: at.toISOString() } : run)),
  };
}

export function nextAvailableNoodleFanActivityRun(
  plan: PersistedNoodleFanActivityDayPlan,
): NoodleFanActivityDayPlanRun | null {
  return plan.runs.find((run) => run.status === "scheduled") ?? null;
}

export function claimManualNoodleFanActivityRun(
  plan: PersistedNoodleFanActivityDayPlan,
  at: Date,
): { plan: PersistedNoodleFanActivityDayPlan; run: NoodleFanActivityDayPlanRun } {
  const automaticRuns = plan.runs.filter((run) => !run.manual);
  const manualRuns = plan.runs.filter((run) => run.manual).slice(-(NOODLE_FAN_ACTIVITY_MAX_MANUAL_RUNS - 1));
  const run: NoodleFanActivityDayPlanRun = {
    id: `${plan.localDate}-manual-${at.getTime()}`,
    scheduledAt: at.toISOString(),
    creatorIds: [...new Set(automaticRuns.flatMap((candidate) => candidate.creatorIds))].slice(
      0,
      NOODLE_FAN_ACTIVITY_MAX_CREATORS_PER_RUN,
    ),
    status: "generating",
    acceptedActivities: [],
    claimedAt: at.toISOString(),
    finishedAt: null,
    manual: true,
  };
  return { plan: { ...plan, runs: [...automaticRuns, ...manualRuns, run] }, run };
}
import type { NoodleAuthorSnapshot } from "@marinara-engine/shared";
