# Engine foundations: what this branch adds

This page walks through the `contrib/engine-foundations` branch one piece at a time. Every piece builds on code that is already in Marinara Engine and already works well. Nothing here renames an upstream API, replaces the shared logger or changes a file's conventions. Where a piece changes behaviour for everyone, that is said plainly. Everything else is off until you turn it on.

The branch sits on top of `staging` (`1bd1e1a5f`). It started as the seven `contrib/dev-foundations` commits (sections 1 to 6) and was widened with a feature switch mechanism and the features built on it (sections 7 to 11), then with engine, logging and robustness fixes (section 12). In order:

| Commit      | Piece                                                                            | Section |
| ----------- | -------------------------------------------------------------------------------- | ------- |
| `1209ca43d` | Test harness: isolated regression runs                                           | 1       |
| `3a8ddfac8` | Logging: request id trail, startup timeline, one line per failure                | 2       |
| `496e4d00e` | Performance: two opt-in lorebook settings                                        | 3       |
| `aa939619e` | Robustness: five opt-in areas plus a read-only diagnostics route                 | 4       |
| `f94af4387` | Startup: early internal requests wait until route registration has ended         | 5       |
| `1c5548b23` | Docs: the first version of this page                                             |         |
| `5c25b2a77` | Dev MCP for coding assistants (optional tooling)                                 | 6       |
| `3ce56b535` | Feature switches in Settings > Advanced > Features                               | 7       |
| `a00746023` | Generation jobs, server side (`generationJobTracking`)                           | 8       |
| `baac8115a` | Generation jobs viewer and reattach, client side                                 | 8       |
| `4e62426e8` | Windows console tray (`consoleTray`)                                             | 9       |
| `385058156` | Ctrl+K command palette                                                           | 10      |
| `2be360952` | "?" keyboard shortcuts overlay                                                   | 10      |
| `e9e26a181` | Prompt caching: Claude subscription history cache marker fix                     | 11a     |
| `15d8d40ac` | Prompt caching: Claude Agent SDK 0.3.280                                         | 11b     |
| `2a5b77581` | Prompt caching: cache-friendly prompt layout (`cacheFriendlyPromptLayout`)       | 11c     |
| `a3a05393a` | Prompt caching: ChatGPT cache session, unused replay switch removed              | 11c     |
| `cd54d4003` | Prompt caching: per-chat warning before a low-cache send                         | 11d     |
| `6bad2b848` | Prompt caching: diagnostics, next-turn Peek Prompt preview, cache share per turn | 11e     |
| `9adf5018a` | Docs: this page, widened to sections 7 to 11                                     |         |
| `ef2769ce1` | "Open generation jobs" in the command palette                                    | 10      |
| `16f852beb` | Build integrity check at startup and after updates                               | 12a     |
| `7cc00aa34` | Runtime memory telemetry with worker gauges                                      | 12b     |
| `6b8551592` | Prompt debug files (`LOG_PROMPT_DEBUG_FILES`)                                    | 12c     |
| `13a1baaec` | Background call cap wired to an hourly budget (`backgroundCallCap`)              | 12d     |
| `64a1afdfb` | Launcher: back up untracked source files before `git clean`                      | 12e     |
| `e0656fa4d` | Launcher: open the browser once `/api/health` answers (Windows)                  | 12e     |
| `91ced8909` | Retry once without reasoning-off when a model always reasons                     | 12f     |
| `0561fa562` | Reviewed fixes: routes and middleware                                            | 12g     |
| `0ebcb1ebd` | Logged best-effort helpers                                                       | 12g     |
| `3e64168d9` | Reviewed fixes: services and storage                                             | 12g     |
| `368a045ba` | Reviewed fixes: storage recovery, chat and generate routes, importers, SSRF      | 12g     |
| `16c7159f3` | `cache` and `marinara` metadata namespaces marked engine-owned                   | 12h     |

The branch ends with the engine, logging and robustness fixes (section 12).

For each piece you will find: what exists today, what this adds, what stays exactly the same, how to check it yourself and how to turn it off or revert it.

Defaults: anything that changes stored data, prompts, retries or what the server starts is off by default, behind either an environment setting or a switch in **Settings > Advanced > Features** (section 7). With nothing turned on, upstream behaviour is unchanged. The pieces with no switch are bug fixes, the test runner and additive tools; each says so.

Reverting: the commits are ordered, and later ones touch a few of the same files (`app.ts`, `index.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`, `en.json`, `docs/configuration/features.md`). Reverting from the newest commit backward avoids conflicts.

Most checks use the existing regression runner. Build the shared package once first (`pnpm build:shared`), then run the commands from the repository root.

---

