import type { AgentResult } from "@marinara-engine/shared";
import type { ResolvedAgent } from "../agents/agent-pipeline.js";
import { fingerprintHumanOSSnapshot } from "./humanos-turn-snapshot.js";
import { textRewriteDropsProtectedMarkup } from "./text-rewrite-safety.js";

export type HumanOSReviewStage = "5.1" | "5.2" | "5.3" | "5.4" | "5.5" | "5.6";
export type HumanOSReviewFailureMode = "REQUIRED" | "DEGRADABLE" | "OPTIONAL";
export type HumanOSReviewVerdict = "pass" | "surgical_edit" | "reject_to_composer";

export interface HumanOSReviewerDeclaration {
  key: string;
  stage: HumanOSReviewStage;
  failureMode: HumanOSReviewFailureMode;
}

export interface HumanOSReviewDecision {
  verdict: HumanOSReviewVerdict;
  editedText?: string;
  diagnostic?: string;
  correctionNotice?: string;
}

export interface HumanOSReviewRecord {
  key: string;
  stage: HumanOSReviewStage;
  failureMode: HumanOSReviewFailureMode;
  disposition: "passed" | "edited" | "failed" | "degraded" | "rejected";
  inputHash: string;
  outputHash: string | null;
  diagnostic: string | null;
}

export interface HumanOSOrderedReviewResult {
  status: "canonical" | "failed" | "rejected" | "aborted";
  text: string;
  records: HumanOSReviewRecord[];
  correctionNotice: string | null;
  canonicalContentHash: string | null;
}

export class HumanOSReviewConfigurationError extends Error {}

export const HUMANOS_REVIEW_STAGES: readonly HumanOSReviewStage[] = ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"];

export function isHumanOSOrderedReviewAgent(agent: Pick<ResolvedAgent, "phase" | "settings">): boolean {
  return agent.phase === "post_processing" && agent.settings.pipelineStage === "ordered_review";
}

export function humanOSReviewerDeclaration(agent: Pick<ResolvedAgent, "type" | "settings">): HumanOSReviewerDeclaration {
  const rawOrder = agent.settings.reviewOrder;
  const stage = typeof rawOrder === "number" ? `5.${Math.trunc(rawOrder)}` : String(rawOrder ?? "");
  if (!HUMANOS_REVIEW_STAGES.includes(stage as HumanOSReviewStage)) {
    throw new HumanOSReviewConfigurationError(`Invalid HumanOS review stage for ${agent.type}: ${stage || "missing"}`);
  }
  const rawMode = agent.settings.failureMode;
  const failureMode: HumanOSReviewFailureMode = rawMode === "DEGRADABLE" || rawMode === "OPTIONAL" ? rawMode : "REQUIRED";
  const rawKey = agent.settings.pipelineKey;
  return {
    key: typeof rawKey === "string" && rawKey.trim() ? rawKey.trim() : agent.type,
    stage: stage as HumanOSReviewStage,
    failureMode,
  };
}

export function humanOSReviewDecisionFromAgentResult(result: AgentResult): HumanOSReviewDecision {
  if (!result.success) throw new Error(result.error ?? "Reviewer execution failed");
  if (!result.data || typeof result.data !== "object") throw new Error("Reviewer returned no structured result");
  const data = result.data as Record<string, unknown>;

  if (result.type === "text_rewrite") {
    const editNeeded = data.editNeeded;
    const editedText = typeof data.editedText === "string" ? data.editedText : "";
    return editNeeded === false || (!editedText && editNeeded !== true)
      ? { verdict: "pass", diagnostic: typeof data.diagnostic === "string" ? data.diagnostic : undefined }
      : { verdict: "surgical_edit", editedText, diagnostic: typeof data.diagnostic === "string" ? data.diagnostic : undefined };
  }

  const verdict = data.verdict;
  if (verdict !== "pass" && verdict !== "surgical_edit" && verdict !== "reject_to_composer") {
    throw new Error("Reviewer returned an invalid verdict");
  }
  return {
    verdict,
    editedText: typeof data.editedText === "string" ? data.editedText : undefined,
    diagnostic: typeof data.diagnostic === "string" ? data.diagnostic : undefined,
    correctionNotice: typeof data.correctionNotice === "string" ? data.correctionNotice : undefined,
  };
}

