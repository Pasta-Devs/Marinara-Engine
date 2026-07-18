# Animated Expressions

This guide explains animated expressions in Guksu Motor: short looping animations used as a character's portrait sprites. A sprite is the standing character art Guksu shows for a character during a chat. Animated expressions make those portraits move instead of sitting still.

## What animated expressions are

A normal expression sprite is a still image, such as a happy face or an angry face. An animated expression is a short looping animation that plays in place of that still image. Guksu saves each one as a GIF sprite. A GIF is an image file that loops a short animation on its own.

Guksu makes an animated expression in two steps. First it asks a **Video Generation** connection to create a short video clip of the expression. Then it converts that clip into a looping GIF sprite on your machine.

Once saved, an animated expression works like any other sprite. The downloadable **Expression Engine** agent picks it and shows it when the scene calls for that emotion. See [Character Sprites](../characters/sprites.md) for how sprites are shown, and [Downloadable Agents Reference](../agents/built-in-agents.md) for the Expression Engine.

## Before you start

You need two things set up before you can generate animated expressions.

1. A **Video Generation** connection. This is a saved link to a provider that can make video. See [Scene Video Generation](scene-video.md) to add one.
2. ffmpeg installed on the machine running Guksu. ffmpeg is a free media tool that converts the video clip into a GIF sprite.

If ffmpeg is not found, generation fails right away with this message:

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

To fix this, install ffmpeg and make sure your system can find it. You can also set the `FFMPEG_PATH` environment variable to the full path of the ffmpeg program. An environment variable is a setting you give the server before it starts.

## Turning on animated portraits

You generate animated expressions from the same modal you use for still sprites.

1. Open the **Character Editor** for your character, or the **Persona Editor** for a persona.
2. Go to the **Sprites** tab, then the **Facial Expressions** category.
3. Click **Generate Sprite**. The **Generate Sprites** window opens.
4. Check the box labeled **Generate animated portraits**. The window switches to animated mode:
   - The connection picker changes from **Image Generation Connection** to **Video Generation Connection**.
   - The grid controls for still sprite sheets disappear.
   - Guksu now generates one expression at a time instead of a full sheet.
5. Pick your **Video Generation Connection** from the dropdown.
6. Fill in the **Appearance Description** so the provider knows how the character looks.
7. Pick which expressions to generate.
8. Click **Generate Animated Portrait** for one expression, or **Generate Animated Portraits** for several.

While it runs, you should see the message "Generating animated portrait GIFs...". Each expression becomes a short video first, then Guksu converts it into a GIF sprite.

When generation finishes, review the results and click the save button to add them to the character or persona. If one expression fails, Guksu keeps the finished ones. It lists the failed names so you can retry them.

## Duration and shape

Every animated expression is a tall portrait clip. The shape is fixed at 9:16 (portrait) and you cannot change it.

You can change how long each clip runs. Open **Settings** and find the **Video Generation** section. The setting is called **Animated expression length**. It defaults to 3 seconds. You can set it from 1 to 8 seconds.

Guksu saves the final result as a small looping GIF, 512 pixels wide. A shorter clip gives a smaller file and a quicker, tighter loop.

## Transparency caveat

Still sprites can have their background cleaned away so the character floats over the scene. Animated expressions are different. Guksu does not run background cleanup on them.

In animated mode the transparent-background checkbox is labeled **Prefer clean transparent-style background**. This checkbox only adds a hint to the video prompt. Its help text says clearly: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

The review step confirms the same thing. It shows this note: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." So an animated expression may keep a visible background. Ask for a plain background in your **Appearance Description** if you want a cleaner look.

## What to expect

Animated expressions take longer than still sprites. Guksu generates them one expression at a time, not in a batch. Picking many expressions at once can take a while, so start with a few.

If you turned on **Expose media prompts before sending** (in **Settings**, in the **Image Generation** section), Guksu pauses at a prompt review step. You can read and edit each prompt before Guksu sends it to the provider. Leave this setting off to skip the review.

## Troubleshooting

Generation fails with a message about ffmpeg. Install ffmpeg and make sure the server can find it, or set the `FFMPEG_PATH` environment variable. See "Before you start" above.

The dropdown says no video generation connections were found. Add a **Video Generation** connection first. See [Scene Video Generation](scene-video.md).

The **Generate Sprite** button is disabled. On some devices Guksu cannot load its image library, which turns off all sprite generation, including animated expressions. This happens on some Android and Termux installs.

The saved GIF still shows a background. This is expected. Animated expressions skip background cleanup. See "Transparency caveat" above.

## Related guides

- [Character Sprites](../characters/sprites.md)
- [Scene Video Generation](scene-video.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
