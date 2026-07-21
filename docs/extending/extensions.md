# Extensions

This guide explains what extensions are in Marinara Engine, and how to install, enable, export, and remove them. It covers the two kinds of extensions and the trust warnings each one shows. If you want to write your own extension, see the developer guide linked at the end.

## What an extension is

An extension is an add-on that changes how Marinara looks or behaves. You install extensions that other people made, or that you wrote yourself.

There are two kinds of extension:

- A **browser extension** runs inside the Marinara page in your web browser. It can change styling or add small features to the screen you are looking at. Some browser extensions also run JavaScript, a small program that acts on the page.
- A **server extension** runs trusted JavaScript inside the Marinara server program on the host computer. It is more powerful, so only install a **server extension** from a source you trust.

Neither kind edits Marinara's own program files. An extension you disable or delete stops running and cleans up after itself.

You can get ready-made extensions from the official Marinara Engine Discord server. The **Extension Library** shows this same reminder below the list.

## Opening the Extension Library

You manage every extension in one place.

1. Open **Settings**.
2. Open the **Addons** tab. Its description reads "Themes, extensions, and custom behavior."
3. Find the **Extension Library** section. Its description reads "Import, enable, disable, export, or remove installed extensions."

The **Theme Library** sits in the same **Addons** tab, right below **Extension Library**. Themes are a separate feature for changing Marinara's look. See [Custom CSS Themes](../appearance/custom-css-themes.md).

## Installing an extension

The **Extension Library** has two import buttons above the list. Pick the one that matches what you have.

To install a single file:

1. Click **Import Extension File**.
2. Choose the file. Supported types are `.zip`, `.json`, `.css`, `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, and `.server.cjs`.
3. The extension appears in the **Installed Extensions** list.

To install a whole folder:

1. Click **Import Extension Folder**.
2. Choose the folder that holds the extension files.
3. Marinara imports every extension it finds inside.

Any other file type is rejected. You will see a message that lists the supported types.

After you install a folder or package with more than one extension, a message reports how many were imported. An example is "Imported 3 extensions. Review before enabling."

### Which extensions start disabled

Some imports always arrive turned off, so you can review them before they run:

- A single file import, such as a `.css`, `.js`, or `.server.js` file.
- A folder that does not include a manifest.
- Every **server extension**, no matter how you import it.

A folder, `.zip`, or `.json` package that includes a manifest works differently. The manifest is a small settings file, named `manifest.json`, written by the extension author. A **browser extension** imported this way follows the manifest's own enabled setting. That means it can arrive turned on and run right away. After you import a package, check the **Installed Extensions** list. Turn off anything you have not reviewed yet.

## Enabling and disabling

Each row in the **Installed Extensions** list has a power icon on the left. Click it to turn that extension on or off. The icon title reads **Enable extension** when the extension is off, and **Disable extension** when it is on.

Turning an extension off never asks you to confirm. Turning one on may show a trust warning, because turning it on runs its code.

- Turning on a **server extension** shows a dialog titled **Enable Server Extension**. It warns that the code runs inside the Marinara server program and can affect that server until you disable it. The confirm button is labeled **Enable Server Extension**. Only enable code you trust.
- Turning on a **browser extension** that includes JavaScript shows a dialog titled **Enable Extension**. It warns that the code runs inside Marinara. The confirm button is labeled **Enable**.
- Turning on a **browser extension** that has styling only, with no JavaScript, runs right away with no dialog.

### Reading a server extension's status

Each row shows a small badge that reads **Server** or **Browser**, so you know which kind it is.

When a **server extension** is turned on, it also shows a live status badge:

- **Running** means the extension started and is working.
- **Stopped** means it is not currently running.
- **Error** means it failed to start. The error message shows in red under the row.

Browser extensions do not show a status badge. If a browser extension misbehaves, check your browser's developer console for messages.

## Exporting an extension

You can save any installed extension as a file to back it up or share it.

1. Find the extension in the **Installed Extensions** list.
2. Click the export icon on the right of the row. Its title reads **Export extension**.
3. Marinara downloads the extension as a `.zip` file.

The other person can install that `.zip` with **Import Extension File**.

## Deleting an extension

1. Find the extension in the **Installed Extensions** list.
2. Click the trash icon on the right of the row. Its title reads **Remove extension**.
3. Confirm in the **Delete Extension** dialog. The confirm button is labeled **Delete**.

Deleting is permanent. It removes the saved extension code from the server. Deleting a running **server extension** stops it first, then removes it.

## Changing an extension

There is no way to edit an installed extension's code inside Marinara. Import the new version using the same extension name, and Marinara updates the existing entry while preserving whether you enabled or disabled it. If the extension declares a numeric release version and the imported release is older than the installed one, Marinara asks before replacing it.

## Why some actions need Admin Access

Installing, enabling, disabling, exporting, and deleting an extension are protected actions. This protects the server from unwanted code.

These actions work automatically when you open Marinara on the same computer that runs it, through `localhost` or `127.0.0.1`. The term `localhost` means "this computer".

When you open Marinara from another device, such as your phone or a computer across your network, the server needs proof that you are allowed. You provide this with an admin secret:

1. Set `ADMIN_SECRET` to a value of your choice in the server's `.env` file. The `.env` file holds server settings.
2. Open **Settings**, then the **Advanced** tab, then **Admin Access**.
3. Paste the same value there and save.

Without one of these two conditions, the action is denied. You will see an error that access was denied, and the message tells you to use `localhost` or to set up **Admin Access**. For the full remote-access picture, see [Remote Access](../REMOTE_ACCESS.md).

## What can go wrong

- An extension does nothing after you enable it. Check that it is actually on, that a **server extension** shows **Running**, and that it is the kind you expected.
- A browser extension that loads a font or image from the internet may show nothing. Marinara removes remote resources from extension styling for safety. Extensions must bundle fonts and images inside themselves.
- Two extensions can clash if they change the same part of the page. Disable one to test which one causes the problem.
- A broken extension does not crash Marinara. Its errors are caught and logged, and you can disable or delete it at any time.
- An install fails with an access-denied error from another device. Set up **Admin Access** as described above.

## Related guides

- [Writing Extensions (Developers)](../development/writing-extensions.md) for building your own extension.
- [Custom CSS Themes](../appearance/custom-css-themes.md) for changing Marinara's look without an extension.
- [Remote Access](../REMOTE_ACCESS.md) for setting up access and the admin secret from other devices.
