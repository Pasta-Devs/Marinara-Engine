# Text to Speech (TTS) Setup

Text to speech (TTS) reads chat messages and game narration out loud. This guide shows how to turn it on, pick a voice service and voices, set up auto-play, and use the per-message controls.

## Quick start

1. Open the text to speech card (steps below) and turn on **Use text to speech**.
2. Pick a **Source** and paste your key into **API key**.
3. Click **Preview** to hear a sample.
4. In a chat, click **Speak** under a message.

## Turn on text to speech

Almost every TTS setting is in one card. Turning TTS on does not make anything speak by itself. It reveals the **Speak** button on each message and the **Auto-play** options. You still choose what is read and when.

1. Click **Connections** in the top bar, then **Add**. The **Add account** window opens.
2. Under **Voice**, choose **Text to speech**. The card opens. If you already use PocketTTS, the same card is also under **On this device**.
3. Turn on **Use text to speech**. While it is off, nothing is read aloud.
4. Open the **Source** list and pick a service.

A **Source** is the service that makes the audio.

- **OpenAI-compatible**: OpenAI, or any server that copies OpenAI's TTS format. This is the default.
- **ElevenLabs**: the ElevenLabs voice service.
- **PocketTTS**: a free voice server you run on your own computer.
- **xAI Voice**: xAI's voice service.

Marinara keeps a separate saved profile for each Source: its key, address, model, voices and parameters. Switching Sources restores that Source's earlier setup. A Source you have not set up starts with defaults.

Requests go through Marinara's own server. Your API key is stored encrypted on the server. After you save it, the field shows masked dots and the real key never returns to your browser.

### Use an Audio connection

