# Backgrounds That Follow the Story

A Roleplay chat shows a full-scene picture behind your messages. It can stay the same, or change as the story moves: the **Background** agent picks from your pictures, places you pin always show their own picture, and pictures in a character's gallery follow that character into every chat. When the picture changes, Marinara fades from the old one to the new one.

Image generation is not required for any of this. Without an image model, you pick from pictures you upload, and with no picture at all the backdrop is a solid colour.

## Backgrounds at a glance

| You want | Use | Guide |
| --- | --- | --- |
| One picture behind this chat | **Chat Background** | [Set a background for one chat](#set-a-background-for-one-chat) |
| The picture to change with the scene | The **Background** agent | [Let the Background agent pick](#let-the-background-agent-pick) |
| A place to always look the same | A pinned place | [Pin a background to a place](#pin-a-background-to-a-place) |
| A character's room in every chat they are in | A gallery background | [Backgrounds that follow a character](#backgrounds-that-follow-a-character) |
| New pictures painted for new places, weather and time of day | The **Illustrator** agent | [Backgrounds Made by Illustrator](../media/scene-backgrounds.md) |
| To upload, tag and sort your pictures, or blur them | The Background Library | [Background Library](../appearance/chat-backgrounds.md) |

When the story arrives somewhere, Marinara decides in this order: a pin for that place in this chat, then a gallery background that names the place, then the Background agent's pick. Pins and gallery places are matched against the **World State** location, so they switch the picture on their own only while the World State agent tracks where the story is. Without it, the Background agent still sees gallery backgrounds by their places. Illustrator paints a new picture only when none of these fits. Whichever picture wins, its weather or time of day version is shown when the library has one for the story's weather and time.

## Set a background for one chat

1. Open the chat. Then open **Settings → Appearance → Backgrounds**.
2. Under **Chat Background**, click **Browse library** and pick a picture.

It changes only that chat. To go back to the default, click **Remove** next to **Chat Background**. You can also pick one from **Chat Settings → Background** in the chat. No pictures yet? See [Import a background](../appearance/chat-backgrounds.md#import-a-background).

## Let the Background agent pick

The **Background** agent runs after each reply. It reads the scene and picks the picture that fits best from all your backgrounds. It only picks pictures you have; to paint new ones, use Illustrator.

1. Open your Roleplay chat and open **Chat Settings** with the sliders button.
2. Open **Agents** and turn on **Enable Agents**.
3. Add the **Background** agent.

The backdrop now changes on its own as the story moves between places. The agent reads text, not pictures, so it chooses by what each picture is called:

- **Library pictures** by their file name and tags, including ones in folders.
- **Gallery backgrounds** of the chat's characters and persona by the places they are labelled with (such as `dorm kitchen`) and their description.
- **Pinned places** in this chat, as names of the picture they pin.

A library picture whose file name is only random letters and numbers (such as `70c60b32-6b8c-….jpg`) and that has no tags is left out, because nothing says which place it shows. Give it a place tag or a clear name to make it pickable. When nothing listed shows the scene's place, the agent keeps the current picture instead of guessing.

**Chat Settings → Background** shows why the current picture was picked, under its preview. The line goes away when you pick a picture yourself.

If it did not work: with only one or two backgrounds, the agent keeps picking those. Add more to your library. If it is slow, check the agent's connection: it waits for other agents (such as Lorebook Keeper) when that connection runs one request at a time.

## Pin a background to a place

Use this when a place should always look the same: John's bedroom always shows `john-bedroom`, and your own bedroom always shows `my-bedroom`. When the story arrives at a pinned place, its picture shows, whatever the Background agent would have picked.

1. Open **Chat Settings** with the sliders button in the chat, and open **Background**.
2. Under **Pinned places**, click **Add place**.
3. Click the empty picture and choose the background. Type the place the way the story writes it, such as `John's bedroom`.
4. Optional: under it, add other names the story might use, separated by commas, such as `John's room, the master bedroom`.

Quicker: while the story is in a place and the right picture is showing, click **Pin this picture to "John's bedroom"**.

Pins need to know where the story is, so they use the **World State** agent's location (or World Maps). The bottom of the list shows **Story is at** and the place, and **Here** marks the pin in use.

### How places are matched

- The most specific name wins. `John's bedroom` and `{{user}}'s bedroom` never mix, and a plain `bedroom` pin fills in only for bedrooms nobody pinned.
- A word or two in between still counts: "John's guest bedroom" matches `John's bedroom`, unless another pin names that place exactly. It never reaches across a comma or another owner, so "John's house, Mara's bedroom" is not John's.
- `{{user}}` is your persona's name and `{{char}}` any character in the chat, so `{{user}}'s bedroom` matches "Alyssa's bedroom".
- "My" and "our" belong to whoever wrote the message. When John's reply says the story is in "my bedroom", that is John's bedroom; "your bedroom" in his reply is yours. In your own message, "your bedroom" is the character's when the chat has only one.
- Case, accents and apostrophes don't matter. Names match whole words: `John` never matches "Johnson".
- With **World Maps**, pick the place from the **World Maps place** list instead. A pinned building also covers its rooms that have no pin of their own.

### What a pin changes

- The picture shows once on arrival. If you pick a different background by hand while you are there, yours stays until the story moves on.
- In a pinned place, the Background agent can't switch the picture, and Illustrator doesn't paint a new background for it. With **Weather Versions of Backgrounds** or **Time of Day Versions of Backgrounds** on, the pinned picture still gets its rain, snow, fog or night version.

If it did not work: check that **Story is at** under the list shows the place, and that one of the pin's names appears in it word for word.

## Backgrounds that follow a character

A picture in a character's or persona's **Gallery** can be labelled as a background. It then shows up in every chat that character is in, with no pins to set in each chat.

1. Open the character's **Images → Gallery**. Click the tag button on a picture and choose **Use as background**.
2. Type the places it shows, separated by commas, such as `{{char}}'s bedroom, {{char}}'s room`. In a character's gallery `{{char}}` is that character; in a persona's, `{{user}}` is that persona. Leave it empty if the picture isn't one place.

The picture's tag button then reads **Background:** and its places. Click it to **Edit places** or **Remove background tag**.

In a chat with that character, **Chat Settings → Background** lists these pictures under **From character and persona galleries**. Click one to use it. The ones that name places also work like pinned places and are listed under **Pinned places** with "In John's gallery, follows them into every chat". A pin set in the chat itself wins over a gallery picture with the same place.

### Move a chat picture into a character's gallery

A background Illustrator painted in one chat can become a character's for good:

1. Open **Chat Settings → Gallery** in the chat.
2. On the picture, click the person button (**Add to a character's or persona's gallery**) and pick who it belongs to.

Its background label and places come along. The picture isn't copied, and it stays in their gallery when the chat is deleted. Exporting a character as **Marinara Native** keeps these labels.

Gallery backgrounds get weather versions too. The rain or snow version is saved in your Background Library as `gallery-…--wx-rain.png`.

## Related guides

- [Backgrounds Made by Illustrator](../media/scene-backgrounds.md): painting new places, weather and time of day versions, and window stencils.
- [Background Library](../appearance/chat-backgrounds.md): uploading, tags, folders and blur.
- [Character and Persona Galleries](../characters/galleries.md)
- [Roleplay Mode: Getting Started](getting-started.md)
