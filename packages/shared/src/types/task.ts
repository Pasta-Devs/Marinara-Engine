export type TaskKind = "generation" | "agents" | "media" | "transfer" | "maintenance";
export type TaskOutcome = "completed" | "failed" | "aborted";
export type TaskState = "queued" | "running" | "stopping";
export type TaskStopMode = "immediate" | "safe";
export type MissionStage = "before" | "reply" | "after";
export type TaskStepState = "queued" | "running" | "completed" | "failed" | "aborted" | "skipped";
export type MissionStageState = "pending" | "running" | "completed" | "failed" | "aborted" | "skipped";

export interface TaskProgress {
  current: number;
  total?: number;
  unit?: "bytes" | "items";
}

export interface TaskStepSnapshot {
  id: string;
  label: string;
  detail?: string;
  stage?: MissionStage;
  state: TaskStepState;
  startedAt?: number;
  endedAt?: number;
  progress?: TaskProgress;
}

export interface TaskSnapshot {
  id: string;
  kind: TaskKind;
  label: string;
  detail?: string;
  chatId?: string;
  startedAt: number;
  phase?: string;
  progress?: TaskProgress;
  state: TaskState;
  stopMode: TaskStopMode;
  stopRequestedAt?: number;
  stages?: Partial<Record<MissionStage, MissionStageState>>;
  children: TaskStepSnapshot[];
  /** Compatibility with the first Mission Control client. Root missions are always stoppable. */
  cancellable: boolean;
}

export interface FinishedTask {
  id: string;
  kind: TaskKind;
  label: string;
  detail?: string;
  chatId?: string;
  startedAt: number;
  endedAt: number;
  outcome: TaskOutcome;
}

export interface EngineTasksResponse {
  tasks: TaskSnapshot[];
  history: FinishedTask[];
}
