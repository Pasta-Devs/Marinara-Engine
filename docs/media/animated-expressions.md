# Animated Expressions

Animated expressions are short looping animations used as a character's portrait sprites. A sprite is the standing character art Marinara shows during a chat. A normal expression sprite is a still image, such as a happy face. An animated expression plays in its place and is saved as a GIF, an image file that loops a short animation on its own.

Marinara makes one in two steps. It asks a **Video Generation** account for a short clip of the expression, then converts the clip into a looping GIF on your computer. Once saved, it works like any other sprite. The downloadable **Expression Engine** agent shows it when the scene calls for that emotion. See [Character Sprites](../characters/sprites.md) and [Downloadable Agents Reference](../agents/built-in-agents.md).

## Before you start

You need two things.

1. A video account. See [Scene Video Generation](scene-video.md) to add one.
2. ffmpeg on the computer that runs Marinara. ffmpeg is a free media tool that converts the clip into a GIF.

If ffmpeg is missing, generation fails at once with this message:

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

Install ffmpeg so your system can find it, or set the `FFMPEG_PATH` environment variable to the full path of the ffmpeg program. An environment variable is a setting you give the server before it starts.

## Generate animated expressions

You use the same window as for still sprites.

1. Open the **Character Editor** for a character, or the **Persona Editor** for a persona.
2. Open the **Sprites** tab, then the **Facial Expressions** category.
3. Click **Generate Sprite**. The **Generate Sprites** window opens.
4. Check **Generate animated portraits**. The window switches to animated mode. The image picker becomes a video picker, the grid controls for sprite sheets disappear, and Marinara makes one expression at a time.
5. Pick your video account.
6. Fill in **Appearance Description** so the service knows how the character looks.
7. Pick the expressions to generate.
8. Click **Generate Animated Portrait** for one expression, or **Generate Animated Portraits** for several.

While it runs you see "Generating animated portrait GIFs...". When it finishes, review the results and click the save button to add them to the character or persona. If one expression fails, Marinara keeps the finished ones and lists the failed names so you can retry them.

Animated expressions take longer than still sprites, because they are made one at a time. Start with a few.

With **Expose media prompts before sending** on (**Settings → Generations → Overall Generations**), Marinara pauses so you can read and edit each prompt before it goes to the service.

## Length and shape

Every animated expression is a tall portrait clip at 9:16, which you cannot change. To change how long each clip runs, open **Settings → Generations**, find **Video Generation** and set **Animated expression length**. The default is 3 seconds. The range is 1 to 8 seconds. Marinara saves a small looping GIF, 512 pixels wide. A shorter clip gives a smaller file and a tighter loop.

## Backgrounds are not removed

Still sprites can have their background cleaned away so the character floats over the scene. Animated expressions skip that cleanup. In animated mode the checkbox **Prefer clean transparent-style background** only adds a hint to the video prompt. Its help says "GIF transparency is not guaranteed." The review step notes that background cleanup, sheet slicing and frame cropping are skipped for GIF output. An animated expression may keep a visible background. Ask for a plain background in **Appearance Description** for a cleaner look.

## Troubleshooting

- **Generation fails with a message about ffmpeg**: install ffmpeg or set `FFMPEG_PATH`. See [Before you start](#before-you-start).
- **The picker says no video accounts were found**: add one first. See [Scene Video Generation](scene-video.md).
- **The Generate Sprite button is disabled**: on some devices, such as some Android and Termux installs, Marinara cannot load its image library. That turns off all sprite generation, including animated expressions.
- **The saved GIF still shows a background**: this is expected. See [Backgrounds are not removed](#backgrounds-are-not-removed).

## Related guides

- [Character Sprites](../characters/sprites.md)
- [Scene Video Generation](scene-video.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
