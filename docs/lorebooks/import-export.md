# Importing and Exporting Lorebooks

This guide shows you how to bring lorebooks into Guksu Motor and how to save them out as files. It covers single files, many files at once, and the two export formats. A lorebook is a set of keyword-triggered notes that Guksu adds to the AI's prompt when a matching word appears. Some other roleplay tools call this feature **World Info**.

## What you can import

Guksu can read two kinds of lorebook file, and it detects which one you gave it automatically:

- A lorebook exported from Guksu itself. This keeps every field and every folder.
- A **World Info** file from another tool. This includes SillyTavern World Info files and the V2 character card "character-book" format. Guksu maps the other tool's fields onto its own.

Both kinds are plain `.json` files. You do not need an account or an API key to import a lorebook.

## Import a lorebook

Follow these steps to import one lorebook file.

1. Open the **Lorebooks** panel from the left side of the app.
2. Click the download-arrow icon in the top action row. Its tooltip reads **Import**. It sits between the plus icon (**New**) and the checkmark icon (**Select**). These three buttons show icons only, so hover over them to see their names.
3. The **Import Lorebook** window opens. You should see a box that says **Drop one or more lorebook files here or click to browse**.
4. Drag your `.json` file onto the box, or click the box to pick a file.
5. Wait for the result. Each file shows a green check with **Imported lorebook**, or a red mark with an error message.
6. Click **Close**. Your new lorebook now appears in the **Lorebooks** panel list.

Guksu keeps the imported file's own date as the lorebook's created date, not the moment you imported it.

## Import many lorebooks at once (bulk import)

The **Import Lorebook** window accepts more than one file in a single go.

1. Open the **Lorebooks** panel and click the download-arrow icon. Its tooltip reads **Import**.
2. Drag several `.json` files onto the drop box at the same time, or click the box and select multiple files.
3. Guksu imports each file in turn and lists a result row for every one. A summary line shows how many succeeded and how many failed.

You can mix Guksu files and **World Info** files in the same batch. Guksu checks each file on its own.

## Export a lorebook

Exporting saves one lorebook to a file on your device. This is how you share a lorebook or move it to another install.

1. In the **Lorebooks** panel, click a lorebook to open its editor.
2. Click the export icon in the editor header. Its tooltip reads **Export lorebook**.
3. The **Export Lorebook** window opens with two choices. Pick one:
   - **Guksu Native** keeps Guksu folders and every entry field. Use this to move a lorebook to another Guksu install with nothing lost. The file name ends in `.marinara.json`.
   - **Compatible JSON** saves a folderless **World Info** file for other roleplay tools. Some Guksu-only details are dropped. The file name ends in `.json`.
4. Your browser downloads the file.

Choose **Guksu Native** when the file is for Guksu. Choose **Compatible JSON** when the file is for a different tool.

## Export many lorebooks at once (bulk export)

You can save several lorebooks into one zip file.

1. In the **Lorebooks** panel, click the checkmark icon in the top action row. Its tooltip reads **Select**.
2. Check the box on each lorebook you want to export.
3. Click **Export** in the selection bar at the bottom.
4. Your browser downloads a single zip named `marinara-lorebooks.zip`.

Bulk export always uses the **Guksu Native** format, so it round-trips back into Guksu with nothing lost.

## Importing a whole SillyTavern folder

The steps above import lorebook files you already have. You can also pull lorebooks straight from a full SillyTavern install folder. That path grabs characters, chats, and presets at the same time. It uses a separate folder import wizard. See [Importing from SillyTavern](../data/importing-from-sillytavern.md).

## After you import

An imported lorebook works right away with keyword triggers. If you use semantic search, which matches entries by meaning, you need to build its vectors again after import. See [Semantic Search for Lorebooks](semantic-search.md).

## Related guides

- [Lorebooks Overview](overview.md)
- [Linking Lorebooks to Characters and Personas](linking-to-characters.md)
- [Semantic Search for Lorebooks](semantic-search.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
