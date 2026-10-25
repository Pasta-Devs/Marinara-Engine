// The safety checks Professor Mari's loop runs after each model round, as plain functions of explicit
// state: holding mutations for approval, the completion-claim audit with its repair budgets, and the
// repeated-failure stop. The loop keeps its own control flow and event emission.
import type { MariPermissionsMode } from "@marinara-engine/shared";
import {
  auditWorkspaceCompletionClaim,
  commandFailureSignature,
  isMutatingWorkspaceCommand,
  MAX_MIDRUN_CLAIM_REPAIR_ROUNDS,
  MAX_REPEATED_COMMAND_FAILURES,
  MAX_VERIFICATION_REPAIR_ROUNDS,
  visibleTextAsksApplyPermission,
  visibleTextRequestsUserApproval,
  type AssistantWorkspaceAction,
  type WorkspaceCommandResult,
} from "./workspace-agent.service.js";

export type RoundReviewState = {
  repeatedFailureCounts: Map<string, number>;
  verificationRepairRounds: number;
  midRunClaimRepairRounds: number;
  claimAuditWatermark: number;
  hadPassedClaimAudit: boolean;
  lastPassedClaimText: string | null;
};

export function newRoundReviewState(): RoundReviewState {
  return {
    repeatedFailureCounts: new Map<string, number>(),
    verificationRepairRounds: 0,
    midRunClaimRepairRounds: 0,
    claimAuditWatermark: 0,
    hadPassedClaimAudit: false,
    lastPassedClaimText: null,
  };
}

/**
 * #5725: Manual defers EVERY described mutation (empty-say command frames - the post-approval
 * pattern - still execute); Bypass never defers; Auto/others keep the self-declared ask-first behavior.
 */
export function shouldDeferRoundMutations(args: {
  permissionsMode: MariPermissionsMode;
  parsedAction: Pick<AssistantWorkspaceAction, "visibleText" | "awaitingAuthorization" | "commands">;
  runAskedForApproval: boolean;
}): boolean {
  return Boolean(
    args.permissionsMode !== "bypass" &&
    // Plan never defers: accepting would be a dead end (the next Plan
    // run refuses the commands anyway); the executor floor's refusal is
    // what the model turns into the requested plan.
    args.permissionsMode !== "plan" &&
    args.parsedAction.visibleText &&
    (args.permissionsMode === "manual" ||
      args.parsedAction.awaitingAuthorization ||
      visibleTextRequestsUserApproval(args.parsedAction.visibleText) ||
      // #5748: the strict ask detector covers interrogatives the loose
      // one misses ("Shall I save it now?") - a frame that asks AND
      // stages the mutation must defer, not execute past its own
      // question (the latch arms too late to catch the same round).
      visibleTextAsksApplyPermission(args.parsedAction.visibleText) ||
      // #5748: an earlier round of THIS run asked - only the user can
      // answer, so any later described mutation is held for Accept.
      args.runAskedForApproval) &&
    args.parsedAction.commands.some(isMutatingWorkspaceCommand),
  );
}

export type RoundClaimDecision =
  | { kind: "continue" }
  /** Discard the round's words and ask the model again with this prompt. */
  | { kind: "repair"; prompt: string }
  /** Budget spent: end the run with this text. */
  | { kind: "stop"; content: string };

/**
 * Audits the round's completion claim against every result so far (#5819) and spends the repair
 * budgets. `commandResultsForContinuity` is all results of the run; `truncated` is a length-limited frame.
 */
