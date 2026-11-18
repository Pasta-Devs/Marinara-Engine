// Lorebook Keeper's updates: approval text when entry content has Markdown headings, merging an update into an
// entry, and custom lorebook writers working from a stable earlier reply. Also an update's order, a stop during
// saving, and routing an update to a named book.
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
  persistLorebookKeeperUpdates,
  readLorebookKeeperUpdateOrder,
  resolveLorebookKeeperTarget,
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

// #5225: an update's whole-number order survives automatic and approval-gated writes, a stop during saving writes nothing, and updates route to a named book or a naming-scheme alias.
{
  assert.equal(readLorebookKeeperUpdateOrder({ order: 200 }), 200);
  assert.equal(readLorebookKeeperUpdateOrder({ entry: { order: -10 } }), -10);
  assert.equal(readLorebookKeeperUpdateOrder({ order: "200" }), undefined);
  assert.equal(readLorebookKeeperUpdateOrder({ order: 1.5 }), undefined);
  assert.equal(readLorebookKeeperUpdateOrder({ order: Number.MAX_SAFE_INTEGER + 1 }), undefined);

  const approvalText = formatLorebookWriteApprovalText([
    {
      name: "Ordered Memory",
      keys: ["memory"],
      tag: "event",
      targetLorebook: "world",
      order: 200,
      content: "A durable memory.",
    },
  ]);
  assert.match(approvalText, /\nOrder: 200\n/u);
  assert.match(approvalText, /\nLorebook: world\n/u);
  assert.deepEqual(parseLorebookWriteApprovalText(approvalText), [
    {
      action: "append",
      name: "Ordered Memory",
      keys: ["memory"],
      tag: "event",
      targetLorebook: "world",
      order: 200,
      content: "A durable memory.",
    },
  ]);
  assert.equal(
    parseLorebookWriteApprovalText(
      ["### Signed Order", "Keys: signed", "Tag:", "Order: +200", "", "Keep the sign."].join("\n"),
    )[0]?.order,
    200,
    "Approval edits must accept an explicit leading plus sign on integer orders",
  );

  const updatedEntries: Array<{ id: string; changes: Record<string, unknown> }> = [];
  const createdEntries: Array<Record<string, unknown>> = [];
  const lorebooksStore = {
    listEntries: async () => [
      {
        id: "existing-entry",
        name: "Existing Memory",
        content: "Existing fact.",
        keys: ["existing"],
        tag: "event",
        locked: false,
        order: 100,
      },
    ],
    updateEntry: async (id: string, changes: Record<string, unknown>) => {
      updatedEntries.push({ id, changes });
      return { id, name: "Existing Memory", ...changes };
    },
    createEntry: async (input: Record<string, unknown>) => {
      createdEntries.push(input);
      return { id: `created-${createdEntries.length}`, ...input };
    },
  };
  await persistLorebookKeeperUpdates({
    lorebooksStore: lorebooksStore as any,
    chatId: "chat-5225",
    chatName: "Order proof",
    preferredTargetLorebookId: "lorebook-5225",
    writableLorebookIds: ["lorebook-5225"],
    updates: [
      { entryName: "Existing Memory", newFacts: ["New fact."], order: 200 },
      { entryName: "New Memory", content: "Created fact.", order: 300 },
      { entryName: "Default Memory", content: "Uses storage default.", order: "400" },
    ],
  });
  assert.equal(updatedEntries[0]?.id, "existing-entry");
  assert.equal(updatedEntries[0]?.changes.order, 200);
  assert.equal(createdEntries[0]?.order, 300);
  assert.equal(Object.hasOwn(createdEntries[1] ?? {}, "order"), false);

  const cancelledPersistence = new AbortController();
  let cancelledEntryWrites = 0;
  await assert.rejects(
    persistLorebookKeeperUpdates({
      lorebooksStore: {
        listEntries: async () => {
          cancelledPersistence.abort();
          return [];
        },
        createEntry: async () => {
          cancelledEntryWrites += 1;
          return null;
        },
      } as any,
      chatId: "chat-cancelled",
      chatName: "Cancelled proof",
      preferredTargetLorebookId: "book-cancelled",
      writableLorebookIds: ["book-cancelled"],
      updates: [{ entryName: "Must not persist", content: "Cancelled fact." }],
      signal: cancelledPersistence.signal,
    }),
    /aborted/iu,
  );
  assert.equal(cancelledEntryWrites, 0, "Cancellation after an awaited read must stop the following lorebook write");

  const routedEntries: Array<Record<string, unknown>> = [];
  const createdBooks: Array<Record<string, unknown>> = [];
  const routedBooks: Array<Record<string, unknown>> = [{ id: "book-world", name: "My World — World Lore" }];
  const routedStore = {
    list: async () => routedBooks,
    create: async (input: Record<string, unknown>) => {
      createdBooks.push(input);
      const created = { id: "book-scene", ...input };
      routedBooks.push(created);
      return created;
    },
    listEntries: async () => [],
    createEntry: async (input: Record<string, unknown>) => {
      routedEntries.push(input);
      return { id: `routed-${routedEntries.length}`, ...input };
    },
    updateEntry: async () => null,
  };
  await persistLorebookKeeperUpdates({
    lorebooksStore: routedStore as any,
    chatId: "chat-439",
    chatName: "Campaign",
    preferredTargetLorebookId: "book-world",
    writableLorebookIds: ["book-world"],
    writableLorebooks: [{ id: "book-world", name: "My World — World Lore" }],
    lorebookNamingScheme: { scene: "[WorldName] — Scene Log" },
    worldName: "Campaign",
    updates: [
      { targetLorebook: "My World — World Lore", entryName: "Magic", content: "World fact." },
      { targetLorebook: "scene", entryName: "Tavern", content: "Scene fact." },
      { entryName: "Fallback", content: "Default-book fact." },
    ],
  });
  assert.deepEqual(
    routedEntries.map((entry) => entry.lorebookId),
    ["book-world", "book-scene", "book-world"],
    "exact names and aliases route independently while omitted targets retain the default book",
  );
  assert.equal(createdBooks[0]?.name, "Campaign — Scene Log", "a missing configured alias creates its named book");
  assert.equal(createdBooks[0]?.chatId, "chat-439", "auto-created routing books link to the active chat");
  const nextRunTarget = await resolveLorebookKeeperTarget({
    lorebooksStore: routedStore as any,
    chatId: "chat-439",
    characterIds: [],
    activeLorebookIds: [],
    preferredTargetLorebookId: "book-world",
  });
  assert.ok(
    nextRunTarget.writableLorebookIds.includes("book-scene"),
    "a routing book created for one run must remain writable on the next run instead of being duplicated",
  );
}
