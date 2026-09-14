// Escape must dismiss the TOPMOST thing during game setup, and only that.
//
// Both setup screens draw their own full-page shell rather than a `Modal`, so each listens for Escape on
// `window`. `Modal` takes Escape from a `document` listener and does NOT stop propagation, so the same
// press keeps bubbling to `window`. The malformed-JSON repair dialog is mounted over setup on purpose —
// a failed opening has to stay repairable from either setup path — so without a guard one Escape press
// closes that dialog AND dismisses the setup behind it, discarding the player's answers and, on a chat
// that is still empty, deleting the chat. Nothing in typecheck or lint can see that: both listeners are
// individually correct, and the collision only exists at dispatch time.
//
// Two halves, because the failure needs both:
//   - the registry itself counts open overlays (driven here, not read as text), and
//   - the three call sites stay wired to it (read as source text, the way `game-setup-experience-config`
//     already pins this same wizard).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isModalOverlayOpen,
  registerModalOverlay,
  __resetModalOverlayRegistryForTests,
} from "../../packages/client/src/lib/modal-overlay-registry.js";

// ── 1. The registry's bookkeeping ──
__resetModalOverlayRegistryForTests();
assert.equal(isModalOverlayOpen(), false, "Nothing is stacked over setup before a dialog opens");

const releaseRepair = registerModalOverlay();
assert.equal(isModalOverlayOpen(), true, "An open dialog must be visible to a screen that owns its shell");

// Stacked dialogs: the screen underneath stays suppressed until the LAST one closes, so a confirm opened
// from the repair dialog cannot hand Escape back to the wizard early.
const releaseConfirm = registerModalOverlay();
releaseConfirm();
assert.equal(isModalOverlayOpen(), true, "A second dialog closing must not clear the first one's suppression");

// React can run an effect cleanup twice (StrictMode remount); a double release must not drive the count
// negative, which would silently re-arm the screen underneath a dialog that is still open.
releaseConfirm();
assert.equal(isModalOverlayOpen(), true, "Releasing the same registration twice must be a no-op");

releaseRepair();
assert.equal(isModalOverlayOpen(), false, "The last dialog closing hands Escape back to the screen below");

const releaseOnce = registerModalOverlay();
releaseOnce();
releaseOnce();
assert.equal(isModalOverlayOpen(), false, "A stale release must never push the count below zero");

// A count driven negative would read as zero here and only show up on the NEXT dialog, whose
// registration it would swallow — Escape re-armed under an open dialog, which is the whole failure. So
// the state a stale release leaves behind has to be a clean zero, not a debt.
const releaseAfterStale = registerModalOverlay();
assert.equal(isModalOverlayOpen(), true, "A stale release must not leave a debt that swallows the next dialog");
releaseAfterStale();
assert.equal(isModalOverlayOpen(), false, "That dialog closing hands Escape back like any other");
__resetModalOverlayRegistryForTests();

// ── 2. The call sites stay wired ──
const readSource = (relativePath: string) =>
  readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
    .replace(/\r\n/gu, "\n")
    .replace(/\s+/gu, " ");

const modalSource = readSource("packages/client/src/components/ui/Modal.tsx");
assert.match(
  modalSource,
  /registerModalOverlay/u,
  "Modal should register itself as an open overlay; nothing else tells a full-page screen a dialog is up",
);
assert.match(
  modalSource,
  /useEffect\(\s*\(\)\s*=>\s*\{\s*if\s*\(!open\)\s*return;\s*return registerModalOverlay\(\);\s*\}\s*,\s*\[open\]\s*\)/u,
  "Modal's registration should live in an effect gated on `open` so it releases when the dialog closes",
);

/** The Escape listener of a setup screen that owns its own shell, normalized to one line. */
function escapeListener(relativePath: string) {
  const source = readSource(relativePath);
  const start = source.indexOf('event.key !== "Escape"');
  assert.ok(
    start >= 0,
    `${relativePath} should still early-return out of its keydown handler on anything but Escape, so the overlay guard sits beside that check`,
  );
  return source.slice(Math.max(0, start - 200), start + 200);
}

for (const screen of [
  "packages/client/src/components/game/GameSetupWizard.tsx",
  "packages/client/src/components/game/LegacyExperienceSetupDialog.tsx",
]) {
  assert.match(
    escapeListener(screen),
    /event\.key !== "Escape" \|\| isModalOverlayOpen\(\)/u,
    `${screen} must stand down while a Modal is stacked above it, or one Escape press closes both`,
  );
}

console.log("Escape during game setup dismisses the topmost dialog only, never the setup underneath it.");
