// Pins the per-round safety checks Professor Mari's loop runs after each command batch (completion-claim
// audit, read-back mismatch, repair budgets, repeated-failure stop, mutation deferral) as pure functions
// of explicit state. Recorded inputs only: no model, no network.
import assert from "node:assert/strict";
import {
  parseAssistantWorkspaceAction,
  READ_BACK_MISMATCH_SENTINEL,
  READ_BACK_VERIFIED_SENTINEL,
  type WorkspaceCommandResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
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

// A false "done" with no mutation behind it is sent back for repair, then stops once the budget is spent.
{
  const state = newRoundReviewState();
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

// #8711: a text-only answer in a run that tried no change keeps its words. A draft list whose items say "is created"
// or "are saved", a quoted example or code block, and an explanation of the change-card flow all pass untouched.
{
  const draftList = [
    "Here are 12 short item descriptions you can paste into the other screen:",
    ...Array.from({ length: 12 }, (_, index) =>
      index % 2 === 0
        ? `${index + 1}. Starlit lantern ${index + 1}: a brass lantern that is created from a fallen star.`
        : `${index + 1}. Rainy-day ledger ${index + 1}: old letters that are saved for a quiet evening.`,
    ),
  ].join("\n");
  const quoted = [
    'A reply like "The entry is created and the card was updated." reads as a finished change.',
    "> Your changes are saved.",
    "```text\nstatus: it is saved\n```",
  ].join("\n\n");
  const flow =
    "In Accept edits mode, each change you ask for is applied right away and a change card is added under my reply, so you can undo it. In Manual mode it waits on the card until you press Accept.";
  const docsSearch: WorkspaceCommandResult = {
    id: "d1",
    name: "docs_search",
    input: { query: "change cards" },
    output: "results",
    success: true,
  };
  for (const text of [draftList, quoted, flow]) {
    for (const [results, terminal] of [
      [[], true],
      [[docsSearch], true],
      [[docsSearch], false],
    ] as const) {
      const state = newRoundReviewState();
      const decision = reviewRoundClaim(state, {
        action: frame(text, terminal ? [] : [{ name: "docs_read", arguments: { path: "home/mari.md" } }], terminal),
        commandResultsForContinuity: [...results],
        truncated: false,
      });
      assert.deepEqual(decision, { kind: "continue" }, `${text.slice(0, 40)} (terminal=${terminal})`);
      assert.equal(state.verificationRepairRounds + state.midRunClaimRepairRounds, 0);
    }
  }

  // A real unsupported claim is still sent back: her own claim with nothing tried, and any claim wording once a
  // change was tried and failed, or was held for approval (classic holds the round's calls before the audit).
  const failedUpdate = { ...appData("Error: update failed"), success: false };
  for (const [text, results, mutationHeld] of [
    ["I updated the card.", [], false],
    ["Updated.", [], false],
    ["The card is updated.", [failedUpdate], false],
    ["The card is updated. Should I keep going?", [], true],
  ] as const) {
    const decision = reviewRoundClaim(newRoundReviewState(), {
      action: frame(text),
      commandResultsForContinuity: [...results],
      truncated: false,
      mutationHeld,
    });
    assert.equal(decision.kind, "repair", text);
    assert.match((decision as { prompt: string }).prompt, /no mutating command succeeded/u, text);
  }
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
