# Conversation Audio and Video Calls

This guide explains Conversation calls in Marinara Engine. You will learn how a call works, how to set one up, how to talk during a call, and how to fix common problems.

Calls exist only in Conversation Mode. Roleplay and Game chats do not have a call screen.

Calls is an optional agent package. Install **Calls** from **Agents → Download Agents** before following the setup below, then restart Marinara when the catalog asks.

## What a call is

A call gives you a live, Discord-style screen where you talk to one or more characters. It sits on top of the normal Conversation chat while the call runs.

During a call:

- Characters that have a working Text to Speech (TTS) voice speak their lines out loud. TTS means text turned into spoken audio.
- Characters without a voice reply as typed messages in the call chat.
- You answer by microphone or by typing.
- You can optionally see looping AI-generated video clips of a character instead of a still avatar.

A call is not a peer-to-peer phone call. Marinara records your local browser microphone or camera. It sends that input to the model you picked for that Conversation. It speaks replies through your TTS provider and stores the call data on your own machine.

When the call ends, Marinara writes a short summary of the audio call back into the normal Conversation. The full call transcript stays in separate call storage and is not copied message by message into the main chat.

## Before you start

To run a working voice call, set up these pieces in order. You can skip the steps marked Optional.

1. A Conversation-mode chat with at least one character.
2. A normal model connection selected for that chat. This is the model that writes the character replies during the call.
3. **Audio/Video Calls** turned on for that chat (see the section "Turn calls on for a chat" below).
4. **Call Audio Pipeline** turned on. This is required to start any call, even a call where you only type or only listen. It also enables microphone input.
5. Text to Speech set up so characters can speak. Without it, every character joins as text only.
6. Optional: Local Whisper downloaded from Connections after Calls is installed, if your browser cannot do reliable speech recognition (Firefox needs this).
7. Optional: a video connection and generated clips if you want **Character Video Presence**.
8. Optional: an image connection set as the chat Selfie Connection if you want characters to send selfies in the call.

### Set up Text to Speech

Text to Speech decides which characters can speak and which voice each one uses. It is a shared feature, so it is documented in its own guide.

For the full walkthrough, read [Text to Speech (TTS) Setup](../media/tts-setup.md). In short, you open **Connections** and then **Text to Speech**, then you:

1. Turn on Text to Speech.
2. Choose a source: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS**, or **xAI Voice**.
3. Enter the provider key or local server address for that source.
4. Pick a model and a voice.
5. Set **Voice Option** to **One voice for all characters** or **Selected per character**.
6. Save, then use the preview button to confirm you hear audio.

For a group call, per-character voices make it much easier to tell who is talking. If a character has no voice that Marinara can resolve, that character becomes text only for the call.

### Choose a microphone input mode

When **Call Audio Pipeline** is on, an **Audio input mode** dropdown appears with four choices. Pick the one that fits your browser and provider.

- **Mic recording + Local Whisper**: records while you are unmuted, ignores silence, and turns your speech into text on your own machine. This is the default and the best choice for Firefox.
- **Browser speech recognition**: uses your browser Web Speech feature. The Web Speech API is a built-in browser tool for turning speech into text. Support varies by browser, and Marinara falls back to Local Whisper when it is missing.
- **Manual system dictation**: only puts the cursor in the call text box so your operating system dictation can type there. Marinara does not record your microphone by itself in this mode.
- **Provider-native audio/video**: sends your recorded audio or video straight to the Conversation model, when that model can accept media directly. If the model cannot, use Local Whisper or browser speech recognition instead.

The camera and screen buttons appear only when **Camera and screen input** is on. They work only in **Provider-native audio/video** mode. In every other mode the buttons are visible but stay disabled.

### Download Local Whisper

Local Whisper turns your speech into text on the machine running Marinara. Your microphone audio never leaves that machine for transcription. The resulting text is still sent to your Conversation model as part of the call.

Local Whisper is owned by the Calls package and is the most reliable microphone path for browsers with weak speech support, including Firefox. After installing Calls, open **Connections**, open **Local Model**, expand the card, and find **Local Speech Model**. The section is hidden when Calls is not installed. For the general Local Model card, see [Local Model Setup](../connections/local-model.md).

