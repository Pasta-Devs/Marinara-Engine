// The Chat Summary controls: combining reveals the kept sources, entries reorder by drag, touch and keyboard, and
// the Summary Prompt card has one Edit path that saves on Done or when the drawer closes, and a prompt save locks the
// prompt controls until it finishes. Reads component source;
// replacing these needs browser tests.
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
  /onSuccess: \(data\) => \{\s*setSelectedEntryIds\(new Set\(\)\);\s*setShowInactiveSummaries\(true\)/u,
  "The Chat Summary popover must reveal retained inactive sources after combining",
);
assert.match(
  summaryPopoverSource,
  /<[A-Za-z]+\b(?=[^>]*data-summary-entry-root\b)(?=[^>]*onDragOver=\{handleSummaryContainerDragOver\})(?=[^>]*onDrop=\{handleSummaryDrop\})[^>]*>/u,
  "The summary entry list root must be the desktop drag-and-drop container",
);
assert.match(
  summaryPopoverSource,
  /<[A-Za-z]+\b(?=[^>]*data-touch-reorder-item=\{reorderable \? "summary-entry" : undefined\})(?=[^>]*data-touch-reorder-index=\{reorderable \? entryIndex : undefined\})(?=[^>]*draggable=\{reorderable && dragReady\})(?=[^>]*onDragStart=\{onDragStart\})[^>]*>/u,
  "Summary entries must expose a shared desktop and touch reorder surface (the same row is a touch-reorder item, carries its persisted reorder index, and is desktop-draggable)",
);
assert.match(
  summaryPopoverSource,
  /startSummaryEntryTouchDrag\(event, entry\.id/u,
  "Summary entries must support touch drag-and-drop on mobile",
);
assert.match(
  summaryPopoverSource,
  /<div className="flex items-center gap-0\.5">[\s\S]{0,900}onMoveUp[\s\S]{0,900}onMoveDown/u,
  "Summary entries must keep keyboard reorder controls available on narrow viewports",
);
assert.match(
  summaryPopoverSource,
  /!templateEditorOpen[\s\S]{0,500}\{activeSummaryPrompt\}[\s\S]{0,500}templateEditorOpen/u,
  "The active Chat Summary prompt must remain visible until its template editor opens",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /localizeUi\("ui\.chat\.summarypopover\.templates"\)/u,
  "The Summary Prompt card must use one Edit path instead of a separate Templates button",
);
assert.match(
  summaryPopoverSource,
  /onClick=\{\(\) => void handleToggleVisiblePromptEditor\(\)\}[\s\S]{0,500}aria-expanded=\{visiblePromptEditorOpen\}/u,
  "The Summary Prompt Edit/Done action must expose disclosure semantics for its editor",
);
// The template chooser is the shared Select (#9468): its window closes on any click outside it, the Edit button's
// included, so the editor no longer has its own selector state to close.
assert.match(
  summaryPopoverSource,
  /if \(!visiblePromptEditorOpen\) \{\s*handleEditVisiblePrompt\(\);/u,
  "Opening the Summary Prompt editor must open it from the visible prompt",
);
assert.doesNotMatch(
  summaryPopoverSource,
  /templateSelectOpen/u,
  "The template chooser must not keep its own open state",
);
assert.match(
  summaryPopoverSource,
  /const saved = await commitCombinePromptDraft\(\);\s*if \(saved\) setCombinePromptEditorOpen\(false\);/u,
  "Done must save and close the Combine prompt editor",
);
assert.match(
  summaryPopoverSource,
  /batchAbortControllerRef\.current\?\.abort\(\);\s*void commitCombinePromptDraftRef\.current\(\);/u,
  "Collapsing the Chat Summary drawer or closing Chat Settings must still persist the Combine draft",
);

// Saving the summary prompts locks every prompt control until the save finishes, so a second change can't overwrite it.
{
  const promptSettingsPersistSource = summaryPopoverSource.slice(
    summaryPopoverSource.indexOf("const persistPromptTemplates"),
    summaryPopoverSource.indexOf("const commitCombinePromptDraft"),
  );
  const promptSettingsLockIndex = promptSettingsPersistSource.indexOf("promptSettingsSaveLockedRef.current = true");
  const promptSettingsMutationIndex = promptSettingsPersistSource.indexOf("updateGlobalPromptSettings.mutateAsync");
  const promptSettingsUnlockIndex = promptSettingsPersistSource.indexOf("promptSettingsSaveLockedRef.current = false");
  assert.ok(
    promptSettingsLockIndex >= 0 &&
      promptSettingsLockIndex < promptSettingsMutationIndex &&
      promptSettingsMutationIndex < promptSettingsUnlockIndex,
    "Summary prompt writes must lock before mutation and unlock only afterward",
  );
  const summaryPromptControlsSource = summaryPopoverSource.slice(
    summaryPopoverSource.indexOf("<Tabs"),
    summaryPopoverSource.indexOf('localizeUi("ui.chat.summarypopover.summaryConnection")'),
  );
  assert.equal(
    summaryPromptControlsSource.match(/disabled=\{promptSettingsSaveLocked\}/gu)?.length,
    5,
    "Every prompt option, template row, and open template editor control must use the save lock",
  );
  assert.equal(
    summaryPromptControlsSource.match(/disabled=\{!globalPromptSettingsReady \|\| promptSettingsSaveLocked\}/gu)
      ?.length,
    2,
    "Every prompt-level action must use the save lock",
  );
  assert.match(
    summaryPromptControlsSource,
    /!hasTemplateDraft \|\|\s*promptSettingsSaveLocked \|\|\s*!globalPromptSettingsReady/u,
    "The template Save action must use the save lock",
  );
  const summaryPromptTemplateRowSource = summaryPopoverSource.slice(
    summaryPopoverSource.indexOf("interface SummaryPromptTemplateRowProps"),
  );
  assert.equal(
    summaryPromptTemplateRowSource.match(/disabled=\{disabled\}/gu)?.length,
    4,
    "Every template-row action must forward its disabled state",
  );
}
