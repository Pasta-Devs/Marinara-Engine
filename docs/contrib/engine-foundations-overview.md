# Engine foundations: overview of the series

This page maps the engine foundations contribution (issue #6624). The work was first opened as one large pull request; it is now split into eight smaller ones, labelled A to H below, so each can be reviewed on its own. Every piece builds on code that is already in Marinara Engine and already works well. Nothing here renames an upstream API, replaces the shared logger or changes a file's conventions. Where a piece changes behaviour for everyone, that is said plainly. Everything else is off until you turn it on.

## The pull requests

| PR    | Contents                                                                                                                                                                                                                       | Depends on                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **A** | Foundations: isolated regression runs, request id trail and startup timeline, two opt-in lorebook settings, opt-in robustness settings and runtime diagnostics, the startup inject gate, feature switches, best-effort helpers | Nothing (this PR)                           |
| **B** | Dev MCP for coding assistants (`tools/dev-mcp/`)                                                                                                                                                                               | Nothing                                     |
| **C** | Ctrl+K command palette and the "?" keyboard shortcuts overlay (client only, no switch)                                                                                                                                         | Nothing                                     |
| **D** | Reviewed server fixes, part 1: routes and middleware; storage recovery, chat and generate routes, importers, sidecars and SSRF                                                                                                 | A                                           |
| **E** | Reviewed server fixes, part 2: services and storage                                                                                                                                                                            | A                                           |
| **F** | Prompt caching: Claude subscription cache marker fix, Agent SDK update, cache-friendly prompt layout, low-cache send warning, cache diagnostics                                                                                | A                                           |
| **G** | Generation jobs that keep running when the tab closes, the jobs viewer, and the Windows console tray                                                                                                                           | A (its command palette action also needs C) |
| **H** | Engine diagnostics and launcher: build integrity check, memory telemetry, prompt debug files, background call cap, launcher backup and open-when-ready, reasoning-off retry                                                    | A                                           |

A, B and C are independent and can be reviewed in any order. D to H follow after A: they read A's feature switch registry (`isFeatureEnabled`, Settings > Advanced > Features), log through A's logging trail and best-effort helpers, or extend A's startup timeline and runtime diagnostics route. Each of them adds its own switch rows, CHANGELOG lines and section of this page.

For each piece in A you will find: what exists today, what this adds, what stays exactly the same, how to check it yourself and how to turn it off or revert it.

Defaults: anything that changes stored data, prompts, retries or what the server starts is off by default, behind either an environment setting or a switch in **Settings > Advanced > Features** (A6). With nothing turned on, upstream behaviour is unchanged. The pieces with no switch are bug fixes, the test runner and additive helpers; each says so.

Reverting: A's commits are ordered, and later ones touch a few of the same files (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Reverting from the newest commit backward avoids conflicts.

Most checks use the existing regression runner. Build the shared package once first (`pnpm build:shared`), then run the commands from the repository root.

---

# PR A: Foundations

> **Rebased onto the Decision models update.** Decision calls already run inside the request that needs them, so they carry its `requestId`. The decision and utility sidecar processes start in a root log context (their later lines do not carry the first requester's id), a failing decision slot writes one rate-limited warning instead of several per turn, user aborts log at info, and dropped decision statements are counted at warn with the text only at debug. Shutdown stops both sidecars as named steps. Decision calls do not go through the provider retry wrapper, so nothing is retried twice.

## A1. Test harness: each regression file runs in its own data folder

**What exists today.** `scripts/run-regressions.mjs` discovers every regression and runs them one by one through `runRegression()`, with good timeout and signal handling (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Each child gets the developer's full `process.env`. The server already supports pointing its `.env` elsewhere through `MARINARA_ENV_FILE` (`getEnvFilePath()` in `packages/server/src/config/runtime-config.ts`), and `e2e/start-servers.mjs` already isolates its servers this way.

**What this adds.** One small helper, `regressionEnvironment(scratchDir)`. `runRegression()` makes a temporary folder per file (`marinara-regression-*` in the OS temp folder) and gives the child `DATA_DIR`, `FILE_STORAGE_DIR` and `MARINARA_ENV_FILE` inside it. The folder is removed when the file finishes, whether it passed, failed, timed out or failed to start. A regression that forgot to isolate itself can no longer read the developer's `.env` or collide with the writer lease on their real data folder.

**What stays exactly the same.** Every existing function, the `--filter` and `--list` flags, timeouts, the summary output, the `package.json` scripts and CI. A regression that sets these variables itself still uses its own values. One developer-visible difference: if you export `DATA_DIR`, `FILE_STORAGE_DIR` or `MARINARA_ENV_FILE` in your shell, the runner now replaces them for each file. That is the point of the change, and it only affects test runs.

**How to check it yourself.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Then look in your temp folder: no `marinara-regression-*` folder should be left.

**How to turn it off / revert.** There is no switch; isolation is the default. Reverting the test runner commit restores the old runner (revert the newer commits first; they only share `CHANGELOG.md` and `CONTRIBUTING.md` with it). If you would like an opt-out, something like `MARINARA_REGRESSION_INHERIT_STORAGE=1` would be a few lines; it was left out so as not to add settings nobody asked for.

---

## A2. Logging: follow one request, one boot and one failure

**What exists today.** `packages/server/src/lib/logger.ts` exports one shared Pino `logger`, with `protectTerminalLogger` keeping a closed terminal from crashing the server and `logDebugOverride` powering the UI debug toggle. The Logging section of `CONTRIBUTING.md` sets clear rules: shared logger only, error object first, format specifiers, and a four-level table. These are good rules and this piece follows all of them. In `app.ts`, `buildApp()` gave Fastify its own logger options, so Fastify created a second Pino instance with the same level, and request ids were Fastify's `req-1`, `req-2` counter that restarts on every boot.

**What this adds.** Full details are in `docs/development/logging.md`, which the Logging section of `CONTRIBUTING.md` now links to.

- Fastify is built on the shared logger (`loggerInstance: logger`). `req.log` lines now use the same serializers and follow `LOG_LEVEL` hot reloads (`followLogLevel`, unsubscribed when the app closes). This is what `CONTRIBUTING.md` already described.
- A request id trail. Every line a request causes carries `requestId`, including shared-logger lines deep in services (`lib/log-context.ts`, an `AsyncLocalStorage` context plus a Pino mixin). The id is a UUID, or a well-formed client `x-request-id`, and it is returned in the `x-request-id` header so a bug report can quote it.
- Every line carries `bootId`, so two runs in one log file can be told apart.
- A startup timeline (`lib/startup-timeline.ts`). Boot steps in `app.ts` and `index.ts` are wrapped in `startup.phase("name", fn)`. One `[startup] Ready in N ms` line at info lists the slowest steps, and a failed boot names the step it failed in.
- One line per failure. Provider and tool code rethrows instead of logging and rethrowing, so one failed generation writes one error line instead of several. User stops are logged at info through `failureLevel(err)`. Errors keep their `cause` chain in the log.
- Repeating failures (health checks, scheduler polls, prompt-context contributors) go through `logRateLimited` with a `suppressedRepeats` count.
- Model output, dice requests, Spotify token bodies and video poll bodies move to debug; warn lines give their length instead.
- Three regressions: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**What stays exactly the same.** The `logger` export, its file name, `protectTerminalLogger`, `logDebugOverride`, the `pid` and `hostname` fields and every existing `logger.*` and `req.log` call. Fastify's `LogController` is extended through a subclass, not replaced. `LOG_LEVEL` (default `warn`) and `LOG_DISABLE_REQUEST_LOGGING` work as before. The `pnpm dev` console shows no new fields, because pino-pretty hides `bootId` along with its default `hostname`. `CONTRIBUTING.md` is only added to.

Behaviour changes, all described in `logging.md`:

- The request id field is `requestId` instead of Fastify's default `reqId`. A saved filter on `reqId` needs the new name.
- The incoming-request and not-found lines drop the query string (a query can hold a token). Other `req` fields stay, and `route` is added.
- A new `Client aborted request` line at info. `LOG_DISABLE_REQUEST_LOGGING` turns it off too.
- A boot step whose own time (`selfMs`, without nested steps) is over 15 s logs at warn, which is visible at the default level. Steps nest (`app.build` wraps the steps inside `buildApp`), but the level follows each step's own time, so one slow step shows as one line.

**How to check it yourself.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

Or run the server, send any request and `grep` the returned `x-request-id` value in the log.

**How to turn it off / revert.** `LOG_DISABLE_REQUEST_LOGGING=true` silences the request lines as before, and the default `LOG_LEVEL=warn` already hides the new info lines. To remove the whole piece, revert the logging commit (after reverting the newer code commits).

---

## A3. Performance

Both items are off by default. With them off, the prompt and the stored data are byte-for-byte what they are today. Both are documented in `.env.example` and in a Lorebooks table in `docs/CONFIGURATION.md`.

### A3a. Stable lorebook group winners (`LOREBOOK_STABLE_GROUP_WINNERS`, switch `stableLorebookGroupPicks`)

**What exists today.** `applyGroupSelection()` in `packages/server/src/services/lorebook/keyword-scanner.ts` picks one winner per inclusion group with a weighted roll (`pickWeightedGroupEntry`), preferring sticky entries. The random source is injectable (`random`, defaulting to `Math.random`), which made this change easy. Because the roll happens every generation, the winner can change between turns even when nothing else did, which changes the prompt prefix and breaks provider prompt caching.

**What this adds.** An optional `groupSeed` on `applyGroupSelection` and `ScanOptions`. With the setting on, `processLorebooks` passes the chat id, so the same activated candidates give the same winner every turn in that chat. Different chats and different candidate sets still vary. The seeded source is upstream's `stableHash` + `createSeededRandom` pair (the one the Active Context preview already used), moved unchanged from `lorebooks.routes.ts` into a small shared `lorebook/seeded-random.ts` so both use one generator. Since A6 it is also the **Stable lorebook picks** switch; the environment variable still wins when set.

**What stays exactly the same.** Function names and signatures (the new parameter is optional), sticky handling and weights. An injected random source still drives probability gates; with the setting on, the seed decides group winners even then, so the Active Context preview shows the same winner as generation. With the setting off, no seed is passed and the code path is the old one.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` (checks the variable and the switch).

**How to turn it off / revert.** Leave `LOREBOOK_STABLE_GROUP_WINNERS` unset and the switch off.

### A3b. Compact stored lorebook scans (`LOREBOOK_COMPACT_STORED_SCANS`)

**What exists today.** Every generated message stores the full text of each activated lorebook entry in `extra.lorebookScan`, on the message row and again on each swipe. This is what lets Active Context show exactly what built a reply, which is a good feature. In long chats with large lorebooks it also makes the message tables much bigger than the chat itself.

**What this adds.** With the setting on, the newest assistant or narrator message in a chat (the one Active Context and agent retries read) keeps the full text on its row and all its swipes, so swiping back still shows the text that built that swipe. A scan saved on an impersonated user turn is compacted and never takes that place. Older messages keep entry ids, names, keys and scores only. Compaction never runs on the generation save path: a background task compacts the previous message, one message queue at a time, and failures are logged with `logRateLimited` and retried on the next save. If newer messages are deleted, Active Context (`lorebooks.routes.ts`) and agent retries (`retry-agents-route.ts`, through `storedContentForTextlessScanEntries`) fall back to the entry's current stored text. `scripts/compact-lorebook-scans.mjs` applies the same rule to older chats: dry run by default, refuses to run while the server holds the writer lease, and backs up both tables before `--apply`.

**What stays exactly the same.** With the setting off, nothing new is written and the stored shape is identical to today's. The scan format, the Active Context route and the retry route keep their responses; the fallback only runs when a scan has no text. Two small changes reach the default path, and only for old scans stored without entry text: Active Context shows the entry's stored text where it showed an empty string, and agent retries include such entries with their stored text instead of dropping them.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` (default shape unchanged, swipe-back, impersonated turns, the first-save sweep of messages stored earlier, Active Context fallback through the real route, and the maintenance script).

**How to turn it off / revert.** Leave `LOREBOOK_COMPACT_STORED_SCANS` unset or `false`. Messages already compacted stay compact (the newest message always keeps its text). If you ran the maintenance script with `--apply`, its table backups can restore the older shape.

---

## A4. Robustness

Every behaviour change here is an environment setting that defaults to off, documented in a Robustness table in `docs/CONFIGURATION.md` and in `.env.example`. The areas touch separate files, so each can be reviewed, split out or reverted alone. New parameters and fields are optional, and `isRateLimitError` and `base-provider.ts` are untouched by this commit.

### A4a. Storage writes

**What exists today.** `packages/server/src/db/file-backed-store.ts` flushes each dirty shard and `manifest.json` with `serializeTableRows()` and `atomicWriteFile()`, keeping a `.bak` for recovery. The atomic write and backup design is solid and is kept as is.

**What this adds.**

- `STORAGE_SKIP_UNCHANGED_WRITES`: a flush skips a write when the content equals this process's last durable write and the file on disk still has that write's size and mtime. A file recovered from `.bak` is always rewritten.
- `STORAGE_YIELDING_SERIALIZE`: large shards are serialized in 12 ms slices that yield to the event loop, so a save of a very long chat does not stall other requests. The output is byte-identical to `serializeTableRows`.

**What stays exactly the same.** With both off: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile`, as before. Every real write still goes through `atomicWriteFile`.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**How to turn it off / revert.** Leave both settings unset.

### A4b. Windows boot

**What exists today.** The writer lease identifies the OS boot with `readBootId()` in `file-backed-store.ts`, which runs PowerShell on every start (about 1.5 to 2 s on Windows), plus a `reg.exe` identity probe.

**What this adds.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID`: the probe result is cached per OS boot, with its exact output, in `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). Nothing is written under `LOCALAPPDATA`.
- Always on: the `reg.exe` and PowerShell probes pass `windowsHide`, so a server started without a console no longer flashes a window. This has no other effect.

**What stays exactly the same.** The lease logic and the probe itself; with the setting off the probe runs every start as today.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**How to turn it off / revert.** Leave the setting unset, or delete `.writer-boot-id.json`.

### A4c. Shutdown

**What exists today.** `packages/server/src/index.ts` handles SIGINT and SIGTERM (plus SIGHUP off Windows) with one `shutdown(signal)`, ignores repeats with a warn line, arms the 8 s `armShutdownDeadline`, and awaits every runtime stop before `closeDB()`. This careful ordering is kept.

**What this adds.** `lib/shutdown-signals.ts` and `lib/shutdown-steps.ts`, used by `index.ts` and `app.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break and closing the console run the same graceful shutdown, with deadlines that fit the roughly 5 s Windows allows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: a second Ctrl+C more than 1.5 s after the first forces exit.
- `SHUTDOWN_EARLY_FLUSH`: pending saves start flushing as soon as a stop signal arrives. A failed early flush is not logged again here: the store already logged it and the store close retries it.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (max 2500, default 0 = wait for all): on a stop signal, `closeDB()` runs once the budget has passed even if a runtime stop hangs. Both settings apply to signal shutdowns only; the Advanced Settings restart in `admin.routes.ts` is unchanged.
- Always on: the three runtime stops are named, so a failed or slow (over 1 s) stop is logged with its stage.

**What stays exactly the same.** With every setting off: the same signals, repeats ignored, every runtime stop awaited before `closeDB()`, the same 8 s deadline.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**How to turn it off / revert.** Leave the settings unset (the first two need a restart, and the env watcher says so).

### A4d. Provider retry on transient network errors (`PROVIDER_RETRY_TRANSIENT_ERRORS`, switch `providerRetry`)

**What exists today.** `RateLimitAwareProvider` in `packages/server/src/services/llm/rate-limit-aware-provider.ts` retries rate limits with backoff up to `MAX_RATE_LIMIT_RETRIES` and honours `Retry-After`. `connection-fallback-provider.ts` switches to a fallback connection. Both work well; a refused connection or a gateway 502 simply failed the generation.

**What this adds.** A refused or unreachable connection, or a gateway 502 or 503, is retried at most twice with a 0.5 to 2 s jittered wait (`Retry-After` honoured up to 5 s), and only before any text or reasoning reached the user. A 504 or a socket reset is never retried. It never applies to the primary leg of a connection that has a usable fallback (`transientRetry: false`), so fallback stays as fast as before. A primary that already carries its own retry wrapper (a capability package passing one to `llm.withFallback`) is opted out as well. Since A6 it is also the **Retry failed provider calls** switch; the environment variable still wins when set.

**What stays exactly the same.** Rate-limit handling: same schedule, no jitter, same callbacks. `isRateLimitError` and `base-provider.ts` are untouched.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**How to turn it off / revert.** Leave the setting unset and the switch off.

### A4e. Runtime diagnostics

**What exists today.** `packages/server/src/routes/admin.routes.ts` offers privileged admin routes such as `/request-timeouts`. There is no single read-only view of storage and capability-runtime state.

**What this adds.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), behind `requirePrivilegedAccess`, `no-store` and its own rate limit (30 requests a minute): storage residency counts, dirty tables, last flush error, and whether each capability package runtime is live with its last activation failure. It reads through new optional hooks: `getStorageStats()` on the store controller, `getFileStoreStats()` in `db/connection.ts` and `runtimeState()` on `CapabilityModuleRuntime`.

**What stays exactly the same.** It only reads. No existing route, response or access rule changes.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics`, or open `/api/admin/runtime-diagnostics` on a local server with privileged access.

**How to turn it off / revert.** The route is inert unless called. To remove it, drop the route in `admin.routes.ts` and `lib/runtime-diagnostics.ts`.

### Two catches that used to be silent

Following the CONTRIBUTING level guidelines, two catches that swallowed errors now log at warn: the SillyTavern chat header parse in `import.routes.ts` (only the error type, since a JSON parse message can quote chat text) and the agent activation question transport (rate limited).

---

## A5. Startup: internal requests wait until route registration has ended

This one is a bug fix, not a setting. It is always on.

**What exists today.** `buildApp()` in `packages/server/src/app.ts` registers the core routes, then awaits `capabilityModuleRuntime.start(app)`, which activates each installed package in turn through `activateOne()` in `services/capability-packages/capability-module-runtime.service.ts`, and later starts `startServerAutonomousScheduler(app)`. Several places reach routes in-process with `app.inject()`: packages through `runCapabilityInternalRoute()` in `capability-route-registration.service.ts`, the autonomous scheduler in `server-autonomous-scheduler.service.ts`, and `routes/generate/prompt-preview.ts`. Fastify boots the whole instance on the first `inject()`, and after that no route, hook or plugin can be added. So if a background task (a package timer or a worker started early) called `inject()` while `buildApp()` was still registering, every later package failed with "Root plugin has already booted", and the next `addHook` threw and stopped the server. When an activation fails, the `catch` in `activateOne()` logs an error and then either rolls the package back with `capabilityPackageManager.rollbackRuntime()` or persists status and readiness `"error"`. For this failure that meant a healthy package could stay rolled back or marked `"error"` on later starts, although the package itself was fine.

**What this adds.**

- `lib/fastify-inject-gate.ts`. `buildApp()` calls `holdInjectUntilRegistered(app)` right after creating the instance and releases it just before `return app`. Any `app.inject()` made before then, promise or callback style, is held and runs once registration has ended, so it also reaches routes that were added after it was called. A held callback-style call whose `inject()` throws hands the error to its callback.
- A package's `activate()` and `selfCheck()` are part of registration, so an internal route they await would wait forever. `activateOne()` now runs both inside `failInjectFastDuring()`: an `inject()` made directly from them fails at once with `InjectDuringRegistrationError` (its `code` is `MARINARA_INJECT_DURING_REGISTRATION`). Only that package fails to activate and startup carries on. Timers the package starts that fire after `activate()` has returned are held like any other background call.
- Any other held call logs a warning with the caller's stack after 60 s and is rejected with the same error after 10 minutes, so a stuck startup fails loudly instead of hanging. These timers are unref'd, so they never keep a process alive.
- `isHostLifecycleActivationError()` in `capability-module-runtime.service.ts` recognises the two Fastify lifecycle errors (`AVV_ERR_ROOT_PLG_BOOTED`, "Root plugin has already booted", and `FST_ERR_INSTANCE_ALREADY_LISTENING`, "Fastify instance is already listening"). When activation fails with one of them, the package is not rolled back and no `"error"` status or readiness is persisted: the installed version and status stay as they were, so the next start activates it normally. The failure is logged once, at warn, and still recorded for the runtime diagnostics route. Every other activation failure keeps its error line, rollback and `"error"` status exactly as before.
- One regression: `startup-inject-gate`.

**What stays exactly the same.** Once `buildApp()` has returned, `app.inject()` is Fastify's own call again, with no wrapper logic. The chained form (`app.inject()` with no arguments) is never held. Registration order, the routes themselves, `runCapabilityInternalRoute()` and the autonomous scheduler are unchanged, and activating or updating a package after startup works as it does today. One case reaches the running server: if a package activated from the UI after the server is listening adds a route the server does not have yet, Fastify throws `FST_ERR_INSTANCE_ALREADY_LISTENING` as before, but now the new version stays installed (it activates on the next start) instead of being rolled back. The caller still receives the error.

**How to check it yourself.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

It checks that a held call runs after release and reaches a route added later, the callback style, the fail-fast path inside `activate()`, a timer started from `activate()`, the 10 minute limit (with short test values), where `buildApp()` installs and releases the gate, and that a host lifecycle error returns before rollback and is logged once as a warning.

**How to turn it off / revert.** There is no switch. `MARINARA_INJECT_DURING_REGISTRATION` is only the error code on `InjectDuringRegistrationError`, not a setting. To remove the fix, revert the startup inject gate commit.

---

## A6. Feature switches: Settings > Advanced > Features

**What exists today.** Optional server behaviours are environment variables (see A3 and A4). There is no place in the UI to turn one on, and each new option would need its own setting, route and UI.

**What this adds.** One registry and one settings section. The later pull requests F, G and H add their own switches to it. Full details are in `docs/configuration/features.md`.

- The registry is `packages/shared/src/schemas/feature-settings.schema.ts`: switch names and defaults, stored together as one JSON object in the `features` app setting. Only values that differ from the default are saved.
- This PR registers two switches, both for behaviour it adds itself: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a) and **Retry failed provider calls** (`providerRetry`, A4d).
- On the server, `isFeatureEnabled()` in `services/features/feature-settings.ts` reads an in-memory copy, so busy paths pay nothing. The copy is loaded when the app-settings routes register and refreshed on every write or removal of the row, after Professor Mari database commands that touch it, and after a `.env` reload. `GET` and `PUT /api/app-settings/features`; `PUT` validates strictly.
- Environment variables still win when set, both on and off. `LOREBOOK_STABLE_GROUP_WINNERS` and `PROVIDER_RETRY_TRANSIENT_ERRORS` now pin the two switches instead of being read on their own.
- The client lists every switch in Settings > Advanced > Features and shows a switch pinned by an environment variable as locked with the variable's name. Other components use `useFeatureEnabled()`.

**What stays exactly the same.** Every switch defaults off, so an install that never opens the section behaves exactly as before. An environment variable that was set before keeps the same effect.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter feature-settings` (registry and defaults, normalization, env precedence, routes, storage and Mari-style invalidation, listeners). In the app: Settings > Advanced > Features, or search settings for `features`.

**How to turn it off / revert.** Leave both switches off, or unset the environment variables. Reverting the feature switches commit removes the mechanism; the two environment variables then work on their own as before.

---

## A7. Logged best-effort helpers

This is an additive helper with no switch and no behaviour change on its own.

**What exists today.** A few places deliberately ignore a failure (a cleanup, a cursor advance, a cache write) with an empty `catch`. That is the right behaviour, but the failure leaves no trace in the log.

**What this adds.** `packages/server/src/lib/best-effort.ts` with `logSuppressed`, `orFallback` and `bestEffort`. A deliberately swallowed failure is logged through `logRateLimited` (A2), at most one line a minute per event, chat and stage. The reviewed fixes in D and E use it for the empty catches they replace.

**What stays exactly the same.** Nothing calls it yet in this PR, so no existing code path changes.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter best-effort`.

**How to turn it off / revert.** There is no switch. Reverting the helpers commit removes the file.

---

# Coming in later pull requests

These sections are short on purpose. Each pull request fills in its own section, with the same five parts, when it is opened.

## PR B: Dev MCP for coding assistants

An optional Dev MCP server under `tools/dev-mcp` for coding assistants working on Marinara locally, outside the pnpm workspace and the Docker image. It uses the request id trail from A2 to follow a request through the logs. Setup and checks are in `tools/dev-mcp/README.md`, which PR B adds.

## PR C: Command palette and keyboard shortcuts overlay

Coming in PR C. A Ctrl+K command palette and a "?" overlay listing the app's keyboard shortcuts. Client only, no switch, no change to existing bindings.

## PR D: Reviewed server fixes, part 1

Coming in PR D. Route and middleware fixes, plus storage recovery, chat and generate routes, importers, sidecars and SSRF fixes, each with its own regression. Bug fixes, no switch.

## PR E: Reviewed server fixes, part 2

Coming in PR E. Service and storage fixes, each with its own regression. Bug fixes, no switch.

## PR F: Prompt caching

Coming in PR F. The Claude subscription history cache marker fix, the Claude Agent SDK update, a cache-friendly prompt layout (switch, off by default), a per-chat warning before a low-cache send (off by default) and opt-in cache diagnostics.

## PR G: Generation jobs and console tray

Coming in PR G. Image, sprite and video jobs that keep running when the tab closes, with a jobs viewer (switch, off by default), and a Windows console tray icon (switch, off by default).

## PR H: Engine diagnostics and launcher

Coming in PR H. A build integrity check at startup, runtime memory telemetry, opt-in prompt debug files, a background call cap (switch, off by default), launcher safety steps and a retry without reasoning-off for models that always reason.

---

## Test results for PR A on the development machine

Checked on the base `staging` commit `dd876831a`. No paid model calls were made.

- **Node regressions on Linux**, the way the `complete-node-regressions` CI job runs them (Ubuntu 24.04 under WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): all 384 files pass. On busier runs of the same machine, `server-signal-shutdown` sometimes hit its 30 s timeout, as it also does on plain `staging` there, and a few timing-sensitive files (`smart-group-decision`, `agent-activation-questions`, `advanced-memory-core`) each failed once and passed on every rerun.
- **Node regressions on Windows**: 379 of 384 files pass. The other five (`decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`, `storage-writer-lock`) fail the same way on plain `staging` on the Windows test machine; their causes are local (Windows file locking, console signals, a disk-space check).
- **Type checks, lint, formatting and builds**: `tsc --noEmit` for shared, server, client, the root project and the token estimation project; lint with 0 errors; Prettier on `packages/**/*.{ts,tsx}`; the locale and static JSX localization checks; client and server builds.
- **Browser tests** for the settings surfaces (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) on the `mobile-chromium` project: 171 passed, 0 failed. On `mobile-webkit` (WebKit on Windows) the failures that remained on a rerun fail the same way on plain `staging`.
- **Features section** checked by eye in the default and SillyTavern themes, light and dark, at desktop and phone sizes.
