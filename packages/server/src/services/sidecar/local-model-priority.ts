/**
 * Who goes first on the built-in model.
 *
 * llama-server works on `--parallel` requests at once and serves the rest in arrival
 * order. Marinara sends it many kinds of work: agents that must finish before a reply can
 * start, the reply itself, trackers and agents that run beside or after the reply, and
 * work nobody is waiting on (summaries, memory, embeddings). In arrival order a reply can
 * sit behind two tracker runs while the person stares at a typing indicator.
 *
 * So requests to the built-in model take a turn here first, highest level first:
 *
 *   prepare    agents that run before the reply; the reply cannot start until they finish
 *   reply      the reply the person is waiting for (and its tool rounds)
 *   turn       agents and trackers that run beside or after the reply
 *   background anything else
 *
 * With two or more slots, `turn` and `background` work may hold all but one of them, so
 * a reply or a before-reply agent always finds a slot free instead of waiting for a long
 * tracker run to end. With one slot nothing is reserved: the next turn goes to the
 * highest level waiting.
 *
 * The level comes from the request's options when the caller knows it, otherwise from
 * the async context: a generation runs in a `prepare` context that drops to `turn` once
 * its reply is done, so lorebook decisions made while the prompt is built rank with the
 * before-reply agents and anything that runs after the reply ranks with the trackers.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type LocalModelPriority = "prepare" | "reply" | "turn" | "background";

const RANK: Record<LocalModelPriority, number> = { prepare: 0, reply: 1, turn: 2, background: 3 };

type PriorityScope = { level: LocalModelPriority };
const scope = new AsyncLocalStorage<PriorityScope>();

/** Run `fn` with requests inside it ranked at `level`, unless a request names its own. */
export function runWithLocalModelPriority<T>(level: LocalModelPriority, fn: () => T): T {
  return scope.run({ level }, fn);
}

/** The level the current async context asks for, or background outside any. */
export function currentLocalModelPriority(): LocalModelPriority {
  return scope.getStore()?.level ?? "background";
}

/**
 * Lower the current generation's context once its reply is done, so whatever it still
 * starts (trackers, summaries, follow-up work) no longer ranks with before-reply work.
 */
export function lowerLocalModelPriorityAfterReply(): void {
  const store = scope.getStore();
  if (store && RANK[store.level] < RANK.turn) store.level = "turn";
}

type Waiter = { level: LocalModelPriority; order: number; grant: () => void };

export interface LocalModelQueueSnapshot {
  capacity: number;
  running: Record<LocalModelPriority, number>;
  waiting: Record<LocalModelPriority, number>;
}

export class LocalModelTurns {
  private running: Record<LocalModelPriority, number> = { prepare: 0, reply: 0, turn: 0, background: 0 };
  private waiting: Waiter[] = [];
  private nextOrder = 0;

  /** `capacity` is read on every decision so a restart with another slot count applies at once. */
  constructor(private readonly capacity: () => number) {}

  private slots(): number {
    const value = this.capacity();
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
  }

  private total(): number {
    return this.running.prepare + this.running.reply + this.running.turn + this.running.background;
  }

  /** Whether work at `level` may take a slot right now. */
  private mayStart(level: LocalModelPriority): boolean {
    const slots = this.slots();
    if (this.total() >= slots) return false;
    if (RANK[level] <= RANK.reply || slots < 2) return true;
    // Lower levels leave one slot for a reply or a before-reply agent.
    return this.running.turn + this.running.background < slots - 1;
  }

  private pump(): void {
    // Highest level first, then first come. The head of the queue may always do at least
    // what anything behind it may, so when the head cannot start nothing behind it can.
    // One grant per pass, so the reservation is re-checked against the updated counts.
    this.waiting.sort((left, right) => RANK[left.level] - RANK[right.level] || left.order - right.order);
    while (this.waiting.length > 0 && this.mayStart(this.waiting[0]!.level)) {
      const next = this.waiting.shift()!;
      this.running[next.level] += 1;
      next.grant();
    }
  }

  /**
   * Run `work` once a slot is free for `level`. A request cancelled while waiting runs
   * `work` straight away without a slot: it sees its aborted signal and returns at once.
   */
  async run<T>(level: LocalModelPriority, signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
    if (signal?.aborted) return work();
    if (this.waiting.length === 0 && this.mayStart(level)) {
      this.running[level] += 1;
    } else {
      const granted = await new Promise<boolean>((resolve) => {
        const waiter: Waiter = {
          level,
          order: this.nextOrder++,
          grant: () => {
            signal?.removeEventListener("abort", cancel);
            resolve(true);
          },
        };
        const cancel = () => {
          const at = this.waiting.indexOf(waiter);
          if (at >= 0) this.waiting.splice(at, 1);
          resolve(false);
          this.pump();
        };
        this.waiting.push(waiter);
        signal?.addEventListener("abort", cancel, { once: true });
        this.pump();
      });
      if (!granted) return work();
    }
    try {
      return await work();
    } finally {
      this.running[level] = Math.max(0, this.running[level] - 1);
      this.pump();
    }
  }

  /** Hold a slot for a stream: the returned release must be called exactly once. */
  async acquire(level: LocalModelPriority, signal: AbortSignal | undefined): Promise<() => void> {
    let release!: () => void;
    const held = new Promise<void>((done) => {
      release = done;
    });
    let started!: () => void;
    const ready = new Promise<void>((done) => {
      started = done;
    });
    void this.run(level, signal, async () => {
      started();
      await held;
    });
    await ready;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
    };
  }

  busy(): boolean {
    return this.total() > 0 || this.waiting.length > 0;
  }

  snapshot(): LocalModelQueueSnapshot {
    const waiting: Record<LocalModelPriority, number> = { prepare: 0, reply: 0, turn: 0, background: 0 };
    for (const waiter of this.waiting) waiting[waiter.level] += 1;
    return { capacity: this.slots(), running: { ...this.running }, waiting };
  }
}
