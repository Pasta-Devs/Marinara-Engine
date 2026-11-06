# Writing Personal Extensions

This guide shows how to write a Browser Extension or Server Extension, package it and import it. It is for people who can write JavaScript. To review and run an extension, see [Personal Extensions](personal-extensions.md).

Code you write and import yourself is treated as an **External Extension**. It starts disabled and cannot run until you inspect it and approve its exact SHA-256 hash.

## Before you start

External Extensions are hidden until you open both safety steps in [Allow third-party imports](personal-extensions.md#allow-third-party-imports): `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`, and **Allow third-party extension imports** under **Settings → Advanced → Danger Zone**.

Importing and managing extensions also needs localhost access or the admin secret. From a phone, LAN address or remote browser, set `ADMIN_SECRET` on the server and enter the same value under **Settings → Advanced → Admin Access**.

Choose the least powerful runtime that can do the job:

| Runtime                      | Use it for                                                                              | Important boundary                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Sandboxed Browser Extension  | Private state, active-chat context, buttons, menu actions, and Marinara-rendered panels | No Marinara DOM, cookies, browser storage, network, or arbitrary HTML                        |
| Server Extension             | Background logic that needs managed timers and private extension storage                | Separate OS sandbox; no Marinara files, secrets, network, child processes, or native modules |
| Full-page External Extension | Legacy code that needs Marinara's page or same-origin APIs                    | Not sandboxed; use only for exact code you fully trust                                       |

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

1. Open **Settings → Addons → External Extensions**.
2. Choose **Import Extension Folder** and select `Hello Panel`, or zip the folder and import the ZIP with **Import Extension File**.
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
| `dice.registerFormat(options)`                               | Teach `/roll` a notation; Marinara throws the dice it names          |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | Managed timers removed when the extension stops                      |
| `onCleanup(callback)`                                        | Register additional cleanup logic                                    |

Use [Marinara-rendered panels](#add-a-marinara-rendered-panel) for normal UI, [active chat context](#use-active-chat-context) for chat-aware behavior, and [dice formats](#add-a-dice-format) for custom `/roll` notation. Extension state belongs in `marinara.storage`, not browser storage.

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

### What a Browser Extension can do

A Browser Extension runs in a dedicated Worker inside an opaque-origin sandboxed iframe. It cannot access Marinara's page, DOM, cookies, browser storage, origin APIs, or network. Its capabilities are private extension storage, logging, managed timers, cleanup registration, constrained windows, safe host contribution slots, and a read-only snapshot of the active chat and Character IDs. It can receive selected fields from the active Character cards or selected Persona only when the corresponding permissions are declared and approved.

Extensions can add top-bar or side-panel actions, Extensions menu items, and persistent right-side panels with `marinara.ui.registerContribution(...)`. Marinara renders these surfaces using the active theme and a fixed set of controls: headings, text, preformatted output, buttons, text inputs, selects, toggles, sliders, color controls, and spacers. An extension supplies content and state, never HTML, CSS, URLs, React components, or host event handlers.

These UI capabilities and rules are identical for every sandboxed Browser Extension regardless of source. An imported third-party (External) Extension uses this safe runtime unless its package explicitly requests **Full page access** or uses the pre-sandbox `marinara.extension` format described below.

### Estimate text tokens

Browser, Full page access, and Server Personal Extensions can use Marinara's built-in text token estimator:

```js
const tokens = marinara.estimateTextTokens(text);
```

The signature is `estimateTextTokens(text: string): number`, also described by the exported `PersonalExtensionTokenApi` type in `@marinara-engine/shared`. The call is synchronous, needs no extra capability, and returns Marinara's model-agnostic estimated token count rather than an exact tokenizer result. On older Engines, check `typeof marinara.estimateTextTokens === "function"` before calling it.

### Add a Marinara-rendered panel

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

Use `kind: "button"` for a compact action and `kind: "menu-item"` for an Extensions-menu action. Use `kind: "command"` for a Command Center entry that activates an existing contribution from the same extension revision. A command requires `targetContributionId` and cannot use `onActivate` or `onEvent`.

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

The host resolves a command only when the target has the same extension ID and content hash. Missing, cross-extension, and stale-revision targets fail closed. Buttons default to `surface: "top-bar"`. They can instead target `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, or `settings`, with `position` set to `header`, `before-content`, or `after-content`. The `icon` accepts any kebab-case Lucide icon name supported by Marinara. Both action kinds invoke `onActivate`. A `panel` invokes `onActivate` when opened; its buttons invoke `onEvent` with the current values of every panel control. The returned handle supports kind-specific updates: `button` accepts `label`, `description`, `icon`, `surface`, and `position`; `menu-item` accepts `label`, `description`, and `icon`; `panel` accepts `label`, `description`, `icon`, and `elements`. All handles support `remove()`. IDs may contain letters, numbers, `.`, `_`, and `-`.

For example, this places a native action above the Presets panel content:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

Complex tools can build multi-step interfaces by updating the panel elements after an event. Keep application state in `marinara.storage`; do not encode it in markup.

### Use active chat context

Browser Extension API version 5 exposes opaque identifiers for the chat currently displayed in Marinara:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` returns the same current snapshot without subscribing. `chatId` is `null` and `characterIds` is empty when no chat is active. `characterId` is populated only when exactly one Character participates; group chats expose every participant through `characterIds` and leave `characterId` as `null`. `personaId` is populated only when `read_active_persona` is approved.

Chat and Character IDs are always available and let an extension namespace its own private storage. Record fields require one or both optional permissions in the extension manifest:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` populates `characters` for cards participating in the active chat.
- `read_active_persona` populates `persona` for the Persona selected by the active chat.

Without a permission, its value remains `[]` or `null`. Marinara shows every requested permission in **Requested access** and again in the exact-hash approval dialog. Adding or removing a permission changes the executable hash, disables the extension, and requires fresh approval.

Character snapshots contain only `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe`, and `conversationDisplayName`. Persona snapshots contain only `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe`, and `conversationDisplayName`. Text is bounded before it crosses the sandbox bridge.

Marinara never sends messages, creator notes, system prompts, post-history instructions, comments, avatar paths, full Character or Persona libraries, undeclared fields, chat metadata, database handles, network access, or mutation operations. Context updates remain bound to the approved code hash and are delivered when the active chat, its Character list, or its selected Persona changes.

### Add a dice format

Browser Extension API version 6 lets an extension teach `/roll` a notation of its own, such as a narrative dice pool. The extension reads the notation and names the dice to throw; Marinara throws them with its own secure roller and hands the faces back. An extension can say what a roll means, never what it rolled.

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

`/roll 2 boost 1 setback` then posts the faces, the total and the extension's text, labelled with the format's name. Plain notation such as `2d6` or `4d6kh3` always rolls as before and never reaches an extension. Other notation goes to each registered format in turn, and the first whose `parse` returns dice rolls it.

- `parse(notation)` returns `null` or `{ dice: [sides, ...] }` with 1-100 dice of 2-1000 sides. Anything else on the object stays in the sandbox and is passed back to `read` as `plan`.
- `read(...)` returns `{ total, text?, kept? }`: a finite number, at most 200 characters of plain text, and optionally the places of the dice that counted, in ascending order. `/roll` strikes the rest through.
- Each extension can register 4 formats. Notation is at most 100 characters. `parse` and `read` may be async, but each must answer within 2 seconds.
- The text is shown as plain text: links, images, formatting and HTML are escaped.

Dice formats cover `/roll` in the browser. The Game Master's `roll_dice` tool and other server-side rolls keep the built-in notation and ruleset dice. Check `typeof marinara.dice?.registerFormat === "function"` before calling it on older Engines.

### Legacy and full page extensions

Weather controllers, prompt editors, and other substantial workflows are valid contribution use cases. Their safe ports can use a menu or top-bar launcher plus progressively updated panels. Existing packages that inject DOM overlays, query Marinara CSS selectors, traverse React internals, or call same-origin `/api` routes cannot be imported unchanged into the safe runtime.

UI contributions provide the interface, not ambient authority. The context API always exposes active chat and Character IDs and may expose only the declared, active-record fields listed above. Features that need messages, presets, lorebooks, undeclared Character or Persona data, or visual scene effects still need a separate, narrowly scoped broker capability exposed by Marinara. An extension must not simulate one through host DOM access or unrestricted network requests.

If an External Extension depends on host DOM access, it may request:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access is not a sandbox capability.** The approved JavaScript and CSS run inside Marinara's page. The code can read or change anything visible to the current browser session, inspect chats and cards, use browser storage, make network requests, and call same-origin Marinara APIs. It has the same practical page authority as code pasted into the browser console. Professor Mari drafts cannot request it.

Full page extensions should use `marinara.fetch(...)` for network requests. It has the same signature and result as `window.fetch`, while allowing **Settings > Addons > External Extensions** to show that extension's session request count, transferred bytes reported by responses, recent request rate, and sustained high-traffic warning. Raw `window.fetch` remains available because full page access is trusted page code, but those requests cannot be attributed to the extension.

Marinara recognizes the older `kind: "marinara.extension"` v1 envelope without an explicit `capabilities` field as a pre-sandbox package and assigns **Full page access** during import. This allows legacy packages such as WeatherTweaker to reach the correct review flow instead of silently failing in a Worker. A modern package that uses that envelope but wants the safe runtime must include `"capabilities": []`.

The two External Extension gates and exact-hash approval still apply. A code, CSS, or permission change disables the extension and requires fresh approval. Disabling removes Marinara's script and stylesheet nodes, cancels timers created through the compatibility API, and runs callbacks registered through `marinara.onCleanup(...)`. Because page code can create unregistered listeners, timers, globals, or DOM changes, cleanup is best effort; reload the page after disabling an extension if anything remains.

The older `marinara.ui.showWindow(...)` API remains available for a temporary window inside the opaque-origin iframe. It uses the same fixed controls and returns `update(...)` and `close()` handles. Prefer contributions when the tool should be reachable through Marinara's normal navigation.

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
| Server Extension throws                                                 | Check its status in **Settings → Addons** and the Marinara server log                          |

CSS, private storage, import archives, and runtime messages retain separate safety limits. Marinara should report the boundary that rejected a package instead of presenting it as an execution failure.

## Related guides

- [Personal Extensions](personal-extensions.md)
- [Server Configuration](../CONFIGURATION.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [Personal Extension Architecture](../development/personal-extensions.md)
