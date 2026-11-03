# Settings Overview

Find which part of **Settings** holds a control, set up the **General** tab, and learn how your settings sync between devices.

## The Settings panel and its six tabs

Open **Settings** with the gear icon in the top bar. The **Search settings** box at the top finds a setting by name. Type a word such as `delete`, `streaming` or `quotes`, and Marinara jumps to the matching section. It matches names in your interface language and in English.

The panel has six tabs. Each tab has its own sections.

### I want to…

| I want to… | Go to |
| --- | --- |
| Change the language | **Settings → General → App Behavior → Language** |
| Make text bigger | **Settings → Appearance → App → Text & Scale** |
| Change the theme or colors | **Settings → Appearance → App → App Style** |
| Set a notification sound | **Settings → General → Notifications** |
| Stop the delete confirmation | **Settings → General → App Behavior** |
| Add quick replies | **Settings → General → Input & Editing** |
| Make a backup | **Settings → Advanced → Backup & Export** |
| Delete my data | **Settings → Advanced → Danger Zone** |
| Update Marinara | **Settings → Advanced → Updates** |

### What each tab holds

**General** (this guide)

- **App Behavior** (with a **Search and Professor Mari settings** row)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules**
- **Game Playback**

**Appearance** has four buttons. See [Appearance Settings](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations** has **Overall Generations**, **Image Generation**, **Video Generation** and **Prompt Overrides**. Until you install the Illustrator agent, this tab only shows a prompt to download it. See [Style Profiles](../media/style-profiles.md) and [Scene Video](../media/scene-video.md).

**Addons** has the extension revision history, **Personal Extensions**, **External Extensions** (only when you have unlocked them) and **Theme Library**. See [Personal Extensions](../extending/personal-extensions.md) and [Custom CSS Themes](../appearance/custom-css-themes.md).

**Imports** has **Profile & Marinara**, **SillyTavern Import** and **Game Assets**. See [Backing Up and Restoring Marinara](../data/backup-and-restore.md) and [Importing from SillyTavern](../data/importing-from-sillytavern.md).

**Advanced** has these sections, in this order. See [The Advanced tab](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## The General tab

Each section of the **General** tab is at **Settings → General**.

| Section | What it controls |
| --- | --- |
| **App Behavior** | Language, delete safety, show and hide switches, and the **Search and Professor Mari settings** row. See [App Behavior](#app-behavior). |
| **Notifications** | Notification sounds, and browser and Android notifications. See [Notifications](#notifications). |
| **Responses** | Streaming, trimming and **Messages per page**. See [Sending and Streaming Messages](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, swipe and edit shortcuts. See [Input and Editing](#input-and-editing). |
| **Text Rules** | How chat text is formatted. See [Text Rules](#text-rules). |
| **Game Playback** | Game Mode reading and navigation. See [Game Mode: Getting Started](../game/getting-started.md). |

### App Behavior

| Setting | What it does |
| --- | --- |
| **Language** | Sets the interface language. It does not change model prompts or chat content. Text not yet translated shows in English. Arabic uses a right-to-left layout. Default: English. |
| **Documentation Language** | Sets the language of the built-in guides. See below. Default: English. |
| **Confirm before deleting** | Asks before Marinara permanently deletes a chat, a character or another item. Default: on. |
| **Hide chat Help button** | Hides the **Help** button in Conversation, Roleplay and Game chats. Default: off. |
| **Show Android status bar** | Keeps the time, battery and notification icons visible above Marinara. Works only in the Android app. Default: off. |
| **Achievements** | Tracks achievements, shows unlock notices and the Home bookmark and widget. See [Achievements](../home/achievements.md). Default: on. |
| **Disable seasonal ME themes** | Turns off Marinara's seasonal themes. Default: off. |
| **Music Player** | Shows the compact Music Player. It needs the **Music DJ** agent from **Agents → Agent Organizer**, and stays greyed out until you install it. See [Music](../media/music.md). Default: on. |

**Search and Professor Mari settings** is a row at the bottom of **App Behavior**. Select **Open** to go to the settings page for Search, quick answers and Professor Mari. See [Professor Mari](../home/professor-mari.md).

The interface languages are Arabic, Simplified Chinese, English, French, German, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian and Spanish. To improve a translation or add a language, see [UI Localization](../development/localization.md).

For **Documentation Language**, English is built in. Choose another language and click **Download & Replace**. Marinara downloads that language pack once and removes the previous one, so it keeps one downloaded language. Guides not yet translated open in English with a small `EN` badge. Docs search works in the active language. Your choice survives updates, and the pack refreshes after an update when its translations changed. If the downloaded guides go missing or break, a **Fix documentation** button appears. It downloads the pack again, or resets the guides to English if the download source cannot be reached.

### Notifications

Marinara plays a built-in tone for notifications. To use your own sound:

1. Open **Settings → General → Notifications**.
2. Upload a **Custom sound**: MP3, WAV, OGG, M4A, MP4 or WebM, up to 10 MB.

The sound plays on every device connected to this server. You can preview, replace or remove it. If the file cannot be read, Marinara plays the built-in tone. The file is part of backups and profile exports.

**Background Notifications** cover Conversation messages that characters send on their own. **Generation Completion Notifications** cover replies you start yourself in Conversation, Roleplay and Game Mode. Both work while Marinara is open but not in focus. They never show message contents.

### Input and Editing

Settings in **Settings → General → Input & Editing**:

| Setting | What it does |
| --- | --- |
| **Send on Enter** | Picks which modes send when you press Enter. |
| **Keep guidance after regenerating** | Leaves your direction in the message box after a guided regenerate. On by default. |
| **Add CYOA choices to the message box instead of sending them** | Puts a clicked choice in your message box so you can edit it first. |
| **Quick replies** | Adds draft actions beside the Send button. See [Guided Generation and Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Shows a microphone button in chat inputs. |
| **Intuitive swipe navigation** | Moves between swipes (several answers kept on one message) with arrow keys or a touch swipe. |
| **Reroll past the newest swipe** | Makes a new reply when you swipe past the newest one. |
| **Up Arrow edits last message** | Press Up Arrow on an empty input to edit your last message. |
| **Double-click edits messages** | Double-click a Roleplay message to edit it. |

The **Responses** section has **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (on by default) and **Messages per page**. See [Sending and Streaming Messages](../chats/sending-and-streaming.md). For message actions, see [Message Actions](../chats/messages.md).

### Text Rules

These rules change how chat text is handled in **Settings → General → Text Rules**. **Bold dialogue in quotes** and **Convert LaTeX symbols** only change how text looks, so your saved messages stay the same. **Quote style** rewrites the quotation marks in text you type and save.

| Setting | What it does |
| --- | --- |
| **Bold dialogue in quotes** | Shows text inside quotation marks in bold. On by default. |
| **Convert LaTeX symbols** | Shows LaTeX math commands as symbols. Code is left alone. On by default. |
| **Quote style** | **Straight** keeps plain marks (default). **Typographic** rewrites them as curved quotation marks and apostrophes. |
| **Load images from other websites in messages** | Controls images hosted on other websites. Off by default. |

#### Bold dialogue in quotes

With this on, the words inside the quotation marks in `"I missed you," she said.` appear in bold. Turn it off to keep the dialogue color without the bold.

#### Convert LaTeX symbols

Some models write math as LaTeX commands. With this on, `\rightarrow`, `\neq`, `\times` and `\alpha` show as `→`, `≠`, `×` and `α`.

#### Load images from other websites in messages

With this off, an image from another website in a message, greeting or card preview shows the website's name and a **Load image** button. This stops a message from contacting other sites on its own. Select **Load image** to show that image. Marinara remembers your choice on all your devices. Turn the setting on to show every image right away. Images stored in Marinara, such as gallery pictures, avatars and sprites, always show.

## The Advanced tab

| Section | Read more |
| --- | --- |
| **Admin Access** | [Remote Access](../REMOTE_ACCESS.md) |
| **Features** | [Feature Switches](../configuration/features.md) |
| **Updates** | [Upgrading Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Backing Up and Restoring Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [Clearing or Resetting Your Data](../data/clearing-data.md) |

### Message Tools

These switches are in **Settings → Advanced → Message Tools**. All are off by default, except **Show context usage** and **Show "older messages not sent" note**.

| Switch | What it does |
| --- | --- |
| **Show message timestamps** | Shows the date and time on each message. |
| **Show characters in Persona pickers** | Lists your characters in persona pickers so you can play as one. |
| **Show model name on messages** | Shows which model wrote each reply. |
| **Show token usage on messages** | Shows prompt and reply token counts per message. |
| **Show context usage** | Shows how full the context window was on the last measured request, in the connection switchers and Game chat settings. |
| **Show message numbers** | Shows a number on each message. |
| **Show "older messages not sent" note** | Shows a note under the newest reply when older messages did not fit the prompt. A cut-off or empty reply still shows its own note. |
| **Guide swipes/regens with chat input** | Uses your draft as direction when you regenerate. |
| **Include reasoning in exports** | Adds the model's hidden thinking to chat exports. |
| **Include private notes in exports** | Adds your private message notes to JSONL and text exports. Keep it off when you share a transcript. |
| **Debug mode** | Logs model payloads in the server console for support. |

For more, see [Message Actions](../chats/messages.md), [Personas](../characters/personas.md), [Choosing a model for one chat](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [Guided Generation and Impersonate](../chats/guided-and-impersonate.md), [Exporting and Importing Chats](../chats/export-import.md) and [Troubleshooting](../TROUBLESHOOTING.md).

## How settings sync across devices

Marinara saves most settings on the server, so they follow you between browsers and devices.

1. You change a setting in **Settings**.
2. About one second later, Marinara saves it to the server.
3. Another browser that opens the same server loads those settings.

The newest change wins. If you open Marinara on a second device soon after a change, its older copy can replace your change. Wait a moment before you switch devices.

Two settings never sync. Set them again on each device, at **Settings → Appearance → Text & Scale**:

- **Display Size**, the interface text size
- **Chat Font Size**, the chat text size

See [Appearance Settings](../appearance/appearance-settings.md). If the server cannot be reached, the app keeps working from your local settings and tries again at your next change.

## Related guides

- [Appearance Settings](../appearance/appearance-settings.md)
- [Message Actions](../chats/messages.md)
- [Where Marinara Stores Your Data](../data/where-data-is-stored.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
