/**
 * How Marinara shares this machine between its built-in models.
 *
 * - Turn order on the built-in chat model: before-reply agents, then the reply, then
 *   agents beside or after it, then everything else, with one slot kept for the first two.
 * - Auto picks one or two parallel slots from the memory the model lands on.
 * - An unused model is unloaded after the Engine-wide time, and a model about to load
 *   unloads idle ones that share its memory before it warns.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "marinara-local-models-"));
process.env.DATA_DIR = root;

const { LocalModelTurns, runWithLocalModelPriority, currentLocalModelPriority, lowerLocalModelPriorityAfterReply } =
  await import("../../../packages/server/src/services/sidecar/local-model-priority.js");
const { pickAutoParallel, isPhoneRuntime } =
  await import("../../../packages/server/src/services/sidecar/sidecar-parallel.js");
const { localModelManager, parseVmStat } =
  await import("../../../packages/server/src/services/sidecar/local-model-manager.js");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const GB = 1_000_000_000;

try {
  // ── turn order ────────────────────────────────────────────────────────────
  {
    // One slot: whoever waits goes in level order, then first come.
    const turns = new LocalModelTurns(() => 1);
    const order: string[] = [];
    let releaseFirst!: () => void;
    const first = turns.run("background", undefined, () => new Promise<void>((done) => (releaseFirst = done)));
    await sleep(5);
    const queued = [
      turns.run("turn", undefined, async () => void order.push("turn")),
      turns.run("background", undefined, async () => void order.push("background")),
      turns.run("reply", undefined, async () => void order.push("reply")),
      turns.run("prepare", undefined, async () => void order.push("prepare")),
    ];
    await sleep(5);
    assert.deepEqual(order, [], "nothing overtakes a request already running on the only slot");
    releaseFirst();
    await first;
    await Promise.all(queued);
    assert.deepEqual(order, ["prepare", "reply", "turn", "background"], "before-reply agents first, then the reply");
  }

  {
    // Two slots: trackers and background work leave one free for the reply.
    const turns = new LocalModelTurns(() => 2);
    let releaseTracker!: () => void;
    const tracker = turns.run("turn", undefined, () => new Promise<void>((done) => (releaseTracker = done)));
    await sleep(5);
    let secondTrackerStarted = false;
    const secondTracker = turns.run("turn", undefined, async () => {
      secondTrackerStarted = true;
    });
    await sleep(5);
    assert.equal(secondTrackerStarted, false, "a second tracker waits instead of taking the reserved slot");
    let replyStarted = false;
    await turns.run("reply", undefined, async () => {
      replyStarted = true;
    });
    assert.equal(replyStarted, true, "the reply starts at once beside a running tracker");
    releaseTracker();
    await Promise.all([tracker, secondTracker]);
    assert.equal(secondTrackerStarted, true);

    // Before-reply agents may use both slots.
    let releaseA!: () => void;
    const prepA = turns.run("prepare", undefined, () => new Promise<void>((done) => (releaseA = done)));
    await sleep(5);
    let prepBStarted = false;
    const prepB = turns.run("prepare", undefined, async () => void (prepBStarted = true));
    await sleep(5);
    assert.equal(prepBStarted, true, "two before-reply agents run together");
    releaseA();
    await Promise.all([prepA, prepB]);
  }

  {
    // A request cancelled while it waits leaves the queue and does not take a slot.
    const turns = new LocalModelTurns(() => 1);
    let release!: () => void;
    const running = turns.run("reply", undefined, () => new Promise<void>((done) => (release = done)));
    await sleep(5);
    const abort = new AbortController();
    let ranWithSignalAborted = false;
    const cancelled = turns.run("background", abort.signal, async () => {
      ranWithSignalAborted = abort.signal.aborted;
    });
    abort.abort();
    await cancelled;
    assert.equal(ranWithSignalAborted, true, "a cancelled waiter returns at once");
    assert.equal(turns.snapshot().waiting.background, 0);
    release();
    await running;
    assert.equal(turns.busy(), false);
  }

  {
    // A held stream keeps its slot until released.
    const turns = new LocalModelTurns(() => 1);
    const release = await turns.acquire("reply", undefined);
    assert.equal(turns.snapshot().running.reply, 1);
    let waited = false;
    const next = turns.run("prepare", undefined, async () => void (waited = true));
    await sleep(5);
    assert.equal(waited, false);
    release();
    release();
    await next;
    assert.equal(waited, true);
    assert.equal(turns.snapshot().running.reply, 0, "releasing twice frees once");
  }

  // ── priority context ──────────────────────────────────────────────────────
  {
    assert.equal(currentLocalModelPriority(), "background", "outside a generation everything is background");
    await runWithLocalModelPriority("prepare", async () => {
      assert.equal(currentLocalModelPriority(), "prepare");
      await sleep(1);
      // A summary started during the reply keeps the context it was started in, and sees it lowered.
      lowerLocalModelPriorityAfterReply();
      assert.equal(currentLocalModelPriority(), "turn", "work after the reply ranks with the trackers");
    });
  }

  // ── Auto parallel ─────────────────────────────────────────────────────────
  {
    const base = { contextSize: 8192, phone: false, platform: "linux", arch: "x64" } as const;
    assert.equal(
      pickAutoParallel({ ...base, modelBytes: 5 * GB, placement: "gpu", gpuTotalBytes: 24 * GB }).jobs,
      2,
      "a 24 GB card has room for two",
    );
    assert.equal(
      pickAutoParallel({ ...base, modelBytes: 5.5 * GB, placement: "gpu", gpuTotalBytes: 8 * GB }).jobs,
      1,
      "an 8 GB card with a 5.5 GB model runs one",
    );
    assert.equal(
      pickAutoParallel({ ...base, modelBytes: 5 * GB, placement: "cpu", gpuTotalBytes: null, systemTotalBytes: 8 * GB })
        .jobs,
      1,
      "an 8 GB laptop on the CPU runs one",
    );
    assert.equal(
      pickAutoParallel({
        ...base,
        modelBytes: 5 * GB,
        placement: "cpu",
        gpuTotalBytes: null,
        systemTotalBytes: 32 * GB,
      }).jobs,
      2,
    );
    assert.equal(
      pickAutoParallel({
        ...base,
        modelBytes: 5 * GB,
        placement: "gpu",
        gpuTotalBytes: null,
        platform: "darwin",
        arch: "arm64",
        systemTotalBytes: 8 * GB,
      }).jobs,
      1,
      "an 8 GB Mac runs one",
    );
    assert.equal(
      pickAutoParallel({ ...base, modelBytes: 5 * GB, placement: "gpu", gpuTotalBytes: null }).jobs,
      2,
      "an unreadable card keeps the old default",
    );
    assert.equal(
      pickAutoParallel({ ...base, phone: true, modelBytes: 1 * GB, placement: "cpu", gpuTotalBytes: null }).jobs,
      1,
    );
    assert.equal(isPhoneRuntime({ PREFIX: "/data/data/com.termux/files/usr" }, "linux"), true);
    assert.equal(isPhoneRuntime({}, "linux"), false);
  }

  // ── macOS memory reading ──────────────────────────────────────────────────
  {
    const vmStat = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               10000.
Pages active:                            200000.
Pages inactive:                           50000.
Pages speculative:                         5000.
Pages purgeable:                           1000.`;
    assert.equal(parseVmStat(vmStat), (10000 + 50000 + 5000 + 1000) * 16384);
    assert.equal(parseVmStat("nonsense"), null);
  }

  // ── idle unload and making room ───────────────────────────────────────────
  {
    const loaded = new Map<string, boolean>([
      ["utility", true],
      ["embedding", true],
      ["decision", false],
    ]);
    const unloads: string[] = [];
    for (const id of ["utility", "embedding", "decision"] as const) {
      localModelManager.register({
        id,
        label: () => id,
        isLoaded: () => loaded.get(id) === true,
        footprintBytes: () => 2 * GB,
        placement: () => "gpu",
        unload: async (reason) => {
          unloads.push(`${id}:${reason}`);
          loaded.set(id, false);
        },
      });
    }

    // Making room: 3 GB free on a 12 GB card, the decision model wants 4.5 GB.
    let free = 3 * GB;
    localModelManager.setTestHooks({
      minuteMs: 20,
      readMemory: async () => ({ kind: "gpu", totalBytes: 12 * GB, availableBytes: free }),
    });
    // The embedding model is busy, so only the utility model may step aside.
    const endEmbedding = localModelManager.begin("embedding");
    const warning = await localModelManager.prepareToLoad("decision", 4.5 * GB, "gpu");
    assert.deepEqual(unloads, ["utility:memory"], "an idle model steps aside; a busy one never does");
    assert.equal(warning, null, "after unloading the utility model the decision model fits");
    assert.equal(localModelManager.slotStatus("utility")?.unloadedForMemoryAt !== null, true);

    // Nothing left to unload: it still loads, with a warning on its page.
    free = 1 * GB;
    loaded.set("utility", false);
    const tight = await localModelManager.prepareToLoad("decision", 4.5 * GB, "gpu");
    assert.match(tight ?? "", /needs about 4\.5 GB/u);
    assert.equal(localModelManager.getMemoryWarning("decision"), tight);
    const tooBig = await localModelManager.prepareToLoad("decision", 20 * GB, "gpu");
    assert.match(tooBig ?? "", /more than this machine/u);
    // A CPU model is not weighed against the card.
    unloads.length = 0;
    loaded.set("utility", true);
    await localModelManager.prepareToLoad("main", 30 * GB, "unknown");
    assert.deepEqual(unloads, [], "an unreadable placement never unloads anything");
    endEmbedding();

    // Idle unload: 5 "minutes" of 20 ms each.
    unloads.length = 0;
    loaded.set("utility", false);
    localModelManager.updateSettings({ idleUnloadMinutes: 5 });
    const saved = JSON.parse(readFileSync(join(root, "models", "local-models.json"), "utf8"));
    assert.equal(saved.idleUnloadMinutes, 5, "the setting is saved for the whole Engine");
    loaded.set("embedding", true);
    localModelManager.noteLoaded("embedding");
    const end = localModelManager.begin("embedding");
    await sleep(150);
    assert.deepEqual(unloads, [], "never unloaded mid-request");
    end();
    await sleep(60);
    assert.deepEqual(unloads, [], "the clock restarts after the last request");
    await sleep(100);
    assert.ok(unloads.includes("embedding:idle"), "unloaded once unused for the set time");
    assert.ok(localModelManager.slotStatus("embedding")?.unloadedForIdleAt, "the page can say why it stopped");

    // Never: nothing is unloaded.
    unloads.length = 0;
    localModelManager.updateSettings({ idleUnloadMinutes: 0 });
    loaded.set("embedding", true);
    localModelManager.noteLoaded("embedding");
    await sleep(150);
    assert.deepEqual(unloads, []);
    assert.throws(() => assert.equal(localModelManager.getSettings().idleUnloadMinutes, 7));
  }

  // ── the Auto migration of saved built-in model settings ───────────────────
  {
    mkdirSync(join(root, "models"), { recursive: true });
    writeFileSync(join(root, "models", "sidecar-config.json"), JSON.stringify({ maxParallelJobs: 2 }));
    const { sidecarModelService } =
      await import("../../../packages/server/src/services/sidecar/sidecar-model.service.js");
    assert.equal(sidecarModelService.getConfig().maxParallelJobs, 0, "the old default of 2 becomes Auto");
    sidecarModelService.updateConfig({ maxParallelJobs: 2 });
    const saved = JSON.parse(readFileSync(join(root, "models", "sidecar-config.json"), "utf8"));
    assert.equal(saved.maxParallelJobs, 2);
    assert.equal(saved.maxParallelJobsVersion, 2, "a 2 chosen after the migration stays 2");
  }

  console.log("local model scheduling: ok");
} finally {
  rmSync(root, { recursive: true, force: true });
}
