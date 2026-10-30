# Personal Extensions

Personal Extensions are private code drafts created for you by Professor Mari. Open **Settings** > **Addons** > **Personal Extensions**.

The default message is:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

There is no New Draft action and there are no import controls in this section. Ask Professor Mari to create or revise a draft. She can save code, but she cannot approve or enable it.

To write and import your own package, use the [Personal Extension authoring guide](writing-personal-extensions.md). Self-authored packages use the separately gated External Extensions flow.

## Estimate text tokens

Browser, Full page access, and Server Personal Extensions can use Marinara's built-in text token estimator:

```js
const tokens = marinara.estimateTextTokens(text);
```

The signature is `estimateTextTokens(text: string): number`, also described by the exported `PersonalExtensionTokenApi` type in `@marinara-engine/shared`. The call is synchronous, needs no extra capability, and returns Marinara's model-agnostic estimated token count rather than an exact tokenizer result. On older Engines, check `typeof marinara.estimateTextTokens === "function"` before calling it.

## Review and enable

Every draft starts disabled. Marinara fingerprints the exact executable code with SHA-256. Open the draft, inspect the code, compare the displayed hash, then choose **Review and Run** only if you accept that exact version. Any executable edit or restored revision disables the extension and requires a fresh approval.

Sandboxing reduces authority; it does not make arbitrary code trustworthy. A malicious extension can still waste CPU until the watchdog stops it, flood its own storage within enforced limits, or behave deceptively through logs. Full page extensions deliberately give up that isolation. Always review code before enabling it.

## Runtime isolation

A Browser Extension runs in a dedicated Worker inside an opaque-origin sandboxed iframe. It cannot access Marinara's page, DOM, cookies, browser storage, origin APIs, or network. Its capabilities are private extension storage, logging, managed timers, cleanup registration, constrained windows, safe host contribution slots, and a read-only snapshot of the active chat and Character IDs. It can receive selected fields from the active Character cards or selected Persona only when the corresponding permissions are declared and approved.

Extensions can add top-bar or side-panel actions, Extensions menu items, and persistent right-side panels with `marinara.ui.registerContribution(...)`. Marinara renders these surfaces using the active theme and a fixed set of controls: headings, text, preformatted output, buttons, text inputs, selects, toggles, sliders, color controls, and spacers. An extension supplies content and state, never HTML, CSS, URLs, React components, or host event handlers.

These UI capabilities and rules are identical for every sandboxed Browser Extension regardless of source. An imported third-party (External) Extension uses this safe runtime unless its package explicitly requests **Full page access** or uses the pre-sandbox `marinara.extension` format described below.

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

If an External Extension genuinely depends on host DOM access, it may request:

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

A Server Extension runs in a separate permission-restricted Node process inside macOS Seatbelt or Linux Bubblewrap. It cannot access Marinara files, user files, inherited server secrets, the network, child processes, workers, or native addons. If Marinara cannot establish a supported OS sandbox, Server Extensions remain disabled.

### Platform support

Browser Extensions are sandboxed by the browser itself, so they work everywhere. Server Extensions need a supported OS sandbox; where none exists, they stay disabled and cannot be enabled — Marinara never falls back to running them unsandboxed.

| Platform                | Sandboxed Browser Extensions | Full page External Extensions | Server Extensions                     |
| ----------------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| macOS                   | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ✅ Sandboxed (Seatbelt)               |
| Linux (with Bubblewrap) | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ✅ Sandboxed (Bubblewrap)             |
| Linux (without `bwrap`) | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ⛔ Disabled — install `bwrap`         |
| Docker (default)        | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ⛔ Disabled — container privileges    |
| Windows                 | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ⛔ Disabled — use a Browser Extension |
| Android                 | ✅ Sandboxed                 | ⚠️ Explicit trust required    | ⛔ Disabled — use a Browser Extension |

The official Docker image contains Bubblewrap, but its least-privileged default container cannot create the nested namespaces and mounts Bubblewrap needs. Marinara tests the sandbox at runtime and leaves Server Extensions disabled when the container denies them. See [Troubleshooting](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) for the explicit Docker permission override and its security tradeoff.

On Windows and Android there is no supported OS process sandbox, so Server Extensions are unavailable by design. Use a Browser Extension instead, or run the Marinara server on macOS or Linux (with `bwrap`) if you need a Server Extension.

## External Extensions

Third-party imports are locked and hidden by default. Two steps are required:

1. On the Marinara host, set `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`.
2. Open **Settings** > **Advanced** > **Danger Zone**, scroll below the data-deletion controls, read the warning, and enable **Allow third-party extension imports**.

Only then does **Settings** > **Addons** show **External Extensions** with file and folder import controls. Supported formats are always expanded:

- `.personal-extension.zip` and compatible `.zip` packages;
- `.json` manifests;
- `.css`;
- `.js`, `.mjs`, and `.cjs`;
- `.server.js`, `.server.mjs`, and `.server.cjs`.

Imports never carry approval and cannot enable themselves. Legacy, profile-imported, manually stored, and unknown-source records are also treated as external. They stay hidden, cannot be approved, and are excluded from both runtimes until both gates are open.

Review the **Requested access** list before approving an exact hash. Most Browser Extensions should remain in the safe sandbox. A package marked **Full page access** is deliberately not isolated and should be enabled only when you have inspected and trust that exact version.

Turning either gate off stops active external server processes, removes browser workers and full page runtime nodes, and disables stored external records. Reopening the gates does not automatically run them again. Reload the page if a full page extension left behind changes it did not register for cleanup.

Third-party extensions may contain malicious or dangerous code. Always inspect every line before downloading, importing, or enabling it. You proceed entirely at your own responsibility.

## Export, revisions, and recovery

Use an extension's export action to download a portable package. Exported and restored packages remain disabled. Restoring a revision also returns it to a disabled draft.

**Settings → Addons → Extension revision history** controls how many previous code versions are kept for every Personal and External Extension. The default is **10**; choose **0–10**, with **0** disabling history. Reducing the limit asks for confirmation before permanently removing older revisions. Current extension code, approvals, enabled state, and saved extension data are preserved. Future edits and rollbacks follow the same limit, including edits made through Professor Mari.

If an extension misbehaves, choose **Disable**. If the interface is unavailable, stop Marinara and set the relevant `installed_extensions` record's `enabled` value to `"false"`. Never set `approvedHash` by hand.

## Related guides

- [Writing Personal Extensions](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Server Configuration](../CONFIGURATION.md)
- [Backup and Restore](../data/backup-and-restore.md)
- [Remote Access](../REMOTE_ACCESS.md)