function validateReviewers(reviewers: HumanOSReviewerDeclaration[]): HumanOSReviewerDeclaration[] {
  const byStage = new Map<HumanOSReviewStage, HumanOSReviewerDeclaration>();
  const keys = new Set<string>();
  for (const reviewer of reviewers) {
    if (keys.has(reviewer.key)) throw new HumanOSReviewConfigurationError(`Duplicate HumanOS reviewer key: ${reviewer.key}`);
    if (byStage.has(reviewer.stage)) throw new HumanOSReviewConfigurationError(`Duplicate HumanOS review stage: ${reviewer.stage}`);
    keys.add(reviewer.key);
    byStage.set(reviewer.stage, reviewer);
  }
  const missing = HUMANOS_REVIEW_STAGES.filter((stage) => !byStage.has(stage));
  if (missing.length) throw new HumanOSReviewConfigurationError(`Missing HumanOS review stage(s): ${missing.join(", ")}`);
  return HUMANOS_REVIEW_STAGES.map((stage) => byStage.get(stage)!);
}

function failureRecord(
  reviewer: HumanOSReviewerDeclaration,
  inputHash: string,
  diagnostic: string,
): HumanOSReviewRecord {
  return {
    key: reviewer.key,
    stage: reviewer.stage,
    failureMode: reviewer.failureMode,
    disposition: reviewer.failureMode === "REQUIRED" ? "failed" : "degraded",
    inputHash,
    outputHash: null,
    diagnostic,
  };
}

export async function runHumanOSOrderedReview(args: {
  candidate: string;
  reviewers: HumanOSReviewerDeclaration[];
  execute: (reviewer: HumanOSReviewerDeclaration, latestCandidate: string) => Promise<HumanOSReviewDecision>;
  publishCanonical?: (text: string, contentHash: string) => void | Promise<void>;
  isAborted?: () => boolean;
}): Promise<HumanOSOrderedReviewResult> {
  const ordered = validateReviewers(args.reviewers);
  let current = args.candidate;
  const records: HumanOSReviewRecord[] = [];

  for (const reviewer of ordered) {
    if (args.isAborted?.()) {
      return { status: "aborted", text: current, records, correctionNotice: null, canonicalContentHash: null };
    }

    const inputHash = fingerprintHumanOSSnapshot(current);
    let decision: HumanOSReviewDecision;
    try {
      decision = await args.execute(reviewer, current);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "Reviewer execution failed";
      records.push(failureRecord(reviewer, inputHash, diagnostic));
      if (reviewer.failureMode === "REQUIRED") {
        return { status: "failed", text: current, records, correctionNotice: null, canonicalContentHash: null };
      }
      continue;
    }

    if (decision.verdict === "reject_to_composer") {
      records.push({
        key: reviewer.key,
        stage: reviewer.stage,
        failureMode: reviewer.failureMode,
        disposition: "rejected",
        inputHash,
        outputHash: null,
        diagnostic: decision.diagnostic ?? "Material narrative correction required",
      });
      return {
        status: "rejected",
        text: current,
        records,
        correctionNotice: decision.correctionNotice?.trim() || decision.diagnostic?.trim() || "Material narrative correction required",
        canonicalContentHash: null,
      };
    }

    if (decision.verdict === "surgical_edit") {
      const edited = decision.editedText?.trim() ?? "";
      const invalid = !edited
        ? "Surgical edit returned empty text"
        : textRewriteDropsProtectedMarkup(current, edited)
          ? "Surgical edit dropped protected markup"
          : null;
      if (invalid) {
        records.push(failureRecord(reviewer, inputHash, invalid));
        if (reviewer.failureMode === "REQUIRED") {
          return { status: "failed", text: current, records, correctionNotice: null, canonicalContentHash: null };
        }
        continue;
      }
      current = edited;
      records.push({
        key: reviewer.key,
        stage: reviewer.stage,
        failureMode: reviewer.failureMode,
        disposition: edited === args.candidate && records.length === 0 ? "passed" : "edited",
        inputHash,
        outputHash: fingerprintHumanOSSnapshot(current),
        diagnostic: decision.diagnostic ?? null,
      });
      continue;
    }

    records.push({
      key: reviewer.key,
      stage: reviewer.stage,
      failureMode: reviewer.failureMode,
      disposition: "passed",
      inputHash,
      outputHash: inputHash,
      diagnostic: decision.diagnostic ?? null,
    });
  }

  const canonicalContentHash = fingerprintHumanOSSnapshot(current);
  await args.publishCanonical?.(current, canonicalContentHash);
  return { status: "canonical", text: current, records, correctionNotice: null, canonicalContentHash };
}
