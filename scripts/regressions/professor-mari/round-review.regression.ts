// Pins the per-round safety checks Professor Mari's loop runs after each command batch (completion-claim
// audit, read-back mismatch, repair budgets, repeated-failure stop, mutation deferral) as pure functions
// of explicit state. Recorded inputs only: no model, no network.
import assert from "node:assert/strict";
import {
  parseAssistantWorkspaceAction,
  READ_BACK_MISMATCH_SENTINEL,
  READ_BACK_VERIFIED_SENTINEL,
  STAGED_SENSITIVE_CHANGE_PREFIX,
  workspaceTextClaimsHeldChange,
  workspaceTextClaimsMutationCompletion,
  type WorkspaceCommandResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  closingAnswerGetsNotice,
  newRoundReviewState,
  reviewRepeatedFailures,
  reviewRoundClaim,
  shouldDeferRoundMutations,
} from "../../../packages/server/src/services/professor-mari/workspace-round-review.js";

const frame = (say: string, commands: unknown[] = [], stop = true) =>
  parseAssistantWorkspaceAction(JSON.stringify({ say, commands, stop }));

const appData = (output: string, success = true): WorkspaceCommandResult => ({
  id: "m1",
  name: "app_data",
  input: { action: "character.update", characterId: "c1", apply: true },
  output,
  success,
});
const mutationOutput = (sentinel: string) =>
  `${sentinel}\nCommand: app_data character.update\nExit code: 0 (structured app-data runtime)\n\nstdout:\n{ "saved": true }`;

// A clean round: a plain answer with no completion claim passes untouched.
{
  const state = newRoundReviewState();
  const decision = reviewRoundClaim(state, {
    action: frame("Here is what the character card says."),
    commandResultsForContinuity: [],
    truncated: false,
  });
  assert.deepEqual(decision, { kind: "continue" });
}

// A verified mutation backs its completion claim and consumes the evidence (watermark moves).
{
  const state = newRoundReviewState();
  const results = [appData(mutationOutput(READ_BACK_VERIFIED_SENTINEL))];
  const decision = reviewRoundClaim(state, {
    action: frame("I updated the character."),
    commandResultsForContinuity: results,
    truncated: false,
  });
  assert.deepEqual(decision, { kind: "continue" });
  assert.equal(state.claimAuditWatermark, 1);
  assert.equal(state.hadPassedClaimAudit, true);
}

// A terminal recap may repeat the last audited mutation after its evidence was consumed.
{
  const claim = "I updated the character.";
  const results = [appData(mutationOutput(READ_BACK_VERIFIED_SENTINEL))];
  const read: WorkspaceCommandResult = {
    id: "r1",
    name: "app_data",
    input: { action: "character.get", characterId: "c1" },
    output: '{"id":"c1"}',
    success: true,
  };
  for (const freshRead of [false, true]) {
    for (const [text, terminal, expected] of [
      [claim, true, "continue"],
      ["Done.", true, "continue"],
      ["I updated another character.", true, "repair"],
      ["I deleted the character.", true, "repair"],
      [`${claim} I also created a lorebook.`, true, "repair"],
      [claim, false, "repair"],
    ] as const) {
      const state = newRoundReviewState();
      assert.deepEqual(
        reviewRoundClaim(state, {
          action: frame(claim, [{ name: "app_data", arguments: read.input }], false),
          commandResultsForContinuity: results,
          truncated: false,
        }),
        { kind: "continue" },
      );
      assert.equal(state.claimAuditWatermark, results.length);
      const decision = reviewRoundClaim(state, {
        action: frame(text, terminal ? [] : [{ name: "app_data", arguments: read.input }], terminal),
        commandResultsForContinuity: freshRead ? [...results, read] : results,
        truncated: false,
      });
      assert.equal(decision.kind, expected, `${text} (terminal=${terminal}, freshRead=${freshRead})`);
      if (text === claim && terminal) {
        assert.equal(state.claimAuditWatermark, results.length, "a matching recap does not consume more evidence");
        assert.equal(state.verificationRepairRounds, 0, "a matching recap spends no repair budget");
      }
    }
  }

  // A matching recap still cannot paper over a later failed or preview-only mutation.
  for (const unapplied of [
    { ...appData("Error: update failed"), success: false },
    { ...appData('{"preview":true}'), input: { action: "character.update", characterId: "c1", apply: false } },
  ]) {
    const state = newRoundReviewState();
    reviewRoundClaim(state, { action: frame(claim), commandResultsForContinuity: results, truncated: false });
    assert.equal(
      reviewRoundClaim(state, {
        action: frame(claim),
        commandResultsForContinuity: [...results, unapplied, read],
        truncated: false,
      }).kind,
      "repair",
    );
  }
}

