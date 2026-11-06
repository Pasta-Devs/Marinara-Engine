import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
const guestCss = readFileSync(
  join(repositoryRoot, "packages/client/src/features/multiplayer/multiplayer-guest.css"),
  "utf8",
);
assert.match(
  guestCss,
  /@supports \(-moz-appearance: none\) \{\s*:root \{\s*--mari-safe-area-inset-bottom: 0px;/u,
  "the isolated guest stylesheet must preserve the same Gecko inset correction without loading global CSS",
);

// The override lives inside the stylesheet's single Gecko-scoped @supports
// block (roleplay-streaming.regression.ts extracts that block by its first
// occurrence, so a second block must not be introduced).
const firefoxSupportsStart = globalsCss.indexOf("@supports (-moz-appearance: none)");
assert.notEqual(firefoxSupportsStart, -1, "globals.css must keep the Gecko-scoped @supports block");
assert.match(
  globalsCss.slice(firefoxSupportsStart),
  /^@supports \(-moz-appearance: none\) \{[\s\S]*?:root \{[^}]*--mari-safe-area-inset-bottom: 0px;[^}]*\}/u,
  "globals.css must zero the bottom safe-area override for Gecko, whose Android build misreports env(safe-area-inset-bottom)",
);
assert.equal(
  globalsCss.indexOf("@supports (-moz-appearance: none)", firefoxSupportsStart + 1),
  -1,
  "globals.css must keep a single Gecko-scoped @supports block (roleplay-streaming.regression.ts extracts the first one)",
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

// Issue #5667: every client consumer of the bottom safe-area inset must route
// through the override hook so the Gecko zero-override (and any future
// shell-published inset) applies uniformly. A raw env(safe-area-inset-bottom)
// reintroduces the Android Firefox dead band on that surface.
const clientSourceRoot = join(repositoryRoot, "packages/client/src");
const overrideHookPattern = /var\(--mari-safe-area-inset-bottom,\s*env\(safe-area-inset-bottom\)\)/gu;
const cssCommentPattern = /\/\*[\s\S]*?\*\//gu;
const rawConsumers: string[] = [];
for (const entry of readdirSync(clientSourceRoot, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:tsx?|css)$/u.test(entry.name)) continue;
  const filePath = join(entry.parentPath, entry.name);
  const stripped = readFileSync(filePath, "utf8").replace(overrideHookPattern, "").replace(cssCommentPattern, "");
  if (stripped.includes("env(safe-area-inset-bottom")) {
    rawConsumers.push(filePath.slice(repositoryRoot.length + 1));
  }
}
assert.deepEqual(
  rawConsumers,
  [],
  "Client code must consume the bottom safe-area inset via var(--mari-safe-area-inset-bottom, env(safe-area-inset-bottom)), never raw env() (#5667)",
);

// A phone turned sideways puts its camera in the left or right inset. The fixed shell and the fixed
// phone sheets stop short of both so nothing sits under it, and the body's page backing shows there as
// a strip, as the status-bar strip does in portrait. env() is read once, so a test can stand in a notch.
assert.match(
  globalsCss,
  /:root \{\s*--mari-safe-area-inset-left: env\(safe-area-inset-left, 0px\);\s*--mari-safe-area-inset-right: env\(safe-area-inset-right, 0px\);\s*--mari-shell-inset-left: var\(--mari-safe-area-inset-left\);\s*--mari-shell-inset-right: var\(--mari-safe-area-inset-right\);\s*\}/u,
  "globals.css must publish the side safe-area insets once, as --mari-safe-area-inset-left/right",
);
const mobileShellStart = globalsCss.indexOf(
  "@media (max-width: 767px), (max-width: 1440px) and (hover: none) and (any-pointer: coarse) {",
);
assert.notEqual(mobileShellStart, -1, "globals.css must keep the mobile-shell media block");
assert.match(
  globalsCss.slice(mobileShellStart, mobileShellStart + 6000),
  /\.mari-app \{\s*left: var\(--mari-shell-inset-left\);\s*right: var\(--mari-shell-inset-right\);\s*\}/u,
  "The phone shell must use its camera-side insets",
);
assert.match(
  appShellSource,
  /const MOBILE_SHELL_PANEL_X_CLASS = "left-\(--mari-shell-inset-left\) right-\(--mari-shell-inset-right\)";/u,
  "Phone sheets must take their sides from the shell insets",
);
assert.equal(
  appShellSource.match(/MOBILE_SHELL_PANEL_X_CLASS,/gu)?.length,
  5,
  "Both backdrops and the detail, tracker and chats/settings sheets must keep out of the side insets",
);
assert.doesNotMatch(
  appShellSource,
  /mari-mobile-detail-sheet !fixed[^"]*!w-full|mari-tracker-panel !fixed[^"]*w-screen|"!fixed right-0 bottom-0 z-50 !w-full/u,
  "A full-width phone sheet would run back under the camera",
);
const rawSideConsumers: string[] = [];
const sideHookDefinition =
  /--mari-safe-area-inset-left: env\(safe-area-inset-left, 0px\);|--mari-safe-area-inset-right: env\(safe-area-inset-right, 0px\);/gu;
for (const entry of readdirSync(clientSourceRoot, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !/\.(?:tsx?|css)$/u.test(entry.name)) continue;
  const filePath = join(entry.parentPath, entry.name);
  const stripped = readFileSync(filePath, "utf8").replace(sideHookDefinition, "").replace(cssCommentPattern, "");
  if (/env\(safe-area-inset-(?:left|right)/u.test(stripped))
    rawSideConsumers.push(filePath.slice(repositoryRoot.length + 1));
}
assert.deepEqual(
  rawSideConsumers,
  [],
  "Client code must read the side safe-area insets via var(--mari-safe-area-inset-left/right), never raw env()",
);

console.info("Mobile safe-area inset regressions passed.");
