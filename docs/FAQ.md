# Frequently Asked Questions

---

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

<details>
<summary><strong>How do I access Marinara Engine from my phone or another device?</strong></summary>
<br>

If Marinara Engine is running on one device (your PC, a server, etc.) and you want to use it from a phone, tablet, or another computer on the same network:

## 1. Make sure the server is bound to all interfaces

The shell launchers (`start.sh`, `start.bat`, `start-termux.sh`) already bind to `0.0.0.0` by default. If you started manually with `pnpm start`, set `HOST=0.0.0.0` in your `.env` file first. See the [Configuration Reference](CONFIGURATION.md) for details.

## 2. Configure access control

Loopback (`127.0.0.1`) works without a password, ordinary LAN clients require authentication by default, and Tailscale plus Docker bridge clients are trusted by default for private installs. Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` in `.env`, then restart Marinara if you want LAN users to sign in. Set `BYPASS_AUTH_TAILSCALE=false` or `BYPASS_AUTH_DOCKER=false` if you want those clients to sign in too. For privileged actions from that browser, also set `ADMIN_SECRET` and save it in **Settings -> Advanced -> Admin Access**.

You can restore the old unauthenticated LAN behavior with `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`, but only do this on a network you fully trust. For a step-by-step walkthrough covering Basic Auth, IP Allowlist, and the private-network bypass, see [Remote Access — Setting Up Basic Auth or an IP Allowlist](REMOTE_ACCESS.md).

## 3. Find your host device's local IP address

| Platform | Command                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Windows  | `ipconfig` → look for **IPv4 Address**                                  |
| macOS    | System Settings → Wi-Fi → your network, or run `ipconfig getifaddr en0` |
| Linux    | `hostname -I` or `ip addr`                                              |
| Android  | Settings → Wi-Fi → tap your network to see the IP                       |

### 4. Open a browser on the other device

Navigate to:

```
http://<host-ip>:7860
```

For example: `http://192.168.1.42:7860`

## 5. (Optional) Install the PWA

Most mobile browsers will offer an **"Add to Home Screen"** or **"Install App"** prompt, giving you a more native app experience without browser chrome. On iPhone and iPad, see the [iOS / iPadOS PWA Guide](installation/ios-pwa.md).

### Not on the same network?

