# Roleplay Backgrounds

A Roleplay chat shows a full-scene image behind your messages. You can let the **Background** agent pick it after each reply, make a new one by hand, or pin one image to a single chat. When the image changes, Marinara fades from the old one to the new one.

Image generation is not required. Without an image generation account, the backdrop is a solid color and the chat works as text.

Pins and gallery places switch the picture on their own only when Marinara knows where the story is: from the **World State** agent's location, or from **World Maps**. Without either, the Background agent still sees gallery backgrounds by their places.

## Set a background for one chat

Use this to keep one image behind the chat you have open, instead of letting the agent choose. It changes only that chat.

1. Open the chat. Then open **Settings → Appearance** and find **Backgrounds**.
2. Under **Chat Background**, pick an uploaded image or one of your game asset backgrounds.

You see the image behind your messages. To go back to the default, click **Remove** next to **Chat Background**.

No images yet? Upload one first. See [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Let the Background agent pick the backdrop

The **Background** agent is a helper that runs alongside replies. After each reply, it reads the current scene and picks the image that fits best from all your backgrounds. It picks existing images only. The **Illustrator** agent makes new ones automatically.

1. Open your Roleplay chat.
2. Open **Chat Settings** with the sliders button in the chat.
3. Open **Agents** and turn on **Enable Agents**.
4. Add the **Background** agent.

The backdrop now changes on its own as the story moves between places.

The agent reads text, not pictures, so it chooses by what each picture is called:

- **Library pictures** by their file name and tags, including ones in folders.
- **Gallery backgrounds** of the chat's characters and persona by the places they are labelled with (such as `dorm kitchen`) and their description.
- **Pinned places** in this chat, as names of the picture they pin.

A library picture whose file name is only random letters and numbers (such as `70c60b32-6b8c-….jpg`) and that has no tags is left out, because nothing says which place it shows. Give it a place tag or a clear name to make it pickable. When nothing listed shows the scene's place, the agent keeps the current picture instead of guessing.

**Chat Settings → Background** shows why the current picture was picked, under its preview. The line goes away when you pick a picture yourself.

If it did not work: with only one or two backgrounds, the agent keeps picking those. Add more to your library. If it is slow, check the agent's connection: it waits for other agents (such as Lorebook Keeper) when that connection runs one request at a time.

## Reuse pictures you already have

When Illustrator makes backgrounds on its own and the story moves to a new place, it first checks for a background you pinned to the place (see [Pin a background to a place](#pin-a-background-to-a-place)). In a pinned place it paints nothing new, only the pinned picture's weather and time of day versions when those are on. Otherwise it looks in your background library. A picture serves a place when its file name, or one of its tags of two or more words, appears in the World State location. For example, `john-bedroom.png` serves "Smith House, John's bedroom". Case, accents and "'s" don't matter, and the most specific name wins over a plain `bedroom.png`.

Without a World State location, the place name Illustrator writes for the new background is matched the same way. If a picture fits, it is shown and nothing is painted. Only a place with no match gets a new picture.

To make sure a place keeps its picture, name the file after the place (`kitchen.png` for "Kitchen"). A tag works too when it has two or more words, such as `smith house kitchen`; one-word tags like `kitchen` or `night` are ignored, because they usually describe how a picture looks.

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

In the **Backgrounds** picker, versions sit under their plain picture: its card shows how many there are. Press **Versions** next to the background count to show every version as a card of its own.

## Check every reply with a Decision model

Illustrator normally looks at the scene only on its run interval, so a new place can wait a few replies for its background. A [Decision model](../connections/decision-models.md), a small yes-or-no model, can check every reply instead.

Before you start: choose a Decision model in **Connections**, and turn on **Generate Scene Backgrounds**, **Weather Versions of Backgrounds**, **Time of Day Versions of Backgrounds**, or any mix.

1. Open **Chat Settings → Agents → Illustrator**.
2. Under **Decision Model Checks**, pick one check, such as **The scene moved to a new place**, **The weather changed** or **The time of day changed**, or all of the ones that are on, such as **New place, weather and time of day changes**. Only checks for settings that are on are listed. It is **Off** by default.

After each reply:

- The new-place check asks whether the latest message moves the scene to a new place. A yes gets the place a background, reusing one you have when it can. The prompt model only writes a new background after a yes.
- The weather check asks whether the weather changes in the latest message. A yes shows or paints the weather version of the current background. Without a World State weather, the Decision model also picks the kind of weather.
- The time of day check asks whether the time of day changes in the latest message. A yes shows or paints the time of day version of the current background. Without a World State time, the Decision model also picks dawn, day, sunset or night.
- The checks only add chances to act. Illustrator's own run and World State location changes still count.
- With no answer (no model, a timeout or an error), the check is skipped.

If it did not work: with no Decision model chosen, the list is greyed out and says where to pick one.

## Generate a background by hand

Marinara builds an image prompt from the scene (genre, setting, location, weather and time) and makes a new backdrop.

Before you start: install the **Illustrator** agent and set an image generation account for it, or mark one image generation account as the default. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md). You do not need to add Illustrator to the chat.

1. Open **Chat Settings** with the sliders button in the chat, and expand **Gallery**.
2. Click **Background**. It shows **Generating...** while it works, and the Gallery says "Illustrator is generating a background image for this scene."
3. Wait for it to finish. The new image is added to your background library and applied to the scene.

Manual generation uses the Illustrator agent's image account, then your default image generation account. It works in Roleplay and Game modes, not Conversation.

If it did not work: the message "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." means Marinara found no image account. Set one, then try again. If the **Background** button is missing, Illustrator is not installed.

## Pin a background to a place

Use this when a place in your story should always look the same: John's bedroom always shows `john-bedroom`, and your own bedroom always shows `my-bedroom`. When the story arrives at a pinned place, its picture shows, whatever the Background agent would have picked.

1. Open **Chat Settings** with the sliders button in the chat, and open **Background**.
2. Under **Pinned places**, click **Add place**.
3. Click the empty picture and choose the background. Type the place the way the story writes it, such as `John's bedroom`.
4. Optional: under it, add other names the story might use, separated by commas, such as `John's room, the master bedroom`.

Quicker: while the story is in a place and the right picture is showing, click **Pin this picture to "John's bedroom"**.

How places are told apart:

- The most specific name wins. `John's bedroom` and `{{user}}'s bedroom` never mix, and a plain `bedroom` pin fills in only for bedrooms nobody pinned.
- A word or two in between still counts: "John's guest bedroom" matches `John's bedroom`, unless another pin names that place exactly.
- `{{user}}` is your persona's name and `{{char}}` any character in the chat, so `{{user}}'s bedroom` matches "Alyssa's bedroom".
- "My" and "our" belong to whoever wrote the message. When John's reply says the story is in "my bedroom", that is John's bedroom; "your bedroom" in his reply is yours. In your own message, "your bedroom" is the character's when the chat has only one.
- Case, accents and apostrophes don't matter. Names match whole words: `John` never matches "Johnson".
- With **World Maps**, pick the place from the **World Maps place** list instead. A pinned building also covers its rooms that have no pin of their own.

What happens:

- The picture shows once on arrival. If you pick a different background by hand while you are there, yours stays until the story moves on.
- In a pinned place, the Background agent can't switch the picture, and Illustrator doesn't paint a new background for it.
- It needs the **World State** agent's location (or World Maps). The bottom of the list shows where the story is now, and **Here** marks the pin in use. Pins work in Roleplay chats.

If it did not work: check that **Story is at** under the list shows the place, and that one of the pin's names appears in it.

### Backgrounds that follow a character

A picture in a character's (or persona's) **Gallery** labeled as a background shows up in every chat that character is in, with no pins needed in each chat.

1. Open the character's **Gallery**, click the tag button on a picture and choose **Use as background**.
2. Type the places it shows, separated by commas, such as `{{char}}'s bedroom, {{char}}'s room`. In a character's gallery `{{char}}` is that character; in a persona's, `{{user}}` is that persona. Leave it empty if the picture isn't one place.

The ones that name places work like pinned places in every chat with that character, and are listed under **Pinned places** in **Chat Settings → Background**. A pin set in the chat itself wins over a gallery picture with the same name.

## Your library and blur

The images you pick from live in the same **Backgrounds** section. Importing, tags, renaming, deleting, the **Background Blur** slider and the default backdrop for new Roleplay chats are in [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Related guides

- [Chat Backgrounds](../appearance/chat-backgrounds.md): the upload library and appearance controls.
- [Scene Backgrounds](../media/scene-backgrounds.md): AI scene art made from your Gallery.
- [Roleplay Mode: Getting Started](getting-started.md): the Roleplay stage, sprites and HUD.
