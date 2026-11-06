# Game Assets: Music, Sound, Sprites, and Backgrounds

Game assets are the media files Game Mode plays and shows: music, sound, character art and scene backgrounds. This guide shows how to use the starter set, upload your own files in the **Asset Browser**, limit which assets a game may use and generate sound effects and music.

Game Mode reads the library on its own. It picks music, ambient sound and backgrounds from the scene, so you do not assign assets by hand during play.

| Category | What it is |
| --- | --- |
| **Music** | Background tracks that change with the scene. |
| **Ambient** | Looping environment sound, such as nature, urban or interior audio. |
| **Sound Effects** (SFX) | Short sounds for menus, combat and exploration. |
| **Sprites** | Character and object art shown on screen. |
| **Backgrounds** | Scene images shown behind the story. |

## The starter set

Marinara installs a free starter library the first time the server starts, and refreshes it on later starts if the bundled set changes. It holds:

- Five **Music** tracks, for different scene moods.
- **Ambient** loops under `nature`, `urban` and `interior` folders.
- **Sound Effects** for menus, combat and exploration.

The **Backgrounds** and **Sprites** folders in the Asset Browser start empty. No character sprites are bundled, so add art that fits your own games. For backgrounds, Game Mode also draws on the app's own background library. On a new install it holds 13 starter images plus a plain `Black.jpg`, and games can use those without any upload. If that folder already held images, only `Black.jpg` is restored. Generated scene art and your uploads add to them.

All bundled audio is licensed CC0 (public domain, free to use). Credit for each file is in a `CREDITS.md` file that ships with the assets on disk. It is not shown in the app.

Bundled files and folders are protected. You cannot delete or move them in the **Asset Browser**, but you can rename or copy them.

## Open the Asset Browser

The **Asset Browser** is a file manager for game assets. Open it from **Settings**:

1. Open **Settings**.
2. Go to the **Imports** tab.
3. Find **Game Assets** and click **Asset Browser**.

Or open it from a game:

1. Open a Game Mode chat.
2. Click or tap the **Game Assets** button (the folder icon) near the top right of the chat. You can drag it elsewhere on a computer or phone.

The button appears only in Game Mode chats. It opens **Game Assets** with the **Asset Browser** inside, as a movable window on a computer or a full-width panel on a phone. If you used **Put back in Chat Settings** to move it, open the **Game Assets** section in Chat Settings instead.

The toolbar shows a breadcrumb starting at **Game Assets**, a **Grid view** and **List view** toggle, **Upload**, **New**, **Rescan**, **Open in system folder** and a **Search in folder** box. A folder tree on the left helps you jump between categories on wider screens.

## Upload your own assets

