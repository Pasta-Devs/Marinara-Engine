# Music DJ: Spotify, YouTube, and Local Music

**Music DJ** plays background music that matches your scene. This guide shows how to connect Spotify, YouTube or your own audio files, use the music player, and use music in Game Mode and Conversation.

## What Music DJ is

**Music DJ** is an optional downloadable agent. An agent is a helper that runs in the background of a chat. After each reply, it can read the mood of the scene and play matching music.

Before you start: open **Agents**, select **Agent Organizer** and install **Music DJ**. It is off after installation. Turn it on for a chat like any other agent. It works in Roleplay chats, in Game Mode through a separate toggle ([Music DJ in Game Mode](#music-dj-in-game-mode)), and in Conversation through the **Music** command ([The Conversation Music command](#the-conversation-music-command)).

It plays from three sources.

| Source | Account needed | Cost | Best for |
| --- | --- | --- | --- |
| **Spotify** | Your own Spotify account, and Spotify Premium to play | Free to set up, Premium to play | Real, named songs on your own devices |
| **YouTube** | A free Google API key | Free | Playback with no login and no Premium |
| **Custom** | None | Free | Your own audio files |

The active source shows as a small **Music Player** pinned in the top bar. On phones and narrow windows it becomes a small floating round widget you can drag.

You set up Music DJ in one shared place. Open the right-side **Agents** panel, then **Music DJ**. You can also click the gear icon on the mini player (tooltip **Music DJ setup**).

### Choose a music source

In the **Music DJ** editor, the **Music Player** field has three buttons: **Spotify**, **YouTube** and **Custom**. A line under them shows what is live, for example "Visible player: Spotify. Saved provider: Spotify." This choice is shared across the whole app, not saved per chat. The folder that **Custom** plays from can differ for each chat or character: see [Use a different folder for a chat or character](#use-a-different-folder-for-a-chat-or-character).

## Set up Spotify

Spotify uses your own free Spotify developer app. You paste only a **Spotify Client ID**. There is no client secret.

1. In the **Music DJ** editor, find **Spotify Connection**.
2. Open the **Spotify Developer Dashboard** from the link shown in the app.
3. Create a new app and select "Web API".
4. In the app's Redirect URIs, add the exact redirect address Marinara shows in step 3 of the in-app setup box. A redirect address is where Spotify sends you after you log in.
5. Copy the **Client ID** and paste it into **Spotify Client ID**.
6. Save the agent, then click **Connect Spotify Account**.

A Spotify login and permission window opens. After you approve, it shows a short success page and closes. Marinara shows a green **Connected to Spotify** pill. **Disconnect** removes the saved connection.

> **Note:** Spotify Premium (the paid plan) is required for play, pause, skip and volume. A free account can connect. Tokens refresh automatically.

If it did not work: on another machine the login window can fail (see below). Otherwise check that the redirect address matches exactly.

### Spotify devices

Spotify plays through a device, such as your phone, the desktop Spotify app or an in-app player.

- On desktop, click the laptop icon on the mini player (**Enable Marinara player** or **Use Marinara player**) to turn the browser tab into a Spotify device named "Marinara Engine". Streaming in the tab needs Premium.
- On mobile, the player prefers your phone's own Spotify device, so play runs on the phone and not in a background tab.
- If a device does not allow remote volume, the slider is replaced by **Use device volume**. Use the device's own volume buttons.

### Spotify on another machine

Spotify accepts only secure `https://` redirect addresses or the loopback address `http://127.0.0.1` (the same computer). If Marinara runs on another machine over plain `http`, the login window may fail. Two fixes:

- While connecting, open "Browser couldn't reach the callback?" under **Connect Spotify Account**. Copy the full address from the failed window, paste it in the box and click **Complete connection**.
- Or set a fixed redirect address as an environment variable (a server setting read at startup):

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

See the [Server Configuration Reference](../CONFIGURATION.md).

### Choose where Spotify picks songs (Roleplay)

When Music DJ runs in a Roleplay chat, its card has a **Spotify source** list.

- **Liked Songs**: pick from your saved tracks first.
- **Playlist**: stay inside one playlist, chosen in the **Playlist** list.
- **Artist**: search around one artist, typed in the **Artist** field.
- **Any Spotify**: let the DJ use Spotify search when it fits.

## Set up YouTube

YouTube mode needs a free YouTube Data API key. An API key is a secret code that lets Marinara use a service for you. No YouTube login and no Premium are needed.

1. In the **Music DJ** editor, find **YouTube Connection**.
2. Open the **Google Cloud Console** from the link in the app and create or pick a project.
3. Enable the **YouTube Data API v3**.
4. Go to Credentials, Create credentials, API key.
5. Paste the key into **YouTube Data API Key**.
6. Click **Save Key**. The button then reads **Update Key** and a green "API key configured" pill appears. **Remove** deletes the key.

Leave the key unrestricted, or restrict it only by API to YouTube Data API v3. Do not restrict it by HTTP referrer. Search runs on the server, so a referrer limit would block it. The app says the free quota (about 100 searches a day) is plenty for a personal DJ. That figure comes from the app's text and may change. Your key stays on the server, encrypted.

## Use your own music files

Custom mode plays audio files from the machine that runs Marinara. Supported types are `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` and `.webm`.

In the **Music DJ** editor, find **Custom Music Library**. It has one switch, **Use Game Assets music folder**.

- **On**: Custom mode reads audio you uploaded to Game Assets, Marinara's asset library for Game Mode. Use **Game Assets music folder** to pick a folder. Type `music` for the whole library or a subfolder such as `music/combat`. **Open Folder** opens it on the server machine.
- **Off**: Custom mode reads a folder on the server device. Use **Select Folder** to open a picker on the server machine, or paste the path into **Default music folder on this device**. Every chat without a folder of its own uses this one.

Playing from a folder outside Game Assets needs local access on the server. Saving a typed folder path needs the same access as the folder picker. From another device without a login or admin secret, both can be blocked. See [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md).

### Use a different folder for a chat or character

A chat or a character can have its own music folder, so each story plays its own soundtrack. A character's folder plays in every chat where that character is the only character.

1. Open the chat and its **Chat Settings**.
2. In the **Music DJ** settings, with the **Custom** player selected, open **Apply to** and choose where the folder is saved.
3. Click **Choose Folder**, or paste the path into **Music folder on this device**.

| Apply to | Which chats use the folder |
| --- | --- |
| **This chat** | Only this chat. A branch starts with the same folder and can change it. |
| The character's name | Every chat where that character is the only character. Shown only in a chat with one character. |
| **All chats (default)** | Every chat without a folder of its own. This is the default folder from the **Music DJ** editor. |

Music DJ uses the first folder it finds: this chat's folder, then the character's folder, then the default. A group chat never uses a character's folder. A chat or character folder plays even when the default source is Game Assets.

While a chat plays from Game Assets (it has no folder on this device of its own), **This chat** also shows **Game Assets Music Folder**. Type a subfolder of Game Assets, such as `music/combat`, to play it in this chat only. Leave it empty to use the default.

**In use:** shows the folder this chat plays and where it comes from: **This chat**, **From** and the character's name, or **Default**.

- **Use default** removes this chat's folder. The chat then plays the character's folder, or the default.
- **Unlink from** and the character's name removes the character's folder from every chat.

The same **Apply to** choice appears when you add Music DJ to a chat. A chat's own folder is left out of chat exports, settings profiles and **Export Profile** files. Agent exports leave out the default and character folders. Each path points to files on this server, so it means nothing on another one.

## Use the music player

The **Music Player** is a pill in the top bar on desktop and a draggable widget on mobile. To show or hide it, open **Settings → General → App Behavior** and toggle **Music Player**. It is on by default. With it on and Music DJ not installed, the player reads **Download Music DJ Agent to configure** and offers an **Agent Organizer** button.

On a fresh profile the source starts as **YouTube**. Change it with the round source switch on the player (tooltip "Switch to ... player"), the **Music Player** buttons in the editor, or a chat's **Music DJ** settings.

The player shows the track's cover or thumbnail, title and artist or channel. Controls depend on the source.

- **Spotify**: shuffle, **Previous**, play or pause, **Next**, repeat, volume with mute, **DJ**, the laptop **Marinara player** button and the **Music DJ setup** gear. When Spotify is not connected, the player reads "Spotify not connected", and tapping it opens **Music DJ setup**.
- **YouTube**: play or pause, an arrow that opens a small 16:9 video panel, **Stop**, and volume with mute.
- **Custom**: play or pause and volume.

## DJ Mari: AI playlist maker

The **DJ** button on the Spotify mini player ("DJ Mari composes a playlist for you!") builds a themed playlist. DJ Mari asks your connected AI model to build it from your persona, your most-used character and recent chats across all conversations. It adds the matched songs to a new Spotify playlist named "DJ Mari" plus today's date, and starts it.

It needs two things.

- A model assigned to the **Music DJ** agent. Without one you see "Configure a model connection on the Music DJ agent before using DJ Mari." See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
- At least 25 matched Spotify songs. It picks up to 50. With fewer than 25, it asks you to add more Liked Songs and try again.

On success you see "DJ Mari playlist is ready" with an **Open playlist** button.

## Music DJ in Game Mode

Game Mode has its own background music from Game Assets. To use Music DJ instead, turn on the **Music DJ** toggle in Game setup ("Use the Music DJ for this game instead of local music assets"). It is off by default. You then get the same **Spotify**, **YouTube** and **Custom** choices and fields as in Roleplay.

With Spotify, the server builds a short list of real candidate songs after each scene from your chosen source, and the AI picks one. This stops it from inventing a song. Game Mode plays one looping song at a time. To get a fresh pick for the current scene, open **Game controls** and choose **Retry Music DJ**. See [The Game's controls](../game/getting-started.md#the-games-controls).

## The Conversation Music command

In Conversation you cannot add Music DJ as an agent. Characters play songs through the **Music** command instead.

1. Open the chat's **Commands** section and turn on the master **Commands** toggle.
2. Turn on **Music** ("Let characters play songs through the active Music Player").

A character can then name a song for Spotify, or describe a track for YouTube, and Marinara plays it through the active source. This works even when Music DJ is not enabled anywhere. It needs only Spotify connected or a YouTube key saved. If Spotify is not connected or lacks playback permission, a Spotify song command does nothing and shows no error.

## Troubleshooting

- **The mini player is missing**: turn on **Music Player** in **Settings → General → App Behavior**.
- **Spotify plays nothing**: playback needs Spotify Premium and an active Spotify device. Open the desktop app on a device, or click **Enable Marinara player** on desktop.
- **The Spotify login window fails on another machine**: use the "Browser couldn't reach the callback?" paste box, or set `SPOTIFY_REDIRECT_URI` on the server.
- **YouTube search fails**: confirm **YouTube Data API v3** is enabled for your project and the key is not restricted by HTTP referrer. If you hit the daily quota, try the next day or use another key.
- **Custom music will not play from a device folder, or a typed folder path will not save, over remote access**: both need local access on the server. See [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md).
- **A chat plays the wrong folder**: check **In use:** in the chat's **Music DJ** settings. **This chat** wins over the character's folder, so click **Use default** to follow the character again.
- **A character's song command does nothing in Conversation**: connect Spotify or save a YouTube key, and check that the **Commands** and **Music** toggles are on.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Conversation Mode: Getting Started](../conversation/getting-started.md)
