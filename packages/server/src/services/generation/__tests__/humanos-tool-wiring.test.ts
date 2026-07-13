import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createHumanOSToolRuntime } from "../../humanos/humanos-tool-runtime.js";
import { fingerprintHumanOSSnapshot } from "../humanos-turn-snapshot.js";
import { isPostCanonicalTrackingAgent, participatesInTurnPipeline } from "../../agents/agent-pipeline.js";

const executorPath = fileURLToPath(new URL("../../tools/tool-executor.ts", import.meta.url));
const generatePath = fileURLToPath(new URL("../../../routes/generate.routes.ts", import.meta.url));
const toolResolutionPath = fileURLToPath(new URL("../tool-resolution-runtime.ts", import.meta.url));
const registryPath = fileURLToPath(
  new URL("../../../../../shared/src/features/function-calls/tool-registry.generated.ts", import.meta.url),
);

const executorSource = readFileSync(executorPath, "utf8");
const generateSource = readFileSync(generatePath, "utf8");
const toolResolutionSource = readFileSync(toolResolutionPath, "utf8");
const registrySource = readFileSync(registryPath, "utf8");

const HUMANOS_TOOLS = [
  ["humanos_get_architecture", "humanosGetArchitectureToolManifest"],
  ["humanos_save_architecture", "humanosSaveArchitectureToolManifest"],
  ["humanos_get_runtime", "humanosGetRuntimeToolManifest"],
  ["humanos_commit_runtime", "humanosCommitRuntimeToolManifest"],
] as const;

function architecture(subjectId = "char-active", status = "ESTABLISHED") {
  return {
    schemaVersion: 2 as const,
    subjectType: "CHARACTER" as const,
    subjectId,
    taskMode: "CREATE" as const,
    layers: {},
    facts: {},
    provenanceByPath: { "/facts/name": { status } },
    retrievalPolicy: {},
    compiledArtifacts: {},
    audit: {},
  };
}

test("HumanOS v2 tools are registered and fail closed without scoped callbacks", () => {
  for (const [tool, manifest] of HUMANOS_TOOLS) {
    assert.match(registrySource, new RegExp(manifest));
    assert.match(executorSource, new RegExp(`case ["']${tool}["']`));
  }
  assert.match(executorSource, /HUMANOS_V2_ARCHITECTURE_READ_UNAVAILABLE/);
  assert.match(executorSource, /HUMANOS_V2_ARCHITECTURE_WRITE_UNAVAILABLE/);
  assert.match(executorSource, /HUMANOS_V2_RUNTIME_READ_UNAVAILABLE/);
  assert.match(executorSource, /HUMANOS_V2_RUNTIME_WRITE_UNAVAILABLE/);
});

test("HumanOS Runtime coordinates are server-owned callback construction inputs", () => {
  const runtimeSource = readFileSync(
    fileURLToPath(new URL("../../humanos/humanos-tool-runtime.ts", import.meta.url)),
    "utf8",
  );
  assert.match(runtimeSource, /turnId:\s*string\s*\|\s*null/);
  assert.match(runtimeSource, /baseRevision:\s*number/);
  assert.match(runtimeSource, /baseRevision:\s*args\.baseRevision/);
  assert.match(runtimeSource, /turnId:\s*args\.turnId/);
  assert.doesNotMatch(runtimeSource, /input\.turnId|input\.baseRevision|input\.sourceContentHash/);
});

test("HumanOS callbacks enforce active-subject scope, schema validation, and conflict blocking", async () => {
  let savedArchitecture: string | null = null;
  const toolRuntime = createHumanOSToolRuntime({
    chatId: "chat-active",
    turnId: "turn-architecture-test",
    baseRevision: 0,
    activeSubjects: [{ subjectId: "char-active", subjectType: "CHARACTER" }],
    architectures: {
      async get(_subjectType, subjectId) {
        return savedArchitecture && subjectId === "char-active" ? { id: "arch-1", architecture: savedArchitecture } : null;
      },
      async upsert(input) {
        savedArchitecture = input.architecture;
        return { id: "arch-1", ...input };
      },
    },
    runtime: {
      async getLatestCommitted() { return null; },
      async commit(input) {
        return { status: "committed" as const, row: { id: "runtime-1", ...input } as any };
      },
    },
    async getMessage() { return null; },
  });

  await assert.rejects(
    toolRuntime.callbacks.getArchitecture({ subjectType: "CHARACTER", subjectId: "char-other" }),
    /not active/,
  );
  const mismatch = await toolRuntime.callbacks.saveArchitecture({
    subjectType: "CHARACTER",
    subjectId: "char-active",
    architecture: architecture("char-other"),
  }) as { error?: string };
  assert.equal(mismatch.error, "HUMANOS_V2_ARCHITECTURE_SUBJECT_MISMATCH");

  const saved = await toolRuntime.callbacks.saveArchitecture({
    subjectType: "CHARACTER",
    subjectId: "char-active",
    architecture: architecture("char-active", "CONFLICTED"),
  }) as { compilationBlocked?: boolean };
  assert.equal(saved.compilationBlocked, true);

  const read = await toolRuntime.callbacks.getArchitecture({
    subjectType: "CHARACTER",
    subjectId: "char-active",
  }) as { architecture?: { subjectId?: string } };
  assert.equal(read.architecture?.subjectId, "char-active");
});

