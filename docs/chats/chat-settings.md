# Chat Settings Overview

**Chat Settings** is the panel of options for the chat you have open: its model, characters, agents, search, summaries, branches and gallery. Most settings belong to that chat only.

## Opening Chat Settings

1. Open a chat.
2. Tap the **Chat Settings** button (the sliders icon). A panel opens. On a phone, **Help** (the **?**) shows a guide to the icons.
3. Tap a section's title to open it. Tap the title again to fold it away.

Chat Settings opens by itself when you create a chat. To close it, tap its **X** or the sliders button again.

On a computer, the sliders button starts at the top right of the chat. With the Tracker Panel shown on the right, it starts left of that panel. The Tracker Panel is a side panel in Roleplay that shows what agents (helpers that run alongside replies) track, such as characters in the scene.

You can drag the sliders button to a better spot. It lines up with nearby chat buttons as you drag. On a computer, hold <kbd>Alt</kbd> to place it freely. Each chat remembers the position. A small dot on the button means agents are working. In a Roleplay chat with Advanced Memory Recall, a steady dot in the other corner means some scene memories need attention. See [Fixing memory problems](../agents/memory.md#fixing-memory-problems).

The first time you open a chat, a short video shows how to arrange buttons and windows. Click **Got it**. It stays dismissed in your other chats and after a refresh. To keep the layout tips hidden in one chat, click the **X** beside them (**Hide these tips for this chat**).

## The sections at a glance

Which sections you see depends on the chat mode. The **Impersonate** section is in [Guided Generation and Impersonate](guided-and-impersonate.md).

- Settings profile bar: Applies or saves a bundle of chat settings. See [Settings Profiles](settings-profiles.md). (Conversation, Roleplay.)
- **Search messages**: Finds messages by words, or by `#` and a message number. Its **Bookmarks** and **Trash** tabs list bookmarked and deleted messages. (Not Game.)
- **Chat Name**: The name in your chat list. Click it to rename. It is never sent to the model.
- **Chat Branches**: Switch, rename, export and import branches. See [Chat Branches](branches.md).
- **Connection**: Which model answers in this chat. See below.
- **Prompt Preset**: The saved prompt structure for this chat.
- **Advanced Parameters**: Overrides generation settings such as temperature for this chat. See [Generation Parameters](../prompts/generation-parameters.md).
- **Persona**: Who you play. See [Choosing Your Persona in a Chat](../characters/choosing-your-persona.md). (Conversation, Roleplay.)
- **Characters**: The characters in the chat. (Conversation, Roleplay.)
- **Party**: Replaces **Persona** and **Characters** in one place. (Game.)
- **Group Chat**: Who speaks in a group. See [Group Chats](group-chats.md). (Chats with more than one character.)
- **Scoped Regex Scripts**: Per-chat control for regex scripts that belong to a character. See [Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting). (Shown only when a chat character has scoped scripts.)
- **Chat Variables**: Named text you reuse with `{{name}}`. See below.
- **Connected Chats**: Links a chat to another. See [Connected Chats](connected-chats.md).
- **Lorebooks**: Attaches world facts. See [Lorebooks Overview](../lorebooks/overview.md).
- **Chat Summary**: Reviews and creates summaries. See [Memory Recall and Chat Summaries](../agents/memory.md#chat-summary-roleplay). (Where summaries apply.)
- **Active Context**: Shows the lorebooks and context active in this chat. See [Token Budgets and Recursion](../lorebooks/token-budgets.md#seeing-skipped-entries-in-active-context).
- **Agents**: Turns on helpers. See [Agents: AI Helpers for Your Chats](../agents/agents-overview.md).
- **Agent activity**: Shows what agents did. Re-run trackers, retry or stop agents, clear trackers. See [Agent activity](../roleplay/getting-started.md#agent-activity). (Roleplay, with agents or Advanced Memory on.)
- **Author's Notes**: A note the model reads every turn. See [Author's Notes](../roleplay/getting-started.md#authors-notes). (Roleplay.)
- **Background**: The chat's background picture. (Roleplay, Game.)
- **Gallery**: The chat's images and videos. See [Scene Backgrounds and the Gallery](../media/scene-backgrounds.md).
- **Widgets**: Which HUD widgets show in the game. (Game.)
- **Impersonate**: Settings for the `/impersonate` command. (Roleplay.)
- **Memory Recall**: Remembers earlier parts of the chat. See [Memory Recall and Chat Summaries](../agents/memory.md). (Not in the Lite version.)
- **Function Calling**: Lets the model use tools (functions) in this chat.
- **Translation**: Automatic message translation. See [Message Translation](../integrations/message-translation.md).

Conversation chats also have Autonomous Messaging (characters message you first), Commands (actions characters take on their own) and notes sections. They are covered in [Conversation Mode: Getting Started](../conversation/getting-started.md).

## Choose the model for a chat

The **Connection** section picks the model that answers in this chat. A pick changes only this chat.

1. Open **Chat Settings** and the **Connection** section.
2. Tap the **Model** field. It shows the current model.
3. Check whether it says the chat follows **Main**. Main is the default model you set in **Connections**.
4. Pick a model. The chooser is the same as the model button in the chat input. The current model stays at the top, with recent and starred models below, grouped by account. Search across models and accounts, or use **Browse** to open one account's catalog.

**Follow Main** clears the chat's own choice, so the chat changes when you change Main. **Shuffle** picks a different model from your pool for each reply. See [Shuffle](../connections/organizing-connections.md#shuffle). If an account needs a key or is off, its model leads to the repair action. To add an account, see [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Use chat variables

A chat variable is a name for a piece of text. For example, add `char1` with the value `Mary`, then write `{{char1}} walks in.` in a message. The model reads "Mary walks in."

1. Open **Chat Settings** and the **Chat Variables** section.
2. Tap **Add variable**, then fill in the row's **name** and **value**.
3. Press <kbd>Enter</kbd> or click outside the field to save. The trash button removes a variable.

Names use letters, numbers and underscores, start with a letter or underscore, and are at most 64 characters. A name with exactly 21 characters is reserved for character references. A name that belongs to a built-in macro, such as `char` or `user`, is refused.

- Your message keeps showing the tag you typed. Only the model sees the value. Changing a value later changes every earlier turn that used the tag.
- Variables belong to this chat only, and they survive a restart.
- This is the storage `{{setvar}}` uses. A prompt section or lorebook entry that sets the same name overwrites your value.

With many variables, click **Search and edit all in the State Editor**. It lists every variable so you can search, edit, paste many as JSON and review changes before saving. See [The State Editor](../roleplay/hud-and-trackers.md#the-state-editor). For other double-brace macros, see [Prompt Macros](../prompts/macros.md).

## Settings profiles

A settings profile is a saved bundle of chat settings you can apply to other chats. The profile bar sits at the top of the panel and is not shown in Game. Saving, applying, importing, exporting and choosing a default are in [Settings Profiles](settings-profiles.md).

## Moving, pinning and locking the window

On a computer, Chat Settings floats over the chat, and its contents rearrange to fit its size. A window opens below its button the first time, or at its saved position.

- Move it: Drag its title bar. Or focus the title bar and use the arrow keys, with <kbd>Shift</kbd> for larger steps.
- Resize it: Drag an edge or corner. Or focus the bottom-right handle and use the arrow keys.
- Pin it: Click **Pin**. A pinned window stays open when you click elsewhere and reopens after a refresh. An unpinned window closes when you click outside it or press <kbd>Esc</kbd>, unless you are typing or using an open menu.
- Lock it: Click **Lock**. The window cannot move or resize, and its button stays in place. You can still open it.
- Close it: Click **X**.

Windows stay inside the chat area. A window or button can sit beside the message box but never covers it. On a phone, Chat Settings opens as a full-width panel that fits above the keyboard.

## Help, trackers and Reset View

These buttons are in the title bar.

- **Help** (the **?**) shows labels that explain the chat's controls. On a phone it closes Chat Settings first. To hide it, turn on **Settings → General → App Behavior → Hide chat Help button**.
- **Reset View** (the circular arrow) asks you to confirm, then restores this chat's starting layout: popped-out sections go back, and window sizes, positions, pins and locks reset.
- **Favorite layout** (the star) saves this arrangement for new chats. See [Choosing a layout for new chats](#choosing-a-layout-for-new-chats).
- **Tracker Panel** (the die) turns the panel on or off in a Roleplay chat that uses agents or Advanced Memory. On a computer it opens beside the chat. On a phone or tablet, a movable button opens it. It also changes the Tracker Panel preference in **Settings → Appearance**.

When the Tracker Panel is not shown, desktop trackers use the [Trackers window](../roleplay/hud-and-trackers.md#the-trackers-window). With little room beside your messages, it starts as a small **Trackers** button. Use the die to show the Tracker Panel again.

## Popping a section out into its own window

Pop out a section to give it its own window.

1. Click the **Pop out** button on the section (the box with an arrow, beside its **?**). On a computer you can also drag the section's title out of Chat Settings.
2. Move, resize, pin or lock the new window like Chat Settings. It starts unpinned, so clicking elsewhere shrinks it to a button.
3. To put it back, click **Put back in Chat Settings** (the curved arrow beside **X**), or drag the window onto Chat Settings.

**X** shrinks the section to a small button with its icon. Drag the button where you want it and click it to reopen the window. Trackers pop out of the Trackers window the same way, and their return button is **Put back in Trackers**.

On a phone, popping out closes Chat Settings and adds the section to the **Chat tools** three-dot menu. Tap the dots, then the section's round icon. Tap **Put back in Chat Settings** to return it.

## The phone's Chat tools menu

The movable three-dot button holds the tools you took out of Chat Settings. Tap it to roll out round icon buttons, then tap a tool. Tap the dots again to fold them away. Tracker buttons, the Game Map button and Character Profiles stay separate.

Drag the three-dot button to move the menu. Open it and use the lock at the top to fix it in place. While unlocked, drag a tool up or down to reorder it, or focus it and use the arrow keys. Locking stops both moving and reordering. The menu follows your chat widget style.

## Control windows and their buttons

Some tools open their own small windows: a Game's **Game controls**, **Session**, **Volume** and **Game Assets**, **Connected chat**, and controls from installed packages.

On a computer, these buttons start near the top right of the chat. Click one to open its window. Closing the window brings the button back. On a phone, they are in the **Chat tools** menu and open as full-width panels.

To keep one inside Chat Settings, open its window and choose **Put back in Chat Settings**. Use the section's pop-out button to separate it again. **Reset View** restores the starting arrangement.

Drag a button to move it. Nearby buttons line up as you drag. Hold <kbd>Alt</kbd> to place it freely, or use the arrow keys while it is focused. Conversation **Calls** stays a regular button. In Game, **Character Profiles** and the phone's **Map** button are movable, and their lock keeps each game's positions.

## Each chat keeps its own window layout

Each chat remembers window sizes and positions, pins and locks, popped-out sections and button positions. Phone positions and the Chat tools order and lock are saved apart from desktop positions. A [settings profile](settings-profiles.md) can save a layout for other chats.

## Choosing a layout for new chats

The star beside **Reset View** makes your current arrangement the starting layout for new chats in the same mode. Conversation, Roleplay and Game each have their own favorite.

1. Arrange the windows and buttons. Put tools inside Chat Settings or pop them out.
2. Hide the layout tips if new chats should hide them too.
3. Click the star. It fills in when the current layout, tips and Scoped Regex Scripts mode match your saved favorite.

The favorite saves positions, sizes, pins, locks, popped-out or docked tools, the layout tips choice and the chat's [Scoped Regex Scripts](../extending/regex-scripts.md#the-per-chat-scoped-regex-scripts-setting) mode. A chat on **Use preset default** saves no mode, so new chats follow their prompt preset. Characters, model, AI settings and messages stay with the chat.

To replace the favorite, change the arrangement and click the star again. To stop using it, click the filled star. This only affects chats you create afterward.

A settings profile with its own saved layout takes priority over the favorite when applied. A profile without one leaves the favorite arrangement in place. Profiles still apply their own layout tips setting and Scoped Regex Scripts mode. See [Settings Profiles](settings-profiles.md#favorite-window-layouts).

After an upgrade from an older version, your old arrangement of tool buttons is already starred for all three modes, until you replace or clear it. A fresh installation has the tools inside Chat Settings and no favorite.

## Changing how chat windows look

Open **Settings → Appearance → App** and scroll to **Chat widget style** at the bottom of **App Style**. **Default** keeps the Marinara look. **Dottore** uses icy blues, pale metal and cut corners. **Prof. Mari** uses gemstone blues, warm gold and arched frames. Both follow light and dark mode and style the movable buttons, windows and sections in all three chat modes.

- **Font**, **Shape** and three color pickers below the presets mix the look. Fonts installed in Marinara appear in the font list. Choosing a preset again resets the font, shape and custom colors.
- **Button size (px)** sets the size of movable chat buttons, from 32 to 96. An empty field keeps the default.
- **Apply preset font**, **Apply preset shape** and **Apply preset colors** extend the style to messages, input boxes and chat controls. Each works on its own, and all start off. Conversation messages use the font and colors but keep their own shape. With **Apply preset colors** on, quoted dialogue keeps each character's or persona's own Dialogue Highlight Color.

These choices do not move your windows. They are saved with your app preferences and sync to browsers connected to the same server. See [Custom CSS Themes](../appearance/custom-css-themes.md#ready-made-chat-window-styles).
