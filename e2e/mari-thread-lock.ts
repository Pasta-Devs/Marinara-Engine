import { mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

// F11: several Mari e2e specs drive a live run against the shared dev server and route by "the most
// recent Mari thread" — two of them running on different Playwright workers at once can steal each
// other's thread mid-run. A per-test beforeEach that clears existing threads is not enough, since the
// collision happens between two tests that are BOTH mid-flight, not from stale leftover state. This is
// a cross-worker mutex (an atomically-created lock directory) so only one of these specs runs at a time,
// while every other spec keeps its normal parallelism. Use with test.beforeEach/afterEach.
const lockDir = resolve(import.meta.dirname, "../.tmp/mari-thread-lock");
// A killed run never reaches release. No locked spec runs longer than 120 s, so an older lock is stale.
// ponytail: two waiters can both see the same stale lock; add an owner token if that ever bites.
const STALE_LOCK_MS = 5 * 60_000;

export async function acquireMariThreadLock(): Promise<void> {
  // A fresh checkout has no .tmp/ yet; create the parent so the atomic mkdir below can run.
  mkdirSync(dirname(lockDir), { recursive: true });
  for (;;) {
    try {
      mkdirSync(lockDir, { recursive: false });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > STALE_LOCK_MS) rmSync(lockDir, { recursive: true, force: true });
      } catch {
        // Released between the mkdir and the stat: the next try takes it.
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
}

export function releaseMariThreadLock(): void {
  rmSync(lockDir, { recursive: true, force: true });
}
