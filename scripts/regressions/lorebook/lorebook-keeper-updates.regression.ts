// Lorebook Keeper's updates: approval text when entry content has Markdown headings, merging an update into an
// entry, and custom lorebook writers working from a stable earlier reply.
import assert from "node:assert/strict";
import {
  formatLorebookWriteApprovalText,
  parseLorebookWriteApprovalText,
} from "../../../packages/server/src/routes/generate/agent-write-approval.js";
import {
  buildHistoricalLorebookKeeperContext,
  customAgentUsesLorebookReadBehind,
  customLorebookReadBehindRunKey,
  getCustomLorebookReadBehindMessages,
  getLorebookKeeperAutomaticTarget,
  mergeLorebookKeeperUpdateContent,
  tryClaimCustomLorebookReadBehindRun,
} from "../../../packages/server/src/routes/generate/lorebook-keeper-utils.js";

// Issue #4135 — Markdown headings inside Lorebook Keeper content are content,
// not approval-entry delimiters.
{
  const markdownContent = [
    "# About Bob",
    "## Personality",
    "Bob likes to fish.",
    "### Fishing Info",
    "Keys: fishing, river",
    "Tag: hobby",
    "These are literal lines in the entry content.",
    "Bob hates to eat fish.",
  ].join("\n");
  const approvalText = formatLorebookWriteApprovalText([
    {
      name: "Bob",
      keys: ["Bob"],
      tag: "people",
      content: markdownContent,
    },
  ]);
  assert.match(approvalText, /^<!-- marinara:lorebook-entry:v1 -->\r?\n### Bob\r?\nKeys: Bob\r?\nTag: people/u);
  assert.deepEqual(parseLorebookWriteApprovalText(approvalText), [
    {
      action: "append",
      name: "Bob",
      keys: ["Bob"],
      tag: "people",
      content: markdownContent,
    },
  ]);
  assert.deepEqual(
    parseLorebookWriteApprovalText("### Legacy Entry\nKeys: legacy\nTag:\n\nLegacy approval text."),
    [
      {
        action: "append",
        name: "Legacy Entry",
        keys: ["legacy"],
        tag: "",
        content: "Legacy approval text.",
      },
    ],
    "Unmarked approval text created before the delimiter fix must remain editable",
  );
  assert.deepEqual(
    parseLorebookWriteApprovalText(
      [
        "### Legacy Marker Content",
        "Keys: legacy",
        "Tag:",
        "",
        "Keep <!-- marinara:lorebook-entry:v1 --> as literal inline content.",
      ].join("\n"),
    ),
    [
      {
        action: "append",
        name: "Legacy Marker Content",
        keys: ["legacy"],
        tag: "",
        content: "Keep <!-- marinara:lorebook-entry:v1 --> as literal inline content.",
      },
    ],
    "An inline delimiter mention must not switch legacy approval text into explicit mode",
  );
}
assert.equal(
  mergeLorebookKeeperUpdateContent({
    existingContent: "Old timeline that must be replaced.",
    replacementContent: "Corrected timeline.",
    newFacts: [],
  }),
  "Corrected timeline.",
  "Lorebook Keeper updates must replace an existing body instead of stacking another copy",
);
assert.equal(
  mergeLorebookKeeperUpdateContent({
    existingContent: "Stable scene state.",
    replacementContent: "",
    newFacts: ["A new clue appeared."],
  }),
  "Stable scene state.\n\n- A new clue appeared.",
  "Fact-only Lorebook Keeper updates must preserve the current body",
);
// Issue #5191 — custom lorebook writers can process a stable historical reply.
{
  const messages = [
    { id: "user-1", role: "user", content: "First turn" },
    { id: "assistant-1", role: "assistant", content: "First reply" },
    { id: "user-2", role: "user", content: "Second turn" },
    { id: "assistant-2", role: "assistant", content: "Second reply" },
    { id: "user-3", role: "user", content: "Newest turn" },
  ];
  assert.equal(getCustomLorebookReadBehindMessages({ lorebookReadBehindMessages: "2" }), 2);
  assert.equal(getCustomLorebookReadBehindMessages({ lorebookReadBehindMessages: 101 }), 100);
  assert.equal(
    customAgentUsesLorebookReadBehind({
      phase: "post_processing",
      isCustomAgent: true,
      settings: {
        resultType: "lorebook_update",
        lorebookReadBehindMessages: 1,
        customCapabilities: { create_lorebooks: true },
        customAgentPermissionsExplicit: true,
      },
    }),
    true,
    "create-only lorebook update agents must support Read Behind",
  );
  assert.equal(
    customAgentUsesLorebookReadBehind({
      phase: "post_processing",
      isCustomAgent: true,
      settings: {
        lorebookWriteEnabled: true,
        lorebookReadBehindMessages: 1,
        customCapabilities: { edit_lorebooks: true },
        customAgentPermissionsExplicit: true,
      },
    }),
    true,
    "custom lorebook entry writers must support Read Behind",
  );
  const activeRuns = new Set<string>();
  const runKey = customLorebookReadBehindRunKey("chat-1", "agent-1", "assistant-1");
  assert.equal(tryClaimCustomLorebookReadBehindRun(activeRuns, runKey), true);
  assert.equal(
    tryClaimCustomLorebookReadBehindRun(activeRuns, runKey),
    false,
    "an in-flight historical message must only be claimed once",
  );
  activeRuns.delete(runKey);
  assert.equal(tryClaimCustomLorebookReadBehindRun(activeRuns, runKey), true);
  const target = getLorebookKeeperAutomaticTarget(messages, 1);
  assert.equal(target?.id, "assistant-2");
  const context = buildHistoricalLorebookKeeperContext(
    {
      chatId: "chat-1",
      chatMode: "roleplay",
      recentMessages: [],
      mainResponse: "Newest reply",
      gameState: null,
      characters: [],
      persona: null,
      memory: {},
      writableLorebookIds: ["lorebook-1"],
      chatSummary: null,
      authorNotes: null,
      activatedLorebookEntries: [],
    },
    messages,
    target!.id,
  );
  assert.equal(context?.mainResponse, "Second reply");
  assert.deepEqual(
    context?.recentMessages.map((message) => message.content),
    ["First turn", "First reply", "Second turn"],
  );
}