1. Choose a model. **Whisper Tiny (Multilingual)** is the default. It is about 180 MB to download and uses about 350 MB of memory while running. It is the best first choice for phones and older machines.
2. Or choose **Whisper Base (Multilingual)** for better accuracy on messy speech. It is about 320 MB to download and uses about 650 MB of memory.
3. Click **Download Whisper**.
4. Wait for the progress bar to finish.

After download, a **Delete Local Whisper** control (trash icon) appears if you want to remove the model.

Uninstalling Calls also deletes every downloaded Whisper model and its saved selection. This reclaims the model's disk space. Reinstalling Calls restores the download controls, but does not redownload a model until you choose one.

## Turn calls on for a chat

You can turn calls on while creating a new Conversation, or later from the chat settings.

For a new Conversation, finish the setup wizard first, then open that chat's settings and follow the same steps below. The optional package settings are shown only after Calls is installed.

For an existing Conversation:

1. Open the chat.
2. Open **Chat Settings**.
3. Go to the **Agents** section.
4. Open **Calls**.
5. Turn on **Audio/Video Calls**. You should now see a call button next to the conversation name.
6. Turn on **Call Audio Pipeline**. No call can start without it, even if you never use a microphone.
7. Pick an **Audio input mode**.

**Audio/Video Calls** and the **Calls** command are two different settings. **Audio/Video Calls** shows the call button so you can call a character. The **Calls** command lets characters ring you first. If you turn **Calls** off, you can still start calls yourself, but characters should not start incoming calls.

The **Agents** section also contains a master **Commands** toggle when a command-providing package is installed. It must be on for hidden in-call commands to work. The call itself can still start with it off.

### Settings and defaults

Most call settings live in **Chat Settings**, then **Agents**, then **Calls**. Some of them are global, which means changing them in one chat changes them for every Conversation call in the app.

| Setting | Scope | Default |
|---|---|---|
| **Audio/Video Calls** | Per chat | Off |
| **Calls** (command) | Per chat | On |
| **Generate voice cues in [tags]** | Per chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

**Generate voice cues in [tags]** asks the model to add short bracketed cues, such as `[whispering]`, `[laughing]`, or `[sighs]`, inside spoken lines. These cues shape how TTS reads the line and help pick reaction video clips. It is on by default. Turn it off to keep spoken lines plain.

## Start, receive, and end a call

### Starting a call

When calls are on for a chat, a phone button appears next to the conversation name. Its tooltip reads **Start call** when no call is active, or **Open call** when a call is already running.

Click **Start call**. The full call screen opens right away.

Only one call can be active or ringing per chat. If you start a call while one is already going, Marinara reopens that call instead of making a new one.

### Incoming character calls

A character can ring you if the **Calls** command is on. When that happens and you are inside that chat, an **Incoming call** banner appears above the message box. The banner has a **Decline call** button and an **Answer call** button.

If you are somewhere else in Marinara, an incoming-call notification appears, similar to the notification for an autonomous character message. A short ringing tone plays. Marinara never answers for you, so you must click **Answer call**.

Only characters that are currently available join a call. If a schedule or status marks a character as offline, that character does not join the call, even though they belong to the chat.

### Ending a call

You can end a call at any time with the red **End call** button. It sits on the call screen and on the minimized popout. A character can also leave or end the call through an in-call command.

When the call ends, Marinara stops recording, closes the media safely, and adds a card to the normal Conversation.

## The call screen and controls

The call stage shows one tile per participant, which includes your persona and each available character. It highlights whoever is speaking.

The call chat holds typed messages and text-only character replies. On desktop it sits in a side panel. On mobile it hides behind an **Open call chat** button. The chat opens as a full drawer, and you close it with **Close call chat**. Spoken lines are used for audio but are not repeated as separate chat bubbles.

The call composer has a **Message in call** box and a **Send** button. It also has an emoji, GIF, and sticker picker and a quick connection switcher. File attachments are not supported in call chat yet.

