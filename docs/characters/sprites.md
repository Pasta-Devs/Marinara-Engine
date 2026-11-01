# Character Sprites (Expressions and Full-body)

This guide shows you how to add character art called sprites and generate it with AI. It also covers cleaning up the background and controlling how sprites appear on screen. Sprites work in Roleplay Mode and Game Mode.

## What sprites are

A sprite is standing character art: a picture of a character that Marinara Engine shows floating over the chat scene. Marinara uses two kinds of sprite:

- **Facial Expressions**: portrait images for different moods, like happy, sad, or angry.
- **Full-body**: whole-body images for different poses, like idle, walk, or battle stance.

Sprites only appear on screen in **Roleplay Mode** and **Game Mode**. Plain Conversation-mode chats do not show sprite art. You can still upload sprites while in any mode, because a character keeps its sprites no matter which chat uses it.

You add sprites per character. You can also add sprites to a persona, which is the character that represents you. The persona editor has the same **Sprites** tab described below.

## Where to find the Sprites tab

You manage sprites inside the character (or persona) editor.

1. Open a character to edit it.
2. Click the **Sprites** tab in the editor.
3. At the top of the tab, pick a category: **Facial Expressions**, **Full-body**, or **Clips**.

This guide covers the **Facial Expressions** and **Full-body** categories. The **Clips** category is a separate feature for voice and video calls. See [Conversation Audio and Video Calls](../conversation/calls.md) for clips.

## Uploading your own sprites

You can upload PNG, JPEG, GIF, WebP, AVIF, and passive SVG images. Transparent PNG files give the best result, because the empty area around the character stays see-through over the scene. Unsupported or invalid replacement images are rejected without removing the saved sprite.

### Upload one sprite

1. Open the **Sprites** tab and pick **Facial Expressions** or **Full-body**.
2. Click **Add sprites**, then **Upload images**. You can select several images together.
3. Each filename becomes the initial sprite label. Open a sprite to rename it later.

The new sprites appear loose in the normal grid. In the persona editor, use the existing **Add Sprite** name field and **Upload** button for a single sprite.

### Upload a whole folder at once

If you have many sprites in a folder, you can import them all in one step.

1. Name your image files after the expression or pose. For example, name a file `admiration.png` to create an expression called admiration.
2. Open **Add sprites**, then click **Import folder**. In the persona editor, click **Upload Folder** in **Add Sprite**.
3. Choose the folder that holds your images.

Each file name (without its suffix) becomes the sprite name. A progress line reads "Uploading X/Y sprites" while it runs.

Subfolders become optional sprite folders. An exported `catalog.json` also restores folder membership and edited labels. Invalid folder information is reported while usable images still import. Failed or partial imports report the failure rather than a success for zero images.

To make several versions of the same expression, share a name before an underscore. For example, `happy_01.png` and `happy_blush.png` both count as variants of happy.

### Manage a sprite

Open a character sprite to preview it and see its actions. Persona sprites keep their actions on the tile:

- **Frame**: crop the image so the character sits where you want.
- **Download**: save the sprite file to your computer.
- **Replace**: upload a new image over the same name.
- **Rename** (character preview): change its label, up to 160 characters, while retaining its file handle and URL. Existing concrete image references keep working.
- **Folder** (character preview) or **Move sprite** (persona tile): choose a folder, or **No folder**, without dragging.
- **Delete**: remove that sprite.

Deleting asks you to confirm. In the persona editor, **Delete All Expressions** or **Delete All Full-Body** removes the whole category even when a search is active.

### Optional folders and selection

Click **New folder** to create a collapsed folder named **unnamed**. Double-click or double-tap its name to rename it; use the chevron to expand it. Expressions and full-body sprites have separate folders. Folders appear above loose sprites and can be dragged to reorder them.

Drag individual sprites into expanded or collapsed folders. On phones, hold a tile to start dragging; a normal swipe still scrolls. Drag a filed sprite to the loose area to remove its folder assignment. The highlighted area shows the destination. The preview's **Folder** control and the persona tile's **Move sprite** button provide a keyboard alternative.

