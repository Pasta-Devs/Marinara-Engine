# Backgrounds Made by Illustrator

The **Illustrator** agent can paint backgrounds for your story: one when you ask, one each time the story reaches a new place, rain, snow or fog versions of a background when the weather changes, and dawn, day, sunset or night versions when the time of day changes. This guide covers all of them, and how Illustrator reuses pictures you already have instead of painting new ones.

For the pictures you upload and pick by hand, see [Background Library](../appearance/chat-backgrounds.md). For how a chat chooses which picture to show (the Background agent, pinned places and gallery pictures), see [Backgrounds That Follow the Story](../roleplay/backgrounds.md).

## Before you start

- Install **Illustrator** from **Library → Agents**. See [Illustrator Agent](illustrator-agent.md).
- Give it an image model: set the **Images** job in the **Defaults** box on the Connections page, or pick one on Illustrator's **Open Setup** screen. See [Image Generation Providers and Setup](image-providers.md).

Painted backgrounds work in Roleplay and Game chats, not Conversation. In Conversation the app says "Scene background generation is available in Roleplay and Game modes."

## Paint a background now

1. Open **Chat Settings** with the sliders button in the chat, and expand **Gallery**.
2. Click **Background**. It shows **Generating...** while it works.
3. When it finishes, the new picture is added to your Background Library and shown behind the chat. "Background generated." confirms it.

You don't need to add Illustrator to the chat for this. It runs once and starts no automatic runs.

Marinara builds the prompt from the scene: in a game this includes the genre, setting, place, weather and time of day. The picture uses the **Backgrounds** canvas size, 1280 by 720 pixels unless you change it under **Settings → Media → Image Generation**.

If it did not work: "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." means no image model was found. Set one as described under **Before you start**. If the **Background** button is missing, Illustrator is not installed.

## A new background for each new place

With this on, Illustrator paints a background when the story reaches a place that has none, saves it to your library and shows it.

1. Add **Illustrator** to the chat: **Chat Settings → Agents**, turn on **Enable Agents**, then add **Illustrator** from **Misc Agents**.
2. On the **Illustrator** card, turn on **Generate Scene Backgrounds**.

Illustrator looks at the scene on its **Image Run Interval** (every 5 messages unless you change it). To have it check every reply instead, use [Decision model checks](#check-every-reply-with-a-decision-model). In Game Mode, the **Game Illustrator** switch covers backgrounds too.

### Reusing pictures you already have

Before Illustrator paints a new place, it looks for a picture you already have, in this order:

1. A background pinned to that place, in the chat or in a character's gallery. See [Pin a background to a place](../roleplay/backgrounds.md#pin-a-background-to-a-place).
2. A library picture whose name, or a tag of two or more words, appears in the World State location. For example, `generated-guest-bedroom.png`, or a picture tagged `guest bedroom`, serves "Smith House, guest bedroom".
3. Without a World State location, the place name Illustrator's prompt model writes is matched the same way.

Case, accents and "'s" don't matter, and the most specific name wins over a plain `bedroom.png`. If one fits, it is shown (in the story's weather, when that version exists) and nothing is painted. Only a place with no match gets a new picture.

