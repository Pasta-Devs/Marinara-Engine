# Writing Personal Extensions

This guide is for people writing their own Marinara Engine extensions. For installing, reviewing, and safely running an extension, start with [Personal Extensions](personal-extensions.md).

Code you write and import yourself is treated as an **External Extension**. It starts disabled and cannot run until you inspect it and approve its exact SHA-256 hash.

## Before you start

External Extensions are hidden until both safety gates are open:

1. Set `ENABLE_EXTERNAL_EXTENSIONS=true` in the Marinara host's `.env` file.
2. Open **Settings** > **Advanced** > **Danger Zone** and enable **Allow third-party extension imports**.

Importing and managing extensions also requires localhost access or configured **Admin Access**. If you use Marinara from a phone, LAN address, or remote browser, set `ADMIN_SECRET` on the server and enter the same value under **Settings** > **Advanced** > **Admin Access**.

Choose the least-powerful runtime that can do the job:

| Runtime                      | Use it for                                                                              | Important boundary                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sandboxed Browser Extension  | Private state, active-chat context, buttons, menu actions, and Marinara-rendered panels | No Marinara DOM, cookies, browser storage, network, or arbitrary HTML                        |
| Server Extension             | Background logic that needs managed timers and private extension storage                | Separate OS sandbox; no Marinara files, secrets, network, child processes, or native modules |
| Full-page External Extension | Legacy code that genuinely needs Marinara's page or same-origin APIs                    | Not sandboxed; use only for exact code you fully trust                                       |

