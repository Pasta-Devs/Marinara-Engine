# Prompt Overrides for Image and Video

Prompt Overrides are editors for the templates Marinara uses to write prompts for image and video models. Use one to change how portraits, selfies, sprites, scene art, storyboards or video clips are described to the model.

They do not change the prompt sent to your chat model. For that, use a preset. See [Preset Editor and Prompt Manager](presets.md) and [Generation Parameters](generation-parameters.md).

A sprite is a piece of character art, such as an expression or a pose. A storyboard is a set of illustrated frames from a Game Mode turn or a finished Roleplay episode.

Before you start: Prompt Overrides only matter for features that generate images or video, and those need an image or video generation account first. Without one, the template is never used. See [Image Generation Providers and Setup](../media/image-providers.md) and [Scene Video Generation](../media/scene-video.md).

## Find the editors

1. Open **Settings**.
2. Click the **Generations** tab.
3. Scroll to **Prompt Overrides** ("Reusable image and video prompt templates").

Two editors are there. Click a title to expand it.

| Editor | Templates it covers |
| --- | --- |
| **Video Generation Prompt Overrides** | Game and Gallery scene videos, Conversation video messages, Conversation Call character clips, animated Expression portraits. |
| **Image Generation Prompt Overrides** | Conversation selfies, Game NPC portraits, scene art, storyboard prompts, the **Noodle Post Image** template, and other image builders. |

## Editing a template

1. Open an editor.
2. Pick a template from **Registered prompt**. The list depends on the editor.
3. Check the status pill beside it, and read the short description under the dropdown.
4. Under **Available variables**, click a variable chip to insert it. Variables look like `${charName}`.
5. Edit the text in the **Template** box.
6. Check **Rendered preview**. It fills your template with example values.
7. Fix any **Unknown variables** warning. A name that is not on the **Available variables** list is not filled in.
8. Click **Save**.

You see "Prompt override saved", and the pill changes to **Custom active**.

| Status pill | Meaning |
| --- | --- |
| **Default** | No custom template is saved. |
| **Custom active** | Your saved template is in use. |
| **Custom paused** | Your template is saved but turned off. |

## Keep a template without using it

Turn off **Apply this override**, below the preview. Its help says "Turn this off to keep the template saved without using it." Marinara keeps using the built-in template, and the pill reads **Custom paused**.

## Go back to the built-in template

Click **Reset to Default**. If an override is saved, Marinara asks you to confirm. The pill returns to **Default**.

## Related guides

- [Image Generation Providers and Setup](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
- [Image Style Profiles](../media/style-profiles.md)
- [Noodle Settings and Chat Carryover](../agents/noodle-settings.md)
- [Preset Editor and Prompt Manager](presets.md)
- [Generation Parameters](generation-parameters.md)
