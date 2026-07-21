# Writing Extensions (Developers)

This is developer material for people who want to author their own Marinara Engine extensions. It covers the extension manifest format and the browser marinara API. It also covers the CSS sanitization rules, the server extension marinara API and its sandbox, and the bundled example package. If you only want to install an extension someone else made, read the user guide instead: [Extensions](../extending/extensions.md).

## Before you start

An extension is a small add-on that changes how Marinara Engine looks or behaves. You author it as a small set of files, then import it from **Settings**, then **Addons**, then the **Extension Library** section. For the import, enable, export, and delete steps, see [Extensions](../extending/extensions.md).

Installing or updating an extension is a privileged action. It works from localhost with no extra setup. Any other browser (a phone, a LAN address, a remote tunnel) needs two more steps. Set `ADMIN_SECRET` on the server, then save the same value under **Settings**, then **Advanced**, then **Admin Access**. See [Server Configuration Reference](../CONFIGURATION.md) for how to set `ADMIN_SECRET`.

## Two kinds of extension

There are two runtimes, and you choose one per extension.

1. A browser extension (also called a client extension) injects CSS and JavaScript into the Marinara page in your browser. It can style the UI, add controls, watch the DOM, register timers, and call a limited set of app routes.
2. A server extension runs trusted JavaScript inside the Marinara Node.js server process. It has no DOM. It can log, run timers, and make safe outbound web requests.

Neither kind edits Marinara source code on disk. A browser extension has the same browser privileges as the app UI. A server extension runs with the same privileges as the server process, so only run server code you trust.

## The extension manifest

Every extension is described by a JSON file named `manifest.json`. A simple browser extension folder looks like this:

```text
My Extension/
  manifest.json
  extension.css
  extension.js
```

A minimal browser manifest that points at those two files:

```json
{
  "kind": "marinara.extension",
  "version": 1,
  "config": {
    "name": "My Extension",
    "version": "1.0.0",
    "description": "Adds custom UI behavior and styling.",
    "enabled": true,
    "cssPath": "extension.css",
    "jsPath": "extension.js"
  }
}
```

Marinara resolves `cssPath` and `jsPath` relative to the folder that holds `manifest.json` first. If nothing matches there, it tries the package root. Each one can be a single path or an array of paths. When you list several files, Marinara joins them in order.

You can also put the code inline instead of in separate files:

```json
{
  "kind": "marinara.extension",
  "version": 1,
  "config": {
    "name": "Inline Example",
    "version": "1.0.0",
    "description": "Small inline extension.",
    "enabled": true,
    "css": ".my-class { color: var(--primary); }",
    "js": "window.dispatchEvent(new CustomEvent('marinara-extension-ready'));"
  }
}
```

A manifest can supply both a file path and inline content for the same slot (for example both `cssPath` and `css`). In that case, the file content wins. Marinara uses the inline value only when the path resolves to nothing.

### Manifest fields

| Field | Required | Notes |
| --- | --- | --- |
| `kind` | Recommended | Use `marinara.extension` for a browser extension or `marinara.server-extension` for a server extension. The importer does not require this field. When both `kind` and `config.runtime` are missing, Marinara imports the extension as a browser extension. |
| `version` | Recommended | Use `1`. The importer does not read or validate this field. Marinara writes it when it exports an extension, so include it to match the standard format. |
| `config.name` | Yes | Display name. 1 to 200 characters. |
| `config.version` | No | Extension release version, such as `1.2.0`. Marinara uses numeric dotted versions to warn before replacing a newer installed release with an older one. |
| `config.description` | No | Up to 2000 characters. Defaults to an empty string. |
| `config.runtime` | No | Use `client` for a browser extension or `server` for a server extension. Defaults to `client`. If `runtime` is `server`, the extension is treated as a server extension even when `kind` says otherwise. |
| `config.enabled` | No | For a browser extension, whether it runs right after import. If you omit it, Marinara imports the extension disabled so you can review it first. A server extension is always imported disabled no matter what you set here. |
| `config.cssPath` | No | Path or array of paths to CSS files, relative to the manifest folder. |
| `config.jsPath` | No | Path or array of paths to browser JS files, relative to the manifest folder. |
| `config.serverJsPath` | No | Path or array of paths to server JS files, relative to the manifest folder. |
| `config.css` | No | Inline CSS. Up to 256 KiB, measured as UTF-8 bytes. |
| `config.js` | No | Inline browser JavaScript. Up to 1 MiB, measured as UTF-8 bytes. |
| `config.serverJs` | No | Inline server JavaScript. Up to 1 MiB. Required for a server extension unless `serverJsPath` supplies the code. |

