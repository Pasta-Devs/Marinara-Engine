// The stored-guidance modal offers a copy button on every prompt it shows.
//
// The guided block shipped one from the start; the impersonation blocks did
// not, so an impersonation prompt could be read but not lifted out of the
// modal. These assertions pin the copy affordance to all three blocks and keep
// each one's clipboard payload distinct: guided and impersonate copy a
// re-runnable slash command, while the prompt template is a stored setting and
// copies verbatim.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const modal = readSource("packages/client/src/components/chat/GenerationReplayDetailsModal.tsx");
const englishLocale = JSON.parse(readSource("packages/client/src/localization/locales/en.json")) as Record<
  string,
  string
>;

// A block renders its copy button only when it is handed a copy action, so an
// absent `copy` prop is the defect this lane exists to catch.
for (const [blockLabel, propLine] of [
  ["guided", "copy={guidedCopy}"],
  ["impersonation guidance", "copy={impersonateCopy}"],
  ["impersonation prompt template", "copy={promptTemplateCopy}"],
] as const) {
  assert.match(modal, new RegExp(propLine.replace(/[{}]/gu, "\\$&"), "u"), `the ${blockLabel} block must be copyable`);
}

assert.match(
  modal,
  /`\/guided \$\{generationGuide\.trim\(\)\}`/u,
  "the guided block must copy a re-runnable /guided command",
);

assert.match(
  modal,
  /value: `\/impersonate \$\{impersonateGuidance\.trim\(\)\}`/u,
  "the impersonation guidance must copy a re-runnable /impersonate command",
);

// The template is not a command: /impersonate_prompt writes chat metadata,
// which is a different field from the stored template shown here.
assert.match(
  modal,
  /const promptTemplateCopy: CopyAction \| null = impersonatePromptTemplate\s*\?\s*\{\s*value: impersonatePromptTemplate,/u,
  "the impersonation prompt template must copy verbatim, not as a slash command",
);

// Copy buttons must be reachable by assistive technology and localized.
assert.match(modal, /title=\{copy\.title\}/u, "a copy button must carry a tooltip");
assert.match(modal, /aria-label=\{copy\.title\}/u, "a copy button must carry an accessible name");

for (const key of [
  "ui.chat.textblock.copy",
  "ui.chat.textblock.copyAsGuidedCommand",
  "ui.chat.textblock.copyAsImpersonateCommand",
  "ui.chat.textblock.copyGuided",
  "ui.chat.textblock.copyImpersonate",
  "ui.chat.textblock.copyPromptTemplate",
  "ui.chat.textblock.couldNotCopyGuidance",
  "ui.chat.textblock.couldNotCopyPromptTemplate",
  "ui.chat.textblock.guidedCommandCopied",
  "ui.chat.textblock.impersonateCommandCopied",
  "ui.chat.textblock.promptTemplateCopied",
]) {
  assert.ok(englishLocale[key], `${key} must exist in the English catalog`);
  assert.match(modal, new RegExp(`"${key.replace(/\./gu, "\\.")}"`, "u"), `${key} must be used by the modal`);
}

console.log("generation-replay-copy: ok");
