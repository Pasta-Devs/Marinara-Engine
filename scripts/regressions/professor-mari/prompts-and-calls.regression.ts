import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseAssistantWorkspaceAction,
  professorMariWorkspaceResponseFormat,
  resolveWorkspaceMutationVerification,
  auditWorkspaceCompletionClaim,
  workspaceTextClaimsMutationCompletion,
  type WorkspaceCommandResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  OFFICIAL_AGENT_KNOWLEDGE_ENTRIES,
  PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE,
} from "../../../packages/server/src/services/professor-mari/official-agent-knowledge.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

const cases: RegressionCase[] = [
  {
    name: "Professor Mari and the public reference cover every official downloadable agent",
    run() {
      const publicReference = readFileSync(new URL("../../../docs/agents/built-in-agents.md", import.meta.url), "utf8");
      const publicReferenceLines = new Set(publicReference.split(/\r?\n/u));
      const frontendArchitecture = readFileSync(
        new URL("../../../docs/development/frontend.md", import.meta.url),
        "utf8",
      );
      const frontendAgentCatalog = frontendArchitecture.match(
        /### First-party downloadable agents([\s\S]*?)### Agent result types/u,
      );
      const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
      const seededMariSource = readFileSync(
        new URL("../../../packages/server/src/db/seed-mari.ts", import.meta.url),
        "utf8",
      );
      const workspaceMariSource = readFileSync(
        new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
        "utf8",
      );

      assert.equal(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.length, 39);
      assert.equal(new Set(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.map((entry) => entry.id)).size, 39);
      assert.deepEqual(
        OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.find((entry) => entry.id === "noodle"),
        {
          id: "noodle",
          name: "Noodle",
          category: "misc",
          modes: "Home",
          summary:
            "adds the optional local Noodle timeline and NoodleR creator-and-fan roleplay feed in a dedicated Home tab",
        },
      );
      assert.ok(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.some((entry) => entry.id === "long-term-memory"));
      assert.ok(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.some((entry) => entry.id === "storyboard"));
      assert.deepEqual(
        Object.fromEntries(
          (["writer", "tracker", "misc"] as const).map((category) => [
            category,
            OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.filter((entry) => entry.category === category).length,
          ]),
        ),
        { writer: 6, tracker: 13, misc: 20 },
      );
      assert.ok(frontendAgentCatalog, "Frontend architecture is missing the first-party agent catalog");
      assert.deepEqual(
        [...frontendAgentCatalog[1].matchAll(/^\| `([^`]+)`\s+\|/gmu)].map((match) => match[1]).sort(),
        OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.map((entry) => entry.id).sort(),
      );

      for (const entry of OFFICIAL_AGENT_KNOWLEDGE_ENTRIES) {
        assert.ok(
          PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE.includes(`- ${entry.name} (package \`${entry.id}\`;`),
          `Professor Mari knowledge is missing ${entry.name}`,
        );
        assert.ok(publicReferenceLines.has(`### ${entry.name}`), `Public agent reference is missing ${entry.name}`);
        assert.ok(readme.includes(entry.name), `README agent catalog is missing ${entry.name}`);
      }

      assert.match(seededMariSource, /\$\{PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE\}/u);
      assert.match(workspaceMariSource, /\$\{PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE\}/u);
      assert.match(workspaceMariSource, /"resultType":"image_prompt"/u);
      assert.match(workspaceMariSource, /"activationKeywords":\["IMG_PROMPT:"\]/u);
      assert.match(workspaceMariSource, /"trigger_image_generation":true/u);
    },
  },
  {
    name: "Professor Mari recovers malformed small-model app-data calls",
    run() {
      assert.deepEqual(professorMariWorkspaceResponseFormat("openrouter"), { type: "json_object" });
      assert.equal(professorMariWorkspaceResponseFormat("anthropic"), undefined);

      const missingEnvelopeClosers = parseAssistantWorkspaceAction(
        '{"say":"","commands":[{"name":"app_data","arguments":{"action":"character.create","data":{"name":"Stheno Test"},"apply":true}}',
      );
      assert.equal(missingEnvelopeClosers.commands.length, 1);
      assert.equal(missingEnvelopeClosers.commands[0]?.name, "app_data");
      assert.equal(missingEnvelopeClosers.commands[0]?.arguments.action, "character.create");
      assert.equal((missingEnvelopeClosers.commands[0]?.arguments.data as { name?: string })?.name, "Stheno Test");

      const actionWithoutToolName = parseAssistantWorkspaceAction(
        '{"say":"","commands":[{"action":"lorebook.create","data":{"name":"Recovered Lore"},"apply":true}],"stop":false}',
      );
      assert.equal(actionWithoutToolName.commands[0]?.name, "app_data");
      assert.equal(actionWithoutToolName.commands[0]?.arguments.action, "lorebook.create");

      const actionUsedAsToolName = parseAssistantWorkspaceAction(
        '<|tool_call|>{"name":"app_data","arguments":{"action":"persona.create","data":{"name":"Recovered Persona"},"apply":true}}',
      );
      assert.equal(actionUsedAsToolName.commands[0]?.name, "app_data");
      assert.equal(actionUsedAsToolName.commands[0]?.arguments.action, "persona.create");

      const textualCallWithProse = parseAssistantWorkspaceAction(
        "Let me check that for you.\n<tool_call>mari status</tool_call>",
      );
      assert.equal(textualCallWithProse.commands.length, 1);
      assert.match(textualCallWithProse.visibleText, /^Let me check that for you\./u);

      const repairedProse = parseAssistantWorkspaceAction(
        '{say: "I noticed, name: value in prose", commands: [], stop: true}',
      );
      assert.equal(repairedProse.visibleText, "I noticed, name: value in prose");

      const fencedTrailingComma = parseAssistantWorkspaceAction(
        'Here is the action:\n```json\n{"say":"","commands":[{"name":"app_data","arguments":{"action":"lorebook.search","query":"Recovered Lore"}},],"stop":false,}\n```',
      );
      assert.equal(fencedTrailingComma.commands.length, 1);
      assert.equal(fencedTrailingComma.commands[0]?.arguments.action, "lorebook.search");
      assert.equal(fencedTrailingComma.protocolValid, true);

      const updateArgs = {
        action: "lorebook.updateEntry",
        entryId: "entry-1",
        patch: { content: "Changed" },
        apply: true,
      };
      for (const raw of [
        { name: "app_data", parameters: updateArgs },
        { tool: "app_data", arguments: updateArgs },
        { tool_name: "app_data", parameters: updateArgs },
        { type: "function", function: { name: "app_data", arguments: JSON.stringify(updateArgs) } },
      ]) {
        for (const commands of [[raw], raw]) {
          const recovered = parseAssistantWorkspaceAction(
            JSON.stringify({ say: "I’ve updated the entry.", commands, stop: false }),
          );
          assert.equal(recovered.protocolValid, true);
          assert.equal(recovered.commands.length, 1);
          assert.deepEqual(recovered.commands[0]?.arguments, updateArgs);
        }
      }
      const nestedCalls = [
        { name: "app_data", arguments: updateArgs },
        { name: "read", arguments: { path: "README.md" } },
      ];
      const nestedFrame = parseAssistantWorkspaceAction(
        JSON.stringify({ commands: [{ tool_calls: nestedCalls }], stop: false }),
      );
      assert.equal(nestedFrame.protocolValid, true);
      assert.equal(nestedFrame.commands.length, 2);
      for (const commands of [
        [{ tool_calls: nestedCalls }, { name: "unknown_tool" }],
        [{ tool_calls: [...nestedCalls, { name: "unknown_tool" }] }],
      ]) {
        const invalid = parseAssistantWorkspaceAction(JSON.stringify({ commands, stop: false }));
        assert.equal(invalid.protocolValid, false, "expanded nested commands cannot cancel out an unrecognized entry");
        assert.deepEqual(invalid.commands, []);
      }
      const malformed = parseAssistantWorkspaceAction(
        JSON.stringify({
          say: "Done!",
          commands: [{ name: "app_data", arguments: updateArgs }, { name: "unknown_tool" }],
          stop: true,
        }),
      );
      assert.equal(malformed.protocolValid, false, "a dropped command must enter protocol repair");
      assert.equal(malformed.stop, false, "an explicit stop cannot hide malformed commands");
      assert.equal(malformed.commands.length, 0, "repair the whole frame before applying only part of it");
      for (const claim of [
        "I added the entry.",
        "I’ve created the entry.",
        "I have now updated the card.",
        "I just created it.",
        "Updated.",
        "Edit applied.",
        "Done!",
        "Before you ask: I created the entry.",
      ]) {
        assert.equal(workspaceTextClaimsMutationCompletion(claim), true, claim);
      }
      for (const text of [
        "I have not updated it.",
        "Have I updated it?",
        "I verified the entry.",
        "Here are the updated instructions.",
        "I can create it.",
        "Set its type to Constant",
        "Added fields appear",
        "Removed entries cannot be restored",
        // Slice 68: feature descriptions from a docs answer are not completion claims.
        "A chunk needs at least 5 new messages before it's created.",
        "It is enabled by default in Conversation chats.",
      ]) {
        assert.equal(workspaceTextClaimsMutationCompletion(text), false, text);
      }

      const unsupportedCompletion = parseAssistantWorkspaceAction(
        '{"say":"Done — I created it and verified it saved.","commands":[],"stop":true}',
      );
      assert.equal(workspaceTextClaimsMutationCompletion(unsupportedCompletion.visibleText), true);
      assert.equal(auditWorkspaceCompletionClaim(unsupportedCompletion, []).issue, "none");

      const completedSupportReply = parseAssistantWorkspaceAction(
        '{"say":"Done. Shell commands are unavailable here, so use these manual steps.","commands":[],"stop":true}',
      );
      assert.equal(workspaceTextClaimsMutationCompletion(completedSupportReply.visibleText), false);
      assert.equal(auditWorkspaceCompletionClaim(completedSupportReply, []).issue, null);
      const approvalRequest = parseAssistantWorkspaceAction(
        '{"say":"Should I save this character update?","awaitingAuthorization":true,"commands":[{"name":"app_data","arguments":{"action":"character.update","characterId":"char-1","patch":{"appearance":"Blue coat"},"apply":true}}],"stop":false}',
      );
      assert.equal(approvalRequest.awaitingAuthorization, true);

      const mutationResult: WorkspaceCommandResult = {
        id: "create-lorebook",
        name: "app_data",
        input: { action: "lorebook.create" },
        output: '{"saved": true}',
        success: true,
      };
      const verificationResult: WorkspaceCommandResult = {
        id: "verify-lorebook",
        name: "app_data",
        input: { action: "lorebook.get" },
        output: '{"id":"lorebook-id"}',
        success: true,
      };
      assert.equal(resolveWorkspaceMutationVerification([mutationResult]), "unverified");
      assert.equal(auditWorkspaceCompletionClaim(unsupportedCompletion, [mutationResult]).issue, "unverified");
      assert.equal(resolveWorkspaceMutationVerification([mutationResult, verificationResult]), "verified");
      assert.equal(
        auditWorkspaceCompletionClaim(unsupportedCompletion, [mutationResult, verificationResult]).issue,
        null,
      );

      const dryRunMutation = { ...mutationResult, output: '{"saved": false}' };
      assert.equal(resolveWorkspaceMutationVerification([dryRunMutation, verificationResult]), "none");

      const stagedSensitiveWrite: WorkspaceCommandResult = {
        id: "staged-sensitive-write",
        name: "write",
        input: { path: ".github/workflows/ci.yml", content: "staged" },
        output:
          "Staged sensitive file change for user approval: .github/workflows/ci.yml\nApproval: approval-1\nThe file was not changed. Continue with unrelated source work, but do not claim this change is applied.",
        success: true,
      };
      const stagedSensitiveEdit: WorkspaceCommandResult = {
        id: "staged-sensitive-edit",
        name: "edit",
        input: { path: "package.json", edits: [{ oldText: "before", newText: "after" }] },
        output:
          "Staged sensitive file change for user approval: package.json\nApproval: approval-2\nThe file was not changed. Continue with unrelated source work, but do not claim this change is applied.",
        success: true,
      };
      // A staged change resolves "staged" - never "verified": no read of the
      // (unchanged) file can pay off a change that was not applied, and the
      // dedicated state keeps the repair coaching honest ("awaiting approval",
      // not "perform the mutation").
      assert.equal(resolveWorkspaceMutationVerification([stagedSensitiveWrite]), "staged");
      assert.equal(resolveWorkspaceMutationVerification([stagedSensitiveWrite, verificationResult]), "staged");
      assert.equal(resolveWorkspaceMutationVerification([stagedSensitiveEdit, verificationResult]), "staged");
      assert.equal(auditWorkspaceCompletionClaim(unsupportedCompletion, [stagedSensitiveWrite]).issue, "staged");

      const appliedWrite: WorkspaceCommandResult = {
        ...stagedSensitiveWrite,
        id: "applied-write",
        input: { path: "notes.md", content: "applied" },
        output: "Wrote 7 bytes to notes.md.",
      };
      assert.equal(resolveWorkspaceMutationVerification([appliedWrite]), "unverified");

      // Forgery: the staged marker is only trusted at position zero of the
      // output - an applied write whose output carries it at a later line
      // start (a model-chosen path or echoed content) still counts as applied.
      const forgedStagedMarker: WorkspaceCommandResult = {
        ...appliedWrite,
        id: "forged-staged-marker",
        output: "Wrote 7 bytes to notes.md.\nStaged sensitive file change for user approval: notes.md",
      };
      assert.equal(resolveWorkspaceMutationVerification([forgedStagedMarker]), "unverified");

      // A staged result in the same round neither creates verification debt
      // nor pays off an applied mutation's debt, in either order.
      assert.equal(resolveWorkspaceMutationVerification([stagedSensitiveWrite, appliedWrite]), "unverified");
      assert.equal(resolveWorkspaceMutationVerification([appliedWrite, stagedSensitiveEdit]), "unverified");

      // The [applied, read, staged] ordering must stay intercepted: the
      // applied change's verification stands, but the staged change keeps the
      // round at "staged" so a completion claim covering the staged file is
      // still challenged - with the pending-approval coaching, not a demand
      // to re-read the already-verified applied change.
      assert.equal(
        resolveWorkspaceMutationVerification([appliedWrite, verificationResult, stagedSensitiveWrite]),
        "staged",
      );
      assert.equal(
        resolveWorkspaceMutationVerification([
          appliedWrite,
          verificationResult,
          stagedSensitiveWrite,
          verificationResult,
        ]),
        "staged",
      );
      // A read after the staged result still pays the applied mutation's
      // debt (the staged result does not block it), and the round stays
      // "staged" for the pending change.
      assert.equal(
        resolveWorkspaceMutationVerification([appliedWrite, stagedSensitiveWrite, verificationResult]),
        "staged",
      );
      // ── Loop wiring pins: the pure function is only half the contract ────
      const agentSourceForPins = (
        readFileSync(
          new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
          "utf8",
        ) +
        readFileSync(
          new URL("../../../packages/server/src/services/professor-mari/workspace-round-review.ts", import.meta.url),
          "utf8",
        )
      ).replace(/\s+/gu, " ");
      assert.ok(
        agentSourceForPins.includes(
          "auditWorkspaceCompletionClaim(action, args.commandResultsForContinuity, { auditFrom: state.claimAuditWatermark, hadPassedClaimAudit: state.hadPassedClaimAudit, lastPassedClaimText: state.lastPassedClaimText, })",
        ),
        "the loop audits against the live watermark, never from zero",
      );
      assert.ok(
        agentSourceForPins.includes(
          "if (claimAudit.advanceWatermark) { state.claimAuditWatermark = args.commandResultsForContinuity.length; state.hadPassedClaimAudit = true; state.lastPassedClaimText = action.visibleText; }",
        ),
        "a passing audit consumes its evidence and arms the summary allowance",
      );
      assert.ok(
        agentSourceForPins.includes("midRunClaimRepairRounds <= MAX_MIDRUN_CLAIM_REPAIR_ROUNDS"),
        "mid-run claims draw on their own repair budget",
      );
      assert.ok(
        agentSourceForPins.includes(
          "auditWorkspaceCompletionClaim(finalAction, commandResultsForContinuity, { auditFrom: reviewState.claimAuditWatermark, hadPassedClaimAudit: reviewState.hadPassedClaimAudit, lastPassedClaimText: reviewState.lastPassedClaimText, })",
        ),
        "the command-limit audit shares the run's scope state",
      );

      const honestBlocker = parseAssistantWorkspaceAction(
        '{"say":"I could not create it because the name is missing.","commands":[],"stop":true}',
      );
      assert.equal(auditWorkspaceCompletionClaim(honestBlocker, []).issue, null);

      // ── #5819/#5830: watermark-scoped claim auditing ────────────────────
      // The reported batch: step 1 verified, its claim passes and CONSUMES
      // that evidence; the skipped step 2's empty scope is caught instead of
      // riding step 1's success (the flaw that killed the first fix).
      const midRunClaimOne = parseAssistantWorkspaceAction(
        '{"say":"I created Aria. Now creating Bran.","commands":[{"name":"app_data","arguments":{"action":"character.create","apply":true}}],"stop":false}',
      );
      const batchResults: WorkspaceCommandResult[] = [mutationResult, verificationResult];
      const auditOne = auditWorkspaceCompletionClaim(midRunClaimOne, batchResults, { auditFrom: 0 });
      assert.equal(auditOne.issue, null, "a truthful step claim over verified work passes");
      assert.equal(auditOne.advanceWatermark, true, "and consumes its evidence");
      const midRunClaimTwo = parseAssistantWorkspaceAction(
        '{"say":"I created Bran. Now creating Cass.","commands":[{"name":"app_data","arguments":{"action":"character.create","apply":true}}],"stop":false}',
      );
      const auditTwo = auditWorkspaceCompletionClaim(midRunClaimTwo, batchResults, { auditFrom: batchResults.length });
      assert.equal(auditTwo.issue, "none", "a skipped step's empty scope is challenged - the #5819 report");

      // A state recap is backable by a fresh read, but that read cannot establish
      // authorship of a new mutation using an earlier scope's applied evidence.
      const recapResults = [...batchResults, { ...verificationResult, id: "recap-read" }];
      const recapAudit = auditWorkspaceCompletionClaim(midRunClaimTwo, recapResults, {
        auditFrom: batchResults.length,
      });
      assert.equal(recapAudit.issue, "none", "an earlier mutation cannot back a later self-attributed claim");
      assert.equal(recapAudit.advanceWatermark, false);
      const stateRecap = { ...midRunClaimTwo, visibleText: "Both entries have been created." };
      assert.deepEqual(auditWorkspaceCompletionClaim(stateRecap, recapResults, { auditFrom: batchResults.length }), {
        issue: null,
        advanceWatermark: true,
      });

      // A passed audit permits a terminal summary, never a new self-attributed
      // mutation claim with no evidence in scope.
      assert.equal(
        auditWorkspaceCompletionClaim(unsupportedCompletion, batchResults, {
          auditFrom: batchResults.length,
          hadPassedClaimAudit: true,
        }).issue,
        "none",
      );
      assert.deepEqual(
        auditWorkspaceCompletionClaim({ ...unsupportedCompletion, visibleText: "Done." }, batchResults, {
          auditFrom: batchResults.length,
          hadPassedClaimAudit: true,
        }),
        { issue: null, advanceWatermark: false },
      );
      assert.equal(
        auditWorkspaceCompletionClaim(unsupportedCompletion, batchResults, {
          auditFrom: batchResults.length,
          hadPassedClaimAudit: false,
        }).issue,
        "none",
      );

      // Mismatch is GLOBAL debt: scoping past it must not launder it, and
      // only the same-key verified retry clears it (#5754 invariant).
      const mismatchedCreate: WorkspaceCommandResult = {
        id: "mismatched-create",
        name: "app_data",
        input: { action: "lorebook.create" },
        output: 'Readback: store-mismatch\n{"saved": true}',
        success: true,
      };
      const afterMismatch = [mismatchedCreate, mutationResult, verificationResult];
      assert.equal(
        resolveWorkspaceMutationVerification(afterMismatch, 1),
        "mismatch",
        "an out-of-scope mismatch still shadows every later claim",
      );
      const retriedVerified: WorkspaceCommandResult = {
        ...mismatchedCreate,
        id: "retried-create",
        output: 'Readback: store-verified\n{"saved": true}',
      };
      assert.equal(
        resolveWorkspaceMutationVerification([mismatchedCreate, retriedVerified], 1),
        "verified",
        "the same-key store-verified retry clears it, wherever the mismatch happened",
      );

      // Tolerated states never advance the watermark, so their debt stays
      // visible to the terminal audit.
      const unverifiedMidRun = auditWorkspaceCompletionClaim(midRunClaimOne, [mutationResult], { auditFrom: 0 });
      assert.equal(unverifiedMidRun.issue, null, "unverified is tolerated mid-run - a later frame can read it back");
      assert.equal(unverifiedMidRun.advanceWatermark, false, "without consuming the debt");

      // #5830: "I've verified..." describes a READ - the exact sentence the
      // coaching asks for - and is no longer a completion claim.
      assert.equal(
        workspaceTextClaimsMutationCompletion("I have verified the card looks right."),
        false,
        "the verified verb is deliberately absent from the claim detector",
      );
      // Plural persistence assertions stay caught without it.
      assert.equal(workspaceTextClaimsMutationCompletion("The changes were saved."), true);
      assert.equal(workspaceTextClaimsMutationCompletion("Both entries have been created."), true);

      // ── Escape hatches never paper over a failure the resolver cannot see ──
      // A FAILED create plus an unrelated successful list resolves "none" to
      // the resolver - but it is active evidence of non-completion, and both
      // escapes are denied outright.
      const failedCreate: WorkspaceCommandResult = {
        id: "failed-create",
        name: "app_data",
        input: { action: "lorebook.create" },
        output: "Error: name is required",
        success: false,
      };
      const failedScope = [failedCreate, { ...verificationResult, id: "orienting-list" }];
      assert.equal(
        auditWorkspaceCompletionClaim(midRunClaimTwo, failedScope, { auditFrom: 0 }).issue,
        "none",
        "a read never launders a failed mutating attempt into a passing claim",
      );
      assert.equal(
        auditWorkspaceCompletionClaim(unsupportedCompletion, failedScope, {
          auditFrom: 0,
          hadPassedClaimAudit: true,
        }).issue,
        "none",
        "the terminal-summary escape is denied over a scope containing a failure",
      );
      // Same denial for an apply:false preview - it looks like nothing to the
      // resolver but is a non-applied attempt to the audit.
      const previewOnly: WorkspaceCommandResult = {
        id: "preview-create",
        name: "app_data",
        input: { action: "lorebook.create", apply: false },
        output: '{"preview": true}',
        success: true,
      };
      assert.equal(
        auditWorkspaceCompletionClaim(midRunClaimTwo, [previewOnly, verificationResult], { auditFrom: 0 }).issue,
        "none",
        "a preview plus a read cannot back a completion claim",
      );

      // Documentation reads never qualify as recap backing - knowing what the
      // manual says is not knowing what the store holds.
      const docsRead: WorkspaceCommandResult = {
        id: "docs",
        name: "docs_search",
        input: { query: "characters" },
        output: "results",
        success: true,
      };
      assert.equal(
        auditWorkspaceCompletionClaim(midRunClaimTwo, [docsRead], { auditFrom: 0 }).issue,
        "none",
        "a docs read is not a state read",
      );

      // A verified scope that ALSO contains a failed attempt is downgraded
      // until a later state read clears it - then the retry passes.
      const mixedScope = [failedCreate, mutationResult, verificationResult];
      // verificationResult follows the failure, clearing the outstanding
      // attempt: the verified pass stands.
      assert.equal(auditWorkspaceCompletionClaim(unsupportedCompletion, mixedScope, { auditFrom: 0 }).issue, null);
      const uncleared = [mutationResult, { ...verificationResult, id: "pre-read" }, failedCreate];
      assert.equal(
        auditWorkspaceCompletionClaim(unsupportedCompletion, uncleared, { auditFrom: 0 }).issue,
        "unverified",
        "a trailing failed attempt demands a fresh read before the claim can stand",
      );
    },
  },
  {
    name: "Professor Mari executes intent-authorized mutations without a server-side authorization gate (#5721)",
    run() {
      // Models fine-tuned on older transcripts may still emit the retired
      // "authorization" field - it must parse harmlessly and be ignored.
      const legacyAction = parseAssistantWorkspaceAction(
        JSON.stringify({
          say: "",
          authorization: "Set Dottore's appearance to a white coat.",
          commands: [
            {
              name: "app_data",
              arguments: {
                action: "character.update",
                characterId: "dottore-id",
                patch: { appearance: "A white coat." },
                apply: true,
              },
            },
          ],
          stop: false,
        }),
      );
      assert.equal(legacyAction.commands.length, 1);
      assert.equal("authorization" in legacyAction.commands[0]!, false, "the retired field must not survive parsing");
      // The self-declared approval pause (awaitingAuthorization) is the kept
      // deferral mechanism and must still round-trip.
      const deferral = parseAssistantWorkspaceAction(
        JSON.stringify({
          say: "Should I save this?",
          awaitingAuthorization: true,
          commands: [
            {
              name: "app_data",
              arguments: { action: "character.update", characterId: "char-1", patch: { name: "X" }, apply: true },
            },
          ],
          stop: false,
        }),
      );
      assert.equal(deferral.awaitingAuthorization, true);
    },
  },
];

await runNamedCases(cases);
