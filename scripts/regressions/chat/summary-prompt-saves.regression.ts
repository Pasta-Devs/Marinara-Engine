// Saving the summary prompts: a Combine prompt save waits for writes in flight and saves the latest draft, and no
// save replays an older render's templates. Reads component source until a test can drive these races.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const summaryPopoverSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/chat/ChatSummaryPanel.tsx"),
  "utf8",
);
assert.match(
  summaryPopoverSource,
  /if \(promptSettingsSaveLockedRef\.current\) \{\s*await promptSettingsSaveQueueRef\.current;[\s\S]{0,350}combinePromptDraftRef\.current/u,
  "Combine prompt saves must wait for active settings writes and then retry the latest draft",
);
assert.match(
  summaryPopoverSource,
  /queryClient\.getQueryData<ChatSummaryPromptSettings/u,
  "Queued Combine saves must use the latest prompt settings from the query cache",
);
assert.match(
  summaryPopoverSource,
  /const currentSettings = readCurrentPromptSettings\(\);\s*const promise = persistPromptTemplates\(currentSettings\.templates, currentSettings\.activeTemplateId, nextPrompt\);/u,
  "Combine prompt persistence must apply the latest cached templates and active selection",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /promptTemplatesRef|activePromptTemplateIdRef/u,
  "Summary prompt saves must not replay mirrored template state from an earlier render",
);