Click **Select** to reveal checkboxes and **Select all sprites**, then drag the selected sprites together or use the available cleanup and deletion tools. **Cancel** leaves selection mode. Search filters the visible sprites; a search with no matches does not mean the library is empty.

Folders organize sprites; they never choose an active set or hide images from chats or agents. Deleting a folder keeps its sprites loose.

### Character Sheet

The character editor's compact **Character Sheet** row opens with **Manage**. Create or upload a sheet there and enable **Use as reference image** when you want it preferred for character likeness. Reference selection and avatar fallback work as before.

## Generating sprites with AI

If you have an image connection set up, Marinara can draw sprites for you. A connection is the link between Marinara and an AI service. To generate sprites you need an image connection, and for animated sprites you need a video connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) to set one up.

To start, open **Add sprites** and click **Generate Sprite**. In the persona editor, this button remains in **Add Sprite**. This opens the **Generate Sprites** window. At the top you choose a source: **Expressions (Portrait)** or **Full-body**.

Fill in the window:

1. Pick an **Image Generation Connection** from the dropdown.
2. Add up to four **Reference Images** if you want the art to match a look. You can also tick the box to use the current avatar as a reference.
3. Write an **Appearance Description** of how the character looks. This is required.
4. Optionally turn on **Transparent sprite background**. Marinara requests native PNG transparency first. If the provider cannot return alpha, it chooses a saturated green, magenta, or cyan matte that least overlaps the colors in your **Appearance Description**, then removes that matte automatically.
5. Choose how many images to make with **Expression Count** (or **Pose Count** for full-body), then pick which expressions or poses to fill.
6. Click the **Generate** button.

When the images arrive, you review them. You can turn each one on or off, rename it, and crop it before saving. When you are happy, save the selected images into the character's sprite set.

When exactly one saved sprite in that category has the generated label, saving replaces its image and keeps its folder and handle. A sprite renamed away from that label is preserved. Duplicate labels in different folders need an explicit sprite replacement to choose one reliably.

On the **Full-body** source, if the character already has portrait expressions, you can tick **Match existing expression sprites**. This creates full-body poses that match each expression name you already have.

Two notes about AI generation:

- Generation can take a few minutes, even though the in-app text may suggest less. Slow AI services take longer. Please wait rather than starting over.
- On some devices, such as certain Android installs, AI sprite generation and background cleanup are not available. When that happens, the button is disabled and Marinara shows the reason on screen.

### Animated portrait sprites

On the **Expressions (Portrait)** source there is a checkbox called **Generate animated portraits**. Turning it on makes short moving clips instead of still pictures, then turns each clip into a looping GIF sprite. A GIF is an image file that plays a short animation. Animated portraits use a video connection instead of an image connection.

## Cleaning up sprite backgrounds

A sprite looks best when only the character shows and the background is see-through. Generated still sprites use native transparency when the provider supports it. Otherwise, Marinara removes a flat adaptive chroma matte with a soft edge and cleans its color out of hair, fabric, and other partially transparent pixels. Older white-background sprites remain supported.

### Clean one sprite by hand

Open the character sprite preview and its wand cleanup action, or click a persona sprite's picture to open the cleanup editor. There you can erase the background, paint areas back, and check the result against dark, light, and checkerboard backdrops. You can undo, reset to the original, and apply your changes when done.

### Clean many sprites at once

In the character editor, click **Select**, choose sprites, and click **Clean Backgrounds**. In the persona editor, the cleanup button applies to the selected sprites, or the visible category when nothing is selected.

1. Set the **Cleanup strength** slider. It runs from Soft to Aggressive, from 0 to 100, and starts at 35. A higher value removes more of the background but can bite into the character.
2. Click **Clean Backgrounds** and confirm.

After a batch cleanup, Marinara keeps a safety copy. A line reads "Last cleanup has a restore point" with an **Undo Cleanup** button. Click it to put every affected sprite back the way it was.

