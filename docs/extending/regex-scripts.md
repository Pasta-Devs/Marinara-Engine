# Regex Scripts

A regex script is a find-and-replace rule that rewrites chat text automatically. Use one to clean up an AI reply, reshape your own message, or change the text the model receives. You do not need to know how to code to use one.

Regex is short for "regular expression", a search pattern that finds text matching a rule. You set the pattern once, and it runs on every matching message.

Example: some models wrap actions in asterisks.

```text
*She smiles* Hello there.
```

Copy this pattern exactly: `\*([^*]+)\*`. Replace it with `$1`, and the asterisks go away while the text inside stays:

```text
She smiles Hello there.
```

`$1` means "the text captured by the first pair of parentheses". Other common uses are deleting out-of-character notes in parentheses, censoring a word, and fixing one character's formatting quirks.

## Create a regex script

Your global scripts live on the **Regexes** tab of the **Presets** panel.

### Creating a regex script

1. Open **Presets → Regexes** from the top bar.
2. Click **Create regex**. The full editor opens.
3. Type a name at the top. A new script is named "New Regex Script".
4. In **Find Pattern (Regex)**, type `\*([^*]+)\*` (see [Editor fields](#editor-fields)).
5. In **Replace With**, type `$1`.
6. In **Apply To**, leave **AI Output** selected. The default **Only Display** apply mode is the safe choice (see [Choose where a script runs](#choose-where-a-script-runs)).
7. Paste `*She smiles* Hello there.` into **Live Test**. **Result:** should read `She smiles Hello there.`
8. Click **Save**. A green **Saved** note appears for a moment.
9. Check it in a chat: when an AI reply has text between asterisks, the asterisks no longer show.

If it did not work: a red error under **Find Pattern (Regex)** blocks saving. The pattern is invalid or unsafe; see [Safety and performance](#safety-and-performance).

### Manage your scripts

Each row shows the script name, an **AI** or **User** tag, and the pattern as `/pattern/flags`. Click the name or **Edit regex** to open the editor. Use the switch beside the script to change whether it runs, or **Delete regex** to remove it. With no scripts or folders, the tab reads "No regexes yet". Character-specific scripts live with the character. See [Limit a script to one character](#limit-a-script-to-one-character).

To find a script, type in **Search regexes**. It matches script names and patterns, and opens any folder that holds a match. You cannot drag scripts to reorder them while a search is active.

### Organize scripts in folders

1. Click **New Folder** and name the folder.
2. Click the folder icon on a script row to open **Move to folder**.
3. Pick the folder. To move a script out, pick **No folder (top level)**.

Click a folder name to expand or collapse it. Turn the folder switch off to pause its scripts across chats. The header shows **Paused**. Each script keeps its saved switch position. A script that is enabled but sits in a paused folder shows a gray switch and a **Paused by folder** label. Deleting the folder moves its scripts to the top level, where they follow their own switches.

Folders group scripts without changing when they run. Click **Execution order** to see the full list in the order it runs. Drag a script by its handle to change that order. When you have no folders, the list is already in execution order.
### Change several scripts at once

1. Click **Select regex scripts**.
2. Check the scripts you want to change.
3. Click **Enable selected**, **Disable selected** or **Move to folder**. You can also export or delete the selection.

**Enable selected** changes the individual switches. Resume a paused folder before its enabled scripts can run again.

## Editor fields

### Find Pattern (Regex)

The search pattern. Write only the pattern, without a slash at the start or end. The placeholder shows an example: `\*([^*]+)\*`.

### Replace With

The text that replaces each match. Leave it empty to delete the match. Reuse captured text with `$1`, `$2` and so on. These case changes work before a capture:

| Write | Result |
| --- | --- |
| `\u$1` | Capitalizes the first letter of the capture |
| `\U$1\E` | Makes the whole capture uppercase |
| `\l$1` | Lowercases the first letter of the capture |
| `\L$1\E` | Makes the whole capture lowercase |

Literal backslash text, such as a Windows path like `C:\Users`, is kept as written.

### Regex Flags

Toggle buttons that change how the pattern matches. A new script starts with `g` and `i` on.

| Flag | Meaning |
| --- | --- |
| `g` | Global: replace every match, not only the first |
| `i` | Case-insensitive |
| `m` | Multiline: `^` and `$` match at line breaks |
| `s` | dotAll: `.` also matches newline characters |
| `u`, `y`, `d` | Unicode, sticky and match indices, for special cases |

### Trim Strings

An optional list of plain strings removed after the replacement runs. Click **Add trim string** to add a row and the **X** button to remove one. Use it for a fixed piece of text that is easier to type than to match with a pattern.

### Live Test

Paste sample text, and the result appears under **Result:**. **Live Test** checks only the find, replace and trim logic. To check placement, folder pause, script switches, character scope or depth, try the script in a chat. You can use macros such as `{{user}}` and `{{char}}` in the pattern, replacement and trim strings. In **Live Test** they use sample values. See [Macros](../prompts/macros.md).

## Choose where a script runs

### Apply To

**Apply To** decides which side of the chat a script watches. Keep at least one selected. You can pick both.

- **AI Output**: runs on AI replies before they are displayed.
- **User Input**: runs on your messages before they are sent.

### Apply Mode

**Apply Mode** is inside **Advanced Options**. It decides what the rewrite changes. A new script starts on **Only Display**.

- **Only Display**: changes what you see in chat. The saved message and the model's later context stay the same. Safest for tidying how a reply looks.
- **Only Prompt**: changes what the model receives, also shown in the prompt preview. The display and the saved message stay the same. Use it to strip something the model keeps copying.
- **Both**: changes the display and the prompt text.

For your own messages, a **User Input** script set to **Only Display** or **Both** rewrites the message just before it is sent. The saved and sent message changes, not only how it looks. There is no display-only mode for outgoing messages.

### Execution Order and Depth Range

Both are in **Advanced Options**.

- **Execution Order** is a number. Lower numbers run first, which matters when several scripts can match the same text. A new script starts at 0, and the app assigns the next free number when you save. To change the order from the panel, see [Organize scripts in folders](#organize-scripts-in-folders).
- **Depth Range** limits how far back a script runs, with **Min** and **Max**. The newest message is depth 0, the one before it is depth 1, and so on. Leave both empty to run at any depth. Saving is blocked if **Min** is larger than **Max**.

### Group chats

This applies to **Only Prompt** and **Both** in a **Roleplay** chat with **Individual** group mode.

- Placement follows the character receiving the prompt.
- Your messages and other characters' messages count as **User Input**.
- The responding character's own replies count as **AI Output**, including earlier replies in the same group turn.
- Character limits still decide who receives the rewritten prompt. A narrator left out of a thought-hiding script keeps the original thoughts.

## Limit a script to one character

A script can belong to specific characters instead of running everywhere. There are two ways.

- In the editor, turn on **Specific Characters** in the **Apply To** card and pick one or more characters. With the toggle off, the script "Applies to all characters". Pick at least one character when it is on.
- On the character: open the character, go to the **Advanced** tab and find the **Regex Scripts** card. It lists only that character's scripts and has its own **Create regex**, import and export buttons. Save the character first, or the card says it cannot add scripts yet.

Opening the full editor from this card leaves the Character Editor. If the character has unsaved changes, the app warns you first.

### The per-chat Scoped Regex Scripts setting

Character-scoped scripts do not run in every chat on their own. A per-chat setting controls them. Open **Chat Settings**. The **Scoped Regex Scripts** section appears only when at least one character in that chat has scoped scripts.

| Mode | What happens |
| --- | --- |
| **Disabled** (default) | Scoped scripts are off. Only global scripts run. |
| **Exclusive** | Each scoped script changes only messages from its own character. |
| **Chat** | Every scoped script changes every message in the chat. |

**Use preset default** follows the prompt preset's **Scoped regex default**. Choosing a mode overrides it for this chat. To start new chats with a mode, use one of these:

- Set it as the preset default.
- Save it in your [default settings profile](../chats/settings-profiles.md#choosing-the-default-profile).
- Choose it, then click the favorite layout star beside **Reset View** (see [Choosing a layout for new chats](../chats/chat-settings.md#choosing-a-layout-for-new-chats)).

Below the modes, the panel lists each character's scoped scripts with a switch for each. That switch belongs to the script itself, so it changes the script in every chat. The mode controls display-side scripts. Prompt scripts always follow the character that is generating the reply.

## Import and replace scripts

### Import from SillyTavern

Marinara reads regex scripts bundled in a SillyTavern character card. When you import a card, an **Imported regex scripts** section offers two choices:

- **Character only** (default): the scripts stay scoped to that character.
- **Global**: the scripts go to **Presets → Regexes** and can run across chats.

The choice appears in the single-character import dialog and in the bulk **Import from SillyTavern Folder** flow. Scripts with an empty pattern or one that fails the safety check are skipped. To import a plain JSON file of scripts, use **Import regexes from JSON** in **Regexes**. See [Importing from SillyTavern](../data/importing-from-sillytavern.md).

**Export regexes to JSON** saves all global scripts to one file. Use **Export** while selecting scripts to save only those scripts. A regex JSON export keeps individual script settings. Use **Export Profile** with **Marinara Native** to keep folder membership and pause settings too. See [Export a profile](../data/backup-and-restore.md#export-a-profile). Scripts imported from regex JSON appear at the top level. Move them into a folder after importing.

### Replace a regex pack

1. In **Presets → Regexes**, choose **Select regex scripts**.
2. Check the old pack's entries. **Select all regex scripts** selects the whole library, including scripts in collapsed folders.
3. Click **Delete** in the action bar. Marinara asks you to confirm. To keep a copy first, click **Export** before deleting.
4. Import the updated pack.
5. If you use a folder for the pack, move the new scripts into it.

Failed deletions stay selected so you can retry. Unselected scripts stay in place. Preset assignments remain available in the regex editor.

## Safety and performance

Every pattern is checked before it can be saved or run. A pattern likely to run slowly and hang the app is blocked with this message, and saving stops until you fix it:

```text
Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns.
```

If you see this message, make the pattern shorter and simpler. Avoid these shapes:

- Patterns longer than 1000 characters.
- A repeating group inside another repeating group, such as `(a+)+`.
- Two broad wildcards in a row, such as `.*.*` or `\s*\w*`. A broad wildcard is a token like `.*`, `\s*` or `\w+` that can match unlimited text.
- Three or more broad wildcards anywhere in one pattern, even with other text between them.

A single repeat like `a+` or `(a+)`, or one broad wildcard such as a single `.*`, is fine.

Even a safe pattern has a time limit per replacement on a long message. If a script takes too long on one message, the app skips that script for that message only. The script stays on and tries again on the next message. Test a new pattern in **Live Test** on short sample text first.

## Related guides

- [Macros](../prompts/macros.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
