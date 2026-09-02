// #5719: Professor Mari must survive backgrounding the way regular chats do.
//
// The server always ran Mari's whole agent loop to completion and persisted it
// (the /prompt route deliberately ignores passive disconnects). What died was
// the CLIENT: its stream-death handling recovered from exactly one error class
// (StreamResumeDisconnectError, the visible-tab watchdog), while regular chat
// recovers from ANY plain transport error after the page was hidden. Android
// browsers tear down a hidden tab's connection with a bare TypeError, so Mari
// toasted "could not answer right now" and never reloaded the reply the server
// went on to persist. A cleanly closed socket (no error, no events) was worse:
// an immediate false "did not receive a reply" with no recovery at all.
//
// The fix: one shared passive-disconnect classifier in api-client used by both
// paths, hidden-page tracking inside Mari's send closure, a settle-and-confirm
// pass when the stream closes cleanly without a reply, and a status-poll
// recovery effect that reloads the persisted reply when a run this client is
// no longer attached to finishes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── One classifier, shared ──────────────────────────────────────────────────
const apiClient = readSource("packages/client/src/lib/api-client.ts");
assert.match(apiClient, /export function isPassiveStreamDisconnect\(/u, "the classifier must live in api-client");
assert.match(apiClient, /if \(error instanceof StreamResumeDisconnectError\) return true;/u);

const useGenerate = readSource("packages/client/src/hooks/use-generate.ts");
assert.match(useGenerate, /import \{ api, ApiError, isPassiveStreamDisconnect \} from "\.\.\/lib\/api-client";/u);
assert.doesNotMatch(
  useGenerate,
  /function isPassiveStreamDisconnect/u,
  "use-generate must not keep a private copy of the classifier",
);

// ── Mari's send closure uses it, with hidden-page tracking ──────────────────
const mariChat = readSource("packages/client/src/components/chat/HomeProfessorMariChat.tsx");
assert.match(mariChat, /isPassiveStreamDisconnect\(error, pageWasHiddenDuringStream, controller\.signal\)/u);
assert.doesNotMatch(
  mariChat,
  /error instanceof StreamResumeDisconnectError/u,
  "Mari must not special-case only the watchdog error class",
);
assert.match(mariChat, /let pageWasHiddenDuringStream = /u);
assert.match(
  mariChat,
  /document\.addEventListener\("visibilitychange", recordBackgroundedStream\);\s*\n\s*window\.addEventListener\("pagehide", markPageHidden\);/u,
);
assert.match(
  mariChat,
  /document\.removeEventListener\("visibilitychange", recordBackgroundedStream\);\s*\n\s*window\.removeEventListener\("pagehide", markPageHidden\);/u,
);

// ── Clean close without a reply settles before it toasts ────────────────────
assert.match(mariChat, /if \(!received && !controller\.signal\.aborted\) \{/u);
assert.match(
  mariChat,
  /received = await waitForWorkspaceRunToSettle\(effectiveConnectionId, controller\.signal\);/u,
  "a cleanly closed no-reply stream must confirm against the status endpoint",
);
assert.match(
  mariChat,
  /waitForWorkspaceRunToSettle\(connectionId: string \| null, signal: AbortSignal\): Promise<boolean>/u,
);
assert.match(mariChat, /sawActiveRun/u);
// One early inactive reading is not proof the run never started - the prompt
// route does storage work before flipping active. Two readings are required.
assert.match(mariChat, /inactiveReadings \+= 1;/u);
// A server-reported SSE error is a REAL failure, never a passive disconnect.
assert.match(mariChat, /class MariWorkspaceRunError extends Error/u);
assert.match(mariChat, /if \(error instanceof MariWorkspaceRunError\) throw error;/u);
// Callers suppress the "no reply" toast when visibility history makes a
// false negative likely; the reload is the authoritative surface.
assert.match(mariChat, /hiddenDuringStream: pageWasHiddenDuringStream/u);
assert.match(mariChat, /!received && !hiddenDuringStream/u);

// ── Detached-run recovery on status transition ──────────────────────────────
// Arming requires two observations of a remote-active run with no local
// closure (one is routinely the stale value a local run leaves behind), and
// both fire and reload are pinned to the armed run id.
assert.match(mariChat, /detachedRunArmingRef/u);
assert.match(mariChat, /armed\.observations >= 2/u);
assert.match(mariChat, /workspaceRunIdRef\.current === armedRunId/u);
assert.match(
  mariChat,
  /Failed to reload messages after a detached workspace run/u,
  "the status-poll effect must reload the persisted reply for runs this client is not attached to",
);

// ── The server side of the contract this relies on ──────────────────────────
const mariRoutes = readSource("packages/server/src/routes/professor-mari-workspace.routes.ts");
assert.match(
  mariRoutes,
  /clientDisconnected = true/u,
  "the prompt route must keep finishing runs after a passive disconnect",
);

console.log("Mari background-stream regression passed.");