The control bar at the bottom of the stage has icon buttons:

- Microphone: mutes or unmutes you. Its tooltip changes with the input mode, for example **Unmute microphone with Local Whisper**.
- **Turn camera on** and **Turn camera off**: enabled only in **Provider-native audio/video** mode with **Camera and screen input** on.
- **Share screen** and **Stop sharing screen**: same rule as the camera.
- **Character volume**: opens a popover with a mute button and a 0 to 100 volume slider. The default is 100 percent, and your choice is saved in the browser.
- **Soundboard**: opens a list of sounds with an **Upload** control.
- **End call**: the red hang-up button.

If you stay muted for a while, a reminder appears: "You are muted! Remember to unmute yourself first if you want to talk."

If you leave the Conversation while a call is active, the call shrinks into a small floating popout. The popout shows the chat name, the elapsed time, and a red **End call** button. Click the popout body to return to the full call screen. Marinara keeps the call running while you browse other panels.

### Soundboard

The soundboard is a small library of sounds you can play during any call. Four built-in sounds ship by default: **Soft Chime**, **Tap**, **Sparkle**, and **Pop**. You cannot delete the built-in sounds.

You can upload your own sound with the **Upload** button. Accepted formats are mp3, wav, ogg, webm, and m4a, up to 8 MB each. Your uploads have a delete control. Characters can also play a sound through the soundboard command.

## Character Video Presence and video call clips

**Character Video Presence** replaces a still avatar tile with a looping AI-generated video clip of the character. It is off by default. The toggle is **Character video presence** in **Chat Settings**, then **Agents**, then **Calls**.

To set up video call clips:

1. Create a Video Generation connection under **Settings**, then **Connections**.
2. Mark one connection as **Default for Videos**, or pick a video connection each time you generate.
3. Open a character or persona editor.
4. Open the **Sprites** tab, then the **Clips** sub-tab.
5. Use **Generate Clips** or **Upload extra** to add the clips you want.

For more on sprites and the editor, see [Character Sprites (Expressions and Full-body)](../characters/sprites.md).

The **Generate Clips** button opens the **Generate Call Clips** window. There you choose a **Video Generation Connection** and choose **Use avatar as reference**. Then you pick which standard clips to make. You can also define one custom clip with a **Clip name** and an action description.

The six standard clip types are **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, and **Sighing**. During a spoken turn, Marinara reads the voice cues in a line, such as `[sighs]` or `[laughs]`. It picks a matching reaction clip, then returns the character to Idle.

Two extra toggles appear under **Character video presence** when it is on:

- **Automatic video clips generation**: off by default. When on, Marinara auto-generates only the two basic clips, **Idle** and **Talking**, for a call participant that needs them. Reaction clips and custom clips are never auto-generated. You make those by hand from the **Clips** sub-tab.
- **Custom clips**: off by default. When on, a character can rarely request a one-off clip during a live call, and can replay a ready custom clip afterward. This is meant for special visual requests, not for every mood or line.

Missing clips never block a call. The character just shows a still avatar until a clip is ready. If you trim a clip, it loops inside the trim range you set.

Turning **Character video presence** off also turns off **Automatic video clips generation** and **Custom clips**.

Video call clips are not the same as Gallery **Videos**. Gallery Videos hold scene videos from Roleplay, Game, or Conversation chats. The **Clips** sub-tab holds the reusable presence loops described here.

## Hidden in-call commands

Characters can use the same hidden bracket commands in a call that they use in normal Conversation messages. Each command needs its matching toggle in **Chat Settings → Agents**, and the master **Commands** toggle inside that section must be on. These commands run silently and are never spoken or shown as prose.

