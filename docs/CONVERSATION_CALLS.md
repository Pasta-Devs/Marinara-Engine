# Conversation Audio Calls

Conversation Calls let you talk to Conversation-mode characters through a Discord-style call surface. Calls are audio-first: characters can speak through Text to Speech, you can answer by microphone or by typing, and the call keeps its own temporary transcript before Marinara summarizes it back into the normal conversation.

Calls only exist in **Conversation Mode**. Roleplay, Visual Novel, and Game chats do not use this call surface.

## What Calls Do

- Replace the normal Conversation transcript with a call screen while the call is active.
- Show your persona and available characters as call participants.
- Play voice lines for characters that have a resolvable TTS voice.
- Keep characters without voices in the call chat as typed participants.
- Let you mute, control character output volume, use camera/screen controls when supported, open a soundboard, and end the call.
- Keep the call running if you navigate elsewhere in Marinara; use the minimized call popout to return or end it.
- Add call cards to the normal conversation history when calls start, end, are missed, or are declined.
- Generate a post-call summary and inject it into the originating Conversation chat after the call ends.

Calls are not WebRTC peer-to-peer calls. Marinara captures local browser media, sends the appropriate text/audio/video inputs through your selected Conversation connection, uses your configured TTS provider for spoken character replies, and stores call transcript data locally.

## Requirements

Before starting a voice call, set up these pieces:

1. **A Conversation chat** with at least one character.
2. **A normal LLM connection** selected for that Conversation. This is still the model that writes character replies.
3. **Text to Speech** in the Connections panel if you want characters to speak aloud.
4. **Conversation Calls** enabled in that chat's Commands settings.
5. **Call Audio Pipeline** enabled if you want Marinara to listen to your microphone.

Characters can still join a call without TTS, but their replies appear as typed call-chat messages instead of voice.

## Set Up Text To Speech

Open **Connections -> Text to Speech**.

1. Enable Text to Speech.
2. Choose a TTS source: OpenAI-compatible, ElevenLabs, PocketTTS, or xAI.
3. Add the provider key or local server URL required by that source.
4. Pick a model and voice.
5. Choose **One voice for all characters** or **Selected per character**.
6. Save and use the preview button to confirm audio plays.

For group calls, per-character voices make turn-taking much clearer. If a character has no assigned voice and the global voice cannot be resolved, Marinara treats that character as text-only for the call.

## Download Local Whisper

Local Whisper is the most reliable microphone path for browsers that do not support Web Speech recognition well, including Firefox. It runs on the Marinara host machine and does not send your microphone audio to an external speech-to-text service. The resulting text is still sent to the selected Conversation model as part of the call prompt.

Open **Connections -> Local Model**, expand the Local Model card, then use **Local Speech Model**:

1. Choose **Whisper Tiny (Multilingual)** for the smallest download and best mobile/older-device starting point.
2. Choose **Whisper Base (Multilingual)** if you want better accuracy and can spare more RAM.
3. Click **Download Whisper**.
4. Wait until the Local Speech Model status says it is downloaded or ready.

Approximate download/RAM sizes are shown in the UI before download. Whisper Tiny is the default first choice because it is small enough for weaker machines and phones to try first.

## Enable Calls For A Chat

You can enable calls when creating a new Conversation or later from Chat Settings.

During new Conversation setup, open the Automation step and enable **Audio/Video Calls** if you want the phone button to appear for that chat.

For an existing Conversation:

1. Open the chat.
2. Open **Chat Settings**.
3. Go to **Commands**.
4. Open **Conversation Calls**.
5. Enable **Audio/Video Calls**.
6. Enable **Call Audio Pipeline** if you want microphone input.
7. Pick an **Audio input mode**.

The **Calls** command toggle is separate. **Audio/Video Calls** lets you call the character. **Calls** lets characters ring you. If the Calls command is off, you can still start calls yourself, but characters should not initiate incoming calls.

## Choose An Audio Input Mode

Conversation Calls support several microphone/input paths:

- **Mic recording + Local Whisper**: records speech while you are unmuted, ignores silence, transcribes locally with the downloaded Whisper model, and sends text to the Conversation model. Recommended for Firefox and for users who want hands-free voice input without relying on browser Web Speech support.
- **Browser speech recognition**: uses the browser's Web Speech API where available. Browser support varies; if it is unavailable, Marinara falls back to Local Whisper when possible.
- **Manual system dictation**: focuses the call input so your operating system's dictation can type into it. You still send the message as text. This does not let Marinara continuously capture mic audio by itself.
- **Provider-native audio/video**: sends recorded media to the selected Conversation model when that provider/model route supports native audio or video input. If the model cannot accept media, use Local Whisper or browser speech recognition instead.

Camera and screen controls appear in the call UI, but video/screen input only helps when the selected model can use those inputs.

## Starting And Receiving Calls

When calls are enabled for a Conversation, a phone button appears beside the conversation name/status. Click it to start a call.