Point `jsPath` and `serverJsPath` at plain JavaScript. Marinara does not compile TypeScript for extension code. A `.ts` file will not run, even though folder import can read it as package text.

### Packaging several extensions

To ship more than one extension in a single folder, add a root file named `marinara-extensions.json` (the importer also accepts `marinara-extension.json`). Its `extensions` array lists one entry per extension, each with a `path` to that extension's `manifest.json` and the manifest itself:

```json
{
  "kind": "marinara.extension-folder",
  "version": 1,
  "folderName": "Extensions",
  "extensions": [
    {
      "path": "Extensions/Accent Glow/manifest.json",
      "manifest": {
        "kind": "marinara.extension",
        "version": 1,
        "config": {
          "name": "Accent Glow",
          "version": "1.0.0",
          "description": "Adds a small accent glow.",
          "enabled": true,
          "cssPath": "extension.css"
        }
      }
    }
  ]
}
```

If there is no root package file, folder import scans for every `manifest.json` it can find and imports each one as its own extension.

## Writing a browser extension

Your browser JavaScript runs as a real page module. Marinara passes a frozen helper object named `marinara` into your code. Here is a small example that adds a styled button and cleans up after itself:

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

### The browser marinara API

The `marinara` helpers below all clean up automatically when the extension is disabled, updated, or deleted. Prefer them over plain browser calls so nothing is left behind.

| Helper | What it does |
| --- | --- |
| `marinara.extensionId` | The installed extension's ID. |
| `marinara.extensionName` | The installed extension's name. |
| `marinara.addStyle(css)` | Injects a style tag with sanitized CSS, then removes it on unload. |
| `marinara.addElement(parent, tag, attrs)` | Appends a DOM element under `parent` (an element or a CSS selector string), then removes it on unload. In `attrs`, the keys `innerHTML` and `textContent` set content; every other key becomes an attribute. |
| `marinara.apiFetch(path, options)` | Fetches `/api/<path>`. Any path under `/extensions` or `/admin` is denied, so an extension cannot reinstall itself or reach admin routes. |
| `marinara.on(target, event, handler)` | Adds an event listener with automatic removal. Handler errors are caught and logged, not thrown. |
| `marinara.setInterval(fn, ms)` | Starts an interval that clears itself on unload. |
| `marinara.setTimeout(fn, ms)` | Starts a timeout that clears itself on unload. |
| `marinara.observe(target, callback, options)` | Creates a MutationObserver (default options watch child list and subtree) that disconnects on unload. |
| `marinara.onCleanup(fn)` | Registers your own cleanup callback. If the extension already unloaded, `fn` runs right away. |

Plain browser globals like `document`, `window`, and `fetch` are also reachable. The code runs as a real page module, not in a sandbox. Marinara catches any error while your module loads or runs. It writes the error to the browser devtools console, tagged with the extension name. It does not crash the app.

## CSS sanitization rules

All extension CSS is cleaned before it reaches the page. This applies to the manifest `css` field and to anything you pass to `marinara.addStyle`. The same sanitizer protects custom themes and character card CSS. It blocks network requests and script tricks, so some CSS you write will silently do nothing.

What the sanitizer changes:

- Any `url()` that is not an allowed `data:` URI is rewritten to `url(about:invalid)`. Allowed prefixes are `data:image/`, `data:font/`, `data:application/font`, and `data:application/x-font`.
- `@import` and `@namespace` rules are removed.
- An `@font-face` block is kept only when every source is a font `data:` URI. A `local()` source makes the whole block drop.
- `expression(...)`, `javascript:`, `vbscript:`, `behavior:`, and `-moz-binding:` are stripped.
- `:visited` is rewritten to `:link`.

