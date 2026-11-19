// Professor Mari's chat in the client: her composer, user messages and failed steps in the transcript, deleting one or
// many chats, Stop without a failure card, and loads that ignore a stale or switched-away chat. Reads component source;
// replacing these needs browser tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const professorMariHomeSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/HomeProfessorMariChat.tsx", import.meta.url),
  "utf8",
);
// Slice 82: the chat's parts live in components/chat/mari/; "nowhere" and count checks read all of them.
const mariChatDir = new URL("../../../packages/client/src/components/chat/mari/", import.meta.url);
const mariChatPart = (name: string) => readFileSync(new URL(name, mariChatDir), "utf8");
const mariMessageActionsSource = mariChatPart("use-mari-message-actions.ts");
const mariWorkspaceRunSource = mariChatPart("use-mari-workspace-run.ts");
const mariChatHistoryActionsSource = mariChatPart("use-mari-chat-history-actions.ts");
const mariWorkTimelineSource = mariChatPart("MariWorkTimeline.tsx");
const compactMariMessageSource = mariChatPart("CompactMariMessage.tsx");
assert.match(
  professorMariHomeSource,
  /enterToSendProfessorMari/u,
  "Professor Mari must read her persisted Send on Enter preference",
);
assert.match(professorMariHomeSource, /handleBulkDeleteProfessorChats/u);
assert.match(
  mariMessageActionsSource,
  /const handleEditMessage = useCallback\([\s\S]{0,180}if \(!chatId \|\| isBusy\) return;/u,
  "Professor Mari's first edit after generation must not be rejected by a stale busy ref",
);
// A failed send now keeps the message in the transcript with one Retry card (failRun) and never refills the
// composer; Stop is not a failure, so failRun returns before it shows anything.
assert.match(
  mariWorkspaceRunSource,
  /const failRun = useCallback\(\s*\([^)]*\) => \{\s*if \(isProfessorMariAbortError\(error\)\) return;/u,
  "Stopping Professor Mari must not show a failure",
);
assert.match(
  mariChatHistoryActionsSource,
  /handleDeleteProfessorChat[\s\S]{0,500}showConfirmDialog/u,
  "Deleting one Professor Mari chat must use the app confirmation dialog",
);
// Every step row, failed ones included, opens to technical details with the tool's output (slice 72
// moved the details into one `technicalDetails` helper that every step row renders).
assert.match(
  mariWorkTimelineSource,
  /const technicalDetails = \(tool: WorkspaceToolCall\) =>[\s\S]{0,600}tool\.output !== null && tool\.output !== undefined \? <pre>/u,
  "Failed workspace tools must reveal their provider output in the transcript",
);
assert.match(
  professorMariHomeSource,
  /messageLoadAbortRef\.current !== controller[\s\S]{0,80}activeChatIdRef\.current !== id/u,
  "Professor Mari message loads must discard stale requests and inactive chat results",
);
assert.match(
  professorMariHomeSource,
  /options\.shouldApply\?\.\(\) === false[\s\S]{0,480}setMessages/u,
  "Professor Mari message loads must recheck an operation guard before applying a response",
);
assert.match(
  mariWorkspaceRunSource,
  /loadMessages\(completedChatId, \{[\s\S]{0,160}workspaceRunIdRef\.current === runId[\s\S]{0,100}activeChatIdRef\.current === completedChatId/u,
  "Professor Mari background refreshes must not overwrite state after a newer operation starts",
);
assert.match(
  professorMariHomeSource,
  // #5725 strengthened this guard: it also rejects responses requested for a
  // previous chat and holds mode fields across pending mode writes.
  /const refreshWorkspaceStatus = useCallback\(\s*async \(shouldApply\?: \(\) => boolean\)[\s\S]{0,800}if \(shouldApply\?\.\(\) === false \|\| activeChatIdRef\.current !== chatIdAtStart\) return status;[\s\S]{0,900}setWorkspaceStatus\(/u,
  "Professor Mari workspace status loads must recheck an operation guard before applying a response",
);
assert.match(
  mariWorkspaceRunSource,
  /refreshWorkspaceStatus\([\s\S]{0,140}workspaceRunIdRef\.current === runId[\s\S]{0,100}activeChatIdRef\.current === completedChatId/u,
  "Professor Mari post-run status refreshes must not overwrite state after a newer operation starts",
);
// The work-stage layout (1a61247d1) replaced the user-message separators with a right-aligned bubble.
assert.match(
  compactMariMessageSource,
  /message\.role === "user"[\s\S]{0,180}<TranscriptRow[^>]*className="mari-user-request/u,
  "Professor Mari user messages must render as the user-request row",
);
assert.match(
  mariChatHistoryActionsSource,
  /Promise\.allSettled\([\s\S]*?api\.delete\(`\/chats\/internal\/professor-mari\/chats\/\$\{id\}`\)/u,
  "Professor Mari chat history should delete all selected chats through the existing endpoint",
);
