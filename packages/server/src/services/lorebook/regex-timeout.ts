// Server-side execution timeout for compiled regex tests against chat context.
//
// The shared static check (isPatternSafe) catches the common ReDoS shapes before
// compilation, but expert-crafted patterns can still pass that check and explode
// on specific input. This wrapper runs the regex.test call inside a V8 vm
// context with a hard timeout — the engine inserts interrupt checks during
// regex execution, so catastrophic backtracking aborts instead of stalling the
// event loop indefinitely. One context and precompiled scripts are reused for
// every call: contexts share the isolate, so the timeout interrupt works the
// same in a reused context, and a fresh context per call cost about a
// millisecond each on the generation hot path. Calls are synchronous on one
// thread, so they cannot interleave on the shared globals.
//
// On timeout: log a warning with the pattern source so the lorebook author can
// see why an entry stopped activating, and return false. We deliberately do NOT
// fall back to literal substring on timeout — the pattern compiled and may have
// matched on simpler input; substituting literal-substring semantics here would
// cause silent surprise matches.

import * as vm from "node:vm";
import { logger } from "../../lib/logger.js";

/** Default per-call timeout for a single regex.test against chat context, in ms. */
export const DEFAULT_REGEX_TIMEOUT_MS = 50;

const sharedContext: Record<string, unknown> = vm.createContext(Object.create(null));
const testScript = new vm.Script("(new RegExp(__pattern, __flags)).test(__text)");
const replaceScript = new vm.Script("__text.replace(new RegExp(__pattern, __flags), '')");

function runBounded(script: vm.Script, regex: RegExp, text: string, timeoutMs: number): unknown {
  // Only strings cross into the context and a new RegExp is built per call, so
  // no lastIndex or other state carries over between calls.
  sharedContext.__pattern = regex.source;
  sharedContext.__flags = regex.flags;
  sharedContext.__text = text;
  try {
    return script.runInContext(sharedContext, { timeout: timeoutMs, displayErrors: false });
  } finally {
    // Do not retain large chat text between calls.
    sharedContext.__text = "";
  }
}

/** Build a regex executor that runs `regex.test(text)` under a vm timeout. */
export function createTimeoutRegexExecutor(timeoutMs: number = DEFAULT_REGEX_TIMEOUT_MS) {
  return function vmRegexExecutor(regex: RegExp, text: string): boolean {
    try {
      return Boolean(runBounded(testScript, regex, text, timeoutMs));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // V8 surfaces timeouts as "Script execution timed out." — log warn and skip the entry.
      if (message.includes("timed out")) {
        logger.warn(
          "Lorebook regex /%s/%s exceeded %dms timeout against chat context (length=%d) — entry will not match this scan",
          regex.source,
          regex.flags,
          timeoutMs,
          text.length,
        );
        return false;
      }
      // Contract: non-timeout errors (rare — invalid regex would have thrown at compile time
      // upstream, before we got here) are re-thrown so testKeyword's outer try/catch can swap
      // in its literal-substring fallback. Do NOT swallow here — that catch in
      // packages/shared/src/utils/lorebook-keyword-matching.ts is the intended landing pad,
      // and silently returning false would mask a real executor-side bug.
      throw err;
    }
  };
}

/** Default executor used by keyword-scanner.ts. */
export const vmRegexExecutor = createTimeoutRegexExecutor();

/** Build a guard that proves `text.replace(regex, "")` returns within a vm timeout. */
export function createTimeoutRegexReplaceGuard(timeoutMs: number = DEFAULT_REGEX_TIMEOUT_MS) {
  return function vmRegexReplaceGuard(regex: RegExp, text: string): boolean {
    try {
      runBounded(replaceScript, regex, text, timeoutMs);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("timed out")) {
        logger.warn(
          "Regex script /%s/%s exceeded %dms replace timeout against prompt text (length=%d) — script will be skipped",
          regex.source,
          regex.flags,
          timeoutMs,
          text.length,
        );
        return false;
      }
      throw err;
    }
  };
}

/** Default replacement guard used by regex-application.ts. */
export const vmRegexReplaceGuard = createTimeoutRegexReplaceGuard();
