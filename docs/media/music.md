# Music DJ: Spotify, YouTube, and Local Music

This guide explains how to play background music in Marinara Engine using the **Music DJ**. You will learn how to connect Spotify, YouTube, or your own local music files. You will also learn how the music player, the **DJ Mari** playlist maker, and Game Mode music work.

## What Music DJ is

**Music DJ** is an optional downloadable agent. An agent is a helper that runs automatically in the background of a chat. Open **Agents**, select **Download Agents**, and install **Music DJ** before configuring it. After each reply, Music DJ can read the mood of the scene and play matching background music.

**Music DJ** can play music from three sources:

- **Spotify**: controls playback on your own real Spotify account and devices.
- **YouTube**: searches YouTube and plays the result in a small in-app player. No login is needed.
- **Custom**: plays your own audio files from a folder on the machine that runs Marinara.

Whichever source is active shows up as a small **Music Player** pinned in the top bar of the app. On phones and narrow windows it becomes a small floating round widget you can drag.

**Music DJ** is off by default after installation. You turn it on for a chat like any other agent. It is available in **Roleplay** chats, and in **Game** mode through a separate toggle (see Music DJ in Game Mode below). In **Conversation** mode you use the **Music** command instead (see The Conversation Music command below).

You set up **Music DJ** in one shared place. Open the right-side **Agents** panel, then open **Music DJ**. You can also click the gear icon on the mini player. Its tooltip reads **Music DJ setup**.

### Choosing a music source

In the **Music DJ** editor, the **Music Player** field has three buttons: **Spotify**, **YouTube**, and **Custom**. The help text reads "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."

Under the buttons, a line shows which source is live now, for example "Visible player: Spotify. Saved provider: Spotify." This source choice is shared across the whole app. It is not saved per chat.

Here is a quick way to pick:

| Source | Account needed | Cost | Best for |
|---|---|---|---|
| **Spotify** | Your own Spotify account plus Spotify Premium for playback | Free to set up, Premium to play | Real, named songs on your own devices |
| **YouTube** | A free Google API key | Free | Playback with no login and no Premium |
| **Custom** | None | Free | Your own local audio files |

## Spotify setup

Spotify uses your own free Spotify developer app. You only paste a **Spotify Client ID**. There is no client secret to enter.

Open the **Music DJ** editor and find the **Spotify Connection** field. Then follow these steps.

1. Open the **Spotify Developer Dashboard** at the link shown in the app.
2. Create a new app and select "Web API".
3. In the app's Redirect URIs, add the exact redirect address that Marinara shows you in step 3 of the in-app setup box. A redirect address is the web address Spotify sends you back to after you log in.
4. Copy the **Client ID** from your Spotify app and paste it into the **Spotify Client ID** field.
5. Save the agent, then click **Connect Spotify Account**.

A Spotify login and permission window opens. After you approve, the window shows a short "Spotify Connected!" page and closes. Back in Marinara you should see a green **Connected to Spotify** pill. A **Disconnect** button removes the saved connection.

The app shows this note: "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." A free Spotify account can connect, but play, pause, skip, and volume control need Spotify Premium. Premium is the paid Spotify plan.

### Spotify device notes

Spotify plays through a device, such as your phone, your desktop Spotify app, or an in-app player.

On desktop you can turn the browser tab itself into a Spotify device. Click the laptop icon on the mini player. Its tooltip reads **Enable Marinara player** or **Use Marinara player**. This registers a Spotify device named "Marinara Engine" so music streams into the tab. In-app streaming also needs Spotify Premium.

On mobile, the player prefers your phone's own Spotify device. So tapping play plays music on your phone, not in the background browser tab.

If a Spotify device does not allow remote volume, the volume slider is replaced by a **Use device volume** button. Use your device's own volume buttons instead.

### Spotify on another machine

Spotify only accepts secure `https://` redirect addresses or the loopback address `http://127.0.0.1`. Loopback means the same computer. If Marinara runs on another machine over plain `http`, the login window may fail to load.

Two options help here:

- While connecting, open the "Browser couldn't reach the callback?" section under the **Connect Spotify Account** button. Copy the full address from the failed window and paste it in the box, then click **Complete connection**.
- Or set a fixed redirect address with an environment variable on the server. An environment variable is a server setting read at startup.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

See the [Server Configuration Reference](../CONFIGURATION.md) for how to set environment variables.

## YouTube setup

YouTube mode needs a free YouTube Data API key. An API key is a secret code that lets Marinara use a service on your behalf. No YouTube account login and no Premium are needed.

Open the **Music DJ** editor and find the **YouTube Connection** field. Then follow these steps.

1. Open the **Google Cloud Console** at the link shown in the app and create or pick a project.
2. Enable the **YouTube Data API v3**.
3. Go to Credentials, then Create credentials, then API key.
4. Paste the key into the **YouTube Data API Key** field.
5. Click **Save Key**. Once saved, the button reads **Update Key** and a green "API key configured" pill appears. A **Remove** link deletes the key.

Leave the key unrestricted, or restrict it only by API and pick YouTube Data API v3. Do not restrict it by HTTP referrer. Search runs on the server, so a referrer restriction would block it.

The app shows this note: "The free quota (~100 searches/day) is plenty for a personal DJ." Quota means the daily usage limit. This figure comes from the app's own text and may change over time. Your key stays on the server and is stored encrypted.

## Custom (local) music

Custom mode plays your own audio files from the machine that runs Marinara's server. Supported file types are `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac`, and `.webm`.

Open the **Music DJ** editor and find the **Custom Music Library** field. It has one switch: **Use Game Assets music folder**.