The practical effect: you cannot load a remote font, a remote background image, or an external stylesheet. If your extension needs a font or an image, embed it as a `data:` URI inside the CSS. A remote link will not error, it will just have no effect.

## Writing a server extension

A server extension runs JavaScript in the Node.js server process. Mark it with `kind: "marinara.server-extension"` or with `config.runtime: "server"`, and point at the server code:

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

A server extension is always imported disabled. You enable it by hand from the **Extension Library**. The app asks you to confirm, because the code runs with server privileges. The server rejects a server extension that has no code in either `serverJs` or `serverJsPath`.

Your server code is wrapped in an async function and receives its own `marinara` helper:

```js
marinara.log.info("Server extension loaded");

const timer = marinara.setInterval(() => {
  marinara.log.debug("Still alive");
}, 60_000);

marinara.onCleanup(() => {
  marinara.clearInterval(timer);
});
```

### The sandbox

Server code runs inside a Node `vm` sandbox. It does not get `require`, filesystem access, or the app's internal modules. The sandbox exposes only the `marinara` helper, a `console` shim that writes to the server log, the timer functions, and a few standard globals: `URL`, `URLSearchParams`, `TextDecoder`, `TextEncoder`, `AbortController`, and `AbortSignal`.

There are time limits, and none of them are configurable:

- The first synchronous run of your code has 1 second.
- Startup as a whole (including any promise you return) has 5 seconds.
- Each cleanup callback gets up to 5 seconds when the extension unloads.

A server extension reloads (it stops, then starts again) whenever you create, update, delete, enable, or disable it, and on server startup.

### The server marinara API

| Helper | What it does |
| --- | --- |
| `marinara.runtime` | Always `"server"`. |
| `marinara.version` | The server extension API version. Currently `1`. |
| `marinara.extensionId` | The installed extension's ID. |
| `marinara.extensionName` | The installed extension's name. |
| `marinara.log.debug/info/warn/error(...)` | Writes to the Marinara server log, tagged with the extension name and ID. |
| `marinara.fetch(url, options)` | Fetches an `http:` or `https:` URL through Marinara's outbound safety checks. The response is capped at 25 MiB. |
| `marinara.setInterval(fn, ms)` | Starts an interval that clears itself on unload. |
| `marinara.setTimeout(fn, ms)` | Starts a timeout that clears itself on unload. |
| `marinara.clearInterval(id)` | Clears an interval. |
| `marinara.clearTimeout(id)` | Clears a timeout. |
| `marinara.onCleanup(fn)` | Registers cleanup logic to run when the extension reloads, disables, deletes, or the server shuts down. |

### Reading the status

While an enabled server extension is loaded, its row in the **Extension Library** shows a status badge. **Running** means it loaded and started. **Error** shows the caught error message under the row. For example, a server extension with no code shows **Error** with the message "No server JavaScript payload". **Stopped** means it is not currently running.

## The bundled example

Marinara ships a minimal browser extension you can import to see the format in action. It lives in the install and repository at `docs/examples/extensions/minimal/`, and it is not visible inside the app. The docs browser does not serve the `examples/` folder, so there is no in-app link. Open the folder from the file system to find these three files.

The `manifest.json`:

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

The `extension.css` adds a subtle accent ring to selected shared controls:

```css
.mari-chrome-control--selected {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent);
}
```

The `extension.js` dispatches one event on load:

```js
(() => {
  window.dispatchEvent(
    new CustomEvent("marinara-extension-ready", {
      detail: { name: "Example Accent Glow" },
    }),
  );
})();
```

The shipped example does not call the `marinara` helpers. Use the browser marinara API section above for those.

## Related guides

- [Extensions](../extending/extensions.md): install, enable, export, and delete extensions.
- [Server Configuration Reference](../CONFIGURATION.md): set `ADMIN_SECRET` for installs from a non-local browser.
