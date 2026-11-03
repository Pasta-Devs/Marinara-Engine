# Conversation Audio and Video Calls

A call is a live screen, like a voice-chat app, where you talk to one or more characters by microphone or by typing. It sits on top of the normal Conversation chat while it runs. Calls exist only in Conversation Mode.

Calls is an optional package. Install **Calls** from **Agents → Agent Organizer**. If the catalog asks you to restart, stop Marinara and start it again the way you normally start it (see [Installation](../INSTALLATION.md)).

During a call, characters with a working Text to Speech (TTS, text turned into spoken audio) voice speak out loud. Characters without a voice reply as typed messages in the call chat. You can also show looping AI-made video clips of a character instead of a still avatar.

Marinara records your microphone or camera in your browser. Depending on the input mode (below), your speech is turned into text on your own computer or sent to the model you picked for the chat. Replies are spoken through your TTS service. When the call ends, a short summary goes back into the Conversation. The full transcript stays in separate call storage.

## What you need

- **Calls** installed.
- A Conversation chat with at least one character, and an account for the model that writes replies.
- **Audio/Video Calls** and **Call Audio Pipeline** turned on in the chat's settings.
- Optional: a Text to Speech account, so characters speak. Without it they reply as text.
- Optional: the default microphone mode needs a one-time Local Whisper download (see [Download Local Whisper](#download-local-whisper)). You can instead type in the call chat.

## Set up your first call

Before you start: you need a Conversation chat with at least one character, and an account for the model that writes the replies (see [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)).

1. Optional: set up Text to Speech (see [Set up Text to Speech](#set-up-text-to-speech)). Without it, every character joins as text only.
2. Open the chat, then open **Chat Settings → Agents → Calls**.
3. Turn on **Audio/Video Calls**. A call button appears next to the conversation name.
4. Turn on **Call Audio Pipeline**. No call can start without it, even if you only type or only listen. It also enables the microphone.
5. Pick an **Audio input mode** (below).
6. Click **Start call**.

If it did not work: when you see "Conversation call audio is not enabled in Chat Settings", **Call Audio Pipeline** is off. It is a global setting, so turning it on in one chat turns it on for all Conversation calls.

For a new chat, finish the setup wizard first, then open that chat's **Chat Settings**. The Calls settings show only when Calls is installed.

Two switches look alike but do different things:

- **Audio/Video Calls** shows the call button, so you can call a character.
- The **Calls** command lets characters ring you first. With it off you can still start calls yourself.

The master **Commands** switch in the same section must be on for in-call commands. The call itself can start with it off.

### Set up Text to Speech

Text to Speech decides which characters can speak and with which voice. Read [Text to Speech (TTS) Setup](../media/tts-setup.md) for the full walkthrough. In short, open **Connections**, click **Add account** and choose **Text to speech** If it is already listed under **On this device**, open it there. Then:

1. Turn on Text to Speech.
2. Choose a source: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** or **xAI Voice**.
3. Enter the API key or local server address for that source.
4. Pick a model and a voice.
5. Set **Voice option** to **One voice for all** or **Selected per character or persona**. Per-character voices make group calls easier to follow.
6. Save, then use the preview button to confirm you hear audio.

If a character has no voice Marinara can resolve, that character is text only for the call.

### Choose an Audio input mode

When **Call Audio Pipeline** is on, the **Audio input mode** list appears. If you are unsure, keep the default.

| Mode | What it does |
| --- | --- |
| **Mic recording + Local Whisper** (default) | Records while you are unmuted, ignores silence and turns your speech into text on your own computer. Best for Firefox. |
| **Browser speech recognition** | Uses the speech tool built into your browser. Support varies. Marinara falls back to Local Whisper when it is missing. |
| **Manual system dictation** | Only puts the cursor in the call text box so your operating system's dictation can type there. Marinara does not record. |
| **Provider-native audio/video** | Sends your recorded audio or video straight to the model, if the model accepts media. |

The camera and screen buttons need **Camera and screen input** on and work only in **Provider-native audio/video** mode. In other modes they show but stay disabled.

## Start, answer and end a call

**Start a call.** With calls on, a phone button sits next to the conversation name. Its tooltip is **Start call**, or **Open call** when a call is running. Click it and the call screen opens. Only one call can be active or ringing per chat. Starting another reopens the current one.

**Answer a call.** A character can ring you when the **Calls** command is on. In that chat, an **Incoming call** banner appears above the message box with **Decline call** and **Answer call**. Elsewhere in Marinara you get an incoming-call notification and a short ringing tone. Marinara never answers for you. Only characters that are available join: a character whose schedule or status is offline does not.

**End a call.** Click the red **End call** button on the call screen or on the minimized popout. A character can also leave or end the call with an in-call command. Marinara then stops recording and adds a card to the Conversation.

## The call screen

The stage shows one tile per participant, your persona and each available character, and highlights who is speaking. The call chat holds typed messages and text-only replies. Spoken lines are not repeated there. On desktop it is a side panel. On a phone it opens as a drawer with **Open call chat** and closes with **Close call chat**.

The call composer has a **Message in call** box, **Send**, an emoji, GIF and sticker picker and a quick model switcher. File attachments are not supported in call chat.

| Control | What it does |
| --- | --- |
| Microphone | Mutes or unmutes you. The tooltip changes with the mode, for example **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Provider-native audio/video mode with **Camera and screen input** on only. |
| **Share screen** / **Stop sharing screen** | Same rule as the camera. |
| **Character volume** | A mute button and a 0 to 100 slider. Default 100, saved in the browser. |
| **Soundboard** | A list of sounds with an **Upload** control. |
| **End call** | The red hang-up button. |

If you stay muted a while you see "You are muted! Remember to unmute yourself first if you want to talk."

If you leave the Conversation during a call, it shrinks into a floating popout with the chat name, elapsed time and **End call**. Click the popout to return. The call keeps running while you browse.

### Soundboard

The soundboard has four built-in sounds you cannot delete: **Soft Chime**, **Tap**, **Sparkle** and **Pop**. Click **Upload** to add your own (mp3, wav, ogg, webm or m4a, up to 8 MB each). You can delete your own uploads. Characters can play a sound with the soundboard command.

## Character Video Presence

This part is optional and advanced. **Character video presence** replaces a still avatar tile with a looping AI-made clip of the character. It is off by default. The switch is in **Chat Settings → Agents → Calls**.

Before you start: add a Video Generation account in **Connections**, and mark one as **Default for Videos** or pick one each time.

1. Open a character or persona editor.
2. Open the **Sprites** tab, then the **Clips** sub-tab.
3. Click **Generate Clips**, or **Upload extra** to add your own.
4. In the **Generate Call Clips** window, pick a **Video Generation Connection** and choose **Use avatar as reference**.
5. Pick the standard clips to make: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. You can also define one custom clip with a **Clip name** and an action description.

During a spoken turn, Marinara reads voice cues in a line, such as `[sighs]`, picks a matching reaction clip, then returns to Idle. A missing clip never blocks a call: the character shows a still avatar. A trimmed clip loops inside its trim range. See [Character Sprites (Expressions and Full-body)](../characters/sprites.md).

Two more switches appear under **Character video presence** when it is on:

- **Automatic video clips generation** (off by default) makes only **Idle** and **Talking** for a participant that needs them. Reaction and custom clips are never made automatically.
- **Custom clips** (off by default) lets a character rarely request a one-off clip in a live call and replay a ready custom clip. It is for special requests, not every mood.

Turning **Character video presence** off also turns off both. Clips here are reusable presence loops, not Gallery **Videos**, which hold scene videos.

## Speech-to-text setup (advanced)

Only needed for the **Mic recording + Local Whisper** mode, or if you want your own speech-to-text server.

### Download Local Whisper

Local Whisper turns your speech into text on the computer that runs Marinara, so your microphone audio does not leave it for transcription. The text is still sent to your model as part of the call. It is the most reliable microphone path for browsers with weak speech support, such as Firefox.

Before you start: install Calls. The section is hidden without it.

1. Open **Connections** and find **Speech to text** under **On this device**. If it is not listed, click **Add account** and choose **Speech to text**.
2. Find **Local speech model** on that page.
3. Choose a model:
   - **Whisper Tiny (Multilingual)**: about 180 MB to download and 350 MB of memory. Best for phones and older computers.
   - **Whisper Base (Multilingual)**: about 320 MB to download and 650 MB of memory. Better with messy speech.
4. Click **Download Whisper** and wait for the progress bar.
5. Restart Marinara completely before you use Calls.

A trash icon, **Delete Local Whisper**, removes the model. Uninstalling Calls also deletes downloaded Whisper models; reinstalling does not download one again until you choose it.

If it did not work: on a Lite build of Marinara you see "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." If you see a message about the "native ONNX runtime", the speech engine for your platform is missing. Reinstall dependencies with the same Node build you run Marinara with, then restart.

### Use your own speech-to-text server

If Local Whisper struggles with your language or accent, send your voice to another speech-to-text server instead. Any server that accepts the OpenAI speech-to-text format (the `/audio/transcriptions` address) works, whether you run it yourself or use a service such as OpenAI or Groq.

1. Open **Connections** and open **Speech to text** under **On this device**. If it is not listed, click **Add account** and choose **Speech to text**. It is hidden while Calls is not installed.
2. Enter the **Server URL**, for example `http://localhost:8000/v1`.
3. Enter an **API key** if the server needs one. It is saved encrypted and shown masked.
4. Enter the **Model** name your server uses. Leave it empty to send `whisper-1`.
5. Optional: enter a **Language** code such as `pl` or `de`. Leave it empty to let the server detect it.
6. Click **Test**. Marinara sends a one-second silent clip. You see "The server answered." or "The test failed."
7. Turn on **Use your own speech-to-text server**.

While it is on, **Mic recording + Local Whisper** sends your speech to this server, and you do not need to download Local Whisper. Your audio goes to that server, so use one you trust.

A server on the same computer works as is. A server on another computer in your network is refused unless you set `STT_LOCAL_URLS_ENABLED=true` in `.env` (see [Server Configuration Reference](../CONFIGURATION.md)).

If it did not work: read the message under **Test**. "Could not reach the speech-to-text server" means the address is wrong or the server is off. A message naming `STT_LOCAL_URLS_ENABLED` means the server is on another computer. A number comes from your server: 401 usually means a wrong API key, 404 a wrong address or model name. If calls still use Local Whisper, update Calls from **Agents → Agent Organizer**.

## Settings and defaults

**Per chat** settings apply to one chat. **Global** settings apply to every Conversation call.

| Setting | Scope | Default |
| --- | --- | --- |
| **Audio/Video Calls** | Per chat | Off |
| **Calls** (command) | Per chat | On |
| **Generate voice cues in [tags]** | Per chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

A global setting changed in one chat changes for every Conversation call. **Generate voice cues in [tags]** asks the model to add short cues such as `[whispering]`, `[laughing]` or `[sighs]` inside spoken lines. They shape how TTS reads the line and help pick reaction clips. Turn it off to keep spoken lines plain.

## Commands in a call

Characters use the same hidden commands in a call as in normal messages. Each needs its switch in **Chat Settings → Agents → Commands** and the master **Commands** switch on. See [Choose which Commands a character can use](getting-started.md#choose-which-commands-a-character-can-use). They run silently and are never spoken.

Two extras work in a call: **Soundboard** (a character plays a soundboard sound) and leave or end (a character leaves the call, or ends it for everyone). **Notes** and **Influence** appear only when the chat has a connected chat (see [Connected Chats](../chats/connected-chats.md)). A selfie needs a **Selfie model** (see [Selfies](selfies.md)). Some commands add a small entry to the call chat, such as "sent a selfie" with the image.

## The call-ended summary

When a call ends, a card appears in the Conversation. Its title is **Call Started**, **Incoming Call**, **Call Ended** (with the length), **Call Declined** or **Missed Call**. After **Call Ended**, if anything meaningful happened, Marinara writes a short summary in the background and adds it as hidden context the model can read. This keeps the model aware of the call without copying it into the visible chat.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Characters cannot hear me | Confirm **Call Audio Pipeline** is on and your browser allows the microphone for the Marinara page. On Firefox, or if browser speech does not work, download Local Whisper and use **Mic recording + Local Whisper**. |
| The browser speech option does nothing | Firefox lacks the Web Speech recognition that Chromium and Safari browsers have. Use **Mic recording + Local Whisper**, or **Manual system dictation**. |
| A character types instead of speaking | Check your Text to Speech settings and voice assignments. See [Text to Speech (TTS) Setup](../media/tts-setup.md). |
| The model misunderstands my speech | Try **Whisper Base (Multilingual)**, reduce noise, or use **Provider-native audio/video** if your model supports it. For a language Whisper handles poorly, [use your own speech-to-text server](#use-your-own-speech-to-text-server) and set its **Language**. |
| The camera or screen button is disabled | Use **Provider-native audio/video** mode and turn on **Camera and screen input**. Your model must also accept camera or screen input. |
| A character stops replying mid-call | Check the model account for the chat, then send a message in the call chat again. |
| The call does not work on my phone | The call chat opens with **Open call chat**. For speech, confirm TTS is set up. For the microphone, the same Local Whisper and permission steps apply. |

## Related guides

- [Text to Speech (TTS) Setup](../media/tts-setup.md)
- [Built-in Model Setup](../connections/local-model.md)
- [Character Sprites (Expressions and Full-body)](../characters/sprites.md)
- [Conversation Mode: Getting Started](getting-started.md)
