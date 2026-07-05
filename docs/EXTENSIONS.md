# Extension Packages

Marinara Engine extensions are add-ons for changing how the app looks and behaves. Browser extensions can include CSS or JavaScript that runs in the Marinara page, observes or edits the DOM, adds controls, registers hotkeys, calls allowed Marinara API routes, and cleans itself up when disabled. Trusted server extensions can include JavaScript that runs in the Marinara Node.js server process.

Extensions are imported from **Settings -> Extensions** as a `.json`, `.css`, `.js`, `.server.js`, `.zip`, or a folder. Only install extensions from people you trust. Browser extension JavaScript runs with the same browser privileges as the app UI. Server extension JavaScript runs on the host server and can affect that server until disabled. Neither runtime directly patches Marinara's source code on disk.

Installing, updating, toggling, or removing extensions is a privileged action. It works from loopback/local access, or from remote browsers when `ADMIN_SECRET` is set on the server and saved in **Settings -> Advanced -> Admin Access**. Without that, the server returns 403. See [Configuration -> Privileged APIs](CONFIGURATION.md#privileged-apis).

## Browser Extension Example

Copy the example package in [`docs/examples/extensions/minimal`](examples/extensions/minimal):

```text
minimal/
  manifest.json
  extension.css
  extension.js
```

The manifest uses file paths that are resolved relative to the folder containing `manifest.json`:

```json
{
  "kind": "marinara.extension",
  "version": 1,
  "config": {
    "name": "Example Accent Glow",
    "description": "Example extension package for Marinara Engine.",
    "enabled": true,
    "cssPath": "extension.css",
    "jsPath": "extension.js"
  }
}
```

## Single Extension Folder

A single extension folder should include a `manifest.json` file. Optional CSS and JavaScript can live in separate files:

```text
My Extension/
  manifest.json
  extension.css
  extension.js
```

Use `cssPath` and `jsPath` for anything non-trivial:

```json
{
  "kind": "marinara.extension",
  "version": 1,
  "config": {
    "name": "My Extension",
    "description": "Adds custom UI behavior and styling.",
    "enabled": true,
    "cssPath": "extension.css",
    "jsPath": "extension.js"
  }
}
```

Inline content is also accepted:

```json
{
  "kind": "marinara.extension",
  "version": 1,
  "config": {
    "name": "Inline Example",
    "description": "Small inline extension.",
    "enabled": true,
    "css": ".my-class { color: var(--primary); }",
    "js": "window.dispatchEvent(new CustomEvent('marinara-extension-ready'));"
  }
}
```

If both file paths and inline content are present, Marinara Engine uses the file contents.

## What Browser JavaScript Extensions Can Do

Extension JavaScript is wrapped and executed as a browser module. The wrapper passes a `marinara` helper object into your code:

```js
marinara.addStyle(`
  .my-extension-button {
    border-color: var(--primary);
  }
`);

const button = marinara.addElement(document.body, "button", {
  class: "my-extension-button",
  textContent: "Extension action",
});

if (button) {
  marinara.on(button, "click", () => {
    window.dispatchEvent(new CustomEvent("my-extension-action"));
  });
}
```

Available helpers:

| Helper | Description |
| --- | --- |
| `marinara.extensionId` | Installed extension ID. |
| `marinara.extensionName` | Installed extension name. |
| `marinara.addStyle(css)` | Sanitize, inject, and automatically remove CSS when the extension unloads. External URLs, imports, remote/local fonts, and script-like CSS are stripped. |
| `marinara.addElement(parent, tag, attrs)` | Append a DOM element and automatically remove it when the extension unloads. |
| `marinara.apiFetch(path, options)` | Fetch from `/api/...` for non-sensitive app routes. Extension-management and admin routes are denied. |
| `marinara.on(target, event, handler)` | Add an event listener with automatic cleanup. |
| `marinara.setInterval(fn, ms)` | Start an interval with automatic cleanup. |
| `marinara.setTimeout(fn, ms)` | Start a timeout with automatic cleanup. |
| `marinara.observe(target, callback, options)` | Create a `MutationObserver` with automatic cleanup. |
| `marinara.onCleanup(fn)` | Register custom cleanup logic for anything you create yourself. |

Plain browser APIs are also available. For shared packages, prefer the `marinara` helpers where possible so disabling or updating the extension cleans up its DOM, timers, listeners, and observers.

## Server Extension Example

Server extensions use `kind: "marinara.server-extension"` or `config.runtime: "server"` and point at server-side JavaScript:

```text
My Server Extension/
  manifest.json
  server-extension.js
```

```json
{
  "kind": "marinara.server-extension",
  "version": 1,
  "config": {
    "name": "Server Example",
    "description": "Runs trusted code in the Marinara server process.",
    "runtime": "server",
    "enabled": false,
    "serverJsPath": "server-extension.js"
  }
}
```

Server extension JavaScript is wrapped in an async function and receives a `marinara` helper:

```js
marinara.log.info("Server extension loaded");

const timer = marinara.setInterval(() => {
  marinara.log.debug("Still alive");
}, 60_000);

marinara.onCleanup(() => {
  marinara.clearInterval(timer);
});
```

Available server helpers:

| Helper | Description |
| --- | --- |
| `marinara.runtime` | Always `"server"`. |
| `marinara.version` | Server extension API version. |
| `marinara.extensionId` | Installed extension ID. |
| `marinara.extensionName` | Installed extension name. |
| `marinara.log.debug/info/warn/error(...)` | Write to the Marinara server logger. |
| `marinara.fetch(url, options)` | Fetch `http:` or `https:` URLs through Marinara's outbound safety checks and response-size cap. |
| `marinara.setInterval(fn, ms)` | Start an interval with automatic cleanup. |
| `marinara.setTimeout(fn, ms)` | Start a timeout with automatic cleanup. |
| `marinara.clearInterval(id)` | Clear an interval. |
| `marinara.clearTimeout(id)` | Clear a timeout. |
| `marinara.onCleanup(fn)` | Register cleanup logic to run when the extension reloads, disables, deletes, or the server shuts down. |

Server extensions do not receive Node's `require`, filesystem APIs, raw app internals, or dynamic route registration. Treat them as trusted startup scripts with logging, timers, cleanup, and safe outbound fetch.

## Multi-Extension Folder

For a package containing multiple extensions, add a root `marinara-extensions.json` file. The importer also accepts `marinara-extension.json`.

```text
My Extension Pack/
  marinara-extensions.json
  Extensions/
    Accent Glow/
      manifest.json
      extension.css
    Hotkeys/
      manifest.json
      extension.js
```

The root package file should list each extension entry with its manifest:

```json
{
  "kind": "marinara.extension-folder",
  "version": 1,
  "exportedAt": "2026-06-23T00:00:00.000Z",
  "folderName": "Extensions",
  "extensions": [
    {
      "path": "Extensions/Accent Glow/manifest.json",
      "manifest": {
        "kind": "marinara.extension",
        "version": 1,
        "config": {
          "name": "Accent Glow",
          "description": "Adds a small accent glow.",
          "enabled": true,
          "cssPath": "extension.css"
        }
      }
    },
    {
      "path": "Extensions/Hotkeys/manifest.json",
      "manifest": {
        "kind": "marinara.extension",
        "version": 1,
        "config": {
          "name": "Hotkeys",
          "description": "Adds custom browser-side hotkeys.",
          "enabled": true,
          "jsPath": "extension.js"
        }
      }
    }
  ]
}
```

If there is no root package file, folder import scans for every `manifest.json` it can find.

## Manifest Fields

| Field | Required | Description |
| --- | --- | --- |
| `kind` | Yes | Use `marinara.extension` for a browser extension or `marinara.server-extension` for a server extension. |
| `version` | Yes | Use `1`. |
| `config.name` | Yes | Display name, 1-200 characters. |
| `config.description` | No | Description, up to 2000 characters. |
| `config.runtime` | No | Use `client` for browser extensions or `server` for server extensions. Defaults to `client`. |
| `config.enabled` | No | Whether a browser extension is enabled after import. Missing values are imported as disabled for review. Server extensions are always imported disabled and must be enabled manually. |
| `config.cssPath` | No | Path or array of paths to CSS files, relative to the manifest folder. |
| `config.jsPath` | No | Path or array of paths to JS files, relative to the manifest folder. |
| `config.serverJsPath` | No | Path or array of paths to server JS files, relative to the manifest folder. |
| `config.css` | No | Inline CSS. Maximum 256 KiB after UTF-8 encoding. |
| `config.js` | No | Inline JavaScript. Maximum 1 MiB after UTF-8 encoding. |
| `config.serverJs` | No | Inline server JavaScript. Maximum 1 MiB after UTF-8 encoding. Required for server extensions unless `serverJsPath` is present. |

## Import Notes

- Folder import reads `.json`, `.js`, `.mjs`, `.cjs`, `.css`, `.md`, `.txt`, `.ts`, and `.tsx` text files.
- `cssPath` and `jsPath` can point to one file or an array of files. Multiple files are joined in listed order.
- Paths are resolved relative to the manifest first, then against the package root.
- A folder with only loose `.css` or `.js` files and no manifest can still import as one browser extension named after the folder, but manifests are recommended for shared packages and SillyTavern-style extension folders.
- A single `.server.js`, `.server.mjs`, or `.server.cjs` file imports as one disabled server extension.
- A loose folder with `.server.js`, `.server.mjs`, or `.server.cjs` files and no manifest imports as one disabled server extension.
- CSS is sanitized before injection. External `url()`, `@import`, `@namespace`, remote or `local()` web fonts, `expression()`, `javascript:`, `vbscript:`, `behavior`, and `-moz-binding` are stripped or rewritten; external URLs become `url(about:invalid)`, and `:visited` selectors are rewritten to `:link`. Embed images and fonts as safe `data:` URIs when needed.
- Browser JavaScript is loaded by the browser client when the extension is enabled. It can change client behavior at runtime, but it is not run by the server.
- Server JavaScript is loaded by the Marinara server when the extension is enabled. Startup status appears in Settings -> Extensions.
- TypeScript files can be included in imported folders as package text, but Marinara does not compile TypeScript for extension execution. Point `jsPath` at JavaScript that the browser can run.
