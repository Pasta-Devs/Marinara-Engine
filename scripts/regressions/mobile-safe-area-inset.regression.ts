import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Issue #5665: Gecko on Android reports env(safe-area-inset-bottom) as the
// system navigation-bar height even though its layout viewport already stops
// above the bar, so raw env() consumers double-compensate into a dead band
// that obscures content on the mobile shell panels and the chat composer.
// The fix publishes a zero override through --mari-safe-area-inset-bottom via
// a Gecko-scoped @supports probe; bottom safe-area consumers must prefer the
// override hook over env().

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const globalsCss = readFileSync(join(repositoryRoot, "packages/client/src/styles/globals.css"), "utf8");
const appShellSource = readFileSync(join(repositoryRoot, "packages/client/src/components/layout/AppShell.tsx"), "utf8");

assert.match(
  globalsCss,
  /@supports \(-moz-appearance: none\) \{\s*:root \{\s*--mari-safe-area-inset-bottom: 0px;\s*\}\s*\}/u,
  "globals.css must zero the bottom safe-area override for Gecko, whose Android build misreports env(safe-area-inset-bottom)",
);

assert.match(
  globalsCss,
  /\.chat-input-container \{[^}]*var\(--mari-safe-area-inset-bottom, env\(safe-area-inset-bottom\)\)/u,
  "The chat composer must prefer the safe-area override hook over env()",
);

assert.match(
  appShellSource,
  /MOBILE_SHELL_PANEL_BOTTOM_PADDING_CLASS\s*=\s*\n?\s*"pb-\[min\(max\(var\(--mari-safe-area-inset-bottom,env\(safe-area-inset-bottom\)\),0\.5rem\),3rem\)\]"/u,
  "Mobile shell panels must prefer the safe-area override hook over env()",
);

console.info("Mobile safe-area inset regressions passed.");