> **Rebased onto the Decision models update.** Decision calls already run inside the request that needs them, so they carry its `requestId`. The decision and utility sidecar processes start in a root log context (their later lines do not carry the first requester's id), a failing decision slot writes one rate-limited warning instead of several per turn, user aborts log at info, and dropped decision statements are counted at warn with the text only at debug. Shutdown stops both sidecars as named steps. Decision calls do not go through the provider retry wrapper, so nothing is retried twice.

## 1. Test harness: each regression file runs in its own data folder

**What exists today.** `scripts/run-regressions.mjs` discovers every regression and runs them one by one through `runRegression()`, with good timeout and signal handling (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Each child gets the developer's full `process.env`. The server already supports pointing its `.env` elsewhere through `MARINARA_ENV_FILE` (`getEnvFilePath()` in `packages/server/src/config/runtime-config.ts`), and `e2e/start-servers.mjs` already isolates its servers this way.

**What this adds.** One small helper, `regressionEnvironment(scratchDir)`. `runRegression()` makes a temporary folder per file (`marinara-regression-*` in the OS temp folder) and gives the child `DATA_DIR`, `FILE_STORAGE_DIR` and `MARINARA_ENV_FILE` inside it. The folder is removed when the file finishes, whether it passed, failed, timed out or failed to start. A regression that forgot to isolate itself can no longer read the developer's `.env` or collide with the writer lease on their real data folder.

**What stays exactly the same.** Every existing function, the `--filter` and `--list` flags, timeouts, the summary output, the `package.json` scripts and CI. A regression that sets these variables itself still uses its own values. One developer-visible difference: if you export `DATA_DIR`, `FILE_STORAGE_DIR` or `MARINARA_ENV_FILE` in your shell, the runner now replaces them for each file. That is the point of the change, and it only affects test runs.

**How to check it yourself.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Then look in your temp folder: no `marinara-regression-*` folder should be left.

**How to turn it off / revert.** There is no switch; isolation is the default. `git revert 1209ca43d` restores the old runner (revert the newer commits first; they only share `CHANGELOG.md` with it). If you would like an opt-out, something like `MARINARA_REGRESSION_INHERIT_STORAGE=1` would be a few lines; it was left out so as not to add settings nobody asked for.

---

## 2. Logging: follow one request, one boot and one failure

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

**How to turn it off / revert.** `LOG_DISABLE_REQUEST_LOGGING=true` silences the request lines as before, and the default `LOG_LEVEL=warn` already hides the new info lines. To remove the whole piece, `git revert 3a8ddfac8` (after reverting the newer code commits).

---

## 3. Performance

Both items are off by default. With them off, the prompt and the stored data are byte-for-byte what they are today. Both are documented in `.env.example` and in a Lorebooks table in `docs/CONFIGURATION.md`.

### 3a. Stable lorebook group winners (`LOREBOOK_STABLE_GROUP_WINNERS`, switch `stableLorebookGroupPicks`)

**What exists today.** `applyGroupSelection()` in `packages/server/src/services/lorebook/keyword-scanner.ts` picks one winner per inclusion group with a weighted roll (`pickWeightedGroupEntry`), preferring sticky entries. The random source is injectable (`random`, defaulting to `Math.random`), which made this change easy. Because the roll happens every generation, the winner can change between turns even when nothing else did, which changes the prompt prefix and breaks provider prompt caching.

**What this adds.** An optional `groupSeed` on `applyGroupSelection` and `ScanOptions`. With the setting on, `processLorebooks` passes the chat id, so the same activated candidates give the same winner every turn in that chat. Different chats and different candidate sets still vary. The seeded source is upstream's `stableHash` + `createSeededRandom` pair (the one the Active Context preview already used), moved unchanged from `lorebooks.routes.ts` into a small shared `lorebook/seeded-random.ts` so both use one generator. Since section 7 it is also the **Stable lorebook picks** switch; the environment variable still wins when set.

**What stays exactly the same.** Function names and signatures (the new parameter is optional), sticky handling, weights, and any injected random source. With the setting off, no seed is passed and the code path is the old one.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` (checks the variable and the switch).

**How to turn it off / revert.** Leave `LOREBOOK_STABLE_GROUP_WINNERS` unset and the switch off. The code is in `496e4d00e`.

### 3b. Compact stored lorebook scans (`LOREBOOK_COMPACT_STORED_SCANS`)

**What exists today.** Every generated message stores the full text of each activated lorebook entry in `extra.lorebookScan`, on the message row and again on each swipe. This is what lets Active Context show exactly what built a reply, which is a good feature. In long chats with large lorebooks it also makes the message tables much bigger than the chat itself.

**What this adds.** With the setting on, the newest assistant or narrator message in a chat (the one Active Context and agent retries read) keeps the full text on its row and all its swipes, so swiping back still shows the text that built that swipe. A scan saved on an impersonated user turn is compacted and never takes that place. Older messages keep entry ids, names, keys and scores only. Compaction never runs on the generation save path: a background task compacts the previous message, one message queue at a time, and failures are logged with `logRateLimited` and retried on the next save. If newer messages are deleted, Active Context (`lorebooks.routes.ts`) and agent retries (`retry-agents-route.ts`, through `storedContentForTextlessScanEntries`) fall back to the entry's current stored text. `scripts/compact-lorebook-scans.mjs` applies the same rule to older chats: dry run by default, refuses to run while the server holds the writer lease, and backs up both tables before `--apply`.

**What stays exactly the same.** With the setting off, nothing new is written and the stored shape is identical to today's. The scan format, the Active Context route and the retry route keep their responses; the fallback only runs when a scan has no text. Two small changes reach the default path, and only for old scans stored without entry text: Active Context shows the entry's stored text where it showed an empty string, and agent retries include such entries with their stored text instead of dropping them.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` (default shape unchanged, swipe-back, impersonated turns, the first-save sweep of messages stored earlier, Active Context fallback through the real route, and the maintenance script).

**How to turn it off / revert.** Leave `LOREBOOK_COMPACT_STORED_SCANS` unset or `false`. Messages already compacted stay compact (the newest message always keeps its text). If you ran the maintenance script with `--apply`, its table backups can restore the older shape. The code is in `496e4d00e`.

---

## 4. Robustness

Every behaviour change here is an environment setting that defaults to off, documented in a Robustness table in `docs/CONFIGURATION.md` and in `.env.example`. The areas touch separate files, so each can be reviewed, split out or reverted alone. All code is in `aa939619e`. New parameters and fields are optional, and `isRateLimitError` and `base-provider.ts` are untouched by this commit.

### 4a. Storage writes

**What exists today.** `packages/server/src/db/file-backed-store.ts` flushes each dirty shard and `manifest.json` with `serializeTableRows()` and `atomicWriteFile()`, keeping a `.bak` for recovery. The atomic write and backup design is solid and is kept as is.

**What this adds.**

- `STORAGE_SKIP_UNCHANGED_WRITES`: a flush skips a write when the content equals this process's last durable write and the file on disk still has that write's size and mtime. A file recovered from `.bak` is always rewritten.
- `STORAGE_YIELDING_SERIALIZE`: large shards are serialized in 12 ms slices that yield to the event loop, so a save of a very long chat does not stall other requests. The output is byte-identical to `serializeTableRows`.

**What stays exactly the same.** With both off: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile`, as before. Every real write still goes through `atomicWriteFile`.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**How to turn it off / revert.** Leave both settings unset.

### 4b. Windows boot

**What exists today.** The writer lease identifies the OS boot with `readBootId()` in `file-backed-store.ts`, which runs PowerShell on every start (about 1.5 to 2 s on Windows), plus a `reg.exe` identity probe.

**What this adds.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID`: the probe result is cached per OS boot, with its exact output, in `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). Nothing is written under `LOCALAPPDATA`.
- Always on: the `reg.exe` and PowerShell probes pass `windowsHide`, so a server started without a console no longer flashes a window. This has no other effect.

**What stays exactly the same.** The lease logic and the probe itself; with the setting off the probe runs every start as today.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**How to turn it off / revert.** Leave the setting unset, or delete `.writer-boot-id.json`.

### 4c. Shutdown

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

### 4d. Provider retry on transient network errors (`PROVIDER_RETRY_TRANSIENT_ERRORS`, switch `providerRetry`)

**What exists today.** `RateLimitAwareProvider` in `packages/server/src/services/llm/rate-limit-aware-provider.ts` retries rate limits with backoff up to `MAX_RATE_LIMIT_RETRIES` and honours `Retry-After`. `connection-fallback-provider.ts` switches to a fallback connection. Both work well; a refused connection or a gateway 502 simply failed the generation.

**What this adds.** A refused or unreachable connection, or a gateway 502 or 503, is retried at most twice with a 0.5 to 2 s jittered wait (`Retry-After` honoured up to 5 s), and only before any text or reasoning reached the user. A 504 or a socket reset is never retried. It never applies to the primary leg of a connection that has a usable fallback (`transientRetry: false`), so fallback stays as fast as before. A primary that already carries its own retry wrapper (a capability package passing one to `llm.withFallback`) is opted out as well. Since section 7 it is also the **Retry failed provider calls** switch; the environment variable still wins when set.

**What stays exactly the same.** Rate-limit handling: same schedule, no jitter, same callbacks. `isRateLimitError` and `base-provider.ts` are untouched.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**How to turn it off / revert.** Leave the setting unset and the switch off.

### 4e. Runtime diagnostics

**What exists today.** `packages/server/src/routes/admin.routes.ts` offers privileged admin routes such as `/request-timeouts`. There is no single read-only view of storage and capability-runtime state.

**What this adds.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), behind `requirePrivilegedAccess` and `no-store`: storage residency counts, dirty tables, last flush error, and whether each capability package runtime is live with its last activation failure. It reads through new optional hooks: `getStorageStats()` on the store controller, `getFileStoreStats()` in `db/connection.ts` and `runtimeState()` on `CapabilityModuleRuntime`.

**What stays exactly the same.** It only reads. No existing route, response or access rule changes.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics`, or open `/api/admin/runtime-diagnostics` on a local server with privileged access.

**How to turn it off / revert.** The route is inert unless called. To remove it, drop the route in `admin.routes.ts` and `lib/runtime-diagnostics.ts`.

### Two catches that used to be silent

Following the CONTRIBUTING level guidelines, two catches that swallowed errors now log at warn: the SillyTavern chat header parse in `import.routes.ts` (only the error type, since a JSON parse message can quote chat text) and the agent activation question transport (rate limited).

---

## 5. Startup: internal requests wait until route registration has ended

This one is a bug fix, not a setting. It is always on.

**What exists today.** `buildApp()` in `packages/server/src/app.ts` registers the core routes, then awaits `capabilityModuleRuntime.start(app)`, which activates each installed package in turn through `activateOne()` in `services/capability-packages/capability-module-runtime.service.ts`, and later starts `startServerAutonomousScheduler(app)`. Several places reach routes in-process with `app.inject()`: packages through `runCapabilityInternalRoute()` in `capability-route-registration.service.ts`, the autonomous scheduler in `server-autonomous-scheduler.service.ts`, and `routes/generate/prompt-preview.ts`. Fastify boots the whole instance on the first `inject()`, and after that no route, hook or plugin can be added. So if a background task (a package timer or a worker started early) called `inject()` while `buildApp()` was still registering, every later package failed with "Root plugin has already booted", and the next `addHook` threw and stopped the server. When an activation fails, the `catch` in `activateOne()` logs an error and then either rolls the package back with `capabilityPackageManager.rollbackRuntime()` or persists status and readiness `"error"`. For this failure that meant a healthy package could stay rolled back or marked `"error"` on later starts, although the package itself was fine.

**What this adds.**

- `lib/fastify-inject-gate.ts`. `buildApp()` calls `holdInjectUntilRegistered(app)` right after creating the instance and releases it just before `return app`. Any `app.inject()` made before then, promise or callback style, is held and runs once registration has ended, so it also reaches routes that were added after it was called.
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

**How to turn it off / revert.** There is no switch. `MARINARA_INJECT_DURING_REGISTRATION` is only the error code on `InjectDuringRegistrationError`, not a setting. To remove the fix, `git revert f94af4387`. Of the later commits only the console tray commit (`4e62426e8`) touches the same files (`index.ts`), so revert that one first if a conflict appears.

---

## 6. Dev MCP for coding assistants

**What exists today.** Nothing comparable. Developers read logs and the database by hand.

**What this adds.** A Dev MCP server under `tools/dev-mcp` for coding assistants working on Marinara locally. Its README explains setup, and it relies on the request trail from section 2 to follow a request through the logs.

**What stays exactly the same.** Everything in the app. The tool lives outside the pnpm workspace and the Docker image, and nothing in the app depends on it.

**How to check it yourself.** From `tools/dev-mcp`, `node test/smoke.mjs`. It lists every tool and calls the read tools; it never writes, builds or restarts, and skips online checks when no local server is running.

**How to turn it off / revert.** Do not install it. `git revert 5c25b2a77` removes it cleanly.

---

## 7. Feature switches: Settings > Advanced > Features

**What exists today.** Optional server behaviours are environment variables (see sections 3 and 4). There is no place in the UI to turn one on, and each new option would need its own setting, route and UI.

**What this adds.** One registry and one settings section, used by every later piece on this branch. Full details are in `docs/configuration/features.md`.

- The registry is `packages/shared/src/schemas/feature-settings.schema.ts`: switch names, defaults and number settings, stored together as one JSON object in the `features` app setting. Only values that differ from the default are saved.
- On the server, `isFeatureEnabled()` in `services/features/feature-settings.ts` reads an in-memory copy, so busy paths pay nothing. The copy is loaded when the app-settings routes register and refreshed on every write or removal of the row, after Professor Mari database commands that touch it, and after a `.env` reload. `GET` and `PUT /api/app-settings/features`; `PUT` validates strictly.
- Environment variables still win when set, both on and off. `LOREBOOK_STABLE_GROUP_WINNERS` and `PROVIDER_RETRY_TRANSIENT_ERRORS` now pin the **Stable lorebook picks** and **Retry failed provider calls** switches instead of being read on their own. `MARINARA_CONSOLE_TRAY` and `MARINARA_BACKGROUND_CALLS_PER_HOUR` lock the switches they control.
- The client lists every switch in Settings > Advanced > Features, shows a switch pinned by an environment variable as locked with the variable's name, and shows the console tray switch as unavailable off Windows. Other components use `useFeatureEnabled()`.
- The registry also lists **Background call cap** (`backgroundCallCap`, with `backgroundCallsPerHour`, default 600). Nothing reads it at this commit; `13a1baaec` wires it to an hourly budget (section 12d).

**What stays exactly the same.** Every switch defaults off, so an install that never opens the section behaves exactly as before. An environment variable that was set before keeps the same effect.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter feature-settings` (registry and defaults, normalization, env precedence, routes, storage and Mari-style invalidation, listeners). In the app: Settings > Advanced > Features, or search settings for `features`.

**How to turn it off / revert.** Leave every switch off, or unset the environment variables. `git revert 3ce56b535` removes the mechanism, after the later commits that use it.

---

## 8. Generation jobs and the reattach viewer (`generationJobTracking`)

**What exists today.** Gallery images, selfies and scene videos, scene backgrounds, character avatar and sheet drafts, sprite sheets and animated expression sprites are generated inside the HTTP request. The gallery routes abort when the client disconnects, so closing the tab loses the generation.

**What this adds.** With the **Keep generating when the tab is closed** switch on:

- Server (`a00746023`). `runGenerationJob()` is the one entry point. The job store (`services/generation/generation-jobs.ts`) writes each job's metadata and JSON result under `DATA_DIR/generation-jobs`, with its own timeout and cancel, and keeps running when the client disconnects. A restart marks jobs that were still running as interrupted; nothing is run again. Retention keeps metadata for 200 finished jobs and results for 50, never touching anything from the last 24 hours. The tracker (`generation-job-tracker.ts`) keeps one record per job in the new `generation_job_records` table: status, timings, a result link, a stable `ME_*` error code and a capped log trail of ids, codes and timings, never prompts or provider messages. It writes a heartbeat line every 30 s while a job runs, reconciles stale records when tracking starts, and keeps records for 7 days (at most 300). Records go with their chat and with the admin chat wipe. Routes live under `/api/generation-jobs`: list, records, record with trail, seen, metadata, result and cancel.
- Client (`baac8115a`). `GenerationJobsRecoveryHost`, mounted in `AppShell`, reads the job records and, after a reload, a lost connection or a hidden tab, announces jobs that finished while you were away in one toast with a View button. Jobs you watched finish are marked seen quietly, so nothing is announced twice. The rules are DOM-free in `lib/generation-job-tracking.ts`. `GenerationJobsModal` lists recent jobs with status, kind, chat, age, run time, error code, a result link, the log trail, a preview and download of the result, and Stop for a running job. It opens from **Open generation jobs** under the switch row, and from the command palette (section 10).
- Developer notes: `docs/development/generation-jobs.md`.

**What stays exactly the same.** With the switch off, the route's own work runs with its own signal, exactly as before (the gallery routes still abort when the client disconnects), every `/api/generation-jobs` route answers 404, and no folder, row, timer or log line is created. The client requests nothing new, adds no listeners and renders nothing. The store and tracker are created on first use while the switch is on, and the tracker follows later switch changes.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter generation-job-tracking` (off contract, on flow with persisted result, trail, cancel, failure code with no prompt stored, seen, restart reconcile, chat cascade, switching back off, reattach rules, safe result links, client wiring). In the app: turn the switch on, start a gallery image, close the tab, reopen it and look for the toast, or click **Open generation jobs**.

**How to turn it off / revert.** Turn the switch off in Settings > Advanced > Features. There is no environment variable. Existing records and results stay on disk until retention removes them. `git revert baac8115a a00746023` removes the piece.

---

## 9. Windows console tray (`consoleTray`, `MARINARA_CONSOLE_TRAY`)

**What exists today.** On Windows the server runs in a console window that sits in the taskbar for as long as the server runs.

**What this adds.** With the **Minimize the console to the system tray** switch on, or `MARINARA_CONSOLE_TRAY=1`, the server starts a small hidden Windows PowerShell helper once it listens (`services/console-tray/console-tray.service.ts`, `assets/console-tray.ps1`, copied to `dist/assets` by the existing build step). No native modules.

- The helper finds the server's console window, shows a tray icon ("Marinara Engine (port N)", the app icon when `win/installer/app-icon.ico` exists) and hides the console from the taskbar while it is minimized.
- Menu: Open Marinara (the listen address; a wildcard host becomes `127.0.0.1` as in `start.bat`), Show or Hide console, and Quit Marinara, which runs the normal graceful shutdown, never a kill. Double-click toggles the console.
- Under Windows Terminal or another pseudo console host the icon is shown but the console is never hidden, since hiding could take other tabs. With no console, or a hidden one, nothing starts and one info line is logged.
- Saving the switch or changing `MARINARA_CONSOLE_TRAY` in `.env` starts or stops the helper at once. Stopping restores a hidden console. Shutdown stops it alongside `app.close()` and waits at most 1 s. The helper exits by itself when the server process is gone, and a watchdog shows the console again after a hard kill.
- Failures (no PowerShell, a policy that blocks the script, a helper crash) are one rate-limited warning; the server keeps running and does not retry until the switch is turned off and on.

**What stays exactly the same.** Off (the default), and on every other platform, nothing is spawned and the console is untouched. Settings shows the switch as unavailable off Windows.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter feature-switch-console-tray` (default off, env both ways, non-Windows no-op, browser URL, spawn arguments, runtime start and stop through a fake spawner, quit callback, no retry loop, shutdown, script present, ASCII and parseable, server wiring). In the app on Windows: Settings > Advanced > Features, turn the switch on and look in the tray.

**How to turn it off / revert.** Turn the switch off, or set `MARINARA_CONSOLE_TRAY=0` (any value other than `true`, `1`, `yes` or `on` turns it off and wins over the saved switch). `git revert 4e62426e8` removes it.

---

## 10. Ctrl+K command palette and the "?" shortcuts overlay

These are client-only additions with no setting. They add a key binding and a small top-bar button, and change nothing else.

**What exists today.** Chats, characters, personas, lorebooks, presets and Settings tabs are reached through the sidebar and panels. Nothing in the app binds Ctrl+K, and there is no list of the app's keyboard shortcuts.

**What this adds.**

- Palette (`385058156`). Ctrl+K (Cmd+K on a Mac), or a small search button in the top bar on touch screens, opens a searchable palette that jumps to any chat, character, persona, lorebook, preset or Settings tab and runs built-in actions: new conversation, roleplay or game, go home, show or hide chats, open settings or a right-hand panel, switch light or dark mode, show the chat guide, browse character cards and open the character library. Matching is fuzzy and accent-insensitive. With an empty query it shows the items you opened most recently (kept in `localStorage`), then actions. The physical K key is matched on non-Latin keyboard layouts. It does not open over another dialog, and opening something from it uses the same unsaved editor guard as the chat sidebar. Characters come from the compact catalog, so a big library is not loaded in full. Other features add actions through `registerCommand()` in `lib/command-palette.ts`; an action's `when` hides it while it does not apply. `HomeNewChatLauncher`'s chat creation moves into a `useLaunchNewChat()` hook so the palette reuses it unchanged.
- Shortcuts overlay (`2be360952`). Pressing "?" while not typing, or picking **Keyboard shortcuts** in the palette, opens a list of the app's keyboard shortcuts grouped by where they work: everywhere, chat input, messages, Game Mode and editors. Every entry mirrors a binding that exists in the code today, and the catalog in `lib/keyboard-shortcuts.ts` names where each one lives.
- **Open generation jobs** palette action, listed only while the `generationJobTracking` switch is on (through the palette's `when` mechanism). It opens the viewer from section 8.

**What stays exactly the same.** Every existing binding. A text field that ever binds Ctrl+K itself and calls `preventDefault()` keeps the key. "?" never fires while typing or over an open dialog.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter command-palette`. It checks ranking, recents, the `when` filter, the shortcut keys, the exact list of built-in actions (including the switch gate on **Open generation jobs**), that every palette and shortcut label is in `en.json`, and each listed shortcut against its source file, so a binding that is removed or renamed fails the check until the list is updated. In the app: press Ctrl+K anywhere, or "?" outside a text field.

**How to turn it off / revert.** There is no switch; the palette only appears when you press the key or tap the button. `git revert 2be360952 385058156` (newest first, after the palette action commit) removes both.

---

## 11. Prompt caching

Claude (Subscription) and ChatGPT cache a request by its prefix: everything up to the first changed byte is read from the cache, the rest is sent and billed again. These commits make more of each prompt stay the same from turn to turn, and add tools to see what happened. Everything that changes the prompt is behind the **Cache-friendly prompt layout** switch (`cacheFriendlyPromptLayout`), off by default. With it off, requests are sent exactly as before.

About numbers: the only measurement available is from the fork this work comes from. A 520k-token Claude Opus 5.5 game prompt was 61% cached before the marker fix in 11a. The fork expects about 93 to 95% cached from the second turn inside the one-hour cache lifetime with the fix. That figure was reported, not measured on a build with this fix, so treat it as an expectation.

### 11a. Claude subscription history cache marker (`e9e26a181`)

**What exists today.** `claude-subscription.provider.ts` sends the system prompt as one string and replays the history through the Agent SDK.

**What this adds.** Requests built with the cache-friendly layout carry a marked full-lore prefix and marked per-turn blocks, and the provider now honours those markers: the marked lore and other leading system text go before the Agent SDK's dynamic boundary, the per-turn blocks after it, and marked runtime blocks placed after the conversation started travel as user turns. One cache marker (1h, or 5m with `FORCE_PROMPT_CACHING_5M=1`; none on API-key billing) goes on the last completed assistant turn of the replayed history, with `ENABLE_PROMPT_CACHING_1H` for the CLI. Replayed user turns on those requests use the SDK's text-block shape so the cached prefix still matches the next turn. The fix itself: the marker used to require the current user turn to be the very last message, so a turn ending on a per-turn injection placed after the user turn got no history marker and the next turn wrote the whole history again. The marker now goes on the last completed assistant turn whenever everything after it is injections plus the single current user turn.

**What stays exactly the same.** Requests without markers (everything unless the layout switch is on) are sent exactly as before: one string system prompt, string user entries, no marker.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter claude-cache-prefix` (boundary layout, resume replay, marker selection including a tail that ends on an injection, and the unmarked path).

**How to turn it off / revert.** Leave **Cache-friendly prompt layout** off. `git revert e9e26a181`, after the later caching commits.

### 11b. Claude Agent SDK 0.3.280 (`15d8d40ac`)

**What exists today.** Upstream already lists `claude-opus-5-5` for the Anthropic and Claude (Subscription) connections, but locks the Agent SDK at 0.3.273, whose bundled CLI does not know the model.

**What this adds.** The SDK moves to 0.3.280, the first version that does. `pnpm-workspace.yaml` exempts only the Agent SDK (and its platform packages) from the 24h minimum release age, because Anthropic publishes it directly and new model support arrives there.

**What stays exactly the same.** Every other dependency and the lockfile format; `pnpm install --frozen-lockfile` accepts the lockfile.

**How to check it yourself.** `pnpm install --frozen-lockfile`, server `tsc`, and `node scripts/run-regressions.mjs --filter claude`.

**How to turn it off / revert.** No switch; it is a dependency update. `git revert 15d8d40ac` returns to 0.3.273.

### 11c. Cache-friendly prompt layout and the ChatGPT cache session (`2a5b77581`, `a3a05393a`)

**What exists today.** The keyword lorebook scan picks a different set of entries as the chat moves, and app-owned blocks that change every turn (recalled memories, the fallback chat summary, awareness and social activity) sit in the system prompt. Both rewrite the start of the prompt every turn.

**What this adds.** With the **Cache-friendly prompt layout** switch on, on Claude (Subscription) and ChatGPT only:

- Full lore: every enabled entry in the chat's lorebook scope becomes one deterministic `<lore>` block at the start of the prompt (ordered by lorebook id, entry order, entry id) instead of the scan's picks. Entries whose text holds macros, decision blocks included, resolve per turn in a separate `<lore_dynamic>` block in the volatile tail. The lore block is never merged or trimmed: when it cannot fit even with old history dropped, the request is refused with a clear error. A chat opts out with metadata `fullLorebookContext: false`.
- Runtime blocks: the blocks above are marked as runtime context and moved next to the current turn (`normalizePromptCacheLayout` in `services/generation/prompt-cache-layout.ts`), and marked blocks are never merged or squashed into other messages. The dry-run route mirrors the same layout.
- ChatGPT: only the lore goes in `instructions`, and a request carrying the full-lore prefix also sends a stable per-chat routing identity, the `session-id` header and a `prompt_cache_key` (`me-lore-` plus 40 hex), both from a SHA-256 of the chat id, so they stay the same when the lore is edited and differ between chats.
- The unused **ChatGPT history replay** switch (`chatgptHistoryReplay`) is removed from the registry, the Features settings and the docs. It only ran on Game turns with Game state snapshots that are not part of this branch, so it could never engage.
- Game-mode parts of the fork's layout are not included; game chats get the generic parts.

**What stays exactly the same.** With the switch off none of this runs: no markers, the keyword scan and the assembled order. The off request (system prompt, replayed history, current turn) was captured on `2a5b77581` and its parent and is byte-identical. A ChatGPT request without the lore prefix gets no header and no key. Other providers are never affected.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter prompt-cache-layout` (helpers both ways, real `/api/generate` turns on a Claude (Subscription) connection against a mocked Agent SDK, off then on), `--filter chatgpt-cache-key` and `--filter feature-settings`. In the app: Settings > Advanced > Features > **Cache-friendly prompt layout**, then open Peek Prompt on a Claude (Subscription) or ChatGPT chat.

**How to turn it off / revert.** Leave the switch off (there is no environment variable), or set `fullLorebookContext: false` on one chat. `git revert a3a05393a 2a5b77581` after the later caching commits.

### 11d. Warn before a low-cache send (`cd54d4003`)

**What exists today.** A send that misses the cache on a long chat (a card or preset section edited near the top of the prompt, or a pause longer than the cache lifetime) costs far more than the ones around it, and nothing says so beforehand.

**What this adds.** A per-chat option **Warn before a low-cache send** in Chat settings > Advanced Parameters, stored as chat metadata `cacheSendGuard: { enabled, thresholdPercent, ttlMinutes }`. On, before the main reply request, the built prompt is compared message by message with the last prompt sent in this chat on the same provider, model, connection and request kind. The predicted cached share is the length of the unchanged leading messages over the whole prompt, and 0 when an Anthropic-style cache is older than `ttlMinutes` (60). Below `thresholdPercent` (80) the send is held before any model call with a `cache_warning` SSE event; your message is already saved. The client says how much would be cached and where the prompt first changes, and **Send anyway** resends with `cacheGuardAcknowledged: true`. It applies to Anthropic, Claude (Subscription) and ChatGPT requests that carry the layout's lore prefix. Impersonation and individual group replies are never checked. The last fingerprint (a hash and length per message plus an 80-character label) is kept in memory (at most 200 chats) and under `DATA_DIR/cache-guard`. The fork defaults this on; here it defaults off and records nothing while off. User docs: `docs/prompts/generation-parameters.md`.

**What stays exactly the same.** With the option missing or `enabled` not true, nothing is fingerprinted, stored or held.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter cache-send-guard` (settings, prediction, expiry, scope isolation, client wording, and real `/api/generate` turns on a mocked Claude subscription SDK: off never holds or writes, on holds a changed prompt with no model call, an acknowledged resend goes through, an unchanged prefix is not held).

**How to turn it off / revert.** Leave the per-chat option off. `git revert cd54d4003`.

### 11e. Cache diagnostics, next-turn Peek Prompt preview and cache share per turn (`6bad2b848`)

**What exists today.** Peek Prompt shows the saved or live prompt, and **Show token usage on messages** shows a message's token counts. There is no way to see where two requests start to differ or what the provider reported as cached.

**What this adds.**

- Diagnostics (`MARINARA_CACHE_DIAGNOSTICS`, read per request). `claude-cache-diagnostics.ts` logs, per Claude (Subscription) SDK request, hashes of the system prompt on each side of the SDK's dynamic boundary, a running prefix hash per message (two requests share it up to the first changed message), the SDK init and the reported cache usage or failure. `openai-cache-diagnostics.ts` does the same for OpenAI Responses requests, ChatGPT included. Only hashes, lengths, counts and provider identifiers are logged, never prompt text. Every line is debug; the variable set to `1` raises them to info. When neither level is enabled nothing is hashed.
- Peek Prompt live preview (no saved request yet): with the cache-friendly layout on, it lays the prompt out as the next real turn sends it (`layoutAsNextTurn`) and the modal labels it "Live Preview (next turn)".
- The token usage label on a message adds "N% cached" when the provider reported enough to compute it (`normalizeGenerationTokenUsage` in `lib/generation-token-usage.ts`).

**What stays exactly the same.** With the variable unset and `LOG_LEVEL` above debug, nothing is hashed or logged. With the layout switch off, the Peek Prompt preview is unchanged. The token usage label only gains the cached share when the provider reports it.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter cache-diagnostics` (quiet by default, info with the variable, no prompt text, prefix hashes, reported usage, `layoutAsNextTurn` off and on, cache share maths, the live Peek Prompt route off and on). In the app: set `MARINARA_CACHE_DIAGNOSTICS=1` in `.env`, send two turns and compare the prefix hashes in the log.

**How to turn it off / revert.** Leave `MARINARA_CACHE_DIAGNOSTICS` unset. `git revert 6bad2b848`.

---

## 12. Engine, logging and robustness fixes

Two of these pieces have a setting (12c and 12d), both off by default. The rest are bug fixes, report-only checks or launcher safety steps with no switch; each says so.

### 12a. Build integrity check (`16f852beb`)

**What exists today.** A stale `tsconfig.tsbuildinfo`, a partial copy or an edit made after `pnpm build` can leave `dist` without modules that `src` has, or older than `src`. That shows up much later as a confusing "Cannot find module", or as behaviour that ignores a fix.

**What this adds.**

- `write-build-meta.mjs` adds a source inventory (`builtAt`, `srcFileCount`, the sorted list of `src` modules) to `dist/config/build-meta.json`. `build.mjs` fails when a `src` module has no `dist` file, after one rebuild with a fresh tsbuildinfo.
- `lib/build-integrity.ts` runs as the first startup phase, `build.integrity`, and compares the inventory with `dist` and `src`. Any finding logs one `warn` line `startup.build_check` (`ME_BUILD_STALE`), and `startup.ready` carries `buildStale`. It is skipped under tsx and never throws, so it cannot stop a start. It took about 60 ms for 613 modules on Windows.
- The in-app updater checks the rebuilt `dist` (every module present, built commit is the update target) and fails with `ME_UPDATE_BUILD_STALE` instead of reporting success for a build that does not match.

**What stays exactly the same.** No start is stopped by the check, including one with a stale build; it only reports. Runs under tsx are not checked.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter build-integrity`.

**How to turn it off / revert.** There is no switch: it only reports, and fails a build or update that is already broken. `git revert 16f852beb`.

### 12b. Runtime memory telemetry with worker gauges (`7cc00aa34`)

**What exists today.** A memory spike or a stall leaves one "heap is near its limit" line or a bare "process was suspended" line, with nothing about what was running.

**What this adds.**

- `utils/runtime-memory.ts`: the snapshot adds `heapTotal`, `external` and `arrayBuffers`. The monitor also tracks the event-loop delay (p99) and the RSS and heap peaks, writes `runtime.memory` at `debug` every 5th sample and at `info` every 30th, and logs one `warn` line `runtime.memory_pressure` (`ME_MEMORY_PRESSURE`) per episode of heap, RSS or loop pressure, closed by one `info` "recovered" line after two calm samples. `MARINARA_RSS_WARN_MIB` sets the RSS level (default: the heap limit). The monitor now starts before `buildApp`, so the startup peak is captured, and `startup.ready` carries memory and peaks.
- `lib/worker-gauges.ts`: background workers register a cheap, synchronous sampler that reports counts only, never content. Registered: storage (resident chat units, dirty tables, the five largest tables by row count), the autonomous scheduler and the local model sidecar. A sampler that throws yields `{ error: true }`.
- `runtime.freeze` lines carry the memory snapshot and the gauges. `GET /api/admin/runtime-diagnostics` (section 4e) adds memory peaks, the startup build check result and the worker gauges.

Measured cost: the event-loop histogram (20 ms resolution) cut `setImmediate` throughput by 0.34% in a busy-loop benchmark; one sample is well under a millisecond.

**What stays exactly the same.** No stored data, prompt or request changes. The admin route stays read-only.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter runtime-memory-telemetry` and `--filter robustness-runtime-diagnostics`. Details of the log lines are in `docs/CONFIGURATION.md` under logging levels.

**How to turn it off / revert.** There is no switch: it is logging and a read-only admin reply. `git revert 7cc00aa34`.

### 12c. Prompt debug files (`LOG_PROMPT_DEBUG_FILES`, off) (`6b8551592`)

**What exists today.** Debug mode (and `LOG_LEVEL=debug`) prints whole prompts and model replies to the console, where they flood the terminal and mix with everything else.

**What this adds.**

- `lib/rotating-sink.ts`: synchronous, append-only JSON line files, one per process run, rotated past a size limit, pruned to a number of inactive files and an age, with oversized records cut down to their identifying fields. A write failure never throws; it is reported on stderr at most every 30 s, and the next file records how many lines were lost.
- `logDebugOverride`, the one path prompt debug output takes (capability package `debugOverride` included): with `LOG_PROMPT_DEBUG_FILES=true` the line goes to `DATA_DIR/logs/prompt-debug/prompt-debug-<pid>-<boot>.log` (10 MiB per file, three earlier files kept) with its level and request context, instead of the console. One `info` line says where the files are.

**What stays exactly the same.** With the variable unset (the default), nothing is written to disk and the console output is unchanged. The files hold prompt text, which is why this is off unless asked for.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter rotating-sink` and `--filter prompt-debug-files`. Documented in `docs/CONFIGURATION.md` and `.env.example`.

**How to turn it off / revert.** Leave `LOG_PROMPT_DEBUG_FILES` unset. `git revert 6b8551592`.

### 12d. Background call cap (switch `backgroundCallCap`, off) (`13a1baaec`)

**What exists today.** Automatic model calls made in the background (for example the autonomous scheduler's unattended turns) have no hourly limit. Section 7 added the **Background call cap** switch and **Calls per hour** to the registry, but nothing read them.

**What this adds.**

- `services/generation/background-call-budget.ts`: a rolling one-hour window of automatic model calls. Once the cap is spent a call is refused locally, so no request reaches the provider, until the oldest call ages out. One `warn` line when the cap is reached, one `info` line when calls resume.
- `connection-admission`: a provider call admitted in background mode is booked once the connection is actually free (a busy refusal spends nothing). A refusal throws `BackgroundConnectionBusyError` with reason `"budget"`.
- The server-side autonomous scheduler books each unattended turn before it calls `/api/generate`, and skips the turn when refused; a later poll retries.

**What stays exactly the same.** With the switch off (the default), there is no cap and nothing is counted. Interactive requests never count and are never refused.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter background-call-cap`. In the app: Settings > Advanced > Features.

**How to turn it off / revert.** Turn the switch off. `backgroundCallsPerHour` defaults to 600, and `MARINARA_BACKGROUND_CALLS_PER_HOUR` still wins when set. `git revert 13a1baaec`.

### 12e. Launcher safety (`64a1afdfb`, `e0656fa4d`)

**What exists today.** Every launcher runs `git clean -fd` on the `packages/shared`, `server` and `client` `src` trees to remove leftovers that a failed Windows checkout could not delete. On a development checkout the same command silently deletes new source files that were never committed. Separately, `start.bat` opens the app URL after a fixed 4 seconds, so a slow start (a large data folder, a first build, a slow disk) lands on a connection error page.

**What this adds.**

- `scripts/preserve-untracked-src.mjs` lists exactly what the clean would remove (untracked, not ignored, under the three `src` trees) and copies it to `.tmp/untracked-src-backups/<timestamp>/` first. `start.bat`, `start.sh` and `start-termux.sh` run it right before the clean. It always exits 0, so a backup problem never blocks startup, and it prints one line when it copied something.
- `scripts/open-when-ready.cmd` polls `<url>/api/health` with curl every 2 s (up to 15 minutes) and opens the browser once it answers; without curl it keeps a short fixed delay. `start.bat` starts it minimized in place of the fixed delay. `OPEN_WHEN_READY_DRY_RUN` prints instead of opening, for tests. `.gitattributes` checks `.cmd` files out with CRLF like `.bat` files, because cmd labels and `goto` misbehave in LF-only batch files.

**What stays exactly the same.** The clean still runs. With no untracked source files nothing is copied. `AUTO_OPEN_BROWSER` still decides whether a browser opens at all.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter preserve-untracked-src` and `--filter open-when-ready` (both under `scripts/regressions/launcher/`; the second runs the helper against a local server on Windows).

**How to turn it off / revert.** There is no switch. `git revert e0656fa4d 64a1afdfb`.

### 12f. Retry once without reasoning-off when a model always reasons (`91ced8909`)

**What exists today.** Some models always reason, and their OpenAI-compatible gateways answer a request that turns reasoning off with HTTP 400. The per-model rules in `glm-request-compat.ts` cover the models already known; any other such model fails the whole generation.

**What this adds.** The Chat Completions path (streaming and not) checks a 400 from a request that carried a reasoning-disable field (`enable_thinking` false, thinking disabled, `reasoning_effort` none, `reasoning.enabled` false or effort none). When the error says reasoning cannot be disabled, it removes those fields, sends the request once more, and remembers the model per base URL (at most 256) so later requests skip the disable. One rate-limited `warn` line names the model. The logic is in `reasoning-disable-rejection.ts`.

**What stays exactly the same.** Any other 400 or status is returned unchanged. The retry happens before any output reached the caller, so nothing is replayed. Every request that succeeds today is sent unchanged.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter openai-reasoning-disable-retry` and `--filter glm53-nanogpt-reasoning-off`.

**How to turn it off / revert.** There is no switch: this is a bug fix for a hard failure, and the retry only drops a field the provider refused. `git revert 91ced8909`.

### 12g. Reviewed server fixes (`0561fa562`, `0ebcb1ebd`, `3e64168d9`, `368a045ba`)

**What exists today.** A review of the server found bugs across routes, middleware, services, storage and importers. Each is small on its own; the commit messages list every one.

**What this adds.** Fixes in three groups, each fix with its own regression named `server-hunt-b<N>`, plus one helper module:

- Routes and middleware (`0561fa562`): `.env` reload no longer reports false restart warnings; an uncaught exception or unhandled rejection now closes the app gracefully (keeping exit code 1) instead of dropping writes still in the store's debounce window; IP allowlist and rate-limit fixes (an IPv4 prefix over 32 is rejected, IPv6 local hosts are judged by address range, per-route `config.rateLimit` is read); backgrounds, backup and capability package export, chat preset, connection image, emoji and sticker, font and gallery, dry run, translation sidecar and Beholder state fixes.
- Best-effort helpers (`0ebcb1ebd`): `lib/best-effort.ts` adds `logSuppressed`, `orFallback` and `bestEffort`, so a deliberately swallowed failure (a cleanup, a cursor advance, a cache write) is logged, rate limited to one line a minute per event, chat and stage, instead of hidden in an empty catch. No behaviour change on its own.
- Services and storage (`3e64168d9`): deleted built-in regex scripts no longer come back on every start; admin, agents, characters, knowledge source and lorebook routes validate bodies and leave no file behind after a failed upload; agent executor, capability packages, autonomous scheduler (round-robin), Discord webhook 429 retry, personal extensions, memory commands and recall, media (sharp, ComfyUI, RunPod), importers, provider fallback and streams, lorebook scans, prompt assembly, app settings, embeddings, Spotify, utility sidecar, Gemini and taskbar shortcut fixes.
- Storage recovery, chat and generate routes, importers, sidecars and SSRF (`368a045ba`): an empty shard directory no longer revives deleted rows, a Windows writer lease is judged with clock steps in mind, and a corrupt background `meta.json` is kept aside; chats, conversation and generate routes write only the fields they own and validate bodies; OOC influences, `/raw`, import routes, sprites, the conversation summary timeout, SillyTavern and RisuAI importers, tool calls in fences and the local sidecar are fixed; reserved ranges stay blocked for SSRF whatever `TRUSTED_PRIVATE_NETWORKS` says, and Google and Horde keys are dropped on cross-origin redirects.

A few fixes from the review were not ported, because upstream has since changed or replaced the code they touch, or the file exists only in the fork. The commit messages name them.

**What stays exactly the same.** Every request that worked before gets the same answer. Existing regressions that moved with the new code (`capability-gm-verbs`, `gm-skill-check-resolution`, `maintenance-lifecycle`, `roleplay-streaming`) were updated in `368a045ba`.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter server-hunt-b` runs the whole set, or `--filter server-hunt-b15` for one fix; `--filter best-effort` for the helpers. The b3 regression boots the server twice (about 50 s), so it is `server-hunt-b3.slow-regression.ts` and runs directly with tsx: `npx tsx scripts/regressions/server-hunt-b3.slow-regression.ts`.

**How to turn it off / revert.** There is no switch: these are bug fixes. `git revert 368a045ba 3e64168d9 0ebcb1ebd 0561fa562` (newest first).

### 12h. Engine-owned metadata namespaces (`16c7159f3`)

**What exists today.** `ENGINE_OWNED_METADATA_KEY_PREFIXES` in `packages/shared/src/schemas/gm-verb-table.schema.ts` lists the top-level chat metadata namespaces the engine writes, so GM verbs cannot write them.

**What this adds.** The `cache` and `marinara` prefixes. The per-chat cache send guard (`cacheSendGuard`, section 11d) and the generation job markers (section 8) write keys under those namespaces.

**What stays exactly the same.** Every other prefix and every GM verb that writes a namespace outside the list.

**How to check it yourself.** `node scripts/run-regressions.mjs --filter capability-gm-verbs`, which requires every engine-written namespace to be listed.

**How to turn it off / revert.** There is no switch. `git revert 16c7159f3`, after reverting the commits that write those keys.

---

## Test results on the development machine

For the original seven commits (sections 1 to 6), on the earlier `staging` base `60ed7ec80`: the full Node regression suite gave the same result with and without these commits. Four files fail identically on plain `staging` on the Windows test machine (`decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`); their causes are local (a disk-space check for a model download, temp-folder `EPERM`, a `D:` ESM URL, Ctrl+C in PowerShell), not these changes. The other 372 of 376 passed. `tsc --noEmit` passes for shared, server and client. No paid model calls were made.

The later pieces (sections 7 to 12) were each checked with their own regressions and `tsc` when committed. A full-suite comparison on the current base has not been recorded on this page yet.

Full serial suite on Windows, this branch: 448 of 453 regression files pass. The 5 that fail (`decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`, `storage-writer-lock`) fail the same way on plain staging `1bd1e1a5f` on the same machine (362 of 367 there); they depend on the machine (Linux-only runtime, Windows file locking and console signals), not on these commits. Server, client and shared type checks, lint (0 errors), Prettier, the locale checks and both builds pass.
