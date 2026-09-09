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

/** Coarse grouping the UI renders as sections. Daemons/timers are deliberately not modelled. */
export type TaskKind = "generation" | "agents" | "media" | "transfer";

export interface TaskProgress {
  /** Completed units (bytes, items, steps). */
  current: number;
  /** Total units when known; omit for indeterminate work. */
  total?: number;
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
  progress?: TaskProgress;
}

interface TaskRecord extends TaskEntry {
  abort?: () => void;
}

/** What `GET /api/tasks` returns: the entry plus whether a Stop button should render. */
export type TaskSnapshot = TaskEntry & { cancellable: boolean };

const tasks = new Map<string, TaskRecord>();

export interface RegisterTaskInput extends Omit<TaskEntry, "startedAt"> {
  startedAt?: number;
  /** Supply only when cancelling is actually wired up; the UI keys its Stop button off this. */
  abort?: () => void;
}

/** Add a task. Re-registering the same id replaces it. Returns a finish fn for `finally` blocks. */
export function registerTask(input: RegisterTaskInput): () => void {
  tasks.set(input.id, { ...input, startedAt: input.startedAt ?? Date.now() });
  return () => finishTask(input.id);
}

/** Patch a live task. No-op once the task has finished, so late progress events are harmless. */
export function updateTask(id: string, patch: Partial<Omit<TaskEntry, "id">>): void {
  const existing = tasks.get(id);
  if (!existing) return;
  tasks.set(id, { ...existing, ...patch });
}

export function finishTask(id: string): void {
  tasks.delete(id);
}

export function listTasks(): TaskSnapshot[] {
  return [...tasks.values()]
    .map(({ abort, ...entry }) => ({ ...entry, cancellable: typeof abort === "function" }))
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
}
