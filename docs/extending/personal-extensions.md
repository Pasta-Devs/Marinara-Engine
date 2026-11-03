# Personal Extensions

A Personal Extension is a small piece of code that adds a button, panel or helper to Marinara. Professor Mari can write one for you, and you decide whether it ever runs. This guide covers reviewing, enabling, exporting and recovering extensions. To write your own, see [Writing Personal Extensions](writing-personal-extensions.md).

## Which kind is which

| Name | What it is |
| --- | --- |
| Personal Extension | An extension Professor Mari wrote for you. It appears as a draft under **Settings → Addons**. |
| External Extension | An extension from someone else, or one you wrote. It needs the extra steps in [Allow third-party imports](#allow-third-party-imports). |
| Browser Extension | Runs inside your browser in a sandbox. Safe by default. |
| Server Extension | Runs on the computer that runs Marinara, in an operating-system sandbox. Needs a supported platform. |
| Full page access | A permission that removes the sandbox. Only for code you fully trust. |

## Install an extension someone shared

Before you start, do the two steps in [Allow third-party imports](#allow-third-party-imports). Without them the import buttons are hidden.

1. Open **Settings → Addons**. Under **External Extensions**, choose **Import Extension File** for a `.zip`, `.json`, `.css` or `.js` file, or **Import Extension Folder** for a folder.
2. Open the new draft. It is disabled and shows its code and a hash, a short fingerprint of that exact code (Marinara uses SHA-256).
3. Read the code and the **Requested access** list.
4. Choose **Review and Run** only if you accept that exact version. The extension then shows as enabled.

If it did not work: if the import buttons are missing, one of the two steps is not done. Remember to restart Marinara after you change `.env`.

## Review an extension from Professor Mari

Before you start, ask [Professor Mari](../home/professor-mari.md) to create an extension. She can save the code, but she cannot approve or enable it. This section has no New Draft button and no import control.

1. Open **Settings → Addons → Personal Extensions**. With no drafts it reads: "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."
2. Open the draft and read the code. Check the hash and the **Requested access** list.
3. Choose **Review and Run** only if you accept that exact version.

Every draft starts disabled. Any code edit, permission change or restored revision disables the extension and needs a fresh approval.

> **Warning:** A sandbox limits what code can do, but it does not make code trustworthy. A harmful extension can still waste processor time until a watchdog (a timer that stops runaway code) ends it, fill its own storage up to the limit, or mislead you through logs. Full page extensions give up the sandbox on purpose. Read the code before you enable it, and inspect every line of third-party code.

If it did not work: Professor Mari's edits and any restored revision return the draft to disabled. Review it again and check that the hash in the dialog is the one you read.

## What an extension can do

A Browser Extension runs in a sandbox (a walled-off area) inside your browser. It cannot reach Marinara's page, cookies, browser storage or the network. It can:

- keep private storage and write logs
- add buttons, menu items and panels that Marinara draws in your theme
- read the IDs of the open chat
- read selected fields of the active characters or persona, only when you approve those permissions

The full list is in [Writing Personal Extensions](writing-personal-extensions.md#what-a-browser-extension-can-do).

A Server Extension runs in a separate Node process (a program on the server computer) inside an operating-system sandbox. It cannot reach Marinara files, your files, server secrets, the network, child processes, workers or native addons.

### Platform support

Browser Extensions are sandboxed by the browser, so they work everywhere. Server Extensions need a supported operating-system sandbox. Where none exists they stay disabled, and Marinara never runs them without one.

| Platform | Server Extensions |
| --- | --- |
| macOS | Sandboxed with Seatbelt, the macOS sandbox |
| Linux with Bubblewrap | Sandboxed with Bubblewrap, a Linux sandbox tool |
| Linux without `bwrap` | Disabled: install `bwrap` |
| Docker (default) | Disabled: container privileges |
| Windows | Disabled: use a Browser Extension |
| Android | Disabled: use a Browser Extension |

Browser Extensions are sandboxed on every platform. Full page External Extensions are not sandboxed anywhere and always need your explicit trust.

The official Docker image contains Bubblewrap, but its default container cannot create the nested namespaces and mounts Bubblewrap needs. Marinara tests the sandbox at runtime and leaves Server Extensions disabled when the container denies it. See [Troubleshooting](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) for the Docker permission override and its security tradeoff.

On Windows and Android there is no supported process sandbox, so Server Extensions are unavailable. Use a Browser Extension, or run the Marinara server on macOS or Linux with `bwrap`.

## Allow third-party imports

Third-party imports are locked and hidden by default, because they run code written by other people. Two steps open them:

1. On the computer that runs Marinara, set `ENABLE_EXTERNAL_EXTENSIONS=true` in the `.env` file, then restart Marinara. See the [Server Configuration Reference](../CONFIGURATION.md).
2. Open **Settings → Advanced → Danger Zone**, scroll below the data-deletion controls, read the warning, and turn on **Allow third-party extension imports**.

**Settings → Addons** then shows **External Extensions** with file and folder import controls. Supported formats:

- `.personal-extension.zip` and compatible `.zip` packages
- `.json` manifests
- `.css`
- `.js`, `.mjs` and `.cjs`
- `.server.js`, `.server.mjs` and `.server.cjs`

Imports never carry approval and cannot enable themselves. Most Browser Extensions should stay in the safe sandbox. A package marked **Full page access** is different:

- Its code runs in Marinara's page, with no sandbox.
- It can read chats and cards, use browser storage, make network requests and call Marinara's own APIs.
- Enable it only after you have inspected and trust that exact version.
- Professor Mari's drafts cannot request it.

Legacy, profile-imported, manually stored and unknown-source records are also treated as external. They stay hidden, cannot be approved, and do not run until both steps are done.

Turning either step off disables all imported extensions. Turning it back on does not run them again. Reload the page if a full page extension left changes behind.

If it did not work: if the import controls do not appear, check that both steps are done and that you are on the server computer or have saved the admin secret under **Settings → Advanced → Admin Access**.

## Export, revisions and recovery

Use an extension's export action to download a portable package. Exported and restored packages stay disabled. Restoring a revision also returns it to a disabled draft.

**Settings → Addons → Extension revision history** sets how many previous code versions are kept for every Personal and External Extension. The default is **10**. Choose **0** to **10**, where **0** turns history off. Reducing the limit asks for confirmation before it permanently removes older revisions. Current code, approvals, enabled state and saved extension data are kept. Edits made through Professor Mari follow the same limit.

If an extension misbehaves, choose **Disable**. If the interface is unavailable, stop Marinara and set the `enabled` value of the matching `installed_extensions` record to `"false"`. Never set `approvedHash` by hand.

## Related guides

- [Writing Personal Extensions](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Server Configuration](../CONFIGURATION.md)
- [Backup and Restore](../data/backup-and-restore.md)
- [Remote Access](../REMOTE_ACCESS.md)