// A false "done" with no mutation behind it is sent back for repair, then stops once the budget is spent - in a run
// that tried a change (#8711: here one the loop held, so it left no result).
{
  const state = newRoundReviewState();
  state.changeTried = true;
  const claim = () =>
    reviewRoundClaim(state, {
      action: frame("Done - I created the lorebook entry."),
      commandResultsForContinuity: [],
      truncated: false,
    });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const decision = claim();
    assert.equal(decision.kind, "repair");
    assert.match(
      (decision as { prompt: string }).prompt,
      /no mutating command succeeded since your last checked reply \(anything applied before it still stands\)/u,
    );
  }
  const stopped = claim();
  assert.equal(stopped.kind, "stop");
  assert.match((stopped as { content: string }).content, /could not verify the requested workspace change/u);
}

// #8711: a closing answer of a run that tried no change keeps its words: no repair and no budget spent. A claim check
// that flags them gives the reply the notice; code, a blockquote or a quoted phrase is never read. Narration beside
// commands, and every run that tried a change, are repaired as before.
{
  const draftList = [
    "Here are 12 short item descriptions you can paste into another screen:",
    ...Array.from({ length: 11 }, (_, index) =>
      index % 2 === 0
        ? `${index + 1}. Starlit lantern ${index + 1}: a brass lantern that is created from a fallen star.`
        : `${index + 1}. Rainy-day ledger ${index + 1}: old letters that are saved for a quiet evening.`,
    ),
    "12. Fortune card: Your fate has been written in starlight.",
  ].join("\n");
  // The issue's step 5: asked whether her reply format could confuse the review system, she explains the flow.
  const step5 =
    "Possibly. If a reply that made no change says a change is held for your review, or that a change card is ready, the check replaces it. In Manual mode, every edit is held for your approval until you press Accept.";
  const closing: Array<[text: string, flagged: boolean]> = [
    [draftList, true],
    ['A reply like "The entry is created and the card was updated." reads as a finished change.', false],
    // Single quotes are never stripped (too often apostrophes), so a single-quoted example keeps its text with the notice.
    ["Phrases such as 'it is saved' or 'the change is held for your review' trip the check.", true],
    // An apostrophe never opens a quote that hides a real claim (the verifier's sentences; staging flags them too).
    ["The '90s theme is set for the users', and the admins' view stays.", true],
    ["The '90s theme is set for the twins'.", true],
    ["The '90s theme is set in the users' 3 profiles.", true],
    ["The '90s theme is set for the users' **profiles**.", true],
    ["Got 'em: the palette is saved for the Joneses'.", true],
    ["```text\nstatus: it is saved\nThe change is held for your review.\n```\nThat block is only an example.", false],
    ["Write `the card is updated` in the note, then:\n\n> Your changes are saved.", false],
    ["In Accept edits mode, each change is applied right away and a change card is added under my reply.", true],
    [step5, true],
    ["Done! Your greeting has been updated.", true],
    ["Yes, it's saved.", true],
    ["Sure, I've staged the rename for your review.", true],
  ];
  const docsRead: WorkspaceCommandResult = {
    id: "d1",
    name: "docs_read",
    input: { path: "home/mari.md" },
    output: "The change card flow.",
    success: true,
  };
  for (const [text, flagged] of closing) {
    for (const results of [[], [docsRead]]) {
      const label = `${text.slice(0, 48)} (results=${results.length})`;
      const state = newRoundReviewState();
      const decision = reviewRoundClaim(state, {
        action: frame(text),
        commandResultsForContinuity: results,
        truncated: false,
      });
      assert.deepEqual(decision, { kind: flagged ? "notice" : "continue" }, label);
      assert.equal(state.verificationRepairRounds + state.midRunClaimRepairRounds, 0, label);
    }
  }

  // Narration beside a real command keeps the step repair, in a run that tried no change too.
  const midRun = reviewRoundClaim(newRoundReviewState(), {
    action: frame(
      "I've created entry A. Now let me check entry B.",
      [{ name: "read", arguments: { path: "b.md" } }],
      false,
    ),
    commandResultsForContinuity: [{ ...docsRead, name: "read", input: { path: "b.md" } }],
    truncated: false,
  });
  assert.equal(midRun.kind, "repair");
  assert.match((midRun as { prompt: string }).prompt, /You claimed a step was completed/u);

  // Any change tried - failed, previewed, a shell command or a staged sensitive file - and the closing claim is
  // repaired as before, with no notice.
  const tried: WorkspaceCommandResult[] = [
    { ...appData("Error: update failed"), success: false },
    { ...appData('{"preview":true}'), input: { action: "character.update", characterId: "c1", apply: false } },
    { id: "b1", name: "bash", input: { command: "ls" }, output: "Command: ls\nExit code: 0", success: true },
    {
      id: "w1",
      name: "write",
      input: { path: ".env", content: "x" },
      output: `${STAGED_SENSITIVE_CHANGE_PREFIX} .env`,
      success: true,
    },
  ];
  for (const result of tried) {
    const decision = reviewRoundClaim(newRoundReviewState(), {
      action: frame("Done! Your greeting has been updated."),
      commandResultsForContinuity: [result],
      truncated: false,
    });
    assert.equal(decision.kind, "repair", result.name);
  }
  // A change that never ran (here a cut-off frame) still counts for the rest of the run.
  {
    const state = newRoundReviewState();
    const write = { name: "write", arguments: { path: "greeting.md", content: "x" } };
    reviewRoundClaim(state, {
      action: frame("Writing it.", [write], false),
      commandResultsForContinuity: [],
      truncated: true,
    });
    assert.equal(state.changeTried, true);
    const claim = {
      action: frame("Done! Your greeting has been updated."),
      commandResultsForContinuity: [],
      truncated: false,
    };
    assert.equal(reviewRoundClaim(state, claim).kind, "repair");
    assert.equal(closingAnswerGetsNotice(state, "Done! Your greeting has been updated.", "none"), false);
  }

  // The frame says when it sent a change that will not run: beside a question, or in a frame the protocol rejects.
  const parse = (payload: Record<string, unknown>) => parseAssistantWorkspaceAction(JSON.stringify(payload));
  const write = { name: "write", arguments: { path: "greeting.md", content: "x" } };
  for (const unrun of [
    parse({
      say: "Which tone?",
      ask: [{ question: "Which?", options: [{ label: "A" }, { label: "B" }] }],
      commands: [write],
    }),
    parse({ say: "", commands: [write, { name: "not_a_tool", arguments: {} }], stop: false }),
  ]) {
    assert.equal(unrun.commands.length, 0, "the change does not run");
    assert.equal(unrun.triedChange, true);
  }
  assert.equal(parse({ say: "", commands: [{ name: "bash", arguments: { command: "ls" } }] }).triedChange, true);
  assert.equal(parse({ say: "", commands: [{ name: "read", arguments: { path: "a.md" } }] }).triedChange, false);

  // Only closed code is stripped, and a quote never pairs across a sentence or on an apostrophe or plural possessive.
  for (const text of [
    "```\nI have updated the card.",
    "The '90s theme is set. Users' names stay.",
    "The '90s theme is set and Users' names stay.",
    'A stray " mark. I\'ve saved the layout, see "Margins".',
  ]) {
    assert.equal(workspaceTextClaimsMutationCompletion(text), true, text);
  }
  assert.equal(workspaceTextClaimsHeldChange("```\nThe change is held for your review."), true);
}

