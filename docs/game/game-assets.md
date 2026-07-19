# Game Assets: Music, Sound, Sprites, and Backgrounds

This guide explains the game asset library that Game Mode uses for music, sound, character art, and scene backgrounds. It covers the built-in starter set, the **Asset Browser** file manager, uploading your own files, and choosing which assets each game may use.

## What game assets are

Game assets are the media files Game Mode plays and shows while a session runs. Marinara Engine sorts them into five categories:

- **Music**: background music tracks that change with the scene.
- **Ambient**: looping environmental sound, such as nature, urban, or interior audio.
- **Sound Effects** (also called SFX): short sounds for menus, combat, and exploration.
- **Sprites**: character and object art shown on screen.
- **Backgrounds**: scene images shown behind the story.

Game Mode reads this library on its own. It picks music, ambient sound, and backgrounds automatically based on the scene, so you do not have to assign assets by hand during play.

## The bundled starter set

Marinara installs a free starter library the first time the server starts. It refreshes these files on later starts if the bundled set changes. The starter set includes:

- Five **Music** tracks, one for each of several scene moods.
- A set of **Ambient** loops under nature, urban, and interior folders.
- **Sound Effects** for menus, combat, and exploration.
- A pack of character **Sprites** in the `generic-fantasy` folder.

No **Backgrounds** are bundled. The background folders start empty. They fill up only when you upload images or when Game Mode generates scene art.

All bundled files are licensed CC0, which means they are in the public domain and free to use. Full credit for each file lives in a `CREDITS.md` text file that ships with the assets on disk. It is not shown inside the app.

Bundled files and folders are protected. You cannot delete or move them from the **Asset Browser**, so your starter library stays intact. You can still rename or copy them.

## Opening the Asset Browser

The **Asset Browser** is a file manager for your game assets. You can open it two ways.

From **Settings**:

1. Open **Settings**.
2. Go to the **Imports** tab.
3. Find the **Game Assets** section.
4. Click the **Asset Browser** button.

From a game:

1. Open a Game Mode chat.
2. Click the **Game Assets** button in the chat toolbar.

The toolbar button only appears in chats that use Game Mode. Opening it there shows the **Asset Browser** as a panel inside the game.

The toolbar at the top holds a breadcrumb that starts at **Game Assets**. Next to it are a **Grid view** and **List view** toggle, an **Upload** button, and a **New** button. It also has a **Rescan** button, an **Open in system folder** button, and a **Search in folder** box. A folder tree on the left lets you jump between categories on wider screens.

## Uploading your own assets

You can upload assets in two ways. Use whichever is easier for you.

### Upload from the Asset Browser

1. Open the **Asset Browser**.
2. Click into one of the five category folders, or a subfolder inside it.
3. Click **Upload** and pick your files, or drag files onto the file area.

You must be inside a category folder first. If you drop files at the top level, the app asks you to open a category folder before uploading.

### Upload from Settings

1. Open **Settings** and go to the **Imports** tab.
2. Find the **Game Assets** section.
3. Pick a category from the **Type** menu: **Music**, **Ambient**, **Sound Effects**, **Sprites**, or **Backgrounds**.
4. Set the destination in the **Folder** box, or keep the suggested default.
5. Click **Choose Files** and select your files.
6. Click **Upload to Server**.

Each **Type** fills the **Folder** box with a sensible default. The defaults are:

- **Music**: `exploration/fantasy/calm`
- **Ambient**: `nature`
- **Sound Effects**: `exploration`
- **Sprites**: `generic-fantasy`
- **Backgrounds**: `custom`

### File type and size rules

The server checks every upload against these rules. They apply to both upload paths.

| Category | Accepted file types |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Audio and image files can be up to 50 MB each. Text files can be up to 10 MB. The server rejects file types that do not fit the category. The error message lists the accepted types.

### The music folder rule

Music has a strict folder layout. Every music track must sit in a three-level path of `state/genre/intensity`, for example `exploration/fantasy/calm`. If the path does not match, the upload fails.

