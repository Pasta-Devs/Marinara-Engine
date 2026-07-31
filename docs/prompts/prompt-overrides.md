# Prompt Overrides for Image and Video

This guide covers **Prompt Overrides**, the editors that change the templates Marinara Engine uses to write prompts for image and video generation. It shows where they live, what you can edit, and how to save a custom template safely.

## What Prompt Overrides are

A **Prompt Override** is a reusable template for a media prompt. When Marinara generates an image or a video, it first builds a text prompt for the image or video model. Prompt Overrides let you edit those templates.

This feature is only about picture and video prompts. It does not change the text prompt sent to your chat model during a conversation or roleplay. That is a common mix-up. To change the prompt that goes to a chat model, use a Prompt Preset and Generation Parameters instead. See [Preset Editor and Prompt Manager](presets.md) and [Generation Parameters](generation-parameters.md).

Some terms used below:

- A **sprite** is a piece of character art, such as a facial expression or a full-body pose.
- A **storyboard** is a set of illustrated frames generated from a Game Mode turn or a completed Roleplay episode.

## Where to find them

The editors live in the app settings.

1. Open **Settings**.
2. Click the **Generations** tab.
3. Scroll to the **Prompt Overrides** area, described as "Reusable image and video prompt templates."

You should see two collapsible editors there.

## The two editors

Click an editor title to expand it.

**Video Generation Prompt Overrides** edits reusable templates for Game and Gallery scene videos, Conversation Call character clips, and animated Expression portraits. Each video prompt template controls how one kind of clip is described to the video model.

**Image Generation Prompt Overrides** edits the templates used by image, sprite, Game, and prompt-builder systems. This covers Conversation selfies, Game NPC portraits, scene art, storyboard prompts, the **Noodle Post Image** template for Noodle posts, and other registered image builders. Each image prompt template controls how one kind of picture is described to the image model.

So between the two editors you can adjust the prompts for portraits, selfies, sprites, scene art, storyboards, and video clips.

## Editing a template

Each editor works the same way. Follow these steps.

1. Open the editor you want.
2. Pick a template from the **Registered prompt** dropdown. The list depends on which editor you opened.
3. Check the status pill next to the dropdown. It reads **Default** when no custom template is saved. It reads **Custom active** when your saved template is in use. It reads **Custom paused** when your template is saved but turned off.
4. Read the short description under the dropdown so you know what this template does.
5. Under **Available variables**, click any variable chip to insert it into the template. Variables use the `${name}` form, for example `${charName}`.
6. Edit the text in the **Template** box.
7. Check the **Rendered preview** box below it. The preview fills your template with example values so you can see the result.
8. If the preview shows an **Unknown variables** warning, fix the misspelled variable. A variable name that is not on the **Available variables** list will not be filled in.
9. Click **Save**.

You should see a "Prompt override saved" message and the status pill should change to **Custom active**.

## Keeping a template without using it

The **Apply this override** toggle sits below the preview. Its help text reads "Turn this off to keep the template saved without using it." Turn it off to store your draft while the feature keeps using the built-in default. The status pill then reads **Custom paused**.

## Going back to the built-in template

Click **Reset to Default** to drop your custom template and use the built-in one again. If a saved override exists, the app asks you to confirm first. The status pill returns to **Default**.

## When overrides take effect

A Prompt Override only matters for features that actually generate images or video, such as Game assets, Conversation selfies and calls, sprites, and Noodle post images. Those features also need an image or video generation connection set up first. Without a working generation connection, nothing runs and the template is never used. See [Image Generation Providers and Setup](../media/image-providers.md) and [Scene Video Generation](../media/scene-video.md).

## Related guides

- [Image Generation Providers and Setup](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
- [Image Style Profiles](../media/style-profiles.md)
- [Noodle Settings and Chat Carryover](../noodle/settings.md)
- [Preset Editor and Prompt Manager](presets.md)
- [Generation Parameters](generation-parameters.md)
