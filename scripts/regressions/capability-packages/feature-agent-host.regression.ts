// The Feature agent detail host passes the summary and preset-editor callbacks to its package. Reads component source
// until a test can check it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appShellSource = readFileSync(
  new URL("../../../packages/client/src/components/layout/AppShell.tsx", import.meta.url),
  "utf8",
);
assert.match(
  appShellSource,
  /onOpenChatSummarySettings:[\s\S]{0,180}onOpenActivePromptPresetEditor:/u,
  "Feature detail capability props must expose both guided onboarding navigation callbacks",
);
