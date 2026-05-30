export interface Clock {
  now(): Date;
  nowIso(): string;
  nowMs(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};
