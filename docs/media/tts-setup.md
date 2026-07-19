# Text to Speech (TTS) Setup

This guide shows you how to set up Text to Speech in Marinara Engine so the app can read messages and game narration out loud. Text to Speech (TTS) turns written chat text into spoken audio. This guide covers picking a voice provider, choosing voices, auto-play, and the per-message playback controls.

## Where TTS settings live

Almost every TTS setting lives in one place. Open the **Connections** panel and find the **Text to Speech** card. The card is closed by default, so click its header to expand it.

The app sends TTS requests through its own server. Your provider API key is stored encrypted on the server. After you save a key, the field shows a masked value, a row of dots, instead of the real key. The real key is never sent back to your browser.

Turning TTS on does not make anything speak by itself. It only reveals the **Speak** button on each message and the **Auto-play** options. You still choose what gets read and when.

## Step 1: Enable TTS and pick a Source

1. Open the **Connections** panel and expand the **Text to Speech** card.
2. Click the switch in the card header to turn TTS on. Hover over the switch to see its tooltip: **Enable TTS** when off, **Disable TTS** when on.
3. Open the **Source** dropdown and pick your provider.

A **Source** is the service that makes the audio. The four choices are:

- **OpenAI-compatible**: OpenAI, or any server that copies OpenAI's TTS format.
- **ElevenLabs**: the ElevenLabs voice service.
- **PocketTTS**: a free voice server you run on your own computer.
- **xAI Voice**: xAI's voice service.

The default Source is **OpenAI-compatible**. Marinara keeps a separate saved profile for each Source, including its encrypted API key, endpoint, model, voices, and provider parameters. Switching Sources restores that Source's previous setup; a Source you have not configured yet starts with its defaults.

## Step 2: Enter the Base URL, API Key, and Model

Each Source needs a web address and, for most sources, an API key. An API key is a secret code from your provider that proves the request is yours.

1. Check the **Base URL** field. Each Source fills in a sensible default, shown in the table below. Change it only if you use a proxy or a self-hosted server.
2. Paste your provider key into the **API Key** field. To keep an existing key, leave the masked dots in place. To remove a saved key, clear the field.
3. Check the **Model** field. Each Source fills in a default model. You can type another model name your provider supports.

The app fills in these defaults per Source:

| Source            | Default Base URL          | Default Model          | Default voice the app pre-fills |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | none (you must pick one)        |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

For **ElevenLabs**, the **Model** field offers a dropdown of speech models. Pick a normal speech model. Model IDs that contain `ttv` are voice-design models, not speech models, and they cannot read text out loud. If you choose one by mistake, playback fails with an error that tells you to use a speech model instead.

### PocketTTS is a separate program

PocketTTS is not built into Marinara Engine. Marinara's adapter uses the [PocketTTS OpenAI-compatible server](https://github.com/teddybear082/pocket-tts-openai_streaming_server), which exposes both the speech and voice-list endpoints Marinara needs. Install and run that server by following its instructions; Marinara does not download or manage it for you.

The compatible server uses `http://localhost:49112` by default. Leave the **Base URL** on that value unless you changed the server port. Existing custom PocketTTS URLs remain unchanged.

## Step 3: Choose a voice (Voice Option)

The **Voice Option** setting decides how voices are assigned:

- **One voice for all characters**: every speaker uses the same voice. This is the default.
- **Selected per character**: you give chosen characters their own voices.

### One voice for all characters

Pick the voice in the **All Characters Voice** field. PocketTTS shows voices returned by your server in a dropdown and keeps a text field beside it for a custom voice ID, URL, or path.

To load the real voice list from your provider, first save the card with TTS enabled. Then click the **Refresh voices** button (the circular-arrow icon). Before you connect, the app shows a short built-in fallback list so the field is not empty. That fallback list may be out of date, so refresh to get your provider's current voices.

For **ElevenLabs**, you must pick a voice. The dropdown starts on "Select an ElevenLabs voice", and playback is blocked until you choose a real one.

### Selected per character

1. Set **Voice Option** to **Selected per character**.
2. The **Character Voices** table appears, with **Character** and **Voice** columns.
3. Click **Add character voice** to add a row.
4. Pick a character in the left dropdown and a voice in the right dropdown.
5. Repeat for each character you want to give a custom voice.

You must create your characters first. If you have none yet, the app tells you to add characters in the Characters tab before assigning voices. Characters without a personal voice fall back to the global voice. See [Creating and Editing Characters](../characters/creating-and-editing-characters.md).

## Narrator Voice

Narration is text that no single character speaks, such as scene description or a game master's lines. You can give it a separate voice.

1. In the **Narrator Voice** box, turn on **Use separate narrator voice**.
2. Pick a voice in the picker that appears.

The app uses this voice when a line's speaker is Narrator, GM, Game Master, or System. That works in Roleplay and Conversation messages. It also covers Game Mode narration lines that have no named speaker. If you use ElevenLabs, pick a narrator voice here. If you leave it empty, narration only falls back when a global voice is set.

## Random NPC Voices (Game Mode only)

This feature gives spare voices to minor game characters. It works only in Game Mode, and only for NPCs that Game Mode tracks. It has no effect in Roleplay or Conversation.