test("post-canonical trackers are classified explicitly and excluded from early Runtime authority", () => {
  assert.equal(
    isPostCanonicalTrackingAgent({ phase: "post_processing", settings: { pipelineStage: "post_canonical_tracking" } } as any),
    true,
  );
  assert.equal(
    isPostCanonicalTrackingAgent({ phase: "post_processing", settings: { pipelineStage: "ordered_review" } } as any),
    false,
  );
  assert.equal(participatesInTurnPipeline({ settings: { pipelineStage: "authoring_only" } } as any), false);
  assert.equal(participatesInTurnPipeline({ settings: { participatesInTurnPipeline: false } } as any), false);
  assert.equal(participatesInTurnPipeline({ settings: { pipelineStage: "planning_3_2" } } as any), true);
  assert.match(generateSource, /resolveHumanOSPublicationPolicy\(resolvedAgents\)/);
  assert.match(generateSource, /const legacyResolvedAgents = humanOSPublicationPolicy\.legacyAgents/);
});

test("HumanOS Runtime callbacks require confirmation and a server-owned selected assistant anchor", async () => {
  let activeSwipeIndex = 0;
  let savedRuntime: { state: string; [key: string]: unknown } | null = null;
  let canonicalContent = "canonical assistant content";
  const sourceContentHash = fingerprintHumanOSSnapshot(canonicalContent);
  const toolRuntime = createHumanOSToolRuntime({
    chatId: "chat-active",
    turnId: "turn-runtime-test",
    baseRevision: 0,
    activeSubjects: [],
    architectures: {
      async get() { return null; },
      async upsert(input) { return { ...input }; },
    },
    runtime: {
      async getLatestCommitted() { return savedRuntime; },
      async commit(input) {
        savedRuntime = { id: "runtime-1", revision: input.baseRevision + 1, ...input };
        return { status: "committed" as const, row: savedRuntime as any };
      },
    },
    async getMessage(id) {
      return { id, chatId: "chat-active", role: "assistant", content: canonicalContent, activeSwipeIndex };
    },
  });

  const unconfirmed = await toolRuntime.callbacks.commitRuntime({ state: { trust: 0.25 } }) as { error?: string };
  assert.equal(unconfirmed.error, "HUMANOS_V2_COMMIT_CONFIRMATION_REQUIRED");

  const noAnchor = await toolRuntime.callbacks.commitRuntime({ committed: true, state: { trust: 0.25 } }) as { error?: string };
  assert.equal(noAnchor.error, "HUMANOS_V2_CANONICAL_ANCHOR_UNAVAILABLE");

  toolRuntime.setRuntimeAnchor({ messageId: "assistant-1", swipeIndex: 0, sourceContentHash });
  const committed = await toolRuntime.callbacks.commitRuntime({
    committed: true,
    state: { trust: 0.25, attraction: 0.8, willingness: 0.1, consent: false },
  }) as { state?: Record<string, unknown> };
  assert.equal(committed.state?.consent, false);
  assert.equal(committed.state?.attraction, 0.8);

  const read = await toolRuntime.callbacks.getRuntime() as { state?: Record<string, unknown> };
  assert.equal(read.state?.trust, 0.25);

  canonicalContent = "edited canonical assistant content";
  const edited = await toolRuntime.callbacks.commitRuntime({ committed: true, state: { trust: 0.5 } }) as {
    error?: string;
  };
  assert.equal(edited.error, "HUMANOS_V2_CANONICAL_CONTENT_CHANGED");

  canonicalContent = "canonical assistant content";
  activeSwipeIndex = 1;
  const changed = await toolRuntime.callbacks.commitRuntime({ committed: true, state: { trust: 0.5 } }) as {
    error?: string;
    activeSwipeIndex?: number;
  };
  assert.equal(changed.error, "HUMANOS_V2_CANONICAL_SWIPE_CHANGED");
  assert.equal(changed.activeSwipeIndex, 1);
});