Tools like [Tailscale](https://tailscale.com/) give each device a stable IP address on a private overlay network, so you can access Marinara Engine from anywhere without exposing it to the public internet.

### Still not connecting?

- Verify both devices are on the same Wi-Fi network.
- Confirm `HOST=0.0.0.0` and, for ordinary LAN access, Basic Auth credentials are set on the server.
- Check that no firewall is blocking the configured port (default `7860`).
- See the [Troubleshooting](TROUBLESHOOTING.md#app-not-loading-on-mobile--another-device) page for more help.

### Using Music DJ with Spotify on a LAN install?

Spotify's OAuth rules only allow `https://` or `http://127.0.0.1` redirect URIs, so the agent editor will show a `127.0.0.1` URI even when you're accessing Marinara from another device. Either put the server behind HTTPS or use the paste-back fallback in the agent editor — both flows are covered in [Music DJ Spotify login fails on a remote or LAN install](TROUBLESHOOTING.md#music-dj-spotify-login-fails-on-a-remote-or-lan-install).

</details>

---

<details>
<summary><strong>Is the Android APK a standalone app?</strong></summary>
<br>

Not exactly. The Android APK is a Termux bootstrap + WebView shell, not a native Android server build.

The APK opens `http://127.0.0.1:<PORT>` on the same Android device. If the Termux server is already running, it loads immediately. If not, the APK can help launch setup through Termux.

Fast path:

1. Install the APK from GitHub Releases.
2. Open it and tap **Install / Start Marinara**.
3. Approve Android's install prompts if Marinara needs to install Termux from F-Droid.
4. Grant **Run commands in Termux environment** if Android asks.
5. If Termux blocks external commands, paste the copied `allow-external-apps` command into Termux once.
6. Wait for Termux to install/build/start Marinara Engine, then return to the APK.

Manual fallback: follow the [Android (Termux) Installation Guide](installation/android-termux.md) so Termux creates or enters the `Marinara-Engine` folder first, then run `./start-termux.sh` from inside that folder and open the APK as a dedicated home-screen shell.

</details>

---

<details>
<summary><strong>What can Professor Mari do?</strong></summary>
<br>

Professor Mari is Marinara Engine's built-in Home assistant. She can explain the app, help with setup, create characters and personas, create or update lorebooks, create prompt presets, start new Conversation or Roleplay chats, navigate panels, fetch existing items so she can review or update them, use read-only Fandom/MediaWiki lookups, and use the approval-gated Home workspace for themes, agents, presets, lorebook entries, and local workspace changes. She is a guide and helper, not a replacement for the docs or release notes when something is version-specific or recently changed.

Editing existing content needs more care than creating new content. Ask Mari to fetch the character, persona, lorebook, chat, or preset before editing it, and give her the specific field or behavior you want changed. Character and persona edits keep recoverable version snapshots.

She cannot currently submit GitHub issues from inside the app, complete the whole Game Setup Wizard through hidden commands, or automatically ingest the latest GitHub docs into her own prompt.

See [Professor Mari](PROFESSOR_MARI.md) for the full capabilities and safety notes.

</details>

---

<details>
<summary><strong>How do I set up Conversation audio calls?</strong></summary>
<br>

Conversation audio calls are only available in Conversation Mode. They need three pieces: calls enabled for the chat, Text to Speech for character voices, and an audio input mode if you want to speak through your microphone.

Quick setup:

1. Open **Connections -> Text to Speech**, enable TTS, choose a source, save it, and confirm the preview plays.
2. If you want local microphone transcription, open **Connections -> Local Model**, expand the card, find **Local Speech Model**, choose Whisper Tiny or Whisper Base, then click **Download Whisper**.
3. Open the Conversation chat, go to **Chat Settings -> Commands -> Conversation Calls**, and enable **Audio/Video Calls**.
4. Enable **Call Audio Pipeline** if you want mic input.
5. Pick an **Audio input mode**:
   - **Mic recording + Local Whisper** for local hands-free transcription. This is the best fallback for Firefox.
   - **Browser speech recognition** where Web Speech is supported.
   - **Manual system dictation** if you want your OS dictation to type into the call input.
   - **Provider-native audio/video** only when the selected Conversation model supports native media input.

The phone button lets you start a call. The separate **Calls** command toggle controls whether characters are allowed to ring you first. Turning off that command does not stop you from calling them.

See [Conversation Audio Calls](CONVERSATION_CALLS.md) for the full guide.

</details>

---

<details>
<summary><strong>Which AI providers are supported?</strong></summary>
<br>

Marinara Engine supports a wide range of LLM and image generation providers:

- **LLM:** OpenAI, OpenAI ChatGPT subscription login, Anthropic, Anthropic via Claude Pro / Max subscription through the local Claude Agent SDK, Google Gemini, Google Vertex AI, OpenRouter, NanoGPT, Mistral, Cohere, xAI / Grok, and any custom OpenAI-compatible endpoint (Ollama, LM Studio, KoboldCpp, etc.).
- **Image generation:** OpenAI DALL-E / GPT Image, Stability AI, Together AI, NovelAI, OpenRouter Images, xAI / Grok Imagine, Pollinations, Stable Horde, AUTOMATIC1111 / SD Web UI, ComfyUI, RunPod Serverless ComfyUI, Draw Things, NanoGPT, Block Entropy, and providers that support image output through their chat API.
- **Video generation:** Google AI Studio Gemini Omni / Veo, xAI Imagine, OpenRouter video models, Seedance 2.0, and other supported Video Generation connection services.

You can configure multiple connections at once and assign different providers per chat. API keys are encrypted at rest with AES-256.

</details>

---

<details>
<summary><strong>How do Game Mode storyboard animations work?</strong></summary>
<br>

Storyboards are created after GM narration turns are created when you enable automation, or manually from the Gallery.

To manually create a storyboard, open **Gallery** and click **Create storyboard** for the latest GM narration, or to recreate the current storyboard. The Prompt Director splits the turn into keyframes using the chat's selected storyboard prompt style and generates each keyframe illustration. It also creates animation clips when **Automatic Storyboard Animations** is enabled and a Video Generation connection is available. The floating storyboard viewer follows the current story section as you read, and it can be closed, dragged, resized, paused, muted, or reopened from the Gallery by clicking **View storyboard**.

Automatic generation is off unless Visual Generation enables it during setup or you turn it on later. Enable **Chat Settings -> Agents -> Storyboards -> Automatic Storyboard Illustrations** if you want Marinara to create keyframe images after each completed GM turn. Enable **Automatic Storyboard Animations** too if you also want animations. In the same Storyboards card, choose **Illustration Prompt** for still/manual boards and **Animation Prompt** for video-enabled boards; built-in presets include Still Keyframes, Comic Page, Colored Manga, and B&W Manga. In **Chat Settings -> Agents -> Scene Videos**, choose **Game Video Prompt** to control how scene/storyboard images become motion.

See [Storyboard Engine Guide](STORYBOARD_ENGINE_GUIDE.md) for the user workflow, or [Scene Video Generation](SCENE_VIDEO_GENERATION.md#game-mode-turn-storyboards) for provider setup, prompt-template keys, and troubleshooting.

</details>

---

<a id="why-doesnt-my-roleplay-character-remember-the-messages-from-our-connected-conversation"></a>

<details>
<summary><strong>Why doesn't my roleplay character remember the messages from our connected conversation?</strong></summary>
<br>

Connected chats (the link between a conversation and a roleplay or game) are intentionally **asymmetric** in how context flows:

**Roleplay → Conversation (automatic):** the roleplay's summary and recent messages are pulled into the conversation's context every turn, so DM characters always know what's happening in the story. Roleplay characters can also break the fourth wall back into the DM by wrapping text in `<ooc>...</ooc>` tags.

**Conversation → Roleplay (manual, via tags):** the conversation's raw messages are _not_ injected into the roleplay. To bridge content the other direction, the conversation character uses one of two OOC tags:

- `<influence>...</influence>` — one-shot steer for the _next_ roleplay turn, then consumed.
- `<note>...</note>` — durable; appears on every roleplay turn until you clear it from the chat settings drawer. Use this for facts the roleplay character should keep remembering.

This is by design — pulling raw DM messages into every roleplay turn would inflate the prompt and dilute the story. If you want something from the DM to stick in the roleplay, ask the conversation character to wrap it in a `<note>`.

</details>

---

<a id="how-do-i-use-one-lorebook-with-multiple-characters"></a>

<details>
<summary><strong>How do I use one lorebook with multiple characters, or scope it to a specific chat?</strong></summary>
<br>

Marinara has three different ways to scope a lorebook, each at a different level. Pick whichever matches your use case:

**1. Bind a lorebook to characters or personas** (lorebook editor -> **Linked Characters** / **Linked Personas**).

The lorebook auto-activates in any chat that includes any linked character or uses any linked persona. Both fields are multi-select, and you can use both on the same lorebook. Best when the lore is specifically _about_ those characters or personas.

**2. Attach lorebooks per-chat via the chat settings drawer** (gear icon → **Lorebooks** section → **+ Add Lorebook**).

Multi-select. Use this when you want one lorebook scoped to one specific chat, or when you want several lorebooks layered together for a single chat. The lorebook's **Linked Characters** / **Linked Personas** fields can be empty for this — chat attachment is independent of those links.

**3. Filter individual entries by character** (lorebook entry editor -> **Context filters & matching sources** -> **Characters** / **Character tags**).

Inside a single shared lorebook, you can mark each entry as only firing when specific characters (or character tags) are present in the chat. Best for a "world bible" lorebook shared across many chats where some entries are character-specific.

**Common scenario — "I want this lorebook for Character A _and_ Character B":** add both under **Linked Characters**. If the scope is chat-specific instead of character-specific, attach the lorebook via the chat settings drawer.

</details>

---

<details>
<summary><strong>Does retrying agents rerun every agent or just one?</strong></summary>
<br>

It depends which retry button you use.

**Re-run Trackers** in the Roleplay HUD's Agents menu keeps the original broad behavior: it reruns all active tracker agents for that chat. Use this when the overall HUD state feels stale.

Individual tracker controls are narrower. If you open a specific HUD widget and rerun it from there, Marinara sends only that tracker through the retry pipeline.

Other retry controls are also scoped to what they say on the button: **Retry Failed Agents** retries the failed agents from the last generation, while Injections-tab re-runs only refresh the selected cached prompt injection for the current assistant message.

</details>

---

<details>
<summary><strong>Does Marinara Engine have Guided Generation / Swipes / Regen?</strong></summary>
<br>

Yes. Use `/guided <direction>` when you want to steer the AI's next reply without speaking as your persona. It sends your text as hidden story direction, like `/guided make Alex interrupt` or `/guided move the scene toward the market`.

For swipes and regens, enable **Settings -> Advanced -> Guide swipes/regens with chat input**. Then the current chat-box draft is used as guidance when you click **Regenerate**, create a new swipe/reroll, or manually trigger a character response in a group chat.

Guided `/guided` requests and guided manual character replies use Chat reply lorebook triggers. If an older lorebook entry was attached to Continue or Autonomous only so it could steer guided replies, move that entry to Chat reply.

If you want to post your persona message first without triggering a reply, enable **Settings -> Advanced -> Quick replies menu** and include **Post only**. The same settings submenu can include **Guide reply** for a quick `/guided` send and **Impersonate** for generating as your persona.

</details>

---

<a id="what-happens-if-i-enable-an-agent-and-also-have-similar-instructions-in-my-preset"></a>
<a id="what-happens-if-i-add-an-agent-and-also-have-similar-instructions-in-my-preset"></a>

<details>
<summary><strong>What happens if I add an agent to a chat and also have similar instructions in my preset?</strong></summary>
<br>

Both contribute to the prompt, but in different ways: a preset section is static text concatenated every turn, while an agent runs at request time and produces its own output. If both target the same behavior, the model receives both — usually redundant, occasionally conflicting, and always extra tokens.

Common overlaps to watch for:

- Writing-style or anti-repetition directives in the preset and the **Prose Guardian** agent.
- Plot-steering, twist, pacing, or "what should happen next" directives in the preset and the **Narrative Director** agent, including its Secret Plot option.
- "Track time / weather / location" instructions and the **World State** agent.
- "Track character mood / outfit / stats" instructions and the **Character Tracker** agent.
- Quest-tracking, combat-mechanics, or persona-stat instructions and their respective agents.
- HTML/CSS visual-styling prompts and the **Immersive HTML** agent.
- "Summarize past events" instructions and the manual or automated summary tools.

**The general rule:** pick one place to express each behavior. If you've added an agent that covers a behavior, you can usually remove the matching preset directive. If you'd rather keep your preset version (e.g., it's tuned for a particular character), remove the corresponding agent from that chat or turn off the related chat-level option.

For story direction, choose the tool by how persistent you want the guidance to be. Use **Narrative Director** for occasional next-beat steering. Turn on its **Secret Plot** option when you want hidden long-term arc memory and scene directions across turns. Use a preset only when the instruction should be static every turn.

**One important exception:** the `agent_data` marker section, and the `{{agent::TYPE}}` macro, are the _intended_ way to thread an agent's output into a specific spot in the preset. That's wiring, not overlap — several agents (World State, Quest Tracker, Character Tracker, and others) set this up for you by default. The pattern to avoid is hand-writing preset sections that duplicate an agent's _behavior_, not using the marker section that carries the agent's _output_.

</details>

---

<a id="how-do-i-read-the-documentation-inside-the-app"></a>

<details>
<summary><strong>How do I read the documentation inside the app?</strong></summary>
<br>

Every Marinara install ships with the full set of guides you are reading right now: installation, configuration, troubleshooting, macros, extensions, Game Mode, and more. You can read them without leaving the app:

- **From the home page footer:** click the **Documentation** button next to **Replay Tutorial**.
- **From the FAQ:** open the "Where can I find documentation?" entry and click **Open Documentation**.

The in-app viewer lists every guide and renders it directly in Marinara. The same guides also live on disk as regular markdown files in the `docs` folder inside your Marinara install folder, and both the FAQ entry and the viewer show the exact folder path for your install.

</details>
