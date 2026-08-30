/**
 * The utility model slot must be additive.
 *
 * Two things are protected here. First, that the slot behaves: it validates input, it
 * versions by blob id rather than size, and it decides routing by a rule the UI can
 * read back. Second — the one worth failing CI over — that the main sidecar is
 * completely untouched by any of it. The main slot is a running deployment holding an
 * operator's chosen model; a second slot that displaces it is a regression no matter
 * how well the new feature works.
 *
 * The main-sidecar check is a byte-level before/after of its config and model tree
 * rather than a "we didn't call that function" assertion, because the failure being
 * guarded against is an accidental write, and only the bytes can prove there wasn't one.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const dataDir = await mkdtemp(join(tmpdir(), "utility-sidecar-regression-"));
process.env.DATA_DIR = dataDir;

// Imported after DATA_DIR is set: the service resolves its paths at module load.
const { UtilitySidecarService, utilitySlotServesAgent, compareModelVersions } =
  await import("../../packages/server/src/services/utility-sidecar/utility-sidecar.service.js");
const { buildUtilitySidecarEntry, UTILITY_SIDECAR_CONNECTION_PREFIX } =
  await import("../../packages/server/src/services/utility-sidecar/utility-sidecar.provider.js");

const UTILITY_DIR = join(dataDir, "models", "utility");
const UTILITY_CONFIG = join(UTILITY_DIR, "utility-sidecar-config.json");

/** A content fingerprint of everything the main sidecar owns, excluding the utility subtree. */
function fingerprintMainSidecar(): string {
  const entries: string[] = [];
  const walk = (path: string) => {
    if (!existsSync(path) || path === UTILITY_DIR) return; // the one directory this feature owns
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(join(path, name));
      return;
    }
    entries.push(`${relative(dataDir, path)}:${createHash("sha256").update(readFileSync(path)).digest("hex")}`);
  };
  for (const name of ["models", "sidecar-runtime", "sidecar-config.json"]) walk(join(dataDir, name));
  return entries.join("\n");
}

// A stand-in for a main sidecar that is already set up with the operator's own model.
mkdirSync(join(dataDir, "models"), { recursive: true });
mkdirSync(join(dataDir, "sidecar-runtime"), { recursive: true });
writeFileSync(
  join(dataDir, "sidecar-config.json"),
  JSON.stringify({ modelPath: "models/operators-own-model.gguf", contextSize: 32768, temperature: 0.8 }),
);
writeFileSync(join(dataDir, "models", "operators-own-model.gguf"), "GGUF-main-slot-payload");
writeFileSync(join(dataDir, "sidecar-runtime", "llama-server"), "main-slot-runtime-binary");
const mainSidecarBefore = fingerprintMainSidecar();
assert.ok(mainSidecarBefore.includes("operators-own-model"), "fixture must fingerprint the main slot's model");

// ── the routing rule, across every state the slot can be in ─────────────────────
// Selected-and-installed is enough: the process starts on demand, the way the main
// sidecar's provider does it. Requiring it to be already running would hand the agent
// back to its paid connection after every engine restart, silently.
{
  const installedBeholder = { repo: "r", file: "f.gguf", oid: null, bytes: null, downloadedAt: "" };
  const cases: Array<{
    status: { activeModelId: string | null; models: Record<string, unknown>; runtimeInstalled: boolean };
    agent: string;
    serves: boolean;
    why: string;
  }> = [
    {
      status: { activeModelId: "beholder", models: { beholder: installedBeholder }, runtimeInstalled: true },
      agent: "beholder",
      serves: true,
      why: "selected, installed and runnable: it wins",
    },
    {
      status: { activeModelId: "beholder", models: { beholder: installedBeholder }, runtimeInstalled: true },
      agent: "prose-guardian",
      serves: false,
      why: "the binding is the model id; it must not capture unrelated agents",
    },
    {
      status: { activeModelId: null, models: { beholder: installedBeholder }, runtimeInstalled: true },
      agent: "beholder",
      serves: false,
      why: "installed but not selected means the agent's own connection is used",
    },
    {
      status: { activeModelId: "beholder", models: {}, runtimeInstalled: true },
      agent: "beholder",
      serves: false,
      why: "a selection with no installed model cannot serve",
    },
    {
      status: { activeModelId: "beholder", models: { beholder: installedBeholder }, runtimeInstalled: false },
      agent: "beholder",
      serves: false,
      why: "without the shared runtime it can never start, so it must not claim the agent",
    },
    {
      status: { activeModelId: "beholder-old", models: { "beholder-old": installedBeholder }, runtimeInstalled: true },
      agent: "beholder",
      serves: false,
      why: "a near-miss id must not match",
    },
  ];
  for (const testCase of cases) {
    assert.equal(utilitySlotServesAgent(testCase.status as never, testCase.agent), testCase.serves, testCase.why);
  }
}

