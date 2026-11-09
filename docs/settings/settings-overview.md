# Settings Overview

Find which part of **Settings** holds a control, set up the **General** tab, and learn how your settings sync between devices.

## Opening Settings

Open **Library → Settings**: click **Library** at the top right, then **Settings** under the Library list. You can also press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac) and type the name of a setting, such as `streaming` or `font`, to jump straight to it. On a phone, Settings is in the Library behind the stack button at the top right.

**Search all settings** at the top of the page finds a setting by name. Type a word such as `delete`, `streaming` or `quotes`, and Marinara jumps to the matching section. It matches names in your interface language and in English.

Settings has nine tabs. Under the tabs, a row of buttons jumps to each section of the open tab. In these guides a path such as **Settings → Chatting → Message Box** means: the **Chatting** tab, the **Message Box** section.

### I want to…

| I want to… | Go to |
| --- | --- |
| Change the language | **Settings → General → Language** |
| Make text bigger | **Settings → Appearance → Fonts & Text Size** |
| Change the theme or colors | **Settings → Appearance → Theme**, or a ready-made look in **Settings → Appearance → CSS Themes** |
| Set a notification sound | **Settings → General → Notifications** |
| Stop the delete confirmation | **Settings → General → Confirmations & Help** |
| Replay the tour | **Settings → General → Confirmations & Help → Walkthroughs** |
| Add quick replies | **Settings → Chatting → Message Box** |
| Turn off touch swipes | **Settings → Chatting → Editing & Swipes** |
| Import from SillyTavern | **Settings → Data → SillyTavern Import** |
| Make a backup | **Settings → Data → Backup & Restore** |
| Delete my data | **Settings → Data → Delete Data** |
| Update Marinara | **Settings → Advanced → Updates** |
| Use Marinara from my phone | **Settings → Advanced → Access** and **Security** |

### What each tab holds

