import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { StampedCapabilityCatalogPackage } from "../../../packages/shared/src/schemas/capability-package.schema.js";
import { buildMariAssistantPrompt } from "../../../packages/server/src/db/seed-mari.js";
import {
  buildOfficialCatalogPackageDetail,
  MariDbService,
} from "../../../packages/server/src/services/mari-db/mari-db.service.js";
import {
  appDataActionLooksReadOnly,
  buildMariSystemPrompt,
  isAppDataActionName,
  parseAssistantWorkspaceAction,
  PROFESSOR_MARI_APP_DATA_ACTIONS,
  professorMariWorkspaceResponseFormat,
  resolveWorkspaceMutationVerification,
  scrubInternalNames,
  auditWorkspaceCompletionClaim,
  workspaceTextClaimsMutationCompletion,
  WORKSPACE_TOOL_DEFINITIONS,
  type WorkspaceCommandResult,
} from "../../../packages/server/src/services/professor-mari/workspace-agent.service.js";
import {
  entriesFromCapabilityCatalog,
  formatOfficialAgentCatalogBlock,
  getCachedOfficialAgentCatalogEntries,
  getOfficialAgentCatalogKnowledge,
  lookupOfficialAgentCatalogPackage,
  OFFICIAL_AGENT_CATALOG_SECTIONS,
  OFFICIAL_AGENT_KNOWLEDGE_ENTRIES,
  PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE,
  PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE,
  resetOfficialAgentCatalogCacheForTests,
} from "../../../packages/server/src/services/professor-mari/official-agent-knowledge.js";
import { type RegressionCase, runNamedCases } from "../fixtures/named-cases.js";
import "../fixtures/regression-agent-definitions.js";

