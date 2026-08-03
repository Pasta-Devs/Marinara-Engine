# Personal Extensions

Personal Extensions are private code drafts created for you by Professor Mari. Open **Settings** > **Addons** > **Personal Extensions**.

The default message is:

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

There is no New Draft action and there are no import controls in this section. Ask Professor Mari to create or revise a draft. She can save code, but she cannot approve or enable it.

## Review and enable

Every draft starts disabled. Marinara fingerprints the exact executable code with SHA-256. Open the draft, inspect the code, compare the displayed hash, then choose **Review and Run** only if you accept that exact version. Any executable edit or restored revision disables the extension and requires a fresh approval.

Sandboxing reduces authority; it does not make arbitrary code trustworthy. A malicious extension can still waste CPU until the watchdog stops it, flood its own storage within enforced limits, or behave deceptively through logs. Full page extensions deliberately give up that isolation. Always review code before enabling it.

## Runtime isolation

A Browser Extension runs in a dedicated Worker inside an opaque-origin sandboxed iframe. It cannot access Marinara's page, DOM, cookies, browser storage, origin APIs, or network. Its capabilities are private extension storage, logging, managed timers, cleanup registration, constrained windows, safe host contribution slots, and a read-only snapshot of the active chat and Character IDs. It can receive selected fields from the active Character cards or selected Persona only when the corresponding permissions are declared and approved.

Extensions can add top-bar actions, Extensions menu items, and persistent right-side panels with `marinara.ui.registerContribution(...)`. Marinara renders these surfaces using the active theme and a fixed set of controls: headings, text, preformatted output, buttons, text inputs, selects, toggles, sliders, color controls, and spacers. An extension supplies content and state, never HTML, CSS, URLs, React components, or host event handlers.

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

Use `kind: "button"` for a compact top-bar/Extensions-menu action and `kind: "menu-item"` for a menu-only action. Both invoke `onActivate`. A `panel` invokes `onActivate` when opened; its buttons invoke `onEvent` with the current values of every panel control. The returned handle supports `update({ label?, description?, icon?, elements? })` and `remove()`. IDs may contain letters, numbers, `.`, `_`, and `-`.

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

If an extension misbehaves, choose **Disable**. If the interface is unavailable, stop Marinara and set the relevant `installed_extensions` record's `enabled` value to `"false"`. Never set `approvedHash` by hand.

## Related guides

- [Professor Mari](../home/professor-mari.md)
- [Server Configuration](../CONFIGURATION.md)
- [Backup and Restore](../data/backup-and-restore.md)
- [Remote Access](../REMOTE_ACCESS.md)
