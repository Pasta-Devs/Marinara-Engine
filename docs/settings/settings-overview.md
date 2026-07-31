# Settings Overview

This guide maps the Marinara Engine **Settings** panel: its six tabs and what each one controls. It covers the **General** tab in depth, the **Text Rules** that format your chat text, and how settings sync across your devices.

## The Settings panel and its six tabs

Open **Settings** using the gear icon in the top bar. At the top of the panel is a **Search settings** box. Type any word (like `delete`, `streaming`, or `quotes`) and Marinara jumps you to the matching section.

The panel has six tabs. The table below shows what each tab controls.

| Tab | What you set there |
| --- | --- |
| **General** | App behavior, notifications, responses, input, text rules, and game playback. |
| **Appearance** | Theme, colors, fonts, chat layout, motion, and backgrounds. |
| **Generations** | Image and video defaults, and reusable prompt templates. |
| **Addons** | Professor Mari's sandboxed Personal Extension drafts, optionally unlocked External Extensions, and custom themes. |
| **Imports** | Restore full profiles and import from other apps. |
| **Advanced** | Admin access, updates, message tools, backups, and destructive resets. |

Here is where to read more about each tab:

- **General**: covered on this page (see the sections below).
- **Appearance**: see [Appearance Settings](../appearance/appearance-settings.md).
- **Generations**: see [Style Profiles](../media/style-profiles.md) and [Scene Video](../media/scene-video.md).
- **Addons**: see [Personal Extensions](../extending/personal-extensions.md) and [Custom CSS Themes](../appearance/custom-css-themes.md).
- **Imports**: see [Importing from SillyTavern](../data/importing-from-sillytavern.md) and [Backup and Restore](../data/backup-and-restore.md).
- **Advanced**: see the **Message Tools** section below, plus [Upgrading Marinara Engine](../UPGRADING.md), [Remote Access](../REMOTE_ACCESS.md), and [Clearing Your Data](../data/clearing-data.md).

## Settings, General tab

The **General** tab holds six sections. This page owns two of them in full: **App Behavior** and **Text Rules**. The others are summarized here and covered in detail in their own guides.

- **App Behavior**: language, delete safety, and show/hide toggles. Covered below.
- **Notifications**: notification sounds plus separate browser and Android app controls. Upload a **Custom sound** in MP3, WAV, OGG, M4A/MP4, or WebM format (up to 10 MB) to replace Marinara's built-in tone for every device connected to this server. You can preview, replace, or remove it at any time; an unreadable custom file falls back to the built-in tone, and the file is included in backups and profile exports. **Background Notifications** cover autonomous Conversation messages, while **Generation Completion Notifications** cover replies you start manually in Conversation, Roleplay, and Game modes. Both work while Marinara remains open but unfocused, and message contents stay hidden.
- **Responses**: how replies stream, save, and paginate. See [Sending and Streaming Messages](../chats/sending-and-streaming.md).
- **Input & Editing**: message input and fast edit controls. See [Message Actions](../chats/messages.md).
- **Text Rules**: formatting applied to chat text. Covered below.
- **Game Playback**: Game mode reading and navigation.

## App Behavior

This section is at **Settings** > **General** > **App Behavior**. It controls daily app behavior and a few show/hide toggles.

- **Language**: choose the app interface language. Marinara currently includes Arabic, Simplified Chinese, English,
  French, German, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian, and Spanish. Arabic uses a
  right-to-left layout. Interface text that has not been translated yet falls back to English. This setting changes
  Marinara's controls and guidance, not model prompts or chat content. To improve a translation or contribute another
  language, see [UI Localization](../development/localization.md).
- **Documentation Language**: choose the language for Marinara's built-in guides, separate from the interface language above. English is built in and never downloaded. Picking a language other than English shows **Download & Replace**, which downloads that language pack once and removes the previous pack, so only one downloaded language is kept. Guides that are not translated yet open in English with a small `EN` badge, and the docs search works in whichever language is active. Your choice survives updates, and the pack refreshes automatically after an update when its translations changed. If the downloaded guides ever go missing or get damaged, a **Fix documentation** button appears: it re-downloads the pack, and resets the guides to English when the download source cannot be reached.
- **Confirm before deleting**: on by default. When on, Marinara asks before it permanently deletes a chat, a character, or another item. Keep it on to avoid accidental deletes.
- **Achievements**: on by default. When on, the Home screen shows the achievements button and unlock notices. When off, tracking stays silent. See [Achievements](../home/achievements.md).
- **Music Player**: on by default. When on, the compact Music Player is shown. See [Music](../media/music.md).
- **Mini Mari surprise visits**: on by default. When on, a rare Chibi Professor Mari message can appear while you scroll. Turn it off if it gets in the way.

## Text Rules

This section is at **Settings** > **General** > **Text Rules**. These rules change how your chat text is handled. **Bold dialogue in quotes** and **Convert LaTeX symbols** are display-only, so they never change your saved messages. **Quote style** is different: it rewrites the actual quotation marks in text you type and save.