// ── update detection is by version, not size ────────────────────────────────────
{
  const cases: Array<[string | null, string | null, boolean, boolean]> = [
    ["aaaa", "bbbb", true, false],
    ["aaaa", "aaaa", false, false],
    [null, "bbbb", false, true],
    ["aaaa", null, false, true],
    [null, null, false, true],
  ];
  for (const [installed, available, update, indeterminate] of cases) {
    const verdict = compareModelVersions(installed, available);
    assert.equal(verdict.updateAvailable, update, `installed=${installed} available=${available} updateAvailable`);
    assert.equal(
      verdict.indeterminate,
      indeterminate,
      `installed=${installed} available=${available} must not imply "current" when unknown`,
    );
  }
}

// ── a fresh slot is inert and never claims an agent ─────────────────────────────
{
  const service = new UtilitySidecarService();
  const status = service.getStatus();
  assert.equal(status.configured, false, "a fresh slot holds no models");
  assert.equal(status.activeModelId, null);
  assert.equal(status.ready, false);
  assert.equal(status.baseUrl, null, "nothing serves before a model is installed");
  assert.equal(service.servesAgent("beholder"), false);
  assert.equal(
    await buildUtilitySidecarEntry("beholder"),
    null,
    "with nothing installed the resolver returns null so callers fall through unchanged",
  );
}

// ── install input validation ────────────────────────────────────────────────────
{
  const service = new UtilitySidecarService();
  const rejected: Array<[string, string, string]> = [
    ["beholder", "not-a-repo", "Beholder-Q8_0.gguf"],
    ["beholder", "owner/name", "../../escape.gguf"],
    ["beholder", "owner/name", "/etc/passwd.gguf"],
    ["beholder", "owner/name", "model.bin"],
    ["../escape", "owner/name", "model.gguf"],
    ["beholder", "http://evil/repo", "model.gguf"],
  ];
  for (const [modelId, repo, file] of rejected) {
    await assert.rejects(
      () => service.installModel({ modelId, repo, file }),
      `install must reject modelId=${modelId} repo=${repo} file=${file}`,
    );
  }
  assert.equal(
    existsSync(join(dataDir, "escape.gguf")) || existsSync(join(dataDir, "models", "escape.gguf")),
    false,
    "a rejected install must not have written anything outside the utility directory",
  );
}

