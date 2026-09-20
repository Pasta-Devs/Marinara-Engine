# Finding and diagnosing failures

Marinara writes structured JSON Lines to `DATA_DIR/logs`. With the standard Windows installation, this is `packages/server/data/logs` inside the installation folder. Each line is one record; files survive browser closure and server restart. The running process has its own `marinara-<pid>-<run>.log` file.

Errors carry a category (`code`) and a unique `errorId`. Copy the reference shown in an API error or generation error and search the log files for it. Existing application-specific codes remain intact; those responses also include `diagnosticCode` for the logging category. The same original Error keeps its reference as it travels through nested operations.

```powershell
# Run from the Marinara installation folder. Substitute the displayed reference.
Get-ChildItem -LiteralPath ./packages/server/data/logs -File |
  Select-String -SimpleMatch 'PASTE-ERROR-REFERENCE'
```

Records include the timestamp, severity, process, sanitized exception and cause chain. Instrumented operations also include request, operation, chat, message or job identifiers, provider/model when available, stage, and elapsed milliseconds. Use `requestId` to follow an HTTP request and `operationId`/`jobId` to follow asynchronous work. Parallel stage durations overlap; do not add them to calculate total runtime.

## Coverage

- Application Pino logs write structured records to the application file sink. Fastify keeps its independently configured logger; the diagnostics hooks below add references to application errors without merging those logger configurations.
- HTTP exceptions, validation failures and directly returned JSON errors receive references while keeping validation and JSON-repair payloads usable.
- HTTP-200 generation-stream failures, failed agent-result events and stream-write exceptions are recorded even after the browser disconnects.
- Browser runtime errors, unhandled rejections, React recovery and network failures are submitted through the normal authenticated/CSRF-protected API. A bounded local queue retains reports while offline; reporting failures do not recursively report themselves. If browser storage is unavailable, the queue lasts only for that page's lifetime.
- Application startup and process failures use the application sink. Synchronous file writes avoid losing the last error solely because the process exits immediately afterward.

Logs cannot reconstruct failures that happened before logging was installed. A power loss, forced termination before an error is raised, browser crash before its report is saved, or unwritable/full disk can still prevent a record. When file output fails, Marinara emits a bounded `ME_LOG_WRITE` warning to stderr and keeps the original operation behavior.

## Settings

Set these in `.env`. File settings take effect after restarting the server once.

| Setting           | Default         | Meaning                                                                          |
| ----------------- | --------------- | -------------------------------------------------------------------------------- |
| `LOG_DIR`         | `DATA_DIR/logs` | Log folder; relative paths resolve from `packages/server`.                       |
| `LOG_FILE_LEVEL`  | `info`          | Minimum file severity. Use `debug` for explicitly requested verbose diagnostics. |
| `LOG_FILE_MAX_MB` | `10`            | Rotation size in MiB, bounded to 1–100.                                          |
| `LOG_FILE_KEEP`   | `10`            | Maximum inactive files retained, bounded to 1–100.                               |
| `LOG_LEVEL`       | `warn`          | Console threshold, independent of file logging; supports existing hot reload.    |

By default, inactive files older than 365 days are pruned when the sink opens or rotates. Active files belonging to other processes are preserved, and unknown files and symlinks are not deleted. Ordinary records are bounded; oversized records remain valid JSON and indicate truncation. Retention is local to this folder, so export needed evidence before it ages out.

## Error categories

| Code                | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `ME_VALIDATION`     | Invalid input/schema validation.                     |
| `ME_AUTH`           | Authentication or access rejection.                  |
| `ME_RATE_LIMIT`     | Provider or HTTP rate limit.                         |
| `ME_TIMEOUT`        | Operation timeout.                                   |
| `ME_CANCELLED`      | Cancellation or interrupted job.                     |
| `ME_NETWORK`        | Network/connection failure.                          |
| `ME_PROVIDER_ERROR` | Provider-specific failure.                           |
| `ME_STORAGE`        | Storage/filesystem failure.                          |
| `ME_SESSION_REVIEW` | Session summary review failed.                       |
| `ME_HTTP_ERROR`     | Other HTTP rejection.                                |
| `ME_STREAM_WRITE`   | Writing to a response stream failed.                 |
| `ME_CLIENT_RUNTIME` | Browser-reported failure; untrusted client evidence. |
| `ME_INTERNAL`       | Failure without a more specific typed category.      |
| `ME_LOG_WRITE`      | The logging sink itself could not write.             |

A category describes the failure boundary, not a proven root cause. Preserve provider status/code and the original cause to distinguish, for example, a rate limit from invalid input.

## Privacy and contributor contract

Ordinary logs are operational metadata, not a transcript archive. The sanitizer removes credential fields, recognizable keys and tokens, request headers/bodies and media payloads. Full prompts remain explicit debug diagnostics; enabling debug may expose campaign content. Review logs before sharing them. Sanitization cannot recognize every secret someone embeds in arbitrary prose.

Use the shared `logger`; never add ad-hoc files or server `console.*` calls. Wrap major asynchronous stages with `runDiagnosticOperation(context, work)` or call `reportDiagnosticError(originalError, context)` at a boundary that consumes an error. Rethrow the original Error when preserving behavior, and keep its cause when wrapping it. Return the reference with an existing error response; do not replace established machine-readable business codes. Do not log successful response bodies, raw prompts, credentials, or image bytes to diagnose an ordinary failure.

Runnable regression proofs: `node scripts/run-regressions.mjs --filter diagnostic-` after building shared types. Tests use temporary data/log directories, fake providers and standalone HTTP injection; they do not require a live campaign or provider call.