The allowed values are:

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`.
- Intensity: `calm`, `tense`, `intense`.

This layout is how Game Mode knows when to play each track. Ambient, sound effect, sprite, and background folders do not have this rule. You can name their subfolders freely.

## Organizing your assets

The **Asset Browser** lets you keep your files tidy. Right-click a file or folder on desktop, or use its "..." menu, to see its actions.

Actions on a file:

- **Rename**: give the file a new name. Renaming fails if the name is already taken in that folder.
- **Move** and **Copy**: send the file to another folder using a folder picker.
- **Delete**: remove the file.
- **Download**: save the file to your device.

Actions on a folder:

- **Create subfolder**: make a new folder inside it.
- **Open in system folder**: show the folder in your computer's file manager.
- **Delete folder**: remove the folder. If it still has files inside, you must check **Delete everything inside** first.

The **New** button in the toolbar also creates items in the current folder. It offers **New folder**, **New text file**, and **New markdown file**.

To act on many files at once, use the checkboxes on each file. A bar shows how many files you selected, with **Select all**, **Move**, **Copy**, and **Delete** buttons. Large folders show only part of their contents at a time, with a **Load more** button.

Each folder can hold a short note. Click the folder description text, or the **Add description...** hint, to write one. The five category folders have fixed descriptions you cannot change.

Remember that bundled starter files are protected. You can rename or copy them, but you cannot move or delete them.

## Rescanning after outside changes

Marinara keeps an internal list of your assets so Game Mode can find them fast. When you upload through the app, this list updates on its own.

If you copy files into the game asset folder directly on your computer, outside the app, the app does not notice right away. Click the **Rescan** button to make it re-read the folder and pick up the new files. **Rescan** sits in both the **Asset Browser** toolbar and the **Game Assets** section under **Settings**.

## Choosing which assets a game can use

Each Game Mode chat can limit itself to only some of your asset folders. This is useful when you want a horror game to skip your cheerful music, for example.

1. Open the game's **Asset Browser** panel from the chat toolbar.
2. Click the **Game assets** button. It changes to read **Selecting** while active.
3. Use the small status control on each folder to include or exclude it.

A bar shows "All folders included" or how many folders are excluded, with a **Reset to all** button to include everything again. This choice is saved for that one chat only. It changes which folders Game Mode may pick from, but it does not delete or hide any files. It has no effect outside that Game Mode chat.

## Custom music folder for Music DJ

**Music DJ** is a helper agent that can play music during a game. When it runs in its Custom mode, it plays tracks from a folder you choose. You can set that folder in two places.

When you enable **Music DJ** for a chat, the setup form follows the source saved on the Music DJ agent. **Game Assets** shows a path inside your game assets, such as `music` or `music/combat`. **Folder on this device** shows the saved server-device path and a **Choose Folder** button.

The full **Music DJ** editor has a **Custom Music Library** section. Its **Use Game Assets music folder** switch picks between two modes:

- Switch on: the **Game Assets music folder** field reads a folder inside your game assets, such as `music` or `music/combat`. The **Open Folder** button opens that folder on the server machine.
- Switch off: the **Music folder on this device** field lets Custom mode play music from any folder on the computer that runs the server. Click **Select Folder** to open a system folder picker, or paste the folder path into the box.

Picking a folder outside the app needs privileged access. On the same computer as the server, it works with no extra setup. From another device or over remote access, you must set up admin access first. See [Remote Access](../REMOTE_ACCESS.md) for how to enable it. For everything else about the music player, see [Music DJ](../media/music.md).

## Opening the folder on your computer

The **Open in system folder** button opens the selected asset folder in your computer's normal file manager. This only works when you use the app on the same computer that runs the server. On a phone, tablet, or another computer, the app tells you that system folders can only be opened from the device hosting Marinara.

## Related guides

- [Music DJ: Spotify, YouTube, and Local Music](../media/music.md)
- [Game Mode: Getting Started](getting-started.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
