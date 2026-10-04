# Text to Speech (TTS) Setup

This guide shows you how to set up Text to Speech in Marinara Engine so the app can read messages and game narration out loud. Text to Speech (TTS) turns written chat text into spoken audio. This guide covers picking a voice provider, choosing voices, auto-play, and the per-message playback controls.

## Where TTS settings live

Almost every TTS setting lives in one place. Open the **Connections** panel and find the **Text to Speech** card. The card is closed by default, so click its header to expand it.

The app sends TTS requests through its own server. Your provider API key is stored encrypted on the server. After you save a key, the field shows a masked value, a row of dots, instead of the real key. The real key is never sent back to your browser.

Turning TTS on does not make anything speak by itself. It only reveals the **Speak** button on each message and the **Auto-play** options. You still choose what gets read and when.

### Use a saved Audio connection

The expanded **Text to Speech** card contains the existing **Audio** default and fallback selectors (moved here from **Defaults**). Choose a saved Audio connection: the default is preferred, or the fallback is used when no default is selected. This is the existing shared Audio category selection, not a separate TTS-only connection setting; Game setups with an explicit Audio connection keep their override.

With a connection selected, the card loads that backend's voices, saves the default voice to that connection only, and previews through that exact connection without saving legacy provider settings. **Manage custom voices** opens its connection-scoped manager directly here; the connection editor entry remains available. Non-OpenAI sources show an explanation instead. Merely selecting a connection or opening the manager does not register a voice or opt into a custom-voice profile. Switching connections closes the manager and stops its preview.

With neither a default nor fallback selected, the existing legacy provider controls remain available below; the rest of this guide describes those controls. Your legacy settings and per-character voice assignments are preserved. Existing voice IDs are not converted between backends and may be unsupported on a newly selected provider. The selected-connection **Preview** tests its default voice, not the saved per-character assignments.

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
| PocketTTS         | http://localhost:8000     | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

For **ElevenLabs**, the **Model** field loads the speech-capable models available through your connection and always keeps the full list visible when you open it. Pick a normal speech model. Model IDs that contain `ttv` are voice-design models, not speech models, and they cannot read text out loud. If you choose one by mistake, playback fails with an error that tells you to use a speech model instead.

### PocketTTS is a separate program