// ── an installed model activates, deactivates, and removes cleanly ──────────────
{
  const modelDir = join(UTILITY_DIR, "beholder");
  mkdirSync(modelDir, { recursive: true });
  writeFileSync(join(modelDir, "Beholder-Q8_0.gguf"), "GGUF-utility-payload");
  writeFileSync(
    UTILITY_CONFIG,
    JSON.stringify({
      models: {
        beholder: {
          repo: "GetBeholder/Beholder-GGUF",
          file: "Beholder-Q8_0.gguf",
          oid: "a".repeat(40),
          bytes: 20,
          downloadedAt: new Date(0).toISOString(),
        },
      },
      activeModelId: null,
      contextSize: 8192,
      gpuLayers: 0,
    }),
  );

  const service = new UtilitySidecarService();
  assert.equal(service.getStatus().configured, true, "an installed model makes the slot configured");
  assert.ok(service.getStatus().models.beholder, "the installed model is listed by id");

  await assert.rejects(
    () => service.setActiveModel("not-installed"),
    "activating a model that was never installed must fail loudly",
  );

  await service.setActiveModel("beholder");
  assert.equal(service.getConfig().activeModelId, "beholder");
  assert.equal(
    service.servesAgent("beholder"),
    service.getStatus().runtimeInstalled,
    "once selected it routes as soon as the shared runtime exists; the process starts on demand",
  );

  await service.setActiveModel(null);
  assert.equal(service.getConfig().activeModelId, null, "the slot can be turned off");

  await service.setActiveModel("beholder");
  await service.removeModel("beholder");
  assert.equal(service.getStatus().models.beholder, undefined, "removal drops the record");
  assert.equal(
    service.getConfig().activeModelId,
    null,
    "removing the active model must clear the selection, not leave a dangling pointer",
  );
  assert.equal(existsSync(join(modelDir, "Beholder-Q8_0.gguf")), false, "removal deletes the model file it installed");
  assert.equal(existsSync(UTILITY_CONFIG), true, "the slot keeps its own config inside its own directory");
}

// ── a model id is rejected, never normalized ────────────────────────────────────
// Normalizing was a trap: "a/b" and "a_b" collapsed onto one directory, and an empty
// id resolved to the utility root — so removing it would have taken the whole
// directory with it. These must throw rather than resolve to something plausible.
{
  const service = new UtilitySidecarService();
  const canary = join(UTILITY_DIR, "canary.txt");
  mkdirSync(UTILITY_DIR, { recursive: true });
  writeFileSync(canary, "the utility directory itself must survive");

  for (const badId of ["", ".", "..", "a/b", "../escape", "a b"]) {
    await assert.rejects(
      () => service.removeModel(badId),
      `removeModel must reject the id ${JSON.stringify(badId)} rather than normalizing it`,
    );
    await assert.rejects(
      () => service.setActiveModel(badId),
      `setActiveModel must reject the id ${JSON.stringify(badId)}`,
    );
  }

  assert.equal(
    existsSync(canary),
    true,
    "no rejected id may delete anything — an empty id once resolved to the utility root",
  );
  assert.equal(existsSync(UTILITY_DIR), true, "the utility directory itself must still exist");
}

// ── THE INVARIANT: the main sidecar is byte-for-byte unchanged ──────────────────
{
  assert.equal(
    fingerprintMainSidecar(),
    mainSidecarBefore,
    "the main sidecar's config, models and runtime must be untouched by every utility-slot operation",
  );
  assert.equal(
    readFileSync(join(dataDir, "models", "operators-own-model.gguf"), "utf8"),
    "GGUF-main-slot-payload",
    "the operator's own model file must survive install, activate, deactivate and remove",
  );
  const mainConfig = JSON.parse(readFileSync(join(dataDir, "sidecar-config.json"), "utf8"));
  assert.equal(mainConfig.modelPath, "models/operators-own-model.gguf", "the main slot still points at its model");
  assert.equal(mainConfig.contextSize, 32768, "the main slot's settings are not rewritten");
}

// ── the utility connection id cannot be confused with the main sidecar's ────────
{
  const { isLocalSidecarConnectionId } =
    await import("../../packages/server/src/routes/generate/agent-connection-guards.js");
  // Imported from source, not by package name: `scripts/` has no dependency on the
  // workspace package, so the bare specifier resolves locally and not on CI.
  const { LOCAL_SIDECAR_CONNECTION_ID } = await import("../../packages/shared/src/constants/defaults.js");
  const utilityId = `${UTILITY_SIDECAR_CONNECTION_PREFIX}beholder`;
  assert.equal(
    isLocalSidecarConnectionId(utilityId),
    false,
    "the main sidecar's id check must keep answering false for a utility connection",
  );
  assert.notEqual(utilityId, LOCAL_SIDECAR_CONNECTION_ID);
}

await rm(dataDir, { recursive: true, force: true });
console.log("utility-sidecar regression: OK");
