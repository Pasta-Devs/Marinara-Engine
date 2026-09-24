# Generation Jobs (Developers)

This page covers the **Keep generating when the tab is closed** feature switch (`generationJobTracking`, off by default, **Settings > Advanced > Features**). With it on, long media generations run as server-side jobs: they keep going when the browser tab closes, their status and result are saved, and the client picks them up again after a reload or a lost connection.

## Summary

- **Off (default):** nothing changes. The gallery image, selfie and scene video routes still abort when the client disconnects, the other media routes run as before, every `/api/generation-jobs` route answers 404, and no folder, table row, timer or log line is added.
- **On:** the media routes below run their provider work through a job store. Closing the tab no longer aborts it. Each job keeps a metadata file, its JSON result and a tracked record with a short log trail. A server restart marks jobs that were still running as **interrupted**; nothing is re-run.

## Architecture

```text
media route
   │  runGenerationJob(app, { kind, label, chatId, timeoutMs }, signal, work)
   ├── switch off ──► work(signal)             the route's own signal, as before
   └── switch on  ──► GenerationJobsStore.run  services/generation/generation-jobs.ts
                        ├── DATA_DIR/generation-jobs/<id>.json         metadata
                        ├── DATA_DIR/generation-jobs/<id>.result.json  result payload
                        └── observer: accepted → running → settled
                              ▼
                      GenerationJobTracker     services/generation/generation-job-tracker.ts
                        ├── generation_job_records table (one row per job)
                        └── "job.state" / "job.progress" log lines
                              ▼
                      /api/generation-jobs     routes/generation-jobs.routes.ts
                              ▼
                      Client: GenerationJobsRecoveryHost (reattach), GenerationJobsModal (viewer)
```

The store and the tracker are created on first use while the switch is on (`getGenerationJobTracker`). The tracker follows the switch through `onFeatureSettingsChange`: turning it on reconciles stale records and runs a retention pass; turning it off stops the retention timer and new jobs run direct again.

For the gallery routes, the response signal is built with `createResponseAbortSignal(reply, timeoutMs, label, !generationJobsEnabled())`: with the switch on it only times out, so the prompt preparation step also survives a closed tab. The job adds its own cancel and timeout (`AbortSignal.any`).

## Job kinds covered

| Store kind                                        | Tracked kind | Started from                |
| ------------------------------------------------- | ------------ | --------------------------- |
| `gallery-image`                                   | image        | Gallery image generation    |
| `gallery-selfie`                                  | image        | Gallery selfie              |
| `scene-background`                                | image        | Scene background generation |
| `character-avatar-draft`, `character-sheet-draft` | image        | Character editor art drafts |
| `sprite-sheet`                                    | sprite       | Sprite sheet generation     |
| `sprite-animated-expressions`                     | sprite       | Animated expressions        |
| `gallery-scene-video`                             | video        | Gallery scene video         |

Not covered: TTS, Illustrator agent images made during a chat turn, and Game Mode asset generation.

## States

```text
accepted ──► running ──► completed
                    ├──► failed        (ME_GENERATION_FAILED, or ME_TIMEOUT)
                    ├──► cancelled     (ME_CANCELLED, POST /api/generation-jobs/:id/cancel)
                    └──► interrupted   (ME_INTERRUPTED, server shutdown or restart)
```

A `job.progress` heartbeat is logged every 30 seconds while a job runs. Every transition is logged once and appended to the record's `trail`. Log lines and trail entries carry only ids, kinds, codes and timings (`buildJobLogEvent`); prompts, message text, provider error messages and keys never reach them. A failure line's `err` goes through `withoutEchoedPrompt`, which replaces quoted spans with `[quoted text removed]` and caps the message at 300 characters.

## Retention

- Records: finished records older than 7 days, and the oldest finished records beyond 300, are removed hourly and whenever the switch turns on. Deleting a chat deletes its records; clearing chats in the admin tools clears them all.
- Store files: metadata for the newest 200 finished jobs and result files for the newest 50 are kept; nothing touched in the last 24 hours is removed.

## API

All routes answer 404 while the switch is off.

| Route                                    | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/generation-jobs`               | Recent jobs from the store (`?chatId=`), newest first, at most 50.  |
| `GET /api/generation-jobs/records`       | Tracked records (`?chatId=&limit=`), without trails.                |
| `POST /api/generation-jobs/records/seen` | `{ ids, recovered }`: the client accounted for these finished jobs. |
| `GET /api/generation-jobs/records/:id`   | One record with its log trail.                                      |
| `GET /api/generation-jobs/:id`           | One job's metadata.                                                 |
| `GET /api/generation-jobs/:id/result`    | A completed job's saved result.                                     |
| `POST /api/generation-jobs/:id/cancel`   | Stop a running job.                                                 |

## Client

- `GenerationJobsRecoveryHost` (mounted in `AppShell`) polls the records while the switch is on. Jobs that finished before the page loaded, or while the tab was hidden or offline, are announced in one toast with a **View** button; jobs the user watched finish are marked seen quietly. The rules are in `lib/generation-job-tracking.ts`.
- `GenerationJobsModal` lists the jobs with status, kind, age, run time, error code, a result link, the log trail, a preview of the saved result and a **Stop** button. It opens from the **Open generation jobs** button under the switch.

## Tests

`scripts/regressions/generation-job-tracking.regression.ts`: switch off (the caller's own signal, 404 routes, no folder, no records), switch on (persisted result, record and trail, cancel, failure code with no prompt or key stored, seen, restart reconcile, chat cascade), switching back off, and the pure helpers.
