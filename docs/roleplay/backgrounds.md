# Roleplay Backgrounds

A Roleplay chat shows a full-scene image behind your messages. You can let the **Background** agent pick it after each reply, make a new one by hand, or pin one image to a single chat. When the image changes, Marinara fades from the old one to the new one.

Image generation is not required. Without an image generation account, the backdrop is a solid color and the chat works as text.

## Set a background for one chat

Use this to keep one image behind the chat you have open, instead of letting the agent choose. It changes only that chat.

1. Open the chat. Then open **Settings → Appearance → Backgrounds**.
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

If it did not work: with only one or two backgrounds, the agent keeps picking those. Add more to your library. See [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Generate a background by hand

Marinara builds an image prompt from the scene (genre, setting, location, weather and time) and makes a new backdrop.

Before you start: install the **Illustrator** agent and set an image generation account for it, or mark one image generation account as the default. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md). You do not need to add Illustrator to the chat.

1. Open **Chat Settings** with the sliders button in the chat, and expand **Gallery**.
2. Click **Background**. It shows **Generating...** while it works, and the Gallery says "Illustrator is generating a background image for this scene."
3. Wait for it to finish. The new image is added to your background library and applied to the scene.

Manual generation uses the Illustrator agent's image account, then your default image generation account. It works in Roleplay and Game modes, not Conversation.

If it did not work: the message "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." means Marinara found no image account. Set one, then try again. If the **Background** button is missing, Illustrator is not installed.

## Weather versions of backgrounds

With this on, the background follows the story's weather. When it starts raining in the inn, Illustrator repaints the inn's background with rain on the windows. Indoors, the moving rain falls only behind the window glass, never across the room.

1. Open **Chat Settings** with the sliders button in the chat, and open **Agents → Illustrator**.
2. Turn on **Weather Versions of Backgrounds**.

What happens:

- Each picture and weather is made **once**. When the weather changes back, or the story returns to the inn in the rain, the saved version is shown again at no cost.
- The version is saved next to the original as `name--wx-rain.png`. The other kinds are `storm`, `snow`, `blizzard`, `hail`, `fog`, `sand`, `ash`, `embers`, `blossom` and `aurora`, plus `clear` for a dry copy of a picture first made in bad weather. The **Background** agent picks among your plain pictures and then shows the matching weather version when one exists.
- Unusual weather gets a version in the story's own words: a meteor shower is `name--wx-meteor-shower.png`, a blood moon `name--wx-blood-moon.png`.
- Clear, sunny, cloudy, windy and other light weather keep the plain picture.
- **Window stencil:** the first time an indoor picture gets a weather version, Illustrator also asks the image model where its windows are. It saves that as a small black and white stencil in `backgrounds/weather-masks`, and every weather version of that room shares it. The moving weather (rain lines, snowflakes, petals) is then drawn only on the glass. A room with no windows gets no moving weather, only the colour of the weather and lightning flashes.
- It reads the weather from the **World State** agent, or from the Decision model when **Decision Model Checks** includes the weather (see below). The Illustrator image model has to be able to start from a picture (most can, including OpenAI, Gemini, NovelAI and ComfyUI with an image input). Models that can't are skipped, and the picture stays as it is.
- It works for backgrounds in your library, whether you picked them, the Background agent did or Illustrator made them.

If it did not work: check that the chat's World State shows a **Weather** (or that the weather check below is on), and that **Illustrator** is added to the chat with an image model.

### Remake a weather picture or its windows

When the chat shows a weather version, **Chat Settings → Agents → Illustrator** shows a row under **Weather Versions of Backgrounds** named after the weather (for example **This rain picture**):

- **Remake picture** paints this weather version again from the plain picture.
- **Remake windows** asks the image model for the window stencil again. Use it when the moving weather falls on cushions or misses a window.
- **No moving weather** turns the stencil off for this room. Its weather versions then show no moving weather, only the weather's colour and lightning. **Remake windows** brings it back.

An aurora, a meteor shower and other weather with nothing falling stay still: the picture shows them, and nothing moves over it.

## Decision model checks for new places and weather

Illustrator normally looks at the scene only on its **Run Interval**, so a new place can wait a few replies for its background. With a [Decision model](../connections/decision-models.md), a small yes-or-no model, it can check every reply instead.

Before you start: pick a Decision model in the **Defaults** box on the Connections page, and turn on **Generate Scene Backgrounds**, **Weather Versions of Backgrounds**, or both.

1. Open **Chat Settings** with the sliders button in the chat, and open **Agents → Illustrator**.
2. Under **Decision Model Checks**, pick what to check: **The scene moved to a new place**, **The weather changed**, or both. It is **Off** by default.

What happens after each reply:

- The new-place check asks "The latest message moves the scene to a new place." A yes makes a new background, the same as when Illustrator asks for one. The Prompt Model only writes the background prompt after a yes.
- The weather check asks "The weather changes in the latest message." A yes shows or makes the weather version of the current background. Without a World State weather, the Decision model also picks the weather from the list of kinds above, or clear.
- The checks only add chances to act. Illustrator's own decision on its run interval and World State location changes still count.
- With no answer (no model, a timeout or an error), the check is skipped and Illustrator works as it does without it.

If it did not work: with no Decision model chosen, the list is greyed out and says where to pick one.

## Your library and blur

The images you pick from live in the same **Backgrounds** section. Importing, tags, renaming, deleting, the **Background Blur** slider and the default backdrop for new Roleplay chats are in [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Related guides

- [Chat Backgrounds](../appearance/chat-backgrounds.md): the upload library and appearance controls.
- [Scene Backgrounds](../media/scene-backgrounds.md): AI scene art made from your Gallery.
- [Roleplay Mode: Getting Started](getting-started.md): the Roleplay stage, sprites and HUD.
