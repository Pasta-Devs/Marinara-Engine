# iOS PWA Bottom Safe Area (Developers)

This developer guide explains a colored stripe that can appear at the bottom of the screen. It shows up when Marinara Engine runs as an iPhone home screen app. It covers the fix Marinara ships, the trade-off that fix forces, and how to diagnose the stripe if a future change brings it back.

A PWA (Progressive Web App) is a website a user installs to the home screen and opens like a native app. This is code-level material for contributors, not an end-user guide.

## The problem

On iPhones with a home indicator (Face ID models), the bottom of the screen is a reserved safe area for the home gesture. iOS treats this zone as roughly 34px tall. It equals the value of the CSS variable `env(safe-area-inset-bottom)`.

When the PWA status bar style is set to `black-translucent`, iOS stops any `position: fixed` element from painting into this zone. Every CSS workaround fails. WebKit clamps negative bottom offsets, `calc(100dvh + env(safe-area-inset-bottom))`, and negative height overrides.

The result is a visible strip below the chat input box. This strip, often called the "chin", shows a different color from the rest of the UI.

## The fix we ship

Marinara sets the status bar style to `black` instead of `black-translucent`. The meta tag lives in `packages/client/index.html`.

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

The viewport tag keeps `viewport-fit=cover` and the default keyboard behavior.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

In `black` mode iOS does not lock the bottom zone. The app shell uses `fixed inset-0` with no viewport-height override, so it paints all the way down into the safe area. The className on the shell in `packages/client/src/components/layout/AppShell.tsx` is:

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

Do not add `interactive-widget=resizes-content` to the viewport tag. On mobile PWAs it can resize the whole chat shell while the keyboard animates and leave message scrolling clipped.

## The trade-off

You cannot have both a glass status bar and a filled bottom. In `black` mode the status bar is a solid dark bar. `black-translucent` gives a prettier transparent top, but it makes the bottom stripe impossible to remove. This is a hard iOS limitation.

## Landscape: the camera's side insets

When an iPhone is turned sideways, its camera (the notch or Dynamic Island) sits at the left or right edge. With `viewport-fit=cover` the page extends under it, and iOS reports the space as `env(safe-area-inset-left)` and `env(safe-area-inset-right)`. On Dynamic Island models that is about 59px on each side, whichever way the phone is turned. Marinara's Android app (target SDK 34, not edge-to-edge) is laid out clear of the cutout, so both insets are 0 there. Other Android browsers can report non-zero insets, for example in fullscreen or edge-to-edge, and the same variables cover them.

Marinara keeps out of that space the way the status-bar strip works in portrait:

- `packages/client/src/styles/globals.css` reads the two insets once, into `--mari-safe-area-inset-left` and `--mari-safe-area-inset-right` on `:root`. Everything else reads these variables, never `env()` directly. `scripts/regressions/mobile-safe-area-inset.regression.ts` enforces this. Dialogs, the omnibar, full-screen editors and TopBar controls retain this protection against the camera and rounded corners.
- On iPhone, `AppShell.tsx` identifies the camera side from `window.orientation` (or `screen.orientation.angle` when unavailable). At 90° the camera is on the left; at −90°/270° it is on the right. A `data-mari-camera-side` attribute on `<html>` lets CSS zero only the opposite **shell** inset, `--mari-shell-inset-left` or `--mari-shell-inset-right`. Unknown rotations, iPad and Android keep the system's insets.
- In the phone shell, `.mari-app` takes its `left` and `right` from the shell variables. The body's page backing shows over the camera, the same colour as the status-bar strip in portrait, without a mirrored gutter on the opposite edge.
- Fixed elements inside the shell are positioned against the screen, not the shell, so they keep out on their own. The phone sheets and their backdrops in `AppShell.tsx` use `MOBILE_SHELL_PANEL_X_CLASS` with the shell variables. Decorations such as the shell's stars are `absolute`, so they stay inside the shell.

To check it without a phone, open a 874×402 touch viewport and set both variables to `59px` in a `:root` stylesheet rule (inline styles override the camera-side selector). On Chromium you can instead emulate the real insets with the DevTools Protocol command `Emulation.setSafeAreaInsetsOverride`. `e2e/phone-camera-side.e2e.ts` checks both rotation directions, the older and newer orientation APIs, unknown rotations, and other devices. The e2e test "a phone turned sideways keeps the app out from under its camera" checks the fallback that preserves both insets.

## How it was diagnosed

The stripe was traced by coloring each layer and reopening the app. Inject the diagnostic styles into `packages/client/dist/index.html`, inside its inline `<style>` block. That file is not cached by the service worker and is always served fresh. Changes show on the next reopen with no cache clear.

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

Read the result like this:

- Chin red means the html canvas is painting there. No fixed element can cover it in `black-translucent` mode.
- Chin blue means the app shell box reaches the bottom. This is the working state.
- Chin green means the input box itself fills down to the edge.

## If an update breaks it

### Symptom: the chin stripe returns below the input box

Check 1. Confirm `apple-mobile-web-app-status-bar-style` is still `black` in `packages/client/index.html`. If it was changed back to `black-translucent`, change it back to `black`.

Check 2. Confirm the AppShell className in `packages/client/src/components/layout/AppShell.tsx` still reads `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`. Do not combine `inset-0` with `h-screen`, `h-dvh`, or `max-h-screen`. That over-constrains the fixed shell and lets the mobile keyboard push the UI around.

Check 3. Run the color diagnostic above to see which layer paints the chin. Force-kill and reopen the app. No cache clear is needed, because `dist/index.html` is not precached.

- Chin red with a blue shell elsewhere means the shell box does not reach the bottom. Confirm the status bar style is `black`.
- Chin still red with a blue shell means the shell is not covering. Confirm `fixed inset-0` is intact.
- Chin blue means the shell covers it but the input box does not fill down. Check the input wrapper padding below.

### Symptom: the input box sits flush against the screen edge

The three input components need `pb-3` on their outer wrapper for natural float spacing, not `pb-0`.

- `packages/client/src/components/chat/ChatInput.tsx`: the wrapper reads `mari-chat-input chat-input-container px-3 pb-3`.
- `packages/client/src/components/chat/ConversationInput.tsx`: the wrapper reads `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`.
- `packages/client/src/components/game/GameInput.tsx`: the wrapper reads `px-3 pt-2 pb-3`.

## Rebuilding

The server serves the built client from `packages/client/dist`, so any source change needs a rebuild.

```
pnpm build:client
```

Then clear site data on the device and reopen the PWA. On the phone open **Settings**, then **Safari**, then **Advanced**, then **Website Data**. The service worker caches JS and CSS by content hash, so a changed hash needs a site-data clear to load the new chunks.

`dist/index.html` is not cached by the service worker and is always served fresh. Use it for quick diagnostic style injections without a full rebuild.

## Key facts

- `black-translucent` gives a transparent status bar but locks the bottom safe area. No CSS workaround exists.
- `black` or `default` gives a solid status bar and lets fixed elements reach the bottom safe area.
- `env(safe-area-inset-bottom)` is about 34px on Face ID iPhones. Use it to pad interactive content above the home indicator when needed.
- In `black-translucent` mode the `dvh` and `lvh` viewport units equal the safe content height, not the physical screen height. Do not use them to extend the shell past that boundary.
- `interactive-widget=resizes-content` can make the fixed chat shell resize while the keyboard opens. Prefer the default viewport behavior.

## Related guides

- [Frontend Architecture (Developers)](frontend.md)
- [iOS / iPadOS PWA Guide](../installation/ios-pwa.md)
