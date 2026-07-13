import assert from "node:assert/strict";
import test from "node:test";
import type { AgentContext } from "@marinara-engine/shared";
import { createHumanOSTurnSnapshots } from "../humanos-turn-snapshot.js";
import { HumanOSDependencyError, planHumanOSDependencyWaves } from "../../agents/humanos-dependency-graph.js";
import { executePhaseWithHumanOSDependencies } from "../../agents/agent-pipeline.js";
import { HumanOSRequiredAgentFailure, HumanOSTurnArtifactLedger } from "../../agents/humanos-artifact-ledger.js";

function agent(type: string, dependencies: string[] = [], failureMode: "REQUIRED" | "DEGRADABLE" | "OPTIONAL" = "REQUIRED"): any {
  return { id: type, type, phase: "pre_generation", settings: { deterministicPipeline: true, dependencies, failureMode, pipelineKey: type } };
}

function result(type: string, success: boolean, data: unknown = null): any {
  return { agentId: type, agentType: type, type: "context_injection", data, tokensUsed: 1, durationMs: 1, success, error: success ? null : `${type} failed` };
}

test("HumanOS snapshots are cloned, deeply frozen, and revision deterministic", () => {
  const messages = [{ id: "u1", role: "user", content: "hello" }];
  const first = createHumanOSTurnSnapshots({ sourceMessageId: "u1", generationType: "normal", chat: { id: "c1", mode: "roleplay", presetId: "p1" }, recentMessages: messages, characters: [], persona: null, runtime: null, activatedLorebookEntries: [], chatSummary: null });
  const second = createHumanOSTurnSnapshots({ sourceMessageId: "u1", generationType: "normal", chat: { id: "c1", mode: "roleplay", presetId: "p1" }, recentMessages: messages, characters: [], persona: null, runtime: null, activatedLorebookEntries: [], chatSummary: null });
  assert.notEqual(first.turn.turnId, second.turn.turnId);
  assert.equal(first.turn.revisions.chat, second.turn.revisions.chat);
  assert.equal(first.turn.snapshotHash, second.turn.snapshotHash);
  assert.ok(Object.isFrozen(first.turn));
  assert.ok(Object.isFrozen(first.turn.recentMessages));
  messages[0]!.content = "mutated later";
  assert.equal(first.turn.recentMessages[0]!.content, "hello");
  assert.throws(() => { (first.turn.recentMessages[0] as AgentContext["recentMessages"][number]).content = "forbidden"; }, TypeError);
});

test("HumanOS dependency planner creates stable execution waves", () => {
  const plan = planHumanOSDependencyWaves([
    agent("brief", ["agent:arc", "artifact:context_snapshot"]),
    agent("arc", ["context_snapshot"]),
    agent("npc", ["artifact:context_snapshot"]),
    agent("composer", ["agent:brief"]),
  ], ["context_snapshot"]);
  assert.deepEqual(plan.waves.map((wave) => wave.map((item) => item.type)), [["arc", "npc"], ["brief"], ["composer"]]);
});

test("HumanOS mixed-mode execution preserves legacy behavior and enforces dependency wave barriers", async () => {
  const calls: string[][] = [];
  const legacy = { ...agent("legacy"), settings: {}, phase: "pre_generation" };
  const arc = { ...agent("arc", ["artifact:context_snapshot"]), phase: "pre_generation" };
  const npc = { ...agent("npc", ["artifact:context_snapshot"]), phase: "pre_generation" };
  const brief = { ...agent("brief", ["agent:arc", "agent:npc"]), phase: "pre_generation" };
  const fakeExecutor = async (wave: any[]) => {
    calls.push(wave.map((item) => item.type));
    return wave.map((item) => result(item.type, true, { text: item.type }));
  };
  await executePhaseWithHumanOSDependencies(
    [brief, legacy, npc, arc] as any,
    "pre_generation",
    {} as AgentContext,
    ["context_snapshot"],
    undefined,
    fakeExecutor as any,
  );
  assert.deepEqual(calls, [["legacy"], ["arc", "npc"], ["brief"]]);
});

test("HumanOS dependency planner rejects missing inputs, duplicates, and cycles", () => {
  assert.throws(() => planHumanOSDependencyWaves([agent("arc", ["artifact:runtime"])] as any, []), (error: unknown) => error instanceof HumanOSDependencyError && error.code === "MISSING_ARTIFACT");
  assert.throws(() => planHumanOSDependencyWaves([agent("arc", ["agent:missing"])] as any, []), (error: unknown) => error instanceof HumanOSDependencyError && error.code === "MISSING_DEPENDENCY");
  assert.throws(() => planHumanOSDependencyWaves([agent("same"), agent("same")] as any, []), (error: unknown) => error instanceof HumanOSDependencyError && error.code === "DUPLICATE_KEY");
  assert.throws(() => planHumanOSDependencyWaves([agent("a", ["agent:b"]), agent("b", ["agent:a"])] as any, []), (error: unknown) => error instanceof HumanOSDependencyError && error.code === "CYCLE");
});

