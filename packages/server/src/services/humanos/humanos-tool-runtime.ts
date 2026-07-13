import { createHash } from "node:crypto";
import type { HumanOSToolCallbacks } from "../tools/tool-executor.js";
import type { HumanOSSubjectType } from "../storage/humanos-architecture.storage.js";
import type { CommitHumanOSRuntimeInput, CommitHumanOSRuntimeResult } from "../storage/humanos-runtime.storage.js";
import { humanOSArchitectureSchema, humanOSCompilationBlocked } from "./humanos-validation.js";
import { fingerprintHumanOSSnapshot } from "../generation/humanos-turn-snapshot.js";

type ArchitectureRow = { architecture: string; [key: string]: unknown };
type RuntimeRow = { state: string; revision?: number | null; [key: string]: unknown };
type RuntimeAnchor = { messageId: string; swipeIndex: number; sourceContentHash: string };

type HumanOSToolRuntimeArgs = {
  chatId: string;
  turnId: string | null;
  baseRevision: number;
  activeSubjects: Array<{ subjectId: string; subjectType: HumanOSSubjectType }>;
  architectures: {
    get(subjectType: HumanOSSubjectType, subjectId: string): Promise<ArchitectureRow | null>;
    upsert(input: { subjectType: HumanOSSubjectType; subjectId: string; schemaVersion: number; architecture: string }): Promise<ArchitectureRow>;
  };
  runtime: {
    getLatestCommitted(chatId: string): Promise<RuntimeRow | null>;
    commit(input: CommitHumanOSRuntimeInput): Promise<CommitHumanOSRuntimeResult>;
  };
  getMessage(id: string): Promise<{ id: string; chatId: string; role: string; content: string; activeSwipeIndex?: number | null } | null>;
};

function runtimeIdempotencyKey(turnId: string, sourceContentHash: string): string {
  return createHash("sha256").update(`${turnId}:${sourceContentHash}:humanos-runtime`).digest("hex");
}

export function createHumanOSToolRuntime(args: HumanOSToolRuntimeArgs): {
  callbacks: HumanOSToolCallbacks;
  setRuntimeAnchor(anchor: RuntimeAnchor | null): void;
} {
  const activeSubjects = new Map(args.activeSubjects.map(({ subjectId, subjectType }) => [subjectId, subjectType]));
  let runtimeAnchor: RuntimeAnchor | null = null;

  const requireActiveSubject = (input: Record<string, unknown>) => {
    const subjectId = typeof input.subjectId === "string" ? input.subjectId : "";
    const subjectType = input.subjectType;
    const activeType = activeSubjects.get(subjectId);
    if (!subjectId || (subjectType !== "CHARACTER" && subjectType !== "USER_PERSONA")) throw new Error("Invalid HumanOS subject.");
    if (activeType !== subjectType) throw new Error("HumanOS subject is not active in this generation context.");
    return { subjectId, subjectType: subjectType as HumanOSSubjectType };
  };

  return {
    callbacks: {
      async getArchitecture(input) {
        const subject = requireActiveSubject(input);
        const row = await args.architectures.get(subject.subjectType, subject.subjectId);
        if (!row) return { error: "HUMANOS_V2_ARCHITECTURE_NOT_FOUND" };
        return { ...row, architecture: JSON.parse(row.architecture) as unknown };
      },
      async saveArchitecture(input) {
        const subject = requireActiveSubject(input);
        const parsed = humanOSArchitectureSchema.safeParse(input.architecture);
        if (!parsed.success) return { error: "INVALID_HUMANOS_V2_ARCHITECTURE", details: parsed.error.flatten() };
        if (parsed.data.subjectType !== subject.subjectType || parsed.data.subjectId !== subject.subjectId) {
          return { error: "HUMANOS_V2_ARCHITECTURE_SUBJECT_MISMATCH" };
        }
        const row = await args.architectures.upsert({ subjectType: subject.subjectType, subjectId: subject.subjectId, schemaVersion: 2, architecture: JSON.stringify(parsed.data) });
        return { ...row, architecture: parsed.data, compilationBlocked: humanOSCompilationBlocked(parsed.data) };
      },
      async getRuntime() {
        const row = await args.runtime.getLatestCommitted(args.chatId);
        if (!row) return { error: "HUMANOS_V2_RUNTIME_NOT_FOUND" };
        return { ...row, state: JSON.parse(row.state) as unknown };
      },
      async commitRuntime(input) {
        if (input.committed !== true) return { error: "HUMANOS_V2_COMMIT_CONFIRMATION_REQUIRED" };
        if (!input.state || typeof input.state !== "object" || Array.isArray(input.state)) return { error: "INVALID_HUMANOS_V2_RUNTIME_STATE" };
        if (!args.turnId) return { error: "HUMANOS_V2_TURN_SNAPSHOT_UNAVAILABLE" };
        const anchor = runtimeAnchor;
        if (!anchor) return { error: "HUMANOS_V2_CANONICAL_ANCHOR_UNAVAILABLE" };
        const message = await args.getMessage(anchor.messageId);
        if (!message || message.chatId !== args.chatId || message.role !== "assistant") return { error: "HUMANOS_V2_CANONICAL_ANCHOR_INVALID" };
        if (message.activeSwipeIndex !== anchor.swipeIndex) {
          return { error: "HUMANOS_V2_CANONICAL_SWIPE_CHANGED", activeSwipeIndex: message.activeSwipeIndex ?? null };
        }
        if (fingerprintHumanOSSnapshot(message.content) !== anchor.sourceContentHash) {
          return { error: "HUMANOS_V2_CANONICAL_CONTENT_CHANGED" };
        }
        const state = JSON.stringify(input.state);
        const result = await args.runtime.commit({
          chatId: args.chatId,
          messageId: anchor.messageId,
          swipeIndex: anchor.swipeIndex,
          state,
          baseRevision: args.baseRevision,
          turnId: args.turnId,
          sourceContentHash: anchor.sourceContentHash,
          patchType: "humanos-runtime",
          idempotencyKey: runtimeIdempotencyKey(args.turnId, anchor.sourceContentHash),
        });
        if (result.status === "revision_conflict") {
          return { error: "HUMANOS_V2_RUNTIME_REVISION_CONFLICT", expectedRevision: result.expectedRevision, currentRevision: result.currentRevision };
        }
        if (result.status === "idempotency_conflict") return { error: "HUMANOS_V2_IDEMPOTENCY_CONFLICT" };
        return { ...result.row, state: input.state, idempotentReplay: result.status === "replayed" };
      },
    },
    setRuntimeAnchor(anchor) { runtimeAnchor = anchor; },
  };
}