1. In the **Random NPC Voices** box, turn on **Use default voices for random NPCs**.
2. Two checkbox grids appear: **Male NPC defaults** and **Female NPC defaults**.
3. Tick the voices you want each pool to draw from.

A tracked NPC without a personal voice gets a stable pick from the matching pool. The same NPC keeps the same voice during a session. An NPC with an assigned character voice always keeps that assigned voice. If the app cannot detect labeled male or female voices, each pool uses the full voice list instead.

## Audio Format and Speed

The **Audio Format** setting chooses **MP3** (the default) or **WAV**. Use WAV for local or self-hosted servers that cannot make MP3. Two notes:

- The **Audio Format** control is hidden for ElevenLabs, which always uses MP3.
- The control shows for xAI Voice but has no effect there. xAI Voice always returns MP3.

The **Speed** slider controls how fast the voice talks. The allowed range depends on the Source:

- OpenAI-compatible and PocketTTS: 0.25 to 4.0 times normal speed.
- ElevenLabs: 0.7 to 1.2 times.
- xAI Voice: 0.7 to 1.5 times.

If a saved speed is outside the current source's range, the app clamps it to the nearest allowed value when it speaks.

For **ElevenLabs** only, two extra controls appear. **Language** lets you force a spoken language, or leave it on **Auto detect**. **Stability** slides between more expressive and more consistent speech.

## Auto-play: reading messages automatically

Under the **Auto-play** heading, each toggle tells the app to read one kind of new message as soon as it finishes generating. They all need **Enable TTS** to be on first. Every toggle starts off.

- **Roleplay messages**: reads new Roleplay replies.
- **Conversation messages**: reads new Conversation Mode replies.
- **Game narration**: reads new Game Mode narration and combat lines.
- **Progressive playback**: when a reply has several lines, starts playing the first line right away instead of waiting for the whole reply.
- **Only read dialogues**: reads only quoted or tagged spoken lines and skips plain narration.

Auto-play fires only once, on the newest reply, at the moment it finishes. It does not re-read old messages when you reopen or scroll a chat.

## Speaking a single message

Once TTS is on, a **Speak** button (a microphone icon) appears in the toolbar under each character or narrator message. It reads that one message on demand.

- Click **Speak** to read the message. While it is fetching audio, the button shows a loading state.
- Click it again while it plays to stop. The tooltip reads **Stop speaking** while a message is playing.
- A message with no readable text (for example, only an image) shows **No dialogue to speak** and stays disabled.

While a message is speaking, two more buttons appear. **Pause speaking** and **Resume speaking** hold and continue playback. **Restart speaking** starts the message again from the top.

The speaker-icon button opens a **Line volume** slider from 0 to 100 percent, default 50. This volume is its own saved setting. It is separate from the Game Mode mixer and from the Conversation call volume, so changing one does not change the others.

## Cached clips

The app saves generated audio in your browser so it does not need to generate the same line twice. The **Cached clips** panel shows a live count and total size.

Click the **Export cached TTS clips** button (the download icon) to save every cached clip to your device as separate audio files. The cache trims its oldest clips on its own. There is no manual clear button inside the app, so clear your browser data if you want to empty it.

## TTS in each chat mode

The same TTS setup serves every mode, with a few per-mode extras:

- Roleplay uses the **Roleplay messages** auto-play toggle and the per-message **Speak** controls. See [Roleplay Mode: Getting Started](../roleplay/getting-started.md).
- Conversation Mode uses the **Conversation messages** toggle and the same **Speak** controls. Spoken audio calls are a larger feature covered in [Conversation Audio and Video Calls](../conversation/calls.md).
- Game Mode uses the **Game narration** toggle. Game Mode also has its own audio mixer with a **TTS** channel next to **Master**, **Music**, **Sound Effects**, and **Ambient**. That channel sets the overall volume of spoken game audio and starts at 100 percent. See [Game Mode: Getting Started](../game/getting-started.md).

## Phonetic name (pronunciation in calls)

If a character or persona name is spelled in a way the voice mispronounces, you can add a **Phonetic name**. In the **Character Editor**, the field sits next to the character's **Name** field. In the **Persona Editor**, it sits with the other basic info fields. Type how the name should sound.

This override is used only during Conversation audio and video calls. The regular per-message **Speak** button, chat auto-play, and Game Mode narration do not read this field.

## Troubleshooting

- Nothing speaks: confirm the **Enable TTS** switch is on. Then check the right per-mode **Auto-play** toggle, or use the per-message **Speak** button. The **Speak** button and auto-play options only appear after TTS is enabled.
- No voices in the dropdown: save the card with TTS enabled and a valid API key, then click **Refresh voices**. For PocketTTS, also verify that `<Base URL>/v1/voices` responds from the compatible server.
- ElevenLabs will not speak: make sure you selected a real voice, not the "Select an ElevenLabs voice" placeholder. Also check that the **Model** is a speech model, not a voice-design model whose ID contains `ttv`.
- A self-hosted TTS server on a local address is blocked: turn on the server setting `TTS_LOCAL_URLS_ENABLED`. It lets the app reach a local or private address for OpenAI-compatible or ElevenLabs-style servers. PocketTTS does not need this setting. See [Server Configuration Reference](../CONFIGURATION.md).
- Test your setup fast: click the **Preview** button in the card to play a short sample line with your current settings.

## Related guides

- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Server Configuration Reference](../CONFIGURATION.md)