test("HumanOS ledger isolates degradable failure branches and blocks explicit dependents", async () => {
  const ledger = new HumanOSTurnArtifactLedger("turn-1", ["context_snapshot"]);
  const calls: string[][] = [];
  const arc = agent("arc", ["artifact:context_snapshot"], "DEGRADABLE");
  const npc = agent("npc", ["artifact:context_snapshot"], "DEGRADABLE");
  const brief = agent("brief", ["agent:arc"], "DEGRADABLE");
  const scene = agent("scene", ["agent:npc"], "DEGRADABLE");
  const executor = async (wave: any[]) => {
    calls.push(wave.map((item) => item.type));
    return wave.map((item) => result(item.type, item.type !== "arc", { text: item.type }));
  };
  await executePhaseWithHumanOSDependencies(
    [brief, scene, npc, arc] as any,
    "pre_generation",
    {} as AgentContext,
    ["context_snapshot"],
    undefined,
    executor as any,
    ledger,
  );
  assert.deepEqual(calls, [["arc", "npc"], ["scene"]]);
  assert.equal(ledger.resultFor("arc")?.disposition, "failed");
  assert.equal(ledger.resultFor("brief")?.disposition, "blocked_dependency");
  assert.equal(ledger.resultFor("scene")?.disposition, "succeeded");
});

test("HumanOS required failures block the boundary while optional failures remain recorded", async () => {
  const requiredLedger = new HumanOSTurnArtifactLedger("turn-required", ["context_snapshot"]);
  await assert.rejects(
    executePhaseWithHumanOSDependencies(
      [agent("validator", ["artifact:context_snapshot"], "REQUIRED")] as any,
      "pre_generation",
      {} as AgentContext,
      ["context_snapshot"],
      undefined,
      (async () => [result("validator", false)]) as any,
      requiredLedger,
    ),
    HumanOSRequiredAgentFailure,
  );
  const optionalLedger = new HumanOSTurnArtifactLedger("turn-optional", ["context_snapshot"]);
  await executePhaseWithHumanOSDependencies(
    [agent("illustrator", ["artifact:context_snapshot"], "OPTIONAL")] as any,
    "pre_generation",
    {} as AgentContext,
    ["context_snapshot"],
    undefined,
    (async () => [result("illustrator", false)]) as any,
    optionalLedger,
  );
  assert.equal(optionalLedger.resultFor("illustrator")?.disposition, "failed");
});

test("HumanOS ledger resolves cross-stage dependencies and exposes immutable hash-only snapshots", async () => {
  const ledger = new HumanOSTurnArtifactLedger("turn-cross-stage", ["turn_snapshot"]);
  ledger.recordResult(agent("arc", [], "DEGRADABLE") as any, result("arc", true, { privateOutput: "do not copy me" }));
  const calls: string[][] = [];
  const tracker = { ...agent("tracker", ["agent:arc", "artifact:turn_snapshot"], "DEGRADABLE"), phase: "post_processing" };
  await executePhaseWithHumanOSDependencies(
    [tracker] as any,
    "post_processing",
    {} as AgentContext,
    ["turn_snapshot"],
    undefined,
    (async (wave: any[]) => {
      calls.push(wave.map((item) => item.type));
      return [result("tracker", true, { patch: true })];
    }) as any,
    ledger,
  );
  assert.deepEqual(calls, [["tracker"]]);
  const snapshot = ledger.snapshot();
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.agents));
  assert.equal(snapshot.agents.some((entry) => JSON.stringify(entry).includes("privateOutput")), false);
  assert.equal(typeof snapshot.agents.find((entry) => entry.pipelineKey === "arc")?.outputHash, "string");
  assert.throws(() => { (snapshot.agents[0] as any).diagnostic = "mutate"; }, TypeError);
});

test("HumanOS blocks a cross-stage dependent when its prior result failed", async () => {
  const ledger = new HumanOSTurnArtifactLedger("turn-cross-stage-failed", ["turn_snapshot"]);
  ledger.recordResult(agent("arc", [], "DEGRADABLE") as any, result("arc", false));
  const calls: string[][] = [];
  const tracker = { ...agent("tracker", ["agent:arc", "artifact:turn_snapshot"], "DEGRADABLE"), phase: "post_processing" };
  await executePhaseWithHumanOSDependencies(
    [tracker] as any,
    "post_processing",
    {} as AgentContext,
    ["turn_snapshot"],
    undefined,
    (async (wave: any[]) => {
      calls.push(wave.map((item) => item.type));
      return wave.map((item) => result(item.type, true));
    }) as any,
    ledger,
  );
  assert.deepEqual(calls, []);
  assert.equal(ledger.resultFor("tracker")?.disposition, "blocked_dependency");
  assert.deepEqual(ledger.resultFor("tracker")?.blockedBy, ["arc"]);
});

test("HumanOS treats a missing executor result as failure rather than implicit success", async () => {
  const ledger = new HumanOSTurnArtifactLedger("turn-silent", ["context_snapshot"]);
  await executePhaseWithHumanOSDependencies(
    [agent("silent", ["artifact:context_snapshot"], "DEGRADABLE")] as any,
    "pre_generation",
    {} as AgentContext,
    ["context_snapshot"],
    undefined,
    (async () => []) as any,
    ledger,
  );
  assert.equal(ledger.resultFor("silent")?.disposition, "failed");
  assert.equal(ledger.resultFor("silent")?.diagnostic, "Agent executor returned no result");
});
