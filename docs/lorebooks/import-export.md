# Importing and Exporting Lorebooks

Import lorebooks to bring in world facts from files, and export them to share or back them up. This guide covers single files, many files at once, and the four export formats. A lorebook is a set of keyword-triggered notes that Marinara adds to the prompt when a matching word comes up. Other tools call this feature World Info.

## What you can import

Marinara detects the file type for you. Both kinds are `.json` files, and you need no account or API key.

- A lorebook exported from Marinara. This keeps every field and every folder.
- A World Info file from another tool, such as SillyTavern World Info or the V2 character card "character-book" format. Marinara maps the fields onto its own.

## Import a lorebook

1. Open the **Lorebooks** panel.
2. Click the download-arrow icon in the top row, the middle of three icons. Its tooltip is **Import**. The plus icon is **New** and the check-mark icon is **Select**.
3. In the **Import Lorebook** window, tap or click the box that says **Drop one or more lorebook files here or click to browse**, and pick your `.json` files. On a computer you can also drop files on the box. You can pick several at once, and mix Marinara and World Info files.
4. Wait for the results. Each file shows a green check with **Imported lorebook**, or a red mark with an error. With several files, a summary line shows how many succeeded and failed.
5. Click **Close**. The new lorebooks are in the **Lorebooks** panel.

Marinara keeps the file's own date as the created date.

If it did not work: read the error next to the file. A file that is not a lorebook, or that is damaged, fails on its own while the other files import.

## After you import

An imported lorebook works with keywords right away. If you use semantic search, build its vectors again. See [Semantic Search for Lorebooks](semantic-search.md).

## Export a lorebook

1. In the **Lorebooks** panel, click a lorebook to open it.
2. Click the export icon in the editor header, near the top right. Its tooltip is **Export lorebook**.
3. In the **Export Lorebook** window, pick a format. Your browser downloads the file.

| Format | What you get | Use it for |
| --- | --- | --- |
| **Marinara Native** | Every entry field and folder. The file ends in `.marinara.json`. | Moving a lorebook to another Marinara install. |
| **Compatible JSON** | A folderless World Info file ending in `.json`. Some Marinara-only details are dropped. | Other roleplay tools. |
| **Markdown** | One `## Name` heading per entry with a `Keys:` line. | Reading and editing in a text editor. |
| **CSV** | A spreadsheet with name, keys, content, folder, enabled, constant and probability columns. | Editing many entries in a spreadsheet. |

## Export many lorebooks at once

1. In the **Lorebooks** panel, click the check-mark icon (**Select**).
2. Check each lorebook you want.
3. Click **Export** in the bar at the bottom.

Your browser downloads `marinara-lorebooks.zip`. Bulk export always uses **Marinara Native**, so everything comes back when you import it.

## Import entries from Markdown or CSV

You can add entries to a lorebook from a Markdown or CSV text file, for example one you edited after exporting.

1. Open the lorebook and click **Import entries from Markdown or CSV** in the editor header.
2. In the **Import entries** window, click **Choose file**, or paste text into the box.
3. Check **Format**. Marinara guesses it from the text.
4. Read the preview. For Markdown, use one `## Name` heading per entry, an optional `Keys: a, b` line, then the text. For CSV, use a header row with name, keys and content, and optional folder, enabled, constant and probability columns. It shows how many entries are ready and lists errors and warnings by line.
5. Under **Import into**, pick **This lorebook** or **New lorebook**. For a new one, type a name under **New lorebook name**.
6. Under **When an entry name already exists**, pick **Skip the imported entry**, **Import as a renamed copy** or **Overwrite the existing entry**.
7. Click the **Import** button, which shows the entry count.

A toast tells you how many entries were added, overwritten and skipped.

If it did not work: the button stays off when the file has an error that affects the whole file, such as missing required columns, or when no entry is valid. Fix the lines the preview lists.

## Import a whole SillyTavern folder

To import from a full SillyTavern folder, with characters, chats and presets, see [Importing from SillyTavern](../data/importing-from-sillytavern.md).

## Related guides

- [Lorebooks Overview](overview.md)
- [Linking Lorebooks to Characters and Personas](linking-to-characters.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