Browser Extensions work on every supported platform. Server Extensions require macOS Seatbelt or Linux Bubblewrap. See the [platform table](personal-extensions.md#platform-support) before choosing a Server Extension.

## Browser Extension quickstart

Create a folder with this layout:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

Use this `manifest.json`:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

Use this `extension.js`:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

Use this `extension.css` to style the constrained iframe window opened by the button:

```css
[data-ext-root] {
  font-size: 16px;
}
```

Then import and run it:

1. Open **Settings** > **Addons** > **External Extensions**.
2. Choose **Import Folder** and select `Hello Panel`, or zip the folder and import the ZIP.
3. Open the disabled draft and inspect its manifest and JavaScript.
4. Choose **Review and Run** and approve the exact displayed hash.
5. Open the Extensions menu and select **Hello Panel**.

The same runnable example lives at `docs/examples/personal-extensions/browser-minimal/` in the repository.

## Browser API reference

Sandboxed Browser Extensions receive one frozen global named `marinara`:

| API                                                          | Purpose                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `runtime`, `version`                                         | Runtime name (`client`) and current Browser API version              |
| `extensionId`, `extensionName`, `capabilities`               | Identity and approved capabilities for this exact extension revision |
| `log.debug/info/warn/error(...)`                             | Write a tagged entry to the browser console                          |
| `storage.get()`                                              | Read this extension's private JSON object                            |
| `storage.patch(object)`                                      | Merge values into private storage and return the new object          |
| `storage.delete()`                                           | Clear private storage                                                |
| `context.get()`                                              | Read the current active-chat snapshot                                |
| `context.subscribe(listener)`                                | Receive context changes; returns an unsubscribe function             |
| `ui.registerContribution(options)`                           | Add a safe button, Extensions-menu item, or Marinara-rendered panel  |
| `ui.showWindow(options)`                                     | Open a constrained iframe window                                     |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Managed timers removed when the extension stops                      |
| `onCleanup(callback)`                                        | Register additional cleanup logic                                    |

Use [Marinara-rendered panels](personal-extensions.md#add-a-marinara-rendered-panel) for normal UI and [active chat context](personal-extensions.md#use-active-chat-context) for chat-aware behavior. Extension state belongs in `marinara.storage`, not browser storage.

`showWindow({ title, elements, onEvent, onClose })` returns a handle with `update({ title?, elements? })` and `close()`. Package CSS styles these sandboxed iframe windows; host-rendered contributions always use Marinara's own theme and controls.

The safe Browser runtime has no DOM or network API. Do not work around that boundary. If a useful capability is missing, request a narrow host capability rather than switching to full-page access by default.

### Context capabilities

Declare optional record access in `config.capabilities`:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` populates bounded fields for Character cards in the active chat.
- `read_active_persona` populates bounded fields for the selected Persona.
- `full_page_access` selects the unsandboxed compatibility runtime and is available only to External Extensions.

Changing capabilities changes the executable hash, disables the extension, and requires a new review.

## Server Extension quickstart

Create this folder:

```text
Server Counter/
  manifest.json
  server-extension.js
```

Use this `manifest.json`:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

Use this `server-extension.js`:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

The same runnable package is available at `docs/examples/personal-extensions/server-minimal/`.

Server code receives `marinara.runtime`, `marinara.version`, extension identity, `log`, `storage`, managed timers, and `onCleanup`. It does not receive filesystem, process, network, module-loading, or Marinara database access.

Server Extensions remain disabled when the host cannot establish Seatbelt or Bubblewrap. This is a platform restriction, not an extension error.

## Package and manifest reference

| Field                                        | Notes                                                                                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `kind`                                       | `marinara.personal-extension` or `marinara.personal-server-extension`                          |
| top-level `version`                          | Package envelope version; currently `1`                                                        |
| `config.name`                                | Required display name, 1-200 characters                                                        |
| `config.version`                             | Optional extension version such as `1.2.0`; numeric dotted versions support downgrade warnings |
| `config.description`                         | Optional description, up to 2,000 characters                                                   |
| `config.runtime`                             | `client` or `server`; defaults to `client`                                                     |
| `config.capabilities`                        | Requested Browser capabilities; Server Extensions must use an empty list                       |
| `config.jsPath` / `config.serverJsPath`      | JavaScript file path or ordered array of paths, relative to the manifest                       |
| `config.cssPath`                             | Optional CSS file path or ordered array; safe-runtime CSS stays in the sandboxed iframe        |
| `config.js`, `config.serverJs`, `config.css` | Inline alternatives when separate files are unnecessary                                        |

Use plain JavaScript. Marinara does not compile TypeScript or install extension dependencies. Bundle dependencies into your JavaScript before importing when necessary.

Loose `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs`, and `.css` files can also be imported directly. A manifest is preferred because it records identity, runtime, version, capabilities, and file order explicitly.

### Validation limits

| Content                      | Current boundary                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Name / version / description | 200 characters / 64 characters / 2,000 characters                                       |
| Browser or Server JS         | No per-field source cap; the enclosing file, archive, or request boundary still applies |
| CSS                          | 256 KiB                                                                                 |
| Imported ZIP                 | 32 MiB compressed, 2 MiB per text entry, and 16 MiB total extracted text                |
| Private storage              | 1,000,000 bytes of serialized JSON per extension                                        |

The ZIP, request, sandbox-message, and storage limits protect separate transport or runtime boundaries; they are not executable-source policy.

## Update and recovery lifecycle

- Every new import starts disabled and unapproved.
- Editing code, CSS, runtime, or capabilities clears approval and disables the extension.
- Re-importing the same name updates the existing record after confirmation. A byte-identical re-import keeps its current hash and approval; changed executable content clears approval. Marinara warns when numeric versions indicate a downgrade.
- **Export** writes the current manifest and source files to a portable package. Approval is never exported.
- Restoring a revision, importing a profile, or restoring a backup leaves the extension disabled until reviewed again.
- **Disable** stops the runtime and registered cleanup. Full-page code may require a page reload if it created unregistered side effects.
- **Delete** removes the installed record. Export first if you may need the source later.

## Debugging

| Symptom                                                                 | Check                                                                                              |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| External import controls are missing                                    | Open both External Extension gates described above                                                 |
| Management says localhost or Admin Access is required                   | Configure `ADMIN_SECRET` and save it under **Admin Access**                                        |
| Import finds no extension                                               | Check `manifest.json` and its relative paths; Server needs JS, while Browser needs CSS or JS       |
| The extension disables after an edit                                    | Expected: inspect and approve the new exact hash                                                   |
| Browser code cannot use `document`, `window`, `fetch`, or local storage | Expected in the safe sandbox; use the documented broker APIs                                       |
| Server Extension is unavailable                                         | Use macOS Seatbelt or Linux with Bubblewrap, or switch to a Browser Extension                      |
| Browser Extension throws                                                | Open browser developer tools; `marinara.log` and startup errors are tagged with the extension name |
| Server Extension throws                                                 | Check its status in **Settings** > **Addons** and the Marinara server log                          |

CSS, private storage, import archives, and runtime messages retain separate safety limits. Marinara should report the boundary that rejected a package instead of presenting it as an execution failure.

## Related guides

- [Personal Extensions](personal-extensions.md)
- [Server Configuration](../CONFIGURATION.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [Personal Extension Architecture](../development/personal-extensions.md)