### Bold dialogue in quotes

On by default. When on, text inside quotation marks is shown in bold. Take this line:

```
"I missed you," she said.
```

With **Bold dialogue in quotes** on, the words `I missed you` appear in bold. Turn it off to keep the dialogue color without the bold.

### Convert LaTeX symbols

On by default. Some models write math using LaTeX commands. When on, common commands like `\rightarrow`, `\neq`, `\times`, and `\alpha` are shown as their normal symbols. For example, `\times` is displayed as the multiplication sign `×`, and `\alpha` is displayed as the Greek letter `α`. Code snippets are left alone.

### Quote style

Chooses how quotation marks are unified. Unlike the two rules above, this changes the text itself: messages you type and save are rewritten to use the style you pick. There are two options:

- **Straight**: keeps plain typewriter marks, like `"Hello," it's me.` This is the default.
- **Typographic**: replaces straight marks with curved quotation marks and apostrophes.

## Responses and Input & Editing

These two **General** sections tune how replies arrive and how you type and edit. Here are the controls, with links to the full guides.

The **Responses** section controls:

- **Enable streaming**: show AI text word by word as it generates.
- **Streaming speed**: how fast streamed text appears.
- **Trim incomplete model endings**: trim a trailing unfinished sentence before saving.
- **Messages per page**: how many messages load at once.

Read more in [Sending and Streaming Messages](../chats/sending-and-streaming.md).

The **Input & Editing** section controls:

- **Send on Enter**: pick which modes send when you press Enter.
- **Speech-to-text microphone**: show a microphone button in chat inputs.
- **Intuitive swipe navigation**: use arrow keys or touch swipes to move between alternate replies.
- **Reroll past the newest swipe**: make a new reply when you swipe past the newest one.
- **Up Arrow edits last message**: press Up Arrow on an empty input to edit the last message.
- **Double-click edits messages**: double-click a Roleplay message to edit it.

Read more in [Message Actions](../chats/messages.md).

## Message Tools

The **Message Tools** section is at **Settings** > **Advanced** > **Message Tools**. It is a hub of display and repair toggles. Each toggle below is off by default. The table shows what each one does and where to read more.

| Toggle | What it does | Full guide |
| --- | --- | --- |
| **Show message timestamps** | Shows the date and time on each message. | [Message Actions](../chats/messages.md) |
| **Show model name on messages** | Shows which AI model wrote each reply. | [Message Actions](../chats/messages.md) |
| **Show token usage on messages** | Shows prompt and completion token counts per message. | [Message Actions](../chats/messages.md) |
| **Show message numbers** | Shows a number on each message in the chat. | [Message Actions](../chats/messages.md) |
| **Guide swipes/regens with chat input** | Uses your current draft as direction when you regenerate. | [Guided Generation and Impersonate](../chats/guided-and-impersonate.md) |
| **Quick replies** | Adds alternate draft actions beside the Send button. | [Guided Generation and Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports** | Adds hidden thinking to chat exports. | [Exporting and Importing Chats](../chats/export-import.md) |
| **Debug mode** | Logs model payloads in the server console for support. | [Troubleshooting](../TROUBLESHOOTING.md) |

The rest of the **Advanced** tab is covered elsewhere. See [Upgrading Marinara Engine](../UPGRADING.md) for **Updates**, [Remote Access](../REMOTE_ACCESS.md) for **Admin Access**, [Backup and Restore](../data/backup-and-restore.md) for **Backup & Export**, and [Clearing Your Data](../data/clearing-data.md) for **Danger Zone**.

## How settings sync across devices

Marinara stores most of your settings on the server, so they follow you between browsers and devices. This is the settings sync behavior.

Here is how it works:

1. You change a setting anywhere in **Settings**.
2. About one second later, Marinara saves the change to the server with a timestamp.
3. When another browser opens the same Marinara server, it loads those saved settings.

Each device keeps the newer copy. This is last-write-wins by timestamp. Watch out for one result of this rule. If you open Marinara on a second device, its copy can quietly overwrite a setting you just changed on the first device. Give the app a moment to sync before you switch devices.

Two settings never sync. They stay per-browser on the device where you set them:

- **Display Size** (the interface text size)
- **Chat Font Size** (the chat text size)

Both live at **Settings** > **Appearance** > **Text & Scale**. Set them again on each device you use. See [Appearance Settings](../appearance/appearance-settings.md).

If the server is unreachable, the app keeps working from your local settings and retries the next time you change something.

## Related guides

- [Appearance Settings](../appearance/appearance-settings.md)
- [Message Actions](../chats/messages.md)
- [Sending and Streaming Messages](../chats/sending-and-streaming.md)
- [Exporting and Importing Chats](../chats/export-import.md)
- [Where Your Data Is Stored](../data/where-data-is-stored.md)
- [Upgrading Marinara Engine](../UPGRADING.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [Achievements](../home/achievements.md)
- [Personal Extensions](../extending/personal-extensions.md)
- [UI Localization](../development/localization.md)
