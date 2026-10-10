import { resolveRunSeconds, resolveRunStartMs } from "../../../packages/client/src/lib/mari-work-card-timing.js";
import { pickMariPhraseIndex } from "../../../packages/client/src/lib/mari-work-animations.js";

// The run clock on her work card and the live status phrase.
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// A replayed run: two 5s steps, three minutes apart. The span is what the user watched, not 10s.
const replayed = [
  { updatedAt: 1_000_000, durationMs: 5_000 },
  { updatedAt: 1_180_000, durationMs: 5_000 },
];
assert(resolveRunStartMs(replayed) === 995_000, "the earliest step start anchors the run");
assert(resolveRunSeconds(replayed) === 185, "the span covers the gap between steps, not just their durations");

// A live run: the first step has a local anchor and no duration yet.
assert(resolveRunStartMs([{ startedAt: 500, updatedAt: 900 }]) === 500, "a running step anchors on startedAt");

// A trace written before the server stamped timestamps must not fabricate a duration.
assert(resolveRunStartMs([{}, {}]) === null, "no timestamps means no anchor");
assert(resolveRunSeconds([{}, {}]) === 0, "no timestamps means no elapsed claim");
assert(resolveRunSeconds([{ updatedAt: 5_000, durationMs: 0 }]) === 0, "a zero-length run reports zero, not NaN");
assert(resolveRunSeconds([{ startedAt: 1_000, updatedAt: 1_400 }]) === 1, "a sub-second run reads 1s, like its steps");

// The live line: each step moves to the next phrase, never the one before it, and runs do not share an opener.
for (let step = 0; step < 20; step += 1) {
  const now = pickMariPhraseIndex(8, "start:1000", step);
  const next = pickMariPhraseIndex(8, "start:1000", step + 1);
  assert(now >= 1 && now <= 8, "a phrase index stays inside its group");
  assert(now !== next, "the next step never repeats the phrase before it");
}
const openers = new Set(Array.from({ length: 40 }, (_, run) => pickMariPhraseIndex(8, `start:${run * 1_000}`, 0)));
assert(openers.size > 1, "the first phrase differs between runs");

console.log("mari-work-card-timing: ok");
