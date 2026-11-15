# Roleplay Backgrounds

A Roleplay chat shows a full-scene image behind your messages. You can let the **Background** agent pick it after each reply, make a new one by hand, or pin one image to a single chat. When the image changes, Marinara fades from the old one to the new one.

Image generation is not required. Without an image generation account, the backdrop is a solid color and the chat works as text.

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

If it did not work: with only one or two backgrounds, the agent keeps picking those. Add more to your library. See [Chat Backgrounds](../appearance/chat-backgrounds.md).

## Reuse pictures you already have

When Illustrator makes backgrounds on its own and the story moves to a new place, it first checks for a background you pinned to the place (see [Pin a background to a place](#pin-a-background-to-a-place)). In a pinned place it paints nothing. Otherwise it looks in your background library. A picture serves a place when its file name, or one of its tags of two or more words, appears in the World State location. For example, `john-bedroom.png` serves "Smith House, John's bedroom". Case, accents and "'s" don't matter, and the most specific name wins over a plain `bedroom.png`.

Without a World State location, the place name Illustrator writes for the new background is matched the same way. If a picture fits, it is shown and nothing is painted. Only a place with no match gets a new picture.

To make sure a place keeps its picture, name the file after the place (`kitchen.png` for "Kitchen"). A tag works too when it has two or more words, such as `smith house kitchen`; one-word tags like `kitchen` or `night` are ignored, because they usually describe how a picture looks.

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
