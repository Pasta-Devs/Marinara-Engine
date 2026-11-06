# Image Style Profiles

A style profile is a reusable "house style" that shapes every image prompt before Marinara sends it to your image service. Use it to make avatars, portraits, selfies, backgrounds, illustrations and sprites look consistent. This guide shows how to pick, edit and test one.

## What a style profile is

Every generated image starts as a text prompt: avatars, portraits, Conversation selfies, scene backgrounds, illustrations and sprites. A style profile is a saved set of rules Marinara adds to that prompt. It can add positive words (what you want), negative words (what you want to avoid) and a preferred prompt style. You pick one profile as the app-wide default. You can override it for one chat or one image model.

To find the editor, open **Settings → Generations → Image Generation** and scroll to **Style Profiles**.

## The built-in profiles

Marinara has 10 built-in style profiles. **Auto** is the default. You can edit any of them and reset a built-in profile to its original values at any time.

Terms used below:

- SDXL is Stable Diffusion XL, a popular open image model you can run on your computer or through a cloud service.
- A checkpoint is one trained image model file. Illustrious, Pony and NovelAI are examples named here.
- Danbooru is a large anime image website. Its short comma-separated tags, like "1girl, long hair, smile", became a common way to prompt anime image models.

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

The default profile applies to every image unless a chat or image model overrides it.

1. Open **Settings → Generations → Image Generation → Style Profiles**.
2. Open the **Default style** list.
3. Pick a profile.

Your choice saves at once, and new images use it.

## Cloning and customizing a profile

You can edit a built-in profile in place, or use **Clone** to keep the original and build your own.

1. Open the **Editing** dropdown and pick the profile closest to what you want.
2. Click **Clone**. Marinara makes a copy, selects it for editing, and immediately makes the copy your app-wide default style.
3. Change the **Name** field to something you will recognize.
4. Pick a **Prompt grammar** (explained in the next section).
5. Fill in **Style text** with a plain description of the look you want. When an AI writes the image prompt, as the Illustrator, selfies and Noodle do, it follows your Style text instead of copying it. Other images, such as avatars, may get the Style text added as written.
6. Add **Positive tags** (words to include) and **Negative tags** (words to avoid).
7. Open the **Per-image tags** section to add extra tags for each image kind (avatar, portrait, selfie, background, illustration, sprite).
8. Your clone became the app-wide default in step 2. To hand that role back to another profile, open **Default style** and pick the profile you want.

Two buttons help you manage profiles:

- **Reset** works only on built-in profiles. It restores that built-in profile to its original values.
- **Delete** works only on profiles you created, and only while more than one profile exists.

## Prompt grammar modes

**Prompt grammar** tells Marinara how the image model prefers to read a prompt. Pick the mode that matches your model.

- **Hybrid**: a mix of sentences and tags. A safe general choice.
- **Danbooru tags**: short comma-separated Danbooru-style tags. Best for anime SDXL checkpoints like Illustrious, Pony, and NovelAI.
- **Tags**: short comma-separated keywords, without the Danbooru convention.
- **Natural language**: plain sentences. Best for models that read prose, such as DALL-E and Z-Image Turbo models.

## The Test bench

The **Test bench**, inside the Style Profiles editor, previews exactly what Marinara would send, with no real image made.

1. Pick an **Image kind** (for example, portrait or background).
2. Type a rough prompt into **Sample input**.
3. Read the **Final positive prompt** and **Final negative prompt** boxes.

The Test bench also shows a short note about cleanup. When it changes nothing, it says "No cleanup needed for this sample." When it edits your prompt, it says how many duplicate or misplaced fragments it cleaned.

## How Marinara cleans the prompt

Before any image request leaves Marinara, it compiles your prompt with the active profile. The compiler:

- removes near-duplicate tags, such as a repeated quality tag;
- moves simple negative phrases like "avoid text" or "no watermark" into the negative prompt;
- keeps your own wording for background, illustration and selfie images, but distills your words to short visual tags it recognizes for portrait, avatar and sprite images; and
- adds the profile's per-image tags for the kind of image being made.

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

Marinara can pick a style profile from three places. The most specific choice wins.

1. A profile chosen for the current chat or game.
2. The style profile set on the image model, under **Local image defaults** in its editor.
3. The global **Default style** in **Settings**.

The **Local image defaults** section appears only for AUTOMATIC1111 / SD Web UI, ComfyUI and NovelAI. For every other service the choice falls through to the global **Default style**. To set a per-model profile, open the image model, expand **Local image defaults** and pick a profile in the style profile list. Leave it on **Use global default** to follow the global choice. When Marinara can guess a good profile from the model's name, it shows a "Use ..." button that applies it in one click.

## Related guides

- [Image Generation Providers and Setup](image-providers.md)
- [Illustrator Agent](illustrator-agent.md)
- [Selfies](../conversation/selfies.md)
