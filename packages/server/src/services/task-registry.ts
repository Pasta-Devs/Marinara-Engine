import type {
  FinishedTask,
  MissionStage,
  MissionStageState,
  TaskKind,
  TaskOutcome,
  TaskProgress,
  TaskSnapshot,
  TaskState,
  TaskStepSnapshot,
  TaskStepState,
  TaskStopMode,
} from "@marinara-engine/shared";
import { AsyncLocalStorage } from "node:async_hooks";

export type { FinishedTask, TaskKind, TaskOutcome, TaskProgress, TaskSnapshot };

export interface TaskEntry {
  id: string;
  kind: TaskKind;
  label: string;
  chatId?: string;
  startedAt: number;
  phase?: string;
  detail?: string;
  progress?: TaskProgress;
  state: TaskState;
  stopMode: TaskStopMode;
  stopRequestedAt?: number;
  stages?: Partial<Record<MissionStage, MissionStageState>>;
}

export interface TaskStepInput {
  id: string;
  label: string;
  detail?: string;
  stage?: MissionStage;
  state?: TaskStepState;
  startedAt?: number;
  endedAt?: number;
  progress?: TaskProgress;
}

const HISTORY_LIMIT = 5;

// Mission Control tracks finite work that is queued, calls an AI/media/embedding provider,
// survives its initiating request, performs a multi-item write, or normally remains visible for
// roughly a second. Idle schedulers, heartbeat timers, and file watchers belong in diagnostics;
// the finite jobs they launch belong here.

interface TaskRecord extends TaskEntry {
  stop?: () => void;
  children: Map<string, TaskStepSnapshot>;
}

const tasks = new Map<string, TaskRecord>();
const history: FinishedTask[] = [];
const taskContext = new AsyncLocalStorage<string>();

export interface RegisterTaskInput extends Omit<
  TaskEntry,
  "startedAt" | "state" | "stopMode" | "stopRequestedAt" | "stages"
> {
  startedAt?: number;
  state?: TaskState;
  stopMode?: TaskStopMode;
  stages?: Partial<Record<MissionStage, MissionStageState>>;
  abort?: () => void;
  stop?: () => void;
}

export function registerTask(input: RegisterTaskInput): (outcome?: TaskOutcome) => void {
  const { abort, stop, ...entry } = input;
  tasks.set(input.id, {
    ...entry,
    startedAt: input.startedAt ?? Date.now(),
    state: input.state ?? (input.phase === "queued" ? "queued" : "running"),
    stopMode: input.stopMode ?? (abort || stop ? "immediate" : "none"),
    stop: stop ?? abort,
    children: new Map(),
  });
  return (outcome) => finishTask(input.id, outcome);
}

/** Attach deeply nested provider work to a root mission without plumbing ids through every helper. */
export function enterTaskContext(id: string): void {
  taskContext.enterWith(id);
}

export function currentTaskContext(): string | undefined {
  const id = taskContext.getStore();
  return id && tasks.has(id) ? id : undefined;
}

export function currentTaskStage(id: string): MissionStage | undefined {
  const stages = tasks.get(id)?.stages;
  if (stages?.after === "running") return "after";
  if (stages?.reply === "running") return "reply";
  if (stages?.before === "running") return "before";
  return undefined;
}

export function updateTask(id: string, patch: Partial<Omit<TaskEntry, "id" | "startedAt" | "stopRequestedAt">>): void {
  const existing = tasks.get(id);
  if (!existing) return;
  Object.assign(existing, patch);
}

export function updateTaskStage(id: string, stage: MissionStage, state: MissionStageState): void {
  const existing = tasks.get(id);
  if (!existing) return;
  existing.stages = { ...existing.stages, [stage]: state };
}

export function upsertTaskStep(taskId: string, input: TaskStepInput): void {
  const task = tasks.get(taskId);
  if (!task || task.stopRequestedAt) return;
  const existing = task.children.get(input.id);
  const state = input.state ?? existing?.state ?? "running";
  const startedAt = input.startedAt ?? existing?.startedAt ?? (state === "running" ? Date.now() : undefined);
  const endedAt = input.endedAt ?? (isTerminalStepState(state) ? (existing?.endedAt ?? Date.now()) : undefined);
  task.children.set(input.id, {
    ...existing,
    ...input,
    state,
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(input.progress ? { progress: { ...input.progress } } : {}),
  });
}

export function finishTaskStep(taskId: string, stepId: string, outcome: TaskOutcome | "skipped" = "completed"): void {
  const task = tasks.get(taskId);
  const step = task?.children.get(stepId);
  if (!task || !step || isTerminalStepState(step.state)) return;
  task.children.set(stepId, { ...step, state: outcome, endedAt: Date.now() });
}

export function finishTask(id: string, outcome: TaskOutcome = "completed"): void {
  const record = tasks.get(id);
  if (!record) return;
  tasks.delete(id);
  history.unshift({
    id: record.id,
    kind: record.kind,
    label: record.label,
    detail: record.detail,
    chatId: record.chatId,
    startedAt: record.startedAt,
    endedAt: Date.now(),
    outcome,
  });
  history.length = Math.min(history.length, HISTORY_LIMIT);
}

export function listTaskHistory(): FinishedTask[] {
  return history.map((entry) => ({ ...entry }));
}

export function clearTaskHistory(): void {
  history.length = 0;
}

export function listTasks(): TaskSnapshot[] {
  return [...tasks.values()]
    .map(({ stop: _stop, children, ...entry }) => ({
      ...entry,
      ...(entry.progress ? { progress: { ...entry.progress } } : {}),
      ...(entry.stages ? { stages: { ...entry.stages } } : {}),
      children: [...children.values()].map((child) => ({
        ...child,
        ...(child.progress ? { progress: { ...child.progress } } : {}),
      })),
      cancellable: entry.stopMode !== "none",
    }))
    .sort((a, b) => a.startedAt - b.startedAt);
}

export function requestTaskStop(id: string): { accepted: boolean; mode?: TaskStopMode } {
  const record = tasks.get(id);
  if (!record) return { accepted: false };
  if (record.stopRequestedAt) return { accepted: true, mode: record.stopMode };

  if (record.stopMode === "none") return { accepted: false };

  record.stopRequestedAt = Date.now();
  record.state = "stopping";
  // Only queued children are certainly dead. A running child reports its own outcome when it
  // unwinds; marking it aborted here would show a finished state while the work is still going.
  for (const [stepId, child] of record.children) {
    if (child.state === "queued") {
      record.children.set(stepId, { ...child, state: "skipped", endedAt: Date.now() });
    }
  }
  record.stop?.();
  return { accepted: true, mode: record.stopMode };
}

export function isTaskStopRequested(id: string): boolean {
  return Boolean(tasks.get(id)?.stopRequestedAt);
}

export function abortTask(id: string): boolean {
  return requestTaskStop(id).accepted;
}

export function resetTaskRegistryForTests(): void {
  tasks.clear();
  history.length = 0;
}

function isTerminalStepState(state: TaskStepState): boolean {
  return state === "completed" || state === "failed" || state === "aborted" || state === "skipped";
}
