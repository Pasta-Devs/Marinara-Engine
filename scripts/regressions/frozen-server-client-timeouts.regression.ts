import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isRequestTimeoutError, requestTimeoutSignal } from "../../packages/client/src/lib/api-client";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// ── requestTimeoutSignal: deadline fires with a distinguishable reason ──
{
  const signal = requestTimeoutSignal(20);
  assert.equal(signal.aborted, false, "the signal must start unaborted");
  await wait(60);
  assert.equal(signal.aborted, true, "the deadline must abort the signal");
  assert.ok(isRequestTimeoutError(signal.reason), "a deadline abort must carry the TimeoutError reason");
}

// ── upstream cancellation wins and is NOT classified as a timeout ──
{
  const upstream = new AbortController();
  const signal = requestTimeoutSignal(1_000, upstream.signal);
  upstream.abort(new DOMException("The user aborted a request.", "AbortError"));
  assert.equal(signal.aborted, true, "an upstream abort must propagate immediately");
  assert.equal(
    isRequestTimeoutError(signal.reason),
    false,
    "React Query's own cancellation must never be mistaken for a frozen server",
  );
}

// ── an already-aborted upstream propagates synchronously ──
{
  const upstream = new AbortController();
  upstream.abort();
  const signal = requestTimeoutSignal(1_000, upstream.signal);
  assert.equal(signal.aborted, true, "a pre-aborted upstream must yield a pre-aborted signal");
}

// ── no timeout fires after upstream cancellation (no late TimeoutError overwrite) ──
{
  const upstream = new AbortController();
  const signal = requestTimeoutSignal(20, upstream.signal);
  upstream.abort(new DOMException("The user aborted a request.", "AbortError"));
  await wait(60);
  assert.equal(
    isRequestTimeoutError(signal.reason),
    false,
    "the reason must stay the upstream's after the deadline would have passed",
  );
}

// ── classification is strict ──
assert.equal(isRequestTimeoutError(new Error("TimeoutError")), false, "a plain Error must not classify as timeout");
assert.equal(isRequestTimeoutError(undefined), false);
assert.equal(
  isRequestTimeoutError(new DOMException("aborted", "AbortError")),
  false,
  "an AbortError is a cancellation, not a frozen server",
);

// ── source pins: the frozen-server guards stay wired (#5657/#5658) ──
const appSource = readFileSync(join(repositoryRoot, "packages/client/src/App.tsx"), "utf8").replace(/\r\n/gu, "\n");
assert.match(
  appSource,
  /if \(checkInFlight\) return;\s*checkInFlight = true;/u,
  "checkVersion must skip when a previous health check is still pending (#5658)",
);
assert.match(
  appSource,
  /signal: requestTimeoutSignal\(VERSION_CHECK_TIMEOUT_MS\)/u,
  "checkVersion's health fetch must carry a deadline via the shared helper (#5658)",
);
assert.match(
  appSource,
  /\} finally \{\s*checkInFlight = false;\s*\}/u,
  "the in-flight guard must be released on every outcome",
);

const useChatsSource = readFileSync(join(repositoryRoot, "packages/client/src/hooks/use-chats.ts"), "utf8").replace(
  /\r\n/gu,
  "\n",
);
assert.match(
  useChatsSource,
  /api\.get<Chat>\(`\/chats\/\$\{id\}`, \{ signal: requestTimeoutSignal\(CHAT_OPEN_TIMEOUT_MS, signal\) \}\)/u,
  "the chat-open fetch must compose the deadline with React Query's cancellation (#5657)",
);
assert.match(
  useChatsSource,
  /if \(isRequestTimeoutError\(error\)\) return false;/u,
  "a chat-open timeout must not be retried into a longer hang",
);

const chatAreaSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/chat/ChatArea.tsx"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  chatAreaSource,
  /chatOpenTimedOut\s*\?\s*localizeUi\("ui\.chat\.chatarea\.serverUnreachable"\)/u,
  "a timed-out chat open must render the explicit unreachable state (#5657)",
);

const settingsPanelSource = readFileSync(
  join(repositoryRoot, "packages/client/src/components/panels/SettingsPanel.tsx"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  settingsPanelSource,
  /api\.get\("\/health", \{ signal: requestTimeoutSignal\(10_000, signal\) \}\)/u,
  "the diagnostics health query must carry a deadline (#5657)",
);
assert.match(
  settingsPanelSource,
  /serverUnreachable: isRequestTimeoutError\(health\.error\)/u,
  "the diagnostics copy must flag a frozen host to the formatter",
);

const useConnectionsSource = readFileSync(
  join(repositoryRoot, "packages/client/src/hooks/use-connections.ts"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  useConnectionsSource,
  /api\.get<unknown\[\]>\("\/connections", \{ signal: requestTimeoutSignal\(10_000, signal\) \}\)/u,
  "useConnections must carry a deadline: it gates the diagnostics copy button alongside health (#5657 review)",
);
assert.match(
  useConnectionsSource,
  /!isRequestTimeoutError\(error\) && failureCount < 1/u,
  "useConnections must keep the app-wide single-retry default with the timeout carve-out",
);
assert.match(
  settingsPanelSource,
  /!isRequestTimeoutError\(error\) && failureCount < 1/u,
  "the health query must keep the app-wide single-retry default with the timeout carve-out",
);
assert.match(
  chatAreaSource,
  /chatOpenTimedOut && \([\s\S]{0,400}void refetchChatDetail\(\)/u,
  "the unreachable state must offer a Try again control (focus refetch is globally off)",
);
const supportDiagnosticsSource = readFileSync(
  join(repositoryRoot, "packages/client/src/lib/support-diagnostics.ts"),
  "utf8",
).replace(/\r\n/gu, "\n");
assert.match(
  supportDiagnosticsSource,
  /SERVER_UNREACHABLE_DIAGNOSTIC = "Unreachable \(request timed out\)"/u,
  "the formatter must own the unreachable sentinel",
);
assert.match(
  supportDiagnosticsSource,
  /Background wake lock: \$\{unreachable \? SERVER_UNREACHABLE_DIAGNOSTIC : \(diagnostics\.wakeLock \?\? "not reported"\)\}/u,
  "time-sensitive telemetry must read unreachable - never stale pre-freeze values - when the host is frozen",
);
assert.match(
  supportDiagnosticsSource,
  /Last detected freeze: \$\{unreachable \? SERVER_UNREACHABLE_DIAGNOSTIC : freeze/u,
  "the freeze line must be overridden by unreachable before any cached value",
);

const locales = JSON.parse(
  readFileSync(join(repositoryRoot, "packages/client/src/localization/locales/en.json"), "utf8"),
) as Record<string, string>;
assert.equal(typeof locales["ui.chat.chatarea.serverUnreachable"], "string");
assert.equal(typeof locales["ui.chat.chatarea.serverUnreachableHint"], "string");

console.log("Frozen-server client timeout regression checks passed.");
