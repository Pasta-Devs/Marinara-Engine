// #5748: once Professor Mari asks the user whether to apply, the question is
// binding for the rest of the run - she must never answer it herself. The
// reported shape: an ask-frame whose only command was an apply:false preview
// could not be held (previews are non-mutating), so the run continued and she
// pivoted to apply:true one round later with no user reply in between.
// The fix is a run-scoped ask latch armed by a STRICT ask detector at the
// point where the ask actually streams to the user. Later described mutating
// rounds of the same run defer behind the Accept action; silent mutating
// frames are refused with guidance. A user reply or Accept starts a new run
// with a fresh latch.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseAssistantWorkspaceAction,
  visibleTextAsksApplyPermission,
  visibleTextRequestsUserApproval,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── Functional: the STRICT detector arms on asks and never on restatements ──
// The reported round-3 ask must arm the latch.
assert.equal(
  visibleTextAsksApplyPermission(
    "I've drafted up a magical girl transformation for Kaz! I'm running this as a preview so you can review the proposed edits in the UI. Let me know if you want me to apply these changes!",
  ),
  true,
  "the reported ask-phrasing must arm the latch",
);
assert.equal(visibleTextAsksApplyPermission("Do you want me to apply this change now?"), true);
// Sentence-initial colloquial ask and interrogative ready-to (CodeRabbit
// round 1): both are genuine permission questions.
assert.equal(visibleTextAsksApplyPermission("Want me to make these changes?"), true);
assert.equal(visibleTextAsksApplyPermission("I've drafted the new card. Want me to apply it?"), true);
assert.equal(visibleTextAsksApplyPermission("Ready to apply - just say the word. Shall I save it now?"), true);
// Declarative progress narration must NOT arm, even when it names the verbs.
assert.equal(
  visibleTextAsksApplyPermission("I'm ready to update the greeting now."),
  false,
  "a progress statement is not an ask - the ready-to branch requires a question",
);
// A genuine scope question is an ask - holding until the user answers is the
// intended residual.
assert.equal(
  visibleTextAsksApplyPermission("Quick check before I finish: should I update the greeting too, or leave it as-is?"),
  true,
);
// Mari's routine RESTATEMENT of a request must NOT arm the latch. This is the
// #5721 lesson: pre-latch these strings were inert on read-only rounds, and a
// latch armed by them would force an Accept on a plainly requested edit -
// exactly the double-generation the #5727 revert removed.
assert.equal(
  visibleTextAsksApplyPermission(
    "Got it - you want me to update Kaz's personality to be more cynical. Let me read the current card first.",
  ),
  false,
  "a restatement is not an ask - it must never bind the run",
);
assert.equal(
  visibleTextAsksApplyPermission("Understood: you want me to change her greeting. Reading the character now."),
  false,
);
// The round-4 self-answer is declarative and matches neither detector - which
// is exactly why the latch (armed on the earlier ask), not phrasing, is the
// guard.
assert.equal(
  visibleTextAsksApplyPermission(
    "Ah, my bad! To properly show you the Keep/Restore review card UI for character edits, I need to actually submit the changes. Let's apply the magical girl transformation right now so you can see the visual diffs!",
  ),
  false,
);
// The LOOSE detector (same-frame deferral only) does match restatements -
// documenting why it must never arm the latch: in-frame a false positive is
// inert unless that frame also stages a mutation, across rounds it is not.
assert.equal(
  visibleTextRequestsUserApproval(
    "Got it - you want me to update Kaz's personality to be more cynical. Let me read the current card first.",
  ),
  true,
  "the loose detector matches restatements - the latch must not use it",
);
// awaitingAuthorization is the deterministic arm - the prompt instructs
// proposal frames to set it explicitly instead of relying on phrasing.
assert.equal(
  parseAssistantWorkspaceAction(
    JSON.stringify({ say: "Apply this?", awaitingAuthorization: true, commands: [], stop: true }),
  ).awaitingAuthorization,
  true,
);