- Switch on: Custom mode reads audio you uploaded to Game Assets. Game Assets is Marinara's built-in asset library for Game Mode. Use the **Game Assets music folder** field to pick a folder. Type `music` for the whole music library, or a subfolder like `music/combat`. The **Open Folder** button opens that folder on the server machine.
- Switch off: Custom mode reads a folder on the server device. Use **Select Folder** to open a folder picker on the server machine, or paste the path into the **Music folder on this device** field.

Roleplay and Game chat setup show the same selected source. If you chose a folder on the server device, the chat's Music DJ settings show that saved path and a **Choose Folder** button instead of asking for a Game Assets path.

Playing from a folder outside Game Assets needs local access on the server. If you use Marinara from another device without a password or admin secret, this one feature can be blocked. See [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md).

## Using the music player

The **Music Player** appears as a small pill in the top bar on desktop, or a draggable floating widget on mobile. You can hide or show it with a setting.

Open **Settings**, go to the **General** tab, and find the **App Behavior** section. Toggle **Music Player** on or off. The help text reads "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings." This toggle is always available and is on by default. If it is enabled without Music DJ installed, the desktop or mobile player surface instead reads **Download Music DJ Agent to configure** and provides a **Download Agents** button.

On a fresh profile the visible source starts as **YouTube**. You can change the source three ways:

- Use the small round source switch on the player. Its tooltip reads "Switch to ... player".
- Use the **Music Player** buttons in the **Music DJ** editor.
- Use a chat's **Music DJ** settings.

The player shows the current track's cover art or thumbnail, title, and artist or channel. Controls depend on the source.

- Spotify: shuffle, **Previous**, play or pause, **Next**, repeat, a volume slider with mute, the **DJ** button, the laptop **Marinara player** button, and the **Music DJ setup** gear.
- YouTube: play or pause, an expand arrow that opens a small 16:9 video panel, a **Stop** button, and a volume slider with mute.
- Custom: play or pause and volume, using your local files.

If Spotify is not connected yet, the player reads "Spotify not connected" and tapping it opens **Music DJ setup**.

### Per-chat Spotify source

When **Music DJ** runs in a **Roleplay** chat, its settings card shows a **Spotify source** dropdown with four choices.

- **Liked Songs**: pick from your saved tracks first.
- **Playlist**: keep choices inside one Spotify playlist. A **Playlist** dropdown lists your playlists.
- **Artist**: search only around a named artist. An **Artist** text field appears.
- **Any Spotify**: let the DJ use Spotify search when it fits.

## DJ Mari: AI playlist maker

The **DJ** button on the Spotify mini player builds a themed playlist for you. Its tooltip reads "DJ Mari composes a playlist for you!"

**DJ Mari** asks your connected AI model to build a playlist based on your persona, your most-used character, and recent chats across all your conversations. It then adds the matched songs to a new Spotify playlist named "DJ Mari" plus today's date, and starts playing it.

**DJ Mari** needs two things:

- A model connection assigned to the **Music DJ** agent. Without one you see "Configure a model connection on the Music DJ agent before using DJ Mari." See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
- Enough matched Spotify songs. It needs at least 25 songs and picks up to 50. If it finds fewer than 25, it asks you to add more Liked Songs and try again.

On success you see a "DJ Mari playlist is ready" message with an **Open playlist** button.

## Music DJ in Game Mode

Game Mode has its own built-in background music from Game Assets. To use **Music DJ** instead, turn on the **Music DJ** toggle in Game setup. Its description reads "Use the Music DJ for this game instead of local music assets." This toggle is off by default.

When on, you get the same **Spotify**, **YouTube**, and **Custom** choices and the same per-source fields as in Roleplay.

Spotify works a little differently in Game Mode. After each scene, the server builds a short list of real candidate songs from your chosen source. The AI then picks one song from that list. This stops the AI from inventing a song that does not exist. Game Mode picks one looping song at a time.

On a turn, the action menu includes a **Retry Music DJ** button that forces a fresh pick for the current scene.

## The Conversation Music command

In **Conversation** mode you cannot add **Music DJ** as an agent. Instead, characters can play songs through the **Music** command.

Open the chat's **Commands** section. Turn on the master **Commands** toggle first. Then turn on the **Music** toggle. Its description reads "Let characters play songs through the active Music Player."

Now a character can name a song for Spotify, or describe a track for YouTube, and Marinara plays it through the active source. This works even when **Music DJ** is not enabled anywhere. It only needs Spotify connected or a YouTube key saved.

If Spotify is not connected or lacks playback permission, a Spotify song command does nothing and shows no error. So set up your source first if songs are not playing.

## Troubleshooting

- The mini player is missing. Turn on **Music Player** in **Settings**, **General** tab, **App Behavior** section.
- Spotify plays nothing. Playback control needs Spotify Premium and an active Spotify device. Open the desktop app on a device, or click **Enable Marinara player** on desktop.
- The Spotify login window fails on another machine. Use the "Browser couldn't reach the callback?" paste box, or set `SPOTIFY_REDIRECT_URI` on the server.
- YouTube search fails. Confirm the **YouTube Data API v3** is enabled for your project and the key is not restricted by HTTP referrer. If you hit the daily quota, try again the next day or use another key.
- Custom music will not play from a device folder over remote access. That folder needs local access on the server. See [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md).
- A character's song command does nothing in Conversation mode. Connect Spotify or save a YouTube key, and make sure the **Commands** and **Music** toggles are on.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Game Assets](../game/game-assets.md)
- [Conversation Mode: Getting Started](../conversation/getting-started.md)
