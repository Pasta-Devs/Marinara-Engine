# Character Sprites (Expressions and Full-body)

A sprite is a picture of your character for one mood, such as happy or sad. Marinara shows it floating over the chat scene. Upload your own, generate them with AI, clean up their backgrounds and control how they appear.

Before you start: name each file after the mood, such as `happy.png`, so Marinara can pick it. In a Roleplay chat, sprites also need the **Expression Engine** agent (a helper that picks the sprite) turned on. See [How sprites show up in your chat](#how-sprites-show-up-in-your-chat).

There are two kinds of sprite:

- **Facial Expressions** are portrait images for moods such as happy, sad or angry.
- **Full-body** images are whole-body images for poses such as idle, walk or battle stance.

Sprites appear on screen in Roleplay Mode and Game Mode, not in Conversation chats. You can upload them in any mode, because a character keeps its sprites in every chat. A persona has the same **Sprites** tab.

## Find the Sprites tab

1. Open a character (or a persona) in its editor.
2. Click the **Sprites** tab.
3. At the top, pick a category: **Facial Expressions**, **Full-body** or **Clips**.

The sections below cover **Facial Expressions** and **Full-body**. **Clips** is part of the call feature. See [Conversation Audio and Video Calls](../conversation/calls.md).

## Upload your own sprites

You can upload PNG, JPEG, GIF, WebP, AVIF and SVG images. Transparent PNG files look best, because the empty area around the character stays see-through. An invalid replacement image is rejected and the saved sprite stays.

### Upload one or more sprites

1. Open the **Sprites** tab and pick **Facial Expressions** or **Full-body**.
2. Click **Add sprites**.
3. Click **Upload images**, browse into your folder and select its images. You can select several together.
4. In **Import images**, click **Import**. **Cancel** adds nothing.

Each file name becomes the sprite's name (its label). Open a sprite to rename it later. The new sprites appear in the grid, outside any folder. Subfolders are not scanned. Use **New folder** to organize the imported sprites.

In the persona editor, use the **Add Sprite** name field and **Upload** button for a single sprite.

### Upload a whole folder

Whole-folder upload is available in the persona editor. For characters, use **Upload images** above and select the images inside your folder.

1. Open the persona's **Sprites** tab.
2. In the **Add Sprite** box, click **Upload Folder**.
3. Choose the folder that holds your images.

Each file name without its suffix becomes the sprite name. A progress line reads "Uploading X/Y sprites". Subfolders become optional sprite folders. A `catalog.json` from an export also restores folders and edited labels. A bad folder entry is reported while usable images still import.

If it did not work: a failed or partial import reports the failure instead of a success for zero images. Check the file types above.

### Name variants

| File name | What it means |
| --- | --- |
| `happy_01.png`, `happy_blush.png` | Two happy pictures. Start both names with `happy_`. |
| `happy_pajamas.png` | Happy, in pajamas. Put the mood first, then the outfit. |
| `angry_formalwear_soaked_01.png` | Angry, formal wear, soaked. A trailing number only marks another version of the same picture. |

The Expression Engine sees both the expression (`happy`) and the full name (`happy_pajamas`). If no sprite matches every word, the last word is dropped first, so a missing `happy_pajamas_wounded` falls back to `happy_pajamas`, then to any happy sprite.

## How sprites show up in your chat

You choose when and how sprites appear in the chat's settings, not in the character editor.

### Roleplay Mode

The Expression Engine agent drives sprites in Roleplay. An agent is a helper that runs alongside replies. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md). It reads the mood of each message and picks a matching expression sprite. Add it to the chat, and install it from **Agent Organizer** if you do not have it. See [Downloadable Agents Reference](../agents/built-in-agents.md#expression-engine).

For sprites to appear, all of these must be true:

- The Expression Engine agent is on for the chat.
- At least one character, or the persona, is chosen as a sprite owner.
- At least one sprite source is on.

Open **Chat Settings → Agents** and find the **Expression Engine** card:

- **Sprite Source** is **Expressions**, **Full-body** or both. Both are on by default, and at least one must stay on.
- **Expression Avatars** replaces the small message avatar with the matching expression sprite. It is off by default and works in Roleplay only.
- **Only show active sprites** shows only the characters in the latest finished result and keeps the current sprites visible while the next result is made.

### Game Mode

In Game Mode a full-body sprite shows automatically for whoever is speaking or fighting. You do not need the Expression Engine, only full-body sprites for that character. See [Game Mode: Getting Started](../game/getting-started.md).

### Move and resize sprites

Once a sprite owner is on, the **Expression Engine** card shows **Sprite Layout**.

1. Click **Arrange**, then drag each sprite where you want it.
2. Click **Done**.

**Reset** clears your positions and goes back to the automatic layout. **Default Side** is **Left** or **Right** and starts on Left. Changing it flips your current layout. **Apply to** lets you set the layout for all characters or for one.

Four sliders set size and see-through level. **Expression Size** and **Full-body Size** run from 5% to 200%. **Expression Opacity** and **Full-body Opacity** run from 0% to 100%. Sizes and opacities start at 100%.

## Generate sprites with AI

Before you start: add an image-generation connection. For animated sprites you also need a video connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Open **Add sprites** and click **Generate Sprite**. In the persona editor, the button is in **Add Sprite**. The **Generate Sprites** window opens.
2. Choose a source at the top: **Expressions (Portrait)** or **Full-body**.
3. Pick an **Image Generation Connection**.
4. Optionally add up to four **Reference Images**, or tick the box to use the current avatar as a reference.
5. Write an **Appearance Description**. It is required.
6. Optionally turn on **Transparent sprite background**. Marinara makes the background see-through. If the service cannot do that, Marinara draws a plain green, magenta or cyan background that differs from your **Appearance Description** colors, then removes it.
7. Set **Expression Count** (or **Pose Count** for full-body) and pick which expressions or poses to make.
8. Click **Generate**.

When the images arrive, turn each one on or off, rename it and crop it. Then save the selected images into the character's sprites. If exactly one saved sprite in that category has the generated label, saving replaces its image and keeps its folder and handle. A sprite you renamed away from that label is kept. With duplicate labels in different folders, replace the sprite you mean by hand.

On the **Full-body** source, if the character already has portrait expressions, tick **Match existing expression sprites** to make full-body poses that match each expression name.

Generation can take a few minutes, longer on slow services. Wait rather than starting over. On some devices, such as certain Android installs, AI sprite generation and background cleanup are not available. The button is disabled and Marinara shows the reason.

### Animated portraits

On the **Expressions (Portrait)** source, **Generate animated portraits** makes short moving clips and turns each into a looping GIF sprite. A GIF is an image file that plays a short animation. It uses a video connection instead of an image connection. See [Animated Expressions](../media/animated-expressions.md).

## Clean up sprite backgrounds

A sprite looks best when only the character shows. Generated sprites use native transparency when the service supports it. Otherwise Marinara removes a flat adaptive background color with a soft edge and cleans that color out of hair, fabric and other partly see-through pixels. Older white-background sprites still work.

### Clean one sprite by hand

Open the character sprite preview and use its wand cleanup action, or click a persona sprite's picture. The cleanup editor lets you erase the background, paint areas back, and check the result on dark, light and checkerboard backdrops. You can undo, reset to the original and apply when done.

### Clean many sprites at once

1. In the character editor, click **Select** and choose sprites. In the persona editor, the cleanup button applies to the selected sprites, or to the visible category when none are selected.
2. Click **Clean Backgrounds**.
3. Set the **Cleanup strength** slider, from **Soft** to **Aggressive**, 0 to 100. It starts at 35. A higher value removes more background but can cut into the character.
4. Confirm.

Marinara keeps a safety copy. A line reads "Last cleanup has a restore point" with **Undo Cleanup**. Click it to put every affected sprite back.

Cleanup works on PNG, JPG, JPEG, WEBP and AVIF. It does not work on GIF or SVG.

Automatic cleanup looks at the image first. The fast built-in cleanup handles flat color and old white backgrounds. If the border is not uniform, Marinara can fall back to the optional AI background remover when it is installed. For a busy scene, or a subject whose colors match the background, the manual editor is the safest choice.

## Manage sprites

Open a character sprite to preview it and see its actions. Persona sprites keep their actions on the tile.

- **Frame** crops the image so the character sits where you want.
- **Download** saves the sprite file.
- **Replace** uploads a new image over the same name.
- **Rename** (character preview) changes its label, up to 160 characters, and keeps its file handle and URL, so existing image references keep working.
- **Folder** (character preview) or **Move sprite** (persona tile) picks a folder, or **No folder**, without dragging.
- **Delete** removes that sprite after you confirm. In the persona editor, **Delete All** with the category name removes the whole category, even while a search is active.

### Folders and selection

Click **New folder** to create a collapsed folder named **unnamed**. Double-click or double-tap its name to rename it, and use the chevron to expand it. Expressions and full-body sprites have separate folders. Folders sit above loose sprites and can be dragged to reorder.

Drag sprites into a folder, or drag a filed sprite to the loose area to remove it from its folder. On a phone, hold a tile to start dragging. A normal swipe still scrolls. Folders only organize: they never choose an active set or hide images from chats or agents. Deleting a folder keeps its sprites loose.

Click **Select** to show checkboxes and **Select all sprites**, then drag the selected sprites together or use cleanup and delete. **Cancel** leaves selection mode. Search filters the visible sprites. A search with no matches does not mean the library is empty.

### Character Sheet

The character editor's **Character Sheet** row opens with **Manage**. Create or upload a sheet there. Turn on **Use as reference image** to prefer it for the character's likeness.

## Export sprites

1. Open the **Sprites** tab.
2. Click **Export** above the character grid, or in the persona's **Add Sprite** box.
3. Choose **Expressions only** or **Full-body only** to export the current category, or **All sprites** for everything.

You get a zip with the sprite files and a `catalog.json` for labels and folders. Native character and persona exports and profile backups keep that data too.

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Animated Expressions](../media/animated-expressions.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)

## Reference for developers: sprite API and links

`GET /api/sprites/:ownerId` returns every sprite, filed or loose. `GET /api/sprites/:ownerId/catalog` adds folders and membership, for tools that import one folder at a time. Each sprite has a stable `expression` handle, an editable `label`, a `folderId` and a URL. Use folder IDs for membership. The `folders` array is stored order, which the editor shows in reverse so new folders appear first. Folder order does not set agent priority or availability.

The chat asset browser shows edited labels but inserts concrete `card://sprites/<ownerId>/<filename>` links, which keep working after a rename. Chat-scoped links such as `card://sprites/facial/joy.png` can also resolve the edited label. An existing matching filename wins.

Missing or unreadable optional metadata does not hide usable images. Edits refuse damaged metadata instead of replacing it. Read-only lists skip inaccessible libraries, and export and write paths refuse linked owner directories.
