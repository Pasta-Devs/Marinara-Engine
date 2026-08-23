# Frequently Asked Questions

This guide answers the questions people ask most about Marinara Engine. Answers are grouped by topic. Each one links to a full guide when you want more detail.

## How do I access Marinara Engine from my phone or another device?

Marinara Engine runs as a local server on one computer. You open it in a web browser. This answer covers access from phone, tablet, or another computer on the same network.

The start scripts (`start.sh`, `start.bat`, and `start-termux.sh`) already bind the server to all network interfaces (`0.0.0.0`). Other devices can reach the server over the network, but access control blocks them by default. Until you set up access on the host computer, a remote device only sees an **Access blocked** page with setup instructions.

Follow these steps:

1. Keep Marinara running on the host computer.
2. On the host computer, set up access control: Basic Auth (a username and password) or an IP allowlist (a list of trusted device addresses). [Remote Access](REMOTE_ACCESS.md) walks through each option, including a bypass for fully trusted private networks.
3. Find the host computer's local IP address. On Windows, run this command and read the **IPv4 Address**:

```
ipconfig
```

On macOS or Linux, run this command:

```
hostname -I
```

4. On the other device, open a web browser and go to your host IP followed by the port. The default port is `7860`:

```
http://192.168.1.42:7860
```

Replace `192.168.1.42` with your own host IP address.

5. Sign in if the browser asks for the Basic Auth username and password. If you see an **Access blocked** page instead, finish step 2 on the host first.

On ordinary desktop installs, the same computer (`127.0.0.1`) does not need a password. APK-managed Android installs add a private localhost login so another Android app cannot impersonate Marinara, but the Android wrapper creates and uses that credential automatically. Other devices are blocked until you set up access control (Basic Auth or an IP allowlist). Each option is explained in [Remote Access](REMOTE_ACCESS.md).

If the two devices are not on the same network, a tool like Tailscale can help. Tailscale gives each device a stable private address. You can then connect from anywhere without exposing Marinara to the public internet. If you cannot connect, see [Troubleshooting](TROUBLESHOOTING.md).

## Is there a mobile app for Marinara?

There is no separate native mobile app. On a phone or tablet, you use the same web app in a browser. Most mobile browsers offer an **Add to Home Screen** or **Install App** option that makes it feel like a real app, with no browser bar. This is called a PWA (Progressive Web App, a website you can install like an app).

On Android, you can also [download the latest APK directly](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). It runs Marinara locally on the phone through Termux. Installing it does not require a signing key, password, or local-access secret; see [Android Installation](installation/android-termux.md) for the Android permission prompts. On iPhone and iPad, see the [iOS PWA Guide](installation/ios-pwa.md).

The Android wrapper signs in automatically when it opens its APK-managed Termux server. The private credential is only visible to users who intentionally open the server in another browser on that phone: open `/android-login`, run `cat ~/.marinara-engine/android-secret` in Termux, and paste the displayed value. The local `mari` CLI reads that same launcher-managed secret automatically. Manual Termux installs keep the normal localhost and network-access rules.

## What are the three chat modes?

Marinara has three chat modes, shown as tabs when you open the chat list:

- **Conversation**: a texting or direct-message style chat, like messaging a character in a chat app.
- **Roleplay**: an immersive story scene with narration, character avatars, and optional character art.
- **Game Mode**: a guided text adventure run by a game master, with optional scene images and video.

Each mode has its own getting-started guide. Start with the mode you want, then explore its deep-dive guides.

## How do I change the timezone used by Conversation schedules?

Open a Conversation and choose **Schedule timezone** in Chat Settings, or choose it while creating schedules in the Conversation setup flow. Marinara starts with the timezone reported by your device, but you can select any supported IANA timezone or choose **Use device** to reset it. This is one global preference for all Conversation chats, including server-side autonomous messages, and it syncs to other devices connected to the same Marinara server.

## Does each Conversation chat have its own schedule?

