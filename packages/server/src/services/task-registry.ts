// ──────────────────────────────────────────────
// Global task registry
// ──────────────────────────────────────────────
// One process-wide list of the long-running work the engine is currently doing, so the client can
// show a single "what is the engine busy with" surface instead of each feature inventing its own
// spinner. Deliberately a module-level Map (mirroring connection-rate-limit-registry) rather than a
// Fastify decoration: producers live in services as well as routes, and threading the instance
// through every one of them buys nothing.
//
// Producers opt in. Registering is two calls and never changes behaviour if skipped, so features
// can join one at a time.

/** Coarse grouping used by the UI. Idle daemons/timers are deliberately not modelled; finite work
 *  they start (for example an automatic backup or autonomous reply) is. */
export type TaskKind = "generation" | "agents" | "media" | "transfer";

export interface TaskProgress {
  /** Completed units. */
  current: number;
  /** Total units when known; omit for indeterminate work. */
  total?: number;
  /** How the client should format the numbers. Defaults to a bare count. */
  unit?: "bytes" | "items";
}

export interface TaskEntry {
  id: string;
  kind: TaskKind;
  /** Short human label, already localized or localizable on the client. */
  label: string;
  /** Present when the task belongs to a chat, so the UI can deep-link to it. */
  chatId?: string;
  startedAt: number;
  /** Free-form current stage, e.g. "waiting", "streaming", "downloading". */
  phase?: string;
  /** Extra context for the row: the model, the provider, the item being imported. */
  detail?: string;
  progress?: TaskProgress;
}

/** How a task ended. Producers that cannot tell report "completed". */
export type TaskOutcome = "completed" | "failed" | "aborted";

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

/** How many finished tasks to keep. Small on purpose: this is a "what just happened" strip, not a
 *  log. Anything that needs real history belongs in the server log. */
const HISTORY_LIMIT = 5;

interface TaskRecord extends TaskEntry {
  abort?: () => void;
}

/** What `GET /api/tasks` returns: the entry plus whether a Stop button should render. */
export type TaskSnapshot = TaskEntry & { cancellable: boolean };

const tasks = new Map<string, TaskRecord>();
/** Newest first, capped at HISTORY_LIMIT. */
const history: FinishedTask[] = [];

export interface RegisterTaskInput extends Omit<TaskEntry, "startedAt"> {
  startedAt?: number;
  /** Supply only when cancelling is actually wired up; the UI keys its Stop button off this. */
  abort?: () => void;
}

/** Add a task. Re-registering the same id replaces it. Returns a finish fn for `finally` blocks. */
export function registerTask(input: RegisterTaskInput): (outcome?: TaskOutcome) => void {
  tasks.set(input.id, { ...input, startedAt: input.startedAt ?? Date.now() });
  return (outcome) => finishTask(input.id, outcome);
}

/** Patch a live task. No-op once the task has finished, so late progress events are harmless. */
export function updateTask(id: string, patch: Partial<Omit<TaskEntry, "id">>): void {
  const existing = tasks.get(id);
  if (!existing) return;
  tasks.set(id, { ...existing, ...patch });
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

/** Recently finished tasks, newest first. */
export function listTaskHistory(): FinishedTask[] {
  return history.map((entry) => ({ ...entry }));
}

export function listTasks(): TaskSnapshot[] {
  return [...tasks.values()]
    .map(({ abort, ...entry }) => ({
      ...entry,
      ...(entry.progress ? { progress: { ...entry.progress } } : {}),
      cancellable: typeof abort === "function",
    }))
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Abort a task by id. Returns false when unknown or not cancellable. */
export function abortTask(id: string): boolean {
  const record = tasks.get(id);
  if (!record?.abort) return false;
  record.abort();
  return true;
}

export function resetTaskRegistryForTests(): void {
  tasks.clear();
  history.length = 0;
}
