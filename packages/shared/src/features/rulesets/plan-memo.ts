/**
 * What a sheet works out to, kept while the Engine plans one choice, so a planner that reads the
 * same fighter's sheet for every cell, option and aim it weighs works it out once.
 *
 * Only inside `withRulesetPlanMemo`, and only for reads keyed by the very objects they read: nothing
 * changes a sheet while a choice is weighed, and everything is let go the moment the choice is made.
 * Outside a pass every read works its answer out afresh, exactly as it always has.
 */
let pass: Map<unknown, unknown> | null = null;

/** Runs `plan` with every keyed read inside it remembered until it returns. */
export function withRulesetPlanMemo<T>(plan: () => T): T {
  if (pass) return plan();
  pass = new Map();
  try {
    return plan();
  } finally {
    pass = null;
  }
}

/** Runs `plan` in a pass of its own, whatever pass is open, and goes back to that one after: for a
 *  read made as things would stand otherwise (1.644's defiance), which the open pass's answers would
 *  get wrong. */
export function withOwnRulesetPlanMemo<T>(plan: () => T): T {
  const outer = pass;
  pass = new Map();
  try {
    return plan();
  } finally {
    pass = outer;
  }
}

/** Runs `plan` in the pass `memo` holds, which its caller keeps and lets go of once what it reads
 *  changes: a screen reading one unchanged sheet render after render (the character builder). */
export function withRulesetPlanMemoIn<T>(memo: Map<unknown, unknown>, plan: () => T): T {
  const outer = pass;
  pass = memo;
  try {
    return plan();
  } finally {
    pass = outer;
  }
}

/** Runs `plan` with no pass open, whatever pass is, and goes back to that one after: for a step of
 *  the fight taken on a copy to see what it comes to, which changes what its reads read as it goes
 *  (a Parry Ward put on and then looked for, cloud AI fights 2026-10-25). */
export function withoutRulesetPlanMemo<T>(plan: () => T): T {
  const outer = pass;
  pass = null;
  try {
    return plan();
  } finally {
    pass = outer;
  }
}

/** `make()`, remembered under `keys` while a planning pass is open. */
export function rulesetPlanMemo<T>(keys: readonly unknown[], make: () => T): T {
  if (!pass) return make();
  let level: Map<unknown, unknown> = pass;
  for (const key of keys.slice(0, -1)) {
    let next = level.get(key) as Map<unknown, unknown> | undefined;
    if (!next) level.set(key, (next = new Map()));
    level = next;
  }
  const last = keys[keys.length - 1];
  if (level.has(last)) return level.get(last) as T;
  const made = make();
  level.set(last, made);
  return made;
}

/**
 * What a sheet works out to, by what it is made of rather than by which objects hold it: kept across
 * a whole command, resolution included, where the same unchanged sheet is read for every step, every
 * hiding check and every reaction. A sheet that changes is a different key, so nothing stale is ever
 * read back. Kept per definition, the least recently read let go past a few hundred.
 *
 * What comes back is shared: callers read it and never change it.
 */
const byContent = new WeakMap<object, Map<string, unknown>>();
const CONTENT_MEMO_SIZE = 400;
const freezes =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.MARINARA_MEMO_FREEZE === "1";

export function rulesetContentMemo<T>(owner: object, name: string, parts: readonly unknown[], make: () => T): T {
  let key: string;
  try {
    key = `${name}\u0000${JSON.stringify(parts)}`;
  } catch {
    return make();
  }
  let cache = byContent.get(owner);
  if (!cache) byContent.set(owner, (cache = new Map()));
  if (cache.has(key)) {
    const hit = cache.get(key) as T;
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const made = make();
  if (freezes) deepFreeze(made);
  cache.set(key, made);
  if (cache.size > CONTENT_MEMO_SIZE) cache.delete(cache.keys().next().value!);
  return made;
}

/** For tests: a shared answer that something changes throws where it is changed. */
function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const one of Object.values(value)) deepFreeze(one);
}
