# Frequently Asked Questions

Short answers to common questions about Marinara Engine. Each one links to the guide that has the full steps.

## How do I access Marinara Engine from my phone or another device?

Marinara runs as a server on one computer, and you open it in a browser. The start scripts let other devices reach the server, but access control blocks them until you set a login (a username and password) on the host computer. Until then, a remote device only sees an **Access blocked** page.

1. Keep Marinara running on the host computer.
2. Find the host's local IP address. On Windows, run `ipconfig` and read **IPv4 Address**. On macOS or Linux, run `hostname -I`.
3. On the other device, open `http://<host IP>:7860` in a browser, for example `http://192.168.1.42:7860`. `7860` is the default port.
4. Set a login. From the other device, open Marinara: the blocked page has a **Setup code** form. Find the one-time code in the server log on the host computer (in Docker, run `docker logs <container> 2>&1 | grep "setup code"`), then type it with a new username and password. Or, in a browser that is already signed in on the host, open **Settings → Advanced → Access**.
5. Sign in. To add more devices without typing the password, use **Add a device** in **Settings → Advanced → Access**.

The same computer (`127.0.0.1`) needs no password on ordinary desktop installs. A reverse proxy on the same computer counts as a remote visitor and needs the login. For all options, setup codes and Docker, see [Remote Access](REMOTE_ACCESS.md#option-1-login-recommended). For devices on different networks, use Tailscale: see [Connect from anywhere with Tailscale](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). If you cannot connect, see [Troubleshooting](TROUBLESHOOTING.md).

## Is there a mobile app for Marinara?

There is no separate native app. On a phone or tablet, use the web app in a browser. Most browsers offer **Add to Home Screen** or **Install App**, which saves it as a PWA (a website that opens like an app, with no browser bar).

On Android, you can also [download the latest APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). It runs Marinara on the phone through Termux. See [Android Installation](installation/android-termux.md). On iPhone and iPad, see the [iOS PWA Guide](installation/ios-pwa.md).

In the Android app, the launcher offers **Open in browser**, **Retry connection** and **Install / Start Marinara**. To change your choice later, use **Settings → General → App Behavior → Open Android launcher (app or browser)**. Older APKs sign in manually at `/android-login`.

## Can I play with other people?

Yes. Optional multiplayer lets several people share one Conversation, Roleplay or Game. Everyone turns on the setting and then hosts or joins. Guests need no AI key. A password does not make an unknown host safe. Read [multiplayer setup, warnings and limits](CONFIGURATION.md#optional-multiplayer) before you turn it on.

## What are the three chat modes?

- **Conversation**: a messaging-app style chat with a character.
- **Roleplay**: an immersive story scene with narration and character avatars.
- **Game**: a text adventure run by an AI game master.

See [Getting Started with Marinara Engine](home/welcome.md#choose-a-chat-mode) to pick one.

## How do I change the timezone used by Conversation schedules?

Open a Conversation, then choose **Schedule timezone** in Chat Settings. **Use device** resets it to your device's timezone. It is one global setting for all Conversation chats and syncs to other devices on the same server. See [Conversation Mode: Getting Started](conversation/getting-started.md).

## Does each Conversation chat have its own schedule?

No. A schedule belongs to the character, so every Conversation chat with that character uses it. Edit it in **Character Editor → Convo → Weekly schedule**.

To get instant replies in one chat, turn **Conversation schedules** off in that chat's Chat Settings. A manual status override such as **dnd** still applies, and it belongs to the character in every chat. Use **clear** to remove it.

## Do I need an API key to use Marinara?

Yes, for online AI services. An **API key** is a secret code from an AI service that lets Marinara use your account there. You need at least one account before you can start a chat. Open **Connections**, click **Add**, choose a service, paste your key and click **Connect**. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

Some options need no key. The subscription options (Claude, ChatGPT and Grok) sign in through a command-line tool. The **Built-in model** runs on your computer. See [Built-in model setup](connections/local-model.md).

## Which AI providers are supported?

Marinara supports OpenAI, Anthropic, Google Gemini, OpenRouter and many more services for text, image and video generation, plus **OpenAI-compatible** servers such as Ollama, LM Studio and KoboldCpp. The full list is in [Supported AI Providers](connections/providers-reference.md). To add one, see [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

## Do I have to pay to use Marinara?

Marinara is free. You pay what your AI service charges. Some options cost nothing to try: **Pollinations** images need no key, **Stable Horde** is free, and the **Built-in model** runs on your computer. The subscription options use a paid plan you may already have.

## Are my API keys safe?

Yes. Every API key is encrypted with AES-256 before it is saved. Account and profile exports leave secret values out, so re-enter your keys after you use **Import Profile**, including on a full backup ZIP. A full backup ZIP holds the encrypted records and the key file that unlocks them, so keep it private. See [Backing Up and Restoring](data/backup-and-restore.md).

## What is a character card?

A character card is the saved profile of an AI character: name, avatar, personality, backstory and greeting. You make cards in the **Character Editor** or import them from other apps. See [Creating and Editing Characters](characters/creating-and-editing-characters.md).

## What is a lorebook, and how do I use one with several characters?

A lorebook is a set of world facts. Each entry joins the prompt only when its trigger words appear in the chat. You can:

1. Fill in **Linked Characters** or **Linked Personas** in the lorebook editor. It then works in any chat with them.
2. Open **Chat Settings → Lorebooks → Add Lorebook** to attach it to one chat.
3. Limit single entries to certain characters.

See [Lorebooks](lorebooks/overview.md).

## What is an agent?

An agent is an optional AI helper that runs during a chat to do a focused job, such as tracking the scene or adding maps. Fresh installs have none. Open **Agents → Agent Organizer**, pick one and install it. Then turn it on per chat in **Chat Settings**. See [Agents](agents/agents-overview.md).

## How do I set up Noodle?

Noodle is a local, fictional social network for your characters. Install **Noodle** from **Agents → Agent Organizer**, restart Marinara when asked, then open **Home → Noodle**. See [Noodle: The In-App Social Timeline](agents/noodle.md).

## Why does my character not reply?

Usually the chat has no account or model, the API key is wrong, or the account is out of credit. See [My character does not reply](TROUBLESHOOTING.md#my-character-does-not-reply).

## Why doesn't my character remember earlier messages?

Models read only so much text at once, so old messages drop out of long chats. Two tools help. **Memory Recall** brings relevant older messages back, and summaries compress old messages into recaps. Both are in **Chat Settings**. For long Roleplay chats, use **Advanced Memory Recall** in **Chat Settings → Memory Recall**. See [Memory and Summaries](agents/memory.md).

## How do I back up my data?

Open **Settings → Advanced → Backup & Export** and click **Download Backup**. This saves a `.zip` of your data and uploads. To restore, use **Import Profile (JSON/ZIP)** under **Settings → Imports**. The same section can run a daily, weekly or monthly backup. See [Backing Up and Restoring](data/backup-and-restore.md).

## How do extensions work, and can I import third-party code?

Only Professor Mari creates Personal Extension drafts by default. A draft starts off, and you approve its exact code before it runs. Third-party imports are hidden until the host sets `ENABLE_EXTERNAL_EXTENSIONS=true` in `.env` and you accept the warning under **Settings → Advanced → Danger Zone**. See [Personal Extensions](extending/personal-extensions.md).

## Where is my data stored?

On the computer that runs Marinara, in the `data` folder of your install. Nothing is stored in the cloud. See [Where Your Data Is Stored](data/where-data-is-stored.md).

## Will I lose my data when I update?

No. Updating keeps your characters, chats and settings. Make a backup first anyway. Going back to an older version can lose data that only the newer version stores. See [Upgrading](UPGRADING.md) and [Downgrading to an older version](UPGRADING.md#downgrading-to-an-older-version).

## What can Professor Mari do?

Professor Mari is the built-in assistant on the Home screen. She explains the app and creates or edits characters, personas, lorebooks and presets when you ask. Each change shows a card with **Undo**. See [Professor Mari](home/professor-mari.md).

## What is the Storyboard Agent, and how do I use it in Game Mode?

It turns finished story text into images. Install **Storyboard** from **Agents → Agent Organizer**, then turn it on in the chat. See the [Storyboard Agent Guide](game/storyboard.md).

## Can characters talk out loud in a call?

Yes, in Conversation mode. You need **Text to Speech** set up in **Connections**. See [Calls](conversation/calls.md) for the steps, including speech recognition for your microphone.

## Can Marinara generate images?

Yes. Add an image generation account, such as **Pollinations** (no key needed) or a paid service. See [Connecting to an AI Provider](connections/connecting-to-a-provider.md).

## How do I read the documentation inside the app?

On the Home screen, click **Documentation** in the bookmarks. On a phone, open the bookmarks menu first. In the Home FAQ, you can also click **Open Documentation**.

## Where do I get help or report a bug?

Start with [Troubleshooting](TROUBLESHOOTING.md). On Home, **Discord** opens the community chat and **Support** opens the project's support page. Report bugs and feature requests on the project's GitHub page.

## Related guides

- [Troubleshooting](TROUBLESHOOTING.md)
- [Installation](INSTALLATION.md)
- [Remote Access](REMOTE_ACCESS.md)
- [Connecting to an AI Provider](connections/connecting-to-a-provider.md)
