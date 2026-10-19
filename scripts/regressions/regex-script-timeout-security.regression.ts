// A prompt regex script that backtracks without end, such as one carried in an
// imported character card, must be skipped within its time limit on every
// prompt message, short ones included, instead of blocking the server. Scripts
// that behave keep their exact results, and the reused guard context keeps
// working after a timeout.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { isPatternSafe } from "../../packages/shared/src/index.js";
import { logger } from "../../packages/server/src/lib/logger.js";
import {
  DEFAULT_REGEX_TIMEOUT_MS,
  vmRegexExecutor,
  vmRegexReplaceGuard,
} from "../../packages/server/src/services/lorebook/regex-timeout.js";
import {
  applyRegexScriptsToPromptMessages,
  applyRegexScriptsToPromptText,
} from "../../packages/server/src/services/regex/regex-application.js";

// Each pattern backtracks for seconds or longer on the short message beside it.
const SLOW_CASES = [
  { pattern: String.raw`(?:[\s\S]|[^~])*~~~`, text: "Hello! How are you doing today?" },
  { pattern: "(?:a|[ab])+$", text: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" },
];
const SLOW_PATTERNS = SLOW_CASES.map((entry) => entry.pattern);
const SHORT_MESSAGES = SLOW_CASES.map((entry) => entry.text);
// Each slow call stops at the guard's limit; this leaves wide room for slow machines.
const TIME_BUDGET_MS = 40 * DEFAULT_REGEX_TIMEOUT_MS;

const warnings: unknown[][] = [];
const priorWarn = logger.warn;
logger.warn = ((...args: unknown[]) => warnings.push(args)) as typeof logger.warn;

function script(id: string, findRegex: string, replaceString = "", extra: Record<string, unknown> = {}) {
  return {
    id,
    enabled: "true",
    findRegex,
    replaceString,
    placement: '["user_input","ai_output"]',
    flags: "g",
    applyMode: "prompt",
    ...extra,
  };
}

function timed<T>(run: () => T): { value: T; ms: number } {
  const started = performance.now();
  const value = run();
  return { value, ms: performance.now() - started };
}

try {
  // ── The guard itself stops on short text ──
  for (const pattern of SLOW_PATTERNS) {
    for (const text of SHORT_MESSAGES) {
      const replace = timed(() => vmRegexReplaceGuard(new RegExp(pattern), text));
      assert.ok(replace.ms < TIME_BUDGET_MS, `/${pattern}/ on ${text.length} characters took ${replace.ms} ms`);
      const test = timed(() => vmRegexExecutor(new RegExp(pattern), text));
      assert.ok(test.ms < TIME_BUDGET_MS, `/${pattern}/ test on ${text.length} characters took ${test.ms} ms`);
      assert.equal(test.value, false, "a timed-out lorebook key does not match");
    }
  }
  assert.equal(vmRegexExecutor(/fox/, "the quick fox"), true, "the reused context still answers after a timeout");
  assert.equal(vmRegexReplaceGuard(/fox/g, "the quick fox"), true);

  // ── Prompt regex scripts on short messages ──
  const scripts = [
    ...SLOW_PATTERNS.map((pattern, index) => script(`slow-${index}`, pattern, "[cut]")),
    script("name", String.raw`\bMari\b`, "{{char}}"),
    script("ooc", String.raw`\(OOC: ([^)]*)\)`, "[$1]", { flags: "gi", trimStrings: '["!!"]' }),
  ];
  const resolveMacros = (value: string) => value.replaceAll("{{char}}", "Professor Mari");
  for (const { pattern, text } of SLOW_CASES) {
    warnings.length = 0;
    const result = timed(() => applyRegexScriptsToPromptText(text, scripts, "user_input", 0, { resolveMacros }));
    assert.ok(result.ms < TIME_BUDGET_MS * SLOW_PATTERNS.length, `${text.length} characters took ${result.ms} ms`);
    assert.equal(result.value, text, "slow scripts are skipped and leave the message alone");
    if (isPatternSafe(pattern)) {
      assert.ok(
        warnings.some((args) => String(args[0]).includes("replace timeout") && args[1] === pattern),
        `/${pattern}/ passed the static check, so the timed guard must stop it`,
      );
    }
  }

  const messages = [
    { id: "1", role: "user", content: "Hi Mari! (OOC: be brief!!)" },
    { id: "2", role: "assistant", content: "Mari waves. ".repeat(40).trim() },
    { id: "3", role: "user", content: SHORT_MESSAGES[0]! },
  ];
  const turn = timed(() => applyRegexScriptsToPromptMessages(messages, scripts, { resolveMacros }));
  assert.ok(turn.ms < TIME_BUDGET_MS * SLOW_PATTERNS.length * messages.length, `a turn took ${turn.ms} ms`);
  assert.deepEqual(
    messages.map((message) => message.content),
    ["Hi Professor Mari! [be brief]", "Professor Mari waves. ".repeat(40).trim(), SHORT_MESSAGES[0]],
    "well-behaved scripts still apply after a slow one was skipped",
  );

  console.info("Regex script timeout regressions passed.");
} finally {
  logger.warn = priorWarn;
}