Marinara checks every upload against the rules in [File types and sizes](#file-types-and-sizes). Use either path.

### Upload from the Asset Browser

1. Open the **Asset Browser**.
2. Open one of the five category folders, or a subfolder in it.
3. Click **Upload** and pick files, or drag files onto the file area.

You must be inside a category folder. If you drop files at the top level, the app asks you to open one first.

### Upload from Settings

1. Open **Settings** and go to the **Imports** tab.
2. In **Game Assets**, pick a category from **Type**: **Music**, **Ambient**, **Sound Effects**, **Sprites** or **Backgrounds**.
3. Set the destination in **Folder**, or keep the default.
4. Click **Choose Files** and select your files.
5. Click **Upload to Server**.

If it did not work, the error message lists the accepted file types for that category. For music, check the folder path (see [The music folder rule](#the-music-folder-rule)).

Default **Folder** values:

| Type | Default folder |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

### File types and sizes

| Category | Accepted file types |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Audio and image files can be up to 50 MB each. Text files can be up to 10 MB.

### The music folder rule

Every music track must sit in a three-level path `state/genre/intensity`, for example `exploration/fantasy/calm`. If the path does not match, the upload fails. This layout is how Game Mode knows when to play each track.

- State: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Genre: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`, or a setting's family (see below), such as `wuxia`.
- Intensity: `calm`, `tense`, `intense`.

Ambient, sound effect, sprite and background folders have no such rule. Name their subfolders freely.

## Organize your assets

Right-click a file or folder on a computer, or use its "..." menu, to see its actions.

| File action | What it does |
| --- | --- |
| **Rename** | Fails if the name is already taken in that folder. |
| **Move**, **Copy** | Sends the file to another folder with a folder picker. |
| **Delete**, **Download** | Removes the file, or saves it to your device. |

| Folder action | What it does |
| --- | --- |
| **Create subfolder** | Makes a new folder inside it. |
| **Open in system folder** | Shows it in your computer's file manager. |
| **Delete folder** | If files are inside, check **Delete everything inside** first. |

**New** in the toolbar creates **New folder**, **New text file** or **New markdown file** in the current folder. To act on many files, tick their checkboxes. A bar shows how many are selected, with **Select all**, **Move**, **Copy** and **Delete**. Large folders load in parts with a **Load more** button.

Each folder can hold a short note. Click the description text, or the **Add description...** hint, to write one. The five category folders have fixed descriptions.

### Rescan after outside changes

Marinara keeps an internal list of assets so Game Mode finds them fast. Uploads through the app update it automatically. If you copy files into the game asset folder on your computer outside the app, click **Rescan** to read the folder again. **Rescan** is in the **Asset Browser** toolbar and in **Game Assets** under **Settings**.

### Open the folder on your computer

**Open in system folder** works only when you use the app on the same computer that runs the server. On a phone, tablet or another computer, the app tells you system folders can only be opened from the device hosting Marinara.

## Choose which assets a game can use

A Game Mode chat can use only some of your asset folders, for example to keep your cheerful music out of a horror game.

1. During setup, expand **Adjust Game Assets for this Game** on the **Features** step. For an existing game, open the game's **Game Assets** window.
2. Click **Game assets**. It changes to **Selecting**.
3. Use the small status control on each folder to include or exclude it.

A bar shows "All folders included" or how many are excluded. **Reset to all** includes everything again. The choice is saved for that chat only. It changes which folders Game Mode may pick from, and does not delete or hide any file.

### A setting's own art and music

A game started with a setting kit has an art family, shown under **Art and music** when you change the kit's words: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland`, or one of the kit's own. The game uses folders named for its family and every folder not named for a family, and leaves out other families' folders. A cyberpunk game never plays fantasy battle music or shows the enchanted forest. When nothing of its family or the shared folders fits, nothing plays rather than another family's track. A game without a setting kit uses every folder.

- **Music**: put the setting's tracks in `music/<state>/<family>/<intensity>`, such as `combat/wuxia/intense`. They play ahead of shared tracks.
- **Backgrounds**: `backgrounds/<family>`. Backgrounds generated in a game with a setting kit are saved there too.
- **Combat sounds**: a sound in `sfx/combat/<family>` with the same name as a bundled one, such as `sword-swing`, replaces it in games of that family. The bundled combat sounds are fantasy, so other families' fights are quiet until you add their own.

The bundled starter backgrounds count as shared, except the fantasy ones (`ancient_library`, `castle_cliff`, `enchanted_forest`) and the modern `city_night`. A setting kit saved before art families existed keeps working: one made from a starter kit uses that starter's family, and any other uses every folder until you pick a family under **Art and music**. The selection bar above names the open game's family.

## Generated sound effects and music

Game Mode can generate sound effects and music through a **Music & Sound Effects** account. Choose ElevenLabs, SunoAPI or a custom compatible server. Each new sound or track uses that service account. Bundled audio stays available without generation.

**Before you start:** you need a **Music & Sound Effects** account. The **Add account** window has no tile for it. These accounts come from an upgrade or an import (**Import a backup** in **Connections**). See [provider setup and limits](../connections/providers-reference.md#music--sound-effects).

1. In **Connections**, open the account's model with **Edit model**.
2. Choose the service, enter its key and select the music and sound-effect models. SunoAPI music also needs a public HTTPS callback URL. A custom server needs its endpoint paths.
3. Turn on **Sound-effect generation**, **Music generation**, or both.
4. Save the account. See [provider setup and limits](../connections/providers-reference.md#music--sound-effects).

Then turn it on when you create a game:

1. On the **Features** step of the setup wizard, find the **Game Audio** card.
2. Under the account choice, pick your account or keep **Use the default Music & Sound Effects account**.
3. Leave **Sound effects** and **Music** on, or switch off the one you do not want.

Each toggle needs the matching capability turned on in the selected account. A speech-only Audio account is not used for generation.

During play:

- **Sound effects.** After GM turns, Marinara asks the service for short sounds that fit the scene.
- **Music.** Marinara composes one instrumental track, about two minutes long, for each place the party visits and each kind of fight, such as a boss fight. Each track is made once and reused. A new place's track starts at a later scene change, so music does not cut in mid-scene. A fight's track fades in as soon as it is ready.

Generated sounds and tracks are saved with your game assets, so the same sound is not made twice. If **Music DJ** plays music for the game, Game Mode does not generate music.

## Custom music folder for Music DJ

**Music DJ** is a helper agent that can play music during a game. In its Custom mode it plays tracks from a folder you choose. When you enable **Music DJ** for a chat, the setup form follows the source saved on the agent. **Game Assets** shows a path inside your game assets, such as `music` or `music/combat`. **Folder on this device** shows the saved server-device path and a **Choose Folder** button.

The full **Music DJ** editor has a **Custom Music Library** section. **Use Game Assets music folder** picks between two modes:

- On: the **Game Assets music folder** field reads a folder inside your game assets. **Open Folder** opens it on the server computer.
- Off: **Music folder on this device** plays music from any folder on the computer that runs the server. Click **Select Folder**, or paste the path.

Picking a folder outside the app needs privileged access. On the same computer as the server it works with no extra setup. From another device or over remote access, set up admin access first. See [Remote Access](../REMOTE_ACCESS.md). For the rest of the music player, see [Music DJ](../media/music.md).

## Related guides

- [Music DJ: Spotify, YouTube, and Local Music](../media/music.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Game Mode: Getting Started](getting-started.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
