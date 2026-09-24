# Server logging

This page explains how to read a Marinara Engine server log and how to write lines that stay useful. It adds to the [Logging section of CONTRIBUTING.md](../../CONTRIBUTING.md#logging) and does not replace it. The shared Pino logger, error-object-first calls, format specifiers and the four-level table still apply.

## What every line carries

All server lines come from one Pino instance, `logger` in `packages/server/src/lib/logger.ts`. Fastify is built on that same instance through `loggerInstance`, so `req.log`, `reply.log` and `app.log` are children of it. They use the same serializers and follow `LOG_LEVEL` hot reloads from the env watcher.

| Field       | On                             | Meaning                                                                                                                           |
| ----------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pid`       | every line                     | Process id (Pino default).                                                                                                        |
| `hostname`  | every line                     | Host name (Pino default).                                                                                                         |
| `bootId`    | every line                     | 8 hex characters, new on each process start. It separates two runs that share one log file.                                       |
| `requestId` | every line caused by a request | Same value as the `x-request-id` response header. It is on `req.log` lines and on lines from the shared `logger` inside services. |
| `route`     | lines after body parsing       | The matched route pattern, for example `/api/chats/:id`. It never holds the raw URL.                                              |

### Request ids

`lib/request-logging.ts` gives each request an id:

- A client may send `x-request-id`. The server keeps it when it is 8 to 80 characters of `A-Z a-z 0-9 . _ : -`. Anything else is replaced.
- Otherwise the server creates a UUID. Fastify's default `req-1` counter restarted on every boot, so those ids repeated.
- The id goes back to the client in the `x-request-id` header, which CORS exposes. A bug report can quote it, and `grep <id>` then finds every line of that request.

The id is stored in an `AsyncLocalStorage` context (`lib/log-context.ts`). A Pino mixin copies it onto each line. You do not pass it around, and `logger.warn(err, "...")` deep in a service picks it up by itself. The context is set again after the body is parsed, because body parsing runs in the HTTP parser's own async context.

The context follows everything started inside the request, including timers, listeners and child processes. Code that starts work which outlives the request, such as a timer, poller or child process, wraps that start in `runWithRootLogContext({}, fn)`, so its later lines do not carry the id of the request that started it. The local sidecar does this for the llama-server and MLX processes it spawns, and the decision sidecar and the utility sidecar start their processes the same way, so a start shared by later requests does not carry the first requester's id. Other long-lived work started from a route (a timer or poller set up inside a handler) still keeps that route's `requestId` on its later lines until it is wrapped the same way.

### Request lines

`RequestLogController` is Fastify's default `LogController` with these changes:

- The id label is `requestId`. Fastify's default label is `reqId`, so a saved search or log filter on `reqId` needs the new name.
- The `incoming request` and `Route ... not found` lines drop query strings, because a query can hold a token or search text. The incoming line keeps Fastify's other `req` fields (`method`, `version`, `host`, `remoteAddress`, `remotePort`) and adds `route`.
- When a client closes a request early, one `Client aborted request` line is logged at info. Fastify logged nothing here.

`LOG_DISABLE_REQUEST_LOGGING` works as before and also turns off the abort line.

In `pnpm dev`, pino-pretty hides `hostname` (its default) and `bootId`. The JSON output used in production keeps both.

## Startup timeline

`lib/startup-timeline.ts` times each boot step:

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Each line has `event: "startup.phase"`, `stage`, `elapsedMs` (wall time) and `selfMs` (the step's own time, without the phases nested inside it). The level follows `selfMs`: debug under 1 s, info over 1 s, warn over 15 s. At the default `LOG_LEVEL=warn` a normal boot, even a slow first run, prints no phase lines.
- Phases nest. `app.build` in `index.ts` wraps every phase inside `buildApp`. Because the level follows `selfMs`, one slow inner step is reported once, by that step, and `app.build` stays at debug unless its own work outside the inner phases is slow.
- A failed step is not logged inside the phase. The error goes up unchanged, and `main().catch` in `index.ts` writes one `startup.failed` line that names the step (`startup.stageOf(err)`).
- Once the server listens, `index.ts` writes one info line, `[startup] Ready in N ms`, with `event: "startup.ready"`, the phase count and the five steps with the largest `selfMs`.

Phases do not add `stage` to the log context. Services started during a phase keep timers, and those timers would otherwise carry that stage for the life of the process.

### Build check

`pnpm build` writes a source inventory into `dist/config/build-meta.json` (`builtAt`, `srcFileCount` and the sorted list of `src` modules), and fails when a `src` module has no compiled `dist` file after one rebuild with a fresh `tsconfig.tsbuildinfo`.

The first startup phase, `build.integrity` (`lib/build-integrity.ts`), compares that inventory with `dist` and, when `src` is present, with `src`. Under `tsx` (`pnpm dev`) it is skipped. A module missing from `dist`, a `src` file changed after `builtAt` or a `src` file the build never saw logs one warn `startup.build_check` line with `errorCode: "ME_BUILD_STALE"` and the first ten paths of each kind, and the `startup.ready` line then carries `buildStale: true` at warn. A clean build logs at debug. The check never stops the server; on this repository it takes about 60 ms.

The in-app updater runs the same comparison after its rebuild and logs one `update.build.verify` line. A missing module or a build commit that is not the update target fails the update with `ME_UPDATE_BUILD_STALE` instead of reporting success.

## One line per failure

A failure should produce exactly one line, written by the code that decides what happens next.

- **Log or rethrow, not both.** If you rethrow, let the caller log. If more detail helps, put it at debug, like the tool name in `[agent-tools] ... failed`.
- **Where the one line lives:**
  - unknown 500s: `middleware/error-handler.ts`
  - agent failures: `executeAgent` (warn, as a non-critical agent failure)
  - a failed chat generation: the main catch in `generate.routes.ts`
  - the matching provider code throws and does not log. At most it adds a debug line that names the model and carries the raw error, like the Grok CLI and Claude (Subscription) providers. Claude (Subscription) throws a friendly message that already contains the SDK error text, so it does not also attach the SDK error as `cause`: the chat's SSE error and the agent error text append a cause's message, and the user would see the same text twice.
- **Cancellations are info.** A user stop, a closed tab or an aborted signal is an expected outcome. Use `failureLevel(err)` (or `failureLevel(err, "warn")`) from `lib/log-context.ts`. It returns `"info"` when `isCancellation(err)` is true. A `TimeoutError` is a real failure and is not treated as a cancellation.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Keep the cause.** Wrap with `new Error("Could not save chat", { cause: err })`. The `err` and `error` serializers add the cause's message and stack to the line (`caused by: ...`). An Error logged as `{ error }` is serialized too; it is no longer printed as `{}`.

## Repeating failures

Pollers, health checks and per-turn hooks can fail the same way every few seconds. Use `logRateLimited` from `lib/log-rate-limit.ts`:

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

The first occurrence of a key is written. Later ones inside the window (60 s by default) are counted, and the next line carries `suppressedRepeats`. Put the thing that fails in the key, such as a package id or chat id, so one bad item does not hide another.

## Prompt and model text

Prompts, model output, provider response bodies and poll bodies go at **debug**, never in warn or error lines. They can hold the user's story text, and provider bodies can echo credentials or the prompt. At warn, log the size (`rawLength`, `bodyLength`) and the reason. Put the text itself on a separate debug line:

```ts
logger.warn({ err, rawLength: raw.length }, "[game/scene-wrap] Failed to parse LLM response as JSON");
logger.debug("[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

The UI debug toggle keeps working through `logDebugOverride`. That is the intended way to see prompts when `LOG_LEVEL` hides debug.

## Checks

The regressions `logging-request-trail`, `logging-failure-lines` and `logging-startup-timeline` cover this page:

```sh
node scripts/run-regressions.mjs --filter logging-
```