For incoming character calls:

- If you are inside that Conversation, accept/decline controls appear above the input box.
- If you are elsewhere in Marinara, an incoming-call popup appears like autonomous-message notifications.
- Marinara does not auto-answer character calls.

Only characters available for the chat should join. If schedules mark a character offline, they should not hop into the call just because they are in the group chat.

## During A Call

- The call screen shows participant tiles and highlights the current speaker.
- The call chat below the stage is for typed messages and text-only character replies.
- Speech transcripts and voiced character lines are used for generation/playback, but they are not duplicated into the visible call chat.
- Soundboard sounds play in the call when the soundboard is enabled.
- Hidden call commands can still run when enabled for the chat, including memories, music, haptics, notes, influences, selfies, soundboard actions, character leave, and call end.
- Selfies created during the call appear in the call chat and are added to the originating Conversation gallery.

If you leave the Conversation while the call is active, the call minimizes into a small popout so you can keep browsing other Marinara panels or chats.

## Character Video Presence And Clips

Character video presence is optional. A call can include one character with video clips and other characters that stay avatar-only.

To set it up:

1. Create a **Video Generation** connection in **Settings -> Connections**.
2. Mark one connection as **Default for Videos**, or select a video connection when generating clips.
3. Open the character or persona editor.
4. Go to **Sprites -> Clips**.
5. Generate or upload the clips you want to use.

Standard call clips are **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, and **Sighing**. Marinara uses TTS cue tags such as `[sighs]`, `[laughs]`, `[chuckles]`, `[inhales]`, or `[exhales]` to pick reaction clips during a spoken turn, then returns the participant to Idle.

The **Generate Clips** dialog lets you:

- choose the video generation connection,
- include the avatar as the first/final-frame reference,
- generate specific standard clips,
- create a named custom clip by entering a clip name and a short action.

For example, a custom clip named `Kissing` with the action `blow a kiss toward the camera` uses the same locked-camera, smooth-motion, breathing, and return-to-start loop instructions as standard clips. The user-entered text is only the action; Marinara adds the loop and identity-preservation rules.

When **Character Video Presence** is enabled in **Chat Settings -> Commands -> Conversation Calls**:

- existing ready clips are used automatically,
- missing clips do not block the call,
- provider-generated audio tracks are muted so they do not overlap with TTS,
- clips loop inside their saved trim range if you trimmed them.

**Automatic video clips generation** is off by default. When enabled, Marinara only auto-generates the two basic cached clips, **Idle** and **Talking**, for call participants that need them. Reaction clips and custom clips are generated manually from **Sprites -> Clips**.

**Custom Clips** lets characters sparsely create one-off requested clips during a call with `[custom_clip: label="...", prompt="..."]`. Ready named clips are advertised back to the model as `[play_clip="name"]`, so a character can play an existing custom clip after their normal voice/text response. Use custom clips for special visual requests, not every mood or ordinary line.

Gallery **Videos** are separate from **Sprites -> Clips**. Gallery Videos hold Roleplay/Game/Conversation generated or uploaded MP4 scene assets. Sprites -> Clips holds reusable video-call presence loops.

## Ending A Call

You can end the call from the red hang-up button. Characters can also leave or end a call when the relevant call command is available.

When the call ends, Marinara:

1. Stops recording and media tracks.
2. Finishes or cancels pending call audio safely.
3. Adds a call-ended card to the normal Conversation history.
4. Generates an audio-call summary if anything meaningful happened.
5. Injects the summary into the originating Conversation as model-visible context.

The detailed call transcript remains stored separately for call handling and debugging instead of being appended turn-by-turn to the normal chat.

## Troubleshooting

### I can hear characters, but they cannot hear me

Check **Chat Settings -> Commands -> Conversation Calls** and make sure **Call Audio Pipeline** is enabled. Then confirm your browser has microphone permission for the Marinara page.

If you are on Firefox or browser speech recognition is unavailable, download Local Whisper from **Connections -> Local Model -> Local Speech Model** and use **Mic recording + Local Whisper**.

### Local Whisper says it is unavailable

Local Whisper needs the native ONNX runtime for the Node architecture running Marinara. Restart Marinara with the same Node architecture you used to install dependencies. If it still fails, rerun the launcher or reinstall dependencies so the optional native package is repaired for your platform.

### The browser speech option does nothing

Browser speech recognition depends on browser support. Firefox does not expose the same Web Speech recognition API as Chromium/Safari environments. Use **Mic recording + Local Whisper** for hands-free microphone capture, or use **Manual system dictation** if you prefer the operating system's dictation UI.

### A character only types instead of speaking

Check the Text to Speech settings and voice assignments. The character needs either a global voice or a per-character voice that can be resolved by the selected TTS provider.

### Calls work, but the model misunderstands speech

Try Whisper Base instead of Whisper Tiny, reduce background noise/music, or switch to provider-native audio if your selected model supports native audio input.