If you already added an **Audio** account (see [Supported AI Providers](../connections/providers-reference.md#audio)), you do not need to enter its details again. It appears in the **Source** list under **Audio providers**, with its source type in brackets.

1. Open the **Source** list and pick the account.
2. Choose its voices and the other settings below.

Marinara then uses that account's address, key, model and **Request timeout (seconds)**, so the card hides those fields. The key stays in the account and is never copied into the card or sent to your browser. Changes to the account, such as a new key, apply at once.

Voices, speed and other speech settings are saved per account. Two accounts of the same type never share them. Your settings for the four regular Sources stay as they were. The card's switch still turns regular TTS on and off.

If the chosen account is deleted or unusable, the card shows **Missing Audio provider** and nothing is spoken until you pick another Source. Marinara never switches on its own. If the account lists its voices, the card names any saved voice that is not on the list.

## Set the address, key and model

Skip this when you chose an Audio account. The account supplies these.

1. Check **Base URL**. Each Source fills in a default (table below). Change it only for a proxy or a server you run.
2. Paste your key into **API key**. To keep an existing key, leave the masked dots. To remove it, clear the field.
3. Check **Model**. Each Source fills in a default. You can type another model your service supports.

| Source | Default Base URL | Default model | Default voice |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | none, you must pick one |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

For **ElevenLabs**, the **Model** list loads the speech models your account can use. Pick a normal speech model. Model IDs that contain `ttv` are voice-design models that cannot read text. If you pick one, playback fails with an error telling you to use a speech model.

### PocketTTS

PocketTTS is not built into Marinara. Install [the official PocketTTS server](https://github.com/kyutai-labs/pocket-tts) separately and start it with `uvx pocket-tts serve`. Marinara does not download or manage it. The official server uses `http://localhost:8000`. Leave **Base URL** on that unless you changed the host or port. Marinara detects the official multipart `/tts` API. Custom URLs for the [OpenAI-compatible PocketTTS wrapper](https://github.com/teddybear082/pocket-tts-openai_streaming_server) still work.

### Request timeout

Marinara waits up to 60 seconds for each spoken line. A voice server on your own computer, especially a laptop, can need longer for a long line. Raise **Request timeout (seconds)** below **Model**. The range is 10 to 3,600 seconds.

An Audio account has its own **Request timeout (seconds)**, below **Default voice** in its editor. Chats that speak through an Audio account, including one chosen as **Source**, use that limit. The card's limit covers speech from the card's own settings, including **Preview**. If a line takes too long, the error says how many seconds Marinara waited and which setting to raise.

## Choose voices

**Voice option** decides how voices are assigned.

- **One voice for all**: every speaker uses the same voice. This is the default.
- **Selected per character or persona**: you give chosen characters and personas their own voices.

### One voice for all

Pick the voice in **Shared voice**. To load your service's real voice list, enter its details and click **Refresh voices from provider** (the circular-arrow icon). It saves the card first, so a newly entered key is used at once. Before you connect, a short built-in list shows so the field is not empty. A service error is shown instead of passing the fallback off as a successful refresh.

The official PocketTTS server has no voice-list endpoint, so Marinara shows its built-in voices and keeps a text field beside the list for another built-in name or supported voice URL. Compatible wrapper servers can return their own list and accept custom IDs or paths.

For **ElevenLabs** you must pick a voice. Marinara loads the whole account library: personal, workspace, saved and default voices. The picker has a search box and a count of loaded voices. It starts on "Select an ElevenLabs voice", and playback is blocked until you choose a real one.

### Selected per character or persona

1. Set **Voice option** to **Selected per character or persona**.
2. In **Character and persona voices**, click **Add voice**.
3. Pick a character or persona in the left list and a voice in the right list.
4. Repeat for each one.

You can also set a character's voice on the **Voice** tab of the **Character Editor**. It changes the same row. **Refresh** in this box reloads the voice list. Create your characters first. With none, the app tells you to add a character or persona before assigning voices.

A character without a personal voice uses the voice of a card with a matching name, such as the original of an AU copy. Otherwise it uses the shared voice. See [Creating and Editing Characters](../characters/creating-and-editing-characters.md).

### Narrator voice

Narration is text no single character speaks, such as scene description or a game master's lines.

1. In **Narrator voice**, turn on **Use separate narrator voice**.
2. Pick a voice.

It is used when a line's speaker is Narrator, GM, Game Master or System, in Roleplay and Conversation messages, and for Game Mode narration with no named speaker. With ElevenLabs, pick a narrator voice here. If you leave it empty, narration falls back only when a global voice is set.

### Random NPC voices (Game Mode only)

This gives spare voices to minor game characters that Game Mode tracks. It has no effect in Roleplay or Conversation.

1. In **Random NPC voices**, turn on **Use default voices for random NPCs**.
2. Tick voices in **Male NPC defaults** and **Female NPC defaults**.

A tracked NPC without a personal voice gets a stable pick from the matching pool and keeps it for the session. An NPC with an assigned voice keeps that voice. NPCs with unclear gender pick from both pools. If the app cannot find labeled male or female voices, each pool uses the full list.

## Audio format and speed

**Audio format** is **MP3** (default) or **WAV**. Use WAV for local servers that cannot make MP3. The control is hidden for ElevenLabs, which always uses MP3. It shows for xAI Voice but has no effect, because xAI always returns MP3.

The **Speed** slider range depends on the Source:

| Source | Range |
| --- | --- |
| OpenAI-compatible | 0.25 to 4.0 times |
| PocketTTS | 0.25 to 4.0 on compatible wrappers. The official server controls speed itself. |
| ElevenLabs | 0.7 to 1.2 times |
| xAI Voice | 0.7 to 1.5 times |

A saved speed outside the range is clamped to the nearest allowed value. For ElevenLabs there are two more controls: **Language** (force a language, or leave it on **Auto detect**) and **Stability** (more expressive to more consistent).

## Auto-play

Each **Auto-play** toggle reads one kind of new message as soon as it finishes generating. They need **Use text to speech** on. All start off.

- **Roleplay messages**: new Roleplay replies.
- **Conversation messages**: new Conversation replies.
- **Game narration**: new Game Mode narration and combat lines.
- **Progressive playback**: starts the first line of a multi-line reply at once instead of waiting for the whole reply.
- **Only read dialogues**: reads only quoted or tagged spoken lines and skips plain narration.

Auto-play fires once, on the newest reply, when it finishes. It does not re-read old messages when you reopen or scroll a chat.

In Roleplay, voice preparation starts as soon as the main reply is saved. If an enabled agent rewrites the reply, such as Prose Guardian, Marinara waits for the final text.

### Text filters and emotion directions

These filters apply to manual playback and auto-play, including Game narration and Roleplay speaker extraction. Code blocks are skipped by default. The other two start off.

- **Skip text inside HTML and custom tags**: removes the enclosed text, such as a hidden `<simulation>...</simulation>` block. Speaker tags used to pick voices stay.
- **Skip fenced code blocks**.
- **Skip text inside square brackets**.

Turn on **Roleplay speaker extractor** to see **Enable emotion indicators**. It adds voice directions without changing the dialogue words. With emotion indicators on, text in square brackets goes to the speech service even when **Skip text inside square brackets** is on. This can include notes. To keep bracketed notes out of speech, turn emotion indicators off and leave the skip on. Directions such as `[Low, steady voice, restrained urgency]` stay whole when a long line is split. Known speaker and scene labels are still removed. The speech model decides how to use each direction. With **Use text to speech**, **Game narration** and emotion indicators on, Game scene, party and combat dialogue can include directions too.

## Speak one message

Once TTS is on, a **Speak** button (a microphone icon) appears in the toolbar under each character or narrator message.

- Click **Speak** to read it. The button shows a loading state while it fetches audio.
- Click it again while it plays to stop. The tooltip reads **Stop speaking**.
- A message with no readable text, such as only an image, shows **No dialogue to speak** and stays disabled.

While a message speaks, **Pause speaking**, **Resume speaking** and **Restart speaking** buttons appear. The speaker-icon button opens a **Line volume** slider from 0 to 100 percent (default 50). It is separate from the Game Mode mixer and the Conversation call volume.

If it did not work, see [Troubleshooting](#troubleshooting).

## Cached clips

Marinara saves generated audio in your browser so it does not generate the same line twice. The **Cached clips** panel shows a live count and total size. Click **Export cached TTS clips** (the download icon) to save every cached clip as separate audio files. The cache trims its oldest clips on its own. There is no clear button in the app. Clear your browser data to empty it.

## TTS in each chat mode

- **Roleplay** uses the **Roleplay messages** toggle and the **Speak** controls. See [Roleplay Mode: Getting Started](../roleplay/getting-started.md).
- **Conversation** uses the **Conversation messages** toggle and the same controls. Audio calls are covered in [Conversation Audio and Video Calls](../conversation/calls.md).
- **Game Mode** uses the **Game narration** toggle. Its mixer has a **TTS** channel next to **Master**, **Music**, **Sound Effects** and **Ambient**. It sets the volume of spoken game audio and starts at 100 percent. See [The Game's controls](../game/getting-started.md#the-games-controls).

### Phonetic name (pronunciation in calls)

If the voice mispronounces a character or persona name, add a **Phonetic name** and type how it should sound. In the **Character Editor** it is on the **Voice** tab. In the **Persona Editor** it sits with the basic info fields. It is used only in Conversation audio and video calls. **Speak**, auto-play and Game Mode narration ignore it.

## Troubleshooting

- **Nothing speaks**: check that **Use text to speech** is on. Then check the right **Auto-play** toggle, or use **Speak** on a message.
- **The card shows Missing Audio provider**: the account chosen as **Source** was deleted or cannot be used. Pick another Source. See [Use an Audio connection](#use-an-audio-connection).
- **No voices in the list**: save the card with TTS on and a valid key, then click **Refresh voices from provider**. The official PocketTTS server uses Marinara's built-in list. For a compatible PocketTTS wrapper, check that `<Base URL>/v1/voices` responds.
- **ElevenLabs will not speak**: pick a real voice, not the "Select an ElevenLabs voice" placeholder. Check that **Model** is a speech model, not a voice-design model whose ID contains `ttv`.
- **A line stops with "No audio after 60 s"**: the voice server needs more time. Raise **Request timeout (seconds)** where the message says. See [Request timeout](#request-timeout).
- **A self-hosted server on a local address is blocked**: turn on `TTS_LOCAL_URLS_ENABLED` in `.env`. It lets Marinara reach a local or private address for OpenAI-compatible or ElevenLabs-style servers. PocketTTS does not need it. See [Server Configuration Reference](../CONFIGURATION.md).
- **Test fast**: click **Preview** in the card to hear a short sample with your current settings.

## Reference: music, sound effects and Gacha Forge

These sections are for advanced setups.

### Game music and sound effects on a compatible audio server

1. In **Connections**, open your **Music & Sound Effects** account with **Edit model** and choose **Custom compatible server**. The **Add account** window has no tile for this account type; it comes from an upgrade or an import (see [the account reference](../connections/providers-reference.md#music--sound-effects)).
2. Enter the address, key and model for your music or sound-effect server.
3. Set **Generation API format** and enter the endpoint paths your server provides. A blank path leaves that capability unavailable.
4. Turn on **Music generation**, **Sound-effect generation**, or both.
5. Select this account in Game setup or the game's audio settings. Keep your speech account selected separately in the TTS card.

Endpoint paths are added to the account's Base URL. For `http://localhost:8002/v1`, use `chat/completions` to reach `/v1/chat/completions`. Local HTTP endpoints need `TTS_LOCAL_URLS_ENABLED=true` in `.env`, like other local compatible audio requests.

Two API formats are supported:

- **Prompt JSON → MP3 audio** posts `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` and expects MP3 bytes. Game music uses the context track's duration (120 seconds by default). Sound effects ask for 5 seconds.
- **Chat Completions → inline audio (ACE-Step compatible)** posts `model`, one user `messages` entry, `stream: false`, and `audio_config` with `duration`, `instrumental: true` and `format: "mp3"`. It accepts inline MP3 from `choices[0].message.audio`, either an ACE-Step audio URL array holding a base64 data URL or an object with base64 `data`. See the [ACE-Step compatible API contract](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). Remote result URLs and asynchronous job APIs are not supported.

Turn on only what your server implements. An OpenAI-compatible speech endpoint alone does not mean it supports music or sound effects. A service such as Infermatic must expose one of these formats or supply an adapter. Its live music endpoint has not been verified here. For native ElevenLabs or SunoAPI generation, use that source under **Music & Sound Effects**. See [the account reference](../connections/providers-reference.md#music--sound-effects).

Generated context music is composed once per area or encounter tier and reused. Repeated sound effects use the audio cache. A generation error leaves the cache available for retry.

### Gacha Forge dialogue and audio

Gacha Forge 1.11.0 or later uses the TTS card's selected account and its per-character voice assignments. - Turn on **Read character dialogue** to read dialogue from imported characters that have an assigned voice. It is in a new world's **Lore** setup step, or in Gacha Forge's own world settings for an existing world. Narration, thoughts, generated units without an Engine character ID and characters without a voice stay silent. A name alone never borrows another character's voice.
- A selected Audio account can be used when the world's TTS toggle is on. When you use the card's own source settings directly, **Use text to speech** must also be on.
- Stock Game music and sound effects need no generation account. To compose new tracks, turn on **Generate music and sound effects** in Gacha Forge and choose a Music & Sound Effects account under **Audio connection**. It appears when generation is on. Home, combat, boss, story-scene and character-story tracks are generated when first needed, then reused. These requests use your service account.
- The top-right mute button silences music, dialogue and sound effects together. Gacha Forge's visual settings have separate volume controls for the three, including zero, plus the autoplay pause (default **3 seconds**, after the text reveal and any spoken dialogue). Choices still wait for the player. Spoken dialogue is canceled when you leave a scene. Leaving the world stops its audio.

Update the installed Gacha Forge package as well as the Engine to get these controls.

## Related guides

- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Lip sync with text-to-speech](../agents/avatars.md#lip-sync-with-text-to-speech) for 2D and 3D avatars
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Server Configuration Reference](../CONFIGURATION.md)
