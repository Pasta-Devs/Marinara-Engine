# iOS PWA Bottom Safe Area — How It Works and How to Fix It

## The Problem

On iPhones with a home indicator (Face ID models), the bottom ~34px of the screen is a "safe area" zone for the home gesture. In a PWA with `apple-mobile-web-app-status-bar-style: black-translucent`, iOS prevents `position: fixed` elements from painting into this zone entirely. Every CSS trick fails — negative bottom offsets, `calc(100dvh + env(safe-area-inset-bottom))`, negative AppShell height overrides — all get silently clamped by WebKit.

The result is a visible "chin" strip below the chat input box that shows a different color from the rest of the UI.

## The Fix (What We Ship)

**`packages/client/index.html`** uses `content="black"` instead of `content="black-translucent"`, and adds `interactive-widget=resizes-content` to the viewport meta:

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<meta name="viewport" content="..., viewport-fit=cover, interactive-widget=resizes-content" />
```

In `black` mode, iOS does not apply the bottom restriction. AppShell uses `fixed top-0 left-0 right-0 h-dvh` — no explicit `bottom: 0`, height controlled by the `dvh` unit. With `interactive-widget=resizes-content`, `dvh` shrinks when the keyboard opens (iOS resizes the viewport instead of scrolling it), so the layout compresses cleanly above the keyboard without the UI shooting upward.

**Trade-off:** The status bar is a solid dark bar instead of a transparent glass overlay. `black-translucent` gives a prettier top (glass effect under the status bar) but makes the bottom chin unfixable. This is a hard iOS limitation — you cannot have both.

## How It Was Diagnosed

1. Set `html, body { background-color: #ff0000 }` in the inline `<style>` block of `dist/index.html` (not SW-cached, takes effect on next reopen with no cache clear).
2. Set `.mari-chat-input-box { background-color: #00ff00 }` to see the input bar.
3. **Chin red = html canvas** — no CSS div can paint there in `black-translucent` mode.
4. **Chin dark = AppShell background** — AppShell's box covers that zone.
5. **Chin green = already fixed.**

Switching to `black` mode turned the chin dark (AppShell covers it). That's the working state.

## If an Update Breaks It

### Symptom: chin strip reappears below the input box

**Check 1:** Has `apple-mobile-web-app-status-bar-style` been changed back to `black-translucent` in `packages/client/index.html`? Change it back to `black`.

**Check 2:** Is the AppShell `className` still `"mari-app mari-app-background-paint fixed top-0 left-0 right-0 h-dvh flex overflow-hidden"` in `packages/client/src/components/layout/AppShell.tsx`? Do not add `bottom-0` or `inset-0` — that creates an over-constrained layout that makes the UI shoot up when the keyboard opens.

**Check 3:** Run the red/green diagnostic to confirm which layer is painting the chin:

```html
<!-- Add temporarily to packages/client/dist/index.html <style> block -->
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Force-kill and reopen (no cache clear needed, `dist/index.html` is not SW-cached):

- **Chin red, AppShell blue elsewhere** → AppShell box doesn't reach bottom → check status bar style is `black`, not `black-translucent`
- **Chin still red with blue AppShell** → AppShell somehow not covering → check AppShell's `fixed inset-0` is intact
- **Chin blue** → AppShell covers it but input box doesn't fill down to it → check outer wrapper padding (see below)

### Symptom: input box is flush to the screen edge with no breathing room

The outer wrapper divs in the three input components should have `pb-3` (not `pb-0`) for natural float spacing:

- `packages/client/src/components/chat/ChatInput.tsx` — look for `mari-chat-input chat-input-container`, ensure `pb-3` not `pb-0`
- `packages/client/src/components/chat/ConversationInput.tsx` — look for `relative px-2 sm:px-3 pb-3`
- `packages/client/src/components/game/GameInput.tsx` — look for `px-3 pt-2 pb-3`

### Rebuilding

After any source change, the server serves from `packages/client/dist/` which requires a build:

```bash
pnpm --filter client build
```

Then clear site data on the device (Settings → Safari → Advanced → Website Data, or via DevTools) and reopen the PWA. The service worker caches JS/CSS by hash — if asset hashes changed, clearing site data is necessary to pick up new chunks.

`dist/index.html` is **not** cached by the service worker and always served fresh. Use it for quick diagnostic style injections without rebuilding.

## Key Facts

- `black-translucent` → transparent status bar, chin zone locked (WebKit restriction), no CSS workaround exists
- `black` or `default` → solid status bar, chin zone reachable by fixed elements
- `env(safe-area-inset-bottom)` = ~34px on Face ID iPhones; use it for padding interactive content above the home indicator if needed
- `dvh`/`lvh` viewport units in `black-translucent` mode equal the safe-content-area height (not physical screen height) — do not attempt to use these to extend AppShell past the safe-content boundary in that mode
- SillyTavern avoids this entirely by not using `black-translucent`