- **Selfies**: a character generates and sends a photo into the call chat. This needs a **Selfie Connection** set for the chat. See [Selfies](selfies.md).
- **Memories**: a character saves a memory about another character based on the call.
- **Music**: a character plays a song through the Music Player, if a music source is connected.
- **Haptics**: a character drives a connected haptic device during intimate moments, if a device is connected.
- **Reactions**: a character reacts to your latest typed call message with an emoji.
- **Cross-Post**: a character moves the current topic into a different shared Conversation chat.
- **Schedule Updates**: a character changes its own online, idle, do-not-disturb, or offline status and activity for the rest of a scheduled block. This only applies to characters that have a schedule. See [Character Schedules and Autonomous Messaging](schedules.md).
- **Notes** and **Influence**: these save a durable note or a one-time nudge, and appear only when the chat has a connected chat set up.
- **Soundboard**: a character plays one of the call soundboard sounds.
- Leave and end: a character can leave the call alone, or end the call for everyone.

Some commands add a small system entry to the call chat. For example, a selfie shows a "sent a selfie" entry with the image, and a custom clip shows a placeholder while the clip renders.

## The call-ended summary

When a call ends, Marinara adds a card to the normal Conversation transcript. The card shows the call status. You may see these titles:

- **Call Started**
- **Incoming Call**
- **Call Ended**, with the call length
- **Call Declined**
- **Missed Call**

After a **Call Ended** card, Marinara generates a short audio call summary in the background if anything meaningful happened. It then adds that summary to the Conversation as hidden context that the model can read. This keeps the model aware of what was said without copying the whole call into the visible chat.

The detailed call transcript stays in separate call storage. Only the short summary flows back into the normal chat.

## Troubleshooting

### Start call fails and says call audio is not enabled

If you click **Start call** and see "Conversation call audio is not enabled in Chat Settings", turn on **Call Audio Pipeline**. Open **Chat Settings**, then **Agents**, then **Calls**, and turn it on. This setting is required for every call, even a call where you only type. It is global, so turning it on in one chat turns it on for all Conversation calls.

### I can hear characters, but they cannot hear me

Open **Chat Settings**, then **Agents**, then **Calls**, and confirm **Call Audio Pipeline** is on. Then confirm your browser has given the Marinara page permission to use the microphone.

If you are on Firefox, or browser speech recognition does not work, install Calls and download Local Whisper. Open **Connections**, then **Local Model**, then **Local Speech Model**. Then choose **Mic recording + Local Whisper**.

### Local Whisper says it is unavailable

Local Whisper needs the native ONNX runtime for your platform. ONNX is the engine that runs the local speech model. If the model was set up for a different Node build, reinstall dependencies with the same Node build you use to run Marinara, then restart.

If you run a "Lite" build of Marinara, Local Whisper is turned off in that build. The app shows: "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Use a full install to get Local Whisper.

### The browser speech option does nothing

Browser speech recognition depends on browser support. Firefox does not offer the same Web Speech recognition as Chromium and Safari browsers. Use **Mic recording + Local Whisper** for hands-free capture, or use **Manual system dictation** to type with your operating system dictation.

### A character only types instead of speaking

Check your Text to Speech settings and voice assignments. The character needs either the single global voice or a per-character voice that your TTS provider can resolve. See [Text to Speech (TTS) Setup](../media/tts-setup.md).

### The model misunderstands my speech

Try **Whisper Base (Multilingual)** instead of Whisper Tiny for better accuracy. Reduce background noise and music. If your model supports it, switch **Audio input mode** to **Provider-native audio/video** so the model hears your audio directly.

### The camera or screen button is disabled

Those buttons only work in **Provider-native audio/video** mode with **Camera and screen input** turned on. Switch the **Audio input mode** and turn on **Camera and screen input**, then try again. The buttons also help only when your model can actually use camera or screen input.

### The call is not working on my phone

On mobile, the call chat opens with the **Open call chat** button and closes with **Close call chat**. If a character will not speak, confirm Text to Speech is set up. For microphone problems on mobile, the same Local Whisper and permission steps above apply.

### A character stopped replying mid-call

Characters reply only while the model connection you selected for the chat is working. If replies stop, check that connection, then try sending a message in the call chat again.

## Related guides

- [Text to Speech (TTS) Setup](../media/tts-setup.md)
- [Local Model Setup](../connections/local-model.md)
- [Character Sprites (Expressions and Full-body)](../characters/sprites.md)
- [Conversation Mode: Getting Started](getting-started.md)
