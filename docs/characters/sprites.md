# Character Sprites (Expressions and Full-body)

This guide shows you how to add character art called sprites and generate it with AI. It also covers cleaning up the background and controlling how sprites appear on screen. Sprites work in Roleplay Mode and Game Mode.

## What sprites are

A sprite is standing character art: a picture of a character that Guksu Motor shows floating over the chat scene. Guksu uses two kinds of sprite:

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

You can upload art you already have. Guksu accepts common image files. Transparent PNG files give the best result, because the empty area around the character stays see-through over the scene.

### Upload one sprite

1. Open the **Sprites** tab and pick **Facial Expressions** or **Full-body**.
2. In the **Add Sprite** box, type a name in the text field. For expressions the placeholder shows "Expression name (e.g. happy, sad, angry)". For poses it shows "Pose name (e.g. idle, walk, battle_stance)".
3. Click **Upload** and choose one image file.

The new sprite appears in the grid below with the name you gave it.

### Quick add common expressions

On the **Facial Expressions** category, a **Quick add** row shows suggested expression names you have not used yet, such as happy or angry. Click one to open the file picker with that name already filled in. This saves you from typing the name yourself.

### Upload a whole folder at once

If you have many sprites in a folder, you can import them all in one step.

1. Name your image files after the expression or pose. For example, name a file `admiration.png` to create an expression called admiration.
2. In the **Add Sprite** box, click **Upload Folder**.
3. Choose the folder that holds your images.

Each file name (without the file extension) becomes the sprite name. A progress line reads "Uploading X/Y sprites" while it runs.

To make several versions of the same expression, share a name before an underscore. For example, `happy_01.png` and `happy_blush.png` both count as variants of happy.

### Manage a sprite

Move your mouse over a sprite card in the grid to see its actions:

- **Frame**: crop the image so the character sits where you want.
- **Download**: save the sprite file to your computer.
- **Replace**: upload a new image over the same name.
- **Delete**: remove that sprite.

Deleting asks you to confirm with the message "Delete sprite for" and the name. When more than one sprite is showing, the same dialog also offers **Delete All Expressions** or **Delete All Full-Body**.

## Generating sprites with AI

If you have an image connection set up, Guksu can draw sprites for you. A connection is the link between Guksu and an AI service. To generate sprites you need an image connection, and for animated sprites you need a video connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) to set one up.

To start, click **Generate Sprite** in the **Add Sprite** box. This opens the **Generate Sprites** window. At the top you choose a source: **Expressions (Portrait)** or **Full-body**.

Fill in the window:

1. Pick an **Image Generation Connection** from the dropdown.
2. Add up to four **Reference Images** if you want the art to match a look. You can also tick the box to use the current avatar as a reference.
3. Write an **Appearance Description** of how the character looks. This is required.
4. Optionally turn on **Transparent sprite background**. Guksu requests native PNG transparency first. If the provider cannot return alpha, it chooses a saturated green, magenta, or cyan matte that least overlaps the colors in your **Appearance Description**, then removes that matte automatically.
5. Choose how many images to make with **Expression Count** (or **Pose Count** for full-body), then pick which expressions or poses to fill.
6. Click the **Generate** button.

When the images arrive, you review them. You can turn each one on or off, rename it, and crop it before saving. When you are happy, save the selected images into the character's sprite set.

On the **Full-body** source, if the character already has portrait expressions, you can tick **Match existing expression sprites**. This creates full-body poses that match each expression name you already have.

Two notes about AI generation:

- Generation can take a few minutes, even though the in-app text may suggest less. Slow AI services take longer. Please wait rather than starting over.
- On some devices, such as certain Android installs, AI sprite generation and background cleanup are not available. When that happens, the button is disabled and Guksu shows the reason on screen.

### Animated portrait sprites

On the **Expressions (Portrait)** source there is a checkbox called **Generate animated portraits**. Turning it on makes short moving clips instead of still pictures, then turns each clip into a looping GIF sprite. A GIF is an image file that plays a short animation. Animated portraits use a video connection instead of an image connection.

## Cleaning up sprite backgrounds

A sprite looks best when only the character shows and the background is see-through. Generated still sprites use native transparency when the provider supports it. Otherwise, Guksu removes a flat adaptive chroma matte with a soft edge and cleans its color out of hair, fabric, and other partially transparent pixels. Older white-background sprites remain supported.

### Clean one sprite by hand

Click a sprite's picture in the grid to open a cleanup editor. There you can erase the background, paint areas back, and check the result against dark, light, and checkerboard backdrops. You can undo, reset to the original, and apply your changes when done.

### Clean many sprites at once

The **Clean Backgrounds** button removes the background from every sprite currently showing in the grid.

1. Set the **Cleanup strength** slider. It runs from Soft to Aggressive, from 0 to 100, and starts at 35. A higher value removes more of the background but can bite into the character.
2. Click **Clean Backgrounds** and confirm.

After a batch cleanup, Guksu keeps a safety copy. A line reads "Last cleanup has a restore point" with an **Undo Cleanup** button. Click it to put every affected sprite back the way it was.

Background cleanup works on PNG, JPG, JPEG, WEBP, and AVIF images. It does not work on GIF or SVG files.

Automatic cleanup examines the image before choosing an engine. The fast built-in matte cleanup handles flat chroma and legacy white backgrounds first. If the border is not actually uniform, Guksu can use the optional AI background remover as a fallback when it is installed. The manual cleanup editor remains the safest option for a busy scene or a subject whose colors are nearly identical to the background.

## Exporting sprites

You can save a character's sprites to your computer as a zip file. A zip is a single file that holds many files together.

1. Open the **Sprites** tab.
2. Click **Export** in the **Add Sprite** box.
3. Choose **Expressions only** or **Full-body only** to export the current category, or **All sprites** to export everything.

The download is one folder named after the character, holding the sprite image files.

## How sprites show up in your chat

Uploading sprites is only half the job. You also decide when and how they appear during a chat. This happens in the chat settings, not in the character editor.

### Roleplay Mode

In **Roleplay Mode**, the optional **Expression Engine** agent drives sprite display. Download it from **Agents → Download Agents**, then add it to the chat. It reads the mood of each message and picks a matching expression sprite. See [Downloadable Agents Reference](../agents/built-in-agents.md) for details.

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