If nothing matches by name, and you turned on **Reuse a library background that looks like the place** on the Illustrator card, a [decision model that reads pictures](../connections/decision-models.md#features-that-look-at-pictures) looks at up to 4 library pictures that share a word with the place and shows one that matches. Only when none does is a new one painted. It is off by default and greyed out without such a model.

To make sure a place keeps its picture, name the file after the place (`kitchen.png` for "Kitchen"), or give it a tag of two or more words, such as `smith house kitchen` (see [Tag a background](../appearance/chat-backgrounds.md#tag-a-background)). One-word tags like `kitchen` or `night` are ignored here, because they usually describe how a picture looks.

## Weather versions of backgrounds

With this on, the background follows the story's weather. When it starts raining at the inn, Illustrator repaints the inn's background with rain on the windows. Indoors, the moving rain falls only behind the window glass, never across the room.

1. Open **Chat Settings → Agents → Illustrator**.
2. Turn on **Weather Versions of Backgrounds**.

It needs an image model that can start from a picture. Most can, including OpenAI, Gemini, NovelAI and ComfyUI with an image input. With one that can't, the picture stays as it is.

What happens:

- Each picture and weather is painted **once**. When the weather changes back, or the story returns to the inn in the rain, the saved version is shown again at no cost.
- The version is saved next to the original as `name--wx-rain.png`. The other kinds are `storm`, `snow`, `blizzard`, `hail`, `fog`, `sand`, `ash`, `embers`, `blossom` and `aurora`, plus `clear` for a dry copy of a picture first made in bad weather. Unusual weather gets a version in the story's own words: a meteor shower is `name--wx-meteor-shower.png`.
- Clear, sunny, cloudy, windy and other light weather keep the plain picture.
- It reads the weather from the **World State** agent, or from a Decision model check (below).
- It covers every background in your library, whether you picked it, the Background agent did or Illustrator painted it, plus pinned places and gallery backgrounds that follow a character. The **Background** agent picks among your plain pictures, and the matching weather version is shown when one exists.

### Windows: where the moving weather falls

The first time an indoor picture gets a weather version, Illustrator also asks the image model where the picture's windows are. It saves the answer as a small black and white stencil, and every weather version of that room shares it. The moving weather (rain lines, snowflakes, petals) is then drawn only on the glass.

- A room with no windows gets no moving weather, only the weather's colour and lightning flashes.
- An aurora, a meteor shower and other weather with nothing falling stay still: the picture shows them, and nothing moves over it.
- Stencils are kept in `backgrounds/weather-masks` in your data folder.

### Remake a weather picture or its windows

While the chat shows a weather version, **Chat Settings → Agents → Illustrator** has a row under **Weather Versions of Backgrounds** named after the weather, such as **This rain picture**:

- **Remake picture** paints this weather version again from the plain picture.
- **Remake windows** asks the image model for the window stencil again. Use it when rain falls on the cushions or misses a window.
- **No moving weather** turns the stencil off for this room. Its weather versions show only the weather's colour and lightning. **Remake windows** brings it back.

If it did not work: check that the chat's World State shows a **Weather** (or that the weather check below is on), and that **Illustrator** is added to the chat with an image model.

## Time of day versions of backgrounds

With this on, the background follows the story's clock. When night falls at the inn, Illustrator repaints the inn's background at night: a dark sky outside, the lamps and candles lit. The place, the layout and the camera stay the same; only the light changes.

1. Open **Chat Settings → Agents → Illustrator**.
2. Turn on **Time of Day Versions of Backgrounds**.

Like weather versions, it needs an image model that can start from a picture.

What happens:

- There are four times: **dawn**, **day**, **sunset** and **night**. The World State time decides which: a clock (`7:40 PM`, `21:15`) wins, else words such as "dusk", "midnight" or "early morning". Before 5 AM and from 8 PM is night, 5 to 7 AM dawn, 7 AM to 5 PM day, 5 to 8 PM sunset.
- A picture is taken to show the time it was painted at. Illustrator remembers that for the pictures it paints. For other pictures, a time word in the file name or a tag counts (`tavern-night.png`, `#sunset`); anything else counts as day. So a daytime picture gets a night version, and a picture painted at night gets a day version, never a second night one.
- Each picture and time is painted **once** and shown again for free. Versions are saved next to the original as `name--tod-night.png` (also `--tod-dawn`, `--tod-day` and `--tod-sunset`).
- With weather versions also on, one picture covers both: rain at night is `name--wx-rain--tod-night.png`, painted once from the plain picture. When only the weather changes the time stays, and the other way round.
- The time is checked after every reply, not only on Illustrator's run interval, so the night picture shows as soon as the World State clock reaches night. Only the time does this: a new place still waits for Illustrator's run (or the new-place check below).
- The drawn sky tint, sun, moon and stars step back over a time of day version, since the picture already has its own sky.
- Without a World State time, a Decision model check can tell (below).

While the chat shows a time of day version, the same row as weather pictures appears, such as **This night picture**, with **Remake picture**.

In your Background Library, versions sit under their plain picture: its card shows how many there are, and opening it lists them under **Weather and time of day versions**.

## Check every reply with a Decision model

Illustrator normally looks at the scene only on its run interval, so a new place can wait a few replies for its background. A [Decision model](../connections/decision-models.md), a small yes-or-no model, can check every reply instead.

Before you start: pick a Decision model in the **Defaults** box on the Connections page, and turn on **Generate Scene Backgrounds**, **Weather Versions of Backgrounds**, **Time of Day Versions of Backgrounds**, or any mix.

1. Open **Chat Settings → Agents → Illustrator**.
2. Under **Decision Model Checks**, pick one check, such as **The scene moved to a new place**, **The weather changed** or **The time of day changed**, or all of the ones that are on, such as **New place, weather and time of day changes**. Only checks for settings that are on are listed. It is **Off** by default.

After each reply:

- The new-place check asks whether the latest message moves the scene to a new place. A yes gets the place a background, reusing one you have when it can. The prompt model only writes a new background after a yes.
- The weather check asks whether the weather changes in the latest message. A yes shows or paints the weather version of the current background. Without a World State weather, the Decision model also picks the kind of weather.
- The time of day check asks whether the time of day changes in the latest message. A yes shows or paints the time of day version of the current background. Without a World State time, the Decision model also picks dawn, day, sunset or night.
- The checks only add chances to act. Illustrator's own run and World State location changes still count.
- With no answer (no model, a timeout or an error), the check is skipped.

If it did not work: with no Decision model chosen, the list is greyed out and says where to pick one.

## Review the prompt before it is sent

1. Open **Settings → Media → Generation Defaults**.
2. Turn on **Expose media prompts before sending**.

A **Review Image Prompt** window then opens before each image request, painted backgrounds included. Edit the prompt and negative prompt, then click **Generate** to send or **Cancel** to stop. The text you type is sent exactly as written.

## Related guides

- [Backgrounds That Follow the Story](../roleplay/backgrounds.md): which picture a chat shows, pinned places and gallery backgrounds.
- [Background Library](../appearance/chat-backgrounds.md): upload, tag and organize pictures, and blur.
- [Illustrator Agent](illustrator-agent.md): scene illustrations, clips and the run interval.
- [The Chat Gallery](../chats/chat-gallery.md): the Gallery section and its buttons.
- [Decision Models](../connections/decision-models.md)