| Tab | Sections |
| --- | --- |
| **General** | **Language**, **Confirmations & Help**, **Extras**, **Professor Mari**, **Notifications** |
| **Chatting** | **Responses**, **Message Box**, **Editing & Swipes**, **Thinking**, **Text Formatting**, **Message Info** |
| **Appearance** | **Theme**, **Fonts & Text Size**, **Accessibility**, **Text Colors**, **Layout**, **Effects**, **Backgrounds**, **Chat Buttons & Windows**, **CSS Themes**. See [Appearance Settings](../appearance/appearance-settings.md). |
| **Conversation** | **Conversation Layout**, **Conversation Background** |
| **Roleplay** | **Tracker Panel**, **Roleplay Messages**, **Avatars**, **Visual Novel** |
| **Game** | **Game Text**, **Game Art**, **Game Assets**. See [Game Assets](../game/game-assets.md). |
| **Media** | **Generation Defaults**, **Image Generation**, **Video Generation**, **Prompt Overrides**. Until you install the Illustrator agent, this tab only offers to download it. See [Style Profiles](../media/style-profiles.md) and [Prompt Overrides](../prompts/prompt-overrides.md). |
| **Data** | **SillyTavern Import**, **Backup & Restore**, **Chat Exports**, **Storage Cleanup**, **Delete Data**. See [Backing Up and Restoring Marinara](../data/backup-and-restore.md) and [Clearing or Resetting Your Data](../data/clearing-data.md). |
| **Advanced** | **Updates**, **Server**, **Timeouts & Retries**, **Custom Request Parameters**, **Lorebooks**, **Security**, **Access**, **Multiplayer**, **Troubleshooting**. See [The Advanced tab](#the-advanced-tab). |

Personal and External Extensions are not in Settings. They have their own page, **Library → Extensions**. See [Personal Extensions](../extending/personal-extensions.md).

### In the classic layout

If you turned off **New layout** in **Settings → Appearance → Theme**, Settings is a panel with six tabs and the same sections, grouped differently:

| Classic tab | Holds the new layout's |
| --- | --- |
| **General** | General tab, plus **Responses**, **Message Box**, **Editing & Swipes**, **Thinking**, **Text Formatting** and **Game Text** |
| **Appearance** | Appearance, Conversation and Roleplay tabs, plus **Game Art**, behind four buttons: **App**, **Conversation**, **Roleplay** and **Game** |
| **Generations** | Media tab |
| **Addons** | **CSS Themes** and Personal Extensions |
| **Imports** | **SillyTavern Import**, **Game Assets** and profile import |
| **Advanced** | Advanced tab, plus **Message Info**, **Backup & Restore**, **Chat Exports**, **Storage Cleanup** and **Delete Data** |

## The General tab

| Section | What it controls |
| --- | --- |
| **Language** | The interface language and the language of these guides. See [Language](#language). |
| **Confirmations & Help** | **Confirm before deleting**, **Hide chat Help button** and **Walkthroughs**. |
| **Extras** | **Achievements**, **Disable seasonal Marinara themes** and **Music Player**. |
| **Professor Mari** | One row, **Search and Professor Mari settings**. Click **Open** for Search, quick answers and Professor Mari. See [Professor Mari](../home/professor-mari.md). |
| **Notifications** | Where notices appear, notification sounds, and browser and Android notifications. See [Notifications](#notifications). |

### Language

| Setting | What it does |
| --- | --- |
| **Language** | Sets the interface language. It does not change model prompts or chat content. Text not yet translated shows in English. Arabic uses a right-to-left layout. Default: English. |
| **Documentation Language** | Sets the language of the built-in guides. See below. Default: English. |

The interface languages are Arabic, Simplified Chinese, English, French, German, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian and Spanish. To improve a translation or add a language, see [UI Localization](../development/localization.md).

For **Documentation Language**, English is built in. Choose another language and click **Download & Replace**. Marinara downloads that language pack once and removes the previous one, so it keeps one downloaded language. Guides not yet translated open in English with a small `EN` badge. Docs search works in the active language. Your choice survives updates, and the pack refreshes after an update when its translations changed. If the downloaded guides go missing or break, a **Fix documentation** button appears. It downloads the pack again, or resets the guides to English if the download source cannot be reached.

### Confirmations, help and extras

| Setting | What it does |
| --- | --- |
| **Confirm before deleting** | Asks before Marinara permanently deletes a chat, a character or another item. Default: on. |
| **Hide chat Help button** | Hides the **Help** button in Conversation, Roleplay and Game chats. Default: off. |
| **Walkthroughs** | **Replay the welcome tour**, replay this device's walkthrough, or **Show chat mode tips again**. See [The First-Time Tutorial](../home/tutorial.md). |
| **Achievements** | Tracks achievements, shows unlock notices and the Achievements widget. See [Achievements](../home/achievements.md). Default: on. |
| **Disable seasonal Marinara themes** | Turns off Marinara's seasonal looks. Default: off. |
| **Music Player** | Shows the compact Music Player. It needs the **Music DJ** agent from **Library → Agents**, and stays greyed out until you install it. See [Music](../media/music.md). Default: on. |

**Show Android status bar** and **Open Android launcher** are in **Settings → Appearance → Layout**, and only in the Android app.

### Notifications

Marinara plays a built-in tone for notifications. To use your own sound:

1. Open **Settings → General → Notifications**.
2. Click **Choose sound** under **Custom sound**: MP3, WAV, OGG, M4A, MP4 or WebM, up to 10 MB.

The sound plays on every device connected to this server. You can preview, replace or remove it. If the file cannot be read, Marinara plays the built-in tone. The file is part of backups and profile exports.

**Background Notifications** cover Conversation messages that characters send on their own. **Generation Completion Notifications** cover replies you start yourself in Conversation, Roleplay and Game Mode. Both work while Marinara is open but not in focus. They never show message contents. **Notification position** chooses whether error messages and other notices appear at the top or bottom.

## The Chatting tab

### Message Box and Editing & Swipes

| Setting | Section | What it does |
| --- | --- | --- |
| **Send on Enter** | Message Box | Picks which modes send when you press Enter. |
| **Keep guidance after regenerating** | Message Box | Leaves your direction in the message box after a guided regenerate. On by default. |
| **Add CYOA choices to the message box instead of sending them** | Message Box | Puts a clicked choice in your message box so you can edit it first. |
| **Quick replies** | Message Box | Adds draft actions beside the Send button. See [Guided Generation and Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Message Box | Shows a microphone button in chat inputs. |
| **Show characters in Persona pickers** | Message Box | Lists your characters in persona pickers so you can play as one. |
| **Up Arrow edits last message** | Editing & Swipes | Press Up Arrow on an empty input to edit your last message. |
| **Double-click edits messages** | Editing & Swipes | Double-click a Roleplay message to edit it. |
| **Intuitive swipe navigation** | Editing & Swipes | Moves between swipes (several answers kept on one message) with arrow keys or a touch swipe. |
| **Reroll past the newest swipe** | Editing & Swipes | Makes a new reply when you swipe past the newest one. |
| **Swipe gestures on touch screens** | Editing & Swipes | The new layout's swipes on phones and tablets. See [Touch gestures](../chats/messages.md#touch-gestures). On by default. |
| **Guide swipes/regens with chat input** | Editing & Swipes | Uses your draft as direction when you regenerate. |
| **Always show swipe menu in Conversation** / **in Roleplay** | Editing & Swipes | Keeps the swipe arrows visible instead of only on hover. |

The **Responses** section has **Type out replies as they arrive (streaming)**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (on by default) and **Messages per page**. See [Sending and Streaming Messages](../chats/sending-and-streaming.md). **Thinking** has **Show Thinking In Messages** and **Don't Collapse Thinking**. For message actions, see [Message Actions](../chats/messages.md).

### Text Formatting

These rules change how chat text is handled in **Settings → Chatting → Text Formatting**. **Bold dialogue in quotes** and **Convert LaTeX symbols** only change how text looks, so your saved messages stay the same. **Quote style** rewrites the quotation marks in text you type and save.

| Setting | What it does |
| --- | --- |
| **Bold dialogue in quotes** | Shows text inside quotation marks in bold. On by default. |
| **Convert LaTeX symbols** | Shows LaTeX math commands as symbols. Code is left alone. On by default. |
| **Force Solid Colors for Inline Names** | Shows character names inside messages in one solid color instead of a gradient. |
| **Quote style** | **Straight** keeps plain marks (default). **Typographic** rewrites them as curved quotation marks and apostrophes. |

#### Bold dialogue in quotes

With this on, the words inside the quotation marks in `"I missed you," she said.` appear in bold. Turn it off to keep the dialogue color without the bold.

#### Convert LaTeX symbols

Some models write math as LaTeX commands. With this on, `\rightarrow`, `\neq`, `\times` and `\alpha` show as `→`, `≠`, `×` and `α`.

#### Load images from other websites in messages

This switch is in **Settings → Advanced → Security**. Off by default. With it off, an image from another website in a message, greeting or card preview shows the website's name and a **Load image** button. This stops a message from contacting other sites on its own. Select **Load image** to show that image. Marinara remembers your choice on all your devices. Turn the setting on to show every image right away. Images stored in Marinara, such as gallery pictures, avatars and sprites, always show.

### Message Info

These switches are in **Settings → Chatting → Message Info**. All are off by default, except **Show context usage** and **Show "older messages not sent" note**.

| Switch | What it does |
| --- | --- |
| **Show message timestamps** | Shows the date and time on each message. |
| **Show model name on messages** | Shows which model wrote each reply. |
| **Show token usage on messages** | Shows prompt and reply token counts per message. |
| **Show context usage** | Shows how full the context window was on the last measured request, in the connection switchers and Game chat settings. |
| **Show message numbers** | Shows a number on each message. |
| **Show "older messages not sent" note** | Shows a note under the newest reply when older messages did not fit the prompt. A cut-off or empty reply still shows its own note. |

**Include reasoning in exports** and **Include private notes in exports** are in **Settings → Data → Chat Exports**. See [Exporting and Importing Chats](../chats/export-import.md).

## The Advanced tab

| Section | What it holds | Read more |
| --- | --- | --- |
| **Updates** | **Release Channel**, **Check for Updates** and **Refresh App** | [Upgrading Marinara Engine](../UPGRADING.md) |
| **Server** | **Restart Server** | |
| **Timeouts & Retries** | How long to wait for slow backends, and **Retry failed provider calls** | [Server Configuration Reference](../CONFIGURATION.md) |
| **Custom Request Parameters** | Reusable controls for provider-specific request fields | [Generation Parameters](../prompts/generation-parameters.md) |
| **Lorebooks** | **Stable lorebook picks** and **Lorebook activation stats** | [Feature Switches](../configuration/features.md) |
| **Security** | The admin secret, **Allow custom Agent imports**, **Allow third-party extension imports** and **Load images from other websites in messages** | [Remote Access](../REMOTE_ACCESS.md#the-admin-secret-and-privileged-actions) |
| **Access** | The remote login, **Add a device** and what this server lets in | [Remote Access](../REMOTE_ACCESS.md) |
| **Multiplayer** | Playing one chat together across devices (work in progress) | [Server Configuration Reference](../CONFIGURATION.md) |
| **Troubleshooting** | **Copy Support Diagnostics**, **Debug mode** (logs model payloads in the server console) and **Open Console** | [Troubleshooting](../TROUBLESHOOTING.md) |

## How settings sync across devices

Marinara saves most settings on the server, so they follow you between browsers and devices.

1. You change a setting in **Settings**.
2. About one second later, Marinara saves it to the server.
3. Another browser that opens the same server loads those settings.

The newest change wins. If you open Marinara on a second device soon after a change, its older copy can replace your change. Wait a moment before you switch devices.

Two settings never sync. Set them again on each device, at **Settings → Appearance → Fonts & Text Size**:

- **Display Size**, the interface text size
- **Chat Font Size**, the chat text size

See [Appearance Settings](../appearance/appearance-settings.md). If the server cannot be reached, the app keeps working from your local settings and tries again at your next change.

## Related guides

- [Appearance Settings](../appearance/appearance-settings.md)
- [Message Actions](../chats/messages.md)
- [Where Marinara Stores Your Data](../data/where-data-is-stored.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
