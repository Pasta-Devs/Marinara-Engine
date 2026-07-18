# Image Style Profiles

This guide explains image style profiles in Guksu Motor. A style profile is a reusable "house style" that shapes every image prompt before Guksu sends it to your image provider. Use it to make avatars, portraits, selfies, backgrounds, illustrations, and sprites look consistent.

## What a style profile is

Guksu Motor can generate many kinds of images: character and persona avatars, portraits, Conversation-mode selfies, scene backgrounds, in-scene illustrations, and character sprites. Every one of those images starts as a text prompt.

A style profile is a saved set of rules that Guksu adds to that text prompt. It can add positive words (what you want), negative words (what you want to avoid), and a preferred prompt style. This keeps a single look across every image, so you do not have to retype the same style words each time.

You pick one profile as the app-wide default. You can override it for a single chat or a single image connection. All of that is explained below.

To find the editor, follow these steps.

1. Open **Settings**.
2. Open the **Generations** tab.
3. Find the **Image Generation** section.
4. Scroll to **Style Profiles**.

## The built-in profiles

Guksu ships with 10 built-in style profiles. **Auto** is the default. You can edit any of them, and you can reset a built-in profile back to its original values at any time.

Some terms used below:

- SDXL means Stable Diffusion XL. It is a popular open image model you can run on your own computer or through a cloud service.
- A checkpoint is one trained image model file. People download different checkpoints for different art looks. Examples named in these profiles are Illustrious, Pony, and NovelAI.
- Danbooru is a large anime image website. Its short comma-separated tags (like "1girl, long hair, smile") became a common way to prompt anime image models.

The built-in profiles are:

- **Off**: adds no house style. Your prompt is sent almost as you wrote it.
- **Auto**: infers a consistent look from the character, game, scene, and selected image model. This is the default profile.
- **Anime**: general anime-style tags for clean character art.
- **Danbooru / Illustrious**: Danbooru-style tags aimed at SDXL anime checkpoints such as Illustrious, Pony, and NovelAI.
- **Realistic SDXL**: natural-language realism for SDXL models.
- **Photorealistic**: photo-style prompting with believable skin, lighting, and materials.
- **Cinematic**: dramatic lighting and strong composition for key art.
- **Digital Painting**: concept-art brushwork and designed lighting.
- **Painterly Fantasy**: soft painterly fantasy illustration.
- **Z-Image Turbo Narrative**: compact prose for Z-Image Turbo models that read plain sentences well.

## Changing the global style

The global default profile applies to every generated image unless a chat or connection overrides it. To change it, follow these steps.

1. Open **Settings**, then the **Generations** tab, then **Image Generation**, then **Style Profiles**.
2. Open the **Default style** dropdown.
3. Pick the profile you want to use app-wide.

Your choice saves right away. New images use the profile you picked.

## Cloning and customizing a profile

You can edit a built-in profile in place, but the **Clone** button lets you keep the original and build your own version. To create and customize a profile, follow these steps.

1. Open the **Editing** dropdown and pick the profile closest to what you want.
2. Click **Clone**. Guksu makes a copy, selects it for editing, and immediately makes the copy your app-wide default style.
3. Change the **Name** field to something you will recognize.
4. Pick a **Prompt grammar** (explained in the next section).
5. Fill in **Style text** with a plain description of the look you want.
6. Add **Positive tags** (words to include) and **Negative tags** (words to avoid).
7. Open the **Per-image tags** section to add extra tags for each image kind (avatar, portrait, selfie, background, illustration, sprite).
8. Your clone became the app-wide default in step 2. To hand that role back to another profile, open **Default style** and pick the profile you want.

Two buttons help you manage profiles:

- **Reset** works only on built-in profiles. It restores that built-in profile to its original values.
- **Delete** works only on profiles you created, and only while more than one profile exists.

## Prompt grammar modes

The **Prompt grammar** dropdown tells Guksu how the image model prefers to read a prompt. Pick the mode that matches your image model. There are four modes.

- **Hybrid**: a mix of sentences and tags. A safe general choice.
- **Danbooru tags**: short comma-separated Danbooru-style tags. Best for anime SDXL checkpoints like Illustrious, Pony, and NovelAI.
- **Tags**: short comma-separated keywords, without the Danbooru convention.
- **Natural language**: plain sentences. Best for models that read prose, such as DALL-E and Z-Image Turbo models.

## The Test bench

The **Test bench** section lets you preview exactly what Guksu would send, without generating a real image. Open it inside the Style Profiles editor. To use it, follow these steps.

1. Pick an **Image kind** (for example, portrait or background).
2. Type a rough prompt into **Sample input**.
3. Read the **Final positive prompt** and **Final negative prompt** boxes.

The Test bench also shows a short note about cleanup. When it changes nothing, it says "No cleanup needed for this sample." When it edits your prompt, it says how many duplicate or misplaced fragments it cleaned.

## How Guksu cleans the prompt

Before any image request leaves Guksu, it compiles your prompt with the active profile. The compiler does a few things:

- It removes near-duplicate tags, such as a repeated quality tag.
- It moves simple negative phrases (like "avoid text" or "no watermark") into the negative prompt.
- It keeps your own wording for background, illustration, and selfie images. For portrait, avatar, and sprite images, it distills your words down to short visual tags it recognizes.
- It adds the profile's per-image tags for the kind of image being made.

## Before and after example

Say you pick the **Danbooru / Illustrious** profile, set **Image kind** to portrait, and type this into **Sample input**:

```
masterpiece, masterpiece, red-haired knight, no watermark
```

The Test bench then shows this **Final positive prompt**:

```
detailed eyes, solo, upper body, portrait, looking at viewer, anime screencap, masterpiece, best quality, absurdres
```

Three things happened:

- "no watermark" moved out of the positive prompt and into the **Final negative prompt**. The cleanup note counts this change.
- The profile added its own style tags, its portrait per-image tags, and its quality tags. The "masterpiece" in the result comes from the profile's own tags, not from your typed words.
- Your typed words were distilled. For portrait images, the compiler keeps only fragments it recognizes as clear visual cues. "red-haired knight" is not one of them, so it was dropped.

If your subject words disappear for a portrait, avatar, or sprite, try the **illustration** image kind instead. That kind keeps your own wording.

## Setting precedence: chat, connection, then global

Guksu can pick a style profile from three places. The most specific choice wins. The order is:

1. An explicit profile chosen for the current chat or game.
2. The **Style Profile** set on the image connection (under **Local Image Defaults** in the connection editor).
3. The global **Default style** you set in **Settings**.

The **Local Image Defaults** section appears only for local Stable Diffusion connections (AUTOMATIC1111 / SD Web UI, ComfyUI, and NovelAI). For every other provider, the choice falls straight through to the global **Default style**. To set a per-connection profile, open the connection, expand **Local Image Defaults**, and pick a profile in the **Style Profile** dropdown. Leave it on **Use global default** to follow the global choice. When Guksu can guess a good profile from the connection's model name, it shows a "Use ..." button that applies that profile in one click.

## Related guides

- [Image Generation Providers and Setup](image-providers.md)
- [Illustrator Agent](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
