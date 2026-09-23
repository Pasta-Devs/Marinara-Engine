# Proposal: developer foundations on top of the existing logger, runner and storage

I would like to offer a set of small improvements that build on what Marinara Engine already has. None of them replaces existing code; most are off by default. I am opening this to ask whether you would like them, and in what shape (one PR or several).

| Piece                  | Builds on                                                                           | Change                                                                                                                             | Default                                       | How to check                                            |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Regression isolation   | `runRegression()` in `scripts/run-regressions.mjs`, `MARINARA_ENV_FILE`             | Temp data folder and `.env` per regression file                                                                                    | On (tests only)                               | `node scripts/run-regressions.mjs --filter env-watcher` |
| Logging trail          | `logger` in `lib/logger.ts`, CONTRIBUTING "Logging"                                 | `requestId` on every line of a request, `bootId`, startup timeline, one line per failure                                           | On; new info lines hidden at `LOG_LEVEL=warn` | `--filter logging-`                                     |
| Stable group winners   | `applyGroupSelection()` in `keyword-scanner.ts`                                     | Seeded group roll per chat, for prompt caching                                                                                     | Off                                           | `--filter lorebook-group-seed`                          |
| Compact lorebook scans | `extra.lorebookScan` on messages                                                    | Full entry text kept on the newest message only                                                                                    | Off                                           | `--filter lorebook-scan-compaction`                     |
| Storage writes         | `serializeTableRows()` / `atomicWriteFile()`                                        | Skip identical rewrites, yield while serializing                                                                                   | Off                                           | `--filter robustness-storage-write`                     |
| Windows boot           | `readBootId()` in `file-backed-store.ts`                                            | Cache the boot id probe per OS boot                                                                                                | Off                                           | `--filter robustness-boot-performance`                  |
| Shutdown               | `shutdown()` in `index.ts`                                                          | Console signals, forced exit on repeat, early flush, stop budget                                                                   | Off                                           | `--filter robustness-shutdown-safety`                   |
| Provider retry         | `RateLimitAwareProvider`                                                            | Retry refused connections and gateway 502/503 twice, before any output                                                             | Off                                           | `--filter robustness-provider-resilience`               |
| Runtime diagnostics    | `admin.routes.ts`                                                                   | Read-only privileged `GET /api/admin/runtime-diagnostics`                                                                          | Additive                                      | `--filter robustness-runtime-diagnostics`               |
| Startup inject gate    | `buildApp()` in `app.ts`, `activateOne()` in `capability-module-runtime.service.ts` | Early internal `app.inject()` calls wait until registration ends, so packages no longer fail with "Root plugin has already booted" | On (bug fix)                                  | `--filter startup-inject-gate`                          |

## What exists today

The shared Pino logger and its CONTRIBUTING rules, the regression runner, the atomic write and `.bak` design, the ordered shutdown and the rate-limit backoff are all solid. The gaps are narrower: a log line cannot be tied to the request that caused it, one failure is often logged several times, a regression can read the developer's own `.env`, lorebook inclusion groups re-roll every turn (breaking prompt caching), and scan snapshots repeat full entry text on every message and swipe.

## What this adds

See the table. Each piece comes with regressions that check the default path is unchanged and the new path works, plus documentation in `docs/development/logging.md` and `docs/CONFIGURATION.md`.

## What stays exactly the same

No renames or rewrites of upstream APIs, files or the logger. CONTRIBUTING's Logging section is extended, not changed. With an unchanged `.env`, prompts, stored data, writes, shutdown and provider retries behave as today. The few default-on changes (the `reqId` field becomes `requestId`, query strings leave request lines, a new abort line at info, slow boot steps at warn, and the startup inject fix) are listed in the PR.

## How to check it yourself

`pnpm build:shared`, then the `--filter` commands in the table.

## How to turn it off / revert

Leave the new settings unset. Each piece is a separate commit and can be reverted or dropped on its own.

A small Dev MCP server for local development (`tools/dev-mcp`) is included as its own last commit. It sits outside the pnpm workspace and the Docker image, and it can be dropped from the series on its own.