export function reviewRoundClaim(
  state: RoundReviewState,
  args: {
    action: Pick<AssistantWorkspaceAction, "visibleText" | "commands" | "stop" | "protocolValid">;
    commandResultsForContinuity: WorkspaceCommandResult[];
    truncated: boolean;
  },
): RoundClaimDecision {
  const { action } = args;
  const claimAudit =
    (!action.protocolValid && action.commands.length === 0) || (action.commands.length > 0 && args.truncated)
      ? { issue: null, advanceWatermark: false }
      : auditWorkspaceCompletionClaim(action, args.commandResultsForContinuity, {
          auditFrom: state.claimAuditWatermark,
          hadPassedClaimAudit: state.hadPassedClaimAudit,
          lastPassedClaimText: state.lastPassedClaimText,
        });
  if (claimAudit.advanceWatermark) {
    state.claimAuditWatermark = args.commandResultsForContinuity.length;
    state.hadPassedClaimAudit = true;
    state.lastPassedClaimText = action.visibleText;
  }
  const verificationIssue = claimAudit.issue;
  if (!verificationIssue) return { kind: "continue" };
  // #5819: mid-run claims draw on their own budget, so catching a
  // false step-claim early in a batch cannot starve the terminal
  // check that ends the run.
  const terminalClaim = action.commands.length === 0 && action.stop;
  if (terminalClaim) state.verificationRepairRounds += 1;
  else state.midRunClaimRepairRounds += 1;
  const withinRepairBudget = terminalClaim
    ? state.verificationRepairRounds <= MAX_VERIFICATION_REPAIR_ROUNDS
    : state.midRunClaimRepairRounds <= MAX_MIDRUN_CLAIM_REPAIR_ROUNDS;
  if (withinRepairBudget) {
    return {
      kind: "repair",
      prompt:
        verificationIssue === "dry_run"
          ? 'Every write since your last checked reply was a dry run, so those changes were not saved and the user sees no change from them (anything applied earlier still stands). Do not say they are done. If the user asked for this change, send the same call again with top-level "apply": true and answer from that result. If they asked only for a preview, or you asked whether to apply, say plainly that nothing was saved yet.'
          : verificationIssue === "none" && !terminalClaim
            ? "You claimed a step was completed, but no command output since your last verified claim backs it up. Do not repeat the claim. First run a read that shows the state you claimed; if the work is genuinely missing, perform it and verify it with another read before moving on. Never redo work a read shows already exists."
            : verificationIssue === "none"
              ? "Your previous reply claimed the requested workspace change was complete, but no mutating command succeeded in this run. Do not repeat the completion claim. Use a read command to inspect the requested state; if it is missing, perform the mutation, then verify it with another read before setting stop to true. If an earlier run already completed the work, answer from what the read shows - never redo work that already exists."
              : verificationIssue === "mismatch"
                ? "Your previous reply claimed a change was complete, but the store read-back observed that a change in this run did NOT persist as intended (see readBack.mismatches on that result). Do not claim success. Tell the user plainly which change failed to persist and what the store observed; you may retry the mutation once if a retry is sensible - a retry whose result confirms the persisted state clears this."
                : verificationIssue === "staged"
                  ? "Your previous reply claimed a change was complete, but at least one change in this run was only staged for the user's approval and has NOT been applied. Do not claim it is done, and do not re-run the mutation - the change is already staged and re-running it cannot apply it. Restate plainly which changes are applied and which are awaiting the user's approval, then stop."
                  : "A mutating workspace command succeeded, but no successful read verified the resulting state. Run a confirmatory read now. Only claim completion after that read confirms the change. Do it matter-of-factly - never apologize or present the check as fixing a mistake; report the confirmed state plainly.",
    };
  }
  return {
    kind: "stop",
    content:
      "Professor Mari could not verify the requested workspace change, so I stopped before showing an unsupported completion claim. Ask her to continue and she can use the saved workspace trace.",
  };
}

/** Counts this round's failures; returns the stop text once one error repeated MAX_REPEATED_COMMAND_FAILURES times. */
export function reviewRepeatedFailures(
  state: RoundReviewState,
  commandResults: WorkspaceCommandResult[],
): string | null {
  const repeatedFailure = commandResults
    .filter((commandResult) => !commandResult.success)
    .map((commandResult) => {
      const signature = commandFailureSignature(commandResult);
      const count = (state.repeatedFailureCounts.get(signature) ?? 0) + 1;
      state.repeatedFailureCounts.set(signature, count);
      return { commandResult, count };
    })
    .find((entry) => entry.count >= MAX_REPEATED_COMMAND_FAILURES);
  if (!repeatedFailure) return null;
  return `Professor Mari hit the same ${repeatedFailure.commandResult.name} error ${MAX_REPEATED_COMMAND_FAILURES} times, so I stopped the workspace loop before it spammed the chat. Error: ${repeatedFailure.commandResult.output}`;
}