// ── Engine: the latch exists, arms where text streams, holds, and floors ────
// Structural pins run against a whitespace-flattened copy so Prettier reflow
// can never break them; behavior changes still do.
const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");
const flat = workspaceAgent.replace(/\s+/gu, " ");

// Run-LOCAL latch declared BEFORE the round loop - run scope is the entire
// property the fix rests on. A declaration moved into the loop body (fresh
// every round) or an instance field (shared across runs) both fail here.
const latchDeclIndex = flat.indexOf("let runAskedForApproval = false;");
const roundLoopIndex = flat.indexOf("for (let round = 0; round < MAX_COMMAND_ROUNDS; round += 1) {");
assert.ok(latchDeclIndex !== -1, "the run-local latch declaration must exist");
assert.ok(roundLoopIndex !== -1, "the round loop anchor must exist");
assert.ok(
  latchDeclIndex < roundLoopIndex,
  "the latch must be declared BEFORE the round loop - run scope, not round scope",
);
assert.doesNotMatch(workspaceAgent, /private runAskedForApproval/u, "the latch is run-local, never an instance field");
// The latch is written false exactly once (the declaration) and true exactly
// once (the arming) - any added reset inside the loop reverts the fix while
// keeping every other pin intact, so pin the write counts.
assert.equal(
  (flat.match(/runAskedForApproval = false/gu) ?? []).length,
  1,
  "the latch is initialized once and NEVER reset mid-run",
);
assert.equal((flat.match(/runAskedForApproval = true/gu) ?? []).length, 1, "one arming site only");

// Armed by the STRICT detector, at the exact point the text streams to the
// user - lexically adjacent to the append, so a discarded repair round (whose
// prose the user never sees) can never bind the run.
assert.ok(
  flat.includes(
    "if (parsedAction.awaitingAuthorization || visibleTextAsksApplyPermission(action.visibleText)) { runAskedForApproval = true; } assistantText = appendVisibleText(assistantText, action.visibleText);",
  ),
  "arming must sit immediately before the visible-text append - only streamed asks bind the run",
);
assert.ok(
  !flat.includes("visibleTextRequestsUserApproval(action.visibleText)) { runAskedForApproval"),
  "the latch must use the strict detector, never the loose same-frame one",
);
// The same-frame deferral keeps the loose detector (staging behavior) AND
// consults the strict one, which covers interrogatives the loose regexes miss
// ("Shall I save it now?") - a frame that asks and stages the mutation must
// defer rather than execute past its own question.
assert.ok(flat.includes("visibleTextRequestsUserApproval(parsedAction.visibleText) ||"));
assert.ok(
  flat.includes("visibleTextAsksApplyPermission(parsedAction.visibleText) ||"),
  "the same-frame deferral must recognize every phrasing the latch would arm on",
);
assert.equal(
  visibleTextRequestsUserApproval("Shall I save it now?"),
  false,
  "documents the loose-detector gap the strict disjunct closes",
);
assert.equal(visibleTextAsksApplyPermission("Shall I save it now?"), true);
// The latch joins the deferral disjunction, so later described mutations in
// the same run are held behind Accept.
assert.ok(
  flat.includes("runAskedForApproval) && parsedAction.commands.some(isMutatingWorkspaceCommand);"),
  "the deferral must consider the run's earlier ask, not only the current round's text",
);
// Silent mutating frames after an ask are refused at the executor (Manual is
// carved out - its own floor plus manualApprovalArmed govern the post-Accept
// silent re-send; Bypass never holds).
assert.match(workspaceAgent, /private activeRoundAskLatchSilentMutationBlocked = false;/u);
assert.ok(
  flat.includes(
    'this.activeRoundAskLatchSilentMutationBlocked = runAskedForApproval && !action.visibleText && permissionsMode !== "manual" && permissionsMode !== "bypass";',
  ),
);
assert.ok(flat.includes("if (this.activeRoundAskLatchSilentMutationBlocked && isMutatingWorkspaceCommand(command)) {"));
assert.match(workspaceAgent, /only their reply or Accept can answer it/u);