Background cleanup works on PNG, JPG, JPEG, WEBP, and AVIF images. It does not work on GIF or SVG files.

Automatic cleanup examines the image before choosing an engine. The fast built-in matte cleanup handles flat chroma and legacy white backgrounds first. If the border is not actually uniform, Marinara can use the optional AI background remover as a fallback when it is installed. The manual cleanup editor remains the safest option for a busy scene or a subject whose colors are nearly identical to the background.

## Exporting sprites

You can save a character's sprites to your computer as a zip file. A zip is a single file that holds many files together.

1. Open the **Sprites** tab.
2. Click **Export** above the character grid, or in the persona's **Add Sprite** box.
3. Choose **Expressions only** or **Full-body only** to export the current category, or **All sprites** to export everything.

The download contains the sprite image files and a `catalog.json` for labels and folder organization. Supported native character/persona transfers and profile backups retain that metadata too.

### Folder-aware integrations

`GET /api/sprites/:ownerId` continues to return every sprite, filed or loose. `GET /api/sprites/:ownerId/catalog` adds folders and membership for integrations that want to discover or import one folder at a time. Each sprite includes its stable `expression` handle, editable `label`, `folderId`, and URL. Use folder IDs for membership; the `folders` array is stored order, which the editor displays in reverse so new folders appear first. Folder order does not set agent priority or availability.

The chat asset browser shows edited labels but inserts concrete `card://sprites/<ownerId>/<filename>` links, which keep working after a rename. Chat-scoped links such as `card://sprites/facial/joy.png` can also resolve the edited label; an existing matching filename takes precedence.

Missing or unreadable optional metadata does not hide usable images. Edits refuse damaged metadata rather than silently replacing it. Read-only lists skip inaccessible libraries; export and write paths continue to refuse linked owner directories.

## How sprites show up in your chat

Uploading sprites is only half the job. You also decide when and how they appear during a chat. This happens in the chat settings, not in the character editor.

### Roleplay Mode

In **Roleplay Mode**, the optional **Expression Engine** agent drives sprite display. Download it from **Agents → Agent Organizer**, then add it to the chat. It reads the mood of each message and picks a matching expression sprite. See [Downloadable Agents Reference](../agents/built-in-agents.md) for details.

For sprites to appear in a Roleplay chat, all of the following must be true:

- The **Expression Engine** agent is enabled for the chat.
- At least one character or the active persona is chosen as a sprite owner.
- At least one sprite source is turned on.

Open the chat settings and find the **Expression Engine** agent card. There you control how sprites display:

- **Sprite Source**: choose **Expressions**, **Full-body**, or both. Both are on by default. At least one must stay on.
- **Expression Avatars**: replace the small message avatar with the matching expression sprite instead of showing a floating overlay. This is off by default and is Roleplay Mode only.

### Game Mode

In **Game Mode**, a full-body sprite shows automatically for whichever character is speaking or fighting. You do not need the Expression Engine agent for this. You only need full-body sprites uploaded for that character. See [Game Mode: Getting Started](../game/getting-started.md) for the wider Game Mode setup.

### Move and resize sprites (Arrange mode)

Once a sprite owner is enabled, the **Expression Engine** agent card shows a **Sprite Layout** section.

- Click **Arrange** to enter drag mode, then drag each sprite where you want it. Click **Done** when finished.
- **Reset** clears your custom positions and returns to the automatic layout.
- **Default Side** sets whether new sprites lean toward the **Left** or the **Right**. Left is the default. Changing the side flips your current layout.
- Four sliders set size and see-through level: **Expression Size** and **Full-body Size** run from 5% to 200%. **Expression Opacity** and **Full-body Opacity** run from 15% to 100%. All start at 100%.

## Video call clips

The **Clips** category in the **Sprites** tab is a different feature. It makes short looping videos that act as a character's camera during a Conversation-mode voice or video call. Because it belongs to the call feature, it is documented separately. See [Conversation Audio and Video Calls](../conversation/calls.md).

## Related guides

- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Animated Expressions](../media/animated-expressions.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
