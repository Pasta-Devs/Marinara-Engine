// The New Chat wizard's parameter toggle stays inside its card when Android enlarges text. Reads component source
// until a test can measure it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chatSetupWizardSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/ChatSetupWizard.tsx", import.meta.url),
  "utf8",
);
const setupGenerationParametersStart = chatSetupWizardSource.indexOf("function SetupGenerationParametersPanel");
const chatSetupWizardEnd = chatSetupWizardSource.indexOf("export function ChatSetupWizard");
assert.ok(setupGenerationParametersStart >= 0 && chatSetupWizardEnd > setupGenerationParametersStart);
const setupGenerationParametersSource = chatSetupWizardSource.slice(setupGenerationParametersStart, chatSetupWizardEnd);
assert.match(
  setupGenerationParametersSource,
  /className="flex min-w-0 w-full items-center justify-between gap-3 text-left"[\s\S]*className="min-w-0 flex-1"[\s\S]*"h-5 w-9 shrink-0 rounded-full/u,
  "The New Chat parameter toggle must stay within its card when Android enlarges text",
);