// A read-back mismatch under a completion claim must not be claimed as success.
{
  const state = newRoundReviewState();
  const decision = reviewRoundClaim(state, {
    action: frame("The character was updated."),
    commandResultsForContinuity: [appData(mutationOutput(READ_BACK_MISMATCH_SENTINEL))],
    truncated: false,
  });
  assert.equal(decision.kind, "repair");
  assert.match((decision as { prompt: string }).prompt, /did NOT persist as intended/u);
}

// A truncated frame that still carries commands is never audited (the loop refuses to judge half a frame).
{
  const state = newRoundReviewState();
  const decision = reviewRoundClaim(state, {
    action: frame("Done.", [{ name: "read", arguments: { path: "a.md" } }], false),
    commandResultsForContinuity: [],
    truncated: true,
  });
  assert.deepEqual(decision, { kind: "continue" });
}

// The same failure three times stops the loop; a different failure resets nothing but counts on its own.
{
  const state = newRoundReviewState();
  const failing = (output: string): WorkspaceCommandResult => ({
    id: "f",
    name: "read",
    input: { path: "missing.md" },
    output,
    success: false,
  });
  assert.equal(reviewRepeatedFailures(state, [failing("ENOENT")]), null);
  assert.equal(reviewRepeatedFailures(state, [failing("other error")]), null);
  assert.equal(reviewRepeatedFailures(state, [failing("ENOENT")]), null);
  const stop = reviewRepeatedFailures(state, [failing("ENOENT")]);
  assert.match(stop ?? "", /hit the same read error 3 times/u);
  assert.match(stop ?? "", /Error: ENOENT$/u);
}

// Deferral: Manual holds a described mutation, Bypass and Plan never do, and a silent frame is never held.
{
  const mutation = [{ name: "app_data", arguments: { action: "character.update", apply: true } }];
  const described = frame("I will rename the card.", mutation, false);
  const silent = frame("", mutation, false);
  const decide = (permissionsMode: "manual" | "bypass" | "plan" | "auto", parsedAction = described, asked = false) =>
    shouldDeferRoundMutations({ permissionsMode, parsedAction, runAskedForApproval: asked });
  assert.equal(decide("manual"), true);
  assert.equal(decide("bypass"), false);
  assert.equal(decide("plan"), false);
  assert.equal(decide("auto"), false);
  assert.equal(decide("auto", described, true), true, "an earlier ask binds the run");
  assert.equal(decide("manual", silent), false);
  assert.equal(decide("manual", frame("Looking now.", [{ name: "read", arguments: { path: "a.md" } }], false)), false);
}

console.log("Professor Mari round-review regression passed.");
