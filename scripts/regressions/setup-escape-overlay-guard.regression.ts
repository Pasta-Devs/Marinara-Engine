// Escape must dismiss the TOPMOST thing during game setup, and only that.
//
// The legacy Experience setup panel draws its own full-page shell rather than a `Modal`, so it listens
// for Escape on `window`. `Modal` takes Escape from a `document` listener and does NOT stop propagation,
// so the same press keeps bubbling to `window`. The malformed-JSON repair dialog is mounted over setup
// on purpose — a failed opening has to stay repairable — so without a guard one Escape press closes that
// dialog AND dismisses the setup behind it, discarding the player's answers and, on a chat that is still
// empty, deleting the chat. Nothing in typecheck or lint can see that: both listeners are individually
// correct, and the collision only exists at dispatch time.
//
// The same registry also settles Escape between two stacked `Modal`s, which each install their own
// `document` listener: only the topmost registration may act on a press, or a confirm opened over a
// settings dialog would take the settings dialog down with it.
//
// Two halves, because the failure needs both:
//   - the registry itself tracks open overlays in opening order (driven here, not read as text), and
//   - the two call sites stay wired to it (read as source text, the way `experience-setup-config`
//     already pins this same feature).
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

const repair = registerModalOverlay();
assert.equal(isModalOverlayOpen(), true, "An open dialog must be visible to a screen that owns its shell");
assert.equal(repair.isTopmost(), true, "The only open dialog is the topmost one");

// Stacked dialogs: the newest one owns Escape, the one underneath does not, and the screen underneath
// both stays suppressed until the LAST one closes, so a confirm opened from the repair dialog cannot hand
// Escape back to the setup panel early.
const confirm = registerModalOverlay();
assert.equal(confirm.isTopmost(), true, "The dialog opened last is the topmost one");
assert.equal(repair.isTopmost(), false, "A dialog with another stacked above it must not act on Escape");
confirm.release();
assert.equal(isModalOverlayOpen(), true, "A second dialog closing must not clear the first one's suppression");
assert.equal(repair.isTopmost(), true, "Closing the top dialog hands Escape back to the one beneath it");
assert.equal(confirm.isTopmost(), false, "A released registration never claims Escape again");

// React can run an effect cleanup twice (StrictMode remount); a double release must be a no-op, or it
// would silently re-arm the screen underneath a dialog that is still open.
confirm.release();
assert.equal(isModalOverlayOpen(), true, "Releasing the same registration twice must be a no-op");
assert.equal(repair.isTopmost(), true, "A stale release must not disturb the dialog that is still open");

// Closing out of order: the dialog underneath closes first (its owner unmounted it), the top one stays
// topmost and the screen below stays suppressed.
const lower = registerModalOverlay();
const upper = registerModalOverlay();
lower.release();
assert.equal(upper.isTopmost(), true, "The top dialog stays topmost when one beneath it closes first");
assert.equal(repair.isTopmost(), false, "A dialog beneath an open one still must not act on Escape");
upper.release();

repair.release();
assert.equal(isModalOverlayOpen(), false, "The last dialog closing hands Escape back to the screen below");

const once = registerModalOverlay();
once.release();
once.release();
assert.equal(isModalOverlayOpen(), false, "A stale release must never leave the registry claiming an open dialog");

// A stale release that corrupted the stack would only show up on the NEXT dialog, whose registration it
// would swallow: Escape re-armed under an open dialog, which is the whole failure. So the state a stale
// release leaves behind has to be a clean empty stack, not a debt.
const afterStale = registerModalOverlay();
assert.equal(isModalOverlayOpen(), true, "A stale release must not leave a debt that swallows the next dialog");
assert.equal(afterStale.isTopmost(), true, "The next dialog after a stale release is topmost as usual");
afterStale.release();
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
  /useEffect\(\s*\(\)\s*=>\s*\{\s*if\s*\(!open\)\s*return;\s*const registration = registerModalOverlay\(\);[\s\S]{0,400}?registration\.release\(\);[\s\S]{0,200}?\}\s*,\s*\[open\]\s*\)/u,
  "Modal's registration should live in an effect gated on `open` so it releases when the dialog closes",
);
assert.match(
  modalSource,
  /e\.key !== "Escape" \|\| closeDisabled\) return;\s*if \(!overlayRegistrationRef\.current\?\.isTopmost\(\)\) return;\s*onClose\(\);/u,
  "Modal's Escape handler must act only when its own registration is the topmost open overlay",
);

// The legacy panel is the only setup screen with its own `window` Escape listener; the wizard has none,
// so there is nothing to pin there.
const dialogPath = "packages/client/src/components/game/LegacyExperienceSetupDialog.tsx";
const dialogSource = readSource(dialogPath);
const escapeCheck = dialogSource.indexOf('event.key !== "Escape"');
assert.ok(
  escapeCheck >= 0,
  `${dialogPath} should early-return out of its keydown handler on anything but Escape, so the overlay guard sits beside that check`,
);
assert.match(
  dialogSource.slice(Math.max(0, escapeCheck - 200), escapeCheck + 200),
  /event\.key !== "Escape" \|\| isModalOverlayOpen\(\)/u,
  `${dialogPath} must stand down while a Modal is stacked above it, or one Escape press closes both`,
);

console.log("Escape dismisses the topmost dialog only: never a dialog beneath another, never the setup underneath.");
