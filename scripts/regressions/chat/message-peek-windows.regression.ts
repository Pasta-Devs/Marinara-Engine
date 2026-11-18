// Readers that only need a chat's newest few messages use the peek hook, never the transcript's paged query.
// That query is keyed by chat id alone and keeps its page size in its options, so a second reader with another size
// takes over the transcript's paging: while Chat Settings was open, refetches ignored the user's messages per page
// and "Load More" disappeared (#4721, #4724). The peek hook keys each window by its size. Reads component source;
// no browser test opens Chat Settings or the tracker panel and then pages the transcript.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const clientDir = new URL("../../../packages/client/src/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, clientDir), "utf8");

const chatSettingsSource = [
  "features/chat-settings/ChatSettingsDrawer.tsx",
  ...["sections", "agents"].flatMap((folder) =>
    readdirSync(new URL(`features/chat-settings/${folder}/`, clientDir)).map(
      (name) => `features/chat-settings/${folder}/${name}`,
    ),
  ),
]
  .map(read)
  .join("\n");
assert.doesNotMatch(
  chatSettingsSource,
  /useChatMessages\(/u,
  "Chat Settings must not observe the shared chatKeys.messages infinite query (#4721)",
);
assert.match(
  chatSettingsSource,
  /useChatMessagePeek\(\s*chat\.id,\s*100,/u,
  "The secret-plot reader must fetch its newest-100 window through the limit-keyed peek hook",
);

const trackerModelSource = read("features/tracker-panel/hooks/use-tracker-panel-model.ts");
assert.doesNotMatch(
  trackerModelSource,
  /useChatMessages\(/u,
  "The tracker panel must not observe the shared chatKeys.messages infinite query (#4724)",
);
assert.match(
  trackerModelSource,
  /useChatMessagePeek\(\s*activeChatId,\s*20,/u,
  "The tracker panel must fetch its newest-20 sprite window through the limit-keyed peek hook",
);

assert.match(
  read("hooks/use-chats.ts"),
  /queryKey: \[\.\.\.chatKeys\.messagePeek\(chatId \?\? ""\), limit\]/u,
  "The peek hook's query key must include its limit so different windows never share options",
);
console.info("Message peek window checks passed.");
