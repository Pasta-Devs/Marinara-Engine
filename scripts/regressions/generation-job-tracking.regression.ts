import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Feature switch generationJobTracking ("Keep generating when the tab is closed", off by default):
// switch off = the media routes keep their response-bound behaviour, the job routes answer 404 and nothing
// is created; switch on = media generations run as jobs that outlive the request, are persisted with a
// log trail, can be cancelled, are reconciled after a restart and can be marked seen by a returning client.
const dataDir = mkdtempSync(join(tmpdir(), "marinara-generation-jobs-"));
process.env.DATA_DIR = dataDir;
process.env.FILE_STORAGE_DIR = join(dataDir, "storage");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
process.env.DISABLE_REQUEST_LOGGING = "true";
process.env.AUTO_CREATE_DEFAULT_CONNECTION = "false";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(probe: () => Promise<T | null | undefined | false>, label: string): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await probe();
    if (value) return value;
    if (Date.now() - started > 5000) throw new Error(`Timed out waiting for ${label}`);
    await wait(10);
  }
}

const PLANTED_PROMPT = "PLANTED-PROMPT moonlit harbor with a violet lighthouse";
const PLANTED_KEY = "sk-plantedSECRET0123456789abcdef";

type TestApp = {
  close(): Promise<void>;
  inject(options: Record<string, unknown>): Promise<{ statusCode: number; json(): any; body: string }>;
  ready(): Promise<void>;
  post(path: string, handler: (request: any, reply: any) => Promise<unknown>): void;
};
let app: TestApp | null = null;
try {
  const { resetFeatureSettingsForTests } =
    await import("../../packages/server/src/services/features/feature-settings.js");
  const tracking = await import("../../packages/server/src/services/generation/generation-job-tracker.js");
  const jobsModule = await import("../../packages/server/src/services/generation/generation-jobs.js");
  const { generationJobsRoutes } = await import("../../packages/server/src/routes/generation-jobs.routes.js");
  const { getDB, closeDB } = await import("../../packages/server/src/db/connection.js");
  const { chats, generationJobRecords } = await import("../../packages/server/src/db/schema/index.js");
  void closeDB;

  // ── Wiring ──
  assert.match(read("../../packages/server/src/db/file-backed-store.ts"), /"generation_job_records",\n\] as const;/);
  assert.match(
    read("../../packages/server/src/db/file-backed-store.ts"),
    /\{ parent: "chats", child: "generation_job_records", parentKey: "id", childKey: "chatId" \}/,
  );
  assert.match(read("../protect-launcher-data.mjs"), /"generation_job_records"/);
  assert.match(read("../../packages/server/src/routes/admin.routes.ts"), /runDelete\("generation_job_records"/);
  assert.match(
    read("../../packages/server/src/routes/index.ts"),
    /app\.register\(generationJobsRoutes, \{ prefix: "\/api\/generation-jobs" \}\)/,
  );
  // Every tracked media route goes through runGenerationJob; the gallery routes keep following the client
  // (abort on disconnect) unless the switch is on.
  const gallery = read("../../packages/server/src/routes/gallery.routes.ts");
  assert.equal(gallery.match(/runGenerationJob\(app, job,/g)?.length, 3, "gallery image, selfie and scene video");
  assert.equal(gallery.match(/!generationJobsEnabled\(\),/g)?.length, 3, "each response signal follows the switch");
  assert.match(gallery, /if \(!followClient\) return controller\.signal;\n\s+reply\.raw\.once\("finish", onFinish\);/);
  assert.match(
    read("../../packages/server/src/routes/backgrounds.routes.ts"),
    /runGenerationJob\(app, job, undefined,/,
  );
  assert.match(read("../../packages/server/src/routes/characters.routes.ts"), /runGenerationJob\(app, job, undefined,/);
  const sprites = read("../../packages/server/src/routes/sprites.routes.ts");
  assert.match(sprites, /runGenerationJob\(app, SPRITE_SHEET_JOB, undefined, async \(\) => \{/);
  assert.match(sprites, /runGenerationJob\(app, ANIMATED_EXPRESSIONS_JOB, undefined, async \(\) => \{/);
  for (const kind of Object.keys(tracking.GENERATION_JOB_MEDIA_KINDS)) {
    assert.ok(
      [
        gallery,
        sprites,
        read("../../packages/server/src/routes/backgrounds.routes.ts"),
        read("../../packages/server/src/routes/characters.routes.ts"),
      ].some((source) => source.includes(`"${kind}"`)),
      `${kind} is used by a route`,
    );
  }

  // ── Pure helpers ──
  assert.equal(tracking.mediaKindFor("gallery-selfie"), "image");
  assert.equal(tracking.mediaKindFor("sprite-sheet"), "sprite");
  assert.equal(tracking.mediaKindFor("gallery-scene-video"), "video");
  assert.equal(tracking.mediaKindFor("toString"), null, "prototype keys are not kinds");
  const built = tracking.buildJobLogEvent({
    state: "failed",
    jobId: "22222222-2222-4222-8222-222222222224",
    chatId: null,
    kind: "image",
    sourceKind: "gallery-image",
    stage: "settle",
    at: "2026-01-01T00:00:00.000Z",
    elapsedMs: 12.6,
    errorCode: `Provider said ${PLANTED_PROMPT}`,
    errorId: "not-a-uuid",
    outcome: "failed",
    ...({ prompt: PLANTED_PROMPT, apiKey: PLANTED_KEY } as object),
  });
  assert.equal(built.errorCode, "ME_INTERNAL", "a non-code error string is replaced");
  assert.equal(built.errorId, undefined);
  assert.equal(built.elapsedMs, 13);
  assert.ok(!JSON.stringify(built).includes("PLANTED"), "extra fields are dropped");
  let trail = tracking.appendTrail([], { ...built, state: "accepted" });
  const progress = { ...built, state: "progress" as const, event: "job.progress" as const };
  trail = tracking.appendTrail(tracking.appendTrail(trail, progress), { ...progress, elapsedMs: 99 });
  assert.equal(trail.length, 2, "consecutive progress ticks coalesce");
  let long: typeof trail = [];
  for (let index = 0; index < 50; index++) long = tracking.appendTrail(long, { ...built, elapsedMs: index }, 10);
  assert.equal(long.length, 10);
  assert.equal(long[0]!.elapsedMs, 0, "the first entry survives the cap");
  const someId = "22222222-2222-4222-8222-222222222221";
  assert.equal(
    tracking.findResultRef(someId, { image: "data:image/png;base64,AAAA", saved: { url: "/api/gallery/file/a.png" } }),
    "/api/gallery/file/a.png",
  );
  assert.equal(
    tracking.findResultRef(someId, { url: "https://example.invalid/a.png" }),
    `/api/generation-jobs/${someId}/result`,
  );
  assert.equal(tracking.findResultRef(someId, "/api/../../etc/passwd"), `/api/generation-jobs/${someId}/result`);
  const day = 86_400_000;
  const nowMs = Date.parse("2026-01-10T12:00:00.000Z");
  const at = (offset: number) => new Date(nowMs - offset).toISOString();
  assert.deepEqual(
    tracking
      .selectExpiredRecords(
        [
          { id: "a", status: "completed", createdAt: at(10 * day), updatedAt: at(10 * day) },
          { id: "b", status: "running", createdAt: at(30 * day), updatedAt: at(30 * day) },
          { id: "c", status: "failed", createdAt: at(3), updatedAt: at(3) },
          { id: "d", status: "completed", createdAt: at(2), updatedAt: at(2) },
          { id: "e", status: "cancelled", createdAt: at(1), updatedAt: at(1) },
        ],
        nowMs,
        { retentionMs: 7 * day, maxRecords: 2 },
      )
      .sort(),
    ["a", "c"],
    "too old or beyond the cap, never an unfinished record",
  );
  const echoed = jobsModule.withoutEchoedPrompt(new Error(`Provider rejected "${PLANTED_PROMPT}"`)) as Error;
  assert.ok(!echoed.message.includes("PLANTED") && !String(echoed.stack).includes("PLANTED"));
  assert.match(echoed.message, /\[quoted text removed\]/);

  // ── Store on its own: persistence, cancel, timeout, restart recovery ──
  const storeRoot = mkdtempSync(join(tmpdir(), "marinara-generation-store-"));
  try {
    const store = jobsModule.createGenerationJobs({ dataDir: storeRoot });
    assert.deepEqual(
      await store.run({ kind: "gallery-image", label: "persist", timeoutMs: 1000 }, async () => ({ ok: true })),
      {
        ok: true,
      },
    );
    const [done] = await store.list();
    assert.equal(done!.status, "completed");
    assert.deepEqual(await store.result(done!.id), { ok: true });
    await assert.rejects(store.result("../../secrets"), /Invalid/);
    let began!: () => void;
    const started = new Promise<void>((resolve) => (began = resolve));
    const pending = store
      .run({ kind: "gallery-image", label: "cancel", timeoutMs: 5000 }, async (signal) => {
        began();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return "late";
      })
      .catch((error: Error) => error);
    await started;
    const running = (await store.list()).find((item) => item.status === "running");
    assert.equal(await store.cancel(running!.id), true);
    assert.match(((await pending) as Error).message, /cancel/i);
    assert.equal((await store.get(running!.id))?.errorCode, "ME_CANCELLED");
    await assert.rejects(
      store.run({ kind: "gallery-image", label: "timeout", timeoutMs: 20 }, () => new Promise<string>(() => undefined)),
      /timed out/i,
    );
    const stale = "00000000-0000-4000-8000-000000000001";
    const now = new Date().toISOString();
    writeFileSync(
      join(storeRoot, `${stale}.json`),
      JSON.stringify({
        id: stale,
        kind: "gallery-image",
        label: "stale",
        chatId: null,
        status: "running",
        createdAt: now,
        updatedAt: now,
        error: null,
        resultAvailable: false,
      }),
    );
    const reopened = jobsModule.createGenerationJobs({ dataDir: storeRoot });
    const recovered = await reopened.get(stale);
    assert.equal(recovered?.status, "interrupted", "a restart never re-runs a job");
    assert.equal(recovered?.errorCode, "ME_INTERRUPTED");
    await store.close();
    await reopened.close();
  } finally {
    rmSync(storeRoot, { recursive: true, force: true });
  }

  // ── Server: switch off ──
  const requireServer = createRequire(new URL("../../packages/server/package.json", import.meta.url));
  const Fastify = requireServer("fastify") as typeof import("fastify").default;
  const db = await getDB();
  const createdAt = new Date().toISOString();
  await db
    .insert(chats)
    .values({ id: "chat-1", name: "Harbor", mode: "roleplay", createdAt, updatedAt: createdAt } as never);
  resetFeatureSettingsForTests();

  const fastify = Fastify();
  fastify.decorate("db", db);
  await fastify.register(generationJobsRoutes, { prefix: "/api/generation-jobs" });
  // Stands in for a media route: the provider is a gate the test opens, so no model is ever called.
  const gates = new Map<
    string,
    { release: () => void; released: Promise<void>; began: Promise<void>; begin: () => void }
  >();
  const gate = (key: string) => {
    let entry = gates.get(key);
    if (!entry) {
      let release!: () => void;
      let begin!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      const began = new Promise<void>((resolve) => (begin = resolve));
      entry = { release, released, began, begin };
      gates.set(key, entry);
    }
    return entry;
  };
  const seenSignals: Array<{ own: boolean; aborted: boolean }> = [];
  fastify.post<{ Body: { key: string; held?: boolean; fail?: boolean } }>("/stub", async (request, reply) => {
    const { key, held, fail } = request.body;
    const own = new AbortController().signal;
    try {
      return await tracking.runGenerationJob(
        fastify,
        { kind: "gallery-image", label: "Stub image", chatId: "chat-1", timeoutMs: 10_000 },
        own,
        async (signal) => {
          seenSignals.push({ own: signal === own, aborted: signal?.aborted === true });
          gate(key).begin();
          if (held) await gate(key).released;
          if (fail) throw new Error(`Provider rejected "${PLANTED_PROMPT}" for key ${PLANTED_KEY}`);
          return { image: "data:image/png;base64,AAAA", saved: { url: `/api/gallery/file/${key}.png` } };
        },
      );
    } catch {
      return reply.code(502).send({ error: "Generation failed" });
    }
  });
  app = fastify as unknown as TestApp;
  await app.ready();

  const offDone = await app.inject({ method: "POST", url: "/stub", payload: { key: "off" } });
  assert.equal(offDone.statusCode, 200);
  assert.equal(seenSignals.length, 1);
  assert.deepEqual(seenSignals[0], { own: true, aborted: false }, "off: the caller's own signal is passed through");
  for (const url of ["/api/generation-jobs", "/api/generation-jobs/records", `/api/generation-jobs/${someId}`]) {
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 404, `off: ${url} is not there`);
  }
  assert.equal((await app.inject({ method: "POST", url: `/api/generation-jobs/${someId}/cancel` })).statusCode, 404);
  assert.equal(existsSync(join(dataDir, "generation-jobs")), false, "off: no job folder is created");
  assert.equal((await db.select().from(generationJobRecords)).length, 0, "off: no records");

  // ── Server: switch on ──
  resetFeatureSettingsForTests({ generationJobTracking: true });
  const done = await app.inject({ method: "POST", url: "/stub", payload: { key: "on" } });
  assert.equal(done.statusCode, 200);
  assert.equal(done.json().saved.url, "/api/gallery/file/on.png", "the caller still gets the result");
  assert.deepEqual(seenSignals[1], { own: false, aborted: false }, "on: the work gets the job's combined signal");
  assert.ok(existsSync(join(dataDir, "generation-jobs")), "on: the job folder exists");
  const listed = await until(async () => {
    const response = await app!.inject({ method: "GET", url: "/api/generation-jobs/records" });
    const records = response.json().records as Array<Record<string, any>>;
    return records.length === 1 && records[0]!.status === "completed" ? records : null;
  }, "the completed record");
  const record = listed[0]!;
  assert.equal(record.kind, "image");
  assert.equal(record.sourceKind, "gallery-image");
  assert.equal(record.chatId, "chat-1");
  assert.equal(record.resultRef, "/api/gallery/file/on.png");
  const detail = (await app.inject({ method: "GET", url: `/api/generation-jobs/records/${record.id}` })).json();
  assert.deepEqual(
    detail.trail.map((entry: { state: string }) => entry.state),
    ["accepted", "running", "completed"],
  );
  assert.deepEqual(
    (await app.inject({ method: "GET", url: `/api/generation-jobs/${record.id}/result` })).json(),
    done.json(),
  );
  assert.equal((await app.inject({ method: "GET", url: "/api/generation-jobs" })).json()[0].status, "completed");

  // A job keeps running after the client is gone, and can be cancelled from the jobs viewer.
  const held = app.inject({ method: "POST", url: "/stub", payload: { key: "held", held: true } });
  await gate("held").began;
  const runningRecord = await until(async () => {
    const records = (await app!.inject({ method: "GET", url: "/api/generation-jobs/records" })).json().records;
    return records.find((item: { status: string }) => item.status === "running");
  }, "the running record");
  assert.equal(runningRecord.cancellable, true);
  const cancelled = await app.inject({ method: "POST", url: `/api/generation-jobs/${runningRecord.id}/cancel` });
  assert.equal(cancelled.json().status, "cancelled");
  assert.equal((await held).statusCode, 502);
  gate("held").release();
  const cancelledRecord = await until(async () => {
    const item = (await app!.inject({ method: "GET", url: `/api/generation-jobs/records/${runningRecord.id}` })).json();
    return item.status === "cancelled" ? item : null;
  }, "the cancelled record");
  assert.equal(cancelledRecord.errorCode, "ME_CANCELLED");

  // A failure keeps a stable code and never the provider message or the prompt.
  assert.equal(
    (await app.inject({ method: "POST", url: "/stub", payload: { key: "fail", fail: true } })).statusCode,
    502,
  );
  const failed = await until(async () => {
    const records = (await app!.inject({ method: "GET", url: "/api/generation-jobs/records" })).json().records;
    return records.find((item: { status: string }) => item.status === "failed");
  }, "the failed record");
  assert.equal(failed.errorCode, "ME_GENERATION_FAILED");
  const stored = JSON.stringify(await db.select().from(generationJobRecords));
  assert.ok(!stored.includes("PLANTED") && !stored.includes(PLANTED_KEY), "records hold no prompt or key");

  // A returning client marks finished jobs seen once.
  const seen = await app.inject({
    method: "POST",
    url: "/api/generation-jobs/records/seen",
    payload: { ids: [record.id] },
  });
  assert.deepEqual(seen.json(), { updated: 1 });
  const again = await app.inject({
    method: "POST",
    url: "/api/generation-jobs/records/seen",
    payload: { ids: [record.id] },
  });
  assert.deepEqual(again.json(), { updated: 0 });
  const reattached = (await app.inject({ method: "GET", url: `/api/generation-jobs/records/${record.id}` })).json();
  assert.ok(reattached.seenAt);
  assert.equal(reattached.trail.at(-1).stage, "client-reattach");
  assert.equal(
    (await app.inject({ method: "POST", url: "/api/generation-jobs/records/seen", payload: { ids: ["x"] } }))
      .statusCode,
    400,
  );

  // Restart: a record left "running" by a dead process becomes interrupted, never re-run.
  const tracker = await tracking.getGenerationJobTracker(fastify);
  const lostId = "33333333-3333-4333-8333-333333333331";
  await db.insert(generationJobRecords).values({
    id: lostId,
    kind: "image",
    sourceKind: "gallery-image",
    label: "Lost",
    chatId: "chat-1",
    status: "running",
    createdAt,
    updatedAt: createdAt,
    trail: "[]",
  } as never);
  assert.equal(await tracker.reconcile(), 1);
  const lost = (await app.inject({ method: "GET", url: `/api/generation-jobs/records/${lostId}` })).json();
  assert.equal(lost.status, "interrupted");
  assert.equal(lost.errorCode, "ME_INTERRUPTED");

  // Deleting the chat deletes its records.
  const { eq } = await import("../../packages/server/src/db/file-query.js");
  await db.delete(chats).where(eq(chats.id, "chat-1"));
  assert.equal((await db.select().from(generationJobRecords)).length, 0, "records go with their chat");

  // Switching off again: the routes disappear and generations run direct.
  resetFeatureSettingsForTests();
  assert.equal((await app.inject({ method: "GET", url: "/api/generation-jobs/records" })).statusCode, 404);
  const before = seenSignals.length;
  await app.inject({ method: "POST", url: "/stub", payload: { key: "off-again" } });
  assert.deepEqual(seenSignals[before], { own: true, aborted: false }, "off again: direct");
  assert.equal(tracker.isEnabled(), false, "the tracker follows the switch");

  console.log("generation-job-tracking regression passed");
} finally {
  await app?.close();
  const { closeDB } = await import("../../packages/server/src/db/connection.js");
  await closeDB?.();
  rmSync(dataDir, { recursive: true, force: true });
}