// ── The dry-run result: truthful, conditional, mode-safe ────────────────────
assert.doesNotMatch(
  workspaceAgent,
  /Use apply:true only if the user asked you to make the change/u,
  "the old dry-run text re-posed the apply decision to Mari every round",
);
assert.doesNotMatch(
  workspaceAgent,
  /Never switch to apply:true on your own/u,
  "a blanket later-round ban breaks the sanctioned inspect-then-apply flows for directly requested changes",
);
assert.match(
  workspaceAgent,
  /the user cannot see this preview - apply:false renders no card or diff in the UI/u,
  "the dry-run result must state, truthfully, that previews are invisible to the user",
);
assert.match(workspaceAgent, /if instead you asked them whether to apply, wait for their answer/u);
assert.match(workspaceAgent, /never answer your own question/u);

// ── Prompt: propose maps to one held proposal; asks are binding; the hold ───
// claims are honest per mode (Plan refuses, Bypass never holds).
assert.match(workspaceAgent, /"Propose your edits" \/ "present a proposal" \/ "draft a change" style requests/u);
assert.match(workspaceAgent, /One response, one proposal, no duplicate work\./u);
assert.match(workspaceAgent, /the question is binding for the rest of the run/u);
assert.match(
  workspaceAgent,
  /outside Plan and Bypass, Marinara holds the commands and shows the user an Accept action/u,
  "the hold promise must be scoped to the modes that implement it",
);
assert.match(
  workspaceAgent,
  /Outside Plan and Bypass, Marinara enforces this by holding anything you stage after asking\./u,
);
assert.match(
  workspaceAgent,
  /A dry run renders nothing in the UI - the user cannot see it/u,
  "the apply:false rule must carry the invisibility fact",
);
// The home-widget template uses the same held-proposal shape - the old
// apply:false-then-confirm-then-apply:true template was the double-work
// pattern this fix removes.
assert.ok(
  !flat.includes("call `home_widget.create` with `apply:false`"),
  "the home-widget template must not model the preview-then-reapply double-step",
);
assert.match(workspaceAgent, /home_widget\.create\\` command with \\`apply:true\\` in the SAME response/u);

// ── Client: the Accept affordance survives what the chips slot does not ─────
// The chips store is a single app-wide ephemeral slot (a regular chat
// starting a generation clears it, so do the suggestions-disabled mount
// sweeps, and a reload never restores it) - but the deferral itself is
// persisted on the assistant message's extra. The client re-derives the
// Accept chip from that persisted truth, so a held proposal can never be
// orphaned by navigation.
const mariChat = readSource("packages/client/src/components/chat/HomeProfessorMariChat.tsx");
const mariChatFlat = mariChat.replace(/\s+/gu, " ");
assert.ok(
  mariChatFlat.includes("lastLoadedMessageExtra?.mariDeferredMutations === true"),
  "the derivation must read the same persisted flag the server arms the next run from",
);
assert.ok(
  mariChatFlat.includes(
    "pendingDeferredMutations && !storeChipsForChat.some((chip) => chip.id === MARI_AUTHORIZATION_ACCEPT_CHIP.id)",
  ),
  "the derived Accept chip renders while the persisted deferral is the chat's last word",
);
// Server and client both use the SHARED chip constant, so the event chip and
// the re-derived chip can never drift.
assert.ok(flat.includes("action.suggestions = [ MARI_AUTHORIZATION_ACCEPT_CHIP,"));
const sharedTypes = readSource("packages/shared/src/types/professor-mari-workspace.ts");
assert.match(sharedTypes, /export const MARI_AUTHORIZATION_ACCEPT_CHIP: MariSuggestionChip = \{/u);

console.log("Mari ask-latch regression passed.");
