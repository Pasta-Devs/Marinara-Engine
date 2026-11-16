// Agent retries: which failed results are retried automatically, and a retry cancelled during setup stops before it
// writes anything.
import assert from "node:assert/strict";
import { runRetrySetupPhase } from "../../../packages/server/src/routes/generate/retry-agents-route.js";
import { shouldAutomaticallyRetryAgentResult } from "../../../packages/server/src/routes/generate/agent-result-capabilities.js";

assert.equal(
  shouldAutomaticallyRetryAgentResult({ success: false, error: "The operation was aborted due to timeout" }),
  false,
  "timed-out agents should settle as failures instead of starting another full timeout window",
);
assert.equal(
  shouldAutomaticallyRetryAgentResult({ success: false, error: "Agent returned invalid JSON" }),
  true,
  "ordinary agent failures should retain the existing one-time automatic retry",
);
assert.equal(
  shouldAutomaticallyRetryAgentResult({ success: true, error: null }),
  false,
  "successful agents should never enter the automatic retry queue",
);
const preAbortedRetrySetup = new AbortController();
preAbortedRetrySetup.abort();
let preAbortedRetrySetupRan = false;
await assert.rejects(
  runRetrySetupPhase(preAbortedRetrySetup.signal, async () => {
    preAbortedRetrySetupRan = true;
  }),
  /aborted/iu,
);
assert.equal(preAbortedRetrySetupRan, false, "A cancelled retry must not start another setup phase");
let releaseRetrySetupPhase: () => void = () => undefined;
let markRetrySetupPhaseStarted: () => void = () => undefined;
const retrySetupPhaseStarted = new Promise<void>((resolve) => {
  markRetrySetupPhaseStarted = resolve;
});
const inFlightRetrySetupAbort = new AbortController();
const inFlightRetrySetup = runRetrySetupPhase(inFlightRetrySetupAbort.signal, async () => {
  markRetrySetupPhaseStarted();
  await new Promise<void>((resolve) => {
    releaseRetrySetupPhase = resolve;
  });
});
await retrySetupPhaseStarted;
inFlightRetrySetupAbort.abort();
releaseRetrySetupPhase();
await assert.rejects(
  inFlightRetrySetup,
  /aborted/iu,
  "A retry cancelled during setup must stop before the next write or event",
);