function fakeCatalogPackage(opts: {
  id: string;
  name: string;
  description: string;
  category?: "writer" | "tracker" | "misc";
  section?: NonNullable<StampedCapabilityCatalogPackage["store"]>["section"];
  tagline?: string;
  preview?: true;
  homeBrowserTab?: boolean;
  conversationGame?: boolean;
}): StampedCapabilityCatalogPackage {
  return {
    category: opts.category ?? "misc",
    iconUrl: `https://example.invalid/${opts.id}.png`,
    manifest: {
      schemaVersion: 2,
      capabilityApi: { major: 1, minor: 836 },
      builtAgainst: "2.5.1",
      id: opts.id,
      name: opts.name,
      version: "1.0.0",
      description: opts.description,
      engine: { min: "2.5.0" },
      kind: opts.conversationGame ? ["agent", "turn-game"] : ["agent"],
      entrypoints: { client: "client.js" },
      files: [{ path: "client.js", sha256: "a".repeat(64) }],
      permissions: ["ui"],
      restartRequired: false,
      ...(opts.homeBrowserTab || opts.conversationGame
        ? {
            contributions: {
              ...(opts.homeBrowserTab
                ? {
                    slots: ["home-browser-tab"],
                    homeBrowserTab: { label: opts.name, iconPaths: ["client.js"] },
                  }
                : { slots: ["conversation-surface"] }),
              ...(opts.conversationGame
                ? { conversationGame: { command: `/${opts.id}`, aliases: [], playerLabel: opts.name } }
                : {}),
            },
          }
        : {}),
    },
    artifact: { url: `https://example.invalid/${opts.id}.zip`, sha256: "b".repeat(64), size: 1024 },
    ...(opts.preview ? { preview: true as const } : {}),
    ...(opts.section ? { store: { section: opts.section, tagline: opts.tagline ?? `${opts.name} tagline.` } } : {}),
  };
}

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

      assert.equal(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.length, 46);
      assert.equal(new Set(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.map((entry) => entry.id)).size, 46);
      assert.deepEqual(
        OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.find((entry) => entry.id === "noodle"),
        {
          id: "noodle",
          name: "Noodle",
          section: "apps",
          modes: "Home",
          summary: "A pretend social network for your characters",
        },
      );
      assert.ok(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.some((entry) => entry.id === "long-term-memory"));
      assert.ok(OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.some((entry) => entry.id === "storyboard"));
      assert.deepEqual(
        Object.fromEntries(
          OFFICIAL_AGENT_CATALOG_SECTIONS.map((section) => [
            section,
            OFFICIAL_AGENT_KNOWLEDGE_ENTRIES.filter((entry) => entry.section === section).length,
          ]),
        ),
        { apps: 6, games: 8, writing: 4, memory: 5, trackers: 9, adventure: 3, media: 5, alive: 6, more: 0 },
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

      const customCatalog = "<official_agent_catalog>\nsentinel\n</official_agent_catalog>";
      assert.ok(buildMariAssistantPrompt(customCatalog).includes(customCatalog));
      assert.ok(buildMariSystemPrompt(customCatalog).includes(customCatalog));
      assert.ok(PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE.includes("`agent.list`"));
      assert.ok(PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE.includes("`agent.catalog.get`"));
      assert.ok(!PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE.includes("agent.list"));
      assert.ok(!PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE.includes("agent.catalog.get"));
      assert.ok(
        PROFESSOR_MARI_ASSISTANT_AGENT_CATALOG_KNOWLEDGE.includes("Never claim an uninstalled agent is active."),
      );
      const workspaceMariSource = readFileSync(
        new URL("../../../packages/server/src/services/professor-mari/workspace-agent.service.ts", import.meta.url),
        "utf8",
      );
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
  {
    name: "Live agent catalog formatter groups Organizer sections deterministically and marks previews",
    run() {
      const lifeSim = fakeCatalogPackage({
        id: "modern-life-sim",
        name: "Modern Life Sim",
        section: "apps",
        tagline: "A small-town life simulation.",
        description: "Full description.",
        preview: true,
        homeBrowserTab: true,
      });
      const wordGame = fakeCatalogPackage({
        id: "word-game-two",
        name: "Word Game Two",
        description: "First sentence explains the game. Second sentence adds detail.",
        conversationGame: true,
      });
      const fallbackMisc = fakeCatalogPackage({
        id: "mystery-pack",
        name: "Mystery Pack",
        description: "Adds something unexpected without store metadata.",
      });

      const first = formatOfficialAgentCatalogBlock(
        entriesFromCapabilityCatalog({ packages: [wordGame, lifeSim, fallbackMisc] }),
      );
      const reversed = formatOfficialAgentCatalogBlock(
        entriesFromCapabilityCatalog({ packages: [fallbackMisc, lifeSim, wordGame] }),
      );
      assert.equal(first, reversed, "catalog order must stay byte-identical across shuffled inputs");
      assert.match(
        first,
        /^<official_agent_catalog>\nThe official Marinara Engine v2\.3\.0\+ catalog contains these 3 optional/u,
      );
      assert.match(
        first,
        /## Apps\n- Modern Life Sim \(package `modern-life-sim`; Home; preview\): A small-town life simulation\./u,
      );
      assert.match(
        first,
        /## Chat games\n- Word Game Two \(package `word-game-two`; Conversation\): First sentence explains the game\./u,
      );
      assert.match(
        first,
        /## More agents\n- Mystery Pack \(package `mystery-pack`\): Adds something unexpected without store metadata\./u,
      );
      assert.ok(first.includes("Do not describe About Me Keeper as an agent."));
      assert.ok(!first.includes("## Trackers"), "empty sections must be omitted");
    },
  },
  {
    name: "Live catalog loader caches results, applies error cooldown, and falls back safely when offline",
    async run() {
      resetOfficialAgentCatalogCacheForTests();
      try {
        let nowMs = 1_000_000;
        let fetchCount = 0;

        const coldFallback = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          fetchCatalog: async () => {
            fetchCount += 1;
            throw new Error("offline");
          },
        });
        assert.equal(coldFallback.source, "fallback");
        assert.equal(coldFallback.entries.length, 46);
        assert.equal(fetchCount, 1);
        assert.equal(getCachedOfficialAgentCatalogEntries().length, 46);

        // Cooldown suppresses immediate retry after failure.
        nowMs += 10_000;
        const cooledDown = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          fetchCatalog: async () => {
            fetchCount += 1;
            throw new Error("should not run");
          },
        });
        assert.equal(cooledDown.source, "fallback");
        assert.equal(fetchCount, 1);

        // Once cooldown passes, a live catalog succeeds and replaces the fallback.
        nowMs += 65_000;
        const customPet = fakeCatalogPackage({
          id: "saucelings-next",
          name: "Saucelings Next",
          section: "apps",
          tagline: "An even smaller pet.",
          description: "Desc.",
        });
        const liveFirst = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          fetchCatalog: async () => {
            fetchCount += 1;
            return { packages: [customPet] };
          },
        });
        assert.equal(liveFirst.source, "live");
        assert.equal(fetchCount, 2);
        assert.ok(liveFirst.block.includes("`saucelings-next`"));
        assert.equal(getCachedOfficialAgentCatalogEntries()[0]?.id, "saucelings-next");

        // Cache hit inside the 15-minute TTL does not call fetchCatalog.
        nowMs += 5 * 60 * 1000;
        const cachedHit = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          fetchCatalog: async () => {
            fetchCount += 1;
            return { packages: [] };
          },
        });
        assert.equal(cachedHit.source, "live");
        assert.equal(fetchCount, 2);

        // After TTL expiry, a failed refresh preserves the last-known live catalog.
        nowMs += 16 * 60 * 1000;
        const staleLiveFallback = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          fetchCatalog: async () => {
            fetchCount += 1;
            throw new Error("github blip");
          },
        });
        assert.equal(staleLiveFallback.source, "live");
        assert.equal(fetchCount, 3);
        assert.ok(staleLiveFallback.block.includes("`saucelings-next`"));

        // After TTL expiry, an already-aborted wait must fall back to the bundled catalog rather than
        // returning an expired cache marked as live without attempting refresh.
        nowMs += 70_000;
        const expiredPreAborted = new AbortController();
        expiredPreAborted.abort();
        const expiredAbortedResult = await getOfficialAgentCatalogKnowledge({
          now: () => nowMs,
          signal: expiredPreAborted.signal,
          fetchCatalog: async () => {
            fetchCount += 1;
            return { packages: [] };
          },
        });
        assert.equal(expiredAbortedResult.source, "fallback");
        assert.equal(fetchCount, 3);
      } finally {
        resetOfficialAgentCatalogCacheForTests();
      }
    },
  },
  {
    name: "Live catalog loader honors abort signal and deadline without blocking prompt assembly",
    async run() {
      resetOfficialAgentCatalogCacheForTests();
      try {
        let releaseSlowFetch: (() => void) | undefined;
        let fetchCount = 0;

        // Pre-aborted signal returns fallback immediately without invoking fetch.
        const preAborted = new AbortController();
        preAborted.abort();
        const immediate = await getOfficialAgentCatalogKnowledge({
          signal: preAborted.signal,
          fetchCatalog: async () => {
            fetchCount += 1;
            return { packages: [] };
          },
        });
        assert.equal(immediate.source, "fallback");
        assert.equal(fetchCount, 0);

        // In-flight wait stops promptly on signal abort while slow fetch later settles cleanly.
        const activeController = new AbortController();
        const abortedWait = getOfficialAgentCatalogKnowledge({
          signal: activeController.signal,
          fetchCatalog: () =>
            new Promise((resolve) => {
              releaseSlowFetch = () =>
                resolve({
                  packages: [
                    fakeCatalogPackage({
                      id: "late-pack",
                      name: "Late Pack",
                      section: "apps",
                      tagline: "Loaded late.",
                      description: "Loaded late.",
                    }),
                  ],
                });
            }),
        });
        activeController.abort();
        const fromAbort = await abortedWait;
        assert.equal(fromAbort.source, "fallback");
        releaseSlowFetch?.();

        // Short timeout returns fallback even when fetch takes longer.
        resetOfficialAgentCatalogCacheForTests();
        let releaseTimeoutFetch: (() => void) | undefined;
        const timedOut = await getOfficialAgentCatalogKnowledge({
          timeoutMs: 10,
          fetchCatalog: () =>
            new Promise((resolve) => {
              releaseTimeoutFetch = () => resolve({ packages: [] });
            }),
        });
        assert.equal(timedOut.source, "fallback");
        releaseTimeoutFetch?.();
      } finally {
        resetOfficialAgentCatalogCacheForTests();
      }
    },
  },
  {
    name: "Catalog package lookup resolves exact id, name, unambiguous partial, ambiguous candidates, and offline fallback",
    async run() {
      resetOfficialAgentCatalogCacheForTests();
      try {
        let fetchCount = 0;
        const catalogPackages: StampedCapabilityCatalogPackage[] = [
          fakeCatalogPackage({
            id: "otome-forge",
            name: "Otome Hearth",
            section: "apps",
            tagline: "An otome game made from your characters.",
            description: "Full description for Otome Hearth with routes and affection tracking.",
            homeBrowserTab: true,
          }),
          fakeCatalogPackage({
            id: "story-tracker-alpha",
            name: "Alpha Tracker",
            section: "trackers",
            category: "tracker",
            tagline: "Tracks scenes.",
            description: "Alpha tracker detailed copy.",
          }),
          fakeCatalogPackage({
            id: "story-tracker-beta",
            name: "Beta Tracker",
            section: "trackers",
            category: "tracker",
            tagline: "Tracks beats.",
            description: "Beta tracker detailed copy.",
            preview: true,
          }),
        ];
        const fetchCatalog = async () => {
          fetchCount += 1;
          return { packages: catalogPackages };
        };

        // Cold load caches both entries and raw packages; subsequent lookups reuse warm cache.
        const byId = await lookupOfficialAgentCatalogPackage("otome-forge", { fetchCatalog });
        assert.equal(byId.found, true);
        if (byId.found) {
          assert.equal(byId.source, "live");
          assert.equal(byId.entry.name, "Otome Hearth");
          assert.equal(
            byId.package?.manifest.description,
            "Full description for Otome Hearth with routes and affection tracking.",
          );
        }
        assert.equal(fetchCount, 1);

        const byName = await lookupOfficialAgentCatalogPackage("otome hearth", { fetchCatalog });
        assert.equal(byName.found, true);
        if (byName.found) assert.equal(byName.entry.id, "otome-forge");
        assert.equal(fetchCount, 1, "warm cache must satisfy lookups without extra catalog fetches");

        const byNormalizedId = await lookupOfficialAgentCatalogPackage("otome forge");
        assert.equal(byNormalizedId.found, true);
        if (byNormalizedId.found) assert.equal(byNormalizedId.entry.id, "otome-forge");

        const byUnambiguousPartial = await lookupOfficialAgentCatalogPackage("alpha");
        assert.equal(byUnambiguousPartial.found, true);
        if (byUnambiguousPartial.found) assert.equal(byUnambiguousPartial.entry.id, "story-tracker-alpha");

        const ambiguous = await lookupOfficialAgentCatalogPackage("tracker");
        assert.equal(ambiguous.found, false);
        if (!ambiguous.found) {
          assert.equal(ambiguous.ambiguous, true);
          assert.deepEqual(
            ambiguous.candidates.map((candidate) => candidate.id),
            ["story-tracker-alpha", "story-tracker-beta"],
          );
        }

        const missing = await lookupOfficialAgentCatalogPackage("no-such-agent");
        assert.equal(missing.found, false);
        if (!missing.found) {
          assert.equal(missing.ambiguous, false);
          assert.deepEqual(missing.candidates, []);
        }

        // Offline fallback still resolves bundled entries when live fetch fails.
        resetOfficialAgentCatalogCacheForTests();
        const offline = await lookupOfficialAgentCatalogPackage("Blackjack", {
          fetchCatalog: async () => {
            throw new Error("offline");
          },
        });
        assert.equal(offline.found, true);
        if (offline.found) {
          assert.equal(offline.source, "fallback");
          assert.equal(offline.entry.id, "blackjack");
          assert.equal(offline.package, undefined);
        }
      } finally {
        resetOfficialAgentCatalogCacheForTests();
      }
    },
  },
  {
    name: "agent.catalog.get builds bounded package details, classifies read-only, and integrates with MariDbService",
    async run() {
      resetOfficialAgentCatalogCacheForTests();
      try {
        // Workspace registration, read-only classification, and internal-name scrubbing.
        assert.ok(PROFESSOR_MARI_APP_DATA_ACTIONS.includes("agent.catalog.get"));
        assert.equal(isAppDataActionName("agent.catalog.get"), true);
        assert.equal(appDataActionLooksReadOnly("agent.catalog.get"), true);
        const scrubbed = scrubInternalNames("I checked agent.catalog.get before answering.");
        assert.ok(!scrubbed.includes("agent.catalog.get"));
        assert.ok(scrubbed.includes("the agent catalog"));
        const appDataTool = WORKSPACE_TOOL_DEFINITIONS.find((tool) => tool.name === "app_data");
        const appDataActions = (
          appDataTool?.parameters as { properties?: { action?: { enum?: readonly string[] } } } | undefined
        )?.properties?.action?.enum;
        assert.ok(appDataActions?.includes("agent.catalog.get"));
        assert.ok(PROFESSOR_MARI_AGENT_CATALOG_KNOWLEDGE.includes("`agent.catalog.get` (`id` or `name`)"));

        // agent.catalog.get reads the official catalog, not saved DB state, so it must never mark an
        // earlier unverified write without readBack as verified.
        const agentWriteWithoutReadBack: WorkspaceCommandResult = {
          id: "create-agent",
          name: "app_data",
          input: { action: "agent.create" },
          output: '{"saved": true}',
          success: true,
        };
        const catalogReadResult: WorkspaceCommandResult = {
          id: "read-catalog",
          name: "app_data",
          input: { action: "agent.catalog.get", id: "otome-forge" },
          output: '{"id":"otome-forge"}',
          success: true,
        };
        assert.equal(
          resolveWorkspaceMutationVerification([agentWriteWithoutReadBack, catalogReadResult]),
          "unverified",
        );
        assert.equal(
          resolveWorkspaceMutationVerification([
            agentWriteWithoutReadBack,
            { ...catalogReadResult, input: { action: "agent.get", id: "agent-1" } },
          ]),
          "verified",
        );

        const otomePkg = fakeCatalogPackage({
          id: "otome-forge",
          name: "Otome Hearth",
          section: "apps",
          tagline: "An otome game made from your characters.",
          description: "Detailed otome app with routes, choices, and persistent affection state.",
          homeBrowserTab: true,
        });
        otomePkg.documentationUrl = "https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/otome-forge";
        otomePkg.manifest.version = "1.4.0";
        otomePkg.manifest.permissions = ["network", "routes", "storage", "ui"];

        // Unit detail builder: installed Home app with newer catalog version + release notes capped to 3.
        const liveDetail = await buildOfficialCatalogPackageDetail("Otome Hearth", {
          lookup: async () => ({
            found: true,
            source: "live",
            entry: {
              id: "otome-forge",
              name: "Otome Hearth",
              section: "apps",
              modes: "Home",
              summary: "An otome game made from your characters",
            },
            package: otomePkg,
          }),
          getInstalled: async () => [
            {
              id: "otome-forge",
              version: "1.2.0",
              manifest: otomePkg.manifest,
              installedAt: "2026-11-01T00:00:00.000Z",
              status: "active",
              error: null,
              readiness: "ready",
              readinessError: null,
              legacy: false,
            },
          ],
          getReleaseNotes: async () => [
            { version: "1.4.0", date: "2026-11-20", notes: "Added route skip", highlight: true },
            { version: "1.3.0", date: "2026-11-10", notes: "Added cg gallery", highlight: false },
            { version: "1.2.0", date: "2026-11-01", notes: "Bug fixes", highlight: false },
            { version: "1.1.0", date: "2026-10-20", notes: "Initial fixes", highlight: false },
          ],
        });
        assert.equal(liveDetail.ok, true, liveDetail.error);
        assert.equal(liveDetail.output?.source, "live");
        assert.equal(liveDetail.output?.id, "otome-forge");
        assert.equal(liveDetail.output?.version, "1.4.0");
        assert.deepEqual(liveDetail.output?.permissions, ["network", "routes", "storage", "ui"]);
        assert.equal(liveDetail.output?.capabilityApi, "1.836");
        assert.equal(liveDetail.output?.installed, true);
        assert.equal(liveDetail.output?.installedVersion, "1.2.0");
        assert.equal(liveDetail.output?.updateAvailable, true);
        assert.equal((liveDetail.output?.releaseNotes as unknown[])?.length, 3);

        // Slow/hanging release notes time out within budget without keeping Node handles open.
        let releaseSlowNotes: (() => void) | undefined;
        const notesTimedOut = await buildOfficialCatalogPackageDetail("otome-forge", {
          lookup: async () => ({
            found: true,
            source: "live",
            entry: {
              id: "otome-forge",
              name: "Otome Hearth",
              section: "apps",
              summary: "An otome game made from your characters",
            },
            package: otomePkg,
          }),
          getInstalled: async () => [],
          getReleaseNotes: () =>
            new Promise((resolve) => {
              releaseSlowNotes = () => resolve([]);
            }),
          releaseNotesTimeoutMs: 10,
        });
        releaseSlowNotes?.();
        assert.equal(notesTimedOut.ok, true);
        assert.deepEqual(notesTimedOut.output?.releaseNotes, []);

        // Offline fallback omits manifest permissions/version cleanly and never blocks on release notes.
        // A rejected installed() read keeps install/update status unknown (null), while an empty registry reports false.
        let offlineReleaseNotesCalls = 0;
        const fallbackUnknownInstall = await buildOfficialCatalogPackageDetail("blackjack", {
          lookup: async () => ({
            found: true,
            source: "fallback",
            entry: {
              id: "blackjack",
              name: "Blackjack",
              section: "games",
              modes: "Conversation",
              summary: "Conversation game: play blackjack against the house",
            },
          }),
          getInstalled: async () => {
            throw new Error("no registry");
          },
          getReleaseNotes: async () => {
            offlineReleaseNotesCalls += 1;
            return [];
          },
        });
        assert.equal(offlineReleaseNotesCalls, 0);
        assert.equal(fallbackUnknownInstall.ok, true);
        assert.equal(fallbackUnknownInstall.output?.source, "fallback");
        assert.equal(fallbackUnknownInstall.output?.installed, null);
        assert.equal(fallbackUnknownInstall.output?.updateAvailable, null);
        assert.deepEqual(fallbackUnknownInstall.output?.releaseNotes, []);
        assert.match(String(fallbackUnknownInstall.output?.note ?? ""), /bundled summary/i);

        const fallbackNotInstalled = await buildOfficialCatalogPackageDetail("blackjack", {
          lookup: async () => ({
            found: true,
            source: "fallback",
            entry: {
              id: "blackjack",
              name: "Blackjack",
              section: "games",
              modes: "Conversation",
              summary: "Conversation game: play blackjack against the house",
            },
          }),
          getInstalled: async () => [],
          getReleaseNotes: async () => {
            offlineReleaseNotesCalls += 1;
            return [];
          },
        });
        assert.equal(offlineReleaseNotesCalls, 0);
        assert.equal(fallbackNotInstalled.ok, true);
        assert.equal(fallbackNotInstalled.output?.installed, false);
        assert.equal(fallbackNotInstalled.output?.updateAvailable, false);

        // Empty query returns validation error before any lookup.
        const missingArg = await buildOfficialCatalogPackageDetail("   ");
        assert.equal(missingArg.ok, false);
        assert.match(String(missingArg.error ?? ""), /Provide a catalog package/i);

        // MariDbService.executeAction end-to-end against warm live cache.
        await getOfficialAgentCatalogKnowledge({
          forceRefresh: true,
          fetchCatalog: async () => ({
            packages: [
              fakeCatalogPackage({
                id: "test-home-app",
                name: "Test Home App",
                section: "apps",
                tagline: "Short summary.",
                description: "Long description from live package manifest.",
                homeBrowserTab: true,
              }),
              fakeCatalogPackage({
                id: "test-game-one",
                name: "Test Game One",
                section: "games",
                conversationGame: true,
                tagline: "First test game.",
                description: "First test game.",
              }),
              fakeCatalogPackage({
                id: "test-game-two",
                name: "Test Game Two",
                section: "games",
                conversationGame: true,
                tagline: "Second test game.",
                description: "Second test game.",
              }),
            ],
          }),
        });
        const mariDb = new MariDbService(null as never);
        const missingCall = await mariDb.executeAction({ action: "agent.catalog.get" } as never);
        assert.equal(missingCall.ok, false);
        assert.equal(missingCall.mode, "read");

        const ambiguousCall = await mariDb.executeAction({
          action: "agent.catalog.get",
          query: "Test Game",
        } as never);
        assert.equal(ambiguousCall.ok, false);
        assert.equal(ambiguousCall.mode, "read");
        assert.equal(((ambiguousCall.output as { candidates?: unknown[] } | undefined)?.candidates ?? []).length, 2);

        const foundCall = await mariDb.executeAction({
          action: "agent.catalog.get",
          name: "Test Home App",
        } as never);
        assert.equal(foundCall.ok, true, foundCall.error);
        assert.equal(foundCall.mode, "read");
        const foundOutput = foundCall.output as Record<string, unknown>;
        assert.equal(foundOutput.source, "live");
        assert.equal(foundOutput.id, "test-home-app");
        assert.equal(foundOutput.description, "Long description from live package manifest.");
        assert.equal(foundOutput.capabilityApi, "1.836");
      } finally {
        resetOfficialAgentCatalogCacheForTests();
      }
    },
  },
];

await runNamedCases(cases);
