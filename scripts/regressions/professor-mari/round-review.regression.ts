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
  keepsFlaggedReply,
  newRoundReviewState,
  NOTHING_CHANGED_NOTICE,
  nothingChangedNotice,
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
// that tried a change (here one the loop held for approval, so it left no result).
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

// #8711: a run that tried no change changed nothing and holds nothing, so a reply a claim check flags keeps its words:
// no repair, no budget spent, and the run's reply gets the notice. A phrase in code, a blockquote or a quote is never
// read, so those replies get no notice either.
{
  const draftList = [
    "Here are 12 short item descriptions you can paste into the other screen:",
    ...Array.from({ length: 11 }, (_, index) =>
      index % 2 === 0
        ? `${index + 1}. Starlit lantern ${index + 1}: a brass lantern that is created from a fallen star.`
        : `${index + 1}. Rainy-day ledger ${index + 1}: old letters that are saved for a quiet evening.`,
    ),
    "12. Fortune card: Your fate has been written in starlight.",
  ].join("\n");
  const step5 =
    "Possibly. If a reply that made no change says a change is held for your review, or that a change card is ready, the check replaces it. In Manual mode, every edit is held for your approval until you press Accept.";
  const kept: Array<[text: string, flagged: boolean]> = [
    [draftList, true],
    ['A reply like "The entry is created and the card was updated." reads as a finished change.', false],
    ["Phrases such as 'it is saved' or 'the change is held for your review' trip the check.", false],
    ["```text\nstatus: it is saved\nThe change is held for your review.\n```\nThat block is only an example.", false],
    ["Write `the card is updated` in the note, then:\n\n> Your changes are saved.", false],
    [
      "In Accept edits mode, each change you ask for is applied right away and a change card is added under my reply, so you can undo it. In Manual mode it waits on the card until you press Accept.",
      true,
    ],
    [step5, true],
    ["Here's an example: the change is held for your review.", true],
    // Real false claims keep their words too; the notice says nothing was changed or held.
    ["Done! Your greeting has been updated.", true],
    ["Yes, it's saved.", true],
    ["Sure, I've staged the rename for your review.", true],
    ["The rename is held for your review until you press Accept.", true],
    ["All three of your changes are ready for your review.", true],
  ];
  const docsSearch: WorkspaceCommandResult = {
    id: "d1",
    name: "docs_search",
    input: { query: "change cards" },
    output: "results",
    success: true,
  };
  for (const [text, flagged] of kept) {
    for (const [results, terminal] of [
      [[], true],
      [[docsSearch], true],
      [[docsSearch], false],
    ] as const) {
      const label = `${text.slice(0, 48)} (terminal=${terminal}, results=${results.length})`;
      const state = newRoundReviewState();
      const decision = reviewRoundClaim(state, {
        action: frame(text, terminal ? [] : [{ name: "docs_read", arguments: { path: "home/mari.md" } }], terminal),
        commandResultsForContinuity: [...results],
        truncated: false,
      });
      assert.deepEqual(decision, { kind: "continue" }, label);
      assert.equal(state.verificationRepairRounds + state.midRunClaimRepairRounds, 0, label);
      assert.equal(nothingChangedNotice(state), flagged ? NOTHING_CHANGED_NOTICE : null, label);
    }
  }

  // Once a change was tried - and failed, or was held - a false claim about it is repaired as before.
  const failedUpdate = { ...appData("Error: update failed"), success: false };
  for (const text of ["Done! Your greeting has been updated.", "Yes, it's saved.", "I updated the card."]) {
    const decision = reviewRoundClaim(newRoundReviewState(), {
      action: frame(text),
      commandResultsForContinuity: [failedUpdate],
      truncated: false,
    });
    assert.equal(decision.kind, "repair", text);
    assert.match((decision as { prompt: string }).prompt, /no mutating command succeeded/u, text);
    const held = newRoundReviewState();
    held.changeTried = true;
    assert.equal(
      reviewRoundClaim(held, { action: frame(text), commandResultsForContinuity: [], truncated: false }).kind,
      "repair",
      `${text} (held)`,
    );
    assert.equal(nothingChangedNotice(held), null);
  }

  // The flag is kept for the run: a change whose round was discarded (here cut off, so it never ran and was never
  // audited) still makes the next round's claim a change run's.
  {
    const state = newRoundReviewState();
    const write = { name: "write", arguments: { path: "greeting.md", content: "x" } };
    reviewRoundClaim(state, {
      action: frame("Writing it.", [write], false),
      commandResultsForContinuity: [],
      truncated: true,
    });
    assert.equal(state.changeTried, true);
    assert.equal(
      reviewRoundClaim(state, {
        action: frame("Done! Your greeting has been updated."),
        commandResultsForContinuity: [],
        truncated: false,
      }).kind,
      "repair",
    );
  }

  // A change tried after a kept reply withdraws the notice: the run may have changed something after all.
  {
    const state = newRoundReviewState();
    reviewRoundClaim(state, {
      action: frame("I've updated it.", [{ name: "docs_read", arguments: { path: "home/mari.md" } }], false),
      commandResultsForContinuity: [docsSearch],
      truncated: false,
    });
    assert.equal(nothingChangedNotice(state), NOTHING_CHANGED_NOTICE);
    reviewRoundClaim(state, {
      action: frame("", [{ name: "write", arguments: { path: "greeting.md", content: "x" } }], false),
      commandResultsForContinuity: [docsSearch],
      truncated: false,
    });
    assert.equal(nothingChangedNotice(state), null);
    assert.equal(keepsFlaggedReply(state), false, "a tried change is no longer kept");
  }

  // A change sent beside a question is set aside unrun; the frame says so, and the loop marks the run with it.
  const beside = parseAssistantWorkspaceAction(
    JSON.stringify({
      say: "Which tone next?",
      ask: [{ question: "Which tone?", options: [{ label: "Dark" }, { label: "Light" }] }],
      commands: [{ name: "write", arguments: { path: "greeting.md", content: "x" } }],
      stop: false,
    }),
  );
  assert.equal(beside.commands.length, 0, "a change beside a question does not run");
  assert.equal(beside.changeBesideQuestion, true);
  assert.equal(frame("Which tone next?").changeBesideQuestion, false);
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