PocketTTS is not built into Marinara Engine. Install [the official PocketTTS server](https://github.com/kyutai-labs/pocket-tts) separately, then start it with `uvx pocket-tts serve`. Marinara does not download or manage it for you.

The official server uses `http://localhost:8000` by default. Leave the **Base URL** on that value unless you changed the host or port. Marinara detects the official multipart `/tts` API automatically. Existing custom URLs for the [OpenAI-compatible PocketTTS wrapper](https://github.com/teddybear082/pocket-tts-openai_streaming_server) remain supported.

## Step 3: Choose a voice (Voice Option)

The **Voice Option** setting decides how voices are assigned:

- **One voice for all characters**: every speaker uses the same voice. This is the default.
- **Selected per character**: you give chosen characters their own voices.

### One voice for all characters

Pick the voice in the **All Characters Voice** field. The official PocketTTS server does not expose a voice-list endpoint, so Marinara shows its built-in voices and keeps a text field beside the dropdown for another built-in name or supported voice URL. Compatible wrapper servers can still return their own voice list and accept custom IDs or paths.

To load the real voice list from your provider, enter the connection details and click the **Refresh voices** button (the circular-arrow icon). You can do this before enabling playback. Refresh saves the current card first, so a newly entered API key is used immediately. Before you connect, the app shows a short built-in fallback list so the field is not empty. A provider error is shown instead of silently presenting that fallback as a successful refresh.

For **ElevenLabs**, you must pick a voice. Marinara loads the paginated account library, including personal, workspace, saved, and default voices. The picker has a search box and a permanently visible scrollbar when the library is longer than the panel. It also reports how many voices were loaded. The picker starts on "Select an ElevenLabs voice", and playback is blocked until you choose a real one.

### Selected per character

1. Set **Voice Option** to **Selected per character**.
2. The **Character Voices** table appears, with **Character** and **Voice** columns.
3. Click **Add character voice** to add a row.
4. Pick a character in the left dropdown and a voice in the right dropdown.
5. Repeat for each character you want to give a custom voice.

You can also pick a character's voice in the **Character Editor**, on its **Voice** tab. It changes the same row, so both places always show the same voice.

The **Refresh** button in the Character Voices box reloads the same provider library without switching back to the one-voice mode. You must create your characters first. If you have none yet, the app tells you to add characters in the Characters tab before assigning voices. A character without a personal voice uses one set for a card with a matching name, such as the original of an AU copy. Otherwise it falls back to the global voice. See [Creating and Editing Characters](../characters/creating-and-editing-characters.md).

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

- OpenAI-compatible: 0.25 to 4.0 times normal speed.
- PocketTTS: compatible wrappers can use the 0.25 to 4.0 speed setting; the official server currently controls synthesis speed itself.
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

The same playback settings also let you **Skip text inside HTML and custom tags**, **Skip fenced code blocks**, or **Skip text inside square brackets**. Code blocks are skipped by default; the other two filters start off. Tag filtering removes the enclosed text, such as a hidden `<simulation>...</simulation>` block, while preserving speaker tags used to select voices. These filters apply to manual playback and auto-play, including Game narration and Roleplay speaker extraction.

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

If a character or persona name is spelled in a way the voice mispronounces, you can add a **Phonetic name**. In the **Character Editor**, the field is on the **Voice** tab. In the **Persona Editor**, it sits with the other basic info fields. Type how the name should sound.

This override is used only during Conversation audio and video calls. The regular per-message **Speak** button, chat auto-play, and Game Mode narration do not read this field.

## Troubleshooting

- Nothing speaks: confirm the **Enable TTS** switch is on. Then check the right per-mode **Auto-play** toggle, or use the per-message **Speak** button. The **Speak** button and auto-play options only appear after TTS is enabled.
- No voices in the dropdown: save the card with TTS enabled and a valid API key, then click **Refresh voices**. The official PocketTTS server uses Marinara's built-in list because it has no voice-list endpoint. For a compatible PocketTTS wrapper, verify that `<Base URL>/v1/voices` responds.
- ElevenLabs will not speak: make sure you selected a real voice, not the "Select an ElevenLabs voice" placeholder. Also check that the **Model** is a speech model, not a voice-design model whose ID contains `ttv`.
- A self-hosted TTS server on a local address is blocked: turn on the server setting `TTS_LOCAL_URLS_ENABLED`. It lets the app reach a local or private address for OpenAI-compatible or ElevenLabs-style servers. PocketTTS does not need this setting. See [Server Configuration Reference](../CONFIGURATION.md).
- Test your setup fast: click the **Preview** button in the card to play a short sample line with your current settings.

## Custom voices (optional API profiles)

Some OpenAI-compatible endpoints can **register new voices from a short recording** using the generic `openai-compatible` or `vllm-omni` custom-voice profile. Marinara manages these per audio connection through a **Manage custom voices** dialog, opened directly from **Connections → Text to Speech** after selecting a saved Audio connection, or from the connection editor. The dialog is available only for audio connections that use the **OpenAI-compatible** source; other sources show a short explanation of why custom voices are not available.

- **The profile is explicit, not model-name-based.** Registration is gated by an opt-in **custom-voice profile** stored with the connection (`openai-compatible` or `vllm-omni`), not by the provider name or the configured model name. A bare OpenAI-compatible endpoint starts in an _unknown_ state: select a profile matching your server to unlock the upload form. Enabling a profile declares the protocol; it does not prove the server supports registration. Missing voice-management endpoints surface a capability error without disabling ordinary speech. This keeps the feature opt-in and avoids guessing from a model string.
- **Uploads are validated locally and on the server.** The manager accepts **16-bit WAV PCM** — 1 to 2 channels, 8,000–48,000 Hz, up to 10 MiB and up to 120 seconds. Each upload requires a **display name** and a permission acknowledgement; the acknowledgement does not verify consent. The `vllm-omni` profile additionally requires a **provider-issued consent recording ID** (never fabricated by the app) and accepts a transcript of up to 10,000 characters. The generic profile sends only `name` and `audio_sample` as multipart fields to `/audio/voices`, without a consent ID or transcript. Marinara does not retain the recording or these sensitive fields.
- **Audio is backend-owned.** Marinara retains connection-bound management metadata (identifier, display name and status), not the recording, transcript or consent ID. Personal settings/backups may preserve assigned provider IDs, but exclude the separate management records and backend-held audio. Ordinary character/chat/package sharing does not gain custom voice metadata or recordings. Explicit, backend-confirmed deletion clears only matching assignments on that connection, including saved per-source voice selections; unassigning or deleting a character does not delete provider storage. If the backend confirms deletion but local cleanup fails, the manager keeps a deleted record: refresh, review the remaining references and confirm deletion again to retry local cleanup without another backend delete. Keep the supported API profile selected for deletion.
- **The in-app “Test” is explicit synthesis, not acoustic verification.** Enter a test line and press **Test** to synthesize through the same saved connection and selected identifier. A successful fake-backend test proves wiring, not cloning quality. Real-backend acoustic validation has **NOT RUN** for this change.
- **Manual acoustic check (requires separate authorization):** use a disposable instance, a permitted recording and a non-production backend whose loaded model supports registration. Confirm the destination and profile, preview the WAV locally without network activity, supply genuine provider consent and any required transcript for the vLLM profile (neither is sent for the generic profile), then explicitly register. Verify the intended identifier through provider listing, close/reopen and assign through the existing picker. Explicitly synthesize and listen for matching identity, intelligibility, noise and clipping; record backend/model versions. Verify stale-connection refusal, response-loss reconciliation and confirmed deletion of only matching references. Check sharing exports exclude sensitive voice data. Do not use production recordings/accounts or treat HTTP success as an acoustic pass.
- **Concurrent edits are isolated.** The manager works against a snapshot of the connection and saved custom-voice profile revision. If either changed behind the scenes (even if the profile was switched back), a mutation is rejected as a stale-snapshot conflict and the manager asks you to refresh rather than silently using an outdated confirmation. Saving a different profile, or refreshing a changed snapshot, clears outstanding permission and deletion confirmations.

### Generic OpenAI-compatible server (including VoxCPM2)

1. Save an **Audio** connection using the **OpenAI-compatible** source, base URL `http://<server>:3042/v1`, and model `voxcpm` (or the model your wrapper accepts). Use an address reachable by Marinara's server; container-local `127.0.0.1` is usually not the host. For a private/local address, the server administrator must set `TTS_LOCAL_URLS_ENABLED=true` in Marinara's runtime `.env` file. The connection's **Treat as local/custom endpoint** switch does not grant this permission, and `PROVIDER_LOCAL_URLS_ENABLED` alone is not enough. **OpenAI-compatible** describes the API format, not the company hosting your server; it includes VoxCPM2 and other compatible backends. Set **Audio Format** to **WAV** for ordinary playback too: this wrapper supports WAV/PCM, not Marinara's default MP3.
2. Select the connection under **Connections → Text to Speech**. **Refresh** enumerates `GET /v1/audio/voices` list responses (`data` entries with `id` and `name`); existing IDs can be selected through the character voice picker without enrollment.
3. Open **Manage custom voices**, select **OpenAI-compatible (name + audio sample)**, and save the profile. Preview a permitted PCM16 WAV locally, supply its display name, acknowledge permission and explicitly upload.
4. Marinara sends `POST /v1/audio/voices` with a generated `marinara_…` identifier as `name` and the clip as `audio_sample`. The display name remains local. The matching provider response/list confirms the resulting ID; select it in the existing character voice picker. **Test** uses the same connection's `/v1/audio/speech`, passing the ID as a string and requesting WAV, avoiding raw-PCM sample-rate assumptions.
5. To replace a managed clone, explicitly confirm deletion and its affected assignments, then enroll the new clip and reassign the new ID. Marinara never sends `overwrite=true`. Existing provider voices remain selectable but are not adopted for deletion; only voices enrolled by Marinara can be deleted here.

The generic profile expects `{ object: "list", data: [{ id, object: "audio.voice", name }] }` for listing and `{ id, object: "audio.voice", name, created: true }` for enrollment. The returned ID may differ from the submitted name. An uncertain response keeps the journaled registration name for refresh/recovery instead of blindly uploading again; only an unambiguous matching provider entry can confirm it. The provisional registration name is not proof of ownership of a provider ID: deletion is blocked until the actual identity is confirmed. There is no automatic character-clip import, in-place replacement, or cloning via `/audio/clone`; this flow reuses the existing upload manager and character voice-ID assignment.

## Related guides

- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Supported AI Providers](../connections/providers-reference.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Server Configuration Reference](../CONFIGURATION.md)