No. A schedule belongs to the character, and every Conversation chat with that character uses the same one. Edit it in **Character Editor -> Convo -> Weekly schedule**, or from the schedule controls in Chat Settings; either way the change applies everywhere.

To get instant replies in one chat, open its Chat Settings and turn **Conversation schedules** off. That switch is per chat. The character stays available in that chat, keeps its schedule, and your other chats do not change. An active manual status override still takes precedence and applies in that chat, including an override such as **dnd**.

Existing chats that never used schedules stay off until you turn them on. New chats you start with a character that has a schedule use it from the start.

A manual status override also belongs to the character. If you set a character to **online** in one chat, the character is online in every chat. Use **clear** to remove the override.

## Do I need an API key to use Marinara?

Almost always, yes. A **connection** is a saved link that tells Marinara how to reach one AI service: which provider, which model, and your login for it. An **API key** is a secret code, a bit like a password. You get it from an AI provider so Marinara can talk to that provider for you.

You need at least one connection before you can start any chat. To make one, open the **Connections** panel, click **New**, pick a provider, paste your **API Key**, and pick a model. For the full walkthrough, see [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

A few providers do not use an API key at all. The subscription options (Claude, ChatGPT, and Grok) log in through a command-line tool instead, and the built-in Local Model runs on your own machine with no key.

## Which AI providers are supported?

Marinara supports many providers. You pick one per connection.

For chat and roleplay text, the choices are **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok**, and **Custom (OAI-Compatible)** for local or self-hosted models such as Ollama, LM Studio, and KoboldCpp.

For image generation, the choices include **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT**, and **Block Entropy**.

For video generation, the choices are **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0**, and local **ComfyUI** API-format workflows.

You can save many connections at once and assign a different one to each chat. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

## Do I have to pay to use Marinara?

Marinara itself is free and runs on your own computer. You pay whatever your chosen AI provider charges, which varies by provider and model.

Some options cost nothing to try. **Pollinations** image generation needs no key. **Stable Horde** is free, and a key is optional for faster priority. The built-in **Local Model** runs on your machine with no key. The subscription options (Claude, ChatGPT, and Grok) use a paid plan you may already have, instead of a pay-per-use API key.

## Are my API keys safe?

Yes. Every API key is encrypted with AES-256 before it is saved on disk. Connection and profile exports strip secret
values. A full backup is different: it contains the encrypted records and, when present, the encryption-key file
needed to unlock them, so keep full backup ZIPs private.

Because profile import intentionally leaves secret values out, you must re-enter each API key after importing a
profile, including when you use **Import Profile** on a full backup ZIP. A manual full data-folder restore preserves
the encrypted keys when its matching encryption-key file is restored too.

## What is a character card?

A **character card** is the saved profile of an AI character: its name, avatar, personality, backstory, and greeting. You create and edit cards in the **Character Editor**. You can also import cards made in other apps. See [Creating and Editing Characters](characters/creating-and-editing-characters.md).

## What is a lorebook, and how do I use one with several characters?

A **lorebook** is a set of world-info entries. Each entry adds facts to the prompt only when its trigger words appear in the chat. This saves tokens and keeps lore consistent. There are three ways to scope one lorebook. Pick the one that fits:

1. Link it to characters or personas. In the lorebook editor, fill in **Linked Characters** or **Linked Personas**. The lorebook then activates in any chat that includes a linked character or uses a linked persona. Both fields accept more than one entry, so add every character you want.
2. Attach it to one chat. Open **Chat Settings**, find the **Lorebooks** section, and use **Add Lorebook**. Use this when the lore belongs to one specific chat.
3. Filter single entries by character. Inside a shared lorebook, you can mark each entry to fire only when certain characters are present. This suits a large world lorebook where some entries are character-specific.

For the full feature, see [Lorebooks](lorebooks/overview.md).

## What is an agent?

An **agent** is an optional AI helper that runs during a chat to do a focused job. Examples include tracking the current scene, watching writing quality, adding maps or calls, or running a Conversation table game. Fresh installations have no optional agents. Open the **Agents** panel, click **Download Agents**, read an item's details, and install it. Then enable compatible agents per chat in **Chat Settings**. When an installed official package has a compatible update, Marinara asks before downloading it. Choosing **No** keeps the current version and leaves **Update** available in Download Agents for later. If the host is offline or verification fails, the installed version keeps working. The catalog also handles complete package removal. See [Agents](agents/agents-overview.md) and the public [Marinara-Agents repository](https://github.com/Pasta-Devs/Marinara-Agents).

## How do I set up Noodle?

Noodle is Marinara's local, fictional social network for your characters. First open **Agents** → **Download Agents** and install **Noodle & NoodleR**, then restart Marinara when prompted. Open **Home** → **Noodle**, enter its **Settings**, invite characters or character folders, choose a generation connection under **Refresh**, then select **Refresh now** to generate the first activity. You can also set automatic refresh times, image generation, random users, and carryover into your chats.

See [Noodle: The In-App Social Timeline](noodle/overview.md) and [Noodle Settings and Chat Carryover](noodle/settings.md) for the full guides.

## Why doesn't my character remember earlier messages?

AI models can only hold so much text at once, so old messages fall out of view in long chats. Marinara has two memory systems that help:

- **Memory Recall** searches earlier messages and quietly adds the most relevant bits back into the prompt. Turn it on in **Chat Settings** under **Memory Recall**.
- Summaries compress old messages into short recaps. Roleplay chats use **Chat Summary**, and Conversation chats use **Automatic Summarization**.

For setup and details, see [Memory and Summaries](agents/memory.md).

## How do I back up my data?

Open **Settings**, go to the **Advanced** tab, find the **Backup & Export** section, and click **Download Backup**. This saves a single `.zip` archive with your data and your uploaded files. To restore it later, use **Import Profile (JSON/ZIP)** in **Settings** under the **Imports** tab and choose the same `.zip`.

You can also enable a rotating daily, weekly, or monthly automatic backup in the same section. Full backup ZIPs can
contain the encrypted records and the key file needed to unlock them, so keep them private. **Import Profile** still
leaves provider secrets blank, so re-enter keys after importing. For the full guide, see
[Backing Up and Restoring](data/backup-and-restore.md).

## How do extensions work, and can I import third-party code?

By default, only Professor Mari can create a Personal Extension draft for you. It starts disabled, and you must inspect its code and approve the exact SHA-256 hash before it runs.

Browser code uses a dedicated Worker inside an opaque-origin iframe by default. In addition to narrow logging, private-storage, timer, cleanup, and declarative UI capabilities, it receives the opaque IDs of the currently active chat and Characters so extensions such as Notepad can keep chat-specific state. A Browser Extension may separately request bounded snapshots of only the Character cards participating in that chat and/or the Persona selected for it. Those permissions are shown during exact-hash approval; without them, the corresponding records are absent. Sandboxed extensions never receive messages, whole Character or Persona libraries, undeclared fields, chat metadata, DOM access, network access, or mutation APIs. Server code runs in a separate OS-sandboxed process on supported macOS and Linux hosts and does not receive browser chat context.

Third-party imports are hidden by default. The host operator must set `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env`, then the user must accept the warning under **Settings → Advanced → Danger Zone**. Until both gates are open, external records—including manually stored and profile-imported records—do not appear, cannot be approved, and cannot execute.

An External Extension may request **Full page access** when legacy compatibility genuinely requires Marinara's DOM. This is not sandboxed: the exact approved code runs in Marinara's page and can access page content, browser storage, network APIs, and the current same-origin session. Professor Mari drafts cannot request it. Enable it only after inspecting and trusting that exact version; reload after disabling if unregistered changes remain. See [Personal Extensions](extending/personal-extensions.md).

## Where is my data stored?

Everything lives on the computer running Marinara, inside the `data` folder in your install. Your characters, chats, personas, lorebooks, presets, and settings are all saved there. Nothing is stored in the cloud. See [Where Your Data Is Stored](data/where-data-is-stored.md).

## Will I lose my data when I update?

No. Updating Marinara keeps your characters, chats, and settings in place. It is still smart to make a backup before a big update, just in case. For update steps on each platform, see [Upgrading](UPGRADING.md).

## What can Professor Mari do?

Professor Mari is the built-in assistant on the Home screen. Open her with the **Ask Professor Mari** button. She can explain the app and help with setup. She can also create or edit your data when you ask in plain language: characters, personas, lorebooks, prompt presets (saved instruction templates), and new chats.

She also shows quick-reply suggestion chips above the input to guide multi-step creation and edits without making you type every detail by hand.

When she changes your data, a review card appears with **Keep** and **Restore** buttons, so you can undo anything you do not want. She is a helper, not a replacement for these guides when something is version-specific. For the full list of what she can do, see [Professor Mari](home/professor-mari.md).

Professor Mari can still edit ordinary Marinara source files. Dependency files, launchers, installers, and CI workflows wait for an explicit review instead. If her change needs a public npm library, Marinara shows the exact resolved version and registry integrity before installing it with lifecycle scripts disabled.

Note: on an ordinary remote address, Professor Mari's data-changing actions need both Basic Auth and an admin secret. Trusted or allowlisted network routes can use the bypasses described in [Remote Access](REMOTE_ACCESS.md).

## What is the Storyboard Agent, and how do I use it in Game Mode?

The downloadable **Storyboard** Agent turns completed story text into an ordered sequence of keyframe images and can animate each keyframe into a short clip. In **Game Mode**, it storyboards one finished GM narration turn and displays the frames in a floating viewer or as the Game background. In **Roleplay**, it combines newly completed exchanges into an inline episode.

To use it in Game Mode, install **Storyboard** from **Agents > Download Agents**. Open the Game, go to **Chat Settings > Agents**, turn on **Enable Agents** and **Enable Storyboards**, and set an image connection in the Game or the global Storyboard setup. Finish a GM narration turn, then open the **Gallery** and click **Create storyboard**. Use **View storyboard** to reopen its viewer.

For automatic Game Storyboards, turn on **Automatic Storyboard Illustrations**. Also turn on **Automatic Storyboard Animations** and select a Video Generation connection when you want clips. The new-game wizard's **Storyboard Optimized** presentation only shapes GM narration; it does not install or activate the Agent. For Game and Roleplay setup, prompts, viewers, migration behavior, and troubleshooting, see the [Storyboard Agent Guide](game/storyboard.md).

## Can characters talk out loud in a call?

Yes, in **Conversation** mode. Audio and video calls are a Conversation-only feature. To hear a character speak, first set up **Text to Speech** under the **Connections** panel.

If you want to talk back with your microphone and the browser's own speech recognition is unreliable, first install **Calls** from **Agents > Download Agents**. Then open the **Connections** panel, expand the **Local Model** card, find **Local Speech Model**, pick **Whisper Tiny (Multilingual)** or **Whisper Base (Multilingual)**, and click **Download Whisper**. Uninstalling Calls also removes its Whisper downloads to reclaim disk space. For the full call setup, see [Calls](conversation/calls.md).

## Can Marinara generate images?

Yes. Add an image generation connection, for example **Pollinations** (needs no key) or a paid provider. Marinara can then create character avatars, scene art, selfies, and Storyboard Agent keyframes in Roleplay or Game Mode. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md) to add one.

## How do I read the documentation inside the app?

Every install ships with the full set of guides. You can read them without leaving the app:

- On the Home screen, click the **Documentation** button in the footer, next to **Replay Tutorial**.
- In the Home FAQ, open the documentation question and click **Open Documentation**.

Both buttons open the same in-app viewer. It lists every guide and renders it inside Marinara.

## Where do I get help or report a bug?

Start with [Troubleshooting](TROUBLESHOOTING.md), which is organized by symptom. On the Home screen footer, the **Discord** button opens the community chat and the **Support** button opens the project's support page. For bugs and feature requests, use the project's GitHub page.

## Related guides

- [Troubleshooting](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Remote Access](REMOTE_ACCESS.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
